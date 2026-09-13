import { test, expect, type Page } from '@playwright/test';

async function setup(page: Page, scenario: string) {
  await page
    .getByRole('button', { name: 'Table settings', exact: true })
    .click();
  await page.getByLabel('Practice scenario').selectOption(scenario);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
}
async function fitted(page: Page) {
  const layout = await page.evaluate(() => {
    const surface = document.querySelector<HTMLElement>('.surface')!;
    const root = document.querySelector('.azul-table')!.getBoundingClientRect();
    const bounds = Array.from(
      document.querySelectorAll<HTMLElement>(
        '.surface .table-heading,.surface .opponent,.surface .factory,.surface .center-group,.surface .own-board,.surface .reserves,.surface .table-footer',
      ),
    ).map((e) => ({ name: e.className, r: e.getBoundingClientRect() }));
    return {
      width: surface.scrollWidth - surface.clientWidth,
      height: surface.scrollHeight - surface.clientHeight,
      outside: bounds
        .filter(
          ({ r }) =>
            r.x < root.x - 1 ||
            r.y < root.y - 1 ||
            r.right > root.right + 1 ||
            r.bottom > root.bottom + 1,
        )
        .map(({ name, r }) => ({
          name,
          x: r.x,
          y: r.y,
          w: r.width,
          h: r.height,
        })),
      body: document.documentElement.scrollHeight - innerHeight,
    };
  });
  expect(layout).toEqual({ width: 0, height: 0, outside: [], body: 0 });
  await page.locator('.surface').evaluate((e) => {
    e.scrollTop = 1000;
    e.scrollLeft = 1000;
  });
  expect(
    await page.locator('.surface').evaluate((e) => [e.scrollTop, e.scrollLeft]),
  ).toEqual([0, 0]);
}
for (const [width, height] of [
  [360, 640],
  [390, 844],
  [768, 1024],
  [1100, 700],
  [1440, 900],
  [720, 450],
  [1280, 720],
]) {
  test(`Azul fits without scrolling ${width}×${height}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height });
    await page.goto('/practice/azul');
    await page.evaluate(() => document.fonts.ready);
    for (const scenario of ['start2', 'start3', 'start4']) {
      await setup(page, scenario);
      await fitted(page);
    }
    await page.screenshot({ path: info.outputPath(`azul-fit-${width}.png`) });
    const factory = page
      .locator('.factory-open:enabled,.factory-tiles button:enabled')
      .first();
    await factory.click();
    if (await page.locator('.factory-picker').count()) {
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.locator('.factory-picker button[data-color]').first().click();
    }
    const line = page.getByRole('button', { name: /^Line 2 ·/ });
    expect((await line.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await line.click();
    await fitted(page);
    const confirm = page.getByRole('button', {
      name: 'Confirm tiles',
      exact: true,
    });
    const r = await confirm.boundingBox();
    expect(r!.y).toBeGreaterThanOrEqual(0);
    expect(r!.y + r!.height).toBeLessThanOrEqual(height);
    if (await page.getByRole('dialog').isVisible())
      expect(
        await page
          .getByRole('dialog')
          .evaluate((e) => e.scrollHeight - e.clientHeight),
      ).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: info.outputPath(`azul-fit-confirm-${width}.png`),
    });
    await confirm.click();
    await expect(page.locator('.azul-table')).toHaveAttribute(
      'data-game-revision',
      '1',
    );
    await expect(page.locator('.azul-flight')).toHaveCount(0);
    await fitted(page);
    await setup(page, 'overflow');
    await page
      .getByRole('button', {
        name: 'Take 4 · Blue diamond · Center',
        exact: true,
      })
      .click();
    await page.getByRole('button', { name: 'Floor line', exact: true }).click();
    await expect(page.locator('.confirmation:visible')).toContainText(
      '4 to discard',
    );
    await fitted(page);
    await page
      .getByRole('button', { name: 'Confirm tiles', exact: true })
      .click();
    await expect(page.locator('.azul-flight')).toHaveCount(0);
    await fitted(page);
  });
}

test('compact selection cancels and restores focus across layout changes', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/practice/azul');
  await page.locator('.factory-tiles button:enabled').first().click();
  await page.setViewportSize({ width: 360, height: 640 });
  await expect(page.locator('.confirmation:visible')).toHaveCount(0);
  const factory = page.locator('.factory-open:enabled').first();
  await factory.click();
  await page.locator('.factory-picker button[data-color]').first().click();
  await page
    .getByRole('button', { name: 'Cancel selection', exact: true })
    .click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(factory).toBeFocused();
  await factory.click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('.azul-table')).toHaveAttribute(
    'data-game-revision',
    '0',
  );
  await fitted(page);
});
