import { readFileSync } from 'node:fs';
import { test, expect, type Browser, type Page } from '@playwright/test';
const manifest = JSON.parse(
  readFileSync(
    'apps/web/.svelte-kit/output/client/.vite/manifest.json',
    'utf8',
  ),
);
const chunk = (game: string) =>
  manifest[`../../games/${game}/src/Board.svelte`].file;
async function create(page: Page, game: string, name: string) {
  await page.goto('/');
  await page
    .locator('.game-names')
    .getByRole('button', { name: new RegExp(game) })
    .click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await page.getByLabel('Your name').fill(name);
  await page.getByRole('button', { name: /Create room/ }).click();
  await expect(page).toHaveURL(/\/room\//);
  return page.url();
}
async function join(browser: Browser, url: string, name: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(url);
  await page.getByLabel('Your name').fill(name);
  await page.getByRole('button', { name: 'Join an available seat' }).click();
  await expect(page.locator('.roster')).toContainText(name);
  return { page, context };
}
test('catalog loads no game clients, English/Spanish persists', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'What shall we play?' }),
  ).toBeVisible();
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
  expect(
    requests.some(
      (url) =>
        url.endsWith(chunk('uno')) ||
        url.endsWith(chunk('catan')) ||
        url.endsWith(chunk('carcassonne')) ||
        url.includes('terrain-') ||
        url.endsWith('.wasm'),
    ),
  ).toBe(false);
});
test('UNO create/join/play/reload restores the same private hand', async ({
  page,
  browser,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const url = await create(page, 'UNO', 'Alice');
  const guest = await join(browser, url, 'Bob');
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page.locator('.uno-table')).toBeVisible();
  await expect(guest.page.locator('.uno-table')).toBeVisible();
  await expect(page.locator('.hand .card')).toHaveCount(7);
  await expect(guest.page.locator('.hand .card')).toHaveCount(7);
  await page.getByRole('button', { name: /^UNO Draw/ }).click();
  await expect(page.locator('.hand .card')).toHaveCount(8);
  const original = await page
    .locator('.hand .card')
    .evaluateAll((cards) =>
      cards.map((card) => card.getAttribute('aria-label')),
    );
  await page.reload();
  await expect(page.locator('.uno-table')).toBeVisible();
  await expect(page.locator('.hand .card')).toHaveCount(8);
  expect(
    await page
      .locator('.hand .card')
      .evaluateAll((cards) =>
        cards.map((card) => card.getAttribute('aria-label')),
      ),
  ).toEqual(original);
  await expect(guest.page.locator('.roster')).toContainText('Alice');
  expect(errors).toEqual([]);
  expect(requests.some((url) => url.endsWith(chunk('uno')))).toBe(true);
  expect(
    requests.some(
      (url) =>
        url.endsWith(chunk('catan')) ||
        url.endsWith(chunk('carcassonne')) ||
        url.endsWith('.wasm'),
    ),
  ).toBe(false);
  await guest.context.close();
});
test('Catan loads a playable variable setup for three friends', async ({
  page,
  browser,
}) => {
  const url = await create(page, 'Catan', 'Alice');
  const bob = await join(browser, url, 'Bob');
  const carol = await join(browser, url, 'Carol');
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page.locator('.table > svg')).toBeVisible();
  await expect(bob.page.locator('.table > svg')).toBeVisible();
  await expect(carol.page.locator('.table > svg')).toBeVisible();
  expect(
    await page
      .locator('.catan [data-position]')
      .evaluateAll((seats) =>
        seats.map((seat) => seat.getAttribute('data-position')).sort(),
      ),
  ).toEqual(['east', 'south', 'west']);
  await expect(page.locator('.board-container')).toContainText(
    /settlement|Settlement/i,
  );
  await bob.context.close();
  await carol.context.close();
});
test('Catan completes snake placement and accepts the first dice roll', async ({
  page,
  browser,
}) => {
  const url = await create(page, 'Catan', 'Alice');
  const guests = [
    await join(browser, url, 'Bob'),
    await join(browser, url, 'Carol'),
  ];
  const pages = [page, ...guests.map((guest) => guest.page)];
  const errors: string[] = [];
  for (const p of pages)
    p.on('pageerror', (error) => errors.push(error.message));
  await page.getByRole('button', { name: 'Start game' }).click();
  for (const p of pages) await expect(p.locator('.catan')).toBeVisible();
  for (let i = 0; i < 12; i++) {
    let actor: Page | undefined;
    await expect
      .poll(async () => {
        for (const p of pages)
          if (await p.locator('.target').count()) {
            actor = p;
            return true;
          }
        return false;
      })
      .toBe(true);
    const before = await actor!.locator('.phase').textContent();
    await actor!.locator('.target').first().focus();
    await actor!.keyboard.press('Enter');
    await actor!.getByRole('button', { name: 'Confirm', exact: true }).click();
    for (const p of pages)
      await expect(p.locator('.phase')).not.toHaveText(before!);
  }
  const actor = (
    await Promise.all(
      pages.map(async (p) =>
        (await p
          .getByRole('button', { name: 'Roll dice', exact: true })
          .count())
          ? p
          : null,
      ),
    )
  ).find(Boolean)!;
  const observer = pages.find((p) => p !== actor)!;
  await observer.context().setOffline(true);
  await expect(observer.locator('.connection')).toContainText('Reconnecting…');
  await observer.evaluate(() => {
    (window as any).replayed = 0;
    const original = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      if (this.closest('.catan')) (window as any).replayed++;
      return original.apply(this, args);
    };
  });
  await actor.getByRole('button', { name: 'Roll dice', exact: true }).click();
  await expect(
    actor.getByRole('button', { name: 'Roll dice', exact: true }),
  ).toHaveCount(0);
  await observer.context().setOffline(false);
  await expect(observer.locator('.connection')).toHaveText('Connected');
  await expect(observer.locator('.phase')).toHaveText(
    (await actor.locator('.phase').textContent())!,
  );
  expect(await observer.evaluate(() => (window as any).replayed)).toBe(0);
  for (const p of pages)
    await expect(p.locator('.catan .roster')).toContainText('2 points');
  expect(errors).toEqual([]);
  for (const guest of guests) await guest.context.close();
});
test('six-player beginner Catan advances to the paired action opportunity', async ({
  page,
  browser,
}) => {
  await page.goto('/');
  await page
    .locator('.game-names')
    .getByRole('button', { name: /Catan/ })
    .click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await page.getByLabel('Your name').fill('Alice');
  await page.getByRole('button', { name: 'Beginner', exact: true }).click();
  await page.getByRole('button', { name: /Create room/ }).click();
  await expect(page).toHaveURL(/\/room\//);
  const guests = [];
  for (const name of ['Bob', 'Carol', 'Dan', 'Eve', 'Frank'])
    guests.push(await join(browser, page.url(), name));
  const pages = [page, ...guests.map((g) => g.page)];
  await page.getByRole('button', { name: 'Start game' }).click();
  for (const p of pages) await expect(p.locator('.catan')).toBeVisible();
  expect(
    await page
      .locator('.catan [data-position]')
      .evaluateAll(
        (seats) =>
          new Set(seats.map((seat) => seat.getAttribute('data-position'))).size,
      ),
  ).toBe(6);
  const actor = (
    await Promise.all(
      pages.map(async (p) =>
        (await p
          .getByRole('button', { name: 'Roll dice', exact: true })
          .count())
          ? p
          : null,
      ),
    )
  ).find(Boolean)!;
  await actor.getByRole('button', { name: 'Roll dice', exact: true }).click();
  await expect(
    actor.getByRole('button', { name: 'Roll dice', exact: true }),
  ).toHaveCount(0);
  if ((await actor.locator('.phase').innerText()).includes('Move the robber')) {
    await actor.locator('.table > svg .target').first().focus();
    await actor.keyboard.press('Enter');
    await actor.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(actor.locator('.confirm')).toHaveCount(0);
    const steal = actor.getByRole('button', { name: /Steal from/ });
    if (await steal.count()) await steal.first().click();
  }
  await actor.getByRole('button', { name: 'End turn', exact: true }).click();
  for (const p of pages)
    await expect(p.locator('.phase')).toContainText(
      'Second player opportunity',
    );
  const secondary = (
    await Promise.all(
      pages.map(async (p) =>
        (await p.getByRole('button', { name: 'End turn', exact: true }).count())
          ? p
          : null,
      ),
    )
  ).find(Boolean)!;
  expect(secondary).not.toBe(actor);
  await expect(
    secondary.getByRole('button', { name: 'Roll dice', exact: true }),
  ).toHaveCount(0);
  await secondary
    .getByRole('button', { name: 'End turn', exact: true })
    .click();
  for (const p of pages)
    await expect(p.locator('.phase')).not.toContainText(
      'Second player opportunity',
    );
  for (const g of guests) await g.context.close();
});

test('Spanish game controls survive changing language during a room', async ({
  page,
  browser,
}) => {
  const url = await create(page, 'UNO', 'Alice');
  const guest = await join(browser, url, 'Bob');
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page.locator('.uno-table')).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Language', exact: true })
    .selectOption('es');
  await expect(page.locator('.uno-table')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tus cartas' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^UNO Robar/ })).toBeVisible();
  await expect(page.locator('.hand .card')).toHaveCount(7);
  await expect(
    guest.page.getByRole('heading', { name: 'Your hand' }),
  ).toBeVisible();
  await guest.context.close();
});
