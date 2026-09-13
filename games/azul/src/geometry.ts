/** Bounds include the controls, not just the printed discs. CSS uses these sizes. */
export function ringGeometry(count: number, phone: boolean) {
  const size = phone ? 340 : 460;
  const disc = phone ? 56 : 96;
  const radius = (size - disc) / 2;
  const points = Array.from({ length: count }, (_, i) => {
    const angle = -Math.PI / 2 + ((i + 0.5) / count) * Math.PI * 2;
    return {
      x: size / 2 + radius * Math.cos(angle),
      y: size / 2 + radius * Math.sin(angle),
    };
  });
  return { size, disc, radius, points, center: { width: 146, height: 160 } };
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
