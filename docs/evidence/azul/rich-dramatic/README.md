# Azul Rich & Dramatic evidence

These are actual captures of the production Azul components at the deterministic
four-player practice table after one accepted factory draft. They are not mockups
and do not use the removed `/dev` prototype. The accepted draft leaves one empty
plate, three loose centre tiles and a populated local pattern line so the board,
factory ring and centre layering are visible together.

| Review surface                         | Capture                                                                 |
| -------------------------------------- | ----------------------------------------------------------------------- |
| Chromium, 1728×960 viewport            | [Complete table](chromium/full-1728x960.webp)                           |
| WebKit, 1728×960 viewport              | [Complete table](webkit/full-1728x960.webp)                             |
| Ceramic group at rendered size         | [Tiles](chromium/tiles-close.webp)                                      |
| Factory plate and tiles                | [Factory](chromium/factory-close.webp)                                  |
| Dynamic board over generated substrate | [Player board](chromium/player-board-close.webp)                        |
| Board/frame/textile boundary           | [Material junction](chromium/board-table-junction.webp)                 |
| Compact board closed, 390×844          | [Complete factory ring](chromium/mobile/collapsed-390x844.webp)         |
| Compact board open, 390×844            | [Intentional lower-ring overlap](chromium/mobile/expanded-390x844.webp) |

Capture QA required every table image to decode with non-zero natural dimensions,
stable factory/board geometry after settling, zero document overflow and no page,
console or failed-request errors. Reloads reproduced the same state, asset list,
text, anchors and geometry; Chromium also produced an identical settled screenshot.
The broader production journeys exercise the live rules, sockets, accepted-event
flights and compact dialogs independently of this capture fixture.

## Remaining visual mismatch ledger

| Reference                                                                                     | Current                                                                                         | Mismatch                                                              | Possible future action                                                                                   |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Loose centre tiles form a denser, naturally irregular pile.                                   | State-owned centre groups keep each colour selectable and expose numeric counts.                | The pile is more orderly and sparse in early-round states.            | Add bounded per-tile rotation/offset metadata without obscuring hit targets or locations.                |
| Side boards are larger photographed objects with more readable tile state.                    | Opponents are real dynamic boards, compressed to fit outside the factory ring.                  | Their paper and wall detail recedes more than in the reference.       | Enlarge inspected boards only; increasing persistent previews would reduce ring breathing room.          |
| Reference lighting gives every object a single especially coherent photographic shadow field. | Intrinsic highlights are baked into generated objects and HTML adds restrained contact shadows. | Cross-object light response is fixed rather than physically reactive. | Regenerate any future asset family as one lighting batch and retain the current shared shadow direction. |
| Reference surrounds the table with additional partial boards and textiles.                    | Lantern, chest, tea glass and tile bag frame the scene without covering play.                   | The outer left/right field remains somewhat calmer.                   | Add one or two transparent edge props only after testing opponent and compact clearances.                |

Physical macOS/iOS Safari, real-device touch/audio and subjective speaker review
remain manual. Linux Playwright WebKit is the automated Safari-engine proxy.
