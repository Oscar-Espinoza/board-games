use super::*;

// A human-only fixture exercises the shared boundary independently of Color Match.
#[derive(Serialize, Deserialize)]
struct PrivateDecisions {
    players: Vec<PlayerId>,
    revision: u64,
}
impl GameAdapter for PrivateDecisions {
    type Action = ();
    type View = u64;
    type Event = (PlayerId, String);
    type Phase = ();
    const GAME_ID: GameId = GameId::Catan;
    const BOTS: bool = false;
    fn view_for(&self, player: PlayerId) -> Result<u64, String> {
        self.players
            .contains(&player)
            .then_some(self.revision)
            .ok_or("Unknown player".into())
    }
    fn apply(&mut self, player: PlayerId, _action: ()) -> Result<Vec<Self::Event>, String> {
        self.revision += 1;
        Ok(vec![(player, "private choice".into())])
    }
    fn revision(&self) -> u64 {
        self.revision
    }
    fn finished(&self) -> bool {
        false
    }
    fn phase(&self) {}
    fn players(&self) -> Vec<PlayerId> {
        self.players.clone()
    }
    fn bot_action(&self, _player: PlayerId) -> Option<()> {
        None
    }
    fn filter_events(&self, player: PlayerId, events: Vec<Self::Event>) -> Vec<Self::Event> {
        events
            .into_iter()
            .filter(|event| event.0 == player)
            .collect()
    }
    fn export_checkpoint(&self) -> Result<String, String> {
        serde_json::to_string(self).map_err(|e| e.to_string())
    }
    fn import_checkpoint(json: &str) -> Result<Self, String> {
        serde_json::from_str(json).map_err(|e| e.to_string())
    }
}
#[test]
fn private_events_filter_per_recipient_and_human_only_games_stay_paused() {
    let members: Vec<_> = (0..3)
        .map(|id| Member {
            id: PlayerId(id),
            name: format!("P{id}"),
            avatar: id,
            bot: false,
            connected: true,
        })
        .collect();
    let mut authority = make_authority([0; 32], 1, members.clone()).unwrap();
    let (_, events) = authority.accept(
        PlayerId(0),
        ActionEnvelope {
            version: PROTOCOL_VERSION,
            round: 1,
            epoch: 0,
            action_id: 1,
            revision: 0,
            action: (),
        },
    );
    assert_eq!(
        authority
            .snapshot(PlayerId(0), 0, events.clone(), None)
            .unwrap()
            .events
            .len(),
        1
    );
    assert!(
        authority
            .snapshot(PlayerId(1), 0, events, None)
            .unwrap()
            .events
            .is_empty()
    );
    authority.depart(PlayerId(1), 0);
    assert!(authority.replace(PlayerId(1), GUEST_WAIT_MS + 1).is_err());
    assert!(
        authority
            .snapshot(PlayerId(0), GUEST_WAIT_MS + 1, vec![], None)
            .unwrap()
            .can_replace
            .is_empty()
    );
    assert!(authority.paused());
    assert!(authority.step_bot().is_empty());
    let mut bots = members;
    bots[1].bot = true;
    assert!(make_authority([0; 32], 1, bots).is_err());
}

fn make_authority(
    _seed: [u8; 32],
    round: u64,
    members: Vec<Member>,
) -> Result<Authority<PrivateDecisions>, String> {
    let game = PrivateDecisions {
        players: members.iter().map(|m| m.id).collect(),
        revision: 0,
    };
    Authority::with_game(game, round, members)
}

#[test]
fn live_host_deadline_is_terminal_after_expiry() {
    let mut a = make_authority([0; 32], 4, members()).unwrap();
    a.host_connected(false, 100);
    a.tick(120_099);
    assert!(!a.snapshot(PlayerId(0), 0, vec![], None).unwrap().ended);
    a.host_connected(true, 120_099);
    assert!(!a.paused());
    a.host_connected(false, 200_000);
    a.tick(320_000);
    assert!(a.snapshot(PlayerId(0), 0, vec![], None).unwrap().ended);
    a.host_connected(true, 320_001);
    assert!(a.paused());
}

#[test]
fn fresh_round_rejects_prior_round_actions() {
    let mut fresh = make_authority([8; 32], 5, members()).unwrap();
    assert_eq!(
        fresh
            .accept(
                PlayerId(0),
                ActionEnvelope {
                    version: PROTOCOL_VERSION,
                    round: 4,
                    epoch: 0,
                    action_id: 1,
                    revision: 0,
                    action: ()
                }
            )
            .0
            .status,
        AckStatus::Stale
    );
}

fn members() -> Vec<Member> {
    (0..3)
        .map(|id| Member {
            id: PlayerId(id),
            name: format!("P{id}"),
            avatar: id,
            bot: false,
            connected: true,
        })
        .collect()
}
#[test]
fn wrapped_checkpoint_budget_counts_utf8_and_json_escaping() {
    let mut roster = members();
    let mut largest = None;
    // Name contents exercise both multi-byte text and double JSON escaping.
    for length in (0..MAX_MESSAGE).step_by(100) {
        roster[0].name = "é\"".repeat(length);
        let authority = make_authority([0; 32], 1, roster.clone()).unwrap();
        match authority.export_checkpoint(0) {
            Ok(checkpoint) => {
                let wrapped = serde_json::json!({"type":"checkpoint", "transfer":u64::MAX, "checkpoint":checkpoint}).to_string();
                assert!(wrapped.len() <= MAX_MESSAGE);
                largest = Some(wrapped.len());
            }
            Err(error) => {
                assert_eq!(error, "Checkpoint too large");
                assert!(largest.is_some());
                return;
            }
        }
    }
    panic!("Expected oversized checkpoint rejection");
}
