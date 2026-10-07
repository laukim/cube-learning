/**
 * Cube net page. One cube, drawn as colored dots in a flat cross.
 * A small isometric cube sits beside that map. Show optimal is a short alg.
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

/** Face slots in the cross: U above F, D below, L F R B across the middle. */
const FACE_SLOT = { U: [1, 0], L: [0, 1], F: [1, 1], R: [2, 1], B: [3, 1], D: [1, 2] };
const DOT = 36;
const FACE_GAP = 58;
const DOT_R = 14;
const PAD_X = 28;
const PAD_Y = 32;

function svgEl(name, attrs) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

function faceOrigin(face) {
  const [col, row] = FACE_SLOT[face];
  const step = DOT * 2 + FACE_GAP;
  return { x: PAD_X + col * step, y: PAD_Y + row * step };
}

function stickerPoint(face, index) {
  const origin = faceOrigin(face);
  return {
    x: origin.x + (index % 3) * DOT,
    y: origin.y + Math.floor(index / 3) * DOT,
  };
}

function buildDotNet(container) {
  const width = PAD_X * 2 + DOT * 2 + 3 * (DOT * 2 + FACE_GAP);
  const height = PAD_Y + DOT * 2 + 2 * (DOT * 2 + FACE_GAP) + 22;
  const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}` });
  const lines = svgEl("g", { class: "path-net-lines", "aria-hidden": "true" });
  const folds = [
    ["U", 6, "F", 0],
    ["U", 7, "F", 1],
    ["U", 8, "F", 2],
    ["L", 2, "F", 0],
    ["L", 5, "F", 3],
    ["L", 8, "F", 6],
    ["F", 2, "R", 0],
    ["F", 5, "R", 3],
    ["F", 8, "R", 6],
    ["R", 2, "B", 0],
    ["R", 5, "B", 3],
    ["R", 8, "B", 6],
    ["F", 6, "D", 0],
    ["F", 7, "D", 1],
    ["F", 8, "D", 2],
  ];
  for (const [faceA, indexA, faceB, indexB] of folds) {
    const a = stickerPoint(faceA, indexA);
    const b = stickerPoint(faceB, indexB);
    lines.appendChild(
      svgEl("line", {
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        class: "path-net-fold",
      }),
    );
  }
  for (const face of ["U", "L", "F", "R", "B", "D"]) {
    for (let index = 0; index < 9; index++) {
      const here = stickerPoint(face, index);
      if (index % 3 < 2) {
        const next = stickerPoint(face, index + 1);
        lines.appendChild(svgEl("line", { x1: here.x, y1: here.y, x2: next.x, y2: next.y, class: "path-net-edge" }));
      }
      if (index < 6) {
        const next = stickerPoint(face, index + 3);
        lines.appendChild(svgEl("line", { x1: here.x, y1: here.y, x2: next.x, y2: next.y, class: "path-net-edge" }));
      }
    }
  }
  svg.appendChild(lines);

  const dots = svgEl("g", { class: "path-net-dots" });
  for (const face of ["U", "L", "F", "R", "B", "D"]) {
    const origin = faceOrigin(face);
    const label = svgEl("text", {
      x: origin.x + DOT,
      y: origin.y - 16,
      "text-anchor": "middle",
      class: `path-net-label is-${face}`,
    });
    label.textContent = face;
    svg.appendChild(label);
    const start = FACES.indexOf(face) * 9;
    for (let index = 0; index < 9; index++) {
      const point = stickerPoint(face, index);
      dots.appendChild(
        svgEl("circle", {
          cx: point.x,
          cy: point.y,
          r: DOT_R,
          "data-i": start + index,
          class: "path-net-dot",
        }),
      );
    }
  }
  svg.appendChild(dots);
  container.replaceChildren(svg);
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

  buildDotNet(net);

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

  function paint() {
    play.querySelectorAll("[data-i]").forEach((cell) => {
      const color = COLOR_HEX[facelets[Number(cell.dataset.i)]] || "#333";
      if (cell.localName === "circle") cell.setAttribute("fill", color);
      else cell.style.background = color;
    });
  }

  function syncDepthButtons() {
    document.querySelectorAll(".path-depth-btn").forEach((button) => {
      const on = Number(button.dataset.depth) === depth;
      button.classList.toggle("is-active", on);
      button.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function syncControls() {
    const locked = phase !== "play";
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
      proofEl.textContent = "These turns take the scramble back to solved. The net stays where you left it.";
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
      setStatus("A short way back from the scramble is below.");
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
    setStatus("Turn a face. Each turn redraws this map.");
    pump(roundGen, createShortestPathSearch(scramble));
  }

  function playMove(move) {
    if (phase !== "play") return;
    applyMove(facelets, move);
    played.push(move);
    paint();
    syncControls();
    if (isSolved(facelets)) {
      phase = "solved";
      syncControls();
      setStatus(`Solved in ${played.length}.`);
      maybeReveal();
    }
  }

  function undo() {
    if (phase !== "play" || played.length === 0) return;
    const move = played.pop();
    applyMove(facelets, invertAlgNotation(move));
    paint();
    syncControls();
  }

  pad.addEventListener("click", (event) => {
    const button = event.target.closest("[data-move]");
    if (!button || button.disabled) return;
    playMove(button.dataset.move);
  });

  undoBtn.addEventListener("click", undo);
  newBtn.addEventListener("click", newRound);
  showBtn.addEventListener("click", () => {
    if (phase !== "play") return;
    phase = "reveal";
    syncControls();
    maybeReveal();
  });

  document.querySelector(".path-depth").addEventListener("click", (event) => {
    const button = event.target.closest("[data-depth]");
    if (!button) return;
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
