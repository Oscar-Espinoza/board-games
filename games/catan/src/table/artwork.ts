import wood from '../../assets/resource-wood.webp?url';
import wool from '../../assets/resource-wool.webp?url';
import wheat from '../../assets/resource-wheat.webp?url';
import brick from '../../assets/resource-brick.webp?url';
import ore from '../../assets/resource-ore.webp?url';

export const resourceArtwork = [wood, wool, wheat, brick, ore];

/** Explicit face colours keep wooden bevels consistent in SVG across browsers. */
export function shade(hex: string, factor: number) {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgb(${[16, 8, 0].map((shift) => Math.min(255, Math.round(((value >> shift) & 255) * factor))).join(' ')})`;
}
