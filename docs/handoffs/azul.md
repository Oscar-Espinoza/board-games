# Azul owner handoff

Planning phase completed 2026-09-12 by Astra High. Implementation has not begun. Worktree `/home/oscar/Projects/board-games-three-games/azul`, branch `feature/azul`, was clean when inspected. No source changes or commits were made by this phase. Successor: Astra Medium for implementation, then end with a written handoff and request Astra High review/fixes. No nested agents. Never edit the original `/home/oscar/Projects/board-games` checkout.

The user’s three-game plan authorizes implementation and supersedes the old planning-only disclaimer and toolbar guidance in `docs/games/azul-plan.md`. Read that plan for the full detailed matrix; this file locks evidence, gives current integration specifics, and supplies an executable checklist.

## Scope and rules decisions

Deliver standard colored-wall Azul for 2–4 players: full games, scoring, shared wins, rematches, reconnect/replacement, original artwork, English/Spanish, searchable illustrated help, isolated real-rules practice, accepted-action motion and gesture-unlocked sound. No gray-wall variant, expansions, AI, timers, undo, accounts or additional optional plugins. Fixed setup needs no game readiness phase; ordinary host start enters drafting. Reuse existing seat/session behavior without inventing a new lifecycle.

Primary evidence consulted directly:

- [Next Move English rulebook](https://cdn.svc.asmodee.net/production-nextmove/uploads/sites/4/2024/06/EN-Azul-Rules-Next-Move-web.pdf), all six printed pages; setup illustration inspected as an image.
- [Asmodee Spanish rulebook](https://cdn.svc.asmodee.net/production-asmodeees/uploads/2023/06/Reglas_Azul.pdf), downloaded successfully with curl and extracted with pdftotext. Web parser returned an internal error, which was overcome with local tools. Spanish terms confirmed: “losetas”, “líneas de patrón”, “pared”, “línea del suelo”, “Expositores de fábrica”, “Alicatado”, “marcador de Jugador inicial”.
- [Publisher product page](https://www.nextmove-games.com/en/azul/azul-game/), confirms original 2–4-player product. Do not use similarly named Summer Pavilion or Mini special-case rules.

Directly verified rule facts: 20 of each of five tile colors; 5/7/9 factories of four tiles; clockwise all-of-one-color draft from one source; remaining factory colors spill to center; first center pick claims marker before placing its colored tiles; one legal pattern row or direct floor destination; completed pattern rows score top-to-bottom, incomplete rows persist; contiguous axis scoring counts the new tile separately on both connected axes; penalties after wall points with zero clamp; recycle discard only after existing bag empties; partially filled factories allowed on total shortage; finish after every player resolves the triggering round; final bonuses 2/row, 7/column, 10/color; ties compare rows then share victory.

Independently transcribed wall, top-to-bottom and left-to-right, from the official setup illustration (not derived from an implementation formula):

| Row | 1 | 2 | 3 | 4 | 5 |
| --- | --- | --- | --- | --- | --- |
| 1 | blue | yellow | red | black | white |
| 2 | white | blue | yellow | red | black |
| 3 | black | white | blue | yellow | red |
| 4 | red | black | white | blue | yellow |
| 5 | yellow | red | black | white | blue |

Bounded clarification search completed using publisher/Plan B/Next Move queries for FAQ, full floor and marker. No publisher clarification was located for the following cases. Do not block implementation or claim an official ruling: retain the already proposed deterministic app conventions and label them in both rules docs and help.

1. First match starter is an injected uniformly random seat in place of travel history. Later starters follow marker ownership.
2. When claiming a marker with seven occupied floor slots, keep marker visibly beside the board, preserve next-start ownership, and charge only the seven printed slots. Marker never enters bag or discard. A floor with six occupied slots takes the marker in slot seven before all selected colored tiles overflow to discard.
3. When all factories happen to be monochrome and no center-colored tiles ever appear, end drafting when colored supply is empty, retain the previous starter, return/reset the marker to center and deal the next round. No marker-only turn.
4. Reject full pattern row as a placement target; direct floor remains legal, so this UI convention does not remove any resulting move. Reject all partial/split placement intentions; the entire selection goes to one row with excess to floor, or entirely to floor.
5. Final draft, wall scoring, penalties, bonuses or refill are one atomic server transition. Animation is explanatory and never requires an acknowledgement/action to advance play.

Research artifacts remain temporary at `/tmp/azul-planning-evidence/{en.pdf,es.pdf,setup.png,es.txt}`. Do not commit publisher artwork or PDFs. Use original CSS/SVG art and link primary sources in authored help/docs.

## Implement rules and presentation first

- [ ] Add `games/azul/package.json` analogous to Carcassonne, exposing `./server`, `./Board.svelte`, `./practice`; dependencies only game-core/shared and Svelte peer.
- [ ] Keep modules small: `index.ts` canonical state/reducer/projection, `rules.ts` only if helper separation helps, `presentation.ts` typed events/revision gate, `effects.ts` audio/travel support, `Tile.svelte`, `PlayerBoard.svelte`, `Board.svelte`, `practice.ts`. Tests next to rules/presentation. No general game UI framework.
- [ ] Five-color union, immutable wall mapping, floors `Array<Color | 'marker'>` max seven, per-player row colors/counts, wall occupancy, score and cumulative wall/floor ledger; canonical bag order and discards; active player, starter, marker owner/location, `roundNumber`, game action `revision`, phase drafting/finished, final bonus breakdowns and `winners: string[]`. Match generation is the separate incoming board prop `round`.
- [ ] One `DRAFT` action with source `{kind:'factory',index}` or `{kind:'center'}`, color, destination `{kind:'pattern',row}` or `{kind:'floor'}`. Validate unknown payload and every bounded integer before cloning/mutating or random consumption. Do not accept quantities/actor IDs from client.
- [ ] Derive quantity and marker consequences server-side; preserve state and event revision on rejection. Use cloned state after all validation. No score-track cap at 100. Keep physical marker separate from 100-tile conservation.
- [ ] End-round resolution records intermediate events while traversing completed rows. Scoring helper returns contributing wall cells, horizontal/vertical lengths and points. Independent expectations: isolated 1; horizontal 4; vertical 3; cross 4+3=7; diagonals/gaps ignored; top-to-bottom adds earlier tiles to later adjacency.
- [ ] Refill consumes remaining bag before shuffling recycled discards with injected RNG. Inventory conserved per color through bag/factories/center/patterns/wall/floor/discard. Insufficient supply leaves stable empty/partial factories.
- [ ] `view` explicitly whitelists every public field and returns empty private projection. Deep copy nested arrays/events so no recipient object can mutate state or another view. Never expose bag order, canonical discard internals unless intentionally public counts, RNG or credentials. Expose count summaries if useful, never future tile sequence.
- [ ] Accepted event union: draft movement with actual source and destination slot indices; factory spill; marker move; overflow floor/discard; wall transfer with scoring cells and delta; floor penalty with printed deduction and actual delta; public factory deal; finish bonuses. Latest bounded batch associated with game revision. No event from rejected intentions or fabricated social activity.
- [ ] Rule tests cover all setup counts, exact independent wall table, full-floor/unclaimed-marker conventions, voluntary floor, overflow, invalid payloads/turns/rows/colors/phase, incomplete rows, refill recycling/shortages, all-player final resolution, tie-break/shared win, bonuses once, score clamp, RNG unchanged on invalid actions. Run seeded full legal-policy games at 2/3/4 seats, assert inventory/marker invariants after every action and finish with a test watchdog only.

## Current repository integration map

Inspect these files again before changes; coordinator will reconcile shared changes and regenerate Bun lockfile. Commit shared wiring/messages separately from game package/tests/docs so cherry-picks are reviewable.

- `packages/game-core/src/index.ts`: `GameDefinition.create/apply/view/isFinished`; optional `presence` and `botAction`; identity established by socket binding; `ActionContext.hostId` if ever needed. Azul does not need setup readiness or bots.
- `apps/server/src/index.ts`: import/export `azul`, register in Map. Add app dependencies in both app `package.json` files. Root already includes `games/*` workspace glob.
- `packages/shared/src/index.ts`: metadata only. Add `id:'azul', name:'Azul', minPlayers:2,maxPlayers:4,description:m.azul_description,preview:'tiles'`. Do **not** add `practice:true`: that metadata presently triggers server UNO bot practice; Azul practice is the local route link provided by the library fallback.
- `apps/web/src/lib/games.ts`: dynamic `azul` board import only.
- `apps/web/src/routes/+page.svelte`: current library has `summaries` and `loops` maps requiring Azul keys. It no longer contains the old tile-preview fallback from the original plan. Its box CSS assumes three games, using per-game selectors and `--slot`; flag/request coordinator’s six-game arrangement so new boxes do not spill offscreen.
- `apps/web/src/lib/catalog/BoxArt.svelte` and `SummaryStep.svelte`: add explicit Azul original mosaic/plate branches before Carcassonne fallback. Keep imports lightweight; never rules/board/practice.
- `apps/web/src/lib/catalog/guides/load.ts`: add lazy guide loader; `Rulebook.svelte` has a **separate** `sceneLoaders` map requiring Azul. Add `guides/azul.ts` and `AzulScene.svelte` with before/action/result illustrations for draft, marker/overflow, pattern/wall, cross scoring, penalty clamp, bonuses and ending/conventions.
- All game/library/accessible/error text goes in `packages/shared/messages/{en,es}.json`. Use `m.azul_*` and `m.learn_azul_*` keys; do not hand-edit generated `src/paraglide`. `bun run check` compiles catalogs first.
- `apps/web/src/routes/room/[id]/+page.svelte` already passes view/playerId/players/send/locale/round/connected/pending/practice/canConfigure and a `settingsContent` snippet. Currently snippet supplies controls only for Carcassonne and persistent toolbar remains globally. **Coordinator has implemented the room integration:** persistent toolbar hides for the three new games; `settingsContent` supplies EN/ES select, invite with copy feedback, leave, host rematch, connection and room ID. Board also receives `canRematch: boolean` and `rematch: () => Promise<void>` for the results action. Accept these as optional/defaulted props so practice works; render host results rematch when `canRematch`. A connection failure remains visible on the table. Owner must not modify the room page; do not hard-code socket requests inside package.
- Coordinator owns structured socket errors and session client preservation; Azul never auto-retries stale drafts. Clear preview and show translated “table changed; choose again” on `STALE_REVISION`. Fresh confirmation is mandatory. The shared error banner must remain visible on immersive tables; additionally show disconnected state inside Azul.

## Concrete table visual/interaction specification

Viewport is the surface. Ink blue `#142C43`, ivory `#F7EEDB`, dark ink `#172B3A`, brass `#B98432`. Glazed bevelled tiles carry distinct motifs (blue diamond, yellow sun, red chevron, black lattice, white/cyan flower) and translated accessible color names. Empty wall cells show muted motif outlines; occupied tiles have strong glaze and shadow. Factory plates have ornamental concentric rims and stable four-tile slots; empty factories stay in place.

- Desktop 1440×900: slim in-table round/turn announcement centered at top; factory ring/center dominant mid-table; local board large at lower center; opponents around top/sides with visible names/scores/turn/floor risk. Avoid dashboard card styling. Pattern triangle and 5×5 wall align row-for-row.
- Tablet 768×1024: factory region above local board; opponent strip with accessible expandable board sheets. Phone 390×844 and 360×640: 3-column factory grid (9 plates for four players), grouped center selections, readable local board below, internal vertical surface scrolling and sticky confirmation bar. Do not shrink desktop composition. All sources and controls 44px hit targets; tile pictures can be smaller. Stable score/opponent strip remains inspectable.
- Upper-left illustrated open-book button and upper-right gear, each safe-area inset and 44px. Native modal dialogs with labelled headings, Escape support and opener focus restoration; rulebook search/chapter controls inside help. Settings contain saved sound toggle/default enabled, restrained volume (suggest 0.25), reduced motion override/system preference plus supplied room settings. Opening either never pauses/reveals anything.
- Source color click/focus selects entire group locally; choose highlighted legal row or floor, show exact tile count + overflow + marker cost before explicit confirm. Rows with conflicts explain translated reason. Cancel/Escape clears selection. Pending submit disables duplicate commands. New game revision invalidates obsolete preview; no reconnect auto-submit.
- All player boards readable/inspectable on any turn; compact opponent summaries include patterns/floor counts and name/score, not only an avatar. Current player text/icon/border, disconnected seats, next starter badge, own waiting copy reflect actual state only.
- Results preserve boards and show wall points, raw floor deductions, actual score loss, end bonus rows/columns/colors, final totals and tie explanation. Host rematch in results and settings.

## Motion/audio implementation specification

Use actual DOM anchors (`data-azul-location` with source factory/color/slot, center/color, player/pattern/slot, player/wall/row/column, floor/slot, bag/discard/summary) and record bounding boxes before swapping visual snapshot. Flying tiles are fixed-position noninteractive aria-hidden overlays animated between measured coordinates with Web Animations or transform CSS. Do not substitute generic scale/glow for travel. For hidden opponent board, land at visible summary, then show canonical detail when expanded.

Accepted factory pick: selected tiles travel 250–350ms, leftovers to center; marker 220–300ms; overflow to floor/discard 200–280ms. Wall transfer top-to-bottom 200–260ms/row with axis highlights and `+N`; different players can resolve in parallel. Floor penalty text explains print amount versus zero-clamped loss. Deal only reveals dealt factories; no hidden bag order animation. Whole round presentation approximately 2–3 seconds, with Skip and immediate settle when next-turn control used. Rules are already advanced server-side.

Keep a game-owned RevisionGate patterned after `games/catan/src/presentation.ts` (inspect reconnect-awaiting-snapshot logic), not Carcassonne’s simpler gate. Gate identity includes match `round` and playerId, consecutive **game** revision, active connection. First load/reconnect/revision gap/seat change/rematch settles silently. Repeated room snapshots must not replay. Hidden-tab restoration, resize/orientation change, preference change cancel active flights/audio and establish current baseline. Test pure gating separately from animation effects.

AudioContext constructed/resumed only from trusted pointer/keyboard gesture. Soft ceramic transient/clack, distinct marker tap, brief scoring chime; no music. Catch unavailable AudioContext/storage/resume failures. Volume/mute saved defensively; mute cancels already scheduled sources. Reduced motion skips flight/bounce/sparkle but preserves instant pieces and text. None of these functions can dispatch game actions or delay `send` acceptance.

## Practice, session and browser acceptance

- [ ] Add lazily loaded `/practice/azul`; route can import separate practice entry because route is isolated. Use real create/apply/view and deterministic seed. Explicit local-demo indicator, switchable human seat; no bots and no production cheat/setup actions. Scenarios: ordinary 2/4-player start, center marker+overflow, top-to-bottom/cross-scoring resolution, near-finish/shared-victory. Keep fixture inventory valid. Switching seat resets presentation baseline.
- [ ] Add `apps/server/src/azul.test.ts` using Rooms and real Socket.IO patterns in Carcassonne tests. Check actual recipient serialization initial/draft/refill/end, impostor actor fields, stale revisions, duplicate ID, concurrent same-seat actions, reconnect same board, timed reservation/replacement and revoked credentials, host migration/rematch generations. Keep test server ephemeral; coordinator handles generic protocol tests.
- [ ] Add `tests/e2e/azul.spec.ts` using real multi-context 2- and 4-seat room journeys, selectors via translated roles/stable location anchors. Keyboard complete draft, touch complete draft, direct floor, opponent inspection, help search/focus restoration, Spanish, settings mute/volume, unavailable audio, reduced motion, disconnect/reload, stale preview, rematch and practice endgame/scoring. Required Chromium and WebKit.
- [ ] Capture **and inspect** desktop/tablet/phone screenshots plus short recordings of factory→pattern, leftovers→center and scoring. Use `testInfo.outputPath`, then copy final selected evidence to integration `docs/evidence/azul/` or coordinate an artifact path and document it. Assertions include no page overflow, safe-area corner separation, readable pattern/wall, live controls unoccluded, complete max-player boards.
- [ ] Meaningful event checks: rejected action no effects; accepted once; room-only snapshot no replay; consecutive actions; revision gap; reconnect during animation; hidden restoration; resize; skip; reduced motion. Real Safari device/group human play/fluent Spanish review remain explicitly unverified if unavailable.

Owner commands (ports reserved server/web/browser **3011/5181/3111**): `bun install` once adding dependencies, `bun run check`, `bun run test` (or targeted while iterating), `bun run build`, `TEST_PORT=3111 bun run test:e2e tests/e2e/azul.spec.ts --project=chromium --project=webkit`, `bun run format:check`. Dev script hardcodes normal web invocation; if needed run server with `PORT=3011` and web Vite with explicit `--port 5181` and correct proxy config after reading it. Do not accidentally bind default shared ports. Build before E2E because existing Playwright config runs compiled app with `bun run start`. Do not repeatedly rerun passing checks absent changed evidence.

## Deliverable and phase exit

- [ ] Update `docs/games/azul.md` and game README with complete rules, source links and conventions. Mark old plan as executed only when actually complete.
- [ ] Give coordinator concise proposed additions for root README/architecture/validation/AGENTS catalog descriptions; shared architecture remains ADR 011 accepted-event/private-projection boundary and needs no invented universal framework.
- [ ] Commit game-owned implementation/tests/docs separately from shared manifests/registry/catalog/messages/route wiring. Report commit hashes and exact validation results, failures or deferred checks in this handoff.
- [ ] End Medium phase with enough detail to spawn Astra High final review in same worktree. High reviewer must inspect/fix rule invariants, projection privacy, true coordinate movement, focus/layout and localization gaps and run necessary checks. Do not declare complete because the happy path renders.

Planning validation: repository instructions/current contract/library/session test patterns inspected; primary English/Spanish sources fetched; official 25-cell wall visually inspected. No application tests run because this phase changed only this handoff.
