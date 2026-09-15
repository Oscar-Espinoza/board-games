import { expect, test } from 'bun:test';
import { desktopSeats, tableMenu } from './layout.js';
import { presets } from '../menus.js';
import { scenario } from '../practice.js';
import { assertConservation, view } from '../index.js';

test('seat order follows the real clockwise pass for every supported player count', () => {
  for (let guests = 2; guests <= 8; guests++) {
    const seats = desktopSeats(guests - 1);
    expect(seats).toHaveLength(guests - 1);
    const angles = seats.map(
      (s) =>
        (Math.atan2(s.y + s.h / 2 - 450, s.x + s.w / 2 - 720) -
          Math.PI / 2 +
          Math.PI * 2) %
        (Math.PI * 2),
    );
    expect(angles).toEqual(angles.toSorted((a, b) => a - b));
    for (let i = 0; i < seats.length; i++) {
      for (let j = i + 1; j < seats.length; j++) {
        const a = seats[i],
          b = seats[j];
        expect(
          a.x + a.w <= b.x ||
            b.x + b.w <= a.x ||
            a.y + a.h <= b.y ||
            b.y + b.h <= a.y,
        ).toBe(true);
      }
    }
  }
});

test('printed menu rules preserve player-count exceptions and localized card names', () => {
  expect(
    tableMenu(presets.original, 5, 'en')
      .find((t) => t.kind === 'maki')!
      .rules.join(' '),
  ).toBe('Most 6, second 3');
  expect(
    tableMenu(presets.original, 8, 'en')
      .find((t) => t.kind === 'maki')!
      .rules.join(' '),
  ).toBe('Most 6, second 4, third 2');
  expect(
    tableMenu(presets.original, 2, 'en').at(-1)!.rules.join(' '),
  ).not.toContain('−6');
  expect(tableMenu(presets.original, 2, 'es').at(-1)!.rules.join(' ')).toBe(
    'Final: mayoría +6',
  );
  expect(tableMenu(presets.original, 5, 'es')[0].rules.join(' ')).toContain(
    'Huevo',
  );
  for (const preset of Object.values(presets)) {
    for (const locale of ['en', 'es'] as const) {
      const tiles = tableMenu(preset, 5, locale);
      expect(tiles).toHaveLength(8);
      expect(new Set(tiles.map((t) => t.kind)).size).toBe(8);
      expect(
        tiles.every(
          (t) => t.rules.length && t.rules.every((r) => !r.startsWith('tile_')),
        ),
      ).toBe(true);
    }
  }
});

test('illustrated practice scene is conserved, deterministic and projected privately for 2–8 guests', () => {
  for (let count = 2; count <= 8; count++) {
    const { state } = scenario('table', count);
    expect(state).toEqual(scenario('table', count).state);
    expect(state.round).toBe(2);
    expect(state.turn).toBe(4);
    expect(state.phase).toBe('draft');
    assertConservation(state);
    for (const id of state.players) {
      const projected = view(state, id);
      expect(
        projected.public.players.every((p) => p.tableau.length === 3),
      ).toBe(true);
      expect(projected.public.players.every((p) => !('hand' in p))).toBe(true);
      expect(projected.private.hand).toHaveLength(
        count <= 3 ? 7 : count <= 5 ? 6 : count <= 7 ? 5 : 4,
      );
    }
  }
});
