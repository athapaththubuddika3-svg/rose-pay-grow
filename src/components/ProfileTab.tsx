import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Copy, History, Loader2, X, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useTelegram } from "./TelegramProvider";
import { RoseCoin } from "./RoseCoin";
import { getMe, requestWithdraw, getWithdrawals } from "@/lib/api.functions";

export function ProfileTab() {
  const tg = useTelegram();
  const fetchMe = useServerFn(getMe);
  const submit = useServerFn(requestWithdraw);
  const fetchWd = useServerFn(getWithdrawals);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showWd, setShowWd] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<any>(null);

  const reload = async () => {
    try {
      const r = await fetchMe({ data: { initData: tg.initData } });
      setData(r);
      if (r.user.wallet_address) setAddress(r.user.wallet_address);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tg.ready) reload();
  }, [tg.ready]);

  const loadHistory = async () => {
    setShowHistory(true);
    try {
      const r = await fetchWd({ data: { initData: tg.initData } });
      setHistory(r.list);
    } catch {}
  };

  if (loading || !data)
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-rose-pink" />
      </div>
    );

  const u = data.user;
  const settings = data.settings;
  const minRefs = Number(settings.min_refs_for_withdraw || 2);
  const minAds = Number(settings.min_daily_ads_for_withdraw || 10);
  const minWd = Number(settings.min_withdraw || 10);
  const fee = Number(settings.withdraw_fee || 0.5);
  const maxWd = Number(settings.max_withdraw || 10);
  const hasPendingWithdraw = !!data.meta?.pendingWithdraw;
  const amountNum = Number(amount || 0);
  const netAmount = Math.max(0, amountNum - fee);

  const tryWithdraw = () => {
    if (u.total_ref_count < minRefs) return toast.error(`Need at least ${minRefs} referrals`);
    if (u.total_ads < minAds) return toast.error(`Need at least ${minAds} daily ads`);
    if (hasPendingWithdraw) return toast.error("You already have a pending withdrawal request");
    if (Number(u.balance) < minWd) return toast.error(`Min ${minWd} ROSE balance`);
    setAmount(String(u.balance));
    setShowWd(true);
  };

  const handleSubmit = async () => {
    const a = Number(amount);
    if (!a || a < minWd) return toast.error(`Min ${minWd} ROSE`);
    if (!address || address.length < 4) return toast.error("Enter wallet address");
    setBusy(true);
    try {
      await submit({ data: { initData: tg.initData, amount: a, address } });
      tg.haptic("success");
      toast.success("Withdrawal request success", {
        description: `Net payout ${Math.max(0, a - fee).toFixed(2)} ROSE will arrive within 24 hours.`,
        action: {
          label: "Open RosePayFi",
          onClick: () => tg.openTelegramLink("https://t.me/RosePayFibot?startapp=open"),
        },
      });
      setShowWd(false);
      reload();
    } catch (e: any) {
      tg.haptic("error");
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const copyId = () => {
    navigator.clipboard.writeText(String(u.telegram_id));
    toast.success("ID copied");
  };

  return (
    <div className="px-4 pt-4 pb-28 space-y-4">
      {/* Profile header */}
      <div className="glass rounded-2xl p-4 flex flex-col items-center text-center">
        {u.photo_url ? (
          <img src={u.photo_url} className="w-20 h-20 rounded-full border-2 border-rose-pink" />
        ) : (
          <div className="w-20 h-20 rounded-full gradient-pink flex items-center justify-center text-2xl font-bold">
            {(u.first_name || "U")[0]}
          </div>
        )}
        <p className="font-bold mt-3">@{u.username || u.first_name}</p>
        <button
          onClick={copyId}
          className="text-xs text-muted-foreground flex items-center gap-1 mt-1"
        >
          ID: {u.telegram_id} <Copy className="w-3 h-3" />
        </button>
      </div>

      {/* Available balance */}
      <div className="glass rounded-2xl p-4 relative overflow-hidden border-rose-pink/30">
        <div className="absolute -right-6 -top-6 w-32 h-32 bg-rose-pink/20 rounded-full blur-3xl" />
        <p className="text-xs text-muted-foreground">Available</p>
        <div className="flex items-center gap-2 mt-1">
          <RoseCoin size={28} />
          <span className="text-2xl font-bold">{Number(u.balance).toFixed(4)}</span>
          <span className="text-sm text-muted-foreground">ROSE</span>
        </div>
        <p className="text-xs text-rose-gold mt-1">
          ≈ ${(Number(u.balance) * (data.price || 0)).toFixed(4)} • Live: $
          {(data.price || 0).toFixed(4)}
        </p>
        <button
          onClick={tryWithdraw}
          disabled={hasPendingWithdraw}
          className="w-full mt-3 py-2.5 rounded-xl gradient-pink text-white font-semibold flex items-center justify-center gap-2"
        >
          <Wallet className="w-4 h-4" /> {hasPendingWithdraw ? "Withdraw Pending" : "Withdraw"}
        </button>
        <button
          onClick={loadHistory}
          className="w-full mt-2 py-2 rounded-xl glass text-sm flex items-center justify-center gap-2"
        >
          <History className="w-4 h-4" /> History
        </button>
      </div>

      <div className="text-xs text-muted-foreground glass rounded-xl p-3 space-y-1">
        <p>Requirements:</p>
        <p>
          • Min withdraw: {minWd} ROSE {Number(u.balance) >= minWd ? "✅" : "❌"}
        </p>
        <p>• Max withdraw: {maxWd} ROSE</p>
        <p>• Fee: {fee} ROSE</p>
        <p>
          • Min refs: {minRefs} ({u.total_ref_count}) {u.total_ref_count >= minRefs ? "✅" : "❌"}
        </p>
        <p>
          • Daily ads: {minAds} ({u.total_ads}) {u.total_ads >= minAds ? "✅" : "❌"}
        </p>
        <p>• All Main + Partner tasks must be approved before withdraw</p>
        {hasPendingWithdraw && <p>• Pending withdraw request exists ❌</p>}
      </div>

      {/* Withdraw modal */}
      {showWd && (
        <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-md p-4 flex items-center justify-center">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass rounded-2xl p-5 max-w-sm w-full space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg neon-text-pink">Withdraw ROSE</h3>
              <button onClick={() => setShowWd(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Amount</label>
              <div className="flex gap-2 mt-1">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="flex-1 bg-input/50 rounded-lg px-3 py-2 outline-none focus:ring-2 ring-rose-pink/40"
                />
                <button
                  onClick={() => setAmount(String(u.balance))}
                  className="px-3 rounded-lg glass text-xs font-semibold"
                >
                  MAX
                </button>
              </div>
              <div className="mt-2 rounded-xl bg-input/40 px-3 py-2 text-xs text-muted-foreground space-y-1">
                <div className="flex items-center justify-between">
                  <span>Gross</span>
                  <span>{amountNum ? amountNum.toFixed(2) : "0.00"} ROSE</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Fee</span>
                  <span>{fee.toFixed(2)} ROSE</span>
                </div>
                <div className="flex items-center justify-between text-rose-gold font-semibold">
                  <span>Net payout</span>
                  <span>{netAmount.toFixed(2)} ROSE</span>
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Oasis (ROSE) Wallet Address</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="oasis1..."
                className="w-full bg-input/50 rounded-lg px-3 py-2 mt-1 text-xs font-mono outline-none focus:ring-2 ring-rose-pink/40"
              />
            </div>
            <button
              disabled={busy}
              onClick={handleSubmit}
              className="w-full py-2.5 rounded-xl gradient-pink text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Request"}
            </button>
          </motion.div>
        </div>
      )}

      {/* History */}
      {showHistory && (
        <div
          className="fixed inset-0 z-50 bg-background/90 backdrop-blur-md p-4 overflow-y-auto"
          onClick={() => setShowHistory(false)}
        >
          <div className="max-w-md mx-auto pt-8 space-y-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold neon-text-pink">Withdraw History</h3>
              <button onClick={() => setShowHistory(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            {history.length === 0 && (
              <p className="text-center text-sm text-muted-foreground glass rounded-xl p-6">
                No withdrawals yet
              </p>
            )}
            {history.map((w) => (
              <button
                key={w.id}
                onClick={() => setDetail(w)}
                className="w-full glass rounded-xl p-3 text-left flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-1">
                    <RoseCoin size={14} />
                    <span className="font-semibold">{w.amount}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(w.created_at).toLocaleString()}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    w.status === "approved"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : w.status === "rejected"
                        ? "bg-red-500/20 text-red-300"
                        : "bg-amber-500/20 text-amber-300"
                  }`}
                >
                  {w.status}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {detail && (
        <div
          className="fixed inset-0 z-[60] bg-background/95 p-4 flex items-center justify-center"
          onClick={() => setDetail(null)}
        >
          <div
            className="glass rounded-2xl p-5 max-w-sm w-full space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold">Withdrawal Details</h3>
              <button onClick={() => setDetail(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">Amount:</span> {detail.amount} ROSE
              </p>
              <p>
                <span className="text-muted-foreground">Status:</span> {detail.status}
              </p>
              <p className="break-all">
                <span className="text-muted-foreground">Address:</span> {detail.wallet_address}
              </p>
              {detail.tx_id && (
                <p className="break-all">
                  <span className="text-muted-foreground">TX:</span> {detail.tx_id}
                </p>
              )}
              <p>
                <span className="text-muted-foreground">Date:</span>{" "}
                {new Date(detail.created_at).toLocaleString()}
              </p>
              {detail.reject_reason && (
                <p className="text-red-300">Reason: {detail.reject_reason}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
