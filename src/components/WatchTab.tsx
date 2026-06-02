import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Play, Gift, Zap, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";
import { useTelegram } from "./TelegramProvider";
import { useAdsgram } from "./AdsgramProvider";
import { RoseCoin } from "./RoseCoin";
import {
  getEarnStats,
  completeAdWatch,
  completeAdTask,
  claimDailyBonus,
} from "@/lib/api.functions";

const AdsgramTask = "adsgram-task" as unknown as keyof JSX.IntrinsicElements;

function fmtMs(ms: number) {
  if (ms <= 0) return "ready";
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function WatchTab() {
  const tg = useTelegram();
  const ads = useAdsgram();
  const fetchStats = useServerFn(getEarnStats);
  const watch = useServerFn(completeAdWatch);
  const adTask = useServerFn(completeAdTask);
  const dailyBonus = useServerFn(claimDailyBonus);
  const [s, setS] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const taskRef = useRef<HTMLElement | null>(null);

  const reload = async () => {
    try {
      const r = await fetchStats({ data: { initData: tg.initData } });
      setS(r);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tg.ready && tg.initData) reload();
    const i = setInterval(() => {
      if (tg.ready) reload();
    }, 30000);
    return () => clearInterval(i);
  }, [tg.ready, tg.initData]);

  if (loading || !s)
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-rose-pink" />
      </div>
    );

  const handleWatch = async () => {
    if (busy) return;
    setBusy("ad");
    try {
      const r = await ads.showRewarded(s.ads.blockId);
      if (!r.ok) throw new Error(r.error || "Watch the full ad to earn");
      const res = await watch({
        data: { initData: tg.initData, durationSec: r.durationSec, blockId: s.ads.blockId },
      });
      if (!res.ok) throw new Error(res.message || "Limit reached");
      tg.haptic("success");
      toast.success(`🌹 +${res.amount} ROSE!`);
      reload();
    } catch (e: any) {
      tg.haptic("error");
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    if (!ads.taskReady || !taskRef.current || !s?.adTask?.blockId) return;
    const taskEl = taskRef.current;
    const onReward = async () => {
      if (busy) return;
      setBusy("task");
      try {
        const res = await adTask({ data: { initData: tg.initData, blockId: s.adTask.blockId } });
        if (!res.ok) throw new Error("Ad task failed");
        tg.haptic("success");
        toast.success(`🌹 +${res.amount} ROSE!`);
        reload();
      } catch (e: any) {
        tg.haptic("error");
        toast.error(e.message);
      } finally {
        setBusy(null);
      }
    };
    const onError = () => toast.error("Ad task failed to load");
    taskEl.addEventListener("reward", onReward as EventListener);
    taskEl.addEventListener("onError", onError as EventListener);
    return () => {
      taskEl.removeEventListener("reward", onReward as EventListener);
      taskEl.removeEventListener("onError", onError as EventListener);
    };
  }, [ads.taskReady, s?.adTask?.blockId, tg.initData, busy]);

  const handleBonus = async () => {
    if (busy) return;
    setBusy("bonus");
    try {
      const res = await dailyBonus({ data: { initData: tg.initData } });
      if (!res.ok) throw new Error(res.message || "Already claimed");
      tg.haptic("success");
      toast.success(`🎁 Daily bonus +${res.amount} ROSE!`);
      reload();
    } catch (e: any) {
      tg.haptic("error");
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const dailyPct = Math.min(100, (s.ads.dailyCount / s.ads.dailyLimit) * 100);
  const sessionPct = Math.min(100, (s.ads.sessionCount / s.ads.sessionLimit) * 100);
  const taskPct = Math.min(100, (s.adTask.count / s.adTask.limit) * 100);

  return (
    <div className="px-4 pt-4 pb-28 space-y-4">
      <h2 className="text-xl font-bold neon-text-pink">Watch & Earn</h2>
      <p className="text-xs text-muted-foreground glass rounded-xl p-3">
        Watch ads fully to receive ROSE. During task ads, open the promoted bot or channel from the
        ad and complete it until the reward unlocks.
      </p>

      {/* Daily Bonus */}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="glass rounded-2xl p-4 relative overflow-hidden border-rose-gold/40"
      >
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-rose-gold/30 rounded-full blur-3xl" />
        <div className="flex items-center gap-3 relative">
          <div className="w-12 h-12 rounded-xl gradient-gold flex items-center justify-center">
            <Gift className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-semibold">Daily Bonus</p>
            <div className="flex items-center gap-1 text-xs text-rose-gold">
              <RoseCoin size={12} /> +{s.bonus.amount} ROSE
            </div>
          </div>
          <button
            disabled={!s.bonus.ready || busy === "bonus"}
            onClick={handleBonus}
            className="px-4 py-2 rounded-xl gradient-gold text-white text-sm font-bold disabled:opacity-50 flex items-center gap-1"
          >
            {busy === "bonus" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : s.bonus.ready ? (
              "Claim"
            ) : (
              <>
                <Clock className="w-3 h-3" /> {fmtMs(s.bonus.remainMs)}
              </>
            )}
          </button>
        </div>
      </motion.div>

      {/* Watch Ads */}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.05 }}
        className="glass rounded-2xl p-5 relative overflow-hidden border-rose-pink/40"
      >
        <div className="absolute -right-8 -top-8 w-40 h-40 bg-rose-pink/30 rounded-full blur-3xl" />
        <div className="flex items-center gap-3 relative">
          <div className="w-14 h-14 rounded-2xl gradient-pink flex items-center justify-center neon-pink animate-pulse-glow">
            <Play className="w-7 h-7 text-white" fill="white" />
          </div>
          <div className="flex-1">
            <p className="font-semibold">Watch Ad</p>
            <div className="flex items-center gap-1 text-xs">
              <RoseCoin size={12} /> <span className="text-rose-gold">+{s.ads.reward} per ad</span>
            </div>
          </div>
        </div>
        <button
          disabled={
            busy === "ad" || s.ads.sessionRemainMs > 0 || s.ads.dailyCount >= s.ads.dailyLimit
          }
          onClick={handleWatch}
          className="w-full mt-4 py-3 rounded-xl gradient-pink text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2 relative"
        >
          {busy === "ad" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : s.ads.sessionRemainMs > 0 ? (
            `Cooldown ${fmtMs(s.ads.sessionRemainMs)}`
          ) : s.ads.dailyCount >= s.ads.dailyLimit ? (
            "Daily limit reached"
          ) : (
            "▶ Watch Ad"
          )}
        </button>
        <div className="mt-3 space-y-2 text-xs relative">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-muted-foreground">Daily</span>
              <span>
                {s.ads.dailyCount}/{s.ads.dailyLimit}
              </span>
            </div>
            <div className="h-1.5 bg-input rounded-full overflow-hidden">
              <motion.div
                className="h-full gradient-pink"
                initial={{ width: 0 }}
                animate={{ width: `${dailyPct}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-muted-foreground">Session</span>
              <span>
                {s.ads.sessionCount}/{s.ads.sessionLimit}
              </span>
            </div>
            <div className="h-1.5 bg-input rounded-full overflow-hidden">
              <motion.div
                className="h-full gradient-purple"
                initial={{ width: 0 }}
                animate={{ width: `${sessionPct}%` }}
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Ad Task */}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-2xl p-4 relative overflow-hidden border-rose-cyan/40"
      >
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-rose-cyan/30 rounded-full blur-3xl" />
        <div className="flex items-center gap-3 relative">
          <div className="w-12 h-12 rounded-xl gradient-cyan flex items-center justify-center">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-semibold">Ad Task</p>
            <div className="flex items-center gap-1 text-xs">
              <RoseCoin size={12} />{" "}
              <span className="text-rose-gold">+{s.adTask.reward} per task</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {s.adTask.cooldownRemainMs > 0 ? (
              <span className="text-xs text-muted-foreground">
                Cooldown {fmtMs(s.adTask.cooldownRemainMs)}
              </span>
            ) : null}
            {s.adTask.count < s.adTask.limit && ads.taskReady ? (
              <AdsgramTask
                ref={taskRef as any}
                data-block-id={s.adTask.blockId}
                data-debug="false"
                className="block"
              >
                <div slot="reward" className="text-[11px] text-rose-gold font-semibold">
                  +{s.adTask.reward} ROSE
                </div>
                <div slot="button" className="px-4 py-2 rounded-xl gradient-cyan text-white text-sm font-bold">
                  Start Task Ad
                </div>
                <div slot="claim" className="px-4 py-2 rounded-xl gradient-cyan text-white text-sm font-bold">
                  Claim Task Reward
                </div>
                <div slot="done" className="px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 text-sm font-bold">
                  Done
                </div>
              </AdsgramTask>
            ) : (
              <button disabled className="px-4 py-2 rounded-xl gradient-cyan text-white text-sm font-bold disabled:opacity-50">
                {s.adTask.count >= s.adTask.limit ? "Done" : "Loading task..."}
              </button>
            )}
          </div>
        </div>
        <div className="mt-3 text-xs relative">
          <div className="flex justify-between mb-1">
            <span className="text-muted-foreground">Today</span>
            <span>
              {s.adTask.count}/{s.adTask.limit}
            </span>
          </div>
          <div className="h-1.5 bg-input rounded-full overflow-hidden">
            <motion.div
              className="h-full gradient-cyan"
              initial={{ width: 0 }}
              animate={{ width: `${taskPct}%` }}
            />
          </div>
          <div className="mt-2 flex gap-2 text-[11px]">
            <button onClick={() => tg.openTelegramLink(s.adTask.ctaBotLink)} className="text-rose-cyan">
              Open bot from ad
            </button>
            <button onClick={() => tg.openTelegramLink(s.adTask.ctaChannelLink)} className="text-rose-pink">
              Open channel from ad
            </button>
          </div>
        </div>
      </motion.div>

      {/* Withdraw gate progress */}
      <div className="glass rounded-xl p-3 text-xs flex items-center justify-between">
        <div>
          <p className="font-semibold">Withdraw gate</p>
          <p className="text-muted-foreground">
            Watch {s.withdraw.adsRequired} ads before each withdraw
          </p>
        </div>
        <span className="text-rose-gold font-bold">
          {s.withdraw.adsDone}/{s.withdraw.adsRequired}
        </span>
      </div>
    </div>
  );
}
