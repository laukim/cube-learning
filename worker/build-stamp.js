export function formatBuildStamp(meta) {
  const id = typeof meta?.id === "string" ? meta.id.trim() : "";
  const timestamp = typeof meta?.timestamp === "string" ? meta.timestamp.trim() : "";
  if (!id) return { text: "local", title: "Local preview" };
  const short = id.replace(/-/g, "").slice(0, 7) || id.slice(0, 7);
  const date = formatStampDate(timestamp);
  return {
    text: date ? `${short} · ${date}` : short,
    title: timestamp ? `Deploy ${id} · ${timestamp}` : `Deploy ${id}`,
  };
}

export function versionEtag(meta) {
  const id = typeof meta?.id === "string" ? meta.id.trim() : "";
  if (!id) return "";
  return `"${id.replaceAll('"', "")}"`;
}

export function applyBuildStamp(html, meta) {
  const stampTag = /<span\b([^>]*\sdata-build-stamp\b[^>]*)>[\s\S]*?<\/span>/gi;
  const stamp = formatBuildStamp(meta);
  let found = false;
  const next = html.replace(stampTag, (_full, attrs) => {
    found = true;
    const withoutTitle = attrs.replace(/\s+title="[^"]*"/gi, "");
    return `<span${withoutTitle} title="${escapeHtml(stamp.title)}">${escapeHtml(stamp.text)}</span>`;
  });
  return { html: next, found, stamp };
}

function formatStampDate(timestamp) {
  if (!timestamp) return "";
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(timestamp);
  if (iso) return iso[1];
  const numeric = Number(timestamp);
  if (!Number.isFinite(numeric)) return "";
  const ms = numeric < 1e12 ? numeric * 1000 : numeric;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
