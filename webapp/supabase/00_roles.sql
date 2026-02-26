-- #HashtagWebsite — Postgres Roles
-- This runs BEFORE schema.sql (alphabetical order via 00_ prefix)
-- PostgREST requires 'anon' and 'authenticated' roles to exist.

DO $$
BEGIN
  -- anon: used by PostgREST for unauthenticated requests
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  -- authenticated: used for JWT-authenticated requests
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
END $$;

-- Allow PostgREST to switch into these roles
GRANT anon TO postgres;
GRANT authenticated TO postgres;

-- Allow both roles to use the public schema
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
