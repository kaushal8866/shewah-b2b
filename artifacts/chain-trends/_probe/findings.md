# Probe findings — 2026-08-20

Runs: `b7vZar7JQIZOQWcXe` (hashtag, 66 posts) · `ZNPYZHDelb1kxExxp` (profile, 115 posts)

## 1. Hashtag route and profile route return DIFFERENT SCHEMAS

Not a volume difference — different fields entirely.

| Field | hashtag route | profile route |
|---|---|---|
| videoViewCount / videoPlayCount | absent | present |
| latestComments.text | absent | present |
| metaData.followersCount / biography | absent | present |
| alt (IG auto alt-text) | absent | present |

**Consequence: hashtags are for DISCOVERY only. All collection must go through profile URLs.**
Scoring off hashtag output is impossible — the engagement fields do not exist there.

## 2. `videoViewCount` is unreliable — use `videoPlayCount`

Counter-examples where views < likes (impossible):
- jainchainrajkotllp 2026-07-11 — likes 80, **videoViewCount 30**, videoPlayCount 5603
- maharaja_chains  2026-07-18 — likes 20, **videoViewCount 12**, videoPlayCount 1041

`videoPlayCount` is internally consistent across all rows. **Denominator = videoPlayCount.**

## 3. Views exist ONLY on reels — and the target accounts barely post reels

Reel share of last-90-day posts:

| account | reels | total | reel % | who |
|---|---|---|---|---|
| vishaljewellerssurat | 28 | 28 | **100%** | silver B2C retail |
| maharaja_chains | 5 | ~22 | ~23% | chain specialist |
| jainchainrajkotllp | 2 | ~24 | **~8%** | Rajkot chain manufacturer |
| rajwadijewellers | 2 | ~28 | **~7%** | Gujarat retail |

**The rate metric `ER = likes/plays` is computable on ~7-8% of posts from exactly the
accounts that matter.** The response axis is weakest precisely on the target population.

## 4. `EI` (account-normalised likes) survives, with caveats

Approx medians / maxima from the 90-day pull:
- rajwadijewellers — median ~63 likes, max 3,151. Stable denominator; EI works.
- jainchainrajkotllp — median ~6 likes, max 113. **Denominator too small**: one extra like
  moves EI ~17%. EI is computable but noisy; needs a floor rule.

## 5. Comment coverage is uneven — PQD is not universally available

- rajwadijewellers: comments present on many posts (8, 93, 52, 103, 28...) → PQD viable
- jainchainrajkotllp: **0 comments on nearly every post** → PQD unavailable
- Hashtag-sourced small accounts: single-digit comments across 66 posts → PQD unavailable

## 6. Cross-validation PASSED

Browser `og:description` for vishaljewellerssurat 27-Jan post said "13K likes, 4,664 comments".
Apify returns likes **12,554**, comments **4,669** for the same post. Agreement confirms the
free browser route is a valid verification path.

Also: that post's 37% comment/like ratio IS anomalous relative to the same account's *other*
viral post (2026-01-27, 460,927 likes / 10,581 comments = **2.3%**, normal). The anomaly
filter has a working discriminator.

## 7. Hashtag discovery yield is poor for Gujarat

66 posts → 44 distinct accounts → **~3 plausibly Gujarat**. Dominated by Malaysia
(`#916gold` is a large Malaysian tag — kedai_emas_*, chiang_heng_*, chopkonghin, tyrelljewelrymy),
Tamil Nadu, Karnataka, Maharashtra, West Bengal, plus Cyprus and USA.

Keepers found: **jainchainrajkotllp** (Rajkot Gujrat, chain manufacturer), rajwadijewellers,
maharaja_chains, r.k.ornaments.

## 8. BLOCKER for unattended running: no Apify API token locally

No `APIFY_TOKEN` in env or any `.env`. Datasets can only be read through the MCP tool, which
routes every row through the model's context. **A GitHub Actions weekly job cannot work this
way** — it needs a token so scripts can pull datasets directly.
