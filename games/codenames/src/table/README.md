# Codenames table material

`wood.webp` is the walnut tabletop (1536×1024 WebP, about 178 KiB): generated on
2026-09-13 with the built-in OpenAI image generation tool during implementation,
encoded with `cwebp` (quality 82). No runtime generation, external image service or
dependency. Warm upper-left light, no objects, text or graphics.

The board imports it through the Svelte/Vite asset pipeline and passes the URL to CSS as
`--cn-wood-image`. Cards, words, identity symbols, panels and controls stay CSS/SVG/Svelte
and remain usable if the artwork fails to load.

The prompt and the original generation source path are in [provenance.json](provenance.json).
The PNG original is outside the project under the generator's development cache; only the
optimized WebP is shipped.
