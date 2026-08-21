import {
  applyAlg,
  applyMove,
  cloneFacelets,
  COLOR_HEX,
  FACES,
  scrambleCube,
  setFacelet,
  solvedFacelets,
} from "./cube.js";
import { createErnoCube } from "./erno-view.js";
import { analyzeF2L, F2L_TIPS, scrambleF2L } from "./f2l-trainer.js";
import { ALG_LIBRARY, analyze, STEPS } from "./solver.js";

const ernoBox = document.getElementById("erno-container");
const stepsEl = document.getElementById("steps");
const hintCard = document.getElementById("hint-card");
const solvedBanner = document.getElementById("solved-banner");

let facelets = solvedFacelets();
let paintColor = "white";
let netDraft = null;
let lastHintAlg = "";
let appMode = "guide"; // guide | f2l | match | algs
let lastF2lAlg = "";
/** When true, ignore ERNO twist events (we're driving facelets ourselves). */
let syncingFromUi = false;

const CENTER_COLOR = {
  U: "yellow",
  D: "white",
  F: "green",
  B: "blue",
  L: "orange",
  R: "red",
};

let erno = null;

function mountErno() {
  erno?.destroy();
  erno = createErnoCube(ernoBox, {
    onTwist(move) {
      if (syncingFromUi) return;
      try {
        applyMove(facelets, move);
        refreshGuide();
      } catch (err) {
        console.warn("twist sync failed", move, err);
      }
    },
  });
}

function refreshGuide() {
  if (appMode === "f2l") {
    refreshF2L();
    return;
  }

  const result = analyze(facelets);
  stepsEl.innerHTML = STEPS.map((step, i) => {
    const done = result.stepsDone[i];
    const current = !result.solved && result.stepIndex === i;
    const cls = ["step", done ? "is-done" : "", current ? "is-current" : ""].filter(Boolean).join(" ");
    return `<li class="${cls}">
      <span class="step-num">${done ? "✓" : i + 1}</span>
      <div>
        <h3>${step.title}</h3>
        <p>${step.blurb}</p>
      </div>
    </li>`;
  }).join("");

  if (result.solved) {
    hintCard.hidden = true;
    solvedBanner.hidden = false;
    lastHintAlg = "";
    return;
  }

  solvedBanner.hidden = true;
  const h = result.hint;
  if (!h) {
    hintCard.hidden = true;
    return;
  }

  hintCard.hidden = false;
  document.getElementById("hint-kicker").textContent = `Step ${result.stepIndex + 1} · ${STEPS[result.stepIndex].title}`;
  document.getElementById("hint-title").textContent = h.title;
  document.getElementById("hint-copy").textContent = h.copy;
  document.getElementById("hint-alg").textContent = h.alg;
  document.getElementById("hint-note").textContent = h.note || "";
  lastHintAlg = h.alg && !h.alg.includes("intuitive") ? h.alg : "";
  document.getElementById("btn-apply-alg").hidden = !lastHintAlg;
}

function refreshF2L() {
  const result = analyzeF2L(facelets);
  const prog = document.getElementById("f2l-progress");
  prog.innerHTML = result.slots
    .map(
      (s) =>
        `<div class="f2l-slot ${s.done ? "is-done" : ""}" title="${s.name}">
          <span class="f2l-slot-id">${s.id}</span>
          <span class="f2l-slot-mark">${s.done ? "✓" : "·"}</span>
        </div>`
    )
    .join("");

  const solvedEl = document.getElementById("f2l-solved-banner");
  const card = document.getElementById("f2l-hint-card");
  if (result.complete) {
    solvedEl.hidden = false;
    card.hidden = true;
    lastF2lAlg = "";
    return;
  }

  solvedEl.hidden = true;
  card.hidden = false;
  const h = result.hint;
  document.getElementById("f2l-hint-kicker").textContent = `F2L · ${result.solvedCount}/4 slots`;
  document.getElementById("f2l-hint-title").textContent = h.title;
  document.getElementById("f2l-hint-copy").textContent = h.copy;
  document.getElementById("f2l-hint-alg").textContent = h.alg || "—";
  document.getElementById("f2l-hint-note").textContent = h.note || "";
  lastF2lAlg = h.alg && h.alg.trim() ? h.alg : "";
  document.getElementById("btn-f2l-apply").hidden = !lastF2lAlg;
}

function buildF2LTips() {
  const el = document.getElementById("f2l-tips");
  el.innerHTML = F2L_TIPS.map(
    (t) => `<article class="f2l-tip"><h3>${t.title}</h3><p>${t.body}</p></article>`
  ).join("");
}

function setPanelCopy(mode) {
  const title = document.getElementById("panel-title");
  const blurb = document.getElementById("panel-blurb");
  const btnScramble = document.getElementById("btn-scramble");
  const btnF2l = document.getElementById("btn-f2l-case");
  const btnHint = document.getElementById("btn-hint");

  if (mode === "f2l") {
    title.textContent = "Intuitive F2L. Cross stays. Pair, then insert.";
    blurb.innerHTML =
      "White on bottom. Bring each unsolved pair to <strong>front-right</strong> with <code class=\"inline-alg\">y</code>. Hints follow the <strong>5 fundamental cases</strong> (matching, non-matching, white on top, and the two mirrors).";
    btnScramble.hidden = true;
    btnF2l.hidden = false;
    btnHint.textContent = "F2L hint";
  } else {
    title.textContent = "White on bottom. Yellow on top. Seven steps you already know.";
    blurb.innerHTML =
      "Righty = <code class=\"inline-alg\">R U R' U'</code> · Lefty = <code class=\"inline-alg\">L' U' L U</code>. Scramble, match your cube, or follow hints one step at a time.";
    btnScramble.hidden = false;
    btnF2l.hidden = true;
    btnHint.textContent = "Next hint";
  }
}

function render() {
  refreshGuide();
}

/** Drive the ERNO cube; facelets update from onTwist (or we apply first when skipping events). */
function doMove(move) {
  erno?.twist(move);
}

function doAlg(alg) {
  if (!alg || alg.includes("intuitive") || alg.includes("repeat")) return;
  erno?.twistAlg(alg);
}

function resetCube() {
  facelets = solvedFacelets();
  mountErno();
  refreshGuide();
}

function playScrambleAlg(alg) {
  facelets = solvedFacelets();
  if (alg) applyAlg(facelets, alg);
  mountErno();
  if (alg) {
    syncingFromUi = true;
    erno.twistAlg(alg);
    // Facelets already match; clear flag after twists are queued
    window.setTimeout(() => {
      syncingFromUi = false;
    }, 50);
  }
  refreshGuide();
}

document.querySelectorAll(".move-btn").forEach((btn) => {
  btn.addEventListener("click", () => doMove(btn.dataset.move));
});

document.getElementById("btn-reset").addEventListener("click", () => {
  resetCube();
});

document.getElementById("btn-scramble").addEventListener("click", () => {
  const draft = solvedFacelets();
  const alg = scrambleCube(draft);
  playScrambleAlg(alg);
});

document.getElementById("btn-f2l-case").addEventListener("click", () => {
  const draft = solvedFacelets();
  const alg = scrambleF2L(draft);
  playScrambleAlg(alg);
});

document.getElementById("btn-hint").addEventListener("click", () => {
  if (appMode === "f2l") {
    refreshF2L();
    document.getElementById("f2l-hint-card").hidden = false;
    document.getElementById("f2l-hint-card").scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }
  refreshGuide();
  if (!solvedBanner.hidden) return;
  hintCard.hidden = false;
  hintCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
});

document.getElementById("btn-apply-alg").addEventListener("click", () => {
  if (lastHintAlg) doAlg(lastHintAlg);
});

document.getElementById("btn-f2l-apply").addEventListener("click", () => {
  if (lastF2lAlg) doAlg(lastF2lAlg);
});

const panels = {
  guide: document.getElementById("panel-guide"),
  f2l: document.getElementById("panel-f2l"),
  match: document.getElementById("panel-match"),
  algs: document.getElementById("panel-algs"),
};

document.querySelectorAll(".mode-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".mode-tab").forEach((t) => {
      t.classList.toggle("is-active", t === tab);
      t.setAttribute("aria-selected", t === tab ? "true" : "false");
    });
    const mode = tab.dataset.mode;
    appMode = mode;
    Object.entries(panels).forEach(([key, el]) => {
      el.hidden = key !== mode;
    });
    setPanelCopy(mode);
    if (mode === "f2l") refreshF2L();
    if (mode === "guide") refreshGuide();
  });
});

const paletteEl = document.getElementById("palette");
const netEl = document.getElementById("color-net");
const PALETTE = ["white", "yellow", "green", "blue", "orange", "red"];

function buildPalette() {
  paletteEl.innerHTML = "";
  for (const c of PALETTE) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "swatch" + (c === paintColor ? " is-active" : "");
    b.style.background = COLOR_HEX[c];
    b.title = c;
    b.setAttribute("aria-label", c);
    b.addEventListener("click", () => {
      paintColor = c;
      buildPalette();
    });
    paletteEl.appendChild(b);
  }
}

function syncNetFromCube() {
  netDraft = cloneFacelets(facelets);
}

function buildNet() {
  if (!netDraft) syncNetFromCube();
  netEl.innerHTML = "";
  const layout = [
    { face: "U", cls: "net-U" },
    { face: "L", cls: "net-L" },
    { face: "F", cls: "net-F" },
    { face: "R", cls: "net-R" },
    { face: "B", cls: "net-B" },
    { face: "D", cls: "net-D" },
  ];
  for (const { face, cls } of layout) {
    const faceDiv = document.createElement("div");
    faceDiv.className = `net-face ${cls}`;
    for (let i = 0; i < 9; i++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "net-cell";
      const idx = FACES.indexOf(face) * 9 + i;
      cell.style.background = COLOR_HEX[netDraft[idx]];
      if (i === 4) {
        cell.disabled = true;
        cell.title = `${face} centre`;
      } else {
        cell.addEventListener("click", () => {
          setFacelet(netDraft, face, i, paintColor);
          buildNet();
        });
      }
      faceDiv.appendChild(cell);
    }
    netEl.appendChild(faceDiv);
  }
}

document.getElementById("btn-net-reset").addEventListener("click", () => {
  netDraft = solvedFacelets();
  buildNet();
});

document.getElementById("btn-net-apply").addEventListener("click", () => {
  if (!netDraft) return;
  for (const face of FACES) setFacelet(netDraft, face, 4, CENTER_COLOR[face]);
  facelets = cloneFacelets(netDraft);
  // 3D cube stays on its twist history; reset visual to solved — match mode is for hints
  mountErno();
  refreshGuide();
  document.getElementById("tab-guide").click();
});

document.getElementById("tab-match").addEventListener("click", () => {
  syncNetFromCube();
  buildNet();
});

function buildAlgList() {
  const el = document.getElementById("alg-list");
  el.innerHTML = ALG_LIBRARY.map((a) => {
    const canTry = a.alg && !a.alg.includes("intuitive") && !a.alg.includes("repeat");
    return `<article class="alg-item">
      <h3>${a.name}</h3>
      <p><strong>${a.group}.</strong> ${a.when}. ${a.tip}</p>
      <code class="alg">${a.alg}</code>
      ${
        canTry
          ? `<div style="margin-top:0.55rem">
        <button type="button" class="btn btn-small btn-ghost" data-alg="${a.alg.replace(/"/g, "&quot;")}">Try on cube</button>
      </div>`
          : ""
      }
    </article>`;
  }).join("");

  el.querySelectorAll("[data-alg]").forEach((btn) => {
    btn.addEventListener("click", () => doAlg(btn.dataset.alg));
  });
}

const KEY_MOVES = {
  u: "U",
  e: "U'",
  r: "R",
  i: "R'",
  f: "F",
  g: "F'",
  d: "D",
  s: "D'",
  l: "L",
  k: "L'",
  b: "B",
  n: "B'",
  y: "y",
};

window.addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea")) return;
  const key = e.key.toLowerCase();
  if (key === "y" && e.shiftKey) {
    e.preventDefault();
    doMove("y'");
    return;
  }
  const move = KEY_MOVES[key];
  if (move) {
    e.preventDefault();
    doMove(move);
  }
});

window.addEventListener("resize", () => {
  erno?.resize();
});

buildPalette();
buildAlgList();
buildF2LTips();
syncNetFromCube();
buildNet();
setPanelCopy("guide");
mountErno();
render();
