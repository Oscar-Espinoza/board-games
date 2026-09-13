# Little Secret

This implementation selects **Spanish classic Little Secret, 3–9 players**, with the optional classic seven-type powers. Spanish scoring applies in both interface languages. It is the seventh catalog game.

## Edition provenance

The edition research supplied with the implementation plan was checked September 12, 2026:

- [Asmodee Spain classic listing](https://www.asmodee.es/product/little-secret/) describes 3–9 players, 17 missions and optional powers.
- [Official Spanish rulebook](https://cdn.svc.asmodee.net/production-asmodeees/uploads/2023/06/Reglas_Little_Secret.pdf) supplies the distribution, core loop, scoring and five-point threshold below.
- [Classic printed power cards](https://static.wixstatic.com/media/01247e_c47ec43928c04d4ca09fab77617d989f~mv2.jpg) identify the pinned power set. The effects below follow these cards.
- The [French reissue](https://www.asmodee.fr/product/little-secret-reedition-fr/) lists 110 cards, 4–8 players and EAN 3770037991400. Its complete rule changes and exact release date were not verified; this app does not implement it.
- The [Exploding Kittens US instructions](https://www.explodingkittens.com/pages/how-to-play-little-secret) use different role names, tie rules and transferable Secret Weapons. Those rules are excluded.

No standalone expansion was verified in that research. Here, the expanded experience means the classic game's included powers. All shipped word pairs, envelope illustrations and badges are original, rather than reproductions of commercial cards. The 17 physical missions are replaced by original, unused digital word pairs.

## Core rules

| Players | Disciples | Infiltrators | Journalist |
| ------- | --------- | ------------ | ---------- |
| 3       | 2         | 1            | 0          |
| 4       | 3         | 1            | 0          |
| 5       | 3         | 1            | 1          |
| 6       | 4         | 1            | 1          |
| 7       | 4         | 2            | 1          |
| 8       | 5         | 2            | 1          |
| 9       | 5         | 3            | 1          |

Disciples share a password and Infiltrators share a related alternative. Neither knows their faction or teammates. The Journalist knows their role and receives no password. A volunteer starts the mission. Living players give a one-word clue in fixed seat order, debate, then vote. They may not say their password or repeat another person's clue. Players enforce spoken clue legality using external voice or in-person conversation. With powers, everyone must also see one another through external video or in person. The app does not record or judge speech.

The most-voted player is eliminated and reveals their role. Ties use a living Sage, or rock–paper–scissors. An eliminated Journalist gets one guess of the Disciples' password. A correct guess ends the mission immediately and awards only that Journalist three points. Otherwise play continues after applicable reactions, starting left of the original voting victim and skipping eliminated seats.

After reactions, the mission ends when all intruders are eliminated or two or fewer players remain:

- All intruders gone: every Disciple earns **1**, including eliminated teammates.
- An Infiltrator survives: every Infiltrator earns **2**, including eliminated teammates.
- The Journalist survives: that player earns **3**.

The two intruder rewards can coexist. Disciples receive nothing in that case. Mission points apply together. Once any score reaches **5**, the highest total wins; tied highest totals share victory.

## Pinned classic powers

| Spanish card | English UI | Effect                                                                    |
| ------------ | ---------- | ------------------------------------------------------------------------- |
| Enfurecido   | Mime       | Mime instead of speaking a clue.                                          |
| Novato       | Novice     | Give a normal clue; remain silent during debate. Voting is allowed.       |
| Anciano      | Elder      | Give two words during the clue turn.                                      |
| Sabio        | Sage       | While alive, select the eliminated player among tied highest vote totals. |
| Asesino      | Revenant   | When eliminated, optionally eliminate another living player.              |
| Dictador     | Dictator   | The player's vote counts twice.                                           |
| Adepto       | Adept      | No additional effect.                                                     |

Powers are public and independent of secret factions. The app enforces voting, tie decisions and elimination choices. Clue delivery and debate silence remain social rules.

## Explicit digital conventions

These resolve transitions that the printed materials do not fully specify:

1. Powers default off and require 6–9 seats. Shuffle a nine-card deck: the six distinct effects and three Adepts. Deal one per seat and retain powers throughout the match. Factions change each mission.
2. The host configures password language and powers in setup. Changes increment the setup version and clear readiness. All connected seats acknowledge the current setup. The chosen word language remains fixed independently of interface language.
3. The server selects an unused pair and randomizes which member is the majority password. There is no numbered-line selection. Production packs contain 300 pairs per language with opaque IDs, version `original-2026-09-v1`, and explicit aliases. No pair repeats during a match.
4. The first accepted volunteer action starts the mission. After the last **Clue given**, debate begins. The current room host opens voting; host identity comes from the socket binding, including after host transfer.
5. Each living player votes for another living player. No self-vote or abstention. Confirmation commits an immutable ballot. Only who has committed is visible before all eligible voters commit. Reveal all ballots and weighted totals together.
6. A living Sage chooses only among the tied highest-total candidates, including themselves. An eliminated Sage has no authority.
7. Without a living Sage, tied candidates submit hidden, immutable RPS symbols. Reveal the completed round together. With two distinct symbols, retain the losing-symbol group. With one or three, retain everyone. Repeat with a fresh round ID until one loser remains.
8. A Journalist submits one confirmed, nonempty answer. Compare exact canonical spelling or explicit aliases after NFC normalization, trimming, collapsed whitespace and case folding. Preserve accents and `ñ`. There is no fuzzy matching or host override.
9. Resolve the eliminated Journalist's guess first, then their optional Revenant choice, then terminal scoring. A Revenant victim receives their own applicable reactions. Successful guessing ends the mission immediately, cancelling remaining reactions.
10. An eliminated player's solution remains withheld until their pending guess and elimination choice finish. Other eliminated players whose reactions have completed may privately inspect the solution and must keep it secret. Mission results reveal roles and both passwords to everyone.
11. Resolve reactions even if the initial elimination leaves two survivors. Then evaluate termination at **two or fewer** survivors. If play continues, start after the original voting victim, not a Revenant victim.
12. Every seat acknowledges a mission result before the next deal. A host rematch clears scores and returns to setup.
13. There are no automatic timeouts, forced guesses or host-forged ballots. Wait for reconnection or the existing replacement-seat mechanism. A replacement inherits its seat's pending choice and rotates its credentials.
14. Only still-valid, uncommitted readiness, continuation, ballots and RPS may retry coded stale errors. Keep the original action ID for at most three attempts and synchronize lost acknowledgements first. Never automatically retry volunteer claims, clue advancement, host voting transitions, guesses, Sage decisions or Revenant choices.

## Presentation and practice

The table uses original CSS/SVG paper envelopes, wax seals and public power badges. Desktop seats surround a central task area; narrower screens use a three-column seat grid. A player's envelope starts concealed, resets when seats or missions change, and closes when the tab becomes hidden. No faction styling appears on living password-holders.

Rules and settings live in corner controls. English/Spanish Paraglide messages include a searchable illustrated guide with 16 three-frame lessons: identity, setup, clues, votes, RPS, Journalist, reactions, scoring, digital conventions, and each of the seven powers. Keyboard focus returns from native dialogs. Sound unlocks only after a gesture, failures are nonblocking, and motion honors the system and table preference. Reconnection, identity changes and sequence gaps establish a fresh animation baseline.

`/practice/little-secret` uses the real rules with deterministic local fixtures and a separate 20-pair teaching pack. It offers three-player play, Journalist success/failure, six public powers, weighted/Sage voting, multiplayer RPS, Revenant targeting the Journalist, nine seats and shared victory. Settings allow switching the viewed seat and resetting scenarios; the suggested seat advances but every action remains manual. It creates no room or bots and stores no game state.

## Validation and manual acceptance

See [validation records](../validation.md) for commands and actual results. Rules tests cover all seat distributions, commitments, ties, reactions, scoring, content, projections and complete minimum/maximum matches. Socket tests inspect serialized snapshots and synchronization replies, including actor forgery, races, duplicate IDs, reconnect, host transfer and replacement. Browser tests exercise the guide, practice, independent seats, language changes, envelope concealment and responsive layouts.

Structural content tests cannot establish good gameplay vocabulary. Fluent Spanish review, human ambiguity/difficulty review of both packs, a real group voice/video playtest, and physical Safari/iOS validation remain manual acceptance checks until performed.
