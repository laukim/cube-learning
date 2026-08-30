import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
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
  formatSolveReport,
  findPauses,
  noteProgress,
  renderAnalysisHtml,
  startTimer,
} = await import("../js/solve-timer.js");
const {
  FLICK_MIN_PX,
  ORBIT_REMAPS_FLICKS,
  ORBIT_SPEED,
  TAP_PX,
} = await import("../js/erno-ux.js");
const { moveToErno, twistToMove, Y_CYCLE } = await import("../js/erno-view.js");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

let f = solvedFacelets();
assert(analyze(f).solved, "solved start");

f = solvedFacelets();
scrambleCube(f, 30);
const a = analyze(f);
assert(!a.solved, "scrambled");
assert(a.stepIndex >= 0 && a.stepIndex <= 5, "step range");
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
assert(b.stepsDone[0] && b.stepsDone[1], "F2L still ok");

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
  stepsDone: [true, false, false, false, false, false],
  solved: false,
});
assert(t.splits.length === 1, "one split");
assert(t.splits[0].ms === 2500, "cross split ms");
assert(t.splits[0].moves === 8, "cross split moves");

noteProgress(t, {
  now: 8000,
  moveCount: 30,
  stepsDone: [true, true, true, false, false, false],
  solved: false,
});
assert(t.splits.length === 3, "batch still records skipped steps");
assert(t.splits[1].ms === 5500, "F2L (the step they were on) gets the batch");
assert(t.splits[1].moves === 22, "F2L moves");
assert(t.splits[2].ms === 0, "lucky yellow-cross skip is 0");

noteProgress(t, {
  now: 9000,
  moveCount: 28,
  stepsDone: [true, false, false, false, false, false],
  solved: false,
});
assert(t.splits.length === 3, "broken step keeps first-occurrence splits");
assert(t.lastDone === 3, "lastDone does not recede");
assert(t.splits[0].ms === 2500, "cross split stays");
assert(elapsedMs(t, 9000) === 9000, "clock keeps running");

noteProgress(t, {
  now: 12000,
  moveCount: 40,
  stepsDone: [true, true, true, true, true, true],
  solved: true,
});
assert(t.phase === "done", "solve stops timer");
assert(t.splits.length === 6, "all six splits");
assert(t.splits[0].ms === 2500, "first cross time kept through solve");
assert(t.splits[3].ms === 4000, "Sune / yellow-face keeps time when PLL also completes");
assert(t.splits[4].ms === 0, "headlights skip does not steal Sune");
assert(t.endMs === 12000, "end time");

const sune = createTimer();
armTimer(sune);
startTimer(sune, 0, 0, 3);
noteProgress(sune, {
  now: 8530,
  moveCount: 19,
  stepsDone: [true, true, true, true, true, false],
  solved: false,
});
assert(sune.splits[3].id === "yellow-face", "fourth split is yellow face");
assert(sune.splits[3].ms === 8530, "Sune time lands on yellow face");
assert(sune.splits[3].moves === 19, "Sune moves land on yellow face");
assert(sune.splits[4].ms === 0 && sune.splits[4].moves === 0, "headlights not credited for Sune");

const analysis = buildAnalysis({
  totalMs: 12000,
  splits: t.splits,
  totalMoves: 40,
});
assert(analysis.slowest.ms >= 2500, "has slowest");
assert(analysis.groups.length === 4, "four groups");
assert(analysis.insights.length >= 2, "coaching insights");

const pauses = findPauses(
  [
    { move: "R", ms: 1000 },
    { move: "U", ms: 1500 },
    { move: "F", ms: 5200 },
  ],
  3000
);
assert(pauses.length === 1 && pauses[0].before === "F", "pause before F");

const report = formatSolveReport(analysis, {
  scramble: "R U F",
  solution: "F' U' R'",
  undos: 1,
  pauses,
});
assert(report.includes("Scramble: R U F"), "report scramble");
assert(report.includes("F' U' R'"), "report solution");
assert(report.includes("Undos: 1"), "report undos");
assert(report.includes("before F"), "report pause");

const { countNamedAlgs, countYTurns } = await import("../js/coach-report.js");
const suneHits = countNamedAlgs("R U R' U R U2 R' U R U R' U R U2 R'");
assert(suneHits.Sune === 2, "two Sunes");
assert(!suneHits.righty, "Sune is not counted as righty");
const bSune = countNamedAlgs("B U B' U B U2 B'");
assert(!bSune.Sune, "orbit-held Sune (B) is not the R-face Sune");
assert(countYTurns("R U R' y U y'") === 2, "y turns counted");
const tHits = countNamedAlgs("R U R' U' R' F R2 U' R' U' R U R' F'");
assert(tHits["T-perm"] === 1, "T-perm");
assert(!tHits.righty, "T-perm is not counted as righty");

const html = renderAnalysisHtml({ ...analysis, report, scramble: "R U F", solution: "F' U' R'" });
assert(html.includes("solve-report-text"), "report textarea");
assert(html.includes("R U F"), "html scramble");

const seeded = createTimer();
armTimer(seeded);
startTimer(seeded, 0, 0, 2);
assert(seeded.lastDone === 2 && seeded.splits.length === 2, "seed already-done steps");
assert(seeded.splits.every((s) => s.ms === 0), "seeded splits are 0");

// Phone UX contracts — 21af0db flick deadzone + look-only orbit (f8630ef).
// Inferring y on the same touch as a face flick remapped R/L′ into D/D′.
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

assert(FLICK_MIN_PX === 28, "verified flick deadzone is 28px, not a looser twitch");
assert(TAP_PX === 10, "tap snap-back stays 10px");
assert(ORBIT_SPEED === 0.008, "look-around speed matches last good orbit");
assert(ORBIT_REMAPS_FLICKS === false, "orbit must never rewrite a face flick");

assert(twistToMove({ command: "R", degrees: 90 }) === "R", "R flick logs as R");
assert(twistToMove({ command: "l", degrees: 90 }) === "L'", "L′ flick logs as L'");
assert(twistToMove({ command: "D", degrees: 90 }) === "D", "D stays D");
assert(twistToMove({ command: "d", degrees: 90 }) === "D'", "D′ stays D'");
assert(twistToMove({ command: "R", degrees: 90 }) !== "D", "R is not D");
assert(twistToMove({ command: "l", degrees: 90 }) !== "D'", "L′ is not D'");
assert(moveToErno("R") === "R" && moveToErno("L'") === "l", "ERNO face letters stay cube-fixed");
assert(Y_CYCLE.join("") === "FRBL", "y cycle is documentation only, not a flick remap");

const afterR = solvedFacelets();
applyAlg(afterR, "R");
const afterD = solvedFacelets();
applyAlg(afterD, "D");
assert(afterR !== afterD && JSON.stringify(afterR) !== JSON.stringify(afterD), "R and D scramble different stickers");

const afterLprime = solvedFacelets();
applyAlg(afterLprime, "L'");
const afterDprime = solvedFacelets();
applyAlg(afterDprime, "D'");
assert(
  JSON.stringify(afterLprime) !== JSON.stringify(afterDprime),
  "L′ and D′ are different turns"
);

// The live bug: inferred y under the finger made a spatial R/L′ commit as D/D′.
const afterYawThenR = solvedFacelets();
applyAlg(afterYawThenR, "y");
applyAlg(afterYawThenR, "R");
assert(
  JSON.stringify(afterYawThenR) !== JSON.stringify(afterD),
  "cube-fixed R after a y is not a D — do not snap y under a flick"
);

const ernoSrc = readFileSync(join(root, "js/erno-view.js"), "utf8");
assert(!ernoSrc.includes("absorbViewYawIntoY"), "must not infer y on pointer-down");
assert(!ernoSrc.includes("function extraYaw"), "must not measure orbit as a cube y");
assert(/getViewYaw:\s*\(\)\s*=>\s*0/.test(ernoSrc), "notation stays cube-fixed");
assert(
  ernoSrc.includes("if (!orbiting && dist < FLICK_MIN_PX)") &&
    ernoSrc.includes("suppressAccidentalFlick()"),
  "twitch filter still suppresses short sticker drags, not real flicks"
);
assert(
  ernoSrc.includes('import { FLICK_MIN_PX, ORBIT_SPEED, TAP_PX } from "./erno-ux.js"'),
  "deadzone is the shared tested constant"
);
assert(
  !/else if \(downPt\)\s*\{\s*absorb/.test(ernoSrc),
  "face-hit pointer-down must not twist the cube before the flick"
);

console.log("ALL PASS");
