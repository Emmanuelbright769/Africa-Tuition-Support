import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, ExternalLink, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ProctoringPlayback } from "@/components/ProctoringPlayback";

const money = (value: unknown) => `$${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function stateTone(value?: string) {
  if (value === "approved" || value === "paid") return "border-emerald-300 text-emerald-700";
  if (value === "declined" || value === "not_eligible") return "border-red-300 text-red-700";
  return "border-amber-300 text-amber-700";
}

export default function BackToSchoolAdminSection() {
  const { toast } = useToast();
  const { data: records = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/back-to-school"] });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/admin/back-to-school"] });
  const certificateReview = useMutation({
    mutationFn: ({ childId, approved, reason }: { childId: number; approved: boolean; reason?: string }) => apiRequest("POST", `/api/admin/back-to-school/children/${childId}/certificate-review`, { approved, reason }),
    onSuccess: (_, values) => { toast({ title: values.approved ? "Birth certificate approved" : "Birth certificate declined" }); refresh(); },
    onError: (error: any) => toast({ title: "Certificate review failed", description: error.message, variant: "destructive" }),
  });
  const awardReview = useMutation({
    mutationFn: ({ awardId, approved, reason }: { awardId: number; approved: boolean; reason?: string }) => apiRequest("POST", `/api/admin/back-to-school/awards/${awardId}/review`, { approved, reason }),
    onSuccess: (_, values) => { toast({ title: values.approved ? "Grant approved" : "Grant declined" }); refresh(); },
    onError: (error: any) => toast({ title: "Grant review failed", description: error.message, variant: "destructive" }),
  });
  const payAward = useMutation({
    mutationFn: ({ awardId, reference }: { awardId: number; reference: string }) => apiRequest("POST", `/api/admin/back-to-school/awards/${awardId}/pay`, { reference }),
    onSuccess: () => { toast({ title: "Grant credited", description: "The approved grant is now in the guardian SwiftWallet." }); refresh(); },
    onError: (error: any) => toast({ title: "Grant payment failed", description: error.message, variant: "destructive" }),
  });
  const actionReason = (label: string) => window.prompt(`${label} reason (optional):`) || "";

  return <div className="space-y-5">
    <div><h1 className="text-2xl font-bold text-slate-900">Back to school kiddies</h1><p className="mt-1 text-sm text-slate-500">Review birth certificates, assessment grants, and wallet credits.</p></div>
    <Card className="border-0 shadow-sm"><CardHeader><CardTitle>Child verification and grants</CardTitle><CardDescription>Documents are restricted to administrators. Grant credits are irreversible once paid.</CardDescription></CardHeader><CardContent className="space-y-4">
      {isLoading ? <p className="py-10 text-center text-sm text-slate-500">Loading kiddies accounts…</p> : records.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">No kiddies accounts yet.</p> : records.map((record: any) => {
        const child = record; const award = record.award;
        return <div key={child.id} className="rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-slate-900">{child.fullName}</p><p className="text-xs text-slate-500">{child.guardian?.firstName} {child.guardian?.lastName} · {child.guardian?.email}</p><p className="mt-1 text-xs text-slate-500">Wallet {money(child.vest?.balance)} / {money(child.vest?.targetAmount)} · CBT {child.attempt?.percentage ?? "—"}%</p></div><div className="flex flex-wrap gap-2"><Badge variant="outline" className={stateTone(child.certificateStatus)}>Certificate: {child.certificateStatus}</Badge>{award && <Badge variant="outline" className={stateTone(award.status)}>Grant: {award.status}</Badge>}{child.attempt?.autoSubmitted && <Badge variant="outline" className="border-red-300 text-red-700">Integrity auto-submit</Badge>}{!child.attempt?.autoSubmitted && Number(child.attempt?.cheatingEvents?.length || 0) > 0 && <Badge variant="outline" className="border-amber-300 text-amber-700">{child.attempt.cheatingEvents.length} integrity alert{child.attempt.cheatingEvents.length === 1 ? "" : "s"}</Badge>}</div></div>
          <div className="mt-3 flex flex-wrap gap-2">
            {child.certificate && <Button variant="outline" size="sm" onClick={() => window.open(`/api/admin/back-to-school/children/${child.id}/birth-certificate`, "_blank", "noopener,noreferrer")}><ExternalLink className="mr-1.5 h-3.5 w-3.5" /> View certificate</Button>}
            {child.certificate && child.certificateStatus !== "approved" && <Button size="sm" onClick={() => certificateReview.mutate({ childId: child.id, approved: true, reason: actionReason("Approval") })}><Check className="mr-1.5 h-3.5 w-3.5" /> Approve certificate</Button>}
            {child.certificateStatus !== "declined" && <Button variant="outline" size="sm" className="text-red-700" onClick={() => certificateReview.mutate({ childId: child.id, approved: false, reason: actionReason("Decline") })}><X className="mr-1.5 h-3.5 w-3.5" /> Decline certificate</Button>}
            {award?.status === "recommended" && <><Button size="sm" onClick={() => awardReview.mutate({ awardId: award.id, approved: true, reason: actionReason("Grant approval") })}>Approve {money(award.awardAmount)} grant</Button><Button variant="outline" size="sm" className="text-red-700" onClick={() => awardReview.mutate({ awardId: award.id, approved: false, reason: actionReason("Grant decline") })}>Decline grant</Button></>}
            {award?.status === "approved" && <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { const reference = window.prompt("Payment reference:"); if (reference?.trim()) payAward.mutate({ awardId: award.id, reference: reference.trim() }); }}>Credit {money(award.awardAmount)} to guardian wallet</Button>}
          </div>
           {child.proctoring && <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
             <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">CBT recording evidence</p><Badge variant="outline" className={child.proctoring.status === "completed" ? "border-emerald-300 text-emerald-700" : child.proctoring.status === "failed" || child.proctoring.status === "deleted" ? "border-red-300 text-red-700" : "border-amber-300 text-amber-700"}>{child.proctoring.status || "incomplete"}</Badge></div>
             <p className="mt-2 text-xs text-slate-500">Consent {child.proctoring.consentedAt ? "recorded" : "not recorded"} · Duration {child.proctoring.durationMs ? `${Math.round(child.proctoring.durationMs / 60000)} min` : "—"} · Audio {child.proctoring.audioBytes || 0} bytes · Video {child.proctoring.videoBytes || 0} bytes</p>
             {child.proctoring.id && <div className="mt-3 grid gap-2 sm:grid-cols-2"><div><p className="mb-1 text-[11px] font-semibold text-slate-500">Audio</p><ProctoringPlayback sessionId={child.proctoring.id} track="audio" /></div><div><p className="mb-1 text-[11px] font-semibold text-slate-500">Video</p><ProctoringPlayback sessionId={child.proctoring.id} track="video" /></div></div>}
           </div>}
          {(child.certificateReviewReason || award?.reviewReason || award?.paymentReference) && <p className="mt-3 text-xs text-slate-500">{child.certificateReviewReason || award?.reviewReason || `Payment reference: ${award.paymentReference}`}</p>}
        </div>;
      })}
    </CardContent></Card>
  </div>;
}