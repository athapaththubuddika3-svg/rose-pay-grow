import { motion } from "framer-motion";
import logo from "@/assets/logo.png";

export function Splash() {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background"
    >
      <div className="relative">
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute inset-0 rounded-full bg-rose-pink/40 blur-3xl"
        />
        <motion.img
          src={logo}
          alt="RosePayFi"
          initial={{ scale: 0.4, rotate: -30, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 90, damping: 12 }}
          className="relative w-44 h-44 drop-shadow-[0_0_30px_rgba(255,79,155,0.7)]"
        />
      </div>
      <motion.h1
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-8 text-3xl font-bold tracking-wide neon-text-pink"
      >
        RosePayFi
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="mt-2 text-sm text-muted-foreground"
      >
        Earn • Refer • Withdraw
      </motion.p>

      <div className="absolute bottom-12 flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
            className="w-2 h-2 rounded-full bg-rose-pink"
          />
        ))}
      </div>
    </motion.div>
  );
}
