# CATAN: catalog integration and physical tabletop experience

Accepted product direction: September 6, 2026. Rules baseline: 2025 sixth edition.

**Implementation status: playable implementation, September 7, 2026.** Separate
Rust rules, session adapter, browser renderer and replay crates implement the
3–6-human game. Both setup modes, paired turns, room recovery, trading,
development cards and victory/rematches are integrated. The v2 presentation is a full-screen illustrated table with original SVG
paintings, textured wgpu terrain, painted pieces and semantic interactive dice; see [asset provenance](catan-assets.md).
The verification record below distinguishes automated coverage from the still
unperformed real-device performance and visual acceptance review.

## Product contract

CATAN is the catalog's second game alongside Color Match. It supports 3–6 human
players, including the official 5–6-player extension, with no bots. The experience
is a physical board viewed directly from above: detailed terrain, painted wooden
pieces, cards and animated dice. Variable setup is the default; the published
beginner setup is also required. Desktop, tablet and phone are supported, with
zoom and pan when necessary.

Rooms share invitations, connection status and deliberate host transfer. Other
expansions, two-player variants, house rules, spectators, accounts, chat, saved
games and persistent storage are outside this release. Older official material
only clarifies compatible rules; obsolete special-building-phase guidance must
not override sixth-edition paired turns.

## Loading and room boundaries

The catalog at `/` loads metadata from `/catalog.json`, catalog CSS and small
CSS previews. It initializes no game. `/games/color-match/` loads the independent
Color Match Wasm. `/games/catan/` loads its own Wasm artifact, stylesheet, artwork and audio. Navigating
between games uses ordinary page navigation, never a combined Wasm binary or a
persistent imported-game cache. Do not prefetch another game's runtime.

`table-types` holds only shared seat identity. `table-protocol` defines signaling,
typed generic action/snapshot envelopes and the explicit catalog registry.
`table-session` holds generic authority, authentication binding, acknowledgment,
revision checks, deduplication, pauses and privileged handoff. `color-match-session`
adapts Color Match to that authority. `web/table/transport.js` handles shared browser
connections; Color Match motion and audio are in `web/color-match/color-match-motion.js`.
`table-browser` supplies the shared Rust connection lifecycle to both browser crates. Do not build a downloadable plugin system or universal
rules engine.

Protocol v4 requires immutable `game_id` and `rules_version` in create, join and
resume handshakes and room metadata. The server rejects mismatched games or rules
versions before admission or credential rebinding. Checkpoints also bind these
identities. Color Match rules and replay versions remain v2.

CATAN has game-specific room setup options, frozen along with room
membership on start. Capacity defaults to four and is adjustable from three to
six before play. Start requires at least three connected humans with ready game
connections. Actual participant count selects the base board (3–4) or extension
board (5–6). Server bot commands and temporary replacements must be rejected;
CATAN disconnects pause the room until the human returns. Keep the four-hour
lifetime, 32 KiB message limit and existing reconnection deadlines.

New invitations use the game page and existing secret fragment. Root-level
legacy invitations redirect to Color Match preserving the fragment and query.
The catalog link in an active Color Match room uses the existing authenticated
leave/handoff flow before navigating. Accidental host closure still cannot
recover authority from another guest.

`scripts/build_web.py` publishes Color Match runtime files together under a
content-hashed `/assets/color-match/<hash>/` directory, then atomically updates
its entry page. Generated pages are revalidated; hashed assets are immutable.
The loading shell provides phase status, retry and return to catalog, keeping
the application inert until initialization succeeds. Extend this packaging to
CATAN without sharing either game's presentation bundle. Deployments should
retain prior release asset directories when rolling out new entry pages.

## Deterministic CATAN rules

Create separate `catan`, `catan-web` and `catan-replay` crates. Core rules must
remain independent of rendering, browser APIs, networking and storage. Use
`Game::new(seed, config)`, `Game::apply(player, action)`, `Game::view_for(player)`
and explicit validated privileged checkpoint export/import. Canonical state is
private and must not gain general serialization usable as a guest snapshot.

Stable hex, vertex and edge IDs derive from integer topology, never rendering
coordinates. Explicit phases cover setup, production, pending discards, robber
movement/victim selection, development effects, action opportunities and victory.
Preserve the interrupted phase when a development card is played before rolling.

Seeded randomness controls terrain and deck shuffles, setup, starting-player
rolls and theft. Starting-roll ties reroll among tied players. Extension variable
setup randomly chooses the initial desert. Validate before mutation or RNG
consumption; rendering and dice animation never consume rules randomness.

### Setup and components

| Component | Base | Extension addition |
| --- | --- | --- |
| Terrain | 4 forests, 4 pastures, 4 fields, 3 hills, 3 mountains, 1 desert | 2 of each productive terrain and 1 desert |
| Resource cards | 19 of each resource | 5 of each |
| Development cards | 14 Knights, 2 Monopoly, 2 Road Building, 2 Invention, 5 VP | 6 Knights, 1 of each progress type |
| Per-player pieces | 15 roads, 5 settlements, 4 cities | Same supplies for added players |

The extended board has 30 hexes, 28 numbered hexes, two deserts and additional
ports. Use prescribed number-disc ordering for variable setup and forward/reverse
starting placement. Beginner setup must reproduce published positions and starting
resources. Three-player beginner setup omits white. Five-player beginner setup
randomly assigns published colors and retains the unused color's settlements as
neutral blockers, without roads, hands, production or turns.

### Production, building and trade

Production precedes an action phase in which trading and building can interleave.
Settlements produce one resource and cities two from matching, unblocked hexes.
Resolve shortages per resource: multiple recipients receive nothing if supply is
insufficient; a sole recipient receives what remains. A seven makes eligible
players discard half their resources, rounded down, before robber movement and
theft. No trading is allowed until all seven-related decisions resolve.

| Build | Cost | Legal location |
| --- | --- | --- |
| Road | Wood + brick | Vacant connected edge |
| Settlement | Wood + brick + wool + wheat | Connected vacant vertex satisfying distance rule |
| City | 3 ore + 2 wheat | Owned settlement; return settlement to supply |
| Development card | Ore + wool + wheat | Private draw from remaining deck |

Player trades must involve the active trading player. Bank exchanges are 4:1,
3:1 through general ports, or 2:1 for an owned matching resource port. No gifts
or exchanges with overlapping resource types. Robber presence does not disable
construction or ports.

Use structured broadcast or addressed offers with give/request selections,
accept, decline, withdraw and counteroffer. A broadcast requires the active
player to select a partner. Keep one outstanding offer per participant; offers
do not reserve cards. Final acceptance revalidates both hands and exchanges
atomically. Resource changes and opportunity transitions invalidate offers.
Bind offers to round/opportunity; stale requests receive a fresh view without
partial exchanges or duplicate effects. Private discard submissions must remain
resubmittable after stale revisions so concurrent discards cannot deadlock.

### Development cards, awards and victory

Cards cannot be played in their purchase opportunity, except VP cards revealed
to win. Play at most one non-VP development card per opportunity, before rolling
or during actions. Knight activates the robber without seven discards; Monopoly
collects a chosen resource from opponents; Invention takes two available bank
resources; Road Building places up to two legal free roads. Development cards
cannot be traded, stolen or counted toward seven-discard thresholds. Use
sixth-edition played-card presentation.

Use “Longest Route / Longest Road” and “Invention / Year of Plenty” in help.
Longest Route is an exact edge-trail search: no reused edge, and opponents'
buildings prevent traversal through their vertices. Cover loops, branches,
interruptions, incumbent ties, unclaimed qualifying ties and reassignment.
Largest Army counts played Knights only. Victory is ten points during the
eligible player's turn, including the extension's second player's opportunity.

Robber movement may target a desert. Handle empty-handed victims and no eligible
victim. Theft identity is visible only to thief and victim. Public hand counts
must not reveal private development identities or hidden victory points.

### Paired turns

For 5–6 players, Player 1 completes production and actions. Player 2, three seats
clockwise, gets an action phase without player-to-player trading, but can bank
trade, build, play an eligible development card and win. Both markers advance
clockwise afterward. Development-card eligibility advances between a player's
separate action opportunities. Do not implement the older special building phase.

### Privacy, checkpoints and replay

A guest receives their own hand and legal choices plus public board, counts,
offers and recipient-filtered events. Never send other hands, hidden VP cards,
development identities, shuffled deck, RNG or checkpoints to ordinary guests.
DOM, logs and animation data follow the same filtering rules.

Only the chosen successor receives a privileged checkpoint. Include pending
decisions, paired turns, eligibility and unresolved offers, but no accumulated
history. Checkpoints and wrapped messages must remain within 32 KiB. Validate
imports before activating authority. Preserve the trusted-browser-host limitation.

Add native and `wasm32-wasip2` replay execution with identical golden outcomes and
checkpoint continuation. Browser code remains `wasm32-unknown-unknown`; WASI
components run through Wasmtime, not directly in browsers.

## Physical tabletop presentation

Use Rust with direct wgpu for the board and Rust-driven semantic DOM controls for
hands, trades, room tools and accessible interaction. A fixed orthographic overhead
camera views textured shallow meshes, wooden pieces, lighting and animated dice.
Try WebGPU first, then WebGL2 with downlevel-compatible limits/shaders and no
compute-dependent effects. Both must be demonstrated in the early visual proof.
DOM/SVG was considered for a flatter board; Bevy's broader lifecycle is unnecessary
for this stationary scene. Color Match retains its DOM renderer.

Create original artwork/models with recorded provenance, not extracted rulebook
images. Required assets: varied terrain, shoreline/coastal frame, ports, resource
and development faces/backs, bonus tiles, raised number discs with probability
dots, roads, settlements, larger cities, robber, dice, material textures and sound.
Show cardboard thickness/bevels, wood/felt table, directional light and soft contact
shadows. Keep detail clear of placement targets; use shape and labels as well as
color to distinguish resources and ownership.

The active table fills `100dvh`, with no document scroll or persistent sidebar.
The overhead island stays centered and consistently oriented. The local player
and hand sit at the bottom; opponents appear clockwise relative to that seat:
3 players use upper left/right; 4 use left/top/right; 5 use left/upper left/upper
right/right; 6 use lower left/upper left/top/upper right/lower right. Narrow
screens compact opponents along the upper perimeter. Eight animal portraits use
existing `Member.avatar` values and survive reconnect/handoff/rematch.

A visible lower-right dice tray contains two large pip dice and **Roll dice**.
Both submit the same Rust action; unavailable dice explain the current decision,
retain the last result and show **End turn** when legal. Resource stacks, the
piece rack, public points/card counts and connection status remain visible at
rest. The private development fan opens eligible choices. Supply and bonus tiles
expand into details. Room, Rules, Sound, Motion and Fullscreen occupy a compact
corner menu; fullscreen denial or Escape preserves the viewport layout.

Build costs and legal targets appear when selecting a piece. Confirmation shows
the actual piece shape at the chosen target. Trades use anchored icon/quantity
panels, with offer notifications at the offering seat. Discards, setup and robber
decisions open their controls immediately. Phone sheets reserve island space
above construction; the compact hand expands independently. All actions have
semantic buttons, visible keyboard focus and 44-pixel touch targets. No permanent
hex IDs clutter the island; IDs remain in descriptions and the legal-location list.

`catan-web/src/layout.rs` is the presentation geometry source of truth. The GPU,
SVG text, DOM targets and animation anchors share its rectangle and transform.
Terrain uses an sRGB UV atlas with two deterministic art variants per resource,
five linear-light mip levels and capability-checked 4× MSAA (one-sample fallback).
Terrain and piece buffers are retained independently. Artwork loads only within
CATAN's hashed release and participates in loading failure/retry. See the
[rendering decision](../adr/002-rendering.md) and [asset provenance](catan-assets.md).

Road/Settlement/City selection highlights Rust-projected legal targets. Hover/tap
previews cost and location; a separate confirmation commits, with cancellation
available. Dragging is optional. Provide keyboard target navigation and an
equivalent semantic location list, plus live phase/dice/decision announcements.

Animate authoritative dice over roughly 900 ms using authored trajectories with
correct final faces. Animate production from bank to hand, payment back to bank,
piece placement, city replacement, robber/concealed theft, participant trades,
private development purchases, public development plays and bonus transfers.
Resources circulate through bank/hands, never Color Match's central discard pile.

Canonical updates apply immediately; ordered animation queues never block
networking or require completion acknowledgment. Revision gaps, reconnects,
handoff and rematches cancel obsolete effects and render the latest view.
Separate motion/sound controls; default motion to the user's reduced-motion
preference. Audio starts only after interaction. Idle scenes stop requesting
frames. Graphics-context recovery rebuilds from the current player view while
retaining the session.

## Implementation and verification

- `catan`: integer topology; seeded setup, dice and theft; transactional actions;
  private views/events; validated checkpoints; exact route search and awards.
- `catan-session`: shared authority adapter without bots, with setup binding.
- `catan-web`: Rust wgpu meshes and materials plus semantic DOM controls.
  WebGPU is attempted first, followed by WebGL2 on a fresh canvas. Device/context
  recovery rebuilds graphics from the current view without replacing the session.
- `table-browser`: shared Rust room lifecycle, independently compiled into each game.
- `catan-replay`: native and `wasm32-wasip2` command replay. Browser Wasm remains
  `wasm32-unknown-unknown`; Wasmtime executes the WASI component.

`make check-rust` covers rule boundaries, conservation, privacy, awards and
session recovery. Eight full-game fixtures cover every count/setup combination,
ending in victory after 305–971 actions. Checkpoints are restored throughout.
`make check-replay` compares byte-identical native/WASI/golden results.

CATAN browser tests cover three-human play and host transfer, variable placement
using keyboard controls, six-human paired turns, victory/rematch, four-human
phone layout and graphics recovery. These pass in Chromium, Firefox and WebKit.
A separate Chromium software-adapter test verifies WebGPU; forced WebGL2 is
exercised across the engines. Request capture checks independent runtime loading.
The scoring fixture exists only in test builds; production excludes it.
`make check-turn` includes CATAN and Color Match room tests through local coturn.

The implementation uses original SVG paintings rasterized into a mipmapped GPU
atlas, with procedural pieces and shoreline meshes. Populated-table screenshots
cover desktop, tablet portrait/landscape and phone sizes; the
[validation record](../validation.md) lists actual checks and measurements.
Physical-device GPU memory/frame timing and user visual acceptance remain
separate from software-adapter browser verification.

## Official references

- [CATAN overview](https://www.catan.com/catan)
- [2025 base rulebook](https://www.catan.com/sites/default/files/2025-03/CN3081%20CATAN%E2%80%93The%20Game%20Rulebook%20secure%20%281%29.pdf)
- [2025 extension rulebook](https://www.catan.com/sites/default/files/2025-03/CN3082%20CATAN%20%E2%80%93%205-6%20Rulebook%202025%20reduced.pdf)
- [Compatible older almanac](https://www.catan.com/sites/default/files/2021-06/catan_base_rules_2020_200707.pdf)
- [Physical-game reference](https://www.catan.com/sites/default/files/2024-01/Rules%203D-CATAN.pdf)
- [Base-game FAQ](https://www.catan.com/faq/basegame), excluding obsolete extension rules
- [wgpu browser guidance](https://wgpu.rs/doc/wgpu/documentation/platforms/web/index.html)
- [wgpu downlevel limits](https://wgpu.rs/doc/wgpu/struct.Limits.html)
