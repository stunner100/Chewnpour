const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const getVoiceStreamSigningSecret = () => {
    const secret = String(process.env.VOICE_STREAM_SIGNING_SECRET || process.env.BETTER_AUTH_SECRET || "").trim();
    if (!secret) {
        throw new Error("VOICE_STREAM_SIGNING_SECRET is not configured.");
    }
    return secret;
};

export interface VoiceStreamTokenPayload {
    topicId: string;
    text: string;
    model: string;
    exp: number;
}

const BASE64_URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

const decodeBase64UrlChar = (char: string) => {
    const index = BASE64_URL_ALPHABET.indexOf(char);
    if (index < 0) {
        throw new Error("Invalid base64url character.");
    }
    return index;
};

const bytesToBase64Url = (bytes: Uint8Array) => {
    if (bytes.length === 0) return "";

    let encoded = "";
    let index = 0;

    while (index + 2 < bytes.length) {
        const chunk = (bytes[index] << 16) | (bytes[index + 1] << 8) | bytes[index + 2];
        encoded +=
            BASE64_URL_ALPHABET[(chunk >>> 18) & 0x3f] +
            BASE64_URL_ALPHABET[(chunk >>> 12) & 0x3f] +
            BASE64_URL_ALPHABET[(chunk >>> 6) & 0x3f] +
            BASE64_URL_ALPHABET[chunk & 0x3f];
        index += 3;
    }

    const remaining = bytes.length - index;
    if (remaining === 1) {
        const chunk = bytes[index] << 16;
        encoded +=
            BASE64_URL_ALPHABET[(chunk >>> 18) & 0x3f] +
            BASE64_URL_ALPHABET[(chunk >>> 12) & 0x3f];
    } else if (remaining === 2) {
        const chunk = (bytes[index] << 16) | (bytes[index + 1] << 8);
        encoded +=
            BASE64_URL_ALPHABET[(chunk >>> 18) & 0x3f] +
            BASE64_URL_ALPHABET[(chunk >>> 12) & 0x3f] +
            BASE64_URL_ALPHABET[(chunk >>> 6) & 0x3f];
    }

    return encoded;
};

const base64UrlToBytes = (value: string) => {
    const normalized = String(value || "").trim();
    if (!normalized) return new Uint8Array();

    if (normalized.length % 4 === 1) {
        throw new Error("Invalid base64url payload.");
    }

    const padLength = (4 - (normalized.length % 4)) % 4;
    const padded = `${normalized}${"A".repeat(padLength)}`;
    const byteLength = Math.floor((normalized.length * 6) / 8);
    const bytes = new Uint8Array(byteLength);

    let byteIndex = 0;
    for (let i = 0; i < padded.length; i += 4) {
        const chunk =
            (decodeBase64UrlChar(padded[i]) << 18) |
            (decodeBase64UrlChar(padded[i + 1]) << 12) |
            (decodeBase64UrlChar(padded[i + 2]) << 6) |
            decodeBase64UrlChar(padded[i + 3]);

        if (byteIndex < byteLength) {
            bytes[byteIndex] = (chunk >>> 16) & 0xff;
            byteIndex += 1;
        }
        if (byteIndex < byteLength) {
            bytes[byteIndex] = (chunk >>> 8) & 0xff;
            byteIndex += 1;
        }
        if (byteIndex < byteLength) {
            bytes[byteIndex] = chunk & 0xff;
            byteIndex += 1;
        }
    }

    return bytes;
};

const encodePayload = (payload: VoiceStreamTokenPayload) =>
    bytesToBase64Url(textEncoder.encode(JSON.stringify(payload)));

const decodePayload = (encoded: string): VoiceStreamTokenPayload => {
    const decoded = textDecoder.decode(base64UrlToBytes(encoded));
    return JSON.parse(decoded);
};

const signPayload = async (encodedPayload: string) => {
    const signingSecret = getVoiceStreamSigningSecret();
    const signingKey = await crypto.subtle.importKey(
        "raw",
        textEncoder.encode(signingSecret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const signatureBuffer = await crypto.subtle.sign(
        "HMAC",
        signingKey,
        textEncoder.encode(encodedPayload)
    );
    return bytesToBase64Url(new Uint8Array(signatureBuffer));
};

const signaturesMatch = (expectedSignature: string, providedSignature: string) => {
    if (!expectedSignature || !providedSignature) return false;
    if (expectedSignature.length !== providedSignature.length) return false;

    let mismatch = 0;
    for (let i = 0; i < expectedSignature.length; i += 1) {
        mismatch |= expectedSignature.charCodeAt(i) ^ providedSignature.charCodeAt(i);
    }
    return mismatch === 0;
};

const isPayloadValid = (payload: VoiceStreamTokenPayload) => {
    if (!payload || typeof payload !== "object") return false;
    if (!payload.topicId || typeof payload.topicId !== "string") return false;
    if (!payload.text || typeof payload.text !== "string") return false;
    if (!payload.model || typeof payload.model !== "string") return false;
    if (!Number.isFinite(payload.exp)) return false;
    if (payload.exp <= Date.now()) return false;
    return true;
};

export const createVoiceStreamToken = async (payload: VoiceStreamTokenPayload) => {
    const encodedPayload = encodePayload(payload);
    const signature = await signPayload(encodedPayload);
    return `${encodedPayload}.${signature}`;
};

export const verifyVoiceStreamToken = async (token: string) => {
    const normalizedToken = String(token || "").trim();
    if (!normalizedToken) {
        return { ok: false as const, reason: "missing_token" };
    }

    const separatorIndex = normalizedToken.lastIndexOf(".");
    if (separatorIndex <= 0) {
        return { ok: false as const, reason: "invalid_format" };
    }

    const encodedPayload = normalizedToken.slice(0, separatorIndex);
    const providedSignature = normalizedToken.slice(separatorIndex + 1);

    let expectedSignature = "";
    try {
        expectedSignature = await signPayload(encodedPayload);
    } catch {
        return { ok: false as const, reason: "missing_signing_secret" };
    }

    if (!signaturesMatch(expectedSignature, providedSignature)) {
        return { ok: false as const, reason: "invalid_signature" };
    }

    try {
        const payload = decodePayload(encodedPayload);
        if (!isPayloadValid(payload)) {
            return { ok: false as const, reason: "invalid_payload" };
        }
        return { ok: true as const, payload };
    } catch {
        return { ok: false as const, reason: "invalid_payload" };
    }
};
