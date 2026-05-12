import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Gift, ChevronRight, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { useTelegram } from "./TelegramProvider";
import { RoseCoin } from "./RoseCoin";
import { getMe, claimRewardCode } from "@/lib/api.functions";

export function HomeTab() {
  const tg = useTelegram();
  const fetchMe = useServerFn(getMe);
  const claim = useServerFn(claimRewardCode);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");

  const reload = async () => {
    try {
      const r = await fetchMe({ data: { initData: tg.initData, startParam: tg.startParam || undefined } });
      setData(r);
    } catch (e: any) {
      toast.error(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tg.ready && tg.initData) reload();
  }, [tg.ready, tg.initData]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 rounded-full border-2 border-rose-pink border-t-transparent animate-spin" />
      </div>
    );
  }

  const u = data.user;
  const handleClaim = async () => {
    if (!code.trim()) return;
    try {
      const r = await claim({ data: { initData: tg.initData, code } });
      tg.haptic("success");
      toast.success(`🌹 +${r.amount} ROSE!`, { description: "Reward claimed" });
      setCode("");
      reload();
    } catch (e: any) {
      tg.haptic("error");
      toast.error(e.message);
    }
  };

  return (
    <div className="px-4 pt-4 pb-28 space-y-4">
      {/* User header */}
      <div className="flex items-center gap-3">
        {u.photo_url ? (
          <img src={u.photo_url} className="w-12 h-12 rounded-full border-2 border-rose-pink/50" />
        ) : (
          <div className="w-12 h-12 rounded-full gradient-pink flex items-center justify-center text-white font-bold">
            {(u.first_name || "U")[0]}
          </div>
        )}
        <div>
          <p className="text-xs text-muted-foreground">Welcome back</p>
          <p className="font-semibold">@{u.username || u.first_name}</p>
        </div>
      </div>

      {/* Balance card */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass rounded-2xl p-5 relative overflow-hidden border-rose-pink/40"
      >
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-rose-pink/30 rounded-full blur-3xl" />
        <div className="flex items-center justify-between relative">
          <div>
            <p className="text-xs text-muted-foreground">Your Balance</p>
            <div className="flex items-center gap-2 mt-1">
              <RoseCoin size={32} />
              <span className="text-3xl font-bold neon-text-pink">
                {Number(u.balance).toFixed(2)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              ≈ ${(Number(u.balance) * (data.price || 0)).toFixed(4)} USD
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">ROSE Price</p>
            <p className="text-sm font-semibold text-rose-gold">
              ${(data.price || 0).toFixed(4)}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Total Earned", value: Number(u.total_earned).toFixed(2), suffix: "ROSE", grad: "gradient-pink" },
          { label: "Total Ads", value: u.total_ads, suffix: "watched", grad: "gradient-purple" },
          { label: "Total Tasks", value: u.total_tasks, suffix: "done", grad: "gradient-cyan" },
          { label: "Total Withdraw", value: Number(u.total_withdraw).toFixed(2), suffix: "ROSE", grad: "gradient-gold" },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.05 }}
            className="glass rounded-xl p-3 relative overflow-hidden"
          >
            <div className={`absolute -right-4 -top-4 w-16 h-16 rounded-full opacity-30 ${s.grad}`} />
            <p className="text-xs text-muted-foreground relative">{s.label}</p>
            <p className="text-lg font-bold mt-1 relative">{s.value}</p>
            <p className="text-[10px] text-muted-foreground relative">{s.suffix}</p>
          </motion.div>
        ))}
      </div>

      {/* Reward code */}
      <div className="glass rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Gift className="w-4 h-4 text-rose-gold" />
          <p className="text-sm font-semibold">Reward Code</p>
        </div>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ENTER CODE"
            className="flex-1 bg-input/50 rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground/60 outline-none focus:ring-2 ring-rose-pink/40"
          />
          <button
            onClick={handleClaim}
            className="px-4 rounded-lg gradient-pink text-white text-sm font-semibold"
          >
            Claim
          </button>
        </div>
        <button
          onClick={() => tg.openTelegramLink("https://t.me/rosepayfi")}
          className="w-full text-xs text-rose-cyan flex items-center justify-center gap-1"
        >
          Get codes from community channel <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {/* Guide */}
      <div className="glass rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-rose-cyan" />
          <p className="text-sm font-semibold">Mini App Guide</p>
        </div>
        <div className="space-y-2 text-xs text-muted-foreground">
          <p>• Complete <span className="text-rose-pink">Tasks</span> to earn ROSE</p>
          <p>• <span className="text-rose-pink">Refer</span> friends for 1 ROSE + 10% lifetime commission</p>
          <p>• Watch ads to unlock daily rewards (coming soon)</p>
          <p>• Withdraw to your Oasis wallet (min 2 refs + 10 ads)</p>
          <p>• Join community: <button onClick={() => tg.openTelegramLink("https://t.me/rosepayfi")} className="text-rose-cyan underline">@rosepayfi</button></p>
        </div>
      </div>
    </div>
  );
}
