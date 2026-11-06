/** Local fixtures and a small independent pack. Never imported by room creation. */
import { seeded } from '@board-games/game-core';
import type { PracticeTable } from '@board-games/shared/ui';
import { nextActor, rules, type Packs } from './engine.js';
import { powersFrom } from './limits.js';
import type { Power, Role, View } from './types.js';
export const scenarios = [
  'basic',
  'journalist',
  'powers',
  'sage',
  'rps',
  'revenant',
  'nine',
  'scores',
] as const;
export type Scenario = (typeof scenarios)[number];
const seatCount: Record<Scenario, number> = {
  basic: 3,
  journalist: 5,
  powers: 6,
  sage: 6,
  rps: 3,
  revenant: 6,
  nine: 9,
  scores: 3,
};
const examples: Record<'en' | 'es', string[]> = {
  en: [
    'violin|guitar',
    'piano|organ',
    'drum|tambourine',
    'flute|clarinet',
    'tennis|badminton',
    'football|rugby',
    'chess|draughts',
    'paint|ink',
    'dance|ballet',
    'poem|song',
    'pebble|boulder',
    'oak|willow',
    'rose|tulip',
    'daisy|sunflower',
    'root|branch',
    'leaf|petal',
    'seed|bulb',
    'gold|silver',
    'copper|bronze',
    'ruby|emerald',
  ],
  es: [
    'violín|guitarra',
    'piano|órgano',
    'tambor|pandereta',
    'flauta|clarinete',
    'tenis|bádminton',
    'fútbol|rugbi',
    'ajedrez|damas',
    'pintura|tinta',
    'danza|ballet',
    'poema|canción',
    'guijarro|roca',
    'roble|sauce',
    'rosa|tulipán',
    'margarita|girasol',
    'raíz|rama',
    'hoja|pétalo',
    'semilla|bulbo',
    'oro|plata',
    'cobre|bronce',
    'rubí|esmeralda',
  ],
};
const pack = (lang: 'en' | 'es'): Packs['en'] =>
  examples[lang].map((line, i) => ({
    id: `training-${i}`,
    words: line.split('|') as [string, string],
    aliases: [[], []],
  }));
const practiceRules = rules({ en: pack('en'), es: pack('es') });
const names = ['Ada', 'Bea', 'Leo', 'Sol', 'Max', 'Luz', 'Eva', 'Noa', 'Paz'];

export function practice(
  scenario: Scenario = 'basic',
  language: 'en' | 'es' = 'en',
): PracticeTable<View> {
  const count = seatCount[scenario];
  const players = names.slice(0, count).map((name, i) => ({
    id: `training-${i}`,
    name,
    connected: true as const,
    reservedUntil: null,
  }));
  const random = seeded(26912),
    ids = players.map((p) => p.id),
    hostId = ids[0]!;
  let state = practiceRules.create(ids, random, {
    wordLanguage: language,
    powers: count >= powersFrom,
  });
  const send = (actor: string, action: unknown) => {
    state = practiceRules.apply(state, actor, action, random, { hostId });
  };
  for (const id of ids) send(id, { type: 'ready', version: 0 });
  const roles = () => {
    state.roles = Object.fromEntries(
      ids.map((p, i): [string, Role] => [
        p,
        i === 4 ? 'journalist' : i === 3 ? 'infiltrator' : 'disciple',
      ]),
    );
  };
  /** A volunteer opens the round, everyone gives a clue and the host opens the vote. */
  const discuss = () => {
    send(hostId, { type: 'volunteer', mission: state.mission });
    while (state.phase === 'clues')
      send(state.speaker!, {
        type: 'clue',
        text: 'echo',
        mission: state.mission,
        cycle: state.cycle,
      });
    send(hostId, {
      type: 'openVote',
      mission: state.mission,
      cycle: state.cycle,
    });
  };
  const vote = (victim: string) => {
    discuss();
    for (const id of ids)
      send(id, {
        type: 'vote',
        ballotId: state.ballotId,
        target: id === victim ? ids.find((p) => p !== id) : victim,
      });
  };
  if (count === 6)
    state.powers = Object.fromEntries(
      ids.map((p, i) => [
        p,
        (
          ['mime', 'novice', 'elder', 'sage', 'revenant', 'dictator'] as Power[]
        )[i]!,
      ]),
    );
  if (scenario === 'journalist') {
    roles();
    vote(ids[4]!);
  }
  if (scenario === 'revenant') {
    state.powers[ids[0]!] = 'revenant';
    state.powers[ids[4]!] = 'adept';
    roles();
    vote(ids[0]!);
  }
  if (scenario === 'sage' || scenario === 'rps') {
    discuss();
    const targets = scenario === 'sage' ? [1, 0, 1, 1, 2, 0] : [1, 2, 0];
    for (let i = 0; i < ids.length; i++)
      send(ids[i]!, {
        type: 'vote',
        ballotId: state.ballotId,
        target: ids[targets[i]!],
      });
  }
  if (scenario === 'scores') {
    state.roles = {
      [ids[0]!]: 'disciple',
      [ids[1]!]: 'disciple',
      [ids[2]!]: 'infiltrator',
    };
    state.scores = Object.fromEntries(ids.map((p) => [p, 4]));
    vote(ids[2]!);
  }
  return {
    players,
    host: hostId,
    get actor() {
      return nextActor(state) ?? hostId;
    },
    get finished() {
      return state.phase === 'finished';
    },
    view: (seat) => practiceRules.view(state, seat),
    send: (seat, action) => send(seat, action),
  };
}
