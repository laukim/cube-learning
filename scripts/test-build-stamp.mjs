import { readFileSync } from "node:fs";
import { APP_BUILD, APP_VERSION } from "../worker/app-version.js";
import { applyBuildStamp, versionEtag } from "../worker/build-stamp.js";
import worker, { PAGE_PATHS } from "../worker/index.js";
import {
  allocateBuild,
  buildFromCommitCount,
  footerVersion,
  formatReleaseVersion,
  releaseBuildNumber,
} from "../worker/release-version.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const versionA = {
  id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  timestamp: "2026-10-11T09:33:00.000Z",
};
const versionB = {
  id: "bbbbbbbb-cccc-dddd-eeee-ffffffffffff",
  timestamp: "2026-10-12T18:04:00.000Z",
};

assert(formatReleaseVersion("1.0.0", 2) === "v1.02", "major from package.json plus build 2 is v1.02");
assert(formatReleaseVersion("1", 104) === "v1.104", "build numbers grow past two digits");
assert(formatReleaseVersion("1.0.0", 0) === "v0.0.0-dev", "a missing build stays the dev placeholder");
assert(buildFromCommitCount(105) === 2, "the introducing commit displays as build 2");
assert(buildFromCommitCount(106) === 3, "the next commit bumps the build");
assert(buildFromCommitCount(103) === 0, "commits at the baseline are not a release");
assert(releaseBuildNumber({ command: "deploy", commitCount: 105 }) === 2, "wrangler deploy stamps the commit");
assert(releaseBuildNumber({ command: "versions upload", commitCount: 106 }) === 3, "preview uploads stamp too");
assert(releaseBuildNumber({ workersCi: "1", commitCount: 105 }) === 2, "Workers Builds stamps the commit");
assert(releaseBuildNumber({ command: "dev", commitCount: 105 }) === 0, "local wrangler dev stays on the placeholder");
assert(releaseBuildNumber({ commitCount: 105 }) === 0, "a plain static serve does not bump");

const stampA = footerVersion({ meta: versionA, version: "1.0.0", build: 2 });
const stampB = footerVersion({ meta: versionB, version: "1.0.0", build: 3 });
assert(stampA.text === "v1.02", `stamp A was ${stampA.text}`);
assert(stampB.text === "v1.03", `stamp B was ${stampB.text}`);
assert(stampA.text !== stampB.text, "two releases must show different versions");
assert(!stampA.text.includes("a1b2c3d"), "the visible version is not the deploy hash");
assert(!stampA.text.includes("local"), "the visible version is not local");
assert(stampA.title === "Version v1.02", "the tooltip repeats the short version");
assert(footerVersion({ meta: null, version: "1.0.0", build: 2 }).text === "v0.0.0-dev", "missing metadata stays dev");
assert(versionEtag(versionA) === `"${versionA.id}"`, "etag is the full version id");
assert(versionEtag({}) === "", "empty metadata has no etag");

const fallbackA = footerVersion({ meta: versionA, version: "1" });
const fallbackB = footerVersion({ meta: versionB, version: "1" });
assert(/^v1\.\d{2,}$/.test(fallbackA.text), `fallback A was ${fallbackA.text}`);
assert(fallbackA.text !== fallbackB.text, "two deploys differ even without an allocated build");
assert(!fallbackA.text.includes("local"), "fallback is not the word local");

const sample = `<footer><span class="build-stamp" data-build-stamp>v0.0.0-dev</span></footer>`;
const applied = applyBuildStamp(sample, stampA);
assert(applied.found, "placeholder is replaced");
assert(applied.html.includes(">v1.02<"), "footer text is the release version");
assert(!applied.html.includes("v0.0.0-dev"), "dev placeholder is gone");
assert(!applied.html.includes(">local<"), "local is not a version");
assert(applied.html.includes('title="Version v1.02"'), "title is the short version");

const sneaky = applyBuildStamp(`<span class="build-stamp" data-build-stamp>v0.0.0-dev</span>`, {
  text: `v1.02<script>`,
  title: `Version "><img`,
});
assert(!sneaky.html.includes("<script>"), "version text is escaped");
assert(!sneaky.html.includes("<img"), "version title is escaped");

function stampText(html) {
  const match = html.match(/<span\b[^>]*\sdata-build-stamp\b[^>]*>([^<]*)<\/span>/i);
  return match ? match[1] : "";
}

for (const file of ["timer.html", "index.html"]) {
  const html = readFileSync(file, "utf8");
  assert(html.includes('data-build-stamp'), `${file} has a build stamp`);
  assert(stampText(html) === "v0.0.0-dev", `${file} placeholder is the dev version, was ${stampText(html)}`);
  assert(!html.includes(">local<"), `${file} does not show local`);
  assert(html.includes("Works offline"), `${file} keeps the offline note`);
  const live = applyBuildStamp(html, stampA);
  assert(live.found && stampText(live.html) === "v1.02", `${file} picks up v1.02`);
  assert(live.html.includes("Works offline"), `${file} keeps the offline note after stamping`);
  assert(!stampText(live.html).includes("Works offline"), `${file} version line is only the version`);
}

function memoryDb() {
  const rows = new Map();
  return {
    prepare(sql) {
      const exec = (args) => {
        if (sql.includes("CREATE TABLE")) return { success: true };
        if (sql.includes("SELECT n FROM")) {
          const n = rows.get(args[0]);
          return n == null ? null : { n };
        }
        if (sql.includes("COALESCE(MAX")) {
          let max = 0;
          for (const n of rows.values()) if (n > max) max = n;
          return { n: max + 1 };
        }
        if (sql.startsWith("INSERT")) {
          const [id, n] = args;
          if (rows.has(id) || [...rows.values()].includes(n)) throw new Error("constraint");
          rows.set(id, n);
          return { success: true };
        }
        throw new Error(`unexpected sql ${sql}`);
      };
      return {
        bind(...args) {
          return {
            run: async () => exec(args),
            first: async () => exec(args),
          };
        },
        run: async () => exec([]),
        first: async () => exec([]),
      };
    },
  };
}

const db = memoryDb();
assert(await allocateBuild(db, versionA.id) === 1, "first deploy is build 1");
assert(await allocateBuild(db, versionA.id) === 1, "the same deploy keeps its build");
assert(await allocateBuild(db, versionB.id) === 2, "the next deploy is build 2");
assert(footerVersion({ meta: versionA, version: "1.0.0", build: 1 }).text === "v1.01", "build 1 displays v1.01");
assert(footerVersion({ meta: versionB, version: "1.0.0", build: 2 }).text === "v1.02", "build 2 displays v1.02");

function assetsOf(pages) {
  return {
    async fetch(request) {
      const { pathname } = new URL(request.url);
      const html = pages[pathname];
      if (!html) return new Response("missing", { status: 404 });
      return new Response(html, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          etag: '"file-bytes"',
          "cache-control": "public, max-age=0, must-revalidate",
        },
      });
    },
  };
}

const pages = {
  "/": readFileSync("index.html", "utf8"),
  "/index.html": readFileSync("index.html", "utf8"),
  "/timer": readFileSync("timer.html", "utf8"),
  "/timer.html": readFileSync("timer.html", "utf8"),
};

function wranglerRunWorkerFirst() {
  const raw = readFileSync("wrangler.jsonc", "utf8").replace(/^\s*\/\/.*$/gm, "");
  return JSON.parse(raw).assets.run_worker_first;
}

const workerFirst = wranglerRunWorkerFirst();
assert(workerFirst.includes("/api/*"), "the times API still runs in the worker");
for (const path of PAGE_PATHS) {
  assert(workerFirst.includes(path), `run_worker_first is missing ${path}, so assets would skip the footer stamp`);
}
assert(PAGE_PATHS.has("/timer"), "the extensionless timer URL is a stamped page");

const sharedDb = memoryDb();
const envA = { ASSETS: assetsOf(pages), CF_VERSION_METADATA: versionA, DB: sharedDb };
const timer = await worker.fetch(new Request("https://3x3coach.example/timer.html"), envA);
assert(timer.status === 200, "timer page is served");
const timerHtml = await timer.text();
const timerStamp = stampText(timerHtml);
assert(/^v1\.\d{2,}$/.test(timerStamp), `timer footer shows a short version, was ${timerStamp}`);
assert(!timerStamp.includes("local"), "timer footer does not say local");
assert(!timerHtml.includes(versionA.id), "timer footer does not include the deploy id");
assert(timerHtml.includes("Works offline · times stay on this device"), "timer keeps the offline note");
assert(timerHtml.includes("a connected GAN cube"), "timer keeps the cube tip");
assert(!timerStamp.includes("Works offline"), "the version line is not the help text");
assert(timer.headers.get("etag") === `"${versionA.id}"`, "etag changes with the deploy");
assert(timer.headers.get("cache-control").includes("must-revalidate"), "browser revalidates before reuse");

const coach = await worker.fetch(new Request("https://3x3coach.example/"), envA);
const coachHtml = await coach.text();
assert(stampText(coachHtml) === timerStamp, "coach and timer share this deploy's version");
assert(coachHtml.includes("Works offline · no account"), "coach keeps the offline note");
assert(coachHtml.includes("Pieces"), "coach keeps the cube tip");

const prettyTimer = await worker.fetch(new Request("https://3x3coach.example/timer"), envA);
assert(prettyTimer.status === 200, "extensionless /timer is served");
const prettyHtml = await prettyTimer.text();
const prettyStamp = stampText(prettyHtml);
assert(prettyStamp === timerStamp, `/timer footer matches /timer.html, was ${prettyStamp}`);
assert(prettyStamp !== "v0.0.0-dev", "/timer does not keep the dev placeholder");
assert(!prettyHtml.includes(versionA.id), "/timer footer does not include the deploy id");
assert(prettyTimer.headers.get("content-type").includes("text/html"), "/timer is html");
assert(prettyTimer.headers.get("etag") === `"${versionA.id}"`, "/timer etag matches this deploy");

function htmlHandlingAssets(files) {
  const redirects = {
    "/index.html": "/",
    "/timer.html": "/timer",
    "/timer/": "/timer",
  };
  return {
    async fetch(request) {
      const { pathname } = new URL(request.url);
      const target = redirects[pathname];
      if (target) return new Response(null, { status: 307, headers: { location: target } });
      const html = files[pathname];
      if (!html) return new Response("missing", { status: 404 });
      return new Response(html, {
        headers: { "content-type": "text/html", "cache-control": "public, max-age=0, must-revalidate" },
      });
    },
  };
}

const handledEnv = {
  ASSETS: htmlHandlingAssets({
    "/": pages["/"],
    "/timer": pages["/timer"],
  }),
  CF_VERSION_METADATA: versionA,
  DB: memoryDb(),
};
const handledTimer = await worker.fetch(new Request("https://3x3coach.example/timer"), handledEnv);
assert(handledTimer.status === 200, "canonical /timer is stamped when assets redirect the .html URL");
const handledStamp = stampText(await handledTimer.text());
assert(handledStamp === stampText(coachHtml), `canonical /timer shares the coach version, was ${handledStamp}`);
assert(handledStamp !== "v0.0.0-dev", "canonical /timer is not the dev placeholder");
const handledLegacy = await worker.fetch(new Request("https://3x3coach.example/timer.html"), handledEnv);
assert(handledLegacy.status === 307, "/timer.html still redirects to the canonical timer URL");
assert(handledLegacy.headers.get("location") === "/timer", "/timer.html redirects to /timer");

const next = await worker.fetch(new Request("https://3x3coach.example/timer.html"), {
  ASSETS: assetsOf(pages),
  CF_VERSION_METADATA: versionB,
  DB: sharedDb,
});
const nextStamp = stampText(await next.text());
if (APP_BUILD > 0) {
  assert(timerStamp === APP_VERSION && nextStamp === APP_VERSION, "a baked release version is shown as-is");
} else {
  assert(timerStamp === "v1.01", `unbaked first deploy was ${timerStamp}`);
  assert(nextStamp === "v1.02", `unbaked next deploy was ${nextStamp}`);
}
assert(nextStamp !== "v0.0.0-dev", "production does not keep the dev placeholder");

const cached = await worker.fetch(
  new Request("https://3x3coach.example/timer.html", { headers: { "if-none-match": `"${versionA.id}"` } }),
  envA
);
assert(cached.status === 304, "the same deploy can answer 304");

const css = await worker.fetch(new Request("https://3x3coach.example/styles.css"), envA);
assert(css.status === 404, "static files other than the coach pages stay with assets");

const plain = await worker.fetch(new Request("https://3x3coach.example/timer.html"), {
  ASSETS: {
    async fetch() {
      return new Response("no stamp here", { headers: { "content-type": "text/html; charset=utf-8" } });
    },
  },
  CF_VERSION_METADATA: versionA,
  DB: memoryDb(),
});
assert((await plain.text()) === "no stamp here", "html without a stamp placeholder is left as-is");

console.log("build stamp ok");
