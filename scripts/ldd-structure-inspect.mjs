import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const input = process.argv[2];
const outIndex = process.argv.indexOf('--out');
const output = outIndex >= 0 ? process.argv[outIndex + 1] : 'data/5986-ldd-structure-summary.json';
if (!input) {
  console.error('Usage: node scripts/ldd-structure-inspect.mjs <5986.lxf|IMAGE100.LXFML> [--out path]');
  process.exit(2);
}

function readLxfml(file) {
  if (/\.lxfml$/i.test(file)) return fs.readFileSync(file, 'utf8');
  const result = spawnSync('unzip', ['-p', file, 'IMAGE100.LXFML'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0 || !result.stdout) {
    console.error(result.stderr || 'Unable to extract IMAGE100.LXFML');
    process.exit(2);
  }
  return result.stdout;
}

const xml = readLxfml(input);
const tagCounts = new Map();
for (const match of xml.matchAll(/<\/?([A-Za-z_][\w:.-]*)\b/g)) {
  const tag = match[1];
  tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
}

const interestingTagNames = [...tagCounts.keys()]
  .filter(name => /(step|instruction|group|assembly|sequence|building|model)/i.test(name))
  .sort();
const interestingTags = Object.fromEntries(interestingTagNames.map(name => [name, tagCounts.get(name)]));
const attributeNames = new Set();
for (const match of xml.matchAll(/\b([A-Za-z_][\w:.-]*)="[^"]*"/g)) attributeNames.add(match[1]);
const interestingAttributes = [...attributeNames]
  .filter(name => /(step|instruction|group|assembly|sequence|building|model|ref)/i.test(name))
  .sort();

const groupLikeBlocks = [...xml.matchAll(/<(Group|BrickGroup|GroupSystem|GroupSystems|BuildingInstruction|BuildingInstructions|Step|BuildingStep)\b[^>]*>/gi)]
  .slice(0, 200)
  .map(match => {
    const tag = match[1];
    const attrs = Object.fromEntries([...match[0].matchAll(/([A-Za-z_:][\w:.-]*)="([^"]*)"/g)].map(m => [m[1], m[2]]));
    return { tag, attrs };
  });

const summary = {
  sourceType: 'LEGO Digital Designer LXF structure metadata inspection',
  exactAuthority: false,
  xmlBytes: Buffer.byteLength(xml),
  coreTagCounts: Object.fromEntries(['LXFML','Bricks','Brick','Part','Bone','GroupSystems','GroupSystem','Group','BuildingInstructions','BuildingInstruction','Step','BuildingStep'].map(name => [name, tagCounts.get(name) ?? 0])),
  interestingTags,
  interestingAttributes,
  groupLikeTagSamples: groupLikeBlocks,
  hasPotentialBuildSequenceMetadata: interestingTagNames.some(name => /(step|instruction|sequence)/i.test(name)),
  hasPotentialGroupingMetadata: interestingTagNames.some(name => /group|assembly/i.test(name)),
  policy: 'Metadata discovery only. Group/step tags are not instruction provenance until independently reconciled with the 44-page manual.',
  retainedData: 'tag counts, attribute names and group-like tag attributes only; no third-party part transform matrices or LXF body are retained',
};
fs.writeFileSync(output, JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
