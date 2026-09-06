//! Deterministic version-2 rules. Authority state is deliberately not serializable.
use rand_chacha::ChaCha12Rng;
use rand_core::{RngCore, SeedableRng};
use serde::{Deserialize, Serialize};
use std::fmt;
pub const REPLAY_VERSION: u32 = 2;
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct PlayerId(pub u8);
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GameConfig {
    pub players: Vec<PlayerId>,
}
impl Default for GameConfig {
    fn default() -> Self {
        Self {
            players: vec![PlayerId(0), PlayerId(1)],
        }
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Color {
    Red,
    Yellow,
    Green,
    Blue,
}
impl Color {
    pub const ALL: [Self; 4] = [Self::Red, Self::Yellow, Self::Green, Self::Blue];
    pub fn label(self) -> &'static str {
        match self {
            Self::Red => "Red",
            Self::Yellow => "Yellow",
            Self::Green => "Green",
            Self::Blue => "Blue",
        }
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum Face {
    Number { color: Color, number: u8 },
    Skip { color: Color },
    Reverse { color: Color },
    DrawTwo { color: Color },
    Wild,
    WildFour,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Card {
    pub id: u8,
    pub face: Face,
}
impl Card {
    pub fn color(self) -> Option<Color> {
        match self.face {
            Face::Number { color, .. }
            | Face::Skip { color }
            | Face::Reverse { color }
            | Face::DrawTwo { color } => Some(color),
            Face::Wild | Face::WildFour => None,
        }
    }
    pub fn label(self) -> String {
        match self.face {
            Face::Number { color, number } => format!("{} {number}", color.label()),
            Face::Skip { color } => format!("{} Skip", color.label()),
            Face::Reverse { color } => format!("{} Reverse", color.label()),
            Face::DrawTwo { color } => format!("{} +2", color.label()),
            Face::Wild => "Wild".into(),
            Face::WildFour => "Wild +4".into(),
        }
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case", deny_unknown_fields)]
pub enum Action {
    Play {
        card_id: u8,
        #[serde(default)]
        uno: bool,
    },
    Draw {},
    ChooseColor {
        color: Color,
    },
    CatchUno {
        player: PlayerId,
    },
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Outcome {
    Win { player: PlayerId },
    Draw,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Phase {
    Turn { player: PlayerId },
    ChoosingColor { player: PlayerId },
    Finished { outcome: Outcome },
}
impl Phase {
    pub fn actor(self) -> Option<PlayerId> {
        match self {
            Self::Turn { player } | Self::ChoosingColor { player } => Some(player),
            Self::Finished { .. } => None,
        }
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Direction {
    Clockwise,
    Counterclockwise,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Penalty {
    pub amount: usize,
    pub kind: u8,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct PublicPlayer {
    pub player: PlayerId,
    pub count: usize,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct PlayerView {
    pub player: PlayerId,
    pub revision: u64,
    pub hand: Vec<Card>,
    pub players: Vec<PublicPlayer>,
    pub top: Card,
    pub active_color: Color,
    pub direction: Direction,
    pub penalty: Option<Penalty>,
    pub catchable: Option<PlayerId>,
    pub stock_count: usize,
    pub discard_count: usize,
    pub empty_passes: u8,
    pub phase: Phase,
    pub legal_actions: Vec<Action>,
}
/// Public events contain no drawn cards, deck order or seed.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum PublicEvent {
    Played { player: PlayerId, card: Card },
    Drew { player: PlayerId, count: usize },
    Uno { player: PlayerId },
    Caught { player: PlayerId },
    ColorChosen { player: PlayerId, color: Color },
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum RuleError {
    InvalidRoster,
    UnknownPlayer,
    GameOver,
    NotYourTurn,
    MustChooseColor,
    NotChoosingColor,
    CardNotOwned,
    CardDoesNotMatch,
    NoCatch,
    InvalidUno,
}
impl fmt::Display for RuleError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::InvalidRoster => "Choose 2–8 distinct players.",
            Self::UnknownPlayer => "Unknown player.",
            Self::GameOver => "This round has finished.",
            Self::NotYourTurn => "Wait for your turn.",
            Self::MustChooseColor => "Choose a color to finish your Wild.",
            Self::NotChoosingColor => "Play a Wild before choosing a color.",
            Self::CardNotOwned => "That card is not in your hand.",
            Self::CardDoesNotMatch => "Match the active color, symbol or permitted penalty stack.",
            Self::NoCatch => "That UNO catch opportunity has closed.",
            Self::InvalidUno => "Declare UNO when holding two cards.",
        })
    }
}
impl std::error::Error for RuleError {}
#[derive(Clone)]
pub struct Game {
    players: Vec<PlayerId>,
    hands: Vec<Vec<Card>>,
    stock: Vec<Card>,
    discards: Vec<Card>,
    active_color: Color,
    direction: Direction,
    penalty: Option<Penalty>,
    catchable: Option<PlayerId>,
    pending_uno: bool,
    phase: Phase,
    revision: u64,
    empty_passes: u8,
    rng: ChaCha12Rng,
}
fn deck() -> Vec<Card> {
    (0..108)
        .map(|id| Card {
            id,
            face: if id >= 104 {
                Face::WildFour
            } else if id >= 100 {
                Face::Wild
            } else {
                let color = Color::ALL[usize::from(id / 25)];
                match id % 25 {
                    0 => Face::Number { color, number: 0 },
                    n @ 1..=18 => Face::Number {
                        color,
                        number: n.div_ceil(2),
                    },
                    19..=20 => Face::Skip { color },
                    21..=22 => Face::Reverse { color },
                    _ => Face::DrawTwo { color },
                }
            },
        })
        .collect()
}
fn bounded(rng: &mut ChaCha12Rng, bound: u32) -> u32 {
    let threshold = bound.wrapping_neg() % bound;
    loop {
        let value = rng.next_u32();
        if value >= threshold {
            return value % bound;
        }
    }
}
fn shuffle(cards: &mut [Card], rng: &mut ChaCha12Rng) {
    for i in (1..cards.len()).rev() {
        let j = bounded(rng, (i + 1) as u32) as usize;
        cards.swap(i, j);
    }
}
impl Game {
    pub fn new(seed: [u8; 32], config: GameConfig) -> Result<Self, RuleError> {
        if !(2..=8).contains(&config.players.len())
            || config
                .players
                .iter()
                .enumerate()
                .any(|(i, p)| config.players[..i].contains(p))
        {
            return Err(RuleError::InvalidRoster);
        }
        let mut rng = ChaCha12Rng::from_seed(seed);
        let mut stock = deck();
        shuffle(&mut stock, &mut rng);
        let mut hands = vec![Vec::new(); config.players.len()];
        for _ in 0..7 {
            for hand in &mut hands {
                hand.push(stock.pop().expect("108-card deck"));
            }
        }
        let position = stock
            .iter()
            .rposition(|c| matches!(c.face, Face::Number { .. }))
            .expect("number remains");
        let top = stock.remove(position);
        let phase = Phase::Turn {
            player: config.players[0],
        };
        Ok(Self {
            players: config.players,
            hands,
            stock,
            discards: vec![top],
            active_color: top.color().unwrap(),
            direction: Direction::Clockwise,
            penalty: None,
            catchable: None,
            pending_uno: false,
            phase,
            revision: 0,
            empty_passes: 0,
            rng,
        })
    }
    fn index(&self, player: PlayerId) -> Result<usize, RuleError> {
        self.players
            .iter()
            .position(|p| *p == player)
            .ok_or(RuleError::UnknownPlayer)
    }
    fn top(&self) -> Card {
        *self.discards.last().expect("top discard")
    }
    fn next(&self, index: usize, steps: usize) -> PlayerId {
        let n = self.players.len();
        self.players[match self.direction {
            Direction::Clockwise => (index + steps) % n,
            Direction::Counterclockwise => (index + n - steps % n) % n,
        }]
    }
    fn matches(&self, card: Card) -> bool {
        if let Some(p) = self.penalty {
            return matches!(card.face, Face::WildFour)
                || (p.kind == 2 && matches!(card.face, Face::DrawTwo { .. }));
        }
        card.color().is_none()
            || card.color() == Some(self.active_color)
            || match (card.face, self.top().face) {
                (Face::Number { number: a, .. }, Face::Number { number: b, .. }) => a == b,
                (Face::Skip { .. }, Face::Skip { .. })
                | (Face::Reverse { .. }, Face::Reverse { .. })
                | (Face::DrawTwo { .. }, Face::DrawTwo { .. }) => true,
                _ => false,
            }
    }
    fn validate(&self, player: PlayerId, action: Action) -> Result<(), RuleError> {
        let index = self.index(player)?;
        let actor = self.phase.actor().ok_or(RuleError::GameOver)?;
        if let Action::CatchUno { player: target } = action {
            return if target != player && self.catchable == Some(target) {
                Ok(())
            } else {
                Err(RuleError::NoCatch)
            };
        }
        if actor != player {
            return Err(RuleError::NotYourTurn);
        }
        match (self.phase, action) {
            (Phase::ChoosingColor { .. }, Action::ChooseColor { .. }) => Ok(()),
            (Phase::ChoosingColor { .. }, _) => Err(RuleError::MustChooseColor),
            (_, Action::ChooseColor { .. }) => Err(RuleError::NotChoosingColor),
            (_, Action::Draw {}) => Ok(()),
            (_, Action::Play { card_id, uno }) => {
                let card = self.hands[index]
                    .iter()
                    .find(|c| c.id == card_id)
                    .ok_or(RuleError::CardNotOwned)?;
                if uno && self.hands[index].len() != 2 {
                    return Err(RuleError::InvalidUno);
                }
                if self.matches(*card) {
                    Ok(())
                } else {
                    Err(RuleError::CardDoesNotMatch)
                }
            }
            (_, Action::CatchUno { .. }) => unreachable!(),
        }
    }
    fn draw_cards(&mut self, index: usize, amount: usize) -> usize {
        let mut count = 0;
        for _ in 0..amount {
            if self.stock.is_empty() && self.discards.len() > 1 {
                let top = self.discards.pop().unwrap();
                self.stock = std::mem::replace(&mut self.discards, vec![top]);
                shuffle(&mut self.stock, &mut self.rng);
            }
            if let Some(card) = self.stock.pop() {
                self.hands[index].push(card);
                count += 1;
            } else {
                break;
            }
        }
        if count > 0 {
            self.empty_passes = 0;
        }
        count
    }
    fn finish_play(&mut self, index: usize, uno: bool, events: &mut Vec<PublicEvent>) {
        let player = self.players[index];
        if self.hands[index].is_empty() {
            self.penalty = None;
            self.catchable = None;
            self.phase = Phase::Finished {
                outcome: Outcome::Win { player },
            };
            return;
        }
        if self.hands[index].len() == 1 {
            if uno {
                events.push(PublicEvent::Uno { player });
            } else {
                self.catchable = Some(player);
            }
        }
        let steps = match self.top().face {
            Face::Skip { .. } => 2,
            Face::Reverse { .. } if self.players.len() == 2 => 2,
            _ => 1,
        };
        self.phase = Phase::Turn {
            player: self.next(index, steps),
        };
    }
    pub fn apply(
        &mut self,
        player: PlayerId,
        action: Action,
    ) -> Result<Vec<PublicEvent>, RuleError> {
        self.validate(player, action)?; // Every rejection precedes mutation and RNG consumption.
        let index = self.index(player)?;
        let mut events = vec![];
        match action {
            Action::Play { card_id, uno } => {
                self.catchable = None;
                let hand = &mut self.hands[index];
                let card = hand.remove(hand.iter().position(|c| c.id == card_id).unwrap());
                self.discards.push(card);
                self.empty_passes = 0;
                events.push(PublicEvent::Played { player, card });
                if let Some(color) = card.color() {
                    self.active_color = color;
                }
                match card.face {
                    Face::Reverse { .. } => {
                        self.direction = match self.direction {
                            Direction::Clockwise => Direction::Counterclockwise,
                            Direction::Counterclockwise => Direction::Clockwise,
                        }
                    }
                    Face::DrawTwo { .. } | Face::WildFour => {
                        let kind = if card.face == Face::WildFour { 4 } else { 2 };
                        self.penalty = Some(Penalty {
                            amount: self.penalty.map_or(0, |p| p.amount) + usize::from(kind),
                            kind,
                        });
                    }
                    _ => {}
                }
                if card.color().is_none() {
                    self.pending_uno = uno;
                    self.phase = Phase::ChoosingColor { player };
                } else {
                    self.finish_play(index, uno, &mut events);
                }
            }
            Action::ChooseColor { color } => {
                self.active_color = color;
                events.push(PublicEvent::ColorChosen { player, color });
                self.finish_play(index, self.pending_uno, &mut events);
                self.pending_uno = false;
            }
            Action::Draw {} => {
                self.catchable = None;
                let amount = self.penalty.take().map_or(1, |p| p.amount);
                let count = self.draw_cards(index, amount);
                events.push(PublicEvent::Drew { player, count });
                if count == 0 {
                    self.empty_passes += 1;
                }
                self.phase = if usize::from(self.empty_passes) >= self.players.len() {
                    Phase::Finished {
                        outcome: Outcome::Draw,
                    }
                } else {
                    Phase::Turn {
                        player: self.next(index, 1),
                    }
                };
            }
            Action::CatchUno { player: target } => {
                self.catchable = None;
                let target_index = self.index(target)?;
                let count = self.draw_cards(target_index, 2);
                events.push(PublicEvent::Caught { player: target });
                events.push(PublicEvent::Drew {
                    player: target,
                    count,
                });
            }
        }
        self.revision += 1;
        Ok(events)
    }
    pub fn view_for(&self, player: PlayerId) -> Result<PlayerView, RuleError> {
        let mut hand = self.hands[self.index(player)?].clone();
        hand.sort_by_key(|c| c.id);
        let candidates = hand
            .iter()
            .flat_map(|c| {
                [
                    Action::Play {
                        card_id: c.id,
                        uno: false,
                    },
                    Action::Play {
                        card_id: c.id,
                        uno: true,
                    },
                ]
            })
            .chain([Action::Draw {}])
            .chain(Color::ALL.map(|color| Action::ChooseColor { color }))
            .chain(self.catchable.map(|player| Action::CatchUno { player }));
        let legal_actions = candidates
            .filter(|a| self.validate(player, *a).is_ok())
            .collect();
        Ok(PlayerView {
            player,
            revision: self.revision,
            hand,
            players: self
                .players
                .iter()
                .zip(&self.hands)
                .map(|(player, h)| PublicPlayer {
                    player: *player,
                    count: h.len(),
                })
                .collect(),
            top: self.top(),
            active_color: self.active_color,
            direction: self.direction,
            penalty: self.penalty,
            catchable: self.catchable,
            stock_count: self.stock.len(),
            discard_count: self.discards.len(),
            empty_passes: self.empty_passes,
            phase: self.phase,
            legal_actions,
        })
    }
}
pub fn bot_action(view: &PlayerView) -> Option<Action> {
    if let Some(a) = view
        .legal_actions
        .iter()
        .find(|a| matches!(a, Action::CatchUno { .. }))
    {
        return Some(*a);
    }
    if view.phase.actor() != Some(view.player) {
        return None;
    }
    if matches!(view.phase, Phase::ChoosingColor { .. }) {
        let mut best = Color::Red;
        let mut best_count = 0;
        for color in Color::ALL {
            let count = view
                .hand
                .iter()
                .filter(|c| c.color() == Some(color))
                .count();
            if count > best_count {
                best = color;
                best_count = count;
            }
        }
        return Some(Action::ChooseColor { color: best });
    }
    view.legal_actions
        .iter()
        .filter_map(|a| {
            if let Action::Play { card_id, .. } = a {
                Some(*card_id)
            } else {
                None
            }
        })
        .min()
        .map(|card_id| Action::Play {
            card_id,
            uno: view.hand.len() == 2,
        })
        .or_else(|| {
            view.legal_actions
                .contains(&Action::Draw {})
                .then_some(Action::Draw {})
        })
}
/// Privileged development format. Never transmit to guests.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Replay {
    pub version: u32,
    pub seed: [u8; 32],
    #[serde(default)]
    pub config: GameConfig,
    pub actions: Vec<ReplayAction>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ReplayAction {
    pub player: PlayerId,
    pub action: Action,
}
#[derive(Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReplayResult {
    pub version: u32,
    pub frames: Vec<Vec<PlayerView>>,
}
pub fn replay(input: &Replay) -> Result<ReplayResult, String> {
    if input.version != REPLAY_VERSION {
        return Err(format!("unsupported replay version: {}", input.version));
    }
    let mut game = Game::new(input.seed, input.config.clone()).map_err(|e| e.to_string())?;
    let frame = |g: &Game| {
        input
            .config
            .players
            .iter()
            .map(|p| g.view_for(*p).unwrap())
            .collect()
    };
    let mut frames = vec![frame(&game)];
    for (i, entry) in input.actions.iter().enumerate() {
        game.apply(entry.player, entry.action)
            .map_err(|e| format!("action {i}: {e}"))?;
        frames.push(frame(&game));
    }
    Ok(ReplayResult {
        version: REPLAY_VERSION,
        frames,
    })
}
#[cfg(test)]
mod tests;

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct GameCheckpoint {
    players: Vec<PlayerId>,
    hands: Vec<Vec<Card>>,
    stock: Vec<Card>,
    discards: Vec<Card>,
    active_color: Color,
    direction: Direction,
    penalty: Option<Penalty>,
    catchable: Option<PlayerId>,
    pending_uno: bool,
    phase: Phase,
    revision: u64,
    empty_passes: u8,
    seed: [u8; 32],
    stream: u64,
    position: String,
}
impl Game {
    /// Privileged state, never a player projection.
    pub fn export_checkpoint(&self) -> Result<String, String> {
        serde_json::to_string(&GameCheckpoint {
            players: self.players.clone(),
            hands: self.hands.clone(),
            stock: self.stock.clone(),
            discards: self.discards.clone(),
            active_color: self.active_color,
            direction: self.direction,
            penalty: self.penalty,
            catchable: self.catchable,
            pending_uno: self.pending_uno,
            phase: self.phase,
            revision: self.revision,
            empty_passes: self.empty_passes,

            seed: self.rng.get_seed(),
            stream: self.rng.get_stream(),
            position: self.rng.get_word_pos().to_string(),
        })
        .map_err(|e| e.to_string())
    }
    pub fn import_checkpoint(json: &str) -> Result<Self, String> {
        if json.len() > 32768 {
            return Err("Checkpoint too large".into());
        }
        let c: GameCheckpoint = serde_json::from_str(json).map_err(|e| e.to_string())?;
        if !(2..=8).contains(&c.players.len())
            || c.players
                .iter()
                .collect::<std::collections::BTreeSet<_>>()
                .len()
                != c.players.len()
        {
            return Err("Invalid roster".into());
        }
        let all: Vec<Card> = c
            .hands
            .iter()
            .flatten()
            .chain(c.stock.iter())
            .chain(c.discards.iter())
            .copied()
            .collect();
        let expected = deck();
        let mut ids = std::collections::BTreeSet::new();
        if c.hands.len() != c.players.len()
            || c.discards.is_empty()
            || all.len() != 108
            || all
                .iter()
                .any(|card| expected.get(card.id as usize) != Some(card) || !ids.insert(card.id))
            || c.phase.actor().is_some_and(|p| !c.players.contains(&p))
            || c.catchable.is_some_and(|p| !c.players.contains(&p))
            || c.empty_passes as usize > c.players.len()
        {
            return Err("Invalid game checkpoint".into());
        }
        let valid_hand = |p: PlayerId, count: usize| {
            c.players
                .iter()
                .position(|id| *id == p)
                .is_some_and(|i| c.hands[i].len() == count)
        };
        if c.catchable.is_some_and(|p| !valid_hand(p, 1))
            || matches!(c.phase, Phase::Finished { outcome: Outcome::Win { player } } if !valid_hand(player, 0))
            || (matches!(c.phase, Phase::ChoosingColor { .. })
                && c.discards.last().unwrap().color().is_some())
            || (c.pending_uno && !matches!(c.phase, Phase::ChoosingColor { .. }))
            || c.penalty.is_some_and(|p| {
                ![2, 4].contains(&p.kind) || p.amount == 0 || p.amount > 432 || p.amount % 2 != 0
            })
            || c.revision == u64::MAX
        {
            return Err("Invalid phase or penalty".into());
        }
        let mut rng = ChaCha12Rng::from_seed(c.seed);
        rng.set_stream(c.stream);
        rng.set_word_pos(c.position.parse().map_err(|_| "Invalid RNG position")?);
        Ok(Self {
            players: c.players,
            hands: c.hands,
            stock: c.stock,
            discards: c.discards,
            active_color: c.active_color,
            direction: c.direction,
            penalty: c.penalty,
            catchable: c.catchable,
            pending_uno: c.pending_uno,
            phase: c.phase,
            revision: c.revision,
            empty_passes: c.empty_passes,
            rng,
        })
    }
}
