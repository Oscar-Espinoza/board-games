import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const evidence = 'artifacts/sushi-party-migration';
test.use({ deviceScaleFactor: 1 });

async function capture(page: Page, browser: string, name: string) {
  mkdirSync(evidence, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: `${evidence}/${browser}-${name}.png`,
    animations: name === 'accepted-pass' ? 'allow' : 'disabled',
  });
}

test('approved five-player table is real gameplay, with rule tiles, settings, private picks and accepted passing', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/practice/sushi-go-party');
  await expect(page.locator('.sushi-table')).toHaveAttribute('data-round', '2');
  await expect(page.locator('.sushi-table')).toHaveAttribute('data-turn', '4');
  await expect(page.locator('[data-seat]')).toHaveCount(5);
  await expect(page.locator('[data-score-pawn]')).toHaveCount(5);
  await expect(page.locator('[data-menu-kind]')).toHaveCount(8);
  await expect(page.locator('.seat .tableau .dish')).toHaveCount(12);
  await expect(page.locator('.hidden-hand .food-card')).toHaveCount(0);
  await expect(page.getByTestId('sgp-hand').locator('button')).toHaveCount(6);
  await page
    .getByTestId('sgp-hand')
    .getByRole('button', { name: /^Maki/ })
    .click();
  await page.mouse.move(10, 880);
  await capture(page, info.project.name, 'desktop-1440x900');
  await page.screenshot({
    path: `${evidence}/${info.project.name}-board.png`,
    clip: { x: 300, y: 132, width: 870, height: 528 },
  });
  await page
    .locator('.seat')
    .first()
    .screenshot({ path: `${evidence}/${info.project.name}-opponent.png` });
  await page.screenshot({
    path: `${evidence}/${info.project.name}-local-hand.png`,
    clip: { x: 153, y: 671, width: 1120, height: 225 },
  });

  const before = await page
    .getByTestId('sgp-hand')
    .locator('button')
    .evaluateAll((buttons) =>
      buttons.map((b) => b.getAttribute('data-handle')),
    );
  const tile = page.getByRole('button', {
    name: 'Maki: Most 6, second 3',
    exact: true,
  });
  await tile.click();
  await expect(page.getByRole('searchbox')).toHaveValue('Maki');
  await expect(page.locator('.dish-guide')).toContainText('6/3 at 2–5');
  await capture(page, info.project.name, 'rules');
  await page.keyboard.press('Escape');
  await expect(tile).toBeFocused();

  await page
    .getByRole('button', { name: 'Table settings', exact: true })
    .click();
  await page.getByLabel('Soft table sounds').uncheck();
  await page.getByLabel('Animate the table').uncheck();
  await capture(page, info.project.name, 'settings');
  await page
    .getByRole('combobox', { name: 'Language', exact: true })
    .selectOption('es');
  await expect(
    page.getByRole('button', { name: 'Ajustes de la mesa', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.round-pick')).toContainText('Ronda 2');
  await expect(page.getByTestId('sgp-practice-others')).toHaveText(
    'Hacer que elijan las otras personas',
  );
  await expect(page.locator('[data-menu-kind="nigiri"]')).toContainText(
    'Huevo 1',
  );
  expect(
    await page
      .getByTestId('sgp-hand')
      .locator('button')
      .evaluateAll((buttons) =>
        buttons.map((b) => b.getAttribute('data-handle')),
      ),
  ).toEqual(before);
  await capture(page, info.project.name, 'spanish');
  await page.reload();
  await page
    .getByRole('button', { name: 'Ajustes de la mesa', exact: true })
    .click();
  await expect(page.getByLabel('Sonidos suaves de la mesa')).not.toBeChecked();
  await page
    .getByRole('combobox', { name: 'Idioma', exact: true })
    .selectOption('en');
  await page
    .getByRole('button', { name: 'Table settings', exact: true })
    .click();
  await page.getByLabel('Animate the table').check();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByTestId('sgp-practice-others')).toHaveText(
    'Let the other seats choose',
  );
  await page.getByTestId('sgp-hand').locator('button').nth(3).click();
  await page.getByTestId('sgp-keep').click();
  await expect(page.getByTestId('sgp-keep')).toBeDisabled();
  await expect(
    page.getByTestId('sgp-hand').locator('button:not(:disabled)'),
  ).toHaveCount(0);
  await expect(page.locator('.sushi-passing-bundle')).toHaveCount(0);
  await page.getByTestId('sgp-practice-others').click();
  await expect(page.locator('.sushi-table')).toHaveAttribute('data-turn', '5');
  await expect(page.locator('.sushi-passing-bundle')).toHaveCount(5);
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('.sushi-passing-bundle')) {
      for (const animation of el.getAnimations()) {
        animation.pause();
        animation.currentTime = 450;
      }
    }
  });
  await capture(page, info.project.name, 'accepted-pass');
  await page.setViewportSize({ width: 1439, height: 900 });
  await expect(page.locator('.sushi-passing-bundle')).toHaveCount(0);
  await expect(page.getByTestId('sgp-hand').locator('button')).toHaveCount(5);
  expect(errors).toEqual([]);
});

test('all seat counts and compact screens keep game information and controls usable', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/practice/sushi-go-party');
  for (let count = 2; count <= 8; count++) {
    await page
      .getByRole('button', { name: 'Table settings', exact: true })
      .click();
    await page
      .getByRole('combobox', { name: 'Guests', exact: true })
      .selectOption(String(count));
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.locator('.friend-plate')).toHaveCount(count - 1);
    await expect(page.locator('[data-score-pawn]')).toHaveCount(count);
    await page.getByTestId('sgp-hand').locator('button').first().click();
    for (const el of await page
      .locator(
        '.seat-info, .seat-cards, .confirmation .primary, .hand>.selected, .corner',
      )
      .all()) {
      const box = (await el.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(1440);
      expect(box.y + box.height).toBeLessThanOrEqual(900);
    }
    if ([2, 5, 8].includes(count))
      await capture(page, info.project.name, `${count}-seats`);
  }
  for (const [width, height] of [
    [768, 1024],
    [390, 844],
    [360, 640],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(page.locator('.friend-plate')).toHaveCount(7);
    await expect(page.locator('.selection-details')).not.toBeVisible();
    const trays = await page.locator('.friend-plate').all();
    const advance = (await page
      .getByTestId('sgp-practice-others')
      .boundingBox())!;
    const boxes = await Promise.all(trays.map((tray) => tray.boundingBox()));
    const separate = (
      a: NonNullable<(typeof boxes)[number]>,
      b: NonNullable<(typeof boxes)[number]>,
    ) =>
      a.x + a.width <= b.x ||
      b.x + b.width <= a.x ||
      a.y + a.height <= b.y ||
      b.y + b.height <= a.y;
    for (let i = 0; i < boxes.length; i++) {
      expect(separate(boxes[i]!, advance)).toBe(true);
      for (let j = i + 1; j < boxes.length; j++)
        expect(separate(boxes[i]!, boxes[j]!)).toBe(true);
    }
    const keep = page.getByTestId('sgp-keep');
    const box = (await keep.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(height);
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= innerWidth &&
          document.documentElement.scrollHeight <= innerHeight,
      ),
    ).toBe(true);
    await capture(page, info.project.name, `${width}x${height}`);
    await page
      .getByRole('button', { name: 'The little book of sushi', exact: true })
      .click();
    await expect(page.getByRole('searchbox')).toBeVisible();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
  }
  await page.getByTestId('sgp-keep').click();
  await page.getByTestId('sgp-practice-others').click();
  await expect(page.locator('.sushi-table')).toHaveAttribute('data-turn', '5');
});
