import { DEV_VERSION } from "./release-version.js";

export function applyBuildStamp(html, stamp) {
  const text = typeof stamp?.text === "string" && stamp.text ? stamp.text : DEV_VERSION;
  const title = typeof stamp?.title === "string" ? stamp.title : "";
  const stampTag = /<span\b([^>]*\sdata-build-stamp\b[^>]*)>[\s\S]*?<\/span>/gi;
  let found = false;
  const next = html.replace(stampTag, (_full, attrs) => {
    found = true;
    const withoutTitle = attrs.replace(/\s+title="[^"]*"/gi, "");
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
    return `<span${withoutTitle}${titleAttr}>${escapeHtml(text)}</span>`;
  });
  return { html: next, found, stamp: { text, title } };
}

export function versionEtag(meta) {
  const id = typeof meta?.id === "string" ? meta.id.trim() : "";
  if (!id) return "";
  return `"${id.replaceAll('"', "")}"`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
