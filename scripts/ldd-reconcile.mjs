import fs from 'node:fs';

const candidatePath = process.argv[2] ?? 'data/5986-ldd-candidates.json';
const outArg = process.argv.indexOf('--out');
const outPath = outArg >= 0 ? process.argv[outArg + 1] : null;
const root = new URL('../', import.meta.url);

const manifest = JSON.parse(fs.readFileSync(new URL('data/5986-model.json', root), 'utf8'));
const modelParts = (manifest.partFiles ?? []).flatMap(rel => JSON.parse(fs.readFileSync(new URL(`data/${rel.replace('./', '')}`, root), 'utf8')));
const candidates = JSON.parse(fs.readFileSync(candidatePath, 'utf8')).parts ?? [];

const baseDesign = value => String(value ?? '').replace(/(?:px|pb|pr).*$/i, '').replace(/c\d+$/i, '').replace(/[^0-9A-Za-z]/g, '');
const key = (design, color) => `${baseDesign(design)}|${color ?? ''}`;
const median = values => {
  if (!values.length) return 0;
  const v = [...values].sort((a,b)=>a-b);
  const m = Math.floor(v.length/2);
  return v.length % 2 ? v[m] : (v[m-1] + v[m]) / 2;
};
const dist = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);

const currentByKey = new Map();
for (const part of modelParts) {
  const k = key(part.partNo, part.color);
  if (!currentByKey.has(k)) currentByKey.set(k, []);
  currentByKey.get(k).push(part);
}
const cadByKey = new Map();
for (const part of candidates) {
  if (!part.transform || !part.materialName || !part.normalizedDesign) continue;
  const k = key(part.normalizedDesign, part.materialName);
  if (!cadByKey.has(k)) cadByKey.set(k, []);
  cadByKey.get(k).push(part);
}

const anchors = [];
for (const [k, current] of currentByKey) {
  const cad = cadByKey.get(k) ?? [];
  if (current.length === 1 && cad.length === 1) anchors.push({ key:k, current:current[0], cad:cad[0] });
}

const orientations = [];
for (const swap of [false,true]) for (const sx of [-1,1]) for (const sz of [-1,1]) {
  orientations.push({ swap, sx, sz });
}
const orient = (p, o) => o.swap ? [o.sx*p[2], p[1], o.sz*p[0]] : [o.sx*p[0], p[1], o.sz*p[2]];

let best = null;
for (const o of orientations) {
  const deltas = anchors.map(({current,cad}) => {
    const p = orient(cad.transform.translationStud, o);
    return [current.position[0]-p[0], current.position[1]-p[1], current.position[2]-p[2]];
  });
  const translation = [0,1,2].map(i => median(deltas.map(d=>d[i])));
  const residuals = anchors.map(({current,cad}) => {
    const p = orient(cad.transform.translationStud, o).map((v,i)=>v+translation[i]);
    return dist(current.position,p);
  });
  const score = median(residuals);
  if (!best || score < best.score) best = { ...o, translation, score, anchorCount: anchors.length };
}

const mappedPos = cad => orient(cad.transform.translationStud, best).map((v,i)=>v+best.translation[i]);
const matches = [];
for (const [k,current] of currentByKey) {
  const cad = [...(cadByKey.get(k) ?? [])];
  const remaining = new Set(cad.map((_,i)=>i));
  const pairs = [];
  const options = [];
  for (let ci=0; ci<current.length; ci++) for (let di=0; di<cad.length; di++) {
    options.push({ci,di,d:dist(current[ci].position,mappedPos(cad[di]))});
  }
  options.sort((a,b)=>a.d-b.d);
  const usedCurrent = new Set();
  for (const option of options) {
    if (usedCurrent.has(option.ci) || !remaining.has(option.di)) continue;
    usedCurrent.add(option.ci); remaining.delete(option.di);
    pairs.push(option);
  }
  for (const pair of pairs) {
    const m = current[pair.ci], c = cad[pair.di];
    matches.push({
      modelPartId: m.id,
      assembly: m.assembly ?? null,
      partNo: m.partNo,
      color: m.color,
      verification: m.verification ?? null,
      lddRef: c.lddRef,
      lddDesignID: c.designID,
      residualStuds: Number(pair.d.toFixed(3)),
      alignedCandidatePosition: mappedPos(c).map(v=>Number(v.toFixed(4))),
      rawCandidateTranslationStud: c.transform.translationStud.map(v=>Number(v.toFixed(4))),
      rawCandidateMatrix3: c.transform.matrix3.map(v=>Number(v.toFixed(6))),
    });
  }
}

matches.sort((a,b)=>a.residualStuds-b.residualStuds);
const summary = {
  source: 'temporary LDD candidate artifact reconciled to the current model',
  exactAuthority: false,
  currentPositionedParts: modelParts.length,
  cadCandidateRecords: candidates.length,
  uniqueAnchorPairs: anchors.length,
  fit: best,
  matchedCurrentParts: matches.length,
  within1Stud: matches.filter(m=>m.residualStuds<=1).length,
  within2Studs: matches.filter(m=>m.residualStuds<=2).length,
  within4Studs: matches.filter(m=>m.residualStuds<=4).length,
  templeMatches: matches.filter(m=>m.assembly==='main-temple').length,
  policy: 'These are non-authoritative geometry candidates. A match cannot become instruction-exact without captured manual-page provenance and an explicit instructionTransform.',
};
const output = { summary, matches };
if (outPath) fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
