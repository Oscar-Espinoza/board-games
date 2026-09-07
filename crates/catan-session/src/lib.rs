use catan::{Action, Event, Game, Phase, PlayerId, PlayerView, Setup};
use table_session::GameAdapter;
pub type Authority = table_session::Authority<Catan>;
pub type ActionEnvelope = table_protocol::ActionEnvelope<Action>;
pub type Snapshot = table_protocol::Snapshot<PlayerView, Event>;
pub struct Catan(pub Game);
impl GameAdapter for Catan {
    type Action = Action;
    type View = PlayerView;
    type Event = Event;
    type Phase = Phase;
    const GAME_ID: table_protocol::GameId = table_protocol::GameId::Catan;
    const BOTS: bool = false;
    fn view_for(&self, p: PlayerId) -> Result<PlayerView, String> {
        self.0.view_for(p)
    }
    fn apply(&mut self, p: PlayerId, a: Action) -> Result<Vec<Event>, String> {
        self.0.apply(p, a)
    }
    fn revision(&self) -> u64 {
        self.0.revision()
    }
    fn finished(&self) -> bool {
        self.0.finished()
    }
    fn phase(&self) -> Phase {
        self.0.phase()
    }
    fn players(&self) -> Vec<PlayerId> {
        self.0.players()
    }
    fn matches_room(&self, room: &table_protocol::RoomView) -> bool {
        room.options
            == table_protocol::RoomOptions::Catan {
                setup: match self.0.setup() {
                    Setup::Variable => table_protocol::BoardSetup::Variable,
                    Setup::Beginner => table_protocol::BoardSetup::Beginner,
                },
            }
    }
    fn bot_action(&self, _p: PlayerId) -> Option<Action> {
        None
    }
    fn filter_events(&self, p: PlayerId, events: Vec<Event>) -> Vec<Event> {
        self.0.events_for(p, events)
    }
    fn export_checkpoint(&self) -> Result<String, String> {
        self.0.export_checkpoint()
    }
    fn import_checkpoint(json: &str) -> Result<Self, String> {
        Ok(Self(Game::import_checkpoint(json)?))
    }
}

impl table_browser::Binding for Catan {
    fn authority(seed: [u8; 32], room: &table_protocol::RoomView) -> Result<Authority, String> {
        room.options.validate(Self::GAME_ID)?;
        let players = room.members.iter().map(|m| m.id).collect();
        let table_protocol::RoomOptions::Catan { setup } = room.options else {
            return Err("CATAN options required".into());
        };
        let setup = match setup {
            table_protocol::BoardSetup::Variable => Setup::Variable,
            table_protocol::BoardSetup::Beginner => Setup::Beginner,
        };
        let game = Game::new(seed, catan::GameConfig { players, setup })?;
        Authority::with_game(Self(game), room.round, room.members.clone())
    }
    fn viewer(view: &Self::View) -> PlayerId {
        view.player
    }
    fn view_revision(view: &Self::View) -> u64 {
        view.revision
    }
    fn view_finished(view: &Self::View) -> bool {
        matches!(view.phase, Phase::Finished { .. })
    }
}
#[cfg(test)]
fn configured_authority(
    seed: [u8; 32],
    round: u64,
    members: Vec<table_protocol::Member>,
) -> Result<Authority, String> {
    let players = members.iter().map(|m| m.id).collect();
    let game = Catan(Game::new(
        seed,
        catan::GameConfig {
            players,
            setup: Setup::Variable,
        },
    )?);
    Authority::with_game(game, round, members)
}

#[cfg(test)]
mod tests {
    use super::*;
    use table_protocol::{AckStatus, BoardSetup, GameId, Member, PROTOCOL_VERSION, RoomView};

    #[test]
    fn full_games_preserve_private_views_and_transfer_pending_decisions() {
        for name in ["3-variable", "6-beginner"] {
            let input: catan::Replay = serde_json::from_str(
                &std::fs::read_to_string(format!("../../tests/fixtures/catan/{name}.replay.json"))
                    .unwrap(),
            )
            .unwrap();
            let members: Vec<_> = input
                .config
                .players
                .iter()
                .map(|p| Member {
                    id: *p,
                    name: format!("P{}", p.0),
                    avatar: p.0,
                    bot: false,
                    connected: true,
                })
                .collect();
            let mut room = RoomView {
                options: table_protocol::RoomOptions::Catan {
                    setup: match input.config.setup {
                        Setup::Variable => BoardSetup::Variable,
                        Setup::Beginner => BoardSetup::Beginner,
                    },
                },
                game_id: GameId::Catan,
                rules_version: catan::RULES_VERSION,
                capacity: members.len() as u8,
                host_id: PlayerId(0),
                epoch: 0,
                invite: "test".into(),
                members: members.clone(),
                round: 1,
                locked: true,
            };
            let mut authority = Authority::with_game(
                Catan(Game::new(input.seed, input.config).unwrap()),
                1,
                members,
            )
            .unwrap();
            for (index, step) in input.actions.into_iter().enumerate() {
                let revision = authority.view(step.player).unwrap().revision;
                let envelope = ActionEnvelope {
                    version: PROTOCOL_VERSION,
                    round: 1,
                    epoch: room.epoch,
                    action_id: index as u64 * 2 + 2,
                    revision,
                    action: step.action,
                };
                if revision > 0 {
                    let mut stale = envelope.clone();
                    stale.action_id -= 1;
                    stale.revision -= 1;
                    assert_eq!(
                        authority.accept(step.player, stale).0.status,
                        AckStatus::Stale
                    );
                    assert_eq!(authority.view(step.player).unwrap().revision, revision);
                }
                let (ack, events) = authority.accept(step.player, envelope.clone());
                assert_eq!(ack.status, AckStatus::Accepted);
                assert_eq!(
                    authority.accept(step.player, envelope).0.status,
                    AckStatus::Duplicate
                );
                for member in &room.members {
                    let snapshot = authority
                        .snapshot(member.id, 0, events.clone(), None)
                        .unwrap();
                    let json = serde_json::to_value(snapshot).unwrap();
                    for key in ["hands", "deck", "rng", "checkpoint", "development"] {
                        assert!(json.get(key).is_none());
                        if key != "development" {
                            assert!(json["view"].get(key).is_none());
                        }
                    }
                }
                // Transfer at every boundary, including setup, discards, robber, free roads,
                // pre-roll cards and paired opportunities exercised by these complete games.
                let checkpoint = authority.export_checkpoint(0).unwrap();
                let mut wrong = room.clone();
                wrong.options = table_protocol::RoomOptions::Catan {
                    setup: if room.options
                        == (table_protocol::RoomOptions::Catan {
                            setup: BoardSetup::Variable,
                        }) {
                        BoardSetup::Beginner
                    } else {
                        BoardSetup::Variable
                    },
                };
                assert!(Authority::import_checkpoint(&checkpoint, &wrong, 0).is_err());
                let mut restored = Authority::import_checkpoint(&checkpoint, &room, 0).unwrap();
                assert_eq!(restored.export_checkpoint(0).unwrap(), checkpoint);
                room.epoch += 1;
                room.host_id = room.members[(index + 1) % room.members.len()].id;
                restored.set_authority(room.host_id, room.epoch);
                restored.freeze(false);
                authority = restored;
            }
            assert!(authority.finished());
        }
    }

    #[test]
    fn disconnected_humans_pause_without_bot_replacement() {
        let members = (0..3)
            .map(|id| Member {
                id: PlayerId(id),
                name: format!("P{id}"),
                avatar: id,
                bot: false,
                connected: true,
            })
            .collect();
        let mut authority = configured_authority([1; 32], 1, members).unwrap();
        authority.connected(PlayerId(1), false, 0);
        assert!(authority.paused());
        assert!(authority.replace(PlayerId(1), 100_000).is_err());
        assert!(authority.step_bot().is_empty());
        authority.connected(PlayerId(1), true, 100_001);
        assert!(!authority.paused());
    }
}
