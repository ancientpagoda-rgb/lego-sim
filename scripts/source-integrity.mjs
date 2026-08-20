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
const isExact = part => /^(?:manual|instruction)-page-\d+/i.test(String(part?.verification ?? ''));
const exactPage = part => Number(String(part?.verification ?? '').match(/^(?:manual|instruction)-page-(\d+)/i)?.[1] ?? NaN);

if (!sources.geometryCrosscheck?.file) errors.push('missing geometryCrosscheck.file');
if (sources.geometryCrosscheck?.policy?.toLowerCase().includes('never counts') !== true) errors.push('geometry cross-check policy must explicitly prevent automatic exact promotion');

for (const item of exclusions.items ?? []) {
  const part = partById.get(item.id);
  if (!part) errors.push(`ledger exclusion references missing visual part: ${item.id}`);
  if (!item.reason) errors.push(`ledger exclusion missing reason: ${item.id}`);
  if (part && isExact(part)) errors.push(`${item.id}: instruction-exact part cannot be excluded from the 420-part ledger`);
}

const exactRefOwners = new Map();
for (const part of parts) {
  const verification = String(part.verification ?? '');
  const exact = isExact(part);
  if (/^(?:ldd|digital-model)/i.test(verification)) errors.push(`${part.id}: digital-model provenance cannot be used as an exact verification prefix`);
  if (exact && !part.instructionTransform) errors.push(`${part.id}: instruction-exact part missing instructionTransform`);

  if (exact && part.instructionTransform?.parent === 'ldd-set-origin') {
    if (!finiteVector(part.instructionTransform.position, 3)) errors.push(`${part.id}: LDD-backed exact transform needs a finite position[3]`);
    if (!finiteVector(part.instructionTransform.rotationMatrix3, 9)) errors.push(`${part.id}: LDD-backed exact transform needs rotationMatrix3[9]`);
    if (!part.geometryCrosscheck?.lddRef) errors.push(`${part.id}: LDD-backed exact transform missing geometryCrosscheck.lddRef`);
    if (!part.geometryCrosscheck?.lddDesignID) errors.push(`${part.id}: LDD-backed exact transform missing geometryCrosscheck.lddDesignID`);
  }

  if (exact && part.geometryCrosscheck?.lddRef) {
    const ref = String(part.geometryCrosscheck.lddRef);
    const previous = exactRefOwners.get(ref);
    if (previous && previous.id !== part.id) errors.push(`LDD ref ${ref} is claimed by multiple exact parts: ${previous.id}, ${part.id}`);
    else exactRefOwners.set(ref, part);
  }
}

// Reconciliation is non-authoritative, but it can expose a contradiction: an LDD ref proposed
// for one exact part must not simultaneously reconcile to a different instruction-exact part.
const matchesUrl = new URL('data/5986-ldd-model-matches.json', root);
const reconciledExactClaims = new Map();
if (fs.existsSync(matchesUrl)) {
  const matches = JSON.parse(fs.readFileSync(matchesUrl, 'utf8'));
  for (const match of matches.matches ?? []) {
    const matchedPart = partById.get(match.modelPartId);
    if (!matchedPart || !isExact(matchedPart) || !match.lddRef) continue;
    const ref = String(match.lddRef);
    reconciledExactClaims.set(ref, matchedPart);
    const owner = exactRefOwners.get(ref);
    if (owner && owner.id !== matchedPart.id) errors.push(`LDD ref ${ref}: exact owner ${owner.id} conflicts with reconciled exact part ${matchedPart.id}`);
  }
}

const structuralUrl = new URL('data/5986-page24-structural-candidates.json', root);
if (fs.existsSync(structuralUrl)) {
  const structural = JSON.parse(fs.readFileSync(structuralUrl, 'utf8'));
  if (structural.exactAuthority !== false) errors.push('page-24 structural candidate file must remain non-authoritative');
  for (const candidate of structural.candidates ?? []) {
    const claim = reconciledExactClaims.get(String(candidate.lddRef));
    if (claim && exactPage(claim) !== 24) errors.push(`page-24 candidate LDD ref ${candidate.lddRef} conflicts with exact ${claim.id} on page ${exactPage(claim)}`);
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
console.log(`5986 source integrity OK: ${parts.length - excludedIds.size} ledger-positioned parts, ${excludedIds.size} visual placeholders excluded, ${exactRefOwners.size} unique exact LDD refs; manual provenance gates exact transforms and CAD remains cross-check only.`);
