# Sushi Go Party!

Pure TypeScript rules, a full standard-box manifest, every legal menu, and a lazy
Svelte dining table. See [implemented rules and conventions](../../docs/games/sushi-go-party.md)
and [ADR 016](../../docs/adr/016-sushi-go-party.md).

Run `bun test games/sushi-go-party apps/server/src/sushi-go-party.test.ts` for
scoring, full seeded matches, advanced effects, conservation and socket privacy.
Browser coverage lives in `tests/e2e/sushi-go-party.spec.ts`. The separate practice
route exercises the same rules without adding fixtures to multiplayer rooms.
