import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uno } from './index.js';
import { botAction } from './bot.js';

test('practice policy chooses legal moves, declares UNO and favors its majority color', () => {
  assert.deepEqual(
    botAction({ public: {}, private: { hand: [], legalActions: [] } }),
    null,
  );
  assert.deepEqual(
    botAction({
      public: {},
      private: {
        hand: [
          { id: 1, color: 'red', symbol: '1' },
          { id: 100, color: null, symbol: 'wild' },
        ],
        legalActions: [
          { type: 'PLAY_CARD', cardId: 100, uno: false },
          { type: 'PLAY_CARD', cardId: 1, uno: false },
          { type: 'PLAY_CARD', cardId: 1, uno: true },
          { type: 'DRAW' },
        ],
      },
    }),
    { type: 'PLAY_CARD', cardId: 1, uno: true },
  );
  assert.deepEqual(
    botAction({
      public: {},
      private: {
        hand: [{ id: 1, color: 'blue', symbol: '1' }],
        legalActions: [
          { type: 'CHOOSE_COLOR', color: 'red' },
          { type: 'CHOOSE_COLOR', color: 'blue' },
        ],
      },
    }),
    { type: 'CHOOSE_COLOR', color: 'blue' },
  );
});

test('four projected-view players complete seeded games using only accepted intentions', () => {
  for (let seed = 1; seed <= 8; seed++) {
    let value = seed;
    const random = () =>
      (value = (value * 1664525 + 1013904223) >>> 0) / 2 ** 32;
    let state = uno.create(['a', 'b', 'c', 'd'], random);
    let turns = 0;
    while (!uno.isFinished(state) && turns++ < 2000) {
      const player = state.players[state.turn]!;
      const view = uno.view(state, player);
      const action = botAction(view);
      assert.ok(action);
      assert.ok(
        view.private.legalActions.some(
          (a) => JSON.stringify(a) === JSON.stringify(action),
        ),
      );
      state = uno.apply(state, player, action, random);
    }
    assert.ok(uno.isFinished(state), `Seed ${seed} did not complete`);
    assert.ok(state.winner);
  }
});
