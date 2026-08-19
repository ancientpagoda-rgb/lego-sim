import fs from 'node:fs';

const inventoryText = fs.readFileSync(new URL('../data/5986-inventory.csv', import.meta.url), 'utf8').trim();
const model = JSON.parse(fs.readFileSync(new URL('../data/5986-model.json', import.meta.url), 'utf8'));
const available = new Map();
for (const line of inventoryText.split(/\r?\n/).slice(1)) {
  const [partNo, color, qty] = line.split(',');
  available.set(`${partNo}|${color}`, Number(qty));
}
const used = new Map();
for (const part of model.parts) {
  if (part.id === 'baseplate' || part.partNo) {
    const key = `${part.partNo}|${part.color}`;
    used.set(key, (used.get(key) ?? 0) + 1);
  }
}
const errors = [];
for (const [key, qty] of used) {
  const have = available.get(key) ?? 0;
  if (qty > have) errors.push(`${key}: model uses ${qty}, inventory has ${have}`);
}
if (errors.length) {
  console.error('5986 model exceeds inventory:\n' + errors.join('\n'));
  process.exit(1);
}
const tied = model.parts.filter(p => String(p.verification).startsWith('manual-page')).length;
console.log(`5986 inventory OK: ${model.parts.length} placed parts, ${tied} instruction-tied placements.`);
