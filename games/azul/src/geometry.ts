export type AzulLayoutMode = 'tabletop' | 'compact';

/** Bounds include the controls and the photographed plate, not only its tiles. */
export function ringGeometry(count: number, mode: AzulLayoutMode) {
  const compact = mode === 'compact';
  const width = compact ? 340 : 926;
  const height = compact ? 340 : 486;
  const disc = compact ? 56 : 126;
  const radiusX = compact ? (width - disc) / 2 : 400;
  const radiusY = compact ? (height - disc) / 2 : 180;
  const points = Array.from({ length: count }, (_, i) => {
    // The half step leaves room above the centre title and puts a single
    // display at six o'clock, far enough from both centre tiles and board.
    const angle = -Math.PI / 2 + ((i + 0.5) / count) * Math.PI * 2;
    return {
      x: width / 2 + radiusX * Math.cos(angle),
      y: height / 2 + radiusY * Math.sin(angle),
      angle,
    };
  });
  return {
    mode,
    width,
    height,
    disc,
    radiusX,
    radiusY,
    points,
    center: { width: compact ? 146 : 198, height: 160 },
  };
}
/** Stable within a colour cluster, including a distinct location for every tile. */
export function scatter(slot: number) {
  return {
    x: (slot * 7) % 17,
    y: (slot * 11) % 19,
    angle: ((slot * 13) % 31) - 15,
  };
}
export const railPosition = (score: number) =>
  Math.max(0, Math.min(100, score));
