import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import unoGuide from '../apps/web/src/lib/catalog/guides/uno';
import catanGuide from '../apps/web/src/lib/catalog/guides/catan';
import carcGuide from '../apps/web/src/lib/catalog/guides/carcassonne';
import { points, type Feature } from '../games/carcassonne/src/features';
import { createGame, produce } from '../games/catan/src/index';
const guides = { uno: unoGuide, catan: catanGuide, carcassonne: carcGuide };
const scenes = {
  uno: ['hand', 'match', 'turn', 'wild', 'stack', 'stock'],
  catan: [
    'build',
    'production',
    'resources',
    'distance',
    'trade',
    'robber',
    'development',
    'route',
    'score',
    'turn',
  ],
  carcassonne: [
    'placement',
    'road',
    'ownership',
    'city',
    'monastery',
    'field',
    'builder',
    'pig',
    'river',
    'abbot',
    'goods',
    'flight',
    'markers',
    'message',
    'gold',
    'magic',
  ],
};

describe('library lesson coverage', () => {
  for (const [game, guide] of Object.entries(guides))
    test(`${game} has unique, complete, bilingual scenarios with supported scenes`, () => {
      const ids = new Set<string>();
      for (const chapter of guide.chapters) {
        expect(chapter.lessons.length).toBeGreaterThan(0);
        for (const lesson of chapter.lessons) {
          expect(ids.has(lesson.id)).toBe(false);
          ids.add(lesson.id);
          expect(scenes[game as keyof typeof scenes]).toContain(lesson.scene);
          expect(lesson.frames).toHaveLength(3);
          expect(lesson.values).toHaveLength(3);
          for (const locale of ['en', 'es']) {
            const messages = JSON.parse(
              readFileSync(`packages/shared/messages/${locale}.json`, 'utf8'),
            );
            for (const suffix of [
              'title',
              'info',
              'before',
              'action',
              'result',
            ]) {
              const key = `learn_${game}_${lesson.id.replaceAll('-', '_')}_${suffix}`;
              expect(messages[key]).toBeString();
              expect(messages[key].trim().length).toBeGreaterThan(
                suffix === 'title' ? 0 : 15,
              );
            }
          }
        }
      }
      expect(ids.size).toBeGreaterThan(
        game === 'carcassonne' ? 35 : game === 'catan' ? 20 : 15,
      );
    });
  test('every numbered message and optional module has an example', () => {
    const lessons = carcGuide.chapters.flatMap((c) => c.lessons);
    for (let n = 1; n <= 8; n++)
      expect(lessons.some((l) => l.id === `message-${n}`)).toBe(true);
    for (const id of [
      'river',
      'abbot',
      'inns',
      'traders',
      'flight',
      'messages',
      'ferries',
      'gold',
      'magic',
      'robbers',
      'crop',
    ])
      expect(carcGuide.chapters.some((c) => c.id === id)).toBe(true);
  });
});
function feature(kind: Feature['kind'], count = 3): Feature {
  return {
    id: 'example',
    kind,
    nodes: [],
    tiles: Array.from({ length: count }, (_, i) => String(i)),
    open: 0,
    complete: true,
    figures: [],
    leaders: ['Ada'],
    strength: { Ada: 1 },
    shields: 0,
    goods: [0, 0, 0],
    inn: false,
    cathedral: false,
    mage: false,
    witch: false,
    cities: [],
  };
}
function shown(id: string) {
  return Number(
    carcGuide.chapters.flatMap((c) => c.lessons).find((l) => l.id === id)!
      .values[2],
  );
}
test('Carcassonne illustrated result numbers agree with the pure scoring rules', () => {
  const road = feature('road');
  expect(shown('road')).toBe(points(road));
  road.inn = true;
  expect(shown('inn')).toBe(points(road));
  expect(points(road, true)).toBe(3);
  const city = feature('city');
  city.shields = 1;
  expect(shown('city')).toBe(points(city));
  city.cathedral = true;
  expect(shown('cathedral')).toBe(points(city));
  expect(points(city, true)).toBe(4);
  city.cathedral = false;
  city.mage = true;
  city.witch = true;
  expect(shown('magic')).toBe(points(city));
  const field = feature('field');
  field.cities = ['one', 'two'];
  expect(shown('farmers')).toBe(points(field, true));
});
test('Catan production lesson gives one to a settlement and two to a city', () => {
  const s = createGame(['Ada', 'Bea', 'Leo'], () => 0.4);
  s.buildings.fill(null);
  s.hands = s.hands.map(() => [0, 0, 0, 0, 0]);
  const index = s.board.hexes.findIndex((h) => h.resource !== null);
  const hex = s.board.hexes[index];
  s.robber = -1;
  for (const h of s.board.hexes) h.number = 2;
  hex.number = 6;
  s.buildings[hex.vertices[0]] = { owner: 'Ada', color: 0, city: false };
  s.buildings[hex.vertices[2]] = { owner: 'Bea', color: 1, city: true };
  produce(s, 6);
  expect(s.hands[0][hex.resource!]).toBe(1);
  expect(s.hands[1][hex.resource!]).toBe(2);
  expect(
    catanGuide.chapters
      .flatMap((c) => c.lessons)
      .find((l) => l.id === 'production')!.values[2],
  ).toBe(`${s.hands[0][hex.resource!]} / ${s.hands[1][hex.resource!]}`);
});
