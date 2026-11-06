import { figureSupply, points, type Feature } from './features.js';
import type { View } from './index.js';

type PublicState = View['public'];
const WATCHED_LIMIT = 12;

export const scoreSources = [
  'city',
  'road',
  'sanctuary',
  'field',
  'final',
  'bonus',
] as const;
export type ScoreSource = (typeof scoreSources)[number];
export type FeatureScope = 'mine' | 'rivals' | 'unclaimed';

export type PlayerOverview = {
  id: string;
  score: number;
  behind: number;
  placedTiles: number;
  standardAvailable: number;
  standardDeployed: number;
  farmers: number;
  largeAvailable: number;
  largeDeployed: number;
  abbotAvailable: number;
  abbotDeployed: number;
  builderActive: boolean;
  pigActive: boolean;
  goods: number[];
  gold: number;
  robberActive: boolean;
  messages: number;
  extraTurns: number;
  points: Record<ScoreSource, number>;
};

function emptyPoints(): Record<ScoreSource, number> {
  return Object.fromEntries(
    scoreSources.map((source) => [source, 0]),
  ) as Record<ScoreSource, number>;
}

function sourceForEvent(
  event: PublicState['events'][number],
): ScoreSource | null {
  if (!event.points || event.points < 1) return null;
  if (event.kind === 'final') return 'final';
  if (event.kind === 'pig' || !event.feature) return 'bonus';
  if (event.feature === 'city') return 'city';
  if (event.feature === 'road') return 'road';
  if (event.feature === 'field') return 'field';
  if (event.feature === 'monastery' || event.feature === 'garden')
    return 'sanctuary';
  return 'bonus';
}

export function playerOverviews(
  state: PublicState,
  playerIds: string[],
): PlayerOverview[] {
  const scores = playerIds.map(
    (id) => (state.scores[id]?.[0] ?? 0) + (state.scores[id]?.[1] ?? 0),
  );
  const high = Math.max(0, ...scores);
  const featureByNode = new Map(
    state.features.flatMap((feature) =>
      feature.nodes.map((node) => [node, feature] as const),
    ),
  );

  return playerIds.map((id, index) => {
    const figures = state.figures.filter((figure) => figure.owner === id);
    const standard = figures.filter((figure) => figure.type === 'meeple');
    const large = figures.filter((figure) => figure.type === 'large');
    const abbots = figures.filter((figure) => figure.type === 'abbot');
    const farmers = figures.filter(
      (figure) =>
        featureByNode.get(`${figure.tile}/${figure.region}`)?.kind === 'field',
    ).length;
    const breakdown = emptyPoints();
    for (const event of state.events) {
      if (event.player !== id) continue;
      const source = sourceForEvent(event);
      if (source) breakdown[source] += event.points!;
    }

    return {
      id,
      score: scores[index],
      behind: high - scores[index],
      placedTiles: state.events.filter(
        (event) => event.kind === 'place' && event.player === id,
      ).length,
      standardAvailable: figureSupply('meeple') - standard.length,
      standardDeployed: standard.length,
      farmers,
      largeAvailable: figureSupply('large') - large.length,
      largeDeployed: large.length,
      abbotAvailable: figureSupply('abbot') - abbots.length,
      abbotDeployed: abbots.length,
      builderActive: figures.some((figure) => figure.attachment === 'builder'),
      pigActive: figures.some((figure) => figure.attachment === 'pig'),
      goods: [...(state.goods[id] ?? [0, 0, 0])],
      gold: state.gold[id] ?? 0,
      robberActive:
        state.robbers[id] !== null && state.robbers[id] !== undefined,
      messages: state.events.filter(
        (event) => event.kind === 'message' && event.player === id,
      ).length,
      extraTurns: state.events.filter(
        (event) => event.kind === 'extra' && event.player === id,
      ).length,
      points: breakdown,
    };
  });
}

export function featureOwners(feature: Feature) {
  return Object.entries(feature.strength)
    .filter(([, strength]) => strength > 0)
    .sort(([a, aStrength], [b, bStrength]) =>
      bStrength === aStrength ? a.localeCompare(b) : bStrength - aStrength,
    );
}

export function watchedFeatures(
  features: Feature[],
  playerId: string,
  scope: FeatureScope,
) {
  return features
    .filter((feature) => {
      if (feature.complete) return false;
      const owners = featureOwners(feature).map(([owner]) => owner);
      if (feature.kind === 'field' && !owners.length && !feature.cities.length)
        return false;
      if (scope === 'mine') return owners.includes(playerId);
      if (scope === 'rivals')
        return owners.length > 0 && !owners.includes(playerId);
      return owners.length === 0;
    })
    .sort((a, b) => {
      const value = points(b, true) - points(a, true);
      if (value) return value;
      if (a.open !== b.open) return a.open - b.open;
      if (a.tiles.length !== b.tiles.length)
        return b.tiles.length - a.tiles.length;
      return a.id.localeCompare(b.id);
    })
    .slice(0, WATCHED_LIMIT);
}
