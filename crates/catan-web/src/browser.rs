use catan::{Action, Event, Phase, PlayerId, Resources, Stage};
#[cfg(feature = "fixtures")]
use catan_session::Authority;
use catan_session::Snapshot;
use std::cell::RefCell;
use table_browser::dom::{attr, disabled, document, el, escape, hidden, text};
use table_protocol::{Ack, RoomView, SignalEvent};
use wasm_bindgen::{JsCast, prelude::*};
use web_sys::{Element, HtmlInputElement, HtmlSelectElement};
#[wasm_bindgen(raw_module = "./transport.js")]
extern "C" {
    fn send_signal(value: &str) -> bool;
    fn send_peer(player: u8, value: &str);
    fn connect_room(kind: &str, name: &str, avatar: u8);
    fn leave_room();
    fn home_navigation();
    fn next_action_id() -> u64;
}
#[wasm_bindgen(raw_module = "./catan-presentation.js")]
extern "C" {
    fn before_render(events: &str, viewer: u8);
    fn after_render();
    fn cancel_motion();
    fn request_frame();
    fn sync_layout();
    fn open_sheet(id: &str);
    fn close_sheet(id: &str);
    fn show_panel(id: &str);
    fn request_fullscreen();
    fn selected_avatar() -> u8;
}
type Client = table_browser::RoomClient<catan_session::Catan>;
type Effect = table_browser::Effect<catan_session::Catan>;
struct App {
    client: Client,
}
impl std::ops::Deref for App {
    type Target = Client;
    fn deref(&self) -> &Client {
        &self.client
    }
}
impl std::ops::DerefMut for App {
    fn deref_mut(&mut self) -> &mut Client {
        &mut self.client
    }
}
thread_local! {
    static APP: RefCell<App> = const { RefCell::new(App { client: Client::new(), }) };
}

fn error(value: &str) {
    text("error", value);
    text("panel-error", value);
}

fn now() -> u64 {
    js_sys::Date::now() as u64
}
fn seed() -> Result<[u8; 32], JsValue> {
    let mut seed = [0; 32];
    web_sys::window()
        .unwrap()
        .crypto()?
        .get_random_values_with_u8_array(&mut seed)?;
    Ok(seed)
}

type GameEvent = Event;
fn presentation_flag(_app: &App) -> bool {
    false
}

fn reset_transient(_app: &mut App) {
    CHOICE.with(|c| c.borrow_mut().1 = None);
}

fn execute(effects: Vec<Effect>) -> Result<(), JsValue> {
    for effect in effects {
        match effect {
            Effect::Signal(command) => {
                send_signal(&serde_json::to_string(&command).unwrap());
            }
            Effect::Peer(player, value) => send_peer(player.0, &value),
            Effect::Render {
                snapshot,
                animate,
                resync,
            } => {
                if resync {
                    cancel_motion();
                } else {
                    before_render(
                        &serde_json::to_string(&snapshot.events).unwrap(),
                        snapshot.view.player.0,
                    );
                }
                render(&snapshot, animate)?;
                after_render();
            }
            Effect::Lobby(room, player) => lobby(&room, player)?,
            Effect::Welcome => {
                hidden("room-details", false);
                hidden("identity", true);
                hidden("leave-room", false);
            }
            Effect::Home => go_home(),
            Effect::Error(message) => error(&message),
            Effect::ResetTransient => APP.with(|c| reset_transient(&mut c.borrow_mut())),
            Effect::CancelMotion => cancel_motion(),
            Effect::UpdateStart => update_start(),
        }
    }
    Ok(())
}
fn transition(run: impl FnOnce(&mut Client) -> Result<Vec<Effect>, String>) -> Result<(), JsValue> {
    let effects = APP
        .with(|c| run(&mut c.borrow_mut().client))
        .map_err(|e| JsValue::from_str(&e))?;
    execute(effects)
}
fn publish(events: Vec<GameEvent>, ack: Option<(PlayerId, Ack)>) -> Result<(), JsValue> {
    let animate = APP.with(|c| presentation_flag(&c.borrow()));
    transition(|client| client.publish(now(), events, ack, animate))
}
#[wasm_bindgen]
pub fn signal_event(json: &str) -> Result<(), JsValue> {
    let event: SignalEvent =
        serde_json::from_str(json).map_err(|_| JsValue::from_str("Invalid signaling event"))?;
    let seed = if APP.with(|c| c.borrow().needs_seed(&event)) {
        Some(seed()?)
    } else {
        None
    };
    transition(|client| client.signal_event(event, now(), seed))
}
#[wasm_bindgen]
pub fn peer_state(player: u8, connected: bool) -> Result<(), JsValue> {
    transition(|client| client.peer_state(PlayerId(player), connected, now()))
}
#[wasm_bindgen]
pub fn network_state(connected: bool) {
    if let Err(e) = transition(|client| Ok(client.network_state(connected, now()))) {
        error(&format!("{e:?}"));
    }
}
#[wasm_bindgen]
pub fn end_session(message: &str) {
    if let Err(e) = transition(|client| Ok(client.end_session(message.into()))) {
        error(&format!("{e:?}"));
    }
}
#[wasm_bindgen]
pub fn peer_message(sender: u8, json: &str) -> Result<(), JsValue> {
    transition(|client| client.peer_message(PlayerId(sender), json, now()))
}
fn submit(action: Action) -> Result<(), JsValue> {
    let action_id = next_action_id();
    transition(|client| client.submit(action, action_id, now()))
}

const RESOURCE_NAMES: [&str; 5] = ["Wood", "Wool", "Wheat", "Brick", "Ore"];
const COLORS: [&str; 6] = [
    "#c83941", "#327cbd", "#e9e4d4", "#e98135", "#408855", "#9c61af",
];
thread_local! {static CHOICE:RefCell<(String,Option<Action>)>=const{RefCell::new((String::new(),None))};}
fn action_name(action: &Action) -> String {
    match action {
        Action::Settlement { vertex } => format!("Settlement · junction {vertex}"),
        Action::City { vertex } => format!("City · junction {vertex}"),
        Action::Road { edge } => format!("Road · route {edge}"),
        Action::Roll => "Roll dice".into(),
        Action::EndTurn => "End turn".into(),
        Action::BuyDevelopment => "Buy development · wool + wheat + ore".into(),
        Action::MoveRobber { hex } => format!("Move robber · terrain {hex}"),
        Action::Steal { victim } => format!("Rob player {}", victim.0 + 1),
        Action::Knight => "Play Knight".into(),
        Action::RoadBuilding => "Play Road Building".into(),
        Action::FinishRoads => "Finish free roads".into(),
        Action::Monopoly { resource } => format!("Monopoly · {resource:?}"),
        Action::Invention { resources } => format!("Invention · {}", resource_text(resources)),
        Action::BankTrade { give, take } => format!("{give:?} → {take:?}"),
        Action::Accept { offer } => format!("Accept offer {offer}"),
        Action::ConfirmTrade { offer, partner } => {
            format!("Confirm offer {offer} with player {}", partner.0 + 1)
        }
        Action::Decline { offer } => format!("Decline offer {offer}"),
        Action::Withdraw => "Withdraw offer".into(),
        _ => "Submit".into(),
    }
}
fn resource_text(r: &Resources) -> String {
    r.iter()
        .enumerate()
        .filter(|(_, n)| **n > 0)
        .map(|(i, n)| format!("{n} {}", RESOURCE_NAMES[i]))
        .collect::<Vec<_>>()
        .join(" + ")
}
fn location(action: &Action, v: &catan::PlayerView) -> Option<([f32; 2], &'static str)> {
    match action {
        Action::Settlement { vertex } | Action::City { vertex } => {
            let p = v.board.vertices[*vertex as usize];
            Some((
                [f32::from(p[0]) * 0.8660254, f32::from(p[1]) * 0.5],
                if matches!(action, Action::City { .. }) {
                    "city"
                } else {
                    "settlement"
                },
            ))
        }
        Action::Road { edge } => {
            let [a, b] = v.board.edges[*edge as usize];
            let a = v.board.vertices[a as usize];
            let b = v.board.vertices[b as usize];
            Some((
                [
                    f32::from(a[0] + b[0]) * 0.4330127,
                    f32::from(a[1] + b[1]) * 0.25,
                ],
                "road",
            ))
        }
        Action::MoveRobber { hex } => {
            let h = &v.board.hexes[*hex as usize];
            Some((
                [f32::from(2 * h.q + h.r) * 0.8660254, f32::from(h.r) * 1.5],
                "robber",
            ))
        }
        _ => None,
    }
}
fn render(snapshot: &Snapshot, _animate: bool) -> Result<(), JsValue> {
    let v = &snapshot.view;
    if let Some(dice) = v.dice {
        text(
            "dice-values",
            &format!("Dice: {} + {} = {}", dice[0], dice[1], dice[0] + dice[1]),
        );
        attr("board", "data-dice", &format!("{},{}", dice[0], dice[1]));
    } else {
        text("dice-values", "Roll to begin");
        let _ = el("board").remove_attribute("data-dice");
    }
    hidden("welcome", true);
    hidden("board", false);
    attr("board", "data-player", &v.player.0.to_string());
    attr("board", "data-revision", &v.revision.to_string());
    attr("board", "data-round", &snapshot.round.to_string());
    let name = |p: PlayerId| {
        snapshot
            .members
            .iter()
            .find(|m| m.id == p)
            .map_or_else(|| format!("Player {}", p.0 + 1), |m| m.name.clone())
    };
    let phase = match &v.phase {
        Phase::Setup {
            player, settlement, ..
        } => format!(
            "{} · place a starting {}",
            name(*player),
            if settlement.is_some() {
                "road"
            } else {
                "settlement"
            }
        ),
        Phase::Turn { player, stage } => format!(
            "{} · {}{}",
            name(*player),
            if *stage == Stage::Production {
                "roll for production"
            } else {
                "trade and build"
            },
            if v.paired { " · Player 2" } else { "" }
        ),
        Phase::Discard { pending } => {
            format!("Seven · waiting for {} discard selection(s)", pending.len())
        }
        Phase::Robber { player, .. } => format!("{} · move the robber", name(*player)),
        Phase::Victim { player, .. } => format!("{} · choose whom to rob", name(*player)),
        Phase::FreeRoads {
            player, remaining, ..
        } => format!("{} · place {remaining} free road(s)", name(*player)),
        Phase::Finished { winner } => format!("{} wins CATAN!", name(*winner)),
    };
    text(
        "status",
        &if snapshot.paused {
            format!("Table paused · waiting for a friend. {phase}")
        } else {
            phase.clone()
        },
    );
    text("phase-label", &phase);
    text(
        "markers",
        &format!(
            "Player 1: {}{}",
            name(v.primary),
            v.secondary
                .map_or(String::new(), |p| format!(" · Player 2: {}", name(p)))
        ),
    );
    let local_index = v.players.iter().position(|p| p.id == v.player).unwrap();
    let assets = asset_base();
    let players = (0..v.players.len())
        .map(|seat| {
            let player = &v.players[(local_index + seat) % v.players.len()];
            let member = snapshot.members.iter().find(|m| m.id == player.id);
            let connected = member.is_some_and(|m| m.connected);
            let marker = if v.secondary.is_some() && player.id == v.primary {
                "<span class='turn-marker'>Player 1</span>"
            } else if Some(player.id) == v.secondary {
                "<span class='turn-marker secondary'>Player 2</span>"
            } else { "" };
            let offer = if v.offers.iter().any(|offer|
                offer.from == player.id && (offer.to.is_none() || offer.to == Some(v.player))) {
                "<button class='offer-notice' data-sheet='trade-panel'>⇄ Trade offer</button>"
            } else { "" };
            let active = if v.phase.actor() == Some(player.id) { "active" } else { "" };
            let offline = if connected { "" } else { "offline" };
            let connection = if connected { "connected" } else { "disconnected" };
            let color = COLORS[player.color as usize];
            let id = player.id.0;
            let name = escape(&name(player.id));
            let points = player.points;
            let resources = player.resources;
            let development = player.development;
            let avatar = member.map_or(0, |member| member.avatar.min(7));
            let you = if player.id == v.player { " · You" } else { "" };
            format!(
                "<div class='player-summary {active} {offline}' style='--seat:{color}' data-seat='{id}' id='seat-{seat}'>\
                 <button class='seat-button' data-player-details='{id}' aria-label='{name} · {points} public points · {resources} resources · {development} development cards · {connection}'>\
                 <img class='avatar' src='{assets}/avatar-{avatar}.svg' alt=''/><i class='connection-dot'></i>{marker}\
                 <span class='seat-name'>{name}{you}</span><span class='seat-stats'>★ {points} · ▤ {resources} · ✦ {development}</span></button>{offer}</div>"
            )
        })
        .collect::<String>();
    el("players").set_inner_html(&players);
    attr("board", "data-count", &v.players.len().to_string());
    el("hand").set_inner_html(
        &v.hand
            .iter()
            .enumerate()
            .map(|(i, n)| {
                format!(
                    "<div class='resource resource-{i}'><span>{}</span><strong>{n}</strong></div>",
                    RESOURCE_NAMES[i]
                )
            })
            .collect::<String>(),
    );
    el("bank").set_inner_html(&v.bank.iter().enumerate().map(|(i,
        n)| format!("<button class='bank-stack resource-{i}' data-panel='supply-panel' aria-label='Supply: {n} {}'><img class='resource-icon' src='{assets}/icon-{i}.svg' alt=''/><b>{n}</b></button>",
        RESOURCE_NAMES[i])).collect::<String>());

    text(
        "supply-details",
        &format!(
            "{} · {} development cards",
            resource_text(&v.bank),
            v.development_left
        ),
    );
    let own = v.players.iter().find(|p| p.id == v.player).unwrap();
    attr(
        "board",
        "style",
        &format!("--local-color:{}", COLORS[own.color as usize]),
    );
    text("roads-left", &own.roads_left.to_string());
    text("settlements-left", &own.settlements_left.to_string());
    text("cities-left", &own.cities_left.to_string());
    text(
        "inventory",
        &format!(
            "Your pieces: {} roads · {} settlements · {} cities · Your points: {}",
            own.roads_left, own.settlements_left, own.cities_left, v.points
        ),
    );
    el("development-hand").set_inner_html(
        &v.development
            .iter()
            .map(|c| {
                format!(
                    "<button class='development-card' data-development='{:?}' style='background-image:url({assets}/development-{}.svg)' aria-label='{:?}: {}'><span>{:?}</span><small>{}</small></button>",

                    c.kind,
                         format!("{:?}",
                        c.kind).to_lowercase(),
                         c.kind,
                         if c.bought == v.opportunity { "Available next opportunity" } else { "View choices" },
                         c.kind,

                    if c.kind == catan::Development::VictoryPoint {
                        "Hidden point"
                    } else if c.bought == v.opportunity {
                        "Available next opportunity"
                    } else {
                        "Available"
                    }
                )
            })
            .collect::<String>(),
    );
    text(
        "bonuses",
        &format!(
            "Longest Route: {} · Largest Army: {}",
            v.longest.map_or("unclaimed".into(), &name),
            v.army.map_or("unclaimed".into(), &name)
        ),
    );
    let actions = if snapshot.paused {
        &[][..]
    } else {
        v.legal_actions.as_slice()
    };
    let mut buttons = String::new();
    let mut dev = String::new();
    let mut trades = String::new();
    let mut roll = String::new();
    let mut buy = String::new();
    let mut victims = String::new();
    for (i, a) in actions.iter().enumerate() {
        if location(a, v).is_some() {
            continue;
        }
        let html = format!(
            "<button data-command='{i}' data-kind='{}'>{}</button>",
            match a {
                Action::Knight => "Knight",
                Action::RoadBuilding => "RoadBuilding",
                Action::Monopoly { .. } => "Monopoly",
                Action::Invention { .. } => "Invention",
                _ => "",
            },
            escape(&action_name(a))
        );
        match a {
            Action::Roll => roll.push_str(&html),
            Action::Steal { .. } => victims.push_str(&html),
            Action::BuyDevelopment => buy.push_str(&html),
            Action::Monopoly { .. }
            | Action::Invention { .. }
            | Action::Knight
            | Action::RoadBuilding => dev.push_str(&html),
            Action::BankTrade { .. }
            | Action::Accept { .. }
            | Action::Decline { .. }
            | Action::ConfirmTrade { .. }
            | Action::Withdraw => trades.push_str(&html),
            _ => buttons.push_str(&html),
        }
    }
    el("actions").set_inner_html(&buttons);
    el("roll-action").set_inner_html(&roll);
    hidden("victim-form", victims.is_empty());
    el("victim-actions").set_inner_html(&victims);
    el("buy-development").set_inner_html(&buy);
    disabled("dice-hit", !actions.contains(&Action::Roll));
    text(
        "dice-instruction",
        if actions.contains(&Action::Roll) {
            ""
        } else if snapshot.paused {
            "Table paused"
        } else {
            &phase
        },
    );
    render_dice(v.dice.unwrap_or([1, 1]));
    el("development-actions").set_inner_html(&dev);
    el("trade-actions").set_inner_html(&trades);
    let offers = v
        .offers
        .iter()
        .map(|o| {
            format!(
                "<li><b>Offer {} · {}</b>: {} → {}{}<small>{} interested</small></li>",
                o.id,
                escape(&name(o.from)),
                resource_text(&o.give),
                resource_text(&o.take),
                o.to.map_or(" · everyone".into(), |p| format!(
                    " · to {}",
                    escape(&name(p))
                )),
                o.accepted.len()
            )
        })
        .collect::<String>();
    el("offers").set_inner_html(&offers);
    let can_trade = !snapshot.paused
        && matches!(
            v.phase,
            Phase::Turn {
                stage: Stage::Actions,
                ..
            }
        )
        && !v.paired;
    disabled("offer-submit", !can_trade);
    hidden("discard-form", v.discard_required == 0);
    text(
        "discard-label",
        &format!("Return exactly {} resource cards", v.discard_required),
    );
    disabled("discard-submit", snapshot.paused || v.discard_required == 0);
    for (i, n) in v.hand.iter().enumerate() {
        attr(&format!("discard-{i}"), "max", &n.to_string());
        attr(&format!("give-{i}"), "max", &n.to_string());
    }
    let selected = el("trade-to").dyn_into::<HtmlSelectElement>()?.value();
    el("trade-to").set_inner_html(&format!(
        "<option value=''>Everyone</option>{}",
        snapshot
            .members
            .iter()
            .filter(|m| m.id != v.player)
            .map(|m| format!("<option value='{}'>{}</option>", m.id.0, escape(&m.name)))
            .collect::<String>()
    ));
    el("trade-to")
        .dyn_into::<HtmlSelectElement>()?
        .set_value(&selected);
    CHOICE.with(|c| {
        let mut c = c.borrow_mut();
        if c.1.as_ref().is_some_and(|a| !actions.contains(a)) {
            c.1 = None;
        }
        if v.phase.actor() == Some(v.player)
            && matches!(
                v.phase,
                Phase::Setup { .. } | Phase::Robber { .. } | Phase::FreeRoads { .. }
            )
            && !actions
                .iter()
                .any(|a| location(a, v).is_some_and(|(_, kind)| kind == c.0))
        {
            c.0 = actions
                .iter()
                .find_map(|a| location(a, v).map(|(_, kind)| kind.to_string()))
                .unwrap_or_default();
        }
    });
    for (kind, id) in [
        ("road", "build-road"),
        ("settlement", "build-settlement"),
        ("city", "build-city"),
    ] {
        disabled(
            id,
            !actions
                .iter()
                .any(|a| location(a, v).is_some_and(|(_, k)| k == kind)),
        );
    }
    let required_placement = v.phase.actor() == Some(v.player)
        && matches!(
            v.phase,
            Phase::Setup { .. } | Phase::Robber { .. } | Phase::FreeRoads { .. }
        );
    if required_placement {
        hidden("trade-panel", true);
        hidden("placement-panel", false);
    }
    if v.discard_required > 0 {
        hidden("trade-panel", true);
        hidden("placement-panel", true);
    }
    if !actions.iter().any(|a| location(a, v).is_some()) {
        hidden("placement-panel", true);
    }
    if el("placement-panel").has_attribute("hidden") {
        CHOICE.with(|c| *c.borrow_mut() = (String::new(), None));
    }
    render_locations(v, actions);
    sync_layout();
    crate::graphics::set_view(v.clone());
    request_frame();
    Ok(())
}
fn render_locations(v: &catan::PlayerView, actions: &[Action]) {
    let bounds = crate::layout::bounds(v.board.hexes.len() > 19);
    let [left, top, width, height] = bounds;

    attr(
        "board-labels",
        "viewBox",
        &format!("{left} {top} {width} {height}"),
    );
    let mut labels = String::new();
    for (i, h) in v.board.hexes.iter().enumerate() {
        let x = f32::from(2 * h.q + h.r) * 0.8660254;
        let y = f32::from(h.r) * 1.5;
        labels.push_str(&format!(
            "<g id='hex-{i}' data-number='{}' data-producing='{}'><title>H{i}: {}</title>",
            h.number,
            i != v.robber as usize,
            h.resource.map_or("Desert".into(), |r| format!("{r:?}"))
        ));
        let outline = (0..6)
            .map(|i| {
                let angle = (i as f32 + 0.5) * std::f32::consts::TAU / 6.0;
                format!("{},{}", x + 0.95 * angle.cos(), y + 0.95 * angle.sin())
            })
            .collect::<Vec<_>>()
            .join(" ");
        labels.push_str(&format!(
            "<polygon class='production-outline' points='{outline}'/>"
        ));
        if h.number > 0 {
            labels.push_str(&format!("<text x='{x}' y='{}' class='number {}'>{}</text><text x='{x}' y='{}' class='probability'>{}</text>",
                y+0.09,
                if [6,
                8].contains(&h.number){"red-number"}else{""},
                h.number,
                y+0.26,
                "•".repeat((6i16-(7-i16::from(h.number)).abs())as usize)));
        }
        labels.push_str("</g>");
    }
    for port in &v.board.ports {
        let [a, b] = v.board.edges[port.edge as usize];
        let a = v.board.vertices[a as usize];
        let b = v.board.vertices[b as usize];
        let x = f32::from(a[0] + b[0]) * 0.4330127;
        let y = f32::from(a[1] + b[1]) * 0.25;
        let center = if v.board.hexes.len() > 19 {
            -0.866
        } else {
            0.0
        };
        let dx = x - center;
        let length = (dx * dx + y * y).sqrt();
        let x = x + dx / length * 0.48;
        let y = y + y / length * 0.48;
        let ratio = if port.resource.is_some() {
            "2:1"
        } else {
            "3:1"
        };
        let icon = port.resource.map_or_else(
            || {
                format!(
                    "<text x='{x}' y='{}' class='port-label'>⚓</text>",
                    y - 0.015
                )
            },
            |r| {
                format!(
                    "<image href='{}/icon-{}.svg' width='256' height='256' transform='translate({},{}) scale(.0009375)'/>",
                    asset_base(),
                    r as usize,
                    x - 0.12,
                    y - 0.23
                )
            },
        );
        labels.push_str(&format!("<path class='harbor-rope' d='M{x} {y} l{} {}'/><circle cx='{x}' cy='{y}' r='.25' class='harbor-disc'/>{icon}<text x='{x}' y='{}' class='port-label'>{ratio}</text>",
            -dx/length*0.45,
            -(y-y/length*0.48)/length*0.45,
            y+0.17));
    }
    el("board-labels").set_inner_html(&labels);
    let (kind, pending) = CHOICE.with(|c| c.borrow().clone());
    let mut targets = String::new();
    for (i, p) in v.board.vertices.iter().enumerate() {
        targets.push_str(&format!(
            "<span class='anchor' id='vertex-{i}' style='left:{}%;top:{}%'></span>",
            (f32::from(p[0]) * 0.8660254 - left) / width * 100.0,
            (f32::from(p[1]) * 0.5 - top) / height * 100.0
        ));
    }
    for (i, [a, b]) in v.board.edges.iter().enumerate() {
        let a = v.board.vertices[*a as usize];
        let b = v.board.vertices[*b as usize];
        targets.push_str(&format!(
            "<span class='anchor' id='edge-{i}' style='left:{}%;top:{}%'></span>",
            (f32::from(a[0] + b[0]) * 0.4330127 - left) / width * 100.0,
            (f32::from(a[1] + b[1]) * 0.25 - top) / height * 100.0
        ));
    }
    let mut options = String::from("<option value=''>Choose a location…</option>");
    for (i, a) in actions.iter().enumerate() {
        if let Some(([x, y], k)) = location(a, v)
            && k == kind
        {
            let selected = pending.as_ref() == Some(a);
            let angle = if let Action::Road { edge } = a {
                let [a, b] = v.board.edges[*edge as usize];
                let a = v.board.vertices[a as usize];
                let b = v.board.vertices[b as usize];
                (f32::from(b[1] - a[1]) * 0.5)
                    .atan2(f32::from(b[0] - a[0]) * 0.8660254)
                    .to_degrees()
            } else {
                0.0
            };
            let preview = if selected {
                format!("<span class='preview-piece {k}' aria-hidden='true'></span>")
            } else {
                "+".into()
            };
            targets.push_str(&format!("<button class='target {}' data-target='{i}' style='left:{}%;top:{}%;--angle:{angle}deg' aria-label='{}' aria-pressed='{selected}'>{preview}</button>",
                if selected{"selected"}else{""},
                (x-left)/width*100.0,
                (y-top)/height*100.0,
                action_name(a)));

            options.push_str(&format!(
                "<option value='{i}' {}>{}</option>",
                if selected { "selected" } else { "" },
                action_name(a)
            ));
        }
    }
    el("targets").set_inner_html(&targets);
    el("location").set_inner_html(&options);
    disabled("confirm-placement", pending.is_none());
    let cost = match kind.as_str() {
        "road" => "Road · wood + brick",
        "settlement" => "Settlement · wood + brick + wool + wheat",
        "city" => "City · 2 wheat + 3 ore",
        "robber" => "Move the robber · choose a terrain",
        _ => "Construction",
    };
    text(
        "build-cost",
        &if matches!(v.phase, Phase::Setup { .. } | Phase::FreeRoads { .. }) {
            format!("{kind} · no resource cost")
        } else {
            cost.into()
        },
    );
    text(
        "placement-preview",
        &pending.as_ref().map_or_else(
            || {
                if kind.is_empty() {
                    "No placement available".into()
                } else {
                    format!("Choose a {kind} location on the board or from the list")
                }
            },
            action_name,
        ),
    );
}
fn lobby(room: &RoomView, player: PlayerId) -> Result<(), JsValue> {
    hidden("identity", false);
    hidden("room-details", false);
    hidden("identity", true);
    hidden("leave-room", false);
    hidden("host-controls", player != room.host_id);
    let origin = web_sys::window().unwrap().location().origin()?;
    el("invite")
        .dyn_into::<HtmlInputElement>()?
        .set_value(&format!("{origin}/games/catan/#room={}", room.invite));
    el("room-size")
        .dyn_into::<HtmlSelectElement>()?
        .set_value(&room.capacity.to_string());
    el("setup").dyn_into::<HtmlSelectElement>()?.set_value(
        if room.options
            == (table_protocol::RoomOptions::Catan {
                setup: table_protocol::BoardSetup::Beginner,
            })
        {
            "beginner"
        } else {
            "variable"
        },
    );
    disabled("room-size", player != room.host_id || room.locked);
    disabled("setup", player != room.host_id || room.locked);
    text(
        "room-count",
        &format!("{} / {} humans", room.members.len(), room.capacity),
    );
    el("roster").set_inner_html(
        &room
            .members
            .iter()
            .map(|m| {
                format!(
                    "<li>{} · {}{}</li>",
                    escape(&m.name),
                    if m.connected {
                        "Connected"
                    } else {
                        "Disconnected"
                    },
                    if m.id == room.host_id { " · Host" } else { "" }
                )
            })
            .collect::<String>(),
    );
    Ok(())
}
fn update_start() {
    APP.with(|c| {
        let a = c.borrow();
        if let Some(r) = &a.room {
            let ready = r
                .members
                .iter()
                .all(|m| m.connected && (m.id == a.player || a.peers.contains(&m.id)));
            disabled(
                "start-round",
                a.player != r.host_id
                    || r.members.len() < 3
                    || !ready
                    || !a.network
                    || a.transfer.is_some()
                    || a.authority.as_ref().is_some_and(|a| !a.finished()),
            );
            text(
                "start-round",
                if r.locked { "Rematch" } else { "Start CATAN" },
            );
        }
    });
}
#[wasm_bindgen]
pub fn go_home() {
    leave_room();
    cancel_motion();
    APP.with(|c| {
        let mut a = c.borrow_mut();
        a.authority = None;
        a.staged = None;
        a.checkpoint = None;
        a.transfer = None;
        a.room = None;
        a.view = None;
        a.peers.clear();
        a.network = false;
    });
    CHOICE.with(|c| *c.borrow_mut() = (String::new(), None));
    hidden("board", true);
    hidden("welcome", false);
    hidden("identity", false);
    hidden("room-details", true);
    hidden("leave-room", true);
    hidden("join-room", true);
    hidden("create-room", false);
    text("status", "Create a table for 3–6 friends.");
    error("");
    home_navigation();
}
fn selected_resources(prefix: &str) -> Result<Resources, JsValue> {
    let mut r = [0; 5];
    for (i, n) in r.iter_mut().enumerate() {
        *n = el(&format!("{prefix}-{i}"))
            .dyn_into::<HtmlInputElement>()?
            .value()
            .parse::<u8>()
            .map_err(|_| JsValue::from_str("Use whole card counts from 0 to 24"))?;
    }
    Ok(r)
}
fn choose(index: usize) {
    let target_focused = document()
        .active_element()
        .is_some_and(|e| e.has_attribute("data-target"));
    let list_focused = document()
        .active_element()
        .is_some_and(|e| e.id() == "location");
    let action = APP.with(|c| {
        c.borrow()
            .view
            .as_ref()
            .and_then(|s| s.view.legal_actions.get(index).cloned())
    });
    if let Some(a) = action {
        CHOICE.with(|c| c.borrow_mut().1 = Some(a));
        hidden("placement-panel", false);
        refresh();
        if target_focused || list_focused {
            let _ = el(if target_focused {
                "confirm-placement"
            } else {
                "location"
            })
            .unchecked_into::<web_sys::HtmlElement>()
            .focus();
        }
    }
}
fn refresh() {
    let view = APP.with(|c| c.borrow().view.clone());
    if let Some(v) = view {
        let _ = render(&v, false);
    }
}
fn click(event: web_sys::Event) -> Result<(), JsValue> {
    let Some(target) = event.target().and_then(|t| t.dyn_into::<Element>().ok()) else {
        return Ok(());
    };
    let Some(button) = target.closest("button")? else {
        return Ok(());
    };
    if button.has_attribute("disabled") {
        return Ok(());
    }
    if let Some(id) = button
        .get_attribute("data-player-details")
        .and_then(|v| v.parse::<u8>().ok())
    {
        APP.with(|c| { let app=c.borrow(); if let Some(s)=&app.view && let Some(p)=s.view.players.iter().find(|p|p.id.0==id) {
            text("player-name", &s.members.iter().find(|m|m.id==p.id).map_or_else(||"Player".into(),|m|m.name.clone()));
            text("player-details",
                 &format!("{} public points · {} resource cards · {} development cards. Longest route: {} · Knights: {}. Supply: {} roads, {} settlements, {} cities. Played development: {:?}.",
                p.points,
                p.resources,
                p.development,
                p.route,
                p.knights,
                p.roads_left,
                p.settlements_left,
                p.cities_left,
                p.played));

            hidden("inventory",p.id!=s.view.player);
        }});
        show_panel("player-panel");
        return Ok(());
    }
    if let Some(index) = button
        .get_attribute("data-target")
        .and_then(|v| v.parse().ok())
    {
        choose(index);
        return Ok(());
    }
    if let Some(index) = button
        .get_attribute("data-command")
        .and_then(|v| v.parse::<usize>().ok())
    {
        let action = APP.with(|c| {
            c.borrow()
                .view
                .as_ref()
                .and_then(|s| s.view.legal_actions.get(index).cloned())
        });
        if let Some(a) = action {
            submit(a)?;
            if let Ok(dialog) = el("development-panel").dyn_into::<web_sys::HtmlDialogElement>() {
                dialog.close();
            }
            return Ok(());
        }
        return Ok(());
    }
    if let Some(kind) = button.get_attribute("data-build") {
        CHOICE.with(|c| *c.borrow_mut() = (kind, None));
        open_sheet("placement-panel");
        refresh();
        return Ok(());
    }
    match button.id().as_str() {
        "dice-hit" => return submit(Action::Roll),
        "confirm-placement" => {
            let action = CHOICE.with(|c| c.borrow_mut().1.take());
            if let Some(a) = action {
                close_sheet("placement-panel");
                submit(a)?;
            }
        }
        "cancel-placement" => {
            CHOICE.with(|c| c.borrow_mut().1 = None);
            close_sheet("placement-panel");
            refresh();
        }
        "discard-submit" => submit(Action::Discard {
            resources: selected_resources("discard")?,
        })?,
        "offer-submit" => {
            let to = el("trade-to")
                .dyn_into::<HtmlSelectElement>()?
                .value()
                .parse::<u8>()
                .ok()
                .map(PlayerId);
            submit(Action::Offer {
                give: selected_resources("give")?,
                take: selected_resources("take")?,
                to,
            })?;
        }
        _ => {}
    }
    match button.get_attribute("data-action").as_deref() {
        Some("create") | Some("join") => {
            let name = el("name").dyn_into::<HtmlInputElement>()?.value();
            request_fullscreen();
            connect_room(
                &button.get_attribute("data-action").unwrap(),
                &name,
                selected_avatar(),
            );
        }
        Some("start") => {
            request_fullscreen();
            send_signal("{\"type\":\"start\"}");
        }
        Some("back") => go_home(),
        Some("leave") => {
            let request = APP.with(|c| {
                let a = c.borrow();
                let r = a.room.as_ref()?;
                if a.player == r.host_id
                    && r.locked
                    && let Some(next) = r
                        .members
                        .iter()
                        .find(|m| m.id != a.player && m.connected && a.peers.contains(&m.id))
                {
                    return Some(
                        serde_json::json!({"type":"handoff_prepare",
                "successor":next.id,
                "round":r.round,
                "epoch":r.epoch})
                        .to_string(),
                    );
                }
                Some("{\"type\":\"leave\"}".into())
            });

            if let Some(request) = request {
                send_signal(&request);
            }
        }
        _ => {}
    }
    Ok(())
}
#[wasm_bindgen(start)]
pub fn start() -> Result<(), JsValue> {
    table_browser::dom::validate_required(&[
        "actions",
        "app",
        "bank",
        "board",
        "board-labels",
        "buy-development",
        "cities-left",
        "confirm-placement",
        "create-room",
        "development-actions",
        "development-hand",
        "development-panel",
        "dice-hit",
        "dice-values",
        "discard-form",
        "discard-submit",
        "error",
        "hand",
        "host-controls",
        "identity",
        "inventory",
        "invite",
        "join-room",
        "leave-room",
        "location",
        "name",
        "offer-submit",
        "offers",
        "panel-error",
        "phase-label",
        "placement-panel",
        "player-details",
        "player-name",
        "players",
        "roads-left",
        "roll-action",
        "room-details",
        "room-size",
        "roster",
        "settlements-left",
        "setup",
        "status",
        "targets",
        "trade-actions",
        "trade-panel",
        "trade-to",
        "victim-actions",
        "victim-form",
        "welcome",
    ])?;
    let click = Closure::<dyn FnMut(web_sys::Event)>::new(|event| {
        if let Err(e) = click(event) {
            error(&e.as_string().unwrap_or_else(|| "Action failed".into()));
        }
    });
    document().add_event_listener_with_callback("click", click.as_ref().unchecked_ref())?;
    click.forget();
    let change = Closure::<dyn FnMut(web_sys::Event)>::new(|event: web_sys::Event| {
        let Some(target) = event.target().and_then(|t| t.dyn_into::<Element>().ok()) else {
            return;
        };
        if target.id() == "setup" {
            let setup = target.unchecked_into::<HtmlSelectElement>().value();
            send_signal(&serde_json::json!({"type":"update_options","options":{"game":"catan","setup":setup}}).to_string());
        } else if target.id() == "location"
            && let Ok(i) = target.unchecked_into::<HtmlSelectElement>().value().parse()
        {
            choose(i);
        }
    });
    document().add_event_listener_with_callback("change", change.as_ref().unchecked_ref())?;
    change.forget();
    let timer = Closure::<dyn FnMut()>::new(|| {
        let host = APP.with(|c| {
            let mut a = c.borrow_mut();
            let player = a.player;
            let ended = a.view.as_ref().is_some_and(|v| v.ended);
            if let Some(authority) = &mut a.authority {
                authority.tick(now());
                authority
                    .snapshot(player, now(), vec![], None)
                    .is_ok_and(|v| v.ended != ended)
            } else {
                false
            }
        });
        if host {
            let _ = publish(vec![], None);
        }
    });
    web_sys::window()
        .unwrap()
        .set_interval_with_callback_and_timeout_and_arguments_0(
            timer.as_ref().unchecked_ref(),
            1000,
        )?;
    timer.forget();
    hidden("welcome", false);
    text("status", "Create a table for 3–6 friends.");
    attr("app", "data-ready", "true");
    Ok(())
}

/// Privileged integration fixture; absent from production artifacts.
#[cfg(feature = "fixtures")]
#[wasm_bindgen]
pub fn fixture_checkpoint(json: &str) -> Result<(), JsValue> {
    let game = catan::Game::import_checkpoint(json).map_err(|e| JsValue::from_str(&e))?;
    APP.with(|c| {
        let mut app = c.borrow_mut();
        let room = app
            .room
            .as_ref()
            .ok_or_else(|| JsValue::from_str("No room"))?;
        if room.host_id != app.player {
            return Err(JsValue::from_str("Only the fixture host"));
        }
        let mut authority =
            Authority::with_game(catan_session::Catan(game), room.round, room.members.clone())
                .map_err(|e| JsValue::from_str(&e))?;
        authority.set_authority(room.host_id, room.epoch);
        app.authority = Some(authority);
        Ok(())
    })?;
    publish(vec![], None)
}

fn asset_base() -> String {
    document()
        .body()
        .unwrap()
        .get_attribute("data-runtime")
        .unwrap()
        .rsplit_once('/')
        .unwrap()
        .0
        .to_string()
}
fn render_dice(values: [u8; 2]) {
    for (i, value) in values.into_iter().enumerate() {
        let positions: &[usize] = match value {
            1 => &[4],
            2 => &[0, 8],
            3 => &[0, 4, 8],
            4 => &[0, 2, 6, 8],
            5 => &[0, 2, 4, 6, 8],
            _ => &[0, 2, 3, 5, 6, 8],
        };
        el(&format!("die-{i}")).set_inner_html(
            &positions
                .iter()
                .map(|p| {
                    format!(
                        "<i class='pip' style='grid-area:{} / {}'></i>",
                        p / 3 + 1,
                        p % 3 + 1
                    )
                })
                .collect::<String>(),
        );
    }
}
/// One camera and table layout for GPU, semantic targets, seat/tray and effect anchors.
#[wasm_bindgen]
pub fn layout_table(zoom: f32, pan_x: f32, pan_y: f32, sheet: bool) {
    let Some(count) = el("board")
        .get_attribute("data-count")
        .and_then(|v| v.parse::<usize>().ok())
    else {
        return;
    };
    let extended = count > 4;
    let app = el("app");
    let layout = crate::layout::TableLayout::new(
        app.client_width() as f32,
        app.client_height() as f32,
        count,
        extended,
        sheet,
    );
    let b = layout.board;
    let [z, x, y] = layout.camera(zoom, [pan_x, pan_y]);
    attr(
        "board-stage",
        "style",
        &format!(
            "left:{}px;top:{}px;width:{}px;height:{}px;transform:translate({x}px,{y}px) scale({z})",
            b.x, b.y, b.w, b.h
        ),
    );
    if sheet
        && app.client_width() < 700
        && let Ok(Some(target)) = el("targets").query_selector(".selected")
    {
        let target = target.unchecked_into::<web_sys::HtmlElement>();
        let panel = el("placement-panel").unchecked_into::<web_sys::HtmlElement>();
        let area = crate::layout::Rect {
            x: 26.0,
            y: 200.0,
            w: (app.client_width() as f32 - 52.0).max(1.0),
            h: (panel.offset_top() as f32 - 230.0).max(1.0),
        };
        let [z, x, y] = layout.focus_camera(
            [z, x, y],
            [target.offset_left() as f32, target.offset_top() as f32],
            area,
        );
        attr(
            "board-stage",
            "style",
            &format!(
                "left:{}px;top:{}px;width:{}px;height:{}px;transform:translate({x}px,{y}px) scale({z})",
                b.x, b.y, b.w, b.h
            ),
        );
    }
    let d = layout.dice;
    attr(
        "dice-tray",
        "style",
        &format!(
            "left:{}px;top:{}px;width:{}px;height:{}px",
            d.x, d.y, d.w, d.h
        ),
    );
    for (i, [x, y]) in layout.seats.into_iter().enumerate() {
        let seat = el(&format!("seat-{i}"));
        let color = seat
            .get_attribute("style")
            .unwrap_or_default()
            .split(';')
            .next()
            .unwrap_or_default()
            .to_string();
        let _ = seat.set_attribute("style", &format!("{color};left:{x}px;top:{y}px"));
    }
}
