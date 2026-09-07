const { test, expect } = require('@playwright/test');

test('catalog loads no game runtime', async ({ page }) => {
  const requests = [];
  page.on('request', (request) => requests.push(new URL(request.url()).pathname));
  const response = await page.goto('/');
  expect(response.headers()['cache-control']).toBe('no-cache');
  await expect(page.getByRole('heading', { name: 'Make room for play.' })).toBeVisible();
  await expect(page.locator('.game')).toHaveCount(2);
  expect(
    requests.filter((path) => /\.wasm$|\/assets\/|bridge\.js|transport\.js/.test(path)),
  ).toEqual([]);
});

test('Color Match uses one immutable release and no CATAN runtime', async ({ page }) => {
  const responses = [];
  page.on('response', (response) => responses.push(response));
  await page.goto('/');
  await page.locator('.game.color-match').click();
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  const assets = responses.filter((response) =>
    new URL(response.url()).pathname.startsWith('/assets/'),
  );
  expect(assets.some((response) => response.url().endsWith('.wasm'))).toBe(true);
  const versions = new Set(
    assets.map((response) => new URL(response.url()).pathname.split('/').slice(0, 4).join('/')),
  );
  expect(versions.size).toBe(1);
  for (const response of assets) {
    expect(response.url()).toContain('/assets/color-match/');
    expect(response.headers()['cache-control']).toContain('immutable');
  }
});

test('legacy invites preserve the fragment and relay preference', async ({ page }) => {
  const secret = 'a'.repeat(64);
  await page.goto(`/?relay=1#room=${secret}`);
  await expect(page).toHaveURL(new RegExp(`/games/color-match/\\?relay=1#room=${secret}$`));
  await expect(page.locator('#join-room')).toBeVisible();
});

test('a failed runtime stays inert and retry can recover', async ({ page }) => {
  await page.route('**/*.wasm', (route) => route.abort());
  await page.goto('/games/color-match/');
  await expect(page.locator('#load-status')).toContainText('could not load');
  await expect(page.locator('#app')).toHaveJSProperty('inert', true);
  await expect(page.getByRole('link', { name: 'Return to catalog', exact: true })).toBeVisible();
  await page.unroute('**/*.wasm');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('#app')).toHaveJSProperty('inert', false);
});

test('CATAN loads only its own runtime and never Color Match', async ({ page }) => {
  const requests = [];
  page.on('request', (r) => requests.push(new URL(r.url()).pathname));
  await page.goto('/games/catan/?graphics=webgl');
  await expect(page.locator('#loading-controls')).toBeHidden({ timeout: 30000 });
  expect(requests.some((path) => path.startsWith('/assets/catan/') && path.endsWith('.wasm'))).toBe(
    true,
  );
  expect(requests.some((path) => path.includes('/assets/color-match/'))).toBe(false);
});

for (const game of ['color-match', 'catan']) {
  test(`${game} reports failed transport import and recovers on retry`, async ({ page }) => {
    await page.route('**/transport.js', (route) => route.abort());
    await page.goto(`/games/${game}/?graphics=webgl`);
    await expect(page.locator('#retry-load')).toBeVisible();
    await expect(page.locator('#app')).toHaveJSProperty('inert', true);
    await page.unroute('**/transport.js');
    await page.locator('#retry-load').click();
    await expect(page.locator('#loading-controls')).toBeHidden({ timeout: 30000 });
  });
  test(`${game} reports the missing static DOM ID`, async ({ page }) => {
    await page.route(`**/games/${game}/**`, async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body: (await response.text()).replace('id="leave-room"', 'id="missing-leave-room"'),
      });
    });
    await page.goto(`/games/${game}/?graphics=webgl`);
    await expect(page.locator('#load-status')).toContainText(
      'Missing required element #leave-room',
    );
    await expect(page.locator('#app')).toHaveJSProperty('inert', true);
  });
}

test('CATAN resize callbacks wait for delayed Wasm initialization', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('**/*.wasm', async (route) => {
    await pending;
    await route.continue();
  });
  await page.goto('/games/catan/?graphics=webgl', { waitUntil: 'commit' });
  await expect(page.locator('#app')).toBeAttached();
  await page.waitForFunction(() =>
    performance.getEntriesByType('resource').some((entry) => entry.name.endsWith('catan_web.js')),
  );
  for (const width of [900, 1000, 1100]) {
    await page.setViewportSize({ width, height: 800 });
    await page.evaluate(() => new Promise(requestAnimationFrame));
  }
  release();
  await expect(page.locator('#loading-controls')).toBeHidden({ timeout: 30000 });
  expect(errors).toEqual([]);
});

for (const missing of [false, true]) {
  test(`solo startup without room DOM or transport, missing status: ${missing}`, async ({
    page,
  }) => {
    const fs = require('node:fs');
    const requests = [];
    page.on('request', (r) => requests.push(new URL(r.url()).pathname));
    await page.route('**/__solo-test', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `<main id="app" inert>Solo fixture</main><div id="loading-controls"><p id="${missing ? 'missing-status' : 'load-status'}"></p><button id="retry-load" hidden>Retry</button></div><script type="module">import { loadGame } from '/__solo-loader.js'; await loadGame({gameName: 'Solo fixture', async initialize(status) { status('Preparing world'); document.querySelector('#app').dataset.initialized = 'true'; }});</script>`,
      }),
    );
    await page.route('**/__solo-loader.js', (route) =>
      route.fulfill({
        contentType: 'text/javascript',
        body: fs.readFileSync('web/shared/loading-shell.js', 'utf8'),
      }),
    );
    const warnings = [];
    page.on('console', (message) => warnings.push(message.text()));
    await page.goto('/__solo-test');
    if (missing) {
      await expect(page.locator('#retry-load')).toBeVisible();
      await expect(page.locator('#app')).toHaveJSProperty('inert', true);
      expect(warnings.some((w) => w.includes('Missing required element #load-status'))).toBe(true);
    } else {
      await expect(page.locator('#loading-controls')).toBeHidden();
      await expect(page.locator('#app')).toHaveJSProperty('inert', false);
      await expect(page.locator('#app')).toHaveAttribute('data-initialized', 'true');
    }
    expect(requests).toEqual(['/__solo-test', '/__solo-loader.js']);
  });
}

test('catalog presents solo and table modes from metadata', async ({ page }) => {
  await page.route('**/catalog.json', (route) =>
    route.fulfill({
      json: [
        {
          id: 'fixture',
          name: 'Discovery fixture',
          route: '/__fixture',
          category: 'board-games',
          preview: 'DF',
          modes: [{ kind: 'solo' }, { kind: 'table', min_players: 2, max_players: 4 }],
        },
      ],
    }),
  );
  await page.goto('/');
  const card = page.locator('.game');
  await expect(card).toHaveAttribute('href', '/__fixture');
  await expect(card).toContainText('Solo · 2–4 players');
  await expect(card.locator('.preview')).toHaveText('DF');
  await expect(card.locator('.action')).toHaveText('Play →');
});

test('catalog failure offers retry and recovers', async ({ page }) => {
  await page.route('**/catalog.json', (route) => route.fulfill({ status: 503, body: '' }));
  await page.goto('/');
  await expect(page.locator('#error')).toContainText('could not load');
  await page.unroute('**/catalog.json');
  await page.locator('#retry').click();
  await expect(page.locator('.game')).toHaveCount(2);
  await expect(page.locator('#error')).toBeEmpty();
});

for (const game of ['color-match', 'catan']) {
  test(`${game} reports failed table integration import and recovers`, async ({ page }) => {
    await page.route('**/table-controls.js', (route) => route.abort());
    await page.goto(`/games/${game}/?graphics=webgl`);
    await expect(page.locator('#retry-load')).toBeVisible();
    await expect(page.locator('#app')).toHaveJSProperty('inert', true);
    await page.unroute('**/table-controls.js');
    await page.locator('#retry-load').click();
    await expect(page.locator('#loading-controls')).toBeHidden({ timeout: 30000 });
  });
}
