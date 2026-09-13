# ADR 019: Codenames table with authoritative turns

Status: accepted, 2026-09-13.

The accepted [table migration](../codenames-redesign/README.md) restores stored
clues and turn enforcement. This supersedes ADR 018's voice-only turn model,
either-team reveals, grid-only surface and revealed portraits. It does not restore
ADR 015's clue review, penalties or agreement options: groups judge legality aloud.

Phases are setup, clue, guessing and finished. Only the active spymaster submits
a clue; only active-team operatives guess or end a turn, after at least one guess.
Finite clues permit count + 1 guesses; zero and unlimited have no numerical limit.
Civilian/opponent reveals and exhausted budgets hand off. Last-agent and assassin
results finish immediately. Public history records only revealed identities.

Keep 4–8 seats, versioned unanimous readiness, fixed board language, 9/8/7/1 deal,
private spymaster keys, authenticated actors, reserved roles, host rematches and
public-index-only presentation variation. An absent required actor blocks their
actions; hosts cannot substitute. Reconnects cancel selection and effects. Only
unchanged setup readiness may retry; clues, guesses and end-turn never retry.
Client and server must ship together because this changes the gameplay protocol.

The header, team panels, turn banner, history, players and key follow the migration.
The realistic reference (`images/reference.webp`, Image #2 in the approved direction)
takes precedence for materials and lighting. Original generated WebP wood and
transparent props are an explicit exception to CSS/SVG-only visuals. Generate at
development time only, bundle locally with provenance, and bake no interface text,
game information, slogans or branding into art. Cards and controls remain Svelte/CSS;
revealed cards retain coloured paper word faces. No chat or new runtime dependencies.

Self-host Archivo, retain contrast corrections, hide props on compact screens,
keep a fixed viewport and accessible internal-scrolling dialogs. Existing audio
remains gesture-unlocked; no sounds are added. Accepted events alone drive motion,
and reduced motion suppresses it. Browser evidence lives in
[table-redesign](../evidence/codenames/table-redesign/README.md); physical Safari
validation must be recorded separately from WebKit automation.
