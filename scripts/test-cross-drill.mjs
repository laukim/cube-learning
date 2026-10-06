import { readFileSync } from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
globalThis.Cube = require("cubejs");

const { applyAlg, faceletsToString, isSolved, solvedFacelets, sticker } = await import("../js/cube.js");
const { whiteCrossDone } = await import("../js/cross-trainer.js");
const {
  CROSS_MOVE_NAMES,
  CROSS_STATE_COUNT,
  SOLVED_CROSS_INDEX,
  applyCrossMove,
  crossDistance,
  crossEdgesOffBottom,
  crossGodsNumber,
  crossIndexFromPermutation,
  crossIndexFromPlacement,
  crossPlacement,
  optimalCrossMoves,
  randomCrossCase,
  warmCrossSolver,
} = await import("../js/cross-solver.js");
const {
  addCrossDrillTime,
  loadCrossDrillTimes,
  renderCrossTimesList,
} = await import("../js/cross-drill.js");
const {
  TIMER_MODE_CROSS,
  addPracticeTime,
  applySplitTap,
  computeStats,
  loadPracticeTimes,
  loadTimerMode,
  memoryStore,
  renderStats,
  saveTimerMode,
} = await import("../js/practice-timer.js");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function centersStay(facelets) {
  return (
    sticker(facelets, "U", 4) === "yellow" &&
    sticker(facelets, "D", 4) === "white" &&
    sticker(facelets, "F", 4) === "blue" &&
    sticker(facelets, "B", 4) === "green" &&
    sticker(facelets, "L", 4) === "orange" &&
    sticker(facelets, "R", 4) === "red"
  );
}

function cubeOf(facelets) {
  return globalThis.Cube.fromString(faceletsToString(facelets));
}

function indexOf(facelets) {
  const cube = cubeOf(facelets);
  return crossIndexFromPermutation(cube.ep, cube.eo);
}

warmCrossSolver();
assert(CROSS_STATE_COUNT === 190080, "cross state space is the 4 edges");
assert(crossGodsNumber() === 8, "shortest white cross is at most 8 face turns");
assert(crossDistance(SOLVED_CROSS_INDEX) === 0, "solved cross is distance 0");
const home = crossPlacement(SOLVED_CROSS_INDEX);
assert(home.loc.join() === "4,5,6,7" && home.ori.join() === "0,0,0,0", "solved cross edges sit on the bottom");
assert(crossIndexFromPlacement(home.loc, home.ori) === SOLVED_CROSS_INDEX, "solved placement round-trips");

const rng = mulberry32(0xcf09);
for (let i = 0; i < 400; i++) {
  const index = Math.floor(rng() * CROSS_STATE_COUNT);
  const place = crossPlacement(index);
  assert(crossIndexFromPlacement(place.loc, place.ori) === index, `placement round-trip ${index}`);
}

assert(whiteCrossDone(solvedFacelets()), "a solved cube has a solved white cross");
assert(indexOf(solvedFacelets()) === SOLVED_CROSS_INDEX, "solved facelets match the solved cross index");

for (const move of CROSS_MOVE_NAMES) {
  const facelets = solvedFacelets();
  applyAlg(facelets, move);
  const index = indexOf(facelets);
  const distance = crossDistance(index);
  if (move[0] === "U") {
    assert(whiteCrossDone(facelets) && distance === 0, `${move} leaves a solved cross alone`);
    continue;
  }
  assert(!whiteCrossDone(facelets), `${move} from solved leaves the white cross unsolved`);
  assert(distance === 1, `${move} is one move from solved`);
  const solution = optimalCrossMoves(index).join(" ");
  assert(solution.split(" ").length === 1, `${move} optimal solution is one move`);
  applyAlg(facelets, solution);
  assert(whiteCrossDone(facelets) && isSolved(facelets), `${solution} undoes ${move}`);
}

const dCase = solvedFacelets();
applyAlg(dCase, "D");
assert(optimalCrossMoves(indexOf(dCase)).join(" ") === "D'", "D is solved by D' with white on the bottom");
const f2Case = solvedFacelets();
applyAlg(f2Case, "F2");
assert(!whiteCrossDone(f2Case), "F2 scrambles the cross");
assert(optimalCrossMoves(indexOf(f2Case)).join(" ") === "F2", "F2 is its own optimal cross solution");

let transitionMismatches = 0;
for (let sample = 0; sample < 40; sample++) {
  const crossCase = randomCrossCase(rng);
  const cube = new globalThis.Cube();
  cube.move(crossCase.scramble);
  const index = crossIndexFromPermutation(cube.ep, cube.eo);
  for (let move = 0; move < CROSS_MOVE_NAMES.length; move++) {
    const next = cube.clone();
    next.move(CROSS_MOVE_NAMES[move]);
    if (applyCrossMove(index, move) !== crossIndexFromPermutation(next.ep, next.eo)) transitionMismatches++;
  }
}
assert(transitionMismatches === 0, "solver moves match the real cube on every face turn");

function hasSolutionWithin(facelets, limit) {
  function search(current, depth, lastFace) {
    if (depth >= limit) return false;
    for (const move of CROSS_MOVE_NAMES) {
      if (move[0] === lastFace) continue;
      const next = current.slice();
      applyAlg(next, move);
      if (whiteCrossDone(next)) return true;
      if (depth + 1 < limit && search(next, depth + 1, move[0])) return true;
    }
    return false;
  }
  return search(facelets, 0, "");
}

const repeated = randomCrossCase(() => 0.2);
assert(randomCrossCase(() => 0.2).scramble === repeated.scramble, "the same random draw is the same case");

let offBottom = 0;
let deep = 0;
const cases = [];
for (let i = 0; i < 48; i++) cases.push(randomCrossCase(rng));

for (const crossCase of cases) {
  const tokens = crossCase.scramble.split(/\s+/).filter(Boolean);
  assert(tokens.length === crossCase.length, "scramble length is the optimal cross length");
  assert(crossCase.length >= 1 && crossCase.length <= 8, "a cross setup is a short optimal sequence");
  assert(crossCase.solution.split(/\s+/).length === crossCase.length, "solution and scramble are the same length");
  if (crossCase.length >= 6) deep++;

  const scrambled = solvedFacelets();
  applyAlg(scrambled, crossCase.scramble);
  assert(!whiteCrossDone(scrambled), "applying the scramble to a solved cube leaves the white cross unsolved");
  assert(!isSolved(scrambled), "the scramble changes the cube");
  assert(centersStay(scrambled), "white stays on the bottom and the centres do not move");
  const scrambledIndex = indexOf(scrambled);
  assert(scrambledIndex === crossCase.index, "scramble reaches the cross state it was built for");
  assert(crossDistance(scrambledIndex) === crossCase.length, "shown solution length is the minimum");
  assert(
    optimalCrossMoves(scrambledIndex).join(" ") === crossCase.solution,
    "re-solving the scrambled cube returns the shown solution"
  );
  if (crossEdgesOffBottom(cubeOf(scrambled).ep) > 0) offBottom++;

  if (crossCase.length > 1) {
    for (const move of CROSS_MOVE_NAMES) {
      const one = scrambled.slice();
      applyAlg(one, move);
      assert(!whiteCrossDone(one), `${crossCase.scramble} is not solved by one move`);
    }
  }
  if (crossCase.length > 2) {
    assert(!hasSolutionWithin(scrambled, 2), `${crossCase.scramble} has no 2-move cross solution`);
  }

  const solved = scrambled.slice();
  applyAlg(solved, crossCase.solution);
  assert(whiteCrossDone(solved), "the shown solution solves the white cross");
  assert(isSolved(solved), "the solution is the inverse of the scramble");
}

assert(offBottom > cases.length / 2, "random cases put white edges off the bottom layer");
assert(deep > 0, "cases include deep cross states, not a walk of a few random moves");

const bruteCase = cases.find((crossCase) => crossCase.length >= 4 && crossCase.length <= 5);
assert(bruteCase, "sample includes a 4- or 5-move cross");
const bruteFacelets = solvedFacelets();
applyAlg(bruteFacelets, bruteCase.scramble);
assert(
  !hasSolutionWithin(bruteFacelets, bruteCase.length - 1),
  `nothing shorter than ${bruteCase.length} moves solves ${bruteCase.scramble}`
);

const timerHtml = readFileSync(new URL("../timer.html", import.meta.url), "utf8");
assert(timerHtml.includes('data-timer-mode="cross"'), "timer page has a Cross drill mode");
assert(timerHtml.includes("Repeat this case") && timerHtml.includes(">Next<"), "repeat and next are on the timer");
assert(timerHtml.includes("Show optimal cross"), "optimal cross stays behind a button");
assert(timerHtml.includes("White on bottom, blue in front"), "the hold is white on the bottom");
assert(timerHtml.includes('id="cross-drill-solution" hidden'), "the solution is hidden until it is shown");

const store = memoryStore();
assert(saveTimerMode(TIMER_MODE_CROSS, store) === TIMER_MODE_CROSS, "saves cross drill mode");
assert(loadTimerMode(store) === TIMER_MODE_CROSS, "loads cross drill mode");
assert(saveTimerMode("nope", store) === "single", "unknown mode still falls back to single");
const crossTap = applySplitTap({ mode: TIMER_MODE_CROSS, marks: [], elapsed: 4200, lastTapElapsed: 0 });
assert(crossTap.action === "stop", "cross drill records one time and stops");

addPracticeTime({ ms: 25000, at: 1_700_000_000_000, scramble: "R U R' U'" }, store);
for (let i = 0; i < 12; i++) {
  addCrossDrillTime(
    {
      ms: 8000 + i * 100,
      at: 1_700_000_100_000 + i * 1000,
      scramble: "F2",
      solution: "SECRETALG",
      length: 1,
    },
    store
  );
}
const practice = loadPracticeTimes(store);
const crosses = loadCrossDrillTimes(store);
assert(practice.length === 1 && practice[0].ms === 25000, "cross times are not stored with solves");
assert(crosses.length === 12 && crosses.every((row) => row.ms < 10000), "cross times stay in their own list");
assert(crosses.every((row) => row.solution == null), "stored cross times do not keep the solution");
assert(computeStats(practice).count === 1 && computeStats(practice).ao5 == null, "one solve does not make an ao5");
const crossStats = computeStats(crosses);
assert(crossStats.ao5 === 8900, "cross ao5 uses only cross drill times");
assert(crossStats.ao12 != null && crossStats.ao12 < 10000, "cross ao12 stays under the cross times");
const statsHtml = renderStats(crossStats, null, { stages: false });
assert(statsHtml.includes(">ao5<") && statsHtml.includes(">ao12<"), "cross stats show ao5 and ao12");
assert(!statsHtml.includes('data-split-avg="f2l"'), "cross stats do not mix in F2L split averages");
const listHtml = renderCrossTimesList(crosses);
assert(listHtml.includes("F2") && !listHtml.includes("SECRETALG"), "the times list shows the scramble and not the solution");

console.log(
  `cross drill ok · god's number ${crossGodsNumber()} · ${cases.length} scrambles · ${offBottom} off the bottom`
);
