//! Deterministic CATAN sixth-edition rules. Canonical state is private.
pub mod board;
/// Domain checkpoint budget. The session separately bounds the final escaped transport wrapper.
const CHECKPOINT_BUDGET: usize = 30_000;

use board::Board;
use rand_chacha::ChaCha12Rng;
use rand_core::{RngCore, SeedableRng};
use serde::{Deserialize, Serialize};
pub use table_types::PlayerId;
pub const RULES_VERSION: u32 = 1;
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Resource {
    Wood,
    Wool,
    Wheat,
    Brick,
    Ore,
}
impl Resource {
    pub const ALL: [Self; 5] = [Self::Wood, Self::Wool, Self::Wheat, Self::Brick, Self::Ore];
    pub fn index(self) -> usize {
        self as usize
    }
}
pub type Resources = [u8; 5];
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Setup {
    #[default]
    Variable,
    Beginner,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GameConfig {
    pub players: Vec<PlayerId>,
    pub setup: Setup,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Development {
    Knight,
    Monopoly,
    RoadBuilding,
    Invention,
    VictoryPoint,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct DevelopmentCard {
    pub kind: Development,
    pub bought: u64,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Building {
    pub owner: Option<PlayerId>,
    pub color: u8,
    pub city: bool,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Stage {
    Production,
    Actions,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Phase {
    Setup {
        player: PlayerId,
        step: u8,
        settlement: Option<u8>,
    },
    Turn {
        player: PlayerId,
        stage: Stage,
    },
    Discard {
        pending: Vec<(PlayerId, u8)>,
    },
    Robber {
        player: PlayerId,
        resume: Stage,
    },
    Victim {
        player: PlayerId,
        resume: Stage,
        targets: Vec<PlayerId>,
    },
    FreeRoads {
        player: PlayerId,
        resume: Stage,
        remaining: u8,
    },
    Finished {
        winner: PlayerId,
    },
}
impl Phase {
    pub fn actor(&self) -> Option<PlayerId> {
        match self {
            Self::Setup { player, .. }
            | Self::Turn { player, .. }
            | Self::Robber { player, .. }
            | Self::Victim { player, .. }
            | Self::FreeRoads { player, .. } => Some(*player),
            _ => None,
        }
    }
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case", deny_unknown_fields)]
pub enum Action {
    Settlement {
        vertex: u8,
    },
    Road {
        edge: u8,
    },
    City {
        vertex: u8,
    },
    Roll,
    EndTurn,
    BuyDevelopment,
    Discard {
        resources: Resources,
    },
    MoveRobber {
        hex: u8,
    },
    Steal {
        victim: PlayerId,
    },
    Knight,
    Monopoly {
        resource: Resource,
    },
    Invention {
        resources: Resources,
    },
    RoadBuilding,
    FinishRoads,
    BankTrade {
        give: Resource,
        take: Resource,
    },
    Offer {
        give: Resources,
        take: Resources,
        to: Option<PlayerId>,
    },
    Accept {
        offer: u64,
    },
    ConfirmTrade {
        offer: u64,
        partner: PlayerId,
    },
    Decline {
        offer: u64,
    },
    Withdraw,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Offer {
    pub id: u64,
    pub from: PlayerId,
    pub to: Option<PlayerId>,
    pub give: Resources,
    pub take: Resources,
    pub opportunity: u64,
    pub accepted: Vec<PlayerId>,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Event {
    Rolled {
        player: PlayerId,
        dice: [u8; 2],
    },
    Produced {
        player: PlayerId,
        resources: Resources,
    },
    Built {
        player: PlayerId,
        kind: BuildKind,
        location: u8,
    },
    Discarded {
        player: PlayerId,
        count: u8,
    },
    RobberMoved {
        hex: u8,
    },
    Theft {
        thief: PlayerId,
        victim: PlayerId,
        resource: Option<Resource>,
    },
    BoughtDevelopment {
        player: PlayerId,
    },
    PlayedDevelopment {
        player: PlayerId,
        kind: Development,
    },
    Traded {
        a: PlayerId,
        b: Option<PlayerId>,
    },
    Turn {
        player: PlayerId,
        paired: bool,
    },
    Won {
        player: PlayerId,
    },
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct PublicPlayer {
    pub id: PlayerId,
    pub color: u8,
    pub resources: u16,
    pub development: u8,
    pub points: u8,
    pub knights: u8,
    pub played: Vec<Development>,
    pub roads_left: u8,
    pub settlements_left: u8,
    pub cities_left: u8,
    pub route: u8,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct PlayerView {
    pub revision: u64,
    pub player: PlayerId,
    pub board: Board,
    pub buildings: Vec<Option<Building>>,
    pub roads: Vec<Option<PlayerId>>,
    pub robber: u8,
    pub bank: Resources,
    pub development_left: u8,
    pub players: Vec<PublicPlayer>,
    pub hand: Resources,
    pub development: Vec<DevelopmentCard>,
    pub points: u8,
    pub phase: Phase,
    pub primary: PlayerId,
    pub secondary: Option<PlayerId>,
    pub paired: bool,
    pub opportunity: u64,
    pub dice: Option<[u8; 2]>,
    pub longest: Option<PlayerId>,
    pub army: Option<PlayerId>,
    pub offers: Vec<Offer>,
    pub legal_actions: Vec<Action>,
    pub discard_required: u8,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct State {
    version: u32,
    config: GameConfig,
    board: Board,
    buildings: Vec<Option<Building>>,
    roads: Vec<Option<PlayerId>>,
    robber: u8,
    bank: Resources,
    hands: Vec<Resources>,
    development: Vec<Vec<DevelopmentCard>>,
    deck: Vec<Development>,
    played: Vec<Vec<Development>>,
    colors: Vec<u8>,
    rng: ChaCha12Rng,
    phase: Phase,
    first: usize,
    primary: usize,
    paired: bool,
    opportunity: u64,
    played_this_turn: bool,
    revision: u64,
    dice: Option<[u8; 2]>,
    longest: Option<PlayerId>,
    army: Option<PlayerId>,
    offers: Vec<Offer>,
    next_offer: u64,
}
#[derive(Clone)]
pub struct Game {
    state: State,
}
const ROAD: Resources = [1, 0, 0, 1, 0];
const SETTLEMENT: Resources = [1, 1, 1, 1, 0];
const CITY: Resources = [0, 0, 2, 0, 3];
const DEVELOPMENT: Resources = [0, 1, 1, 0, 1];
fn total(r: &Resources) -> u16 {
    r.iter().map(|x| u16::from(*x)).sum()
}
fn enough(h: &Resources, c: &Resources) -> bool {
    h.iter().zip(c).all(|(a, b)| a >= b)
}
// Replay compatibility: preserve this rejection threshold and RNG draw consumption.
fn sample(rng: &mut ChaCha12Rng, n: u32) -> u32 {
    let bound = u32::MAX - u32::MAX % n;
    loop {
        let v = rng.next_u32();
        if v < bound {
            return v % n;
        }
    }
}
fn shuffle<T>(rng: &mut ChaCha12Rng, values: &mut [T]) {
    for i in (1..values.len()).rev() {
        let j = sample(rng, (i + 1) as u32) as usize;
        values.swap(i, j);
    }
}
impl Game {
    pub fn new(seed: [u8; 32], config: GameConfig) -> Result<Self, String> {
        let n = config.players.len();
        if !(3..=6).contains(&n)
            || config
                .players
                .iter()
                .enumerate()
                .any(|(i, p)| config.players[..i].contains(p))
        {
            return Err("CATAN requires 3–6 distinct human players".into());
        }
        let mut rng = ChaCha12Rng::from_seed(seed);
        let mut board = Board::new(n > 4);
        board.fixed_terrain();
        board.fixed_ports();
        if config.setup == Setup::Variable {
            let mut terrain: Vec<_> = board.hexes.iter().map(|h| h.resource).collect();
            shuffle(&mut rng, &mut terrain);
            for (h, r) in board.hexes.iter_mut().zip(terrain) {
                h.resource = r;
                h.number = 0;
            }
            let base = [5, 2, 6, 3, 8, 10, 9, 12, 11, 4, 8, 10, 9, 4, 5, 6, 3, 11];
            let ext = [
                2, 5, 4, 6, 3, 9, 8, 11, 11, 10, 6, 3, 8, 4, 8, 10, 11, 12, 10, 5, 4, 9, 5, 9, 12,
                3, 2, 6,
            ];
            let nums: &[u8] = if n > 4 { &ext } else { &base };
            let mut nums = nums.iter();
            for i in board.spiral() {
                if board.hexes[i].resource.is_some() {
                    board.hexes[i].number = *nums.next().unwrap();
                }
            }
            let mut sections: Vec<_> = (0..if n > 4 { 10 } else { 6 }).collect();
            shuffle(&mut rng, &mut sections);
            board.variable_ports(&sections);
        }
        let deserts: Vec<_> = board
            .hexes
            .iter()
            .enumerate()
            .filter(|(_, h)| h.resource.is_none())
            .map(|(i, _)| i as u8)
            .collect();
        let robber = if config.setup == Setup::Beginner {
            deserts[0]
        } else {
            deserts[sample(&mut rng, deserts.len() as u32) as usize]
        };
        let mut deck = vec![];
        for (kind, count) in [
            (Development::Knight, if n > 4 { 20 } else { 14 }),
            (Development::Monopoly, if n > 4 { 3 } else { 2 }),
            (Development::RoadBuilding, if n > 4 { 3 } else { 2 }),
            (Development::Invention, if n > 4 { 3 } else { 2 }),
            (Development::VictoryPoint, 5),
        ] {
            deck.extend(std::iter::repeat_n(kind, count));
        }
        shuffle(&mut rng, &mut deck);
        let mut tied: Vec<_> = (0..n).collect();
        while tied.len() > 1 {
            let rolls: Vec<_> = tied
                .iter()
                .map(|i| (*i, sample(&mut rng, 6) + sample(&mut rng, 6) + 2))
                .collect();
            let high = rolls.iter().map(|(_, v)| *v).max().unwrap();
            tied = rolls
                .into_iter()
                .filter(|(_, v)| *v == high)
                .map(|(i, _)| i)
                .collect();
        }
        let first = tied[0];
        let mut colors = if n == 3 {
            vec![0, 1, 3]
        } else {
            (0..n as u8).collect()
        };
        if n == 5 && config.setup == Setup::Beginner {
            colors = (0..6).collect();
            shuffle(&mut rng, &mut colors);
            colors.truncate(5);
        }
        let mut game = Self {
            state: State {
                version: RULES_VERSION,
                phase: Phase::Setup {
                    player: config.players[first],
                    step: 0,
                    settlement: None,
                },
                buildings: vec![None; board.vertices.len()],
                roads: vec![None; board.edges.len()],
                bank: [if n > 4 { 24 } else { 19 }; 5],
                hands: vec![[0; 5]; n],
                development: vec![vec![]; n],
                played: vec![vec![]; n],
                colors,
                board,
                robber,
                deck,
                rng,
                config,
                first,
                primary: first,
                paired: false,
                opportunity: 1,
                played_this_turn: false,
                revision: 0,
                dice: None,
                longest: None,
                army: None,
                offers: vec![],
                next_offer: 1,
            },
        };
        if game.state.config.setup == Setup::Beginner {
            game.beginner();
            game.state.phase = Phase::Turn {
                player: game.active(),
                stage: Stage::Production,
            };
        }
        Ok(game)
    }
    fn beginner(&mut self) {
        // (first hex/corner, road direction; second hex/corner, road direction), colors R/B/W/O/G/P.
        let base = [
            [(12, 2, 3), (1, 2, 3)],
            [(11, 4, 3), (13, 2, 3)],
            [(15, 4, 3), (9, 4, 3)],
            [(6, 4, 5), (3, 2, 3)],
        ];
        let ext = [
            [(3, 4, 3), (14, 4, 3)],
            [(17, 3, 4), (15, 2, 1)],
            [(6, 1, 2), (9, 2, 1)],
            [(23, 3, 2), (14, 2, 3)],
            [(0, 1, 2), (9, 4, 5)],
            [(26, 3, 4), (21, 4, 3)],
        ];
        let placements: &[[(usize, usize, usize); 2]] = if self.extended() { &ext } else { &base };
        for (color, pair) in placements.iter().enumerate() {
            let owner = self
                .state
                .colors
                .iter()
                .position(|c| usize::from(*c) == color)
                .map(|i| self.state.config.players[i]);
            if owner.is_none() && !self.extended() {
                continue;
            }
            for (second, (h, c, d)) in pair.iter().enumerate() {
                let v = self.state.board.hexes[*h].vertices[*c];
                self.state.buildings[v as usize] = Some(Building {
                    owner,
                    color: color as u8,
                    city: false,
                });
                if let Some(p) = owner {
                    let w = self.state.board.hexes[*h].vertices[*d];
                    let e = self.state.board.edge(v, w);
                    self.state.roads[e as usize] = Some(p);
                    if second == 1 {
                        self.starting_resources(p, v);
                    }
                }
            }
        }
    }
    fn starting_resources(&mut self, p: PlayerId, v: u8) {
        let i = self.index(p).unwrap();
        let resources: Vec<_> = self
            .state
            .board
            .adjacent_hexes(v)
            .filter_map(|h| self.state.board.hexes[h].resource)
            .collect();
        for r in resources {
            self.state.hands[i][r.index()] += 1;
            self.state.bank[r.index()] -= 1;
        }
    }
    fn index(&self, p: PlayerId) -> Result<usize, String> {
        self.state
            .config
            .players
            .iter()
            .position(|v| *v == p)
            .ok_or("Unknown player".into())
    }
    pub fn setup(&self) -> Setup {
        self.state.config.setup
    }
    pub fn players(&self) -> Vec<PlayerId> {
        self.state.config.players.clone()
    }
    pub fn revision(&self) -> u64 {
        self.state.revision
    }
    pub fn phase(&self) -> Phase {
        self.state.phase.clone()
    }
    pub fn finished(&self) -> bool {
        matches!(self.state.phase, Phase::Finished { .. })
    }
    fn extended(&self) -> bool {
        self.state.config.players.len() > 4
    }
    fn active(&self) -> PlayerId {
        self.state.config.players[(self.state.primary + if self.state.paired { 3 } else { 0 })
            % self.state.config.players.len()]
    }
    fn inventory(&self, p: PlayerId) -> (u8, u8, u8) {
        let roads = self.state.roads.iter().filter(|r| **r == Some(p)).count() as u8;
        let mut settlements = 0;
        let mut cities = 0;
        for b in self
            .state
            .buildings
            .iter()
            .flatten()
            .filter(|b| b.owner == Some(p))
        {
            if b.city {
                cities += 1
            } else {
                settlements += 1
            }
        }
        (15 - roads, 5 - settlements, 4 - cities)
    }
    fn distance(&self, v: u8) -> bool {
        self.state.buildings.get(v as usize) == Some(&None)
            && self.state.board.incident(v).all(|(_, edge)| {
                edge.into_iter()
                    .filter(|w| *w != v)
                    .all(|w| self.state.buildings[w as usize].is_none())
            })
    }
    fn road_legal(&self, p: PlayerId, e: u8) -> bool {
        if self.state.roads.get(e as usize) != Some(&None) {
            return false;
        }
        self.state.board.edges[e as usize]
            .iter()
            .any(|v| match self.state.buildings[*v as usize] {
                Some(b) => b.owner == Some(p),
                None => self
                    .state
                    .board
                    .incident(*v)
                    .any(|(edge, _)| self.state.roads[edge] == Some(p)),
            })
    }
    fn settlement_legal(&self, p: PlayerId, v: u8) -> bool {
        self.distance(v)
            && self
                .state
                .board
                .incident(v)
                .any(|(e, _)| self.state.roads[e] == Some(p))
    }
    pub fn longest_route(&self, p: PlayerId) -> u8 {
        fn trail(g: &Game, p: PlayerId, v: u8, used: &mut Vec<usize>) -> u8 {
            if !used.is_empty() && g.state.buildings[v as usize].is_some_and(|b| b.owner != Some(p))
            {
                return 0;
            }
            let mut best = 0;
            for (e, ends) in g.state.board.incident(v) {
                if g.state.roads[e] == Some(p) && !used.contains(&e) {
                    used.push(e);
                    best = best
                        .max(1 + trail(g, p, if ends[0] == v { ends[1] } else { ends[0] }, used));
                    used.pop();
                }
            }
            best
        }
        (0..self.state.board.vertices.len() as u8)
            .map(|v| trail(self, p, v, &mut vec![]))
            .max()
            .unwrap_or(0)
    }
    fn points(&self, p: PlayerId, private: bool) -> u8 {
        let i = self.index(p).unwrap();
        self.state
            .buildings
            .iter()
            .flatten()
            .filter(|b| b.owner == Some(p))
            .map(|b| if b.city { 2 } else { 1 })
            .sum::<u8>()
            + if self.state.longest == Some(p) { 2 } else { 0 }
            + if self.state.army == Some(p) { 2 } else { 0 }
            + if private {
                self.state.development[i]
                    .iter()
                    .filter(|c| c.kind == Development::VictoryPoint)
                    .count() as u8
            } else {
                0
            }
    }
    fn bonuses(&mut self) {
        fn award(
            values: &[(PlayerId, u8)],
            incumbent: Option<PlayerId>,
            min: u8,
        ) -> Option<PlayerId> {
            let max = values.iter().map(|(_, v)| *v).max().unwrap_or(0);
            if max < min {
                return None;
            }
            if incumbent.is_some_and(|p| values.contains(&(p, max))) {
                return incumbent;
            }
            let best: Vec<_> = values.iter().filter(|(_, v)| *v == max).collect();
            (best.len() == 1).then(|| best[0].0)
        }
        let routes: Vec<_> = self
            .players()
            .iter()
            .map(|p| (*p, self.longest_route(*p)))
            .collect();
        self.state.longest = award(&routes, self.state.longest, 5);
        let knights: Vec<_> = self
            .players()
            .iter()
            .enumerate()
            .map(|(i, p)| {
                (
                    *p,
                    self.state.played[i]
                        .iter()
                        .filter(|c| **c == Development::Knight)
                        .count() as u8,
                )
            })
            .collect();
        self.state.army = award(&knights, self.state.army, 3);
    }
    fn eligible(&self, i: usize, kind: Development) -> bool {
        !self.state.played_this_turn
            && self.state.development[i]
                .iter()
                .any(|c| c.kind == kind && c.bought < self.state.opportunity)
    }
    fn ratio(&self, p: PlayerId, r: Resource) -> u8 {
        self.state
            .board
            .ports
            .iter()
            .filter(|port| {
                self.state.board.edges[port.edge as usize]
                    .iter()
                    .any(|v| self.state.buildings[*v as usize].is_some_and(|b| b.owner == Some(p)))
            })
            .map(|port| match port.resource {
                Some(x) if x == r => 2,
                None => 3,
                _ => 4,
            })
            .min()
            .unwrap_or(4)
    }
    pub fn legal_actions(&self, p: PlayerId) -> Vec<Action> {
        let Ok(i) = self.index(p) else { return vec![] };
        let mut actions = vec![];
        let (roads, settlements, cities) = self.inventory(p);
        match &self.state.phase {
            Phase::Setup {
                player, settlement, ..
            } if *player == p => {
                if let Some(v) = settlement {
                    for (e, _) in self.state.board.incident(*v) {
                        if self.state.roads[e].is_none() {
                            actions.push(Action::Road { edge: e as u8 });
                        }
                    }
                } else {
                    for v in 0..self.state.board.vertices.len() as u8 {
                        if self.distance(v) {
                            actions.push(Action::Settlement { vertex: v });
                        }
                    }
                }
            }
            Phase::Robber { player, .. } if *player == p => {
                for h in 0..self.state.board.hexes.len() as u8 {
                    if h != self.state.robber {
                        actions.push(Action::MoveRobber { hex: h });
                    }
                }
            }
            Phase::Victim {
                player, targets, ..
            } if *player == p => {
                actions.extend(targets.iter().map(|p| Action::Steal { victim: *p }));
            }
            Phase::FreeRoads { player, .. } if *player == p => {
                if roads > 0 {
                    for e in 0..self.state.roads.len() as u8 {
                        if self.road_legal(p, e) {
                            actions.push(Action::Road { edge: e });
                        }
                    }
                }
                if actions.is_empty() {
                    actions.push(Action::FinishRoads);
                }
            }
            Phase::Turn { player, stage } if *player == p => {
                if *stage == Stage::Production {
                    actions.push(Action::Roll);
                } else {
                    actions.push(Action::EndTurn);
                    if roads > 0 && enough(&self.state.hands[i], &ROAD) {
                        for e in 0..self.state.roads.len() as u8 {
                            if self.road_legal(p, e) {
                                actions.push(Action::Road { edge: e });
                            }
                        }
                    }
                    if settlements > 0 && enough(&self.state.hands[i], &SETTLEMENT) {
                        for v in 0..self.state.buildings.len() as u8 {
                            if self.settlement_legal(p, v) {
                                actions.push(Action::Settlement { vertex: v });
                            }
                        }
                    }
                    if cities > 0 && enough(&self.state.hands[i], &CITY) {
                        for (v, b) in self.state.buildings.iter().enumerate() {
                            if b.is_some_and(|b| b.owner == Some(p) && !b.city) {
                                actions.push(Action::City { vertex: v as u8 });
                            }
                        }
                    }
                    if !self.state.deck.is_empty() && enough(&self.state.hands[i], &DEVELOPMENT) {
                        actions.push(Action::BuyDevelopment);
                    }
                    for give in Resource::ALL {
                        for take in Resource::ALL {
                            if give != take
                                && self.state.hands[i][give.index()] >= self.ratio(p, give)
                                && self.state.bank[take.index()] > 0
                            {
                                actions.push(Action::BankTrade { give, take });
                            }
                        }
                    }
                }
                if self.eligible(i, Development::Knight) {
                    actions.push(Action::Knight);
                }
                if self.eligible(i, Development::Monopoly) {
                    actions.extend(Resource::ALL.map(|resource| Action::Monopoly { resource }));
                }
                if self.eligible(i, Development::RoadBuilding)
                    && roads > 0
                    && (0..self.state.roads.len() as u8).any(|e| self.road_legal(p, e))
                {
                    actions.push(Action::RoadBuilding);
                }
                if self.eligible(i, Development::Invention) {
                    for a in 0..5 {
                        for b in a..5 {
                            let mut r = [0; 5];
                            r[a] += 1;
                            r[b] += 1;
                            if enough(&self.state.bank, &r) {
                                actions.push(Action::Invention { resources: r });
                            }
                        }
                    }
                }
            }
            _ => {}
        }
        if matches!(
            self.state.phase,
            Phase::Turn {
                stage: Stage::Actions,
                ..
            }
        ) && !self.state.paired
        {
            for offer in &self.state.offers {
                if offer.from == p {
                    actions.push(Action::Withdraw);
                } else if offer.to.is_none_or(|to| to == p)
                    && (offer.from == self.active() || p == self.active())
                {
                    actions.push(Action::Decline { offer: offer.id });
                    if enough(&self.state.hands[i], &offer.take) {
                        actions.push(Action::Accept { offer: offer.id });
                    }
                }
                if p == self.active() {
                    for partner in &offer.accepted {
                        actions.push(Action::ConfirmTrade {
                            offer: offer.id,
                            partner: *partner,
                        });
                    }
                }
            }
        }
        actions
    }
    pub fn view_for(&self, p: PlayerId) -> Result<PlayerView, String> {
        let i = self.index(p)?;
        let players = self
            .players()
            .iter()
            .enumerate()
            .map(|(i, id)| {
                let (r, s, c) = self.inventory(*id);
                PublicPlayer {
                    id: *id,
                    color: self.state.colors[i],
                    resources: total(&self.state.hands[i]),
                    development: self.state.development[i].len() as u8,
                    points: self.points(
                        *id,
                        matches!(self.state.phase, Phase::Finished { winner } if winner == *id),
                    ),
                    knights: self.state.played[i]
                        .iter()
                        .filter(|c| **c == Development::Knight)
                        .count() as u8,
                    played: self.state.played[i].clone(),
                    roads_left: r,
                    settlements_left: s,
                    cities_left: c,
                    route: self.longest_route(*id),
                }
            })
            .collect();
        Ok(PlayerView {
            revision: self.state.revision,
            player: p,
            board: self.state.board.clone(),
            buildings: self.state.buildings.clone(),
            roads: self.state.roads.clone(),
            robber: self.state.robber,
            bank: self.state.bank,
            development_left: self.state.deck.len() as u8,
            players,
            hand: self.state.hands[i],
            development: self.state.development[i].clone(),
            points: self.points(p, true),
            phase: self.state.phase.clone(),
            primary: self.state.config.players[self.state.primary],
            secondary: self.extended().then(|| {
                self.state.config.players
                    [(self.state.primary + 3) % self.state.config.players.len()]
            }),
            paired: self.state.paired,
            opportunity: self.state.opportunity,
            dice: self.state.dice,
            longest: self.state.longest,
            army: self.state.army,
            offers: self.state.offers.clone(),
            legal_actions: self.legal_actions(p),
            discard_required: if let Phase::Discard { pending } = &self.state.phase {
                pending
                    .iter()
                    .find(|(id, _)| *id == p)
                    .map_or(0, |(_, n)| *n)
            } else {
                0
            },
        })
    }
    /// Transactional application: rejection leaves state and RNG exactly unchanged.
    pub fn apply(&mut self, p: PlayerId, action: Action) -> Result<Vec<Event>, String> {
        let i = self.index(p)?;
        let mut next = self.clone();
        let before = next.state.hands.clone();
        let events = next.apply_inner(p, i, action)?;
        if before != next.state.hands {
            next.state.offers.clear();
        }
        next.bonuses();
        let mut events = events;
        if !matches!(
            next.state.phase,
            Phase::Setup { .. } | Phase::Finished { .. }
        ) && next.points(next.active(), true) >= 10
        {
            let winner = next.active();
            next.state.phase = Phase::Finished { winner };
            next.state.offers.clear();
            events.push(Event::Won { player: winner });
        }
        next.state.revision += 1;
        *self = next;
        Ok(events)
    }
    fn pay(&mut self, i: usize, c: Resources) {
        for (r, n) in c.iter().enumerate() {
            self.state.hands[i][r] -= n;
            self.state.bank[r] += n;
        }
    }
    fn play_dev(&mut self, i: usize, kind: Development, events: &mut Vec<Event>) {
        let c = self.state.development[i]
            .iter()
            .position(|c| c.kind == kind && c.bought < self.state.opportunity)
            .unwrap();
        self.state.development[i].remove(c);
        self.state.played[i].push(kind);
        self.state.played_this_turn = true;
        events.push(Event::PlayedDevelopment {
            player: self.state.config.players[i],
            kind,
        });
    }
    fn resume(&mut self, p: PlayerId, stage: Stage) {
        self.state.phase = Phase::Turn { player: p, stage };
    }
    fn apply_inner(&mut self, p: PlayerId, i: usize, action: Action) -> Result<Vec<Event>, String> {
        if matches!(action, Action::Offer { .. } | Action::Discard { .. }) {
            return self.special(p, i, action);
        }
        if !self.legal_actions(p).contains(&action) {
            return Err("That action is not legal now. Refresh your choices.".into());
        }
        let mut events = vec![];
        let phase = self.state.phase.clone();
        let stage = if let Phase::Turn { stage, .. } = phase {
            stage
        } else {
            Stage::Actions
        };
        match action {
            Action::Settlement { vertex } => {
                self.state.buildings[vertex as usize] = Some(Building {
                    owner: Some(p),
                    color: self.state.colors[i],
                    city: false,
                });
                if let Phase::Setup { step, .. } = phase {
                    if usize::from(step) >= self.state.config.players.len() {
                        self.starting_resources(p, vertex);
                    }
                    self.state.phase = Phase::Setup {
                        player: p,
                        step,
                        settlement: Some(vertex),
                    };
                } else {
                    self.pay(i, SETTLEMENT);
                }
                events.push(Event::Built {
                    player: p,
                    kind: BuildKind::Settlement,
                    location: vertex,
                });
            }
            Action::City { vertex } => {
                self.pay(i, CITY);
                self.state.buildings[vertex as usize].as_mut().unwrap().city = true;
                events.push(Event::Built {
                    player: p,
                    kind: BuildKind::City,
                    location: vertex,
                });
            }
            Action::Road { edge } => {
                self.state.roads[edge as usize] = Some(p);
                match phase {
                    Phase::Setup { step, .. } => {
                        let step = step + 1;
                        let n = self.state.config.players.len();
                        if usize::from(step) == 2 * n {
                            self.resume(self.active(), Stage::Production);
                        } else {
                            let offset = if usize::from(step) < n {
                                usize::from(step)
                            } else {
                                2 * n - 1 - usize::from(step)
                            };
                            self.state.phase = Phase::Setup {
                                player: self.state.config.players[(self.state.first + offset) % n],
                                step,
                                settlement: None,
                            };
                        }
                    }
                    Phase::FreeRoads {
                        remaining, resume, ..
                    } => {
                        if remaining > 1 {
                            self.state.phase = Phase::FreeRoads {
                                player: p,
                                resume,
                                remaining: remaining - 1,
                            };
                        } else {
                            self.resume(p, resume);
                        }
                    }
                    _ => self.pay(i, ROAD),
                }
                events.push(Event::Built {
                    player: p,
                    kind: BuildKind::Road,
                    location: edge,
                });
            }
            Action::FinishRoads => {
                if let Phase::FreeRoads { resume, .. } = phase {
                    self.resume(p, resume);
                }
            }
            Action::Roll => {
                let dice = [
                    (sample(&mut self.state.rng, 6) + 1) as u8,
                    (sample(&mut self.state.rng, 6) + 1) as u8,
                ];
                self.state.dice = Some(dice);
                events.push(Event::Rolled { player: p, dice });
                if dice[0] + dice[1] == 7 {
                    let pending = self
                        .state
                        .hands
                        .iter()
                        .enumerate()
                        .filter(|(_, h)| total(h) > 7)
                        .map(|(i, h)| (self.state.config.players[i], (total(h) / 2) as u8))
                        .collect::<Vec<_>>();
                    self.state.phase = if pending.is_empty() {
                        Phase::Robber {
                            player: p,
                            resume: Stage::Actions,
                        }
                    } else {
                        Phase::Discard { pending }
                    };
                } else {
                    events.extend(self.produce(dice[0] + dice[1]));
                    self.resume(p, Stage::Actions);
                }
            }
            Action::EndTurn => {
                if self.extended() && !self.state.paired {
                    self.state.paired = true;
                } else {
                    self.state.paired = false;
                    self.state.primary = (self.state.primary + 1) % self.state.config.players.len();
                }
                self.state.opportunity += 1;
                self.state.played_this_turn = false;
                self.state.offers.clear();
                self.resume(
                    self.active(),
                    if self.state.paired {
                        Stage::Actions
                    } else {
                        Stage::Production
                    },
                );
                events.push(Event::Turn {
                    player: self.active(),
                    paired: self.state.paired,
                });
            }
            Action::BuyDevelopment => {
                self.pay(i, DEVELOPMENT);
                let kind = self.state.deck.pop().unwrap();
                self.state.development[i].push(DevelopmentCard {
                    kind,
                    bought: self.state.opportunity,
                });
                events.push(Event::BoughtDevelopment { player: p });
            }
            Action::MoveRobber { hex } => {
                self.state.robber = hex;
                let resume = if let Phase::Robber { resume, .. } = phase {
                    resume
                } else {
                    unreachable!()
                };
                let mut targets: Vec<_> = self.state.board.hexes[hex as usize]
                    .vertices
                    .iter()
                    .filter_map(|v| self.state.buildings[*v as usize].and_then(|b| b.owner))
                    .filter(|id| *id != p)
                    .collect();
                targets.sort();
                targets.dedup();
                if targets.is_empty() {
                    self.resume(p, resume);
                } else {
                    self.state.phase = Phase::Victim {
                        player: p,
                        resume,
                        targets,
                    };
                }
                events.push(Event::RobberMoved { hex });
            }
            Action::Steal { victim } => {
                let j = self.index(victim)?;
                let count = total(&self.state.hands[j]);
                let resource = if count > 0 {
                    let mut pick = sample(&mut self.state.rng, u32::from(count)) as u16;
                    let mut chosen = Resource::Wood;
                    for r in Resource::ALL {
                        if pick < u16::from(self.state.hands[j][r.index()]) {
                            chosen = r;
                            break;
                        }
                        pick -= u16::from(self.state.hands[j][r.index()]);
                    }
                    self.state.hands[j][chosen.index()] -= 1;
                    self.state.hands[i][chosen.index()] += 1;
                    Some(chosen)
                } else {
                    None
                };
                if let Phase::Victim { resume, .. } = phase {
                    self.resume(p, resume);
                }
                events.push(Event::Theft {
                    thief: p,
                    victim,
                    resource,
                });
            }
            Action::Knight => {
                self.play_dev(i, Development::Knight, &mut events);
                self.state.phase = Phase::Robber {
                    player: p,
                    resume: stage,
                };
            }
            Action::Monopoly { resource } => {
                self.play_dev(i, Development::Monopoly, &mut events);
                for j in 0..self.state.hands.len() {
                    if j != i {
                        let n = self.state.hands[j][resource.index()];
                        self.state.hands[j][resource.index()] = 0;
                        self.state.hands[i][resource.index()] += n;
                    }
                }
            }
            Action::Invention { resources } => {
                self.play_dev(i, Development::Invention, &mut events);
                for (r, n) in resources.iter().enumerate() {
                    self.state.bank[r] -= n;
                    self.state.hands[i][r] += n;
                }
            }
            Action::RoadBuilding => {
                self.play_dev(i, Development::RoadBuilding, &mut events);
                self.state.phase = Phase::FreeRoads {
                    player: p,
                    resume: stage,
                    remaining: 2,
                };
            }
            Action::BankTrade { give, take } => {
                let ratio = self.ratio(p, give);
                self.state.hands[i][give.index()] -= ratio;
                self.state.bank[give.index()] += ratio;
                self.state.bank[take.index()] -= 1;
                self.state.hands[i][take.index()] += 1;
                events.push(Event::Traded { a: p, b: None });
            }
            Action::Withdraw => self.state.offers.retain(|o| o.from != p),
            Action::Decline { offer } => {
                let o = self
                    .state
                    .offers
                    .iter_mut()
                    .find(|o| o.id == offer)
                    .unwrap();
                o.accepted.retain(|id| *id != p);
                if o.to == Some(p) {
                    self.state.offers.retain(|o| o.id != offer);
                }
            }
            Action::Accept { offer } => {
                let index = self
                    .state
                    .offers
                    .iter()
                    .position(|o| o.id == offer)
                    .unwrap();
                if p == self.active() {
                    self.trade(index, p, &mut events)?;
                } else {
                    let o = &mut self.state.offers[index];
                    if !o.accepted.contains(&p) {
                        o.accepted.push(p);
                    }
                }
            }
            Action::ConfirmTrade { offer, partner } => {
                let index = self
                    .state
                    .offers
                    .iter()
                    .position(|o| o.id == offer)
                    .unwrap();
                self.trade(index, partner, &mut events)?;
            }
            Action::Offer { .. } | Action::Discard { .. } => unreachable!(),
        }
        Ok(events)
    }
    fn special(&mut self, p: PlayerId, i: usize, action: Action) -> Result<Vec<Event>, String> {
        match action {
            Action::Discard { resources } => {
                let Phase::Discard { pending } = &mut self.state.phase else {
                    return Err("No discard pending".into());
                };
                let Some((_, count)) = pending.iter().find(|(id, _)| *id == p) else {
                    return Err("Already discarded".into());
                };
                if total(&resources) != u16::from(*count)
                    || !enough(&self.state.hands[i], &resources)
                {
                    return Err("Select exactly the required cards from your hand".into());
                }
                let count = *count;
                pending.retain(|(id, _)| *id != p);
                let done = pending.is_empty();
                self.pay(i, resources);
                if done {
                    self.state.phase = Phase::Robber {
                        player: self.active(),
                        resume: Stage::Actions,
                    };
                }
                Ok(vec![Event::Discarded { player: p, count }])
            }
            Action::Offer { give, take, to } => {
                if !matches!(
                    self.state.phase,
                    Phase::Turn {
                        stage: Stage::Actions,
                        ..
                    }
                ) || self.state.paired
                    || total(&give) == 0
                    || total(&take) == 0
                    || give.iter().zip(take).any(|(a, b)| *a > 0 && b > 0)
                    || !enough(&self.state.hands[i], &give)
                    || to == Some(p)
                    || to.is_some_and(|id| self.index(id).is_err())
                    || (p != self.active() && to.is_some_and(|id| id != self.active()))
                {
                    return Err(
                        "Trade only distinct resources with the active player during actions"
                            .into(),
                    );
                }
                if give
                    .iter()
                    .chain(&take)
                    .any(|n| *n > if self.extended() { 24 } else { 19 })
                {
                    return Err("Invalid trade quantity".into());
                }
                self.state.offers.retain(|o| o.from != p);
                let id = self.state.next_offer;
                self.state.next_offer += 1;
                self.state.offers.push(Offer {
                    id,
                    from: p,
                    to,
                    give,
                    take,
                    opportunity: self.state.opportunity,
                    accepted: vec![],
                });
                Ok(vec![])
            }
            _ => unreachable!(),
        }
    }
    fn trade(
        &mut self,
        offer: usize,
        partner: PlayerId,
        events: &mut Vec<Event>,
    ) -> Result<(), String> {
        let o = self.state.offers[offer].clone();
        let a = self.index(o.from)?;
        let b = self.index(partner)?;
        if o.opportunity != self.state.opportunity
            || (o.from != self.active() && partner != self.active())
            || o.to.is_some_and(|p| p != partner)
            || !enough(&self.state.hands[a], &o.give)
            || !enough(&self.state.hands[b], &o.take)
        {
            return Err("That offer is no longer available".into());
        }
        for r in 0..5 {
            self.state.hands[a][r] = self.state.hands[a][r] - o.give[r] + o.take[r];
            self.state.hands[b][r] = self.state.hands[b][r] - o.take[r] + o.give[r];
        }
        events.push(Event::Traded {
            a: o.from,
            b: Some(partner),
        });
        Ok(())
    }
    fn produce(&mut self, roll: u8) -> Vec<Event> {
        let mut requests = vec![[0u8; 5]; self.state.hands.len()];
        for (h, hex) in self.state.board.hexes.iter().enumerate() {
            if h != self.state.robber as usize
                && hex.number == roll
                && let Some(r) = hex.resource
            {
                for v in hex.vertices {
                    if let Some(b) = self.state.buildings[v as usize]
                        && let Some(p) = b.owner
                    {
                        requests[self.index(p).unwrap()][r.index()] += if b.city { 2 } else { 1 };
                    }
                }
            }
        }
        for r in 0..5 {
            let sum: u16 = requests.iter().map(|h| u16::from(h[r])).sum();
            if sum > u16::from(self.state.bank[r]) {
                let recipients = requests.iter().filter(|h| h[r] > 0).count();
                for h in &mut requests {
                    h[r] = if recipients == 1 && h[r] > 0 {
                        self.state.bank[r]
                    } else {
                        0
                    };
                }
            }
        }
        let mut events = vec![];
        for (i, resources) in requests.into_iter().enumerate() {
            if total(&resources) > 0 {
                for (r, n) in resources.iter().enumerate() {
                    self.state.bank[r] -= n;
                    self.state.hands[i][r] += n;
                }
                events.push(Event::Produced {
                    player: self.state.config.players[i],
                    resources,
                });
            }
        }
        events
    }
    pub fn events_for(&self, p: PlayerId, events: Vec<Event>) -> Vec<Event> {
        events
            .into_iter()
            .map(|e| match e {
                Event::Theft {
                    thief,
                    victim,
                    resource: _,
                } if p != thief && p != victim => Event::Theft {
                    thief,
                    victim,
                    resource: None,
                },
                other => other,
            })
            .collect()
    }
    pub fn export_checkpoint(&self) -> Result<String, String> {
        let json = serde_json::to_string(&self.state).map_err(|e| e.to_string())?;
        if json.len() > CHECKPOINT_BUDGET {
            return Err("Checkpoint exceeds domain budget".into());
        }
        Ok(json)
    }
    pub fn import_checkpoint(json: &str) -> Result<Self, String> {
        if json.len() > CHECKPOINT_BUDGET {
            return Err("Checkpoint too large".into());
        }
        let state: State = serde_json::from_str(json).map_err(|_| "Malformed CATAN checkpoint")?;
        let game = Self { state };
        game.validate_checkpoint()?;
        Ok(game)
    }
    fn validate_checkpoint(&self) -> Result<(), String> {
        let s = &self.state;
        let n = s.config.players.len();
        if s.dice
            .is_some_and(|dice| dice.iter().any(|d| !(1..=6).contains(d)))
        {
            return Err("Dice face outside 1–6".into());
        }
        if s.revision >= 1_000_000_000 {
            return Err("Revision exceeds checkpoint bound".into());
        }
        if s.next_offer == 0 {
            return Err("Next offer ID is zero".into());
        }
        if s.next_offer > s.revision + 2 {
            return Err("Next offer ID exceeds revision bound".into());
        }

        if s.version != RULES_VERSION {
            return Err("Rules version mismatch".into());
        }
        if !(3..=6).contains(&n) {
            return Err("Roster size outside 3–6".into());
        }
        if s.config
            .players
            .iter()
            .collect::<std::collections::BTreeSet<_>>()
            .len()
            != n
        {
            return Err("Roster contains duplicate IDs".into());
        }
        if s.hands.len() != n {
            return Err("Resource hand count differs from roster".into());
        }
        if s.development.len() != n {
            return Err("Development hand count differs from roster".into());
        }
        if s.played.len() != n {
            return Err("Played card count differs from roster".into());
        }
        if s.colors.len() != n {
            return Err("Color count differs from roster".into());
        }
        if s.primary >= n {
            return Err("Primary player index outside roster".into());
        }
        if s.first >= n {
            return Err("First player index outside roster".into());
        }
        if s.opportunity == 0 {
            return Err("Opportunity counter is zero".into());
        }
        if s.robber as usize >= s.board.hexes.len() {
            return Err("Robber hex outside board".into());
        }
        if s.board.hexes.len() != if n > 4 { 30 } else { 19 } {
            return Err("Hex count does not match player count".into());
        }

        let topology = Board::new(n > 4);
        if s.board.vertices != topology.vertices {
            return Err("Board vertices differ from canonical topology".into());
        }
        if s.board.edges != topology.edges {
            return Err("Board edges differ from canonical topology".into());
        }
        if s.buildings.len() != topology.vertices.len() {
            return Err("Building slots differ from canonical topology".into());
        }
        if s.roads.len() != topology.edges.len() {
            return Err("Road slots differ from canonical topology".into());
        }

        for (a, b) in s.board.hexes.iter().zip(&topology.hexes) {
            if a.q != b.q {
                return Err("Hex column differs from topology".into());
            }
            if a.r != b.r {
                return Err("Hex row differs from topology".into());
            }
            if a.vertices != b.vertices {
                return Err("Hex vertices differ from topology".into());
            }
            if a.resource.is_none() != (a.number == 0) {
                return Err("Desert and zero number disagree".into());
            }
            if a.number == 7 {
                return Err("Seven is not a number token".into());
            }
            if a.number > 12 {
                return Err("Number token exceeds twelve".into());
            }
        }
        let mut terrain = [0u8; 6];
        let mut numbers = [0u8; 13];
        for h in &s.board.hexes {
            terrain[h.resource.map_or(5, Resource::index)] += 1;
            if h.number > 0 {
                numbers[h.number as usize] += 1;
            }
        }
        if terrain
            != if n > 4 {
                [6, 6, 6, 5, 5, 2]
            } else {
                [4, 4, 4, 3, 3, 1]
            }
        {
            return Err("Terrain distribution invalid".into());
        }
        let expected = if n > 4 {
            [0, 0, 2, 3, 3, 3, 3, 0, 3, 3, 3, 3, 2]
        } else {
            [0, 0, 1, 2, 2, 2, 2, 0, 2, 2, 2, 2, 1]
        };
        if numbers != expected {
            return Err("Number token distribution invalid".into());
        }
        if s.colors.iter().any(|c| *c > 5) {
            return Err("Player color outside palette".into());
        }
        if s.colors
            .iter()
            .collect::<std::collections::BTreeSet<_>>()
            .len()
            != n
        {
            return Err("Player colors duplicated".into());
        }

        for r in 0..5 {
            if u16::from(s.bank[r]) + s.hands.iter().map(|h| u16::from(h[r])).sum::<u16>()
                != if n > 4 { 24 } else { 19 }
            {
                return Err("Resource conservation violated".into());
            }
        }
        for p in s.roads.iter().flatten() {
            if !s.config.players.contains(p) {
                return Err("Road owner outside roster".into());
            }
        }
        for b in s.buildings.iter().flatten() {
            if b.owner.is_some_and(|p| !s.config.players.contains(&p)) {
                return Err("Building owner outside roster".into());
            }
            if b.color > 5 {
                return Err("Building color outside palette".into());
            }
        }
        for p in &s.config.players {
            let roads = s.roads.iter().filter(|r| **r == Some(*p)).count();
            let settlements = s
                .buildings
                .iter()
                .flatten()
                .filter(|b| b.owner == Some(*p) && !b.city)
                .count();
            let cities = s
                .buildings
                .iter()
                .flatten()
                .filter(|b| b.owner == Some(*p) && b.city)
                .count();
            if roads > 15 {
                return Err("Road supply exceeded".into());
            }
            if settlements > 5 {
                return Err("Settlement supply exceeded".into());
            }
            if cities > 4 {
                return Err("City supply exceeded".into());
            }
        }
        let mut cards = [0; 5];
        for c in &s.deck {
            cards[*c as usize] += 1;
        }
        for hand in &s.development {
            for c in hand {
                if c.bought > s.opportunity {
                    return Err("Development purchase is in the future".into());
                }
                cards[c.kind as usize] += 1;
            }
        }
        for hand in &s.played {
            for c in hand {
                if *c == Development::VictoryPoint {
                    return Err("Victory point card cannot be played".into());
                }
                cards[*c as usize] += 1;
            }
        }
        if cards
            != if n > 4 {
                [20, 3, 3, 3, 5]
            } else {
                [14, 2, 2, 2, 5]
            }
        {
            return Err("Development card conservation violated".into());
        }
        if s.offers.len() > n {
            return Err("Offer count exceeds roster".into());
        }
        if s.board
            .ports
            .iter()
            .any(|p| p.edge as usize >= s.roads.len())
        {
            return Err("Port edge outside board".into());
        }
        if s.phase
            .actor()
            .is_some_and(|p| !s.config.players.contains(&p))
        {
            return Err("Phase actor outside roster".into());
        }

        let active = self.active();
        match &s.phase {
            Phase::Setup {
                player,
                step,
                settlement,
            } => {
                let step = usize::from(*step);
                if s.config.setup != Setup::Variable {
                    return Err("Placement phase requires variable setup".into());
                }
                if step >= 2 * n {
                    return Err("Setup step exceeds roster bound".into());
                }

                let offset = if step < n { step } else { 2 * n - 1 - step };
                if *player != s.config.players[(s.first + offset) % n] {
                    return Err("Setup player differs from placement order".into());
                }
                if settlement.is_some_and(|v| {
                    s.buildings
                        .get(v as usize)
                        .is_none_or(|b| b.is_none_or(|b| b.owner != Some(*player)))
                }) {
                    return Err("Setup settlement missing or owned by another player".into());
                }
            }
            Phase::Discard { pending } => {
                if pending.is_empty() {
                    return Err("Discard roster empty".into());
                }
                if pending.len() > n {
                    return Err("Discard roster exceeds player count".into());
                }
                if pending
                    .iter()
                    .map(|(p, _)| p)
                    .collect::<std::collections::BTreeSet<_>>()
                    .len()
                    != pending.len()
                {
                    return Err("Discard roster contains duplicate IDs".into());
                }

                for (p, count) in pending {
                    let i = self
                        .index(*p)
                        .map_err(|_| "Discard player outside roster")?;
                    if total(&s.hands[i]) <= 7 {
                        return Err("Discard player has at most seven resources".into());
                    }
                    if u16::from(*count) != total(&s.hands[i]) / 2 {
                        return Err("Discard count differs from half of hand".into());
                    }
                }
            }
            Phase::Victim {
                player, targets, ..
            } => {
                let mut expected: Vec<_> = s.board.hexes[s.robber as usize]
                    .vertices
                    .iter()
                    .filter_map(|v| s.buildings[*v as usize].and_then(|b| b.owner))
                    .filter(|p| *p != active)
                    .collect();
                expected.sort();
                expected.dedup();
                if *player != active {
                    return Err("Victim phase actor differs from active player".into());
                }
                if targets != &expected {
                    return Err("Robber victim targets differ from adjacent owners".into());
                }
                if targets.is_empty() {
                    return Err("Robber victim targets empty".into());
                }
            }
            Phase::FreeRoads {
                player, remaining, ..
            } => {
                if *player != active {
                    return Err("Free road actor differs from active player".into());
                }
                if !(1..=2).contains(remaining) {
                    return Err("Free road count outside 1–2".into());
                }
                if !s.played_this_turn {
                    return Err("Free road phase has no played development card".into());
                }
            }
            Phase::Turn { player, stage } => {
                if *player != active {
                    return Err("Turn actor differs from active player".into());
                }
                if s.paired && *stage == Stage::Production {
                    return Err("Paired player cannot have production stage".into());
                }
            }
            Phase::Robber { player, .. } => {
                if *player != active {
                    return Err("Robber player invalid".into());
                }
            }
            Phase::Finished { winner } => {
                if *winner != active {
                    return Err("Winner differs from active player".into());
                }
                if self.points(*winner, true) < 10 {
                    return Err("Winner has fewer than ten points".into());
                }
            }
        }
        if !self.extended() && s.paired {
            return Err("Paired turn requires extended board".into());
        }
        for (v, b) in s.buildings.iter().enumerate() {
            if let Some(b) = b {
                if s.board.incident(v as u8).any(|(_, e)| {
                    e.iter()
                        .any(|w| usize::from(*w) != v && s.buildings[*w as usize].is_some())
                }) {
                    return Err("Building distance violated".into());
                }
                if let Some(p) = b.owner {
                    if b.color
                        != s.colors[self.index(p).map_err(|_| "Building owner outside roster")?]
                    {
                        return Err("Building color differs from owner".into());
                    }
                } else if n != 5
                    || s.config.setup != Setup::Beginner
                    || b.city
                    || s.colors.contains(&b.color)
                {
                    return Err("Neutral building invalid".into());
                }
            }
        }
        if s.board.ports.len() != if n > 4 { 11 } else { 9 } {
            return Err("Port count invalid".into());
        }
        let mut ports = [0; 6];
        let mut edges = std::collections::BTreeSet::new();
        for port in &s.board.ports {
            if !edges.insert(port.edge) {
                return Err("Port edge duplicated".into());
            }
            let e = s.board.edges[port.edge as usize];
            if s.board
                .hexes
                .iter()
                .filter(|h| e.iter().all(|v| h.vertices.contains(v)))
                .count()
                != 1
            {
                return Err("Port must be coastal".into());
            }
            ports[port.resource.map_or(5, Resource::index)] += 1;
        }
        if ports
            != if n > 4 {
                [1, 2, 1, 1, 1, 5]
            } else {
                [1, 1, 1, 1, 1, 4]
            }
        {
            return Err("Port distribution invalid".into());
        }
        let mut owners = std::collections::BTreeSet::new();
        let mut ids = std::collections::BTreeSet::new();
        for offer in &s.offers {
            if !owners.insert(offer.from) {
                return Err("Offer owner duplicated".into());
            }
            if !ids.insert(offer.id) {
                return Err("Offer ID duplicated".into());
            }
            if offer.id >= s.next_offer {
                return Err("Offer ID exceeds counter".into());
            }
            if offer.opportunity != s.opportunity {
                return Err("Offer opportunity differs from current opportunity".into());
            }
            if !matches!(
                s.phase,
                Phase::Turn {
                    stage: Stage::Actions,
                    ..
                }
            ) {
                return Err("Offer requires action phase".into());
            }
            if s.paired {
                return Err("Paired player cannot offer trades".into());
            }
            if offer.to == Some(offer.from) {
                return Err("Offer recipient equals owner".into());
            }
            if offer.to.is_some_and(|p| !s.config.players.contains(&p)) {
                return Err("Offer recipient outside roster".into());
            }
            if offer
                .accepted
                .iter()
                .any(|p| !s.config.players.contains(p) || *p == offer.from)
            {
                return Err("Offer acceptance contains invalid player".into());
            }
            if offer.accepted.len() > n {
                return Err("Offer acceptance count exceeds roster".into());
            }
            if total(&offer.give) == 0 {
                return Err("Offer gives no resources".into());
            }
            if total(&offer.take) == 0 {
                return Err("Offer requests no resources".into());
            }
            if offer
                .give
                .iter()
                .zip(offer.take)
                .any(|(a, b)| *a > 0 && b > 0)
            {
                return Err("Offer both gives and requests the same resource".into());
            }
            if !enough(
                &s.hands[self
                    .index(offer.from)
                    .map_err(|_| "Offer owner outside roster")?],
                &offer.give,
            ) {
                return Err("Offer owner lacks offered resources".into());
            }
        }
        let mut check = self.clone();
        check.bonuses();
        if check.state.longest != s.longest {
            return Err("Longest route holder mismatch".into());
        }
        if check.state.army != s.army {
            return Err("Largest army holder mismatch".into());
        }

        Ok(())
    }
}
#[cfg(test)]
mod tests;

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Replay {
    pub version: u32,
    pub seed: [u8; 32],
    pub config: GameConfig,
    pub actions: Vec<ReplayAction>,
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ReplayAction {
    pub player: PlayerId,
    pub action: Action,
}
#[derive(Serialize, Deserialize)]
pub struct ReplayResult {
    pub version: u32,
    pub views: Vec<PlayerView>,
    pub checkpoint: String,
}
pub fn replay(input: Replay) -> Result<ReplayResult, String> {
    if input.version != RULES_VERSION || input.actions.len() > 100_000 {
        return Err("Unsupported replay version or action count".into());
    }
    let mut game = Game::new(input.seed, input.config)?;
    for entry in input.actions {
        game.apply(entry.player, entry.action)?;
    }
    Ok(ReplayResult {
        version: RULES_VERSION,
        views: game
            .players()
            .iter()
            .map(|p| game.view_for(*p))
            .collect::<Result<_, _>>()?,
        checkpoint: game.export_checkpoint()?,
    })
}

/// Public building event vocabulary; serialized spelling is replay-stable.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BuildKind {
    Road,
    Settlement,
    City,
}
