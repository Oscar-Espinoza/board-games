//! Generate a reviewable replay input; golden output updates are deliberately manual.
use color_match::{
    Action, Game, GameConfig, PlayerId, REPLAY_VERSION, Replay, ReplayAction, bot_action,
};
fn main() {
    let seed_byte = std::env::args()
        .nth(1)
        .map(|s| s.parse::<u8>().unwrap())
        .unwrap_or(7);
    let mut input = Replay {
        version: REPLAY_VERSION,
        seed: [seed_byte; 32],
        config: GameConfig {
            players: (0..std::env::args()
                .nth(3)
                .and_then(|s| s.parse::<u8>().ok())
                .unwrap_or(2))
                .map(PlayerId)
                .collect(),
        },
        actions: vec![],
    };
    let mut game = Game::new(input.seed, input.config.clone()).unwrap();
    let drain_stock = std::env::args().nth(2).as_deref() == Some("drain");
    for index in 0..2000 {
        let Some(player) = game.view_for(PlayerId(0)).unwrap().phase.actor() else {
            break;
        };
        let action = if drain_stock && index < 108 - 7 * input.config.players.len() {
            Action::Draw {}
        } else {
            bot_action(&game.view_for(player).unwrap()).unwrap()
        };
        game.apply(player, action).unwrap();
        input.actions.push(ReplayAction { player, action });
    }
    assert!(
        game.view_for(PlayerId(0)).unwrap().phase.actor().is_none(),
        "fixture did not finish"
    );
    println!("{}", serde_json::to_string_pretty(&input).unwrap());
}
