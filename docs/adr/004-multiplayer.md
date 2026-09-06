# ADR 004: Casual play with a trusted browser host

Status: Implemented locally; public deployment and provider verification pending,
2026-09-05. Supersedes the earlier two-browser deferred milestone.

Use a host-centered star of reliable, ordered WebRTC DataChannels for 2–8 players,
including optional bots. The host owns canonical Rust state and validates every
action. Send each guest only their own projection and public animation events.
Seeds, other hands and stock order never enter ordinary guest snapshots. A
deliberate host successor receives a separate privileged checkpoint. Replay
outputs remain development artifacts.
The host is trusted and can inspect or manipulate all state. Competitive play
would require independent authority or a substantially different design.

A small Axum/Tokio service serves the site and performs ephemeral authenticated
signaling. Shared Rust protocol types separate networking from rules. Invite IDs
and reconnect credentials are distinct random secrets; authenticated signaling
binds SDP/ICE and channels to seats. Round IDs, action IDs, revisions and
acknowledgments enforce stale-action resynchronization and deduplication. Guest
session storage retains reconnect credentials; host credentials live only in memory.

Admission locks during play. A lost guest pauses the table. At 60 seconds the host
may assign a temporary bot; waiting remains the default. Reconnection immediately
reclaims control. The same live host can reconnect within 120 seconds. Host tab
reload/closure loses canonical state; there is no automatic migration or saved-game recovery.
Rooms expire after four hours. No database is warranted.

Target one Render Free Docker service and Cloudflare STUN/TURN, issuing short-lived
credentials only to authenticated participants. Provider secrets remain server-side.
The deployment must remain at zero spend: no provisioning until account billing
settings and usage constraints are verified. TURN credential issuance is disabled
by default and requires explicit operator attestation. This configuration switch
is an interlock, not a provider billing cap. Public deployment remains incomplete
if a hard zero-spend setup cannot be established. See [deployment](../deployment.md).

A hosted WebSocket relay could replace WebRTC later if connection infrastructure or operating constraints warrant it.

Sources: [WebRTC peer connections](https://webrtc.org/getting-started/peer-connections),
[Render Free limits](https://render.com/docs/free),
[Cloudflare TURN credentials](https://developers.cloudflare.com/realtime/turn/generate-credentials/),
[Cloudflare TURN FAQ](https://developers.cloudflare.com/realtime/turn/faq/).

## Deliberate handoff amendment (2026-09-06)

Explicit **Leave room** transfers live authority to the earliest-joined connected
human with an open DataChannel. The old host freezes actions and bots and sends
only that successor a validated checkpoint containing complete game/RNG state,
round/revision, deduplication counters and disconnection/replacement state.
This intentionally extends the trusted-host boundary to the successor: they can
inspect every hand and future random state. It does not expose private state to
ordinary guests.

The signaling service binds preparation/readiness/confirmation to both parties,
round, authority epoch and a unique transfer attempt. It commits atomically only
after successor readiness and current-host confirmation, increments the epoch,
and instructs browsers to rebuild their host-centered channels. A 15-second
failure cancels preparation while preserving old authority. No connected human
successor means Leave closes the room. Player IDs, cards and turn order persist;
the old host may return as a guest using the retained credential.

This covers deliberate departure only. It adds no database, background copies,
server game authority or automatic recovery from unexpected host loss. Lobby
host departures simply promote the earliest connected human and free the seat.
The detailed protocol source of truth is [architecture](../architecture.md).
