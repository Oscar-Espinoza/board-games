//! Deterministic test driver, never shipped to browsers and not a CATAN bot mode.
use catan::*;
fn main() {
    winning_fixture();
    for n in 3..=6 {
        for setup in [Setup::Variable, Setup::Beginner] {
            let seed = [n; 32];
            let config = GameConfig {
                players: (0..n).map(PlayerId).collect(),
                setup,
            };
            let mut game = Game::new(seed, config.clone()).unwrap();
            let mut actions = vec![];
            for step in 0..10_000 {
                let p = game.phase().actor().unwrap_or_else(|| {
                    if let Phase::Discard { pending } = game.phase() {
                        pending[0].0
                    } else {
                        PlayerId(0)
                    }
                });
                if game.finished() {
                    break;
                }
                let view = game.view_for(p).unwrap();
                let mut action = if view.discard_required > 0 {
                    let mut remaining = view.discard_required;
                    let mut resources = [0; 5];
                    for (r, n) in resources.iter_mut().enumerate() {
                        *n = remaining.min(view.hand[r]);
                        remaining -= *n;
                    }
                    Action::Discard { resources }
                } else {
                    view.legal_actions
                        .iter()
                        .min_by_key(|a| match a {
                            Action::Settlement { .. } | Action::City { .. } => 0,
                            Action::BuyDevelopment => 1,
                            Action::Knight
                            | Action::Monopoly { .. }
                            | Action::Invention { .. }
                            | Action::RoadBuilding => 2,
                            Action::Road { .. } => 3,
                            Action::Roll
                            | Action::MoveRobber { .. }
                            | Action::Steal { .. }
                            | Action::FinishRoads => 4,
                            Action::EndTurn => 5,
                            _ => 9,
                        })
                        .unwrap()
                        .clone()
                };
                if matches!(action, Action::EndTurn) {
                    for goal in [
                        [0, 0, 2, 0, 3],
                        [1, 1, 1, 1, 0],
                        [0, 1, 1, 0, 1],
                        [1, 0, 0, 1, 0],
                    ] {
                        if let Some(trade) = view.legal_actions.iter().find(|action| {
                            if let Action::BankTrade { give, take } = action {
                                view.hand[take.index()] < goal[take.index()]
                                    && view.hand[give.index()] >= goal[give.index()] + 4
                            } else {
                                false
                            }
                        }) {
                            action = trade.clone();
                            break;
                        }
                    }
                }
                game.apply(p, action.clone()).unwrap();
                if step % 20 == 0 {
                    let checkpoint = game.export_checkpoint().unwrap();
                    let restored = Game::import_checkpoint(&checkpoint).unwrap();
                    assert_eq!(restored.export_checkpoint().unwrap(), checkpoint);
                }
                actions.push(ReplayAction { player: p, action });
            }
            let name = format!(
                "tests/fixtures/catan/{n}-{}",
                if setup == Setup::Variable {
                    "variable"
                } else {
                    "beginner"
                }
            );
            assert!(
                game.finished(),
                "{name}: game did not finish in 10,000 actions"
            );
            println!("{name}: victory after {} actions", actions.len());
            let input = Replay {
                version: RULES_VERSION,
                seed,
                config,
                actions,
            };
            let json = serde_json::to_string(&input).unwrap();
            let result = replay(input).unwrap();
            std::fs::write(format!("{name}.replay.json"), format!("{json}\n")).unwrap();
            std::fs::write(
                format!("{name}.expected.json"),
                format!("{}\n", serde_json::to_string(&result).unwrap()),
            )
            .unwrap();
        }
    }
}

fn winning_fixture() {
    let g = Game::new(
        [3; 32],
        GameConfig {
            players: (0..3).map(PlayerId).collect(),
            setup: Setup::Beginner,
        },
    )
    .unwrap();
    let mut value: serde_json::Value =
        serde_json::from_str(&g.export_checkpoint().unwrap()).unwrap();
    value["primary"] = 0.into();
    value["paired"] = false.into();
    value["revision"] = 100.into();
    value["opportunity"] = 40.into();
    value["phase"] = serde_json::json!({"type":"turn","player":0,"stage":"actions"});
    for building in value["buildings"].as_array_mut().unwrap() {
        if building["owner"] == 0 {
            building["city"] = true.into();
        }
    }
    let mut deck = value["deck"].as_array().unwrap().clone();
    let mut dev = vec![];
    let mut played = vec![];
    for _ in 0..3 {
        for kind in ["knight", "victory_point"] {
            let index = deck.iter().position(|v| v == kind).unwrap();
            deck.remove(index);
        }
        dev.push(serde_json::json!({"kind":"victory_point","bought":1}));
        played.push(serde_json::json!("knight"));
    }
    let index = deck.iter().position(|v| v == "victory_point").unwrap();
    let vp = deck.remove(index);
    deck.push(vp);
    value["deck"] = deck.into();
    value["development"][0] = dev.into();
    value["played"][0] = played.into();
    value["army"] = 0.into();
    let hand = [0, 1, 1, 0, 1];
    for (r, n) in hand.iter().enumerate() {
        let bank = value["bank"][r].as_u64().unwrap() + value["hands"][0][r].as_u64().unwrap() - n;
        value["bank"][r] = bank.into();
        value["hands"][0][r] = (*n).into();
    }
    let game = Game::import_checkpoint(&value.to_string()).unwrap();
    assert_eq!(game.view_for(PlayerId(0)).unwrap().points, 9);
    std::fs::write(
        "tests/fixtures/catan/win.checkpoint.json",
        game.export_checkpoint().unwrap(),
    )
    .unwrap();
}
