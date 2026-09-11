import { test } from 'node:test';
import { expect } from '@playwright/test';
import { diceThrow } from './dice-throw.js';
import { seeded } from './practice.js';
test('independent dice lose momentum, remain on the island and settle separately', () => {
  const random = seeded(92);
  for (let i = 0; i < 20; i++) {
    const result = diceThrow(i / 19, random);
    expect(result.duration).toBeLessThan(2400);
    const [a, b] = result.paths.map((path) => path.at(-1)!);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(0.249);
    for (const path of result.paths) {
      for (const p of path) {
        for (let edge = 0; edge < 6; edge++) {
          const angle = Math.PI / 6 + (edge * Math.PI) / 3;
          expect(
            p.x * Math.cos(angle) + p.y * Math.sin(angle),
          ).toBeLessThanOrEqual(0.800001);
        }
        expect(p.height).toBeGreaterThanOrEqual(0);
      }
      const first = path[0],
        next = path[1],
        last = path.at(-1)!,
        previous = path.at(-2)!;
      expect(Math.hypot(last.x - previous.x, last.y - previous.y)).toBeLessThan(
        Math.hypot(next.x - first.x, next.y - first.y) / 20,
      );
      for (const settled of path.slice(-2)) {
        expect([
          settled.x,
          settled.y,
          settled.spinX,
          settled.spinY,
          settled.yaw,
        ]).toEqual([last.x, last.y, last.spinX, last.spinY, last.yaw]);
      }
      expect(last.height).toBe(0);
      expect(last.spinX).toBe(0);
      expect(last.spinY).toBe(0);
    }
  }
});
