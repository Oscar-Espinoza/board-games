/** Minimal TypeSafe System One client: raw fetch, bounded concurrency, retries on overload. */
export type Question =
  | { type: 'noul'; instructions: unknown; criteria?: unknown }
  | { type: 'score'; instructions: unknown; criteria: unknown[] }
  | {
      type: 'choice';
      instructions: unknown;
      criteria: Record<string, unknown>;
    };

export type Answer =
  | { type: 'noul'; noul: number }
  | {
      type: 'score';
      score: number;
      confidence: number;
      probabilities: Record<string, number>;
    }
  | {
      type: 'choice';
      choice: string;
      confidence: number;
      probabilities: Record<string, number>;
    };

export interface Call {
  answers: Record<string, Answer>;
  model: string;
  inputTokens: number;
  ms: number;
}

export const model = process.env.TYPESAFE_MODEL ?? 'jev-1.13.0';
/** Direct API price, USD per input token; output is free. */
export const usdPerToken = 0.042 / 1e6;

const limit = 8;
let active = 0;
const waiting: (() => void)[] = [];

/** `queue` bounds callers left waiting; `signal` drops a waiting caller that went away. */
async function slot<T>(
  queue: number,
  signal: AbortSignal | undefined,
  work: () => Promise<T>,
): Promise<T> {
  if (active >= limit) {
    if (waiting.length >= queue) throw new Error('Jev is busy');
    await new Promise<void>((resolve, reject) => {
      const go = () => {
        signal?.removeEventListener('abort', drop);
        resolve();
      };
      const drop = () => {
        waiting.splice(waiting.indexOf(go), 1);
        reject(signal!.reason);
      };
      waiting.push(go);
      signal?.addEventListener('abort', drop, { once: true });
    });
  }
  active++;
  try {
    return await work();
  } finally {
    active--;
    waiting.shift()?.();
  }
}

/** The lab CLI queues its whole batch; the server passes a small `queue` and the request's `signal`. */
export async function ask(
  state: unknown,
  questions: Record<string, Question>,
  { queue = Infinity, signal }: { queue?: number; signal?: AbortSignal } = {},
): Promise<Call> {
  const key = process.env.TYPESAFE_API_KEY;
  if (!key) throw new Error('Missing TYPESAFE_API_KEY (run from repo root)');
  signal?.throwIfAborted();
  return slot(queue, signal, async () => {
    // Serialized only once admitted, so waiting callers hold no request body.
    const body = JSON.stringify({ model, state, questions });
    for (let attempt = 1; ; attempt++) {
      const started = performance.now();
      const res = await fetch('https://api.typesafe.ai/v1/systemone', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body,
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(60_000)])
          : AbortSignal.timeout(60_000),
      });
      const ms = performance.now() - started;
      if (res.ok) {
        const json = (await res.json()) as {
          model: string;
          answers: Record<string, Answer>;
          usage?: { input_tokens: number };
        };
        for (const id of Object.keys(questions))
          if (!json.answers[id]) throw new Error(`Jev omitted answer ${id}`);
        return {
          answers: json.answers,
          model: json.model,
          inputTokens: json.usage?.input_tokens ?? 0,
          ms,
        };
      }
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= 3)
        throw new Error(`Jev HTTP ${res.status}: ${await res.text()}`);
      const after = Number(res.headers.get('retry-after')) * 1000;
      await Bun.sleep(after || 500 * 2 ** attempt);
      signal?.throwIfAborted();
    }
  });
}
