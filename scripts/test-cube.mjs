import { createRequire } from "module";
const require = createRequire(import.meta.url);
globalThis.Cube = require("cubejs");

const { applyAlg, scrambleCube, isSolved, solvedFacelets } = await import("../js/cube.js");
const { analyze, RIGHTY } = await import("../js/solver.js");
const {
  armTimer,
  buildAnalysis,
  createTimer,
  elapsedMs,
  formatClock,
  formatDelta,
  noteProgress,
  startTimer,
} = await import("../js/solve-timer.js");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

let f = solvedFacelets();
assert(analyze(f).solved, "solved start");

f = solvedFacelets();
scrambleCube(f, 30);
const a = analyze(f);
assert(!a.solved, "scrambled");
assert(a.stepIndex >= 0 && a.stepIndex <= 6, "step range");
assert(a.hint, "has hint");
console.log("scramble → step", a.stepIndex + 1, a.hint.title);

// y and x2
f = solvedFacelets();
applyAlg(f, "y");
applyAlg(f, "y'");
assert(isSolved(f), "y y'");
applyAlg(f, "x2");
applyAlg(f, "x2");
assert(isSolved(f), "x2 x2");

// righty 6 times from solved messes then... sexy 6 = id
f = solvedFacelets();
for (let i = 0; i < 6; i++) applyAlg(f, RIGHTY);
assert(isSolved(f), "righty6");

// Progress: break only LL and see step >= 4
f = solvedFacelets();
applyAlg(f, "R U R' U R U2 R'");
const b = analyze(f);
console.log("after sune-like on solved →", b.stepIndex + 1, STEPS_TITLE(b), b.hint?.title);
assert(b.stepsDone[0] && b.stepsDone[1] && b.stepsDone[2], "F2L still ok");

function STEPS_TITLE(r) {
  return r.stepIndex;
}

assert(formatClock(0) === "0.00", "clock zero");
assert(formatClock(12340) === "12.34", "clock seconds");
assert(formatClock(65020) === "1:05.02", "clock minutes");
assert(formatDelta(-1500).includes("faster"), "delta faster");

const t = createTimer();
armTimer(t);
startTimer(t, 0, 0);
noteProgress(t, {
  now: 2500,
  moveCount: 8,
  stepsDone: [true, false, false, false, false, false, false],
  solved: false,
});
assert(t.splits.length === 1, "one split");
assert(t.splits[0].ms === 2500, "cross split ms");
assert(t.splits[0].moves === 8, "cross split moves");

noteProgress(t, {
  now: 8000,
  moveCount: 30,
  stepsDone: [true, true, true, false, false, false, false],
  solved: false,
});
assert(t.splits.length === 3, "batch skips get 0");
assert(t.splits[1].ms === 0, "skipped corners 0");
assert(t.splits[2].ms === 5500, "middle gets the batch");
assert(t.splits[2].moves === 22, "middle moves");

noteProgress(t, {
  now: 9000,
  moveCount: 28,
  stepsDone: [true, false, false, false, false, false, false],
  solved: false,
});
assert(t.splits.length === 3, "broken step keeps first-occurrence splits");
assert(t.lastDone === 3, "lastDone does not recede");
assert(t.splits[0].ms === 2500, "cross split stays");
assert(elapsedMs(t, 9000) === 9000, "clock keeps running");

noteProgress(t, {
  now: 12000,
  moveCount: 40,
  stepsDone: [true, true, true, true, true, true, true],
  solved: true,
});
assert(t.phase === "done", "solve stops timer");
assert(t.splits.length === 7, "all seven splits");
assert(t.splits[0].ms === 2500, "first cross time kept through solve");
assert(t.endMs === 12000, "end time");

const analysis = buildAnalysis({
  totalMs: 12000,
  splits: t.splits,
  totalMoves: 40,
});
assert(analysis.slowest.ms >= 2500, "has slowest");
assert(analysis.groups.length === 3, "three groups");
assert(analysis.insights.length >= 2, "coaching insights");

const seeded = createTimer();
armTimer(seeded);
startTimer(seeded, 0, 0, 2);
assert(seeded.lastDone === 2 && seeded.splits.length === 2, "seed already-done steps");
assert(seeded.splits.every((s) => s.ms === 0), "seeded splits are 0");

console.log("ALL PASS");
