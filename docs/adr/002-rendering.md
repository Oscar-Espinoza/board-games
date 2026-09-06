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
