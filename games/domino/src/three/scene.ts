import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { End } from '../index.js';
import type { Placement, Pose } from '../layout.js';
import { HARD_SLAM, flightMs3d } from '../constants.js';
import { buildProps } from './props.js';
import { FAR_Z, OUT_X, T, buildTable } from './table.js';
import { art, loadFont, plaqueTexture } from './textures.js';
import {
  THICK,
  blankMesh,
  configureTiles,
  disposeTiles,
  ghostMesh,
  tileMesh,
} from './tile.js';

/** Everything the table shows; the Board derives it from the game view. */
export type TableState = {
  placements: Placement[];
  ghosts: { end: End; pose: Pose; chosen: boolean }[];
  rack: { id: number; near: number; far: number; lifted: boolean }[];
  /** Hidden tiles held by the seats to your right, across and left. */
  standing: [number, number, number];
  /** Plaque text by relative seat: you, right, partner, left. */
  names: [string, string, string, string];
  /** Relative seat whose turn it is. */
  active: number | null;
  /** Green status plaque on your rail while it is your turn. */
  status: string | null;
  labels: { pass: string; arrange: string };
  enabled: { pass: boolean; arrange: boolean };
  charge: number;
  /** 0 = seated, 1 = straight overhead. */
  camera: number;
  motion: boolean;
  /** The last play, so a new tile can fly in from the seat that threw it. */
  last: { id: number; from: number; force: number } | null;
  /**
   * Phone layout: the board draws your hand and buttons in HTML, and the camera
   * looks straight down at the chain, zoomed to fit it.
   */
  compact: boolean;
};
export type Rect = { x: number; y: number; w: number; h: number };

/** Your own tiles are drawn a little larger, as if nearer to you. */
const RACK_SCALE = 1.28;
const rad = (d: number) => (d * Math.PI) / 180;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => 1 - (1 - t) ** 3;
const basis = (x: number[], y: number[], z: number[]) =>
  new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(
      new THREE.Vector3(...x),
      new THREE.Vector3(...y),
      new THREE.Vector3(...z),
    ),
  );
/** Standing orientations: the tile's face turned toward its owner. */
const FACING = {
  you: basis([0, -1, 0], [0, 0, 1], [-1, 0, 0]),
  right: basis([0, 1, 0], [1, 0, 0], [0, 0, -1]),
  across: basis([0, 1, 0], [0, 0, -1], [-1, 0, 0]),
  left: basis([0, 1, 0], [-1, 0, 0], [0, 0, 1]),
};
function flat(pose: Pose) {
  return {
    position: new THREE.Vector3(pose.x, THICK / 2 + 0.002, pose.y),
    quaternion: new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      -rad(pose.angle),
    ),
  };
}

type Tween = {
  mesh: THREE.Object3D;
  from: THREE.Vector3;
  to: THREE.Vector3;
  qFrom: THREE.Quaternion;
  qTo: THREE.Quaternion;
  start: number;
  duration: number;
  hop: number;
  done?: () => void;
};

export type Loading = {
  onRects: (rects: Record<string, Rect>) => void;
  /** 0–1 while art downloads and shaders compile. */
  onProgress?: (fraction: number) => void;
  /** First complete frame is on screen. */
  onReady?: () => void;
  /** Phones: lower resolution and shadows, standard materials, no props or backdrop. */
  lite?: boolean;
};

export function createTable(
  canvas: HTMLCanvasElement,
  { onRects, onProgress, onReady, lite = false }: Loading,
) {
  configureTiles(lite);
  const dpr = window.devicePixelRatio;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    // Dense phone screens hide jaggies; skip the extra multisampling there.
    antialias: !(lite && dpr >= 2),
    powerPreference: lite ? 'default' : 'high-performance',
  });
  renderer.setPixelRatio(Math.min(lite ? 1.5 : 2, dpr));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0b0806');
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = 0.28;

  const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 400);
  let dirty = true;
  const invalidate = () => (dirty = true);
  // Every texture goes through one manager so the board can show real progress.
  let artDone!: () => void;
  const artLoaded = new Promise<void>((r) => (artDone = r));
  const manager = new THREE.LoadingManager(
    () => artDone(),
    (_, loaded, total) => onProgress?.((loaded / total) * 0.8),
  );
  const loader = new THREE.TextureLoader(manager);
  // Same-origin art: request it plainly so it reuses the preloaded download
  // (a crossorigin request would fetch every image a second time).
  (loader as { crossOrigin?: string }).crossOrigin = undefined;

  // Lights: warm string lights over the table, cool night fill.
  scene.add(new THREE.HemisphereLight('#6a7ca8', '#3a2414', 0.4));
  const key = new THREE.SpotLight('#ffc990', 4.6, 0, 0.55, 1, 0);
  key.position.set(-8, 34, 12);
  key.target.position.set(0, 0, 1);
  key.castShadow = true;
  key.shadow.mapSize.setScalar(lite ? 1024 : 2048);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 5;
  key.shadow.camera.near = 10;
  key.shadow.camera.far = 70;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight('#ff9d52', 0.9);
  rim.position.set(12, 14, -30);
  scene.add(rim);
  const front = new THREE.DirectionalLight('#ffd9ad', 0.8);
  front.position.set(-6, 16, 30);
  scene.add(front);

  const table = buildTable(loader, invalidate);
  scene.add(table.group);
  // Desktop dressing: the painted patio, the beer, the drink and the chips.
  // Phones look straight down at the chain, so they skip it entirely.
  let props: ReturnType<typeof buildProps> | null = null;
  if (!lite) {
    const backdropTex = art(loader, 'patio.webp', undefined, invalidate);
    const backdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 56.25),
      new THREE.MeshBasicMaterial({ map: backdropTex, toneMapped: false }),
    );
    backdrop.position.set(0, -6.4, -45);
    scene.add(backdrop);
    props = buildProps(loader, invalidate);
    props.bottle.scale.setScalar(1.35);
    props.bottle.position.set(-9.5, T.railTop, FAR_Z + 1.15);
    props.drink.position.set(11, T.deck, 10.4);
    props.bowl.position.set(-OUT_X - 4.2, 0.25, 9.5);
    const stool = new THREE.Mesh(
      new RoundedBoxGeometry(6.5, 3.4, 6.5, 3, 0.2),
      new THREE.MeshStandardMaterial({ color: '#3b2515', roughness: 0.8 }),
    );
    stool.position.set(-OUT_X - 4.2, -1.45, 9.5);
    stool.receiveShadow = true;
    scene.add(props.group, stool);
  }

  // Plaques: carved boards with a canvas face on +y.
  const plaqueGeo = new Map<string, THREE.BufferGeometry>();
  const edge = new THREE.MeshStandardMaterial({
    color: '#5a3a1e',
    roughness: 0.7,
  });
  type Plaque = THREE.Mesh & { userData: { text?: string } };
  function plaque(w: number, h: number): Plaque {
    const k = `${w}:${h}`;
    let g = plaqueGeo.get(k);
    if (!g) {
      g = new RoundedBoxGeometry(w, 0.24, h, 2, 0.06);
      plaqueGeo.set(k, g);
    }
    const faceMat = new THREE.MeshStandardMaterial({
      roughness: 0.75,
      emissive: '#ffb45a',
      emissiveIntensity: 0,
    });
    const mesh = new THREE.Mesh(g, [edge, edge, faceMat, edge, edge, edge]);
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh as Plaque;
  }
  function label(
    p: Plaque,
    text: string,
    opts: Parameters<typeof plaqueTexture>[1] = {},
  ) {
    const k = JSON.stringify([text, opts]);
    if (p.userData.text === k) return;
    p.userData.text = k;
    const mat = (p.material as THREE.MeshStandardMaterial[])[2];
    mat.map?.dispose();
    mat.map = plaqueTexture(text, opts);
    mat.emissiveMap = mat.map;
    mat.needsUpdate = true;
    invalidate();
  }
  const tilt = (
    p: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    a: number,
    yaw = 0,
  ) => {
    p.position.set(x, y, z);
    p.rotation.set(a, yaw, 0, 'YXZ');
  };
  const names = [
    plaque(4.6, 1.3),
    plaque(3.3, 1.2),
    plaque(4.2, 1.2),
    plaque(3.3, 1.2),
  ];
  tilt(names[0], 0, T.railTop + 0.12, T.feltZ + 0.4, 0.5);
  tilt(names[2], 0, 0.75, -T.feltZ + 0.55, 0.95);
  const buttons = {
    pass: plaque(4.2, 1.7),
    arrange: plaque(3.8, 1.1),
  };
  tilt(buttons.pass, -9.7, T.deck + 0.35, 12.2, 0.55);
  tilt(buttons.arrange, -5.4, T.railTop + 0.12, T.feltZ + 0.4, 0.5);
  // Strength gauge on the right deck: a slot that fills with lamp light while you hold.
  const gauge = new THREE.Group();
  const slot = new THREE.Mesh(
    new RoundedBoxGeometry(4.4, 0.16, 0.9, 2, 0.06),
    new THREE.MeshStandardMaterial({ color: '#2a1a0e', roughness: 1 }),
  );
  const fillMat = new THREE.MeshStandardMaterial({
    color: '#ffb347',
    emissive: '#ff9d2e',
    emissiveIntensity: 1.4,
  });
  const fill = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.08, 0.56), fillMat);
  fill.position.y = 0.05;
  gauge.add(slot, fill);
  tilt(gauge, 9.7, T.deck + 0.2, 12.2, 0.55);
  scene.add(gauge);

  // Live tiles.
  const placed = new Map<number, THREE.Mesh>();
  const rackMeshes = new Map<number, THREE.Mesh>();
  const ghosts = new Map<End, THREE.Mesh>();
  const rows: THREE.Mesh[][] = [[], [], []];
  const tweens: Tween[] = [];
  let state: TableState | null = null;
  let shakeUntil = 0,
    shakeForce = 0;

  function tween(
    mesh: THREE.Object3D,
    to: { position: THREE.Vector3; quaternion: THREE.Quaternion },
    duration: number,
    hop = 0,
    delay = 0,
  ) {
    for (let i = tweens.length - 1; i >= 0; i--)
      if (tweens[i].mesh === mesh) tweens.splice(i, 1);
    tweens.push({
      mesh,
      from: mesh.position.clone(),
      to: to.position.clone(),
      qFrom: mesh.quaternion.clone(),
      qTo: to.quaternion.clone(),
      start: performance.now() + delay,
      duration,
      hop,
    });
  }
  function snap(
    mesh: THREE.Object3D,
    to: { position: THREE.Vector3; quaternion: THREE.Quaternion },
  ) {
    mesh.position.copy(to.position);
    mesh.quaternion.copy(to.quaternion);
  }

  function rackPose(i: number, n: number, lifted: boolean, cam: number) {
    // Tiles tip back as the camera rises, but never past what the trough holds.
    const lean = lerp(0.3, 0.95, cam);
    const up = new THREE.Vector3(0, Math.cos(lean), -Math.sin(lean));
    const spacing = Math.min(
      RACK_SCALE * 1.3,
      (T.rackHalf * 2 - 1.4) / Math.max(1, n),
    );
    const base = new THREE.Vector3(
      (i - (n - 1) / 2) * spacing,
      T.troughFloor + 0.05,
      lerp(10.6, 11.55, cam),
    );
    // The lifted tile rises straight up so it never tips into the inner lip.
    const position = base
      .addScaledVector(up, RACK_SCALE)
      .add(new THREE.Vector3(0, lifted ? 0.75 : 0, 0));
    const quaternion = new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(1, 0, 0), -lean)
      .multiply(FACING.you);
    return { position, quaternion };
  }
  function rowPose(rel: number, i: number, n: number) {
    const off = (i - (n - 1) / 2) * 1.06;
    const wobble = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      Math.sin(i * 12.9898) * 0.05,
    );
    if (rel === 2)
      return {
        position: new THREE.Vector3(off, T.railTop + 1, FAR_Z + 1.25),
        quaternion: wobble.multiply(FACING.across),
      };
    const s = rel === 1 ? 1 : -1;
    return {
      position: new THREE.Vector3(
        s * (T.feltX + T.rail * 0.45),
        T.railTop - 0.05 + 1,
        -2.6 + off * s,
      ),
      quaternion: wobble.multiply(rel === 1 ? FACING.right : FACING.left),
    };
  }

  function update(next: TableState) {
    const first = state === null;
    const prev = state;
    state = next;
    const cam = next.camera;
    const animate = next.motion && !first;

    // Where a freshly played tile starts its flight.
    let launch: {
      position: THREE.Vector3;
      quaternion: THREE.Quaternion;
    } | null = null;
    const last = next.last;
    if (animate && last && !placed.has(last.id)) {
      const r = rackMeshes.get(last.id);
      if (last.from === 0 && r)
        launch = {
          position: r.position.clone(),
          quaternion: r.quaternion.clone(),
        };
      else if (last.from > 0) {
        const row = rows[last.from - 1];
        const m = row[row.length - 1];
        if (m)
          launch = {
            position: m.position.clone(),
            quaternion: m.quaternion.clone(),
          };
      }
    }

    // Table tiles.
    const seen = new Set<number>();
    const landing = flightMs3d(last?.force ?? 0);
    const hard = (last?.force ?? 0) > HARD_SLAM;
    for (const p of next.placements) {
      seen.add(p.id);
      let mesh = placed.get(p.id);
      const target = flat(p);
      if (!mesh) {
        mesh = tileMesh(p.near, p.far);
        scene.add(mesh);
        placed.set(p.id, mesh);
        if (launch && last?.id === p.id) {
          snap(mesh, launch);
          tween(mesh, target, landing, 3.2 - (last?.force ?? 0) * 1.4);
        } else snap(mesh, target);
        continue;
      }
      if (
        mesh.position.distanceTo(target.position) > 1e-3 ||
        mesh.quaternion.angleTo(target.quaternion) > 1e-3
      ) {
        if (!animate) snap(mesh, target);
        else if (hard && launch) tween(mesh, target, 320, 0.35, landing * 0.85);
        else tween(mesh, target, hard ? 320 : 520, hard ? 0.35 : 0.08);
      }
    }
    for (const [id, mesh] of placed)
      if (!seen.has(id)) {
        scene.remove(mesh);
        placed.delete(id);
      }

    // Ghosts where the selected tile would plug in.
    for (const end of ['left', 'right'] as End[]) {
      const g = next.ghosts.find((x) => x.end === end);
      let mesh = ghosts.get(end);
      if (!g) {
        if (mesh) {
          scene.remove(mesh);
          (mesh.material as THREE.Material).dispose();
          ghosts.delete(end);
        }
        continue;
      }
      if (!mesh) {
        mesh = ghostMesh();
        scene.add(mesh);
        ghosts.set(end, mesh);
      }
      snap(mesh, flat(g.pose));
      mesh.position.y += 0.01;
      const m = mesh.material as THREE.MeshStandardMaterial;
      m.opacity = g.chosen ? 0.62 : 0.34;
      m.emissiveIntensity = g.chosen ? 0.7 : 0.3;
    }

    // Your rack.
    const ids = new Set(next.rack.map((t) => t.id));
    for (const [id, mesh] of rackMeshes)
      if (!ids.has(id)) {
        scene.remove(mesh);
        rackMeshes.delete(id);
      }
    const hud = next.compact;
    for (const m of rackMeshes.values()) m.visible = !hud;
    next.rack.forEach((t, i) => {
      let mesh = rackMeshes.get(t.id);
      const target = rackPose(i, next.rack.length, t.lifted, cam);
      if (!mesh) {
        mesh = tileMesh(t.near, t.far);
        mesh.castShadow = false;
        mesh.scale.setScalar(RACK_SCALE);
        scene.add(mesh);
        rackMeshes.set(t.id, mesh);
        mesh.visible = !hud;
        snap(mesh, target);
        return;
      }
      const cameraMoved = prev && prev.camera !== cam;
      if (!animate || cameraMoved) snap(mesh, target);
      else if (mesh.position.distanceTo(target.position) > 1e-3)
        tween(mesh, target, 160);
    });

    // Hidden hands standing on the rails.
    next.standing.forEach((n, k) => {
      const row = rows[k];
      while (row.length > n) scene.remove(row.pop()!);
      while (row.length < n) {
        const m = blankMesh();
        scene.add(m);
        row.push(m);
      }
      row.forEach((m, i) => snap(m, rowPose(k + 1, i, n)));
    });

    // Plaques.
    for (const p of [...names, ...Object.values(buttons)]) p.visible = !hud;
    next.names.forEach((text, rel) => {
      const p = names[rel];
      const mine = rel === 0 && next.status;
      label(p, mine ? next.status! : text, { green: !!mine, palm: !mine });
      const mat = (p.material as THREE.MeshStandardMaterial[])[2];
      mat.emissiveIntensity = next.active === rel && !mine ? 0.28 : 0;
    });
    for (const k of ['pass', 'arrange'] as const) {
      label(buttons[k], next.labels[k], {
        icon: k === 'pass' ? 'pass' : undefined,
      });
      const mat = (buttons[k].material as THREE.MeshStandardMaterial[])[2];
      mat.color.set(next.enabled[k] ? '#ffffff' : '#6d665c');
      mat.emissiveIntensity = next.enabled[k] && k !== 'arrange' ? 0.08 : 0;
    }
    // The gauge only shows while you hold a ghost to slam.
    gauge.visible = !hud && next.charge > 0;
    fill.scale.x = Math.max(0.001, next.charge);
    fill.position.x = -2.05 + 2.05 * next.charge;
    fillMat.emissiveIntensity = 0.6 + next.charge * 1.6;

    placeCamera();
    invalidate();
  }

  // Camera: an arc from the seated view to straight overhead, fitted to width.
  let width = 1,
    height = 1;
  const target = new THREE.Vector3();
  // Phone camera: straight down at the chain, eased toward a fit of its bounds.
  const fit = { x: 0, z: 0, d: 0 };
  const goal = { x: 0, z: 0, d: 0 };
  function fitGoal() {
    const pts = [
      ...(state?.placements ?? []),
      ...(state?.ghosts.map((g) => g.pose) ?? []),
    ];
    let x0 = -4.5,
      x1 = 4.5,
      z0 = -3,
      z1 = 3;
    if (pts.length) {
      x0 = Math.min(...pts.map((p) => p.x)) - 1.6;
      x1 = Math.max(...pts.map((p) => p.x)) + 1.6;
      z0 = Math.min(...pts.map((p) => p.y)) - 1.6;
      z1 = Math.max(...pts.map((p) => p.y)) + 1.6;
      // Never zoom in past a comfortable minimum view.
      const cx = (x0 + x1) / 2,
        cz = (z0 + z1) / 2;
      x0 = Math.min(x0, cx - 4.5);
      x1 = Math.max(x1, cx + 4.5);
      z0 = Math.min(z0, cz - 3);
      z1 = Math.max(z1, cz + 3);
    }
    const aspect = width / height;
    const rolled = aspect < 1;
    const halfV = Math.tan(rad(camera.fov / 2));
    const halfH = halfV * aspect;
    // Rolled 90° on portrait screens: the chain's long axis runs down the screen.
    const across = rolled ? z1 - z0 : x1 - x0,
      along = rolled ? x1 - x0 : z1 - z0;
    goal.x = (x0 + x1) / 2;
    goal.z = (z0 + z1) / 2;
    goal.d = Math.max(across / 2 / halfH, along / 2 / halfV) + THICK;
    if (!fit.d) Object.assign(fit, goal);
  }
  function placeCompact() {
    const rolled = width < height;
    camera.up.set(rolled ? 1 : 0, 0, rolled ? 0 : -1);
    camera.position.set(fit.x, fit.d, fit.z);
    target.set(fit.x, 0, fit.z);
    camera.lookAt(target);
  }
  function placeCamera() {
    if (state?.compact) {
      fitGoal();
      return placeCompact();
    }
    camera.up.set(0, 1, 0);
    const t = state?.camera ?? 0.25;
    const elevation = rad(lerp(21, 86, t));
    const aspect = width / height;
    const portrait = aspect < 1;
    target.set(
      0,
      lerp(-0.6, 0, t),
      portrait ? lerp(-7, -4, t) : lerp(2.2, 0.9, t),
    );
    const halfV = rad(camera.fov / 2);
    const halfH = Math.atan(Math.tan(halfV) * aspect);
    // Seated keeps the far rail and backdrop in view; overhead fits the whole table.
    // Portrait screens crop the outer rails rather than shrink every tile.
    const needW =
      (portrait ? lerp(12.5, 14.4, t) : lerp(14.2, OUT_X + 0.6, t)) /
      Math.tan(halfH);
    const needD = portrait
      ? 0
      : lerp(0, (T.front - FAR_Z) / 2 + 1.8, t) / Math.tan(halfV);
    const distance = Math.max(lerp(32, 34, t), needW, needD);
    camera.position.set(
      0,
      Math.sin(elevation) * distance,
      target.z + Math.cos(elevation) * distance,
    );
    camera.lookAt(target);
  }
  function resize() {
    const box = canvas.parentElement!.getBoundingClientRect();
    width = Math.max(1, box.width);
    height = Math.max(1, box.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    // Side name boards sit on their players' rails behind their tiles, off the leather. Narrow
    // screens crop the rails, so there they move to the front lip's corners.
    for (const [rel, s] of [
      [1, 1],
      [3, -1],
    ] as const) {
      if (camera.aspect < 1)
        tilt(names[rel], s * 10.9, T.railTop + 0.12, T.feltZ + 0.4, 0.5);
      else
        tilt(
          names[rel],
          // In front of that player's standing tiles, leaning up toward you.
          s * (T.feltX + T.rail / 2 + 0.3),
          T.railTop + 0.3,
          3.1,
          0.75,
          -s * 0.06,
        );
    }
    placeCamera();
    invalidate();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas.parentElement!);
  resize();

  function shake(force: number) {
    shakeForce = force;
    shakeUntil = performance.now() + 420;
  }

  // Screen rectangles of everything you can press, for the HTML button layer.
  const box3 = new THREE.Box3();
  const corner = new THREE.Vector3();
  let lastRects = '';
  function rectOf(o: THREE.Object3D): Rect {
    box3.setFromObject(o);
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (let i = 0; i < 8; i++) {
      corner
        .set(
          i & 1 ? box3.max.x : box3.min.x,
          i & 2 ? box3.max.y : box3.min.y,
          i & 4 ? box3.max.z : box3.min.z,
        )
        .project(camera);
      const sx = ((corner.x + 1) / 2) * width,
        sy = ((1 - corner.y) / 2) * height;
      x0 = Math.min(x0, sx);
      y0 = Math.min(y0, sy);
      x1 = Math.max(x1, sx);
      y1 = Math.max(y1, sy);
    }
    return {
      x: Math.round(x0),
      y: Math.round(y0),
      w: Math.round(x1 - x0),
      h: Math.round(y1 - y0),
    };
  }
  function emitRects() {
    const rects: Record<string, Rect> = {};
    for (const [id, m] of rackMeshes) rects[`rack:${id}`] = rectOf(m);
    for (const [end, m] of ghosts) rects[`ghost:${end}`] = rectOf(m);
    for (const k of ['pass', 'arrange'] as const) rects[k] = rectOf(buttons[k]);
    rects.gauge = rectOf(gauge);
    const json = JSON.stringify(rects);
    if (json !== lastRects) {
      lastRects = json;
      onRects(rects);
    }
  }

  let frame = 0;
  const q = new THREE.Quaternion();
  function loop(now: number) {
    frame = requestAnimationFrame(loop);
    let busy = false;
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      const k = Math.min(1, Math.max(0, (now - tw.start) / tw.duration));
      const e = ease(k);
      tw.mesh.position.lerpVectors(tw.from, tw.to, e);
      tw.mesh.position.y += Math.sin(Math.PI * k) * tw.hop;
      q.slerpQuaternions(tw.qFrom, tw.qTo, e);
      tw.mesh.quaternion.copy(q);
      if (k >= 1) {
        tweens.splice(i, 1);
        tw.done?.();
      }
      busy = true;
    }
    if (state?.compact) {
      // Ease the phone camera toward its fit.
      const k = state.motion ? 0.16 : 1;
      let moving = false;
      for (const key of ['x', 'z', 'd'] as const) {
        const diff = goal[key] - fit[key];
        if (Math.abs(diff) > 0.005) moving = true;
        fit[key] += diff * k;
      }
      if (moving) busy = true;
    }
    const shaking = now < shakeUntil;
    if (!busy && !shaking && !dirty) return;
    dirty = false;
    if (state?.compact) placeCompact();
    else placeCamera();
    if (shaking) {
      const k = (shakeUntil - now) / 420;
      const a = 0.18 * shakeForce * k;
      camera.position.x += Math.sin(now * 0.09) * a;
      camera.position.y += Math.cos(now * 0.11) * a * 0.6;
    }
    renderer.render(scene, camera);
    emitRects();
  }
  let disposed = false;
  // Show the table only once art, fonts and shaders are ready, so it never
  // pops in half-textured or stalls on the first frame.
  Promise.all([artLoaded, loadFont()])
    .then(async () => {
      // Redraw plaques with the carved face font.
      for (const p of [...names, ...Object.values(buttons)])
        p.userData.text = '';
      if (state) update({ ...state, motion: false });
      onProgress?.(0.85);
      await renderer.compileAsync(scene, camera);
      if (disposed) return;
      onProgress?.(1);
      renderer.render(scene, camera);
      emitRects();
      frame = requestAnimationFrame(loop);
      onReady?.();
    })
    .catch(() => {
      if (disposed) return;
      frame = requestAnimationFrame(loop);
      onReady?.();
    });

  /** Deals the hands in: rack tiles drop into the trough one by one, rails fill. */
  function intro() {
    if (!state?.motion) return;
    let i = 0;
    for (const mesh of rackMeshes.values()) {
      const to = {
        position: mesh.position.clone(),
        quaternion: mesh.quaternion.clone(),
      };
      mesh.position.y += 4;
      mesh.position.z -= 1.5;
      tween(mesh, to, 420, 0.4, 120 + i++ * 110);
    }
    rows.forEach((row, k) =>
      row.forEach((mesh, j) => {
        const to = {
          position: mesh.position.clone(),
          quaternion: mesh.quaternion.clone(),
        };
        mesh.position.y -= 2.2;
        tween(mesh, to, 360, 0, 60 + k * 90 + j * 60);
      }),
    );
    invalidate();
  }

  return {
    update,
    shake,
    intro,
    invalidate,
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      scene.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          (m as THREE.MeshStandardMaterial).map?.dispose();
          m.dispose();
        }
      });
      table.dispose();
      props?.dispose();
      plaqueGeo.forEach((g) => g.dispose());
      disposeTiles();
      env.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}
export type TableScene = ReturnType<typeof createTable>;
