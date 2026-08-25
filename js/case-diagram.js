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
    caption: hasHeadlights ? "Hold headlights on the LEFT" : "No headlights — any angle → T-perm",
  };
}

export function pllEdgesDiagram(kind) {
  // kind: UA | UB | H | Z — beginner method only shows U-perm bar
  return {
    type: "pll-edges",
    kind: kind === "UB" ? "UB" : "UA",
    caption: "Bar (solved edge) at BACK → U-perm",
  };
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
