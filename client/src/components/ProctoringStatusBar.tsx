import { Camera, Circle, Mic, ShieldCheck } from "lucide-react";
export function ProctoringStatusBar({ cameraActive, microphoneActive, status }: { cameraActive: boolean; microphoneActive: boolean; status: string }) {
  return <div className="sticky top-2 z-20 mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-red-200 bg-[#fffaf7] px-3 py-2 text-xs shadow-sm">
    <span className="flex items-center gap-2 font-semibold text-red-700"><Circle className="h-2.5 w-2.5 fill-current" /> {status === "recording" ? "Recording live" : "Recording status: " + status}</span>
    <span className="flex items-center gap-3 text-slate-600"><span className={cameraActive ? "text-emerald-700" : "text-red-700"}><Camera className="mr-1 inline h-3.5 w-3.5" />Camera {cameraActive ? "ready" : "offline"}</span><span className={microphoneActive ? "text-emerald-700" : "text-red-700"}><Mic className="mr-1 inline h-3.5 w-3.5" />Mic {microphoneActive ? "ready" : "offline"}</span><ShieldCheck className="h-4 w-4 text-[#24644f]" /></span>
  </div>;
}