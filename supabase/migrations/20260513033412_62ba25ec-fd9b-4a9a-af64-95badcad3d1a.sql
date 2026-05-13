
-- Reset admins to new credentials only
DELETE FROM public.admin_sessions;
DELETE FROM public.admins;
INSERT INTO public.admins (email, password_hash)
VALUES ('athapaththubuddika1@gmail.com', '$2b$10$w3uQh3KKPEspUy9j8cqV8e86FHi/GXVaLQvy.ZuWlP2pYIwIw4zMe');

-- Extend app_users
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS last_daily_bonus_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS daily_ads_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_ads_reset_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS session_ads_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS session_ads_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS daily_ad_tasks_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_ad_tasks_reset_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_ad_task_claim_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS withdraw_ads_done INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expected_balance NUMERIC NOT NULL DEFAULT 0;

-- Tables
CREATE TABLE IF NOT EXISTS public.daily_bonus_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_daily_bonus_user ON public.daily_bonus_claims(user_id, claimed_at DESC);

CREATE TABLE IF NOT EXISTS public.ad_watches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  kind TEXT NOT NULL,            -- 'watch' (rewarded watch ads), 'task' (ad task), 'auto' (auto interstitial), 'gate' (claim/withdraw gate)
  block_id TEXT NOT NULL,
  duration_sec INTEGER NOT NULL DEFAULT 0,
  reward NUMERIC NOT NULL DEFAULT 0,
  watched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ad_watches_user ON public.ad_watches(user_id, watched_at DESC);

CREATE TABLE IF NOT EXISTS public.ad_task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  reward NUMERIC NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ad_task_user ON public.ad_task_completions(user_id, completed_at DESC);

CREATE TABLE IF NOT EXISTS public.broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,
  to_channel BOOLEAN NOT NULL DEFAULT true,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.balance_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  expected NUMERIC NOT NULL,
  actual NUMERIC NOT NULL,
  diff NUMERIC NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS (deny-by-default; only service role server fns use them)
ALTER TABLE public.daily_bonus_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_watches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_task_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balance_audits ENABLE ROW LEVEL SECURITY;

-- Seed/upsert settings
INSERT INTO public.app_settings (key, value, updated_at) VALUES
  ('daily_bonus_amount',     to_jsonb(0.05::numeric), now()),
  ('ad_reward',              to_jsonb(0.05::numeric), now()),
  ('ad_daily_limit',         to_jsonb(40::int), now()),
  ('ad_session_limit',       to_jsonb(20::int), now()),
  ('ad_session_hours',       to_jsonb(12::int), now()),
  ('ad_min_watch_int',       to_jsonb(17::int), now()),
  ('ad_min_watch_rew',       to_jsonb(33::int), now()),
  ('ad_block_int',           to_jsonb('int-30048'::text), now()),
  ('ad_block_rew',           to_jsonb('int-30047'::text), now()),
  ('ad_task_block',          to_jsonb('task-30049'::text), now()),
  ('ad_task_reward',         to_jsonb(0.02::numeric), now()),
  ('ad_task_daily_limit',    to_jsonb(15::int), now()),
  ('ad_task_cooldown_sec',   to_jsonb(10::int), now()),
  ('withdraw_fee',           to_jsonb(0.5::numeric), now()),
  ('withdraw_ads_required',  to_jsonb(2::int), now()),
  ('max_withdraw',           to_jsonb(10::numeric), now()),
  ('min_withdraw',           to_jsonb(1::numeric), now()),
  ('auto_interstitial_min_sec', to_jsonb(40::int), now()),
  ('auto_interstitial_max_sec', to_jsonb(70::int), now()),
  ('open_interstitial_min_sec', to_jsonb(2::int), now()),
  ('open_interstitial_max_sec', to_jsonb(5::int), now()),
  ('community_channel',      to_jsonb('@rosepayfi'::text), now()),
  ('payment_channel',        to_jsonb('@rosepayfipayment'::text), now()),
  ('bot_username',           to_jsonb('RosePayFibot'::text), now()),
  ('ref_bonus',              to_jsonb(1::numeric), now()),
  ('ref_commission_pct',     to_jsonb(10::int), now()),
  ('min_refs_for_withdraw',  to_jsonb(2::int), now()),
  ('min_daily_ads_for_withdraw', to_jsonb(10::int), now()),
  ('app_url',                to_jsonb('https://t.me/RosePayFibot'::text), now()),
  ('app_share_text',         to_jsonb('🌹 Join RosePayFi — earn ROSE tokens by watching ads, completing tasks & inviting friends!'::text), now()),
  ('app_share_image',        to_jsonb('https://rose-pay-grow.lovable.app/og.jpg'::text), now())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
