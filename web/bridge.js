// Browser transport and animation primitives. Rules and host acceptance live in Rust.
let wasm, socket, current, generation = 0, iceServers = [], heartbeat, iceRefresh, retry, hostTimer;
const peers = new Map();
let pendingSignals = [];
let counter = Number(sessionStorage.getItem('cm-action-id') || 0);
export function configure(module) { wasm = module; }
export function next_action_id() { counter += 1; sessionStorage.setItem('cm-action-id', String(counter)); return BigInt(counter); }
const report = (message) => { document.getElementById('error').textContent = message; document.getElementById('panel-error').textContent = message; };
const call = (fn, ...args) => { try { wasm?.[fn](...args); } catch (e) { report(String(e)); } };
function closePeer(id) { const peer = peers.get(id); if (peer) { peers.delete(id); peer.channel?.close(); peer.pc.close(); } }
export function leave_room() {
  generation++; clearInterval(heartbeat); clearInterval(iceRefresh); clearTimeout(retry); clearTimeout(hostTimer); hostTimer = null;
  if (socket) { socket.onclose = null; socket.close(); socket = null; }
  for (const id of peers.keys()) closePeer(id);
  current = null; iceServers = []; pendingSignals = []; connectionStatus(''); cancel_motion();
}
export function send_signal(value) { if (socket?.readyState === WebSocket.OPEN) socket.send(value); else report('Reconnecting…'); }
export function send_peer(id, value) {
  if (!current?.room?.members.some(m => m.id === id && m.connected)) return;
  const channel = peers.get(id)?.channel;
  if (channel?.readyState === 'open' && channel.bufferedAmount < 128 * 1024) {
    try { channel.send(value); } catch { channel.close(); } // A peer can disappear before readyState updates.
  }
}
export function connect_room(kind, name, avatar) {
  if (!name.trim() || name.trim().length > 24) { report('Enter a name of 1–24 characters.'); return; }
  const invite = new URLSearchParams(location.hash.slice(1)).get('room');
  if (kind === 'join' && !/^[a-f0-9]{64}$/.test(invite || '')) { report('Open a valid invite link first.'); return; }
  leave_room();
  const saved = kind === 'join' ? sessionStorage.getItem(`cm-seat:${invite}`) : null;
  current = { hello: saved ? { type: 'resume', version: 3, invite, credential: saved } : { type: kind, version: 3, name, avatar, ...(invite && kind === 'join' ? { invite } : {}) }, player: null, invite, credential: null, room: null };
  openSocket(generation);
}
function openSocket(epoch) {
  if (!current || epoch !== generation) return;
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/signal`); socket = ws;
  ws.onopen = () => ws.send(JSON.stringify(current.credential ? { type: 'resume', version: 3, invite: current.invite, credential: current.credential } : current.hello));
  let incoming = Promise.resolve();
  const handleMessage = async ({ data }) => {
    if (epoch !== generation || ws !== socket || data.length > 32768) return;
    let event; try { event = JSON.parse(data); } catch { return; }
    try {
      if (event.type === 'welcome') {
        if (event.version !== 3) throw new Error('Unsupported room protocol.');
        current.player = event.player; current.invite = event.room.invite; current.credential = event.credential; current.room = event.room;
        if (event.player !== event.room.host_id) sessionStorage.setItem(`cm-seat:${current.invite}`, event.credential);
        history.replaceState(null, '', `#room=${current.invite}`);
        call('signal_event', JSON.stringify(event)); call('network_state', true);
        clearTimeout(hostTimer); hostTimer = null; clearInterval(heartbeat); clearInterval(iceRefresh);
        heartbeat = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send('{"type":"ping"}'); }, 10000);
        ws.send('{"type":"ice"}');
        iceRefresh = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send('{"type":"ice"}'); }, 300000);
        document.getElementById('room-panel').showModal();
      } else if (event.type === 'ice') {
        const previousIce = JSON.stringify(iceServers);
        iceServers = Array.isArray(event.ice_servers) ? event.ice_servers : [event.ice_servers];
        if (previousIce !== '[]' && previousIce !== JSON.stringify(iceServers)) {
          for (const [id, peer] of peers) {
            peer.pc.setConfiguration({ ...peer.pc.getConfiguration(), iceServers });
            if (current.player === current.room?.host_id) { connectionStatus('Reconnecting…'); call('peer_state', id, false); closePeer(id); }
          }
        }
        const relay = iceServers.some(s => [s.urls].flat().some(u => /^turns?:/.test(u)));
        connectionStatus('Connected', relay ? 'TURN available' : 'direct connections only');
        for (const event of pendingSignals.splice(0)) if (event.epoch === current.room?.epoch) await receiveSignal(event.from, event.data, epoch);
        await reconcile(epoch);
      } else if (event.type === 'handoff_commit') {
        cancel_motion();
        if (current.player === event.former_host) {
          sessionStorage.setItem(`cm-seat:${current.invite}`, current.credential);
        } else if (current.player === event.room.host_id) {
          sessionStorage.removeItem(`cm-seat:${current.invite}`);
        }
        for (const id of peers.keys()) closePeer(id);
        current.room = event.room;
        call('signal_event', data);
        await reconcile(epoch);
      } else if (event.type === 'left') {
        if (current.room?.locked) sessionStorage.setItem(`cm-seat:${current.invite}`, current.credential);
        else sessionStorage.removeItem(`cm-seat:${current.invite}`);
        call('signal_event', data);
      } else if (['handoff_prepare', 'handoff_ready', 'handoff_cancel', 'departed'].includes(event.type)) {
        call('signal_event', data);
      } else if (event.type === 'room') {
        if (current.room?.host_id !== event.room.host_id) {
          for (const id of peers.keys()) closePeer(id);
          if (current.player === event.room.host_id) sessionStorage.removeItem(`cm-seat:${current.invite}`);
        }
        current.room = event.room; call('signal_event', data);
        if (event.room.locked) document.getElementById('room-panel').close();
        await reconcile(epoch);
      } else if (event.type === 'signal') {
        if (event.epoch !== current.room?.epoch) return;
        if (iceServers.length) await receiveSignal(event.from, event.data, epoch); else pendingSignals.push(event);
      } else if (event.type === 'ended') {
        call('signal_event', data); clearTimeout(retry); ws.onclose = null; ws.close();
        for (const id of peers.keys()) closePeer(id);
      } else if (event.type === 'error') {
        call('signal_event', data);
        // An invalid saved seat is never silently converted to a new admission.
        if (event.message.includes('credential') || event.message.includes('expired')) clearTimeout(retry);
      }
    } catch (e) { report(`Connection problem: ${e.message || e}`); }
  };
  ws.onmessage = event => { incoming = incoming.then(() => handleMessage(event)).catch(e => report(`Connection problem: ${e.message || e}`)); };
  ws.onclose = () => {
    if (epoch !== generation) return;
    call('network_state', false);
    connectionStatus('Reconnecting…');
    if (current?.player !== current?.room?.host_id) hostDeadline(epoch);
    for (const id of peers.keys()) { connectionStatus('Reconnecting…'); call('peer_state', id, false); closePeer(id); }
    if (current?.credential) retry = setTimeout(() => openSocket(epoch), 1800);
    else if (!document.getElementById('error').textContent) report('Could not join the room. Check the invite and try again.');
  };
  ws.onerror = () => report('The room service is unavailable. A free host may take a moment to wake up.');
}
async function reconcile(epoch) {
  if (!current?.room || !iceServers.length || epoch !== generation) return;
  for (const member of current.room.members) {
    if (member.bot || member.id === current.player) continue;
    if (!member.connected) { if (peers.has(member.id)) { closePeer(member.id); call('peer_state', member.id, false); } continue; }
    if (current.player === current.room?.host_id && !peers.has(member.id)) await offer(member.id, epoch);
  }
}
function createPeer(id, epoch, connectionId) {
  closePeer(id);
  const forceRelay = new URLSearchParams(location.search).get('relay') === '1';
  const pc = new RTCPeerConnection({ iceServers, iceTransportPolicy: forceRelay ? 'relay' : 'all' });
  const peer = { pc, channel: null, connectionId, candidates: [], outgoing: [], signaled: false, incoming: Promise.resolve(), windowStart: performance.now(), messages: 0 };
  peers.set(id, peer);
  pc.onicecandidate = ({ candidate }) => { if (candidate && peers.get(id) === peer && epoch === generation) { const value = JSON.stringify({ type: 'signal', epoch: current.room.epoch, to: id, data: { connectionId, candidate: candidate.toJSON() } }); if (peer.signaled) send_signal(value); else peer.outgoing.push(value); } };
  pc.onconnectionstatechange = () => {
    if (peers.get(id) !== peer || epoch !== generation) return;
    if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
      connectionStatus('Reconnecting…'); call('peer_state', id, false);
      if (current.player !== current.room?.host_id) hostDeadline(epoch);
      if (pc.connectionState === 'failed') { closePeer(id); if (current.player === current.room?.host_id) setTimeout(() => reconcile(epoch).catch(e => report(e.message)), 1200); }
    }
  };
  pc.ondatachannel = ({ channel }) => bindChannel(id, peer, channel, epoch);
  return peer;
}
function bindChannel(id, peer, channel, epoch) {
  if (peer.channel || channel.label !== 'color-match-v3' || !channel.ordered || channel.maxRetransmits !== null || channel.maxPacketLifeTime !== null) { channel.close(); return; }
  peer.channel = channel;
  channel.onopen = () => {
    if (peers.get(id) !== peer || epoch !== generation) return;
    clearTimeout(hostTimer); hostTimer = null; connectionStatus('Connected'); call('peer_state', id, true);
    peer.pc.getStats().then(stats => {
      const pair = [...stats.values()].find(s => s.type === 'candidate-pair' && s.state === 'succeeded' && s.nominated);
      const candidate = pair && stats.get(pair.localCandidateId);
      if (candidate && peers.get(id) === peer && epoch === generation) connectionStatus('Connected', candidate.candidateType === 'relay' ? 'TURN relay' : 'direct');
    }).catch(() => {});
  };
  channel.onmessage = ({ data }) => {
    if (peers.get(id) !== peer || epoch !== generation || typeof data !== 'string' || data.length > 32768) { channel.close(); return; }
    if (performance.now() - peer.windowStart > 1000) { peer.windowStart = performance.now(); peer.messages = 0; }
    if (++peer.messages > 40) { channel.close(); return; }
    call('peer_message', id, data);
  };
  channel.onclose = () => {
    if (peers.get(id) !== peer || epoch !== generation) return;
    connectionStatus('Reconnecting…'); call('peer_state', id, false); closePeer(id);
    if (current?.player === current?.room?.host_id) setTimeout(() => reconcile(epoch).catch(e => report(e.message)), 1000); else hostDeadline(epoch);
  };
}
function hostDeadline(epoch) {
  if (hostTimer) return;
  hostTimer = setTimeout(() => {
    if (epoch !== generation) return;
    call('end_session', 'Session ended: the live host did not return within 120 seconds.');
    generation++; clearInterval(heartbeat); clearInterval(iceRefresh); clearTimeout(retry); if (socket) { socket.onclose = null; socket.close(); }
    for (const id of peers.keys()) closePeer(id);
  }, 120000);
}
function signalDescription(id, peer) {
  send_signal(JSON.stringify({ type: 'signal', epoch: current.room.epoch, to: id, data: { connectionId: peer.connectionId, description: peer.pc.localDescription.toJSON() } }));
  peer.signaled = true;
  for (const value of peer.outgoing.splice(0)) send_signal(value);
}
async function offer(id, epoch) {
  const peer = createPeer(id, epoch, crypto.randomUUID());
  bindChannel(id, peer, peer.pc.createDataChannel('color-match-v3', { ordered: true }), epoch);
  await peer.pc.setLocalDescription(await peer.pc.createOffer());
  if (peers.get(id) === peer && epoch === generation) signalDescription(id, peer);
}
async function receiveSignal(id, data, epoch) {
  if (!current || !data || (current.player !== current.room?.host_id && id !== current.room?.host_id) || typeof data.connectionId !== 'string') return;
  if (data.description?.type === 'offer') {
    if (current.player === current.room?.host_id) return;
    const peer = createPeer(id, epoch, data.connectionId);
    await peer.pc.setRemoteDescription(data.description);
    await peer.pc.setLocalDescription(await peer.pc.createAnswer());
    if (peers.get(id) === peer && epoch === generation) signalDescription(id, peer);
  } else {
    const peer = peers.get(id); if (!peer || peer.connectionId !== data.connectionId) return;
    peer.incoming = peer.incoming.then(async () => {
      if (data.description?.type === 'answer' && current.player === current.room?.host_id) { await peer.pc.setRemoteDescription(data.description); for (const c of peer.candidates.splice(0)) await peer.pc.addIceCandidate(c); }
      else if (data.candidate) { if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(data.candidate); else peer.candidates.push(data.candidate); }
    }); await peer.incoming;
  }
}
function connectionStatus(message, transport = '') {
  const status = document.getElementById('diagnostics');
  status.textContent = message;
  status.dataset.transport = transport;
}

let audioContext, noise, soundEnabled = true;
const sounds = new Set();
try { soundEnabled = localStorage.getItem('cm-sound') !== 'off'; } catch { /* Storage is optional. */ }
const soundButton = document.getElementById('sound-toggle');
function updateSoundButton() {
  soundButton.setAttribute('aria-checked', String(soundEnabled));
  soundButton.textContent = soundEnabled ? 'Sound on' : 'Sound off';
}
updateSoundButton();
function stopSounds() {
  for (const source of sounds) { try { source.stop(); } catch { /* Already ended. */ } }
  sounds.clear();
}
function unlockAudio() {
  if (!soundEnabled) return;
  try {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    audioContext ||= new Context();
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
  } catch { /* Audio never blocks a move. */ }
}
// Capture runs before Rust's delegated actions, including keyboard-generated clicks.
document.addEventListener('click', event => {
  if (event.target.closest('#sound-toggle')) {
    soundEnabled = !soundEnabled;
    try { localStorage.setItem('cm-sound', soundEnabled ? 'on' : 'off'); } catch { /* Optional. */ }
    updateSoundButton();
    if (!soundEnabled) stopSounds();
  }
  unlockAudio();
}, true);
document.addEventListener('pointerdown', unlockAudio, true);
document.addEventListener('keydown', unlockAudio, true);
function woosh() {
  if (!soundEnabled || audioContext?.state !== 'running') return;
  try {
    const ctx = audioContext, time = ctx.currentTime;
    if (!noise) {
      noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .22), ctx.sampleRate);
      const samples = noise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    source.buffer = noise;
    filter.type = 'bandpass'; filter.Q.value = .7;
    filter.frequency.setValueAtTime(1100, time);
    filter.frequency.exponentialRampToValueAtTime(350, time + .22);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(.07, time + .045);
    gain.gain.linearRampToValueAtTime(0, time + .22);
    source.connect(filter).connect(gain).connect(ctx.destination);
    sounds.add(source);
    source.onended = () => { sounds.delete(source); source.disconnect(); filter.disconnect(); gain.disconnect(); };
    source.start(time); source.stop(time + .22);
  } catch { /* Unavailable audio silently degrades. */ }
}

let animationsEnabled = true;
try { animationsEnabled = localStorage.getItem('cm-animations') !== 'off'; } catch { /* Storage is optional. */ }
const animationsButton = document.getElementById('animations-toggle');
function updateAnimationsButton() {
  animationsButton.setAttribute('aria-checked', String(animationsEnabled));
  animationsButton.textContent = `Card animations ${animationsEnabled ? 'on' : 'off'}`;
}
updateAnimationsButton();
animationsButton.addEventListener('click', () => {
  animationsEnabled = !animationsEnabled;
  try { localStorage.setItem('cm-animations', animationsEnabled ? 'on' : 'off'); } catch { /* Optional. */ }
  updateAnimationsButton();
  if (!animationsEnabled) {
    for (const finish of [...flights]) finish();
  }
});

let pending, announcementTimer;
const flights = new Set();
const destinations = new Map();
// Keep the latest arrived card visible beneath later flights to the same pile.
function revealArrivals(target) {
  const stack = destinations.get(target);
  if (!stack?.length) {
    destinations.delete(target);
    target.classList.remove('in-flight');
    return;
  }
  const latest = stack.at(-1);
  target.classList.toggle('in-flight', !latest.arrived);
  const visible = stack.findLast(flight => flight.arrived);
  for (const flight of [...stack]) {
    if (flight.arrived && (latest.arrived || flight !== visible)) flight.finish();
  }
}
export function cancel_motion() {
  pending = null;
  clearTimeout(announcementTimer);
  for (const finish of [...flights]) finish();
  stopSounds();
  document.getElementById('announcement').textContent = '';
}
function geometry(element) {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2,
    width: element.offsetWidth, height: element.offsetHeight };
}
function appearance(element) {
  const copy = document.createElement('div');
  copy.className = element.className;
  copy.classList.remove('in-flight');
  copy.innerHTML = element.innerHTML;
  copy.setAttribute('aria-hidden', 'true');
  return copy;
}
export function before_render(json, viewer) {
  const events = JSON.parse(json);
  if (!events.length) cancel_motion();
  pending = { viewer, ids: new Set([...document.querySelectorAll('#hand .card')].map(e => e.id)),
    events: events.map(event => {
      const source = event.type === 'played'
        ? document.getElementById(`card-${event.card.id}`) || document.querySelector(`#seat-${event.player} .fan i:last-child`)
        : document.getElementById('draw');
      return { event, origin: geometry(source), card: event.type === 'played' && event.player === viewer && source ? appearance(source) : null };
    }) };
}
function fly(origin, target, copy, delay, rotation, hide = true, lift = false) {
  const end = geometry(target);
  if (!origin || !end || !origin.width || !end.width) return;
  copy.classList.add('flying-card');
  const width = document.getElementById('discard').offsetWidth, height = document.getElementById('discard').offsetHeight;
  copy.style.cssText = `left:${origin.x - width / 2}px;top:${origin.y - height / 2}px;width:${width}px;height:${height}px;transform-origin:center;`;
  document.body.append(copy);
  let animation;
  const flight = { arrived: false, finish: null };
  const finish = () => {
    if (!flights.delete(finish)) return;
    animation?.cancel(); copy.remove();
    if (hide) {
      const stack = destinations.get(target);
      stack.splice(stack.indexOf(flight), 1);
      revealArrivals(target);
    }
  };
  flight.finish = finish;
  flights.add(finish);
  if (hide) {
    if (!destinations.has(target)) destinations.set(target, []);
    destinations.get(target).push(flight);
    target.classList.add('in-flight');
  }
  const dx = end.x - origin.x, dy = end.y - origin.y;
  try {
    const start = `translate(0,0) rotate(${rotation}deg) scale(${origin.width / width},${origin.height / height})`;
    const easing = 'cubic-bezier(.2,.65,.3,1)';
    animation = copy.animate(lift ? [
      { transform: start, offset: 0, easing: 'ease-out' },
      { transform: `translate(0,-18px) rotate(${rotation}deg) scale(${origin.width / width},${origin.height / height})`, offset: 65 / 320, easing },
      { transform: `translate(${dx * .55}px,${dy * .55 - 28}px) rotate(-4deg) scale(${(origin.width + end.width) / (2 * width)},${(origin.height + end.height) / (2 * height)})`, offset: .6, easing: 'ease-out' },
      { transform: `translate(${dx}px,${dy}px) rotate(7deg) scale(${end.width / width},${end.height / height})`, offset: 1 }
    ] : [
      { transform: `translate(0,0) rotate(${rotation}deg) scale(${origin.width / width},${origin.height / height})` },
      { transform: `translate(${dx / 2}px,${dy / 2 - 22}px) rotate(-4deg) scale(${(origin.width + end.width) / (2 * width)},${(origin.height + end.height) / (2 * height)})`, offset: .5 },
      { transform: `translate(${dx}px,${dy}px) rotate(${target.id === 'discard' ? 7 : 0}deg) scale(${end.width / width},${end.height / height})` }
    ], { duration: target.id === 'discard' ? 320 : 300, delay, fill: 'both', easing: lift ? 'linear' : easing });
    animation.finished.then(() => {
      if (!flights.has(finish)) return;
      if (hide) { flight.arrived = true; revealArrivals(target); }
      else finish();
    }, finish);
  } catch { finish(); }
}
export function after_render() {
  if (!pending) return;
  const { viewer, ids, events } = pending; pending = null;
  // Rust refreshes the discard class even for color choices and draws.
  for (const target of destinations.keys()) revealArrivals(target);
  const arrivals = [...document.querySelectorAll('#hand .card')].filter(e => !ids.has(e.id));
  if (arrivals.length && events.some(({ event }) => event.type === 'drew' && event.player === viewer && event.count > 0)) arrivals.at(-1).scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
  for (const { event, origin, card } of events) {
    let message;
    if (event.type === 'uno') message = 'UNO!';
    if (event.type === 'caught') message = 'Caught! Draw two.';
    if (event.type === 'played' && ['draw_two', 'wild_four'].includes(event.card.face.kind))
      message = event.card.face.kind === 'draw_two' ? '+2 · draw penalty' : '+4 · draw penalty';
    if (message) {
      document.getElementById('announcement').textContent = message;
      clearTimeout(announcementTimer);
      announcementTimer = setTimeout(() => { document.getElementById('announcement').textContent = ''; }, 1500);
    }
    if (!['played', 'drew'].includes(event.type) || event.count === 0) continue;
    woosh();
    if (!animationsEnabled) continue;
    if (event.type === 'played') {
      const target = document.getElementById('discard');
      fly(origin, target, card || appearance(target), 0, event.player === viewer ? 0 : -10, true, event.player === viewer);
    } else {
      const targets = event.player === viewer ? arrivals : Array(Math.min(event.count, 4)).fill(document.querySelector(`#seat-${event.player} .fan i:last-child`));
      targets.forEach((target, index) => {
        if (target) fly(origin, target, appearance(document.getElementById('draw')), index * 60 / Math.max(1, targets.length - 1), -6, event.player === viewer);
      });
    }
  }
}

export function home_navigation() {
  history.replaceState(null, '', location.pathname + location.search);
  document.getElementById('room-panel').close();
  document.querySelector('#welcome button').focus();
}
document.getElementById('room-size').addEventListener('change', event => {
  send_signal(JSON.stringify({type: 'capacity', capacity: Number(event.target.value)}));
});
