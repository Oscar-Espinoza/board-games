//! Transport-independent wire envelopes, typed room options and game registry.
use serde::{Deserialize, Serialize};
pub const PROTOCOL_VERSION: u32 = 5;
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
    pub options: RoomOptions,
    pub game_id: GameId,
    pub rules_version: u32,
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
        game_id: GameId,
        rules_version: u32,
        name: String,
        avatar: u8,
    },
    Join {
        version: u32,
        game_id: GameId,
        rules_version: u32,
        invite: String,
        name: String,
        avatar: u8,
    },
    Resume {
        version: u32,
        game_id: GameId,
        rules_version: u32,
        invite: String,
        credential: String,
    },
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case", deny_unknown_fields)]
pub enum SignalCommand {
    UpdateOptions {
        options: RoomOptions,
    },
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
pub struct ActionEnvelope<A> {
    pub version: u32,
    pub round: u64,
    pub epoch: u64,
    pub action_id: u64,
    pub revision: u64,
    pub action: A,
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
pub struct Snapshot<V, E> {
    pub host_id: PlayerId,
    pub epoch: u64,
    pub version: u32,
    pub round: u64,
    pub view: V,
    pub members: Vec<Member>,
    pub paused: bool,
    pub ended: bool,
    pub temporary_bots: Vec<PlayerId>,
    pub can_replace: Vec<PlayerId>,
    pub events: Vec<E>,
    pub ack: Option<Ack>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case", deny_unknown_fields)]
pub enum ControlEnvelope {
    Sync { version: u32 },
}

pub use table_types::PlayerId;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum GameId {
    ColorMatch,
    Catan,
}

pub struct TableRegistration {
    pub id: GameId,
    pub min_players: u8,
    pub max_players: u8,
    pub default_capacity: u8,
    pub rules_version: u32,
    pub bots: bool,
    pub playable: bool,
}
pub const TABLE_GAMES: [TableRegistration; 2] = [
    TableRegistration {
        id: GameId::ColorMatch,
        min_players: 2,
        max_players: 8,
        default_capacity: 8,
        rules_version: 2,
        bots: true,
        playable: true,
    },
    TableRegistration {
        id: GameId::Catan,
        min_players: 3,
        max_players: 6,
        default_capacity: 4,
        rules_version: 1,
        bots: false,
        playable: true,
    },
];
impl GameId {
    pub fn entry(self) -> &'static TableRegistration {
        TABLE_GAMES
            .iter()
            .find(|entry| entry.id == self)
            .expect("registered game")
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BoardSetup {
    Variable,
    Beginner,
}

/// Registry-owned room configuration. Unknown fields cannot hide game mismatches.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "game", rename_all = "kebab-case", deny_unknown_fields)]
pub enum RoomOptions {
    ColorMatch {},
    Catan { setup: BoardSetup },
}
impl RoomOptions {
    pub fn validate(self, game: GameId) -> Result<(), String> {
        if matches!(
            (game, self),
            (GameId::ColorMatch, Self::ColorMatch {}) | (GameId::Catan, Self::Catan { .. })
        ) {
            Ok(())
        } else {
            Err("Room options do not match the game.".into())
        }
    }
}
impl GameId {
    pub fn default_options(self) -> RoomOptions {
        match self {
            Self::ColorMatch => RoomOptions::ColorMatch {},
            Self::Catan => RoomOptions::Catan {
                setup: BoardSetup::Variable,
            },
        }
    }
}
/// Namespaces are derived from the transport version, independently of game rules.
pub fn channel_name() -> String {
    format!("table-v{PROTOCOL_VERSION}")
}
pub fn seat_namespace() -> String {
    format!("table-seat-v{PROTOCOL_VERSION}")
}
pub fn action_namespace() -> String {
    format!("table-action-id-v{PROTOCOL_VERSION}")
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn options_are_typed_and_match_the_registry() {
        for entry in &TABLE_GAMES {
            let options = entry.id.default_options();
            options.validate(entry.id).unwrap();
            let json = serde_json::to_string(&options).unwrap();
            assert_eq!(serde_json::from_str::<RoomOptions>(&json).unwrap(), options);
        }
        for setup in [BoardSetup::Variable, BoardSetup::Beginner] {
            let options = RoomOptions::Catan { setup };
            options.validate(GameId::Catan).unwrap();
            assert!(options.validate(GameId::ColorMatch).is_err());
        }
        assert!(RoomOptions::ColorMatch {}.validate(GameId::Catan).is_err());
        assert!(
            serde_json::from_str::<RoomOptions>(r#"{"game":"color-match","setup":"beginner"}"#)
                .is_err()
        );
    }
}
