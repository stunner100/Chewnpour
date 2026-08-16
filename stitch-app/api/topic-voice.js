import { friendlyVoiceErrorMessage, handleTopicVoiceRequest } from "../server/topicVoiceHttp.js";

export const config = {
    api: {
        bodyParser: false,
    },
    maxDuration: 30,
};

export default async function handler(req, res) {
    try {
        await handleTopicVoiceRequest(req, res);
    } catch (error) {
        if (res.headersSent) return;
        const status = Number(error?.status) || 500;
        const body = JSON.stringify({
            error: friendlyVoiceErrorMessage(error),
        });
        res.statusCode = status >= 400 && status < 600 ? status : 500;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.end(body);
    }
}
