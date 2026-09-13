import { test, expect } from 'bun:test';
import { eventGate } from './presentation.js';
test('accepted public events animate once; revision gaps, hidden tabs, identities and reconnect reset', () => {
  let cancels = 0;
  const g = eventGate(() => cancels++),
    s = {};
  expect(g.consume('a', 1, [{ type: 'deal', sequence: 1 }], true, s)).toEqual(
    [],
  );
  expect(
    g.consume('a', 2, [{ type: 'deal', sequence: 2 }], true, s),
  ).toHaveLength(1);
  expect(g.consume('a', 2, [{ type: 'deal', sequence: 2 }], true, s)).toEqual(
    [],
  );
  expect(g.consume('a', 4, [{ type: 'deal', sequence: 4 }], true, s)).toEqual(
    [],
  );
  g.consume('a', 4, [], false, s);
  expect(g.consume('a', 5, [{ type: 'deal', sequence: 5 }], true, s)).toEqual(
    [],
  );
  expect(g.consume('a', 5, [{ type: 'deal', sequence: 5 }], true, {})).toEqual(
    [],
  );
  expect(g.consume('b', 6, [{ type: 'deal', sequence: 6 }], true, {})).toEqual(
    [],
  );
  g.reset();
  expect(cancels).toBeGreaterThan(3);
});
