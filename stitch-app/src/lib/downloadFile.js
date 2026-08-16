export const parseFilenameFromContentDisposition = (header, fallback = "download.zip") => {
    const value = String(header || "");
    const utfMatch = value.match(/filename\*=UTF-8''([^;]+)/i);
    if (utfMatch?.[1]) {
        try {
            return decodeURIComponent(utfMatch[1]);
        } catch {
            return utfMatch[1];
        }
    }
    const quoted = value.match(/filename="([^"]+)"/i);
    if (quoted?.[1]) return quoted[1];
    const unquoted = value.match(/filename=([^;]+)/i);
    if (unquoted?.[1]) return unquoted[1].trim();
    return fallback;
};

export const triggerBrowserDownload = (blob, filename) => {
    if (typeof document === "undefined") return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename || "download.zip";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
};

export const downloadAuthenticatedFile = async (url, fallbackName) => {
    const response = await fetch(url, {
        credentials: "include",
        headers: { Accept: "application/zip, application/octet-stream, application/json" },
    });
    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Download failed");
    }
    const blob = await response.blob();
    const filename = parseFilenameFromContentDisposition(
        response.headers.get("Content-Disposition"),
        fallbackName,
    );
    triggerBrowserDownload(blob, filename);
    return filename;
};
