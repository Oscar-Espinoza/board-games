import * as THREE from 'three';
import { art } from './textures.js';

/** Table props from the reference: a Polar beer, a lime drink, a bowl of chips. */
export function buildProps(loader: THREE.TextureLoader, onLoad: () => void) {
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const keep = <D extends { dispose(): void }>(d: D) => (
    disposables.push(d),
    d
  );
  const lathe = (pts: [number, number][], segments = 40) =>
    keep(
      new THREE.LatheGeometry(
        pts.map(([r, y]) => new THREE.Vector2(r, y)),
        segments,
      ),
    );

  // Stubby amber beer bottle with its paper labels, on a cork coaster.
  const bottle = new THREE.Group();
  const glass = keep(
    new THREE.MeshPhysicalMaterial({
      color: '#3b1904',
      roughness: 0.08,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      ior: 1.5,
      transparent: true,
      opacity: 0.94,
    }),
  );
  const body = new THREE.Mesh(
    lathe([
      [0, 0],
      [0.58, 0],
      [0.66, 0.1],
      [0.66, 2.2],
      [0.6, 2.6],
      [0.34, 3.1],
      [0.26, 3.5],
      [0.25, 4.25],
      [0.29, 4.32],
      [0.29, 4.45],
      [0, 4.45],
    ]),
    glass,
  );
  body.castShadow = true;
  const paper = (file: string) =>
    keep(
      new THREE.MeshStandardMaterial({
        map: keep(art(loader, file, undefined, onLoad)),
        roughness: 0.7,
      }),
    );
  // Body label wraps most of the bottle at the print's 2:1 proportions,
  // centred on the side facing the players (+z).
  const wrap = (1.45 * 2) / 0.672;
  const label = new THREE.Mesh(
    keep(
      new THREE.CylinderGeometry(
        0.672,
        0.672,
        1.45,
        48,
        1,
        true,
        -wrap / 2,
        wrap,
      ),
    ),
    paper('beer-label.webp'),
  );
  label.position.y = 1.2;
  const neck = new THREE.Mesh(
    keep(
      new THREE.CylinderGeometry(
        0.262,
        0.3,
        0.5,
        32,
        1,
        true,
        Math.PI,
        Math.PI * 2,
      ),
    ),
    paper('beer-neck.webp'),
  );
  neck.position.y = 3.62;
  const cap = new THREE.Mesh(
    keep(new THREE.CylinderGeometry(0.31, 0.31, 0.16, 24)),
    keep(
      new THREE.MeshStandardMaterial({
        color: '#c9a24a',
        metalness: 0.85,
        roughness: 0.3,
      }),
    ),
  );
  cap.position.y = 4.5;
  const coaster = new THREE.Mesh(
    keep(new THREE.CylinderGeometry(1, 1, 0.08, 40)),
    keep(new THREE.MeshStandardMaterial({ color: '#6e4d2e', roughness: 0.9 })),
  );
  coaster.position.y = -0.04;
  coaster.receiveShadow = true;
  bottle.add(coaster, body, label, neck, cap);
  group.add(bottle);

  // Tall glass with ice, lime and a straw.
  const drink = new THREE.Group();
  const cup = new THREE.Mesh(
    lathe([
      [0, 0],
      [0.7, 0],
      [0.78, 2.4],
      [0.72, 2.4],
      [0.64, 0.12],
      [0, 0.12],
    ]),
    keep(
      new THREE.MeshPhysicalMaterial({
        color: '#ffffff',
        roughness: 0.04,
        ior: 1.45,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
      }),
    ),
  );
  const liquid = new THREE.Mesh(
    keep(new THREE.CylinderGeometry(0.68, 0.62, 1.7, 32)),
    keep(
      new THREE.MeshPhysicalMaterial({
        color: '#e6efc8',
        roughness: 0.1,
        transparent: true,
        opacity: 0.55,
      }),
    ),
  );
  liquid.position.y = 0.97;
  const ice = keep(new THREE.BoxGeometry(0.45, 0.4, 0.45));
  const iceMat = keep(
    new THREE.MeshPhysicalMaterial({
      color: '#f4fbff',
      roughness: 0.2,
      transparent: true,
      opacity: 0.7,
    }),
  );
  for (const [x, y, z, r] of [
    [0.2, 1.6, 0.1, 0.4],
    [-0.25, 1.45, -0.15, 1.1],
    [0.05, 1.2, -0.3, 0.2],
  ]) {
    const cube = new THREE.Mesh(ice, iceMat);
    cube.position.set(x, y, z);
    cube.rotation.set(r, r * 1.7, r * 0.5);
    drink.add(cube);
  }
  const lime = new THREE.Mesh(
    keep(
      new THREE.CylinderGeometry(0.42, 0.42, 0.08, 24, 1, false, 0, Math.PI),
    ),
    keep(new THREE.MeshStandardMaterial({ color: '#8fc23d', roughness: 0.5 })),
  );
  lime.position.set(-0.15, 1.3, 0.25);
  lime.rotation.set(1.2, 0.3, 0.4);
  const straw = new THREE.Mesh(
    keep(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 10)),
    keep(new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.4 })),
  );
  straw.position.set(0.25, 2.1, 0);
  straw.rotation.z = -0.28;
  cup.castShadow = true;
  drink.add(liquid, cup, lime, straw);
  group.add(drink);

  // Enamel bowl of plantain chips.
  const bowl = new THREE.Group();
  const enamel = new THREE.Mesh(
    lathe([
      [0, 0],
      [1.3, 0],
      [1.9, 0.5],
      [2.2, 1.6],
      [2.3, 1.7],
      [2.15, 1.72],
      [2.05, 1.6],
      [1.75, 0.6],
      [1.2, 0.15],
      [0, 0.15],
    ]),
    keep(
      new THREE.MeshPhysicalMaterial({
        color: '#f2efe6',
        roughness: 0.25,
        clearcoat: 0.8,
        side: THREE.DoubleSide,
      }),
    ),
  );
  enamel.castShadow = true;
  const rim = new THREE.Mesh(
    keep(new THREE.TorusGeometry(2.2, 0.07, 8, 48)),
    keep(new THREE.MeshStandardMaterial({ color: '#1f3b73', roughness: 0.4 })),
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 1.7;
  const chip = keep(new THREE.CircleGeometry(0.38, 14));
  const chipMat = keep(
    new THREE.MeshStandardMaterial({
      color: '#e2a93a',
      roughness: 0.6,
      side: THREE.DoubleSide,
    }),
  );
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 70; i++) {
    const c = new THREE.Mesh(chip, chipMat);
    const a = rand() * Math.PI * 2,
      r = Math.sqrt(rand()) * 1.75;
    c.position.set(
      Math.cos(a) * r,
      1.15 + rand() * 0.55 - r * 0.12,
      Math.sin(a) * r,
    );
    c.rotation.set(
      -Math.PI / 2 + (rand() - 0.5) * 1.4,
      rand() * 3,
      (rand() - 0.5) * 1.4,
    );
    c.scale.set(1, 0.8 + rand() * 0.4, 1);
    c.castShadow = true;
    bowl.add(c);
  }
  bowl.add(enamel, rim);
  group.add(bowl);

  return {
    group,
    bottle,
    drink,
    bowl,
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}
