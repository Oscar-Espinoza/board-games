const { test, expect } = require('@playwright/test');
async function loaded(page) {
  await expect(page.locator('#loading-controls')).toBeHidden({ timeout: 30000 });
  await expect(page.locator('#app')).toHaveJSProperty('inert', false);
}
async function room(browser, n = 3, setup = 'beginner', query = '', contextOptions = {}) {
  const contexts = [],
    pages = [];
  for (let i = 0; i < n; i++) {
    const c = await browser.newContext(contextOptions);
    contexts.push(c);
    pages.push(await c.newPage());
  }
  const params = new URLSearchParams(query.replace(/^\?/, ''));
  if (process.env.TEST_RELAY) params.set('relay', '1');
  const host = pages[0];
  await host.goto('/games/catan/?' + params);
  await loaded(host);
  await host.getByRole('button', { name: 'Create a table', exact: true }).click();
  await host.locator('#name').fill('Host');
  await host.locator('#create-room').click();
  await expect(host.locator('#room-details')).toBeVisible();
  await host.locator('#room-size').selectOption(String(n));
  await host.locator('#setup').selectOption(setup);
  const url = new URL(await host.locator('#invite').inputValue());
  if (process.env.TEST_RELAY) url.searchParams.set('relay', '1');
  const invite = url.href;
  for (let i = 1; i < n; i++) {
    await pages[i].goto(invite);
    await loaded(pages[i]);
    await pages[i].locator('#name').fill(`Friend ${i}`);
    await pages[i].locator(`#avatar-picker input[value="${i}"]`).check();
    await pages[i].locator('#join-room').click();
    await expect(pages[i].locator('#room-details')).toBeVisible();
  }
  await expect(host.locator('#start-round')).toBeEnabled({ timeout: 30000 });
  await host.locator('#start-round').click();
  for (const p of pages) {
    await expect(p.locator('#board')).toBeVisible();
    if (process.env.TEST_RELAY)
      await expect(p.locator('#diagnostics')).toHaveAttribute('data-transport', 'TURN relay');
  }
  return {
    contexts,
    pages,
    host,
    invite,
    close: async () => {
      for (const c of contexts) await c.close();
    },
  };
}
async function waitMoves(pages) {
  await expect
    .poll(async () => {
      for (let i = 0; i < pages.length; i++) {
        const p = pages[i];
        if (
          (await p
            .locator('#actions button, #roll-action button, #victim-actions button')
            .count()) ||
          (await p.locator('#targets button').count()) ||
          (await p.locator('#discard-form').isVisible())
        )
          return i;
      }
      return -1;
    })
    .not.toBe(-1);
}
async function oneOpportunity(pages) {
  for (let step = 0; step < 12; step++) {
    await waitMoves(pages);
    for (const p of pages) {
      const roll = p.getByRole('button', { name: 'Roll dice', exact: true });
      if (await roll.count()) {
        await roll.click();
        break;
      }
      const end = p.getByRole('button', { name: 'End turn', exact: true });
      if (await end.count()) {
        await end.click();
        return;
      }
      if (await p.locator('#discard-form').isVisible()) {
        let remaining = Number((await p.locator('#discard-label').textContent()).match(/\d+/)[0]);
        for (let i = 0; i < 5; i++) {
          const input = p.locator(`#discard-${i}`),
            n = Math.min(remaining, Number(await input.getAttribute('max')));
          await input.fill(String(n));
          remaining -= n;
        }
        await p.locator('#discard-submit').click();
        break;
      }
      const targets = p.locator('#targets button');
      if (await targets.count()) {
        await targets.first().click();
        await p.locator('#confirm-placement').click();
        break;
      }
      const victim = p.getByRole('button', { name: /^Rob player/ });
      if (await victim.count()) {
        await victim.first().click();
        break;
      }
    }
  }
  throw Error('Opportunity did not finish');
}
test('CATAN three-human beginner table rolls, acts and transfers authority', async ({
  browser,
}, info) => {
  test.setTimeout(90000);
  const r = await room(browser);
  try {
    for (const p of r.pages) {
      await expect(p.locator('.resource')).toHaveCount(5);
      await expect(p.locator('.player-summary')).toHaveCount(3);
      await expect(p.locator('#add-bot')).toHaveCount(0);
      await expect(p.locator('#error')).toBeEmpty();
    }
    await oneOpportunity(r.pages);
    await expect
      .poll(
        async () =>
          new Set(
            await Promise.all(
              r.pages.map((p) => p.locator('#board').getAttribute('data-revision')),
            ),
          ).size,
        { timeout: 20000 },
      )
      .toBe(1);
    await r.host.screenshot({ path: info.outputPath('catan-table.png'), fullPage: true });
    await r.host.locator('#trade-toggle').click();
    await r.pages[1].locator('#trade-toggle').click();
    await r.host.evaluate(async () => {
      const p = await import(
        new URL('catan-presentation.js', new URL(document.body.dataset.runtime, location.href))
      );
      p.before_render(JSON.stringify([{ type: 'rolled', dice: [2, 3] }]));
      p.after_render();
    });
    await r.host.locator('[data-catalog]').click();
    await expect(r.host).toHaveURL(/\/$/);
    await expect(r.pages[1].locator('#status')).toContainText('paused');
    await expect(r.pages[1].locator('#trade-panel')).toBeVisible();
    await r.host.goto(r.invite);
    await loaded(r.host);
    await r.host.locator('#join-room').click();
    await expect(r.host.locator('#board')).toBeVisible({ timeout: 20000 });
    await expect(r.pages[1].locator('#status')).not.toContainText('paused', { timeout: 20000 });
    await oneOpportunity(r.pages);
  } finally {
    await r.close();
  }
});
test('CATAN variable setup confirms legal locations using keyboard controls', async ({
  browser,
}) => {
  test.setTimeout(90000);
  const r = await room(browser, 3, 'variable', '?graphics=webgl');
  try {
    await expect(r.host.locator('#board')).toHaveAttribute('data-renderer', 'webgl2');
    for (let step = 0; step < 12; step++) {
      await expect
        .poll(async () => {
          for (let i = 0; i < r.pages.length; i++)
            if (await r.pages[i].locator('#targets button').count()) return i;
          return -1;
        })
        .not.toBe(-1);
      for (const p of r.pages) {
        const options = p.locator('#location option');
        if ((await options.count()) > 1) {
          const value = await options.nth(1).getAttribute('value');
          await p.locator('#location').selectOption(value);
          await p.locator('#confirm-placement').focus();
          await p.keyboard.press('Enter');
          break;
        }
      }
    }
    await expect
      .poll(async () => {
        for (const p of r.pages)
          if (await p.getByRole('button', { name: 'Roll dice', exact: true }).count()) return true;
        return false;
      })
      .toBe(true);
    for (const p of r.pages) await expect(p.locator('#error')).toBeEmpty();
  } finally {
    await r.close();
  }
});
test('CATAN six-human extension gives Player 2 an action opportunity', async ({
  browser,
}, info) => {
  test.setTimeout(120000);
  const r = await room(browser, 6);
  try {
    await expect(r.host.locator('#board-labels .number')).toHaveCount(28);
    await oneOpportunity(r.pages);
    for (const p of r.pages) await expect(p.locator('#phase-label')).toContainText('Player 2');
    for (const p of r.pages) {
      await expect(p.getByRole('button', { name: 'Roll dice', exact: true })).toHaveCount(0);
      await expect(p.locator('#offer-submit')).toBeDisabled();
    }
    await r.host.screenshot({ path: info.outputPath('catan-extended.png'), fullPage: true });
    await oneOpportunity(r.pages);
    await expect(r.host.locator('#phase-label')).toContainText('roll for production');
  } finally {
    await r.close();
  }
});

test('CATAN human victory reveals points and rematches in the same room', async ({ browser }) => {
  test.skip(!!process.env.TEST_RELAY, 'Scoring fixture is absent from production packages');
  test.setTimeout(90000);
  const r = await room(browser);
  try {
    const checkpoint = require('node:fs').readFileSync(
      'tests/fixtures/catan/win.checkpoint.json',
      'utf8',
    );
    await r.host.evaluate(async (json) => {
      const m = await import(document.body.dataset.runtime);
      m.fixture_checkpoint(json);
    }, checkpoint);
    await r.host.locator('#development-toggle').click();
    await expect(r.host.getByRole('button', { name: /^Buy development/ })).toBeVisible();
    await r.host.getByRole('button', { name: /^Buy development/ }).click();
    for (const p of r.pages) await expect(p.locator('#status')).toContainText('Host wins CATAN');
    await r.host.locator('#room-toggle').click();
    await expect(r.host.locator('#start-round')).toBeEnabled();
    await r.host.locator('#start-round').click();
    for (const p of r.pages) {
      await expect(p.locator('#board')).toHaveAttribute('data-round', '2');
      await expect(p.locator('#board')).toHaveAttribute('data-revision', '0');
      await expect(p.locator('#status')).not.toContainText('wins');
    }
  } finally {
    await r.close();
  }
});

test('CATAN mobile controls and graphics recovery preserve the room', async ({ browser }, info) => {
  test.setTimeout(90000);
  const r = await room(browser, 4, 'beginner', '?graphics=webgl');
  try {
    for (const p of r.pages)
      await p.evaluate(async () => {
        if (document.fullscreenElement) await document.exitFullscreen();
      });
    await r.host.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() => r.host.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await r.host.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await expect(r.host.locator('#board-stage')).toHaveCSS('transform', /matrix/);
    await r.host.getByRole('button', { name: 'Fit board', exact: true }).click();
    const revision = await r.host.locator('#board').getAttribute('data-revision');
    await r.host.evaluate(() =>
      document
        .getElementById('table-canvas')
        .getContext('webgl2')
        .getExtension('WEBGL_lose_context')
        .loseContext(),
    );
    await expect(r.host.locator('#graphics-recovery')).toBeVisible();
    await r.host.locator('#retry-graphics').click();
    await expect(r.host.locator('#graphics-recovery')).toBeHidden();
    await expect(r.host.locator('#board')).toHaveAttribute('data-revision', revision);
    await r.host.locator('#table-menu summary').click();
    await r.host.locator('#motion-toggle').click();
    await r.host.locator('#sound-toggle').click();
    await expect(r.host.locator('#motion-toggle')).toHaveAttribute('aria-checked', 'false');
    await r.host.screenshot({ path: info.outputPath('catan-phone.png'), fullPage: true });
    await oneOpportunity(r.pages);
  } finally {
    await r.close();
  }
});

test('CATAN WebGPU renders the same tabletop', async ({ playwright, browserName }, info) => {
  test.skip(browserName !== 'chromium', 'Explicit Chromium software WebGPU proof');
  test.setTimeout(90000);
  const browser = await playwright.chromium.launch({
    args: [
      '--enable-unsafe-webgpu',
      '--use-angle=swiftshader',
      '--enable-features=Vulkan',
      '--use-vulkan=swiftshader',
    ],
  });
  let r;
  try {
    r = await room(browser);
    await expect(r.host.locator('#board')).toHaveAttribute('data-renderer', 'webgpu');
    await oneOpportunity(r.pages);
    await r.host.screenshot({ path: info.outputPath('table-webgpu.png') });
  } finally {
    await r?.close();
    await browser.close();
  }
});

// Composition is asserted independently of rules, using populated real rooms.
test('CATAN illustrated four-player table fits desktop tablet and phone', async ({
  browser,
}, info) => {
  test.setTimeout(120000);
  const r = await room(browser, 4, 'beginner', '?graphics=webgl');
  try {
    for (const p of r.pages)
      await p.evaluate(async () => {
        if (document.fullscreenElement) await document.exitFullscreen();
      });
    for (const [width, height] of [
      [1920, 1080],
      [1366, 768],
      [768, 1024],
      [1024, 768],
      [390, 844],
    ]) {
      await r.host.setViewportSize({ width, height });
      await expect
        .poll(() =>
          r.host.evaluate(() => ({
            w: document.documentElement.scrollWidth,
            h: document.documentElement.scrollHeight,
          })),
        )
        .toEqual({ w: width, h: height });
      await expect(r.host.locator('#dice-hit')).toBeVisible();
      await expect(r.host.locator('#trade-toggle')).toBeInViewport();
      await expect
        .poll(() =>
          r.host.evaluate(() => {
            const rect = (e) => e.getBoundingClientRect();
            const inside = (r) =>
              r.x >= 0 && r.y >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
            const seats = [...document.querySelectorAll('.player-summary')].map(rect);
            const overlap = (a, b) =>
              a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
            return (
              seats.every(inside) &&
              seats.every((a, i) => seats.slice(i + 1).every((b) => !overlap(a, b))) &&
              inside(rect(document.getElementById('dice-tray')))
            );
          }),
        )
        .toBe(true);
      await r.host.screenshot({ path: info.outputPath(`table-4-${width}x${height}.png`) });
    }
    await expect(r.host.locator('#board-labels .hex-id')).toHaveCount(0);
    await expect(r.host.locator('#seat-1 img')).toHaveAttribute('src', /avatar-1.svg$/);
    await r.host.locator('#seat-1 button').click();
    await expect(r.host.locator('#player-panel')).toBeVisible();
    await r.host.keyboard.press('Escape');
    await expect(r.host.locator('#seat-1 button')).toBeFocused();
    await r.host.locator('#trade-toggle').click();
    await expect(r.host.locator('#trade-panel')).toBeVisible();
    await r.host.screenshot({ path: info.outputPath('table-phone-trade.png') });
    await r.host.keyboard.press('Escape');
    await expect(r.host.locator('#trade-toggle')).toBeFocused();
    await r.host.locator('#hand-toggle').click();
    await expect(r.host.locator('#hand-toggle')).toHaveAttribute('aria-expanded', 'true');
    await r.host.locator('#hand-toggle').click();
    const roller = await (async () => {
      for (const p of r.pages) if (await p.locator('#dice-hit').isEnabled()) return p;
    })();
    const revision = Number(await roller.locator('#board').getAttribute('data-revision'));
    await roller.locator('#dice-hit').click();
    await expect(roller.locator('#board')).toHaveAttribute('data-revision', String(revision + 1));
    await expect(roller.locator('#dice-values')).toContainText('Dice:');
  } finally {
    await r.close();
  }
});

test('CATAN artwork failure keeps the table inert and retries the same release', async ({
  page,
}) => {
  const requests = [];
  page.on('request', (r) => requests.push(new URL(r.url()).pathname));
  await page.route('**/terrain-atlas.svg', (route) => route.abort());
  await page.goto('/games/catan/?graphics=webgl');
  await expect(page.locator('#retry-load')).toBeVisible();
  await expect(page.locator('#app')).toHaveJSProperty('inert', true);
  await page.unroute('**/terrain-atlas.svg');
  await page.locator('#retry-load').click();
  await loaded(page);
  const assets = requests.filter((p) => p.startsWith('/assets/'));
  expect(new Set(assets.map((p) => p.split('/').slice(0, 4).join('/'))).size).toBe(1);
  expect(assets.every((p) => p.startsWith('/assets/catan/'))).toBe(true);
});

test('CATAN denied fullscreen remains usable and does not force another request', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.fullscreenCalls = 0;
    Element.prototype.requestFullscreen = () => {
      window.fullscreenCalls++;
      return Promise.reject(new DOMException('Denied', 'NotAllowedError'));
    };
  });
  await page.goto('/games/catan/?graphics=webgl');
  await loaded(page);
  await page.getByRole('button', { name: 'Create a table', exact: true }).click();
  await page.locator('#create-room').click();
  await expect(page.locator('#room-details')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.fullscreenCalls)).toBe(1);
  await page.locator('#room-panel [data-close]').click();
  await page.locator('#fullscreen-toggle').click();
  await expect.poll(() => page.evaluate(() => window.fullscreenCalls)).toBe(2);
  await expect(page.locator('#app')).toHaveJSProperty('inert', false);
});

function replayBefore(type) {
  const fs = require('node:fs'),
    { execFileSync } = require('node:child_process');
  const replay = JSON.parse(fs.readFileSync('tests/fixtures/catan/3-beginner.replay.json'));
  const index = replay.actions.findIndex((a) => a.action.type === type);
  const next = replay.actions[index];
  replay.actions = replay.actions.slice(0, index);
  const state = JSON.parse(
    execFileSync('target/debug/catan-replay', {
      input: JSON.stringify(replay),
      maxBuffer: 8 * 1024 * 1024,
    }),
  );
  return { state, next };
}
async function restoreFixture(r, state, revision = 1000) {
  const checkpoint = JSON.parse(state.checkpoint);
  checkpoint.revision = revision;
  await r.host.evaluate(
    async (json) => (await import(document.body.dataset.runtime)).fixture_checkpoint(json),
    JSON.stringify(checkpoint),
  );
  for (const page of r.pages)
    await expect(page.locator('#board')).toHaveAttribute('data-revision', String(revision));
}

test('CATAN touch construction previews a piece and confirms without covering the target', async ({
  browser,
}, info) => {
  test.skip(!!process.env.TEST_RELAY, 'Replay fixture is absent from production packages');
  test.setTimeout(90000);
  const r = await room(browser, 3, 'beginner', '?graphics=webgl', {
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  try {
    for (const p of r.pages) {
      await p.evaluate(async () => {
        if (document.fullscreenElement) await document.exitFullscreen();
      });
      await p.setViewportSize({ width: 390, height: 844 });
    }
    const { state, next } = replayBefore('road');
    await restoreFixture(r, state);
    const page = r.pages[next.player];
    await page.locator('#build-road').tap();
    await expect(page.locator('#placement-panel')).toBeVisible();
    const before = await page.locator('#board').getAttribute('data-revision');
    await page.locator('#location').selectOption({ label: `Road · route ${next.action.edge}` });
    await expect(page.locator('.preview-piece.road')).toHaveCount(1);
    await expect(page.locator('#board')).toHaveAttribute('data-revision', before);
    await expect
      .poll(async () => {
        const target = await page.locator('.target.selected').boundingBox(),
          sheet = await page.locator('#placement-panel').boundingBox();
        return target.y + target.height < sheet.y;
      })
      .toBe(true);
    await page.getByRole('button', { name: 'Zoom in', exact: true }).tap();
    await expect
      .poll(async () => {
        const target = await page.locator('.target.selected').boundingBox(),
          sheet = await page.locator('#placement-panel').boundingBox();
        return target.y + target.height < sheet.y;
      })
      .toBe(true);
    await page.screenshot({ path: info.outputPath('phone-construction-preview.png') });
    await page.locator('#confirm-placement').tap();
    await expect(page.locator('#board')).toHaveAttribute('data-revision', '1001');
    await expect(page.locator('#error')).toBeEmpty();
  } finally {
    await r.close();
  }
});

test('CATAN public trade offers notify the offering seat and exchange atomically', async ({
  browser,
}) => {
  test.skip(!!process.env.TEST_RELAY, 'Replay fixture is absent from production packages');
  test.setTimeout(90000);
  const r = await room(browser);
  try {
    const { state, next } = replayBefore('road');
    await restoreFixture(r, state);
    const actor = next.player,
      hand = state.views[actor].hand;
    let partner, give, take;
    for (let p = 0; p < 3; p++)
      for (let a = 0; a < 5; a++)
        for (let b = 0; b < 5; b++)
          if (p !== actor && a !== b && hand[a] > 0 && state.views[p].hand[b] > 0) {
            partner = p;
            give = a;
            take = b;
          }
    expect(partner).toBeDefined();
    const page = r.pages[actor],
      guest = r.pages[partner];
    await page.locator('#trade-toggle').click();
    await page.locator('#trade-to').selectOption(String(partner));
    await page.locator(`#give-${give}`).fill('1');
    await page.locator(`#take-${take}`).fill('1');
    await page.locator('#offer-submit').click();
    await expect(guest.locator(`[data-seat="${actor}"] .offer-notice`)).toBeVisible();
    await guest.locator(`[data-seat="${actor}"] .offer-notice`).click();
    await guest.getByRole('button', { name: /^Accept offer/ }).click();
    await page.getByRole('button', { name: /^Confirm offer/ }).click();
    for (const p of r.pages)
      await expect(p.locator('#board')).toHaveAttribute('data-revision', '1003');
    await expect(page.locator(`#hand .resource-${give} strong`)).toHaveText(String(hand[give] - 1));
    await expect(page.locator(`#hand .resource-${take} strong`)).toHaveText(String(hand[take] + 1));
    await expect(guest.locator('.offer-notice')).toHaveCount(0);
  } finally {
    await r.close();
  }
});

test('CATAN development choices, discard and robber decisions open from authoritative views', async ({
  browser,
}, info) => {
  test.skip(!!process.env.TEST_RELAY, 'Replay fixture is absent from production packages');
  test.setTimeout(120000);
  const r = await room(browser);
  try {
    for (const [i, type] of [
      'knight',
      'road_building',
      'invention',
      'monopoly',
      'discard',
      'move_robber',
      'steal',
    ].entries()) {
      const { state, next } = replayBefore(type);
      const revision = (i + 1) * 1000;
      await restoreFixture(r, state, revision);
      const page = r.pages[next.player];
      if (['knight', 'road_building', 'invention', 'monopoly'].includes(type)) {
        const kind = {
          knight: 'Knight',
          road_building: 'RoadBuilding',
          invention: 'Invention',
          monopoly: 'Monopoly',
        }[type];
        await page.locator(`[data-development="${kind}"]`).first().click();
        await expect(page.locator('#development-panel')).toBeVisible();
        if (type === 'knight')
          await page.screenshot({ path: info.outputPath('development-choices.png') });
        await page.locator(`#development-actions [data-kind="${kind}"]`).first().click();
        await expect(page.locator('#development-panel')).toBeHidden();
      } else if (type === 'discard') {
        await expect(page.locator('#discard-form')).toBeVisible();
        for (const [i, n] of next.action.resources.entries())
          await page.locator(`#discard-${i}`).fill(String(n));
        await page.locator('#discard-submit').click();
      } else if (type === 'move_robber') {
        await expect(page.locator('#placement-panel')).toBeVisible();
        await page
          .locator('#location')
          .selectOption({ label: `Move robber · terrain ${next.action.hex}` });
        await page.locator('#confirm-placement').focus();
        await page.keyboard.press('Enter');
      } else
        await page
          .getByRole('button', { name: `Rob player ${next.action.victim + 1}`, exact: true })
          .click();
      await expect(page.locator('#board')).toHaveAttribute('data-revision', String(revision + 1));
      await expect(page.locator('#error')).toBeEmpty();
    }
    await r.host.screenshot({ path: info.outputPath('developed-island.png') });
  } finally {
    await r.close();
  }
});

for (const count of [3, 5, 6])
  test(`CATAN ${count}-player seats fit both island sizes`, async ({ browser }, info) => {
    test.setTimeout(120000);
    const r = await room(browser, count, 'beginner', '?graphics=webgl');
    try {
      for (const p of r.pages)
        await p.evaluate(async () => {
          if (document.fullscreenElement) await document.exitFullscreen();
        });
      for (const [width, height] of [
        [1366, 768],
        [390, 844],
      ]) {
        await r.host.setViewportSize({ width, height });
        await expect
          .poll(() =>
            r.host.evaluate(() => {
              const seats = [...document.querySelectorAll('.player-summary')].map((e) =>
                  e.getBoundingClientRect(),
                ),
                dice = document.getElementById('dice-tray').getBoundingClientRect();
              const overlap = (a, b) =>
                a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
              return (
                seats.every(
                  (a, i) =>
                    a.x >= 0 &&
                    a.right <= innerWidth &&
                    a.y >= 0 &&
                    a.bottom <= innerHeight &&
                    !overlap(a, dice) &&
                    seats.slice(i + 1).every((b) => !overlap(a, b)),
                ) && document.documentElement.scrollHeight === innerHeight
              );
            }),
          )
          .toBe(true);
        await r.host.screenshot({ path: info.outputPath(`table-${count}-${width}x${height}.png`) });
      }
    } finally {
      await r.close();
    }
  });

test('CATAN cancels obsolete effects, respects motion preferences and suspends idle rendering', async ({
  browser,
}, info) => {
  test.setTimeout(90000);
  const r = await room(browser, 3, 'beginner', '?graphics=webgl');
  try {
    const page = r.host;
    const measurements = await page.evaluate(async () => {
      const m = await import(document.body.dataset.runtime);
      const samples = [],
        intervals = [];
      let last = await new Promise(requestAnimationFrame);
      for (let i = 0; i < 60; i++) {
        const start = performance.now();
        m.draw_frame(1);
        samples.push(performance.now() - start);
        const now = await new Promise(requestAnimationFrame);
        intervals.push(now - last);
        last = now;
      }
      samples.sort((a, b) => a - b);
      intervals.sort((a, b) => a - b);
      const gl = document.getElementById('table-canvas').getContext('webgl2'),
        debug = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        browser: navigator.userAgent,
        backend: gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
        samples: document.getElementById('board').dataset.samples,
        viewport: [innerWidth, innerHeight],
        medianCpuSubmissionMs: samples[30],
        p95CpuSubmissionMs: samples[57],
        medianRafIntervalMs: intervals[30],
        p95RafIntervalMs: intervals[57],
      };
    });
    require('node:fs').writeFileSync(
      info.outputPath('cpu-submission.json'),
      JSON.stringify(measurements, null, 2),
    );
    await info.attach('cpu-submission-measurement', {
      body: JSON.stringify(measurements, null, 2),
      contentType: 'application/json',
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('#motion-toggle')).toHaveAttribute('aria-checked', 'false');
    await page.locator('#table-menu summary').click();
    await page.locator('#sound-toggle').click();
    await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-checked', 'false');
    await page.locator('#motion-toggle').click();
    await expect(page.locator('#motion-toggle')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-checked', 'false');
    await page.locator('#table-menu summary').click();
    await page.evaluate(async () => {
      const p = await import(
        new URL(
          'catan-presentation.js',
          document.body.dataset.runtime
            ? new URL(document.body.dataset.runtime, location.href)
            : location.href,
        )
      );
      p.before_render(JSON.stringify([{ type: 'rolled', dice: [3, 4] }]));
      p.after_render();
    });
    await expect
      .poll(() => page.evaluate(() => document.getAnimations().length))
      .toBeGreaterThan(0);
    await page.evaluate(async () => {
      const p = await import(
        new URL('catan-presentation.js', new URL(document.body.dataset.runtime, location.href))
      );
      p.cancel_motion();
    });
    await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);
    const frames = await page.evaluate(async () => {
      let calls = 0;
      const original = requestAnimationFrame;
      window.requestAnimationFrame = (callback) => {
        calls++;
        return original(callback);
      };
      await new Promise((resolve) => setTimeout(resolve, 150));
      const warm = calls;
      await new Promise((resolve) => setTimeout(resolve, 200));
      window.requestAnimationFrame = original;
      return calls - warm;
    });
    expect(frames).toBe(0);
  } finally {
    await r.close();
  }
});

test('CATAN fullscreen entry, Escape and resizing retain the active table', async ({ browser }) => {
  test.setTimeout(90000);
  const r = await room(browser);
  try {
    const page = r.host;
    await page.bringToFront();
    await page.locator('#room-toggle').click();
    await page.keyboard.press('Escape');
    if (await page.locator('#room-panel').isVisible()) await page.keyboard.press('Escape');
    await expect(page.locator('#room-panel')).toBeHidden();
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
    for (const p of r.pages)
      await p.evaluate(async () => {
        if (document.fullscreenElement) await document.exitFullscreen();
      });
    await page.setViewportSize({ width: 1366, height: 768 });
    await expect(page.locator('#board')).toBeVisible();
    await expect(page.locator('#fullscreen-toggle')).toHaveAttribute(
      'aria-label',
      'Enter fullscreen',
    );
    await page.locator('#fullscreen-toggle').click();
    if (await page.evaluate(() => document.fullscreenEnabled)) {
      await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
      await page.keyboard.press('Escape');
      await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
    }
    await oneOpportunity(r.pages);
    await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
  } finally {
    await r.close();
  }
});
