import { test, expect, type Page } from '@playwright/test';
test.use({ actionTimeout: 15000 });
async function settings(page: Page) {
  await page
    .getByRole('button', { name: 'Table settings', exact: true })
    .click();
}
async function close(page: Page) {
  await page.getByRole('button', { name: 'Close', exact: true }).click();
}
async function clue(spy: Page, reviewer: Page, count = 'unlimited') {
  await spy.getByLabel('Clue word', { exact: true }).fill('Ocean');
  await spy.getByLabel('Count', { exact: true }).selectOption(count);
  await spy.getByRole('button', { name: 'Send clue for review' }).click();
  await reviewer
    .getByRole('button', { name: 'Allow clue', exact: true })
    .click();
}
test('four private clients finish an ordinary round, rematch, and lose to the assassin', async ({
  browser,
  baseURL,
}, info) => {
  test.setTimeout(180000);
  const contexts = await Promise.all(
    Array.from({ length: 4 }, () =>
      browser.newContext({
        baseURL,
        viewport: { width: 1280, height: 800 },
        recordVideo: {
          dir: info.outputPath('videos'),
          size: { width: 1280, height: 800 },
        },
      }),
    ),
  );
  const pages = await Promise.all(contexts.map((c) => c.newPage()));
  const errors: string[] = [],
    snapshots: any[][] = pages.map(() => []);
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
    const url = host.url();
    for (let i = 1; i < 4; i++) {
      await pages[i]!.goto(url);
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
        const p = pages[i]!;
        await expect(p.locator('.setup')).toBeVisible();
        await p
          .locator(`.team-panel.${i < 2 ? 'red' : 'blue'}`)
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
    await host.screenshot({
      animations: 'disabled',
      path: info.outputPath('operative-desktop.png'),
    });
    await pages[1]!.screenshot({
      animations: 'disabled',
      path: info.outputPath('spymaster-desktop.png'),
    });
    expect(await host.locator('.dossier[data-identity]').count()).toBe(0);
    expect(await pages[1]!.locator('.dossier[data-identity]').count()).toBe(25);
    const active = (await pages[1]!
      .getByLabel('Clue word', { exact: true })
      .count())
      ? 0
      : 2;
    const spy = pages[active + 1]!,
      operative = pages[active]!,
      reviewer = pages[active === 0 ? 3 : 1]!;
    await clue(spy, reviewer);
    const targets = await spy
      .locator(`.dossier[data-identity="${active === 0 ? 'red' : 'blue'}"]`)
      .evaluateAll((es) => es.map((e) => e.getAttribute('data-card')!));
    for (const card of targets) {
      await operative.locator(`[data-card="${card}"]`).click();
      await expect(operative.locator('.confirmation')).toContainText(
        'Selected dossier',
      );
      await operative.locator('.confirmation .primary').click();
      await expect(operative.locator(`[data-card="${card}"]`)).toHaveClass(
        /revealed/,
      );
      if (card === targets[0]) {
        await operative.context().setOffline(true);
        await expect(operative.locator('.notice')).toContainText(
          'Disconnected',
        );
        await operative.context().setOffline(false);
        await expect(operative.locator('.notice')).toHaveCount(0);
        await expect(operative.locator('.confirmation button')).toHaveCount(0);
        expect(
          await operative
            .locator('.dossier:not(.revealed)[data-identity]')
            .count(),
        ).toBe(0);
      }
    }
    await expect(host.locator('.result')).toBeVisible();
    await host.screenshot({
      animations: 'disabled',
      path: info.outputPath('ordinary-result.png'),
    });
    for (const index of [0, 2])
      for (const room of snapshots[index]!) {
        if (room.game?.public.phase !== 'finished')
          expect(room.game?.private.key).toBeUndefined();
        for (const cell of room.game?.public.board ?? [])
          if (!cell.revealed && room.game.public.phase !== 'finished')
            expect(cell.identity).toBeUndefined();
      }
    await host
      .getByRole('button', { name: 'New case · choose teams again' })
      .click();
    await roles();
    const next = (await pages[1]!
      .getByLabel('Clue word', { exact: true })
      .count())
      ? 0
      : 2;
    await clue(pages[next + 1]!, pages[next === 0 ? 3 : 1]!, '1');
    const assassin = await pages[next + 1]!.locator(
      '.dossier[data-identity="assassin"]',
    ).getAttribute('data-card');
    await pages[next]!.locator(`[data-card="${assassin}"]`).click();
    await pages[next]!.locator('.confirmation .primary').click();
    await expect(host.locator('.result')).toContainText('assassin');
    await host.screenshot({
      animations: 'disabled',
      path: info.outputPath('assassin-result.png'),
    });
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});
test('responsive practice, keyboard confirmation, searchable manual, settings and Spanish stable board', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/practice/codenames');
  await page.getByRole('button', { name: 'Field manual', exact: true }).click();
  await page.getByLabel('Search the field manual').fill('unlimited');
  await expect(page.locator('dialog')).toContainText('Extra guesses');
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Field manual', exact: true }),
  ).toBeFocused();
  for (const size of [
    { width: 1440, height: 900 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 360, height: 640 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(size);
    await expect(page.locator('.dossier')).toHaveCount(25);
    const widths = await page.locator('.dossier').evaluateAll((es) =>
      es.map((e) => ({
        w: e.getBoundingClientRect().width,
        h: e.getBoundingClientRect().height,
      })),
    );
    expect(widths.every((x) => x.w >= 44 && x.h >= 44)).toBe(true);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(size.width);
    await page.screenshot({
      animations: 'disabled',
      path: info.outputPath(`training-${size.width}.png`),
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await settings(page);
  await page.getByLabel('Reduce motion', { exact: true }).check();
  await page.getByLabel('Sound', { exact: true }).uncheck();
  await close(page);
  await page.getByLabel('Clue word', { exact: true }).fill('Sea');
  await page.getByRole('button', { name: 'Send clue for review' }).click();
  await page.getByRole('button', { name: 'Allow clue', exact: true }).click();
  await expect(page.locator('.dossier[data-identity]')).toHaveCount(0);
  await page.locator('.dossier').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.dossier.revealed')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('.confirmation button')).toHaveCount(0);
  const words = await page.locator('.dossier strong').allTextContents();
  await settings(page);
  await page
    .locator('dialog')
    .getByRole('combobox', { name: 'Language', exact: true })
    .selectOption('es');
  await expect(
    page.getByRole('button', { name: 'Manual de campo', exact: true }),
  ).toBeVisible();
  expect(await page.locator('.dossier strong').allTextContents()).toEqual(
    words,
  );
  await page.screenshot({
    animations: 'disabled',
    path: info.outputPath('spanish-operative.png'),
  });
  expect(errors).toEqual([]);
});
test('eight seats consent to visible creation agreements and fit the table', async ({
  browser,
  baseURL,
}, info) => {
  test.setTimeout(150000);
  const contexts = await Promise.all(
    Array.from({ length: 8 }, () =>
      browser.newContext({ baseURL, viewport: { width: 768, height: 1024 } }),
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
    await host.getByLabel('Allow agreed abbreviations').check();
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
    await expect(host.locator('.agreements')).toContainText('Allowed');
    await host.screenshot({
      animations: 'disabled',
      path: info.outputPath('eight-seat-setup.png'),
    });
    for (const p of pages)
      await p.getByRole('button', { name: /I’m ready/ }).click();
    await expect(host.locator('.dossier')).toHaveCount(25);
    await expect(host.locator('.mobile-counters')).toContainText('Agent 7');
    await host.screenshot({
      animations: 'disabled',
      path: info.outputPath('eight-seat-tablet.png'),
    });
    await host.setViewportSize({ width: 320, height: 568 });
    await host
      .locator('.mobile-counters details')
      .first()
      .locator('summary')
      .click();
    await expect(host.locator('.mobile-counters')).toContainText('Spymaster');
    await host.evaluate(
      () => (document.documentElement.style.fontSize = '200%'),
    );
    expect(
      await host.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(320);
    await host.screenshot({
      animations: 'disabled',
      path: info.outputPath('eight-seat-200-text.png'),
    });
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
  await page.getByRole('button', { name: 'Field manual', exact: true }).click();
  await close(page);
  await expect
    .poll(() => page.evaluate(() => (window as any).__cnEffects.contexts))
    .toBe(1);
  expect(await page.evaluate(() => (window as any).__cnEffects.sounds)).toBe(0);
  await page.getByLabel('Clue word', { exact: true }).fill('Sky');
  await page.getByLabel('Count', { exact: true }).selectOption('2');
  const target = await page
    .locator('.dossier.key.blue')
    .first()
    .getAttribute('data-card');
  await page.getByRole('button', { name: 'Send clue for review' }).click();
  await page.getByRole('button', { name: 'Allow clue', exact: true }).click();
  await page.locator(`[data-card="${target}"]`).click();
  await page.locator('.confirmation .primary').click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__cnEffects.flips))
    .toBe(1);
  expect(await page.evaluate(() => (window as any).__cnEffects.stamps)).toBe(1);
  await expect
    .poll(() => page.evaluate(() => (window as any).__cnEffects.sounds))
    .toBeGreaterThan(0);
  await page.setViewportSize({ width: 390, height: 844 });
  const sounds = await page.evaluate(() => (window as any).__cnEffects.sounds);
  await settings(page);
  await page.getByLabel('Sound', { exact: true }).uncheck();
  await page.getByLabel('Reduce motion', { exact: true }).check();
  await close(page);
  expect(await page.evaluate(() => (window as any).__cnEffects.sounds)).toBe(
    sounds,
  );
  await page.screenshot({
    path: info.outputPath('accepted-reveal.png'),
    animations: 'disabled',
  });
});
test('unavailable audio never blocks clue review or card confirmation', async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, 'AudioContext', { value: undefined }),
  );
  await page.goto('/practice/codenames');
  const target = await page
    .locator('.dossier.key.blue')
    .first()
    .getAttribute('data-card');
  await page.getByLabel('Clue word', { exact: true }).fill('Sky');
  await page.getByRole('button', { name: 'Send clue for review' }).click();
  await page.getByRole('button', { name: 'Allow clue', exact: true }).click();
  await page.locator(`[data-card="${target}"]`).click();
  await page.locator('.confirmation .primary').click();
  await expect(page.locator(`[data-card="${target}"]`)).toHaveClass(/revealed/);
});
