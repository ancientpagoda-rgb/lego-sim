import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL('data/5986-model.json', root), 'utf8'));
const inventoryText = fs.readFileSync(new URL('data/5986-inventory.csv', root), 'utf8').trim();
const exclusionsUrl = new URL('data/5986-ledger-exclusions.json', root);
const exclusions = fs.existsSync(exclusionsUrl) ? JSON.parse(fs.readFileSync(exclusionsUrl, 'utf8')) : { items: [] };
const excludedIds = new Set((exclusions.items ?? []).map(item => item.id));

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
      presentationTransform: null,
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
const ledgerParts = modelParts.filter(part => !excludedIds.has(part.id));

const finiteVector = (value, length) => Array.isArray(value) && value.length === length && value.every(Number.isFinite);
const errors = [];
const ids = new Set();
for (const part of modelParts) {
  if (!part?.id) errors.push('positioned part without id');
  else if (ids.has(part.id)) errors.push(`duplicate model part id: ${part.id}`);
  else ids.add(part.id);
}
for (const item of exclusions.items ?? []) {
  if (!ids.has(item.id)) errors.push(`ledger exclusion references missing visual part: ${item.id}`);
  if (!item.reason) errors.push(`ledger exclusion missing reason: ${item.id}`);
}

let exact = 0;
let positioned = 0;
for (const part of ledgerParts) {
  if (!part?.partNo || !part?.color) {
    errors.push(`${part?.id ?? '<unknown>'}: missing partNo/color`);
    continue;
  }
  if (!finiteVector(part.position, 3)) errors.push(`${part.id}: presentation position must be three finite numbers`);
  if (part.rotation && !finiteVector(part.rotation, 3)) errors.push(`${part.id}: presentation rotation must be three finite numbers when present`);

  const key = `${part.partNo}|${part.color}`;
  const queue = queues.get(key);
  const slot = queue?.find(candidate => candidate.state === 'unpositioned');
  if (!slot) {
    errors.push(`${part.id}: no unused inventory slot for ${key}`);
    continue;
  }

  const verification = String(part.verification ?? '');
  const instructionExact = /^(manual|instruction)-page-\d+/i.test(verification);
  const presentationTransform = { position: part.position, rotation: part.rotation ?? [0, 0, 0] };
  slot.state = instructionExact ? 'instruction-exact' : 'positioned-reconstruction';
  slot.modelPartId = part.id;
  slot.verification = verification || null;
  slot.presentationTransform = presentationTransform;

  if (instructionExact) {
    const exactTransform = part.instructionTransform;
    if (!exactTransform) errors.push(`${part.id}: instruction-exact part missing instructionTransform`);
    else {
      if (!finiteVector(exactTransform.position, 3)) errors.push(`${part.id}: instructionTransform.position must be three finite numbers`);
      const hasEuler = finiteVector(exactTransform.rotation, 3);
      const hasMatrix = finiteVector(exactTransform.rotationMatrix3, 9);
      if (!hasEuler && !hasMatrix) errors.push(`${part.id}: instructionTransform requires rotation[3] or rotationMatrix3[9]`);
      slot.transform = exactTransform;
    }
  } else {
    slot.transform = presentationTransform;
  }
  positioned += 1;
  if (instructionExact) exact += 1;
}

const total = slots.length;
const reconstructed = positioned - exact;
const unpositioned = total - positioned;
const exactRemaining = total - exact;

if (total !== 420) errors.push(`regular-part ledger must contain exactly 420 slots, got ${total}`);
if (positioned !== ledgerParts.length) errors.push(`positioned count mismatch: ${positioned}/${ledgerParts.length}`);

const ledger = {
  set: manifest.id,
  target: 420,
  generatedFrom: 'data/5986-inventory.csv + data/5986-model.json partFiles + data/5986-ledger-exclusions.json',
  policy: 'Instruction-exact slots store explicit instructionTransform data. Disproven visual placeholders are rendered but do not consume inventory slots.',
  summary: {
    total,
    positioned,
    instructionExact: exact,
    positionedReconstruction: reconstructed,
    unpositioned,
    exactRemaining,
    renderedVisualParts: modelParts.length,
    excludedVisualPlaceholders: modelParts.length - ledgerParts.length,
  },
  exclusions: exclusions.items ?? [],
  slots,
};

if (process.argv.includes('--write')) fs.writeFileSync(new URL('data/5986-transform-ledger.json', root), JSON.stringify(ledger, null, 2) + '\n');

if (errors.length) {
  console.error('5986 transform ledger errors:\n' + errors.join('\n'));
  process.exit(1);
}
console.log(`5986 transform ledger OK: ${exact}/${total} instruction-exact, ${positioned}/${total} ledger-positioned, ${modelParts.length - ledgerParts.length} visual placeholders excluded, ${exactRemaining} exact transforms remaining.`);
