import fs from 'node:fs';

const input = process.argv[2] ?? 'data/5986-ldd-candidates.json';
const outIndex = process.argv.indexOf('--out');
const output = outIndex >= 0 ? process.argv[outIndex + 1] : 'data/5986-page24-structural-candidates.json';
const data = JSON.parse(fs.readFileSync(input, 'utf8'));

const wanted = new Set([
  '3036|Blue',
  '3039|Dark Gray',
  '3298|Red',
  '4589|Yellow',
  '4871|Dark Gray',
  '3308|Light Gray',
]);

const inUpperCrown = ([x, y, z]) => x >= 17 && x <= 24 && y >= 24 && y <= 31 && z >= -9 && z <= 2;
const candidates = (data.parts ?? [])
  .filter(part => part.transform && part.materialName && wanted.has(`${part.normalizedDesign}|${part.materialName}`) && inUpperCrown(part.transform.translationStud))
  .map(part => ({
    partNo: part.normalizedDesign,
    color: part.materialName,
    lddRef: part.lddRef,
    lddDesignID: part.designID,
    materialId: part.materialId,
    position: part.transform.translationStud,
    rotationMatrix3: part.transform.matrix3,
  }))
  .sort((a, b) => b.position[1] - a.position[1] || a.partNo.localeCompare(b.partNo) || String(a.lddRef).localeCompare(String(b.lddRef)));

const result = {
  manualPage: 24,
  exactAuthority: false,
  region: { xMin: 17, xMax: 24, yMin: 24, yMax: 31, zMin: -9, zMax: 2 },
  policy: 'Structural CAD candidates only. Exact promotion requires visible page-24 instruction evidence and inventory occurrence reconciliation.',
  counts: Object.fromEntries([...wanted].sort().map(target => [target, candidates.filter(c => `${c.partNo}|${c.color}` === target).length])),
  candidates,
};

fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ manualPage: 24, candidateCount: candidates.length, counts: result.counts }, null, 2));
