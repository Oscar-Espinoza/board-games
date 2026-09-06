use super::*;
fn config(n: u8) -> GameConfig {
    GameConfig {
        players: (0..n).map(PlayerId).collect(),
    }
}
fn game(n: u8) -> Game {
    Game::new([7; 32], config(n)).unwrap()
}
fn rig(hands: &[&[u8]], top: u8) -> Game {
    let mut g = game(hands.len() as u8);
    let cards = deck();
    g.hands = hands
        .iter()
        .map(|h| h.iter().map(|id| cards[*id as usize]).collect())
        .collect();
    g.discards = vec![cards[top as usize]];
    g.stock = cards
        .into_iter()
        .filter(|c| c.id != top && !hands.iter().any(|h| h.contains(&c.id)))
        .collect();
    g.active_color = g.top().color().unwrap_or(Color::Red);
    g
}
fn play(g: &mut Game, p: u8, id: u8, uno: bool) {
    g.apply(PlayerId(p), Action::Play { card_id: id, uno })
        .unwrap();
}
fn view(g: &Game, p: u8) -> PlayerView {
    g.view_for(PlayerId(p)).unwrap()
}
fn conserved(g: &Game) {
    let mut ids = g
        .hands
        .iter()
        .flatten()
        .chain(&g.stock)
        .chain(&g.discards)
        .map(|c| c.id)
        .collect::<Vec<_>>();
    ids.sort();
    assert_eq!(ids, (0..108).collect::<Vec<_>>());
}
fn unchanged(g: &Game, action: Action, p: PlayerId) {
    let mut a = g.clone();
    let mut b = g.clone();
    assert!(a.apply(p, action).is_err());
    for player in &g.players {
        assert_eq!(a.view_for(*player), b.view_for(*player));
    }
    assert_eq!(a.stock, b.stock);
    assert_eq!(a.discards, b.discards);
    assert_eq!(a.rng.next_u64(), b.rng.next_u64());
}
#[test]
fn roster_deal_and_deck() {
    assert_eq!(deck().len(), 108);
    assert_eq!(
        deck()
            .iter()
            .filter(|c| matches!(c.face, Face::Number { .. }))
            .count(),
        76
    );
    for n in 2..=8 {
        for seed in 0..100 {
            let g = Game::new([seed; 32], config(n)).unwrap();
            assert!(g.hands.iter().all(|h| h.len() == 7));
            assert_eq!(g.stock.len(), 107 - 7 * n as usize);
            assert!(matches!(g.top().face, Face::Number { .. }));
            conserved(&g);
        }
    }
    for n in [0, 1, 9] {
        assert!(Game::new([0; 32], config(n)).is_err());
    }
    assert!(
        Game::new(
            [0; 32],
            GameConfig {
                players: vec![PlayerId(3); 2]
            }
        )
        .is_err()
    );
    let g = Game::new(
        [7; 32],
        GameConfig {
            players: vec![PlayerId(42), PlayerId(9)],
        },
    )
    .unwrap();
    assert_eq!(g.phase.actor(), Some(PlayerId(42)));
    assert!(g.view_for(PlayerId(0)).is_err());
}
#[test]
fn skip_reverse_and_order() {
    let mut g = rig(&[&[19, 1], &[27], &[52], &[77]], 0);
    play(&mut g, 0, 19, false);
    assert_eq!(g.phase.actor(), Some(PlayerId(2)));
    let mut g = rig(&[&[21, 1], &[27], &[52], &[77]], 0);
    play(&mut g, 0, 21, false);
    assert_eq!(g.direction, Direction::Counterclockwise);
    assert_eq!(g.phase.actor(), Some(PlayerId(3)));
    g.apply(PlayerId(3), Action::Draw {}).unwrap();
    assert_eq!(g.phase.actor(), Some(PlayerId(2)));
    for id in [19, 21] {
        let mut g = rig(&[&[id, 1], &[27]], 0);
        play(&mut g, 0, id, false);
        assert_eq!(g.phase.actor(), Some(PlayerId(0)));
    }
}
#[test]
fn all_stack_combinations() {
    for first in [23, 104] {
        for reply in [48, 105, 100, 25, 44, 46] {
            let mut g = rig(&[&[first, 1], &[reply, 27], &[52]], 0);
            play(&mut g, 0, first, true);
            if first == 104 {
                g.apply(PlayerId(0), Action::ChooseColor { color: Color::Blue })
                    .unwrap();
            }
            let allowed = reply == 105 || (first == 23 && reply == 48);
            let before = g.clone();
            let result = g.apply(
                PlayerId(1),
                Action::Play {
                    card_id: reply,
                    uno: false,
                },
            );
            assert_eq!(result.is_ok(), allowed, "{first} -> {reply}");
            if allowed {
                if reply == 105 {
                    g.apply(
                        PlayerId(1),
                        Action::ChooseColor {
                            color: Color::Green,
                        },
                    )
                    .unwrap();
                }
                let amount = if first == 23 { 2 } else { 4 } + if reply == 48 { 2 } else { 4 };
                assert_eq!(g.penalty.unwrap().amount, amount);
                let n = g.hands[2].len();
                g.apply(PlayerId(2), Action::Draw {}).unwrap();
                assert_eq!(g.hands[2].len(), n + amount);
                assert!(g.penalty.is_none());
                assert_eq!(g.phase.actor(), Some(PlayerId(0)));
                conserved(&g);
            } else {
                assert_eq!(view(&g, 1), view(&before, 1));
            }
        }
    }
}
#[test]
fn matching_optional_draw_and_wild() {
    let mut g = rig(&[&[1, 27, 44, 100, 104], &[2]], 0);
    assert!(view(&g, 0).legal_actions.contains(&Action::Play {
        card_id: 1,
        uno: false
    }));
    unchanged(
        &g,
        Action::Play {
            card_id: 27,
            uno: false,
        },
        PlayerId(0),
    );
    let n = g.hands[0].len();
    g.apply(PlayerId(0), Action::Draw {}).unwrap();
    assert_eq!(g.hands[0].len(), n + 1);
    assert_eq!(g.phase.actor(), Some(PlayerId(1)));
    for id in [100, 104] {
        let mut g = rig(&[&[id, 1], &[2]], 25);
        play(&mut g, 0, id, false);
        assert!(matches!(g.phase, Phase::ChoosingColor { .. }));
        unchanged(&g, Action::Draw {}, PlayerId(0));
        unchanged(&g, Action::ChooseColor { color: Color::Red }, PlayerId(1));
        g.apply(PlayerId(0), Action::ChooseColor { color: Color::Blue })
            .unwrap();
        assert_eq!(g.active_color, Color::Blue);
    }
}
#[test]
fn final_cards_end_stacks_and_wilds_wait() {
    for id in [1, 19, 21, 23, 100, 104] {
        let mut g = rig(&[&[id], &[2]], 0);
        play(&mut g, 0, id, false);
        if id >= 100 {
            assert!(matches!(g.phase, Phase::ChoosingColor { .. }));
            g.apply(PlayerId(0), Action::ChooseColor { color: Color::Red })
                .unwrap();
        }
        assert_eq!(
            g.phase,
            Phase::Finished {
                outcome: Outcome::Win {
                    player: PlayerId(0)
                }
            }
        );
        assert!(g.penalty.is_none());
        assert!(g.catchable.is_none());
        unchanged(&g, Action::Draw {}, PlayerId(1));
    }
}
#[test]
fn uno_atomic_declaration_and_catch_races() {
    let mut g = rig(&[&[1, 3], &[2, 4], &[26]], 0);
    play(&mut g, 0, 1, false);
    assert_eq!(g.catchable, Some(PlayerId(0)));
    unchanged(
        &g,
        Action::CatchUno {
            player: PlayerId(0),
        },
        PlayerId(0),
    );
    unchanged(
        &g,
        Action::Play {
            card_id: 26,
            uno: false,
        },
        PlayerId(2),
    );
    assert!(g.catchable.is_some());
    let actor = g.phase;
    g.apply(
        PlayerId(2),
        Action::CatchUno {
            player: PlayerId(0),
        },
    )
    .unwrap();
    assert_eq!(g.hands[0].len(), 3);
    assert_eq!(g.phase, actor);
    unchanged(
        &g,
        Action::CatchUno {
            player: PlayerId(0),
        },
        PlayerId(1),
    );
    let mut g = rig(&[&[1, 3], &[2, 4]], 0);
    let events = g
        .apply(
            PlayerId(0),
            Action::Play {
                card_id: 1,
                uno: true,
            },
        )
        .unwrap();
    assert!(events.contains(&PublicEvent::Uno {
        player: PlayerId(0)
    }));
    assert!(g.catchable.is_none());
    for next_draw in [true, false] {
        let mut g = rig(&[&[1, 3], &[2, 4]], 0);
        play(&mut g, 0, 1, false);
        if next_draw {
            g.apply(PlayerId(1), Action::Draw {}).unwrap();
        } else {
            play(&mut g, 1, 2, true);
        }
        assert!(g.catchable.is_none());
    }
}
#[test]
fn wild_uno_opens_only_after_color() {
    for declare in [false, true] {
        let mut g = rig(&[&[100, 1], &[2, 4]], 0);
        play(&mut g, 0, 100, declare);
        assert!(g.catchable.is_none());
        g.apply(PlayerId(0), Action::ChooseColor { color: Color::Red })
            .unwrap();
        assert_eq!(g.catchable, (!declare).then_some(PlayerId(0)));
    }
}
#[test]
fn recycling_exhaustion_and_rotation() {
    let mut g = rig(&[&[1], &[2]], 0);
    g.discards.append(&mut g.stock);
    let top = g.top();
    g.apply(PlayerId(0), Action::Draw {}).unwrap();
    assert_eq!(g.top(), top);
    assert_eq!(g.discards.len(), 1);
    conserved(&g);
    let mut g = game(8);
    for card in g.stock.drain(..) {
        g.hands[0].push(card);
    }
    for i in 0..8 {
        g.apply(PlayerId(i), Action::Draw {}).unwrap();
    }
    assert_eq!(
        g.phase,
        Phase::Finished {
            outcome: Outcome::Draw
        }
    );
    conserved(&g);
    let mut g = rig(&[&[23, 1], &[2], &[3]], 0);
    let remainder = g.stock.split_off(1);
    g.hands[2].extend(remainder);
    play(&mut g, 0, 23, true);
    g.penalty = Some(Penalty {
        amount: 50,
        kind: 2,
    });
    let events = g.apply(PlayerId(1), Action::Draw {}).unwrap();
    assert!(events.contains(&PublicEvent::Drew {
        player: PlayerId(1),
        count: 2
    }));
    assert!(g.penalty.is_none());
    conserved(&g);
}
#[test]
fn bot_uses_projection_and_is_deterministic() {
    for n in 2..=8 {
        for seed in 0..20 {
            let mut a = Game::new([seed; 32], config(n)).unwrap();
            let mut b = a.clone();
            for _ in 0..4000 {
                let Some(player) = a.phase.actor() else {
                    break;
                };
                let v = view(&a, player.0);
                let action = bot_action(&v).unwrap();
                assert_eq!(Some(action), bot_action(&view(&b, player.0)));
                assert!(v.legal_actions.contains(&action));
                a.apply(player, action).unwrap();
                b.apply(player, action).unwrap();
                conserved(&a);
                assert_eq!(view(&a, 0), view(&b, 0));
            }
            assert!(a.phase.actor().is_none());
        }
    }
    let mut g = rig(&[&[1, 3], &[2, 4]], 0);
    play(&mut g, 0, 1, false);
    assert_eq!(
        bot_action(&view(&g, 1)),
        Some(Action::CatchUno {
            player: PlayerId(0)
        })
    );
}
#[test]
fn rejection_never_mutates_state_or_rng_and_views_are_private() {
    let g = game(8);
    unchanged(&g, Action::Draw {}, PlayerId(99));
    unchanged(&g, Action::Draw {}, PlayerId(1));
    unchanged(&g, Action::ChooseColor { color: Color::Red }, PlayerId(0));
    unchanged(
        &g,
        Action::Play {
            card_id: g.hands[1][0].id,
            uno: false,
        },
        PlayerId(0),
    );
    unchanged(
        &g,
        Action::Play {
            card_id: g.hands[0][0].id,
            uno: true,
        },
        PlayerId(0),
    );
    let value = serde_json::to_value(view(&g, 1)).unwrap();
    for key in ["seed", "stock", "hands", "rng"] {
        assert!(value.get(key).is_none());
    }
    assert_eq!(value["hand"].as_array().unwrap().len(), 7);
    assert_eq!(value["players"].as_array().unwrap().len(), 8);
}
#[test]
fn replay_rejects_v1() {
    let input = Replay {
        version: 1,
        seed: [0; 32],
        config: config(2),
        actions: vec![],
    };
    assert!(
        replay(&input)
            .unwrap_err()
            .contains("unsupported replay version")
    );
}

#[test]
fn checkpoint_continuation_at_every_replay_action() {
    for input in [
        include_str!("../../../tests/fixtures/v2/seed-07.replay.json"),
        include_str!("../../../tests/fixtures/v2/seed-19.replay.json"),
        include_str!("../../../tests/fixtures/v2/recycle.replay.json"),
        include_str!("../../../tests/fixtures/v2/eight.replay.json"),
    ] {
        let replay: Replay = serde_json::from_str(input).unwrap();
        let mut game = Game::new(replay.seed, replay.config.clone()).unwrap();
        for step in replay.actions {
            let checkpoint = game.export_checkpoint().unwrap();
            let mut restored = Game::import_checkpoint(&checkpoint).unwrap();
            assert_eq!(
                game.apply(step.player, step.action),
                restored.apply(step.player, step.action)
            );
            assert_eq!(
                game.export_checkpoint().unwrap(),
                restored.export_checkpoint().unwrap()
            );
        }
    }
    let game = Game::new(
        [7; 32],
        GameConfig {
            players: vec![PlayerId(0), PlayerId(1)],
        },
    )
    .unwrap();
    let mut value: serde_json::Value =
        serde_json::from_str(&game.export_checkpoint().unwrap()).unwrap();
    value["hands"][0][0] = value["hands"][1][0].clone();
    assert!(Game::import_checkpoint(&value.to_string()).is_err());
}

#[test]
fn checkpoint_continues_missed_uno_and_catch_windows() {
    let mut catches = 0;
    for seed in 0..10 {
        let mut game = Game::new(
            [seed; 32],
            GameConfig {
                players: vec![PlayerId(0), PlayerId(1), PlayerId(2)],
            },
        )
        .unwrap();
        for _ in 0..1000 {
            let Some(player) = game.phase.actor() else {
                break;
            };
            let Some(mut action) = bot_action(&game.view_for(player).unwrap()) else {
                break;
            };
            if let Action::Play { uno, .. } = &mut action {
                *uno = false;
            }
            if matches!(action, Action::CatchUno { .. }) {
                catches += 1;
            }
            let mut restored = Game::import_checkpoint(&game.export_checkpoint().unwrap()).unwrap();
            assert_eq!(game.apply(player, action), restored.apply(player, action));
            assert_eq!(
                game.export_checkpoint().unwrap(),
                restored.export_checkpoint().unwrap()
            );
        }
    }
    assert!(catches > 0);
}
