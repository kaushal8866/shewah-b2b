-- ============================================================
-- SHEWAH Consumer Blog Infrastructure — NON-DESTRUCTIVE Rollback Script
-- Safe Emergency Rollback:
-- 1. Pauses all automation and sets publishing switch to 'draft_only'.
-- 2. Disables the blog entirely (sets is_blog_enabled = false).
-- 3. Revokes all active API tokens to immediately stop assistant submissions.
-- 4. Returns published articles to 'in_review' status, unlinking live_revision_id.
-- 5. KEEPS ALL TABLES, REVISIONS, AUDIT LOGS, AND DATA COMPLETELY INTACT.
-- ============================================================

-- Step 1: Disable the blog and pause automation in blog_settings
update blog_settings
set
  is_blog_enabled = false,
  is_automation_paused = true,
  publication_mode = 'draft_only',
  updated_at = now()
where id = 'default';

-- Step 2: Revoke all active API tokens immediately to cut off automation access
update blog_api_tokens
set
  is_revoked = true,
  updated_at = now()
where is_revoked = false;

-- Step 3: Unpublish any live articles so no blog content is live
-- live_revision_id is decoupled while all revisions and history are preserved in blog_revisions
update blog_articles
set
  status = 'in_review',
  live_revision_id = null,
  updated_at = now()
where status = 'published';

-- Step 4: Record a durable audit log entry for this rollback action
insert into blog_audit_logs (
  actor_type,
  actor_id,
  operation,
  outcome,
  diff_summary,
  created_at
) values (
  'system',
  'atelier_owner_rollback',
  'rollback',
  'success',
  jsonb_build_object(
    'action', 'non_destructive_rollback',
    'is_blog_enabled', false,
    'is_automation_paused', true,
    'publication_mode', 'draft_only',
    'notes', 'Blog disabled and tokens revoked. All tables and revision data preserved intact.'
  ),
  now()
);
