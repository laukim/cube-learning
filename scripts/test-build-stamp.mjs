import { readFileSync } from "node:fs";
import { applyBuildStamp, formatBuildStamp, versionEtag } from "../worker/build-stamp.js";
import worker from "../worker/index.js";

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

const stampA = formatBuildStamp(versionA);
const stampB = formatBuildStamp(versionB);
assert(stampA.text === "a1b2c3d · 2026-10-11", `stamp A was ${stampA.text}`);
assert(stampB.text === "bbbbbbb · 2026-10-12", `stamp B was ${stampB.text}`);
assert(stampA.text !== stampB.text, "two deploys must show different stamps");
assert(formatBuildStamp({ id: versionA.id, timestamp: "1700000000" }).text.endsWith("· 2023-11-14"), "unix seconds become a date");
assert(formatBuildStamp(null).text === "local", "missing metadata stays local");
assert(formatBuildStamp({ id: "deadbeef", timestamp: "" }).text === "deadbee", "a short id is kept when there is no date");
assert(versionEtag(versionA) === `"${versionA.id}"`, "etag is the full version id");
assert(versionEtag({}) === "", "empty metadata has no etag");

const sample = `<footer><span class="build-stamp" data-build-stamp>local</span></footer>`;
const applied = applyBuildStamp(sample, versionA);
assert(applied.found, "placeholder is replaced");
assert(applied.html.includes("a1b2c3d · 2026-10-11"), "footer text is the deploy stamp");
assert(!applied.html.includes(">local<"), "local placeholder is gone");
assert(applied.html.includes(`title="Deploy ${versionA.id} · ${versionA.timestamp}"`), "title keeps the full version id");

const sneaky = applyBuildStamp(
  `<span class="build-stamp" data-build-stamp>local</span>`,
  { id: `abc<script>`, timestamp: `2026-10-11"><img` }
);
assert(!sneaky.html.includes("<script>"), "version text is escaped");
assert(!sneaky.html.includes("<img"), "version title is escaped");

for (const file of ["timer.html", "index.html"]) {
  const html = readFileSync(file, "utf8");
  assert(html.includes('data-build-stamp'), `${file} has a build stamp`);
  const live = applyBuildStamp(html, versionA);
  assert(live.found && live.html.includes("a1b2c3d · 2026-10-11"), `${file} picks up the deploy stamp`);
}

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
  "/timer.html": readFileSync("timer.html", "utf8"),
};

const envA = { ASSETS: assetsOf(pages), CF_VERSION_METADATA: versionA };
const timer = await worker.fetch(new Request("https://3x3coach.example/timer.html"), envA);
assert(timer.status === 200, "timer page is served");
const timerHtml = await timer.text();
assert(timerHtml.includes("a1b2c3d · 2026-10-11"), "timer footer shows this deploy");
assert(timer.headers.get("etag") === `"${versionA.id}"`, "etag changes with the deploy");
assert(timer.headers.get("cache-control").includes("must-revalidate"), "browser revalidates before reuse");

const coach = await worker.fetch(new Request("https://3x3coach.example/"), envA);
assert((await coach.text()).includes("a1b2c3d · 2026-10-11"), "coach footer shows this deploy");

const next = await worker.fetch(new Request("https://3x3coach.example/timer.html"), {
  ASSETS: assetsOf(pages),
  CF_VERSION_METADATA: versionB,
});
assert((await next.text()).includes("bbbbbbb · 2026-10-12"), "a later deploy replaces the stamp");

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
});
assert((await plain.text()) === "no stamp here", "html without a stamp placeholder is left as-is");

console.log("build stamp ok");
