const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

// Run the production transport with deterministic browser scheduling and no game data.
function setup() {
  const timers = new Map(), sockets = [], pcs = [], events = [];
  const element = { textContent: '', dataset: {}, setAttribute() {}, addEventListener() {}, showModal() {}, close() {} };
  let timer = 0;
  class Socket {
    static OPEN = 1;
    readyState = 1; sent = [];
    constructor() { sockets.push(this); }
    send(value) { this.sent.push(JSON.parse(value)); }
    close() { this.readyState = 3; this.onclose?.(); }
  }
  class Channel {
    label = 'color-match-v3'; ordered = true; maxRetransmits = null; maxPacketLifeTime = null; readyState = 'open';
    close() { this.readyState = 'closed'; this.onclose?.(); }
  }
  class Peer {
    connectionState = 'new';
    constructor() { pcs.push(this); }
    close() { this.connectionState = 'closed'; this.onconnectionstatechange?.(); }
    createDataChannel() { return new Channel(); }
    async createOffer() { return { type: 'offer' }; }
    async createAnswer() { return { type: 'answer' }; }
    async setLocalDescription(value) { this.localDescription = { toJSON: () => value }; }
    async setRemoteDescription(value) { this.remoteDescription = value; }
    async addIceCandidate() {}
    async getStats() { return new Map(); }
  }
  const context = vm.createContext({
    WebSocket: Socket, RTCPeerConnection: Peer, URLSearchParams, Map, Set, console,
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    localStorage: { getItem() { return null; } },
    document: { getElementById: () => element, addEventListener() {} },
    location: { protocol: 'http:', host: 'localhost', hash: '', search: '' }, history: { replaceState() {} },
    performance: { now: () => 0 }, crypto: { randomUUID: () => String(pcs.length) },
    setTimeout(fn) { timers.set(++timer, fn); return timer; }, clearTimeout(id) { timers.delete(id); },
    setInterval() {}, clearInterval() {},
  });
  const source = fs.readFileSync('web/bridge.js', 'utf8').replaceAll('export function ', 'function ');
  vm.runInContext(source, context);
  const run = code => vm.runInContext(code, context);
  context.record = (...args) => events.push(args);
  run("configure({ peer_state: (...args) => record(...args) }); connect_room('create', 'Host', '');");
  const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
  const room = { host_id: 0, epoch: 1, members: [{ id: 0, connected: true }, { id: 1, connected: true }] };
  async function message(value) { sockets.at(-1).onmessage({ data: JSON.stringify(value) }); await flush(); }
  async function welcome() { await message({ type: 'welcome', version: 3, player: 0, credential: 'test', room }); await message({ type: 'ice', ice_servers: [{ urls: 'stun:localhost' }] }); }
  async function tick() { const pending = [...timers.values()]; timers.clear(); for (const fn of pending) fn(); await flush(); }
  return { run, flush, room, message, welcome, tick, sockets, pcs, events, timers, Peer };
}

test('retry waits for authentication on the replacement socket', async () => {
  const h = setup(); await h.welcome();
  h.pcs[0].connectionState = 'failed'; h.pcs[0].onconnectionstatechange();
  h.sockets[0].close(); await h.tick();
  assert.equal(h.sockets.length, 2);
  await h.run('reconcile(generation)'); assert.equal(h.pcs.length, 1);
  await h.welcome(); assert.equal(h.pcs.length, 2);
  assert.equal(h.sockets[1].sent.filter(e => e.type === 'signal').length, 1);
});

test('failed and unsent offers are removed and retried', async () => {
  for (const failure of ['offer', 'send']) {
    const h = setup();
    if (failure === 'offer') h.Peer.prototype.createOffer = async function() { delete h.Peer.prototype.createOffer; throw Error('failed'); };
    const originalOffer = async () => ({ type: 'offer' });
    if (failure === 'send') { const send = h.sockets[0].send; h.sockets[0].send = function(value) { if (JSON.parse(value).type === 'signal') { this.send = send; throw Error('failed'); } send.call(this, value); }; }
    await h.welcome(); assert.equal(h.run('peers.size'), 0);
    h.Peer.prototype.createOffer = originalOffer;
    await h.tick(); assert.equal(h.run('peers.size'), 1); assert.equal(h.pcs.length, 2);
  }
});

test('stale offer continuations and callbacks cannot mutate a replacement peer', async () => {
  const h = setup(); let release;
  h.Peer.prototype.createOffer = () => new Promise(resolve => { release = resolve; });
  await h.welcome(); const old = h.pcs[0], callback = old.onconnectionstatechange;
  h.sockets[0].close(); await h.tick();
  h.Peer.prototype.createOffer = async () => ({ type: 'offer' });
  await h.welcome(); const signals = h.sockets[1].sent.length;
  release({ type: 'offer' }); await h.flush(); old.connectionState = 'failed'; callback();
  assert.equal(h.sockets[1].sent.length, signals); assert.equal(h.run('peers.size'), 1);
  assert.equal(old.localDescription, undefined);
});

test('authority changes and departure cancel retries and queued candidates', async () => {
  const h = setup(); await h.welcome();
  const old = h.pcs[0]; old.connectionState = 'failed'; old.onconnectionstatechange();
  await h.message({ type: 'room', room: { ...h.room, epoch: 2, members: [{ id: 0, connected: true }, { id: 1, connected: false }] } });
  assert.equal(h.timers.size, 0); await h.tick(); assert.equal(h.pcs.length, 1);
});

test('connected recovery with the same open channel notifies Rust', async () => {
  const h = setup(); await h.welcome(); const pc = h.pcs[0];
  pc.connectionState = 'disconnected'; pc.onconnectionstatechange();
  pc.connectionState = 'connected'; pc.onconnectionstatechange();
  assert.deepEqual(h.events.slice(-2), [[1, false], [1, true]]);
  assert.equal(h.pcs.length, 1);
});

test('queued candidate work is discarded after an authority change', async () => {
  const h = setup(); await h.welcome();
  let candidates = 0;
  h.pcs[0].addIceCandidate = async () => { candidates++; };
  h.run('peers.get(1).incoming = new Promise(resolve => globalThis.releaseCandidate = resolve)');
  const pending = h.run("receiveSignal(1, { connectionId: peers.get(1).connectionId, candidate: {} }, generation)");
  await h.message({ type: 'room', room: { ...h.room, epoch: 2 } });
  h.run('releaseCandidate()'); await pending;
  assert.equal(candidates, 0);
});

test('stale socket open, close and message callbacks cannot affect a resumed room', async () => {
  const h = setup(); await h.welcome(); const old = h.sockets[0];
  const close = old.onclose, open = old.onopen;
  old.close(); await h.tick(); await h.welcome();
  const count = h.pcs.length;
  open(); close(); old.onmessage({ data: JSON.stringify({ type: 'ended' }) }); await h.flush();
  assert.equal(h.pcs.length, count); assert.equal(h.run('peers.size'), 1);
  assert.equal(h.run('signalingReady(generation)'), true); assert.equal(h.timers.size, 0);
});

test('lobby departure removes peers and retry timers for seats absent from the roster', async () => {
  for (const failed of [false, true]) {
    const h = setup(); await h.welcome();
    if (failed) { h.pcs[0].connectionState = 'failed'; h.pcs[0].onconnectionstatechange(); }
    await h.message({ type: 'room', room: { ...h.room, members: [h.room.members[0]] } });
    assert.equal(h.run('peers.size'), 0);
    assert.equal(h.timers.size, 0);
    await h.tick(); assert.equal(h.pcs.length, 1);
  }
});
