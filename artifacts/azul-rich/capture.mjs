import { createHash } from 'node:crypto';
import { chromium, webkit } from '@playwright/test';

const engine = process.argv[2] ?? 'chromium';
const browserType = engine === 'webkit' ? webkit : chromium;
const root = new URL('.', import.meta.url).pathname;
const pageErrors = [];
const consoleErrors = [];
const failedRequests = [];

const browser = await browserType.launch({
  env: { ...process.env },
  executablePath:
    engine === 'webkit' && process.env.WEBKIT_EXECUTABLE
      ? process.env.WEBKIT_EXECUTABLE
      : undefined,
});
const page = await browser.newPage({
  viewport: { width: 1728, height: 960 },
  deviceScaleFactor: 1,
});

page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('requestfailed', (request) =>
  failedRequests.push(`${request.url()} · ${request.failure()?.errorText}`),
);

await page.goto(
  process.env.AZUL_PROTOTYPE_URL ??
    'http://127.0.0.1:5174/dev/azul-rich-prototype',
  {
    waitUntil: 'networkidle',
  },
);
await page.locator('[data-scene="azul-rich"]').waitFor();
await page.evaluate(() => document.fonts.ready);

const layout = await page.evaluate(() => {
  const scene = document.querySelector('[data-scene="azul-rich"]');
  const rect = scene?.getBoundingClientRect();
  return {
    documentOverflowX: document.documentElement.scrollWidth - innerWidth,
    documentOverflowY: document.documentElement.scrollHeight - innerHeight,
    bodyOverflowX: document.body.scrollWidth - innerWidth,
    bodyOverflowY: document.body.scrollHeight - innerHeight,
    scene: rect
      ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
      : null,
    missingImages: Array.from(document.images)
      .filter((image) => !image.complete || image.naturalWidth === 0)
      .map((image) => image.getAttribute('src')),
  };
});

const fullPath = `${root}${engine}-1728x960.png`;
const first = await page.screenshot({ path: fullPath });
const firstHash = createHash('sha256').update(first).digest('hex');

if (engine === 'chromium') {
  const capture = async (selector, file, padding) => {
    const box = await page.locator(selector).first().boundingBox();
    if (!box) throw new Error(`No screenshot box for ${selector}`);
    const x = Math.max(0, box.x - padding);
    const y = Math.max(0, box.y - padding);
    const width = Math.min(1728 - x, box.width + padding * 2);
    const height = Math.min(960 - y, box.height + padding * 2);
    await page.screenshot({
      path: `${root}${file}`,
      clip: { x, y, width, height },
    });
  };

  await capture('.center-pool', 'chromium-tiles-close.png', 30);
  await capture('[data-factory="3"]', 'chromium-factory-close.png', 24);
  await capture('.own-table', 'chromium-player-board-close.png', 12);
  await page.screenshot({
    path: `${root}chromium-board-textile-junction.png`,
    clip: { x: 425, y: 575, width: 365, height: 225 },
  });

  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-scene="azul-rich"]').waitFor();
  await page.evaluate(() => document.fonts.ready);
  const second = await page.screenshot();
  const secondHash = createHash('sha256').update(second).digest('hex');
  layout.deterministicReload = firstHash === secondHash;
  layout.firstHash = firstHash;
  layout.secondHash = secondHash;
}

console.log(
  JSON.stringify(
    { engine, layout, pageErrors, consoleErrors, failedRequests },
    null,
    2,
  ),
);

await browser.close();
