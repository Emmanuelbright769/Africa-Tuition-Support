import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/queryClient";

export type ProctoringAssessment = "kiddies" | "student" | "masters";
export type ProctoringStatus = "idle" | "preparing" | "ready" | "recording" | "flushing" | "complete" | "interrupted" | "failed";

type Options = { assessmentType: ProctoringAssessment; childId?: number | string };
type Session = { id: string | number };

const POLICY_VERSION = "2026-08-28";
const TIMESLICE = 10_000;
const UPLOAD_TIMEOUT_MS = 15_000;
const STOP_TIMEOUT_MS = 8_000;

function supportedMime(kind: "audio" | "video") {
  const candidates = kind === "video"
    ? ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4;codecs=avc1.42E01E", "video/mp4"]
    : ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg", "audio/mp4"];
  return candidates.find((mime) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime)) || "";
}

function waitForRecorderStop(recorder: MediaRecorder) {
  return new Promise<void>((resolve) => {
    if (recorder.state === "inactive") return resolve();
    const timeout = window.setTimeout(resolve, STOP_TIMEOUT_MS);
    recorder.addEventListener("stop", () => {
      window.clearTimeout(timeout);
      resolve();
    }, { once: true });
    try {
      recorder.requestData();
      recorder.stop();
    } catch {
      window.clearTimeout(timeout);
      resolve();
    }
  });
}

async function responseJson(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.message || "Proctoring service could not complete that step.");
  return body?.data ?? body;
}

export function useProctoringController() {
  const [status, setStatus] = useState<ProctoringStatus>("idle");
  const [sessionId, setSessionId] = useState<string | number | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [microphoneActive, setMicrophoneActive] = useState(false);
  const [error, setError] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const recordersRef = useRef<MediaRecorder[]>([]);
  const queuesRef = useRef<Record<string, Promise<void>>>({});
  const failedUploadRef = useRef(false);
  const finalizedRef = useRef(false);
  const sequenceRef = useRef({ audio: 0, video: 0 });
  const idRef = useRef<string | number | null>(null);
  const startedAtRef = useRef(0);
  const errorRef = useRef("");

  const upload = useCallback(async (track: "audio" | "video", blob: Blob, sequence: number) => {
    const id = idRef.current;
    if (!id || !blob.size) return;
    const previous = queuesRef.current[track] || Promise.resolve();
    const task = previous.then(async () => {
      let lastError: unknown;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
        try {
          const response = await fetch(`/api/proctoring/sessions/${id}/chunks/${track}/${sequence}`, {
            method: "POST", body: blob, credentials: "include",
            headers: { "Content-Type": blob.type || "application/octet-stream" },
            signal: controller.signal,
          });
          if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body?.message || `Upload failed (${response.status})`);
          }
          return;
        } catch (caught) {
          lastError = caught;
          await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
        } finally {
          window.clearTimeout(timeout);
        }
      }
      failedUploadRef.current = true;
      errorRef.current = lastError instanceof Error ? lastError.message : "Recording upload failed.";
      throw lastError || new Error("Recording upload failed.");
    }).catch((caught) => {
      failedUploadRef.current = true;
      setError(caught instanceof Error ? caught.message : "Recording upload failed.");
    });
    queuesRef.current[track] = task;
    await task;
  }, []);

  const finalize = useCallback(async (finalStatus: "completed" | "interrupted" | "failed"): Promise<boolean> => {
    const id = idRef.current;
    if (!id || finalizedRef.current) return !failedUploadRef.current;
    setStatus("flushing");
    const stopped = recordersRef.current.map(waitForRecorderStop);
    await Promise.all(stopped);
    await Promise.all(Object.values(queuesRef.current));
    const stream = streamRef.current;
    const durationMs = startedAtRef.current ? Math.max(0, Date.now() - startedAtRef.current) : 0;
    try {
      await responseJson(await apiRequest("POST", `/api/proctoring/sessions/${id}/finalize`, {
        status: failedUploadRef.current ? "failed" : finalStatus,
        durationMs,
        ...(failedUploadRef.current ? { failureReason: errorRef.current || "One or more recording chunks could not be uploaded." } : {}),
      }));
      finalizedRef.current = true;
      setStatus(failedUploadRef.current ? "failed" : finalStatus === "completed" ? "complete" : "interrupted");
    } catch {
      setStatus("failed");
      failedUploadRef.current = true;
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      recordersRef.current = [];
    }
    return finalizedRef.current && !failedUploadRef.current;
  }, []);

  const start = useCallback(async ({ assessmentType, childId }: Options) => {
    setStatus("preparing"); setError(""); errorRef.current = ""; failedUploadRef.current = false; finalizedRef.current = false;
    queuesRef.current = {}; sequenceRef.current = { audio: 0, video: 0 };
    idRef.current = null; setSessionId(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera and microphone access is not available in this browser.");
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];
      if (!videoTrack || !audioTrack || videoTrack.readyState !== "live" || audioTrack.readyState !== "live") {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error("Both a working camera and microphone are required. Check the device permissions and try again.");
      }
      streamRef.current = stream; setCameraActive(true); setMicrophoneActive(true);
      const videoMimeType = supportedMime("video");
      const audioMimeType = supportedMime("audio");
      if (!videoMimeType || !audioMimeType) throw new Error("This browser cannot create the required secure recording format.");
      const session = await responseJson(await apiRequest("POST", "/api/proctoring/sessions", { assessmentType, ...(childId ? { childId } : {}), consent: true, policyVersion: POLICY_VERSION })) as Session;
      idRef.current = session.id; setSessionId(session.id);
      await responseJson(await apiRequest("POST", `/api/proctoring/sessions/${session.id}/ready`, {
        camera: true, microphone: true, audioMimeType, videoMimeType,
      }));
      // Keep each recorder on a single physical track. Reusing the microphone in
      // both recorders causes intermittent failures in mobile Safari.
      const videoRecorder = new MediaRecorder(new MediaStream([videoTrack]), { mimeType: videoMimeType });
      const audioRecorder = new MediaRecorder(new MediaStream([audioTrack]), { mimeType: audioMimeType });
      const attach = (recorder: MediaRecorder, track: "audio" | "video") => {
        recorder.ondataavailable = (event) => {
          if (event.data.size) void upload(track, event.data, sequenceRef.current[track]++);
        };
        recorder.onstop = () => undefined;
      };
      attach(videoRecorder, "video"); attach(audioRecorder, "audio");
      recordersRef.current = [videoRecorder, audioRecorder];
      setStatus("ready");
      return session.id;
    } catch (caught) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null; setCameraActive(false); setMicrophoneActive(false);
      const message = caught instanceof Error ? caught.message : "Unable to start consent-based recording.";
      setError(message); setStatus("failed"); throw new Error(message);
    }
  }, [upload]);

  const beginRecording = useCallback(() => {
    if (!idRef.current || recordersRef.current.length !== 2 || recordersRef.current.some(recorder => recorder.state !== "inactive")) {
      throw new Error("The recording session is not ready to begin.");
    }
    startedAtRef.current = Date.now();
    recordersRef.current.forEach(recorder => recorder.start(TIMESLICE));
    setStatus("recording");
  }, []);

  useEffect(() => {
    const heartbeat = window.setInterval(() => {
      const id = idRef.current;
      if (id && status === "recording") void apiRequest("POST", `/api/proctoring/sessions/${id}/heartbeat`, { cameraActive, microphoneActive }).catch(() => undefined);
    }, 15_000);
    const interrupt = () => { if (idRef.current && !finalizedRef.current) void finalize("interrupted"); };
    window.addEventListener("pagehide", interrupt);
    return () => { window.clearInterval(heartbeat); window.removeEventListener("pagehide", interrupt); };
  }, [cameraActive, microphoneActive, finalize, status]);

  useEffect(() => {
    const stream = streamRef.current;
    if (!stream) return;
    const onEnded = () => {
      const cameraLive = stream.getVideoTracks().some((track) => track.readyState === "live");
      const microphoneLive = stream.getAudioTracks().some((track) => track.readyState === "live");
      setCameraActive(cameraLive);
      setMicrophoneActive(microphoneLive);
      if (!cameraLive || !microphoneLive) void finalize("interrupted");
    };
    stream.getTracks().forEach((track) => track.addEventListener("ended", onEnded));
    return () => stream.getTracks().forEach((track) => track.removeEventListener("ended", onEnded));
  }, [finalize, status]);

  return { status, sessionId, cameraActive, microphoneActive, error, start, beginRecording, finalize };
}