import { gameSkin, setGameSkin, type Skin } from './pixel/skin.js';
import { readJson, write } from './storage.js';

type Preference = boolean | number | string | null;
/** `true` saves as any boolean, `null` as "follow the system" or a boolean. */
type Saved<T> = {
  [K in keyof T]: T[K] extends boolean
    ? boolean
    : T[K] extends number
      ? number
      : T[K] extends null
        ? boolean | null
        : T[K];
};

/**
 * Per-viewer settings (sound, volume, motion…) persisted under one key per game.
 * A `null` default means "follow the system" until the viewer chooses a boolean.
 * Call during component initialisation: it saves through an effect.
 */
export function viewerPreferences<T extends Record<string, Preference>>(
  game: string,
  defaults: T,
): Saved<T> {
  const key = `board-games:preferences:${game}`;
  const saved = readJson(key);
  const initial = { ...defaults } as Saved<T>;
  for (const name in defaults) {
    const value = saved[name];
    if (
      typeof value === typeof defaults[name] ||
      (defaults[name] === null && typeof value === 'boolean')
    )
      initial[name] = value as Saved<T>[typeof name];
  }
  const preferences = $state(initial);
  $effect(() => {
    write(key, $state.snapshot(preferences));
  });
  return preferences;
}

/**
 * The viewer's table skin. Its assets load the first time `pixel` is chosen; until they
 * have, `pixel` stays false so the classic table keeps rendering.
 * Call during component initialisation.
 */
export class ViewerSkin {
  choice = $state<Skin>('classic');
  ready = $state(false);
  readonly pixel = $derived(this.choice === 'pixel' && this.ready);
  constructor(
    readonly game: string,
    load: () => Promise<unknown>,
  ) {
    this.choice = gameSkin(game);
    $effect(() => {
      if (this.choice === 'pixel' && !this.ready)
        void load().then(() => (this.ready = true));
    });
  }
  choose(skin: Skin) {
    this.choice = skin;
    setGameSkin(this.game, skin);
  }
}
