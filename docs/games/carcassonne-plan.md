# Carcassonne Big Box implementation plan

Status: implementation delivered September 11, 2026; independent tabletop and physical Safari validation remain outstanding. See [implemented rules, conventions and limitations](carcassonne.md) and [validation evidence](../validation.md).

The remainder preserves the original planning scope for comparison.

This document is the deliverable of a research and planning session. All coding,
asset creation, dependency changes, and application testing below belong to a
later session. Creating this file does not authorize executing the plan.

## Outcome and expansion scope

Interpret “Carcassonne the extended version” as **Carcassonne Big Box 3.1 (2025)**:
the base game and the eleven expansions included in that box. The publisher's
shop identifies this as its current Big Box, and its rules index distinguishes
3.1 from the older 3.0 and 2.1 editions.
[Current Big Box](https://cundco.de/carcassonne-big-box-de/),
[official rules index](https://cundco.de/spielregeln/cc-grundspiel-erweiterungen).

Support **2–6 players**, using the six player sets in the selected rulebook. Some
older/general product pages still say 2–5; do not let that override the chosen
box's components. Use the 3.1 rules in both English and Spanish. Do not combine
familiar older expansion rules with the newer tiles or figures.

The final deliverable must include the base game with farmers and these selectable
modules: The River, The Abbot, Inns & Cathedrals, Traders & Builders, The Flying
Machines, The Messages, The Ferries, The Gold Mines, The Magicians, The Robbers,
and The Crop Circles. All eleven are in scope, including their combinations.

Offer a restrained default, **Expanded Classic**: farmers, River, Abbot, Inns &
Cathedrals, and Traders & Builders. Also offer **Base**, **Learn** (the documented
beginner mode without farmers), **Full Big Box**, and custom module selection.
Explain that Full Big Box is a long game; the selected rulebook estimates
100–120 minutes. Preset names other than the box name are app conveniences.

Exclude expansions sold outside this box, anniversary bonus rules, cooperative
Mists over Carcassonne, solo variants, bots, accounts, matchmaking, spectators,
and tournaments. Implementing the base game alone is an intermediate milestone,
not completion of the requested expanded game.

Build a beautiful, readable landscape with tactile tile placement, expressive
meeples, connected-feature highlights, and clear scoring. Use the existing
Bun/TypeScript, SvelteKit, Socket.IO, Paraglide, CSS, and SVG architecture. No
database, Redis, Rust/Wasm, WebRTC, or new extension framework is required.

## Research record and source authority

The English 3.1 booklet was read in full. Spanish sections were cross-checked for
the important edition changes. The tile manifest and gold scoring chart on English
pages 22–23 were inspected as rendered images, as PDF text extraction loses tile
geometry and sometimes repeats digits. Relevant sections of the current expansion
FAQ were also read.

The browser tool rejected the large PDFs because of their size; they were
successfully downloaded to temporary files and read locally. Those downloads are
research material, not application assets or additional repository deliverables.

| Source                                                                                                        | Purpose                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Big Box 3.1 English rules](https://cundco.de/media/26/95/90/1773929268/CC_BigBox_3.1_rule.pdf?ts=1773929331) | Primary baseline: base/farmers pp. 3–8; modules pp. 9–21; inventory pp. 22–23; turn sequence p. 24.                                                                  |
| [Big Box 3.1 Spanish rules](https://cundco.de/media/9c/19/53/1775038679/CC_BB_3.1_Regla_ES.pdf?ts=1775038679) | Official Spanish wording and cross-check of 3.1 mechanics, with the same page structure.                                                                             |
| [Current expansion FAQ](https://cundco.de/media/cc/c6/4c/1758720966/CC_expansions_FAQ.pdf?ts=1779209619)      | Figure classification, distinct-tile scoring, and combinations of the current major expansions. Do not assume this answers every Big Box mini-expansion interaction. |
| [Official versioned rules index](https://cundco.de/spielregeln/cc-grundspiel-erweiterungen)                   | Recover current PDF links if their storage paths change; verify the exact edition.                                                                                   |
| [Publisher's general Big Box page](https://www.hans-im-glueck.de/en/game/carcassonne-big-box-3/)              | Confirms the expanded-box concept; older names, capacity, and linked rules are not the selected baseline.                                                            |

### Core rules to preserve

A turn draws and legally places one tile, optionally places a meeple, then scores
completed features. Tiles join edge-to-edge with matching terrain on every touching
edge. An unplaceable draw is discarded and replaced. Ordinary deployment cannot
enter an occupied connected feature. Later connections can merge occupied features;
majority strength scores, with full awards for tied leaders.

Completed roads score one per tile; cities two per tile and shield; surrounded
monasteries nine. Scored meeples return. At game end, unfinished roads score one
per tile, cities one per tile/shield, and monasteries one plus occupied neighboring
positions. Farmers score three per distinct completed city touching their field.
Tied final leaders share victory. [English rules, pp. 4–8](https://cundco.de/media/26/95/90/1773929268/CC_BigBox_3.1_rule.pdf?ts=1773929331).

### Important 3.1 differences

Unfinished inn roads and cathedral cities retain ordinary final points. The builder
is assigned alongside a traveler/knight and returns when triggering an extra turn.
The pig accompanies a farmer; completing a shield-bearing city triggers all pigs,
awarding three per completed city touching each pig's field, ignoring majority.
Pigs return, optionally with their assigned farmers, and have no final-scoring
bonus. [Spanish rules, pp. 10–14](https://cundco.de/media/9c/19/53/1775038679/CC_BB_3.1_Regla_ES.pdf?ts=1775038679).

These must have explicit regression fixtures. Do not substitute the older zero
points for unfinished inns/cathedrals, a permanently deployed builder, or the old
pig farm multiplier.

## Module coverage and implementation contracts

Treat these as engineering coverage requirements tied to the booklet sections.
The exact legal targets, timing, exceptions, and component quantities must come
from the selected edition, with the bounded follow-up checks below completed before
claiming full fidelity.

| Module             | Required behavior and interaction tests                                                                                                                                                                                 | Reference             |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| River              | Dedicated opening stack, source/lake ordering, river bend restrictions, separation of river banks, extra river tiles supplied by the major expansions, and transition to ordinary draws. No meeple on the river itself. | p. 9                  |
| Abbot              | Monastery/garden targets, exclusive garden eligibility, normal completion, optional early retrieval in place of meeple deployment, and incomplete-feature scoring.                                                      | p. 9                  |
| Inns & Cathedrals  | Completed-feature bonuses, ordinary 3.1 unfinished scoring, large-meeple strength, and exact branched/terminated road geometry.                                                                                         | pp. 10–11             |
| Traders & Builders | Goods go to the completing player independently of ownership; per-type final majorities; builder/meeple attachment and extra-turn scheduling; global pig triggers and optional farmer recovery.                         | pp. 12–14             |
| Flying Machines    | Server-generated die outcome, rotated straight/diagonal travel, eligible landing choices, occupied-feature exception, failed landing, and allowed meeple types. No arbitrary fallback placement after failure.          | p. 15                 |
| Messages           | Two independent score markers, one marker choice per turn, active-player message eligibility, one message per turn, all eight message actions, cycling message stack, and final consolidation.                          | p. 16                 |
| Ferries            | Meeple-before-ferry order, connection choice, eligible first-ferry changes, road splitting/merging, reopened previously scored roads, and the distinction between tile extension and ferry movement for builders.       | p. 17                 |
| Gold Mines         | Tile-level gold placement, completion eligibility, monastery surroundings, player-selected feature resolution order, shared-majority distribution, and final quantity-based gold value.                                 | p. 18 and chart p. 23 |
| Magicians          | Required relocation, incomplete-feature eligibility, collision after features merge, modifier order, return on completion, and final scoring. Neutral figures do not block normal occupation.                           | p. 19                 |
| Robbers            | Pre-placement choices, score-space occupancy, turn-total reward, multiple eligible victims, non-chaining robber awards, marker-following behavior, and final unused-robber award.                                       | p. 20                 |
| Crop Circles       | Post-turn global add/remove choice, correct participant order and affected meeple types, ineligible-player skipping, and attachment cleanup when a meeple is removed.                                                   | p. 21                 |

For Messages, create eight separate, reviewed outcomes corresponding to its
numbered tiles. Do not reduce them to a generic “gain points” action. Retain the
selected booklet's distinction between scoring as though holding a majority,
actually requiring majority, returning a figure, and retaining it.

For score-track mechanics, keep absolute totals and the physical track space
separate. A marker's space repeats after a lap; a number-only leaderboard cannot
represent robber co-location correctly. Never deduct points from a victim merely
because the UI calls an award “robbery.”

### Bounded research and interpretation checklist

These checks refine uncommon combinations; they do not justify replacing known
3.1 rules with older ones or dropping difficult modules.

1. **Inventory and topology transcription.** Convert every tile in pp. 22–23 into
   a reviewed manifest with exact multiplicities, garden variants, inn/river/goods
   symbols, flight directions, field partitions, and road junctions. Reconcile
   landscape tiles separately from message tiles, scoring aids, and figures.
   Verify setup when River is disabled: its module-specific river tiles must not
   become ordinary unmatched-river draws.
2. **Combined score timing.** Confirm the detailed order of goods, multiple
   shield-city pig triggers, gold distribution, robber awards, and Messages when
   one placement affects several features or players. Page 24 gives the broad
   sequence but omits some substeps. Define which awards count toward the same
   turn total and which move a chosen score marker without triggering another
   message. Confirm zero-award cases.
3. **Extra-turn boundaries.** Resolve builder plus extra-turn message plus Crop
   Circles timing, including the last drawable tile and automatic discarded draws.
   Record whether a new extra turn permits a new message and exactly when the
   clockwise player finally becomes active. Do not impose a guessed “one extra
   turn globally” limit or create a message loop inside a single turn.
4. **Unusual feature changes.** Check ferry movement affecting completed features,
   mage/witch co-location, attached figures, and gold; flight-created multiple
   monastery occupation; and message scoring of features modified by other
   modules. Distinguish actual completion from a message's provisional scoring.
5. **Edge cases and translation differences.** Confirm zero collected goods tied
   for most, any no-legal-target global action, marker wrapping, and mini-expansion
   exceptions not covered in the major-expansion FAQ. Use a publisher clarification
   or the corresponding German 3.1 passage if English and Spanish disagree.

Record findings, page references, and concrete fixtures in the future rules
document. If an authoritative answer remains unavailable, document a deterministic
app convention and its gameplay impact; do not present it as a confirmed printed
rule. Independent work can proceed while a narrow interaction remains unresolved.

## User experience and art direction

### An inviting, readable landscape

Use an original illustrated map: warm limestone cities with terracotta roofs,
meadow greens, blue rivers, pale paths, and carved-looking meeples. The surrounding
surface should be restrained parchment or warm charcoal so the board remains the
focus. Use SVG geometry and small decorative details rather than rasterized
commercial tiles or a 3D game engine.

At playing scale, all road endpoints, city edges, field boundaries, shields, inns,
and expansion symbols must be unmistakable. Decorative cottages, animals, and
trees cannot imply connections or barriers the rules do not recognize. Meeple
colors get distinct shapes/patterns or badges for accessibility. Farmers visibly
lie down; large meeples have a distinguishable silhouette; attached pigs/builders
stay visibly linked to their specific meeple.

Use a restrained display face for game headings and highly readable sans-serif
labels for choices, score explanations, and tooltips. Avoid placing paragraphs
directly over map art. Give the current tile and its controls generous space.

### Board navigation

The board uses an effectively unbounded integer grid. Pan and zoom with pointer,
touch, and keyboard; provide zoom buttons, “Fit landscape,” “Current tile,” and
“Last move.” Anchor zoom to the pointer or pinch midpoint. A small minimap is
useful when the full-box landscape grows; it must not conceal placement controls.

Keep screen coordinates entirely separate from canonical tile coordinates.
Touching/dragging empty space pans; tapping a legal location previews a placement.
Apply a movement threshold so panning cannot accidentally place a tile. A second
confirmation commits the location and rotation. Keyboard users can cycle legal
locations, rotate in quarter turns, and confirm without dragging.

Use a viewport with stable edge controls. Desktop: player strip above, tile tray
and action controls near the bottom, expandable event/score panel at the side.
Mobile: compact player strip, large tile preview, bottom action sheet, and optional
full-screen feature inspection. Do not zoom the entire late-game board so far out
that a playable tile becomes too small to target.

### Player journey

1. **Catalog and lobby.** Add a miniature original tile landscape, localized
   description, and 2–6 capacity. Reuse invite links, names, token reconnection,
   and the host's start action.
2. **Game-owned setup.** Host start opens expansion setup before drawing. Any
   player may propose the visible preset/options; a change clears readiness.
   Everyone readies for the same configuration. Display 3.1 prominently in rules
   help, use whole-module toggles, and lock them for the match. Do not silently
   ignore a symbol on a tile belonging to an enabled expansion.
3. **Starting player.** Offer a seat selector so the group can nominate the
   youngest player without collecting dates of birth. Default to the first seat;
   label this as an app convenience. Fix clockwise seat order for the match.
4. **Draw.** Reveal the current tile publicly, show remaining count, and identify
   the player whose decision is required. If Robbers intervene before placement,
   show that prompt first. Automatically replace a tile only after the server
   proves there is no legal placement in any rotation.
5. **Place.** Highlight legal frontier locations. Show an opaque enough ghost tile
   to inspect every edge, 90-degree rotation controls, and a clear confirm action.
   Explain a rejected edge mismatch visually and with text. Local previews never
   mutate the board and cannot undo an already accepted placement.
6. **Resolve placement effects.** Prompt for gold or magic targets when required.
   Visually distinguish tiles from connected-feature targets. An explicit pending
   action explains why normal meeple placement has not begun yet.
7. **Deploy or retrieve.** Highlight actual eligible roads, cities, monasteries,
   gardens, and field regions. Selecting a region outlines the entire connected
   feature and explains occupancy/strength. Show available standard, large, or
   abbot choices and permitted attached figures. Include “Place no meeple” and
   legal abbot retrieval. Warn succinctly that farmers normally stay until the
   end; do not invent an early recall action.
8. **Special movement.** Flying commits the decision before the die is rolled,
   then presents legal landing features. Ferry control displays the two connected
   road arms and a preview of the resulting network before confirmation.
9. **Score.** Outline every completed feature and show its calculation, majority,
   figure returns, and relevant expansion modifiers. When order or target selection
   affects gold/robbers/score markers, ask the entitled player through a focused
   prompt. Automatic substeps need no extra “Continue” clicks.
10. **After-turn actions.** Give each Crop Circle participant a clear add/remove
    interface in the correct order. A builder or message extra turn visibly keeps
    the appropriate player active with an explanation; do not rotate seats early.
11. **Inspect at any time.** Tapping any feature shows its connected area, owners,
    open ends, distinct tile count, modifiers, and completed cities touching a
    field. Label current estimates as provisional. A public history links a score
    entry to its feature even after meeples return.
12. **Endgame.** After all pending actions settle, present an itemized final score
    for unfinished features, fields, goods, gold, and remaining module awards.
    Show shared winners if tied and the host's ordinary rematch action. Rematch
    returns to setup with fresh state.

The ordinary current tile and every accepted map placement are public. Hidden
information is the future draw order and unrevealed message stack, not opponents'
meeple positions. Help should emphasize spatial choices rather than pretending
players have hidden hands.

### Animation and optional sound

| Accepted event or local preview | Presentation                                             | Target duration           |
| ------------------------------- | -------------------------------------------------------- | ------------------------- |
| Current tile drawn              | Tile turns over into the tray                            | 200–300 ms                |
| Local tile rotated              | Quarter-turn around its center                           | 120–180 ms                |
| Tile placement accepted         | Short descent, contact shadow, seam highlight            | 220–320 ms                |
| Meeple placed                   | Small landing motion; attached figure settles alongside  | 180–260 ms                |
| Feature selected                | Connected outline fades in; open ends become visible     | 100–160 ms                |
| Flight resolved                 | Die result followed by a short path to the actual target | 400–650 ms                |
| Ferry changed                   | Ferry pivots; old/new road connections crossfade         | 220–350 ms                |
| Feature scored                  | Feature glow, point label, returning meeples             | 350–550 ms                |
| Goods/gold awarded              | Tokens travel toward their owners' inventories           | 250–400 ms                |
| Message or robber effect        | Marker move and a concise effect label                   | 250–450 ms                |
| Game finished                   | Gentle final landscape sweep and winner highlight        | Under 1 second; skippable |

Motion should explain what changed without making a long expansion game slower.
Use CSS/Svelte transitions or Web Animations with SVG; favor transform/opacity.
No perpetual camera drift, compulsory cinematic zoom, screen shake, or continuous
effects obscuring tile boundaries. Do not auto-pan while a player is interacting;
provide a “Show event” control for distant changes.

Generate typed presentation events only from accepted rule actions and project
them through recipient views, following the boundary established for Catan.
Include match, turn, revision/event sequence, affected feature geometry, and the
public reason for the event. Rejected moves may produce local error feedback but
never a successful placement, flight reroll, or scoring animation.

The authoritative state updates immediately. Animation does not award points,
consume randomness, or decide when the next player is allowed to act. On reconnect,
snapshot gaps, seat changes, resize, or changed motion preferences, cancel obsolete
effects and show current state without replaying the historical queue.

Respect `prefers-reduced-motion` and a per-game setting. Replace travel and camera
motion with short fades or immediate updates. Optional wood/stone, token, and
score sounds unlock through a user gesture; mute is always accessible, and audio
failure never blocks play. Persist only sound/motion and harmless view preferences.

### Accessibility and responsive acceptance

- All actions work with keyboard, touch, and pointer. Tile placement never requires
  dragging; provide visible focus and primary targets at least 44 CSS pixels.
- Give every target a concise accessible description: location, feature, legal
  status, occupancy, and effect. Provide a text/list alternative to map-only
  selection for legal locations and connected features.
- Differentiate field regions, selected features, and meeple owners without color
  alone. Use transparent fills that preserve roads and city walls underneath.
- Announce turn/prompt changes and scored results in restrained live regions.
  Avoid hundreds of individual tile announcements when panning or fitting the map.
- Keep focus inside modal choices and return it sensibly; settings/help must not
  erase a pending game choice. Group identical out-of-supply figures clearly.
- Verify 360-pixel phones, tablet orientations, desktop, zoomed browser text,
  Spanish expansion names, six-player scores, and a completed full-box landscape.

## Rules architecture and data design

Implement `games/carcassonne` using the existing `GameDefinition` contract. Keep
rules independent of DOM, networking, and storage; use the supplied random source
for shuffles and flight dice. Invalid intentions must leave state unchanged.

Suggested modules are `tiles.ts` for the exact manifest, `features.ts` for graph
queries, `scoring.ts`, `index.ts` for game state/actions and turn resolution,
`presentation.ts`, and focused expansion modules when their behavior warrants a
separate file. Do not create a generic expansion/plugin engine for the catalog.

### Tile topology is the critical foundation

Each tile definition must contain:

- A stable rules ID, module provenance, quantity, and the exact illustrated variant.
- Four edge signatures, local road/city/field regions, and how those regions connect
  across each edge. Include the field portions on both sides of road exits.
- Internal connections and separations: city corners, road ends, true junctions,
  bridges, river banks, ferry lake arms, and Crop Circle boundaries.
- Monastery/garden positions and city-to-field adjacency, plus shields, goods,
  inns, flight direction, and other enabled module symbols.
- A mapping between logical regions and original SVG hit areas/meeple anchors.

Terrain edge labels alone are insufficient: two cities on one tile may be separate,
fields on opposite sides of a road may not connect, and a junction can either
terminate roads or join them depending on the actual tile. Rotation transforms
both topology and interaction anchors together in quarter turns.

Use a sparse map keyed by integer coordinates. Compute connected components with
clear graph traversal initially; the box is small enough to favor correctness over
a complex incremental cache. **Do not rely on a merge-only union-find structure**:
ferries can disconnect roads and reopen scored features. Recompute the affected
components, or the full small graph if profiling permits, after such changes.

Count distinct tiles per feature, not segment instances. Record distinct completed
city identities touching each field so one city contributes once to that field,
even if it touches repeatedly. The same city may legitimately border different
fields. A field never completes merely because it is enclosed.

Separate completeness from whether an award has already been processed in the
current resolution. A permanent `scored = true` flag cannot represent a road that
a ferry reopens. Use topology-aware completion checks and transaction-scoped
award records; fixture-test a reopened road becoming complete again.

### State and turn resolution

Canonical state owns selected modules, fixed seats, draw/river stacks, current
public tile, map, figures, explicit figure attachments, inventories, absolute
score-marker totals, robber positions, ferries, neutral figures, gold locations,
message stack, active turn, pending decisions, extra turns, score events, and
final results. `RoomView.round` identifies a whole match/rematch; use a separate
game turn counter.

Use game-owned phases/pending actions such as `setup`, `draw`, `robberPlacement`,
`tilePlacement`, `placementEffects`, `meepleChoice`, `flightLanding`, `ferryChoice`,
`scoring`, `messageChoice`, `cropCircle`, and `finished`. Automatic transitions can
run until the next legitimate choice. Store the continuation so a reconnect never
rerolls a die, awards goods again, or skips another player's decision.

Page 24 provides the high-level sequence: pre-placement robbers, tile placement,
tile effects, meeple action and attachments, ferry actions, scoring/marker effects,
message, and post-turn Crop Circles. Expand that into a reviewed ordering table
including pigs, goods, gold, and extra turns before implementing combined modules.
Never derive resolution order from animation duration or socket arrival order.

Model each scoring transaction with its cause, feature, recipients, base points,
modifiers, total, figure returns, and secondary awards. Distinguish completion,
provisional message scoring, abbot retrieval, pig scoring, robber awards, and final
scoring. They do not all trigger the same downstream effects. Use the same results
to render clear score receipts, but keep display strings localized outside rules.

For Messages, store the selected scoring marker at the correct scope for each
player's turn awards. For Robbers, use the marker's physical score-track space and
explicit point provenance to prevent reward loops. Gold distribution uses eligible
owners and explicit choices, not a generic “share equally” arithmetic shortcut.

Legal-action generation and `apply` validation must use the same topology/rule
queries. Client previews may use public data but never replace server validation.
Exhaustively check frontier cells and rotations before discarding a drawn tile;
never allow a player to reject a merely inconvenient legal draw.

### Information boundary

| Public projection                                                                                                                                                                                         | Server-only state                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Board, current drawn tile, active/pending actor, enabled modules, remaining counts, figure supplies/positions, goods/gold holdings, revealed flight results, scores/markers, and resolved public actions. | Future tile order, unrevealed message order, random state/seed, reconnect credentials, and internal debugging data. |

Any pending choice includes its authorized seat and legal target references. Use
allowlisted projections rather than spreading canonical state. All tile artwork
can be in the lazy game bundle because tile types are public; future order must
never enter snapshots, URLs, localStorage, logs, errors, or presentation events.
The host has no privileged deck viewer or reroll control.

Drawn tiles and die results stay fixed across errors and reconnections. Requests
contain intentions and expected turn/prompt identity; actor identity comes from
the server socket binding. Other players cannot place a tile, choose a landing,
retrieve a figure, or choose someone else's message response.

## Integration and room lifecycle

Use the current [architecture](../architecture.md),
[game contract](../../packages/game-core/src/index.ts),
[room authority](../../apps/server/src/rooms.ts), and
[validation guide](../validation.md). Reinspect them when implementation starts:
there are unrelated workspace changes and other unimplemented game plans.

| Location                                                                                                     | Later change                                                                                        |
| ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `games/carcassonne/package.json`, `src/`                                                                     | Exact rules/data, graph and scoring tests, lazy Svelte board, original SVG, help, and presentation. |
| `apps/server/src/index.ts`, `apps/server/package.json`                                                       | Rule registration and workspace dependency.                                                         |
| `packages/shared/src/index.ts`                                                                               | Metadata-only `carcassonne` entry with description, limits, and landscape preview.                  |
| `apps/web/src/lib/games.ts`, `apps/web/package.json`                                                         | One dynamic board import and workspace dependency.                                                  |
| `apps/web/src/routes/+page.svelte`                                                                           | Original catalog preview and ordinary room creation.                                                |
| `apps/web/src/routes/room/[id]/+page.svelte`                                                                 | Existing room shell with game-owned setup, map, and results.                                        |
| `apps/web/src/lib/session.svelte.ts`, server room/socket files                                               | Only narrowly required pending-action, error, readiness, and retry handling.                        |
| `packages/shared/messages/en.json`, `es.json`                                                                | Localized controls, expansion names, rules, target descriptions, errors, and score explanations.    |
| `apps/server/src/rooms.test.ts`, `socket.test.ts`, `tests/e2e/carcassonne.spec.ts`                           | Authority, privacy, reconnect, and browser behavior.                                                |
| `README.md`, `docs/architecture.md`, `docs/validation.md`, `docs/games/carcassonne.md`, affected `AGENTS.md` | Implemented scope, exact edition, clarified interactions, instructions, and actual evidence.        |

Use Bun workspace linkage and update its lockfile later with `bun install`.
Do not install new optional skills/plugins. The implementation should use current
dependencies unless a demonstrated need warrants a specific addition.

The server already rejects stale revisions and deduplicates action IDs. Preserve
those protections. On a stale rejection, refresh and retain a local preview only
if the same turn/prompt remains valid; require reconfirmation for consequential
changed choices. For simultaneous setup readiness, use narrowly bounded retries
with the original action ID only while the same setup version and seat eligibility
still apply. Never replay a placement into the next player's turn or retry a draw
by consuming new randomness after an unknown timeout.

Disconnecting a required actor pauses that decision with a visible reason. Preserve
the current tile, rolled flight result, pending score transaction, and extra-turn
queue. Existing reserved-seat/replacement semantics remain: replacement inherits
the same seat's figures, score, and pending choice, with a new token; expired
credentials lose access. Do not silently forfeit, auto-place, or let the host play
someone else's turn. Reset unconsumed setup readiness on seat replacement through
a narrow presence guard and require connected seats before the initial deal.

State remains in memory and is lost on server restart, as in the current catalog.
After a legitimate match result, the existing host rematch action creates fresh
setup. No deployment or persistent storage work is part of this plan.

## Ordered execution plan for a later session

1. **Freeze rules and topology.** Verify the edition, complete the bounded research
   checklist, transcribe the tile manifest, and review logical regions against the
   appendix images. Define deterministic fixtures and the combined turn-order
   table. Exit: each tile and unresolved branch has a source and explicit meaning.
2. **Implement the pure base game.** Build rotations, legal placement, connected
   features, occupation, strengths, completion, final scoring, farmers, and private
   projections. Exit: complete seeded matches and focused topology cases pass.
3. **Add Expanded Classic.** Implement River, Abbot, Inns & Cathedrals, and the 3.1
   Traders & Builders. Exit: exact new-edition behaviors, river setup, attachments,
   and extra turns work. A playable subset is still not the completed full plan.
4. **Add all seven remaining mini-expansions.** Build their typed decision prompts,
   dynamic graph changes, score-marker mechanics, and combined resolution. Exit:
   each module works alone and in relevant combinations, including Full Big Box.
5. **Integrate rooms and complete UI.** Add catalog/server/client registration,
   setup presets, readable map, navigation, tile preview, feature inspection,
   actions, receipts, localization, and reconnection. Exit: a group can finish a
   game without developer tools or manual score correction.
6. **Finish visuals and animation.** Apply original tile/figure art, responsive
   layout, accepted-event animation, reduced motion, and optional sound. Exit:
   mobile/full-box play stays readable and responsive without hiding legal choices.
7. **Validate and document.** Run the checks below, real multiplayer playtests,
   actual Safari review, and update affected docs. Exit: required evidence passes
   or genuine external validation limitations are recorded accurately.

## Validation plan

### Rules, topology, and inventory

Use hand-authored position fixtures and independent expected results rather than
tests that compare an implementation table with itself.

- Exact tile/figure/token conservation for every preset; legal module combinations;
  distinct source/start/lake handling; no duplicate or omitted river tiles.
- Every tile variant in all four rotations, including gardens, separated city
  regions, multi-ended roads, nonconnecting bridge crossings, fields around roads,
  river banks, ferry arms, and Crop Circle boundaries.
- Full matching against all adjacent edges; no isolated/diagonal-only placement;
  exhaustively unplaceable draw replacement; no legal-draw rejection exploit.
- Remote connected occupation checks, merging competing owners, tied strengths,
  large meeple, multiple segments on one tile, road loops, and simultaneous
  completion of several cities/roads/neighboring monasteries.
- Farmer permanence in ordinary play, field majority, repeated contacts with the
  same completed city, one city bordering several fields, and incomplete-city
  exclusion. Verify expansion exceptions through explicit actions.
- New 3.1 unfinished scoring, goods awarded to a nonowner completer, builder
  consumption and extra turn, attachment cleanup, global pig trigger and farmer
  retrieval. Include cases that would produce a different result under old rules.
- River bends and major-expansion river tiles, abbot retrieval/completion, flight
  landing/miss after a fixed roll, occupied-feature landing, and illegal flyer
  figure types.
- Ferry split/merge/reopen/rescore, first-ferry eligibility, altered majority,
  and no builder trigger from ferry movement alone.
- Gold quantity thresholds (1–3, 4–6, 7–9, 10+), chosen completion ordering,
  tied eligible recipients, monastery coverage, and no final unclaimed-gold award.
- Mage/witch placement, collision, rounding, cathedral interaction, and final
  modifiers; Messages actions 1–8, marker choice, one-message boundary, and final
  consolidation; Robbers before placement, wrapping score spaces, victim choices,
  no chain awards, marker following, and final remaining-robber handling.
- Crop Circle action selection and participant order, skipped ineligible seats,
  meeple supply limits, and figure attachments returned on removal.
- Last tile with pending scoring, Messages, Crop Circles, and extra turns; exactly
  one final scoring; tied victory; rematch resets all module state.

Validate setup for all module-toggle combinations where feasible without running
a long match for every combination. Use meaningful pairwise interaction fixtures,
several full-box seeded runs at different player counts, and a long board stress
case. Compare graph query results before/after mutations to a simple recomputed
reference when introducing any later cache.

### Authority, presentation, and browser behavior

Use independent socket clients to cover impersonation, invalid targets, wrong
actors during global prompts, stale revisions, duplicate IDs, unknown timeouts,
token expiry, replacement, host migration, and reconnect at every decision phase.
Verify that accepted tile draws, dice, gold awards, messages, and scoring never
repeat. Inspect actual recipient payloads for future deck/message information.

Use isolated test fixtures with the same rules and seeded randomness; never ship
a production debug endpoint, fixture deck, or all-state projection to the browser.
Browser journeys should include:

- A complete base/Expanded Classic game through final scoring and rematch.
- Tile rotation, all-neighbor legality feedback, skip meeple, and field inspection.
- Mobile pan/pinch/zoom and keyboard-only tile/feature selection.
- A six-player Full Big Box layout, long landscape navigation, and distant event
  inspection without interrupting the user's camera.
- Builder extra turn, pig retrieval, flight landing, ferry reconnection, score
  marker choice, a message, gold distribution, and Crop Circle participation.
- Reconnection during flight, scoring choice, and a nonactive seat's global action.
- English/Spanish switching, long labels, focus restoration, motion preference,
  mute, denied/unavailable audio, and clean resynchronization without replay.
- Catalog lazy loading and existing UNO/Catan regression coverage.

Run from the root during implementation:

```sh
bun run check
bun run test
bun run build
bun run test:e2e --project=chromium
bun run test:e2e --project=webkit
bun run format:check
```

Format maintained changed files before the final formatting check. Run appropriate
targeted tests during work and required broader checks once ready. Repeat passing
checks only after new changes or evidence warrants it. Report unavailable checks
as unverified.

Chrome and Safari are required targets. Chromium and WebKit automation do not
replace actual macOS/iOS Safari validation for touch navigation, SVG hit areas,
focus, resizing, animation, and gesture-unlocked audio. Conduct real group playtests
with Expanded Classic and Full Big Box; assess whether field ownership, extra-turn
timing, scoring choices, and late-game navigation are understandable without a
developer explaining them.

## Completion criteria

- The exact Big Box 3.1 base game and all eleven included modules work for 2–6
  players, independently and in supported combinations, with no older-rule mixing.
- Tile topology, legal placement, dynamic feature changes, and final scoring are
  deterministic, authoritative, and covered by meaningful tests.
- Original map art and animations make play clear and lively while preserving
  accessibility, responsiveness, and silent/reduced-motion functionality.
- Reconnects preserve every pending choice and random outcome; hidden future
  information stays server-side.
- Required checks pass; rules clarifications, app conventions, and actual device
  and group-play evidence are documented.

The original planning session changed only this file. Implementation was subsequently authorized and is documented in the linked rules and validation records.
