/**
 * Ring map. One cube, drawn as colored beads on three families of circular
 * arcs. The families sit 120° apart and overlap like a trefoil, with an empty
 * curved triangle in the middle. Beads sit only where the arcs cross.
 * A face turn slides the beads along that face’s rings.
 */

import { invertAlgNotation } from "./alg.js";
import { applyMove, COLOR_HEX, FACES, isSolved, solvedFacelets } from "./cube.js";
import { createShortestPathSearch, PATH_LENGTHS, randomHtmScramble } from "./shortest-path.js";

const DEPTH_KEY = "cube-coach-path-depth";
const SVG_NS = "http://www.w3.org/2000/svg";

const ISO_FACES = [
  { face: "U", cls: "path-iso-u" },
  { face: "F", cls: "path-iso-f" },
  { face: "R", cls: "path-iso-r" },
];

/** Quarter-turn cycles of facelet slots. Sticker at cycle[i] moves to cycle[i+1]. */
const CYCLES = {
  U: [
    [0, 2, 8, 6],
    [1, 5, 7, 3],
    [9, 18, 36, 45],
    [10, 19, 37, 46],
    [11, 20, 38, 47],
  ],
  R: [
    [2, 51, 29, 20],
    [5, 48, 32, 23],
    [8, 45, 35, 26],
    [9, 11, 17, 15],
    [10, 14, 16, 12],
  ],
  F: [
    [6, 9, 29, 44],
    [7, 12, 28, 41],
    [8, 15, 27, 38],
    [18, 20, 26, 24],
    [19, 23, 25, 21],
  ],
  D: [
    [15, 51, 42, 24],
    [16, 52, 43, 25],
    [17, 53, 44, 26],
    [27, 29, 35, 33],
    [28, 32, 34, 30],
  ],
  L: [
    [0, 18, 27, 53],
    [3, 21, 30, 50],
    [6, 24, 33, 47],
    [36, 38, 44, 42],
    [37, 41, 43, 39],
  ],
  B: [
    [0, 42, 35, 11],
    [1, 39, 34, 14],
    [2, 36, 33, 17],
    [45, 47, 53, 51],
    [46, 50, 52, 48],
  ],
};

/** Which ring family a face slides along. 0 up/down, 1 right/left, 2 front/back. */
const FACE_FAMILY = { U: 0, D: 0, R: 1, L: 1, F: 2, B: 2 };

/**
 * Facelet slot → crossing index. Most face-turn cycles are four beads on one
 * ring, so a quarter turn is a slide to the next crossing.
 */
const SLOT_DOT = [
  29, 35, 6, 12, 8, 17, 11, 30, 24, 14, 13, 47, 37, 9, 40, 42, 0, 3, 33, 34, 38, 41, 26, 52, 51, 23, 20,
  25, 19, 7, 1, 27, 4, 10, 22, 28, 15, 5, 43, 53, 44, 48, 46, 16, 2, 32, 18, 50, 49, 45, 36, 39, 31, 21,
];

const BEAD_R = 17;

function svgEl(name, attrs) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

function intersect(c1, r1, c2, r2) {
  const dx = c2.x - c1.x;
  const dy = c2.y - c1.y;
  const d = Math.hypot(dx, dy);
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const xm = c1.x + (a * dx) / d;
  const ym = c1.y + (a * dy) / d;
  const rx = (-dy * h) / d;
  const ry = (dx * h) / d;
  if (h < 1e-8) return [{ x: xm, y: ym }];
  return [
    { x: xm + rx, y: ym + ry },
    { x: xm - rx, y: ym - ry },
  ];
}

function shortestAngle(a0, a1) {
  return Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0));
}

function quarterPerm(face) {
  const perm = Array.from({ length: 54 }, (_, i) => i);
  for (const cycle of CYCLES[face]) {
    for (let i = 0; i < 4; i++) perm[cycle[i]] = cycle[(i + 1) % 4];
  }
  return perm;
}

const QUARTER = Object.fromEntries(FACES.map((face) => [face, quarterPerm(face)]));

function composePerm(first, second) {
  return first.map((_, i) => second[first[i]]);
}

export function permForMove(move) {
  const face = move[0];
  const turns = move.endsWith("2") ? 2 : move.endsWith("'") ? 3 : 1;
  let perm = QUARTER[face];
  for (let i = 1; i < turns; i++) perm = composePerm(perm, QUARTER[face]);
  return perm;
}

function ringLanes(dots, center, ringIndexes) {
  const members = ringIndexes
    .map((index) => ({ index, angle: Math.atan2(dots[index].y - center.y, dots[index].x - center.x) }))
    .sort((a, b) => a.angle - b.angle);
  const gaps = members.map((member, i) => {
    const next = members[(i + 1) % members.length].angle;
    let gap = next - member.angle;
    if (i === members.length - 1) gap = next + Math.PI * 2 - member.angle;
    return gap;
  });
  let start = 0;
  for (let i = 1; i < gaps.length; i++) if (gaps[i] > gaps[start]) start = i;
  const order = members.slice(start + 1).concat(members.slice(0, start + 1));
  const groups = [[order[0]]];
  for (let i = 0; i < order.length - 1; i++) {
    let gap = order[i + 1].angle - order[i].angle;
    gap = ((gap % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    if (gap > 0.35) groups.push([order[i + 1]]);
    else groups[groups.length - 1].push(order[i + 1]);
  }
  const lanes = [];
  if (groups.length === 4 && groups.every((group) => group.length === 3)) {
    for (let lane = 0; lane < 3; lane++) lanes.push(groups.map((group) => group[lane].index));
  }
  return { lanes, angles: members.map((member) => member.angle) };
}

function cycleMatchesLane(cycle, lane, slotDot) {
  const placed = cycle.map((slot) => slotDot[slot]);
  for (const reversed of [false, true]) {
    const seq = reversed ? [...lane].reverse() : lane;
    for (let rot = 0; rot < 4; rot++) {
      if (seq.every((dot, i) => dot === placed[(i + rot) % 4])) return true;
    }
  }
  return false;
}

/** Crossings of three concentric-arc families, plus which facelet sits on each. */
export function createRingModel() {
  const reach = 180;
  const centers = [0, 1, 2].map((i) => {
    const angle = ((i * 120 - 90) * Math.PI) / 180;
    return { x: reach * Math.cos(angle), y: reach * Math.sin(angle) };
  });
  const side = Math.hypot(centers[0].x - centers[1].x, centers[0].y - centers[1].y);
  const radii = [0.8, 0.92, 1.05].map((frac) => frac * side);
  const dots = [];
  const onRing = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => []));
  for (let a = 0; a < 3; a++) {
    for (let b = a + 1; b < 3; b++) {
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          for (const point of intersect(centers[a], radii[i], centers[b], radii[j])) {
            const index = dots.length;
            dots.push(point);
            onRing[a][i].push(index);
            onRing[b][j].push(index);
          }
        }
      }
    }
  }

  const lanes = [[], [], []];
  const arcs = [];
  for (let family = 0; family < 3; family++) {
    for (let ring = 0; ring < 3; ring++) {
      const built = ringLanes(dots, centers[family], onRing[family][ring]);
      lanes[family].push(...built.lanes);
      const angles = built.angles.slice().sort((a, b) => a - b);
      let maxGap = -1;
      let maxAt = 0;
      for (let i = 0; i < angles.length; i++) {
        const next = i === angles.length - 1 ? angles[0] + Math.PI * 2 : angles[i + 1];
        const gap = next - angles[i];
        if (gap > maxGap) {
          maxGap = gap;
          maxAt = i;
        }
      }
      const start = angles[(maxAt + 1) % angles.length];
      const end = angles[maxAt];
      let sweep = (end - start + Math.PI * 2) % (Math.PI * 2);
      const margin = Math.min(0.28, maxGap * 0.18);
      arcs.push({
        cx: centers[family].x,
        cy: centers[family].y,
        r: radii[ring],
        a0: start - margin,
        sweep: Math.min(Math.PI * 2 - 0.02, sweep + margin * 2),
      });
    }
  }

  let goodCycles = 0;
  for (const face of FACES) {
    for (const cycle of CYCLES[face]) {
      if (lanes[FACE_FAMILY[face]].some((lane) => cycleMatchesLane(cycle, lane, SLOT_DOT))) goodCycles += 1;
    }
  }

  const faceStep = {};
  const slotPos = SLOT_DOT.map((dot) => dots[dot]);
  for (const face of FACES) {
    const center = centers[FACE_FAMILY[face]];
    const familyLanes = lanes[FACE_FAMILY[face]];
    const deltas = [];
    for (const cycle of CYCLES[face]) {
      if (!familyLanes.some((lane) => cycleMatchesLane(cycle, lane, SLOT_DOT))) continue;
      for (let i = 0; i < 4; i++) {
        const from = slotPos[cycle[i]];
        const to = slotPos[cycle[(i + 1) % 4]];
        const a0 = Math.atan2(from.y - center.y, from.x - center.x);
        const a1 = Math.atan2(to.y - center.y, to.x - center.x);
        const delta = shortestAngle(a0, a1);
        if (Math.abs(delta) < 2.15) deltas.push(delta);
      }
    }
    deltas.sort((a, b) => a - b);
    faceStep[face] = deltas.length ? deltas[Math.floor(deltas.length / 2)] : 1;
  }

  return { dots, centers, radii, arcs, slotDot: SLOT_DOT, slotPos, faceStep, goodCycles, lanes };
}

function arcPath(cx, cy, r, a0, sweep) {
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a0 + sweep);
  const y1 = cy + r * Math.sin(a0 + sweep);
  const large = sweep > Math.PI ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}

function buildRingMap(container, model) {
  const samples = [];
  for (const dot of model.dots) samples.push(dot);
  for (const arc of model.arcs) {
    samples.push(
      { x: arc.cx + arc.r * Math.cos(arc.a0), y: arc.cy + arc.r * Math.sin(arc.a0) },
      { x: arc.cx + arc.r * Math.cos(arc.a0 + arc.sweep), y: arc.cy + arc.r * Math.sin(arc.a0 + arc.sweep) },
    );
  }
  const pad = 46;
  const minX = Math.min(...samples.map((p) => p.x)) - pad;
  const minY = Math.min(...samples.map((p) => p.y)) - pad;
  const maxX = Math.max(...samples.map((p) => p.x)) + pad;
  const maxY = Math.max(...samples.map((p) => p.y)) + pad;
  const svg = svgEl("svg", { viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}` });
  const tracks = svgEl("g", { class: "path-rings", "aria-hidden": "true" });
  for (const arc of model.arcs) {
    tracks.appendChild(
      svgEl("path", {
        d: arcPath(arc.cx, arc.cy, arc.r, arc.a0, arc.sweep),
        class: "path-ring",
      }),
    );
  }
  svg.appendChild(tracks);
  const beads = svgEl("g", { class: "path-beads" });
  for (let slot = 0; slot < 54; slot++) {
    const point = model.slotPos[slot];
    beads.appendChild(
      svgEl("circle", {
        cx: point.x,
        cy: point.y,
        r: BEAD_R,
        "data-i": slot,
        class: "path-bead",
      }),
    );
  }
  svg.appendChild(beads);
  const travelers = svgEl("g", { class: "path-travelers" });
  svg.appendChild(travelers);
  container.replaceChildren(svg);
  return { svg, travelers };
}

function loadDepth() {
  try {
    const depth = Number(localStorage.getItem(DEPTH_KEY));
    if (PATH_LENGTHS.includes(depth)) return depth;
  } catch {
    /* private mode */
  }
  return PATH_LENGTHS[0];
}

function saveDepth(depth) {
  try {
    localStorage.setItem(DEPTH_KEY, String(depth));
  } catch {
    /* quota / private mode */
  }
}

function travelDelta(from, to, center, desired) {
  const a0 = Math.atan2(from.y - center.y, from.x - center.x);
  const a1 = Math.atan2(to.y - center.y, to.x - center.x);
  const base = shortestAngle(a0, a1);
  const k = Math.round((desired - base) / (Math.PI * 2));
  return { a0, delta: base + Math.PI * 2 * k, r0: Math.hypot(from.x - center.x, from.y - center.y), r1: Math.hypot(to.x - center.x, to.y - center.y) };
}

function pointOnTravel(center, travel, t) {
  const angle = travel.a0 + travel.delta * t;
  const radius = travel.r0 + (travel.r1 - travel.r0) * t;
  return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) };
}

function init() {
  const play = document.getElementById("path-play");
  const net = document.getElementById("path-net");
  const iso = document.getElementById("path-iso");
  const pad = document.getElementById("path-pad");
  const countEl = document.getElementById("path-count");
  const scrambleEl = document.getElementById("path-scramble");
  const playerEl = document.getElementById("path-player");
  const statusEl = document.getElementById("path-status");
  const undoBtn = document.getElementById("path-undo");
  const newBtn = document.getElementById("path-new");
  const showBtn = document.getElementById("path-show");
  const resultEl = document.getElementById("path-result");
  const headlineEl = document.getElementById("path-headline");
  const kickerEl = document.getElementById("path-kicker");
  const optimalEl = document.getElementById("path-optimal");
  const proofEl = document.getElementById("path-proof");
  const detourEl = document.getElementById("path-detour");
  const scoreEl = countEl?.parentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const model = createRingModel();
  const { travelers } = buildRingMap(net, model);

  const scene = document.createElement("div");
  scene.className = "path-iso-scene";
  for (const { face, cls } of ISO_FACES) {
    const faceEl = document.createElement("div");
    faceEl.className = `path-iso-face ${cls}`;
    const start = FACES.indexOf(face) * 9;
    for (let i = 0; i < 9; i++) {
      const cell = document.createElement("div");
      cell.className = "path-iso-cell";
      cell.dataset.i = String(start + i);
      faceEl.appendChild(cell);
    }
    scene.appendChild(faceEl);
  }
  iso.appendChild(scene);

  let depth = loadDepth();
  let phase = "play";
  let roundGen = 0;
  let scramble = "";
  let scrambleMoves = [];
  let facelets = solvedFacelets();
  let played = [];
  let optimal = null;
  let searchError = "";
  let revealed = false;
  let animating = false;
  let animFrame = 0;
  let slideGen = 0;

  function beads() {
    return net.querySelectorAll(".path-bead");
  }

  function paint() {
    travelers.replaceChildren();
    for (const bead of beads()) {
      bead.setAttribute("opacity", "1");
      const color = COLOR_HEX[facelets[Number(bead.dataset.i)]] || "#333";
      bead.setAttribute("fill", color);
    }
    iso.querySelectorAll("[data-i]").forEach((cell) => {
      cell.style.background = COLOR_HEX[facelets[Number(cell.dataset.i)]] || "#333";
    });
  }

  function cancelSlide() {
    slideGen += 1;
    if (animFrame) cancelAnimationFrame(animFrame);
    animFrame = 0;
    animating = false;
  }

  function slide(move, before, done) {
    const perm = permForMove(move);
    const face = move[0];
    const steps = move.endsWith("2") ? 2 : 1;
    const forward = !move.endsWith("'");
    const step = model.faceStep[face] || 1;
    const desired = (forward ? 1 : -1) * step * steps;
    const center = model.centers[FACE_FAMILY[face]];
    const moving = [];
    for (let slot = 0; slot < 54; slot++) {
      const dest = perm[slot];
      if (dest === slot) continue;
      const from = model.slotPos[slot];
      const to = model.slotPos[dest];
      moving.push({
        color: COLOR_HEX[before[slot]] || "#333",
        travel: travelDelta(from, to, center, desired),
        node: svgEl("circle", { r: BEAD_R, class: "path-bead", fill: COLOR_HEX[before[slot]] || "#333" }),
      });
      const home = net.querySelector(`.path-bead[data-i="${slot}"]`);
      if (home) home.setAttribute("opacity", "0");
    }
    for (const item of moving) travelers.appendChild(item.node);
    const duration = steps === 2 ? 520 : 380;
    const t0 = performance.now();
    const gen = ++slideGen;
    animating = true;
    const frame = (now) => {
      if (gen !== slideGen) return;
      const t = Math.min(1, (now - t0) / duration);
      const eased = t * t * (3 - 2 * t);
      for (const item of moving) {
        const point = pointOnTravel(center, item.travel, eased);
        item.node.setAttribute("cx", point.x);
        item.node.setAttribute("cy", point.y);
      }
      if (t < 1) {
        animFrame = requestAnimationFrame(frame);
        return;
      }
      animFrame = 0;
      animating = false;
      done();
    };
    animFrame = requestAnimationFrame(frame);
  }

  function syncDepthButtons() {
    document.querySelectorAll(".path-depth-btn").forEach((button) => {
      const on = Number(button.dataset.depth) === depth;
      button.classList.toggle("is-active", on);
      button.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function syncControls() {
    const locked = phase !== "play" || animating;
    pad.querySelectorAll("button").forEach((button) => {
      button.disabled = locked;
    });
    undoBtn.disabled = locked || played.length === 0;
    showBtn.disabled = locked;
    play.dataset.phase = phase;
    countEl.textContent = String(played.length);
    playerEl.textContent = played.length ? played.join(" ") : "—";
    scoreEl.classList.toggle("is-short", phase === "solved" && !!optimal && played.length === optimal.length);
    scoreEl.classList.toggle("is-long", phase === "solved" && !!optimal && played.length > optimal.length);
  }

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function renderResult() {
    const length = optimal ? optimal.length : scrambleMoves.length;
    if (phase === "solved" && optimal && played.length === length) {
      headlineEl.textContent = "You found a short way back.";
    } else if (phase === "solved" && optimal) {
      headlineEl.textContent = `You solved it in ${played.length}. A short way is ${length}.`;
    } else if (optimal) {
      headlineEl.textContent = `A short way back is ${length} ${length === 1 ? "move" : "moves"}.`;
    } else {
      headlineEl.textContent = "Here is one way back.";
    }

    if (optimal) {
      kickerEl.textContent = "From the scramble";
      optimalEl.textContent = optimal.moves.join(" ") || "—";
      proofEl.textContent = "These turns take the scramble back to solved. The rings stay where you left them.";
    } else {
      kickerEl.textContent = "Scramble reversed";
      optimalEl.textContent = invertAlgNotation(scramble);
      proofEl.textContent = "The search did not finish, so this is the scramble played backwards. It solves the cube.";
    }

    const undone = invertAlgNotation(scramble);
    if (optimal && scrambleMoves.length > optimal.length) {
      detourEl.hidden = false;
      detourEl.textContent = `Undoing the scramble also solves it, in ${scrambleMoves.length} moves: ${undone}.`;
    } else if (optimal && undone !== optimal.moves.join(" ")) {
      detourEl.hidden = false;
      detourEl.textContent = `Undoing the scramble is another way back: ${undone}.`;
    } else {
      detourEl.hidden = true;
      detourEl.textContent = "";
    }

    resultEl.hidden = false;
    syncControls();
  }

  function maybeReveal() {
    if (phase === "play" || revealed) return;
    if (!optimal && !searchError) {
      setStatus(phase === "solved" ? `Solved in ${played.length}.` : "Looking for a short way back…");
      return;
    }
    revealed = true;
    renderResult();
    if (phase === "solved" && optimal && played.length === optimal.length) {
      setStatus(`Solved in ${played.length}. That matches a short way back.`);
    } else if (phase === "solved" && optimal) {
      setStatus(`Solved in ${played.length}. A shorter way is ${optimal.length}.`);
    } else if (optimal) {
      setStatus("A short way back from the scramble is shown.");
    } else {
      setStatus("Showing the scramble reversed.");
    }
  }

  function pump(gen, search) {
    const chunk = () => {
      if (gen !== roundGen) return;
      const t0 = performance.now();
      let result = null;
      try {
        while (!result && !search.error && performance.now() - t0 < 12) {
          result = search.step(400);
        }
      } catch (error) {
        searchError = error instanceof Error ? error.message : "Search failed";
        maybeReveal();
        return;
      }
      if (gen !== roundGen) return;
      if (search.error) {
        searchError = search.error;
        maybeReveal();
        return;
      }
      if (!result) {
        setTimeout(chunk, 0);
        return;
      }
      optimal = result;
      maybeReveal();
    };
    setTimeout(chunk, 0);
  }

  function newRound() {
    cancelSlide();
    roundGen += 1;
    phase = "play";
    optimal = null;
    searchError = "";
    revealed = false;
    played = [];
    scramble = "";
    facelets = solvedFacelets();
    for (let attempt = 0; attempt < 8; attempt++) {
      const candidate = randomHtmScramble(depth);
      const next = solvedFacelets();
      for (const move of candidate.split(" ")) applyMove(next, move);
      scramble = candidate;
      facelets = next;
      if (!isSolved(facelets)) break;
    }
    scrambleMoves = scramble.split(" ");
    scrambleEl.textContent = scramble;
    resultEl.hidden = true;
    paint();
    syncControls();
    setStatus("Turn a face. The beads slide along their ring.");
    pump(roundGen, createShortestPathSearch(scramble));
  }

  function finishMove() {
    paint();
    syncControls();
    if (isSolved(facelets)) {
      phase = "solved";
      syncControls();
      setStatus(`Solved in ${played.length}.`);
      maybeReveal();
    }
  }

  function playMove(move) {
    if (phase !== "play" || animating) return;
    const before = facelets.slice();
    applyMove(facelets, move);
    played.push(move);
    syncControls();
    if (reduceMotion) finishMove();
    else slide(move, before, finishMove);
  }

  function undo() {
    if (phase !== "play" || played.length === 0 || animating) return;
    const move = played.pop();
    const before = facelets.slice();
    const inverse = invertAlgNotation(move);
    applyMove(facelets, inverse);
    syncControls();
    if (reduceMotion) finishMove();
    else slide(inverse, before, finishMove);
  }

  pad.addEventListener("click", (event) => {
    const button = event.target.closest("[data-move]");
    if (!button || button.disabled) return;
    playMove(button.dataset.move);
  });

  undoBtn.addEventListener("click", undo);
  newBtn.addEventListener("click", newRound);
  showBtn.addEventListener("click", () => {
    if (phase !== "play" || animating) return;
    phase = "reveal";
    syncControls();
    maybeReveal();
  });

  document.querySelector(".path-depth").addEventListener("click", (event) => {
    const button = event.target.closest("[data-depth]");
    if (!button || animating) return;
    const next = Number(button.dataset.depth);
    if (!PATH_LENGTHS.includes(next) || next === depth) return;
    depth = next;
    saveDepth(depth);
    syncDepthButtons();
    newRound();
  });

  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const tag = event.target?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (event.key === "z" || event.key === "Z") undo();
  });

  syncDepthButtons();
  newRound();
}

if (typeof document !== "undefined") init();
