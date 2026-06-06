import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Gift, Loader2, Clock, ChevronRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useTelegram } from "./TelegramProvider";
import { RoseCoin } from "./RoseCoin";
import { AdNetworkPanel, type AdNetwork } from "./AdNetworkPanel";
import { listAdNetworks, claimDailyBonus, getEarnStats } from "@/lib/api.functions";

const NETWORK_GRADIENT: Record<string, string> = {
  adsgram: "from-fuchsia-500 to-pink-500",
  monetag: "from-emerald-400 to-teal-500",
  monetix: "from-sky-400 to-indigo-500",
  gigapub: "from-amber-400 to-orange-500",
  adexium: "from-rose-400 to-red-500",
};

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
  const fetchNets = useServerFn(listAdNetworks);
  const fetchStats = useServerFn(getEarnStats);
  const dailyBonus = useServerFn(claimDailyBonus);
  const [networks, setNetworks] = useState<AdNetwork[] | null>(null);
  const [bonus, setBonus] = useState<{ ready: boolean; remainMs: number; amount: number } | null>(
    null,
  );
  const [active, setActive] = useState<AdNetwork | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    try {
      const [n, s] = await Promise.all([
        fetchNets({ data: { initData: tg.initData } }),
        fetchStats({ data: { initData: tg.initData } }),
      ]);
      setNetworks(n.networks as AdNetwork[]);
      const b = (s as any)?.bonus;
      if (b) setBonus({ ready: !!b.ready, remainMs: Number(b.remainMs || 0), amount: Number(b.amount || 0) });
      // Refresh active panel with new slot data
      if (active) {
        const next = (n.networks as AdNetwork[]).find((x) => x.key === active.key);
        if (next) setActive(next);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tg.ready && tg.initData) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tg.ready, tg.initData]);

  const handleBonus = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await dailyBonus({ data: { initData: tg.initData } });
      if (!res.ok) throw new Error(res.message || "Already claimed");
      tg.haptic("success");
      toast.success(`🎁 Daily bonus +${res.amount} ROSE`);
      reload();
    } catch (e: any) {
      tg.haptic("error");
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading || !networks)
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-rose-pink" />
      </div>
    );

  return (
    <div className="px-4 pt-4 pb-28 space-y-3">
      <h2 className="text-xl font-bold neon-text-pink">Watch & Earn</h2>
      <p className="text-xs text-muted-foreground glass rounded-xl p-3">
        Tap any ad network card to open its watch buttons. Each button gives a reward when the ad is
        fully shown and locks for 12 hours.
      </p>

      {/* Daily Bonus */}
      {bonus && (
        <motion.div
          initial={{ y: 6, opacity: 0 }}
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
                <RoseCoin size={12} /> +{bonus.amount} ROSE
              </div>
            </div>
            <button
              disabled={!bonus.ready || busy}
              onClick={handleBonus}
              className="px-4 py-2 rounded-xl gradient-gold text-white text-sm font-bold disabled:opacity-50 flex items-center gap-1"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : bonus.ready ? (
                "Claim"
              ) : (
                <>
                  <Clock className="w-3 h-3" /> {fmtMs(bonus.remainMs)}
                </>
              )}
            </button>
          </div>
        </motion.div>
      )}

      {/* Ad Network cards */}
      {networks.map((n, i) => {
        const grad = NETWORK_GRADIENT[n.key] || "from-rose-pink to-rose-gold";
        const isComing = n.coming_soon || !n.enabled;
        const available = n.slots.filter((s) => s.nextAvailableMs <= 0).length;
        const pct = n.button_count ? (available / n.button_count) * 100 : 0;
        return (
          <motion.button
            key={n.key}
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.05 * (i + 1) }}
            disabled={isComing}
            onClick={() => !isComing && setActive(n)}
            className={`w-full text-left glass rounded-2xl p-4 relative overflow-hidden border ${
              isComing ? "border-border/30 opacity-70" : "border-rose-pink/30 active:border-rose-pink"
            }`}
          >
            <div
              className={`absolute -right-10 -top-10 w-40 h-40 bg-gradient-to-br ${grad} opacity-20 rounded-full blur-3xl`}
            />
            <div className="flex items-center gap-3 relative">
              <div
                className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${grad} flex items-center justify-center text-white font-bold text-lg shadow-lg`}
              >
                {n.label[0]}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{n.label}</p>
                  {isComing && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-gold/20 text-rose-gold">
                      Coming soon
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                  <span className="flex items-center gap-0.5 text-rose-gold">
                    <Sparkles className="w-3 h-3" />+{n.reward}
                  </span>
                  <span>·</span>
                  <span>{n.button_count} buttons</span>
                  <span>·</span>
                  <span>12h cooldown</span>
                </div>
              </div>
              {!isComing && <ChevronRight className="w-5 h-5 text-muted-foreground" />}
            </div>
            {!isComing && (
              <div className="mt-3 relative">
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-muted-foreground">Available now</span>
                  <span className="font-semibold">
                    {available}/{n.button_count}
                  </span>
                </div>
                <div className="h-1.5 bg-input rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full bg-gradient-to-r ${grad}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )}
          </motion.button>
        );
      })}

      {active && (
        <AdNetworkPanel
          network={active}
          onClose={() => {
            setActive(null);
            reload();
          }}
          onClaimed={reload}
        />
      )}
    </div>
  );
}
