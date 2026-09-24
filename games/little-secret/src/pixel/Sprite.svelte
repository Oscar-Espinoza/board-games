<script lang="ts" module>
  /** Sprite sheets under /games/little-secret/pixel/: one row of equal cells per sheet
   * (suspects adds a faded second row for eliminated players). See docs/little-secret-pixel.md. */
  export const sheets = {
    icons: {
      w: 28,
      h: 28,
      rows: 1,
      frames: [
        'mime',
        'novice',
        'elder',
        'sage',
        'revenant',
        'dictator',
        'adept',
        'disciple',
        'infiltrator',
        'journalist',
        'rock',
        'paper',
        'scissors',
        'envelope',
        'ballot',
        'stamp',
      ],
    },
    suspects: {
      w: 52,
      h: 48,
      rows: 2,
      frames: ['0', '1', '2', '3', '4', '5', '6', '7', '8'],
    },
    props: {
      w: 55,
      h: 48,
      rows: 1,
      frames: [
        'envelope',
        'open',
        'seal',
        'stamp',
        'trophy',
        'cuffs',
        'door',
        'glass',
      ],
    },
    envelope: { w: 37, h: 40, rows: 1, frames: ['closed', 'open'] },
    mascot: { w: 48, h: 56, rows: 1, frames: ['idle', 'shh', 'look', 'cheer'] },
  } as const;
  export type Sheet = keyof typeof sheets;
</script>

<script lang="ts">
  let {
    sheet,
    frame,
    scale = 1,
    row = 0,
    fill = false,
  }: {
    sheet: Sheet;
    frame: string;
    /** Whole-pixel magnification of the logical cell. */
    scale?: number;
    row?: number;
    /** Stretch to the parent box instead of using `scale`. */
    fill?: boolean;
  } = $props();
  const s = $derived(sheets[sheet]);
  const i = $derived(
    Math.max(0, (s.frames as readonly string[]).indexOf(frame)),
  );
</script>

<span
  class="ls-sprite"
  class:fill
  aria-hidden="true"
  style:width={fill ? undefined : `${s.w * scale}px`}
  style:height={fill ? undefined : `${s.h * scale}px`}
  style:background-image={`url('/games/little-secret/pixel/${sheet}.webp')`}
  style:background-size={`${s.frames.length * 100}% ${s.rows * 100}%`}
  style:background-position={`${s.frames.length > 1 ? (i / (s.frames.length - 1)) * 100 : 0}% ${s.rows > 1 ? (row / (s.rows - 1)) * 100 : 0}%`}
></span>

<style>
  .ls-sprite {
    display: inline-block;
    flex: none;
    background-repeat: no-repeat;
    image-rendering: pixelated;
    vertical-align: middle;
  }
  .fill {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
