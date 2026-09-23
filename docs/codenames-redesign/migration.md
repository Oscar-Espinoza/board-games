# Codenames Table: migration plan

Structural target: the table in [`images/design-desktop.webp`](images/design-desktop.webp), with
values from [tokens](tokens.md) and markup in [`source/Main.dc.html`](source/Main.dc.html).

The milestones below depend on each other. Together they form one migration, not
independent restyles. The design depicts real turn state (a round, the active team,
a clue with a count, guesses per clue), so this is a **rules change plus a
presentation change**. Read the whole plan before starting.

The approved follow-up makes Image #2 (`images/reference.webp`) the material and
lighting target. Runtime assets are optimized local WebP; original development-time
generation is permitted. Captures are WebP too. See [asset provenance](../../games/codenames/src/table/README.md).

## Ground rules

- The working tree may contain unrelated user changes. Preserve them. Never
  `git checkout`/`restore` Codenames files to recover old code; read old revisions
  with `git show <rev>:<path>` instead.
- These constraints from `AGENTS.md` remain in force:
  - Rules stay independent of DOM, networking and storage.
  - Randomness is explicit.
  - Server socket bindings establish actor identity.
  - Clients never mutate canonical state.
  - Other players' secrets are never delivered and then hidden in UI.
  - Catalog metadata stays free of eager game imports.
  - Practice fixtures stay out of multiplayer initialization.
- No new runtime dependencies. Cards and UI are CSS/SVG/Svelte; approved original WebP wood/props are the exception. Fonts are self-hosted.
- Chrome and Safari are required targets. Run Chromium and WebKit for browser work.
- Use Bun; run the game/server suite and targeted browser journeys.

## Mockup facts that must not be copied literally

The mockup is a single illustrative frame. Where it conflicts with the rules, the rules win.

| Mockup                                                                   | Implementation                                                                                                   |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| KNIFE is shown as a revealed assassin while play continues               | A revealed assassin always ends the game. It only appears revealed in `finished`                                 |
| "jordan (You)" is a red operative, yet the Spymaster Mode key is visible | The key panel and key data exist only for spymasters (and for everyone once `finished`)                          |
| "Codenames" wordmark, "Room: Sunset-7F", "6/8", "Jordan"                 | Localised title, real room id, real seat count / `maxPlayers`, real viewer name                                  |
| Only correct guesses appear in Clue History                              | Every guess appears. Own-agent guesses get a green check; others follow [history styling](#clue-history-styling) |
| Blue shows 5 remaining with 3 revealed                                   | Always derive from `remaining`                                                                                   |
| Reference image's chat panel and handwriting on objects                  | Excluded by the product owner. Do not add chat                                                                   |

## 1. Decision and documentation

Write the decision first and update affected instructions in the same change.

- Add `docs/adr/019-codenames-table-turns.md`. It supersedes these clauses of ADR 018:
  - "Clues, counts, review, penalties and handoffs are neither stored nor enforced."
  - "Either team's operative can submit…"
  - "The playing surface contains only the grid and corner controls…"
  - Revealed-card portraits on the grid.
- It keeps everything else from ADR 018:
  - `setup`/`finished`, 4–8 seats, one spymaster per team, versioned unanimous readiness.
  - Board-language choice, 9/8/7/1 deal, spymaster-only key, public-index-only variation.
  - Audio gesture unlock, reduced motion, result overlay, host rematch.
- It does **not** restore ADR 015's opposing-spymaster clue review, penalties or
  clue-agreement options. Groups still judge clue legality aloud.
- Update `AGENTS.md`:
  - Rewrite the Codenames paragraph to describe the new model.
  - In the retry sentence, add "never retry Codenames clues or end-turn automatically".
- Update `docs/games/codenames.md`, `games/codenames/README.md`, `docs/architecture.md`
  (package table row and the voice-led/retry paragraphs), `docs/games/library-guide-coverage.md`,
  `games/codenames/src/guide.ts`, `GuideScene.svelte` and `Rulebook.svelte` together.
- In the new ADR, link this folder as the accepted design.

## 2. Rules engine

Files: `games/codenames/src/types.ts`, `index.ts`, `practice.ts`, `index.test.ts`, `presentation.ts`.

Commit `3f42b99` still contains the ADR 015 clue/turn engine (`git show
3f42b99:games/codenames/src/index.ts`, and likewise `types.ts` and `index.test.ts`).
Reuse its tested pieces: `next()` handoff, `reveal()`, budget, clue validation and
normalisation, `requireActor`. Drop `clueReview`, `penalty`, `reviewClue`,
`takePenalty`, `allowAbbreviations` and `allowMultiwordNames`.

State and public projection:

```ts
export type Phase = 'setup' | 'clue' | 'guessing' | 'finished';
export type Clue = { word: string; count: number | 'unlimited'; team: Team };
export type Budget = { kind: 'finite'; cap: number } | { kind: 'unlimited' };
export type ClueRecord = {
  turn: number; // the "Round N" shown in the UI
  team: Team;
  word: string;
  count: number | 'unlimited';
  guesses: { card: number; word: string; identity: Identity }[]; // revealed cards only
};
// State + Public gain:
//   activeTeam: Team; turn: number; clue: Clue | null;
//   budget: Budget; used: number; clueHistory: ClueRecord[];
// startingTeam stays (first activeTeam).
```

Actions (all validated against the authenticated actor):

| Action                       | Allowed when                                               | Effect                                                                                                                                                                                                                                                    |
| ---------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chooseRole`, `ready`        | Unchanged                                                  | The final ready deals the board: `activeTeam = startingTeam`, `turn = 1`, `phase = 'clue'`                                                                                                                                                                |
| `submitClue { word, count }` | `clue` phase, active team's spymaster                      | NFC-normalise and trim `word`, 1–80 graphemes, no control/format characters. `count` is an integer 0–9 or `'unlimited'`. Set `budget` (0 or unlimited means unlimited, otherwise `count + 1`) and `used = 0`. Append a `ClueRecord`. `phase = 'guessing'` |
| `guess { card }`             | `guessing` phase, active team's operative, card unrevealed | Reveal the card and append it to the last record's `guesses`. Assassin: the active team loses. A team's last agent: that team wins. A civilian or opponent card, or an exhausted finite budget, hands off                                                 |
| `endTurn`                    | `guessing` phase, active team's operative, `used ≥ 1`      | Hand off                                                                                                                                                                                                                                                  |
| Handoff                      | —                                                          | Switch `activeTeam`, `turn++`, `clue = null`, `phase = 'clue'`, emit `turnEnded`                                                                                                                                                                          |

Everything else rejects without mutation.

- Every turn reveals at least one card, so `clueHistory` naturally holds at most 25 records. No extra cap is needed.
- Events: `boardDealt`, `clueSubmitted { clue }`, `cardRevealed`, `turnEnded { team }`, `gameFinished`.
- Update `eventLabel` and `presentation.ts` for the new event types.

Privacy:

- The key stays in the spymaster's private projection only.
- `clueHistory` only contains identities of revealed cards.
- Extend the key-permutation test from `3f42b99`: permuting unrevealed identities must
  not change any operative payload, including `clueHistory`, `clue` and `budget`.

Presence: an absent active spymaster or operative blocks that team's turn, as
under ADR 015. Hosts gain no extra power.

Practice (`practice.ts`, local only):

- Keep `setup`, `final` and `assassin`.
- `match` starts in `clue` phase.
- Add a `midgame` scenario shaped like the mockup:
  - Turn 3, red guessing on a count-2 clue with 2 correct guesses made.
  - Earlier red count-1 and blue count-2 records.
  - Three red and three blue agents revealed. **No assassin revealed.**
- Pack words are fine. Do not hard-code the mockup words into production packs.

Retry (`apps/web/src/lib/action-retry.ts`):

- The Codenames branch still retries only unchanged setup `ready`.
- Add explicit tests that `submitClue`, `guess` and `endTurn` never retry.

Server: `apps/server/src/codenames-socket.test.ts` covers:

- Actor identity for each action.
- A wrong-team or wrong-role actor is rejected.
- Recipient payloads: operatives never receive the key.
- Reconnection mid-turn.

## 3. Presentation

Files: `games/codenames/src/Board.svelte`, a new `tokens.css` (from [tokens](tokens.md#css-custom-properties)),
a new `table/` folder for props, `apps/web/static/fonts/codenames/`, and
`apps/web/src/routes/room/[id]/+page.svelte`.

### Assets

- Bundle original generated `wood`, `foliage`, `mug`, `coaster`, `notepad` and `books`
  WebP assets in `games/codenames/src/table/`; props preserve alpha. No runtime generation.
- Keep wood and each prop separate; omit props below the specified breakpoints.
- Remove obsolete `table-wood.svg` and `Portrait.svelte` after their imports are removed.
- `paper.svg` already exists in `games/codenames/src/`. It is identical.
- Self-host Archivo (variable WOFF2, OFL, README with provenance and glyph check),
  following `apps/web/static/fonts/azul/`.
- Props are `<img alt="" aria-hidden="true">` with `pointer-events: none`. They are
  never measured and never focusable.

### Composition (≥ 1280 × 760)

Regions and sizes follow [tokens → geometry](tokens.md#geometry-at-1440900). The
screen is a fixed viewport, like the current `.cn-table`, with no page scroll.

1. **Header** (replaces the corner controls):
   - Clover logo + `m.cn_title()`.
   - Nav:
     - **Play**: current view, `aria-current="page"`, not a link elsewhere.
     - **How to Play**: opens the existing `Rulebook` dialog panel.
     - **About**: opens a dialog with `m.cn_description()` and the `m.cn_sources()` links.
   - Right side:
     - Room code with an invite button, from new optional props.
     - Seats `players.length / maxPlayers` (8, from the game definition).
     - Viewer avatar initials, name and connection state.
     - Gear, which opens the existing Settings panel.
   - Practice shows `m.cn_practice()` instead of room/invite.
   - Keep the `settingsContent` snippet: back link, language, rematch.
   - The global rule hiding `.site-header` stays.
2. **Team row**:
   - Red and blue panels show `remaining[team]` and the "agents remaining" caption.
     The starting team is marked in Settings as today.
   - Centre banner by phase and viewer:
     - `setup`: the existing setup panel replaces the whole table body, restyled with glass tokens.
     - `clue`, active spymaster: "Round N", pill "{Team}'s Turn", inline clue composer.
       - Word input, count select 0–9/∞, Give clue button, all at least 44 px.
       - The composer expands the banner, or opens a dialog when the banner is too narrow.
     - `clue`, anyone else: "Round N", pill, "Waiting for {team} spymaster's clue".
     - `guessing`: "Round N", pill, "{CLUE} · {count}" and "{n} guesses left" or "Unlimited guesses".
       - Active operatives also get **End turn**, disabled until `used ≥ 1`, with the reason given.
     - `finished`: winner pill in the winning team's fill. The result overlay stays.
3. **Word grid**: 5×5 paper cards with the tilt from tokens.
   - Keep `data-card`, `data-identity` (only when known), `aria-pressed` and the
     select → confirm dialog, and the deal and reveal animations from accepted events.
   - Only active-team operatives in `guessing` can select. For everyone else, cards
     are `disabled` with an accessible reason.
   - Revealed cards use the solid red/blue/assassin/civilian fills from tokens, with
     the word centred. `Board.svelte` is the only importer of `Portrait.svelte`, so
     delete it and its references once the grid stops using it.
   - Spymaster Mode on: unrevealed cards show a tinted key treatment. Keep the
     current colour-plus-symbol marks (`◆ ● ○ ×` shapes as SVG) so colour is never
     the only cue.
4. **Players panel**: every seat grouped by team, with a team dot, name, "(Spymaster)"
   and "(You)", plus disconnected/reserved state.
   - Operatives and unassigned viewers: the panel spans both bottom columns.
5. **Spymaster panel** (spymasters only, and everyone in `finished` with the public key):
   - Eye icon, "Spymaster Mode" switch (`role="switch"`, stored in the existing
     `codenames:preferences` localStorage key).
   - 5×5 mini key from `view.private.key`, with the two-line caption.
6. **Clue History**:
   - Newest first.
   - The header shows the current round.
   - Each record shows team dot, team label, clue word, count chip ("∞" for unlimited)
     and "Round N" (except the current one).
   - Then its guesses.
   - Empty state before the first clue: one quiet line.

#### Clue history styling

| Guess identity  | Style                                          |
| --------------- | ---------------------------------------------- |
| Clue team's own | `--cn-success` word + check icon               |
| Civilian        | `--cn-text-3` word, no icon                    |
| Opposing team   | Opposing team label colour word, no icon       |
| Assassin        | `--cn-text` word on a `--cn-key-assassin` chip |

Every style must also carry a text/ARIA reason, so colour is not the only signal.

### Motion and audio

Keep `effects.ts` and the `eventGate` discontinuity rules. New motion is driven only
by accepted `clueSubmitted` and `turnEnded` events:

- A new history row slides in.
- The banner pill crossfades.
- At most 240 ms.
- Nothing moves with reduced motion.

No new sounds.

### Localisation

Add every string in `packages/shared/messages/en.json` and `es.json` in the same change.
Expected keys (reuse existing ones where they fit: `cn_word`, `cn_count`, `cn_remaining`,
`cn_rules`, `cn_settings`, `cn_title`, `cn_description`, `cn_sources`, `cn_offline`, `cn_practice`):

`cn_nav_play`, `cn_nav_how`, `cn_nav_about`, `cn_room`, `cn_seats`, `cn_online`,
`cn_round`, `cn_team_turn`, `cn_give_clue`, `cn_give_clue_hint` ("Give a clue. Your
team will guess."), `cn_wait_clue`, `cn_guesses_left`, `cn_guesses_unlimited`, `cn_end_turn`,
`cn_end_turn_first`, `cn_clue_history`, `cn_history_empty`, `cn_players_count`,
`cn_you`, `cn_spymaster_mode`, `cn_key_caption_1`, `cn_key_caption_2`, `cn_agents_remaining`,
`cn_event_clue`, `cn_event_turn`.

Spanish must be natural, not literal. Long Spanish words must fit the header,
banner and cards at every breakpoint.

## 4. Compact layouts

There is no mockup for these. Build from this written specification, which takes
precedence over extrapolating the desktop frame. The main screen **never scrolls**
at 1440×900, 1280×720, 768×1024, 390×844, 360×640 or 320×568. Every target is at
least 44 px, safe areas are respected, and 200% text keeps every action reachable
(dialogs may scroll internally).

| Width × height            | Layout                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ≥ 1280 × 760              | Full composition, props visible                                                                                                                                                                                                                                                                                                                                                                      |
| 900–1279, or height < 760 | Props hidden except the wood.<br>Clue History moves behind a header "History" button (dialog).<br>Team row, grid and bottom panels scale with `clamp()`.                                                                                                                                                                                                                                             |
| < 900 wide                | Condensed header: logo, room/practice pill, History, Players, Key (spymasters), gear.<br>One-row team strip: red count · turn pill · blue count.<br>5×5 grid fills the width.<br>A sticky action bar below the grid holds the clue composer, or clue + guesses left + End turn.<br>Players, key and history open as dialogs.<br>No grid tilt. Card words follow the compact contrast rule in tokens. |

## 5. Tests and evidence

- Unit (`games/codenames/src/index.test.ts`):
  - Deal and turn start.
  - Clue validation and normalisation.
  - Budget: count + 1, zero and unlimited.
  - Mandatory first guess before End turn.
  - Civilian, opponent and exhausted-budget handoffs.
  - Assassin loss for the active team.
  - Last-agent wins, including an opponent's last agent.
  - `clueHistory` contents.
  - Wrong actor or phase rejects without mutation.
  - Metamorphic privacy.
  - Presentation gate with the new events.
- Server: `apps/server/src/codenames-socket.test.ts` as in milestone 2.

Report any check you could not run as unverified. Physical Safari/iOS, real-device
touch and audio, and fluent Spanish review stay unverified until someone does them.

## Out of scope

- Chat.
- Clue review, penalties and clue-legality enforcement.
- Timers, bots and spectators.
- New sounds.
- Catalog or global typography changes.
- Any change to other games.
