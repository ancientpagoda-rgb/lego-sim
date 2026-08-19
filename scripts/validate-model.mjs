import fs from 'node:fs';

const inventoryText = fs.readFileSync(new URL('../data/5986-inventory.csv', import.meta.url), 'utf8').trim();
const model = JSON.parse(fs.readFileSync(new URL('../data/5986-model.json', import.meta.url), 'utf8'));
if (model.partFiles?.length) model.parts = model.partFiles.flatMap(file => JSON.parse(fs.readFileSync(new URL(`../data/${file.replace(/^\.\//, '')}`, import.meta.url), 'utf8')));
const available = new Map();
for (const line of inventoryText.split(/\r?\n/).slice(1)) {
  const [partNo, color, qty] = line.split(',');
  available.set(`${partNo}|${color}`, Number(qty));
}
const used = new Map();
for (const part of model.parts) {
  const key = `${part.partNo}|${part.color}`;
  used.set(key, (used.get(key) ?? 0) + 1);
}
const errors = [];
for (const [key, qty] of used) {
  const have = available.get(key) ?? 0;
  if (qty > have) errors.push(`${key}: model uses ${qty}, inventory has ${have}`);
}
const ids = new Set(model.parts.map(p => p.id));
for (const id of ['baseplate','rope-bridge','trapdoor-panel','boat-hull','car-chassis','sun-disc']) {
  if (!ids.has(id)) errors.push(`missing required set element: ${id}`);
}
const assemblies = new Set(model.parts.map(p => p.assembly).filter(Boolean));
for (const name of ['main-temple','bridge-gateway','trap-platform','boat','car']) {
  if (!assemblies.has(name)) errors.push(`missing assembly: ${name}`);
}
if (model.parts.some(p => String(p.verification).includes('layout-proxy'))) errors.push('layout-proxy placements remain in v0.3 model');
if (model.parts.length < 150) errors.push(`expected at least 150 placed regular parts, found ${model.parts.length}`);
if (errors.length) {
  console.error('5986 model validation failed:\n' + errors.join('\n'));
  process.exit(1);
}
const tied = model.parts.filter(p => String(p.verification).startsWith('manual-page')).length;
console.log(`5986 inventory OK: ${model.parts.length} placed regular parts, ${tied} instruction-tied placements, ${assemblies.size} assemblies.`);
