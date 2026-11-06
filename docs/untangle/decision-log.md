# Untangle decision log

Run: `untangle/claude`, base `b6977ee`. Additions chosen: **Comments: yes. Tests: no.**

The full step-2 problem list (every finding with file:line, against the base commit) is in
[`inventory/`](inventory/), one file per area. Below, each fix sits above the problems it
solves. Line numbers refer to the base commit. Status is filled in as rounds land.

## Cross-cutting fixes (lead)

- **F1. Put the socket protocol in `game-core` next to the game contract, and type the view.** `RoomView`, `Credentials`, `Reply`, `ReplyErrorCode`, `ActionRequest` and `Synchronization` move to `packages/game-core/src/protocol.ts`; `GameDefinition<State, View>` returns a typed view. The server stops depending on the catalog package. _Done (7a61704)._
  - `packages/shared/src/index.ts:72-98` vs `packages/game-core/src/index.ts:1-42`: wire types split arbitrarily between two packages; shared imports game-core for two of them.
  - `packages/shared/src/index.ts:1-3`: the Paraglide-backed catalog shares a file with the protocol types the server imports (`apps/server/src/rooms.ts:8`, `socket.ts:4`).
  - `packages/game-core/src/index.ts:32-33`: `PlayerId`/`RoomId` aliases nothing imports.
  - `packages/game-core/src/index.ts:7,41`: `view()` returns `{public: unknown; private: unknown}`, so every Board casts.

- **F2. One metadata source per game: `packages/shared/src/games.ts`.** Name, seat limits and practice kind live there; the catalog adds descriptions; every `GameDefinition` spreads `seats(id)`; web tables key on its `GameId`. Dead catalog fields go, the ones the home page re-implemented become real (`practice: 'room' | 'local'`). _Contract done (7a61704); adoption in games and home page in round 1._
  - `packages/shared/src/index.ts:8-68` and each definition (`games/azul/src/index.ts:428`, `carcassonne/src/index.ts:1014`, `catan/src/index.ts:793`, `codenames/src/index.ts:380`, `domino/src/index.ts:325`, `little-secret/src/engine.ts:475`, `sushi-go-party/src/index.ts:920`, `uno/src/index.ts:286`): `id`/`minPlayers`/`maxPlayers` copied with nothing linking them; `create()` re-checks the same limits a third time (`uno/src/index.ts:55`, `azul/src/index.ts:113`, `codenames/src/index.ts:35`, `sushi-go-party/src/index.ts:130`, `carcassonne/src/index.ts:684`, `catan/src/index.ts:116`).
  - `packages/shared/src/index.ts:11…` `preview` never read; `:12` `practice: true` never read while `apps/web/src/routes/+page.svelte:298` hard-codes `selected === 'uno'`; `:21` `setupModes` never read while `+page.svelte:279-289` hard-codes `selected === 'catan'` and the modes.
  - `apps/web/src/lib/catalog/types.ts:2` derives `GameId` from the Paraglide catalog; `apps/web/src/lib/games.ts`, `guides/load.ts`, `+page.svelte:25-56` key tables by game id with no completeness check.
  - `games/codenames/src/Board.svelte:29-33` takes `maxPlayers` as a prop only to print the seat count it could read from metadata.

- **F3. Each game owns one browser entry (`./client`): its lazy table and its retry predicate.** `apps/web/src/lib/games.ts` becomes a typed `Record<GameId, GameClient>`; `action-retry.ts` keeps only the generic guards and asks the game. _Done (7a61704)._
  - `apps/web/src/lib/action-retry.ts:44,104,116`: Little Secret, Carcassonne/Codenames and Sushi rules (action types, phases, private prompt ids) hard-coded in the transport.
  - `apps/web/src/lib/games.ts:25-29`: Dominó's preload is a special case inside the generic registry.
  - `apps/web/src/routes/room/[id]/+page.svelte:59`: `id in gameClients` check because the registry was untyped.

- **F4. One Board contract (`BoardProps` in `@board-games/shared/ui`) and one room shell for every game.** The room page passes the same props and the same room controls (`settingsContent`: back, invite, language, status·id) to every Board; every Board renders `canRematch`/`rematch` itself. _Room side done (7a61704); Boards adopt in round 1._
  - `apps/web/src/routes/room/[id]/+page.svelte:33-44` `cornerControls` list of 7 game ids; `:128` `gameId !== 'catan'`; `:208` `gameId === 'catan'` settings branch (Catan Board lacks `canRematch`); `:213` `gameId === 'carcassonne' || cornerControls`.
  - `games/carcassonne/src/Board.svelte:2095-2096` hides the room toolbar with a global selector instead of the room not drawing it.
  - `room/[id]/+page.svelte:126` practice label in a toolbar that never shows for a practice room; `:222` hard-coded `en`/`es` options next to `:133` `locales`.
  - `games/codenames/src/Board.svelte:975-989` draws a second invite button and room line inside the room's own controls.
  - Every Board declares its own subset of the ~20 props the room passes, with drifting types (`rematch` `() => void` vs `() => Promise<void>`, `send` `any` vs `unknown`): see `inventory/*` "Board contract" items; Carcassonne ignores `errorCode`/`rulesContent`, Catan `pending`/`canRematch`.
  - Unused declared props: `codenames Board.svelte:51,56` (`locale`, `canConfigure`), `little-secret Board.svelte:28,44` (`locale`), `azul Board.svelte:40,56` (`canConfigure`).

- **F5. Rules reject with a message key; one `errorText()` translates any key.** `@board-games/shared/ui` `message()`/`errorText()`; Azul, Carcassonne and Dominó throw their existing `azul_error`/`carc_error`/`domino_error` keys. UNO and Catan keep their English sentences, which `errorText` shows as before. _Helper and room done (7a61704); games in round 1._
  - `room/[id]/+page.svelte:74-81`: `startsWith('AZUL_')` special case and the `^(azul_|cn_|sgp_|ls_)` prefix list.
  - `games/domino/src/index.ts:82-199`: `DOMINO_*` codes are in no prefix list, so the room shows `DOMINO_ILLEGAL` raw (bug).
  - `games/carcassonne/src/index.ts:91-93`: raw English `'Invalid Carcassonne action'` while a `carc_error` key exists.
  - `games/azul/src/index.ts:117-205`: eight `AZUL_*` codes collapsed to one message downstream.
  - Three `as unknown as Record<string, …>` message-by-key helpers: `games/sushi-go-party/src/labels.ts:10-18`, `games/carcassonne/src/labels.ts:3-9`, `apps/web/src/lib/catalog/guides/sushi-go-party.ts:28-29`.
  - Practice pages swallow the rule error into a generic string (`practice/catan/+page.svelte:83`, `azul:64`, `domino:47`, `carcassonne:73`).

- **F6. Per-viewer settings through one helper each: `viewerPreferences(game, defaults)` and `ViewerSkin`.** One storage key and encoding (`board-games:preferences:<game>`, JSON) and one lazy-skin state machine; Dominó's look uses the shared skin store. Saved sound/motion choices reset once (accepted). _Helpers done; adoption in round 1._
  - Preferences: `uno:sound|motion` 'on'/'off' (`uno/src/Board.svelte:49,51,198`), `catan:*` 'true'/'false' (`catan/src/Board.svelte:86-87,302`), `carcassonne:*` (`Board.svelte:91,171`), `azul-preferences` (`azul/src/Board.svelte:301,363`), `codenames:preferences` with `reduced` (inverse of motion, `:377,387`), `little-secret:preferences` (`:263-270`), `sushi-go-party:preferences` (`:245,270`), `domino:*` (`game.svelte.ts:90,300-322`).
  - Lazy skin block (`skin`/`pixelReady`/`pixel` + `import('./pixel.css')`) copied in 7 Boards: `uno :58-72`, `catan :78-84`, `carcassonne :115-130`, `azul :100-113`, `codenames :152-159`, `sushi :137-143`, `little-secret :84-99`.
  - `games/domino/src/look.ts:3-12` re-implements `gameSkin` with key `domino:look` and values `3d`/`pixel`.
  - `apps/web/src/lib/theme.svelte.ts:12-15`, `+page.svelte:60-62,129-131`, `room/[id]/+page.svelte:48`: raw `localStorage` with local `try {} catch {}` next to the shared `read`/`write`.

- **F7. One chip-note building block for 8-bit sound packs (`chipNote`) and one `clamp01`.** _Helpers done; adoption in round 1._
  - `note()` over `audio.tone({… attack: 0.002})` copied in `uno/pixel/sound.ts:26`, `catan/pixel/sound.ts:14`, `carcassonne/pixel/sound.ts:72`, `domino/pixel/sound.ts:13`, `little-secret/pixel/sound.ts:26`, `azul/pixel/sound.ts:27`, `sushi-go-party/pixel/sound.ts:35`, `sushi-go-party/effects.ts:15`.
  - Volume clamp `Math.min(1, Math.max(0, v))` in `shared/ui/pixel/zzfx.ts:25`, `codenames/Board.svelte:390`, `sushi-go-party/Board.svelte:247`, `codenames/effects.ts:21`, `little-secret/effects.ts:22`.
  - `codenames/src/effects.ts` and `little-secret/src/effects.ts` are near-identical wrappers.

- **F8. One shell for practice routes (`PracticeTable` + `$lib/practice/Practice.svelte`).** Lazy table via the client entry, seat that follows the actor, scenario select (and `?scenario=` links for every game), language, reset, translated rule errors, header hiding. Each game's `practice()` returns a `PracticeTable` with its own players; page-only special cases move into the game's practice module. _Shell done; routes migrate in round 1._
  - Seven routes repeat lazy load + language select + `body:has(.x) .site-header` + error alert (`practice/*/+page.svelte`), with different `setLocale` options and seat tracking (Azul never follows the actor, Carcassonne does).
  - `practice/carcassonne/+page.svelte:22` branches on `scenario === 'table'` because `practice()` hides its players; `:57-70` fans `ready` out to every seat from the page; `:22-25` undocumented `?scenario=`.
  - `practice/sushi-go-party/+page.svelte:11` imports the rules (`./server`) and re-assembles the facade (`others()` loop `:60-102`, clone `:44-45`, own `seeded` `practice.ts:13-21`).
  - `practice/catan/+page.svelte:32-81` reads `game.state.phase` internals and refreshes `view` by hand in five places; `practice/codenames/+page.svelte:41-46` and `codenames/practice.ts:64-69,126-140` keep three copies of "who acts".
  - Dominó route imports `Loading.svelte` and `look` only to draw a second loading cover (`practice/domino/+page.svelte:3-5,70-74`).

- **F9. The Jev lab owns its HTTP route and wire contract.** `packages/jev-lab/src/codenames/http.ts` holds the handler and budget, loaded by the server only with `JEV_LAB=1`; personalities come from one list. _Route done (7a61704); lab internals in round 1._
  - `apps/server/src/index.ts:12,43-109`: generic server entry imports the lab, owns its rate limit, body limit, personality names and score shape; `apps/server/package.json` loads it on every start.
  - `practice/codenames/+page.svelte:22-28` and `live.ts:55` and `server/index.ts:96`: the personality union three times; `CNP:61-88` + `prompts.ts:6-14` + `live.ts:85-126`: wire shape three times.
  - `packages/jev-lab/src/codenames/scenarios.ts:3` imports `../../../../games/codenames/src/words.ts` past the package exports.
  - `guessers.ts:65-69` / `live.ts:133-138` duplicate `combinations()`; `prompts.ts:29` `Prompt.state?` never implemented; `live.ts:13-20` `Plan.ms` unread; `CNP:74,83,99` + `live.ts:143,183` redundant `unlimited` (page already sends `count: 0`).

- **F10. Room internals name what they repeat.** _Done._
  - `apps/server/src/rooms.ts:123,217,241,339`: bot delay `900` four times.
  - `rooms.ts:208,280,322,380`: "a bot counts as connected" written four ways.

## Per-game fixes (round 1 agents, one owner per game)

Each game agent applies F2–F8 to its game, then the game-local fixes below. Full problem lists with
line numbers: the matching `inventory/` file.

- **G-UNO.** Legality as a function, not exceptions: `legalActions(state, player)` used by `validate` and `view`.
  - `uno/src/index.ts:254-261` `try { validate } catch { return false }` (swallowed exception as control flow).
  - `uno/src/Board.svelte:85,116-119,169-178` re-declares colours and symbol↔glyph tables that `index.ts:5,30-52` owns.
  - `uno/src/Board.svelte:48-72` + `motion.ts:216-227`: sound enabled in two places; `motion.ts` mixes flights and paper sound.
  - `uno/README.md`: stale (Rust, tests, seating).
- **G-Catan.** Rules export what the table re-derives; one `Action` union.
  - `catan/src/Board.svelte:416-424` `reserve()` recomputes the projected `inventory`; `:425-437` `validOffer()` copies the offer rules and the `24` limit; `index.ts:751-789` projects fields nothing reads.
  - `catan/src/index.ts:7-21` one wide optional-field `Action` forces 9 non-null assertions and `any` in Board and practice.
  - Settlement/city paths copied 7× (`Board.svelte:668-669,1360-1370,1576-1577`, `effects.ts:187`); production timing copied into `pixel/sound.ts:131`.
  - `catan/src/board.ts:1-2` pass-through `shuffle` re-export; dead `union()` (`pixel/geometry.ts:341`), dead `data-strength` write (`effects.ts:284`), unused exports.
  - `games/catan/art/__pycache__/*.pyc` tracked.
- **G-Carcassonne.** Typed kinds and one figure supply.
  - `carcassonne/src/index.ts:25-60` prompt/option/event/stage kinds are plain strings the UI and sounds branch on.
  - Figure supply in three files (`index.ts:120-125`, `overview.ts:96-101`, `Board.svelte:707-711`); 3×3 neighbourhood test four times (`index.ts:502-505`, `features.ts:111-113,176-179`, `table/scenery.ts:381`).
  - `effects.ts:7-125` local `EventGate` beside the shared gates; `pixel/sound.ts:62` never cancels delayed cues.
  - Dead: `pixelArt` (`pixel/atlas.svelte.ts:21-26`), `state` getter (`practice.ts:165-167`), redundant `robberRewards` assignment (`index.ts:292`), `create` wrapper (`:1016`).
- **G-Azul.** Location ids from one module; presentation names its timings.
  - `azul/src/index.ts:80-425` emits `factory/…`/`…/pattern/…` strings that `presentation.ts`, `effects.ts`, Board and PlayerBoard parse with `split('/')`; `effects.ts:56-58` regexes on them.
  - `azul/src/presentation.ts:229` identifies cleanup flights by `duration === 150`.
  - Floor size `7` and other rule numbers copied into Board (`:160,175`); colour labels three times (`Board.svelte:121-127`, `Tile.svelte:12-19`, `PlayerBoard.svelte:56-63`).
  - Dead: `canConfigure`, `displayedScore`, `pixelTileOrder`, `View.private`, unused exports; README names files that do not exist.
- **G-Codenames.** The engine owns its rules; the Board reads them.
  - `codenames/src/Board.svelte:81-93` `rosterReady` is a drifted copy of `validRoster` (`index.ts:70-76`); `:675-701` copies the spymaster-slot rule.
  - `codenames/src/index.ts:282-377` `publicEvent`/`view` copy fields one by one; `types.ts:44-70` repeats `State` by hand.
  - Hand-rolled `<dialog>` (`Board.svelte:96-117`) instead of `modal`.
  - Dead: five table WebPs (~334 KB) and the README claim, `Icon.svelte:33-35` `settings` branch, `packVersion`.
- **G-Little Secret.** One initial-state builder; one "who acts".
  - `little-secret/src/engine.ts:254-312` `deal()` resets ~20 fields `create()` already defaults (`:68-103`).
  - `practice.ts:182-199` re-derives the next actor; `:127-143` roles map twice.
  - Hand-rolled `<dialog>` (`Board.svelte:180-190`); `effects.ts:6,8` dead cues; `data-testid`s with no tests.
- **G-Sushi.** Shared gate and a practice facade; rule numbers from the rules.
  - `sushi-go-party/src/presentation.ts:172-191` `EventCursor`, a third gate; rules module hosts it (`index.ts:22-26`).
  - Six of twelve event kinds and `Presentation.round/turn` never read (`presentation.ts:1-8,96-108`).
  - Picks-per-round copied (`index.ts:198-205`, `Board.svelte:458-479`); uramaki prize twice (`index.ts:327`, `scoring.ts:126`); custom-menu limits re-implemented (`Board.svelte:204-215,596-614`).
  - `Board.svelte:409` `class:rich={true}` constant behind 153 selectors; six `data-testid`s; five practice-only Board props.
- **G-Dominó.** Named constants and one pip table.
  - Hard-slam `0.55` seven times (`index.ts:207`, `three/scene.ts:384`, `three/Table3D.svelte:41,74`, `pixel/scene.ts:483,495`, `pixel/sound.ts:26`); flight time in six with 3D and pixel disagreeing (`Table3D.svelte:68` vs `three/scene.ts:383`).
  - `spots.ts:1-35` vs `Tile.svelte:14-47` two pip tables, already diverged for 6.
  - Team-name limit 16 three times (`index.ts:160-166`, `game.svelte.ts:339`, `Hud.svelte:95`).
  - Dead: `./layout` export, unused `DOUBLE_SIX`/`legalFor`/`validate`/`ends` exports, `practice().players`.

## Web catalog and home (round 1 agent)

- **W1. Per-game catalog content is looked up, not branched on.** BoxArt/SummaryStep become per-game components in a `Record<GameId, Component>`; Rulebook's UNO and Catan reference blocks become chapter data; the guide wrappers for games whose guides live in their package go away.
  - `apps/web/src/lib/catalog/BoxArt.svelte:42-408`, `SummaryStep.svelte:7-149`: `{#if game === …}` chains for eight games.
  - `Rulebook.svelte:146,163`: `game === 'uno' && chapter === 'actions'`, `game === 'catan' && chapter === 'building'`.
  - `guides/{AzulScene,CodenamesScene,LittleSecretScene}.svelte`, `guides/{codenames,little-secret}.ts`: pass-through wrappers.
  - `+page.svelte:25-56`: `ls_`/`sgp_` summary keys vs `library_<game>_` for the rest, no completeness check.
- **W2. Home start dialog follows the metadata.** Practice kind and Catan setup modes come from `games`; `createRoom` options per game stay with the controls that set them.
  - `+page.svelte:135-140,255,270,279,298,303`: four `selected === '<game>'` blocks.
- **W3. The home page and layout use the shared helpers and talk through state, not DOM.**
  - `+page.svelte:97-123` hand-rolled dialog duplicating `modal()`.
  - `+layout.svelte:30-34` + `+page.svelte:80-81`: a `catalog-join` window event for one parent-child call.
  - `+layout.svelte:112-144,176-186`, `+page.svelte:676-700`: `body:has(.pixel-store)` / `body:has(.library)` restyle by detecting the page's markup.
  - `Rulebook.svelte:84-113` + `+page.svelte:63-79`: retry hash/param protocol in two files.
  - Theme key duplicated (`theme.svelte.ts:2`, `app.html:8-13`), `Theme` = `Skin` type copy.
- **W4. Dead code and data.** `app.css:232-235` `.join-form`/`.game-art`; `pixel.css:43,52,64` `.px-panel`/`.px-button`; `+page.svelte:188` `data-box`; `shopkeeper.ts:44-47` unused `random` param; 54 unreferenced message keys (`inventory/web-shared.md` "Message keys").

## Comments

- **C1. Remove comments that restate the code; keep those about outside facts and live workarounds.** Each round-1 agent sweeps its own files (lists per file in `inventory/*` "Restating comments"), and removes stale claims (`codenames/words.ts:13` "pack tests", `codenames/table/README.md` "imports all six", `uno/README.md`).

## Deliberately not done

Recorded in [report.md](report.md) with reasons (large visual splits of the 3000-line Boards, moving
Dominó's cosmetic poses out of canonical state, DOM-selector contracts in effects, the per-game
skin-choice fieldset).
