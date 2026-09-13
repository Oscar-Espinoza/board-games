# Azul Table Light

Table Light keeps a walnut surface, circular factories, loose centre tiles, miniature opponent boards and a score rail. The corrected design is implemented in the game-owned presentation layer. Rules, projections, actions, accepted events, networking and retry policy are unchanged; see [ADR 017](../adr/017-azul-table-light.md).

![Table Light design study](images/table-light-desktop.webp)

This is a design mockup, not browser evidence. The corrected written specification takes precedence: existing corner controls stay in place, “in hand” is an uncommitted selection preview, and the main screen must fit without scrolling. Desktop places supply and the playable board side by side under a row containing every opponent. Compact screens use colour and destination dialogs while retaining an inspectable local overview.

| Document                      | Purpose                                              |
| ----------------------------- | ---------------------------------------------------- |
| [Migration](migration.md)     | Dependent implementation milestones and verification |
| [Tokens](tokens.md)           | Materials, fonts, palette and contrast               |
| [Components](components.md)   | Board, supply and inspection contracts               |
| [Motion](motion.md)           | Accepted-event timeline and cancellation             |
| [Mobile](mobile.md)           | Viewport fit, picker, geometry and safe areas        |
| [Screenshots](screenshots.md) | Preserved before-images and actual after-evidence    |
| [Mockups](images/README.md)   | Design studies, separately labelled                  |
