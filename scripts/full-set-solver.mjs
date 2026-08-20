import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const input = process.argv[2] ?? 'data/5986-ldd-candidates.json';
const outIndex = process.argv.indexOf('--out');
const output = outIndex >= 0 ? process.argv[outIndex + 1] : 'data/5986-full-set-solver.json';
const DESIGN_ALIASES = new Map([['60169', '30104']]);

function readJson(rel, fallback = null) {
  const url = new URL(rel, root);
  return fs.existsSync(url) ? JSON.parse(fs.readFileSync(url, 'utf8')) : fallback;
}
function baseDesign(value = '') {
  const text = String(value).trim();
  const raw = text.match(/^\d+/)?.[0] ?? text.replace(/(?:px|pb|pr).*$/i, '');
  return DESIGN_ALIASES.get(raw) ?? raw;
}
function key(design, color) { return `${design}|${color}`; }
function instructionPage(verification) {
  const match = String(verification ?? '').match(/^(?:manual|instruction)-page-(\d+)/i);
  return match ? Number(match[1]) : null;
}

const manifest = readJson('data/5986-model.json');
const inventoryText = fs.readFileSync(new URL('data/5986-inventory.csv', root), 'utf8').trim();
const exclusions = readJson('data/5986-ledger-exclusions.json', { items: [] });
const excludedIds = new Set((exclusions.items ?? []).map(item => item.id));
const candidateRoot = JSON.parse(fs.readFileSync(new URL(input, root), 'utf8'));
const structure = readJson('data/5986-ldd-structure-summary.json', null);
const sourceIndex = readJson('data/5986-instruction-sources.json', { manualPages: 44, capturedPages: [] });

const inventory = inventoryText.split(/\r?\n/).slice(1).map(line => {
  const [partNo, color, qtyText] = line.split(',');
  return { partNo, color, qty: Number(qtyText), design: baseDesign(partNo) };
});
const parts = (manifest.partFiles ?? []).flatMap(rel => readJson(`data/${rel.replace('./', '')}`, []));
const ledgerParts = parts.filter(part => !excludedIds.has(part.id));
const exactParts = ledgerParts.filter(part => instructionPage(part.verification) != null);

const inventoryGroups = new Map();
for (const row of inventory) {
  const k = key(row.design, row.color);
  const group = inventoryGroups.get(k) ?? { design: row.design, color: row.color, capacity: 0, variants: [] };
  group.capacity += row.qty;
  group.variants.push({ partNo: row.partNo, qty: row.qty });
  inventoryGroups.set(k, group);
}
const candidateGroups = new Map();
for (const candidate of candidateRoot.parts ?? []) {
  if (!candidate.transform || !candidate.materialName || !candidate.normalizedDesign) continue;
  const k = key(candidate.normalizedDesign, candidate.materialName);
  if (!inventoryGroups.has(k)) continue;
  const list = candidateGroups.get(k) ?? [];
  list.push(candidate);
  candidateGroups.set(k, list);
}
for (const list of candidateGroups.values()) list.sort((a, b) => String(a.lddRef).localeCompare(String(b.lddRef), undefined, { numeric: true }));

const exactByInventoryKey = new Map();
for (const part of exactParts) {
  const k = key(baseDesign(part.partNo), part.color);
  const list = exactByInventoryKey.get(k) ?? [];
  list.push(part);
  exactByInventoryKey.set(k, list);
}

const groupReports = [];
for (const [k, group] of [...inventoryGroups].sort((a, b) => a[0].localeCompare(b[0]))) {
  const candidates = candidateGroups.get(k) ?? [];
  const exact = exactByInventoryKey.get(k) ?? [];
  const uniqueVariants = [...new Set(group.variants.map(v => v.partNo))];
  let geometryState;
  if (candidates.length === 0) geometryState = 'no-cad-match';
  else if (uniqueVariants.length > 1) geometryState = 'inventory-variant-ambiguous';
  else if (candidates.length < group.capacity) geometryState = 'cad-shortfall';
  else if (candidates.length > group.capacity) geometryState = 'cad-overflow';
  else geometryState = 'geometry-complete';
  groupReports.push({
    key: k,
    design: group.design,
    color: group.color,
    capacity: group.capacity,
    inventoryVariants: group.variants,
    candidateRecords: candidates.length,
    exactParts: exact.length,
    geometryState,
    lddRefs: geometryState === 'geometry-complete' ? candidates.map(c => String(c.lddRef)) : [],
  });
}

const groupReportByKey = new Map(groupReports.map(group => [group.key, group]));
const slots = [];
const slotQueues = new Map();
for (const row of inventory) {
  const k = key(row.partNo, row.color);
  const queue = slotQueues.get(k) ?? [];
  const start = queue.length;
  for (let i = 1; i <= row.qty; i += 1) {
    const slot = {
      slotId: `${row.partNo}-${row.color.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${String(start + i).padStart(2, '0')}`,
      partNo: row.partNo,
      color: row.color,
      design: row.design,
      occurrence: start + i,
      currentState: 'unpositioned',
      modelPartId: null,
      manualPage: null,
      solverState: null,
      candidateLddRef: null,
    };
    slots.push(slot);
    queue.push(slot);
  }
  slotQueues.set(k, queue);
}

for (const part of ledgerParts) {
  const queue = slotQueues.get(key(part.partNo, part.color));
  const slot = queue?.find(item => item.currentState === 'unpositioned');
  if (!slot) continue;
  const page = instructionPage(part.verification);
  slot.currentState = page != null ? 'instruction-exact' : 'positioned-reconstruction';
  slot.modelPartId = part.id;
  slot.manualPage = page;
}

const groupSlots = new Map();
for (const slot of slots) {
  const k = key(slot.design, slot.color);
  const list = groupSlots.get(k) ?? [];
  list.push(slot);
  groupSlots.set(k, list);
}
for (const [k, list] of groupSlots) {
  const report = groupReportByKey.get(k);
  const refs = report?.geometryState === 'geometry-complete' ? [...report.lddRefs] : [];
  list.sort((a, b) => a.partNo.localeCompare(b.partNo) || a.occurrence - b.occurrence);
  for (let i = 0; i < list.length; i += 1) {
    const slot = list[i];
    if (slot.currentState === 'instruction-exact') {
      slot.solverState = 'instruction-exact';
      const part = exactParts.find(p => p.id === slot.modelPartId);
      slot.candidateLddRef = part?.geometryCrosscheck?.lddRef ? String(part.geometryCrosscheck.lddRef) : null;
      continue;
    }
    if (!report) slot.solverState = 'no-inventory-group';
    else if (report.geometryState === 'geometry-complete') {
      slot.solverState = 'geometry-ready-page-blocked';
      slot.candidateLddRef = refs[i] ?? null;
    } else if (report.geometryState === 'inventory-variant-ambiguous') slot.solverState = 'variant-ambiguous-page-blocked';
    else if (report.geometryState === 'cad-overflow') slot.solverState = 'cad-overflow-page-blocked';
    else if (report.geometryState === 'cad-shortfall') slot.solverState = 'cad-shortfall';
    else slot.solverState = 'no-cad-match';
  }
}

const solverCounts = Object.fromEntries([...new Set(slots.map(s => s.solverState))].sort().map(state => [state, slots.filter(s => s.solverState === state).length]));
const exact = slots.filter(slot => slot.currentState === 'instruction-exact').length;
const remaining = slots.length - exact;
const geometryReadyRemaining = slots.filter(slot => slot.solverState === 'geometry-ready-page-blocked').length;
const ambiguousRemaining = slots.filter(slot => /ambiguous|overflow/.test(slot.solverState ?? '')).length;
const shortfallRemaining = slots.filter(slot => slot.solverState === 'cad-shortfall' || slot.solverState === 'no-cad-match').length;
const capturedPages = new Set((sourceIndex.capturedPages ?? []).map(row => Number(row.page)));

const result = {
  set: manifest.id,
  mode: 'v0.6 full-set solver',
  exactAuthority: false,
  targetSlots: slots.length,
  currentInstructionExact: exact,
  remainingExactTransforms: remaining,
  geometryReadyButPageBlocked: geometryReadyRemaining,
  geometryAmbiguousOrOverflow: ambiguousRemaining,
  geometryShortfallOrMissing: shortfallRemaining,
  capturedManualPages: capturedPages.size,
  manualPages: sourceIndex.manualPages ?? 44,
  lddHasPotentialBuildSequenceMetadata: structure?.hasPotentialBuildSequenceMetadata ?? null,
  lddHasPotentialGroupingMetadata: structure?.hasPotentialGroupingMetadata ?? null,
  solverCounts,
  completionGate: 'A non-exact slot can be promoted only after a specific manual page/step or visible-state provenance is attached and no exact LDD-ref conflict exists.',
  policy: 'The solver may assign CAD geometry candidates to interchangeable inventory occurrences, but CAD alone never changes the instruction-exact count.',
  groups: groupReports,
  slots,
};

if (slots.length !== 420) throw new Error(`Expected 420 inventory slots, got ${slots.length}`);
if (exact !== exactParts.length) throw new Error(`Exact slot mismatch ${exact}/${exactParts.length}`);
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({
  targetSlots: result.targetSlots,
  currentInstructionExact: result.currentInstructionExact,
  remainingExactTransforms: result.remainingExactTransforms,
  geometryReadyButPageBlocked: result.geometryReadyButPageBlocked,
  geometryAmbiguousOrOverflow: result.geometryAmbiguousOrOverflow,
  geometryShortfallOrMissing: result.geometryShortfallOrMissing,
  lddHasPotentialBuildSequenceMetadata: result.lddHasPotentialBuildSequenceMetadata,
  lddHasPotentialGroupingMetadata: result.lddHasPotentialGroupingMetadata,
  solverCounts,
}, null, 2));
