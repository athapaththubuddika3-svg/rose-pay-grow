## Watch Tab Rework + Admin Ad Manager

Major rework of the ads system with 5 ad networks, each on its own card opening a new view with watch buttons. Per-button 12h cooldown, per-network reward control, admin panel to manage buttons/rewards, withdrawal requirements use all networks.

### Ad Networks & Layout

Each card on Watch tab. Tap card → opens a new view with N "Watch Ad" buttons. Each button: random ad from the network's block(s). After watching once, that button is locked for 12 hours.

| Network | Buttons | Status | SDK |
|---|---|---|---|
| Adsgram | 20 | Active | existing `<adsgram-task>` / `window.Adsgram` |
| Monetag | 10 | Active | `//libtl.com/sdk.js` zone `11012677`, `window.show_11012677()` |
| Monetix | 10 | Coming soon (no SDK yet) | — |
| GigaPub | 10 | Active | `https://ad.gigapub.tech/script?id=6899`, `window.showGiga()` |
| Adexium | 5 | Coming soon | — |

**Reward rule:** reward credited only when the SDK promise resolves (ad was actually shown). Errors / closed early = no reward.

### Database

New migration:

```sql
-- per-network configuration (reward, button count, enabled)
create table public.ad_networks (
  key text primary key,            -- 'adsgram' | 'monetag' | 'monetix' | 'gigapub' | 'adexium'
  label text not null,
  reward numeric(12,4) not null default 0.001,
  button_count int not null default 10,
  enabled boolean not null default true,
  coming_soon boolean not null default false,
  sort_order int not null default 0,
  updated_at timestamptz default now()
);
-- seed: adsgram(20,active), monetag(10,active), monetix(10,coming), gigapub(10,active), adexium(5,coming)

-- per-button cooldown tracking (user x network x slot)
create table public.ad_button_watches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  network text not null,
  slot int not null,
  watched_at timestamptz not null default now(),
  reward numeric(12,4) not null,
  unique (user_id, network, slot, watched_at)
);
create index on public.ad_button_watches (user_id, network, watched_at desc);
```

Grants + RLS (service_role only; all access via server fns).

### Server functions (`src/lib/api.functions.ts`)

- `listAdNetworks()` — returns networks + per-button `nextAvailableAt` for current user (12h since last watch on that slot).
- `claimAdReward({ network, slot })` — verifies network enabled & not coming soon, verifies slot is off cooldown, inserts `ad_button_watches`, credits `app_users.balance` + `total_earned` + `total_ads_today`.
- `getWithdrawEligibility()` — extended to sum watches across all networks if needed (keep current rules; just expose counts per network).

### Admin (`src/lib/admin.functions.ts` + `src/routes/admin.tsx`)

New "Manage Ads" tab:
- List all networks
- Edit reward, button_count, enabled, coming_soon
- Save via `adminUpdateAdNetwork({ key, ... })`

### UI

**`src/components/WatchTab.tsx`**
- Replace current task list with stacked cards (one per network, sorted).
- Card click → `setActiveNetwork(key)` which renders a full-screen panel with the button grid.
- Coming-soon cards open a coming-soon panel (or are disabled — show "Coming soon" badge, no navigation).
- Daily bonus card stays.

**`src/components/AdNetworkPanel.tsx`** (new)
- Header with back button and network name.
- Grid of buttons (1..N). Each button shows: "Watch Ad #i" + countdown if on cooldown.
- On click: call network-specific SDK. If success → call `claimAdReward`. If error/closed → no claim, toast.

**SDK loading** (`src/components/AdsLoader.tsx` or in root):
- Inject Monetag, GigaPub scripts once at app boot (Adsgram is already loaded).

**Withdraw requirements (`ProfileTab.tsx`):**
- Show pretty progress cards for each active network's per-day requirement (config from `app_settings`, or simply show "Watch X ads across all networks"). Use existing logic; restyle the counter to look nicer (gradient progress bars per network).

### Daily reset at 00:00:00 Asia/Colombo

Already implemented via `colomboDayStartUtc`. Verify all daily counters (ads, bonus) compare `last_*_at >= colomboDayStartUtc()` — fix any UTC leftovers.

### Files to change

- new: `supabase/migrations/<ts>_ad_networks.sql`
- new: `src/components/AdNetworkPanel.tsx`
- edit: `src/components/WatchTab.tsx` (full rewrite of card list)
- edit: `src/components/ProfileTab.tsx` (prettier withdraw progress)
- edit: `src/lib/api.functions.ts` (new server fns, daily reset audit)
- edit: `src/lib/admin.functions.ts` (network CRUD)
- edit: `src/routes/admin.tsx` (Manage Ads tab)
- edit: `src/routes/__root.tsx` or new `AdsLoader.tsx` (script tags)

### Open question

Adsgram currently uses the `<adsgram-task>` element (task-style, not on-demand). For 20 individual "Watch Ad" buttons we need on-demand calls via `window.Adsgram.init({ blockId }).show()`. **Confirm you have the on-demand Adsgram block ID(s)** (you mentioned "two blocks — random pick"). If not provided, I'll wire it to use the existing task block ID as a placeholder and you can swap later in admin.
