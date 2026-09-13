import { test, expect } from '@playwright/test';

const additions = [
  { id: 'little-secret', name: 'Little Secret' },
  { id: 'azul', name: 'Azul' },
  { id: 'codenames', name: 'Codenames' },
  { id: 'sushi-go-party', name: 'Sushi Go Party' },
];

test('seven-game library opens each new bilingual illustrated guide and local practice', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.game-names button')).toHaveCount(7);
  for (const game of additions) {
    const button = page
      .locator('.game-names')
      .getByRole('button', { name: new RegExp(game.name) });
    await button.click();
    await expect(page.locator('.box-stage')).toHaveAttribute(
      'data-selected',
      game.id,
    );
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    await expect(page.locator('.rulebook')).toBeVisible();
    await page.locator('.example-toggle').first().click();
    await expect(
      page.locator('.scenario').first().getByRole('img'),
    ).toBeVisible();
    await page
      .locator('.scenario-controls')
      .first()
      .getByRole('button', { name: /Next/ })
      .click();
    await expect(page.locator('.frame-label').first()).toContainText(
      'Step 2 of 3',
    );
    await page.keyboard.press('Escape');
    await expect(
      page.getByRole('button', { name: 'Rules', exact: true }),
    ).toBeFocused();
    await page.getByRole('button', { name: 'Start game', exact: true }).click();
    await page.getByRole('link', { name: /Try on your own/ }).click();
    await expect(page).toHaveURL(new RegExp(`/practice/${game.id}`));
    await page.goto('/');
  }
  await page
    .getByRole('combobox', { name: 'Language', exact: true })
    .selectOption('es');
  for (const game of additions) {
    await page
      .locator('.game-names')
      .getByRole('button', { name: new RegExp(game.name) })
      .click();
    await page.getByRole('button', { name: 'Reglas', exact: true }).click();
    await expect(page.locator('.rulebook')).toBeVisible();
    await page.locator('.example-toggle').first().click();
    await expect(page.locator('.frame-label').first()).toContainText(
      'Paso 1 de 3',
    );
    await page.keyboard.press('Escape');
  }
  expect(errors).toEqual([]);
});

test('all seven covers fit desktop, tablet and phones with keyboard and touch-sized selectors', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const [width, height] of [
    [1440, 900],
    [768, 1024],
    [390, 844],
    [360, 640],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    const names = page.locator('.game-names button');
    await expect(names).toHaveCount(7);
    for (let i = 0; i < 7; i++) {
      await names.nth(i).focus();
      await page.keyboard.press('Enter');
      await expect(names.nth(i)).toHaveAttribute('aria-pressed', 'true');
      expect((await names.nth(i).boundingBox())!.height).toBeGreaterThanOrEqual(
        44,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.screenshot({
      path: test.info().outputPath(`seven-game-library-${width}.png`),
      fullPage: true,
    });
    if (width === 1440)
      expect(
        await page.evaluate(
          () => document.documentElement.scrollHeight <= innerHeight,
        ),
      ).toBe(true);
  }
});
