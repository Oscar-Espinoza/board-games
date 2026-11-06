/** The `/api/codenames/guess` route. Loaded only when the server runs with JEV_LAB=1. */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { parseView, personalityNames, plan, type Personality } from './live.ts';

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

/** Jev guesses from public clue/board data; the API key stays on the server. */
export function handleGuess(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('content-type', 'application/json');
  const fail = (status: number, error: string) => {
    res.statusCode = status;
    res.end(JSON.stringify({ error }));
  };
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
    const { score, personality } = input;
    const valid =
      Number.isInteger(score?.ours) && Number.isInteger(score?.theirs);
    // A client that leaves drops its queued Jev call.
    const gone = new AbortController();
    res.on('close', () => gone.abort());
    try {
      res.end(
        JSON.stringify(
          await plan(view, {
            score: valid ? score : undefined,
            personality: personalityNames.includes(personality)
              ? (personality as Personality)
              : 'normal',
            signal: gone.signal,
          }),
        ),
      );
    } catch (error) {
      console.error('[jev] guess failed:', error);
      fail(502, String(error));
    }
  });
}
