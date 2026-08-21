import * as THREE from 'three';
import { PeerSync } from './peer-sync.js';
import {
  CHUNK_SIZE,
  NEAR_RADIUS,
  FAR_RADIUS,
  FLOOR_Y,
  SET_CLEAR_RADIUS,
  terrainCellHeightAt,
  waterCellSurfaceAt,
  createTerrainChunk,
} from './world-terrain.js';

const PATCH_KEY = Symbol.for('lego-sim.world-runtime-patched');
const BUILD_UNIT = 0.8;
const BUILD_HEIGHT = 0.48;
const STORAGE_PREFIX = 'lego-sim:world-builds:';
const PLAYER_RADIUS = 0.38;
const STEP_HEIGHT = 0.64;
const MANTLE_HEIGHT = 1.42;
const RESPAWN_Y = -12;

function isDescendantOf(object, ancestor) {
  for (let cursor = object; cursor; cursor = cursor.parent) {
    if (cursor === ancestor) return true;
  }
  return false;
}

function dataFlag(object, key) {
  for (let cursor = object; cursor; cursor = cursor.parent) {
    if (cursor.userData?.[key]) return cursor.userData[key];
  }
  return null;
}

function makeMaterial(color, roughness = 0.8) {
  return new THREE.MeshStandardMaterial({ color, roughness });
}

function makeAvatar(torsoColor = 0xd9a32e) {
  const root = new THREE.Group();
  const skin = makeMaterial(0xe5b940, 0.7);
  const torso = makeMaterial(torsoColor, 0.76);
  const legs = makeMaterial(0x2b3440, 0.82);
  const black = makeMaterial(0x171717, 0.78);

  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.9, 0.42), legs);
  const rightLeg = leftLeg.clone();
  leftLeg.position.set(-0.2, 0.45, 0);
  rightLeg.position.set(0.2, 0.45, 0);

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.88, 1.0, 0.48), torso);
  body.position.y = 1.38;
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.55, 14), skin);
  head.position.y = 2.15;
  const hair = new THREE.Mesh(new THREE.CylinderGeometry(0.355, 0.355, 0.12, 14), black);
  hair.position.y = 2.46;

  const armGeometry = new THREE.CylinderGeometry(0.12, 0.14, 0.85, 8);
  const leftArm = new THREE.Mesh(armGeometry, torso);
  const rightArm = leftArm.clone();
  leftArm.position.set(-0.58, 1.42, 0);
  rightArm.position.set(0.58, 1.42, 0);
  leftArm.rotation.z = -0.15;
  rightArm.rotation.z = 0.15;

  for (const mesh of [leftLeg, rightLeg, body, head, hair, leftArm, rightArm]) {
    mesh.castShadow = true;
    root.add(mesh);
  }
  root.userData.limbs = { leftLeg, rightLeg, leftArm, rightArm };
  return root;
}

class LegoWorldRuntime {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.canvas = renderer.domElement;
    this.explore = false;
    this.view = 'shoulder';
    this.keys = new Set();
    this.virtualKeys = new Set();
    this.yaw = Math.PI * 0.92;
    this.pitch = -0.08;
    this.velocityY = 0;
    this.spawn = new THREE.Vector3(-11.5, FLOOR_Y, 15.5);
    this.player = this.spawn.clone();
    this.lastTime = performance.now();
    this.lastNetworkSend = 0;
    this.lastChunkUpdate = 0;
    this.lastGrounded = true;
    this.swimming = false;
    this.climbing = false;
    this.stepPhase = 0;
    this.room = new URLSearchParams(location.search).get('room') || '5986';
    this.peerSync = new PeerSync(this.room);
    this.peers = new Map();
    this.chunks = new Map();
    this.builds = new Map();
    this.raycaster = new THREE.Raycaster();
    this.collisionRaycaster = new THREE.Raycaster();
    this.center = new THREE.Vector2(0, 0);
    this.coarsePointer = matchMedia('(pointer:coarse)').matches;
    this.nearRadius = this.coarsePointer ? 1 : NEAR_RADIUS;
    this.farRadius = this.coarsePointer ? 2 : FAR_RADIUS;

    this.worldRoot = new THREE.Group();
    this.worldRoot.name = 'Playable LEGO world';
    this.chunkRoot = new THREE.Group();
    this.chunkRoot.name = 'Procedural LEGO terrain chunks';
    this.buildRoot = new THREE.Group();
    this.buildRoot.name = 'Persistent player builds';
    this.remoteRoot = new THREE.Group();
    this.remoteRoot.name = 'Remote players';
    this.playerAvatar = makeAvatar(0xc04431);
    this.playerAvatar.name = 'Local player';
    this.worldRoot.add(this.chunkRoot, this.buildRoot, this.remoteRoot, this.playerAvatar);
    this.scene.add(this.worldRoot);

    this.#installStyles();
    this.#installUI();
    this.#installInput();
    this.#loadBuilds();
    this.#updateChunks(true);
    this.#wireMultiplayer();
    this.#updatePlayerAvatar(0);
  }

  #installStyles() {
    if (document.querySelector('#legoWorldRuntimeStyles')) return;
    const style = document.createElement('style');
    style.id = 'legoWorldRuntimeStyles';
    style.textContent = `
      .world-pill{display:inline-flex;align-items:center;gap:.35rem;padding:.45rem .62rem;border:1px solid rgba(255,255,255,.16);border-radius:999px;background:rgba(10,18,12,.72);color:#f8f2d7;font:600 12px/1 system-ui,sans-serif;backdrop-filter:blur(8px)}
      #worldStats{position:fixed;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));z-index:7;pointer-events:none}
      #worldTouch{display:none;position:fixed;inset:auto 0 max(14px,env(safe-area-inset-bottom)) 0;z-index:9;pointer-events:none;padding:0 14px;justify-content:space-between;align-items:end}
      #worldTouch .pad,#worldTouch .actions{pointer-events:auto;display:grid;gap:7px}
      #worldTouch .pad{grid-template-columns:56px 56px 56px;grid-template-areas:'. up .' 'left down right'}
      #worldTouch button{width:56px;height:56px;border:1px solid rgba(255,255,255,.25);border-radius:15px;background:rgba(10,18,12,.74);color:#fff;font:700 20px system-ui;backdrop-filter:blur(8px);touch-action:none;-webkit-user-select:none;user-select:none}
      #worldTouch [data-key='KeyW']{grid-area:up}#worldTouch [data-key='KeyA']{grid-area:left}#worldTouch [data-key='KeyS']{grid-area:down}#worldTouch [data-key='KeyD']{grid-area:right}
      #worldTouch .actions{grid-template-columns:60px 60px;grid-template-rows:52px 52px}#worldTouch .actions button{width:60px;height:52px;font-size:11px}
      #worldPeerPanel{position:fixed;z-index:20;left:50%;top:50%;transform:translate(-50%,-50%);width:min(92vw,620px);padding:18px;border:1px solid rgba(255,255,255,.2);border-radius:18px;background:rgba(8,13,10,.96);color:#f4f0df;font:14px/1.4 system-ui,sans-serif;box-shadow:0 24px 80px rgba(0,0,0,.45)}
      #worldPeerPanel[hidden]{display:none}#worldPeerPanel h2{margin:0 0 6px;font-size:18px}#worldPeerPanel p{margin:0 0 10px;color:#c9d0c7}
      #worldPeerPanel textarea{box-sizing:border-box;width:100%;height:130px;resize:vertical;border:1px solid #3c4a3f;border-radius:10px;background:#111a13;color:#e9f2e8;padding:10px;font:11px/1.3 ui-monospace,monospace}
      #worldPeerPanel .peer-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}#worldPeerPanel button{padding:.58rem .76rem;border:1px solid #4b5c4e;border-radius:10px;background:#1d2c20;color:#fff;font-weight:700}
      #worldPeerStatus{margin-top:9px;min-height:20px;color:#e4ce7a}
      body.world-explore #crosshair{display:block;opacity:.9}body.world-explore #sim{cursor:crosshair;touch-action:none}
      body.world-swimming #worldStats{border-color:rgba(132,211,255,.48)}
      @media (pointer:coarse),(max-width:800px){body.world-explore #worldTouch{display:flex}#worldStats{bottom:126px}.hud{pointer-events:auto}.hud .help{display:none}}
    `;
    document.head.append(style);
  }

  #installUI() {
    const controls = document.querySelector('.controls');
    if (controls) {
      this.playButton = document.createElement('button');
      this.playButton.className = 'primary';
      this.playButton.textContent = 'Explore world';
      this.playButton.onclick = () => this.#setExplore(!this.explore);

      this.viewButton = document.createElement('button');
      this.viewButton.textContent = 'View: shoulder';
      this.viewButton.onclick = () => {
        this.view = this.view === 'shoulder' ? 'first' : 'shoulder';
        this.viewButton.textContent = `View: ${this.view}`;
      };

      this.placeButton = document.createElement('button');
      this.placeButton.textContent = '+ Brick';
      this.placeButton.onclick = () => this.#placeBrick();
      this.removeButton = document.createElement('button');
      this.removeButton.textContent = '− Brick';
      this.removeButton.onclick = () => this.#removeBrick();

      this.respawnButton = document.createElement('button');
      this.respawnButton.textContent = 'Respawn';
      this.respawnButton.onclick = () => this.#respawn();

      this.multiplayerButton = document.createElement('button');
      this.multiplayerButton.textContent = 'Multiplayer';
      this.multiplayerButton.onclick = () => { this.peerPanel.hidden = false; };

      controls.prepend(
        this.playButton,
        this.viewButton,
        this.placeButton,
        this.removeButton,
        this.respawnButton,
        this.multiplayerButton,
      );
    }

    this.stats = document.createElement('div');
    this.stats.id = 'worldStats';
    this.stats.className = 'world-pill';
    document.body.append(this.stats);

    this.touch = document.createElement('div');
    this.touch.id = 'worldTouch';
    this.touch.innerHTML = `
      <div class="pad">
        <button data-key="KeyW" aria-label="forward">▲</button>
        <button data-key="KeyA" aria-label="left">◀</button>
        <button data-key="KeyS" aria-label="back">▼</button>
        <button data-key="KeyD" aria-label="right">▶</button>
      </div>
      <div class="actions">
        <button data-action="jump">JUMP<br>CLIMB</button>
        <button data-key="ShiftLeft">RUN</button>
        <button data-action="place">+ BRICK</button>
        <button data-action="remove">− BRICK</button>
      </div>`;
    document.body.append(this.touch);

    this.peerPanel = document.createElement('section');
    this.peerPanel.id = 'worldPeerPanel';
    this.peerPanel.hidden = true;
    this.peerPanel.innerHTML = `
      <h2>Peer-to-peer multiplayer</h2>
      <p>Room <strong>${this.room}</strong>. Nearby tabs sync automatically. For another device: host creates an offer, the joining player pastes it and creates an answer, then the host pastes that answer and connects.</p>
      <textarea id="worldPeerCode" spellcheck="false" placeholder="Pairing code"></textarea>
      <div class="peer-actions">
        <button data-peer="host">Create host offer</button>
        <button data-peer="join">Create answer</button>
        <button data-peer="accept">Accept answer</button>
        <button data-peer="copy">Copy code</button>
        <button data-peer="close">Close</button>
      </div>
      <div id="worldPeerStatus">Local room ready.</div>`;
    document.body.append(this.peerPanel);
    this.peerCode = this.peerPanel.querySelector('#worldPeerCode');
    this.peerStatus = this.peerPanel.querySelector('#worldPeerStatus');

    this.peerPanel.addEventListener('click', async event => {
      const action = event.target?.dataset?.peer;
      if (!action) return;
      try {
        if (action === 'close') this.peerPanel.hidden = true;
        if (action === 'copy') {
          await navigator.clipboard.writeText(this.peerCode.value);
          this.peerStatus.textContent = 'Pairing code copied.';
        }
        if (action === 'host') {
          this.peerStatus.textContent = 'Gathering connection candidates…';
          this.peerCode.value = await this.peerSync.createOffer();
          this.peerStatus.textContent = 'Offer ready. Send this code to the joining player.';
        }
        if (action === 'join') {
          this.peerStatus.textContent = 'Creating answer…';
          this.peerCode.value = await this.peerSync.createAnswer(this.peerCode.value);
          this.peerStatus.textContent = 'Answer ready. Send this code back to the host.';
        }
        if (action === 'accept') {
          await this.peerSync.acceptAnswer(this.peerCode.value);
          this.peerStatus.textContent = 'Answer accepted. Establishing P2P link…';
        }
      } catch (error) {
        this.peerStatus.textContent = `Multiplayer error: ${error.message}`;
      }
    });
  }

  #installInput() {
    addEventListener('keydown', event => {
      if (/^(KeyW|KeyA|KeyS|KeyD|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|ShiftLeft|ShiftRight|Space)$/.test(event.code)) {
        this.keys.add(event.code);
        if (this.explore) event.preventDefault();
      }
      if (!this.explore || event.repeat) return;
      if (event.code === 'Space') this.#jump();
      if (event.code === 'KeyE') this.#placeBrick();
      if (event.code === 'KeyQ') this.#removeBrick();
      if (event.code === 'KeyV') this.viewButton?.click();
      if (event.code === 'KeyR') this.#respawn();
    });
    addEventListener('keyup', event => this.keys.delete(event.code));

    document.addEventListener('mousemove', event => {
      if (!this.explore || document.pointerLockElement !== this.canvas) return;
      this.yaw -= event.movementX * 0.0022;
      this.pitch = THREE.MathUtils.clamp(this.pitch - event.movementY * 0.0018, -1.15, 1.0);
    });
    this.canvas.addEventListener('click', () => {
      if (this.explore && matchMedia('(pointer:fine)').matches && document.pointerLockElement !== this.canvas) {
        this.canvas.requestPointerLock?.();
      }
    });
    this.canvas.addEventListener('pointerup', event => {
      if (this.explore) event.stopImmediatePropagation();
    }, true);

    for (const button of this.touch.querySelectorAll('[data-key]')) {
      const key = button.dataset.key;
      const down = event => {
        event.preventDefault();
        this.virtualKeys.add(key);
        navigator.vibrate?.(6);
      };
      const up = event => {
        event.preventDefault();
        this.virtualKeys.delete(key);
      };
      button.addEventListener('pointerdown', down);
      button.addEventListener('pointerup', up);
      button.addEventListener('pointercancel', up);
      button.addEventListener('pointerleave', up);
    }
    this.touch.querySelector('[data-action="jump"]').addEventListener('pointerdown', event => {
      event.preventDefault();
      this.virtualKeys.add('Space');
      this.#jump();
      navigator.vibrate?.(8);
    });
    this.touch.querySelector('[data-action="jump"]').addEventListener('pointerup', () => this.virtualKeys.delete('Space'));
    this.touch.querySelector('[data-action="jump"]').addEventListener('pointercancel', () => this.virtualKeys.delete('Space'));
    this.touch.querySelector('[data-action="place"]').addEventListener('pointerdown', event => {
      event.preventDefault();
      this.#placeBrick();
      navigator.vibrate?.(8);
    });
    this.touch.querySelector('[data-action="remove"]').addEventListener('pointerdown', event => {
      event.preventDefault();
      this.#removeBrick();
      navigator.vibrate?.(8);
    });

    let lookPointer = null;
    let lastX = 0;
    let lastY = 0;
    this.canvas.addEventListener('pointerdown', event => {
      if (!this.explore || event.pointerType !== 'touch' || event.clientX < innerWidth * 0.46) return;
      lookPointer = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
      this.canvas.setPointerCapture?.(event.pointerId);
    });
    this.canvas.addEventListener('pointermove', event => {
      if (event.pointerId !== lookPointer) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      this.yaw -= dx * 0.0072;
      this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.0055, -1.15, 1.0);
    });
    const endLook = event => { if (event.pointerId === lookPointer) lookPointer = null; };
    this.canvas.addEventListener('pointerup', endLook);
    this.canvas.addEventListener('pointercancel', endLook);
  }

  #wireMultiplayer() {
    this.peerSync.onstatus = label => {
      if (this.peerStatus) this.peerStatus.textContent = label.replace('p2p:', 'P2P ');
    };
    this.peerSync.onpacket = packet => {
      if (packet.type === 'state') this.#receivePeerState(packet);
      if (packet.type === 'build:add') this.#addBuild(packet.payload, false);
      if (packet.type === 'build:remove') this.#deleteBuild(packet.payload?.id, false);
      if (packet.type === 'hello') this.#sendState(true);
    };
  }

  #setExplore(enabled) {
    this.explore = enabled;
    document.body.classList.toggle('world-explore', enabled);
    this.playButton.textContent = enabled ? 'Exit explore' : 'Explore world';
    if (!enabled) {
      this.keys.clear();
      this.virtualKeys.clear();
      document.exitPointerLock?.();
      this.camera.position.set(37, 30, 42);
      this.camera.lookAt(0, 5, 0);
    } else if (matchMedia('(pointer:fine)').matches) {
      this.canvas.focus?.();
    }
  }

  #pressed(...codes) {
    return codes.some(code => this.keys.has(code) || this.virtualKeys.has(code));
  }

  #jump() {
    if (!this.explore || this.swimming || !this.lastGrounded) return;
    this.velocityY = 5.6;
    this.lastGrounded = false;
  }

  #respawn() {
    this.player.copy(this.spawn);
    this.velocityY = 0;
    this.lastGrounded = true;
    this.swimming = false;
    this.climbing = false;
    this.#updateChunks(true);
  }

  #isPartOrBuild(object) {
    return Boolean(dataFlag(object, 'partId') || dataFlag(object, 'buildId'));
  }

  #isCameraCollisionObject(object) {
    if (!object || isDescendantOf(object, this.playerAvatar) || isDescendantOf(object, this.remoteRoot)) return false;
    if (dataFlag(object, 'worldDecoration') || dataFlag(object, 'worldWater')) return false;
    return Boolean(dataFlag(object, 'worldGround') || dataFlag(object, 'partId') || dataFlag(object, 'buildId'));
  }

  #partSurfaceHeightAt(x, z, currentY, maxRise) {
    const originY = currentY + Math.max(0.55, maxRise) + 0.55;
    this.collisionRaycaster.set(new THREE.Vector3(x, originY, z), new THREE.Vector3(0, -1, 0));
    this.collisionRaycaster.near = 0;
    this.collisionRaycaster.far = 9;
    const hits = this.collisionRaycaster.intersectObjects(this.scene.children, true);
    for (const hit of hits) {
      if (!this.#isPartOrBuild(hit.object)) continue;
      if (isDescendantOf(hit.object, this.playerAvatar) || isDescendantOf(hit.object, this.remoteRoot)) continue;
      if (hit.point.y > currentY + maxRise + 0.18) continue;
      if (hit.point.y < currentY - 7.5) continue;
      return hit.point.y;
    }
    return null;
  }

  #surfaceHeightAt(x, z, currentY = this.player.y, maxRise = STEP_HEIGHT) {
    const terrain = terrainCellHeightAt(x, z);
    const part = this.#partSurfaceHeightAt(x, z, currentY, maxRise);
    return part === null ? terrain : Math.max(terrain, part);
  }

  #solidAhead(delta) {
    const distance = delta.length();
    if (distance < 0.0001) return null;
    const direction = delta.clone().normalize();
    const origins = [0.62, 1.18, 1.82];
    for (const yOffset of origins) {
      this.collisionRaycaster.set(
        new THREE.Vector3(this.player.x, this.player.y + yOffset, this.player.z),
        direction,
      );
      this.collisionRaycaster.near = 0.02;
      this.collisionRaycaster.far = distance + PLAYER_RADIUS;
      const hits = this.collisionRaycaster.intersectObjects(this.scene.children, true);
      const hit = hits.find(candidate => this.#isPartOrBuild(candidate.object)
        && !isDescendantOf(candidate.object, this.playerAvatar)
        && !isDescendantOf(candidate.object, this.remoteRoot));
      if (hit) return hit;
    }
    return null;
  }

  #tryHorizontalDelta(delta) {
    if (delta.lengthSq() < 0.0000001) return false;
    const mantle = this.#pressed('Space');
    const maxRise = mantle ? MANTLE_HEIGHT : STEP_HEIGHT;
    const targetX = this.player.x + delta.x;
    const targetZ = this.player.z + delta.z;
    const currentGround = this.#surfaceHeightAt(this.player.x, this.player.z, this.player.y, maxRise);
    const targetGround = this.#surfaceHeightAt(targetX, targetZ, this.player.y, maxRise);
    const rise = targetGround - currentGround;
    const solid = this.#solidAhead(delta);

    if (this.lastGrounded && !this.swimming && rise > maxRise + 0.03) return false;
    if (solid) {
      const canMantle = mantle && this.lastGrounded && rise > 0.16 && rise <= MANTLE_HEIGHT + 0.03;
      if (!canMantle) return false;
      this.player.y = targetGround;
      this.velocityY = Math.max(0.35, this.velocityY);
      this.climbing = true;
    }

    this.player.x = targetX;
    this.player.z = targetZ;
    if (this.lastGrounded && !this.swimming && rise > 0.02 && rise <= maxRise + 0.03) {
      this.player.y = Math.max(this.player.y, targetGround);
    }
    return true;
  }

  #updateMovement(dt) {
    if (!this.explore) return;
    this.climbing = false;
    const forwardAmount = (this.#pressed('KeyW', 'ArrowUp') ? 1 : 0) - (this.#pressed('KeyS', 'ArrowDown') ? 1 : 0);
    const strafeAmount = (this.#pressed('KeyD', 'ArrowRight') ? 1 : 0) - (this.#pressed('KeyA', 'ArrowLeft') ? 1 : 0);
    const moving = forwardAmount !== 0 || strafeAmount !== 0;

    const preGround = this.#surfaceHeightAt(this.player.x, this.player.z, this.player.y, this.lastGrounded ? MANTLE_HEIGHT : 0.12);
    const preWater = waterCellSurfaceAt(this.player.x, this.player.z);
    const canSwim = preWater !== null && preGround < preWater - 0.62;
    this.swimming = canSwim && this.player.y < preWater + 0.14;
    document.body.classList.toggle('world-swimming', this.swimming);

    const speed = this.swimming
      ? 2.75
      : this.#pressed('ShiftLeft', 'ShiftRight') ? 7.2 : 4.45;

    if (moving) {
      const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      const direction = forward.multiplyScalar(forwardAmount).add(right.multiplyScalar(strafeAmount)).normalize();
      const delta = direction.multiplyScalar(speed * dt);
      this.#tryHorizontalDelta(new THREE.Vector3(delta.x, 0, 0));
      this.#tryHorizontalDelta(new THREE.Vector3(0, 0, delta.z));
      this.stepPhase += dt * speed * (this.swimming ? 1.1 : 2.3);
    }

    const ground = this.#surfaceHeightAt(
      this.player.x,
      this.player.z,
      this.player.y,
      this.lastGrounded ? (this.#pressed('Space') ? MANTLE_HEIGHT : STEP_HEIGHT) : 0.12,
    );
    const water = waterCellSurfaceAt(this.player.x, this.player.z);
    const swimmingDepth = water !== null ? water - ground : 0;
    this.swimming = water !== null && swimmingDepth > 0.62 && this.player.y < water + 0.14;

    if (this.swimming) {
      const targetY = Math.max(ground + 0.18, water - 0.68);
      const buoyancy = (targetY - this.player.y) * 8.5;
      this.velocityY += buoyancy * dt;
      if (this.#pressed('Space')) this.velocityY += 5.2 * dt;
      this.velocityY *= Math.exp(-3.2 * dt);
      this.player.y += this.velocityY * dt;
      this.player.y = THREE.MathUtils.clamp(this.player.y, ground, water + 0.10);
      this.lastGrounded = false;
    } else {
      this.velocityY -= 13.5 * dt;
      this.player.y += this.velocityY * dt;
      if (this.player.y <= ground + 0.025 && this.velocityY <= 0) {
        this.player.y = ground;
        this.velocityY = 0;
        this.lastGrounded = true;
      } else if (this.player.y - ground > 0.08) {
        this.lastGrounded = false;
      }
    }

    if (!Number.isFinite(this.player.x + this.player.y + this.player.z) || this.player.y < RESPAWN_Y) {
      this.#respawn();
    }
    this.#updatePlayerAvatar(moving ? speed : 0);
  }

  #updatePlayerAvatar(speed) {
    const bob = speed ? Math.sin(this.stepPhase * 2) * (this.swimming ? 0.012 : 0.025) : 0;
    this.playerAvatar.position.set(this.player.x, this.player.y + bob, this.player.z);
    this.playerAvatar.rotation.y = this.yaw;
    this.playerAvatar.visible = !(this.explore && this.view === 'first');
    const limbs = this.playerAvatar.userData.limbs;
    const swing = speed ? Math.sin(this.stepPhase) * (this.swimming ? 0.28 : 0.55) : 0;
    limbs.leftLeg.rotation.x = swing;
    limbs.rightLeg.rotation.x = -swing;
    limbs.leftArm.rotation.x = -swing * 0.65;
    limbs.rightArm.rotation.x = swing * 0.65;
    if (this.swimming) {
      limbs.leftArm.rotation.z = -0.55;
      limbs.rightArm.rotation.z = 0.55;
    } else {
      limbs.leftArm.rotation.z = -0.15;
      limbs.rightArm.rotation.z = 0.15;
    }
  }

  #cameraHit(eye, desired) {
    const direction = desired.clone().sub(eye);
    const distance = direction.length();
    if (distance < 0.001) return null;
    direction.normalize();
    this.collisionRaycaster.set(eye, direction);
    this.collisionRaycaster.near = 0.08;
    this.collisionRaycaster.far = distance;
    const hits = this.collisionRaycaster.intersectObjects(this.scene.children, true);
    return hits.find(hit => this.#isCameraCollisionObject(hit.object)) || null;
  }

  #updateCamera() {
    if (!this.explore) return;
    const eye = new THREE.Vector3(this.player.x, this.player.y + 2.35, this.player.z);
    const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    if (this.view === 'first') {
      this.camera.position.copy(eye);
      this.camera.quaternion.copy(quaternion);
      this.camera.fov = 67;
    } else {
      const offset = new THREE.Vector3(1.18, 0.72, 4.15).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
      const desired = eye.clone().add(offset);
      const hit = this.#cameraHit(eye, desired);
      if (hit) {
        const direction = desired.clone().sub(eye).normalize();
        this.camera.position.copy(hit.point).addScaledVector(direction, -0.28);
      } else {
        this.camera.position.copy(desired);
      }
      const cameraFloor = terrainCellHeightAt(this.camera.position.x, this.camera.position.z) + 0.42;
      this.camera.position.y = Math.max(this.camera.position.y, cameraFloor);
      const lookDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion);
      this.camera.lookAt(eye.clone().addScaledVector(lookDirection, 7));
      this.camera.fov = 58;
    }
    this.camera.updateProjectionMatrix();
  }

  #ensureChunk(cx, cz, lod) {
    const key = `${cx},${cz}`;
    const existing = this.chunks.get(key);
    if (existing?.lod === lod) return;
    if (existing) {
      existing.group.removeFromParent();
      this.chunks.delete(key);
    }
    const group = createTerrainChunk(cx, cz, lod);
    this.chunkRoot.add(group);
    this.chunks.set(key, { group, lod });
  }

  #updateChunks(force = false) {
    const now = performance.now();
    if (!force && now - this.lastChunkUpdate < 380) return;
    this.lastChunkUpdate = now;
    const cx = Math.round(this.player.x / CHUNK_SIZE);
    const cz = Math.round(this.player.z / CHUNK_SIZE);
    const wanted = new Set();
    for (let dz = -this.farRadius; dz <= this.farRadius; dz += 1) {
      for (let dx = -this.farRadius; dx <= this.farRadius; dx += 1) {
        const x = cx + dx;
        const z = cz + dz;
        const distance = Math.max(Math.abs(dx), Math.abs(dz));
        const lod = distance <= this.nearRadius ? 'near' : 'far';
        const key = `${x},${z}`;
        wanted.add(key);
        this.#ensureChunk(x, z, lod);
      }
    }
    for (const [key, entry] of this.chunks) {
      if (!wanted.has(key)) {
        entry.group.removeFromParent();
        this.chunks.delete(key);
      }
    }
  }

  #buildStorageKey() {
    return `${STORAGE_PREFIX}${this.room}`;
  }

  #loadBuilds() {
    try {
      const records = JSON.parse(localStorage.getItem(this.#buildStorageKey()) || '[]');
      if (Array.isArray(records)) for (const record of records) this.#addBuild(record, false, false);
    } catch (error) {
      console.warn('LEGO Sim build persistence reset', error);
    }
  }

  #saveBuilds() {
    const records = [...this.builds.values()].map(entry => entry.data);
    localStorage.setItem(this.#buildStorageKey(), JSON.stringify(records.slice(-700)));
  }

  #makeBuildMesh(data) {
    const group = new THREE.Group();
    const color = Number.isFinite(data.color) ? data.color : 0xc6944d;
    const material = makeMaterial(color, 0.7);
    const brick = new THREE.Mesh(new THREE.BoxGeometry(BUILD_UNIT, BUILD_HEIGHT, BUILD_UNIT), material);
    brick.castShadow = true;
    brick.receiveShadow = true;
    group.add(brick);
    const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.12, 12), material);
    stud.position.y = BUILD_HEIGHT * 0.5 + 0.06;
    stud.castShadow = true;
    group.add(stud);
    group.position.set(data.x, data.y, data.z);
    group.userData.buildId = data.id;
    group.traverse(object => { object.userData.buildId = data.id; });
    return group;
  }

  #addBuild(data, broadcast = true, persist = true) {
    if (!data?.id || this.builds.has(data.id)) return;
    const normalized = {
      id: String(data.id),
      x: Number(data.x) || 0,
      y: Number(data.y) || FLOOR_Y,
      z: Number(data.z) || 0,
      color: Number(data.color) || 0xc6944d,
    };
    const mesh = this.#makeBuildMesh(normalized);
    this.buildRoot.add(mesh);
    this.builds.set(normalized.id, { data: normalized, mesh });
    if (persist) this.#saveBuilds();
    if (broadcast) this.peerSync.send('build:add', normalized);
  }

  #deleteBuild(id, broadcast = true) {
    const entry = this.builds.get(id);
    if (!entry) return;
    entry.mesh.removeFromParent();
    this.builds.delete(id);
    this.#saveBuilds();
    if (broadcast) this.peerSync.send('build:remove', { id });
  }

  #raycastScene() {
    this.raycaster.setFromCamera(this.center, this.camera);
    const hits = this.raycaster.intersectObjects(this.scene.children, true);
    return hits.find(hit => {
      const object = hit.object;
      return !isDescendantOf(object, this.playerAvatar)
        && !isDescendantOf(object, this.remoteRoot)
        && !dataFlag(object, 'worldDecoration');
    });
  }

  #placeBrick() {
    if (!this.explore) return;
    const hit = this.#raycastScene();
    if (!hit) return;
    const normal = hit.face?.normal?.clone() || new THREE.Vector3(0, 1, 0);
    normal.transformDirection(hit.object.matrixWorld);
    const point = hit.point.clone().addScaledVector(normal, BUILD_HEIGHT * 0.52);
    const snap = value => Math.round(value / BUILD_UNIT) * BUILD_UNIT;
    const minY = terrainCellHeightAt(point.x, point.z) + BUILD_HEIGHT * 0.5;
    const data = {
      id: `${this.peerSync.peerId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      x: snap(point.x),
      y: Math.max(minY, Math.round(point.y / BUILD_HEIGHT) * BUILD_HEIGHT),
      z: snap(point.z),
      color: 0xc6944d,
    };
    this.#addBuild(data, true);
  }

  #removeBrick() {
    if (!this.explore || !this.buildRoot.children.length) return;
    this.raycaster.setFromCamera(this.center, this.camera);
    const hit = this.raycaster.intersectObjects(this.buildRoot.children, true)[0];
    const id = dataFlag(hit?.object, 'buildId');
    if (id) this.#deleteBuild(id, true);
  }

  #receivePeerState(packet) {
    const state = packet.payload;
    if (!state || !Array.isArray(state.position)) return;
    let peer = this.peers.get(packet.sender);
    if (!peer) {
      const colors = [0x2f6eb7, 0xd5a52e, 0x3b8e52, 0xa54b98, 0xd65a31];
      const avatar = makeAvatar(colors[this.peers.size % colors.length]);
      avatar.name = `Remote ${packet.sender}`;
      this.remoteRoot.add(avatar);
      peer = {
        avatar,
        position: new THREE.Vector3(...state.position),
        target: new THREE.Vector3(...state.position),
        yaw: Number(state.yaw) || 0,
        targetYaw: Number(state.yaw) || 0,
        lastSeen: performance.now(),
      };
      this.peers.set(packet.sender, peer);
    }
    peer.target.set(...state.position);
    peer.targetYaw = Number(state.yaw) || 0;
    peer.lastSeen = performance.now();
  }

  #sendState(force = false) {
    const now = performance.now();
    if (!force && now - this.lastNetworkSend < 90) return;
    this.lastNetworkSend = now;
    this.peerSync.send('state', {
      position: [this.player.x, this.player.y, this.player.z],
      yaw: this.yaw,
      view: this.view,
      swimming: this.swimming,
    });
  }

  #updatePeers(dt) {
    const now = performance.now();
    for (const [id, peer] of this.peers) {
      if (now - peer.lastSeen > 12000) {
        peer.avatar.removeFromParent();
        this.peers.delete(id);
        continue;
      }
      const alpha = 1 - Math.exp(-dt * 10);
      peer.position.lerp(peer.target, alpha);
      peer.yaw = THREE.MathUtils.lerp(peer.yaw, peer.targetYaw, alpha);
      peer.avatar.position.copy(peer.position);
      peer.avatar.rotation.y = peer.yaw;
    }
  }

  #updateStats() {
    const x = Math.round(this.player.x);
    const z = Math.round(this.player.z);
    const mode = this.swimming ? 'SWIM' : this.climbing ? 'CLIMB' : this.explore ? 'PLAY' : 'SIM';
    const setDistance = Math.max(0, Math.round(Math.hypot(this.player.x, this.player.z) - SET_CLEAR_RADIUS));
    this.stats.textContent = `${mode} · ${this.peers.size + 1} player${this.peers.size ? 's' : ''} · ${this.chunks.size} chunks · ${this.builds.size} builds · ${x}, ${z}${setDistance ? ` · ${setDistance} from 5986` : ''}`;
  }

  beforeRender(renderer, scene, camera, now = performance.now()) {
    if (renderer !== this.renderer || scene !== this.scene || camera !== this.camera) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;
    this.#updateMovement(dt);
    this.#updateChunks();
    this.#updatePeers(dt);
    this.#sendState();
    this.#updateCamera();
    this.#updateStats();
  }
}

if (!THREE.WebGLRenderer.prototype[PATCH_KEY]) {
  const originalRender = THREE.WebGLRenderer.prototype.render;
  let runtime = null;
  Object.defineProperty(THREE.WebGLRenderer.prototype, PATCH_KEY, { value: true });
  THREE.WebGLRenderer.prototype.render = function patchedRender(scene, camera) {
    if (this.domElement?.id === 'sim') {
      runtime ||= new LegoWorldRuntime(this, scene, camera);
      runtime.beforeRender(this, scene, camera, performance.now());
    }
    return originalRender.call(this, scene, camera);
  };
}
