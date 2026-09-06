# Free deployment and connectivity

`render.yaml` prepares one Docker web service with `plan: free`, `/healthz`, and
no database, disk or paid add-on. `Dockerfile` builds the Rust server and browser
Wasm, then runs as an unprivileged user. The server serves `web/` and `/signal`
from one origin. Set `APP_ORIGIN` to the final HTTPS origin for explicit Origin
validation. `BIND_ADDR=0.0.0.0` is set in the blueprint; Render supplies `PORT`.

Public deployment is **incomplete**. The installed Render CLI returned
`unauthorized` for its read-only identity check. No Cloudflare TURN key/token
was configured, no billing settings could be verified, and no service was
provisioned. The workspace has no Git metadata or remote to deploy from.

Before creating a service, verify the account can remain at zero spend and
record the actual provider controls. Render Free services sleep after inactivity,
share 750 monthly instance hours per workspace and have bandwidth/build quotas.
Free compute does not guarantee zero overage charges: Render documents paid
supplementary bandwidth when applicable. Cloudflare currently includes 1,000 GB
of TURN per month, with paid usage above that allowance. An allowance or alert
is not a hard spending cap. If the accounts cannot enforce the user's zero-spend
constraint, do not enable TURN or provision the public service.

For an approved zero-spend configuration, set these server-side environment
variables through the provider's secret controls, never committed files:

- `CLOUDFLARE_TURN_KEY_ID`
- `CLOUDFLARE_TURN_API_TOKEN`
- `TURN_ZERO_SPEND_VERIFIED=true`, only after actual billing verification
- `APP_ORIGIN=https://<the-service>.onrender.com`

The server calls Cloudflare's credential endpoint with a 600-second TTL only
for authenticated room sessions. Browsers request refreshed ICE credentials every
five minutes and renew their peer connections when credentials change. Without the attestation it returns Cloudflare
STUN only; the UI explicitly says direct connections only. This supports local
development but does not satisfy the public friend-invite acceptance criterion.
There is no WebSocket gameplay fallback.

Use `?relay=1#room=<invite>` to force `iceTransportPolicy: relay` for diagnostics.
The toolbar reports whether the selected local candidate is direct or relayed.
A local relay test uses `LOCAL_TURN_TEST=true` and `LOCAL_ICE_SERVERS` containing
standard ICE server JSON; keep these development variables off public services.
`make check-turn` runs a disposable loopback relay. The test setup and observed
results are in [validation](validation.md).

Final public acceptance requires a health check, an HTTPS invite opened from
separate networks, direct and forced Cloudflare TURN play, Chromium/Firefox/WebKit
interoperability, reconnects, and verification that no provider credentials or
other hands appear in guest traffic. Local relay success cannot establish these
provider or separate-network results.

Sources checked 2026-09-05: [Render Free](https://render.com/docs/free),
[Cloudflare TURN FAQ and pricing](https://developers.cloudflare.com/realtime/turn/faq/),
[Cloudflare credential API](https://developers.cloudflare.com/realtime/turn/generate-credentials/).
