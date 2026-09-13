# Library rulebook coverage

All examples teach the current implementation. Scenario IDs are stable lesson IDs; each has Before, Action, Result frames in English and Spanish. The browser imports presentation only.

| Game / chapter               | Scenario IDs                                                                                                                                                                               | Authority                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| uno / setup                  | deal, match, draw                                                                                                                                                                          | docs/rules.md; games/uno/src/index.ts                           |
| uno / actions                | skip, reverse, wild, wild-four                                                                                                                                                             | docs/rules.md; games/uno/src/index.ts                           |
| uno / penalties              | stack-two, stack-four, pay                                                                                                                                                                 | docs/rules.md; games/uno/src/index.ts                           |
| uno / declaration            | declare, catch, catch-window                                                                                                                                                               | docs/rules.md; games/uno/src/index.ts                           |
| uno / ending                 | win, reshuffle, short-stock                                                                                                                                                                | docs/rules.md; games/uno/src/index.ts                           |
| catan / setup                | setup, production, shortage                                                                                                                                                                | docs/games/catan.md; games/catan/src/index.ts                   |
| catan / building             | road-cost, settlement-cost, city-cost, development-cost, distance, supplies                                                                                                                | docs/games/catan.md; games/catan/src/index.ts                   |
| catan / trade                | bank, offers                                                                                                                                                                               | docs/games/catan.md; games/catan/src/index.ts                   |
| catan / robber               | seven, robber                                                                                                                                                                              | docs/games/catan.md; games/catan/src/index.ts                   |
| catan / development          | timing, knight, monopoly, road-building, invention                                                                                                                                         | docs/games/catan.md; games/catan/src/index.ts                   |
| catan / awards               | longest, army, victory                                                                                                                                                                     | docs/games/catan.md; games/catan/src/index.ts                   |
| catan / extended             | paired                                                                                                                                                                                     | docs/games/catan.md; games/catan/src/index.ts                   |
| carcassonne / basics         | setup, turn, matching, unplaceable                                                                                                                                                         | docs/games/carcassonne.md; games/carcassonne/src/index.ts       |
| carcassonne / ownership      | deploy, merge                                                                                                                                                                              | docs/games/carcassonne.md; games/carcassonne/src/index.ts       |
| carcassonne / scoring        | road, city, monastery, farmers, final                                                                                                                                                      | docs/games/carcassonne.md; games/carcassonne/src/index.ts       |
| carcassonne / figures        | standard, large, abbot-figure, builder-figure, pig-figure                                                                                                                                  | docs/games/carcassonne.md; games/carcassonne/src/index.ts       |
| carcassonne / river          | river                                                                                                                                                                                      | docs/games/carcassonne.md; games/carcassonne/src/index.ts       |
| carcassonne / abbot          | abbot                                                                                                                                                                                      | docs/games/carcassonne.md; games/carcassonne/src/index.ts       |
| carcassonne / inns           | inn, cathedral                                                                                                                                                                             | docs/games/carcassonne.md; games/carcassonne/src/index.ts       |
| carcassonne / traders        | goods, builder, pig                                                                                                                                                                        | docs/games/carcassonne.md; games/carcassonne/src/index.ts       |
| carcassonne / flight         | flight                                                                                                                                                                                     | docs/games/carcassonne.md; games/carcassonne/src/index.ts       |
| carcassonne / messages       | message-trigger, message-1, message-2, message-3, message-4, message-5, message-6, message-7, message-8                                                                                    | docs/games/carcassonne.md; games/carcassonne/src/index.ts       |
| carcassonne / ferries        | ferry                                                                                                                                                                                      | docs/games/carcassonne.md; games/carcassonne/src/index.ts       |
| carcassonne / gold           | gold, gold-final                                                                                                                                                                           | docs/games/carcassonne.md; games/carcassonne/src/index.ts       |
| carcassonne / magic          | magic                                                                                                                                                                                      | docs/games/carcassonne.md; games/carcassonne/src/index.ts       |
| carcassonne / robbers        | robber                                                                                                                                                                                     | docs/games/carcassonne.md; games/carcassonne/src/index.ts       |
| carcassonne / crop           | crop, crop-add                                                                                                                                                                             | docs/games/carcassonne.md; games/carcassonne/src/index.ts       |
| azul / draft                 | draft, marker                                                                                                                                                                              | docs/games/azul.md; games/azul/src/index.ts                     |
| azul / wall                  | pattern, cross, penalty                                                                                                                                                                    | docs/games/azul.md; games/azul/src/index.ts                     |
| azul / end                   | finish, conventions                                                                                                                                                                        | docs/games/azul.md; games/azul/src/index.ts                     |
| codenames / setup–connection | setup, authoritative clues, active-team guesses, budgets/handoffs, finish, reconnect/history                                                                                               | docs/games/codenames.md; games/codenames/src/index.ts           |
| sushi-go-party / quick       | draft                                                                                                                                                                                      | docs/games/sushi-go-party.md; games/sushi-go-party/src/index.ts |
| sushi-go-party / dishes      | nigiri, maki, temaki, uramaki, tempura, sashimi, dumpling, eel, tofu, onigiri, edamame, miso, chopsticks, spoon, menu, special_order, takeout, wasabi, tea, soy, pudding, ice_cream, fruit | docs/games/sushi-go-party.md; games/sushi-go-party/src/index.ts |
| sushi-go-party / advanced    | advanced, conventions                                                                                                                                                                      | docs/games/sushi-go-party.md; games/sushi-go-party/src/index.ts |

## Presentation boundary

The home route loads original SVG box artwork and metadata only. Each rulebook
and its game-specific scene renderer are dynamically imported when requested.
There are 118 lessons across six games, each with three frames in both languages.
Scenarios use authored diagrams and quantities, not game instances or random
results. Existing in-game guides remain independent.

Search includes chapter titles, explanations and all frame captions. Closing a
modal restores focus; mobile chapter selection focuses its heading. Reduced
motion suppresses movement. Retry refreshes only already-requested JavaScript
assets under the app's own asset path, then performs a fresh navigation to clear
failed module imports, including WebKit's retained failed-resource cache. Transient
URL markers restore the requested book and are cleared after mount. Closing the
book while refresh is pending cancels that navigation. No reading history is stored.

## Verification mapping

- `scripts/library.test.ts` checks bilingual coverage, unique lesson IDs, supported
  scenes, all eleven optional modules and eight numbered messages. Numerical road,
  city, cathedral, inn, mage/witch, field and production examples use the pure rules.
- `scripts/three-games-library.test.ts` checks all three new guide structures,
  unique lesson IDs, distinct frame captions and matching English/Spanish keys.
- Existing UNO tests cover penalties, catches, drawing, final wilds and empty stock.
  Existing Catan tests cover costs, shortages, seven, trading, development, awards
  and paired opportunities. Existing Carcassonne tests cover 3.1 builder/pig behavior,
  messages, gold and module interactions.
- `tests/e2e/library.spec.ts` walks every scenario and verifies lazy-loading
  boundaries, recovery, stale imports, focus, desktop/mobile layouts and touch.

- `tests/e2e/three-games-library.spec.ts` covers the six-cover composition at
  desktop, tablet and phone sizes, all three new illustrated books in both
  languages, focus restoration and local practice links.

No gameplay rule was changed to accommodate a lesson. The existing Carcassonne
caveats about independent tabletop topology review still apply.
