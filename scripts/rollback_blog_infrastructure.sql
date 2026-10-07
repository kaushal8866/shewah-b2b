-- ============================================================
-- SHEWAH Consumer Blog Infrastructure — Rollback Script
-- Drops ONLY blog_* tables and associated indexes.
-- Restores database state cleanly without touching any commerce or partner data.
-- ============================================================

drop table if exists blog_idempotency_records cascade;
drop table if exists blog_audit_logs cascade;
drop table if exists blog_api_tokens cascade;
drop table if exists blog_slug_redirects cascade;
drop table if exists blog_settings cascade;
drop table if exists blog_articles cascade;
drop table if exists blog_revisions cascade;
