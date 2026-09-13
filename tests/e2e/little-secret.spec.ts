import { test, expect, type Page } from '@playwright/test';
import type { RoomView } from '@board-games/shared';
import type { View } from '../../games/little-secret/src/types.js';
test.use({ actionTimeout: 15000 });
const settings = (page: Page) =>
  page.getByRole('button', { name: 'Settings', exact: true }).click();
const close = (page: Page) =>
  page.getByRole('button', { name: 'Close', exact: true }).click();
async function scenario(page: Page, id: string) {
  await settings(page);
  await page.getByLabel('Training scenario', { exact: true }).selectOption(id);
  await close(page);
}
test('bilingual illustrated guide, local reactions, shared victory and responsive nine-seat training', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.game-names button')).toHaveCount(7);
  await page
    .locator('.game-names button')
    .filter({ hasText: 'Little Secret' })
    .click();
  await page.getByRole('button', { name: 'Rules', exact: true }).click();
  await expect(page.locator('.rulebook')).toBeVisible();
  await page.locator('.example-toggle').first().click();
  await expect(page.locator('.scenario .scene')).toBeVisible();
  await page.getByRole('button', { name: /Next/ }).click();
  await expect(page.locator('.frame-label')).toContainText('Step 2');
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Rules', exact: true }),
  ).toBeFocused();
  await page.getByLabel('Language', { exact: true }).selectOption('es');
  await page
    .locator('.game-names button')
    .filter({ hasText: 'Little Secret' })
    .click();
  await page.getByRole('button', { name: 'Reglas', exact: true }).click();
  await page.getByRole('searchbox').fill('Periodista');
  await expect(page.locator('.chapter-content')).toContainText(
    'única oportunidad',
  );
  await page.keyboard.press('Escape');
  await page.getByLabel('Idioma', { exact: true }).selectOption('en');
  await page
    .locator('.game-names button')
    .filter({ hasText: 'Little Secret' })
    .click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await page.getByRole('link', { name: /Try on your own/ }).click();
  await expect(page).toHaveURL(/practice\/little-secret/);
  await page.addInitScript(() => {
    Object.defineProperty(window, 'AudioContext', {
      value: undefined,
      configurable: true,
    });
  });
  await page.reload();
  await page
    .getByRole('button', { name: 'Reveal my secret', exact: true })
    .click();
  await expect(page.getByTestId('own-secret')).toBeVisible();
  await page.evaluate(() =>
    document.dispatchEvent(new Event('visibilitychange')),
  );
  await expect(page.getByTestId('own-secret')).toHaveCount(0);
  await scenario(page, 'journalist');
  await expect(page.getByLabel('Your answer', { exact: true })).toBeVisible();
  await page.getByLabel('Your answer', { exact: true }).fill('wrong');
  await page.getByRole('button', { name: 'Confirm my only guess' }).click();
  await expect(page.locator('.ls-table')).toHaveAttribute(
    'data-phase',
    'clues',
  );
  await scenario(page, 'revenant');
  await page
    .getByLabel('Choose a player', { exact: true })
    .selectOption('training-4');
  await page
    .getByRole('button', { name: 'Confirm elimination', exact: true })
    .click();
  await expect(page.getByLabel('Your answer', { exact: true })).toBeVisible();
  await scenario(page, 'rps');
  for (const symbol of ['Rock', 'Rock', 'Paper']) {
    await page.getByRole('button', { name: symbol, exact: true }).click();
    await page
      .getByRole('button', { name: 'Confirm symbol', exact: false })
      .click();
  }
  await expect(page.locator('.ls-table')).toHaveAttribute('data-phase', 'tie');
  for (const symbol of ['Scissors', 'Rock']) {
    await page.getByRole('button', { name: symbol, exact: true }).click();
    await page
      .getByRole('button', { name: 'Confirm symbol', exact: false })
      .click();
  }
  await expect(page.locator('.ls-table')).toHaveAttribute(
    'data-phase',
    /missionResult|reactions/,
  );
  await scenario(page, 'sage');
  await page
    .getByLabel('Choose a player', { exact: true })
    .selectOption('training-1');
  await page
    .getByRole('button', { name: 'Confirm elimination', exact: true })
    .click();
  await expect(page.locator('.seat.out')).toHaveCount(1);
  await scenario(page, 'scores');
  await expect(page.locator('.action-area')).toContainText('Winners: Ada, Bea');
  await scenario(page, 'nine');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const [width, height] of [
    [1440, 900],
    [768, 1024],
    [360, 640],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(page.locator('.seat')).toHaveCount(9);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const action = (await page.locator('.action-area').boundingBox())!;
    for (const seat of await page.locator('.seat').all()) {
      const b = (await seat.boundingBox())!;
      expect(
        b.x + b.width <= action.x ||
          b.x >= action.x + action.width ||
          b.y + b.height <= action.y ||
          b.y >= action.y + action.height,
      ).toBe(true);
    }
    await page.screenshot({
      path: info.outputPath(`little-secret-${width}.png`),
      fullPage: true,
    });
  }
  await settings(page);
  await page
    .getByRole('dialog')
    .getByLabel('Language', { exact: true })
    .selectOption('es');
  await expect(
    page.getByRole('button', { name: 'Ajustes', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.ls-table')).toHaveAttribute(
    'data-phase',
    'volunteer',
  );
  expect(errors).toEqual([]);
});
for (const count of [3, 9])
  test(`${count} independent browser seats finish ${count === 9 ? 'a powers' : 'an ordinary'} match and preserve private secrets through reload`, async ({
    browser,
    baseURL,
  }, info) => {
    test.setTimeout(420000);
    const contexts = await Promise.all(
      Array.from({ length: count }, () =>
        browser.newContext({ baseURL, viewport: { width: 1280, height: 900 } }),
      ),
    );
    const pages = await Promise.all(contexts.map((c) => c.newPage()));
    const snapshots: (RoomView | null)[] = Array(count).fill(null),
      errors: string[] = [];
    pages.forEach((p, i) => {
      p.on('pageerror', (e) => errors.push(e.message));
      p.on('websocket', (socket) =>
        socket.on('framereceived', (frame) => {
          const data = String(frame.payload);
          if (data.startsWith('42["snapshot"'))
            snapshots[i] = JSON.parse(data.slice(2))[1];
        }),
      );
    });
    try {
      const host = pages[0]!;
      await host.goto('/');
      await host
        .locator('.game-names button')
        .filter({ hasText: 'Little Secret' })
        .click();
      await host
        .getByRole('button', { name: 'Start game', exact: true })
        .click();
      await host.getByLabel('Your name', { exact: true }).fill('Seat 0');
      if (count === 9)
        await host.getByLabel('Classic powers · 6–9 players').check();
      await host
        .getByRole('button', { name: 'Create room →', exact: true })
        .click();
      await expect(host).toHaveURL(/\/room\//);
      for (let i = 1; i < count; i++) {
        await pages[i]!.goto(host.url());
        await pages[i]!.getByLabel('Your name', { exact: true }).fill(
          `Seat ${i}`,
        );
        await pages[i]!.getByRole('button', {
          name: 'Join an available seat',
          exact: true,
        }).click();
      }
      await expect(host.locator('.roster li')).toHaveCount(count);
      await host
        .getByRole('button', { name: 'Start game', exact: true })
        .click();
      for (const p of pages)
        await p.getByRole('button', { name: 'Ready', exact: true }).click();
      await expect(host.locator('.ls-table')).toHaveAttribute(
        'data-phase',
        'volunteer',
      );
      const own = (i = 0) => snapshots[i]!.game as View;
      const index = (id: string) =>
        snapshots.findIndex((s) => s?.playerId === id);
      for (let i = 0; i < count; i++) {
        expect(own(i).private.solution).toBeNull();
        expect(own(i).public).not.toHaveProperty('roles');
        expect(own(i).public).not.toHaveProperty('password');
        await expect(pages[i]!.getByTestId('own-secret')).toHaveCount(0);
      }
      const initialWord = own().private.password;
      await settings(host);
      await host
        .getByRole('dialog')
        .getByLabel('Language', { exact: true })
        .selectOption('es');
      await expect(
        host.getByRole('button', { name: 'Ajustes', exact: true }),
      ).toBeVisible();
      expect(own().private.password).toBe(initialWord);
      await host.getByRole('button', { name: 'Ajustes', exact: true }).click();
      await host
        .getByRole('dialog')
        .getByLabel('Idioma', { exact: true })
        .selectOption('en');
      await expect(
        host.getByRole('button', { name: 'Settings', exact: true }),
      ).toBeVisible();

      let steps = 0;
      const reloaded = new Set<string>();
      while (own().public.phase !== 'finished' && steps++ < 1800) {
        const s = own().public,
          sequence = s.actionSequence;
        let actor = 0;
        if (s.phase === 'clues') actor = index(s.speaker!);
        else if (s.phase === 'debate') actor = index(snapshots[0]!.hostId);
        else if (s.prompt) actor = index(s.prompt.actor);
        else if (s.phase === 'vote')
          actor = index(
            s.players.find(
              (p) => !s.eliminated.includes(p) && !s.committed.includes(p),
            )!,
          );
        else if (s.phase === 'tie')
          actor = index(s.candidates.find((p) => !s.rpsCommitted.includes(p))!);
        else if (s.phase === 'missionResult')
          actor = index(s.players.find((p) => !s.continued.includes(p))!);
        const page = pages[actor]!;
        if (
          ['vote', 'tie', 'reactions'].includes(s.phase) &&
          !reloaded.has(s.phase)
        ) {
          const before = own(actor).private;
          await page.reload();
          await expect(page.locator('.ls-table')).toHaveAttribute(
            'data-phase',
            s.phase,
          );
          expect(own(actor).private).toEqual(before);
          await expect(page.getByTestId('own-secret')).toHaveCount(0);
          reloaded.add(s.phase);
        }
        if (s.phase === 'volunteer')
          await page
            .getByRole('button', { name: 'I will start', exact: true })
            .click();
        else if (s.phase === 'clues')
          await page
            .getByRole('button', { name: 'Clue given', exact: true })
            .click();
        else if (s.phase === 'debate')
          await page
            .getByRole('button', { name: 'Start voting', exact: true })
            .click();
        else if (s.phase === 'vote') {
          const alive = s.players.filter((p) => !s.eliminated.includes(p));
          const player = snapshots[actor]!.playerId;
          const target =
            s.mission === 1 && s.cycle === 1
              ? count === 3
                ? alive[(alive.indexOf(player) + 1) % alive.length]!
                : (alive.find(
                    (p) =>
                      p !== player &&
                      own(index(p)).private.role === 'journalist',
                  ) ?? alive.find((p) => p !== player)!)
              : alive.find((p) => p !== player)!;
          await page
            .getByLabel('Choose a player', { exact: true })
            .selectOption(target);
          await page
            .getByRole('button', { name: 'Confirm vote', exact: false })
            .click();
        } else if (s.prompt?.kind === 'journalist') {
          await page
            .getByLabel('Your answer', { exact: true })
            .fill('intentionally incorrect');
          await page
            .getByRole('button', { name: 'Confirm my only guess', exact: true })
            .click();
        } else if (s.prompt?.kind === 'revenant')
          await page
            .getByRole('button', { name: 'Decline elimination', exact: true })
            .click();
        else if (s.prompt?.kind === 'sage') {
          await page
            .getByLabel('Choose a player', { exact: true })
            .selectOption(s.candidates[0]!);
          await page
            .getByRole('button', { name: 'Confirm elimination', exact: true })
            .click();
        } else if (s.phase === 'tie') {
          await page
            .getByRole('button', {
              name:
                s.candidates[0] === snapshots[actor]!.playerId
                  ? 'Scissors'
                  : 'Rock',
              exact: true,
            })
            .click();
          await page
            .getByRole('button', { name: 'Confirm symbol', exact: false })
            .click();
        } else if (s.phase === 'missionResult')
          await page
            .getByRole('button', {
              name: 'Ready for the next mission',
              exact: true,
            })
            .click();
        else throw Error(s.phase);
        await expect
          .poll(() => own().public.actionSequence)
          .toBeGreaterThan(sequence);
      }
      await expect(host.locator('.ls-table')).toHaveAttribute(
        'data-phase',
        'finished',
      );
      expect(own().public.result!.winners.length).toBeGreaterThan(0);
      expect(reloaded.has('vote')).toBe(true);
      expect(reloaded.has(count === 3 ? 'tie' : 'reactions')).toBe(true);
      expect(errors).toEqual([]);
      await host.screenshot({
        path: info.outputPath(`finished-${count}.png`),
        fullPage: true,
      });
      const currentHost = pages[index(snapshots[0]!.hostId)]!;
      await currentHost
        .getByRole('button', { name: 'New match', exact: true })
        .click();
      await expect(host.locator('.ls-table')).toHaveAttribute(
        'data-phase',
        'setup',
      );
    } finally {
      await Promise.all(contexts.map((c) => c.close()));
    }
  });
