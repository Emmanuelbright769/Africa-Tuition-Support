import { useState } from "react";
import { Camera, Check, LockKeyhole, Mic, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ProctoringNotice({ assessmentLabel, onStart, busy = false, disabled = false, error = "" }: {
  assessmentLabel: string; onStart: () => Promise<void> | void; busy?: boolean; disabled?: boolean; error?: string;
}) {
  const [consented, setConsented] = useState(false);
  return <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-[#fffdf8] p-6 text-slate-800 shadow-[0_18px_50px_rgba(35,75,94,.10)] sm:p-8">
    <div className="flex items-start gap-4">
      <div className="rounded-2xl bg-[#e6f1ec] p-3 text-[#24644f]"><ShieldCheck className="h-6 w-6" /></div>
      <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#24644f]">Before {assessmentLabel}</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">A clear recording agreement</h2></div>
    </div>
    <p className="mt-5 text-sm leading-6 text-slate-600">Your camera and microphone will record throughout this assessment. Authorized TSIA administrators may review the recording as evidence when checking test integrity. Recordings are retained for the period stated in the platform policy, then securely deleted. Need help? Contact support before continuing.</p>
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl bg-[#f3f7f4] p-4"><Camera className="mb-2 h-4 w-4 text-[#24644f]" /><p className="text-sm font-semibold">Camera recording</p><p className="mt-1 text-xs text-slate-500">A live camera is required.</p></div>
      <div className="rounded-2xl bg-[#f8f1e8] p-4"><Mic className="mb-2 h-4 w-4 text-[#a45b37]" /><p className="text-sm font-semibold">Microphone recording</p><p className="mt-1 text-xs text-slate-500">Audio stays on while you test.</p></div>
    </div>
    <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4 text-sm leading-5">
      <input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} className="mt-1 h-4 w-4 accent-[#24644f]" />
      <span>I understand and consent to camera and microphone recording for this assessment.</span>
    </label>
    {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error} Check browser permissions, close other apps using the devices, then try again.</p>}
    <Button disabled={!consented || busy || disabled} onClick={onStart} className="mt-5 w-full rounded-xl bg-[#234b5e] hover:bg-[#183b4b]">{busy ? "Preparing camera and microphone…" : "Consent and check devices"} <Check className="ml-2 h-4 w-4" /></Button>
    <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400"><LockKeyhole className="h-3.5 w-3.5" /> Your consent is recorded with this assessment.</p>
  </div>;
}