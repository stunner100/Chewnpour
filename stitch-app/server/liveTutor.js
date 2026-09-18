import process from "node:process";
import { GoogleGenAI } from "@google/genai";
import { getTopicForUser } from "./courses.js";
import { splitMarkdownIntoSections } from "./tutorTools.js";

export const LIVE_TUTOR_MAX_EXCERPT = 1200;
export const DEFAULT_GEMINI_LIVE_MODEL = "gemini-3.8-live";
// Ephemeral tokens are only accepted on v1alpha in the current JS SDK.
export const GEMINI_LIVE_API_VERSION = "v1alpha";
export const LIVE_TUTOR_VOICE = "Kore";

const SKIP_TITLE_PATTERN = /^(quick check|word bank|glossary|self-check|review questions)\b/i;

export const LIVE_TUTOR_CONNECT_CONFIG = {
    responseModalities: ["AUDIO"],
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    speechConfig: {
        voiceConfig: {
            prebuiltVoiceConfig: { voiceName: LIVE_TUTOR_VOICE },
        },
    },
};

const flagEnabled = (value, fallback = "false") => {
    const flag = String(value ?? fallback).trim().toLowerCase();
    return !["0", "false", "no", "off", ""].includes(flag);
};

export const isLiveTutorEnabled = () => {
    if (!flagEnabled(process.env.LIVE_TUTOR_ENABLED, "false")) return false;
    return Boolean(String(process.env.GEMINI_API_KEY || "").trim());
};

export const getGeminiLiveModel = () =>
    String(process.env.GEMINI_LIVE_MODEL || DEFAULT_GEMINI_LIVE_MODEL).trim() ||
    DEFAULT_GEMINI_LIVE_MODEL;

export const buildLiveTutorPrompt = ({ title, content } = {}) => {
    const lessonTitle = String(title || "Untitled lesson").trim() || "Untitled lesson";
    const sections = splitMarkdownIntoSections(content);
    const lines = [
        "You are ChewnPour's live oral tutor.",
        "Speak and transcribe only in English. Stay in English for the whole review.",
        "RESPOND IN ENGLISH. YOU MUST RESPOND UNMISTAKABLY IN ENGLISH.",
        "If you hear Spanish or any other language, treat it as background noise, not a language switch.",
        "The learner just finished this lesson. Ask 4 to 6 short spoken questions, one at a time.",
        "Wait for their spoken answer before asking the next question.",
        "Correct mistakes briefly and encouragingly. Do not lecture the whole lesson.",
        "After the last question, give a 20-second recap and invite them to take the written quiz.",
        "",
        `LESSON TITLE: ${lessonTitle}`,
        "",
        "LESSON SECTIONS:",
    ];

    for (const section of sections) {
        const sectionTitle = String(section.title || "").trim();
        if (!sectionTitle || SKIP_TITLE_PATTERN.test(sectionTitle)) continue;
        lines.push(`- ${sectionTitle}`);
        const excerpt = String(section.content || "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, LIVE_TUTOR_MAX_EXCERPT);
        if (excerpt) lines.push(`  Excerpt: ${excerpt}`);
    }

    return lines.join("\n");
};

export const mintLiveTutorSession = async ({ title, content } = {}) => {
    const apiKey = String(process.env.GEMINI_API_KEY || "").trim();
    if (!apiKey) {
        const error = new Error("Live tutor is not enabled");
        error.status = 503;
        throw error;
    }

    const model = getGeminiLiveModel();
    const prompt = buildLiveTutorPrompt({ title, content });
    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const newSessionExpireTime = new Date(Date.now() + 60 * 1000).toISOString();

    const client = new GoogleGenAI({
        apiKey,
        httpOptions: { apiVersion: GEMINI_LIVE_API_VERSION },
    });

    try {
        const token = await client.authTokens.create({
            config: {
                uses: 1,
                expireTime,
                newSessionExpireTime,
                liveConnectConstraints: {
                    model,
                    config: {
                        ...LIVE_TUTOR_CONNECT_CONFIG,
                        systemInstruction: { parts: [{ text: prompt }] },
                    },
                },
                httpOptions: { apiVersion: GEMINI_LIVE_API_VERSION },
            },
        });

        const name = String(token?.name || "").trim();
        if (!name) {
            const error = new Error("Failed to mint live tutor token");
            error.status = 502;
            throw error;
        }

        return {
            token: name,
            model,
            expiresAt: expireTime,
            apiVersion: GEMINI_LIVE_API_VERSION,
            connectConfig: LIVE_TUTOR_CONNECT_CONFIG,
        };
    } catch (error) {
        console.warn("[liveTutor] token mint failed", {
            message: error?.message || String(error),
        });
        if (error?.status) throw error;
        const wrapped = new Error("Failed to mint live tutor token");
        wrapped.status = 502;
        throw wrapped;
    }
};

export const createLiveTutorSession = async ({ userId, topicId }) => {
    if (!isLiveTutorEnabled()) {
        const error = new Error("Live tutor is not enabled");
        error.status = 503;
        throw error;
    }

    const payload = await getTopicForUser(userId, topicId);
    if (!payload?.topic) {
        const error = new Error("Topic not found");
        error.status = 404;
        throw error;
    }

    return mintLiveTutorSession({
        title: payload.topic.title,
        content: payload.topic.content,
    });
};
