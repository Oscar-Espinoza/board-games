import { test, expect } from 'bun:test';
import { RevisionGate } from './presentation.js';
test('only consecutive accepted revisions animate once', () => {
  const gate = new RevisionGate();
  expect(gate.accept(0, 'a/0', true, {})).toBe(false);
  expect(gate.accept(1, 'a/0', true, {})).toBe(true);
  expect(gate.accept(1, 'a/0', true, {})).toBe(false);
  expect(gate.accept(3, 'a/0', true, {})).toBe(false);
  expect(gate.accept(4, 'a/0', true, {})).toBe(true);
  expect(gate.accept(2, 'a/0', true, {})).toBe(false);
  expect(gate.accept(5, 'a/0', true, {})).toBe(true);
});
test('connection waits for the resumed snapshot; match and seat changes settle', () => {
  const gate = new RevisionGate(),
    old = {};
  gate.accept(5, 'a/0', true, old);
  expect(gate.accept(5, 'a/0', false, old)).toBe(false);
  expect(gate.accept(5, 'a/0', true, old)).toBe(false);
  expect(gate.accept(6, 'a/0', true, {})).toBe(false);
  expect(gate.accept(7, 'a/0', true, {})).toBe(true);
  expect(gate.accept(8, 'b/0', true, {})).toBe(false);
  expect(gate.accept(0, 'b/1', true, {})).toBe(false);
  expect(gate.accept(1, 'b/1', true, {})).toBe(true);
  gate.reset();
  expect(gate.accept(2, 'b/1', true, {})).toBe(false);
});

import { planPresentation } from './presentation.js';
import { ringGeometry, railPosition } from './geometry.js';
import { fixture, inventory, scenarios, seeded } from './practice.js';
import { apply, view, type Destination } from './index.js';

for (const mode of ['compact', 'tabletop'] as const)
  for (const count of [5, 7, 9])
    test(`${count} factories ${mode} clear neighbours and centre controls`, () => {
      const g = ringGeometry(count, mode);
      // Conservative rectangular control bounds (whole phone disc; desktop 2×44).
      const control = mode === 'compact' ? 56 : 88;
      for (const [i, p] of g.points.entries()) {
        expect(
          Math.hypot(
            (p.x - g.width / 2) / g.radiusX,
            (p.y - g.height / 2) / g.radiusY,
          ),
        ).toBeCloseTo(1);
        expect(p.x - g.disc / 2).toBeGreaterThanOrEqual(0);
        expect(p.x + g.disc / 2).toBeLessThanOrEqual(g.width);
        expect(p.y - g.disc / 2).toBeGreaterThanOrEqual(0);
        expect(p.y + g.disc / 2).toBeLessThanOrEqual(g.height);
        const dx = Math.abs(p.x - g.width / 2),
          dy = Math.abs(p.y - g.height / 2);
        expect(
          dx >= (control + g.center.width) / 2 ||
            dy >= (control + g.center.height) / 2,
        ).toBe(true);
        for (const q of g.points.slice(i + 1)) {
          expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeGreaterThan(g.disc);
          expect(
            Math.abs(p.x - q.x) >= control || Math.abs(p.y - q.y) >= control,
          ).toBe(true);
        }
      }
    });
for (const scenario of scenarios)
  test(`${scenario} conserves all 100 tiles`, () => {
    expect(Object.values(inventory(fixture(scenario)))).toEqual([
      20, 20, 20, 20, 20,
    ]);
  });
function planned(
  scenario: Parameters<typeof fixture>[0],
  destination: Destination,
) {
  const before = fixture(scenario);
  const next = apply(
    before,
    before.players[0],
    {
      type: 'DRAFT',
      source: before.center.length
        ? { kind: 'center' }
        : { kind: 'factory', index: 0 },
      color: 'blue',
      destination,
    },
    seeded(),
  );
  return {
    before: view(before).public,
    next: view(next).public,
    plan: planPresentation(view(before).public, view(next).public),
  };
}
test('final draft reconstructs new pattern and floor slots; marker returns separately; cleanup precedes deal', () => {
  const { before, next, plan } = planned('cleanup', {
    kind: 'pattern',
    row: 1,
  });
  const draft = plan.steps.find((s) => s.at === 310)!;
  expect(draft.state.boards[0].patterns[1]).toEqual({
    color: 'blue',
    count: 2,
  });
  expect(draft.state.boards[0].floor).toEqual([
    'red',
    'yellow',
    'marker',
    'blue',
  ]);
  expect(
    plan.flights.filter((f) => f.to === 'discard' && f.duration === 150),
  ).toHaveLength(13);
  const marker = plan.flights.find(
    (f) => f.color === 'marker' && f.duration === 150,
  )!;
  expect(marker.to).toBe('center/marker');
  expect(
    plan.flights.some((f) => f.color === 'marker' && f.to === 'discard'),
  ).toBe(false);
  const cleanupEnd = Math.max(
    ...plan.flights
      .filter((f) => f.duration === 150)
      .map((f) => f.at + f.duration),
  );
  expect(
    Math.min(...plan.flights.filter((f) => f.from === 'bag').map((f) => f.at)),
  ).toBeGreaterThanOrEqual(cleanupEnd + 50);
  expect(plan.steps.at(-1)?.state).toEqual(next);
  expect(before.boards[0].patterns[1].count).toBe(1);
});
test('floor-only round uses actual capped loss even without a wall event', () => {
  const { plan, next } = planned('no_wall', { kind: 'floor' });
  expect(plan.flights.some((f) => f.to.includes('/wall/'))).toBe(false);
  const penalty = next.events.find((e) => e.type === 'penalty');
  expect(penalty).toMatchObject({ deduction: 8, loss: 2 });
  expect(plan.steps.some((s) => s.state.boards[0].score === 0)).toBe(true);
  expect(plan.flights.filter((f) => f.duration === 150)).toHaveLength(5);
  expect(plan.steps.at(-1)?.state).toEqual(next);
});
test('wall points arrive row by row and accepted bonuses cross the decorative rail', () => {
  const { plan, next } = planned('cross100', { kind: 'pattern', row: 0 });
  const placed = plan.steps.find((s) => s.at === 620)!;
  expect(placed.state.boards[0].score).toBe(104);
  expect(next.boards[0].score).toBe(106);
  expect(plan.steps.at(-1)?.state.boards[0].score).toBe(106);
  expect(railPosition(106)).toBe(100);
});

test('a final marker claimed beside seven occupied floor slots returns from the side anchor', () => {
  const s = fixture('no_wall');
  for (const color of ['red', 'yellow', 'black', 'white', 'red'] as const) {
    s.boards[0].floor.push(color);
    s.bag.splice(s.bag.indexOf(color), 1);
  }
  const accepted = apply(
    s,
    s.players[0],
    {
      type: 'DRAFT',
      source: { kind: 'center' },
      color: 'blue',
      destination: { kind: 'floor' },
    },
    seeded(),
  );
  const plan = planPresentation(view(s).public, view(accepted).public);
  expect(
    plan.flights.find((f) => f.color === 'marker' && f.duration === 150),
  ).toMatchObject({ from: 'workshop-0/marker', to: 'center/marker' });
  expect(Object.values(inventory(accepted))).toEqual([20, 20, 20, 20, 20]);
});
