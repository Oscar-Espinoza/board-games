# Board games

UNO, Catan, Carcassonne, Azul, Codenames and Sushi Go Party for a small group of friends. A TypeScript Bun server owns each game; SvelteKit provides the catalog and game tables. Rooms and games live in memory. There are no accounts, database, Redis or WebRTC services.

## Run locally

Use [Bun 1.4.2](https://bun.com/docs/installation) or newer (CI pins 1.4.2). From the repository root:

```sh
bun install
bun run dev
```

Open http://127.0.0.1:5173, select a box, choose **Start game**, enter a display name and create a room. Share its room URL. UNO supports 2–8 players; Catan supports 3–6; Carcassonne supports 2–6; Azul supports 2–4; Codenames supports 4–8; Sushi Go Party supports 2–8. The host starts when everyone has joined. The Start dialog also offers **Try on your own**. For UNO this starts a private table against three computer players immediately. Each player needs their own browser profile or device to keep separate reconnect credentials.

Development runs Vite on port 5173 and Bun on port 3000. Open the Vite URL; it proxies Socket.IO and `/health` to Bun. Ctrl+C stops both process groups, including the backend watcher. The launcher allows a short graceful shutdown, then forces any remaining development children to exit. `WEB_PORT` and `PORT` override the frontend and backend ports. For a game night, build and serve everything on one port:

```sh
bun run build
bun run start
```

Open http://127.0.0.1:3000 and point your tunnel at that port. Share the tunnel's HTTPS room URL. See [hosting](docs/deployment.md) for the few configuration options.

A room-specific private reconnect token is saved in browser localStorage. Reopening the same room from the same browser and origin restores its seat while reserved. The default grace period is two minutes. After expiration, another player can take the vacant seat and its game position with a new secret. Display names do not prove identity. Restarting Bun destroys active rooms.

Carcassonne includes Big Box 3.1 expansion setup and a local **Try it on your own**
table at `/practice/carcassonne`, with an 18-draw learning game, full matches and
focused expansion situations. You control every practice seat. Catan's local
practice table remains at `/practice/catan`. See [Carcassonne rules and validation
limits](docs/games/carcassonne.md).

Azul, Codenames and Sushi Go Party put the playing surface across the screen.
Open the illustrated book in the upper-left for rules and the upper-right gear
for sound, volume, motion, language, invitation and room controls. Sound starts
only after a gesture. Codenames has private spymaster keys; Sushi picks stay
private until everyone commits. Do not share a browser profile between seats.
Their local practice routes are `/practice/azul`, `/practice/codenames` and
`/practice/sushi-go-party`; these use deterministic scenarios and the real rules,
with switchable local seats. See [Azul](docs/games/azul.md),
[Codenames](docs/games/codenames.md) and
[Sushi Go Party](docs/games/sushi-go-party.md) for rules and app conventions.

## Library and rulebooks

Hover, focus or tap a game name to bring its illustrated box forward. **Summary**
explains the game in a few minutes; **Rules** opens a searchable English/Spanish
rulebook with manually stepped Before → Action → Result examples. The guides
teach this app’s UNO house rules, Catan base/5–6-player behavior, and Carcassonne
Big Box 3.1, plus standard Azul, classic Codenames and the standard Sushi Go Party box. They do not load a playable game or create a room.
See [lesson coverage](docs/games/library-guide-coverage.md) for the content sources.

## Development

```sh
bun run check        # TypeScript and Svelte checks
bun run test         # Game rules and room/session tests
bun run test:e2e     # Browser integration tests
bun run format      # Format maintained source
```

See [architecture](docs/architecture.md), [validation](docs/validation.md), and [migration decision](docs/adr/009-typescript-catalog.md). All catalog and game translations live in `packages/shared/messages/`; add a locale there and in `packages/shared/project.inlang/settings.json` to extend Paraglide.

Zombies (the previous Survival game) is now the independent sibling `../zombies-game`. Its Rust/Wasm simulation, renderer, assets, saves and tooling are preserved there; run `pnpm install` and `make dev` from that directory. It is not part of this workspace.
