# Codenames implementation plan

Status: planned, not implemented. Prepared September 11, 2026.

This document is the deliverable for a research and planning session. Its tasks
are for a later implementation session; creating this file does not authorize
executing them. No application code, dependencies, or game assets are changed.

## Outcome and scope

Add Codenames to the existing catalog as a polished, synchronous game for friends:
a readable word board, clearly separated spymaster and operative experiences,
responsive card reveals, and authoritative enforcement of turns and hidden
information. Support English and Spanish from the first release.

Implement classic red-versus-blue word Codenames, including zero and unlimited
clues. Set the initial application capacity to **4–8 people**, with at least two
on each team. Eight is a product limit for this catalog, not a tabletop rule;
the publisher describes the game as 4–8+ players. Target approximately 15-minute
rounds. [Publisher overview](https://www.czechgames.com/games/codenames).

Exclude Duet, Pictures, two/three-player variants, bots, accounts, matchmaking,
custom word uploads, spectators, tournaments, and enforced timers from this
release. Players discuss through their existing call or in person; do not add
WebRTC or an in-app chat system. These exclusions do not reduce the classic
four-or-more-player rules implementation.

## Research and rules baseline

Use the publisher's refreshed **2025 classic edition**, not the mobile app's
different clue conventions. Both rulebooks below were read for this plan.
The English PDF was retrieved directly when the browsing tool could not parse
its current URL. The old `/files/rules/codenames-rules-en.pdf` address redirects
to the product page; use the current downloads below.

| Source                                                                                                                            | Purpose                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [CGE English rulebook, EN 30](https://filemanager.czechgames.com/storage/files/codenames/rules/CN%20rulebook%20EN%2030.pdf)       | Primary baseline; PDF pages 2–5 cover setup/play, 6 clues, 7 expert rules, 8 reminders.        |
| [CGE/Devir Spanish rulebook, ES 07](https://filemanager.czechgames.com/storage/files/codenames/rules/CN%20rulebook%20ES%2007.pdf) | Spanish terminology and language-specific clue guidance; equivalent sections on PDF pages 2–8. |
| [CGE Codenames](https://www.czechgames.com/games/codenames)                                                                       | Edition, player count, components, and official rules download entry point.                    |

### Rules to preserve

Two teams each appoint one spymaster; everyone else is an operative. Arrange 25
random words in a 5×5 grid. Both spymasters see the same secret key. The starting
team has nine agents; the other has eight. Seven cards are bystanders and one
is the assassin. Teams alternate clues consisting of a word and a count.

Operatives reveal one card per guess. Their own agent permits another guess;
a bystander or enemy agent ends the turn. Revealing the assassin loses
immediately. A team wins as soon as all its agents are revealed, including when
its opponent reveals the last one. A normal clue permits at most its count plus
one guesses; at least one guess is mandatory before stopping. Earlier clues may
inform any guess. Zero means avoid the associated words; zero and unlimited
both remove the numerical guess cap, without removing wrong-guess consequences.
[English rules, PDF pages 2–5, 7–8](https://filemanager.czechgames.com/storage/files/codenames/rules/CN%20rulebook%20EN%2030.pdf).

Clues concern meaning, not spelling, position, gestures, or vocal signals.
Unrevealed words, their forms, and genuine compound components are prohibited;
arbitrary substrings are not automatically prohibited. Play in the selected
language, allowing customary loanwords. Single-word proper names are allowed;
abbreviations, multiword names/titles, and other exceptions require agreement.
Traditional soundalikes require a meaning connection. Identically spelled
words may have different meanings; Spanish accents can distinguish words.
Spymasters must not signal whether guesses matched their intentions.

The opposing spymaster may allow a disputed clue. Otherwise an invalid clue
ends the offending turn without guesses; the opponent may reveal one own agent
before giving a clue. An unnoticed earlier violation is not retroactively
penalized. [Spanish rules, PDF pages 6–8](https://filemanager.czechgames.com/storage/files/codenames/rules/CN%20rulebook%20ES%2007.pdf).

The implementation choices below translate these rules into browser interaction.
They are product decisions, not additional claims about the printed rules.

## Product decisions and player journey

### Room and team setup

1. The catalog gains an original miniature word-grid illustration, localized
   description, player limits, and an explicit board-language selector. Creating
   a room uses the existing name, invite link, and reconnect credentials.
2. Keep the shared room lobby. For Codenames, label its host start action
   “Choose teams.” It creates game state in `teamSetup`; it does not deal a key.
   This avoids building a new shared lobby configuration framework.
3. Inside the game UI, show two equal team columns. Each player chooses their
   own team and role. Each column has one spymaster slot and operative slots.
   Make roughly balanced teams the obvious choice, but allow an uneven split
   when both teams meet their minimum. No host assignment of someone else's role.
4. Players explicitly ready up. Any team or role change clears all ready flags.
   The final ready action validates the complete roster, deals the board/key,
   locks assignments, and starts play. No key exists before this boundary.
5. The host's existing rematch action returns everyone to fresh team setup.
   Clear readiness, clues, effects, and the old key; permit new roles only with a
   new board. This is especially important after an operative becomes a spymaster.

The existing room layer reserves disconnected seats and replaces expired seats
without changing seat IDs. Preserve those semantics. After dealing, a replacement
inherits exactly that seat's team/role; no mid-round role switching or arbitrary
new seats. During setup, a seat replacement must clear readiness before the game
can begin. Add only the narrow server guard needed for that behavior, and reject
the final setup-ready action while any seat is disconnected. Game rules still
own team composition; sockets own connection identity and presence.

An absent spymaster naturally blocks their clue/review phase until reconnect or
replacement. Do not automatically pass, reassign their role, or reveal their key
to the host. Display the reason for waiting and reservation status. Remaining
operatives may continue a legal guessing phase. State remains in memory and is
lost on server restart, matching the catalog.

### Clues and human adjudication

- The active spymaster gets a clue composer with a word field, count choices
  `1–9`, `0`, and `∞`, a brief explanation of the selected count, and an explicit
  submit button. The numbered range covers the maximum starting agent count;
  never test whether the clue actually matches that many agents.
- Drafts, focus, pointer movements, and typing activity stay local. Only the
  submitted word/count become public. Never collect a list of intended targets.
- Use a short **opposing-spymaster review phase before every clue becomes
  guessable**. They choose “Allow clue” or “Invalid clue.” This is an explicit
  digital adaptation that establishes a clear objection boundary, prevents
  reveal-versus-challenge races, and avoids rollback of discovered identities.
  It adds one deliberate click per turn; teach it in onboarding.
- Approval activates guessing. Rejection enters a penalty phase: the opposing
  spymaster can reveal one unrevealed own agent or skip that benefit. Resolve
  victory immediately if applicable; otherwise that team supplies the next clue.
  Neither the room host nor operatives can approve, reject, or take this benefit.
- Acceptance is final for that clue. Do not add a late-challenge or undo action.
  Invalid input caught before publication is an editing error, not a penalty.
- Enforce payload shape, size, count, phase, and actor permissions mechanically.
  Normalize Unicode to NFC, trim whitespace, reject control/invisible characters,
  and limit clue text to 80 characters. Preserve accents and intended spelling.
  Render all player strings as text.
- Show draft warnings for exact unrevealed-word matches and suspicious word
  structure. Do not claim a stemmer, substring filter, dictionary, or AI can judge
  semantic legality. The reviewer handles inflections, compounds, loanwords,
  soundalikes, and agreed exceptions. Even a warned clue can be submitted for
  their ruling; transport-invalid content cannot.
- The default help describes classic single-word clues. A visible setup agreement
  can allow abbreviations and multiword proper names/titles; both teams see it
  before readiness. Keep soundalikes on the classic meaning-based rule. Typed
  spelling is always available in the clue history.

### Guessing and finishing

- Any active-team operative may commit a guess after discussion. Do not add
  captain powers or a mandatory voting system. The first valid server action wins.
- One click/tap selects a card locally. A nearby confirmation tray says
  “Reveal [word]” and supports cancel. Selection never exposes an identity or
  gets sent as a guess. No double-click shortcut that bypasses confirmation.
- Show the current clue, guesses used/available, and a clear End turn control.
  Disable End turn until the mandatory first guess; explain why. For unlimited
  budgets, show `∞` and guesses made instead of a misleading decreasing number.
- After rejection, staleness, or a competing accepted action, synchronize first
  and require fresh confirmation. Never automatically retry an irreversible guess.
- Keep a compact public chronological history of submitted clues, review
  outcomes, reveals, and turn endings. Do not annotate “intended matches,” give
  similarity hints, or let the spymaster mark missing targets from old clues.
- Finish with the winning team and reason, all identities available for review,
  and the host's rematch control. Preserve word labels after reveals so the
  conversation remains understandable. The finished board is inert.

## UI and art direction

Use a warm espionage briefing-room theme that fits the catalog's paper palette.
Build original CSS/SVG artwork: ivory dossier cards on a deep ink-blue surface,
muted crimson and cobalt team accents, restrained brass separators, and simple
agent/bystander/assassin symbols. Avoid a copied box cover or publisher asset set.
Retain the existing DM Sans/system font stack for words; use the existing display
face sparingly in headings. Card words remain the highest-priority content.

| Surface                            | Required visual behavior                                                                                                                                                           |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop, around 1280×800           | Centered 5×5 board; compact team panels at the sides; current clue above; confirmation/action tray below. Reserve space for the room toolbar.                                      |
| Phone, around 390×844              | Team summaries and clue above the same 5-column board; controls below; roster/history in accessible drawers. Do not reorder cards between roles or orientations.                   |
| Narrow phone, 320px, or large text | Allow a vertically scrolling game region inside the immersive room shell. Wrap long words without ellipses; provide a large selected-word preview. Avoid horizontal page overflow. |
| Operative board                    | Every unrevealed card has the same neutral appearance and accessible description. Selection is a distinct outline, unrelated to identity.                                          |
| Spymaster board                    | Same card positions with identity labels and patterns, plus a persistent “Spymaster — secret key” badge. Both team colors, bystanders, and assassin remain unambiguous.            |
| Revealed card                      | Durable identity badge/stamp, readable word, reduced emphasis, no further guess affordance. Keep it visually distinct from a spymaster's unrevealed identity overlay.              |
| Turn header                        | Explicit team and phase text: preparing clue, reviewing clue, guessing, penalty, or finished. Numeric agents remaining per team.                                                   |
| Connection loss                    | Persistent status and disabled local submissions; preserve the last legitimate view. Reconnect settles to current state.                                                           |

Suggested tokens: surface `#152532`, paper `#F5EEDC`, text `#182631`, red
`#A93645`, blue `#245C97`, brass `#B88B47`. Verify actual text/background contrast
in implementation; these are a direction, not prevalidated accessible pairs.
Use color plus text/icons/patterns everywhere. Target 44px minimum interactive
dimensions, 4.5:1 normal-text contrast, and 3:1 control/focus contrast.

Provide a brief role-specific first-round explanation, an always-available rules
drawer with the official sources, and one settings entry for motion and sound.
Use the existing room language control; distinguish interface language from
board language. Changing interface locale must never translate or reroll the
current board or submitted clues. Avoid duplicate language controls.

All actions must work with keyboard and touch: native buttons, visible focus,
predictable row-major card navigation, Enter/Space selection, Escape cancellation,
and focus return after drawers close. Announce the accepted result and new phase
through a concise live region. No hidden identities in operative accessible names.

## Animation and sound specification

The table should feel responsive through meaningful, bounded motion. It must
remain readable while people spend time thinking. No continuously bouncing cards,
fake presence activity, screen shake, or flashing assassin effect.

| Trigger                     | Treatment                                                                            | Target duration        |
| --------------------------- | ------------------------------------------------------------------------------------ | ---------------------- |
| Fresh deal                  | Light staggered dossier arrival; no operative card ever shows a secret reverse side. | Entire sequence ≤600ms |
| Local hover/focus/selection | Border emphasis and up to 2px lift; touch selection reveals confirmation tray.       | 100–140ms              |
| Accepted clue               | Clue strip slides/fades into its reserved space; previous clue enters history.       | 180–240ms              |
| Accepted reveal             | Card compresses slightly, then identity stamp appears; retained word stays legible.  | 260–360ms              |
| Own agent                   | Team counter updates with a short emphasis; optional soft confirmation tone.         | 180–240ms              |
| Bystander/enemy agent       | Reveal followed by a restrained turn-header handoff; outcome named in text.          | 200–300ms              |
| Assassin or final agent     | Resolve reveal, then a quiet result banner and optional brief sound.                 | Total ≤900ms           |
| Join/reconnect status       | Small avatar/status fade based on actual connection state.                           | 120–180ms              |

Canonical state updates immediately. Motion decorates accepted actions and never
delays rule evaluation or determines when another player can act. Use CSS,
Svelte, and Web Animations; do not install an animation engine.

Generate typed, game-owned events only after accepted actions, with a game action
sequence and event index. Examples: `boardDealt`, `clueSubmitted`,
`clueReviewed`, `cardRevealed`, `turnEnded`, `gameFinished`. Project an explicit
allowlist of public fields. A reveal event may include only the now-public card
identity. No secret key, intended targets, or clue draft in events.

The client consumes consecutive action sequences within the same round and seat.
Room revisions also change for presence, so they alone are insufficient for
deduplicating effects. Rejected actions can republish snapshots: repeated event
IDs must do nothing. On sequence gaps, reconnect, role/round changes, resizing,
tab restoration, or motion changes, cancel decoration and settle to the latest
projection. Never replay a backlog or celebrate a stale result.

Respect both `prefers-reduced-motion` and a Codenames-specific persisted motion
setting. Reduced motion removes movement and stagger, retaining immediate labels,
counters, focus, and announcements. Optional sound defaults off, unlocks only
through a user gesture, has its own persisted setting, and cannot block gameplay
when AudioContext is unavailable. Never encode secret identities in audio.

## Architecture and data boundaries

Follow [architecture](../architecture.md), [ADR 009](../adr/009-typescript-catalog.md),
[ADR 010](../adr/010-bun-runtime.md), and the presentation principles in
[ADR 011](../adr/011-catan-presentation.md). Keep Bun, TypeScript, Socket.IO,
SvelteKit, Paraglide, and in-memory rooms. Do not import Catan fixtures or extract
a generic team/turn/effect framework for this single addition.

### State and actions

Implement the existing `GameDefinition` contract in `games/codenames`:
`create`, `apply`, `view`, `isFinished`, and player limits. No bot policy.
Use discriminated state phases:

```text
teamSetup → clue → clueReview → guessing → clue (opposite team)
                       └────→ penalty → clue (opposite team)
Any reveal that resolves victory → finished
Host rematch → new round/teamSetup
```

Canonical state owns the seat roster, role assignments, readiness, fixed board
language and clue agreement, word-pack version, board words, secret identities,
revealed flags, active team, clue, guess budget, history, result, and last event
batch. A tagged finite/unlimited budget avoids serializing JavaScript Infinity.
There is no key in `teamSetup`. Freeze role assignments once dealt.

Actions are explicit and runtime-validated: `chooseRole`, `setReady`, `submitClue`,
`reviewClue`, `takePenalty` (own card or skip), `guess`, and `endTurn`. Derive the
actor from the server-bound seat; reject spoofed roles, unknown seats, wrong
phases, revealed/out-of-range cards, malformed payloads, and post-finish moves
without mutating state or emitting events. Finish checks precede turn advancement.
No generic undo or host override.

Randomness is injected. Shuffle 25 distinct normalized words from the selected
pack, independently choose the starting team, and shuffle the required identity
multiset. This is a digital key generator with the correct composition, not a
claim to reproduce the physical deck's 40 key layouts. Keep the random seed/source
server-only; deterministic test fixtures must not determine live boards.

### Projection contract

| Recipient                    | Allowed data                                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| All seated players           | Words/positions; revealed identities only; teams/roles/readiness; phase; published clues/history; remaining totals; accepted public events. |
| Either spymaster, after deal | Full secret identity mapping in that recipient's private projection.                                                                        |
| Operative                    | Own role/team and available actions; no unrevealed mapping or reconstructible seed.                                                         |
| Everyone, after finish       | Full mapping for the completed board, clearly marked as postgame data.                                                                      |
| Room host                    | Exactly the projection their game role permits. Hosting grants no key access.                                                               |

Build projections explicitly; never spread canonical board cells and delete a
few fields afterward. Audit sockets, reconnect snapshots, error strings, event
payloads, DOM attributes, accessibility text, and browser storage. Store only
credentials/preferences locally, not game snapshots or keys. Operative clients
must not import the rule engine or canonical fixtures through the board UI.

This remains a trusted-friends game: it cannot prevent screenshots, sharing
credentials, or a person who already saw a key joining through another browser.
Role locking and projection checks prevent application leaks, not human collusion.

### Word content and localization

Create independently curated English and Spanish packs, targeting at least 200
usable words each for replayability. Keep provenance with the pack; do not copy
the publisher's full deck. Favor familiar, varied, evocative nouns and review
regional Spanish usage. Validate uniqueness under NFC/case normalization,
length, empty entries, and adequate pack size. Preserve Spanish accents and ñ;
do not use blanket accent stripping for clue validation. Have a fluent Spanish
reader review actual words and instructions before calling localization complete.

Word packs belong to the game and load on the server. The browser receives only
the round's selected words. Pack versions and board language remain immutable
through a round. All interface text, rules hints, errors, accessible labels,
plural forms, and outcome explanations use Paraglide English/Spanish messages.

## Ordered implementation work for a later session

All implementation steps remain unstarted. Preserve unrelated workspace
changes and re-read applicable instructions before implementation.

| Step                             | Work and likely files                                                                                                                                                                                                                                                                                            | Completion gate                                                                                                   |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1. Establish package and content | Add `games/codenames/package.json`, `src/index.ts`, state/action/view types, and word packs. Mirror existing server and Board exports; keep runtime UI imports separate.                                                                                                                                         | Pack validation and seeded initialization invariants pass.                                                        |
| 2. Implement rules               | Add team setup, phase transitions, clue review/penalty, guess budgets, result resolution, and pure rule tests.                                                                                                                                                                                                   | Complete rounds and all meaningful rejection/edge cases pass.                                                     |
| 3. Secure recipient views        | Implement explicit projections and typed presentation events; add projection tests and real Socket.IO coverage.                                                                                                                                                                                                  | Operatives and operative hosts receive no unrevealed identities, including on reconnect/error paths.              |
| 4. Integrate catalog and rooms   | Register in `apps/server/src/index.ts`, `apps/web/src/lib/games.ts`, and `packages/shared/src/index.ts`; update web/server package dependencies and Bun lockfile. Add catalog preview/board-language options in `apps/web/src/routes/+page.svelte`. Add the narrow setup presence/readiness guard in `rooms.ts`. | Create/join/setup/rematch/replacement work; other games retain behavior; catalog does not eagerly load Codenames. |
| 5. Build responsive play         | Add `games/codenames/src/Board.svelte` and focused components for setup, board/cards, clue controls, team status, history/help. Integrate Codenames lobby wording in `apps/web/src/routes/room/[id]/+page.svelte`.                                                                                               | Four independent players can finish a round with mouse, touch, and keyboard.                                      |
| 6. Add motion and audio          | Add game-local presentation/effects modules and original SVG art. Implement sequence cancellation and settings.                                                                                                                                                                                                  | Accepted actions animate once; reduced motion, reconnect, and unavailable audio behave correctly.                 |
| 7. Localize and validate         | Update `packages/shared/messages/en.json` and `es.json`; add Codenames browser coverage and extend catalog regression checks.                                                                                                                                                                                    | Required automated checks pass; manual visual/language/device evidence is recorded.                               |
| 8. Document final behavior       | Add `docs/games/codenames.md` and package README; update root README, architecture, validation, and affected AGENTS.md catalog listing. Record role/review/key-generation decisions in the next available ADR.                                                                                                   | Documentation matches shipped behavior and names any remaining verification gaps.                                 |

Do not edit accepted historical ADRs to imply they originally included Codenames.
Inspect the current tree before choosing the next ADR number. Shared session
changes should be limited to a demonstrated integration need; the existing action
envelope already carries IDs, round, and expected room revision.

## Validation and acceptance criteria

### Rules, privacy, and room tests

- Seeded generation: 25 distinct words, correct identity counts, either starting
  color, reproducible fixtures, and no key before role lock.
- Setup: team minimums, exactly one spymaster each, contested role claims,
  readiness invalidation, disconnect/replacement before deal, and fresh rematches.
- Finite and unlimited budgets: mandatory first guess, optional stopping,
  automatic cap handling, and permissions for every role/phase combination.
- Reveal outcomes: own agent, bystander, enemy agent, assassin, last own agent,
  and the opponent revealing a team's last agent. Assert winner/reason and no
  subsequent mutation. Include a win caused by the penalty benefit.
- Review workflow: approve, reject, optional benefit, wrong-team penalty target,
  duplicate review, and rejection of late changes after approval.
- Clue input: whitespace/Unicode, Spanish accents, warnings versus malformed
  requests, and human approval of exceptions. Tests must not pretend to prove
  semantic clue correctness.
- Real multi-client sockets: actor spoofing, simultaneous guesses, stale revision,
  duplicate action ID, round mismatch, disconnected socket, token reconnection,
  expired-seat replacement, and host reassignment without role elevation.
- Inspect serialized public/private views and events for every recipient. For a
  stronger privacy test, change an unrevealed key arrangement while preserving
  public totals and reveals: operative projections must remain indistinguishable.
- Verify rejected intentions preserve state/history/action sequence, and repeated
  snapshots cannot replay effects. UNO and Catan rule/session regressions pass.

### Browser and manual review

Run Chromium and WebKit against separate browser contexts for both spymasters
and at least two operatives. Include an eight-person layout/setup case. Exercise
ordinary completion and the assassin outcome with isolated test fixtures; do not
add a production debug endpoint or expose a live key to make tests easier.

Verify catalog lazy loading, role setup, clue review, selection/confirmation,
turn controls, history, rematch, reconnect during an effect, and simultaneous
guesses. Assert hidden information is absent from operative payloads and DOM,
including during animation. Test English and Spanish UI, board-language stability,
long words, keyboard-only play, reduced motion, muted/unavailable audio, and narrow
layouts. Inspect screenshots of setup, each role, all card outcomes, and results.

At 1280×800, 768×1024, 390×844, and 320×568, there must be no clipped essential
controls or overlapping toolbar, and all words must be readable without hover.
At 200% text scaling, allow deliberate vertical scrolling instead of shrinking
text. Check a real touch device for accidental reveals and virtual-keyboard overlap.
Judge motion manually for clarity, duration, and lack of distracting idle activity.

Use a normal laptop and phone to assess animation smoothness; prefer transform
and opacity, avoid measuring/layout work on every frame, and bound history/effect
storage. Record actual observed issues rather than claiming an unmeasured frame rate.
Perform a full four-person playtest to assess clue-review friction and whether
first-time players understand roles, confirmation, and remaining guesses.

For the later implementation, run from the root:

```bash
bun install
bun run check
bun run test
bun run build
bun run test:e2e
bun run format:check
```

Format changed maintained files as needed before the final formatting check.
Follow [validation.md](../validation.md) for browser installation and the actual
Chrome channel. Chromium and WebKit are required; WebKit does not replace final
Safari validation on macOS/iOS. Record unavailable Safari, human Spanish review,
network-condition testing, or manual playtesting as unverified. Once relevant
checks pass, repeat only after new changes or new evidence.

Release acceptance requires complete classic rounds, enforced role/turn rules,
recipient privacy, usable English/Spanish layouts, meaningful accepted-action
animation, accessible reduced-motion behavior, and honest validation evidence.

## Planning-session validation

This session validates only the research, repository integration references,
Markdown formatting, local document links, and scope of the new file. Application
tests, browser tests, mockups, assets, and implementation remain future work.
