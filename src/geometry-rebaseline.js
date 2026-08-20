import * as THREE from 'three';
import { BrickStructure, BRICK_H } from './brick-engine.js';

const close = (a, b, eps = 0.03) => Math.abs(Number(a) - Number(b)) <= eps;
const CATALOG_SIZE = new Map([
  ['2549', [16, 4, BRICK_H * 3]],
  ['33129', [8, 18, BRICK_H * (10 / 3)]],
  ['32000', [1, 2, BRICK_H]],
  ['30149', [6, 5, BRICK_H * 2]],
  ['30147', [1, 2, BRICK_H * 2]],
]);
const TIRE_PARTS = new Set(['3483', '2346']);

function normalizeSpec(input) {
  const spec = { ...input };
  const partNo = String(spec.partNo ?? '');
  const suppliedSize = Array.isArray(spec.size) ? [...spec.size] : null;

  // Canonical catalog envelopes override early scene proxies. Exact transforms
  // remain separate, so this only changes presentation geometry.
  if (CATALOG_SIZE.has(partNo)) spec.size = [...CATALOG_SIZE.get(partNo)];

  // Generic bridge guard: the legacy renderer assumes the span is local X.
  // If older data describes a bridge with the long axis as local Z, rotate the
  // canonical X-span into the same world axis before the renderer sees it.
  if (spec.shape === 'bridge') {
    const source = suppliedSize ?? spec.size ?? [16, 4, BRICK_H * 3];
    const sourceLongWasZ = source[1] > source[0];
    const span = Math.max(source[0], source[1]);
    const cross = Math.min(source[0], source[1]);
    spec.size = partNo === '2549' ? [...CATALOG_SIZE.get('2549')] : [span, cross, source[2]];
    if (sourceLongWasZ) {
      const rotation = [...(spec.rotation ?? [0, 0, 0])];
      rotation[1] = (rotation[1] ?? 0) + Math.PI / 2;
      spec.rotation = rotation;
    }
  }

  if (spec.assembly === 'terrain-mold') {
    spec.anchored = true;
    spec.interactive = false;
    spec.studs = false;
  }
  return spec;
}

function rebuildTire(group, id, size, clickable, interactive = true) {
  const oldChildren = new Set(group.children);
  for (let i = clickable.length - 1; i >= 0; i -= 1) {
    if (oldChildren.has(clickable[i])) clickable.splice(i, 1);
  }
  group.clear();

  const outerRadius = size[2] / 2;
  const tubeRadius = Math.max(0.17, outerRadius * 0.28);
  const majorRadius = Math.max(0.12, outerRadius - tubeRadius);
  const widthScale = Math.max(0.7, size[0] / (tubeRadius * 2));
  const geometry = new THREE.TorusGeometry(majorRadius, tubeRadius, 10, 24);
  const material = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.86 });
  const tire = new THREE.Mesh(geometry, material);
  tire.rotation.y = Math.PI / 2;
  tire.scale.z = widthScale;
  tire.castShadow = true;
  tire.receiveShadow = true;
  tire.userData.partId = id;
  group.add(tire);
  if (interactive) clickable.push(tire);
}

const originalLoad = BrickStructure.prototype.load;
BrickStructure.prototype.load = function (model) {
  const normalized = {
    ...model,
    parts: (model.parts ?? []).map(normalizeSpec),
  };
  const result = originalLoad.call(this, normalized);

  for (const spec of normalized.parts) {
    const partNo = String(spec.partNo ?? '');
    if (!TIRE_PARTS.has(partNo)) continue;
    const id = spec.id;
    const group = this.parts.get(id);
    if (!group) continue;
    rebuildTire(group, id, group.userData.spec.size, this.clickable, spec.interactive !== false);
  }
  return result;
};

function correctMesh(object) {
  if (!object?.isMesh) return;
  const p = object.geometry?.parameters;
  if (!p) return;

  // main.js decor river: move it from the old flat-base elevation into the
  // molded 30271px1 channel. The actual baseplate is six bricks high.
  if (close(p.width, 10.6) && close(p.height, 0.08) && close(p.depth, 47.8)) {
    object.position.y = -6.45;
    object.userData.geometryRebaseline = 'river-channel';
    return;
  }

  // Ripple strips created by main.js. Preserve x/z layout, only correct their
  // vertical placement so they sit immediately above the lowered river.
  if (close(p.height, 0.018, 0.006) && close(p.depth, 0.065, 0.012) && p.width >= 5.7 && p.width <= 7.4) {
    object.position.y = -6.39;
    object.userData.geometryRebaseline = 'river-ripple';
  }
}

function correctObject(object) {
  correctMesh(object);
  if (object?.traverse) object.traverse(child => {
    if (child !== object) correctMesh(child);
  });
}

// Apply decor corrections at insertion time. This catches initial construction
// and Reset rebuilds without polling or traversing the scene continuously.
const originalAdd = THREE.Object3D.prototype.add;
THREE.Object3D.prototype.add = function (...objects) {
  const result = originalAdd.apply(this, objects);
  for (const object of objects) correctObject(object);
  return result;
};
