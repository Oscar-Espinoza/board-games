import { test, expect, type Page } from '@playwright/test';

async function observeEffects(page: Page) {
  await page.addInitScript(() => {
    const log = {
      flights: [] as {
        kind: string;
        text: string;
        width: number;
        moved: boolean;
        cardRatio: number;
        uniformScale: boolean;
        seatFlight: boolean;
        retainedDiscard: boolean;
      }[],
      sounds: 0,
    };
    (window as any).__unoEffects = log;
    new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes) {
          if (
            !(node instanceof HTMLElement) ||
            !node.classList.contains('uno-flight')
          )
            continue;
          const transforms = (node.getAnimations()[0]?.effect as KeyframeEffect)
            .getKeyframes()
            .map((frame) => new DOMMatrix(String(frame.transform)));
          const entry = {
            cardRatio: node.offsetWidth / node.offsetHeight,
            uniformScale: transforms.every(
              (matrix) =>
                Math.abs(
                  Math.hypot(matrix.a, matrix.b) -
                    Math.hypot(matrix.c, matrix.d),
                ) < 0.001,
            ),
            seatFlight: transforms.some(
              (matrix) => Math.hypot(matrix.a, matrix.b) < 0.6,
            ),
            kind: node.dataset.flight!,
            text: node.textContent ?? '',
            width: node.getBoundingClientRect().width,
            moved: false,
            retainedDiscard: false,
          };
          log.flights.push(entry);
          const initial = node.getBoundingClientRect();
          setTimeout(() => {
            const next = node.getBoundingClientRect();
            const underlay = document.querySelector('.uno-pile-underlay');
            entry.retainedDiscard =
              !!underlay && getComputedStyle(underlay).visibility === 'visible';
            entry.moved =
              Math.abs(next.x - initial.x) + Math.abs(next.y - initial.y) > 5;
          }, 150);
        }
    }).observe(document, { childList: true, subtree: true });
    const Audio = window.AudioContext ?? (window as any).webkitAudioContext;
    if (Audio) {
      const original = Audio.prototype.createBufferSource;
      Audio.prototype.createBufferSource = function () {
        const source = original.call(this);
        const start = source.start.bind(source);
        source.start = (...args: any[]) => {
          log.sounds++;
          return start(...args);
        };
        return source;
      };
    }
  });
}
async function solo(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Play solo/ }).click();
  await expect(page.locator('.uno-table')).toBeVisible();
}

test('solo table fills viewport, assigns chairs, animates draws and plays with optional sound', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await observeEffects(page);
  await solo(page);
  await expect(page.locator('.seat')).toHaveCount(4);
  for (const position of ['north', 'east', 'south', 'west'])
    await expect(
      page.locator(`[data-position="${position}"] .chair`),
    ).toBeAttached();
  const box = await page.locator('.uno-table').boundingBox();
  expect(box?.width).toBe(page.viewportSize()!.width);
  expect(box?.height).toBe(page.viewportSize()!.height);
  await expect(
    page.getByRole('button', { name: /Declare UNO/ }),
  ).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.hand .card')).toHaveCount(7);
  await page.locator('.stock').click();
  await expect(page.locator('.hand .card')).toHaveCount(8);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).__unoEffects.flights.filter(
            (f: any) => f.kind === 'draw' && f.moved,
          ).length,
      ),
    )
    .toBeGreaterThan(0);
  expect(
    await page.evaluate(() =>
      (window as any).__unoEffects.flights
        .filter((f: any) => f.kind === 'draw')
        .every((f: any) => f.text.includes('UNO')),
    ),
  ).toBe(true);
  await expect
    .poll(() => page.evaluate(() => (window as any).__unoEffects.sounds))
    .toBeGreaterThan(0);
  // Computer opponents resolve their own turns and return control to the human.
  for (let tries = 0; tries < 8; tries++) {
    await expect
      .poll(
        async () =>
          (await page.locator('.stock').isEnabled()) ||
          (await page.locator('.hand .card.playable:not(:disabled)').count()) >
            0,
        { timeout: 20_000 },
      )
      .toBe(true);
    if (await page.locator('.hand .card.playable:not(:disabled)').count())
      break;
    await page.locator('.stock').click();
  }
  await expect(
    page.locator('.hand .card.playable:not(:disabled)').first(),
  ).toBeEnabled();
  const playableCard = page
    .locator('.hand .card.playable:not(:disabled)')
    .first();
  await page.mouse.move(0, 0);
  const cardColor = await playableCard.evaluate(
    (card) => getComputedStyle(card).backgroundColor,
  );
  await playableCard.hover();
  await expect(playableCard).toHaveCSS('background-color', cardColor);
  await expect(page.locator('.uno-flight')).toHaveCount(0);
  const previousPlays = await page.evaluate(
    () =>
      (window as any).__unoEffects.flights.filter((f: any) => f.kind === 'play')
        .length,
  );
  const previousDiscard = await page.locator('.piles .discard').textContent();
  await page.locator('.hand .card.playable:not(:disabled)').first().click();
  await expect(page.locator('.uno-pile-underlay')).toHaveText(previousDiscard!);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).__unoEffects.flights.filter(
            (f: any) => f.kind === 'play' && f.moved,
          ).length,
      ),
    )
    .toBeGreaterThan(previousPlays);
  expect(
    await page.evaluate(() =>
      (window as any).__unoEffects.flights
        .filter((f: any) => f.kind === 'play' && f.moved)
        .every((f: any) => f.retainedDiscard),
    ),
  ).toBe(true);
  // Opponent flights start/end at a small seat anchor, but retain a full
  // card's layout and uniform scaling at every animation keyframe.
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).__unoEffects.flights.some((f: any) => f.seatFlight),
      ),
    )
    .toBe(true);
  expect(
    await page.evaluate(() =>
      (window as any).__unoEffects.flights.every(
        (f: any) => f.cardRatio > 0.65 && f.cardRatio < 0.71 && f.uniformScale,
      ),
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Sound', exact: true }).click();
  const sounds = await page.evaluate(() => (window as any).__unoEffects.sounds);
  await page.getByRole('button', { name: 'Card motion', exact: true }).click();
  await expect(page.locator('.uno-flight')).toHaveCount(0);
  await expect(page.locator('.uno-pile-underlay')).toHaveCount(0);
  await expect(page.locator('.discard')).toBeVisible();
  await page.reload();
  await expect(page.locator('.uno-table')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Sound', exact: true }),
  ).toHaveAttribute('aria-pressed', 'false');
  await expect(
    page.getByRole('button', { name: 'Card motion', exact: true }),
  ).toHaveAttribute('aria-pressed', 'false');
  expect(sounds).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('touch-sized table respects reduced motion and retains usable stacks and hand', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await observeEffects(page);
  await solo(page);
  await expect(
    page.getByRole('button', { name: 'Card motion', exact: true }),
  ).toHaveAttribute('aria-pressed', 'false');
  await page.locator('.stock').click();
  await expect(page.locator('.hand .card')).toHaveCount(8);
  expect(
    await page.evaluate(() => (window as any).__unoEffects.flights.length),
  ).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(
    844,
  );
  await expect(page.getByRole('button', { name: /Declare UNO/ })).toBeVisible();
  const tools = await page.locator('header.table-tools').boundingBox();
  expect(tools!.y).toBeLessThan(60);
  expect(tools!.x).toBeGreaterThanOrEqual(0);
  expect(tools!.x + tools!.width).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'How to play', exact: true }).click();
  await expect(page.locator('.rules-panel')).toBeVisible();
  await page.getByRole('button', { name: 'How to play', exact: true }).click();
  await page.screenshot({
    path: test.info().outputPath('uno-phone.png'),
    fullPage: true,
  });
});
