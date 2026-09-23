# Jev, LLMs and game bots

Research date: 2026-09-18. Recommendation: **Codenames first, Azul second, Sushi Go Party third.** Use UNO to verify the bot runner. These are benchmark design recommendations, not measured model results; no API calls or tournaments have been run.

## What Jev is

TypeSafe describes Jev as a “System One” decision model: supply text/JSON state and typed questions, receive decisions and probabilities. It does not generate free-form clues, explanations or code. Its primitives are **Choice** (pick an option), **Score** (evaluate a rubric) and **Noul** (probability of a yes/no proposition). This makes it a natural candidate for selecting game actions. Conventional LLMs can also select actions through structured outputs and can additionally generate language. These are documented interface differences, not an independent assessment of model internals. [Introduction](https://docs.typesafe.ai/introduction), [System One](https://docs.typesafe.ai/concepts/system-one).

The official model page already lists `jev-1.13.0`: direct API pricing is $0.042 per million input tokens, with free output tokens. Pin a version for comparisons and record actual usage; provider pricing and availability can differ. Vendor speed/cost claims do not establish game-playing strength. [Models and pricing](https://docs.typesafe.ai/models).

| Approach              | Where the decisions come from                            | What the comparison tells us                                            |
| --------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------- |
| Handwritten heuristic | Explicit priorities and scoring formulas                 | Whether a model adds value over inexpensive ordinary code               |
| Search bot            | Simulate possible continuations and evaluate outcomes    | Whether model judgment competes with planning at a fixed compute budget |
| Jev                   | Typed questions over visible state and candidate actions | Quality, uncertainty, latency and cost of bounded judgments             |
| Conventional LLM      | Prompted reasoning and structured action selection       | Whether additional reasoning improves results enough to justify cost    |

**All these games are playable with deterministic bots.** Deterministic means the same input produces the same action; it does not mean simple or weak. A deterministic policy can plan, track observations and reason about uncertain outcomes. Random events and hidden information make optimal play harder, but do not require an LLM. Monte Carlo search adds sampling and is also a useful non-LLM baseline.

## Which games are useful?

The assessments below follow this repository's rules and are hypotheses to test.

| Game                                      | Useful non-LLM baseline                                                     | What makes stronger play difficult                                                         | Benchmark recommendation                                                                                                                                                                  |
| ----------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [UNO](rules.md)                           | Existing bot: preserve wilds, choose the most-held color, declare/catch UNO | Hidden hands, action timing and draw luck                                                  | **Runner smoke test.** Simple enough that a model may add little; still measure rather than assume.                                                                                       |
| [Codenames](games/codenames.md)           | Fixed word-embedding similarity ranking, plus a stopping rule               | Ambiguous meaning, multiple clue targets, prior clues and dangerous guesses                | **Best first Jev test.** Human gives a clue; bots rank/guess words. Separates language judgment from arithmetic.                                                                          |
| [Azul](games/azul.md)                     | Immediate points minus floor penalties, then bounded lookahead              | Denial, future pattern completion, bonuses and choosing when to end the game               | **Best clean strategy test.** Public boards and compact actions make controlled comparisons practical. Future draws remain hidden. Expect search to be a serious competitor.              |
| [Sushi Go Party](games/sushi-go-party.md) | Marginal expected points per pick, accounting for sets and public opponents | Simultaneous hidden picks, remembered passing hands, races and menu-dependent combinations | **Best next hidden-information test.** Start with one fixed menu; later use unseen menus to test adaptation.                                                                              |
| [Carcassonne](games/carcassonne.md)       | Score legal tile/meeple placements; add bounded search                      | Spatial connectivity, contested features, farmer investment and growing placement choices  | **Good later spatial test.** Start with base tiles and expansions disabled. The implemented Big Box 3.1 adds substantial adapter work and many pending choices.                           |
| [Catan](games/catan.md)                   | Production/expansion heuristics, resource valuation and fixed trade policy  | Long planning horizon, dice, hidden resources, opponent incentives and trading             | **Good later planning/trading test.** More difficult to interpret and implement than Azul. Existing trades are structured offers; conversational negotiation would be a separate feature. |
| [Little Secret](games/little-secret.md)   | Random or clue-similarity voting                                            | Deception, social discussion and role inference                                            | **Defer.** Clues/debate currently happen socially; a useful benchmark needs a recorded text channel. Jev could judge suspects, but cannot freely generate dialogue.                       |

Azul has substantial strategy despite simple rules. Catan and Carcassonne require more planning and larger action representations, but their complexity does not imply a model advantage. Sushi's small hand hides a meaningful prediction problem. These games test different abilities; report separate results instead of one overall “intelligence” score.

## Codenames: your clue-to-probabilities idea

Give each operative the same board words, clue/count, revealed cards and public history, **never the hidden key**. Keep the key only in the evaluator and spymaster. Begin with saved human-authored clue positions so every model faces identical inputs; move to full matches afterwards.

Two useful experiments:

1. **Action selection:** one Choice over unrevealed words, plus End turn only when legal. Ask which action to take next. Choice probabilities sum to one across options; they describe this choice, not independent chances that every word is friendly. [Choice documentation](https://docs.typesafe.ai/primitives/choice).
2. **Per-word beliefs:** one Noul per word asking whether it is an own-team agent given the available evidence, or one four-way Choice per word: own team, opposing team, civilian, assassin. Several words can have high own-team probability simultaneously. These estimates can guide a risk-aware stopping policy and be scored against the held-out key. [Noul documentation](https://docs.typesafe.ai/primitives/noul).

For example, a clue like “ocean, 2” could make both WHALE and WAVE plausible. A 50/50 next-action distribution does not mean each has only a 50% chance of being friendly. Also distinguish “intended by this clue” from “belongs to our team”: measuring intended targets requires the clue author to record them separately.

Re-evaluate after each reveal; the current rules require at least one guess before stopping. Jev's `confidence` summarizes the shape of its probability distribution; it is not an independently verified probability of a correct move. Measure calibration on held-out boards instead of trusting the label. [Confidence documentation](https://docs.typesafe.ai/confidence).

Track own-team hits, assassin hits, agents found per clue, stopping behavior and eventual team wins. For per-word own-team probabilities, report Brier score (mean squared difference between prediction and actual 0/1 identity) and whether predictions near 80% are correct roughly 80% of the time. Evaluate all unrevealed words, not just selected guesses. Split by board/clue source and language; tune thresholds on a separate development set.

For full games, keep the spymaster source fixed across competitors. Jev could select clues from a supplied vocabulary, but candidate generation would then be part of the system being tested. A generative LLM spymaster versus a Jev operative is a comparison of different jobs.

## Smallest useful competition

1. **UNO runner check:** reuse the [existing heuristic](../games/uno/src/bot.ts), add a random-legal policy, verify complete reproducible games and private views.
2. **Codenames suite:** compare embedding ranking, Jev and one pinned LLM on identical saved clue positions; then run matched games with a fixed clue source.
3. **Two-player Azul league:** compare greedy, bounded-search, Jev and the same LLM. This tests whether model judgment adds value beyond rules and numerical planning.
4. **Sushi league:** choose one fixed menu and seat count, give every policy the same permitted observation history, then test menu generalization separately.

Use this repository's pure `create/apply/view/isFinished` rules in a headless Bun runner. Keep each policy behind an asynchronous adapter receiving only its recipient view and permitted history. The current optional `botAction` hook is synchronous, and the shared contract has no universal legal-action enumerator; asynchronous model calls and game-specific action adapters still need implementation. [Game contract](../packages/game-core/src/index.ts).

Have game-owned code enumerate legal actions from permitted information, assign IDs and validate the selected action through the real engine. For spatial games, provide connectivity and exact public scoring features in text/JSON; Jev is text-only. Use identical candidate lists and computed features across model competitors. Choice currently supports at most 255 options; larger action spaces require documented shared pruning or staged choices, which themselves affect playing strength. [Model input](https://docs.typesafe.ai/models), [Choice limits](https://docs.typesafe.ai/primitives/choice).

Keep inference outside rules code. Do not expose canonical decks, opponent hands, pending commitments or secret keys through prompts, candidate descriptions or simulation access. Any search over hidden information must sample plausible states from the bot's observations, never use the actual hidden state.

## What to report

- **Fairness:** pin rules, model versions, prompts, language, menu/expansions and decision budgets. Separate pure model selection from model-plus-search hybrids.
- **Pairing:** use held-out seeds, rotate seats/teams and repeat across opponents. Same seeds reduce variance but do not guarantee identical later draws when actions consume randomness differently. Keep policy randomness separate from game randomness.
- **Strength:** wins/draws, within-game score margins and game-specific mistakes. Start with a modest pilot; report uncertainty intervals and increase games before declaring small differences meaningful. Moves from one game are not independent samples.
- **Efficiency:** median and p95 decision latency, calls/tokens/cost per completed game, and search CPU/time budget. Compare both a fixed-budget track and practical quality-versus-cost results.
- **Reliability:** invalid selections, timeouts, retries and fallback frequency. Use a fixed legal fallback and count its results as part of the system; never silently discard failed games.
- **Reproducibility:** save seeds, settings, permitted observations, actions and raw model responses for offline review. Isolate evaluator-only secrets. Report calibration only for questions with well-defined outcome labels.

The first deliverable should be **a Codenames clue benchmark plus an Azul league**, with UNO validating the runner. This gives one language task and one strategic task without first building Catan's trading policy or Carcassonne's full expansion handling.
