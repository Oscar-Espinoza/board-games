use color_match::{Action, Card, Color, Direction, Face, Outcome, Phase, PlayerId, PublicEvent};
#[cfg(feature = "fixtures")]
use color_match_session::Authority;
use color_match_session::Snapshot;
use std::cell::RefCell;
use table_browser::dom::{attr, disabled, document, el, escape, hidden, text};
use table_protocol::{Ack, Member, RoomView, SignalEvent};
use wasm_bindgen::{JsCast, prelude::*};
use web_sys::{Element, HtmlElement, HtmlInputElement};
#[wasm_bindgen(raw_module = "./bridge.js")]
extern "C" {
    fn send_signal(value: &str);
    fn send_peer(player: u8, value: &str);
    fn connect_room(kind: &str, name: &str, avatar: u8);
    fn leave_room();
    fn home_navigation();
    fn before_render(events: &str, viewer: u8);
    fn after_render();
    fn cancel_motion();
    fn next_action_id() -> u64;
}
type Client = table_browser::RoomClient<color_match_session::ColorMatch>;
type Effect = table_browser::Effect<color_match_session::ColorMatch>;
struct App {
    client: Client,
    uno: bool,
}
impl std::ops::Deref for App {
    type Target = Client;
    fn deref(&self) -> &Client {
        &self.client
    }
}
impl std::ops::DerefMut for App {
    fn deref_mut(&mut self) -> &mut Client {
        &mut self.client
    }
}
thread_local! {
    static APP: RefCell<App> = const { RefCell::new(App { client: Client::new(),uno: false }) };
}

fn error(value: &str) {
    text("error", value);
    text("panel-error", value);
}
fn now() -> u64 {
    js_sys::Date::now() as u64
}

fn class(card: Card) -> &'static str {
    match card.color() {
        Some(Color::Red) => "red",
        Some(Color::Yellow) => "yellow",
        Some(Color::Green) => "green",
        Some(Color::Blue) => "blue",
        None => "wild",
    }
}
fn contents(card: Card) -> String {
    let symbol = match card.face {
        Face::Number { number, .. } => number.to_string(),
        Face::Skip { .. } => "⊘".into(),
        Face::Reverse { .. } => "⇄".into(),
        Face::DrawTwo { .. } => "+2".into(),
        Face::Wild => "✦".into(),
        Face::WildFour => "+4".into(),
    };
    format!(
        "<span class='card-label'>{}</span><span class='card-symbol' aria-hidden='true'>{symbol}</span><span class='card-footer' aria-hidden='true'>COLOR MATCH</span>",
        card.label()
    )
}
const AVATARS: [&str; 8] = ["🦊", "🐻", "🐸", "🐙", "🐱", "🐼", "🦉", "🐯"];
fn seat_html(member: &Member, count: usize, active: bool, temporary: bool) -> String {
    format!(
        "<span class='avatar'>{}</span><strong>{}</strong><span class='seat-count'>{count} cards</span><span class='connection'>{}</span><div class='fan' aria-hidden='true'>{}</div>{}",
        AVATARS[usize::from(member.avatar.min(7))],
        escape(&member.name),
        if temporary {
            "Temporary bot"
        } else if member.bot {
            "Bot"
        } else if member.connected {
            "Connected"
        } else {
            "Disconnected"
        },
        (0..count.min(7))
            .map(|i| format!("<i style='--i:{i}'></i>"))
            .collect::<String>(),
        if active {
            "<span class='turn-dot' aria-label='Active player'></span>"
        } else {
            ""
        }
    )
}
fn set_html_if_changed(element: &Element, html: &str) {
    if element.inner_html() != html {
        element.set_inner_html(html);
    }
}
fn render(snapshot: &Snapshot, uno: bool) -> Result<(), JsValue> {
    let view = &snapshot.view;
    let focused = document()
        .active_element()
        .map(|e| e.id())
        .unwrap_or_default();
    hidden("welcome", true);
    hidden("board", false);
    let name = |p: PlayerId| {
        snapshot
            .members
            .iter()
            .find(|m| m.id == p)
            .map(|m| m.name.as_str())
            .unwrap_or("Player")
    };
    let status = if snapshot.ended {
        "Session ended — the host did not return.".into()
    } else if snapshot.paused {
        "Table paused — waiting for reconnection.".into()
    } else {
        match view.phase {
            Phase::Turn { player } if player == view.player => {
                if let Some(p) = view.penalty {
                    format!("Your turn · stack or draw {}", p.amount)
                } else {
                    "Your turn · match a card or draw".into()
                }
            }
            Phase::Turn { player } => format!("{}’s turn", name(player)),
            Phase::ChoosingColor { player } if player == view.player => {
                "Choose a color for your Wild".into()
            }
            Phase::ChoosingColor { player } => format!("{} is choosing a color", name(player)),
            Phase::Finished {
                outcome: Outcome::Win { player },
            } => {
                if player == view.player {
                    "You win!".into()
                } else {
                    format!("{} wins!", name(player))
                }
            }
            Phase::Finished {
                outcome: Outcome::Draw,
            } => "A draw — the stock is exhausted".into(),
        }
    };
    text("status", &status);
    attr("board", "data-revision", &view.revision.to_string());
    attr("board", "data-round", &snapshot.round.to_string());
    attr("board", "data-player", &view.player.0.to_string());
    let viewer = snapshot
        .members
        .iter()
        .position(|m| m.id == view.player)
        .unwrap();
    let n = snapshot.members.len();
    for id in 0..8 {
        let seat = el(&format!("seat-{id}"));
        let member = snapshot.members.iter().find(|m| m.id == PlayerId(id));
        if let Some(member) = member.filter(|m| m.id != view.player) {
            seat.remove_attribute("hidden")?;
            let index = snapshot
                .members
                .iter()
                .position(|m| m.id == member.id)
                .unwrap();
            let relative = (index + n - viewer) % n;
            // Clockwise around left, top, right, with the viewer always at the bottom.
            let fraction = relative as f64 / n as f64;
            let (x, y) = if fraction < 0.33 {
                (10.0, 66.0 - fraction / 0.33 * 47.0)
            } else if fraction <= 0.67 {
                (10.0 + (fraction - 0.33) / 0.34 * 80.0, 19.0)
            } else {
                (90.0, 19.0 + (fraction - 0.67) / 0.33 * 47.0)
            };
            seat.set_attribute("style", &format!("--x:{x}%;--y:{y}%"))?;
            let active = view.phase.actor() == Some(member.id);
            seat.set_attribute("class", if active { "seat active" } else { "seat" })?;
            let count = view
                .players
                .iter()
                .find(|p| p.player == member.id)
                .unwrap()
                .count;
            set_html_if_changed(
                &seat,
                &seat_html(
                    member,
                    count,
                    active,
                    snapshot.temporary_bots.contains(&member.id),
                ),
            );
        } else {
            seat.set_attribute("hidden", "")?;
        }
    }
    let discard = el("discard");
    discard.set_attribute("class", &format!("card {}", class(view.top)))?;
    discard.set_attribute("data-card", &view.top.id.to_string())?;
    set_html_if_changed(&discard, &contents(view.top));
    text("active-color", view.active_color.label());
    attr("active-color", "data-color", view.active_color.label());
    text(
        "direction",
        if view.direction == Direction::Clockwise {
            "↻ Clockwise"
        } else {
            "↺ Counterclockwise"
        },
    );
    text(
        "penalty",
        &view
            .penalty
            .map_or_else(String::new, |p| format!("+{} pending", p.amount)),
    );
    text("stock-count", &view.stock_count.to_string());
    let draw_label = view
        .penalty
        .map_or_else(|| "Draw one".into(), |p| format!("Draw {}", p.amount));
    text("draw-label", &draw_label);
    attr("draw", "aria-label", &draw_label);
    disabled(
        "draw",
        snapshot.paused || !view.legal_actions.contains(&Action::Draw {}),
    );
    text("hand-count", &view.hand.len().to_string());
    text("you-name", name(view.player));
    attr(
        "hand-section",
        "class",
        if view.phase.actor() == Some(view.player) {
            "hand-section active"
        } else {
            "hand-section"
        },
    );
    let hand = el("hand");
    // Preserve card buttons and focus across snapshots; remove only cards no longer held.
    let children = hand.query_selector_all("button")?;
    for i in 0..children.length() {
        if let Some(node) = children.item(i) {
            let card = node.dyn_into::<Element>()?;
            let id = card
                .get_attribute("data-card")
                .and_then(|s| s.parse::<u8>().ok());
            if !view.hand.iter().any(|c| Some(c.id) == id) {
                card.remove();
            }
        }
    }
    for (position, card) in view.hand.iter().enumerate() {
        let id = format!("card-{}", card.id);
        let button = if let Some(button) = document().get_element_by_id(&id) {
            button
        } else {
            let b = document().create_element("button")?;
            b.set_id(&id);
            b.set_attribute("data-action", "play")?;
            b.set_attribute("data-card", &card.id.to_string())?;
            b.set_attribute("class", &format!("card {}", class(*card)))?;
            b.set_attribute("aria-label", &format!("Play {}", card.label()))?;
            b.set_inner_html(&contents(*card));
            hand.append_child(&b)?;
            b
        };
        button.set_attribute("style", &format!("order:{position}"))?;
        let legal = view.legal_actions.contains(&Action::Play {
            card_id: card.id,
            uno: false,
        }) && !snapshot.paused;
        button.set_attribute("aria-disabled", if legal { "false" } else { "true" })?;
    }
    disabled(
        "uno",
        snapshot.paused
            || view.hand.len() != 2
            || view.phase
                != Phase::Turn {
                    player: view.player,
                },
    );
    attr("uno", "aria-pressed", if uno { "true" } else { "false" });
    text("uno", if uno { "UNO armed ✓" } else { "UNO!" });
    let catch = view.legal_actions.iter().find_map(|a| {
        if let Action::CatchUno { player } = a {
            Some(*player)
        } else {
            None
        }
    });
    hidden("catch", catch.is_none());
    disabled("catch", snapshot.paused);
    if let Some(p) = catch {
        text("catch", &format!("Catch {} · missed UNO", name(p)));
        attr("catch", "data-player", &p.0.to_string());
    }
    let choose = view.phase
        == Phase::ChoosingColor {
            player: view.player,
        };
    hidden("color-choices", !choose);
    for color in Color::ALL {
        disabled(&format!("choose-{}", color.label()), snapshot.paused);
    }
    let replace = snapshot
        .can_replace
        .iter()
        .map(|p| {
            format!(
                "<button data-action='replace' data-player='{}'>Fill with bot · {}</button>",
                p.0,
                escape(name(*p))
            )
        })
        .collect::<String>();
    let replace = if replace.is_empty() {
        replace
    } else {
        format!("<button data-action='wait'>Wait</button>{replace}")
    };
    set_html_if_changed(&el("replace-controls"), &replace);
    hidden("replace-controls", view.player != snapshot.host_id);
    if focused.starts_with("card-") && document().get_element_by_id(&focused).is_none()
        || focused.starts_with("choose-") && !choose
    {
        let target = if choose {
            el("choose-Red")
        } else {
            hand.query_selector("[aria-disabled='false']")?
                .unwrap_or_else(|| el("status"))
        };
        target.dyn_into::<HtmlElement>()?.focus()?;
    } else if choose && !focused.starts_with("choose-") {
        el("choose-Red").dyn_into::<HtmlElement>()?.focus()?;
    }
    Ok(())
}
fn lobby(room: &RoomView, player: PlayerId) -> Result<(), JsValue> {
    text("welcome-action", "Room controls");
    text(
        "room-count",
        &format!("{} / {} seats", room.members.len(), room.capacity),
    );
    let html=room.members.iter().map(|m|format!("<li><span>{} {}</span><span>{}</span>{}</li>",
        AVATARS[usize::from(m.avatar.min(7))],
        escape(&m.name),
        if m.bot {"Bot"}else if m.connected {"Connected"}else{"Disconnected"},
        if player==room.host_id&&m.bot&&!room.locked {format!("<button data-action='remove-bot' data-player='{}' aria-label='Remove {}'>Remove</button>",
        m.id.0,
        escape(&m.name))}else{String::new()})).collect::<String>();

    set_html_if_changed(&el("roster"), &html);
    hidden("host-controls", player != room.host_id);
    disabled(
        "add-bot",
        room.locked || room.members.len() >= usize::from(room.capacity),
    );
    el("room-size")
        .dyn_into::<web_sys::HtmlSelectElement>()?
        .set_value(&room.capacity.to_string());
    disabled("room-size", room.locked || player != room.host_id);
    for capacity in 2..=8 {
        if let Some(option) =
            el("room-size").query_selector(&format!("option[value='{capacity}']"))?
        {
            if capacity < room.members.len() {
                option.set_attribute("disabled", "")?;
            } else {
                option.remove_attribute("disabled")?;
            }
        }
    }
    text("mode", "Private room");
    el("invite")
        .dyn_into::<HtmlInputElement>()?
        .set_value(&format!(
            "{}{}#room={}",
            web_sys::window().unwrap().location().origin()?,
            web_sys::window().unwrap().location().pathname()?,
            room.invite
        ));
    if !room.locked {
        hidden("board", true);
        hidden("welcome", false);
        text("status", "Invite friends, add bots, then start the round.");
    }
    Ok(())
}
fn update_start() {
    APP.with(|cell| {
        let app = cell.borrow();
        if let Some(room) = &app.room {
            let ready = room.members.iter().all(|m| {
                m.bot || (m.connected && (m.id == app.player || app.peers.contains(&m.id)))
            });
            disabled(
                "start-round",
                room.members
                    .iter()
                    .filter(|m| !m.bot && m.connected)
                    .count()
                    < 2
                    || !ready
                    || app.authority.as_ref().is_some_and(|a| !a.finished())
                    || !app.network
                    || app.transfer.is_some(),
            );
            text(
                "start-round",
                if room.locked {
                    "Rematch"
                } else {
                    "Start round"
                },
            );
        }
    });
}
fn seed() -> Result<[u8; 32], JsValue> {
    let mut seed = [0; 32];
    web_sys::window()
        .unwrap()
        .crypto()?
        .get_random_values_with_u8_array(&mut seed)?;
    Ok(seed)
}

#[wasm_bindgen]
pub fn go_home() {
    leave_room();
    cancel_motion();
    APP.with(|c| {
        let mut a = c.borrow_mut();
        a.authority = None;
        a.view = None;
        a.room = None;
        a.staged = None;
        a.transfer = None;
        a.checkpoint = None;
        a.peers.clear();
        a.uno = false;
        a.network = false;
    });
    hidden("welcome", false);
    hidden("board", true);
    for key in ["data-player", "data-revision", "data-round"] {
        let _ = el("board").remove_attribute(key);
    }
    hidden("room-details", true);
    hidden("identity", false);
    hidden("leave-room", true);
    hidden("join-room", true);
    hidden("create-room", false);
    el("hand").set_inner_html("");
    el("roster").set_inner_html("");
    el("invite")
        .dyn_into::<HtmlInputElement>()
        .unwrap()
        .set_value("");
    text("copy-invite", "Copy");
    el("replace-controls").set_inner_html("");
    text("welcome-action", "Create room");
    text("mode", "Private tables");
    text("status", "Create a room and invite a friend.");
    error("");
    home_navigation();
}
type GameEvent = PublicEvent;
fn presentation_flag(app: &App) -> bool {
    app.uno
}

fn reset_transient(app: &mut App) {
    app.uno = false;
}

fn execute(effects: Vec<Effect>) -> Result<(), JsValue> {
    for effect in effects {
        match effect {
            Effect::Signal(command) => {
                send_signal(&serde_json::to_string(&command).unwrap());
            }
            Effect::Peer(player, value) => send_peer(player.0, &value),
            Effect::Render {
                snapshot,
                animate,
                resync,
            } => {
                if resync {
                    cancel_motion();
                } else {
                    before_render(
                        &serde_json::to_string(&snapshot.events).unwrap(),
                        snapshot.view.player.0,
                    );
                }
                render(&snapshot, animate)?;
                after_render();
            }
            Effect::Lobby(room, player) => lobby(&room, player)?,
            Effect::Welcome => {
                hidden("room-details", false);
                hidden("identity", true);
                hidden("leave-room", false);
            }
            Effect::Home => go_home(),
            Effect::Error(message) => error(&message),
            Effect::ResetTransient => APP.with(|c| reset_transient(&mut c.borrow_mut())),
            Effect::CancelMotion => cancel_motion(),
            Effect::UpdateStart => update_start(),
        }
    }
    Ok(())
}
fn transition(run: impl FnOnce(&mut Client) -> Result<Vec<Effect>, String>) -> Result<(), JsValue> {
    let effects = APP
        .with(|c| run(&mut c.borrow_mut().client))
        .map_err(|e| JsValue::from_str(&e))?;
    execute(effects)
}
fn publish(events: Vec<GameEvent>, ack: Option<(PlayerId, Ack)>) -> Result<(), JsValue> {
    let animate = APP.with(|c| presentation_flag(&c.borrow()));
    transition(|client| client.publish(now(), events, ack, animate))
}
#[wasm_bindgen]
pub fn signal_event(json: &str) -> Result<(), JsValue> {
    let event: SignalEvent =
        serde_json::from_str(json).map_err(|_| JsValue::from_str("Invalid signaling event"))?;
    let seed = if APP.with(|c| c.borrow().needs_seed(&event)) {
        Some(seed()?)
    } else {
        None
    };
    transition(|client| client.signal_event(event, now(), seed))
}
#[wasm_bindgen]
pub fn peer_state(player: u8, connected: bool) -> Result<(), JsValue> {
    transition(|client| client.peer_state(PlayerId(player), connected, now()))
}
#[wasm_bindgen]
pub fn network_state(connected: bool) {
    if let Err(e) = transition(|client| Ok(client.network_state(connected, now()))) {
        error(&format!("{e:?}"));
    }
}
#[wasm_bindgen]
pub fn end_session(message: &str) {
    if let Err(e) = transition(|client| Ok(client.end_session(message.into()))) {
        error(&format!("{e:?}"));
    }
}
#[wasm_bindgen]
pub fn peer_message(sender: u8, json: &str) -> Result<(), JsValue> {
    transition(|client| client.peer_message(PlayerId(sender), json, now()))
}
fn submit(action: Action) -> Result<(), JsValue> {
    let action_id = next_action_id();
    transition(|client| client.submit(action, action_id, now()))
}

fn click(event: web_sys::Event) -> Result<(), JsValue> {
    let Some(target) = event.target().and_then(|t| t.dyn_into::<Element>().ok()) else {
        return Ok(());
    };
    let Some(button) = target.closest("button")? else {
        return Ok(());
    };
    let player = || {
        button
            .get_attribute("data-player")
            .and_then(|s| s.parse().ok())
            .map(PlayerId)
            .ok_or_else(|| JsValue::from_str("Missing player"))
    };
    match button.get_attribute("data-action").as_deref() {
        #[cfg(feature = "fixtures")]
        Some("fixture") => {
            fixture_start(false)?;
            el("room-panel")
                .dyn_into::<web_sys::HtmlDialogElement>()?
                .close();
        }
        Some("back") => go_home(),
        Some("leave") => {
            let request = APP.with(|c| {
                let a = c.borrow(); let r = a.room.as_ref()?;
                if a.player == r.host_id && r.locked
                    && let Some(next) = r.members.iter().find(|m| !m.bot && m.id != a.player && m.connected && a.peers.contains(&m.id)) {
                        return Some(serde_json::json!({"type":"handoff_prepare","successor":next.id,"round":r.round,"epoch":r.epoch}).to_string());
                    }
                Some("{\"type\":\"leave\"}".into())
            });
            if let Some(request) = request {
                send_signal(&request);
            }
        }
        Some("wait") => {
            text("error", "Waiting for your friend to return.");
        }

        Some("create" | "join") => {
            let kind = button.get_attribute("data-action").unwrap();
            let name = el("name").dyn_into::<HtmlInputElement>()?.value();
            let avatar = el("avatar")
                .dyn_into::<web_sys::HtmlSelectElement>()?
                .value()
                .parse()
                .unwrap_or(0);
            connect_room(&kind, &name, avatar);
        }
        Some("add-bot") => send_signal("{\"type\":\"add_bot\"}"),
        Some("remove-bot") => send_signal(&format!(
            "{{\"type\":\"remove_bot\",\"player\":{}}}",
            player()?.0
        )),
        Some("start") => send_signal("{\"type\":\"start\"}"),
        Some("replace") => {
            let player = player()?;
            APP.with(|cell| {
                cell.borrow_mut()
                    .authority
                    .as_mut()
                    .ok_or_else(|| JsValue::from_str("Host only"))?
                    .replace(player, now())
                    .map_err(|e| JsValue::from_str(&e))
            })?;
            publish(vec![], None)?;
        }
        Some("uno") => {
            let (snapshot, uno) = APP.with(|cell| {
                let mut app = cell.borrow_mut();
                app.uno = !app.uno;
                (app.view.clone(), app.uno)
            });
            if let Some(snapshot) = snapshot {
                render(&snapshot, uno)?;
            }
        }
        Some("draw") => submit(Action::Draw {})?,
        Some("catch") => submit(Action::CatchUno { player: player()? })?,
        Some("play") => {
            let card_id = button
                .get_attribute("data-card")
                .and_then(|s| s.parse().ok())
                .ok_or_else(|| JsValue::from_str("Missing card"))?;
            let uno = APP.with(|cell| cell.borrow().uno);
            submit(Action::Play { card_id, uno })?;
        }
        Some("color") => {
            let color = Color::ALL
                .into_iter()
                .find(|c| Some(c.label()) == button.get_attribute("data-color").as_deref())
                .unwrap();
            submit(Action::ChooseColor { color })?;
        }
        _ => {}
    }
    Ok(())
}
#[wasm_bindgen(start)]
pub fn start() -> Result<(), JsValue> {
    table_browser::dom::validate_required(&[
        "active-color",
        "app",
        "avatar",
        "board",
        "catch",
        "choose-Red",
        "color-choices",
        "copy-invite",
        "create-room",
        "discard",
        "draw",
        "draw-label",
        "error",
        "hand",
        "hand-count",
        "host-controls",
        "identity",
        "invite",
        "join-room",
        "leave-room",
        "mode",
        "name",
        "panel-error",
        "replace-controls",
        "room-details",
        "room-panel",
        "room-size",
        "roster",
        "status",
        "stock-count",
        "uno",
        "welcome",
        "welcome-action",
        "you-name",
    ])?;
    hidden("welcome", false);
    hidden("board", true);
    text("status", "Create a room and invite a friend.");
    let handler = Closure::<dyn FnMut(web_sys::Event)>::new(|e| {
        if let Err(e) = click(e) {
            error(
                &e.as_string()
                    .unwrap_or_else(|| "The action could not complete.".into()),
            );
        }
    });
    el("app").add_event_listener_with_callback("click", handler.as_ref().unchecked_ref())?;
    handler.forget();
    let tick = Closure::<dyn FnMut()>::new(|| {
        let result = APP.with(|cell| {
            let mut a = cell.borrow_mut();
            let player = a.player;
            let previous = a.view.clone();
            let authority = a.authority.as_mut()?;
            authority.tick(now());
            let events = authority.step_bot();
            let next = authority.snapshot(player, now(), vec![], None).ok()?;
            let changed = previous.is_none_or(|p| {
                p.paused != next.paused
                    || p.ended != next.ended
                    || p.can_replace != next.can_replace
            });
            (!events.is_empty() || changed).then_some(events)
        });
        if let Some(events) = result {
            let _ = publish(events, None);
        }
    });
    web_sys::window()
        .unwrap()
        .set_interval_with_callback_and_timeout_and_arguments_0(
            tick.as_ref().unchecked_ref(),
            350,
        )?;
    tick.forget();
    #[cfg(feature = "fixtures")]
    install_fixture_controls()?;
    attr("app", "data-ready", "true");
    Ok(())
}

#[cfg(feature = "fixtures")]
fn fixture_seed(fresh: bool) -> Result<[u8; 32], JsValue> {
    let input = el("seed").dyn_into::<HtmlInputElement>()?;
    let mut seed = [0; 32];
    if fresh {
        web_sys::window()
            .unwrap()
            .crypto()?
            .get_random_values_with_u8_array(&mut seed)?;
    } else {
        let value = input.value();
        if value.len() != 64 || !value.bytes().all(|b| b.is_ascii_hexdigit()) {
            return Err(JsValue::from_str(
                "Enter exactly 64 hexadecimal characters (0–9, a–f).",
            ));
        }
        for (i, byte) in seed.iter_mut().enumerate() {
            *byte = u8::from_str_radix(&value[i * 2..i * 2 + 2], 16).unwrap();
        }
    }
    input.set_value(&seed.iter().map(|b| format!("{b:02x}")).collect::<String>());
    Ok(seed)
}
#[cfg(feature = "fixtures")]
#[wasm_bindgen]
pub fn fixture_start(fresh: bool) -> Result<(), JsValue> {
    let seed = fixture_seed(fresh)?;
    leave_room();
    cancel_motion();
    let count = el("solo-count")
        .dyn_into::<web_sys::HtmlSelectElement>()?
        .value()
        .parse::<u8>()
        .unwrap_or(2)
        .clamp(2, 8);
    let members = (0..count)
        .map(|id| Member {
            id: PlayerId(id),
            name: if id == 0 {
                "You".into()
            } else {
                format!("Bot {id}")
            },
            avatar: id,
            bot: id != 0,
            connected: true,
        })
        .collect();
    APP.with(|cell| {
        let mut app = cell.borrow_mut();
        app.room = None;
        app.player = PlayerId(0);
        app.authority = Some(
            configured_authority(
                seed,
                app.authority.as_ref().map_or(1, |a| a.round() + 1),
                members,
            )
            .unwrap(),
        );
        app.uno = false;
        app.peers.clear();
        app.network = true;
    });
    hidden("seed-tools", false);
    hidden("room-details", true);
    hidden("identity", false);
    text("mode", "Solo table");
    error("");
    publish(vec![], None)
}

#[cfg(feature = "fixtures")]
fn install_fixture_controls() -> Result<(), JsValue> {
    let fixture = document().create_element("div")?;
    fixture.set_id("fixture-controls");
    let options = (2..=8)
        .map(|n| format!("<option value='{n}'>{n}</option>"))
        .collect::<String>();
    fixture.set_inner_html(&format!("<select id='solo-count'>{options}</select><details id='seed-tools'><summary>Fixture seed</summary><input id='seed'><button id='restart' data-action='fixture'>Restart fixture</button></details>"));

    el("room-panel").append_child(&fixture)?;
    Ok(())
}

#[cfg(feature = "fixtures")]
fn configured_authority(
    seed: [u8; 32],
    round: u64,
    members: Vec<table_protocol::Member>,
) -> Result<Authority, String> {
    let players = members.iter().map(|m| m.id).collect();
    let game = color_match_session::ColorMatch(
        color_match::Game::new(seed, color_match::GameConfig { players })
            .map_err(|e| e.to_string())?,
    );
    Authority::with_game(game, round, members)
}
