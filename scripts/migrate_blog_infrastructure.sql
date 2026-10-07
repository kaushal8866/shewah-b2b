-- ============================================================
-- SHEWAH Consumer Blog Infrastructure — Phase 1 Migration
-- Additive DDL: Dedicated blog_* tables only.
-- Zero changes, locks, or modifications to existing B2B or D2C tables.
-- ============================================================

-- Ensure uuid-ossp or pgcrypto is available for UUID generation
create extension if not exists "uuid-ossp";

-- ── 1. BLOG ARTICLES (Root Entity) ──────────────────────────
create table if not exists blog_articles (
  id                    uuid primary key default uuid_generate_v4(),
  slug                  text not null unique,
  title                 text not null,
  excerpt               text,
  category              text not null default 'education',
  tags                  text[] default '{}',
  author_display_name   text not null default 'SHEWAH Editorial Atelier',
  
  -- Hero Media Reference & Provenance
  hero_image_url        text,
  hero_image_alt        text,
  hero_image_caption    text,
  hero_image_rights     text,
  
  -- Search & Canonical Policy
  seo_title             text,
  meta_description      text,
  canonical_url_policy  text not null default 'default', -- 'default' (https://shewah.co/blog/[slug]) | 'custom'
  canonical_url_custom  text,
  
  -- Structured Sources & Provenance
  source_references     jsonb not null default '[]'::jsonb,
  reading_time_minutes  integer not null default 1,
  
  -- Lifecycle Status Graph: 'draft' | 'in_review' | 'scheduled' | 'published' | 'archived'
  status                text not null default 'draft',
  
  -- Revisions & Isolation
  -- current_revision_id: latest working revision (draft)
  -- live_revision_id: exact revision currently live for consumers (null if unpublished)
  current_revision_id   uuid,
  live_revision_id      uuid,
  
  -- Provenance & Deduplication
  editorial_source      text not null default 'internal', -- 'internal' | 'external_assistant' | 'import'
  external_content_id   text unique,
  
  -- Optimistic Concurrency Control
  lock_version          integer not null default 1,
  
  -- Timestamps (stored in UTC)
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  published_at          timestamptz,
  scheduled_at          timestamptz,

  constraint chk_blog_article_status check (status in ('draft', 'in_review', 'scheduled', 'published', 'archived')),
  constraint chk_blog_article_canonical check (canonical_url_policy in ('default', 'custom'))
);

-- ── 2. BLOG REVISIONS (Immutable Version Snapshots) ─────────
create table if not exists blog_revisions (
  id                    uuid primary key default uuid_generate_v4(),
  article_id            uuid not null references blog_articles(id) on delete cascade,
  revision_number       integer not null,
  
  -- Content snapshot
  title                 text not null,
  excerpt               text,
  body_markdown         text not null,
  body_structured       jsonb, -- parsed AST / block elements
  category              text not null,
  tags                  text[] default '{}',
  author_display_name   text not null,
  
  -- Media snapshot
  hero_image_url        text,
  hero_image_alt        text,
  hero_image_caption    text,
  hero_image_rights     text,
  
  -- SEO & Source snapshot
  seo_title             text,
  meta_description      text,
  source_references     jsonb not null default '[]'::jsonb,
  reading_time_minutes  integer not null default 1,
  
  -- Integrity Verification
  content_hash          text not null, -- SHA-256 of title + body_markdown + sources
  
  -- Attribution
  created_by_actor_type text not null default 'owner', -- 'owner' | 'assistant_token' | 'system'
  created_by_actor_id   text not null,
  change_summary        text,
  
  created_at            timestamptz not null default now(),
  
  constraint uq_blog_revision_article_number unique (article_id, revision_number)
);

-- Foreign key constraints linking articles to revisions (safe deferral)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'fk_blog_articles_current_revision'
  ) then
    alter table blog_articles
      add constraint fk_blog_articles_current_revision
      foreign key (current_revision_id) references blog_revisions(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'fk_blog_articles_live_revision'
  ) then
    alter table blog_articles
      add constraint fk_blog_articles_live_revision
      foreign key (live_revision_id) references blog_revisions(id) on delete set null;
  end if;
end $$;

-- ── 3. BLOG AUDIT LOGS (Durable Event Trail) ────────────────
create table if not exists blog_audit_logs (
  id                    uuid primary key default uuid_generate_v4(),
  article_id            uuid references blog_articles(id) on delete set null,
  revision_id           uuid references blog_revisions(id) on delete set null,
  
  -- Actor identification (Tokens/secrets are NEVER logged)
  actor_type            text not null, -- 'owner' | 'assistant_token' | 'cron' | 'system'
  actor_id              text not null, -- user ID or token prefix/ID
  
  -- Operation details
  operation             text not null, -- 'create_draft' | 'update_draft' | 'submit_review' | 'schedule' | 'publish' | 'unpublish' | 'rollback' | 'archive' | 'pause_automation' | 'resume_automation' | 'revoke_token'
  outcome               text not null, -- 'success' | 'failure' | 'conflict'
  
  request_id            text,
  idempotency_key       text,
  payload_hash          text,
  diff_summary          jsonb,
  error_message         text,
  
  created_at            timestamptz not null default now()
);

-- ── 4. BLOG SETTINGS (Owner Governance & Gates) ─────────────
create table if not exists blog_settings (
  id                          text primary key default 'default',
  -- Kill switch: if false, all public and API blog routes are completely disabled
  is_blog_enabled             boolean not null default true,
  -- Owner gate: starts strictly in 'draft_only' mode!
  publication_mode            text not null default 'draft_only', -- 'draft_only' | 'review_first' | 'auto_publish'
  is_automation_paused        boolean not null default false,
  max_daily_new_posts         integer not null default 1,
  allowed_categories          text[] not null default array['education', 'craftsmanship', 'style-guides', 'materials', 'diamonds', 'care-guide', 'buying-guide', 'styling'],
  publish_window_start_time   text not null default '09:00', -- Asia/Kolkata 24h
  publish_window_end_time     text not null default '20:00', -- Asia/Kolkata 24h
  timezone                    text not null default 'Asia/Kolkata',
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  
  constraint chk_blog_publication_mode check (publication_mode in ('draft_only', 'review_first', 'auto_publish'))
);

-- Initialize default settings row if not present
insert into blog_settings (
  id, is_blog_enabled, publication_mode, is_automation_paused, max_daily_new_posts, allowed_categories, timezone
)
values (
  'default', true, 'draft_only', false, 1, array['education', 'craftsmanship', 'style-guides', 'materials', 'diamonds', 'care-guide', 'buying-guide', 'styling'], 'Asia/Kolkata'
)
on conflict (id) do nothing;

-- ── 5. BLOG API TOKENS (Scoped Bearer Credentials) ──────────
create table if not exists blog_api_tokens (
  id                    uuid primary key default uuid_generate_v4(),
  name                  text not null,
  token_prefix          text not null, -- e.g. 'shw_blog_'
  token_hash            text not null unique, -- SHA-256 hash of plaintext token
  scopes                text[] not null default array['blog:read', 'blog:draft:write'],
  is_revoked            boolean not null default false,
  expires_at            timestamptz,
  last_used_at          timestamptz,
  created_by            text not null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ── 6. BLOG IDEMPOTENCY RECORDS (Atomic Mutation Deduplication)
create table if not exists blog_idempotency_records (
  id                    uuid primary key default uuid_generate_v4(),
  idempotency_key       text not null,
  actor_id              text not null,
  operation             text not null,
  payload_hash          text not null,
  response_status       integer not null,
  response_body         jsonb not null,
  created_at            timestamptz not null default now(),
  
  constraint uq_blog_idempotency unique (idempotency_key, actor_id, operation)
);

-- ── 7. BLOG SLUG REDIRECTS (301 Permanent Redirect Map) ────
create table if not exists blog_slug_redirects (
  id                    uuid primary key default uuid_generate_v4(),
  old_slug              text not null unique,
  new_slug              text not null,
  created_at            timestamptz not null default now()
);

-- ── 8. INDEXES FOR HIGH-PERFORMANCE QUERYING ────────────────
create index if not exists idx_blog_articles_slug on blog_articles(slug);
create index if not exists idx_blog_articles_status_pub on blog_articles(status, published_at desc);
create index if not exists idx_blog_articles_status_sched on blog_articles(status, scheduled_at);
create index if not exists idx_blog_articles_category on blog_articles(category);
create index if not exists idx_blog_articles_ext_id on blog_articles(external_content_id) where external_content_id is not null;
create index if not exists idx_blog_revisions_article on blog_revisions(article_id, revision_number desc);
create index if not exists idx_blog_audit_article on blog_audit_logs(article_id, created_at desc);
create index if not exists idx_blog_audit_actor on blog_audit_logs(actor_id, created_at desc);
create index if not exists idx_blog_api_tokens_hash on blog_api_tokens(token_hash) where is_revoked = false;
create index if not exists idx_blog_idempotency_lookup on blog_idempotency_records(idempotency_key, actor_id);
create index if not exists idx_blog_slug_redirects_old on blog_slug_redirects(old_slug);

-- ── 9. ZERO-TRUST ROW LEVEL SECURITY (RLS) LOCKDOWN ────────
-- Enable RLS on all blog infrastructure tables
alter table blog_articles enable row level security;
alter table blog_revisions enable row level security;
alter table blog_audit_logs enable row level security;
alter table blog_settings enable row level security;
alter table blog_api_tokens enable row level security;
alter table blog_idempotency_records enable row level security;
alter table blog_slug_redirects enable row level security;

-- ── 10. REVOKE ALL DIRECT ACCESS FROM ANON & AUTHENTICATED ──
-- Deny public and standard Supabase client roles from querying or mutating any blog table
revoke all on blog_articles, blog_revisions, blog_audit_logs, blog_settings, blog_api_tokens, blog_idempotency_records, blog_slug_redirects from anon, authenticated;
revoke all on table blog_articles, blog_revisions, blog_audit_logs, blog_settings, blog_api_tokens, blog_idempotency_records, blog_slug_redirects from anon, authenticated;

-- ── 11. EXPLICIT ZERO-TRUST DENIAL POLICIES ─────────────────
-- Explicit defense-in-depth: Even if grants were ever re-added, RLS denies all access
do $$
begin
  -- blog_articles
  if not exists (select 1 from pg_policies where policyname = 'deny_anon_blog_articles') then
    create policy deny_anon_blog_articles on blog_articles for all to anon using (false);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'deny_auth_blog_articles') then
    create policy deny_auth_blog_articles on blog_articles for all to authenticated using (false);
  end if;

  -- blog_revisions
  if not exists (select 1 from pg_policies where policyname = 'deny_anon_blog_revisions') then
    create policy deny_anon_blog_revisions on blog_revisions for all to anon using (false);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'deny_auth_blog_revisions') then
    create policy deny_auth_blog_revisions on blog_revisions for all to authenticated using (false);
  end if;

  -- blog_audit_logs
  if not exists (select 1 from pg_policies where policyname = 'deny_anon_blog_audit_logs') then
    create policy deny_anon_blog_audit_logs on blog_audit_logs for all to anon using (false);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'deny_auth_blog_audit_logs') then
    create policy deny_auth_blog_audit_logs on blog_audit_logs for all to authenticated using (false);
  end if;

  -- blog_settings
  if not exists (select 1 from pg_policies where policyname = 'deny_anon_blog_settings') then
    create policy deny_anon_blog_settings on blog_settings for all to anon using (false);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'deny_auth_blog_settings') then
    create policy deny_auth_blog_settings on blog_settings for all to authenticated using (false);
  end if;

  -- blog_api_tokens
  if not exists (select 1 from pg_policies where policyname = 'deny_anon_blog_api_tokens') then
    create policy deny_anon_blog_api_tokens on blog_api_tokens for all to anon using (false);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'deny_auth_blog_api_tokens') then
    create policy deny_auth_blog_api_tokens on blog_api_tokens for all to authenticated using (false);
  end if;

  -- blog_idempotency_records
  if not exists (select 1 from pg_policies where policyname = 'deny_anon_blog_idempotency_records') then
    create policy deny_anon_blog_idempotency_records on blog_idempotency_records for all to anon using (false);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'deny_auth_blog_idempotency_records') then
    create policy deny_auth_blog_idempotency_records on blog_idempotency_records for all to authenticated using (false);
  end if;

  -- blog_slug_redirects
  if not exists (select 1 from pg_policies where policyname = 'deny_anon_blog_slug_redirects') then
    create policy deny_anon_blog_slug_redirects on blog_slug_redirects for all to anon using (false);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'deny_auth_blog_slug_redirects') then
    create policy deny_auth_blog_slug_redirects on blog_slug_redirects for all to authenticated using (false);
  end if;
end $$;

-- ── 12. EXCLUSIVE SERVER-ROLE GRANTS ────────────────────────
-- Only the backend service_role (which bypasses RLS on the server) possesses operational access
grant all on blog_articles, blog_revisions, blog_audit_logs, blog_settings, blog_api_tokens, blog_idempotency_records, blog_slug_redirects to service_role;
grant all on table blog_articles, blog_revisions, blog_audit_logs, blog_settings, blog_api_tokens, blog_idempotency_records, blog_slug_redirects to service_role;


