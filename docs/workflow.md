# Workflow

Side project, optimized for speed of change and of the shipped app.

- **No tests, screenshots or evidence records.** Don't add test suites, Playwright or validation docs.
- After a change: `bun run check` (Svelte + TypeScript) and `bun run build`. `bun run format` before committing. For risky UI changes, load the affected `/practice/<game>` route in a browser and watch the console.
- Commit only when asked. Keep unrelated work intact.

## Shared building blocks

Reuse these before writing new plumbing:

| Need                                                   | Use                                                                        |
| ------------------------------------------------------ | -------------------------------------------------------------------------- |
| Web Audio cues (gesture unlock, tones, filtered noise) | `createAudio()` — `@board-games/shared/ui`                                 |
| Safe localStorage                                      | `read` / `readJson` / `write` — `@board-games/shared/ui`                   |
| Presentation gating (no replay on reconnect)           | `RevisionGate`, `eventGate()` — `@board-games/shared/ui`                   |
| `<dialog>` open/close + focus return                   | `{@attach modal(() => open)}` — `@board-games/shared/ui`                   |
| Reduced motion                                         | `prefersReducedMotion` from `svelte/motion`                                |
| Seeded RNG / shuffles                                  | `seeded`, `shuffle`, `shuffled` — `@board-games/game-core`                 |
| In-game rules                                          | pass `rulesContent` → `$lib/catalog/Rulebook.svelte`                       |
| Board props from any host                              | `BoardProps<View, Action>` — `@board-games/shared/ui`                      |
| Sound / volume / motion settings per viewer            | `viewerPreferences(game, defaults)` — `@board-games/shared/ui`             |
| Lazy 8-bit skin                                        | `new ViewerSkin(game, load)` — `@board-games/shared/ui`                    |
| 8-bit tones                                            | `chipNote(audio)`, `playChiptune` — `@board-games/shared/ui/pixel`         |
| Rule rejections and message-by-key                     | throw a message key; `errorText()`, `message()` — `@board-games/shared/ui` |
| Practice route                                         | `PracticeTable` + `$lib/practice/Practice.svelte`                          |
| Game identity and seat limits                          | `games`, `seats(id)` — `@board-games/shared/games`                         |

## Svelte conventions

Svelte 5 runes only (`compilerOptions.runes` is enforced). Prefer `$derived` over `$effect`; effects are for DOM/audio/network side effects. Move `.filter`/`.sort` out of templates into `$derived`. Keep animations to `transform`/`opacity` and avoid per-element CSS `filter` on large lists.

## Adding a game

See [architecture › Adding a game](architecture.md#adding-a-game). Register the server definition in `apps/server/src/index.ts`, the game's `./client` entry in `apps/web/src/lib/games.ts`, its identity in `packages/shared/src/games.ts` and catalog description in `packages/shared`, messages in `packages/shared/messages/{en,es}.json`, and write `docs/games/<id>.md` with an **Invariants** section.
