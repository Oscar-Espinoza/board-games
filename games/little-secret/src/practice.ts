import { seeded } from '@board-games/game-core';
/** Local fixtures and a small independent pack. Never imported by room creation. */
import { rules } from './engine.js';
import type { Packs, State, Power } from './types.js';
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
const packs: Packs = { en: pack('en'), es: pack('es') };
export const practiceRules = rules(packs);
export function practice(
  scenario: Scenario = 'basic',
  language: 'en' | 'es' = 'en',
) {
  const count =
    scenario === 'nine'
      ? 9
      : ['powers', 'sage', 'revenant'].includes(scenario)
        ? 6
        : scenario === 'journalist'
          ? 5
          : 3;
  const seats = ['Ada', 'Bea', 'Leo', 'Sol', 'Max', 'Luz', 'Eva', 'Noa', 'Paz']
    .slice(0, count)
    .map((name, i) => ({ id: `training-${i}`, name, connected: true }));
  const random = seeded(26912),
    ids = seats.map((p) => p.id),
    hostId = ids[0]!;
  let state = practiceRules.create(ids, random, {
    wordLanguage: language,
    powers: count >= 6,
  });
  const send = (actor: string, action: unknown) => {
    state = practiceRules.apply(state, actor, action, random, { hostId });
  };
  for (const id of ids) send(id, { type: 'ready', version: 0 });
  const vote = (victim: string) => {
    send(ids[0]!, { type: 'volunteer', mission: state.mission });
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
    state.roles = Object.fromEntries(
      ids.map((p, i) => [
        p,
        i === 4 ? 'journalist' : i === 3 ? 'infiltrator' : 'disciple',
      ]),
    );
    vote(ids[4]!);
  }
  if (scenario === 'revenant') {
    state.powers[ids[0]!] = 'revenant';
    state.powers[ids[4]!] = 'adept';
    state.roles = Object.fromEntries(
      ids.map((p, i) => [
        p,
        i === 4 ? 'journalist' : i === 3 ? 'infiltrator' : 'disciple',
      ]),
    );
    vote(ids[0]!);
  }
  if (scenario === 'sage' || scenario === 'rps') {
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
    seats,
    get state(): State {
      return state;
    },
    get actor() {
      return (
        state.prompt?.actor ??
        state.speaker ??
        (state.phase === 'setup'
          ? ids.find((p) => !state.ready.includes(p))
          : state.phase === 'vote'
            ? ids.find(
                (p) => !state.eliminated.includes(p) && !state.ballots[p],
              )
            : state.phase === 'tie'
              ? state.candidates.find((p) => !state.rps[p])
              : state.phase === 'missionResult'
                ? ids.find((p) => !state.continued.includes(p))
                : hostId) ??
        hostId
      );
    },
    view: (p: string) => practiceRules.view(state, p),
    send,
  };
}
