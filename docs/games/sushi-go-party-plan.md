# Sushi Go Party! implementation plan

Status: planned, not implemented. Researched September 11, 2026.

This document is the only deliverable of this session. All implementation,
dependency changes, artwork production, and application testing described below
belong to a later session. Creating this file does not authorize executing it.

## Outcome and edition

Interpret the requested “Sushi Go! extended version” as **Sushi Go Party!**, the
standalone expanded game with a configurable menu and support for **2–8 players**.
The publisher lists approximately 30 minutes and ages eight and up.
[Gamewright product page](https://gamewright.com/product/Sushi-Go-Party).

Deliver the entire standard Party! box's playable content, including its advanced
special cards, official menu presets, and legal custom menus. An initial simple
menu can be an implementation milestone, but is not completion of this plan.
Exclude separately distributed promotional cards, Sushi Roll, Spin Some for Dim
Sum, house-rule variants, bots, matchmaking, accounts, spectators, and tournaments.

The experience should feel like sharing a cheerful sushi feast: readable dishes,
quick private selection, simultaneous reveals, hands circulating around the
table, and clear explanations when combinations score. Support English and Spanish
from the first release. All rules stay identical when interface language changes.

Keep the existing Bun/TypeScript, SvelteKit, Socket.IO, Paraglide, and CSS/SVG/Svelte
architecture. No database, Redis, Rust/Wasm, WebRTC, or new extension framework.

## Sources and research confidence

| Source                                                                                                            | Purpose                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Gamewright Party! rulebook](https://gamewright.com/pdfs/Rules/SushiGoPartyTM-RULES.pdf)                          | Primary rules baseline. Read all nine PDF pages, representing printed pages 1–16.                                                                                                                          |
| [Devir Spanish Party! rulebook, mirrored by Garesys](https://garesys.com/media/rules/sushi-go-party-rules-sp.pdf) | Read the Spanish text to cross-check card behavior and terminology. Sixteen individual pages. The old Devir download URL did not load.                                                                     |
| [Gamewright Party! product page](https://gamewright.com/product/Sushi-Go-Party)                                   | Confirms the expanded edition, capacity, and physical contents.                                                                                                                                            |
| [Gamewright original Sushi Go! page](https://gamewright.com/product/Sushi-Go)                                     | Distinguishes the smaller original game; do not import its deck or tie-scoring conventions.                                                                                                                |
| [Tea/dessert discussion](https://www.reddit.com/r/boardgames/comments/kfvta6/sushi_go_party_rules_questions/)     | Supplemental clarification: a contributor identifying themselves as a Gamewright employee says Tea counts only this round's desserts and links a designer answer. Identity was not independently verified. |
| [Linked designer discussion](https://boardgamegeek.com/thread/1598237/tea-and-dessert)                            | Follow-up reference for Tea. The page resolved, but its discussion text was unavailable to the browser tool; do not claim direct verification of that answer.                                              |

Use printed page numbers below. The English PDF pairs two printed pages on most
PDF pages. Its setup/menu tables on printed pages 4–5 were checked visually as well
as through extracted text. Prefer the linked booklets to search snippets, which
can misread numeric tables and confuse Party! with the original game.

### Rules baseline in brief

Choose Nigiri, one roll, three appetizers, two specials, and one dessert. Play
three rounds: secretly choose, reveal together, resolve effects, and pass left.
Score the round, retain played desserts, and reshuffle the remaining cards with
new desserts. Highest final score wins; dessert-card count breaks ties.

| Players | Hand size | Dessert additions in rounds 1 / 2 / 3 |
| ------- | --------- | ------------------------------------- |
| 2–3     | 10        | 5 / 3 / 2                             |
| 4–5     | 9         | 5 / 3 / 2                             |
| 6–7     | 8         | 7 / 5 / 3                             |
| 8       | 7         | 7 / 5 / 3                             |

Exclude Spoon and Edamame at two players; exclude Menu and Special Order at seven
or eight. Numbered effects resolve in ascending printed priority. Stored utensils
activate only on later turns. Party! awards full tied roll/dessert points rather
than splitting them. Maki ties preserve the next distinct rank; Uramaki ties can
consume subsequent places. [English rules, printed pages 4–9](https://gamewright.com/pdfs/Rules/SushiGoPartyTM-RULES.pdf).

### Card coverage and scoring reference

All named types below belong in the release. Implement exact exceptions from the
referenced card guide, not just a general-purpose set counter.

| Family     | Cards and compact scoring reference                                                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nigiri     | Egg 1; salmon 2; squid 3.                                                                                                                                                                               |
| Rolls      | Maki: 6/3 at 2–5, 6/4/2 at 6–8. Temaki: most +4, fewest −4. Uramaki: race awards 8/5/2.                                                                                                                 |
| Appetizers | Tempura pairs 5; Sashimi triples 10; Dumpling 1/3/6/10/15; Eel −3 for one, 7 for two or more; Tofu 2/6/0; Onigiri distinct-shape sets 1/4/9/16; Edamame per-opponent scoring; Miso Soup collision rule. |
| Specials   | Chopsticks, Spoon, Menu, Special Order, Takeout Box, Wasabi, Tea, Soy Sauce.                                                                                                                            |
| Desserts   | Pudding most +6/fewest −6; Green Tea Ice Cream quartets 12; Fruit per-type counts 0/1/2/3/4/5+ score −2/0/1/3/6/10.                                                                                     |

Two-player games omit the negative Temaki/Pudding award. Edamame caps each card
at four; each surviving Miso Soup scores three. Takeout cards score two each;
Wasabi triples one Nigiri; Tea uses the largest color group; qualifying Soy Sauce
scores four per card. [Spanish guide, pages 8–16](https://garesys.com/media/rules/sushi-go-party-rules-sp.pdf).

## Work to settle before implementation claims full fidelity

The booklets establish the main rules but do not exhaustively specify every
physical inventory detail or unusual interaction. Begin the later session with
this bounded evidence pass. Record sources and expected outcomes in the future
`docs/games/sushi-go-party.md`; do not silently invent a rule or drop a card.

1. **Exact physical manifest.** Verify variant quantities for Nigiri, Maki,
   Uramaki, Onigiri, and Fruit, plus every action-priority number and scoring-color
   equivalence. The printed contents table gives family totals, not every variant.
   Use a publisher-supplied inventory or inspect documented physical cards. Do not
   assume all variants occur equally often. The complete box should reconcile to
   181 cards, distinct from its 22 menu tiles and printed Nigiri board area.
2. **Copied utensils.** Confirm what a Special Order copying a utensil becomes
   when returned to a hand and subsequently played. Separate a physical card's
   identity from its temporary copied state; do not permanently replace it with a
   newly manufactured utensil.
3. **Duplicate priorities and repeated utensils.** Confirm ordering when an
   original utensil and its copy have the same number, and legal multiple
   activations by one player. Do not use socket arrival time as a tiebreaker.
4. **Takeout and linked cards.** Confirm flipping only the Nigiri or only the Wasabi
   in a paired stack, along with subsequent availability of that Wasabi. Cover
   boxed desserts, boxed copies, and a copy whose source is boxed.
5. **Degenerate rankings.** Confirm all-zero Uramaki at round end and all-equal
   Temaki/Pudding counts, especially at two players. Keep these distinct from
   ordinary positive ties. Confirm Tea's current-round dessert treatment through
   an accessible publisher/designer clarification if possible.

If an authoritative clarification remains unavailable, write a named, deterministic
app convention, its effect on play, and a regression fixture before implementing
that branch. Disclose material deviations in help. Do not label such a convention
as a verified publisher rule. The rest of implementation can proceed independently
of a narrowly affected interaction.

## Product flow and visual design

### A bright sushi table

Use an original illustration system: smiling food silhouettes in SVG, warm ivory
cards, dark seaweed text, coral controls, soft mint surfaces, and a restrained
indigo table border. Add subtle ceramic-plate shadows and a lightly textured table
surface through CSS. Create original art; do not extract commercial card faces.

Colors have scoring significance, so preserve the verified card-color equivalence
groups even if the visual palette is restyled. Encode the scoring group in data,
give it an icon/pattern and a text label, and never infer it from CSS color values.
For example, visually distinct Nigiri variations must still behave as the same
scoring color. Copies use the copied card's scoring identity.

Cards should show the dish, icon count/shape where relevant, a short scoring strip,
and priority number when needed. Large, readable food art takes priority over
ornamental motion. Use rounded display typography for titles and a readable system
font for rules and controls. Explanations must fit without shrinking text to make
the artwork larger.

Desktop layout: the viewer's hand fills the lower edge; their collected dishes sit
above it; opponents occupy stable seats around the outer table. The center holds
the menu, a compact round/turn indicator, and special-action prompts. Keep the
scoreboard and dessert collections visible. A discreet clockwise direction marker
shows the next recipient of the hand.

Mobile layout: a horizontally scrollable, generously sized hand above a fixed
action area; the viewer's dishes and compact opponent trays above; menu and score
details in accessible sheets. Never shrink eight full tableaus into unreadable
postage stamps. Each opponent tray opens a complete public tableau, and comparison
views make roll counts and color groups easy to inspect. Keep seat order stable.

### Screens and controls

1. **Catalog and room lobby.** Show an original sushi-platter preview, the Party!
   name, capacity, and a short localized description. Reuse names, invite links,
   reconnect credentials, and the host's room-start action.
2. **Menu setup inside the game.** Host start opens a game-owned setup phase before
   dealing. Any seat can propose a valid menu; the accepted change clears everyone's
   readiness. Everyone approves the visible menu before the deal. This avoids
   adding a generic catalog-wide configuration framework or making the host a
   privileged rules actor.
3. **Menu browser.** Offer all eight printed presets: My First Meal, Sushi Go!,
   Party Sampler, Master Menu, Points Platter, Cutthroat Combo, Big Banquet, and
   Dinner for Two. Import their exact compositions from printed pages 3–4 during
   the evidence pass. Default to My First Meal. Filter eligibility by actual
   players and explain unavailable dishes. A custom menu has fixed category slots,
   prevents duplicate selections, and displays each dish's short rule and full
   help. Clearly distinguish the chosen menu from the special card called Menu.
4. **Drafting.** Tap/click or keyboard-select a card, inspect its rule, then use
   “Keep this dish” to lock it. Selection remains editable until submission; an
   accepted choice is final. Other seats see only a ready indicator. Public score
   previews may use already revealed tableaus, but never unseen picks or hands.
5. **Special Order selection.** A primary pick needs a copy target selected from
   the owner's already played cards before commitment. Show a ghost copy and
   exactly what it will become. A target is private until reveal. A no-target
   first-turn play follows the booklet's discard behavior instead of deadlocking
   the only remaining card.
6. **Utensil declaration.** During pick confirmation, optionally arm eligible
   previously played utensils. Commit those declarations with the primary pick;
   this is the app's explicit equivalent of calling out during simultaneous
   reveal. Keep them hidden until everyone's pick is locked. Choose additional
   cards and Spoon requests only when their resolving action permits it, after
   the primary reveal. Do not force players to preselect the Chopsticks bonus card.
7. **Reveal and resolve.** Turn over everyone's primary pick together. Present
   interactive special effects one at a time in authoritative order; other
   players see a concise explanation of who is deciding and why. Do not add a
   global “Continue” click between automatic effects.
8. **Special prompts.** Menu presents its private offer; Spoon provides a type or
   specific-variant request and, when required, a private choice for the supplying
   player; Chopsticks highlights the owner's remaining hand; Takeout previews
   eligible flips and their effect; a bonus Special Order prompts for its target
   at the point of play. Include explicit “Flip none” for Takeout. Never show
   anyone an opponent's entire hand to facilitate a Spoon request.
9. **Pass.** After the effect queue completes, circulate card backs along short
   paths and reveal only the new owner's hand. Passing always uses the defined
   seat order. No alternating direction by round and no passing while effects
   still require the current hands.
10. **Round receipt.** Show an itemized score breakdown and a small score-track
    movement. Separate points already awarded during the round from points now
    added. Preserve a clear “Desserts saved” area with collection round recorded.
    All seats ready for the next round; do not score again when they click ready.
11. **Final receipt.** Add desserts after the third round; show total scores,
    dessert-card tiebreak counts, and winners. If still tied after the printed
    tiebreak, declare shared winners as a documented app convention. The existing
    host rematch action creates fresh menu setup, scores, cards, and game state.

### Motion that communicates play

| Trigger               | Animation and intent                                              | Target timing  |
| --------------------- | ----------------------------------------------------------------- | -------------- |
| Accepted initial deal | Card backs fan into hands; only the viewer's faces appear         | 350–500 ms     |
| Local selection       | Lift and outline the card; keep it readable                       | 120–160 ms     |
| Accepted pick         | A face-down dish settles at that seat, with a ready check         | 160–220 ms     |
| Batch reveal          | Flip all primary selections together, then settle onto plates     | 250–350 ms     |
| Valid set formed      | Brief outline joins the relevant cards; no misleading final score | 180–240 ms     |
| Wasabi attachment     | Nigiri slides into a clearly linked stack                         | 200–300 ms     |
| Miso collision        | A short puff and discard movement for affected cards              | 250–350 ms     |
| Special resolves      | Spoon exchange, Takeout fold, or a labeled copy transition        | 250–400 ms     |
| Hand passes           | Identical-backed bundles move to the next seats                   | 300–450 ms     |
| Score awarded         | Tokens travel to the score counter; numeric total settles         | 350–600 ms     |
| Match ends            | Brief original confetti and winning-plate highlight               | Under 1 second |

Generate typed, game-owned presentation events only from accepted actions. Project
them through the same private/public boundary as state. Use match, draft-round,
turn, and event sequence identifiers so retries and repeat snapshots never replay
effects. Animate consecutive state transitions only; on reconnect, gaps, seat
changes, resizing, or preference changes, cancel obsolete movement and render the
latest accepted state.

Authoritative state updates immediately. Animation must not determine scoring,
delay server decisions, or require an acknowledgement to progress. Maintain a
short ordered visual queue without concealing controls for the current state;
cancel old effects when they would obscure an active prompt. Use transforms and
opacity with CSS/Svelte or Web Animations. A continuously scrolling conveyor,
physics simulation, or new animation dependency is unnecessary.

Respect `prefers-reduced-motion` and a per-game motion setting. Replace travel,
flips, and confetti with immediate updates or brief fades. Optional soft ceramic,
paper, and scoring sounds require a user gesture to unlock, have a mute control,
and cannot block play when audio fails. Save only presentation preferences.

### Accessibility requirements

- All choices work with keyboard, pointer, and touch; dragging is optional, never
  required. Visible focus and at least 44-pixel primary targets.
- Give every card a useful accessible name with its dish, variation, and rule.
  Faces, scoring colors, and shapes have textual equivalents.
- Keep selection distinct from commitment. Focus the relevant prompt without
  stealing focus for cosmetic events. Restore focus when help/settings close.
- Use restrained live announcements for reveals, whose special action is pending,
  passing, and scoring; do not announce an opponent's secret or every decorative
  token individually.
- Test 360-pixel phones, landscape, tablets, desktop, browser zoom, eight long
  player names, and Spanish text expansion. No clipped confirmation controls.

## Game engine and information boundaries

Create `games/sushi-go-party` under the existing `GameDefinition` contract.
Suggested focused modules: `cards.ts`, `menus.ts`, `scoring.ts`, `index.ts`, and
`presentation.ts`, with tests beside the relevant behavior. Keep card definitions
as data and resolution as clear game-specific code, not a universal card engine.

Canonical state owns the fixed seat order, chosen menu, physical card manifest,
deck, dessert reserve, discard zones, hands, committed picks, utensil declarations,
tableaus, copy snapshots, Wasabi links, dessert collection rounds, scores, effect
queue, current prompt, result breakdowns, and presentation events. All randomness
is supplied explicitly. `isFinished` is true only after the third round and final
dessert scoring; `RoomView.round` remains the whole-match/rematch epoch.

Use phases such as `menuSetup`, `draft`, `resolve`, `roundResult`, and `finished`.
Simultaneous revelation and passing can be atomic transitions/events instead of
server phases that wait for animation. The resolver runs until the next legitimate
player decision, then stores a typed continuation. This must survive reconnects
without replaying a draw or partially applying an exchange.

### Turn resolution requirements

- Freeze all primary picks and declared eligible utensils before revealing any.
  Evaluate simultaneous primary Uramaki outcomes as a batch; server arrival order
  must not decide who won a simultaneous race.
- Use the verified numeric-priority data to order interactive effects. Extra plays
  can introduce further effects; insert them at the legally correct point in the
  remaining resolution, never restart already completed actions. Newly played
  stored utensils cannot be activated during their acquisition turn.
- Maintain a turn-wide Miso ledger, including extra plays and copies. Do not forget
  a collision after those cards enter the discard pile, or allow a third soup to
  survive because the first two were already removed. Earlier-turn soups remain
  a separate cohort.
- Separate simultaneous primary race evaluation from immediate bonus-play awards.
  Store consumed Uramaki award places and discard cards once, with a distinct
  round-end award path; never replay immediate points in the round receipt.
- Give each Menu resolution a private offer zone. Return unchosen cards to the
  correct deck and apply explicit randomness. Do not silently draw from discards
  or the dessert reserve. Prove deck sufficiency for legal menus and all rounds;
  a defensive invariant failure must not invent replacement cards.
- Compute the first eligible Spoon supplier on the server. Prompt that supplier
  only if there is a real choice among matching variants. A player cannot falsely
  deny holding a match, and the requester cannot target an arbitrary opponent.
- Freeze a Special Order's copied identity and icons at its legal targeting moment.
  Do not keep a live pointer that changes when its source is subsequently boxed.
  Resolve copied cards through their actual behavior rather than copying a cached
  score. Copied desserts affect later-round deck size.
- Track `playedTurn`, `collectedRound`, effective color, boxed status, source
  identity, and links separately. These establish eligibility and scoring without
  consulting a Svelte component or relying on visual stack position.
- Recombine the actual eligible cards between rounds, including unused deck and
  discards, while retaining effective dessert collections. Reset temporary copy
  and boxing state only when the physical card legitimately reenters the deck.
  Do not regenerate a full fresh manifest and duplicate retained cards.

The behavior sources for these implementation tests are the English special-action
section and the Spanish card-guide sections, especially the interaction notes on
printed pages 13–15. Any unresolved branch listed earlier must gain an explicit
recorded answer before it is presented as implemented correctly.

### Public and private views

| View        | Permitted information                                                                                                                                             |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Everyone    | Menu, seat order, round/turn, cumulative scores, revealed tableaus, saved desserts, public discards, ready flags, revealed effects, and final score explanations. |
| A seat      | Its current hand, its committed selection/declarations, its private Menu offer or supplier choices, and legal actions for its current prompt.                     |
| Host        | The same seat view plus ordinary room controls; no deck inspection or opponent-hand access.                                                                       |
| Server only | Other hands, unannounced picks/targets, deck order, dessert reserve order, random state, and unselected private offers.                                           |

Construct projections with allowlists. Never broadcast canonical hands and hide
them in the UI. Public ready events cannot contain selected card IDs, variants,
copy targets, utensil choices, preview scores, or card-specific asset requests.
All publicly known card faces may be in the lazy game bundle; the secret is their
location and selection, not the existence of the artwork.

Use opaque instance IDs that do not encode dish or deck position. Avoid exposing
stable hidden IDs that let a previous hand owner track that hand after it has been
passed away. Rotate recipient selection handles when ownership changes, or use
turn-scoped handles; validate them only against the current hand/prompt. Public
revealed objects can have stable IDs for animation and copying.

On passing, replace the recipient's hand projection instead of appending histories
of opponents' hands. Keep only legitimately public history for receipts and
effects. Private choices must not enter URLs, persistent browser storage, public
logs, generic error text, or analytics. Reconnect projects the same canonical state
for the restored seat; it does not reveal everyone's hand to resynchronize.

## Sessions, concurrency, and integration

The current [room authority](../../apps/server/src/rooms.ts) requires an exact
revision for every action. Simultaneous picks/readiness can legitimately race.
Preserve revision enforcement and identity binding; solve the resulting stale
responses deliberately rather than changing all games to last-write-wins.

For a stale rejection, retain the original action ID and intention, fetch/wait for
the latest snapshot, and retry only if match, draft-round, turn, prompt, ownership,
and uncommitted status still match. Bound automatic retries, then offer a clear
manual retry. Never resubmit an old pick after hands pass. Use a structured stale
error code if needed; do not match localized error strings. Unknown timeouts require
resynchronization and checking acceptance before another action. Reuse existing
deduplication so a retry cannot draw, swap, score, or advance twice.

A missing required seat pauses selection or its pending special choice. Show the
disconnected seat and reservation status. Keep already committed actions intact.
Use existing reconnect-token and expired-seat replacement semantics: replacements
inherit the same seat, hand, score, and pending choice; old credentials lose access.
Do not redeal, auto-pick, discard someone, or let the host see their cards.

Require connected, ready seats before menu setup deals or another round begins.
Clear unconsumed readiness after replacement through the narrowest room integration
needed. Socket code owns presence; pure rules own card eligibility. Preserve the
existing host migration and in-memory lifetime, including loss on server restart.

| Repository location                                                                                             | Planned change for the later session                                                                     |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `games/sushi-go-party/package.json` and `src/`                                                                  | Rules, projections, data, tests, lazy Svelte board, original SVG and game-local styling/effects.         |
| `apps/server/src/index.ts`, `apps/server/package.json`                                                          | Register the game and workspace dependency.                                                              |
| `packages/shared/src/index.ts`                                                                                  | Metadata-only `sushi-go-party` entry, capacity, description, and platter preview.                        |
| `apps/web/src/lib/games.ts`, `apps/web/package.json`                                                            | One dynamic import for the board and its dependency.                                                     |
| `apps/web/src/routes/+page.svelte`                                                                              | Catalog preview; no eager imports of game rules or UI.                                                   |
| `apps/web/src/routes/room/[id]/+page.svelte`                                                                    | Preserve room controls and render game-owned setup/table/results.                                        |
| `apps/web/src/lib/session.svelte.ts`, server socket/room files                                                  | Narrow stale-error/retry and readiness-boundary changes only where needed.                               |
| `packages/shared/messages/en.json`, `es.json`                                                                   | Card explanations, menus, prompts, errors, receipts, help, and settings through Paraglide.               |
| `tests/e2e/sushi-go-party.spec.ts`, server tests                                                                | Real browser/session tests for drafting, privacy, special choices, and reconnection.                     |
| `README.md`, `docs/architecture.md`, `docs/validation.md`, `docs/games/sushi-go-party.md`, affected `AGENTS.md` | Document implemented behavior, evidence, conventions, and architecture changes when they actually exist. |

Reference the current [architecture](../architecture.md),
[game contract](../../packages/game-core/src/index.ts), and
[validation guide](../validation.md). Reinspect code and instructions at execution
time: unrelated changes already exist, and the Azul, Codenames, and Little Secret
documents are plans rather than implemented dependencies. Do not assume their
proposed session changes have already landed.

Use `bun install` later for workspace linkage and its lockfile update. The required
work should fit existing dependencies; no optional plugin installation is needed.

## Ordered implementation milestones

1. **Rules and manifest.** Resolve the bounded evidence checklist, build the exact
   manifest/menu data, record the card-color groups, and define fixtures for all
   known tricky branches. Exit: evidence-backed deck conservation and an explicit
   answer or disclosed convention for each ambiguous interaction.
2. **Deterministic basic drafting.** Build menu validation, simultaneous picks,
   hand passing, straightforward card scoring, dessert retention, and three-round
   results with private projections. Exit: complete seeded simple-menu matches
   at each capacity; no private data leaks. This is an internal milestone only.
3. **All advanced cards.** Add the continuation-based resolver, utensils, private
   Menu offers, Spoon supplier decisions, copies, boxing, Miso cohorts, and Uramaki
   awards. Exit: every boxed card and all menu presets are playable with targeted
   interaction tests; no placeholder or disabled standard dish.
4. **Rooms and complete UI.** Wire server/catalog/client registration, concurrent
   submissions, reconnect behavior, menu setup, drafting, special prompts, and
   receipts. Add English/Spanish copy and responsive keyboard-accessible controls.
   Exit: a group can finish any supported menu without developer tools.
5. **Visual finish and motion.** Apply original food art, table composition,
   coherent scoring colors, synchronized reveals/pass animations, effects, and
   sound/motion settings. Exit: eight seats remain readable and reduced-motion,
   silent, and reconnecting clients function correctly.
6. **Verification and documentation.** Run the relevant checks, real group
   playtests, mobile/Safari review, and update the affected docs. Exit: actual
   results and remaining external validation are recorded accurately.

## Test and review plan

### Pure rules and scoring

Use hand-built behavioral fixtures and supplied random seeds, not tests that simply
read the same implementation table and compare it to itself.

- Validate every preset and category constraint at each supported player count;
  reject unknown dishes, duplicate menu types, illegal capacities, and malformed
  actions. Check manifest quantities and icon/shape/color groups independently.
- Assert hand size and dessert schedule; card conservation across all zones,
  including private offers, copies retained as desserts, boxes, and discards.
- Complete three-round matches at 2, 3, 4, 5, 6, 7, and 8 players. Passing never
  changes direction; primary picks stay secret until everyone commits.
- Cover empty, incomplete, complete, repeated, and overfilled sets for Tempura,
  Sashimi, Dumplings, Eel, Tofu, Onigiri, and Ice Cream. Partition repeated Onigiri
  shapes into optimal disjoint sets without double-counting cards.
- Compare roll rankings with ties and zero holdings; distinguish Maki's distinct
  ranks from Uramaki's consumed award slots. Test simultaneous crossings with
  different icon totals, exact ties, repeated awards to one seat, and round-end
  residual scoring. Never award immediate points twice.
- Test Edamame's opponent count and cap, multiple qualifying Soy Sauces, and Tea
  with Nigiri/Wasabi, copies, boxes, and this-round versus prior-round desserts.
- Cover dessert penalties, Fruit icon multiplicity and absent fruit types, final
  dessert-card tiebreak versus dessert points, and shared final winners.
- Exercise the full special-action matrix: original/bonus/copy sources; same-turn
  Miso collisions including a third soup; forced ordinary Wasabi attachments and
  the guide's distinct Special Order/Nigiri cases; no reuse of a fresh utensil;
  failed Spoon requests; general versus exact variant requests; private Menu
  offers; chained extra effects; legal Takeout targets; copied-card lifecycle.
- Ensure every rule rejection preserves state and random consumption expectations.
  Score receipts should reconcile exactly to canonical score deltas.

### Session, privacy, and browser checks

Use independent socket clients to submit concurrent picks and special responses.
Cover stale revisions, retry IDs, double-clicks, spoofed actors, stale turn/prompt
handles, disconnect before/after commitment, reconnect during a private offer,
expired-seat replacement, and host migration. Inspect actual recipient payloads;
CSS concealment is insufficient.

Create isolated test fixtures using the same rules. Do not add production debug
endpoints or secret fixture payloads to catalog metadata. Browser checks should
cover:

- A complete simple-menu game, including final dessert scoring and rematch.
- Advanced Menu/Special Order flows at two players and Spoon/Chopsticks at eight.
- Custom menu validation and eligibility feedback when roster size changes.
- Exact private pick/reveal boundary and hand ownership after passing.
- Reconnect during drafting, Menu selection, and Spoon supplier choice.
- Card details, copy preview, Takeout selection, score receipt explanations,
  English/Spanish language switching, keyboard-only play, and narrow layouts.
- Motion deduplication, reduced motion, mute, unavailable audio, and cancellation
  of old effects on synchronization or resize.
- Catalog lazy loading plus UNO/Catan regression coverage.

Run from the root during implementation:

```sh
bun run check
bun run test
bun run build
bun run test:e2e --project=chromium
bun run test:e2e --project=webkit
bun run format:check
```

Format changed maintained files before the final formatting check. Run targeted
tests while developing and the required broader checks once ready; repeat passing
checks only for new changes or evidence. Document unavailable checks as unverified.

Chrome and Safari are required targets. Chromium and WebKit automation must pass;
actual macOS/iOS Safari review separately checks touch, scrolling sheets, card
readability, focus, resizing, and gesture-unlocked audio. Record manual validation
honestly. Conduct real group playtests with a simple and advanced menu, including
eight-player readability and Spanish explanations. Assess whether players can
understand waiting states and score changes without someone interpreting the app.

## Definition of done

- The complete standard Sushi Go Party! box works for 2–8 players with legal
  presets/custom menus, exact inventory, three-round flow, and explained scoring.
- Every nontrivial interaction has a tested rule outcome, and material conventions
  are distinguished from publisher rules.
- The UI feels lively through synchronized reveals, passing, and scoring while
  remaining readable, accessible, and correct without motion or sound.
- Hidden hands, picks, copy targets, and private offers remain private in every
  state/event/reconnect path.
- Required rule/session/browser/build checks pass, and manual device/playtest
  evidence or limitations are documented.

This session creates only this plan. No application implementation has started.
