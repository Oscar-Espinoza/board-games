import { expect, test } from 'bun:test';
import {
  fitCamera,
  project,
  screen,
  tableSpace,
  unproject,
  world,
  zoomAt,
} from './camera.js';
import { practice } from '../practice.js';
import { edge, tiles } from '../tiles.js';

test('angled coordinates round trip at negative cells, zoom extremes and phone sizes', () => {
  for (const [width, height] of [
    [1672, 941],
    [360, 640],
    [844, 390],
  ]) {
    const { anchor } = tableSpace(width, height);
    for (const scale of [0.12, 1.5, 3]) {
      const camera = { x: -325, y: 600, scale };
      for (const point of [
        { x: -900, y: 1250 },
        { x: 0, y: 0 },
        { x: 1250, y: -750 },
      ]) {
        const result = world(screen(point, camera, anchor), camera, anchor);
        expect(result.x).toBeCloseTo(point.x, 8);
        expect(result.y).toBeCloseTo(point.y, 8);
        expect(unproject(project(point)).x).toBeCloseTo(point.x, 8);
      }
    }
  }
});
test('wheel and pinch zoom preserve the exact world point under the pointer, including bounds', () => {
  const anchor = { x: 820, y: 350 },
    pointer = { x: 267, y: 703 };
  const camera = { x: -45, y: 713, scale: 1.6 };
  const before = world(pointer, camera, anchor);
  for (const factor of [0.001, 0.5, 1.5, 100]) {
    const result = zoomAt(camera, anchor, pointer, factor);
    const after = screen(before, result, anchor);
    expect(after.x).toBeCloseTo(pointer.x, 8);
    expect(after.y).toBeCloseTo(pointer.y, 8);
    expect(result.scale).toBeGreaterThanOrEqual(0.12);
    expect(result.scale).toBeLessThanOrEqual(3);
  }
});
test('Fit reserves room for fixed panels and contains all four corners of a developed board', () => {
  const cells = Object.values(practice('table').state.board);
  for (const [width, height] of [
    [1672, 941],
    [1024, 768],
    [390, 844],
  ]) {
    const space = tableSpace(width, height),
      camera = fitCamera(cells, width, height);
    for (const tile of cells)
      for (const dx of [0, 100])
        for (const dy of [0, 100]) {
          const point = screen(
            { x: tile.x * 100 + dx, y: tile.y * 100 + dy },
            camera,
            space.anchor,
          );
          expect(Math.abs(point.x - space.anchor.x)).toBeLessThan(
            space.width / 2,
          );
          expect(Math.abs(point.y - space.anchor.y)).toBeLessThan(
            space.height / 2,
          );
        }
  }
});
test('painted review fixture is deterministic, playable and has only legal neighboring edges', () => {
  const state = practice('table').state;
  expect(state).toEqual(practice('table').state);
  expect(state.players).toHaveLength(6);
  expect(state.phase).toBe('place');
  expect(Object.keys(state.board)).toHaveLength(29);
  for (const tile of Object.values(state.board)) {
    for (const [side, [dx, dy]] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ].entries()) {
      const neighbor = state.board[`${tile.x + dx},${tile.y + dy}`];
      if (neighbor)
        expect(edge(tiles[tile.id], tile.rotation, side)).toBe(
          edge(tiles[neighbor.id], neighbor.rotation, (side + 2) % 4),
        );
    }
  }
});
