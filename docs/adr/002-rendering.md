# ADR 002: Event-driven DOM rendered from Rust player views

Status: Accepted, 2026-09-05.

Color Match needs a small board, text, buttons, and cards. The following
Rust-native approaches were evaluated against those needs; no GPU benchmark
was needed because the slice has no measured rendering bottleneck.

| Approach | Fit and tradeoff |
| --- | --- |
| Rust + web-sys DOM/CSS | Direct semantic buttons, native keyboard behavior, responsive layout; fits event-driven state changes. Browser-specific adapter. Selected. |
| Bevy | Rust game engine with ECS and rendering; useful for richer scenes and game systems. Its engine lifecycle and rendering setup add infrastructure this static card board does not need. |
| egui/eframe | Rust immediate-mode UI for native and web; useful for shared application UIs. A canvas-based UI adds work to reproduce the desired document semantics and CSS layout here. |
| wgpu | Rust graphics API supporting native backends and browser WebGPU/WebGL2. Appropriate future option for games needing richer rendering; requires GPU initialization and a rendering/input layer for this board. |

This is a workload decision, not a monorepo-wide ban on graphics engines.
Rendering accepts a player view, so future renderers can replace the DOM
adapter without moving rules or exposing canonical state. There is no Three.js,
JavaScript game engine, continuous render loop, or GPU dependency. wasm-pack's
optional wasm-opt stage is disabled; Rust release optimization and LTO are
sufficient for this slice and avoid an extra Binaryen installation requirement.

Sources: [Bevy setup](https://bevy.org/learn/quick-start/getting-started/setup/),
[egui and eframe](https://github.com/emilk/egui),
[wgpu capabilities](https://github.com/gfx-rs/wgpu).

## Version-2 table update, 2026-09-05

Retain Rust-driven DOM presentation, now filling the viewport with dark felt.
Keep stable seat and pile nodes and update hand buttons by card ID. Browser
Web Animations overlays animate accepted public plays and draw counts in 300ms;
state updates never wait for animations. Preserve semantic stock/card buttons,
keyboard focus, horizontal hand scrolling, touch targets, safe areas and reduced
motion. Fullscreen API use is optional. Room and rules tools live in dialogs.
This supersedes the original full-board replacement described above.

## CATAN renderer, 2026-09-07

CATAN selects direct wgpu 26 with Rust-driven semantic DOM controls. The shallow
physical board needs shared lighting, raised pieces and animated dice; these are
substantial enough to justify a GPU renderer. Bevy's broader lifecycle is unnecessary
for this mostly stationary scene. Color Match retains its DOM renderer.

The orthographic camera is fixed overhead. Integer rule topology is independent
of render coordinates. Procedural original materials and meshes share a small
WGSL shader; WebGL2 downlevel limits and no compute dependencies permit fallback
from WebGPU. A fresh canvas avoids incompatible context reuse. Software WebGPU
and WebGL2 paths are exercised in browser tests. Rendering requests stop at idle;
network state applies immediately and never waits for animation acknowledgment.
Recovery reconstructs graphics from the latest recipient view. Real-device
performance and human visual acceptance remain separate validation work.


## CATAN illustrated table v2, 2026-09-07

The active CATAN table occupies `100dvh`. `catan-web/src/layout.rs` owns the
island rectangle, fixed overhead world bounds, zoom/pan limits, dice tray and
clockwise local-relative seats. Browser resize/gesture glue supplies inputs;
Rust applies the same stage transform to GPU pixels, SVG labels, placement
buttons and animation anchors. A narrow construction sheet reserves space above
it for the selected location. Rules and protocol v4 remain unchanged.

Original editable SVG terrain paintings are rasterized once by the browser into
a 1024×768 sRGB atlas. wgpu samples UV materials with five mip levels, generated
by averaging linear light and encoding back to sRGB. Texture sampling decodes to
linear light; non-sRGB output surfaces receive explicit encoding. Lighting is
restrained on the flat terrain and stronger on raised wooden pieces. Both color
resolve and depth format capabilities must support 4× MSAA; otherwise use one
sample. Separate retained GPU buffers contain terrain and pieces. Only topology
changes rebuild terrain; roads, buildings, robber or ownership changes rebuild
pieces. Ordinary rolls and hand updates do not upload the board again.

The large dice tray uses Rust-rendered semantic DOM dice with explicit pip
positions, animated independently of the island camera. This makes both dice
and the labeled roll button actionable while keeping the tray stationary during
zoom/pan. Authoritative state never waits for dice or resource effects. Idle
scenes suspend frame requests. Graphics recovery rebuilds textures, attachments
and buffers from the current private view without replacing the connection.

Artwork is packaged exclusively inside CATAN's content-hashed release; loading
progress includes texture/card/portrait/icon decoding, and any failure keeps the
app inert until retry. The source paintings and reproducible authoring script
are in `artwork/catan/`; see [provenance](../games/catan-assets.md).

Browser fullscreen is attempted once per page from a Create/Join/Start gesture;
refusal or exiting does not trigger another automatic request. The explicit
fullscreen button remains available. Modal dialogs use native focus containment
and return focus to their invoking control (or its replacement after a snapshot).
Required discards and robber/setup decisions are immediately visible sheets.

References: [wgpu browser backends](https://wgpu.rs/doc/wgpu/documentation/platforms/web/index.html),
[Fullscreen API](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen),
[accessible dialogs](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
