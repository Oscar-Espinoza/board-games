# Local hosting through a tunnel

Use Bun 1.4.2 or newer. Run from the repository root:

```sh
bun install --frozen-lockfile
bun run build
bun run start
```

The Bun process serves the built SvelteKit SPA and Socket.IO at http://127.0.0.1:3000. Point an HTTPS tunnel at this one port and share a room URL on the tunnel origin. The tunnel must support ordinary HTTP and Socket.IO's WebSocket upgrade or polling requests. No TURN server, Redis, database, accounts or extra public frontend port is needed.

| Variable             | Default     | Use                                                                                          |
| -------------------- | ----------- | -------------------------------------------------------------------------------------------- |
| `HOST`               | `127.0.0.1` | Listener address; set `0.0.0.0` only when direct LAN access or the chosen tunnel requires it |
| `PORT`               | `3000`      | Bun HTTP and Socket.IO port                                                                  |
| `RECONNECT_GRACE_MS` | `120000`    | How long disconnected seats retain their reconnect secret                                    |

`bun run dev` starts Bun and Vite; open port 5173 during development. Its Vite proxy targets the Bun `PORT` (3000 by default). Set `WEB_PORT` to change the initial Vite port; Vite chooses the next available port if it is occupied. Ctrl+C terminates the frontend runner and backend watcher, with a 1.2-second forced-stop fallback for lingering development process groups. This supervisor is used only for development.

The PC must remain running during play. All room state is in memory and disappears when Bun restarts. A disconnected player's seat is reserved for the configured grace period, then may be replaced. There is no automatic game persistence or cross-server synchronization.

Reconnect credentials live in browser localStorage for the room's origin. Changing the tunnel hostname or switching browser profiles does not carry those credentials across. The shareable URL contains the room ID, not a reconnect token. A display name alone cannot restore another player's seat.

Turn-based snapshots favor correctness over latency tuning. A server in Argentina and friends in Europe need only a working connection; no regional deployment infrastructure is required. Zombies is independently hosted from `../zombies-game` using its own Rust server and commands.
