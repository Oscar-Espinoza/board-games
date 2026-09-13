import { describe, expect, test } from 'bun:test';
import type { ActionRequest, RoomView } from '@board-games/shared';
import {
  canRetryIntention,
  deliverIntention,
  SocketReplyError,
} from '../apps/web/src/lib/action-retry';

function room(gameId = 'sushi-go-party'): RoomView {
  return {
    id: 'table',
    gameId,
    practice: false,
    hostId: 'a',
    playerId: 'a',
    players: ['a', 'b'].map((id) => ({
      id,
      name: id,
      connected: true,
      reservedUntil: null,
    })),
    status: 'playing',
    revision: 10,
    round: 2,
    game: {
      public: {
        phase: 'draft',
        round: 1,
        turn: 3,
        setupVersion: 0,
        ready: [],
        committed: [],
        prompt: null,
      },
      private: {
        hand: [{ handle: 'private-handle' }],
        pickPromptId: 'pick-1-3-a',
        committed: null,
        legalUtensils: ['old-spoon'],
        copyTargets: [{ id: 'public-nigiri' }],
      },
    },
  };
}
const pick = {
  type: 'PICK',
  round: 1,
  turn: 3,
  promptId: 'pick-1-3-a',
  card: 'private-handle',
  utensils: [],
};

describe('simultaneous intention retry boundary', () => {
  test('readiness follows the same setup for Carcassonne and Codenames', () => {
    for (const gameId of ['carcassonne', 'codenames']) {
      const initial = room(gameId);
      initial.game!.public = { phase: 'setup', setupVersion: 3, ready: [] };
      const latest = structuredClone(initial);
      latest.revision++;
      (latest.game!.public as any).ready.push('b');
      expect(
        canRetryIntention(initial, latest, { type: 'ready', version: 3 }),
      ).toBe(true);
      (latest.game!.public as any).setupVersion++;
      expect(
        canRetryIntention(initial, latest, { type: 'ready', version: 3 }),
      ).toBe(false);
    }
  });
  test('a concurrent opponent commitment permits retry without changing the pick', () => {
    const initial = room(),
      latest = structuredClone(initial);
    latest.revision++;
    (latest.game!.public as any).committed.push('b');
    expect(canRetryIntention(initial, latest, pick)).toBe(true);
  });
  test('hands passing, prompts, ownership, absence, readiness and rematches invalidate old picks', () => {
    const initial = room();
    const edits: ((r: RoomView) => void)[] = [
      (r) => {
        r.id = 'elsewhere';
      },
      (r) => {
        r.playerId = 'b';
      },
      (r) => {
        r.round++;
      },
      (r) => {
        r.players[1].connected = false;
      },
      (r) => {
        r.status = 'finished';
      },
      (r) => {
        (r.game!.public as any).round++;
      },
      (r) => {
        (r.game!.public as any).turn++;
      },
      (r) => {
        (r.game!.public as any).phase = 'resolving';
      },
      (r) => {
        (r.game!.public as any).committed.push('a');
      },
      (r) => {
        (r.game!.private as any).committed = { card: 'private-handle' };
      },
      (r) => {
        (r.game!.private as any).pickPromptId = 'next';
      },
      (r) => {
        (r.game!.private as any).hand = [{ handle: 'new-owner-handle' }];
      },
    ];
    for (const edit of edits) {
      const latest = structuredClone(initial);
      edit(latest);
      expect(canRetryIntention(initial, latest, pick)).toBe(false);
    }
    const latest = structuredClone(initial);
    expect(
      canRetryIntention(initial, latest, {
        ...pick,
        utensils: ['fresh-spoon'],
      }),
    ).toBe(false);
    expect(
      canRetryIntention(initial, latest, { ...pick, copyTarget: 'gone-card' }),
    ).toBe(false);
    expect(
      canRetryIntention(initial, latest, {
        ...pick,
        utensils: ['old-spoon'],
        copyTarget: 'public-nigiri',
      }),
    ).toBe(true);
  });
  test('Sushi next-round readiness cannot cross the deal or configuration change', () => {
    const initial = room();
    (initial.game!.public as any).phase = 'round-end';
    const action = { type: 'READY', round: 1, version: 0 };
    const latest = structuredClone(initial);
    expect(canRetryIntention(initial, latest, action)).toBe(true);
    (latest.game!.public as any).ready.push('a');
    expect(canRetryIntention(initial, latest, action)).toBe(false);
  });
});

test('three total attempts retain the exact intention and ID; each uses synchronized revision', async () => {
  const initial = room();
  let latest = initial;
  const calls: ActionRequest[] = [];
  await expect(
    deliverIntention(initial, pick, 'same-id', {
      current: () => latest,
      submit: async (req) => {
        calls.push(req);
        throw new SocketReplyError('translated text', 'STALE_REVISION');
      },
      synchronize: async () => {
        latest = { ...latest, revision: latest.revision + 1 };
        return { room: latest, accepted: false };
      },
    }),
  ).rejects.toThrow('translated text');
  expect(calls.map((c) => c.revision)).toEqual([10, 11, 12]);
  expect(
    calls.every(
      (c) =>
        c.id === 'same-id' &&
        JSON.stringify(c.action) === JSON.stringify(pick) &&
        c.round === 2,
    ),
  ).toBe(true);
});

test('lost acknowledgement checks acceptance and never duplicates a successful pick', async () => {
  const initial = room();
  let calls = 0;
  await deliverIntention(initial, pick, 'same-id', {
    current: () => initial,
    submit: async () => {
      calls++;
      throw new SocketReplyError('timeout', 'TIMEOUT');
    },
    synchronize: async () => ({ room: initial, accepted: true }),
  });
  expect(calls).toBe(1);
});

test('synchronization after a pass stops retry, and no irreversible guesses or drafts retry', async () => {
  for (const gameId of ['sushi-go-party', 'azul', 'codenames']) {
    const initial = room(gameId);
    let calls = 0;
    let latest = initial;
    await expect(
      deliverIntention(initial, pick, 'same-id', {
        current: () => latest,
        submit: async () => {
          calls++;
          throw new SocketReplyError('stale', 'STALE_REVISION');
        },
        synchronize: async () => {
          latest = structuredClone(initial);
          latest.revision++;
          (latest.game!.public as any).turn++;
          return { room: latest, accepted: false };
        },
      }),
    ).rejects.toThrow('stale');
    expect(calls).toBe(1);
  }
});

test('ordinary game errors do not trigger synchronization or retry', async () => {
  const initial = room();
  let synced = false;
  await expect(
    deliverIntention(initial, pick, 'same-id', {
      current: () => initial,
      submit: async () => {
        throw new SocketReplyError('Invalid card');
      },
      synchronize: async () => {
        synced = true;
        return { room: initial, accepted: false };
      },
    }),
  ).rejects.toThrow('Invalid card');
  expect(synced).toBe(false);
});

test('editing the local selection during synchronization does not change the retained intention', async () => {
  const initial = room();
  let latest = initial;
  const intention = structuredClone(pick);
  const calls: ActionRequest[] = [];
  await deliverIntention(initial, new Proxy(intention, {}), 'stable', {
    current: () => latest,
    submit: async (request) => {
      calls.push(request);
      if (calls.length === 1) {
        intention.card = 'another-card';
        throw new SocketReplyError('stale', 'STALE_REVISION');
      }
    },
    synchronize: async () => {
      latest = { ...initial, revision: initial.revision + 1 };
      return { room: latest, accepted: false };
    },
  });
  expect(calls).toHaveLength(2);
  expect(calls[0].action).toEqual(pick);
  expect(calls[1].action).toEqual(pick);
});

test('Little Secret retries only unchanged uncommitted readiness, continuation, ballots and RPS', () => {
  for (const [phase, action, committed] of [
    ['setup', { type: 'ready', version: 2 }, 'ready'],
    ['missionResult', { type: 'continue', mission: 1 }, 'continued'],
    ['vote', { type: 'vote', ballotId: 'ballot-1', target: 'b' }, 'committed'],
    ['tie', { type: 'rps', rpsId: 'rps-1', symbol: 'rock' }, 'rpsCommitted'],
  ] as const) {
    const initial = room('little-secret');
    initial.game!.public = {
      phase,
      players: ['a', 'b', 'c'],
      mission: 1,
      setupVersion: 2,
      ready: [],
      continued: [],
      committed: [],
      rpsCommitted: [],
      eliminated: [],
      candidates: ['a', 'b'],
      ballotId: 'ballot-1',
      rpsId: 'rps-1',
      prompt: null,
    };
    const current = structuredClone(initial);
    current.revision++;
    expect(canRetryIntention(initial, current, action)).toBe(true);
    (current.game!.public as any)[committed].push('a');
    expect(canRetryIntention(initial, current, action)).toBe(false);
    (current.game!.public as any)[committed] = [];
    for (const change of [
      { mission: 2 },
      { phase: 'clues' },
      ...(phase === 'vote'
        ? [{ ballotId: 'ballot-2' }, { eliminated: ['b'] }]
        : []),
      ...(phase === 'tie'
        ? [
            { rpsId: 'rps-2' },
            { candidates: ['b', 'c'] },
            { prompt: { kind: 'sage' } },
          ]
        : []),
    ]) {
      const changed = structuredClone(current);
      Object.assign(changed.game!.public!, change);
      expect(canRetryIntention(initial, changed, action)).toBe(false);
    }
    for (const type of [
      'guess',
      'revenant',
      'resolveTie',
      'volunteer',
      'clue',
      'openVote',
    ])
      expect(canRetryIntention(initial, current, { ...action, type })).toBe(
        false,
      );
  }
});
