import * as THREE from 'three';
import { terrainCellHeightAt } from './world-terrain.js';

const PATCH_KEY = Symbol.for('lego-sim.construction-gameplay-patched');
const STUD = 1;
const PLATE_H = 0.4;
const MAX_REACH = 8.5;
const STORAGE_PREFIX = 'lego-sim:v0.9:';
const BUILD_TARGET = 6;

const PIECES = [
  { id: 'plate-1x1', label: '1×1 plate', w: 1, d: 1, h: PLATE_H, color: 0xd2a942, reward: 12 },
  { id: 'plate-1x2', label: '1×2 plate', w: 1, d: 2, h: PLATE_H, color: 0xc33d32, reward: 10 },
  { id: 'plate-2x2', label: '2×2 plate', w: 2, d: 2, h: PLATE_H, color: 0x2f6aa9, reward: 8 },
  { id: 'brick-1x2', label: '1×2 brick', w: 1, d: 2, h: 1.2, color: 0xd9c28b, reward: 8 },
  { id: 'brick-2x4', label: '2×4 brick', w: 2, d: 4, h: 1.2, color: 0x3f7b3d, reward: 6 },
];

const RELICS = [
  { id: 'sun-disc', label: 'Sun Disc', x: -13.5, z: -9.5, color: 0xe8c641 },
  { id: 'river-idol', label: 'River Idol', x: 12.5, z: -8.5, color: 0x4fa2c6 },
  { id: 'jungle-gem', label: 'Jungle Gem', x: 11.5, z: 11.5, color: 0x66bf67 },
];

function roomId() {
  return new URLSearchParams(location.search).get('room') || '5986';
}

function storageKey(room, suffix) {
  return `${STORAGE_PREFIX}${room}:${suffix}`;
}

function snapCenter(value, studs) {
  const offset = studs % 2 === 0 ? 0.5 : 0;
  return Math.round(value - offset) + offset;
}

function dataFlag(object, key) {
  for (let cursor = object; cursor; cursor = cursor.parent) {
    if (cursor.userData?.[key] !== undefined) return cursor.userData[key];
  }
  return null;
}

function isDescendantOf(object, ancestor) {
  for (let cursor = object; cursor; cursor = cursor.parent) {
    if (cursor === ancestor) return true;
  }
  return false;
}

function makeMaterial(color, ghost = false, valid = true) {
  if (ghost) {
    return new THREE.MeshStandardMaterial({
      color: valid ? 0x62d66d : 0xe45145,
      transparent: true,
      opacity: 0.48,
      roughness: 0.55,
      depthWrite: false,
    });
  }
  return new THREE.MeshStandardMaterial({ color, roughness: 0.68 });
}

function rotatedDims(piece, rotation) {
  const quarter = Math.round(rotation / (Math.PI / 2)) & 1;
  return quarter ? { w: piece.d, d: piece.w } : { w: piece.w, d: piece.d };
}

function pieceMesh(piece, rotation, color = piece.color, ghost = false, valid = true) {
  const group = new THREE.Group();
  group.rotation.y = rotation;
  const material = makeMaterial(color, ghost, valid);
  const body = new THREE.Mesh(new THREE.BoxGeometry(piece.w, piece.h, piece.d), material);
  body.castShadow = !ghost;
  body.receiveShadow = !ghost;
  group.add(body);

  const studGeometry = new THREE.CylinderGeometry(0.29, 0.29, 0.16, 12);
  for (let x = 0; x < piece.w; x += 1) {
    for (let z = 0; z < piece.d; z += 1) {
      const stud = new THREE.Mesh(studGeometry, material);
      stud.position.set(
        x - (piece.w - 1) / 2,
        piece.h / 2 + 0.08,
        z - (piece.d - 1) / 2,
      );
      stud.castShadow = !ghost;
      group.add(stud);
    }
  }
  return group;
}

function minifigNpc() {
  const root = new THREE.Group();
  root.name = 'Expedition Quartermaster';
  const yellow = new THREE.MeshStandardMaterial({ color: 0xe5b940, roughness: 0.7 });
  const green = new THREE.MeshStandardMaterial({ color: 0x486d45, roughness: 0.76 });
  const brown = new THREE.MeshStandardMaterial({ color: 0x5c3c2b, roughness: 0.82 });

  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.9, 0.42), brown);
  const rightLeg = leftLeg.clone();
  leftLeg.position.set(-0.2, 0.45, 0);
  rightLeg.position.set(0.2, 0.45, 0);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.88, 1, 0.48), green);
  torso.position.y = 1.38;
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.55, 14), yellow);
  head.position.y = 2.15;
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 16), brown);
  brim.position.y = 2.49;
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.35, 0.25, 14), brown);
  crown.position.y = 2.61;

  for (const mesh of [leftLeg, rightLeg, torso, head, brim, crown]) {
    mesh.castShadow = true;
    root.add(mesh);
  }
  root.userData.worldGameplayNpc = true;
  root.traverse(object => { object.userData.worldGameplayNpc = true; });
  return root;
}

class ConstructionGameplay {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.canvas = renderer.domElement;
    this.room = roomId();
    this.raycaster = new THREE.Raycaster();
    this.center = new THREE.Vector2(0, 0);
    this.selected = 0;
    this.rotation = 0;
    this.buildMode = false;
    this.preview = null;
    this.previewData = null;
    this.builds = new Map();
    this.pickups = new Map();
    this.lastTime = performance.now();
    this.worldPlayer = null;
    this.worldRemoteRoot = null;
    this.worldOldBuildRoot = null;
    this.boundWorldUi = false;
    this.noticeTimer = 0;
    this.channel = typeof BroadcastChannel === 'function'
      ? new BroadcastChannel(`lego-sim:v0.9:${this.room}`)
      : null;

    this.root = new THREE.Group();
    this.root.name = 'v0.9 construction and gameplay';
    this.buildRoot = new THREE.Group();
    this.buildRoot.name = 'Stud-snapped construction';
    this.pickupRoot = new THREE.Group();
    this.pickupRoot.name = 'Adventure relics';
    this.npcRoot = new THREE.Group();
    this.npcRoot.name = 'Gameplay NPCs';
    this.root.add(this.buildRoot, this.pickupRoot, this.npcRoot);
    this.scene.add(this.root);

    this.state = this.loadState();
    this.inventory = this.loadInventory();
    this.installStyles();
    this.installUI();
    this.installInput();
    this.loadBuilds();
    this.spawnNpc();
    this.spawnRelics();
    this.installChannel();
    this.refreshUI();
  }

  loadState() {
    const fallback = { relics: [], complete: false, trapUnlocked: false };
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey(this.room, 'game')) || 'null');
      return parsed && typeof parsed === 'object'
        ? { ...fallback, ...parsed, relics: Array.isArray(parsed.relics) ? parsed.relics : [] }
        : fallback;
    } catch {
      return fallback;
    }
  }

  saveState(broadcast = true) {
    localStorage.setItem(storageKey(this.room, 'game'), JSON.stringify(this.state));
    if (broadcast) this.channel?.postMessage({ type: 'game', state: this.state });
  }

  loadInventory() {
    const base = Object.fromEntries(PIECES.map(piece => [piece.id, piece.reward]));
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey(this.room, 'inventory')) || 'null');
      return parsed && typeof parsed === 'object' ? { ...base, ...parsed } : base;
    } catch {
      return base;
    }
  }

  saveInventory(broadcast = true) {
    localStorage.setItem(storageKey(this.room, 'inventory'), JSON.stringify(this.inventory));
    if (broadcast) this.channel?.postMessage({ type: 'inventory', inventory: this.inventory });
  }

  loadBuilds() {
    let records = [];
    try {
      records = JSON.parse(localStorage.getItem(storageKey(this.room, 'builds')) || '[]');
    } catch {}
    if (Array.isArray(records)) {
      for (const record of records) this.addBuild(record, false, false);
    }
  }

  saveBuilds(broadcast = true) {
    const records = [...this.builds.values()].map(entry => entry.data);
    localStorage.setItem(storageKey(this.room, 'builds'), JSON.stringify(records.slice(-800)));
    if (broadcast) this.channel?.postMessage({ type: 'builds', builds: records.slice(-800) });
  }

  installChannel() {
    if (!this.channel) return;
    this.channel.onmessage = event => {
      const packet = event.data;
      if (!packet || typeof packet !== 'object') return;
      if (packet.type === 'build:add') this.addBuild(packet.data, false, true);
      if (packet.type === 'build:remove') this.removeBuild(packet.id, false);
      if (packet.type === 'builds' && Array.isArray(packet.builds)) {
        for (const record of packet.builds) this.addBuild(record, false, true);
      }
      if (packet.type === 'game' && packet.state) {
        this.state = { ...this.state, ...packet.state };
        this.spawnRelics();
        this.refreshUI();
      }
      if (packet.type === 'inventory' && packet.inventory) {
        this.inventory = { ...this.inventory, ...packet.inventory };
        this.refreshUI();
      }
    };
    this.channel.postMessage({ type: 'builds', builds: [...this.builds.values()].map(entry => entry.data) });
  }

  installStyles() {
    if (document.querySelector('#constructionGameplayStyles')) return;
    const style = document.createElement('style');
    style.id = 'constructionGameplayStyles';
    style.textContent = `
      #buildHotbar{position:fixed;z-index:11;left:50%;bottom:max(12px,env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;gap:6px;padding:7px;border:1px solid rgba(255,255,255,.15);border-radius:16px;background:rgba(8,14,10,.78);backdrop-filter:blur(10px);max-width:min(94vw,760px);overflow-x:auto}
      #buildHotbar button{min-width:78px;padding:8px 9px;border:1px solid rgba(255,255,255,.16);border-radius:11px;background:rgba(38,48,39,.84);color:#f7f1dc;font:700 11px/1.15 system-ui;touch-action:manipulation}
      #buildHotbar button.selected{outline:2px solid #efd36e;background:rgba(74,82,48,.92)}
      #buildHotbar button.empty{opacity:.42}
      #buildHotbar small{display:block;margin-top:4px;font-size:10px;font-weight:600;color:#d7d8cd}
      #adventureHud{position:fixed;z-index:10;left:max(12px,env(safe-area-inset-left));bottom:max(12px,env(safe-area-inset-bottom));width:min(330px,calc(100vw - 24px));padding:11px 12px;border:1px solid rgba(255,255,255,.15);border-radius:14px;background:rgba(8,14,10,.79);color:#f7f1dc;font:13px/1.35 system-ui;backdrop-filter:blur(10px);pointer-events:none}
      #adventureHud strong{display:block;margin-bottom:3px;font-size:13px}#adventureHud .sub{color:#c8d0c6;font-size:11px}
      #buildModeButton{position:fixed;z-index:12;right:max(12px,env(safe-area-inset-right));bottom:max(56px,calc(env(safe-area-inset-bottom) + 44px));padding:10px 12px;border:1px solid rgba(255,255,255,.2);border-radius:13px;background:rgba(8,14,10,.82);color:#fff;font:800 12px system-ui}
      #gameNotice{position:fixed;z-index:30;left:50%;top:18%;transform:translateX(-50%);padding:10px 14px;border-radius:999px;background:rgba(10,18,12,.9);color:#fff;font:700 13px system-ui;opacity:0;transition:opacity .2s;pointer-events:none}
      #gameNotice.show{opacity:1}
      #constructionTouch{display:none;position:fixed;z-index:13;right:max(12px,env(safe-area-inset-right));bottom:max(128px,calc(env(safe-area-inset-bottom) + 116px));gap:7px;flex-direction:column}
      #constructionTouch button{width:64px;height:44px;border:1px solid rgba(255,255,255,.22);border-radius:12px;background:rgba(8,14,10,.78);color:#fff;font:800 10px system-ui;touch-action:manipulation}
      body.build-mode #buildModeButton{outline:2px solid #efd36e;background:rgba(83,78,40,.9)}
      body:not(.build-mode) #buildHotbar{opacity:.42}
      body.build-mode #crosshair{opacity:1}
      @media(pointer:coarse),(max-width:800px){#buildHotbar{bottom:max(8px,env(safe-area-inset-bottom));max-width:70vw;left:46%}#adventureHud{bottom:188px;width:min(270px,68vw)}#buildModeButton{bottom:188px}body.build-mode #constructionTouch{display:flex}#worldTouch [data-action='place'],#worldTouch [data-action='remove']{display:none}}
    `;
    document.head.append(style);
  }

  installUI() {
    this.hotbar = document.createElement('div');
    this.hotbar.id = 'buildHotbar';
    document.body.append(this.hotbar);

    this.adventureHud = document.createElement('div');
    this.adventureHud.id = 'adventureHud';
    document.body.append(this.adventureHud);

    this.modeButton = document.createElement('button');
    this.modeButton.id = 'buildModeButton';
    this.modeButton.textContent = 'BUILD [B]';
    this.modeButton.onclick = () => this.toggleBuildMode();
    document.body.append(this.modeButton);

    this.notice = document.createElement('div');
    this.notice.id = 'gameNotice';
    document.body.append(this.notice);

    this.touch = document.createElement('div');
    this.touch.id = 'constructionTouch';
    this.touch.innerHTML = `
      <button data-build-action="rotate">ROTATE</button>
      <button data-build-action="place">PLACE</button>
      <button data-build-action="remove">REMOVE</button>`;
    document.body.append(this.touch);

    this.touch.querySelector('[data-build-action="rotate"]').onclick = () => this.rotateSelection();
    this.touch.querySelector('[data-build-action="place"]').onclick = () => this.placePreview();
    this.touch.querySelector('[data-build-action="remove"]').onclick = () => this.removeAimedBuild();

    this.hotbar.addEventListener('click', event => {
      const button = event.target.closest('button[data-piece]');
      if (!button) return;
      const index = PIECES.findIndex(piece => piece.id === button.dataset.piece);
      if (index >= 0) {
        this.selected = index;
        this.buildMode = true;
        document.body.classList.add('build-mode');
        this.refreshUI();
      }
    });
  }

  installInput() {
    addEventListener('keydown', event => {
      if (/^Digit[1-5]$/.test(event.code)) {
        const index = Number(event.code.slice(-1)) - 1;
        if (PIECES[index]) {
          this.selected = index;
          this.buildMode = true;
          document.body.classList.add('build-mode');
          this.refreshUI();
          event.preventDefault();
          event.stopImmediatePropagation();
        }
        return;
      }
      if (event.code === 'KeyB' && !event.repeat) {
        this.toggleBuildMode();
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (event.code === 'KeyF' && this.buildMode && !event.repeat) {
        this.rotateSelection();
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (event.code === 'KeyE' && this.buildMode && !event.repeat) {
        this.placePreview();
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (event.code === 'KeyQ' && this.buildMode && !event.repeat) {
        this.removeAimedBuild();
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (event.code === 'KeyG' && this.state.trapUnlocked && !event.repeat) {
        document.querySelector('#traps')?.click();
        this.flash('Temple trap triggered');
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);

    this.canvas.addEventListener('mousedown', event => {
      if (!this.buildMode || !document.body.classList.contains('world-explore')) return;
      if (document.pointerLockElement !== this.canvas) return;
      if (event.button === 0) this.placePreview();
      if (event.button === 2) this.removeAimedBuild();
    }, true);
    this.canvas.addEventListener('contextmenu', event => {
      if (this.buildMode) event.preventDefault();
    });

    addEventListener('beforeunload', () => this.channel?.close());
  }

  bindWorldObjects() {
    if (!this.worldPlayer || !this.worldPlayer.parent) {
      this.worldPlayer = this.scene.getObjectByName('Local player') || null;
    }
    if (!this.worldRemoteRoot || !this.worldRemoteRoot.parent) {
      this.worldRemoteRoot = this.scene.getObjectByName('Remote players') || null;
    }
    if (!this.worldOldBuildRoot || !this.worldOldBuildRoot.parent) {
      this.worldOldBuildRoot = this.scene.getObjectByName('Persistent player builds') || null;
    }
    if (!this.boundWorldUi) {
      const controls = document.querySelector('.controls');
      if (controls) {
        for (const button of controls.querySelectorAll('button')) {
          if (button.textContent.trim() === '+ Brick' || button.textContent.trim() === '− Brick') {
            button.hidden = true;
          }
        }
        this.boundWorldUi = true;
      }
    }
  }

  spawnNpc() {
    if (this.npcRoot.children.length) return;
    const npc = minifigNpc();
    const y = terrainCellHeightAt(-11.5, 13.4);
    npc.position.set(-11.5, y, 13.4);
    npc.rotation.y = Math.PI;
    this.npcRoot.add(npc);
  }

  spawnRelics() {
    for (const child of [...this.pickupRoot.children]) child.removeFromParent();
    this.pickups.clear();
    for (const relic of RELICS) {
      if (this.state.relics.includes(relic.id)) continue;
      const group = new THREE.Group();
      group.name = relic.label;
      const material = new THREE.MeshStandardMaterial({
        color: relic.color,
        roughness: 0.25,
        metalness: 0.42,
        emissive: relic.color,
        emissiveIntensity: 0.18,
      });
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), material);
      gem.castShadow = true;
      group.add(gem);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.62, 0.035, 6, 28),
        new THREE.MeshBasicMaterial({ color: 0xf1df9a, transparent: true, opacity: 0.7 }),
      );
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
      const y = terrainCellHeightAt(relic.x, relic.z) + 1.05;
      group.position.set(relic.x, y, relic.z);
      group.userData.relicId = relic.id;
      group.userData.baseY = y;
      group.userData.phase = Math.random() * Math.PI * 2;
      group.traverse(object => { object.userData.worldGameplayPickup = true; });
      this.pickupRoot.add(group);
      this.pickups.set(relic.id, { relic, group });
    }
  }

  toggleBuildMode() {
    this.buildMode = !this.buildMode;
    document.body.classList.toggle('build-mode', this.buildMode);
    if (!this.buildMode) this.clearPreview();
    this.refreshUI();
  }

  rotateSelection() {
    this.rotation = (this.rotation + Math.PI / 2) % (Math.PI * 2);
    this.refreshUI();
  }

  selectedPiece() {
    return PIECES[this.selected] || PIECES[0];
  }

  raycastTarget() {
    this.raycaster.setFromCamera(this.center, this.camera);
    this.raycaster.near = 0.05;
    this.raycaster.far = MAX_REACH;
    const hits = this.raycaster.intersectObjects(this.scene.children, true);
    return hits.find(hit => {
      const object = hit.object;
      if (this.preview && isDescendantOf(object, this.preview)) return false;
      if (this.worldPlayer && isDescendantOf(object, this.worldPlayer)) return false;
      if (this.worldRemoteRoot && isDescendantOf(object, this.worldRemoteRoot)) return false;
      if (dataFlag(object, 'worldGameplayPickup') || dataFlag(object, 'worldGameplayNpc')) return false;
      if (dataFlag(object, 'worldWater') || dataFlag(object, 'worldDecoration')) return false;
      return true;
    }) || null;
  }

  placementFromHit(hit) {
    if (!hit) return null;
    const piece = this.selectedPiece();
    const dims = rotatedDims(piece, this.rotation);
    const normal = hit.face?.normal?.clone() || new THREE.Vector3(0, 1, 0);
    normal.transformDirection(hit.object.matrixWorld).normalize();
    const point = hit.point.clone();

    let x = point.x;
    let y = point.y + piece.h / 2;
    let z = point.z;

    if (normal.y > 0.55) {
      x = snapCenter(point.x, dims.w);
      z = snapCenter(point.z, dims.d);
      y = Math.round((point.y + piece.h / 2) / PLATE_H) * PLATE_H;
    } else if (Math.abs(normal.x) > Math.abs(normal.z)) {
      x = point.x + normal.x * (dims.w / 2 + 0.02);
      x = snapCenter(x, dims.w);
      z = snapCenter(point.z, dims.d);
      y = Math.round((point.y - piece.h / 2) / PLATE_H) * PLATE_H + piece.h / 2;
    } else {
      z = point.z + normal.z * (dims.d / 2 + 0.02);
      x = snapCenter(point.x, dims.w);
      z = snapCenter(z, dims.d);
      y = Math.round((point.y - piece.h / 2) / PLATE_H) * PLATE_H + piece.h / 2;
    }

    return { x, y, z, dims, normal };
  }

  placementBox(data, piece = this.selectedPiece()) {
    const dims = rotatedDims(piece, data.rotation ?? this.rotation);
    return new THREE.Box3(
      new THREE.Vector3(
        data.x - dims.w / 2 + 0.035,
        data.y - piece.h / 2 + 0.035,
        data.z - dims.d / 2 + 0.035,
      ),
      new THREE.Vector3(
        data.x + dims.w / 2 - 0.035,
        data.y + piece.h / 2 - 0.035,
        data.z + dims.d / 2 - 0.035,
      ),
    );
  }

  placementValid(candidate) {
    if (!candidate || !this.worldPlayer) return false;
    const piece = this.selectedPiece();
    if ((this.inventory[piece.id] || 0) <= 0) return false;
    const playerXZ = Math.hypot(candidate.x - this.worldPlayer.position.x, candidate.z - this.worldPlayer.position.z);
    if (playerXZ < 0.75 && Math.abs(candidate.y - this.worldPlayer.position.y) < 2.8) return false;

    const box = this.placementBox({ ...candidate, rotation: this.rotation }, piece);
    for (const entry of this.builds.values()) {
      const otherPiece = PIECES.find(item => item.id === entry.data.type) || PIECES[0];
      const other = this.placementBox(entry.data, otherPiece);
      if (box.intersectsBox(other)) return false;
    }
    return true;
  }

  updatePreview() {
    if (!this.buildMode || !document.body.classList.contains('world-explore')) {
      this.clearPreview();
      return;
    }
    const hit = this.raycastTarget();
    const candidate = this.placementFromHit(hit);
    const valid = this.placementValid(candidate);
    const piece = this.selectedPiece();

    if (!candidate) {
      this.clearPreview();
      return;
    }
    const needsRebuild = !this.preview
      || this.preview.userData.pieceId !== piece.id
      || this.preview.userData.rotation !== this.rotation
      || this.preview.userData.valid !== valid;

    if (needsRebuild) {
      this.clearPreview();
      this.preview = pieceMesh(piece, this.rotation, piece.color, true, valid);
      this.preview.userData.pieceId = piece.id;
      this.preview.userData.rotation = this.rotation;
      this.preview.userData.valid = valid;
      this.scene.add(this.preview);
    }
    this.preview.position.set(candidate.x, candidate.y, candidate.z);
    this.previewData = { ...candidate, valid };
  }

  clearPreview() {
    if (this.preview) this.preview.removeFromParent();
    this.preview = null;
    this.previewData = null;
  }

  placePreview() {
    if (!this.buildMode) return;
    this.updatePreview();
    if (!this.previewData?.valid) {
      this.flash('No valid LEGO connection here');
      return;
    }
    const piece = this.selectedPiece();
    const data = {
      id: `${this.room}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      type: piece.id,
      x: this.previewData.x,
      y: this.previewData.y,
      z: this.previewData.z,
      rotation: this.rotation,
      color: piece.color,
    };
    this.addBuild(data, true, true);
    this.inventory[piece.id] = Math.max(0, (this.inventory[piece.id] || 0) - 1);
    this.saveInventory();
    this.flash(`${piece.label} placed`);
    this.checkProgress();
    this.refreshUI();
  }

  addBuild(data, broadcast = true, persist = true) {
    if (!data?.id || this.builds.has(data.id)) return;
    const piece = PIECES.find(item => item.id === data.type) || PIECES[0];
    const normalized = {
      id: String(data.id),
      type: piece.id,
      x: Number(data.x) || 0,
      y: Number(data.y) || piece.h / 2,
      z: Number(data.z) || 0,
      rotation: Number(data.rotation) || 0,
      color: Number(data.color) || piece.color,
    };
    const mesh = pieceMesh(piece, normalized.rotation, normalized.color, false, true);
    mesh.position.set(normalized.x, normalized.y, normalized.z);
    mesh.userData.properBuildId = normalized.id;
    mesh.userData.properBuildType = normalized.type;
    mesh.traverse(object => {
      object.userData.properBuildId = normalized.id;
      object.userData.buildId = normalized.id;
    });
    this.buildRoot.add(mesh);
    this.builds.set(normalized.id, { data: normalized, mesh });
    if (persist) this.saveBuilds(false);
    if (broadcast) this.channel?.postMessage({ type: 'build:add', data: normalized });
  }

  removeBuild(id, broadcast = true) {
    const entry = this.builds.get(id);
    if (!entry) return;
    const piece = PIECES.find(item => item.id === entry.data.type) || PIECES[0];
    entry.mesh.removeFromParent();
    this.builds.delete(id);
    this.inventory[piece.id] = (this.inventory[piece.id] || 0) + 1;
    this.saveInventory();
    this.saveBuilds(false);
    if (broadcast) this.channel?.postMessage({ type: 'build:remove', id });
    this.checkProgress();
    this.refreshUI();
  }

  removeAimedBuild() {
    this.raycaster.setFromCamera(this.center, this.camera);
    this.raycaster.near = 0.05;
    this.raycaster.far = MAX_REACH;
    const hit = this.raycaster.intersectObjects(this.buildRoot.children, true)[0];
    const id = dataFlag(hit?.object, 'properBuildId');
    if (!id) {
      this.flash('Aim at one of your snapped pieces');
      return;
    }
    this.removeBuild(id, true);
    this.flash('Piece returned to inventory');
  }

  collectRelic(id) {
    if (this.state.relics.includes(id)) return;
    const entry = this.pickups.get(id);
    const relic = RELICS.find(item => item.id === id);
    if (!relic) return;
    this.state.relics.push(id);
    entry?.group.removeFromParent();
    this.pickups.delete(id);

    for (const piece of PIECES) {
      this.inventory[piece.id] = (this.inventory[piece.id] || 0) + Math.max(2, Math.ceil(piece.reward * 0.35));
    }
    this.saveInventory();
    this.saveState();
    this.flash(`${relic.label} recovered · LEGO stock added`);
    this.checkProgress();
    this.refreshUI();
  }

  checkProgress() {
    if (this.state.relics.length >= RELICS.length && this.builds.size >= BUILD_TARGET && !this.state.complete) {
      this.state.complete = true;
      this.state.trapUnlocked = true;
      this.saveState();
      this.flash('Expedition complete · temple trap unlocked [G]', 4200);
    }
  }

  updateGameplay(now) {
    if (!this.worldPlayer) return;
    for (const [id, entry] of this.pickups) {
      entry.group.rotation.y += 0.012;
      entry.group.position.y = entry.group.userData.baseY
        + Math.sin(now * 0.002 + entry.group.userData.phase) * 0.16;
      if (this.worldPlayer.position.distanceTo(entry.group.position) < 1.55) {
        this.collectRelic(id);
      }
    }
    const npc = this.npcRoot.children[0];
    if (npc && this.worldPlayer.position.distanceTo(npc.position) < 2.2 && this.state.relics.length < RELICS.length) {
      this.adventureHud.dataset.nearNpc = 'true';
    } else {
      delete this.adventureHud.dataset.nearNpc;
    }
  }

  refreshUI() {
    this.hotbar.innerHTML = PIECES.map((piece, index) => {
      const count = this.inventory[piece.id] || 0;
      const selected = index === this.selected ? ' selected' : '';
      const empty = count <= 0 ? ' empty' : '';
      return `<button class="${selected}${empty}" data-piece="${piece.id}">${index + 1}. ${piece.label}<small>${count} left</small></button>`;
    }).join('');

    const relicCount = this.state.relics.length;
    let objective = '';
    if (this.state.complete) {
      objective = '<strong>Expedition complete</strong><span>Temple trap unlocked — press G near the ruins.</span>';
    } else if (relicCount < RELICS.length) {
      objective = `<strong>Recover the three ruin relics</strong><span>${relicCount}/${RELICS.length} recovered</span>`;
    } else {
      objective = `<strong>Build a LEGO expedition camp</strong><span>${Math.min(this.builds.size, BUILD_TARGET)}/${BUILD_TARGET} snapped pieces placed</span>`;
    }
    const hint = this.buildMode
      ? `Build: ${this.selectedPiece().label} · F rotate · E/place · Q/remove`
      : 'Press B for construction mode';
    this.adventureHud.innerHTML = `${objective}<div class="sub">${hint}</div>`;
    this.modeButton.textContent = this.buildMode ? 'BUILD ON [B]' : 'BUILD [B]';
  }

  flash(message, duration = 2200) {
    this.notice.textContent = message;
    this.notice.classList.add('show');
    this.noticeTimer = performance.now() + duration;
  }

  beforeRender(renderer, scene, camera, now = performance.now()) {
    if (renderer !== this.renderer || scene !== this.scene || camera !== this.camera) return;
    this.bindWorldObjects();
    if (this.noticeTimer && now > this.noticeTimer) {
      this.notice.classList.remove('show');
      this.noticeTimer = 0;
    }
    if (this.worldPlayer) {
      this.updatePreview();
      this.updateGameplay(now);
    }
  }
}

if (!THREE.WebGLRenderer.prototype[PATCH_KEY]) {
  const originalRender = THREE.WebGLRenderer.prototype.render;
  let runtime = null;
  Object.defineProperty(THREE.WebGLRenderer.prototype, PATCH_KEY, { value: true });
  THREE.WebGLRenderer.prototype.render = function constructionGameplayRender(scene, camera) {
    if (this.domElement?.id === 'sim') {
      runtime ||= new ConstructionGameplay(this, scene, camera);
      runtime.beforeRender(this, scene, camera, performance.now());
    }
    return originalRender.call(this, scene, camera);
  };
}
