import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
test.use({ actionTimeout: 15000 });
async function settings(page: Page) {
  await page.locator('.tools button').last().click();
}
async function close(page: Page) {
  // Native close events restore focus asynchronously; wait before the next input.
  await Promise.all([
    page.locator('dialog[open]').evaluate(
      (dialog) =>
        new Promise<void>((resolve) => {
          dialog.addEventListener('close', () => resolve(), { once: true });
        }),
    ),
    page.locator('dialog[open] > header .close').click(),
  ]);
}
async function scenario(page: Page, value: string) {
  await settings(page);
  await page.locator('dialog select').first().selectOption(value);
  await close(page);
}
async function clue(page: Page, word = 'Ocean', count = 'unlimited') {
  await page.locator('.give-clue').click();
  await page.locator('.clue-form input').fill(word);
  await page.locator('.clue-form select').selectOption(count);
  await page.locator('.clue-form button').click();
  await expect(page.locator('.cn-table')).toHaveAttribute(
    'data-phase',
    'guessing',
  );
}
async function practiceKey(page: Page) {
  if ((await page.locator('.cn-table').getAttribute('data-phase')) === 'clue')
    await clue(page);
  await settings(page);
  const seat = await page
    .getByLabel('Training seat', { exact: true })
    .inputValue();
  await page
    .getByLabel('Training seat', { exact: true })
    .selectOption('training-0');
  await close(page);
  const key = await page.locator('.dossier').evaluateAll((es) =>
    es.map((e) => ({
      card: e.getAttribute('data-card')!,
      identity: e.getAttribute('data-identity')!,
    })),
  );
  await expect(page.locator('.dossier:enabled')).toHaveCount(0);
  await settings(page);
  await page.getByLabel('Training seat', { exact: true }).selectOption(seat);
  await close(page);
  return key;
}
async function reveal(page: Page, card: string) {
  await page.locator(`[data-card="${card}"]`).click();
  await expect(page.locator('dialog.confirmation')).toBeVisible();
  await page.locator('.confirmation .primary').click();
  await expect(page.locator(`[data-card="${card}"]`)).toHaveClass(/revealed/);
}
async function geometry(page: Page, width: number, height: number) {
  await expect(page.locator('.dossier')).toHaveCount(25);
  const boxes = await page.locator('.dossier').evaluateAll((es) =>
    es.map((e) => {
      const r = e.getBoundingClientRect();
      return {
        w: r.width,
        h: r.height,
        top: r.top,
        bottom: r.bottom,
        left: r.left,
        right: r.right,
      };
    }),
  );
  expect(
    boxes.every(
      (r) =>
        r.w >= 43.99 &&
        r.h >= 43.99 &&
        r.top >= 0 &&
        r.bottom <= height &&
        r.left >= 0 &&
        r.right <= width,
    ),
    JSON.stringify(boxes),
  ).toBe(true);
  expect(
    await page.evaluate(() => ({
      w: document.documentElement.scrollWidth,
      h: document.documentElement.scrollHeight,
    })),
  ).toEqual({ w: width, h: height });
  const controls = await page
    .locator('.cn-table button:not(.dossier)')
    .evaluateAll((es) =>
      es
        .filter((e) => e.getClientRects().length)
        .map((e) => {
          const r = e.getBoundingClientRect();
          return {
            label: e.getAttribute('aria-label') ?? e.textContent,
            w: r.width,
            h: r.height,
            right: r.right,
            bottom: r.bottom,
          };
        }),
    );
  expect(
    controls.every(
      (r) =>
        r.w >= 43.99 && r.h >= 43.99 && r.right <= width && r.bottom <= height,
    ),
    JSON.stringify(controls),
  ).toBe(true);
}
async function capture(page: Page, path: string) {
  mkdirSync(dirname(path), { recursive: true });
  // Review output is WebP; Playwright's PNG buffer is piped directly to cwebp.
  const png = await page.screenshot({ animations: 'disabled' });
  execFileSync('cwebp', ['-quiet', '-q', '88', '-o', path, '--', '-'], {
    input: png,
  });
}
const sizes = [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 360, height: 640 },
  { width: 320, height: 568 },
];
test('six viewports, English/Spanish, eight players, enlarged text and accessible history/key dialogs', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize(sizes[0]!);
  await page.goto('/practice/codenames');
  await scenario(page, 'midgame');
  await settings(page);
  await page
    .locator('dialog')
    .getByLabel('Seats', { exact: true })
    .selectOption('8');
  await close(page);
  for (const lang of ['en', 'es']) {
    if (lang === 'es') {
      await settings(page);
      await page.locator('dialog select').last().selectOption('es');
      await scenario(page, 'midgame');
    }
    for (const size of sizes) {
      await page.setViewportSize(size);
      await geometry(page, size.width, size.height);
      if (size.width >= 1024) {
        await expect(page.locator('.history-panel')).toBeVisible();
        await expect(page.locator('.players-panel')).toBeVisible();
        await expect(page.locator('.props')).toBeVisible();
        await expect(page.locator('.key-panel')).toHaveCount(0);
      } else {
        await expect(page.locator('.props')).toBeHidden();
        await expect(page.locator('.history-panel')).toBeHidden();
        await page.locator('.compact-history').click();
        await expect(page.locator('dialog .history-entry')).toHaveCount(3);
        await capture(
          page,
          info.outputPath(`history-${lang}-${size.width}.webp`),
        );
        await page.keyboard.press('Escape');
        await expect(page.locator('.compact-history')).toBeFocused();
      }
      await capture(page, info.outputPath(`table-${lang}-${size.width}.webp`));
      await page.evaluate(
        () => (document.documentElement.style.fontSize = '200%'),
      );
      await expect(page.locator('.cn-table')).toHaveClass(/enlarged/);
      await geometry(page, size.width, size.height);
      await page.locator('.compact-players').click();
      await expect(page.locator('dialog .player-list li')).toHaveCount(8);
      await close(page);
      await settings(page);
      await expect(page.locator('dialog[open]')).toBeVisible();
      await close(page);
      await page.evaluate(() => (document.documentElement.style.fontSize = ''));
      await expect(page.locator('.cn-table')).not.toHaveClass(/enlarged/);
    }
  }
  await settings(page);
  await page.locator('dialog select').last().selectOption('en');
  await settings(page);
  await page
    .getByLabel('Training seat', { exact: true })
    .selectOption('training-0');
  await close(page);
  await page.locator('.compact-key').click();
  await expect(page.locator('dialog .key-cell')).toHaveCount(25);
  await page.getByRole('switch').click();
  await expect(page.locator('dialog .key-cell')).toHaveCount(0);
  await close(page);
  await expect(
    page.locator('.dossier:not(.revealed)[data-identity]'),
  ).toHaveCount(0);
  await page.reload();
  await page.locator('.compact-key').click();
  await expect(page.getByRole('switch')).not.toBeChecked();
  await page.getByRole('switch').click();
  await close(page);
  expect(errors).toEqual([]);
});

test('desktop composition stays compact from 1024px through ultrawide screens', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/practice/codenames');
  await expect(page.locator('.history-panel .empty')).toBeVisible();
  const placement = () =>
    page.evaluate(() => {
      const rect = (selector: string) => {
        const r = document.querySelector(selector)!.getBoundingClientRect();
        return {
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
          right: r.right,
          bottom: r.bottom,
          centreY: (r.top + r.bottom) / 2,
        };
      };
      return {
        table: rect('.table-layout'),
        header: rect('.table-header'),
        teams: rect('.team-row'),
        board: rect('.word-grid'),
        history: rect('.history-panel'),
        bottom: rect('.bottom-panels'),
        lastCard: rect('.dossier:last-child'),
      };
    });
  let layout = await placement();
  expect(Math.abs(layout.history.y - layout.teams.y)).toBeLessThan(
    1,
  );
  await capture(page, info.outputPath('empty-history.webp'));
  await scenario(page, 'midgame');
  await settings(page);
  await page
    .locator('dialog')
    .getByLabel('Seats', { exact: true })
    .selectOption('8');
  await page
    .getByLabel('Training seat', { exact: true })
    .selectOption('training-0');
  await close(page);
  for (const size of [
    { width: 1024, height: 600 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
    { width: 2560, height: 1440 },
  ]) {
    await page.setViewportSize(size);
    await expect(page.locator('.cn-table')).not.toHaveClass(/compact/);
    await geometry(page, size.width, size.height);
    layout = await placement();
    expect(layout.table.width).toBeLessThanOrEqual(1120);
    expect(layout.table.height).toBeLessThanOrEqual(680);
    expect(
      Math.abs(layout.table.x + layout.table.width / 2 - size.width / 2),
    ).toBeLessThan(1);
    expect(layout.table.y - layout.header.bottom).toBeLessThanOrEqual(15);
    expect(layout.board.y).toBeGreaterThanOrEqual(layout.teams.bottom);
    expect(layout.bottom.y).toBeGreaterThanOrEqual(layout.lastCard.bottom);
    expect(
      Math.abs(layout.history.y - layout.teams.y),
    ).toBeLessThan(1);
    expect(layout.history.x).toBeGreaterThan(layout.board.right);
    expect(layout.history.height).toBeLessThanOrEqual(layout.board.bottom - layout.teams.y + 1);
    await expect(page.locator('.key-panel')).toBeVisible();
    await expect(page.locator('.key-panel .key-cell').last()).toBeInViewport();
    await capture(
      page,
      info.outputPath(`desktop-${size.width}x${size.height}.webp`),
    );
  }
});

test('keyboard confirmation, searchable rules, silent audio, turn handoffs and both immediate results', async ({
  page,
}, info) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, 'AudioContext', { value: undefined }),
  );
  await page.goto('/practice/codenames');
  await settings(page);
  await page.getByRole('button', { name: 'Rules', exact: true }).click();
  await page.getByLabel('Search the rules').fill('unlimited');
  await expect(page.locator('dialog')).toContainText('Extra guesses');
  await page.getByLabel('Search the rules').fill('');
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  const key = await practiceKey(page);
  const team = await page.locator('.cn-table').getAttribute('data-active-team');
  const own = key.find((c) => c.identity === team)!.card;
  await expect(
    page.getByRole('button', { name: 'End turn', exact: true }),
  ).toBeDisabled();
  await page.locator(`[data-card="${own}"]`).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('dialog.confirmation[open]')).toBeVisible();
  await expect(page.locator('.dossier.revealed')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator(`[data-card="${own}"]`)).toBeFocused();
  await reveal(page, own);
  await page.getByRole('button', { name: 'End turn', exact: true }).click();
  await expect(page.locator('.cn-table')).toHaveAttribute('data-phase', 'clue');
  await clue(page, 'Forest', '2');
  await reveal(page, key.find((c) => c.identity === 'civilian')!.card);
  await clue(page, 'Night', '1');
  await reveal(page, key.find((c) => c.identity === 'assassin')!.card);
  await expect(page.locator('dialog.result')).toContainText('assassin');
  await close(page);
  await expect(page.locator('.dossier[data-identity]')).toHaveCount(25);
  await expect(page.locator('.dossier:enabled')).toHaveCount(0);
  await capture(page, info.outputPath('assassin.webp'));
  await scenario(page, 'final');
  const finalKey = await practiceKey(page);
  const active = await page
    .locator('.cn-table')
    .getAttribute('data-active-team');
  const remaining = await page
    .locator('.dossier:not(.revealed)')
    .evaluateAll((es) => es.map((e) => e.getAttribute('data-card')));
  await reveal(
    page,
    finalKey.find((c) => c.identity === active && remaining.includes(c.card))!
      .card,
  );
  await expect(page.locator('dialog.result')).toContainText(
    'agents have been found',
  );
});

test('four private clients submit clues, hand off, reconnect mid-turn, win and rematch', async ({
  browser,
  baseURL,
}, info) => {
  test.setTimeout(180000);
  const contexts = await Promise.all(
    Array.from({ length: 4 }, () =>
      browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } }),
    ),
  );
  const pages = await Promise.all(contexts.map((c) => c.newPage()));
  const snapshots: any[][] = pages.map(() => []);
  const errors: string[] = [];
  pages.forEach((p, i) => {
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('websocket', (socket) =>
      socket.on('framereceived', (frame) => {
        const data = String(frame.payload);
        if (data.startsWith('42["snapshot"'))
          try {
            snapshots[i]!.push(JSON.parse(data.slice(2))[1]);
          } catch {}
      }),
    );
  });
  try {
    const host = pages[0]!;
    await host.goto('/');
    await host
      .locator('.game-names button')
      .filter({ hasText: 'Codenames' })
      .click();
    await host.getByRole('button', { name: 'Start game', exact: true }).click();
    await host.getByLabel('Your name', { exact: true }).fill('Red operative');
    await host
      .getByRole('button', { name: 'Create room →', exact: true })
      .click();
    await expect(host).toHaveURL(/\/room\//);
    for (let i = 1; i < 4; i++) {
      await pages[i]!.goto(host.url());
      await pages[i]!.getByLabel('Your name', { exact: true }).fill(
        ['', 'Red spymaster', 'Blue operative', 'Blue spymaster'][i]!,
      );
      await pages[i]!.getByRole('button', {
        name: 'Join an available seat',
        exact: true,
      }).click();
    }
    await expect(host.locator('.roster li')).toHaveCount(4);
    await host.getByRole('button', { name: 'Start game', exact: true }).click();
    async function roles() {
      for (let i = 0; i < 4; i++) {
        await expect(pages[i]!.locator('.setup')).toBeVisible();
        await pages[i]!.locator(`.team-panel.${i < 2 ? 'red' : 'blue'}`)
          .getByRole('button', {
            name: `Choose ${i % 2 ? 'Spymaster' : 'Operative'}`,
            exact: true,
          })
          .click();
      }
      for (const p of pages)
        await p.getByRole('button', { name: /I’m ready/ }).click();
      await expect(host.locator('.dossier')).toHaveCount(25);
    }
    await roles();
    const first =
      (await host.locator('.cn-table').getAttribute('data-active-team')) ===
      'red'
        ? 0
        : 2;
    const spy = pages[first + 1]!,
      op = pages[first]!;
    await expect(host.locator('.dossier[data-identity]')).toHaveCount(0);
    await expect(spy.locator('.dossier[data-identity]')).toHaveCount(25);
    await capture(host, info.outputPath('operative.webp'));
    await capture(spy, info.outputPath('spymaster.webp'));
    await spy.context().setOffline(true);
    await expect(spy.locator('.notice')).toBeVisible();
    await expect(op.locator('.dossier:enabled')).toHaveCount(0);
    await spy.context().setOffline(false);
    await expect(spy.locator('.notice')).toHaveCount(0);
    await clue(spy, 'Sea', '2');
    const targets = await spy
      .locator(`.dossier[data-identity="${first === 0 ? 'red' : 'blue'}"]`)
      .evaluateAll((es) => es.map((e) => e.getAttribute('data-card')!));
    await reveal(op, targets[0]!);
    await op.locator(`[data-card="${targets[1]}"]`).click();
    await expect(op.locator('.confirmation')).toBeVisible();
    await op.context().setOffline(true);
    await expect(op.locator('.notice')).toBeVisible();
    await expect(op.locator('.confirmation')).not.toBeVisible();
    await op.context().setOffline(false);
    await expect(op.locator('.notice')).toHaveCount(0);
    await expect(op.locator('.active-clue')).toContainText('Sea');
    await op.getByRole('button', { name: 'End turn', exact: true }).click();
    const next = first === 0 ? 2 : 0;
    await clue(pages[next + 1]!, 'Forest', '2');
    const nextOwn = await pages[next + 1]!.locator(
      `.dossier[data-identity="${next === 0 ? 'red' : 'blue'}"]`,
    )
      .first()
      .getAttribute('data-card');
    await reveal(pages[next]!, nextOwn!);
    await pages[next]!.getByRole('button', {
      name: 'End turn',
      exact: true,
    }).click();
    await clue(spy, 'Together');
    for (const card of targets.slice(1)) await reveal(op, card);
    await expect(host.locator('.result')).toBeVisible();
    for (const i of [0, 2])
      for (const room of snapshots[i]!) {
        expect(room.game?.private.key).toBeUndefined();
        for (const c of room.game?.public.board ?? [])
          if (!c.revealed && room.game.public.phase !== 'finished')
            expect(c.identity).toBeUndefined();
        for (const r of room.game?.public.clueHistory ?? [])
          for (const g of r.guesses)
            expect(room.game.public.board[g.card].revealed).toBe(true);
      }
    const hostId = snapshots[0]!.at(-1).hostId;
    const currentHost = pages.find(
      (_, i) => snapshots[i]!.at(-1).playerId === hostId,
    )!;
    await currentHost
      .getByRole('button', { name: 'Play again · choose teams' })
      .click();
    await roles();
    const active =
      (await host.locator('.cn-table').getAttribute('data-active-team')) ===
      'red'
        ? 0
        : 2;
    await clue(pages[active + 1]!, 'Night', '1');
    const assassin = await pages[active + 1]!.locator(
      '.dossier[data-identity="assassin"]',
    ).getAttribute('data-card');
    await reveal(pages[active]!, assassin!);
    await expect(host.locator('.result')).toContainText('assassin');
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});

test('eight seats consent, race distinct operative confirmations, and fit the table', async ({
  browser,
  baseURL,
}, info) => {
  test.setTimeout(150000);
  const contexts = await Promise.all(
    Array.from({ length: 8 }, () =>
      browser.newContext({
        baseURL,
        viewport: { width: 768, height: 1024 },
        recordVideo: {
          dir: info.outputPath('videos'),
          size: { width: 768, height: 1024 },
        },
      }),
    ),
  );
  // Hold actual browser-produced confirmations so both carry the same revision.
  // No game state or client intention is fabricated by this transport barrier.
  await Promise.all(
    contexts.map((c) =>
      c.addInitScript(() => {
        const race = {
          hold: false,
          queued: [] as { socket: WebSocket; data: string }[],
          guesses: 0,
          stale: 0,
        };
        (window as any).__cnRace = race;
        const send = WebSocket.prototype.send;
        const observed = new WeakSet<WebSocket>();
        WebSocket.prototype.send = function (data) {
          if (!observed.has(this)) {
            observed.add(this);
            this.addEventListener('message', (event) => {
              if (
                typeof event.data === 'string' &&
                event.data.includes('STALE_REVISION')
              )
                race.stale++;
            });
          }
          if (typeof data === 'string' && /^42\d*\["action"/.test(data)) {
            const action = JSON.parse(data.slice(data.indexOf('[')))[1];
            if (action.action?.type === 'guess') {
              race.guesses++;
              if (race.hold) {
                race.queued.push({ socket: this, data });
                return;
              }
            }
          }
          return send.call(this, data);
        };
        (window as any).__cnFlush = () => {
          race.hold = false;
          for (const item of race.queued.splice(0))
            send.call(item.socket, item.data);
        };
      }),
    ),
  );
  const pages = await Promise.all(contexts.map((c) => c.newPage()));
  try {
    const host = pages[0]!;
    await host.goto('/');
    await host
      .locator('.game-names button')
      .filter({ hasText: 'Codenames' })
      .click();
    await host.getByRole('button', { name: 'Start game', exact: true }).click();
    await host.getByLabel('Your name', { exact: true }).fill('Operative 0');
    await host.getByLabel('Board language', { exact: true }).selectOption('es');
    await host
      .getByRole('button', { name: 'Create room →', exact: true })
      .click();
    await expect(host).toHaveURL(/\/room\//);
    for (let i = 1; i < 8; i++) {
      await pages[i]!.goto(host.url());
      await pages[i]!.getByLabel('Your name', { exact: true }).fill(
        `Agent ${i}`,
      );
      await pages[i]!.getByRole('button', {
        name: 'Join an available seat',
        exact: true,
      }).click();
    }
    await expect(host.locator('.roster li')).toHaveCount(8);
    await host.getByRole('button', { name: 'Start game', exact: true }).click();
    for (let i = 0; i < 8; i++) {
      await pages[i]!.locator(`.team-panel.${i < 4 ? 'red' : 'blue'}`)
        .getByRole('button', {
          name: `Choose ${i === 1 || i === 5 ? 'Spymaster' : 'Operative'}`,
          exact: true,
        })
        .click();
    }
    await expect(host.locator('.agreements')).toContainText('Español');
    await capture(host, info.outputPath('eight-seat-setup.webp'));
    for (const p of pages)
      await p.getByRole('button', { name: /I’m ready/ }).click();
    await expect(host.locator('.dossier')).toHaveCount(25);
    await settings(host);
    await expect(host.locator('.settings-roster')).toContainText('Agent 7');
    await close(host);
    await capture(host, info.outputPath('eight-seat-tablet.webp'));
    const active =
        (await host.locator('.cn-table').getAttribute('data-active-team')) ===
        'red'
          ? 0
          : 4,
      spy = pages[active + 1]!;
    await clue(spy);
    const operatives = [pages[active]!, pages[active + 2]!];
    const targets = await spy
      .locator(`.dossier[data-identity="${active === 0 ? 'red' : 'blue'}"]`)
      .evaluateAll((es) =>
        es.slice(0, 2).map((e) => e.getAttribute('data-card')!),
      );
    for (let i = 0; i < 2; i++) {
      await operatives[i]!.locator(`[data-card="${targets[i]}"]`).click();
      expect(
        await operatives[i]!.evaluate(() => (window as any).__cnRace.guesses),
      ).toBe(0);
      await operatives[i]!.evaluate(
        () => ((window as any).__cnRace.hold = true),
      );
    }
    await capture(operatives[0]!, info.outputPath('race-confirmation.webp'));
    await Promise.all(
      operatives.map((p) => p.locator('.confirmation .primary').click()),
    );
    for (const p of operatives)
      await expect
        .poll(() => p.evaluate(() => (window as any).__cnRace.queued.length))
        .toBe(1);
    const envelopes = await Promise.all(
      operatives.map((p) =>
        p.evaluate(() => {
          const data = (window as any).__cnRace.queued[0].data;
          return JSON.parse(data.slice(data.indexOf('[')))[1];
        }),
      ),
    );
    expect(envelopes[0].revision).toBe(envelopes[1].revision);
    expect(envelopes[0].action.card).not.toBe(envelopes[1].action.card);
    // Snapshot count plus one sent guess per browser proves no automatic replay.
    await Promise.all(
      operatives.map((p) => p.evaluate(() => (window as any).__cnFlush())),
    );
    await expect
      .poll(async () =>
        (
          await Promise.all(
            operatives.map((p) =>
              p.evaluate(() => (window as any).__cnRace.stale),
            ),
          )
        ).reduce((sum, count) => sum + count, 0),
      )
      .toBe(1);
    for (const p of operatives) {
      await expect(p.locator('.dossier.revealed')).toHaveCount(1);
      await expect(p.locator('.confirmation button')).toHaveCount(0);
      expect(await p.evaluate(() => (window as any).__cnRace.guesses)).toBe(1);
      expect(
        await p.locator('.dossier:not(.revealed)[data-identity]').count(),
      ).toBe(0);
    }
    // The losing choice needs a new selection and explicit confirmation.
    const remaining = await operatives[1]!
      .locator('.dossier:not(.revealed)')
      .evaluateAll(
        (es, candidates) =>
          es
            .map((e) => e.getAttribute('data-card')!)
            .find((id) => candidates.includes(id)),
        targets,
      );
    await operatives[1]!.locator(`[data-card="${remaining}"]`).click();
    await operatives[1]!.locator('.confirmation .primary').click();
    await expect(host.locator('.dossier.revealed')).toHaveCount(2);
    await capture(host, info.outputPath('race-settled.webp'));
    await host.setViewportSize({ width: 320, height: 568 });
    await host.evaluate(
      () => (document.documentElement.style.fontSize = '200%'),
    );
    expect(
      await host.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(320);
    await capture(host, info.outputPath('eight-seat-200-text.webp'));
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});

test('accepted public effects play once after gesture, cancel on resize, and mute safely', async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    const log = { contexts: 0, sounds: 0, flips: 0, stamps: 0 };
    (window as any).__cnEffects = log;
    const Native = window.AudioContext;
    if (Native) {
      class Audio extends Native {
        constructor(...args: any[]) {
          super(...args);
          log.contexts++;
        }
        createOscillator() {
          const o = super.createOscillator(),
            start = o.start.bind(o);
          o.start = (...args: any[]) => {
            log.sounds++;
            start(...args);
          };
          return o;
        }
      }
      Object.defineProperty(window, 'AudioContext', { value: Audio });
    }
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (frames: any, options: any) {
      const text = JSON.stringify(frames);
      if (text.includes('rotateX')) log.flips++;
      if (text.includes('scale(1.3)')) log.stamps++;
      return animate.call(this, frames, options);
    };
  });
  await page.goto('/practice/codenames');
  expect(await page.evaluate(() => (window as any).__cnEffects.contexts)).toBe(
    0,
  );
  await settings(page);
  await close(page);
  await expect
    .poll(() => page.evaluate(() => (window as any).__cnEffects.contexts))
    .toBe(1);
  expect(await page.evaluate(() => (window as any).__cnEffects.sounds)).toBe(0);
  const key = await practiceKey(page);
  const team = await page.locator('.cn-table').getAttribute('data-active-team');
  const target = key.find((c) => c.identity === team)!.card;
  await page.locator(`[data-card="${target}"]`).click();
  await page.locator('.confirmation .primary').click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__cnEffects.flips))
    .toBe(1);
  expect(await page.evaluate(() => (window as any).__cnEffects.stamps)).toBe(0);
  await expect
    .poll(() => page.evaluate(() => (window as any).__cnEffects.sounds))
    .toBeGreaterThan(0);
  await page.setViewportSize({ width: 390, height: 844 });
  // Resize/visibility settle immediately: the next new accepted reveal still animates.
  const nextTarget = key.find(
    (c) => c.identity === team && c.card !== target,
  )!.card;
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.locator(`[data-card="${nextTarget}"]`).click();
  await page.locator('.confirmation .primary').click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__cnEffects.flips))
    .toBe(2);
  const sounds = await page.evaluate(() => (window as any).__cnEffects.sounds);
  await settings(page);
  await page.getByLabel('Sound', { exact: true }).uncheck();
  await page.getByLabel('Reduce motion', { exact: true }).check();
  await page.getByLabel('Volume', { exact: true }).focus();
  await page.keyboard.press('Home');
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
  await close(page);
  expect(await page.evaluate(() => (window as any).__cnEffects.sounds)).toBe(
    sounds,
  );
  await capture(page, info.outputPath('accepted-reveal.webp'));
  await reveal(page, key.find((c) => c.identity === 'civilian')!.card);
  expect(await page.evaluate(() => (window as any).__cnEffects.sounds)).toBe(
    sounds,
  );
  expect(await page.evaluate(() => (window as any).__cnEffects.flips)).toBe(2);
  const preferences = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('codenames:preferences')!),
  );
  expect(preferences).toEqual({
    sound: false,
    volume: 0.25,
    reduced: true,
    showKey: true,
  });
  await page.reload();
  await settings(page);
  await expect(page.getByLabel('Sound', { exact: true })).not.toBeChecked();
  await expect(page.getByLabel('Reduce motion', { exact: true })).toBeChecked();
  expect(await page.evaluate(() => (window as any).__cnEffects.contexts)).toBe(
    0,
  );
});

test('clue composer remains reachable with enlarged text and missing artwork at all sizes', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  await page.route('**/*.webp', (route) => route.abort());
  await page.goto('/practice/codenames');
  for (const lang of ['en', 'es']) {
    if (lang === 'es') {
      await settings(page);
      await page.locator('dialog select').last().selectOption('es');
    }
    for (const size of sizes) {
      await page.setViewportSize(size);
      await page.evaluate(
        () => (document.documentElement.style.fontSize = '200%'),
      );
      await expect(page.locator('.cn-table')).toHaveClass(/compact/);
      await geometry(page, size.width, size.height);
      await page.locator('.compact-players').click();
      await expect(page.locator('dialog .player-list li')).toHaveCount(4);
      await close(page);
      await page.locator('.compact-key').click();
      await expect(page.locator('dialog .key-cell')).toHaveCount(25);
      await close(page);
      await page.locator('.give-clue').click();
      await page.locator('.clue-form input').fill('Café');
      await page.locator('.clue-form select').selectOption('0');
      await page.locator('.clue-form button').focus();
      await expect(page.locator('.clue-form button')).toBeInViewport();
      await page.keyboard.press('Escape');
      await expect(page.locator('.give-clue')).toBeFocused();
      await page.evaluate(() => (document.documentElement.style.fontSize = ''));
      await expect(page.locator('.cn-table')).not.toHaveClass(/enlarged/);
    }
  }
  await page.locator('.give-clue').click();
  await page.locator('.clue-form input').fill('Café');
  await page.locator('.clue-form button').click();
  await expect(page.locator('.cn-table')).toHaveAttribute(
    'data-phase',
    'guessing',
  );
  await geometry(page, 320, 568);
  await capture(page, info.outputPath('missing-artwork.webp'));
});

test('wood and props load and decode through the asset pipeline', async ({
  page,
}) => {
  // CI checks production; set this locally to exercise the same assertion in Vite.
  const urls = ['/practice/codenames'];
  if (process.env.CODENAMES_DEV_URL)
    urls.push(`${process.env.CODENAMES_DEV_URL}/practice/codenames`);
  for (const url of urls) {
    await page.goto(url);
    await expect(page.locator('.cn-table')).toBeVisible();
    const assets = await page.evaluate(() => {
      const table = document.querySelector('.cn-table')!;
      const wood =
        getComputedStyle(table).backgroundImage.match(/url\("([^"]+)"\)/)?.[1];
      if (!wood) throw new Error('The table has no resolved wood URL');
      return [
        wood,
        ...Array.from(
          table.querySelectorAll<HTMLImageElement>('.prop'),
          (image) => image.src,
        ),
      ];
    });
    expect(assets).toHaveLength(6);
    for (const asset of assets) {
      const response = await page.request.get(asset);
      expect(response.status(), asset).toBe(200);
      expect(response.headers()['content-type'], asset).toContain('image/webp');
      const dimensions = await page.evaluate(async (src) => {
        const image = new Image();
        image.src = src;
        await image.decode();
        return [image.naturalWidth, image.naturalHeight];
      }, asset);
      expect(
        dimensions.every((value) => value > 0),
        asset,
      ).toBe(true);
    }
  }
});

test('paper and translucent panel materials retain accessible text contrast', async ({
  page,
}, info) => {
  await page.setViewportSize(sizes[0]!);
  await page.goto('/practice/codenames');
  await scenario(page, 'midgame');
  await settings(page);
  await page
    .getByLabel('Training seat', { exact: true })
    .selectOption('training-0');
  await close(page);
  await page.evaluate(() => document.fonts.ready);
  const targets = [
    '.dossier.revealed.red strong',
    '.dossier.revealed.blue strong',
    '.dossier.civilian strong',
    '.dossier.assassin strong',
    '.team-status h2',
    '.team-status strong',
    '.team-status p',
    '.brand h1',
    '.main-nav button',
    '.room-meta',
    '.viewer small',
    '.round-label',
    '.turn-pill',
    '.active-clue b',
    '.active-clue span',
    '.players-panel h2',
    '.player-list li > span:last-child',
    '.player-list small',
    '.key-panel h3',
    '.key-body p',
    '.history-panel h2',
    '.history-panel header small',
    '.team-label',
    '.history-title strong',
    '.history-entry > small',
    '.guess',
  ];
  await expect(
    page.locator('.dossier svg, .dossier img, .dossier .key-mark'),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      Array.from(document.fonts).some(
        (face) =>
          face.family.includes('Codenames Roboto Condensed') &&
          face.status === 'loaded',
      ),
    ),
  ).toBe(true);
  const cardEdges = await page.locator('.dossier').evaluateAll((cards) =>
    cards.map((card) => {
      const style = getComputedStyle(card);
      return { outline: style.outlineStyle, shadow: style.boxShadow };
    }),
  );
  expect(cardEdges).toHaveLength(25);
  expect(
    cardEdges.every(
      (edge) => edge.outline === 'none' && !edge.shadow.includes('inset'),
    ),
  ).toBe(true);
  // Sample the actual browser-composited background underneath every text run.
  // This includes wood, props, lighting, paper and all translucent layers, at their
  // rendered positions; source-image highlights elsewhere on the table don't count.
  for (const team of ['red', 'blue']) {
    const original = await page.locator('.turn-pill').getAttribute('class');
    await page
      .locator('.turn-pill')
      .evaluate((el, team) => (el.className = `turn-pill ${team}`), team);
    const samples = await page.evaluate((targets) => {
      for (const panel of document.querySelectorAll('.glass, .team-status')) {
        const style = getComputedStyle(panel);
        const team = panel.classList.contains('team-status');
        const stops = [...style.backgroundImage.matchAll(/rgba?\(([^)]+)\)/g)];
        if (!stops.length) throw new Error('Missing panel gradient');
        for (const stop of stops) {
          const alpha = Number(stop[1]!.split(',')[3] ?? 1);
          if (
            !Number.isFinite(alpha) ||
            (team ? alpha !== 1 : alpha <= 0 || alpha >= 0.85)
          )
            throw new Error(
              team
                ? 'Team surface must be opaque'
                : 'Glass must remain translucent',
            );
        }
        if (!team && style.backgroundImage.includes('url('))
          throw new Error('Glass must expose the actual backdrop');
        if (
          !team &&
          CSS.supports('backdrop-filter', 'blur(1px)') &&
          style.backdropFilter === 'none'
        )
          throw new Error('Glass backdrop filter is missing');
      }
      return targets.flatMap((selector) => {
        const elements = [...document.querySelectorAll(selector)];
        if (!elements.length)
          throw new Error(`Missing contrast target: ${selector}`);
        return elements.flatMap((el) => {
          const colour = getComputedStyle(el).color;
          const match = colour.match(/^rgba?\(([^)]+)\)$/);
          if (!match) throw new Error(`Unsupported colour: ${colour}`);
          const ink = match[1]!.split(',').map(Number);
          if (
            ink.length !== 3 ||
            ink.some((c) => !Number.isFinite(c) || c < 0 || c > 255)
          )
            throw new Error(`Invalid or translucent text colour: ${colour}`);
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          const rects: {
            x: number;
            y: number;
            width: number;
            height: number;
          }[] = [];
          while (walker.nextNode()) {
            if (
              !walker.currentNode.textContent?.trim() ||
              walker.currentNode.parentElement?.closest('.sr-only')
            )
              continue;
            const range = document.createRange();
            range.selectNodeContents(walker.currentNode);
            for (const rect of range.getClientRects())
              if (rect.width > 0 && rect.height > 0)
                rects.push({
                  x: rect.x,
                  y: rect.y,
                  width: rect.width,
                  height: rect.height,
                });
          }
          if (!rects.length) throw new Error(`No measurable text: ${selector}`);
          return { selector, ink, rects };
        });
      });
    }, targets);
    const hideInk = await page.addStyleTag({
      content:
        '.cn-table * { color: transparent !important; text-shadow: none !important; } .cn-table svg { visibility: hidden !important; }',
    });
    let background: Buffer;
    try {
      background = await page.screenshot({
        animations: 'disabled',
        scale: 'css',
      });
    } finally {
      await hideInk.evaluate((el) => el.remove());
      await page
        .locator('.turn-pill')
        .evaluate((el, original) => (el.className = original!), original);
    }
    const ratios = await page.evaluate(
      async ({ samples, imageUrl }) => {
        const image = new Image();
        image.src = imageUrl;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        if (!canvas.width || !canvas.height)
          throw new Error('Empty background capture');
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(image, 0, 0);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const lum = (rgb: number[]) =>
          rgb.reduce((sum, channel, i) => {
            const v = channel / 255;
            return (
              sum +
              (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4) *
                [0.2126, 0.7152, 0.0722][i]!
            );
          }, 0);
        return samples.map(({ selector, ink, rects }) => {
          const foreground = lum(ink);
          let ratio = Infinity,
            count = 0;
          for (const rect of rects) {
            if (
              rect.x < 0 ||
              rect.y < 0 ||
              rect.x + rect.width > canvas.width ||
              rect.y + rect.height > canvas.height
            )
              throw new Error(`Text outside capture: ${selector}`);
            for (
              let y = Math.ceil(rect.y);
              y < Math.floor(rect.y + rect.height);
              y++
            )
              for (
                let x = Math.ceil(rect.x);
                x < Math.floor(rect.x + rect.width);
                x++
              ) {
                const offset = (y * canvas.width + x) * 4;
                if (pixels[offset + 3] !== 255)
                  throw new Error('Invalid background pixel');
                const back = lum([
                  pixels[offset]!,
                  pixels[offset + 1]!,
                  pixels[offset + 2]!,
                ]);
                ratio = Math.min(
                  ratio,
                  (Math.max(foreground, back) + 0.05) /
                    (Math.min(foreground, back) + 0.05),
                );
                count++;
              }
          }
          if (!count || !Number.isFinite(ratio) || ratio < 1 || ratio > 21)
            throw new Error(`Invalid measurement: ${selector}`);
          return { selector, ratio, pixels: count };
        });
      },
      {
        samples,
        imageUrl: `data:image/png;base64,${background.toString('base64')}`,
      },
    );
    await info.attach(`material-contrast-${team}`, {
      body: JSON.stringify(ratios, null, 2),
      contentType: 'application/json',
    });
    for (const result of ratios)
      expect
        .soft(result.ratio, `${team} turn: ${result.selector}`)
        .toBeGreaterThanOrEqual(4.5);
  }
  await capture(page, info.outputPath('spymaster.webp'));
});
