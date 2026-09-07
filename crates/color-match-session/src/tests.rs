use super::*;
use table_protocol::{
    AckStatus, GameId, MAX_MESSAGE, Member, PROTOCOL_VERSION, PlayerId, RoomView,
};
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
fn auth() -> Authority {
    configured_authority([7; 32], 4, members()).unwrap()
}
fn envelope(id: u64, revision: u64) -> ActionEnvelope {
    ActionEnvelope {
        version: PROTOCOL_VERSION,
        round: 4,
        epoch: 0,
        action_id: id,
        revision,
        action: Action::Draw {},
    }
}
#[test]
fn action_ids_staleness_forgery_and_redaction() {
    let mut a = auth();
    assert_eq!(
        a.accept(PlayerId(99), envelope(1, 0)).0.status,
        AckStatus::Rejected
    );
    assert_eq!(
        a.accept(PlayerId(0), envelope(1, 0)).0.status,
        AckStatus::Accepted
    );
    assert_eq!(
        a.accept(PlayerId(0), envelope(1, 0)).0.status,
        AckStatus::Duplicate
    );
    assert_eq!(a.view(PlayerId(0)).unwrap().revision, 1);
    assert_eq!(
        a.accept(PlayerId(1), envelope(1, 0)).0.status,
        AckStatus::Stale
    );
    assert_eq!(a.view(PlayerId(0)).unwrap().revision, 1);
    let mut old = envelope(2, 1);
    old.round = 3;
    assert_eq!(a.accept(PlayerId(1), old).0.status, AckStatus::Stale);
    let (ack, events) = a.accept(PlayerId(1), envelope(2, 1));
    assert_eq!(ack.status, AckStatus::Accepted);
    let snapshot = a.snapshot(PlayerId(2), 0, events, Some(ack)).unwrap();
    let value = serde_json::to_value(snapshot).unwrap();
    assert!(value.get("seed").is_none());
    assert!(value["view"].get("hands").is_none());
    assert!(value["events"][0].get("cards").is_none());
    assert!(serde_json::from_str::<ActionEnvelope>(r#"{"version":2,"round":4,"action_id":5,"revision":2,"player":0,"action":{"type":"draw"}}"#).is_err());
}
#[test]
fn disconnect_pause_temporary_bot_and_reclaim() {
    let mut a = auth();
    a.connected(PlayerId(1), false, 100);
    assert!(a.paused());
    assert_eq!(
        a.accept(PlayerId(0), envelope(1, 0)).0.status,
        AckStatus::Rejected
    );
    assert!(a.step_bot().is_empty());
    assert!(a.replace(PlayerId(1), 60_099).is_err());
    assert!(
        a.snapshot(PlayerId(0), 60_100, vec![], None)
            .unwrap()
            .can_replace
            .contains(&PlayerId(1))
    );
    a.replace(PlayerId(1), 60_100).unwrap();
    assert!(!a.paused());
    assert_eq!(
        a.accept(PlayerId(0), envelope(2, 0)).0.status,
        AckStatus::Accepted
    );
    let revision = a.view(PlayerId(0)).unwrap().revision;
    a.connected(PlayerId(1), true, 60_101);
    assert!(a.step_bot().is_empty());
    assert_eq!(a.view(PlayerId(0)).unwrap().revision, revision);
    assert_eq!(
        a.accept(PlayerId(1), envelope(1, revision)).0.status,
        AckStatus::Accepted
    );
}

fn room() -> RoomView {
    RoomView {
        options: table_protocol::RoomOptions::ColorMatch {},
        game_id: GameId::ColorMatch,
        rules_version: 2,
        capacity: 8,
        host_id: PlayerId(0),
        epoch: 0,
        invite: "test".into(),
        round: 4,
        locked: true,
        members: members(),
    }
}
#[test]
fn checkpoint_preserves_private_state_dedup_and_disconnects() {
    let mut a = auth();
    a.accept(PlayerId(0), envelope(5, 0));
    a.connected(PlayerId(2), false, 100);
    a.depart(PlayerId(1), 500);
    a.freeze(true);
    let json = a.export_checkpoint(500).unwrap();
    let mut b = Authority::import_checkpoint(&json, &room(), 500).unwrap();
    assert_eq!(b.export_checkpoint(500).unwrap(), json);
    b.set_authority(PlayerId(0), 0);
    assert!(b.replace(PlayerId(2), 60_099).is_err());
    b.replace(PlayerId(2), 60_100).unwrap();
    b.replace(PlayerId(1), 500).unwrap();
    assert!(!b.paused());
    assert_eq!(
        b.accept(PlayerId(0), envelope(5, 0)).0.status,
        AckStatus::Duplicate
    );
    b.connected(PlayerId(1), true, 501);
    assert!(
        !b.snapshot(PlayerId(1), 501, vec![], None)
            .unwrap()
            .temporary_bots
            .contains(&PlayerId(1))
    );
    b.set_authority(PlayerId(1), 1);
    assert_eq!(
        b.accept(PlayerId(1), envelope(6, 1)).0.status,
        AckStatus::Stale
    );
    let mut wrong = room();
    wrong.epoch += 1;
    assert!(Authority::import_checkpoint(&json, &wrong, 500).is_err());
    assert!(Authority::import_checkpoint(&"x".repeat(MAX_MESSAGE + 1), &room(), 500).is_err());
    let ordinary =
        serde_json::to_string(&b.snapshot(PlayerId(2), 0, vec![], None).unwrap()).unwrap();
    for key in ["\"game\"", "\"seed\"", "\"hands\"", "\"last_ids\""] {
        assert!(!ordinary.contains(key));
    }
}

#[test]
fn checkpoint_rebases_disconnect_age_and_freeze_does_not_lose_ids() {
    let mut a = auth();
    a.connected(PlayerId(2), false, 100);
    a.freeze(true);
    assert_eq!(
        a.accept(PlayerId(0), envelope(99, 0)).0.status,
        AckStatus::Rejected
    );
    let checkpoint = a.export_checkpoint(500).unwrap();
    let mut b = Authority::import_checkpoint(&checkpoint, &room(), 100_000).unwrap();
    b.set_authority(PlayerId(0), 0);
    assert!(b.replace(PlayerId(2), 159_599).is_err());
    b.replace(PlayerId(2), 159_600).unwrap();
    assert_eq!(
        b.accept(PlayerId(0), envelope(99, 0)).0.status,
        AckStatus::Accepted
    );
}

#[test]
fn checkpoint_rejects_cross_game_and_rules_version_binding() {
    let checkpoint = auth().export_checkpoint(0).unwrap();
    let mut wrong = room();
    wrong.game_id = GameId::Catan;
    wrong.rules_version = 1;
    assert!(Authority::import_checkpoint(&checkpoint, &wrong, 0).is_err());
    for (key, replacement) in [
        ("game_id", serde_json::json!("catan")),
        ("rules_version", serde_json::json!(999)),
    ] {
        let mut value: serde_json::Value = serde_json::from_str(&checkpoint).unwrap();
        value[key] = replacement;
        assert!(Authority::import_checkpoint(&value.to_string(), &room(), 0).is_err());
    }
}

#[test]
fn adapter_preserves_nonconsecutive_domain_ids_on_checkpoint_import() {
    let mut members = members();
    for (member, id) in members.iter_mut().zip([17, 42, 255]) {
        member.id = PlayerId(id);
    }
    let authority = configured_authority([7; 32], 4, members.clone()).unwrap();
    let room = RoomView {
        members,
        host_id: PlayerId(17),
        ..room()
    };
    let json = authority.export_checkpoint(0).unwrap();
    let restored = Authority::import_checkpoint(&json, &room, 0).unwrap();
    assert_eq!(restored.export_checkpoint(0).unwrap(), json);
}

fn configured_authority(
    seed: [u8; 32],
    round: u64,
    members: Vec<table_protocol::Member>,
) -> Result<Authority, String> {
    let players = members.iter().map(|m| m.id).collect();
    let game = super::ColorMatch(
        color_match::Game::new(seed, color_match::GameConfig { players })
            .map_err(|e| e.to_string())?,
    );
    Authority::with_game(game, round, members)
}

type Client = table_browser::RoomClient<ColorMatch>;
type ClientEffect = table_browser::Effect<ColorMatch>;
fn guest_client() -> Client {
    let mut client = Client::new();
    client.player = PlayerId(1);
    client.room = Some(room());
    client
}
fn prepare(transfer: u64) -> table_protocol::SignalEvent {
    table_protocol::SignalEvent::HandoffPrepare {
        transfer,
        host: PlayerId(0),
        successor: PlayerId(1),
        round: 4,
        epoch: 0,
    }
}
fn checkpoint_message(transfer: u64) -> String {
    serde_json::json!({"type":"checkpoint", "transfer":transfer, "checkpoint":auth().export_checkpoint(0).unwrap()}).to_string()
}
#[test]
fn lifecycle_stages_checkpoint_in_either_arrival_order() {
    for checkpoint_first in [false, true] {
        let mut client = guest_client();
        let effects = if checkpoint_first {
            assert!(
                client
                    .peer_message(PlayerId(0), &checkpoint_message(1), 0)
                    .unwrap()
                    .is_empty()
            );
            client.signal_event(prepare(1), 0, None).unwrap()
        } else {
            client.signal_event(prepare(1), 0, None).unwrap();
            client
                .peer_message(PlayerId(0), &checkpoint_message(1), 0)
                .unwrap()
        };
        assert!(client.staged.is_some());
        assert!(client.authority.is_none());
        assert!(effects.iter().any(|effect| matches!(
            effect,
            ClientEffect::Signal(table_protocol::SignalCommand::HandoffReady { transfer: 1, .. })
        )));
    }
}
#[test]
fn lifecycle_cancellation_discards_staged_and_stale_transfers() {
    let mut client = guest_client();
    client.signal_event(prepare(1), 0, None).unwrap();
    client
        .peer_message(PlayerId(0), &checkpoint_message(1), 0)
        .unwrap();
    client
        .signal_event(
            table_protocol::SignalEvent::HandoffCancel {
                message: "cancelled".into(),
            },
            0,
            None,
        )
        .unwrap();
    assert!(client.staged.is_none());
    assert!(
        client
            .peer_message(PlayerId(0), &checkpoint_message(1), 0)
            .unwrap()
            .is_empty()
    );
    assert!(client.signal_event(prepare(1), 0, None).unwrap().is_empty());
    client.signal_event(prepare(2), 0, None).unwrap();
    client
        .peer_message(PlayerId(0), &checkpoint_message(1), 0)
        .unwrap();
    assert!(client.staged.is_none());
    client
        .peer_message(PlayerId(0), &checkpoint_message(2), 0)
        .unwrap();
    assert!(client.staged.is_some());
}
#[test]
fn lifecycle_authenticates_checkpoint_sender_and_commits_new_epoch() {
    let mut client = guest_client();
    client.signal_event(prepare(1), 0, None).unwrap();
    client
        .peer_message(PlayerId(2), &checkpoint_message(1), 0)
        .unwrap();
    assert!(client.staged.is_none());
    client
        .peer_message(PlayerId(0), &checkpoint_message(1), 0)
        .unwrap();
    let mut next = room();
    next.host_id = PlayerId(1);
    next.epoch = 1;
    client
        .signal_event(
            table_protocol::SignalEvent::HandoffCommit {
                room: next,
                former_host: PlayerId(0),
            },
            0,
            None,
        )
        .unwrap();
    assert!(client.authority.is_some());
    assert!(client.transfer.is_none());
    let checkpoint = client
        .authority
        .as_ref()
        .unwrap()
        .export_checkpoint(0)
        .unwrap();
    assert_eq!(
        serde_json::from_str::<serde_json::Value>(&checkpoint).unwrap()["epoch"],
        1
    );
    assert!(client.signal_event(prepare(2), 0, None).unwrap().is_empty());
}
#[test]
fn lifecycle_rejects_wrong_recipient_epoch_and_unauthenticated_snapshots() {
    let mut client = guest_client();
    let snapshot = auth().snapshot(PlayerId(1), 0, vec![], None).unwrap();
    let json = serde_json::to_string(&snapshot).unwrap();
    client.peer_message(PlayerId(2), &json, 0).unwrap();
    assert!(client.view.is_none());
    let wrong = auth().snapshot(PlayerId(2), 0, vec![], None).unwrap();
    client
        .peer_message(PlayerId(0), &serde_json::to_string(&wrong).unwrap(), 0)
        .unwrap();
    assert!(client.view.is_none());
    client.peer_message(PlayerId(0), &json, 0).unwrap();
    assert!(client.view.is_some());
    client.network_state(false, 0);
    assert!(client.view.as_ref().unwrap().paused);
    client.peer_message(PlayerId(0), &json, 1).unwrap();
    assert!(!client.view.as_ref().unwrap().paused);
    assert!(client.network);
}

#[test]
fn resumed_host_requests_seed_for_a_round_started_while_disconnected() {
    let mut client = Client::new();
    let mut prior = room();
    prior.round = 3;
    prior.locked = false;
    client.room = Some(prior);
    let event = table_protocol::SignalEvent::Welcome {
        version: PROTOCOL_VERSION,
        player: PlayerId(0),
        credential: "test".into(),
        room: room(),
    };
    assert!(client.needs_seed(&event));
    client.signal_event(event, 0, Some([7; 32])).unwrap();
    assert_eq!(client.authority.unwrap().round(), 4);
}

#[test]
fn resumed_successor_recovers_staged_authority_after_missed_commit_event() {
    let mut client = guest_client();
    client.signal_event(prepare(1), 0, None).unwrap();
    client
        .peer_message(PlayerId(0), &checkpoint_message(1), 0)
        .unwrap();
    client.network_state(false, 1);
    let mut committed = room();
    committed.host_id = PlayerId(1);
    committed.epoch = 1;
    client
        .signal_event(
            table_protocol::SignalEvent::Welcome {
                version: PROTOCOL_VERSION,
                player: PlayerId(1),
                credential: "test".into(),
                room: committed,
            },
            2,
            None,
        )
        .unwrap();
    let snapshot = client
        .authority
        .as_ref()
        .unwrap()
        .snapshot(PlayerId(1), 2, vec![], None)
        .unwrap();
    assert_eq!(snapshot.host_id, PlayerId(1));
    assert_eq!(snapshot.epoch, 1);
    assert!(client.staged.is_none());
    assert!(client.transfer.is_none());
}
