# ADR 017: Azul Table Light presentation

Date: 2026-09-13. Status: accepted.

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

Existing motion is restyled, not replaced. Every accepted event, delay and travel
duration is preserved, including the flight appearance that is assigned in
JavaScript on a body-level node and cannot be reached by scoped styles.

## Consequences

Three contracts now constrain presentation work that previously looked free. The
`data-azul-location` anchors are measured for every flight and a missing or
zero-sized anchor drops that animation silently. The flying tile is styled outside
the component tree, so restyling the tile component alone leaves flights stale.
The browser suite pins class names, accessible names and geometric assertions, so
the loose centre pool and the opponent boards must land with their test updates in
the same change.

The redesign is documented rather than implemented; see
[Azul redesign](../azul-redesign/README.md) for the phased migration, tokens,
components, motion and mobile layout. The mockups there are design targets and are
explicitly not browser evidence. Catalog-wide tokens, the unloaded global font
declarations and the gray-side board variant remain out of scope. Safari on a real
device, touch quality, iOS audio and Spanish editorial review still require human
validation after implementation.
