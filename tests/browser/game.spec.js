const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
function fixture(name) {
  const input = fs.readFileSync(path.join(__dirname, `../fixtures/v2/${name}.replay.json`), 'utf8');
  const golden = fs.readFileSync(path.join(__dirname, `../fixtures/v2/${name}.expected.json`), 'utf8');
  const native = execFileSync(path.join(__dirname, '../../target/debug/color-match-replay'), { input, encoding: 'utf8' });
  expect(native).toBe(golden); return { replay: JSON.parse(input), frames: JSON.parse(native).frames };
}
const title = word => word[0].toUpperCase() + word.slice(1);
function watchErrors(page) { const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});return errors; }
async function start(page, replay) {
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));await page.goto('/');await expect(page.locator('#app')).toHaveAttribute('data-ready','true');
  await page.locator('#room-toggle').click();await page.locator('#solo-count').selectOption(String(replay.config.players.length));await page.locator('#seed-tools summary').click();
  await page.locator('#seed').fill(replay.seed.map(b=>b.toString(16).padStart(2,'0')).join(''));await page.locator('#restart').click();
}
async function compare(page,view) {
  await expect(page.locator('#board')).toHaveAttribute('data-revision',String(view.revision));await expect(page.locator('#stock-count')).toHaveText(String(view.stock_count));await expect(page.locator('#hand-count')).toHaveText(String(view.hand.length));await expect(page.locator('#discard')).toHaveAttribute('data-card',String(view.top.id));await expect(page.locator('#active-color')).toHaveText(title(view.active_color));
  expect(await page.locator('.hand [data-card]').evaluateAll(els=>els.map(e=>Number(e.dataset.card)).sort((a,b)=>a-b))).toEqual(view.hand.map(c=>c.id));
  expect(await page.locator('.hand [aria-disabled="false"]').evaluateAll(els=>els.map(e=>Number(e.dataset.card)).sort((a,b)=>a-b))).toEqual(view.legal_actions.filter(a=>a.type==='play'&&!a.uno).map(a=>a.card_id));
  expect(await page.locator('#draw').isEnabled()).toBe(view.legal_actions.some(a=>a.type==='draw'));
  for (const player of view.players.filter(p=>p.player!==view.player)) await expect(page.locator(`#seat-${player.player} .seat-count`)).toHaveText(`${player.count} cards`);
}
for (const name of ['seed-07','seed-19']) test(`${name}: Wasm matches native through victory`,async({page})=>{
  const errors=watchErrors(page);const {replay,frames}=fixture(name);await start(page,replay);await compare(page,frames[0][0]);await page.context().setOffline(true);
  for (const [index,{player,action}] of replay.actions.entries()) {
    if(player!==0) await page.clock.runFor(350);
    else {
      if(action.type==='play'&&action.uno)await page.locator('#uno').click();
      const control=action.type==='play'?page.locator(`#card-${action.card_id}`):action.type==='draw'?page.locator('#draw'):action.type==='catch_uno'?page.locator('#catch'):page.locator(`#choose-${title(action.color)}`);
      await control.focus();await page.keyboard.press(index%2===0?'Enter':'Space');
    }
    await compare(page,frames[index+1][0]);await expect(page.locator('#error')).toBeEmpty();
  }
  await expect(page.locator('#status')).toContainText('win');expect(errors).toEqual([]);
});
test('invalid action and seed preserve state, restart cancels motion and pending bots',async({page})=>{
  const {replay,frames}=fixture('seed-07');await start(page,replay);await page.locator('.hand [aria-disabled="true"]').first().dispatchEvent('click');await expect(page.locator('#error')).toContainText('Match the active color');await compare(page,frames[0][0]);
  await page.locator('#room-toggle').click();await page.locator('#seed').fill('bad');await page.locator('#restart').click();await expect(page.locator('#error')).toContainText('64 hexadecimal');await compare(page,frames[0][0]);await page.locator('#seed').fill('07'.repeat(32));await page.locator('#restart').click();
  await page.locator('#draw').click();await expect(page.locator('#board')).toHaveAttribute('data-revision','1');await expect(page.locator('.flying-card')).toHaveCount(1);
  await page.locator('#room-toggle').click();await page.locator('#restart').click();await expect(page.locator('.flying-card')).toHaveCount(0);await page.clock.runFor(1000);await compare(page,frames[0][0]);
});
test('eight seats, mobile scrolling, keyboard focus and reduced motion',async({page},info)=>{
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});const {replay}=fixture('eight');await start(page,replay);await expect(page.locator('.seat:not([hidden])')).toHaveCount(7);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.keyboard.press('Tab');await page.locator('#draw').focus();expect(await page.locator('#draw').evaluate(e=>getComputedStyle(e).outlineStyle)).not.toBe('none');await page.keyboard.press('Enter');await expect(page.locator('.flying-card')).toHaveCount(1);await expect(page.locator('#board')).toHaveAttribute('data-revision','1');await page.screenshot({path:info.outputPath('eight-mobile.png')});
  for(const button of await page.locator('.hand button,#draw,#uno').all()){const box=await button.boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);}
});
test('accepted play preserves seat and pile nodes and animates',async({page},info)=>{
  const {replay}=fixture('seed-07');await start(page,replay);await page.evaluate(()=>{window.stableSeat=document.getElementById('seat-1');window.stablePile=document.getElementById('discard');});
  await page.locator('.hand [aria-disabled="false"]').first().click();await expect(page.locator('.flying-card')).toHaveCount(1);expect(await page.evaluate(()=>window.stableSeat===document.getElementById('seat-1')&&window.stablePile===document.getElementById('discard'))).toBe(true);await page.screenshot({path:info.outputPath('table-desktop.png')});
});
test('failed Wasm loading has useful error',async({page})=>{await page.route('**/*.wasm',r=>r.abort());await page.goto('/');await expect(page.locator('#status')).toHaveText('The game could not load.');await expect(page.locator('#error')).toContainText('Reload to try again');});

async function recordPresentation(page, audio = 'fake') {
  await page.addInitScript(({ audio }) => {
    window.flights = []; window.wooshes = 0;
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (frames, options) {
      const animation = animate.call(this, frames, options);
      if (this.classList.contains('flying-card')) {
        animation.pause();
        window.flights.push({ element: this, animation, frames, options,
          left: parseFloat(this.style.left), top: parseFloat(this.style.top) });
      }
      return animation;
    };
    if (audio === 'unavailable') {
      window.AudioContext = class { constructor() { throw Error('No audio device'); } };
    } else {
      const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
      const node = () => ({ connect(target) { return target; }, disconnect() {}, gain: param(), frequency: param(), Q: param() });
      window.AudioContext = class {
        state = 'running'; sampleRate = 48000; currentTime = 0; destination = {};
        createBuffer() { return { getChannelData: () => new Float32Array(10560) }; }
        createBufferSource() { return { ...node(), start() { window.wooshes++; }, stop() {} }; }
        createBiquadFilter() { return node(); } createGain() { return node(); }
      };
    }
  }, { audio });
}
async function finishFlights(page) {
  await page.evaluate(async () => {
    for (const { animation } of window.flights) if (animation.playState === 'paused') animation.finish();
    await Promise.resolve(); await Promise.resolve();
  });
}

test('keyboard play flies from its card to the discard and restores on arrival', async ({ page }, info) => {
  await recordPresentation(page); await page.emulateMedia({ reducedMotion: 'reduce' }); await start(page, fixture('seed-07').replay);
  const card = page.locator('.hand [aria-disabled="false"]').first();
  await page.keyboard.press('Tab'); await card.focus();
  const origin = await card.boundingBox();
  const contents = await card.innerHTML();
  await page.keyboard.press('Enter');
  const flight = await page.evaluate(() => {
    const f = window.flights.at(-1);
    return { left: f.left, top: f.top, html: f.element.innerHTML };
  });
  expect(flight.left).toBeCloseTo(origin.x, 0); expect(flight.top).toBeCloseTo(origin.y, 0);
  expect(flight.html).toBe(contents);
  await expect(page.locator('#discard')).toHaveCSS('opacity', '0');
  expect(await page.evaluate(() => window.wooshes)).toBe(1);
  const launch = await page.locator('.flying-card').boundingBox();
  expect(launch.x).toBeCloseTo(origin.x, 0); expect(launch.y).toBeCloseTo(origin.y, 0);
  await page.evaluate(() => { window.flights.at(-1).animation.currentTime = 65; });
  const lift = await page.locator('.flying-card').boundingBox();
  expect(lift.x).toBeCloseTo(origin.x, 0); expect(lift.y).toBeCloseTo(origin.y - 18, 0);
  await page.screenshot({ path: info.outputPath('play-lift.png') });
  await page.evaluate(() => { window.flights.at(-1).animation.currentTime = 190; });
  const middle = await page.locator('.flying-card').boundingBox();
  expect(middle.y).toBeLessThan(lift.y);
  await page.screenshot({ path: info.outputPath('play-midflight.png') });
  await page.evaluate(() => { window.flights.at(-1).animation.currentTime = 320; });
  const target = await page.locator('#discard').boundingBox(), arrival = await page.locator('.flying-card').boundingBox();
  expect(arrival.x).toBeCloseTo(target.x, 0); expect(arrival.y).toBeCloseTo(target.y, 0);
  expect(arrival.width).toBeCloseTo(target.width, 0); expect(arrival.height).toBeCloseTo(target.height, 0);
  await finishFlights(page); await expect(page.locator('.in-flight,.flying-card')).toHaveCount(0);
});

test('touch draw lands face down in its actual scrolled mobile slot without moving focus', async ({ browser }, info) => {
  const context = await browser.newContext({ ...info.project.use, viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await context.newPage();
  try {
    await recordPresentation(page); await start(page, fixture('seed-07').replay);
    await page.locator('#hand').evaluate(e => { e.scrollLeft = e.scrollWidth; });
    await page.locator('#draw').focus();
    const ids = await page.locator('#hand .card').evaluateAll(es => es.map(e => e.id));
    const origin = await page.locator('#draw').boundingBox();
    await page.locator('#draw').tap();
    const launch = await page.locator('.flying-card').boundingBox();
    expect(launch.x).toBeCloseTo(origin.x, 0); expect(launch.y).toBeCloseTo(origin.y, 0);
    expect(launch.width).toBeCloseTo(origin.width, 0);
    const target = page.locator('#hand .in-flight'); await expect(target).toHaveCount(1);
    expect(ids).not.toContain(await target.getAttribute('id'));
    await expect(page.locator('.flying-card')).toHaveClass(/card-back/);
    await expect(page.locator('.flying-card .card-symbol')).toHaveCount(0);
    await expect(target).toHaveCSS('opacity', '0');
    const focus = await page.evaluate(() => document.activeElement.id);
    await page.evaluate(() => { window.flights.at(-1).animation.currentTime = 150; });
    await page.screenshot({ path: info.outputPath('draw-mobile-midflight.png') });
    await page.evaluate(() => { window.flights.at(-1).animation.currentTime = 300; });
    const end = await target.boundingBox(), flight = await page.locator('.flying-card').boundingBox();
    expect(end.x).toBeGreaterThanOrEqual(0); expect(end.x + end.width).toBeLessThanOrEqual(390);
    expect(flight.x).toBeCloseTo(end.x, 0); expect(flight.y).toBeCloseTo(end.y, 0);
    await finishFlights(page); expect(await page.evaluate(() => document.activeElement.id)).toBe(focus);
    await expect(page.locator('.in-flight,.flying-card')).toHaveCount(0);
  } finally { await context.close(); }
});

test('penalty draws stagger backs with one sound, opponents never expose faces', async ({ page }) => {
  await recordPresentation(page); const { replay, frames } = fixture('seed-19'); await start(page, replay);
  let multi = false, opponent = false, ownMulti = false;
  for (const [index, { player, action }] of replay.actions.entries()) {
    await page.evaluate(() => { window.flights = []; window.wooshes = 0; });
    if (player !== 0) await page.clock.runFor(350);
    else {
      if (action.type === 'play' && action.uno) await page.locator('#uno').click();
      const control = action.type === 'play' ? `#card-${action.card_id}` : action.type === 'draw' ? '#draw' : action.type === 'catch_uno' ? '#catch' : `#choose-${title(action.color)}`;
      await page.locator(control).dispatchEvent('click');
    }
    if (action.type === 'draw') {
      const before = frames[index][player].hand.length, after = frames[index + 1][player].hand.length;
      const count = after - before;
      if (count > 0) {
        expect(await page.evaluate(() => window.wooshes)).toBe(1);
        await expect(page.locator('.flying-card:not(.card-back)')).toHaveCount(0);
        await expect(page.locator('.flying-card [data-card],.flying-card .card-symbol')).toHaveCount(0);
        opponent ||= player !== 0;
      }
      if (count > 1) {
        multi = true; ownMulti ||= player === 0;
        if (player === 0) await expect(page.locator("#hand .in-flight")).toHaveCount(count);
        const delays = await page.evaluate(() => window.flights.map(f => f.options.delay));
        expect(delays.length).toBe(player === 0 ? count : Math.min(count, 4));
        expect(delays.at(-1)).toBe(60);
      }
    }
    await finishFlights(page);
    if (multi && opponent && ownMulti) break;
  }
  expect(multi).toBe(true); expect(opponent).toBe(true); expect(ownMulti).toBe(true);
});

test('mute persists, reduced motion still sounds, and rejected moves stay silent', async ({ page }) => {
  await recordPresentation(page); await page.emulateMedia({ reducedMotion: 'reduce' }); await start(page, fixture('seed-07').replay);
  await page.locator('.hand [aria-disabled="true"]').first().dispatchEvent('click');
  expect(await page.evaluate(() => window.wooshes)).toBe(0);
  await page.locator('#draw').click(); expect(await page.evaluate(() => window.wooshes)).toBe(1);
  await expect(page.locator('.flying-card')).toHaveCount(1);
  await page.locator('#sound-toggle').click(); await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-checked', 'false');
  await page.reload(); await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await page.locator('#room-toggle').click(); await page.locator('#seed-tools summary').click(); await page.locator('#seed').fill('07'.repeat(32)); await page.locator('#restart').click();
  await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-checked', 'false');
  await page.locator('#draw').click(); expect(await page.evaluate(() => window.wooshes)).toBe(0);
});

test('unavailable audio leaves accepted moves and cleanup working', async ({ page }) => {
  await recordPresentation(page, 'unavailable'); const errors = watchErrors(page); await start(page, fixture('seed-07').replay);
  await page.locator('#draw').click(); await expect(page.locator('#board')).toHaveAttribute('data-revision', '1');
  await page.locator('#room-toggle').click(); await page.locator('#restart').click();
  await expect(page.locator('.in-flight,.flying-card')).toHaveCount(0); expect(errors).toEqual([]);
  await expect(page.locator('body')).not.toContainText(/Rust|Wasm|WebRTC/);
});

test('real Web Audio synthesis produces a short quiet envelope', async ({ page }) => {
  await page.addInitScript(() => {
    window.AudioContext = class {
      constructor() {
        const context = new OfflineAudioContext(1, 24000, 48000);
        Object.defineProperty(context, 'state', { get: () => 'running' });
        window.soundRender = context;
        return context;
      }
    };
  });
  await start(page, fixture('seed-07').replay); await page.locator('#draw').click();
  const signal = await page.evaluate(async () => {
    const buffer = await window.soundRender.startRendering();
    const samples = buffer.getChannelData(0);
    return { peak: Math.max(...samples.map(Math.abs)),
      energy: samples.slice(0, 10560).reduce((sum, x) => sum + x * x, 0),
      tail: samples.slice(11520).reduce((sum, x) => sum + x * x, 0) };
  });
  expect(signal.peak).toBeGreaterThan(.001); expect(signal.peak).toBeLessThan(.15);
  expect(signal.energy).toBeGreaterThan(.01); expect(signal.tail).toBeLessThan(.000001);
});


test('card animation preference persists and clears flights independently of sound', async ({ page }) => {
  await recordPresentation(page); await start(page, fixture('seed-07').replay);
  await page.locator('#draw').click(); await expect(page.locator('.flying-card')).toHaveCount(1);
  await page.locator('#room-toggle').click();
  await expect(page.locator('#animations-toggle')).toHaveAttribute('aria-checked', 'true');
  await page.locator('#animations-toggle').click();
  await expect(page.locator('.flying-card,.in-flight')).toHaveCount(0);
  await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-checked', 'true');
  await page.reload(); await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await page.locator('#room-toggle').click(); await page.locator('#seed-tools summary').click(); await page.locator('#seed').fill('07'.repeat(32)); await page.locator('#restart').click();
  await expect(page.locator('#animations-toggle')).toHaveAttribute('aria-checked', 'false');
  await page.locator('#draw').click();
  await expect(page.locator('.flying-card,.in-flight')).toHaveCount(0);
  expect(await page.evaluate(() => window.wooshes)).toBe(1);
});

for (const width of [1280, 390]) test(`UNO centered at ${width}px with and without catch`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 }); await start(page, fixture('seed-07').replay);
  for (const visible of [false, true]) {
    await page.locator('#catch').evaluate((e, visible) => { e.hidden = !visible; e.textContent = 'Catch Player · missed UNO'; }, visible);
    const hand = await page.locator('#hand').boundingBox(), uno = await page.locator('#uno').boundingBox();
    expect(uno.x + uno.width / 2).toBeCloseTo(hand.x + hand.width / 2, 0);
    if (visible) {
      const catcher = await page.locator('#catch').boundingBox();
      if (width < 701) expect(catcher.y).toBeGreaterThanOrEqual(uno.y + uno.height);
      else expect(catcher.x).toBeGreaterThanOrEqual(uno.x + uno.width);
    }
  }
});

for (const touch of [false, true]) test(`${touch ? 'touch mobile scrolled' : 'mouse desktop'} play travels at normal speed`, async ({ browser }, info) => {
  const context = await browser.newContext({ ...info.project.use, viewport: { width: touch ? 390 : 1280, height: 844 }, hasTouch: touch });
  const page = await context.newPage();
  try {
    await page.addInitScript(() => {
      const animate = Element.prototype.animate;
      window.travel = [];
      Element.prototype.animate = function (...args) {
        const animation = animate.apply(this, args);
        if (this.classList.contains('flying-card')) {
          const record = { duration: animation.effect.getTiming().duration, finished: false };
          window.travel.push(record);
          animation.finished.then(() => { record.finished = true; }, () => {});
        }
        return animation;
      };
    });
    await start(page, fixture('seed-07').replay);
    const card = page.locator('.hand [aria-disabled="false"]').last();
    await card.scrollIntoViewIfNeeded();
    if (!touch) await card.hover();
    if (touch) {
      expect(await page.locator('#hand').evaluate(e => e.scrollLeft)).toBeGreaterThan(0);
      await card.tap();
    } else await card.click();
    // Resume real frame scheduling while keeping the bot deadline outside the flight.
    await page.clock.resume();
    await expect(page.locator('.flying-card')).toHaveCount(0);
    const travel = await page.evaluate(() => window.travel);
    expect(travel.length).toBeGreaterThan(0);
    expect(travel.every(flight => flight.duration === 320 && flight.finished)).toBe(true);
    await expect(page.locator('#discard')).toBeVisible();
    await expect(page.locator('#discard')).not.toHaveClass(/in-flight/);
    await page.screenshot({ path: info.outputPath('normal-speed-arrival.png') });
  } finally { await context.close(); }
});


test('rapid accepted plays stack and reveal each arrival beneath the next card', async ({ page }) => {
  await recordPresentation(page); await start(page, fixture('seed-07').replay);
  await page.locator('#card-78').click();
  await page.clock.runFor(350);
  await page.locator('#card-85').click();
  await expect(page.locator('.flying-card')).toHaveCount(3);
  expect(await page.evaluate(() => window.flights.map(f => f.animation.playState))).toEqual(['paused', 'paused', 'paused']);
  for (const index of [0, 1]) {
    await page.evaluate(async index => {
      window.flights[index].animation.finish();
      await Promise.resolve(); await Promise.resolve();
    }, index);
    const arrived = await page.evaluate(index => {
      const f = window.flights[index];
      const r = f.element.getBoundingClientRect(), target = document.getElementById('discard').getBoundingClientRect();
      return { connected: f.element.isConnected, x: r.x, y: r.y, targetX: target.x, targetY: target.y };
    }, index);
    expect(arrived.connected).toBe(true);
    expect(arrived.x).toBeCloseTo(arrived.targetX, 0); expect(arrived.y).toBeCloseTo(arrived.targetY, 0);
    await expect(page.locator('#discard')).toHaveCSS('opacity', '0');
  }
  await expect(page.locator('.flying-card')).toHaveCount(2);
  await finishFlights(page);
  await expect(page.locator('.flying-card,.in-flight')).toHaveCount(0);
  await expect(page.locator('#discard')).toHaveAttribute('data-card', '85');
});

test('color choice preserves a travelling Wild and its hidden destination', async ({ page }) => {
  await recordPresentation(page); await start(page, fixture('seed-07').replay);
  await page.locator('.hand .wild').first().click();
  await page.locator('#choose-Red').click();
  expect(await page.evaluate(() => window.flights[0].animation.playState)).toBe('paused');
  await expect(page.locator('#discard')).toHaveCSS('opacity', '0');
  await page.locator('#room-toggle').click(); await page.locator('#animations-toggle').click();
  await expect(page.locator('.flying-card,.in-flight')).toHaveCount(0);
});
