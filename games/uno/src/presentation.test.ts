import test from 'node:test';
import assert from 'node:assert/strict';
import { uno } from './index.js';
import { movements, seatPosition } from './presentation.js';

test('presentation detects accepted plays and private draws without inventing opponent identities', () => {
  let state = uno.create(['a', 'b'], () => 0.4);
  let before = uno.view(state, 'a');
  state = uno.apply(state, 'a', { type: 'DRAW' }, () => 0.4);
  let after = uno.view(state, 'a');
  assert.equal(movements(before, after, 'a')[0]?.kind, 'draw');
  assert.equal(
    movements(before, after, 'a')[0]?.cardId,
    after.private.hand.find(
      (card) => !before.private.hand.some((held) => held.id === card.id),
    )?.id,
  );
  before = after;
  state = uno.apply(state, 'b', { type: 'DRAW' }, () => 0.4);
  after = uno.view(state, 'a');
  assert.deepEqual(movements(before, after, 'a'), [
    { kind: 'draw', player: 'b', count: 1 },
  ]);
  assert.deepEqual(movements(after, after, 'a'), []);
  assert.deepEqual(
    movements(
      { ...before, public: { ...before.public, revision: 0 } },
      after,
      'a',
    ),
    [],
  );
  before = after;
  const play = after.private.legalActions.find((a) => a.type === 'PLAY_CARD');
  assert.ok(play);
  state = uno.apply(state, 'a', play, () => 0.4);
  assert.deepEqual(movements(before, uno.view(state, 'a'), 'a'), [
    { kind: 'play', player: 'a', cardId: play.cardId, count: 1 },
  ]);
});
test('small tables use fixed cardinal seats and every larger seat remains distinct', () => {
  assert.deepEqual(
    [0, 1].map((i) => seatPosition(i, 2)),
    [
      [50, 89],
      [50, 10],
    ],
  );
  assert.deepEqual(
    [0, 1, 2, 3].map((i) => seatPosition(i, 4)),
    [
      [50, 89],
      [9, 48],
      [50, 10],
      [91, 48],
    ],
  );
  for (let count = 2; count <= 8; count++)
    assert.equal(
      new Set(
        Array.from({ length: count }, (_, i) =>
          seatPosition(i, count).join(','),
        ),
      ).size,
      count,
    );
});
