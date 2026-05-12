import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
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

  const link = `https://t.me/${data.botUsername}?start=${data.user.telegram_id}`;
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
    const text = `🌹 Join RosePayFi and earn ROSE tokens!\n${link}`;
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

      <div className="grid grid-cols-2 gap-3">
        <div className="glass rounded-xl p-3">
          <p className="text-xs text-muted-foreground">Total Refs</p>
          <p className="text-2xl font-bold mt-1">{data.user.total_ref_count}</p>
        </div>
        <div className="glass rounded-xl p-3">
          <p className="text-xs text-muted-foreground">Commission</p>
          <div className="flex items-center gap-1 mt-1">
            <RoseCoin size={16} />
            <p className="text-2xl font-bold">{Number(data.user.total_ref_commission).toFixed(2)}</p>
          </div>
        </div>
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
        {data.refs.map((r: any) => (
          <div key={r.id} className="glass rounded-xl p-3 flex items-center gap-3">
            {r.referred?.photo_url ? (
              <img src={r.referred.photo_url} className="w-9 h-9 rounded-full" />
            ) : (
              <div className="w-9 h-9 rounded-full gradient-purple flex items-center justify-center text-xs font-bold">
                {(r.referred?.first_name || "U")[0]}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">@{r.referred?.username || r.referred?.first_name}</p>
              <p className="text-[10px] text-muted-foreground capitalize">{r.status}</p>
            </div>
            {r.status === "claimable" ? (
              <button
                onClick={() => handleClaim(r.id)}
                className="px-3 py-1.5 rounded-lg gradient-pink text-white text-xs font-semibold"
              >
                Claim
              </button>
            ) : (
              <span className="text-xs text-rose-gold">+{r.bonus_amount}</span>
            )}
          </div>
        ))}
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
