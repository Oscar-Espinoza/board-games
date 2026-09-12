# ADR 016: Sushi Go Party's physical cards and simultaneous draft

Status: accepted for implementation, September 12, 2026.

Sushi Go Party introduces simultaneous private commitments and resumable special
choices to the existing small game contract. The standard box remains game-owned;
there is no generic drafting engine or generic catalog configuration framework.

Physical identity is separate from played appearance. Copies and boxes transform
appearances, while every physical ID remains in exactly one authoritative zone.
Round transitions recombine actual cards rather than rebuilding a manifest.
Recipient hand handles rotate on every pass and ownership-changing exchange.

A full primary batch reveals atomically. One numeric-priority effect queue runs
until the next genuine actor choice. Menu offers are saved once; Spoon searches
for suppliers authoritatively. Miso keeps a whole-turn collision ledger and
Uramaki records consumed awards and immediate scoring separately from round-end
deltas. The explicitly disclosed edge conventions are in
[game rules](../games/sushi-go-party.md).

Socket identity, match epochs, revision checks and deduplication remain shared.
Presence is supplied through the existing game hook. Only PICK and READY qualify
for the coordinator's bounded stale-retry guard. Game-owned menu changes and
special responses require explicit fresh review after a stale reply.

The board owns its complete dining-table presentation and corner help/settings.
It receives a settings snippet for room controls. Typed, public-only events feed
cosmetic motion; the sequence cursor snaps on reconnect, gaps and match changes.
Animations and audio never gate server rules. The local practice module is a
separate import and has no multiplayer endpoint.
