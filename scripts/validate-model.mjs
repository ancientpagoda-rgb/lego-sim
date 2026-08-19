import fs from 'node:fs';

const inventoryText = fs.readFileSync(new URL('../data/5986-inventory.csv', import.meta.url), 'utf8').trim();
const model = JSON.parse(fs.readFileSync(new URL('../data/5986-model.json', import.meta.url), 'utf8'));
if (model.partFiles?.length) model.parts = model.partFiles.flatMap(file => JSON.parse(fs.readFileSync(new URL(`../data/${file.replace(/^\.\//, '')}`, import.meta.url), 'utf8')));
const exclusionsUrl = new URL('../data/5986-ledger-exclusions.json', import.meta.url);
const exclusions = fs.existsSync(exclusionsUrl) ? JSON.parse(fs.readFileSync(exclusionsUrl, 'utf8')) : { items: [] };
const excludedIds = new Set((exclusions.items ?? []).map(item => item.id));
const ledgerParts = model.parts.filter(part => !excludedIds.has(part.id));

const available = new Map();
for (const line of inventoryText.split(/\r?\n/).slice(1)) {
  const [partNo, color, qty] = line.split(',');
  available.set(`${partNo}|${color}`, Number(qty));
}
const used = new Map();
for (const part of ledgerParts) {
  const key = `${part.partNo}|${part.color}`;
  used.set(key, (used.get(key) ?? 0) + 1);
}
const errors = [];
for (const [key, qty] of used) {
  const have = available.get(key) ?? 0;
  if (qty > have) errors.push(`${key}: model uses ${qty}, inventory has ${have}`);
}
const ids = new Set(model.parts.map(p => p.id));
for (const item of exclusions.items ?? []) {
  if (!ids.has(item.id)) errors.push(`ledger exclusion references missing visual part: ${item.id}`);
}
for (const id of ['baseplate','rope-bridge','trapdoor-panel','boat-hull','car-chassis','sun-disc']) {
  if (!ids.has(id)) errors.push(`missing required set element: ${id}`);
}
const assemblies = new Set(model.parts.map(p => p.assembly).filter(Boolean));
for (const name of ['main-temple','bridge-gateway','trap-platform','boat','car']) {
  if (!assemblies.has(name)) errors.push(`missing assembly: ${name}`);
}
if (model.parts.some(p => String(p.verification).includes('layout-proxy'))) errors.push('layout-proxy placements remain in current model');
if (ledgerParts.length < 150) errors.push(`expected at least 150 ledger-positioned regular parts, found ${ledgerParts.length}`);
if (errors.length) {
  console.error('5986 model validation failed:\n' + errors.join('\n'));
  process.exit(1);
}
const exact = ledgerParts.filter(p => /^(?:manual|instruction)-page-\d+/i.test(String(p.verification ?? ''))).length;
console.log(`5986 inventory OK: ${ledgerParts.length} ledger-positioned regular parts, ${exact} instruction-exact placements, ${model.parts.length - ledgerParts.length} visual placeholders excluded, ${assemblies.size} assemblies.`);
