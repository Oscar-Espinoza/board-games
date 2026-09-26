# Working with Jev: Codenames guesser lab

Date: 2026-09-23 · Model: `jev-1.13.0` · Lab: `packages/jev-lab` · Log: [`packages/jev-lab/LOG.md`](../../packages/jev-lab/LOG.md)

**Verdict: worth building as a Codenames operative (guesser).** With careful clues it found our words 94–100% of the time on the first guess. Precision was 90–96% and recall of the intended words 87–90%. It never hit the assassin in 51 clue-turns (17 careful-clue boards × 3 board orders). Each turn costs two calls, about 0.75 s and $0.0002. The ceiling is set by **clue quality and code-owned stopping**, not by prompt wording. Jev cannot give clues, so a Jev bot plays only the operative role: humans or an LLM give the clues, and Jev can vet them (see below).

## Run it

```sh
bun run lab:codenames                          # recommended setup: set arm, prompt v2, 25 boards
bun run lab:codenames --only fixed             # careful-spymaster clues
bun run lab:codenames --arm all --prompt v1 --bonus free --order b --note "…"
```

Options:

- `--arm set|noul|choice|all`
- `--prompt v1|v2`
- `--only <id|category>[,…]`
- `--order <seed>`: board order, used to measure position bias
- `--scorer noul|score`: what judges each card in step 1
- `--tau`
- `--bonus leftover|free`
- `--bonus-tau`
- `--note`
- `--quiet`

It must run from the repo root, so Bun loads `TYPESAFE_API_KEY` from `.env`.

Local training (`/practice/codenames`) plays the same guesser through the Bun server's `POST /api/codenames/guess`. That route is off unless the server starts with `JEV_LAB=1`, which lets anyone who reaches the origin spend the key; see [deployment](../deployment.md).

Each run does three things, and records spend: calls, tokens and cost per turn, plus the running lab total.

- Prints one line per scenario: guesses, with ✓ for ours, ✗opp, ✗civ and ☠ for the assassin, plus the top 5 probabilities and the assassin's rank.
- Writes raw per-card judgments to `packages/jev-lab/runs/*.jsonl`. These are gitignored.
- Appends a row to `LOG.md`.

To add a position, add a draft to `src/codenames/scenarios.ts`. Adding a prompt means adding a version to `src/codenames/prompts.ts`.

## Setup

- **Scenarios.** 25 hand-authored boards (23 scored plus 2 weak-clue boards), using this game's word pack (9/8/7/1). Categories: clean, assassin-trap, opponent-trap, polysemy, compound, leftover (bonus guess on an earlier clue), weak, and 3 Spanish. On top of those, 10 `fixed` boards repeat the failing boards with a clue a careful spymaster would give.
- **What Jev sees.** Only public information: clue, unrevealed words, revealed identities and clue history. It never sees the key. Code applies the engine's rules: the first guess is mandatory, and any card that isn't ours ends the turn.
- **Metrics.** They exclude the `weak` boards, where the only right play is one guess and stop. Precision is the share of guesses that were ours. Recall is the share of intended words guessed.
- **Noise floor.** Jev is **not deterministic**: identical requests moved first-guess accuracy 78% → 83%. Changing the board order moves results by 1–2 scenarios. Every change was therefore run on 2–3 board orders.

## Rounds (full 23-board set, including deliberately tricky clues)

| Round | Change                                                                     | First ✓ | Precision | Recall | ☠ per run | Opp per run |
| ----- | -------------------------------------------------------------------------- | ------- | --------- | ------ | --------- | ----------- |
| 0     | v1 "is related", engine budget count+1, Noul or Choice                     | 74–83%  | 64–69%    | 60–64% | 2–3       | 4–6         |
| 1     | **Code owns the bonus guess**: stop at `count`, +1 only for an old clue    | 78–83%  | 73–75%    | 60–64% | 0–1       | 2–4         |
| 2     | Prompt v2: "which words did the spymaster _mean_", naming compounds        | 78–87%  | 77–79%    | 53–68% | 0–1       | 2–4         |
| 3     | **Set arm**: Noul shortlist of 6 → one Choice over groups of `count` words | 87–96%  | 81–84%    | 72–77% | 0         | 3–4         |
| 5     | Leftover bonus guess only when Noul ≥ 0.8                                  | 83–91%  | 80–83%    | 68–72% | 0         | 3–4         |
| 4/5   | **Same boards, careful clues** (clean + fixed only)                        | 94–100% | 90–96%    | 87–90% | 0         | 1–2         |

The biggest gains came from code structure (rounds 1 and 3) and from better clues (round 4). Wording (round 2) helped the Choice arm a little and made the Noul arm more conservative.

## What worked

1. **Keep policy in code.** The worst errors in round 0 came from the "free" count+1 guess. After finding every intended word, both arms kept going into LIGHTNING☠ (rumble), SEAL☠ (stamp), SUITCASE (trunk) and MAGNET (polar). Jev almost never chose `stop` by itself. Capping at `count` removed most assassin hits with zero prompt work.
2. **Use the count as a constraint Jev can see.** Asking about one word at a time loses to a strong single association: PASTRY for "pie", SHADOW for "eclipse", GALAXY for "star". Asking _which group of `count` words_ the clue connects fixed most of these, because apple + cherry fits "pie" better than pastry + apple. The two-step approach worked well:
   1. Parallel Nouls rank every card in one call.
   2. One Choice picks among the combinations of the top 6.
3. **Noul for ranking and gating, Choice for deciding between explicit alternatives.** Noul probabilities were roughly calibrated against "intended" (v2, all runs):

   | Noul p  | Share that were intended | Assassins in bin |
   | ------- | ------------------------ | ---------------- |
   | 0.5–0.6 | 39%                      | 13               |
   | 0.7–0.8 | 69%                      | 2                |
   | 0.8–0.9 | 89%                      | 0                |
   | 0.9+    | 100%                     | 0                |

   Choice probabilities are relative, so the top option can sit at 0.25 on a good clue ("pod": whale 0.25, dolphin 0.21). Don't threshold them as if they were absolute.

4. **Gate optional risk high.** The leftover bonus sat around 0.5 (WAVE vs FISH vs BEACH for "ocean"), which is a coin flip. Requiring ≥ 0.8 stopped those guesses.
5. **Short, accurate criteria.** v2's criteria describe what a spymaster hint _is_ (a kind, part, use, famous pairing, compound or phrase). They are never about the specific board.

## Noul vs Score (tried 2026-09-23)

Same `set` setup, where only step 1 changes. Noul asks "did the spymaster mean this word?". Score rates the word on 4 levels: no connection, loose link, plausible, direct hint, normalized to 0–1. Each ran on 3 board orders.

| Scorer | Set        | First ✓ | Precision | Recall | ☠   | Opp | Tokens/turn | $ per 1k turns |
| ------ | ---------- | ------- | --------- | ------ | --- | --- | ----------- | -------------- |
| Noul   | full 23    | 83–96%  | 80–85%    | 68–77% | 0   | 2–4 | 3,909       | $0.164         |
| Score  | full 23    | 83–91%  | 80–86%    | 66–77% | 0   | 2–4 | 4,626       | $0.194         |
| Noul   | careful 17 | 94–100% | 93–97%    | 90–93% | 0   | 1   | 3,714       | $0.156         |
| Score  | careful 17 | 94–100% | 93–97%    | 90–93% | 0   | 1   | 4,420       | $0.186         |

- **Guessing quality came out about equal.** Step 2 (the group Choice) makes the final call, and the top 6 usually holds the right words either way. The two scorers built different shortlists on 13 of 17 boards and guessed differently on 5, but the totals landed at the same numbers.
- **Score is about 18% more expensive**, because four level descriptions are repeated for each of the 25 questions.
- **Score's scale is inflated, which makes it unsafe for thresholds.** Only 66% of words scored 0.8–0.9 were intended, and 15 of them were opponent or assassin cards. For Noul the same band was 90% intended with 1 such card. The bonus gate of 0.8 would need to be 0.9+ with Score.
- **Keep Noul.** Use Score only when you need the levels themselves, such as "how strong is this clue", and tune its thresholds separately.

## What didn't

- **Compound and pun clues.** "sea" → horse and lion scored 0.35 or less. "pitch" → tent scored 0.24. "sun" → sunfish and sunlight lost to DESERT on every order. Jev reads meaning well and wordplay poorly.
- **Clues with a strong rival reading on the board.** Sea salt, a flock of geese, a knight's helmet, an eagle's beak (águila for "pico"), and treasure → coins and jewels all failed. These are real ambiguities that a human would also struggle with. The fix is the clue, not the prompt.
- **Weak clues.** Jev always answers. On "spreadsheet" (fits nothing), every Noul stayed ≤ 0.2 but a forced guess still happens. On "nature 2" it picked grass or tree, and never the snake.
- **Spanish** behaved like English. The failures came from ambiguous clues (pico, tesoro), not the language.

## How to give Jev clues (spymaster rules)

With careful clues on the same boards, results rose from 36–64% to 81–88% recall.

- Prefer **plain meaning** (kind, part, use, famous pairing) over puns, compounds or letter tricks.
- **Check every visible word** for a rival reading of the clue. If one exists, pick another clue or **lower the count**. "excalibur 1" beats "knight 2" when a helmet is on the board.
- For 2+ targets, choose a clue that makes the group obvious: "orchard" (apple, cherry), "quartet" (violin, cello), "mane" (lion, horse).
- **Automate the check with Jev.** Run the guesser against the candidate clue on the spymaster's own board, and accept the clue only if the top `count` words are the intended ones and no assassin or opponent word has a Noul ≥ 0.5. It costs one call. Any clue generator (human or LLM) can be filtered this way.

## General lessons about Jev (research + this lab)

Sources I trusted:

- [TypeSafe docs](https://docs.typesafe.ai/llms.txt), for vendor guidance.
- [priorbench/jev](https://github.com/priorbench/jev): pre-registered, 5,721 calls, raw data.
- [jev-phishing-bench](https://www.beri.net/article/typesafe-jev-typed-decision-model-calibration-decomposition-shadow-eval): reproducible, 2,000 emails.
- [jock.pl benchmark](https://thoughts.jock.pl/p/jev-typesafe-system-one-model-benchmark-2026): small, but transparent.
- [flaviocopes](https://flaviocopes.com/jev/): hands-on.
- [harrisonmuskat/jev-codenames](https://github.com/harrisonmuskat/jev-codenames): the same problem.

I ignored SEO explainers and posts that only repeat the vendor's speed and cost claims.

- **Decompose, then combine in code.** Our results match the phishing bench: one broad question scored 62.6%, and five narrow ones combined in code scored 95.0%.
- **Batch questions into one call.** 25 Nouls cost about the same latency as one. Per-call latency was 300–450 ms p50, with occasional runs near 800 ms.
- **Expect non-determinism and position bias.** Measure on 2–3 board orders before believing a change of one or two scenarios.
- **Always give a way out**, whether a `stop` or "none" option, or an absolute Noul. Jev never refuses on its own.
- **Wrong criteria are worse than none** (priorbench: 16.7% accuracy, below chance). Keep criteria generic and true.
- **Confidence is not correctness.** Measure your own calibration table as above before choosing thresholds.
- **Cost is negligible.** All the rounds here (744 simulated turns, roughly 1,200 calls) cost $0.09 in total.

## Personalities (chosen before a match)

The first guess is always Jev's best word. The personality only changes how sure Jev must be to keep going. A later guess is any guess after the first. The extra guess is the one beyond the clue's number that the rules allow.

| Personality  | Later guesses within the clue's number | Extra guess (number + 1)                 |
| ------------ | -------------------------------------- | ---------------------------------------- |
| Conservative | Noul ≥ 0.95                            | leftover of an earlier clue, Noul ≥ 0.95 |
| Normal       | the chosen group                       | leftover of an earlier clue, Noul ≥ 0.8  |
| Risky        | the chosen group                       | any clue, Noul ≥ 0.7                     |

Noul ≥ 0.9 was 100% "intended" in the lab, and 0.7–0.8 was 69%. So Conservative almost never keeps going past the first guess, and Risky takes about a 1-in-3 chance on its extra guess. Local training locks the choice from the first clue until Reset. Situations (below) override the personality.

## Situations: when to gamble

The guesser is careful on purpose. It stops at the clue's number, and takes a leftover guess only at Noul ≥ 0.8. Some scores make caution a likely loss, so `situations` in `packages/jev-lab/src/codenames/live.ts` can override the policy. They use only the public score and the clue.

| Situation     | When                                                                         | What changes                                                                                                                                       |
| ------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `last-chance` | The opponent has 1 agent left, and we still need more than the clue's number | Use every guess the rules allow (count + 1, or unlimited), taking the best remaining words at any confidence. Never guess past the agents we need. |

To add one, append it to that list: an `id`, a condition on `{ score, count, budget }`, and how to change the policy. Local training shows "Last chance: Jev takes a risk" when a situation fires.

## If we build the bot

- **Policy.** Use the `set` arm with prompt v2, stop at `count`, and allow the leftover bonus only at Noul ≥ 0.8. Code enforces the first guess and stops on a miss. Reuse `packages/jev-lab/src/codenames/{guessers,prompts}.ts`.
- **Integration.** `GameDefinition.botAction` (`packages/game-core/src/index.ts:30`) is synchronous, so an async model needs a bot path in `apps/server/src/rooms.ts` `advanceBots`. That path needs a timeout and a fallback guess.
- **Clue giver.** Jev cannot generate clues. For a full bot team, use an LLM spymaster plus the Jev clue check above.
- **Still untested.** Full games, a comparison with an LLM guesser, and whether the lab clue set is representative of real human clues. The lab boards are hand-authored and not held out.
