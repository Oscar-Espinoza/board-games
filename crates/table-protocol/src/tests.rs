use super::*;
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
    Authority::new([7; 32], 4, members()).unwrap()
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
#[test]
fn live_host_deadline_and_round_reset() {
    let mut a = auth();
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
    let mut fresh = Authority::new([8; 32], 5, members()).unwrap();
    assert_eq!(
        fresh.accept(PlayerId(0), envelope(1, 0)).0.status,
        AckStatus::Stale
    );
}

fn room() -> RoomView {
    RoomView {
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
