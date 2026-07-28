import { VOCAB, GOLD_FIELDS, FIELD_HELP, LABEL_CONFIDENCE, VOCAB_VERSION } from '../attributes/vocabulary'
import type { BuiltRow } from './build'

/**
 * A self-contained HTML labelling sheet.
 *
 * BLIND ON PURPOSE. No model output appears anywhere in this file. Pre-filling
 * the fields with the extractor's guesses would make labelling perhaps three
 * times faster, and would also anchor the labels to the model — the resulting
 * "accuracy" would largely measure how often a human agreed with a suggestion
 * already on screen. The evaluation would flatter exactly the thing it exists
 * to test.
 *
 * Images are embedded as data URIs so the file works offline and, more
 * importantly, so the image being labelled is provably the one that was hashed.
 */
export function renderSheet(rows: BuiltRow[], setVersion: string): string {
  const options = (field: string) =>
    (VOCAB[field as keyof typeof VOCAB] ?? [])
      .map(v => `<option value="${v}">${v}</option>`).join('')

  const cards = rows.map((r, i) => `
<article class="card" data-design="${r.design_id}" data-sha="${r.image_sha256}">
  <div class="imgwrap">
    <img class="main" src="${r.images[0].data_uri}" alt="design ${i + 1}" loading="lazy">
  </div>
  ${r.images.length > 1 ? `<div class="thumbs">${r.images.map((im, k) =>
    `<img src="${im.data_uri}" data-full="${k}" class="${k === 0 ? 'sel' : ''}" alt="view ${k + 1}" loading="lazy">`
  ).join('')}</div>` : ''}
  <div class="meta">
    <span class="n">${i + 1}/${rows.length}</span>
    <span class="brand">${escapeHtml(r.brand_name)}</span>
    <span class="price">${r.price_local ? '₹' + Math.round(r.price_local).toLocaleString('en-IN') : '—'}</span>
  </div>
  <div class="fields">
    ${GOLD_FIELDS.map(f => `
    <label>
      <span>${f.replace(/_/g, ' ')}</span>
      <select data-field="${f}">
        <option value="">—</option>
        ${options(f)}
      </select>
    </label>`).join('')}
    <label>
      <span>how sure</span>
      <select data-field="label_confidence">
        <option value="">—</option>
        ${LABEL_CONFIDENCE.map(v => `<option value="${v}">${v}</option>`).join('')}
      </select>
    </label>
  </div>
</article>`).join('')

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DIP gold set — ${setVersion}</title>
<style>
  :root { color-scheme: light dark; --bg:#fff; --fg:#111; --line:#d8d8d8; --muted:#666; --accent:#0b6; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#0f1115; --fg:#e8e8e8; --line:#2a2e37; --muted:#9aa0aa; }
  }
  * { box-sizing: border-box; }
  body { margin:0; font:15px/1.45 system-ui,-apple-system,Segoe UI,sans-serif; background:var(--bg); color:var(--fg); }
  header { position:sticky; top:0; z-index:10; background:var(--bg); border-bottom:1px solid var(--line);
           padding:12px 20px; display:flex; gap:16px; align-items:center; flex-wrap:wrap; }
  h1 { font-size:16px; margin:0; font-weight:600; }
  .progress { color:var(--muted); font-variant-numeric:tabular-nums; }
  .progress strong { color:var(--accent); }
  button { font:inherit; padding:7px 14px; border-radius:7px; border:1px solid var(--line);
           background:var(--bg); color:var(--fg); cursor:pointer; }
  button.primary { background:var(--accent); border-color:var(--accent); color:#fff; font-weight:600; }
  button:disabled { opacity:.45; cursor:not-allowed; }
  details.help { padding:10px 20px; border-bottom:1px solid var(--line); color:var(--muted); font-size:13.5px; }
  details.help dt { font-weight:600; color:var(--fg); margin-top:8px; }
  details.help dd { margin:2px 0 0; }
  main { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:16px; padding:20px; }
  .card { border:1px solid var(--line); border-radius:10px; overflow:hidden; display:flex; flex-direction:column; }
  .card.done { border-color:var(--accent); }
  .imgwrap { aspect-ratio:1; background:#f4f4f5; }
  @media (prefers-color-scheme: dark) { .imgwrap { background:#1a1d23; } }
  .imgwrap img { width:100%; height:100%; object-fit:contain; display:block; }
  .thumbs { display:flex; gap:4px; padding:6px 10px 0; }
  .thumbs img { width:44px; height:44px; object-fit:cover; border-radius:5px; cursor:pointer;
                border:2px solid transparent; background:#f4f4f5; }
  .thumbs img.sel { border-color:var(--accent); }
  .meta { display:flex; gap:8px; align-items:baseline; padding:8px 10px 0; font-size:12.5px; color:var(--muted); }
  .meta .n { font-variant-numeric:tabular-nums; }
  .meta .price { margin-left:auto; }
  .fields { padding:8px 10px 12px; display:grid; gap:6px; }
  label { display:grid; grid-template-columns:88px 1fr; gap:8px; align-items:center; font-size:12.5px; }
  label span { color:var(--muted); text-transform:capitalize; }
  select { font:inherit; font-size:13px; padding:5px 6px; border-radius:6px;
           border:1px solid var(--line); background:var(--bg); color:var(--fg); width:100%; }
  footer { padding:24px 20px 60px; text-align:center; color:var(--muted); font-size:13px; }
</style></head><body>

<header>
  <h1>Gold set — ${setVersion}</h1>
  <span class="progress"><strong id="done">0</strong> / ${rows.length} labelled</span>
  <span style="flex:1"></span>
  <button id="clear">Clear all</button>
  <button id="export" class="primary" disabled>Export JSON</button>
</header>

<details class="help">
  <summary>What the terms mean — read once before starting</summary>
  <dl>
    ${GOLD_FIELDS.map(f => `<dt>${f.replace(/_/g, ' ')}</dt><dd>${escapeHtml(FIELD_HELP[f])}</dd>`).join('')}
  </dl>
  <p><strong>Click the small thumbnails</strong> to switch the main image. The first
  photo is often a model wearing the piece, where the setting is impossible to see —
  the detail shots usually show it. The extractor is given the same images you are.</p>
  <p><strong>Pick "unsure" freely.</strong> A guess you are not confident in is worse
  than an "unsure" — it silently marks the extractor wrong when it may have been right.
  Your answers save automatically as you go, so you can close this and come back.</p>
</details>

<main id="grid">${cards}</main>
<footer>Labels save to this browser automatically. Press <b>Export JSON</b> when finished.</footer>

<script>
(function () {
  var KEY = 'dip-goldset-${setVersion}';
  var grid = document.getElementById('grid');
  var doneEl = document.getElementById('done');
  var exportBtn = document.getElementById('export');
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { saved = {}; }

  function cardComplete(card) {
    var sels = card.querySelectorAll('select[data-field]');
    for (var i = 0; i < sels.length; i++) if (!sels[i].value) return false;
    return true;
  }

  function refresh() {
    var cards = grid.querySelectorAll('.card');
    var n = 0;
    cards.forEach(function (c) {
      var ok = cardComplete(c);
      c.classList.toggle('done', ok);
      if (ok) n++;
    });
    doneEl.textContent = n;
    exportBtn.disabled = n === 0;
  }

  // Restore anything already entered.
  grid.querySelectorAll('.card').forEach(function (card) {
    var id = card.dataset.design;
    var prev = saved[id];
    if (!prev) return;
    card.querySelectorAll('select[data-field]').forEach(function (sel) {
      if (prev[sel.dataset.field]) sel.value = prev[sel.dataset.field];
    });
  });
  refresh();

  // Thumbnails swap the large image. The first image is often a lifestyle
  // shot where the setting simply is not visible; the detail shots usually
  // are, and the model sees the same set.
  grid.addEventListener('click', function (e) {
    var t = e.target;
    if (!t.dataset || t.dataset.full === undefined) return;
    var card = t.closest('.card');
    card.querySelector('img.main').src = t.src;
    card.querySelectorAll('.thumbs img').forEach(function (x) { x.classList.remove('sel'); });
    t.classList.add('sel');
  });

  grid.addEventListener('change', function (e) {
    var sel = e.target;
    if (!sel.dataset || !sel.dataset.field) return;
    var card = sel.closest('.card');
    var id = card.dataset.design;
    saved[id] = saved[id] || { image_sha256: card.dataset.sha };
    saved[id][sel.dataset.field] = sel.value;
    localStorage.setItem(KEY, JSON.stringify(saved));
    refresh();
  });

  document.getElementById('clear').addEventListener('click', function () {
    if (!confirm('Clear every label on this sheet?')) return;
    saved = {};
    localStorage.removeItem(KEY);
    grid.querySelectorAll('select').forEach(function (s) { s.value = ''; });
    refresh();
  });

  exportBtn.addEventListener('click', function () {
    var out = { set_version: '${setVersion}', label_schema_version: '${VOCAB_VERSION}',
                labelled_at: new Date().toISOString(), labels: [] };
    grid.querySelectorAll('.card').forEach(function (card) {
      var id = card.dataset.design;
      var v = saved[id];
      if (!v) return;
      var complete = cardComplete(card);
      if (!complete) return;
      out.labels.push({
        design_id: id,
        image_sha256: card.dataset.sha,
        category: v.category, silhouette: v.silhouette,
        stone_shape: v.stone_shape, setting: v.setting,
        label_confidence: v.label_confidence
      });
    });
    var blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'dip-gold-labels-${setVersion}.json';
    a.click();
  });
})();
</script>
</body></html>`
}

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
