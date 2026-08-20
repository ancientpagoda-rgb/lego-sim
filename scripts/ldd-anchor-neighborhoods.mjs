import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const input = process.argv[2] ?? 'data/5986-ldd-candidates.json';
const outIndex = process.argv.indexOf('--out');
const output = outIndex >= 0 ? process.argv[outIndex + 1] : 'data/5986-anchor-neighborhoods.json';
const radiusArg = process.argv.indexOf('--radius');
const radius = radiusArg >= 0 ? Number(process.argv[radiusArg + 1]) : 4;
const DESIGN_ALIASES = new Map([['60169', '30104']]);

const baseDesign = value => {
  const text = String(value ?? '').trim();
  const raw = text.match(/^\d+/)?.[0] ?? text.replace(/(?:px|pb|pr).*$/i, '');
  return DESIGN_ALIASES.get(raw) ?? raw;
};
const pageOf = verification => Number(String(verification ?? '').match(/^(?:manual|instruction)-page-(\d+)/i)?.[1] ?? NaN);
const key = (design, color) => `${design}|${color}`;
const distance3 = (a, b) => Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]);
const relative3 = (a, b) => a.map((value, index) => Number((value - b[index]).toFixed(6)));

const manifest = JSON.parse(fs.readFileSync(new URL('data/5986-model.json', root), 'utf8'));
const inventoryText = fs.readFileSync(new URL('data/5986-inventory.csv', root), 'utf8').trim();
const candidateRoot = JSON.parse(fs.readFileSync(new URL(input, root), 'utf8'));
const inventoryKeys = new Set(inventoryText.split(/\r?\n/).slice(1).map(line => {
  const [partNo, color] = line.split(',');
  return key(baseDesign(partNo), color);
}));
const modelParts = (manifest.partFiles ?? []).flatMap(rel => JSON.parse(fs.readFileSync(new URL(`data/${rel.replace('./', '')}`, root), 'utf8')));
const exactParts = modelParts.filter(part => Number.isInteger(pageOf(part.verification)) && part.geometryCrosscheck?.lddRef);

const candidateByRef = new Map();
for (const part of candidateRoot.parts ?? []) {
  if (!part.transform || !part.lddRef) continue;
  candidateByRef.set(String(part.lddRef), part);
}
const exactRefs = new Set(exactParts.map(part => String(part.geometryCrosscheck.lddRef)));

const neighborhoods = [];
for (const anchor of exactParts) {
  const anchorRef = String(anchor.geometryCrosscheck.lddRef);
  const source = candidateByRef.get(anchorRef);
  if (!source?.transform?.translationStud) continue;
  const anchorPosition = source.transform.translationStud;
  const nearby = [];
  for (const candidate of candidateRoot.parts ?? []) {
    if (!candidate.transform?.translationStud || !candidate.lddRef || !candidate.materialName || !candidate.normalizedDesign) continue;
    const ref = String(candidate.lddRef);
    if (exactRefs.has(ref)) continue;
    if (!inventoryKeys.has(key(candidate.normalizedDesign, candidate.materialName))) continue;
    const dist = distance3(candidate.transform.translationStud, anchorPosition);
    if (dist > radius) continue;
    nearby.push({
      partNo: candidate.normalizedDesign,
      color: candidate.materialName,
      lddRef: ref,
      lddDesignID: candidate.designID,
      materialId: candidate.materialId,
      distanceStuds: Number(dist.toFixed(4)),
      relativePosition: relative3(candidate.transform.translationStud, anchorPosition),
      position: candidate.transform.translationStud,
      rotationMatrix3: candidate.transform.matrix3,
    });
  }
  nearby.sort((a, b) => a.distanceStuds - b.distanceStuds || a.partNo.localeCompare(b.partNo) || a.lddRef.localeCompare(b.lddRef, undefined, { numeric: true }));
  neighborhoods.push({
    manualPage: pageOf(anchor.verification),
    anchorPartId: anchor.id,
    anchorPartNo: anchor.partNo,
    anchorColor: anchor.color,
    anchorLddRef: anchorRef,
    anchorPosition,
    radiusStuds: radius,
    candidateCount: nearby.length,
    candidates: nearby,
  });
}

neighborhoods.sort((a, b) => a.manualPage - b.manualPage || a.anchorPartId.localeCompare(b.anchorPartId));
const pageSummary = {};
for (const row of neighborhoods) {
  const page = String(row.manualPage);
  const bucket = pageSummary[page] ?? { anchors: 0, nearbyCandidateRefs: new Set() };
  bucket.anchors += 1;
  for (const candidate of row.candidates) bucket.nearbyCandidateRefs.add(candidate.lddRef);
  pageSummary[page] = bucket;
}
for (const [page, bucket] of Object.entries(pageSummary)) {
  pageSummary[page] = { anchors: bucket.anchors, uniqueNearbyCandidateRefs: bucket.nearbyCandidateRefs.size };
}

const result = {
  exactAuthority: false,
  radiusStuds: radius,
  anchorCount: neighborhoods.length,
  policy: 'Neighborhoods are acceleration evidence only. A nearby candidate can become exact only when the cited captured manual visibly places it in the same mechanism/assembly, inventory occurrence identity is available, and the LDD ref has no other exact claim.',
  retainedData: 'small candidate neighborhoods around already exact CAD-backed anchors; not a complete third-party model dump',
  pageSummary,
  neighborhoods,
};
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ anchorCount: result.anchorCount, radiusStuds: radius, pageSummary }, null, 2));
