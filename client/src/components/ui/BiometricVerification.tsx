import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Types ──────────────────────────────────────────────────────────────────
type Phase =
  | "intro"
  | "permissions"
  | "positioning"
  | "liveness_left"
  | "liveness_right"
  | "liveness_blink"
  | "processing"
  | "complete";

interface Props {
  onComplete: () => void;
  onCancel: () => void;
}

// ── Animated SVG mascot ────────────────────────────────────────────────────
function FaceMascot({ phase }: { phase: Phase }) {
  const blinking = phase === "liveness_blink";
  const turnLeft = phase === "liveness_left";
  const turnRight = phase === "liveness_right";
  const happy = phase === "complete";
  const idle = phase === "intro" || phase === "positioning";

  return (
    <svg viewBox="0 0 120 120" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      {/* Shadow */}
      <ellipse cx="60" cy="112" rx="28" ry="6" fill="#00000015" />

      {/* Neck */}
      <rect x="50" y="88" width="20" height="16" rx="8" fill="#FBBF9A" />

      {/* Head */}
      <motion.g
        animate={{
          x: turnLeft ? -6 : turnRight ? 6 : 0,
          rotateY: turnLeft ? -20 : turnRight ? 20 : 0,
        }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
        style={{ originX: "60px", originY: "55px" }}
      >
        {/* Head shape */}
        <ellipse cx="60" cy="52" rx="32" ry="36" fill="#FBBF9A" />
        {/* Hair */}
        <ellipse cx="60" cy="22" rx="32" ry="12" fill="#2D1B0E" />
        <rect x="28" y="18" width="64" height="14" rx="7" fill="#2D1B0E" />

        {/* Ears */}
        <ellipse cx="28" cy="52" rx="6" ry="8" fill="#F4A67A" />
        <ellipse cx="92" cy="52" rx="6" ry="8" fill="#F4A67A" />
        <ellipse cx="28.5" cy="52" rx="3.5" ry="5" fill="#E8956A" />
        <ellipse cx="91.5" cy="52" rx="3.5" ry="5" fill="#E8956A" />

        {/* Eyebrows */}
        <motion.g
          animate={{ y: blinking ? 2 : happy ? -2 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <path d="M40 36 Q46 32 52 35" stroke="#2D1B0E" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M68 35 Q74 32 80 36" stroke="#2D1B0E" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </motion.g>

        {/* Eyes */}
        <motion.g
          animate={{ scaleY: blinking ? 0.08 : 1 }}
          transition={{ duration: 0.15, repeat: blinking ? Infinity : 0, repeatDelay: 0.8 }}
          style={{ originX: "60px", originY: "46px" }}
        >
          {/* Left eye */}
          <ellipse cx="46" cy="46" rx="7" ry="7.5" fill="white" />
          <motion.ellipse
            cx="46" cy="46" rx="4.5" ry="5" fill="#1A3C34"
            animate={{ x: turnLeft ? -1.5 : turnRight ? 1.5 : 0 }}
            transition={{ duration: 0.4 }}
          />
          <ellipse cx="44" cy="44" rx="1.5" ry="1.5" fill="white" opacity={0.7} />

          {/* Right eye */}
          <ellipse cx="74" cy="46" rx="7" ry="7.5" fill="white" />
          <motion.ellipse
            cx="74" cy="46" rx="4.5" ry="5" fill="#1A3C34"
            animate={{ x: turnLeft ? -1.5 : turnRight ? 1.5 : 0 }}
            transition={{ duration: 0.4 }}
          />
          <ellipse cx="72" cy="44" rx="1.5" ry="1.5" fill="white" opacity={0.7} />
        </motion.g>

        {/* Nose */}
        <path d="M58 54 Q60 60 62 54" stroke="#E8956A" strokeWidth="1.5" fill="none" strokeLinecap="round" />

        {/* Mouth */}
        <motion.path
          d={happy ? "M48 70 Q60 80 72 70" : idle ? "M50 70 Q60 74 70 70" : "M50 68 Q60 72 70 68"}
          stroke="#C0502A"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          animate={{ d: happy ? "M48 70 Q60 82 72 70" : "M50 68 Q60 72 70 68" }}
          transition={{ duration: 0.4 }}
        />
        {happy && (
          <>
            <path d="M48 70 Q48 76 52 76 Q56 76 56 70" fill="#E8956A" opacity={0.5} />
            <path d="M64 70 Q64 76 68 76 Q72 76 72 70" fill="#E8956A" opacity={0.5} />
          </>
        )}

        {/* Cheeks */}
        {(happy || idle) && (
          <>
            <ellipse cx="38" cy="60" rx="7" ry="5" fill="#F4A67A" opacity={0.4} />
            <ellipse cx="82" cy="60" rx="7" ry="5" fill="#F4A67A" opacity={0.4} />
          </>
        )}

        {/* TSIA badge */}
        {phase === "intro" && (
          <motion.g
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.4, type: "spring" }}
          >
            <rect x="44" y="82" width="32" height="14" rx="7" fill="#1A3C34" />
            <text x="60" y="92.5" textAnchor="middle" fill="#D4AF37" fontSize="7" fontWeight="bold">TSIA</text>
          </motion.g>
        )}
      </motion.g>

      {/* Direction arrows */}
      <AnimatePresence>
        {turnLeft && (
          <motion.g
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ repeat: Infinity, repeatType: "reverse", duration: 0.7 }}
          >
            <path d="M18 52 L8 52 L13 45 M8 52 L13 59" stroke="#D4AF37" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </motion.g>
        )}
        {turnRight && (
          <motion.g
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ repeat: Infinity, repeatType: "reverse", duration: 0.7 }}
          >
            <path d="M102 52 L112 52 L107 45 M112 52 L107 59" stroke="#D4AF37" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </motion.g>
        )}
        {blinking && (
          <motion.g
            animate={{ scaleY: [1, 0.1, 1], opacity: [1, 0.4, 1] }}
            transition={{ repeat: Infinity, duration: 1.2 }}
            style={{ originX: "60px", originY: "20px" }}
          >
            <text x="60" y="20" textAnchor="middle" fontSize="13">👁️</text>
          </motion.g>
        )}
      </AnimatePresence>
    </svg>
  );
}

// ── Scan Line overlay ──────────────────────────────────────────────────────
function ScanLine() {
  return (
    <motion.div
      className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent pointer-events-none"
      style={{ top: 0 }}
      animate={{ top: ["0%", "100%", "0%"] }}
      transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
    />
  );
}

// ── Corner brackets for face frame ────────────────────────────────────────
function FaceFrame({ active }: { active: boolean }) {
  const color = active ? "#D4AF37" : "#ffffff80";
  const size = 20;
  const w = 3;
  return (
    <svg viewBox="0 0 260 300" className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
      {/* Top-left */}
      <path d={`M${size} 0 L0 0 L0 ${size}`} stroke={color} strokeWidth={w} fill="none" />
      {/* Top-right */}
      <path d={`M${260 - size} 0 L260 0 L260 ${size}`} stroke={color} strokeWidth={w} fill="none" />
      {/* Bottom-left */}
      <path d={`M0 ${300 - size} L0 300 L${size} 300`} stroke={color} strokeWidth={w} fill="none" />
      {/* Bottom-right */}
      <path d={`M${260 - size} 300 L260 300 L260 ${300 - size}`} stroke={color} strokeWidth={w} fill="none" />
    </svg>
  );
}

// ── Step pills ─────────────────────────────────────────────────────────────
const STEPS: { id: Phase; label: string }[] = [
  { id: "positioning", label: "Position" },
  { id: "liveness_left", label: "Turn Left" },
  { id: "liveness_right", label: "Turn Right" },
  { id: "liveness_blink", label: "Blink" },
  { id: "processing", label: "Verify" },
];
const LIVENESS_PHASES: Phase[] = ["positioning", "liveness_left", "liveness_right", "liveness_blink"];

function StepPills({ phase }: { phase: Phase }) {
  const activeIdx = STEPS.findIndex(s => s.id === phase);
  return (
    <div className="flex items-center gap-1 w-full">
      {STEPS.map((s, i) => {
        const done = activeIdx > i;
        const current = activeIdx === i;
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
  const tasks = ["Extracting facial geometry", "Running liveness detection", "Matching identity record", "Finalising verification"];
  const [done, setDone] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setDone(d => d < tasks.length ? d + 1 : d), 700);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="space-y-2 w-full max-w-xs">
      {tasks.map((t, i) => (
        <motion.div
          key={t}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: i <= done ? 1 : 0.3, x: 0 }}
          transition={{ delay: i * 0.1 }}
          className="flex items-center gap-2 text-sm"
        >
          {i < done
            ? <CheckCircle2 className="w-4 h-4 text-[#D4AF37] flex-shrink-0" />
            : i === done
              ? <motion.div className="w-4 h-4 border-2 border-[#1A3C34] border-t-transparent rounded-full flex-shrink-0"
                  animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }} />
              : <div className="w-4 h-4 border-2 border-gray-300 rounded-full flex-shrink-0" />
          }
          <span className={i < done ? "text-[#1A3C34] dark:text-[#D4AF37] font-medium" : "text-muted-foreground"}>{t}</span>
        </motion.div>
      ))}
    </div>
  );
}

// ── Success confetti dots ──────────────────────────────────────────────────
function SuccessConfetti() {
  const dots = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    color: i % 3 === 0 ? "#D4AF37" : i % 3 === 1 ? "#1A3C34" : "#22C55E",
    x: Math.random() * 280 - 40,
    delay: Math.random() * 0.4,
    size: 4 + Math.random() * 6,
  }));
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {dots.map(d => (
        <motion.div
          key={d.id}
          className="absolute rounded-full"
          style={{ width: d.size, height: d.size, backgroundColor: d.color, left: d.x, top: -10 }}
          animate={{ y: 320, opacity: [1, 1, 0] }}
          transition={{ duration: 1.4, delay: d.delay, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function BiometricVerification({ onComplete, onCancel }: Props) {
  const [phase, setPhase] = useState<Phase>("intro");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  const startCamera = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: 640, height: 480 },
    });
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play();
    }
  };

  // ── Phase sequencer ────────────────────────────────────────────────────
  const runLivenessSequence = () => {
    const seq: { p: Phase; ms: number }[] = [
      { p: "liveness_left",  ms: 2200 },
      { p: "liveness_right", ms: 2200 },
      { p: "liveness_blink", ms: 2400 },
      { p: "processing",     ms: 3200 },
      { p: "complete",       ms: 0    },
    ];
    let delay = 0;
    seq.forEach(({ p, ms }) => {
      setTimeout(() => setPhase(p), delay);
      delay += ms;
    });
    // stop camera after liveness checks
    setTimeout(stopCamera, 2200 + 2200 + 2400);
    // fire onComplete after complete phase shows briefly
    setTimeout(onComplete, delay + 1200);
  };

  const handleStart = async () => {
    setPhase("permissions");
    try {
      await startCamera();
      setPhase("positioning");
      setTimeout(runLivenessSequence, 2000);
    } catch {
      setPhase("intro");
    }
  };

  useEffect(() => () => stopCamera(), []);

  const inLiveness = LIVENESS_PHASES.includes(phase);
  const inCamera   = inLiveness || phase === "positioning";

  // ── Phase content map ──────────────────────────────────────────────────
  const phaseContent: Partial<Record<Phase, { title: string; sub: string }>> = {
    intro:           { title: "Face Verification",        sub: "Quick liveness check to confirm your identity" },
    permissions:     { title: "Starting Camera…",         sub: "Allow camera access when prompted" },
    positioning:     { title: "Position Your Face",       sub: "Centre your face in the oval frame" },
    liveness_left:   { title: "Turn Head Left",           sub: "Slowly turn your head to the left" },
    liveness_right:  { title: "Turn Head Right",          sub: "Now slowly turn your head to the right" },
    liveness_blink:  { title: "Blink Naturally",          sub: "Blink once to confirm liveness" },
    processing:      { title: "Analysing Biometrics",     sub: "Please wait while we verify your identity" },
    complete:        { title: "Verification Successful!", sub: "Your identity has been confirmed" },
  };

  const content = phaseContent[phase];

  return (
    <div className="flex flex-col items-center gap-4 w-full select-none">

      {/* Header */}
      <AnimatePresence mode="wait">
        <motion.div
          key={phase + "_header"}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.3 }}
          className="text-center"
        >
          <h3 className={`text-lg font-bold ${phase === "complete" ? "text-green-600" : "text-[#1A3C34] dark:text-[#D4AF37]"}`}>
            {content?.title}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">{content?.sub}</p>
        </motion.div>
      </AnimatePresence>

      {/* Step pills (only during camera phases) */}
      <AnimatePresence>
        {(inCamera || phase === "processing") && (
          <motion.div className="w-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <StepPills phase={phase} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main visual area */}
      <div className="w-full flex items-center justify-center">
        <AnimatePresence mode="wait">

          {/* ── Intro ── */}
          {phase === "intro" && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center gap-4 w-full"
            >
              {/* Mascot with glow ring */}
              <div className="relative w-36 h-36">
                <motion.div
                  className="absolute inset-0 rounded-full bg-[#1A3C34]/10 dark:bg-[#D4AF37]/10"
                  animate={{ scale: [1, 1.12, 1] }}
                  transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
                />
                <motion.div
                  className="absolute inset-2 rounded-full bg-[#1A3C34]/5"
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut", delay: 0.3 }}
                />
                <div className="absolute inset-4">
                  <FaceMascot phase="intro" />
                </div>
                {/* Wave hand */}
                <motion.div
                  className="absolute -right-2 -bottom-1 text-2xl"
                  animate={{ rotate: [0, 20, -10, 20, 0] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut", delay: 0.5 }}
                >
                  👋
                </motion.div>
              </div>

              {/* Tips */}
              <div className="w-full bg-[#1A3C34]/5 dark:bg-[#D4AF37]/5 rounded-xl p-3 space-y-2">
                {[
                  { icon: "💡", text: "Use good lighting — face your light source" },
                  { icon: "🔒", text: "Remove glasses, hats or face coverings" },
                  { icon: "📱", text: "Hold your device at eye level, stay still" },
                ].map(tip => (
                  <div key={tip.text} className="flex items-start gap-2 text-sm">
                    <span className="text-base leading-5">{tip.icon}</span>
                    <span className="text-muted-foreground text-xs leading-5">{tip.text}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 w-full">
                <Button variant="outline" onClick={onCancel} className="flex-1 h-11 border-[#1A3C34]/30" data-testid="button-biometric-cancel">
                  Cancel
                </Button>
                <Button onClick={handleStart} className="flex-1 h-11 bg-[#1A3C34] hover:bg-[#1A3C34]/90 text-white font-semibold" data-testid="button-biometric-start">
                  Start Verification →
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── Permissions ── */}
          {phase === "permissions" && (
            <motion.div
              key="permissions"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4 py-4"
            >
              <motion.div
                className="w-20 h-20 bg-[#1A3C34]/10 rounded-full flex items-center justify-center text-4xl"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
              >
                📷
              </motion.div>
              <p className="text-sm text-muted-foreground text-center">Requesting camera access…<br />Please tap <strong>Allow</strong> when prompted.</p>
            </motion.div>
          )}

          {/* ── Camera (positioning + liveness) ── */}
          {inCamera && (
            <motion.div
              key="camera"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="w-full flex flex-col items-center gap-3"
            >
              {/* Camera viewport with oval mask and face guide */}
              <div className="relative w-56 h-64 rounded-3xl overflow-hidden bg-black shadow-xl shadow-black/30">
                {/* Live video */}
                <video
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                  autoPlay
                  playsInline
                  muted
                />

                {/* Dark vignette overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/40 pointer-events-none" />

                {/* Oval face guide */}
                <svg viewBox="0 0 224 256" className="absolute inset-0 w-full h-full pointer-events-none">
                  {/* Dark mask outside oval */}
                  <defs>
                    <mask id="oval-mask">
                      <rect width="224" height="256" fill="white" />
                      <ellipse cx="112" cy="118" rx="72" ry="90" fill="black" />
                    </mask>
                  </defs>
                  <rect width="224" height="256" fill="black" fillOpacity={0.45} mask="url(#oval-mask)" />
                  {/* Oval border */}
                  <ellipse cx="112" cy="118" rx="72" ry="90"
                    stroke={inLiveness ? "#D4AF37" : "white"} strokeWidth="2.5" fill="none"
                    strokeDasharray={inLiveness ? "6 3" : "none"}
                  />
                  {/* Corner ticks */}
                  <path d="M112 28 L112 38" stroke={inLiveness ? "#D4AF37" : "white"} strokeWidth="2" />
                  <path d="M112 198 L112 208" stroke={inLiveness ? "#D4AF37" : "white"} strokeWidth="2" />
                  <path d="M40 118 L50 118"  stroke={inLiveness ? "#D4AF37" : "white"} strokeWidth="2" />
                  <path d="M174 118 L184 118" stroke={inLiveness ? "#D4AF37" : "white"} strokeWidth="2" />
                </svg>

                {/* Scan line */}
                {phase === "positioning" && <ScanLine />}

                {/* Face frame corner brackets */}
                <FaceFrame active={inLiveness} />

                {/* Phase badge */}
                <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1">
                  <motion.div
                    className="w-2 h-2 rounded-full bg-red-500"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ repeat: Infinity, duration: 0.8 }}
                  />
                  <span className="text-white text-[10px] font-bold uppercase tracking-wide">
                    {phase === "positioning" ? "Scanning" : phase === "liveness_left" ? "Turn Left" : phase === "liveness_right" ? "Turn Right" : "Blink"}
                  </span>
                </div>

                {/* Direction arrows overlaid on video */}
                <AnimatePresence>
                  {phase === "liveness_left" && (
                    <motion.div
                      key="arr-left"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: [0.7, 1, 0.7], x: [0, -6, 0] }}
                      exit={{ opacity: 0 }}
                      transition={{ repeat: Infinity, duration: 0.9 }}
                      className="absolute left-2 top-1/2 -translate-y-1/2 text-[#D4AF37]"
                    >
                      <svg width="28" height="28" viewBox="0 0 28 28">
                        <path d="M18 5 L8 14 L18 23" stroke="#D4AF37" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </motion.div>
                  )}
                  {phase === "liveness_right" && (
                    <motion.div
                      key="arr-right"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: [0.7, 1, 0.7], x: [0, 6, 0] }}
                      exit={{ opacity: 0 }}
                      transition={{ repeat: Infinity, duration: 0.9 }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[#D4AF37]"
                    >
                      <svg width="28" height="28" viewBox="0 0 28 28">
                        <path d="M10 5 L20 14 L10 23" stroke="#D4AF37" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </motion.div>
                  )}
                  {phase === "liveness_blink" && (
                    <motion.div
                      key="blink-hint"
                      animate={{ opacity: [0.8, 1, 0.8] }}
                      transition={{ repeat: Infinity, duration: 0.7 }}
                      className="absolute bottom-8 left-0 right-0 flex justify-center"
                    >
                      <div className="bg-[#D4AF37]/90 text-white text-[11px] font-bold px-3 py-1 rounded-full">
                        👁️  Blink naturally
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Mascot thumbnail + instruction */}
              <div className="flex items-center gap-3 bg-[#1A3C34]/5 dark:bg-[#D4AF37]/5 rounded-xl px-3 py-2 w-full max-w-xs">
                <div className="w-12 h-12 flex-shrink-0">
                  <FaceMascot phase={phase} />
                </div>
                <p className="text-xs text-[#1A3C34] dark:text-[#D4AF37] font-semibold leading-snug">
                  {phase === "positioning"    && "Move your face into the oval frame. Keep still."}
                  {phase === "liveness_left"  && "Slowly turn your head to the LEFT until you see the tick."}
                  {phase === "liveness_right" && "Good! Now slowly turn your head to the RIGHT."}
                  {phase === "liveness_blink" && "Almost done! Blink once naturally."}
                </p>
              </div>
            </motion.div>
          )}

          {/* ── Processing ── */}
          {phase === "processing" && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-5 py-2 w-full"
            >
              {/* Circular scan animation */}
              <div className="relative w-28 h-28">
                <motion.div
                  className="absolute inset-0 rounded-full border-4 border-[#1A3C34]/20"
                />
                <motion.div
                  className="absolute inset-0 rounded-full border-4 border-[#1A3C34] border-t-transparent"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                />
                <motion.div
                  className="absolute inset-3 rounded-full border-4 border-[#D4AF37]/40 border-b-transparent"
                  animate={{ rotate: -360 }}
                  transition={{ repeat: Infinity, duration: 1.6, ease: "linear" }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <FaceMascot phase="processing" />
                </div>
              </div>
              <ProcessingDots />
            </motion.div>
          )}

          {/* ── Complete ── */}
          {phase === "complete" && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", bounce: 0.5 }}
              className="relative flex flex-col items-center gap-4 py-4 w-full"
            >
              <SuccessConfetti />
              {/* Success ring */}
              <div className="relative w-32 h-32">
                <motion.div
                  className="absolute inset-0 rounded-full bg-green-100 dark:bg-green-900/20"
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ repeat: Infinity, duration: 1.8 }}
                />
                <motion.div
                  className="absolute inset-2 rounded-full bg-green-200 dark:bg-green-800/30"
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ repeat: Infinity, duration: 1.8, delay: 0.2 }}
                />
                <div className="absolute inset-4 flex items-center justify-center">
                  <FaceMascot phase="complete" />
                </div>
                <motion.div
                  className="absolute -bottom-1 -right-1 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shadow-lg"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: "spring", bounce: 0.6 }}
                >
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </motion.div>
              </div>

              <div className="flex items-center gap-2 text-xs text-green-600 font-semibold bg-green-50 dark:bg-green-900/20 px-4 py-2 rounded-full">
                <Sparkles className="w-4 h-4" />
                Liveness: 99.8% · Confidence: High · Unique: ✓
              </div>
              <p className="text-xs text-muted-foreground text-center">Submitting your WAEC results now…</p>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
