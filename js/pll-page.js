/**
 * PLL algorithm reference. Diagrams and algs come from the 2-look trainer
 * and Cases I know — this page does not scramble or solve a cube.
 */

import { pllEdgesDiagram, pllHeadlightsDiagram, renderCaseDiagram } from "./case-diagram.js";
import {
  getPllKnownSort,
  getPllLook,
  knownPllCasesSorted,
  knownPllDiagram,
  knownPllNote,
  setPllKnownSort,
  setPllLook,
} from "./pll-known.js";
import { PLL_DRILL_CASES, PLL_H, PLL_T, PLL_TIPS, PLL_U, PLL_UB, PLL_Y, PLL_Z } from "./pll-trainer.js";

const PLL_LOOK_KEY = "bylayer-pll-look";
const PLL_SORT_KEY = "bylayer-pll-known-sort";

const TWO_LOOK = {
  t: {
    step: "Step 1 · Corners",
    name: PLL_T.name,
    cue: PLL_T.howHeadlights,
    alg: PLL_T.alg,
    diagram: pllHeadlightsDiagram(true),
  },
  y: {
    step: "Step 1 · Corners",
    name: PLL_Y.name,
    cue: PLL_Y.how,
    alg: PLL_Y.alg,
    diagram: pllHeadlightsDiagram(false),
  },
  ua: {
    step: "Step 2 · Edges",
    name: PLL_U.name,
    cue: PLL_U.howBar,
    alg: PLL_U.alg,
    diagram: pllEdgesDiagram("UA"),
  },
  ub: {
    step: "Step 2 · Edges",
    name: PLL_UB.name,
    cue: PLL_UB.how,
    alg: PLL_UB.alg,
    diagram: pllEdgesDiagram("UB"),
  },
  h: {
    step: "Step 2 · Edges",
    name: PLL_H.name,
    cue: PLL_H.how.replace(/\s*Use M \/ M' \/ M2 on the pad\.?/, "").trim(),
    alg: PLL_H.alg,
    diagram: pllEdgesDiagram("H"),
  },
  z: {
    step: "Step 2 · Edges",
    name: PLL_Z.name,
    cue: PLL_Z.how,
    alg: PLL_Z.alg,
    diagram: pllEdgesDiagram("Z"),
  },
};

const TIP_BODY = {
  "Practice order": "T (headlights) → Y (no headlights) → Ua → Ub → H → Z.",
  "Step 2 — Edges":
    "One bar → back → Ua (or Ub if the front edge goes left). Two opposite bars → Z. No bars → H. H and Z use M moves.",
  "Algs break F2L mid-way": "The first R or F messes up F2L on purpose. Finish every move — F2L comes back.",
  "Don’t orbit for the alg":
    "Turn only U until the side colours match the picture. Don’t turn the whole cube to chase F or R.",
};

/** Drill order from pll-trainer, with the hint diagram, cue, and alg for each case. */
export function twoLookCards() {
  return PLL_DRILL_CASES.map((drill) => {
    const card = TWO_LOOK[drill.id];
    if (!card) throw new Error(`missing 2-look card ${drill.id}`);
    return { id: drill.id, ...card };
  });
}

function referenceTips() {
  return PLL_TIPS.filter((tip) => tip.title !== "Source").map((tip) => ({
    title: tip.title,
    body: TIP_BODY[tip.title] ?? tip.body,
  }));
}

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stepsHtml(text) {
  return String(text)
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => `<p>${esc(line)}</p>`)
    .join("");
}

function algRow(display, alg) {
  return `<div class="pll-alg-row">
    <code class="alg pll-known-alg">${esc(display)}</code>
    <button type="button" class="btn btn-ghost btn-small pll-copy" data-pll-copy="${esc(alg)}">Copy</button>
  </div>`;
}

function renderTwoLook(root) {
  if (!root) return;
  root.innerHTML = twoLookCards()
    .map(
      (card) => `<article class="pll-known-case pll-two-case" id="pll-two-${esc(card.id)}">
        <p class="hint-kicker">${esc(card.step)}</p>
        <header class="pll-known-head">
          <h2 class="pll-known-name">${esc(card.name)}</h2>
        </header>
        ${renderCaseDiagram(card.diagram)}
        <div class="pll-known-steps">${stepsHtml(card.cue)}</div>
        ${algRow(card.alg, card.alg)}
      </article>`
    )
    .join("");
}

function renderTips(root) {
  if (!root) return;
  root.innerHTML = referenceTips()
    .map((tip) => `<article class="f2l-tip"><h3>${esc(tip.title)}</h3><p>${esc(tip.body)}</p></article>`)
    .join("");
}

function renderKnown(root) {
  if (!root) return;
  const sort = getPllKnownSort();
  if (root.dataset.sort === sort) return;
  root.innerHTML = knownPllCasesSorted(sort)
    .map((pllCase) => {
      const steps = stepsHtml(pllCase.steps);
      return `<article class="pll-known-case" id="pll-known-${esc(pllCase.id)}">
        <header class="pll-known-head">
          <h2 class="pll-known-name">${esc(pllCase.short)} <span>${esc(pllCase.name)}</span></h2>
          <p class="pll-known-cue">${esc(pllCase.cue)}</p>
        </header>
        ${renderCaseDiagram(knownPllDiagram(pllCase))}
        <div class="pll-known-steps">${steps}</div>
        ${algRow(pllCase.algDisplay || pllCase.alg, pllCase.alg)}
      </article>`;
    })
    .join("");
  root.dataset.sort = sort;
}

function syncLook(doc) {
  const look = getPllLook();
  doc.querySelectorAll("[data-pll-look]").forEach((btn) => {
    const on = btn.dataset.pllLook === look;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
  const two = doc.getElementById("pll-two");
  const known = doc.getElementById("pll-known");
  const sortBar = doc.getElementById("pll-known-sort");
  if (two) two.hidden = look !== "two";
  if (known) known.hidden = look !== "known";
  if (sortBar) sortBar.hidden = look !== "known";
  if (look === "known") renderKnown(doc.getElementById("pll-known-list"));
}

function syncSort(doc) {
  const sort = getPllKnownSort();
  doc.querySelectorAll("[data-pll-sort]").forEach((btn) => {
    const on = btn.dataset.pllSort === sort;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

function remember(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
}

function readLook() {
  const hash = location.hash.replace("#", "");
  if (hash === "two" || hash === "known") return hash;
  try {
    const saved = localStorage.getItem(PLL_LOOK_KEY);
    if (saved === "two" || saved === "known") return saved;
  } catch {
    /* default */
  }
  return "two";
}

function readSort() {
  try {
    const saved = localStorage.getItem(PLL_SORT_KEY);
    if (saved === "probability" || saved === "weakest") return saved;
  } catch {
    /* default */
  }
  return "probability";
}

async function writeClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* fall through */
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

function bindCopy(doc) {
  doc.querySelector(".pll-page-main")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-pll-copy]");
    if (!button) return;
    const alg = button.dataset.pllCopy || "";
    if (!alg) return;
    writeClipboard(alg).then((ok) => {
      window.clearTimeout(button._copyTimer);
      button.textContent = ok ? "Copied" : "Copy failed";
      button.classList.toggle("is-copied", ok);
      button._copyTimer = window.setTimeout(() => {
        button.textContent = "Copy";
        button.classList.remove("is-copied");
      }, 1200);
    });
  });
}

export function bootPllPage(doc = globalThis.document) {
  if (!doc?.getElementById) return;
  const note = doc.getElementById("pll-known-note");
  if (note) note.textContent = knownPllNote();
  renderTwoLook(doc.getElementById("pll-two-list"));
  renderTips(doc.getElementById("pll-tips"));
  setPllLook(readLook());
  setPllKnownSort(readSort());
  syncSort(doc);
  syncLook(doc);
  bindCopy(doc);

  doc.querySelectorAll("[data-pll-look]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = btn.dataset.pllLook;
      if (!next || next === getPllLook()) return;
      setPllLook(next);
      remember(PLL_LOOK_KEY, next);
      if (location.hash !== `#${next}`) history.replaceState(null, "", `#${next}`);
      syncLook(doc);
    });
  });

  doc.querySelectorAll("[data-pll-sort]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = btn.dataset.pllSort;
      if (!next || next === getPllKnownSort()) return;
      setPllKnownSort(next);
      remember(PLL_SORT_KEY, next);
      syncSort(doc);
      const list = doc.getElementById("pll-known-list");
      if (list) delete list.dataset.sort;
      renderKnown(list);
    });
  });

  window.addEventListener("hashchange", () => {
    const hash = location.hash.replace("#", "");
    if ((hash === "two" || hash === "known") && hash !== getPllLook()) {
      setPllLook(hash);
      remember(PLL_LOOK_KEY, hash);
      syncLook(doc);
    }
  });
}

bootPllPage();
