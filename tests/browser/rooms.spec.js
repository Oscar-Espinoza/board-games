const {test,expect}=require('@playwright/test');
async function instrument(context) {
  if (context.transportInstrumented) return;
  context.transportInstrumented = true;
  const close = context.close.bind(context);
  context.close = async (...args) => {
    for (const [index, page] of context.pages().entries()) {
      if (!page.isClosed()) {
        const transitions = await page.evaluate(() => window.transitions || []).catch(() => []);
        await test.info().attach(`transport-${test.info().attachments.length}-${index}`, { body: JSON.stringify(transitions, null, 2), contentType: 'application/json' });
      }
    }
    return close(...args);
  };
  await context.addInitScript(()=>{
    window.transitions=[];
    const transition=(kind,id,state)=>window.transitions.push({at:Date.now(),kind,id,state});
    window.peerConnections=[];window.received=[];window.sent=[];window.channels=[];window.sockets=[];window.flightCount=0;
    const animate=Element.prototype.animate;Element.prototype.animate=function(...args){if(this.classList.contains('flying-card'))window.flightCount++;return animate.apply(this,args);};
    const OriginalSocket=window.WebSocket;window.WebSocket=class extends OriginalSocket{constructor(...args){super(...args);const id=window.sockets.length;window.sockets.push(this);transition('socket',id,'created');for(const event of ['open','close','error'])this.addEventListener(event,e=>transition('socket',id,event==='close'?`close:${e.code}`:event));const send=this.send.bind(this);this.send=value=>{try{transition('socket-send',id,JSON.parse(value).type);}catch{}return send(value);};this.addEventListener('message',e=>{try{const type=JSON.parse(e.data).type;if(['welcome','room','handoff_commit','ended'].includes(type))transition('socket',id,type);}catch{}});}};
    const Original=window.RTCPeerConnection;
    window.RTCPeerConnection=class extends Original{constructor(...args){super(...args);const id=window.peerConnections.length;window.peerConnections.push(this);transition('peer',id,'created');for(const event of ['connectionstatechange','iceconnectionstatechange','signalingstatechange'])this.addEventListener(event,()=>transition(event,id,event==='connectionstatechange'?this.connectionState:event==='iceconnectionstatechange'?this.iceConnectionState:this.signalingState));this.addEventListener('datachannel',e=>record(e.channel));}createDataChannel(...args){const c=super.createDataChannel(...args);record(c);return c;}};
    function record(c){const id=window.channels.length;window.channels.push(c);transition('channel',id,c.readyState);for(const event of ['open','close','error'])c.addEventListener(event,()=>transition('channel',id,event));c.addEventListener('message',e=>{try{window.received.push(JSON.parse(e.data));}catch{}});const send=c.send.bind(c);c.send=(value)=>{try{window.sent.push(JSON.parse(value));}catch{}return send(value);};}
  });
}
async function create(page){await instrument(page.context());await page.goto(process.env.TEST_RELAY ? '/?relay=1' : '/');await expect(page.locator('#app')).toHaveAttribute('data-ready','true');await page.locator('#room-toggle').click();await page.locator('#name').fill('Host');await page.locator('#create-room').click();await expect(page.locator('#invite')).toHaveValue(/#room=[a-f0-9]{64}$/);const url=new URL(await page.locator('#invite').inputValue());if(process.env.TEST_RELAY)url.search='?relay=1';return url.href;}
async function join(page,url,name){await instrument(page.context());await page.goto(url);await page.locator('#name').fill(name);await page.locator('#join-room').click();await expect(page.locator('#room-details')).toHaveJSProperty('hidden',false);}
async function start(host){await expect(host.locator('#start-round')).toBeEnabled({timeout:20000});await host.locator('#start-round').click();await expect(host.locator('#board')).toBeVisible();}
test('private invite, real DataChannel actions, redaction, stale/duplicate rejection and guest reload',async({browser},info)=>{
  const a=await browser.newContext(),b=await browser.newContext();await instrument(a);await instrument(b);const host=await a.newPage(),guest=await b.newPage();const errors=[];for(const p of [host,guest])p.on('pageerror',e=>errors.push(e.message));
  try {
    const url=await create(host);await join(guest,url,'Friend <safe>');await expect(host.locator('#roster')).toContainText('Friend <safe>');await start(host);await expect(guest.locator('#board')).toHaveAttribute('data-player','1');
    if(process.env.TEST_RELAY)for(const p of [host,guest])await expect(p.locator('#diagnostics')).toHaveAttribute('data-transport','TURN relay');
    await host.locator('#draw').click();await expect(guest.locator('#board')).toHaveAttribute('data-revision','1');await guest.locator('#draw').click();await expect(host.locator('#board')).toHaveAttribute('data-revision','2');await expect(guest.locator('#board')).toHaveAttribute('data-revision','2');
    const count=await guest.evaluate(()=>window.flightCount);
    await guest.evaluate(async()=>{const wasm=await import('/pkg/board_games_web.js');wasm.peer_message(0,JSON.stringify(window.received.at(-1)));});
    expect(await guest.evaluate(()=>window.flightCount)).toBe(count);
    const messages=await guest.evaluate(()=>window.received);expect(messages.length).toBeGreaterThan(1);
    for(const message of messages){expect(message.view.player).toBe(1);for(const key of ['seed','hands','stock','rng'])expect(message.view).not.toHaveProperty(key);expect(JSON.stringify(message)).not.toContain('credential');for(const e of message.events)if(e.type==='drew')expect(Object.keys(e).sort()).toEqual(['count','player','type']);}
    const hostHand=await host.locator('.hand [data-card]').evaluateAll(els=>els.map(e=>Number(e.dataset.card)));const guestHand=messages.at(-1).view.hand.map(c=>c.id);expect(hostHand.some(id=>guestHand.includes(id))).toBe(false);
    await guest.evaluate(()=>{const e=window.sent.find(m=>m.action);window.channels.find(c=>c.readyState==='open').send(JSON.stringify(e));});await expect.poll(()=>guest.evaluate(()=>window.received.at(-1)?.ack?.status)).toBe('duplicate');await expect(host.locator('#board')).toHaveAttribute('data-revision','2');
    await guest.evaluate(()=>{const e=window.sent.find(m=>m.action);window.channels.find(c=>c.readyState==='open').send(JSON.stringify({...e,action_id:e.action_id+1,revision:0}));});await expect.poll(()=>guest.evaluate(()=>window.received.at(-1)?.ack?.status)).toBe('stale');
    await guest.reload();await expect(host.locator('#status')).toContainText('paused');await guest.locator('#join-room').click();await expect(guest.locator('#board')).toHaveAttribute('data-revision','2',{timeout:20000});await expect(host.locator('#status')).not.toContainText('paused');await expect(guest.locator('.flying-card')).toHaveCount(0);expect(errors).toEqual([]);
    await host.screenshot({path:info.outputPath('room-host.png')});
    for(const p of [host,guest]){await expect(p.locator('#diagnostics')).toHaveText('Connected');await expect(p.locator('body')).not.toContainText(/Rust|Wasm|WebRTC|TURN/);}
    await guest.locator('#room-toggle').click();await guest.locator('[data-close]').first().click();await guest.locator('#leave-room').click();
    await expect(guest.locator('#diagnostics')).toBeEmpty();await expect(guest.locator('#diagnostics')).toHaveAttribute('data-transport','');
  }finally{await a.close();await b.close();}
});
test('eight-seat room with humans and bots locks admissions',async({browser})=>{
  const contexts=await Promise.all(Array.from({length:3},()=>browser.newContext()));for(const c of contexts)await instrument(c);const [host,g1,g2]=await Promise.all(contexts.map(c=>c.newPage()));
  try {const url=await create(host);await join(g1,url,'A');await join(g2,url,'B');await expect(host.locator('#roster li')).toHaveCount(3);for(let i=0;i<5;i++)await host.locator('#add-bot').click();await expect(host.locator('#roster li')).toHaveCount(8);await expect(host.locator('#add-bot')).toBeDisabled();await start(host);for(const p of [host,g1,g2])await expect(p.locator('.seat:not([hidden])')).toHaveCount(7);
    await host.locator('#draw').click();await expect(g1.locator('#draw')).toBeEnabled();await g1.locator('#draw').click();await expect(g2.locator('#draw')).toBeEnabled();await g2.locator('#draw').click();await expect.poll(()=>host.locator('#board').getAttribute('data-revision')).not.toBe('3');
    const extra=await browser.newContext();try{const p=await extra.newPage();await p.goto(url);await p.locator('#join-room').click();await expect(p.locator('#error')).toContainText('full, expired or already playing');}finally{await extra.close();}
  }finally{for(const c of contexts)await c.close();}
});
test('host signaling reconnection keeps live authority',async({browser})=>{
  const a=await browser.newContext(),b=await browser.newContext();await instrument(a);await instrument(b);const host=await a.newPage(),guest=await b.newPage();try{const url=await create(host);await join(guest,url,'Friend');await start(host);await expect(guest.locator('#board')).toHaveAttribute('data-player','1');await host.locator('#draw').click();await expect(guest.locator('#board')).toHaveAttribute('data-revision','1');await host.evaluate(()=>window.sockets.at(-1).close());await expect(guest.locator('#status')).toContainText('paused');await expect(host.locator('#status')).not.toContainText('paused',{timeout:20000});await expect(guest.locator('#board')).toHaveAttribute('data-revision','1');await expect(guest.locator('#draw')).toBeEnabled();}finally{await a.close();await b.close();}
});
test('eight human browser contexts receive only their own hands',async({browser})=>{
  test.setTimeout(process.env.CI ? 120000 : 60000);const progress={timeout:process.env.CI ? 20000 : 5000};const contexts=[];const pages=[];try{
    for(let i=0;i<8;i++){const c=await browser.newContext();contexts.push(c);await instrument(c);pages.push(await c.newPage());}
    const url=await create(pages[0]);for(let i=1;i<8;i++)await join(pages[i],url,`Friend ${i}`);await expect(pages[0].locator('#roster li')).toHaveCount(8);await start(pages[0]);
    const hands=[];for(let i=0;i<8;i++){await expect(pages[i].locator('#board')).toHaveAttribute('data-player',String(i));await expect(pages[i].locator('#hand-count')).toHaveText('7');hands.push(...await pages[i].locator('.hand [data-card]').evaluateAll(es=>es.map(e=>Number(e.dataset.card))));}expect(new Set(hands).size).toBe(56);
    // Background WebKit pages throttle the frames used by pointer stability checks.
    // Exercise each Rust action after readiness, as in the full-round transport test.
    for(let i=0;i<8;i++){await expect(pages[i].locator('#draw')).toBeEnabled(progress);await pages[i].locator('#draw').dispatchEvent('click');}
    for(const p of pages)await expect(p.locator('#board')).toHaveAttribute('data-revision','8',progress);
  }finally{for(const c of contexts)await c.close();}
});
test('temporary bot after 60 seconds and returning guest reclaims seat',async({browser})=>{
  const a=await browser.newContext(),b=await browser.newContext();await instrument(a);await instrument(b);const host=await a.newPage(),guest=await b.newPage();try{
    await host.clock.install();await host.clock.pauseAt(new Date(Date.now()+1000));const url=await create(host);await join(guest,url,'Friend');await start(host);await expect(guest.locator('#board')).toHaveAttribute('data-player','1');await guest.reload();await expect(host.locator('#status')).toContainText('paused');
    await host.clock.fastForward(61000);await expect(host.getByText('Fill with bot · Friend',{exact:true})).toBeVisible();await host.getByText('Fill with bot · Friend',{exact:true}).click();await expect(host.locator('#status')).not.toContainText('paused');await host.locator('#draw').click();
    await guest.locator('#join-room').click();await expect(guest.locator('#board')).toHaveAttribute('data-player','1');await expect(guest.locator('#draw')).toBeEnabled();const revision=await host.locator('#board').getAttribute('data-revision');await host.clock.runFor(350);await expect(host.locator('#board')).toHaveAttribute('data-revision',revision);
  }finally{await a.close();await b.close();}
});
test('Chromium and Firefox share a live round',async({},info)=>{
  test.skip(info.project.name!=='chromium','One cross-engine run is sufficient.');const {chromium,firefox}=require('@playwright/test');const engines=await Promise.all([chromium.launch(),firefox.launch({firefoxUserPrefs:{"media.peerconnection.ice.loopback":process.env.LOCAL_TURN_TEST==='true'}})]);const contexts=await Promise.all(engines.map(b=>b.newContext({baseURL:info.project.use.baseURL})));try{
    const [host,guest]=await Promise.all(contexts.map(c=>c.newPage()));const url=await create(host);await join(guest,url,'Firefox friend');await start(host);await expect(guest.locator('#board')).toHaveAttribute('data-player','1');await host.locator('#draw').click();await expect(guest.locator('#draw')).toBeEnabled();await guest.locator('#draw').click();await expect(host.locator('#board')).toHaveAttribute('data-revision','2');
  }finally{for(const c of contexts)await c.close();for(const b of engines)await b.close();}
});
test('complete a human round and rematch in the same room',async({browser})=>{
  test.setTimeout(process.env.CI ? 120000 : 60000);const a=await browser.newContext(),b=await browser.newContext();const host=await a.newPage(),guest=await b.newPage();try{
    const url=await create(host);await join(guest,url,'Friend');await start(host);await expect(guest.locator('#board')).toHaveAttribute('data-player','1');
    for(let i=0;i<600;i++){
      if((await host.locator('#status').textContent()).includes('win'))break;
      const hostTurn=/Your turn|Choose a color/.test(await host.locator('#status').textContent());const p=hostTurn?host:guest;
      if(await p.locator('#color-choices').isVisible())await p.locator('#choose-Red').dispatchEvent('click');
      else {if(await p.locator('#uno').isEnabled())await p.locator('#uno').dispatchEvent('click');const card=p.locator('.hand [aria-disabled="false"]').first();if(await card.count())await card.dispatchEvent('click');else await p.locator('#draw').dispatchEvent('click');}
      for(const page of [host,guest])await expect(page.locator('#board')).toHaveAttribute('data-revision',String(i+1));
    }
    await expect(host.locator('#status')).toContainText('win');const round=Number(await host.locator('#board').getAttribute('data-round'));await host.locator('#room-toggle').click();await expect(host.locator('#start-round')).toHaveText('Rematch');await start(host);for(const p of [host,guest]){await expect(p.locator('#board')).toHaveAttribute('data-round',String(round+1));await expect(p.locator('#board')).toHaveAttribute('data-revision','0');await expect(p.locator('#hand-count')).toHaveText('7');}
  }finally{await a.close();await b.close();}
});

test('welcome, invitation Back, capacity and lobby host promotion',async({browser})=>{
  const a=await browser.newContext(),b=await browser.newContext();const host=await a.newPage(),guest=await b.newPage();try {
    await host.goto('/');await expect(host.locator('#welcome')).toBeVisible();await expect(host.locator('#board')).toBeHidden();await expect(host.locator('#new-game')).toHaveCount(0);
    const url=await create(host);await expect(host.locator('#room-size')).toHaveValue('8');await host.locator('#room-size').selectOption('2');await expect(host.locator('#room-count')).toHaveText('1 / 2 seats');
    await guest.goto(url);await expect(guest.locator('#create-room')).toBeHidden();await guest.getByRole('button',{name:'Back',exact:true}).click();await expect(guest).not.toHaveURL(/#room=/);await expect(guest.locator('#welcome')).toBeVisible();
    await join(guest,url,'Friend');await expect(host.locator('#room-count')).toHaveText('2 / 2 seats');await expect(host.locator('#add-bot')).toBeDisabled();
    await host.locator('[data-close]').first().click();await host.locator('#leave-room').click();await expect(host.locator('#welcome')).toBeVisible();await expect(host).not.toHaveURL(/#room=/);
    await expect(guest.locator('#host-controls')).toBeVisible();await expect(guest.locator('#room-count')).toHaveText('1 / 2 seats');await expect(guest.locator('#start-round')).toBeDisabled();
    await guest.locator('#add-bot').click();await expect(guest.locator('#start-round')).toBeDisabled();
    await guest.locator('[data-close]').first().click();await guest.locator('#leave-room').click();await expect(guest.locator('#welcome')).toBeVisible();
  }finally{await a.close();await b.close();}
});
test('repeated deliberate handoffs preserve hands, private checkpoints and former-host rejoin',async({browser})=>{
  const contexts=await Promise.all(Array.from({length:3},()=>browser.newContext()));for(const c of contexts)await instrument(c);const [host,g1,g2]=await Promise.all(contexts.map(c=>c.newPage()));const errors=[];for(const p of [host,g1,g2])p.on('pageerror',e=>errors.push(e.message));
  try {
    const url=await create(host);await join(g1,url,'First');await join(g2,url,'Second');await start(host);await expect(g2.locator('#board')).toHaveAttribute('data-player','2');
    await host.locator('#draw').click();await expect(g1.locator('#board')).toHaveAttribute('data-revision','1');
    const hand=p=>p.locator('#hand [data-card]').evaluateAll(es=>es.map(e=>Number(e.dataset.card)).sort((a,b)=>a-b));const hands=await Promise.all([host,g1,g2].map(hand));
    await host.locator('#leave-room').click();await expect(host.locator('#board')).toBeHidden();await expect(host).not.toHaveURL(/#room=/);
    await expect(g1.locator('#status')).toContainText('paused');await expect(g1.getByRole('button',{name:'Fill with bot · Host',exact:true})).toBeVisible();
    expect(await hand(g1)).toEqual(hands[1]);expect(await hand(g2)).toEqual(hands[2]);
    expect(await g1.evaluate(()=>window.received.filter(m=>m.type==='checkpoint').length)).toBe(1);expect(await g2.evaluate(()=>window.received.some(m=>m.type==='checkpoint'))).toBe(false);
    await join(host,url,'Host');await expect(host.locator('#board')).toHaveAttribute('data-player','0');await expect(host.locator('#status')).not.toContainText('paused');expect(await hand(host)).toEqual(hands[0]);
    await host.locator('#room-toggle').click();await expect(host.locator('#host-controls')).toBeHidden();await host.locator('[data-close]').first().click();
    await g1.locator('#draw').click();await expect(g2.locator('#board')).toHaveAttribute('data-revision','2');
    await g1.locator('#leave-room').click();await expect(g1.locator('#board')).toBeHidden();await expect(host.getByRole('button',{name:'Fill with bot · First',exact:true})).toBeVisible();
    await join(g1,url,'First');await expect(g1.locator('#board')).toHaveAttribute('data-revision','2');await expect(g2.locator('#draw')).toBeEnabled();await g2.locator('#draw').click();await expect(host.locator('#board')).toHaveAttribute('data-revision','3');
    expect(errors).toEqual([]);
  }finally{for(const c of contexts)await c.close();}
});
test('explicit guest departure offers immediate replacement and reclaim',async({browser})=>{
 const a=await browser.newContext(),b=await browser.newContext();const host=await a.newPage(),guest=await b.newPage();try{
  const url=await create(host);await join(guest,url,'Friend');await start(host);await expect(guest.locator('#board')).toHaveAttribute('data-player','1');
  await guest.locator('#leave-room').click();await expect(host.getByRole('button',{name:'Wait',exact:true})).toBeVisible();await host.getByRole('button',{name:'Fill with bot · Friend',exact:true}).click();await expect(host.locator('#status')).not.toContainText('paused');
  await join(guest,url,'Friend');await expect(guest.locator('#board')).toHaveAttribute('data-player','1');await expect(host.locator('#replace-controls')).toBeEmpty();
  await guest.locator('#leave-room').click();await expect(guest.locator('#board')).toBeHidden();await host.locator('#leave-room').click();await expect(host.locator('#board')).toBeHidden();
 }finally{await a.close();await b.close();}
});
test('failed checkpoint transfer retains authority and can retry',async({browser})=>{
 test.setTimeout(process.env.CI ? 60000 : 45000);const a=await browser.newContext(),b=await browser.newContext();await instrument(a);await instrument(b);const host=await a.newPage(),guest=await b.newPage();try{
  const url=await create(host);await join(guest,url,'Friend');await start(host);await expect(guest.locator('#board')).toHaveAttribute('data-player','1');
  await host.evaluate(()=>{const c=window.channels.find(c=>c.readyState==='open');const send=c.send.bind(c);window.restoreCheckpoint=()=>c.send=send;c.send=value=>{if(JSON.parse(value).type!=='checkpoint')send(value);};});
  await host.locator('#leave-room').click();await expect(host.locator('#status')).toContainText('paused');await expect(host.locator('#error')).toContainText('timed out',{timeout:22000});await expect(host.locator('#draw')).toBeEnabled();
  await host.evaluate(()=>window.restoreCheckpoint());await host.locator('#leave-room').click();await expect(host.locator('#board')).toBeHidden();await expect(guest.getByRole('button',{name:'Fill with bot · Host',exact:true})).toBeVisible();
 }finally{await a.close();await b.close();}
});

test('mobile keyboard navigation and clipboard success/fallback',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await expect(page.locator('#welcome')).toBeVisible();
 await page.locator('#welcome button').focus();await page.keyboard.press('Enter');await expect(page.locator('#identity')).toBeVisible();await page.getByRole('button',{name:'Back',exact:true}).focus();await page.keyboard.press('Space');await expect(page.locator('#room-panel')).not.toBeVisible();
 await page.locator('#welcome button').click();await page.locator('#create-room').click();await expect(page.locator('#room-details')).toBeVisible();
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.copied=text}}));
 await page.locator('#copy-invite').click();expect(await page.evaluate(()=>window.copied)).toBe(await page.locator('#invite').inputValue());await expect(page.locator('#copy-invite')).toHaveText('Copied');
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('Denied');}}}));await page.locator('#copy-invite').click();
 expect(await page.locator('#invite').evaluate(e=>e.selectionEnd-e.selectionStart)).toBe((await page.locator('#invite').inputValue()).length);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('room-mobile.png')});
 await page.locator('#room-details [data-action="leave"]').focus();await page.keyboard.press('Enter');await expect(page.locator('#room-panel')).not.toBeVisible();await expect(page.locator('#welcome button')).toBeFocused();
});

for (const delayed of [false, true]) test(`reconnect regression: ${delayed ? 'delayed authentication' : 'failed offer'} resumes gameplay`, async ({ browser }) => {
  const a = await browser.newContext(), b = await browser.newContext();
  await instrument(a); await instrument(b);
  const host = await a.newPage(), guest = await b.newPage();
  try {
    const url = await create(host); await join(guest, url, 'Friend'); await start(host);
    await expect(guest.locator('#board')).toHaveAttribute('data-player', '1');
    await host.locator('#draw').click();
    await expect(guest.locator('#board')).toHaveAttribute('data-revision', '1');
    await host.evaluate(delayed => {
      if (delayed) {
        const send = window.sockets.at(-1).constructor.prototype.send || Object.getPrototypeOf(WebSocket.prototype).send;
        WebSocket.prototype.send = function(value) {
          if (JSON.parse(value).type === 'resume' && !window.resumeReleased) {
            window.releaseResume = () => { window.resumeReleased = true; WebSocket.prototype.send = send; send.call(this, value); };
          } else send.call(this, value);
        };
      } else {
        const offer = RTCPeerConnection.prototype.createOffer;
        RTCPeerConnection.prototype.createOffer = function(...args) {
          RTCPeerConnection.prototype.createOffer = offer;
          return Promise.reject(new Error('Injected offer failure'));
        };
      }
      window.sockets.at(-1).close();
    }, delayed);
    await expect(guest.locator('#status')).toContainText('paused');
    if (delayed) {
      await expect.poll(() => host.evaluate(() => typeof window.releaseResume)).toBe('function');
      // The replacement socket is open, but has not sent its authentication yet.
      expect(await host.evaluate(() => window.peerConnections.every(pc => pc.connectionState === 'closed'))).toBe(true);
      await host.evaluate(() => window.releaseResume());
    }
    await expect(host.locator('#status')).not.toContainText('paused', { timeout: 20000 });
    await expect(guest.locator('#draw')).toBeEnabled(); await guest.locator('#draw').click();
    await expect(host.locator('#board')).toHaveAttribute('data-revision', '2');
    await expect(guest.locator('#board')).toHaveAttribute('data-revision', '2');
  } finally { await a.close(); await b.close(); }
});

test('lobby guest departure clears readiness and permits a fresh join', async ({ browser }) => {
  const a = await browser.newContext(), b = await browser.newContext();
  const host = await a.newPage(), guest = await b.newPage();
  try {
    const url = await create(host); await join(guest, url, 'Friend');
    await expect(host.locator('#start-round')).toBeEnabled();
    await guest.locator('#room-details [data-action="leave"]').click();
    await expect(host.locator('#roster li')).toHaveCount(1);
    await expect(host.locator('#start-round')).toBeDisabled();
    // A subsequent room response ensures any earlier readiness error was processed.
    await host.locator('#add-bot').click();
    await expect(host.locator('#roster li')).toHaveCount(2);
    await expect(host.locator('#error')).toBeEmpty();
    await expect(host.locator('#panel-error')).toBeEmpty();
    await join(guest, url, 'Returning friend'); await start(host);
    await expect(guest.locator('#board')).toHaveAttribute('data-player', '2');
    await expect(host.locator('#error')).toBeEmpty();
  } finally { await a.close(); await b.close(); }
});
