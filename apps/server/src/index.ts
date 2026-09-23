import { createServer } from 'node:http';
import { resolve } from 'node:path';
import sirv from 'sirv';
import { littleSecret } from '@board-games/little-secret/server';
import { azul } from '@board-games/azul/server';
import { codenames } from '@board-games/codenames/server';
import { sushiGoParty } from '@board-games/sushi-go-party/server';
import { uno } from '@board-games/uno/server';
import { carcassonne } from '@board-games/carcassonne/server';
import { catan } from '@board-games/catan/server';
import { domino } from '@board-games/domino/server';
import type { GameDefinition } from '@board-games/game-core';
import { Rooms } from './rooms.js';
import { attachSockets } from './socket.js';
const grace = Number(process.env.RECONNECT_GRACE_MS ?? 120_000);
if (!Number.isFinite(grace) || grace < 0)
  throw new Error('Invalid RECONNECT_GRACE_MS');
const rooms = new Rooms(
  new Map<string, GameDefinition>([
    [uno.id, uno],
    [littleSecret.id, littleSecret],
    [azul.id, azul],
    [codenames.id, codenames],
    [sushiGoParty.id, sushiGoParty],
    [catan.id, catan],
    [carcassonne.id, carcassonne],
    [domino.id, domino],
  ]),
  grace,
);
const assets = sirv(resolve('apps/web/build'), {
  single: '200.html',
  gzip: true,
  brotli: true,
  etag: true,
  setHeaders(res, path) {
    // Hashed build output never changes under the same name.
    if (path.startsWith('/_app/immutable/'))
      res.setHeader('cache-control', 'public, max-age=31536000, immutable');
  },
});
const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.setHeader('content-type', 'application/json');
    res.end('{"ok":true}');
    return;
  }
  assets(req, res, () => {
    res.statusCode = 404;
    res.end('Build the frontend with bun run build, or use bun run dev.');
  });
});
const io = attachSockets(server, rooms);
const port = Number(process.env.PORT ?? 3000);
server.listen(port, process.env.HOST ?? '127.0.0.1', () =>
  console.log(`Board games: http://${process.env.HOST ?? '127.0.0.1'}:${port}`),
);
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => io.close(() => server.close()));
