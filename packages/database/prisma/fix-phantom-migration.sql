-- Fix: remove phantom migration record so "prisma migrate deploy" can run.
-- Use only when you get: "Could not find the migration file at ... Please delete the directory or restore the migration file."
-- Replace the migration_name below with the one from your error message.

DELETE FROM public._prisma_migrations
WHERE migration_name = '20260203120001_inventory_items_require_category_id';
