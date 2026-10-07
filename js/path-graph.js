/**
 * The cube drawn as a round cloud of positions.
 *
 * The picture is the ball of every state within two face turns of the
 * scramble: six face-colored clusters arranged in a ring, hairline edges
 * between neighbors. The player's walk and, once revealed, a shortest path
 * are drawn on the same cloud. States farther out ride a short spur.
 */

import { localGraph, pathStateIds, solvedStateId } from "./shortest-path.js";

const SVG = "http://www.w3.org/2000/svg";

const FACE_COLOR = {
  U: "#ffe14a",
  R: "#ff4b6e",
  F: "#4aa3ff",
  D: "#f4f7f6",
  L: "#ff8a1e",
  B: "#3dce7a",
};

const FACES = ["U", "R", "F", "D", "L", "B"];
const PLAYER = "#6dffb0";
const OPTIMAL = "#ffc857";

const WIDTH = 420;
const HEIGHT = 460;
const CX = 210;
const CY = 224;
const LOBE_R = 94;
const HUB_DIST = 36;
const FAMILY_R = 22;
const R_MAX = 196;
const MIN_GAP = 10.2;

function inverseMoveName(name) {
  if (name.endsWith("2")) return name;
  if (name.endsWith("'")) return name.slice(0, -1);
  return `${name}'`;
}

function faceOf(name) {
  return name ? name[0] : "";
}

function powerSlot(name) {
  if (!name || name.endsWith("2")) return name && name.endsWith("2") ? 1 : 0;
  if (name.endsWith("'")) return 2;
  return 0;
}

function hash32(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** -0.5 .. 0.5, stable for a state id. */
function unitJitter(id, salt) {
  return ((hash32(`${salt}:${id}`) % 1000) / 999) - 0.5;
}

function polar(angle, radius) {
  return {
    x: CX + Math.cos(angle) * radius,
    y: CY + Math.sin(angle) * radius,
    angle,
    r: radius,
  };
}

function sectorAngle(face) {
  const index = FACES.indexOf(face);
  return -Math.PI / 2 + (index < 0 ? 0 : index) * ((Math.PI * 2) / FACES.length);
}

function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function pairSet(ids) {
  const set = new Set();
  for (let i = 1; i < ids.length; i++) set.add(pairKey(ids[i - 1], ids[i]));
  return set;
}

function linkEdge(directed, edges, seenEdge, fromId, toId, move) {
  if (!directed.has(`${fromId}>${toId}`)) {
    directed.set(`${fromId}>${toId}`, move);
    directed.set(`${toId}>${fromId}`, inverseMoveName(move));
  }
  const pair = pairKey(fromId, toId);
  if (seenEdge.has(pair)) return;
  seenEdge.add(pair);
  edges.push({ from: fromId, to: toId, move });
}

function ensureChain(bag, ids, moves) {
  for (let i = 1; i < ids.length; i++) {
    const id = ids[i];
    const prevId = ids[i - 1];
    const move = moves[i - 1];
    if (!bag.byId.has(id)) {
      const parent = bag.byId.get(prevId);
      const node = {
        id,
        depth: (parent ? parent.depth : 0) + 1,
        parentId: prevId,
        viaName: move,
      };
      bag.nodes.push(node);
      bag.byId.set(id, node);
    }
    linkEdge(bag.directed, bag.edges, bag.seenEdge, prevId, id, move);
  }
}

function remember(pos, id, x, y) {
  const dx = x - CX;
  const dy = y - CY;
  const r = Math.hypot(dx, dy);
  pos.set(id, { x, y, angle: Math.atan2(dy, dx), r });
}

function separateDots(pos, startId) {
  const ids = [...pos.keys()].filter((id) => id !== startId);
  for (let iter = 0; iter < 28; iter++) {
    let moved = false;
    for (let i = 0; i < ids.length; i++) {
      const a = pos.get(ids[i]);
      for (let j = i + 1; j < ids.length; j++) {
        const b = pos.get(ids[j]);
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);
        if (dist >= MIN_GAP) continue;
        if (dist < 0.05) {
          const nudge = ((i + j) % 2 === 0 ? 1 : -1) * 0.05;
          dx = 0.05;
          dy = nudge;
          dist = Math.hypot(dx, dy);
        }
        const push = (MIN_GAP - dist) / 2;
        const ux = (dx / dist) * push;
        const uy = (dy / dist) * push;
        a.x -= ux;
        a.y -= uy;
        b.x += ux;
        b.y += uy;
        moved = true;
      }
    }
    if (!moved) break;
  }
  for (const id of ids) {
    const point = pos.get(id);
    let dx = point.x - CX;
    let dy = point.y - CY;
    let radius = Math.hypot(dx, dy);
    if (radius < 36) {
      const scale = 36 / (radius || 1);
      dx *= scale;
      dy *= scale;
      radius = 36;
    }
    if (radius > R_MAX - 6) {
      const scale = (R_MAX - 6) / radius;
      dx *= scale;
      dy *= scale;
      radius = R_MAX - 6;
    }
    point.x = CX + dx;
    point.y = CY + dy;
    point.r = radius;
    point.angle = Math.atan2(dy, dx);
  }
}

function nudgeFree(pos, id) {
  const point = pos.get(id);
  const others = [...pos.entries()].filter(([otherId]) => otherId !== id);
  for (let iter = 0; iter < 10; iter++) {
    for (const [, other] of others) {
      let dx = point.x - other.x;
      let dy = point.y - other.y;
      let dist = Math.hypot(dx, dy);
      if (dist >= MIN_GAP) continue;
      if (dist < 0.05) {
        dx = 1;
        dy = 0.2;
        dist = Math.hypot(dx, dy);
      }
      const push = (MIN_GAP - dist) / dist;
      point.x += dx * push;
      point.y += dy * push;
    }
  }
  let dx = point.x - CX;
  let dy = point.y - CY;
  let radius = Math.hypot(dx, dy) || 1;
  if (radius > R_MAX) {
    dx *= R_MAX / radius;
    dy *= R_MAX / radius;
    radius = R_MAX;
  }
  point.x = CX + dx;
  point.y = CY + dy;
  point.r = radius;
  point.angle = Math.atan2(dy, dx);
}

function layoutNodes(nodes, startId, solvedId, playerIds, returnIds, optimalIds) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const pos = new Map();
  const children = new Map();
  for (const node of nodes) {
    if (!node.parentId) continue;
    let list = children.get(node.parentId);
    if (!list) {
      list = [];
      children.set(node.parentId, list);
    }
    list.push(node);
  }
  for (const list of children.values()) {
    list.sort((a, b) => a.viaName.localeCompare(b.viaName) || (a.id < b.id ? -1 : 1));
  }

  pos.set(startId, { x: CX, y: CY, angle: -Math.PI / 2, r: 0 });

  const byFace = new Map(FACES.map((face) => [face, []]));
  for (const node of nodes) {
    if (node.depth !== 1) continue;
    const face = faceOf(node.viaName);
    (byFace.get(face) || byFace.get("U")).push(node);
  }
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (const face of FACES) {
    const hubs = byFace.get(face);
    hubs.sort((a, b) => powerSlot(a.viaName) - powerSlot(b.viaName) || a.viaName.localeCompare(b.viaName));
    const lobe = polar(sectorAngle(face), LOBE_R);
    hubs.forEach((hub, index) => {
      const localAngle = sectorAngle(face) + (index - (hubs.length - 1) / 2) * 0.92;
      const hx = lobe.x + Math.cos(localAngle) * HUB_DIST;
      const hy = lobe.y + Math.sin(localAngle) * HUB_DIST;
      remember(pos, hub.id, hx, hy);
      const kids = (children.get(hub.id) || []).filter((child) => child.depth === 2);
      kids.forEach((child, kidIndex) => {
        const rad = FAMILY_R * Math.sqrt((kidIndex + 0.5) / Math.max(kids.length, 1));
        const ang = kidIndex * golden + localAngle;
        remember(pos, child.id, hx + Math.cos(ang) * rad, hy + Math.sin(ang) * rad);
      });
    });
  }
  separateDots(pos, startId);

  const paths = [playerIds, returnIds, optimalIds].filter((ids) => ids && ids.length);
  for (const ids of paths) {
    for (let i = 0; i < ids.length; i++) {
      if (pos.has(ids[i])) continue;
      const prev = i > 0 ? pos.get(ids[i - 1]) : null;
      const node = byId.get(ids[i]);
      const fallback = node && node.parentId ? pos.get(node.parentId) : null;
      const from = prev || fallback || pos.get(startId);
      const angle = (from.r < 8 ? sectorAngle(faceOf(node?.viaName)) : from.angle) + unitJitter(ids[i], "spur") * 0.25;
      const radius = Math.min(from.r + 16, R_MAX);
      pos.set(ids[i], polar(angle, radius));
      nudgeFree(pos, ids[i]);
    }
  }

  if (byId.has(solvedId) && !pos.has(solvedId)) {
    pos.set(solvedId, polar(Math.PI / 2, R_MAX));
  }

  for (const node of nodes) {
    if (pos.has(node.id)) continue;
    const parent = node.parentId ? pos.get(node.parentId) : null;
    const angle = parent ? parent.angle : sectorAngle(faceOf(node.viaName));
    const radius = parent ? Math.min(parent.r + 22, R_MAX) : 78;
    pos.set(node.id, polar(angle + unitJitter(node.id, "rest") * 0.12, radius));
  }

  return pos;
}

/**
 * Build the drawable graph for one puzzle position.
 * `optimalMoves` is omitted until the shortest path should appear.
 */
export function assembleGraph({ scramble, playerMoves = [], optimalMoves = null, radius = 2 }) {
  const graph = localGraph(scramble, radius);
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const seenEdge = new Set(graph.edges.map((edge) => pairKey(edge.from, edge.to)));
  const bag = {
    nodes: graph.nodes,
    edges: graph.edges,
    directed: graph.directed,
    byId,
    seenEdge,
  };

  const playerIds = pathStateIds(scramble, playerMoves);
  ensureChain(bag, playerIds, playerMoves);
  const backMoves = scramble
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .reverse()
    .map(inverseMoveName);
  const returnIds = pathStateIds(scramble, backMoves);
  ensureChain(bag, returnIds, backMoves);
  const optimalIds = optimalMoves ? pathStateIds(scramble, optimalMoves) : [];
  if (optimalMoves) ensureChain(bag, optimalIds, optimalMoves);

  const solvedId = solvedStateId();
  const currentId = playerIds[playerIds.length - 1];
  const positions = layoutNodes(bag.nodes, graph.startId, solvedId, playerIds, returnIds, optimalIds);
  const playerPairs = pairSet(playerIds);
  const returnPairs = pairSet(returnIds);
  const optimalPairs = pairSet(optimalIds);
  const playerSet = new Set(playerIds);
  const optimalSet = new Set(optimalIds);

  const nodes = bag.nodes.map((node) => {
    const pos = positions.get(node.id);
    const face = faceOf(node.viaName);
    const isStart = node.id === graph.startId;
    const isSolved = node.id === solvedId;
    const isCurrent = node.id === currentId;
    const turn = bag.directed.get(`${currentId}>${node.id}`) || "";
    return {
      id: node.id,
      x: pos.x,
      y: pos.y,
      depth: node.depth,
      color: FACE_COLOR[face] || "#f4f1e4",
      isStart,
      isSolved,
      isCurrent,
      onPlayer: playerSet.has(node.id),
      onOptimal: optimalSet.has(node.id),
      move: !isCurrent && turn ? turn : "",
    };
  });

  const edges = bag.edges.map((edge) => {
    const a = positions.get(edge.from);
    const b = positions.get(edge.to);
    const onPlayer = playerPairs.has(pairKey(edge.from, edge.to));
    const onOptimal = optimalPairs.has(pairKey(edge.from, edge.to));
    const onReturn = returnPairs.has(pairKey(edge.from, edge.to));
    let kind = "cloud";
    if (onPlayer && onOptimal) kind = "both";
    else if (onPlayer) kind = "player";
    else if (onOptimal) kind = "optimal";
    else if (onReturn) kind = "return";
    const fromNode = bag.byId.get(edge.from);
    const toNode = bag.byId.get(edge.to);
    const tree = fromNode?.parentId === edge.to || toNode?.parentId === edge.from;
    const touchCurrent = edge.from === currentId || edge.to === currentId;
    const fromStart = edge.from === graph.startId || edge.to === graph.startId;
    return {
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      kind,
      color: FACE_COLOR[faceOf(edge.move)] || "#d5ddd8",
      fromStart,
      tree,
      touchCurrent,
    };
  });

  const summary = [
    "Cube graph centered on the scramble.",
    nodes.some((node) => node.isSolved) ? "Solved position is marked." : "",
    playerMoves.length ? `Your path is ${playerMoves.length} ${playerMoves.length === 1 ? "move" : "moves"}.` : "",
    optimalMoves ? "A shortest path is highlighted." : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
    width: WIDTH,
    height: HEIGHT,
    nodes,
    edges,
    summary,
    solvedVisible: nodes.some((node) => node.isSolved),
  };
}

function svgEl(name, attrs) {
  const node = document.createElementNS(SVG, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

function fade(el, animate, depth) {
  if (!animate) return;
  el.classList.add("path-fade");
  el.style.animationDelay = `${Math.min(depth, 5) * 50}ms`;
}

/**
 * Paint `model` into `container`. Pass `animate` on a fresh scramble.
 * `onTurn` receives a face-turn name when a neighboring dot is tapped.
 */
export function renderCubeGraph(container, model, options = {}) {
  const { animate = false, interactive = false, onTurn = null } = options;
  container.replaceChildren();
  const svg = svgEl("svg", {
    viewBox: model.viewBox,
    role: "img",
    "aria-label": model.summary,
  });
  if (animate) svg.classList.add("is-entering");

  const glow = svgEl("g", { class: "path-glows", "aria-hidden": "true" });
  for (const face of FACES) {
    const spot = polar(sectorAngle(face), LOBE_R);
    const disc = svgEl("circle", {
      cx: spot.x.toFixed(1),
      cy: spot.y.toFixed(1),
      r: 44,
      fill: FACE_COLOR[face],
      class: "path-glow",
    });
    fade(disc, animate, 0);
    glow.appendChild(disc);
  }
  svg.appendChild(glow);

  const cloudGroups = new Map();
  const spokes = [];
  for (const edge of model.edges) {
    if (edge.kind !== "cloud") continue;
    if (!edge.tree && !edge.touchCurrent) continue;
    if (edge.fromStart) {
      spokes.push(edge);
      continue;
    }
    const list = cloudGroups.get(edge.color) || [];
    list.push(edge);
    cloudGroups.set(edge.color, list);
  }
  const cloud = svgEl("g", { class: "path-cloud", "aria-hidden": "true" });
  for (const [color, list] of cloudGroups) {
    const d = list
      .map((edge) => `M${edge.x1.toFixed(1)} ${edge.y1.toFixed(1)}L${edge.x2.toFixed(1)} ${edge.y2.toFixed(1)}`)
      .join("");
    const path = svgEl("path", { d, stroke: color, class: "path-cloud-edge" });
    fade(path, animate, 1);
    cloud.appendChild(path);
  }
  for (const edge of spokes) {
    const line = svgEl("line", {
      x1: edge.x1.toFixed(1),
      y1: edge.y1.toFixed(1),
      x2: edge.x2.toFixed(1),
      y2: edge.y2.toFixed(1),
      stroke: edge.color,
      class: "path-spoke",
    });
    fade(line, animate, 1);
    cloud.appendChild(line);
  }
  svg.appendChild(cloud);

  const routes = svgEl("g", { class: "path-routes", "aria-hidden": "true" });
  for (const edge of model.edges) {
    if (edge.kind === "cloud") continue;
    const attrs = {
      x1: edge.x1.toFixed(1),
      y1: edge.y1.toFixed(1),
      x2: edge.x2.toFixed(1),
      y2: edge.y2.toFixed(1),
    };
    if (edge.kind === "return") {
      routes.appendChild(svgEl("line", { ...attrs, class: "path-route path-route-return" }));
    }
    if (edge.kind === "optimal" || edge.kind === "both") {
      routes.appendChild(svgEl("line", { ...attrs, class: "path-route path-route-optimal" }));
    }
    if (edge.kind === "player" || edge.kind === "both") {
      routes.appendChild(svgEl("line", { ...attrs, class: "path-route path-route-player" }));
    }
  }
  svg.appendChild(routes);

  const dots = svgEl("g", { class: "path-dots" });
  const ordered = [...model.nodes].sort((a, b) => Number(a.isStart) - Number(b.isStart) || Number(a.isSolved) - Number(b.isSolved));
  for (const node of ordered) {
    let radius = node.depth === 1 ? 5.2 : 3.15;
    if (node.onPlayer || node.onOptimal) radius = Math.max(radius, 3.3);
    if (node.isSolved) radius = 7.2;
    if (node.isStart) radius = 8.2;
    const dot = svgEl("circle", {
      cx: node.x.toFixed(1),
      cy: node.y.toFixed(1),
      r: radius,
      fill: node.isStart ? "#f7f4ea" : node.isSolved ? "#fffaf0" : node.color,
      class: [
        "path-dot",
        node.isStart ? "is-start" : "",
        node.isSolved ? "is-solved" : "",
        node.onPlayer ? "is-player" : "",
        node.onOptimal ? "is-optimal" : "",
      ]
        .filter(Boolean)
        .join(" "),
    });
    fade(dot, animate, node.depth);
    dots.appendChild(dot);
    if (node.isCurrent) {
      dots.appendChild(
        svgEl("circle", {
          cx: node.x.toFixed(1),
          cy: node.y.toFixed(1),
          r: radius + 5,
          class: "path-current-ring",
        }),
      );
    }
    if (node.isSolved) {
      dots.appendChild(
        svgEl("circle", {
          cx: node.x.toFixed(1),
          cy: node.y.toFixed(1),
          r: radius + 5.5,
          class: "path-solved-ring",
        }),
      );
    }
  }
  svg.appendChild(dots);

  const labels = svgEl("g", { class: "path-labels", "aria-hidden": "true" });
  for (const node of model.nodes) {
    if (!node.isStart && !node.isSolved) continue;
    let x = node.x;
    let y = node.y + (node.isStart ? 20 : 0);
    if (node.isSolved && !node.isStart) {
      const dx = node.x - CX;
      const dy = node.y - CY;
      const dist = Math.hypot(dx, dy) || 1;
      const toward = dist > 150 ? -1 : 1;
      x = node.x + (dx / dist) * 18 * toward;
      y = node.y + (dy / dist) * 18 * toward + 4;
    }
    x = Math.min(WIDTH - 36, Math.max(36, x));
    y = Math.min(HEIGHT - 12, Math.max(16, y));
    const text = svgEl("text", {
      x: x.toFixed(1),
      y: y.toFixed(1),
      "text-anchor": "middle",
      class: node.isSolved ? "path-label is-solved" : "path-label",
    });
    text.textContent = node.isSolved ? "solved" : "start";
    labels.appendChild(text);
  }
  svg.appendChild(labels);

  if (interactive && onTurn) {
    const hits = svgEl("g", { class: "path-hits" });
    for (const node of model.nodes) {
      if (!node.move) continue;
      const hit = svgEl("circle", {
        cx: node.x.toFixed(1),
        cy: node.y.toFixed(1),
        r: 12,
        class: "path-hit",
        "data-move": node.move,
      });
      const title = svgEl("title", {});
      title.textContent = node.move;
      hit.appendChild(title);
      hits.appendChild(hit);
    }
    svg.appendChild(hits);
    svg.addEventListener("click", (event) => {
      const hit = event.target.closest?.("[data-move]");
      if (!hit) return;
      onTurn(hit.getAttribute("data-move"));
    });
  }

  container.appendChild(svg);
}

export const PATH_COLORS = { player: PLAYER, optimal: OPTIMAL, face: FACE_COLOR };
