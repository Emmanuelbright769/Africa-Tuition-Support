export type ProctoringTrack = "audio" | "video";
export type ProctoringFinalStatus = "completed" | "interrupted" | "failed";

const SAFE_MIME_TYPES: Record<ProctoringTrack, ReadonlySet<string>> = {
  audio: new Set(["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg"]),
  video: new Set(["video/webm", "video/mp4"]),
};

export function isSafeProctoringMime(track: string, contentType: string): track is ProctoringTrack {
  return (track === "audio" || track === "video") &&
    SAFE_MIME_TYPES[track].has(contentType.split(";")[0].trim().toLowerCase());
}

export function parseProctoringFinalStatus(value: unknown): ProctoringFinalStatus | null {
  return value === "completed" || value === "interrupted" || value === "failed" ? value : null;
}

export function canCompleteProctoring(audioChunkCount: number, videoChunkCount: number) {
  return audioChunkCount > 0 && videoChunkCount > 0;
}

export function hasSustainedProctoringCoverage(input: {
  durationSeconds: number;
  audioChunkCount: number;
  videoChunkCount: number;
  heartbeatCount: number;
  secondsSinceHeartbeat: number | null;
}) {
  const expectedChunksPerTrack = Math.max(1, Math.floor(input.durationSeconds / 30));
  const expectedHeartbeats = Math.max(0, Math.floor(input.durationSeconds / 45));
  const heartbeatIsRecent = input.durationSeconds < 45 ||
    (input.secondsSinceHeartbeat !== null && input.secondsSinceHeartbeat <= 45);
  return input.audioChunkCount >= expectedChunksPerTrack &&
    input.videoChunkCount >= expectedChunksPerTrack &&
    input.heartbeatCount >= expectedHeartbeats &&
    heartbeatIsRecent;
}

export function hasContinuousChunkTimeline(startedAtMs: number, endedAtMs: number, chunkTimesMs: number[], maxGapMs = 45_000) {
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(endedAtMs) || endedAtMs < startedAtMs || chunkTimesMs.length === 0) return false;
  const ordered = chunkTimesMs.filter(Number.isFinite).sort((a, b) => a - b);
  if (!ordered.length || ordered[0] - startedAtMs > maxGapMs || endedAtMs - ordered[ordered.length - 1] > maxGapMs) return false;
  return ordered.every((time, index) => index === 0 || time - ordered[index - 1] <= maxGapMs);
}