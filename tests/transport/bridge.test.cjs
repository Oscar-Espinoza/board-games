const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

// Run the production transport with deterministic browser scheduling and no game data.
async function setup() {
  const timers = new Map(),
    sockets = [],
    pcs = [],
    events = [];
  const element = {
    textContent: '',
    dataset: {},
    setAttribute() {},
    addEventListener() {},
    showModal() {},
    close() {},
  };
  let timer = 0;
  class Socket {
    static OPEN = 1;
    readyState = 1;
    sent = [];
    constructor() {
      sockets.push(this);
    }
    send(value) {
      this.sent.push(JSON.parse(value));
    }
    close() {
      this.readyState = 3;
      this.onclose?.();
    }
  }
  class Channel {
    label;
    ordered = true;
    maxRetransmits = null;
    maxPacketLifeTime = null;
    readyState = 'open';
    bufferedAmount = 0;
    sent = [];
    send(value) {
      this.sent.push(value);
    }
    close() {
      this.readyState = 'closed';
      this.onclose?.();
    }
  }
  class Peer {
    connectionState = 'new';
    constructor() {
      pcs.push(this);
    }
    close() {
      this.closed = true;
      this.connectionState = 'closed';
      this.onconnectionstatechange?.();
    }
    createDataChannel(label) {
      this.channel = new Channel();
      this.channel.label = label;
      return this.channel;
    }
    async createOffer() {
      return { type: 'offer' };
    }
    async createAnswer() {
      return { type: 'answer' };
    }
    async setLocalDescription(value) {
      this.localDescription = { toJSON: () => value };
    }
    async setRemoteDescription(value) {
      this.remoteDescription = value;
    }
    async addIceCandidate() {}
    async getStats() {
      return new Map();
    }
  }
  const context = vm.createContext({
    WebSocket: Socket,
    RTCPeerConnection: Peer,
    URLSearchParams,
    TextEncoder,
    Map,
    Set,
    console,
    sessionStorage: {
      getItem() {
        return null;
      },
      setItem() {},
      removeItem() {},
    },
    localStorage: {
      getItem() {
        return null;
      },
    },
    document: { getElementById: () => element, addEventListener() {} },
    location: { protocol: 'http:', host: 'localhost', hash: '', search: '' },
    history: { replaceState() {} },
    performance: { now: () => 0 },
    crypto: { randomUUID: () => String(pcs.length) },
    setTimeout(fn) {
      timers.set(++timer, fn);
      return timer;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    setInterval() {},
    clearInterval() {},
  });
  const constants = require('node:child_process').execFileSync(
    'cargo',
    ['run', '-q', '-p', 'table-protocol', '--example', 'export-browser', '--locked'],
    { encoding: 'utf8' },
  );
  const protocol = new vm.SourceTextModule(constants, { context });
  const module = new vm.SourceTextModule(fs.readFileSync('web/table/transport.js', 'utf8'), {
    context,
  });
  await module.link((specifier) => {
    assert.equal(specifier, './protocol.js');
    return protocol;
  });
  await module.evaluate();
  const api = module.namespace;
  api.configure(
    {
      peer_state: (...args) => events.push(args),
      peer_message: (...args) => events.push(['message', ...args]),
    },
    { gameId: 'color-match', rulesVersion: 2 },
  );
  api.connect_room('create', 'Host', 0);
  const flush = async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  };
  const room = {
    game_id: 'color-match',
    rules_version: 2,
    host_id: 0,
    epoch: 1,
    members: [
      { id: 0, connected: true },
      { id: 1, connected: true },
    ],
  };
  async function message(value) {
    sockets.at(-1).onmessage({ data: JSON.stringify(value) });
    await flush();
  }
  async function welcome() {
    await message({
      type: 'welcome',
      version: protocol.namespace.PROTOCOL_VERSION,
      player: 0,
      credential: 'test',
      room,
    });
    await message({ type: 'ice', ice_servers: [{ urls: 'stun:localhost' }] });
  }
  async function tick() {
    const pending = [...timers.values()];
    timers.clear();
    for (const fn of pending) fn();
    await flush();
  }
  return {
    api,
    protocol: protocol.namespace,
    flush,
    room,
    message,
    welcome,
    tick,
    sockets,
    pcs,
    events,
    timers,
    Peer,
  };
}

test('retry waits for authentication on the replacement socket', async () => {
  const h = await setup();
  await h.welcome();
  h.pcs[0].connectionState = 'failed';
  h.pcs[0].onconnectionstatechange();
  h.sockets[0].close();
  await h.tick();
  assert.equal(h.sockets.length, 2);
  await h.message({ type: 'room', room: h.room });
  assert.equal(h.pcs.length, 1);
  await h.welcome();
  assert.equal(h.pcs.length, 2);
  assert.equal(h.sockets[1].sent.filter((e) => e.type === 'signal').length, 1);
});

test('failed and unsent offers are removed and retried', async () => {
  for (const failure of ['offer', 'send']) {
    const h = await setup();
    if (failure === 'offer')
      h.Peer.prototype.createOffer = async function () {
        delete h.Peer.prototype.createOffer;
        throw Error('failed');
      };
    const originalOffer = async () => ({ type: 'offer' });
    if (failure === 'send') {
      const send = h.sockets[0].send;
      h.sockets[0].send = function (value) {
        if (JSON.parse(value).type === 'signal') {
          this.send = send;
          throw Error('failed');
        }
        send.call(this, value);
      };
    }
    await h.welcome();
    assert.equal(h.pcs.filter((pc) => !pc.closed).length, 0);
    h.Peer.prototype.createOffer = originalOffer;
    await h.tick();
    assert.equal(h.pcs.filter((pc) => !pc.closed).length, 1);
    assert.equal(h.pcs.length, 2);
  }
});

test('stale offer continuations and callbacks cannot mutate a replacement peer', async () => {
  const h = await setup();
  let release;
  h.Peer.prototype.createOffer = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  await h.welcome();
  const old = h.pcs[0],
    callback = old.onconnectionstatechange;
  h.sockets[0].close();
  await h.tick();
  h.Peer.prototype.createOffer = async () => ({ type: 'offer' });
  await h.welcome();
  const signals = h.sockets[1].sent.length;
  release({ type: 'offer' });
  await h.flush();
  old.connectionState = 'failed';
  callback();
  assert.equal(h.sockets[1].sent.length, signals);
  assert.equal(h.pcs.filter((pc) => !pc.closed).length, 1);
  assert.equal(old.localDescription, undefined);
});

test('authority changes and departure cancel retries and queued candidates', async () => {
  const h = await setup();
  await h.welcome();
  const old = h.pcs[0];
  old.connectionState = 'failed';
  old.onconnectionstatechange();
  await h.message({
    type: 'room',
    room: {
      ...h.room,
      epoch: 2,
      members: [
        { id: 0, connected: true },
        { id: 1, connected: false },
      ],
    },
  });
  assert.equal(h.timers.size, 0);
  await h.tick();
  assert.equal(h.pcs.length, 1);
});

test('connected recovery with the same open channel notifies Rust', async () => {
  const h = await setup();
  await h.welcome();
  const pc = h.pcs[0];
  pc.connectionState = 'disconnected';
  pc.onconnectionstatechange();
  pc.connectionState = 'connected';
  pc.onconnectionstatechange();
  assert.deepEqual(h.events.slice(-2), [
    [1, false],
    [1, true],
  ]);
  assert.equal(h.pcs.length, 1);
});

test('queued candidate work is discarded after an authority change', async () => {
  const h = await setup();
  await h.welcome();
  let candidates = 0;
  h.pcs[0].addIceCandidate = async () => {
    candidates++;
  };
  let release;
  h.pcs[0].setRemoteDescription = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  const connectionId = h.sockets[0].sent.find((event) => event.type === 'signal').data.connectionId;
  await h.message({
    type: 'signal',
    from: 1,
    epoch: 1,
    data: { connectionId, description: { type: 'answer' } },
  });
  await h.message({ type: 'signal', from: 1, epoch: 1, data: { connectionId, candidate: {} } });
  await h.message({ type: 'room', room: { ...h.room, epoch: 2 } });
  release();
  await h.flush();
  assert.equal(candidates, 0);
});

test('stale socket open, close and message callbacks cannot affect a resumed room', async () => {
  const h = await setup();
  await h.welcome();
  const old = h.sockets[0];
  const close = old.onclose,
    open = old.onopen;
  old.close();
  await h.tick();
  await h.welcome();
  const count = h.pcs.length;
  open();
  close();
  old.onmessage({ data: JSON.stringify({ type: 'ended' }) });
  await h.flush();
  assert.equal(h.pcs.length, count);
  assert.equal(h.pcs.filter((pc) => !pc.closed).length, 1);
  assert.equal(h.sockets.at(-1).readyState, 1);
  assert.equal(h.timers.size, 0);
});

test('lobby departure removes peers and retry timers for seats absent from the roster', async () => {
  for (const failed of [false, true]) {
    const h = await setup();
    await h.welcome();
    if (failed) {
      h.pcs[0].connectionState = 'failed';
      h.pcs[0].onconnectionstatechange();
    }
    await h.message({ type: 'room', room: { ...h.room, members: [h.room.members[0]] } });
    assert.equal(h.pcs.filter((pc) => !pc.closed).length, 0);
    assert.equal(h.timers.size, 0);
    await h.tick();
    assert.equal(h.pcs.length, 1);
  }
});

test('UTF-8 byte limits apply to incoming and outgoing channels and signaling', async () => {
  const h = await setup();
  await h.welcome();
  const max = h.protocol.MAX_MESSAGE;
  const fits = 'é'.repeat(max / 2);
  const oversized = fits + 'é';
  const channel = h.pcs[0].channel;
  h.api.send_peer(1, fits);
  h.api.send_peer(1, oversized);
  assert.equal(channel.sent.length, 1);
  const before = h.sockets[0].sent.length;
  assert.equal(h.api.send_signal(JSON.stringify({ type: 'ping', padding: oversized })), false);
  assert.equal(h.sockets[0].sent.length, before);
  channel.onmessage({ data: fits });
  assert.equal(h.events.filter((event) => event[0] === 'message').length, 1);
  channel.onmessage({ data: oversized });
  assert.equal(h.events.filter((event) => event[0] === 'message').length, 1);
});

test('older protocol welcome cannot authenticate or create a peer', async () => {
  const h = await setup();
  await h.message({ type: 'welcome', version: 4, player: 0, credential: 'old', room: h.room });
  await h.message({ type: 'ice', ice_servers: [{ urls: 'stun:localhost' }] });
  assert.equal(h.pcs.length, 0);
  assert.equal(h.api.send_signal(JSON.stringify({ type: 'ping' })), false);
});
