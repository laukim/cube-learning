import { APP_BUILD, APP_MAJOR } from "./app-version.js";
import { applyBuildStamp, versionEtag } from "./build-stamp.js";
import { allocateBuild, footerVersion } from "./release-version.js";
import { handleTimesRequest } from "./times-api.js";

// `/` is the timer home. html_handling serves timer.html at /timer, pll.html
// at /pll, and training.html at /training, and redirects the .html and
// trailing-slash URLs there. Those paths have to run the worker or the footer
// stays the unstamped v0.0.0-dev file.
export const PAGE_PATHS = new Set([
  "/",
  "/index.html",
  "/timer",
  "/timer.html",
  "/pll",
  "/pll.html",
  "/training",
  "/training.html",
]);

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/times") return handleTimesRequest(request, env);
    if (PAGE_PATHS.has(pathname) && (request.method === "GET" || request.method === "HEAD")) {
      return serveStampedPage(request, env);
    }
    return new Response("Not found", { status: 404 });
  },
};

async function serveStampedPage(request, env) {
  if (!env?.ASSETS || typeof env.ASSETS.fetch !== "function") {
    return new Response("Not found", { status: 404 });
  }

  const etag = versionEtag(env.CF_VERSION_METADATA);
  if (etag && request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: cacheHeaders(etag) });
  }

  const asset = await env.ASSETS.fetch(new Request(request.url, { method: "GET", redirect: "manual" }));
  if (asset.status !== 200) return asset;
  const type = asset.headers.get("content-type") || "";
  if (!type.includes("text/html")) return asset;

  const raw = await asset.text();
  const stamped = applyBuildStamp(raw, await footerStamp(env));
  const headers = new Headers(asset.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.set("content-type", "text/html; charset=utf-8");
  if (!headers.has("cache-control")) headers.set("cache-control", "public, max-age=0, must-revalidate");
  if (stamped.found && etag) headers.set("etag", etag);
  return new Response(stamped.html, { status: 200, headers });
}

async function footerStamp(env) {
  const meta = env?.CF_VERSION_METADATA;
  const id = typeof meta?.id === "string" ? meta.id.trim() : "";
  let build = APP_BUILD;
  if (id && !(Number(build) > 0) && env?.DB && typeof env.DB.prepare === "function") {
    try {
      build = await allocateBuild(env.DB, id);
    } catch {
      console.error("release version allocation failed");
    }
  }
  return footerVersion({ meta, version: APP_MAJOR, build });
}

function cacheHeaders(etag) {
  return {
    etag,
    "cache-control": "public, max-age=0, must-revalidate",
  };
}
