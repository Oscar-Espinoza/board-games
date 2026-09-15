import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import {
  test,
  expect,
  type Page,
  type Browser,
  type BrowserContext,
} from '@playwright/test';
const evidence = 'docs/evidence/sushi-go-party';
mkdirSync(evidence, { recursive: true });
test.use({ video: 'on', deviceScaleFactor: 1 });
// Checked-in evidence is WebP; Playwright's PNG buffer is piped directly to cwebp.
function webp(png: Buffer, name: string) {
  execFileSync(
    'cwebp',
    [
      '-quiet',
      '-q',
      '90',
      '-m',
      '6',
      '-sharp_yuv',
      '-o',
      `${evidence}/${name}.webp`,
      '--',
      '-',
    ],
    { input: png },
  );
}
async function capture(page: Page, name: string, project: string) {
  webp(await page.screenshot(), `${project}-${name}`);
}
async function room(page: Page, browser: Browser, count: number) {
  const contexts: BrowserContext[] = [];
  const pages = [page];
  await page.goto('/');
  await page
    .locator('.game-names')
    .getByRole('button', { name: /Sushi Go Party/ })
    .click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await page.getByLabel('Your name').fill('Marina');
  await page.getByRole('button', { name: /Create room/ }).click();
  await expect(page).toHaveURL(/\/room\//);
  const url = page.url();
  for (let i = 1; i < count; i++) {
    // Exercise a desktop host with independent phone guests. Rendering eight
    // Retina desktops on one software WebKit process is not a device test.
    const context = await browser.newContext({
      deviceScaleFactor: 1,
      viewport: { width: 390, height: 844 },
    });
    contexts.push(context);
    const guest = await context.newPage();
    pages.push(guest);
    await guest.goto(url);
    await guest
      .getByLabel('Your name')
      .fill(
        [
          'Tomás',
          'Sakura',
          'Kai',
          'Lucía',
          'Ren',
          'Valentina de la Costa',
          'Nicolás del Río',
        ][i - 1],
      );
    await guest.getByRole('button', { name: 'Join an available seat' }).click();
    await expect(guest.locator('.roster')).toContainText('Marina');
  }
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await Promise.all(
    pages.map((p) => expect(p.locator('.menu-setup')).toBeVisible()),
  );
  return { pages, contexts };
}
async function ready(pages: Page[]) {
  for (let tries = 0; tries < 10; tries++) {
    const actions = await Promise.all(
      pages.map(async (page) => {
        const button = page.getByTestId('sgp-ready');
        if ((await button.count()) && (await button.isEnabled()))
          return button.click();
      }),
    );
    if (
      (await pages[0].locator('.sushi-table').getAttribute('data-phase')) ===
      'draft'
    )
      return;
    await pages[0].waitForTimeout(120);
  }
  await expect(pages[0].getByTestId('sgp-hand')).toBeVisible();
}
async function select(page: Page, utensils = false) {
  const hand = page.getByTestId('sgp-hand');
  if (!(await hand.count())) return;
  const first = hand.locator('button:not(:disabled)').first();
  if (!(await first.count())) return;
  const utensil = hand
    .locator('button:not(:disabled)')
    .and(hand.getByRole('button', { name: /^(Spoon|Chopsticks)/ }))
    .first();
  if (utensils && (await utensil.count())) await utensil.click();
  else await first.click();
  const copy = page.locator('.copy-choices select');
  if (await copy.count()) await copy.selectOption({ index: 1 });
  if (utensils) {
    for (const button of await page.locator('.utensil-choices button').all())
      await button.click();
  }
}
async function prompts(pages: Page[], observed?: Set<string>) {
  for (let attempts = 0; attempts < 40; attempts++) {
    let found = false;
    for (const page of pages) {
      const d = page.locator('.decision');
      if (!(await d.count())) continue;
      found = true;
      observed?.add((await d.getAttribute('data-testid')) ?? '');
      const choices = d.locator('.choice-cards>button');
      if (await choices.count()) {
        if (await page.getByTestId('sgp-prompt-takeout').count())
          await d.locator('button.primary').click();
        else await choices.first().click();
      } else await d.locator('button.primary,button').last().click();
    }
    if (
      !found &&
      (await pages[0].locator('.sushi-table').getAttribute('data-phase')) !==
        'resolving'
    )
      return;
    await pages[0].waitForTimeout(60);
  }
  throw new Error('Special resolution did not complete');
}
async function draftTurn(
  pages: Page[],
  utensils = false,
  observed?: Set<string>,
) {
  const before = await pages[0].locator('.table-center .eyebrow').textContent();
  await Promise.all(
    pages.map(async (p) => {
      await expect(p.locator('.sushi-table')).toHaveAttribute(
        'data-phase',
        'draft',
      );
      await expect(p.locator('.table-center .eyebrow')).toHaveText(before!);
      await expect(
        p.getByTestId('sgp-hand').locator('button:not(:disabled)').first(),
      ).toBeVisible();
    }),
  );
  await Promise.all(pages.map((p) => select(p, utensils)));
  for (let attempt = 0; attempt < 10; attempt++) {
    await Promise.all(
      pages.map(async (p) => {
        const keep = p.getByTestId('sgp-keep');
        if ((await keep.count()) && (await keep.isEnabled()))
          await keep.click();
      }),
    );
    if (
      (await pages[0].locator('.sushi-table').getAttribute('data-phase')) !==
        'draft' ||
      (await pages[0].locator('.table-center .eyebrow').textContent()) !==
        before
    )
      break;
    await pages[0].waitForTimeout(100);
  }
  await prompts(pages, observed);
  await expect
    .poll(
      async () =>
        (await pages[0].locator('.sushi-table').getAttribute('data-phase')) !==
          'draft' ||
        (await pages[0].locator('.table-center .eyebrow').textContent()) !==
          before,
    )
    .toBe(true);
}
async function saveVideo(page: Page, name: string, project: string) {
  const video = page.video();
  await page.close();
  if (video) await video.saveAs(`${evidence}/${project}-${name}.webm`);
}

test('two independent browsers complete three rounds, reconnect, score and rematch', async ({
  page,
  browser,
}, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  const { pages, contexts } = await room(page, browser, 2);
  try {
    await ready(pages);
    await draftTurn(pages);
    await page.waitForTimeout(800);
    await capture(page, 'desktop-table', info.project.name);
    const hand = await page
      .getByTestId('sgp-hand')
      .locator('button')
      .evaluateAll((cs) => cs.map((c) => c.getAttribute('aria-label')));
    await page.reload();
    await expect(page.getByTestId('sgp-hand')).toBeVisible();
    expect(
      await page
        .getByTestId('sgp-hand')
        .locator('button')
        .evaluateAll((cs) => cs.map((c) => c.getAttribute('aria-label'))),
    ).toEqual(hand);
    await expect(page.locator('.sushi-passing-bundle')).toHaveCount(0);
    for (let actions = 0; actions < 40; actions++) {
      const phase = await page
        .locator('.sushi-table')
        .getAttribute('data-phase');
      if (phase === 'finished') break;
      if (phase === 'round-end') {
        await capture(page, 'round-receipt', info.project.name);
        await ready(pages);
      } else await draftTurn(pages);
    }
    await expect(page.locator('.sushi-table')).toHaveAttribute(
      'data-phase',
      'finished',
    );
    await expect(page.getByRole('heading', { name: /Winners:/ })).toBeVisible();
    await capture(page, 'final-feast', info.project.name);
    await pages[1]
      .getByRole('button', { name: 'Another feast', exact: true })
      .click();
    await expect(page.locator('.menu-setup')).toBeVisible();
    await expect(page.locator('.sushi-passing-bundle')).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
    await saveVideo(page, 'full-match', info.project.name);
  }
});

test('eight independent seats use Spoon/Chopsticks and remain readable across viewports', async ({
  page,
  browser,
}, info) => {
  // Eight rendered WebKit clients are slower on Linux's software renderer.
  test.setTimeout(info.project.name === 'webkit' ? 360000 : 180000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  const { pages, contexts } = await room(page, browser, 8);
  try {
    await page
      .getByRole('button', { name: 'Big Banquet', exact: true })
      .click();
    await ready(pages);
    const observed = new Set<string>();
    for (let n = 0; n < 7; n++) await draftTurn(pages, true, observed);
    await expect(page.locator('.sushi-table')).toHaveAttribute(
      'data-phase',
      'round-end',
    );
    await ready(pages);
    for (let n = 0; n < 7; n++) {
      await draftTurn(pages, true, observed);
      if (
        observed.has('sgp-prompt-spoon') &&
        observed.has('sgp-prompt-chopsticks')
      )
        break;
    }
    expect([...observed]).toContain('sgp-prompt-spoon');
    expect([...observed]).toContain('sgp-prompt-chopsticks');
    if (
      (await page.locator('.sushi-table').getAttribute('data-phase')) ===
      'round-end'
    )
      await ready(pages);
    await page.waitForTimeout(800);
    for (const [name, width, height] of [
      ['eight-seats', 1440, 900],
      ['tablet', 768, 1024],
      ['narrow-phone', 360, 640],
      ['portrait-phone', 390, 844],
      ['wide-phone', 844, 390],
    ] as const) {
      await page.setViewportSize({ width, height });
      await draftTurn(pages, true, observed);
      if (
        (await page.locator('.sushi-table').getAttribute('data-phase')) ===
        'round-end'
      )
        await ready(pages);
      await page.waitForTimeout(800);
      await capture(page, name, info.project.name);
      const bounds = await page.getByTestId('sgp-keep').boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height);
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(await page.locator('.friend-plate').count()).toBe(7);
      if (width === 360 && height === 640) {
        const own = await page.locator('.own-area').boundingBox();
        const menu = await page.locator('.menu-mini').boundingBox();
        expect(menu!.y + menu!.height).toBeLessThanOrEqual(own!.y);
        for (const friend of await page.locator('.friend-plate').all()) {
          const box = (await friend.boundingBox())!;
          expect(box.y + box.height).toBeLessThanOrEqual(menu!.y);
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
      }
    }
    await page
      .getByRole('button', { name: 'The little book of sushi' })
      .click();
    await page.getByRole('searchbox').fill('Spoon');
    await expect(page.locator('.dish-guide')).toContainText(
      'first guest to your left',
    );
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'The little book of sushi' }),
    ).toBeFocused();
    await page.getByRole('button', { name: 'Table settings' }).click();
    await page.getByLabel('Soft table sounds').uncheck();
    await page.getByLabel('Animate the table').uncheck();
    await page
      .getByRole('combobox', { name: 'Language', exact: true })
      .selectOption('es');
    await expect(
      page.getByRole('button', { name: 'Ajustes de la mesa' }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole('button', { name: 'Ajustes de la mesa' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Ajustes de la mesa' }).click();
    await expect(
      page.getByLabel('Sonidos suaves de la mesa'),
    ).not.toBeChecked();
    await expect(page.getByLabel('Animar la mesa')).not.toBeChecked();
    await capture(page, 'settings-spanish', info.project.name);
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
    await saveVideo(page, 'eight-seat-drafting', info.project.name);
  }
});

test('practice choices cover private Menu, copy, Takeout and Spoon with keyboard, unavailable audio and reduced motion', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    Object.defineProperty(window, 'AudioContext', {
      value: class {
        constructor() {
          throw new Error('Audio unavailable');
        }
      },
    });
  });
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/practice/sushi-go-party');
  await page.getByRole('button', { name: 'Table settings' }).click();
  await page
    .getByRole('combobox', { name: 'Guests', exact: true })
    .selectOption('2');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  async function scene(value: string) {
    await page.getByRole('button', { name: 'Table settings' }).click();
    await page
      .getByRole('combobox', { name: 'Try a moment', exact: true })
      .selectOption(value);
    await page.getByRole('button', { name: 'Close', exact: true }).click();
  }
  for (const value of ['menu', 'copy', 'takeout', 'spoon']) {
    await scene(value);
    const first = page.getByTestId('sgp-hand').locator('button').first();
    await first.focus();
    await page.keyboard.press('Enter');
    const copy = page.locator('.copy-choices select');
    if (await copy.count()) await copy.selectOption({ index: 1 });
    if (value === 'spoon')
      await page.locator('.utensil-choices button').first().click();
    await page.getByTestId('sgp-keep').click();
    await page.getByTestId('sgp-practice-others').click();
    if (value === 'menu')
      await expect(page.getByTestId('sgp-prompt-menu')).toBeVisible();
    if (value === 'takeout')
      await expect(page.getByTestId('sgp-prompt-takeout')).toBeVisible();
    if (value === 'spoon')
      await expect(page.getByTestId('sgp-prompt-spoon')).toBeVisible();
    await capture(page, `advanced-${value}`, info.project.name);
    await prompts([page]);
    await page.getByTestId('sgp-practice-others').click();
    await expect(page.locator('.sushi-passing-bundle')).toHaveCount(0);
  }
  expect(errors).toEqual([]);
  await saveVideo(page, 'advanced-prompts', info.project.name);
});

test('local language switch preserves a noninitial saved Menu offer and score', async ({
  page,
}, info) => {
  await page.goto('/practice/sushi-go-party');
  await page.getByRole('button', { name: 'Table settings' }).click();
  await page
    .getByRole('combobox', { name: 'Try a moment', exact: true })
    .selectOption('menu');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await select(page);
  await page.getByTestId('sgp-keep').click();
  await page.getByTestId('sgp-practice-others').click();
  await expect(page.getByTestId('sgp-prompt-menu')).toBeVisible();
  const snapshot = () =>
    page.evaluate(() => ({
      round: document.querySelector('.sushi-table')?.getAttribute('data-round'),
      turn: document.querySelector('.sushi-table')?.getAttribute('data-turn'),
      prompt: document.querySelector('.decision')?.getAttribute('data-prompt'),
      cards: [...document.querySelectorAll('.decision [data-handle]')].map(
        (c) => c.getAttribute('data-handle'),
      ),
      score: document.querySelector('.own-label strong')?.textContent,
    }));
  const before = await snapshot();
  expect(before.cards.length).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Table settings' }).click();
  await page
    .getByRole('dialog')
    .getByRole('combobox', { name: 'Language', exact: true })
    .selectOption('es');
  await expect(
    page.getByRole('button', { name: 'Ajustes de la mesa' }),
  ).toBeVisible();
  expect(await snapshot()).toEqual(before);
  await expect(
    page.getByRole('heading', { name: 'Elegí un plato nuevo' }),
  ).toBeVisible();
  await capture(page, 'spanish-preserved-offer', info.project.name);
  await page.locator('.decision .choice-cards>button').first().click();
  await expect(page.locator('.sushi-table')).toHaveAttribute('data-turn', '2');
  await saveVideo(page, 'local-language', info.project.name);
});

test('all 26 illustrated lessons teach three distinct frames in English and Spanish', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  for (const locale of ['en', 'es']) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page
      .getByRole('combobox', { name: /^(Language|Idioma)$/ })
      .selectOption(locale);
    await page
      .locator('.game-names')
      .getByRole('button', { name: /Sushi Go Party/ })
      .click();
    await page
      .getByRole('button', {
        name: locale === 'en' ? 'Rules' : 'Reglas',
        exact: true,
      })
      .click();
    await expect(page.locator('.desktop-nav button')).toHaveCount(3);
    let count = 0;
    for (let chapter = 0; chapter < 3; chapter++) {
      await page.locator('.desktop-nav button').nth(chapter).click();
      for (const lesson of await page.locator('article[data-lesson]').all()) {
        count++;
        await lesson.locator('.example-toggle').click();
        const descriptions = new Set<string>();
        for (let step = 0; step < 3; step++) {
          const img = lesson.getByRole('img');
          await expect(img).toBeVisible();
          const caption = await lesson.locator('.frame-caption').textContent();
          expect(await img.getAttribute('aria-label')).toContain(
            caption!.trim(),
          );
          descriptions.add((await img.getAttribute('aria-label'))!);
          if (step < 2)
            await lesson.locator('.scenario-controls button').last().click();
        }
        expect(descriptions.size).toBe(3);
        if ((await lesson.getAttribute('data-lesson')) === 'onigiri') {
          await page.setViewportSize({ width: 360, height: 640 });
          webp(
            await lesson.getByRole('img').screenshot(),
            `${info.project.name}-lesson-onigiri-${locale}`,
          );
          expect(
            await page
              .getByRole('dialog')
              .evaluate((el) => el.scrollWidth <= el.clientWidth),
          ).toBe(true);
          await page.setViewportSize({ width: 1440, height: 900 });
        }
      }
    }
    expect(count).toBe(26);
    await page.keyboard.press('Escape');
  }
  await saveVideo(page, 'authored-lessons', info.project.name);
});

test('accepted motion uses seat paths and cancels on hide, resize and preferences without replay or hidden audio', async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    const state = {
      hidden: false,
      audio: 0,
      unlocks: 0,
      paths: [] as { frames: Keyframe[]; seats: number[][] }[],
    };
    Object.assign(window, { sushiReview: state });
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => state.hidden,
    });
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (frames, options) {
      if (this.classList.contains('sushi-passing-bundle')) {
        const root = this.parentElement!.getBoundingClientRect();
        state.paths.push({
          frames: frames as Keyframe[],
          seats: [...this.parentElement!.querySelectorAll('[data-seat]')].map(
            (el) => {
              const b = el.getBoundingClientRect();
              return [
                b.x + b.width / 2 - root.x - 15,
                b.y + b.height / 2 - root.y - 20,
              ];
            },
          ),
        });
      }
      return animate.call(this, frames, options);
    };
    Object.defineProperty(window, 'AudioContext', {
      value: class {
        state = 'running';
        currentTime = 0;
        destination = {};
        constructor() {
          state.unlocks++;
        }
        resume() {
          return Promise.resolve();
        }
        close() {
          return Promise.resolve();
        }
        createOscillator() {
          return {
            connect() {},
            disconnect() {},
            type: '',
            frequency: {
              setValueAtTime() {},
              exponentialRampToValueAtTime() {},
            },
            start() {
              state.audio++;
            },
            stop() {},
            onended: null,
          };
        }
        createGain() {
          return {
            connect() {},
            disconnect() {},
            gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
          };
        }
      },
    });
  });
  const stats = () => page.evaluate(() => (window as any).sushiReview);
  const visibility = async (hidden: boolean) => {
    await page.evaluate((hidden) => {
      (window as any).sushiReview.hidden = hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
  };
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/practice/sushi-go-party');
  expect((await stats()).unlocks).toBe(0);
  await page.getByRole('button', { name: 'Table settings' }).click();
  await page
    .getByRole('combobox', { name: 'Guests', exact: true })
    .selectOption('2');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  const turn = async () => {
    await select(page);
    await page.getByTestId('sgp-keep').click();
    await page.getByTestId('sgp-practice-others').click();
  };
  await turn();
  await expect(page.locator('.sushi-passing-bundle')).toHaveCount(2);
  const recorded = await stats();
  expect(recorded.unlocks).toBe(1);
  expect(recorded.audio).toBeGreaterThan(0);
  expect(recorded.paths).toHaveLength(2);
  for (const path of recorded.paths) {
    for (const frame of [path.frames[0], path.frames.at(-1)]) {
      expect(
        path.seats.some(([x, y]: number[]) =>
          frame.transform.startsWith(`translate(${x}px,${y}px)`),
        ),
      ).toBe(true);
    }
    expect(path.frames[0].transform).not.toBe(path.frames.at(-1).transform);
  }
  await visibility(true);
  await expect(page.locator('.sushi-passing-bundle,.reveal-card')).toHaveCount(
    0,
  );
  const hiddenAudio = (await stats()).audio;
  await turn();
  await page.waitForTimeout(850);
  expect((await stats()).audio).toBe(hiddenAudio);
  await expect(page.locator('.sushi-passing-bundle,.reveal-card')).toHaveCount(
    0,
  );
  await visibility(false);
  await expect(page.locator('.sushi-passing-bundle,.reveal-card')).toHaveCount(
    0,
  );
  await turn();
  await expect(page.locator('.sushi-passing-bundle')).toHaveCount(2);
  await page.setViewportSize({ width: 360, height: 640 });
  await expect(page.locator('.sushi-passing-bundle,.reveal-card')).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Table settings' }).click();
  await page.getByLabel('Soft table sounds').uncheck();
  await page.getByLabel('Animate the table').uncheck();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  const muted = (await stats()).audio;
  await turn();
  await page.waitForTimeout(850);
  await expect(page.locator('.sushi-passing-bundle,.reveal-card')).toHaveCount(
    0,
  );
  expect((await stats()).audio).toBe(muted);
  await capture(page, 'lifecycle-phone-640', info.project.name);
  await saveVideo(page, 'presentation-lifecycle', info.project.name);
});
