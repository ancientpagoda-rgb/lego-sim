import fs from 'node:fs';
const root = new URL('../', import.meta.url);
const sources = JSON.parse(fs.readFileSync(new URL('data/5986-instruction-sources.json', root), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(new URL('data/5986-model.json', root), 'utf8'));
const parts = (manifest.partFiles ?? []).flatMap(rel => JSON.parse(fs.readFileSync(new URL(`data/${rel.replace('./', '')}`, root), 'utf8')));
const exclusionsUrl = new URL('data/5986-ledger-exclusions.json', root);
const exclusions = fs.existsSync(exclusionsUrl) ? JSON.parse(fs.readFileSync(exclusionsUrl, 'utf8')) : { items: [] };
const excludedIds = new Set((exclusions.items ?? []).map(item => item.id));
const partById = new Map(parts.map(part => [part.id, part]));
const errors = [];
const finiteVector = (value, length) => Array.isArray(value) && value.length === length && value.every(Number.isFinite);

if (!sources.geometryCrosscheck?.file) errors.push('missing geometryCrosscheck.file');
if (sources.geometryCrosscheck?.policy?.toLowerCase().includes('never counts') !== true) errors.push('geometry cross-check policy must explicitly prevent automatic exact promotion');

for (const item of exclusions.items ?? []) {
  const part = partById.get(item.id);
  if (!part) errors.push(`ledger exclusion references missing visual part: ${item.id}`);
  if (!item.reason) errors.push(`ledger exclusion missing reason: ${item.id}`);
  if (part && /^(?:manual|instruction)-page-/i.test(String(part.verification ?? ''))) errors.push(`${item.id}: instruction-exact part cannot be excluded from the 420-part ledger`);
}

for (const part of parts) {
  const verification = String(part.verification ?? '');
  const exact = /^(?:manual|instruction)-page-/i.test(verification);
  if (/^(?:ldd|digital-model)/i.test(verification)) errors.push(`${part.id}: digital-model provenance cannot be used as an exact verification prefix`);
  if (exact && !part.instructionTransform) errors.push(`${part.id}: instruction-exact part missing instructionTransform`);

  if (exact && part.instructionTransform?.parent === 'ldd-set-origin') {
    if (!finiteVector(part.instructionTransform.position, 3)) errors.push(`${part.id}: LDD-backed exact transform needs a finite position[3]`);
    if (!finiteVector(part.instructionTransform.rotationMatrix3, 9)) errors.push(`${part.id}: LDD-backed exact transform needs rotationMatrix3[9]`);
    if (!part.geometryCrosscheck?.lddRef) errors.push(`${part.id}: LDD-backed exact transform missing geometryCrosscheck.lddRef`);
    if (!part.geometryCrosscheck?.lddDesignID) errors.push(`${part.id}: LDD-backed exact transform missing geometryCrosscheck.lddDesignID`);
  }
}

const summaryUrl = new URL('data/5986-ldd-summary.json', root);
if (fs.existsSync(summaryUrl)) {
  const summary = JSON.parse(fs.readFileSync(summaryUrl, 'utf8'));
  if (summary.exactAuthority !== false) errors.push('persisted LDD summary must declare exactAuthority=false');
  if ((summary.recordsWithTransforms ?? 0) < 1) errors.push('persisted LDD summary has no parsed transforms');
  if (summary.inventoryRegularPartTarget !== 420) errors.push(`persisted LDD summary target must be 420, got ${summary.inventoryRegularPartTarget}`);
  if (!String(summary.retainedData ?? '').includes('summary counts only')) errors.push('persisted LDD data must be summary counts only');
}

if (errors.length) {
  console.error('5986 source-integrity validation failed:\n' + errors.join('\n'));
  process.exit(1);
}
console.log(`5986 source integrity OK: ${parts.length - excludedIds.size} ledger-positioned parts, ${excludedIds.size} visual placeholders excluded; manual provenance gates exact transforms and CAD remains cross-check only.`);
