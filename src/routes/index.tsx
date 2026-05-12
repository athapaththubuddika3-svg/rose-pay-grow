import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster } from "sonner";
import { Eye } from "lucide-react";
import { TelegramProvider } from "@/components/TelegramProvider";
import { Background } from "@/components/Background";
import { Splash } from "@/components/Splash";
import { BottomNav, type Tab } from "@/components/BottomNav";
import { HomeTab } from "@/components/HomeTab";
import { TaskTab } from "@/components/TaskTab";
import { ReferTab } from "@/components/ReferTab";
import { ProfileTab } from "@/components/ProfileTab";
import { ComingSoon } from "@/components/ComingSoon";
import { NotifGate } from "@/components/NotifGate";

export const Route = createFileRoute("/")({
  component: App,
  ssr: false as any,
});

function App() {
  const [splash, setSplash] = useState(true);
  const [tab, setTab] = useState<Tab>("home");

  useEffect(() => {
    const t = setTimeout(() => setSplash(false), 2400);
    return () => clearTimeout(t);
  }, []);

  return (
    <TelegramProvider>
      <Background />
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "rgba(40, 10, 50, 0.95)",
            border: "1px solid rgba(255, 79, 155, 0.4)",
            color: "white",
            backdropFilter: "blur(12px)",
          },
        }}
      />
      <AnimatePresence>{splash && <Splash />}</AnimatePresence>
      {!splash && (
        <main className="min-h-screen max-w-md mx-auto relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {tab === "home" && <HomeTab />}
              {tab === "task" && <TaskTab />}
              {tab === "watch" && <ComingSoon icon={Eye} title="Watch & Earn" />}
              {tab === "refer" && <ReferTab />}
              {tab === "profile" && <ProfileTab />}
            </motion.div>
          </AnimatePresence>
          <BottomNav tab={tab} setTab={setTab} />
        </main>
      )}
    </TelegramProvider>
  );
}
