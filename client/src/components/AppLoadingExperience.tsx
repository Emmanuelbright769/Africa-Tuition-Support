import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation } from "wouter";
import TSIASplashScreen from "@/components/TSIASplashScreen";

interface AppLoadingExperienceProps {
  children: ReactNode;
}

function PageLoadingOverlay({ visible }: { visible: boolean }) {
  return (
    <div
      className={visible ? "tsia-page-loader tsia-page-loader--visible" : "tsia-page-loader"}
      role="status"
      aria-live="polite"
      aria-label="Opening page"
      aria-hidden={!visible}
    >
      <div className="tsia-page-loader__card">
        <span className="tsia-page-loader__spinner" aria-hidden="true" />
        <span className="tsia-page-loader__label">Opening your next step</span>
        <span className="tsia-page-loader__line" aria-hidden="true"><i /></span>
      </div>
    </div>
  );
}

export default function AppLoadingExperience({ children }: AppLoadingExperienceProps) {
  const [location, navigate] = useLocation();
  const [showSplash, setShowSplash] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const previousLocation = useRef(location);
  const finishTimer = useRef<number | undefined>(undefined);
  const navigationTimer = useRef<number | undefined>(undefined);
  const completeSplash = useCallback(() => setShowSplash(false), []);

  const beginLoading = useCallback((duration = 520) => {
    setIsLoading(true);
    if (finishTimer.current) window.clearTimeout(finishTimer.current);
    finishTimer.current = window.setTimeout(() => setIsLoading(false), duration);
  }, []);

  useEffect(() => {
    if (previousLocation.current !== location) {
      previousLocation.current = location;
      beginLoading(560);
    }
  }, [location, beginLoading]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a");
      const button = target?.closest("button");
      if (!anchor && !button) return;
      if (target?.closest("[data-loading-ignore], [role='dialog']")) return;
      if (anchor) {
        const href = anchor.getAttribute("href") || "";
        const isInternal = href.startsWith("/") && !href.startsWith("//");
        const hasModifier = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
        if (!isInternal || hasModifier || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

        const destination = new URL(href, window.location.href);
        const nextLocation = `${destination.pathname}${destination.search}${destination.hash}`;
        const currentLocation = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        if (nextLocation === currentLocation) return;

        beginLoading(900);

        // Plain anchors would otherwise perform a full document reload before
        // React can paint the transition. Router links already prevent this.
        if (!event.defaultPrevented) {
          event.preventDefault();
          if (navigationTimer.current) window.clearTimeout(navigationTimer.current);
          navigationTimer.current = window.setTimeout(() => navigate(nextLocation), 140);
        }
        return;
      }
      if (button && (button.disabled || button.getAttribute("aria-haspopup") === "dialog")) return;
      beginLoading(720);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [beginLoading, navigate]);

  useEffect(() => () => {
    if (finishTimer.current) window.clearTimeout(finishTimer.current);
    if (navigationTimer.current) window.clearTimeout(navigationTimer.current);
  }, []);

  return (
    <>
      <PageLoadingOverlay visible={!showSplash && isLoading} />
      <div className={showSplash ? "tsia-app-shell tsia-app-shell--covered" : "tsia-app-shell"}>
        {children}
      </div>
      {showSplash && <TSIASplashScreen onComplete={completeSplash} />}
    </>
  );
}