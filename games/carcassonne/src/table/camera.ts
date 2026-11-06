export type Point = { x: number; y: number };
export type Camera = Point & { scale: number };
// One affine ground plane drives drawing, hit testing, panning and focus.
// An orthographic view avoids shrinking distant tiles and fragile CSS 3D hits.
export const ground = { a: 1, b: 0.05, c: -0.13, d: 0.74 };
export const groundMatrix = `matrix(${ground.a} ${ground.b} ${ground.c} ${ground.d} 0 0)`;
const determinant = ground.a * ground.d - ground.b * ground.c;
export const uprightMatrix = `matrix(${ground.d / determinant} ${-ground.b / determinant} ${-ground.c / determinant} ${ground.a / determinant} 0 0)`;
function project({ x, y }: Point): Point {
  return { x: ground.a * x + ground.c * y, y: ground.b * x + ground.d * y };
}
export function unproject({ x, y }: Point): Point {
  return {
    x: (ground.d * x - ground.c * y) / determinant,
    y: (-ground.b * x + ground.a * y) / determinant,
  };
}
/** World offset that reads as `h` units straight up on screen. */
export function lift(h: number): Point {
  return unproject({ x: 0, y: -h });
}
export function screen(point: Point, camera: Camera, anchor: Point): Point {
  const p = project({ x: point.x - camera.x, y: point.y - camera.y });
  return { x: anchor.x + p.x * camera.scale, y: anchor.y + p.y * camera.scale };
}
export function world(point: Point, camera: Camera, anchor: Point): Point {
  const p = unproject({
    x: (point.x - anchor.x) / camera.scale,
    y: (point.y - anchor.y) / camera.scale,
  });
  return { x: p.x + camera.x, y: p.y + camera.y };
}
export function zoomAt(
  camera: Camera,
  anchor: Point,
  pointer: Point,
  factor: number,
): Camera {
  const before = world(pointer, camera, anchor);
  const scale = Math.max(0.12, Math.min(3, camera.scale * factor));
  const after = world(pointer, { ...camera, scale }, anchor);
  return {
    x: camera.x + before.x - after.x,
    y: camera.y + before.y - after.y,
    scale,
  };
}
export function tableSpace(width: number, height: number) {
  const compact = width <= 900 || height <= 540;
  const left = compact ? 20 : 236;
  const right = 36;
  const top = compact ? 146 : 92;
  const bottom = compact ? 180 : 218;
  return {
    width: Math.max(100, width - left - right),
    height: Math.max(90, height - top - bottom),
    anchor: { x: (left + width - right) / 2, y: (top + height - bottom) / 2 },
  };
}
export function fitCamera(
  cells: Point[],
  width: number,
  height: number,
): Camera {
  if (!cells.length) return { x: 50, y: 50, scale: 1.5 };
  const corners = cells.flatMap(({ x, y }) => [
    project({ x: x * 100, y: y * 100 }),
    project({ x: x * 100 + 100, y: y * 100 }),
    project({ x: x * 100, y: y * 100 + 100 }),
    project({ x: x * 100 + 100, y: y * 100 + 100 }),
  ]);
  const minX = Math.min(...corners.map((p) => p.x)),
    maxX = Math.max(...corners.map((p) => p.x));
  const minY = Math.min(...corners.map((p) => p.y)),
    maxY = Math.max(...corners.map((p) => p.y));
  const center = unproject({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 });
  const space = tableSpace(width, height);
  return {
    ...center,
    scale: Math.max(
      0.12,
      Math.min(
        1.65,
        space.width / (maxX - minX + 90),
        space.height / (maxY - minY + 90),
      ),
    ),
  };
}
