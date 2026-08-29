import { useEffect, useState } from "react";
import { Loader2, PlaySquare } from "lucide-react";

export function ProctoringPlayback({ sessionId, track }: { sessionId: string | number; track: "audio" | "video" }) {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  useEffect(() => {
    let objectUrl = "";
    (async () => {
      try {
        const listResponse = await fetch(`/api/admin/proctoring/sessions/${sessionId}/chunks/${track}`, { credentials: "include" });
        if (!listResponse.ok) throw new Error();
        const listed = await listResponse.json();
        const descriptors = listed?.data ?? listed;
        const chunks = Array.isArray(descriptors) ? descriptors : descriptors?.chunks || [];
        if (!chunks.length) { setState("empty"); return; }
        const ordered = [...chunks].sort((a: any, b: any) => Number(a.sequence) - Number(b.sequence));
        const blobs = await Promise.all(ordered.map(async (chunk: any) => {
          const response = await fetch(`/api/admin/proctoring/sessions/${sessionId}/chunks/${track}/${chunk.sequence}`, { credentials: "include" });
          if (!response.ok) throw new Error();
          return response.blob();
        }));
        const contentType = String(ordered[0]?.contentType || blobs[0]?.type || (track === "audio" ? "audio/webm" : "video/webm")).split(";")[0];
        objectUrl = URL.createObjectURL(new Blob(blobs, { type: contentType }));
        setUrl(objectUrl); setState("ready");
      } catch { setState("error"); }
    })();
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [sessionId, track]);
  if (state === "loading") return <span className="flex items-center gap-1 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading {track}</span>;
  if (state === "empty") return <span className="text-xs text-slate-400">No {track} chunks</span>;
  if (state === "error") return <span className="text-xs text-red-600">Playback unavailable</span>;
  return track === "video" ? <video controls preload="metadata" src={url} className="mt-2 max-h-48 w-full rounded-lg bg-slate-950" /> : <div className="flex items-center gap-2"><PlaySquare className="h-4 w-4 text-slate-500" /><audio controls preload="metadata" src={url} className="h-9 max-w-full" /></div>;
}