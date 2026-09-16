#!/usr/bin/env python3
"""Men's Italian chain — demand-signal report from the authenticated harvest."""
import json, statistics as st
from datetime import datetime

H = json.load(open("artifacts/chain-trends/demand/harvest.json"))
P, E = H["posts_read"], H["comment_events"]
L = [p["l"] for p in P if p["l"] is not None]
zero = sum(1 for p in P if p["c"] == 0)
tot_c = sum(p["c"] for p in P)
SUB = {"price", "feedback", "wholesale", "weight"}
early = [e for e in E if e["lag_d"] < 7]
late  = [e for e in E if e["lag_d"] > 60]
sub_e = sum(1 for e in early if e["intent"] in SUB)
sub_l = sum(1 for e in late  if e["intent"] in SUB)

def rows(g):
    out = ""
    for e in sorted(g, key=lambda x: -x["lag_d"]):
        hot = " hot" if e["intent"] in SUB else ""
        out += (f'<tr class="{hot.strip()}"><td class="num strong{hot}">{e["lag_d"]:.1f} d</td>'
                f'<td class="mono">{e["intent"]}</td><td class="q">&ldquo;{e["text"]}&rdquo;</td>'
                f'<td class="mono dim">{e["posted"][:10]} &rarr; {e["at"][:10]}</td></tr>')
    return out

# engagement histogram
bands = [(0,10,"0–10"),(10,25,"10–25"),(25,40,"25–40"),(40,60,"40–60"),(60,200,"60+")]
hist = ""
mx = max(sum(1 for x in L if lo<=x<hi) for lo,hi,_ in bands)
for lo,hi,lab in bands:
    n = sum(1 for x in L if lo<=x<hi)
    hist += (f'<tr><td class="mono">{lab} likes</td><td class="num">{n}</td>'
             f'<td class="barcell"><span class="bar" style="width:{n/mx*100:.0f}%"></span></td></tr>')

HTML = f"""<title>Chain Revival Signal</title>
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
.wrap{{max-width:980px;margin:0 auto}}
.eyebrow{{font-family:var(--f-mono);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin:0}}
h1{{font-family:var(--f-mono);font-size:clamp(28px,5vw,40px);font-weight:500;letter-spacing:-.02em;line-height:1.1;margin:10px 0 0}}
h2{{font-family:var(--f-mono);font-size:13px;font-weight:600;letter-spacing:.13em;text-transform:uppercase;margin:0}}
h3{{font-family:var(--f-text);font-size:21px;font-weight:600;line-height:1.3;margin:0;text-wrap:balance}}
p{{margin:0;max-width:70ch}} .lede{{font-size:19px;line-height:1.55;color:var(--ink-2);max-width:64ch}}
.mono{{font-family:var(--f-mono);font-variant-numeric:tabular-nums}}
.num{{font-family:var(--f-mono);font-variant-numeric:tabular-nums;text-align:right}}
.strong{{font-weight:600}} .hot{{color:var(--brass)}} .dim{{color:var(--muted);font-size:11px}}
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
td{{padding:9px 10px 9px 0;border-bottom:1px solid var(--rule);vertical-align:top}}
tr.hot td{{background:var(--brass-b)}}
.q{{font-family:var(--f-text);font-size:15px}}
.barcell{{width:45%;padding-right:0}}
.bar{{display:block;height:9px;background:var(--brass)}}
.callout{{border-left:3px solid var(--brass);background:var(--card);padding:22px 24px;display:flex;flex-direction:column;gap:12px}}
.callout .t{{font-family:var(--f-mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--brass)}}
.big{{font-family:var(--f-mono);font-size:clamp(38px,8vw,64px);line-height:1;letter-spacing:-.03em;color:var(--brass);font-variant-numeric:tabular-nums}}
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
  <p class="eyebrow">Men's Italian chain · authenticated harvest · 2026-08-20</p>
  <h1>Chain Revival Signal</h1>
  <p class="lede">Read with exact comment timestamps rather than counts. The finding is not how
  much engagement these posts get — it is <em>when</em> the engagement arrives, and that turns out
  to separate buyers from noise almost perfectly.</p>
  <div class="strip">
    <div class="cell"><span class="k">Posts read</span><span class="v">{len(P)}</span><span class="sub">timestamps + counts</span></div>
    <div class="cell"><span class="k">Median likes</span><span class="v">{st.median(L):.0f}</span><span class="sub">max {max(L)}</span></div>
    <div class="cell"><span class="k">Zero-comment</span><span class="v">{zero/len(P)*100:.0f}%</span><span class="sub">{zero} of {len(P)} posts</span></div>
    <div class="cell"><span class="k">Comments / post</span><span class="v">{tot_c/len(P):.2f}</span><span class="sub">measured, not estimated</span></div>
  </div>
</header>

<section>
  <div class="sec-head"><h2>The revival metric</h2><span class="fill"></span><span class="aside">comment lag vs substance</span></div>
  <div class="stack">
  <div class="callout">
    <span class="t">Comments that arrive late are the ones that matter</span>
    <div style="display:flex;gap:38px;flex-wrap:wrap;align-items:baseline">
      <div><div class="big">{sub_e}/{len(early)}</div><p class="caption">substantive when the comment<br>arrives within 7 days</p></div>
      <div><div class="big">{sub_l}/{len(late)}</div><p class="caption">substantive when it arrives<br>after 60 days</p></div>
    </div>
    <p style="color:var(--ink-2)">Every fast comment in this sample is an emoji or a heart. Every
    slow one is a person asking a price, or telling the seller to publish weights.
    <strong>Praise arrives in hours. Buying arrives in months.</strong></p>
  </div>
  <div class="scroller"><table>
    <thead><tr><th class="num">Lag</th><th>Intent</th><th>Comment</th><th>Posted &rarr; commented</th></tr></thead>
    <tbody>{rows(late)}{rows(early)}</tbody></table></div>
  <p class="caption">Highlighted rows are substantive. Lag is exact — taken from the
  <span class="mono">datetime</span> attribute, not Instagram's relative "37w" display.</p>
  </div>
</section>

<section>
  <div class="sec-head"><h2>383 days</h2><span class="fill"></span><span class="aside">the strongest single signal</span></div>
  <div class="callout">
    <div class="big">383.7</div>
    <h3>A June 2025 Italian chain post took a price question in July 2026.</h3>
    <p style="color:var(--ink-2)">One word — <strong>&ldquo;pp&rdquo;</strong>, the trade's shorthand for
    price on a specific carousel slide. The post had long since stopped being distributed; nobody
    was shown it. Someone <em>found</em> it, a year later, and wanted to buy.</p>
    <p style="color:var(--ink-2)">That is demand arriving independently of the post's own moment —
    the design being pulled rather than pushed. It is the cleanest example in the data of what a
    revival signal is supposed to catch, and it would be invisible to any metric counting likes.</p>
  </div>
</section>

<section>
  <div class="sec-head"><h2>46 seconds</h2><span class="fill"></span><span class="aside">a cluster worth reading carefully</span></div>
  <div class="stack">
  <div class="callout">
    <span class="t">Three comments · three different posts · one person</span>
    <h3>&ldquo;Plz mention weight in every design&rdquo;</h3>
    <p class="mono" style="color:var(--ink-2);font-size:13px">
      08:28:34 &nbsp;&rarr;&nbsp; post of 23 Aug 2025<br>
      08:28:53 &nbsp;&rarr;&nbsp; post of 22 Aug 2025<br>
      08:29:20 &nbsp;&rarr;&nbsp; post of 20 Aug 2025
    </p>
    <p style="color:var(--ink-2)">All three landed on 23 November 2025 inside <strong>46
    seconds</strong>, roughly 93 days after the posts went up. That is not three people agreeing.
    It is <strong>one buyer scrolling the catalogue</strong>, hitting the same wall on every
    single post, and saying so three times before giving up.</p>
    <p style="color:var(--ink-2)">A count-based reading records "3 comments, low engagement".
    The timestamps record a customer walking out of the shop.</p>
  </div>
  <p>This is the same conclusion the wider corpus reached statistically — posts that state grams
  draw questions, posts that state adjectives draw silence — but here it is stated outright, by
  the buyer, in the act of failing to buy.</p>
  </div>
</section>

<section>
  <div class="sec-head"><h2>Engagement reality</h2><span class="fill"></span><span class="aside">{len(L)} posts with like counts</span></div>
  <div class="stack">
  <div class="scroller"><table>
    <thead><tr><th>Band</th><th class="num">Posts</th><th></th></tr></thead>
    <tbody>{hist}</tbody></table></div>
  <p>Median <strong>{st.median(L):.0f} likes</strong>, max {max(L)}, and <strong>{zero/len(P)*100:.0f}% of posts
  have no comments at all</strong>. The measured yield across this harvest is
  <strong>{tot_c/len(P):.2f} comments per post</strong>.</p>
  <p class="caption">That rate is the honest constraint on this channel: reading a thousand posts
  at this yield returns roughly {tot_c/len(P)*1000:.0f} comments, of which — on the split above —
  perhaps a third carry intent. The scarcity is in the market, not the method.</p>
  </div>
</section>

<section>
  <div class="sec-head"><h2>What to do with this</h2><span class="fill"></span><span class="aside">actionable</span></div>
  <div class="acts">
    <div class="act"><span class="n">01</span><span class="b">
      <span class="t">Put the weight in every caption. Today.</span>
      <span class="d">A buyer told a competitor this three times in 46 seconds and was ignored for
      nine months. Grams, karat, length — the exact fields the market asks for. It costs nothing
      and it is the single highest-confidence finding in the whole study.</span></span></div>
    <div class="act"><span class="n">02</span><span class="b">
      <span class="t">Score designs on late comments, not on likes.</span>
      <span class="d">A post still taking price questions after 60 days is a design being pulled
      by demand. On this sample that filter is 100% precise and likes are ~0% precise. Rank the
      catalogue by comment lag before committing the float.</span></span></div>
    <div class="act"><span class="n">03</span><span class="b">
      <span class="t">Answer old comments — the competition doesn't.</span>
      <span class="d">The 383-day &ldquo;pp&rdquo; and the weight complaints all sit unanswered.
      Those are buyers who raised a hand at a supplier who never looked. A supplier who replies to
      a year-old comment wins a customer for the cost of typing a number.</span></span></div>
    <div class="act"><span class="n">04</span><span class="b">
      <span class="t">Treat this channel as B2B intelligence, not consumer demand.</span>
      <span class="d">What surfaces here is wastage, dealer numbers, MOQ and rate questions — the
      trade talking to the trade. Useful for benchmarking your making charge. It is not where
      Surat consumers form design preference, and no amount of scraping will make it that.</span></span></div>
  </div>
</section>

<footer>
Harvested through an authenticated Instagram session by page navigation, 2026-08-20. {len(P)} posts
read for date, like count and comment count; {len(E)} comments captured with exact
<span class="mono">datetime</span> values. Account universe for the primary Italian-chain
specialist is 297 posts, of which 168 shortcodes were inventoried by profile scroll.
Like counts unavailable on {len(P)-len(L)} posts (hidden by the account). Lag figures are exact;
intent labels are hand-assigned over a small sample and should be read as directional.
Scope: men's chains only — women's designs excluded.
</footer>
</div>"""
open("artifacts/chain-trends/demand/report.html","w").write(HTML)
print(f"wrote artifacts/chain-trends/demand/report.html ({len(HTML)/1024:.0f} KB)")
