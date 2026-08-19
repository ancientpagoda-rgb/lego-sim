import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL('data/5986-model.json', root), 'utf8'));
const inventoryText = fs.readFileSync(new URL('data/5986-inventory.csv', root), 'utf8').trim();

const inventory = [];
for (const line of inventoryText.split(/\r?\n/).slice(1)) {
  const [partNo, color, qtyText] = line.split(',');
  inventory.push({ partNo, color, qty: Number(qtyText) });
}

const slots = [];
const queues = new Map();
const slug = value => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
for (const row of inventory) {
  const key = `${row.partNo}|${row.color}`;
  const queue = [];
  for (let index = 1; index <= row.qty; index += 1) {
    const slot = {
      slotId: `${row.partNo}-${slug(row.color)}-${String(index).padStart(2, '0')}`,
      partNo: row.partNo,
      color: row.color,
      occurrence: index,
      state: 'unpositioned',
      transform: null,
      modelPartId: null,
      verification: null,
    };
    slots.push(slot);
    queue.push(slot);
  }
  queues.set(key, queue);
}

const modelParts = [];
for (const rel of manifest.partFiles ?? []) {
  const chunk = JSON.parse(fs.readFileSync(new URL(`data/${rel.replace('./', '')}`, root), 'utf8'));
  if (!Array.isArray(chunk)) throw new Error(`${rel} must contain a JSON array`);
  modelParts.push(...chunk);
}

const errors = [];
const ids = new Set();
let exact = 0;
let positioned = 0;
for (const part of modelParts) {
  if (!part?.id) errors.push('positioned part without id');
  else if (ids.has(part.id)) errors.push(`duplicate model part id: ${part.id}`);
  else ids.add(part.id);

  if (!part?.partNo || !part?.color) {
    errors.push(`${part?.id ?? '<unknown>'}: missing partNo/color`);
    continue;
  }
  if (!Array.isArray(part.position) || part.position.length !== 3 || part.position.some(n => !Number.isFinite(n))) {
    errors.push(`${part.id}: position must be three finite numbers`);
  }
  if (part.rotation && (!Array.isArray(part.rotation) || part.rotation.length !== 3 || part.rotation.some(n => !Number.isFinite(n)))) {
    errors.push(`${part.id}: rotation must be three finite numbers when present`);
  }

  const key = `${part.partNo}|${part.color}`;
  const queue = queues.get(key);
  const slot = queue?.find(candidate => candidate.state === 'unpositioned');
  if (!slot) {
    errors.push(`${part.id}: no unused inventory slot for ${key}`);
    continue;
  }

  const verification = String(part.verification ?? '');
  const instructionExact = /^(manual|instruction)-page-\d+/i.test(verification);
  slot.state = instructionExact ? 'instruction-exact' : 'positioned-reconstruction';
  slot.modelPartId = part.id;
  slot.verification = verification || null;
  slot.transform = {
    position: part.position,
    rotation: part.rotation ?? [0, 0, 0],
  };
  positioned += 1;
  if (instructionExact) exact += 1;
}

const total = slots.length;
const reconstructed = positioned - exact;
const unpositioned = total - positioned;
const exactRemaining = total - exact;

if (total !== 420) errors.push(`regular-part ledger must contain exactly 420 slots, got ${total}`);
if (positioned !== modelParts.length) errors.push(`positioned count mismatch: ${positioned}/${modelParts.length}`);

const ledger = {
  set: manifest.id,
  target: 420,
  generatedFrom: 'data/5986-inventory.csv + data/5986-model.json partFiles',
  policy: 'Only manual-page-N / instruction-page-N provenance counts as an exact transform.',
  summary: { total, positioned, instructionExact: exact, positionedReconstruction: reconstructed, unpositioned, exactRemaining },
  slots,
};

if (process.argv.includes('--write')) {
  fs.writeFileSync(new URL('data/5986-transform-ledger.json', root), JSON.stringify(ledger, null, 2) + '\n');
}

if (errors.length) {
  console.error('5986 transform ledger errors:\n' + errors.join('\n'));
  process.exit(1);
}

console.log(`5986 transform ledger OK: ${exact}/${total} instruction-exact, ${positioned}/${total} positioned, ${exactRemaining} exact transforms remaining.`);
