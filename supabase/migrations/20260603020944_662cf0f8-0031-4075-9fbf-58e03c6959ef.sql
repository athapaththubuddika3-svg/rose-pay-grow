
CREATE TABLE IF NOT EXISTS public.commission_bonus_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  amount numeric not null,
  pct numeric not null,
  claimed_at timestamptz not null default now(),
  unique(user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_bonus_claims TO authenticated;
GRANT ALL ON public.commission_bonus_claims TO service_role;
ALTER TABLE public.commission_bonus_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full access" ON public.commission_bonus_claims FOR ALL TO service_role USING (true) WITH CHECK (true);

INSERT INTO public.app_settings (key, value)
VALUES ('commission_bonus_pct', to_jsonb(20))
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

INSERT INTO public.app_settings (key, value)
VALUES ('commission_bonus_expires_at', to_jsonb((now() + interval '24 hours')::text))
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
