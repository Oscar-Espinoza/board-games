import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { art } from './textures.js';

/**
 * The carved wooden table, in tile units (a tile is 1 × 2). The leather top is
 * y = 0 and centred on the origin; +z points at the local player.
 */
export const T = {
  /** Leather play area half extents. */
  feltX: 14,
  feltZ: 8.5,
  rail: 2.4,
  railTop: 0.9,
  /** Front trough that holds your rack. */
  troughZ: [9.3, 11.6] as const,
  troughFloor: -2.1,
  rackHalf: 6.6,
  front: 14.2,
  /** The lower front deck beside and in front of the rack. */
  deck: -1.95,
};
export const OUT_X = T.feltX + T.rail;
export const FAR_Z = -T.feltZ - T.rail;

export function buildTable(loader: THREE.TextureLoader, onLoad: () => void) {
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const keep = <D extends { dispose(): void }>(d: D) => (
    disposables.push(d),
    d
  );

  const woodMaps: THREE.Texture[] = [];
  const woodBase = keep(
    art(loader, 'wood.webp', [1, 1], () => {
      woodMaps.forEach((m) => (m.needsUpdate = true));
      onLoad();
    }),
  );
  woodBase.wrapS = woodBase.wrapT = THREE.RepeatWrapping;
  const leather = keep(art(loader, 'leather.webp', [3, 2], onLoad));

  const woodCache = new Map<string, THREE.MeshStandardMaterial>();
  /** Wood tiled by world size, so grain stays the same scale on every part. */
  const wood = (u: number, v: number, tone = '#8f705a') => {
    const key = `${u.toFixed(1)}:${v.toFixed(1)}:${tone}`;
    let m = woodCache.get(key);
    if (!m) {
      // Shares the loaded image; a clone would upload before it arrives.
      const map = keep(new THREE.Texture());
      map.source = woodBase.source;
      map.colorSpace = woodBase.colorSpace;
      map.anisotropy = woodBase.anisotropy;
      map.wrapS = map.wrapT = THREE.RepeatWrapping;
      map.repeat.set(u / 9, v / 9);
      if (woodBase.image) map.needsUpdate = true;
      woodMaps.push(map);
      m = keep(
        new THREE.MeshStandardMaterial({
          map,
          bumpMap: map,
          bumpScale: 2.2,
          color: tone,
          roughness: 0.62,
          metalness: 0,
        }),
      );
      woodCache.set(key, m);
    }
    return m;
  };
  const box = (
    [x0, x1]: readonly [number, number],
    [y0, y1]: readonly [number, number],
    [z0, z1]: readonly [number, number],
    radius = 0.22,
    tone?: string,
  ) => {
    const w = x1 - x0,
      h = y1 - y0,
      d = z1 - z0;
    const g = keep(
      new RoundedBoxGeometry(w, h, d, 3, Math.min(radius, h / 2.1)),
    );
    const mesh = new THREE.Mesh(g, wood(Math.max(w, d), Math.min(w, d), tone));
    mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  // Leather play surface, set a hair below the rails' inner lip.
  const felt = new THREE.Mesh(
    keep(new THREE.PlaneGeometry(T.feltX * 2 + 0.4, T.feltZ * 2 + 0.4)),
    keep(
      new THREE.MeshStandardMaterial({
        map: leather,
        bumpMap: leather,
        bumpScale: 1.2,
        roughness: 0.88,
        color: '#958778',
      }),
    ),
  );
  felt.rotation.x = -Math.PI / 2;
  felt.receiveShadow = true;
  group.add(felt);

  const top = T.railTop;
  // Body under the top.
  box([-OUT_X, OUT_X], [-3.2, -0.05], [FAR_Z, T.feltZ], 0.3, '#6e5645');
  box(
    [-OUT_X, OUT_X],
    [-3.2, T.troughFloor - 0.3],
    [T.feltZ, T.front],
    0.3,
    '#6e5645',
  );
  // Far rail, with a raised inner lip like a carved frame.
  box([-OUT_X, OUT_X], [-0.1, top], [FAR_Z, -T.feltZ]);
  box(
    [-T.feltX, T.feltX],
    [-0.1, top * 0.55],
    [-T.feltZ, -T.feltZ + 0.35],
    0.12,
    '#a8876e',
  );
  // Side rails.
  for (const s of [-1, 1]) {
    box(
      s < 0 ? [-OUT_X, -T.feltX] : [T.feltX, OUT_X],
      [-0.1, top],
      [-T.feltZ, T.troughZ[0]],
    );
    box(
      s < 0 ? [-T.feltX, -T.feltX + 0.35] : [T.feltX - 0.35, T.feltX],
      [-0.1, top * 0.55],
      [-T.feltZ, T.feltZ],
      0.12,
      '#a8876e',
    );
    // Long slot in each side rail.
    const slot = new THREE.Mesh(
      keep(new RoundedBoxGeometry(0.55, 0.05, 7.5, 2, 0.02)),
      keep(new THREE.MeshStandardMaterial({ color: '#0e0703', roughness: 1 })),
    );
    slot.position.set(s * (T.feltX + T.rail * 0.45), top + 0.005, -2.6);
    group.add(slot);
    // Lower deck beside the rack, where the plaques sit.
    box(
      s < 0 ? [-OUT_X, -T.rackHalf] : [T.rackHalf, OUT_X],
      [T.troughFloor - 0.3, T.deck],
      [T.troughZ[0], T.front],
    );
  }
  // Front: the inner lip drops to a low trough that holds your rack.
  box(
    [-T.feltX, T.feltX],
    [T.troughFloor - 0.3, top],
    [T.feltZ, T.troughZ[0]],
    0.18,
  );
  box(
    [-T.rackHalf, T.rackHalf],
    [T.troughFloor - 0.4, T.troughFloor],
    [...T.troughZ],
    0.05,
    '#4a382c',
  );
  box(
    [-T.rackHalf, T.rackHalf],
    [T.troughFloor - 0.3, T.deck],
    [T.troughZ[1], T.front],
    0.26,
  );

  // Cup holders in the far corners: dark well with a turned lip.
  const well = document.createElement('canvas');
  well.width = well.height = 128;
  const wx = well.getContext('2d')!;
  const wg = wx.createRadialGradient(64, 70, 8, 64, 64, 64);
  wg.addColorStop(0, '#050201');
  wg.addColorStop(0.7, '#150a04');
  wg.addColorStop(0.92, '#3a2210');
  wg.addColorStop(1, '#5a371a');
  wx.fillStyle = wg;
  wx.fillRect(0, 0, 128, 128);
  const wellTex = keep(new THREE.CanvasTexture(well));
  wellTex.colorSpace = THREE.SRGBColorSpace;
  const wellMat = keep(
    new THREE.MeshStandardMaterial({ map: wellTex, roughness: 1 }),
  );
  const disk = keep(new THREE.CircleGeometry(1, 40));
  const lip = keep(new THREE.TorusGeometry(1.02, 0.13, 12, 48));
  for (const [x, z] of [
    [-OUT_X + 1.25, FAR_Z + 1.2],
    [OUT_X - 1.25, FAR_Z + 1.2],
  ]) {
    const d = new THREE.Mesh(disk, wellMat);
    d.rotation.x = -Math.PI / 2;
    d.position.set(x, top + 0.004, z);
    const l = new THREE.Mesh(lip, wood(2, 2));
    l.rotation.x = -Math.PI / 2;
    l.position.set(x, top + 0.02, z);
    l.castShadow = true;
    group.add(d, l);
  }
  // Patio floor under everything.
  const floor = new THREE.Mesh(
    keep(new THREE.PlaneGeometry(90, 70)),
    keep(new THREE.MeshStandardMaterial({ color: '#1a120c', roughness: 1 })),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -12, 5);
  floor.receiveShadow = true;
  group.add(floor);
  // Legs.
  for (const x of [-OUT_X + 1.2, OUT_X - 1.8])
    for (const z of [FAR_Z + 1.2, T.front - 1.8])
      box([x, x + 0.9], [-12, -3], [z, z + 0.9], 0.1, '#6e5645');

  return { group, dispose: () => disposables.forEach((d) => d.dispose()) };
}
