import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const STUD = 1;
const BRICK_H = 1.2;
const PLATE_H = 0.4;
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

const root = new THREE.Group();
scene.add(root);
const dynamic = [];
const agents = [];
const clickable = [];
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let running = true;
let gravityEnabled = true;
let agentsEnabled = true;
let timeScale = 1;
let cameraMode = 'orbit';
let elapsed = 0;

const colors = {
  tan: 0xc7a36b, darkTan: 0x8b765c, gray: 0x6d746c, darkGray: 0x404640,
  green: 0x3e6a35, darkGreen: 0x244a2b, blue: 0x3f789c, brown: 0x6d432b,
  red: 0x9d3028, yellow: 0xe1b63d, black: 0x151515, white: 0xe6e1d5
};

function material(color, roughness=.68, metalness=0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function makeStuds(group, w, d, h, color) {
  const geo = new THREE.CylinderGeometry(0.29, 0.29, 0.16, 18);
  const mat = material(color, .58);
  for (let x=0; x<w; x++) for (let z=0; z<d; z++) {
    const s = new THREE.Mesh(geo, mat);
    s.position.set((x-(w-1)/2)*STUD, h/2+.08, (z-(d-1)/2)*STUD);
    s.castShadow = true; s.receiveShadow = true;
    group.add(s);
  }
}

function brick({x=0,y=0,z=0,w=2,d=1,h=BRICK_H,color=colors.tan,studs=true, loose=false, name='brick'}) {
  const g = new THREE.Group();
  g.name = name;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w*STUD-.06, h, d*STUD-.06), material(color));
  body.castShadow = true; body.receiveShadow = true; body.userData.part = g;
  g.add(body);
  if (studs && h >= PLATE_H) makeStuds(g,w,d,h,color);
  g.position.set(x,y+h/2,z);
  g.userData = { loose, velocity:new THREE.Vector3(), grounded:!loose, start:g.position.clone(), clickable:loose };
  root.add(g);
  if (loose) { dynamic.push(g); clickable.push(body); }
  return g;
}

function plate(opts){ return brick({...opts,h:PLATE_H}); }

function column(x,z,height=5,color=colors.tan){
  for(let y=PLATE_H; y<height; y+=BRICK_H) brick({x,y,z,w:2,d:2,color,name:'ruin-column'});
}

function palm(x,z,s=1){
  const trunkMat = material(colors.brown,.9);
  const leafMat = material(colors.darkGreen,.8);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.22*s,.32*s,4.2*s,9),trunkMat);
  trunk.position.set(x,2.1*s,z); trunk.rotation.z=.05; trunk.castShadow=true; root.add(trunk);
  for(let i=0;i<7;i++){
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(.22*s,.08*s,3.0*s),leafMat);
    leaf.position.set(x,4.3*s,z); leaf.rotation.y=i*Math.PI*2/7; leaf.rotation.x=-.36; leaf.translateZ(1.2*s);
    leaf.castShadow=true; root.add(leaf);
  }
}

function minifig(name,x,z,color,goal){
  const g = new THREE.Group(); g.name=name;
  const legs = new THREE.Mesh(new THREE.BoxGeometry(.8,.9,.45),material(colors.black)); legs.position.y=.45;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(.95,1.05,.5),material(color)); torso.position.y=1.35;
  const head = new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.55,18),material(colors.yellow)); head.position.y=2.15;
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(.52,.38,.18,18),material(colors.brown)); hat.position.y=2.5;
  [legs,torso,head,hat].forEach(m=>{m.castShadow=true;g.add(m)});
  g.position.set(x,.2,z); g.userData={goal:new THREE.Vector3(goal[0],.2,goal[1]),speed:1+Math.random()*.35,phase:Math.random()*10};
  root.add(g); agents.push(g); return g;
}

function buildWorld(){
  while(root.children.length) root.remove(root.children[0]);
  dynamic.length=0; clickable.length=0; agents.length=0;

  // 32 × 48 stud island/baseplate approximation
  const base = new THREE.Mesh(new THREE.BoxGeometry(32,.35,48),material(colors.green,.92));
  base.position.y=-.18; base.receiveShadow=true; root.add(base);

  // recessed river corridor through the set
  const river = new THREE.Mesh(new THREE.BoxGeometry(10,.10,48.2),new THREE.MeshPhysicalMaterial({color:colors.blue,roughness:.18,metalness:0,transparent:true,opacity:.78}));
  river.position.set(-4,.03,0); river.receiveShadow=true; root.add(river);
  for(let i=0;i<18;i++){
    const ripple = new THREE.Mesh(new THREE.BoxGeometry(7+Math.random()*2,.02,.08),material(0xb3d4e2,.4));
    ripple.position.set(-4+Math.sin(i)*.6,.10,-22+i*2.55); root.add(ripple);
  }

  // temple terrace and ruin mass
  for(let x=5;x<=13;x+=2) for(let z=-12;z<=9;z+=2) plate({x,y:.02,z,w:2,d:2,color:colors.darkTan,studs:true,name:'terrace'});
  column(7,-7,7.4); column(12,-7,6.2); column(7,5,5); column(12,5,7.4);
  brick({x:9.5,y:5.2,z:-7,w:5,d:2,color:colors.tan,name:'lintel'});
  brick({x:9.5,y:5.2,z:5,w:5,d:2,color:colors.tan,name:'lintel'});
  for(let y=.4;y<4;y+=BRICK_H){
    brick({x:13,y,z:-1,w:2,d:10,color:y>2?colors.darkTan:colors.tan,name:'temple-wall'});
  }
  // central idol / treasure podium
  brick({x:9.5,y:.4,z:-1,w:4,d:4,color:colors.darkGray,name:'idol-base'});
  brick({x:9.5,y:1.6,z:-1,w:2,d:2,color:colors.gray,loose:true,name:'idol-stone'});
  plate({x:9.5,y:2.8,z:-1,w:1,d:1,color:colors.yellow,loose:true,name:'treasure'});

  // rope/wood bridge approximation
  for(let z=-3;z<=7;z+=1.15) brick({x:-4,y:.55,z,w:7,d:1,h:.28,color:colors.brown,studs:false,loose:true,name:'bridge-plank'});
  // banks
  for(let z=-6;z<=10;z+=2){
    brick({x:-10,y:.2,z,w:2,d:2,color:colors.darkTan,name:'bank'});
    brick({x:2,y:.2,z,w:2,d:2,color:colors.darkTan,name:'bank'});
  }

  // boat
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.8,.55,6.2),material(colors.brown,.7)); hull.position.y=.35; hull.castShadow=true; boat.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(1.4,2.2,4),material(colors.brown,.7)); bow.rotation.x=Math.PI/2; bow.position.set(0,.35,-4); boat.add(bow);
  boat.position.set(-4,.12,-14); boat.userData={drift:0}; root.add(boat);

  palm(-13,-14,1.15); palm(-12,14,.9); palm(3,15,1.05); palm(14,13,.95); palm(4,-16,.85);
  for(let i=0;i<18;i++){
    const x=-15+Math.random()*30,z=-22+Math.random()*44;
    const bush=new THREE.Mesh(new THREE.IcosahedronGeometry(.5+Math.random()*.5,0),material(i%2?colors.green:colors.darkGreen,.9));
    bush.position.set(x,.4,z); bush.scale.y=.6; bush.castShadow=true; root.add(bush);
  }

  minifig('Johnny',-12,-8,0x365d8d,[8,-2]);
  minifig('Achu',10,10,0x8f3d2c,[9,0]);
  minifig('Explorer',-11,9,0xb8b4a2,[6,4]);
  minifig('Treasure Hunter',2,-15,0x4c4d46,[9,-1]);

  elapsed=0;
}

function knock(part, origin){
  if(!part?.userData?.loose) return;
  part.userData.grounded=false;
  const dir=part.position.clone().sub(origin).setY(.55).normalize();
  part.userData.velocity.copy(dir.multiplyScalar(5.2)).add(new THREE.Vector3(0,2.4,0));
}

function updatePhysics(dt){
  if(!gravityEnabled) return;
  for(const p of dynamic){
    if(p.userData.grounded) continue;
    p.userData.velocity.y -= 18*dt;
    p.position.addScaledVector(p.userData.velocity,dt);
    p.rotation.x += p.userData.velocity.z*dt*.16;
    p.rotation.z -= p.userData.velocity.x*dt*.16;
    const floor=.16;
    if(p.position.y < floor){
      p.position.y=floor;
      p.userData.velocity.y*=-.28;
      p.userData.velocity.x*=.82; p.userData.velocity.z*=.82;
      if(p.userData.velocity.length()<.55){p.userData.grounded=true;p.userData.velocity.set(0,0,0)}
    }
  }
}

function updateAgents(dt){
  if(!agentsEnabled) return;
  for(const a of agents){
    const to=a.userData.goal.clone().sub(a.position); const d=to.length();
    if(d<1){
      a.userData.goal.set((Math.random()-.5)*24,.2,(Math.random()-.5)*34);
      continue;
    }
    to.normalize();
    const step=Math.min(d,a.userData.speed*dt);
    a.position.addScaledVector(to,step);
    a.rotation.y=Math.atan2(to.x,to.z);
    a.position.y=.2+Math.sin(elapsed*8+a.userData.phase)*.035;
  }
}

function updateEnvironment(dt){
  const boat=root.children.find(o=>o.type==='Group' && o.children.some(c=>c.geometry?.type==='ConeGeometry'));
  if(boat){ boat.position.z += dt*.18; boat.position.x=-4+Math.sin(elapsed*.35)*.35; if(boat.position.z>22) boat.position.z=-22; }
}

function resize(){
  const w=innerWidth,h=innerHeight; renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix();
}
addEventListener('resize',resize); resize();

let down={x:0,y:0,t:0};
canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY,t:performance.now()}});
canvas.addEventListener('pointerup',e=>{
  const moved=Math.hypot(e.clientX-down.x,e.clientY-down.y);
  if(moved>8 || performance.now()-down.t>450) return;
  pointer.x=e.clientX/innerWidth*2-1; pointer.y=-(e.clientY/innerHeight)*2+1;
  raycaster.setFromCamera(pointer,camera);
  const hit=raycaster.intersectObjects(clickable,false)[0];
  if(hit) knock(hit.object.userData.part,camera.position);
});

const ui={
  play:document.querySelector('#togglePlay'), reset:document.querySelector('#reset'), camera:document.querySelector('#cameraMode'),
  gravity:document.querySelector('#gravity'), agents:document.querySelector('#agents'), speed:document.querySelector('#speed'), status:document.querySelector('#status')
};
ui.play.onclick=()=>{running=!running;ui.play.textContent=running?'Pause':'Play'};
ui.reset.onclick=buildWorld;
ui.gravity.onchange=()=>gravityEnabled=ui.gravity.checked;
ui.agents.onchange=()=>agentsEnabled=ui.agents.checked;
ui.speed.onchange=()=>timeScale=Number(ui.speed.value);
ui.camera.onclick=()=>{
  cameraMode=cameraMode==='orbit'?'ground':'orbit';
  ui.camera.textContent=`Camera: ${cameraMode}`;
  if(cameraMode==='ground'){
    camera.position.set(-12,2.6,-10); controls.target.set(2,2,-2); controls.maxPolarAngle=Math.PI*.6; document.body.classList.add('fp');
  }else{
    camera.position.set(30,27,36); controls.target.set(0,4,0); controls.maxPolarAngle=Math.PI*.49; document.body.classList.remove('fp');
  }
  controls.update();
};

buildWorld();
ui.status.textContent='V1 playable reconstruction · procedural bricks + agents + breakable bridge';
let last=performance.now();
function frame(now){
  requestAnimationFrame(frame);
  const raw=Math.min(.033,(now-last)/1000); last=now;
  if(running){
    const dt=raw*timeScale; elapsed+=dt;
    const safeDt=Math.min(dt,.06);
    const substeps=Math.max(1,Math.ceil(dt/.06));
    for(let i=0;i<substeps;i++) updatePhysics(safeDt/substeps);
    updateAgents(Math.min(dt,.12));
    updateEnvironment(Math.min(dt,.2));
  }
  controls.update(); renderer.render(scene,camera);
}
requestAnimationFrame(frame);
