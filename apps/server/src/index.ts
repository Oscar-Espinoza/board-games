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
import { parseView, plan } from '@board-games/jev-lab/codenames';
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
// Opt-in (JEV_LAB=1): anyone who reaches this origin spends the operator's TypeSafe key.
const lab = process.env.JEV_LAB === '1';
const recent: number[] = [];
let planned = 0;
/** Global Jev budget: 20 plans per rolling minute and 500 per process run. */
function budget() {
  const now = Date.now();
  while (recent.length && recent[0]! <= now - 60_000) recent.shift();
  if (recent.length >= 20 || planned >= 500) return false;
  recent.push(now);
  planned++;
  return true;
}
const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.setHeader('content-type', 'application/json');
    res.end('{"ok":true}');
    return;
  }
  // Local training only: Jev guesses from public clue/board data; the API key stays here.
  if (req.url === '/api/codenames/guess' && req.method === 'POST') {
    res.setHeader('content-type', 'application/json');
    const fail = (status: number, error: string) => {
      res.statusCode = status;
      res.end(JSON.stringify({ error }));
    };
    if (!lab) return fail(404, 'Jev lab is off');
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 64_000) req.destroy();
    });
    req.on('end', async () => {
      let input;
      try {
        input = JSON.parse(body);
      } catch {}
      const view = parseView(input?.view);
      if (!view) return fail(400, 'Bad request');
      if (!budget()) return fail(429, 'Jev lab budget spent');
      const { unlimited, score, personality } = input;
      const valid =
        Number.isInteger(score?.ours) && Number.isInteger(score?.theirs);
      // A client that leaves drops its queued Jev call.
      const gone = new AbortController();
      res.on('close', () => gone.abort());
      try {
        res.end(
          JSON.stringify(
            await plan(
              view,
              unlimited === true,
              valid ? score : undefined,
              ['conservative', 'normal', 'risky'].includes(personality)
                ? personality
                : 'normal',
              gone.signal,
            ),
          ),
        );
      } catch (error) {
        console.error('[jev] guess failed:', error);
        fail(502, String(error));
      }
    });
    return;
  }
  // sirv 3.0.2 streams any parsed range, and a reversed one throws; serve the whole file instead.
  const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range ?? '');
  if (req.headers.range && (!range || (range[2] && +range[1]! > +range[2])))
    delete req.headers.range;
  try {
    assets(req, res, () => {
      res.statusCode = 404;
      res.end('Build the frontend with bun run build, or use bun run dev.');
    });
  } catch (error) {
    console.error('[static]', error);
    if (res.headersSent) res.destroy();
    else {
      res.statusCode = 500;
      res.end();
    }
  }
});
const io = attachSockets(server, rooms);
const port = Number(process.env.PORT ?? 3000);
server.listen(port, process.env.HOST ?? '127.0.0.1', () =>
  console.log(`Board games: http://${process.env.HOST ?? '127.0.0.1'}:${port}`),
);
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => io.close(() => server.close()));
