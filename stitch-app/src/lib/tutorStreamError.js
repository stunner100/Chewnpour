export const parseTutorStreamError = (data) => {
    if (typeof data === "string" && data.trim()) return data.trim();
    if (data && typeof data === "object") {
        const message = data.message || data.error;
        if (typeof message === "string" && message.trim()) return message.trim();
    }
    return "The tutor could not answer just now.";
};
