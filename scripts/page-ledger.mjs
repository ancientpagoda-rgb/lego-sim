import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const sources = JSON.parse(fs.readFileSync(new URL('data/5986-instruction-sources.json', root), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(new URL('data/5986-model.json', root), 'utf8'));
const parts = (manifest.partFiles ?? []).flatMap(rel => JSON.parse(fs.readFileSync(new URL(`data/${rel.replace('./', '')}`, root), 'utf8')));

const captured = new Map((sources.capturedPages ?? []).map(row => [Number(row.page), row]));
const rows = Array.from({ length: sources.manualPages }, (_, index) => ({
  page: index + 1,
  captured: captured.has(index + 1),
  description: captured.get(index + 1)?.content ?? null,
  exactPartIds: [],
  exactPartCount: 0,
  status: captured.has(index + 1) ? 'captured-pending' : 'unresolved',
}));

const errors = [];
const pageFromVerification = verification => {
  const match = String(verification ?? '').match(/^(?:manual|instruction)-page-(\d+)/i);
  return match ? Number(match[1]) : null;
};

for (const part of parts) {
  const page = pageFromVerification(part.verification);
  if (page == null) continue;
  if (page < 1 || page > sources.manualPages) {
    errors.push(`${part.id}: instruction page ${page} outside 1-${sources.manualPages}`);
    continue;
  }
  if (!captured.has(page)) errors.push(`${part.id}: exact tag references uncaptured instruction page ${page}`);
  const transformPage = part.instructionTransform?.page;
  if (transformPage != null && Number(transformPage) !== page) {
    errors.push(`${part.id}: verification page ${page} disagrees with instructionTransform.page ${transformPage}`);
  }
  rows[page - 1].exactPartIds.push(part.id);
}

for (const row of rows) {
  row.exactPartCount = row.exactPartIds.length;
  if (row.exactPartCount > 0) row.status = 'exact-in-use';
}

const summary = {
  totalPages: sources.manualPages,
  capturedPages: rows.filter(row => row.captured).length,
  pagesWithExactTransforms: rows.filter(row => row.exactPartCount > 0).length,
  exactParts: rows.reduce((sum, row) => sum + row.exactPartCount, 0),
  unresolvedPages: rows.filter(row => !row.captured).length,
};

const ledger = {
  set: sources.set,
  policy: 'A model part cannot count as instruction-exact unless its referenced manual page is present in capturedPages.',
  geometryCrosscheck: sources.geometryCrosscheck ?? null,
  summary,
  pages: rows,
};

if (process.argv.includes('--write')) {
  fs.writeFileSync(new URL('data/5986-page-ledger.json', root), JSON.stringify(ledger, null, 2) + '\n');
}

if (errors.length) {
  console.error('5986 page-ledger validation failed:\n' + errors.join('\n'));
  process.exit(1);
}

console.log(`5986 page ledger OK: ${summary.capturedPages}/${summary.totalPages} pages captured, ${summary.pagesWithExactTransforms} pages supply ${summary.exactParts} exact parts.`);
