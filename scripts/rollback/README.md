# DIP rollback — destructive SQL, deliberately kept out of the deploy path

Nothing in this directory is part of any migration. It is not meant to be
pasted into the SQL editor alongside a migration file, and no script runs it.

## Why it lives here

The DIP corpus is append-only and its value is time-depth. A week of snapshots
that is dropped **cannot be regenerated** — the competitor catalogue as it stood
last Tuesday is gone, and no amount of re-crawling brings it back. That is the
entire premise of the project.

A `drop table dip_snapshots` sitting as a commented block at the foot of a
migration is one careless "select all, run" away from destroying the only
irreplaceable asset in the system. Migrations get pasted whole into the Supabase
SQL editor routinely; that is exactly how this would happen.

So the rollback SQL exists — you need it if a migration goes wrong — but running
it has to be a deliberate act of opening this file, reading it, and copying one
statement.

## Before running anything here

1. Take a backup. Supabase Dashboard → Database → Backups.
2. Check what you would lose:

```sql
select
  (select count(*) from dip_designs)   as designs,
  (select count(*) from dip_snapshots) as snapshots,
  (select min(captured_at) from dip_snapshots) as earliest,
  (select max(captured_at) from dip_snapshots) as latest;
```

If `earliest` is more than a few weeks ago, stop and find another way. Weeks of
history are worth more than whatever the migration got wrong.

## Non-destructive rollback

These are safe and may be run without ceremony. They drop structure, not data.

```sql
-- Remove the L2 policies only
drop policy if exists "Owner only full access" on dip_attributes;
drop policy if exists "Owner only full access" on dip_extraction_runs;

-- Remove an index added by mistake
drop index if exists idx_dip_attributes_silhouette;
```

## Destructive — migrate_dip_attributes (L2)

Drops the attribute layer. **Extraction output is recoverable** by re-running
extraction against the corpus, so this is the least dangerous of the two, but it
still discards human gold-set labels, which cost real time to produce.

```sql
-- Export the gold labels FIRST. These were hand-made and cannot be re-derived.
--   select * from dip_gold_labels;   -- save the result before proceeding.

drop table if exists dip_gold_labels;
drop table if exists dip_gold_sets;
drop table if exists dip_attributes;
drop table if exists dip_extraction_runs;
drop table if exists dip_actions;
drop table if exists dip_model_versions;
```

`dip_actions` is listed above but deserves its own warning: it holds Shewah's
own outcomes — quotes won and lost, samples made, renders rejected. Those are
first-party labels that exist nowhere else. Export before dropping.

## Destructive — migrate_dip_corpus (L0/L1)

**This is the one that cannot be undone.** Dropping `dip_snapshots` destroys the
time series permanently. Re-crawling produces today's catalogue, not the history.

There is almost never a good reason to run this. If a column is wrong, alter it.
If a table is wrong, migrate it. Dropping is for abandoning the project.

```sql
-- Read the paragraph above again before uncommenting anything below.
--
-- drop trigger if exists trg_dip_snapshots_no_update on dip_snapshots;
-- drop function if exists dip_snapshots_append_only();
-- drop table if exists dip_snapshots;
-- drop table if exists dip_designs;
-- drop table if exists dip_ingest_runs;
-- drop table if exists dip_brands;
```

Note that `dip_snapshots` carries an append-only trigger that blocks `DELETE`.
Dropping the table bypasses it — the trigger protects rows, not the table. That
asymmetry is why this file exists.
