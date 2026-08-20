const exactEl = document.querySelector('#exact');
const positionedEl = document.querySelector('#positioned');
const cadEl = document.querySelector('#cad');
const reconstructedEl = document.querySelector('#reconstructed');
const unpositionedEl = document.querySelector('#unpositioned');
const exactBar = document.querySelector('#exactBar');
const positionedBar = document.querySelector('#positionedBar');
const cadBar = document.querySelector('#cadBar');
const subtitle = document.querySelector('#subtitle');
const missingEl = document.querySelector('#missing');
const validationEl = document.querySelector('#validation');
const sourcesEl = document.querySelector('#sources');
const pagesEl = document.querySelector('#pages');
const pageGridEl = document.querySelector('#pageGrid');
const cadDetailsEl = document.querySelector('#cadDetails');
const solverDetailsEl = document.querySelector('#solverDetails');
const solverGridEl = document.querySelector('#solverGrid');

const key = (partNo, color) => `${partNo}|${color}`;
const instructionPage = verification => {
  const match = String(verification ?? '').match(/^(?:manual|instruction)-page-(\d+)/i);
  return match ? Number(match[1]) : null;
};

async function loadJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

async function loadOptionalJSON(url) {
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

function solverStat(value, label) {
  const cell = document.createElement('div');
  cell.className = 'solver-stat';
  const number = document.createElement('strong');
  number.textContent = value ?? '—';
  const caption = document.createElement('span');
  caption.textContent = label;
  cell.append(number, caption);
  return cell;
}

async function boot() {
  const [manifest, sourceIndex, inventoryText, cadSummary, exclusions, solver, structure] = await Promise.all([
    loadJSON('./data/5986-model.json'),
    loadJSON('./data/5986-instruction-sources.json'),
    fetch('./data/5986-inventory.csv').then(r => { if (!r.ok) throw new Error(`inventory: ${r.status}`); return r.text(); }),
    loadOptionalJSON('./data/5986-ldd-summary.json'),
    loadOptionalJSON('./data/5986-ledger-exclusions.json'),
    loadOptionalJSON('./data/5986-full-set-solver.json'),
    loadOptionalJSON('./data/5986-ldd-structure-summary.json'),
  ]);

  const renderedParts = (await Promise.all((manifest.partFiles ?? []).map(path => loadJSON(`./data/${path.replace('./', '')}`)))).flat();
  const excludedIds = new Set((exclusions?.items ?? []).map(item => item.id));
  const parts = renderedParts.filter(part => !excludedIds.has(part.id));
  const inventory = inventoryText.trim().split(/\r?\n/).slice(1).map(line => {
    const [partNo, color, qty] = line.split(',');
    return { partNo, color, qty: Number(qty) };
  });

  const available = new Map(inventory.map(row => [key(row.partNo, row.color), row.qty]));
  const used = new Map();
  const exactPages = new Map();
  let exact = 0;
  for (const part of parts) {
    const k = key(part.partNo, part.color);
    used.set(k, (used.get(k) ?? 0) + 1);
    const page = instructionPage(part.verification);
    if (page != null) {
      exact += 1;
      exactPages.set(page, (exactPages.get(page) ?? 0) + 1);
    }
  }

  const total = [...available.values()].reduce((a, b) => a + b, 0);
  const positioned = parts.length;
  const reconstructed = positioned - exact;
  const unpositioned = total - positioned;
  const cadMatched = cadSummary?.inventoryUnitsRepresented ?? 0;
  const visualPlaceholders = renderedParts.length - positioned;

  exactEl.textContent = exact;
  positionedEl.textContent = positioned;
  cadEl.textContent = cadSummary ? cadMatched : '—';
  reconstructedEl.textContent = reconstructed;
  unpositionedEl.textContent = unpositioned;
  exactBar.style.width = `${exact / total * 100}%`;
  positionedBar.style.width = `${positioned / total * 100}%`;
  cadBar.style.width = `${cadMatched / total * 100}%`;
  subtitle.textContent = `${exact} exact transforms locked · ${total - exact} exact transforms remaining · ${visualPlaceholders} visual-only placeholder${visualPlaceholders === 1 ? '' : 's'} · full-set solver ${solver ? 'audited' : 'audit pending'}`;

  if (cadSummary) {
    cadDetailsEl.textContent = `${cadMatched}/${total} inventory units reconcile by LDD design + mapped color; ${cadSummary.recordsWithTransforms}/${cadSummary.brickPartRecords} LDD records contain usable matrices across ${cadSummary.inventoryKeysRepresented} inventory part/color keys. This is candidate geometry only and contributes 0 parts to the instruction-exact total. ${visualPlaceholders} disproven presentation placeholder${visualPlaceholders === 1 ? ' is' : 's are'} rendered but excluded from inventory coverage.`;
  } else {
    cadDetailsEl.textContent = `No persisted LDD reconciliation summary yet. CAD geometry never increases the instruction-exact total by itself. ${visualPlaceholders} visual placeholder${visualPlaceholders === 1 ? ' is' : 's are'} excluded from the ledger.`;
  }

  solverGridEl.replaceChildren();
  if (solver) {
    solverDetailsEl.textContent = `The v0.6 solver expands the inventory to ${solver.targetSlots} deterministic slots and classifies all ${solver.remainingExactTransforms} non-exact occurrences in one pass. Geometry-ready does not mean exact: a manual page/step or visible-state provenance gate is still required before promotion.`;
    solverGridEl.append(
      solverStat(solver.geometryReadyButPageBlocked, 'geometry ready, manual blocked'),
      solverStat(solver.geometryReadyWithOccurrenceRef, 'occurrence-level CAD refs'),
      solverStat(solver.geometryAmbiguousOrOverflow, 'variant / CAD ambiguity'),
      solverStat(solver.geometryShortfallOrMissing, 'CAD shortfall / missing'),
    );
    if (structure) {
      const sequence = structure.hasPotentialBuildSequenceMetadata ? 'found potential build-sequence metadata' : 'found no usable build-sequence metadata';
      const grouping = structure.hasPotentialGroupingMetadata ? 'group metadata is present' : 'group metadata is absent';
      solverDetailsEl.textContent += ` LXF inspection ${sequence}; ${grouping}. Neither is instruction authority until reconciled to the manual.`;
    }
  } else {
    solverDetailsEl.textContent = `The v0.6 420-slot solver is installed, but its generated branch audit has not landed yet. Current exact coverage remains computed directly from the model; no CAD-only candidate is counted while the audit is absent.`;
    solverGridEl.append(
      solverStat(total - exact, 'remaining exact transforms'),
      solverStat(cadMatched, 'CAD-matched inventory units'),
      solverStat(sourceIndex.capturedPages.length, `captured manual pages / ${sourceIndex.manualPages}`),
      solverStat('0', 'unverified solver promotions'),
    );
  }

  const missing = [];
  for (const row of inventory) {
    const remain = row.qty - (used.get(key(row.partNo, row.color)) ?? 0);
    if (remain > 0) missing.push({ ...row, remain });
  }
  missing.sort((a, b) => b.remain - a.remain || a.partNo.localeCompare(b.partNo));
  missingEl.innerHTML = missing.map(row => `<div><strong>${row.remain}×</strong> ${row.partNo} · ${row.color}</div>`).join('');

  const addSource = (href, label) => {
    if (!href) return;
    const link = document.createElement('a');
    link.href = href; link.target = '_blank'; link.rel = 'noreferrer'; link.textContent = label;
    sourcesEl.append(link);
  };
  addSource(sourceIndex.official.productPage, 'Official LEGO manual');
  addSource(sourceIndex.official.pdf, 'Official PDF');
  addSource(sourceIndex.mirror.index, '44-page image mirror');
  addSource(sourceIndex.geometryCrosscheck?.forum, 'LDD cross-check notes');

  const capturedByPage = new Map(sourceIndex.capturedPages.map(row => [Number(row.page), row]));
  const lddRule = sourceIndex.geometryCrosscheck?.policy ? ' LDD matrices are candidate geometry only and cannot promote exact coverage by themselves.' : '';
  pagesEl.textContent = `${capturedByPage.size}/${sourceIndex.manualPages} manual pages inspected/indexed · ${exactPages.size} pages currently contribute exact transforms.${lddRule}`;

  pageGridEl.replaceChildren();
  for (let page = 1; page <= sourceIndex.manualPages; page += 1) {
    const captured = capturedByPage.get(page);
    const exactCount = exactPages.get(page) ?? 0;
    const cell = document.createElement('a');
    const imageUrl = captured?.image ?? sourceIndex.mirror.imageTemplate.replace('{NNN}', String(page).padStart(3, '0'));
    cell.className = `page-cell${captured ? ' captured' : ''}${exactCount ? ' exact' : ''}`;
    cell.href = imageUrl;
    cell.target = '_blank';
    cell.rel = 'noreferrer';
    cell.title = captured?.content ?? `Manual page ${page}: not yet inspected/indexed`;
    const number = document.createElement('span');
    number.className = 'page-no';
    number.textContent = String(page).padStart(2, '0');
    const count = document.createElement('span');
    count.className = 'page-count';
    count.textContent = exactCount ? `${exactCount} exact` : captured ? 'captured' : 'open page';
    cell.append(number, count);
    pageGridEl.append(cell);
  }

  const errors = [];
  if (total !== 420) errors.push(`Inventory expands to ${total}, expected 420 regular parts.`);
  for (const [k, qty] of used) if (qty > (available.get(k) ?? 0)) errors.push(`${k}: positioned ${qty}, inventory ${(available.get(k) ?? 0)}`);
  if (new Set(renderedParts.map(p => p.id)).size !== renderedParts.length) errors.push('Duplicate rendered part ids detected.');
  for (const item of exclusions?.items ?? []) {
    const part = renderedParts.find(candidate => candidate.id === item.id);
    if (!part) errors.push(`Ledger exclusion references missing visual part ${item.id}.`);
    if (!item.reason) errors.push(`Ledger exclusion ${item.id} has no reason.`);
    if (part && instructionPage(part.verification) != null) errors.push(`${item.id}: exact part cannot be excluded from inventory coverage.`);
  }
  const captured = new Set(sourceIndex.capturedPages.map(row => Number(row.page)));
  for (const part of parts) {
    const page = instructionPage(part.verification);
    if (page != null && !captured.has(page)) errors.push(`${part.id}: exact transform references uncaptured manual page ${page}`);
    if (page != null && !part.instructionTransform) errors.push(`${part.id}: exact transform missing local instructionTransform data`);
    if (page != null && part.instructionTransform?.page != null && Number(part.instructionTransform.page) !== page) errors.push(`${part.id}: instructionTransform page mismatch`);
    if (/^(?:ldd|digital-model)/i.test(String(part.verification ?? ''))) errors.push(`${part.id}: CAD-only verification cannot count as exact`);
  }
  if (cadSummary && cadSummary.exactAuthority !== false) errors.push('LDD summary must remain non-authoritative.');
  if (cadSummary && cadSummary.inventoryRegularPartTarget !== total) errors.push(`LDD summary target mismatch: ${cadSummary.inventoryRegularPartTarget}/${total}.`);
  if (cadSummary && cadSummary.recordsWithTransforms < 1) errors.push('LDD cross-check contains no usable transforms.');
  if (solver) {
    if (solver.exactAuthority !== false) errors.push('Full-set solver must remain non-authoritative.');
    if (solver.targetSlots !== total || solver.slots?.length !== total) errors.push(`Full-set solver target mismatch: ${solver.targetSlots}/${solver.slots?.length}/${total}.`);
    if (solver.currentInstructionExact !== exact) errors.push(`Full-set solver exact count mismatch: ${solver.currentInstructionExact}/${exact}.`);
    if (solver.remainingExactTransforms !== total - exact) errors.push(`Full-set solver remaining mismatch: ${solver.remainingExactTransforms}/${total - exact}.`);
  }
  if (structure && structure.exactAuthority !== false) errors.push('LDD structure inspection must remain non-authoritative.');

  validationEl.className = errors.length ? 'error' : 'ok';
  validationEl.textContent = errors.length ? errors.join(' · ') : `Ledger consistent: ${total} inventory slots, ${positioned} ledger-positioned instances, ${exactPages.size} exact-source pages, ${cadMatched} CAD-matched inventory candidates, ${visualPlaceholders} visual placeholders excluded, explicit local transforms on every exact part, no part/color overuse${solver ? ', full-set solver audit aligned' : ', full-set solver audit pending'}.`;
}

boot().catch(error => {
  console.error(error);
  subtitle.textContent = 'Coverage load failed';
  validationEl.className = 'error';
  validationEl.textContent = error.message;
});
