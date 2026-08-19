import fs from 'node:fs';

const input = process.argv[2] ?? 'data/5986-ldd-candidates.json';
const outIndex = process.argv.indexOf('--out');
const output = outIndex >= 0 ? process.argv[outIndex + 1] : 'data/5986-page24-candidates.json';
const data = JSON.parse(fs.readFileSync(input, 'utf8'));
const parts = data.parts ?? [];

const wanted = new Set([
  '6081|Light Gray',
  '3009|Blue',
  '6126|Trans-Neon Orange',
  '30103|Black',
  '30339|Green',
]);

const key = part => `${part.normalizedDesign}|${part.materialName}`;
const candidates = parts
  .filter(part => part.transform && wanted.has(key(part)))
  .map(part => ({
    partNo: part.normalizedDesign,
    color: part.materialName,
    lddRef: part.lddRef,
    lddDesignID: part.designID,
    materialId: part.materialId,
    position: part.transform.translationStud,
    rotationMatrix3: part.transform.matrix3,
  }))
  .sort((a, b) => a.partNo.localeCompare(b.partNo) || String(a.lddRef).localeCompare(String(b.lddRef)));

const counts = Object.fromEntries([...wanted].sort().map(target => [target, candidates.filter(c => `${c.partNo}|${c.color}` === target).length]));
const result = {
  manualPage: 24,
  exactAuthority: false,
  policy: 'Filtered CAD geometry candidates only. Promotion still requires visible page-24 instruction evidence plus inventory occurrence reconciliation.',
  counts,
  candidates,
};

fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ manualPage: 24, candidateCount: candidates.length, counts }, null, 2));
