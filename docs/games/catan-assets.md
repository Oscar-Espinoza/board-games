# CATAN artwork and sound provenance

All packaged illustrations, meshes and sound were authored for this repository
on September 7, 2026. No commercial card faces, rulebook artwork, stock textures,
external models or recorded audio are distributed. The requested references
informed broad qualities (blue sea, saturated terrain, wooden components); the
illustrations are original vector drawings.

- `artwork/catan/draw.py`: deterministic authoring source for twelve terrain
  paintings (two each of forest, pasture, field, hills, mountains and desert),
  eight animal portraits, five development faces and five resource icons.
  `python3 artwork/catan/draw.py` regenerates the editable SVG files with Python's
  standard library. Its fixed art-only seeds never consume game randomness.
- `artwork/catan/terrain-atlas.svg`: 1024×768 atlas of the twelve paintings,
  rasterized with the browser's native SVG decoder at loading time. The individual
  terrain SVGs also provide resource card faces. SVG artwork contains no labels;
  Rust renders sharp number text, probability dots, card names and counts separately.
- `crates/catan-web/src/graphics.rs`: raised discs, shallow terrain bevels,
  topology-following sandy shore and surf, turquoise coastal frame, contact
  shadows, painted roads/buildings and robber. UVs select terrain variation by
  stable tile index, without changing the shuffled board or replay.
- `crates/catan-web/src/table.wgsl`: sRGB-aware textured materials and restrained
  lighting. GPU mips average linear light. Static geometry remains resident.
- `crates/catan-web/src/browser.rs`, `web/catan.css`: avatar medallions, cards,
  piece rack, bonus tile, ports, semantic pip dice and walnut/sea table surface.
- `web/catan-presentation.js`: authored dice/resource/piece animation timing and
  quiet synthesized Web Audio effects; outcomes come only from Rust views/events.

`scripts/build_web.py` copies the SVGs only into CATAN's hashed release. The
catalog and Color Match do not request them. Loading failure/retry includes
terrain, cards, avatars and icons. Graphics recovery uploads a fresh atlas from
the retained decoded pixels and reconstructs GPU buffers and attachments.

Official sixth-edition sources were consulted for rules and board relationships;
references are in [the product contract](catan.md). The CATAN name identifies the
game. This repository is not an official CATAN product.
