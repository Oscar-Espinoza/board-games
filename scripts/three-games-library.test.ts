import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import littleSecret from '../apps/web/src/lib/catalog/guides/little-secret';
import azul from '../apps/web/src/lib/catalog/guides/azul';
import codenames from '../apps/web/src/lib/catalog/guides/codenames';
import sushi from '../apps/web/src/lib/catalog/guides/sushi-go-party';

const en = JSON.parse(readFileSync('packages/shared/messages/en.json', 'utf8'));
const es = JSON.parse(readFileSync('packages/shared/messages/es.json', 'utf8'));

for (const [game, guide] of Object.entries({
  'little-secret': littleSecret,
  azul,
  codenames,
  'sushi-go-party': sushi,
})) {
  test(`${game} library has unique lessons and complete three-frame examples`, () => {
    expect(guide.title().trim().length).toBeGreaterThan(0);
    const ids = new Set<string>();
    expect(guide.chapters.length).toBeGreaterThan(0);
    for (const chapter of guide.chapters) {
      expect(chapter.title().trim().length).toBeGreaterThan(0);
      expect(chapter.lessons.length).toBeGreaterThan(0);
      for (const lesson of chapter.lessons) {
        expect(ids.has(lesson.id)).toBe(false);
        ids.add(lesson.id);
        expect(lesson.title().trim().length).toBeGreaterThan(0);
        expect(lesson.explanation().trim().length).toBeGreaterThan(15);
        expect(lesson.scene.length).toBeGreaterThan(0);
        expect(lesson.frames).toHaveLength(3);
        expect(lesson.values).toHaveLength(3);
        const captions = lesson.frames.map((frame) => frame().trim());
        expect(captions.every((caption) => caption.length > 0)).toBe(true);
        expect(new Set(captions).size).toBe(3);
      }
    }
  });
}

test('new game, card, library and transport copy has matching English and Spanish keys', () => {
  const included = (key: string) =>
    /^(ls_|azul_|cn_|sgp_|learn_azul_|learn_codenames_|learn_sushi_|library_azul_|library_codenames_|library_sushi_|library_cn_|library_sgp_|action_)/.test(
      key,
    );
  const english = Object.keys(en).filter(included).sort();
  const spanish = Object.keys(es).filter(included).sort();
  expect(english).toEqual(spanish);
  for (const key of english) {
    expect(typeof en[key]).toBe('string');
    expect(typeof es[key]).toBe('string');
    expect(en[key].trim().length).toBeGreaterThan(0);
    expect(es[key].trim().length).toBeGreaterThan(0);
  }
});
