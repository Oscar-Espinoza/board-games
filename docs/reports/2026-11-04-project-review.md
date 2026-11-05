# Project review: board-games

Reviewed commit `34b3a2f` on `main`, November 4, 2026. Baseline `bun run check` and `bun run build` pass.

Scope: every game (UNO, Catan, Carcassonne, Azul, Codenames, Sushi Go Party, Little Secret, Dominó), the web shell, the server, the Jev lab, and the art of both skins (Classic and 8-bit). 446 findings survived adversarial verification. They are merged here into fewer items, and each item cites its source finding ids (`_Src:_`) so it can be traced. Nothing below asks for tests; validation stays `bun run check` + `bun run build` plus a look in the browser.

Item ids: `B` bugs and risks, `R` removals, `D` docs, `S` shared-helper consolidations, `P` performance, `U` UX, accessibility and i18n, `ART` cross-game art direction, and per-game art ids (`UNO-C1` Classic, `UNO-8.1` 8-bit; prefixes `UNO`, `CAT`, `CAR`, `AZ`, `CN`, `SGP`, `LS`, `DOM`, `HOME`). Effort: S is under half a day, M is one to two days, L is more.

## 1. Summary

The project is in good shape. Rules stay pure, the server owns state, every game has two working skins, and check and build pass. The serious risks sit at the edges. The HTTP server can be killed by an ordinary rebuild, or by a bug in any one game's view, presence or bot code. Three boards also throw away the player's half-made move whenever any snapshot arrives. The cheapest large wins are performance. The room route ships every game's text in both languages (about 96 KB brotli), 8-bit players download the full Classic art before their own (1.4 MB on Azul), and 8-bit Catan re-rasterizes its island on every update (about 110 ms). Removal is mostly unused message keys (about 90), docs that still describe deleted tests, unused assets (29 MB of Azul source PNGs in the tree), and plumbing that shared helpers already cover. On art, Classic is the weaker skin: several games are close to silent and have no win moment, while 8-bit already has cues, banners and juice. 8-bit's gaps are crisp-pixel defects, chrome that covers game state, and sprite frames that ship but are never drawn. The least-tested viewports are phones in landscape and short laptops: Catan and UNO can't be played at 667×375, and Azul sends 1366×768 laptops to its phone layout.

### Top 12

| Rank | Item | Area | Type | Effort | Why |
| ---: | --- | --- | --- | --- | --- |
| 1 | [B1](#b1) + [B3](#b3): Contain server crashes (vanished static file, game-code exceptions) | Server | Bug | M | One rebuild or one latent bug in any game ends every room |
| 2 | [B2](#b2): Drawing a card in UNO scrolls the table off-screen | UNO | Bug | S | After the first draw, mouse users lose Settings, Back and Rematch |
| 3 | [P1](#p1): Room route ships the full two-locale message catalog | Shell | Perf | S | About 96 KB brotli off every multiplayer room, one file |
| 4 | [P2](#p2): 8-bit skins download the Classic art first | Azul, Catan, Codenames, Little Secret, Carcassonne | Perf | M | 8-bit Azul goes from about 1.6 MB to about 220 KB; no Classic flash |
| 5 | [P3](#p3): 8-bit Catan re-rasterizes the island on every snapshot | Catan | Perf | S | About 0.1 s of main thread per action on desktop, more on phones |
| 6 | [B4](#b4): Snapshots wipe the player's in-progress choice | Catan, Azul, Little Secret | Bug | S | Another player's action or reconnect cancels your move |
| 7 | [U1](#u1): Invited guests are told the room "may have ended" | Room shell | UX | M | The first screen a friend sees looks like a dead link |
| 8 | [U10](#u10): Home hover-to-select starts the wrong game | Home | UX | S | A diagonal mouse path to Start re-selects another game |
| 9 | [U27](#u27): Little Secret's action panel hides your password and the next button | Little Secret | Art/UX | S | Breaks the game's private moment at common laptop heights, both skins |
| 10 | [U15](#u15) + [U16](#u16): Phone landscape breaks Catan and UNO | Catan, UNO | UX | M | Board, own seat and Draw are unreachable at 667×375 |
| 11 | [R1](#r1)–[R21](#r21) + [D1](#d1)–[D4](#d4): Dead code, assets and docs purge | All | Removal | S | About 90 keys, 29 MB of PNGs, 334 KB props and docs that point at deleted tests |
| 12 | [ART-1](#art-1) + [ART-2](#art-2): Classic moment feedback (sound palette and end-of-game moments) | All Classic skins | Art | M | Classic is near silent in six games and has no win moment in five |

## 2. Bugs and risks

### High

<a id="b1"></a>**B1. A static file that vanishes after startup kills the server, and files edited in place are served truncated.** Server · M.
sirv runs `fs.createReadStream(file).pipe(res)` with no `error` listener (`node_modules/.bun/sirv@3.0.2/node_modules/sirv/build.mjs:95`) and indexes files once at startup. The try/catch around `assets()` at [apps/server/src/index.ts:114](../../apps/server/src/index.ts#L114) only catches synchronous throws. Verified repro: delete one built chunk, send one GET, and Bun exits with an unhandled ENOENT; every room is gone. `bun run build` wipes `apps/web/build` while the server keeps running, so rebuilding with friends connected triggers it. An `200.html` edited in place was served with the old `Content-Length` (1979 of 2579 bytes).
Fix: before `assets(...)`, add `res.once('pipe', (src) => src.on('error', () => res.destroy()))`, which works in Bun 1.4.2. Pass `dev: true` to sirv so it stats on every request. That also sends `no-cache` on every non-immutable file, which fixes the HTML half of [P8](#p8).
_Src: server:code#1, server:code#7._

<a id="b2"></a>**B2. Drawing a card in UNO scrolls the `overflow: hidden` table, pushing the tools off-screen.** UNO · both skins · S.
[games/uno/src/motion.ts:186](../../games/uno/src/motion.ts#L186) calls `scrollIntoView` on your drawn card. `.hand` has no overflow, so the scroll lands on `.uno-table`, which is `overflow: hidden` ([games/uno/src/Board.svelte:681](../../games/uno/src/Board.svelte#L681)). Scripts can scroll that box, but the mouse wheel can't scroll it back. Verified at 1440×900: one draw sets `scrollTop` to 80, and the tools move from y 20 to −60. Sound, motion and Settings (and with them Back, Invite, language and Rematch) are gone for the rest of the round. At 390×844 the table shifts 44 px sideways, and the seats drift off the painted rim. The draw flight also starts from a rect measured before the scroll.
Fix: delete the `scrollIntoView` block (about 6 lines) and set `.uno-table { overflow: clip }` so nothing can scroll the table again. Then fix the README line that claims the hand scrolls ([D2](#d2)).
_Src: uno:code#1, uno:art-classic#1._

### Medium

<a id="b3"></a>**B3. A game-code exception outside a socket handler terminates the process.** Server · S.
`handle()` catches errors, but the disconnect listener and the sweep and bot intervals ([apps/server/src/socket.ts:81](../../apps/server/src/socket.ts#L81)) run `publish → definition.view`, presence and `botAction/apply` with no guard, and there is no process-level handler. Verified with a fake game whose `view` throws for one state: the action ack still said `ok`, and the next disconnect killed the server.
Fix: in `publish`, wrap each socket's view and emit in try/catch and log the room and game id. Wrap the disconnect body and each room's iteration in `sweep()` and `advanceBots()`. On a non-`RoomError`, stop that room's bots so one room's bug can't end every other match. Do this together with [B30](#b30) so a failed publish still replies.
_Src: server:code#2._

<a id="b4"></a>**B4. Snapshots that change nothing still wipe the player's in-progress choice.** Catan, Azul, Little Secret · both skins · S each.
The session replaces `room.game` on every `snapshot` ([apps/web/src/lib/session.svelte.ts:67](../../apps/web/src/lib/session.svelte.ts#L67)), and the server publishes on joins, disconnects, sweeps and other players' trade actions. Three boards treat a new `view` object as "the game changed":
- Catan [games/catan/src/Board.svelte:401](../../games/catan/src/Board.svelte#L401) clears `pending` and `showPlacements`. While you choose a road, any opponent's offer or reconnect cancels your Confirm bar. Fix: `const chosen = $derived(pending && legal.find((a) => same(a, pending)))`, and clear `showPlacements` only when that type leaves `legal` or the turn changes.
- Azul [games/azul/src/Board.svelte:368](../../games/azul/src/Board.svelte#L368) calls `settle()`, closes the picker and draft dialog, and clears the round details. Reproduced: an opponent reloading closes your half-made phone draft. Fix: remember `{revision, identity, connected}` and return early when all three are unchanged (keep calling `gate.accept` first).
- Little Secret [games/little-secret/src/Board.svelte:138](../../games/little-secret/src/Board.svelte#L138) (and :191 and :207) key their "reset" effects on `s = $derived(view.public)`, so they run on every snapshot and clear the typed clue, targets and answers. Fix: derive primitive keys (`${round}:${playerId}:${s.mission}`, `${s.phase}:${s.prompt?.id}:…`, `s.setupVersion`) and read only the key in each effect. Remove the duplicate `answer` reset.

Rule for every board: key resets on primitives (revision, phase, prompt id), never on `view` identity.
_Src: catan:code#3, azul:code#1, little-secret:code#14._

<a id="b5"></a>**B5. After a finished game, a departed seat blocks the rematch for good.** Server · S.
`start()` rejects any human seat without a socket ([apps/server/src/rooms.ts:208](../../apps/server/src/rooms.ts#L208)). `expire()` drops vacant seats only when `state === null` ([apps/server/src/rooms.ts:302](../../apps/server/src/rooms.ts#L302)), and `join()` refuses new seats once a state exists. Verified: UNO with A, B and C, finished; C leaves; 121 s later the host still gets "Wait for every seat to connect". One newcomer can take C's seat, and the next gets "No available seat".
Fix: in `start()`, when the state is finished, first drop expired vacant human seats (`room.seats.filter((s) => s.bot || s.socketId || s.reservedUntil !== null)`), promote the host, then run the existing checks.
_Src: server:code#3._

<a id="b6"></a>**B6. There is no `leave` event, so Back from a lobby freezes the host's Start for 120 s.** Server and shell · S.
`leave()` only disconnects the socket ([apps/web/src/lib/session.svelte.ts:155](../../apps/web/src/lib/session.svelte.ts#L155)), and `rooms.disconnect` reserves the seat for the grace period ([apps/server/src/rooms.ts:262](../../apps/server/src/rooms.ts#L262)). Verified: a guest who opens the invite and steps back blocks Start until 121 s have passed.
Fix: add a `leave` event that the client emits before disconnecting. On the server, remove the seat at once in a lobby or finished room, and keep today's reservation during play so an accidental Back mid-game can still be recovered.
_Src: server:code#4._

<a id="b7"></a>**B7. A host who reloads, or backgrounds the tab to share the link, hands host to a guest for good.** Server · S.
`disconnect()` calls `promoteHost`, which moves `hostId` to any connected seat ([apps/server/src/rooms.ts:284](../../apps/server/src/rooms.ts#L284)), and a token rejoin never moves it back. Phones drop the socket while the host pastes the invite into a chat app. Verified: after Oscar reloaded the lobby, the roster read "Oscar (You)" and "Luna · Host".
Fix: keep the immediate promotion. Store `creatorId` on the room, and on a token rejoin in a lobby or finished room set `hostId` back to the creator. Update the host sentence in [docs/architecture.md:31](../../docs/architecture.md#L31).
_Src: gap2#8._

<a id="b8"></a>**B8. Blocked localStorage blanks the whole app.** Shell · S.
Paraglide's `localStorage` strategy ([apps/web/vite.config.ts:11](../../apps/web/vite.config.ts#L11)) reads storage with no try/catch ([packages/shared/src/paraglide/runtime.js:247](../../packages/shared/src/paraglide/runtime.js#L247), setter at :448), and it does so on every `m.*()` call. Reproduced: with storage throwing `SecurityError` the page has no title, header or main. Typing four characters into the Rulebook search made 1,181 `getItem` calls.
Fix: a custom strategy registered from `+layout.ts` before the first message call. It caches the locale in memory and writes through the shared `write()`. Set the strategy list to `['custom-safe', 'preferredLanguage', 'baseLocale']`.
_Src: web-shell:code#1._

<a id="b9"></a>**B9. The 8-bit home flashes the Classic page first, and stays blank if the store chunk fails.** Home · 8-bit · S.
`app.html` sets `data-theme` before paint, but no CSS reads `[data-theme]`. All 8-bit chrome hangs on `body:has(.pixel-store)` in lazy CSS ([apps/web/src/routes/+layout.svelte:112](../../apps/web/src/routes/+layout.svelte#L112)). The `{#await import(PixelStore)}` at [apps/web/src/routes/+page.svelte:156](../../apps/web/src/routes/+page.svelte#L156) has no pending or catch branch. Measured on Fast 4G: a cream root for about 400 ms, then the Classic header, then 8-bit.
Fix: move the 8-bit page background, colour and header styles into `app.css` under `:root[data-theme='pixel']`. Give the `{#await}` a dark placeholder of the same height and a `{:catch}` that falls back to the Classic library.
_Src: web-shell:code#2._

<a id="b10"></a>**B10. A Little Secret room created with "Classic powers" can never start with 3–5 seats.** Little Secret · S.
[games/little-secret/src/engine.ts:47](../../games/little-secret/src/engine.ts#L47) fails when `powers && count < 6`, and `create()` runs that check (:71) with the options fixed at room creation ([apps/server/src/rooms.ts:212](../../apps/server/src/rooms.ts#L212)). The home page sends `powers` before anyone knows the seat count ([apps/web/src/routes/+page.svelte:135](../../apps/web/src/routes/+page.svelte#L135)). Verified: create with powers, three joins, start → `ls_error`. The options can't be edited, so the lobby is stuck.
Fix: in `create()`, treat the options as defaults (`powers: o.powers === true && players.length >= 6`), and keep the strict check only in `configure`. Optionally drop the home-page checkbox, since setup already has one gated on 6+ seats.
_Src: little-secret:code#1._

<a id="b11"></a>**B11. Carcassonne replays every missed event on reconnect (sounds, receipts, rising cities).** Carcassonne · both skins · S.
`connected` flips to true before the join snapshot arrives ([apps/web/src/lib/session.svelte.ts:71](../../apps/web/src/lib/session.svelte.ts#L71)). The local `EventGate` ([games/carcassonne/src/effects.ts:110](../../games/carcassonne/src/effects.ts#L110)) then takes the stale view as its baseline, so the resumed snapshot looks contiguous. A Bun run of the gate returned 15 events after a reconnect. This breaks the documented invariant "never on reload or reconnect".
Fix: add the snapshot-identity guard that the shared gate already uses ([packages/shared/src/ui/gates.ts:34](../../packages/shared/src/ui/gates.ts#L34)). Remember `offlineEvents` while disconnected, return `[]` while the same array is still rendered, and re-baseline on the first new array. Also clear `risingTimer` in the `onMount` cleanup.
_Src: carcassonne:code#1._

<a id="b12"></a>**B12. Sushi Go Party's 8-bit podium ranks ties without round-3 desserts.** Sushi Go Party · 8-bit · S.
The engine breaks ties with banked desserts plus tableau desserts ([games/sushi-go-party/src/index.ts:380](../../games/sushi-go-party/src/index.ts#L380)), but round-3 desserts are never banked into `p.desserts`. The podium sorts by `b.desserts.length` ([games/sushi-go-party/src/Board.svelte:146](../../games/sushi-go-party/src/Board.svelte#L146)) and shows that count (:818, :855). In a 600-game sim, 3 podiums put a non-winner first, and 583 under-counted desserts.
Fix: derive one per-seat count, `p.desserts.length + p.tableau.filter(isDessert).length`, and use it for the sort, the badge and the receipt tally.
_Src: sushi-go-party:code#1._

<a id="b13"></a>**B13. Declining a Catan trade offer does nothing, and Accept gives no feedback.** Catan · both skins · M.
DECLINE only removes you from `accepted` and deletes the offer when `o.to === p` ([games/catan/src/index.ts:680](../../games/catan/src/index.ts#L680)). `legalActions` keeps offering ACCEPT and DECLINE after you accept (:413). Rerun: after a decline the offer stays, and a second accept still bumps the revision.
Fix: add `declined: string[]` per offer. Hide the offer from decliners, and drop it when the active player declines a non-active player's open offer. Skip ACCEPT for players already in `accepted` and show them "Accepted, waiting for X". List the accepting partners to the offerer. Reset `offerSent`, give and take when the player or round changes.
_Src: catan:code#2._

<a id="b14"></a>**B14. The Azul guide lights the red wall cell for a yellow line.** Azul · guide · S.
[games/azul/src/HelpScene.svelte:71](../../games/azul/src/HelpScene.svelte#L71) lights `r === 2 && c === 4` at step 2, which is red. Yellow is at `c === 3`. The line also fills left to right, away from the wall (:82). Both the in-game rulebook and the catalog lesson show it.
Fix: change `c === 4` to `c === 3`. Optionally mirror the three slots so the line fills from right to left, as [docs/games/azul.md](../../docs/games/azul.md) says.
_Src: azul:code#2._

<a id="b15"></a>**B15. The lobby shows the room code uppercased, but codes are case-sensitive.** Room shell · S.
The id is rendered in `.eyebrow` ([apps/web/src/routes/room/[id]/+page.svelte:154](../../apps/web/src/routes/room/%5Bid%5D/+page.svelte#L154)), which sets `text-transform: uppercase` ([apps/web/src/app.css:96](../../apps/web/src/app.css#L96)). Ids are mixed-case base64url ([apps/server/src/rooms.ts:116](../../apps/server/src/rooms.ts#L116)). Verified: typing the displayed code into "Join a room" gives "Room not found".
Fix: render the id in its own `.room-code` class (monospace, letter-spacing, no transform).
_Src: gap2#3._

<a id="b16"></a>**B16. In 8-bit Sushi Go Party, every lock-in and every deal plays the conveyor-belt "pass" clatter, and the volume slider does nothing above 40%.** Sushi Go Party · 8-bit · S.
Each PICK and each deal is its own event batch ([games/sushi-go-party/src/index.ts:770](../../games/sushi-go-party/src/index.ts#L770)), and the cue picker falls back to `'pass'` ([games/sushi-go-party/src/Board.svelte:330](../../games/sushi-go-party/src/Board.svelte#L330)). So your own keep plays "lock" and then "pass". [games/sushi-go-party/src/pixel/sound.ts:33](../../games/sushi-go-party/src/pixel/sound.ts#L33) clamps `level * 2.5` to 1.
Fix: map cues explicitly. Add a soft "commit" tok for opponents, skip your own committed echo, add a "deal" riffle, and play "pass" only when a pass event exists. Use `level` directly and raise the base volumes.
_Src: sushi-go-party:art-pixel#2._

<a id="b17"></a>**B17. Catalog guide scenes contradict their captions.** UNO, Catan, Carcassonne, Dominó, Little Secret · guides · M (Carcassonne L).
The rulebook text is right, but the pictures often show something else:
- UNO Reverse: the result frame reads `L ← B ← A`, the same order as before ([apps/web/src/lib/catalog/guides/uno.ts:74](../../apps/web/src/lib/catalog/guides/uno.ts#L74)). The paths have no arrowheads. Set it to `A → L → B` and add `marker-end`.
- UNO penalties: every stack and stock circle is labelled "Hand · Bea" ([apps/web/src/lib/catalog/guides/UnoScene.svelte:108](../../apps/web/src/lib/catalog/guides/UnoScene.svelte#L108)), even when the caption is about Leo. Wild +4 is drawn as a red card (:87). Use per-frame labels and the table's black four-colour wild.
- Catan: Knight moves the robber onto Ada's own forest ([apps/web/src/lib/catalog/guides/CatanScene.svelte:114](../../apps/web/src/lib/catalog/guides/CatanScene.svelte#L114)), the victory track lights `+2` as cell 2 (:180), the bank frame says 3:1 for "gives two lumber" ([apps/web/src/lib/catalog/guides/catan.ts:140](../../apps/web/src/lib/catalog/guides/catan.ts#L140)), the seven arrow points Bank→Ada, and Monopoly shows the wrong resources.
- Carcassonne river: nine copies of tile F2 at rotation 0, city edges against road edges, in a lesson about bends ([apps/web/src/lib/catalog/guides/CarcassonneScene.svelte:57](../../apps/web/src/lib/catalog/guides/CarcassonneScene.svelte#L57)). Draw a real F1 → straight → bend path using rotations that `legalPlacement` accepts.
- Carcassonne, about 25 of 40 lessons: five generic layouts. Fields drawn as monasteries, a "completed" road with both ends open, a meeple sent to supply when the caption says it stays. Replace the scene switch with per-lesson authored layouts, as `sushi-scenes.ts` does (L).
- Carcassonne rules wording: the gold lesson says "adjacent occupied tile", but the engine offers any of the 8 neighbours ([games/carcassonne/src/index.ts:492](../../games/carcassonne/src/index.ts#L492)). Farmers are taught as core, but the Learn preset turns them off ([games/carcassonne/src/tiles.ts:506](../../games/carcassonne/src/tiles.ts#L506)). Message 4 is offered with an empty deck (:432). Reword the first two; skip message 4 when the deck is empty.
- Dominó: "28 tiles face down" draws 21 overlapping backs ([apps/web/src/lib/catalog/guides/DominoScene.svelte:60](../../apps/web/src/lib/catalog/guides/DominoScene.svelte#L60)). The tranque chain uses 1|4 twice and can't be a lock (:158). Doubles are drawn inline. Use a real lock and `r: 90` on the doubles.
- Little Secret: all 16 lessons draw the same three envelopes and a fixed loop line ([games/little-secret/src/GuideScene.svelte:30](../../games/little-secret/src/GuideScene.svelte#L30)); RPS step 3 shows the opposite outcome. Drop the redundant caption `<p>` and add a small marks map keyed by `lesson.scene`.
- UNO and Catan arrows render as a black filled wedge, because open paths get the default black fill ([apps/web/src/lib/catalog/guides/UnoScene.svelte:98](../../apps/web/src/lib/catalog/guides/UnoScene.svelte#L98), [apps/web/src/lib/catalog/guides/CatanScene.svelte:53](../../apps/web/src/lib/catalog/guides/CatanScene.svelte#L53)). Add `fill="none"`.

_Src: gap3#1, gap3#2, gap3#3, gap3#4, gap3#5, gap3#6, gap3#7, gap3#9, little-secret:code#5._

<a id="b18"></a>**B18. Jev re-plans a turn that is already in progress.** Codenames practice · Jev lab · S.
`guessedThisTurn` is always `[]` ([apps/web/src/routes/practice/codenames/+page.svelte:86](../../apps/web/src/routes/practice/codenames/+page.svelte#L86)), and `plan()` ignores how many guesses were used ([packages/jev-lab/src/codenames/live.ts:141](../../packages/jev-lab/src/codenames/live.ts#L141)). The midgame scenario (clue Music 2, two words already found) makes Jev guess Music a third time. Toggling Jev on mid-turn does the same.
Fix on the client: if `s.used >= count`, send `endTurn`; otherwise send `count - s.used` as the clue count. Revealed words are already off the board, so the budget then comes out right.
_Src: gap6#2._

### Low

<a id="b19"></a>**B19. Boards treat "send did not throw" as success.** Codenames, Little Secret · S.
The room `send()` catches every error and resolves ([apps/web/src/lib/session.svelte.ts:146](../../apps/web/src/lib/session.svelte.ts#L146)). In rooms, Codenames therefore closes the clue dialog and clears the word on a rejected clue, while in practice an accepted clue stays prefilled for next turn ([games/codenames/src/Board.svelte:202](../../games/codenames/src/Board.svelte#L202), :278). In 8-bit, Little Secret plays its success stamp after a rejected vote ([games/little-secret/src/Board.svelte:168](../../games/little-secret/src/Board.svelte#L168)).
Fix: [S7](#s7). In Codenames, clear the word in the effect that closes the panel when `!canClue`.
_Src: codenames:code#4, little-secret:code#9._

<a id="b20"></a>**B20. A leaked `body:has(.practice)` rule hides the home header after a practice visit.** Shell · S.
[apps/web/src/routes/practice/catan/+page.svelte:152](../../apps/web/src/routes/practice/catan/+page.svelte#L152) and [apps/web/src/routes/practice/carcassonne/+page.svelte:112](../../apps/web/src/routes/practice/carcassonne/+page.svelte#L112) hide `.site-header` whenever any `.practice` element exists, and the home dialog renders `<a class="practice">` ([apps/web/src/routes/+page.svelte:303](../../apps/web/src/routes/+page.svelte#L303)). Reproduced: after `/practice/catan` and back, opening a Start dialog hides the header. Fix: unique main classes (`catan-practice`, `carc-practice`), as Azul and Dominó already use.
_Src: web-shell:code#3._

<a id="b21"></a>**B21. Catan emits a spurious "turn" event after the last discard.** Catan · S.
[games/catan/src/presentation.ts:180](../../games/catan/src/presentation.ts#L180) compares `phase.player`, and the discard phase has none, so discard → robber plays the turn glow and ping for the same roller. Fix: compare the active player, or skip when `before.phase.type === 'discard'`.
_Src: catan:code#9._

<a id="b22"></a>**B22. Azul practice refills the bag unshuffled, so later rounds deal single-colour factories.** Azul practice · S.
[games/azul/src/practice.ts:104](../../games/azul/src/practice.ts#L104) tops the bag up colour by colour, and refill pops from the end. Fix: `shuffle(s.bag, seeded(492))` from game-core after the top-up.
_Src: azul:code#6._

<a id="b23"></a>**B23. Codenames word packs contain a non-word, a broken Spanish entry, and compounds that overlap on one board.** Codenames · S.
`potatochip` ([games/codenames/src/words.ts:6](../../games/codenames/src/words.ts#L6)), and `mina espejo mágico` (:9), which duplicates "espejo" and adds an adjective. The `new Set` at :14 hides the duplicate. A scripted check finds 25 English overlaps (meadow ⊂ meadowlark appeared on one board). Fix: drop or replace those words and one word of each compound pair. Remove the "Validated in pack tests" comment. Don't add substring checks to the deal.
_Src: codenames:code#6._

<a id="b24"></a>**B24. The Codenames clue-arrival animation fires on the wrong team's entry, and never on phones.** Codenames · S.
[games/codenames/src/Board.svelte:299](../../games/codenames/src/Board.svelte#L299) animates the first `.history-entry` in the DOM, which is red's in the default centre layout. On compact layouts the history lives in a dialog outside `root`. Fix: `data-turn={record.turn}` on entries (:479) and query `[data-turn="${s.turn}"]`. Also animate the active clue so compact layouts get feedback (see [CN-C4](#cn-c4)). Keep the reveal keyframes to transform and opacity ([P14](#p14)).
_Src: codenames:code#9, codenames:art-classic#1._

<a id="b25"></a>**B25. The 3D Dominó dispose leaks the WebGL context, and every mount logs a PCFSoftShadowMap warning.** Dominó · Classic · S.
`dispose()` ([games/domino/src/three/scene.ts:768](../../games/domino/src/three/scene.ts#L768)) never calls `forceContextLoss()`. After 18 look toggles, Chrome warns about too many contexts, and the practice route's `{#key locale}` makes a new context on each language change. Fix: call `renderer.forceContextLoss()` after `dispose()`, and switch to `THREE.PCFShadowMap` (:116).
_Src: domino:code#6._

<a id="b26"></a>**B26. The 3D Dominó tile flight replays on resync, and the 8-bit end banner replays on remount.** Dominó · M.
Table3D passes `pub.last` into the scene ([games/domino/src/three/Table3D.svelte:115](../../games/domino/src/three/Table3D.svelte#L115)), and `update()` flies it whenever it isn't placed yet, with no revision gate. The 8-bit banner `$effect` ([games/domino/src/pixel/PixelTable.svelte:106](../../games/domino/src/pixel/PixelTable.svelte#L106)) is ungated too. Fix: mirror the 8-bit flow, which feeds the scene through `g.on()` → `react()` → a pending map. Fire the banner from a gated `end` event.
_Src: domino:code#7._

<a id="b27"></a>**B27. Another seat's "Tidy up" or team rename can void your in-flight Dominó play.** Dominó · S.
ARRANGE and RENAME_TEAM bump the revision at any time, Dominó doesn't retry stale intentions ([apps/web/src/lib/action-retry.ts:116](../../apps/web/src/lib/action-retry.ts#L116)), and `act()` has already cleared your selection ([games/domino/src/game.svelte.ts:286](../../games/domino/src/game.svelte.ts#L286)). Fix: keep `selected` and `chosenEnd` on send. The existing effect already clears them when the turn moves on, so a cosmetic bump costs one re-press.
_Src: domino:code#10._

<a id="b28"></a>**B28. Dead practice rooms hold one of the 64 room slots for an hour.** Server · S.
After the grace period, the human's token is blanked ([apps/server/src/rooms.ts:296](../../apps/server/src/rooms.ts#L296)), so nobody can rejoin. `sweep()` keeps the room until it is an hour old (:352). Fix: delete practice rooms with no connected or reserved human seat.
_Src: server:code#6._

<a id="b29"></a>**B29. An expiry triggered by a failed join is never published.** Server · S.
`join()` calls `expire(room)` before validating ([apps/server/src/rooms.ts:161](../../apps/server/src/rooms.ts#L161)). If the join then fails, nothing publishes, and the next sweep finds no change, so peers keep a stale roster and revision. Fix: remove that call and let the one-second sweep be the only expirer.
_Src: server:code#8._

<a id="b30"></a>**B30. The server acks before it publishes, so `pending` clears while the old view is still shown.** Server · S.
`handle()` replies before `publish()` ([apps/server/src/socket.ts:39](../../apps/server/src/socket.ts#L39)). On a slow tunnel a quick second tap goes out with the old revision and shows "Table updated; try again". Fix: publish first, then reply. Do it together with [B3](#b3).
_Src: server:code#9._

<a id="b31"></a>**B31. Jev edge cases: an empty Choice on small boards, and failed turns charged twice.** Jev lab · S.
A board with fewer words than the clue count builds a Choice with no options ([packages/jev-lab/src/codenames/live.ts:192](../../packages/jev-lab/src/codenames/live.ts#L192)). Fix: also slice when `count >= ranked.length`. The page retries every status ≥ 500 ([apps/web/src/routes/practice/codenames/+page.svelte:116](../../apps/web/src/routes/practice/codenames/+page.svelte#L116)), but the server returns 502 for its own plan failures ([apps/server/src/index.ts:105](../../apps/server/src/index.ts#L105)), so each failure costs a second budget slot and Noul call. Fix: use 503 for plan failures, and retry only on a missing response or 502.
_Src: gap6#3, gap6#4._

### Security (all low)

<a id="b32"></a>**B32. The global 12-per-minute create budget is a cheap shared lockout.** Server · S · optional.
`created` is one server-wide counter ([apps/server/src/rooms.ts:61](../../apps/server/src/rooms.ts#L61), :101). Twelve sockets a minute lock everyone out. The old 64-room cap allowed a similar lockout, and the server is tunnel-hosted for friends, so this is optional. If addressed: key the budget per client (trust `cf-connecting-ip` only from a loopback peer), allow about 6 per minute per key, and keep the global cap as a backstop.
_Src: server:code#5._

<a id="b33"></a>**B33. The HTTP origin sends no baseline security headers.** Server · S.
[apps/server/src/index.ts:37](../../apps/server/src/index.ts#L37) sets only `cache-control`. Add `x-content-type-options: nosniff`, `referrer-policy: same-origin` and `content-security-policy: frame-ancestors 'none'` in `setHeaders` and on the 404 and 500 paths. Nothing in the app uses iframes.
_Src: server:code#11._

<a id="b34"></a>**B34. Little Secret clues accept control and bidi characters that guesses reject.** Little Secret · S.
The clue branch ([games/little-secret/src/engine.ts:352](../../games/little-secret/src/engine.ts#L352)) checks only length, while the guess branch (:451) rejects `\p{Cc}\p{Cf}`. A right-to-left override or zero-width character can visually disguise a clue on every seat. Svelte escapes the text, so this is spoofing, not injection. Fix: reuse the guess guard, and store `text.normalize('NFC').trim()`.
_Src: little-secret:code#11._

<a id="b35"></a>**B35. Raw TypeSafe error bodies and server config hints reach the browser.** Jev lab · S.
[packages/jev-lab/src/jev.ts:114](../../packages/jev-lab/src/jev.ts#L114) puts the provider body in the error, :78 names the env var, the server forwards `String(error)` ([apps/server/src/index.ts:104](../../apps/server/src/index.ts#L104)), and the page prints it ([apps/web/src/routes/practice/codenames/+page.svelte:164](../../apps/web/src/routes/practice/codenames/+page.svelte#L164)). The route is opt-in, so the impact is small. Fix: `fail(503, 'Jev failed')` plus `console.error`. On the page, map 429 to a new `cn_jev_budget` key and everything else to `m.cn_jev_error()`.
_Src: gap6#1._

### Trademark and copyright risk

These are low risk for a friends-only tunnel ([docs/deployment.md](../../docs/deployment.md)), but cheap to settle.

<a id="b36"></a>**B36. The 3D Dominó bottle reproduces the Polar Pilsen label and bear.** Dominó · Classic · medium · S.
[apps/web/static/games/domino/beer-label.webp](../../apps/web/static/games/domino/beer-label.webp) reads "POLAR / CERVEZA PILSEN" with the bear emblem, and `beer-neck.webp` is a row of bears. That breaks the project's own rule "No image may contain text, logos" ([docs/games/domino.md:161](../../docs/games/domino.md#L161)), while :49 cites the Polar reference. Ask Oscar which rule wins. To replace it: a `labelCanvas()` in `textures.ts` (cream paper, a blue band with a red pinstripe, a palm roundel, no lettering) and a plain gold neck foil; drop both WebPs from `PROPS` ([games/domino/src/preload.ts:10](../../games/domino/src/preload.ts#L10)). That saves 42 KB and two requests. The 8-bit bottle is a 6×14 sprite with no wordmark and is fine.
_Src: domino:art-classic#1, domino:code#14._

<a id="b37"></a>**B37. The 8-bit Catan win jingle follows the Final Fantasy victory fanfare note for note.** Catan · 8-bit · low · S.
[games/catan/src/pixel/sound.ts:106](../../games/catan/src/pixel/sound.ts#L106) plays C C C A♭ B♭ C B♭ C. Replace it with an original motif, for example `tune([392, 523, 659, 784, 659, 1047], 0.09, 0, 0.06)`.
_Src: catan:art-pixel#10._

<a id="b38"></a>**B38. Several covers and faces copy commercial trade dress, and there is no "not affiliated" line.** UNO, Catan, home · low · S–M · optional.
Classic UNO cards copy the white tilted oval, outlined numerals, the black four-quadrant Wild and the red and yellow "UNO!" ([games/uno/src/Board.svelte:968](../../games/uno/src/Board.svelte#L968), :312, :1179). The Classic UNO box uses the same oval lockup ([apps/web/src/lib/catalog/BoxArt.svelte:297](../../apps/web/src/lib/catalog/BoxArt.svelte#L297)). The 8-bit store box prompts recreate the UNO, Codenames and Sushi Go Party covers ([docs/pixel-store.md:91](../../docs/pixel-store.md#L91)), and Catan cards carry hidden `CATAN` footers ([games/catan/src/Board.svelte:1624](../../games/catan/src/Board.svelte#L1624)). The 8-bit in-game UNO deck is already original ([docs/uno-pixel.md](../../docs/uno-pixel.md)).
Cheapest step: one en/es home footer line, "Fan-made and free; not affiliated with or endorsed by the rights holders. Game names are trademarks of their owners." Then, if wanted: delete the CATAN footers ([R14](#r14)), re-prompt the UNO and Sushi store boxes with a blank title band and real-text titles ([HOME-8.6](#home-8-6)), and give Classic UNO a lozenge motif together with the new card back ([UNO-C3](#uno-c3)). Keep the "Big Box 3.1" guide title, since it names the ruleset.
_Src: uno:art-classic#12, uno:art-pixel#11, home:art-classic#10, home:art-pixel#10, catan:art-classic#13._

## 3. Code removal and simplification

### Removal ledger

Every row was checked with a repo-wide grep (build caches excluded), and dynamic lookups were checked too: `ls_${…}`, `cn_guide_*`, `'carc_' + key`, the `sgp_*` families, and the room error prefixes.

| Id | What | Where | Evidence it's safe | Est. saved |
| --- | --- | --- | --- | --- |
| <a id="r1"></a>R1 | Unused message keys (list below) | [packages/shared/messages/en.json](../../packages/shared/messages/en.json), [es.json](../../packages/shared/messages/es.json) | Zero hits outside the JSON in four independent scans; the build chunk `BMUZOh8S.js` still exports them | ~90 keys, ~180 JSON lines, ~7 KB raw per locale |
| <a id="r2"></a>R2 | 31 chrome keys duplicated under game prefixes ("Close" ×8, "Sound" ×6, "Settings" ×4, "Table settings" ×4, "8-bit" ×4, "Classic", "Motion", "Volume", "Rules", "Cancel" ×3) | same files | Identical en and es pairs; UI chrome only. Keep domain terms per game | 62 lines |
| <a id="r3"></a>R3 | Azul generation-source PNGs | [games/azul/assets/rich/source/](../../games/azul/assets/rich/source/) | Never imported or shipped; only reference is [docs/azul-redesign/tokens.md:20](../../docs/azul-redesign/tokens.md#L20). Do the re-exports in [P6](#p6) and [AZ-C4](#az-c4) first, then move the folder out, as Codenames does | 29.4 MB of the working tree (73% of tracked bytes). History is unchanged unless Oscar rewrites it |
| <a id="r4"></a>R4 | Tracked `.pyc` | [games/catan/art/__pycache__/pixel-art.cpython-312.pyc](../../games/catan/art/__pycache__/pixel-art.cpython-312.pyc), [.gitignore](../../.gitignore) | Build artefact; no `__pycache__` rule. Add `__pycache__/` to `.gitignore` | 10 KB |
| <a id="r5"></a>R5 | Five Codenames prop WebPs and their provenance entries | [games/codenames/src/table/](../../games/codenames/src/table/) (books, coaster, foliage, mug, notepad) | Imports removed in 7bd9576; build ships only `wood` | 334 KB |
| <a id="r6"></a>R6 | Fonts: unused Archivo, duplicate Marcellus, Dominó's own Pixelify `@font-face` | [apps/web/static/fonts/codenames/](../../apps/web/static/fonts/codenames/), [apps/web/static/fonts/carcassonne/marcellus.woff2](../../apps/web/static/fonts/carcassonne/marcellus.woff2), [games/domino/src/Hud.svelte:760](../../games/domino/src/Hud.svelte#L760) | No source references Archivo (its README keeps it as history, so deleting it is optional). The two Marcellus files are md5-identical. The kit `pixel.css` already declares Pixelify | 72 KB deploy (Archivo), one 19 KB download shared, ~20 CSS lines |
| <a id="r7"></a>R7 | Carcassonne gatehouse sprite | [apps/web/static/games/carcassonne/sprites/gatehouse.webp](../../apps/web/static/games/carcassonne/sprites/gatehouse.webp), [games/carcassonne/src/table/sprites.ts:13](../../games/carcassonne/src/table/sprites.ts#L13), [games/carcassonne/src/pixel/sheet.ts:14](../../games/carcassonne/src/pixel/sheet.ts#L14) | `scenery.ts` never emits it and the atlas never draws it. Leave the 8-bit sheet cell in place (no raw sources to repack). Or use it as a town gate in both skins | 29 KB |
| <a id="r8"></a>R8 | Dead exports, a dependency, a package export, four guide wrappers | [games/azul/src/palette.ts:24](../../games/azul/src/palette.ts#L24) `pixelTileOrder`; [games/catan/src/pixel/geometry.ts:63](../../games/catan/src/pixel/geometry.ts#L63) `union`; [packages/game-core/src/index.ts:33](../../packages/game-core/src/index.ts#L33) `RoomId`; [apps/web/package.json:11](../../apps/web/package.json#L11) game-core dep; [games/domino/package.json:10](../../games/domino/package.json#L10) `./layout`; `CodenamesScene.svelte`, `LittleSecretScene.svelte`, `guides/codenames.ts`, `guides/little-secret.ts` | Zero importers. Point [apps/web/src/lib/catalog/Rulebook.svelte:23](../../apps/web/src/lib/catalog/Rulebook.svelte#L23) and `guides/load.ts` at the packages directly. Keep `AzulScene` (it adds `role=img`) | 4 files, ~35 lines |
| <a id="r9"></a>R9 | Azul dead code and dead CSS | [games/azul/src/Board.svelte:14](../../games/azul/src/Board.svelte#L14) `rowIssue`, [games/azul/src/effects.ts:145](../../games/azul/src/effects.ts#L145) dataset writes (old test hooks), [games/azul/src/Tile.svelte:32](../../games/azul/src/Tile.svelte#L32) `--glaze`, unused `ringGeometry` fields, practice exports; CSS `--ring` width (Board :1252), `.factory::before` (:1269/:2384), `.factory-number` (:2401/:2622), `--azul-aged-brass` | Unused. Keep `--azul-soft-ink` (used in PlayerBoard). Remove transparent tokens only with the declarations that read them | ~20 TS lines, a few KB of the 50.9 KB Board CSS |
| <a id="r10"></a>R10 | Sushi Go Party prototype leftovers | [games/sushi-go-party/src/table/data.ts:25](../../games/sushi-go-party/src/table/data.ts#L25) title/rules and unused player fields; PartyBoard `round/pick/totalPicks`; HiddenHand `bundle`; `:not(.rich)` rules ([games/sushi-go-party/src/table/table.css:428](../../games/sushi-go-party/src/table/table.css#L428), Board :1254); `@keyframes reveal` (Board :1808); unset `--x/--y/--short-x/--seat-count/--seat-fraction`; hidden wordmark; `race()` residual branch ([games/sushi-go-party/src/index.ts:318](../../games/sushi-go-party/src/index.ts#L318)); `public.discard` (:824) | `class:rich={true}` is constant; props never passed; no readers. Keep the `.rich` class itself (specificity) | ~100 lines, one wire field |
| <a id="r11"></a>R11 | Dominó dead state and props | [games/domino/src/index.ts:50](../../games/domino/src/index.ts#L50) `passes`; [games/domino/src/Tile.svelte:7](../../games/domino/src/Tile.svelte#L7) `back`; [games/domino/src/three/tile.ts:72](../../games/domino/src/three/tile.ts#L72) `faceDown`; [games/domino/src/three/scene.ts:767](../../games/domino/src/three/scene.ts#L767) returned `invalidate` | Written but never read; no call site passes them | ~25 lines, one wire field |
| <a id="r12"></a>R12 | Little Secret leftovers | [games/little-secret/src/effects.ts:6](../../games/little-secret/src/effects.ts#L6) `clue`/`handoff` cues; four `data-testid`s; `distribution`/`normalize` exports in `engine.ts`; duplicate `answer` reset and unused `version`/`motion` locals ([games/little-secret/src/Board.svelte:192](../../games/little-secret/src/Board.svelte#L192)) | No readers. Keep `ls_deal` for [U55](#u55) | ~20 lines |
| <a id="r13"></a>R13 | Codenames leftovers | [games/codenames/src/Board.svelte:51](../../games/codenames/src/Board.svelte#L51) `locale` and :56 `canConfigure` props (and `{locale}` in the practice route); English seat names in `practice.ts:5`; local Fisher–Yates ([S11](#s11)) | Never read; the route overrides the names | ~20 lines |
| <a id="r14"></a>R14 | Catan leftovers | `CATAN` card-footer spans ([games/catan/src/Board.svelte:1624](../../games/catan/src/Board.svelte#L1624), :1652) and their `display:none` rule; `reserve()` recount (:416) duplicating the server's `inventory`; dead `setLocale`/`Locale` imports in the practice route | Footers never display; the public view already carries `inventory` | ~20 lines |
| <a id="r15"></a>R15 | Socket.IO room membership | [apps/server/src/socket.ts:54](../../apps/server/src/socket.ts#L54), :62 | `publish` targets each socket id; nothing reads room membership. Removing it also prevents a future `io.to(roomId)` from leaking private views | 2 lines |
| <a id="r16"></a>R16 | Unused catalog metadata and stray CSS | `preview`, `practice`, `setupModes` in [packages/shared/src/index.ts](../../packages/shared/src/index.ts); [apps/web/src/app.css:232](../../apps/web/src/app.css#L232) `.join-form`, `.game-art`; kit `.px-panel`/`.px-button` only if [HOME-8.7](#home-8-7) doesn't adopt them | The home hard-codes these choices (`+page.svelte:282`, :298) | ~30 lines |
| <a id="r17"></a>R17 | 166 redundant `({}, { locale })` arguments | Catan Board (119), UNO Board (42), BuildingCosts (3), Carcassonne Board (2) | Every host remounts the board on a locale change; the other four boards already call plain `m.x()` | ~40–60 lines after formatting |
| <a id="r18"></a>R18 | UNO's never-rendered toolbar practice branch | [apps/web/src/routes/room/[id]/+page.svelte:116](../../apps/web/src/routes/room/%5Bid%5D/+page.svelte#L116), :124, :293 | UNO is in `cornerControls`, so the branch never shows. Delete it, or move the label into Settings ([U8](#u8)) | ~15 lines |
| <a id="r19"></a>R19 | Per-game READMEs | `games/{azul,catan,codenames,sushi-go-party,uno}/README.md` | Stale copies of `docs/games/*.md` (cite missing files, Archivo, tests). Move any unique fact (Catan `create` options) first, and fix the inbound link in `docs/codenames-redesign/migration.md:63` | 99 lines |
| <a id="r20"></a>R20 | Finished redesign handoffs and an orphaned benchmark doc | [docs/azul-redesign/](../../docs/azul-redesign/), [docs/codenames-redesign/](../../docs/codenames-redesign/), [docs/sushi-go-party-redesign.md](../../docs/sushi-go-party-redesign.md), [docs/bot-benchmark-comparison.md](../../docs/bot-benchmark-comparison.md) | ADRs 017, 019, 020 and 021 hold the decisions; move binding contracts into each game's Invariants first. Nothing links the benchmark doc, and `docs/jev/working-with-jev.md` supersedes it. Drop links in [AGENTS.md](../../AGENTS.md) and the game docs; leave ADR links as history | ~1.1 MB, ~2,300 lines |
| <a id="r21"></a>R21 | Jev lab indirection | [packages/jev-lab/src/codenames/prompts.ts:28](../../packages/jev-lab/src/codenames/prompts.ts#L28) `Prompt.state`; unreachable `maxQuestions` ([live.ts:129](../../packages/jev-lab/src/codenames/live.ts#L129)); one-entry `Situation` framework (:41); `prompts.v2!`, which keeps v1 in the server bundle; exported `model`/`Answer` | Dead hooks; `parseView` already bounds the view | ~30 lines; v1 prompts leave `dist` |

R1 key list, by family. Rerun one scan over the union before deleting, because the per-game scans overlap.
- Shell: `title`, `subtitle`, `connecting`, `leave`, `pending`; `library_{optional,points,feature,field,monastery}`.
- UNO: `uno_practice`, `learn_uno_{setup,actions,penalties,declaration,ending}_title`.
- Catan: `catan_{choose_location,hex,development_cards,no_cards,offer_to_players,recipient,locations,offer_to}`. Reword `catan_island_description`, which still says "location buttons below".
- Carcassonne: 28 `carc_*` (`confirmed`, sixteen `*_hint`, `farmer_warning`, `help_text`, `legal_space`, `next`, `no_events`, `place_title`, `preview`, `seat`, `strength`, `supply`, `value_now`), plus 12 `learn_carcassonne_*_title` and `*_chapter_title` keys.
- Azul: `azul_{search,chapters,no_results,sources}`. Codenames: `cn_{search,voice,voice_turns,nav_play,nav_how}`. Sushi: `sgp_round_label`. Little Secret: `ls_{search,eliminated,elimination,guess,table_waiting_clue}`.
- The remaining old `learn_*_<chapter>_title` keys superseded by `*_chapter_title`; `domino_look*` once [S1](#s1) lands.

_Src: uno:code#7, catan:code#11, catan:code#12, carcassonne:code#11, carcassonne:art-classic#11, carcassonne:art-pixel#13, azul:code#7, azul:code#12, azul:code#13, azul:art-pixel#13, azul:art-classic#13, codenames:code#5, codenames:code#13, codenames:art-classic#13, sushi-go-party:code#7, sushi-go-party:code#13, sushi-go-party:art-classic#13, little-secret:code#13, domino:code#13, server:code#12, web-shell:code#12, cross-game:removal#2, #4, #5, #6, #11, #12, #13, #15, #17, perf:bundle#10, catan:art-classic#13, catan:art-pixel#12, uno:code#4, gap6#6, gap6#8, home:art-classic#12._

Not worth removing: the five spare Sushi sprite cells. `geta` and `mat` sit mid-sheet, and dropping their names shifts later cells. Either reuse them as decor or leave them ([SGP-8.8](#sgp-8-8)). The Dominó 3D path loads the 8-bit sprite module, but splitting it saves only about 1.4 KB gzip; do it only while editing `sprites.ts` (domino:code#15).

### Docs that contradict the code

| Id | What | Where | Fix |
| --- | --- | --- | --- |
| <a id="d1"></a>D1 | Docs still describe tests, "evidence" folders and browser suites that the no-tests policy removed | [docs/rules.md:51](../../docs/rules.md#L51); [docs/games/catan.md:4](../../docs/games/catan.md#L4), :20; [docs/games/carcassonne.md:108](../../docs/games/carcassonne.md#L108), :121, :180, :183; [docs/games/azul.md:65](../../docs/games/azul.md#L65); [docs/azul-redesign/mobile.md:15](../../docs/azul-redesign/mobile.md#L15); [docs/games/sushi-go-party.md:138](../../docs/games/sushi-go-party.md#L138); [docs/games/little-secret.md:84](../../docs/games/little-secret.md#L84); [docs/adr/023-little-secret-table.md:41](../../docs/adr/023-little-secret-table.md#L41); [docs/games/library-guide-coverage.md:58](../../docs/games/library-guide-coverage.md#L58) | Say "validated with `bun run check` and `bun run build`". Drop test, evidence and planning-record wording; rename "Architecture and evidence" to "Architecture" |
| <a id="d2"></a>D2 | Feature claims that are no longer true | UNO: "hand scrolls horizontally" and "Play solo" ([games/uno/README.md:12](../../games/uno/README.md#L12)), "versioned shuffle" ([docs/rules.md:12](../../docs/rules.md#L12)). Catan: "Legal locations" and Language in Settings ([docs/games/catan.md:26](../../docs/games/catan.md#L26), :33). Carcassonne: Settings "history" and "no pitched oscillators" (carcassonne.md:46, :97), "Classic players never download any of it" ([docs/carcassonne-pixel.md:7](../../docs/carcassonne-pixel.md#L7)). Codenames: Archivo, props, key preference and "no new cues" ([docs/games/codenames.md:50](../../docs/games/codenames.md#L50)–65, [games/codenames/src/table/README.md:12](../../games/codenames/src/table/README.md#L12)). Little Secret "three-column" ([docs/games/little-secret.md:76](../../docs/games/little-secret.md#L76)). Dominó "8-bit art is about 150 KB" (actually about 235 KB) and the architecture row missing the 8-bit table. Azul "original CSS/SVG artwork" (azul.md:3) and the dead evidence link ([docs/azul-redesign/images/README.md:3](../../docs/azul-redesign/images/README.md#L3)). Sushi "archived prototype" ([docs/architecture.md:150](../../docs/architecture.md#L150), ADR 021) | Correct each sentence to what ships |
| <a id="d3"></a>D3 | Guide coverage doc omits two games and cites deleted scripts | [docs/games/library-guide-coverage.md](../../docs/games/library-guide-coverage.md) lines 3, 5–40, 46, 58–64 | Add Dominó and Little Secret rows, drop "Verification mapping" and the lesson count, and soften line 3 until [B17](#b17) lands |
| <a id="d4"></a>D4 | Jev doc drift | [docs/jev/working-with-jev.md:17](../../docs/jev/working-with-jev.md#L17) (no `--repeat`), :131 (stale spend), :157 (build-the-bot section predates `live.ts`) | Add `--repeat <n>`. Replace the spend sentence with "see LOG.md". Say `live.ts plan()` is the shipped operative |

_Src: uno:code#6, catan:code#11, carcassonne:code#12, azul:code#14, codenames:code#7, sushi-go-party:code#14, little-secret:code#15, domino:code#14, cross-game:removal#14, gap3#11, gap6#7._

### Shared-helper consolidations

<a id="s1"></a>**S1. One skin switch for all eight boards.** M · about −110 lines net.
Seven boards repeat the same skin `$state`, lazy `pixel.css` loader, `pixel = skin === 'pixel' && pixelReady` and a 12–16 line radio fieldset ([games/uno/src/Board.svelte:58](../../games/uno/src/Board.svelte#L58), [games/azul/src/Board.svelte:100](../../games/azul/src/Board.svelte#L100), [games/carcassonne/src/Board.svelte:115](../../games/carcassonne/src/Board.svelte#L115), [games/catan/src/Board.svelte:78](../../games/catan/src/Board.svelte#L78), [games/codenames/src/Board.svelte:153](../../games/codenames/src/Board.svelte#L153), [games/little-secret/src/Board.svelte:85](../../games/little-secret/src/Board.svelte#L85), [games/sushi-go-party/src/Board.svelte:137](../../games/sushi-go-party/src/Board.svelte#L137)). Dominó re-implements `gameSkin()` in [games/domino/src/look.ts:6](../../games/domino/src/look.ts#L6) and has its own `domino_look*` labels.
Add a shared `pixelSkin(game, load)` rune that returns the persisted `skin`, the `pixel` flag and the loaded pack, plus a `SkinChoice.svelte` that styles its own legend (boards recolour it through CSS custom properties). Expose `skin` as well as `pixel`, because [P2](#p2) needs to gate Classic art on the intended skin. For Dominó, keep `lookOf()` as a one-line wrapper over `gameSkin('domino')` and read the old `domino:look` key once to migrate. Then switch to `m.skin()`, `skin_classic()` and `skin_pixel()`, and delete the three `domino_look*` keys and `cn_skin*`.
_Src: cross-game:removal#3, domino:code#11._

<a id="s2"></a>**S2. Use the shared `modal()` attachment everywhere.** S · about −60 lines.
Codenames, Little Secret, Sushi and the home page hand-roll the opener, `showModal`, close and focus return ([games/codenames/src/Board.svelte:190](../../games/codenames/src/Board.svelte#L190), [games/little-secret/src/Board.svelte:180](../../games/little-secret/src/Board.svelte#L180), [games/sushi-go-party/src/Board.svelte:232](../../games/sushi-go-party/src/Board.svelte#L232), [apps/web/src/routes/+page.svelte:97](../../apps/web/src/routes/+page.svelte#L97)), and Catan opens its rules dialog by hand (:753). Azul keeps its last dialog content mounted while closed ([P19](#p19)).
Use a stable derived boolean, `const dialogOpen = $derived(panel !== null)` with `{@attach modal(() => dialogOpen)}`. Writing `modal(() => panel !== null)` directly re-runs the attachment when Codenames switches panels while open. Move the cleanup into `onclose`. Keep Azul's factory picker as it is. Fix the home's rules-recovery focus target, which doesn't exist in the 8-bit store.
_Src: cross-game:removal#7, sushi-go-party:code#6, little-secret:code#14, web-shell:code#13, home:art-classic#12, azul:code#8._

<a id="s3"></a>**S3. One presentation gate per board.** M.
UNO hand-rolls two baselines and four `revision + 1` checks ([games/uno/src/motion.ts:131](../../games/uno/src/motion.ts#L131), [games/uno/src/Board.svelte:224](../../games/uno/src/Board.svelte#L224), [games/uno/src/presentation.ts:32](../../games/uno/src/presentation.ts#L32)). Sushi keeps a local `EventCursor` that re-baselines on the stale post-reconnect view ([games/sushi-go-party/src/presentation.ts:80](../../games/sushi-go-party/src/presentation.ts#L80)). Carcassonne's local `EventGate` has the reconnect bug in [B11](#b11), and the 3D Dominó scene is ungated ([B26](#b26)).
For UNO, use one `RevisionGate` plus one remembered `before` view, and keep the `document.hidden` guard and geometry capture (RevisionGate keeps its own snapshot, so pass the remembered view explicitly). For Sushi, gate the whole presentation object: `gate.consume(`${round}:${playerId}`, p.sequence, [p], connected, p)`.
_Src: uno:code#11, sushi-go-party:code#5._

<a id="s4"></a>**S4. A shared chiptune voice, which also fixes Carcassonne's cues playing after mute.** M · about −80 lines net.
The same `note()` wrapper appears in seven 8-bit sound packs (azul :12, carc :65, catan :7, domino :6, ls :19, sgp :20, uno :19), and melody-plus-bass `tune()` in five. Carcassonne keeps its own ZzFX table and cache ([games/carcassonne/src/pixel/sound.ts:5](../../games/carcassonne/src/pixel/sound.ts#L5)), and its delayed `setTimeout(run)` never re-checks `muted` and is never cleared.
Add `chipVoice(audio, gain)` to [packages/shared/src/ui/pixel/zzfx.ts](../../packages/shared/src/ui/pixel/zzfx.ts), returning `note()` and `tune(notes, step, {delay, volume, bass})` on a cancellable timer set, as Azul does today. Let `playChiptune` accept a raw parameter array.
_Src: cross-game:removal#8._

<a id="s5"></a>**S5. One AudioContext per board.** S · optional.
Sushi and Carcassonne create one context for the Classic pack and another for the 8-bit pack ([games/sushi-go-party/src/Board.svelte:134](../../games/sushi-go-party/src/Board.svelte#L134)). Have `pixelSounds()` and `pixelAudio()` accept the Classic pack's audio, as UNO and Little Secret already do. Skip a generic tone-cue helper; the saving is marginal.
_Src: cross-game:removal#9._

<a id="s6"></a>**S6. One practice-route shell and one language switch.** M · about −120 to −150 lines.
The seven practice routes total 1,250 lines. They repeat the Board loader, error alert, `changeLocale()`, the EN/ES select, header hiding and about 20 lines of CSS. The language paths differ: the Carcassonne route ([apps/web/src/routes/practice/carcassonne/+page.svelte:103](../../apps/web/src/routes/practice/carcassonne/+page.svelte#L103)) and the in-board Catan select ([games/catan/src/Board.svelte:769](../../games/catan/src/Board.svelte#L769)) call `setLocale()` with the default reload. Verified: switching language mid-practice reloads the page five times and drops the scenario; in a room it forces a reconnect. The Azul and Dominó titles ignore the locale, and none of the routes updates `<html lang>`.
Start with `$lib/locale.ts` `changeLocale(next)` (`setLocale(next, { reload: false })` plus `documentElement.lang`), and use it everywhere, with `{#key locale}` in Carcassonne and an `onLocale` prop for Catan. Then add `$lib/practice/PracticeShell.svelte`, which owns the alert, locale, select, header hiding and shell CSS, with a `controls` snippet for each route's pickers. Import the Board statically ([P12](#p12)).
_Src: web-shell:code#5, cross-game:removal#10, gap4#5._

<a id="s7"></a>**S7. Have the room `send()` report success.** S.
Return `true` or `false` from the room `send()` ([apps/web/src/lib/session.svelte.ts:120](../../apps/web/src/lib/session.svelte.ts#L120)); practice returns `undefined`, which counts as success. Boards then play success cues and close dialogs only when the action was accepted. This fixes [B19](#b19).
_Src: codenames:code#4, little-secret:code#9._

<a id="s8"></a>**S8. Server error codes with one client mapping.** M.
The server throws English sentences ("Room not found", "Room is full", "Too many new rooms", "Reconnect token expired or invalid", "Wait for every seat to connect", [apps/server/src/rooms.ts:69](../../apps/server/src/rooms.ts#L69), :100, :166, :183, :208). Catan and Carcassonne rules throw English too ([games/catan/src/index.ts:92](../../games/catan/src/index.ts#L92), :493, :510; [games/carcassonne/src/index.ts:91](../../games/carcassonne/src/index.ts#L91)). The room page translates only `azul_`/`cn_`/`sgp_`/`ls_` keys through a dynamic lookup ([apps/web/src/routes/room/[id]/+page.svelte:70](../../apps/web/src/routes/room/%5Bid%5D/+page.svelte#L70)), and the home page prints `session.error` raw ([apps/web/src/routes/+page.svelte:290](../../apps/web/src/routes/+page.svelte#L290)).
Extend `ReplyErrorCode` ([packages/shared/src/index.ts:85](../../packages/shared/src/index.ts#L85)) with `ROOM_NOT_FOUND`, `ROOM_FULL`, `RATE_LIMITED`, `TOKEN_EXPIRED`, `NOT_CONNECTED`, `HOST_ONLY`, `SEATS_OFFLINE`. Have Catan throw `catan_err_*` keys and Carcassonne `carc_error*` keys. Map them all in one `errorText(code, fallback)` with an explicit `Record` of message functions. That map also removes the dynamic `m[key]` lookup behind [P1](#p1). Localize the English `'Player'` fallback name and the practice load errors.
_Src: web-shell:code#9, catan:code#8, carcassonne:code#13, gap2#2, cross-game:removal#1._

<a id="s9"></a>**S9. Lift Carcassonne's `PixelIcon` into the shared kit.** M.
Catan's 8-bit chrome falls back to system and emoji glyphs (← ▤ ◎ ⚙ 🏛 ♣ ☁ ▧ ★, because Jersey 10 is subset to Latin-1), Codenames draws smooth round-cap vector icons in the pixel HUD, and Carcassonne's 8-bit guide and setup use chess glyphs. Carcassonne already has string-grid bitmaps rendered as `crispEdges` rects ([games/carcassonne/src/pixel/PixelIcon.svelte](../../games/carcassonne/src/pixel/PixelIcon.svelte)). Move it to `packages/shared/src/ui/pixel/`, accept a grid map, and add back-arrow, book, gear, globe, bank, trade, star, sparkle, agents, eye, history, check and close grids. Used by [CAT-8.5](#cat-8-5), [CN-8.11](#cn-8-11) and [CAR-8.2](#car-8-2).
_Src: catan:art-pixel#7, codenames:art-pixel#10, carcassonne:art-pixel#2._

<a id="s10"></a>**S10. One hit-button layer for both Dominó looks.** M · about −70 lines.
`place()`, the ghost buttons with pointer capture and Enter/Space charge, the rack hit buttons and their CSS are copied between [games/domino/src/three/Table3D.svelte:164](../../games/domino/src/three/Table3D.svelte#L164) and [games/domino/src/pixel/PixelTable.svelte:118](../../games/domino/src/pixel/PixelTable.svelte#L118). Extract `Hits.svelte({game, rects, showRack})`, so the playable and `aria-disabled` work in [U59](#u59) lands in one place.
_Src: domino:code#12._

<a id="s11"></a>**S11. Use game-core's `shuffled` and `seeded`.** S · about −20 lines.
Codenames has its own copy of `shuffled` ([games/codenames/src/index.ts:19](../../games/codenames/src/index.ts#L19)), and Sushi practice has its own mulberry32 ([games/sushi-go-party/src/practice.ts:13](../../games/sushi-go-party/src/practice.ts#L13)). Both deal identically with the shared versions ([packages/game-core/src/random.ts](../../packages/game-core/src/random.ts)).
_Src: codenames:code#12, sushi-go-party:code#6._

<a id="s12"></a>**S12. Dominó should use its own `spots.ts` and the kit's pixel tokens.** S · about −90 lines.
`Tile.svelte` has its own pip table, with the 6 transposed against the table art ([DOM-C4](#dom-c4)). The guide scene and BoxArt copy it again. Hud and Loading re-declare the Pixelify font and the `--px-*` palette. Import `SPOTS` in Tile and DominoScene (BoxArt is eager catalog metadata and can keep its copy), and import the kit's `pixel.css`.
_Src: domino:code#5, cross-game:removal#6._

<a id="s13"></a>**S13. Use the shared storage `read()`/`write()`.** S.
Raw try/catch `localStorage` appears at [apps/web/src/routes/+page.svelte:60](../../apps/web/src/routes/+page.svelte#L60), :129, [apps/web/src/routes/room/[id]/+page.svelte:47](../../apps/web/src/routes/room/%5Bid%5D/+page.svelte#L47) and [apps/web/src/lib/theme.svelte.ts:12](../../apps/web/src/lib/theme.svelte.ts#L12).
_Src: web-shell:code#13, home:art-pixel#13._

<a id="s14"></a>**S14. Type the socket event names.** S.
Export `type ClientEvent = 'create' | 'join' | 'start' | 'sync' | 'action'` (plus `leave` from [B6](#b6)) and use it in `handle()` ([apps/server/src/socket.ts:22](../../apps/server/src/socket.ts#L22)) and `request()` ([apps/web/src/lib/session.svelte.ts:42](../../apps/web/src/lib/session.svelte.ts#L42)). A misspelled event then fails `bun run check` instead of hanging for 10 s. Leave payload typing alone; the games validate payloads.
_Src: server:code#13._

<a id="s15"></a>**S15. A `refocus()` attachment next to `modal()`.** M.
After a commit, focus falls to `<body>` in Sushi, Little Secret, Codenames, Carcassonne, Azul compact and the Dominó rename. Add `refocus(selector)` to `packages/shared/src/ui`. After `tick()`, it focuses the first enabled control in the new action area, only when focus was really lost, with `preventScroll`, and falls back to a `tabindex=-1` status line. List it in [docs/workflow.md](../../docs/workflow.md). Details in [U66](#u66).
_Src: gap5#4._

<a id="s16"></a>**S16. Small Jev cleanups.** S · optional.
Export `combinations()` once ([packages/jev-lab/src/codenames/live.ts:133](../../packages/jev-lab/src/codenames/live.ts#L133) and guessers.ts:65). Move request parsing into one `parseRequest()` that rebuilds the score from 0–9 integers, so the server stops forwarding the raw object ([apps/server/src/index.ts:84](../../apps/server/src/index.ts#L84)). Build the page's public view from `game.view(actor).public` instead of hand-filtering `game.state`. Keep the lab's own set arm; for counts 1–4 it plays the same as live "normal".
_Src: gap6#5, gap6#9._

<a id="s17"></a>**S17. Shared Python pixel-art helpers.** S · optional.
`quantize()` and `key()` are copied between [games/azul/scripts/pixel-art.py:20](../../games/azul/scripts/pixel-art.py#L20) and [games/catan/art/pixel-art.py:19](../../games/catan/art/pixel-art.py#L19), with variants in `docs/domino-pixel/pixelate.py` and `docs/uno-pixel/cards.py`. A `scripts/art/pixelate.py` saves about 50 lines. These are offline tools tuned per art set, so this is low priority.
_Src: cross-game:removal#16._

## 4. Performance

<a id="p1"></a>**P1. Dynamic `m[key]` lookups pull every message, in both locales, into the room route and three practice routes.** High · S for step 1, M for step 2.
Any namespace-wide lookup on `m` defeats Paraglide's tree-shaking. The room page's `errorText()` does it ([apps/web/src/routes/room/[id]/+page.svelte:77](../../apps/web/src/routes/room/%5Bid%5D/+page.svelte#L77)), so `nodes/10` statically imports `chunks/BMUZOh8S.js` (182.6 KB, the whole catalog) and 37 more message chunks: about 355 KB raw and 96 KB brotli. The room closure is 513 KB raw against 94–144 KB for the other practice routes. Carcassonne's `label('carc_' + k)` ([games/carcassonne/src/labels.ts:5](../../games/carcassonne/src/labels.ts#L5)), Sushi's `t('sgp_' + k)`, Little Secret's `m[`ls_${x}`]` and the Sushi guide do the same.
Step 1 is one file: replace the lookup with an explicit map of the eight server codes (`azul_error`, `cn_error`, `ls_error`, `sgp_disconnected`, `sgp_invalid`, `sgp_menu_invalid`, `sgp_stale`, `sgp_wait`), or the full code map from [S8](#s8). UNO, Catan, Azul, Codenames and Dominó rooms then drop about 96 KB brotli. Step 2: typed `Record` maps in Little Secret (Board, SideSheet, Outcome, guide, practice), Carcassonne `labels.ts` and its 34 dynamic `t()` keys, and Sushi `labels.ts`. Check with `bun run build` that `nodes/10` no longer imports `_index`.
_Src: perf:bundle#1, cross-game:removal#1._

<a id="p2"></a>**P2. 8-bit players download the Classic art first, and see a frame of the Classic table.** High · M.
Every board computes `pixel = skin === 'pixel' && pixelReady`, so Classic markup renders until `pixel.css` arrives ([games/azul/src/Board.svelte:113](../../games/azul/src/Board.svelte#L113), [games/catan/src/Board.svelte:78](../../games/catan/src/Board.svelte#L78), [games/little-secret/src/Board.svelte:85](../../games/little-secret/src/Board.svelte#L85), [games/codenames/src/Board.svelte:153](../../games/codenames/src/Board.svelte#L153)). Measured with the 8-bit skin saved:
- Azul fetched all 15 `/games/azul/rich/*.webp` files (1.41 MB, including `tabletop-v2` at 415 KB), against 36 KB of 8-bit art.
- Catan fetched `tabletop-ocean` (363 KB) plus the painted and resource art (about 250 KB).
- Carcassonne fetched `table.webp` (289 KB), Codenames `wood.webp` (183 KB), and Little Secret `table.webp`, `paper.webp` and `kalam.woff2` (225 KB).

Fix: gate Classic asset URLs on the intended skin (`skin !== 'pixel'`), not on `pixel`. Pass a second context getter for Tile and PlayerBoard. While `skin === 'pixel' && !pixelReady`, render a plain dark placeholder instead of the table, so neither Classic `<img>`s nor CSS `url()` backgrounds resolve. Optionally start `import('./pixel.css')` at module evaluation when the saved skin is 8-bit. Add `.catch(() => (skin = 'classic'))` so a failed chunk still gives a playable table. In Azul, move the `.surface` scroll listener from `onMount` to an `onscroll` attribute so it still attaches after the deferred render.
_Src: perf:bundle#2, catan:code#5, azul:art-pixel#4, little-secret:art-pixel#10._

<a id="p3"></a>**P3. 8-bit Catan re-rasterizes the whole island on every snapshot.** High · S.
`pixelIsland` ([games/catan/src/Board.svelte:510](../../games/catan/src/Board.svelte#L510)) runs about 210 `polygonPixels` calls, and it depends on `board = $derived(pub.board)`, which is a fresh clone on every view (`index.ts:749`), presence updates included. Measured: 79 ms on the base board and 128 ms on the 5–6 player board in Bun. In Chrome, a bank-trade click took 108–117 ms to the next frame in 8-bit and 5–11 ms in Classic.
Fix: the topology is fixed per board size, so cache the island at module level, keyed by `board.hexes.length`, as `roadCache` already is (:532). Reusing the same strings also lets Svelte skip patching 365–580 KB of path data.
_Src: catan:code#1._

<a id="p4"></a>**P4. Carcassonne computes and ships the full feature graph in every player's view.** Medium · S.
`playerView` runs `clone(graph(s))` once per recipient ([games/carcassonne/src/index.ts:1001](../../games/carcassonne/src/index.ts#L1001)). In a re-run 6-player Big Box game, the final view was 141.5 KB, of which features were 80 KB, and six views took 79 ms per broadcast. `graph()` needs only the board, figures and magic, all of which are already in the view.
Fix: drop `features` from the view, and in Board use `const features = $derived(graph(p))` for `overview.ts` and the rising-city effect. As a stopgap, compute the graph once per broadcast with a `WeakMap<State, Feature[]>` and drop the extra clone.
_Src: carcassonne:code#4._

<a id="p5"></a>**P5. Table backgrounds are encoded at very high quality.** Medium · S.
The biggest images are `tabletop-v2.webp` (1682×935, 415 KB), Carcassonne `table.webp` (295 KB), Azul `board-blank-v3.webp` (203 KB) and `meadow.webp` (278 KB) in [apps/web/static/games/](../../apps/web/static/games/). Re-encoded from the committed source PNG with `cwebp -q 78 -m 6 -sharp_yuv`, `tabletop-v2` went from 405 KB to 180 KB at 35.7 dB. Keep the file names, and compare by eye at 1440 px. Leave pixel art lossless.
_Src: perf:bundle#3._

<a id="p6"></a>**P6. Azul ships art far larger than it is drawn, and phones fetch props they hide.** Medium · S.
The five tile WebPs are 320×320 for cells of 50 px or less, `factory-plate` is 420² drawn at 126 px, and `score-rail` is 2076 wide drawn at 760 ([games/azul/src/palette.ts](../../games/azul/src/palette.ts), [games/azul/src/PlayerBoard.svelte:82](../../games/azul/src/PlayerBoard.svelte#L82)). At 390 px the lantern, chest and tea props are `display:none` but still fetched (273 KB), because `phone` starts `false` and is set only on mount ([games/azul/src/Board.svelte:91](../../games/azul/src/Board.svelte#L91)).
Fix: re-export tiles at about 160 px (factory tiles are about 45 CSS px, so 90–135 device px at DPR 2–3), the plate at 256², and the rail at about 1600 wide, from the source PNGs. Add `loading="lazy"` to the props, or initialise `phone` synchronously from `matchMedia` (safe because `ssr = false`).
_Src: perf:bundle#4, azul:code#5, azul:art-classic#13._

<a id="p7"></a>**P7. Carcassonne's small meadow sprites ship at 320 px for props drawn at about 31 CSS px.** Low · S.
`sheep-a/b`, `bush` and `haystack` are drawn 7–9 tile units wide, and the wheat and vineyard decals 26 units ([games/carcassonne/src/table/sprites.ts](../../games/carcassonne/src/table/sprites.ts), [games/carcassonne/src/table/scenery.ts](../../games/carcassonne/src/table/scenery.ts)). A test re-encode at a 128 px long side (props) and about 200 px (decals), WebP q82, took the six files from 255 KB to 85 KB with the same names. Record per-sprite max sides for `key-sprites.py` in [docs/carcassonne-3d/README.md](../../docs/carcassonne-3d/README.md).
_Src: carcassonne:code#10, carcassonne:art-classic#11._

<a id="p8"></a>**P8. Unhashed `/games` and `/fonts` art is re-downloaded after every deploy, and HTML has no explicit `no-cache`.** Medium · S.
`setHeaders` caches only `/_app/immutable/` ([apps/server/src/index.ts:37](../../apps/server/src/index.ts#L37)). ETags are size plus mtime, and every build copies the static folder, so all 138 WebPs (5.8 MB) and 403 KB of fonts revalidate as changed. `200.html` gets heuristic caching, and an old cached shell can then point at deleted chunks.
Fix: `no-cache` on HTML and `/_app/version.json` (free with `dev: true` in [B1](#b1)). For `/games` and `/fonts`, compute content-hash ETags once at startup, so a rebuild returns 304. Don't add a long `max-age`: the names aren't versioned, so updated art would go stale. Longer term, import table art through Vite `?url`, as Catan already does, to get hashed immutable names. Codenames covers are a good first case: they load only at reveal time, so the first drop can land as a flat colour. Import the 7 covers through Vite and warm them with `requestIdleCallback`.
_Src: perf:bundle#5, server:code#7, codenames:art-classic#12._

<a id="p9"></a>**P9. The home page ships socket.io and the Rulebook before first paint, and opens a socket for every visitor.** Medium · S.
[apps/web/src/routes/+page.svelte:6](../../apps/web/src/routes/+page.svelte#L6) imports the session module (47 KB, 13.4 KB brotli of engine.io), and `onMount` calls `connect()`. `Rulebook` is imported eagerly (:9) though it renders only in the rules dialog.
Fix: render the Rulebook through `{#await import(...)}` in the `panel === 'rules'` branch. Make `connect()` lazy-import `socket.io-client` and call it when the Start or Join dialog opens (or on pointer-enter or focus of those buttons). Start and Join already wait for `session.connected`. That saves about 20 KB gzip, roughly 27% of home JS.
_Src: web-shell:code#7, perf:bundle#11._

<a id="p10"></a>**P10. The 8-bit home preloads 240 KB of walk and carry sprite strips, though the keeper starts idle.** Medium · S.
[apps/web/src/lib/home/PixelStore.svelte:158](../../apps/web/src/lib/home/PixelStore.svelte#L158) preloads both strips. The first selection skips the errand, and reduced motion never uses them. Measured critical bytes: 835 KB for the 8-bit home against 81 KB for Classic. Fix: drop the preloads, and warm the strips on the first pointer or focus in `.grid` or at idle, skipping them under reduced motion.
_Src: perf:bundle#6._

<a id="p11"></a>**P11. Table art and display fonts are found 3–7 request waves late.** Low · M.
At 150 ms RTT on Azul, the Board CSS starts at about 970 ms and `tabletop-v2` and the fonts at about 1,340 ms. `200.html` preloads no fonts, and only Dominó has a `preload()` ([apps/web/src/lib/games.ts:11](../../apps/web/src/lib/games.ts#L11)). Fix: give each game a small preload module that adds `<link rel=preload>` for its table background (chosen by the stored skin, after [P2](#p2)) and its display font when `gameClients[id]()` runs. That saves about 1–2 RTTs off table LCP.
_Src: perf:bundle#7._

<a id="p12"></a>**P12. Four practice routes load the Board in `onMount`, which adds a request wave and a blank screen.** Low · S.
Azul, Carcassonne, Catan and Dominó practice routes import through `gameClients` in `onMount` ([apps/web/src/routes/practice/azul/+page.svelte:38](../../apps/web/src/routes/practice/azul/+page.svelte#L38)), and Azul and Carcassonne render nothing meanwhile. The route chunk is already the lazy boundary, so import the Board statically as Codenames, Little Secret and Sushi do. For Dominó, call `preload()` at module top. Keep `gameClients` for `/room`. Fold into [S6](#s6).
_Src: web-shell:code#6._

<a id="p13"></a>**P13. Per-element CSS filters on large lists, against [docs/workflow.md:25](../../docs/workflow.md#L25).** Low–medium · S–M per game.
At the start of a 1440×900 table:

| Game | Filtered elements | Where | Replacement |
| --- | --- | --- | --- |
| Azul | 92 (68% of viewport) | drop-shadow on every tile ([games/azul/src/Tile.svelte:63](../../games/azul/src/Tile.svelte#L63)), grayscale/saturate/contrast on 25 empty wall cells per board (:90), filters on the board ([games/azul/src/PlayerBoard.svelte:633](../../games/azul/src/PlayerBoard.svelte#L633)), plates, props, bag and rails | Bake a contact shadow into the tile WebPs (same pass as [P6](#p6)); ghost cells by opacity only; a `::after` shadow on the board; bake plate and prop shadows in one PIL pass |
| Catan | 52 | 18 number tokens, 16 resource art, 9 harbors, and a drop-shadow over the whole board SVG ([games/catan/src/Board.svelte:2180](../../games/catan/src/Board.svelte#L2180)), plus inline per-building shadows (:1365) | Offset darker duplicate shapes inside the SVG (`.road-side` already works this way); drop the full-board filter |
| Sushi Go Party | 42 | `.food-art` drop-shadow ([games/sushi-go-party/src/table/FoodArt.svelte:356](../../games/sushi-go-party/src/table/FoodArt.svelte#L356)), `.pawn` ([games/sushi-go-party/src/table/ScorePawn.svelte:80](../../games/sushi-go-party/src/table/ScorePawn.svelte#L80)), double drop-shadow on the 840×490 board ([games/sushi-go-party/src/table/PartyBoard.svelte:58](../../games/sushi-go-party/src/table/PartyBoard.svelte#L58)); six gradients per dish instance (122 elements) | Remove the food and pawn filters (the art already draws ground ellipses); define the gradients once in a hidden `<svg width=0 height=0>` (not `display:none`); a shifted rim path for the board |
| Little Secret | up to ~42 at 9 seats | drop-shadow on every Paper ([games/little-secret/src/table/Paper.svelte:28](../../games/little-secret/src/table/Paper.svelte#L28)) and brightness on its `::before` (:64); grayscale on eliminated tokens | Pre-darkened `linear-gradient(#0002,#0002), url(paper.webp)`; shadows only on the three large panels |
| Carcassonne | 59 at 29 tiles, about 100 late | one SVG tint `<filter>` per figure instance ([games/carcassonne/src/table/FigureSprite.svelte:43](../../games/carcassonne/src/table/FigureSprite.svelte#L43)) | Pre-tint once per sprite and colour on a canvas, as the 8-bit `figureImage` cache does (4 sprites × 6 colours); about 10–20% more frames during zoom |
| UNO | one per dimmed hand card (10–25) | `.hand .card.dim { filter }` and a `filter` transition ([games/uno/src/Board.svelte:1329](../../games/uno/src/Board.svelte#L1329), :962) | A dark layer in the existing `::after` gloss, like the 8-bit overlay |

_Src: perf:bundle#8, azul:code#5, azul:art-classic#12, sushi-go-party:code#9, sushi-go-party:art-classic#11, little-secret:code#12, little-secret:art-classic#12, carcassonne:code#5, catan:art-classic#12, uno:code#8, uno:art-classic#13._

<a id="p14"></a>**P14. Infinite animations on paint- and layout-bound properties.** Low · S.
UNO Classic animates a 26 px box-shadow glow for the whole of each opponent turn ([games/uno/src/Board.svelte:792](../../games/uno/src/Board.svelte#L792), keyframes :1513), plus the armed UNO button (:1381). 8-bit UNO animates `margin-inline` on the turn arrows ([games/uno/src/pixel.css:616](../../games/uno/src/pixel.css#L616)), box-shadow blinks (:1045, :1083) and the armed background (:1189). The Codenames reveal keyframes animate `boxShadow` ([games/codenames/src/Board.svelte:329](../../games/codenames/src/Board.svelte#L329)).
Fix: draw each glow once on a pseudo-element and animate its opacity (steps(1) in 8-bit). Use `translate: calc(var(--dir) * 4px) -50%` for the nudge. Keep the dashed march.
_Src: perf:bundle#9, uno:code#8, uno:art-pixel#12, codenames:code#9._

<a id="p15"></a>**P15. The home box carousel animates `left`, `top` and `filter`.** Low · S.
[apps/web/src/routes/+page.svelte:457](../../apps/web/src/routes/+page.svelte#L457) transitions layout and a drop-shadow on 270×300 SVGs on every hover selection. Fix: keep `left`/`top` fixed and express previous, front and next as one transform each (including the 480 px override), with a static shadow ellipse below that only fades.
_Src: web-shell:code#8, home:art-classic#8._

<a id="p16"></a>**P16. Classic Carcassonne and its catalog lessons still load the 8-bit rasterizer.** Low · M.
TileArt, FigureSprite, Elevation and Board import `pixel/atlas.svelte.ts` statically ([games/carcassonne/src/TileArt.svelte:5](../../games/carcassonne/src/TileArt.svelte#L5)). The real saving is about 11 KB minified, 4–5 KB compressed. Load it in Board's existing lazy `Promise.all` and pass the image functions through context. Correct [docs/carcassonne-pixel.md:7](../../docs/carcassonne-pixel.md#L7) either way.
_Src: carcassonne:code#9._

<a id="p17"></a>**P17. Carcassonne's ambient sway and smoke cost a core only under software compositing.** Low · S.
The 76 animations are composited; on a GPU the main thread is idle. With `--disable-gpu` the compositor spent about 2.7 s per 3 s idle. If you address it, sway only the trees at detail zoom, use one sway group per tile instead of 64 per-prop animations, and pause ambient motion during pan and zoom. Check on a real phone first. The Ambient motion toggle stays the escape hatch.
_Src: carcassonne:code#7, carcassonne:art-classic#3._

<a id="p18"></a>**P18. A replayed accepted action id rebroadcasts full views to every seat.** Low · S.
[apps/server/src/rooms.ts:229](../../apps/server/src/rooms.ts#L229) returns success for a duplicate id, and `handle()` publishes anyway ([apps/server/src/socket.ts:40](../../apps/server/src/socket.ts#L40)), contradicting the comment at :20. One seat in a 12-player room could force about 360 view builds a second. Fix: have `action` return whether it applied anything, and publish only on change.
_Src: server:code#10._

<a id="p19"></a>**P19. Azul's closed dialog keeps its last content mounted.** Low · M.
`modal` starts as `'help'` ([games/azul/src/Board.svelte:65](../../games/azul/src/Board.svelte#L65)), so the closed dialog renders the Rulebook on load and fetches the AzulScene chunk without help ever being opened. A closed inspection board keeps re-rendering every revision. Fix with [S2](#s2): wrap the body in `{#if dialogOpen}`.
_Src: azul:code#8._

<a id="p20"></a>**P20. The Rulebook search rebuilds every lesson's text on each keystroke.** Low · S.
[apps/web/src/lib/catalog/Rulebook.svelte:59](../../apps/web/src/lib/catalog/Rulebook.svelte#L59) joins about 300 message calls per keystroke (and, until [B8](#b8) lands, each one reads storage). Build a `$derived` haystack once per loaded guide, using the `fold()` from [U13](#u13).
_Src: web-shell:code#11._

Not worth doing: lazy-importing jev-lab on the server (Bun inlines the dynamic import; startup cost is 2–5 ms; gap6#10), and a dedicated split of Dominó's sprite module (about 1.4 KB gzip; domino:code#15).

## 5. UX, accessibility and i18n

### Room shell, invites and the home page

<a id="u1"></a>**U1. An invited guest sees "This room may have ended" with no game, host or seat information.** High · M.
With no `session.room`, the page shows only "Join room", `m.room_missing()` and a name field ([apps/web/src/routes/room/[id]/+page.svelte:245](../../apps/web/src/routes/room/%5Bid%5D/+page.svelte#L245)), the same for a live lobby, a game in progress and a missing room. The invite never names the game, Oscar or the seats.
Fix: a read-only `peek` handler (`handle('peek', (r) => rooms.peek(r.roomId), false)`) that returns `{gameId, status, practice, hostName, seats, minPlayers, maxPlayers, open}`, with no token and no state. Call it when `!room && connected`. Render BoxArt, "{host} invited you to {game} · 2/6", and use `room_missing` only when peek fails.
_Src: gap2#1._

<a id="u2"></a>**U2. A guest without a seat is told their seat is reserved, and dead or full rooms keep offering Join and Invite.** Medium · S.
The toolbar shows `m.disconnected` and Invite with no seat check ([apps/web/src/routes/room/[id]/+page.svelte:116](../../apps/web/src/routes/room/%5Bid%5D/+page.svelte#L116)). Fix: when `!room`, show `m.connecting` and hide Invite. Drive the terminal states from the join reply: "Room not found" swaps the form for an ended state plus Back to games, and "No available seat" or "Room is full" shows "game in progress, ask the host for a new match". Map those codes through [S8](#s8).
_Src: gap2#2._

<a id="u3"></a>**U3. "Loading game…" is dark green on near black (about 1.3:1).** Medium · S.
[apps/web/src/routes/room/[id]/+page.svelte:231](../../apps/web/src/routes/room/%5Bid%5D/+page.svelte#L231) renders a bare status line inside `.room.immersive` (#191e1b, :303). Reloads and late joins look like a blank page. Fix: a centred light block (`color: #f1e8d0; display: grid; place-items: center; height: 100%`), optionally with the game name and BoxArt.
_Src: gap2#4._

<a id="u4"></a>**U4. Disconnect status: Carcassonne shows none, and Catan, Azul, Codenames and Little Secret show it twice.** Medium · S.
The shell banner is gated on a hard-coded `cornerControls` list that omits Carcassonne ([apps/web/src/routes/room/[id]/+page.svelte:33](../../apps/web/src/routes/room/%5Bid%5D/+page.svelte#L33)), and Carcassonne hides `.room-toolbar` ([games/carcassonne/src/Board.svelte:2095](../../games/carcassonne/src/Board.svelte#L2095)). Other boards repeat the warning ([games/catan/src/Board.svelte:782](../../games/catan/src/Board.svelte#L782), [games/azul/src/Board.svelte:604](../../games/azul/src/Board.svelte#L604), [games/little-secret/src/Board.svelte:342](../../games/little-secret/src/Board.svelte#L342), [games/codenames/src/Board.svelte:684](../../games/codenames/src/Board.svelte#L684)).
Fix: gate the banner on `immersive && !session.connected`. Delete the boards' own-connection lines, but keep Codenames' status inside Settings and the per-seat offline tags.
_Src: gap2#5._

<a id="u5"></a>**U5. On phones the reconnect banner wraps to three lines and slides over the error banner and each game's top HUD.** Medium · S.
At 390 px the two notices overlap by 33 px ([apps/web/src/routes/room/[id]/+page.svelte:262](../../apps/web/src/routes/room/%5Bid%5D/+page.svelte#L262), :334). Fix: one absolutely positioned flex column for both notices (top `max(12px, safe-area) + 52px`, gap 6 px), a one-line phone copy, and `pointer-events: none` on the status.
_Src: gap2#6._

<a id="u6"></a>**U6. Lobby Start is disabled with no reason, and the lobby never states the player range.** Medium · S.
[apps/web/src/routes/room/[id]/+page.svelte:157](../../apps/web/src/routes/room/%5Bid%5D/+page.svelte#L157) disables Start when there are too few seats or one is offline, but the copy is always "The host can start once everyone has joined". Fix: a reason line under the button (`m.players({min, max})`, "Waiting for N more", or "{name} is reconnecting"), dashed empty slots up to `minPlayers`, and the game's BoxArt in place of ◈ ([HOME-C4](#home-c4)).
_Src: gap2#7._

<a id="u7"></a>**U7. At game end, non-hosts get no cue that only the host can start the next match.** Low · S.
Every finished view renders Play again only under `{#if canRematch}` with no else branch (UNO :562, Azul :1033, Sushi :878, Codenames :917, Little Secret :631, Dominó Hud :157). Fix: one shared key, `rematch_waiting` ("Waiting for {host} to start another game"), rendered once by the shell when the room is finished and you aren't the host, in the notice column from [U5](#u5).
_Src: gap2#9._

<a id="u8"></a>**U8. UNO practice offers "Invite friends" to a room nobody can join.** Medium · S.
The settings snippet always shows Invite ([apps/web/src/routes/room/[id]/+page.svelte:213](../../apps/web/src/routes/room/%5Bid%5D/+page.svelte#L213)), and a friend opening the link gets "Practice rooms are private" ([apps/server/src/rooms.ts:177](../../apps/server/src/rooms.ts#L177)). Fix: wrap Invite in `{#if !room.practice}` and show `m.uno_practice_table()` otherwise. That makes [R18](#r18) a move rather than a deletion.
_Src: uno:code#4._

<a id="u9"></a>**U9. UNO and Sushi Go Party drop the in-game rulebook the room passes them.** Medium · S.
The room passes `rulesContent` (a `<Rulebook>`) to every Board ([apps/web/src/routes/room/[id]/+page.svelte:203](../../apps/web/src/routes/room/%5Bid%5D/+page.svelte#L203)). Azul, Catan, Codenames, Little Secret and Dominó render it; UNO and Sushi don't accept the prop. UNO's house rules (stacking, drawing ends the turn, no +4 challenge) are exactly what players look up.
Fix: UNO adds a book button and a second `{@attach modal(...)}` dialog that renders `{@render rulesContent?.()}`. Sushi adds a "Lessons" section to its guide dialog, and its practice route passes the Rulebook as the others do.
_Src: uno:code#3, sushi-go-party:code#11._

<a id="u10"></a>**U10. Home hover-to-select starts the wrong game.** High · S.
Hovering any name selects it after 80 ms ([apps/web/src/routes/+page.svelte:91](../../apps/web/src/routes/+page.svelte#L91)), and nothing restores the clicked choice. Verified at 1440×900 and 1280×800: click Catan, move straight to Start over 250–700 ms, and the dialog opens for Azul.
Fix: a `committed` id set by click and focus. Hover only previews. `onpointerleave` on `<nav class="game-names">` clears the timer and restores `committed`.
_Src: home:art-classic#1._

<a id="u11"></a>**U11. Coming back from a game resets the home to UNO.** Low · S.
`selected` is a plain `$state('uno')` ([apps/web/src/routes/+page.svelte:12](../../apps/web/src/routes/+page.svelte#L12)). Fix: `export const snapshot = { capture: () => selected, restore: (v) => (selected = v) }`, which SvelteKit restores on history navigation. Persist across visits only if wanted.
_Src: home:art-pixel#8._

<a id="u12"></a>**U12. Board and word language defaults to English for Spanish users.** Medium · S.
`boardLanguage = $state('en')` ([apps/web/src/routes/+page.svelte:15](../../apps/web/src/routes/+page.svelte#L15)), and the Codenames and Little Secret practice routes call `practice()` with the English default (`practice/codenames:17`, `practice/little-secret:17`). Only `reset()` passes the locale. Fix: initialise from `getLocale()` in all three, and keep the select.
_Src: web-shell:code#4._

<a id="u13"></a>**U13. Catalog and Rulebook searches don't fold accents: "domino" misses Dominó, "ladron" misses ladrón.** Medium · S.
[apps/web/src/lib/home/PixelStore.svelte:98](../../apps/web/src/lib/home/PixelStore.svelte#L98) and [apps/web/src/lib/catalog/Rulebook.svelte:59](../../apps/web/src/lib/catalog/Rulebook.svelte#L59) use plain `toLowerCase().includes`. es.json has "ladrón" 17 times and "ladron" none. On phones, Dominó is the last, off-screen tile, so search is the quick way to it. Fix: `fold = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase()` on both sides, plus `aria-live="polite"` on `.showing`.
_Src: web-shell:code#11, home:art-pixel#9._

<a id="u14"></a>**U14. Dominó shows "4–4 players" in both skins.** Low · S.
`players` is always `{min}–{max}` ([packages/shared/messages/en.json:46](../../packages/shared/messages/en.json#L46)). Add `players_exact` and a `playerRange(game)` helper for the four call sites (home kicker, Start dialog, summary dialog, [apps/web/src/lib/home/PixelStore.svelte:259](../../apps/web/src/lib/home/PixelStore.svelte#L259)).
_Src: home:art-classic#11._

### Phone, landscape, laptop and tablet layouts

<a id="u15"></a>**U15. Catan can't be played in phone landscape at 667×375, and at 740–844 the plaques sit on the controls and the island.** High · M · both skins.
The phone block is width-only ([games/catan/src/Board.svelte:2881](../../games/catan/src/Board.svelte#L2881)), so a landscape phone gets portrait seat offsets over a table at `inset: 25% 0 32%` (:3020). The seats cover the island, your own seat sits under Open offer and Bank, and Buy development hit-tests to the hand. From 701 px, the south plaque sits over the island's bottom 46 px (:3184), and the 8-bit west plaque overlaps the controls by 106 px.
Fix: make the phone block portrait-only (`(max-width: 700px) and (min-height: 501px)`, also in [games/catan/src/pixel.css:810](../../games/catan/src/pixel.css#L810)), and widen the short block to `(max-height: 620px) and (min-width: 560px)` with `.table { inset: 8% 21% 24% }`. Move the south plaque into the left gutter above `.controls`, cap the side plaques at `top: 12%`, and lift `.phase` above the hand. Carcassonne and Dominó already handle short landscape this way.
_Src: gap1#1._

<a id="u16"></a>**U16. UNO in phone landscape: the hand covers both piles, and the turn pill hides the active-colour pill.** High · S.
At 667×375 the portrait hand rule (`width: calc(100vw - 20px); bottom: 118px`, [games/uno/src/Board.svelte:1606](../../games/uno/src/Board.svelte#L1606)) covers the Draw and discard piles in both skins. At 844×390, the pill hides the colour chosen after a Wild. Fix: add `and (orientation: portrait)` to the hand rule and the portrait `.center-table` tops (:1590, [games/uno/src/pixel.css:927](../../games/uno/src/pixel.css#L927)), so landscape keeps the bottom-anchored hand. In the `(max-height: 620px)` blocks, move the turn pill out of the pile-label band, and anchor `.color-pill` above the discard.
_Src: gap1#2._

<a id="u17"></a>**U17. UNO on portrait phones: no play direction, a clipped outer card, unreadable +2 corners, and crowded big tables.** Medium · M.
At 390×844 the turn pill covers the direction label and `.flow` is hidden ([games/uno/src/Board.svelte:1593](../../games/uno/src/Board.svelte#L1593)), which matters after a Reverse. The first hand card starts at x = −37, and in a 13-card hand the +2 corners show only "+" and tap strips are about 22 px (:1297). With 6–8 players the Draw pile covers seat plates. In 8-bit, side plates slide under the stock, and "Computadora" is cut to "Computad".
Fix: a ↻/↺ glyph beside the colour pill that turns on reverse (with visually hidden text). Lower the fan arc, or add 12–16 px of padding, so outer cards stay on screen. Add `class:crowded={hand.length > 8}` with `overflow-x: auto`, scroll snap, a fixed ~40 px step, no rotation and room for the hover lift. Fit the +2 and +4 corners. Lift only the seats that land in the pile band (`class:low={position[1] >= 40}`; a blanket lift breaks 6-player tables), and ellipsize plate text. Then fix the README sentence ([D2](#d2)).
_Src: uno:code#5, uno:art-classic#7, uno:art-classic#8, uno:art-pixel#3._

<a id="u18"></a>**U18. Codenames in phone landscape: history, players and the key drawer are off-screen, and the bottom card row covers the clue.** Medium · M.
Compact mode is chosen by `innerWidth < 1024` alone ([games/codenames/src/Board.svelte:114](../../games/codenames/src/Board.svelte#L114)). The compact rows ([games/codenames/src/tokens.css:1154](../../games/codenames/src/tokens.css#L1154)) exceed 360–390 px, and `.cn-table` clips overflow. Fix: a short-landscape variant (`@media (max-height: 500px)`) with the board on the left and a 140 px side column for teams, turn, action and drawer. The minimum fix is a `minmax(0, 1fr)` board row plus `overflow-y: auto` on the compact table.
_Src: gap1#3._

<a id="u19"></a>**U19. Codenames on small phones: the turn pill slides under the blue status at 320 px, and at 390 px the grid leaves about 170 px of bare wood with 11 px words.** Medium · S.
The side minimums plus 52 px margins leave about 52 px for the pill ([games/codenames/src/tokens.css:1153](../../games/codenames/src/tokens.css#L1153)). The grid is capped at `max(90cqw, 480px)` and centred (:1182). Fix: `minmax(92px, 1fr)` side columns and a shrinkable pill. In compact portrait, a grid height of `min(100cqh, 165cqw)` and card words at `clamp(.6875rem, 3.1vw, 1.1rem)`. Check 320×568, 360×640 and 390×844 in both locales and both skins.
_Src: codenames:code#2, codenames:art-classic#9._

<a id="u20"></a>**U20. Azul sends 1366×768 laptops and every tablet to the phone layout.** High · M · both skins.
`phone` is `(max-width: 900px), (max-height: 800px)` ([games/azul/src/Board.svelte:311](../../games/azul/src/Board.svelte#L311)), so a 1366×657 laptop viewport gets a 340 px ring, 56 px plates, 16 px factory tiles and a 116×43 own-board tray in empty felt, plus a stray "| Round 1" divider. ADR 020:33 chose this cut-off on purpose.
Fix: amend the ADR and use `(max-width: 900px), (max-height: 600px)`. For heights of 600–900 px, scale the desktop composition to fit: `transform: scale(var(--fit))` on `.supply` and the own board, with `--fit = min(1, innerHeight / 900)` set in the existing resize handler. Flight anchors use `getBoundingClientRect`, so they stay right. Portrait tablets that stay compact should size the ring from the width (`min(innerWidth - 32, 560)`). Reset the `.compact-table .round` border.
_Src: azul:art-classic#1, gap1#4._

<a id="u21"></a>**U21. Azul in phone landscape: a 300×60 own board, the bag line under the gear, and the bottom factory cut off.** Medium · S.
Two duplicate `(min-width: 601px) and (max-height: 680px)` blocks override each other ([games/azul/src/Board.svelte:2067](../../games/azul/src/Board.svelte#L2067), :2795). Fix: merge them into one 3-row right column (opponent card with a preview of at least 96 px, own board filling the remaining height, reserves in a footer row), and size the compact ring to `innerHeight - 48`.
_Src: gap1#5._

<a id="u22"></a>**U22. Azul on small phones: a clipped ring at 320 px, empty felt at 390 px, and 8-bit opponent cards that hold a 48×17 thumbnail.** Medium · M.
The compact ring is a fixed 340 px ([games/azul/src/geometry.ts:6](../../games/azul/src/geometry.ts#L6)), so at 320 px the side plates are clipped and the tray hides the bag count. At 390×844 about 250 px of felt sits between ring and tray. In 8-bit, the opponent preview is 48×17.6 inside a 90%-opaque 296×55 panel.
Fix: size the ring from the viewport. Make the collapsed tray a ~140 px "peek" of the pattern lines and floor (still one board instance). Use `tile-bag.webp`/`tile-chest.webp` at 28 px in place of the code-drawn sack so props match across layouts. In 8-bit, raise the opponents row and draw the compact wall as flat whole-pixel cells (6 px with 1–2 opponents, 4 px with 3) with floor pips, on an opaque panel.
_Src: azul:code#11, azul:art-classic#11, azul:art-pixel#11._

<a id="u23"></a>**U23. Catan on portrait phones: 7.65 px stats, 18–28 px targets, a roll that disappears, and Spanish labels that overflow.** Medium · M.
Measured at 390×844: seat stats 7.65 px, seat Trade buttons 44×24, zoom buttons 20×18, placement targets 19 px. The dice bowl is hidden at 700 px and below ([games/catan/src/Board.svelte:3032](../../games/catan/src/Board.svelte#L3032)), so there is no record of the roll. In Spanish, "Reino de las Brasas" wraps, and in 8-bit at 390 px the east plaque covers the north seat's Comercio button. "Madera", "Ladrillo" and "Mineral" run into the card borders, and the badge covers "Caballe|ro" and "victoria".
Fix:
- Icon-and-number chips for the stats at 11 px.
- One "Trade" bottom sheet with tabs, so the remaining buttons can be 40 px or taller.
- 32 px zoom buttons and `.target { r: 22px }` under `(pointer: coarse)`.
- The last roll as two 18 px dice beside the phase line.
- `.seat-trade` in normal flow for the north, west and east seats.
- 8-bit card titles at 11 px with no letter-spacing, and the quantity badge moved off the title ([CAT-C4](#cat-c4)).

Check 360 and 390 in both skins.
_Src: catan:art-classic#11, gap4#2, gap4#3._

<a id="u24"></a>**U24. Sushi Go Party in phone landscape and on tablets: the hand fills 63% of the screen, or text shrinks to 5–7 px.** Medium · M.
Landscape uses the portrait stack, with a 169 px sticky hand ([games/sushi-go-party/src/table/table.css:491](../../games/sushi-go-party/src/table/table.css#L491), :591), so your own tableau never shows while you choose. On tablets the fixed 1440×900 stage scales to 0.57 at 820×1180 ([games/sushi-go-party/src/Board.svelte:83](../../games/sushi-go-party/src/Board.svelte#L83)), so "0 / 5 guests ready" renders at 5.9 px and half the screen is empty.
Fix: for landscape (`max-width: 1000px`, `max-height: 500px`, `min-width: 650px`), make the hand a fixed right column at 40% width with `zoom: .7` cards, so the table scrolls on the left. Send portrait tablets to the phone stack, which sizes by width. Give status labels a floor such as `max(12px, calc(12px / var(--table-scale)))`.
_Src: gap1#7, gap1#8._

<a id="u25"></a>**U25. Sushi Go Party on phones: board text renders at 6–8 px and half the opponents are off-screen.** Medium · M.
The 840 px board is zoomed to 0.445 at 390 px ([games/sushi-go-party/src/table/table.css:534](../../games/sushi-go-party/src/table/table.css#L534)), so tile rules are 6.2 px. Opponent trays scroll sideways with no edge cue. Fix: on phones, show title and art only on tiles (rules already open on tap), drop the track SVG in favour of exact scores on seat chips, and replace the trays with four compact chips (pawn, name, score, status dot, last dish) that open the existing tray dialog.
_Src: sushi-go-party:art-classic#10._

<a id="u26"></a>**U26. Little Secret puts tablets and landscape phones in one 650 px column with no seats in view.** Medium · M.
`(max-width: 1099px), (max-height: 699px)` stacks everything ([games/little-secret/src/Board.svelte:1160](../../games/little-secret/src/Board.svelte#L1160), also SideSheet :300 and pixel.css :839). At 844×390 only 21 px of "I will start" shows; at 1024×768 two seats show. Fix: lower the width cut to about 900 px. For short landscape, use two columns: action area on the left, a 3-up seat grid on the right, and a one-line phase header.
_Src: gap1#9._

<a id="u27"></a>**U27. Little Secret's action panel hides your secret password and the next-step button at common laptop heights.** High · S · both skins.
`.action-scroll` is capped at `(100dvh - 152px) * 0.42 - 48px` ([games/little-secret/src/Board.svelte:981](../../games/little-secret/src/Board.svelte#L981); `0.5` in [games/little-secret/src/pixel.css:196](../../games/little-secret/src/pixel.css#L196)). Measured without auto-scroll: at 1440×900 after Reveal the password starts below the box (it is clipped even at 1920×1080). Classic never scrolls the letter into view, because that code is pixel-only (Board.svelte :684). 8-bit scrolls it but stops exactly 30 px short, because the `ls-slide` first keyframe (pixel.css :587, :948) is already applied. "New match" and "Ready for the next mission" sit below the fold.
Fix:
- Scroll the non-animated `.envelope` parent, in both skins.
- Reset `scrollTop` when the phase or mission changes.
- Add a bottom fade mask as a "more below" hint.
- On desktop, make `.action-scroll > .primary` sticky at the bottom.
- Shorten the result screen: hide the Outcome mascot on desktop, drop the duplicate "Winners: names" line, and show the scene at 1× below 900 px.

Don't grow the box; it would cover the top and bottom seats.
_Src: little-secret:code#2, little-secret:art-classic#1, little-secret:art-pixel#1, little-secret:art-pixel#3._

<a id="u28"></a>**U28. The site header overflows on phones, and the 8-bit header doesn't fit between 721 and about 900 px.** Medium · S.
At 360 px in Spanish, `.theme-switch` clips "8-bit" (`overflow: hidden`, [apps/web/src/routes/+layout.svelte:80](../../apps/web/src/routes/+layout.svelte#L80)), the select reads "espa", and the brand, "Join a room" and "8-/bit" wrap. In 8-bit, `.store-nav` is hidden only at 720 px or less (:145), so at 740–844 "Join a room" wraps and the theme button is cut at the edge. Fix: show EN/ES codes in the select at 480 px or less, `white-space: nowrap` on `.theme-switch button` and `.catalog-join`, let the header wrap, shorten the brand to ◈, and hide `.store-nav` up to about 900 px in the 8-bit header.
_Src: web-shell:code#10, home:art-classic#6, gap1#10._

<a id="u29"></a>**U29. Carcassonne's Confirm is the smallest control, the tray jumps when a preview starts, and on 8-bit phones the tray balloons over the board.** Medium · S.
Confirm and Cancel are 30×29 px next to a 62 px rotate disc ([games/carcassonne/src/Board.svelte:2542](../../games/carcassonne/src/Board.svelte#L2542)). The confirm row and the 10 px mismatch note mount only `{#if preview}` (:1609), which pushes Rotate up 54 px. On an 8-bit phone the mismatch text wraps to six lines, and seat names are cut to "Elea…" ([games/carcassonne/src/pixel.css:904](../../games/carcassonne/src/pixel.css#L904)).
Fix:
- Make Confirm a 48 px brass ✓ disc, and Cancel and Rotate-left 40 px.
- Reserve the row height with `visibility: hidden` instead of `{#if}`.
- Move the mismatch text into the turn-hint line, as a ternary in the markup.
- In 8-bit compact, hide `.placement-controls small`, give `.player` a minimum width of 96 px with 13 px names, and put the hint on a thin wood plaque.

Optionally float ✓ and × beside the ghost tile.
_Src: carcassonne:art-classic#9, carcassonne:art-pixel#8._

<a id="u30"></a>**U30. 8-bit Carcassonne setup hides the Start or Ready button below the fold on desktop.** Medium · S.
At 1440×900 the 8-bit setup panel's content is 1067 px against an 804 px box, with `.primary` at y 1038 ([games/carcassonne/src/pixel.css:649](../../games/carcassonne/src/pixel.css#L649)). The 8-bit module cards are 95 px tall against 64 px in Classic. Fix: a sticky primary button on a parchment strip, and shorter cards (12 px descriptions, less padding). Don't clamp the descriptions.
_Src: carcassonne:art-pixel#1._

<a id="u31"></a>**U31. 16-character Dominó team names overflow the chalkboard on phones.** Medium · S.
`.team-name` never truncates ([games/domino/src/Hud.svelte:331](../../games/domino/src/Hud.svelte#L331), :579), so even 15–16 character names wrap and run under Settings. Fix: `min-width: 0` on `.team`, ellipsis on `.team-name`, and `max-width: calc(100vw - 112px)` on the compact chalkboard. Apply the same ellipsis in the result panel.
_Src: domino:code#3._

### Game-specific UX

<a id="u32"></a>**U32. UNO Classic never shows opponents' card counts.** Medium · S.
The fan caps at 7 backs, is `aria-hidden`, and only the 8-bit skin prints a number ([games/uno/src/Board.svelte:415](../../games/uno/src/Board.svelte#L415)). Fix: always render a count chip (a cream pill at the fan's lower right, amber at 2, red with a pop at 1). Add the count to the seat's accessible name with a new en/es key, "{name}, {count} cards".
_Src: uno:code#2, uno:art-classic#9._

<a id="u33"></a>**U33. UNO explains calling UNO only in a hover tooltip, and the stock still says "Draw" during a penalty.** Low · S.
`m.uno_declared_hint` lives only in `title` ([games/uno/src/Board.svelte:615](../../games/uno/src/Board.svelte#L615)), and practice bots catch you about 900 ms later. Fix: show the hint as a caption when you hold 2 cards on your turn, and use `m.uno_penalty()` as the stock caption when a penalty is set (:462).
_Src: uno:code#12._

<a id="u34"></a>**U34. The Reverse glyph is ⇄ on cards and ↺ in the rulebook, BoxArt and summary.** Low · S.
[games/uno/src/Board.svelte:173](../../games/uno/src/Board.svelte#L173) against [apps/web/src/lib/catalog/Rulebook.svelte:152](../../apps/web/src/lib/catalog/Rulebook.svelte#L152), `learn_uno_reverse_action`, `BoxArt.svelte:319` and `SummaryStep.svelte:117`. Use ⇄ on every card face; the guide's direction diagram can keep ↺.
_Src: uno:code#13._

<a id="u35"></a>**U35. Catan's discard form has no running total or validation.** Medium · S.
Five `type=number` inputs and an always-enabled Confirm ([games/catan/src/Board.svelte:1669](../../games/catan/src/Board.svelte#L1669)), with the selection reset right after send, even on rejection. Fix: reuse the offer steppers (:1736), capped at your hand, show "n / required", disable Confirm until they match, and reset only once the next view no longer asks for a discard.
_Src: catan:code#7._

<a id="u36"></a>**U36. Catan bank-trade buttons don't show the rate.** Low · S.
They read "Bank: Brick → Wood" ([games/catan/src/Board.svelte:472](../../games/catan/src/Board.svelte#L472)). Have the server include `rate` in each legal BANK_TRADE ([games/catan/src/index.ts:378](../../games/catan/src/index.ts#L378)), and label it "4 Brick → 1 Wood".
_Src: catan:code#10._

<a id="u37"></a>**U37. Picking a feature or meeple in Carcassonne empties the decision panel.** Medium · S.
The option filter ([games/carcassonne/src/Board.svelte:287](../../games/carcassonne/src/Board.svelte#L287)) keeps only node, feature and tile targets, so crop, message-8, pig (figure ids) and reward (player ids) options vanish when you click the meeple you want to return. Every figure option is labelled "Return meeple". Fix: filter only node, feature and tile options. Resolve figure-id targets to their node, so clicking that meeple picks its option. Label options as "Return meeple · Road · 2 pts", and highlight the hovered option's target.
_Src: carcassonne:code#2._

<a id="u38"></a>**U38. Carcassonne gold-ingot counters are drawn under the meadow scenery.** Low · S.
The badge ([games/carcassonne/src/Board.svelte:983](../../games/carcassonne/src/Board.svelte#L983)) is in the flat ground pass, and trees in the depth pass paint over it. Fix: render it after each tile's Elevation, or upright in the hit-region pass with `pointer-events: none`. Make it larger and keep it out of the meadow prop slots.
_Src: carcassonne:code#8._

<a id="u39"></a>**U39. Carcassonne's Ready is clickable while a seat is offline, and the server rejects it in English.** Low · S.
Ready is disabled only for your own state ([games/carcassonne/src/Board.svelte:1526](../../games/carcassonne/src/Board.svelte#L1526)), and `index.ts:799` throws "Invalid Carcassonne action". Fix: disable it while any player is disconnected, with a "waiting for reconnect" line, and throw a code mapped by [S8](#s8).
_Src: carcassonne:code#13._

<a id="u40"></a>**U40. Carcassonne's tile ghost and tray tile spin backwards through full turns.** Low · S.
`rotate()` adds to `visualRotation` without limit ([games/carcassonne/src/Board.svelte:303](../../games/carcassonne/src/Board.svelte#L303)), and `selectLocation` resets it to `rotation % 4` (:323), so after five turns a new slot animates a 360° reverse spin. Fix: snap to the nearest equivalent angle, `visualRotation += ((rotation - visualRotation) % 4 + 6) % 4 - 2`.
_Src: carcassonne:code#14._

<a id="u41"></a>**U41. Carcassonne shows camera controls during setup, and marks your seat with a bare " ·".** Low · S.
The camera bar and hint render in every phase ([games/carcassonne/src/Board.svelte:1308](../../games/carcassonne/src/Board.svelte#L1308)), and on phones the setup card covers them. `.player.self strong::after { content: ' ·' }` (:2248) reads as a truncated name ("Rose ·"). Fix: wrap the camera nav in `{#if p.phase !== 'setup'}`. Render `<small class="you"> · {m.you()}</small>` outside the ellipsized name and remove the `::after` (also [games/carcassonne/src/pixel.css:176](../../games/carcassonne/src/pixel.css#L176)).
_Src: carcassonne:art-classic#12, gap4#8._

<a id="u42"></a>**U42. In 3- and 4-player Azul at 901–1499 px, the top factory plates and the status line collide.** High · S · both skins.
In Classic, "Round 1" and "choose a color" print across tile art ([games/azul/src/Board.svelte:2756](../../games/azul/src/Board.svelte#L2756)). In 8-bit, the heading becomes an opaque 300 px plaque at z-index 8 that hides half of each top plate while their buttons stay clickable ([games/azul/src/pixel.css:720](../../games/azul/src/pixel.css#L720)). The ring placement ([games/azul/src/geometry.ts:4](../../games/azul/src/geometry.ts#L4)) ignores the heading.
Fix: keep the `-5px` lift, which keeps the bottom plate clear. Classic: move round and turn into the free strip above CENTER, or stack them in the 148 px gap between the top plates with an ellipsis. 8-bit: when there are 7 or 9 factories, hide the wordmark, cap the plaque at 136 px, and use `m.azul_your_turn_short()`. Don't lower the z-index. Check start3 and start4 at 1440×900 and 1100×700 in en and es.
_Src: azul:code#3, azul:art-classic#9, azul:art-pixel#1._

<a id="u43"></a>**U43. The Azul bonus legend is clipped under the floor rail, and functional labels are 6–8 px.** Medium · M.
The legend (150 px at `right: 24px`) and the 458 px floor overlap by 23 px on the 760 px board ([games/azul/src/PlayerBoard.svelte:742](../../games/azul/src/PlayerBoard.svelte#L742), :764), so "Columns" reads "mns". "Pattern lines" and "Wall" are 8 px brown on the dark frame, and the legend is 6 px on compact (:994). Fix: put the legend in the floor's row sized against it, or above the rail with `z-index: 6`. Set the labels to 10 px or more in brass `#d9bd88` with a dark text shadow. Raise wall guides to about 0.3 opacity. Drop the 6 px legend on the compact tray.
_Src: azul:code#4, azul:art-classic#8._

<a id="u44"></a>**U44. The Azul desktop confirmation panel squeezes its preview to one word per line.** High · S · Classic.
The footer is `min(360px, 23vw)` wide with columns `56px minmax(0, 1fr) auto` and both buttons in column 3 ([games/azul/src/Board.svelte:2545](../../games/azul/src/Board.svelte#L2545), :1884). The box covers the tea prop, runs into the board frame, and says "1 tiles". Fix: use the 8-bit layout in the shared rules (`.confirm-actions { grid-column: 1 / -1 }`) and delete the duplicate in [games/azul/src/pixel.css:806](../../games/azul/src/pixel.css#L806). Reword `azul_preview` to avoid the plural noun. Show Skip on its own as a small pill.
_Src: azul:art-classic#2, gap5#5._

<a id="u45"></a>**U45. Azul opponent boards show only 2 of 5 rows.** Medium · M.
The compact mosaic is 58 px tall, but `--tile` is sized from width only ([games/azul/src/PlayerBoard.svelte:937](../../games/azul/src/PlayerBoard.svelte#L937)), so rows 3–5 are clipped and the floor spills onto the frame. Fix: make the mosaic a size container and set `--tile: min((100cqw - 8px) / 10.5, (100cqh - 5px) / 5)`. Keep the floor inside the parchment, and keep the inspect button for full detail.
_Src: azul:art-classic#3._

<a id="u46"></a>**U46. Azul practice keeps the old seat after each draft.** Low · M.
That is documented as intended ([docs/games/azul.md:55](../../docs/games/azul.md#L55)), but it costs three dialog steps per turn. Add a practice-only "Play as {name}" button in the waiting panel (an optional `onSeat` prop), order the scenarios start2, start3, start4, and update the doc.
_Src: azul:code#9._

<a id="u47"></a>**U47. An invalid Codenames clue gets a misleading "card no longer available" error, and the input has no limit.** Low · S.
The server rejects `\p{Cc}\p{Cf}` (which includes ZWJ emoji) and more than 80 graphemes, but `fail()` always throws `cn_error` ([games/codenames/src/index.ts:236](../../games/codenames/src/index.ts#L236), :16). Fix: `fail('cn_clue_invalid')` with en/es text, `maxlength="80"` on the input, and disable submit on control characters.
_Src: codenames:code#11._

<a id="u48"></a>**U48. Codenames practice shows "Jev guesses" as on before checking the lab, and its timers outlive the page.** Low · S.
`jev = $state(true)` ([apps/web/src/routes/practice/codenames/+page.svelte:23](../../apps/web/src/routes/practice/codenames/+page.svelte#L23)), and the 900 ms guess loop and fetch have no unmount guard. Seats are named by index ("Red team · 1") even when unassigned. Fix: probe on mount with an empty POST (404 means off, 400 means on, and costs no budget). Add a disposed flag and an `AbortController`. Take the team from `assignments`.
_Src: codenames:code#14._

<a id="u49"></a>**U49. Sushi Go Party trays say "Choosing…" during prompts, round end and the final screen.** Low · S.
The status falls back to "choosing" ([games/sushi-go-party/src/Board.svelte:528](../../games/sushi-go-party/src/Board.svelte#L528)). Fix: one `$derived` map per phase. In draft, committed → ready. In resolving, the prompt actor is choosing and everyone else is ready. In setup and round end, ready flags decide. In finished, hide the pill.
_Src: sushi-go-party:code#3, sushi-go-party:art-classic#12, sushi-go-party:art-pixel#11._

<a id="u50"></a>**U50. Sushi special effects resolve without feedback: collided Miso just vanishes, and nobody sees the Spoon request.** Low · M.
Only scored, pass and revealed events are announced ([games/sushi-go-party/src/Board.svelte:318](../../games/sushi-go-party/src/Board.svelte#L318)). Add live-region text and a seat mark for `miso-discard` and `takeout`. Show the next uramaki award on its tile. As a deliberate contract change, project `{requesterId, request}` for Spoon and render "{name} asked for …".
_Src: sushi-go-party:code#10._

<a id="u51"></a>**U51. Your Sushi plate clips after 4–5 dishes.** High · M · Classic.
The own plate is a fixed 283×108 strip with `overflow-x: auto` ([games/sushi-go-party/src/Board.svelte:1347](../../games/sushi-go-party/src/Board.svelte#L1347), [games/sushi-go-party/src/table/table.css:166](../../games/sushi-go-party/src/table/table.css#L166)). At game end it held 9 dishes in a 563 px scroll with no cue. Fix: group by kind with a ×N badge (wasabi tucked under its nigiri), and keep a focusable button per group so the scoring effects still target the cards. At 57 px per card not every 8-kind menu fits two rows of 4 at 283 px, so allow a second scrolling row with an edge fade. At round end, widen the plate and show full stacks.
_Src: sushi-go-party:art-classic#3._

<a id="u52"></a>**U52. Sushi's setup and finished panels hide their main button below a scroll.** Medium · S.
"Another feast" shows as a 13 px sliver ([games/sushi-go-party/src/table/table.css:331](../../games/sushi-go-party/src/table/table.css#L331)), and the 8-seat ready button is cut off (:318). Fix: flex columns with a sticky footer button over a paper-coloured fade.
_Src: sushi-go-party:art-classic#9._

<a id="u53"></a>**U53. Sushi labels collide in both skins.** Medium · S.
Classic: "Green Tea Ice Cream" runs under its art (title row fixed at 22 px, [games/sushi-go-party/src/table/MenuTile.svelte:27](../../games/sushi-go-party/src/table/MenuTile.svelte#L27)), "Special Order" is cut to "Special Orde" ([games/sushi-go-party/src/Card.svelte:108](../../games/sushi-go-party/src/Card.svelte#L108)), and the keep caption runs under a tray. 8-bit: "Keep this dish" spills out of its 48 px button on phones ([games/sushi-go-party/src/pixel.css:1006](../../games/sushi-go-party/src/pixel.css#L1006)), its caption overlaps the button on desktop, menu titles and three-line rules run over the art (pixel.css :152, :164), 9-card hand banners cut to "Urama", and the phone podium wraps "49" above its ✦.
Fix:
- Tiles: `grid-template-rows: auto minmax(0, 1fr) auto` with a 2-line clamp and `class:long` set in MenuTile for long titles (a container query can't detect a long name).
- Hand titles: 2 lines.
- 8-bit Keep button: `height: auto; min-height: 48px; line-height: 1`, wrapping allowed. The Spanish "Me quedo con este plato" needs two lines, so no `nowrap`.
- Phone podium: `strong { white-space: nowrap }`.
_Src: sushi-go-party:art-classic#8, sushi-go-party:art-pixel#4, sushi-go-party:art-pixel#5._

<a id="u54"></a>**U54. Little Secret practice never shows the ballot review, because the seat auto-advance resets the event gate.** Medium · S.
Practice sets `seat = game.actor` after every action ([apps/web/src/routes/practice/little-secret/+page.svelte:28](../../apps/web/src/routes/practice/little-secret/+page.svelte#L28)), and the gate identity includes `playerId` ([games/little-secret/src/Board.svelte:228](../../games/little-secret/src/Board.svelte#L228)). New players never see the game's main reveal. Fix: in practice, key the gate on the round only, since the events are public. Still close the envelope on a seat switch.
_Src: little-secret:code#3._

<a id="u55"></a>**U55. Little Secret's public reveals list shows a blank first row every mission, and the banner says "Mission 0" during setup.** Low · S.
SideSheet has no `deal` branch ([games/little-secret/src/table/SideSheet.svelte:114](../../games/little-secret/src/table/SideSheet.svelte#L114)). Add `{:else if e.type === 'deal'}{m.ls_deal()}`, and hide the mission line in setup.
_Src: little-secret:code#6._

<a id="u56"></a>**U56. Every one-word Little Secret clue slip shows a scrollbar.** Low · S.
`.clue-strip` overflows by 1 px with Kalam at `line-height: 1.25` ([games/little-secret/src/Board.svelte:935](../../games/little-secret/src/Board.svelte#L935)). Fix: `line-height: 1.4` and `overflow-x: hidden; overflow-y: auto`.
_Src: little-secret:code#7._

<a id="u57"></a>**U57. After an irreversible vote or RPS throw, the Little Secret player can't see what they chose.** Low · S.
`private.ballot` and `private.rps` are sent ([games/little-secret/src/engine.ts:533](../../games/little-secret/src/engine.ts#L533)) but never read. Show "Your ballot: {name}" or the chosen symbol above the wait text (one new key).
_Src: little-secret:code#8._

<a id="u58"></a>**U58. Little Secret's Elder and Dictator badges look the same, and power names are hover-only.** Medium · S · Classic.
[games/little-secret/src/Badge.svelte:11](../../games/little-secret/src/Badge.svelte#L11) and :14 differ by a 1.8 px bar at 32 px. Elder means two words on your clue turn, and Dictator a double vote. One-word names also give colliding initials ("L" for Leo and Luz). Fix: Elder as two stacked speech slips, Dictator as a ballot with a bold ×2, Novice as a finger to the lips. Show each seat's power as visible text, or a legend in SideSheet. Use two-letter initials when initials collide. Give your own seat a small "YOU" tab in place of the 12 px ◆.
_Src: little-secret:code#4, little-secret:art-classic#5._

<a id="u59"></a>**U59. Nothing shows which Dominó tiles are playable, and tapping an unplayable one does nothing.** Medium · S · both looks.
Rack items carry only `{id, near, far, lifted}` ([games/domino/src/three/scene.ts:22](../../games/domino/src/three/scene.ts#L22), [games/domino/src/pixel/scene.ts:28](../../games/domino/src/pixel/scene.ts#L28)), and `pick()` returns silently ([games/domino/src/game.svelte.ts:230](../../games/domino/src/game.svelte.ts#L230)).
Fix: add `playable` (`g.myTurn && g.playable.has(id)`) to rack items. In 3D, tint unplayable faces or sink them. In 8-bit, use a cached dimmed variant set 2 px lower. On the phone bar, `.hand-tile:not(.live) { opacity: .55 }`. Add `aria-disabled` on rack buttons. Show the hint only on your turn. For a wrong tap: a short wobble and a dull tock in 3D, and a 3-frame ±1 px wiggle with a square blip in 8-bit. Hover lift for 3D, set declaratively through state, is in [DOM-C10](#dom-c10). Land it after [S10](#s10).
_Src: domino:code#1, domino:art-classic#8, domino:art-pixel#1._

<a id="u60"></a>**U60. The Dominó end-of-hand panel covers the whole chain.** Medium · S.
`.result` is centred with no collapse ([games/domino/src/Hud.svelte:404](../../games/domino/src/Hud.svelte#L404)), so after a tranque nobody can see the blocked ends. Fix: a "Show table" toggle that shrinks the panel to a one-line strip (kind, points, Next hand) along the bottom edge. See [DOM-C7](#dom-c7) and [DOM-8.8](#dom-8-8) for moving the reveal onto the table.
_Src: domino:code#2._

<a id="u61"></a>**U61. Dominó team names default to "Nosotros/Ellos" for team A and B, so the second pair sees its own team called "Ellos".** Medium · S.
`teams: ['Nosotros', 'Ellos']` ([games/domino/src/index.ts:93](../../games/domino/src/index.ts#L93)) in every locale. Fix: default to `null` and render `teams[t] ?? (t === g.myTeam ? m.domino_team_us() : m.domino_team_them())`, with en "Us/Them" and es "Nosotros/Ellos". Custom names stay absolute.
_Src: domino:code#4._

<a id="u62"></a>**U62. Each tile click in the 8-bit store hides the cover for up to about 12 s.** Medium · S.
The errand (a 35% wrong-shelf detour, a climb, a search, the carry) blanks the cover to "Checking the back…" ([apps/web/src/lib/home/PixelStore.svelte:118](../../apps/web/src/lib/home/PixelStore.svelte#L118)), while the name and Open button already show the new game. Fix: remember fetched ids and skip the errand on reselect ("Still got it."), allow the detour at most once per visit, speed up the carry, and let a click on the stage or Esc skip to `found`.
_Src: home:art-pixel#6._

### Accessibility

<a id="u63"></a>**U63. 8-bit Azul factories show no focus ring on compact layouts, which includes 1366×768 laptops.** High · S.
[games/azul/src/pixel.css:852](../../games/azul/src/pixel.css#L852) sets `.factory-open:focus-visible { outline: 0 }` with no replacement, inside the compact-only block. Classic draws a 3 px gold ring. Fix: split the selector, give focus `outline: var(--px) solid var(--az-brass-light)`, and reuse the hover lift through `:has(.factory-open:focus-visible)`.
_Src: gap5#1._

<a id="u64"></a>**U64. A Catan keyboard turn takes about 80 Tabs, and focus drops to the page after Roll, Confirm, End turn and Escape.** Medium · M.
Enter on a target only sets `pending`; only a double click sends ([games/catan/src/Board.svelte:1411](../../games/catan/src/Board.svelte#L1411)). Confirm sits after the island in the DOM (:1583). Escape unmounts Settings while focus is inside (:723). Targets set `outline: none` (:2203). Fix: one tab stop for the legal targets, with a roving tabindex and arrows. Focus Confirm after choosing, and let a second Enter confirm. After send, focus a stable control. Return focus before closing menus. Add a visible stroke on the focused target.
_Src: gap5#2._

<a id="u65"></a>**U65. UNO's Wild colour picker never gets focus, and the swatches come after the corner tools.** Medium · S.
[games/uno/src/Board.svelte:491](../../games/uno/src/Board.svelte#L491) renders the picker without focusing it, and the played Wild's button unmounts, so focus goes to `<body>`. Fix: an attachment that focuses the first swatch after `tick()`, `role="group"` labelled by the prompt, and then the turn pill (`tabindex=-1`, `aria-live=polite`). On your next turn, focus the first playable card only if focus is on `<body>` or the pill.
_Src: gap5#3._

<a id="u66"></a>**U66. Committing an action drops keyboard focus to `<body>` in six boards.** Low · M.
- Sushi "Keep this dish" ([games/sushi-go-party/src/Board.svelte:292](../../games/sushi-go-party/src/Board.svelte#L292) only refocuses decision prompts).
- Little Secret "I will start" and "Clue given" (phase branches swap the buttons, [games/little-secret/src/Board.svelte:487](../../games/little-secret/src/Board.svelte#L487)).
- Codenames clue submit (focuses a button that has already unmounted, [games/codenames/src/Board.svelte:196](../../games/codenames/src/Board.svelte#L196)).
- Carcassonne meeple Enter (:1078).
- Azul compact draft (:248).
- Dominó rename Escape, whose input also has `outline: none` ([games/domino/src/Hud.svelte:351](../../games/domino/src/Hud.svelte#L351)).

Chrome's sequential-focus point softens the Tab cost, but screen readers announce nothing. Fix with [S15](#s15), starting with Sushi, Codenames, Carcassonne and Little Secret.
_Src: gap5#4._

<a id="u67"></a>**U67. Carcassonne's keyboard placement works, but nobody can discover it.** Low · S.
The map's focus cue is a 2 px inset line mostly under the header and tray ([games/carcassonne/src/Board.svelte:2115](../../games/carcassonne/src/Board.svelte#L2115)). The visible hint lists only mouse gestures (:1348), and the arrow, R and Enter keys appear only in the aria-label and a faint 10 px line in Settings. Fix: a second hint span ("Arrows choose a space · R rotates · Enter places"), swapped in CSS with `.landscape:has(.map:focus-visible) ~ .camera-hint`. Pre-select the first legal space when the map gains focus, so the green preview acts as the focus cue.
_Src: gap5#6._

<a id="u68"></a>**U68. UNO screen-reader labels: the top discard is an unnamed div, the stock says "UNO Draw", and +4 lacks "Wild".** Low · S.
[games/uno/src/Board.svelte:466](../../games/uno/src/Board.svelte#L466) puts `aria-label` on a role-less div, so the inner glyphs are read instead. Fix: `role="img"` on the discard with `aria-hidden` on the face spans, drop the hard-coded "UNO " prefix (:452), and name +4 as "Wild +4" (:177).
_Src: uno:code#9._

<a id="u69"></a>**U69. Catan announces and shows board locations as raw indices ("Move robber 4", "City 14", "#0–#18").** Medium · M.
Target labels append the vertex, edge or hex index ([games/catan/src/Board.svelte:1410](../../games/catan/src/Board.svelte#L1410)), the Confirm bar prints it (:1588), white `#i` text is drawn on every hex during robber moves (:1099, :1155), offers read "Accept offer #1" (:484), and harbors read "Everyone 3:1". Fix: describe places by surroundings ("Settlement: Wheat 8 · Ore 5 · Brick 10", "Robber → Forest 11"), built from `board.hexes`, with new en/es keys. Delete the `#i` text in both skins. Name offers by the offerer. Add an "Any resource 3:1" key.
_Src: catan:code#6, catan:art-classic#5._

<a id="u70"></a>**U70. Codenames shows card identities by colour only, breaking the documented "symbols as well as colours".** Medium · S.
[games/codenames/src/Board.svelte:571](../../games/codenames/src/Board.svelte#L571) draws only the word and the cover image; only the mini-key renders `<Icon>`. Under a protanopia simulation, red key cards turn olive next to the dark assassin. Fix: an `aria-hidden` corner badge `<Icon name={identity}/>` on known, unrevealed cards and on covers (diamond, disc, ring, X), at about 14 px (10 px compact), in `currentColor`. That makes [docs/games/codenames.md:59](../../docs/games/codenames.md#L59) true.
_Src: codenames:code#1, codenames:art-classic#8._

<a id="u71"></a>**U71. Codenames ARIA semantics are off.** Low · S.
`aria-pressed` on all 25 cards that actually open a dialog ([games/codenames/src/Board.svelte:583](../../games/codenames/src/Board.svelte#L583)), the drawer labelled "Table settings" (:755), a `<main>` inside the room's `<main>` (:566), and names on generic elements (:461, :520). Fix: `aria-haspopup="dialog"`, a "Table panels" label, `<div role="group">` for the grid, `role="img"` on the mini-key, and drop the unused `.selected/.key/.unknown` classes.
_Src: codenames:code#10._

<a id="u72"></a>**U72. The Sushi opponent tray button hides readiness and hand count from screen readers.** Medium · S.
Its `aria-label` replaces the visible status and count ([games/sushi-go-party/src/table/OpponentSeat.svelte:39](../../games/sushi-go-party/src/table/OpponentSeat.svelte#L39)). Add both to the label, or drop the label and add an sr-only "open tray" suffix.
_Src: sushi-go-party:code#4._

<a id="u73"></a>**U73. Little Secret: a nested `<main>`, ignored or wrong labels, unlabeled marks, and clue entry that ignores Enter.** Low · S.
`<main class=action-area>` sits inside the room's `<main>` ([games/little-secret/src/Board.svelte:431](../../games/little-secret/src/Board.svelte#L431)). A role-less div is labelled "Viewed seat" (:345). Clue slips are labelled with the phase title (:403). The ✓ and own-seat ◆ have no text, and the clue input isn't in a `<form>` (:499). Fix each; wrap the clue input like the guess form.
_Src: little-secret:code#10._

<a id="u74"></a>**U74. Azul factory controls: duplicate tab stops per tile, unexposed plate labels, and plate numbers never shown.** Low · S.
One button per tile gives 36 stops with 9 factories ([games/azul/src/Board.svelte:696](../../games/azul/src/Board.svelte#L696)). Fix: one tab stop per distinct colour per factory, `role="group"` on the plate, and either show the plate number or title the picker by its colours.
_Src: azul:code#10._

<a id="u75"></a>**U75. Reduced motion and the in-game Motion toggles are honoured unevenly.** Low · S.
- Carcassonne reads `prefersReducedMotion` once ([games/carcassonne/src/Board.svelte:170](../../games/carcassonne/src/Board.svelte#L170)), the toggle overrides it, and Elevation's guard skips `.sway` and smoke ([games/carcassonne/src/table/Elevation.svelte:336](../../games/carcassonne/src/table/Elevation.svelte#L336)). 8-bit Carcassonne's active-seat blink, nudge arrow and `.starts` blink loop forever outside `&.motion` ([games/carcassonne/src/pixel.css:161](../../games/carcassonne/src/pixel.css#L161), :174, :671).
- Dominó's Motion toggle only reaches the canvases. The blinking tags, the banner drop and the 1.4 s delayed result use only `@media (prefers-reduced-motion)` ([games/domino/src/pixel/PixelTable.svelte:334](../../games/domino/src/pixel/PixelTable.svelte#L334), [games/domino/src/Hud.svelte:837](../../games/domino/src/Hud.svelte#L837)).

Fix: `motion = $derived(setting && !prefersReducedMotion.current)`, with the toggle shown disabled when the OS asks. Add the missing selectors. Make the active blink play three times per seat change instead of looping, and move the nudge and `.starts` under `&.motion`. In Dominó, set `class:still={!g.motion}` on each component root, and skip the banner when motion is off.
_Src: carcassonne:code#6, carcassonne:art-pixel#7, domino:code#8._

<a id="u76"></a>**U76. Contrast failures.** Low–medium · S.
- Home: unselected game names `#8e7961` on `#f6ebd9` = 3.52:1 at 18.9 px on phones; kicker 4.40:1 at 10.9 px; dialog loop numbers 3.90:1 ([apps/web/src/routes/+page.svelte:815](../../apps/web/src/routes/+page.svelte#L815)). Use `#75604a`, `#7c5a39` and `#7f603d`.
- 8-bit Catan civilization names: Ember red 3.12:1 (2.66:1 when active) and Tideborn blue 4.12:1 on the dark plaque ([games/catan/src/pixel.css:135](../../games/catan/src/pixel.css#L135)). Add `--seat-text` tints (red `#ff7b6b`, blue `#5ec0ff`, a lifted purple) for text only.
- Classic Azul's factory-picker prompt is dark ink on `#302115`, about 1.1:1 ([games/azul/src/Board.svelte:1416](../../games/azul/src/Board.svelte#L1416)). Use `color: #f5ead3`.
- Summary loop badges at 1.97:1 ([HOME-C3](#home-c3)), and Dominó meter labels at 1.37:1 ([DOM-8.2](#dom-8-2)).

_Src: web-shell:code#10, home:art-classic#13, catan:art-pixel#11, gap1#6._

<a id="u77"></a>**U77. Screen-reader noise and structure on the home page.** Low · S.
The 8-bit shopkeeper's filler lines are `aria-live` ([apps/web/src/lib/home/PixelStore.svelte:235](../../apps/web/src/lib/home/PixelStore.svelte#L235)), 2–4 random lines per click. The 8-bit home has no `<h1>`, and tiles announce made-up ratings that change every visit (:280). The Codenames rules scene is labelled "Rules" at every step ([games/codenames/src/GuideScene.svelte:6](../../games/codenames/src/GuideScene.svelte#L6)). Fix: drop `aria-live` from `.talk`; add an sr-only `<h1>{m.catalog()}</h1>`; mark tile stars `aria-hidden` (keep the per-visit reroll, which is documented intent); give the Codenames scene the lesson title and frame text; skip the Rulebook `h4` when a chapter has one lesson with the same title.
_Src: web-shell:code#14, home:art-pixel#14, home:art-classic#13._

<a id="u78"></a>**U78. Dominó phone controls are small.** Low · S.
The Pass and Tidy pills are 30 px tall ([games/domino/src/three/Table3D.svelte:503](../../games/domino/src/three/Table3D.svelte#L503)), corners 38 px, and seat roles 9 px. Keep the pills' look and add a hit slop (`.pill::after { inset: -7px -4px }`), make corners 44 px, and set roles to 10.5 px and counts to 12 px. The same hit slop applies to the 8-bit Pass button ([DOM-8.6](#dom-8-6)).
_Src: domino:art-classic#12._

### i18n

<a id="u79"></a>**U79. Server, Catan and Carcassonne errors show in English on the Spanish UI.** Medium · M. Fix with [S8](#s8).
_Src: web-shell:code#9, catan:code#8, carcassonne:code#13._

<a id="u80"></a>**U80. The UNO winner line is concatenated ("Luna ¡gana!"), and the practice name falls back to English "Player".** Low · S.
[games/uno/src/Board.svelte:574](../../games/uno/src/Board.svelte#L574) and :557 build `${name} ${m.uno_won()}`. Make `uno_won` take `{name}` (en "{name} wins!", es "¡{name} gana!"), and localize the fallback name at [apps/web/src/routes/+page.svelte:134](../../apps/web/src/routes/+page.svelte#L134), or show `m.you()` when you win.
_Src: uno:code#10._

<a id="u81"></a>**U81. Spanish Catan mixes voseo and tú, and the practice label ends on a dangling preposition.** Low · S.
About 10 strings use voseo (`catan_help_text`, `catan_hint_*`, `catan_bank_help`, `catan_offer_sent`, `catan_description`) beside tú prompts. `catan_practice` is "Práctica local · Controlás a", with the seat name dropped in a redesign ([games/catan/src/Board.svelte:762](../../games/catan/src/Board.svelte#L762)). Pick one register (tú matches most of the catalog), and write a complete label or pass `{name}`.
_Src: catan:code#13, gap4#7._

<a id="u82"></a>**U82. Carcassonne reuses module names as event and option labels ("Rose · The Gold Mines", a "The Gold Mines (0,0)" button).** Medium · S.
The journal and `optionLabel` call `t(kind)` ([games/carcassonne/src/Board.svelte:1206](../../games/carcassonne/src/Board.svelte#L1206), :559), and `gold`, `magic` and `flight` collide with the module keys. Fix: separate `carc_ev_*` and `carc_opt_*` keys in en and es, past-tense history labels ("Meeple returned"), no `(x,y)` suffix, and a highlight of the target on hover and focus.
_Src: carcassonne:code#3._

<a id="u83"></a>**U83. Codenames history says "Your team's agent" to the opposing team, and "1 agents remaining" has no singular.** Low · S.
[games/codenames/src/Board.svelte:494](../../games/codenames/src/Board.svelte#L494) and :941. Reword `cn_correct_guess` to "Correct" / "Acierto", and add `cn_remaining_one`.
_Src: codenames:code#8._

<a id="u84"></a>**U84. Sushi strings lack singulars, and practice errors print raw keys.** Low · S.
`sgp_saved`, `sgp_hand_count` and `sgp_winners` render "1 desserts saved", "1 cards" and "Winners: Marina". The practice route prints `e.message`, such as `sgp_stale` ([apps/web/src/routes/practice/sushi-go-party/+page.svelte:57](../../apps/web/src/routes/practice/sushi-go-party/+page.svelte#L57)). Add `_one` and `sgp_winner` variants, and translate practice errors through the [S8](#s8) map. The hard-coded "Nigiri × 3" is fine (es also says Nigiri).
_Src: sushi-go-party:code#12._

<a id="u85"></a>**U85. Guide vocabulary differs from the table it teaches.** Medium · S.
English Catan: guide "Lumber/Grain" against table "Wood/Wheat" ([packages/shared/messages/en.json:496](../../packages/shared/messages/en.json#L496)). Spanish Catan: "Arcilla/Cereal" against "Ladrillo/Trigo". Spanish Carcassonne: "Despachos", "Bandidos" and "Círculos de cosecha" against setup's "Los mensajes", "Los ladrones" and "Los círculos de cultivo", and "granjero" against "Campesino". Point CatanScene and the Rulebook dictionary at the `catan_*` resource keys, delete the `library_*` resource keys, and rewrite the `learn_*` strings to the table's terms.
_Src: gap3#8._

<a id="u86"></a>**U86. Spanish practice tables still show English fixture words.** Low · S.
Catan seats Coral, Azure, Pearl and Amber ([games/catan/src/practice.ts:10](../../games/catan/src/practice.ts#L10)), Carcassonne Rose, Azure and Amber ([games/carcassonne/src/practice.ts:6](../../games/carcassonne/src/practice.ts#L6)), and Little Secret's auto-clue "echo" even when built with `es` ([games/little-secret/src/practice.ts:101](../../games/little-secret/src/practice.ts#L101)). Use names that read the same in both languages, as Dominó and Little Secret do, and pick the clue from the practice language.
_Src: gap4#6._

## 6. Art and immersion

Each game has a Classic list and an 8-bit list. Defects come first, then immersion ideas ranked by payoff over effort. "Asset" says how to make it: code (CSS, SVG or synthesized sound, no files), an edit of an existing image, or a new generated image with the prompt documented in the game's art doc. Items already covered above are only linked.

### 6.1 UNO

**Classic**

Defects
1. <a id="uno-c1"></a>**UNO-C1. The Wild colour chooser is covered by the turn pill and, on phones, by the hand.** High · S. `.color-choice` (z 4) lives inside `.center-table`, which has z 2 and a transform, so it can never rise above `.hand-area` (z 3) ([games/uno/src/Board.svelte:879](../../games/uno/src/Board.svelte#L879), :1128, :1214). A Playwright click on "Red" was intercepted by a hand card. Move the chooser to a sibling of `.hand-area` at z 5, or render it in `.turn-row` in place of the pill while the phase is `color`. On phones, dock it as a 4-swatch bar above the hand with 56 px targets, and sink the hand (`translate: 0 30%; opacity: .5`) while choosing. Asset: markup move and CSS.
2. <a id="uno-c2"></a>**UNO-C2. The piles look flat: shadows darken their labels, light directions conflict, and depth never changes.** Low · S. The stock and discard shadows paint over their captions (:1052, :1100), stock edges step right while discard edges step left, and the hand shadow goes left. Every discard sits at 5° over a fake red card (:1119). Use `.pile-group > small { position: relative; z-index: 1 }` and one light (the candle, top-left) with shared `--sx: 4px; --sy: 10px`. Set the stock depth from the public `stockCount` in four buckets of static box-shadow. Give each discard a per-card tilt, and show the previous two tops as real underlays. Asset: CSS.
3. <a id="uno-c3"></a>**UNO-C3. The card back is almost the same picture as the Wild face.** Medium · S. Both are near-black with a four-colour oval rotated 25° (:832, :1039 against :312). Draw backs in deep burgundy `#5a1a1f` with a cream frame, a `repeating-linear-gradient` diagonal lattice and a small cream lozenge mark (not a logo), and the lattice alone on mini-backs. Keep wilds black, so black always means a face. This also removes the jagged conic-gradient edges at DPR 1, and it is the natural moment for the trade-dress step in [B38](#b38). Asset: CSS.
4. Also: the draw scroll ([B2](#b2)), phone layout ([U17](#u17)), hidden counts ([U32](#u32)), the per-card filter and infinite glow ([P13](#p13), [P14](#p14)).

Immersion, ranked
1. <a id="uno-c4"></a>**UNO-C4. A real Classic sound set.** Medium · M. Classic has only a paper swish and the UNO call ([games/uno/src/motion.ts:214](../../games/uno/src/motion.ts#L214)), because `cue()` and `react()` are pixel-only (Board :121, :241). Add `classicCues(audio)` keyed by the existing `Cue` union and route `cue()` by skin. Keep the swish for plays and draws. Add skip (two soft knocks), reverse (a noise sweep up and down), +2/+4 (a lowpass thud plus 2 or 4 riffle ticks 35 ms apart), wild (a soft triangle arpeggio on CHOOSE_COLOR), your turn (a two-note sine chime), win (a major arpeggio) and lose (a falling third). Asset: synthesized with `createAudio()`.
2. <a id="uno-c5"></a>**UNO-C5. Action cards get table effects.** Medium · M. `react()` already classifies skip, reverse, hit and wild (:125), and its `.px-fx` markup is styled only in `pixel.css`. Run it for Classic and add transform/opacity CSS gated by motion: skip stamps a ⊘ disc on the skipped seat (scale 1.5→1, 700 ms), reverse transitions `.flow` (0.45 s, `cubic-bezier(.3,1.4,.5,1)`), +2/+4 shakes the centre ±6 px for 300 ms with a pop on `.penalty`, wild grows a ring in the new colour from the discard, and the "Your turn" pill pops. Fire on landing ([UNO-8.1](#uno-8-1)). Asset: CSS.
3. <a id="uno-c6"></a>**UNO-C6. Round bookends: a deal-in and a result card.** Medium · M. The result overlay is pixel-only (:533), so Classic ends with a pill swap. Add a cream paper result card (`#fbf1dc`, Georgia headline, the winner's monogram with a gold ring, the winning card face up, Rematch and View table) and 24 card-shaped confetti pieces on a win, translate and rotate only. On a round change, fly hand cards in from the stock (`animation-delay: calc(var(--i) * 55ms)`) with one paper tick each. Asset: markup and CSS.
4. <a id="uno-c7"></a>**UNO-C7. Candle light and a "thinking" bot.** Low · S. The painted candle never flickers. Add `.uno-table::after` with hand-written SVGs (`glow-wide.svg` and `glow-tall.svg`, viewBox 1920×1098 and 1080×1919 to line up with the photo under `center / cover`), with warm radial gradients at the candle (about 22% / 6% and 26% / 3.5%) and an opacity loop of .78↔1 over an uneven 3.1 s. On a bot's turn, lift one mini-back 4 px on a 0.9 s loop. Both off when motion is off. Asset: two hand-written SVGs of about 1 KB.

**8-bit**

Defects
1. <a id="uno-8-1"></a>**UNO-8.1. Action effects fire about 0.4 s before the card lands, play under the flying card, and sit off-centre on phones.** High · S. `react()` sets the effect and cue on the revision ([games/uno/src/Board.svelte:124](../../games/uno/src/Board.svelte#L124)), while the 400 ms play flight runs above it at z 100 ([games/uno/src/motion.ts:61](../../games/uno/src/motion.ts#L61)). Measured: skip effect at 14354 ms, landing at 14780 ms, and the 0.36 s shake ends before impact. On phones the ring sits 24 px right, over a seat ([games/uno/src/pixel.css:465](../../games/uno/src/pixel.css#L465)). Add an `onLand(kind)` callback from the play flight's `finish()` (or `later(fn, motionEnabled ? 400 : 0)`), and render `.px-fx` inside `.discard-stack` centred at 50%. Asset: code.
2. <a id="uno-8-2"></a>**UNO-8.2. The north seat's count chip is buried under the discard.** Medium · S. Mateo's chip sits inside the discard's stepped shadow, and `.center-table` paints over seats (:755, :886). Render `.px-count` as a corner badge on `.plate` (this also replaces the phone `left: 76px` hack at pixel.css :937), and lay the north seat's fan beside its plate (`class:north`). Asset: CSS.
3. <a id="uno-8-3"></a>**UNO-8.3. The idle UNO! slab hides the table's sleeping cat.** Low · M. At 1440×900 the cover scaling puts the cat right under `.declare` (pixel.css :669). Swap the bottom corners of `table-wide.webp` so the cat sits bottom-left (keep 640×360, about 40 KB), and restyle the disabled button as an unlit red key. Asset: image edit in Pixelorama or LibreSprite, or regenerate with the prompt changed in [docs/uno-pixel.md](../../docs/uno-pixel.md).
4. Also: phone plates under the stock ([U17](#u17)), idle loops on margin and box-shadow ([P14](#p14)), and the store box ([B38](#b38)).

Immersion, ranked
1. <a id="uno-8-4"></a>**UNO-8.4. Sound for the signature moments.** Medium · S. Arming UNO is silent (Board :617), a 4-card penalty plays one blip, a catch sounds like a draw, and the deal is silent. Add `arm` (click plus a 1319 Hz blip), `caught` (stamp plus a falling run, when the public `catchable` seat gains 2), per-card draw ticks (up to 5 blips, 330→880 Hz, 45 ms apart to match the flights), and soft `deal` ticks on revision 0. Asset: ZzFX and code.
2. <a id="uno-8-5"></a>**UNO-8.5. The victim flinches.** Low · S. Only the pile shakes, and only on hits; skip shakes nothing. Work out the victim from public data (the next turn for +2/+4, the seat after the player for a skip, and in two-player games the other seat). Give its portrait a `steps(3)` ±1 px shake for 0.4 s, appended to its existing animation list, or target the hand if it's you. Fire on landing. Asset: CSS.
3. <a id="uno-8-6"></a>**UNO-8.6. An 8-bit "nope" for unplayable taps.** Low · S. Unplayable cards are `disabled` (:600), so a tap does nothing. On your turn, use `aria-disabled` instead, and exclude it from the lift selectors (touch hover sticks, so a dimmed card would otherwise rise). Add a 240 ms `steps(4)` wiggle and a 147→98 Hz square cue. Asset: CSS and ZzFX.
4. <a id="uno-8-7"></a>**UNO-8.7. A stepped deal.** Low · M. On round revision 0, fly at most 3 backs per opponent plus your 7 cards in roster order, and finish under 700 ms, because bots act 900 ms after start ([apps/server/src/rooms.ts:123](../../apps/server/src/rooms.ts#L123)). Then do a 2-frame flip of the opening discard. Asset: code.
5. <a id="uno-8-8"></a>**UNO-8.8. A two-frame idle loop for the corner props.** Low · M. Only the arrows move today. Draw two transparent 640×360 and 360×640 overlay frames holding only the changed prop pixels (fern, mug steam, the cat's breath) as lossless WebP on `::before` and `::after`, and toggle opacity with `steps(1)` over about 2.4 s. Off when motion is off. Do it after [UNO-8.3](#uno-8-3). Asset: image edit from `table-wide.webp`.

### 6.2 Catan

**Classic**

Defects
1. <a id="cat-c1"></a>**CAT-C1. You can barely tell whose turn it is.** High · S. The active plaque only swaps an inset colour and adds a faint glow ([games/catan/src/Board.svelte:2025](../../games/catan/src/Board.svelte#L2025)). The `.phase` line (:959, z 4) comes before `.hand` (:1601, z 4) in the DOM, so card shadows cover it at 1440×900, and at 1280×720 it is fully hidden. Lift `.phase` above the hand with z 5, or set it as a ribbon on the south plaque. Give `.active` a 2 px gold outer ring and an `::after` glow that pulses by opacity only (off under `.still`). Optionally add a code-drawn turn token that slides between plaques (450 ms transform). Asset: CSS.
2. <a id="cat-c2"></a>**CAT-C2. Winning in Classic is a half-hidden "Amber wins!" and three small sparkles, and Rematch is buried in Settings.** High · M. The result banner is pixel-only (:943), and Catan's props don't accept `canRematch`/`rematch` (:45), though the room passes them. Render the banner in both skins with a skin branch: Classic gets its own crest (code SVG), civilization and points on a parchment scroll (BuildingCosts gradients, ridge border), revealed with `scaleY` and opacity over 600 ms and static under `.still`. Add the host-only Rematch button. On the `win` event, burst resource art from the winner's plaque (WAAPI transforms), with the win sound from [CAT-C8](#cat-c8). Asset: code and CSS.
3. <a id="cat-c3"></a>**CAT-C3. Unicode and emoji stand in where painted art exists.** Medium · M. Transfers render "4♣", "☁", "♨", "▰", "◆", theft renders "▧" ([games/catan/src/effects.ts:363](../../games/catan/src/effects.ts#L363)), flourishes are "▧", "✦ ▧" and "★" (:459, :486), crests are font glyphs (Board :377), and the bank is 🏛 (:1525). These render differently on each OS. Send every transfer through the production token branch (`<img src=resourceArtwork[r]>`). Show theft publicly as a face-down mini card, revealed only to the two players through the private `stolen` event. Add a development deck stack next to BuildingCosts, with `development-compass.webp` as its back, so a purchase flies a card from the deck. Draw crest, award and bank emblems as SVG paths in a new `table/emblems.ts`. Asset: code.
4. <a id="cat-c4"></a>**CAT-C4. All five development cards share one compass face, and the count badge covers the title.** Medium · S–M. Every kind uses `developmentBack` (:1646), and `.development-card .quantity { top: -9px }` (:2514) covers "Victory Po" and "Knigh". Delete that override so the badge sits bottom-right as on resource cards. Optionally give each kind an emblem: transparent 192 px WebPs generated in the resource-atlas prompt style of [docs/games/catan-assets.md](../../docs/games/catan-assets.md), about 12 KB each through `cwebp`, imported with `?url`, with provenance recorded in that doc. Asset: CSS, then optional generated art.
5. <a id="cat-c5"></a>**CAT-C5. The scenery lines up only near 16:10.** Medium · M. The background is `center / cover` (:1846), but reserves, dice bowl and zoom controls are placed in viewport percentages (:2233), so on tablets they float on open water. At 1440×900, 1280×720 and 1920×1080 the zoom controls sit inside the east reserve. Give `.reserve` and `.dice-bowl` their own wooden trays (`var(--wood)`, ridge border, contact shadow), and move `.zoom-controls` to a corner of `.table`. Add a 9:16 portrait variant from the same environment prompt (planks top and bottom, foliage corners, about 900×1600, `cwebp -q 70`) as `tabletop-ocean-portrait.webp` under `(orientation: portrait)`, so phones stop downloading the 372 KB landscape image. Asset: CSS plus one generated image.
6. <a id="cat-c6"></a>**CAT-C6. The robber phase gives no on-board guidance.** Medium · S. Robber targets reveal only on hover (:1433, :2219), so touch players see none. The Classic preview is a grey arch rather than the lacquered pawn (:695), and a rolled 7 has no moment of its own. Reveal ghosts whenever MOVE_ROBBER is legal, reuse the robber markup as a snippet for the ghost and preview at about 0.55 opacity, and on a 7 lift the robber 14 px for 400 ms under a fading dark vignette. The `#i` labels go with [U69](#u69). Asset: code.
7. <a id="cat-c7"></a>**CAT-C7. Harvest counts update before the token arrives, and your tokens fly to the plaque instead of your hand.** Medium · M. Tokens fly to `seat(event.to)` with a delay ([games/catan/src/effects.ts:358](../../games/catan/src/effects.ts#L358), :399), while card quantities render `priv.hand` at once. Keep a presentation-only `inFlight` array in Board, filled when effects start and decremented through an arrival callback. Render `priv.hand[i] - inFlight[i]` on cards only, aim your own tokens at the matching card, and pop its badge on arrival. Drop the unused `dataset` writes. Asset: code.
8. Also: hidden card footers ([R14](#r14)), phone legibility ([U23](#u23)), index labels and missing pips ([U69](#u69), [CAT-C11](#cat-c11)), and the filters that block ambient motion ([P13](#p13)).

Immersion, ranked
1. <a id="cat-c8"></a>**CAT-C8. A Classic sound palette.** Medium · M. Classic has three cases: a placement thud, five roll clacks, and one quiet tone for everything else, so harvest, robber, theft, cards, awards, your turn and victory all share one blip ([games/catan/src/effects.ts:579](../../games/catan/src/effects.ts#L579)). Extract the event-to-cue dispatch from the 8-bit pack and add a `classic(audio)` pack. Use a wooden tok plus card slide per harvest (recipient only), a low thump and falling third for the robber, a swish for theft, a flip sweep for a purchase, a soft horn for a knight, a marimba for an award, an arpeggio with timpani for a win, and a two-note knock when the turn passes to you. Build the throw plan once, so harvest cues land with the tokens. Asset: synthesized.
2. <a id="cat-c9"></a>**CAT-C9. Dice that sound like the throw.** Medium · S. The clacks follow a fixed pattern that ends by 456 ms on a tap roll that lands at about 930 ms ([games/catan/src/effects.ts:588](../../games/catan/src/effects.ts#L588)). Have `diceThrow` return `impacts: {t, speed}[]`, and schedule one clack per impact with volume set by speed. While charging, play a cup rattle (bandpass noise bursts every 90→45 ms as the charge rises) and jitter the button 1–2 px. Asset: synthesized.
3. <a id="cat-c10"></a>**CAT-C10. Ambient life kept outside the SVG.** Low · S. The Classic table has no `@keyframes`. Add a `.catan::before` sun-glint layer (two soft radial gradients at opacity .12–.2) that drifts over 24 s, and two code-drawn gulls crossing about every 45 s. Bob the harbors (1.5 px, 5 s, staggered) only after [P13](#p13) removes the SVG drop-shadows, because motion inside the filtered SVG re-rasterizes the island. Pause under `.still`. Asset: CSS and SVG.
4. <a id="cat-c11"></a>**CAT-C11. Probability pips on Classic number tokens.** Low · S. Add 1–5 pips under the number (r 1.2 at y + 10, red for 6 and 8), mirroring `pixelToken` (:632). Asset: SVG.

**8-bit**

Defects
1. <a id="cat-8-1"></a>**CAT-8.1. Each hex's measured rect covers the whole terrain strip, so tokens and the robber launch from the wrong tiles.** High · S. Each `<g data-hex>` holds a nested SVG with the full 6-tile sheet ([games/catan/src/Board.svelte:1078](../../games/catan/src/Board.svelte#L1078)), so every rect is 697 px wide against a 112 px tile, with centres up to 290 px off. The robber leaps from open sea, and "+1 Wood" spawns beside its forest. Measure tiles by their ring (`hex(id)?.querySelector('.px-glow')`) in [games/catan/src/effects.ts:333](../../games/catan/src/effects.ts#L333) for the robber, production source and placement nudge. Send your own deliveries to the matching hand card with a 2-frame 1 px hop. At 700 px or less, use the 1× 32 px token with 16 px text. Asset: code.
2. <a id="cat-8-2"></a>**CAT-8.2. The bottom-row harbor rates are hidden under the south plaque.** High · S. The badges sit under the boat (:1236), so at 1280, 1440 and 1920 px the three south rates fall behind the plaque. For harbors whose outward normal points down, draw the badge and 2:1 icon beside the hull (±25 P away from the vertical axis, at hy − 12 P, snapped to P). Check at all three widths. Asset: code.
3. <a id="cat-8-3"></a>**CAT-8.3. Disabled buttons and empty cards turn translucent, so table art shows through the chrome.** Medium · S. `opacity: .5` and `.62` ([games/catan/src/pixel.css:60](../../games/catan/src/pixel.css#L60), :461) let the map, rope and compass bleed through. Use opaque dim colours (`#3b2a1e`, text `#9b8768`, and darker End turn and Buy development variants), and dim only the art inside empty cards. Asset: CSS.
4. <a id="cat-8-4"></a>**CAT-8.4. Placement ghosts vanish on same-hued terrain, and robber targets are only "#n" labels.** Medium · S. Ghosts are seat-coloured sprites at .55 opacity (pixel.css :237), so orange roads disappear on wheat. Swap the ink key to cream `#fff3cb` so ghosts read as outlined silhouettes, and blink `.revealed` between .35 and .85 with `steps(2)` over 0.9 s (held at .7 under `.still`). Reveal robber ghosts while MOVE_ROBBER is legal, and name the target by its number in Confirm. Asset: code and CSS.
5. <a id="cat-8-5"></a>**CAT-8.5. Icons and effect glyphs fall back to system fonts.** Medium · M. Jersey 10 is subset to Latin-1, so ← ▤ ◎ ⚙ ▶ → 🏛 and ♣ ☁ ♨ ▰ ◆ ▧ ★ ✦ render smooth and anti-aliased. Use the shared `PixelIcon` grids ([S9](#s9)), the 32 px resource cell for trade and monopoly tokens, `cards.webp` cell 5 for theft, and crest award cells for flourishes. Asset: code-drawn grids.
6. <a id="cat-8-6"></a>**CAT-8.6. Below about 1240 px the dice overflow the tray, and cost icons overflow their card.** Medium · S. The root cause is `.dice-bowl .dice { transform: none }` (pixel.css :296), which cancels Classic's `scale(.6)` for 701–1400 px. For 701–1240 px, set `--size: 36px` with 6 px pips. Hide `.plus` at 1100 px or less, use the 16 px `resources-small.webp` at 1× there, and use a fixed 32 px (1×) at 1280 px and up instead of a `2vw` clamp. Asset: CSS.
7. Also: civilization name contrast ([U76](#u76)), the win jingle ([B37](#b37)), and the `.pyc` ([R4](#r4)).

Immersion, ranked
1. <a id="cat-8-7"></a>**CAT-8.7. Card draws, plays and thefts get a reveal.** Medium · M. Private `drawn` and `stolen` events are sent ([games/catan/src/presentation.ts:106](../../games/catan/src/presentation.ts#L106), :170) but never read. Pass `view.private.events` to `playEffects`. For a draw, pop a 64 px card back from the bank, flip it with a stepped `scaleX` 1→0→1 to the drawn cell, and drop it into its stack. For public plays, pop the card art above the player's plaque. For thefts, thief and victim see the resource with +1/−1 and everyone else sees the back. Asset: existing `cards.webp`.
2. <a id="cat-8-8"></a>**CAT-8.8. A rolled 7 and your own turn get their own beats.** Medium · M. The roll cue ignores the sum, and the turn cue is one ping for every seat that plays only when nothing else does ([games/catan/src/pixel/sound.ts:36](../../games/catan/src/pixel/sound.ts#L36), :109). On a 7, play the robber's descending steps after the landing clacks, give the robber a 2-frame hop, and outline plaques holding more than 7 public resources in stepped red. On your turn, play a 3-note rising jingle and drop a stepped "Your turn" ribbon above the phase line; others keep the soft ping. Add square blips at 25, 50, 75 and 100% charge. Asset: ZzFX and CSS.
3. <a id="cat-8-9"></a>**CAT-8.9. A living sea and a dressed dice tray.** Low · M. The only ambient loop is the boat bob ([games/catan/src/pixel.css:213](../../games/catan/src/pixel.css#L213)), and the tray is a flat green square until the first roll. Add a 2-frame foam lap (a second foam path, toggled by `steps(1)` about every 1.4 s), 6–8 `box-shadow` pixel sparkles that blink by opacity, and, until the first roll, a 2×2 checker and a dice-cup grid drawn in `sprites.ts`. Add the new classes to the reduced-motion list (:879). Repainting the half-hidden painted ship is optional. Asset: code.

### 6.3 Carcassonne

**Classic**

Defects
1. <a id="car-c1"></a>**CAR-C1. The end screen has an unreadable journal button, a see-through card and a cropped board.** High · S. The "Table journal" button is dark on dark (`color: inherit`, [games/carcassonne/src/Board.svelte:2161](../../games/carcassonne/src/Board.svelte#L2161), and `.finished { color: #433923 }` :2786). The card is translucent (`#fff1caee`, :2783), so 9 stacked receipts show through. The camera keeps the play view with half the board under the header, and the last player's plaque stays `.active` (:1277). Style `.finished button` as parchment, make the card opaque, call `fit()` once on finish and dock the card in the lower third so the finished landscape is the trophy. Skip the receipt column on finish and list each player's points by source (from `scoreSources` in `overview.ts`) in seat-coloured rows, with the winner's FigureSprite on a CSS plinth. Gate `.active` on the phase. Asset: CSS and markup.
2. <a id="car-c2"></a>**CAR-C2. The hovered tray meeple sits in a brown button box.** Medium · S. The global `button:hover:not(:disabled):not([aria-disabled='true'])` (:2174, specificity 0,3,1) beats `.loose-meeple:hover` (:2603, 0,3,0), and on touch the hover sticks. Raise the piece rule (`button.loose-meeple:hover:not([aria-disabled='true'])`, which ties and wins by source order, and the same for `.attachment`). Don't weaken the global rule with `:where()`. Optionally fade in a seat-coloured ground ellipse under the lifted figure. Asset: CSS.
3. <a id="car-c3"></a>**CAR-C3. Chess pieces and stray Unicode stand in for figures and goods.** Medium · M. ♟ for meeples and robbers, ♛ for the large meeple, ♞ for the pig, ♜ for a city, ♨ (an emoji on iOS and Android) for grain, ♧ for wine and ▧ for cloth (:471–516, [games/carcassonne/src/TileArt.svelte:368](../../games/carcassonne/src/TileArt.svelte#L368), :424). Use the real figure (`<svg viewBox="-16 -18 32 33"><FigureSprite/></svg>`, as the plaques do) for setup chips, overview seats and guide figure cards. Add a code-drawn `ClassicIcon.svelte` (wine jug, wheat sheaf, cloth bolt, tower, road, wing), mirroring PixelIcon. Asset: code-drawn SVG.
4. Also: gold badges under scenery ([U38](#u38)), the seat marker and setup chrome ([U41](#u41)), confirm controls ([U29](#u29)), figure tint filters ([P13](#p13)), and oversized sprites ([P7](#p7), [R7](#r7)).

Immersion, ranked
1. <a id="car-c4"></a>**CAR-C4. Score at the feature, not in a floating toast.** High · S. Classic receipts float at `top: 18%` with no seat colour (:1164, :2757), although `receipt.at` is already computed for each one (:601) and used only by the 8-bit pop. In Classic, place an HTML pop at `screen(receipt.at)`: a wax-seal disc (a radial gradient in `var(--seat)`, a brass ring, Marcellus "+N") that rises 28 px and fades over 1.4 s, staggered 140 ms. Keep the toast text visually hidden for `aria-live`. Key `.player-score` on its value for a 300 ms `scale(1.12)` tick with a gold text-shadow. For `return` events, fly a FigureSprite from the feature to the owner's plaque. Static under reduced motion. Asset: CSS.
2. <a id="car-c5"></a>**CAR-C5. Tiles land with weight, and stop replaying during scoring.** Medium · S. `recent` takes every event with a target (:609), so placing a meeple or scoring replays `land` on old tiles, and the keyframe animates only `.tile-surface` (:2679), so trees and houses don't move with it. Trigger landing only for `place` targets. Drop the whole tile group from `lift(16)` with the CSS `translate` property over 280 ms with a 2% squash while the shadow grows. Add 4 CSS dust puffs, and drop meeples 10 units with a small bounce, reusing the unused `@keyframes appear` (:3630). Asset: CSS.
3. <a id="car-c6"></a>**CAR-C6. Legal meeple spots show the figure that will stand there.** Medium · S. The only cue is a faint dashed cream ring (:1069). While a figure is picked or carried, draw an upright ghost FigureSprite in your colour at 40% at each legal spot, over a ring with a dark `#1b1409` under-stroke. Pulse the ghost's opacity between .3 and .55, bring the nearest to full opacity within drop range, and tint rings by region kind. Asset: code.
4. <a id="car-c7"></a>**CAR-C7. Sounds with material, plus a "your turn" cue.** Low · S. Every cue is bandpass noise with q 0.55 ([games/carcassonne/src/effects.ts:90](../../games/carcassonne/src/effects.ts#L90)), so wood, paper and gold differ only in pitch, and `score` and `final` are identical (:27). Pass a per-cue q of 1.5–6 (the shared `audio.noise` already takes it). Add `turn` (a draw event for you, outside practice), `slip` on a failed drop, a distinct descending `final` and a longer `win`. No ambient bed, which [docs/games/carcassonne.md:96](../../docs/games/carcassonne.md#L96) rules out. Asset: synthesized.
5. <a id="car-c8"></a>**CAR-C8. A portrait table for phones and a static light pool.** Low · M. `table.webp` (1672×941) is cropped to about 26% of its width on phones: bare planks, no lantern or book. Add a `table-portrait.webp` (about 1080×1920, made with the Codex flow in [docs/carcassonne-3d/README.md](../../docs/carcassonne-3d/README.md)) under `(max-aspect-ratio: 3/4)`, and one static radial vignette over `.map` that darkens the far corners. Skip flicker and cloud animation. Asset: one generated image and CSS.

**8-bit**

Defects
1. <a id="car-8-1"></a>**CAR-8.1. Farmers and their pigs are drawn as 75°-rotated pixel sprites.** Medium · S. [games/carcassonne/src/Board.svelte:1045](../../games/carcassonne/src/Board.svelte#L1045) rotates field figures in both skins, which jaggies the pixels, turns the pig into a second blue meeple, and hangs the pair off the tile edge. In 8-bit only, drop the rotate. Give `farmer` its own `figureImage` cache key, drawn into an h×w canvas with `translate(h, 0); rotate(Math.PI / 2)` (lossless). Render the attachment upright outside the rotated group, lifted about 4 units. Asset: code.
2. <a id="car-8-2"></a>**CAR-8.2. The field guide and setup use chess and dingbat glyphs.** Medium · M. In 8-bit, render figure symbols as FigureSprite with `pixel` and a cream fill in setup, the guide and `chip-meeple`. For modules, extend PixelIcon ([S9](#s9)) to accept the `bitmaps.ts` names (gold, magic, robber, flight, crop, wine/cloth, shield) and hand-set river, message, ferry and farmers grids. Use the lying farmer from [CAR-8.1](#car-8-1). Asset: code.
3. <a id="car-8-3"></a>**CAR-8.3. The table texture is scaled by a non-integer factor.** Low · S. The 384×216 `table.webp` is drawn with `center / cover` ([games/carcassonne/src/pixel.css:104](../../games/carcassonne/src/pixel.css#L104)), which is 4.17× at 1440×900, so wood pixels come out 4 and 5 px wide. Use fixed sizes, `center / 1536px 864px no-repeat` with media steps to 1920×1080 and 2304×1296, and the base colour `#5b3620` to fill the rest. Asset: CSS.
4. <a id="car-8-4"></a>**CAR-8.4. "Victoria compartida" overruns the ribbon's folded ends at every width.** Low · S. The ribbon has a fixed pixel width (pixel.css :673, :943, :978). Shorten es `carc_winners` to "Empate", or build the ribbon as a pixelated 9-slice `border-image` from `banner.webp` with `width: max-content`. Asset: copy, or CSS over the existing sprite.
5. Also: setup CTA ([U30](#u30)), phone tray ([U29](#u29)), endless blink ([U75](#u75)), and the gatehouse ([R7](#r7)).

Immersion, ranked
1. <a id="car-8-5"></a>**CAR-8.5. Victory shows the finished countryside.** Medium · M. The result panel covers the middle of the map and clips the final "+3" and "+7" pops, and the last seat keeps blinking as active. Gate `class:active` on the place and decision phases. Set a `revealed` flag after the existing 2.4 s receipt timer, show `.finished` only then, and call `resetCamera()`. Dock `.finished` at the bottom like the tray, with seat colour on each row. Optionally add the winner's FigureSprite on the banner and loop `burst.webp` frames under `.motion`. Asset: code and existing sprites.
2. <a id="car-8-6"></a>**CAR-8.6. Chiptune gaps: invalid drops, pickups and your turn are silent, and every score sounds the same.** Low · S. Every `score` plays one arpeggio, and `events()` squeezes a batch into 0.5 s, so final scores and the win fanfare overlap ([games/carcassonne/src/pixel/sound.ts:90](../../games/carcassonne/src/pixel/sound.ts#L90), :111). Add `nope` (failed drop, or a rotation into a mismatch) and `lift` (drag start). Play `tune([659, 988])` when the draw event is yours. Scale the arpeggio with points (one note per 4, max 7), with a wave per feature type. Space finals 0.15 s apart and schedule the win after the last one. Do it on top of [S4](#s4). Asset: ZzFX.
3. <a id="car-8-7"></a>**CAR-8.7. Each turn starts with a visible draw.** Low · S. The tray tile is keyed only on rotation (Board :1589), so a new tile swaps in without motion. Key the pixel TileArt on `p.remaining` and add `.px-deal { animation: cc-deal .3s steps(3) }`. The `.own-tile` already has a 3-step stacked edge; deepening it by remaining count is optional. Asset: CSS.
4. <a id="car-8-8"></a>**CAR-8.8. Rivers and lakes glint.** Low · M. In 8-bit, water is baked into the static raster ([games/carcassonne/src/pixel/atlas.svelte.ts:153](../../games/carcassonne/src/pixel/atlas.svelte.ts#L153)), while Classic animates it. For river and lake tiles only, rasterize a transparent 128² glint layer (bright texels of the water texture offset by 2,1), and toggle its opacity with `steps(1)` every 1.2 s under `.motion`, staggered per tile. About 2 ms per river tile. Asset: code.
5. <a id="car-8-9"></a>**CAR-8.9. Scored meeples visibly go home.** Low · M. Figures unmount in the same frame as a `return` event. Keep a short `returning` list, and draw each at its node with a `steps(4)` hop up 8 px, then fade. Flash the scoring seat's plaque with a seat-colour inset (`steps(3)`, 0.6 s). Receipts already show the numbers. Asset: CSS.
6. <a id="car-8-10"></a>**CAR-8.10. A little light on the bare planks.** Low · M. The calm, prop-free table is deliberate ([docs/carcassonne-pixel.md](../../docs/carcassonne-pixel.md)), and by mid-game the board fills the view. If wanted, bake a 2-step ordered-dither darkening into the table edges with Pillow. A lazily loaded `pixel/props.webp` (10 KB or less: a candle and a tile box at the far corners, 1201 px and up only) is a later option. Asset: image edit.

### 6.4 Azul

**Classic**

Defects
1. <a id="az-c1"></a>**AZ-C1. The first-player marker's "1" is navy on navy.** Medium · S. `.tile` sets `color: var(--motif)` ([games/azul/src/Tile.svelte:62](../../games/azul/src/Tile.svelte#L62)), the marker motif is `#15364c` ([games/azul/src/palette.ts:8](../../games/azul/src/palette.ts#L8)), and `.marker` paints `#08263d` (Tile :82). The palette's cream glaze is never used. Give `.marker` the cream background with the navy "1", or keep the disc and set `color: #e9cf96`. Raise `.center-marker` to 32 px. Asset: CSS.
2. <a id="az-c2"></a>**AZ-C2. The board and score rail are stretched, and each factory plate carries a baked checkerboard crescent.** Medium · S. `board-blank-v3.webp` (1360×500) is drawn `object-fit: fill` into 760×350 and into 378×350 on the phone tray ([games/azul/src/PlayerBoard.svelte:639](../../games/azul/src/PlayerBoard.svelte#L639)), and the rail is filled the same way (:841). `factory-plate.webp` is RGB with fake-transparency checker pixels. Draw the board as a 9-slice (`border-image: url(board-blank-v3.webp) 124 fill / 46px round`), so corner medallions stay square, and slice the rail's ends the same way. Re-export the plate as RGBA ([AZ-C4](#az-c4)); until then use `clip-path: circle(47% at 50% 48%)`. Asset: CSS, then the re-export.
3. <a id="az-c3"></a>**AZ-C3. Props are translucent ghosts under plates and boards.** Medium · S. The chest prop (opacity .76, [games/azul/src/Board.svelte:2203](../../games/azul/src/Board.svelte#L2203)) lies under the top-right plate and an opponent board, and the lantern under another board. Make props opaque and place them in free space (the lantern fits at the left mid-edge, x < 240, y 260–560). Reuse `tile-chest.webp` as the real discard box beside the bag, carrying `data-azul-location="discard"` and its count plaque, so cleanup flights drop into an object instead of a text label. Asset: CSS and markup.
4. <a id="az-c4"></a>**AZ-C4. One PIL re-export pass from the committed sources.** Medium · M. In one script in `games/azul/scripts`: tiles at about 160 px with a baked contact shadow (replaces the per-tile filter in [P13](#p13)), a pre-faded wall-guide sprite, `factory-plate` at 256² as RGBA with a circular alpha mask at the gold rim, the score rail at about 1600 px wide, and prop and bag shadows baked in. Then [R3](#r3) can move the sources out of the repo. Asset: Pillow script.
5. Also: the laptop layout ([U20](#u20)), the confirmation panel ([U44](#u44)), the legend ([U43](#u43)), opponent boards ([U45](#u45)), the 4-player status ([U42](#u42)), and phones ([U22](#u22)).

Immersion, ranked
1. <a id="az-c5"></a>**AZ-C5. Landing, scoring and victory motion in Classic.** Medium · M. Board, PlayerBoard and Tile have no transitions or keyframes. Flights are a straight translate with a fade ([games/azul/src/effects.ts:166](../../games/azul/src/effects.ts#L166)), the score marker jumps through inline `left` (PlayerBoard :224), "+N" pops render only in 8-bit (:170), and `az-reduced` is set only for 8-bit (Board :517). Give the Classic keyframes a midpoint lift (14 px, scale 1.06) and a small landing overshoot. Show brass "+N" chips that rise and fade over 600 ms, with a 1.12→1 pulse on `.scored`. Transition the marker's `left` over 450 ms, as 8-bit does. Add a winner border and ribbon and staggered ledger rows. Set `az-reduced` for both skins and turn all of it off there. Asset: CSS.
2. <a id="az-c6"></a>**AZ-C6. A ceramic sound pack.** Medium · M. The Classic sound is a 110 ms sine at about 0.03 gain (effects.ts :72), played for three kinds of event, and every `audio.chip` call site is silent in Classic (Board :259, :265, :431, :464). Implement the `PixelSounds` interface for Classic so those call sites drive both skins:
   - clack: bandpass noise at 3.2 kHz, q 4, 18 ms, plus a sine 2.4→1.9 kHz over 40 ms
   - spill: 2–3 softer clacks 35 ms apart
   - refill: a lowpass bag rustle (900→300 Hz, 260 ms), then clacks
   - penalty: a sine thud 180→90 Hz
   - score: pitch rising with points
   - bonus and win: a 3-note bell
   - your turn: a soft chime

   Use a gain of about 0.12, and update motion.md's "no new voices" line. Asset: synthesized.
3. <a id="az-c7"></a>**AZ-C7. A centre pool with a focal point, and hover that previews the whole take.** Low · S. Empty centre colours render as dark smudges (Board :1404, Tile :89), the CENTER label is 8 px, and hover tints one tile while a pick takes every tile of that colour from that factory. Draw an oval felt inlay with a 1 px brass ring (optionally a faint inline star) behind `.center`. Hide absent clusters with `opacity: 0` so flight anchors keep their box. Set the label to 11 px. Add `data-color` to factory tile buttons and lift every same-colour tile in the hovered factory with `:has(button[data-color=X]:hover)`, using a box-shadow rather than a filter. Asset: CSS and SVG.

**8-bit**

Defects
1. <a id="az-8-1"></a>**AZ-8.1. Your own board's tiles are drawn at 2.125×, so pixels are uneven.** High · S. [games/azul/src/PlayerBoard.svelte:715](../../games/azul/src/PlayerBoard.svelte#L715) resets `--tile: 34px` on the desktop mosaic, overriding the 32 px from [games/azul/src/pixel.css:378](../../games/azul/src/pixel.css#L378), so 16 px sprites draw at 2.125× while factories are crisp 2×. Add `&:not(.compact) .mosaic { --tile: 32px }` in the 8-bit `.player-board` block; the 44 px rows keep the layout, and flights become exact 2×. On phones, draw the factory plate at 1× (63 px with a −3.5 px margin) and the medallion at 16 or 32 px instead of 24 (pixel.css :1217). Asset: CSS.
2. <a id="az-8-2"></a>**AZ-8.2. The score medallion sits up to 40 px off the track ticks.** Medium · S. The marker uses Classic's 85 px inset (PlayerBoard :224, :853), but 8-bit insets the ticks by 40 px (pixel.css :602), so 99 sits on "90" and 16 on "20". Set `.rail-ticks { inset: 2px 10.4% }` on desktop and in the 900 px block (:1213). Optionally drive the badge from the same `--az-score` counter so it counts up with the header. Asset: CSS.
3. <a id="az-8-3"></a>**AZ-8.3. The discard lid shows a pile of tiles at "0 tiles", and those tiles are off-scale.** Low · S. `lid.webp` is always drawn (pixel.css :287, :779), and its baked tiles are about 6 px wide and rotated. Make a `lid-empty.webp` (48×48, teal felt painted over the tiles, same palette) and set `data-filled={visual.discardCount > 0}`. For real tiles in the lid, use 1–3 child `<i class="px-tile">` elements, since a background layer of `tiles.webp` would paint the whole sheet. On phones, draw the lid at 24 px to match the 30 px bag. Asset: image edit in Pixelorama or LibreSprite.
4. <a id="az-8-4"></a>**AZ-8.4. Dialogs fall back to web UI: a green hover block, rounded vector rule scenes, and native round controls.** Medium · M. The global `button:hover:enabled { background: #35664f }` ([apps/web/src/app.css:37](../../apps/web/src/app.css#L37); fixed globally in [HOME-C1](#home-c1)) turns the example toggle into a green box. HelpScene draws rounded rects in the Classic palette ([games/azul/src/HelpScene.svelte:9](../../games/azul/src/HelpScene.svelte#L9)). Settings shows native slider, radio and checkbox. The sound setting still says "Ceramic sounds" (en.json :1014). Read `skinKey` in HelpScene and use `rx = 0` with the pixel palette (the catalog guide falls back to Classic). Style the controls with `appearance: none`, square brass thumbs and `--px` borders. Add an en/es "Chiptune sounds" label. Asset: CSS.
5. <a id="az-8-5"></a>**AZ-8.5. Row 1's dashed border strikes through "PATTERN LINES", and row 5 has no number.** Low · S. Move `.board-labels` up 6 px (or add margin above the first pattern) so the legal border clears it ([games/azul/src/pixel.css:471](../../games/azul/src/pixel.css#L471)). Re-show the row-5 number on desktop only (PlayerBoard :365). Asset: CSS.
6. Also: the heading plaque over factories ([U42](#u42)), the missing focus ring ([U63](#u63)), Classic art downloads ([P2](#p2)), and phone opponent cards ([U22](#u22)).

Immersion, ranked
1. <a id="az-8-6"></a>**AZ-8.6. A "your turn" cue.** Medium · S. The cue union has no turn cue ([games/azul/src/pixel/sound.ts:4](../../games/azul/src/pixel/sound.ts#L4)), and your board's active state is a static outline. Add `turn()`: two triangle notes, 784 then 1175 Hz, 60 ms each, volume 0.6, played when `active` switches to you during drafting and nothing is animating. Blink the own board outline and the opponent heading 3 times with `steps(1)`; it runs on its own each time the class lands, and `az-reduced` turns it off. Asset: ZzFX and CSS.
2. <a id="az-8-7"></a>**AZ-8.7. Floor penalties get an on-board pop, and the sweep into the lid ticks.** Low · S. `+N` pops render only for wall gains (PlayerBoard :170), and the cleanup flights carry no sound (effects.ts :55). Pass your penalty events to PlayerBoard and render `<b class="px-gain px-loss">−{deduction}</b>` over the floor, reusing `az-gain` in `--az-red`. Add a quiet `discard()` tick at about 0.5 volume, at the end of the first flight to the lid, after the penalty buzz. Asset: CSS and ZzFX.
3. <a id="az-8-8"></a>**AZ-8.8. The palace's lanterns glow.** Low · M. Nothing moves at idle, and the table's `::before` and `::after` are free (pixel.css :93). The raw `palace.png` isn't in the repo, so add a `glow` mode to `pixel-art.py` that reads the committed `palace.webp` (480×270), keeps the warm high-luminance lamp pixels plus a 1 px halo, and writes a lossless `palace-glow.webp`. Animate it on `::before` with stepped opacity keyframes (1, .7, .9, 1), not a hard blink. Add `.az-reduced::before { animation: none }`. Add the fountain layer only if the first reads well. Asset: Pillow script from the shipped image.
4. <a id="az-8-9"></a>**AZ-8.9. Victory gets a tile shower.** Low · M. Today the finish is a static dialog with a text ★. Add an `aria-hidden` shower span (`container-type: size`, `overflow: hidden`) behind the plaques, with 12–16 `tiles.webp` sprites falling once over 2.4 s with `steps(12)`. Use cqh units, because `translate` percentages resolve against the sprite itself. Blink the winner's brass ring twice. Hidden under `az-reduced`. Asset: existing sprites.

### 6.5 Codenames

**Classic**

Defects
1. <a id="cn-c1"></a>**CN-C1. Only two agent pictures per team, picked by index parity, so identical agents sit side by side.** Medium · S. `cardArt` picks `${identity}-${index % 2 ? 'b' : 'a'}` ([games/codenames/src/Board.svelte:162](../../games/codenames/src/Board.svelte#L162)), so each image appears 4–5 times per board, and the 7 civilians share 2 images. Quick fix: choose the variant from `index % 4`, and for 2 and 3 mirror `.cover-art` (`scaleX(-1)`, `object-position: center 55%`); the art has no text, so mirroring is safe. Better: generate `red-c/d`, `blue-c/d` and `bystander-c` with the Classic prompt in [docs/codenames-pixel.md](../../docs/codenames-pixel.md) (same style line, new characters), centre-cropped to 480×320 WebP at 30 KB or less in `cards/classic/`, and add matching 8-bit names or a fallback. Asset: CSS now, generated art later.
2. Also: identity shown by colour only ([U70](#u70)), the clue animation on the wrong entry ([B24](#b24)), covers fetched at reveal ([P8](#p8)), small phones ([U19](#u19)), and the unused props ([R5](#r5)).

Immersion, ranked
1. <a id="cn-c2"></a>**CN-C2. The game-ending reveal becomes visible.** High · M. `open('result')` runs in the same tick the phase becomes finished (:418), and the dialog backdrop blurs the board (`blur(5px)`, [games/codenames/src/tokens.css:925](../../games/codenames/src/tokens.css#L925)), so the assassin drop and the full-key reveal happen behind it. Unless motion is reduced, delay the dialog by about 1100 ms (a timeout cleared in the effect cleanup). On `gameFinished`, flip the newly public key cards in with the existing `animate()` (opacity .3→1, −4 px→0, 40 ms stagger). Style `.winner` with the winning team's panel fill and an `<img>` of existing art (`red-a`/`blue-a`, or `assassin.webp` when the reason is the assassin), and pulse the winning team status. Asset: existing art and CSS.
2. <a id="cn-c3"></a>**CN-C3. A soundscape you can hear.** High · S. The reveal cue is a 150→75 Hz sine at 0.04 gain ([games/codenames/src/effects.ts:7](../../games/codenames/src/effects.ts#L7), :21), which most phone and laptop speakers barely reproduce, and every identity shares it; a win and an assassin loss share `finish`. Build cues from `createAudio()` noise and tone, following Carcassonne's effects. Reveal is a paper slap (bandpass 1800→700 Hz, 70 ms) plus a tail chosen by the public identity:
   - own agent: a rising triangle, 660→880 Hz
   - civilian: a dull 220 Hz
   - opponent: a falling 330→247 Hz
   - assassin: a lowpass boom and a falling tritone

   Also add a clue paper slide, a soft two-tone turn chime, deal ticks and a win arpeggio, at a gain of about 0.12. Revise [docs/games/codenames.md:63](../../docs/games/codenames.md#L63). Asset: synthesized.
3. <a id="cn-c4"></a>**CN-C4. The active clue becomes a paper slip in the turn banner.** Medium · M. Operatives' key information is 15 px text with a 10 px hint, left-aligned in the action bar, with End turn pushed far right (tokens.css :524, :656). Render the clue with the card paper and shadow, the word in condensed caps at about 1.75 rem (1.25 rem compact), and the count in a stamped team-colour circle. On `clueSubmitted`, drop it in with `translateY(-14px) rotate(-3deg)`, opacity 0, over 280 ms; this also gives compact layouts the arrival feedback that [B24](#b24) lacks. Keep "guesses left" at .8125 rem, raise the hint to .75 rem, and drop `flex: 1` so End turn sits beside the slip. Asset: CSS.
4. <a id="cn-c5"></a>**CN-C5. The table visibly passes to the other team.** Medium · S. The root sets `data-active-team` (Board :626), but no CSS uses it, so both team panels look the same on every turn. Under `[data-active-team=red] .team-status.red`, fade in a ring (`0 0 0 2px #ff9587aa, 0 0 28px #c93a2f55`) on a pseudo-element over 400 ms and dim the other panel to .8. Cross-fade two static radial washes on `.cn-table::before` (red from the left, blue from the right). No transitions in `.reduced`. Asset: CSS.
5. <a id="cn-c6"></a>**CN-C6. Picking a card feels like putting a finger on it.** Low · S. Hover is a 2 px nudge with no shadow change (tokens.css :698), there is no selected style, and the confirm backdrop blurs the chosen card away. Lift 3 px on hover with a deeper shadow layer that fades in. Add `.dossier.selected` at −6 px with −1° rotation and a focus ring. Drop the blur on the confirmation backdrop (`#120c0870`). Style `.chosen-word` as an uppercase mini paper card. Asset: CSS.
6. <a id="cn-c7"></a>**CN-C7. The setup lobby uses team materials.** Low · S. Setup is a smoked-glass box where teams differ only by a 3 px top border (tokens.css :843). Give each `.team-panel` the same paper and panel fill as `.team-status`, head it with a 72 px strip cropped from `red-a`/`blue-a`, and seat players as paper name tags. Asset: existing art.
7. <a id="cn-c8"></a>**CN-C8. One warm light pool.** Low · S. Add a static `.cn-table::before` at z −1, with a warm radial pool on the board (`#ffe2b014` fading out at 60%) and a corner vignette (`#0a050255`). No filter, no motion. Don't re-seat the props, which 7bd9576 removed on purpose. Asset: CSS.

**8-bit**

Defects
1. <a id="cn-8-1"></a>**CN-8.1. Hovering a word card turns its paper face wood-brown.** High · S. `.cn-table-tokens.cn-pixel button:enabled:hover { background-color: #9c6a3c }` ([games/codenames/src/pixel.css:29](../../games/codenames/src/pixel.css#L29), specificity 0,4,1) beats `.dossier` (0,3,0). Every hover during guessing looks like a different card identity. Scope it with `button:not(.dossier)`, or set `background-color: var(--face)` on the card hover. Show hover as a 3 px lift plus a hard gold ring (`0 0 0 var(--px) var(--px-gold)`) with `steps(2)`. Asset: CSS.
2. <a id="cn-8-2"></a>**CN-8.2. The cover drop rotates, scales and fades with blurred shadows.** Medium · S. Both skins share `rotate(-9deg) scale(1.18)`, an opacity fade and a soft shadow ([games/codenames/src/Board.svelte:326](../../games/codenames/src/Board.svelte#L326)); 8-bit only adds `steps(4)`, so frame 0 is invisible and the middle frames are semi-transparent jaggies. Give 8-bit its own keyframes: `translateY(-24px)` with a `0 12px 0 #1a0f08` hard shadow, then `translateY(3px)` at 75%, then rest with a 3 px shadow, using `steps(3, jump-start)` over about 270 ms. Make the card nudge a 3 px `steps(2)` bump. Asset: code.
3. <a id="cn-8-3"></a>**CN-8.3. Agent art is decimated by nearest-neighbour downscaling.** Medium · S. The 480×320 covers are drawn at 0.39× under `image-rendering: pixelated` ([games/codenames/src/pixel.css:162](../../games/codenames/src/pixel.css#L162)), so eyes and outlines drop out. Set `.cover-art { image-rendering: auto }`, since `pixelated` helps only when upscaling. Optionally ship half-size copies (ImageMagick `-filter box -resize 50% -colors 32`) with `srcset` 240w/480w. Asset: CSS, optional re-export.
4. <a id="cn-8-4"></a>**CN-8.4. Card words break mid-word ("MUSHROO/M", "NEWSPAPE/R"), and the HUD wraps.** Medium · S. 20 of 23 long words wrap mid-word at 320 px in 8-bit (1 of 23 in Classic): `overflow-wrap: anywhere` ([games/codenames/src/tokens.css:706](../../games/codenames/src/tokens.css#L706)) plus the wider Jersey 10 metrics. On desktop the turn pill is 64.6 px tall and "Round / 1" wraps. Set `overflow-wrap: normal` on the 8-bit card word. Pass `style:--len={card.word.length}`, and in compact use `font-size: min(<current clamp>, calc(24cqw / var(--len)))` (cqw resolves against `.word-grid`; don't make `.dossier` a container). Remove the card letter-spacing. On desktop only, make `.turn-pill` and `.round-label` `nowrap` and `.turn-meta` `flex: none`. Tested via injected CSS at 390, 360 and 320 px. Asset: CSS.
5. <a id="cn-8-5"></a>**CN-8.5. Classic glass chrome leaks into 8-bit.** Medium · S. Only `.glass` is restyled (pixel.css :40), so `.setup`, the phone action bar (gradient, blur, soft shadow, 12 px radius) and the settings controls stay Classic. Extend the override to `.setup` and `.cn-table.compact .action-bar`, square the remaining radii, style radios and checkboxes with `appearance: none` (18 px square, `--px` ink border, gold block when checked), set `accent-color: var(--px-gold)` on the range, and replace `calc(var(--px) + 1px)` borders with whole multiples. Asset: CSS.
6. <a id="cn-8-6"></a>**CN-8.6. `table.webp` is not seamless, so hard seams cross the table.** Low · S. The 960×540 tile repeats from the centre (pixel.css :64), with seams at x 240 and 1200 at 1440 px. Draw it at `center / 1920px auto repeat`: an exact 2×, no seams up to 1920×1080, and grain closer to the 3 px chrome pixel. Or make it seamless offline (ImageMagick `-roll +480+270`, then repaint the cross in Pixelorama). Asset: CSS, or an image edit.
7. <a id="cn-8-7"></a>**CN-8.7. Rows of identical agents.** Medium · S. Pick the variant by reveal order instead of index: derive each card's ordinal among revealed cards of the same identity from the public guess history. Use `ordinal % 4` → a, b, a-mirrored, b-mirrored (`scale: -1 1`, which is safe for pixel art). Add c and d variants later with the recorded prompt ([CN-C1](#cn-c1)). Asset: CSS.

Immersion, ranked
1. <a id="cn-8-8"></a>**CN-8.8. The winning reveal plays before the result modal.** Medium · S. The dialog opens in the same flush as the final reveal (Board :418), so the last cover drops behind the dimmed backdrop. In 8-bit (not reduced), delay the dialog about 700 ms. Pulse the newly public cards with a staggered `steps(2)` opacity (30 ms apart). Show the winning team's card art (or `assassin.webp`) as a 3:2 portrait in a `--px` ink frame in `.winner`. Asset: existing art.
2. <a id="cn-8-9"></a>**CN-8.9. Whose turn it is reads at a glance.** Low · S. Both team panels compute identical shadows. Add a hard gold ring under `[data-active-team]`, pass `pixel ? 'steps(2)' : 'ease-out'` to the existing `turnEnded` and `clueSubmitted` animations, and bump the new team's panel 3 px on handoff. An optional 6×6 idle lamp (`steps(1)` opacity, 1.2 s) stays off under reduced motion. Asset: CSS.
3. <a id="cn-8-10"></a>**CN-8.10. A real 8-bit sound pack.** Medium · M. Every cue maps to `stamp` or `win` ([games/codenames/src/effects.ts:13](../../games/codenames/src/effects.ts#L13)), so a losing team hears the victory jingle, and the kit's `lose` cue goes unused. Add `games/codenames/src/pixel/sound.ts` (modelled on Little Secret's), lazy-loaded with `pixel.css`. Cues: own (stamp plus a rising 2-note), civilian (a muted thud), opponent (stamp plus a falling 2-note), assassin (a noise sweep and a low tone), clue (clacks and a bell), turn (a 2-note chime). Pick win or lose by the viewer's team (spectators hear win), and play only the most dramatic accepted event. Update [docs/codenames-pixel.md:12](../../docs/codenames-pixel.md#L12). Asset: ZzFX.
4. <a id="cn-8-11"></a>**CN-8.11. Pixel icons in the HUD.** Low · M. Icon.svelte draws round-cap strokes, circles and arcs ([games/codenames/src/Icon.svelte:4](../../games/codenames/src/Icon.svelte#L4)), and the book and gear buttons are curved SVG paths (Board :646), anti-aliased next to 3 px hard-edged chrome. Hand-set 12×12 grids for agents, eye, history, players, check, close, book, gear and the logo, through the shared PixelIcon ([S9](#s9)), switched by a `pixel` prop. Asset: code-drawn grids.
5. <a id="cn-8-12"></a>**CN-8.12. Agents shown as a token reserve.** Low · M. The two history columns show one line for the whole first turn, and team counts are abstract numerals. On desktop, render one 8×10 hand-set agent token per agent (9 and 8) in each team panel, filled while unfound and hollow ink once found, derived from the public `remaining`. Pop the newest hollow token with a `steps(2)` hop on that team's reveal. Put a small typewriter sprite above the empty-history text. Asset: code-drawn sprites.

### 6.6 Sushi Go Party

**Classic**

Defects
1. <a id="sgp-c1"></a>**SGP-C1. Two clashing food-art styles: 6 dishes are shaded, 20 are flat outline art, and Onigiri's face can't be seen.** Medium · L (quick fix S). FoodArt draws shaded art for tempura, dumpling, pudding, wasabi, chopsticks and maki only ([games/sushi-go-party/src/table/FoodArt.svelte:23](../../games/sushi-go-party/src/table/FoodArt.svelte#L23)), and the rest fall back to flat Dish.svelte with dark outlines and a fixed face. Catalog lessons render Dish directly ([apps/web/src/lib/catalog/guides/SushiScene.svelte:3](../../apps/web/src/lib/catalog/guides/SushiScene.svelte#L3)), so they show the older art for those 6 dishes. Onigiri's eyes are `#284e45` on a `#284e45` nori rect ([games/sushi-go-party/src/Dish.svelte:106](../../games/sushi-go-party/src/Dish.svelte#L106)). Quick fix: move the onigiri face onto the rice (y about 45), and the egg nigiri face off the band. Full fix: port the shaded style into Dish.svelte itself (shared gradient defs, `smile()`, a face position per kind, tonal edges instead of outlines), in this order: nigiri, sashimi, temaki, uramaki, onigiri, tofu, miso, eel, edamame, ice cream, fruit, then the specials. The catalog then matches the table without pulling in 8-bit code. Asset: code-drawn SVG.
2. <a id="sgp-c2"></a>**SGP-C2. The selected card sits lower than a hovered one, under a cold cyan halo.** Medium · S. Selected rises 6 px and hovered 10 px ([games/sushi-go-party/src/table/table.css:247](../../games/sushi-go-party/src/table/table.css#L247), :261), and the halo is `#d9ffff`/`#abf1ed`, which reads as a focus ring on the warm palette. Make selection the strongest state (`translateY(-26px)`, rotate 0, `scale(1.05)`, 160 ms, neighbours nudged 4 px apart), and replace the glow with the coral border (`#ee847a`) and a warm shadow underneath (`0 14px 12px #47685a44`). Asset: CSS.
3. <a id="sgp-c3"></a>**SGP-C3. Table headings fall back to the site serif.** Low · S. Board's `h2` and `.sushi-dialog h2` pick up Fraunces from [apps/web/src/app.css:63](../../apps/web/src/app.css#L63). Set `font-family: inherit` on both. Asset: CSS.
4. Also: the plate that clips ([U51](#u51)), label collisions ([U53](#u53)), phones ([U25](#u25)), hidden buttons ([U52](#u52)), and filters ([P13](#p13)).

Immersion, ranked
1. <a id="sgp-c4"></a>**SGP-C4. A Classic sound set.** High · S. The pack is three near-identical 0.12 s sine sweeps capped at 0.035 gain ([games/sushi-go-party/src/effects.ts:4](../../games/sushi-go-party/src/effects.ts#L4)), and `cue()` plays only in 8-bit (Board :194), so select and keep are silent and round end and victory share the score blip. Rebuild it from `createAudio()` noise and tone, routed through the same `cue()` switch as 8-bit:
   - select: a 15 ms highpass tick
   - keep: a wooden tok (triangle 420→260 Hz, plus a 1.2 kHz click)
   - pass: a paper riffle (3 bandpass bursts at 2.5–4 kHz)
   - reveal: a porcelain clink (2100 and 3150 Hz sines, 0.3 s decay)
   - score: a 3-note marimba
   - round end: a 5-note pentatonic phrase
   - win: a rising phrase and a soft low gong
   - lose: two falling notes

   Asset: synthesized.
2. <a id="sgp-c5"></a>**SGP-C5. Kept dishes go face down, then every seat flips at once.** High · M. Committing only swaps a seat's pill text, your kept card stays faded in the fan, and the reveal is an 18 px drop and tilt ([games/sushi-go-party/src/table/OpponentSeat.svelte:232](../../games/sushi-go-party/src/table/OpponentSeat.svelte#L232)). The game's signature simultaneous flip never happens. For each committed seat, pull the top HiddenHand back forward as the "placed" card (render `count - 1` behind it; the count already includes the commitment). FLIP your own kept card face down onto your plate edge. On reveal, flip every new card with `rotateY(180 → 0)` over about 380 ms with `backface-visibility: hidden`, all within 30 ms, then the clink. Uses public data only. Instant swap under `.reduce`. Asset: CSS.
3. <a id="sgp-c6"></a>**SGP-C6. Score pawns walk the track before the receipt slides in.** Medium · M. Pawns are placed with `left`/`top` and no transition ([games/sushi-go-party/src/table/ScoreTrack.svelte:143](../../games/sushi-go-party/src/table/ScoreTrack.svelte#L143)), and the results panel covers the bottom run where they end up. On a score event, hold the panel for a short beat (motion on only). Animate each pawn with WAAPI through each station via `point(n)`, about 40 ms per step, capped at 1.2 s and staggered by seat, then slide the receipt in. Remove the pawn filter first ([P13](#p13)). Asset: code.
4. <a id="sgp-c7"></a>**SGP-C7. A victory moment outside the receipt.** Medium · M. Classic reuses the receipt panel with "Winners: Tomás"; the podium and chef are 8-bit only (Board :809). Light the winner's seat or tray, bob their pawn, and burst about 16 code-drawn petals from that seat (transform and opacity, 1.6 s, removed after), with the win phrase from [SGP-C4](#sgp-c4). If you add a podium, make it a compact ranked list with the button in the sticky footer ([U52](#u52)). Asset: CSS.
5. <a id="sgp-c8"></a>**SGP-C8. Idle life on the table.** Low · S. The tea cup and soy dish have faces but never move ([games/sushi-go-party/src/table/TableDecor.svelte:54](../../games/sushi-go-party/src/table/TableDecor.svelte#L54)). Add 2–3 steam wisps above the tea (transform and opacity, 4 s, staggered), a blink on the sauce's existing `<i>` eyes (the tea face is a text glyph, so split it into spans first), and pulse dots on "Choosing…" during draft only. About 6 animated nodes, paused under `.reduce`. Asset: CSS.

**8-bit**

Defects
1. <a id="sgp-8-1"></a>**SGP-8.1. Card backs show slivers of neighbouring sprites.** Medium · S. `.card-back` paints the whole `dishes.webp` sheet with `background-origin: content-box` but a border-box clip and 18 px padding ([games/sushi-go-party/src/pixel.css:251](../../games/sushi-go-party/src/pixel.css#L251)), so the gold chopstick tips and the tamago wedge show on every hidden-hand back. Put `content-box` in the layer shorthand (as `.px-bundle` does), and make the content box square (about 42×42) so the emblem isn't squashed. Asset: CSS.
2. <a id="sgp-8-2"></a>**SGP-8.2. The chopsticks sprite is a red X that reads as "cancel".** Medium · S. The prompt asked for chopsticks "crossed in an X" ([docs/sushi-go-party-pixel.md:115](../../docs/sushi-go-party-pixel.md#L115)), so played plates show a red ✕ on white. Classic draws a parallel pair. Quickest: copy `props.webp` cell 4 (a chopstick rest with two parallel sticks) into `dishes.webp` cell 18 with Pillow, then re-quantize with the documented palette step. Or regenerate with "a pair of red lacquered chopsticks with gold tips lying side by side, parallel, diagonal lower-left to upper-right, resting on a tiny white fish-shaped rest, NO crossing, NO face", and update the doc. The index stays the same. Asset: image edit or regenerated cell.
3. <a id="sgp-8-3"></a>**SGP-8.3. Your square tray covers the lower-right guest's dishes and hides the chopstick-rest prop.** Medium · S. 8-bit sets `border-radius: 0` on `.own-area` ([games/sushi-go-party/src/pixel.css:368](../../games/sushi-go-party/src/pixel.css#L368)), cancelling the curved corner that lets that seat show in Classic. At 5–8 seats, all three of that guest's dishes are hidden. The keep caption covers the same spot, and `chopstick-rest` sits fully under the tray ([games/sushi-go-party/src/pixel/PixelDecor.svelte:15](../../games/sushi-go-party/src/pixel/PixelDecor.svelte#L15)). Raise the lower-right seat above the tray (z 3), move the caption out of that corner, move `chopstick-rest` to a visible spot, and nudge `soy-dish` right. Asset: CSS and decor coordinates.
4. <a id="sgp-8-4"></a>**SGP-8.4. Web-UI leftovers: a heart glyph on opponent desserts, native settings controls.** Low · S. Opponents show "♡ n" ([games/sushi-go-party/src/table/OpponentSeat.svelte:61](../../games/sushi-go-party/src/table/OpponentSeat.svelte#L61)) while your own badge uses PixelDish. Pass the menu's dessert and render a 24 px PixelDish. Restyle checkboxes and radios as 18 px `appearance: none` squares with a gold check, and the range as a flat 6 px track with a square thumb. Asset: CSS.
5. Also: the pass clatter ([B16](#b16)), the podium order ([B12](#b12)), the Keep button and text overflow ([U53](#u53)), and the status pills ([U49](#u49)).

Immersion, ranked
1. <a id="sgp-8-5"></a>**SGP-8.5. Lock-in drops a card back, and reveal flips it.** Medium · M. Commit only changes the chip, and reveal is a 15 px drop in 4 steps (pixel.css :825). On the public `committed` event (which carries only the seat), drop a face-down `.card-back` from that seat's HiddenHand onto its plate with `steps(3)`. On reveal, flip the backs with a 2-step `scaleX` 1→0→1 swap to the face, then settle. Your own committed card slides face down onto your plate. Blink the noren Round/Pick banner twice when the pick changes. Cancelled by `clearPresentation` and `.reduce`. Asset: CSS.
2. <a id="sgp-8-6"></a>**SGP-8.6. Pawns walk, and the win happens on the table.** Medium · M. Move each pawn station by station along `beltPoint` with WAAPI `steps`, about 50 ms per station, capped at 1.2 s, with one merged tick stream (not one per pawn), then the existing score cue. For victory, drop 16 hard-edged 6 px squares in the dish palette with `steps(8)` (removed after 1.6 s), blink the winner's seat border gold, and reuse `px-hop` on the winner's pawn. Asset: CSS.
3. <a id="sgp-8-7"></a>**SGP-8.7. Steam and a lantern bob between passes, and some decor on phones.** Low · M. The only loop is the final-screen chef hop (pixel.css :677), and phones hide all decor. Add teapot steam from `box-shadow` squares (`steps(3)`, 2.4 s) and a 2 px lantern bob (`steps(2)`), modelled on Carcassonne's `px-sway`/`px-smoke`. On phones, show the lantern and lucky cat at 64 px in the empty header gap. Off under `.reduce` and reduced motion. Asset: existing sprites and CSS.
4. <a id="sgp-8-8"></a>**SGP-8.8. Use or leave the five spare sprite cells.** Low · S. `roe`, `tamago`, `shrimp`, `geta` and `mat` are never drawn ([games/sushi-go-party/src/pixel/sprites.ts](../../games/sushi-go-party/src/pixel/sprites.ts)). Reuse `geta` as counter decor and `mat` as a lucky-cat paw frame. If you remove anything, drop only the trailing dish names, and keep placeholders for `geta` and `mat`, because cell positions come from `indexOf`. Update the asset table in [docs/sushi-go-party-pixel.md](../../docs/sushi-go-party-pixel.md). Asset: existing sheet.

### 6.7 Little Secret

**Classic**

Defects
1. <a id="ls-c1"></a>**LS-C1. Eliminated name slips turn murky, and the role reveal is a flat label.** Low · S. `.out .name-slip { opacity: .7 }` lets the felt show through the paper ([games/little-secret/src/Board.svelte:958](../../games/little-secret/src/Board.svelte#L958)), and the role reveal is a 12 px cream box with red text (:949). Keep the slip opaque and strike the name in red ink (`::after`, 2 px `#8f2f26`, rotated −4°). Restyle `.role-stamp` as a rubber stamp (uppercase, double red border, transparent, rotated −8°), placed absolutely across the token's lower rim as 8-bit does ([games/little-secret/src/pixel.css:188](../../games/little-secret/src/pixel.css#L188)). That also shortens top-row seats, which helps [LS-C2](#ls-c2). Asset: CSS.
2. <a id="ls-c2"></a>**LS-C2. At 1280×720 the action paper's tape covers the top seat's stamp, and the lit ring touches the banner.** Medium · S. Seats are centred with `translate(-50%, -50%)` (:879), so their stacks grow both ways and push the top token up. Shorten seats instead of hiding the table: pin the role and status stamps across the token rim (see [LS-C1](#ls-c1)), optionally fold the score into the name line, and clamp the top row (a larger top inset on `.table-layout`, or y ≥ 15% in [games/little-secret/src/table/layout.ts](../../games/little-secret/src/table/layout.ts)) so the ring clears the banner. Put the brand subtitle on a Paper slip. Asset: CSS.
3. <a id="ls-c3"></a>**LS-C3. The paper texture is stretched per element.** Low · S. `paper.webp` (660×473) is drawn at `100% 100%` ([games/little-secret/src/table/Paper.svelte:36](../../games/little-secret/src/table/Paper.svelte#L36)), so name slips squash it about 15× into dark bands, and tall sheets stretch stains into streaks with long slanted torn edges. Use `background-size: 660px auto`, vary `background-position` by kind, and give slips a torn edge in px (calc) so it matches the sheets. The filter fix is in [P13](#p13). Asset: CSS.
4. Also: the action panel ([U27](#u27)), power badges ([U58](#u58)), and filters ([P13](#p13)).

Immersion, ranked
1. <a id="ls-c4"></a>**LS-C4. Paper-and-ink sounds in place of one inaudible thud.** Medium · S. Classic plays only `reveal` (a 150→75 Hz sine) or `finish`, at about 0.028 gain ([games/little-secret/src/effects.ts:20](../../games/little-secret/src/effects.ts#L20)), and `cue()` is pixel-only (Board :102), so clues, vote commits, envelope opens and speaker changes are silent. Make `cue()` play in both skins and map its names to a Classic set built on `createAudio()`: a rustle for open, a pen scratch for clue, a stamp for vote and caught, a soft bell for the turn (replacing the unused `handoff`), and chimes for win and lose. Raise the gain to about 0.06–0.12. Keep it soft, because players are on voice chat. Asset: synthesized.
2. <a id="ls-c5"></a>**LS-C5. Drop the milky whole-table flash, and give each moment its own motion.** Medium · M. The only Classic motion is the table opacity going .82→1 on every event (:240), which washes the dark felt grey-teal; `stamped` is computed but used only by 8-bit (:417). Delete the flash. Add transform/opacity keyframes of 320 ms or less: a role-stamp thump on stamped seats, a lift and ring fade-in on the active seat, and a staggered entrance for ballot review rows. Animate a clue slip only when its id arrived while mounted (diff `s.clues` keys in an untracked effect, cleared on `gate.reset`). Apply `class:still` in both skins. Off under reduced motion. Asset: CSS.
3. <a id="ls-c6"></a>**LS-C6. One envelope that opens, shared by the table and the guide.** Medium · M. The Classic envelope looks the same open and closed (:659), the letter appears instantly as plain text, and the guide draws a different 90×65 envelope with a "+" seal ([games/little-secret/src/GuideScene.svelte:84](../../games/little-secret/src/GuideScene.svelte#L84)). Extract `table/Envelope.svelte` (code SVG with an `open` prop) and use it in both places. Flip the flap with `scaleY(-1)` from its top edge over 220 ms, split the wax seal into two halves that move ±3 px, and slide the letter up as a folded note card with the password in 34 px Kalam over an ink underline. Off under `.still`. Pair it with the rustle from [LS-C4](#ls-c4). Asset: code-drawn SVG.
4. <a id="ls-c7"></a>**LS-C7. Controls written on the case file.** Low · S. Inputs and selects are bright browser widgets on aged paper (:995), Classic RPS buttons are plain text (:551), and disabled primary buttons are washed-out pink. Style inputs and selects as a ruled ink line (transparent, dashed `#8a6a45` bottom border, Kalam 22 px, a gradient caret). Make the existing tap-a-seat voting discoverable (a hover and focus ring on `.seat-choice`, plus "tap a suspect" above the select). Draw three 32-unit hands in the Badge stroke style for RPS. Draw disabled buttons as paper with a dashed outline. Asset: CSS and small SVGs.
5. <a id="ls-c8"></a>**LS-C8. Mission results and victory get a ceremony.** Medium · M. The outcome uses ✦ ✒ ◈ glyphs in Georgia ([games/little-secret/src/table/Outcome.svelte:50](../../games/little-secret/src/table/Outcome.svelte#L50)), and 42 px honoree tokens print their 9 px seat number over the initial ([games/little-secret/src/table/PlayerToken.svelte:75](../../games/little-secret/src/table/PlayerToken.svelte#L75)). Victory is just the word "Winners". Draw emblems in the Badge stroke style (a quill for Journalist, a mask for Infiltrator, an open eye for Disciple). On a match win, press a red "CASE CLOSED" stamp and a wax-seal SVG onto the action paper (scale 1.4→1, −10°, 300 ms), and sweep a one-shot brass sheen across winner tokens. Slide "+N" into the SideSheet score box. Size the token's seat number as `calc(var(--token-size) * .12)` and hide it below 56 px. Asset: code-drawn SVG and CSS.
6. <a id="ls-c9"></a>**LS-C9. The phone table keeps its felt, and shows more seats.** Medium · M. Below 1100 px the desk becomes a flat gradient (:1163), branding and banner take about 250 px before the action, and 9 seats need 5 rows. Crop a tileable 256 px felt square from `table.webp` (about 10 KB WebP, `static/games/little-secret/felt.webp`) under the gradient, with a dashed stitch outline. Put the title in one row between the corner buttons, use 3 columns at 56 px tokens when there are more than 6 players, and move the commit ✓ onto the token rim. Fix the doc's "three-column" line ([D2](#d2)). Asset: an image crop and CSS.

**8-bit**

Defects
1. <a id="ls-8-1"></a>**LS-8.1. The top seat's clue bubble is buried under the clipboard, and same-row seats jump when clues arrive.** High · M. At 1280×720 and 1366×768, `elementFromPoint` at the first seat's bubble returns the clipboard, because `.action-area` paints after `.seats`. Same-row portrait tops sit at 530 or 544 px depending on clue length ([games/little-secret/src/Board.svelte:874](../../games/little-secret/src/Board.svelte#L874)). Set `.seat { z-index: 1 }` in 8-bit, and use `--row: top` in `layout.ts` for slots with y ≤ 14, with a side bubble and a left-pointing stepped tail. While any clue shows, reserve a fixed two-line slot on every seat (`.seats:has(.clue-slip) .seat { padding-bottom: … }`) and place the bubble absolutely inside it, so seats stay level without moving toward the clipboard. Asset: CSS.
2. <a id="ls-8-2"></a>**LS-8.2. The speaker arrow is swallowed by the same-gold score chip.** Medium · S. The arrow (y 133–154) and chip (y 145–166) are both `#f2c14e` ([games/little-secret/src/pixel.css:257](../../games/little-secret/src/pixel.css#L257), :378), so whose turn it is, the core loop, has no visible marker. Move the score chip under or onto the end of the name plaque, lift the arrow to `top: -30px` with a 3 px ink outline polygon, and turn the speaker's plaque gold. Asset: CSS.
3. <a id="ls-8-3"></a>**LS-8.3. Portraits and other sprites render at non-integer scales.** Low · M. Measured: 1.358× for suspects, 0.984× with nine seats, 0.849× for honorees, and 1.5× for the envelope (`scale={1.5}`, Board :658). Pick an integer `--k` per context: `width: calc(52px * var(--k) + 4 * var(--px))`. Use 1× on desktop (2× only at a height of 1000 px or more with 6 or fewer players), 2× on phones, 1× for dense tables and honorees, and fixed 104 px guide portraits. No fractional `scale` props. Asset: CSS.
4. <a id="ls-8-4"></a>**LS-8.4. The RPS "Scissors" label breaks into "Scissor / s".** Low · S. Use `.symbols button { font-size: 18px; overflow-wrap: normal; padding-inline: 2px }` (it inherits `anywhere` from `.action-scroll`). Spanish "Tijeras" fits too. Asset: CSS.
5. <a id="ls-8-5"></a>**LS-8.5. On phones the fixed corner buttons sit over the scrolled CTA.** Low · S. `.corners` is fixed at `top: 12px` over the scrolling column (Board :1166) in both skins. Make it a sticky bar (`position: sticky; top: 0; margin: 0 -16px 12px; padding: 8px 12px`; teal in Classic, wood with an ink bottom border in 8-bit), and drop the compact table's 78 px top padding. Asset: CSS.
6. Also: the password and result CTA ([U27](#u27)), and Classic art downloads ([P2](#p2)).

Immersion, ranked
1. <a id="ls-8-6"></a>**LS-8.6. The RPS tiebreak, the deal, new clues and phase changes get visual beats.** Medium · M. Only accepted ballots and eliminations become visuals (Board :233). Three RPS throws leave the screen unchanged, and nothing shows the public choices. Add `RpsReview.svelte`, mirroring BallotReview and fed only by gate-accepted public `rps` events: each candidate's portrait drops in with their 2× symbol (`ls-drop`, staggered), losers get the red stamp, and "Again!" shows when nobody loses. Drop the envelope sprite onto the clipboard on deal, pop new clue slips (`steps(3)`, 0.24 s), flip the banner with `{#key bannerLabel}` and a `steps(2)` `scaleY`, and pass `steps(2, jump-end)` to the root animation in 8-bit. Asset: existing sprites.
2. <a id="ls-8-7"></a>**LS-8.7. Use the six sprite frames that ship but are never drawn.** Low · S. The props frames `envelope`, `seal`, `stamp` and `glass` and the icons `envelope` and `stamp` are unused ([games/little-secret/src/pixel/Sprite.svelte:24](../../games/little-secret/src/pixel/Sprite.svelte#L24)), while the commit mark is a ✓ glyph forced to system-ui. Use the envelope icon as the commit mark (a box of 28 px or more), the seal on reveal, the stamp beside the ballot review heading, the magnifying glass on the chosen suspect, and the cat's look and shh frames. Leave the frames in `sheets`, because their names are positional. Asset: existing sheet.
3. <a id="ls-8-8"></a>**LS-8.8. Sound gaps.** Low · S. Other players' commits are silent (cues fire only for the actor, :170), the first speaker is never announced, a wrong Journalist guess plays `lose` for everyone, and RPS falls back to the vote stamp. Add an `rps` branch in `pixelCue` (ticks, then the stamp, or `caught` when there's one loser) and `miss` for a wrong guess. Drive `mine`, `phase` and `commit` from effects on `s.speaker`, `s.phase` and `s.committed.length`, with the same untrack, last-value and mounted guards as the turn effect so reconnects stay silent, and skip your own commits. Play `error` in `act()`'s catch, using [S7](#s7). Asset: ZzFX.
4. <a id="ls-8-9"></a>**LS-8.9. Steam and candle loops on the painted table.** Low · M. `table.webp` (480×270) paints a steaming cup and a candle that never move. Add hand-set sprites of 12 px or less with a `steps(3)` inner-strip translate, covered by the existing `.still` and reduced-motion rules, and hidden in the compact block. At 16:10 the steam sits at the cropped edge, so the candle flame plus a 2-frame flicker of the lamp's light pool (top-left, visible at both ratios) is the safer pick. Asset: hand-set sprites.

### 6.8 Dominó

**Classic (3D)**

Defects
1. <a id="dom-c1"></a>**DOM-C1. Side seats' name plaques and the Pass plaque are cut off at 16:10, 4:3 and on portrait tablets.** High · S. The camera fits half-width 14.2 ([games/domino/src/three/scene.ts:572](../../games/domino/src/three/scene.ts#L572)), but the plaques sit at x = ±15.5 (:603). At 1440×900 "Luis" and "Carl" are cut, and a side pass reads "erto · passed"; on iPad portrait the side seats are gone. In `resize()` and `placeCamera()`, compute the visible half-width at each plaque's depth and clamp the plaques (and the Pass plaque at :249 and the drink) inside it, or switch to the lip-corner fallback below 1.7:1 instead of 1:1 (:599). On portrait tablets, also render the HUD seat chips ([games/domino/src/Hud.svelte:43](../../games/domino/src/Hud.svelte#L43)). Asset: code.
2. <a id="dom-c2"></a>**DOM-C2. The slam thud plays 60–80 ms before the tile touches the felt.** Medium · S. The sound fires at `300 - 120 * force` ms ([games/domino/src/three/Table3D.svelte:68](../../games/domino/src/three/Table3D.svelte#L68)), but the flight lasts `380 - 140 * force` (scene.ts :383), so on a soft play the tile is still a tile length in the air. Put `landingMs(force)` in a tiny shared `three/timing.ts` (so Table3D doesn't import `scene.js` statically), and use it for the sound and the shake timeout. Optionally shape the hop as `sin(π k)^0.7` for a steeper drop. Asset: code.
3. <a id="dom-c3"></a>**DOM-C3. The ghost placement is a blank translucent slab.** Medium · M. `ghostMaterial` is plain `#fff1cf` at .34/.62 on a featureless box ([games/domino/src/three/tile.ts:62](../../games/domino/src/three/tile.ts#L62)), so you can't see which pips will meet. Give ghosts the face map from `faceTextures(near, far)` on a cheap transparent material (no bump, roughness or spec maps; `depthWrite: false`), with near and far from `idealLayout(attach(chain, selected, end))`. Warm the program by adding a hidden ghost before `compileAsync` (scene :723). Add a 140 ms 1.06→1 pop when motion is on. Asset: code.
4. <a id="dom-c4"></a>**DOM-C4. The HTML Tile draws the 6 rotated 90° against the table.** Medium · S. [games/domino/src/Tile.svelte:39](../../games/domino/src/Tile.svelte#L39) has its own pip grid, transposed against [games/domino/src/spots.ts](../../games/domino/src/spots.ts), so the 6|6 in the phone hand bar, the result panel and the loading cover differ from the table. Fix with [S12](#s12). Asset: code.
5. Also: the Polar label ([B36](#b36)), the WebGL leak ([B25](#b25)), phone targets ([U78](#u78)), playable tiles ([U59](#u59)), and the result panel ([U60](#u60)).

Immersion, ranked
1. <a id="dom-c5"></a>**DOM-C5. Turn and hand-end sounds in 3D.** High · S. `turn() {}` and `end() {}` are empty ([games/domino/src/three/Table3D.svelte:65](../../games/domino/src/three/Table3D.svelte#L65)) while 8-bit has both, so a 3D player waiting through three turns hears nothing when it's theirs. For `turn()`, two soft wood taps (bandpass noise around 1800 Hz, 30 ms, about 0.08 volume, at 0 and 90 ms), delayed by `landingMs(force) + 150` after a play. For `end(won)`, wait `landingMs(force) + 250` after a play or 300 ms after a knock, then play a sine marimba 523/659/784/1047 Hz (0.002 attack, 0.25 s decay, a quiet 4× partial) for a win, 392→294 Hz for a loss, and a knock plus 196 Hz for a tie. No extra thud. Asset: synthesized.
2. <a id="dom-c6"></a>**DOM-C6. A pass is a visible knock.** Medium · S. `knock()` plays two taps at 0 and 160 ms (Table3D :51), but the scene has no knock motion, and the plaque suffix is clipped at 16:10. Add `scene.knock(rel)`: tween that seat's standing row (or the rack for you) up 0.12 units and back in 90 ms, twice, synced to the taps, with a tiny `shake(0.15)`. Call it from the `g.on` listener on `pass` when motion is on. Asset: code.
3. <a id="dom-c7"></a>**DOM-C7. The hand ends on the table, not in a pop-up.** High · M. `handsLeft()` returns 0 once a result exists ([games/domino/src/game.svelte.ts:361](../../games/domino/src/game.svelte.ts#L361)), so the rails empty in one frame, and the Classic result appears instantly over the chain (Hud :404). Add `revealed` to the table state from `g.result.hands` (public after the hand). Swap each standing blank for its real tile and tween it face up onto its rail (220 ms, 70 ms stagger, a click each). Delay the Classic panel about 900 ms with a translate and opacity entrance, and dock it lower. On the chalkboard, chalk in the changed score (scale and opacity, plus three highpass "chalk" strokes). Asset: code.
4. <a id="dom-c8"></a>**DOM-C8. The revuelta: a shuffle and deal between hands.** Medium · M. On the next hand every placed tile is removed in one frame (scene :408), and `intro()` runs only once (Table3D :147). When the chain empties while meshes are still placed, tween each old tile face down toward the centre with a random yaw swirl (450–650 ms, 12 ms stagger) and remove it through the unused `done` hook, then call `intro()`. Sound: a 700 ms lowpass noise wash plus 10 random clicks, and one click per dealt tile. Skip when motion is off. Asset: code.
5. <a id="dom-c9"></a>**DOM-C9. The default camera shows the patio's best band.** Medium · S. At camera 0.15 the backdrop at y −6.4, z −45 ([games/domino/src/three/scene.ts:171](../../games/domino/src/three/scene.ts#L171)) shows pot bases and floor at the top of the screen, while camera 0 shows the lantern, chairs, hammock and city lights. In `placeCamera()`, ray-trace the far rail top to z −45 and move `backdrop.position.y` so the same image row sits there at every angle (about −11 at 0.15), clamped so the plane's top edge stays above the frustum. Don't promise the string lights. Asset: code.
6. <a id="dom-c10"></a>**DOM-C10. Rack tiles respond to hover, and wrong picks wobble.** Medium · S. Hover is cancelled (Table3D :425) and the scene has no hover pose. Add `hovered` to rack items in the table state (set from `pointerenter` and `pointerleave` on live rack hit buttons, fine pointers only) and a 0.25 lift in `rackPose()`, tweened in 160 ms. Hover set imperatively would be overwritten by `update()`. For an unplayable click, an optional `Sounds.deny` (a dull 300 Hz lowpass tock, 40 ms) and a `scene.deny(id)` yaw wobble of ±0.08 rad over 220 ms. Asset: code.
7. <a id="dom-c11"></a>**DOM-C11. The phone table gets depth, and ghosts get room.** Low · S. `.compact .vignette { display: none }` (Table3D :471) leaves 580 px of flat leather, and ghosts touch both bars because the fit margin is shared (scene :522). Re-enable a lighter static vignette (a warm `rgb(255 190 120 / .07)` centre plus edge darkening at about .35), and give ghost poses an extra 0.8 units of fit margin while placed tiles keep 1.6. Asset: CSS and code.
8. <a id="dom-c12"></a>**DOM-C12. Sparse crickets between plays.** Low · S. Every 4–9 s, 2–3 sine chirps at 4.2–4.8 kHz, 25 ms each, at 0.01 volume or less, only while sound is on, audio is unlocked and the tab is visible; cleared on unmount. Skip the rim-light flicker, which adds steady GPU work. Asset: synthesized.

**8-bit**

Defects
1. <a id="dom-8-1"></a>**DOM-8.1. The sleeping cat is clipped on 16:10 desktops, and its breathing frame is never drawn.** Low · S. The cat is drawn at world x −330 from source x 0 and "breathes" by squashing 26 rows into 25, which drops a row ([games/domino/src/pixel/scene.ts:755](../../games/domino/src/pixel/scene.ts#L755)); frame 2 of `cat.webp` is unused. Alternate source frames at full height instead. Place the cat at a fixed spot inside world x ≥ −265, which is always visible (for example open floor just left of the front-left table corner, checked against `patio.webp`), or accept the edge crop. Asset: existing sheet.
2. <a id="dom-8-2"></a>**DOM-8.2. The slam meter's Soft and Hard labels vanish as it fills, and charging is silent.** Medium · S. Cream labels sit over a gold fill at about 1.37:1 ([games/domino/src/pixel/PixelTable.svelte:410](../../games/domino/src/pixel/PixelTable.svelte#L410)). Keep them cream with a hard 1 px ink outline (four 1 px text-shadows, no blur), or move them outside the track; ink labels would vanish on the ink track. In 8-bit only, quantize the display with `style:--charge={Math.floor(g.charge * 8) / 8}`, which leaves the sent force unchanged. Add an optional `Sounds.charge(step)` blip (square 440→880 Hz, 25 ms) per step, and blink the bar with `steps(2)` when full. Asset: CSS and ZzFX.
3. <a id="dom-8-3"></a>**DOM-8.3. Tile lighting flips when tiles rotate.** Low · S. Light is baked top-left in the 24×12 sprite ([games/domino/src/pixel/sprites.ts:56](../../games/domino/src/pixel/sprites.ts#L56)), and the rack rotates it −90° with its shadow inside the rotation (scene :833), so rack tiles look lit from below and cast shadows upward. Add an upright 12×24 sprite variant lit top and left for the rack, phone rack, loader and `tileUrl`, and draw the rack shadow outside the transform, down-right. Asset: code-drawn sprite.
4. <a id="dom-8-4"></a>**DOM-8.4. Sprites are drawn at fractional scales in the DOM.** Low · S. Result minis are 36×18 (1.5×, [games/domino/src/Hud.svelte:847](../../games/domino/src/Hud.svelte#L847)), and loader slots are 44×88 and 32×64 ([games/domino/src/Loading.svelte:101](../../games/domino/src/Loading.svelte#L101)). Use 48×24 minis (letting `.revealed` wrap on phones) and 48×96 / 36×72 loader slots. Optionally snap the phone rack to whole device pixels. Leave the documented quarter-step desktop scales alone. Asset: CSS.
5. <a id="dom-8-5"></a>**DOM-8.5. Pixelify Sans makes "Carlos" read as "Oarlos".** Low · S. [docs/pixel-kit.md](../../docs/pixel-kit.md) picks Jersey 10 because Pixelify's capital C is nearly closed, and the other seven skins use `--px-font`. Dominó hard-codes Pixelify (Hud :761, PixelTable :249, Loading :163). Load the kit's `pixel.css` ([S12](#s12)) and switch tags, chips, the bubble, the chalkboard and dialogs to `var(--px-font)` at about 15% larger. Keep Pixelify 700 for the DOMINÓ/TRANQUE banner if wanted. Asset: CSS.
6. <a id="dom-8-6"></a>**DOM-8.6. The bottom chrome floats as web UI.** Low · S. "Tidy up" is a DOM pill parked on the floor right of the rack, drawn at .45 opacity when there's nothing to tidy (PixelTable :363, scene :842). An empty tray stub shows after a hand (scene :637), and the phone Pass button is 57×30. Render Tidy up only when tiles are scattered, as a code-drawn wooden sign (a plank with 2 nails) at the right end of the front apron with the button laid transparently over it. Skip the tray when n = 0. Give Pass and the bar buttons a 44 px hit area through an `::after` without changing their look. Play a staggered soft tick as tidied tiles glide home. Asset: code-drawn sprite.

Immersion, ranked
1. <a id="dom-8-7"></a>**DOM-8.7. The ghost shows the tile that will land.** Medium · S. `drawGhost` fills a tinted rect with marching ants (scene :522). Get near and far for each ghost from `placements(attach(...))` and draw the tile at 0.5 alpha (0.8 when chosen) under the ants. The dim, wiggle and nope for unplayable tiles are in [U59](#u59). Asset: code.
2. <a id="dom-8-8"></a>**DOM-8.8. The hand-end reveal happens on the table.** Medium · M. Hands vanish at the result, and the revealed hands show only as 36×18 minis in a panel over the chain. Pass `revealed` (relative seats) in the pixel state. When it first appears, lay each seat's tiles face up in a row in front of that seat (partner y ≈ −104, sides x ≈ ±168, yours above the tray), flipping back → edge → face in 3 stepped frames, seat by seat, 60 ms apart, with a soft tick each. Then drop the panel lower or narrower so the board stays visible. Faces show at once with motion off. Asset: code.
3. <a id="dom-8-9"></a>**DOM-8.9. Scoring gets a beat, and the match win gets its own.** Medium · M. The chalkboard number swaps while the DOMINÓ! banner is still dropping (Hud :108), and winning the match plays the same jingle as winning a hand. In 8-bit, hold the displayed score and count up after the banner (about 1.5 s) in 1–5 point steps over 0.8 s with a 1200 Hz chalk tick (snap when motion is off). On match end, burst 2 px gold, green and red squares above the string lights in the top-right sky, and play `playChiptune(audio, 'win', 0.8)` after the arpeggio. Asset: code.
4. <a id="dom-8-10"></a>**DOM-8.10. A shuffle and deal after hand 1.** Low · M. `intro()` runs only from `onReady` (PixelTable :84). Pass `handNumber`, and when it changes (with motion on) run a ~900 ms shuffle: code-drawn 24×12 backs jostle in 4 stepped beats on the 125 ms tick, then slide in groups of 7 to the hands and rack. Finish with a rack-only drop; split it out of `intro()`, whose seat fade would otherwise blank the whole cast. Sound: 10–14 short noise clicks over 0.6 s. Asset: code-drawn sprite.
5. <a id="dom-8-11"></a>**DOM-8.11. Phones open on the table, not on a field of leather.** Low · M. With an empty chain, `fitGoal` zooms to 4.5× on a minimum box (scene :297), so the first view is 70% dithered leather. When there are no placements and no ghosts, fit the whole table (width, height plus apron) so the rails and cup holders show, and let the camera ease in on the first ghost. Don't draw standing tiles in compact, since chips show the counts. Asset: code.
6. <a id="dom-8-12"></a>**DOM-8.12. The patio fan turns, and moths circle the bulbs.** Low · S. The painted fan never moves. Its grille sits in front of the blades in `patio-fan-8x.png`, so a disk drawn on top would hide the cage: either overlay a 3-frame blade sprite and redraw the grille and rim on top, or cut the fan region from `patio.webp` into a small 3-frame sheet with the existing `pixelate.py`, advanced on the 125 ms tick. Moths as 1 px stepped orbits are fine. Asset: image edit plus code.

### 6.9 Home page

**Classic library**

Defects
1. <a id="home-c1"></a>**HOME-C1. The global button hover paints dark green over warm buttons.** Medium · S. `button:hover:enabled { background: #35664f }` ([apps/web/src/app.css:37](../../apps/web/src/app.css#L37), specificity 0,2,1) beats scoped single-class rules, because Svelte compiles nested selectors to `:where()`. "Join a room" goes brown on green (1.05:1), "See an example" in every rulebook goes green (and stays green after a tap on touch), and the Catan setup choice and Rulebook chapter nav turn green too. Use `@media (hover: hover) { button:where(:hover:enabled) { background: #35664f; transform: translateY(-1px) } }`, which is 0,0,1, so any scoped rule wins. Give `.catalog-join` and `.example-toggle` a text hover (`#993f2c`, underline), and style Rulebook's Retry and Clear like the warm secondary buttons. Asset: CSS.
2. <a id="home-c2"></a>**HOME-C2. Fraunces and DM Sans are named but never loaded.** Low · M. [apps/web/src/app.css:2](../../apps/web/src/app.css#L2) and :65 name them, but no `@font-face` exists, and `document.fonts` is empty on `/`. Cover titles hard-code Georgia (BoxArt :65, :217, :259, :426, :469), which Linux and Android don't have. Either drop the unused names, or self-host one display serif (Latin and Latin-ext WOFF2, `font-display: swap`) under `static/fonts/library` and point `h1`/`h2`, `.game-names` and the BoxArt `<text>` at a `--library-serif` variable. Don't convert wordmarks to paths. Asset: a font file, or CSS only.
3. <a id="home-c3"></a>**HOME-C3. The summary loop art hides Azul's "+7", its badges are at 1.97:1, and two Azul steps look identical.** Low · S. `text { fill: #fff6df }` ([apps/web/src/lib/catalog/SummaryStep.svelte:215](../../apps/web/src/lib/catalog/SummaryStep.svelte#L215)) overrides the attribute on the Azul "+7" (:170), and Azul steps 1 and 2 both draw four blue tiles (:164). Use `fill: var(--t, #fff6df)` with `style="--t: #194766"` on that text, set badge text to `#5a3a12` (4.84:1 on `#d4ad57`), and redraw step 1 as a filled pattern line and step 2 as wall tiles with a scoring arrow. Asset: SVG.
4. Also: hover hijack ([U10](#u10)), the phone header ([U28](#u28)), the carousel ([P15](#p15)), contrast ([U76](#u76)), "4–4 players" ([U14](#u14)), and trade dress ([B38](#b38)).

Immersion, ranked
1. <a id="home-c4"></a>**HOME-C4. Starting a game keeps the box.** Medium · M. The lobby is a ◈ glyph, "Gather around" and a URL input on the cool grey-green root palette ([apps/web/src/routes/room/[id]/+page.svelte:235](../../apps/web/src/routes/room/%5Bid%5D/+page.svelte#L235)), so the chosen box disappears and the warm cream turns grey-green. Render `<BoxArt game={room.gameId}/>` tilted −5° in place of ◈, and choose lobby colours by theme (library tokens `#f6ebd9`, `#a74531` and `#35291f` for Classic, kit tokens for 8-bit). Navigation is a client-side `goto` in an SPA, so a cross-document view transition doesn't apply. A same-document `startViewTransition` through `onNavigate` is optional, transform and opacity only, and skipped under reduced motion. Asset: existing BoxArt.
2. <a id="home-c5"></a>**HOME-C5. The covers read as one shelf.** Low · M. UNO, Codenames and Dominó are portrait boxes with right and bottom depth, Catan is a landscape with a skewed slab (BoxArt :351), Carcassonne a square with an offset slab (:451), and corner radii run from 5 to 16. Give Catan and Carcassonne the same right-and-bottom depth, highlight and radius scale as the portrait covers, keeping their aspect ratios. Optionally add a thin wooden shelf lip under the fan (a static gradient div, no filter). Skip a select sound. Asset: SVG.

**8-bit store**

Defects
1. <a id="home-8-1"></a>**HOME-8.1. The desktop dialogue box balloons into a 300 px empty cream slab.** High · S. `.scene { align-self: stretch }` plus `.talk { flex: 1 }` ([apps/web/src/lib/home/PixelStore.svelte:437](../../apps/web/src/lib/home/PixelStore.svelte#L437), :661) stretch the talk box to the games column's height: 297 px for one line at 1440×900, the largest element on screen. Drop `flex: 1` and set `.scene { align-self: start }`. If the column should stay full height, fill it with the cat, a review quote or the ticker as a counter strip. Asset: CSS.
2. <a id="home-8-2"></a>**HOME-8.2. The parked ladder covers the rug joke, and the sign and note shrink to 3.5–5 px on phones.** Medium · S. `ladder = 47` (:105) sits on the rug label centred at 48% (:483), and on phones `.note` is 3.5 px and `.sign` 5.1 px (:468, :477). Park the ladder on a shelf pillar no label overlaps (x about 26) and return it there after errands. Add `@container (width < 520px) { .note, .sign { display: none } }`, or a shorter line at 9 px or more. Asset: CSS.
3. <a id="home-8-3"></a>**HOME-8.3. The shelf plaques are baked in English.** Medium · S. The prompt bakes STRATEGY, FAMILY and PARTY into `store.webp` ([docs/pixel-store.md:49](../../docs/pixel-store.md#L49)), against the kit rule that text stays real text, so Spanish chips sit next to English signs. Overlay three HTML plaques with opaque wood fill, `%` positions and `cqw` type, rendering `labels[c]()`. The stage is `aria-hidden`, so make them decorative, or put interactive ones outside the stage. Later, regenerate `store.webp` with blank plaques. Asset: CSS now, a regenerated image later.
4. <a id="home-8-4"></a>**HOME-8.4. The 8-bit dialog skin stops at the dialog's own markup, so the Rules book and Summary art stay Classic.** Medium · S. The scoped selector `body:has(.pixel-store) dialog.svelte-… :is(h2:where(…))` can't reach child components, so Rulebook's Georgia headings (Rulebook :312, :318), rounded search box and chapter list stay Classic, and the summary shows the vector BoxArt beside the pixel box. Use `:global(body:has(.pixel-store) dialog :is(h2, h3, h4)) { font-family: inherit }` and `:global(… dialog :is(input, button))` with radius 0. In the summary header, render the store's `boxes/{selected}.webp` sprite when the theme is 8-bit. Use a readable fallback for long rule prose if Pixelify tires the eye. Asset: CSS.
5. <a id="home-8-5"></a>**HOME-8.5. `image-rendering: pixelated` on downscaled art drops pixel columns at DPR 1.** Low · M. Every image in the store is drawn smaller than its source (:316), so on a narrow DPR-1 stage the plaques read "S?RATEGY" and "PAR?Y". At DPR 2–3 and at 1440 px they render cleanly. Set `image-rendering: auto` on the store backdrop and the small tiles and portraits, which are always downscaled, and keep `pixelated` on the keeper and ladder sprites. Asset: CSS.
6. <a id="home-8-6"></a>**HOME-8.6. Some store boxes copy publishers' cover trade dress.** Low · M. The prompts at [docs/pixel-store.md:91](../../docs/pixel-store.md#L91) ask for UNO's yellow-outlined title in a white oval, Codenames' trench-coat agent and Sushi Go Party's party-hat sushi, while the other skins require "original designs only, no logos". Re-prompt the closest copies first (UNO, Sushi Go Party) as original compositions with a blank title band, render titles as real text over the band (which also gives the accented "Dominó"), and record the missing Dominó box prompt next to the others. Asset: regenerated box art.
7. <a id="home-8-7"></a>**HOME-8.7. The store duplicates the kit's palette, panel and reduced-motion block.** Low · S. PixelStore imports the kit `pixel.css` but uses none of it. It redefines the `--px-*` colours (:294), reproduces `.px-panel` (:320), repeats the global reduced-motion rule (:762), and the same hexes recur in +page.svelte and +layout.svelte. Put `px-tokens` on the store root and `px-panel` on `.games` and `.detail`, add `class:px-tokens` to the dialog and header before using `var(--px-*)` there (tokens on the store root don't reach them), and delete the local copies. About 40 lines. Asset: CSS.
8. Also: the Classic flash and blank-on-failure ([B9](#b9)), sprite-strip preloads ([P10](#p10)), the errand that gates the cover ([U62](#u62)), search ([U13](#u13)), and screen-reader noise ([U77](#u77)).

Immersion, ranked
1. <a id="home-8-8"></a>**HOME-8.8. The shopkeeper carries the box you asked for.** Medium · M. All 8 carry frames hold the same castle-and-meeples cover, and the "Top shelf. Of course it's the top shelf." line can play at a bottom shelf (`shopkeeper.ts:59`). Simplest: regenerate the carry strip with a plain kraft box. Or overlay `boxes/{selected}.webp` with its own class, so the `.keeper .cycle img` rules (:547) don't catch it. Split the search lines by `shelf.high`, and give the carry beat its own line so a stale search line doesn't play over it. Asset: a regenerated strip, or CSS.
2. <a id="home-8-9"></a>**HOME-8.9. Pixel press feedback and shop sounds.** Low · S. The global eased 1 px lift and transition apply inside the store, the hover background never changes, and nothing has an `:active` state or sound. Inside `.pixel-store`, set `button { transition: none }`, step the hover to `--px-wood-edge`, and add `:active { translate: 0 3px; box-shadow: none }`. Add `createAudio()` with `playChiptune(audio, 'click')` on tile and chip press, `coin` when the box lands and `stamp` on Open game, behind a small mute toggle in the ticker, unlocked by the first gesture. Asset: ZzFX.
3. <a id="home-8-10"></a>**HOME-8.10. On phones, the payoff lands where you can see it.** Medium · S. The sticky scene takes 283 px (34%) at 390×844 ([apps/web/src/lib/home/PixelStore.svelte:744](../../apps/web/src/lib/home/PixelStore.svelte#L744)), and the cover sits below the fold when you tap a tile, so the box pop usually happens off-screen. Deliver into the scene instead (the box on the counter or in the keeper's hands, and hide `.cover` under 720 px). Or order the areas scene, detail, games and make only the stage sticky (about 200 px, with the talk folded into a bubble). Keep the header on one row by moving the theme switch into the ticker. Asset: CSS.
4. <a id="home-8-11"></a>**HOME-8.11. The room shell gets an 8-bit variant.** Low · M. With the 8-bit theme, the join, lobby and loading screens are identical to Classic (byte-identical screenshots), because the room page never reads the theme and the 8-bit header styles key off `body:has(.pixel-store)` ([apps/web/src/routes/+layout.svelte:112](../../apps/web/src/routes/+layout.svelte#L112)). Compute the skin as `room ? gameSkin(room.gameId) : theme.value`, set `class:pixel` and `px-tokens` on `main.room`, and lazy-load the kit CSS only then. Style `.lobby`, `.join-panel`, `.roster` and the buttons with the kit panel and button and font. Swap ◈ for the store's `boxes/{gameId}.webp` sprite. Asset: existing sprites and CSS.

### 6.10 Cross-game art direction

<a id="art-1"></a>**ART-1. One moment-feedback vocabulary.** Every game should give the same six beats a motion, a sound and a line of text or aria: your turn, commit or lock, land or reveal, score, attack or penalty, and the end of a hand or match. Rules for every beat:
- Motion is transform or opacity, 400 ms or less, and fires on landing, not on revision. UNO ([UNO-8.1](#uno-8-1)), Catan ([CAT-C7](#cat-c7)) and Dominó ([DOM-C2](#dom-c2)) currently fire early.
- "Your turn" is only for the viewer.
- The end of a game shows the board first and the dialog second ([CN-C2](#cn-c2), [CAR-C1](#car-c1), [CAR-8.5](#car-8-5), [DOM-C7](#dom-c7)).
- Everything is driven by the revision- or event-gated feed, so reconnects stay silent ([B11](#b11), [B26](#b26)).

Current coverage, from the findings. Legend: ● good, ◐ partial or broken, ○ missing, – not applicable.

| Beat | UNO C / 8 | Catan C / 8 | Carcassonne C / 8 | Azul C / 8 | Codenames C / 8 | Sushi C / 8 | Little Secret C / 8 | Dominó C / 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Your turn | ○ / ● | ○ / ◐ | ○ / ○ | ○ / ○ | ○ / ○ | – / – | ○ / ◐ | ○ / ● |
| Land or reveal | ◐ / ◐ | ◐ / ◐ | ◐ / ○ | ◐ / ● | ◐ / ◐ | ○ / ◐ | ◐ / ◐ | ◐ / ● |
| Score | – / – | ○ / ◐ | ◐ / ◐ | ○ / ● | – / – | ○ / ◐ | ○ / ◐ | ○ / ○ |
| End or victory | ○ / ● | ○ / ● | ◐ / ◐ | ○ / ◐ | ○ / ○ | ○ / ◐ | ○ / ● | ◐ / ◐ |

Classic is the column that needs the work. The per-game Classic lists ([UNO-C4](#uno-c4)–[UNO-C6](#uno-c6), [CAT-C2](#cat-c2), [CAT-C8](#cat-c8), [CAR-C4](#car-c4), [AZ-C5](#az-c5), [AZ-C6](#az-c6), [CN-C2](#cn-c2), [CN-C3](#cn-c3), [SGP-C4](#sgp-c4)–[SGP-C7](#sgp-c7), [LS-C4](#ls-c4), [LS-C8](#ls-c8), [DOM-C5](#dom-c5), [DOM-C7](#dom-c7)) fill it.

<a id="art-2"></a>**ART-2. Sound palette.**
- Classic means physical materials, synthesized with `createAudio()` noise and tone, never files: wood tok, paper slide and riffle, ceramic clack, porcelain clink, felt thud, chalk, and a marimba or bell for score and win.
- Today several Classic packs play long low sines (75–220 Hz) at 0.03–0.04 gain, which laptop and phone speakers barely reproduce. Use bandpassed noise transients plus short tones above about 400 Hz, at a gain of about 0.06–0.12.
- 8-bit means ZzFX through one shared `chipVoice` ([S4](#s4)), with the same cue names across games: pick, lock, land, score, turn, attack, nope, win, lose. Never quote a known theme ([B37](#b37)).
- For both skins: at most one sound per accepted event batch (the most dramatic event wins); schedule from the motion's landing time; respect Sound, volume and mute in delayed timers; unlock on a gesture; no ambient beds. A very sparse, quiet, visible-tab-only ambience (Dominó crickets) is the one exception.

<a id="art-3"></a>**ART-3. Ambient motion budget.**
- About 6–10 animated nodes per idle table.
- Transform and opacity only.
- Outside the main SVG or canvas wherever possible. In Catan and Carcassonne, motion inside the filtered island SVG re-rasterizes it.
- Loops of 2 s or longer. In 8-bit, `steps()` timing and `steps(1)` toggles, never smooth tweens or rotation.
- Paused during pan, zoom and drag.
- Off under OS reduced motion and under each game's own Motion toggle, as one derived flag ([U75](#u75)).
- No infinite animations on box-shadow, margin, background or stroke ([P14](#p14)), and no per-element filters under moving things ([P13](#p13)).

<a id="art-4"></a>**ART-4. Fix "¡" in the three 8-bit fonts.** Medium · S. Jersey 10 and both Pixelify weights draw U+00A1 exactly like "i" (identical bitmaps), so Spanish headlines read "Amber igana!" and "iDOMINÓ!" ([apps/web/static/fonts/pixel/](../../apps/web/static/fonts/pixel/)). With fontTools, make U+00A1 a vertical flip of `exclam` that drops below the baseline, in all three WOFF2 files, re-export with the same `pyftsubset` step, and note it in the fonts README. This fixes nine `es` keys at once. Don't add a fallback face; a smooth "¡" would stand out. Asset: font edit.
_Src: gap4#1._

<a id="art-5"></a>**ART-5. Pixel-kit rules to enforce on review.** These are the rules several findings broke:
- Whole-pixel scales ([AZ-8.1](#az-8-1), [CAR-8.3](#car-8-3), [LS-8.3](#ls-8-3), [DOM-8.4](#dom-8-4)).
- No rotation ([CAR-8.1](#car-8-1), [CN-8.2](#cn-8-2)) and no blur or soft shadow ([CN-8.2](#cn-8-2), [CN-8.5](#cn-8-5)).
- `pixelated` only when upscaling ([CN-8.3](#cn-8-3), [HOME-8.5](#home-8-5)).
- Text stays real text ([HOME-8.3](#home-8-3)), using Jersey 10 for game chrome ([DOM-8.5](#dom-8-5)) and pixel icons rather than font glyphs ([S9](#s9)).
- Opaque chrome, never translucent ([CAT-8.3](#cat-8-3)).
- Original designs, no logos ([HOME-8.6](#home-8-6)).
- Gate Classic assets on the intended skin ([P2](#p2)).

<a id="art-6"></a>**ART-6. Asset production.**
- Prefer code-drawn SVG and synthesized sound.
- For new raster art, use the generator prompt recorded in each game's art doc (`docs/*-pixel.md`, [docs/games/catan-assets.md](../../docs/games/catan-assets.md), [docs/carcassonne-3d/README.md](../../docs/carcassonne-3d/README.md)), add the new prompt next to it, then:
  - Classic: encode with `cwebp -q 75–80 -m 6 -sharp_yuv`, right-sized for its largest DPR-2 use.
  - 8-bit: generate on magenta, key and quantize with the existing scripts ([S17](#s17)), and keep lossless.
- Record provenance next to the file.
- Small edits to existing pixel art (the empty lid, the UNO corner swap, the chopsticks cell) are faster in Pixelorama or LibreSprite than a regeneration.

## 7. Suggested batches

Each batch can ship on its own and is validated with `bun run check`, `bun run build` and a look in the browser at the sizes named in its items. The order is a suggestion: 1 and 2 first, then 3, which makes the rest easier to read.

**Batch 1. Quick wins (under 1 day).** Each item is small and independent.
[B2](#b2), [B8](#b8), [B10](#b10), [B12](#b12), [B14](#b14), [B15](#b15), [B21](#b21), [B22](#b22), [P1](#p1) (step 1), [P3](#p3), [U10](#u10), [U63](#u63), [U76](#u76) (the Azul picker and Catan civ tints), [UNO-C1](#uno-c1), [AZ-C1](#az-c1), [AZ-8.1](#az-8-1), [AZ-8.2](#az-8-2), [CN-8.1](#cn-8-1), [SGP-8.1](#sgp-8-1), [CAT-8.1](#cat-8-1), [HOME-8.1](#home-8-1), [LS-8.4](#ls-8-4), [R4](#r4), and the `fill="none"` arrow fix in [B17](#b17).

**Batch 2. Server, room shell and invite flow (2–3 days).** Crash containment first, then the guest's path from invite link to rematch.
[B1](#b1), [B3](#b3), [B30](#b30), [B5](#b5), [B6](#b6), [B7](#b7), [B28](#b28), [B29](#b29), [B33](#b33), [B32](#b32) (optional), [P8](#p8), [P18](#p18), [R15](#r15), [S8](#s8), [S14](#s14), [U1](#u1), [U2](#u2), [U3](#u3), [U4](#u4), [U5](#u5), [U6](#u6), [U7](#u7), [U8](#u8), [U79](#u79), [HOME-C4](#home-c4).

**Batch 3. Dead code and docs purge (about 1 day).** No behaviour change, so it is easy to review.
[R1](#r1)–[R21](#r21), [D1](#d1)–[D4](#d4), [S11](#s11), [S13](#s13), [S16](#s16), and [S17](#s17) (optional). Do [R3](#r3) after [AZ-C4](#az-c4).

**Batch 4. Shared table chrome, performance, layouts and accessibility (1–2 weeks; split by sub-list or by game).**
- 4a, chrome and performance: [B4](#b4), [B9](#b9), [B11](#b11), [B19](#b19), [B20](#b20), [S1](#s1), [S2](#s2), [S3](#s3), [S5](#s5), [S6](#s6), [S7](#s7), [S10](#s10), [S12](#s12), [S15](#s15), [P1](#p1) (step 2), [P2](#p2), [P4](#p4), [P5](#p5), [P6](#p6), [P7](#p7), [P9](#p9), [P10](#p10), [P11](#p11), [P12](#p12), [P13](#p13), [P14](#p14), [P15](#p15), [P16](#p16), [P17](#p17), [P19](#p19), [P20](#p20).
- 4b, phone, landscape and laptop layouts: [U15](#u15)–[U31](#u31).
- 4c, game UX, accessibility and i18n: [B13](#b13), [B17](#b17), [B18](#b18), [B23](#b23)–[B27](#b27), [B31](#b31), [B34](#b34), [B35](#b35), [U9](#u9), [U11](#u11)–[U14](#u14), [U32](#u32)–[U62](#u62), [U64](#u64)–[U78](#u78), [U80](#u80)–[U86](#u86).

**Batch 5. Classic art pass (1–2 weeks).** Sound palette first, then end-of-game moments, then per-game defects and polish.
- Sound ([ART-2](#art-2)): [UNO-C4](#uno-c4), [CAT-C8](#cat-c8), [CAT-C9](#cat-c9), [CAR-C7](#car-c7), [AZ-C6](#az-c6), [CN-C3](#cn-c3), [SGP-C4](#sgp-c4), [LS-C4](#ls-c4), [DOM-C5](#dom-c5), [DOM-C2](#dom-c2).
- Moments ([ART-1](#art-1)): [UNO-C6](#uno-c6), [CAT-C2](#cat-c2), [CAR-C1](#car-c1), [CAR-C4](#car-c4), [AZ-C5](#az-c5), [CN-C2](#cn-c2), [SGP-C5](#sgp-c5), [SGP-C7](#sgp-c7), [LS-C8](#ls-c8), [DOM-C7](#dom-c7).
- Defects and polish: [UNO-C2](#uno-c2), [UNO-C3](#uno-c3), [UNO-C5](#uno-c5), [UNO-C7](#uno-c7), [CAT-C1](#cat-c1), [CAT-C3](#cat-c3)–[CAT-C7](#cat-c7), [CAT-C10](#cat-c10), [CAT-C11](#cat-c11), [CAR-C2](#car-c2), [CAR-C3](#car-c3), [CAR-C5](#car-c5), [CAR-C6](#car-c6), [CAR-C8](#car-c8), [AZ-C2](#az-c2)–[AZ-C4](#az-c4), [AZ-C7](#az-c7), [CN-C1](#cn-c1), [CN-C4](#cn-c4)–[CN-C8](#cn-c8), [SGP-C1](#sgp-c1)–[SGP-C3](#sgp-c3), [SGP-C6](#sgp-c6), [SGP-C8](#sgp-c8), [LS-C1](#ls-c1)–[LS-C3](#ls-c3), [LS-C5](#ls-c5)–[LS-C7](#ls-c7), [LS-C9](#ls-c9), [DOM-C1](#dom-c1), [DOM-C3](#dom-c3), [DOM-C4](#dom-c4), [DOM-C6](#dom-c6), [DOM-C8](#dom-c8)–[DOM-C12](#dom-c12), [HOME-C1](#home-c1)–[HOME-C5](#home-c5), [B36](#b36), [B38](#b38).

**Batch 6. 8-bit art pass (1–2 weeks).** Kit-level fixes first, then per-game defects, then juice.
- Kit and sound: [ART-4](#art-4), [S4](#s4), [S9](#s9), [B16](#b16), [B37](#b37).
- Defects: [UNO-8.1](#uno-8-1)–[UNO-8.3](#uno-8-3), [CAT-8.2](#cat-8-2)–[CAT-8.6](#cat-8-6), [CAR-8.1](#car-8-1)–[CAR-8.4](#car-8-4), [AZ-8.3](#az-8-3)–[AZ-8.5](#az-8-5), [CN-8.2](#cn-8-2)–[CN-8.7](#cn-8-7), [SGP-8.2](#sgp-8-2)–[SGP-8.4](#sgp-8-4), [LS-8.1](#ls-8-1)–[LS-8.3](#ls-8-3), [LS-8.5](#ls-8-5), [DOM-8.1](#dom-8-1)–[DOM-8.6](#dom-8-6), [HOME-8.2](#home-8-2)–[HOME-8.7](#home-8-7).
- Immersion: [UNO-8.4](#uno-8-4)–[UNO-8.8](#uno-8-8), [CAT-8.7](#cat-8-7)–[CAT-8.9](#cat-8-9), [CAR-8.5](#car-8-5)–[CAR-8.10](#car-8-10), [AZ-8.6](#az-8-6)–[AZ-8.9](#az-8-9), [CN-8.8](#cn-8-8)–[CN-8.12](#cn-8-12), [SGP-8.5](#sgp-8-5)–[SGP-8.8](#sgp-8-8), [LS-8.6](#ls-8-6)–[LS-8.9](#ls-8-9), [DOM-8.7](#dom-8-7)–[DOM-8.12](#dom-8-12), [HOME-8.8](#home-8-8)–[HOME-8.11](#home-8-11).

## 8. Appendix

### Disputed items

None. No high-severity finding was refuted by the second checker.

### Refuted findings

Five findings were refuted or could not be verified. All five, with the reason:

1. **UNO 8-bit: "the wild orb and sapphire gem paint blue as teal and green as neon"** (uno:art-pixel#10). Pillow sampling of `cards.webp` cell 4 found the bottom-right quadrant mostly blue (2,104,246), with teal only on one facet; the sapphire is navy with a teal highlight. In an 8× enlargement and in the colour-choice screenshot, both read clearly as blue next to a blue underline and a text label. Only the orb's green is more saturated than the faces, which is a cosmetic nit, not a suit-identity defect.
2. **Sushi Go Party 8-bit: "phone zoom shrinks sprites with nearest-neighbour, breaking outlines and plate numbers"** (sushi-go-party:art-pixel#10). Every capture ran at device scale factor 1, which no real phone uses. At 390×844 and DPR 3 (and DPR 2), `pixelated` and `auto` renders are nearly identical, with outlines intact and the "5" clearly a 5; a 21.92 px piece is about 66 device px, close to 1:1 for a 64 px cell. Switching to `image-rendering: auto` would also break the pixel-kit rule.
3. **Little Secret Classic: "static desk with no lamp light, and no spotlight on the active speaker"** (little-secret:art-classic#10). The cited screenshot was the volunteer phase, which has no speaker. In a 9-seat clue-phase shot, the speaker's gold ring stands out and the panel names the speaker. `table.webp` already bakes a warm lamp pool. The speaker cue is covered by [LS-C5](#ls-c5) and [LS-C4](#ls-c4), and a permanently animated full-screen overlay costs more than it gives.
4. **Dominó 8-bit: "the bottle copies a real brewery's label"** (domino:art-pixel#13). The sprite is a 6×14 brown bottle with a white block, a 2×3 blue patch and one red pixel: no wordmark, bear or logo, so it meets the "no text, logos" rule. A code comment calling it "Polar-style" is a local cultural nod, not trade dress at this size. The 3D label is a different matter ([B36](#b36)).
5. **Home Classic: "on phones, tapping a game changes a half-visible box while its details and Start stay below the fold"** (home:art-classic#7). The tapped name changes colour and the whole box swaps in view at the top of the page; only the details and Start sit below the fold, which is normal mobile scrolling. Auto-scrolling on every tap would pull the list away while the user is still browsing names.

### Verification notes for this report

Before writing, the following were re-checked in the code at `34b3a2f` and match the findings:
- [B1](#b1): sirv's unguarded `pipe` and the synchronous-only try/catch.
- [B2](#b2): `scrollIntoView` plus `overflow: hidden`.
- [B3](#b3): the unguarded disconnect and interval handlers.
- [B5](#b5): `start()` and `expire()` seat handling.
- [B8](#b8): the unguarded Paraglide `localStorage` read and the strategy list.
- [B10](#b10): the powers check in `create()`.
- [B12](#b12): the podium sort against the engine's tie-break.
- [B14](#b14): `c === 4` in HelpScene.
- [P1](#p1): the dynamic `m[key]` lookup in the room `errorText()`.
- [P2](#p2): the `skin === 'pixel' && pixelReady` gate in Azul.
- [P3](#p3): `pixelIsland` derived from `pub.board`.
- [U10](#u10): the 80 ms hover selection.
- [U20](#u20): the Azul compact media query.
- [U63](#u63): the 8-bit Azul `focus-visible { outline: 0 }`.
- [CAT-C2](#cat-c2): the pixel-only result banner.

Everything else relies on the verifier notes attached to each finding. Line numbers are as reported or as corrected by the verifier.
