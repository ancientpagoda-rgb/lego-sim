import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const input = process.argv[2];
if (!input) {
  console.error('Usage: node scripts/ldd-import.mjs <5986.lxf|IMAGE100.LXFML> [--write] [--summary-out path]');
  process.exit(2);
}

const STUD_CM = 0.8;
const root = new URL('../', import.meta.url);
const inventoryText = fs.readFileSync(new URL('data/5986-inventory.csv', root), 'utf8').trim();
const inventory = inventoryText.split(/\r?\n/).slice(1).map(line => {
  const [partNo, color, qty] = line.split(',');
  return { partNo, color, qty: Number(qty) };
});

function baseDesign(value = '') {
  const text = String(value).trim();
  return text.match(/^\d+/)?.[0] ?? text.replace(/(?:px|pb|pr).*$/i, '');
}

const inventoryCapacity = new Map();
const inventoryDesignCapacity = new Map();
for (const row of inventory) {
  const design = baseDesign(row.partNo);
  inventoryCapacity.set(`${design}|${row.color}`, (inventoryCapacity.get(`${design}|${row.color}`) ?? 0) + row.qty);
  inventoryDesignCapacity.set(design, (inventoryDesignCapacity.get(design) ?? 0) + row.qty);
}
const availableDesigns = new Set(inventoryDesignCapacity.keys());

function readLxfml(file) {
  if (/\.lxfml$/i.test(file)) return fs.readFileSync(file, 'utf8');
  const result = spawnSync('unzip', ['-p', file, 'IMAGE100.LXFML'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0 || !result.stdout) {
    console.error(result.stderr || 'Unable to extract IMAGE100.LXFML; install unzip or pass an .lxfml file directly.');
    process.exit(2);
  }
  return result.stdout;
}

function attrs(tag) {
  return Object.fromEntries([...tag.matchAll(/([A-Za-z_:][\w:.-]*)="([^"]*)"/g)].map(m => [m[1], m[2]]));
}

function firstMaterial(value = '') {
  return String(value).split(',')[0] || null;
}

const materialNames = new Map([
  ['1', 'White'], ['5', 'Tan'], ['21', 'Red'], ['23', 'Blue'], ['24', 'Yellow'], ['26', 'Black'],
  ['28', 'Green'], ['37', 'Green'], ['40', 'Trans-Clear'], ['41', 'Trans-Red'], ['44', 'Trans-Yellow'],
  ['47', 'Trans-Neon Orange'], ['106', 'Trans-Neon Orange'], ['194', 'Light Gray'], ['199', 'Dark Gray'],
  ['192', 'Brown'], ['308', 'Brown'],
]);

function parseTransform(raw = '') {
  const n = String(raw).split(',').map(Number);
  if (n.length !== 12 || n.some(v => !Number.isFinite(v))) return null;
  return {
    matrix3: n.slice(0, 9),
    translationCm: n.slice(9, 12),
    translationStud: n.slice(9, 12).map(v => v / STUD_CM),
  };
}

const xml = readLxfml(input);
const parts = [];
const brickBlocks = [...xml.matchAll(/<Brick\b[^>]*>[\s\S]*?<\/Brick>/g)];
for (const brickMatch of brickBlocks) {
  const block = brickMatch[0];
  const brickTag = block.match(/<Brick\b[^>]*>/)?.[0] ?? '';
  const brickAttrs = attrs(brickTag);
  const partTags = [...block.matchAll(/<Part\b[^>]*>[\s\S]*?<\/Part>|<Part\b[^>]*\/>/g)];
  for (const partMatch of partTags) {
    const partBlock = partMatch[0];
    const partTag = partBlock.match(/<Part\b[^>]*>/)?.[0] ?? partBlock.match(/<Part\b[^>]*\/>/)?.[0] ?? '';
    const partAttrs = attrs(partTag);
    const boneTag = partBlock.match(/<Bone\b[^>]*>/)?.[0] ?? '';
    const boneAttrs = attrs(boneTag);
    const designID = partAttrs.designID || brickAttrs.designID || null;
    const materialId = firstMaterial(partAttrs.materials || brickAttrs.materials);
    const normalizedDesign = baseDesign(designID);
    const materialName = materialNames.get(materialId) ?? null;
    const transformationRaw = boneAttrs.transformation || partAttrs.transformation || brickAttrs.transformation || null;
    const transformSource = boneAttrs.transformation ? 'bone' : partAttrs.transformation ? 'part' : brickAttrs.transformation ? 'brick' : null;
    parts.push({
      lddRef: partAttrs.refID || brickAttrs.refID || null,
      designID,
      normalizedDesign,
      materialId,
      materialName,
      transform: parseTransform(transformationRaw),
      transformSource,
      boneTagFound: Boolean(boneTag),
      transformationAttributeFound: Boolean(transformationRaw),
      inventoryDesignCandidate: availableDesigns.has(normalizedDesign),
    });
  }
}

const lddKeyCounts = new Map();
for (const part of parts) {
  if (!part.materialName) continue;
  const key = `${part.normalizedDesign}|${part.materialName}`;
  lddKeyCounts.set(key, (lddKeyCounts.get(key) ?? 0) + 1);
}
let inventoryUnitsRepresented = 0;
let overflowAgainstInventory = 0;
let inventoryKeysRepresented = 0;
for (const [key, count] of lddKeyCounts) {
  const capacity = inventoryCapacity.get(key) ?? 0;
  if (capacity > 0) inventoryKeysRepresented += 1;
  inventoryUnitsRepresented += Math.min(count, capacity);
  overflowAgainstInventory += Math.max(0, count - capacity);
}

const unmatchedDesigns = [...new Set(parts.filter(p => !p.inventoryDesignCandidate && p.normalizedDesign).map(p => p.normalizedDesign))].sort();
const unknownMaterialIds = [...new Set(parts.filter(p => !p.materialName && p.materialId).map(p => p.materialId))].sort();
const transformSources = Object.fromEntries(['bone', 'part', 'brick'].map(source => [source, parts.filter(p => p.transformSource === source).length]));
const summary = {
  sourceFile: path.basename(input),
  sourceType: 'LEGO Digital Designer LXF cross-check',
  exactAuthority: false,
  brickPartRecords: parts.length,
  boneTagsFound: parts.filter(p => p.boneTagFound).length,
  transformationAttributesFound: parts.filter(p => p.transformationAttributeFound).length,
  recordsWithTransforms: parts.filter(p => p.transform).length,
  transformSources,
  recordsMatchingInventoryDesign: parts.filter(p => p.inventoryDesignCandidate).length,
  recordsWithKnownMaterial: parts.filter(p => p.materialName).length,
  inventoryUnitsRepresented,
  inventoryKeysRepresented,
  inventoryRegularPartTarget: inventory.reduce((sum, row) => sum + row.qty, 0),
  overflowAgainstInventory,
  unmatchedDesignCount: unmatchedDesigns.length,
  unmatchedDesigns: unmatchedDesigns.slice(0, 80),
  unknownMaterialIds,
  retainedData: 'summary counts only; the third-party LXF and its full transform matrix list are not committed by the cross-check workflow',
  policy: 'Imported LDD poses are geometry candidates only. They do not count as instruction-exact without a captured manual-page provenance tag.',
};

const out = { summary, parts };
if (process.argv.includes('--write')) {
  fs.writeFileSync(new URL('data/5986-ldd-candidates.json', root), JSON.stringify(out, null, 2) + '\n');
}
const summaryIndex = process.argv.indexOf('--summary-out');
if (summaryIndex >= 0) {
  const target = process.argv[summaryIndex + 1];
  if (!target) {
    console.error('--summary-out requires a repository-relative or absolute path');
    process.exit(2);
  }
  fs.writeFileSync(new URL(target, root), JSON.stringify(summary, null, 2) + '\n');
}
console.log(JSON.stringify(summary, null, 2));
