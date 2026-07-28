import { VOCAB, GOLD_FIELDS, FIELD_HELP, VOCAB_VERSION } from '../attributes/vocabulary'

/**
 * The VERIFICATION sheet — the model has already answered; the human confirms.
 *
 * This replaces blind labelling, which assumed the operator knows the
 * gemological vocabulary. He does not, and said so. Recognition ("does this
 * picture match the words shown?") is a far easier judgement than recall
 * ("name the silhouette"), and it needs no prior knowledge.
 *
 * The trade is acquiescence bias: people agree with what is put in front of
 * them. Two mitigations, both necessary:
 *
 *   1. ATTENTION CHECKS. A few cards are shown with a deliberately WRONG value.
 *      If they come back marked correct, the verification was not
 *      discriminating and its numbers must be discounted. This is the only way
 *      to know whether the exercise measured anything.
 *
 *   2. NO DEFAULT. Nothing is pre-selected as agreed. A card is untouched
 *      until the operator acts on it.
 */

export interface VerifyRow {
  design_id: string
  brand_name: string
  price_local: number | null
  image_data_uris: string[]
  /** What the model said, per field. */
  answers: Record<string, string>
  confidence: Record<string, number>
  notes: string
  /** Field deliberately corrupted for an attention check, if any. */
  planted_field?: string
  planted_true_value?: string
}

export function renderVerifySheet(rows: VerifyRow[], setVersion: string): string {
  const cards = rows.map((r, i) => `
<article class="card" data-design="${r.design_id}"${r.planted_field ? ` data-planted="${r.planted_field}"` : ''}>
  <div class="imgwrap"><img class="main" src="${r.image_data_uris[0]}" alt="design ${i + 1}" loading="lazy"></div>
  ${r.image_data_uris.length > 1 ? `<div class="thumbs">${r.image_data_uris.map((u, k) =>
    `<img src="${u}" data-full="${k}" class="${k === 0 ? 'sel' : ''}" alt="view ${k + 1}" loading="lazy">`).join('')}</div>` : ''}
  <div class="meta"><span>${i + 1}/${rows.length}</span><span>${esc(r.brand_name)}</span>
    <span class="price">${r.price_local ? '₹' + Math.round(r.price_local).toLocaleString('en-IN') : '—'}</span></div>

  <div class="answers">
    ${GOLD_FIELDS.map(f => `
    <div class="ans" data-field="${f}">
      <div class="row">
        <span class="k">${f.replace(/_/g, ' ')}</span>
        <b class="v">${esc(r.answers[f] ?? '—')}</b>
        <span class="c">${Math.round((r.confidence[f] ?? 0) * 100)}%</span>
        <button class="x" title="This one is wrong">✕</button>
      </div>
      <div class="fix">
        <select>
          <option value="">what should it be?</option>
          ${(VOCAB[f] ?? []).map(v => `<option value="${v}">${v}</option>`).join('')}
        </select>
      </div>
      <p class="help">${esc(FIELD_HELP[f])}</p>
    </div>`).join('')}
  </div>
  ${r.notes ? `<p class="mnotes">model note: ${esc(r.notes)}</p>` : ''}
  <div class="verdict">
    <button class="ok">All four correct</button>
    <button class="skip">Can't tell</button>
    <span class="state"></span>
  </div>
</article>`).join('')

  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>DIP verification — ${setVersion}</title>
<style>
 :root{color-scheme:light dark;--bg:#fff;--fg:#111;--line:#d8d8d8;--muted:#666;--ok:#0a7;--bad:#d33;}
 @media(prefers-color-scheme:dark){:root{--bg:#0f1115;--fg:#e8e8e8;--line:#2a2e37;--muted:#9aa0aa;}}
 *{box-sizing:border-box}
 body{margin:0;font:15px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;background:var(--bg);color:var(--fg)}
 header{position:sticky;top:0;z-index:10;background:var(--bg);border-bottom:1px solid var(--line);
        padding:12px 20px;display:flex;gap:14px;align-items:center;flex-wrap:wrap}
 h1{font-size:16px;margin:0;font-weight:600}
 .prog{color:var(--muted);font-variant-numeric:tabular-nums}.prog strong{color:var(--ok)}
 button{font:inherit;padding:6px 12px;border-radius:7px;border:1px solid var(--line);
        background:var(--bg);color:var(--fg);cursor:pointer}
 button.primary{background:var(--ok);border-color:var(--ok);color:#fff;font-weight:600}
 button:disabled{opacity:.45;cursor:not-allowed}
 details.intro{padding:12px 20px;border-bottom:1px solid var(--line);color:var(--muted);font-size:13.5px}
 main{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px;padding:20px}
 .card{border:1px solid var(--line);border-radius:10px;overflow:hidden;display:flex;flex-direction:column}
 .card.done{border-color:var(--ok)}.card.flagged{border-color:var(--bad)}
 .imgwrap{aspect-ratio:1;background:#f4f4f5}
 @media(prefers-color-scheme:dark){.imgwrap{background:#1a1d23}}
 .imgwrap img{width:100%;height:100%;object-fit:contain;display:block}
 .thumbs{display:flex;gap:4px;padding:6px 10px 0}
 .thumbs img{width:42px;height:42px;object-fit:cover;border-radius:5px;cursor:pointer;
             border:2px solid transparent;background:#f4f4f5}
 .thumbs img.sel{border-color:var(--ok)}
 .meta{display:flex;gap:8px;padding:8px 10px 4px;font-size:12.5px;color:var(--muted)}
 .meta .price{margin-left:auto}
 .answers{padding:4px 10px}
 .ans{border-top:1px solid var(--line);padding:7px 0}
 .ans .row{display:flex;align-items:center;gap:8px}
 .ans .k{color:var(--muted);font-size:12px;text-transform:capitalize;width:88px;flex:none}
 .ans .v{font-size:14px}
 .ans .c{margin-left:auto;font-size:11px;color:var(--muted);font-variant-numeric:tabular-nums}
 .ans .x{padding:1px 7px;font-size:12px;line-height:1.4;color:var(--muted)}
 .ans.wrong .v{text-decoration:line-through;color:var(--muted)}
 .ans.wrong .x{background:var(--bad);border-color:var(--bad);color:#fff}
 .ans .fix{display:none;padding-top:5px}.ans.wrong .fix{display:block}
 .ans .fix select{font:inherit;font-size:12.5px;padding:4px 6px;width:100%;border-radius:6px;
                  border:1px solid var(--line);background:var(--bg);color:var(--fg)}
 .ans .help{display:none;margin:4px 0 0;font-size:11.5px;color:var(--muted)}
 .card.showhelp .ans .help{display:block}
 .mnotes{margin:0;padding:4px 10px;font-size:11.5px;color:var(--muted);font-style:italic}
 .verdict{display:flex;gap:6px;align-items:center;padding:8px 10px 12px;border-top:1px solid var(--line)}
 .verdict .state{margin-left:auto;font-size:12px;color:var(--muted)}
 footer{padding:24px 20px 60px;text-align:center;color:var(--muted);font-size:13px}
</style></head><body>

<header>
  <h1>Verify — ${setVersion}</h1>
  <span class="prog"><strong id="done">0</strong> / ${rows.length} checked</span>
  <span style="flex:1"></span>
  <button id="help">Show definitions</button>
  <button id="clear">Clear</button>
  <button id="export" class="primary" disabled>Export JSON</button>
</header>

<details class="intro" open>
  <summary>How this works — 2 minutes</summary>
  <p>The AI has already answered. You are only checking whether its answers match the photographs.
  <strong>You do not need to know any of these terms</strong> — press <em>Show definitions</em> and
  each one is explained under the answer.</p>
  <ul>
    <li>If all four answers look right → <strong>All four correct</strong>.</li>
    <li>If one is wrong → click the <strong>✕</strong> beside it. Optionally pick what it should be.
        Leave the rest alone and the others count as correct.</li>
    <li>If the photos don't show enough to judge → <strong>Can't tell</strong>. This is a real answer, not a cop-out.</li>
  </ul>
  <p>Click the small thumbnails to change the main photo — the first is often a model wearing
  the piece, where fine detail isn't visible.</p>
  <p><strong>Please look properly rather than clicking through.</strong> A few cards have had an
  answer deliberately changed to a wrong one. If those come back marked correct, we learn the
  check wasn't discriminating and the results get discounted — which is worth knowing, but only
  if you didn't know which ones they were.</p>
</details>

<main id="grid">${cards}</main>
<footer>Saved to this browser as you go. Press <b>Export JSON</b> when done.</footer>

<script>
(function(){
 var KEY='dip-verify-${setVersion}', grid=document.getElementById('grid');
 var doneEl=document.getElementById('done'), exportBtn=document.getElementById('export');
 var st={}; try{st=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){st={}}

 function save(){localStorage.setItem(KEY,JSON.stringify(st));refresh()}
 function refresh(){
   var n=0;
   grid.querySelectorAll('.card').forEach(function(c){
     var v=st[c.dataset.design];
     c.classList.toggle('done', !!v && v.verdict==='ok');
     c.classList.toggle('flagged', !!v && v.verdict==='wrong');
     var s=c.querySelector('.state');
     s.textContent = !v ? '' : v.verdict==='ok' ? 'correct' : v.verdict==='skip' ? "can't tell" : 'corrections noted';
     if(v) n++;
   });
   doneEl.textContent=n; exportBtn.disabled=n===0;
 }

 grid.querySelectorAll('.card').forEach(function(c){
   var v=st[c.dataset.design]; if(!v) return;
   Object.keys(v.wrong||{}).forEach(function(f){
     var a=c.querySelector('.ans[data-field="'+f+'"]'); if(!a) return;
     a.classList.add('wrong');
     if(v.wrong[f]) a.querySelector('select').value=v.wrong[f];
   });
 });
 refresh();

 grid.addEventListener('click',function(e){
   var t=e.target, card=t.closest('.card'); if(!card) return;
   var id=card.dataset.design;

   if(t.dataset && t.dataset.full!==undefined){
     card.querySelector('img.main').src=t.src;
     card.querySelectorAll('.thumbs img').forEach(function(x){x.classList.remove('sel')});
     t.classList.add('sel'); return;
   }
   if(t.classList.contains('x')){
     var ans=t.closest('.ans'), f=ans.dataset.field;
     ans.classList.toggle('wrong');
     st[id]=st[id]||{wrong:{}}; st[id].wrong=st[id].wrong||{};
     if(ans.classList.contains('wrong')){ st[id].wrong[f]=ans.querySelector('select').value||''; }
     else { delete st[id].wrong[f]; }
     st[id].verdict = Object.keys(st[id].wrong).length ? 'wrong' : 'ok';
     save(); return;
   }
   if(t.classList.contains('ok')){ st[id]={verdict:'ok',wrong:{}};
     card.querySelectorAll('.ans').forEach(function(a){a.classList.remove('wrong')}); save(); return; }
   if(t.classList.contains('skip')){ st[id]={verdict:'skip',wrong:{}}; save(); return; }
 });

 grid.addEventListener('change',function(e){
   if(e.target.tagName!=='SELECT') return;
   var card=e.target.closest('.card'), ans=e.target.closest('.ans');
   if(!card||!ans) return;
   var id=card.dataset.design;
   st[id]=st[id]||{wrong:{}}; st[id].wrong=st[id].wrong||{};
   st[id].wrong[ans.dataset.field]=e.target.value;
   st[id].verdict='wrong'; save();
 });

 document.getElementById('help').addEventListener('click',function(){
   grid.querySelectorAll('.card').forEach(function(c){c.classList.toggle('showhelp')});
 });
 document.getElementById('clear').addEventListener('click',function(){
   if(!confirm('Clear every verdict?'))return;
   st={}; localStorage.removeItem(KEY);
   grid.querySelectorAll('.ans').forEach(function(a){a.classList.remove('wrong')});
   grid.querySelectorAll('select').forEach(function(s){s.value=''});
   refresh();
 });
 exportBtn.addEventListener('click',function(){
   var out={set_version:'${setVersion}',label_schema_version:'${VOCAB_VERSION}',
            verified_at:new Date().toISOString(),verdicts:[]};
   grid.querySelectorAll('.card').forEach(function(c){
     var v=st[c.dataset.design]; if(!v)return;
     out.verdicts.push({design_id:c.dataset.design, verdict:v.verdict,
                        corrections:v.wrong||{}, planted_field:c.dataset.planted||null});
   });
   var b=new Blob([JSON.stringify(out,null,2)],{type:'application/json'});
   var a=document.createElement('a'); a.href=URL.createObjectURL(b);
   a.download='dip-verdicts-${setVersion}.json'; a.click();
 });
})();
</script></body></html>`
}

function esc(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
