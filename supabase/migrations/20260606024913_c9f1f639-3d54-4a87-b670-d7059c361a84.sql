
-- Per-network ad config (rewards, button count, status, ad block ids)
CREATE TABLE public.ad_networks (
  key text PRIMARY KEY,
  label text NOT NULL,
  reward numeric(12,6) NOT NULL DEFAULT 0.001,
  button_count int NOT NULL DEFAULT 10,
  enabled boolean NOT NULL DEFAULT true,
  coming_soon boolean NOT NULL DEFAULT false,
  cooldown_hours int NOT NULL DEFAULT 12,
  block_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.ad_networks TO service_role;
GRANT SELECT ON public.ad_networks TO authenticated, anon;

ALTER TABLE public.ad_networks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ad_networks readable" ON public.ad_networks FOR SELECT TO authenticated, anon USING (true);

INSERT INTO public.ad_networks (key, label, reward, button_count, enabled, coming_soon, sort_order, block_ids) VALUES
  ('adsgram', 'Adsgram',  0.0020, 20, true,  false, 10, '["int-30048","8814"]'::jsonb),
  ('monetag', 'Monetag',  0.0015, 10, true,  false, 20, '["11012677"]'::jsonb),
  ('monetix', 'Monetix',  0.0015, 10, true,  true,  30, '[]'::jsonb),
  ('gigapub', 'GigaPub',  0.0015, 10, true,  false, 40, '["6899"]'::jsonb),
  ('adexium', 'Adexium',  0.0015,  5, true,  true,  50, '[]'::jsonb);

-- Per-button cooldown tracking
CREATE TABLE public.ad_button_watches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  network text NOT NULL,
  slot int NOT NULL,
  reward numeric(12,6) NOT NULL,
  watched_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.ad_button_watches TO service_role;

ALTER TABLE public.ad_button_watches ENABLE ROW LEVEL SECURITY;
-- No public policies; all access is via service_role server fns.

CREATE INDEX ad_button_watches_user_net_slot_idx
  ON public.ad_button_watches (user_id, network, slot, watched_at DESC);
