# ADR 023: Little Secret tabletop and public clue slips

Status: Accepted · September 22, 2026

## Presentation

Finish the existing Little Secret redesign in the shared room/practice board.
Locally bundled desk and paper WebP materials and the OFL-licensed Kalam font
support live Svelte controls, brass initial tokens, clue slips and case notes.
Gameplay information is real text; the desk artwork contains only scenery.

Desktop seats use game-owned perimeter positions, with actions in the centre and
notes to the right. The desktop table fits the viewport. Below 1100px wide or
700px high, actions precede a two-column seat layout on a scrolling teal table;
peripheral desk scenery is omitted. Long clues and desktop panels support keyboard
scrolling. Rules and settings remain in the corners.

Only accepted consecutive public ballot events automatically open vote review.
The player dismisses that local review to continue the current authoritative
phase, and may reopen an already revealed vote from case notes. Reloads,
reconnects, hidden tabs and seat changes do not replay the reveal. Mission and
match results render actual rewards, factions and tied winners.

## Clue contract

The existing `clue` intention now includes `text` for every speaker except Mime.
The server requires a string containing 1–80 JavaScript string units after
trimming and accepts it only for the current speaker, mission and cycle. It
publishes the accepted text in `public.clues`, keyed by player ID. Mime confirms
without text and publishes an empty string, rendered as a localized performance
label. Elder may enter two words. Semantic clue legality remains socially enforced.

Clues survive debate, voting and reactions, then clear at the next cycle or
mission. Projections are detached. This public ledger does not change private
factions, production pack isolation, sealed commitments, reaction ownership or
retry rules from ADR 014. Clue submissions never retry automatically.

There is no persistent-state migration: rooms remain in memory. Deploy server
and client together; older clients that submit textless non-Mime clues must reload.

## Validation

Cover validation and clearing in pure rules tests, preserve socket privacy and
complete-match checks, and exercise actual clue entry and ballot review in the
3- and 9-seat browser matches. Check long clues, viewport boundaries and control
access in Chromium and WebKit. Physical Safari validation remains separate.
