# ADR 022: Catan physical tabletop presentation

Status: Accepted · September 15, 2026

The supplied `catan-new-ui.png` reference replaces the previous ocean UI. This is
a migration of the real Catan board, shared by rooms and local practice.

## Presentation

The island remains an SVG generated from the existing board topology. Following
visual review, the blue sea frame is removed: the sand-edged hexes sit directly
on the continuous ocean scenery, including on the five/six-player board.
Game-owned painted terrain textures sit beneath SVG number discs, harbors,
roads, settlements, cities, robber and keyboard/pointer placement targets.
Coordinate scales are presentation choices; canonical topology is unchanged.

Locally bundled WebP scenery and material textures are approved for Catan. The
background contains only scenery: ocean, wood, foliage, ropes, maps, compass and
ship. Resource illustrations and the development-card compass are decorative;
names and quantities remain HTML. The small `src/table/` components reuse resource
art for costs and render remaining public road/building inventory as wooden pieces.

Four player plaques surround the board. Extra seats retain perimeter positions.
The local plaque sits above the hand, controls occupy the lower left, and a
parchment cost reference occupies the lower right. Compact screens reorganize
the same controls and expose costs through rules/settings. The table never
scrolls. Panels can scroll internally; development stacks remain focusable.

Catan owns its wooden navigation, invite, language, settings and connection
toolbar. Rooms supply existing leave/invite callbacks and the catalog rulebook
through a snippet. Practice supplies the same rulebook and keeps local scenario
controls in settings. No parallel prototype or new route is introduced.

## Behavior

ADR 011's accepted-event, recipient privacy and cancellation boundaries remain.
The server, pure rules, projections, legal actions, turn order, trading, placement
confirmation and input-driven zoom/pan are retained. Hands and development types
come only from the selected private view; awards/inventory use public data.

Accepted rolls animate through the existing effects/audio system. Afterwards,
the latest public result rests in the wooden bowl. Synchronization can display
that result without replaying a roll. Reduced motion suppresses animation, and
an empty bowl never invents a result.

Build/development/end-turn availability comes from legal actions. Disabled actions
cannot send intentions. Trade buttons retain recipient selection and reasons.
No retry, rule or server behavior is added.

## Validation

Retain engine/presentation tests and browser cases for placement, upgrades, dice,
privacy, trading, development, awards and reconnects. Layout coverage checks
desktop fit, plaque text, unobscured harbors, the local plaque above the hand,
and direct rules/language controls. Chromium and WebKit are required; Safari
device validation remains a separate manual check.

See [artwork provenance and prompts](../games/catan-assets.md).
