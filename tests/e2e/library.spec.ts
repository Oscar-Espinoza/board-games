import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
const manifest = JSON.parse(
  readFileSync(
    'apps/web/.svelte-kit/output/client/.vite/manifest.json',
    'utf8',
  ),
);
const games = ['UNO', 'Catan', 'Carcassonne'] as const;
async function select(page: Page, game: string) {
  await page
    .locator('.game-names')
    .getByRole('button', { name: new RegExp(game) })
    .click();
}
async function open(page: Page, game: string, panel = 'Rules') {
  await select(page, game);
  await page.getByRole('button', { name: panel, exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

test('boxes select with hover and keyboard; actions stay fixed; dialogs restore focus', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.primary-actions button')).toHaveCount(3);
  const button = page
    .locator('.game-names')
    .getByRole('button', { name: /Catan/ });
  const actions = await page.locator('.primary-actions').boundingBox();
  await button.hover();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.move(0, 0);
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await page
    .locator('.game-names')
    .getByRole('button', { name: /Carcassonne/ })
    .focus();
  await expect(page.locator('.box-stage')).toHaveAttribute(
    'data-selected',
    'carcassonne',
  );
  expect((await page.locator('.primary-actions').boundingBox())!.y).toBe(
    actions!.y,
  );
  for (const game of games) {
    await select(page, game);
    await page.waitForTimeout(420);
    await page.screenshot({
      path: test.info().outputPath(`library-${game.toLowerCase()}-desktop.png`),
      fullPage: true,
    });
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= innerHeight,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Summary', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Build a countryside');
  await page.screenshot({
    path: test.info().outputPath('library-summary-desktop.png'),
  });
  await page
    .getByRole('button', { name: 'Read the rules', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Carcassonne — Big Box 3.1' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Summary', exact: true }),
  ).toBeFocused();
});

for (const game of games)
  test(`${game} rulebook walks every scenario and stays independent of game clients`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const requests: string[] = [];
    const errors: string[] = [];
    page.on('request', (r) => requests.push(r.url()));
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await open(page, game);
    await expect(page.locator('.desktop-nav button').first()).toBeVisible();
    const chapters = await page.locator('.desktop-nav button').count();
    let lessons = 0;
    for (let c = 0; c < chapters; c++) {
      await page.locator('.desktop-nav button').nth(c).click();
      const articles = page.locator('.chapter-content article');
      const n = await articles.count();
      for (let i = 0; i < n; i++) {
        const article = articles.nth(i);
        await article.getByRole('button', { name: /See an example/ }).click();
        await expect(article.getByRole('img')).toBeVisible();
        if (
          game === 'Catan' &&
          (await article.getAttribute('data-lesson')) === 'production'
        ) {
          // A dice roll produces resources; it must not appear to create Bea's city.
          await expect(
            article.locator('svg text').filter({ hasText: /^Bea$/ }),
          ).toBeVisible();
        }
        await expect(article.locator('.frame-label')).toContainText(
          'Step 1 of 3',
        );
        const captions = [await article.locator('.frame-caption').innerText()];
        for (let step = 2; step <= 3; step++) {
          await article
            .getByRole('button', { name: 'Next', exact: false })
            .click();
          await expect(article.locator('.frame-label')).toContainText(
            `Step ${step} of 3`,
          );
          captions.push(await article.locator('.frame-caption').innerText());
        }
        expect(new Set(captions).size).toBe(3);
        await expect(
          article.getByRole('button', { name: 'Next', exact: false }),
        ).toBeDisabled();
        await article.getByRole('button', { name: /See an example/ }).click();
        await article.getByRole('button', { name: /See an example/ }).click();
        await expect(article.locator('.frame-label')).toContainText(
          'Step 3 of 3',
        );
        await article
          .getByRole('button', { name: 'Restart', exact: true })
          .click();
        await expect(article.locator('.frame-label')).toContainText(
          'Step 1 of 3',
        );
        await article.getByRole('button', { name: /See an example/ }).click();
        lessons++;
      }
    }
    expect(lessons).toBeGreaterThan(
      game === 'Carcassonne' ? 35 : game === 'Catan' ? 20 : 15,
    );
    await page.getByRole('searchbox').fill('zzznomatch');
    await expect(
      page.getByText('No rules found. Try a different word.'),
    ).toBeVisible();
    await page
      .getByRole('searchbox')
      .fill(
        game === 'Carcassonne'
          ? 'shield'
          : game === 'Catan'
            ? 'bank'
            : 'penalty',
      );
    await expect(
      page.locator('.chapter-content article').first(),
    ).toBeVisible();
    const forbidden = Object.entries(manifest)
      .filter(
        ([key]) =>
          key.includes('/games/') &&
          (key.includes('/src/') || key.includes('/assets/')),
      )
      .map(([, value]) => (value as { file: string }).file);
    expect(
      requests.filter(
        (url) =>
          forbidden.some((chunk) => url.endsWith(chunk)) ||
          url.endsWith('.wasm'),
      ),
    ).toEqual([]);
    expect(errors).toEqual([]);
  });

test('mobile and tablet layouts, Spanish content, touch, reduced motion and keyboard', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [768, 360]) {
    await page.setViewportSize({ width, height: width === 768 ? 1024 : 800 });
    await page.goto('/');
    await select(page, 'Catan');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: test.info().outputPath(`library-${width}.png`),
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Start game', exact: true }).click();
    await page.getByLabel('Your name').fill('Ada');
    await page.getByRole('button', { name: 'Beginner', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Beginner', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await page.screenshot({
      path: test.info().outputPath(`library-start-${width}.png`),
    });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    await expect(page.locator('.rulebook')).toBeVisible();
    if (width === 360) {
      await page.locator('.chapter-nav summary').click();
      await page
        .locator('.chapter-nav')
        .getByRole('button', { name: 'Build your network', exact: true })
        .click();
    }
    await page.locator('.example-toggle').first().click();
    await page
      .locator('.scenario-controls')
      .first()
      .getByRole('button', { name: /Next/ })
      .click();
    await page.screenshot({
      path: test.info().outputPath(`library-rule-${width}.png`),
    });
    expect(
      await page
        .getByRole('dialog')
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await page.keyboard.press('Escape');
  }
  await page
    .getByRole('combobox', { name: 'Language', exact: true })
    .selectOption('es');
  await expect(
    page.getByRole('heading', { name: '¿A qué jugamos?' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: '¿A qué jugamos?' }),
  ).toBeVisible();
  await select(page, 'Carcassonne');
  await page.getByRole('button', { name: 'Reglas', exact: true }).click();
  await expect(page.locator('.rulebook')).toBeVisible();
  await page.getByRole('searchbox').fill('escudo');
  await page.locator('.example-toggle').first().click();
  await expect(page.locator('.frame-label').first()).toContainText(
    'Paso 1 de 3',
  );
  await page.keyboard.press('Tab');
  expect(
    await page.evaluate(() => !!document.activeElement?.closest('dialog')),
  ).toBe(true);
  await page.keyboard.press('Escape');
});

test('practice links work without a room connection and invitation URLs still join', async ({
  page,
}) => {
  await page.route('**/socket.io/**', (route) => route.abort());
  await page.goto('/');
  await open(page, 'Catan', 'Start game');
  await page.getByRole('link', { name: /Try on your own/ }).click();
  await expect(page).toHaveURL(/practice\/catan/);
  await expect(page.locator('.catan')).toBeVisible();
  await page.goto('/');
  await open(page, 'Carcassonne', 'Start game');
  await page.getByRole('link', { name: /Try on your own/ }).click();
  await expect(page).toHaveURL(/practice\/carcassonne/);
  await expect(
    page.getByRole('heading', { name: 'Your countryside, your rules' }),
  ).toBeVisible();
  await page.unroute('**/socket.io/**');
  await page.goto('/');
  await page.getByRole('button', { name: /Join a room/ }).click();
  await page
    .getByRole('textbox')
    .fill('https://example.com/room/ABCDEF?invite=1');
  await page.getByRole('button', { name: /Join room/ }).click();
  await expect(page).toHaveURL(/room\/ABCDEF$/);
});

test('rulebook import failures retry and reopening another game cannot show stale content', async ({
  page,
}) => {
  await page.goto('/');
  const guideChunk = Object.entries(manifest).find(([key]) =>
    key.endsWith('/catalog/guides/uno.ts'),
  );
  expect(guideChunk).toBeTruthy();
  const file = (guideChunk![1] as { file: string }).file;
  await page.route(`**/${file}`, (route) =>
    route.fulfill({
      status: 503,
      contentType: 'text/plain',
      headers: { 'cache-control': 'no-store' },
      body: 'Temporarily unavailable',
    }),
  );
  await open(page, 'UNO');
  await expect(page.getByRole('alert')).toContainText(
    'The rulebook could not open',
  );
  await page.unroute(`**/${file}`);
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: /UNO — this app/ }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await open(page, 'Catan');
  await expect(
    page.getByRole('heading', { name: /Catan — base/ }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await page.reload();
  await open(page, 'UNO');
  await expect(
    page.getByRole('heading', { name: /UNO — this app/ }),
  ).toBeVisible();
});

test('touch selection and scenario controls work without hovering', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 360, height: 800 },
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await page.goto('/');
    for (const game of games) {
      await page
        .locator('.game-names')
        .getByRole('button', { name: new RegExp(game) })
        .tap();
      await expect(page.locator('.box-stage')).toHaveAttribute(
        'data-selected',
        game.toLowerCase(),
      );
    }
    await page.getByRole('button', { name: 'Rules', exact: true }).tap();
    await expect(page.locator('.rulebook')).toBeVisible();
    await page.locator('.example-toggle').first().tap();
    const example = page.locator('.scenario').first();
    await example.getByRole('button', { name: /Next/ }).tap();
    await expect(example.locator('.frame-label')).toContainText('Step 2 of 3');
    await page.getByRole('button', { name: 'Close', exact: true }).tap();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  } finally {
    await context.close();
  }
});

test('delayed guide loading cannot replace another game after closing', async ({
  page,
}) => {
  await page.goto('/');
  const chunk = Object.entries(manifest).find(([key]) =>
    key.endsWith('/catalog/guides/uno.ts'),
  )!;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route(
    `**/${(chunk[1] as { file: string }).file}`,
    async (route) => {
      await gate;
      await route.continue();
    },
  );
  await open(page, 'UNO');
  await expect(page.getByRole('status')).toContainText('Opening the rulebook');
  await page.keyboard.press('Escape');
  await open(page, 'Catan');
  await expect(
    page.getByRole('heading', { name: /Catan — base/ }),
  ).toBeVisible();
  release();
  await expect(
    page.getByRole('heading', { name: /Catan — base/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /UNO — this app/ }),
  ).toHaveCount(0);
});
