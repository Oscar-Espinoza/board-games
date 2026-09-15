# ADR 020: Azul Rich & Dramatic presentation

Date: 2026-09-14. Status: accepted.

## Context

[ADR 017](017-azul-table-light.md) established Azul's stable presentation
contracts: a single factory ring, real opponent boards, exact uncapped scores,
compact colour/destination dialogs, accepted-snapshot animation and measurable
`data-azul-location` anchors. Its CSS-led Table Light materials did not establish
the photographed ceramic, textile, printed board and aged-metal quality wanted
for the production table. An isolated Svelte prototype proved that generated
raster materials can supply that fidelity without Canvas, WebGL or changes to
the game architecture.

## Decision

Replace Table Light directly with the approved Rich & Dramatic presentation.
Reuse the existing production components and state-driven HTML: generated WebP
artwork provides the dark woven table, five glazed tile families, factory plate,
board substrate, floor rail, score rail and restrained props. High-resolution
generation sources remain outside the browser static directory. Dynamic tiles,
pattern lines, wall, floor, bonuses, score, names, counts, selection states and
hit targets remain Svelte/HTML/SVG.

On sufficiently tall desktop viewports, 5, 7 or 9 factory plates occupy one
perspective-correct circular ring around a protected centre rectangle. The local
board is fixed beneath the ring; factory, centre and board bounds never overlap.
The board exposes all five pattern rows, wall, printed floor penalties
`−1, −1, −2, −2, −2, −3, −3`, end bonuses `+2/+7/+10`, exact score and a separate
ornamental 0–100 rail with a clamped marker and `100+` endpoint.

At widths at most 900px or heights at most 800px, the established whole-factory
and destination-dialog interaction remains. The local board becomes a
collapsed-by-default 60px tray with a dynamic miniature and exact score. Its
44px toggle expands a full board over the lower table; only this explicit state
may cover lower factories. One board instance is rendered at a time, so all
table anchors stay unique and measurable. Optional props disappear in compact
layouts.

The first-player marker, rules, actions, public/private projection, Socket.IO
protocol, accepted events, revision gate, retry policy, audio and deterministic
practice state are unchanged. Table Light is not retained as a theme or runtime
fallback. ADR 017 remains the history and source of the retained behavioral
contracts; this decision supersedes its visual materials and viewport layout.

## Consequences

The optimized browser assets are production dependencies and require Chromium
and WebKit loading/compositing checks. Geometry tests cover each factory count,
and browser checks include full plate/centre/board bounds rather than only
controls. Flight wrappers mount the same raster-backed `Tile` component, keeping
their existing endpoint and cancellation behavior. Physical Safari, real-device
touch/audio and fluent Spanish review remain manual checks.
