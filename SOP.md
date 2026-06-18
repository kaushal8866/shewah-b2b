# Shewah B2B — Standard Operating Procedures (SOP)

**Version:** 1.0 (draft)
**Last updated:** 17 April 2026
**Owner:** Kaushal (Founder, Shewah)
**Status:** Living document. Edit in-place, commit to `shewah-b2b/SOP.md`, version through git.

---

## How to Use This Document

This is not a product spec and it is not a user manual. It is the **operating doctrine** for Shewah's B2B business and the software that runs it. Three tiers live inside it:

| Tier | What it contains | How often it changes |
|---|---|---|
| **Doctrine** | The rules the business refuses to break (rate-lock, weight tolerance, credit policy, data ownership) | Rarely — quarterly at most |
| **Scope** | Which features get built in which phase | Each quarter |
| **Rituals** | Daily, weekly, monthly operator workflows | Each sprint |

When reality and this SOP disagree, update the SOP. Do not let the SOP quietly drift into fiction.

Every section is numbered so you can reference sections in git commits, Slack, or in-product tooltips (e.g. "See §7.3 for rate-lock rules").

---

# Part 1 — Foundations

## 1. Positioning & Doctrine

### 1.1 What shewah-b2b is

Shewah B2B is the **internal operations cockpit** for Shewah, a Surat-based manufacturer of lab-grown-diamond (LGD) fine rings selling wholesale to Indian retail jewelers. It is not a website. It is not a storefront. It is the system that the founder and (soon) the sales rep use every day to run the business.

In Phase 2 it opens up a narrow, controlled window for jewelers themselves to log in and reorder from it. That changes everything about governance, but it does not change the fact that the source of truth lives here.

### 1.2 What shewah-b2b is not

- It is not Tally or Zoho Books. Books export from it, but ledger truth lives in accounting.
- It is not shewah.co (the D2C Shopify store). That is a separate surface with a separate audience.
- It is not WhatsApp. WhatsApp is a rail; shewah-b2b is the system of record.
- It is not a marketplace. It never brokers jewelers to karigars, or designers to customers.

If someone ever suggests "let's just put X on shewah-b2b," check against this list. If X doesn't fit, it goes somewhere else.

### 1.3 Core beliefs the system encodes

1. **Trust is the moat.** Everything the system does should make it easier for a jeweler to trust Shewah the next time. Rate-lock, 48-hour CAD, weight transparency, hallmark records — these are not features, they are trust signals.
2. **Gold is not a number, it is a state.** Gold rate at the moment of quote, gold issued to karigar, gold returned, gold lost in wastage — each is a physical event that must have a digital record. Collapse any of them into "price" and money silently leaks.
3. **One source of truth per fact.** Partner name lives in one place. Gold rate for today lives in one place. A CAD file has one canonical version. Duplication is a bug.
4. **Audit everything that touches money or physical inventory.** If the action moves rupees, grams, or stock, it gets logged with actor + timestamp + before/after. Always.
5. **Slow writes, fast reads.** Writes should require clicks, confirmations, sometimes approvals. Reads should be one query away. Favour friction on the way in, never on the way out.
6. **India-first.** GST, BIS, karigar, IBJA rate, WhatsApp, ₹, Akshay Tritiya — not afterthoughts.

### 1.4 The three tensions you are knowingly living with

These are written here so future-you doesn't forget why the system looks the way it does.

**Tension 1: small team, big governance.** You are one founder + one rep for the next three months, but the system is being built with audit logs, approvals, and RLS as if a ten-person team used it. This is deliberate because Phase 2 opens the gate to external users (jewelers) and governance is not retrofit-able cheaply.

**Tension 2: partner portal before books.** Jewelers getting a login (Phase 2) is scheduled before clean GST invoicing (Phase 3). This means for roughly six months, PIs and tax invoices will still be produced in a parallel tool (Tally / Zoho / a printable PDF) while the portal handles everything pre-invoice. This is a conscious revenue-first choice. It is not a mistake.

**Tension 3: D2C and B2B side-by-side.** shewah.co (Shopify D2C) and shewah-b2b (internal + wholesale portal) live parallel lives. They will share catalog over time, but not yet. For now, a ring that exists in both is simply duplicated, with `b2b.product.external_sku` linking to the Shopify variant for future sync.

## 2. Roles, Auth & Governance

### 2.1 The role model

Three roles exist. No more, no fewer, in Phase 1 and 2.

| Role | Who | Auth method | Day 1 count |
|---|---|---|---|
| `owner` | Kaushal | Supabase email + password + OTP on sensitive actions | 1 |
| `rep` | Sales / CAD assistant | Supabase email + password, invite-only | 0 → 1 within 3 months |
| `partner` | A retail jeweler | Supabase magic-link (email or WhatsApp OTP) | 0 → N from Phase 2 |

A fourth role, `karigar_coordinator`, is reserved for Phase 4 when production enters the system. Do not create it earlier — the temptation to give a karigar a login will be strong and should be resisted until the karigar layer is designed.

### 2.2 Permission matrix (Phase 1 + 2)

Actions, not screens. If an action isn't in this table, it isn't available.

| Action | Owner | Rep | Partner |
|---|:-:|:-:|:-:|
| View partner list | ✅ | ✅ (assigned circuit only) | ❌ |
| Create partner | ✅ | ✅ (requires owner approval to activate) | ❌ |
| Edit partner credit limit | ✅ | ❌ | ❌ |
| View all orders | ✅ | ✅ (assigned partners only) | ❌ |
| View own orders | — | — | ✅ |
| Create order brief | ✅ | ✅ | ✅ (reorder or from catalog only) |
| Approve CAD | ✅ | ✅ | ✅ (own CAD only) |
| Issue quote (rate-lock) | ✅ | ✅ | ❌ |
| Change gold rate | ✅ | ❌ | ❌ |
| Apply discount ≤ 3% | ✅ | ✅ | ❌ |
| Apply discount > 3% | ✅ | ❌ (requires owner) | ❌ |
| Record payment received | ✅ | ✅ (flags for reconciliation) | ❌ |
| Mark order dispatched | ✅ | ✅ | ❌ |
| Mark order delivered | ✅ | ✅ | ✅ (confirm delivery) |
| Close/cancel order | ✅ | ❌ | ❌ |
| Edit catalog | ✅ | ❌ | ❌ |
| Edit settings | ✅ | ❌ | ❌ |
| Run reports | ✅ | ✅ (partial) | ✅ (own) |
| Export data | ✅ | ❌ | ❌ |
| Invite another user | ✅ | ❌ | ❌ |

Field-level redaction: reps never see other reps' commission, and never see partner payment terms beyond their assigned partners.

### 2.3 Audit log requirements

An `activity_log` table captures every write that touches money, inventory, or access. Minimum columns:

```
id, actor_id, actor_role, action, entity_type, entity_id,
before_value (jsonb), after_value (jsonb), ip, user_agent, created_at
```

Logged events (non-exhaustive):
- Partner created / credit-limit changed / tier changed
- Gold rate changed
- Quote issued (captures rate snapshot)
- Discount applied
- Order state transition (every move)
- Payment recorded
- User invited / role changed / deactivated
- Catalog product created / price field changed
- Settings changed

Retention: forever. Never purge the audit log. At scale, move rows older than 12 months to a `activity_log_archive` table but never delete.

### 2.4 Approval gates

Some actions cannot execute without owner approval. When a rep triggers one, the action enters a `pending_approval` state visible in the owner dashboard, and becomes live only after approval.

Current approval-required actions:
- Partner credit limit above ₹5L
- Discount above 3%
- New partner activation
- Order cancellation after advance received
- Refund of any amount
- Editing a historical quote (instead of issuing a new one)

### 2.5 Session & credential policy

- Owner account: 2FA mandatory (TOTP via authenticator app)
- Rep account: 2FA strongly recommended; mandatory from Phase 2
- Partner account: magic link only, no password to phish
- Session length: 8 hours for owner/rep, 30 days for partner (rolling)
- Password reset: email link, invalid after 30 minutes, single-use
- Failed login: 5 attempts → 15 minute lockout, log to activity_log

### 2.6 Row-Level Security (RLS)

Every Supabase table has RLS enabled. No exceptions. Policies follow one of these templates:

- **Owner-only:** `auth.jwt() ->> 'role' = 'owner'`
- **Owner + assigned rep:** `owner OR (rep AND assigned_to = auth.uid())`
- **Owner + rep (no restriction):** `role IN ('owner', 'rep')`
- **Partner-own:** `role = 'partner' AND partner_id = auth.jwt() ->> 'partner_id'`

The current codebase has `middleware.ts` as a passthrough. Before inviting the first rep, every table MUST have RLS enabled and tested. This is non-negotiable.

---

# Part 2 — The Build

## 3. Scope & Phasing (12-Month Roadmap)

The build is divided into five phases. Each phase ends with a production release, documented in `CHANGELOG.md`, and a re-read of this SOP.

### Phase 0 — Harden What's Built (Weeks 1-3)

Not new features. This is making what already exists safe.

- Enable RLS on all tables, write and test policies
- Enforce auth in `middleware.ts` (currently passthrough — a real security gap)
- Add `activity_log` table and wire all write actions through it
- Add role column to `auth.users` and seed `owner`
- Move secrets into Vercel environment variables (audit `NEXT_PUBLIC_*` for anything that shouldn't be public)
- Add basic backup: Supabase daily snapshot + weekly SQL dump to S3/R2

Exit criterion: a second Supabase user can be created with role `rep`, they cannot see owner-only data, and every action they take shows up in the audit log.

### Phase 1 — Internal Governance (Months 1-3)

Builds on the existing 9 modules and adds the governance layer.

- Approval gates for the 6 actions listed in §2.4
- Rate-lock engine formalised (see §7) — quote-time rate snapshot, validity window, re-quote flow
- Discount authority with automatic owner approval request
- Quote / PI as a first-class entity (separate from Order) with PDF export
- Notifications: email + WhatsApp template trigger on state transitions
- Basic reports: gold locked in open orders, aged receivables (manual entry), circuit performance
- Catalog: photo upload via Supabase Storage, multiple angles, specs validation
- Invite flow for rep (email magic link)

Exit criterion: you can onboard the sales rep, hand them a phone, and they can log one week of work without you watching.

### Phase 2 — Partner Self-Serve Portal (Months 4-6)

The external-facing portal. This is the biggest build in the roadmap.

- Partner login via WhatsApp OTP (magic link as fallback)
- Partner-scoped catalog (only what's visible to that tier; prices shown with their discount slab)
- Reorder flow (one-tap to recreate a past order with same specs)
- New-order flow (from catalog, not custom — custom stays inquiry-only)
- Order tracking dashboard for partner (state + ETA, not internal notes)
- CAD approval via partner login (replaces WhatsApp back-and-forth; retains full thread)
- Payment upload (UPI proof, bank transfer ref) — reconciled by owner/rep
- Support inbox (partner sends message, lands in owner queue)

Exit criterion: three pilot jewelers are placing repeat orders through the portal without WhatsApp handholding.

### Phase 3 — Books, GST & Invoicing (Months 7-9)

- PI (proforma invoice) → Tax Invoice → E-way bill flow
- HSN codes, GST slabs baked in (3% on jewelry, appropriate on LGD)
- Tally/Zoho Books export (Day-book CSV or XML, monthly)
- TCS handling above ₹50L threshold per partner per FY
- Payment ledger per partner with ageing
- GSTR-1 data prep (outward supplies summary)

Exit criterion: CA can file GST from exports without manual rework. Books reconcile against Supabase on month-end within ±₹500.

### Phase 4 — Karigar & Production (Months 10-12)

- Karigar directory (name, PAN, UPI, GST status if any)
- Job card entity: order → job card → karigar assignment
- Gold issue (out): weight, purity, value, signed docket
- Gold return (in): actual weight, wastage %, loss charged (or absorbed)
- Karigar ledger: labour payable per piece, weekly/monthly settlement
- BIS hallmarking status per piece
- QC checklist digital

Exit criterion: a piece can be traced from `order_id` to the karigar who made it, gold in/out grams, and hallmark number — within two clicks.

### Phase 5 — Future (post-Month 12)

Ordered by likelihood, not commitment.

- CAD file upload + viewer (STL/OBJ preview, version history)
- Designer royalty marketplace ("Redbubble for fine jewelry" — the original vision)
- D2C sync with shewah.co Shopify store (shared catalog, inventory reserve)
- Second-branch stock management
- Repair / rework / buyback flows
- Mobile app (PWA first, native later)

## 4. Data Model Principles

Entity-level, not column-level. Column schema lives in `supabase/schema.sql` and migrations.

### 4.1 Core entities

```
Partner (jeweler)
  ├── has many Contacts
  ├── has many Orders
  ├── belongs to a Tier (A / B / C)
  ├── belongs to a Circuit
  └── has one Credit Policy

Order
  ├── belongs to a Partner
  ├── has many Order Lines
  ├── has many CAD Requests (0..N)
  ├── has one Quote (0..1, active)
  ├── has many Payments
  └── moves through a State Machine

Quote
  ├── belongs to an Order
  ├── snapshots Gold Rate at time of issue
  ├── has expiry (rate-lock window)
  └── can be superseded by a new Quote (old one goes to version history)

Product (Catalog)
  ├── has many Product Images
  ├── has many Product Variants (metal purity × stone × size)
  └── has a Pricing Formula config

Gold Rate
  ├── is a time-series (daily or on-demand)
  ├── source: manual | IBJA | API
  └── frozen into each Quote

Circuit
  ├── is a planned trip
  ├── has many Visits
  └── belongs to a Rep

Visit
  ├── belongs to a Circuit
  ├── belongs to a Partner
  └── has outcome notes

Payment
  ├── belongs to an Order (or to a Partner directly for on-account)
  ├── is either Advance or Final
  └── has a reconciliation_status

Activity Log
  └── records every write-action across all entities
```

### 4.2 Principles

1. **Immutable history.** Once a quote is issued, you never edit it. You supersede it with a new one. Same for invoices later.
2. **Snapshot on commit.** Gold rate is snapshotted into the quote. Partner tier is snapshotted into the order (if the jeweler gets upgraded next week, the in-progress order keeps its original terms). This prevents retroactive drift.
3. **Soft delete, never hard.** No `DELETE` in production. Use `deleted_at` timestamps. For compliance and trust, you must be able to answer "what did this record look like on 12 March" for years back.
4. **Money as paise.** Store all money in integer paise (₹1 = 100). Never float. Never rupees-with-decimals. Format only at the UI layer.
5. **Weight as milligrams.** Gold weight stored as integer milligrams. A 5.342 g ring is 5342 mg. No float arithmetic on gold.
6. **Time as UTC, display as IST.** Database stores UTC. UI renders in Asia/Kolkata. Never mix.
7. **FK constraints on.** Every relationship is a hard FK. `ON DELETE RESTRICT` everywhere except audit-log-adjacent tables. Your data integrity is your balance sheet integrity.

### 4.3 Key derived values (computed, not stored)

- Order total = sum of order lines at quote-locked rate
- Partner outstanding = sum of unpaid invoices by partner
- Gold locked = sum of gold-weight × rate across all active orders in production
- Conversion rate per circuit = closed orders / unique visits

Compute these in views or read-side aggregates. Do not denormalize them into the main tables — they go stale.

## 5. Non-Functional Standards

| Concern | Standard |
|---|---|
| **Availability** | 99.5% uptime target Phase 1-2. Supabase + Vercel handle this as long as you don't deploy broken code at 11pm on a Saturday. |
| **Performance** | Dashboard loads < 2s on 4G from a mid-range Android in Surat. Partner portal loads < 3s. |
| **Data residency** | Supabase project region: `ap-south-1` (Mumbai). Non-negotiable for Indian business and DPDP compliance. |
| **Backup** | Supabase daily snapshot + weekly SQL dump off-platform (R2 / S3). Restore drill: once a quarter. |
| **Error tracking** | Sentry from Phase 1. Free tier is enough for your scale. |
| **Observability** | Supabase logs + Vercel logs. A `logs` table of your own is only needed from Phase 3. |
| **Accessibility** | WCAG 2.1 AA for partner portal (external users). Internal ops can relax. |
| **Mobile** | Responsive first. Owner will use laptop; rep will use phone 80% of the time. |
| **Browser support** | Latest Chrome, Safari, Edge. Do not spend a minute on IE or old Android stock browsers. |
| **Security baseline** | RLS on every table. CSRF tokens on forms. CSP headers. No secrets in client bundles. |

---

# Part 3 — Business Doctrine

## 6. The Gold Rate Doctrine

Gold pricing is the single most opinionated thing Shewah does. This section is the rulebook.

### 6.1 Rate source

Primary: **IBJA AM rate** (India Bullion & Jewellers Association, published ~11:00 IST each business day).
Fallback: manual owner entry if IBJA is unavailable or the owner wants to use a specific rate (e.g. matching a competitor for a key account).

The system stores both `source` ('ibja' | 'manual') and `as_of` timestamp.

### 6.2 Purity multipliers

Stored in Settings, not hardcoded.

| Purity | Multiplier | Notes |
|---|---|---|
| 24K | 1.0000 | Reference (IBJA quotes 24K) |
| 22K | 0.9166 | BIS916 hallmark |
| 18K | 0.7500 | BIS750 hallmark — **default for Shewah LGD rings** |
| 14K | 0.5850 | BIS585 hallmark |

### 6.3 Rate lock window

When a quote is issued to a jeweler, the gold rate is **locked for 72 hours**. This is the rate-lock window.

Rules:
1. If advance is received within 72 hours → rate holds for the full order, no matter what gold does.
2. If 72 hours pass without advance → quote is **auto-marked `expired`**, partner sees "Quote expired, request re-quote".
3. If the partner asks for a re-quote, system issues a new Quote at current rate. Old quote is archived (never deleted).
4. If gold moves **more than 3% up or down** during the lock window, the owner gets a dashboard flag. Owner can choose to honour, renegotiate, or cancel. System does not decide for them.

### 6.4 Making charge

Making is a percentage applied on gold value, tiered by design complexity.

| Complexity | Making % | Examples |
|---|---|---|
| Simple | 8% | Solitaire band, single-stone minimal |
| Medium | 14% | Halo, three-stone, basic pavé |
| Complex | 22% | Full pavé, filigree, cluster, custom sculpt |

Each Catalog product carries its own complexity tag. One-off custom orders are tagged at intake by the owner.

### 6.5 LGD stone pricing

LGD diamonds are priced separately, not via gold. Per-carat cost comes from the active stone supplier's price list, stored in Settings. Recorded on the quote as a line-item with `stone_cost_per_ct × ct_weight`.

### 6.6 Wastage

Baseline 2%. Overridable per product. Never zero — gold is lost in melting and polishing, and claiming 0% wastage to a jeweler who has been in this trade for 30 years ruins credibility.

### 6.7 Trade margin

Phase 1 default: 15%. Configurable per partner tier (see §8).

### 6.8 The final quote formula

For one order line:

```
Gold Value        = gold_weight_mg × purity_multiplier × (ibja_rate_per_g / 1000)
Wastage           = Gold Value × wastage_pct
Making            = (Gold Value + Wastage) × making_pct
Stone             = stone_weight_ct × stone_rate_per_ct
Subtotal          = Gold Value + Wastage + Making + Stone
Trade Margin      = Subtotal × trade_margin_pct
Pre-Tax           = Subtotal + Trade Margin
GST (3%)          = Pre-Tax × 0.03
Final             = Pre-Tax + GST
```

This formula is implemented once in `lib/pricing.ts` and never duplicated. Every place that displays a price calls it. If it's wrong, it's wrong in one place.

## 7. Pricing & Margin Doctrine

### 7.1 Partner tiers

| Tier | Qualifying criteria | Trade margin shown | Credit ceiling | Notes |
|---|---|---|---|---|
| **A** | ≥ ₹25L lifetime or ≥ ₹5L per quarter for 2 quarters | 10% (favourable) | ₹10L | Owner approval not required for standard orders |
| **B** | ≥ ₹5L lifetime | 15% (default) | ₹5L | Default for most |
| **C** | New / under ₹5L lifetime | 15% + case-by-case additive | ₹1L | All orders reviewed; COD preferred |

Tier is reviewed quarterly, not per-order. Upgrades are automatic on threshold; downgrades require owner click.

### 7.2 Discount authority

- Rep: up to **3%** on any single order, unlimited frequency, all logged.
- Owner: any amount, but anything above **8%** requires a recorded reason in activity_log.
- Partner-side: partners never "apply a discount" themselves. They can request one; it goes to owner queue.

### 7.3 MOQ & COQ

- **Minimum Order Quantity (MOQ):** ₹50,000 per order for tier A/B. ₹30,000 for tier C. Below this, system requires an override reason.
- **Credit Order Ceiling (COQ):** the partner's ceiling from §7.1. Orders that push partner above their COQ auto-route to owner approval.

### 7.4 MOQ and COQ are not the same thing

- MOQ = "this single order is too small to be worth manufacturing."
- COQ = "this partner already owes us too much."

Both exist because one measures effort, the other measures risk.

## 8. Credit & Receivables Doctrine

### 8.1 Payment terms by tier

| Tier | Advance required | Balance due by |
|---|---|---|
| A | 30% | 15 days after dispatch |
| B | 50% | 7 days after dispatch |
| C | 100% (COD / full advance) | — |

### 8.2 Ageing buckets

Receivables are bucketed at `dispatch_date + terms_days`:

- **Current** — not yet due
- **0-7 days overdue** — soft reminder (WhatsApp template)
- **8-30 days overdue** — owner call + WhatsApp
- **31-60 days overdue** — tier freeze (cannot place new orders)
- **60+ days overdue** — escalation (legal notice template, collection)

The "tier freeze" is automatic. The partner's status in the system flips to `credit_hold`, all new-order buttons disable, with a clear message to both rep and partner.

### 8.3 Advance refund policy

- Before CAD delivery: 100% refund, within 5 business days
- After CAD delivered, before production: 80% refund (20% covers CAD work)
- After production started: **no refund**, but piece becomes available for another buyer; if resold, 50% of advance refunded

This must be visible on every PI and on the partner portal.

---

# Part 4 — Lifecycles

## 9. Order Lifecycle SOP

### 9.1 The state machine

```
DRAFT
  └→ BRIEF_RECEIVED
       └→ CAD_IN_PROGRESS
            ├→ CAD_SENT
            │    ├→ CAD_APPROVED → QUOTE_ISSUED
            │    │                  ├→ ADVANCE_RECEIVED → IN_PRODUCTION
            │    │                  │                       └→ HALLMARKING → QC
            │    │                  │                                           ├→ QC_PASSED → DISPATCHED → DELIVERED → CLOSED
            │    │                  │                                           └→ QC_FAILED → IN_PRODUCTION (rework)
            │    │                  └→ QUOTE_EXPIRED (auto after 72h)
            │    └→ CAD_REJECTED → CAD_IN_PROGRESS (v2, v3 free; v4+ chargeable)
            └→ ABANDONED (timeout or partner drop-off)

  (at any point before IN_PRODUCTION) → CANCELLED (requires owner if advance received)
```

### 9.2 State transitions — who, what's required

| From → To | Who can move | Required |
|---|---|---|
| DRAFT → BRIEF_RECEIVED | Owner / Rep / Partner | Brief fields complete (see §10.2) |
| BRIEF_RECEIVED → CAD_IN_PROGRESS | Owner / Rep | CAD designer assigned, deadline set |
| CAD_IN_PROGRESS → CAD_SENT | Owner / Rep | CAD file uploaded (render at minimum) |
| CAD_SENT → CAD_APPROVED | Partner (own), Owner, Rep | Explicit click or partner reply |
| CAD_SENT → CAD_REJECTED | Partner, Owner, Rep | Reason captured |
| CAD_APPROVED → QUOTE_ISSUED | Owner / Rep | All pricing fields valid, rate locked |
| QUOTE_ISSUED → ADVANCE_RECEIVED | Owner / Rep | Payment record created + reconciled |
| ADVANCE_RECEIVED → IN_PRODUCTION | Owner / Rep | Karigar assigned (Phase 4 enforces; Phase 1-3 optional) |
| IN_PRODUCTION → HALLMARKING | Owner / Rep | Piece completed weight recorded |
| HALLMARKING → QC | Owner / Rep | Hallmark number captured |
| QC → QC_PASSED | Owner | Checklist items all green |
| QC → QC_FAILED | Owner | Failure reason captured |
| QC_PASSED → DISPATCHED | Owner / Rep | Dispatch doc + tracking ref |
| DISPATCHED → DELIVERED | Owner / Rep / Partner | Delivery confirmation (POD or partner click) |
| DELIVERED → CLOSED | Auto, after 7 days if no dispute | — |

### 9.3 SLAs per state (targets, not contracts)

- BRIEF_RECEIVED → CAD_SENT: **48 hours** (the Shewah promise)
- CAD_SENT → CAD_APPROVED: partner's time (chased at 24h, 48h, 72h)
- QUOTE_ISSUED → ADVANCE_RECEIVED: 72h (rate-lock window)
- ADVANCE_RECEIVED → DISPATCHED: **10 business days** for standard, **15** for complex
- DISPATCHED → DELIVERED: 3 business days pan-India (insured courier)

### 9.4 Notifications per transition

Every state transition fires an event. Event → channel matrix:

| Transition | Email | WhatsApp | In-app |
|---|:-:|:-:|:-:|
| BRIEF_RECEIVED | — | ✅ (to partner) | ✅ |
| CAD_SENT | — | ✅ | ✅ |
| CAD_APPROVED | — | ✅ (internal) | ✅ |
| QUOTE_ISSUED | ✅ (PI attached) | ✅ | ✅ |
| ADVANCE_RECEIVED | ✅ (receipt) | ✅ | ✅ |
| IN_PRODUCTION | — | ✅ | ✅ |
| DISPATCHED | ✅ (with tracking) | ✅ | ✅ |
| DELIVERED | — | ✅ (thank-you) | ✅ |

WhatsApp uses templated messages (see §20 for template list). Email is optional fallback for partners who want it.

## 10. CAD Lifecycle SOP

### 10.1 The 48-hour promise

When a jeweler submits a brief before 6pm IST on a business day, they see a CAD render by 6pm two business days later. This is the single most distinctive operational claim Shewah makes. Guard it fiercely.

### 10.2 Brief intake — required fields

Nothing moves to CAD_IN_PROGRESS without:
- Design intent (prose description, reference images)
- Metal: purity (14K / 18K / 22K)
- Target stone weight (ct) and shape (round / oval / emerald / princess / pear / cushion)
- Finger size (IS/UK) — optional but preferred
- Budget band (₹X-Y) — optional, helps CAD calibrate
- Occasion / timeline (helps prioritise)
- Who the end-buyer is (partner's customer) — for context only

### 10.3 CAD deliverable format

- **Always:** 3 high-res renders (top, side, 3/4) in PNG at 2000px wide
- **On approval:** STL/STEP file (for karigar)
- Watermark: "Shewah — not for reproduction" on pre-approval renders

STL/STEP files are **never** sent before approval and advance. Shewah owns the CAD IP.

### 10.4 Revision rules

- **v1-v3 free** (standard expectation: first render is 80%, round 2 refines, round 3 closes it).
- **v4 onwards**: ₹1,500 per revision, payable upfront. Partner sees a clear message on request of v4.
- **After 14 days of inactivity** between v1 and approval, CAD request auto-archives. Reactivating requires new brief.

### 10.5 Ownership

Every CAD file Shewah produces is Shewah's IP. The partner buys the *piece*, not the CAD. Partner can reorder the same CAD, but cannot demand the file. This is a clear clause on the quote and on the portal T&Cs.

## 11. Partner CRM SOP

### 11.1 Lead sources

Tracked against every new Partner:
- Instagram DM (@shewah.co)
- WhatsApp inbound
- Referral (name the referrer)
- Walk-in (Surat office)
- Circuit visit (rep-originated)
- Website form (shewah.co contact)
- Trade exhibition (IIJS, etc. — name the show)

### 11.2 Hot / Warm / Cold criteria

Not vibes. Criteria, re-evaluated every Monday.

| Status | Criteria | Follow-up cadence |
|---|---|---|
| **Hot** | Inquired in last 14 days, or order in last 30 | Every 3-5 days |
| **Warm** | Inquired in last 60 days, no conversion yet | Every 2 weeks |
| **Cold** | No activity in 60+ days | Monthly check-in, quarterly offer |

A partner who has ordered before but is now cold goes into a separate `dormant_customer` segment, which gets different (softer) re-engagement.

### 11.3 Circuit assignment

A Circuit is a pre-planned trip: a set of partners in a geographic cluster, visited in sequence by the rep, over a few days.

- Each active Partner is assigned to a home circuit based on pincode.
- Each Circuit has a default frequency (monthly for Tier A, quarterly for Tier B, on-demand for Tier C).
- A visit's outcome captures: partner met? new order discussed? CAD shown? follow-up needed? next visit date.

### 11.4 Dormancy

- 60 days no contact (any direction) → auto-flag.
- 120 days → owner alert, demand a decision (reactivate or archive).
- 365 days → archive. Data stays (GDPR-style), but partner no longer appears in active lists.

### 11.5 Data hygiene rules

- Every Partner has exactly one `primary_contact`. Others are `additional_contact`.
- Phone numbers stored in E.164 format (+91XXXXXXXXXX). No exceptions. This is how WhatsApp integration works downstream.
- Pincode validated against a stored India pincode list.
- GSTIN validated with checksum + prefix matches state.

## 12. Production & Dispatch SOP

This section is deliberately thin until Phase 4. It captures current manual practice so it's ready to digitise.

### 12.1 Today's reality (Phase 1-3)

Production = "the piece is with a karigar." No software representation beyond the order state. You track it in a physical notebook, WhatsApp with karigar, and a manila folder per piece.

### 12.2 Minimum enforced now

Even without a production module:
- Weight of the finished piece is recorded in the Order before DISPATCHED.
- Hallmark number (BIS UID) is recorded — required field, not optional.
- QC checklist (below) is signed off by owner before DISPATCHED.

### 12.3 QC checklist

Every piece, before dispatch:
- [ ] Weight matches quote ± 0.05g tolerance
- [ ] Hallmark number stamped and photographed
- [ ] Stones secure (gentle pressure test)
- [ ] Surface finish consistent, no burrs or polish marks
- [ ] Size within ± 0.25 mm of spec
- [ ] LGD certificate (IGI/GIA/SGL) matches the stone installed
- [ ] Packaging: branded box, velvet pouch, cleaning cloth, certificate envelope

### 12.4 Dispatch

- Insured courier only. Phase 1 partners: **Sequel Logistics** (jewelry-specialist, door-to-door, insured).
- E-way bill mandatory for consignments > ₹50,000 (almost all Shewah orders).
- Dispatch doc (3 copies) generated from system — 1 with package, 1 filed, 1 scanned into Order.
- Tracking reference entered into Order before state moves to DISPATCHED.
- Signed POD required for state to move to DELIVERED (or partner confirms via portal).

### 12.5 Insurance

Transit insurance via Sequel's included cover up to declared value. Declared value = quote's pre-tax amount (never over-declare; Sequel will refuse claims beyond stated). For orders > ₹5L, a rider policy is purchased separately.

## 13. Partner Portal SOP (Phase 2)

### 13.1 What the portal shows a jeweler

- **Home:** snapshot of their account — open orders, pending CAD approvals, outstanding balance, next circuit visit
- **Catalog:** only products tagged `visible_to_partners`, with their tier's pricing
- **New order:** from catalog only. Custom work goes through the old brief flow (captured in portal, but same 48h workflow).
- **Reorder:** one-click from any past order. System copies specs, prompts for any updates.
- **Orders:** list + filter, drill-in to each, see state, CAD renders (watermarked until approved), PI, advance received, dispatch tracking.
- **Documents:** downloadable PIs, invoices (Phase 3), BIS certs, LGD certs.
- **Support:** inbound message inbox (they message Shewah, Shewah responds — thread visible both sides).
- **Settings:** billing address, GSTIN, contacts, notification preferences.

### 13.2 What the portal does NOT show

- Other partners' data (obvious, but stated)
- Cost breakdown of Shewah's margin
- Internal order notes, karigar assignments
- Rep's visit notes
- Dashboard/analytics beyond their own account
- Gold rate source or breakdown (they see the locked quote total, not the IBJA math)

### 13.3 Onboarding flow

- Owner/Rep creates Partner record + primary contact.
- System sends WhatsApp invite: "Welcome to Shewah — tap to access your portal" + magic link.
- Partner taps, verifies OTP, lands on Home. First-time guide shown (3 screens max).
- Partner optionally adds secondary contacts (up to 3 per Partner account).

### 13.4 Portal governance

- All actions a partner takes are audit-logged, same table.
- Rate-limit: new-order submissions capped at 10/hour per partner (prevents accidents or abuse).
- Chargeback-style safety: any order > 2× the partner's recent average triggers owner email before confirming.

---

# Part 5 — Books & Compliance

## 14. Books, GST & Invoicing (Phase 3 Deep, Phase 1-2 Shallow)

### 14.1 Phase 1-2 stance

Until Phase 3 ships, clean books live in Tally (or Zoho Books, whichever the CA uses). The system produces a **PI** (proforma invoice) as a PDF with the correct math, but the **tax invoice** is cut separately in Tally. Monthly, the owner exports a Shewah-side sales summary and cross-checks against Tally.

### 14.2 Phase 3 build

- **PI** (proforma) — already a system artefact
- **Tax Invoice** — new entity, separate from Order & PI, immutable once issued, numbered per FY
- **Credit Note** — for returns/refunds/adjustments
- **E-way bill** — generated on dispatch for ≥ ₹50K
- **TCS** — tracked per partner per FY, applied above ₹50L cumulative, reported in GSTR

### 14.3 GST the rules that matter

- Jewelry HSN **7113** — GST **3%**
- Rough / polished diamond HSN **7102** / **7103** — GST **0.25%** / **1.5%** (check current — verify with CA)
- Making charges — part of jewelry value, taxed at 3% (not separately at 5%, per CBIC clarification)
- RCM (reverse charge) on gold / services from unregistered persons — applicable for karigars below GST threshold. Worth discussing with CA before Phase 4.
- Place of supply: intra-state (Gujarat) vs. inter-state (rest of India). Tax split is CGST+SGST vs. IGST — system auto-handles based on partner's state.

### 14.4 Tally/Zoho export format

Monthly export, CSV or Tally XML, with:
- Invoice date, number, partner name + GSTIN
- Taxable value
- CGST, SGST, IGST split
- HSN
- Shipping charges (if any, separately taxed)
- Cess (if applicable)
- Total

One export per month. Imported into Tally/Zoho by CA. Reconciliation target: zero mismatches.

## 15. Audit & Compliance Rituals

Quarterly:
- Partner KYC review — PAN + GSTIN still active?
- Stale CAD cleanup (archive 6m+ untouched drafts)
- Backup restore drill (spin up a read replica from snapshot, query a known record)
- Access review — who has logins, who still needs them

Annually:
- GST return cross-check — system totals vs. filed returns
- BIS license renewal (if applicable to Shewah's direct hallmarking)
- Insurance policy renewal (transit + inventory)
- CA audit + management accounts

Event-driven:
- Security incident (failed login spike, suspicious activity) — within 48h
- Data breach — within 72h per DPDP Act
- Rep offboarding — within 24h revoke session + RLS disable

---

# Part 6 — Operations

## 16. Daily / Weekly / Monthly Rituals

### 16.1 Daily — Owner morning (15 minutes)

1. Lock today's gold rate (IBJA or manual)
2. Review **orders with CAD overdue > 36h** — any red flags?
3. Review **yesterday's dispatches** — any delivery confirmations pending?
4. Review **pending approvals** (discount > 3%, credit > ₹5L, etc.)
5. Clear WhatsApp Business inbox to zero; route to system where applicable

### 16.2 Daily — Rep morning (10 minutes)

1. Check assigned circuit for today — any visits scheduled?
2. Review Hot partners with no contact in 5+ days — schedule outreach
3. Review assigned orders in IN_PRODUCTION — any karigar updates to log?

### 16.3 Daily — End-of-day close

- Owner: activity log summary in dashboard — anything that shouldn't have happened?
- Rep: visit notes entered, WhatsApp logged, no partner left without a next step.

### 16.4 Weekly — Monday planning (60 minutes)

- Re-evaluate Hot/Warm/Cold statuses (automated, owner confirms)
- Plan next circuit run for rep (partners to visit, KPIs to hit)
- Catalog refresh — any products to retire, new photos to add, pricing drift?
- Open orders review — anything stuck > 2 weeks? Why?

### 16.5 Weekly — Friday reconciliation (45 minutes)

- Bank statement vs. system's Payments table (Phase 1-2: manual; Phase 3: semi-automated)
- Outstanding receivables — manually age, flag 30+ day defaulters
- Karigar dues (Phase 4; until then, parallel notebook)

### 16.6 Monthly — First working day (half-day)

- Export sales to Tally/Zoho (see §14.4)
- Partner tier recomputation — any upgrades/downgrades?
- Report pack: revenue, gross margin, order count, CAD-to-order conversion, circuit ROI, dormant partner count
- Update this SOP — anything changed in doctrine or scope?

### 16.7 Quarterly — Planning day (full day)

- Partner KYC review
- Phase progress vs. roadmap — what's shipping next quarter?
- SOP review — full read-through, redline proposed, commit changes
- Salary / commission review (when rep exists)

## 17. Failure Mode Playbook

Every business system is tested by its failures. Each of these has a documented response. If it happens and the response wasn't here, the response goes here before the next shift.

### 17.1 Gold rate moves > 3% during lock window

- System flags owner dashboard (not partner).
- Owner decides per order: **honour** (absorb loss, good for key account), **renegotiate** (personal call to partner), or **cancel before advance** (refund fully).
- Decision captured in order notes. Activity log records which.
- If market panic (> 5% intra-day), a `market_event` flag can pause new quotes for manual rate entry.

### 17.2 Karigar returns gold short > 0.05g

- System accepts return with flagged status.
- If shortfall < 0.20g and within karigar's year-to-date tolerance: log loss, absorb.
- If shortfall > 0.20g: owner conversation, written explanation from karigar, deduction from next settlement.
- Repeated incidents (3 in a quarter) trigger karigar review. Relationship > record, but records matter.

### 17.3 Stone breaks in setting

- Replacement sourced from stone supplier. Cost borne by:
  - Shewah if due to setting practice
  - Karigar if due to negligence (rare; usually collaborative)
  - Never the partner, unless design was explicitly fragile and flagged at CAD stage
- Activity log captures incident. A `stone_incidents` counter is a KPI for supplier + karigar review.

### 17.4 BIS hallmark rejected

- Piece returns from hallmarking with reject (purity mismatch, stamp fail, etc.)
- Order state rolls back: HALLMARKING → IN_PRODUCTION.
- Root-cause investigated (alloy mix? scale drift? stamping cell?)
- If frequent, karigar's process reviewed.

### 17.5 Partner rejects piece on delivery

- Defined return window: 72 hours from POD, photographic evidence required.
- Valid rejection reasons (pre-agreed):
  - Visible damage in transit (insurance covers)
  - Specs mismatch from approved CAD (Shewah bears)
  - Hallmark/stone cert mismatch (Shewah bears)
- Invalid reasons: "my customer changed their mind" — this is between partner and their customer, not Shewah's problem. Stated on PI.
- Piece returns via insured courier, QC-re-inspected, either reworked or returned to inventory.

### 17.6 Partner defaults on payment

- Automatic tier freeze at 30 days overdue (§8.2).
- At 60 days: owner personal call + formal demand letter (template in system).
- At 90 days: CA + legal notice. Partner moved to `archived_defaulted`.
- Even when defaulted, data is preserved. History is history.

### 17.7 Data loss / Supabase outage

- RPO (recovery point): ≤ 24h (daily snapshot)
- RTO (recovery time): ≤ 4h (documented restore script)
- Comms plan: WhatsApp broadcast to active partners if customer-facing outage > 2h
- Parallel notebook: during outage, operations continue on paper, synced back within 24h of recovery

### 17.8 Rep does something they shouldn't

Examples: edits a quote without approval gate (bug), exports partner list (should be blocked), creates partner with fake GSTIN.

- Activity log surfaces the event (assumes logging is built — it will be).
- Conversation first, formal warning second, access revoked third.
- Never make this about the rep before making it about the system. If the system let it happen, the system is broken.

### 17.9 Accidental delete / wrong update

- Soft delete only (§4.2). Every row can be restored via `deleted_at = null`.
- Owner UI has an "Undo last action" for the last 5 minutes of their session.
- For writes older than 5 minutes: owner fills an `incident` form, explains, reverses from activity_log data. Logged.

## 18. Onboarding a New User (Rep)

When a rep joins, the following happens in this exact order:

1. **Personal:** NDA + offer letter signed (physical, outside this system)
2. **Supabase:** Owner creates `auth.users` record with role `rep`
3. **Assignment:** Circuit(s) assigned, partners visible to them established
4. **Device:** Shewah-issued phone (or BYOD with MDM if that's the policy)
5. **Accounts:** Shewah email, WhatsApp Business invite
6. **Training:** 2 days shadowing owner, 1 day on SOP read-through (this document)
7. **First week:** Every action reviewed end-of-day
8. **30-day review:** Access tightened or broadened based on what they actually need
9. **Offboarding (when applicable):** revoke Supabase session + role flip to `archived_rep` within 4 hours of decision, device returned, data exported for handover

---

# Part 7 — Strategic

## 19. Integration & Future Roadmap

### 19.1 Integrations — current and planned

| System | Role | Phase | Direction |
|---|---|---|---|
| **WhatsApp Business API** | Primary comms rail | Phase 1 | Outbound templated + inbound webhook |
| **Supabase Storage** | Catalog images, CAD renders | Phase 1 | Internal |
| **Razorpay** | Advance + balance payment collection | Phase 2 | Outbound link, webhook for payment received |
| **Tally / Zoho Books** | Source of truth for books | Phase 3 | Outbound export (CSV/XML) |
| **Sequel Logistics / Brinks** | Jewelry-specialist dispatch | Phase 1 manual, Phase 3 API | Outbound ship-book, webhook for tracking |
| **IBJA rate feed** | Daily gold rate | Phase 1 manual, Phase 3 scrape | Inbound |
| **Shopify (shewah.co)** | D2C sibling | Phase 5 | Bidirectional catalog sync, one-way order visibility |
| **BIS verification** | Hallmark cert lookup | Future | Read-only |
| **E-way bill portal (NIC)** | Compliance | Phase 3 | Outbound generate |

### 19.2 Non-goals (things we will deliberately not build)

- An in-house accounting engine. That's Tally/Zoho's job forever.
- A courier/logistics management tool. Sequel has one, we use theirs.
- A chat/communication tool. WhatsApp owns that.
- An ads/marketing dashboard. Meta/Google already built that.
- Multi-currency or international. Phase 5+ at earliest.

### 19.3 Long-horizon decisions worth keeping alive

These are not on the roadmap, but they matter:

- **Designer royalty marketplace** — the original Shewah vision ("Redbubble for fine jewelry"). When the B2B engine is stable and profitable, this becomes the platform play. It reuses the catalog, CAD, and production layers.
- **Vertical integration of the stone supplier.** Right now LGD is purchased. At some scale, owning that supply locks in margin and trust.
- **Own the karigar brand** — today Shewah hides the karigar from the jeweler. At some scale, named karigar signatures (like a Hermès atelier credit) can become a premium signal.

## 20. Open Questions & Decisions Pending

Every SOP has gaps. Named openly below so they aren't forgotten.

### 20.1 Open technical decisions

- **Auth for partners:** WhatsApp OTP (ideal for India) vs. magic-link email (simpler). Leaning WhatsApp OTP, need to validate API provider (Gupshup, AiSensy, Twilio).
- **CAD viewer in portal:** 3D preview (Three.js) or static renders only? Static is faster; 3D is a wow factor.
- **Payment collection:** Razorpay payment link per invoice, or a persistent partner-level pay-anytime page?
- **Mobile strategy:** PWA first (cheaper), native only if push notifications become critical.
- **IBJA rate:** is the user willing to pay for an API, or will manual entry remain forever?

### 20.2 Open business decisions

- **Who is the first sales rep?** (internal: owner's time to hire)
- **Will Shewah have its own BIS license or continue sending pieces out?** (compliance + margin question)
- **Tier A threshold — is ₹25L lifetime right, or too high for Phase 1?**
- **Credit policy for new partners — start COD always, or allow graduated credit from partner 3?**
- **Akshay Tritiya pricing — fixed discount or on-demand?** Indian jewelry has festival pricing baked in. The SOP doesn't yet model seasonality.

### 20.3 Open compliance decisions

- **DPDP Act readiness** — privacy policy, consent capture in portal, data export on request.
- **Hallmarking outsourced** — which BIS hallmarking cell are we using, is there SLA paper?
- **TCS compliance** — owner + CA confirm current FY thresholds and reporting cadence.

---

# Appendices

## A. Glossary

- **BIS** — Bureau of Indian Standards. Hallmarking authority for Indian jewelry.
- **CAD** — Computer-Aided Design. In Shewah context, a 3D render + STL/STEP file of a ring design.
- **CBIC** — Central Board of Indirect Taxes and Customs. Issues GST clarifications.
- **COD** — Cash on Delivery. In B2B Indian jewelry, usually means full advance before dispatch.
- **COQ** — Credit Order Ceiling (Shewah term). The total credit a partner can hold open across orders.
- **D2C** — Direct to Consumer. Refers to shewah.co, the Shopify storefront.
- **DPDP Act** — Digital Personal Data Protection Act (India, 2023). India's GDPR analogue.
- **E-way bill** — electronic document required for movement of goods > ₹50,000 intra/inter-state.
- **GSTIN** — Goods and Services Tax Identification Number. 15-char state + PAN-based ID.
- **HSN** — Harmonized System of Nomenclature. Product classification code for GST.
- **IBJA** — India Bullion and Jewellers Association. The canonical daily gold rate source.
- **IGI / GIA / SGL** — diamond certification labs (International Gemological Institute, Gemological Institute of America, Solitaire Gemmological Labs).
- **Karigar** — artisan; the craftsperson who physically makes the jewelry.
- **LGD** — Lab-Grown Diamond.
- **MOQ** — Minimum Order Quantity (here, minimum order value).
- **PI** — Proforma Invoice. A pre-tax-invoice quote document with payment terms and validity.
- **POD** — Proof of Delivery.
- **RCM** — Reverse Charge Mechanism. Tax paid by receiver, not supplier, under GST.
- **RLS** — Row-Level Security. Supabase/Postgres feature for per-user data filtering.
- **RPO / RTO** — Recovery Point Objective / Recovery Time Objective. Backup recovery SLAs.
- **TCS** — Tax Collected at Source. 0.1% applied above ₹50L per customer per FY.

## B. State Machines (referenced)

- §9.1 — Order lifecycle
- §10 — CAD lifecycle (implicit in §9 but distinct)
- §8.2 — Receivables ageing
- §17.1 — Rate-lock exception flow

Render these as Mermaid diagrams in the repo's `/docs/diagrams/` folder so they stay in sync.

## C. Permission Matrix

See §2.2. Treat §2.2 as canonical. If the UI or database says something different, the UI or database is wrong.

## D. Document Templates (placeholder)

To be built in Phase 1-3. Each template is an HTML file compiled to PDF server-side.

- `templates/pi.html` — Proforma Invoice (Phase 1)
- `templates/tax_invoice.html` — Tax Invoice (Phase 3)
- `templates/dispatch_doc.html` — Dispatch document (Phase 1)
- `templates/job_card.html` — Karigar job card (Phase 4)
- `templates/credit_note.html` — Credit Note (Phase 3)
- `templates/demand_letter.html` — Overdue demand letter (Phase 2)

All templates in English, with a Gujarati translation option for karigar-facing docs.

## E. Change Log

| Version | Date | Author | Notes |
|---|---|---|---|
| 1.0 | 2026-04-17 | Kaushal (with Claude) | First draft. All 20 sections populated. |

---

**End of SOP v1.0.**

Reviewed against the shewah-b2b codebase (as of main @ 2026-04-17) and the three strategic decisions captured in grilling rounds 1 and 2. Next review scheduled: before Phase 1 kickoff.
