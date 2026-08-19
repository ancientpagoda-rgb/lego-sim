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

const key = (partNo, color) => `${partNo}|${color}`;

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
  let exact = 0;
  for (const part of parts) {
    const k = key(part.partNo, part.color);
    used.set(k, (used.get(k) ?? 0) + 1);
    if (/^(manual|instruction)-page-\d+/i.test(String(part.verification ?? ''))) exact += 1;
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
  subtitle.textContent = `${exact} exact transforms locked · ${total - exact} exact transforms remaining`;

  const missing = [];
  for (const row of inventory) {
    const remain = row.qty - (used.get(key(row.partNo, row.color)) ?? 0);
    if (remain > 0) missing.push({ ...row, remain });
  }
  missing.sort((a, b) => b.remain - a.remain || a.partNo.localeCompare(b.partNo));
  missingEl.innerHTML = missing.map(row => `<div><strong>${row.remain}×</strong> ${row.partNo} · ${row.color}</div>`).join('');

  const official = document.createElement('a');
  official.href = sourceIndex.official.productPage; official.target = '_blank'; official.rel = 'noreferrer'; official.textContent = 'Official LEGO manual';
  const pdf = document.createElement('a');
  pdf.href = sourceIndex.official.pdf; pdf.target = '_blank'; pdf.rel = 'noreferrer'; pdf.textContent = 'Official PDF';
  const mirror = document.createElement('a');
  mirror.href = sourceIndex.mirror.index; mirror.target = '_blank'; mirror.rel = 'noreferrer'; mirror.textContent = '44-page image mirror';
  sourcesEl.append(official, pdf, mirror);
  pagesEl.textContent = `${sourceIndex.capturedPages.length} manual pages have already been captured into the provenance index; exact transforms currently come from instruction-tagged placements in the model chunks.`;

  const errors = [];
  if (total !== 420) errors.push(`Inventory expands to ${total}, expected 420 regular parts.`);
  for (const [k, qty] of used) if (qty > (available.get(k) ?? 0)) errors.push(`${k}: positioned ${qty}, inventory ${(available.get(k) ?? 0)}`);
  if (new Set(parts.map(p => p.id)).size !== parts.length) errors.push('Duplicate positioned part ids detected.');
  validationEl.className = errors.length ? 'error' : 'ok';
  validationEl.textContent = errors.length ? errors.join(' · ') : `Ledger consistent: ${total} inventory slots, ${positioned} positioned instances, no part/color overuse.`;
}

boot().catch(error => {
  console.error(error);
  subtitle.textContent = 'Coverage load failed';
  validationEl.className = 'error';
  validationEl.textContent = error.message;
});
