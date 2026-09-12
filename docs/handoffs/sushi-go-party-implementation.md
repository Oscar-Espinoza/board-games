# Sushi Go Party implementation handoff

Planning completed 2026-09-12. **Implementation now exists; the current delivery
record at the end of this file supersedes the planning checklist below.**
Successor: Medium implementation agent. Work only in
`/home/oscar/Projects/board-games-three-games/sushi-go-party`, branch
`feature/sushi-go-party`. Ports: server 3013, Vite 5183, production/e2e 3113.
The coordinator owns shared stale errors/retries and room presentation integration.
Keep shared registration/translations in a separate commit from game implementation.
First cherry-pick coordinator commit `ef5a1be` into the game worktree. It supplies
the agreed retry guard, authenticated sync/acceptance checking, corner room controls
and six-game library CSS. For `+page.svelte`, add only Sushi summary/loop data;
leave the shared library CSS to the coordinator.

Read `AGENTS.md` and the entire `docs/games/sushi-go-party-plan.md` in that worktree.
The user's current implementation authorization supersedes the old plan's
“planning only” restriction. Full standard Party box, 2–8 players, all advanced
cards, all eight presets and legal custom menus are required. A basic draft game
is an intermediate milestone. No promo cards, multiplayer bots or extra extensions.

## Agreed coordinator interface — preserve these names

The coordinator confirmed this contract on 2026-09-12 and is implementing the
shared client guard against it. Tell the coordinator before changing it.

```ts
type Pick = {
  type: 'PICK';
  round: number; // game draft round, not RoomView.round
  turn: number;
  promptId: string;
  card: string; // current private hand handle
  copyTarget?: string; // public already-played own card ID
  utensils: string[]; // REQUIRED; empty allowed; public eligible utensil IDs
};
type Ready = { type: 'READY'; round: number; version: number };

type PublicRetryFields = {
  phase: 'setup' | 'draft' | 'resolving' | 'round-end' | 'finished';
  round: number; // setup 0; draft/receipt rounds 1, 2, 3
  turn: number;
  setupVersion: number; // all readiness boundaries use this version
  ready: string[];
  committed: string[]; // seat IDs only
  prompt: { id: string; actorId: string; kind: string } | null;
};
type PrivateRetryFields = {
  hand: Array<{ handle: string /* plus dish data, never canonical ID */ }>;
  pickPromptId: string | null;
  committed: null | { card: string; copyTarget?: string; utensils: string[] };
  legalUtensils: string[];
  copyTargets: Array<{ id: string /* plus copied public identity */ }>;
};
```

The **match epoch is `RoomView.round`**, while the game owns `public.round`.
Room revision enforcement remains intact. Same action ID across at most three
total automatic attempts. PICK retry requires identical room, seat, match epoch,
draft round, turn, `phase === 'draft'`, matching private pick prompt ID, no private
commitment, seat absent from public committed list, selected handle still in hand,
each declared utensil still legal, copy target still legal if supplied, and every
required seat connected. READY retry requires unchanged setup/round-end phase,
draft round and `setupVersion`, seat absent from ready, and connected seats.
No automatic retry for configuration changes or resolving choices. Unknown
timeouts require resynchronization and acceptance checking, not blind retry.
The server validates these conditions independently; client guards are UX only.

Use `SET_MENU {version, menu}` only in setup. Use
`RESOLVE {round, turn, promptId, choice}` for actor-owned continuation prompts;
give each prompt a fresh opaque ID. `choice` should be a discriminated union for
Chopsticks card, Menu offer card, Spoon request, Spoon supplier card, Takeout card
IDs, and bonus Special Order target/attachment. Reject malformed/extra secret
references without mutating state. For the booklet's optional copied-Nigiri
attachment, expose a separate legal attachment RESOLVE prompt after revealing the
frozen copy. This preserves the agreed PICK shape and still lets the player choose
whether to attach when the copied source was unattached. Do not infer a hidden
attachment choice in the shared retry guard.

`GameDefinition.presence(state, connectedPlayers, replacedPlayer?)` already
exists, and Rooms calls it for reconnect/disconnect/replacement. Persist a
game-owned connected-seat allowlist; block picks/special responses while a seat
is missing. Preserve commitments and pending offers. At setup/round-end replacement,
clear unconsumed readiness and increment setupVersion. Every menu change clears
readiness and increments setupVersion; every new receipt does the same. A READY
action adds one seat; the final READY deals only if all seats remain connected.

Board receives existing `view`, `playerId`, `players`, `send`, `locale`, `round`
(match epoch), `connected`, `pending`, `practice`, `canConfigure`, plus coordinator
additions `canRematch: boolean` and `rematch: () => Promise<void>`.
Render `settingsContent` in the upper-right settings sheet: it provides language,
invite, leave, rematch, connection and room ID. The coordinator hides persistent
room toolbar/roster for the three new games. Do not duplicate that toolbar.

## Bounded evidence pass

The [Gamewright booklet](https://gamewright.com/pdfs/Rules/SushiGoPartyTM-RULES.pdf)
was downloaded and its full card-guide text inspected; printed pages 2–5 were
also rendered and visually checked. Follow the original plan's scoring baseline
and this booklet. Do not use search-result OCR to transcribe tables: several
results replaced real card effects with invented text. Publisher/designer
clarifications for the unusual branches below were not accessible. Those branches
have named app conventions below; do not advertise them as verified official rules.

### Physical inventory

Direct photographs of the physical cards were viewed, including every icon and
priority entry below. These are component observations, not endorsement of the
seller's authenticity claim. Keep links as evidence; do not ship the photographs
or use them as application artwork.

| Type        | Exact physical variants                                                                                                   | Direct photograph/listing                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Nigiri      | Egg 4, Salmon 5, Squid 3                                                                                                  | [Egg](https://www.ebay.com/itm/264722209131), [Salmon](https://www.ebay.com/itm/264722241628), [Squid](https://www.ebay.com/itm/264722260426) |
| Maki        | One icon 4, two icons 5, three icons 3                                                                                    | [12-card photo](https://www.ebay.com/itm/264722208416)                                                                                        |
| Uramaki     | Three, four, five icons: 4 each                                                                                           | [12-card photo](https://www.ebay.com/itm/264722287346)                                                                                        |
| Onigiri     | Circle, triangle, square, rectangle: 2 each                                                                               | [8-card photo](https://www.ebay.com/itm/264722273028)                                                                                         |
| Fruit       | Watermelon/orange 3; watermelon/pineapple 3; orange/pineapple 3; double watermelon 2; double orange 2; double pineapple 2 | [15-card photo](https://www.ebay.com/itm/254589126062)                                                                                        |
| Chopsticks  | Priorities 1, 2, 3: one each                                                                                              | [3-card photo](https://www.ebay.co.uk/itm/254589124001)                                                                                       |
| Spoon       | Priorities 4, 5, 6: one each                                                                                              | [3-card photo](https://www.ebay.com/itm/264722281600)                                                                                         |
| Menu        | Priorities 7, 8, 9: one each                                                                                              | [3-card photo](https://www.ebay.com/itm/264722280328)                                                                                         |
| Takeout Box | Priorities 10, 11, 12: one each                                                                                           | [3-card photo](https://www.ebay.com/itm/264722284396)                                                                                         |

Remaining family totals are in the supplied plan/booklet: Temaki 12; each of
Tempura, Sashimi, Dumpling, Eel, Tofu, Edamame, Miso Soup 8; each of Special Order,
Wasabi, Tea, Soy Sauce 3; Pudding and Green Tea Ice Cream 15 each. Reconcile
`12 + 36 + 64 + 24 + 45 = 181`, excluding 22 menu tiles. A selected menu has 54
non-dessert physical cards before retained Special Orders remove any.

Scoring colors are explicit semantic data. All Nigiri and Wasabi share one
yellow group (booklet's Tea example). Every other base type has its own group;
all variants of a type share it; a copy takes its frozen effective group. Visual
cross-check: [complete printed card-face sheet](https://mathom.es/7139-thickbox_default/sushi-go-party.jpg).
Do not merge near hues: Uramaki chartreuse/Sashimi lime/Tofu green are separate;
Temaki plum/Edamame purple/Eel indigo are separate. Draw pattern labels so the
groups stay identifiable without color vision. Boxed-color behavior is C6 below.

### Presets (Nigiri included in every row)

Transcribed from the visually checked publisher setup spread. Capacity limits
derive from included cards; “works well with” is a recommendation, not a hard ban.

| Preset          | Roll    | Appetizers                  | Specials            | Dessert             | Legal seats |
| --------------- | ------- | --------------------------- | ------------------- | ------------------- | ----------- |
| My First Meal   | Maki    | Tempura, Sashimi, Miso Soup | Wasabi, Tea         | Green Tea Ice Cream | 2–8         |
| Sushi Go!       | Maki    | Tempura, Sashimi, Dumpling  | Chopsticks, Wasabi  | Pudding             | 2–8         |
| Party Sampler   | Temaki  | Tempura, Dumpling, Tofu     | Wasabi, Menu        | Green Tea Ice Cream | 2–6         |
| Master Menu     | Temaki  | Onigiri, Tofu, Sashimi      | Spoon, Takeout Box  | Fruit               | 3–8         |
| Points Platter  | Uramaki | Onigiri, Dumpling, Edamame  | Special Order, Tea  | Green Tea Ice Cream | 3–6         |
| Cutthroat Combo | Temaki  | Eel, Tofu, Miso Soup        | Spoon, Soy Sauce    | Pudding             | 3–8         |
| Big Banquet     | Maki    | Tempura, Dumpling, Eel      | Spoon, Chopsticks   | Green Tea Ice Cream | 3–8         |
| Dinner for Two  | Uramaki | Onigiri, Tofu, Miso Soup    | Menu, Special Order | Fruit               | 2–6         |

### Explicit app conventions and fixtures

The bounded search included copy-return, duplicate numbers, Takeout/Wasabi,
zero Uramaki and Tea/dessert. [Designer Tea thread](https://boardgamegeek.com/thread/1598237/tea-and-dessert)
again returned no readable discussion; secondary summaries cannot establish a
designer ruling. Implement these deterministic branches and disclose C1–C6 in
the searchable advanced help. Replace a convention only with attributable primary
evidence and an updated fixture.

| ID                      | App convention / exact expected regression                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1 Copy return          | A physical Special Order copying a utensil reverts to Special Order immediately upon return to a private hand. It may subsequently copy a new target. Test original utensil and copy exchanging through different hands; physical count remains unchanged.                                                                                                                                                      |
| C2 Repeated activations | A seat may declare multiple distinct eligible utensils, each at most once that turn. Sort by printed copied/original priority, then fixed canonical seat index, then public acquisition sequence within a seat. Arrival time never matters. Newly acquired utensils cannot activate that turn. A declaration without an available Chopsticks bonus card is illegal; a failed Spoon request discards that Spoon. |
| C3 Linked boxing        | Each previous-turn card can be boxed independently. Boxing Nigiri breaks its attachment and frees an unboxed Wasabi for a later Nigiri; boxing Wasabi removes the surviving Nigiri's multiplier. Boxing both yields 4. No retroactive attachment of a Nigiri already played elsewhere. Test all three plus a later attached Nigiri.                                                                             |
| C4 Degenerate rankings  | All-equal Temaki/Pudding scores net zero at 3+ seats (both awards apply); at 2 seats both gain the positive award, including all-zero counts. All-zero residual Uramaki scores nobody. Positive tied residual Uramaki all get the next unused award. Label these edge decisions as conventions.                                                                                                                 |
| C5 Tea dessert scope    | Count only desserts collected this round, matching the explicit Soy Sauce scope. Prior-round desserts cannot enlarge Tea's group. Fixture: four old desserts plus one new dessert and two Nigiri => Tea 2, not 5.                                                                                                                                                                                               |
| C6 Boxed color          | Boxed cards have no scoring-color group. They each score 2, cannot enlarge Tea or Soy Sauce, and cannot remain desserts. A copied boxed card is likewise colorless and worth 2. Test three boxed dishes plus Tea => Tea 1.                                                                                                                                                                                      |
| C7 Final tie            | Equal final score then equal dessert-card count means shared winners.                                                                                                                                                                                                                                                                                                                                           |

Already explicit in the booklet: a copy's identity survives source boxing; copying
a boxed card produces a boxed copy; copied desserts stay out of later decks;
fresh utensils are stored for later turns; copies retain a utensil's number.
Frozen copy identity includes icons/shape/color and any special Nigiri source-link
eligibility. It is not a cached score and not a live source pointer. Ordinary
Nigiri must attach to an available Wasabi; copying an unattached Nigiri may attach
to an available Wasabi, while copying an attached Nigiri does not inherit that
Wasabi. Expose the optional legal choice rather than silently forcing it.

Material inference to test: all standard legal Menu decks have enough cards.
At six seats, after maximum retained desserts and all three copied desserts,
round 3 begins with at least `54 - 3 + 3 = 54` cards; 48 are dealt, leaving 6.
There are at most three Menu plays (only one other special slot), each consumes
one unused card, so the final four-card offer still has at least four available.
For 2–5 seats the worst remaining deck is at least `54 - 3 + 2 - 45 = 8`.
At 7–8 seats Menu and Special Order are prohibited. Confirm this conservation
bound with seeded stress tests and do not refill from discards/reserve ad hoc.

## Engine implementation sequence

- [ ] Add package and focused modules: `cards.ts`, `menus.ts`, `scoring.ts`,
      `index.ts`, `presentation.ts`. Pure TypeScript, explicit injected randomness;
      no DOM/network/storage in rules and no universal card engine.
- [ ] Define physical-card records separately from played appearances. Own
      zones: unused deck, dessert reserve, hands, committed picks, tableaus, retained
      desserts, public discard, private Menu offer. Each physical ID belongs to exactly
      one zone; copied identity never creates a new physical card.
- [ ] Canonical seat order remains fixed. On each draft turn issue owner/turn
      scoped selection handles without dish/deck/physical IDs. Rotate on pass and
      on any ownership-changing exchange. Give public appearances independent IDs.
      Prior hand owners must not track hidden cards via stable IDs.
- [ ] `create` opens setup using My First Meal. Validate custom category counts,
      distinct types and capacity. Everyone confirms current setupVersion. Deal the
      prescribed hands and desserts with Fisher–Yates using injected random.
- [ ] Freeze PICK including copy snapshot and declarations privately. Only ready
      identities become public until everyone commits. Reveal the complete primary
      batch in one accepted transition. Evaluate primary Miso/Uramaki as a batch.
- [ ] Use one resumable effect queue and discriminated pending prompt. Save the
      four-card Menu offer once before prompting; reconnect reads it without drawing
      again. Insert bonus Menu/Takeout into the remaining numeric queue. Resolve
      immediate extra-card behavior and copies at their play point; never restart
      completed effects. Empty automatic queues continue without a generic Continue.
- [ ] Spoon request identifies type or exact variant. Server searches left in
      fixed seat order, excluding requester. Supplier decides only among real matching
      variants; same-variant duplicates auto-select deterministically. Requester must
      never choose arbitrary supplier or see their hand. Commit exchange atomically.
- [ ] Maintain turn-wide Miso play ledger even after discarded soups disappear.
      A third soup that turn also collides; soups from earlier turns survive.
- [ ] Uramaki stores consumed award slots and immediate receipt entries. Simultaneous
      crossings sort totals; tied totals consume their number of places. Bonus plays
      use the subsequent immediate award path. Only one next-place residual award
      group exists at round end. Already awarded points never enter the delta twice.
- [ ] Round receipts reconcile each group to actual score deltas, distinguish
      immediate roll points, and retain unboxed effective desserts with collection
      round. Recombine actual eligible physical cards, clearing copies/boxing only
      when their card reenters the deck. Never regenerate a fresh manifest.
- [ ] Allowlisted views include public menu, seats, scores, tableaus, saved
      desserts, discards, ready/committed flags, current prompt actor/kind and receipts.
      Only actor projection gets hand, commitment and choice options. Never spread
      canonical state, private prompt contents or hidden event details into a view.

## Visual specification

This supersedes conflicting presentation suggestions in the earlier plan.
Create an original full-viewport cheerful illustrated dining table, mint surface,
warm ivory ceramic plates, coral action controls and dark seaweed text. Original
CSS/SVG/Svelte food silhouettes show faces, texture strokes and recognizable
ingredients. No downloaded commercial art. Cards combine generous art, name,
visible quantity/shape, priority where relevant, scoring strip and semantic group
pattern. Nigiri variations remain distinguishable; same scoring colors stay grouped.

Desktop/tablet: local hand sits along the bottom, own scored dishes on a broad
plate immediately above, friends seated in stable positions around the table.
Use actual DOM seat anchors for passing bundles. Center shows a compact round/turn
marker, chosen-menu summary and the current special prompt. Scores/dessert counts
stay near each friend's plate. Do not arrange the game as a dashboard of panels.

Phone at 360px: keep readable hand cards in horizontal scroll, confirmation pinned
above bottom safe area, a compact stable ring/arc of friends above the local plate,
and expandable public dish trays. Do not squeeze eight full tableaus into tiny
cards. Center prompt becomes an accessible sheet when needed. Long names truncate
visually with full accessible labels. Touch targets >=44px; focus, keyboard and
safe-area insets apply to both portrait and landscape.

Upper-left illustrated rules-book button opens a searchable, illustrated guide
with quick-turn explanation, all dishes, special interactions and conventions.
Upper-right gear opens game-owned sound toggle, volume slider, reduced-motion
setting, language plus the provided room-control snippet. Restore trigger focus
on close. No persistent generic room toolbar. Audio is enabled by default at a
restrained volume, unlocked only by a user gesture and guarded against unavailable
AudioContext. Persist only sound/volume/motion/language preferences; never cards,
offers, picks or history. Mute and reduced motion never block legal actions.

Selection visibly lifts a card but stays editable until Keep this dish. Optional
eligible utensils are armed before commitment; the extra dish is selected only
after reveal. Special Order previews copied identity before commitment. Takeout
supports explicit Flip none and independent stack-card targets. State controls
always reflect current canonical legality even during effects.

### Events and choreography

Generate typed accepted-action events, then explicitly project each variant.
Suggested union: deal, committed(seat only), reveal(batch of public cards),
attach, miso-discard, utensil-exchange, copy, takeout, pass(seat edges/counts only),
score(groups/amount), round-end, finished. Private offer cards stay exclusively
in recipient state; no public card IDs in commitment events.

Include draft round/turn and monotonically increasing sequence. On client,
scope the cursor to room match epoch + player. Animate only consecutive accepted
sequences; initialize/reconnect/gaps/seat changes/rematches snap to newest state
without replay. Resize/preferences cancel stale paths. Reveal all primary cards
together (250–350ms), then resolve specials (250–400ms), pass identical-backed
bundles along actual seat paths (300–450ms), and outline score groups while counters
settle (350–600ms). Cosmetic queues never acknowledge/delay server rules. Reduced
motion replaces movement with immediate state or short fades; sound is soft paper,
ceramic and score taps. No hidden-card-specific sounds or asset requests.

## Integration, practice and translations

Game successor owns new game files, dedicated practice route, dedicated e2e,
illustrated guide data/scene and game-specific docs. Coordinator owns room shell
and shared session stale mechanics. Shared game registration edits should be
separately committed and reported: server definition/package dependency,
metadata-only catalog `sushi-go-party`, lazy board import, web package dependency,
BoxArt branch, guideLoaders and Rulebook scene loader. Inspect catalog page for
metadata typing/preview branches; no eager imports of rules/Board/practice.

Use Paraglide messages from `@board-games/shared/messages` in both EN and ES;
prefix Sushi-specific keys `sgp_` (including rules errors, dish names, receipts,
menus and help). Provide translations in a separate commit. Avoid a runtime
English/Spanish dictionary inside Board. Preserve all other games' keys.

`/practice/sushi-go-party` imports `practice.ts` separately. Use deterministic
real-rule fixtures and local seat controls to demonstrate pick/reveal/pass,
Wasabi/scoring, Uramaki, Miso collisions, Menu offer, Spoon supplier, copied
utensils and Takeout. No production debug endpoint or server fixture flag; practice
state must not enter multiplayer initialization or catalog metadata. Use the same
apply/view methods and preserve conservation in arranged fixtures.

## Validation and delivery checklist

- [ ] Independent manifest fixtures and every preset at each capacity, malformed
      actions and invalid menu rejection; rejection keeps state and random use intact.
- [ ] Seeded complete three-round matches at 2,3,4,5,6,7,8 seats; conservation after
      every accepted action/continuation; enough Menu stock in later rounds.
- [ ] Exhaustive score boundaries from the original plan, including optimal disjoint
      Onigiri sets, Edamame cap, multiple Soy Sauce, Fruit absence/multiplicity,
      dessert tie counts, Uramaki batches/residuals and C1–C7 fixtures.
- [ ] Advanced interaction matrix: primary/bonus/copy Miso, Menu prohibits choosing
      another Menu, bonus copies target only current already-played cards, fresh
      utensil suppression, multiple utensil activation, failed/exact/general Spoon,
      private supplier choices, copy-retained desserts, source/stack boxing.
- [ ] Real independent socket clients: concurrent PICK and READY, revision stales,
      duplicate action IDs, spoofing, old hand/prompt handles, before/after-commit
      disconnect, Menu/Spoon reconnect, expired seat replacement and host migration.
      Inspect each actual recipient payload for secret IDs/faces and accepted events.
- [ ] Chromium and WebKit e2e at minimum and maximum seats, basic complete match
      through final/rematch, two-player Menu/Special Order, eight-player Spoon/Chopsticks,
      EN/ES, keyboard, mobile dialogs, safe-area controls, settings persistence,
      mute/unavailable audio, reduced motion and no replay on reconnect/rematch/gaps.
- [ ] Capture screenshot AND video evidence of desktop, tablet, narrow phone and
      wide phone gameplay. Include reveal/pass/scoring and advanced prompt clips,
      not only setup. Verify plate/hand readability and actual seat-directed motion.
- [ ] Run targeted checks during development, then root `bun run check`,
      `bun run test`, `bun run build`, `TEST_PORT=3113 bun run test:e2e --project=chromium`,
      `TEST_PORT=3113 bun run test:e2e --project=webkit`, `bun run format:check`.
      Format changed maintained files only. Stop repeating passing checks absent
      new changes/evidence. Tell coordinator which broader checks it can consolidate.
- [ ] Update game documentation with evidence/conventions and actual validation;
      coordinate README, architecture, validation and AGENTS/ADR changes. Record real
      Safari device/group playtests as unverified if unavailable; WebKit is not final
      Safari-device evidence. No fabricated playtest or artifact claims.

Planning verification: inspected contract, room presence binding, client session,
room Board props, catalog/guide loaders, Catan practice and Playwright setup.
`plan_turn` was not exposed in the available tool metadata; used direct repository
search. No optional skills/plugins were enabled and no application tests were run
for this documentation-only phase. All game work remains for the successor.

## Current implementation delivery — 2026-09-12

The entire standard box is implemented in this worktree. No advanced card is
stubbed, disabled outside its printed capacity restriction, or omitted. This
handoff ends the implementation stage and leaves an independent High review.
No nested agents or optional plugins were used. `plan_turn` was not exposed in
available tool metadata; direct repository searches were used.

### Files and decisions

- `games/sushi-go-party/src/cards.ts`, `menus.ts`, `scoring.ts`, `index.ts`:
  full physical inventory, all menus, independent scoring, simultaneous commitments,
  saved effect queue/prompts, recipient projections and presence guard.
- `presentation.ts`, `effects.ts`, `Dish.svelte`, `Card.svelte`, `Board.svelte`:
  explicit public events, sequence cursor, actual DOM-seat pass paths, original
  dish art, semantic color patterns, local hand, collected dishes, scoring-group
  outlines, private prompts, guide and settings. No persistent room toolbar.
- `practice.ts` and the dedicated practice route: real-rule seeded arrangements,
  conserved physical swaps and local seat controls, separately imported.
  The route uses raw canonical state; intentions cross a JSON boundary before
  local apply. Language changes use `reload:false` and key the Board by locale,
  preserving the raw rules state while refreshing labels and cosmetic cursors.
- `labels.ts` reads only Paraglide messages, with `sgp_` keys in EN/ES.
  The guide and art scene load lazily. Metadata never imports rules/practice.
- `docs/games/sushi-go-party.md`, ADR016, evidence index: implemented behavior,
  conventions, architecture and actual captured browser artifacts.

The agreed PICK/READY public and private fields are unchanged. RESOLVE choices are:

```ts
type Choice =
  | { type: 'card'; card: string } // Menu, Chopsticks or supplier's private handle
  | { type: 'request'; kind: Kind; variant?: string; priority?: number }
  | { type: 'takeout'; cards: string[] }
  | { type: 'copy'; target: string | null }
  | { type: 'attach'; wasabi: string | null };
```

The server infers the relevant operation from the saved actor-owned prompt. Public
prompt kinds are `menu`, `chopsticks`, `spoon`, `supplier`, `takeout`, `copy`,
`attach`. Only its actor receives `private.prompt`, with allowlisted `cards`,
`targets`, and `requests`. `copy` with no available target auto-discards before
prompting; clients cannot deliberately pass a legal copy. `attach` may choose null.
An ordinary Nigiri attaches automatically; the optional copied-Nigiri branch has
its own prompt, preserving the exact agreed PICK schema.

Commitments preserve their original private hand position, so commitment and
reconnect do not reorder the selected card. Handles renew on passes/exchanges.
Menu offers are retained in their own canonical zone and never drawn again on
reconnect. Returning a copied utensil restores its physical Special Order face.
The accepted event sequence never gates actions or waits for animation.

### Actual validation

- `bun run check`: passed, zero Svelte errors/warnings and clean TypeScript.
- `bun run test`: 210 passed across 16 files (35,119 assertions at that run).
- Focused final rules/socket command: 77 passed, 7,232 assertions.
  Includes **184 complete seeded matches**: four seeds for all 46 legal
  preset/capacity combinations, with physical conservation after every accepted
  transition and receipt reconciliation.
- Targeted advanced fixtures cover Miso's third collision and old cohort,
  Uramaki immediate/tied awards, private Menu continuation, Spoon general/exact/
  failed requests and supplier variants, copied utensil return and repeated
  priority, copied dessert retention, copying boxed cards/source changes,
  independent linked boxing and optional copied-Nigiri attachment.
- Three real socket tests cover two/eight concurrent READY and PICK with same-ID
  revision retries, duplicate IDs, spoofing, stale hand handles, recipient-payload
  inspection, before/after-commit reconnect, expired replacement/host migration,
  and actual Menu/Spoon supplier prompt reconnect/duplicate continuation.
- `bun run build`: passed. `bun run format:check`: passed.
- Chromium and WebKit passed complete two-browser three-round games/rematch;
  eight independent seats with observed Spoon and Chopsticks; accepted turns at
  desktop, tablet, narrow and landscape-phone sizes; EN/ES, mute/motion persistence,
  keyboard/guide focus, unavailable audio/reduced motion; and noninitial local
  language switching with an identical saved Menu offer. The eight-seat test waits
  for every recipient's turn snapshot before selecting, rather than skipping a
  browser whose previous READY snapshot has not arrived yet.
- Browser evidence lives in `docs/evidence/sushi-go-party/`, including actual
  `.webm` recordings. The evidence index distinguishes room play from local
  fixtures. Screenshots and sampled recordings were visually inspected.

The first browser runs found two incorrect test assumptions (the initial host
retaining rematch after disconnect, and a multiplayer settings dialog surviving
Paraglide's full reload), one local language-state issue, and landscape/tablet
layout issues. All were corrected. A later browser installer elsewhere removed
the shared cache. Final browser validation uses the coordinator's verified isolated
binaries, with no persistent configuration/dependency changes:

```sh
PLAYWRIGHT_BROWSERS_PATH=/tmp/board-games-three-games-browsers \
WEBKIT_EXECUTABLE=/tmp/board-games-three-games-browsers/webkit \
TEST_PORT=3113 bun run test:e2e tests/e2e/sushi-go-party.spec.ts \
  --project=chromium --project=webkit
```

### Independent High review priorities and external limits

1. Audit the advanced engine against the handoff's primary rules and C1–C7,
   especially queue insertion for bonus effects, repeated copied priorities,
   chained copies and linked Nigiri/Wasabi source eligibility.
2. Challenge worst-case later-round Menu stock with retained copied desserts,
   and check every zone/receipt after deliberately adversarial advanced sequences.
3. Review actual recipient payloads and stable-handle boundaries after Spoon,
   commitment, reconnect/replacement and rematch. Coordinator owns shared retries;
   integrate its later wire-intention snapshot and translated structured alerts.
4. Inspect all four viewport screenshots and real recordings at normal playback,
   including current-target legality during animation and eight long names.
   Add browser/behavior regressions for any issue found rather than rerunning
   passing checks without a reason.
5. Improve the illustrated library lessons: `SushiScene.svelte` currently reuses
   three dishes and simple frame changes. High should add concrete scoring
   examples checked against the engine, plus `role="img"` and a localized
   accessible scene label required by the shared library E2E.
6. Coordinator consolidates six-game registration, shared library regressions,
   root docs/AGENTS references and final whole-catalog tests. `bun.lock` is
   deliberately not committed here; coordinator regenerates it.

Physical Safari devices, browser zoom/device accessibility audits, subjective
speaker quality and a live human group playtest remain unverified. No result is
claimed for them. These are external validation limits, not missing card types.

### Commit record

- `c503066` — complete game engine, table, practice, illustrated guide base,
  tests, rule/ADR documentation and preserved browser evidence.
- `930e46c` — English and Spanish messages only.
- `d02059e` — server/web/catalog registration only; merge with sibling games by
  intent. No lockfile is included.

The earlier `79e4c79` is the local cherry-pick of coordinator `ef5a1be` and must
not be applied to integration a second time. Later coordinator transport fixes
remain owned by integration. The final practice/locale rerun passed all four
Chromium/WebKit checks after the final fruit illustration correction; the final
eight-seat rerun passed both engines after recipient-turn synchronization in the
test helper. These focused reruns supplement the full-suite run rather than
claiming a new all-tests-at-once browser run.
