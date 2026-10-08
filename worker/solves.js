import { normalizeSplits } from "../js/solve-order.js";

const MAX_MS = 48 * 60 * 60 * 1000;
const MAX_AT = 4102444800000;

const ready = new WeakMap();

const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS solves (
  user_sub TEXT NOT NULL,
  id TEXT NOT NULL,
  ms INTEGER NOT NULL,
  solved_at INTEGER NOT NULL,
  scramble TEXT NOT NULL DEFAULT '',
  splits_json TEXT,
  PRIMARY KEY (user_sub, id)
)`;

const CREATE_INDEX = `CREATE INDEX IF NOT EXISTS solves_by_time ON solves (user_sub, solved_at, id)`;

export function ensureSchema(db) {
  let pending = ready.get(db);
  if (!pending) {
    pending = (async () => {
      await db.prepare(CREATE_TABLE).run();
      await db.prepare(CREATE_INDEX).run();
    })();
    ready.set(db, pending);
  }
  return pending;
}

export function normalizeStoredSolve(row) {
  if (!row || typeof row !== "object") return null;
  const id = String(row.id || "");
  if (!validId(id)) return null;
  const ms = Number(row.ms);
  if (!Number.isFinite(ms) || ms <= 0 || ms > MAX_MS) return null;
  let at = 0;
  if (row.at != null && row.at !== "") {
    const atRaw = Number(row.at);
    if (!Number.isFinite(atRaw) || atRaw < 0 || atRaw > MAX_AT) return null;
    at = atRaw > 0 ? Math.round(atRaw) : 0;
  }
  const record = {
    id,
    ms: Math.round(ms),
    at,
    scramble: String(row.scramble || "").slice(0, 400),
  };
  const splits = normalizeSplits(row.splits);
  if (splits) record.splits = splits;
  return record;
}

function validId(id) {
  return Boolean(id) && id.length <= 120 && !/[\s\u0000-\u001f]/.test(id);
}

export async function listSolves(db, sub) {
  const listed = await db
    .prepare(
      `SELECT id, ms, solved_at, scramble, splits_json
       FROM solves
       WHERE user_sub = ?
       ORDER BY solved_at ASC, id ASC`
    )
    .bind(sub)
    .all();
  return (listed?.results || []).map(mapRow).filter(Boolean);
}

export async function upsertSolves(db, sub, records) {
  const sql = `INSERT INTO solves (user_sub, id, ms, solved_at, scramble, splits_json)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (user_sub, id) DO NOTHING`;
  const statements = records.map((row) =>
    db
      .prepare(sql)
      .bind(sub, row.id, row.ms, row.at, row.scramble, row.splits ? JSON.stringify(row.splits) : null)
  );
  await runAll(db, statements);
}

export async function deleteSolves(db, sub, ids) {
  const unique = [...new Set(ids.map(String).filter(validId))];
  if (!unique.length) return;
  const sql = `DELETE FROM solves WHERE user_sub = ? AND id = ?`;
  const statements = unique.map((id) => db.prepare(sql).bind(sub, id));
  await runAll(db, statements);
}

export async function clearSolves(db, sub) {
  await db.prepare(`DELETE FROM solves WHERE user_sub = ?`).bind(sub).run();
}

async function runAll(db, statements) {
  if (!statements.length) return;
  if (typeof db.batch === "function") {
    for (let i = 0; i < statements.length; i += 40) {
      await db.batch(statements.slice(i, i + 40));
    }
    return;
  }
  for (const statement of statements) await statement.run();
}

function mapRow(row) {
  const record = {
    id: String(row.id),
    ms: Number(row.ms),
    at: Number(row.solved_at) > 0 ? Number(row.solved_at) : 0,
    scramble: String(row.scramble || ""),
  };
  if (row.splits_json) {
    try {
      const splits = normalizeSplits(JSON.parse(row.splits_json));
      if (splits) record.splits = splits;
    } catch {
      /* keep the solve even if the stage split JSON is unreadable */
    }
  }
  return record;
}
