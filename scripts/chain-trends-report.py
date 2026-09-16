#!/usr/bin/env python3
"""Render the men's chain corpus analysis to a single self-contained HTML file.

    python3 scripts/chain-trends-report.py artifacts/chain-trends/2026-W34
"""
import json, sys, os, html

BASE = sys.argv[1] if len(sys.argv) > 1 else "artifacts/chain-trends/2026-W34"
D = json.load(open(f"{BASE}/data.json"))
IMG = json.load(open(f"{BASE}/img/b64.json")) if os.path.exists(f"{BASE}/img/b64.json") else {}

e = html.escape
def n(x):  return f"{x:,}"
def img(sc, cls="thumb"):
    b = IMG.get(sc)
    return (f'<img class="{cls}" src="data:image/jpeg;base64,{b}" alt="" loading="lazy">'
            if b else f'<div class="{cls} noimg">no image</div>')

CATS = D["cats"]; TOTAL = D["total"]
chain_n = dict(CATS).get("GOLD MEN'S CHAIN", 0)

# ── funnel bar ────────────────────────────────────────────────────────────
cat_rows = ""
for c, k in CATS:
    pct = k / TOTAL * 100
    hot = " is-target" if c == "GOLD MEN'S CHAIN" else ""
    cat_rows += (f'<tr class="{hot.strip()}"><td>{e(c)}</td>'
                 f'<td class="num">{n(k)}</td><td class="num">{pct:.1f}%</td>'
                 f'<td class="barcell"><span class="bar{hot}" style="width:{pct*2.6:.1f}%"></span></td></tr>')

# ── ratio bands ───────────────────────────────────────────────────────────
rb = ""
for b in D["ratio_bands"]:
    rb += (f'<tr><td class="mono">{e(b["band"])}</td><td class="num">{b["n"]}</td>'
           f'<td class="num strong">{b["pq"]}%</td>'
           f'<td class="barcell"><span class="bar" style="width:{b["pq"]*2.2:.0f}%"></span></td></tr>')

# ── weights ───────────────────────────────────────────────────────────────
wmax = max((x["n"] for x in D["weights"]["bands"]), default=1)
wb = ""
for x in D["weights"]["bands"]:
    wb += (f'<tr><td class="mono">{e(x["b"])} g</td><td class="num">{x["n"]}</td>'
           f'<td class="barcell"><span class="bar" style="width:{x["n"]/wmax*100:.0f}%"></span></td></tr>')

# ── price winners (cards) ─────────────────────────────────────────────────
cards = ""
for p in D["top_price"][:9]:
    share = round(p["pq"] / p["ncap"] * 100) if p["ncap"] else 0
    lk = n(p["likes"]) if p["likes"] is not None else "—"
    wt = f' · {", ".join(str(w) for w in p["wts"])} g' if p["wts"] else ""
    cards += f'''<article class="card">
      {img(p["sc"])}
      <div class="cbody">
        <div class="chead"><span class="mono acct">@{e(p["u"])}</span>
          <span class="pill">{p["pq"]}/{p["ncap"]} asking price</span></div>
        <p class="cap">{e(p["cap"][:150])}</p>
        <div class="cmeta mono">{lk} likes · {n(p["comments"])} comments · {share}% price-intent{e(wt)}</div>
        <a class="lnk mono" href="https://instagram.com/p/{e(p["sc"])}/" target="_blank" rel="noopener">view post ↗</a>
      </div></article>'''

# ── top chains by likes ───────────────────────────────────────────────────
tc = ""
for p in D["top_chain_likes"][:10]:
    tc += (f'<tr><td class="num strong">{n(p["likes"])}</td><td class="num">{n(p["comments"])}</td>'
           f'<td class="num">{p["pq"]}/{p["ncap"]}</td><td class="mono">@{e(p["u"])}</td>'
           f'<td class="capcell">{e(p["cap"][:88])}</td>'
           f'<td><a class="mono" href="https://instagram.com/p/{e(p["sc"])}/" target="_blank" rel="noopener">↗</a></td></tr>')

# ── ratio leaders ─────────────────────────────────────────────────────────
tr_ = ""
for p in D["top_ratio"][:10]:
    r = p["comments"] / p["likes"] * 100
    share = round(p["pq"] / p["ncap"] * 100) if p["ncap"] else 0
    tr_ += (f'<tr><td class="num strong">{r:.0f}%</td><td class="num">{n(p["comments"])}</td>'
            f'<td class="num">{n(p["likes"])}</td><td class="num">{share}%</td>'
            f'<td class="mono">@{e(p["u"])}</td><td class="cat">{e(p["cat"])}</td>'
            f'<td><a class="mono" href="https://instagram.com/p/{e(p["sc"])}/" target="_blank" rel="noopener">↗</a></td></tr>')

# ── design terms ──────────────────────────────────────────────────────────
OUT = {"tali","thali","dokiya","mangalya","black-beaded","beaded","cocktail","mangalsutra","kanti"}
IN_ = {"choco","cocoa","italian","gents","jents","cuban","curb","figaro","franco","rope"}
terms = ""
for w, k in D["terms"][:20]:
    if w in OUT:  s, cl = "women's — excluded", "tag-out"
    elif w in IN_: s, cl = "men's chain", "tag-in"
    else:          s, cl = "unconfirmed", "tag-q"
    terms += (f'<tr><td class="mono strong">{e(w)}</td><td class="num">{k}</td>'
              f'<td><span class="tag {cl}">{s}</span></td></tr>')

# ── accounts ──────────────────────────────────────────────────────────────
acc = ""
for a in D["accounts"]:
    f_ = n(a["foll"]) if a["foll"] else "—"
    acc += (f'<tr><td class="mono">@{e(a["u"])}</td><td class="num">{f_}</td>'
            f'<td class="num">{a["n"]}</td><td class="num strong">{a["chain"]}</td>'
            f'<td class="num">{n(a["med"])}</td><td class="num">{n(a["mx"])}</td>'
            f'<td class="num">{n(a["comm"])}</td>'
            f'<td class="num">{a["pq"]}/{a["ncap"] or 0}</td></tr>')

L, C, P = D["likes"], D["comm"], D["price"]

HTML = f"""<title>Chain Corpus W34</title>
<style>
:root {{
  --paper:#F3F4F1; --card:#FBFBF9; --ink:#191B17; --ink-2:#62665E; --muted:#878B82;
  --rule:#D9DBD4; --rule-2:#C3C6BD; --brass:#8A6318; --brass-b:#F0E6D0;
  --pos:#3D6B4E; --pos-b:#E2EDE5; --neg:#973828; --neg-b:#F4E3DF; --field:#FFFFFF;
  --f-mono:ui-monospace,"SF Mono",SFMono-Regular,Menlo,Monaco,"Cascadia Mono",monospace;
  --f-text:ui-serif,"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;
}}
@media (prefers-color-scheme:dark) {{ :root:not([data-theme="light"]) {{
  --paper:#151713; --card:#1C1F1A; --ink:#E9EBE3; --ink-2:#9BA094; --muted:#7C8177;
  --rule:#2D302A; --rule-2:#3D4139; --brass:#CBA355; --brass-b:#2E2718;
  --pos:#77A886; --pos-b:#1D2A21; --neg:#CE7A68; --neg-b:#2E1E1A; --field:#121410;
}} }}
:root[data-theme="dark"] {{
  --paper:#151713; --card:#1C1F1A; --ink:#E9EBE3; --ink-2:#9BA094; --muted:#7C8177;
  --rule:#2D302A; --rule-2:#3D4139; --brass:#CBA355; --brass-b:#2E2718;
  --pos:#77A886; --pos-b:#1D2A21; --neg:#CE7A68; --neg-b:#2E1E1A; --field:#121410;
}}
*{{box-sizing:border-box}}
body{{background:var(--paper);color:var(--ink);font-family:var(--f-text);font-size:17px;
line-height:1.6;margin:0;padding:0 20px 96px;-webkit-font-smoothing:antialiased}}
.wrap{{max-width:1000px;margin:0 auto}}
.eyebrow{{font-family:var(--f-mono);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin:0}}
h1{{font-family:var(--f-mono);font-size:clamp(28px,5vw,40px);font-weight:500;letter-spacing:-.02em;line-height:1.1;margin:10px 0 0;text-wrap:balance}}
h2{{font-family:var(--f-mono);font-size:13px;font-weight:600;letter-spacing:.13em;text-transform:uppercase;margin:0}}
h3{{font-family:var(--f-text);font-size:20px;font-weight:600;line-height:1.3;margin:0;text-wrap:balance}}
p{{margin:0;max-width:70ch}} .lede{{font-size:19px;line-height:1.55;color:var(--ink-2);max-width:64ch}}
.mono{{font-family:var(--f-mono);font-variant-numeric:tabular-nums}}
.num{{font-family:var(--f-mono);font-variant-numeric:tabular-nums;text-align:right}}
.strong{{font-weight:600}}
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
.barcell{{width:38%;padding-right:0}}
.bar{{display:block;height:9px;background:var(--rule-2);border-radius:1px}}
.bar.is-target{{background:var(--brass)}}
tr.is-target td{{background:var(--brass-b)}} tr.is-target td:first-child{{font-weight:600;color:var(--brass)}}
.capcell{{font-family:var(--f-text);color:var(--ink-2);font-size:13.5px;max-width:300px}}
.cat{{font-family:var(--f-mono);font-size:11px;color:var(--muted)}}
.cards{{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1px;background:var(--rule-2);border:1px solid var(--rule-2)}}
.card{{background:var(--card);display:flex;flex-direction:column}}
.thumb{{width:100%;aspect-ratio:1;object-fit:cover;display:block;border-bottom:1px solid var(--rule-2)}}
.noimg{{display:flex;align-items:center;justify-content:center;font-family:var(--f-mono);font-size:11px;color:var(--muted);background:var(--paper)}}
.cbody{{padding:14px 16px 16px;display:flex;flex-direction:column;gap:8px;flex:1}}
.chead{{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}}
.acct{{font-size:12px;color:var(--ink-2)}}
.pill{{font-family:var(--f-mono);font-size:10px;letter-spacing:.04em;padding:3px 7px;background:var(--pos-b);color:var(--pos);white-space:nowrap}}
.cap{{font-size:13.5px;line-height:1.45;color:var(--ink-2);margin:0}}
.cmeta{{font-size:11px;color:var(--muted);margin-top:auto}}
.lnk{{font-size:11px;color:var(--brass);text-decoration:none}} .lnk:hover{{text-decoration:underline}}
a{{color:var(--brass)}} a:focus-visible,tr:focus-visible{{outline:2px solid var(--brass);outline-offset:2px}}
.tag{{font-family:var(--f-mono);font-size:10px;letter-spacing:.04em;padding:3px 7px;white-space:nowrap}}
.tag-in{{background:var(--pos-b);color:var(--pos)}} .tag-out{{background:var(--neg-b);color:var(--neg)}}
.tag-q{{background:var(--brass-b);color:var(--brass)}}
.callout{{border-left:3px solid var(--brass);background:var(--card);padding:20px 22px;display:flex;flex-direction:column;gap:12px}}
.callout .t{{font-family:var(--f-mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--brass)}}
.caption{{font-family:var(--f-mono);font-size:11.5px;color:var(--muted);line-height:1.55;max-width:74ch}}
footer{{margin-top:60px;padding-top:20px;border-top:1px solid var(--rule-2);font-family:var(--f-mono);font-size:11px;color:var(--muted);line-height:1.7}}
@media (max-width:760px){{.strip{{grid-template-columns:1fr 1fr}}body{{font-size:16px}}}}
</style>
<div class="wrap">
<header class="masthead">
  <p class="eyebrow">Instagram corpus · 38 accounts · scraped 2026-08-20</p>
  <h1>Chain Corpus W34</h1>
  <p class="lede">Every post analysed, not a sample. {n(TOTAL)} posts pulled from 38 jewellery
  accounts, classified by category, then scored for engagement and buying intent. The headline
  is how little of it is the actual product.</p>
  <div class="strip">
    <div class="cell"><span class="k">Posts analysed</span><span class="v">{n(TOTAL)}</span><span class="sub">{n(D["scored"])} scoreable</span></div>
    <div class="cell"><span class="k">Gold men's chains</span><span class="v">{n(chain_n)}</span><span class="sub">{chain_n/TOTAL*100:.0f}% of corpus</span></div>
    <div class="cell"><span class="k">Median likes</span><span class="v">{L["median"]:.0f}</span><span class="sub">p90 {n(L["p90"])} · max {n(L["max"])}</span></div>
    <div class="cell"><span class="k">Price-intent</span><span class="v">{P["pct"]}%</span><span class="sub">{n(P["intent"])} of {n(P["captured"])} comments</span></div>
  </div>
</header>

<section>
  <div class="sec-head"><h2>What the corpus actually contains</h2><span class="fill"></span><span class="aside">all {n(TOTAL)} posts</span></div>
  <div class="stack">
  <p>Every post classified from its caption. Exclusions follow Kaushal's rules: silver is not our
  metal, kada is wrist not neck, dokiya and mangalya are women's.</p>
  <div class="scroller"><table>
    <thead><tr><th>Category</th><th class="num">Posts</th><th class="num">Share</th><th></th></tr></thead>
    <tbody>{cat_rows}</tbody></table></div>
  <p class="caption">"Other / unclassified" is largely festival, showroom and brand-voice posts with no
  product noun in the caption. The target category is {chain_n} posts — roughly one in six.</p>
  </div>
</section>

<section>
  <div class="sec-head"><h2>Engagement reality</h2><span class="fill"></span><span class="aside">{n(D["scored"])} scoreable posts</span></div>
  <div class="stack">
  <div class="strip">
    <div class="cell"><span class="k">Median likes</span><span class="v">{L["median"]:.0f}</span><span class="sub">mean {n(L["mean"])} — skewed by one viral</span></div>
    <div class="cell"><span class="k">Median comments</span><span class="v">{C["median"]:.0f}</span><span class="sub">mean {C["mean"]}</span></div>
    <div class="cell"><span class="k">Zero-comment posts</span><span class="v">{n(C["zero"])}</span><span class="sub">{C["zero"]/D["scored"]*100:.0f}% of corpus</span></div>
    <div class="cell"><span class="k">Posts with ≥10 comments</span><span class="v">{n(C["ge10"])}</span><span class="sub">{C["ge10"]/D["scored"]*100:.1f}%</span></div>
  </div>
  <div class="callout"><span class="t">The thing to understand before reading any ranking</span>
    <h3>{C["zero"]/D["scored"]*100:.0f}% of these posts have zero comments.</h3>
    <p style="color:var(--ink-2)">Median likes across the whole corpus is {L["median"]:.0f}. The mean of
    {n(L["mean"])} is an artefact of a single viral reel at {n(L["max"])} likes. This is a market that
    posts constantly and is almost never responded to — so any "top post" list is drawn from a very
    thin tail, and small differences between posts are noise.</p></div>
  </div>
</section>

<section>
  <div class="sec-head"><h2>Where people ask price</h2><span class="fill"></span><span class="aside">{n(P["posts_with"])} posts · {n(P["intent"])} comments</span></div>
  <div class="stack">
  <p>Comments matched against price-intent language in English, Hindi and Gujarati — <span class="mono">price</span>,
  <span class="mono">rate</span>, <span class="mono">kitna</span>, <span class="mono">ketla</span>,
  <span class="mono">કિંમત</span>, <span class="mono">कीमत</span>, <span class="mono">weight</span>,
  <span class="mono">gram</span>. {P["pct"]}% of all captured comments are buying questions.</p>
  <div class="cards">{cards}</div>
  <p class="caption">Instagram returns only the newest ~15 comments per post, so these shares are of
  what was captured, not of the full thread.</p>
  </div>
</section>

<section>
  <div class="sec-head"><h2>Comment-to-like ratio predicts buying intent</h2><span class="fill"></span><span class="aside">measured, not assumed</span></div>
  <div class="stack">
  <div class="scroller"><table>
    <thead><tr><th>Comment / like ratio</th><th class="num">Posts</th><th class="num">Comments asking price</th><th></th></tr></thead>
    <tbody>{rb}</tbody></table></div>
  <div class="callout"><span class="t">Correction — an earlier design error</span>
    <h3>High comment ratio is a buying signal, not an anomaly.</h3>
    <p style="color:var(--ink-2)">The original plan proposed filtering out posts whose comment/like ratio
    ran more than 3× the account norm, treating them as giveaways or engagement pods. That was wrong.
    The 37%-ratio post it would have deleted carries <strong>80% price-asking comments — the highest
    buying intent in all {n(TOTAL)} posts.</strong> Ratio is now ranked on, never excluded on, with a
    floor of ≥10 comments so single-comment posts don't produce noise ratios.</p></div>
  <div class="scroller"><table>
    <thead><tr><th class="num">Ratio</th><th class="num">Comments</th><th class="num">Likes</th><th class="num">Price</th><th>Account</th><th>Category</th><th></th></tr></thead>
    <tbody>{tr_}</tbody></table></div>
  </div>
</section>

<section>
  <div class="sec-head"><h2>Gold men's chains — top by reach</h2><span class="fill"></span><span class="aside">{n(chain_n)} posts in category</span></div>
  <div class="scroller"><table>
    <thead><tr><th class="num">Likes</th><th class="num">Comm</th><th class="num">Price</th><th>Account</th><th>Caption</th><th></th></tr></thead>
    <tbody>{tc}</tbody></table></div>
  <p class="caption" style="margin-top:14px">Reach and buying intent barely overlap. The accounts at the
  top of this table draw likes and almost no questions; the post that draws questions sits far down it.</p>
</section>

<section>
  <div class="sec-head"><h2>Weights stated in captions</h2><span class="fill"></span><span class="aside">{D["weights"]["n"]} mentions in {n(TOTAL)} posts</span></div>
  <div class="stack">
  <div class="scroller"><table>
    <thead><tr><th>Band</th><th class="num">Mentions</th><th></th></tr></thead>
    <tbody>{wb}</tbody></table></div>
  <p class="caption">Median {D["weights"]["median"]:.0f} g across all categories — but most of the light end is
  ladies' items and lockets, not chains. Only a handful of men's chain posts state a weight at all,
  which is exactly why the ones that do stand out.</p>
  </div>
</section>

<section>
  <div class="sec-head"><h2>Design vocabulary found</h2><span class="fill"></span><span class="aside">words before "chain"</span></div>
  <div class="stack">
  <div class="scroller"><table>
    <thead><tr><th>Term</th><th class="num">Posts</th><th>Status</th></tr></thead>
    <tbody>{terms}</tbody></table></div>
  <p class="caption">"Unconfirmed" terms need a call from Kaushal — <span class="mono">cocoa</span> and
  <span class="mono">stampado</span> in particular look like Italian machine-made chains, which is the
  exact category in question.</p>
  </div>
</section>

<section>
  <div class="sec-head"><h2>All {len(D["accounts"])} accounts</h2><span class="fill"></span><span class="aside">no sampling</span></div>
  <div class="scroller"><table>
    <thead><tr><th>Account</th><th class="num">Followers</th><th class="num">Posts</th><th class="num">Chains</th><th class="num">Median likes</th><th class="num">Max</th><th class="num">Comments</th><th class="num">Price</th></tr></thead>
    <tbody>{acc}</tbody></table></div>
  <p class="caption" style="margin-top:14px">Sorted by gold men's chain posts. Most of these are general
  jewellers — only a handful are chain-only businesses, which is why the target category is so thin.</p>
</section>

<footer>
Source: Apify run <span class="mono">WaCeKcZYzBiQI3ojm</span>, {n(TOTAL)} posts from 38 Instagram
accounts, collected 2026-08-20. Category classification is caption-based and therefore imperfect —
posts with no product noun fall to "unclassified". Price-intent is regex over the newest ~15 comments
per post that Instagram exposes, so shares are of captured comments, not full threads.
{D["hidden"]} posts return hidden like counts and are excluded from like statistics only.
Images are the posts' own thumbnails, downscaled and embedded.
</footer>
</div>"""

open(f"{BASE}/report.html", "w").write(HTML)
print(f"wrote {BASE}/report.html  ({len(HTML)/1024/1024:.2f} MB)")
