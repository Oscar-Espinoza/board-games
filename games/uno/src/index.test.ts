import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uno, deck, type State } from './index.ts';
const random = () => 0.37;
function rig(hands: number[][], top = 0): State {
  const state = uno.create(
    hands.map((_, i) => String(i)),
    random,
  );
  const cards = deck();
  state.hands = hands.map((hand) => hand.map((id) => cards[id]!));
  state.discards = [cards[top]!];
  state.activeColor = cards[top]!.color!;
  state.stock = cards.filter(
    (card) => card.id !== top && !hands.flat().includes(card.id),
  );
  return state;
}
const play = (state: State, player: string, cardId: number, declare = false) =>
  uno.apply(state, player, { type: 'PLAY_CARD', cardId, uno: declare }, random);
const draw = (state: State, player: string) =>
  uno.apply(state, player, { type: 'DRAW' }, random);
const choose = (state: State, player: string) =>
  uno.apply(state, player, { type: 'CHOOSE_COLOR', color: 'blue' }, random);

test('deals the existing 108-card deck with a number opening and private recipient projections', () => {
  const state = uno.create(['a', 'b', 'c', 'd'], random);
  assert.equal(
    new Set(
      [...state.hands.flat(), ...state.stock, ...state.discards].map(
        (c) => c.id,
      ),
    ).size,
    108,
  );
  assert.deepEqual(
    state.hands.map((h) => h.length),
    [7, 7, 7, 7],
  );
  assert.match(state.discards[0]!.symbol, /^\d$/);
  const projected = uno.view(state, 'a');
  assert.deepEqual(
    projected.private.hand.map((c) => c.id),
    state.hands[0]!.map((c) => c.id).sort((a, b) => a - b),
  );
  assert.equal('hands' in projected.public, false);
  assert.equal('stock' in projected.public, false);
  assert.deepEqual(Object.keys(projected.private).sort(), [
    'hand',
    'legalActions',
  ]);
  assert.throws(() => uno.view(state, 'outsider'));
});

test('skip, reverse and optional draw follow roster order including two-seat reverse', () => {
  assert.equal(play(rig([[19, 1], [25], [50]]), '0', 19).turn, 2);
  const reversed = play(rig([[21, 1], [25], [50]]), '0', 21);
  assert.equal(reversed.direction, -1);
  assert.equal(reversed.turn, 2);
  assert.equal(play(rig([[21, 1], [25]]), '0', 21).turn, 0);
  assert.equal(draw(rig([[1], [25]]), '0').turn, 1);
});

test('penalty stacks allow +2 on +2, +4 on either, reject +2 on +4, and draw pays total', () => {
  let state = play(
    rig([
      [23, 1],
      [48, 25],
      [104, 50],
      [73, 75],
    ]),
    '0',
    23,
  );
  state = play(state, '1', 48);
  assert.equal(state.penalty?.amount, 4);
  state = choose(play(state, '2', 104), '2');
  assert.deepEqual(state.penalty, { amount: 8, kind: 4 });
  assert.throws(() => play(state, '3', 73));
  state = draw(state, '3');
  assert.equal(state.hands[3]!.length, 10);
  assert.equal(state.penalty, null);
  assert.equal(state.turn, 0);
});

test('rejection preserves original state and random consumption; color is validated', () => {
  let state = rig([[100, 1], [25]]);
  const original = structuredClone(state);
  assert.throws(() =>
    uno.apply(state, '1', { type: 'DRAW' }, () => {
      throw Error('random consumed');
    }),
  );
  assert.deepEqual(state, original);
  state = play(state, '0', 100);
  assert.throws(() => draw(state, '0'));
  assert.throws(() =>
    uno.apply(state, '0', { type: 'CHOOSE_COLOR', color: 'purple' }, random),
  );
  assert.throws(() => uno.apply(state, '0', { type: 'FORGE' }, random));
});

test('missed UNO catches open after wild color, survive rejection, succeed only once', () => {
  let state = play(
    rig([
      [100, 1],
      [25, 26],
    ]),
    '0',
    100,
  );
  assert.equal(state.catchable, null);
  state = choose(state, '0');
  assert.equal(state.catchable, '0');
  assert.throws(() => play(state, '1', 26));
  state = uno.apply(state, '1', { type: 'CATCH_UNO', player: '0' }, random);
  assert.equal(state.hands[0]!.length, 3);
  assert.equal(state.turn, 1);
  assert.throws(() =>
    uno.apply(state, '1', { type: 'CATCH_UNO', player: '0' }, random),
  );
  assert.equal(play(rig([[1, 2], [25]]), '0', 1, true).catchable, null);
  assert.throws(() => play(rig([[1, 2, 3], [25]]), '0', 1, true));
});

test('final +2 ends penalties and final wild wins only after a color choice', () => {
  const won = play(rig([[23], [25]]), '0', 23);
  assert.equal(won.winner, '0');
  assert.equal(won.penalty, null);
  let wild = play(rig([[104], [25]]), '0', 104);
  assert.equal(wild.phase, 'color');
  wild = choose(wild, '0');
  assert.equal(wild.phase, 'finished');
  assert.equal(wild.winner, '0');
  assert.equal(wild.penalty, null);
  assert.throws(() => draw(wild, '1'));
});

test('stock recycles all but top discard, and exhausted full rotation draws', () => {
  let state = rig([[1, 2], [25]]);
  state.stock = [];
  state.discards.push(deck()[3]!);
  state = draw(state, '0');
  assert.equal(state.hands[0]!.at(-1)!.id, 0);
  assert.equal(state.discards[0]!.id, 3);
  state = draw(state, '1');
  assert.equal(state.phase, 'turn');
  state = draw(state, '0');
  assert.equal(state.phase, 'finished');
  assert.equal(state.winner, null);
});

test('complete rounds preserve card conservation under legal actions', () => {
  for (let seed = 1; seed <= 20; seed++) {
    let n = seed;
    const rng = () =>
      (n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296;
    let state = uno.create(['0', '1', '2', '3'], rng);
    for (let turn = 0; turn < 3000 && !uno.isFinished(state); turn++) {
      const player = state.players[state.turn]!;
      const options = uno.view(state, player).private.legalActions;
      const action =
        options.find((a) => a.type === 'PLAY_CARD' && a.uno) ??
        options.find((a) => a.type === 'PLAY_CARD') ??
        options.find((a) => a.type === 'CHOOSE_COLOR') ??
        options.find((a) => a.type === 'DRAW')!;
      state = uno.apply(state, player, action, rng);
      const ids = [
        ...state.hands.flat(),
        ...state.stock,
        ...state.discards,
      ].map((c) => c.id);
      assert.equal(ids.length, 108);
      assert.equal(new Set(ids).size, 108);
    }
    assert.equal(state.phase, 'finished');
  }
});

test('every penalty response combination agrees with the previous Rust rules', () => {
  for (const first of [23, 104])
    for (const reply of [48, 105, 100, 25, 44, 46]) {
      let state = play(rig([[first, 1], [reply, 27], [52]]), '0', first, true);
      if (first === 104) state = choose(state, '0');
      const allowed = reply === 105 || (first === 23 && reply === 48);
      if (!allowed) {
        assert.throws(() => play(state, '1', reply));
        continue;
      }
      state = play(state, '1', reply);
      if (reply === 105) state = choose(state, '1');
      const amount = (first === 23 ? 2 : 4) + (reply === 48 ? 2 : 4);
      assert.equal(state.penalty?.amount, amount);
      state = draw(state, '2');
      assert.equal(state.hands[2]!.length, amount + 1);
      assert.equal(state.penalty, null);
    }
});

test('accepted draw/play close catches while a catch never consumes a pending stack', () => {
  const state = play(rig([[23, 1], [48, 25], [50]]), '0', 23);
  const caught = uno.apply(
    state,
    '2',
    { type: 'CATCH_UNO', player: '0' },
    random,
  );
  assert.deepEqual(caught.penalty, { amount: 2, kind: 2 });
  assert.equal(caught.turn, 1);
  assert.equal(draw(state, '1').catchable, null);
  const stacked = play(state, '1', 48, true);
  assert.equal(stacked.catchable, null);
  assert.throws(() =>
    uno.apply(stacked, '2', { type: 'CATCH_UNO', player: '0' }, random),
  );
});
