# RosePayFi Telegram Mini App — Build Plan

A full Telegram Mini App with a Rose-themed neon UI, backed by Lovable Cloud, plus a separate web admin panel and a Telegram bot for notifications.

## 1. Backend setup (Lovable Cloud)

Enable Lovable Cloud and configure:
- **Secrets**: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID=1889290764`, `CMC_API_KEY` (CoinMarketCap), `ADMIN_EMAIL`, `ADMIN_PASSWORD` (you set during signup).
- **Bot**: register webhook for `@RosePayFibot` → `/api/public/telegram/webhook` (handles `/start` deep link with referral code).

### Database tables
- `users` — telegram_id (unique), username, first_name, photo_url, balance_rose, total_earned, total_ads, total_tasks, total_withdraw, ref_by, ref_code, ip_address, suspended, created_at
- `app_settings` — key/value (min_withdraw, ref_bonus=1, ref_commission=10%, min_refs=2, min_daily_ads=10, rose_price_override, watch_enabled=false, etc.)
- `tasks` — type (main/partner/other), title, channel_url, amount, description, requires_screenshot, active
- `task_completions` — user_id, task_id, status (pending/approved/rejected), screenshot_url, created_at
- `reward_codes` — code, amount, max_uses, used_count, active
- `reward_code_claims` — code_id, user_id (unique pair)
- `referrals` — referrer_id, referred_id, status (pending/claimable/claimed), bonus_amount
- `withdrawals` — user_id, amount, wallet_address, status (pending/approved/rejected), tx_id, created_at
- `admins` — email, password_hash (separate from telegram users)
- `audit_log` — for anti-cheat tracking

All tables use RLS. Service role used by server functions for trusted writes.

## 2. Telegram Mini App (frontend)

Auth via `Telegram.WebApp.initData` validated server-side with bot token HMAC. Auto-creates user on first open.

### Screens (bottom tab nav: Home · Task · Watch · Refer · Profile)

**Splash** — Logo with neon pink glow + petal/scale animations (3s) before app loads.

**Notification permission prompt** — On first open, banner asking to enable bot notifications. Tap → opens bot, sends `/start`, dismisses permanently.

**Home**
- Top: Telegram avatar + username
- Custom Rose token coin icon (we'll generate it)
- Balance card (animated count-up)
- Stats grid: Total Earn, Total Ads, Total Tasks, Total Withdraw
- Reward Code claim card with "Join Community" button → https://t.me/rosepayfi
- Mini app guide section (collapsible cards)

**Task tab**
- Sections: Main Tasks, Partner Tasks, Other Tasks
- Main/Partner: Channel title, amount, [Start] → reveals [Open] [Verify]. Verify calls Telegram `getChatMember` via bot to check membership; on success credits user, on fail shows "Not joined yet".
- Other: title, amount, [Start] → description + [Open] + screenshot upload. Submit → creates pending completion + bot DM to admin (1889290764). Admin approves/rejects from panel; user gets bot notification.

**Watch tab** (center, larger) — "Coming Soon" placeholder. Withdrawals locked while ads count = 0.

**Refer tab**
- Refer link: `https://t.me/RosePayFibot?start=<ref_code>`
- Stats: total referrals, total commission, pending bonuses
- Note: "Referral bonus (1 ROSE) credits AFTER referee completes all main + partner tasks"
- 10% lifetime commission on referee earnings (auto)
- Pending referral list with Claim buttons (when referee is eligible)
- Leaderboard button → top 100 referrers

**Profile / Withdraw**
- Top: avatar, username, copyable Telegram ID
- Available balance (live ROSE → USD via CoinMarketCap, 5min cache)
- [Withdraw] button → checks min_withdraw + min 2 refs + min 10 daily ads; otherwise shows requirement
- Withdraw form: amount (with [Max]), Oasis network address (saved after first use, editable), [Submit]
- History list with status; tap → details view (amount, address, status, tx_id, timestamps)

### Visual design
- Background: dark purple→pink gradient with neon city silhouette + floating rose petals (matching uploaded image)
- Cards: glassmorphism + per-card neon accent colors (pink, purple, gold, cyan)
- Card flip / slide-in animations via framer-motion
- Pop-up reward toast on every credit
- Custom Rose coin SVG/PNG (generated)

## 3. Anti-cheat
- All balance changes happen only inside server functions; client never writes balances
- Verify Telegram channel join via bot `getChatMember` (not client-trusted)
- IP tracking on signup → second account from same IP auto-suspended (first stays), bot notifies admin
- Rate limits on claim/verify endpoints
- Withdraw gated by refs + ads count

## 4. Admin Panel (separate web URL: `/admin`)
Email/password login (stored in `admins` table, bcrypt). Sections:
- **Dashboard** — totals, recent activity
- **Users** — list, search, view profile, suspend/unsuspend, edit balance, view referral history
- **Tasks** — CRUD for main/partner/other tasks
- **Task submissions** — pending screenshots queue, approve/reject (sends bot notification)
- **Withdrawals** — pending queue, approve with TX ID input → posts to https://t.me/rosepayfipayment via bot with [View Transaction] + [Open Mini App] buttons; also DMs user
- **Reward Codes** — create code + amount + max uses, view claims
- **Referrals** — full