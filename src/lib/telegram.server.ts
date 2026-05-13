import { createHmac } from "crypto";
import { createClient } from "@supabase/supabase-js";

export const ADMIN_CHAT_ID = "1889290764";
export const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
export const APP_URL = "https://rose-pay-grow.lovable.app";
export const BOT_USERNAME = "RosePayFibot";

export function getAdminClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export interface TgUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
}

export function verifyInitData(initData: string): { user: TgUser; startParam?: string } | null {
  if (!initData || !BOT_TOKEN) return null;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return null;
    params.delete("hash");
    const dataCheck: string[] = [];
    [...params.keys()].sort().forEach((k) => dataCheck.push(`${k}=${params.get(k)}`));
    const secret = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
    const computed = createHmac("sha256", secret).update(dataCheck.join("\n")).digest("hex");
    if (computed !== hash) return null;
    const userJson = params.get("user");
    if (!userJson) return null;
    const user = JSON.parse(userJson) as TgUser;
    const startParam = params.get("start_param") || undefined;
    return { user, startParam };
  } catch {
    return null;
  }
}

export function parseInitDataUnsafe(initData: string): { user: TgUser; startParam?: string } | null {
  try {
    const params = new URLSearchParams(initData);
    const userJson = params.get("user");
    if (!userJson) return null;
    return { user: JSON.parse(userJson), startParam: params.get("start_param") || undefined };
  } catch {
    return null;
  }
}

export async function tgApi(method: string, body: Record<string, any>) {
  if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN not set");
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

/** Standard "Open RosePayFi" inline keyboard */
export function appKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "🚀 Open RosePayFi", url: `https://t.me/${BOT_USERNAME}?startapp=open` }],
    ],
  };
}

export function earnKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "🌹 Earn ROSE", url: `https://t.me/${BOT_USERNAME}?startapp=open` }],
      [{ text: "📢 Community", url: "https://t.me/rosepayfi" }],
    ],
  };
}
