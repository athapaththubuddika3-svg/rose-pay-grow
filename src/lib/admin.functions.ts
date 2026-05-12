import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getAdminClient, tgApi } from "./telegram.server";

async function requireAdmin(token: string) {
  if (!token) throw new Error("Unauthorized");
  const sb = getAdminClient();
  const { data } = await sb
    .from("admin_sessions")
    .select("*, admin:admin_id(id, email)")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!data) throw new Error("Session expired");
  return { sb, admin: (data as any).admin };
}

function genToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// === Admin login ===
export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; password: string }) =>
    z.object({ email: z.string().email(), password: z.string().min(4) }).parse(d)
  )
  .handler(async ({ data }) => {
    const sb = getAdminClient();
    const { data: admin } = await sb
      .from("admins")
      .select("*")
      .eq("email", data.email.toLowerCase())
      .maybeSingle();

    // Bootstrap first admin from env if no admins exist yet
    if (!admin) {
      const { count } = await sb.from("admins").select("*", { count: "exact", head: true });
      const bootstrapEmail = (process.env.ADMIN_EMAIL || "admin@rosepayfi.com").toLowerCase();
      const bootstrapPass = process.env.ADMIN_PASSWORD || "RosePayFi2026!";
      if ((count || 0) === 0 && data.email.toLowerCase() === bootstrapEmail && data.password === bootstrapPass) {
        const hash = await bcrypt.hash(bootstrapPass, 10);
        const { data: created } = await sb
          .from("admins")
          .insert({ email: bootstrapEmail, password_hash: hash })
          .select("*")
          .single();
        const token = genToken();
        const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        await sb.from("admin_sessions").insert({ admin_id: created!.id, token, expires_at: expires });
        return { token, email: bootstrapEmail };
      }
      throw new Error("Invalid credentials");
    }

    const ok = await bcrypt.compare(data.password, admin.password_hash);
    if (!ok) throw new Error("Invalid credentials");
    const token = genToken();
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await sb.from("admin_sessions").insert({ admin_id: admin.id, token, expires_at: expires });
    return { token, email: admin.email };
  });

export const adminMe = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { admin } = await requireAdmin(data.token);
    return { admin };
  });

// === Stats ===
export const adminStats = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { sb } = await requireAdmin(data.token);
    const [users, tasks, withdrawals, codes] = await Promise.all([
      sb.from("app_users").select("*", { count: "exact", head: true }),
      sb.from("task_completions").select("*", { count: "exact", head: true }).eq("status", "pending"),
      sb.from("withdrawals").select("*", { count: "exact", head: true }).eq("status", "pending"),
      sb.from("reward_codes").select("*", { count: "exact", head: true }).eq("active", true),
    ]);
    const { data: totals } = await sb.from("app_users").select("balance, total_earned, total_withdraw");
    const sumBal = (totals || []).reduce((a, r: any) => a + Number(r.balance), 0);
    const sumEarn = (totals || []).reduce((a, r: any) => a + Number(r.total_earned), 0);
    const sumWd = (totals || []).reduce((a, r: any) => a + Number(r.total_withdraw), 0);
    return {
      totalUsers: users.count || 0,
      pendingTasks: tasks.count || 0,
      pendingWithdrawals: withdrawals.count || 0,
      activeCodes: codes.count || 0,
      sumBalance: sumBal,
      sumEarned: sumEarn,
      sumWithdraw: sumWd,
    };
  });

// === Users ===
export const adminListUsers = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; search?: string }) =>
    z.object({ token: z.string(), search: z.string().optional() }).parse(d)
  )
  .handler(async ({ data }) => {
    const { sb } = await requireAdmin(data.token);
    let q = sb.from("app_users").select("*").order("created_at", { ascending: false }).limit(500);
    if (data.search) {
      q = q.or(`username.ilike.%${data.search}%,first_name.ilike.%${data.search}%,telegram_id.eq.${Number(data.search) || 0}`);
    }
    const { data: list } = await q;
    return { users: list || [] };
  });

export const adminUpdateUser = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { token: string; userId: string; suspended?: boolean; balance?: number; suspendReason?: string }) =>
      z
        .object({
          token: z.string(),
          userId: z.string().uuid(),
          suspended: z.boolean().optional(),
          balance: z.number().optional(),
          suspendReason: z.string().optional(),
        })
        .parse(d)
  )
  .handler(async ({ data }) => {
    const { sb } = await requireAdmin(data.token);
    const upd: any = {};
    if (data.suspended !== undefined) upd.suspended = data.suspended;
    if (data.suspendReason !== undefined) upd.suspend_reason = data.suspendReason;
    if (data.balance !== undefined) upd.balance = data.balance;
    await sb.from("app_users").update(upd).eq("id", data.userId);
    return { ok: true };
  });

// === Tasks CRUD ===
export const adminListTasks = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { sb } = await requireAdmin(data.token);
    const { data: list } = await sb.from("tasks").select("*").order("sort_order");
    return { tasks: list || [] };
  });

export const adminUpsertTask = createServerFn({ method: "POST" })
  .inputValidator((d: any) =>
    z
      .object({
        token: z.string(),
        id: z.string().uuid().optional(),
        type: z.enum(["main", "partner", "other"]),
        title: z.string().min(1),
        description: z.string().optional().nullable(),
        amount: z.number().min(0),
        channel_username: z.string().optional().nullable(),
        channel_url: z.string().optional().nullable(),
        sort_order: z.number().default(0),
        active: z.boolean().default(true),
      })
      .parse(d)
  )
  .handler(async ({ data }) => {
    const { sb } = await requireAdmin(data.token);
    const { token, id, ...payload } = data as any;
    if (id) {
      await sb.from("tasks").update(payload).eq("id", id);
    } else {
      await sb.from("tasks").insert(payload);
    }
    return { ok: true };
  });

export const adminDeleteTask = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; id: string }) =>
    z.object({ token: z.string(), id: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data }) => {
    const { sb } = await requireAdmin(data.token);
    await sb.from("tasks").delete().eq("id", data.id);
    return { ok: true };
  });

// === Task submissions ===
export const adminListSubmissions = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { sb } = await requireAdmin(data.token);
    const { data: list } = await sb
      .from("task_completions")
      .select("*, task:task_id(title, amount, type), user:user_id(telegram_id, username, first_name, balance, total_earned, total_tasks)")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    return { items: list || [] };
  });

export const adminReviewSubmission = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; id: string; approve: boolean; reason?: string }) =>
    z.object({
      token: z.string(),
      id: z.string().uuid(),
      approve: z.boolean(),
      reason: z.string().optional(),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const { sb } = await requireAdmin(data.token);
    const { data: comp } = await sb
      .from("task_completions")
      .select("*, task:task_id(amount, title), user:user_id(*)")
      .eq("id", data.id)
      .single();
    if (!comp) throw new Error("Not found");
    if (data.approve) {
      const amt = Number((comp as any).task.amount);
      const u = (comp as any).user;
      await sb.from("task_completions").update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
      }).eq("id", data.id);
      await sb.from("app_users").update({
        balance: Number(u.balance) + amt,
        total_earned: Number(u.total_earned) + amt,
        total_tasks: u.total_tasks + 1,
      }).eq("id", u.id);
      try {
        await tgApi("sendMessage", {
          chat_id: u.telegram_id,
          text: `✅ Task approved!\n"${(comp as any).task.title}"\n+${amt} ROSE added to your balance 🌹`,
        });
      } catch {}
    } else {
      await sb.from("task_completions").update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        reject_reason: data.reason || "Not valid",
      }).eq("id", data.id);
      try {
        await tgApi("sendMessage", {
          chat_id: (comp as any).user.telegram_id,
          text: `❌ Task rejected: "${(comp as any).task.title}"\nReason: ${data.reason || "Not valid"}`,
        });
      } catch {}
    }
    return { ok: true };
  });

// === Withdrawals ===
export const adminListWithdrawals = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; status?: string }) =>
    z.object({ token: z.string(), status: z.string().optional() }).parse(d)
  )
  .handler(async ({ data }) => {
    const { sb } = await requireAdmin(data.token);
    let q = sb.from("withdrawals")
      .select("*, user:user_id(telegram_id, username, first_name, total_ref_count, total_withdraw)")
      .order("created_at", { ascending: false });
    if (data.status) q = q.eq("status", data.status);
    const { data: list } = await q;
    return { items: list || [] };
  });

export const adminReviewWithdraw = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; id: string; approve: boolean; txId?: string; reason?: string }) =>
    z.object({
      token: z.string(),
      id: z.string().uuid(),
      approve: z.boolean(),
      txId: z.string().optional(),
      reason: z.string().optional(),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const { sb } = await requireAdmin(data.token);
    const { data: wd } = await sb
      .from("withdrawals")
      .select("*, user:user_id(*)")
      .eq("id", data.id)
      .single();
    if (!wd) throw new Error("Not found");
    const u = (wd as any).user;
    if (data.approve) {
      if (!data.txId) throw new Error("TX ID required");
      await sb.from("withdrawals").update({
        status: "approved",
        tx_id: data.txId,
        reviewed_at: new Date().toISOString(),
      }).eq("id", data.id);
      await sb.from("app_users").update({
        total_withdraw: Number(u.total_withdraw) + Number(wd.amount),
      }).eq("id", u.id);
      // Post to payment channel
      try {
        await tgApi("sendMessage", {
          chat_id: "@rosepayfipayment",
          text: `💸 <b>Withdrawal Paid</b>\nUser: @${u.username || u.first_name}\nAmount: <b>${wd.amount} ROSE</b>\nWallet: <code>${wd.wallet_address}</code>`,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔍 View Transaction", url: `https://www.oasisscan.com/transactions/${data.txId}` }],
              [{ text: "🚀 Open Mini App", url: "https://t.me/RosePayFibot" }],
            ],
          },
        });
      } catch {}
      try {
        await tgApi("sendMessage", {
          chat_id: u.telegram_id,
          text: `✅ Withdrawal Approved!\nAmount: ${wd.amount} ROSE\nTX: <code>${data.txId}</code>`,
          parse_mode: "HTML",
        });
      } catch {}
    } else {
      await sb.from("withdrawals").update({
        status: "rejected",
        reject_reason: data.reason || "Rejected",
        reviewed_at: new Date().toISOString(),
      }).eq("id", data.id);
      // Refund balance
      await sb.from("app_users").update({
        balance: Number(u.balance) + Number(wd.amount),
      }).eq("id", u.id);
      try {
        await tgApi("sendMessage", {
          chat_id: u.telegram_id,
          text: `❌ Withdrawal Rejected\nReason: ${data.reason || "Rejected"}\nYour ${wd.amount} ROSE has been refunded.`,
        });
      } catch {}
    }
    return { ok: true };
  });

// === Reward codes ===
export const adminListCodes = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { sb } = await requireAdmin(data.token);
    const { data: list } = await sb.from("reward_codes").select("*").order("created_at", { ascending: false });
    return { codes: list || [] };
  });

export const adminUpsertCode = createServerFn({ method: "POST" })
  .inputValidator((d: any) =>
    z.object({
      token: z.string(),
      id: z.string().uuid().optional(),
      code: z.string().min(2).max(64),
      amount: z.number().positive(),
      max_uses: z.number().int().positive(),
      active: z.boolean().default(true),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const { sb } = await requireAdmin(data.token);
    const { token, id, ...payload } = data as any;
    payload.code = String(payload.code).toUpperCase();
    if (id) await sb.from("reward_codes").update(payload).eq("id", id);
    else await sb.from("reward_codes").insert(payload);
    return { ok: true };
  });

export const adminDeleteCode = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; id: string }) =>
    z.object({ token: z.string(), id: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data }) => {
    const { sb } = await requireAdmin(data.token);
    await sb.from("reward_codes").delete().eq("id", data.id);
    return { ok: true };
  });

// === Settings ===
export const adminGetSettings = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { sb } = await requireAdmin(data.token);
    const { data: list } = await sb.from("app_settings").select("*");
    const map: Record<string, any> = {};
    (list || []).forEach((r: any) => (map[r.key] = r.value));
    return { settings: map };
  });

export const adminSetSetting = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; key: string; value: any }) =>
    z.object({ token: z.string(), key: z.string().min(1), value: z.any() }).parse(d)
  )
  .handler(async ({ data }) => {
    const { sb } = await requireAdmin(data.token);
    await sb.from("app_settings").upsert(
      { key: data.key, value: data.value, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
    return { ok: true };
  });
