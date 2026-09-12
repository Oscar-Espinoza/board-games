# Catan artwork provenance

The original SVG illustrations, authored for this repository on September 7,
2026, are preserved in `games/catan/assets/`. No commercial card faces, rulebook
artwork, stock textures, external models or recorded audio are distributed.

`games/catan/assets/draw.py` is the deterministic authoring source for six
terrain paintings and five development faces. Its art-only seeds never consume game randomness. Run it from the assets
directory when regenerating the original artwork.

The Svelte board imports the individual terrain SVGs through Vite. They are
content-hashed and requested only after Catan is selected. The board's SVG owns
number tokens, roads, buildings, robber, ports and legal placement targets.
Unused terrain variants, portraits, resource icons and the old GPU atlas were
removed along with their generator branches. Historical artwork remains in Git
history; the maintained generator emits only artwork used by the current board.

The game is an unofficial implementation. Its name identifies the game; the
original rule references are preserved in the source snapshot recorded in
[the migration decision](../adr/009-typescript-catalog.md).

The second island UI adds original SVG resource illustrations in
`games/catan/src/ResourceArt.svelte`, a procedural water texture in
`games/catan/assets/ocean.svg`, shaded pieces and an illustrated hooded robber.
Resource-card faces reuse the repository's terrain art behind those illustrations;
they are not scans of commercially printed cards. Harbor icons use the same resource
illustrations. Dice faces are CSS pips; landing audio is synthesized locally with
Web Audio bass oscillators and filtered noise. No external assets or services are
required during play.
