import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL('data/5986-model.json', root), 'utf8'));
const parts = (manifest.partFiles ?? []).flatMap(rel => JSON.parse(fs.readFileSync(new URL(`data/${rel.replace('./', '')}`, root), 'utf8')));
const byId = new Map(parts.map(part => [part.id, part]));
const errors = [];
const near = (a, b, eps = 1e-6) => Math.abs(Number(a) - Number(b)) <= eps;
const exact = part => /^(?:manual|instruction)-page-\d+/i.test(String(part?.verification ?? ''));

for (const part of parts.filter(part => part.assembly === 'terrain-mold')) {
  if (!Array.isArray(part.position) || !Array.isArray(part.size)) {
    errors.push(`${part.id}: terrain helper missing position/size`);
    continue;
  }
  const top = part.position[1] + part.size[2];
  if (part.id.endsWith('pit-floor')) {
    if (top > -5.2 || top < -5.5) errors.push(`${part.id}: pit-floor top ${top} should stay near -5.35`);
  } else if (!near(top, 0.35, 1e-6)) {
    errors.push(`${part.id}: terrain top ${top} must equal the 0.35 build datum`);
  }
}

const gate = byId.get('gate-core');
const bridge = byId.get('rope-bridge');
if (!gate || !bridge) errors.push('gateway/bridge anchors missing');
else {
  if (!exact(gate) || !exact(bridge)) errors.push('gateway/bridge anchors must remain instruction-exact');
  if (!near(gate.position?.[1], 0.35)) errors.push(`gate-core bottom datum ${gate.position?.[1]} must remain 0.35`);
  if (bridge.size?.[0] !== 16 || bridge.size?.[1] !== 4) errors.push(`rope-bridge must present as 16x4, got ${bridge.size}`);
  const expectedX = gate.position[0] + Number(bridge.instructionTransform?.position?.[0] ?? NaN);
  const expectedZ = gate.position[2] + Number(bridge.instructionTransform?.position?.[2] ?? NaN);
  if (!near(bridge.position?.[0], expectedX) || !near(bridge.position?.[2], expectedZ)) {
    errors.push(`rope-bridge presentation center ${bridge.position} must track exact gate-local offset (${expectedX}, *, ${expectedZ})`);
  }
  const bridgeGatewayEdge = bridge.position[0] + bridge.size[0] / 2;
  const gateEastEdge = gate.position[0] + 4 / 2; // 4202 presentation footprint is 4 studs across x.
  if (!near(bridgeGatewayEdge, gateEastEdge)) errors.push(`bridge endpoint ${bridgeGatewayEdge} must meet gate-core edge ${gateEastEdge}`);
}

const chassis = byId.get('car-chassis');
const frontAxle = byId.get('car-axle-front');
const rearAxle = byId.get('car-axle-rear');
const tub = byId.get('car-seat-tub');
const grille = byId.get('car-front-grille');
for (const [name, part] of [['car-chassis', chassis], ['car-axle-front', frontAxle], ['car-axle-rear', rearAxle], ['car-seat-tub', tub], ['car-front-grille', grille]]) {
  if (!part) errors.push(`${name}: required refit anchor missing`);
  else if (!exact(part)) errors.push(`${name}: required refit anchor is not instruction-exact`);
}
if (frontAxle && rearAxle && tub) {
  const zMin = Math.min(frontAxle.position[2], rearAxle.position[2]);
  const zMax = Math.max(frontAxle.position[2], rearAxle.position[2]);
  if (!(tub.position[2] > zMin && tub.position[2] < zMax)) errors.push(`car-seat-tub z=${tub.position[2]} must sit between axle centers ${zMin}..${zMax}`);
  if (!near(tub.position[0], chassis?.position?.[0])) errors.push('car-seat-tub must remain centered on chassis x');
}
if (grille && frontAxle) {
  if (!(grille.position[2] < frontAxle.position[2])) errors.push(`car-front-grille z=${grille.position[2]} must remain ahead of front axle z=${frontAxle.position[2]}`);
  if (!near(grille.position[0], chassis?.position?.[0])) errors.push('car-front-grille must remain centered on chassis x');
}

if (errors.length) {
  console.error('5986 assembly refit validation failed:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('5986 assembly refit OK: terrain datum, bridge/gateway attachment, and exact jeep core are internally consistent.');
