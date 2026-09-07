import {
  PROTOCOL_VERSION,
  MAX_MESSAGE,
  HOST_WAIT_MS,
  CHANNEL_NAME,
  SEAT_NAMESPACE,
  ACTION_NAMESPACE,
} from './protocol.js';
const utf8 = new TextEncoder();
// Shared browser transport. Rules, authority and presentation are separate.
let cancel_motion = () => {};
let gameId = 'color-match',
  rulesVersion = 2;
let catalogDeparture = false;
let wasm,
  socket,
  current,
  generation = 0,
  iceServers = [],
  heartbeat,
  iceRefresh,
  retry,
  hostTimer;
const peers = new Map();
const peerRetries = new Map();
let authenticatedSocket;
function signalingReady(epoch) {
  return (
    epoch === generation && socket === authenticatedSocket && socket?.readyState === WebSocket.OPEN
  );
}
function validPeer(id, peer) {
  return (
    peers.get(id) === peer &&
    signalingReady(peer.generation) &&
    socket === peer.socket &&
    current.room?.epoch === peer.authority &&
    current.room.members.some((m) => m.id === id && m.connected)
  );
}
function clearPeerRetries() {
  for (const timer of peerRetries.values()) clearTimeout(timer);
  peerRetries.clear();
}
function retryPeer(id, epoch, delay = 1200) {
  if (
    !signalingReady(epoch) ||
    current.player !== current.room?.host_id ||
    !current.room.members.some((m) => m.id === id && m.connected)
  )
    return;
  clearTimeout(peerRetries.get(id));
  const ws = socket,
    authority = current.room.epoch;
  peerRetries.set(
    id,
    setTimeout(() => {
      peerRetries.delete(id);
      if (ws === socket && authority === current?.room?.epoch)
        reconcile(epoch).catch((e) => report(e.message));
    }, delay),
  );
}
function failedPeer(id, peer) {
  if (!validPeer(id, peer)) return;
  call('peer_state', id, false);
  closePeer(id);
  retryPeer(id, peer.generation);
}
let pendingSignals = [];
let counter = Number(sessionStorage.getItem(ACTION_NAMESPACE) || 0);
export function configure(module, options) {
  wasm = module;
  gameId = options.gameId;
  rulesVersion = options.rulesVersion;
  cancel_motion = options.cancelMotion || (() => {});
}
export function next_action_id() {
  counter += 1;
  sessionStorage.setItem(ACTION_NAMESPACE, String(counter));
  return BigInt(counter);
}
const report = (message) => {
  document.getElementById('error').textContent = message;
  document.getElementById('panel-error').textContent = message;
};
const call = (fn, ...args) => {
  try {
    wasm?.[fn](...args);
  } catch (e) {
    report(String(e));
  }
};
function closePeer(id) {
  clearTimeout(peerRetries.get(id));
  peerRetries.delete(id);
  const peer = peers.get(id);
  if (peer) {
    peers.delete(id);
    peer.channel?.close();
    peer.pc.close();
  }
}
export function leave_room() {
  generation++;
  authenticatedSocket = null;
  clearPeerRetries();
  clearInterval(heartbeat);
  clearInterval(iceRefresh);
  clearTimeout(retry);
  clearTimeout(hostTimer);
  hostTimer = null;
  if (socket) {
    socket.onclose = null;
    socket.close();
    socket = null;
  }
  for (const id of peers.keys()) closePeer(id);
  current = null;
  iceServers = [];
  pendingSignals = [];
  connectionStatus('');
  cancel_motion();
}
export function send_signal(value) {
  if (typeof value !== 'string' || utf8.encode(value).byteLength > MAX_MESSAGE) return false;
  if (signalingReady(generation)) {
    try {
      socket.send(value);
      return true;
    } catch {
      /* Socket loss races sends. */
    }
  }
  report('Reconnecting…');
  return false;
}
export function send_peer(id, value) {
  if (typeof value !== 'string' || utf8.encode(value).byteLength > MAX_MESSAGE) return;
  if (!current?.room?.members.some((m) => m.id === id && m.connected)) return;
  const channel = peers.get(id)?.channel;
  if (channel?.readyState === 'open' && channel.bufferedAmount < 128 * 1024) {
    try {
      channel.send(value);
    } catch {
      channel.close();
    } // A peer can disappear before readyState updates.
  }
}
export function connect_room(kind, name, avatar) {
  if (!name.trim() || name.trim().length > 24) {
    report('Enter a name of 1–24 characters.');
    return;
  }
  const invite = new URLSearchParams(location.hash.slice(1)).get('room');
  if (kind === 'join' && !/^[a-f0-9]{64}$/.test(invite || '')) {
    report('Open a valid invite link first.');
    return;
  }
  leave_room();
  const saved =
    kind === 'join' ? sessionStorage.getItem(`${SEAT_NAMESPACE}:${gameId}:${invite}`) : null;
  current = {
    hello: saved
      ? {
          type: 'resume',
          version: PROTOCOL_VERSION,
          game_id: gameId,
          rules_version: rulesVersion,
          invite,
          credential: saved,
        }
      : {
          type: kind,
          version: PROTOCOL_VERSION,
          game_id: gameId,
          rules_version: rulesVersion,
          name,
          avatar,
          ...(invite && kind === 'join' ? { invite } : {}),
        },
    player: null,
    invite,
    credential: null,
    room: null,
  };
  openSocket(generation);
}
function openSocket(epoch) {
  if (!current || epoch !== generation) return;
  authenticatedSocket = null;
  pendingSignals = [];
  const ws = new WebSocket(
    `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/signal`,
  );
  socket = ws;
  ws.onopen = () => {
    if (ws !== socket || epoch !== generation) return;
    ws.send(
      JSON.stringify(
        current.credential
          ? {
              type: 'resume',
              version: PROTOCOL_VERSION,
              game_id: gameId,
              rules_version: rulesVersion,
              invite: current.invite,
              credential: current.credential,
            }
          : current.hello,
      ),
    );
  };
  let incoming = Promise.resolve();
  const handleMessage = async ({ data }) => {
    if (
      epoch !== generation ||
      ws !== socket ||
      ws.readyState !== WebSocket.OPEN ||
      typeof data !== 'string' ||
      utf8.encode(data).byteLength > MAX_MESSAGE
    )
      return;
    let event;
    try {
      event = JSON.parse(data);
    } catch {
      return;
    }
    try {
      if (event.type === 'welcome') {
        if (
          event.version !== PROTOCOL_VERSION ||
          event.room.game_id !== gameId ||
          event.room.rules_version !== rulesVersion
        )
          throw new Error('Unsupported room protocol. Reload this page.');
        authenticatedSocket = ws;
        current.player = event.player;
        current.invite = event.room.invite;
        current.credential = event.credential;
        current.room = event.room;
        if (event.player !== event.room.host_id)
          sessionStorage.setItem(`${SEAT_NAMESPACE}:${gameId}:${current.invite}`, event.credential);
        history.replaceState(null, '', `#room=${current.invite}`);
        call('signal_event', JSON.stringify(event));
        call('network_state', true);
        clearTimeout(hostTimer);
        hostTimer = null;
        clearInterval(heartbeat);
        clearInterval(iceRefresh);
        heartbeat = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send('{"type":"ping"}');
        }, 10000);
        ws.send('{"type":"ice"}');
        iceRefresh = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send('{"type":"ice"}');
        }, 300000);
        document.getElementById('room-panel').showModal();
      } else if (event.type === 'ice') {
        const previousIce = JSON.stringify(iceServers);
        iceServers = Array.isArray(event.ice_servers) ? event.ice_servers : [event.ice_servers];
        if (previousIce !== '[]' && previousIce !== JSON.stringify(iceServers)) {
          for (const [id, peer] of peers) {
            peer.pc.setConfiguration({ ...peer.pc.getConfiguration(), iceServers });
            if (current.player === current.room?.host_id) {
              connectionStatus('Reconnecting…');
              call('peer_state', id, false);
              closePeer(id);
            }
          }
        }
        const relay = iceServers.some((s) => [s.urls].flat().some((u) => /^turns?:/.test(u)));
        connectionStatus('Connected', relay ? 'TURN available' : 'direct connections only');
        for (const event of pendingSignals.splice(0)) {
          if (ws !== socket || !signalingReady(epoch)) return;
          if (event.epoch === current.room?.epoch)
            await receiveSignal(event.from, event.data, epoch);
        }
        if (ws === socket) await reconcile(epoch);
      } else if (event.type === 'handoff_commit') {
        clearPeerRetries();
        pendingSignals = [];
        cancel_motion();
        if (current.player === event.former_host) {
          sessionStorage.setItem(
            `${SEAT_NAMESPACE}:${gameId}:${current.invite}`,
            current.credential,
          );
        } else if (current.player === event.room.host_id) {
          sessionStorage.removeItem(`${SEAT_NAMESPACE}:${gameId}:${current.invite}`);
        }
        for (const id of peers.keys()) closePeer(id);
        current.room = event.room;
        call('signal_event', data);
        await reconcile(epoch);
      } else if (event.type === 'left') {
        if (current.room?.locked)
          sessionStorage.setItem(
            `${SEAT_NAMESPACE}:${gameId}:${current.invite}`,
            current.credential,
          );
        else sessionStorage.removeItem(`${SEAT_NAMESPACE}:${gameId}:${current.invite}`);
        call('signal_event', data);
      } else if (event.type === 'handoff_cancel') {
        catalogDeparture = false;
        call('signal_event', data);
      } else if (['handoff_prepare', 'handoff_ready', 'departed'].includes(event.type)) {
        call('signal_event', data);
      } else if (event.type === 'room') {
        if (
          current.room?.host_id !== event.room.host_id ||
          current.room?.epoch !== event.room.epoch
        ) {
          clearPeerRetries();
          pendingSignals = [];
          for (const id of peers.keys()) closePeer(id);
          if (current.player === event.room.host_id)
            sessionStorage.removeItem(`${SEAT_NAMESPACE}:${gameId}:${current.invite}`);
        }
        current.room = event.room;
        call('signal_event', data);
        if (event.room.locked) document.getElementById('room-panel').close();
        await reconcile(epoch);
      } else if (event.type === 'signal') {
        if (event.epoch !== current.room?.epoch) return;
        if (iceServers.length) await receiveSignal(event.from, event.data, epoch);
        else pendingSignals.push(event);
      } else if (event.type === 'ended') {
        authenticatedSocket = null;
        clearPeerRetries();
        call('signal_event', data);
        clearTimeout(retry);
        ws.onclose = null;
        ws.close();
        for (const id of peers.keys()) closePeer(id);
      } else if (event.type === 'error') {
        call('signal_event', data);
        // An invalid saved seat is never silently converted to a new admission.
        if (event.message.includes('credential') || event.message.includes('expired'))
          clearTimeout(retry);
      }
    } catch (e) {
      report(`Connection problem: ${e.message || e}`);
    }
  };
  ws.onmessage = (event) => {
    incoming = incoming
      .then(() => handleMessage(event))
      .catch((e) => report(`Connection problem: ${e.message || e}`));
  };
  ws.onclose = () => {
    if (epoch !== generation || ws !== socket) return;
    authenticatedSocket = null;
    pendingSignals = [];
    clearPeerRetries();
    clearInterval(heartbeat);
    clearInterval(iceRefresh);
    call('network_state', false);
    connectionStatus('Reconnecting…');
    if (current?.player !== current?.room?.host_id) hostDeadline(epoch);
    for (const id of peers.keys()) {
      connectionStatus('Reconnecting…');
      call('peer_state', id, false);
      closePeer(id);
    }
    if (current?.credential) retry = setTimeout(() => openSocket(epoch), 1800);
    else if (!document.getElementById('error').textContent)
      report('Could not join the room. Check the invite and try again.');
  };
  ws.onerror = () => {
    if (ws === socket && epoch === generation)
      report('The room service is unavailable. A free host may take a moment to wake up.');
  };
}
async function reconcile(epoch) {
  if (!current?.room || !iceServers.length || !signalingReady(epoch)) return;
  const ws = socket,
    room = current.room;
  // Lobby departures remove the member entirely; active rounds retain a disconnected seat.
  for (const id of new Set([...peers.keys(), ...peerRetries.keys()])) {
    if (!room.members.some((m) => m.id === id && m.connected)) {
      const existed = peers.has(id);
      closePeer(id);
      if (existed) call('peer_state', id, false);
    }
  }
  for (const member of room.members) {
    if (!signalingReady(epoch) || socket !== ws || current.room !== room) return;
    if (member.bot || member.id === current.player) continue;
    if (!member.connected) continue;
    if (current.player === current.room?.host_id && !peers.has(member.id))
      await offer(member.id, epoch);
  }
}
function createPeer(id, epoch, connectionId) {
  closePeer(id);
  const forceRelay = new URLSearchParams(location.search).get('relay') === '1';
  const pc = new RTCPeerConnection({
    iceServers,
    iceTransportPolicy: forceRelay ? 'relay' : 'all',
  });
  const peer = {
    generation: epoch,
    socket,
    authority: current.room.epoch,
    pc,
    channel: null,
    connectionId,
    candidates: [],
    outgoing: [],
    signaled: false,
    incoming: Promise.resolve(),
    windowStart: performance.now(),
    messages: 0,
  };
  peers.set(id, peer);
  pc.onicecandidate = ({ candidate }) => {
    if (candidate && validPeer(id, peer)) {
      const value = JSON.stringify({
        type: 'signal',
        epoch: current.room.epoch,
        to: id,
        data: { connectionId, candidate: candidate.toJSON() },
      });
      if (peer.signaled) {
        if (!send_signal(value)) failedPeer(id, peer);
      } else peer.outgoing.push(value);
    }
  };
  pc.onconnectionstatechange = () => {
    if (!validPeer(id, peer)) return;
    if (pc.connectionState === 'connected' && peer.channel?.readyState === 'open')
      peer.channel.onopen();
    if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
      peer.up = false;
      connectionStatus('Reconnecting…');
      call('peer_state', id, false);
      if (current.player !== current.room?.host_id) hostDeadline(epoch);
      if (pc.connectionState === 'failed') failedPeer(id, peer);
    }
  };
  pc.ondatachannel = ({ channel }) => bindChannel(id, peer, channel, epoch);
  return peer;
}
function bindChannel(id, peer, channel, epoch) {
  if (
    !validPeer(id, peer) ||
    peer.channel ||
    channel.label !== CHANNEL_NAME ||
    !channel.ordered ||
    channel.maxRetransmits !== null ||
    channel.maxPacketLifeTime !== null
  ) {
    channel.close();
    return;
  }
  peer.channel = channel;
  channel.onopen = () => {
    if (!validPeer(id, peer) || peer.up) return;
    peer.up = true;
    clearTimeout(hostTimer);
    hostTimer = null;
    connectionStatus('Connected');
    call('peer_state', id, true);
    peer.pc
      .getStats()
      .then((stats) => {
        const pair = [...stats.values()].find(
          (s) => s.type === 'candidate-pair' && s.state === 'succeeded' && s.nominated,
        );
        const candidate = pair && stats.get(pair.localCandidateId);
        if (candidate && validPeer(id, peer))
          connectionStatus(
            'Connected',
            candidate.candidateType === 'relay' ? 'TURN relay' : 'direct',
          );
      })
      .catch(() => {});
  };
  channel.onmessage = ({ data }) => {
    if (
      !validPeer(id, peer) ||
      typeof data !== 'string' ||
      utf8.encode(data).byteLength > MAX_MESSAGE
    ) {
      channel.close();
      return;
    }
    if (performance.now() - peer.windowStart > 1000) {
      peer.windowStart = performance.now();
      peer.messages = 0;
    }
    if (++peer.messages > 40) {
      channel.close();
      return;
    }
    call('peer_message', id, data);
  };
  if (channel.readyState === 'open') channel.onopen();
  channel.onclose = () => {
    if (!validPeer(id, peer)) return;
    connectionStatus('Reconnecting…');
    call('peer_state', id, false);
    closePeer(id);
    if (current?.player === current?.room?.host_id) retryPeer(id, epoch, 1000);
    else hostDeadline(epoch);
  };
}
function hostDeadline(epoch) {
  if (hostTimer) return;
  hostTimer = setTimeout(() => {
    if (epoch !== generation) return;
    call('end_session', 'Session ended: the live host did not return within 120 seconds.');
    generation++;
    authenticatedSocket = null;
    clearPeerRetries();
    clearInterval(heartbeat);
    clearInterval(iceRefresh);
    clearTimeout(retry);
    if (socket) {
      socket.onclose = null;
      socket.close();
    }
    for (const id of peers.keys()) closePeer(id);
  }, HOST_WAIT_MS);
}
function signalDescription(id, peer) {
  if (!validPeer(id, peer)) return;
  if (
    !send_signal(
      JSON.stringify({
        type: 'signal',
        epoch: peer.authority,
        to: id,
        data: { connectionId: peer.connectionId, description: peer.pc.localDescription.toJSON() },
      }),
    )
  ) {
    failedPeer(id, peer);
    return;
  }
  peer.signaled = true;
  for (const value of peer.outgoing.splice(0))
    if (!send_signal(value)) {
      failedPeer(id, peer);
      return;
    }
}
async function offer(id, epoch) {
  const peer = createPeer(id, epoch, crypto.randomUUID());
  try {
    bindChannel(id, peer, peer.pc.createDataChannel(CHANNEL_NAME, { ordered: true }), epoch);
    const description = await peer.pc.createOffer();
    if (!validPeer(id, peer)) return;
    await peer.pc.setLocalDescription(description);
    signalDescription(id, peer);
  } catch {
    failedPeer(id, peer);
  }
}
async function receiveSignal(id, data, epoch) {
  if (
    !signalingReady(epoch) ||
    !data ||
    !current.room?.members.some((m) => m.id === id && m.connected) ||
    (current.player !== current.room?.host_id && id !== current.room?.host_id) ||
    typeof data.connectionId !== 'string'
  )
    return;
  if (data.description?.type === 'offer') {
    if (current.player === current.room?.host_id) return;
    const peer = createPeer(id, epoch, data.connectionId);
    try {
      await peer.pc.setRemoteDescription(data.description);
      if (!validPeer(id, peer)) return;
      const description = await peer.pc.createAnswer();
      if (!validPeer(id, peer)) return;
      await peer.pc.setLocalDescription(description);
      signalDescription(id, peer);
    } catch {
      failedPeer(id, peer);
    }
  } else {
    const peer = peers.get(id);
    if (!peer || peer.connectionId !== data.connectionId) return;
    peer.incoming = peer.incoming
      .then(async () => {
        if (!validPeer(id, peer)) return;
        if (data.description?.type === 'answer' && current.player === current.room?.host_id) {
          await peer.pc.setRemoteDescription(data.description);
          for (const c of peer.candidates.splice(0)) {
            if (!validPeer(id, peer)) return;
            await peer.pc.addIceCandidate(c);
          }
        } else if (data.candidate) {
          if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(data.candidate);
          else peer.candidates.push(data.candidate);
        }
      })
      .catch(() => failedPeer(id, peer));
    await peer.incoming;
  }
}
function connectionStatus(message, transport = '') {
  const status = document.getElementById('diagnostics');
  status.textContent = message;
  status.dataset.transport = transport;
}

export function home_navigation() {
  if (catalogDeparture) {
    location.assign('/');
    return;
  }
  history.replaceState(null, '', location.pathname + location.search);
  document.getElementById('room-panel').close();
  document.querySelector('#welcome button').focus();
}
document.getElementById('room-size').addEventListener('change', (event) => {
  send_signal(JSON.stringify({ type: 'capacity', capacity: Number(event.target.value) }));
});

// Trigger the existing authenticated leave/handoff flow before page navigation.
document.addEventListener('click', (event) => {
  if (!event.target.closest?.('[data-catalog]')) return;
  if (!current) return;
  event.preventDefault();
  catalogDeparture = true;
  document.getElementById('leave-room').click();
});
