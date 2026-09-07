# Coding-practices review — 2026-09-07

Scope: the whole repository, judged on coding practice rather than product behaviour —
structure, boundaries, readability, duplication, testing, tooling. Reviewed at commit
`cc00498` with the working tree as-is (CATAN and catalog work still uncommitted).
`cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings` and
`cargo test --workspace` all passed while writing this.

## Verdict

The engineering is well above average where it matters most. The domain boundaries are
real, not aspirational: rules crates know nothing about the DOM, network or storage; the
server holds no game state; every snapshot is filtered per recipient; validation precedes
mutation and RNG consumption. Security and privacy invariants are not just asserted in
prose, they are asserted in tests. Documentation matches the code to an unusual degree.

The weaknesses are almost all one weakness wearing different hats: **the code is optimised
for density rather than for the next reader.** Whitespace, comments, names, test
granularity and one major abstraction have all been compressed past the point where the
compiler or a reviewer can help. Nothing here is broken; a good deal of it will be
expensive to change safely in six months.

---

## What is genuinely good

**Layering.** `table-types` → `catan`/`color-match` → `*-session` → `table-session` →
`table-protocol` → `table-server` is a clean dependency spine with no cycles and no
back-references. The server does not depend on either game. Rules crates depend on
nothing but `serde`, `rand_chacha` and seat identity. This is the hard part of the design
and it was done right.

**Information hiding as a first-class concern.** `Game` state is private; views are
projections; `PublicEvent`/`events_for` redact what the recipient should not see
(`catan/src/lib.rs:1378`, theft resource hidden from third parties). The browser host is
the only holder of canonical state, and the checkpoint that transfers it is validated
field-by-field on import rather than trusted.

**Determinism is engineered, not hoped for.** Explicit `ChaCha12Rng` seed/stream/word
position in checkpoints, golden native-vs-WASI replay comparison in CI
(`scripts/check_replays.py`, `scripts/check_catan_replays.py`), and rejection tests proving
malformed input produces no partial output. Very few hobby projects get this far.

**Transactional rigour, two different ways.** `color-match` validates fully before
touching state and proves it in `unchanged()` (`color-match/src/tests.rs:44`, which also
asserts the RNG did not advance). `catan` clones into `next`, applies, and only then
commits (`catan/src/lib.rs:900`), which makes mid-apply `?` safe everywhere. Both are
defensible; see the consistency note below.

**Tests assert the invariants that matter.** The Playwright suite checks that guest
messages contain no `seed`/`hands`/`stock`/`rng` key and no `credential`
(`tests/browser/rooms.spec.js:39`), that hands do not overlap between browsers, and that a
name containing `<` renders safely. `tests/transport/bridge.test.cjs` runs the real
`web/transport.js` inside a `node:vm` with fake sockets, peers and deterministic timers —
a genuinely smart way to test WebRTC lifecycle logic without a browser.

**Ops hygiene.** Multi-stage Dockerfile, non-root runtime user, pinned `wasm-pack`,
content-addressed immutable assets with atomic entry-page swap, explicit
`TURN_ZERO_SPEND_VERIFIED` gate before any billable call (`table-server/src/main.rs:555`).
`docs/validation.md` is a dated, honest record that distinguishes what was tested from
what was not.

---

## Observations, most significant first

### 1. `table-browser`'s `room_client!` macro is an unchecked interface

`crates/table-browser/src/lib.rs` shares ~500 lines of room lifecycle by emitting them
into the caller's crate with `macro_rules!`. The macro body freely references `APP`,
`Authority`, `Snapshot`, `Action`, `GameEvent`, `render`, `now`, `seed`, `host_id`,
`send_peer`, `presentation_flag`, `make_authority`, `reset_transient`, `before_render`,
`after_render`, `snapshot_finished` — none of which are parameters. The contract exists
only in a doc comment.

Consequences, all observable today:

- **No type checking of the contract.** A caller that changes `reset_transient`'s
  signature learns about it as an error inside expanded macro code, pointing at the
  `room_client!()` call site.
- **The macro forces the duplication it was meant to prevent.** Both browser crates must
  define the same helper layer. Comparing them: `document`, `el`, `text`, `attr`, `error`,
  `now`, `seed`, `host_id` are **byte-identical** in `board-games-web/src/browser.rs` and
  `catan-web/src/browser.rs`; `hidden`, `disabled` and `escape` are semantically identical
  but have already drifted in spelling (`'"'` vs `'\"'`, inline `set_attribute` vs a call
  to `attr`). That drift is the leading indicator.
- **No independent tests.** `table-browser` has zero tests and cannot have any — the code
  does not exist until a caller expands it. The most intricate logic in the project (epoch
  binding, staged checkpoints, handoff commit) is covered only end-to-end.
- **rustfmt does not enter macro bodies**, so this file is exempt from the formatting gate.

A trait with associated types over an `App`-like context, or a plain generic module taking
a `&dyn Bindings`, would be checked, testable and formattable. This is the single change
with the best long-term return.

### 2. Density defeats the tooling that is supposed to enforce quality

`cargo fmt --all --check` passes, yet:

| File | Lines | Blank | `//` comments |
| --- | --- | --- | --- |
| `crates/catan/src/lib.rs` | 1785 | 1 | 3 |
| `crates/color-match/src/lib.rs` | 736 | 2 | 4 |
| `crates/table-server/src/main.rs` | 829 | 1 | 6 |
| `crates/catan-web/src/browser.rs` | 1110 | 3 | 2 |

The whole Rust workspace contains 13 `///` doc comments. Several load-bearing pieces are
written as single mega-expressions that rustfmt cannot split and therefore leaves alone:

- `table-server/src/main.rs:654` — the entire `tokio::select!` session loop, three arms,
  hand-compressed with no spaces around `=`.
- `table-server/src/main.rs:557` — a 388-character TURN credential request chaining
  `post`/`bearer_auth`/`json`/`send`/`error_for_status`/`json` with five error mappings.
- `catan-web/src/graphics.rs:582` — 1013 characters.
- `board-games-web/src/browser.rs:374`, `catan-web/src/browser.rs:278-279` — roster and
  player HTML built in one expression each.

`cargo fmt` passing is therefore not evidence that the code is formatted; it is evidence
that the code is written in a shape rustfmt declines to touch. There is no `rustfmt.toml`
and no documented style rule, so the density is convention, not policy — which means the
next contributor has no way to know it is intentional.

The same pattern on the JavaScript side, where there is no linter or formatter at all
(no ESLint, Prettier, Biome or `.editorconfig`; `package.json` carries only Playwright):

| File | Lines | Lines > 140 chars |
| --- | --- | --- |
| `tests/browser/rooms.spec.js` | 233 | 74 (32%) |
| `tests/browser/catan.spec.js` | 152 | 52 (34%) |
| `web/catan-presentation.js` | 99 | 35 (35%) |
| `web/transport.js` | 289 | 18 |

And the style is **inconsistent between sibling files doing the same job**: `web/loader.js`
is readable, `web/catan-loader.js` is hand-minified with no spaces at all;
`tests/browser/catalog.spec.js` is normally formatted, `tests/browser/rooms.spec.js` is not.
Two people (or two moods) are visible in the same directory.

### 3. Duplicated logic that a shared crate already exists to hold

- The two browser crates duplicate the DOM helper layer (see §1) — ~60 lines each.
- `web/loader.js` and `web/catan-loader.js` duplicate invite handling, panel opening,
  `retry-load` wiring and load-status text, then diverge: one swallows the failure
  silently, the other logs `console.warn`.
- `shuffle` + modulo-rejection sampling exist twice with different names and argument
  orders: `bounded`/`shuffle(cards, rng)` in `color-match/src/lib.rs:226`, and
  `sample`/`shuffle(rng, values)` in `catan/src/lib.rs:303`. Same algorithm, mirrored
  signatures — an easy place for a future reader to mis-call.
- `escape()` for HTML lives in both browser crates.

### 4. Game-specific concepts have leaked into the generic layer

`table-protocol` is documented as game-neutral, but it defines `BoardSetup`
(`Variable`/`Beginner` — a CATAN concept), `RoomView.setup: Option<BoardSetup>`, and
`SignalCommand::Setup`. The server then special-cases it: `room.setup` is populated only
`(game_id == GameId::Catan).then_some(...)` (`table-server/src/main.rs:157`) and
`SignalCommand::Setup` is rejected unless `game_id == GameId::Catan`
(`table-server/src/main.rs:469`). A third game with its own setup options either adds a
second enum here or reuses CATAN's. An opaque `setup: Option<serde_json::Value>` validated
by the adapter, or a per-game options blob, keeps the boundary honest.

### 5. `GameAdapter::new` is a method one implementer cannot honour

`Catan::new` hardcodes `Setup::Variable` (`catan-session/src/lib.rs:19`) because the trait
signature is `new(seed, players)` with no room context. Production therefore never calls
it: `catan-web/src/browser.rs:103` builds the `Game` itself with the correct setup and uses
`Authority::with_game`. The only caller of `Authority::<Catan>::new` is a test. So the
trait carries a method that would silently build the wrong board if anyone used it, and the
guard against that is indirect (`matches_room` rejects the mismatch later, at checkpoint
import). Either give `new` the `&RoomView`, or drop it from the trait and standardise on
`with_game`.

### 6. Cheap accessors routed through expensive projections

`ColorMatch::revision()` and `ColorMatch::phase()` build an entire `PlayerView` — cloning
the hand and computing every legal action by running `validate` over ~2n+5 candidate
actions — to read one scalar, then `.unwrap()` it (`color-match-session/src/lib.rs:36,42`).
`revision()` is called on every accepted action. `ColorMatch::import_checkpoint` discovers
the roster by probing `view_for` for all 256 possible `PlayerId`s
(`color-match-session/src/lib.rs:59`), building up to 256 views to find the first that
succeeds. The root cause is that `color_match::Game` exposes no `revision()`, `phase()` or
`players()` accessor, unlike `catan::Game`, which has all three. Three one-line getters
remove both problems and both `unwrap`s.

Related: `catan::Game::view_for` calls `longest_route` for every player
(`catan/src/lib.rs:857`), and `longest_route` is an exhaustive DFS over road edges with a
linear `used.contains(&e)` membership test (`catan/src/lib.rs:584`). A snapshot is built
per recipient per action, so a six-player table runs 36 route searches per action, plus
another six in `bonuses()`. It is fine at CATAN's board size and it is correct — worth
knowing before anyone reuses that function anywhere hotter.

### 7. Validation that cannot say what went wrong

`catan::Game::validate_checkpoint` (`catan/src/lib.rs:1411`) is a ~230-line closure
returning `Option<()>` in which roughly forty distinct failure modes all `return None`, and
the caller maps every one of them to the string `"Invalid CATAN checkpoint"`. The same
shape appears in `table_session::Authority::import_checkpoint`, where a 20-clause `||` chain
yields `"Checkpoint does not match this authority"`. The checks themselves are excellent —
card conservation, board topology, number distribution, port counts, phase/actor
consistency, offer legality, recomputed awards. But when a handoff fails in production, the
successor logs one sentence and the host retries blindly. Returning `Err(&'static str)` per
check costs nothing at runtime and makes the failure diagnosable.

### 8. Constants duplicated across the language and crate boundaries

`table-protocol` defines `PROTOCOL_VERSION = 4`, `MAX_MESSAGE = 32 KiB`,
`GUEST_WAIT_MS = 60_000`, `HOST_WAIT_MS = 120_000`. Meanwhile:

- `web/transport.js` hardcodes `version: 4` (six sites), the channel label `'table-v4'`,
  storage keys `table-seat-v4`/`table-action-id-v4`, `data.length > 32768` (twice) and
  `120000` for the host deadline.
- `table-server/src/main.rs:94` uses `Duration::from_secs(120)` where `HOST_WAIT_MS` says
  the same thing; the 15-second handoff timeout, 35-second idle close, 40 msg/s, 128
  upgrades/min, 4096 IPs, 256 rooms, 512 sockets and 8 seats are all inline literals.
- `catan/src/lib.rs:1397` caps checkpoints at `30_000` — a hand-tuned shadow of the 32 KiB
  transport limit, in a crate that (correctly) cannot import the protocol.

Bumping to protocol v5 means finding every one of these by grep. Generating the JS
constants from the Rust ones, or at minimum collecting them into one exported object in
`transport.js`, removes a whole class of upgrade bug.

### 9. Two user-facing messages state Color Match's limits in CATAN rooms

`table-server/src/main.rs:494` returns `"Choose 2–8 seats, at least the occupied seats,
before play."` for any capacity rejection, and `:537` returns `"Need at least two connected
humans with ready game connections and no active round."` for any start rejection. Both are
reached by CATAN rooms, whose real bounds are 3–6 seats and three humans — the numbers are
already available as `room.game_id.entry().min_players`/`max_players`. Small, and a plain
symptom of the shared-message shortcut.

### 10. Test granularity hides coverage

47 Rust tests cover ~10k lines, and they are bundled by design:
`checkpoint_rejects_bad_topology_conservation_cards_phases_and_offers`,
`development_purchase_privacy_monopoly_invention_and_free_roads`,
`private_events_filter_per_recipient_and_human_only_games_stay_paused`. The assertions are
strong, but a failure lands somewhere inside a 60-line function covering five behaviours,
and it is hard to look at the list and see what is *not* covered. `table-session` — the
crate every game routes through — has exactly one test. Splitting the "and" tests costs
lines and buys a failure message that names the broken behaviour.

### 11. Smaller notes

- **HTML templates are single-line blobs.** `site/catan.html` line 23 is a multi-thousand
  character `<dialog>`. Any future diff on these files is unreadable.
- **Implicit DOM contract.** `el()` unwraps `get_element_by_id`, so ~43 element ids in
  `catan-web` and ~34 in `board-games-web` must exist in the hand-written templates or the
  Wasm panics. Only the e2e suite catches a typo. A single startup check that resolves all
  required ids and reports the missing one would fail loudly instead of cryptically.
- **`Event::Built { kind: String }`** (`catan/src/lib.rs:186`) is stringly-typed
  (`"settlement"`/`"city"`/`"road"`) in a codebase that is otherwise disciplined about
  enums, and it crosses the wire on every build.
- **Rules crates carry English UI copy.** `RuleError`'s `Display` and `Card::label`
  (`color-match/src/lib.rs:65`) put presentation strings in the layer that is supposed to
  be presentation-free. Harmless today, blocking if localisation ever appears.
- **Single-letter names are pervasive** in domain code (`p`, `c`, `v`, `e`, `n`, `s`, `g`,
  `h`). Consistent, and fine in the mesh maths; less fine in
  `fn points(&self, p: PlayerId, private: bool)`.
- **`step_bot` panics on a bad projection** (`table-session/src/lib.rs:248`,
  `.expect("legal projected bot action")`). In Wasm that aborts the host's tab and takes
  the room with it; logging and skipping would degrade instead.
- **`impl Room` is split across `table-server/src/main.rs:64` and `:775`**, with `mod tests`
  and `main()` between them — an append artifact, not a design.
- **`scripts/check_catan_replays.py:13`** reads `source` after the loop, relying on the
  loop variable surviving; `check_replays.py` re-globs explicitly instead. Both use bare
  `assert` for CLI validation, so a failure prints a tuple rather than a diagnosis.
- **`tests/transport/bridge.test.cjs:44`** loads the ES module by
  `.replaceAll('export function ', 'function ')`. It works because `transport.js` only uses
  that one export form; `export const` or `export {}` would silently break the harness.
- **CI is one uncached job** (`.github/workflows/check.yml`): `cargo install wasm-pack`
  from source, three Playwright browsers with deps, full `make check`, then `make check-turn`
  with coturn — every push, no `Swatinem/rust-cache`, no job split.
- **`wasm-opt = false`** in both browser crates leaves release Wasm unoptimised beyond
  `opt-level = "s"` + LTO.
- **`render.yaml` still names the service `color-match`** although it now serves the whole
  catalogue.

---

## If only three things change

1. Replace `room_client!` with a checked abstraction (trait or generic module), and move
   the duplicated DOM helpers into it. Everything in §1 and half of §3 follows.
2. Add a `rustfmt.toml` and a JS formatter, then break the mega-expressions rustfmt cannot
   reach — starting with the server's `select!` loop and the two HTML builders. Decide the
   whitespace/comment policy explicitly and write it in `AGENTS.md`; the current density is
   a strong convention that no new contributor can discover.
3. Give the checkpoint validators per-check error strings, and export the protocol
   constants to JavaScript from one place.

None of these is a bug fix. That is the point: the correctness work here is in good shape,
and the remaining risk is concentrated in how hard the code is to change.

## Verified reassessment and cleanup (2026-09-07)

The original review correctly identifies implicit browser contracts, compressed code,
weak checkpoint diagnostics and duplicated wire constants. Its conclusions need these
corrections:

- Macro expansions are type-checked and can have test callers. The concern was the
  implicit caller contract and lack of independent lifecycle testing.
- The two rejection samplers consume randomness differently; consolidation could change
  replays. Both algorithms are retained and their compatibility requirement is documented.
- Color Match checkpoint import probed at most 256 IDs and stopped at its first successful
  projection. It now reads the canonical roster directly.
- The protocol intentionally owns a game registry. Typed options strengthen validation;
  opaque JSON would weaken that boundary.
- Blank-line counts, test counts and absent formatter configuration do not prove defects.
  Stable rustfmt defaults are retained, with readable macro bodies documented explicitly.
- Incorrect CATAN capacity/start messages were user-facing defects. Registry-derived
  messages now reflect each game's admission rules.

The supplied baseline reported formatting, native workspace Clippy, 51 Rust tests and eight
transport tests passing, plus colliding `fixture` example names. That assessment did not
rerun browser, WASI or TURN checks. The examples now have game-prefixed names. The cleanup
adds pinned formatting, protocol v5 options/generated constants, a regular generic browser
lifecycle with deferred effects, shared loading/DOM helpers, descriptive checkpoint errors,
and split cached CI jobs. Implementation verification is recorded in
[validation](../validation.md); original findings above are retained as historical context.
