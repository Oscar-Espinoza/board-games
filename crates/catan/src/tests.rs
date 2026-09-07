use super::*;
fn game(n: u8, setup: Setup) -> Game {
    Game::new(
        [19; 32],
        GameConfig {
            players: (0..n).map(PlayerId).collect(),
            setup,
        },
    )
    .unwrap()
}
fn finish_setup(g: &mut Game) {
    while matches!(g.phase(), Phase::Setup { .. }) {
        let p = g.phase().actor().unwrap();
        let a = g.legal_actions(p).into_iter().next().unwrap();
        g.apply(p, a).unwrap();
    }
}
#[test]
fn topology_and_setups() {
    for n in 3..=6 {
        for setup in [Setup::Variable, Setup::Beginner] {
            let mut g = game(n, setup);
            let b = &g.state.board;
            assert_eq!(b.hexes.len(), if n > 4 { 30 } else { 19 });
            assert_eq!(b.vertices.len(), if n > 4 { 80 } else { 54 });
            assert_eq!(b.edges.len(), if n > 4 { 109 } else { 72 });
            assert_eq!(b.spiral().len(), b.hexes.len());
            for p in &b.ports {
                let e = b.edges[p.edge as usize];
                assert_eq!(
                    b.hexes
                        .iter()
                        .filter(|h| e.iter().all(|v| h.vertices.contains(v)))
                        .count(),
                    1,
                    "port edge must face sea: {p:?}"
                );
            }
            finish_setup(&mut g);
            for p in g.players() {
                let v = g.view_for(p).unwrap();
                assert_eq!(v.players.iter().find(|x| x.id == p).unwrap().points, 2);
                assert_eq!(g.inventory(p), (13, 3, 4));
                assert!(total(&v.hand) > 0);
            }
            assert_eq!(
                g.state
                    .buildings
                    .iter()
                    .flatten()
                    .filter(|b| b.owner.is_none())
                    .count(),
                if n == 5 && setup == Setup::Beginner {
                    2
                } else {
                    0
                }
            );
            let checkpoint = g.export_checkpoint().unwrap();
            assert!(checkpoint.len() < 20_000);
            assert_eq!(
                Game::import_checkpoint(&checkpoint)
                    .unwrap()
                    .export_checkpoint()
                    .unwrap(),
                checkpoint
            );
        }
    }
}
#[test]
fn beginner_resources_match_published_cards() {
    let g = game(4, Setup::Beginner);
    assert_eq!(
        g.state.hands,
        vec![
            [1, 1, 1, 0, 0],
            [0, 0, 1, 1, 1],
            [0, 0, 1, 2, 0],
            [0, 1, 1, 1, 0]
        ]
    );
    let g = game(6, Setup::Beginner);
    assert_eq!(
        g.state.hands,
        vec![
            [0, 1, 1, 0, 1],
            [0, 1, 0, 1, 1],
            [1, 0, 1, 0, 1],
            [0, 1, 1, 0, 1],
            [1, 0, 1, 0, 1],
            [1, 1, 0, 1, 0]
        ]
    );
}
#[test]
fn rejected_actions_do_not_mutate_rng_or_state() {
    let mut g = game(4, Setup::Beginner);
    let before = g.export_checkpoint().unwrap();
    assert!(g.apply(PlayerId(99), Action::Roll).is_err());
    assert!(g.apply(g.active(), Action::City { vertex: 255 }).is_err());
    assert!(
        g.apply(
            g.active(),
            Action::Offer {
                give: [255; 5],
                take: [255; 5],
                to: None
            }
        )
        .is_err()
    );
    assert_eq!(g.export_checkpoint().unwrap(), before);
}
#[test]
fn paired_opportunities_rotate_and_checkpoint_continue() {
    for n in [5, 6] {
        let mut g = game(n, Setup::Beginner);
        let first = g.state.primary;
        for _ in 0..12 {
            let p = g.active();
            let mut restored = Game::import_checkpoint(&g.export_checkpoint().unwrap()).unwrap();
            if let Phase::Turn {
                stage: Stage::Production,
                ..
            } = g.phase()
            {
                let a = Action::Roll;
                let events = g.apply(p, a.clone()).unwrap();
                assert_eq!(events, restored.apply(p, a).unwrap());
                while !matches!(g.phase(), Phase::Turn { .. }) {
                    let p = g.phase().actor().unwrap_or_else(|| {
                        if let Phase::Discard { pending } = &g.state.phase {
                            pending[0].0
                        } else {
                            panic!()
                        }
                    });
                    let a = if let Phase::Discard { pending } = &g.state.phase {
                        let count = pending.iter().find(|(id, _)| *id == p).unwrap().1;
                        let mut left = count;
                        let mut r = [0; 5];
                        for (j, v) in r.iter_mut().enumerate() {
                            *v = left.min(g.view_for(p).unwrap().hand[j]);
                            left -= *v;
                        }
                        Action::Discard { resources: r }
                    } else {
                        g.legal_actions(p)[0].clone()
                    };
                    g.apply(p, a).unwrap();
                }
            }
            g.apply(g.active(), Action::EndTurn).unwrap();
        }
        assert_eq!(g.state.primary, (first + 6) % usize::from(n));
    }
}
#[test]
fn route_search_handles_loop_branch_and_opponent_cut() {
    let mut g = game(3, Setup::Beginner);
    g.state.roads.fill(None);
    g.state.buildings.fill(None);
    let p = PlayerId(0);
    let h = 9;
    let corners = g.state.board.hexes[h].vertices;
    for c in 0..6 {
        let edge = g.state.board.hex_edge(h, c);
        g.state.roads[edge as usize] = Some(p);
    }
    assert_eq!(g.longest_route(p), 6);
    let branch = g
        .state
        .board
        .incident(corners[0])
        .find(|(e, _)| g.state.roads[*e].is_none())
        .unwrap()
        .0;
    g.state.roads[branch] = Some(p);
    assert_eq!(g.longest_route(p), 7);
    g.state.buildings[corners[0] as usize] = Some(Building {
        owner: Some(PlayerId(1)),
        color: 1,
        city: false,
    });
    assert_eq!(g.longest_route(p), 6);
}
#[test]
fn recipient_events_hide_theft_and_snapshots_hide_deck() {
    let g = game(4, Setup::Beginner);
    let events = vec![Event::Theft {
        thief: PlayerId(0),
        victim: PlayerId(1),
        resource: Some(Resource::Ore),
    }];
    assert_eq!(g.events_for(PlayerId(0), events.clone()), events);
    assert!(matches!(
        g.events_for(PlayerId(2), events)[0],
        Event::Theft { resource: None, .. }
    ));
    let view = serde_json::to_value(g.view_for(PlayerId(0)).unwrap()).unwrap();
    for key in ["rng", "hands", "deck", "config"] {
        assert!(view.get(key).is_none());
    }
}
fn actions_for(g: &mut Game, p: PlayerId) {
    g.state.primary = g.index(p).unwrap();
    g.state.paired = false;
    g.state.phase = Phase::Turn {
        player: p,
        stage: Stage::Actions,
    };
}
fn grant(g: &mut Game, p: PlayerId, r: Resources) {
    let i = g.index(p).unwrap();
    for (k, n) in r.iter().enumerate() {
        g.state.bank[k] += g.state.hands[i][k];
        g.state.hands[i][k] = *n;
        g.state.bank[k] -= n;
    }
}
fn development(g: &mut Game, p: PlayerId, kind: Development, bought: u64) {
    let at = g.state.deck.iter().position(|c| *c == kind).unwrap();
    g.state.deck.remove(at);
    let i = g.index(p).unwrap();
    g.state.development[i].push(DevelopmentCard { kind, bought });
}
#[test]
fn construction_costs_city_returns_and_distance() {
    let mut g = game(4, Setup::Beginner);
    let p = g.active();
    actions_for(&mut g, p);
    grant(&mut g, p, [4, 3, 5, 4, 4]);
    let vertex = g
        .legal_actions(p)
        .iter()
        .find_map(|a| {
            if let Action::City { vertex } = a {
                Some(*vertex)
            } else {
                None
            }
        })
        .unwrap();
    let before = g.view_for(p).unwrap().hand;
    g.apply(p, Action::City { vertex }).unwrap();
    assert_eq!(g.inventory(p), (13, 4, 3));
    let after = g.view_for(p).unwrap().hand;
    assert_eq!(
        after,
        [
            before[0],
            before[1],
            before[2] - 2,
            before[3],
            before[4] - 3
        ]
    );
    let road = g
        .legal_actions(p)
        .iter()
        .find(|a| matches!(a, Action::Road { .. }))
        .unwrap()
        .clone();
    g.apply(p, road).unwrap();
    assert_eq!(g.inventory(p).0, 12);
    assert!(!g.distance(vertex));
    for (_, e) in g.state.board.incident(vertex) {
        assert!(!g.distance(e[0]));
        assert!(!g.distance(e[1]));
    }
    g.validate_checkpoint().unwrap();
}
#[test]
fn shortages_are_per_resource_and_sole_recipient_gets_remainder() {
    let mut g = game(3, Setup::Beginner);
    g.state.buildings.fill(None);
    let p = PlayerId(0);
    let tile = g
        .state
        .board
        .hexes
        .iter()
        .position(|h| h.resource == Some(Resource::Wheat))
        .unwrap();
    let h = g.state.board.hexes[tile].clone();
    g.state.buildings[h.vertices[0] as usize] = Some(Building {
        owner: Some(p),
        color: 0,
        city: true,
    });
    g.state.hands.iter_mut().for_each(|h| h[2] = 0);
    g.state.hands[2][2] = 18;
    g.state.bank[2] = 1;
    let before = g.state.hands[0][2];
    g.produce(h.number);
    assert_eq!(g.state.hands[0][2], before + 1);
    assert_eq!(g.state.bank[2], 0);
    g.state.bank[2] = 1;
    g.state.hands[2][2] = 17;
    g.state.buildings[h.vertices[2] as usize] = Some(Building {
        owner: Some(PlayerId(1)),
        color: 1,
        city: false,
    });
    let before = g.state.hands.clone();
    g.produce(h.number);
    assert_eq!(g.state.hands, before);
    g.state.robber = tile as u8;
    g.state.bank[2] = 5;
    g.produce(h.number);
    assert_eq!(g.state.hands, before);
}
#[test]
fn seven_discards_are_private_independent_and_block_trading() {
    let mut g = game(3, Setup::Beginner);
    let p = g.active();
    grant(&mut g, PlayerId(0), [8, 0, 0, 0, 0]);
    grant(&mut g, PlayerId(1), [0, 9, 0, 0, 0]);
    g.state.phase = Phase::Discard {
        pending: vec![(PlayerId(0), 4), (PlayerId(1), 4)],
    };
    assert!(
        g.apply(
            p,
            Action::Offer {
                give: [1, 0, 0, 0, 0],
                take: [0, 1, 0, 0, 0],
                to: None
            }
        )
        .is_err()
    );
    let before = g.export_checkpoint().unwrap();
    assert!(
        g.apply(
            PlayerId(0),
            Action::Discard {
                resources: [3, 0, 0, 0, 0]
            }
        )
        .is_err()
    );
    assert_eq!(before, g.export_checkpoint().unwrap());
    g.apply(
        PlayerId(1),
        Action::Discard {
            resources: [0, 4, 0, 0, 0],
        },
    )
    .unwrap();
    assert!(matches!(g.phase(),Phase::Discard{pending}if pending.len()==1));
    let json = g.export_checkpoint().unwrap();
    g = Game::import_checkpoint(&json).unwrap();
    g.apply(
        PlayerId(0),
        Action::Discard {
            resources: [4, 0, 0, 0, 0],
        },
    )
    .unwrap();
    assert!(matches!(g.phase(),Phase::Robber{player,..}if player==p));
    assert_eq!(g.view_for(PlayerId(1)).unwrap().hand[1], 5);
}
#[test]
fn knight_preserves_preroll_phase_and_only_one_card_per_opportunity() {
    let mut g = game(4, Setup::Beginner);
    let p = g.active();
    development(&mut g, p, Development::Knight, 0);
    development(&mut g, p, Development::Monopoly, 0);
    g.apply(p, Action::Knight).unwrap();
    assert!(matches!(
        g.phase(),
        Phase::Robber {
            resume: Stage::Production,
            ..
        }
    ));
    let target = g.legal_actions(p)[0].clone();
    g.apply(p, target).unwrap();
    if matches!(g.phase(), Phase::Victim { .. }) {
        let a = g.legal_actions(p)[0].clone();
        g.apply(p, a).unwrap();
    }
    assert!(matches!(
        g.phase(),
        Phase::Turn {
            stage: Stage::Production,
            ..
        }
    ));
    assert!(
        !g.legal_actions(p)
            .iter()
            .any(|a| matches!(a, Action::Monopoly { .. }))
    );
    assert_eq!(
        g.view_for(p)
            .unwrap()
            .players
            .iter()
            .find(|v| v.id == p)
            .unwrap()
            .knights,
        1
    );
}
#[test]
fn development_purchase_privacy_monopoly_invention_and_free_roads() {
    let mut g = game(3, Setup::Beginner);
    let p = g.active();
    actions_for(&mut g, p);
    grant(&mut g, p, [1, 1, 1, 1, 1]);
    g.apply(p, Action::BuyDevelopment).unwrap();
    assert_eq!(
        g.state.development[g.index(p).unwrap()][0].bought,
        g.state.opportunity
    );
    development(&mut g, p, Development::Monopoly, 0);
    let all: u8 = g.state.hands.iter().map(|r| r[0]).sum();
    g.apply(
        p,
        Action::Monopoly {
            resource: Resource::Wood,
        },
    )
    .unwrap();
    assert_eq!(g.view_for(p).unwrap().hand[0], all);
    for (i, h) in g.state.hands.iter().enumerate() {
        if i != g.index(p).unwrap() {
            assert_eq!(h[0], 0);
        }
    }
    g.state.played_this_turn = false;
    development(&mut g, p, Development::Invention, 0);
    let before = g.view_for(p).unwrap().hand;
    g.apply(
        p,
        Action::Invention {
            resources: [0, 0, 2, 0, 0],
        },
    )
    .unwrap();
    assert_eq!(g.view_for(p).unwrap().hand[2], before[2] + 2);
    g.state.played_this_turn = false;
    development(&mut g, p, Development::RoadBuilding, 0);
    let hand = g.view_for(p).unwrap().hand;
    g.apply(p, Action::RoadBuilding).unwrap();
    for _ in 0..2 {
        let a = g.legal_actions(p)[0].clone();
        g.apply(p, a).unwrap();
    }
    assert_eq!(g.inventory(p).0, 11);
    assert_eq!(g.view_for(p).unwrap().hand, hand);
    g.validate_checkpoint().unwrap();
}
#[test]
fn broadcast_trade_is_atomic_confirmed_once_and_resource_changes_invalidate() {
    let mut g = game(3, Setup::Beginner);
    let p = PlayerId(0);
    actions_for(&mut g, p);
    grant(&mut g, p, [5, 0, 0, 0, 0]);
    grant(&mut g, PlayerId(1), [0, 4, 0, 0, 0]);
    grant(&mut g, PlayerId(2), [0, 4, 0, 0, 0]);
    g.apply(
        p,
        Action::Offer {
            give: [2, 0, 0, 0, 0],
            take: [0, 1, 0, 0, 0],
            to: None,
        },
    )
    .unwrap();
    let offer = g.state.offers[0].id;
    g.apply(PlayerId(1), Action::Accept { offer }).unwrap();
    g.apply(PlayerId(2), Action::Accept { offer }).unwrap();
    assert_eq!(g.state.hands[0][0], 5);
    let checkpoint = g.export_checkpoint().unwrap();
    g = Game::import_checkpoint(&checkpoint).unwrap();
    g.apply(
        p,
        Action::ConfirmTrade {
            offer,
            partner: PlayerId(2),
        },
    )
    .unwrap();
    assert_eq!(g.state.hands[0], [3, 1, 0, 0, 0]);
    assert_eq!(g.state.hands[2], [2, 3, 0, 0, 0]);
    assert!(g.state.offers.is_empty());
    let before = g.export_checkpoint().unwrap();
    assert!(
        g.apply(
            p,
            Action::ConfirmTrade {
                offer,
                partner: PlayerId(1)
            }
        )
        .is_err()
    );
    assert_eq!(g.export_checkpoint().unwrap(), before);
    assert!(
        g.apply(
            p,
            Action::Offer {
                give: [1, 0, 0, 0, 0],
                take: [1, 0, 0, 0, 0],
                to: None
            }
        )
        .is_err()
    );
}
#[test]
fn empty_victim_does_not_advance_randomness() {
    let mut g = game(3, Setup::Beginner);
    let p = g.active();
    let victim = g.players().into_iter().find(|v| *v != p).unwrap();
    grant(&mut g, victim, [0; 5]);
    g.state.phase = Phase::Victim {
        player: p,
        resume: Stage::Actions,
        targets: vec![victim],
    };
    let before = serde_json::to_string(&g.state.rng).unwrap();
    let events = g.apply(p, Action::Steal { victim }).unwrap();
    assert!(matches!(events[0], Event::Theft { resource: None, .. }));
    assert_eq!(serde_json::to_string(&g.state.rng).unwrap(), before);
}
#[test]
fn checkpoint_rejects_bad_topology_conservation_cards_phases_and_offers() {
    let g = game(5, Setup::Beginner);
    let original: serde_json::Value =
        serde_json::from_str(&g.export_checkpoint().unwrap()).unwrap();
    for (key, value) in [
        ("hands", serde_json::json!([])),
        ("robber", serde_json::json!(255)),
        ("primary", serde_json::json!(255)),
        (
            "phase",
            serde_json::json!({"type":"victim","player":0,"resume":"actions","targets":[255]}),
        ),
        ("bank", serde_json::json!([24, 24, 24, 24, 24])),
        ("deck", serde_json::json!([])),
        ("opportunity", serde_json::json!(0)),
    ] {
        let mut bad = original.clone();
        bad[key] = value;
        assert!(Game::import_checkpoint(&bad.to_string()).is_err(), "{key}");
    }
}
#[test]
fn longest_award_ties_retain_incumbent_or_remain_unclaimed() {
    let mut g = game(3, Setup::Beginner);
    g.state.roads.fill(None);
    g.state.buildings.fill(None);
    for (p, h) in [(PlayerId(0), 0), (PlayerId(1), 18)] {
        for c in 0..5 {
            let e = g.state.board.hex_edge(h, c);
            g.state.roads[e as usize] = Some(p);
        }
    }
    g.bonuses();
    assert_eq!(g.state.longest, None);
    let e = g.state.board.hex_edge(0, 5);
    g.state.roads[e as usize] = Some(PlayerId(0));
    g.bonuses();
    assert_eq!(g.state.longest, Some(PlayerId(0)));
    g.state.roads[e as usize] = None;
    g.bonuses();
    assert_eq!(g.state.longest, Some(PlayerId(0)));
    let e = g.state.board.hex_edge(0, 2);
    g.state.roads[e as usize] = None;
    g.bonuses();
    assert_eq!(g.state.longest, Some(PlayerId(1)));
}
#[test]
fn winning_development_purchase_reveals_only_winners_points() {
    let mut g = game(3, Setup::Beginner);
    let p = g.active();
    let i = g.index(p).unwrap();
    actions_for(&mut g, p);
    for b in g
        .state
        .buildings
        .iter_mut()
        .flatten()
        .filter(|b| b.owner == Some(p))
    {
        b.city = true;
    }
    for _ in 0..3 {
        let at = g
            .state
            .deck
            .iter()
            .position(|c| *c == Development::Knight)
            .unwrap();
        g.state.deck.remove(at);
        g.state.played[i].push(Development::Knight);
        development(&mut g, p, Development::VictoryPoint, 0);
    }
    let other = g.players().into_iter().find(|id| *id != p).unwrap();
    development(&mut g, other, Development::VictoryPoint, 0);
    g.bonuses();
    assert_eq!(g.points(p, true), 9);
    let at = g
        .state
        .deck
        .iter()
        .position(|c| *c == Development::VictoryPoint)
        .unwrap();
    let card = g.state.deck.remove(at);
    g.state.deck.push(card);
    grant(&mut g, p, [0, 1, 1, 0, 1]);
    g.apply(p, Action::BuyDevelopment).unwrap();
    assert!(matches!(g.phase(),Phase::Finished{winner}if winner==p));
    let view = g.view_for(other).unwrap();
    assert_eq!(view.players.iter().find(|v| v.id == p).unwrap().points, 10);
    assert_eq!(
        view.players.iter().find(|v| v.id == other).unwrap().points,
        2
    );
    g.validate_checkpoint().unwrap();
}
