/**
 * Solve order key is the datetime the solve happened (`at`, epoch milliseconds),
 * then id. Callers must not treat array position as the order.
 */
export function solveTimestamp(record) {
  const at = Number(record?.at);
  return Number.isFinite(at) && at > 0 ? at : 0;
}

export function compareSolves(a, b) {
  return solveTimestamp(a) - solveTimestamp(b);
}

export function sortSolves(records) {
  const list = Array.isArray(records) ? records : [];
  return list
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const diff = solveTimestamp(a.row) - solveTimestamp(b.row);
      if (diff !== 0) return diff;
      const aAt = solveTimestamp(a.row);
      const bAt = solveTimestamp(b.row);
      if (aAt > 0 && bAt > 0) {
        const idDiff = String(a.row?.id || "").localeCompare(String(b.row?.id || ""));
        if (idDiff !== 0) return idDiff;
      }
      return a.index - b.index;
    })
    .map((item) => item.row);
}

const F2L_PAIR_IDS = new Set(["FR", "BR", "BL", "FL"]);
const MAX_SPLIT_MS = 48 * 60 * 60 * 1000;

function normalizePairs(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const item of raw) {
    const id = String(item?.id || "");
    const at = Number(item?.at);
    if (!F2L_PAIR_IDS.has(id) || seen.has(id)) continue;
    if (!Number.isFinite(at) || at < 0 || at > MAX_SPLIT_MS) continue;
    seen.add(id);
    out.push({ id, at: Math.round(at) });
  }
  return out;
}

/** OLL and PLL are kept only when both were detected and they add up to Final. */
function normalizeLastLayer(raw, final) {
  const oll = Number(raw?.oll);
  const pll = Number(raw?.pll);
  if (!Number.isFinite(oll) || !Number.isFinite(pll) || oll < 0 || pll <= 0) return null;
  const ollMs = Math.round(oll);
  const pllMs = Math.round(pll);
  if (Math.abs(ollMs + pllMs - final) > 1) return null;
  return { oll: ollMs, pll: pllMs };
}

/** A look inside OLL or PLL. Dropped when it falls outside that parent stage. */
function normalizeLook(raw, key, max) {
  const n = Number(raw?.[key]);
  if (!Number.isFinite(n) || n < 0) return null;
  const ms = Math.round(n);
  if (ms > max) return null;
  return ms;
}

export function normalizeSplits(raw) {
  if (!raw || typeof raw !== "object") return null;
  const cross = Number(raw.cross);
  const f2l = Number(raw.f2l);
  const final = Number(raw.final);
  if (![cross, f2l, final].every((n) => Number.isFinite(n) && n >= 0)) return null;
  const out = { cross, f2l, final };
  const layer = normalizeLastLayer(raw, final);
  if (layer) {
    out.oll = layer.oll;
    out.pll = layer.pll;
    const yellowCross = normalizeLook(raw, "yellowCross", layer.oll);
    const headlights = normalizeLook(raw, "headlights", layer.pll);
    if (yellowCross != null) out.yellowCross = yellowCross;
    if (headlights != null) out.headlights = headlights;
  }
  const pairs = normalizePairs(raw.pairs);
  if (pairs.length) out.pairs = pairs;
  return out;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Local date and time for a stored solve. Blank when the solve has no timestamp. */
export function formatSolvedAt(at) {
  const n = solveTimestamp({ at });
  if (!n) return "";
  const d = new Date(n);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
}

/**
 * Union by id. For the same id, a timestamp already stored on the local record
 * is kept. The result is chronological by that timestamp.
 */
export function mergeSolves(local, remote) {
  const byId = new Map();
  for (const row of remote || []) {
    if (row?.id) byId.set(String(row.id), row);
  }
  for (const row of local || []) {
    if (!row?.id) continue;
    const id = String(row.id);
    const prev = byId.get(id);
    byId.set(id, prev ? preferLocalTimestamp(row, prev) : row);
  }
  return sortSolves([...byId.values()]);
}

function preferLocalTimestamp(local, remote) {
  const localAt = solveTimestamp(local);
  const remoteAt = solveTimestamp(remote);
  if (localAt > 0) return { ...remote, ...local, at: localAt };
  if (remoteAt > 0) return { ...local, ...remote, at: remoteAt };
  return { ...remote, ...local, at: 0 };
}

/**
 * What to send so a first sign-in uploads local solves, and a later sync does
 * not upload a solve this device already saved and another device deleted.
 */
function hasMoves(row) {
  return Array.isArray(row?.moves) && row.moves.length > 0;
}

export function planSync({ local = [], remote = [], uploadedIds = [], deletedIds = [] } = {}) {
  const remoteById = new Map();
  for (const row of remote || []) {
    if (row?.id) remoteById.set(String(row.id), row);
  }
  const uploaded = new Set((uploadedIds || []).map(String));
  const deleted = new Set((deletedIds || []).map(String));
  const upsert = [];
  for (const row of local || []) {
    const id = String(row?.id || "");
    if (!id || deleted.has(id)) continue;
    const remoteRow = remoteById.get(id);
    if (!remoteRow) {
      if (!uploaded.has(id)) upsert.push(row);
      continue;
    }
    // A solve can land in D1 before its move log (or from a copy that dropped it).
    // Send it again so moves_json is filled. A row that already has moves stays put.
    if (hasMoves(row) && !hasMoves(remoteRow)) upsert.push(row);
  }
  const deleteIds = [...deleted].filter((id) => remoteById.has(id));
  return { upsert, deleteIds };
}

/** Remote list plus local solves that still need a successful upload, in time order. */
function keepLocalMoves(local, remote) {
  if (!hasMoves(local) || hasMoves(remote)) return remote;
  return { ...remote, moves: local.moves };
}

export function reconcileSolves({ local = [], remote = [], uploadedIds = [], deletedIds = [] } = {}) {
  const deleted = new Set((deletedIds || []).map(String));
  const uploaded = new Set((uploadedIds || []).map(String));
  const localById = new Map();
  for (const row of local || []) {
    if (row?.id) localById.set(String(row.id), row);
  }
  const remoteKept = (remote || []).filter((row) => row?.id && !deleted.has(String(row.id)));
  const remoteIds = new Set(remoteKept.map((row) => String(row.id)));
  const remoteMerged = remoteKept.map((row) => keepLocalMoves(localById.get(String(row.id)), row));
  const pending = (local || []).filter((row) => {
    const id = String(row?.id || "");
    return id && !remoteIds.has(id) && !deleted.has(id) && !uploaded.has(id);
  });
  return mergeSolves(pending, remoteMerged);
}
