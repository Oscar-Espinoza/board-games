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

`Board.svelte` draws a painted patio (`patio.webp`) and an overhead table photo
(`table-top.webp`) on a CSS 3D plane. The camera slider (and mouse wheel) moves from
the seated view to overhead and is remembered in `domino:camera`. Tiles are CSS/SVG.
Name plaques sit on the rails; opponents' tiles stand in the rail grooves as backs.

Selecting a tile lifts it (no outline). When it fits both ends, faint spots on the
table pick the end. **Play tile** is press-and-hold: the meter goes from soft to hard
and the release sends `force` (0–1). Above 0.55 the server nudges nearby tiles with the
injected random source; **Tidy up** (`ARRANGE`) clears the offsets for everyone.

`layout.ts` turns the chain into positions (lead in the centre, doubles crosswise,
L-bends at the rails). It is pure and reusable by a future 8-bit board, which will
have its own UI but the same rules and geometry.

`/practice/domino` runs the rules locally with four seats and switches the view to
whoever is to move after every accepted action.

## Invariants

- `view()` sends only the viewer's own hand and legal actions; other hands appear
  only in `result.hands` once a hand has ended.
- Offsets are cosmetic public state. They never affect legality or scoring.
- Rejected actions throw before cloning; unknown fields are rejected.
- `RENAME_TEAM` accepts 1–16 characters after trimming, from any seat, at any time.
- Effects (sound, drop, shake) run only across consecutive revisions via `RevisionGate`.

## Art

Generated on September 23, 2026 with the Codex CLI's image tool, using Oscar's reference
mock-up for style (the same workflow as [pixel-store](../pixel-store.md)), then converted
with `cwebp -q 80` (`table-top` resized to 1024²). The pixel box used an existing store
box as reference and was keyed with `docs/carcassonne-3d/key-sprites.py … 256`.

- **patio** — "A cozy Caribbean patio at night seen from a seated person's eye level,
  shallow depth of field: palms, potted plants, string lights and lanterns, a hammock,
  city lights on distant hills. Lower third a dark empty area. No text, signs, logos,
  people, hands or domino tiles."
- **table-top** — "A perfectly straight-down photo of an empty square wooden domino
  table filling the frame: carved dark hardwood rails, four round cup holders in the
  corners, a narrow tile groove along each rail, worn warm brown leather surface. No
  text, no perspective."
- **pixel box** — the existing box prompt with: `domino — title "DOMINO": dark wood-brown
box with warm yellow accents, ivory domino tiles in an L-shaped chain on a wooden table,
a small palm tree silhouette at night.`
