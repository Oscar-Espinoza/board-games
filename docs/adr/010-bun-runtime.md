# ADR 010: Bun runtime and workspace tooling

Date: September 10, 2026. Status: accepted by the explicit Bun migration request.

## Decision

Use Bun 1.4.2 for package management, workspace scripts, the authoritative backend,
its build and tests. CI pins that version; `package.json` records it and `bun.lock`
fixes the dependency graph. Bun imported the previous pnpm lockfile, retaining
resolved dependencies. The workspace list now lives in root `package.json`.

Keep SvelteKit/Vite and Paraglide for the frontend. Invoke their command-line tools
with `bun --bun` so Node shebangs do not silently select a Node runtime. The dev
launcher runs Bun's `--watch` backend and Vite together; production runs the Bun
bundle and serves the static SPA and Socket.IO from one port. Native Bun build and
test commands replace the direct esbuild and tsx dependencies.

Retain Socket.IO's existing `node:http` integration and `sirv` under Bun's compatible
APIs. The `node:` imports and `@types/node` describe supported APIs, not a separate
Node process. Replacing these with `Bun.serve()` and native WebSockets would require
unnecessary protocol changes. Existing game rules, recipient projections and
session ownership remain authoritative and unchanged. Zombies keeps its separate
Rust/Wasm project and tooling.

## Research and upgrade policy

The [official release index](https://bun.com/blog) identifies
[Bun 1.4.2, September 5, 2026](https://bun.com/blog/bun-v1.4.2) as the latest stable
release checked for this migration. It fixes a bundler variable-name collision,
async-context memory retention and JavaScriptCore correctness/crash issues. This
is preferable to adopting the preceding 1.4.1 release. New HTTP/2/3, image, database
and native WebSocket features do not address a present requirement here.

The implementation follows Bun's documented [workspaces](https://bun.com/docs/pm/workspaces),
[lockfile migration and frozen installs](https://bun.com/docs/pm/cli/install),
[runtime and `--bun` flag](https://bun.com/docs/runtime), and
[Bun-target bundling](https://bun.com/docs/bundler). Its
[Node API compatibility reference](https://bun.com/docs/runtime/nodejs-compat)
explicitly describes partial `node:test` support; the existing suite uses its
supported in-process API and passes under `bun test`. Keep real Socket.IO tests
and browser tests as regression checks rather than assuming blanket compatibility.

Use `bun install --frozen-lockfile` in CI and hosting setup. Review release notes
before changing the pinned runtime, then run checks, tests, production build and
Chrome/WebKit coverage. `bun run check` remains necessary because execution and
bundling transpile TypeScript without checking its types. Use `bun run test` for
the scoped rule/session suite; browser scenarios belong to `bun run test:e2e`.
