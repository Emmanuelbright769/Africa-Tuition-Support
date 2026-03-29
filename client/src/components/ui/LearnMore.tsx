import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";

interface LearnMoreProps {
  label?: string;
  children: React.ReactNode;
  className?: string;
  dark?: boolean;
}

export function LearnMore({ label = "Learn more", children, className = "", dark = false }: LearnMoreProps) {
  const [open, setOpen] = useState(false);

  const btnBase = dark
    ? "text-white/70 hover:text-white"
    : "text-primary/70 hover:text-primary";

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`inline-flex items-center gap-1 text-xs font-medium transition-colors ${btnBase}`}
        data-testid="button-learn-more"
      >
        {open ? "Show less" : label}
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="pt-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
