export const DEV_VERSION = "v0.0.0-dev";

// Footer build number is the git commit count minus this base.
// 105 commits displays as v1.02; each later commit on main adds one.
export const RELEASE_COMMIT_BASE = 103;

const ready = new WeakMap();
const buildsByDb = new WeakMap();

const CREATE_BUILDS = `CREATE TABLE IF NOT EXISTS app_builds (
  version_id TEXT PRIMARY KEY,
  n INTEGER NOT NULL UNIQUE
)`;

export function releaseMajor(version) {
  const match = /^(\d+)/.exec(String(version ?? "").trim());
  return match ? match[1] : "1";
}

export function formatReleaseVersion(version, build) {
  const n = Number(build);
  if (!Number.isInteger(n) || n < 1) return DEV_VERSION;
  return `v${releaseMajor(version)}.${String(n).padStart(2, "0")}`;
}

export function buildFromCommitCount(count, base = RELEASE_COMMIT_BASE) {
  const n = Number(count);
  const start = Number(base);
  if (!Number.isInteger(n) || !Number.isInteger(start) || n <= start) return 0;
  return n - start;
}

export function releaseBuildNumber({ command = "", workersCi = "", commitCount = 0 } = {}) {
  const production = command === "deploy" || command === "versions upload" || String(workersCi) === "1";
  if (!production) return 0;
  return buildFromCommitCount(commitCount);
}

export function footerVersion({ meta, version = "1", build = 0 } = {}) {
  const id = typeof meta?.id === "string" ? meta.id.trim() : "";
  if (!id) return { text: DEV_VERSION, title: "Local preview" };
  const allocated = Number(build);
  const n = Number.isInteger(allocated) && allocated > 0 ? allocated : fallbackBuild(id);
  const text = formatReleaseVersion(version, n);
  return { text, title: `Version ${text}` };
}

function fallbackBuild(id) {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 90000 + 1;
}

function cacheFor(db) {
  let cache = buildsByDb.get(db);
  if (!cache) {
    cache = new Map();
    buildsByDb.set(db, cache);
  }
  return cache;
}

function ensureBuildTable(db) {
  let pending = ready.get(db);
  if (!pending) {
    pending = db.prepare(CREATE_BUILDS).run();
    ready.set(db, pending);
  }
  return pending;
}

export async function allocateBuild(db, versionId) {
  const id = typeof versionId === "string" ? versionId.trim() : "";
  if (!id || !db || typeof db.prepare !== "function") return 0;
  const cache = cacheFor(db);
  if (cache.has(id)) return cache.get(id);

  await ensureBuildTable(db);
  const existing = await db.prepare("SELECT n FROM app_builds WHERE version_id = ?").bind(id).first();
  const found = Number(existing?.n);
  if (Number.isInteger(found) && found > 0) {
    cache.set(id, found);
    return found;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const row = await db.prepare("SELECT COALESCE(MAX(n), 0) + 1 AS n FROM app_builds").first();
    const n = Number(row?.n);
    if (!Number.isInteger(n) || n < 1) break;
    try {
      await db.prepare("INSERT INTO app_builds (version_id, n) VALUES (?, ?)").bind(id, n).run();
      cache.set(id, n);
      return n;
    } catch {
      const again = await db.prepare("SELECT n FROM app_builds WHERE version_id = ?").bind(id).first();
      const kept = Number(again?.n);
      if (Number.isInteger(kept) && kept > 0) {
        cache.set(id, kept);
        return kept;
      }
    }
  }
  return 0;
}
