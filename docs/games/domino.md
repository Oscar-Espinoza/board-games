# Dominó (Venezuelan pairs)

Double-six dominoes for exactly four players in two fixed pairs. Partners sit
across the table: team A is seats 1 and 3, team B is seats 2 and 4. Team names start as
"Nosotros" / "Ellos" and any player can rename either one from the chalkboard.

## Rules

- 28 tiles, 7 per player, no boneyard. Play passes counterclockwise (to your right).
- **Lead:** the holder of 6|6 opens the first hand and must play it. Each later hand is
  opened by the next seat after the previous leader, with any tile. This rotating lead
  is an app convention.
- **Turn:** play one tile on either open end. Passing is legal only when no tile fits.
- **Domino:** the player who goes out ends the hand; their team scores every pip left in
  all hands.
- **Tranque:** when nobody can play, the team with the lower pip total scores all
  remaining pips. A tie scores nothing.
- First team to **100** wins the match. After a hand, any player starts the next one
  so everyone can inspect the revealed hands first.

## Table

`Board.svelte` owns state, sound and HTML overlays; `three/` draws the table with
three.js (loaded lazily, disposed on unmount):

- `scene.ts`: renderer, warm spot and fill lights, the painted patio (`patio.webp`) as
  a far plane, the camera arc from seated (21°) to overhead (86°) fitted to the screen
  width, tweens and the table shake. It renders only while something moves.
- `table.ts`: the carved table in tile units (a tile is 1 × 2 × 0.42): leather top at
  y = 0, rails with cup holders and side slots, a low front trough for your rack and a
  lower deck for the Pass plaque and the strength gauge. Wood and leather are tiled `wood.webp` /
  `leather.webp`.
- `tile.ts` / `textures.ts`: rounded ivory tiles with canvas-drawn glossy black pips
  and divider (bump and roughness maps); carved plaque faces with the Marcellus font.
- `props.ts`: a Polar beer bottle (generated `beer-label` / `beer-neck` art), a lime
  drink on the right deck and a bowl of chips.

Name plaques: your partner's leans on the far rail, the side players' stand on their
rails in front of their tiles (the front lip's corners on portrait screens), never on
the leather. Pips and the divider have zero specular intensity, so they stay pure
black under any light or angle.

**Mobile.** Below 720px wide or 520px tall the board switches to a compact layout. The
3D view is a straight-down look at the chain that eases to fit the tiles (rolled 90° on
portrait screens so the chain runs down the screen); layout and poses are shared state, so
only the camera changes. Your hand is a row of HTML tiles in a low bottom bar, with small Pass and Tidy up pills
beside the status line. The other seats are chips labelled Before you / Partner / Next,
with a team dot matching the chalkboard colours, their tile count and a glow on whoever
is to move.
Tapping a ghost plays soft; holding it fills a gauge in the bar. Touch devices with small
screens also render a lite table: pixel ratio at most 1.5, 1024 shadows, standard
materials, and no patio plane or props (the beer labels are never downloaded).

**Loading.** `gameClients.domino` also calls `preload()` (`src/preload.ts`), which starts
the three.js chunk and preloads the art and plaque font in parallel with the board's own
code. `Loading.svelte` covers the table until all textures (tracked by one
`THREE.LoadingManager`), the font and `renderer.compileAsync` are done, so the first
frame never stalls or pops in untextured; its tiles stand up one by one with progress.
When it lifts, the hands deal in: your rack tiles drop into the trough one after
another and the rails fill. Art is kept small (about 280 KB in total).

Every pressable object (rack tiles, end ghosts, Pass, Tidy up) gets a transparent
HTML `<button>` over its projected screen rectangle, so mouse, touch and keyboard all
use real buttons (44px minimum where tiles don't overlap). The camera slider (and mouse
wheel) is remembered in `domino:camera`; portrait screens start higher and crop the
outer rails.

Selecting a tile lifts it (no outline). Ghost tiles show exactly where it will land on
each end it fits. Pressing a ghost plays the tile there: a quick tap is a soft play,
and holding fills the gauge on the right deck from soft to hard; the release sends
`force` (0–1). There is no separate Play button.

**Poses.** `public.poses` holds where every tile on the table actually rests.
`layout.ts` computes the tidy snake (lead in the centre, doubles crosswise, L-bends at
the rails; adding a tile never moves the others). A new tile is placed with `plug()`:
the tidy offset from its neighbour, applied to the neighbour's _current_ pose, so it
always sits flush against the end tile even after a slam moved or turned it. Above
force 0.55 the server jitters nearby poses (bounded around their tidy spots) and pushes
overlapping tiles apart; **Tidy up** (`ARRANGE`) resets every pose to the tidy snake.
The geometry is pure and reusable by a future 8-bit board.

`/practice/domino` runs the rules locally with four seats and switches the view to
whoever is to move after every accepted action.

## Invariants

- `view()` sends only the viewer's own hand and legal actions; other hands appear
  only in `result.hands` once a hand has ended.
- Poses are cosmetic public state. They never affect legality or scoring.
- A tile is always placed relative to its neighbour's current pose (`plug`), and the
  board's ghost uses the same function, so the preview matches the landing.
- Rejected actions throw before cloning; unknown fields are rejected.
- `RENAME_TEAM` accepts 1–16 characters after trimming, from any seat, at any time.
- Sound and shake run only across consecutive revisions via `RevisionGate`; the first
  update after mounting snaps tiles into place instead of animating them.

## Art

Generated on September 23, 2026 with the Codex CLI's image tool, passing Oscar's
reference mock-up as the style image (the same workflow as
[pixel-store](../pixel-store.md)). `wood` and `leather` were resized to 1024², made
seamless by cross-fading with a half-offset copy (Pillow), and every image was converted
with `cwebp -q 80`. The pixel box used an existing store box as reference and was keyed
with `docs/carcassonne-3d/key-sprites.py … 256`. No image may contain text, logos,
people, hands or domino tiles.

- **wood** — "A perfectly flat, straight-down, evenly lit photo texture of old
  dark-brown rustic hardwood, like the table rails in the reference: visible grain,
  small dents, scratches, worn edges of varnish, warm brown. Seamless tileable, no
  perspective, no shadows, no vignette."
- **leather** — "A perfectly flat, straight-down, evenly lit photo texture of the
  reference's play surface: worn tan-brown leather / suede with subtle scuffs, circular
  wear marks and mottled patina. Seamless tileable, no perspective, no shadows."
- **patio** (16:9) — "The background of the reference scene without the table and
  without people: a cozy Caribbean patio at night seen from a seated person's eye level,
  looking slightly down. Left: potted tropical plants, a standing electric fan, wooden
  chairs, warm wall. Right: palms, a hammock, a railing, potted plants, and city lights
  on distant hills under a deep blue night sky. Warm string lights and lanterns. Slight
  depth-of-field blur. The lower 40% is a dark, softly blurred tiled patio floor."
- **pixel box** — the existing box prompt with: `domino — title "DOMINO": dark wood-brown
box with warm yellow accents, ivory domino tiles in an L-shaped chain on a wooden table,
a small palm tree silhouette at night.`
