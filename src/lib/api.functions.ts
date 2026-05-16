import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  verifyInitData,
  parseInitDataUnsafe,
  getAdminClient,
  tgApi,
  ADMIN_CHAT_ID,
  BOT_TOKEN,
  appKeyboard,
} from "./telegram.server";
import { getRequest, getRequestIP } from "@tanstack/react-start/server";

function readRequestIp() {
  try {
    const request = getRequest();
    const forwarded =
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-real-ip") ||
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded;
  } catch {}

  try {
    return getRequestIP({ xForwardedFor: true }) || null;
  } catch {
    return null;
  }
}

async function authUser(initData: string, startParam?: string) {
  let parsed = verifyInitData(initData);
  const allowUnsafeDevInit = initData.includes("hash=DEV");
  if (!parsed && (!BOT_TOKEN || process.env.NODE_ENV !== "production" || allowUnsafeDevInit)) {
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

  const ip = readRequestIp();

  if (!existing) {
    let refByUser: any = null;
    if (sp) {
      const spClean = sp.replace(/^ref_?/i, "").trim();
      const asNum = Number(spClean);
      if (Number.isFinite(asNum) && asNum > 0 && asNum !== tg.id) {
        const { data } = await sb
          .from("app_users")
          .select("id, telegram_id, username, first_name, ip_address")
          .eq("telegram_id", asNum)
          .maybeSingle();
        refByUser = data;
      }
      if (!refByUser) {
        const { data } = await sb
          .from("app_users")
          .select("id, telegram_id, username, first_name, ip_address")
          .eq("ref_code", spClean)
          .maybeSingle();
        refByUser = data;
      }
    }
    let suspended = false;
    let suspendReason: string | null = null;
    let blockReferral = false;
    if (ip) {
      const { data: sameIp } = await sb
        .from("app_users")
        .select("id, telegram_id, username, first_name")
        .eq("ip_address", ip)
        .limit(1)
        .maybeSingle();
      if (sameIp) {
        suspended = true;
        suspendReason = "Multiple accounts from same IP";
        blockReferral = true;
      }
    }
    const refCode = String(tg.id);
    const { data: created, error } = await sb
      .from("app_users")
      .insert({
        telegram_id: tg.id,
        username: tg.username,
        first_name: tg.first_name,
        last_name: tg.last_name,
        photo_url: tg.photo_url,
        ref_code: refCode,
        ref_by: !blockReferral && refByUser ? refByUser.id : null,
        ip_address: ip,
        suspended,
        suspend_reason: suspendReason,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    existing = created;

    // Notify admin of every new signup
    try {
      await tgApi("sendMessage", {
        chat_id: ADMIN_CHAT_ID,
        text: `🌹 <b>New user joined RosePayFi</b>\nName: ${tg.first_name || ""} ${tg.last_name || ""}\nUsername: @${tg.username || "—"}\nTelegram ID: <code>${tg.id}</code>\nIP: <code>${ip || "—"}</code>${refByUser ? `\nReferred by: @${refByUser.username || refByUser.first_name} (${refByUser.telegram_id})${blockReferral ? " ⛔ blocked (same IP)" : ""}` : ""}${suspended ? `\n⚠️ Auto-suspended: ${suspendReason}` : ""}`,
        parse_mode: "HTML",
      });
    } catch {}

    if (suspended) {
      // Notify the new user
      try {
        await tgApi("sendMessage", {
          chat_id: tg.id,
          text: `⛔ Your account has been auto-suspended.\nReason: ${suspendReason}\n\nIf you think this is a mistake, contact @RosePayFiSupport.`,
        });
      } catch {}
    }

    if (!blockReferral && refByUser && !suspended) {
      await sb.from("referrals").insert({
        referrer_id: refByUser.id,
        referred_id: created.id,
        status: "pending",
        bonus_amount: 1,
      });
      await sb
        .from("app_users")
        .update({ total_ref_count: await getRefCount(sb, refByUser.id) })
        .eq("id", refByUser.id);
      try {
        await tgApi("sendMessage", {
          chat_id: refByUser.telegram_id,
          text: `🎉 <b>New referral!</b>\n@${tg.username || tg.first_name} just joined using your link.\n\n💎 Bonus will unlock once they complete all main + partner tasks.`,
          parse_mode: "HTML",
          reply_markup: appKeyboard(),
        });
      } catch {}
    }
  } else {
    if (ip) {
      const { data: sameIpUser } = await sb
        .from("app_users")
        .select("id, telegram_id")
        .eq("ip_address", ip)
        .neq("id", existing.id)
        .limit(1)
        .maybeSingle();

      if (sameIpUser && !existing.suspended) {
        await sb
          .from("app_users")
          .update({
            suspended: true,
            suspend_reason: "Multiple accounts from same IP",
          })
          .eq("id", existing.id);

        existing = {
          ...existing,
          suspended: true,
          suspend_reason: "Multiple accounts from same IP",
        };
      }
    }

    await sb
      .from("app_users")
      .update({
        username: tg.username,
        first_name: tg.first_name,
        photo_url: tg.photo_url,
        ip_address: existing.ip_address || ip,
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

/** Anti-cheat: ensure balance never exceeds total_earned - total_withdraw + small grace.
 * If exceeded, suspend user, notify admin & user. */
async function balanceAudit(sb: any, user: any) {
  const expected = Number(user.total_earned) - Number(user.total_withdraw);
  const actual = Number(user.balance);
  const diff = actual - expected;
  if (diff > 0.0001) {
    await sb.from("balance_audits").insert({
      user_id: user.id,
      expected,
      actual,
      diff,
    });
    await sb
      .from("app_users")
      .update({
        suspended: true,
        suspend_reason: `Balance manipulation detected (+${diff.toFixed(4)} ROSE)`,
        balance: Math.max(0, expected),
      })
      .eq("id", user.id);
    try {
      await tgApi("sendMessage", {
        chat_id: ADMIN_CHAT_ID,
        text: `🚨 <b>Balance fraud detected</b>\nUser: @${user.username || user.first_name} (${user.telegram_id})\nExpected: ${expected.toFixed(4)} ROSE\nActual: ${actual.toFixed(4)} ROSE\nDiff: <b>+${diff.toFixed(4)}</b>\n→ Auto-suspended.`,
        parse_mode: "HTML",
      });
    } catch {}
    try {
      await tgApi("sendMessage", {
        chat_id: user.telegram_id,
        text: `⛔ Your account has been suspended.\nReason: Balance manipulation detected.\nContact @RosePayFiSupport if you believe this is a mistake.`,
      });
    } catch {}
    throw new Error("Account suspended (balance audit)");
  }
}

const initInput = z.object({ initData: z.string(), startParam: z.string().optional() });

// === Get profile / home data ===
export const getMe = createServerFn({ method: "POST" })
  .inputValidator((d: { initData: string; startParam?: string }) => initInput.parse(d))
  .handler(async ({ data }) => {
    const { sb, user } = await authUser(data.initData, data.startParam);
    const settings = await getSettings(sb);
    let price = 0;
    try {
      const r = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=oasis-network&vs_currencies=usd",
        { headers: { accept: "application/json" } },
      );
      if (r.ok) {
        const j: any = await r.json();
        price = Number(j?.["oasis-network"]?.usd) || 0;
      }
    } catch {}
    if (!price) {
      // Fallback: Binance
      try {
        const r = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=ROSEUSDT");
        if (r.ok) {
          const j: any = await r.json();
          price = Number(j?.price) || 0;
        }
      } catch {}
    }
    const override = Number(settings.rose_price_override || 0);
    if (override > 0) price = override;
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

// === Verify channel join ===
export const verifyChannelTask = createServerFn({ method: "POST" })
  .inputValidator((d: { initData: string; taskId: string }) =>
    z.object({ initData: z.string(), taskId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { sb, user, tg } = await authUser(data.initData);
    if (user.suspended) throw new Error("Account suspended");
    await balanceAudit(sb, user);
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
    } catch {
      throw new Error("Could not verify, ensure bot is admin in the channel");
    }
    if (!isMember) return { ok: false, message: "You haven't joined the channel yet" };

    await sb.from("task_completions").upsert(
      {
        user_id: user.id,
        task_id: data.taskId,
        status: "approved",
        reviewed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,task_id" },
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

    await payCommission(sb, user, amount);
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
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { sb, user, tg } = await authUser(data.initData);
    if (user.suspended) throw new Error("Account suspended");
    await balanceAudit(sb, user);
    const { data: task } = await sb.from("tasks").select("*").eq("id", data.taskId).single();
    if (!task || task.type !== "other") throw new Error("Invalid task");
    const { data: existing } = await sb
      .from("task_completions")
      .select("*")
      .eq("user_id", user.id)
      .eq("task_id", data.taskId)
      .maybeSingle();
    if (existing) throw new Error("Already submitted");

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
        text: `📋 New task submission\nUser: @${tg.username || tg.first_name} (${tg.id})\nTask: ${task.title}\nAmount: ${task.amount} ROSE`,
      });
    } catch {}
    try {
      await tgApi("sendMessage", {
        chat_id: tg.id,
        text: `⏳ Task submitted: <b>${task.title}</b>\nAwaiting admin review. You'll be notified when approved.`,
        parse_mode: "HTML",
        reply_markup: appKeyboard(),
      });
    } catch {}
    return { ok: true };
  });

// === Claim reward code ===
export const claimRewardCode = createServerFn({ method: "POST" })
  .inputValidator((d: { initData: string; code: string }) =>
    z.object({ initData: z.string(), code: z.string().min(1).max(64) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { sb, user } = await authUser(data.initData);
    if (user.suspended) throw new Error("Account suspended");
    await balanceAudit(sb, user);
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
    await sb
      .from("reward_codes")
      .update({ used_count: rc.used_count + 1 })
      .eq("id", rc.id);
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

// === Daily bonus ===
export const claimDailyBonus = createServerFn({ method: "POST" })
  .inputValidator((d: { initData: string }) => z.object({ initData: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { sb, user } = await authUser(data.initData);
    if (user.suspended) throw new Error("Account suspended");
    await balanceAudit(sb, user);
    const settings = await getSettings(sb);
    const amount = Number(settings.daily_bonus_amount || 0.05);
    const last = user.last_daily_bonus_at ? new Date(user.last_daily_bonus_at) : null;
    if (last) {
      // Reset at next 00:00 UTC after last claim
      const nextReset = new Date(
        Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate() + 1),
      );
      if (Date.now() < nextReset.getTime()) {
        const wait = nextReset.getTime() - Date.now();
        return { ok: false, waitMs: wait, message: "Already claimed today" };
      }
    }
    await sb.from("daily_bonus_claims").insert({ user_id: user.id, amount });
    await sb
      .from("app_users")
      .update({
        last_daily_bonus_at: new Date().toISOString(),
        balance: Number(user.balance) + amount,
        total_earned: Number(user.total_earned) + amount,
      })
      .eq("id", user.id);
    return { ok: true, amount };
  });

// === Watch ad complete (rewarded watch ads tab) ===
export const completeAdWatch = createServerFn({ method: "POST" })
  .inputValidator((d: { initData: string; durationSec: number; blockId: string }) =>
    z
      .object({
        initData: z.string(),
        durationSec: z.number().int().min(0).max(600),
        blockId: z.string().min(1).max(64),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { sb, user } = await authUser(data.initData);
    if (user.suspended) throw new Error("Account suspended");
    await balanceAudit(sb, user);
    const settings = await getSettings(sb);
    const minWatch = Number(settings.ad_min_watch_rew || 33);
    if (data.durationSec < minWatch) {
      throw new Error("Ad not watched fully — please watch the entire ad to earn your reward.");
    }
    const reward = Number(settings.ad_reward || 0.05);
    const dailyLimit = Number(settings.ad_daily_limit || 40);
    const sessionLimit = Number(settings.ad_session_limit || 20);
    const sessionHours = Number(settings.ad_session_hours || 12);

    // Reset daily counter at UTC midnight
    const now = new Date();
    let dailyCount = user.daily_ads_count || 0;
    let dailyResetAt = user.daily_ads_reset_at ? new Date(user.daily_ads_reset_at) : new Date(0);
    const lastResetDay = Date.UTC(
      dailyResetAt.getUTCFullYear(),
      dailyResetAt.getUTCMonth(),
      dailyResetAt.getUTCDate(),
    );
    const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    if (todayUtc > lastResetDay) {
      dailyCount = 0;
      dailyResetAt = now;
    }
    if (dailyCount >= dailyLimit) throw new Error(`Daily limit reached (${dailyLimit} ads)`);

    let sessionCount = user.session_ads_count || 0;
    const sessionStart = user.session_ads_started_at ? new Date(user.session_ads_started_at) : null;
    const sessionExpired =
      !sessionStart || now.getTime() - sessionStart.getTime() >= sessionHours * 3600_000;
    let newSessionStart = sessionStart;
    if (sessionExpired) {
      sessionCount = 0;
      newSessionStart = now;
    }
    if (sessionCount >= sessionLimit) {
      const elapsed = sessionStart ? now.getTime() - sessionStart.getTime() : 0;
      const remainMs = Math.max(0, sessionHours * 3600_000 - elapsed);
      return {
        ok: false,
        cooldown: true,
        remainMs,
        message: `Session limit reached. Try again in ${Math.ceil(remainMs / 3600_000)}h`,
      };
    }

    sessionCount += 1;
    dailyCount += 1;

    await sb.from("ad_watches").insert({
      user_id: user.id,
      kind: "watch",
      block_id: data.blockId,
      duration_sec: data.durationSec,
      reward,
    });
    await sb
      .from("app_users")
      .update({
        balance: Number(user.balance) + reward,
        total_earned: Number(user.total_earned) + reward,
        total_ads: user.total_ads + 1,
        daily_ads_count: dailyCount,
        daily_ads_reset_at: dailyResetAt.toISOString(),
        session_ads_count: sessionCount,
        session_ads_started_at: newSessionStart!.toISOString(),
      })
      .eq("id", user.id);

    await payCommission(sb, user, reward);
    return { ok: true, amount: reward, sessionCount, sessionLimit, dailyCount, dailyLimit };
  });

// === Watch-ad gate (for claim/withdraw ads, no reward, just verifies the user watched) ===
export const recordGateAd = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { initData: string; durationSec: number; blockId: string; purpose: string }) =>
      z
        .object({
          initData: z.string(),
          durationSec: z.number().int().min(0).max(600),
          blockId: z.string().min(1).max(64),
          purpose: z.string().min(1).max(32),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    const { sb, user } = await authUser(data.initData);
    if (user.suspended) throw new Error("Account suspended");
    const settings = await getSettings(sb);
    const minWatch = Number(settings.ad_min_watch_rew || 33);
    if (data.durationSec < minWatch) {
      throw new Error("Ad not watched fully — please watch the entire ad.");
    }
    await sb.from("ad_watches").insert({
      user_id: user.id,
      kind: "gate",
      block_id: data.blockId,
      duration_sec: data.durationSec,
      reward: 0,
    });
    if (data.purpose === "withdraw") {
      await sb
        .from("app_users")
        .update({ withdraw_ads_done: (user.withdraw_ads_done || 0) + 1 })
        .eq("id", user.id);
    }
    return { ok: true };
  });

// === Auto interstitial recorder (no reward, no min check) ===
export const recordAutoAd = createServerFn({ method: "POST" })
  .inputValidator((d: { initData: string; durationSec: number; blockId: string }) =>
    z
      .object({
        initData: z.string(),
        durationSec: z.number().int().min(0).max(600),
        blockId: z.string().min(1).max(64),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { sb, user } = await authUser(data.initData);
    if (user.suspended) return { ok: true };
    await sb.from("ad_watches").insert({
      user_id: user.id,
      kind: "auto",
      block_id: data.blockId,
      duration_sec: data.durationSec,
      reward: 0,
    });
    return { ok: true };
  });

// === Ad Task: complete + claim ===
export const completeAdTask = createServerFn({ method: "POST" })
  .inputValidator((d: { initData: string; durationSec?: number; blockId?: string }) =>
    z
      .object({
        initData: z.string(),
        durationSec: z.number().int().min(0).max(600).optional(),
        blockId: z.string().min(1).max(64).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { sb, user } = await authUser(data.initData);
    if (user.suspended) throw new Error("Account suspended");
    await balanceAudit(sb, user);
    const settings = await getSettings(sb);
    const minWatch = Number(settings.ad_min_watch_task || settings.ad_min_watch_rew || 33);
    const reward = Number(settings.ad_task_reward || 0.02);
    const limit = Number(settings.ad_task_daily_limit || 15);
    const cooldownSec = Number(settings.ad_task_cooldown_sec || 10);

    if (typeof data.durationSec === "number" && data.durationSec < minWatch) {
      throw new Error(`Task ad not watched fully — watch at least ${minWatch} seconds.`);
    }

    const now = new Date();
    let count = user.daily_ad_tasks_count || 0;
    const resetAt = user.daily_ad_tasks_reset_at
      ? new Date(user.daily_ad_tasks_reset_at)
      : new Date(0);
    const lastDay = Date.UTC(resetAt.getUTCFullYear(), resetAt.getUTCMonth(), resetAt.getUTCDate());
    const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    let newReset = resetAt;
    if (todayUtc > lastDay) {
      count = 0;
      newReset = now;
    }
    if (count >= limit) throw new Error(`Daily ad-task limit reached (${limit})`);

    if (user.last_ad_task_claim_at) {
      const since = (now.getTime() - new Date(user.last_ad_task_claim_at).getTime()) / 1000;
      if (since < cooldownSec) {
        throw new Error(`Wait ${Math.ceil(cooldownSec - since)}s before next task`);
      }
    }

    await sb.from("ad_task_completions").insert({ user_id: user.id, reward });
    if (data.blockId && typeof data.durationSec === "number") {
      await sb.from("ad_watches").insert({
        user_id: user.id,
        kind: "task",
        block_id: data.blockId,
        duration_sec: data.durationSec,
        reward,
      });
    }
    await sb
      .from("app_users")
      .update({
        balance: Number(user.balance) + reward,
        total_earned: Number(user.total_earned) + reward,
        daily_ad_tasks_count: count + 1,
        daily_ad_tasks_reset_at: newReset.toISOString(),
        last_ad_task_claim_at: now.toISOString(),
      })
      .eq("id", user.id);

    await payCommission(sb, user, reward);
    return { ok: true, amount: reward, count: count + 1, limit };
  });

// === Referral data ===
export const getReferralData = createServerFn({ method: "POST" })
  .inputValidator((d: { initData: string }) => z.object({ initData: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { sb, user } = await authUser(data.initData);
    const settings = await getSettings(sb);
    const { data: refs } = await sb
      .from("referrals")
      .select("*, referred:referred_id(username, first_name, photo_url, telegram_id)")
      .eq("referrer_id", user.id)
      .order("created_at", { ascending: false });
    return {
      user,
      refs: refs || [],
      botUsername: settings.bot_username || "RosePayFibot",
      refBonus: settings.ref_bonus || 1,
      refCommissionPct: settings.ref_commission_pct || 10,
      shareImage:
        settings.app_share_image || "https://rose-pay-grow.lovable.app/rosepayfi-share.jpg",
      shareText: settings.app_share_text || "🌹 Join RosePayFi and earn ROSE inside Telegram!",
      antiCheatNote:
        "Multiple accounts from the same IP will be auto-suspended and referral rewards will be blocked.",
    };
  });

// === Claim referral bonus ===
export const claimRefBonus = createServerFn({ method: "POST" })
  .inputValidator((d: { initData: string; referralId: string }) =>
    z.object({ initData: z.string(), referralId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { sb, user } = await authUser(data.initData);
    if (user.suspended) throw new Error("Account suspended");
    await balanceAudit(sb, user);
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
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { sb, user, tg } = await authUser(data.initData);
    if (user.suspended) throw new Error("Account suspended");
    await balanceAudit(sb, user);
    const settings = await getSettings(sb);
    const minWithdraw = Number(settings.min_withdraw || 1);
    const maxWithdraw = Number(settings.max_withdraw || 10);
    const fee = Number(settings.withdraw_fee || 0.5);
    const minRefs = Number(settings.min_refs_for_withdraw || 2);
    const minAds = Number(settings.min_daily_ads_for_withdraw || 10);
    const adsRequired = Number(settings.withdraw_ads_required || 2);
    if (data.amount < minWithdraw) throw new Error(`Minimum withdraw is ${minWithdraw} ROSE`);
    if (data.amount > maxWithdraw)
      throw new Error(`Maximum withdraw is ${maxWithdraw} ROSE per request`);
    if (data.amount > Number(user.balance)) throw new Error("Insufficient balance");
    if (user.total_ref_count < minRefs) throw new Error(`Need at least ${minRefs} referrals`);
    const dailyResetAt = user.daily_ads_reset_at ? new Date(user.daily_ads_reset_at) : new Date(0);
    const lastDay = Date.UTC(
      dailyResetAt.getUTCFullYear(),
      dailyResetAt.getUTCMonth(),
      dailyResetAt.getUTCDate(),
    );
    const todayUtc = Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate(),
    );
    const todayAdCount = todayUtc > lastDay ? 0 : Number(user.daily_ads_count || 0);
    if (todayAdCount < minAds) throw new Error(`Need at least ${minAds} ads watched today`);
    if ((user.withdraw_ads_done || 0) < adsRequired)
      throw new Error(`Watch ${adsRequired} ads before withdrawing`);

    // Check all main + partner tasks done
    const { data: required } = await sb
      .from("tasks")
      .select("id")
      .in("type", ["main", "partner"])
      .eq("active", true);
    const requiredIds = (required || []).map((t: any) => t.id);
    if (requiredIds.length) {
      const { data: done } = await sb
        .from("task_completions")
        .select("task_id")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .in("task_id", requiredIds);
      if ((done || []).length < requiredIds.length) {
        throw new Error("Complete ALL Main + Partner tasks before withdrawing");
      }
    }

    const net = data.amount - fee;
    if (net <= 0) throw new Error("Amount must exceed withdrawal fee");

    await sb
      .from("app_users")
      .update({
        wallet_address: data.address,
        balance: Number(user.balance) - data.amount,
        withdraw_ads_done: 0, // reset gate counter
      })
      .eq("id", user.id);

    const { data: wd } = await sb
      .from("withdrawals")
      .insert({
        user_id: user.id,
        amount: net,
        wallet_address: data.address,
        status: "pending",
      })
      .select("*")
      .single();

    try {
      await tgApi("sendMessage", {
        chat_id: ADMIN_CHAT_ID,
        text: `💰 New withdrawal request\nUser: @${tg.username || tg.first_name} (${tg.id})\nGross: ${data.amount} ROSE\nFee: ${fee} ROSE\nNet: <b>${net} ROSE</b>\nAddress: <code>${data.address}</code>\nTotal Refs: ${user.total_ref_count}`,
        parse_mode: "HTML",
      });
    } catch {}
    try {
      await tgApi("sendMessage", {
        chat_id: tg.id,
        text: `✅ <b>Withdrawal request success</b>\nGross: ${data.amount} ROSE\nFee: ${fee} ROSE\nNet payout: <b>${net} ROSE</b>\n\nYour withdrawal will be processed within 24 hours.`,
        parse_mode: "HTML",
        reply_markup: appKeyboard(),
      });
    } catch {}
    return {
      ok: true,
      withdrawal: wd,
      fee,
      net,
      gross: data.amount,
      successMessage: `Withdrawal request success. Net payout ${net.toFixed(2)} ROSE will arrive within 24 hours.`,
    };
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
        reply_markup: appKeyboard(),
      });
    } catch {}
    return { ok: true };
  });

// === Stats for Watch Ads tab ===
export const getEarnStats = createServerFn({ method: "POST" })
  .inputValidator((d: { initData: string }) => z.object({ initData: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { sb, user } = await authUser(data.initData);
    const settings = await getSettings(sb);
    const now = new Date();

    // Daily ads
    const dailyResetAt = user.daily_ads_reset_at ? new Date(user.daily_ads_reset_at) : new Date(0);
    const lastDay = Date.UTC(
      dailyResetAt.getUTCFullYear(),
      dailyResetAt.getUTCMonth(),
      dailyResetAt.getUTCDate(),
    );
    const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const dailyCount = todayUtc > lastDay ? 0 : user.daily_ads_count || 0;

    // Session
    const sessionLimit = Number(settings.ad_session_limit || 20);
    const sessionHours = Number(settings.ad_session_hours || 12);
    const sessionStart = user.session_ads_started_at ? new Date(user.session_ads_started_at) : null;
    const sessionExpired =
      !sessionStart || now.getTime() - sessionStart.getTime() >= sessionHours * 3600_000;
    const sessionCount = sessionExpired ? 0 : user.session_ads_count || 0;
    let sessionRemainMs = 0;
    if (!sessionExpired && sessionCount >= sessionLimit) {
      sessionRemainMs = sessionHours * 3600_000 - (now.getTime() - sessionStart!.getTime());
    }

    // Ad task
    const taskResetAt = user.daily_ad_tasks_reset_at
      ? new Date(user.daily_ad_tasks_reset_at)
      : new Date(0);
    const lastTaskDay = Date.UTC(
      taskResetAt.getUTCFullYear(),
      taskResetAt.getUTCMonth(),
      taskResetAt.getUTCDate(),
    );
    const taskCount = todayUtc > lastTaskDay ? 0 : user.daily_ad_tasks_count || 0;
    const cooldownSec = Number(settings.ad_task_cooldown_sec || 10);
    let cooldownRemainMs = 0;
    if (user.last_ad_task_claim_at) {
      const since = now.getTime() - new Date(user.last_ad_task_claim_at).getTime();
      if (since < cooldownSec * 1000) cooldownRemainMs = cooldownSec * 1000 - since;
    }

    // Daily bonus
    const last = user.last_daily_bonus_at ? new Date(user.last_daily_bonus_at) : null;
    let bonusReady = true;
    let bonusRemainMs = 0;
    if (last) {
      const nextReset = new Date(
        Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate() + 1),
      );
      if (Date.now() < nextReset.getTime()) {
        bonusReady = false;
        bonusRemainMs = nextReset.getTime() - Date.now();
      }
    }

    return {
      settings,
      ads: {
        dailyCount,
        dailyLimit: Number(settings.ad_daily_limit || 40),
        sessionCount,
        sessionLimit,
        sessionRemainMs,
        reward: Number(settings.ad_reward || 0.05),
        blockId: String(settings.ad_block_rew || "30047"),
      },
      adTask: {
        count: taskCount,
        limit: Number(settings.ad_task_daily_limit || 15),
        cooldownRemainMs,
        reward: Number(settings.ad_task_reward || 0.02),
        blockId: String(settings.ad_task_block || "task-30049"),
        minWatchSec: Number(settings.ad_min_watch_task || settings.ad_min_watch_rew || 33),
      },
      bonus: {
        ready: bonusReady,
        remainMs: bonusRemainMs,
        amount: Number(settings.daily_bonus_amount || 0.05),
      },
      withdraw: {
        adsDone: user.withdraw_ads_done || 0,
        adsRequired: Number(settings.withdraw_ads_required || 2),
      },
    };
  });

// === helpers ===
async function payCommission(sb: any, user: any, earnedAmount: number) {
  if (!user.ref_by) return;
  const settings = await getSettings(sb);
  const pct = Number(settings.ref_commission_pct || 10);
  const com = (earnedAmount * pct) / 100;
  if (com <= 0) return;
  const { data: refUser } = await sb.from("app_users").select("*").eq("id", user.ref_by).single();
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
  const { data: activated } = await sb
    .from("referrals")
    .update({ status: "claimable" })
    .eq("referred_id", userId)
    .eq("status", "pending")
    .select("referrer_id, bonus_amount");
  for (const r of activated || []) {
    const { data: ref } = await sb
      .from("app_users")
      .select("telegram_id")
      .eq("id", r.referrer_id)
      .maybeSingle();
    const { data: who } = await sb
      .from("app_users")
      .select("username, first_name")
      .eq("id", userId)
      .maybeSingle();
    if (ref?.telegram_id) {
      try {
        await tgApi("sendMessage", {
          chat_id: ref.telegram_id,
          text: `✅ <b>Referral bonus ready!</b>\n@${who?.username || who?.first_name || "Your referral"} completed all tasks.\n\n🌹 Open the app and claim your <b>${r.bonus_amount} ROSE</b> bonus.`,
          parse_mode: "HTML",
          reply_markup: appKeyboard(),
        });
      } catch {}
    }
  }
}
