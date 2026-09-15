import { test, expect, type Page } from '@playwright/test';
async function settings(page: Page) {
  if (!(await page.getByRole('dialog').count()))
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
}
async function scenario(page: Page, value: string) {
  if (!page.url().includes('/practice/catan'))
    await page.goto('/practice/catan');
  await settings(page);
  await page
    .getByRole('combobox', { name: 'Scenario', exact: true })
    .selectOption(value);
  await page.keyboard.press('Escape');
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}
async function observe(page: Page) {
  await page.evaluate(() => {
    (window as any).effects = [];
    (window as any).landings = [];
    new MutationObserver((records) => {
      for (const piece of document.querySelectorAll('.built'))
        if (piece.getAnimations().length) {
          const start = piece.getBoundingClientRect(),
            underlay = piece.parentElement?.querySelector(
              '.previous-settlement',
            );
          const entry = {
            moved: false,
            continuity:
              !!underlay && getComputedStyle(underlay).opacity === '1',
          };
          (window as any).landings.push(entry);
          const deadline = performance.now() + 700;
          const sample = () => {
            entry.moved ||=
              Math.abs(piece.getBoundingClientRect().y - start.y) > 1;
            if (!entry.moved && performance.now() < deadline)
              requestAnimationFrame(sample);
          };
          requestAnimationFrame(sample);
        }
      for (const record of records)
        for (const node of record.addedNodes)
          if (
            node instanceof Element &&
            node.matches(
              '.catan-dust,.catan-token,.catan-flourish,.previous-settlement',
            )
          )
            (window as any).effects.push(node.getAttribute('class'));
    }).observe(document.querySelector('.catan')!, {
      childList: true,
      subtree: true,
    });
  });
}
async function previewCity(page: Page) {
  await page.getByRole('button', { name: 'City', exact: true }).click();
  await page.locator('.table>svg .target').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.preview path')).toBeVisible();
}
test('physical tabletop fits desktop viewports and keeps rules and language available', async ({
  page,
}) => {
  await scenario(page, 'building');
  await expect(page.locator('#sea-material')).toHaveCount(0);
  const shore = await page.locator('.shore').boundingBox();
  expect(shore?.width).toBeGreaterThan(0);
  expect(shore?.height).toBeGreaterThan(0);
  for (const viewport of [
    { width: 1672, height: 941 },
    { width: 1280, height: 720 },
    { width: 900, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    const layout = await page.evaluate(() => {
      const box = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      };
      const seats = [...document.querySelectorAll('.roster > [data-seat]')];
      return {
        scrolls:
          document.documentElement.scrollHeight > innerHeight ||
          document.documentElement.scrollWidth > innerWidth,
        controls: [
          ...document.querySelectorAll(
            '.table-navigation, .table-utilities, .controls, .resource-card, .building-costs, .roster > [data-seat]',
          ),
        ].map(box),
        labelsCollide: seats.some((seat) => {
          const identity = box(seat.querySelector('.seat-identity')!);
          const stats = box(seat.querySelector('.seat-stats')!);
          return (
            identity.right > stats.left + 1 && identity.bottom > stats.top + 1
          );
        }),
        harborsCovered: [...document.querySelectorAll('.harbor')].some(
          (port) => {
            const a = box(port);
            return seats.some((seat) => {
              const b = box(seat);
              return (
                a.left < b.right &&
                a.right > b.left &&
                a.top < b.bottom &&
                a.bottom > b.top
              );
            });
          },
        ),
      };
    });
    expect(layout.scrolls).toBe(false);
    expect(layout.labelsCollide).toBe(false);
    expect(layout.harborsCovered).toBe(false);
    for (const box of layout.controls) {
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.top).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(viewport.width);
      expect(box.bottom).toBeLessThanOrEqual(viewport.height);
    }
  }
  await page.getByRole('button', { name: 'Rules', exact: true }).click();
  await expect(page.locator('.rules-dialog')).toBeVisible();
  await expect(page.locator('.rules-dialog')).toContainText('Catan');
  await page.keyboard.press('Escape');
  await expect(page.locator('.rules-dialog')).not.toBeVisible();
  await page
    .getByRole('combobox', { name: 'Language', exact: true })
    .selectOption('es');
  await expect(page.locator('.building-costs')).toContainText(
    'Costos de construcción',
  );
  await expect(page.locator('.table-navigation')).toContainText('Reglas');
  await page.reload();
  await expect(page.locator('.building-costs')).toContainText(
    'Costos de construcción',
  );
});
test('zoomable ocean, cardinal civilizations, resource cards and hidden settings', async ({
  page,
}) => {
  await scenario(page, 'building');
  await expect(page.getByRole('button', { name: /Sound/ })).toHaveCount(0);
  for (const position of ['north', 'east', 'south', 'west'])
    await expect(
      page.locator('[data-position="' + position + '"]'),
    ).toBeVisible();
  await expect(page.locator('[data-position="south"]')).toContainText('You');
  await expect(page.locator('.civilization-name')).toHaveCount(4);
  await expect(page.locator('.resource-card .resource-art')).toHaveCount(5);
  await expect(page.locator('.harbor')).toHaveCount(9);
  await expect(page.locator('.harbor > g > image')).toHaveCount(5);
  expect(
    await page.locator('.harbor > g > image').evaluateAll((icons) =>
      icons.every((icon) => {
        const a = icon.getBoundingClientRect();
        const b = icon
          .parentElement!.querySelector('path')!
          .getBoundingClientRect();
        return (
          a.width > 0 &&
          a.left >= b.left &&
          a.right <= b.right &&
          a.top >= b.top &&
          a.bottom <= b.bottom
        );
      }),
    ),
  ).toBe(true);
  await expect(page.locator('[data-robber] path').first()).toBeVisible();
  expect(await page.locator('.table>svg').textContent()).not.toContain('♟');
  expect(await page.locator('.table>svg').textContent()).not.toContain(
    'Wool 2:1',
  );
  expect(
    await page
      .locator('.catan')
      .evaluate((el) => getComputedStyle(el).backgroundImage),
  ).toContain('url(');
  expect(
    await page
      .locator('.table>svg text')
      .first()
      .evaluate((el) => getComputedStyle(el).textShadow),
  ).toBe('none');
  const map = page.locator('.island-map'),
    before = await map.boundingBox();
  await map.hover();
  await page.mouse.down();
  await page.mouse.move(700, 420, { steps: 10 });
  await page.mouse.up();
  expect(await map.boundingBox()).toEqual(before);
  await page.mouse.wheel(0, -500);
  await expect(map).not.toHaveAttribute('transform', /scale\(1\)/);
  await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  await expect(map).toHaveAttribute('transform', /scale\(1\)/);
  await expect(page.locator('.preview')).toHaveCount(0);
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(map).toHaveAttribute('transform', /scale\(1.25\)/);
  await page.locator('.table > svg').focus();
  await page.keyboard.press('Home');
  await expect(map).toHaveAttribute('transform', /scale\(1\)/);
  await settings(page);
  await page.getByRole('button', { name: /Sound/ }).click();
  await page.getByRole('button', { name: /Motion/ }).click();
  await page.reload();
  await settings(page);
  await expect(page.getByRole('button', { name: /Sound/ })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(page.getByRole('button', { name: /Motion/ })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});
test('preview, cancel, accepted city landing and continuity', async ({
  page,
}) => {
  await scenario(page, 'building');
  await observe(page);
  await previewCity(page);
  expect(await page.evaluate(() => (window as any).effects)).toEqual([]);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('.preview')).toHaveCount(0);
  await previewCity(page);
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).effects))
    .toEqual(expect.arrayContaining(['previous-settlement', 'catan-dust']));
  await expect
    .poll(() => page.evaluate(() => (window as any).landings))
    .toContainEqual({ moved: true, continuity: true });
  await expect(page.locator('.previous-settlement')).toHaveCount(0);
  await expect(page.locator('[data-position="south"]')).toContainText(
    '3 points',
  );
});
test('accepted development purchases keep the local plaque centered during feedback', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1672, height: 941 });
  await scenario(page, 'building');
  const seat = page.locator('[data-position="south"]');
  const before = (await seat.boundingBox())!;
  await page
    .getByRole('button', { name: 'Buy development', exact: true })
    .click();
  await expect(page.locator('.development-card')).toHaveCount(1);
  await seat.evaluate((el) => {
    for (const animation of el.getAnimations()) {
      animation.pause();
      animation.currentTime =
        Number(animation.effect!.getTiming().duration) / 2;
    }
  });
  const during = (await seat.boundingBox())!;
  expect(
    Math.abs(during.x + during.width / 2 - before.x - before.width / 2),
  ).toBeLessThan(2);
  await seat.evaluate((el) =>
    el.getAnimations().forEach((animation) => animation.finish()),
  );
  const after = (await seat.boundingBox())!;
  expect(Math.abs(after.x - before.x)).toBeLessThan(2);
});
test('dice tumble to the result, production, theft, Monopoly and trade feedback', async ({
  page,
}) => {
  await scenario(page, 'production');
  await observe(page);
  await page.evaluate(() => {
    (window as any).tumbles = [];
    const original = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      if (this.matches('.die')) (window as any).tumbles.push(args[0]);
      return original.apply(this, args);
    };
  });
  await page.getByRole('button', { name: 'Roll dice', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).effects))
    .toContain('catan-token production');
  expect(await page.evaluate(() => (window as any).tumbles.length)).toBe(2);
  await expect(page.locator('.dice-total')).toHaveCount(0);
  await expect(page.locator('.dice')).toHaveText('');
  const throws = await page.evaluate(
    () => (window as any).tumbles as { transform: string }[][],
  );
  expect(throws.every((frames) => frames.length > 10)).toBe(true);
  expect(
    throws.every(
      (frames) => frames.at(-1)!.transform === frames.at(-2)!.transform,
    ),
  ).toBe(true);
  expect(throws[0].at(-1)!.transform).not.toBe(throws[1].at(-1)!.transform);
  expect(
    throws.every(
      (frames) => !frames.at(-1)!.transform.startsWith('translate3d(0,0,0)'),
    ),
  ).toBe(true);

  await expect
    .poll(() =>
      page
        .locator('.die')
        .evaluateAll((dice) =>
          dice.every(
            (die) =>
              die.querySelectorAll('[data-face="0"] i.visible').length ===
              Number(die.getAttribute('data-value')),
          ),
        ),
    )
    .toBe(true);
  await scenario(page, 'robber');
  const count = await page.locator('.target').count();
  for (let i = 0; i < count; i++) {
    await scenario(page, 'robber');
    await page.locator('.target').nth(i).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    if (await page.getByRole('button', { name: /Steal from/ }).count()) break;
  }
  await page
    .getByRole('button', { name: /Steal from/ })
    .first()
    .click();
  await expect
    .poll(() => page.evaluate(() => (window as any).effects))
    .toContain('catan-token theft');
  await scenario(page, 'monopoly');
  await page.locator('.development-card').first().click();
  await page
    .getByRole('button', { name: 'Monopoly: Wood', exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => (window as any).effects))
    .toContain('catan-token monopoly');
  await scenario(page, 'trading');
  await page.getByRole('button', { name: /Bank/ }).click();
  await page
    .getByRole('button', { name: /Bank: Wood →/ })
    .first()
    .click();
  await expect
    .poll(() => page.evaluate(() => (window as any).effects))
    .toContain('catan-token trade');
});
test('phone seats, Spanish settings, reduced motion and hidden victory cards', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await scenario(page, 'victory');
  const active = (await page
    .locator('[data-position="south"]')
    .getAttribute('data-seat'))!;
  const other = await page
    .locator('[data-position="west"]')
    .getAttribute('data-seat');
  await settings(page);
  await page
    .getByRole('combobox', { name: 'You', exact: true })
    .selectOption(other!);
  await page.keyboard.press('Escape');
  await expect(page.locator('.development-card')).toHaveCount(0);
  await settings(page);
  await page
    .getByRole('combobox', { name: 'You', exact: true })
    .selectOption(active);
  await page.keyboard.press('Escape');
  await expect(page.locator('.development-card')).toContainText(
    'Victory Point',
  );
  await page.keyboard.press('Escape');
  await observe(page);
  await previewCity(page);
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.locator('.phase')).toContainText('wins');
  expect(await page.evaluate(() => (window as any).effects)).toEqual([]);
  await settings(page);
  await expect(page.getByRole('button', { name: /Motion/ })).toBeDisabled();
  await page
    .getByRole('combobox', { name: 'Language', exact: true })
    .selectOption('es');
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click();
  await page.getByText('Cómo jugar', { exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText(
    'Con zoom, arrastrá la isla',
  );
  await page.keyboard.press('Escape');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= innerHeight,
    ),
  ).toBe(true);
  await expect(page.locator('.resource-card')).toHaveCount(5);
});
test('heavy placement audio is layered, optional and rejects without success', async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).tones = [];
    (window as any).noise = 0;
    const create = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
      const osc = create.call(this),
        start = osc.start.bind(osc);
      osc.start = (...args) => {
        (window as any).tones.push({
          frequency: osc.frequency.value,
          when: args[0],
          now: this.currentTime,
        });
        start(...args);
      };
      return osc;
    };
    const source = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      (window as any).noise++;
      return source.call(this);
    };
  });
  await scenario(page, 'building');
  await previewCity(page);
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).tones.length))
    .toBeGreaterThanOrEqual(2);
  expect(
    await page.evaluate(() => (window as any).noise),
  ).toBeGreaterThanOrEqual(3);
  await settings(page);
  await page.getByRole('button', { name: /Sound/ }).click();
  await page.keyboard.press('Escape');
  const count = await page.evaluate(() => (window as any).tones.length);
  await scenario(page, 'production');
  await page.getByRole('button', { name: 'Roll dice', exact: true }).click();
  expect(await page.evaluate(() => (window as any).tones.length)).toBe(count);
  await scenario(page, 'trading');
  await observe(page);
  await page.getByRole('button', { name: 'Open offer', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Send offer', exact: true }),
  ).toBeDisabled();
  expect(await page.evaluate(() => (window as any).effects)).toEqual([]);
});

test('piece ghosts appear only on hover or focus, without click outlines', async ({
  page,
}) => {
  await scenario(page, 'setup');
  const targets = page.locator('.target'),
    hints = page.locator('.placement-hint');
  await page.mouse.move(1, 1);
  await expect(hints.first()).toHaveCSS('opacity', '0');
  expect(
    await hints.evaluateAll((items) =>
      items.every(
        (item) => !!item.querySelector('path') && !item.querySelector('text'),
      ),
    ),
  ).toBe(true);
  await expect(page.locator('.placement-hint circle')).toHaveCount(0);
  await targets.first().hover();
  await expect(hints.first()).toHaveCSS('opacity', '0.65');
  await expect(hints.nth(1)).toHaveCSS('opacity', '0');
  await page.mouse.move(1, 1);
  await expect(hints.first()).toHaveCSS('opacity', '0');
  await targets.first().focus();
  await expect(hints.first()).toHaveCSS('opacity', '0.65');
  await page.keyboard.press('Enter');
  await expect(targets.first()).toHaveCSS('outline-style', 'none');
  await expect(page.locator('.preview path')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.locator('[data-piece^="building-"]')).toHaveCount(1);
});

test('two-finger pinch zoom is bounded and cannot select a location', async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'Native multi-touch injection is available through Chromium CDP.',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await scenario(page, 'setup');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', {
    enabled: true,
    maxTouchPoints: 2,
  });
  const box = (await page.locator('.table > svg').boundingBox())!,
    x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  const points = (distance: number) => [
    { x: x - distance, y, id: 1 },
    { x: x + distance, y, id: 2 },
  ];
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: points(25),
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: points(100),
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect(page.locator('.island-map')).toHaveAttribute(
    'transform',
    /scale\(3\)/,
  );
  await expect(page.locator('.preview')).toHaveCount(0);
});

test('double-click commits one settlement, while single-click only previews', async ({
  page,
}) => {
  await scenario(page, 'setup');
  const target = page.locator('.target').first();
  await target.click();
  await expect(page.locator('.preview path')).toBeVisible();
  await expect(page.locator('[data-piece^="building-"]')).toHaveCount(0);
  await expect(target).toHaveCSS('outline-style', 'none');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await target.dblclick();
  await expect(page.locator('[data-piece^="building-"]')).toHaveCount(1);
  await expect(page.locator('[data-piece^="road-"]')).toHaveCount(0);
  await expect(page.locator('.confirm')).toHaveCount(0);
  await expect(page.locator('.phase')).toContainText('adjacent road');
  await page.locator('.target').first().hover();
  await expect(page.locator('.placement-hint').first()).toHaveCSS(
    'opacity',
    '0.65',
  );
  await expect(page.locator('.placement-hint line').first()).toHaveAttribute(
    'stroke-width',
    '8',
  );
  await page.locator('.table > svg').click({ position: { x: 3, y: 3 } });
  await expect(page.locator('.table > svg')).toHaveCSS('outline-style', 'none');
});

test('wheel zoom keeps the world point under the mouse stationary', async ({
  page,
}) => {
  await scenario(page, 'setup');
  const target = page.locator('.target').first();
  await target.hover();
  const before = (await target.boundingBox())!;
  const center = {
    x: before.x + before.width / 2,
    y: before.y + before.height / 2,
  };
  await page.mouse.move(center.x, center.y);
  await page.mouse.wheel(0, -420);
  await expect(page.locator('.island-map')).not.toHaveAttribute(
    'transform',
    /scale\(1\)/,
  );
  const after = (await target.boundingBox())!;
  expect(Math.abs(after.x + after.width / 2 - center.x)).toBeLessThan(1);
  expect(Math.abs(after.y + after.height / 2 - center.y)).toBeLessThan(1);
  expect(after.width).toBeGreaterThan(before.width);
  await page.mouse.wheel(0, -220);
  await expect
    .poll(async () => (await target.boundingBox())!.width)
    .toBeGreaterThan(after.width);
  const second = (await target.boundingBox())!;
  expect(Math.abs(second.x + second.width / 2 - center.x)).toBeLessThan(1);
  expect(Math.abs(second.y + second.height / 2 - center.y)).toBeLessThan(1);
  await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  await expect(page.locator('.island-map')).toHaveAttribute(
    'transform',
    'translate(0 0) scale(1)',
  );
});

test('player trading opens a resource composer without switching seats', async ({
  page,
}) => {
  await scenario(page, 'trading');
  const seat = await page
    .locator('[data-position="south"]')
    .getAttribute('data-seat');
  await expect(page.locator('.panels')).toBeHidden();
  await page.locator('[data-position="west"] .seat-trade').click();
  await expect(page.locator('.panels')).toBeVisible();
  await expect(page.locator('[data-position="south"]')).toHaveAttribute(
    'data-seat',
    seat!,
  );
  await expect(page.locator('.panels select, .panels input')).toHaveCount(0);
  await expect(page.locator('.panels')).toHaveAttribute(
    'data-trade-anchor',
    'west',
  );
  await expect(page.locator('.quantities .resource-icon')).toHaveCount(5);
  await page.setViewportSize({ width: 390, height: 844 });
  const tops = await page
    .locator('.quantities .resource-icon')
    .evaluateAll((nodes) =>
      nodes.map((n) => Math.round(n.getBoundingClientRect().top)),
    );
  expect(new Set(tops).size).toBe(1);

  await page.keyboard.press('Escape');
  await expect(page.locator('.panels')).toBeHidden();
});

test('board dice clear after resource deliveries follow the roll in readable stages', async ({
  page,
}) => {
  await scenario(page, 'setup');
  await expect(page.locator('.dice')).toHaveCount(0);
  await scenario(page, 'production');
  await page.getByRole('button', { name: 'Roll dice', exact: true }).click();
  await expect(page.locator('.production').first()).toBeAttached();
  const timing = await page.evaluate(() => {
    const dice = [...document.querySelectorAll('.die')].map((el) =>
      el.getAnimations()[0]?.effect?.getTiming(),
    );
    const cards = [
      ...document.querySelectorAll<HTMLElement>('.production'),
    ].map((el) => ({
      timing: el.getAnimations()[0]?.effect?.getTiming(),
      recipient: el.dataset.recipient,
      label: el.textContent,
      icon: !!el.querySelector('.resource-art'),
    }));
    return { dice, cards };
  });
  expect(timing.dice).toHaveLength(2);
  expect(
    timing.dice.every(
      (t) => Number(t?.duration) >= 250 && Number(t?.duration) < 2500,
    ),
  ).toBe(true);
  for (const card of timing.cards) {
    expect(card.timing?.delay).toBeGreaterThanOrEqual(
      Math.max(...timing.dice.map((t) => Number(t?.duration))),
    );
    expect(Number(card.timing?.duration)).toBeGreaterThanOrEqual(1900);
    expect(card.label).toMatch(/\+\d+ (Wood|Wool|Wheat|Brick|Ore)/);
    expect(card.icon).toBe(true);
    await expect(page.locator(`[data-seat="${card.recipient}"]`)).toHaveCount(
      1,
    );
  }
  // Seek the real browser animations to inspect their readable source and arrival holds.
  const token = page.locator('.production').first();
  await token.evaluate((el) => {
    const a = el.getAnimations()[0];
    a.pause();
    a.currentTime = a.effect!.getTiming().delay + 500;
  });
  await expect(token).toHaveCSS('opacity', '1');
  await token.evaluate((el) => {
    const a = el.getAnimations()[0];
    a.currentTime = a.effect!.getTiming().delay + 1650;
  });
  await expect(token).toHaveCSS('opacity', '1');
  await page
    .locator('.die')
    .evaluateAll((nodes) =>
      nodes.forEach((el) => el.getAnimations().forEach((a) => a.finish())),
    );
  const bounds = await page.locator('.table > svg').boundingBox();
  const dice = await page.locator('.board-dice').boundingBox();
  expect(dice!.x).toBeGreaterThan(bounds!.x);
  expect(dice!.y).toBeGreaterThan(bounds!.y);
  expect(dice!.x + dice!.width).toBeLessThan(bounds!.x + bounds!.width);
  expect(dice!.y + dice!.height).toBeLessThan(bounds!.y + bounds!.height);
  await expect(page.locator('.board-dice')).toHaveCount(0, { timeout: 12000 });
  await expect(page.locator('.dice-bowl .dice')).toHaveCount(1);
  await expect(page.locator('.production')).toHaveCount(0);
  await page.getByRole('button', { name: 'End turn', exact: true }).click();
  await expect(page.locator('.board-dice')).toHaveCount(0);
  await scenario(page, 'victory');
  await previewCity(page);
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.locator('.phase')).toContainText('wins');
  await expect(page.locator('.dice')).toHaveCount(0);
});

test('hold to charge, cancel, random landing and trade availability', async ({
  page,
}) => {
  await scenario(page, 'production');
  await expect(
    page.getByRole('button', { name: 'Open offer', exact: true }),
  ).toBeDisabled();
  await expect(
    page.locator('[data-position="west"] .seat-trade'),
  ).toBeDisabled();
  const roll = page.getByRole('button', { name: 'Roll dice', exact: true });
  await roll.focus();
  await page.keyboard.down('Space');
  await page.keyboard.press('Escape');
  await page.keyboard.up('Space');
  await expect(roll).toBeVisible();
  await roll.focus();
  await page.keyboard.down('Space');
  await expect(page.locator('.charge-label')).toHaveText('100%', {
    timeout: 5000,
  });
  await page.keyboard.up('Space');
  await expect(page.locator('.board-dice')).toHaveAttribute(
    'data-strength',
    '1',
  );
  await expect(
    page.getByRole('button', { name: 'Open offer', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Open offer', exact: true }),
  ).toBeEnabled({ timeout: 6000 });
  const first = await page.locator('.board-dice').getAttribute('style');
  await scenario(page, 'production');
  await roll.click();
  await expect(page.locator('.board-dice')).not.toHaveAttribute(
    'style',
    first!,
  );
  await expect(
    page.getByRole('button', { name: 'Open offer', exact: true }),
  ).toBeEnabled();
  await page.locator('[data-position="west"] .seat-trade').click();
  const give = page.getByRole('group', { name: 'Give Wood', exact: true });
  const ask = page.getByRole('group', { name: 'Ask Wood', exact: true });
  await give.getByRole('button', { name: '+ Wood', exact: true }).click();
  await expect(give.locator('output')).toHaveText('1');
  await expect(
    ask.getByRole('button', { name: '+ Wood', exact: true }),
  ).toBeDisabled();
  await expect(page.locator('.trade-recipients')).toHaveCount(0);
  await expect(page.locator('.panels')).toHaveAttribute(
    'data-trade-anchor',
    'west',
  );
});

test('pointer charging releases once and player trade buttons open offers', async ({
  page,
}) => {
  await scenario(page, 'production');
  const roll = page.getByRole('button', { name: 'Roll dice', exact: true });
  await roll.hover();
  await page.mouse.down();
  await expect(page.locator('.charge-label')).toHaveText(/^[2-9]\d%$/, {
    timeout: 4000,
  });
  await page.mouse.up();
  await expect(page.locator('.board-dice')).toHaveAttribute(
    'data-strength',
    /0\./,
  );
  await expect(page.locator('[role="alert"]')).toHaveCount(0);
  await expect(page.locator('[data-position="west"] .seat-trade')).toBeEnabled({
    timeout: 6000,
  });
  await page.locator('[data-position="west"] .seat-trade').click();
  await expect(page.locator('.panels')).toHaveAttribute(
    'data-trade-anchor',
    'west',
  );
  await scenario(page, 'production');
  await roll.evaluate((el) => (el as HTMLButtonElement).click());
  await expect(page.locator('.board-dice')).toHaveAttribute(
    'data-strength',
    '0',
  );
});

test('build buttons reveal every legal piece directly on the island', async ({
  page,
}) => {
  await scenario(page, 'setup');
  await expect(page.locator('.locations')).toHaveCount(0);
  await expect(page.locator('.build-choice svg')).toHaveCount(3);
  await page.getByRole('button', { name: 'Settlement', exact: true }).click();
  await page.mouse.move(1, 1);
  const hints = page.locator('.placement-hint');
  expect(await hints.count()).toBeGreaterThan(1);
  expect(
    await hints.evaluateAll((nodes) =>
      nodes.every(
        (el) =>
          getComputedStyle(el).opacity === '0.45' && !!el.querySelector('path'),
      ),
    ),
  ).toBe(true);
  await expect(page.locator('[data-piece]')).toHaveCount(0);
  await page.locator('.target').first().click();
  await expect(page.locator('.preview path')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await page.getByRole('button', { name: 'Road', exact: true }).click();
  await page.mouse.move(1, 1);
  expect(
    await hints.evaluateAll((nodes) =>
      nodes.every(
        (el) =>
          getComputedStyle(el).opacity === '0.45' && !!el.querySelector('line'),
      ),
    ),
  ).toBe(true);
  await scenario(page, 'building');
  await page.getByRole('button', { name: 'City', exact: true }).click();
  await page.mouse.move(1, 1);
  expect(
    await hints.evaluateAll((nodes) =>
      nodes.every(
        (el) =>
          getComputedStyle(el).opacity === '0.45' && !!el.querySelector('path'),
      ),
    ),
  ).toBe(true);
});

test('practice names switch seats freely and auto rotation follows setup and turns', async ({
  page,
}) => {
  await scenario(page, 'setup');
  const first = await page
    .locator('[data-position="south"]')
    .getAttribute('data-seat');
  const other = await page
    .locator('[data-position="west"]')
    .getAttribute('data-seat');
  await expect(
    page.locator('[data-position="west"] .seat-trade'),
  ).toBeDisabled();
  await page.locator('[data-position="west"] .seat-name').click();
  await expect(page.locator('[data-position="south"]')).toHaveAttribute(
    'data-seat',
    other!,
  );
  await expect(page.locator('.panels')).toBeHidden();
  await page.locator(`[data-seat="${first}"] .seat-name`).click();
  await page.locator('.target').first().dblclick();
  await page.locator('.target').first().dblclick();
  await expect(page.locator('[data-position="south"]')).not.toHaveAttribute(
    'data-seat',
    first!,
  );
  await expect(page.locator('.target').first()).toBeVisible();
  await scenario(page, 'trading');
  const active = await page
    .locator('[data-position="south"]')
    .getAttribute('data-seat');
  await page.getByRole('button', { name: 'End turn', exact: true }).click();
  await expect(page.locator('[data-position="south"]')).not.toHaveAttribute(
    'data-seat',
    active!,
  );
  await expect(
    page.getByRole('button', { name: 'Roll dice', exact: true }),
  ).toBeVisible();
  await settings(page);
  await page
    .getByRole('checkbox', { name: 'Automatically switch to the next player' })
    .uncheck();
  await page.keyboard.press('Escape');
  await scenario(page, 'trading');
  const manual = await page
    .locator('[data-position="south"]')
    .getAttribute('data-seat');
  await page.getByRole('button', { name: 'End turn', exact: true }).click();
  await expect(page.locator('[data-position="south"]')).toHaveAttribute(
    'data-seat',
    manual!,
  );
});

test('zoomed island pans without placing pieces and the controlled seat sits above the hand', async ({
  page,
}) => {
  await scenario(page, 'setup');
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  const map = page.locator('.island-map');
  const before = await map.getAttribute('transform');
  const target = await page.locator('.target').first().boundingBox();
  await page.mouse.move(
    target!.x + target!.width / 2,
    target!.y + target!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(target!.x + 90, target!.y + 50, { steps: 8 });
  await page.mouse.up();
  await expect(map).not.toHaveAttribute('transform', before!);
  await expect(page.locator('.preview')).toHaveCount(0);
  await expect(page.locator('[data-piece]')).toHaveCount(0);
  const dragged = await map.getAttribute('transform');
  await page.locator('.table > svg').focus();
  await page.keyboard.press('ArrowLeft');
  await expect(map).not.toHaveAttribute('transform', dragged!);
  await page.keyboard.press('Home');
  await expect(map).toHaveAttribute('transform', 'translate(0 0) scale(1)');
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 900, height: 800 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const summary = await page.locator('[data-position="south"]').boundingBox();
    const hand = await page.locator('.hand').boundingBox();
    expect(hand!.y).toBeGreaterThanOrEqual(summary!.y + summary!.height);
    expect(summary!.x + summary!.width).toBeLessThanOrEqual(viewport.width);
    const overlaps = await page.locator('.harbor').evaluateAll(
      (nodes, seat) =>
        nodes.some((el) => {
          const r = el.getBoundingClientRect();
          return (
            r.left < seat!.x + seat!.width &&
            r.right > seat!.x &&
            r.top < seat!.y + seat!.height &&
            r.bottom > seat!.y
          );
        }),
      summary,
    );
    expect(overlaps).toBe(false);
  }
});

test('reduced-motion dice show briefly and then leave the board clear', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await scenario(page, 'production');
  await page.getByRole('button', { name: 'Roll dice', exact: true }).click();
  await expect(page.locator('.dice')).toHaveCount(1);
  await expect(page.locator('.production')).toHaveCount(0);
  expect(
    await page
      .locator('.die')
      .evaluateAll((nodes) =>
        nodes.every((el) => el.getAnimations().length === 0),
      ),
  ).toBe(true);
  await expect(page.locator('.board-dice')).toHaveCount(0, { timeout: 3000 });
  await expect(page.locator('.dice-bowl .dice')).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: 'End turn', exact: true }),
  ).toBeEnabled();
});

test('open offers explain the recipient and require both sides of an exchange', async ({
  page,
}) => {
  await scenario(page, 'trading');
  await page.getByRole('button', { name: 'Open offer', exact: true }).click();
  await expect(page.locator('.panels')).toContainText(
    'you choose one to trade with',
  );
  const send = page.getByRole('button', { name: 'Send offer', exact: true });
  await expect(send).toBeDisabled();
  await page
    .getByRole('group', { name: 'Give Wood', exact: true })
    .getByRole('button', { name: '+ Wood', exact: true })
    .click();
  await expect(send).toBeDisabled();
  await page
    .getByRole('group', { name: 'Ask Wool', exact: true })
    .getByRole('button', { name: '+ Wool', exact: true })
    .click();
  await expect(send).toBeEnabled();
  await page
    .getByRole('group', { name: 'Give Wood', exact: true })
    .getByRole('button', { name: '− Wood', exact: true })
    .click();
  await expect(send).toBeDisabled();
});

test('accepted offers are visible separately from bank exchanges', async ({
  page,
}) => {
  await scenario(page, 'trading');
  await page.getByRole('button', { name: 'Open offer', exact: true }).click();
  await page
    .getByRole('group', { name: 'Give Wood', exact: true })
    .getByRole('button', { name: '+ Wood', exact: true })
    .click();
  await page
    .getByRole('group', { name: 'Ask Wool', exact: true })
    .getByRole('button', { name: '+ Wool', exact: true })
    .click();
  await page.getByRole('button', { name: 'Send offer', exact: true }).click();
  await expect(page.locator('.panels').getByRole('status')).toContainText(
    'Offer sent',
  );
  await expect(page.locator('.player-offer')).toHaveCount(1);
  await page.getByRole('button', { name: /Bank/ }).click();
  await expect(page.locator('.player-offer')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Send offer', exact: true }),
  ).toHaveCount(0);
});
