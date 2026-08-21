import * as THREE from 'three';

export const CHUNK_SIZE = 24;
export const TILE_SIZE = 2.4;
export const NEAR_RADIUS = 2;
export const FAR_RADIUS = 3;
export const FLOOR_Y = 0.42;
export const WATER_Y = 0.30;
export const SET_CLEAR_RADIUS = 27;
export const SET_BLEND_RADIUS = 43;
export const TERRAIN_BOTTOM = -2.4;
export const TERRAIN_STEP = 0.4;

const CENTRAL_RIVER_HALF_WIDTH = 5.25;
const CENTRAL_RIVER_HALF_LENGTH = 24;

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(edge0, edge1, value) {
  const t = clamp01((value - edge0) / Math.max(0.0001, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function quantize(value, step = TERRAIN_STEP) {
  return Math.round(value / step) * step;
}

export function seededRandom(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function chunkSeed(x, z) {
  return ((x * 73856093) ^ (z * 19349663) ^ 0x5986) >>> 0;
}

function centralRiver(x, z) {
  return Math.abs(x + 0.5) <= CENTRAL_RIVER_HALF_WIDTH && Math.abs(z) <= CENTRAL_RIVER_HALF_LENGTH;
}

export function riverCenterAt(z) {
  if (Math.abs(z) < CENTRAL_RIVER_HALF_LENGTH) return -0.5;
  const sign = Math.sign(z) || 1;
  const edge = -0.5 + sign * Math.min(10, (Math.abs(z) - CENTRAL_RIVER_HALF_LENGTH) * 0.16);
  const meander = Math.sin(z * 0.032) * 8.2 + Math.sin(z * 0.011 + 1.7) * 4.4;
  const blend = smoothstep(CENTRAL_RIVER_HALF_LENGTH, 70, Math.abs(z));
  return THREE.MathUtils.lerp(edge, meander, blend);
}

export function riverDistanceAt(x, z) {
  if (centralRiver(x, z)) return 0;
  return Math.abs(x - riverCenterAt(z));
}

export function waterSurfaceAt(x, z) {
  const distance = riverDistanceAt(x, z);
  const width = Math.abs(z) < 32 ? 5.25 : 3.8 + (Math.sin(z * 0.017) + 1) * 0.55;
  return distance <= width ? WATER_Y : null;
}

function broadHeight(x, z) {
  const ridgeA = Math.sin(x * 0.041 + Math.cos(z * 0.018) * 1.9) * 1.65;
  const ridgeB = Math.cos(z * 0.035 - Math.sin(x * 0.021) * 1.4) * 1.2;
  const ridgeC = Math.sin((x + z) * 0.017) * 1.05;
  const micro = Math.sin(x * 0.115 + z * 0.071) * 0.36;
  return FLOOR_Y + ridgeA + ridgeB + ridgeC + micro;
}

export function terrainHeightAt(x, z) {
  const radius = Math.hypot(x, z);
  if (centralRiver(x, z)) return -1.2;
  if (radius < SET_CLEAR_RADIUS) return FLOOR_Y;

  let height = broadHeight(x, z);
  const riverDistance = riverDistanceAt(x, z);
  const riverWidth = Math.abs(z) < 32 ? 5.25 : 4.15;
  if (riverDistance < riverWidth + 8) {
    const bank = smoothstep(riverWidth, riverWidth + 8, riverDistance);
    height = THREE.MathUtils.lerp(-1.25, height, bank);
  }

  const setBlend = smoothstep(SET_CLEAR_RADIUS, SET_BLEND_RADIUS, radius);
  height = THREE.MathUtils.lerp(FLOOR_Y, height, setBlend);
  return THREE.MathUtils.clamp(quantize(height), -1.2, 6.0);
}

export function terrainCellHeightAt(x, z) {
  const cellX = (Math.floor(x / TILE_SIZE) + 0.5) * TILE_SIZE;
  const cellZ = (Math.floor(z / TILE_SIZE) + 0.5) * TILE_SIZE;
  return terrainHeightAt(cellX, cellZ);
}

export function waterCellSurfaceAt(x, z) {
  if (centralRiver(x, z)) return WATER_Y;
  const cellX = (Math.floor(x / TILE_SIZE) + 0.5) * TILE_SIZE;
  const cellZ = (Math.floor(z / TILE_SIZE) + 0.5) * TILE_SIZE;
  return waterSurfaceAt(cellX, cellZ);
}

export function terrainSlopeAt(x, z) {
  const sample = TILE_SIZE * 0.55;
  const center = terrainHeightAt(x, z);
  return Math.max(
    Math.abs(terrainHeightAt(x + sample, z) - center),
    Math.abs(terrainHeightAt(x - sample, z) - center),
    Math.abs(terrainHeightAt(x, z + sample) - center),
    Math.abs(terrainHeightAt(x, z - sample) - center),
  );
}

function surfaceColor(height, waterDistance, randomValue) {
  if (waterDistance < 6) return 0x426b36;
  if (height > 4.0) return randomValue > 0.5 ? 0x657448 : 0x596b43;
  if (height > 2.0) return randomValue > 0.5 ? 0x467b3e : 0x3f7439;
  return randomValue > 0.5 ? 0x3c773a : 0x4a8240;
}

function markDecoration(object) {
  object.userData.worldDecoration = true;
  return object;
}

function makeTree(localX, localZ, surfaceY, scale, random) {
  const root = markDecoration(new THREE.Group());
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x67462b, roughness: 0.92 });
  const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x245c31, roughness: 0.86 });
  const trunk = markDecoration(new THREE.Mesh(
    new THREE.CylinderGeometry(0.20 * scale, 0.29 * scale, 3.5 * scale, 7),
    trunkMaterial,
  ));
  trunk.position.y = 1.75 * scale;
  trunk.castShadow = true;
  root.add(trunk);

  const crownY = 3.35 * scale;
  for (let i = 0; i < 6; i += 1) {
    const leaf = markDecoration(new THREE.Mesh(
      new THREE.BoxGeometry(0.28 * scale, 0.12 * scale, 2.6 * scale),
      leafMaterial,
    ));
    leaf.position.y = crownY;
    leaf.rotation.y = i * Math.PI * 2 / 6 + random() * 0.17;
    leaf.rotation.x = -0.22 - random() * 0.08;
    leaf.translateZ(1.0 * scale);
    leaf.castShadow = true;
    root.add(leaf);
  }
  root.position.set(localX, surfaceY, localZ);
  return root;
}

function makeBush(localX, localZ, surfaceY, size) {
  const bush = markDecoration(new THREE.Mesh(
    new THREE.IcosahedronGeometry(size, 0),
    new THREE.MeshStandardMaterial({ color: 0x2e6836, roughness: 0.9 }),
  ));
  bush.position.set(localX, surfaceY + size * 0.65, localZ);
  bush.scale.y = 0.72;
  bush.castShadow = true;
  return bush;
}

export function createTerrainChunk(cx, cz, lod = 'near') {
  const key = `${cx},${cz}`;
  const random = seededRandom(chunkSeed(cx, cz));
  const group = new THREE.Group();
  group.name = `terrain ${key} ${lod}`;
  group.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
  group.userData.chunkKey = key;
  group.userData.lod = lod;

  const cells = lod === 'near' ? 10 : 5;
  const cellSize = CHUNK_SIZE / cells;
  const half = CHUNK_SIZE * 0.5;
  const terrainCells = [];
  const waterCells = [];

  for (let iz = 0; iz < cells; iz += 1) {
    for (let ix = 0; ix < cells; ix += 1) {
      const localX = -half + cellSize * (ix + 0.5);
      const localZ = -half + cellSize * (iz + 0.5);
      const worldX = cx * CHUNK_SIZE + localX;
      const worldZ = cz * CHUNK_SIZE + localZ;
      const radius = Math.hypot(worldX, worldZ);
      if (radius < SET_CLEAR_RADIUS) continue;
      const surfaceY = terrainHeightAt(worldX, worldZ);
      const waterY = waterSurfaceAt(worldX, worldZ);
      const waterDistance = riverDistanceAt(worldX, worldZ);
      terrainCells.push({ localX, localZ, worldX, worldZ, surfaceY, waterDistance, tint: random() });
      if (waterY !== null && surfaceY < waterY - 0.15) {
        waterCells.push({ localX, localZ, waterY });
      }
    }
  }

  if (terrainCells.length) {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.91, vertexColors: true });
    const terrain = new THREE.InstancedMesh(geometry, material, terrainCells.length);
    terrain.name = `LEGO terrain columns ${key}`;
    terrain.userData.worldGround = true;
    terrain.receiveShadow = true;
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    terrainCells.forEach((cell, index) => {
      const height = Math.max(0.2, cell.surfaceY - TERRAIN_BOTTOM);
      matrix.identity();
      matrix.compose(
        new THREE.Vector3(cell.localX, TERRAIN_BOTTOM + height * 0.5, cell.localZ),
        new THREE.Quaternion(),
        new THREE.Vector3(cellSize * 0.985, height, cellSize * 0.985),
      );
      terrain.setMatrixAt(index, matrix);
      color.setHex(surfaceColor(cell.surfaceY, cell.waterDistance, cell.tint));
      terrain.setColorAt(index, color);
    });
    terrain.instanceMatrix.needsUpdate = true;
    if (terrain.instanceColor) terrain.instanceColor.needsUpdate = true;
    group.add(terrain);

    if (lod === 'near') {
      const studGeometry = new THREE.CylinderGeometry(0.19, 0.19, 0.10, 10);
      const studMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, vertexColors: true });
      const studs = new THREE.InstancedMesh(studGeometry, studMaterial, terrainCells.length);
      studs.name = `Terrain studs ${key}`;
      studs.userData.worldGround = true;
      terrainCells.forEach((cell, index) => {
        matrix.identity();
        matrix.makeTranslation(cell.localX, cell.surfaceY + 0.05, cell.localZ);
        studs.setMatrixAt(index, matrix);
        color.setHex(surfaceColor(cell.surfaceY, cell.waterDistance, cell.tint));
        studs.setColorAt(index, color);
      });
      studs.instanceMatrix.needsUpdate = true;
      if (studs.instanceColor) studs.instanceColor.needsUpdate = true;
      group.add(studs);
    }
  }

  if (waterCells.length) {
    const waterGeometry = new THREE.BoxGeometry(1, 1, 1);
    const waterMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x397ba3,
      roughness: 0.18,
      transparent: true,
      opacity: 0.68,
      clearcoat: 0.35,
      depthWrite: false,
    });
    const water = new THREE.InstancedMesh(waterGeometry, waterMaterial, waterCells.length);
    water.name = `River water ${key}`;
    water.userData.worldWater = true;
    water.renderOrder = 2;
    const matrix = new THREE.Matrix4();
    waterCells.forEach((cell, index) => {
      matrix.compose(
        new THREE.Vector3(cell.localX, cell.waterY - 0.035, cell.localZ),
        new THREE.Quaternion(),
        new THREE.Vector3(cellSize * 1.02, 0.07, cellSize * 1.02),
      );
      water.setMatrixAt(index, matrix);
    });
    water.instanceMatrix.needsUpdate = true;
    group.add(water);
  }

  if (lod === 'near') {
    const worldCenterX = cx * CHUNK_SIZE;
    const worldCenterZ = cz * CHUNK_SIZE;
    if (Math.hypot(worldCenterX, worldCenterZ) > SET_CLEAR_RADIUS - CHUNK_SIZE) {
      const treeCount = 4 + Math.floor(random() * 5);
      for (let i = 0; i < treeCount; i += 1) {
        const localX = (random() - 0.5) * (CHUNK_SIZE - 3);
        const localZ = (random() - 0.5) * (CHUNK_SIZE - 3);
        const worldX = worldCenterX + localX;
        const worldZ = worldCenterZ + localZ;
        if (Math.hypot(worldX, worldZ) < SET_CLEAR_RADIUS + 3) continue;
        if (waterSurfaceAt(worldX, worldZ) !== null) continue;
        if (terrainSlopeAt(worldX, worldZ) > 1.25) continue;
        const surfaceY = terrainHeightAt(worldX, worldZ);
        group.add(makeTree(localX, localZ, surfaceY, 0.62 + random() * 0.7, random));
      }
      const bushCount = 3 + Math.floor(random() * 5);
      for (let i = 0; i < bushCount; i += 1) {
        const localX = (random() - 0.5) * (CHUNK_SIZE - 2);
        const localZ = (random() - 0.5) * (CHUNK_SIZE - 2);
        const worldX = worldCenterX + localX;
        const worldZ = worldCenterZ + localZ;
        if (Math.hypot(worldX, worldZ) < SET_CLEAR_RADIUS + 2) continue;
        if (waterSurfaceAt(worldX, worldZ) !== null) continue;
        const surfaceY = terrainHeightAt(worldX, worldZ);
        group.add(makeBush(localX, localZ, surfaceY, 0.38 + random() * 0.42));
      }
    }
  }

  return group;
}
