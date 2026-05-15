import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Trophy, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTelegram } from "./TelegramProvider";
import { RoseCoin } from "./RoseCoin";
import { getReferralData, claimRefBonus, getLeaderboard } from "@/lib/api.functions";

export function ReferTab() {
  const tg = useTelegram();
  const fetchData = useServerFn(getReferralData);
  const claim = useServerFn(claimRefBonus);
  const fetchLb = useServerFn(getLeaderboard);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showLb, setShowLb] = useState(false);
  const [lb, setLb] = useState<any[]>([]);

  const reload = async () => {
    try {
      const r = await fetchData({ data: { initData: tg.initData } });
      setData(r);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tg.ready) reload();
  }, [tg.ready]);

  if (loading || !data)
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-rose-pink" />
      </div>
    );

  const link = `https://t.me/${data.botUsername}?startapp=ref_${data.user.telegram_id}`;
  const copy = async () => {
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
        ok = true;
      }
    } catch {}
    if (!ok) {
      try {
        const ta = document.createElement("textarea");
        ta.value = link;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {}
    }
    tg.haptic(ok ? "success" : "error");
    if (ok) toast.success("Link copied!");
    else toast.error("Copy failed — long-press the link to copy");
  };

  const share = () => {
    const image = data.shareImage || "https://rose-pay-grow.lovable.app/rosepayfi-share.jpg";
    const text = `${data.shareText || "🌹 Join RosePayFi and earn ROSE tokens!"}\n\n✨ Watch ads, complete tasks, claim bonuses, and invite friends to earn more ROSE.\n\n🖼️ ${image}\n\n🚀 Open now: ${link}`;
    tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`);
  };

  const handleClaim = async (refId: string) => {
    try {
      const r = await claim({ data: { initData: tg.initData, referralId: refId } });
      tg.haptic("success");
      toast.success(`🌹 +${r.amount} ROSE!`);
      reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const openLb = async () => {
    setShowLb(true);
    try {
      const r = await fetchLb({ data: { initData: tg.initData } });
      setLb(r.top);
    } catch {}
  };

  return (
    <div className="px-4 pt-4 pb-28 space-y-4">
      <h2 className="text-xl font-bold neon-text-pink">Refer & Earn</h2>

      <div className="glass rounded-2xl p-4 relative overflow-hidden">
        <div className="absolute -right-6 -top-6 w-32 h-32 bg-rose-pink/30 rounded-full blur-3xl" />
        <p className="text-xs text-muted-foreground">Your Referral Link</p>
        <div className="flex items-center gap-2 mt-2">
          <p className="flex-1 text-xs font-mono truncate bg-input/50 rounded-lg px-2 py-2">{link}</p>
          <button
            onClick={copy}
            className="p-2 rounded-lg gradient-pink text-white"
            aria-label="Copy link"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={share}
            className="px-3 py-2 rounded-lg gradient-purple text-white text-xs font-semibold"
          >
            Share
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          🎁 Earn {data.refBonus} ROSE per referral after they complete all main + partner tasks. Plus {data.refCommissionPct}% lifetime commission!
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="glass rounded-xl p-3 relative overflow-hidden">
          <div className="absolute -right-3 -top-3 w-12 h-12 rounded-full gradient-pink opacity-30" />
          <p className="text-[10px] text-muted-foreground relative">Total</p>
          <p className="text-xl font-bold mt-1 relative">{data.refs.length}</p>
        </motion.div>
        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 }} className="glass rounded-xl p-3 relative overflow-hidden">
          <div className="absolute -right-3 -top-3 w-12 h-12 rounded-full gradient-cyan opacity-30" />
          <p className="text-[10px] text-muted-foreground relative">Claimed</p>
          <p className="text-xl font-bold mt-1 relative text-emerald-400">{data.refs.filter((r:any) => r.status === "claimed").length}</p>
        </motion.div>
        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="glass rounded-xl p-3 relative overflow-hidden">
          <div className="absolute -right-3 -top-3 w-12 h-12 rounded-full gradient-gold opacity-30" />
          <p className="text-[10px] text-muted-foreground relative">Commission</p>
          <div className="flex items-center gap-1 mt-1 relative">
            <RoseCoin size={12} />
            <p className="text-base font-bold">{Number(data.user.total_ref_commission).toFixed(2)}</p>
          </div>
        </motion.div>
      </div>

      <button
        onClick={openLb}
        className="w-full py-2.5 rounded-xl glass flex items-center justify-center gap-2 text-sm font-semibold text-rose-gold"
      >
        <Trophy className="w-4 h-4" /> View Leaderboard
      </button>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-rose-cyan">Your Referrals</h3>
        {data.refs.length === 0 && (
          <p className="text-xs text-muted-foreground glass rounded-xl p-4 text-center">
            No referrals yet. Share your link!
          </p>
        )}
        <AnimatePresence initial={false}>
        {data.refs.map((r: any, i: number) => {
          const status = r.status as "pending" | "claimable" | "claimed";
          const palette = status === "claimed"
            ? { ring: "border-emerald-400/40", grad: "from-emerald-500/20 to-transparent", chip: "bg-emerald-500/20 text-emerald-300", label: "✓ Claimed" }
            : status === "claimable"
            ? { ring: "border-rose-pink/50", grad: "from-rose-pink/30 to-transparent", chip: "bg-rose-pink/20 text-rose-pink", label: "🎁 Claimable" }
            : { ring: "border-amber-400/40", grad: "from-amber-500/20 to-transparent", chip: "bg-amber-500/20 text-amber-300", label: "⏳ Pending" };
          return (
            <motion.div
              key={r.id}
              layout
              initial={{ opacity: 0, x: -20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: i * 0.04, type: "spring", damping: 18 }}
              whileHover={{ scale: 1.01 }}
              className={`glass rounded-xl p-3 flex items-center gap-3 relative overflow-hidden border ${palette.ring}`}
            >
              <div className={`absolute inset-0 bg-gradient-to-r ${palette.grad} pointer-events-none`} />
              {r.referred?.photo_url ? (
                <img src={r.referred.photo_url} className="w-10 h-10 rounded-full relative ring-2 ring-rose-pink/30" />
              ) : (
                <div className="w-10 h-10 rounded-full gradient-purple flex items-center justify-center text-xs font-bold relative">
                  {(r.referred?.first_name || "U")[0]}
                </div>
              )}
              <div className="flex-1 min-w-0 relative">
                <p className="text-sm font-medium truncate">@{r.referred?.username || r.referred?.first_name}</p>
                <span className={`text-[10px] inline-block mt-0.5 px-2 py-0.5 rounded-full ${palette.chip}`}>{palette.label}</span>
              </div>
              <div className="relative flex flex-col items-end gap-1">
                <span className="text-xs text-rose-gold font-bold flex items-center gap-1">
                  <RoseCoin size={11} /> +{r.bonus_amount}
                </span>
                {status === "claimable" && (
                  <button
                    onClick={() => handleClaim(r.id)}
                    className="px-3 py-1 rounded-lg gradient-pink text-white text-[11px] font-bold neon-pink"
                  >
                    Claim
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
        </AnimatePresence>
      </div>

      {showLb && (
        <div
          className="fixed inset-0 z-50 bg-background/90 backdrop-blur-md p-4 overflow-y-auto"
          onClick={() => setShowLb(false)}
        >
          <div className="max-w-md mx-auto pt-8 space-y-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold neon-text-pink">🏆 Leaderboard</h3>
              <button onClick={() => setShowLb(false)} className="text-sm text-muted-foreground">
                Close
              </button>
            </div>
            {lb.map((u, i) => (
              <div key={i} className="glass rounded-xl p-3 flex items-center gap-3">
                <span className="w-6 text-center font-bold text-rose-gold">#{i + 1}</span>
                {u.photo_url ? (
                  <img src={u.photo_url} className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 rounded-full gradient-pink flex items-center justify-center text-xs">
                    {(u.first_name || "U")[0]}
                  </div>
                )}
                <p className="flex-1 truncate text-sm">@{u.username || u.first_name}</p>
                <span className="text-xs text-rose-pink font-semibold">{u.total_ref_count} refs</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
