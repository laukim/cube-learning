/**
 * Map Acubemy solve JSON into 3x3coach D1 upsert rows (via /api/times).
 *
 * Idempotent ids: acubemy-{numericId}
 * Dry-run by default. --apply POSTs batches using CUBE_COACH_GOOGLE_ID_TOKEN.
 *
 *   node scripts/import-acubemy-solves.mjs path/to/details.json
 *   node scripts/import-acubemy-solves.mjs path/to/details.json --apply
 *   node scripts/import-acubemy-solves.mjs path/to/details.json --apply --api https://HOST/api/times
 */
import { readFileSync } from "node:fs";

const MAX_MS = 48 * 60 * 60 * 1000;
const MAX_AT = 4102444800000;
const BATCH = 100;

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const apiIdx = args.indexOf("--api");
const api = apiIdx >= 0 ? args[apiIdx + 1] : defaultApi();
const path = args.find((a, i) => !a.startsWith("--") && !(apiIdx >= 0 && i === apiIdx + 1));
const token = process.env.CUBE_COACH_GOOGLE_ID_TOKEN || process.env.GOOGLE_ID_TOKEN || "";

if (!path) {
  console.error("Usage: node scripts/import-acubemy-solves.mjs <details.json> [--apply] [--api url]");
  process.exit(2);
}

const raw = JSON.parse(readFileSync(path, "utf8"));
const mapped = mapFile(raw);
const valid = mapped.map(normalizeRow).filter(Boolean);

console.log(
  JSON.stringify(
    {
      input: path,
      mapped: mapped.length,
      valid: valid.length,
      dropped: mapped.length - valid.length,
      idPrefix: "acubemy-",
      sample: valid.slice(0, 2),
      apply,
      api,
    },
    null,
    2
  )
);

if (!apply) {
  console.error("Dry-run only. Re-run with --apply and CUBE_COACH_GOOGLE_ID_TOKEN to upsert into D1.");
  process.exit(0);
}
if (!token) {
  console.error("Missing CUBE_COACH_GOOGLE_ID_TOKEN (Google ID token for the 3x3coach account).");
  process.exit(1);
}

for (let i = 0; i < valid.length; i += BATCH) {
  const upsert = valid.slice(i, i + BATCH);
  const res = await fetch(api, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({ upsert }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("upsert failed", res.status, text.slice(0, 400));
    process.exit(1);
  }
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  console.log("batch", i, "+", upsert.length, "→ remote records", body?.records?.length ?? "?");
}

function defaultApi() {
  return "https://3x3coach.mocholate.workers.dev/api/times";
}

function mapFile(data) {
  if (Array.isArray(data?.records) && data.records[0]?.ms != null && data.records[0]?.id) {
    return data.records.map((row) => ({
      id: String(row.id).startsWith("acubemy-") ? String(row.id) : `acubemy-${row.id}`,
      ms: row.ms,
      at: row.at,
      scramble: row.scramble || "",
      splits: row.splits,
      moves: row.moves,
    }));
  }
  const list = Array.isArray(data)
    ? data
    : Object.values(data).filter((v) => v && typeof v === "object" && v.id != null && v.totalTime != null);
  return list.map(mapAcubemySolve).filter(Boolean);
}

export function mapAcubemySolve(s) {
  if (!s || s.id == null || s.totalTime == null || !s.date) return null;
  const ms = Math.round(Number(s.totalTime));
  const at = Date.parse(s.date);
  if (!Number.isFinite(ms) || ms <= 0 || !Number.isFinite(at)) return null;
  const out = {
    id: `acubemy-${s.id}`,
    ms,
    at,
    scramble: String(s.scramble || "").slice(0, 400),
  };
  const splits = stageSplits(s.analysis, ms);
  if (splits) out.splits = splits;
  const moves = mapMoves(s.rawSolutionSequence || s.solutionSequence);
  if (moves) out.moves = moves;
  return out;
}

function lastTs(seq) {
  let max = null;
  for (const m of seq || []) {
    const t = Number(m?.timeStamp);
    if (Number.isFinite(t) && (max == null || t > max)) max = t;
  }
  return max;
}

function stageSplits(analysis, total) {
  if (!analysis || typeof analysis !== "object") return null;
  const cross = analysis.cross?.moveSequence || [];
  const slots = analysis.f2l?.slots || [];
  const f2lMoves = slots.flatMap((sl) => sl?.moveSequence || []);
  const oll = analysis.oll?.moveSequence || [];
  const cEnd = lastTs(cross);
  const fEnd = lastTs(f2lMoves);
  if (cEnd == null || fEnd == null) return null;
  const final = Math.round(total - fEnd);
  const out = { cross: Math.round(cEnd), f2l: Math.round(fEnd - cEnd), final };
  const oEnd = lastTs(oll);
  if (oEnd != null) {
    const ollMs = Math.round(oEnd - fEnd);
    const pllMs = Math.round(total - oEnd);
    if (ollMs >= 0 && pllMs > 0 && Math.abs(ollMs + pllMs - final) <= 1) {
      out.oll = ollMs;
      out.pll = pllMs;
    }
  }
  return out;
}

function mapMoves(seq) {
  if (!Array.isArray(seq) || !seq.length) return null;
  const out = [];
  for (const m of seq) {
    if (out.length >= 400) break;
    const move = m?.sliceTurn || m?.move;
    const t = Number(m?.timeStamp ?? m?.t);
    if (!move || !Number.isFinite(t) || t < 0) continue;
    if (!/^[URFDLB](?:'|2)?$/.test(String(move))) continue;
    out.push({ move: String(move), t: Math.round(t) });
  }
  return out.length ? out : null;
}

function normalizeRow(row) {
  if (!row || typeof row !== "object") return null;
  const id = String(row.id || "");
  if (!id || id.length > 120 || /[\s\u0000-\u001f]/.test(id)) return null;
  const ms = Number(row.ms);
  if (!Number.isFinite(ms) || ms <= 0 || ms > MAX_MS) return null;
  const atRaw = Number(row.at);
  if (!Number.isFinite(atRaw) || atRaw < 0 || atRaw > MAX_AT) return null;
  const out = {
    id,
    ms: Math.round(ms),
    at: atRaw > 0 ? Math.round(atRaw) : 0,
    scramble: String(row.scramble || "").slice(0, 400),
  };
  if (row.splits && typeof row.splits === "object") {
    const cross = Number(row.splits.cross);
    const f2l = Number(row.splits.f2l);
    const final = Number(row.splits.final);
    if ([cross, f2l, final].every((n) => Number.isFinite(n) && n >= 0)) {
      out.splits = { cross: Math.round(cross), f2l: Math.round(f2l), final: Math.round(final) };
      const oll = Number(row.splits.oll);
      const pll = Number(row.splits.pll);
      if (Number.isFinite(oll) && Number.isFinite(pll) && oll >= 0 && pll > 0 && Math.abs(oll + pll - final) <= 1) {
        out.splits.oll = Math.round(oll);
        out.splits.pll = Math.round(pll);
      }
    }
  }
  if (Array.isArray(row.moves) && row.moves.length) out.moves = row.moves;
  return out;
}
