# ADR 012: Carcassonne landscape and resumable decisions

Status: accepted. September 11, 2026.

Presentation updated by [ADR 024](024-carcassonne-painted-table.md); the engine,
authority and resumable-decision contracts below remain in force.

Carcassonne Big Box 3.1 joins UNO and Catan as a game-owned Bun/TypeScript package.
It uses the existing room and recipient-projection contract. Its integer-grid
landscape has explicit road/city regions and field half-edges. Connected features
are recomputed after each change because ferries can disconnect a road; a
merge-only union-find or permanent road-scored flag would be incorrect.

The game owns expansion setup and a resumable sequence of required decisions.
Only canonical accepted actions draw a tile, roll a die, score or advance seats.
Each pending choice contains an authorized actor, prompt ID and legal target
options. Presentation does not control continuation. Deck/message order remains
server-only. A narrow optional `GameDefinition.presence` hook lets room identity
changes invalidate setup readiness while preserving in-progress game decisions.
Room action context also supplies the current host identity. Carcassonne accepts
shared setup changes only from that host, including after automatic host transfer;
client controls merely reflect this server-enforced authority.

The Svelte board uses original SVG tiles, camera coordinates separate from board
coordinates, local placement confirmation, connected-feature inspection and
optional action-specific synthesized sound. The landscape fills the viewport, with
player seats around it and physical tile/meeple controls by the local seat. Pointer
gestures hold only local previews; legal targets come from projected choices, and
drops submit the same validated intentions as keyboard controls. Invalid or
cancelled gestures cannot advance the game. Settings contains auxiliary controls.
Sound uses broad filtered textures without pitched oscillators. Event sequences establish a silent
baseline on reconnection. Local `/practice/carcassonne` fixtures run the same rules
and follow the required seat, without a multiplayer debug endpoint or bot policy.

See [rules and conventions](../games/carcassonne.md). Exact edition fidelity needs
both deterministic tests and independent review of printed tile geometry; seeded
matches alone are insufficient evidence. No persistence or deployment is added.
