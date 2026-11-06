# Untangle report: Claude Code arm

Branch `untangle/claude`, base `b6977ee`, head `b879227` (19 commits).
Additions: **Comments yes, Tests no.**
Diff: 235 files, +6493 / −6167. That includes about 1,000 lines of
`docs/untangle/`, five dead WebPs and a tracked `.pyc` removed. Source `.ts`/`.svelte` went from 52,071 to about 51,500 lines.

## Special cases: before → after

I counted with a heuristic grep script over tracked `apps/`, `games/` and `packages/` `.ts`/`.svelte`
files (Paraglide output and `.d.ts` excluded). It counts patterns, not intent, so treat it as a trend.
The script was rerun after round 1 and at the end.

| Counter                                                                                                  | Base | After round 1 | Final |
| -------------------------------------------------------------------------------------------------------- | ---: | ------------: | ----: |
| Game-id branches outside `games/` (`gameId === 'x'`, `['a','b'].includes(gameId)`, `{#if game === 'x'}`) |   22 |             0 |     0 |
| Empty or silent `catch`                                                                                  |   29 |            16 |    17 |
| `as any` / `as unknown as`                                                                               |    7 |             4 |     4 |
| `@ts-ignore` / `svelte-ignore` / `eslint-disable`                                                        |    5 |             5 |     5 |
| Direct `localStorage` outside the shared helper                                                          |    8 |             2 |     2 |
| `if (practice)`-style branches                                                                           |    9 |             6 |     6 |
| `setTimeout`/`setInterval`                                                                               |   28 |            28 |    28 |
| `requestAnimationFrame`                                                                                  |    9 |             9 |     9 |

Notes on the table:

- **Remaining silent catches** guard Web Audio, storage and clipboard, which must never throw into play.
  Two are new and deliberate: the practice shell pre-handles the rejection it returns to Boards, and
  the Jev route ignores a bad JSON body.
- **The five ignore directives** are accessibility ignores on pannable SVG maps, each with a reason.
- **Timers** are presentation timing, not workarounds, so they stayed.

On top of the counters, the agents removed rule- and UI-level special cases they found by reading the code.
Their reports add up to about 60, for example:

- UNO's legality found by catching exceptions;
- Catan's nine non-null assertions, and its "practice is the absence of `onInvite`" inference;
- Azul's `duration === 150` flight identity and `canRematch && !settingsContent`;
- Carcassonne's `'/f'` region test and its page-side ready fan-out;
- Codenames' `eventGate` `fresh` hook and its drifted roster copy;
- Little Secret's reset subsets in `deal()`;
- Sushi's page-side stepping loop and the constant `>= 5` guard;
- Dominó's three first-tile `end` copies and its no-op sound stubs.

Kept on purpose: rule facts such as river tiles, message tokens, paired turns and 2-player reverse, and
fixture-only branches in the practice modules.

## Dependency graph: before → after

The graph is module-level edges from a script over all imports. It has 88 edges before and 93 after; there
are more edges because games now import small shared modules instead of copying them.

- **Server.** Before, it imported `packages/shared` (the Paraglide catalog) for wire types, and the Jev lab
  eagerly. After, it imports `game-core` (the protocol now lives there), `shared/games` (message-free
  metadata) and `jev-lab/codenames/http`, the last one lazily and only when `JEV_LAB=1`. The server bundle
  contains no UI, Svelte or Paraglide modules (checked with a `bun build` metafile).
- **Web registry and transport.** Before, `lib/games.ts` imported eight `Board.svelte` files, plus Dominó's
  `preload`. `action-retry` knew the action shapes of four games. After, `lib/games.ts` imports each game's
  tiny `./client` entry; tables still load lazily through `load()`. `action-retry` imports only types.
- **Practice routes.** Before, the routes imported `Board.svelte`, `Loading.svelte`, `look` and
  `sushi-go-party/server`. After, they import only `./practice` and the shell.
- **Catalog.** Before, it went through wrapper files to reach game guides. After, it imports
  `codenames|little-secret/guide` and `GuideScene` lazily and directly.
- **Jev lab.** Before, it reached past the Codenames package's exports with a relative path to `words.ts`.
  After, it uses the `codenames/words` and `codenames/setup` exports.
- **Rules modules.** Before and after, no rules module imports DOM, Svelte, `shared/ui` or messages.
- **Cycles.** There are no package-level cycles. Inside games, three type-only cycles between `index.ts` and
  `presentation.ts`/`bot.ts` were removed in UNO and Sushi; one remains in Catan.

## Fixes done

The decision log has each fix above the problems it solves. In short:

1. **F1, protocol in `game-core`.** The server stops depending on the catalog, and `GameDefinition<State, View>` types the view.
2. **F2, `shared/games.ts`.** It is the single source for game identity, seat limits and practice kind; definitions spread `seats(id)`.
3. **F3, per-game `./client` entry.** Each game has `load()` and `retryable`. Retry rules moved out of the transport, and Dominó's preload moved into Dominó.
4. **F4, Board contract and room shell.** There is one `BoardProps` type, the room passes the same props and controls to every Board, and the `cornerControls` list and Catan/Carcassonne branches are gone. Carcassonne gained rematch and stale notices; Catan gained rematch.
5. **F5, rejections as message keys.** One `errorText()`/`message()` helper serves them. This fixed rooms showing raw `DOMINO_*` codes.
6. **F6, viewer settings.** `viewerPreferences` and `ViewerSkin` replace eight preference encodings and seven lazy-skin blocks.
7. **F7, sound and dialogs.** `chipNote` and `clamp01` are shared, and the hand-rolled dialogs moved to `modal()`.
8. **F8, practice.** `PracticeTable` and one practice shell. Seven routes went from 60–290 lines to about 10–40 each.
9. **F9, Jev lab.** It owns its HTTP route, wire types and shared judging helpers.
10. **F10, rooms.** Room internals name the bot delay and seat presence.
11. **G-\*, per-game fixes.**
    - **UNO:** a `legalActions` function and one card table.
    - **Catan:** an `Action` union and shared limits, shapes and timing.
    - **Carcassonne:** typed kinds, shared figure supply and adjacency, and delayed 8-bit cues that are now cancelled.
    - **Azul:** a location-grammar module and named timings and rule numbers.
    - **Codenames:** `setup.ts` rules shared by the engine, Board and lab, and an allowlist view.
    - **Little Secret:** `freshMission()` and `nextActor()`.
    - **Sushi:** `RevisionGate` instead of `EventCursor`, and rule numbers from the rules.
    - **Dominó:** named constants, and one pip table shared by the HTML, 3D and 8-bit tiles.
12. **W1–W4, catalog.**
    - Per-game covers and steps are looked up in `Record<GameId, …>` tables.
    - Rulebook references are chapter data.
    - The home dialog uses `modal()`.
    - The join request is state, and `html[data-home]` replaces `body:has()`.
    - The recovery protocol lives in one module.
    - Dead CSS and data are gone.
13. **C1, comments.** About 80 restating comments are removed, and stale claims fixed: the Rust paths, the "pack tests", and the "imports all six WebPs".
14. **Hygiene.**
    - 85 unreferenced message keys are removed and 3 shared practice keys added (1813 → 1731 in each locale).
    - Dead package exports are removed.
    - Five unused Codenames WebPs (about 334 KB) and a tracked `.pyc` are removed.
    - `noUnusedLocals`/`noUnusedParameters` are now on.
    - The docs (architecture, workflow, two game docs and ADR 025) describe the new structure.

## Skipped on purpose

- **Splitting the 3,000–4,000-line Boards.** That covers Catan's classic and pixel island, Carcassonne's
  camera, drag, panels and CSS, and Azul's layered CSS with its `#az-pixel` specificity hack. Sushi's
  `class:rich={true}` and its 153 selectors fall here too. These change the cascade or layout, and I had no
  visual review.
- **Dominó's cosmetic poses in canonical state.** Moving them changes the wire and the state shape.
- **DOM-selector contracts between effects and Boards** (Catan, UNO, Azul, Sushi). They need a registration
  API across large Boards, which is the same risk as above.
- **Carcassonne's local `EventGate`.** Its event ids jump, so it cannot use the shared gate's
  previous-plus-one sequence without a behaviour change.
- **Azul's dialogs to `modal()`.** They interleave with `baseline()` measuring.
- **Carcassonne rendering `rulesContent`.** It has its own module-aware guide.
- **Found in the last round, not done (below the stop threshold, each touching `shared/ui` plus four or five games):**
  - a shared skin-context helper (four copies);
  - a cancellable-timer helper (four copies);
  - Codenames and Little Secret classic cue tables;
  - 13 over-wide `export`s.
- **UNO and Catan rejection sentences.** They stay English: turning them into keys needs new Spanish copy.
- **Catalog pip tables.** Dominó's cover and guide scene keep their own, because the art matches base pixel for pixel.
- **The `practice` flag inside room-creation options, and socket `handle(..., broadcast)`.** Both are low value.

## Behaviour changes (intended)

- **Saved settings.** Sound, volume, motion, Dominó look and camera reset once. They now live in
  `board-games:preferences:<game>` and the shared skin key.
- **Rule rejections.** Rules reject with message keys: Azul, Carcassonne and Dominó now show translated text.
- **Practice routes.**
  - All seven share one shell: seat follows the actor (Azul did not before), every game supports
    `?scenario=` links, rematch appears at game end, and shared seat, scenario and reset controls are used.
  - Little Secret practice lets every seat do host actions.
- **Room page.**
  - It draws no toolbar during a game.
  - It passes the same back, invite, language and status·id controls to every Board, so Catan's settings
    repeat its toolbar's controls.
  - UNO practice settings no longer show Invite.
  - Codenames no longer draws a second invite or room line.
- **Views.** Catan no longer projects `primary/secondary/opportunity/knights/played`. Sushi drops
  `presentation.round/turn`. Codenames events drop `index`.
- **Dominó.**
  - The HTML tile's 6 now matches the 3D and 8-bit tiles.
  - The 3D landing thud now matches the 3D flight time, 20–80 ms later.
  - `view(state, unknownPlayer)` throws. The server never asks for it.
- **Codenames and Little Secret rules** no longer range-check the injected `random()`.
- **Carcassonne fixes:** delayed 8-bit cues are cancelled on mute or close, `risingTimer` is cleared on
  unmount, and motion follows a system change live.
- **Home page:** the pixel styling applies before the store chunk loads.

## Behaviour verification

All commands ran on the final head unless noted.

- **Static checks.** `bun run check` (svelte-check plus `tsc`, now with `noUnusedLocals`/`noUnusedParameters`)
  reports 0 errors and 0 warnings. `bun run build` passes, and `prettier --check .` is clean.
- **Rules equivalence.** I ran seeded playouts of all eight rule modules against a `git archive b6977ee`
  copy (scratch harness, not committed).
  - The setup: 30 matches per game at several player counts, about 43,000 accepted actions; every step
    hashes every seat's `view()`. Random illegal and wrong-player probes, `create()` misuse and `presence`
    calls are included.
  - Normalised only for the intended differences above (removed view fields, renamed error keys, object key
    order), seven games match exactly on views and error text.
  - Dominó differs only on the unknown-player `view()`.
  - The harness caught one real regression late (Sushi's custom-menu uniqueness check, introduced and fixed
    in round 3).
  - The per-game agents also ran their own old-vs-new playouts, about 600 games in total, each matching except
    for the intended changes.
- **Socket smoke (base vs head servers).** The script covers, for all eight games:
  - create, join, a full room, a non-host start, start, stale revision, wrong round, a bogus action, sync,
    host handoff on disconnect, token reconnect and a bad token;
  - a UNO bot practice room, and the practice refusal for Catan.

  The transcripts match apart from the intended error keys and the removed Catan view fields.

- **Headless Chromium against the built app (base vs head).**
  - `/` and all seven practice routes, in both themes (16 loads): identical visible-button and dialog counts,
    0 console errors.
  - Room pages for UNO practice, Azul, Catan and Codenames: same controls, apart from UNO practice's dropped
    Invite, and no errors.
- **Bundles.** Client JS is 1.80 MB → 1.76 MB and referenced CSS is 458 KB → 450 KB. The build also emits
  seven unreferenced server-side CSS files.
- **Jev route.** It returns 404 when the lab is off and 400 on a bad body when on, as before. I did not
  exercise a live Jev call.
- **Not verified:** pixel-level visuals, animations and sound by eye or ear. Every check is structural or
  automated.

## Subagents

All subagents were native `Agent` calls. The token counts are the subagent totals the harness reported;
my own lead context is not included.

| Phase            | Model, effort (agent type)       | Count | What they did                                                                                          | Tokens |
| ---------------- | -------------------------------- | ----: | ------------------------------------------------------------------------------------------------------ | -----: |
| Step 2 inventory | Sonnet 5.5 medium (`sonnet-mid`) |     5 | Read-only problem lists with file:line, one per area (`docs/untangle/inventory/`)                      |  1.04M |
| Round-1 fixes    | Sonnet 5.5 high (`sonnet-high`)  |     4 | Applied F2–F8 and per-game fixes, two games each, with disjoint file ownership and old-vs-new playouts |  1.22M |
| Round-1 fixes    | Sonnet 5.5 medium                |     1 | Web catalog, home page and messages (W1–W4)                                                            |   133k |
| Verification     | Sonnet 5.5 high                  |     1 | Built the seeded base-vs-head playout harness                                                          |   193k |
| Fix-up           | Sonnet 5.5 medium                |     2 | Restored Catan's toolbar; did the round-1 Board-local review fixes                                     |   106k |
| Step 5 round 1   | Opus 5.5 medium (`opus-medium`)  |     1 | Reviewed shared contracts, server, transport and retry equivalence                                     |   145k |
| Step 5 round 1   | Sonnet 5.5 high / medium         |   2+1 | Reviewed the games (two halves) and the web catalog                                                    |   669k |
| Step 5 round 2   | Sonnet 5.5 high                  |     2 | Final regression check and remaining-problem sweep                                                     |   366k |
| **Total**        |                                  |    19 |                                                                                                        |  ~3.9M |

I made the cross-cutting contract changes, the room page, the practice shell, the server and the docs myself
(Opus 5.5), and committed after each agent finished. No Haiku or Fable was used.

## Time and tokens

The wall time was about 1 h 20 min, from 00:34 to about 01:55 local. Phases:

| Phase             | Time    |
| ----------------- | ------- |
| Inventory         | ~10 min |
| Contracts         | ~20 min |
| Parallel round 1  | ~20 min |
| Two review rounds | ~30 min |

Subagents used about 3.9M tokens in total. The lead's own usage isn't visible to me.

## What I would change in the skill for this model/harness

- **Give step 2 an output budget.** Five agents produced about 200 KB of findings, roughly 400 items. That
  was useful, but most per-file nits never mattered next to the eight structural fixes. Ask for structural
  findings first and nits per file as counts.
- **Make "check behaviour" a harness step before fixing.** A seeded playout harness built at the start ran
  against every later commit, and it caught a regression in the last round that the fresh reviewers missed.
  The skill only says "test this at the end".
- **Fresh reviewers anchored on regressions were the highest-value step-5 work.** About a dozen of the
  first review's findings were real regressions; the "what's left" findings were mostly low value, and two
  were wrong: message keys built at runtime, and a prop passed by a component the reviewer didn't open. Ask
  reviewers to prove "unused" with the dynamic-lookup patterns, and to split "regression" from "leftover".
- **Shared scratch space needs per-agent folders.** One agent overwrote another's base extract in the shared
  scratchpad. Brief each agent with its own subfolder.
- **Name the visual-risk boundary up front.** Without a browser, the biggest tangles (3,000-line Boards and
  CSS cascades) are exactly what can't be safely changed. The skill's "fix everything" should allow
  "deliberately skipped with reason" explicitly, for changes that can't be verified.
- **"Intended behaviour" needs a tie-breaker for duplicated UI.** The uniform room shell was right, but one
  game's own chrome then duplicates it (Catan). The skill could say whether to prefer uniform structure or
  pixel-identical UI.
