import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BrickStructure } from './brick-engine.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fb7a1);
scene.fog = new THREE.FogExp2(0x9fb7a1, 0.013);

const canvas = document.querySelector('#sim');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;

const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 500);
camera.position.set(37, 30, 42);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.target.set(0, 5, 0);
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 8;
controls.maxDistance = 100;

scene.add(new THREE.HemisphereLight(0xfff8df, 0x2e3c2d, 2.35));
const sun = new THREE.DirectionalLight(0xffefc5, 3.4);
sun.position.set(-22, 36, 25);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -42; sun.shadow.camera.right = 42;
sun.shadow.camera.top = 42; sun.shadow.camera.bottom = -42;
scene.add(sun);

const structureRoot = new THREE.Group();
const decorRoot = new THREE.Group();
scene.add(structureRoot, decorRoot);
const clickable = [];
const structure = new BrickStructure(structureRoot, clickable);
const agents = [];
const ambientAnimations = [];
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let modelData = null;
let running = true;
let gravityEnabled = true;
let agentsEnabled = true;
let timeScale = 1;
let cameraMode = 0;
let elapsed = 0;
let trapTimer = 0;
let web = null;

function material(color, roughness = 0.72, transparent = false, opacity = 1) {
  return new THREE.MeshStandardMaterial({ color, roughness, transparent, opacity });
}

function clearDecor() {
  while (decorRoot.children.length) decorRoot.remove(decorRoot.children[0]);
  agents.length = 0; ambientAnimations.length = 0; web = null;
}

function palm(x, z, s = 1, lean = .05) {
  const g = new THREE.Group();
  const trunkMat = material(0x6a4327, .9);
  const leafMat = material(0x24542b, .82);
  for (let i = 0; i < 5; i += 1) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(.20 * s, .27 * s, .9 * s, 8), trunkMat);
    seg.position.y = .45 * s + i * .78 * s;
    seg.rotation.z = lean * i * .35;
    seg.castShadow = true; g.add(seg);
  }
  for (let i = 0; i < 7; i += 1) {
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(.24 * s, .09 * s, 3.1 * s), leafMat);
    leaf.position.y = 4.15 * s; leaf.rotation.y = i * Math.PI * 2 / 7; leaf.rotation.x = -.33;
    leaf.translateZ(1.15 * s); leaf.castShadow = true; g.add(leaf);
  }
  g.position.set(x, .35, z); decorRoot.add(g);
  ambientAnimations.push((t) => { g.rotation.z = Math.sin(t * .55 + x) * .012; });
  return g;
}

function pithHat(color = 0xe9e4d1) {
  const g = new THREE.Group();
  const m = material(color, .65);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(.38, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2), m);
  dome.scale.y = .55; dome.position.y = .02; g.add(dome);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(.52, .52, .08, 16), m); brim.position.y = -.02; g.add(brim);
  return g;
}

function cowboyHat() {
  const g = new THREE.Group(); const m = material(0x6d432b, .8);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(.32, .36, .26, 14), m); crown.position.y = .07; g.add(crown);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(.52, .52, .07, 18), m); brim.position.y = -.08; g.add(brim); return g;
}

function achuHeaddress() {
  const g = new THREE.Group(); const band = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .16, 18), material(0xe0b833)); g.add(band);
  const colors = [0xe6392f,0xf0c735,0x3b70b6,0xe6392f,0xf0c735,0x3b70b6,0xe6392f];
  for (let i=0;i<7;i+=1) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(.13,.72,5), material(colors[i],.65));
    f.position.set((i-3)*.12,.45,-.02); f.rotation.z = (i-3)*-.13; g.add(f);
  }
  return g;
}

function minifig({ name, x, z, torso = 0xb89258, legs = 0x363636, hat = 'cowboy', goal = [0, 0], speed = 1.05 }) {
  const g = new THREE.Group(); g.name = name;
  const legMat = material(legs), torsoMat = material(torso), skin = material(0xe5b940);
  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(.35, .9, .42), legMat); leftLeg.position.set(-.2,.45,0);
  const rightLeg = leftLeg.clone(); rightLeg.position.x = .2;
  const body = new THREE.Mesh(new THREE.BoxGeometry(.88, 1.0, .48), torsoMat); body.position.y = 1.38;
  const head = new THREE.Mesh(new THREE.CylinderGeometry(.34, .34, .55, 16), skin); head.position.y = 2.15;
  const armGeo = new THREE.CylinderGeometry(.12,.14,.85,8);
  const leftArm = new THREE.Mesh(armGeo, torsoMat); leftArm.position.set(-.58,1.42,0); leftArm.rotation.z = -.15;
  const rightArm = leftArm.clone(); rightArm.position.x=.58; rightArm.rotation.z=.15;
  [leftLeg,rightLeg,body,head,leftArm,rightArm].forEach(m=>{m.castShadow=true;g.add(m);});
  let hg = hat === 'pith' ? pithHat() : hat === 'achu' ? achuHeaddress() : hat === 'none' ? null : cowboyHat();
  if (hg) { hg.position.y = 2.52; g.add(hg); }
  g.position.set(x,.42,z);
  g.userData={goal:new THREE.Vector3(goal[0],.42,goal[1]),speed,phase:Math.random()*10,zone:name.includes('Achu')||name.includes('Gabarro')?'temple':'expedition'};
  decorRoot.add(g); agents.push(g); return g;
}

function skeleton(name, x, z, rotation = 0) {
  const g = new THREE.Group(); g.name = name; const bone = material(0xeeeadd,.68);
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(.65,.28,.34),bone); pelvis.position.y=.75; g.add(pelvis);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(.72,.72,.2),bone); torso.position.y=1.28; g.add(torso);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(.34,12,9),bone); skull.position.y=2.0; skull.scale.y=.88; g.add(skull);
  for(const sx of [-1,1]){
    const arm=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,.9,7),bone);arm.position.set(.5*sx,1.32,0);arm.rotation.z=sx*.42;g.add(arm);
    const leg=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,.82,7),bone);leg.position.set(.2*sx,.34,0);g.add(leg);
  }
  g.traverse(o=>{if(o.isMesh)o.castShadow=true;}); g.position.set(x,.25,z); g.rotation.y=rotation; decorRoot.add(g); return g;
}

function crocodile(x,z,r=0) {
  const g=new THREE.Group(), m=material(0x35763e,.8);
  const body=new THREE.Mesh(new THREE.BoxGeometry(2.7,.45,.9),m);body.position.y=.42;g.add(body);
  const head=new THREE.Mesh(new THREE.BoxGeometry(1.15,.38,.85),m);head.position.set(-1.8,.42,0);g.add(head);
  const jaw=new THREE.Mesh(new THREE.BoxGeometry(1.0,.15,.78),material(0x3f8748,.8));jaw.position.set(-1.85,.22,0);g.add(jaw);
  const tail=new THREE.Mesh(new THREE.ConeGeometry(.42,2.1,6),m);tail.rotation.z=Math.PI/2;tail.position.set(2.25,.42,0);g.add(tail);
  g.position.set(x,.3,z);g.rotation.y=r;g.traverse(o=>{if(o.isMesh)o.castShadow=true;});decorRoot.add(g);return g;
}

function snake(x,z,color=0xc53b31,scale=1) {
  const curve=new THREE.CatmullRomCurve3([
    new THREE.Vector3(-.8,0,0),new THREE.Vector3(-.35,.1,.35),new THREE.Vector3(.1,0,-.25),new THREE.Vector3(.55,.08,.25),new THREE.Vector3(.9,0,0)
  ]);
  const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,24,.09*scale,7,false),material(color,.72));
  mesh.position.set(x,.42,z);mesh.rotation.y=Math.random()*Math.PI;mesh.castShadow=true;decorRoot.add(mesh);return mesh;
}

function spider(x,y,z) {
  const g=new THREE.Group(),m=material(0x151515,.75);
  const body=new THREE.Mesh(new THREE.SphereGeometry(.22,10,8),m);g.add(body);
  for(let i=0;i<8;i++){const leg=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.48,5),m);leg.rotation.z=(i<4?1:-1)*.9;leg.rotation.y=(i%4-1.5)*.52;leg.position.x=(i<4?-1:1)*.2;g.add(leg);}
  g.position.set(x,y,z);decorRoot.add(g);return g;
}

function scorpion(x,z) {
  const g=new THREE.Group(),m=material(0x111111,.8);const body=new THREE.Mesh(new THREE.SphereGeometry(.16,8,6),m);g.add(body);
  const tail=new THREE.Mesh(new THREE.TorusGeometry(.28,.045,5,12,Math.PI*1.25),m);tail.rotation.x=Math.PI/2;tail.position.set(.15,.22,0);g.add(tail);
  g.position.set(x,.42,z);decorRoot.add(g);return g;
}

function bat(x,y,z) {
  const g=new THREE.Group(),m=material(0x151515,.75);const b=new THREE.Mesh(new THREE.SphereGeometry(.12,7,5),m);g.add(b);
  for(const s of [-1,1]){const wing=new THREE.Mesh(new THREE.ConeGeometry(.33,.72,3),m);wing.rotation.z=s*Math.PI/2;wing.position.x=s*.35;g.add(wing);}g.position.set(x,y,z);decorRoot.add(g);return g;
}

function parrot(x,y,z) {
  const g=new THREE.Group(),m=material(0x777d77,.7);const body=new THREE.Mesh(new THREE.SphereGeometry(.18,9,7),m);body.scale.y=1.3;g.add(body);
  const beak=new THREE.Mesh(new THREE.ConeGeometry(.07,.18,5),material(0xe1b63d));beak.rotation.x=Math.PI/2;beak.position.set(0,.08,-.2);g.add(beak);g.position.set(x,y,z);decorRoot.add(g);return g;
}

function spiderWeb(x,y,z,rotY=0) {
  const g=new THREE.Group(); const points=[]; const segments=10, rings=4;
  for(let s=0;s<segments;s++){
    const a=s*Math.PI*2/segments; points.push(new THREE.Vector3(0,0,0),new THREE.Vector3(Math.cos(a)*2.1,Math.sin(a)*2.1,0));
  }
  for(let r=1;r<=rings;r++){
    const rad=2.1*r/rings;
    for(let s=0;s<segments;s++){
      const a=s*Math.PI*2/segments,b=(s+1)*Math.PI*2/segments;points.push(new THREE.Vector3(Math.cos(a)*rad,Math.sin(a)*rad,0),new THREE.Vector3(Math.cos(b)*rad,Math.sin(b)*rad,0));
    }
  }
  const geo=new THREE.BufferGeometry().setFromPoints(points);const lines=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:0xe6e5de,transparent:true,opacity:.8}));g.add(lines);
  g.position.set(x,y,z);g.rotation.y=rotY;decorRoot.add(g);return g;
}

function rockPrints() {
  const rockMat=material(0xdfe8df,.9,true,.62);
  const patches=[[-13,-13,3.4,5.5],[-11,11,3.6,5],[12,-12,3.2,4.5],[12,12,3.3,4.8]];
  for(const [x,z,w,d] of patches){
    for(let i=0;i<5;i++){
      const stone=new THREE.Mesh(new THREE.PlaneGeometry(w*(.25+Math.random()*.25),d*(.14+Math.random()*.18)),rockMat);
      stone.rotation.x=-Math.PI/2;stone.rotation.z=(Math.random()-.5)*.7;stone.position.set(x+(Math.random()-.5)*w*.6,.96,z+(Math.random()-.5)*d*.6);decorRoot.add(stone);
    }
  }
}

function buildDecor() {
  clearDecor();
  const waterMat=new THREE.MeshPhysicalMaterial({color:0x397ba3,roughness:.18,metalness:0,transparent:true,opacity:.77,clearcoat:.45});
  const river=new THREE.Mesh(new THREE.BoxGeometry(10.6,.08,47.8),waterMat);river.position.set(-.5,.25,0);river.receiveShadow=true;decorRoot.add(river);
  for(let i=0;i<22;i++){
    const ripple=new THREE.Mesh(new THREE.BoxGeometry(5.8+Math.random()*1.4,.018,.065),material(0xc7e6f0,.35,true,.58));
    ripple.position.set(-.5+Math.sin(i*1.7)*.5,.31,-22+i*2.05);decorRoot.add(ripple);
  }
  rockPrints();

  palm(13,-15,1.02,-.04); palm(13,11,.88,.04); palm(-13,14,.9,-.04); palm(-12,-15,.78,.03); palm(5,15,.72,-.02);
  for(const [x,z,s] of [[-14,4,.8],[-10,19,.65],[14,2,.7],[5,-18,.65],[-12,-2,.6],[14,-7,.65]]){
    const bush=new THREE.Mesh(new THREE.IcosahedronGeometry(s,1),material(0x2a5b30,.9));bush.scale.y=.55;bush.position.set(x,.65,z);bush.castShadow=true;decorRoot.add(bush);
  }

  minifig({name:'Johnny Thunder',x:-12,z:-12,torso:0xc6a56d,legs:0x4b3425,hat:'cowboy',goal:[-8,7],speed:1.12});
  minifig({name:'Miss Gail Storm',x:-11,z:10,torso:0x3c7b4d,legs:0xb73531,hat:'pith',goal:[-7,2],speed:1.05});
  minifig({name:'Dr. Charles Lightning',x:-13,z:13,torso:0xe7e2d4,legs:0x3b6c42,hat:'pith',goal:[-10,-2],speed:.92});
  minifig({name:'Achu',x:10,z:-4,torso:0xc33b30,legs:0xe3c23e,hat:'achu',goal:[9,3],speed:.96});
  minifig({name:'Gabarro',x:12,z:6,torso:0x8b492e,legs:0x252525,hat:'none',goal:[8,-2],speed:1.0});
  minifig({name:'Señor Palomar',x:-9,z:-5,torso:0x6b4a37,legs:0x1f1f1f,hat:'cowboy',goal:[-11,-8],speed:1.08});
  skeleton('Skeleton 1',6.2,-.5,.5); skeleton('Skeleton 2',-11,-2.2,-.8);

  crocodile(-10,18,.35); snake(-5,-18,0xc63e32,1); snake(-2,-12,0x111111,.9); spider(2.5,10.4,7); scorpion(-13,-7); bat(13,14,-3); parrot(12.3,13.1,5.5);
  web=spiderWeb(2.5,10.5,7,Math.PI/2);

  const moteMat=material(0xf6de72,.25,true,.72);
  for(let i=0;i<18;i++){
    const mote=new THREE.Mesh(new THREE.SphereGeometry(.035,6,5),moteMat);mote.position.set((Math.random()-.5)*28,1+Math.random()*10,(Math.random()-.5)*42);decorRoot.add(mote);
    const base=mote.position.clone(), phase=Math.random()*10, amp=.3+Math.random()*.5;
    ambientAnimations.push(t=>{mote.position.y=base.y+Math.sin(t*.8+phase)*amp;mote.position.x=base.x+Math.sin(t*.33+phase)*.25;});
  }
}

function setAssemblyOffset(assembly, offset) {
  for(const part of structure.parts.values()){
    if(part.userData.spec.assembly!==assembly || part.userData.dynamic)continue;
    part.position.copy(part.userData.startPosition).add(offset);
  }
}

function buildWorld() {
  if (!modelData) return;
  structure.load(modelData); buildDecor(); elapsed = 0; trapTimer = 0;
}

function chooseGoal(agent){
  if(agent.userData.zone==='temple') agent.userData.goal.set(5+Math.random()*9,.42,-10+Math.random()*19);
  else {
    const x=-14+Math.random()*9; agent.userData.goal.set(x,.42,-18+Math.random()*36);
  }
}

function updateAgents(dt) {
  if (!agentsEnabled) return;
  for (const a of agents) {
    const to=a.userData.goal.clone().sub(a.position),d=to.length();
    if(d<.8){chooseGoal(a);continue;}
    to.normalize();a.position.addScaledVector(to,Math.min(d,a.userData.speed*dt));a.rotation.y=Math.atan2(to.x,to.z);a.position.y=.42+Math.sin(elapsed*8+a.userData.phase)*.025;
  }
}

function updateSetMotion(dt){
  const boatOffset=new THREE.Vector3(Math.sin(elapsed*.28)*.22,Math.sin(elapsed*.9)*.025,(elapsed*.16)%3-1.5);
  setAssemblyOffset('boat',boatOffset);
  for(const fn of ambientAnimations)fn(elapsed);
  if(trapTimer>0){
    trapTimer=Math.max(0,trapTimer-dt);
    const door=structure.parts.get('trapdoor-panel');if(door&&!door.userData.dynamic)door.rotation.x=Math.min(Math.PI*.55,(2.5-trapTimer)*1.15);
    if(web){web.position.y=10.5-Math.sin((2.5-trapTimer)*2.2)*.35;web.rotation.z=Math.sin((2.5-trapTimer)*8)*.05;}
  }
}

function triggerTraps(){
  trapTimer=2.5;
  const bridge=structure.parts.get('rope-bridge');
  if(bridge&&!bridge.userData.dynamic)structure.knock('rope-bridge',new THREE.Vector3(-8,5,7),2.1);
}

function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}
addEventListener('resize',resize);resize();

let down={x:0,y:0,t:0};
canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY,t:performance.now()};});
canvas.addEventListener('pointerup',e=>{
  if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>8||performance.now()-down.t>450)return;
  pointer.x=e.clientX/innerWidth*2-1;pointer.y=-(e.clientY/innerHeight)*2+1;raycaster.setFromCamera(pointer,camera);
  const hit=raycaster.intersectObjects(clickable,false)[0];if(hit)structure.knock(hit.object.userData.partId,camera.position,modelData?.simulation?.connectionBreakImpulse??5.2);
});

const ui={
  play:document.querySelector('#togglePlay'),reset:document.querySelector('#reset'),camera:document.querySelector('#cameraMode'),traps:document.querySelector('#traps'),
  gravity:document.querySelector('#gravity'),agents:document.querySelector('#agents'),speed:document.querySelector('#speed'),status:document.querySelector('#status')
};
ui.play.onclick=()=>{running=!running;ui.play.textContent=running?'Pause':'Play';};
ui.reset.onclick=buildWorld;ui.traps.onclick=triggerTraps;
ui.gravity.onchange=()=>{gravityEnabled=ui.gravity.checked;};ui.agents.onchange=()=>{agentsEnabled=ui.agents.checked;};ui.speed.onchange=()=>{timeScale=Number(ui.speed.value);};
ui.camera.onclick=()=>{
  cameraMode=(cameraMode+1)%3;
  if(cameraMode===0){camera.position.set(37,30,42);controls.target.set(0,5,0);controls.maxPolarAngle=Math.PI*.49;ui.camera.textContent='Camera: orbit';}
  else if(cameraMode===1){camera.position.set(-13,3.0,-16);controls.target.set(5,4,0);controls.maxPolarAngle=Math.PI*.62;ui.camera.textContent='Camera: ground';}
  else{camera.position.set(0,64,.01);controls.target.set(0,0,0);controls.maxPolarAngle=.12;ui.camera.textContent='Camera: overhead';}
  controls.update();
};

async function boot(){
  const response=await fetch('./data/5986-model.json');if(!response.ok)throw new Error(`model load failed: ${response.status}`);modelData=await response.json();
  if(modelData.partFiles?.length){const chunks=await Promise.all(modelData.partFiles.map(async path=>{const r=await fetch(`./data/${path.replace(/^\.\//,'')}`);if(!r.ok)throw new Error(`part chunk load failed: ${path} ${r.status}`);return r.json();}));modelData.parts=chunks.flat();}
  buildWorld();
  const tied=modelData.parts.filter(p=>/^(?:manual|instruction)-page-\d+/i.test(String(p.verification ?? ''))).length;
  const assemblies=new Set(modelData.parts.map(p=>p.assembly).filter(Boolean)).size;
  ui.status.textContent=`V${modelData.version ?? '0.6'} · ${modelData.parts.length} rendered parts · ${tied} instruction-exact · 8 minifigs · ${assemblies} assemblies`;
}
boot().catch(error=>{console.error(error);ui.status.textContent=`Load error: ${error.message}`;});

let last=performance.now();
function frame(now){
  requestAnimationFrame(frame);const raw=Math.min(.033,(now-last)/1000);last=now;
  if(running){const dt=raw*timeScale;elapsed+=dt;const substeps=Math.max(1,Math.ceil(dt/.04));const step=Math.min(dt/substeps,.04);for(let i=0;i<substeps;i+=1)structure.update(step,gravityEnabled);updateAgents(Math.min(dt,.12));updateSetMotion(Math.min(dt,.15));}
  controls.update();renderer.render(scene,camera);
}
requestAnimationFrame(frame);
