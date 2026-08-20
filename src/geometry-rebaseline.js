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

  if (CATALOG_SIZE.has(partNo)) spec.size = [...CATALOG_SIZE.get(partNo)];

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

function clearGroupGeometry(group, clickable) {
  const old = new Set();
  group.traverse(object => { if (object.isMesh) old.add(object); });
  for (let i = clickable.length - 1; i >= 0; i -= 1) {
    if (old.has(clickable[i])) clickable.splice(i, 1);
  }
  group.clear();
}

function addMesh(group, geometry, material, id, clickable, interactive, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.partId = id;
  group.add(mesh);
  if (interactive) clickable.push(mesh);
  return mesh;
}

function rebuildTire(group, id, size, clickable, interactive = true) {
  clearGroupGeometry(group, clickable);
  const outerRadius = size[2] / 2;
  const tubeRadius = Math.max(0.17, outerRadius * 0.28);
  const majorRadius = Math.max(0.12, outerRadius - tubeRadius);
  const widthScale = Math.max(0.7, size[0] / (tubeRadius * 2));
  const geometry = new THREE.TorusGeometry(majorRadius, tubeRadius, 10, 24);
  const material = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.86 });
  const tire = addMesh(group, geometry, material, id, clickable, interactive, [0, 0, 0], [0, Math.PI / 2, 0]);
  tire.scale.z = widthScale;
}

function rebuildVehicleTub(group, id, clickable, interactive = true) {
  clearGroupGeometry(group, clickable);
  const gray = new THREE.MeshStandardMaterial({ color: 0xa5a9a7, roughness: 0.68 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x777b7b, roughness: 0.72 });

  addMesh(group, new THREE.BoxGeometry(5.8, 0.34, 4.8), gray, id, clickable, interactive, [0, -1.0, 0]);
  addMesh(group, new THREE.BoxGeometry(0.36, 1.45, 4.7), gray, id, clickable, interactive, [-2.72, -0.28, 0]);
  addMesh(group, new THREE.BoxGeometry(0.36, 1.45, 4.7), gray, id, clickable, interactive, [2.72, -0.28, 0]);
  addMesh(group, new THREE.BoxGeometry(5.45, 1.5, 0.38), gray, id, clickable, interactive, [0, -0.25, 2.2]);

  for (const x of [-1.35, 1.35]) {
    addMesh(group, new THREE.BoxGeometry(2.15, 0.28, 1.7), dark, id, clickable, interactive, [x, -0.77, 0.55]);
    addMesh(group, new THREE.BoxGeometry(2.15, 1.3, 0.28), gray, id, clickable, interactive, [x, -0.1, 1.18], [-0.16, 0, 0]);
  }
}

function rebuildVehicleGrille(group, id, clickable, interactive = true) {
  clearGroupGeometry(group, clickable);
  const gray = new THREE.MeshStandardMaterial({ color: 0xa5a9a7, roughness: 0.62 });
  const grille = new THREE.MeshStandardMaterial({ color: 0x555a59, roughness: 0.82 });
  const lamp = new THREE.MeshStandardMaterial({ color: 0xd6d8cb, roughness: 0.42 });

  // Broad direction is local Z; the part is rotated 90° in the car so this
  // becomes the two-stud-wide front face.
  addMesh(group, new THREE.BoxGeometry(0.46, 1.35, 1.75), gray, id, clickable, interactive, [-0.04, -0.25, 0]);
  addMesh(group, new THREE.CylinderGeometry(0.72, 0.72, 0.46, 18, 1, false, 0, Math.PI), gray, id, clickable, interactive, [-0.04, 0.42, 0], [0, 0, Math.PI / 2]);
  for (let z = -0.55; z <= 0.55; z += 0.22) {
    addMesh(group, new THREE.BoxGeometry(0.5, 1.15, 0.055), grille, id, clickable, interactive, [-0.29, -0.18, z]);
  }
  for (const z of [-1.02, 1.02]) {
    addMesh(group, new THREE.CylinderGeometry(0.34, 0.34, 0.34, 16), lamp, id, clickable, interactive, [-0.32, -0.28, z], [0, 0, Math.PI / 2]);
  }
}

function rebuildBoatHull(group, id, clickable, interactive = true) {
  clearGroupGeometry(group, clickable);
  const brown = new THREE.MeshStandardMaterial({ color: 0x6b3f24, roughness: 0.78 });
  const inner = new THREE.MeshStandardMaterial({ color: 0x58331f, roughness: 0.86 });

  addMesh(group, new THREE.BoxGeometry(6.3, 0.38, 12.8), inner, id, clickable, interactive, [0, -1.45, 0.8]);
  addMesh(group, new THREE.BoxGeometry(0.46, 1.55, 14.0), brown, id, clickable, interactive, [-3.35, -0.75, 0.4], [0, 0, 0.045]);
  addMesh(group, new THREE.BoxGeometry(0.46, 1.55, 14.0), brown, id, clickable, interactive, [3.35, -0.75, 0.4], [0, 0, -0.045]);
  addMesh(group, new THREE.BoxGeometry(6.8, 1.5, 0.7), brown, id, clickable, interactive, [0, -0.72, 7.1]);

  const bow = addMesh(group, new THREE.ConeGeometry(3.55, 4.4, 4), brown, id, clickable, interactive, [0, -0.72, -7.2], [Math.PI / 2, Math.PI / 4, 0]);
  bow.scale.z = 0.58;
  addMesh(group, new THREE.BoxGeometry(5.5, 0.26, 4.2), inner, id, clickable, interactive, [0, -0.82, -4.7]);
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
    const id = spec.id;
    const group = this.parts.get(id);
    if (!group) continue;
    const interactive = spec.interactive !== false;

    if (TIRE_PARTS.has(partNo)) rebuildTire(group, id, group.userData.spec.size, this.clickable, interactive);
    else if (partNo === '30149') rebuildVehicleTub(group, id, this.clickable, interactive);
    else if (partNo === '30147') rebuildVehicleGrille(group, id, this.clickable, interactive);
    else if (partNo === '33129') rebuildBoatHull(group, id, this.clickable, interactive);
  }
  return result;
};

function correctMesh(object) {
  if (!object?.isMesh) return;
  const p = object.geometry?.parameters;
  if (!p) return;

  if (close(p.width, 10.6) && close(p.height, 0.08) && close(p.depth, 47.8)) {
    object.position.y = -6.45;
    object.userData.geometryRebaseline = 'river-channel';
    return;
  }

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

const originalAdd = THREE.Object3D.prototype.add;
THREE.Object3D.prototype.add = function (...objects) {
  const result = originalAdd.apply(this, objects);
  for (const object of objects) correctObject(object);
  return result;
};
