import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { ExternalLink, CheckCircle2, Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTelegram } from "./TelegramProvider";
import { RoseCoin } from "./RoseCoin";
import { getTasks, verifyChannelTask, submitTaskScreenshot } from "@/lib/api.functions";

export function TaskTab() {
  const tg = useTelegram();
  const fetchTasks = useServerFn(getTasks);
  const verify = useServerFn(verifyChannelTask);
  const submit = useServerFn(submitTaskScreenshot);
  const [tasks, setTasks] = useState<any[]>([]);
  const [completions, setCompletions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = async () => {
    try {
      const r = await fetchTasks({ data: { initData: tg.initData } });
      setTasks(r.tasks);
      setCompletions(r.completions);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tg.ready) reload();
  }, [tg.ready]);

  const completionFor = (taskId: string) => completions.find((c) => c.task_id === taskId);

  const handleVerify = async (taskId: string) => {
    setBusyId(taskId);
    try {
      const r = await verify({ data: { initData: tg.initData, taskId } });
      if (r.ok) {
        tg.haptic("success");
        toast.success(`🌹 +${r.amount || 0} ROSE!`);
        reload();
      } else {
        tg.haptic("error");
        toast.error(r.message || "Not joined");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleScreenshot = async (taskId: string, file: File) => {
    if (file.size > 5_000_000) return toast.error("Max 5MB");
    setBusyId(taskId);
    try {
      const reader = new FileReader();
      const base64: string = await new Promise((res, rej) => {
        reader.onload = () => res(reader.result as string);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      await submit({ data: { initData: tg.initData, taskId, screenshotBase64: base64 } });
      tg.haptic("success");
      toast.success("Submitted! Awaiting admin review.");
      reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const sections: { type: "main" | "partner" | "other"; title: string; color: string }[] = [
    { type: "main", title: "Main Tasks", color: "text-rose-pink" },
    { type: "partner", title: "Partner Tasks", color: "text-rose-cyan" },
    { type: "other", title: "Other Tasks", color: "text-rose-gold" },
  ];

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-rose-pink" />
      </div>
    );

  return (
    <div className="px-4 pt-4 pb-28 space-y-5">
      <h2 className="text-xl font-bold neon-text-pink">Tasks</h2>
      {sections.map((sec) => {
        const list = tasks.filter((t) => t.type === sec.type);
        if (list.length === 0)
          return (
            <div key={sec.type}>
              <h3 className={`text-sm font-semibold mb-2 ${sec.color}`}>{sec.title}</h3>
              <p className="text-xs text-muted-foreground glass rounded-xl p-4">No tasks yet</p>
            </div>
          );
        return (
          <div key={sec.type} className="space-y-2">
            <h3 className={`text-sm font-semibold ${sec.color}`}>{sec.title}</h3>
            {list.map((t) => {
              const comp = completionFor(t.id);
              const done = comp?.status === "approved";
              const pending = comp?.status === "pending";
              const isOpen = openId === t.id;
              return (
                <motion.div
                  key={t.id}
                  layout
                  className="glass rounded-xl p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{t.title}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <RoseCoin size={12} />
                        <span className="text-xs text-rose-gold">+{t.amount}</span>
                      </div>
                    </div>
                    {done ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    ) : pending ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-amber-500/20 text-amber-300">
                        Pending
                      </span>
                    ) : (
                      <button
                        onClick={() => setOpenId(isOpen ? null : t.id)}
                        className="px-3 py-1.5 rounded-lg gradient-pink text-white text-xs font-semibold"
                      >
                        {isOpen ? "Close" : "Start"}
                      </button>
                    )}
                  </div>
                  {isOpen && !done && !pending && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      className="mt-3 pt-3 border-t border-border space-y-2"
                    >
                      {t.description && (
                        <p className="text-xs text-muted-foreground">{t.description}</p>
                      )}
                      <div className="flex gap-2">
                        {t.channel_url && (
                          <button
                            onClick={() => tg.openTelegramLink(t.channel_url)}
                            className="flex-1 px-3 py-2 rounded-lg glass text-xs font-semibold flex items-center justify-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" /> Open
                          </button>
                        )}
                        {sec.type === "other" ? (
                          <label className="flex-1 px-3 py-2 rounded-lg gradient-pink text-white text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer">
                            <Camera className="w-3 h-3" /> Upload SS
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleScreenshot(t.id, f);
                              }}
                            />
                          </label>
                        ) : (
                          <button
                            disabled={busyId === t.id}
                            onClick={() => handleVerify(t.id)}
                            className="flex-1 px-3 py-2 rounded-lg gradient-pink text-white text-xs font-semibold flex items-center justify-center gap-1 disabled:opacity-50"
                          >
                            {busyId === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Verify"}
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
