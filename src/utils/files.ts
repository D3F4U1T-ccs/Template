export function normalizeUrl(value: string) {
  if (!value.trim()) {
    return "";
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `https://${value}`;
}

export function getFaviconUrl(url: string) {
  try {
    const normalized = normalizeUrl(url);
    const hostname = new URL(normalized).hostname;
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
  } catch {
    return "";
  }
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
