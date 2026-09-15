import {
  test,
  expect,
  type Page,
  type Browser,
  type BrowserContext,
} from '@playwright/test';
test.use({ video: 'on', actionTimeout: 15_000 });
async function settings(page: Page) {
  await page
    .getByRole('button', { name: 'Table settings', exact: true })
    .click();
}
async function close(page: Page) {
  await page.getByRole('button', { name: 'Close', exact: true }).click();
}
async function scenario(page: Page, id: string) {
  if (await page.getByRole('dialog').isVisible()) await close(page);
  await settings(page);
  await page.getByLabel('Practice scenario').selectOption(id);
  await close(page);
}
async function source(page: Page) {
  await page
    .locator(
      '.factory-tiles button:enabled,.factory-open:enabled,.center-group:enabled',
    )
    .first()
    .click();
  if (await page.locator('.factory-picker').count())
    await page.locator('.factory-picker button[data-color]').first().click();
}
async function choose(page: Page, row: number | null = 0) {
  await source(page);
  if (row === null)
    await page.getByRole('button', { name: 'Floor line', exact: true }).click();
  else
    await page
      .getByRole('button', { name: new RegExp(`^Line ${row + 1} ·`) })
      .click();
}
async function clearFactories(page: Page) {
  const rects = await page.locator('.factory-tiles').evaluateAll((nodes) =>
    nodes.map((n) => {
      const r = n.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    }),
  );
  for (let i = 0; i < rects.length; i++)
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i],
        b = rects[j];
      expect(
        a.right <= b.left ||
          b.right <= a.left ||
          a.bottom <= b.top ||
          b.bottom <= a.top,
      ).toBe(true);
    }
}
async function noOverflow(page: Page, width: number) {
  expect(
    await page
      .locator('.surface')
      .evaluate((e) => e.scrollHeight - e.clientHeight),
  ).toBeLessThanOrEqual(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight - innerHeight,
    ),
  ).toBeLessThanOrEqual(1);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(width);
  expect(
    await page.locator('.surface').evaluate((e) => e.scrollWidth),
  ).toBeLessThanOrEqual(width);
}
test('ceramic workshop: keyboard draft, actual flights, help focus, scoring and shared result', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/practice/azul');
  await expect(page.locator('.azul-table')).toHaveAttribute(
    'data-game-revision',
    '0',
  );
  await page.screenshot({ path: info.outputPath('azul-desktop-opening.png') });
  await page.locator('.factory-tiles button:enabled').first().focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: /^Line 2 ·/ }).focus();
  await page.keyboard.press('Enter');
  await page.evaluate(() => {
    (window as any).azulFlights = [];
    new MutationObserver((records) => {
      for (const record of records)
        for (const n of record.addedNodes)
          if (n instanceof HTMLElement && n.classList.contains('azul-flight'))
            (window as any).azulFlights.push(
              n.getAnimations()[0]?.effect?.getKeyframes(),
            );
    }).observe(document.body, { childList: true });
  });
  await page
    .getByRole('button', { name: 'Confirm tiles', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.azul-table')).toHaveAttribute(
    'data-game-revision',
    '1',
  );
  await expect
    .poll(() => page.evaluate(() => (window as any).azulFlights.length))
    .toBeGreaterThan(0);
  expect(
    await page.evaluate(() =>
      (window as any).azulFlights.some((frames: any[]) =>
        frames?.some(
          (f) => f.transform && !f.transform.includes('translate(0,0)'),
        ),
      ),
    ),
  ).toBe(true);
  await page.screenshot({ path: info.outputPath('azul-desktop-draft.png') });
  await expect(page.locator('.azul-flight')).toHaveCount(0);
  const help = page.getByRole('button', {
    name: 'How to play Azul',
    exact: true,
  });
  await help.click();
  await page.getByLabel('Search the guide').fill('axes');
  await expect(
    page.getByRole('heading', { name: 'Count both connected axes' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(help).toBeFocused();
  await scenario(page, 'scoring');
  await choose(page);
  await expect(page.locator('.own-board .row-issue').first()).toContainText(
    'This line is full.',
  );
  await page
    .getByRole('button', { name: 'Confirm tiles', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Round details', exact: true })
    .click();
  await expect(page.locator('.explanations')).toContainText('+6 wall points');
  await expect(page.locator('.explanations')).toContainText(
    '+2 wall points (0 horizontal + 2 vertical)',
  );
  await expect(page.locator('.azul-flight')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('azul-scoring.png') });
  await scenario(page, 'finish');
  await choose(page);
  await page
    .getByRole('button', { name: 'Confirm tiles', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Shared victory: Ada · Bea' }),
  ).toBeVisible();
  await expect(page.locator('.result-boards article')).toHaveCount(2);
  await page.locator('.results').scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('azul-shared-result.png') });
  expect(errors).toEqual([]);
  await noOverflow(page, 1440);
});
test('phone and tablet: nine factories, marker overflow, silent reduced motion and Spanish', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    Object.defineProperty(window, 'AudioContext', {
      get() {
        throw Error('Audio unavailable');
      },
    });
  });
  await page.goto('/practice/azul');
  await scenario(page, 'start4');
  await expect(page.locator('.factory')).toHaveCount(9);
  await expect(page.locator('.opponent')).toHaveCount(3);
  await noOverflow(page, 390);
  await page.screenshot({ path: info.outputPath('azul-phone-four.png') });
  await page.locator('.opponent .inspect').first().click();
  await expect(page.getByRole('dialog').locator('.player-board')).toBeVisible();
  await close(page);
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.screenshot({ path: info.outputPath('azul-tablet-four.png') });
  await noOverflow(page, 768);
  await clearFactories(page);
  await page.setViewportSize({ width: 360, height: 640 });
  await scenario(page, 'overflow');
  await page
    .getByRole('button', {
      name: 'Take 4 · Blue diamond · Center',
      exact: true,
    })
    .click();
  await page.getByRole('button', { name: /^Line 2 ·/ }).click();
  await expect(page.locator('.confirmation')).toContainText('3 to discard');
  await expect(page.locator('.confirmation')).toContainText('3 penalty');
  await page
    .getByRole('button', { name: 'Confirm tiles', exact: true })
    .click();
  await expect(page.locator('.azul-table')).toHaveAttribute(
    'data-game-revision',
    '1',
  );
  await expect(page.locator('.azul-flight')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('azul-phone-overflow.png') });
  await noOverflow(page, 360);
  const acceptedBoard = await page.locator('.own-board .mosaic').innerHTML();
  await settings(page);
  await page.getByLabel('Ceramic sounds').uncheck();
  await page.getByLabel('Volume').fill('0.1');
  await page.getByLabel('Motion', { exact: true }).selectOption('reduced');
  await page.getByRole('dialog').getByLabel('Language').selectOption('es');
  await expect(
    page.getByRole('button', { name: 'Ajustes de la mesa', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Ajustes de la mesa', exact: true })
    .click();
  await expect(page.getByLabel('Sonidos de cerámica')).not.toBeChecked();
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(page.locator('.azul-table')).toHaveAttribute(
    'data-game-revision',
    '1',
  );
  // Exact public piece positions survive a locale change; translated labels differ.
  expect(await page.locator('.own-board .pattern .tile').count()).toBe(2);
  expect(acceptedBoard).toContain('tile blue');
  await page.screenshot({ path: info.outputPath('azul-phone-spanish.png') });
  await noOverflow(page, 360);
});
for (const count of [2, 4])
  test(`${count} browser seats: real create join keyboard/touch draft, opponent projection, reload`, async ({
    browser,
  }, info) => {
    test.setTimeout(240000);
    const contexts: BrowserContext[] = [],
      ownedBrowsers: Browser[] = [];
    try {
      for (let i = 0; i < count; i++) {
        const engine =
          info.project.name === 'webkit'
            ? await browser
                .browserType()
                .launch({ executablePath: process.env.WEBKIT_EXECUTABLE })
            : browser;
        if (engine !== browser) ownedBrowsers.push(engine);
        contexts.push(
          await engine.newContext({
            viewport:
              i === 0
                ? { width: 1440, height: 900 }
                : { width: 390, height: 844 },
            hasTouch: i > 0,
            recordVideo: { dir: info.outputPath(`seat-${i}`) },
          }),
        );
      }
      const pages = await Promise.all(contexts.map((c) => c.newPage())),
        a = pages[0];
      await a.goto('/');
      await a
        .locator('.game-names')
        .getByRole('button', { name: /Azul/ })
        .click();
      await a.getByRole('button', { name: 'Start game', exact: true }).click();
      await a.getByLabel('Your name').fill('Ada');
      await a.getByRole('button', { name: /Create room/ }).click();
      await expect(a).toHaveURL(/\/room\//);
      for (let i = 1; i < count; i++) {
        await pages[i].goto(a.url());
        await pages[i]
          .getByLabel('Your name')
          .fill(['Ada', 'Bea', 'Clara', 'Diego'][i]);
        await pages[i]
          .getByRole('button', { name: 'Join an available seat' })
          .click();
        await expect(pages[i].locator('.roster')).toContainText('Ada');
      }
      await a.getByRole('button', { name: 'Start game', exact: true }).click();
      for (const p of pages)
        await expect(p.locator('.azul-table')).toHaveAttribute(
          'data-game-revision',
          '0',
        );
      let actor = pages[0];
      for (const p of pages)
        if (
          await p
            .locator('.factory-tiles button:enabled,.factory-open:enabled')
            .count()
        )
          actor = p;
      if (actor === a) await choose(actor, null);
      else {
        await source(actor);
        await actor
          .getByRole('button', { name: 'Floor line', exact: true })
          .tap();
      }
      await actor
        .getByRole('button', { name: 'Confirm tiles', exact: true })
        .click();
      for (const p of pages)
        await expect(p.locator('.azul-table')).toHaveAttribute(
          'data-game-revision',
          '1',
        );
      await a.screenshot({
        path: info.outputPath(`azul-real-${count}-desktop.png`),
      });
      await pages[1].screenshot({
        path: info.outputPath(`azul-real-${count}-phone.png`),
      });
      const own = await actor.locator('.own-board').innerText();
      await actor.reload();
      await expect(actor.locator('.azul-table')).toHaveAttribute(
        'data-game-revision',
        '1',
      );
      expect(await actor.locator('.own-board').innerText()).toBe(own);
      await expect(actor.locator('.azul-flight')).toHaveCount(0);
      await settings(actor);
      await expect(
        actor
          .getByRole('dialog')
          .getByRole('button', { name: 'Invite friends', exact: true }),
      ).toBeVisible();
      await close(actor);
      for (const p of pages) {
        await noOverflow(p, p === a ? 1440 : 390);
        await clearFactories(p);
      }
      if (count === 2) {
        for (const p of pages)
          await p.emulateMedia({ reducedMotion: 'reduce' });
        let moves = 1;
        while (moves < 350 && !(await a.locator('.results').count())) {
          let current: Page | undefined;
          for (const p of pages)
            if (
              await p
                .locator(
                  '.factory-tiles button:enabled,.factory-open:enabled,.center-group:enabled',
                )
                .count()
            )
              current = p;
          if (!current) {
            await expect
              .poll(async () => {
                for (const p of pages)
                  if (
                    await p
                      .locator(
                        '.factory-tiles button:enabled,.factory-open:enabled,.center-group:enabled',
                      )
                      .count()
                  )
                    return true;
                return !!(await a.locator('.results').count());
              })
              .toBe(true);
            continue;
          }
          await source(current);
          const lines = current.locator('.pattern:enabled');
          if (await lines.count()) await lines.first().click();
          else
            await current
              .getByRole('button', { name: 'Floor line', exact: true })
              .click();
          await current
            .getByRole('button', { name: 'Confirm tiles', exact: true })
            .click();
          moves++;
          for (const p of pages)
            await expect(p.locator('.azul-table')).toHaveAttribute(
              'data-game-revision',
              String(moves),
            );
        }
        await expect(a.locator('.results')).toBeVisible();
        await a.locator('.results').scrollIntoViewIfNeeded();
        await a.screenshot({ path: info.outputPath('azul-real-final.png') });
        const host = (
          await Promise.all(
            pages.map(async (p) =>
              (await p
                .getByRole('button', { name: 'Play again', exact: true })
                .count())
                ? p
                : null,
            ),
          )
        ).find(Boolean)!;
        await host
          .getByRole('button', { name: 'Play again', exact: true })
          .click();
        for (const p of pages)
          await expect(p.locator('.azul-table')).toHaveAttribute(
            'data-game-revision',
            '0',
          );
      }
    } finally {
      for (const context of contexts) await context.close();
      await Promise.all(ownedBrowsers.map((b) => b.close()));
    }
  });

test('review: right-to-left patterns, readable wall, compact touch targets and effect cancellation', async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: { width: 360, height: 640 },
    hasTouch: true,
    recordVideo: { dir: info.outputPath('review-touch') },
  });
  const page = await context.newPage();
  try {
    await page.goto('/practice/azul');
    await scenario(page, 'overflow');
    const slots = page.locator('.own-board .pattern').nth(1).locator('.slot');
    const right = await slots.nth(0).boundingBox(),
      left = await slots.nth(1).boundingBox();
    expect(right!.x).toBeGreaterThan(left!.x);
    await expect(slots.nth(0).locator('.tile.blue')).toHaveCount(1);
    await expect(slots.nth(1).locator('.empty-slot')).toHaveCount(1);
    await page.locator('.tray-toggle').click();
    await expect(
      page.getByRole('img', {
        name: 'Wall row 1, column 1 · Blue diamond · Empty',
        exact: true,
      }),
    ).toHaveCount(1);
    await page.screenshot({
      path: info.outputPath('azul-review-readable-phone.png'),
    });
    await page.locator('.tray-toggle').click();
    await page.locator('.opponent .inspect').first().tap();
    const dialog = page.getByRole('dialog');
    expect(
      await dialog.evaluate((e) => e.scrollWidth - e.clientWidth),
    ).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: info.outputPath('azul-review-phone-opponent.png'),
    });
    await close(page);
    await page
      .getByRole('button', {
        name: 'Take 4 · Blue diamond · Center',
        exact: true,
      })
      .tap();
    for (const line of await page.locator('dialog .pattern:enabled').all()) {
      expect((await line.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await line.tap();
    }
    await page.getByRole('button', { name: 'Floor line', exact: true }).tap();
    await expect(page.locator('.confirmation')).toContainText('4 to discard');
    await page
      .getByRole('button', { name: 'Confirm tiles', exact: true })
      .tap();
    await expect(page.locator('.azul-table')).toHaveAttribute(
      'data-game-revision',
      '1',
    );
    await noOverflow(page, 360);
    await page.setViewportSize({ width: 768, height: 1024 });
    await scenario(page, 'scoring');
    await choose(page);
    await page
      .getByRole('button', { name: 'Confirm tiles', exact: true })
      .tap();
    await expect(page.locator('.azul-flight').first()).toBeAttached();
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.locator('.azul-flight')).toHaveCount(0);
    await page
      .getByRole('button', { name: 'Round details', exact: true })
      .click();
    await expect(page.locator('.explanations')).toContainText('+6 wall points');
    await scenario(page, 'scoring');
    await choose(page);
    await page
      .getByRole('button', { name: 'Confirm tiles', exact: true })
      .tap();
    await expect(page.locator('.azul-flight').first()).toBeAttached();
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
    await expect(page.locator('.azul-flight')).toHaveCount(0);
    await expect(page.locator('.azul-table')).toHaveAttribute(
      'data-game-revision',
      '1',
    );
    await settings(page);
    await page.getByLabel('Motion', { exact: true }).selectOption('reduced');
    await close(page);
    await expect(page.locator('.azul-flight')).toHaveCount(0);
    await page.setViewportSize({ width: 720, height: 450 });
    await scenario(page, 'start4');
    await clearFactories(page);
    await noOverflow(page, 720);
    await page.screenshot({
      path: info.outputPath('azul-review-zoom-reflow.png'),
    });
  } finally {
    await context.close();
  }
});

for (const [width, height] of [
  [360, 640],
  [390, 844],
  [768, 1024],
  [1100, 700],
  [1440, 900],
  [720, 450],
]) {
  test(`Rich & Dramatic geometry and picker ${width}×${height}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height });
    await page.goto('/practice/azul');
    await page.evaluate(() => document.fonts.ready);
    for (const id of ['start2', 'start3', 'start4']) {
      await scenario(page, id);
      await clearFactories(page);
      await expect(page.locator('.own-board .starter')).toHaveAttribute(
        'aria-hidden',
        'true',
      );
      await noOverflow(page, width);
      const anchors = await page
        .locator('.surface [data-azul-location]')
        .evaluateAll((nodes) =>
          nodes.map((n) => ({
            key: n.getAttribute('data-azul-location'),
            width: n.getBoundingClientRect().width,
            height: n.getBoundingClientRect().height,
          })),
        );
      expect(new Set(anchors.map((a) => a.key)).size).toBe(anchors.length);
      expect(anchors.every((a) => a.width > 0 && a.height > 0)).toBe(true);
      await expect(page.locator('.opponent .player-board button')).toHaveCount(
        0,
      );
      const bounds = await page
        .locator('.factory-open,.factory-tiles button,.center-group')
        .evaluateAll((nodes) =>
          nodes
            .map((n) => n.getBoundingClientRect())
            .map((r, index) => ({
              name: nodes[index].className,
              x: r.x,
              y: r.y,
              right: r.right,
              bottom: r.bottom,
              width: r.width,
              height: r.height,
            })),
        );
      for (const [i, a] of bounds.entries()) {
        expect(a.width).toBeGreaterThanOrEqual(44);
        expect(a.height).toBeGreaterThanOrEqual(44);
        for (const b of bounds.slice(i + 1))
          expect(
            a.right <= b.x ||
              b.right <= a.x ||
              a.bottom <= b.y ||
              b.bottom <= a.y,
            `${a.name} (${a.x},${a.y}–${a.right},${a.bottom}) overlaps ${b.name} (${b.x},${b.y}–${b.right},${b.bottom})`,
          ).toBe(true);
      }
    }
    await page.screenshot({
      path: info.outputPath(`rich-dramatic-${width}.png`),
    });
    const inspect = page.locator('.inspect').first();
    await inspect.click();
    await expect(page.locator('dialog [data-azul-location]')).toHaveCount(0);
    await expect(page.locator('dialog button button')).toHaveCount(0);
    await close(page);
    await expect(inspect).toBeFocused();
    if (width <= 600) {
      const factory = page.locator('.factory-open:enabled').first();
      const pieces = await factory.locator('.tile').count();
      await factory.focus();
      await page.keyboard.press('Enter');
      await expect(
        page.locator('.factory-picker button[data-color]').first(),
      ).toBeFocused();
      await expect(page.locator('.azul-table')).toHaveAttribute(
        'data-game-revision',
        '0',
      );
      expect(await factory.locator('.tile').count()).toBe(pieces);
      await page.keyboard.press('Escape');
      await expect(factory).toBeFocused();
      await factory.click();
      await page.screenshot({
        path: info.outputPath(`rich-dramatic-picker-${width}.png`),
      });
      await page.locator('.factory-picker button[data-color]').first().click();
      await page
        .getByRole('button', { name: 'Floor line', exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Confirm tiles', exact: true })
        .click();
      await expect(page.locator('.azul-table')).toHaveAttribute(
        'data-game-revision',
        '1',
      );
      await expect(page.locator('.factory-picker')).toHaveCount(0);
    }
    await scenario(page, 'crowded');
    for (const group of await page.locator('.center-group').all()) {
      await group.focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('.confirmation')).toContainText('12');
      await page.keyboard.press('Escape');
    }
    await page.locator('.supply').scrollIntoViewIfNeeded();
    await page.screenshot({
      path: info.outputPath(`rich-dramatic-centre-${width}.png`),
    });
    // Text-only enlargement, not page zoom: computed text sizes double while controls reflow.
    await page.evaluate(() => {
      const texts = Array.from(
        document.querySelectorAll<HTMLElement>('.azul-table *'),
      ).filter((e) =>
        Array.from(e.childNodes).some(
          (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
        ),
      );
      const sizes = texts.map((e) => parseFloat(getComputedStyle(e).fontSize));
      texts.forEach((e, i) => (e.style.fontSize = `${sizes[i] * 2}px`));
    });
    await noOverflow(page, width);
    await page.locator('.own-board').scrollIntoViewIfNeeded();
    const numerals = await page
      .locator('.own-board .rail-ticks span:visible')
      .evaluateAll((nodes) =>
        nodes
          .filter((n) => n.textContent?.trim())
          .map((n) => {
            const range = document.createRange();
            range.selectNodeContents(n);
            const r = range.getBoundingClientRect();
            return { left: r.left, right: r.right };
          }),
      );
    for (let i = 1; i < numerals.length; i++)
      expect(numerals[i].left).toBeGreaterThan(numerals[i - 1].right);
    await page.screenshot({
      path: info.outputPath(`rich-dramatic-text200-${width}.png`),
    });
  });
}

test('Rich & Dramatic scoring endpoints, cleanup, overflow rail and dialog cancellation', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/practice/azul');
  await page.evaluate(() => document.fonts.ready);
  await scenario(page, 'cleanup');
  await page
    .getByRole('button', {
      name: 'Take 2 · Blue diamond · Center',
      exact: true,
    })
    .click();
  await page.getByRole('button', { name: /^Line 2 ·/ }).click();
  await page
    .getByRole('button', { name: 'Confirm tiles', exact: true })
    .focus();
  // Observe and seek every actual WAAPI flight to verify its geometric endpoint.
  await page.evaluate(() => {
    (window as any).endpoints = [];
    new MutationObserver((records) => {
      for (const r of records)
        for (const node of r.addedNodes) {
          if (
            !(node instanceof HTMLElement) ||
            !node.classList.contains('azul-flight')
          )
            continue;
          const animation = node.getAnimations()[0];
          const effect = animation.effect!;
          animation.pause();
          animation.currentTime =
            Number(effect.getTiming().delay) +
            Number(effect.getTiming().duration);
          const rect = node.getBoundingClientRect();
          (window as any).endpoints.push({
            from: node.dataset.from,
            to: node.dataset.to,
            expected: JSON.parse(node.dataset.endpoint!),
            actual: { x: rect.x, y: rect.y, size: rect.width },
            image: !!node.querySelector('img'),
            artwork: !!node.querySelector('img,svg'),
          });
          animation.currentTime = 0;
          animation.play();
        }
    }).observe(document.body, { childList: true });
  });
  await page.keyboard.press('Enter');
  await expect
    .poll(() => page.evaluate(() => (window as any).endpoints.length))
    .toBeGreaterThan(20);
  const endpoints = await page.evaluate(() => (window as any).endpoints);
  for (const endpoint of endpoints) {
    expect(endpoint.artwork).toBe(true);
    expect(endpoint.actual.x).toBeCloseTo(endpoint.expected.x, 1);
    expect(endpoint.actual.y).toBeCloseTo(endpoint.expected.y, 1);
    expect(endpoint.actual.size).toBeCloseTo(endpoint.expected.size, 1);
  }
  expect(endpoints.some((endpoint: any) => endpoint.image)).toBe(true);
  expect(endpoints.some((e: any) => e.to.startsWith('workshop-1/wall/'))).toBe(
    true,
  );
  expect(
    endpoints.some(
      (e: any) => e.from === 'workshop-0/floor/3' && e.to === 'discard',
    ),
  ).toBe(true);
  expect(
    endpoints.some(
      (e: any) => e.from === 'workshop-0/floor/2' && e.to === 'center/marker',
    ),
  ).toBe(true);
  await expect(page.locator('.azul-flight')).toHaveCount(0);
  const targets = await page.evaluate(
    (ends) =>
      ends.map((e: { to: string }) => {
        const target = document.querySelector<HTMLElement>(
          `.surface [data-azul-location="${e.to}"]`,
        )!;
        const r = target.getBoundingClientRect();
        const size = Math.min(34, r.width, r.height);
        return {
          x: r.x + (r.width - size) / 2,
          y: r.y + (r.height - size) / 2,
          size,
        };
      }),
    endpoints,
  );
  // Independently compare WAAPI endpoints with actual table destination geometry.
  for (let i = 0; i < endpoints.length; i++) {
    // The fixed table keeps actual destinations stable throughout acceptance.
    expect(Math.abs(targets[i].x - endpoints[i].actual.x)).toBeLessThanOrEqual(
      1.1,
    );
    expect(Math.abs(targets[i].y - endpoints[i].actual.y)).toBeLessThanOrEqual(
      1.1,
    );
    expect(targets[i].size).toBeCloseTo(endpoints[i].actual.size, 1);
  }
  await page.screenshot({
    path: info.outputPath('rich-dramatic-cleanup.png'),
  });
  await scenario(page, 'cross100');
  await choose(page);
  await page
    .getByRole('button', { name: 'Confirm tiles', exact: true })
    .click();
  await expect(page.locator('.own-board .score-overflow')).toHaveText('100+');
  await expect(page.locator('.own-board header strong')).toContainText('106');
  await expect(page.locator('.own-board .score-marker')).toHaveAttribute(
    'style',
    'left: calc(89.6%);',
  );
  await page.screenshot({
    path: info.outputPath('rich-dramatic-100plus.png'),
  });
  await scenario(page, 'scoring');
  await choose(page);
  await page
    .getByRole('button', { name: 'Confirm tiles', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.azul-flight').first()).toBeAttached();
  await page
    .locator('.inspect')
    .first()
    .evaluate((e: HTMLButtonElement) => e.click());
  await expect(page.locator('.azul-flight')).toHaveCount(0);
  await expect(page.locator('dialog [data-azul-location]')).toHaveCount(0);
  await expect(page.locator('.own-board header strong')).toContainText('13');
  await close(page);
  // An accepted action received while inspection is open stays settled.
  await scenario(page, 'scoring');
  await choose(page);
  await page.locator('.inspect').first().click();
  await page
    .getByRole('button', {
      name: 'Confirm tiles',
      exact: true,
      includeHidden: true,
    })
    .evaluate((e: HTMLButtonElement) => e.click());
  await expect(page.locator('.azul-table')).toHaveAttribute(
    'data-game-revision',
    '1',
  );
  await expect(page.locator('.azul-flight')).toHaveCount(0);
  await close(page);
  await scenario(page, 'no_wall');
  await page
    .getByRole('button', {
      name: 'Take 2 · Blue diamond · Center',
      exact: true,
    })
    .click();
  await page.getByRole('button', { name: 'Floor line', exact: true }).click();
  await page
    .getByRole('button', { name: 'Confirm tiles', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.azul-flight').first()).toBeAttached();
  await page
    .getByRole('button', { name: 'Skip animation', exact: true })
    .click();
  await expect(page.locator('.azul-flight')).toHaveCount(0);
  await expect(page.locator('.own-board header strong')).toContainText('0');
  await expect(page.locator('.own-board .floor .tile')).toHaveCount(0);
  expect(errors).toEqual([]);
});
