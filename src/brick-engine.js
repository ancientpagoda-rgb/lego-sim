import * as THREE from 'three';

export const STUD = 1;
export const PLATE_H = 0.4;
export const BRICK_H = 1.2;

const COLOR = {
  Black: 0x161616,
  Blue: 0x2455a4,
  Brown: 0x6b3f24,
  'Chrome Gold': 0xc8a83b,
  'Chrome Silver': 0xb8bdc6,
  'Dark Gray': 0x4b4f50,
  Green: 0x2f713a,
  'Light Gray': 0xa5a9a7,
  Red: 0xb52f2a,
  Tan: 0xc8ad7f,
  'Trans-Clear': 0xdcecf0,
  'Trans-Neon Orange': 0xff7a16,
  'Trans-Red': 0xd81920,
  'Trans-Yellow': 0xf5e343,
  White: 0xeeeeea,
  Yellow: 0xf0c735,
};

const DEFAULT_SHAPES = {
  '3005': [1, 1, BRICK_H], '3004': [1, 2, BRICK_H], '3010': [1, 4, BRICK_H],
  '3009': [1, 6, BRICK_H], '3008': [1, 8, BRICK_H], '3003': [2, 2, BRICK_H],
  '3001': [2, 4, BRICK_H], '3007': [2, 8, BRICK_H], '4202': [4, 12, BRICK_H],
  '4201': [8, 8, BRICK_H], '3024': [1, 1, PLATE_H], '3023': [1, 2, PLATE_H],
  '3623': [1, 3, PLATE_H], '3710': [1, 4, PLATE_H], '3666': [1, 6, PLATE_H],
  '3460': [1, 8, PLATE_H], '2431': [1, 4, PLATE_H], '3022': [2, 2, PLATE_H],
  '3021': [2, 3, PLATE_H], '3020': [2, 4, PLATE_H], '3795': [2, 6, PLATE_H],
  '3034': [2, 8, PLATE_H], '3832': [2, 10, PLATE_H], '3031': [4, 4, PLATE_H],
  '3035': [4, 8, PLATE_H], '3036': [6, 8, PLATE_H], '3039': [2, 2, BRICK_H],
  '3040': [2, 1, BRICK_H], '2454': [1, 2, BRICK_H * 5], '2454px6': [1, 2, BRICK_H * 5],
  '30145': [2, 2, BRICK_H * 3], '4863': [1, 4, BRICK_H * 2],
  '2549': [4, 16, BRICK_H * 3], '33129': [8, 18, BRICK_H * 2.4],
};

function keyPart(partNo) {
  return String(partNo || '').replace(/px\d+|pb\d+|pr\d+/gi, '');
}

function mat(color, transparent = false) {
  return new THREE.MeshStandardMaterial({
    color: COLOR[color] ?? 0x999999,
    roughness: 0.62,
    metalness: color?.startsWith('Chrome') ? 0.72 : 0,
    transparent,
    opacity: transparent ? 0.58 : 1,
  });
}

function makeStuds(group, w, d, h, material) {
  if (!Number.isInteger(w) || !Number.isInteger(d) || h < PLATE_H) return;
  const geo = new THREE.CylinderGeometry(0.29, 0.29, 0.16, 14);
  for (let ix = 0; ix < w; ix += 1) for (let iz = 0; iz < d; iz += 1) {
    const stud = new THREE.Mesh(geo, material);
    stud.position.set(ix - (w - 1) / 2, h / 2 + 0.08, iz - (d - 1) / 2);
    stud.castShadow = true;
    group.add(stud);
  }
}

function proxyShape(spec) {
  if (spec.size) return spec.size;
  return DEFAULT_SHAPES[keyPart(spec.partNo)] ?? [1, 1, BRICK_H];
}

export class BrickStructure {
  constructor(root, clickable = []) {
    this.root = root;
    this.clickable = clickable;
    this.parts = new Map();
    this.dynamic = new Set();
    this.edges = new Map();
    this.gravity = 18;
  }

  clear() {
    for (const part of this.parts.values()) this.root.remove(part);
    this.parts.clear();
    this.dynamic.clear();
    this.edges.clear();
    this.clickable.length = 0;
  }

  addPart(spec) {
    const id = spec.id ?? `part-${this.parts.size + 1}`;
    const [w, d, h] = proxyShape(spec);
    const group = new THREE.Group();
    group.name = `${spec.partNo ?? 'proxy'}:${id}`;
    const transparent = String(spec.color).startsWith('Trans-');
    const material = mat(spec.color, transparent);

    let body;
    if (spec.shape === 'baseplate') {
      body = new THREE.Mesh(new THREE.BoxGeometry(w - 0.04, h, d - 0.04), material);
    } else if (spec.shape === 'bridge') {
      const deck = new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, 0.22, d - 0.1), material);
      deck.position.y = -h / 2 + 0.3;
      body = deck;
    } else {
      body = new THREE.Mesh(new THREE.BoxGeometry(w - 0.06, h, d - 0.06), material);
    }
    body.castShadow = spec.shape !== 'baseplate';
    body.receiveShadow = true;
    body.userData.partId = id;
    group.add(body);
    if (spec.studs !== false && spec.shape !== 'bridge') makeStuds(group, w, d, h, material);

    const p = spec.position ?? [0, 0, 0];
    group.position.set(p[0], p[1] + h / 2, p[2]);
    const r = spec.rotation ?? [0, 0, 0];
    group.rotation.set(r[0], r[1], r[2]);
    group.userData = {
      spec: { ...spec, id, size: [w, d, h] },
      velocity: new THREE.Vector3(),
      angular: new THREE.Vector3(),
      dynamic: false,
      startPosition: group.position.clone(),
      startRotation: group.rotation.clone(),
    };
    this.root.add(group);
    this.parts.set(id, group);
    this.edges.set(id, new Map());
    if (spec.interactive !== false && !spec.anchored) this.clickable.push(body);
    return group;
  }

  load(model) {
    this.clear();
    this.gravity = model.simulation?.gravity ?? 18;
    for (const spec of model.parts ?? []) this.addPart(spec);
    for (const link of model.connections ?? []) this.connect(link.a, link.b, link.strength ?? 1);
    if (!model.connections?.length) this.inferVerticalConnections();
    return this;
  }

  connect(a, b, strength = 1) {
    if (!this.parts.has(a) || !this.parts.has(b)) return;
    this.edges.get(a).set(b, strength);
    this.edges.get(b).set(a, strength);
  }

  disconnect(a, b) {
    this.edges.get(a)?.delete(b);
    this.edges.get(b)?.delete(a);
  }

  inferVerticalConnections() {
    const parts = [...this.parts.entries()];
    for (let i = 0; i < parts.length; i += 1) {
      const [aid, a] = parts[i];
      const as = a.userData.spec;
      const [aw, ad, ah] = as.size;
      const atop = a.position.y + ah / 2;
      for (let j = i + 1; j < parts.length; j += 1) {
        const [bid, b] = parts[j];
        const bs = b.userData.spec;
        const [bw, bd, bh] = bs.size;
        const bbot = b.position.y - bh / 2;
        if (Math.abs(atop - bbot) > 0.09) continue;
        const overlapX = Math.abs(a.position.x - b.position.x) < (aw + bw) / 2 - 0.08;
        const overlapZ = Math.abs(a.position.z - b.position.z) < (ad + bd) / 2 - 0.08;
        if (overlapX && overlapZ) this.connect(aid, bid, Math.max(0.8, Math.min(3.5, Math.min(aw, bw) * Math.min(ad, bd) * 0.6)));
      }
    }
  }

  anchoredIds() {
    return [...this.parts.entries()].filter(([, p]) => p.userData.spec.anchored).map(([id]) => id);
  }

  supportedIds() {
    const seen = new Set(this.anchoredIds());
    const queue = [...seen];
    while (queue.length) {
      const id = queue.shift();
      for (const next of this.edges.get(id)?.keys() ?? []) {
        if (!seen.has(next)) { seen.add(next); queue.push(next); }
      }
    }
    return seen;
  }

  releaseUnsupported(impulseOrigin = null) {
    const supported = this.supportedIds();
    for (const [id, part] of this.parts) {
      if (supported.has(id) || part.userData.spec.anchored) continue;
      part.userData.dynamic = true;
      this.dynamic.add(part);
      if (impulseOrigin && part.userData.velocity.lengthSq() === 0) {
        const dir = part.position.clone().sub(impulseOrigin).setY(0.35).normalize();
        part.userData.velocity.addScaledVector(dir, 0.65);
      }
    }
  }

  knock(partId, origin, impulse = 5.2) {
    const part = this.parts.get(partId);
    if (!part || part.userData.spec.anchored) return;
    for (const neighbor of [...(this.edges.get(partId)?.keys() ?? [])]) this.disconnect(partId, neighbor);
    part.userData.dynamic = true;
    const dir = part.position.clone().sub(origin).setY(0.55).normalize();
    part.userData.velocity.copy(dir.multiplyScalar(impulse)).add(new THREE.Vector3(0, 2.1, 0));
    part.userData.angular.set(dir.z * 1.3, 0.4, -dir.x * 1.3);
    this.dynamic.add(part);
    this.releaseUnsupported(origin);
  }

  update(dt, gravityEnabled = true) {
    for (const part of this.dynamic) {
      if (gravityEnabled) part.userData.velocity.y -= this.gravity * dt;
      part.position.addScaledVector(part.userData.velocity, dt);
      part.rotation.x += part.userData.angular.x * dt;
      part.rotation.y += part.userData.angular.y * dt;
      part.rotation.z += part.userData.angular.z * dt;
      if (part.position.y < 0.12) {
        part.position.y = 0.12;
        part.userData.velocity.y *= -0.22;
        part.userData.velocity.x *= 0.82;
        part.userData.velocity.z *= 0.82;
        part.userData.angular.multiplyScalar(0.78);
        if (part.userData.velocity.length() < 0.28) {
          part.userData.velocity.set(0, 0, 0);
          part.userData.angular.set(0, 0, 0);
          part.userData.dynamic = false;
          this.dynamic.delete(part);
        }
      }
    }
  }

  reset() {
    for (const part of this.parts.values()) {
      part.position.copy(part.userData.startPosition);
      part.rotation.copy(part.userData.startRotation);
      part.userData.velocity.set(0, 0, 0);
      part.userData.angular.set(0, 0, 0);
      part.userData.dynamic = false;
    }
    this.dynamic.clear();
  }
}
