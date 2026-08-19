import fs from 'node:fs';

const candidatePath = process.argv[2] ?? 'data/5986-ldd-candidates.json';
const outArg = process.argv.indexOf('--out');
const outPath = outArg >= 0 ? process.argv[outArg + 1] : null;
const root = new URL('../', import.meta.url);
const inventoryText = fs.readFileSync(new URL('data/5986-inventory.csv', root), 'utf8').trim();
const candidates = JSON.parse(fs.readFileSync(candidatePath, 'utf8')).parts ?? [];

const baseDesign = value => String(value ?? '').replace(/(?:px|pb|pr).*$/i, '').replace(/c\d+$/i, '').replace(/[^0-9A-Za-z]/g, '');
const rows = inventoryText.split(/\r?\n/).slice(1).map(line => {
  const [partNo,color,qty] = line.split(',');
  return {partNo,color,qty:Number(qty),baseDesign:baseDesign(partNo)};
});
const key = (design,color) => `${baseDesign(design)}|${color ?? ''}`;
const byKey = new Map();
for (const c of candidates) {
  if (!c.transform || !c.materialName || !c.normalizedDesign) continue;
  const k = key(c.normalizedDesign,c.materialName);
  if (!byKey.has(k)) byKey.set(k,[]);
  byKey.get(k).push(c);
}

const probeDesigns = ['30104'];
const diagnostics = Object.fromEntries(probeDesigns.map(design => [design, candidates
  .filter(c => c.normalizedDesign === design)
  .map(c => ({
    lddRef:c.lddRef,
    lddDesignID:c.designID,
    materialId:c.materialId,
    materialName:c.materialName,
    translationStud:c.transform?.translationStud ?? null,
    matrix3:c.transform?.matrix3 ?? null,
  }))]));

const unique = [];
for (const row of rows) {
  if (row.qty !== 1) continue;
  const matches = byKey.get(key(row.partNo,row.color)) ?? [];
  if (matches.length !== 1) continue;
  const c = matches[0];
  unique.push({
    inventoryPartNo: row.partNo,
    inventoryColor: row.color,
    lddRef: c.lddRef,
    lddDesignID: c.designID,
    materialId: c.materialId,
    translationStud: c.transform.translationStud,
    matrix3: c.transform.matrix3,
  });
}
unique.sort((a,b)=>a.inventoryPartNo.localeCompare(b.inventoryPartNo));
const output = {
  exactAuthority: false,
  policy: 'Unique one-to-one CAD candidates are geometry anchors only; manual-page corroboration is still required for exact promotion.',
  diagnostics,
  count: unique.length,
  candidates: unique,
};
if (outPath) fs.writeFileSync(outPath, JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({uniqueOneToOneCandidates:unique.length, diagnostics:Object.fromEntries(Object.entries(diagnostics).map(([k,v])=>[k,v.length]))},null,2));
