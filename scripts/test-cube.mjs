import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
globalThis.Cube = require("cubejs");

const { applyAlg, applyMove, scrambleCube, isSolved, solvedFacelets, sticker } = await import("../js/cube.js");
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
const { analyzeF2lFlow, formatF2lFlow, popBaselineIds, poppedSolvedSlots, scrambleF2L, getF2lDrillInfo, resetF2lDrill, shouldFlashPop, slotSolved, solvedSlotIds, stableSolvedSlotIds, whiteCrossIntact, SLOTS } = await import("../js/f2l-trainer.js");
const { F2L_DRILL_CASES } = await import("../js/f2l-cases.js");
const { invertAlg } = await import("../js/alg.js");
const {
  FLICK_HALF_TURN_DEG,
  FLICK_MIN_PX,
  FLICK_MOMENTUM_IDLE_MS,
  FLICK_MOMENTUM_MIN_ANGLE,
  FLICK_MOMENTUM_MIN_VELOCITY,
  ORBIT_REMAPS_FLICKS,
  ORBIT_SPEED,
  TAP_PX,
  snapFlickAngle,
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

// This 2:52 F2L: four slots one at a time, then R/B popped already-solved pairs.
const f2lFlow = analyzeF2lFlow(
  "R' U D' B L2 B R2 U' R2 L2 B D R' U B2 D2 L' R2 D2 B2 L' B' R2 F U'",
  "F U L L B' R L U' F' F' L L' L'",
  "U' B U U' U' B' U' F' U' U' F U' U' U' U' U' F' U F U U U L U2 U L' U U U B U U B' U U U' R' U U U R L' U L R' U' R R' U' R U' U' U' U' B U B' U U B U' B'"
);
assert(f2lFlow.inserts.map((x) => x.slot).join(" ") === "FR BL FL BR", "solved FR then BL then FL then BR");
assert(f2lFlow.inserts[0].trigger.endsWith("F' U F"), "FR insert is F' U F");
const flowLines = formatF2lFlow(f2lFlow).join("\n");
assert(flowLines.includes("first in:"), "report names the slot order");
assert(flowLines.includes("no pops") || flowLines.includes("popped"), "report always states pops or no pops");

// Timed 2:09 — short closing triggers looked like all connected; most were long setups.
const easySolve = analyzeF2lFlow(
  "R L F B D' U D B F' R2 F2 L2 F U2 R2 L2 U' F' R' U' D2 R2 D U' L'",
  "L L F' B U2 U' R B' L U2 U' L' U' L' L U B L' B'",
  "U U U R' U' U' R U' U' R' U R U' U' R U U R' U U R U' R' L U L' U' U L' U U' U' L U' L' U L U' U' L U L'"
);
assert(easySolve.pops.length === 0, "2:09 F2L had no pops");
assert(easySolve.inserts.map((x) => x.slot).join(" ") === "BR FR FL BL", "2:09 slot order");
assert(easySolve.inserts.filter((x) => x.easy).length === 1, "only BL was a clean easy insert");
assert(easySolve.inserts.filter((x) => x.setup).length === 3, "three pairs had longer setup");
const easyLines = formatF2lFlow(easySolve).join("\n");
assert(easyLines.includes("setup →"), "long setups are labeled, not shown as pure easy inserts");
assert(easyLines.includes("no pops"), "coach says no pops when none");
assert(easyLines.includes("1/4 easy insert"), "coach counts clean connected inserts");

// Official easy-insert cases stay tagged connected; disconnected do not.
assert(
  F2L_DRILL_CASES.filter((c) => c.group === "Easy insert").every(
    (c) => analyzeF2lFlow(c.setup, "", c.alg).inserts[0]?.easy
  ),
  "1R–2L count as easy connected inserts"
);
assert(
  F2L_DRILL_CASES.filter((c) => c.group === "Disconnected").every(
    (c) => !analyzeF2lFlow(c.setup, "", c.alg).inserts[0]?.easy
  ),
  "disconnected cases are not easy inserts"
);

const flowReport = formatSolveReport(
  {
    totalMs: 1000,
    totalMoves: 10,
    tps: 1,
    rows: [
      { index: 0, id: "white-cross", title: "White cross", ms: 100, moves: 2 },
      { index: 1, id: "f2l", title: "F2L pairs", ms: 900, moves: 8 },
    ],
    groups: [],
    slowest: { short: "F2L", title: "F2L", ms: 900, share: 0.9 },
    insights: [],
  },
  {
    scramble: "R' U D' B L2 B R2 U' R2 L2 B D R' U B2 D2 L' R2 D2 B2 L' B' R2 F U'",
    splits: [
      { id: "white-cross", alg: "F U L L B' R L U' F' F' L L' L'", trace: [] },
      {
        id: "f2l",
        alg: "U' B U U' U' B' U' F' U' U' F U' U' U' U' U' F' U F U U U L U2 U L' U U U B U U B' U U U' R' U U U R L' U L R' U' R R' U' R U' U' U' U' B U B' U U B U' B'",
        trace: [],
      },
    ],
  }
);
assert(flowReport.includes("first in: FR"), "coach report includes slot replay");

const solvedIds = solvedSlotIds(solvedFacelets());
assert(solvedIds.join(" ") === "FR BR BL FL", "solved cube has all four slots");
const afterF = solvedFacelets();
applyAlg(afterF, "F'");
const poppedByF = poppedSolvedSlots(solvedIds, afterF, "F'");
assert(poppedByF.includes("FR") && poppedByF.includes("FL"), "F' pops the two front pairs");
assert(poppedSolvedSlots(solvedIds, afterF, "U'").length === 0, "U does not count as a pop");
assert(poppedSolvedSlots(solvedIds, afterF, "y").length === 0, "cube rotation does not count as a pop");

const case11 = F2L_DRILL_CASES.find((c) => c.id === "11");
const open11 = solvedFacelets();
applyAlg(open11, case11.setup);
const prev11 = solvedSlotIds(open11);
assert(prev11.length === 3 && !prev11.includes("FR"), "11 leaves only FR open");
const afterInsertR = solvedFacelets();
applyAlg(afterInsertR, case11.setup);
applyMove(afterInsertR, "R");
assert(poppedSolvedSlots(prev11, afterInsertR, "R").length === 0, "R on empty FR is the insert, not a pop");
const afterDumpB = solvedFacelets();
applyAlg(afterDumpB, case11.setup);
applyMove(afterDumpB, "B");
assert(poppedSolvedSlots(prev11, afterDumpB, "B").includes("BL"), "B on empty FR dumps BL");
const dumpFlow = analyzeF2lFlow(case11.setup, "", "B");
assert(dumpFlow.pops.some((p) => p.slot === "BL"), "coach counts B on 11 as a real pop");

// Sledge / white-up algs briefly look solved mid-move while the cross is broken.
// That phantom must not close the open slot or the next R' flashes a false pop.
// Sledge is an extra way on case 1, not its own drill ID.
const sledgeAlg = "F R' F' R";
const sledgeSetup = invertAlg(sledgeAlg);
const midSledge = solvedFacelets();
applyAlg(midSledge, sledgeSetup);
applyMove(midSledge, "F");
assert(!whiteCrossIntact(midSledge), "sledge F breaks the cross");
assert(slotSolved(midSledge, SLOTS.find((s) => s.id === "FR")), "sledge F can make FR look solved");
assert(stableSolvedSlotIds(midSledge) === null, "phantom solve is not stable");
const sledgeFlow = analyzeF2lFlow(sledgeSetup, "", sledgeAlg);
assert(sledgeFlow.pops.length === 0, "sledge does not count as popping");
assert(sledgeFlow.inserts.map((x) => x.slot).join(" ") === "FR", "sledge inserts FR once at the end");
let falsePopAlgs = 0;
for (const c of F2L_DRILL_CASES) {
  if (analyzeF2lFlow(c.setup, "", c.alg).pops.length) falsePopAlgs += 1;
}
assert(falsePopAlgs === 0, "no official F2L alg should flash a pop");
const baseline = popBaselineIds(midSledge, ["BR", "BL", "FL"]);
assert(baseline.join(" ") === "BR BL FL", "mid-alg baseline keeps FR open from last stable");
const afterSledgeR = solvedFacelets();
applyAlg(afterSledgeR, sledgeSetup);
applyMove(afterSledgeR, "F");
applyMove(afterSledgeR, "R'");
assert(poppedSolvedSlots(baseline, afterSledgeR, "R'").length === 0, "sledge R' after phantom F is not a pop");

assert(F2L_DRILL_CASES.length === 41, "CubeHead’s 41 filmed cases");
assert(F2L_DRILL_CASES[0].id === "1R" && F2L_DRILL_CASES[1].id === "1L", "order is 1R then 1L");
assert(F2L_DRILL_CASES[2].id === "2R" && F2L_DRILL_CASES[3].id === "2L", "then 2R / 2L");
assert(F2L_DRILL_CASES.find((c) => c.id === "1R").alg === "U R U' R'", "1R is CubeHead 1 (sexy), not sledge");
assert(F2L_DRILL_CASES.find((c) => c.id === "1L").alg === "U' L' U L", "1L is CubeHead 2");
assert(F2L_DRILL_CASES.find((c) => c.id === "2R").alg === "R U R'", "2R is CubeHead 3 (split insert)");
assert(F2L_DRILL_CASES.find((c) => c.id === "2L").alg === "L' U' L", "2L is CubeHead 4");
assert(F2L_DRILL_CASES.find((c) => c.id === "3R").group === "Disconnected", "disconnected starts at 3R");
assert(F2L_DRILL_CASES.find((c) => c.id === "7R").group === "Disconnected", "disconnected runs through 7");
assert(F2L_DRILL_CASES.find((c) => c.id === "8R").group === "Corner in slot", "8R is first corner-in-slot");
assert(F2L_DRILL_CASES.find((c) => c.id === "11").group === "Edge in slot", "11 is first edge-in-slot (no L twin)");
assert(
  F2L_DRILL_CASES.find((c) => c.id === "11").alg === "U R U' R' U R U' R' U R U' R'",
  "11 is CubeHead’s first edge-in-slot (solved edge, white up)"
);
assert(
  F2L_DRILL_CASES.find((c) => c.id === "12").alg === "U' R' F R F' R U' R'",
  "12 is the flipped-edge sledge, CubeHead’s second edge-in-slot"
);
assert(!F2L_DRILL_CASES.some((c) => c.id === "11R" || c.id === "11L"), "no L twin → ID is 11, not 11R");
assert(F2L_DRILL_CASES.find((c) => c.id === "17R").group === "Connected", "connected pairs start at 17");
assert(F2L_DRILL_CASES.find((c) => c.id === "22").group === "Both in slot", "both-in-slot starts at 22");
assert(!F2L_DRILL_CASES.some((c) => c.id === "22R" || c.id === "22L"), "both-in-slot has no L twin");
assert(F2L_DRILL_CASES.at(-1).id === "26", "last case is 26");
for (const c of F2L_DRILL_CASES) {
  const twin = F2L_DRILL_CASES.some((o) => o.n === c.n && o.hand !== c.hand);
  if (twin) assert(/^\d+[RL]$/.test(c.id), `${c.id} is a twin so it keeps R/L`);
  else assert(c.id === String(c.n), `${c.n} has no L twin so the ID is just ${c.n}`);
}
for (const c of F2L_DRILL_CASES) {
  const cube = solvedFacelets();
  applyAlg(cube, c.setup);
  assert(whiteCrossIntact(cube), `${c.id} keeps the white cross`);
  const unsolved = SLOTS.filter((s) => !slotSolved(cube, s)).map((s) => s.id);
  assert(unsolved.length === 1 && unsolved[0] === c.slot, `${c.id} only breaks ${c.slot}`);
  applyAlg(cube, c.alg);
  assert(SLOTS.every((s) => slotSolved(cube, s)), `${c.id} alg inserts the pair`);
}

function setEq(a, b) {
  return a.size === b.size && [...a].every((x) => b.has(x));
}
function relativeF2lKey(facelets, slot) {
  const side = slot === "FR" ? "R" : "L";
  const fc = sticker(facelets, "F", 4);
  const rc = sticker(facelets, side, 4);
  const corners =
    slot === "FR"
      ? [
          ["slot", ["D", 2], ["F", 8], ["R", 6]],
          ["U-slot", ["U", 8], ["R", 0], ["F", 2]],
          ["U-right", ["U", 2], ["B", 0], ["R", 2]],
          ["U-back", ["U", 0], ["L", 0], ["B", 2]],
          ["U-left", ["U", 6], ["F", 0], ["L", 2]],
        ]
      : [
          ["slot", ["D", 0], ["F", 6], ["L", 8]],
          ["U-slot", ["U", 6], ["F", 0], ["L", 2]],
          ["U-right", ["U", 0], ["L", 0], ["B", 2]],
          ["U-back", ["U", 2], ["B", 0], ["R", 2]],
          ["U-left", ["U", 8], ["R", 0], ["F", 2]],
        ];
  const edges =
    slot === "FR"
      ? [
          ["slot", ["F", 5], ["R", 3]],
          ["UF", ["U", 7], ["F", 1]],
          ["UR", ["U", 5], ["R", 1]],
          ["UB", ["U", 1], ["B", 1]],
          ["UL", ["U", 3], ["L", 1]],
        ]
      : [
          ["slot", ["F", 3], ["L", 5]],
          ["UF", ["U", 7], ["F", 1]],
          ["UR", ["U", 3], ["L", 1]],
          ["UB", ["U", 1], ["B", 1]],
          ["UL", ["U", 5], ["R", 1]],
        ];
  const ct = new Set(["white", fc, rc]);
  const et = new Set([fc, rc]);
  const corner = corners.find((c) => setEq(new Set(c.slice(1).map(([a, i]) => sticker(facelets, a, i))), ct));
  const edge = edges.find((c) => setEq(new Set(c.slice(1).map(([a, i]) => sticker(facelets, a, i))), et));
  let cOri = "?";
  if (corner) {
    for (const [a, i] of corner.slice(1)) {
      if (sticker(facelets, a, i) === "white") {
        cOri = a === "D" || a === "U" || a === "F" ? a : "S";
        break;
      }
    }
  }
  let eOri = "?";
  if (edge) {
    const [a, i] = edge[1];
    const col = sticker(facelets, a, i);
    if (edge[0] === "slot") eOri = col === fc ? "F" : "S";
    else if (a === "U") eOri = col === fc ? "U" : "S";
    else eOri = col === fc ? "F" : "S";
  }
  return `${corner?.[0]}:${cOri}|${edge?.[0]}:${eOri}`;
}
const relByN = new Map();
for (const c of F2L_DRILL_CASES) {
  const cube = solvedFacelets();
  applyAlg(cube, c.setup);
  const key = relativeF2lKey(cube, c.slot);
  if (c.hand === "R") {
    assert(c.slot === "FR", `${c.id} is red-green front-right`);
    relByN.set(c.n, key);
  } else {
    assert(c.slot === "FL", `${c.id} is green-orange front-left`);
    assert(key === relByN.get(c.n), `${c.id} is the same case as ${c.n}R, not a different hold`);
  }
}
const seenRel = new Map();
for (const [n, key] of relByN) {
  assert(!seenRel.has(key), `case ${n} duplicates case ${seenRel.get(key)} (${key})`);
  seenRel.set(key, n);
}
assert(relByN.size === 26, "26 distinct R shapes (some CubeHead numbers are L-only twins)");

const drill = solvedFacelets();
scrambleF2L(drill, "next");
assert(getF2lDrillInfo().id === "1R", "first Next F2L is 1R");
scrambleF2L(drill, "again");
assert(getF2lDrillInfo().id === "1R", "Again stays on 1R");
scrambleF2L(drill, "next");
assert(getF2lDrillInfo().id === "1L", "next in order is 1L");
scrambleF2L(drill, "prev");
assert(getF2lDrillInfo().id === "1R", "Prev from 1L returns to 1R");
scrambleF2L(drill, "again");
assert(getF2lDrillInfo().id === "1R", "Again stays on 1R after Prev");

resetF2lDrill();
const ids = [];
for (const mode of ["next", "next", "next", "prev", "prev", "next", "next"]) {
  scrambleF2L(drill, mode);
  ids.push(getF2lDrillInfo().id);
}
assert(ids.join(" ") === "1R 1L 2R 1L 1R 1L 2R", `Prev/Next stay in CubeHead order, got ${ids.join(" ")}`);

resetF2lDrill();
scrambleF2L(drill, "next");
scrambleF2L(drill, "prev");
scrambleF2L(drill, "prev");
scrambleF2L(drill, "prev");
assert(getF2lDrillInfo().id === "1R", "Prev does not wrap from 1R to 26");
scrambleF2L(drill, "next");
assert(getF2lDrillInfo().id === "1L", "Next after extra Prevs is still 1L, not a wrap jump");

resetF2lDrill();
scrambleF2L(drill, "random");
const afterRandom = getF2lDrillInfo();
scrambleF2L(drill, "next");
const afterRandomNext = getF2lDrillInfo();
const expectNext = F2L_DRILL_CASES[(afterRandom.index + 1) % F2L_DRILL_CASES.length].id;
assert(afterRandomNext.id === expectNext, `Next after Random stays list order (${afterRandom.id} → ${expectNext}), got ${afterRandomNext.id}`);
scrambleF2L(drill, "prev");
if (afterRandom.index < F2L_DRILL_CASES.length - 1) {
  assert(getF2lDrillInfo().id === afterRandom.id, "Prev after that Random+Next returns to the random case, not a shuffle");
}

assert(shouldFlashPop("guide", { timerPhase: "running", lastDone: 1 }) === true, "POP flash during timed full-cube F2L");
assert(shouldFlashPop("guide", { timerPhase: "idle", lastDone: 1 }) === false, "no POP flash until the full-cube timer runs");
assert(shouldFlashPop("guide", { timerPhase: "running", lastDone: 2 }) === false, "no POP flash after F2L is done on a full solve");
assert(shouldFlashPop("guide", { timerPhase: "running", lastDone: 1, f2lLocked: true }) === false, "no POP flash once all four pairs have been in");
for (const mode of ["f2l", "cross", "oll", "pll", "match", "algs"]) {
  assert(shouldFlashPop(mode, { timerPhase: "running", lastDone: 1 }) === false, `no POP flash in ${mode} training`);
}

// Phone UX contracts — 21af0db flick deadzone + look-only orbit (f8630ef).
// Inferring y on the same touch as a face flick remapped R/L′ into D/D′.
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mainSrc = readFileSync(join(root, "js/main.js"), "utf8");
assert(mainSrc.includes("shouldFlashPop(appMode"), "live POP flash uses the Guide-only gate");
assert(!mainSrc.includes('watchDrill = appMode === "f2l"'), "F2L drill must not subscribe to the POP overlay");
assert(!mainSrc.includes("setF2lRandom"), "Next F2L is not a sticky random mode");
assert(mainSrc.includes('scrambleF2L(draft, "random")'), "Random is a one-shot jump");

assert(FLICK_MIN_PX === 28, "verified flick deadzone is 28px, not a looser twitch");
assert(TAP_PX === 10, "tap snap-back stays 10px");
assert(ORBIT_SPEED === 0.008, "look-around speed matches last good orbit");
assert(ORBIT_REMAPS_FLICKS === false, "orbit must never rewrite a face flick");
assert(FLICK_MOMENTUM_IDLE_MS === 150, "paused finger must drop flick momentum");
assert(FLICK_MOMENTUM_MIN_VELOCITY === 0.55, "momentum velocity floor stays ERNO's");
assert(FLICK_MOMENTUM_MIN_ANGLE === 0.2, "momentum still ignores tiny twists");
assert(FLICK_HALF_TURN_DEG === 150, "half turns need a clear ~150° drag, not Math.round’s 135°");

const q = Math.PI / 2;
// Slow intentional R (~90°) must stay R even if avg velocity looks "fast".
assert(
  Math.abs(snapFlickAngle(q * 1.05, { velocity: 0.9, idleMs: 0 }) - q) < 1e-9,
  "near-90° drag snaps to 90°, not momentum-boosted 180° (R→R2 bug)"
);
assert(
  Math.abs(snapFlickAngle(q * 0.95, { velocity: 0.9, idleMs: 40 }) - q) < 1e-9,
  "just-under-90° still rounds to R, never R2"
);
assert(
  Math.abs(snapFlickAngle(q, { velocity: 0.9, idleMs: 400 }) - q) < 1e-9,
  "lift after a long pause at ~90° stays a single turn"
);
assert(
  Math.abs(snapFlickAngle(q * 0.35, { velocity: 0.9, idleMs: 20 }) - q) < 1e-9,
  "fast incomplete flick still commits one quarter turn"
);
assert(
  Math.abs(snapFlickAngle(q * 0.35, { velocity: 0.9, idleMs: 400 })) < 1e-9,
  "incomplete flick after a pause cancels instead of forcing a turn"
);
assert(
  Math.abs(snapFlickAngle(q * 1.5, { velocity: 1.5, idleMs: 0 }) - q) < 1e-9,
  "quick flick past Math.round’s 135° cliff still stays a single turn"
);
assert(
  Math.abs(snapFlickAngle(q * 1.6, { velocity: 1.5, idleMs: 0 }) - q) < 1e-9,
  "quick ~144° overshoot (common U→U2 false positive) stays U, not U2"
);
assert(
  Math.abs(snapFlickAngle(q * (150 / 90), { velocity: 0.2, idleMs: 0 }) - Math.PI) < 1e-9,
  "clear 150° drag still snaps to a half turn"
);
assert(
  Math.abs(snapFlickAngle(q * 1.8, { velocity: 0.2, idleMs: 400 }) - Math.PI) < 1e-9,
  "real overshoot well past 150° still snaps to R2"
);
assert(
  Math.abs(snapFlickAngle(-q * 1.05, { velocity: 0.9, idleMs: 0 }) + q) < 1e-9,
  "CCW near-90° stays a single prime turn"
);
assert(
  Math.abs(snapFlickAngle(-q * 1.6, { velocity: 1.5, idleMs: 0 }) + q) < 1e-9,
  "quick CCW overshoot stays a single prime turn"
);

assert(twistToMove({ command: "R", degrees: 90 }) === "R", "R flick logs as R");
assert(twistToMove({ command: "R", degrees: 180 }) === "R2", "180° flick logs as R2");
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

// Vendored ERNO used to momentum-boost any high avg-velocity drag by +90°, so a
// slow R that already sat near 90° became R2 on lift. Momentum must only promote
// an incomplete flick (snap === 0), and only if the finger was still moving.
// Half turns also used Math.round’s 135° cliff — prefer 90° until ~150°.
const vendorSrc = readFileSync(join(root, "vendor/erno.js"), "utf8");
assert(
  vendorSrc.includes("0===d&&150>G-B") &&
    vendorSrc.includes("d=0<C?0.5*Math.PI:-0.5*Math.PI") &&
    !vendorSrc.includes("d=Math.floor(C/Math.PI*2)*Math.PI*0.5,d+=0<w.dot(v.normalize())?0.5*Math.PI:0"),
  "ERNO release must not boost an already-rounded quarter turn into a half turn"
);
assert(
  vendorSrc.includes("H<J*150/90") &&
    !vendorSrc.includes("d=Math.round(C/Math.PI*2)*Math.PI*0.5"),
  "ERNO release must prefer 90° until a clear 150° drag (quick U→U2 fix)"
);
assert(
  vendorSrc.includes("B=z,y.active=!0") && vendorSrc.includes(",B="),
  "ERNO tracks last pointer-move time so a pause before lift drops momentum"
);

console.log("ALL PASS");
