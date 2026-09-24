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

The board comes in two looks over the same state: the three.js patio (**3D**) and a
pixel-art one (**8-bit**). `Board.svelte` is a thin shell: it creates one `DominoGame`
(`game.svelte.ts`: seats, selection, ghosts, the strength charge, preferences, team
names and the revision-gated event feed), renders the shared chrome in `Hud.svelte`
(corner buttons, chalkboard, result panel, settings and rules dialogs, phone seat
chips) and lazy-loads the table for the chosen look. Each look brings its own sound
pack (`Sounds`) and subscribes to accepted plays and passes with `game.on()`.

The look is `lookOf()` (`look.ts`): the player's saved `domino:look`, otherwise 8-bit
when the home page uses the 8-bit theme. **Table** in Settings switches it live. It is
per player, so one room can mix looks.

### 3D

`three/Table3D.svelte` owns the canvas, hit areas, camera control and phone hand bar;
`three/` draws the table with three.js (loaded lazily, disposed on unmount):

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

### 8-bit

`pixel/PixelTable.svelte` lays real buttons, name tags, Tidy up and the status bubble
(which grows a Pass button only when nothing fits) over `pixel/scene.ts`, a Canvas 2D renderer. Everything is drawn in logical pixels (a
layout unit is 12 px, so a tile is 12×24) and scaled up with nearest-neighbour
sampling at the device's resolution; desktop scales snap to quarter steps so the whole
table and its seats fit. Layout poses map straight to pixels, and slammed tiles rotate
with their jagged pixel edges. The 8-bit chunk never imports three.js.

- `pixel/sprites.ts` draws tiles (ivory, ink outline, pure black 2×2 pips from the
  shared `spots.ts`), standing tile backs, the table (dithered leather, planked rails,
  cup holders, front apron) and a small Polar-style bottle procedurally, and recolours
  character shirts.
- Characters belong to game seats (Luis, María, Carlos, Roberto for seats 1–4), drawn
  from the front across the table and in profile at the sides (mirrored on the right).
  Your pair wears green and the rivals red, recoloured at load. Each sheet has six
  frames: idle, think (their turn), raise and slam (a play), knock (a pass, the
  Venezuelan table knock) and cheer (a won hand); the winning pair cheers when a hand
  ends. Side sheets are full-body and seated on a
  wooden chair, and nothing overlaps the table: side players sit beside it with their knees just short
  of the edge and only their arms reach over the rail; the partner (front sheets stop
  at the waist) sits behind the far rail, drawn before the table so it hides his waist.
- Juice, all off with reduced motion: played tiles arc from the player's hand to their
  pose with a drop shadow, a hard slam adds a pixel dust puff, an 80 ms hit-stop and a
  stepped screen shake, jittered neighbours hop, Tidy up glides tiles home one after another along the chain,
  and a banner with the hand's result (Domino / Tranque) drops before the scores. The string lights on
  the patio twinkle and the cat breathes.
- `pixel/sound.ts` is a chiptune pack from `createAudio` square and triangle tones plus
  noise: select blip, soft tick, slam crunch, the double knock, a turn ping, and a
  win, loss or tie jingle.
- Phones use the same compact rules as 3D: no characters (and their sheets are never
  downloaded), a camera that eases to fit the chain (rolled 90° on portrait screens),
  your rack in screen space along the bottom and a status / Tidy up bar above it, with
  Pass beside the status when you are blocked. The pixel skin in `Hud.svelte` turns the shared chrome into Pixelify Sans panels
  with hard ink borders; on desktop the chalkboard moves under Rules to keep the
  partner's seat clear.

8-bit art is about 150 KB (phones load only the ~95 KB patio and cat).

## Invariants

- `view()` sends only the viewer's own hand and legal actions; other hands appear
  only in `result.hands` once a hand has ended.
- Poses are cosmetic public state. They never affect legality or scoring.
- A tile is always placed relative to its neighbour's current pose (`plug`), and the
  board's ghost uses the same function, so the preview matches the landing.
- Rejected actions throw before cloning; unknown fields are rejected.
- `RENAME_TEAM` accepts 1–16 characters after trimming, from any seat, at any time.
- Sound, shake and table events run only across consecutive revisions via
  `RevisionGate`, and only when `last` changed: Tidy up or a rename never replays the
  previous play. The first
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
- **8-bit table** — generated on September 23, 2026 with the same tool, using the
  pixel store (`store.webp`) as the style image, then reduced to true low resolution
  with `docs/domino-pixel/pixelate.py` (box downsample, 64-colour palette, hard alpha;
  sheets are cut from a 3×2 grid and aligned on each frame's lower body):

  ```sh
  python3 docs/domino-pixel/pixelate.py image raw/patio.png pixel/patio.webp 704 396
  python3 docs/domino-pixel/pixelate.py sheet raw/<who>-front.png pixel/<who>-front.webp 3 2 72 64
  python3 docs/domino-pixel/pixelate.py sheet raw/seated-<who>.png pixel/<who>-side.webp 3 2 112 160 chair
  python3 docs/domino-pixel/pixelate.py sheet raw/cat.png pixel/cat.webp 2 1 26 32
  ```

  - **patio** (16:9, with the Venezuelan mood photo as a second reference) — "a cozy
    Caribbean (Venezuelan) house patio at NIGHT, seen from ABOVE at a 3/4 top-down
    angle like a classic 16-bit RPG town map … The whole CENTER … is EMPTY open floor:
    warm terracotta patio tiles … Top edge: the back wall of the house (a wooden door
    with warm light, a barred window), a string of warm light bulbs, a hanging hammock
    … Left edge: potted tropical plants, a standing electric fan, a wooden rocking
    chair. Right edge: a small palm tree in a big pot, a low wall railing, a plastic
    beer crate with brown bottles (no text, no logo). NO people, NO animals, NO text."
  - **characters** (a previous sheet as the character reference) — "ONE sprite sheet …
    <character>, wearing a PLAIN SOLID BRIGHT GREEN t-shirt … seen from the FRONT /
    in SIDE VIEW (profile) FACING RIGHT, from a slightly high 3/4 top-down game
    camera, shown only from the WAIST UP … exactly 6 frames in a grid of 3 columns x
    2 rows … the SAME waist baseline … 1. idle, 2. think (hand on chin), 3. raise (arm
    high holding one small ivory domino tile), 4. slam (hand slammed down low), 5.
    knock (a fist knocking the table, passing), 6. cheer (both arms raised)." Side
    sheets were regenerated from the waist-up ones as "FULL BODY, SITTING on a simple
    dark-brown wooden chair with a straight tall back … thighs horizontal pointing
    right, knees bent, lower legs going straight down … The chair and the whole lower
    body are IDENTICAL and do not move in all 6 frames", aligned on the chair's back
    leg (`chair` anchor) and quantized to 160 colours so grey hair stays grey. Luis: a
    young man with a backwards white cap and a thin beard; María: a woman with big
    curly hair, a red scrunchie and gold hoops; Carlos: a bald man with round glasses,
    a short grey beard and a gold chain; Roberto: an older man with a grey moustache
    and a brown flat cap.
  - **cat** — "a black-and-white cat curled up asleep … 2 frames side by side".

  Codex sometimes returns a transparent background instead of magenta; the script
  keeps existing alpha.

- **pixel box** — the existing box prompt with: `domino — title "DOMINO": dark wood-brown
box with warm yellow accents, ivory domino tiles in an L-shaped chain on a wooden table,
a small palm tree silhouette at night.`
