/**
 * Top-view case diagrams for OLL / PLL hints (Cube Academy style).
 * Grid is looking down on U: back at top of diagram, front at bottom.
 *
 *   0 1 2     UBL UB UBR
 *   3 4 5     UL  ·  UR
 *   6 7 8     UFL UF UFR
 */

export function emptyTopCells() {
  return Array(9).fill("off");
}

/** Mark U-face stickers: edges [UB,UR,UF,UL] → cells 1,5,7,3; corners [UBL,UBR,UFR,UFL] → 0,2,8,6 */
export function ollTopDiagram({ edges = [false, false, false, false], corners = [false, false, false, false] } = {}) {
  const cells = emptyTopCells();
  cells[4] = "center"; // U centre always yellow for last layer
  const edgeCells = [1, 5, 7, 3];
  const cornerCells = [0, 2, 8, 6];
  edges.forEach((on, i) => {
    cells[edgeCells[i]] = on ? "yellow" : "off";
  });
  corners.forEach((on, i) => {
    cells[cornerCells[i]] = on ? "yellow" : "off";
  });
  return { type: "oll-top", cells, caption: "Top view (yellow face) · back ↑" };
}

export function pllHeadlightsDiagram(hasHeadlights) {
  return {
    type: "pll-sides",
    mode: hasHeadlights ? "headlights" : "none",
    hold: "left",
    caption: hasHeadlights ? "Hold headlights on the LEFT → T-perm" : "No headlights — Y-perm",
  };
}

export function pllEdgesDiagram(kind) {
  const k = kind === "UB" ? "UB" : kind === "H" ? "H" : kind === "Z" ? "Z" : "UA";
  const captions = {
    UA: "Bar (solved side) at BACK → Ua-perm",
    UB: "Bar at BACK, front edge left → Ub-perm",
    H: "No bars — H-perm (M moves)",
    Z: "Opposite bars LEFT + RIGHT → Z-perm",
  };
  return {
    type: "pll-edges",
    kind: k,
    caption: captions[k],
  };
}

const RECOG_COLORS = {
  yellow: "#ffd500",
  white: "#f7f7f7",
  green: "#0b9e4a",
  blue: "#0b5fbf",
  orange: "#ff6a00",
  red: "#c41e3a",
};

let recogSeq = 0;

function escAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function stickerRect(x, y, w, h, color) {
  const fill = RECOG_COLORS[color] || "#2a2a2e";
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2.5" fill="${fill}" stroke="rgba(0,0,0,0.28)" stroke-width="1"/>`;
}

/**
 * Top-down PLL recognition diagram.
 * sides.* are visual order: back left→right, left/right back→front, front left→right.
 * edges.swaps / corners.swaps are 2-cycles. edges.cycle / corners.cycle are ordered cycles.
 */
function recognitionSvg(diagram) {
  const id = ++recogSeq;
  const cell = 22;
  const gap = 3;
  const side = 15;
  const ux = 38;
  const uy = 34;
  const span = 3 * cell + 2 * gap;
  const slot = (i) => i * (cell + gap);
  const sideOnCol = (i) => ux + slot(i) + (cell - side) / 2;
  const sideOnRow = (i) => uy + slot(i) + (cell - side) / 2;
  const leftX = ux - 5 - side;
  const rightX = ux + span + 5;
  const backY = uy - 5 - side;
  const frontY = uy + span + 5;
  const sides = diagram.sides || {};
  const B = sides.B || ["#333", "#333", "#333"];
  const L = sides.L || ["#333", "#333", "#333"];
  const R = sides.R || ["#333", "#333", "#333"];
  const F = sides.F || ["#333", "#333", "#333"];

  const placed = [];
  const parts = [];
  parts.push(`<rect x="4" y="4" width="152" height="168" rx="12" fill="rgba(0,0,0,0.45)" stroke="rgba(232,242,236,0.12)"/>`);

  B.forEach((color, i) => {
    const x = sideOnCol(i);
    const y = backY;
    parts.push(stickerRect(x, y, side, side, color));
    placed.push({ face: "B", i, x, y, w: side, h: side, color });
  });
  L.forEach((color, i) => {
    const x = leftX;
    const y = sideOnRow(i);
    parts.push(stickerRect(x, y, side, side, color));
    placed.push({ face: "L", i, x, y, w: side, h: side, color });
  });
  R.forEach((color, i) => {
    const x = rightX;
    const y = sideOnRow(i);
    parts.push(stickerRect(x, y, side, side, color));
    placed.push({ face: "R", i, x, y, w: side, h: side, color });
  });
  F.forEach((color, i) => {
    const x = sideOnCol(i);
    const y = frontY;
    parts.push(stickerRect(x, y, side, side, color));
    placed.push({ face: "F", i, x, y, w: side, h: side, color });
  });

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const x = ux + slot(col);
      const y = uy + slot(row);
      parts.push(stickerRect(x, y, cell, cell, "yellow"));
    }
  }

  function mark(stickers, stroke) {
    if (!stickers.length) return;
    const x = Math.min(...stickers.map((s) => s.x)) - 2;
    const y = Math.min(...stickers.map((s) => s.y)) - 2;
    const r = Math.max(...stickers.map((s) => s.x + s.w)) + 2;
    const b = Math.max(...stickers.map((s) => s.y + s.h)) + 2;
    parts.push(
      `<rect x="${x}" y="${y}" width="${r - x}" height="${b - y}" rx="4" fill="none" stroke="${stroke}" stroke-width="2"/>`
    );
  }

  for (const face of ["B", "L", "R", "F"]) {
    const stickers = placed.filter((s) => s.face === face);
    const colors = stickers.map((s) => s.color);
    if (colors[0] && colors.every((c) => c === colors[0])) {
      mark(stickers, "#6dffb0");
    } else if (colors[0] && colors[0] === colors[2] && colors[0] !== colors[1]) {
      mark([stickers[0], stickers[2]], "#ffc857");
    } else if (colors[0] === colors[1] && colors[0] !== colors[2]) {
      mark([stickers[0], stickers[1]], "#7eb6ff");
    } else if (colors[1] === colors[2] && colors[1] !== colors[0]) {
      mark([stickers[1], stickers[2]], "#7eb6ff");
    }
  }

  const centerOf = (col, row) => [ux + slot(col) + cell / 2, uy + slot(row) + cell / 2];
  const edgePt = {
    UB: centerOf(1, 0),
    UR: centerOf(2, 1),
    UF: centerOf(1, 2),
    UL: centerOf(0, 1),
  };
  const cornerPt = {
    ULB: centerOf(0, 0),
    UBR: centerOf(2, 0),
    UFL: centerOf(0, 2),
    URF: centerOf(2, 2),
  };
  const mid = centerOf(1, 1);

  function bendPath(a, b, amount) {
    const [x1, y1] = a;
    const [x2, y2] = b;
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const towardX = mid[0] - mx;
    const towardY = mid[1] - my;
    const sign = dx * towardY - dy * towardX >= 0 ? 1 : -1;
    const cx = mx + (-dy / len) * amount * sign;
    const cy = my + (dx / len) * amount * sign;
    return `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }

  const marker = `pll-arrow-${id}`;
  parts.push(
    `<defs><marker id="${marker}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#1a1208"/></marker></defs>`
  );

  function drawSwap(map, pair) {
    const a = map[pair[0]];
    const b = map[pair[1]];
    if (!a || !b) return;
    parts.push(
      `<path d="${bendPath(a, b, 7)}" fill="none" stroke="#1a1208" stroke-width="2.1" stroke-linecap="round" marker-start="url(#${marker})" marker-end="url(#${marker})"/>`
    );
  }

  function drawCycle(map, cycle) {
    if (!cycle || cycle.length < 2) return;
    for (let i = 0; i < cycle.length; i++) {
      const a = map[cycle[i]];
      const b = map[cycle[(i + 1) % cycle.length]];
      if (!a || !b) continue;
      parts.push(
        `<path d="${bendPath(a, b, 9)}" fill="none" stroke="#1a1208" stroke-width="2.1" stroke-linecap="round" marker-end="url(#${marker})"/>`
      );
    }
  }

  const edges = diagram.edges || {};
  const corners = diagram.corners || {};
  (edges.swaps || []).forEach((pair) => drawSwap(edgePt, pair));
  (corners.swaps || []).forEach((pair) => drawSwap(cornerPt, pair));
  drawCycle(edgePt, edges.cycle);
  drawCycle(cornerPt, corners.cycle);

  parts.push(
    `<text x="80" y="16" text-anchor="middle" fill="rgba(232,242,236,0.45)" font-size="9" font-family="Figtree, system-ui, sans-serif">B</text>`
  );
  parts.push(
    `<text x="14" y="92" text-anchor="middle" fill="rgba(232,242,236,0.45)" font-size="9" font-family="Figtree, system-ui, sans-serif">L</text>`
  );
  parts.push(
    `<text x="148" y="92" text-anchor="middle" fill="rgba(232,242,236,0.45)" font-size="9" font-family="Figtree, system-ui, sans-serif">R</text>`
  );
  parts.push(
    `<text x="80" y="166" text-anchor="middle" fill="rgba(232,242,236,0.45)" font-size="9" font-family="Figtree, system-ui, sans-serif">F</text>`
  );

  return `<svg class="pll-recog-svg" viewBox="0 0 160 176" role="presentation" focusable="false">${parts.join("")}</svg>`;
}

/** Render diagram object → HTML string */
export function renderCaseDiagram(diagram) {
  if (!diagram) return "";
  if (diagram.type === "oll-top") {
    const cells = diagram.cells
      .map((c) => `<span class="case-cell case-cell-${c}" aria-hidden="true"></span>`)
      .join("");
    return `<div class="case-diagram" role="img" aria-label="${diagram.caption}">
      <div class="case-grid">${cells}</div>
      <div class="case-caption">${diagram.caption}</div>
      <div class="case-compass" aria-hidden="true"><span>L</span><span>B ↑</span><span>R</span></div>
    </div>`;
  }
  if (diagram.type === "pll-sides") {
    const hl = diagram.mode === "headlights";
    const holdLeft = diagram.hold !== "back";
    return `<div class="case-diagram case-diagram-pll" role="img" aria-label="${diagram.caption}">
      <div class="pll-net ${holdLeft ? "pll-net-left" : ""}">
        <div class="pll-face pll-side ${hl && holdLeft ? "is-hl" : ""}">
          <span class="pll-stick ${hl && holdLeft ? "is-match" : ""}"></span>
          <span class="pll-stick ${hl && holdLeft ? "is-match" : ""}"></span>
          <em>${holdLeft ? "LEFT" : "BACK"}</em>
        </div>
        <div class="pll-face pll-front">
          <span class="pll-stick"></span>
          <span class="pll-stick"></span>
          <em>FRONT</em>
        </div>
      </div>
      <div class="case-caption">${diagram.caption}</div>
    </div>`;
  }
  if (diagram.type === "pll-recog") {
    return `<div class="case-diagram case-diagram-recog" role="img" aria-label="${escAttr(diagram.caption)}">
      ${recognitionSvg(diagram)}
      <div class="case-caption">${escAttr(diagram.caption)}</div>
    </div>`;
  }
  if (diagram.type === "pll-edges") {
    const k = diagram.kind;
    const marks = {
      UA: ["bar", "", "cyc", "cyc"],
      UB: ["bar", "cyc", "cyc", ""],
      H: ["opp", "opp", "opp", "opp"],
      Z: ["z", "z", "z", "z"],
    }[k] || ["", "", "", ""];
    // order drawn: back, right, front, left
    const labels = ["B", "R", "F", "L"];
    const edges = labels
      .map(
        (lab, i) =>
          `<div class="pll-edge pll-edge-${lab} is-${marks[i] || "plain"}"><span>${lab}</span></div>`
      )
      .join("");
    return `<div class="case-diagram case-diagram-pll" role="img" aria-label="${diagram.caption}">
      <div class="pll-edge-ring">${edges}<div class="pll-edge-core">U</div></div>
      <div class="case-caption">${diagram.caption}</div>
    </div>`;
  }
  return "";
}
