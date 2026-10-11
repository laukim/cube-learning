import { applyBuildStamp, versionEtag } from "./build-stamp.js";
import { handleTimesRequest } from "./times-api.js";

const PAGE_PATHS = new Set(["/", "/index.html", "/timer.html"]);

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
  const stamped = applyBuildStamp(raw, env.CF_VERSION_METADATA);
  const headers = new Headers(asset.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.set("content-type", "text/html; charset=utf-8");
  if (!headers.has("cache-control")) headers.set("cache-control", "public, max-age=0, must-revalidate");
  if (stamped.found && etag) headers.set("etag", etag);
  return new Response(stamped.html, { status: 200, headers });
}

function cacheHeaders(etag) {
  return {
    etag,
    "cache-control": "public, max-age=0, must-revalidate",
  };
}
