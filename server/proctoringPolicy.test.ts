import test from "node:test";
import assert from "node:assert/strict";
import {
  canCompleteProctoring,
  hasSustainedProctoringCoverage,
  hasContinuousChunkTimeline,
  isSafeProctoringMime,
  parseProctoringFinalStatus,
} from "./proctoringPolicy";

test("accepts only approved recording MIME types for the matching track", () => {
  assert.equal(isSafeProctoringMime("video", "video/webm;codecs=vp8,opus"), true);
  assert.equal(isSafeProctoringMime("audio", "audio/webm;codecs=opus"), true);
  assert.equal(isSafeProctoringMime("video", "video/mp4;codecs=avc1.42E01E"), true);
  assert.equal(isSafeProctoringMime("audio", "audio/mp4"), true);
  assert.equal(isSafeProctoringMime("audio", "video/webm"), false);
  assert.equal(isSafeProctoringMime("video", "text/html"), false);
});

test("preserves interrupted and failed final states instead of claiming completion", () => {
  assert.equal(parseProctoringFinalStatus("completed"), "completed");
  assert.equal(parseProctoringFinalStatus("interrupted"), "interrupted");
  assert.equal(parseProctoringFinalStatus("failed"), "failed");
  assert.equal(parseProctoringFinalStatus("deleted"), null);
});

test("completion requires at least one audio and video chunk", () => {
  assert.equal(canCompleteProctoring(1, 1), true);
  assert.equal(canCompleteProctoring(0, 1), false);
  assert.equal(canCompleteProctoring(1, 0), false);
});

test("long assessments require sustained chunks and recent heartbeats", () => {
  assert.equal(hasSustainedProctoringCoverage({
    durationSeconds: 600,
    audioChunkCount: 60,
    videoChunkCount: 60,
    heartbeatCount: 39,
    secondsSinceHeartbeat: 14,
  }), true);
  assert.equal(hasSustainedProctoringCoverage({
    durationSeconds: 600,
    audioChunkCount: 1,
    videoChunkCount: 1,
    heartbeatCount: 1,
    secondsSinceHeartbeat: 14,
  }), false);
  assert.equal(hasSustainedProctoringCoverage({
    durationSeconds: 120,
    audioChunkCount: 12,
    videoChunkCount: 12,
    heartbeatCount: 8,
    secondsSinceHeartbeat: 90,
  }), false);
});

test("chunk timelines must cover the assessment without long gaps", () => {
  const start = 1_000_000;
  const end = start + 120_000;
  assert.equal(hasContinuousChunkTimeline(start, end, [start + 10_000, start + 40_000, start + 80_000, start + 119_000]), true);
  assert.equal(hasContinuousChunkTimeline(start, end, [start + 1_000]), false);
  assert.equal(hasContinuousChunkTimeline(start, end, [start + 1_000, end - 1_000], 45_000), false);
});