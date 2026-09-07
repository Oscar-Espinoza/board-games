//! Deterministic browser room lifecycle. No browser calls occur during transitions.
//! Bindings supply concrete authority construction and projected metadata; callers
//! execute the returned effects only after releasing their application-state borrow.
use serde::{Serialize, de::DeserializeOwned};
use std::collections::BTreeSet;
use table_protocol::*;
use table_session::{Authority, GameAdapter};

pub trait Binding: GameAdapter {
    fn authority(seed: [u8; 32], room: &RoomView) -> Result<Authority<Self>, String>;
    fn viewer(view: &Self::View) -> PlayerId;
    fn view_revision(view: &Self::View) -> u64;
    fn view_finished(view: &Self::View) -> bool;
}
pub type ViewSnapshot<B> = Snapshot<<B as GameAdapter>::View, <B as GameAdapter>::Event>;

pub enum Effect<B: Binding> {
    Signal(SignalCommand),
    Peer(PlayerId, String),
    Render {
        snapshot: ViewSnapshot<B>,
        animate: bool,
        resync: bool,
    },
    Lobby(RoomView, PlayerId),
    Welcome,
    Home,
    Error(String),
    ResetTransient,
    CancelMotion,
    UpdateStart,
}

/// Transfer numbers are monotonically increasing within a room. Keep the high
/// water mark after cancellation so delayed checkpoints cannot stage a retry.
pub struct RoomClient<B: Binding> {
    pub authority: Option<Authority<B>>,
    pub staged: Option<Authority<B>>,
    pub transfer: Option<(PlayerId, u64, u64, u64)>,
    pub checkpoint: Option<(u64, String)>,
    pub view: Option<ViewSnapshot<B>>,
    pub room: Option<RoomView>,
    pub player: PlayerId,
    pub peers: BTreeSet<PlayerId>,
    pub network: bool,
    last_transfer: u64,
}
impl<B: Binding> Default for RoomClient<B> {
    fn default() -> Self {
        Self::new()
    }
}
impl<B: Binding> RoomClient<B> {
    pub const fn new() -> Self {
        Self {
            authority: None,
            staged: None,
            transfer: None,
            checkpoint: None,
            view: None,
            room: None,
            player: PlayerId(0),
            peers: BTreeSet::new(),
            network: true,
            last_transfer: 0,
        }
    }
    pub fn host_id(&self) -> PlayerId {
        self.room.as_ref().map_or(PlayerId(0), |r| r.host_id)
    }
    pub fn needs_seed(&self, event: &SignalEvent) -> bool {
        let room = match event {
            SignalEvent::Room { room } | SignalEvent::Welcome { room, .. } => room,
            _ => return false,
        };
        self.player == room.host_id
            && room.locked
            && self.room.as_ref().is_some_and(|r| r.round < room.round)
            && self
                .authority
                .as_ref()
                .is_none_or(|a| a.round() != room.round)
    }
}
impl<B> RoomClient<B>
where
    B: Binding,
    B::Action: Serialize + DeserializeOwned,
    B::View: Clone + Serialize + DeserializeOwned,
    B::Event: Clone + Serialize + DeserializeOwned,
{
    pub fn publish(
        &mut self,
        now: u64,
        events: Vec<B::Event>,
        ack: Option<(PlayerId, Ack)>,
        animate: bool,
    ) -> Result<Vec<Effect<B>>, String> {
        let authority = self.authority.as_ref().ok_or("No authority")?;
        let own_ack = ack
            .as_ref()
            .filter(|(p, _)| *p == self.player)
            .map(|(_, ack)| ack.clone());
        let snapshot = authority.snapshot(self.player, now, events.clone(), own_ack)?;
        let mut effects = vec![Effect::Render {
            snapshot: snapshot.clone(),
            animate,
            resync: false,
        }];
        if self.room.is_some() {
            for member in snapshot
                .members
                .iter()
                .filter(|m| !m.bot && m.id != self.player)
            {
                let ack = ack
                    .as_ref()
                    .filter(|(p, _)| *p == member.id)
                    .map(|(_, ack)| ack.clone());
                let other = authority.snapshot(member.id, now, events.clone(), ack)?;
                effects.push(Effect::Peer(member.id, json(&other)?));
            }
            if B::view_finished(&snapshot.view) {
                effects.push(Effect::Signal(SignalCommand::RoundFinished {
                    round: snapshot.round,
                    epoch: snapshot.epoch,
                }));
            }
        }
        self.view = Some(snapshot);
        effects.push(Effect::UpdateStart);
        Ok(effects)
    }
    fn stage_checkpoint(&mut self, now: u64) -> Vec<Effect<B>> {
        let Some((successor, round, epoch, transfer)) = self.transfer else {
            return vec![];
        };
        if successor != self.player {
            return vec![];
        }
        let Some((received, _)) = &self.checkpoint else {
            return vec![];
        };
        if *received != transfer {
            return vec![];
        }
        let (_, checkpoint) = self.checkpoint.take().unwrap();
        let Some(room) = &self.room else {
            return vec![];
        };
        match Authority::<B>::import_checkpoint(&checkpoint, room, now) {
            Ok(authority) => {
                self.staged = Some(authority);
                vec![Effect::Signal(SignalCommand::HandoffReady {
                    round,
                    epoch,
                    transfer,
                })]
            }
            Err(message) => vec![
                Effect::Error(message),
                Effect::Signal(SignalCommand::HandoffCancel {
                    round,
                    epoch,
                    transfer,
                }),
            ],
        }
    }
    fn clear_transfer(&mut self) {
        self.transfer = None;
        self.checkpoint = None;
        self.staged = None;
    }
    pub fn signal_event(
        &mut self,
        event: SignalEvent,
        now: u64,
        seed: Option<[u8; 32]>,
    ) -> Result<Vec<Effect<B>>, String> {
        let mut effects = vec![];
        let room = match event {
            SignalEvent::Welcome {
                version,
                player,
                room,
                ..
            } => {
                if version != PROTOCOL_VERSION {
                    return Err("Unsupported room protocol. Reload this page.".into());
                }
                if self.room.as_ref().is_none_or(|r| r.invite != room.invite) {
                    self.authority = None;
                    self.view = None;
                    self.clear_transfer();
                    self.last_transfer = 0;
                    self.peers.clear();
                    effects.extend([Effect::ResetTransient, Effect::CancelMotion]);
                }
                self.player = player;
                self.network = true;
                effects.push(Effect::Welcome);
                Some(room)
            }
            SignalEvent::Room { room } => Some(room),
            SignalEvent::Left => {
                effects.push(Effect::Home);
                None
            }
            SignalEvent::Departed { player } => {
                if let Some(authority) = &mut self.authority {
                    authority.depart(player, now);
                    effects.extend(self.publish(now, vec![], None, false)?);
                }
                None
            }
            SignalEvent::HandoffPrepare {
                transfer,
                host,
                successor,
                round,
                epoch,
            } => {
                if !self.room.as_ref().is_some_and(|r| {
                    r.host_id == host
                        && r.round == round
                        && r.epoch == epoch
                        && r.members
                            .iter()
                            .any(|m| m.id == successor && !m.bot && m.connected)
                }) || transfer <= self.last_transfer
                {
                    return Ok(effects);
                }
                self.last_transfer = transfer;
                self.transfer = Some((successor, round, epoch, transfer));
                self.staged = None;
                effects.extend([Effect::ResetTransient, Effect::CancelMotion]);
                if self.player == host
                    && let Some(authority) = &mut self.authority
                {
                    authority.freeze(true);
                    let checkpoint = authority.export_checkpoint(now);
                    effects.extend(self.publish(now, vec![], None, false)?);
                    match checkpoint {
                        Ok(checkpoint) => effects.push(Effect::Peer(successor, json(&serde_json::json!({"type":"checkpoint", "checkpoint":checkpoint, "transfer":transfer}))?)),
                        Err(message) => effects.extend([Effect::Error(message), Effect::Signal(SignalCommand::HandoffCancel { transfer, round, epoch })]),
                    }
                }
                effects.extend(self.stage_checkpoint(now));
                effects.push(Effect::UpdateStart);
                None
            }
            SignalEvent::HandoffReady {
                round,
                epoch,
                transfer,
            } => {
                if self.player == self.host_id()
                    && self
                        .transfer
                        .is_some_and(|(_, r, e, t)| (r, e, t) == (round, epoch, transfer))
                {
                    effects.push(Effect::Signal(SignalCommand::HandoffCommit {
                        transfer,
                        round,
                        epoch,
                    }));
                }
                None
            }
            SignalEvent::HandoffCancel { message } => {
                self.clear_transfer();
                effects.push(Effect::ResetTransient);
                if let Some(authority) = &mut self.authority {
                    authority.freeze(false);
                    effects.extend(self.publish(now, vec![], None, false)?);
                }
                effects.extend([Effect::Error(message), Effect::UpdateStart]);
                None
            }
            SignalEvent::HandoffCommit { room, former_host } => {
                if !self.room.as_ref().is_some_and(|r| {
                    r.invite == room.invite
                        && r.round == room.round
                        && r.host_id == former_host
                        && r.epoch.checked_add(1) == Some(room.epoch)
                }) {
                    return Ok(effects);
                }
                effects.extend([Effect::CancelMotion, Effect::ResetTransient]);
                if self.player == room.host_id {
                    self.authority = self.staged.take();
                    if let Some(authority) = &mut self.authority {
                        authority.set_authority(room.host_id, room.epoch);
                        authority.depart(former_host, now);
                    }
                } else {
                    self.authority = None;
                }
                self.clear_transfer();
                self.peers.clear();
                if let Some(view) = &mut self.view {
                    view.paused = true;
                    effects.push(Effect::Render {
                        snapshot: view.clone(),
                        animate: false,
                        resync: true,
                    });
                }
                Some(room)
            }
            SignalEvent::Error { message } => {
                effects.push(Effect::Error(message));
                None
            }
            SignalEvent::Ended { message } => {
                effects.extend(self.end_session(message));
                None
            }
            _ => None,
        };
        if let Some(room) = room {
            room.options.validate(B::GAME_ID)?;
            if room.game_id != B::GAME_ID || room.rules_version != B::GAME_ID.entry().rules_version
            {
                return Err("Room game or rules mismatch".into());
            }
            let new_round = self.player == room.host_id
                && room.locked
                && self.room.as_ref().is_some_and(|r| r.round < room.round)
                && self
                    .authority
                    .as_ref()
                    .is_none_or(|a| a.round() != room.round);
            let new_authority = if new_round {
                Some(B::authority(seed.ok_or("Missing round seed")?, &room)?)
            } else {
                None
            };
            // A reconnect may deliver the committed room after the commit event
            // was lost. Recover only the checkpoint staged for this promotion.
            if self.authority.is_none()
                && self.player == room.host_id
                && self.transfer.is_some_and(|(successor, round, epoch, _)| {
                    successor == self.player
                        && round == room.round
                        && epoch.checked_add(1) == Some(room.epoch)
                })
                && let Some(prior) = &self.room
                && prior.host_id != room.host_id
                && prior.round == room.round
                && prior.epoch.checked_add(1) == Some(room.epoch)
                && let Some(mut authority) = self.staged.take()
            {
                authority.set_authority(room.host_id, room.epoch);
                authority.depart(prior.host_id, now);
                self.authority = Some(authority);
                effects.extend([Effect::CancelMotion, Effect::ResetTransient]);
            }
            if self
                .room
                .as_ref()
                .is_some_and(|r| r.epoch != room.epoch || r.host_id != room.host_id)
            {
                self.peers.clear();
                self.clear_transfer();
            }
            if self.player != room.host_id {
                self.authority = None;
            }
            if let Some(mut authority) = new_authority {
                authority.set_authority(room.host_id, room.epoch);
                self.authority = Some(authority);
                effects.extend([Effect::CancelMotion, Effect::ResetTransient]);
            }
            if let Some(authority) = &mut self.authority {
                for member in room
                    .members
                    .iter()
                    .filter(|m| m.id != room.host_id && !m.bot)
                {
                    authority.connected(
                        member.id,
                        member.connected && self.peers.contains(&member.id),
                        now,
                    );
                }
            }
            self.room = Some(room.clone());
            effects.push(Effect::Lobby(room.clone(), self.player));
            if self.player == room.host_id && self.authority.is_some() {
                effects.extend(self.publish(now, vec![], None, false)?);
            } else if self.player != room.host_id && room.locked {
                effects.push(self.request_snapshot()?);
            }
            effects.push(Effect::UpdateStart);
        }
        Ok(effects)
    }
    fn request_snapshot(&self) -> Result<Effect<B>, String> {
        Ok(Effect::Peer(
            self.host_id(),
            json(&ControlEnvelope::Sync {
                version: PROTOCOL_VERSION,
            })?,
        ))
    }
    pub fn peer_state(
        &mut self,
        player: PlayerId,
        connected: bool,
        now: u64,
    ) -> Result<Vec<Effect<B>>, String> {
        let mut effects = vec![];
        if connected {
            self.peers.insert(player);
        } else {
            self.peers.remove(&player);
        }
        if let Some(authority) = &mut self.authority {
            authority.connected(player, connected, now);
        }
        let guest = self.room.as_ref().is_some_and(|r| self.player != r.host_id);
        if guest {
            self.network = connected;
        }
        if self
            .room
            .as_ref()
            .is_some_and(|r| self.player == r.host_id && r.members.iter().any(|m| m.id == player))
        {
            effects.push(Effect::Signal(SignalCommand::Ready {
                player,
                ready: connected,
            }));
        }
        if self.authority.is_some() {
            effects.extend(self.publish(now, vec![], None, false)?);
        } else if guest {
            if connected {
                effects.push(self.request_snapshot()?);
            } else {
                effects.extend(self.network_state(false, now));
            }
        }
        effects.push(Effect::UpdateStart);
        Ok(effects)
    }
    pub fn network_state(&mut self, connected: bool, now: u64) -> Vec<Effect<B>> {
        self.network = connected;
        if let Some(authority) = &mut self.authority {
            authority.host_connected(connected, now);
        }
        if connected {
            return vec![];
        }
        let mut effects = vec![Effect::ResetTransient, Effect::CancelMotion];
        if let Some(view) = &mut self.view {
            view.paused = true;
            effects.push(Effect::Render {
                snapshot: view.clone(),
                animate: false,
                resync: true,
            });
        }
        effects
    }
    pub fn end_session(&mut self, message: String) -> Vec<Effect<B>> {
        self.network = false;
        if let Some(authority) = &mut self.authority {
            authority.end();
        }
        let mut effects = vec![Effect::ResetTransient, Effect::CancelMotion];
        if let Some(view) = &mut self.view {
            view.ended = true;
            view.paused = true;
            effects.push(Effect::Render {
                snapshot: view.clone(),
                animate: false,
                resync: true,
            });
        }
        effects.push(Effect::Error(message));
        effects
    }
    /// Sender is authenticated by the transport, never read from the payload.
    pub fn peer_message(
        &mut self,
        sender: PlayerId,
        value: &str,
        now: u64,
    ) -> Result<Vec<Effect<B>>, String> {
        if value.len() > MAX_MESSAGE {
            return Err("Message too large".into());
        }
        let host = self.player == self.host_id();
        if !host && sender != self.host_id() {
            return Ok(vec![]);
        }
        if !host && let Ok(checkpoint) = serde_json::from_str::<CheckpointMessage>(value) {
            if checkpoint.kind == "checkpoint"
                && (checkpoint.transfer > self.last_transfer
                    || self
                        .transfer
                        .is_some_and(|(_, _, _, t)| t == checkpoint.transfer))
            {
                self.checkpoint = Some((checkpoint.transfer, checkpoint.checkpoint));
                return Ok(self.stage_checkpoint(now));
            }
            return Ok(vec![]);
        }
        if host {
            if let Ok(ControlEnvelope::Sync { version }) = serde_json::from_str(value) {
                if version == PROTOCOL_VERSION
                    && let Some(authority) = &self.authority
                    && let Ok(snapshot) = authority.snapshot(sender, now, vec![], None)
                {
                    return Ok(vec![Effect::Peer(sender, json(&snapshot)?)]);
                }
                return Ok(vec![]);
            }
            let envelope = serde_json::from_str(value).map_err(|_| "Invalid action envelope")?;
            if let Some(authority) = &mut self.authority {
                let (ack, events) = authority.accept(sender, envelope);
                return self.publish(now, events, Some((sender, ack)), false);
            }
            return Ok(vec![]);
        }
        let snapshot: ViewSnapshot<B> =
            serde_json::from_str(value).map_err(|_| "Invalid snapshot")?;
        if snapshot.version != PROTOCOL_VERSION
            || B::viewer(&snapshot.view) != self.player
            || !self.room.as_ref().is_some_and(|r| {
                r.round == snapshot.round
                    && r.epoch == snapshot.epoch
                    && r.host_id == snapshot.host_id
            })
            || !self.view.as_ref().is_none_or(|v| {
                snapshot.round > v.round
                    || B::view_revision(&snapshot.view) >= B::view_revision(&v.view)
            })
        {
            return Ok(vec![]);
        }
        let resync = !self.network
            || snapshot.events.is_empty()
            || self.view.as_ref().is_none_or(|v| {
                v.round != snapshot.round
                    || B::view_revision(&v.view).checked_add(1)
                        != Some(B::view_revision(&snapshot.view))
            });
        let mut effects = vec![];
        if let Some(ack) = &snapshot.ack {
            effects.push(Effect::Error(ack.message.clone().unwrap_or_else(|| {
                if ack.status == AckStatus::Stale {
                    "Table refreshed. Please choose your move again.".into()
                } else {
                    String::new()
                }
            })));
        }
        self.network = true;
        self.view = Some(snapshot.clone());
        effects.extend([
            Effect::ResetTransient,
            Effect::Render {
                snapshot,
                animate: false,
                resync,
            },
        ]);
        Ok(effects)
    }
    pub fn submit(
        &mut self,
        action: B::Action,
        action_id: u64,
        now: u64,
    ) -> Result<Vec<Effect<B>>, String> {
        let view = self
            .view
            .as_ref()
            .filter(|v| self.network && !v.paused)
            .ok_or("Wait for the table to reconnect.")?;
        let envelope = ActionEnvelope {
            version: PROTOCOL_VERSION,
            round: view.round,
            epoch: view.epoch,
            action_id,
            revision: B::view_revision(&view.view),
            action,
        };
        let mut effects = vec![Effect::ResetTransient];
        if let Some(authority) = &mut self.authority {
            let (ack, events) = authority.accept(self.player, envelope);
            effects.push(Effect::Error(ack.message.clone().unwrap_or_default()));
            effects.extend(self.publish(now, events, Some((self.player, ack)), false)?);
        } else {
            effects.push(Effect::Peer(self.host_id(), json(&envelope)?));
        }
        Ok(effects)
    }
}
fn json(value: &impl Serialize) -> Result<String, String> {
    serde_json::to_string(value).map_err(|_| "Cannot encode room message".into())
}
#[derive(serde::Deserialize)]
#[serde(deny_unknown_fields)]
struct CheckpointMessage {
    #[serde(rename = "type")]
    kind: String,
    checkpoint: String,
    transfer: u64,
}
#[cfg(target_arch = "wasm32")]
pub mod dom;
