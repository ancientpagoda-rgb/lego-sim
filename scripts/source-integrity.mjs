import fs from 'node:fs';
const root = new URL('../', import.meta.url);
const sources = JSON.parse(fs.readFileSync(new URL('data/5986-instruction-sources.json', root), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(new URL('data/5986-model.json', root), 'utf8'));
const parts = (manifest.partFiles ?? []).flatMap(rel => JSON.parse(fs.readFileSync(new URL(`data/${rel.replace('./', '')}`, root), 'utf8')));
const errors = [];
if (!sources.geometryCrosscheck?.file) errors.push('missing geometryCrosscheck.file');
if (sources.geometryCrosscheck?.policy?.toLowerCase().includes('never counts') !== true) errors.push('geometry cross-check policy must explicitly prevent automatic exact promotion');
for (const part of parts) {
  const verification = String(part.verification ?? '');
  if (/^(?:ldd|digital-model)/i.test(verification)) errors.push(`${part.id}: digital-model provenance cannot be used as an exact verification prefix`);
  if (/^(?:manual|instruction)-page-/i.test(verification) && !part.instructionTransform) errors.push(`${part.id}: instruction-exact part missing instructionTransform`);
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
console.log(`5986 source integrity OK: ${parts.length} positioned parts; digital-model data is cross-check only.`);
