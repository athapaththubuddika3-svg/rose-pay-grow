import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";

async function tg(method: string, body: any) {
  return fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const REMINDER_VARIANTS = [
  "🌹 Your daily ROSE is waiting! Open the app and watch a few ads to earn.",
  "💎 Did you claim your daily bonus today? Tap below to grab it!",
  "🚀 New tasks may be live! Open RosePayFi and check the Earn tab.",
  "⏰ Don't break your streak — earn more ROSE in just a few taps.",
  "🎁 Free ROSE inside RosePayFi today. Don't miss it!",
];

export const Route = createFileRoute("/api/public/cron/daily-reminder")({
  server: {
    handlers: {
      POST: async () => {
        const sb = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { autoRefreshToken: false, persistSession: false } }
        );
        const { data: users } = await sb
          .from("app_users")
          .select("telegram_id")
          .eq("suspended", false)
          .eq("notif_enabled", true);

        let sent = 0;
        let failed = 0;
        for (const u of users || []) {
          const text = REMINDER_VARIANTS[Math.floor(Math.random() * REMINDER_VARIANTS.length)];
          const r = await tg("sendMessage", {
            chat_id: u.telegram_id,
            text,
            reply_markup: {
              inline_keyboard: [
                [{ text: "🌹 Earn ROSE", url: "https://t.me/RosePayFibot?startapp=open" }],
              ],
            },
          });
          if (r.ok) sent++;
          else failed++;
          await new Promise((r) => setTimeout(r, 50));
        }
        return Response.json({ ok: true, sent, failed });
      },
    },
  },
});
