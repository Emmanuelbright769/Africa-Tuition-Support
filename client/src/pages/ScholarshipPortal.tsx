import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Trophy, ArrowLeft, ArrowRight, CheckCircle2, XCircle, Clock, Loader2,
  BookOpen, Calculator, AlertTriangle, Star, Wallet, GraduationCap, Zap,
} from "lucide-react";

type ScholarshipType = "student" | "masters";
type Step = "welcome" | "tertiary" | "waec" | "pay_fee" | "commitment" | "test_intro" | "test" | "result" | "cooldown";
type TestPhase = "verbal" | "transition" | "quant" | "submitting";
type TertiaryGrade = "first_class" | "second_upper" | "second_lower";
type MscDuration = "1year" | "2year";

const TERTIARY_GRADES: { value: TertiaryGrade; label: string }[] = [
  { value: "first_class",   label: "First Class" },
  { value: "second_upper",  label: "Second Class Upper" },
  { value: "second_lower",  label: "Second Class Lower" },
];
const TERTIARY_YEARS = Array.from({ length: 30 }, (_, i) => String(new Date().getFullYear() - i));

interface TestQuestion {
  id: number;
  category: "verbal" | "quant";
  text: string;
  options: string[];
  correctIndex: number;
}

interface TestResult {
  verbalScore: number;
  quantScore: number;
  totalScore: number;
  waecScore: number;
  testScore: number;
  aggregateScore: number;
  passed: boolean;
  prizeAmount: number;
}

const SUBJECTS_COMPULSORY = ["Mathematics", "English Language"];
const SUBJECTS_ELECTIVE = [
  "Biology","Chemistry","Physics","Economics","Commerce","Accounting",
  "Geography","Government","Literature in English","Agricultural Science",
  "Further Mathematics","Technical Drawing","Food and Nutrition",
  "Computer Studies","Civic Education","History","French","Yoruba","Igbo","Hausa",
];
const GRADES = ["A1","B2","B3","C4","C5","C6","D7","E8","F9"];
const YEARS = Array.from({ length: 20 }, (_, i) => String(new Date().getFullYear() - i));

function TimerRing({ seconds, max, size = 80, color = "#6366f1" }: { seconds: number; max: number; size?: number; color?: string }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, seconds / max);
  const dash = pct * circ;
  const urgentColor = seconds <= 3 ? "#ef4444" : seconds <= 6 ? "#f59e0b" : color;
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={6} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={urgentColor} strokeWidth={6}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.3s linear, stroke 0.2s" }} />
      <text x="50%" y="50%" fill={urgentColor} fontSize={size * 0.28} fontWeight="bold" textAnchor="middle"
        dominantBaseline="central" style={{ transform: "rotate(90deg)", transformOrigin: "50% 50%", transition: "fill 0.2s" }}>
        {seconds}
      </text>
    </svg>
  );
}

function SectionTimer({ seconds }: { seconds: number }) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  const urgent = seconds <= 60;
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono font-bold text-sm ${urgent ? "bg-red-500/20 text-red-400 animate-pulse" : "bg-white/10 text-white"}`}>
      <Clock className="w-3.5 h-3.5" />
      {m}:{s}
    </div>
  );
}

function SubjectRow({ index, subject, grade, electives, onSubjectChange, onGradeChange }: {
  index: number; subject: string; grade: string; electives: string[];
  onSubjectChange: (v: string) => void; onGradeChange: (v: string) => void;
}) {
  const isCompulsory = index < 2;
  const triggerCls = "h-10 rounded-xl bg-white/10 border-white/20 text-white [&>span]:text-white [&>span[data-placeholder]]:text-white/40 focus:ring-white/30";
  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        {isCompulsory ? (
          <div className="h-10 flex items-center px-3 rounded-xl bg-white/10 text-white text-sm font-medium border border-white/20">
            {SUBJECTS_COMPULSORY[index]}
          </div>
        ) : (
          <Select value={subject} onValueChange={onSubjectChange}>
            <SelectTrigger className={triggerCls}>
              <SelectValue placeholder="Select subject" />
            </SelectTrigger>
            <SelectContent className="max-h-56 overflow-y-auto">
              {electives.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>
      <Select value={grade} onValueChange={onGradeChange}>
        <SelectTrigger className={triggerCls}>
          <SelectValue placeholder="Grade" />
        </SelectTrigger>
        <SelectContent className="max-h-56 overflow-y-auto">
          {GRADES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function ScholarshipPortal() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const urlParams = new URLSearchParams(window.location.search);
  const urlType = urlParams.get("type") as ScholarshipType | null;

  const [scholarshipType, setScholarshipType] = useState<ScholarshipType | null>(urlType);
  const [step, setStep] = useState<Step>("welcome");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  const [scholarshipRecord, setScholarshipRecord] = useState<any>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletActivated, setWalletActivated] = useState<boolean | null>(null);

  // Tertiary (Masters only)
  const [tertiarySchool, setTertiarySchool] = useState("");
  const [tertiaryType, setTertiaryType] = useState<"university" | "polytechnic" | "">("");
  const [tertiaryYear, setTertiaryYear] = useState("");
  const [tertiaryGrade, setTertiaryGrade] = useState<TertiaryGrade | "">("");

  // MSc duration choice (Masters only)
  const [mscDuration, setMscDuration] = useState<MscDuration | "">("");
  // 365-day cooldown
  const [cooldownDaysLeft, setCooldownDaysLeft] = useState(0);

  // WAEC form
  const [waecReg, setWaecReg] = useState("");
  const [waecYear, setWaecYear] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [schoolLocation, setSchoolLocation] = useState("");
  const [subjects, setSubjects] = useState<string[]>(["Mathematics", "English Language", "", "", ""]);
  const [grades, setGrades] = useState<string[]>(["", "", "", "", ""]);

  // Test state
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [liveScore, setLiveScore] = useState({ verbal: 0, quant: 0 });
  const [questionTimer, setQuestionTimer] = useState(15);
  const [sectionTimer, setSectionTimer] = useState(900);
  const [testPhase, setTestPhase] = useState<TestPhase>("verbal");
  const [showFeedback, setShowFeedback] = useState<{ selected: number; correct: number } | null>(null);
  const [result, setResult] = useState<TestResult | null>(null);
  const [verbalsComplete, setVerbalsComplete] = useState(false);

  const questionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sectionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSubmitRef = useRef(false);

  const verbalQs = questions.filter(q => q.category === "verbal");
  const quantQs = questions.filter(q => q.category === "quant");
  const currentPhaseQs = testPhase === "verbal" || testPhase === "quant" ? (testPhase === "verbal" ? verbalQs : quantQs) : [];
  const currentQ = currentPhaseQs[currentIdx];
  const phaseScore = testPhase === "verbal" ? liveScore.verbal : liveScore.quant;

  // Refresh wallet balance independently so payment screens always show the real balance
  const refreshWalletBalance = useCallback(async () => {
    try {
      const w = await (await apiRequest("GET", "/api/wallet/balances")).json();
      setWalletBalance(parseFloat((w as any).confirmedBalance ?? "0"));
      setWalletActivated(!!(w as any).activated);
    } catch { /* ignore */ }
  }, []);

  // Load existing scholarship status
  useEffect(() => {
    (async () => {
      try {
        const [schData] = await Promise.all([
          apiRequest("GET", "/api/scholarship/my").then(r => r.json()),
          refreshWalletBalance(),
        ]);
        const rec = scholarshipType ? (schData as any)[scholarshipType] : null;
        if (rec) {
          setScholarshipRecord(rec);
          restoreStep(rec, scholarshipType!);
        } else if (scholarshipType) {
          setStep("waec");
        }
      } catch { /* not logged in or error */ }
      setPageLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scholarshipType]);

  // Re-fetch wallet balance whenever the user lands on a payment step so it's always fresh
  useEffect(() => {
    if (step !== "pay_fee" && step !== "commitment") return;
    refreshWalletBalance(); // immediate fetch on entry
    const interval = setInterval(refreshWalletBalance, 15_000); // keep refreshing every 15s
    return () => clearInterval(interval);
  }, [step, refreshWalletBalance]);

  function restoreStep(rec: any, type: ScholarshipType) {
    const s = rec.status;
    if (s === "started") {
      // Masters must fill tertiary info before WAEC (only on first run; after restart it's already saved)
      if (type === "masters" && !rec.tertiarySchool) { setStep("tertiary"); return; }
      // Restore tertiary state from the saved record so waec-validate doesn't get blank fields
      if (type === "masters" && rec.tertiarySchool) {
        setTertiarySchool(rec.tertiarySchool ?? "");
        setTertiaryType(rec.tertiaryType ?? "");
        setTertiaryYear(rec.tertiaryYear ?? "");
        setTertiaryGrade(rec.tertiaryGrade ?? "");
      }
      setStep("waec"); return;
    }
    if (s === "waec_done") { setStep("pay_fee"); return; }
    if (s === "fee_paid" && type === "student") { setStep("test_intro"); return; }
    if (s === "fee_paid" && type === "masters") {
      if (rec.commitmentFeePaid) { setStep("test_intro"); return; }
      setStep("commitment"); return;
    }
    if (s === "test_in_progress") { setStep("test_intro"); return; }
    if (s === "passed" || s === "failed") {
      // 365-day cooldown: if test was completed less than 365 days ago, block re-enrollment
      if (rec.testCompletedAt) {
        const daysSince = (Date.now() - new Date(rec.testCompletedAt).getTime()) / 86400000;
        if (daysSince < 365) {
          setCooldownDaysLeft(Math.ceil(365 - daysSince));
          setStep("cooldown");
          return;
        }
      }
      // 365+ days passed: show previous result (user can start fresh from welcome)
      const vs = rec.verbalScore ?? 0; const qs = rec.quantScore ?? 0; const ts = vs + qs;
      const waecPct = parseFloat(rec.waecPercentage ?? "0");
      const testPct = (ts / 30) * 100;
      setResult({ verbalScore: vs, quantScore: qs, totalScore: ts, waecScore: waecPct, testScore: testPct, aggregateScore: (waecPct + testPct) / 2, passed: s === "passed", prizeAmount: rec.prizeAmount ? parseFloat(rec.prizeAmount) : 0 });
      setStep("result");
    }
  }

  // ── Question timer (30s per question) ───────────────────────────────────────
  const clearTimers = useCallback(() => {
    if (questionTimerRef.current) clearInterval(questionTimerRef.current);
    if (sectionTimerRef.current) clearInterval(sectionTimerRef.current);
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
  }, []);

  const advanceQuestion = useCallback((selectedIdx: number | null, qs: TestQuestion[], idx: number, phase: TestPhase) => {
    if (questionTimerRef.current) clearInterval(questionTimerRef.current);
    const q = qs[idx];
    if (!q) return;
    const isCorrect = selectedIdx !== null && selectedIdx === q.correctIndex;

    if (phase === "verbal") {
      setLiveScore(prev => ({ ...prev, verbal: prev.verbal + (isCorrect ? 1 : 0) }));
    } else {
      setLiveScore(prev => ({ ...prev, quant: prev.quant + (isCorrect ? 1 : 0) }));
    }

    const selected = selectedIdx ?? -1;
    setAnswers(prev => ({ ...prev, [q.id]: selected }));
    setShowFeedback({ selected, correct: q.correctIndex });

    feedbackTimeoutRef.current = setTimeout(() => {
      setShowFeedback(null);
      const nextIdx = idx + 1;
      if (nextIdx < qs.length) {
        setCurrentIdx(nextIdx);
        setQuestionTimer(10);
      } else {
        // Section complete
        if (sectionTimerRef.current) clearInterval(sectionTimerRef.current);
        if (phase === "verbal") {
          setVerbalsComplete(true);
          setTestPhase("transition");
        } else {
          setTestPhase("submitting");
        }
      }
    }, 1000);
  }, []);

  useEffect(() => {
    if (step !== "test" || (testPhase !== "verbal" && testPhase !== "quant") || !currentQ) return;
    setQuestionTimer(15);
    questionTimerRef.current = setInterval(() => {
      setQuestionTimer(prev => {
        if (prev <= 1) {
          const qs = testPhase === "verbal" ? verbalQs : quantQs;
          advanceQuestion(null, qs, currentIdx, testPhase);
          return 20;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (questionTimerRef.current) clearInterval(questionTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, testPhase, currentIdx]);

  // Section timer (15 min)
  useEffect(() => {
    if (step !== "test" || (testPhase !== "verbal" && testPhase !== "quant")) return;
    setSectionTimer(900);
    sectionTimerRef.current = setInterval(() => {
      setSectionTimer(prev => {
        if (prev <= 1) {
          clearInterval(sectionTimerRef.current!);
          if (testPhase === "verbal") {
            setVerbalsComplete(true);
            setTestPhase("transition");
          } else {
            setTestPhase("submitting");
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (sectionTimerRef.current) clearInterval(sectionTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, testPhase]);

  // Transition between verbal and quant
  useEffect(() => {
    if (testPhase === "transition") {
      const t = setTimeout(() => {
        setTestPhase("quant");
        setCurrentIdx(0);
        setQuestionTimer(10);
      }, 3500);
      return () => clearTimeout(t);
    }
  }, [testPhase]);

  // Auto-submit when all answers recorded
  useEffect(() => {
    if (testPhase === "submitting" && !autoSubmitRef.current) {
      autoSubmitRef.current = true;
      submitTest();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testPhase]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleSelectType(type: ScholarshipType) {
    setScholarshipType(type);
    setPageLoading(true);
    try {
      const data = await (await apiRequest("GET", "/api/scholarship/my")).json();
      const rec = (data as any)[type];
      if (rec) {
        // Completed test: check cooldown before allowing re-enrollment
        if ((rec.status === "passed" || rec.status === "failed") && rec.testCompletedAt) {
          const daysSince = (Date.now() - new Date(rec.testCompletedAt).getTime()) / 86400000;
          if (daysSince < 365) {
            setScholarshipRecord(rec);
            setCooldownDaysLeft(Math.ceil(365 - daysSince));
            setStep("cooldown");
            setPageLoading(false);
            return;
          }
          // 365 days passed — start fresh enrollment
          const fresh = await (await apiRequest("POST", "/api/scholarship/start", { type })).json();
          setScholarshipRecord(fresh as any);
          setStep(type === "masters" ? "tertiary" : "waec");
          setPageLoading(false);
          return;
        }
        setScholarshipRecord(rec);
        restoreStep(rec, type);
      } else {
        await apiRequest("POST", "/api/scholarship/start", { type });
        // Masters must fill tertiary details first
        setStep(type === "masters" ? "tertiary" : "waec");
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setPageLoading(false);
  }

  function handleTertiaryNext() {
    if (!tertiarySchool.trim()) {
      toast({ title: "Missing field", description: "Enter your tertiary institution name.", variant: "destructive" }); return;
    }
    if (!tertiaryType) {
      toast({ title: "Missing field", description: "Select your certificate type (University or Polytechnic).", variant: "destructive" }); return;
    }
    if (!tertiaryYear) {
      toast({ title: "Missing field", description: "Select the year you graduated.", variant: "destructive" }); return;
    }
    if (!tertiaryGrade) {
      toast({ title: "Missing field", description: "Select your degree classification.", variant: "destructive" }); return;
    }
    setStep("waec");
  }

  async function handleWaecSubmit() {
    if (!scholarshipType) return;
    const allSubjectsFilled = subjects.every(Boolean);
    const allGradesFilled = grades.every(Boolean);
    if (!waecReg || !waecYear || !schoolName || !schoolLocation) {
      toast({ title: "Missing fields", description: "Fill in all school and WAEC details.", variant: "destructive" }); return;
    }
    if (!allSubjectsFilled || !allGradesFilled) {
      toast({ title: "Missing fields", description: "Select all 5 subjects and their grades.", variant: "destructive" }); return;
    }
    setLoading(true);
    try {
      const data = await (await apiRequest("POST", "/api/scholarship/waec-validate", {
        type: scholarshipType, waecRegNumber: waecReg, waecYear,
        subjects, grades, schoolName, schoolLocation,
        ...(scholarshipType === "masters" ? { tertiarySchool, tertiaryType, tertiaryYear, tertiaryGrade } : {}),
      })).json();
      setScholarshipRecord(data);
      setStep("pay_fee");
    } catch (e: any) {
      toast({ title: "WAEC Validation Failed", description: e.message, variant: "destructive" });
      setStep("waec");
    }
    setLoading(false);
  }

  async function handlePayFee() {
    if (!scholarshipType) return;
    setLoading(true);
    try {
      const data = await (await apiRequest("POST", "/api/scholarship/pay-fee", { type: scholarshipType })).json();
      setScholarshipRecord(data);
      if (scholarshipType === "masters") {
        // commitmentFeePaid=true means 30-day window already served → go to test
        if ((data as any).commitmentFeePaid) { setStep("test_intro"); }
        else { setStep("commitment"); }
      } else {
        setStep("test_intro");
      }
      setWalletBalance(prev => prev !== null ? prev - 3.30 : null);
    } catch (e: any) {
      toast({ title: "Payment Failed", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  }

  async function handlePayCommitment() {
    if (!mscDuration) {
      toast({ title: "Choose your MSc duration", description: "Select 1-Year or 2-Year before paying.", variant: "destructive" }); return;
    }
    setLoading(true);
    const fee = mscDuration === "2year" ? 25 : 10;
    try {
      const res = await apiRequest("POST", "/api/scholarship/pay-commitment", { mscDuration });
      const data = await res.json();
      if ((data as any).code === "COMMITMENT_EXPIRED") {
        // Record was deleted server-side — reset to fresh welcome
        toast({ title: "Window Expired", description: "Your 30-day window has passed. Starting fresh.", variant: "destructive" });
        setScholarshipRecord(null);
        setStep("welcome");
        setLoading(false);
        return;
      }
      setScholarshipRecord(data);
      // After paying, record resets to "started" — user does WAEC fresh (tertiary already saved)
      setStep("waec");
      setWaecReg(""); setWaecYear(""); setSchoolName(""); setSchoolLocation("");
      setSubjects(["Mathematics", "English Language", "", "", ""]);
      setGrades(["", "", "", "", ""]);
      setWalletBalance(prev => prev !== null ? prev - fee : null);
    } catch (e: any) {
      toast({ title: "Payment Failed", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  }

  async function handlePayRenewal() {
    setLoading(true);
    try {
      const data = await (await apiRequest("POST", "/api/scholarship/pay-renewal", {})).json();
      setScholarshipRecord((prev: any) => ({ ...prev, ...(data as any) }));
      setWalletBalance(prev => prev !== null ? prev - 25 : null);
      toast({ title: "Renewal Paid!", description: "Your second $250 prize is pending admin approval.", variant: "default" });
    } catch (e: any) {
      toast({ title: "Renewal Failed", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  }

  async function handleStartTest() {
    if (!scholarshipType) return;
    setLoading(true);
    try {
      const data = await (await apiRequest("POST", "/api/scholarship/start-test", { type: scholarshipType })).json() as { verbal: TestQuestion[]; quant: TestQuestion[] };
      setQuestions([...data.verbal, ...data.quant]);
      setCurrentIdx(0);
      setAnswers({});
      setLiveScore({ verbal: 0, quant: 0 });
      setTestPhase("verbal");
      setShowFeedback(null);
      setVerbalsComplete(false);
      autoSubmitRef.current = false;
      setStep("test");
    } catch (e: any) {
      toast({ title: "Could not start test", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  }

  async function submitTest() {
    if (!scholarshipType) return;
    const allQs = [...verbalQs, ...quantQs];
    const answerPayload = allQs.map(q => ({ questionId: q.id, selectedIndex: answers[q.id] ?? -1 }));
    try {
      const data = await (await apiRequest("POST", "/api/scholarship/submit-test", {
        type: scholarshipType, answers: answerPayload,
      })).json() as TestResult;
      clearTimers();
      setResult(data);
      setStep("result");
    } catch (e: any) {
      toast({ title: "Submission failed", description: e.message, variant: "destructive" });
      autoSubmitRef.current = false;
      setTestPhase("submitting");
    }
  }

  // Commitment window: days remaining to pay. windowExpired = deadline passed.
  const daysLeft = scholarshipRecord?.commitmentStartDate
    ? Math.max(0, 30 - Math.floor((Date.now() - new Date(scholarshipRecord.commitmentStartDate).getTime()) / 86400000))
    : 30;
  const windowExpired = daysLeft === 0 && !!scholarshipRecord?.commitmentStartDate;

  // ── Render ────────────────────────────────────────────────────────────────

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-white">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />
          <p className="text-sm text-indigo-300">Loading scholarship portal…</p>
        </div>
      </div>
    );
  }

  // ── WALLET ACTIVATION GATE ────────────────────────────────────────────────
  if (walletActivated === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Wallet className="w-10 h-10 text-amber-400" />
          </div>
          <h2 className="text-2xl font-black text-white mb-3">Activate Your Wallet First</h2>
          <p className="text-white/70 text-sm mb-6 leading-relaxed">
            You need an active SwiftWallet to access the Scholarship Portal. Fund your wallet with at least $5 to unlock all platform features including scholarships.
          </p>
          <div className="flex flex-col gap-3">
            <Button onClick={() => setLocation("/dashboard?section=fintech")}
              className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-2xl h-12">
              <Wallet className="w-4 h-4 mr-2" /> Fund My Wallet
            </Button>
            <Button variant="ghost" onClick={() => setLocation("/dashboard")}
              className="w-full text-white/60 hover:text-white hover:bg-white/10 rounded-2xl h-10">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── TEST SCREEN (full immersive) ──────────────────────────────────────────
  if (step === "test") {
    if (testPhase === "transition") {
      return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-teal-900 to-slate-900 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center text-white">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: "spring" }}
              className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-12 h-12 text-emerald-400" />
            </motion.div>
            <h2 className="text-3xl font-black mb-2">Verbal Section Complete!</h2>
            <p className="text-emerald-300 text-lg mb-1">You scored <span className="font-bold text-white">{liveScore.verbal}/15</span></p>
            <p className="text-white/60 text-sm mt-4">Get ready for Quantitative Reasoning…</p>
            <div className="flex gap-1.5 justify-center mt-6">
              {[0,1,2].map(i => (
                <motion.div key={i} className="w-2 h-2 rounded-full bg-emerald-400"
                  animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.4 }} />
              ))}
            </div>
          </motion.div>
        </div>
      );
    }

    if (testPhase === "submitting") {
      return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center text-white">
            <Loader2 className="w-14 h-14 animate-spin text-indigo-400 mx-auto mb-5" />
            <h2 className="text-2xl font-bold mb-2">Submitting your answers…</h2>
            <p className="text-indigo-300">Calculating your score, please wait.</p>
          </motion.div>
        </div>
      );
    }

    const isVerbal = testPhase === "verbal";
    const bgGradient = isVerbal
      ? "from-indigo-950 via-purple-950 to-slate-950"
      : "from-orange-950 via-amber-950 to-slate-950";
    const accentColor = isVerbal ? "#818cf8" : "#fb923c";
    const sectionLabel = isVerbal ? "Verbal Reasoning" : "Quantitative Reasoning";
    const sectionIcon = isVerbal ? <BookOpen className="w-4 h-4" /> : <Calculator className="w-4 h-4" />;

    return (
      <div className={`min-h-screen bg-gradient-to-br ${bgGradient} flex flex-col`}>
        {/* Header bar */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2 text-white/80 text-sm">
            {sectionIcon}
            <span className="font-semibold">{sectionLabel}</span>
            <span className="text-white/40 mx-1">•</span>
            <span className="text-white/60">Q{currentIdx + 1}/15</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Phase score */}
            <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/10 text-white text-sm font-bold">
              <Star className="w-3 h-3 text-amber-400" />
              <span>{phaseScore}</span>
              <span className="text-white/40">/15</span>
            </div>
            {/* Total running score (show verbal total once in quant section) */}
            {testPhase === "quant" && (
              <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 text-sm font-bold border border-emerald-500/30">
                <span>Total</span>
                <span className="text-white font-black">{liveScore.verbal + liveScore.quant}</span>
                <span className="text-white/40">/30</span>
              </div>
            )}
            <SectionTimer seconds={sectionTimer} />
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-white/10">
          <motion.div
            className="h-full"
            style={{ background: accentColor }}
            animate={{ width: `${((currentIdx) / 15) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Question area */}
        <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-2xl">
            <AnimatePresence mode="wait">
              {currentQ && (
                <motion.div key={currentIdx}
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -40 }}
                  transition={{ duration: 0.25 }}
                >
                  {/* Timer ring + question */}
                  <div className="flex items-start gap-4 mb-6">
                    <TimerRing seconds={questionTimer} max={15} size={72} color={accentColor} />
                    <div className="flex-1">
                      <p className="text-white/50 text-xs mb-1.5">Question {currentIdx + 1} of 15</p>
                      <p className="text-white text-lg sm:text-xl font-semibold leading-relaxed">{currentQ.text}</p>
                    </div>
                  </div>

                  {/* Options */}
                  <div className="grid gap-3">
                    {currentQ.options.map((opt, i) => {
                      const letter = ["A", "B", "C", "D"][i];
                      const isFeedback = showFeedback !== null;
                      const isSelected = showFeedback?.selected === i;
                      const isCorrectAnswer = showFeedback?.correct === i;

                      let optStyle = "bg-white/8 border-white/20 hover:bg-white/15 hover:border-white/40 cursor-pointer";
                      if (isFeedback) {
                        if (isCorrectAnswer) optStyle = "bg-emerald-500/30 border-emerald-400 cursor-default";
                        else if (isSelected && !isCorrectAnswer) optStyle = "bg-red-500/30 border-red-400 cursor-default";
                        else optStyle = "bg-white/5 border-white/10 cursor-default opacity-50";
                      }

                      return (
                        <motion.button key={i}
                          whileHover={!isFeedback ? { scale: 1.01 } : {}}
                          whileTap={!isFeedback ? { scale: 0.99 } : {}}
                          onClick={() => !isFeedback && advanceQuestion(i, currentPhaseQs, currentIdx, testPhase)}
                          className={`w-full flex items-center gap-4 p-4 rounded-2xl border text-left text-white transition-all ${optStyle}`}
                        >
                          <span className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm shrink-0"
                            style={{ background: isFeedback ? "transparent" : `${accentColor}30`, color: isFeedback && isCorrectAnswer ? "#4ade80" : isFeedback && isSelected ? "#f87171" : accentColor }}>
                            {letter}
                          </span>
                          <span className="text-sm sm:text-base">{opt}</span>
                          {isFeedback && isCorrectAnswer && <CheckCircle2 className="w-5 h-5 text-emerald-400 ml-auto shrink-0" />}
                          {isFeedback && isSelected && !isCorrectAnswer && <XCircle className="w-5 h-5 text-red-400 ml-auto shrink-0" />}
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  }

  // ── RESULT SCREEN ──────────────────────────────────────────────────────────
  if (step === "result" && result) {
    const aggPct = Math.round(result.aggregateScore);
    const waecPct = Math.round(result.waecScore);
    const testPct = Math.round(result.testScore);
    const typeName = scholarshipType === "masters" ? "Masters" : "Student";
    const prizeAmt = scholarshipType === "masters" ? 250 : 100;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 200 }}>
            {/* Result hero */}
            <div className={`rounded-3xl p-8 text-center mb-5 border ${result.passed ? "bg-gradient-to-br from-emerald-900/80 to-teal-900/80 border-emerald-700/50" : "bg-gradient-to-br from-slate-900/80 to-red-950/50 border-red-800/30"}`}>
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: "spring", stiffness: 260 }}
                className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 ${result.passed ? "bg-emerald-500/20" : "bg-red-500/10"}`}>
                {result.passed ? <Trophy className="w-10 h-10 text-amber-400" /> : <XCircle className="w-10 h-10 text-red-400" />}
              </motion.div>

              <h1 className="text-2xl font-black text-white mb-2">
                {result.passed ? "Congratulations!" : "Test Completed"}
              </h1>
              <p className={`text-sm mb-6 ${result.passed ? "text-emerald-300" : "text-red-300"}`}>
                {result.passed
                  ? `You passed the ${typeName} Scholarship!`
                  : `Your aggregate score is below the 70% pass mark.`}
              </p>

              {/* Aggregate score — hero number */}
              <div className={`rounded-2xl p-4 mb-5 ${result.passed ? "bg-emerald-500/15 border border-emerald-500/30" : "bg-red-500/10 border border-red-500/20"}`}>
                <p className="text-white/50 text-xs uppercase tracking-widest mb-1">Aggregate Score</p>
                <p className={`text-5xl font-black ${result.passed ? "text-emerald-300" : "text-red-400"}`}>{aggPct}%</p>
                <p className="text-white/40 text-xs mt-1">(WAEC {waecPct}% + Test {testPct}%) ÷ 2</p>
              </div>

              {/* Score breakdown grid */}
              <div className="grid grid-cols-4 gap-2 mb-5">
                {[
                  { label: "WAEC", value: `${waecPct}%`, color: "text-sky-400" },
                  { label: "Verbal", value: `${result.verbalScore}/15`, color: "text-indigo-400" },
                  { label: "Quant", value: `${result.quantScore}/15`, color: "text-orange-400" },
                  { label: "Test", value: `${testPct}%`, color: "text-purple-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-white/5 rounded-xl p-2.5">
                    <p className={`text-base font-black ${color}`}>{value}</p>
                    <p className="text-white/40 text-[10px] mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* Aggregate bar */}
              <div className="bg-white/10 rounded-full h-2.5 mb-2">
                <motion.div className={`h-full rounded-full ${result.passed ? "bg-emerald-400" : "bg-red-400"}`}
                  initial={{ width: 0 }} animate={{ width: `${Math.min(aggPct, 100)}%` }} transition={{ duration: 1, delay: 0.5 }} />
              </div>
              <p className="text-white/60 text-xs">{aggPct}% aggregate — Pass mark: 70%</p>
            </div>

            {/* Prize info */}
            {result.passed && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
                className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 mb-4 text-center">
                <Trophy className="w-7 h-7 text-amber-400 mx-auto mb-2" />
                <p className="text-amber-300 font-bold text-lg">${prizeAmt}.00 Prize Awarded</p>
                <p className="text-amber-200/70 text-xs mt-1">Your prize is pending admin approval. You will receive an in-app notification once your wallet has been credited.</p>
              </motion.div>
            )}

            {/* Year-2 MSc renewal section */}
            {result.passed && scholarshipRecord?.mscDuration === "2year" && (() => {
              const renewalPaid = !!scholarshipRecord?.renewalPaid;
              const testDate = scholarshipRecord?.testCompletedAt ? new Date(scholarshipRecord.testCompletedAt) : null;
              const daysElapsed = testDate ? (Date.now() - testDate.getTime()) / (1000 * 60 * 60 * 24) : 0;
              const daysLeft = Math.max(0, Math.ceil(365 - daysElapsed));
              const renewalReady = daysElapsed >= 365;

              return (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
                  className={`rounded-2xl p-5 mb-4 border ${renewalPaid ? "bg-emerald-500/10 border-emerald-500/30" : renewalReady ? "bg-indigo-500/10 border-indigo-500/30" : "bg-white/5 border-white/10"}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <GraduationCap className={`w-5 h-5 ${renewalPaid ? "text-emerald-400" : renewalReady ? "text-indigo-400" : "text-white/40"}`} />
                    <p className={`font-bold text-sm ${renewalPaid ? "text-emerald-300" : renewalReady ? "text-indigo-300" : "text-white/60"}`}>
                      Year-2 MSc — Second $250 Prize
                    </p>
                  </div>
                  {renewalPaid ? (
                    <p className="text-emerald-200/70 text-xs">✓ Renewal paid. Your second $250 prize is pending admin approval.</p>
                  ) : renewalReady ? (
                    <>
                      <p className="text-indigo-200/70 text-xs mb-3">Your 1 year has elapsed! Pay $25 to renew and claim your second $250 prize.</p>
                      <Button onClick={handlePayRenewal} disabled={loading || (walletBalance !== null && walletBalance < 25)}
                        className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Pay $25 — Claim Second $250"}
                      </Button>
                      {walletBalance !== null && walletBalance < 25 && (
                        <p className="text-red-400/70 text-xs mt-2 text-center">Insufficient balance (need $25). Fund your wallet first.</p>
                      )}
                    </>
                  ) : (
                    <p className="text-white/40 text-xs">
                      {testDate
                        ? `Renewal available in ${daysLeft} day${daysLeft !== 1 ? "s" : ""} (1 year from your test date).`
                        : "Renewal will be available 1 year after your test date."}
                    </p>
                  )}
                </motion.div>
              );
            })()}

            <Button onClick={() => setLocation("/dashboard")} className="w-full h-12 rounded-2xl bg-white/10 text-white hover:bg-white/20 border border-white/20 font-semibold">
              Return to Dashboard
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }

  // ── COOLDOWN SCREEN ───────────────────────────────────────────────────────
  if (step === "cooldown") {
    const typeName = scholarshipType === "masters" ? "Masters" : "Student";
    const testDoneDate = scholarshipRecord?.testCompletedAt ? new Date(scholarshipRecord.testCompletedAt) : null;
    const reopenDate = testDoneDate ? new Date(testDoneDate.getTime() + 365 * 86400000) : null;
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 180 }} className="w-full max-w-md">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center">
            <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
              <Clock className="w-10 h-10 text-amber-400" />
            </div>
            <h2 className="text-2xl font-black text-white mb-2">Re-Enrollment Locked</h2>
            <p className="text-white/60 text-sm mb-6">
              You already took the {typeName} Scholarship CBT. A <span className="text-amber-300 font-semibold">365-day window</span> applies between attempts.
            </p>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 mb-6">
              <p className="text-amber-300 text-4xl font-black mb-1">{cooldownDaysLeft}</p>
              <p className="text-amber-400/80 text-sm font-semibold">day{cooldownDaysLeft !== 1 ? "s" : ""} remaining</p>
              {reopenDate && (
                <p className="text-white/40 text-xs mt-2">
                  Re-enrollment opens: {reopenDate.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}
                </p>
              )}
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6 text-left space-y-2">
              <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-3">Your last attempt</p>
              {scholarshipRecord?.status === "passed"
                ? <p className="text-emerald-400 text-sm font-semibold flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Passed — prize pending admin review</p>
                : <p className="text-red-400 text-sm font-semibold flex items-center gap-2"><XCircle className="w-4 h-4" /> Did not pass — keep studying!</p>
              }
              {testDoneDate && (
                <p className="text-white/40 text-xs">Completed: {testDoneDate.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}</p>
              )}
            </div>

            <button onClick={() => { setStep("welcome"); setScholarshipType(null as any); setScholarshipRecord(null); }}
              className="w-full h-12 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm transition-colors">
              ← Back to Portal
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── STEPPED FLOW (welcome → waec → pay_fee → commitment → test_intro) ────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900">
      {/* Top nav */}
      <div className="sticky top-0 z-30 px-4 py-3 border-b border-white/10 bg-slate-950/80 backdrop-blur-sm flex items-center gap-3">
        <button onClick={() => {
          if (step === "welcome") { setLocation("/dashboard"); return; }
          if (step === "tertiary") { setStep("welcome"); return; }
          if (step === "waec") { setStep(scholarshipType === "masters" && !scholarshipRecord?.tertiarySchool ? "tertiary" : "welcome"); return; }
          if (step === "pay_fee") { setStep("waec"); return; }
          setStep("welcome");
        }} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white/15 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-400" />
          <span className="text-white font-bold text-sm">TSIA Scholarship CBT</span>
        </div>
        {scholarshipType && (() => {
          const isMasters = scholarshipType === "masters";
          const dur = scholarshipRecord?.mscDuration || mscDuration;
          const prize = isMasters ? (dur === "2year" ? "$500" : "$250") : "$100";
          return (
            <Badge className={`ml-auto text-xs ${isMasters ? "bg-amber-500/20 text-amber-300 border-amber-500/30" : "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"}`}>
              {isMasters ? `Masters — ${prize}` : "Student — $100"}
            </Badge>
          );
        })()}
      </div>

      <div className="p-4 sm:p-6 max-w-xl mx-auto">
        <AnimatePresence mode="wait">

          {/* ── WELCOME ─────────────────────────────────────────────────────── */}
          {step === "welcome" && (
            <motion.div key="welcome" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div className="text-center py-10">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                  className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
                  <Trophy className="w-10 h-10 text-amber-400" />
                </motion.div>
                <h1 className="text-3xl font-black text-white mb-2">Scholarship CBT</h1>
                <p className="text-white/60 text-sm max-w-xs mx-auto">Merit-based Computer-Based Test for exceptional students. Pass the CBT, win your prize.</p>
              </div>

              <div className="grid gap-4 mb-8">
                {[
                  { type: "student" as const, label: "Student Scholarship", prize: "$100", icon: GraduationCap, gradient: "from-indigo-600 to-purple-700", desc: "Open to all verified students. Sit the CBT — 30 tough A–D objective questions — and win $100." },
                  { type: "masters" as const, label: "Masters Scholarship", prize: "$250", icon: Trophy, gradient: "from-amber-500 to-orange-600", desc: "Advanced track. After paying the portal fee, you get 30 days to pay the $10–$25 unlock fee and take the CBT. Win $250–$500." },
                ].map(s => (
                  <motion.div key={s.type} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                    onClick={() => handleSelectType(s.type)}
                    className="cursor-pointer rounded-2xl overflow-hidden border border-white/10 shadow-lg">
                    <div className={`bg-gradient-to-br ${s.gradient} p-5`}>
                      <div className="flex items-center justify-between mb-2">
                        <s.icon className="w-6 h-6 text-white/80" />
                        <span className="text-3xl font-black text-white">{s.prize}</span>
                      </div>
                      <p className="text-white font-bold text-lg">{s.label}</p>
                    </div>
                    <div className="bg-white/5 p-4">
                      <p className="text-white/70 text-sm mb-3">{s.desc}</p>
                      <div className="flex items-center gap-1.5 text-xs text-white/50">
                        <Zap className="w-3 h-3" />
                        <span>$3.30 WAEC validation fee · 70% aggregate (WAEC + CBT ÷ 2) · One attempt per 365 days</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
                <p className="text-amber-300 font-semibold text-sm mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Before you apply
                </p>
                <ul className="text-amber-200/70 text-xs space-y-1.5 list-disc list-inside">
                  <li>Any WAEC score is accepted — the 70% threshold applies to your aggregate (WAEC + CBT ÷ 2)</li>
                  <li>A $3.30 validation fee will be deducted from your SwiftWallet</li>
                  <li>30 tough 4-option (A–D) objective questions: 15 Verbal + 15 Quantitative, 30 seconds each</li>
                  <li>One attempt per 365 days — re-enrollment opens one year after your last test</li>
                </ul>
              </div>
            </motion.div>
          )}

          {/* ── TERTIARY DETAILS (Masters only) ─────────────────────────── */}
          {step === "tertiary" && (
            <motion.div key="tertiary" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
              <div className="mt-4 mb-6 text-center">
                <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <GraduationCap className="w-8 h-8 text-amber-400" />
                </div>
                <h2 className="text-2xl font-black text-white">Tertiary Education Details</h2>
                <p className="text-white/60 text-sm mt-1">Tell us about your university or polytechnic education.</p>
              </div>

              <div className="space-y-4">
                {/* Institution name */}
                <div>
                  <Label className="text-white/70 text-xs mb-1.5 block">Institution Name</Label>
                  <Input value={tertiarySchool} onChange={e => setTertiarySchool(e.target.value)}
                    placeholder="e.g. University of Lagos"
                    className="bg-white/8 border-white/20 text-white placeholder:text-white/30 rounded-xl h-11" />
                </div>

                {/* Certificate type */}
                <div>
                  <Label className="text-white/70 text-xs mb-1.5 block">Certificate Type</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {(["university", "polytechnic"] as const).map(t => (
                      <button key={t} onClick={() => setTertiaryType(t)}
                        className={`h-11 rounded-xl font-semibold text-sm border transition-all capitalize ${tertiaryType === t ? "bg-amber-500/20 border-amber-500/50 text-amber-300" : "bg-white/5 border-white/20 text-white/70 hover:bg-white/10"}`}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Graduation year */}
                <div>
                  <Label className="text-white/70 text-xs mb-1.5 block">Year of Graduation</Label>
                  <Select value={tertiaryYear} onValueChange={setTertiaryYear}>
                    <SelectTrigger className="bg-white/8 border-white/20 text-white rounded-xl h-11">
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56 overflow-y-auto">
                      {TERTIARY_YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Degree classification */}
                <div>
                  <Label className="text-white/70 text-xs mb-1.5 block">Degree Classification</Label>
                  <div className="space-y-2">
                    {TERTIARY_GRADES.map(g => (
                      <button key={g.value} onClick={() => setTertiaryGrade(g.value)}
                        className={`w-full h-11 rounded-xl font-semibold text-sm border text-left px-4 transition-all ${tertiaryGrade === g.value ? "bg-amber-500/20 border-amber-500/50 text-amber-300" : "bg-white/5 border-white/20 text-white/70 hover:bg-white/10"}`}>
                        {g.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-white/40 text-xs mt-2">* Third Class and Pass are not eligible for the Masters Scholarship.</p>
                </div>
              </div>

              <Button onClick={handleTertiaryNext} className="w-full h-12 mt-6 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold">
                <span>Continue to WAEC Details</span><ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </motion.div>
          )}

          {/* ── WAEC FORM ──────────────────────────────────────────────────── */}
          {step === "waec" && (
            <motion.div key="waec" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
              <h2 className="text-2xl font-black text-white mb-1 mt-4">WAEC Verification</h2>
              <p className="text-white/60 text-sm mb-4">Enter your WAEC results. All scores are accepted — your final eligibility is determined by the <strong className="text-white">aggregate of your WAEC + Test score ÷ 2</strong>.</p>

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3.5 mb-5 flex gap-3 items-start">
                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-amber-300 text-xs">A fee of <strong>$3.30</strong> ($3.00 validation + $0.30 service charge) will be deducted from your SwiftWallet on the next step to confirm your WAEC results.</p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-white/70 text-xs mb-1.5 block">WAEC Reg Number</Label>
                    <Input value={waecReg} onChange={e => setWaecReg(e.target.value)} placeholder="e.g. 4NN/12345/678"
                      className="bg-white/8 border-white/20 text-white placeholder:text-white/30 rounded-xl h-11" />
                  </div>
                  <div>
                    <Label className="text-white/70 text-xs mb-1.5 block">WAEC Year</Label>
                    <Select value={waecYear} onValueChange={setWaecYear}>
                      <SelectTrigger className="bg-white/8 border-white/20 text-white rounded-xl h-11">
                        <SelectValue placeholder="Year" />
                      </SelectTrigger>
                      <SelectContent className="max-h-56 overflow-y-auto">
                        {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-white/70 text-xs mb-1.5 block">School Name</Label>
                    <Input value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder="e.g. Government College"
                      className="bg-white/8 border-white/20 text-white placeholder:text-white/30 rounded-xl h-11" />
                  </div>
                  <div>
                    <Label className="text-white/70 text-xs mb-1.5 block">School Location</Label>
                    <Input value={schoolLocation} onChange={e => setSchoolLocation(e.target.value)} placeholder="e.g. Lagos"
                      className="bg-white/8 border-white/20 text-white placeholder:text-white/30 rounded-xl h-11" />
                  </div>
                </div>

                <div>
                  <Label className="text-white/70 text-xs mb-2 block">Subjects & Grades (5 required)</Label>
                  <div className="space-y-2">
                    {[0, 1, 2, 3, 4].map(i => {
                      const used = subjects.filter((_, j) => j !== i && j >= 2);
                      const avail = SUBJECTS_ELECTIVE.filter(s => !used.includes(s));
                      return (
                        <SubjectRow key={i} index={i} subject={subjects[i]} grade={grades[i]} electives={avail}
                          onSubjectChange={v => setSubjects(prev => { const n = [...prev]; n[i] = v; return n; })}
                          onGradeChange={v => setGrades(prev => { const n = [...prev]; n[i] = v; return n; })} />
                      );
                    })}
                  </div>
                </div>
              </div>

              <Button onClick={handleWaecSubmit} disabled={loading} className="w-full h-12 mt-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>Validate WAEC Results</span><ArrowRight className="w-4 h-4 ml-2" /></>}
              </Button>
            </motion.div>
          )}

          {/* ── PAY FEE ────────────────────────────────────────────────────── */}
          {step === "pay_fee" && (
            <motion.div key="pay_fee" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
              <div className="mt-4 mb-6 text-center">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-black text-white">WAEC Results Verified</h2>
                <p className="text-white/60 text-sm mt-1">Your score qualifies you for the scholarship. Pay the validation fee to proceed.</p>
              </div>

              {scholarshipRecord && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-5">
                  <p className="text-white/60 text-xs mb-3">WAEC Summary</p>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white text-sm">{scholarshipRecord.waecRegNumber}</span>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">{scholarshipRecord.waecYear}</Badge>
                  </div>
                  <div className="text-2xl font-black text-emerald-400 mt-2">
                    {parseFloat(scholarshipRecord.waecPercentage ?? "0").toFixed(1)}%
                  </div>
                  <p className="text-white/40 text-xs">WAEC Score</p>
                </div>
              )}

              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-5 space-y-2">
                <div className="flex justify-between text-sm text-white/70"><span>Validation Fee</span><span>$3.00</span></div>
                <div className="flex justify-between text-sm text-white/70"><span>Service Charge</span><span>$0.30</span></div>
                <div className="border-t border-white/10 pt-2 flex justify-between font-bold text-white"><span>Total</span><span>$3.30</span></div>
              </div>

              <div className="flex items-center gap-2 mb-5 px-1">
                <Wallet className="w-4 h-4 text-white/50" />
                <span className="text-white/60 text-sm">Your balance: <strong className="text-white">${(walletBalance ?? 0).toFixed(2)}</strong></span>
              </div>

              <Button onClick={handlePayFee} disabled={loading}
                className="w-full h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Pay $3.30 & Continue"}
              </Button>
            </motion.div>
          )}

          {/* ── COMMITMENT (Masters only) ────────────────────────────────── */}
          {step === "commitment" && (
            <motion.div key="commitment" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
              <div className="mt-4 mb-6 text-center">
                <div className={`w-16 h-16 ${windowExpired ? "bg-red-500/20" : "bg-amber-500/20"} rounded-full flex items-center justify-center mx-auto mb-4`}>
                  <Clock className={`w-8 h-8 ${windowExpired ? "text-red-400" : "text-amber-400"}`} />
                </div>
                <h2 className="text-2xl font-black text-white">30-Day Commitment Window</h2>
                <p className="text-white/60 text-sm mt-1 max-w-xs mx-auto">
                  {windowExpired
                    ? "Your 30-day payment window has passed. Your enrollment has been reset — you can start a fresh application."
                    : "You have 30 days to choose your MSc programme and pay the unlock fee. You may pay at any time before the deadline."}
                </p>
              </div>

              {windowExpired ? (
                /* ── Expired ─────────────────────────────────────────────── */
                <div className="space-y-4">
                  <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 text-center">
                    <XCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
                    <p className="text-red-300 font-bold text-lg">Window Expired</p>
                    <p className="text-red-300/70 text-sm mt-1">Your 30-day commitment window elapsed without payment. Your previous enrollment has been cleared.</p>
                  </div>
                  <Button onClick={() => { setScholarshipRecord(null); setStep("welcome"); }}
                    className="w-full h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                    Start Fresh Application
                  </Button>
                </div>
              ) : (
                /* ── Active window — pay anytime ────────────────────────── */
                <div className="space-y-5">
                  {/* Countdown */}
                  <div className="bg-gradient-to-br from-amber-900/40 to-orange-900/30 border border-amber-700/40 rounded-3xl p-6 text-center">
                    <motion.div className="text-7xl font-black text-amber-300 mb-1"
                      animate={{ scale: [1, 1.04, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                      {daysLeft}
                    </motion.div>
                    <p className="text-amber-400 font-bold text-lg">{daysLeft === 1 ? "day" : "days"} remaining</p>
                    <p className="text-amber-300/60 text-xs mt-1.5">
                      {scholarshipRecord?.commitmentStartDate
                        ? `Deadline: ${new Date(new Date(scholarshipRecord.commitmentStartDate).getTime() + 30 * 86400000).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
                        : "Commitment window active"}
                    </p>
                  </div>

                  {/* MSc duration selector */}
                  <p className="text-white/60 text-sm font-semibold px-1">Select your MSc Programme</p>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { dur: "1year" as MscDuration, label: "1-Year MSc", fee: "$10", prize: "$250", desc: "Unlock test for $10. Win $250 on passing." },
                      { dur: "2year" as MscDuration, label: "2-Year MSc", fee: "$25", prize: "$500", desc: "Unlock for $25. Win $250 now + $250 after 1 year (renew $25)." },
                    ]).map(({ dur, label, fee, prize, desc }) => (
                      <button key={dur} onClick={() => setMscDuration(dur)}
                        className={`rounded-2xl p-4 border text-left transition-all ${mscDuration === dur ? "bg-amber-500/20 border-amber-500/50" : "bg-white/5 border-white/20 hover:bg-white/10"}`}>
                        <p className={`font-black text-lg ${mscDuration === dur ? "text-amber-300" : "text-white"}`}>{prize}</p>
                        <p className={`font-bold text-sm ${mscDuration === dur ? "text-amber-400" : "text-white/80"}`}>{label}</p>
                        <p className="text-white/50 text-xs mt-1">{fee} unlock fee</p>
                        <p className="text-white/40 text-[10px] mt-0.5 leading-tight">{desc}</p>
                      </button>
                    ))}
                  </div>

                  {mscDuration && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
                      <div className="flex justify-between text-sm text-white/70"><span>MSc Unlock Fee ({mscDuration === "2year" ? "2-Year" : "1-Year"})</span><span>${mscDuration === "2year" ? "25.00" : "10.00"}</span></div>
                      <div className="flex items-center gap-2 pt-1">
                        <Wallet className="w-4 h-4 text-white/50" />
                        <span className="text-white/60 text-sm">Your balance: <strong className="text-white">${(walletBalance ?? 0).toFixed(2)}</strong></span>
                      </div>
                    </div>
                  )}

                  <Button onClick={handlePayCommitment}
                    disabled={loading || !mscDuration || (walletBalance !== null && walletBalance < (mscDuration === "2year" ? 25 : 10))}
                    className="w-full h-12 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : mscDuration ? `Pay $${mscDuration === "2year" ? "25.00" : "10.00"} & Begin Application` : "Select a programme above"}
                  </Button>

                  <Button onClick={() => setLocation("/dashboard")} variant="ghost" className="w-full text-white/50 hover:text-white text-sm">
                    Return to Dashboard — pay later
                  </Button>
                </div>
              )}
            </motion.div>
          )}

          {/* ── TEST INTRO ──────────────────────────────────────────────────── */}
          {step === "test_intro" && (
            <motion.div key="test_intro" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
              <div className="mt-4 mb-6 text-center">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.1 }}
                  className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
                  <Zap className="w-10 h-10 text-indigo-400" />
                </motion.div>
                <h2 className="text-2xl font-black text-white mb-1">Scholarship CBT</h2>
                <p className="text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-2">Computer-Based Test</p>
                <p className="text-white/60 text-sm">Read every rule below. This is your <span className="text-amber-300 font-semibold">one shot</span> — once started, you cannot pause or restart.</p>
              </div>

              {/* Sections */}
              <div className="space-y-3 mb-5">
                {[
                  { icon: BookOpen, label: "Section 1 — Verbal Reasoning", desc: "15 objective questions (A – D) on analogies, critical reasoning, vocabulary, comprehension, and grammar.", color: "text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/20" },
                  { icon: Calculator, label: "Section 2 — Quantitative Reasoning", desc: "15 objective questions (A – D) on arithmetic, algebra, percentages, ratios, number series, and data interpretation.", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
                ].map(({ icon: Icon, label, desc, color, bg }) => (
                  <div key={label} className={`${bg} border rounded-2xl p-4 flex gap-3 items-start`}>
                    <Icon className={`w-5 h-5 ${color} mt-0.5 shrink-0`} />
                    <div>
                      <p className="text-white font-semibold text-sm">{label}</p>
                      <p className="text-white/60 text-xs mt-1 leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Format badge */}
              <div className="flex items-center gap-2 mb-5 bg-white/5 border border-white/10 rounded-2xl p-3">
                <div className="flex gap-1.5">
                  {["A", "B", "C", "D"].map(l => (
                    <span key={l} className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-black text-xs">{l}</span>
                  ))}
                </div>
                <p className="text-white/60 text-xs ml-1">All questions are <span className="text-white font-semibold">4-option multiple choice</span> — pick the single best answer.</p>
              </div>

              {/* Rules */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6 space-y-2.5">
                {[
                  ["⏱️", "30 seconds per question — answer or it auto-skips"],
                  ["⏰", "15 minutes per section — both section timers run live"],
                  ["📊", "Your running score updates in real time as you answer"],
                  ["🚫", "No going back — each question auto-advances after selection"],
                  ["✅", "Pass mark: 70% aggregate (WAEC % + Test %) ÷ 2"],
                  ["🔒", "One attempt per 365 days — make it count"],
                ].map(([emoji, text]) => (
                  <div key={text} className="flex items-start gap-2.5 text-sm text-white/70">
                    <span className="text-base shrink-0">{emoji}</span>
                    <span>{text}</span>
                  </div>
                ))}
              </div>

              <Button onClick={handleStartTest} disabled={loading}
                className="w-full h-14 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-lg shadow-lg shadow-indigo-900/40">
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Start Scholarship CBT →"}
              </Button>
              <p className="text-white/40 text-xs text-center mt-3">Once started, the timer cannot be paused or stopped</p>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
