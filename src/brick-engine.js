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
  '2549': [4, 16, BRICK_H * 2], '33129': [6, 12, BRICK_H * 1.4],
  '3455': [1, 6, BRICK_H * 2], '3308': [1, 8, BRICK_H * 2],
  '6091': [1, 2, BRICK_H * 1.33], '6081': [2, 4, BRICK_H * 1.33],
  '4073': [1, 1, PLATE_H], '3069': [1, 2, PLATE_H], '3069px23': [1, 2, PLATE_H],
  '30155': [.7, 2.4, 2.4], '32000': [1, 6, PLATE_H],
};

function keyPart(partNo) {
  return String(partNo || '').replace(/px\d+|pb\d+|pr\d+/gi, '');
}

function mat(color, transparent = false) {
  return new THREE.MeshStandardMaterial({
    color: COLOR[color] ?? 0x999999,
    roughness: color?.startsWith('Chrome') ? 0.3 : 0.62,
    metalness: color?.startsWith('Chrome') ? 0.72 : 0,
    transparent,
    opacity: transparent ? 0.58 : 1,
  });
}

function markMesh(mesh, id, cast = true) {
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  mesh.userData.partId = id;
  return mesh;
}

function makeStuds(group, w, d, h, material, id) {
  if (!Number.isInteger(w) || !Number.isInteger(d) || h < PLATE_H) return;
  const geo = new THREE.CylinderGeometry(0.29, 0.29, 0.16, 14);
  for (let ix = 0; ix < w; ix += 1) for (let iz = 0; iz < d; iz += 1) {
    const stud = markMesh(new THREE.Mesh(geo, material), id);
    stud.position.set(ix - (w - 1) / 2, h / 2 + 0.08, iz - (d - 1) / 2);
    group.add(stud);
  }
}

function proxyShape(spec) {
  if (spec.size) return spec.size;
  return DEFAULT_SHAPES[keyPart(spec.partNo)] ?? [1, 1, BRICK_H];
}

function wedgeGeometry(w, d, h) {
  const low = -h / 2 + Math.min(.16, h * .2);
  const hi = h / 2;
  const y0 = -h / 2;
  const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2;
  const vertices = new Float32Array([
    x0,y0,z0, x1,y0,z0, x1,y0,z1, x0,y0,z1,
    x0,low,z0, x1,low,z0, x1,hi,z1, x0,hi,z1,
  ]);
  const indices = [
    0,2,1, 0,3,2,
    0,1,5, 0,5,4,
    3,7,6, 3,6,2,
    0,4,7, 0,7,3,
    1,2,6, 1,6,5,
    4,5,6, 4,6,7,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  g.setIndex(indices); g.computeVertexNormals();
  return g;
}

function addArch(group, w, d, h, material, id) {
  const postDepth = Math.max(.8, Math.min(1, d / 3));
  const beamH = Math.min(.62, h * .28);
  const postH = h;
  for (const z of [-d / 2 + postDepth / 2, d / 2 - postDepth / 2]) {
    const p = markMesh(new THREE.Mesh(new THREE.BoxGeometry(w - .06, postH, postDepth - .06), material), id);
    p.position.set(0, 0, z); group.add(p);
  }
  const beam = markMesh(new THREE.Mesh(new THREE.BoxGeometry(w - .06, beamH, Math.max(.1, d - .06)), material), id);
  beam.position.y = h / 2 - beamH / 2; group.add(beam);
}

function addBridge(group, w, d, h, material, id) {
  const count = 13;
  const span = Math.max(w, d);
  const alongX = w >= d;
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    const along = (t - .5) * span;
    const sag = -Math.sin(Math.PI * t) * Math.min(1.1, h * .45);
    const plank = markMesh(new THREE.Mesh(new THREE.BoxGeometry(alongX ? span / count * .86 : d - .16, .2, alongX ? d - .16 : span / count * .86), material), id);
    plank.position.set(alongX ? along : 0, sag, alongX ? 0 : along);
    group.add(plank);
  }
  const railMat = material.clone(); railMat.roughness = .78;
  for (const side of [-1, 1]) {
    const pts=[];
    for (let i=0;i<count;i+=1) {
      const t=i/(count-1), along=(t-.5)*span, sag=-Math.sin(Math.PI*t)*Math.min(1.1,h*.45)+1.05;
      pts.push(new THREE.Vector3(alongX?along:side*(d/2-.2),sag,alongX?side*(d/2-.2):along));
    }
    const curve=new THREE.CatmullRomCurve3(pts);
    const rail=markMesh(new THREE.Mesh(new THREE.TubeGeometry(curve,32,.08,6,false),railMat),id);
    group.add(rail);
    for(let i=0;i<count;i+=2){
      const t=i/(count-1), along=(t-.5)*span, sag=-Math.sin(Math.PI*t)*Math.min(1.1,h*.45);
      const post=markMesh(new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,1.05,6),railMat),id);
      post.position.set(alongX?along:side*(d/2-.2),sag+.52,alongX?side*(d/2-.2):along); group.add(post);
    }
  }
}

function addBoat(group, w, d, h, material, id) {
  const hull = markMesh(new THREE.Mesh(new THREE.BoxGeometry(w * .78, h * .56, d * .72), material), id);
  hull.position.y = -h * .16; group.add(hull);
  const bow = markMesh(new THREE.Mesh(new THREE.ConeGeometry(w * .39, d * .28, 4), material), id);
  bow.rotation.x = Math.PI / 2; bow.rotation.y = Math.PI / 4;
  bow.scale.z = .8; bow.position.set(0, -h * .16, -d * .47); group.add(bow);
  const stern = markMesh(new THREE.Mesh(new THREE.BoxGeometry(w * .74, h * .64, d * .18), material), id);
  stern.position.set(0, -h * .12, d * .39); group.add(stern);
}

function addBaseplate5986(group, w, d, h, material, id) {
  const slab = markMesh(new THREE.Mesh(new THREE.BoxGeometry(w - .04, h, d - .04), material), id, false);
  slab.position.y = 0; group.add(slab);
  // Molded raised banks and temple pads; the water layer is rendered separately.
  for (const [x,z,sx,sz,sy] of [
    [-11,0,10,46,.55],[10.5,-5,11,30,.65],[10.5,16,11,10,.35],[-9,-11,7,15,.4],
  ]) {
    const bank = markMesh(new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material), id, false);
    bank.position.set(x, h/2 + sy/2, z); group.add(bank);
  }
}

function addFlame(group, w, d, h, material, id) {
  const flame = markMesh(new THREE.Mesh(new THREE.ConeGeometry(Math.max(w,d)*.42,h,7),material),id);
  flame.position.y=0; group.add(flame);
}

function addDisc(group, w, d, h, material, id) {
  const radius=Math.max(d,h)/2;
  const disc=markMesh(new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,Math.max(.16,w),24),material),id);
  disc.rotation.z=Math.PI/2; group.add(disc);
}

function addGem(group, w, d, h, material, id) {
  const gem=markMesh(new THREE.Mesh(new THREE.OctahedronGeometry(Math.max(w,d,h)*.48,0),material),id);
  group.add(gem);
}

function addWheel(group, w, d, h, material, id) {
  const wheel=markMesh(new THREE.Mesh(new THREE.CylinderGeometry(h/2,h/2,Math.max(.35,w),18),material),id);
  wheel.rotation.z=Math.PI/2; group.add(wheel);
  const hubMat=new THREE.MeshStandardMaterial({color:0x333333,roughness:.8});
  const hub=markMesh(new THREE.Mesh(new THREE.CylinderGeometry(h*.22,h*.22,Math.max(.38,w)+.02,14),hubMat),id);
  hub.rotation.z=Math.PI/2; group.add(hub);
}

function addPole(group, w, d, h, material, id) {
  const pole=markMesh(new THREE.Mesh(new THREE.CylinderGeometry(Math.max(.05,Math.min(w,d)/2),Math.max(.05,Math.min(w,d)/2),h,8),material),id);
  group.add(pole);
}

function addIdol(group, w, d, h, material, id) {
  const body=markMesh(new THREE.Mesh(new THREE.CylinderGeometry(Math.max(w,d)*.3,Math.max(w,d)*.42,h*.7,8),material),id);
  body.position.y=-h*.08; group.add(body);
  const head=markMesh(new THREE.Mesh(new THREE.SphereGeometry(Math.max(w,d)*.32,10,8),material),id);
  head.position.y=h*.38; group.add(head);
}

function addPartGeometry(group, spec, size, material, id) {
  const [w,d,h]=size;
  const shape=spec.shape;
  if (shape === 'baseplate5986') addBaseplate5986(group,w,d,h,material,id);
  else if (shape === 'bridge') addBridge(group,w,d,h,material,id);
  else if (shape === 'boat') addBoat(group,w,d,h,material,id);
  else if (shape === 'arch') addArch(group,w,d,h,material,id);
  else if (shape === 'slope') group.add(markMesh(new THREE.Mesh(wedgeGeometry(w-.06,d-.06,h),material),id));
  else if (shape === 'round') {
    const m=markMesh(new THREE.Mesh(new THREE.CylinderGeometry(Math.min(w,d)*.46,Math.min(w,d)*.46,h,16),material),id); group.add(m);
  } else if (shape === 'wheel') addWheel(group,w,d,h,material,id);
  else if (shape === 'flame') addFlame(group,w,d,h,material,id);
  else if (shape === 'disc') addDisc(group,w,d,h,material,id);
  else if (shape === 'gem') addGem(group,w,d,h,material,id);
  else if (shape === 'pole' || shape === 'tool') addPole(group,w,d,h,material,id);
  else if (shape === 'idol') addIdol(group,w,d,h,material,id);
  else if (shape === 'camera') {
    const b=markMesh(new THREE.Mesh(new THREE.BoxGeometry(w||.8,h||.7,d||.5),material),id); group.add(b);
    const lens=markMesh(new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.25,12),new THREE.MeshStandardMaterial({color:0x222222,roughness:.3})),id); lens.rotation.x=Math.PI/2;lens.position.z=-.36;group.add(lens);
  } else if (shape === 'trapdoor') {
    group.add(markMesh(new THREE.Mesh(new THREE.BoxGeometry(w-.06,.18,d-.06),material),id));
  } else {
    group.add(markMesh(new THREE.Mesh(new THREE.BoxGeometry(w-.06,h,d-.06),material),id));
  }
}

function rotatedXZ(spec, w, d) {
  const y=Math.abs(spec.rotation?.[1] ?? 0) % Math.PI;
  const swap=Math.abs(y-Math.PI/2)<.15;
  return swap ? [d,w] : [w,d];
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
    this.parts.clear(); this.dynamic.clear(); this.edges.clear(); this.clickable.length = 0;
  }

  addPart(spec) {
    const id = spec.id ?? `part-${this.parts.size + 1}`;
    const [w,d,h] = proxyShape(spec);
    const group = new THREE.Group(); group.name = `${spec.partNo ?? 'proxy'}:${id}`;
    const transparent = String(spec.color).startsWith('Trans-');
    const material = mat(spec.color, transparent);
    addPartGeometry(group,spec,[w,d,h],material,id);
    if (spec.studs !== false && !['bridge','boat','wheel','flame','disc','gem','pole','tool','idol','camera','trapdoor','baseplate5986','arch','slope'].includes(spec.shape)) {
      makeStuds(group,w,d,h,material,id);
    }
    // Add a few top studs to slopes and arches so they still read as LEGO.
    if (spec.studs !== false && ['slope','arch'].includes(spec.shape)) {
      const topStuds = Math.max(1, Math.floor((spec.shape==='arch'?d:w)));
      const geo=new THREE.CylinderGeometry(.29,.29,.16,12);
      for(let i=0;i<Math.min(topStuds,8);i++){
        const s=markMesh(new THREE.Mesh(geo,material),id);
        if(spec.shape==='arch') s.position.set(0,h/2+.08,(i-(Math.min(topStuds,8)-1)/2));
        else s.position.set((i-(Math.min(topStuds,8)-1)/2),h/2+.08,d/2-.3);
        group.add(s);
      }
    }

    const p=spec.position ?? [0,0,0]; group.position.set(p[0],p[1]+h/2,p[2]);
    const r=spec.rotation ?? [0,0,0]; group.rotation.set(r[0],r[1],r[2]);
    group.userData={spec:{...spec,id,size:[w,d,h]},velocity:new THREE.Vector3(),angular:new THREE.Vector3(),dynamic:false,startPosition:group.position.clone(),startRotation:group.rotation.clone()};
    this.root.add(group); this.parts.set(id,group); this.edges.set(id,new Map());
    if(spec.interactive!==false && !spec.anchored){
      group.traverse(o=>{if(o.isMesh)this.clickable.push(o);});
    }
    return group;
  }

  load(model) {
    this.clear(); this.gravity=model.simulation?.gravity ?? 18;
    for(const spec of model.parts ?? []) this.addPart(spec);
    for(const link of model.connections ?? []) this.connect(link.a,link.b,link.strength ?? 1);
    if(!model.connections?.length) this.inferVerticalConnections();
    return this;
  }

  connect(a,b,strength=1){if(!this.parts.has(a)||!this.parts.has(b))return;this.edges.get(a).set(b,strength);this.edges.get(b).set(a,strength);}
  disconnect(a,b){this.edges.get(a)?.delete(b);this.edges.get(b)?.delete(a);}

  inferVerticalConnections(){
    const parts=[...this.parts.entries()];
    for(let i=0;i<parts.length;i+=1){
      const [aid,a]=parts[i], as=a.userData.spec; const [aw0,ad0,ah]=as.size; const [aw,ad]=rotatedXZ(as,aw0,ad0); const atop=a.position.y+ah/2;
      for(let j=i+1;j<parts.length;j+=1){
        const [bid,b]=parts[j], bs=b.userData.spec; const [bw0,bd0,bh]=bs.size; const [bw,bd]=rotatedXZ(bs,bw0,bd0); const bbot=b.position.y-bh/2;
        let low=a, high=b, lowId=aid, highId=bid, lowW=aw,lowD=ad,highW=bw,highD=bd, gap=Math.abs(atop-bbot);
        const btop=b.position.y+bh/2, abot=a.position.y-ah/2;
        if(Math.abs(btop-abot)<gap){low=b;high=a;lowId=bid;highId=aid;lowW=bw;lowD=bd;highW=aw;highD=ad;gap=Math.abs(btop-abot);}
        if(gap>.11)continue;
        const overlapX=Math.abs(low.position.x-high.position.x)<(lowW+highW)/2-.08;
        const overlapZ=Math.abs(low.position.z-high.position.z)<(lowD+highD)/2-.08;
        if(overlapX&&overlapZ){
          const area=Math.max(.5,Math.min(lowW,highW)*Math.min(lowD,highD)); this.connect(lowId,highId,Math.max(.8,Math.min(4.5,area*.6)));
        }
      }
    }
  }

  anchoredIds(){return [...this.parts.entries()].filter(([,p])=>p.userData.spec.anchored).map(([id])=>id);}
  supportedIds(){const seen=new Set(this.anchoredIds()),queue=[...seen];while(queue.length){const id=queue.shift();for(const next of this.edges.get(id)?.keys()??[]){if(!seen.has(next)){seen.add(next);queue.push(next);}}}return seen;}

  releaseUnsupported(origin=null){
    const supported=this.supportedIds();
    for(const [id,part] of this.parts){
      if(supported.has(id)||part.userData.spec.anchored||part.userData.spec.assembly==='boat')continue;
      part.userData.dynamic=true;this.dynamic.add(part);
      if(origin&&part.userData.velocity.lengthSq()===0){const dir=part.position.clone().sub(origin).setY(.35).normalize();part.userData.velocity.addScaledVector(dir,.65);}
    }
  }

  knock(partId,origin,impulse=5.2){
    const part=this.parts.get(partId);if(!part||part.userData.spec.anchored)return;
    for(const neighbor of [...(this.edges.get(partId)?.keys()??[])])this.disconnect(partId,neighbor);
    part.userData.dynamic=true;const dir=part.position.clone().sub(origin).setY(.55).normalize();
    part.userData.velocity.copy(dir.multiplyScalar(impulse)).add(new THREE.Vector3(0,2.1,0));part.userData.angular.set(dir.z*1.3,.4,-dir.x*1.3);this.dynamic.add(part);this.releaseUnsupported(origin);
  }

  dropAssembly(assembly, origin=new THREE.Vector3()){
    for(const [id,part] of this.parts){
      if(part.userData.spec.assembly!==assembly||part.userData.spec.anchored)continue;
      for(const n of [...(this.edges.get(id)?.keys()??[])])this.disconnect(id,n);
      part.userData.dynamic=true;this.dynamic.add(part);
      const dir=part.position.clone().sub(origin).setY(.2).normalize();part.userData.velocity.addScaledVector(dir,.8);
    }
    this.releaseUnsupported(origin);
  }

  update(dt,gravityEnabled=true){
    for(const part of [...this.dynamic]){
      if(gravityEnabled)part.userData.velocity.y-=this.gravity*dt;
      part.position.addScaledVector(part.userData.velocity,dt);part.rotation.x+=part.userData.angular.x*dt;part.rotation.y+=part.userData.angular.y*dt;part.rotation.z+=part.userData.angular.z*dt;
      const floor=.18;
      if(part.position.y<floor){part.position.y=floor;part.userData.velocity.y*=-.22;part.userData.velocity.x*=.82;part.userData.velocity.z*=.82;part.userData.angular.multiplyScalar(.78);if(part.userData.velocity.length()<.28){part.userData.velocity.set(0,0,0);part.userData.angular.set(0,0,0);part.userData.dynamic=false;this.dynamic.delete(part);}}
    }
  }
}
