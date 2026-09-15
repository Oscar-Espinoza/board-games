# Azul Rich & Dramatic: presentation sequence

`planPresentation(previous, accepted)` is a pure game-local planner. It consumes public snapshots and existing accepted events, producing temporary visual steps and timed flights. It never calls the rules engine, draws randomness, changes accepted events or infers new scoring outcomes. The revision gate still permits only uninterrupted consecutive accepted revisions for the same match and seat.

| Beat                                       | Start                                                                    | Duration   |
| ------------------------------------------ | ------------------------------------------------------------------------ | ---------- |
| Draft, overflow and marker travel          | 0ms                                                                      | 310ms      |
| Factory spill                              | 80ms                                                                     | 310ms      |
| Wall placement                             | 380 + row × 230ms                                                        | 240ms      |
| Floor loss                                 | Last wall arrival (at least 390ms) + 80ms                                | Score step |
| Pattern surplus and coloured floor cleanup | Floor-loss time + 100ms                                                  | 150ms      |
| Final accepted bonuses                     | Cleanup completion                                                       | Score step |
| Refill                                     | Later of 1740ms with walls / 430ms without, or cleanup completion + 50ms | 310ms      |

Reconstruct newly occupied pattern/floor slots from travel destinations before deriving cleanup, including the final draft's overflow and marker. Each wall arrival reveals its placement and adds `scoring.points`; `scoring.cells` supplies highlights only. Deduct actual `penalty.loss`, which can be less than the printed deduction, and then show accepted final bonus scores. Completed-pattern surplus and coloured-floor tiles travel to discard; the first-player marker has a separate return, never discard. Round-end detection includes rounds with no wall placements.

Completion comes from the full timeline. There is no separate fixed animation timeout controlling acceptance. The server still transitions atomically, and newer accepted snapshots immediately supersede temporary presentation.

Flights are body-level `.azul-flight` wrappers, with Web Animations on the wrapper and the real raster-backed `Tile` component mounted inside. Endpoint position and scale match measured destination bounds, including compact opponents and the collapsed local-board miniature. Completion and cancellation unmount every tile and remove wrappers, timers and scheduled sounds.

Measure table anchors only, never dialog copies. Canonical keys include factory slots, per-player pattern/wall/floor slots, marker, summary, bag, discard and centre colours. Scattered tiles additionally have `center/{color}/{slot}` keys. Canonical centre keys and summary anchors remain fallbacks; zero-sized elements cannot serve as destinations.

Skip, reduced motion, newer snapshots, reconnect, resize, scrolling, font geometry changes, dialogs and visibility changes settle immediately to the accepted view. The fixed viewport grid reserves its footer; compact layouts close the destination dialog before measuring table anchors. Submission does not change table geometry.

Keep `ceramicAudio()` unchanged: trusted-gesture unlock, existing sine voices and delays, persisted mute/volume and silent fallback. New sound voices are outside this implementation.
