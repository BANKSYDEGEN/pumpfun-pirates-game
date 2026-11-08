BEGIN;
CREATE TABLE IF NOT EXISTS public.boardfeed_cache (
 id text PRIMARY KEY CHECK (id = 'hq'),
 payload jsonb NOT NULL DEFAULT '{}'::jsonb,
 fetched_at timestamptz NOT NULL DEFAULT '1970-01-01',
 lease_until timestamptz NOT NULL DEFAULT '1970-01-01',
 CHECK (octet_length(payload::text) < 2097152)
);
ALTER TABLE public.boardfeed_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.boardfeed_cache FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.boardfeed_cache TO service_role;
INSERT INTO public.boardfeed_cache (id) VALUES ('hq') ON CONFLICT DO NOTHING;
COMMIT;
