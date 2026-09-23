# Codenames

4–8 friends form two teams, each with exactly one spymaster and at least one
operative. Everyone chooses a role and confirms versioned readiness. Role changes
clear consent; absent seats prevent the deal. The fixed board language is English
or Spanish. A random starting team receives 9 agents; the other 8, plus 7 civilians
and 1 assassin. Operatives receive only words and revealed identities. Only
spymasters receive the hidden key, regardless of host status.

## Clues and turns

Phases are `setup`, `clue`, `guessing`, `finished`. The active team's spymaster
submits a word and count. Words are NFC-normalized and trimmed, 1–80 graphemes,
without control/format characters. Counts are integers 0–9 or `unlimited`.
The app stores clues; the group judges semantic legality aloud. There is no clue
review, penalty or agreement-option subsystem. Normal clues should concern meaning,
not spelling, position, gestures, or unrevealed words and their forms.

Only active-team operatives may select and confirm an unrevealed word after a clue.
A finite clue permits count + 1 guesses, including earlier clues. Zero and unlimited
remove the numerical cap. Make at least one guess before End turn becomes available.
Own agents allow continued guessing within the budget. A civilian, opposing agent,
exhausted finite budget or End turn hands off: active team switches, turn increments,
clue clears, and the other spymaster gives a clue. An absent required actor blocks
their actions; hosts have no substitute powers.

A team's last agent immediately wins for that team, even if the opponent revealed
it. The assassin immediately loses for the active authenticated operative's team.
These results precede handoffs. Everyone sees the full key after finishing; only
the host may start a rematch with fresh roles and consent.

## History, privacy and sessions

Newest-first public history records team, turn, clue/count and every confirmed
guess's word/index/revealed identity. It contains no unrevealed identity. Own guesses
have a success mark; civilian, opponent and assassin guesses have distinct treatment
and accessible identity labels. Key permutations must leave operative payloads
identical. Private keys, public snapshots and history are explicitly projected.

The room binds actor identity. Selection is local; it is cleared on state changes,
disconnect/reconnect, resize, visibility changes, errors and match changes.
The event gate suppresses duplicate/gapped/reconnected presentation. Only unchanged,
uncommitted setup readiness can retry stale revisions (at most three attempts,
stable action ID). Clues, guesses and end-turn never automatically retry.
Reserved seats recover their role; expired reservations may be replaced. Setup
replacements renew everyone's consent. Host promotion never grants secrets.

## Table and accessibility

Header: real room/invite, seat count, viewer, Rules, About and Settings. Team panels
show exact remaining counts; the centre shows round, active team, clue and guesses.
Revealed cards keep coloured paper word faces. Spymaster display preference persists
locally; the actual key never reaches operatives until the finished public board.
Players are grouped by team, including reserved/disconnected states. No chat.

The main screen fits 1440×900, 1280×720, 768×1024, 390×844, 360×640 and 320×568.
Compact screens hide props and move history/players/key to accessible native dialogs;
clue composition also uses a dialog. Dialog content can scroll internally. All targets
are at least 44px. Known card identities include SVG symbols as well as colours.
Text is localized in English and Spanish; Archivo is self-hosted with Spanish glyphs.
Original generated WebP wood/transparent props are an approved Codenames-only asset
exception. No gameplay information or writing is baked into them.
Existing audio unlocks only on a gesture, fails silently and adds no new cues.
Accepted public events drive reveals, history and turn changes; reduced motion
suppresses animations. Settings preserves sound/volume/motion/key preferences.

`/practice/codenames` has local setup, full-board clue, coherent round-three history,
final-agent and assassin fixtures, four/eight seats and role switching. Multiplayer
initialization and eager catalog metadata never import these fixtures.

[ADR 019](../adr/019-codenames-table-turns.md) supersedes the relevant voice-only
clauses of [ADR 018](../adr/018-codenames-voice-table.md). See the
[accepted design](../codenames-redesign/README.md).
Classic rules: [CGE English](https://filemanager.czechgames.com/storage/files/codenames/rules/CN%20rulebook%20EN%2030.pdf)
and [CGE Spanish](https://filemanager.czechgames.com/storage/files/codenames/rules/CN%20rulebook%20ES%2007.pdf).

## Invariants

Setup, clue, guessing and finished phases with authoritative active team, clue, guess budget and public history. Only the active spymaster clues; only active-team operatives guess or end the turn. Keep mandatory first guesses, immediate wins, unanimous setup readiness and recipient-private keys in actual payloads ([ADR 019](../adr/019-codenames-table-turns.md)). Never retry clues, guesses or end-turn; only still-valid readiness retries coded stale errors (same action ID, at most three attempts). Bundled WebP materials are Codenames-only; text stays Svelte/CSS.
