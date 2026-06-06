import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Loader2, Play, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useTelegram } from "./TelegramProvider";
import { useAdsgram } from "./AdsgramProvider";
import { RoseCoin } from "./RoseCoin";
import { claimAdReward } from "@/lib/api.functions";

export type AdNetwork = {
  key: string;
  label: string;
  reward: number;
  button_count: number;
  enabled: boolean;
  coming_soon: boolean;
  cooldown_hours: number;
  block_ids: string[];
  slots: { slot: number; nextAvailableMs: number }[];
};

function fmtRemain(ms: number) {
  if (ms <= 0) return "Ready";
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function AdNetworkPanel({
  network,
  onClose,
  onClaimed,
}: {
  network: AdNetwork;
  onClose: () => void;
  onClaimed: () => void;
}) {
  const tg = useTelegram();
  const ads = useAdsgram();
  const claim = useServerFn(claimAdReward);
  const [busy, setBusy] = useState<number | null>(null);
  const [slots, setSlots] = useState(network.slots);
  const [, force] = useState(0);

  // Tick once a second so countdowns update
  useEffect(() => {
    const i = setInterval(() => force((x) => x + 1), 1000);
    return () => clearInterval(i);
  }, []);

  // Recompute remaining ms relative to a frozen anchor
  const anchor = useMemo(() => Date.now(), [slots]);
  const liveSlots = slots.map((s) => ({
    slot: s.slot,
    nextAvailableMs: Math.max(0, s.nextAvailableMs - (Date.now() - anchor)),
  }));

  async function showNetworkAd(): Promise<{ ok: boolean; error?: string }> {
    if (network.key === "adsgram") {
      const ids = network.block_ids.length ? network.block_ids : ["8814"];
      const pick = ids[Math.floor(Math.random() * ids.length)];
      return ads.showAdsgramBlock(pick);
    }
    if (network.key === "monetag") return ads.showMonetag();
    if (network.key === "gigapub") return ads.showGigaPub();
    return { ok: false, error: "Not available" };
  }

  const handleClick = async (slot: number) => {
    if (busy) return;
    const s = liveSlots.find((x) => x.slot === slot);
    if (!s || s.nextAvailableMs > 0) return;
    setBusy(slot);
    try {
      const r = await showNetworkAd();
      if (!r.ok) throw new Error(r.error || "Ad not shown");
      const res = await claim({
        data: { initData: tg.initData, network: network.key, slot },
      });
      if (!res.ok) throw new Error(res.message || "Cooldown");
      tg.haptic("success");
      toast.success(`🌹 +${res.amount} ROSE`);
      // Lock this slot locally
      setSlots((prev) =>
        prev.map((x) =>
          x.slot === slot ? { slot, nextAvailableMs: network.cooldown_hours * 3600_000 } : x,
        ),
      );
      onClaimed();
    } catch (e: any) {
      tg.haptic("error");
      toast.error(e.message || "Failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-background overflow-y-auto pb-28"
      >
        <div className="sticky top-0 z-10 backdrop-blur-md bg-background/80 border-b border-border/40">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full glass flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h2 className="text-lg font-bold neon-text-pink">{network.label} Ads</h2>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <RoseCoin size={10} />+{network.reward} per ad · {network.cooldown_hours}h cooldown
              </p>
            </div>
            <div className="text-right text-xs">
              <p className="text-rose-gold font-semibold">
                {liveSlots.filter((s) => s.nextAvailableMs <= 0).length}
                <span className="text-muted-foreground">/{network.button_count}</span>
              </p>
              <p className="text-[10px] text-muted-foreground">Available</p>
            </div>
          </div>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-2 gap-3">
            {liveSlots.map((s) => {
              const locked = s.nextAvailableMs > 0;
              const isBusy = busy === s.slot;
              return (
                <motion.button
                  key={s.slot}
                  whileTap={{ scale: 0.96 }}
                  disabled={locked || !!busy}
                  onClick={() => handleClick(s.slot)}
                  className={`relative rounded-2xl p-4 text-left overflow-hidden border ${
                    locked
                      ? "border-border/40 bg-muted/20 opacity-60"
                      : "border-rose-pink/40 glass active:border-rose-pink"
                  }`}
                >
                  {!locked && (
                    <div className="absolute -right-6 -top-6 w-20 h-20 bg-rose-pink/20 rounded-full blur-2xl" />
                  )}
                  <div className="flex items-center justify-between relative">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        locked ? "bg-muted" : "gradient-pink neon-pink"
                      }`}
                    >
                      {isBusy ? (
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                      ) : locked ? (
                        <Lock className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <Play className="w-4 h-4 text-white" fill="white" />
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      #{String(s.slot).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="mt-3 relative">
                    <p className="text-xs font-semibold">
                      {locked ? "Locked" : isBusy ? "Loading…" : "Watch Ad"}
                    </p>
                    <p
                      className={`text-[10px] mt-0.5 ${
                        locked ? "text-muted-foreground" : "text-rose-gold flex items-center gap-1"
                      }`}
                    >
                      {locked ? (
                        fmtRemain(s.nextAvailableMs)
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3" />+{network.reward}
                        </>
                      )}
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
