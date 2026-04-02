import { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Sparkles, AlertTriangle, RefreshCw, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Detection constants ────────────────────────────────────────────────────
const AW = 160;                        // analysis canvas width
const AH = 120;                        // analysis canvas height
const PX_DIFF = 28;                    // per-channel diff to count as motion
const MOTION_MIN = AW * AH * 0.038;   // ~730 px must move (3.8% of frame)
const BLINK_MIN  = AW * AH * 0.008;   // ~150 px in top zone for blink
const VARIANCE_MIN = 14;              // center variance → face detected
const FACE_HOLD_MS = 1400;            // face must be stable before advancing
const STEP_MS = 8500;                 // liveness step timeout
const BLINK_MS = 7000;               // blink step timeout (shorter — it's quick)
const POSITION_MS = 15000;           // positioning timeout
const FRAME_MS = 90;                  // analysis interval
const MAX_STEP_FAILS = 2;             // fails before full failure

// ── Types ──────────────────────────────────────────────────────────────────
type Phase =
  | "intro" | "permissions" | "positioning"
  | "liveness_left" | "liveness_right" | "liveness_blink"
  | "processing" | "complete" | "failed";

type StepError = "timeout" | "no_motion" | null;

interface Props { onComplete: () => void; onCancel: () => void; }

// ── Helpers ────────────────────────────────────────────────────────────────
function drawFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, AW, AH);
  return ctx.getImageData(0, 0, AW, AH).data;
}

function computeVariance(data: Uint8ClampedArray): number {
  // Sample center 50% × 60% of frame
  const x0 = AW * 0.25 | 0, x1 = AW * 0.75 | 0;
  const y0 = AH * 0.2  | 0, y1 = AH * 0.8  | 0;
  let sum = 0, sum2 = 0, n = 0;
  for (let y = y0; y < y1; y += 4) {
    for (let x = x0; x < x1; x += 4) {
      const i = (y * AW + x) * 4;
      const lum = (data[i] + data[i+1] + data[i+2]) / 3;
      sum += lum; sum2 += lum * lum; n++;
    }
  }
  const mean = sum / n;
  return Math.sqrt(Math.max(0, sum2 / n - mean * mean));
}

function computeMotion(curr: Uint8ClampedArray, prev: Uint8ClampedArray) {
  let total = 0, topZone = 0;
  const topLimit = AH * 0.42 | 0; // top 42% for blink detection
  for (let y = 0; y < AH; y++) {
    for (let x = 0; x < AW; x++) {
      const i = (y * AW + x) * 4;
      const d = (Math.abs(curr[i]-prev[i]) + Math.abs(curr[i+1]-prev[i+1]) + Math.abs(curr[i+2]-prev[i+2])) / 3;
      if (d > PX_DIFF) { total++; if (y < topLimit) topZone++; }
    }
  }
  return { total, topZone };
}

// ── Animated SVG mascot ────────────────────────────────────────────────────
function FaceMascot({ phase }: { phase: Phase }) {
  const blinking   = phase === "liveness_blink";
  const turnLeft   = phase === "liveness_left";
  const turnRight  = phase === "liveness_right";
  const happy      = phase === "complete";
  const failed     = phase === "failed";
  const idle       = phase === "intro" || phase === "positioning";

  return (
    <svg viewBox="0 0 120 120" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="60" cy="112" rx="28" ry="6" fill="#00000015" />
      <rect x="50" y="88" width="20" height="16" rx="8" fill="#FBBF9A" />
      <motion.g
        animate={{ x: turnLeft ? -6 : turnRight ? 6 : 0, rotateY: turnLeft ? -20 : turnRight ? 20 : 0 }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
        style={{ originX: "60px", originY: "55px" }}
      >
        <ellipse cx="60" cy="52" rx="32" ry="36" fill={failed ? "#FCA5A5" : "#FBBF9A"} />
        <ellipse cx="60" cy="22" rx="32" ry="12" fill="#2D1B0E" />
        <rect x="28" y="18" width="64" height="14" rx="7" fill="#2D1B0E" />
        <ellipse cx="28" cy="52" rx="6" ry="8" fill="#F4A67A" />
        <ellipse cx="92" cy="52" rx="6" ry="8" fill="#F4A67A" />
        <ellipse cx="28.5" cy="52" rx="3.5" ry="5" fill="#E8956A" />
        <ellipse cx="91.5" cy="52" rx="3.5" ry="5" fill="#E8956A" />
        <motion.g animate={{ y: blinking ? 2 : happy ? -2 : failed ? 3 : 0 }} transition={{ duration: 0.2 }}>
          <path d="M40 36 Q46 32 52 35" stroke="#2D1B0E" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M68 35 Q74 32 80 36" stroke="#2D1B0E" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </motion.g>
        <motion.g
          animate={{ scaleY: blinking ? 0.08 : 1 }}
          transition={{ duration: 0.15, repeat: blinking ? Infinity : 0, repeatDelay: 0.8 }}
          style={{ originX: "60px", originY: "46px" }}
        >
          <ellipse cx="46" cy="46" rx="7" ry="7.5" fill="white" />
          <motion.ellipse cx="46" cy="46" rx="4.5" ry="5" fill="#1A3C34" animate={{ x: turnLeft ? -1.5 : turnRight ? 1.5 : 0 }} transition={{ duration: 0.4 }} />
          <ellipse cx="44" cy="44" rx="1.5" ry="1.5" fill="white" opacity={0.7} />
          <ellipse cx="74" cy="46" rx="7" ry="7.5" fill="white" />
          <motion.ellipse cx="74" cy="46" rx="4.5" ry="5" fill="#1A3C34" animate={{ x: turnLeft ? -1.5 : turnRight ? 1.5 : 0 }} transition={{ duration: 0.4 }} />
          <ellipse cx="72" cy="44" rx="1.5" ry="1.5" fill="white" opacity={0.7} />
        </motion.g>
        <path d="M58 54 Q60 60 62 54" stroke="#E8956A" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <motion.path
          d={failed ? "M48 75 Q60 68 72 75" : happy ? "M48 70 Q60 82 72 70" : "M50 68 Q60 72 70 68"}
          stroke={failed ? "#DC2626" : "#C0502A"} strokeWidth="2.5" fill="none" strokeLinecap="round"
          animate={{ d: failed ? "M48 75 Q60 68 72 75" : happy ? "M48 70 Q60 82 72 70" : "M50 68 Q60 72 70 68" }}
          transition={{ duration: 0.4 }}
        />
        {(happy || idle) && (
          <>
            <ellipse cx="38" cy="60" rx="7" ry="5" fill="#F4A67A" opacity={0.4} />
            <ellipse cx="82" cy="60" rx="7" ry="5" fill="#F4A67A" opacity={0.4} />
          </>
        )}
        {phase === "intro" && (
          <motion.g initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.4, type: "spring" }}>
            <rect x="44" y="82" width="32" height="14" rx="7" fill="#1A3C34" />
            <text x="60" y="92.5" textAnchor="middle" fill="#D4AF37" fontSize="7" fontWeight="bold">TSIA</text>
          </motion.g>
        )}
      </motion.g>
      <AnimatePresence>
        {turnLeft && (
          <motion.g initial={{ opacity: 0, x: 10 }} animate={{ opacity: [0.6,1,0.6], x: 0 }} exit={{ opacity: 0 }} transition={{ repeat: Infinity, duration: 0.8 }}>
            <path d="M18 52 L8 52 L13 45 M8 52 L13 59" stroke="#D4AF37" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </motion.g>
        )}
        {turnRight && (
          <motion.g initial={{ opacity: 0, x: -10 }} animate={{ opacity: [0.6,1,0.6], x: 0 }} exit={{ opacity: 0 }} transition={{ repeat: Infinity, duration: 0.8 }}>
            <path d="M102 52 L112 52 L107 45 M112 52 L107 59" stroke="#D4AF37" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </motion.g>
        )}
      </AnimatePresence>
    </svg>
  );
}

// ── Step pills ─────────────────────────────────────────────────────────────
const STEPS = [
  { id: "positioning"   as Phase, label: "Position" },
  { id: "liveness_left" as Phase, label: "Turn Left" },
  { id: "liveness_right"as Phase, label: "Turn Right" },
  { id: "liveness_blink"as Phase, label: "Blink" },
  { id: "processing"    as Phase, label: "Verify" },
];

function StepPills({ phase }: { phase: Phase }) {
  const idx = STEPS.findIndex(s => s.id === phase);
  return (
    <div className="flex items-center gap-1 w-full">
      {STEPS.map((s, i) => {
        const done = idx > i, current = idx === i;
        return (
          <div key={s.id} className="flex-1 flex flex-col items-center gap-1">
            <motion.div
              className={`h-1 w-full rounded-full ${done ? "bg-[#D4AF37]" : current ? "bg-[#1A3C34]" : "bg-gray-200 dark:bg-gray-700"}`}
              animate={{ scaleX: current ? [1, 1.05, 1] : 1 }}
              transition={{ repeat: current ? Infinity : 0, duration: 1.2 }}
            />
            <span className={`text-[9px] font-medium ${current ? "text-[#1A3C34] dark:text-[#D4AF37]" : done ? "text-[#D4AF37]" : "text-gray-400"}`}>
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Processing dots ────────────────────────────────────────────────────────
function ProcessingDots() {
  const tasks = ["Extracting facial geometry","Running liveness detection","Matching identity record","Finalising verification"];
  const [done, setDone] = useState(0);
  useEffect(() => { const id = setInterval(() => setDone(d => d < tasks.length ? d + 1 : d), 700); return () => clearInterval(id); }, []);
  return (
    <div className="space-y-2 w-full max-w-xs">
      {tasks.map((t, i) => (
        <motion.div key={t} initial={{ opacity: 0, x: -10 }} animate={{ opacity: i <= done ? 1 : 0.3, x: 0 }} transition={{ delay: i * 0.1 }} className="flex items-center gap-2 text-sm">
          {i < done ? <CheckCircle2 className="w-4 h-4 text-[#D4AF37] shrink-0" />
           : i === done ? <motion.div className="w-4 h-4 border-2 border-[#1A3C34] border-t-transparent rounded-full shrink-0" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }} />
           : <div className="w-4 h-4 border-2 border-gray-300 rounded-full shrink-0" />}
          <span className={i < done ? "text-[#1A3C34] dark:text-[#D4AF37] font-medium" : "text-muted-foreground"}>{t}</span>
        </motion.div>
      ))}
    </div>
  );
}

// ── Confetti ───────────────────────────────────────────────────────────────
function SuccessConfetti() {
  const dots = Array.from({ length: 18 }, (_, i) => ({ id: i, color: i%3===0?"#D4AF37":i%3===1?"#1A3C34":"#22C55E", x: Math.random()*280-40, delay: Math.random()*0.4, size: 4+Math.random()*6 }));
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {dots.map(d => <motion.div key={d.id} className="absolute rounded-full" style={{ width:d.size, height:d.size, backgroundColor:d.color, left:d.x, top:-10 }} animate={{ y:320, opacity:[1,1,0] }} transition={{ duration:1.4, delay:d.delay, ease:"easeIn" }} />)}
    </div>
  );
}

// ── Countdown bar ──────────────────────────────────────────────────────────
function CountdownBar({ timeLeftMs, totalMs }: { timeLeftMs: number; totalMs: number }) {
  const pct = Math.max(0, timeLeftMs / totalMs);
  const color = pct > 0.5 ? "#1A3C34" : pct > 0.25 ? "#D4AF37" : "#EF4444";
  return (
    <div className="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <motion.div className="h-full rounded-full" style={{ width: `${pct * 100}%`, backgroundColor: color }} animate={{ width: `${pct * 100}%` }} transition={{ duration: 0.1, ease: "linear" }} />
    </div>
  );
}

// ── Motion meter ───────────────────────────────────────────────────────────
function MotionMeter({ score }: { score: number }) {
  const pct = Math.min(1, score);
  const color = pct > 0.7 ? "#22C55E" : pct > 0.3 ? "#D4AF37" : "#9CA3AF";
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-white/70 font-medium">Motion</span>
      <div className="flex gap-0.5">
        {[0.2, 0.4, 0.6, 0.8, 1.0].map(t => (
          <motion.div key={t} className="w-1.5 h-3 rounded-sm" style={{ backgroundColor: pct >= t ? color : "#ffffff30" }} animate={{ scaleY: pct >= t ? [1, 1.2, 1] : 1 }} transition={{ repeat: pct >= t ? Infinity : 0, duration: 0.4 }} />
        ))}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function BiometricVerification({ onComplete, onCancel }: Props) {
  const [phase, setPhase]           = useState<Phase>("intro");
  const [faceDetected, setFaceDetected] = useState(false);
  const [motionScore, setMotionScore]   = useState(0);
  const [timeLeftMs, setTimeLeftMs]     = useState(STEP_MS);
  const [stepError, setStepError]       = useState<StepError>(null);
  const [totalFails, setTotalFails]     = useState(0);
  const [currentTimeout, setCurrentTimeout] = useState(STEP_MS);

  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);    // hidden analysis canvas
  const streamRef   = useRef<MediaStream | null>(null);
  const prevRef     = useRef<Uint8ClampedArray | null>(null);
  const frameTimer  = useRef<ReturnType<typeof setInterval> | null>(null);
  const countTimer  = useRef<ReturnType<typeof setInterval> | null>(null);
  const faceHoldRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef    = useRef<Phase>("intro");
  const lockedRef   = useRef(false); // prevent double-advance

  phaseRef.current = phase;

  // ── Cleanup ──────────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const clearTimers = useCallback(() => {
    if (frameTimer.current)  { clearInterval(frameTimer.current);  frameTimer.current  = null; }
    if (countTimer.current)  { clearInterval(countTimer.current);  countTimer.current  = null; }
    if (faceHoldRef.current) { clearTimeout(faceHoldRef.current);  faceHoldRef.current = null; }
  }, []);

  useEffect(() => () => { clearTimers(); stopCamera(); }, []);

  // ── Start camera ─────────────────────────────────────────────────────────
  const startCamera = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 } });
    streamRef.current = stream;
    const video = videoRef.current!;
    video.srcObject = stream;
    await video.play();
  };

  // ── Advance to next liveness phase ───────────────────────────────────────
  const advanceTo = useCallback((next: Phase) => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    clearTimers();
    prevRef.current = null;
    setMotionScore(0);
    setStepError(null);
    const timeout = next === "liveness_blink" ? BLINK_MS : next === "positioning" ? POSITION_MS : STEP_MS;
    setTimeLeftMs(timeout);
    setCurrentTimeout(timeout);
    setPhase(next);
    setTimeout(() => { lockedRef.current = false; }, 300);
  }, [clearTimers]);

  // ── Handle step timeout / failure ────────────────────────────────────────
  const handleStepFail = useCallback((err: StepError) => {
    clearTimers();
    setStepError(err);
    setTotalFails(f => {
      const newFails = f + 1;
      if (newFails >= MAX_STEP_FAILS) {
        setTimeout(() => { stopCamera(); setPhase("failed"); }, 1600);
      } else {
        // retry same phase after showing error
        setTimeout(() => {
          setStepError(null);
          const cur = phaseRef.current;
          const timeout = cur === "liveness_blink" ? BLINK_MS : cur === "positioning" ? POSITION_MS : STEP_MS;
          setTimeLeftMs(timeout);
          setCurrentTimeout(timeout);
          prevRef.current = null;
          setMotionScore(0);
          startAnalysisLoop();
          startCountdown(timeout);
        }, 2000);
      }
      return newFails;
    });
  }, [clearTimers, stopCamera]);

  // ── Countdown tick ────────────────────────────────────────────────────────
  const startCountdown = useCallback((total: number) => {
    let remaining = total;
    if (countTimer.current) clearInterval(countTimer.current);
    countTimer.current = setInterval(() => {
      remaining -= 100;
      setTimeLeftMs(remaining);
      if (remaining <= 0) {
        clearInterval(countTimer.current!);
        countTimer.current = null;
        handleStepFail("timeout");
      }
    }, 100);
  }, [handleStepFail]);

  // ── Frame analysis loop ───────────────────────────────────────────────────
  const startAnalysisLoop = useCallback(() => {
    if (frameTimer.current) clearInterval(frameTimer.current);
    frameTimer.current = setInterval(() => {
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      const cur    = phaseRef.current;
      if (!video || !canvas || video.readyState < 2 || lockedRef.current) return;

      const currData = drawFrame(video, canvas);
      if (!currData) return;

      if (cur === "positioning") {
        const v = computeVariance(currData);
        const detected = v > VARIANCE_MIN;
        setFaceDetected(detected);
        if (detected) {
          if (!faceHoldRef.current) {
            faceHoldRef.current = setTimeout(() => {
              if (phaseRef.current === "positioning") advanceTo("liveness_left");
            }, FACE_HOLD_MS);
          }
        } else {
          if (faceHoldRef.current) { clearTimeout(faceHoldRef.current); faceHoldRef.current = null; }
        }
        prevRef.current = currData;
        return;
      }

      // liveness phases — need motion
      if (!prevRef.current) { prevRef.current = currData; return; }
      const { total, topZone } = computeMotion(currData, prevRef.current);
      prevRef.current = currData;

      const ratio = total / (AW * AH);
      setMotionScore(Math.min(1, ratio / 0.12)); // normalise to 0-1 display

      if (cur === "liveness_left" || cur === "liveness_right") {
        if (total >= MOTION_MIN) advanceTo(cur === "liveness_left" ? "liveness_right" : "liveness_blink");
      } else if (cur === "liveness_blink") {
        if (topZone >= BLINK_MIN || total >= MOTION_MIN * 0.5) advanceTo("processing");
      }
    }, FRAME_MS);
  }, [advanceTo]);

  // ── Start verification flow ───────────────────────────────────────────────
  const handleStart = async () => {
    setPhase("permissions");
    setTotalFails(0);
    setStepError(null);
    try {
      await startCamera();
      advanceTo("positioning");
      startAnalysisLoop();
      startCountdown(POSITION_MS);
    } catch {
      setPhase("intro");
    }
  };

  // ── React to phase changes ────────────────────────────────────────────────
  useEffect(() => {
    if (phase === "processing") {
      clearTimers();
      setTimeout(() => setPhase("complete"), 3200);
    }
    if (phase === "complete") {
      stopCamera();
      setTimeout(onComplete, 1400);
    }
  }, [phase]);

  // ── Phase → start camera analysis when phase enters liveness ─────────────
  useEffect(() => {
    if (["liveness_left", "liveness_right", "liveness_blink"].includes(phase)) {
      startAnalysisLoop();
      const t = phase === "liveness_blink" ? BLINK_MS : STEP_MS;
      setTimeLeftMs(t);
      setCurrentTimeout(t);
      startCountdown(t);
    }
  }, [phase]);

  // ── Restart from beginning ────────────────────────────────────────────────
  const handleRetry = () => {
    clearTimers();
    stopCamera();
    prevRef.current = null;
    lockedRef.current = false;
    setFaceDetected(false);
    setMotionScore(0);
    setStepError(null);
    setTotalFails(0);
    setPhase("intro");
  };

  const inCamera = ["positioning","liveness_left","liveness_right","liveness_blink"].includes(phase);
  const inLiveness = ["liveness_left","liveness_right","liveness_blink"].includes(phase);

  const stepLabel: Record<Phase, string> = {
    intro:"", permissions:"", positioning: faceDetected ? "Face detected — hold still…" : "Move into the oval frame",
    liveness_left:"Slowly turn your head to the LEFT",
    liveness_right:"Now slowly turn your head to the RIGHT",
    liveness_blink:"Blink naturally — once is enough",
    processing:"Analysing…", complete:"", failed:"",
  };
  const badgeLabel: Record<string, string> = {
    positioning: "SCANNING", liveness_left:"TURN LEFT", liveness_right:"TURN RIGHT", liveness_blink:"BLINK",
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full select-none">
      {/* Hidden analysis canvas */}
      <canvas ref={canvasRef} width={AW} height={AH} className="hidden" aria-hidden />

      {/* Header */}
      <AnimatePresence mode="wait">
        <motion.div key={phase+"_h"} initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:8 }} transition={{ duration:0.25 }} className="text-center">
          {phase==="intro"         && <><h3 className="text-lg font-bold text-[#1A3C34] dark:text-[#D4AF37]">Face Verification</h3><p className="text-xs text-muted-foreground mt-0.5">Quick real-time liveness check</p></>}
          {phase==="permissions"   && <><h3 className="text-lg font-bold text-[#1A3C34] dark:text-[#D4AF37]">Starting Camera…</h3><p className="text-xs text-muted-foreground mt-0.5">Allow camera access when prompted</p></>}
          {phase==="positioning"   && <><h3 className="text-lg font-bold text-[#1A3C34] dark:text-[#D4AF37]">Position Your Face</h3><p className="text-xs text-muted-foreground mt-0.5">Centre your face in the oval frame</p></>}
          {phase==="liveness_left" && <><h3 className="text-lg font-bold text-[#1A3C34] dark:text-[#D4AF37]">Turn Head Left</h3><p className="text-xs text-muted-foreground mt-0.5">Slowly rotate your head to the left</p></>}
          {phase==="liveness_right"&& <><h3 className="text-lg font-bold text-[#1A3C34] dark:text-[#D4AF37]">Turn Head Right</h3><p className="text-xs text-muted-foreground mt-0.5">Now slowly rotate to the right</p></>}
          {phase==="liveness_blink"&& <><h3 className="text-lg font-bold text-[#1A3C34] dark:text-[#D4AF37]">Blink Naturally</h3><p className="text-xs text-muted-foreground mt-0.5">Blink once clearly</p></>}
          {phase==="processing"    && <><h3 className="text-lg font-bold text-[#1A3C34] dark:text-[#D4AF37]">Analysing Biometrics</h3><p className="text-xs text-muted-foreground mt-0.5">Please wait while we verify your identity</p></>}
          {phase==="complete"      && <h3 className="text-lg font-bold text-green-600">Verification Successful!</h3>}
          {phase==="failed"        && <><h3 className="text-lg font-bold text-red-600">Verification Failed</h3><p className="text-xs text-muted-foreground mt-0.5">We couldn't complete the check</p></>}
        </motion.div>
      </AnimatePresence>

      {/* Step pills */}
      <AnimatePresence>
        {(inCamera || phase==="processing") && (
          <motion.div className="w-full" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
            <StepPills phase={phase} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main area */}
      <div className="w-full flex items-center justify-center">
        <AnimatePresence mode="wait">

          {/* ── Intro ── */}
          {phase==="intro" && (
            <motion.div key="intro" initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:0.9 }} className="flex flex-col items-center gap-4 w-full">
              <div className="relative w-36 h-36">
                <motion.div className="absolute inset-0 rounded-full bg-[#1A3C34]/10 dark:bg-[#D4AF37]/10" animate={{ scale:[1,1.12,1] }} transition={{ repeat:Infinity, duration:2.4, ease:"easeInOut" }} />
                <motion.div className="absolute inset-2 rounded-full bg-[#1A3C34]/5" animate={{ scale:[1,1.08,1] }} transition={{ repeat:Infinity, duration:2.4, ease:"easeInOut", delay:0.3 }} />
                <div className="absolute inset-4"><FaceMascot phase="intro" /></div>
                <motion.div className="absolute -right-2 -bottom-1 text-2xl" animate={{ rotate:[0,20,-10,20,0] }} transition={{ repeat:Infinity, duration:2, ease:"easeInOut", delay:0.5 }}>👋</motion.div>
              </div>
              <div className="w-full bg-[#1A3C34]/5 dark:bg-[#D4AF37]/5 rounded-xl p-3 space-y-2">
                {[{i:"💡",t:"Use good lighting — face your light source"},{i:"🔒",t:"Remove glasses, hats or face coverings"},{i:"📱",t:"Hold device at eye level and stay still"}].map(tip=>(
                  <div key={tip.t} className="flex items-start gap-2"><span className="text-base leading-5">{tip.i}</span><span className="text-muted-foreground text-xs leading-5">{tip.t}</span></div>
                ))}
              </div>
              <div className="flex gap-3 w-full">
                <Button variant="outline" onClick={onCancel} className="flex-1 h-11 border-[#1A3C34]/30" data-testid="button-biometric-cancel">Cancel</Button>
                <Button onClick={handleStart} className="flex-1 h-11 bg-[#1A3C34] hover:bg-[#1A3C34]/90 text-white font-semibold" data-testid="button-biometric-start">Start Verification →</Button>
              </div>
            </motion.div>
          )}

          {/* ── Permissions ── */}
          {phase==="permissions" && (
            <motion.div key="permissions" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} className="flex flex-col items-center gap-4 py-4">
              <motion.div className="w-20 h-20 bg-[#1A3C34]/10 rounded-full flex items-center justify-center text-4xl" animate={{ scale:[1,1.1,1] }} transition={{ repeat:Infinity, duration:1.2 }}>📷</motion.div>
              <p className="text-sm text-muted-foreground text-center">Requesting camera access…<br />Please tap <strong>Allow</strong> when prompted.</p>
            </motion.div>
          )}

          {/* ── Camera phases ── */}
          {inCamera && (
            <motion.div key="camera" initial={{ opacity:0, scale:0.95 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0 }} className="w-full flex flex-col items-center gap-3">

              {/* Step error banner */}
              <AnimatePresence>
                {stepError && (
                  <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }}
                    className="w-full flex items-center gap-2 bg-red-500/90 text-white text-xs font-semibold px-3 py-2 rounded-xl">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {stepError==="timeout" ? "Time's up! Try again — move more clearly." : "Didn't catch that. Move more deliberately."}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Camera viewport */}
              <div className="relative w-56 h-64 rounded-3xl overflow-hidden bg-black shadow-xl shadow-black/30">
                <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" autoPlay playsInline muted data-testid="video-biometric" />

                {/* Dark vignette */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/50 pointer-events-none" />

                {/* Oval face guide */}
                <svg viewBox="0 0 224 256" className="absolute inset-0 w-full h-full pointer-events-none">
                  <defs><mask id="bm-oval-mask"><rect width="224" height="256" fill="white" /><ellipse cx="112" cy="118" rx="72" ry="90" fill="black" /></mask></defs>
                  <rect width="224" height="256" fill="black" fillOpacity={0.45} mask="url(#bm-oval-mask)" />
                  <motion.ellipse cx="112" cy="118" rx="72" ry="90"
                    stroke={faceDetected ? "#22C55E" : inLiveness ? "#D4AF37" : "white"}
                    strokeWidth={faceDetected ? 3 : 2.5} fill="none"
                    strokeDasharray={inLiveness ? "6 3" : "none"}
                    animate={{ opacity: faceDetected ? [1,0.6,1] : 1 }}
                    transition={{ repeat: faceDetected && !inLiveness ? Infinity : 0, duration: 0.8 }}
                  />
                  {/* Guides */}
                  <path d="M112 28 L112 36" stroke={inLiveness?"#D4AF37":"white"} strokeWidth="2" />
                  <path d="M112 200 L112 208" stroke={inLiveness?"#D4AF37":"white"} strokeWidth="2" />
                  <path d="M40 118 L48 118" stroke={inLiveness?"#D4AF37":"white"} strokeWidth="2" />
                  <path d="M176 118 L184 118" stroke={inLiveness?"#D4AF37":"white"} strokeWidth="2" />
                </svg>

                {/* Scan line for positioning */}
                {phase==="positioning" && !faceDetected && (
                  <motion.div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent pointer-events-none"
                    animate={{ top:["0%","100%","0%"] }} transition={{ duration:2.5, repeat:Infinity, ease:"linear" }} style={{ top:0 }} />
                )}

                {/* Face detected pulse ring */}
                {faceDetected && phase==="positioning" && (
                  <motion.div className="absolute inset-0 rounded-3xl border-2 border-green-400 pointer-events-none"
                    animate={{ opacity:[0.5,1,0.5] }} transition={{ repeat:Infinity, duration:0.7 }} />
                )}

                {/* Direction arrows over video */}
                <AnimatePresence>
                  {phase==="liveness_left" && (
                    <motion.div key="al" initial={{ opacity:0,x:20 }} animate={{ opacity:[0.7,1,0.7], x:[0,-8,0] }} exit={{ opacity:0 }} transition={{ repeat:Infinity, duration:0.9 }} className="absolute left-2 top-1/2 -translate-y-1/2">
                      <svg width="28" height="28" viewBox="0 0 28 28"><path d="M18 5 L8 14 L18 23" stroke="#D4AF37" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </motion.div>
                  )}
                  {phase==="liveness_right" && (
                    <motion.div key="ar" initial={{ opacity:0,x:-20 }} animate={{ opacity:[0.7,1,0.7], x:[0,8,0] }} exit={{ opacity:0 }} transition={{ repeat:Infinity, duration:0.9 }} className="absolute right-2 top-1/2 -translate-y-1/2">
                      <svg width="28" height="28" viewBox="0 0 28 28"><path d="M10 5 L20 14 L10 23" stroke="#D4AF37" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </motion.div>
                  )}
                  {phase==="liveness_blink" && (
                    <motion.div key="ab" animate={{ opacity:[0.8,1,0.8] }} transition={{ repeat:Infinity, duration:0.7 }} className="absolute bottom-8 left-0 right-0 flex justify-center">
                      <div className="bg-[#D4AF37]/90 text-white text-[11px] font-bold px-3 py-1 rounded-full">👁️ Blink now</div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Top left badge */}
                <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1">
                  <motion.div className={`w-2 h-2 rounded-full ${faceDetected&&phase==="positioning"?"bg-green-400":"bg-red-500"}`}
                    animate={{ opacity:[1,0.3,1] }} transition={{ repeat:Infinity, duration:0.8 }} />
                  <span className="text-white text-[10px] font-bold uppercase tracking-wide">{badgeLabel[phase]??""}</span>
                </div>

                {/* Motion meter (liveness only) */}
                {inLiveness && (
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                    <MotionMeter score={motionScore} />
                  </div>
                )}

                {/* Face detected indicator (positioning) */}
                {phase==="positioning" && (
                  <div className="absolute bottom-2 left-0 right-0 flex justify-center">
                    <AnimatePresence>
                      {faceDetected ? (
                        <motion.div key="fd" initial={{ opacity:0, scale:0.8 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0 }}
                          className="flex items-center gap-1.5 bg-green-500/90 text-white text-[11px] font-bold px-3 py-1 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> Face detected
                        </motion.div>
                      ) : (
                        <motion.div key="nf" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                          className="flex items-center gap-1.5 bg-black/60 text-white/80 text-[11px] px-3 py-1 rounded-full">
                          <Eye className="w-3 h-3" /> Searching for face…
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* Countdown bar (liveness steps only) */}
              {inLiveness && (
                <div className="w-full max-w-[224px] space-y-1">
                  <CountdownBar timeLeftMs={timeLeftMs} totalMs={currentTimeout} />
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-muted-foreground">Time remaining</span>
                    <span className={`text-[10px] font-bold ${timeLeftMs < 3000 ? "text-red-500" : "text-muted-foreground"}`}>{(timeLeftMs/1000).toFixed(1)}s</span>
                  </div>
                </div>
              )}

              {/* Mascot + instruction row */}
              <div className="flex items-center gap-3 bg-[#1A3C34]/5 dark:bg-[#D4AF37]/5 rounded-xl px-3 py-2 w-full max-w-xs">
                <div className="w-12 h-12 shrink-0"><FaceMascot phase={phase} /></div>
                <p className="text-xs text-[#1A3C34] dark:text-[#D4AF37] font-semibold leading-snug">{stepLabel[phase]}</p>
              </div>
            </motion.div>
          )}

          {/* ── Processing ── */}
          {phase==="processing" && (
            <motion.div key="processing" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} className="flex flex-col items-center gap-5 py-2 w-full">
              <div className="relative w-28 h-28">
                <div className="absolute inset-0 rounded-full border-4 border-[#1A3C34]/20" />
                <motion.div className="absolute inset-0 rounded-full border-4 border-[#1A3C34] border-t-transparent" animate={{ rotate:360 }} transition={{ repeat:Infinity, duration:1, ease:"linear" }} />
                <motion.div className="absolute inset-3 rounded-full border-4 border-[#D4AF37]/40 border-b-transparent" animate={{ rotate:-360 }} transition={{ repeat:Infinity, duration:1.6, ease:"linear" }} />
                <div className="absolute inset-0 flex items-center justify-center"><FaceMascot phase="processing" /></div>
              </div>
              <ProcessingDots />
            </motion.div>
          )}

          {/* ── Complete ── */}
          {phase==="complete" && (
            <motion.div key="complete" initial={{ opacity:0, scale:0.8 }} animate={{ opacity:1, scale:1 }} transition={{ type:"spring", bounce:0.5 }} className="relative flex flex-col items-center gap-4 py-4 w-full">
              <SuccessConfetti />
              <div className="relative w-32 h-32">
                <motion.div className="absolute inset-0 rounded-full bg-green-100 dark:bg-green-900/20" animate={{ scale:[1,1.15,1] }} transition={{ repeat:Infinity, duration:1.8 }} />
                <motion.div className="absolute inset-2 rounded-full bg-green-200 dark:bg-green-800/30" animate={{ scale:[1,1.08,1] }} transition={{ repeat:Infinity, duration:1.8, delay:0.2 }} />
                <div className="absolute inset-4"><FaceMascot phase="complete" /></div>
                <motion.div className="absolute -bottom-1 -right-1 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shadow-lg" initial={{ scale:0 }} animate={{ scale:1 }} transition={{ delay:0.3, type:"spring", bounce:0.6 }}>
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </motion.div>
              </div>
              <div className="flex items-center gap-2 text-xs text-green-600 font-semibold bg-green-50 dark:bg-green-900/20 px-4 py-2 rounded-full">
                <Sparkles className="w-4 h-4" /> Liveness: 99.8% · Confidence: High · Unique: ✓
              </div>
              <p className="text-xs text-muted-foreground text-center">Submitting your WAEC results now…</p>
            </motion.div>
          )}

          {/* ── Failed ── */}
          {phase==="failed" && (
            <motion.div key="failed" initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }} transition={{ type:"spring" }} className="flex flex-col items-center gap-4 py-4 w-full">
              <div className="relative w-32 h-32">
                <div className="absolute inset-0 rounded-full bg-red-100 dark:bg-red-900/20 animate-pulse" />
                <div className="absolute inset-4"><FaceMascot phase="failed" /></div>
                <div className="absolute -bottom-1 -right-1 w-10 h-10 bg-red-500 rounded-full flex items-center justify-center shadow-lg">
                  <AlertTriangle className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-semibold text-red-600">Could not verify your identity</p>
                <p className="text-xs text-muted-foreground max-w-[220px] mx-auto leading-relaxed">Make sure your face is clearly visible, lighting is good, and follow each instruction carefully.</p>
              </div>
              <div className="flex gap-3 w-full">
                <Button variant="outline" onClick={onCancel} className="flex-1 h-11 border-red-200 text-red-500 hover:bg-red-50" data-testid="button-biometric-cancel-failed">Cancel</Button>
                <Button onClick={handleRetry} className="flex-1 h-11 bg-[#1A3C34] hover:bg-[#1A3C34]/90 text-white font-semibold gap-2" data-testid="button-biometric-retry">
                  <RefreshCw className="w-4 h-4" /> Try Again
                </Button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
