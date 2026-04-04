export function normalizeUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (/^[a-z]+:\/\//i.test(trimmed) || /^(data|blob):/i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function parseExternalUrl(value: string) {
  try {
    const parsed = new URL(value);

    if (
      parsed.protocol !== "http:" &&
      parsed.protocol !== "https:" &&
      parsed.protocol !== "data:" &&
      parsed.protocol !== "blob:"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function normalizeHostname(hostname: string) {
  return hostname.trim().replace(/\.+$/, "").toLowerCase();
}

function isResolvableHostname(hostname: string) {
  const normalized = normalizeHostname(hostname);

  if (!normalized) {
    return false;
  }

  if (normalized === "localhost") {
    return true;
  }

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(normalized)) {
    return true;
  }

  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    return true;
  }

  return normalized.includes(".");
}

function sanitizeImageUrl(value: string) {
  const normalized = normalizeUrl(value);

  if (!normalized) {
    return "";
  }

  const parsed = parseExternalUrl(normalized);

  if (!parsed) {
    return "";
  }

  return normalized;
}

function sanitizeStoredIconUrl(value: string) {
  const sanitized = sanitizeImageUrl(value);

  if (!sanitized) {
    return "";
  }

  const parsed = parseExternalUrl(sanitized);

  if (!parsed || parsed.protocol === "data:" || parsed.protocol === "blob:") {
    return sanitized;
  }

  if (parsed.hostname.includes("google.com") && parsed.pathname.includes("/s2/favicons")) {
    const domain = normalizeHostname(parsed.searchParams.get("domain") ?? "");
    return isResolvableHostname(domain) ? sanitized : "";
  }

  if (parsed.hostname.includes("gstatic.com") && parsed.pathname.includes("/faviconV2")) {
    const targetUrl = parsed.searchParams.get("url") ?? "";
    const target = parseExternalUrl(normalizeUrl(targetUrl));
    const targetHostname = normalizeHostname(target?.hostname ?? "");

    return isResolvableHostname(targetHostname) ? sanitized : "";
  }

  return sanitized;
}

export function getFaviconUrl(url: string) {
  const normalized = normalizeUrl(url);
  const parsed = parseExternalUrl(normalized);
  const hostname = normalizeHostname(parsed?.hostname ?? "");

  if (!isResolvableHostname(hostname)) {
    return "";
  }

  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=128`;
}

export function resolveLinkIconUrl({
  url,
  customIconUrl,
  iconUrl,
}: {
  url: string;
  customIconUrl?: string | null;
  iconUrl?: string | null;
}) {
  return (
    sanitizeImageUrl(customIconUrl ?? "") ||
    sanitizeStoredIconUrl(iconUrl ?? "") ||
    getFaviconUrl(url)
  );
}

export function getYoutubeEmbedUrl(url: string) {
  try {
    const parsed = new URL(normalizeUrl(url));

    if (parsed.hostname.includes("youtu.be")) {
      const id = parsed.pathname.replace("/", "");
      return id ? `https://www.youtube.com/embed/${id}` : "";
    }

    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : "";
    }

    return "";
  } catch {
    return "";
  }
}

export function detectFileSource(url: string) {
  return getYoutubeEmbedUrl(url) ? "youtube" : "link";
}

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export function isImagePreview(mimeType: string, url = "") {
  return mimeType.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/i.test(url);
}

export function isVideoPreview(mimeType: string, url = "") {
  return mimeType.startsWith("video/") || /\.(mp4|webm|ogg|mov)$/i.test(url);
}

export function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
}
