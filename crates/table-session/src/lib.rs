//! Browser-host authority shared by game adapters. No rendering or concrete rules.
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use table_protocol::*;

/// An already-configured canonical game. Construction is explicit at game-specific
/// call sites. The roster is ordered and stable for the lifetime of an authority.
pub trait GameAdapter: Sized {
    type Action;
    type View;
    type Event;
    type Phase;
    const GAME_ID: GameId;
    const BOTS: bool;
    fn view_for(&self, player: PlayerId) -> Result<Self::View, String>;
    fn apply(&mut self, player: PlayerId, action: Self::Action)
    -> Result<Vec<Self::Event>, String>;
    fn revision(&self) -> u64;
    fn finished(&self) -> bool;
    fn phase(&self) -> Self::Phase;
    fn players(&self) -> Vec<PlayerId>;
    fn matches_room(&self, _room: &RoomView) -> bool {
        true
    }
    fn bot_action(&self, player: PlayerId) -> Option<Self::Action>;
    /// Remove recipient-private events before constructing each guest snapshot.
    fn filter_events(&self, player: PlayerId, events: Vec<Self::Event>) -> Vec<Self::Event>;
    fn export_checkpoint(&self) -> Result<String, String>;
    fn import_checkpoint(json: &str) -> Result<Self, String>;
}
/// Canonical game and deduplication state stay in the host browser.
pub struct Authority<G: GameAdapter> {
    host_id: PlayerId,
    epoch: u64,
    frozen: bool,
    departed: Vec<PlayerId>,
    game: G,
    round: u64,
    members: Vec<Member>,
    last_ids: BTreeMap<PlayerId, u64>,
    disconnected: BTreeMap<PlayerId, u64>,
    temporary: Vec<PlayerId>,
    host_lost: Option<u64>,
    ended: bool,
}
impl<G: GameAdapter> Authority<G> {
    pub fn end(&mut self) {
        self.ended = true;
    }
    pub fn with_game(game: G, round: u64, members: Vec<Member>) -> Result<Self, String> {
        if members.is_empty()
            || game.players() != members.iter().map(|m| m.id).collect::<Vec<_>>()
            || (!G::BOTS && members.iter().any(|m| m.bot))
        {
            return Err("Invalid game roster".into());
        }
        Ok(Self {
            host_id: members[0].id,
            epoch: 0,
            frozen: false,
            departed: vec![],
            game,
            round,
            members,
            last_ids: BTreeMap::new(),
            disconnected: BTreeMap::new(),
            temporary: vec![],
            host_lost: None,
            ended: false,
        })
    }
    pub fn round(&self) -> u64 {
        self.round
    }
    pub fn finished(&self) -> bool {
        self.game.finished()
    }
    pub fn view(&self, player: PlayerId) -> Result<G::View, String> {
        self.game.view_for(player)
    }

    pub fn connected(&mut self, player: PlayerId, connected: bool, now: u64) {
        if let Some(member) = self.members.iter_mut().find(|m| m.id == player) {
            if member.bot {
                return;
            }
            member.connected = connected;
            if connected {
                self.departed.retain(|p| *p != player);
                self.disconnected.remove(&player);
                self.temporary.retain(|p| *p != player);
            } else {
                self.disconnected.entry(player).or_insert(now);
            }
        }
    }
    pub fn host_connected(&mut self, connected: bool, now: u64) {
        if connected {
            if self
                .host_lost
                .is_some_and(|t| now.saturating_sub(t) >= HOST_WAIT_MS)
            {
                self.ended = true;
            }
            self.host_lost = None;
        } else {
            self.host_lost.get_or_insert(now);
        }
    }
    pub fn tick(&mut self, now: u64) {
        if self
            .host_lost
            .is_some_and(|t| now.saturating_sub(t) >= HOST_WAIT_MS)
        {
            self.ended = true;
        }
    }
    pub fn replace(&mut self, player: PlayerId, now: u64) -> Result<(), String> {
        if !G::BOTS {
            return Err("This game has no bots".into());
        }
        if self.frozen {
            return Err("Authority transfer in progress".into());
        }
        if !self.departed.contains(&player)
            && !self
                .disconnected
                .get(&player)
                .is_some_and(|t| now.saturating_sub(*t) >= GUEST_WAIT_MS)
        {
            return Err("Wait 60 seconds before assigning a temporary bot.".into());
        }
        if !self.temporary.contains(&player) {
            self.temporary.push(player);
        }
        Ok(())
    }
    pub fn paused(&self) -> bool {
        self.ended
            || self.frozen
            || self.host_lost.is_some()
            || self
                .disconnected
                .keys()
                .any(|p| !self.temporary.contains(p))
    }
    pub fn snapshot(
        &self,
        player: PlayerId,
        now: u64,
        events: Vec<G::Event>,
        ack: Option<Ack>,
    ) -> Result<Snapshot<G::View, G::Event>, String> {
        Ok(Snapshot {
            host_id: self.host_id,
            epoch: self.epoch,
            version: PROTOCOL_VERSION,
            round: self.round,
            view: self.view(player)?,
            members: self.members.clone(),
            paused: self.paused(),
            ended: self.ended,
            temporary_bots: self.temporary.clone(),
            can_replace: self
                .disconnected
                .iter()
                .filter(|(p, t)| {
                    G::BOTS
                        && !self.temporary.contains(p)
                        && (self.departed.contains(p) || now.saturating_sub(**t) >= GUEST_WAIT_MS)
                })
                .map(|(p, _)| *p)
                .collect(),
            events: self.game.filter_events(player, events),
            ack,
        })
    }
    /// `sender` comes from an authenticated channel binding, never a message field.
    pub fn accept(
        &mut self,
        sender: PlayerId,
        envelope: ActionEnvelope<G::Action>,
    ) -> (Ack, Vec<G::Event>) {
        let mut ack = Ack {
            action_id: envelope.action_id,
            status: AckStatus::Rejected,
            message: None,
        };
        if envelope.version != PROTOCOL_VERSION
            || !self.members.iter().any(|m| m.id == sender && !m.bot)
        {
            ack.message = Some("Unsupported protocol or sender.".into());
            return (ack, vec![]);
        }
        if envelope.round != self.round || envelope.epoch != self.epoch {
            ack.status = AckStatus::Stale;
            return (ack, vec![]);
        }
        if self.frozen {
            ack.message = Some("Authority transfer in progress".into());
            return (ack, vec![]);
        }
        if self
            .last_ids
            .get(&sender)
            .is_some_and(|id| envelope.action_id <= *id)
        {
            ack.status = AckStatus::Duplicate;
            return (ack, vec![]);
        }
        self.last_ids.insert(sender, envelope.action_id);
        if envelope.revision != self.game.revision() {
            ack.status = AckStatus::Stale;
            return (ack, vec![]);
        }
        if self.paused() || self.temporary.contains(&sender) {
            ack.message = Some("The table is paused for reconnection.".into());
            return (ack, vec![]);
        }
        match self.game.apply(sender, envelope.action) {
            Ok(events) => {
                ack.status = AckStatus::Accepted;
                (ack, events)
            }
            Err(e) => {
                ack.message = Some(e.to_string());
                (ack, vec![])
            }
        }
    }
    /// Select only at execution time: a reclaimed seat cannot run a queued bot move.
    pub fn step_bot(&mut self) -> Vec<G::Event> {
        if self.paused() {
            return vec![];
        }
        for member in &self.members {
            if (member.bot || self.temporary.contains(&member.id))
                && let Some(action) = self.game.bot_action(member.id)
            {
                return self
                    .game
                    .apply(member.id, action)
                    .expect("legal projected bot action");
            }
        }
        vec![]
    }
    pub fn phase(&self) -> G::Phase {
        self.game.phase()
    }
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Checkpoint {
    game_id: GameId,
    rules_version: u32,
    version: u32,
    game: String,
    host_id: PlayerId,
    epoch: u64,
    round: u64,
    members: Vec<Member>,
    last_ids: BTreeMap<PlayerId, u64>,
    disconnected: BTreeMap<PlayerId, u64>,
    temporary: Vec<PlayerId>,
    departed: Vec<PlayerId>,
    host_lost: Option<u64>,
    ended: bool,
}
impl<G: GameAdapter> Authority<G> {
    pub fn set_authority(&mut self, host: PlayerId, epoch: u64) {
        self.host_id = host;
        self.epoch = epoch;
        self.host_lost = None;
        self.frozen = false;
    }
    pub fn freeze(&mut self, frozen: bool) {
        self.frozen = frozen;
    }
    pub fn depart(&mut self, player: PlayerId, now: u64) {
        self.connected(player, false, now);
        if self.disconnected.contains_key(&player) && !self.departed.contains(&player) {
            self.departed.push(player);
        }
    }
    pub fn export_checkpoint(&self, now: u64) -> Result<String, String> {
        let json = serde_json::to_string(&Checkpoint {
            game_id: G::GAME_ID,
            rules_version: G::GAME_ID.entry().rules_version,
            version: PROTOCOL_VERSION,
            game: self.game.export_checkpoint()?,
            host_id: self.host_id,
            epoch: self.epoch,
            round: self.round,
            members: self.members.clone(),
            last_ids: self.last_ids.clone(),
            disconnected: self
                .disconnected
                .iter()
                .map(|(p, t)| (*p, now.saturating_sub(*t)))
                .collect(),
            temporary: self.temporary.clone(),
            departed: self.departed.clone(),
            host_lost: self.host_lost.map(|t| now.saturating_sub(t)),
            ended: self.ended,
        })
        .map_err(|e| e.to_string())?;
        if serde_json::json!({"type":"checkpoint", "transfer":u64::MAX, "checkpoint":json})
            .to_string()
            .len()
            > MAX_MESSAGE
        {
            return Err("Checkpoint too large".into());
        }
        Ok(json)
    }
    pub fn import_checkpoint(json: &str, room: &RoomView, now: u64) -> Result<Self, String> {
        if json.len() > MAX_MESSAGE {
            return Err("Checkpoint too large".into());
        }
        let c: Checkpoint =
            serde_json::from_str(json).map_err(|_| "Malformed authority checkpoint")?;
        let game = G::import_checkpoint(&c.game)?;
        let ids: Vec<_> = c.members.iter().map(|m| m.id).collect();
        let humans = |p: &PlayerId| c.members.iter().any(|m| m.id == *p && !m.bot);
        if c.game_id != G::GAME_ID {
            return Err("Checkpoint game mismatch".into());
        }
        if c.rules_version != G::GAME_ID.entry().rules_version {
            return Err("Checkpoint rules version mismatch".into());
        }
        if c.version != PROTOCOL_VERSION {
            return Err("Checkpoint transport version mismatch".into());
        }
        if c.round != room.round {
            return Err("Checkpoint round mismatch".into());
        }
        if c.epoch != room.epoch {
            return Err("Checkpoint epoch mismatch".into());
        }
        if c.host_id != room.host_id {
            return Err("Checkpoint host mismatch".into());
        }
        if ids != room.members.iter().map(|m| m.id).collect::<Vec<_>>() {
            return Err("Checkpoint roster order mismatch".into());
        }
        if c.members
            .iter()
            .zip(&room.members)
            .any(|(a, b)| a.bot != b.bot || a.name != b.name || a.avatar != b.avatar)
        {
            return Err("Checkpoint member metadata mismatch".into());
        }
        if !humans(&c.host_id) {
            return Err("Checkpoint host must be human".into());
        }
        if c.last_ids.keys().any(|p| !humans(p)) {
            return Err("Deduplication player must be human".into());
        }
        if c.disconnected.keys().any(|p| !humans(p)) {
            return Err("Disconnected player must be human".into());
        }
        if c.temporary
            .iter()
            .chain(&c.departed)
            .any(|p| !c.disconnected.contains_key(p))
        {
            return Err("Replacement or departure requires disconnect".into());
        }
        if ids.iter().any(|p| game.view_for(*p).is_err()) {
            return Err("Checkpoint recipient projection unavailable".into());
        }
        if !game.matches_room(room) {
            return Err("Checkpoint options mismatch".into());
        }
        if game.players() != ids {
            return Err("Canonical roster mismatch".into());
        }
        if room.game_id != G::GAME_ID {
            return Err("Room game mismatch".into());
        }
        if room.rules_version != G::GAME_ID.entry().rules_version {
            return Err("Room rules version mismatch".into());
        }
        if !G::BOTS && (!c.temporary.is_empty() || c.members.iter().any(|m| m.bot)) {
            return Err("Bots are unsupported for this game".into());
        }

        Ok(Self {
            game,
            host_id: c.host_id,
            epoch: c.epoch,
            round: c.round,
            members: c.members,
            last_ids: c.last_ids,
            disconnected: c
                .disconnected
                .into_iter()
                .map(|(p, age)| (p, now.saturating_sub(age)))
                .collect(),
            temporary: c.temporary,
            departed: c.departed,
            host_lost: c.host_lost.map(|age| now.saturating_sub(age)),
            ended: c.ended,
            frozen: true,
        })
    }
}

#[cfg(test)]
mod tests;
