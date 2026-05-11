
-- Storage bucket for task screenshots
INSERT INTO storage.buckets (id, name, public) VALUES ('task-screenshots', 'task-screenshots', true)
ON CONFLICT (id) DO NOTHING;

-- Users (telegram users, NOT auth.users)
CREATE TABLE public.app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT UNIQUE NOT NULL,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  photo_url TEXT,
  ref_code TEXT UNIQUE NOT NULL,
  ref_by UUID REFERENCES public.app_users(id),
  balance NUMERIC(20,4) NOT NULL DEFAULT 0,
  total_earned NUMERIC(20,4) NOT NULL DEFAULT 0,
  total_ads INT NOT NULL DEFAULT 0,
  total_tasks INT NOT NULL DEFAULT 0,
  total_withdraw NUMERIC(20,4) NOT NULL DEFAULT 0,
  total_ref_commission NUMERIC(20,4) NOT NULL DEFAULT 0,
  total_ref_count INT NOT NULL DEFAULT 0,
  ip_address TEXT,
  wallet_address TEXT,
  notif_enabled BOOLEAN NOT NULL DEFAULT false,
  suspended BOOLEAN NOT NULL DEFAULT false,
  suspend_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_app_users_telegram_id ON public.app_users(telegram_id);
CREATE INDEX idx_app_users_ref_code ON public.app_users(ref_code);
CREATE INDEX idx_app_users_ref_by ON public.app_users(ref_by);
CREATE INDEX idx_app_users_ip ON public.app_users(ip_address);

-- App settings (key/value)
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.app_settings (key, value) VALUES
  ('min_withdraw', '10'::jsonb),
  ('ref_bonus', '1'::jsonb),
  ('ref_commission_pct', '10'::jsonb),
  ('min_refs_for_withdraw', '2'::jsonb),
  ('min_daily_ads_for_withdraw', '10'::jsonb),
  ('rose_price_override', 'null'::jsonb),
  ('watch_enabled', 'false'::jsonb),
  ('payment_channel', '"https://t.me/rosepayfipayment"'::jsonb),
  ('community_channel', '"https://t.me/rosepayfi"'::jsonb),
  ('bot_username', '"RosePayFibot"'::jsonb);

-- Tasks
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('main','partner','other')),
  title TEXT NOT NULL,
  channel_url TEXT,
  channel_username TEXT,
  amount NUMERIC(20,4) NOT NULL DEFAULT 0,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tasks_type_active ON public.tasks(type, active);

-- Task completions
CREATE TABLE public.task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  screenshot_url TEXT,
  reject_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  UNIQUE(user_id, task_id)
);
CREATE INDEX idx_tc_user ON public.task_completions(user_id);
CREATE INDEX idx_tc_status ON public.task_completions(status);

-- Reward codes
CREATE TABLE public.reward_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  amount NUMERIC(20,4) NOT NULL,
  max_uses INT NOT NULL DEFAULT 1,
  used_count INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.reward_code_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id UUID NOT NULL REFERENCES public.reward_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  amount NUMERIC(20,4) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(code_id, user_id)
);

-- Referrals
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL UNIQUE REFERENCES public.app_users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','claimable','claimed')),
  bonus_amount NUMERIC(20,4) NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at TIMESTAMPTZ
);
CREATE INDEX idx_ref_referrer ON public.referrals(referrer_id);

-- Withdrawals
CREATE TABLE public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  amount NUMERIC(20,4) NOT NULL,
  wallet_address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  tx_id TEXT,
  reject_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);
CREATE INDEX idx_wd_user ON public.withdrawals(user_id);
CREATE INDEX idx_wd_status ON public.withdrawals(status);

-- Admin accounts (separate from app users)
CREATE TABLE public.admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Admin sessions (token based)
CREATE TABLE public.admin_sessions (
  token TEXT PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit log
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables. We use service role from server functions for ALL writes & most reads.
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_code_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- No public policies. All access goes through edge functions using service role.
-- Storage bucket policies: allow public read, restrict write through edge functions
CREATE POLICY "task-screenshots public read" ON storage.objects FOR SELECT USING (bucket_id = 'task-screenshots');
