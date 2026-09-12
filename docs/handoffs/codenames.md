# Codenames implementation handoff

Prepared September 12, 2026 by the Codenames planning agent. **Planning complete;
implementation and application validation have not started.** This document is
for the Medium implementation successor. The user's current three-game request
authorizes implementation and supersedes the historical planning-only disclaimer
in `docs/games/codenames-plan.md`.

## Ownership and current coordination

- Work only in `/home/oscar/Projects/board-games-three-games/codenames`, branch
  `feature/codenames`. Do not edit the original checkout. This handoff itself is
  intentionally in the integration worktree for the coordinator to retain.
- The complete rules specification is `docs/games/codenames-plan.md`; read it
  before coding. Use this handoff for implementation decisions and the user's
  newer visual/behavior requirements. Classic word Codenames, **4–8 seats**, no
  bots, no chat/voice, no timers, no spectators, no other editions.
- Coordinator owns shared socket error codes, session retry/recovery, and shared
  room settings wiring. Do not edit `rooms.ts`, `socket.ts`,
  `session.svelte.ts`, or room settings plumbing independently. Tell coordinator
  about a demonstrated missing seam. Existing `GameDefinition.presence` is enough
  for Codenames setup presence: no extra server guard is currently necessary.
- **First successor action: cherry-pick coordinator commit `ef5a1be` into the
  Codenames worktree.** It supplies shared socket recovery, agreed readiness
  retries, corner room controls and the six-game library layout. Keep catalog
  layout CSS under coordinator ownership; add only Codenames summary/loop,
  options, registration and art/content wiring in the owner changes.
- Coordinator confirmed: use `{ type: 'ready', version: number }`, public
  `phase: 'setup'`, `setupVersion: number`, and `ready: string[]`. This is the
  plan's `teamSetup`, with the existing wire vocabulary. Coordinator will enable
  bounded stale retries only while this exact setup/round/version remains valid.
  **Never automatically retry a guess, clue, review, or penalty reveal.**
- Coordinator is adding `STALE_REVISION` / `MATCH_CHANGED`, a client
  `SocketReplyError(code)`, and authenticated `sync` returning the caller's own
  RoomView plus acceptance status for the same actionId/round. Consume final
  shared interfaces rather than duplicating them. A timeout must synchronize and
  require a fresh confirmation; uncertainty is not authorization to guess again.
- Owner implements shared catalog/registration/message changes in a **separate
  wiring commit** for integration. Keep game package, practice, guide content,
  tests, and game docs commits distinct where practical. Message coordinator
  with commit IDs and any shared-file conflicts. Do not modify accepted ADRs to
  retroactively add Codenames. Agree a new ADR filename/number with coordinator;
  `012` is currently last in this branch but other game owners also need ADRs.
- Owned ports: backend **3012**, Vite **5182**, Playwright **3112**. Use
  `PORT=3012 WEB_PORT=5182 bun run dev` and `TEST_PORT=3112 bun run test:e2e ...`.
  Do not stop another worktree's services.
- No nested delegation. No optional extension installation/import. The repo
  briefing's `plan_turn` tool was not exposed in this session; ordinary file
  searches were sufficient. No skills were installed or enabled.

## Evidence and resolved conventions

Both current primary rulebooks were verified in this planning pass:

- [CGE English 2025 rules EN 30](https://filemanager.czechgames.com/storage/files/codenames/rules/CN%20rulebook%20EN%2030.pdf)
  parsed successfully through web browsing. Pages 2–5 establish setup, turns,
  mandatory guesses and wins; pages 6–8 establish clue validity, advanced clues,
  penalties and reminders. Starting team has 9 agents; opponent 8; 7 bystanders
  and 1 assassin. Zero and unlimited remove the guess cap, not failure
  consequences. An opponent can reveal your last agent and thereby win for you.
- [CGE/Devir Spanish rules ES 07](https://filemanager.czechgames.com/storage/files/codenames/rules/CN%20rulebook%20ES%2007.pdf)
  timed out in the web PDF parser twice, but direct download and `pdftotext`
  succeeded. Temporary research files are `/tmp/codenames-rules-es07.pdf` and
  `/tmp/codenames-rules-es07.txt`; they are not repository assets. Page 6
  specifically distinguishes accented words; do not strip accents for clue
  equality. Preferred terminology includes `jefe de espías`, `agentes`,
  `pista`, `clave`, `civil`, `asesino`, `pista cero`, `pista ilimitada`.
- Review before guessing, explicit confirmation, 4–8 app capacity, freely
  generated keys with correct counts, local practice, and no undo are deliberate
  app conventions already authorized in the full plan. They are not claims that
  the printed rulebook requires these interactions.
- The user's newest sound instruction overrides the plan's default-off sentence:
  sound preference defaults **enabled**, but AudioContext creation/resume and
  audible playback require a user gesture. Never autoplay or replay old audio
  when that first gesture unlocks sound.
- The user's newest immersive settings instruction overrides the plan's old
  toolbar language control: upper-right gear owns the one settings surface;
  it includes game sound/volume/reduced-motion preferences and the supplied
  room controls/locale snippet. No duplicated locale controls.

## Architecture inspected and integration checklist

The branch is Bun 1.4.2, TypeScript, Svelte 5, Socket.IO, Paraglide. No new
framework or runtime is needed. Rules remain DOM/network/storage independent.

- [ ] Add `games/codenames/package.json` mirroring Carcassonne's exports:
      `./server`, `./Board.svelte`, `./practice`. Depend on game-core/shared and peer
      Svelte. Keep all game modules in `games/codenames/src/`.
- [ ] Suggested small modules: `types.ts` (type-only canonical/public/private
      contracts), `index.ts` (rules/projection/GameDefinition), `words.ts`
      (server-only packs), `presentation.ts` (public event gate), `effects.ts`
      (gesture audio), `Board.svelte`, focused `WordCard.svelte` and
      `Rulebook.svelte` or equivalent, and `practice.ts`. Split further only when
      it makes a real boundary clearer. Do not extract a generic team framework.
- [ ] Add server registration import/map in `apps/server/src/index.ts`, workspace
      dependencies in `apps/server/package.json` and `apps/web/package.json`, then
      update Bun lockfile with `bun install`. Coordinate lockfile merging.
- [ ] Add metadata only to `packages/shared/src/index.ts`: `id: 'codenames'`,
      name, 4/8 limits, localized description, miniature grid preview. Do not set
      `practice: true` if it would route to server bot rooms; local practice has
      its own route, as Catan/Carcassonne do.
- [ ] Add dynamic Board import to `apps/web/src/lib/games.ts`.
- [ ] Catalog `+page.svelte` requires entries in **both** `summaries` and
      `loops`, a Codenames board-language selector in Start, and
      `create(..., { boardLanguage, allowAbbreviations, allowMultiwordNames })`
      options as applicable. Current create sends `{setup, practice}` for all
      games, so carefully preserve other paths. Add a local practice link.
- [ ] Simplest agreement design: choose the two optional clue agreements with
      board language when creating the room, show them prominently in team setup,
      and freeze them for the round. No new configuration action is required.
      If providing setup editing, it must be host-only via ActionContext, versioned,
      and clear readiness; coordinate before expanding this scope.
- [ ] Add Codenames art branches to `BoxArt.svelte` and
      `SummaryStep.svelte`. Both currently fall through to Carcassonne for unknown
      IDs; a metadata-only addition would otherwise show the wrong art.
- [ ] Add `guides/codenames.ts` and `guides/CodenamesScene.svelte` with
      independent lightweight illustration data. Register in **both**
      `guides/load.ts` and `Rulebook.svelte`'s `sceneLoaders`. Guide content uses
      `Guide/Chapter/Lesson` with three explicit Before/Action/Result frames,
      localized functions, and illustrated scenes. Keep these imports lazy and
      free of game engine, word packs, or practice fixtures.
- [ ] Room Board props are `view, playerId, players, send, locale, round,
connected, pending, practice, canConfigure, settingsContent`; coordinator has
      additionally wired `canRematch: boolean` and `rematch: () => Promise<void>`
      for host-owned result controls. Implement matching optional defaults for
      local practice. The supplied settingsContent contains EN/ES locale, invite
      with copy feedback, leave, host rematch, connection and room ID. Coordinator
      hides the persistent toolbar for the three new games while keeping connection
      failure visible in a table banner, and owns lobby “Choose teams” wording.
      **Owner need not modify the room page.** Game Board has no network imports.
- [ ] Add local `/practice/codenames` route. Only that route imports
      `@board-games/codenames/practice`; multiplayer Board must not import it.
- [ ] All interface text, errors, hints, history, narration, accessibility,
      illustrations and rules go through new `cn_...` / `library_cn_...` messages
      in both shared `en.json` and `es.json`. Generate with the existing check/build
      scripts. Never hand-edit generated Paraglide files.
- [ ] Update game README, `docs/games/codenames.md`, rules-guide coverage, and
      coordinate root README/architecture/AGENTS/validation integration. State
      actual manual/browser limitations rather than declaring future checks passed.

## Rules implementation checklist

Use discriminated `setup | clue | clueReview | guessing | penalty | finished`
states. Canonical board cells contain words, identities, and revealed flags;
setup has **no key and no dealt board**. Common data includes players,
assignments, immutable options, setupVersion/ready/connectedPlayers during setup,
activeTeam, turn number, clue/history, actionSequence, last accepted event batch,
and result. Encode finite/unlimited budgets as tagged data, never Infinity.

- [ ] `create` validates 4–8 unique seat IDs and supported options; starts every
      seat unassigned/unready and assumes all supplied seats connected (Rooms.start
      already enforces this). Bad options must not silently select a different pack.
- [ ] `chooseRole {team,role,version}` changes only the authenticated actor.
      Roles are `spymaster | operative`; one spymaster slot per color; no automatic
      eviction when contested. Any assignment change clears **all** ready flags
      and increments setupVersion. No assignment changes after deal. Repeated no-op
      role choices may reject without emitting an event.
- [ ] `ready {version}` is an explicit assertion, not a toggle. Reject a
      mismatched setupVersion, incomplete roster, absent seat, or invalid team
      structure. Teams each need one spymaster and one or more operatives. Uneven
      2/6 is legal at 8 seats. Final readiness deals and enters `clue` atomically.
      If exposing “Not ready,” use a separate intentional action; do not overload
      the coordinator's safe retry shape.
- [ ] `presence` returns unchanged state outside setup. In setup copy connected
      seat IDs and clear the disconnected seat's readiness. On replacement clear
      all ready flags and increment setupVersion. Keep replacement's assignment
      visible but require new consent. Final ready explicitly rejects while anyone
      is disconnected. Do not increment game actionSequence for a presence snapshot.
- [ ] Deal via injected Fisher–Yates: 25 distinct words, independent random
      starting team, shuffled identity multiset. RNG/seed stays server-only.
      Starting color independent of host/seat ordering; seeded tests cover both.
- [ ] `submitClue {word,count}` only active spymaster in `clue`. Count is an
      integer 0–9 or explicit `'unlimited'`. NFC, trim, nonempty, maximum 80 Unicode
      characters, reject controls/invisible format characters and pathological raw
      length; preserve accents/case spelling in published history. Avoid an
      ASCII-only regular expression. Reject structural invalidity before mutation.
- [ ] A warning for an exact normalized unrevealed word or multiword structure
      is advisory. No stemmer, substring ban, dictionary, semantic matching engine,
      intended-target list, or test of whether count matches available targets.
- [ ] Successful submit publishes clue and enters `clueReview`. Only opposing
      spymaster may `reviewClue {allow:boolean}`. Approve enters guessing with used
      0 and finite cap count+1 or unlimited for 0/∞. Reject logs outcome and enters
      penalty controlled by the opposing spymaster. No guesses during review.
- [ ] `takePenalty {card:number|null}` only that opposing spymaster. Null skips;
      otherwise index must be in range, unrevealed, and their own agent. Reveal
      checks victory immediately, then advances to their clue. The offending team
      never gets a guess or a second chance at the rejected clue.
- [ ] `guess {card:number}` only an active-team operative in guessing. Any
      unrevealed cell is legal independent of identity. Reveal once; increment used;
      resolve assassin or exhausted team agents first. Own agent continues only
      below finite cap, otherwise handoff; enemy/bystander handoff immediately.
      Already-revealed, fractional, NaN, negative, string, and out-of-range indices
      reject without mutation.
- [ ] `endTurn` only active operative after used >= 1; legal for 0/∞ as well.
      It passes to opposite team's clue. Both review and penalty permissions must
      be independent of room host authority.
- [ ] Finished state inert; winner/team/reason durable, whole key postgame public.
      Existing host rematch is Rooms.start → fresh create → setup with new room
      round and no old key/clues/readiness. No game-owned rematch action is needed.
- [ ] Bound public history to a documented reasonable recent window (e.g. 200
      entries); repeated invalid clues can otherwise grow it forever. Keep current
      clue/result outside history so truncation cannot alter rules.

## Projection and presentation invariants

- [ ] Explicitly construct public and private objects. Public cells always have
      index/word/revealed; include identity only when revealed or finished. Only
      spymasters after deal get unrevealed identity mapping in their private view.
      Host receives exactly their seat's game-role projection. No canonical spreads.
- [ ] Public state includes assignments, readiness, fixed language/agreements,
      phase/activeTeam, clues/history, public remaining counters, result, sequence,
      and safe event batch. Private controls may describe what actor can do, but an
      operative's legal guesses must never depend on secret membership.
- [ ] Implement metamorphic privacy tests: permute unrevealed identities while
      preserving counts/revealed cells; every operative/operative-host serialized
      view and action affordance stays byte-equivalent. Spymaster views differ.
- [ ] Runtime Board imports may include **types only** from rules; no word-pack
      or canonical state import. Browser only receives 25 selected words. Never
      persist a key, view, or snapshot in localStorage/sessionStorage.
- [ ] Game-owned typed events after accepted actions only:
      `boardDealt`, `clueSubmitted`, `clueReviewed`, `cardRevealed`, `turnEnded`,
      `gameFinished`. Event payloads use explicit public allowlists. Only revealed
      identities enter reveal events; no whole key in deal events. Include
      actionSequence and event index, with a fresh batch even when an accepted
      setup action has no visual event.
- [ ] Event gate identity includes room round, seat, and role. Consume only
      consecutive accepted action sequences. Same sequence on rejected/duplicate/
      presence snapshots does nothing. Initial mount, reconnect, gaps, backwards
      sequence, changed round/seat/role, hidden-tab restoration, viewport resize and
      motion-setting changes cancel animation/audio and establish latest baseline.
      Carcassonne's gate lacks some of these checks; do not copy it unchanged.
- [ ] Canonical visible state updates immediately. Motion decorates it. Cancel
      timers/WAAPI/audio source nodes on reset/unmount; never delay rules or board
      usability to wait for a flourish.
- [ ] Local card selection is not a network action. Clear selection/confirmation
      on accepted competing action, invalidated phase, reconnect, changed round,
      failed/uncertain submission, and changed seat. Wrap Board sends so local
      selection clears even if shared send reports errors through session state
      rather than rejecting its Promise. Never replay an uncertain confirmation.

## Concrete visual specification

Build an original warm spy briefing table filling `100dvh`. Ink-blue felt/desk
`#152532`, ivory dossiers `#F5EEDC`, ink text `#182631`, crimson `#A93645`, cobalt
`#245C97`, restrained brass `#B88B47`. Validate contrast in the implemented
combinations. Subtle CSS grain/grid, paper edges, clips and original SVG agent,
civilian and assassin emblems are sufficient. No copied publisher artwork.

- Upper left: a recognizable illustrated rulebook button, with localized
  accessible label. Opens searchable illustrated guide with topics, diagrams,
  steps, and official source links. Reuse the same lightweight lesson content
  as the catalog; render original scenes with no live secret state. Dialog has
  close button, Escape handling, focus trap via native dialog, focus return.
- Upper right: one gear, 44×44 minimum. Settings includes enabled sound,
  volume slider (0–100), reduced-motion preference, history/roster if needed,
  and `{@render settingsContent?.()}` for room invite/leave/locale/rematch/status.
  No permanent competing toolbar. Use safe-area-inset padding on every edge.
- Center: stable row-major 5×5 word grid. Never reorder cells for role,
  orientation, active team, result or viewport. Above: compact red/blue counters
  and explicit phase/team text plus current clue/count. Below: role controls
  and a reserved confirmation tray. Ivory card words are highest hierarchy.
- Desktop 1440×900: board roughly 780–900px wide, dossier-like team summaries
  on each side, clue strip centered. Eight-player rosters should not shrink the
  word cards. Preserve whitespace around the board and corner controls.
- Tablet 768×1024: compact team rows above, board centered, controls below;
  history/settings in dialogs. All cards and critical action controls visible.
- Phones 390×844 / 360×640: 5 columns, 4–6px gaps, modest 12–16px outer inset,
  cards at least 44px in both dimensions. Allow words to wrap, no ellipsis or
  hover-only labels. Add a prominent full selected-word preview above confirmation.
- 320px and 200% text scaling: keep 5 columns with min-width:0; use deliberate
  vertical scrolling in the table content, never horizontal page overflow or
  text shrinking into illegibility. Keep corner controls and dialogs reachable.
  Virtual keyboard must not cover clue submit or dialog close controls.
- Operative unrevealed cards: identical neutral design, accessible naming and
  local selection ring. No hidden-key data attributes, classes, CSS variables,
  timing, sprite choices, aria labels, tooltip, audio, or layout differences.
- Spymaster: persistent “Spymaster — secret key” badge; cells use color **and**
  identity labels/patterns/icons. Unrevealed identity overlay looks different
  from the durable stamp on revealed cards. Both spymasters see the same key.
- Revealed: short dossier flip/compression plus durable identity stamp; preserve
  readable word text. If using a flip, no secret reverse face exists in an
  operative DOM before acceptance. Finished board inert with visible result.
- Role controls: active spymaster composer; opposing spymaster Allow/Invalid;
  penalty own-agent selection or Skip; active operatives select/confirm/cancel/
  End turn; others see explicit waiting text and the responsible role/team.
  Offline waiting includes actual reservation status from players, never fake
  activity. Any active operative can confirm, with no captain or vote mechanism.
- Keyboard: native buttons, row-major navigation (Tab sufficient; optional
  arrows must be consistent), Enter/Space selection, Escape cancellation,
  distinct visible focus. Announce only accepted public outcomes and new phase
  in a concise live region. Label count 0 and ∞ with their actual meanings.

Animation targets: first fresh accepted deal <=600ms total; select 100–140ms
and <=2px lift; clue arrival 180–240ms; reveal/stamp 260–360ms; score emphasis
180–240ms; wrong-card handoff 200–300ms; result <=900ms total. No idle motion,
screen shake, flashes, or secret-dependent motion before reveal. Reduced motion
removes movement/stagger while retaining immediate state and focus.

Audio: original brief paper, stamp, neutral handoff and result cues, public
events only; local focus/selection if sounded must be the same for every hidden
identity. Default preference enabled, gesture unlock, separate persisted volume,
mute stops active/future sources, AudioContext unavailable is harmless. Respect
OS motion plus persisted Codenames setting. Catch storage failures without
blocking play. Do not interpret stored sound preference as a gesture.

## Illustrated guide and practice coverage

- [ ] Guide topics: team/role setup and privacy; 9/8/7/1 key; clue word/count;
      human review and agreed exceptions; selection/confirmation; all four reveal
      identities; count+1 and mandatory first guess; old clues; 0 and ∞; invalid
      clue penalty/skip; victory including enemy last agent and assassin; reconnect,
      replacements, role locking and rematch. Use before/action/result diagrams
      illustrating actual mechanics rather than generic card ornaments.
- [ ] In-table guide must be searchable without navigating away or losing state.
      Localization changes re-render explanatory text but never board words/clues.
- [ ] Curate >=200 original usable EN words and >=200 ES words with provenance
      statement. Validate NFC/case uniqueness, nonempty/length/adequate size.
      Include accents/ñ and long words in fixtures. No copied official full deck.
- [ ] Practice uses the same create/apply/view rules with isolated seeds and
      scenario setup, never a alternate simplified win condition. Provide full
      classic practice plus explicit own-agent, bystander/enemy, assassin, final
      agent, zero/unlimited, review rejection/penalty scenarios as useful.
- [ ] Local practice may switch to the required actor/role to teach both sides;
      label this clearly as a local demonstration, not private solo competition.
      Clear selection/effects whenever actor changes. Reset advances local round.
      No botAction in multiplayer definition, no production fixture endpoint.

## Validation checklist and evidence to return

Run meaningful tests while implementing, then normal required checks. Preserve
new test evidence/screenshots/video outside maintained source or in normal
Playwright output paths. Do not claim screenshots are reviewed unless opened.

- [ ] Seeded rules: initial composition/word uniqueness/both starting colors;
      no key before complete readiness; 4 and 8 seats including uneven team sizes;
      role contention, unknown/spoofed actors, versioned readiness invalidation;
      all role×phase permissions; 1–9/0/∞ budgets; mandatory first guess; voluntary
      stop; automatic cap; own/enemy/civilian/assassin; all victory paths including
      opponent last agent and penalty final agent; inert finish; fresh rematch.
- [ ] Validate malformed options/actions/clues/counts/indices, NFC equivalence,
      accents retained, advisory exact/structure warnings accepted by reviewer,
      no late review/undo. Rejected actions preserve complete serialized state,
      RNG consumption where applicable, history and sequence.
- [ ] Privacy: inspect every public/private projection and events throughout
      setup, clue/review/penalty, reveal, finish, rematch; key permutation test;
      operative host; no browser-engine/packs/fixtures eager import.
- [ ] Real Rooms/Socket.IO tests following `apps/server/src/carcassonne.test.ts`:
      4 seats, actor spoofing, simultaneous operative guesses (8 seats supplies
      multiple same-team operatives), stale revision, duplicate action ID, round
      mismatch, disconnect, same-token replacement socket, expired seat replacement,
      host promotion without key elevation, absent spymaster waiting, setup ready
      disconnect/replacement. Inspect actual snapshots after failures/reconnect.
- [ ] Presentation unit tests: first baseline, one accepted sequence once,
      multiple event indices, duplicate/rejected/presence snapshot, sequence gap,
      round/role/seat/disconnect/visibility/motion changes. Audio tests show no
      sources before gesture, after mute, for repeated snapshots or backlog.
- [ ] Chromium **and** WebKit, four independent contexts with both spymasters
      and two operatives; eight-player setup/layout and simultaneous guess case.
      Normal finish and assassin finish via isolated practice or a test-owned
      seeded server, never a production key/debug endpoint.
- [ ] Browser journeys: catalog start/language option; independent lazy guide;
      setup/ready/review; selection before confirmation has zero socket action;
      cancel; own/opponent/civilian/assassin; disabled End turn before first guess;
      prior clue/history; review penalty; settings/invite/leave/rematch; reconnect
      mid-effect with no replay; key absent from operative network/DOM/accessibility.
- [ ] EN and ES, fixed board language after interface-locale changes, long
      words, keyboard-only/touch, 44px controls, reduced motion, unavailable/muted
      audio, volume preference persistence, dialogs/focus/escape, no page errors.
- [ ] Screenshot and overflow checks at 1440×900, 768×1024, 390×844, 360×640,
      plus 320px width and 200% text scale. Capture setup, both roles, selected word,
      review/penalty, all reveal types, result, settings, illustrated guide. Capture
      a short video of accepted reveal/handoff; compare against motion spec.
- [ ] `bun install`, `bun run check`, `bun run test`, `bun run build`, owned-port
      browser suite, formatting of changed maintained files, then
      `bun run format:check`. Stop repeating passes without new changes/evidence.
      Coordinator runs integrated regressions across all games; report exact owned
      commands/results and discovered cross-game failures honestly.
- [ ] WebKit may need existing `WEBKIT_EXECUTABLE=/tmp/board-games-browser-deps/webkit`
      documented in `docs/validation.md`; verify it exists before use. Optional
      `CHROME_CHANNEL=chrome` exercises installed Chrome. Neither is a dependency
      added to the app.

Manual real Safari/macOS/iOS, physical touch/virtual keyboard, subjective audio,
independent fluent Spanish review, and four-person human playtest remain
unverified until actually performed. Record those limits in final handoff;
automated seeded completion does not prove semantic clue quality or social
review friction.

## Planning validation

Read repository instructions, complete game plan, contract, room/socket/session
bindings, Board integration, catalog/guide registries, practice pattern, audio
gate, test fixtures and validation documentation. Verified current primary EN
and ES rules. Codenames worktree had no modifications when inspected; coordinator
was already changing shared infrastructure in integration. This planning agent
changed only this handoff. No application, browser or device checks were run.
Prettier formatting and whitespace review passed for this handoff.

## Implementation phase

See [Medium implementation evidence and High-review checklist](codenames-implementation.md). High review is in progress in the Codenames worktree.
