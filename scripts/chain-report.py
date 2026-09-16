#!/usr/bin/env python3
"""Gold men's chain report — chains only, nothing else.

    python3 scripts/chain-report.py artifacts/chain-trends/2026-W34
"""
import json, sys, os, html
BASE = sys.argv[1] if len(sys.argv) > 1 else "artifacts/chain-trends/2026-W34"
D = json.load(open(f"{BASE}/chains.json"))
IMG = json.load(open(f"{BASE}/img/chains-b64.json")) if os.path.exists(f"{BASE}/img/chains-b64.json") else {}
CM = json.load(open(f"{BASE}/comments-summary.json")) if os.path.exists(f"{BASE}/comments-summary.json") else None
e = html.escape
def n(x): return f"{x:,}" if isinstance(x, int) else x
def thumb(sc):
    b = IMG.get(sc)
    return (f'<img class="thumb" src="data:image/jpeg;base64,{b}" alt="" loading="lazy">'
            if b else '<div class="thumb noimg">—</div>')

L, C, P, W = D["likes"], D["comm"], D["price"], D["weights"]

pat_rows = ""
mx = max(p["n"] for p in D["patterns"])
for p in D["patterns"]:
    hot = " hot" if p["pq"] >= 50 else ""
    pat_rows += (f'<tr class="{hot.strip()}"><td class="mono strong">{e(p["name"])}</td>'
      f'<td class="num">{p["n"]}</td><td class="num">{p["accts"]}</td>'
      f'<td class="num">{n(p["med"])}</td><td class="num">{n(p["mx"])}</td>'
      f'<td class="num strong{hot}">{p["pq"]}%</td>'
      f'<td class="barcell"><span class="bar{hot}" style="width:{p["n"]/mx*100:.0f}%"></span></td></tr>')

rb = "".join(f'<tr><td class="mono">{e(b["band"])}</td><td class="num">{b["n"]}</td>'
  f'<td class="num strong">{b["pq"]}%</td>'
  f'<td class="barcell"><span class="bar" style="width:{b["pq"]*2.2:.0f}%"></span></td></tr>'
  for b in D["ratio_bands"])

wmax = max((x["n"] for x in W["bands"]), default=1)
wb = "".join(f'<tr><td class="mono">{e(x["b"])} g</td><td class="num">{x["n"]}</td>'
  f'<td class="barcell"><span class="bar" style="width:{x["n"]/wmax*100:.0f}%"></span></td></tr>'
  for x in W["bands"])

def card(p, tag):
    share = round(p["pq"] / p["ncap"] * 100) if p["ncap"] else 0
    lk = n(p["likes"]) if p["likes"] is not None else "—"
    wt = f' · <span class="wt">{", ".join(str(x) for x in p["wts"])} g</span>' if p["wts"] else ""
    pats = " ".join(f'<span class="ptag">{e(x)}</span>' for x in p["pats"])
    quotes = "".join(f'<li>{e(" ".join(t.split())[:70])}</li>' for t in p.get("pqtext", [])[:3])
    return f'''<article class="card">{thumb(p["sc"])}<div class="cbody">
      <div class="chead"><span class="mono acct">@{e(p["u"])}</span><span class="pill">{tag}</span></div>
      {f'<div class="ptags">{pats}</div>' if pats else ''}
      <p class="cap">{e(p["cap"][:130])}</p>
      {f'<ul class="quotes">{quotes}</ul>' if quotes else ''}
      <div class="cmeta mono">{lk} likes · {n(p["comments"])} comments · {share}% price{wt}</div>
      <a class="lnk mono" href="https://instagram.com/p/{e(p["sc"])}/" target="_blank" rel="noopener">view ↗</a>
    </div></article>'''

price_cards = "".join(card(p, f'{p["pq"]}/{p["ncap"]} asking price') for p in D["top_price"][:9])
wt_cards    = "".join(card(p, f'{max(p["wts"])} g') for p in D["with_weight"][:8])

tl = "".join(f'<tr><td class="num strong">{n(p["likes"])}</td><td class="num">{n(p["comments"])}</td>'
  f'<td class="num">{p["pq"]}/{p["ncap"]}</td><td class="mono">@{e(p["u"])}</td>'
  f'<td class="capcell">{e(p["cap"][:80])}</td>'
  f'<td><a class="mono" href="https://instagram.com/p/{e(p["sc"])}/" target="_blank" rel="noopener">↗</a></td></tr>'
  for p in D["top_likes"][:12])

acc = "".join(f'<tr><td class="mono">@{e(a["u"])}</td><td class="num">{n(a["foll"]) if a["foll"] else "—"}</td>'
  f'<td class="num strong">{a["n"]}</td><td class="num">{n(a["med"])}</td><td class="num">{n(a["mx"])}</td>'
  f'<td class="num">{n(a["comm"])}</td><td class="num">{a["pq"]}/{a["ncap"]}</td><td class="num">{a["wts"]}</td></tr>'
  for a in D["accounts"])


if CM:
    A = CM["audience"]; N = CM["n"]
    imax = max(i["n"] for i in CM["intents"])
    irows = "".join(
      f'<tr class="{"trade" if i["k"].startswith("trade") else ""}"><td class="mono strong">{e(i["k"])}</td>'
      f'<td class="num">{i["n"]}</td><td class="num">{i["pct"]}%</td>'
      f'<td class="barcell"><span class="bar{" hot" if i["k"].startswith("trade") else ""}" '
      f'style="width:{i["n"]/imax*100:.0f}%"></span></td></tr>' for i in CM["intents"])
    tq = "".join(f'<li><span class="qtag">{e(q["tag"])}</span>"{e(q["t"])}"<span class="qsrc">on @{e(q["u"])}</span></li>'
                 for q in CM["trade_quotes"])
    bq = "".join(f'<li><span class="qtag buy">{e(q["tag"])}</span>"{e(q["t"])}"<span class="qsrc">on @{e(q["u"])}</span></li>'
                 for q in CM["buyer_quotes"])
    fb = "".join(f'<li>"{e(q["t"])}"<span class="qsrc">on @{e(q["u"])}</span></li>' for q in CM["feedback"])
    COMMENTS = f"""
<section>
  <div class="sec-head"><h2>Comment intent</h2><span class="fill"></span><span class="aside">{N} comments classified</span></div>
  <div class="stack">
  <div class="strip">
    <div class="cell"><span class="k">Noise</span><span class="v">{A["noise"]/N*100:.0f}%</span><span class="sub">praise, emoji, devotional</span></div>
    <div class="cell"><span class="k">Buyer enquiry</span><span class="v">{A["buyer"]/N*100:.0f}%</span><span class="sub">price, weight, purity, stock</span></div>
    <div class="cell"><span class="k">Trade / B2B</span><span class="v">{A["trade"]/N*100:.0f}%</span><span class="sub">wastage, casting, catalogue</span></div>
    <div class="cell"><span class="k">Order intent</span><span class="v">1</span><span class="sub">of {N} comments</span></div>
  </div>
  <div class="scroller"><table>
    <thead><tr><th>Intent</th><th class="num">Comments</th><th class="num">Share</th><th></th></tr></thead>
    <tbody>{irows}</tbody></table></div>
  <div class="callout"><span class="t">Who is actually in these comments</span>
    <h3>A third of the comments are other jewellers, and they ask about making rate — never design.</h3>
    <p style="color:var(--ink-2)">Read on full threads pulled through a logged-in session, not the
    15-comment window an API returns. The trade bucket asks <em>"Wastage kya hai mam?"</em>,
    <em>"Bhai ji kya %"</em>, <em>"Kitne percent lete ho 100 gm pe"</em>, <em>"Tax kitna dete ho"</em>,
    <em>"Hisab"</em>. One comment states the competitive rate outright:
    <strong>"Log 1-2% va pe maal bech rahe hain"</strong> — people are selling at 1–2% value addition.</p>
    <p style="color:var(--ink-2)">Not one trade comment in the whole corpus asks about a design. On
    chain-wholesaler accounts the audience is the trade and the axis is <strong>making rate</strong>.
    Whatever design intelligence exists here, it is not what these accounts are being asked for.</p></div>
  <h3 style="margin-top:8px">Trade comments, verbatim</h3>
  <ul class="qlist">{tq}</ul>
  <h3 style="margin-top:8px">Buyer comments, verbatim</h3>
  <ul class="qlist">{bq}</ul>
  <div class="callout"><span class="t">Buyers telling sellers what to fix</span>
    <h3>Two comments on the same account ask for the same thing.</h3>
    <ul class="qlist plain">{fb}</ul>
    <p style="color:var(--ink-2)">Unprompted instructions to put the weight in the caption — the
    behaviour the rest of this report infers statistically, stated outright by the audience.</p></div>
  </div>
</section>"""
else:
    COMMENTS = ""

HTML = f"""<title>Gold Chain Panel</title>
<style>
:root{{--paper:#F3F4F1;--card:#FBFBF9;--ink:#191B17;--ink-2:#62665E;--muted:#878B82;
--rule:#D9DBD4;--rule-2:#C3C6BD;--brass:#8A6318;--brass-b:#F0E6D0;--pos:#3D6B4E;--pos-b:#E2EDE5;
--neg:#973828;--neg-b:#F4E3DF;
--f-mono:ui-monospace,"SF Mono",SFMono-Regular,Menlo,Monaco,"Cascadia Mono",monospace;
--f-text:ui-serif,"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;}}
@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]){{--paper:#151713;--card:#1C1F1A;
--ink:#E9EBE3;--ink-2:#9BA094;--muted:#7C8177;--rule:#2D302A;--rule-2:#3D4139;--brass:#CBA355;
--brass-b:#2E2718;--pos:#77A886;--pos-b:#1D2A21;--neg:#CE7A68;--neg-b:#2E1E1A;}}}}
:root[data-theme="dark"]{{--paper:#151713;--card:#1C1F1A;--ink:#E9EBE3;--ink-2:#9BA094;
--muted:#7C8177;--rule:#2D302A;--rule-2:#3D4139;--brass:#CBA355;--brass-b:#2E2718;
--pos:#77A886;--pos-b:#1D2A21;--neg:#CE7A68;--neg-b:#2E1E1A;}}
*{{box-sizing:border-box}}
body{{background:var(--paper);color:var(--ink);font-family:var(--f-text);font-size:17px;
line-height:1.6;margin:0;padding:0 20px 96px}}
.wrap{{max-width:1000px;margin:0 auto}}
.eyebrow{{font-family:var(--f-mono);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin:0}}
h1{{font-family:var(--f-mono);font-size:clamp(28px,5vw,40px);font-weight:500;letter-spacing:-.02em;line-height:1.1;margin:10px 0 0}}
h2{{font-family:var(--f-mono);font-size:13px;font-weight:600;letter-spacing:.13em;text-transform:uppercase;margin:0}}
h3{{font-family:var(--f-text);font-size:20px;font-weight:600;line-height:1.3;margin:0;text-wrap:balance}}
p{{margin:0;max-width:70ch}} .lede{{font-size:19px;line-height:1.55;color:var(--ink-2);max-width:64ch}}
.mono{{font-family:var(--f-mono);font-variant-numeric:tabular-nums}}
.num{{font-family:var(--f-mono);font-variant-numeric:tabular-nums;text-align:right}}
.strong{{font-weight:600}} .hot{{color:var(--brass)}}
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
th{{font-family:var(--f-mono);font-weight:500;font-size:10px;letter-spacing:.11em;text-transform:uppercase;color:var(--muted);padding:0 10px 9px 0;border-bottom:1px solid var(--rule-2);text-align:left}}
th.num{{text-align:right}}
td{{padding:8px 10px 8px 0;border-bottom:1px solid var(--rule);vertical-align:top}}
tbody tr:hover{{background:var(--card)}}
tr.hot td{{background:var(--brass-b)}}
.barcell{{width:30%;padding-right:0}}
.bar{{display:block;height:9px;background:var(--rule-2)}} .bar.hot{{background:var(--brass)}}
.capcell{{font-family:var(--f-text);color:var(--ink-2);font-size:13.5px;max-width:280px}}
.cards{{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:1px;background:var(--rule-2);border:1px solid var(--rule-2)}}
.card{{background:var(--card);display:flex;flex-direction:column}}
.thumb{{width:100%;aspect-ratio:1;object-fit:cover;display:block;border-bottom:1px solid var(--rule-2)}}
.noimg{{display:flex;align-items:center;justify-content:center;color:var(--muted);background:var(--paper);font-family:var(--f-mono)}}
.cbody{{padding:14px 16px 16px;display:flex;flex-direction:column;gap:8px;flex:1}}
.chead{{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}}
.acct{{font-size:12px;color:var(--ink-2)}}
.pill{{font-family:var(--f-mono);font-size:10px;padding:3px 7px;background:var(--pos-b);color:var(--pos);white-space:nowrap}}
.ptags{{display:flex;flex-wrap:wrap;gap:4px}}
.ptag{{font-family:var(--f-mono);font-size:9.5px;letter-spacing:.05em;text-transform:uppercase;padding:2px 6px;background:var(--brass-b);color:var(--brass)}}
.cap{{font-size:13px;line-height:1.45;color:var(--ink-2);margin:0}}
.quotes{{margin:0;padding-left:16px;font-family:var(--f-mono);font-size:11px;color:var(--ink-2);line-height:1.5}}
.wt{{color:var(--brass);font-weight:600}}
.cmeta{{font-size:11px;color:var(--muted);margin-top:auto}}
.lnk{{font-size:11px;color:var(--brass);text-decoration:none}} .lnk:hover{{text-decoration:underline}}
a{{color:var(--brass)}} a:focus-visible{{outline:2px solid var(--brass);outline-offset:2px}}
.callout{{border-left:3px solid var(--brass);background:var(--card);padding:20px 22px;display:flex;flex-direction:column;gap:12px}}
.callout .t{{font-family:var(--f-mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--brass)}}
.qlist{{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:1px;background:var(--rule-2);border:1px solid var(--rule-2)}}
.qlist li{{background:var(--card);padding:10px 14px;font-size:14px;display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}}
.qlist.plain{{border:none;background:none}} .qlist.plain li{{background:var(--paper)}}
.qtag{{font-family:var(--f-mono);font-size:9.5px;letter-spacing:.05em;text-transform:uppercase;padding:2px 6px;background:var(--brass-b);color:var(--brass);white-space:nowrap}}
.qtag.buy{{background:var(--pos-b);color:var(--pos)}}
.qsrc{{font-family:var(--f-mono);font-size:10.5px;color:var(--muted);margin-left:auto}}
tr.trade td{{background:var(--brass-b)}}
.caption{{font-family:var(--f-mono);font-size:11.5px;color:var(--muted);line-height:1.55;max-width:74ch}}
footer{{margin-top:60px;padding-top:20px;border-top:1px solid var(--rule-2);font-family:var(--f-mono);font-size:11px;color:var(--muted);line-height:1.7}}
@media (max-width:760px){{.strip{{grid-template-columns:1fr 1fr}}body{{font-size:16px}}}}
</style>
<div class="wrap">
<header class="masthead">
  <p class="eyebrow">Gold · men's neck chains only · 2026-08-20</p>
  <h1>Gold Chain Panel</h1>
  <p class="lede">Every post is a gold men's neck chain. No silver, no plated, no kada or bracelet,
  no ladies' items, no rings. {D["total"]} chain posts from {D["accounts_n"]} accounts — the complete
  set found, not a sample.</p>
  <div class="strip">
    <div class="cell"><span class="k">Chain posts</span><span class="v">{D["total"]}</span><span class="sub">{D["accounts_n"]} accounts</span></div>
    <div class="cell"><span class="k">Median likes</span><span class="v">{L["median"]:.0f}</span><span class="sub">p90 {n(L["p90"])} · max {n(L["max"])}</span></div>
    <div class="cell"><span class="k">Zero-comment</span><span class="v">{C["zero"]}</span><span class="sub">{C["zero"]/D["scored"]*100:.0f}% of posts</span></div>
    <div class="cell"><span class="k">Price-intent</span><span class="v">{P["pct"]}%</span><span class="sub">{P["intent"]} of {P["captured"]} comments</span></div>
  </div>
</header>

<section>
  <div class="sec-head"><h2>Patterns</h2><span class="fill"></span><span class="aside">from caption text</span></div>
  <div class="stack">
  <div class="scroller"><table>
    <thead><tr><th>Pattern</th><th class="num">Posts</th><th class="num">Accounts</th><th class="num">Median likes</th><th class="num">Max</th><th class="num">Price-intent</th><th></th></tr></thead>
    <tbody>{pat_rows}</tbody></table></div>
  <div class="callout"><span class="t">The two numbers that matter</span>
    <h3>Italian is what everyone sells. Choco is what people ask about.</h3>
    <p style="color:var(--ink-2)"><strong>"Italian"</strong> appears in 102 of {D["total"]} chain posts
    across 7 accounts — the dominant category word in this trade, and it draws 33% price-intent.
    <strong>"Choco"</strong> appears in only 3 posts, but those carry a median of 72 likes against a
    panel median of {L["median"]:.0f}, and <strong>94% of their comments are price questions</strong>.
    Nine times the engagement and near-total buying intent, on almost no supply.</p>
    <p class="caption">Caveat: three posts. This is a direction to test, not a proven trend.</p></div>
  </div>
</section>

{COMMENTS}

<section>
  <div class="sec-head"><h2>Where people ask price</h2><span class="fill"></span><span class="aside">{P["posts_with"]} posts of {D["total"]}</span></div>
  <div class="stack">
  <p>Comments matched in English, Hindi and Gujarati — <span class="mono">price</span>,
  <span class="mono">rate</span>, <span class="mono">kitna</span>, <span class="mono">ketla</span>,
  <span class="mono">કિંમત</span>, <span class="mono">कीमत</span>, <span class="mono">weight</span>,
  <span class="mono">gram</span>. Actual comments quoted on each card.</p>
  <div class="cards">{price_cards}</div>
  </div>
</section>

<section>
  <div class="sec-head"><h2>The posts that state a weight</h2><span class="fill"></span><span class="aside">{W["posts"]} of {D["total"]}</span></div>
  <div class="stack">
  <div class="callout"><span class="t">The single biggest gap in this market</span>
    <h3>Only {W["posts"]} chain posts in {D["total"]} state a weight.</h3>
    <p style="color:var(--ink-2)">Buyers ask in grams — "price and weight", "20 gram ge beku",
    "how much gram". Sellers answer in adjectives. {W["posts"]} posts out of {D["total"]} put a number
    in the caption, and those are the posts that get asked about.</p></div>
  <div class="cards">{wt_cards}</div>
  <div class="scroller"><table>
    <thead><tr><th>Weight band</th><th class="num">Mentions</th><th></th></tr></thead>
    <tbody>{wb}</tbody></table></div>
  </div>
</section>

<section>
  <div class="sec-head"><h2>Comment-to-like ratio</h2><span class="fill"></span><span class="aside">chains only</span></div>
  <div class="stack">
  <div class="scroller"><table>
    <thead><tr><th>Ratio</th><th class="num">Posts</th><th class="num">Comments asking price</th><th></th></tr></thead>
    <tbody>{rb}</tbody></table></div>
  <p class="caption">Ranked on, never excluded on. A post with few likes and many comments is a post
  people are trying to buy from.</p>
  </div>
</section>

<section>
  <div class="sec-head"><h2>Top chains by reach</h2><span class="fill"></span><span class="aside">{D["total"]} posts</span></div>
  <div class="scroller"><table>
    <thead><tr><th class="num">Likes</th><th class="num">Comm</th><th class="num">Price</th><th>Account</th><th>Caption</th><th></th></tr></thead>
    <tbody>{tl}</tbody></table></div>
  <p class="caption" style="margin-top:14px">Reach and buying intent are near-independent here. The
  biggest posts are brand-voice with no spec; the posts that draw questions are smaller and concrete.</p>
</section>

<section>
  <div class="sec-head"><h2>All {len(D["accounts"])} accounts</h2><span class="fill"></span><span class="aside">chain posts only</span></div>
  <div class="scroller"><table>
    <thead><tr><th>Account</th><th class="num">Followers</th><th class="num">Chain posts</th><th class="num">Median likes</th><th class="num">Max</th><th class="num">Comments</th><th class="num">Price</th><th class="num">Posts w/ weight</th></tr></thead>
    <tbody>{acc}</tbody></table></div>
</section>

<footer>
Apify runs <span class="mono">WaCeKcZYzBiQI3ojm</span> + <span class="mono">aTu98dL0K1Xyw37py</span>,
1,308 unique posts scraped from 40+ accounts, filtered to {D["total"]} gold men's neck chains.
Posts from chain-only businesses count as chains regardless of caption; all others must name a chain
in the caption. Excluded: silver/925, gold-plated/1-gram/9ct/steel, kada/bracelet/bangle, rings, and
ladies' items (mangalsutra, mangalya, thali, dokiya, kanti, butti). Price-intent is regex over the
newest ~15 comments Instagram exposes per post. {D["hidden"]} posts hide their like count.
</footer>
</div>"""
open(f"{BASE}/chains.html","w").write(HTML)
print(f"wrote {BASE}/chains.html ({len(HTML)/1024/1024:.2f} MB)")
