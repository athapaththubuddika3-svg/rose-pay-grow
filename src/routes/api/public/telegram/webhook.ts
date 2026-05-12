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
          const refParam = text.replace("/start", "").trim();
          // Mark notif_enabled & link ref if first time
          try {
            const sb = createClient(
              process.env.SUPABASE_URL!,
              process.env.SUPABASE_SERVICE_ROLE_KEY!,
              { auth: { autoRefreshToken: false, persistSession: false } }
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

          await tg("sendMessage", {
            chat_id: chatId,
            text: `🌹 <b>Welcome to RosePayFi!</b>\n\nEarn ROSE tokens by completing tasks, watching ads, and inviting friends.\n\nTap below to launch the mini app 👇`,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "🚀 Open RosePayFi",
                    web_app: { url: "https://rose-pay-grow.lovable.app" },
                  },
                ],
                [{ text: "📢 Community", url: "https://t.me/rosepayfi" }],
              ],
            },
          });
          return new Response("ok");
        }

        if (text.startsWith("/help")) {
          await tg("sendMessage", {
            chat_id: chatId,
            text: "Use /start to open the app. For support contact @RosePayFiSupport",
          });
        }
        return new Response("ok");
      },
    },
  },
});
