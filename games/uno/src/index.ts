import { shuffle } from '@board-games/game-core';
import type { GameDefinition } from '@board-games/game-core';
import { games, seats } from '@board-games/shared/games';
import { botAction } from './bot.js';
import { colors, deck, type Card, type Color } from './cards.js';

export type Action =
  | { type: 'PLAY_CARD'; cardId: number; uno?: boolean }
  | { type: 'DRAW' }
  | { type: 'CHOOSE_COLOR'; color: Color }
  | { type: 'CATCH_UNO'; player: string };
export interface State {
  players: string[];
  hands: Card[][];
  stock: Card[];
  discards: Card[];
  activeColor: Color;
  direction: 1 | -1;
  turn: number;
  phase: 'turn' | 'color' | 'finished';
  winner: string | null;
  penalty: { amount: number; kind: 2 | 4 } | null;
  catchable: string | null;
  pendingUno: boolean;
  emptyPasses: number;
  revision: number;
}

function create(players: string[], random: () => number): State {
  if (
    players.length < games.uno.minPlayers ||
    players.length > games.uno.maxPlayers ||
    new Set(players).size !== players.length
  ) {
    throw new Error(
      `Choose ${games.uno.minPlayers}–${games.uno.maxPlayers} distinct players.`,
    );
  }
  const stock = deck();
  shuffle(stock, random);
  const hands = players.map(() => [] as Card[]);
  for (let i = 0; i < 7; i++) for (const hand of hands) hand.push(stock.pop()!);
  const opening = stock.findLastIndex((card) => /^\d$/.test(card.symbol));
  const top = stock.splice(opening, 1)[0]!;
  return {
    players: [...players],
    hands,
    stock,
    discards: [top],
    activeColor: top.color!,
    direction: 1,
    turn: 0,
    phase: 'turn',
    winner: null,
    penalty: null,
    catchable: null,
    pendingUno: false,
    emptyPasses: 0,
    revision: 0,
  };
}
function matches(state: State, card: Card) {
  if (state.penalty)
    return (
      card.symbol === '+4' || (state.penalty.kind === 2 && card.symbol === '+2')
    );
  return (
    card.color === null ||
    card.color === state.activeColor ||
    card.symbol === state.discards.at(-1)!.symbol
  );
}
function seatOf(state: State, player: string) {
  const index = state.players.indexOf(player);
  if (index === -1) throw new Error('Unknown player.');
  return index;
}
/** Why `action` is not allowed for `player` right now; null when it is. */
function rejection(state: State, index: number, action: Action) {
  if (state.phase === 'finished') return 'This round has finished.';
  if (action.type === 'CATCH_UNO')
    return typeof action.player !== 'string' ||
      action.player === state.players[index] ||
      state.catchable !== action.player
      ? 'That UNO catch opportunity has closed.'
      : null;
  if (state.turn !== index) return 'Wait for your turn.';
  if (state.phase === 'color' && action.type !== 'CHOOSE_COLOR')
    return 'Choose a color to finish your Wild.';
  if (action.type === 'CHOOSE_COLOR') {
    if (state.phase !== 'color') return 'Play a Wild before choosing a color.';
    if (!colors.includes(action.color)) return 'Invalid color.';
  }
  if (action.type === 'PLAY_CARD') {
    const hand = state.hands[index]!;
    const card = hand.find((card) => card.id === action.cardId);
    if (!card) return 'That card is not in your hand.';
    if (action.uno !== undefined && typeof action.uno !== 'boolean')
      return 'Invalid UNO declaration.';
    if (action.uno && hand.length !== 2)
      return 'Declare UNO when holding two cards.';
    if (!matches(state, card))
      return 'Match the active color, symbol or permitted penalty stack.';
  }
  return null;
}
function validate(state: State, player: string, input: unknown): Action {
  const index = seatOf(state, player);
  if (state.phase === 'finished') throw new Error('This round has finished.');
  if (!input || typeof input !== 'object') throw new Error('Invalid action.');
  const action = input as Action;
  if (!['PLAY_CARD', 'DRAW', 'CHOOSE_COLOR', 'CATCH_UNO'].includes(action.type))
    throw new Error('Invalid action.');
  const reason = rejection(state, index, action);
  if (reason) throw new Error(reason);
  return action;
}
/** Every action `player` may take now: the candidates the rules accept. */
function legalActions(state: State, player: string): Action[] {
  const index = seatOf(state, player);
  const hand = [...state.hands[index]!].sort((a, b) => a.id - b.id);
  const candidates: Action[] = [
    ...hand.flatMap((card) => [
      { type: 'PLAY_CARD' as const, cardId: card.id, uno: false },
      { type: 'PLAY_CARD' as const, cardId: card.id, uno: true },
    ]),
    { type: 'DRAW' },
    ...colors.map((color) => ({ type: 'CHOOSE_COLOR' as const, color })),
    ...(state.catchable
      ? [{ type: 'CATCH_UNO' as const, player: state.catchable }]
      : []),
  ];
  return candidates.filter((action) => !rejection(state, index, action));
}
function advance(state: State) {
  state.turn =
    (state.turn + state.direction + state.players.length) %
    state.players.length;
  state.phase = 'turn';
}
function finishPlay(state: State, uno: boolean) {
  const hand = state.hands[state.turn]!;
  if (!hand.length) {
    state.phase = 'finished';
    state.winner = state.players[state.turn]!;
    state.penalty = null;
    state.catchable = null;
    return;
  }
  if (hand.length === 1 && !uno) state.catchable = state.players[state.turn]!;
  const symbol = state.discards.at(-1)!.symbol;
  advance(state);
  if (symbol === 'skip' || (symbol === 'reverse' && state.players.length === 2))
    advance(state);
}
function drawCards(
  state: State,
  index: number,
  amount: number,
  random: () => number,
) {
  let count = 0;
  for (; count < amount; count++) {
    if (!state.stock.length && state.discards.length > 1) {
      const top = state.discards.pop()!;
      state.stock = state.discards;
      state.discards = [top];
      shuffle(state.stock, random);
    }
    const card = state.stock.pop();
    if (!card) break;
    state.hands[index]!.push(card);
  }
  if (count) state.emptyPasses = 0;
  return count;
}
function apply(
  original: State,
  player: string,
  input: unknown,
  random: () => number,
): State {
  // Validate before cloning, mutation or randomness; rejected actions preserve catch windows.
  const action = validate(original, player, input);
  const state = structuredClone(original);
  switch (action.type) {
    case 'PLAY_CARD': {
      state.catchable = null;
      const hand = state.hands[state.turn]!;
      const card = hand.splice(
        hand.findIndex((card) => card.id === action.cardId),
        1,
      )[0]!;
      state.discards.push(card);
      state.emptyPasses = 0;
      if (card.color) state.activeColor = card.color;
      if (card.symbol === 'reverse')
        state.direction = state.direction === 1 ? -1 : 1;
      if (card.symbol === '+2' || card.symbol === '+4') {
        const kind = card.symbol === '+2' ? 2 : 4;
        state.penalty = { kind, amount: (state.penalty?.amount ?? 0) + kind };
      }
      if (card.color === null) {
        state.phase = 'color';
        state.pendingUno = action.uno ?? false;
      } else finishPlay(state, action.uno ?? false);
      break;
    }
    case 'CHOOSE_COLOR':
      state.activeColor = action.color;
      finishPlay(state, state.pendingUno);
      state.pendingUno = false;
      break;
    case 'DRAW': {
      state.catchable = null;
      const count = drawCards(
        state,
        state.turn,
        state.penalty?.amount ?? 1,
        random,
      );
      state.penalty = null;
      if (!count) state.emptyPasses++;
      if (state.emptyPasses >= state.players.length) state.phase = 'finished';
      else advance(state);
      break;
    }
    case 'CATCH_UNO':
      state.catchable = null;
      drawCards(state, state.players.indexOf(action.player), 2, random);
      break;
  }
  state.revision++;
  return state;
}
function view(state: State, player: string) {
  const hand = [...state.hands[seatOf(state, player)]!].sort(
    (a, b) => a.id - b.id,
  );
  // Explicit projection: stock order, opponents' cards and canonical hands never leave the server.
  return {
    public: {
      players: state.players.map((id, i) => ({
        id,
        count: state.hands[i]!.length,
      })),
      top: { ...state.discards.at(-1)! },
      activeColor: state.activeColor,
      direction: state.direction,
      turn: state.players[state.turn],
      phase: state.phase,
      winner: state.winner,
      penalty: state.penalty ? { ...state.penalty } : null,
      catchable: state.catchable,
      stockCount: state.stock.length,
      revision: state.revision,
    },
    private: {
      hand: hand.map((card) => ({ ...card })),
      legalActions: legalActions(state, player),
    },
  };
}
export const uno = {
  ...seats('uno'),
  botAction,
  create,
  apply,
  view,
  isFinished: (state: State) => state.phase === 'finished',
} satisfies GameDefinition<State>;
