import { gameSkin, setGameSkin, type Skin } from './pixel/skin.js';
import { read, readJson, write } from './storage.js';

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

const onOff = (key: string, off: string) => {
  const value = read(key);
  return value === null ? undefined : value !== off;
};

/**
 * Settings saved under the keys each game used before `viewerPreferences`, read once
 * (until the first save under the new key) so nobody's choices are lost.
 */
const legacy: Record<string, () => Record<string, unknown>> = {
  azul: () => {
    const saved = readJson('azul-preferences');
    return {
      sound: saved.sound,
      volume: saved.volume,
      motion:
        saved.motion === 'full'
          ? true
          : saved.motion === 'reduced'
            ? false
            : undefined,
    };
  },
  'little-secret': () => {
    const saved = readJson('little-secret:preferences');
    return { sound: saved.sound, motion: saved.reduced !== true };
  },
  'sushi-go-party': () => readJson('sushi-go-party:preferences'),
  codenames: () => {
    const saved = readJson('codenames:preferences');
    return { ...saved, motion: saved.reduced !== true };
  },
  catan: () => ({
    sound: onOff('catan:sound', 'false'),
    motion: onOff('catan:motion', 'false'),
  }),
  carcassonne: () => ({
    sound: onOff('carcassonne:sound', 'off'),
    motion: onOff('carcassonne:motion', 'off'),
  }),
  uno: () => ({
    sound: onOff('uno:sound', 'off'),
    motion: onOff('uno:motion', 'off'),
  }),
  domino: () => {
    const camera = read('domino:camera');
    return {
      sound: onOff('domino:sound', 'off'),
      motion: onOff('domino:motion', 'off'),
      camera: camera === null ? undefined : Number(camera),
    };
  },
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
  const stored = readJson(key);
  const saved = Object.keys(stored).length
    ? stored
    : (legacy[game]?.() ?? stored);
  const initial = { ...defaults } as Saved<T>;
  for (const name in defaults) {
    let value = saved[name];
    if (
      name === 'volume' &&
      typeof value === 'number' &&
      Number.isFinite(value)
    )
      value = Math.min(1, Math.max(0, value));
    if (
      defaults[name] === null
        ? value === null || typeof value === 'boolean'
        : typeof value === typeof defaults[name]
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
    /** Omit when the table loads each skin's code itself. */
    load: () => Promise<unknown> = async () => {},
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
