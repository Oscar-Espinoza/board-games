# ADR 021: Sushi Go Party illustrated table

Date: 2026-09-15. Status: accepted.

## Decision

Migrate the approved desktop prototype into
the existing production `Board.svelte`. This supersedes the visual arrangement
in ADR 016, not its rules, privacy, action, audio or presentation contracts.

The 1440×900 desktop stage uses the approved seaweed tabletop, ivory trays,
eight illustrated rule tiles, perimeter score track, colored pawns, fanned
private hand and coral primary action. CSS/SVG and the original food art remain
game-owned. Rules and settings are always available through corner buttons;
each printed menu tile also opens its searchable rule entry. Room settings
continue through the existing `settingsContent` snippet.

Shared visual primitives live in `games/sushi-go-party/src/table/`. Production
adapters supply localized text and public/private view data. The archived
prototype imports these primitives but owns its separate fixture and static
controls. Production never imports the prototype fixture.

## Behavioral boundaries

- Scores, hand counts, commitments, tableaus and menus come from recipient views.
  Private opponent faces are never passed to visual components. Stable pawn
  colors follow canonical seat order; local-relative desktop seats run clockwise.
- The score track loops at 60; exact scores stay visible on player trays. Tied
  score pawns fan out so they remain identifiable.
- Accepted public reveal events settle cards into their actual tableaus. Accepted
  pass edges animate count-only backs between measured seat anchors. Reconnects,
  sequence gaps, hidden documents, resize and preference changes retain the
  existing cancellation/no-replay behavior. Decorative arrows submit no actions.
- All 26 card types, 2–8-player menus, actor-only special prompts, utensil choices,
  setup, scoring, rematches, keyboard controls and guarded stale retries remain.
- The illustrated stage scales at desktop sizes (at least 1100×680). Smaller
  screens retain the usable compact arrangement with updated cards and controls;
  the whole game table does not scroll, but compact hands and public trays can.
- English and Spanish production copy is supplied by Paraglide, including compact
  rule summaries with player-count exceptions.

## Practice and verification

The default `/practice/sushi-go-party` scene is a conserved, deterministic
five-player midgame produced through the real engine, not injected production
state. Its local advance control delivers each accepted revision individually
so presentation sees the same contiguous sequence as a live room.

See the [migration handoff](../sushi-go-party-redesign.md) for component mapping,
screenshots and verification. Real Safari-device validation remains separate
from automated WebKit checks.
