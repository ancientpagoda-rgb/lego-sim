import fs from 'node:fs';

const input = process.argv[2] ?? 'data/5986-ldd-candidates.json';
const outIndex = process.argv.indexOf('--out');
const output = outIndex >= 0 ? process.argv[outIndex + 1] : 'data/5986-upper-temple-candidates.json';
const root = new URL('../', import.meta.url);
const data = JSON.parse(fs.readFileSync(input, 'utf8'));
const inventoryText = fs.readFileSync(new URL('data/5986-inventory.csv', root), 'utf8').trim();

const baseDesign = value => String(value ?? '').match(/^\d+/)?.[0] ?? String(value ?? '');
const capacity = new Set(inventoryText.split(/\r?\n/).slice(1).map(line => {
  const [partNo, color] = line.split(',');
  return `${baseDesign(partNo)}|${color}`;
}));

const region = {
  xMin: 12,
  xMax: 26,
  yMin: 12,
  yMax: 36,
  zMin: -14,
  zMax: 10,
};

const inRegion = ([x, y, z]) => x >= region.xMin && x <= region.xMax && y >= region.yMin && y <= region.yMax && z >= region.zMin && z <= region.zMax;
const candidates = (data.parts ?? [])
  .filter(part => part.transform && part.materialName && capacity.has(`${part.normalizedDesign}|${part.materialName}`) && inRegion(part.transform.translationStud))
  .map(part => ({
    partNo: part.normalizedDesign,
    color: part.materialName,
    lddRef: part.lddRef,
    lddDesignID: part.designID,
    materialId: part.materialId,
    position: part.transform.translationStud,
    rotationMatrix3: part.transform.matrix3,
  }))
  .sort((a, b) => b.position[1] - a.position[1] || a.partNo.localeCompare(b.partNo));

const result = {
  exactAuthority: false,
  region,
  policy: 'Spatial CAD candidates for upper-temple identification only. Manual-page evidence and inventory occurrence reconciliation are required before exact promotion.',
  count: candidates.length,
  candidates,
};
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ upperTempleCandidates: candidates.length, region }, null, 2));
