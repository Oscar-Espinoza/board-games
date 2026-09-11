# ADR 011: Catan presentation events and local practice

Status: Accepted · September 10, 2026

Catan needs visible feedback for accepted moves, including repeated identical dice
results, without deriving private information from public state or replaying old
moves when reconnecting.

Keep rules and effects within the Catan package. After validating and applying an
action, derive typed events from the before/after state and increment the existing
revision. Public views expose public events; private views expose only events
addressed to that seat. Public theft includes participants and count, never the
resource. Development purchase kind is visible only to the buyer. Events describe
what occurred; they do not run rules or provide an alternate action channel.

The SVG browser board animates only consecutive revisions in the same seat,
round and continuous connection. It cancels obsolete decoration and settles to
canonical pieces on synchronization or reduced motion. Web Animations, CSS and
gesture-unlocked Web Audio stay Catan-specific; no shared engine is added.

A lazy `/practice/catan` route runs the existing rules with seeded randomness and
four switchable seats. Fixtures are separate from multiplayer initialization and
conserve finite resource/development inventories. Only the selected projection is
passed to the board, although the local sandbox necessarily owns all four seats.
No room, server cheat, bot, database or saved practice state is involved.

This adds one transient event batch to in-memory state and views. It is neither an
event log nor durable history. Skipped revisions deliberately omit intermediate
effects; the latest canonical state always wins.

UI revision: the island camera is fixed, superseding the first version's pan/zoom.
Civilizations and illustrated resource cards are cosmetic, with cardinal seats for
up to four players and perimeter seats for five/six. Settings and local scenario
controls are tucked into a menu. Dice and layered landing audio remain driven by
accepted presentation events; no rule or event privacy boundary changes.

Interaction refinement: bounded 1–3× wheel/pinch/button zoom is restored; drag-to-pan
remains disabled. Placement hit areas remain keyboard-accessible, but only hovered
or focused locations show a translucent piece. Double-click sends the ordinary
placement intention. Wheel zoom anchors to the pointer and pinch zoom to the
fingers’ midpoint; click outlines on SVG targets and the map are suppressed. These controls do not change rule validation.
