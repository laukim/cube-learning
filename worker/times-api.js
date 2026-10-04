import { verifyGoogleIdToken } from "../js/google-jwt.js";
import { clearSolves, deleteSolves, ensureSchema, listSolves, normalizeStoredSolve, upsertSolves } from "./solves.js";

const MAX_BODY = 1_000_000;

export async function handleTimesRequest(request, env, deps = {}) {
  const verify = deps.verify || verifyGoogleIdToken;
  const token = bearerToken(request);
  if (!token) return json({ error: "Sign in required" }, 401);

  let identity;
  try {
    identity = await verify(token);
  } catch {
    return json({ error: "Sign in required" }, 401);
  }
  const sub = identity?.sub;
  if (!sub) return json({ error: "Sign in required" }, 401);

  try {
    await ensureSchema(env.DB);
    if (request.method === "GET") {
      return json({ records: await listSolves(env.DB, sub) });
    }
    if (request.method === "POST") {
      const body = await readJson(request);
      if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Invalid body" }, 400);
      if (body.clear === true) await clearSolves(env.DB, sub);
      const deleteIds = Array.isArray(body.deleteIds) ? body.deleteIds.slice(0, 500) : [];
      if (deleteIds.length) await deleteSolves(env.DB, sub, deleteIds);
      const upsert = [];
      for (const row of Array.isArray(body.upsert) ? body.upsert.slice(0, 500) : []) {
        const record = normalizeStoredSolve(row);
        if (record) upsert.push(record);
      }
      if (upsert.length) await upsertSolves(env.DB, sub, upsert);
      return json({ records: await listSolves(env.DB, sub) });
    }
    return json({ error: "Method not allowed" }, 405);
  } catch {
    console.error("times sync failed");
    return json({ error: "Could not sync times" }, 500);
  }
}

function bearerToken(request) {
  const header = request.headers.get("authorization") || "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match ? match[1] : "";
}

async function readJson(request) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > MAX_BODY) return null;
  const text = await request.text();
  if (text.length > MAX_BODY) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
