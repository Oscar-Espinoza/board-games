use super::*;
fn create(rooms: &mut HashMap<String, Room>) -> (String, PlayerId, u64, SignalEvent) {
    let (tx, rx) = mpsc::channel(64);
    // Keep the bounded test mailbox open for delivery reservations; tests send fewer than 64 events.
    std::mem::forget(rx);
    admit(
        rooms,
        Hello::Create {
            version: PROTOCOL_VERSION,
            name: "Host".into(),
            avatar: 0,
        },
        tx,
    )
    .unwrap()
}
fn join(
    rooms: &mut HashMap<String, Room>,
    invite: &str,
) -> Result<(String, PlayerId, u64, SignalEvent), String> {
    let (tx, rx) = mpsc::channel(64);
    // Keep the bounded test mailbox open for delivery reservations; tests send fewer than 64 events.
    std::mem::forget(rx);
    admit(
        rooms,
        Hello::Join {
            version: PROTOCOL_VERSION,
            invite: invite.into(),
            name: "Friend".into(),
            avatar: 1,
        },
        tx,
    )
}
#[test]
fn capacity_admissions_and_host_authorization() {
    let mut rooms = HashMap::new();
    let (invite, _, _, _) = create(&mut rooms);
    for _ in 1..8 {
        join(&mut rooms, &invite).unwrap();
    }
    assert!(join(&mut rooms, &invite).is_err());
    let room = rooms.get_mut(&invite).unwrap();
    assert!(command(room, PlayerId(1), SignalCommand::Start).is_err());
    assert!(command(room, PlayerId(0), SignalCommand::AddBot).is_err());
    room.ready = room.seats.iter().map(|s| s.member.id).collect();
    command(room, PlayerId(0), SignalCommand::Start).unwrap();
    assert!(room.locked);
    assert_eq!(room.round, 1);
    assert!(join(&mut rooms, &invite).is_err());
}
#[test]
fn resume_credential_is_separate_and_rotates_connection_binding() {
    let mut rooms = HashMap::new();
    let (invite, _, _, welcome) = create(&mut rooms);
    let SignalEvent::Welcome {
        credential: host_credential,
        ..
    } = welcome
    else {
        panic!()
    };
    let (_, id, old, welcome) = join(&mut rooms, &invite).unwrap();
    let SignalEvent::Welcome { credential, .. } = welcome else {
        panic!()
    };
    assert_ne!(credential, invite);
    assert_ne!(credential, host_credential);
    rooms.get_mut(&invite).unwrap().ready.insert(id);
    command(
        rooms.get_mut(&invite).unwrap(),
        PlayerId(0),
        SignalCommand::Start,
    )
    .unwrap();
    let (tx, _) = mpsc::channel(64);
    assert!(
        admit(
            &mut rooms,
            Hello::Resume {
                version: PROTOCOL_VERSION,
                invite: invite.clone(),
                credential: invite.clone()
            },
            tx
        )
        .is_err()
    );
    let (tx, _) = mpsc::channel(64);
    let (_, new_id, generation, _) = admit(
        &mut rooms,
        Hello::Resume {
            version: PROTOCOL_VERSION,
            invite: invite.clone(),
            credential,
        },
        tx,
    )
    .unwrap();
    assert_eq!(new_id, id);
    assert!(generation > old);
    let json = serde_json::to_string(&rooms[&invite].view()).unwrap();
    assert!(!json.contains(&host_credential));
}
#[test]
fn star_binding_bots_and_expiration() {
    let mut rooms = HashMap::new();
    let (invite, _, _, _) = create(&mut rooms);
    join(&mut rooms, &invite).unwrap();
    join(&mut rooms, &invite).unwrap();
    let room = rooms.get_mut(&invite).unwrap();
    assert!(
        command(
            room,
            PlayerId(1),
            SignalCommand::Signal {
                epoch: 0,
                to: PlayerId(2),
                data: serde_json::json!({})
            }
        )
        .is_err()
    );
    assert!(
        command(
            room,
            PlayerId(1),
            SignalCommand::RemoveBot {
                player: PlayerId(0)
            }
        )
        .is_err()
    );
    command(room, PlayerId(0), SignalCommand::AddBot).unwrap();
    assert_eq!(room.seats.len(), 4);
    command(
        room,
        PlayerId(0),
        SignalCommand::RemoveBot {
            player: PlayerId(3),
        },
    )
    .unwrap();
    assert_eq!(room.seats.len(), 3);
    room.host_lost = Some(Instant::now() - Duration::from_secs(121));
    assert!(room.expired());
    assert!(join(&mut rooms, &invite).is_err());
}

#[test]
fn room_size_two_humans_and_active_round_guard() {
    let mut rooms = HashMap::new();
    let (invite, host, _, _) = create(&mut rooms);
    let room = rooms.get_mut(&invite).unwrap();
    for capacity in [0, 1, 9, 255] {
        assert!(command(room, host, SignalCommand::Capacity { capacity }).is_err());
    }
    command(room, host, SignalCommand::Capacity { capacity: 2 }).unwrap();
    command(room, host, SignalCommand::AddBot).unwrap();
    assert!(command(room, host, SignalCommand::Start).is_err());
    assert!(join(&mut rooms, &invite).is_err());
    let room = rooms.get_mut(&invite).unwrap();
    command(
        room,
        host,
        SignalCommand::RemoveBot {
            player: PlayerId(1),
        },
    )
    .unwrap();
    let (_, guest, _, _) = join(&mut rooms, &invite).unwrap();
    assert!(join(&mut rooms, &invite).is_err());
    let room = rooms.get_mut(&invite).unwrap();
    assert!(command(room, guest, SignalCommand::Capacity { capacity: 8 }).is_err());
    assert!(command(room, host, SignalCommand::Start).is_err());
    command(
        room,
        host,
        SignalCommand::Ready {
            player: guest,
            ready: true,
        },
    )
    .unwrap();
    command(room, host, SignalCommand::Capacity { capacity: 8 }).unwrap();
    command(room, host, SignalCommand::AddBot).unwrap();
    assert!(command(room, host, SignalCommand::Capacity { capacity: 2 }).is_err());
    command(room, host, SignalCommand::Start).unwrap();
    assert!(command(room, host, SignalCommand::Start).is_err());
    assert!(command(room, host, SignalCommand::Capacity { capacity: 4 }).is_err());
    command(
        room,
        host,
        SignalCommand::RoundFinished { round: 1, epoch: 0 },
    )
    .unwrap();
    command(room, guest, SignalCommand::Leave).unwrap();
    assert!(command(room, host, SignalCommand::Start).is_err());
}
#[test]
fn lobby_departure_promotes_join_order_and_frees_seats() {
    let mut rooms = HashMap::new();
    let (invite, host, _, _) = create(&mut rooms);
    join(&mut rooms, &invite).unwrap();
    join(&mut rooms, &invite).unwrap();
    let room = rooms.get_mut(&invite).unwrap();
    command(room, host, SignalCommand::Leave).unwrap();
    assert_eq!(room.host_id, PlayerId(1));
    assert_eq!(room.epoch, 1);
    assert_eq!(room.seats.len(), 2);
    assert!(command(room, host, SignalCommand::AddBot).is_err());
    command(room, PlayerId(1), SignalCommand::AddBot).unwrap();
    command(room, PlayerId(1), SignalCommand::Leave).unwrap();
    assert_eq!(room.host_id, PlayerId(2));
    command(room, PlayerId(2), SignalCommand::Leave).unwrap();
    assert!(room.closed);
}
#[test]
fn handoff_binding_timeout_retry_commit_and_former_host_resume() {
    let mut rooms = HashMap::new();
    let (invite, host, _, welcome) = create(&mut rooms);
    let SignalEvent::Welcome { credential, .. } = welcome else {
        panic!()
    };
    join(&mut rooms, &invite).unwrap();
    join(&mut rooms, &invite).unwrap();
    let room = rooms.get_mut(&invite).unwrap();
    room.ready.extend([PlayerId(1), PlayerId(2)]);
    command(room, host, SignalCommand::Start).unwrap();
    assert!(command(room, host, SignalCommand::Leave).is_err());
    assert!(
        command(
            room,
            host,
            SignalCommand::HandoffPrepare {
                successor: PlayerId(2),
                round: 1,
                epoch: 0
            }
        )
        .is_err()
    );
    command(
        room,
        host,
        SignalCommand::HandoffPrepare {
            successor: PlayerId(1),
            round: 1,
            epoch: 0,
        },
    )
    .unwrap();
    assert!(
        command(
            room,
            PlayerId(2),
            SignalCommand::HandoffReady {
                round: 1,
                epoch: 0,
                transfer: 1
            }
        )
        .is_err()
    );
    assert!(
        command(
            room,
            host,
            SignalCommand::HandoffCommit {
                round: 1,
                epoch: 0,
                transfer: 1
            }
        )
        .is_err()
    );
    room.handoff.as_mut().unwrap().started = Instant::now() - Duration::from_secs(16);
    room.expire_handoff();
    assert_eq!(room.host_id, host);
    assert!(room.seats[0].member.connected);
    command(
        room,
        host,
        SignalCommand::HandoffPrepare {
            successor: PlayerId(1),
            round: 1,
            epoch: 0,
        },
    )
    .unwrap();
    assert!(
        command(
            room,
            PlayerId(1),
            SignalCommand::HandoffReady {
                round: 1,
                epoch: 0,
                transfer: 1
            }
        )
        .is_err()
    );
    command(
        room,
        PlayerId(1),
        SignalCommand::HandoffReady {
            round: 1,
            epoch: 0,
            transfer: 2,
        },
    )
    .unwrap();
    command(
        room,
        host,
        SignalCommand::HandoffCommit {
            round: 1,
            epoch: 0,
            transfer: 2,
        },
    )
    .unwrap();
    assert_eq!(room.host_id, PlayerId(1));
    assert_eq!(room.epoch, 1);
    assert_eq!(room.seats.len(), 3);
    assert!(!room.seats[0].member.connected);
    assert!(
        command(
            room,
            host,
            SignalCommand::HandoffCommit {
                round: 1,
                epoch: 0,
                transfer: 2
            }
        )
        .is_err()
    );
    let (tx, _) = mpsc::channel(64);
    let (_, resumed, _, _) = admit(
        &mut rooms,
        Hello::Resume {
            version: PROTOCOL_VERSION,
            invite: invite.clone(),
            credential,
        },
        tx,
    )
    .unwrap();
    assert_eq!(resumed, host);
    assert_eq!(rooms[&invite].host_id, PlayerId(1));
    let room = rooms.get_mut(&invite).unwrap();
    assert!(
        command(
            room,
            PlayerId(0),
            SignalCommand::Signal {
                epoch: 0,
                to: PlayerId(1),
                data: serde_json::json!({})
            }
        )
        .is_err()
    );
    command(room, PlayerId(0), SignalCommand::Leave).unwrap();
    command(room, PlayerId(2), SignalCommand::Leave).unwrap();
    command(room, PlayerId(1), SignalCommand::Leave).unwrap();
    assert!(room.closed);
}

#[tokio::test]
async fn simultaneous_admissions_share_capacity_with_bots() {
    let mut rooms = HashMap::new();
    let (invite, host, _, _) = create(&mut rooms);
    command(
        rooms.get_mut(&invite).unwrap(),
        host,
        SignalCommand::Capacity { capacity: 4 },
    )
    .unwrap();
    let rooms = Arc::new(Mutex::new(rooms));
    let mut attempts = Vec::new();
    for i in 0..16 {
        let rooms = rooms.clone();
        let invite = invite.clone();
        attempts.push(tokio::spawn(async move {
            let mut rooms = rooms.lock().await;
            if i % 2 == 0 {
                command(rooms.get_mut(&invite).unwrap(), host, SignalCommand::AddBot).is_ok()
            } else {
                join(&mut rooms, &invite).is_ok()
            }
        }));
    }
    let mut accepted = 0;
    for attempt in attempts {
        accepted += usize::from(attempt.await.unwrap());
    }
    assert_eq!(accepted, 3);
    let rooms = rooms.lock().await;
    assert_eq!(rooms[&invite].seats.len(), 4);
    assert_eq!(
        rooms[&invite]
            .seats
            .iter()
            .map(|s| s.member.id)
            .collect::<std::collections::BTreeSet<_>>()
            .len(),
        4
    );
}

#[test]
fn delayed_readiness_clear_after_lobby_departure_is_harmless() {
    let mut rooms = HashMap::new();
    let (invite, host, _, _) = create(&mut rooms);
    let (_, guest, _, _) = join(&mut rooms, &invite).unwrap();
    let room = rooms.get_mut(&invite).unwrap();
    command(
        room,
        host,
        SignalCommand::Ready {
            player: guest,
            ready: true,
        },
    )
    .unwrap();
    command(room, guest, SignalCommand::Leave).unwrap();
    assert!(!room.ready.contains(&guest));
    command(
        room,
        host,
        SignalCommand::Ready {
            player: guest,
            ready: false,
        },
    )
    .unwrap();
    assert!(
        command(
            room,
            host,
            SignalCommand::Ready {
                player: guest,
                ready: true
            }
        )
        .is_err()
    );
    assert!(
        command(
            room,
            guest,
            SignalCommand::Ready {
                player: guest,
                ready: false
            }
        )
        .is_err()
    );
    command(room, host, SignalCommand::AddBot).unwrap();
    assert!(
        room.seats
            .iter()
            .any(|s| s.member.id == guest && s.member.bot)
    );
    command(
        room,
        host,
        SignalCommand::Ready {
            player: guest,
            ready: false,
        },
    )
    .unwrap();
    assert!(
        command(
            room,
            host,
            SignalCommand::Ready {
                player: guest,
                ready: true
            }
        )
        .is_err()
    );
    assert!(room.ready.is_empty());
}
