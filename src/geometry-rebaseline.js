import * as THREE from 'three';

const close = (a, b, eps = 0.03) => Math.abs(Number(a) - Number(b)) <= eps;

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

// Apply corrections at insertion time. This catches initial construction and
// Reset rebuilds without polling/traversing the scene every frame or interval.
const originalAdd = THREE.Object3D.prototype.add;
THREE.Object3D.prototype.add = function (...objects) {
  const result = originalAdd.apply(this, objects);
  for (const object of objects) correctObject(object);
  return result;
};
