import { Eye } from "lucide-react";
import { motion } from "framer-motion";

export function ComingSoon({ icon: Icon = Eye, title }: { icon?: any; title: string }) {
  return (
    <div className="px-4 pt-10 pb-28 flex flex-col items-center text-center">
      <motion.div
        animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
        transition={{ duration: 3, repeat: Infinity }}
        className="w-24 h-24 rounded-full gradient-pink flex items-center justify-center neon-pink mb-6"
      >
        <Icon className="w-12 h-12 text-white" />
      </motion.div>
      <h2 className="text-2xl font-bold neon-text-pink">{title}</h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-xs">
        We're working on something amazing. Stay tuned!
      </p>
      <div className="mt-6 px-4 py-2 rounded-full glass text-rose-pink text-sm font-semibold">
        Coming Soon
      </div>
    </div>
  );
}
