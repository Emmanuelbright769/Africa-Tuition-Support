import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import splashLogo from "@assets/Tuition_Support_Initiative_for_Africa_20260311_104012_0000_1788210276637.png";

interface TSIASplashScreenProps {
  onComplete: () => void;
  minimumDuration?: number;
}

export default function TSIASplashScreen({
  onComplete,
  minimumDuration = 5000,
}: TSIASplashScreenProps) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const exitTimer = window.setTimeout(() => setExiting(true), minimumDuration);
    const completeTimer = window.setTimeout(onComplete, minimumDuration + 430);
    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(completeTimer);
    };
  }, [minimumDuration, onComplete]);

  return (
    <AnimatePresence>
      {!exiting && (
        <motion.div
          className="tsia-splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.42, ease: "easeInOut" }}
          role="status"
          aria-live="polite"
          aria-label="Preparing your TSIA experience"
        >
          <div className="tsia-splash__glow tsia-splash__glow--one" />
          <div className="tsia-splash__glow tsia-splash__glow--two" />
          <div className="tsia-splash__grid" aria-hidden="true" />

          <div className="tsia-splash__content">
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              <img
                src={splashLogo}
                alt="TSIA - Tuition Support Initiative for Africa"
                className="tsia-splash__logo"
              />
            </motion.div>

            <motion.div
              className="tsia-splash__rule"
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ delay: 0.35, duration: 0.7 }}
            />
            <motion.p
              className="tsia-splash__eyebrow"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.48, duration: 0.5 }}
            >
              Tuition Support Initiative for Africa
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.58, duration: 0.6 }}
            >
              Your next chapter<br />
              <em>starts here.</em>
            </motion.h1>
            <motion.div
              className="tsia-splash__loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.85 }}
            >
              <span className="tsia-splash__loading-dot" aria-hidden="true" />
              <span>Opening your support network</span>
              <span className="tsia-splash__loading-line" aria-hidden="true">
                <i />
              </span>
            </motion.div>
          </div>

          <div className="tsia-splash__footer">
            <span>Education creates momentum</span>
            <span className="tsia-splash__footer-mark" aria-hidden="true">TSIA / 01</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}