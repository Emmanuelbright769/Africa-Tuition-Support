import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowRight, BookOpenCheck, CheckCircle2, ChevronLeft, Clock3, Coins, FileUp, GraduationCap, Pencil, Plus, ShieldCheck, Sparkles, Target, Trophy, WalletCards } from "lucide-react";

type Child = {
  id: number | string;
  fullName: string;
  dateOfBirth: string;
  schoolName?: string;
  gradeLevel?: string;
  certificateStatus?: "pending" | "approved" | "declined";
  certificateReviewReason?: string | null;
  vest?: { balance?: number; targetAmount?: number; cbtUnlockedAt?: string | null; qualifiedAt?: string | null; status?: string };
  attempt?: { status?: string; percentage?: number };
  award?: { awardAmount?: number; status?: string };
};
type Question = { id: string; prompt: string; choices: string[] };
type CbtSession = { attemptId: string | number; startedAt: string; durationMinutes: number; questions: Question[] };
type DialogMode = "create" | "edit" | "contribute" | "withdraw" | null;

const money = (value: unknown) => `$${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const normalize = (body: any) => body?.data ?? body;

function awardBand(percentage: number) {
  if (percentage >= 70) return { label: "$100 grant recommended", tone: "text-emerald-700 bg-emerald-50 border-emerald-200" };
  if (percentage >= 65) return { label: "$50 grant recommended", tone: "text-amber-700 bg-amber-50 border-amber-200" };
  if (percentage >= 50) return { label: "$30 grant recommended", tone: "text-sky-700 bg-sky-50 border-sky-200" };
  return { label: "Practice result", tone: "text-slate-600 bg-slate-50 border-slate-200" };
}

export default function BackToSchoolSection() {
  const { toast } = useToast();
  const [activeChild, setActiveChild] = useState<Child | null>(null);
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [form, setForm] = useState({ fullName: "", dateOfBirth: "", schoolName: "", gradeLevel: "" });
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [amount, setAmount] = useState("");
  const [walletRequestKey, setWalletRequestKey] = useState("");
  const [session, setSession] = useState<CbtSession | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [result, setResult] = useState<any>(null);
  const cheatCountRef = useRef(0);
  const autoSubmitRef = useRef(false);
  const lastFocusLossRef = useRef(0);

  const childrenQuery = useQuery<any>({ queryKey: ["/api/back-to-school"] });
  const payload = normalize(childrenQuery.data);
  const children = useMemo<Child[]>(() => Array.isArray(payload) ? payload : (payload?.children || []), [payload]);
  const rules = payload?.rules ?? { depositFeeRate: 0.05, withdrawalFeeRate: 0.075 };
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/back-to-school"] });

  const saveChild = useMutation({
    mutationFn: async (childPayload: any) => {
      const path = dialog === "edit" ? `/api/back-to-school/children/${activeChild?.id}` : "/api/back-to-school/children";
      return apiRequest(dialog === "edit" ? "PATCH" : "POST", path, childPayload);
    },
    onSuccess: () => {
      toast({ title: dialog === "edit" ? "Kiddies account updated" : "Kiddies account created", description: "The birth certificate is now awaiting staff verification." });
      setDialog(null); setCertificateFile(null); refresh();
    },
    onError: (error: any) => toast({ title: "Could not save kiddies account", description: error.message, variant: "destructive" }),
  });
  const contribute = useMutation({
    mutationFn: () => apiRequest("POST", `/api/back-to-school/children/${activeChild?.id}/contributions`, { amount: Number(amount) }, { "Idempotency-Key": walletRequestKey }),
    onSuccess: (response: any) => {
      toast({ title: "Deposit completed", description: `The child wallet was credited and the 5% fee was recorded.` });
      setAmount(""); setDialog(null); refresh(); return response;
    },
    onError: (error: any) => toast({ title: "Deposit was not completed", description: error.message, variant: "destructive" }),
  });
  const withdraw = useMutation({
    mutationFn: () => apiRequest("POST", `/api/back-to-school/children/${activeChild?.id}/withdrawals`, { amount: Number(amount) }, { "Idempotency-Key": walletRequestKey }),
    onSuccess: () => {
      toast({ title: "Withdrawal completed", description: "The net amount has been returned to the guardian SwiftWallet." });
      setAmount(""); setDialog(null); refresh();
    },
    onError: (error: any) => toast({ title: "Withdrawal was not completed", description: error.message, variant: "destructive" }),
  });
  const startCbt = useMutation({
    mutationFn: async (childId: number | string) => normalize(await (await apiRequest("POST", `/api/back-to-school/children/${childId}/cbt/start`)).json()),
    onSuccess: (data: CbtSession) => {
      const sessionEndsAt = new Date(data.startedAt).getTime() + Number(data.durationMinutes || 15) * 60_000;
      cheatCountRef.current = 0; autoSubmitRef.current = false;
      setSession(data); setAnswers({}); setQuestionIndex(0); setResult(null);
      setSecondsLeft(Math.max(0, Math.floor((sessionEndsAt - Date.now()) / 1000)));
    },
    onError: (error: any) => toast({ title: "Could not start assessment", description: error.message, variant: "destructive" }),
  });
  const submitCbt = useMutation({
    mutationFn: async () => normalize(await (await apiRequest("POST", `/api/back-to-school/children/${activeChild?.id}/cbt/submit`, { answers })).json()),
    onSuccess: (data: any) => { setResult(data); setSession(null); refresh(); },
    onError: (error: any) => toast({ title: "Assessment could not be submitted", description: error.message, variant: "destructive" }),
  });

  useEffect(() => {
    if (!session || result) return;
    if (secondsLeft <= 0) { submitCbt.mutate(); return; }
    const timer = window.setInterval(() => setSecondsLeft(current => current - 1), 1000);
    return () => window.clearInterval(timer);
  }, [session, secondsLeft, result]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!session || !activeChild || result) return;
    const report = async (eventType: string, description: string) => {
      cheatCountRef.current += 1;
      const count = cheatCountRef.current;
      apiRequest("POST", `/api/back-to-school/children/${activeChild.id}/cbt/report-cheat`, { eventType, description })
        .then(async (response) => {
          const body = normalize(await response.json());
          if (body?.terminalResult && !autoSubmitRef.current) {
            autoSubmitRef.current = true;
            toast({ title: "Assessment auto-submitted", description: "Detected test-integrity activity has ended this attempt.", variant: "destructive" });
            setResult(body.terminalResult); setSession(null); refresh();
          } else if ((body?.shouldAutoSubmit || count >= 5 || ["copy_attempt", "paste_attempt", "cut_attempt"].includes(eventType)) && !autoSubmitRef.current) {
            autoSubmitRef.current = true;
            toast({ title: "Assessment auto-submitted", description: "Detected test-integrity activity has ended this attempt.", variant: "destructive" });
            submitCbt.mutate();
          }
        }).catch(() => {});
      if (count === 1) toast({ title: "Warning", description: "Suspicious activity was recorded. Please remain in the assessment.", variant: "destructive" });
      if (count === 3) toast({ title: "Final warning", description: "Further suspicious activity will submit the assessment.", variant: "destructive" });
    };
    const focusLoss = (type: string, description: string) => {
      const now = Date.now();
      if (now - lastFocusLossRef.current < 1500) return;
      lastFocusLossRef.current = now; report(type, description);
    };
    const block = (type: string, description: string) => (event: Event) => { event.preventDefault(); report(type, description); };
    const keydown = (event: KeyboardEvent) => {
      const modifier = event.ctrlKey || event.metaKey;
      const suspicious = (modifier && ["c", "v", "a", "f", "u", "s", "p"].includes(event.key.toLowerCase())) || event.key === "F12" || event.key === "PrintScreen";
      if (suspicious) { event.preventDefault(); report("keyboard_shortcut", `Suspicious keyboard shortcut: ${event.key}`); }
    };
    const visibility = () => { if (document.hidden) focusLoss("tab_switch", "Switched tab or minimized the window"); };
    const blur = () => focusLoss("window_blur", "Browser window lost focus");
    const copy = block("copy_attempt", "Attempted to copy during the assessment");
    const cut = block("cut_attempt", "Attempted to cut during the assessment");
    const paste = block("paste_attempt", "Attempted to paste during the assessment");
    const menu = block("right_click", "Attempted to open the context menu");
    document.addEventListener("visibilitychange", visibility); window.addEventListener("blur", blur);
    document.addEventListener("copy", copy); document.addEventListener("cut", cut); document.addEventListener("paste", paste);
    document.addEventListener("contextmenu", menu); document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("visibilitychange", visibility); window.removeEventListener("blur", blur);
      document.removeEventListener("copy", copy); document.removeEventListener("cut", cut); document.removeEventListener("paste", paste);
      document.removeEventListener("contextmenu", menu); document.removeEventListener("keydown", keydown);
    };
  }, [session, activeChild, result]); // eslint-disable-line react-hooks/exhaustive-deps

  const uploadCertificate = async (file: File) => {
    const upload = new FormData();
    upload.append("file", file); upload.append("category", "back_to_school_birth_certificate");
    const response = await fetch("/api/upload", { method: "POST", body: upload, credentials: "include" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Birth certificate upload failed");
    return data.id;
  };
  const openCreate = () => { setActiveChild(null); setForm({ fullName: "", dateOfBirth: "", schoolName: "", gradeLevel: "" }); setCertificateFile(null); setDialog("create"); };
  const openEdit = (child: Child) => { setActiveChild(child); setForm({ fullName: child.fullName, dateOfBirth: child.dateOfBirth?.slice(0, 10) || "", schoolName: child.schoolName || "", gradeLevel: child.gradeLevel || "" }); setCertificateFile(null); setDialog("edit"); };
  const selectCertificate = (event: ChangeEvent<HTMLInputElement>) => setCertificateFile(event.target.files?.[0] || null);
  const submitProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (dialog === "create" && !certificateFile) {
      toast({ title: "Birth certificate required", description: "Upload a birth certificate so staff can verify the child's age.", variant: "destructive" }); return;
    }
    const birthday = new Date(`${form.dateOfBirth}T00:00:00`);
    const now = new Date();
    const age = now.getFullYear() - birthday.getFullYear() - (now < new Date(now.getFullYear(), birthday.getMonth(), birthday.getDate()) ? 1 : 0);
    if (age < 5 || age > 15) { toast({ title: "Check the date of birth", description: "Back to school kiddies is for children aged 5–15.", variant: "destructive" }); return; }
    try {
      const birthCertificateUploadId = certificateFile ? await uploadCertificate(certificateFile) : undefined;
      saveChild.mutate({ ...form, schoolName: form.schoolName || undefined, gradeLevel: form.gradeLevel || undefined, birthCertificateUploadId });
    } catch (error: any) {
      toast({ title: "Could not upload birth certificate", description: error.message, variant: "destructive" });
    }
  };

  const currentQuestion = session?.questions[questionIndex];
  const selected = currentQuestion ? answers[currentQuestion.id] : undefined;
  const formatTime = `${Math.floor(secondsLeft / 60).toString().padStart(2, "0")}:${(secondsLeft % 60).toString().padStart(2, "0")}`;
  const requested = Number(amount || 0);
  const depositFee = requested * Number(rules.depositFeeRate ?? 0.05);
  const withdrawalFee = requested * Number(rules.withdrawalFeeRate ?? 0.075);

  if (session && currentQuestion) {
    return <section className="min-h-[620px] rounded-[2rem] bg-[#f6f1e8] p-4 text-[#203a4b] sm:p-8" data-testid="back-to-school-cbt">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between">
          <button className="flex items-center gap-2 text-sm font-semibold text-[#5e7280] hover:text-[#203a4b]" onClick={() => setSession(null)}><ChevronLeft className="h-4 w-4" /> Leave assessment</button>
          <div className="flex items-center gap-2 rounded-full border border-[#d6cbb9] bg-[#fffaf0] px-4 py-2 font-mono text-sm font-semibold"><Clock3 className="h-4 w-4 text-[#cb7d51]" /> {formatTime}</div>
        </div>
        <div className="mb-8"><div className="mb-3 flex justify-between text-xs font-semibold uppercase tracking-[0.15em] text-[#758795]"><span>Spelling bee</span><span>{questionIndex + 1} of {session.questions.length}</span></div><div className="h-2 overflow-hidden rounded-full bg-[#ded5c7]"><div className="h-full rounded-full bg-[#cb7d51]" style={{ width: `${((questionIndex + 1) / session.questions.length) * 100}%` }} /></div></div>
        <Card className="border-[#e4d8c8] bg-[#fffaf0] shadow-[0_20px_60px_rgba(75,58,38,.10)]"><CardHeader className="p-6 sm:p-10"><p className="mb-3 text-sm font-semibold text-[#cb7d51]">Question {questionIndex + 1}</p><CardTitle className="text-2xl sm:text-3xl">{currentQuestion.prompt}</CardTitle></CardHeader><CardContent className="grid gap-3 px-6 pb-8 sm:grid-cols-2 sm:px-10">{currentQuestion.choices.map((choice, index) => <button key={`${choice}-${index}`} onClick={() => setAnswers({ ...answers, [currentQuestion.id]: String(index) })} className={`rounded-2xl border p-4 text-left text-sm font-medium ${selected === String(index) ? "border-[#cb7d51] bg-[#f5dfd2] text-[#8e4b2c]" : "border-[#ded5c7] bg-white/60 hover:border-[#cb7d51]"}`}><span className="mr-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#e9e1d5] text-xs">{String.fromCharCode(65 + index)}</span>{choice}</button>)}</CardContent></Card>
        <div className="mt-6 flex justify-end"><Button disabled={!selected || submitCbt.isPending} onClick={() => questionIndex < session.questions.length - 1 ? setQuestionIndex(questionIndex + 1) : submitCbt.mutate()} className="rounded-xl bg-[#234b5e] px-6 hover:bg-[#183b4b]">{questionIndex < session.questions.length - 1 ? "Next question" : "Finish assessment"} <ArrowRight className="ml-2 h-4 w-4" /></Button></div>
      </div>
    </section>;
  }

  return <section className="space-y-6 pb-20 text-[#203a4b] sm:pb-6" data-testid="back-to-school-section">
    <div className="relative overflow-hidden rounded-[2rem] bg-[#234b5e] px-6 py-8 text-[#fffaf0] sm:px-10 sm:py-10"><div className="absolute -right-14 -top-20 h-64 w-64 rounded-full border-[30px] border-[#dca66b]/25" /><div className="relative max-w-2xl"><div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#fffaf0]/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#f5d5a6]"><Sparkles className="h-3.5 w-3.5" /> Back to school kiddies</div><h2 className="max-w-xl text-3xl font-semibold tracking-tight sm:text-5xl">A separate school wallet for every child.</h2><p className="mt-4 max-w-xl text-sm leading-6 text-[#d9e4e6] sm:text-base">Save toward $30, then unlock the spelling bee and withdrawal choices. Deposits carry a 5% fee and withdrawals carry a 7.5% fee—always shown before you confirm.</p><Button onClick={openCreate} className="mt-7 rounded-xl bg-[#e3a36f] text-[#203a4b] hover:bg-[#efb783]"><Plus className="mr-2 h-4 w-4" /> Add a child</Button></div></div>
    <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-[#dbe6e4] bg-[#eef5f1] p-4"><WalletCards className="mb-3 h-5 w-5 text-[#3e8065]" /><p className="text-sm font-semibold">Save with purpose</p><p className="mt-1 text-xs leading-5 text-[#607875]">Credit each child wallet up to $30.</p></div><div className="rounded-2xl border border-[#eadfcf] bg-[#fff7e9] p-4"><ShieldCheck className="mb-3 h-5 w-5 text-[#cb7d51]" /><p className="text-sm font-semibold">Verify age first</p><p className="mt-1 text-xs leading-5 text-[#806f5e]">Staff review the uploaded birth certificate.</p></div><div className="rounded-2xl border border-[#d9e0e9] bg-[#f0f4f8] p-4"><BookOpenCheck className="mb-3 h-5 w-5 text-[#55728b]" /><p className="text-sm font-semibold">Spell and see results</p><p className="mt-1 text-xs leading-5 text-[#627284]">25 unique questions in 15 minutes.</p></div></div>
    {childrenQuery.isLoading ? <div className="h-56 animate-pulse rounded-2xl bg-[#e8ece9]" /> : children.length === 0 ? <Card className="border-dashed border-[#c9d8d2] bg-[#f7fbf8]"><CardContent className="flex flex-col items-center p-10 text-center"><GraduationCap className="mb-4 h-10 w-10 text-[#6d9b87]" /><CardTitle className="text-xl">Start with one child</CardTitle><p className="mt-2 max-w-sm text-sm text-muted-foreground">Create a verified kiddies account and begin saving toward the $30 milestone.</p><Button onClick={openCreate} className="mt-5 rounded-xl bg-[#234b5e] hover:bg-[#183b4b]"><Plus className="mr-2 h-4 w-4" /> Add child profile</Button></CardContent></Card> : <div className="grid gap-4 lg:grid-cols-2">{children.map(child => {
      const balance = Number(child.vest?.balance || 0); const target = Number(child.vest?.targetAmount || 30); const percent = Math.min(100, balance / target * 100); const unlocked = !!child.vest?.cbtUnlockedAt || !!child.vest?.qualifiedAt; const certificateApproved = child.certificateStatus === "approved"; const canWithdraw = unlocked && certificateApproved && balance > 0; const band = awardBand(Number(child.attempt?.percentage || 0));
      return <Card key={child.id} className="overflow-hidden border-[#dfe7e2] bg-[#fffdfa]"><div className="h-1.5 bg-[#dca66b]" /><CardHeader className="pb-3"><div className="flex justify-between gap-3"><div><CardTitle className="text-xl">{child.fullName}</CardTitle><CardDescription>{child.schoolName || "School not added"} {child.gradeLevel ? `· Grade ${child.gradeLevel}` : ""}</CardDescription></div><button onClick={() => openEdit(child)} aria-label={`Edit ${child.fullName}`} className="rounded-lg p-2 text-[#71878a] hover:bg-[#eef4f1]"><Pencil className="h-4 w-4" /></button></div></CardHeader><CardContent className="space-y-4"><div className="flex items-center justify-between rounded-xl border bg-slate-50 p-3"><div><p className="text-sm font-semibold">Birth certificate</p><p className="text-xs text-muted-foreground">{child.certificateStatus === "declined" ? child.certificateReviewReason || "Please upload a replacement document." : child.certificateStatus === "approved" ? "Age verified by staff." : "Awaiting staff verification."}</p></div><Badge variant="outline" className={certificateApproved ? "border-emerald-300 text-emerald-700" : child.certificateStatus === "declined" ? "border-red-300 text-red-700" : "border-amber-300 text-amber-700"}>{child.certificateStatus || "pending"}</Badge></div><div className="rounded-2xl bg-[#f0f6f1] p-4"><div className="mb-2 flex justify-between text-sm font-semibold"><span className="flex items-center gap-2"><Coins className="h-4 w-4 text-[#3e8065]" /> Kiddies wallet</span><span>{money(balance)} / {money(target)}</span></div><div className="h-2 overflow-hidden rounded-full bg-[#d8e6dc]"><div className="h-full rounded-full bg-[#4f936e]" style={{ width: `${percent}%` }} /></div><p className="mt-2 text-xs text-[#607875]">{unlocked ? "The $30 milestone was reached. CBT eligibility remains available after withdrawal." : `${money(Math.max(0, target - balance))} more to unlock CBT and withdrawals.`}</p></div><div className="flex items-center justify-between rounded-2xl border border-[#eadfcf] bg-[#fff8eb] p-4"><div><p className="text-sm font-semibold">Spelling bee</p><p className="mt-1 text-xs text-[#806f5e]">{child.attempt?.status ? `Latest result: ${child.attempt.percentage}%` : !certificateApproved ? "Unlocks after certificate approval." : unlocked ? "Your 15-minute, 25-question CBT is ready." : "Unlocks when the wallet first reaches $30."}</p></div>{child.attempt?.status ? <div className={`rounded-xl border px-3 py-2 text-right text-xs ${band.tone}`}>{band.label}</div> : certificateApproved && unlocked ? <Button size="sm" onClick={() => { setActiveChild(child); startCbt.mutate(child.id); }} className="rounded-xl bg-[#cb7d51] hover:bg-[#b96942]">Begin CBT <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button> : <Badge variant="outline">Locked</Badge>}</div>{result && activeChild?.id === child.id && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="mr-2 inline h-4 w-4" />{result.expired ? "Time expired." : `Score ${result.score}/${result.totalQuestions} (${result.percentage}%).`} {result.awardAmount ? `${money(result.awardAmount)} is under staff review.` : ""}</div>}<div className="grid grid-cols-2 gap-2 border-t pt-4"><Button variant="outline" disabled={balance >= target} onClick={() => { setActiveChild(child); setAmount(""); setWalletRequestKey(crypto.randomUUID()); setDialog("contribute"); }}><Target className="mr-2 h-4 w-4" /> Deposit</Button><Button variant="outline" disabled={!canWithdraw} onClick={() => { setActiveChild(child); setAmount(""); setWalletRequestKey(crypto.randomUUID()); setDialog("withdraw"); }}>Withdraw</Button></div>{child.award?.status && <p className="text-center text-xs text-muted-foreground">Grant: {child.award.status}{child.award.awardAmount ? ` · ${money(child.award.awardAmount)}` : ""}</p>}</CardContent></Card>;
    })}</div>}
    <Dialog open={!!dialog} onOpenChange={(open) => !open && setDialog(null)}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>{dialog === "create" ? "Create kiddies account" : dialog === "edit" ? `Edit ${activeChild?.fullName}` : dialog === "contribute" ? `Deposit for ${activeChild?.fullName}` : `Withdraw for ${activeChild?.fullName}`}</DialogTitle><DialogDescription>{dialog === "contribute" ? "The deposit fee is charged in addition to the amount credited to the child wallet." : dialog === "withdraw" ? "The withdrawal fee is deducted from the requested child-wallet amount." : "Only the guardian can manage this account."}</DialogDescription></DialogHeader>{dialog === "contribute" || dialog === "withdraw" ? <div className="space-y-3 py-2"><Label htmlFor="kiddies-amount">{dialog === "contribute" ? "Amount credited to child wallet" : "Amount withdrawn from child wallet"}</Label><Input id="kiddies-amount" type="number" min="0.01" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} placeholder="0.00" /><div className="rounded-lg bg-slate-50 p-3 text-sm">{dialog === "contribute" ? <><p>5% deposit fee: <b>{money(depositFee)}</b></p><p className="mt-1">Total SwiftWallet debit: <b>{money(requested + depositFee)}</b></p></> : <><p>7.5% withdrawal fee: <b>{money(withdrawalFee)}</b></p><p className="mt-1">Net SwiftWallet credit: <b>{money(Math.max(0, requested - withdrawalFee))}</b></p></>}</div></div> : <form id="kiddies-form" onSubmit={submitProfile} className="space-y-3 py-2"><div><Label htmlFor="fullName">Child's full name</Label><Input id="fullName" required value={form.fullName} onChange={event => setForm({ ...form, fullName: event.target.value })} /></div><div><Label htmlFor="dateOfBirth">Date of birth</Label><Input id="dateOfBirth" required disabled={dialog === "edit"} type="date" value={form.dateOfBirth} onChange={event => setForm({ ...form, dateOfBirth: event.target.value })} /></div><div className="grid grid-cols-2 gap-3"><div><Label htmlFor="schoolName">School</Label><Input id="schoolName" value={form.schoolName} onChange={event => setForm({ ...form, schoolName: event.target.value })} /></div><div><Label htmlFor="gradeLevel">Grade</Label><Input id="gradeLevel" value={form.gradeLevel} onChange={event => setForm({ ...form, gradeLevel: event.target.value })} /></div></div><div><Label htmlFor="certificate" className="flex items-center gap-2"><FileUp className="h-4 w-4" /> Birth certificate {dialog === "create" ? "" : "(replace if needed)"}</Label><Input id="certificate" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,application/pdf,image/jpeg,image/png,image/webp" required={dialog === "create"} onChange={selectCertificate} className="mt-1" /><p className="mt-1 text-xs text-muted-foreground">JPEG, PNG, WebP, or PDF; up to 5MB. Staff must approve it before CBT and withdrawals.</p></div></form>}<DialogFooter><Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>{dialog === "contribute" ? <Button disabled={!requested || contribute.isPending} onClick={() => contribute.mutate()}>Confirm {money(requested + depositFee)} debit</Button> : dialog === "withdraw" ? <Button disabled={!requested || withdraw.isPending} onClick={() => withdraw.mutate()}>Receive {money(Math.max(0, requested - withdrawalFee))}</Button> : <Button type="submit" form="kiddies-form" disabled={saveChild.isPending}>{dialog === "edit" ? "Save changes" : "Create account"}</Button>}</DialogFooter></DialogContent></Dialog>
  </section>;
}