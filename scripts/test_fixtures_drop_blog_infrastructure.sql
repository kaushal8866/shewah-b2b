-- ============================================================
-- DISPOSABLE TEST FIXTURES ONLY — NEVER RUN IN PRODUCTION
-- Drops blog_* tables and associated indexes for ephemeral test environments.
-- DO NOT RUN ON ANY PERSISTENT, STAGING, OR PRODUCTION DATABASE.
-- ============================================================

drop table if exists blog_rate_limits cascade;
drop table if exists blog_idempotency_records cascade;
drop table if exists blog_audit_logs cascade;
drop table if exists blog_api_tokens cascade;
drop table if exists blog_slug_redirects cascade;
drop table if exists blog_settings cascade;
drop table if exists blog_articles cascade;
drop table if exists blog_revisions cascade;
