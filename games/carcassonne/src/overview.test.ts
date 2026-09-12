import { describe, expect, test } from 'bun:test';
import { graph, type Feature } from './features.js';
import { createGame, playerView } from './index.js';
import { featureOwners, playerOverviews, watchedFeatures } from './overview.js';
import { tiles } from './tiles.js';

function feature(
  id: string,
  kind: Feature['kind'],
  value: number,
  open: number,
  strength: Record<string, number> = {},
): Feature {
  return {
    id,
    kind,
    nodes: [id],
    tiles: Array.from({ length: value }, (_, index) => `${id}-${index}`),
    open,
    complete: false,
    figures: [],
    leaders: [],
    strength,
    shields: 0,
    goods: [0, 0, 0],
    inn: false,
    cathedral: false,
    mage: false,
    witch: false,
    cities: [],
  };
}

describe('live board overview', () => {
  test('summarizes public scores, pieces, resources and score sources', () => {
    const state = createGame(['a', 'b']);
    state.phase = 'decision';
    state.board = {
      '0,0': { id: 'D', x: 0, y: 0, rotation: 0, turn: 0 },
    };
    const field = tiles.D.regions.find((region) => region.kind === 'field')!;
    const city = tiles.D.regions.find((region) => region.kind === 'city')!;
    state.figures = [
      {
        id: 1,
        owner: 'a',
        tile: '0,0',
        region: field.id,
        type: 'meeple',
        attachment: 'pig',
      },
      {
        id: 2,
        owner: 'a',
        tile: '0,0',
        region: city.id,
        type: 'large',
        attachment: 'builder',
      },
      {
        id: 3,
        owner: 'a',
        tile: '0,0',
        region: city.id,
        type: 'abbot',
      },
    ];
    state.scores = { a: [10, 3], b: [15, 0] };
    state.goods.a = [2, 1, 0];
    state.gold.a = 4;
    state.robbers.a = 15;
    state.events = [
      { id: 1, turn: 1, kind: 'place', player: 'a' },
      { id: 2, turn: 2, kind: 'place', player: 'a' },
      { id: 3, turn: 3, kind: 'place', player: 'b' },
      {
        id: 4,
        turn: 3,
        kind: 'score',
        player: 'a',
        points: 4,
        feature: 'city',
      },
      {
        id: 5,
        turn: 4,
        kind: 'return',
        player: 'a',
        points: 3,
        feature: 'garden',
      },
      { id: 6, turn: 5, kind: 'pig', player: 'a', points: 6 },
      { id: 7, turn: 5, kind: 'final', player: 'a', points: 5 },
      { id: 8, turn: 5, kind: 'message', player: 'a', detail: '4' },
      { id: 9, turn: 5, kind: 'extra', player: 'a' },
    ];
    state.eventSerial = 9;
    const view = playerView(state, 'a').public;
    expect(view.features).toEqual(graph(state));

    const [summary] = playerOverviews(view, ['a', 'b']);
    expect(summary).toMatchObject({
      score: 13,
      behind: 2,
      placedTiles: 2,
      standardAvailable: 6,
      standardDeployed: 1,
      farmers: 1,
      largeAvailable: 0,
      largeDeployed: 1,
      abbotAvailable: 0,
      abbotDeployed: 1,
      builderActive: true,
      pigActive: true,
      goods: [2, 1, 0],
      gold: 4,
      robberActive: true,
      messages: 1,
      extraTurns: 1,
    });
    expect(summary.points).toEqual({
      city: 4,
      road: 0,
      sanctuary: 3,
      field: 0,
      final: 5,
      bonus: 6,
    });
  });

  test('filters and orders watched features deterministically', () => {
    const mineWide = feature('mine-wide', 'road', 4, 2, { a: 1 });
    const mineNear = feature('mine-near', 'road', 4, 1, { a: 1 });
    const rival = feature('rival', 'city', 3, 1, { b: 2, c: 1 });
    const open = feature('open', 'road', 5, 3);
    const emptyField = feature('empty-field', 'field', 1, 0);
    const usefulField = feature('useful-field', 'field', 1, 0);
    usefulField.cities = ['complete-city'];
    const complete = feature('complete', 'city', 10, 0, { a: 1 });
    complete.complete = true;
    const features = [
      mineWide,
      complete,
      rival,
      emptyField,
      open,
      mineNear,
      usefulField,
    ];

    expect(watchedFeatures(features, 'a', 'mine').map((f) => f.id)).toEqual([
      'mine-near',
      'mine-wide',
    ]);
    expect(watchedFeatures(features, 'a', 'rivals').map((f) => f.id)).toEqual([
      'rival',
    ]);
    expect(
      watchedFeatures(features, 'a', 'unclaimed').map((f) => f.id),
    ).toEqual(['open', 'useful-field']);
    expect(featureOwners(rival)).toEqual([
      ['b', 2],
      ['c', 1],
    ]);
    expect(watchedFeatures(features, 'a', 'unclaimed', 1)).toHaveLength(1);
  });
});
