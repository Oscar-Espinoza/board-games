# Board games

Bun + TypeScript workspace: a SvelteKit static SPA (`apps/web`) and a Bun/Socket.IO server (`apps/server`) with authoritative in-memory rooms for UNO, Catan, Carcassonne, Azul, Codenames, Sushi Go Party, Little Secret and Dominó (`games/*`). English/Spanish via Paraglide (`packages/shared/messages`). No database, accounts, Wasm or WebRTC.

Side project — move fast: no tests. Validate with `bun run check` and `bun run build`. Commands: `bun install`, `bun run dev`, `bun run build`, `bun run start`, `bun run format`.

## Rules

- Server owns state: socket bindings set actor identity; client intentions never mutate canonical state; never send other players' secrets and merely hide them.
- Game rules stay free of DOM, networking and storage; randomness is explicit.
- Practice fixtures stay out of room initialization and eager catalog metadata.
- Reuse the shared helpers in [workflow](docs/workflow.md) before writing new plumbing.
- Keep it fast: lazy per-game imports, compressed/cached assets, cheap CSS.
- Before changing a game, read its **Invariants** section.

## Index

| Topic                                               | Doc                                                                                                       |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Workflow, shared helpers, Svelte conventions        | [docs/workflow.md](docs/workflow.md)                                                                      |
| Architecture, sessions, reconnection, adding a game | [docs/architecture.md](docs/architecture.md)                                                              |
| Hosting                                             | [docs/deployment.md](docs/deployment.md)                                                                  |
| UNO                                                 | [docs/rules.md](docs/rules.md)                                                                            |
| Catan                                               | [docs/games/catan.md](docs/games/catan.md), [assets](docs/games/catan-assets.md)                          |
| Carcassonne                                         | [docs/games/carcassonne.md](docs/games/carcassonne.md), [sprites](docs/carcassonne-3d/README.md)          |
| Azul                                                | [docs/games/azul.md](docs/games/azul.md), [redesign](docs/azul-redesign/README.md)                        |
| Codenames                                           | [docs/games/codenames.md](docs/games/codenames.md), [redesign](docs/codenames-redesign/README.md)         |
| Sushi Go Party                                      | [docs/games/sushi-go-party.md](docs/games/sushi-go-party.md), [redesign](docs/sushi-go-party-redesign.md) |
| Little Secret                                       | [docs/games/little-secret.md](docs/games/little-secret.md)                                                |
| Dominó                                              | [docs/games/domino.md](docs/games/domino.md)                                                              |
| Jev Codenames guesser lab (`bun run lab:codenames`) | [docs/jev/working-with-jev.md](docs/jev/working-with-jev.md)                                              |
| Catalog lessons                                     | [docs/games/library-guide-coverage.md](docs/games/library-guide-coverage.md)                              |
| Home page themes (8-bit store)                      | [docs/pixel-store.md](docs/pixel-store.md)                                                                |
| 8-bit kit (tech choice, pixel skins)                | [docs/pixel-kit.md](docs/pixel-kit.md), [Codenames skin](docs/codenames-pixel.md)                         |
| Decisions (ADRs)                                    | [docs/adr/](docs/adr/)                                                                                    |
| Zombies (separate repo)                             | `../zombies-game` — don't add its deps here                                                               |
