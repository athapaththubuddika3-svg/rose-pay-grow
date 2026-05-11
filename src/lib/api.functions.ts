import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  verifyInitData,
  parseInitDataUnsafe,
  getAdminClient,
  genRefCode,
  tgApi,
  ADMIN_CHAT_ID,
  BOT_TOKEN,
} from "./telegram.server";
import { getRequestIP } from "@tanstack/react-start/server";

async function authUser(initData: string, startParam?: string) {
  let parsed = verifyInitData(initData);
  // Dev fallback if bot token missing or verification failed in dev
  if (!parsed && (!BOT_TOKEN || process.env.NODE_ENV !== "production")) {
    parsed = parseInitDataUnsafe(initData);
  }
  if (!parsed) throw new Error("Invalid Telegram initData");
  const sb = getAdminClient();
  const { user: tg } = parsed;
  const sp = startParam || parsed.startParam;

  let { data: existing } = await sb
    .from("app_users")
    .select("*")
    .eq("telegram_id", tg.id)
    .maybeSingle();

  let ip: string | null = null;
  try {
    ip = getRequestIP({ xForwardedFor: true }) || null;
  } catch {}

  if (!existing) {
    let refByUser: any = null;
    if (sp) {
      const { data } = await sb.from("app_users").select("id").eq("ref_code", sp).maybeSingle();
      refByUser = data;
    }
    // Anti-cheat: same IP suspends NEW account
    let suspended = false;
    let suspendReason: string | null = null;
    if (ip) {
      const { data: sameIp } = await sb
        .from("app_users")
        .select("id")
        .eq("ip_address", ip)
        .limit(1)
        .maybeSingle();
      if (sameIp) {
        suspended = true;
        suspendReason = "Multiple accounts from same IP";
      }
    }
    const refCode = genRefCode(tg.id);
    const { data: created, error } = await sb
      .from("app_users")
      .insert({
        telegram_id: tg.id,
        username: tg.username,
        first_name: tg.first_name,
        last_name: tg.last_name,
        photo_url: tg.photo_url,
        ref_code: refCode,
        ref_by: refByUser?.id || null,
        ip_address: ip,
        suspended,
        suspend_reason: suspendReason,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    existing = created;

    if (refByUser && !suspended) {
      await sb.from("referrals").insert({
        referrer_id: refByUser.id,
        referred_id: created.id,
        status: "pending",
        bonus_amount: 1,
      });
      await sb
        .from("app_users")
        .update({ total_ref_count: (await getRefCount(sb, refByUser.id)) })
        .eq("id", refByUser.id);
    }
    if (suspended) {
      try {
        await tgApi("sendMessage", {
          chat_id: ADMIN_CHAT_ID,
          text: `🚨 Suspicious signup auto-suspended\nUser: @${tg.username || tg.first_name} (${tg.id})\nIP: ${ip}`,
        });
      } catch {}
    }
  } else {
    // Update profile fields if changed
    await sb
      .from("app_users")
      .update({
        username: tg.username,
        first_name: tg.first_name,
        photo_url: tg.photo_url,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  }
  return { sb, user: existing, tg };
}

async function getRefCount(sb: any, userId: string): Promise<number> {
  const { count } = await sb
    .from("referrals")
    .select("*", { count: "exact", head: true })
    .eq("referrer_id", userId);
  return count || 0;
}

async function getSettings(sb: any) {
  const { data } = await sb.from("app_settings").select("*");
  const map: Record<string, any> = {};
  (data || []).forEach((r: any) => (map[r.key] = r.value));
  return map;
}

const initInput = z.object({ initData: z.string(), startParam: z.string().optional() });

// === Get profile / home data ===
export const getMe = createServerFn({ method: "POST" })
  .inputValidator((d: { initData: string; startParam?: string }) => initInput.parse(d))
  .handler(async ({ data }) => {
    const { sb, user } = await authUser(data.initData, data.startParam);
    const settings = await getSettings(sb);
    // Live ROSE price from CoinGecko (free)
    let price = 0;
    try {
      const r = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=oasis-network&vs_currencies=usd",
        { headers: { accept: "application/json" } }
      );
      const j = await r.json();
      price = j?.["oasis-network"]?.usd || 0;
    } catch {}
    if (settings.rose_price_override) price = Number(settings.rose_price_override);
    return { user, settings, price };
  });

// === Tasks list ===
export const getTasks = createServerFn({ method: "POST" })
  .inputValidator((d: { initData: string }) => z.object({ initData: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { sb, user } = await authUser(data.initData);
    const { data: tasks } = await sb
      .from("tasks")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    const { data: completions } = await sb
      .from("task_completions")
      .select("*")
      .eq("user_id", user.id);
    return { tasks: tasks || [], completions: completions || [] };
  });

// === Verify channel join (main/partner) ===
export const verifyChannelTask = createServerFn({ method: "POST" })
  .inputValidator((d: { initData: string; taskId: string }) =>
    z.object({ initData: z.string(), taskId: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data }) => {
    const { sb, user, tg } = await authUser(data.initData);
    if (user.suspended) throw new Error("Account suspended");
    const { data: task } = await sb.from("tasks").select("*").eq("id", data.taskId).single();
    if (!task) throw new Error("Task not found");
    if (!["main", "partner"].includes(task.type)) throw new Error("Invalid task type");

    const { data: existing } = await sb
      .from("task_completions")
      .select("*")
      .eq("user_id", user.id)
      .eq("task_id", data.taskId)
      .maybeSingle();
    if (existing && existing.status === "approved") return { ok: true, alreadyDone: true };

    if (!task.channel_username) throw new Error("Task channel not configured");
    const chat = task.channel_username.startsWith("@")
      ? task.channel_username
      : "@" + task.channel_username;
    let isMember = false;
    try {
      const res = await tgApi("getChatMember", { chat_id: chat, user_id: tg.id });
      const status = res?.result?.status;
      isMember = ["member", "administrator", "creator"].includes(status);
    } catch (e) {
      throw new Error("Could not verify, ensure bot is admin in the channel");
    }
    if (!isMember) return { ok: false, message: "You haven't joined the channel yet" };

    // Credit user
    await sb.from("task_completions").upsert(
      {
        user_id: user.id,
        task_id: data.taskId,
        status: "approved",
        reviewed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,task_id" }
    );
    const amount = Number(task.amount);
    await sb
      .from("app_users")
      .update({
        balance: Number(user.balance) + amount,
        total_earned: Number(user.total_earned) + amount,
        total_tasks: user.total_tasks + 1,
      })
      .eq("id", user.id);

    // Referral commission
    await payCommission(sb, user, amount);
    // Maybe activate referral bonus
    await maybeActivateRefBonus(sb, user.id);

    return { ok: true, amount };
  });

// === Submit screenshot task ===
export const submitTaskScreenshot = createServerFn({ method: "POST" })
  .inputValidator((d: { initData: string; taskId: string; screenshotBase64: string }) =>
    z
      .object({
        initData: z.string(),
        taskId: z.string().uuid(),
        screenshotBase64: z.string().min(100).max(8_000_000),
      })
      .parse(d)
  )
  .handler(async ({ data }) => {
    const { sb, user, tg } = await authUser(data.initData);
    if (user.suspended) throw new Error("Account suspended");
    const { data: task } = await sb.from("tasks").select("*").eq("id", data.taskId).single();
    if (!task || task.type !== "other") throw new Error("Invalid task");
    const { data: existing } = await sb
      .from("task_completions")
      .select("*")
      .eq("user_id", user.id)
      .eq("task_id", data.taskId)
      .maybeSingle();
    if (existing) throw new Error("Already submitted");

    // Upload screenshot
    const m = data.screenshotBase64.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!m) throw new Error("Invalid image");
    const buf = Buffer.from(m[2], "base64");
    const ext = m[1].split("/")[1];
    const path = `${user.id}/${data.taskId}-${Date.now()}.${ext}`;
    const { error: upErr } = await sb.storage
      .from("task-screenshots")
      .upload(path, buf, { contentType: m[1], upsert: false });
    if (upErr) throw new Error(upErr.message);
    const url = sb.storage.from("task-screenshots").getPublicUrl(path).data.publicUrl;

    await sb.from("task_completions").insert({
      user_id: user.id,
      task_id: data.taskId,
      status: "pending",
      screenshot_url: url,
    });

    try {
      await tgApi("sendMessage", {
        chat_id: ADMIN_CHAT_ID,
        text: `📋 New task submission\nUser: @${tg.username || tg.first_name} (${tg.id})\nTask: ${task.title}\nAmount: ${task.amount} ROSE\nReview in admin panel.`,
      });
    } catch {}
    return { ok: true };
  });

// === Claim reward code ===
export const claimRewardCode = createServerFn({ method: "POST" })
  .inputValidator((d: { initData: string; code: string }) =>
    z.object({ initData: z.string(), code: z.string().min(1).max(64) }).parse(d)
  )
  .handler(async ({ data }) => {
    const { sb, user } = await authUser(data.initData);
    if (user.suspended) throw new Error("Account suspended");
    const code = data.code.trim().toUpperCase();
    const { data: rc } = await sb
      .from("reward_codes")
      .select("*")
      .eq("code", code)
      .eq("active", true)
      .maybeSingle();
    if (!rc) throw new Error("Invalid code");
    if (rc.used_count >= rc.max_uses) throw new Error("Code limit reached");
    const { data: claimed } = await sb
      .from("reward_code_claims")
      .select("id")
      .eq("code_id", rc.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (claimed) throw new Error("You already claimed this code");
    await sb.from("reward_code_claims").insert({
      code_id: rc.id,
      user_id: user.id,
      amount: rc.amount,
    });
    await sb.from("reward_codes").update({ used_count: rc.used_count + 1 }).eq("id", rc.id);
    const amt = Number(rc.amount);
    await sb
      .from("app_users")
      .update({
        balance: Number(user.balance) + amt,
        total_earned: Number(user.total_earned) + amt,
      })
      .eq("id", user.id);
    return { ok: true, amount: amt };
  });

// === Referral data ===
export const getReferralData = createServerFn({ method: "POST" })
  .inputValidator((d: { initData: string }) => z.object({ initData: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { sb, user } = await authUser(data.initData);
    const settings = await getSettings(sb);
    const { data: refs } = await sb
      .from("referrals")
      .select("*, referred:referred_id(username, first_name, photo_url)")
      .eq("referrer_id", user.id)
      .order("created_at", { ascending: false });
    return {
      user,
      refs: refs || [],
      botUsername: settings.bot_username || "RosePayFibot",
      refBonus: settings.ref_bonus || 1,
      refCommissionPct: settings.ref_commission_pct || 10,
    };
  });

// === Claim referral bonus ===
export const claimRefBonus = createServerFn({ method: "POST" })
  .inputValidator((d: { initData: string; referralId: string }) =>
    z.object({ initData: z.string(), referralId: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data }) => {
    const { sb, user } = await authUser(data.initData);
    const { data: ref } = await sb
      .from("referrals")
      .select("*")
      .eq("id", data.referralId)
      .eq("referrer_id", user.id)
      .single();
    if (!ref) throw new Error("Not found");
    if (ref.status !== "claimable") throw new Error("Not claimable yet");
    await sb
      .from("referrals")
      .update({ status: "claimed", claimed_at: new Date().toISOString() })
      .eq("id", ref.id);
    const amt = Number(ref.bonus_amount);
    await sb
      .from("app_users")
      .update({
        balance: Number(user.balance) + amt,
        total_earned: Number(user.total_earned) + amt,
      })
      .eq("id", user.id);
    return { ok: true, amount: amt };
  });

// === Leaderboard ===
export const getLeaderboard = createServerFn({ method: "POST" })
  .inputValidator((d: { initData: string }) => z.object({ initData: z.string() }).parse(d))
  .handler(async ({ data }) => {
    await authUser(data.initData);
    const sb = getAdminClient();
    const { data: top } = await sb
      .from("app_users")
      .select("username, first_name, photo_url, total_ref_count, total_ref_commission")
      .eq("suspended", false)
      .order("total_ref_count", { ascending: false })
      .limit(100);
    return { top: top || [] };
  });

// === Withdraw ===
export const requestWithdraw = createServerFn({ method: "POST" })
  .inputValidator((d: { initData: string; amount: number; address: string }) =>
    z
      .object({
        initData: z.string(),
        amount: z.number().positive(),
        address: z.string().min(4).max(200),
      })
      .parse(d)
  )
  .handler(async ({ data }) => {
    const { sb, user, tg } = await authUser(data.initData);
    if (user.suspended) throw new Error("Account suspended");
    const settings = await getSettings(sb);
    const minWithdraw = Number(settings.min_withdraw || 10);
    const minRefs = Number(settings.min_refs_for_withdraw || 2);
    const minAds = Number(settings.min_daily_ads_for_withdraw || 10);
    if (data.amount < minWithdraw) throw new Error(`Minimum withdraw is ${minWithdraw} ROSE`);
    if (data.amount > Number(user.balance)) throw new Error("Insufficient balance");
    if (user.total_ref_count < minRefs)
      throw new Error(`Need at least ${minRefs} referrals`);
    if (user.total_ads < minAds) throw new Error(`Need at least ${minAds} daily ads`);

    // Save wallet & deduct balance immediately (locked in withdrawal)
    await sb
      .from("app_users")
      .update({
        wallet_address: data.address,
        balance: Number(user.balance) - data.amount,
      })
      .eq("id", user.id);

    const { data: wd } = await sb
      .from("withdrawals")
      .insert({
        user_id: user.id,
        amount: data.amount,
        wallet_address: data.address,
        status: "pending",
      })
      .select("*")
      .single();

    try {
      await tgApi("sendMessage", {
        chat_id: ADMIN_CHAT_ID,
        text: `💰 New withdrawal request\nUser: @${tg.username || tg.first_name} (${tg.id})\nAmount: ${data.amount} ROSE\nAddress: \`${data.address}\`\nTotal Refs: ${user.total_ref_count}\nTotal Withdrawn: ${user.total_withdraw} ROSE`,
        parse_mode: "Markdown",
      });
    } catch {}
    return { ok: true, withdrawal: wd };
  });

// === Withdraw history ===
export const getWithdrawals = createServerFn({ method: "POST" })
  .inputValidator((d: { initData: string }) => z.object({ initData: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { sb, user } = await authUser(data.initData);
    const { data: list } = await sb
      .from("withdrawals")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    return { list: list || [] };
  });

// === Set notifications opted-in ===
export const setNotifEnabled = createServerFn({ method: "POST" })
  .inputValidator((d: { initData: string }) => z.object({ initData: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { sb, user, tg } = await authUser(data.initData);
    await sb.from("app_users").update({ notif_enabled: true }).eq("id", user.id);
    try {
      await tgApi("sendMessage", {
        chat_id: tg.id,
        text: "🌹 Welcome to RosePayFi! You'll now receive notifications here.",
      });
    } catch {}
    return { ok: true };
  });

// === helpers ===
async function payCommission(sb: any, user: any, earnedAmount: number) {
  if (!user.ref_by) return;
  const settings = await getSettings(sb);
  const pct = Number(settings.ref_commission_pct || 10);
  const com = (earnedAmount * pct) / 100;
  if (com <= 0) return;
  const { data: refUser } = await sb
    .from("app_users")
    .select("*")
    .eq("id", user.ref_by)
    .single();
  if (!refUser || refUser.suspended) return;
  await sb
    .from("app_users")
    .update({
      balance: Number(refUser.balance) + com,
      total_earned: Number(refUser.total_earned) + com,
      total_ref_commission: Number(refUser.total_ref_commission) + com,
    })
    .eq("id", refUser.id);
}

async function maybeActivateRefBonus(sb: any, userId: string) {
  // Check if user has completed all main + partner tasks
  const { data: required } = await sb
    .from("tasks")
    .select("id")
    .in("type", ["main", "partner"])
    .eq("active", true);
  const requiredIds = (required || []).map((t: any) => t.id);
  if (requiredIds.length === 0) return;
  const { data: done } = await sb
    .from("task_completions")
    .select("task_id")
    .eq("user_id", userId)
    .eq("status", "approved")
    .in("task_id", requiredIds);
  if ((done || []).length < requiredIds.length) return;
  // Mark referral claimable
  await sb
    .from("referrals")
    .update({ status: "claimable" })
    .eq("referred_id", userId)
    .eq("status", "pending");
}
