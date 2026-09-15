import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const evidence = resolve('artifacts/sushi-party-prototype');
test.use({ deviceScaleFactor: 1 });

test('static Party table: complete viewport, private hands, clockwise flow and deterministic pixels', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors: string[] = [];
  const connections: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('websocket', (socket) => connections.push(socket.url()));
  page.on('request', (request) => {
    if (request.url().includes('/socket.io')) connections.push(request.url());
  });
  await page.route('**/socket.io/**', (route) => route.abort());
  await page.goto('/prototype/sushi-go-party');
  await expect(page.locator('.party-board')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);

  await expect(page.locator('[data-player]')).toHaveCount(5);
  await expect(page.locator('[data-score-pawn]')).toHaveCount(5);
  await expect(page.locator('[data-menu-kind]')).toHaveCount(8);
  await expect(page.locator('[data-public-card]')).toHaveCount(15);
  await expect(page.locator('.newly-played')).toHaveCount(5);
  await expect(page.locator('.local-hand button')).toHaveCount(6);
  await expect(
    page.locator('.local-hand [aria-pressed="true"]'),
  ).toHaveAccessibleName('Select maki 1');
  await expect(page.locator('.round-pick')).toHaveText('Round 2·Pick 3 / 9');
  await expect(page.locator('[data-menu-kind] p')).toHaveText([
    'Egg 1, Salmon 2,Squid 3',
    'Most 6,second 3',
    'Pair = 5',
    'Set of 3 = 10',
    '1 / 3 / 6 / 10 / 15',
    'Play two cardson a later turn',
    'Next Nigiri ×3',
    'End game: most +6,fewest −6',
  ]);

  const scores = { marina: 47, kai: 7, sakura: 13, tomas: 17, emi: 32 };
  for (const [id, score] of Object.entries(scores)) {
    await expect(page.locator(`[data-score-pawn="${id}"]`)).toHaveAttribute(
      'data-score',
      String(score),
    );
    await expect(page.locator(`[data-player="${id}"] .score`)).toContainText(
      String(score),
    );
  }
  for (const [from, to] of [
    ['marina', 'kai'],
    ['kai', 'sakura'],
    ['sakura', 'tomas'],
    ['tomas', 'emi'],
    ['emi', 'marina'],
  ]) {
    const bundle = page.locator(`[data-pass-from="${from}"]`);
    await expect(bundle).toHaveAttribute('data-pass-to', to);
    await expect(bundle.getByRole('img')).toHaveAccessibleName(
      '6 hidden cards',
    );
    await expect(bundle.locator('.card-back')).toHaveCount(3);
    await expect(bundle.locator('.playing-card')).toHaveCount(0);
  }
  for (const seat of await page.locator('.player-seat').all()) {
    await expect(seat.locator('.hidden-hand')).toHaveAccessibleName(
      '6 hidden cards',
    );
    await expect(seat.locator('.hidden-hand .playing-card')).toHaveCount(0);
  }

  expect(
    await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
    })),
  ).toEqual({ width: 1440, height: 900 });
  for (const element of await page
    .locator(
      '.local-hand button, .primary-action, [data-menu-kind] p, [data-score-pawn], .local-tableau, .seat-info, .seat-cards',
    )
    .all()) {
    const box = (await element.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(1440);
    expect(box.y + box.height).toBeLessThanOrEqual(900);
  }
  for (const target of await page
    .locator('.local-hand button, .primary-action')
    .all()) {
    const box = (await target.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(
      await target.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return el.contains(
          document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
        );
      }),
    ).toBe(true);
  }
  for (const rule of await page.locator('[data-menu-kind] p').all()) {
    expect(
      await rule.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
    ).toBeGreaterThanOrEqual(13);
  }

  mkdirSync(evidence, { recursive: true });
  const name = info.project.name;
  const screenshot = await page.screenshot({
    animations: 'disabled',
    path: `${evidence}/${name}-1440x900.png`,
  });
  // Include the raised pawn heads and the board's contact shadow.
  await page.screenshot({
    animations: 'disabled',
    path: `${evidence}/${name}-board.png`,
    clip: { x: 300, y: 132, width: 870, height: 528 },
  });
  await page
    .locator('[data-player="kai"]')
    .screenshot({
      animations: 'disabled',
      path: `${evidence}/${name}-opponent.png`,
    });
  await page.screenshot({
    animations: 'disabled',
    path: `${evidence}/${name}-local-hand.png`,
    clip: { x: 153, y: 671, width: 1120, height: 225 },
  });

  // This prototype permits selection, but never commits a game action.
  await page
    .getByRole('button', { name: 'Select sashimi', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('button', { name: 'Select sashimi', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page
    .getByRole('button', { name: 'Keep this dish', exact: true })
    .click();
  await expect(page.locator('.newly-played')).toHaveCount(5);
  await page.mouse.move(1420, 880);
  await page.reload();
  await expect(page.locator('.party-board')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const repeat = await page.screenshot({
    animations: 'disabled',
    path: `${evidence}/${name}-repeat.png`,
  });
  const hash = (png: Buffer) => createHash('sha256').update(png).digest('hex');
  if (name === 'chromium') expect(hash(repeat)).toBe(hash(screenshot));
  else {
    // WebKit rounds composited shadows by one, and the skewed tile edge can
    // differ in up to 11 pixels by seven. Keep this allowance tightly bounded
    // (16 of 1,296,000 pixels), not a broad screenshot-diff percentage.
    const difference = await page.evaluate(
      async ([before, after]) => {
        async function pixels(base64: string) {
          const img = new Image();
          img.src = `data:image/png;base64,${base64}`;
          await img.decode();
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const context = canvas.getContext('2d')!;
          context.drawImage(img, 0, 0);
          return context.getImageData(0, 0, img.width, img.height).data;
        }
        const a = await pixels(before),
          b = await pixels(after);
        let maximum = 0,
          edgePixels = 0;
        for (let i = 0; i < a.length; i += 4) {
          let delta = 0;
          for (let channel = 0; channel < 4; channel++)
            delta = Math.max(delta, Math.abs(a[i + channel] - b[i + channel]));
          maximum = Math.max(maximum, delta);
          if (delta > 1) edgePixels++;
        }
        return { maximum, edgePixels };
      },
      [screenshot.toString('base64'), repeat.toString('base64')],
    );
    expect(difference.maximum).toBeLessThanOrEqual(8);
    expect(difference.edgePixels).toBeLessThanOrEqual(16);
  }
  expect(errors).toEqual([]);
  expect(connections).toEqual([]);
});
