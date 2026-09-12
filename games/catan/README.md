# CATAN

See the [Catan rules and controls](../../docs/games/catan.md) for retained game behavior.
Rules remain independent of transport, the DOM and browser effects. Historical
ChaCha replay files are not compatible with the TypeScript port.

`src/index.ts` implements the shared game contract. `create` accepts optional
`{ setup: 'variable' | 'beginner' }`; variable is the default. The ordinary legal
intention list is calculated from authoritative state. Every accepted operation
returns a cloned state. Special trade/discard quantities are independently
validated. `view` constructs a public projection and only the requesting seat's
private hand, development cards and legal choices; no canonical state or deck is
serialized to players.

`src/Board.svelte` renders a responsive SVG island and semantic action controls.
Its illustrations are copied original repository artwork; `assets/draw.py` is
the original deterministic authoring source. The textured ocean, zoomable island without drag-to-pan, civilization seats, resource cards, placement previews, short SVG/Web Animations
and gesture-unlocked audio live in this game package. Typed accepted-action events
carry revisions and explicitly projected public/recipient details. Resynchronization
settles immediately rather than replaying effects.
No commercial rulebook images or third-party artwork are bundled. CATAN is not
an official CATAN product.

Run the rule regression suite from the workspace root with
`bun test games/catan/src/index.test.ts`.

The lazy `/practice/catan` route runs `src/practice.ts` fixtures with seeded local
rules and four switchable seats. It never creates a room or changes multiplayer
setup. Run all Catan rule, event/privacy and fixture tests with
`bun test games/catan`; browser coverage lives in `tests/e2e/catan-island.spec.ts`.
