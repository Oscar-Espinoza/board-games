/** bun run lab:codenames [--arm set|noul|choice|all] [--prompt v2] [--only id|category]
 *    [--order seed] [--repeat n] [--tau 0.5] [--scorer noul|score] [--bonus leftover|free] [--bonus-tau 0.8] [--note "what changed"] [--quiet] */
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { usdPerToken } from '../jev.ts';
import {
  play,
  type Arm,
  type Bonus,
  type Scorer,
  type Turn,
} from './guessers.ts';
import { prompts } from './prompts.ts';
import { scenarios, type Scenario } from './scenarios.ts';

const { values: args } = parseArgs({
  options: {
    arm: { type: 'string', default: 'set' },
    prompt: { type: 'string', default: 'v2' },
    only: { type: 'string' },
    order: { type: 'string', default: 'a' },
    repeat: { type: 'string', default: '1' },
    tau: { type: 'string', default: '0.5' },
    bonus: { type: 'string', default: 'leftover' },
    scorer: { type: 'string', default: 'noul' },
    'bonus-tau': { type: 'string', default: '0.8' },
    note: { type: 'string', default: '' },
    quiet: { type: 'boolean', default: false },
  },
});

const prompt = prompts[args.prompt];
if (!prompt) throw new Error(`Unknown prompt ${args.prompt}`);
const arms: Arm[] =
  args.arm === 'all' ? ['noul', 'choice', 'set'] : [args.arm as Arm];
const selected = scenarios.filter((s) =>
  args.only
    ? args.only.split(',').some((o) => s.id === o || s.category === o)
    : s.category !== 'fixed',
);
if (!selected.length) throw new Error(`No scenario matches ${args.only}`);
const repeat = Number(args.repeat);
const tau = Number(args.tau);
const bonus = args.bonus as Bonus;
const setup = `${args.prompt}/${args.scorer === 'score' ? 'score/' : ''}${bonus}${bonus === 'leftover' ? `≥${args['bonus-tau']}` : ''}`;

const lab = join(import.meta.dir, '../..');
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

interface Outcome {
  s: Scenario;
  arm: Arm;
  rep: number;
  turn: Turn;
}

/** Per-scenario verdict: what a good operative should have done with this clue. */
function score(o: Outcome) {
  const { s, turn } = o;
  const ids = turn.guesses.map((g) => g.identity);
  const hits = turn.guesses.filter((g) => s.intended.includes(g.word)).length;
  const first = turn.judgments.filter((j) => j.step === 0 && j.ref === 'clue');
  const assassin = Object.keys(s.key).find((w) => s.key[w] === 'assassin')!;
  return {
    firstOk: ids[0] === 'ours',
    friendly: ids.filter((i) => i === 'ours').length,
    guesses: ids.length,
    hits,
    assassin: ids.includes('assassin'),
    opponent: ids.includes('theirs'),
    assassinRank: first.find((j) => j.word === assassin)?.rank ?? 0,
  };
}

const pct = (n: number, d: number) =>
  d ? `${Math.round((100 * n) / d)}%` : '-';

function summarize(arm: Arm, outcomes: Outcome[]) {
  const good = outcomes.filter((o) => o.s.category !== 'weak');
  const weak = outcomes.filter((o) => o.s.category === 'weak');
  const g = good.map(score);
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const calls = outcomes.flatMap((o) => o.turn.calls);
  const ms = calls.map((c) => c.ms).sort((a, b) => a - b);
  const tokens = sum(calls.map((c) => c.inputTokens));
  return {
    arm,
    n: good.length,
    first: pct(g.filter((x) => x.firstOk).length, g.length),
    precision: pct(sum(g.map((x) => x.friendly)), sum(g.map((x) => x.guesses))),
    recall: pct(
      sum(g.map((x) => x.hits)),
      sum(good.map((o) => o.s.intended.length)),
    ),
    assassin: g.filter((x) => x.assassin).length,
    opponent: g.filter((x) => x.opponent).length,
    perTurn: (sum(g.map((x) => x.friendly)) / (g.length || 1)).toFixed(2),
    weak: weak
      .map((o) => {
        const x = score(o);
        return `${x.guesses}g${x.assassin ? '☠' : ''}`;
      })
      .join(' '),
    p50: Math.round(ms[Math.floor(ms.length / 2)] ?? 0),
    usd: (tokens * usdPerToken).toFixed(5),
    callsPerTurn: (calls.length / (outcomes.length || 1)).toFixed(2),
    tokensPerTurn: Math.round(tokens / (outcomes.length || 1)),
    usdPer1k: ((1000 * tokens * usdPerToken) / (outcomes.length || 1)).toFixed(
      4,
    ),
    model: calls[0]?.model ?? '?',
  };
}

const jobs = arms.flatMap((arm) =>
  Array.from({ length: repeat }, (_, rep) =>
    selected.map(async (s): Promise<Outcome> => {
      const turn = await play(s, arm, {
        prompt,
        bonus,
        scorer: args.scorer as Scorer,
        tau,
        bonusTau: Number(args['bonus-tau']),
        order: repeat > 1 ? `${args.order}${rep}` : args.order,
      });
      return { s, arm, rep, turn };
    }),
  ).flat(),
);
const outcomes = await Promise.all(jobs);

mkdirSync(join(lab, 'runs'), { recursive: true });
const file = join(
  lab,
  'runs',
  `${stamp}-${args.arm}-${args.prompt}-${args.scorer}-${bonus}.jsonl`,
);
const rows = outcomes.flatMap((o) => {
  const base = {
    arm: o.arm,
    prompt: args.prompt,
    bonus,
    rep: o.rep,
    scenario: o.s.id,
  };
  const guessed = new Set(o.turn.guesses.map((g) => g.word));
  return [
    {
      kind: 'turn',
      ...base,
      ...score(o),
      stopped: o.turn.stopped,
      guesses: o.turn.guesses,
    },
    ...o.turn.judgments.map((j) => ({
      kind: 'card',
      ...base,
      ...j,
      identity: o.s.key[j.word] ?? 'stop',
      intended: o.s.intended.includes(j.word),
      trap: o.s.traps.includes(j.word),
      guessed: guessed.has(j.word),
    })),
  ];
});
writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

const mark = { ours: '✓', theirs: '✗opp', civilian: '✗civ', assassin: '☠' };
if (!args.quiet)
  for (const o of outcomes) {
    const x = score(o);
    const guesses = o.turn.guesses
      .map((g) => `${g.word}${mark[g.identity]}`)
      .join(' ');
    const top = o.turn.judgments
      .filter((j) => j.step === 0 && j.ref === 'clue')
      .slice(0, 5)
      .map((j) => `${j.word}:${j.p.toFixed(2)}`)
      .join(' ');
    console.log(
      `${o.arm.padEnd(6)} r${o.rep} ${o.s.id.padEnd(18)} ${`${o.s.clue.word} ${o.s.clue.count}`.padEnd(15)}` +
        ` hit ${x.hits}/${o.s.intended.length} [${o.turn.stopped}] ${guesses}\n${' '.repeat(28)}top: ${top}` +
        (x.assassinRank ? `  assassin#${x.assassinRank}` : ''),
    );
  }

const log = join(lab, 'LOG.md');
if (!existsSync(log))
  writeFileSync(
    log,
    '# Jev Codenames lab log\n\nGood-clue metrics exclude `weak` scenarios; `weak` lists guesses per weak scenario (☠ = assassin).\n\n' +
      '| run | arm | prompt | order×rep | τ | n | first ✓ | precision | recall | ☠ | opp | ✓/turn | weak | p50 ms | $ | calls/turn | tokens/turn | $/1k turns | model | note |\n' +
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n',
  );
for (const arm of arms) {
  const r = summarize(
    arm,
    outcomes.filter((o) => o.arm === arm),
  );
  const line = `| ${stamp} | ${arm} | ${setup} | ${args.order}×${repeat} | ${arm === 'noul' ? tau : '-'} | ${r.n} | ${r.first} | ${r.precision} | ${r.recall} | ${r.assassin} | ${r.opponent} | ${r.perTurn} | ${r.weak} | ${r.p50} | ${r.usd} | ${r.callsPerTurn} | ${r.tokensPerTurn} | ${r.usdPer1k} | ${r.model} | ${args.note} |`;
  appendFileSync(log, line + '\n');
  console.log(
    `\n${arm}: first✓ ${r.first}  precision ${r.precision}  recall ${r.recall}  ☠ ${r.assassin}  opp ${r.opponent}  ✓/turn ${r.perTurn}  weak ${r.weak}  p50 ${r.p50}ms  $${r.usd} (${r.callsPerTurn} calls, ${r.tokensPerTurn} tokens, $${r.usdPer1k} per 1k turns)`,
  );
}
const spent = readFileSync(log, 'utf8')
  .split('\n')
  .filter((l) => /^\| \d{4}-/.test(l))
  .reduce((total, l) => total + Number(l.split('|')[15]), 0);
console.log(`\nLab spend so far: $${spent.toFixed(4)}\n${file}`);
