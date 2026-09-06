# ADR 001: Shared Rust rules, separate browser and WASI adapters

Status: Accepted, 2026-09-05.

We need playable browser rules and a concrete Component Model use without
assuming browsers implement WASI.

Use native Rust for fast tests and a command-line replay runner. Compile the
browser adapter for `wasm32-unknown-unknown` with wasm-bindgen/web-sys. wasm-pack
`--target web` produces an ES module and core Wasm; a minimal module loader
initializes it from a static server. No application bundler is required.

Compile the replay command for `wasm32-wasip2`. Rust produces a WASI Preview 2
command component using the Component Model. Run it with Wasmtime, passing JSON
on stdin and reading stdout. Actual component execution is checked against
native output; a successful cross-compilation alone is insufficient.

The component requires a compatible WASI/component runtime. Browser core Wasm
support does not supply WASI or native component loading. The browser and WASI
artifacts cannot be substituted for one another. There is no custom game WIT
interface in this milestone. Jco or another browser component bridge is deferred
until an actual component consumer needs one.

Sources: [Rust target requirements](https://doc.rust-lang.org/rustc/platform-support/wasm32-wasip2.html),
[wasm-bindgen without a bundler](https://wasm-bindgen.github.io/wasm-bindgen/examples/without-a-bundler.html).
