-- #HashtagWebsite — Supabase / PostgreSQL Schema
-- Run this in Supabase Studio SQL editor or via psql
-- Local: http://localhost:54323 → SQL Editor
-- Cloud: https://supabase.com → your project → SQL Editor

-- Create table if not already present (safe to run multiple times)
CREATE TABLE IF NOT EXISTS leads (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  category          TEXT,
  city              TEXT,
  phone             TEXT,
  address           TEXT,
  email             TEXT,
  tagline           TEXT,
  description       TEXT,
  services          JSONB,          -- array of service strings
  rating            FLOAT DEFAULT 0,
  review_count      INT DEFAULT 0,
  maps_url          TEXT,
  has_website       BOOLEAN DEFAULT FALSE,

  -- Pipeline
  stage             TEXT DEFAULT 'new'
                    CHECK (stage IN ('new','site_generated','link_sent','following_up','customer','archived')),
  preview_url       TEXT,           -- local preview slug
  deploy_url        TEXT,           -- live cloudflare pages URL
  deployed_at       TIMESTAMPTZ,
  generated_html    TEXT,           -- stored generated HTML (can be large)

  -- Timestamps
  found_at          TIMESTAMPTZ DEFAULT NOW(),
  sent_at           TIMESTAMPTZ,
  follow_up_at      TIMESTAMPTZ,
  converted_at      TIMESTAMPTZ,

  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ language 'plpgsql';

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes for common queries (IF NOT EXISTS = safe to re-run)
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_found_at ON leads(found_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_city_category ON leads(city, category);

-- RLS (Row Level Security) — enable for production
-- ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow all for anon" ON leads FOR ALL TO anon USING (true);

-- Grant public access (adjust for production)
GRANT ALL ON leads TO anon;
GRANT ALL ON leads TO authenticated;
