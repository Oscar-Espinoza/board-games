import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { backTextures, faceTextures } from './textures.js';

/** A tile is 2 long (x), 1 wide (z) and THICK tall (y); its face points +y. */
export const THICK = 0.42;
const geometry = new RoundedBoxGeometry(2, THICK, 1, 4, 0.09);
type Ivory = THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial;
const physical = () =>
  new THREE.MeshPhysicalMaterial({
    color: '#ebe5d2',
    roughness: 0.38,
    clearcoat: 0.35,
    clearcoatRoughness: 0.4,
    sheen: 0.3,
    sheenColor: new THREE.Color('#fff3da'),
  });
/** Phones: a plain standard material, much cheaper to shade. */
const standard = () =>
  new THREE.MeshStandardMaterial({ color: '#ebe5d2', roughness: 0.4 });
let side: Ivory = physical();
let lite = false;
const faceMaterials = new Map<string, Ivory>();
/** Picks the tile materials for this table; call before creating tiles. */
export function configureTiles(next: boolean) {
  if (next === lite) return;
  disposeTiles();
  lite = next;
  side = lite ? standard() : physical();
}
function face(near: number, far: number) {
  const key = `${near}:${far}`;
  let mat = faceMaterials.get(key);
  if (!mat) {
    const t = faceTextures(near, far);
    mat = side.clone();
    mat.color.set('#ffffff');
    mat.map = t.map;
    mat.bumpMap = t.bump;
    mat.bumpScale = 1.2;
    mat.roughnessMap = t.rough;
    mat.roughness = 1;
    if (mat instanceof THREE.MeshPhysicalMaterial) {
      mat.specularIntensityMap = t.spec;
      // No clearcoat or sheen on the face: they would wash the black pips grey.
      mat.clearcoat = 0;
      mat.sheen = 0;
    }
    faceMaterials.set(key, mat);
  }
  return mat;
}
let backMaterial: Ivory | null = null;
function back() {
  if (!backMaterial) {
    backMaterial = side.clone();
    backMaterial.color.set('#ffffff');
    backMaterial.map = backTextures();
  }
  return backMaterial;
}
const ghostMaterial = new THREE.MeshStandardMaterial({
  color: '#fff1cf',
  emissive: '#ffcf7a',
  emissiveIntensity: 0.35,
  transparent: true,
  opacity: 0.38,
  depthWrite: false,
});

/** Box groups are +x, −x, +y, −y, +z, −z. */
export function tileMesh(near: number, far: number, faceDown = false) {
  const top = faceDown ? back() : face(near, far);
  const mesh = new THREE.Mesh(geometry, [
    side,
    side,
    top,
    faceDown ? face(near, far) : back(),
    side,
    side,
  ]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
/** A hidden tile: ivory back on both sides. */
export function blankMesh() {
  const mesh = new THREE.Mesh(geometry, [
    side,
    side,
    back(),
    back(),
    side,
    side,
  ]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
export function ghostMesh() {
  const mesh = new THREE.Mesh(geometry, ghostMaterial.clone());
  mesh.renderOrder = 2;
  return mesh;
}
export function disposeTiles() {
  geometry.dispose();
  side.dispose();
  ghostMaterial.dispose();
  backMaterial?.dispose();
  backMaterial = null;
  faceMaterials.forEach((m) => m.dispose());
  faceMaterials.clear();
}
