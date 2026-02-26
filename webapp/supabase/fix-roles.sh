#!/bin/bash
# ─────────────────────────────────────────────────────────────
# Fix: Create missing 'anon' and 'authenticated' roles
# Run this once if you get: role "anon" does not exist
#
# Usage:  bash supabase/fix-roles.sh
# ─────────────────────────────────────────────────────────────

echo "🔧 Creating missing Postgres roles in hw-postgres..."

docker exec hw-postgres psql -U postgres -d hashtagwebsite << 'SQL'
-- Create anon role if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
    RAISE NOTICE 'Created role: anon';
  ELSE
    RAISE NOTICE 'Role anon already exists';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
    RAISE NOTICE 'Created role: authenticated';
  ELSE
    RAISE NOTICE 'Role authenticated already exists';
  END IF;
END $$;

-- Grant PostgREST switch permissions
GRANT anon TO postgres;
GRANT authenticated TO postgres;

-- Grant schema + table access
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Confirm
SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated');
SQL

echo ""
echo "✅ Done. Restart PostgREST to pick up the changes:"
echo "   docker restart hw-postgrest"
echo ""
echo "Then test in the app: Settings → 🔌 Test Connection"
