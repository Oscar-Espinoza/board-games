//! Ephemeral signaling only. No game state, deck, hands or provider tokens enter logs.
use axum::{
    Router,
    extract::{
        ConnectInfo, State,
        ws::{Message, WebSocket, WebSocketUpgrade},
    },
    http::{HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
};
use rand::RngCore;
use std::{
    collections::HashMap,
    net::SocketAddr,
    sync::Arc,
    time::{Duration, Instant},
};
use table_protocol::{GameId, PlayerId};
use table_protocol::{
    Hello, MAX_MESSAGE, Member, PROTOCOL_VERSION, RoomView, SignalCommand, SignalEvent,
};
use tokio::sync::{Mutex, Semaphore, mpsc};
use tower_http::{services::ServeDir, set_header::SetResponseHeaderLayer};
// Server operational budgets are independent of the shared wire-message budget.
const MAX_ROOMS: usize = 256;
const MAX_SOCKETS: usize = 512;
const MAX_TRACKED_IPS: usize = 4096;
const UPGRADES_PER_MINUTE: u32 = 128;
const HANDSHAKE_TIMEOUT: Duration = Duration::from_secs(10);
const HANDOFF_TIMEOUT: Duration = Duration::from_secs(15);
const SIGNAL_QUEUE_CAPACITY: usize = 64;
const SOCKET_IDLE_TIMEOUT: Duration = Duration::from_secs(35);
const MESSAGES_PER_SECOND: u32 = 40;
const ICE_REQUEST_INTERVAL: Duration = Duration::from_secs(60);
const ROOM_LIFETIME: Duration = Duration::from_secs(4 * 3600);
#[derive(Clone)]
struct App {
    rooms: Arc<Mutex<HashMap<String, Room>>>,
    connections: Arc<Semaphore>,
    rates: Arc<Mutex<HashMap<std::net::IpAddr, (Instant, u32)>>>,
    http: reqwest::Client,
}
struct Seat {
    member: Member,
    credential: String,
    socket: Option<mpsc::Sender<SignalEvent>>,
    generation: u64,
}
struct Handoff {
    transfer: u64,
    successor: PlayerId,
    started: Instant,
    ready: bool,
}
struct Room {
    options: table_protocol::RoomOptions,
    game_id: GameId,
    rules_version: u32,
    next_transfer: u64,
    capacity: u8,
    host_id: PlayerId,
    epoch: u64,
    ready: std::collections::BTreeSet<PlayerId>,
    active: bool,
    closed: bool,
    handoff: Option<Handoff>,
    invite: String,
    seats: Vec<Seat>,
    round: u64,
    locked: bool,
    created: Instant,
    host_lost: Option<Instant>,
}
impl Room {
    fn expire_handoff(&mut self) {
        if self
            .handoff
            .as_ref()
            .is_some_and(|h| h.started.elapsed() >= HANDOFF_TIMEOUT)
        {
            self.handoff = None;
            self.broadcast(SignalEvent::HandoffCancel {
                message: "Transfer timed out. You are still in the room; retry Leave room.".into(),
            });
        }
    }
    fn cancel_handoff(&mut self, message: &str) {
        if self.handoff.take().is_some() {
            self.broadcast(SignalEvent::HandoffCancel {
                message: message.into(),
            });
        }
    }
    fn depart(&mut self, player: PlayerId) {
        self.cancel_handoff(
            "A player left during transfer. You are still in the room; retry Leave room.",
        );
        if let Some(s) = self.seats.iter_mut().find(|s| s.member.id == player) {
            if let Some(tx) = s.socket.take() {
                let _ = tx.try_send(SignalEvent::Left);
            }
            s.member.connected = false;
            s.generation += 1;
        }
        self.ready.remove(&player);
        if player == self.host_id {
            if let Some(next) = self
                .seats
                .iter()
                .find(|s| s.member.id != player && !s.member.bot && s.member.connected)
            {
                self.ready.clear();
                self.host_id = next.member.id;
                self.epoch += 1;
            } else {
                self.closed = true;
                self.broadcast(SignalEvent::Ended {
                    message: "Room closed: no human successor.".into(),
                });
            }
        }
        if !self.locked {
            self.seats.retain(|s| s.member.id != player);
        }
        self.broadcast(SignalEvent::Departed { player });
        self.publish();
    }

    fn view(&self) -> RoomView {
        RoomView {
            options: self.options,
            game_id: self.game_id,
            rules_version: self.rules_version,
            capacity: self.capacity,
            host_id: self.host_id,
            epoch: self.epoch,
            invite: self.invite.clone(),
            members: self.seats.iter().map(|s| s.member.clone()).collect(),
            round: self.round,
            locked: self.locked,
        }
    }
    fn broadcast(&self, event: SignalEvent) {
        for seat in &self.seats {
            if let Some(tx) = &seat.socket {
                let _ = tx.try_send(event.clone());
            }
        }
    }
    fn publish(&self) {
        self.broadcast(SignalEvent::Room { room: self.view() });
    }
    fn expired(&self) -> bool {
        self.closed
            || self.created.elapsed() >= ROOM_LIFETIME
            || self
                .host_lost
                .is_some_and(|t| t.elapsed() >= Duration::from_millis(table_protocol::HOST_WAIT_MS))
    }
}
fn secret() -> String {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}
fn identity(name: String, avatar: u8) -> Result<(String, u8), String> {
    let name = name.trim();
    if name.is_empty()
        || name.chars().count() > 24
        || name.chars().any(char::is_control)
        || avatar > 7
    {
        Err("Use a name of 1–24 characters and a preset avatar.".into())
    } else {
        Ok((name.to_owned(), avatar))
    }
}
fn seat(id: u8, name: String, avatar: u8, bot: bool) -> Seat {
    Seat {
        member: Member {
            id: PlayerId(id),
            name,
            avatar,
            bot,
            connected: bot,
        },
        credential: secret(),
        socket: None,
        generation: 0,
    }
}
/// Admission and resume are atomic under the room lock. Credentials never leave their own Welcome.
fn admit(
    rooms: &mut HashMap<String, Room>,
    hello: Hello,
    tx: mpsc::Sender<SignalEvent>,
) -> Result<(String, PlayerId, u64, SignalEvent), String> {
    let (invite, id) = match hello {
        Hello::Create {
            version,
            game_id,
            rules_version,
            name,
            avatar,
        } => {
            if version != PROTOCOL_VERSION || rules_version != game_id.entry().rules_version {
                return Err("Unsupported protocol. Reload this page.".into());
            }
            if !game_id.entry().playable {
                return Err("This game is not available yet.".into());
            }
            if rooms.len() >= MAX_ROOMS {
                return Err("Room capacity reached. Try later.".into());
            }
            let (name, avatar) = identity(name, avatar)?;
            let invite = secret();
            rooms.insert(
                invite.clone(),
                Room {
                    options: game_id.default_options(),
                    game_id,
                    rules_version,
                    next_transfer: 0,
                    capacity: game_id.entry().default_capacity,
                    host_id: PlayerId(0),
                    epoch: 0,
                    ready: Default::default(),
                    active: false,
                    closed: false,
                    handoff: None,
                    invite: invite.clone(),
                    seats: vec![seat(0, name, avatar, false)],
                    round: 0,
                    locked: false,
                    created: Instant::now(),
                    host_lost: None,
                },
            );
            (invite, PlayerId(0))
        }
        Hello::Join {
            version,
            game_id,
            rules_version,
            invite,
            name,
            avatar,
        } => {
            if version != PROTOCOL_VERSION || rules_version != game_id.entry().rules_version {
                return Err("Unsupported protocol. Reload this page.".into());
            }
            let (name, avatar) = identity(name, avatar)?;
            let room = rooms.get_mut(&invite).ok_or("Room not found or expired.")?;
            if room.game_id != game_id || room.rules_version != rules_version {
                return Err("This invite belongs to another game or rules version.".into());
            }
            if room.expired() || room.locked || room.seats.len() >= usize::from(room.capacity) {
                return Err("Room is full, expired or already playing.".into());
            }
            let id = (0..8)
                .find(|id| !room.seats.iter().any(|s| s.member.id == PlayerId(*id)))
                .unwrap();
            room.seats.push(seat(id, name, avatar, false));
            (invite, PlayerId(id))
        }
        Hello::Resume {
            version,
            game_id,
            rules_version,
            invite,
            credential,
        } => {
            if version != PROTOCOL_VERSION || rules_version != game_id.entry().rules_version {
                return Err("Unsupported protocol. Reload this page.".into());
            }
            let room = rooms.get(&invite).ok_or("Room not found or expired.")?;
            if room.game_id != game_id || room.rules_version != rules_version {
                return Err("This invite belongs to another game or rules version.".into());
            }
            if room.expired() {
                return Err("Room expired.".into());
            }
            let id = room
                .seats
                .iter()
                .find(|s| !s.member.bot && s.credential == credential)
                .map(|s| s.member.id)
                .ok_or("Invalid reconnect credential.")?;
            (invite, id)
        }
    };
    let room = rooms.get_mut(&invite).unwrap();
    room.cancel_handoff("A player reconnected. Retry Leave room once connections are ready.");
    let s = room.seats.iter_mut().find(|s| s.member.id == id).unwrap();
    if let Some(old) = s.socket.take() {
        let _ = old.try_send(SignalEvent::Ended {
            message: "This seat reconnected in another connection.".into(),
        });
    }
    s.generation += 1;
    s.member.connected = true;
    s.socket = Some(tx);
    let generation = s.generation;
    let credential = s.credential.clone();
    if id == room.host_id {
        room.ready.clear();
        room.host_lost = None;
    }
    let event = SignalEvent::Welcome {
        version: PROTOCOL_VERSION,
        player: id,
        credential,
        room: room.view(),
    };
    Ok((invite, id, generation, event))
}
fn command(room: &mut Room, sender: PlayerId, cmd: SignalCommand) -> Result<(), String> {
    room.expire_handoff();
    if room.closed {
        return Err("Room closed".into());
    }
    match cmd {
        SignalCommand::Ready { player, ready } => {
            // Channel closure can arrive after a lobby departure or seat reuse by a bot.
            // Only the host may clear readiness; this stale clear has no remaining target.
            if sender == room.host_id
                && player != room.host_id
                && !ready
                && !room
                    .seats
                    .iter()
                    .any(|s| s.member.id == player && !s.member.bot)
            {
                return Ok(());
            }
            if sender != room.host_id
                || player == room.host_id
                || !room.seats.iter().any(|s| {
                    s.member.id == player && !s.member.bot && (!ready || s.member.connected)
                })
            {
                return Err("Invalid readiness".into());
            }
            if !ready {
                room.cancel_handoff(
                    "A game connection changed. Retry Leave room once connections are ready.",
                );
            }
            if ready {
                room.ready.insert(player);
            } else {
                room.ready.remove(&player);
            }
        }
        SignalCommand::RoundFinished { round, epoch } => {
            if sender != room.host_id || round != room.round || epoch != room.epoch {
                return Err("Invalid round completion".into());
            }
            room.active = false;
        }
        SignalCommand::Leave => {
            if sender == room.host_id
                && room.locked
                && room
                    .seats
                    .iter()
                    .any(|s| s.member.id != sender && !s.member.bot && s.member.connected)
            {
                return Err("Transfer authority before leaving.".into());
            }
            room.depart(sender);
        }
        SignalCommand::HandoffPrepare {
            successor,
            round,
            epoch,
        } => {
            let first = room
                .seats
                .iter()
                .find(|s| {
                    s.member.id != room.host_id
                        && !s.member.bot
                        && s.member.connected
                        && room.ready.contains(&s.member.id)
                })
                .map(|s| s.member.id);
            if sender != room.host_id
                || !room.locked
                || round != room.round
                || epoch != room.epoch
                || first != Some(successor)
                || room.handoff.is_some()
            {
                return Err("Cannot prepare handoff. Check connections and retry.".into());
            }
            room.next_transfer += 1;
            let transfer = room.next_transfer;
            room.handoff = Some(Handoff {
                transfer,
                successor,
                started: Instant::now(),
                ready: false,
            });
            room.broadcast(SignalEvent::HandoffPrepare {
                transfer,
                host: sender,
                successor,
                round,
                epoch,
            });
        }
        SignalCommand::HandoffReady {
            round,
            epoch,
            transfer,
        } => {
            let h = room.handoff.as_mut().ok_or("No pending handoff")?;
            if transfer != h.transfer
                || sender != h.successor
                || round != room.round
                || epoch != room.epoch
            {
                return Err("Invalid handoff readiness".into());
            }
            h.ready = true;
            if let Some(tx) = &room
                .seats
                .iter()
                .find(|s| s.member.id == room.host_id)
                .unwrap()
                .socket
            {
                let _ = tx.try_send(SignalEvent::HandoffReady {
                    round,
                    epoch,
                    transfer,
                });
            }
        }
        SignalCommand::HandoffCommit {
            round,
            epoch,
            transfer,
        } => {
            let h = room.handoff.as_ref().ok_or("No pending handoff")?;
            if transfer != h.transfer
                || sender != room.host_id
                || round != room.round
                || epoch != room.epoch
                || !h.ready
                || !room.ready.contains(&h.successor)
                || !room
                    .seats
                    .iter()
                    .any(|s| s.member.id == h.successor && s.member.connected)
            {
                return Err("Handoff is not ready".into());
            }
            let successor = h.successor;
            let permits = [room.host_id, successor]
                .into_iter()
                .map(|id| {
                    room.seats
                        .iter()
                        .find(|s| s.member.id == id)
                        .and_then(|s| s.socket.clone())
                        .ok_or("Transfer participant disconnected")?
                        .try_reserve_owned()
                        .map_err(|_| "Transfer participant is busy; retry Leave room")
                })
                .collect::<Result<Vec<_>, _>>()?;
            room.host_id = successor;
            room.epoch += 1;
            room.handoff = None;
            room.host_lost = None;
            room.ready.clear();
            let event = SignalEvent::HandoffCommit {
                room: room.view(),
                former_host: sender,
            };
            for permit in permits {
                permit.send(event.clone());
            }
            for s in &room.seats {
                if s.member.id != sender
                    && s.member.id != successor
                    && let Some(tx) = &s.socket
                {
                    let _ = tx.try_send(event.clone());
                }
            }
            room.depart(sender);
        }
        SignalCommand::HandoffCancel {
            round,
            epoch,
            transfer,
        } => {
            if round != room.round
                || epoch != room.epoch
                || !room.handoff.as_ref().is_some_and(|h| {
                    transfer == h.transfer && (sender == room.host_id || sender == h.successor)
                })
            {
                return Err("Invalid cancellation".into());
            }
            room.handoff = None;
            room.broadcast(SignalEvent::HandoffCancel {
                message: "Transfer cancelled. You are still in the room; retry Leave room.".into(),
            });
        }
        SignalCommand::Signal { to, data, epoch } => {
            if epoch != room.epoch || sender == to || (sender != room.host_id && to != room.host_id)
            {
                return Err("Only host-centered signaling is permitted.".into());
            }
            let target = room
                .seats
                .iter()
                .find(|s| s.member.id == to && !s.member.bot)
                .ok_or("Unknown peer.")?;
            if let Some(tx) = &target.socket {
                tx.try_send(SignalEvent::Signal {
                    from: sender,
                    data,
                    epoch,
                })
                .map_err(|_| "Peer is busy or disconnected.")?;
            }
        }
        SignalCommand::UpdateOptions { options } => {
            if sender != room.host_id || room.locked {
                return Err("Only the host can choose options before play.".into());
            }
            options.validate(room.game_id)?;
            room.options = options;
            room.publish();
        }
        SignalCommand::Capacity { .. }
        | SignalCommand::AddBot
        | SignalCommand::RemoveBot { .. }
        | SignalCommand::Start => {
            if sender != room.host_id {
                return Err("Only the host controls the room.".into());
            }
            if room.handoff.is_some() {
                return Err("Authority transfer in progress".into());
            }
            match cmd {
                SignalCommand::Capacity { capacity } => {
                    if room.locked
                        || !(room.game_id.entry().min_players..=room.game_id.entry().max_players)
                            .contains(&capacity)
                        || usize::from(capacity) < room.seats.len()
                    {
                        return Err(format!(
                            "Choose {}–{} seats, at least the occupied seats, before play.",
                            room.game_id.entry().min_players,
                            room.game_id.entry().max_players
                        ));
                    }
                    room.capacity = capacity;
                }
                SignalCommand::AddBot => {
                    if !room.game_id.entry().bots
                        || room.locked
                        || room.seats.len() >= usize::from(room.capacity)
                    {
                        return Err("Room is locked or full.".into());
                    }
                    let id = (0..8)
                        .find(|id| !room.seats.iter().any(|s| s.member.id == PlayerId(*id)))
                        .unwrap();
                    room.seats.push(seat(id, format!("Bot {id}"), id, true));
                }
                SignalCommand::RemoveBot { player } => {
                    if room.locked || !room.game_id.entry().bots {
                        return Err("Room is locked.".into());
                    }
                    let index = room
                        .seats
                        .iter()
                        .position(|s| s.member.id == player && s.member.bot)
                        .ok_or("Only bots may be removed.")?;
                    room.seats.remove(index);
                }
                SignalCommand::Start => {
                    if room.active
                        || room
                            .seats
                            .iter()
                            .filter(|s| !s.member.bot && s.member.connected)
                            .count()
                            < usize::from(room.game_id.entry().min_players)
                        || room.seats.iter().any(|s| {
                            !s.member.bot
                                && (!s.member.connected
                                    || (s.member.id != room.host_id
                                        && !room.ready.contains(&s.member.id)))
                        })
                    {
                        return Err(format!(
                            "Need at least {} connected humans with ready game connections and no active round.",
                            room.game_id.entry().min_players
                        ));
                    }
                    room.active = true;
                    room.locked = true;
                    room.round += 1;
                }
                _ => unreachable!(),
            }
            room.publish();
        }
        SignalCommand::Ping | SignalCommand::Ice => {}
    }
    Ok(())
}
async fn ice(app: &App) -> Result<serde_json::Value, String> {
    // Explicit operator attestation is required before any potentially billable TURN use.
    if std::env::var("TURN_ZERO_SPEND_VERIFIED").as_deref() == Ok("true") {
        let key = std::env::var("CLOUDFLARE_TURN_KEY_ID").map_err(|_| "TURN key is missing.")?;
        let token =
            std::env::var("CLOUDFLARE_TURN_API_TOKEN").map_err(|_| "TURN token is missing.")?;
        let endpoint = format!(
            "https://rtc.live.cloudflare.com/v1/turn/keys/{key}/credentials/generate-ice-servers"
        );
        let value: serde_json::Value = app
            .http
            .post(endpoint)
            .bearer_auth(token)
            .json(&serde_json::json!({"ttl":600}))
            .send()
            .await
            .map_err(|_| "TURN provider unavailable.")?
            .error_for_status()
            .map_err(|_| "TURN provider rejected credentials.")?
            .json()
            .await
            .map_err(|_| "Invalid TURN provider response.")?;
        return value
            .get("iceServers")
            .cloned()
            .ok_or("Missing TURN servers.".into());
    }
    // Development-only local relay, never a fallback production transport.
    if std::env::var("LOCAL_TURN_TEST").as_deref() == Ok("true") {
        return serde_json::from_str(
            &std::env::var("LOCAL_ICE_SERVERS").map_err(|_| "Missing test ICE servers.")?,
        )
        .map_err(|_| "Invalid test ICE configuration.".into());
    }
    Ok(serde_json::json!([{"urls":["stun:stun.cloudflare.com:3478"]}]))
}
async fn upgrade(
    State(app): State<App>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    ws: WebSocketUpgrade,
) -> Response {
    let origin = headers
        .get("origin")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let host = headers
        .get("host")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let expected = std::env::var("APP_ORIGIN").ok();
    if !expected.as_deref().map_or_else(
        || origin == format!("http://{host}") || origin == format!("https://{host}"),
        |e| origin == e,
    ) {
        return StatusCode::FORBIDDEN.into_response();
    }
    let mut rates = app.rates.lock().await;
    rates.retain(|_, (t, _)| t.elapsed() < Duration::from_secs(60));
    if rates.len() > MAX_TRACKED_IPS {
        return StatusCode::TOO_MANY_REQUESTS.into_response();
    }
    let entry = rates.entry(addr.ip()).or_insert((Instant::now(), 0));
    entry.1 += 1;
    if entry.1 > UPGRADES_PER_MINUTE {
        return StatusCode::TOO_MANY_REQUESTS.into_response();
    }
    drop(rates);
    let Ok(permit) = app.connections.clone().try_acquire_owned() else {
        return StatusCode::SERVICE_UNAVAILABLE.into_response();
    };
    ws.max_message_size(MAX_MESSAGE)
        .max_frame_size(MAX_MESSAGE)
        .on_upgrade(move |socket| async move {
            let _permit = permit;
            session(socket, app).await
        })
}
async fn send(socket: &mut WebSocket, event: &SignalEvent) -> bool {
    socket
        .send(Message::Text(serde_json::to_string(event).unwrap().into()))
        .await
        .is_ok()
}
async fn session(mut socket: WebSocket, app: App) {
    let Ok(Some(Ok(Message::Text(text)))) =
        tokio::time::timeout(HANDSHAKE_TIMEOUT, socket.recv()).await
    else {
        return;
    };
    let Ok(hello) = serde_json::from_str::<Hello>(&text) else {
        send(
            &mut socket,
            &SignalEvent::Error {
                message: "Invalid handshake.".into(),
            },
        )
        .await;
        return;
    };
    let (tx, mut rx) = mpsc::channel(SIGNAL_QUEUE_CAPACITY);
    let admission = admit(&mut *app.rooms.lock().await, hello, tx.clone());
    let (invite, id, generation, welcome) = match admission {
        Ok(a) => a,
        Err(message) => {
            send(&mut socket, &SignalEvent::Error { message }).await;
            return;
        }
    };
    let _ = send(&mut socket, &welcome).await;
    if let Some(room) = app.rooms.lock().await.get(&invite) {
        room.publish();
    }
    let mut heartbeat = tokio::time::interval(Duration::from_secs(1));
    let mut last_message = Instant::now();
    let mut rate = (Instant::now(), 0u32);
    let mut last_ice = None::<Instant>;
    loop {
        tokio::select! {
            event = rx.recv() => {
                let Some(event) = event else { break; };
                let ended = matches!(event, SignalEvent::Ended { .. });
                if !send(&mut socket, &event).await || ended { break; }
            }
            _ = heartbeat.tick() => {
                let mut rooms = app.rooms.lock().await;
                let Some(room) = rooms.get_mut(&invite) else { break; };
                room.expire_handoff();
                if room.expired() {
                    drop(rooms);
                    send(&mut socket, &SignalEvent::Ended {
                        message: format!("Room expired or host did not return within {} seconds.", table_protocol::HOST_WAIT_MS / 1000),
                    }).await;
                    break;
                }
                if last_message.elapsed() > SOCKET_IDLE_TIMEOUT { break; }
            }
            message = socket.recv() => {
                let Some(Ok(Message::Text(text))) = message else { break; };
                last_message = Instant::now();
                if rate.0.elapsed() >= Duration::from_secs(1) { rate = (Instant::now(), 0); }
                rate.1 += 1;
                if rate.1 > MESSAGES_PER_SECOND { break; }
                let cmd = match serde_json::from_str::<SignalCommand>(&text) {
                    Ok(cmd) => cmd,
                    Err(_) => {
                        let _ = tx.try_send(SignalEvent::Error { message: "Invalid signaling message.".into() });
                        continue;
                    }
                };
                let mut rooms = app.rooms.lock().await;
                let Some(room) = rooms.get_mut(&invite) else { break; };
                if room.expired() || !room.seats.iter().any(|s| s.member.id == id && s.generation == generation) { break; }
                if matches!(cmd, SignalCommand::Ice) {
                    // Provider requests must not hold the room mutex across network I/O.
                    drop(rooms);
                    if last_ice.is_some_and(|t| t.elapsed() < ICE_REQUEST_INTERVAL) { continue; }
                    last_ice = Some(Instant::now());
                    let event = match ice(&app).await {
                        Ok(ice_servers) => SignalEvent::Ice { ice_servers },
                        Err(message) => SignalEvent::Error { message },
                    };
                    let _ = tx.try_send(event);
                    continue;
                }
                if matches!(cmd, SignalCommand::Ping) {
                    let _ = tx.try_send(SignalEvent::Pong);
                    continue;
                }
                if let Err(message) = command(room, id, cmd) { let _ = tx.try_send(SignalEvent::Error { message }); }
            }
        }
    }
    if let Some(room) = app.rooms.lock().await.get_mut(&invite)
        && let Some(s) = room
            .seats
            .iter_mut()
            .find(|s| s.member.id == id && s.generation == generation)
    {
        room.ready.remove(&id);
        s.socket = None;
        s.member.connected = false;
        if id == room.host_id {
            room.ready.clear();
            room.host_lost = Some(Instant::now());
        }
        room.cancel_handoff("A player disconnected. You are still in the room; retry Leave room.");
        room.publish();
    }
}
#[tokio::main]
async fn main() {
    let app = App {
        rooms: Arc::default(),
        connections: Arc::new(Semaphore::new(MAX_SOCKETS)),
        rates: Arc::default(),
        http: reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .unwrap(),
    };
    let cleanup = app.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(30));
        loop {
            interval.tick().await;
            cleanup.rooms.lock().await.retain(|_, room| {
                if room.expired() {
                    room.broadcast(SignalEvent::Ended {
                        message: "Room expired.".into(),
                    });
                    false
                } else {
                    true
                }
            });
        }
    });
    // Tests serve isolated fixture releases; deployments retain the existing web root.
    let web_root =
        std::path::PathBuf::from(std::env::var("WEB_ROOT").unwrap_or_else(|_| "web".into()));
    let router = Router::new()
        .route(
            "/catalog.json",
            get(|| async { axum::Json(game_catalog::CATALOG) }),
        )
        .route("/healthz", get(|| async { "ok" }))
        .route("/signal", get(upgrade))
        .nest_service(
            "/assets",
            tower::ServiceBuilder::new()
                .layer(SetResponseHeaderLayer::overriding(
                    axum::http::header::CACHE_CONTROL,
                    HeaderValue::from_static("public, max-age=31536000, immutable"),
                ))
                .service(ServeDir::new(web_root.join("assets"))),
        )
        .fallback_service(ServeDir::new(web_root))
        .layer(SetResponseHeaderLayer::if_not_present(
            axum::http::header::CACHE_CONTROL,
            HeaderValue::from_static("no-cache"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            axum::http::header::REFERRER_POLICY,
            HeaderValue::from_static("no-referrer"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            axum::http::header::X_CONTENT_TYPE_OPTIONS,
            HeaderValue::from_static("nosniff"),
        ))
        .with_state(app);
    let port = std::env::var("PORT").unwrap_or_else(|_| "8080".into());
    let bind = std::env::var("BIND_ADDR").unwrap_or_else(|_| "127.0.0.1".into());
    let listener = tokio::net::TcpListener::bind(format!("{bind}:{port}"))
        .await
        .unwrap();
    println!("Game Table listening on {bind}:{port}");
    axum::serve(
        listener,
        router.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await
    .unwrap();
}
#[cfg(test)]
mod tests;
