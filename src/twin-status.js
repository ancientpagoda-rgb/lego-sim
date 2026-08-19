const exactEl = document.querySelector('#exact');
const positionedEl = document.querySelector('#positioned');
const reconstructedEl = document.querySelector('#reconstructed');
const unpositionedEl = document.querySelector('#unpositioned');
const exactBar = document.querySelector('#exactBar');
const positionedBar = document.querySelector('#positionedBar');
const subtitle = document.querySelector('#subtitle');
const missingEl = document.querySelector('#missing');
const validationEl = document.querySelector('#validation');
const sourcesEl = document.querySelector('#sources');
const pagesEl = document.querySelector('#pages');
const pageGridEl = document.querySelector('#pageGrid');

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

async function boot() {
  const [manifest, sourceIndex, inventoryText] = await Promise.all([
    loadJSON('./data/5986-model.json'),
    loadJSON('./data/5986-instruction-sources.json'),
    fetch('./data/5986-inventory.csv').then(r => { if (!r.ok) throw new Error(`inventory: ${r.status}`); return r.text(); }),
  ]);

  const parts = (await Promise.all((manifest.partFiles ?? []).map(path => loadJSON(`./data/${path.replace('./', '')}`)))).flat();
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

  exactEl.textContent = exact;
  positionedEl.textContent = positioned;
  reconstructedEl.textContent = reconstructed;
  unpositionedEl.textContent = unpositioned;
  exactBar.style.width = `${exact / total * 100}%`;
  positionedBar.style.width = `${positioned / total * 100}%`;
  subtitle.textContent = `${exact} exact transforms locked · ${total - exact} exact transforms remaining · bulk solver ready`;

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
  addSource(sourceIndex.geometryCrosscheck?.file, 'LDD model file');

  const capturedByPage = new Map(sourceIndex.capturedPages.map(row => [Number(row.page), row]));
  const lddRule = sourceIndex.geometryCrosscheck?.policy ? ' LDD matrices are candidate geometry only and cannot promote exact coverage by themselves.' : '';
  pagesEl.textContent = `${capturedByPage.size}/${sourceIndex.manualPages} manual pages captured · ${exactPages.size} pages currently contribute exact transforms.${lddRule}`;

  pageGridEl.replaceChildren();
  for (let page = 1; page <= sourceIndex.manualPages; page += 1) {
    const captured = capturedByPage.get(page);
    const exactCount = exactPages.get(page) ?? 0;
    const cell = document.createElement(captured?.image ? 'a' : 'div');
    cell.className = `page-cell${captured ? ' captured' : ''}${exactCount ? ' exact' : ''}`;
    if (captured?.image) {
      cell.href = captured.image;
      cell.target = '_blank';
      cell.rel = 'noreferrer';
      cell.title = captured.content ?? `Manual page ${page}`;
    } else {
      cell.title = `Manual page ${page}: unresolved`;
    }
    const number = document.createElement('span');
    number.className = 'page-no';
    number.textContent = String(page).padStart(2, '0');
    const count = document.createElement('span');
    count.className = 'page-count';
    count.textContent = exactCount ? `${exactCount} exact` : captured ? 'captured' : '—';
    cell.append(number, count);
    pageGridEl.append(cell);
  }

  const errors = [];
  if (total !== 420) errors.push(`Inventory expands to ${total}, expected 420 regular parts.`);
  for (const [k, qty] of used) if (qty > (available.get(k) ?? 0)) errors.push(`${k}: positioned ${qty}, inventory ${(available.get(k) ?? 0)}`);
  if (new Set(parts.map(p => p.id)).size !== parts.length) errors.push('Duplicate positioned part ids detected.');
  const captured = new Set(sourceIndex.capturedPages.map(row => Number(row.page)));
  for (const part of parts) {
    const page = instructionPage(part.verification);
    if (page != null && !captured.has(page)) errors.push(`${part.id}: exact transform references uncaptured manual page ${page}`);
    if (page != null && !part.instructionTransform) errors.push(`${part.id}: exact transform missing local instructionTransform data`);
    if (page != null && part.instructionTransform?.page != null && Number(part.instructionTransform.page) !== page) {
      errors.push(`${part.id}: instructionTransform page mismatch`);
    }
    if (/^(?:ldd|digital-model)/i.test(String(part.verification ?? ''))) errors.push(`${part.id}: CAD-only verification cannot count as exact`);
  }
  validationEl.className = errors.length ? 'error' : 'ok';
  validationEl.textContent = errors.length ? errors.join(' · ') : `Ledger consistent: ${total} inventory slots, ${positioned} positioned instances, ${exactPages.size} exact-source pages, explicit local transforms on every exact part, no part/color overuse.`;
}

boot().catch(error => {
  console.error(error);
  subtitle.textContent = 'Coverage load failed';
  validationEl.className = 'error';
  validationEl.textContent = error.message;
});
