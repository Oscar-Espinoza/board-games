# ADR 017: Azul Table Light presentation

Date: 2026-09-13. Status: superseded visually by [ADR 020](020-azul-rich-dramatic.md); interaction and presentation-event contracts retained.

## Context

Azul's rules, projections, presentation events and validation are complete and
reviewed. Its table is not: it reads as a correct web page rather than a game on
a table. Four gaps carry most of that. The factory ring only applies at five or
fewer displays, so three- and four-player games fall back to two flat rows and
never form a circle. The centre of the table is a legend of per-colour counts
rather than the loose pile the physical game accumulates. Opponents are text
strips with glyph patterns, so no player can see another player's wall, which is
most of what makes Azul social. There is no score track at all, only a number.

Three directions were drawn at full fidelity and compared: one faithful but
digital-native, one reproducing the physical components as a top-down photograph,
and one reinterpreting the theme freely. Two rulebook facts corrected the second
of those and matter for any of them: the retail board is flat printed cardboard
with nothing recessed, and the faded motifs are printed on the wall rather than
on the pattern lines.

## Decision

Adopt the first direction, Table Light: the real components and proportions,
rendered digital-native under a single warm light. The factory displays form one
circle at every player count and on every viewport, with the open middle holding
loose tiles. Opponents render through the existing player-board component at a
reduced tile size instead of as text. Each board gains the 0–100 score track and
its marker, and the arrow the retail board prints between each pattern line and
its wall row.

The change is presentation only and stays inside the boundary
[ADR 013](013-three-game-delivery.md) already set. Rules, validation, the public
projection, the accepted-event union, the revision gate and the action envelope
are untouched, as is the separate visual snapshot the board renders from, which
is load-bearing for animation.

The five tile colours become one game-owned module at `games/azul/src/palette.ts`
with surface and geometry custom properties in `games/azul/src/tokens.css`,
replacing three copies inside the game package. They stay game-local rather than
moving into shared packages: each game owns its own presentation, and one game's
palette is not a demonstrated shared concept. The catalog cover art keeps its own
deliberately lighter palette and is not folded in. Display and interface faces are
self-hosted and scoped to the Azul table, so no other game is restyled.

The main screen fits the viewport without scrolling, superseding the earlier
scrolling proposal. Wide layouts place supply and the playable board side by side
under a shallow opponent row, including all three opponents in four-player games.
At widths ≤900px or heights ≤680px, whole 56px factory buttons open a colour
dialog, followed by a full-size destination/confirmation dialog with 44px targets.
The table retains an inspectable local miniature. Short landscape screens place
the ring beside the board overview. Round details and results use dialogs.
Real safe-area insets remain. Compact boards are explicitly noninteractive;
separate inspect buttons open upright full-size dialogs that emit no table anchors.
Only desktop previews tilt. Exact scores remain uncapped; only the decorative
0–100 rail clamps, with a `100+` endpoint indicator.

A pure local presentation planner derives timed steps from previous and accepted
public snapshots and existing events. Wall points use `scoring.points`, floor
loss uses `penalty.loss`, and accepted bonuses follow cleanup. Final-draft slots
are reconstructed before surplus/floor cleanup; the marker returns separately.
Draft/spill durations and wall-row delays stay; refill waits for cleanup, and
completion follows the full timeline. Real tile artwork is mounted inside each
body-level flight wrapper. Existing audio remains unchanged.

## Consequences

Three contracts now constrain presentation work that previously looked free. The
`data-azul-location` anchors are measured for every flight and a missing or
zero-sized anchor drops that animation silently. Flights live outside the table and must carry explicit artwork styles.
Inspection copies emit no anchors; scattered tiles have distinct presentation
keys with canonical centre and summary fallbacks.
The browser suite pins class names, accessible names and geometric assertions, so
the loose centre pool and the opponent boards must land with their test updates in
the same change.

The corrected redesign is implemented in game-local presentation; see
[Azul redesign](../azul-redesign/README.md) for the dependent migration milestones, tokens,
components, motion and mobile layout. The mockups there are design targets and are
explicitly not browser evidence. Catalog-wide tokens, the unloaded global font
declarations and the gray-side board variant remain out of scope. Automated captures do not compare screenshot baselines; explicit visual review
and endpoint assertions are required. Safari on a real
device, touch quality, iOS audio and Spanish editorial review still require human
validation after implementation.
