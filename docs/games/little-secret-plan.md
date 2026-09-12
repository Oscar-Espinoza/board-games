# Little Secret implementation plan

Status: planned, not implemented. Research completed September 11, 2026.

This file is the deliverable for a research and planning session. All implementation
tasks below belong to a later session. Creating this document does not authorize
executing the plan.

## Intended experience and scope

Add Little Secret as a polished game for friends in the existing catalog: private
password cards, an expressive table of suspects, a readable clue history, tense
simultaneous voting, and a satisfying mission reveal. Ship English and Spanish UI
with separately authored English and Spanish word content.

Use the **original secret-society game, with the Spanish distributor's scoring**.
Support **3–9 players**, matching the Spanish product page and rulebook table.
Explain that five or more introduces the Journalist. Do not change the rules when
a player changes interface language. [Asmodee Spain product page](https://www.asmodee.es/product/little-secret/).

The first release covers the complete base game. Optional power cards are excluded
and the lobby/help must say “Base game · No power cards.” The published variant
starts at six players, but the available booklet does not specify all seven
powers in enough detail to implement every interaction. Any later powers work
needs its own researched addendum; do not invent effects or add a nonfunctional
toggle. [Spanish rulebook, pages 1–2](https://cdn.svc.asmodee.net/production-asmodeees/uploads/2023/06/Reglas_Little_Secret.pdf).

Discussion happens in person or through the group's existing call. The browser
records clues and votes; no voice, WebRTC, chat, accounts, database, matchmaking,
AI players, or spectator mode is required. State remains in Bun memory, as it does
for the other games. A short illustrated “How to play” sequence is included;
interactive practice fixtures are optional follow-up work, not a launch dependency.

## Research baseline and edition differences

The Spanish and French two-page rulebooks were read. The Spanish distribution
table and scoring were also checked against a rendered image of page 2, because
PDF text extraction interleaves the table columns.

| Source                                                                                                                                                                                               | Use in this plan                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Asmodee Spanish rulebook](https://cdn.svc.asmodee.net/production-asmodeees/uploads/2023/06/Reglas_Little_Secret.pdf)                                                                                | Primary authority for this release, especially the distribution table and scoring in steps 8–9.                                                                                 |
| [Original French rulebook, publisher booklet hosted by 1jour-1jeu](https://cdn.1j1ju.com/medias/f4/63/e8-little-secret-regle.pdf)                                                                    | Cross-check of the common play sequence and evidence of differing scoring.                                                                                                      |
| [Little Secret official site](https://littlesecret.fr/)                                                                                                                                              | Roles, theme, and intended social experience. Its FAQ advertises 4–9; the Spanish printed table explicitly includes three.                                                      |
| [ATM Gaming Spanish correction notice](https://atmgaming.eu/es/pages/rules/littlesecret-es-atencion)                                                                                                 | Documents reversed answer cards in some Los Ángeles/Neverland printings. Do not derive answer keys from unverified scans.                                                       |
| [Exploding Kittens Little Secret](https://www.explodingkittens.com/products/little-secret) and [official instructions entry point](https://www.explodingkittens.com/pages/how-to-play-little-secret) | Establish that the cat-themed 4–8-player release is a separate edition. Its downloadable PDF exceeded the browsing tool's size limit and is not used as a rules authority here. |

The French booklet awards points to surviving players. The Spanish booklet instead
uses the faction awards specified below. These are meaningful differences, not
translation preferences. Select the Spanish baseline once; do not combine the two
systems or silently switch them by locale. The US edition's names, capacity, and
presentation are also outside this plan.

### Common game loop

Disciples share a password; Infiltrators share a related alternative. The Journalist
has no password. Password holders initially do not know their allegiance.
[Official game overview](https://littlesecret.fr/).

Prepare mission cards. After examining their cards, a volunteer chooses a number
from 1–10 and starts. Players give one-word clues in order; neither the password nor
another player's clue may be used. Everyone then debates and votes simultaneously.
The most-voted player is eliminated; tied candidates use rock-paper-scissors.
A non-Journalist checks the answer privately and announces their role. An eliminated
Journalist gets one attempt at the Disciples' password: success ends the mission,
failure allows play to continue. The next clue cycle starts left of the eliminated
seat. A mission otherwise stops when all intruders are gone or two players remain.
[French booklet, page 2, steps 1–7](https://cdn.1j1ju.com/medias/f4/63/e8-little-secret-regle.pdf).

### Distribution and scoring baseline

| Players | Disciples | Infiltrators | Journalist |
| ------- | --------- | ------------ | ---------- |
| 3       | 2         | 1            | 0          |
| 4       | 3         | 1            | 0          |
| 5       | 3         | 1            | 1          |
| 6       | 4         | 1            | 1          |
| 7       | 4         | 2            | 1          |
| 8       | 5         | 2            | 1          |
| 9       | 5         | 3            | 1          |

Eliminating all intruders awards every Disciple one point, including eliminated
Disciples. An Infiltrator surviving to mission end awards every Infiltrator two
points, including eliminated Infiltrators. A surviving Journalist, or one who
guesses correctly when eliminated, earns three. Play further missions until a
player reaches five points. [Spanish booklet, page 2, distribution and steps 8–9](https://cdn.svc.asmodee.net/production-asmodeees/uploads/2023/06/Reglas_Little_Secret.pdf).

### Explicit interpretations and browser adaptations

These decisions make unspecified physical conventions executable. Document them
in help as app conventions, not verbatim publisher rules.

| Situation                                             | Decision                                                                                                                                                                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Successful Journalist guess while Infiltrators remain | The guess is an immediate override: only the Journalist scores. Resolve it before ordinary survival awards. This follows the special ending in step 6; the booklet does not explicitly enumerate concurrent awards. |
| Two survivors include an Infiltrator and Journalist   | Apply both survival awards independently. Do not manufacture one winning faction.                                                                                                                                   |
| Several players reach five together                   | All players newly at or above five share the match win. No seat-order advantage or invented sudden death.                                                                                                           |
| Vote totals                                           | Use a plurality: unique highest total eliminates, even without more than half the votes. No abstention or self-vote in the app.                                                                                     |
| Repeated clues                                        | Reject repeats across the current mission, including a player's own earlier clue. Reset the history for a new mission. This makes the printed repeat prohibition explicit.                                          |
| Seating                                               | Keep join order fixed for the match. Increasing seat index, wrapping and skipping eliminated seats, represents moving left. Show numbered seats and a direction indicator.                                          |
| Several volunteers                                    | First accepted volunteer action claims the first turn and chosen number. No host assignment of a secret role.                                                                                                       |
| Physical dealer and preparation                       | Server shuffles and deals; no age collection. Queue five fresh missions initially and refill if needed to reach the score target. Preparation count is not a match-ending limit.                                    |
| More than two tied candidates                         | Use the rock-paper-scissors procedure below, since the booklet does not specify multiplayer resolution.                                                                                                             |
| Timing                                                | No automatic clue, vote, guess, elimination, or score from a timeout. Readiness and action submission move play forward.                                                                                            |

## Player journey and interface

### Art direction

Build an original, warm secret-society lounge: deep ink/navy background, a plum
table surface, ivory dossier cards, coral accents, and brass highlights. Use
simple SVG emblems, envelopes, eye motifs, and city silhouettes. Avoid copying
commercial card illustrations. The center of attention is the people and their
clues; keep settings and connection details at the edge.

Use an expressive display treatment for mission titles and a highly readable
system sans-serif for clues and controls. Passwords should be large, with generous
spacing and no decorative distortion. Use consistent spacing, restrained shadows,
and a small set of component radii. Player colors identify seats only; neither
color nor avatar styling may identify an unrevealed faction.

Desktop: an oval arrangement of up to nine portrait/name plaques surrounds a
central phase card and clue ledger. Scores stay beside names. The viewer's private
dossier and current action occupy the lower edge. Mobile: use a compact seat grid
above the active phase, an internally scrolling clue list, and a bottom action
area that respects safe-area insets and the software keyboard. Preserve stable
seat order rather than constantly repositioning suspects after eliminations.

### Screens and interactions

1. **Catalog and lobby.** Add an original envelope preview, localized description,
   capacity, invite action, and a shared word-language selector. State the rules
   edition, no-powers scope, and external discussion requirement before starting.
   Show the actual role counts for the current roster without assigning names.
2. **Deal and inspect.** Each seat receives a sealed dossier. Open it explicitly;
   show that player's ten numbered mission entries, or the Journalist instruction.
   Password holders see “Your mission card,” never “You are a Disciple/Infiltrator.”
   Each player confirms readiness. Once all are ready, any player can volunteer
   and select the entry number. Keep the full list private; highlight the chosen
   entry once accepted. During play, collapse to the selected password with an
   option to revisit that same private card.
3. **Clue turn.** A clear focus ring marks the active seat. Only that seat has a
   enabled one-word input and “Send clue” action. Keep accepted clues visible by
   cycle and seat; drafts and typing indicators stay local. Other seats see who
   is thinking and what happens next. Do not show a fake countdown.
4. **Discussion.** Show all current clues and selectable player details. Everyone
   still active can mark “Ready to vote”; unanimity opens voting. Readiness can be
   withdrawn until the phase actually changes. Give eliminated players a quiet,
   readable observer view and remind them not to help with the answer.
5. **Voting.** Selecting a portrait previews the target locally. “Lock vote” commits
   it. Display who has voted, but no target, tally, hover state, or likely winner
   until all active ballots are accepted. Locked votes cannot be edited. Then show
   every ballot and total together, including ties, in one authoritative result.
6. **Tie resolution.** Only tied candidates choose a hidden rock, paper, or scissors.
   A candidate who wins is safe from this ballot; contenders with losing gestures
   repeat until one remains and is eliminated. If all gestures are identical or
   all three gestures occur, repeat with the same contenders. Reveal gestures
   only after all contenders commit. This also defines the ordinary two-person
   case. Original ballot totals remain visible. No random or host tiebreak.
7. **Elimination.** Stamp the eliminated portrait with its now-public role and
   keep their clue history. Reveal no password publicly. For a non-Journalist,
   privately provide the current Disciples' answer to reproduce the physical
   answer-card lookup; they have no further clue or ballot actions this mission.
8. **Journalist's chance.** Pause all other progress while that player submits one
   guess, with an explicit confirmation because it is final. Everyone sees the
   guess only after acceptance. A failed guess does not expose the correct word.
   Do not settle a two-survivor ending until this chance has resolved.
9. **Mission result.** Reveal the selected password pair and all roles, explain
   each score delta, and show progress toward five. Include a short clue recap.
   Everyone, including eliminated seats, readies for the next mission. A fresh
   deal clears elimination and assigns new roles while preserving seat scores.
10. **Match result.** Celebrate all match winners. The existing host rematch action
    starts a completely new match with zero scores and fresh content. Distinguish
    “Next mission” from “New match”; the room layer's round counter is not a
    Little Secret mission counter.

Opening a private dossier is a user-controlled convenience, not the security
boundary. Support click/tap toggling and keyboard activation rather than requiring
press-and-hold. Close it on blur, navigation, and seat changes. Do not persist
passwords, guessed answers, ballots, or card contents in localStorage.

### Motion and sound specification

| Accepted event               | Visual response                                                | Target duration           |
| ---------------------------- | -------------------------------------------------------------- | ------------------------- |
| Mission dealt                | Identical sealed envelopes slide to seats; own dossier settles | 350–500 ms, short stagger |
| Private dossier opened       | Fold/flip reveals only the viewer's permitted contents         | 220–300 ms                |
| Clue accepted                | Clue tile enters the ledger; focus moves to the next seat      | 180–240 ms                |
| Readiness or ballot accepted | Small check/seal appears on that seat                          | 120–180 ms                |
| Ballot resolved              | All vote markers appear together, followed by totals           | 300–450 ms                |
| Tie gesture revealed         | Committed gestures turn over together                          | 200–300 ms                |
| Elimination accepted         | Role stamp lands; portrait becomes a subdued observer          | 300–450 ms                |
| Mission scored               | Small score tokens move into counters, then totals settle      | 400–600 ms                |
| Match finished               | Brief original paper-confetti flourish around winners          | Under 1 second            |

All timings are presentation targets, never server deadlines. Apply authoritative
state immediately; motion cannot delay actions or determine an outcome. Use
CSS/Svelte transitions or Web Animations, favoring transform and opacity. No new
animation framework is necessary. Keep idle animation sparse and decorative.

Use game-owned, typed events created only by accepted actions, with recipient
projection like Catan's established boundary. Identify events by match, mission,
and a monotonic event sequence. Repeated snapshots must not replay effects;
joining, reconnecting, revision gaps, seat changes, reduced-motion changes, or
resizing cancel obsolete animation and render the latest state directly. Public
deal events never contain roles, word IDs, or passwords. Rejections may show local
input feedback but must not animate a successful clue or elimination.

Respect `prefers-reduced-motion` and provide a per-game motion setting. Reduced
motion uses immediate state changes or short fades, without flips, travel, or
confetti. Optional paper, seal, and result sounds unlock through a user gesture;
provide mute, tolerate unavailable audio, and never encode private information
in a sound another player could recognize.

### Accessibility and responsive acceptance

- Every action works by keyboard, touch, and pointer, without hover dependence.
- Use at least 44 CSS-pixel primary targets, visible focus, text labels alongside
  icons, and sufficient contrast. Do not convey role, selection, or connection
  state through color alone.
- Announce turn changes, accepted public clues, voting completion, and results
  through restrained live regions. Never automatically speak a hidden password;
  expose it accessibly only when the viewer opens their dossier.
- Dialogs manage focus, support Escape where cancellation is legal, and restore
  focus to the invoking control. Required final guesses remain available after
  closing and reopening help or settings.
- Check 360-pixel phones, tablet portrait/landscape, desktop, nine long player
  names, Spanish text expansion, zoom, and open mobile keyboards. No clipped
  critical controls or horizontal page scrolling.

## Rules engine and privacy design

Implement `games/little-secret` as a game-owned TypeScript package under the
existing `GameDefinition` contract. Rules must be deterministic under the supplied
random source and independent of DOM, networking, and storage. Use explicit
validation; invalid intentions leave state unchanged.

Suggested phases are `inspect`, `chooseEntry`, `clues`, `discussion`, `voting`,
`tieBreak`, `journalistGuess`, `missionResult`, and `matchResult`. Resolve ordinary
eliminations atomically rather than waiting for an animation acknowledgement.

Canonical state owns the fixed seat order, match scores, content language,
ruleset identifier, mission number, used content, ten-entry assignment per seat,
selected entry, true roles, eliminated seats, active clue seat, clue history,
readiness, secret ballots, secret tie gestures, accepted guess, result, and
presentation events. Keep unrevealed mission content and randomness state on the
server. `isFinished` becomes true only for `matchResult`.

Actions should be a small discriminated union: `ready`, `volunteerAndChooseEntry`,
`submitClue`, `setDiscussionReady`, `castVote`, `chooseGesture`, `submitGuess`, and
`readyNextMission`. Attach mission/phase-cycle identifiers to concurrent choices
so retries cannot drift into a later ballot or tie round. Actor identity always
comes from the socket-bound seat; action payloads never choose who is acting.

### Projection contract

| Recipient/data                       | May receive                                                                                                                                                  | Must not receive                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Public before mission end            | Seat order, total initial role counts, scores, phase, selected number, accepted clues, readiness/submission flags, eliminated roles, resolved votes/gestures | Unrevealed roles, answer keys, word-pair identifiers, uncommitted drafts, pending vote targets or gestures |
| Active password holder               | Their ten card entries, selected password, their own locked choice, permitted actions                                                                        | Their true faction label, other cards, opposite word list, deck ordering                                   |
| Active Journalist                    | Journalist instruction, own locked choice, permitted actions                                                                                                 | Either password list or correct answer                                                                     |
| Eliminated non-Journalist            | Public data plus their former card and current Disciples' answer from the private lookup                                                                     | Other players' pending ballots, unrevealed role map, future mission content                                |
| Eliminated Journalist awaiting guess | Guess interface and the same information they already had                                                                                                    | Correct answer, even if ordinary termination is otherwise due                                              |
| Everyone at mission result           | All roles and the selected pair, point deltas, recap                                                                                                         | Unused entries from other cards and future mission assignments                                             |
| Host                                 | Exactly their seat projection plus existing room controls                                                                                                    | A privileged answer key, debug state, or role-assignment control                                           |

Use allowlists to build views; never spread canonical state into a response and
delete a few fields. Password-holder role uncertainty applies to the private JSON
too, not just visible text. Avoid faction-specific asset filenames, CSS classes,
error details, accessible labels, and public event payloads before revelation.

### Text validation without a secret-answer oracle

Normalize input with Unicode NFC, trimming, and locale-aware casing. A clue is
one lexical token, with internal apostrophes/hyphens permitted and no whitespace;
cap it at 40 code points. Reject empty text, controls, markup-like invalid input,
and normalized duplicates. Render all player text as text, never HTML.

Reject a password holder's own selected password, which they already know. Do not
check arbitrary clues against an unknown opposing password and return different
errors: that would let players probe the secret. Apply identical public structural
checks to the Journalist. Relevance and concealed cross-password violations rely
on honest social play; do not add an LLM judge or pretend they are mechanically
provable. The rules help states the restriction even where software cannot safely
enforce it. Do not invent automatic penalties for disputed semantics.

Journalist guesses may contain spaces because mission entries can be phrases.
Compare only at the single committed guess boundary, using case/whitespace
normalization and explicitly curated aliases. Preserve meaning-changing accents;
avoid unrestricted fuzzy matching, synonyms, or multiple attempts. Test the exact
Spanish normalization policy and explain it in help.

## Word content and localization

Author an original launch set of **at least six missions with ten related pairs
each, per content language**. Every pair needs two plausible clue vocabularies,
similar familiarity, and enough distinction for deduction. Review difficulty with
native/fluent speakers and real groups. Do not bulk-copy the commercial deck.

Store content as server-only data with stable internal IDs, display strings,
accepted guess aliases, and a version. Randomize which side supplies the Disciple
list for each mission to avoid teaching a fixed role mapping; keep that assignment
consistent across the ten entries in that mission. Shuffle role allocation afresh
between missions using the supplied random source. Avoid replaying a mission in
the same match until the available set is exhausted, then reshuffle without an
immediate repeat.

Client code receives its permitted card, not a bundled answer dictionary. Internal
IDs must not reveal counterpart words. Use neutral original mission titles; never
automatically translate a password, clue, or guess during a mission. The room's
content language is locked for the match. Each player's UI language remains
independent, using Paraglide `en.json` and `es.json`; generation stays in the normal
build/check workflow.

Include localized role explanations, privacy text, rules-edition label, clue
restrictions, reconnect states, score explanations, tied-winner copy, sound/motion
settings, errors, and empty/waiting states. Spanish role terms are Discípulo,
Infiltrado, and Periodista; English uses Disciple, Infiltrator, and Journalist.

## Integration with this repository

Reviewed anchors: [architecture](../architecture.md),
[game contract](../../packages/game-core/src/index.ts),
[rooms](../../apps/server/src/rooms.ts),
[session client](../../apps/web/src/lib/session.svelte.ts),
[client registry](../../apps/web/src/lib/games.ts), and
[validation](../validation.md).

| Location                                                                                                         | Later change                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `games/little-secret/package.json`                                                                               | Workspace package with separate server and Svelte board exports, following existing games.                                                      |
| `games/little-secret/src/index.ts` and focused sibling modules                                                   | Rules, state/actions, text validation, server content, recipient projection, and meaningful tests. Split only when responsibilities warrant it. |
| `games/little-secret/src/Board.svelte` and small local components                                                | Dossier, seat display, clue ledger, ballot, results, help/settings, responsive styling, original SVG, and event presentation.                   |
| `apps/server/src/index.ts`, `apps/server/package.json`                                                           | Register rules and the workspace dependency.                                                                                                    |
| `packages/shared/src/index.ts`                                                                                   | Metadata-only catalog entry with `little-secret`, capacity, localized description, and envelope preview. No eager game imports.                 |
| `apps/web/src/lib/games.ts`, `apps/web/package.json`                                                             | Add one lazy board import and the workspace dependency.                                                                                         |
| `apps/web/src/routes/+page.svelte`                                                                               | Preview and creation options for shared word language. Do not reuse Catan's `setup` value as this game's configuration.                         |
| `apps/web/src/routes/room/[id]/+page.svelte`                                                                     | Expose the game board within existing room controls; keep mission progression inside the game.                                                  |
| `apps/web/src/lib/session.svelte.ts`                                                                             | Only the narrow concurrent-action retry support described below, if required after inspecting current code.                                     |
| `packages/shared/messages/en.json`, `es.json`                                                                    | All user-facing copy.                                                                                                                           |
| `apps/server/src/rooms.test.ts`, `socket.test.ts`, `tests/e2e/little-secret.spec.ts`                             | Integration, identity, privacy, concurrency, reconnect, and browser coverage.                                                                   |
| `README.md`, `docs/architecture.md`, `docs/validation.md`, `docs/games/little-secret.md`, applicable `AGENTS.md` | Document the implemented game, exact edition, adaptations, commands, and verified behavior when implementation actually happens.                |

Use `bun install` later to update the workspace lockfile. No new backend service,
rendering engine, global game-state framework, or optional extension is needed.
This plan is independent of the existing Azul and Codenames planning documents;
they do not imply implemented packages. Reinspect the workspace before execution:
there were unrelated modified files and untracked plans during this session.

### Concurrent votes and room lifecycle

The current room action envelope requires the exact room revision. Consequently,
two simultaneous legitimate submissions can race, causing the second to be
rejected even though its game choice is still valid. Handle this deliberately.

Keep server revision enforcement. For idempotent per-seat readiness, ballots, and
gestures, retain the original action ID and intention on a typed stale-revision
response. After receiving a fresh snapshot, retry at most twice only if the same
match/mission/phase-cycle remains active, the seat remains eligible, and the
private view does not already confirm acceptance. Otherwise show the current
state and allow an explicit retry. Do not automatically replay clues, guesses,
or actions after an unknown timeout. Introduce a minimal structured stale error
if needed; do not depend on matching English error text. Preserve other games'
behavior and server deduplication.

Readiness, ballots, and guesses cannot be bypassed by the host. A disconnected
required seat blocks that phase until reconnect or the existing seat-replacement
flow completes; show who is missing and the reservation status. A replacement
inherits that exact seat's role, score, eliminated status, and any committed
choice, while receiving a new reconnect secret. It never gets a fresh card
mid-mission. Required participants must be connected at deal/next-mission
boundaries; clear their unconsumed readiness on replacement through a narrow
room/game integration guard. Keep connection handling out of pure rules.

Any already committed ballot remains committed across disconnects. The host may
migrate through the existing room policy without changing game authority. There
is no timeout-driven forfeiture, bot replacement, host inspection, or auto-guess.

## Ordered execution plan for a later session

1. **Lock the rules and content contract.** Reinspect instructions and current
   changes. Record the Spanish baseline and adaptation table in the future rules
   document. Prepare original bilingual content, aliases, and fixture cases.
   Exit: every ending, score combination, and ambiguous convention has a named
   expected outcome; no unresolved edition mixing.
2. **Build the pure game.** Implement setup, all phases, elimination/guess ordering,
   mission and match progression, validation, projections, and deterministic
   randomness. Add meaningful rules/privacy tests alongside it.
   Exit: complete seeded matches work for every supported player count and the
   projection cannot reveal a password holder's faction prematurely.
3. **Integrate authoritative rooms.** Wire package registration, metadata, lazy UI
   import, creation options, readiness boundaries, typed stale errors/retries, and
   reconnect behavior. Test real independent sockets.
   Exit: concurrent ballots complete exactly once and reconnection preserves the
   same secret assignment, score, and committed choice.
4. **Implement the complete playable UI.** Build the lobby, private cards, clue and
   debate phases, secret ballot, tie UI, final guess, scoring, and rematch. Add both
   languages, mobile layout, and keyboard semantics from the start.
   Exit: a human group can finish a match using only visible controls, without a
   developer console or hidden setup instructions.
5. **Add the visual finish.** Apply the lounge art direction, original SVG details,
   event-driven motion, result choreography, sound preferences, and reduced
   motion. Check all nine-seat layouts and Spanish copy.
   Exit: motion clarifies accepted actions, private information stays private,
   and slow/reconnected clients snap cleanly to the current phase.
6. **Validate and document.** Run the checks below, exercise real group discussion,
   review word quality, and update affected documentation/instructions. Record
   actual results and outstanding manual Safari validation.
   Exit: all launch criteria pass or any genuine external validation limitation
   is explicitly recorded; do not describe unrun checks as passing.

## Verification plan

### Rules, content, and projection

- Exact role distribution for 3–9; reject other counts and unknown options.
- Every role sees only permitted card information; active password holders cannot
  inspect their true role even in JSON. Different seeds vary allocations without
  changing counts; catalog/client bundles contain no mission dictionaries.
- Entry selection only after inspection readiness; volunteer races; ordered clues;
  eliminated-seat skipping; cycle restart after the eliminated seat.
- Legal and illegal clues, normalized duplicates, accents, apostrophes, phrase
  guesses, length limits, and no opposing-password validation oracle.
- All ballots required, no target leakage before completion, immutable accepted
  choices, no self-vote, plurality resolution, two-way and multiway ties, repeated
  gesture draws, and no information leak from partial tie submissions.
- Every terminal survivor-role combination, all-intruders-gone termination, final
  Journalist guess before termination, guess success/failure, and one attempt only.
- Spanish faction awards include eligible eliminated teammates; final-guess
  override; simultaneous survival awards; shared five-point winners; new mission
  versus new match reset. Test these against the selected score table, not the
  French survivor-only variant.
- Invalid actions preserve state. Duplicate IDs do not score, eliminate, reveal,
  or emit presentation effects twice. Content aliases cannot collide across a
  pair or reveal role assignment.
- Public/private event payloads, reconnect snapshots, eliminated-player lookups,
  host views, and replacement seats follow the same projection contract.

### Server and browser behavior

Exercise simultaneous readiness/votes/gestures from multiple independent sockets,
including revision races, duplicate delivery, stale phase IDs, spoofed actors,
expired tokens, connection replacement, and host migration. Confirm bounded
retries terminate and cannot submit into a subsequent mission or ballot.

Use deterministic test-only content/seeds through isolated fixtures. Never expose
a production debug endpoint, include fixture secrets in the catalog, or depend
on screenshots of passwords to discover test state.

Browser journeys must cover a full three-player match, a five-player Journalist
mission, a nine-player layout, tie resolution, private dossier opening, reconnect
while voting/guessing, English/Spanish UI, independent word language, rematch,
reduced motion, mute, denied audio, keyboard-only voting, and a mobile keyboard.
Inspect both actual network payloads and visible UI for privacy. Verify the
catalog remains lazy and UNO/Catan behavior remains intact.

During implementation, run from the repository root:

```sh
bun run check
bun run test
bun run build
bun run test:e2e --project=chromium
bun run test:e2e --project=webkit
bun run format:check
```

Format maintained files as needed before the final formatting check. Chromium
and WebKit are required; final Safari on macOS/iOS must additionally validate
touch, keyboard resizing, dossier privacy, motion, and gesture-unlocked audio.
WebKit automation is not a claim of Safari device validation. Run a real group
playtest in each content language: assess clue ambiguity, waiting comprehension,
vote confidence, result explanations, and whether the pacing feels lively.

## Completion criteria

- Complete base-game matches for 3–9 players follow the selected Spanish baseline
  and clearly disclosed app conventions, with no power-card claims.
- Hidden roles, words, pending ballots, and guesses obey the projection contract
  in snapshots, assets, events, errors, and reconnect paths.
- Friends can understand and finish every phase on mobile and desktop; nine-player
  play and Spanish copy remain readable.
- Animation gives immediate, synchronized feedback without governing gameplay;
  reduced-motion and silent play are equally functional.
- Rule, session, privacy, browser, and production-build checks pass; manual device
  and group-play evidence is recorded accurately.

This planning session changes only this document. Application implementation,
dependency installation, generated art, and application test runs are deferred.
