# Original Codenames table materials

Generated 2026-09-13 using the built-in OpenAI image generation tool during
implementation, then encoded using Ubuntu's installed `cwebp` (quality 82,
alpha quality 100). No runtime generation, external image service or dependency.
The realistic reference in `docs/codenames-redesign/images/reference.webp` governs
materials; the structural mockup is not baked into any asset. Warm upper-left
light and soft lower-right shadows are consistent. All props are blank/unlettered.

Wood is 1536×1024 WebP. Each independent transparent prop is 640px wide WebP;
alpha was preserved, not flattened. The six assets total approximately 505 KiB.
The board imports all six WebPs through the Svelte/Vite asset pipeline; the wood
URL is passed to CSS as `--cn-wood-image`. The app crops/repositions them through CSS and hides them at compact breakpoints.
Cards, words, identity symbols, panels and controls remain CSS/SVG/Svelte and
stay usable if artwork fails to load.

Exact prompts and original generation source paths are in [provenance.json](provenance.json).
The PNG originals are outside the project under the generator's development cache;
only optimized WebP assets are shipped. Earlier procedural/illustrated SVG studies
remain in the design documents solely as design history.
