import { readFileSync } from "node:fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
globalThis.Cube = require("cubejs");

const { applyAlg, isSolved, stringToFacelets } = await import("../js/cube.js");
const { expandWideAlg } = await import("../js/alg.js");
const {
  GOAL_MIN_SAMPLES,
  STARTER_GOAL_MS,
  STREAK_DOTS,
  addTrainingTime,
  builtinTrainingSets,
  caseKey,
  caseTarget,
  caseTimeStats,
  catalogIds,
  chooseAlg,
  createTrainingSet,
  goalForCase,
  groupCount,
  listOllCases,
  listPllCases,
  loadTrainingSets,
  loadTrainingTimes,
  nextStreak,
  normalizeCaseIds,
  pickTrainingCase,
  replaceTrainingSet,
  saveTrainingSets,
  saveTrainingTimes,
  toggleCaseId,
  trailingStreak,
  trainingCubeDecision,
  trainingPool,
  withoutTrainingSet,
} = await import("../js/training-queue.js");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function memoryStore(seed = {}) {
  const data = { ...seed };
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = String(value);
    },
  };
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

const oll = listOllCases();
const pll = listPllCases();
assert(oll.length === 10, "training OLL is the 10 2-look cases");
assert(pll.length === 21, "training PLL is the 21 trainer cases");
assert(oll[0].id === "line" && oll.some((entry) => entry.id === "sune"), "OLL keeps line then the corner algs");
assert(pll.some((entry) => entry.id === "t") && pll.some((entry) => entry.id === "aa"), "PLL includes T and Aa");
assert(new Set(oll.map(caseKey)).size === oll.length, "OLL keys are unique");
assert(new Set([...oll, ...pll].map(caseKey)).size === oll.length + pll.length, "OLL and PLL keys do not collide");

for (const entry of [...oll, ...pll]) {
  assert(entry.diagram, `${entry.set} ${entry.id} has a diagram`);
  assert(entry.algs.length === 1, `${entry.set} ${entry.id} stores one alg`);
  const target = caseTarget(entry);
  assert(target.facelets.length === 54, `${entry.set} ${entry.id} has setup facelets`);
  const facelets = stringToFacelets(target.facelets);
  assert(!isSolved(facelets), `${entry.set} ${entry.id} setup is not already solved`);
  applyAlg(facelets, expandWideAlg(entry.alg));
  assert(isSolved(facelets), `${entry.set} ${entry.id} alg solves its setup`);
}

const line = oll.find((entry) => entry.id === "line");
const lineEdges = [1, 5, 7, 3].filter((index) => line.diagram.cells[index] === "yellow");
assert(lineEdges.length === 2, "line OLL diagram keeps two yellow edges");
const dot = oll.find((entry) => entry.id === "dot");
assert(dot.diagram.cells.every((cell) => cell !== "yellow"), "dot OLL diagram has no yellow corners or edges");
assert(chooseAlg(line, "missing").id === "primary", "an unknown alg id falls back to the stored alg");
const doubled = {
  ...line,
  algs: [
    { id: "primary", label: "A", alg: line.alg },
    { id: "alt", label: "B", alg: "R U R' U R U2 R'" },
  ],
};
assert(chooseAlg(doubled, "alt").label === "B", "the picker can select a second alg");
assert(caseTarget(doubled, "alt").alg.startsWith("R U R'"), "the selected alg is the one inverted");

assert(normalizeCaseIds("pll", ["nope", "t", "t", "aa", "ua2"]).join() === "t,aa", "unknown PLL ids are dropped and order follows the catalog");
assert(toggleCaseId("oll", ["sune"], "sune").includes("sune") === false, "toggle removes a selected OLL case");
assert(toggleCaseId("oll", ["sune"], "pi").includes("pi"), "toggle adds an OLL case");
assert(toggleCaseId("oll", ["sune"], "aa").join() === "sune", "a PLL id does not enter the OLL selection");

const builtins = builtinTrainingSets();
assert(groupCount(builtins[0], "oll") === 10 && groupCount(builtins[1], "pll") === 21, "builtin cards use the full catalogs");
const store = memoryStore();
const custom = createTrainingSet(
  { name: "  edges  ", order: "weakest", groups: [{ set: "pll", caseIds: ["z", "h", "nope"] }, { set: "oll", caseIds: ["dot"] }] },
  builtins
);
assert(custom.name === "edges" && custom.order === "weakest", "custom set keeps the name and order");
assert(custom.groups[0].set === "oll" && custom.groups[0].caseIds.join() === "dot", "groups are saved OLL then PLL in catalog order");
assert(custom.groups[1].caseIds.join() === "h,z", "PLL ids are sorted into catalog order");
let sets = saveTrainingSets([...replaceTrainingSet(builtins, { id: "pll", order: "fixed" }), custom], store);
assert(sets.find((entry) => entry.id === "pll").order === "fixed", "builtin PLL order is remembered");
assert(sets.find((entry) => entry.id === "pll").groups[0].caseIds.length === 21, "a saved builtin cannot shrink the PLL list");
assert(sets.some((entry) => entry.id === custom.id), "the custom set round-trips");
sets = saveTrainingSets(withoutTrainingSet(sets, custom.id), store);
assert(!loadTrainingSets(store).some((entry) => entry.id === custom.id), "deleting a custom set forgets it");
assert(loadTrainingSets(store).some((entry) => entry.id === "oll"), "OLL stays after a custom delete");
assert(withoutTrainingSet(sets, "oll").some((entry) => entry.id === "oll"), "builtin OLL cannot be deleted");

const pool = trainingPool({
  id: "mix",
  groups: [
    { set: "oll", caseIds: ["t", "sune"] },
    { set: "pll", caseIds: ["t", "aa"] },
  ],
});
assert(pool.map(caseKey).join() === "oll:t,oll:sune,pll:t,pll:aa", "a mixed pool keeps OLL and PLL apart");
const fixed = [];
let cursor = 0;
let previous = "";
for (let i = 0; i < 5; i += 1) {
  const picked = pickTrainingCase({ pool, order: "fixed", cursor, previousKey: previous });
  fixed.push(caseKey(picked.trainingCase));
  cursor = picked.cursor;
  previous = caseKey(picked.trainingCase);
}
assert(fixed.join() === "oll:t,oll:sune,pll:t,pll:aa,oll:t", "fixed order walks the pool and wraps");

const random = mulberry32(3);
const seen = new Set();
previous = "";
for (let i = 0; i < 30; i += 1) {
  const picked = pickTrainingCase({ pool, order: "random", previousKey: previous, random });
  const key = caseKey(picked.trainingCase);
  if (previous) assert(key !== previous, "random does not repeat the case just shown");
  seen.add(key);
  previous = key;
}
assert(seen.size === pool.length, "random eventually reaches every case in the pool");

const stats = caseTimeStats([
  { set: "pll", caseId: "t", ms: 2000 },
  { set: "pll", caseId: "t", ms: 4000 },
  { set: "oll", caseId: "sune", ms: 9000 },
  { set: "pll", caseId: "aa", ms: 3000 },
]);
assert(stats.get("pll:t").mean === 3000 && stats.get("pll:t").best === 2000, "case stats use mean and best");
assert(stats.get("oll:t") == null, "PLL T times are not OLL T times");
const weak = pickTrainingCase({ pool, order: "weakest", previousKey: "", stats });
assert(caseKey(weak.trainingCase) === "oll:t", "a case with no times is weaker than a timed one");
const weakAgain = pickTrainingCase({ pool, order: "weakest", previousKey: "oll:t", stats });
assert(caseKey(weakAgain.trainingCase) === "oll:sune", "weakest then picks the slowest timed case");

const freshGoal = goalForCase([], "oll", "sune");
assert(freshGoal.source === "starter" && freshGoal.ms === STARTER_GOAL_MS.oll, "a new OLL case uses the starter goal");
const samples = Array.from({ length: GOAL_MIN_SAMPLES }, (_, index) => ({
  set: "pll",
  caseId: "t",
  ms: 1000 * (index + 1),
}));
const medianGoal = goalForCase(samples, "pll", "t");
assert(medianGoal.source === "median" && medianGoal.ms === 2000, "three times replace the starter with the median");

let streak = nextStreak(0, 1500, 2000);
assert(streak.filled === 1 && streak.dots === STREAK_DOTS, "a solve under the goal fills one streak dot");
streak = nextStreak(streak.streak, 1500, 2000);
streak = nextStreak(streak.streak, 1500, 2000);
streak = nextStreak(streak.streak, 1500, 2000);
streak = nextStreak(streak.streak, 1500, 2000);
assert(streak.streak === 5 && streak.filled === STREAK_DOTS, "dots cap while the streak keeps counting");
assert(nextStreak(streak.streak, 2500, 2000).streak === 0, "a miss clears the streak");

const history = addTrainingTime([], {
  set: "pll",
  caseId: "t",
  setId: "pll",
  ms: 1000,
  underGoal: true,
  mode: "drill",
});
const history2 = addTrainingTime(history, {
  set: "pll",
  caseId: "aa",
  setId: "pll",
  ms: 1000,
  underGoal: true,
});
const history3 = addTrainingTime(history2, {
  set: "oll",
  caseId: "sune",
  setId: "oll",
  ms: 1000,
  underGoal: true,
});
assert(trailingStreak(history3, "pll") === 2, "streak follows one training set");
const missed = addTrainingTime(history3, { set: "pll", caseId: "t", setId: "pll", ms: 9000, underGoal: false });
assert(trailingStreak(missed, "pll") === 0, "a miss ends the saved streak");
const kept = saveTrainingTimes(
  addTrainingTime(missed, { set: "nope", caseId: "t", ms: 1000, underGoal: true }),
  memoryStore()
);
assert(kept.length === missed.length, "a time for an unknown set is dropped");
assert(loadTrainingTimes(memoryStore({ "cube-coach-training-times": "[]" })).length === 0, "empty times load");
assert(typeof expandWideAlg === "function", "wide moves stay available to the setup");

const target = caseTarget(pll.find((entry) => entry.id === "t")).facelets;
assert(trainingCubeDecision({ facelets: target, target, phase: "idle" }).action === "arm", "matching the setup arms");
assert(
  trainingCubeDecision({ phase: "idle", armed: true, move: "R" }).action === "start",
  "the first turn after arming starts"
);
assert(
  trainingCubeDecision({ phase: "running", solved: true, sawMove: true, facelets: "U".repeat(54) }).action === "stop",
  "a solved cube stops the case"
);
assert(
  trainingCubeDecision({ phase: "idle", awaitingNext: true, move: "U" }).action === "deal",
  "a turn after success deals the next case"
);
assert(
  trainingCubeDecision({ phase: "idle", awaitingNext: true, facelets: target, target }).action === "ignore",
  "facelets alone do not skip ahead while the next case is waiting"
);
assert(
  trainingCubeDecision({ phase: "running", move: "U", awaitingNext: false }).action === "log",
  "turns during the solve are logged, not a new case"
);

const page = readFileSync("training.html", "utf8");
assert(page.includes('href="/training"'), "training nav points at /training");
assert(page.includes('styles.css?v=training4'), "training css is cache-busted");
assert(page.includes('js/training-page.js?v=training2'), "training script is cache-busted");
assert(page.includes('id="training-session"') && page.includes('id="training-picker"'), "training has a session and a case picker");
assert(page.includes("data-session-mode=\"drill\"") && page.includes("data-session-mode=\"learn\""), "drill and learn are both on the session");
assert(page.includes('id="training-trace"') && page.includes('id="training-skip-setup"'), "live notation strip and skip setup are on the session");
assert(page.includes('id="training-trace-strip"'), "notation tokens render into a strip");
assert(!page.includes("Acubemy") && !/Match/.test(page), "training does not copy Acubemy or Match");
assert(readFileSync("index.html", "utf8").includes('href="/training"'), "the timer nav reaches Training");
assert(readFileSync("pll.html", "utf8").includes('href="/training"'), "the PLL nav reaches Training");

const {
  initAlgProgress,
  notationTokens,
  traceAlgMove,
  consumeAlgMove,
} = await import("../js/alg-progress.js");

const setup = initAlgProgress(expandWideAlg("F U R U' R' F'"));
assert(notationTokens(setup.remaining).join() === "F,U,R,U',R',F'", "setup tokens stay readable");
let step = traceAlgMove(setup.remaining, "F");
assert(step.matched && step.remaining.startsWith("U"), "a correct setup turn consumes the first move");
step = traceAlgMove(step.remaining, "R");
assert(step.wrong && step.wrongMove === "R" && step.remaining.startsWith("R'"), "a wrong turn rewrites remaining with the inverse first");
step = traceAlgMove(step.remaining, "R'");
assert(step.matched && step.remaining.startsWith("U"), "the fix move consumes and leaves the original remainder");
const wide = initAlgProgress(expandWideAlg("f R U R' U' f'"));
assert(notationTokens(wide.remaining)[0] === "F", "wide setup expands so outer-face turns can match");
assert(consumeAlgMove(wide.remaining, "F").matched, "expanded wide setup consumes F");

const pageJs = readFileSync("js/training-page.js", "utf8");
assert(pageJs.includes("traceAlgMove"), "training page advances the live notation strip");
assert(pageJs.includes("skipSetupTrace") && pageJs.includes("enterAlgTrace"), "skip setup jumps to algorithm tracing");
assert(pageJs.includes('tracePhase === "setup"'), "setup and alg phases are tracked");

console.log("training queue ok");
