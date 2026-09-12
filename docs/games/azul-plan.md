# Azul implementation plan

Status: research and planning only. No implementation authorized by this document.

Prepared September 11, 2026. Execute in a later session only when requested. All checkboxes below describe future work; none claim completed implementation or validation.

## Outcome and scope

Add original **Azul**, using the standard colored wall, to the existing catalog. Deliver a complete 2–4 player game with authoritative rules, clear English/Spanish controls, a polished ceramic table, and readable movement that makes other players' actions feel present. The publisher lists the original game as 2–4 players and approximately 30–45 minutes. [Publisher product page](https://www.nextmove-games.com/en/azul/azul-game/)

Include multiplayer rooms, reconnect/replacement behavior, results, rematches, contextual help, and a small local demonstration route for learning and visual verification. The demonstration uses switchable human seats and deterministic fixtures, not bots or a separate rules implementation.

Defer the gray-wall variant, expansions, other Azul titles, AI opponents, matchmaking, spectators, accounts, persistence, and turn timers. The gray wall introduces placement decisions during scoring and needs its own future design. Do not quietly blend its rules into the standard game.

## Research and rules baseline

Use these primary sources; the rulebooks take precedence over summaries:

| Source                                                                                                                                | Use                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Next Move English rulebook](https://cdn.svc.asmodee.net/production-nextmove/uploads/sites/4/2024/06/EN-Azul-Rules-Next-Move-web.pdf) | Printed pp. 2–4: setup, drafting, pattern lines and wall transfer; p. 5: scoring, penalties and refill; p. 6: ending, ties and variant boundary. |
| [Asmodee Spanish rulebook](https://cdn.svc.asmodee.net/production-asmodeees/uploads/2023/06/Reglas_Azul.pdf)                          | Official terminology and cross-check of scoring/round rules. Two PDF sheets contain printed pp. 2–6.                                             |
| [Asmodee Spain product page](https://www.asmodee.es/product/azul/)                                                                    | Publisher-hosted provenance for the Spanish download.                                                                                            |

The following is an implementation checklist, not a reproduction of the manuals. Keep source links in the eventual help panel and rules document.

### Setup and drafting

- Inventory: 20 tiles in each of five colors; one separate first-player marker. Scores start at zero.
- Use 5/7/9 factories for 2/3/4 players, initially four random tiles each.
- Turns follow clockwise seating. Pick every tile of one color from one factory or the center; factory leftovers enter the center.
- The first center pick also claims the marker, occupying the next floor slot before tile overflow.
- Use one pattern line per pick: capacities 1–5, filled right-to-left; existing tiles must match, and that wall row must not already contain the color. Excess goes to the floor. Choosing the floor directly is legal. No passing, splitting between pattern lines, or selecting the marker alone.
- Drafting ends when all colored tiles leave factories and center.
- Resolve completed lines top-to-bottom: transfer one tile to its matching wall cell, score immediately, discard the rest. Incomplete lines persist.

Source: [English rulebook, printed pp. 2–4](https://cdn.svc.asmodee.net/production-nextmove/uploads/sites/4/2024/06/EN-Azul-Rules-Next-Move-web.pdf).

### Scoring, refill and ending

- An isolated wall tile earns 1. Otherwise sum contiguous horizontal and vertical run lengths for axes with neighbors, including the new tile in each. Diagonals and gaps do not connect.
- Floor slots cost `1, 1, 2, 2, 2, 3, 3`; excess colored tiles are discarded without further penalty. Apply penalties after wall points, clamping the score at zero. Clear the floor; retain marker ownership.
- Refill factories from the bag; when empty, recycle discards and continue. If both are exhausted, use partially filled factories. The marker holder starts next; return the marker to center.
- End after everyone's wall scoring and penalties when any wall row is complete. Add 2 per complete row, 7 per complete column, and 10 per completed color set. Highest score wins; ties favor more complete rows, then shared victory.

Source: [Spanish rulebook, printed pp. 5–6](https://cdn.svc.asmodee.net/production-asmodeees/uploads/2023/06/Reglas_Azul.pdf).

### Explicit adaptation and interpretation decisions

These are proposed digital decisions, distinguished from directly stated rules:

1. **First match starter:** the printed setup uses the player who most recently visited Portugal. Default to a uniformly random seat, disclose this in help and the start announcement, and use the injected random source. Do not collect travel history. Later rounds follow marker ownership normally. This is the only intentional setup substitution.
2. **Full floor when claiming the marker:** the manuals do not explicitly explain its placement when seven slots are already occupied. Proposed interpretation: retain it beside the board, preserve next-start ownership, and cap penalties at the seven printed slots. Never put it in the tile bag/discard inventory. Before locking the rules tests, seek a publisher clarification; if none is available, document this interpretation explicitly in `docs/games/azul.md`.
3. **Marker unclaimed at round end:** possible when every factory is emptied without leftovers. Proposed interpretation: retain the previous starter, reset the marker to center, and advance without an extra marker-only turn. Verify against any available publisher clarification during implementation; otherwise label the fallback in the rules document.
4. **Presentation time:** automatic wall resolution and refill happen in one accepted server action. The client presents their ordered steps afterward; clients never send scoring, refill, or animation-complete actions.
5. **Seating:** lobby order is the clockwise order. Rotating the table relative to the viewer must not change it. No gameplay undo after acceptance, because the move has affected public information and other players' choices.

Do not invent a fixed round limit, award bonuses each round, or stop scoring at the first completed row. Do not cap numeric scores at the printed track length.

## Repository fit and boundaries

The inspected workspace already has the necessary architecture. Follow [architecture](../architecture.md), [ADR 009](../adr/009-typescript-catalog.md), [ADR 010](../adr/010-bun-runtime.md), [ADR 011](../adr/011-catan-presentation.md), and [validation](../validation.md).

- Create `games/azul`, a Bun/TypeScript workspace package exposing `./server`, `./Board.svelte`, and a separate `./practice` entry if needed for the demonstration.
- Implement the current `GameDefinition` methods: `create`, `apply`, `view`, `isFinished`; use player limits 2 and 4. Rules receive explicit randomness and depend on no DOM, sockets, audio, or storage.
- Register rules in `apps/server/src/index.ts`, metadata in `packages/shared/src/index.ts`, and a dynamic board import in `apps/web/src/lib/games.ts`. Add workspace dependencies to both app manifests; update `bun.lock` through Bun.
- Add an explicit tile preview branch to `apps/web/src/routes/+page.svelte`; its current non-card fallback draws Catan hexes. Catalog artwork must remain lightweight and must not import Azul rules or the board.
- Reuse the room component's existing `view`, `playerId`, `players`, `send`, `locale`, `round`, `connected`, and `pending` props. Inspect the room toolbar's game-specific language/settings behavior before integrating Azul so controls do not overlap or appear twice.
- Preserve Socket.IO actor binding, revision checks, accepted-action deduplication, seat tokens, host-controlled start/rematch, and existing disconnect grace. Never accept an actor ID from an Azul action.
- Put all messages in the English and Spanish Paraglide catalogs. Do not manually edit generated localization files.
- Keep presentation, assets, legal-move helpers, and fixtures within Azul. Reuse the existing patterns without extracting a universal board or animation framework.
- No Rust/Wasm, database, Redis, WebRTC, or dependencies from `../zombies-game`. No optional extension installation is necessary.

There were already unrelated working-tree edits, including session/room code, shared metadata, and UNO/Catan files, when this plan was written. Re-read their current contents and local instructions when execution starts; preserve those edits and adapt the integration points rather than overwriting them.

## Rules and data design

Keep the initial module set small: `index.ts` for contract/state/actions, `rules.ts` for pure placement/scoring helpers if useful, `presentation.ts` for event types, `Board.svelte` and focused UI components, and `practice.ts` for isolated fixtures. Add files only where they separate real responsibilities.

### Canonical state and projection

Represent tile colors as a five-member union. Arrays/counts are sufficient; physical per-tile identities are unnecessary. State contains seating, active seat, internal Azul round number, game action revision, phase (`drafting` or `finished` at published boundaries), factories, center, bag, discards, marker location/owner, and each player's pattern lines, wall occupancy, floor slots, and score. Include final bonus breakdowns and an array of winner IDs to support shared victory.

Keep `RoomView.round` as the existing match/rematch generation. Use a distinct `roundNumber` for Azul's drafting rounds. Keep the game action revision separate from room revisions, which also change on connection events.

The public view contains every player's visible board and score, available tiles, turn/round/marker status, results, and the latest accepted presentation batch. Azul has no secret player hand; return an empty private projection unless a demonstrated recipient-only need appears. Whitelist fields: never serialize bag order, random seed/state, canonical internals, or reconnect credentials into the game view or events. Visible draw animations reveal only the newly dealt factory contents.

Encode the standard wall's color mapping as one immutable constant shared by rules and UI. Cross-check all 25 cells against the publisher's board illustration before implementation tests are accepted. Test it against an independently transcribed expected layout, not another formula derived from the same constant.

### Action and transition

Use one atomic gameplay intention, conceptually:

```ts
type DraftAction = {
  type: 'DRAFT';
  source: { kind: 'factory'; index: number } | { kind: 'center' };
  color: TileColor;
  destination: { kind: 'pattern'; row: number } | { kind: 'floor' };
};
```

Validate the unknown payload, bounded integer indices, actor turn, phase, available color, and destination before mutation or consuming randomness. Derive quantities on the server. A chosen legal pattern line takes as many selected tiles as fit; the explicit floor destination sends the whole pick there. Reject malformed or obsolete intentions without modifying state, score, revision, events, or random consumption.

An accepted action applies the draft, advances the turn, or resolves the exhausted round. For round resolution, process each player's wall in row order, record scoring explanations, apply floor deductions, determine ending/bonuses, and refill only when continuing. Resolve all players even if an early processed player triggers the ending condition.

Maintain per-color conservation across bag, factories, center, pattern lines, wall, floor, and discards. Keep the unique marker outside that conservation equation. Shuffle only with injected randomness; when refilling, finish drawing existing bag contents before recycling discards. No client timers may advance rules.

## Visual and interaction design

### Art direction: a ceramic workshop table

Use a deep ink-blue tabletop, warm ivory player boards, cobalt borders, restrained brass accents, and tactile ceramic tiles with beveled edges, a small glaze highlight, and soft contact shadows. Suggested starting tokens: tabletop `#142C43`, board `#F7EEDB`, ink `#172B3A`, accent `#B98432`; verify text and control contrast after composing the actual surfaces.

Create original CSS/SVG motifs for the five recognizable tile families: blue, yellow, red, black, and white with cyan decoration. Each family also gets a distinct small pattern/symbol and an accessible name; color is never the only distinction. Use low-opacity previews of the same motifs in empty wall cells, with clearly different occupied-cell treatment. Draw factory plates with restrained ornamental rims and four stable tile positions. Avoid copying publisher logos or scanned board art into application assets.

Use a modest display serif for the game heading and a highly readable UI font for controls and scores, favoring already available fonts. Decoration belongs on surfaces and margins, not behind score numbers or interactive text. Build the board as actual spatial game pieces, not a dashboard of generic cards.

### Layout

| Context                              | Required arrangement                                                                                                                                                                                                                                                                         |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop, roughly 1280×800 and larger | Central factory ring and center pool; local board prominent below or beside it; opponent boards around the remaining space; persistent turn, round and scores. Preserve readable pattern-to-wall alignment.                                                                                  |
| Tablet, roughly 768×1024             | Factories above the local board; opponent summaries in a compact strip with expandable full boards. Keep all factory sources accessible without tiny targets.                                                                                                                                |
| Phone, test 390×844 and 360×640      | Stable factory grid and grouped center colors, local board beneath, opponent-board sheet, and a sticky selection/confirm bar. Use internal vertical scrolling within the immersive room, safe-area padding, and no horizontal page scrolling. Do not shrink the entire desktop table to fit. |

All players' pattern lines, walls, floor penalties and scores must be inspectable during any turn. On compact layouts, opponent summaries show more than scores: include pattern occupancy and floor risk, with one action to open the full board. Keep player ordering stable and show whose turn it is with both text and a border/icon.

Group large center pools by color with an explicit quantity while keeping the selection rule visible. Keep factory identity stable after it empties. Allow large touch targets around small tile visuals; target at least 44×44 CSS pixels for actionable groups and controls.

### Turn flow

1. Hover/focus a source color to highlight the whole selectable group and display its quantity. Tap/click selects it locally without sending a move.
2. Show matching legal pattern destinations and the floor. Explain unavailable rows in plain language, such as “This row already has blue on its wall.”
3. Selecting a destination previews incoming tiles, overflow, and any marker penalty. Label score estimates as estimates; no wall points are earned during drafting. Show exact immediate placement/floor consequences rather than speculative strategy advice.
4. A clear confirmation button summarizes the move, for example “Take 3 blue → line 2 · 1 to floor.” Cancel or Escape clears it. Keyboard users can perform the entire flow; dragging is not required.
5. While awaiting acknowledgement, show pending feedback and prevent duplicate submissions. On acceptance, animate the move. On rejection or changed revision, clear the stale preview, retain canonical pieces, and explain what changed.

Keep controls disabled when disconnected, pending, finished, or not the active player; allow reading boards/help throughout. Never silently submit a preview after reconnecting.

Provide concise help for picking, completing lines, scoring, penalties, and the ending trigger, including an illustrated cross-scoring example. Follow official Spanish terminology such as “líneas de patrón” and “alicatado.” Include translated accessible names, plural quantities, error messages, and shared-victory copy. Keep the existing room language control; the Azul settings menu holds sound, motion, and help without duplicating that control.

Results retain the final boards and show wall points, floor deductions, end bonuses, total, and any tiebreak explanation. Distinguish raw floor deductions from actual score lost due to the zero clamp. Keep the ordinary host rematch action available.

## Animation and sound specification

Animations explain accepted changes. They must make tile travel and scoring readable without delaying authoritative play.

| Event                 | Treatment                                                                          | Initial timing target            |
| --------------------- | ---------------------------------------------------------------------------------- | -------------------------------- |
| Local hover/selection | Slight tile lift, visible focus ring, group outline; destination preview           | 100–140 ms                       |
| Accepted factory pick | Selected group travels to the player's pattern/floor; leftovers slide into center  | 250–350 ms, small stagger        |
| First-player marker   | Distinct marker travel and next-starter badge update                               | 220–300 ms                       |
| Overflow              | Small downward motion into available floor slots; excess fades toward discard area | 200–280 ms                       |
| Wall transfer         | One tile per completed line travels into its wall cell, top-to-bottom              | 200–260 ms per row               |
| Wall scoring          | Trace contributing horizontal/vertical cells; show a compact `+N` explanation      | 300–450 ms, overlapping transfer |
| Floor scoring         | Highlight occupied penalty slots and update the score                              | 350–500 ms                       |
| Next-round deal       | Tiles emerge face-down from the bag area and reveal only at factories              | 450–700 ms total                 |
| Ending                | Highlight completed structures and reveal bonus breakdown; restrained tile sparkle | 700–1000 ms, skippable           |

Treat timings as tuning targets. Resolve player boards in parallel visually and aim for a full round presentation around 2–3 seconds, not a long sequence for every player. Provide “Skip animation” to settle immediately; activating a legal new-turn control also settles any remaining decoration before interaction.

Generate typed events inside the accepted rules transition: draft transfer, center spill, marker claim, floor overflow/discard, wall placement with scoring cells and point delta, floor penalty with actual score delta, round deal, and finish/bonuses. Record intermediate steps while resolving the round: a before/after snapshot diff alone loses information when scoring and refill share one action. Events describe public locations, colors/counts, and results, never hidden bag order.

Use a bounded latest-event batch with a game revision and event index, following the Catan boundary. Render once only for consecutive game revisions in the same match, seat and uninterrupted connection. On first load, reconnect, gaps, seat/match changes, resize/orientation changes, tab restoration, or motion setting changes, cancel obsolete effects and settle to the latest snapshot. Room-only updates must not replay game events. Animate off-screen opponent activity toward its visible summary, then show the correct full board when opened.

Use Svelte, CSS transforms/opacity and the Web Animations API. Temporary flying tiles are noninteractive and hidden from assistive technology. Keep canonical state authoritative under the presentation overlay; no timeout, transition event, sound completion, or skipped animation changes the game.

Honor `prefers-reduced-motion` and a saved Azul motion preference. Reduced motion removes flights, bounces, pulses and sparkles; retain instant placement, scoring text and status announcements. Persist preferences defensively when storage is available. Optional soft ceramic clicks, marker taps and scoring chimes use gesture-unlocked Web Audio, with mute and volume control; denied/unavailable audio never blocks play. Do not replay sounds after reconnect or returning to a hidden tab.

## Future execution sequence

### 1. Lock the rules contract

- [ ] Re-read instructions/current code; inspect outstanding user edits.
- [ ] Verify standard wall mapping and marker interpretations above; create `docs/games/azul.md` with source links, explicit scope and adaptation notes.
- [ ] Specify independent scoring examples, tile-conservation fixtures and public view fields before implementing the reducer.
- [ ] Record any substantial architectural choice in a new ADR only if it changes an existing boundary; otherwise document the Azul application of ADR 011.

Exit: implementers can decide every base-game action and transition without silently inventing a variant.

### 2. Build and verify the game package

- [ ] Implement state, runtime action validation, pure rule helpers, deterministic setup/refill, projection and results.
- [ ] Add rule tests from the matrix below, including complete seeded games for every supported player count.
- [ ] Add accepted presentation events while intermediate resolution facts are available.

Exit: meaningful rules tests pass, invalid actions preserve state/randomness, and inventory is conserved through full games.

### 3. Integrate rooms and catalog

- [ ] Add package exports, app dependencies, server registry, metadata and lazy UI registration.
- [ ] Add original catalog tile artwork and English/Spanish descriptions.
- [ ] Verify ordinary create/join/start/reconnect/replacement/rematch through the existing server protocol.
- [ ] Check runtime input handling and privacy over real Socket.IO connections.

Exit: a minimal board can play through the real authoritative room flow with 2–4 clients.

### 4. Build the finished table and local demonstration

- [ ] Implement tile, factory, player-board, selection/confirmation, opponent-inspection, help and results UI.
- [ ] Add `/practice/azul` lazily with separate fixtures and switchable projected seats; use the same board and rules. Make its local-demo nature clear.
- [ ] Cover empty selection, legal/illegal previews, center overflow, round scoring, reconnect, and shared victory in reviewable demo scenarios.
- [ ] Finish responsive layouts, keyboard focus, screen-reader summaries, localization and reduced-motion behavior.

Exit: every action is usable with mouse, keyboard and touch; a player can understand what to choose, what happened, and why points changed.

### 5. Add motion and audio

- [ ] Implement the accepted-event animation sequence, revision gating, cancellation, skip/settle behavior and saved settings.
- [ ] Tune ceramic motion/sound on representative desktop and phone sizes, including busy nine-factory and crowded-center cases.
- [ ] Verify that rapid updates, reconnects and disabled audio/motion remain playable.

Exit: ordinary play feels responsive, scoring is explainable, and effects neither replay nor obscure the current action targets.

### 6. Validate and document delivery

- [ ] Run the proportionate validation below and fix new failures.
- [ ] Review representative screenshots and recorded transitions, not only DOM assertions.
- [ ] Update `README.md`, `docs/architecture.md`, `docs/validation.md`, affected `AGENTS.md` catalog descriptions, and the game README/rules references to include Azul accurately.
- [ ] Report actual checks, unresolved rule clarifications and any unavailable Safari device testing.

Exit: all required implementation checks pass; any remaining device verification is explicitly unverified, with no claim of completed Safari validation.

## Verification matrix

### Rules and acceptance

| Area             | Required independent cases                                                                                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Setup and RNG    | All supported player counts, initial quantities, exact wall layout, deterministic output for the same seed/action sequence, no randomness consumed by rejected input.                          |
| Draft validation | Mixed factory leftovers, center pick, voluntary floor, overflow, wrong color/row, occupied wall color, full pattern line, invalid source/index/color, out-of-turn and post-finish actions.     |
| Marker           | Claimed once, inserted before same-pick overflow, starts the following round, seven occupied floor slots, all-monochrome factories leaving it unclaimed. Mark interpretation cases distinctly. |
| Scoring          | Independent boards yielding isolated `1`, horizontal-only `4`, vertical-only `3`, and cross `4 + 3 = 7`; gaps/diagonals excluded; top-to-bottom ordering affects a later placement.            |
| Resolution       | Multiple completed and incomplete lines; penalty clamp after points; maximum occupied floor; bag exhausted partway through a factory; recycled discards; insufficient refill supply.           |
| Ending           | Triggering player need not win; every player finishes resolution; bonuses exactly once; score tie resolved by rows; remaining tie produces multiple winners; actions rejected afterward.       |
| Invariants       | Per-color conservation and unique marker after every accepted action; rejected state unchanged; no shared mutable references in recipient views; scores nonnegative and not capped at 100.     |
| Full games       | Seeded legal policies finish 2/3/4-player games while checking invariants; a test watchdog diagnoses failures but never becomes a gameplay round limit.                                        |

### Sessions, rendering and accessibility

- Real-socket tests: unauthorized actor fields cannot impersonate seats; stale revisions and duplicate requests cannot apply twice; concurrent attempts accept only legal current actions; reload/reconnect and seat replacement preserve boards and identity rules.
- Inspect complete serialized views/events for forbidden bag/random/token fields. Test initial, drafting, refill and finished states. Local fixture modules must not enter the multiplayer server or eager catalog import graph.
- Browser tests: create/join/start, complete a turn by keyboard and touch, explicit floor placement, visible scoring, result/rematch, language switch, reload and stale-preview recovery. Use deterministic test fixtures/harnesses for endgame coverage, never production cheat actions.
- Presentation tests: accepted action animates once; rejection never animates a committed move; repeated snapshots, room-only revisions, revision gaps, reconnects and match changes settle correctly. Check resize during travel, hidden-tab restoration, rapid consecutive actions, skip and reduced motion.
- Visual review: 2- and 4-player layouts, crowded center, readable patterned tiles and empty wall cells, long Spanish strings, floor overflow, result breakdown and settings overlay at the viewport sizes above. No clipped controls, unintended horizontal scroll or animations over live hit targets.
- Accessibility review: complete keyboard game flow, focus restoration after dialogs, polite turn/score announcements, translated labels, color-independent recognition, text/control contrast, zoomed text and reduced motion. Audio-disabled play must be complete.

### Commands to run during implementation, not in this planning session

```sh
bun install
bun run check
bun run test
bun run build
bun run test:e2e --project=chromium --project=webkit
bun run format:check
```

Use `bun install` only when adding the workspace dependency entries; validate the resulting lockfile. Format only maintained files belonging to this change if unrelated edits exist. Run existing UNO/Catan browser coverage with the integration suite because shared catalog and room files are touched. Install browser binaries only if needed by the current Playwright setup.

Chromium and WebKit are required. Also review Google Chrome and actual Safari on macOS/iOS when available; WebKit automation is not Safari device validation. Record unavailable checks as unverified. Stop repeating passing checks unless changes or new evidence justify another run.

## Definition of done

Azul is discoverable without eager game imports; 2–4 people can finish and rematch a correctly scored standard game; reconnects preserve play; every action works in English and Spanish; the table is clear and attractive at desktop and phone sizes; accepted tile movement and scoring feel live; reduced-motion and silent play remain fully usable; automated rules/session/browser checks pass; and sources, interpretations and actual device-validation status are documented.

This session creates this plan only. No package, application code, assets, dependencies, server behavior or game implementation is changed by the plan's creation.
