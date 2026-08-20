import * as THREE from 'three';

// Capture the simulation scene without coupling this correction pass to main.js internals.
const originalSceneAdd = THREE.Scene.prototype.add;
THREE.Scene.prototype.add = function (...objects) {
  window.__lego5986Scene = this;
  return originalSceneAdd.apply(this, objects);
};

const close = (a, b, eps = 0.03) => Math.abs(Number(a) - Number(b)) <= eps;

function applyGeometryRebaseline() {
  const scene = window.__lego5986Scene;
  if (!scene) return;

  scene.traverse(object => {
    if (!object.isMesh) return;
    const p = object.geometry?.parameters;
    if (!p) return;

    // main.js decor river: move it from the old flat-base elevation into the
    // molded 30271px1 channel. The actual baseplate is 6 bricks high.
    if (close(p.width, 10.6) && close(p.height, 0.08) && close(p.depth, 47.8)) {
      object.position.y = -6.45;
      object.userData.geometryRebaseline = 'river-channel';
      return;
    }

    // Ripple strips created by main.js. Preserve x/z animation layout, only
    // correct vertical placement so they sit just above the lowered river.
    if (close(p.height, 0.018, 0.006) && close(p.depth, 0.065, 0.012) && p.width >= 5.7 && p.width <= 7.4) {
      object.position.y = -6.39;
      object.userData.geometryRebaseline = 'river-ripple';
    }
  });
}

// buildWorld() can recreate decorative meshes on Reset, so keep this tiny,
// geometry-specific repair active without touching simulation state.
setInterval(applyGeometryRebaseline, 250);
requestAnimationFrame(applyGeometryRebaseline);
