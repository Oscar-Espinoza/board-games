# Codenames

Two teams of 4–8 seated players choose their own roles: exactly one spymaster
and at least one operative per team. Uneven teams are legal. The host chooses
English or Spanish board words and the abbreviation/multiword-name agreements
when creating a room. Everyone sees those fixed options before readying.
Changing role invalidates all readiness; a disconnected seat prevents dealing.
A replaced setup seat retains its assignment but requires fresh consent from all.
After the deal, roles and board language are immutable until host rematch.

A new board contains 25 distinct independently curated words, nine starting-team
agents, eight opposing agents, seven civilians and one assassin. Randomness is
injected; words, starting team and identity arrangement are shuffled separately.
No key exists during setup. Both spymasters receive the key, operatives do not.
Hosting grants no extra game information. Board words never change when interface
locale changes.

The active spymaster gives a meaning-based clue and count (0–9 or unlimited).
NFC-normalized Unicode clues preserve accents, reject invisible/control characters
and have an 80-character limit. Exact-word and multiple-word warnings are advisory:
the opposing spymaster judges semantic legality and agreed exceptions. Acceptance
opens guessing; rejection permits the opponent to reveal one own agent or skip,
then give their next clue. This mandatory pre-guess review is an app convention.
There is no retroactive challenge, undo, target marking or host override.

An operative selects locally, then explicitly confirms a reveal. The first valid
server intention wins competing guesses. At least one guess is required before
ending a turn. A finite clue allows count plus one guesses; zero and unlimited
have no numerical cap. An own agent allows continuing; a civilian or enemy ends
the turn. The assassin immediately awards victory to the opposite team. Revealing
all agents wins immediately, including an opponent's reveal or penalty benefit.
Finished boards expose the whole key and become inert. Host rematch creates fresh
team setup, consent and a new board.

Accepted events and public history contain only published clues and revealed
identities. History retains the most recent 200 entries. Presentation sequences
are independent of room revisions; initial loads, reconnects, gaps, role/round
changes, hidden tabs, resizing and motion changes establish a fresh baseline.
Motion decorates current state without delaying actions. Sound defaults enabled,
but context creation/resume requires a user gesture. Only sound/volume/motion
preferences are stored locally; never keys or game snapshots.

`/practice/codenames` is local role-switching training: full case, team setup,
final-agent and assassin scenarios. It never supplies multiplayer initialization.
Original SVG/CSS art and the searchable field manual contain no live private data.

## Sources

- [CGE classic English rules, EN 30](https://filemanager.czechgames.com/storage/files/codenames/rules/CN%20rulebook%20EN%2030.pdf)
- [CGE/Devir Spanish rules, ES 07](https://filemanager.czechgames.com/storage/files/codenames/rules/CN%20rulebook%20ES%2007.pdf)

These sources were verified in the preceding planning session. The generated key,
4–8 application capacity and explicit clue review are digital app conventions.

## Validation

Seeded rules, malformed intentions, all win paths, role permissions, presence,
metamorphic operative privacy, detached projection, bounded history and event
sequence behavior have automated coverage. Real Socket.IO coverage exercises
operative-host privacy, forged actors, competing guesses, stale/duplicate/round
intention handling, authenticated synchronization, reconnection and fresh rematch.
Browser results and remaining manual checks are recorded in the implementation
handoff. WebKit automation does not replace physical Safari/iOS validation; fluent
human Spanish review and a human four-person playtest remain required release work.
