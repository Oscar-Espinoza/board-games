**Staff engineering review — September 25, 2026**

Reviewed the current repository at `6f873e192d82d4ee8a63fbd6e1f7beafa8be1c45`. No implementation diff or separate proposal was supplied. The review focused on the HTTP boundary, room lifecycle, connection ownership, action delivery and recipient projections. The untracked `.claude/` worktrees were excluded. P1 means urgent; P2 means a concrete defect to address in normal work.

**1. [P1] A malformed HTTP Range header terminates the game server**

Source: [apps/server/src/index.ts:84](../../apps/server/src/index.ts#L84), [apps/server/package.json:11](../../apps/server/package.json#L11).

An unauthenticated `GET /200.html` with `Range: bytes=10-5` reaches `sirv` without range validation or an exception boundary. The installed `sirv@3.0.2` passes `start: 10, end: 5` to `fs.createReadStream`. On the project's Bun 1.4.2 runtime, this throws `ERR_OUT_OF_RANGE` out of the HTTP handler and terminates the process. Because every game's canonical state lives in that process, one malformed asset request destroys all active matches.

Confirmed against an isolated instance of the actual server entry point and the existing frontend build: health returned 200 before the request, and the process subsequently exited naturally with code 1 and the range exception. No existing development server was targeted.

Change: reject invalid ranges before static serving, or use a static-serving implementation that handles them safely. Contain synchronous static-handler failures at the HTTP boundary so malformed requests cannot terminate the room authority.

**2. [P1] The local Jev lab exposes a paid API capability through the game tunnel**

Source: [apps/server/src/index.ts:49–74](../../apps/server/src/index.ts#L49), [packages/jev-lab/src/jev.ts:52–69](../../packages/jev-lab/src/jev.ts#L52), [docs/deployment.md](../deployment.md).

`POST /api/codenames/guess` is registered unconditionally on the same listener that the deployment instructions expose through an HTTPS tunnel. It requires no room credential, lab authorization or other capability. With `TYPESAFE_API_KEY` configured, any caller who knows the public origin can supply a view and invoke the upstream model using the operator's account. The Socket.IO request limiter does not cover this HTTP route, and the eight-call semaphore only limits concurrency; it does not bound total requests or spending.

Confirmed that a request without credentials reaches the model client: with the API key deliberately disabled in an isolated server, a structurally valid request returned the downstream `Missing TYPESAFE_API_KEY` error. No paid model calls were made. Keeping the key out of the browser does not restrict who can exercise it through this route.

Change: put the lab on a separate listener outside the tunnel, or require a server-enforced lab capability and usage limits. Make exposure an explicit deployment choice.

**3. [P1] Small Jev requests expand into unbounded work before admission control**

Source: [apps/server/src/index.ts:51–63](../../apps/server/src/index.ts#L51), [packages/jev-lab/src/codenames/live.ts:91–105](../../packages/jev-lab/src/codenames/live.ts#L91), [packages/jev-lab/src/jev.ts:37–59](../../packages/jev-lab/src/jev.ts#L37).

The route's 64,000-character body limit is followed by only two checks: `board` is an array and `clue.word` is a string. `plan()` then creates a question for every board entry multiplied by every unfinished historical clue, using synchronous `flatMap` and `Object.fromEntries`. Neither dimension is bounded to a valid Codenames game. This allocation happens before `ask()` checks for an API key or enters its semaphore. With a key configured, the full expanded request is also serialized before admission, and the semaphore's waiting list has no bound.

A constructed request with 2,000 one-character board entries and 200 unfinished historical clues is only **18,109 bytes**, passes the route guard and generates **402,000 questions**. Using the shipped prompt builder, those questions would serialize to approximately **174 MB** of JSON. These are measured input size and calculated expansion size; the oversized model request was not allocated in full or sent. Repeated requests can block the shared event loop and exhaust memory even though the incoming bodies satisfy the HTTP limit. Question construction is reachable even when the API key is absent.

Change: validate the complete view against game bounds, including board size, history length, strings and clue counts, and enforce a maximum expanded question count. Apply bounded admission before prompt construction and serialization, and cancel queued work when the requester disconnects. This needs a separate fix from authorization because admitted requests can still exhaust the shared game process.

**4. [P2] Token reconnection can leave host authority assigned to an offline seat**

Source: [apps/server/src/rooms.ts:157–166](../../apps/server/src/rooms.ts#L157), [apps/server/src/rooms.ts:253–277](../../apps/server/src/rooms.ts#L253), [games/little-secret/src/engine.ts:318–323](../../games/little-secret/src/engine.ts#L318).

Disconnect promotes the host to another connected seat. Once everyone disconnects, the last host remains recorded. The valid-token branch of `join()` restores a connection and synchronizes game presence, but returns without calling `promoteHost()`. A different player reconnecting first therefore leaves the host offline, despite there being a connected player available. Host-only setup changes, voting transitions and rematches remain assigned to the absent player until another lifecycle event repairs the assignment.

Confirmed with the real room manager and Little Secret definition: A, B and C joined; all disconnected in that order; A rejoined using its valid token before expiration. The resulting view contained only A as connected, while C was still host and disconnected. The reconnect also changed presence without advancing the room revision.

Change: run host promotion when restoring a token-bound seat, and advance the room revision when the reconnect changes published presence or host metadata. Preserve the returning player's game identity and private projection.

**5. [P2] Expired, empty lobbies retain all room capacity for an hour**

Source: [apps/server/src/rooms.ts:97–98](../../apps/server/src/rooms.ts#L97), [apps/server/src/rooms.ts:279–300](../../apps/server/src/rooms.ts#L279), [apps/server/src/rooms.ts:337–346](../../apps/server/src/rooms.ts#L337).

The global room cap is 64. When lobby reservations expire, `expire()` removes every vacant seat, but `sweep()` retains the resulting empty lobby until at least one hour after its last touch. Those empty rooms continue to count against the cap despite having no player, valid reconnect token or game state to preserve. Creating and abandoning 64 lobbies consequently prevents everyone else from creating a room for the remainder of that hour. Fresh sockets bypass the per-socket request counter, so the same sequence is also an inexpensive denial of service through the shared origin.

Confirmed with the room manager's injected clock: after creating and disconnecting 64 lobbies, advancing past the default 120-second grace period and sweeping, there were **64 rooms and zero seats**. A subsequent legitimate create failed with `Too many rooms`.

Change: collect empty lobbies as soon as their last reservation expires, independently of the longer retention policy for abandoned matches. Add a room-creation throttle that survives individual socket reconnects.

Only this report was added. Findings were checked through source tracing and disposable local reproductions; no implementation changes, test suites or external model requests were made.
