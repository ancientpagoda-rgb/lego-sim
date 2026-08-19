import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BrickStructure } from './brick-engine.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fb7a1);
scene.fog = new THREE.FogExp2(0x9fb7a1, 0.018);

const canvas = document.querySelector('#sim');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 500);
camera.position.set(30, 27, 36);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.target.set(0, 4, 0);
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 8;
controls.maxDistance = 90;

scene.add(new THREE.HemisphereLight(0xf8f1d7, 0x34402f, 2.2));
const sun = new THREE.DirectionalLight(0xfff0c0, 3.2);
sun.position.set(-18, 32, 22);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -40; sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
scene.add(sun);

const structureRoot = new THREE.Group();
const decorRoot = new THREE.Group();
scene.add(structureRoot, decorRoot);
const clickable = [];
const structure = new BrickStructure(structureRoot, clickable);
const agents = [];
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let modelData = null;
let running = true;
let gravityEnabled = true;
let agentsEnabled = true;
let timeScale = 1;
let cameraMode = 'orbit';
let elapsed = 0;

function material(color, roughness = 0.72, transparent = false, opacity = 1) {
  return new THREE.MeshStandardMaterial({ color, roughness, transparent, opacity });
}

function clearDecor() {
  while (decorRoot.children.length) decorRoot.remove(decorRoot.children[0]);
  agents.length = 0;
}

function palm(x, z, s = 1) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.22 * s, .32 * s, 4.2 * s, 9), material(0x6d432b, .9));
  trunk.position.set(x, 2.1 * s, z); trunk.rotation.z = .05; trunk.castShadow = true; decorRoot.add(trunk);
  for (let i = 0; i < 7; i += 1) {
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(.22 * s, .08 * s, 3.0 * s), material(0x244a2b, .8));
    leaf.position.set(x, 4.3 * s, z); leaf.rotation.y = i * Math.PI * 2 / 7; leaf.rotation.x = -.36; leaf.translateZ(1.2 * s);
    leaf.castShadow = true; decorRoot.add(leaf);
  }
}

function minifig(name, x, z, color, goal) {
  const g = new THREE.Group(); g.name = name;
  const legs = new THREE.Mesh(new THREE.BoxGeometry(.8, .9, .45), material(0x151515)); legs.position.y = .45;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(.95, 1.05, .5), material(color)); torso.position.y = 1.35;
  const head = new THREE.Mesh(new THREE.CylinderGeometry(.34, .34, .55, 18), material(0xe1b63d)); head.position.y = 2.15;
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(.52, .38, .18, 18), material(0x6d432b)); hat.position.y = 2.5;
  [legs, torso, head, hat].forEach(m => { m.castShadow = true; g.add(m); });
  g.position.set(x, .2, z);
  g.userData = { goal: new THREE.Vector3(goal[0], .2, goal[1]), speed: 1 + Math.random() * .35, phase: Math.random() * 10 };
  decorRoot.add(g); agents.push(g);
}

function buildDecor() {
  clearDecor();
  const river = new THREE.Mesh(new THREE.BoxGeometry(9.5, .08, 48.1), material(0x3f789c, .18, true, .76));
  river.position.set(-4, .22, 0); river.receiveShadow = true; decorRoot.add(river);
  for (let i = 0; i < 18; i += 1) {
    const ripple = new THREE.Mesh(new THREE.BoxGeometry(7 + Math.random() * 1.5, .02, .07), material(0xb3d4e2, .4, true, .62));
    ripple.position.set(-4 + Math.sin(i) * .55, .27, -22 + i * 2.55); decorRoot.add(ripple);
  }
  palm(-13, -14, 1.15); palm(-12, 14, .9); palm(3, 15, 1.05); palm(14, 13, .95); palm(4, -16, .85);
  minifig('Johnny Thunder', -12, -8, 0x365d8d, [8, -2]);
  minifig('Achu', 10, 10, 0x8f3d2c, [9, 0]);
  minifig('Miss Gail Storm', -11, 9, 0x3f7a4c, [6, 4]);
  minifig('Señor Palomar', 2, -15, 0x4c4d46, [9, -1]);
}

function buildWorld() {
  if (!modelData) return;
  structure.load(modelData);
  buildDecor();
  elapsed = 0;
}

function updateAgents(dt) {
  if (!agentsEnabled) return;
  for (const a of agents) {
    const to = a.userData.goal.clone().sub(a.position);
    const d = to.length();
    if (d < 1) { a.userData.goal.set((Math.random() - .5) * 24, .2, (Math.random() - .5) * 34); continue; }
    to.normalize();
    a.position.addScaledVector(to, Math.min(d, a.userData.speed * dt));
    a.rotation.y = Math.atan2(to.x, to.z);
    a.position.y = .2 + Math.sin(elapsed * 8 + a.userData.phase) * .035;
  }
}

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

let down = { x: 0, y: 0, t: 0 };
canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
canvas.addEventListener('pointerup', e => {
  if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8 || performance.now() - down.t > 450) return;
  pointer.x = e.clientX / innerWidth * 2 - 1;
  pointer.y = -(e.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(clickable, false)[0];
  if (hit) structure.knock(hit.object.userData.partId, camera.position, modelData?.simulation?.connectionBreakImpulse ?? 5.2);
});

const ui = {
  play: document.querySelector('#togglePlay'), reset: document.querySelector('#reset'), camera: document.querySelector('#cameraMode'),
  gravity: document.querySelector('#gravity'), agents: document.querySelector('#agents'), speed: document.querySelector('#speed'), status: document.querySelector('#status')
};
ui.play.onclick = () => { running = !running; ui.play.textContent = running ? 'Pause' : 'Play'; };
ui.reset.onclick = buildWorld;
ui.gravity.onchange = () => { gravityEnabled = ui.gravity.checked; };
ui.agents.onchange = () => { agentsEnabled = ui.agents.checked; };
ui.speed.onchange = () => { timeScale = Number(ui.speed.value); };
ui.camera.onclick = () => {
  cameraMode = cameraMode === 'orbit' ? 'ground' : 'orbit';
  ui.camera.textContent = `Camera: ${cameraMode}`;
  if (cameraMode === 'ground') { camera.position.set(-12, 2.6, -10); controls.target.set(2, 2, -2); controls.maxPolarAngle = Math.PI * .6; }
  else { camera.position.set(30, 27, 36); controls.target.set(0, 4, 0); controls.maxPolarAngle = Math.PI * .49; }
  controls.update();
};

async function boot() {
  const response = await fetch('./data/5986-model.json');
  if (!response.ok) throw new Error(`model load failed: ${response.status}`);
  modelData = await response.json();
  buildWorld();
  const tied = modelData.parts.filter(p => String(p.verification).startsWith('manual-page')).length;
  ui.status.textContent = `V0.2 structural build · ${tied} instruction-tied placements · inventory validator active`;
}

boot().catch(error => { console.error(error); ui.status.textContent = `Load error: ${error.message}`; });
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const raw = Math.min(.033, (now - last) / 1000); last = now;
  if (running) {
    const dt = raw * timeScale; elapsed += dt;
    const substeps = Math.max(1, Math.ceil(dt / .04));
    const step = Math.min(dt / substeps, .04);
    for (let i = 0; i < substeps; i += 1) structure.update(step, gravityEnabled);
    updateAgents(Math.min(dt, .12));
  }
  controls.update(); renderer.render(scene, camera);
}
requestAnimationFrame(frame);
