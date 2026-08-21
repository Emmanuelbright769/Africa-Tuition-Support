import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowRight, BookOpenCheck, CalendarDays, CheckCircle2, ChevronLeft,
  Clock3, Coins, GraduationCap, Pencil, Plus, ShieldCheck, Sparkles, Target,
  Trophy, WalletCards,
} from "lucide-react";

type Child = {
  id: number | string;
  fullName: string;
  dateOfBirth: string;
  schoolName?: string;
  gradeLevel?: string;
  vest?: { balance?: number; targetAmount?: number; fundedAt?: string | null; maturesAt?: string; status?: string };
  attempt?: { status?: string; percentage?: number };
  award?: { awardAmount?: number; status?: string };
};
type Question = { id: number | string; prompt: string; choices: string[] | Record<string, string> };
type CbtSession = { attemptId: string | number; startedAt: string; durationMinutes: number; questions: Question[] };

const money = (value: unknown) => `$${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateLabel = (value?: string) => value ? new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Not set";
const daysRemaining = (value?: string) => value ? Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000)) : 30;
const normalize = (body: any) => body?.data ?? body;

function awardBand(percentage: number) {
  if (percentage >= 70) return { label: "$100 recommended", detail: "70% and above", tone: "bg-[#e6f4ec] text-[#17643b] border-[#b7dfc5]" };
  if (percentage >= 65) return { label: "$50 recommended", detail: "65–69%", tone: "bg-[#fff2d7] text-[#8b5c12] border-[#edd49d]" };
  if (percentage >= 50) return { label: "$30 recommended", detail: "50–64%", tone: "bg-[#eaf0f7] text-[#46627f] border-[#c9d8e8]" };
  return { label: "Practice result", detail: "Below 50%", tone: "bg-[#f3f4f6] text-[#54606d] border-[#d8dde3]" };
}

export default function BackToSchoolSection() {
  const { toast } = useToast();
  const [activeChild, setActiveChild] = useState<Child | null>(null);
  const [dialog, setDialog] = useState<"create" | "edit" | "contribute" | null>(null);
  const [form, setForm] = useState({ fullName: "", dateOfBirth: "", schoolName: "", gradeLevel: "" });
  const [amount, setAmount] = useState("");
  const [session, setSession] = useState<CbtSession | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [result, setResult] = useState<any>(null);

  const childrenQuery = useQuery<Child[]>({ queryKey: ["/api/back-to-school"] });
  const children = useMemo<Child[]>(() => {
    const payload = normalize(childrenQuery.data);
    return Array.isArray(payload) ? payload : (payload?.children || []);
  }, [childrenQuery.data]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/back-to-school"] });

  const saveChild = useMutation({
    mutationFn: async (payload: any) => {
      const path = dialog === "edit" ? `/api/back-to-school/children/${activeChild?.id}` : "/api/back-to-school/children";
      return apiRequest(dialog === "edit" ? "PATCH" : "POST", path, payload);
    },
    onSuccess: () => {
      toast({ title: dialog === "edit" ? "Child profile updated" : "Child added", description: "Their Back to School journey is ready." });
      setDialog(null); refresh();
    },
    onError: (error: any) => toast({ title: "Could not save profile", description: error.message, variant: "destructive" }),
  });
  const contribute = useMutation({
    mutationFn: () => apiRequest("POST", `/api/back-to-school/children/${activeChild?.id}/contributions`, { amount: Number(amount) }),
    onSuccess: () => { toast({ title: "Contribution recorded", description: "A small commitment, kept steadily, can make a difference." }); setAmount(""); setDialog(null); refresh(); },
    onError: (error: any) => toast({ title: "Contribution was not recorded", description: error.message, variant: "destructive" }),
  });
  const startCbt = useMutation({
    mutationFn: async (childId: number | string) => normalize(await (await apiRequest("POST", `/api/back-to-school/children/${childId}/cbt/start`)).json()),
    onSuccess: (data: CbtSession) => {
      const sessionEndsAt = new Date(data.startedAt).getTime() + Number(data.durationMinutes || 15) * 60_000;
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
    const timer = window.setInterval(() => setSecondsLeft((seconds) => seconds - 1), 1000);
    return () => window.clearInterval(timer);
  }, [session, secondsLeft, result]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => { setActiveChild(null); setForm({ fullName: "", dateOfBirth: "", schoolName: "", gradeLevel: "" }); setDialog("create"); };
  const openEdit = (child: Child) => { setActiveChild(child); setForm({ fullName: child.fullName, dateOfBirth: child.dateOfBirth?.slice(0, 10) || "", schoolName: child.schoolName || "", gradeLevel: child.gradeLevel || "" }); setDialog("edit"); };
  const submitProfile = (event: FormEvent) => {
    event.preventDefault();
    const birthDate = new Date(form.dateOfBirth);
    const age = new Date().getFullYear() - birthDate.getFullYear() - (new Date() < new Date(new Date().getFullYear(), birthDate.getMonth(), birthDate.getDate()) ? 1 : 0);
    if (age < 5 || age > 15) {
      toast({ title: "Check the date of birth", description: "Back to School is for children ages 5–15.", variant: "destructive" });
      return;
    }
    saveChild.mutate({ ...form, schoolName: form.schoolName || undefined, gradeLevel: form.gradeLevel || undefined });
  };
  const currentQuestion = session?.questions[questionIndex];
  const choices = currentQuestion ? (Array.isArray(currentQuestion.choices) ? currentQuestion.choices : Object.values(currentQuestion.choices)) : [];
  const formatTime = `${Math.floor(secondsLeft / 60).toString().padStart(2, "0")}:${(secondsLeft % 60).toString().padStart(2, "0")}`;

  if (session && currentQuestion) {
    const selected = answers[String(currentQuestion.id)];
    return (
      <section className="min-h-[620px] rounded-[2rem] bg-[#f6f1e8] p-4 sm:p-8 text-[#203a4b]" data-testid="back-to-school-cbt">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 flex items-center justify-between">
            <button className="flex items-center gap-2 text-sm font-semibold text-[#5e7280] hover:text-[#203a4b]" onClick={() => setSession(null)}><ChevronLeft className="h-4 w-4" /> Leave assessment</button>
            <div className="flex items-center gap-2 rounded-full border border-[#d6cbb9] bg-[#fffaf0] px-4 py-2 font-mono text-sm font-semibold"><Clock3 className="h-4 w-4 text-[#cb7d51]" /> {formatTime}</div>
          </div>
          <div className="mb-8">
            <div className="mb-3 flex justify-between text-xs font-semibold uppercase tracking-[0.15em] text-[#758795]"><span>Word skills check</span><span>{questionIndex + 1} of {session.questions.length}</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-[#ded5c7]"><div className="h-full rounded-full bg-[#cb7d51] transition-all" style={{ width: `${((questionIndex + 1) / session.questions.length) * 100}%` }} /></div>
          </div>
          <Card className="border-[#e4d8c8] bg-[#fffaf0] shadow-[0_20px_60px_rgba(75,58,38,.10)]">
            <CardHeader className="p-6 sm:p-10"><p className="mb-3 text-sm font-semibold text-[#cb7d51]">Question {questionIndex + 1}</p><CardTitle className="text-2xl leading-tight sm:text-3xl">{currentQuestion.prompt}</CardTitle></CardHeader>
            <CardContent className="grid gap-3 px-6 pb-8 sm:grid-cols-2 sm:px-10">
              {choices.map((choice, index) => <button key={`${choice}-${index}`} onClick={() => setAnswers({ ...answers, [String(currentQuestion.id)]: String(index) })} className={`rounded-2xl border p-4 text-left text-sm font-medium transition ${selected === String(index) ? "border-[#cb7d51] bg-[#f5dfd2] text-[#8e4b2c]" : "border-[#ded5c7] bg-white/60 hover:border-[#cb7d51]"}`}><span className="mr-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#e9e1d5] text-xs">{String.fromCharCode(65 + index)}</span>{choice}</button>)}
            </CardContent>
          </Card>
          <div className="mt-6 flex justify-end"><Button disabled={!selected || submitCbt.isPending} onClick={() => questionIndex < session.questions.length - 1 ? setQuestionIndex(questionIndex + 1) : submitCbt.mutate()} className="rounded-xl bg-[#234b5e] px-6 hover:bg-[#183b4b]">{questionIndex < session.questions.length - 1 ? "Next question" : "Finish assessment"} <ArrowRight className="ml-2 h-4 w-4" /></Button></div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6 pb-20 text-[#203a4b] sm:pb-6" data-testid="back-to-school-section">
      <div className="relative overflow-hidden rounded-[2rem] bg-[#234b5e] px-6 py-8 text-[#fffaf0] sm:px-10 sm:py-10">
        <div className="absolute -right-14 -top-20 h-64 w-64 rounded-full border-[30px] border-[#dca66b]/25" /><div className="absolute bottom-0 right-20 h-20 w-20 rounded-t-full bg-[#cb7d51]/30" />
        <div className="relative max-w-2xl"><div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#fffaf0]/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#f5d5a6]"><Sparkles className="h-3.5 w-3.5" /> Back to School</div><h2 className="max-w-xl text-3xl font-semibold tracking-tight sm:text-5xl">A steady start for their next school year.</h2><p className="mt-4 max-w-xl text-sm leading-6 text-[#d9e4e6] sm:text-base">Create a guardian-managed $30 Piggy Vest, save deliberately for 30 days, and celebrate the word skills your child is building. Tuition awards are recommendations, subject to review.</p><div className="mt-7 flex flex-wrap gap-3"><Button onClick={openCreate} className="rounded-xl bg-[#e3a36f] text-[#203a4b] hover:bg-[#efb783]"><Plus className="mr-2 h-4 w-4" /> Add a child</Button><div className="flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-xs text-[#d9e4e6]"><ShieldCheck className="h-4 w-4 text-[#e3a36f]" /> Guardian-managed</div></div></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-[#dbe6e4] bg-[#eef5f1] p-4"><WalletCards className="mb-3 h-5 w-5 text-[#3e8065]" /><p className="text-sm font-semibold">Save with purpose</p><p className="mt-1 text-xs leading-5 text-[#607875]">Build a vest toward a clear school-readiness target.</p></div><div className="rounded-2xl border border-[#eadfcf] bg-[#fff7e9] p-4"><BookOpenCheck className="mb-3 h-5 w-5 text-[#cb7d51]" /><p className="text-sm font-semibold">Practise word skills</p><p className="mt-1 text-xs leading-5 text-[#806f5e]">A timed, age-appropriate check-in for each child.</p></div><div className="rounded-2xl border border-[#d9e0e9] bg-[#f0f4f8] p-4"><Trophy className="mb-3 h-5 w-5 text-[#55728b]" /><p className="text-sm font-semibold">See the result</p><p className="mt-1 text-xs leading-5 text-[#627284]">Celebrate progress without promising automatic payout.</p></div></div>
      {childrenQuery.isLoading ? <div className="grid gap-4 sm:grid-cols-2"><div className="h-56 animate-pulse rounded-2xl bg-[#e8ece9]" /><div className="h-56 animate-pulse rounded-2xl bg-[#e8ece9]" /></div> : childrenQuery.isError ? <Card className="border-[#e5c8c1] bg-[#fff5f2]"><CardContent className="flex items-center justify-between gap-4 p-6"><div><p className="font-semibold">We could not load your children</p><p className="mt-1 text-sm text-muted-foreground">Try again to see the latest vest and assessment progress.</p></div><Button variant="outline" onClick={() => childrenQuery.refetch()}>Try again</Button></CardContent></Card> : children.length === 0 ? <Card className="border-dashed border-[#c9d8d2] bg-[#f7fbf8]"><CardContent className="flex flex-col items-center p-10 text-center"><GraduationCap className="mb-4 h-10 w-10 text-[#6d9b87]" /><CardTitle className="text-xl">Start with one child</CardTitle><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Add a profile to see their vest, choose a contribution, and unlock the word skills check.</p><Button onClick={openCreate} className="mt-5 rounded-xl bg-[#234b5e] hover:bg-[#183b4b]"><Plus className="mr-2 h-4 w-4" /> Add child profile</Button></CardContent></Card> :
        <div className="grid gap-4 lg:grid-cols-2">{children.map((child: Child) => {
          const balance = Number(child.vest?.balance || 0); const target = Number(child.vest?.targetAmount || 0); const vestPct = target ? Math.min(balance / target * 100, 100) : 0; const attemptPct = Number(child.attempt?.percentage || 0); const band = awardBand(attemptPct);
          const qualificationReady = child.vest?.status === "qualified";
          const vestOpen = child.vest?.status === "active";
          return <Card key={child.id} className="overflow-hidden border-[#dfe7e2] bg-[#fffdfa] shadow-[0_12px_35px_rgba(46,64,54,.07)]"><div className="h-1.5 bg-[#dca66b]" /><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-xl">{child.fullName}</CardTitle><CardDescription className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1"><span>{child.schoolName || "School not added"}</span>{child.gradeLevel && <><span>·</span><span>Grade {child.gradeLevel}</span></>}</CardDescription></div><button onClick={() => openEdit(child)} className="rounded-lg p-2 text-[#71878a] hover:bg-[#eef4f1] hover:text-[#234b5e]" aria-label={`Edit ${child.fullName}`}><Pencil className="h-4 w-4" /></button></div></CardHeader><CardContent className="space-y-5"><div className="rounded-2xl bg-[#f0f6f1] p-4"><div className="mb-2 flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-semibold"><Coins className="h-4 w-4 text-[#3e8065]" /> Piggy Vest</div><Badge variant="outline" className="border-[#bcd7c8] bg-white/60 text-[#3e8065]">{child.vest?.status || "building"}</Badge></div><div className="flex items-end justify-between"><p className="text-2xl font-semibold">{money(balance)}</p><p className="text-xs text-[#70847a]">of {money(target)}</p></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[#d8e6dc]"><div className="h-full rounded-full bg-[#4f936e] transition-all" style={{ width: `${vestPct}%` }} /></div><div className="mt-2 flex items-center justify-between text-xs text-[#70847a]"><span>Day {Math.min(30, 30 - daysRemaining(child.vest?.maturesAt))} of 30 · {vestPct.toFixed(0)}%</span><span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {vestOpen ? `${daysRemaining(child.vest?.maturesAt)} days left` : `Matured ${dateLabel(child.vest?.maturesAt)}`}</span></div></div><div className="flex items-center justify-between rounded-2xl border border-[#eadfcf] bg-[#fff8eb] p-4"><div><p className="text-sm font-semibold">Word skills check</p><p className="mt-1 text-xs text-[#806f5e]">{child.attempt?.status ? `Latest result: ${attemptPct}%` : qualificationReady ? "Your 15-minute spelling bee is ready." : "Unlocks after the $30 vest completes 30 days."}</p></div>{child.attempt?.status ? <div className={`rounded-xl border px-3 py-2 text-right text-xs ${band.tone}`}><p className="font-bold">{band.label}</p><p className="mt-0.5 opacity-80">{band.detail}</p></div> : qualificationReady ? <Button size="sm" onClick={() => { setActiveChild(child); startCbt.mutate(child.id); }} className="rounded-xl bg-[#cb7d51] hover:bg-[#b96942]">Begin check <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button> : <Badge variant="outline" className="border-[#e7c9b7] bg-white/60 text-[#a45f3e]">Vest in progress</Badge>}</div>{result && activeChild?.id === child.id && <div className="rounded-2xl border border-[#bfd9c8] bg-[#edf8f0] p-4"><div className="flex items-center gap-2 font-semibold text-[#17643b]"><CheckCircle2 className="h-5 w-5" /> Assessment submitted</div><p className="mt-2 text-sm text-[#416d52]">{result.expired ? "Time ended before answers were submitted." : `Score ${result.score} of ${result.totalQuestions} · ${result.percentage}%`}</p>{result.awardAmount !== undefined && <p className="mt-1 text-xs text-[#416d52]">Programme award status: {result.awardStatus || "under review"} · {money(result.awardAmount)}</p>}</div>}<div className="flex gap-2 border-t border-[#edf0ed] pt-4"><Button variant="outline" disabled={!vestOpen} onClick={() => { setActiveChild(child); setDialog("contribute"); }} className="flex-1 rounded-xl border-[#b9cbc0] text-[#3e8065]"><Target className="mr-2 h-4 w-4" /> {vestOpen ? "Contribute" : "Vest closed"}</Button></div>{child.award?.status && <p className="text-center text-xs text-[#758795]">Award: {child.award.status}{child.award.awardAmount ? ` · ${money(child.award.awardAmount)}` : ""}</p>}</CardContent></Card>;
        })}</div>}
      <Dialog open={!!dialog} onOpenChange={(open) => !open && setDialog(null)}><DialogContent className="border-[#dfe7e2] bg-[#fffdfa] sm:max-w-md"><DialogHeader><DialogTitle>{dialog === "edit" ? "Edit child profile" : dialog === "contribute" ? `Contribute to ${activeChild?.fullName}` : "Add a child profile"}</DialogTitle><DialogDescription>{dialog === "contribute" ? "Choose an amount for their school-readiness vest." : "Only guardians manage these details and contributions."}</DialogDescription></DialogHeader>{dialog === "contribute" ? <div className="space-y-4 py-2"><Label htmlFor="contribution">Contribution amount</Label><div className="relative"><span className="absolute left-3 top-2.5 text-sm text-muted-foreground">$</span><Input id="contribution" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="pl-8" placeholder="0.00" /></div></div> : <form id="child-form" onSubmit={submitProfile} className="space-y-4 py-2"><div><Label htmlFor="fullName">Child's full name</Label><Input id="fullName" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div><div><Label htmlFor="dateOfBirth">Date of birth</Label><Input id="dateOfBirth" required type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} /></div><div className="grid grid-cols-2 gap-3"><div><Label htmlFor="schoolName">School <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="schoolName" value={form.schoolName} onChange={(e) => setForm({ ...form, schoolName: e.target.value })} /></div><div><Label htmlFor="gradeLevel">Grade <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="gradeLevel" value={form.gradeLevel} onChange={(e) => setForm({ ...form, gradeLevel: e.target.value })} /></div></div></form>}<DialogFooter><Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>{dialog === "contribute" ? <Button disabled={!amount || Number(amount) <= 0 || contribute.isPending} onClick={() => contribute.mutate()} className="bg-[#234b5e] hover:bg-[#183b4b]">Confirm contribution</Button> : <Button type="submit" form="child-form" disabled={saveChild.isPending} className="bg-[#234b5e] hover:bg-[#183b4b]">{dialog === "edit" ? "Save changes" : "Create profile"}</Button>}</DialogFooter></DialogContent></Dialog>
    </section>
  );
}