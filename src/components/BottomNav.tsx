import { Home, ListChecks, Eye, Users, User } from "lucide-react";
import { motion } from "framer-motion";

export type Tab = "home" | "task" | "watch" | "refer" | "profile";

const items: { id: Tab; label: string; Icon: any; big?: boolean }[] = [
  { id: "home", label: "Home", Icon: Home },
  { id: "task", label: "Tasks", Icon: ListChecks },
  { id: "watch", label: "Watch", Icon: Eye, big: true },
  { id: "refer", label: "Refer", Icon: Users },
  { id: "profile", label: "Profile", Icon: User },
];

export function BottomNav({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-3 pt-2">
      <div className="glass rounded-2xl px-2 py-2 flex items-end justify-between">
        {items.map(({ id, label, Icon, big }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`relative flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-xl transition ${
                big ? "-mt-7" : ""
              }`}
            >
              {big ? (
                <motion.div
                  whileTap={{ scale: 0.9 }}
                  className={`w-14 h-14 rounded-full flex items-center justify-center gradient-pink neon-pink ${
                    active ? "animate-pulse-glow" : ""
                  }`}
                >
                  <Icon className="w-6 h-6 text-white" />
                </motion.div>
              ) : (
                <Icon
                  className={`w-5 h-5 ${active ? "text-rose-pink" : "text-muted-foreground"}`}
                />
              )}
              <span
                className={`text-[10px] ${
                  active ? "text-rose-pink font-semibold" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
              {active && !big && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute -top-0.5 w-8 h-0.5 rounded-full bg-rose-pink"
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
