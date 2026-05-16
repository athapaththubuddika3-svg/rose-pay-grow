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

const WELCOME_TEXT = `🌹 <b>Welcome to RosePayFi!</b>

Earn <b>ROSE (Oasis Network)</b> tokens by:
• 👀 Watching ads (up to 40/day)
• ✅ Completing simple tasks
• 🎁 Daily login bonuses
• 💎 Inviting friends — 1 ROSE each + <b>10% lifetime commission</b>
• 🎟️ Claiming reward codes from our channel

💸 <b>Real withdrawals</b> straight to your Oasis wallet.

Tap below to launch the mini app 👇`;

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const update = await request.json().catch(() => null);
        if (!update) return new Response("ok");
        const msg = update.message;
        if (!msg || !msg.text) return new Response("ok");

        const chatId = msg.chat.id;
        const text: string = msg.text;
        const from = msg.from || {};

        if (text.startsWith("/start")) {
          try {
            const sb = createClient(
              process.env.SUPABASE_URL!,
              process.env.SUPABASE_SERVICE_ROLE_KEY!,
              { auth: { autoRefreshToken: false, persistSession: false } },
            );
            const { data: existing } = await sb
              .from("app_users")
              .select("id, notif_enabled")
              .eq("telegram_id", from.id)
              .maybeSingle();
            if (existing) {
              await sb.from("app_users").update({ notif_enabled: true }).eq("id", existing.id);
            }
          } catch {}

          const keyboard = {
            inline_keyboard: [
              [{ text: "🚀 Open RosePayFi", url: "https://t.me/RosePayFibot?startapp=open" }],
              [
                { text: "📢 Community", url: "https://t.me/rosepayfi" },
                { text: "💸 Payments", url: "https://t.me/rosepayfipayment" },
              ],
            ],
          };

          // Try to send a photo first; fall back to text-only
          const photoSent = await tg("sendPhoto", {
            chat_id: chatId,
            photo: "https://rose-pay-grow.lovable.app/rosepayfi-share.jpg",
            caption: WELCOME_TEXT,
            parse_mode: "HTML",
            reply_markup: keyboard,
          })
            .then((r) => r.ok)
            .catch(() => false);

          if (!photoSent) {
            await tg("sendMessage", {
              chat_id: chatId,
              text: WELCOME_TEXT,
              parse_mode: "HTML",
              reply_markup: keyboard,
            });
          }
          return new Response("ok");
        }

        if (text.startsWith("/help")) {
          await tg("sendMessage", {
            chat_id: chatId,
            text: "Use /start to open the app. For support contact @RosePayFiSupport",
            reply_markup: {
              inline_keyboard: [
                [{ text: "🚀 Open RosePayFi", url: "https://t.me/RosePayFibot?startapp=open" }],
              ],
            },
          });
        }
        return new Response("ok");
      },
    },
  },
});
