import { test, expect, type Page } from '@playwright/test';
async function ready(page: Page) {
  await page
    .getByRole('button', { name: 'Start practice', exact: true })
    .click();
  await expect(page.locator('.own-tile')).toBeEnabled();
}
async function preview(page: Page) {
  await expect(page.locator('.own-tile')).toBeEnabled();
  await page.locator('.map').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.ghost')).toBeVisible();
}
async function place(page: Page) {
  await preview(page);
  await page.getByRole('button', { name: 'Place tile', exact: true }).click();
}
async function settings(page: Page) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
}
async function closeSettings(page: Page) {
  await page.getByRole('button', { name: 'Close', exact: true }).click();
}
test('practice supports rotation, feature choices, scoring, final results and reset', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/practice/carcassonne');
  await ready(page);
  await preview(page);
  const rotation = page.locator('.ghost .rotating');
  const beforeRotation = await rotation.getAttribute('style');
  await page.getByRole('button', { name: 'Rotate right', exact: true }).click();
  await expect(rotation).not.toHaveAttribute('style', beforeRotation!);
  for (let i = 0; i < 18; i++) {
    await place(page);
    const meeple = page
      .locator('.loose-meeple:not([aria-disabled="true"])')
      .first();
    if (await meeple.count()) {
      await meeple.click();
      await page.locator('[data-legal]').first().focus();
      await page.keyboard.press('Enter');
    } else
      await page
        .getByRole('button', { name: 'Place no meeple', exact: true })
        .click();
  }
  await expect(
    page.getByRole('heading', { name: /Winner|Shared victory/ }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Table journal', exact: true })
    .click();
  await expect(page.locator('.journal')).toBeVisible();
  await page.screenshot({ path: info.outputPath('carcassonne-final.png') });
  expect(errors).toEqual([]);
  await page
    .getByRole('button', { name: 'New practice game', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Your countryside, your rules' }),
  ).toBeVisible();
});
test('360px touch layout, keyboard placement, zoom, mute and help', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/practice/carcassonne');
  await ready(page);
  await settings(page);
  await page.getByRole('button', { name: 'Sound · On', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Sound · Off', exact: true }),
  ).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await page
    .getByRole('button', { name: 'Fit landscape', exact: true })
    .click();
  await page.locator('.map').focus();
  await page.keyboard.press('ArrowRight');
  for (
    let i = 0;
    i < 4 &&
    (await page
      .getByRole('button', { name: 'Place tile', exact: true })
      .isDisabled());
    i++
  )
    await page.keyboard.press('r');
  await page.keyboard.press('Enter');
  await expect(page.locator('.hand-actions')).toBeVisible();
  await page
    .getByRole('button', { name: 'Place no meeple', exact: true })
    .click();
  await settings(page);
  await page.getByRole('button', { name: 'How to play', exact: true }).click();
  await expect(page.locator('.guide-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.guide-dialog')).not.toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);
  await page.screenshot({ path: info.outputPath('carcassonne-mobile.png') });
  await settings(page);
  await page
    .getByRole('button', { name: 'New practice game', exact: true })
    .click();
  await closeSettings(page);
  await page.getByRole('button', { name: 'Full Big Box', exact: true }).click();
  await ready(page);
  const pieces = await page.locator('.hand button').evaluateAll((es) =>
    es.map((e) => ({
      left: e.getBoundingClientRect().left,
      right: e.getBoundingClientRect().right,
    })),
  );
  expect(pieces.every((r) => r.left >= 0 && r.right <= 360)).toBe(true);
});
test('setup cards, bare controls, guide and piece tooltips explain the game', async ({
  page,
}) => {
  await page.goto('/practice/carcassonne');
  await expect(page.locator('.setup input[type="checkbox"]')).toHaveCount(0);
  await expect(page.locator('.player-chips strong')).toHaveText([
    'Rose',
    'Azure',
    'Amber',
  ]);
  await page.getByRole('button', { name: 'Full Big Box', exact: true }).click();

  const guide = page.getByRole('button', { name: 'Game guide', exact: true });
  const settingsButton = page.getByRole('button', {
    name: 'Settings',
    exact: true,
  });
  await expect(guide).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(settingsButton).toHaveCSS(
    'background-color',
    'rgba(0, 0, 0, 0)',
  );
  await guide.click();
  await expect(
    page.getByRole('heading', { name: 'Build the countryside', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.module-guide article.active')).toHaveCount(12);
  await expect(page.locator('.guide-dialog')).toContainText('Large meeple');
  await expect(page.locator('.guide-dialog')).toContainText('Crop Circles');
  await page.getByRole('button', { name: 'Close', exact: true }).click();

  await ready(page);
  const firstPiece = page.locator('.piece-wrap').first();
  await firstPiece.hover();
  await expect(firstPiece.getByRole('tooltip')).toContainText(
    'Place it as a knight',
  );
  await firstPiece.getByRole('button').focus();
  await expect(firstPiece.getByRole('tooltip')).toBeVisible();
});
test('live board overview tracks public supplies and focuses useful features', async ({
  page,
}, info) => {
  await page.goto('/practice/carcassonne');
  await expect(
    page.getByRole('button', { name: 'Board overview', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Full Big Box', exact: true }).click();
  await ready(page);

  const overviewButton = page.getByRole('button', {
    name: 'Board overview',
    exact: true,
  });
  await expect(overviewButton).toHaveCSS(
    'background-color',
    'rgba(0, 0, 0, 0)',
  );
  await overviewButton.click();
  const dialog = page.locator('.overview-dialog');
  await expect(dialog).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Board overview', exact: true }),
  ).toBeVisible();
  await expect(dialog.locator('.overview-player')).toHaveCount(3);
  const rose = dialog.locator('.overview-player').filter({ hasText: 'Rose' });
  await expect(rose).toContainText('7 available · 0 deployed');
  await expect(rose).toContainText('Wine');
  await expect(rose).toContainText('gold ingots');

  await dialog.getByRole('button', { name: 'Unclaimed', exact: true }).click();
  const feature = dialog.locator('.watched-feature').first();
  await expect(feature).toBeVisible();
  await page.screenshot({
    path: info.outputPath('carcassonne-overview-desktop.png'),
  });
  await feature.click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.inspection')).toBeVisible();
  await expect(page.locator('.map')).toBeFocused();

  await place(page);
  await page
    .getByRole('button', { name: 'Place no meeple', exact: true })
    .click();
  await overviewButton.click();
  await expect(rose).toContainText('1 tiles placed');

  await page.setViewportSize({ width: 360, height: 800 });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Mine', exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Rivals', exact: true }),
  ).toBeVisible();
  expect(
    await dialog.evaluate((element) => element.getBoundingClientRect().right),
  ).toBeLessThanOrEqual(360);
  await page.screenshot({
    path: info.outputPath('carcassonne-overview-mobile.png'),
  });
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});
test('multiplayer setup is shared, placements survive reconnect and future order is private', async ({
  browser,
}) => {
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
  ]);
  try {
    const [a, b] = await Promise.all(contexts.map((c) => c.newPage()));
    await a.goto('/');
    await a
      .locator('.game-names')
      .getByRole('button', { name: /Carcassonne/ })
      .click();
    await a.getByRole('button', { name: 'Start game', exact: true }).click();
    await a
      .getByRole('textbox', { name: 'Your name', exact: true })
      .fill('Ada');
    await a.getByRole('button', { name: /Create room/ }).click();
    await expect(a).toHaveURL(/\/room\//);
    await b.goto(a.url());
    await b.getByRole('textbox').fill('Bea');
    await b.getByRole('button', { name: /Join/, exact: false }).click();
    await a.getByRole('button', { name: 'Start game', exact: true }).click();
    await expect(
      b.getByText('The host is choosing the shared game setup.'),
    ).toBeVisible();
    await expect(
      b.getByRole('button', { name: 'Base', exact: true }),
    ).toBeDisabled();
    await a.getByRole('button', { name: 'Base', exact: true }).click();
    await expect(
      b.getByRole('button', { name: 'Base', exact: true }),
    ).toHaveClass(/chosen/);
    await expect(a.locator('.player-chips strong')).toHaveText(['Ada', 'Bea']);
    await expect(b.locator('.player-chips strong')).toHaveText(['Ada', 'Bea']);
    await Promise.all([
      a.getByRole('button', { name: 'Ready to explore', exact: true }).click(),
      b.getByRole('button', { name: 'Ready to explore', exact: true }).click(),
    ]);
    await place(a);
    await a
      .getByRole('button', { name: 'Place no meeple', exact: true })
      .click();
    await expect(b.locator('.own-tile')).toBeVisible();
    const before = await b.locator('.own-tile').innerHTML();
    await b.reload();
    await expect(b.locator('.own-tile')).toBeVisible();
    expect(await b.locator('.own-tile').innerHTML()).toBe(before);
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});

test('expansion practice exposes ferry, gold, magic and message choices', async ({
  page,
}) => {
  await page.goto('/practice/carcassonne');
  for (const [scenario, heading] of [
    ['ferries', 'Leave your mark'],
    ['gold', 'Place the second gold ingot'],
    ['magic', 'Move a magic figure'],
  ]) {
    await settings(page);
    await page
      .getByRole('combobox', { name: 'Full match', exact: true })
      .selectOption(scenario);
    await closeSettings(page);
    await place(page);
    if (scenario !== 'ferries')
      await expect(
        page.getByRole('heading', { name: heading, exact: true }),
      ).toBeVisible();
    if (scenario === 'ferries') {
      await page
        .getByRole('button', { name: 'Place no meeple', exact: true })
        .click();
      await expect(
        page.getByRole('heading', { name: 'Connect two ferry arms' }),
      ).toBeVisible();
    }
    await page.locator('.choices button').first().click();
  }
  await settings(page);
  await page
    .getByRole('combobox', { name: 'Full match', exact: true })
    .selectOption('messages');
  await closeSettings(page);
  await page.locator('.choices button').first().click();
  await expect(
    page.getByRole('heading', { name: 'A message from the queen' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Resolve message', exact: true })
    .click();
  await expect(page.locator('.turn-line')).toContainText('Rose');
});
test('paper and wood sounds have no oscillators; mute persists and unavailable audio permits play', async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).textures = [];
    AudioContext.prototype.createOscillator = function () {
      throw Error('Pitched beep forbidden');
    };
    const create = AudioContext.prototype.createBiquadFilter;
    AudioContext.prototype.createBiquadFilter = function () {
      const filter = create.call(this);
      const connect = filter.connect.bind(filter);
      filter.connect = ((...args: any[]) => {
        (window as any).textures.push(filter.frequency.value);
        return (connect as any)(...args);
      }) as any;
      return filter;
    };
  });
  await page.goto('/practice/carcassonne');
  await ready(page);
  await preview(page);
  await page.evaluate(() => ((window as any).textures = []));
  await page.getByRole('button', { name: 'Rotate right', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).textures))
    .toEqual([2100]);
  await page.evaluate(() => ((window as any).textures = []));
  await place(page);
  await expect
    .poll(() => page.evaluate(() => (window as any).textures.length))
    .toBeGreaterThan(1);
  expect(await page.evaluate(() => (window as any).textures)).toContain(190);
  await settings(page);
  await page.getByRole('button', { name: 'Sound · On', exact: true }).click();
  await page.reload();
  await settings(page);
  await expect(
    page.getByRole('button', { name: 'Sound · Off', exact: true }),
  ).toHaveAttribute('aria-pressed', 'false');
  await page.addInitScript(() =>
    Object.defineProperty(window, 'AudioContext', {
      value: class {
        constructor() {
          throw Error('Unavailable');
        }
      },
    }),
  );
  await page.reload();
  await ready(page);
  await place(page);
  await page
    .getByRole('button', { name: 'Place no meeple', exact: true })
    .click();
  await expect(page.locator('.turn-line')).toContainText('Turn 2');
});
test('Spanish setup and expansion labels fit a phone', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/practice/carcassonne');
  await settings(page);
  await page
    .getByRole('combobox', { name: 'Language', exact: true })
    .selectOption('es');
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('heading', { name: 'El paisaje, a tu manera' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Big Box completo', exact: true })
    .click();
  await expect(page.locator('.setup')).toContainText('100–120');
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);
  await page.screenshot({ path: info.outputPath('carcassonne-spanish.png') });
  await page
    .getByRole('button', { name: 'Comenzar práctica', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Resumen del tablero', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Resumen del tablero', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Sin reclamar', exact: true }),
  ).toBeVisible();
});

async function dragTo(
  page: Page,
  source: import('@playwright/test').Locator,
  x: number,
  y: number,
) {
  const r = (await source.boundingBox())!;
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 12 });
}
test('physical tile and meeple drag, legal hints, rotate in place and invalid return', async ({
  page,
}, info) => {
  await page.goto('/practice/carcassonne');
  await ready(page);
  await expect(page.locator('[data-location]')).toHaveCount(0);
  const start = await page
    .locator('.tile-surface > g > rect')
    .first()
    .boundingBox();
  const viewport = page.viewportSize()!;
  expect(
    Math.abs(start!.x + start!.width / 2 - viewport.width / 2),
  ).toBeLessThan(2);
  expect(
    Math.abs(start!.y + start!.height / 2 - viewport.height / 2),
  ).toBeLessThan(2);
  const tile = page.locator('.own-tile');
  await tile.click();
  await expect(page.locator('[data-location]').first()).toBeVisible();
  const target = (await page.locator('[data-location]').first().boundingBox())!;
  await dragTo(
    page,
    tile,
    target.x + target.width / 2,
    target.y + target.height / 2,
  );
  await expect(page.locator('.drag-piece')).toBeVisible();
  await page.mouse.up();
  await expect(page.locator('.ghost')).toBeVisible();
  const location = await page.locator('.ghost').getAttribute('transform');
  await page.getByRole('button', { name: 'Rotate right', exact: true }).click();
  await expect(page.locator('.ghost')).toHaveAttribute('transform', location!);
  await page.getByRole('button', { name: 'Rotate left', exact: true }).click();
  await settings(page);
  await expect(
    page.getByRole('combobox', { name: 'Full match', exact: true }),
  ).toBeVisible();
  await closeSettings(page);
  await expect(page.locator('.ghost')).toHaveAttribute('transform', location!);
  await page.getByRole('button', { name: 'Place tile', exact: true }).click();
  await expect(page.locator('[data-legal]')).toHaveCount(0);
  const meeple = page
    .locator('.loose-meeple:not([aria-disabled="true"])')
    .first();
  await meeple.click();
  await expect(page.locator('[data-legal]').first()).toBeVisible();
  await dragTo(page, meeple, 30, viewport.height / 2);
  await page.mouse.up();
  await expect(page.locator('.drag-piece.returning')).toBeVisible();
  await expect(page.locator('.drag-piece')).toHaveCount(0);
  await expect(page.locator('.turn-line')).toContainText('Turn 1');
  const region = (await page.locator('[data-legal]').first().boundingBox())!;
  await dragTo(
    page,
    meeple,
    region.x + region.width / 2,
    region.y + region.height / 2,
  );
  await page.mouse.up();
  await expect(page.locator('.turn-line')).toContainText('Turn 2');
  await expect(page.locator('.figure')).toHaveCount(1);
  await expect(page.locator('[data-location]')).toHaveCount(0);
  await expect(page.locator('.settings-dialog')).not.toBeVisible();
  await expect
    .poll(async () =>
      Math.abs(
        (await page
          .locator('.player.self')
          .evaluate((el) => parseFloat(getComputedStyle(el).top))) -
          viewport.height * 0.96,
      ),
    )
    .toBeLessThan(1);
  await page.screenshot({ path: info.outputPath('carcassonne-drag-play.png') });
});

test('cancelled drag cannot place a tile and reset clears the local preview', async ({
  page,
}) => {
  await page.goto('/practice/carcassonne');
  await ready(page);
  await dragTo(page, page.locator('.own-tile'), 400, 300);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.locator('.drag-piece')).toHaveCount(0);
  await expect(page.locator('.ghost')).toHaveCount(0);
  await expect(page.locator('.tile-surface')).toHaveCount(1);
  await preview(page);
  await settings(page);
  await page
    .getByRole('button', { name: 'New practice game', exact: true })
    .click();
  await closeSettings(page);
  await ready(page);
  await expect(page.locator('.ghost')).toHaveCount(0);
  await expect(page.locator('[data-location]')).toHaveCount(0);
});

test('touch can pick up pieces and place them on legal targets', async ({
  browser,
}) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  try {
    const page = await context.newPage();
    await page.goto('/practice/carcassonne');
    await ready(page);
    await page.locator('.own-tile').tap();
    await page.locator('[data-location]').first().tap();
    await expect(page.locator('.ghost')).toBeVisible();
    await page.getByRole('button', { name: 'Place tile', exact: true }).tap();
    await page
      .locator('.loose-meeple:not([aria-disabled="true"])')
      .first()
      .tap();
    await page.locator('[data-legal]').first().tap();
    await expect(page.locator('.turn-line')).toContainText('Turn 2');
  } finally {
    await context.close();
  }
});
