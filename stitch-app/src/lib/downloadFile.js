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

export const triggerBrowserDownload = async (blob, filename) => {
    if (typeof document === "undefined") return;
    const safeName = filename || "download.zip";
    const file = typeof File === "function"
        ? new File([blob], safeName, { type: blob.type || "application/octet-stream" })
        : null;
    const canShareFiles = Boolean(
        file
        && typeof navigator !== "undefined"
        && typeof navigator.canShare === "function"
        && typeof navigator.share === "function"
        && navigator.canShare({ files: [file] }),
    );
    if (canShareFiles) {
        try {
            await navigator.share({ files: [file], title: safeName });
            return;
        } catch (error) {
            if (error?.name === "AbortError") return;
        }
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = safeName;
    document.body.appendChild(link);
    link.click();
    window.open(url, "_blank", "noopener,noreferrer");
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
    await triggerBrowserDownload(blob, filename);
    return filename;
};
