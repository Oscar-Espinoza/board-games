# Catan

`games/catan` owns the TypeScript rules, stable board topology, recipient views,
Svelte/SVG table, original artwork and rule tests. The rules were ported from this
repository's Rust implementation, based on the sixth-edition base game and
5–6-player extension.

Implemented: 3–6 seats, variable snake placement or published beginner setup,
resource production and shortages, distance/connectivity and piece supplies,
ports/bank trading, consent-based player offers, seven/discard/robber/theft,
development cards, exact Longest Route and Largest Army, ten-point victory and
5–6-player paired action opportunities. The shared room system supplies start,
rematch, invitation URLs, disconnected seat reservation and credential recovery.

Only a player's own resource and development identities reach that browser.
Opponents expose public counts and public points; hidden victory points remain
private until the winner is announced. The original illustrated terrain is
retained, rendered as SVG instead of wgpu.

The Bun server owns randomness; tests inject deterministic streams. Historical
ChaCha replay bytes, browser host transfer, WebRTC and GPU effects are retired.
See [architecture](../architecture.md) and [artwork provenance](catan-assets.md).

## Island controls and practice

Hover or keyboard-focus a legal location to see a translucent settlement, city, road or robber. The hints are otherwise hidden. Double-click a location to place immediately; single-click retains Confirm/Cancel. Select the location (or use **Legal locations**) to preview a piece,
then Confirm or Cancel. The island supports 1–3× zoom with the wheel anchored at the mouse, pinch anchored between the fingers, or +/− controls, without drag-to-pan. 100% resets the view; when the map is focused, +/− zoom and Home resets.
Enter/Space selects a focused placement; Escape cancels a preview or closes a panel.
Each player has a civilization name, crest and matching pieces. For up to four
players, civilizations occupy cardinal seats with your civilization to the south.
These identities are cosmetic and do not change the rules. Trade and
Development cards expand into scrolling panels, using bottom sheets on phones.
Settings contains Sound, Motion, Language and How to play in English and Spanish.
Resource cards show the five resources and their counts; hover a card for bank stock.
Harbor boats show resource icons and exchange rates. Dice tumble to accepted results,
and buildings land with a layered falling rush, bass impact and debris sound. System
reduced motion takes precedence over the remembered motion preference.

**Try Catan** in the catalog opens a local sandbox. Choose a scenario and control
any of four seats; the seat selector is always labeled. Reset scenario restores
its fixture. Reloading returns to setup. The fixtures redistribute existing cards
and resources to demonstrate legal moves; multiplayer rules and setup are unchanged.

The turn controls sit beside the resource hand without a surrounding panel; six-faced dice land on the island. Accepted rolls throw the dice onto the island through a randomized tumble with diminishing bounces and a short, 520 ms final tip instead of a prolonged low-speed rotation. They clear once resource delivery finishes, leaving the board unobstructed; End turn stays disabled until then. With motion disabled, the result is shown briefly without travelling effects. Production follows the roll: illustrated, quantity-labelled resource tokens pause over the source, travel to the receiving seat, and highlight it on arrival. Deliveries last 1.9 seconds and start 700 ms apart; motion preferences and revision handling still settle directly to the authoritative result. Click the Trade button beside an opponent to open a player offer with illustrated resource quantities, or use Open offer to propose an exchange to the table. Bank exchanges have a separate Bank button and panel. Player offers shows incoming and own offers with per-offer actions; accepted submissions open this view with a confirmation. Unavailable offers explain why on hover or focus, and clicking them plays a quiet rejection cue when sound is enabled. Offers require resources to give and distinct resources to receive. Owned development cards appear alongside resources; clicking a card shows its legal actions and timing guidance. In practice, click a player name to switch the controlled seat freely, or select it in Settings. Practice automatically follows the next required player during setup, turn changes and pending discards; this can be disabled in Settings. Seat switching never opens trading, and multiplayer has no seat switching or auto-rotation.

Hold Roll dice (pointer, Space or Enter) to charge over three seconds; release to throw. A full charge adds longer, randomized shoreline rebounds before each die settles independently. Their paths follow momentum, gravity, friction and damped shoreline impacts; no shared landing spot pulls them back together. Strength is validated public presentation metadata and does not affect the dice outcome or consume additional rules randomness. Escape, pointer cancellation and focus loss cancel charging. Resource delivery waits for the longer throw to finish. Trading stays disabled during production and the visible roll; offers open beside the selected seat on desktop and in a bottom sheet on phones. Offers stay addressed to the chosen player (or Everyone for a general offer). Unboxed +/− resource steppers replace offer number inputs.

Build controls pair each piece icon with its name. Selecting Road, Settlement or City reveals translucent pieces at every legal position on the island; choosing one still previews before confirmation, and double-click places it. The numbered legal-locations menu has been removed.

Player summaries arrange identity, stats and trading horizontally on desktop. The controlled player summary sits to the left of the build controls, clear of the bottom harbor. At zoom levels above 100%, drag to pan (or use arrow keys with the map focused); panning keeps part of the island visible and never selects a placement. Reset view restores the fitted island.

The hand grows to the right from a fixed starting position and overlaps cards when space is tight, without scrollbars. Duplicate resources and development cards share quantity badges, so there are at most ten visible stacks (five resource types and five development types).

## Invariants

Presentation events are typed, generated only by accepted rules actions and projected per player; theft identities and hidden development cards stay recipient-only ([ADR 011](../adr/011-catan-presentation.md)). The physical tabletop uses bundled painted WebP scenery under the real SVG island, cardinal wooden plaques, a local hand below its plaque and parchment building costs; desktop stays within the viewport and the last dice result may rest in the bowl without replaying an event ([ADR 022](../adr/022-catan-physical-table.md)). `/practice/catan` fixtures never reach multiplayer or eager catalog metadata.
