# Shewah B2B Admin Panel

A complete B2B operations management system for Shewah — LGD ring manufacturer based in Surat.

## What's inside

| Module | What it does |
|--------|-------------|
| **Dashboard** | Live KPIs, order pipeline funnel, quick actions |
| **Partners** | Jeweler CRM — contacts, status (Hot/Warm/Cold), visit logs, circuit assignment |
| **Orders** | Full order pipeline from Brief → CAD → Production → Dispatch → Delivered |
| **CAD Requests** | 48-hour design tracker with countdown timer, status management |
| **Catalog** | Ring product management — specs, pricing, photos |
| **Gold Rates** | Rate entry, auto-calculation of 14K/18K/22K, trade price calculator |
| **Circuits** | B2B visit trip planner with progress tracking |
| **Analytics** | Revenue by month, conversion funnel, top partners, model split |
| **Settings** | Pricing defaults, margins, operational parameters |

---

## Tech stack

- **Next.js 14** (App Router)
- **Supabase** (PostgreSQL + Auth + Realtime)
- **Tailwind CSS**
- **TypeScript**
- **Vercel** (hosting, free tier works)

---

## Deploy in 4 steps

### Step 1 — Set up Supabase (free)

1. Go to [supabase.com](https://supabase.com) → Create new project
2. Name it `shewah-b2b`, set a strong password, choose region: South Asia
3. Go to **SQL Editor** → click **New Query**
4. Paste the entire contents of `supabase/schema.sql` → click **Run**
5. Go to **Project Settings** → **API** → copy:
   - `Project URL` → this is your `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → this is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Step 2 — Push to GitHub

```bash
# In the shewah-b2b folder:
git init
git add .
git commit -m "Initial commit — Shewah B2B Admin"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/shewah-b2b.git
git push -u origin main
```

### Step 3 — Deploy to Vercel (free)

1. Go to [vercel.com](https://vercel.com) → Sign up with GitHub
2. Click **Add New Project** → import your `shewah-b2b` repo
3. Framework preset: **Next.js** (auto-detected)
4. Add **Environment Variables**:
   ```
   NEXT_PUBLIC_SUPABASE_URL    = https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY = your-anon-key-here
   ```
5. Click **Deploy** → live in 2 minutes

Your app will be at: `https://shewah-b2b.vercel.app`

### Step 4 — Set up auth (add your login)

In Supabase dashboard:
1. Go to **Authentication** → **Users** → **Add user**
2. Enter your email and a strong password
3. Now go to your live Vercel URL and log in

---

## Local development

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/shewah-b2b.git
cd shewah-b2b

# Install dependencies
npm install

# Create local environment file
cp .env.example .env.local
# Edit .env.local and add your Supabase keys

# Run development server
npm run dev
```

App runs at `http://localhost:3000`

---

## First-time setup after deploy

Once live, do this in order:

1. **Add your gold rate** → Gold Rates page → enter today's 24K rate
2. **Add your first products** → Catalog → Add product (or edit the 8 sample rows)
3. **Add your first partner** → Partners → Add partner (use a visit you've already done)
4. **Update settings** → Settings → enter your WhatsApp number and business details

---

## File structure

```
shewah-b2b/
├── app/
│   ├── page.tsx              ← Dashboard
│   ├── partners/             ← CRM
│   ├── orders/               ← Order pipeline
│   ├── cad-requests/         ← CAD tracker
│   ├── catalog/              ← Product catalog
│   ├── gold-rates/           ← Gold rate + calculator
│   ├── circuits/             ← Visit trip planner
│   ├── analytics/            ← Charts and KPIs
│   └── settings/             ← Admin config
├── lib/
│   ├── supabase.ts           ← DB client + types + helpers
│   └── utils.ts              ← Formatting helpers
└── supabase/
    └── schema.sql            ← Full database schema
```

---

## Customisation

**Add a new field to partners:**
1. Add column to `supabase/schema.sql` and run in Supabase SQL editor
2. Add the field to the `Partner` type in `lib/supabase.ts`
3. Add the input to `app/partners/new/page.tsx`

**Change the gold rate calculation:**
Edit `calculateGoldRates()` in `lib/supabase.ts`

**Change trade margin default:**
Go to Settings page → update "Trade margin target"

---

## Support

Built by Claude for Kaushal, Shewah (shewah.co)
