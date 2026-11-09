-- hq-data-v2 (BANKSY t2448u): last good snapshot per HQ board, so boards fall back to real old data (clearly marked)
-- instead of going blank. Private: RLS on, no policies, service_role only. No existing table is changed.
-- Rollback: DROP TABLE IF EXISTS public.hq_board_last_good;
BEGIN;
CREATE TABLE IF NOT EXISTS public.hq_board_last_good (
 key text PRIMARY KEY,
 rows jsonb NOT NULL,
 status text,
 source text NOT NULL,
 source_at timestamptz NOT NULL,
 saved_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT hq_board_last_good_key CHECK (key ~ '^(board|pumpfeed|chain):[a-z0-9_:]{2,64}$'),
 CONSTRAINT hq_board_last_good_size CHECK (octet_length(rows::text) <= 262144),
 CONSTRAINT hq_board_last_good_status CHECK (status IS NULL OR length(status) <= 120),
 CONSTRAINT hq_board_last_good_source CHECK (length(source) <= 80)
);
ALTER TABLE public.hq_board_last_good ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.hq_board_last_good FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.hq_board_last_good TO service_role;
COMMIT;
