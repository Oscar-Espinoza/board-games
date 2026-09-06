//! Transport-independent room envelopes and browser-host authority.
use color_match::{Action, Game, GameConfig, Phase, PlayerId, PlayerView, PublicEvent, bot_action};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
pub const PROTOCOL_VERSION: u32 = 3;
pub const MAX_MESSAGE: usize = 32 * 1024;
pub const GUEST_WAIT_MS: u64 = 60_000;
pub const HOST_WAIT_MS: u64 = 120_000;
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Member {
    pub id: PlayerId,
    pub name: String,
    pub avatar: u8,
    pub bot: bool,
    pub connected: bool,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RoomView {
    pub capacity: u8,
    pub host_id: PlayerId,
    pub epoch: u64,
    pub invite: String,
    pub members: Vec<Member>,
    pub round: u64,
    pub locked: bool,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case", deny_unknown_fields)]
pub enum Hello {
    Create {
        version: u32,
        name: String,
        avatar: u8,
    },
    Join {
        version: u32,
        invite: String,
        name: String,
        avatar: u8,
    },
    Resume {
        version: u32,
        invite: String,
        credential: String,
    },
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case", deny_unknown_fields)]
pub enum SignalCommand {
    Signal {
        epoch: u64,
        to: PlayerId,
        data: serde_json::Value,
    },
    Capacity {
        capacity: u8,
    },
    Ready {
        player: PlayerId,
        ready: bool,
    },
    RoundFinished {
        round: u64,
        epoch: u64,
    },
    Leave,
    HandoffPrepare {
        successor: PlayerId,
        round: u64,
        epoch: u64,
    },
    HandoffReady {
        transfer: u64,
        round: u64,
        epoch: u64,
    },
    HandoffCommit {
        transfer: u64,
        round: u64,
        epoch: u64,
    },
    HandoffCancel {
        transfer: u64,
        round: u64,
        epoch: u64,
    },
    AddBot,
    RemoveBot {
        player: PlayerId,
    },
    Start,
    Ping,
    Ice,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SignalEvent {
    Departed {
        player: PlayerId,
    },
    Left,
    HandoffPrepare {
        transfer: u64,
        host: PlayerId,
        successor: PlayerId,
        round: u64,
        epoch: u64,
    },
    HandoffReady {
        transfer: u64,
        round: u64,
        epoch: u64,
    },
    HandoffCommit {
        room: RoomView,
        former_host: PlayerId,
    },
    HandoffCancel {
        message: String,
    },
    Welcome {
        version: u32,
        player: PlayerId,
        credential: String,
        room: RoomView,
    },
    Room {
        room: RoomView,
    },
    Signal {
        epoch: u64,
        from: PlayerId,
        data: serde_json::Value,
    },
    Ice {
        ice_servers: serde_json::Value,
    },
    Error {
        message: String,
    },
    Pong,
    Ended {
        message: String,
    },
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ActionEnvelope {
    pub version: u32,
    pub round: u64,
    pub epoch: u64,
    pub action_id: u64,
    pub revision: u64,
    pub action: Action,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AckStatus {
    Accepted,
    Duplicate,
    Stale,
    Rejected,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Ack {
    pub action_id: u64,
    pub status: AckStatus,
    pub message: Option<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Snapshot {
    pub host_id: PlayerId,
    pub epoch: u64,
    pub version: u32,
    pub round: u64,
    pub view: PlayerView,
    pub members: Vec<Member>,
    pub paused: bool,
    pub ended: bool,
    pub temporary_bots: Vec<PlayerId>,
    pub can_replace: Vec<PlayerId>,
    pub events: Vec<PublicEvent>,
    pub ack: Option<Ack>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case", deny_unknown_fields)]
pub enum ControlEnvelope {
    Sync { version: u32 },
}
/// Canonical game and deduplication state stay in the host browser.
pub struct Authority {
    host_id: PlayerId,
    epoch: u64,
    frozen: bool,
    departed: Vec<PlayerId>,
    game: Game,
    round: u64,
    members: Vec<Member>,
    last_ids: BTreeMap<PlayerId, u64>,
    disconnected: BTreeMap<PlayerId, u64>,
    temporary: Vec<PlayerId>,
    host_lost: Option<u64>,
    ended: bool,
}
impl Authority {
    pub fn end(&mut self) {
        self.ended = true;
    }
    pub fn new(seed: [u8; 32], round: u64, members: Vec<Member>) -> Result<Self, String> {
        let game = Game::new(
            seed,
            GameConfig {
                players: members.iter().map(|m| m.id).collect(),
            },
        )
        .map_err(|e| e.to_string())?;
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
        self.game
            .view_for(self.members[0].id)
            .unwrap()
            .phase
            .actor()
            .is_none()
    }
    pub fn view(&self, player: PlayerId) -> Result<PlayerView, String> {
        self.game.view_for(player).map_err(|e| e.to_string())
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
        events: Vec<PublicEvent>,
        ack: Option<Ack>,
    ) -> Result<Snapshot, String> {
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
                    !self.temporary.contains(p)
                        && (self.departed.contains(p) || now.saturating_sub(**t) >= GUEST_WAIT_MS)
                })
                .map(|(p, _)| *p)
                .collect(),
            events,
            ack,
        })
    }
    /// `sender` comes from an authenticated channel binding, never a message field.
    pub fn accept(
        &mut self,
        sender: PlayerId,
        envelope: ActionEnvelope,
    ) -> (Ack, Vec<PublicEvent>) {
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
        if envelope.revision != self.view(sender).unwrap().revision {
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
    pub fn step_bot(&mut self) -> Vec<PublicEvent> {
        if self.paused() {
            return vec![];
        }
        for member in &self.members {
            if (member.bot || self.temporary.contains(&member.id))
                && let Some(action) = bot_action(&self.game.view_for(member.id).unwrap())
            {
                return self
                    .game
                    .apply(member.id, action)
                    .expect("legal projected bot action");
            }
        }
        vec![]
    }
    pub fn phase(&self) -> Phase {
        self.game.view_for(self.members[0].id).unwrap().phase
    }
}
#[cfg(test)]
mod tests;

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Checkpoint {
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
impl Authority {
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
        let c: Checkpoint = serde_json::from_str(json).map_err(|e| e.to_string())?;
        let game = Game::import_checkpoint(&c.game)?;
        let ids: Vec<_> = c.members.iter().map(|m| m.id).collect();
        let humans = |p: &PlayerId| c.members.iter().any(|m| m.id == *p && !m.bot);
        if c.version != PROTOCOL_VERSION
            || c.round != room.round
            || c.epoch != room.epoch
            || c.host_id != room.host_id
            || ids != room.members.iter().map(|m| m.id).collect::<Vec<_>>()
            || c.members
                .iter()
                .zip(&room.members)
                .any(|(a, b)| a.bot != b.bot || a.name != b.name || a.avatar != b.avatar)
            || !humans(&c.host_id)
            || c.last_ids.keys().any(|p| !humans(p))
            || c.disconnected.keys().any(|p| !humans(p))
            || c.temporary
                .iter()
                .chain(&c.departed)
                .any(|p| !c.disconnected.contains_key(p))
            || ids.iter().any(|p| game.view_for(*p).is_err())
            || game
                .view_for(ids[0])
                .map_err(|e| e.to_string())?
                .players
                .iter()
                .map(|p| p.player)
                .collect::<Vec<_>>()
                != ids
        {
            return Err("Checkpoint does not match this authority".into());
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
