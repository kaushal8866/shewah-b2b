#!/usr/bin/env python3
"""Men's gold chain — design report. Built on a Surat manufacturer's own taxonomy."""
import json
D = json.load(open("artifacts/chain-trends/design/taxonomy.json"))
T, OBS = D["types"], D["observed_designs"]
SEGC = {"MENS":"s-men","MENS/UNISEX":"s-uni","WOMENS":"s-wom","FASHION":"s-fas","PENDANT":"s-pen"}
SEGL = {"MENS":"MEN'S","MENS/UNISEX":"MEN'S / UNISEX","WOMENS":"WOMEN'S","FASHION":"FASHION","PENDANT":"PENDANT CARRIER"}

rows = ""
for t in T:
    hot = " hot" if t["seg"] == "MENS" else ""
    stars = "★"*t["stars"] + "☆"*(5-t["stars"])
    rows += (f'<tr class="{hot.strip()}"><td class="num dim">{t["n"]}</td>'
             f'<td class="strong nm">{t["name"]}</td>'
             f'<td class="mono st s{t["stars"]}">{stars}</td>'
             f'<td class="mono dim">{t["strength"]}</td>'
             f'<td class="use">{t["use"]}</td>'
             f'<td><span class="seg {SEGC[t["seg"]]}">{SEGL[t["seg"]]}</span></td></tr>')

groups = ""
for seg in ("MENS","MENS/UNISEX","WOMENS","FASHION"):
    g = [t for t in T if t["seg"] == seg]
    st = sorted(set(t["stars"] for t in g))
    groups += (f'<tr class="{"hot" if seg=="MENS" else ""}"><td><span class="seg {SEGC[seg]}">{SEGL[seg]}</span></td>'
               f'<td class="num">{len(g)}</td>'
               f'<td class="mono strong s{st[0]}">{"★"*st[0]}{"☆"*(5-st[0])}</td>'
               f'<td class="use">{", ".join(t["name"] for t in g)}</td></tr>')

c = OBS[0]
lift_l = (c["likes_t1"]-c["likes_t0"])/c["likes_t0"]*100
lift_c = (c["comments_t1"]-c["comments_t0"])/c["comments_t0"]*100

HTML = f"""<title>Men's Chain Design Brief</title>
<style>
:root{{--paper:#F3F4F1;--card:#FBFBF9;--ink:#191B17;--ink-2:#62665E;--muted:#878B82;
--rule:#D9DBD4;--rule-2:#C3C6BD;--brass:#8A6318;--brass-b:#F0E6D0;--pos:#3D6B4E;--pos-b:#E2EDE5;
--neg:#973828;--neg-b:#F4E3DF;--blue:#3A5A78;--blue-b:#E1E8EE;
--f-mono:ui-monospace,"SF Mono",SFMono-Regular,Menlo,Monaco,"Cascadia Mono",monospace;
--f-text:ui-serif,"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;}}
@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]){{--paper:#151713;--card:#1C1F1A;
--ink:#E9EBE3;--ink-2:#9BA094;--muted:#7C8177;--rule:#2D302A;--rule-2:#3D4139;--brass:#CBA355;
--brass-b:#2E2718;--pos:#77A886;--pos-b:#1D2A21;--neg:#CE7A68;--neg-b:#2E1E1A;
--blue:#8FB0CB;--blue-b:#1B2530;}}}}
:root[data-theme="dark"]{{--paper:#151713;--card:#1C1F1A;--ink:#E9EBE3;--ink-2:#9BA094;
--muted:#7C8177;--rule:#2D302A;--rule-2:#3D4139;--brass:#CBA355;--brass-b:#2E2718;
--pos:#77A886;--pos-b:#1D2A21;--neg:#CE7A68;--neg-b:#2E1E1A;--blue:#8FB0CB;--blue-b:#1B2530;}}
*{{box-sizing:border-box}}
body{{background:var(--paper);color:var(--ink);font-family:var(--f-text);font-size:17px;
line-height:1.6;margin:0;padding:0 20px 96px}}
.wrap{{max-width:1000px;margin:0 auto}}
.eyebrow{{font-family:var(--f-mono);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin:0}}
h1{{font-family:var(--f-mono);font-size:clamp(28px,5vw,40px);font-weight:500;letter-spacing:-.02em;line-height:1.1;margin:10px 0 0}}
h2{{font-family:var(--f-mono);font-size:13px;font-weight:600;letter-spacing:.13em;text-transform:uppercase;margin:0}}
h3{{font-family:var(--f-text);font-size:21px;font-weight:600;line-height:1.3;margin:0;text-wrap:balance}}
p{{margin:0;max-width:70ch}} .lede{{font-size:19px;line-height:1.55;color:var(--ink-2);max-width:64ch}}
.mono{{font-family:var(--f-mono);font-variant-numeric:tabular-nums}}
.num{{font-family:var(--f-mono);font-variant-numeric:tabular-nums;text-align:right}}
.strong{{font-weight:600}} .dim{{color:var(--muted);font-size:12px}}
header.masthead{{padding:64px 0 28px;border-bottom:2px solid var(--ink)}}
.masthead .lede{{margin-top:18px}}
section{{padding-top:52px}}
.sec-head{{display:flex;align-items:baseline;gap:14px;padding-bottom:14px;margin-bottom:24px;border-bottom:1px solid var(--rule-2)}}
.sec-head .fill{{flex:1}} .sec-head .aside{{font-family:var(--f-mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}}
.stack{{display:flex;flex-direction:column;gap:22px}}
.strip{{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--rule-2);border:1px solid var(--rule-2);margin-top:30px}}
.strip .cell{{background:var(--card);padding:16px;display:flex;flex-direction:column;gap:5px}}
.strip .k{{font-family:var(--f-mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}}
.strip .v{{font-family:var(--f-mono);font-variant-numeric:tabular-nums;font-size:23px;letter-spacing:-.02em;line-height:1.05}}
.strip .sub{{font-family:var(--f-mono);font-size:11px;color:var(--ink-2)}}
.scroller{{overflow-x:auto}}
table{{border-collapse:collapse;width:100%;font-size:14px}}
th{{font-family:var(--f-mono);font-weight:500;font-size:10px;letter-spacing:.11em;text-transform:uppercase;color:var(--muted);padding:0 12px 9px 0;border-bottom:1px solid var(--rule-2);text-align:left}}
th.num{{text-align:right}}
td{{padding:10px 12px 10px 0;border-bottom:1px solid var(--rule);vertical-align:middle}}
tr.hot td{{background:var(--brass-b)}}
.nm{{font-size:16px}} .use{{color:var(--ink-2);font-size:13.5px}}
.st{{letter-spacing:2px;font-size:13px}}
.s5{{color:var(--brass)}} .s4{{color:var(--ink-2)}} .s3{{color:var(--muted)}}
.seg{{font-family:var(--f-mono);font-size:9.5px;letter-spacing:.07em;padding:3px 7px;white-space:nowrap}}
.s-men{{background:var(--brass-b);color:var(--brass);font-weight:600}}
.s-uni{{background:var(--pos-b);color:var(--pos)}}
.s-wom{{background:var(--neg-b);color:var(--neg)}}
.s-fas{{background:var(--rule);color:var(--muted)}}
.s-pen{{background:var(--blue-b);color:var(--blue)}}
.callout{{border-left:3px solid var(--brass);background:var(--card);padding:22px 24px;display:flex;flex-direction:column;gap:12px}}
.callout .t{{font-family:var(--f-mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--brass)}}
.big{{font-family:var(--f-mono);font-size:clamp(34px,7vw,56px);line-height:1;letter-spacing:-.03em;color:var(--brass);font-variant-numeric:tabular-nums}}
.caption{{font-family:var(--f-mono);font-size:11.5px;color:var(--muted);line-height:1.55;max-width:74ch}}
.acts{{display:flex;flex-direction:column;gap:1px;background:var(--rule-2);border:1px solid var(--rule-2)}}
.act{{background:var(--card);padding:18px 20px;display:grid;grid-template-columns:28px 1fr;gap:14px}}
.act .n{{font-family:var(--f-mono);font-size:12px;color:var(--brass);padding-top:3px}}
.act .b{{display:flex;flex-direction:column;gap:5px}}
.act .t{{font-weight:600;font-size:17px}} .act .d{{font-size:15px;color:var(--ink-2);line-height:1.5}}
footer{{margin-top:60px;padding-top:20px;border-top:1px solid var(--rule-2);font-family:var(--f-mono);font-size:11px;color:var(--muted);line-height:1.7}}
@media (max-width:760px){{.strip{{grid-template-columns:1fr 1fr}}body{{font-size:16px}}}}
</style>
<div class="wrap">
<header class="masthead">
  <p class="eyebrow">Design brief · men's gold chains · Surat</p>
  <h1>Men's Chain Design Brief</h1>
  <p class="lede">Built on a chain taxonomy published by a verified Surat manufacturer with its own
  factory — not on hashtags or engagement. Fifteen chain types, each rated for durability and
  tagged by who wears it. The classification turns out to follow one rule exactly.</p>
  <div class="strip">
    <div class="cell"><span class="k">Chain types</span><span class="v">{len(T)}</span><span class="sub">manufacturer's own chart</span></div>
    <div class="cell"><span class="k">Men's-only types</span><span class="v">3</span><span class="sub">Curb · Rope · Byzantine</span></div>
    <div class="cell"><span class="k">Men's + unisex</span><span class="v">5</span><span class="sub">of {len(T)} types</span></div>
    <div class="cell"><span class="k">Rule exceptions</span><span class="v">0</span><span class="sub">across all {len(T)} rows</span></div>
  </div>
</header>

<section>
  <div class="sec-head"><h2>The rule</h2><span class="fill"></span><span class="aside">strength decides segment</span></div>
  <div class="stack">
  <div class="callout"><span class="t">Zero exceptions in 15 rows</span>
    <h3>Durability <em>is</em> the men's category. It isn't a style question at all.</h3>
    <p style="color:var(--ink-2)">Every chain the manufacturer marks <strong>Men's</strong> is rated
    five stars. Every <strong>Men's&nbsp;/&nbsp;Unisex</strong> is four. Every <strong>Women's</strong>
    and every <strong>Fashion</strong> chain is three. Not one row breaks it.</p>
    <p style="color:var(--ink-2)">A men's chain is not a heavier version of a women's chain, or a
    different motif. It is the subset that <em>survives daily wear</em> — which is exactly how a
    Surat buyer treats it: worn every day, for years, as wearable savings.</p>
  </div>
  <div class="scroller"><table>
    <thead><tr><th>Segment</th><th class="num">Types</th><th>Rating</th><th>Which</th></tr></thead>
    <tbody>{groups}</tbody></table></div>
  </div>
</section>

<section>
  <div class="sec-head"><h2>The 15 types</h2><span class="fill"></span><span class="aside">as published</span></div>
  <div class="scroller"><table>
    <thead><tr><th class="num">#</th><th>Chain</th><th>Strength</th><th></th><th>Best use</th><th>Segment</th></tr></thead>
    <tbody>{rows}</tbody></table></div>
  <p class="caption" style="margin-top:16px">Highlighted rows are the three the manufacturer marks
  as men's chains outright. Everything else is unisex, women's, fashion, or a pendant carrier.</p>
</section>

<section>
  <div class="sec-head"><h2>Your shortlist</h2><span class="fill"></span><span class="aside">from the taxonomy</span></div>
  <div class="stack">
  <p>A 500 g float wants four to six designs. The taxonomy narrows the field to five candidates
  before any demand data is applied:</p>
  <div class="acts">
    <div class="act"><span class="n">01</span><span class="b"><span class="t">Curb — ★★★★★</span>
      <span class="d">The default men's chain. Solid, flat-lying, high strength, low making
      relative to fancy links. The safest volume line, and therefore the most price-contested.</span></span></div>
    <div class="act"><span class="n">02</span><span class="b"><span class="t">Rope — ★★★★★</span>
      <span class="d">Equal top rating, and the only men's type the chart also lists for pendants —
      so it serves two buyers. Twisted construction hides wear well.</span></span></div>
    <div class="act"><span class="n">03</span><span class="b"><span class="t">Byzantine — ★★★★★</span>
      <span class="d">Listed for men's chains and heavy pendants. The highest-making design of the
      three, which is where a differentiated tunch is defensible instead of contested.</span></span></div>
    <div class="act"><span class="n">04</span><span class="b"><span class="t">Figaro — ★★★★☆</span>
      <span class="d">Men's and unisex. Broadest addressable buyer of any type on the chart; one
      die serves two counters.</span></span></div>
    <div class="act"><span class="n">05</span><span class="b"><span class="t">Anchor — ★★★★☆</span>
      <span class="d">Men's and unisex, four stars, and the least crowded of the five. Worth one
      test slot rather than a core allocation.</span></span></div>
  </div>
  <p class="caption">Excluded on the manufacturer's own classification: Singapore and Omega
  (women's), Twisted, Herringbone and Satellite (fashion), Box, Snake, Bead, Belcher and Venetian
  (pendant carriers, not standalone men's chains).</p>
  </div>
</section>

<section>
  <div class="sec-head"><h2>Choco — the design outside the chart</h2><span class="fill"></span><span class="aside">live momentum</span></div>
  <div class="stack">
  <div class="callout"><span class="t">Moving while we watched it</span>
    <div style="display:flex;gap:40px;flex-wrap:wrap;align-items:baseline">
      <div><div class="big">+{lift_l:.0f}%</div><p class="caption">likes<br>{c["likes_t0"]} &rarr; {c["likes_t1"]}</p></div>
      <div><div class="big">+{lift_c:.0f}%</div><p class="caption">comments<br>{c["comments_t0"]} &rarr; {c["comments_t1"]}</p></div>
      <div><div class="big">{c["window_hours"]}h</div><p class="caption">elapsed between<br>the two readings</p></div>
    </div>
    <p style="color:var(--ink-2)"><strong>Choco Chain, {c["karat"]}, {c["weight_g"]} grams.</strong>
    It does not appear anywhere in the 15-type chart — it is a regional name, not part of the
    Italian standard set. Yet its post gained {c["likes_t1"]-c["likes_t0"]} likes and
    {c["comments_t1"]-c["comments_t0"]} comments in a single afternoon, and every captured comment
    on it is a price question.</p>
    <p style="color:var(--ink-2)">The same seller also runs <strong>Cocoa Chains at 30 g</strong> —
    almost certainly the same family. A design with real pull and no place in the standard
    catalogue is the definition of a gap.</p>
  </div>
  <p class="caption">One post, one seller, in Bangalore rather than Gujarat. Treat it as a lead to
  test on your own counter, not as a proven Surat trend.</p>
  </div>
</section>

<section>
  <div class="sec-head"><h2>What to do</h2><span class="fill"></span><span class="aside">actionable</span></div>
  <div class="acts">
    <div class="act"><span class="n">01</span><span class="b">
      <span class="t">Cut the float along the strength line, not the style line.</span>
      <span class="d">Curb, Rope and Byzantine as the core three — the only types a Surat
      manufacturer will call men's without qualification. Figaro as the fourth for unisex reach.</span></span></div>
    <div class="act"><span class="n">02</span><span class="b">
      <span class="t">Put Byzantine where the margin is.</span>
      <span class="d">Curb and Rope are the volume lines everyone stocks, which is where the
      1–2% value-addition pressure bites. Byzantine carries genuinely higher making, so a higher
      tunch is defensible on the work rather than argued on the rate.</span></span></div>
    <div class="act"><span class="n">03</span><span class="b">
      <span class="t">Sample Choco before committing to it.</span>
      <span class="d">Strongest live demand signal found, and absent from the standard catalogue.
      But it is one post in Bangalore. One or two pieces on your counter answers it faster and
      cheaper than any amount of further scraping.</span></span></div>
    <div class="act"><span class="n">04</span><span class="b">
      <span class="t">Lead every listing with the strength claim.</span>
      <span class="d">The trade already sells men's chains on durability — that is what the chart
      is for. Pair it with the weight in grams, which is the other thing buyers ask for every
      time and almost nobody publishes.</span></span></div>
  </div>
</section>

<footer>
Primary source: the &ldquo;Types of Gold Chains&rdquo; chart published by a verified Surat gold-chain
manufacturer (Bhagal Char Rasta, factory since 2001), read directly from the post image on
2026-08-20. Strength ratings and best-use labels are the manufacturer's, not ours. Choco and Cocoa
observations come from a separate Bangalore retailer; engagement deltas measured across two reads
roughly {c["window_hours"]} hours apart the same day. Scope is men's neck chains in gold — women's
designs, silver, plated and wrist pieces excluded throughout.
</footer>
</div>"""
open("artifacts/chain-trends/design/report.html","w").write(HTML)
print(f"wrote artifacts/chain-trends/design/report.html ({len(HTML)/1024:.0f} KB)")
