# ADR 025: Carcassonne standing scenery

Status: accepted. September 22, 2026. Amends [ADR 024](024-carcassonne-painted-table.md).

The painted table now approaches the September 2026 reference image: completed
cities stand as walled towns, completed monasteries as churches, meadows carry
trees, sheep and the occasional windmill, rivers flow under bridges and tiles
show cardboard thickness. This is presentation only. Rules, payloads, privacy and
the event contract are unchanged.

## Decisions

- **One affine plane still owns everything.** `lift(h)` in `table/camera.ts` is the
  world-space offset that reads as `h` units straight up on screen. Walls and tile
  edges are extruded by stacking copies at multiples of that offset; sprites stand
  upright via the existing `uprightMatrix`. No CSS perspective is introduced and
  pointer inversion is untouched. The ground tilt was retuned toward the reference
  (`a 1, b .05, c -.13, d .74`).
- **Three render passes** inside `board-plane`: ground (tile bodies, `TileArt`,
  highlights), elevation (`table/Elevation.svelte`: walls, sprites and figures,
  tiles ordered back to front by projected depth, `pointer-events: none`), then an
  interaction overlay (region targets and magic markers) so nothing standing
  hides a legal target.
- **Deterministic layouts.** `table/scenery.ts` flattens the existing `cityPath`
  and `roadPath` geometry and derives house, tower, keep and meadow slots from the
  tile id and board key only. Reloads and every recipient draw the same town.
- **What stands.** Unfinished cities show a low two-course wall rim. A completed
  city raises its walls to full height and fills with houses and wall towers; a
  completed city of three or more tiles also gets a keep on its broadest region.
  Completed monasteries stand as churches. Meadow props are always present; small
  props drop out below 0.45 zoom to keep large boards cheap.
- **Rise is event driven.** Only newly accepted `place` events (through the
  existing `EventGate`) mark the features they completed as rising, using the
  public feature snapshot (`risingFeatures`). Reloads and reconnects therefore show
  finished towns already standing and never replay the animation.
- **Ambient motion** (river shimmer, swaying trees, chimney smoke, slot glow) is on
  by default, persisted per browser with the other viewer preferences, toggled in Settings
  and disabled by `prefers-reduced-motion`. When off, completed features appear
  instantly.
- **Sprites** are Codex-generated painted WebPs under
  `apps/web/static/games/carcassonne/sprites/`, keyed from magenta or transparent
  sources by [`docs/carcassonne-3d/key-sprites.py`](../carcassonne-3d/key-sprites.py).
  The prompt set is recorded in [the sprite notes](../carcassonne-3d/README.md).
  The hand tray, drag ghost, lessons and artwork inventory keep the flat renderer.
- **Figures** use four neutral painted sprites (`figure-*.webp`) tinted per player
  by an SVG multiply filter everywhere a figure appears: table, tray, drag, seat
  plaque portrait and remaining-supply icons. Seat colours were made more vivid;
  seats are distinguished by colour and name, without painted numbers.
- **Colour grade.** Meadow and town textures were regraded warmer, roads widened to
  sandy paths and rivers turned blue to match the reference.
- **Table journal** moved from Settings to a non-modal header panel. It omits
  draws, and only entries with a map target are buttons; activating one pans the
  map without closing the panel on desktop.

## Consequences

Every presentation contract from ADR 024 remains: local assets only, SVG/Svelte
text and controls, the fixed desktop column and tray, compact layouts, drop
previews requiring confirmation and fixture isolation. Physical Safari/iOS and
performance on very large real boards remain to be validated on devices.
