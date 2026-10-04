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

export function normalizeSplits(raw) {
  if (!raw || typeof raw !== "object") return null;
  const cross = Number(raw.cross);
  const f2l = Number(raw.f2l);
  const final = Number(raw.final);
  if (![cross, f2l, final].every((n) => Number.isFinite(n) && n >= 0)) return null;
  return { cross, f2l, final };
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
export function planSync({ local = [], remote = [], uploadedIds = [], deletedIds = [] } = {}) {
  const remoteIds = new Set((remote || []).map((row) => String(row.id)));
  const uploaded = new Set((uploadedIds || []).map(String));
  const deleted = new Set((deletedIds || []).map(String));
  const upsert = [];
  for (const row of local || []) {
    const id = String(row?.id || "");
    if (!id || deleted.has(id) || remoteIds.has(id) || uploaded.has(id)) continue;
    upsert.push(row);
  }
  const deleteIds = [...deleted].filter((id) => remoteIds.has(id));
  return { upsert, deleteIds };
}

/** Remote list plus local solves that still need a successful upload, in time order. */
export function reconcileSolves({ local = [], remote = [], uploadedIds = [], deletedIds = [] } = {}) {
  const deleted = new Set((deletedIds || []).map(String));
  const uploaded = new Set((uploadedIds || []).map(String));
  const remoteKept = (remote || []).filter((row) => row?.id && !deleted.has(String(row.id)));
  const remoteIds = new Set(remoteKept.map((row) => String(row.id)));
  const pending = (local || []).filter((row) => {
    const id = String(row?.id || "");
    return id && !remoteIds.has(id) && !deleted.has(id) && !uploaded.has(id);
  });
  return mergeSolves(pending, remoteKept);
}
