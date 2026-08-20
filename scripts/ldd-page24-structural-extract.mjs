import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const input = process.argv[2] ?? 'data/5986-ldd-candidates.json';
const outIndex = process.argv.indexOf('--out');
const output = outIndex >= 0 ? process.argv[outIndex + 1] : 'data/5986-page24-structural-candidates.json';
const data = JSON.parse(fs.readFileSync(input, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(new URL('data/5986-model.json', root), 'utf8'));
const modelParts = (manifest.partFiles ?? []).flatMap(rel => JSON.parse(fs.readFileSync(new URL(`data/${rel.replace('./', '')}`, root), 'utf8')));

const wanted = new Set([
  '3036|Blue',
  '3039|Dark Gray',
  '3298|Red',
  '4589|Yellow',
  '4871|Dark Gray',
  '3308|Light Gray',
]);

const exactRefClaims = new Map();
for (const part of modelParts) {
  const verification = String(part.verification ?? '');
  const lddRef = part.geometryCrosscheck?.lddRef;
  if (!/^(?:manual|instruction)-page-\d+/i.test(verification) || !lddRef) continue;
  exactRefClaims.set(String(lddRef), {
    partId: part.id,
    assembly: part.assembly ?? null,
    verification,
  });
}

const inUpperCrown = ([x, y, z]) => x >= 17 && x <= 24 && y >= 24 && y <= 31 && z >= -9 && z <= 2;
const discovered = (data.parts ?? [])
  .filter(part => part.transform && part.materialName && wanted.has(`${part.normalizedDesign}|${part.materialName}`) && inUpperCrown(part.transform.translationStud))
  .map(part => ({
    partNo: part.normalizedDesign,
    color: part.materialName,
    lddRef: String(part.lddRef),
    lddDesignID: part.designID,
    materialId: part.materialId,
    position: part.transform.translationStud,
    rotationMatrix3: part.transform.matrix3,
  }))
  .sort((a, b) => b.position[1] - a.position[1] || a.partNo.localeCompare(b.partNo) || a.lddRef.localeCompare(b.lddRef));

const candidates = [];
const rejected = [];
for (const candidate of discovered) {
  const claim = exactRefClaims.get(candidate.lddRef);
  if (claim && !/^instruction-page-24/i.test(claim.verification) && !/^manual-page-24/i.test(claim.verification)) {
    rejected.push({
      ...candidate,
      reason: 'LDD ref is already claimed by an instruction-exact part from another manual page; raw CAD region cannot override established provenance.',
      claimedBy: claim,
    });
    continue;
  }
  candidates.push(candidate);
}

const countFor = (list, target) => list.filter(c => `${c.partNo}|${c.color}` === target).length;
const result = {
  manualPage: 24,
  exactAuthority: false,
  region: { xMin: 17, xMax: 24, yMin: 24, yMax: 31, zMin: -9, zMax: 2 },
  policy: 'Raw CAD coordinates are discovery hints only. Exact promotion requires visible page-24 instruction evidence, inventory occurrence reconciliation, and no conflicting instruction-exact claim on the same LDD ref.',
  counts: Object.fromEntries([...wanted].sort().map(target => [target, countFor(candidates, target)])),
  rejectedCounts: Object.fromEntries([...wanted].sort().map(target => [target, countFor(rejected, target)])),
  candidates,
  rejected,
};

fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ manualPage: 24, candidateCount: candidates.length, rejectedCount: rejected.length, counts: result.counts, rejectedCounts: result.rejectedCounts }, null, 2));
