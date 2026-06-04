import { useEffect, useState, ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Loader2 } from "lucide-react";
import { useTelegram } from "./TelegramProvider";
import { getMe, setNotifEnabled } from "@/lib/api.functions";

export function NotifGate({ children }: { children: ReactNode }) {
  const tg = useTelegram();
  const fetchMe = useServerFn(getMe);
  const setNotif = useServerFn(setNotifEnabled);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [suspended, setSuspended] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [waiting, setWaiting] = useState(false);
  const isPreviewMode = !tg.isInTelegram && tg.initData.includes("hash=DEV");

  const check = async () => {
    try {
      const r = await fetchMe({ data: { initData: tg.initData, startParam: tg.startParam || undefined } });
      setEnabled(!!r.user.notif_enabled);
      setSuspended(!!r.user.suspended);
      setSuspendReason(r.user.suspend_reason || "Your account has been suspended.");
    } catch {
      setEnabled(false);
    }
  };

  useEffect(() => {
    if (tg.ready && tg.initData) check();
  }, [tg.ready, tg.initData]);

  // Poll while waiting for user to /start the bot
  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(check, 2500);
    return () => clearInterval(id);
  }, [waiting]);

  const allow = async () => {
    try {
      // Mark enabled server-side immediately so the bot can DM
      await setNotif({ data: { initData: tg.initData } });
    } catch {}
    setWaiting(true);
    tg.haptic("medium");
    tg.openTelegramLink("https://t.me/RosePayFibot?start=notif");
    setTimeout(check, 1500);
  };

  if (enabled === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-rose-pink" />
      </div>
    );
  }

  return (
    <>
      {children}
      <AnimatePresence>
        {suspended ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-background/90 backdrop-blur-md flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 12, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              className="glass rounded-3xl p-6 max-w-sm w-full text-center border-red-500/40"
            >
              <h2 className="text-xl font-bold text-red-300">Account Suspended</h2>
              <p className="text-sm text-muted-foreground mt-3">{suspendReason}</p>
            </motion.div>
          </motion.div>
        ) : !enabled && !isPreviewMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-background/85 backdrop-blur-md flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.85, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: "spring", damping: 18 }}
              className="glass rounded-3xl p-6 max-w-sm w-full text-center border-rose-pink/40 relative overflow-hidden"
            >
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-rose-pink/30 rounded-full blur-3xl" />
              <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-rose-purple/30 rounded-full blur-3xl" />
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 1 }}
                className="w-20 h-20 rounded-full gradient-pink mx-auto flex items-center justify-center neon-pink relative"
              >
                <Bell className="w-10 h-10 text-white" />
              </motion.div>
              <h2 className="text-xl font-bold mt-4 neon-text-pink relative">
                Enable Notifications
              </h2>
              <p className="text-sm text-muted-foreground mt-2 relative">
                You must start the bot to use RosePayFi. You'll get instant alerts for rewards, referrals & withdrawals.
              </p>
              <button
                onClick={allow}
                disabled={waiting}
                className="w-full mt-5 py-3 rounded-xl gradient-pink text-white font-semibold neon-pink relative disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {waiting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Waiting for bot start…
                  </>
                ) : (
                  "Allow & Start Bot"
                )}
              </button>
              {waiting && (
                <p className="text-[11px] text-muted-foreground mt-3 relative">
                  Tap "Start" inside the bot, then return here.
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
