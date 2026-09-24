# 8-bit kit

Research date: 2026-09-23. How this repo builds 8-bit (pixel) looks, and why.

## Decision

**Board games and app UIs stay on the DOM: Svelte + CSS + pixel sprites. No game engine.**
Tables show tens of elements, far below where canvas/WebGL speed matters (engines win at
~10,000 moving sprites: [benchmark](https://github.com/Shirajuki/js-game-rendering-benchmark)).
A canvas engine would add a second UI system and lose what the DOM gives for free:
accessibility and focus, Paraglide text (en/es), responsive CSS grid layouts and Svelte state.
The 8-bit home store and the Codenames 8-bit skin prove the approach.

**Real-time 8-bit projects** (moving characters, particles, tilemaps):

- **PixiJS v8** (MIT, ~200 KB): renderer only; embed one canvas region in a Svelte page
  with [svelte-pixi v8](https://svelte-pixi.mattjennin.gs/releases/v8-0-0/) (Svelte 5).
- **Phaser 4** (MIT, ~500 KB, stable since April 2026): full framework (physics, scenes,
  loader) for standalone action games.
- KAPLAY / LittleJS: fine for jams, weaker fit for embedding in this app.

Three.js stays the pick for realistic 3D.

## Toolkit (all free)

| Need   | Choice                                                                                                                                                                                                                                                               |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Font   | Jersey 10 (OFL, 12 KB Latin-1 woff2) in `static/fonts/pixel/`: clear C/O, mixed case, Spanish accents; `font-synthesis: none`. Pixelify Sans stays for the home store, but its capital C is nearly closed                                                            |
| Sound  | [ZzFX](https://github.com/KilledByAPixel/ZzFX) (MIT, <1 KB), vendored sample builder in `packages/shared/src/ui/pixel/zzfx-core.js`, played through `createAudio().samples()`; `buildSamples` is exported for per-game cue packs (`games/<game>/src/pixel/sound.ts`) |
| Art    | Codex CLI image tool + `docs/carcassonne-3d/key-sprites.py` / `docs/pixel-store/pack-strip.py`; touch-ups in Pixelorama, LibreSprite or Piskel                                                                                                                       |
| Skin   | `gameSkin(game)` / `setGameSkin` in `@board-games/shared/ui/pixel`: per-game override, else the home theme                                                                                                                                                           |
| Styles | `@board-games/shared/ui/pixel.css`: `.px-tokens` palette (`--px-*`), `.px-panel`, `.px-button`, `.px-sprite`                                                                                                                                                         |

## CSS rules

- `image-rendering: pixelated` on sprites; scale sprites by whole multiples where you can.
- Hard edges: borders and `box-shadow` offsets in multiples of `--px`, no blur, no radius.
- No `backdrop-filter`, `filter`, rotation or gradients on chrome.
- Motion uses `steps()`; respect reduce-motion like the classic skin does.
- Text stays real text (Svelte/CSS), never baked into sprites.
- Chrome ignores `image-rendering` on an SVG `<pattern>` `<image>`; clip a nested `<svg><image>` instead.
- Tiny sprites (≲ 20 px: tiles, meeples, pieces) come out cleaner hand-set in code than downsampled
  from generated art; generated art suits backgrounds, portraits and illustrations.

## Adding an 8-bit skin to a game

1. Keep one Board component. Add `class:cn-pixel`-style classes and `px-tokens` on the
   root and dialogs when `gameSkin('<game>') === 'pixel'`.
2. Put overrides in `games/<game>/src/pixel.css` (it `@import`s the shared kit) and load it
   with `import('./pixel.css')` only when the skin is chosen.
3. Generate sprites on magenta, key them to WebP (≤ ~40 KB each) under
   `apps/web/static/games/<game>/pixel/`, and record prompts in a doc.
4. Offer Classic / 8-bit in the game's ⚙ settings via `setGameSkin`. Skins are
   viewer-only and never reach the server. Use the shared `m.skin()`, `m.skin_classic()`,
   `m.skin_pixel()` labels.

Every game has a skin: UNO, Catan, Carcassonne, Azul, Codenames, Sushi Go Party and Little
Secret (`docs/<game>-pixel.md`), plus Dominó's Canvas table (`docs/games/domino.md`).
