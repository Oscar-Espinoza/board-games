/** Local-only fixtures. This module is never imported by multiplayer initialization. */
import {
  create,
  apply,
  view,
  assertConservation,
  type State,
  type Action,
  type Choice,
} from './index.js';
import { presets, type Menu } from './menus.js';
import { type Kind, type Card } from './cards.js';
export function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function startPractice(
  count = 4,
  menu: Menu = presets.first,
  seed = 72,
) {
  const random = seeded(seed);
  let state = create(
    Array.from({ length: count }, (_, i) => `seat-${i + 1}`),
    random,
  );
  state = apply(
    state,
    state.players[0],
    { type: 'SET_MENU', version: state.setupVersion, menu },
    random,
  );
  for (const p of state.players)
    state = apply(
      state,
      p,
      { type: 'READY', round: 0, version: state.setupVersion },
      random,
    );
  return { state, random };
}
/** A transparent local seat control, not a bot exposed to multiplayer rooms. */
export function demonstrationAction(
  state: State,
  player: string,
  random: () => number,
): Action | null {
  const v = view(state, player);
  const p = v.private.prompt;
  if (v.public.phase === 'setup' || v.public.phase === 'round-end')
    return v.public.ready.includes(player)
      ? null
      : { type: 'READY', round: state.round, version: state.setupVersion };
  if (p) {
    let choice: Choice;
    if (p.kind === 'menu' || p.kind === 'supplier' || p.kind === 'chopsticks')
      choice = {
        type: 'card',
        card: p.cards[Math.floor(random() * p.cards.length)].handle,
      };
    else if (p.kind === 'spoon') {
      const request = p.requests[Math.floor(random() * p.requests.length)];
      choice = { type: 'request', kind: request.kind };
    } else if (p.kind === 'takeout')
      choice = {
        type: 'takeout',
        cards: p.targets
          .filter(
            (c) =>
              ['eel', 'tofu', 'wasabi', 'chopsticks', 'spoon'].includes(
                c.kind,
              ) && random() < 0.5,
          )
          .map((c) => c.id),
      };
    else if (p.kind === 'copy')
      choice = {
        type: 'copy',
        target: p.targets[Math.floor(random() * p.targets.length)].id,
      };
    else choice = { type: 'attach', wasabi: p.targets[0]?.id ?? null };
    return {
      type: 'RESOLVE',
      round: state.round,
      turn: state.turn,
      promptId: p.id,
      choice,
    };
  }
  if (state.phase === 'draft' && !v.private.committed) {
    const c = v.private.hand[Math.floor(random() * v.private.hand.length)];
    const target =
      v.private.copyTargets[
        Math.floor(random() * v.private.copyTargets.length)
      ];
    return {
      type: 'PICK',
      round: state.round,
      turn: state.turn,
      promptId: v.private.pickPromptId!,
      card: c.handle,
      utensils: v.private.legalUtensils.filter(() => random() < 0.8),
      ...(c.kind === 'special_order' && target
        ? { copyTarget: target.id }
        : {}),
    };
  }
  return null;
}
/** Swap actual physical cards; never manufacture a card to arrange a demonstration. */
export function arrangeHand(
  s: State,
  seat: number,
  kinds: (Kind | [Kind, string])[],
) {
  for (let i = 0; i < kinds.length; i++) {
    const desired = kinds[i];
    const kind = typeof desired === 'string' ? desired : desired[0];
    const variant = typeof desired === 'string' ? undefined : desired[1];
    const matches = (c: Card) =>
      c.face.kind === kind &&
      (variant === undefined || c.face.variant === variant);
    if (matches(s.hands[seat][i])) continue;
    const stock = s.deck.findIndex(matches);
    if (stock >= 0) {
      const old = s.hands[seat][i];
      s.hands[seat][i] = { ...s.deck[stock], handle: old.handle };
      s.deck[stock] = { physical: old.physical, face: old.face };
      continue;
    }
    const candidates = s.hands
      .flatMap((hand, other) => hand.map((card, j) => ({ card, other, j })))
      .filter((x) => !(x.other === seat && x.j <= i) && matches(x.card))
      .sort((a, b) => b.j - a.j);
    const found = candidates[0];
    if (!found)
      throw new Error(`Fixture cannot locate ${kind} ${variant ?? ''}`);
    const old = s.hands[seat][i];
    s.hands[seat][i] = { ...found.card, handle: old.handle };
    s.hands[found.other][found.j] = { ...old, handle: found.card.handle };
  }
  assertConservation(s);
}
export const scenarios = [
  'table',
  'draft',
  'wasabi',
  'uramaki',
  'miso',
  'menu',
  'spoon',
  'copy',
  'takeout',
] as const;
export type Scenario = (typeof scenarios)[number];
export function scenario(name: Scenario, count = 4) {
  const menus: Record<Scenario, Menu> = {
    table: presets.original,
    draft: presets.original,
    wasabi: presets.original,
    uramaki: presets.points,
    miso: presets.first,
    menu: presets.sampler,
    spoon: presets.master,
    copy: { ...presets.two, specials: ['special_order', 'chopsticks'] },
    takeout: presets.master,
  };
  const fixture = startPractice(
    Math.max(
      name === 'spoon' || name === 'takeout' || name === 'uramaki' ? 3 : 2,
      Math.min(
        name === 'menu' || name === 'copy' || name === 'uramaki' ? 6 : 8,
        count,
      ),
    ),
    menus[name],
  );
  const { random } = fixture;
  let s = fixture.state;
  if (name === 'table') {
    // Reach the illustrated midgame through accepted rules actions, conserving
    // every physical card. This fixture is never imported by room initialization.
    for (let guard = 0; s.phase !== 'round-end' && guard < 400; guard++) {
      const actor = s.players.find((id) => demonstrationAction(s, id, () => 0));
      if (!actor) throw new Error('Table fixture cannot progress');
      s = apply(s, actor, demonstrationAction(s, actor, random)!, random);
    }
    if (s.phase !== 'round-end')
      throw new Error('Table fixture did not finish round one');
    for (const actor of s.players)
      s = apply(
        s,
        actor,
        { type: 'READY', round: s.round, version: s.setupVersion },
        random,
      );
    const dishes: Kind[][] = [
      ['maki', 'tempura', 'pudding'],
      ['nigiri', 'sashimi', 'dumpling'],
      ['maki', 'dumpling', 'nigiri'],
      ['sashimi', 'nigiri', 'maki'],
      ['dumpling', 'maki', 'tempura'],
      ['nigiri', 'tempura', 'sashimi'],
      ['nigiri', 'dumpling', 'tempura'],
      ['maki', 'nigiri', 'sashimi'],
    ];
    for (let turn = 0; turn < 3; turn++) {
      s.players.forEach((_, seat) =>
        arrangeHand(s, seat, [dishes[seat][turn]]),
      );
      for (const actor of s.players) {
        const v = view(s, actor);
        s = apply(
          s,
          actor,
          {
            type: 'PICK',
            round: s.round,
            turn: s.turn,
            promptId: v.private.pickPromptId!,
            card: v.private.hand[0].handle,
            utensils: [],
          },
          random,
        );
      }
    }
    arrangeHand(
      s,
      0,
      (
        [
          ['nigiri', 'salmon'],
          'sashimi',
          'dumpling',
          'maki',
          'tempura',
          'pudding',
        ] as (Kind | [Kind, string])[]
      ).slice(0, s.hands[0].length),
    );
    assertConservation(s);
    return { state: s, random };
  }
  const first: Partial<Record<Scenario, (Kind | [Kind, string])[]>> = {
    wasabi: ['wasabi'],
    uramaki: [['uramaki', '5']],
    miso: ['miso'],
    menu: ['menu'],
    spoon: ['spoon'],
    copy: ['chopsticks'],
    takeout: ['tofu'],
  };
  if (first[name]) arrangeHand(s, 0, first[name]!);
  if (name === 'miso') arrangeHand(s, 1, ['miso']);
  if (name !== 'draft' && name !== 'menu' && name !== 'miso') {
    for (const player of s.players) {
      const v = view(s, player);
      s = apply(
        s,
        player,
        {
          type: 'PICK',
          round: s.round,
          turn: s.turn,
          promptId: v.private.pickPromptId!,
          card: v.private.hand[0].handle,
          utensils: [],
        },
        random,
      );
    }
    // Other fixture seats deliberately choose noninteractive first cards.
    while (s.prompt) {
      const actor = s.players[s.prompt.actor];
      s = apply(s, actor, demonstrationAction(s, actor, random)!, random);
    }
    const next: Partial<Record<Scenario, (Kind | [Kind, string])[]>> = {
      wasabi: [['nigiri', 'squid']],
      uramaki: [['uramaki', '5']],
      spoon: ['nigiri'],
      copy: ['special_order'],
      takeout: ['takeout'],
    };
    if (next[name]) arrangeHand(s, 0, next[name]!);
  }
  return { state: s, random };
}
