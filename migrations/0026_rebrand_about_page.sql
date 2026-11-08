-- Rebrand the storefront-visible About page seeded by 0003_add_cms_pages.sql
-- (FEAT-20261108-02): the platform is now Melt Party and the assistant is
-- Floe. 0003 is already applied and must not be edited, so this migration
-- rewrites the brand words in place instead.
--
-- REPLACE only touches the old literals: an admin-edited body keeps every
-- other word, and re-running the statement is a no-op once the old words
-- are gone. Expand-only: changes one row's content, no schema change.

UPDATE pages
SET content = REPLACE(REPLACE(content, 'Mercora', 'Melt Party'), 'assistant Volt', 'assistant Floe'),
    updated_at = unixepoch()
WHERE slug = 'about';
