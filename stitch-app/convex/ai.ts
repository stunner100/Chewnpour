"use node";

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

// Qwen API configuration (OpenAI-compatible)
const QWEN_BASE_URL = process.env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1";
const DEFAULT_MODEL = process.env.QWEN_MODEL || "qwen-max";
const DEFAULT_TIMEOUT_MS = Number(process.env.QWEN_TIMEOUT_MS || 60000);
const DEFAULT_PROCESSING_TIMEOUT_MS = Number(process.env.PROCESSING_TIMEOUT_MS || 8 * 60 * 1000);
const AZURE_DOCINTEL_ENDPOINT = process.env.AZURE_DOCINTEL_ENDPOINT || "";
const AZURE_DOCINTEL_KEY = process.env.AZURE_DOCINTEL_KEY || "";
const AZURE_DOCINTEL_API_VERSION = process.env.AZURE_DOCINTEL_API_VERSION || "2023-07-31";

interface Message {
    role: "system" | "user" | "assistant";
    content: string;
}

interface ChatCompletionResponse {
    id: string;
    choices: Array<{
        message: {
            role: string;
            content: string;
        };
        finish_reason: string;
    }>;
}

async function callQwen(
    messages: Message[],
    model: string = DEFAULT_MODEL,
    options?: { temperature?: number; maxTokens?: number; timeoutMs?: number; responseFormat?: "json_object" }
): Promise<string> {
    const apiKey = process.env.QWEN_API_KEY;
    if (!apiKey) {
        throw new Error("QWEN_API_KEY environment variable not set");
    }

    const controller = new AbortController();
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
        response = await fetch(`${QWEN_BASE_URL}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: options?.temperature ?? 0.3,
                max_tokens: options?.maxTokens ?? 2048,
                response_format: options?.responseFormat ? { type: options.responseFormat } : undefined,
            }),
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timeoutId);
    }

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Qwen API error: ${response.status} - ${errorText}`);
    }

    const data: ChatCompletionResponse = await response.json();
    return data.choices[0]?.message?.content || "";
}

const sanitizeJson = (raw: string) =>
    raw
        .replace(/^[\s\S]*?(\{)/, "$1")
        .replace(/(\})[\s\S]*$/, "$1")
        .replace(/,\s*([}\]])/g, "$1")
        .replace(/[\u0000-\u001F]+/g, "");

const parseJsonFromResponse = (raw: string, label: string) => {
    try {
        return JSON.parse(raw);
    } catch {
        try {
            const jsonMatch = raw.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error("No JSON found");
            }
            return JSON.parse(sanitizeJson(jsonMatch[0]));
        } catch (error) {
            console.error(`Failed to parse ${label}:`, raw);
            throw error;
        }
    }
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeOptionText = (value: any) => {
    if (value === null || value === undefined) return "";
    return String(value).replace(/\s+/g, " ").trim();
};

const normalizeOptions = (raw: any) => {
    if (!raw) return [];

    let options: any = raw;

    if (typeof options === "string") {
        const trimmed = options.trim();
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
            try {
                options = JSON.parse(trimmed);
            } catch (error) {
                options = trimmed;
            }
        }
    }

    if (options && !Array.isArray(options) && typeof options === "object") {
        if (Array.isArray(options.options)) {
            options = options.options;
        } else if (Array.isArray(options.choices)) {
            options = options.choices;
        } else if (options.label || options.text) {
            options = [options];
        } else {
            const letterKeys = ["A", "B", "C", "D"];
            const hasLetterKeys = letterKeys.some((key) => options[key] || options[key.toLowerCase()]);
            if (hasLetterKeys) {
                options = letterKeys
                    .map((key) => ({
                        label: key,
                        text: options[key] ?? options[key.toLowerCase()],
                    }))
                    .filter((option: any) => option.text);
            }
        }
    }

    if (!Array.isArray(options)) {
        if (typeof options === "string") {
            const lines = options
                .split(/\n|;/)
                .map((line) => line.trim())
                .filter(Boolean);
            options = lines.length > 0 ? lines : [options];
        } else {
            options = [];
        }
    }

    const normalized = [];
    let fallbackIndex = 0;

    for (const option of options) {
        if (typeof option === "string") {
            const match = option.match(/^\s*([A-D])[\)\.\-:\s]+(.+)$/i);
            if (match) {
                normalized.push({
                    label: match[1].toUpperCase(),
                    text: normalizeOptionText(match[2]),
                });
            } else {
                const label = String.fromCharCode(65 + fallbackIndex);
                fallbackIndex += 1;
                normalized.push({
                    label,
                    text: normalizeOptionText(option),
                });
            }
            continue;
        }

        if (option && typeof option === "object") {
            const label = option.label ?? option.key ?? option.option ?? option.choice;
            const text = option.text ?? option.value ?? option.answer ?? option.choiceText ?? option.label;
            const isCorrect = option.isCorrect ?? option.correct ?? option.isAnswer ?? option.is_true;
            normalized.push({
                label: label ? String(label).trim().toUpperCase() : undefined,
                text: normalizeOptionText(text),
                isCorrect: Boolean(isCorrect),
            });
        }
    }

    return normalized.filter((option) => option.text);
};

const ensureSingleCorrect = (options: any[]) => {
    const firstCorrect = options.findIndex((option) => option.isCorrect);
    const correctIndex = firstCorrect === -1 ? 0 : firstCorrect;
    return options.map((option, index) => ({
        ...option,
        isCorrect: index === correctIndex,
    }));
};

const fillOptionLabels = (options: any[]) =>
    options.map((option, index) => ({
        label: option.label ?? String.fromCharCode(65 + index),
        text: option.text,
        isCorrect: option.isCorrect,
    }));

const fillMissingOptions = (options: any[]) => {
    const fallback = [
        "None of the above",
        "All of the above",
        "Cannot be determined from the question",
        "Not enough information",
    ];
    const used = new Set(options.map((option) => option.text));
    const filled = [...options];
    for (const text of fallback) {
        if (filled.length >= 4) break;
        if (!used.has(text)) {
            filled.push({ text, isCorrect: false });
        }
    }
    return filled;
};

const generateOptionsForQuestion = async (questionText: string, topicTitle: string) => {
    const prompt = `Create exactly 4 multiple-choice answer options for the question below. Mark exactly one option as correct.\n\nQUESTION: ${questionText}\nTOPIC: ${topicTitle}\n\nReturn JSON only in this format:\n{\"options\":[{\"label\":\"A\",\"text\":\"...\",\"isCorrect\":false},{\"label\":\"B\",\"text\":\"...\",\"isCorrect\":true},{\"label\":\"C\",\"text\":\"...\",\"isCorrect\":false},{\"label\":\"D\",\"text\":\"...\",\"isCorrect\":false}]}`;

    const response = await callQwen([
        { role: "system", content: "You are an expert educator. Respond with valid JSON only." },
        { role: "user", content: prompt },
    ], DEFAULT_MODEL, { maxTokens: 700, responseFormat: "json_object" });

    try {
        return parseJsonFromResponse(response, "options");
    } catch (error) {
        return null;
    }
};

export const generateConceptExerciseForTopic = action({
    args: {
        topicId: v.id("topics"),
    },
    handler: async (ctx, args) => {
        const { topicId } = args;

        const topic = await ctx.runQuery(api.topics.getTopicWithQuestions, { topicId });
        if (!topic) {
            throw new Error("Topic not found");
        }

        const prompt = `Create a single fill-in-the-blank concept practice exercise based on the lesson content below.
Return JSON ONLY in this exact format:
{
  "questionText": "Explain the key idea in one sentence.",
  "template": ["When ", "__", " equals ", "__", ", the market reaches ", "__", "."],
  "answers": ["demand", "supply", "equilibrium"],
  "tokens": ["demand", "supply", "equilibrium", "price", "surplus", "shortage", "increase", "decrease"]
}

Rules:
- template must include one "__" for each answer
- answers must align to template blanks
- tokens must include all answers plus additional distractors

TOPIC: ${topic.title}
LESSON CONTENT:
\"\"\"
${(topic.content || "").slice(0, 5000)}
\"\"\"`;

        const response = await callQwen([
            { role: "system", content: "You are an expert educator creating fill-in-the-blank exercises. Respond with valid JSON only." },
            { role: "user", content: prompt },
        ], DEFAULT_MODEL, { maxTokens: 900, responseFormat: "json_object" });

        const exercise = parseJsonFromResponse(response, "concept exercise");
        const template = Array.isArray(exercise.template) ? exercise.template : [];
        const answers = Array.isArray(exercise.answers) ? exercise.answers : [];
        const tokens = Array.isArray(exercise.tokens) ? exercise.tokens : [];

        if (template.length === 0 || answers.length === 0 || tokens.length === 0) {
            throw new Error("Failed to generate concept exercise");
        }

        return {
            questionText: exercise.questionText || topic.title,
            template,
            answers,
            tokens,
        };
    },
});

const extractTextFromAzureResult = (result: any) => {
    const content = result?.analyzeResult?.content;
    if (typeof content === "string" && content.trim()) {
        return content.trim();
    }
    const lines: string[] = [];
    const pages = result?.analyzeResult?.pages || [];
    for (const page of pages) {
        for (const line of page?.lines || []) {
            if (typeof line?.content === "string") {
                lines.push(line.content);
            }
        }
    }
    return lines.join("\n").trim();
};

const callAzureDocIntelRead = async (fileBuffer: ArrayBuffer, contentType: string) => {
    if (!AZURE_DOCINTEL_ENDPOINT || !AZURE_DOCINTEL_KEY) {
        return "";
    }
    const endpoint = AZURE_DOCINTEL_ENDPOINT.replace(/\/+$/, "");
    const url = `${endpoint}/formrecognizer/documentModels/prebuilt-read:analyze?api-version=${AZURE_DOCINTEL_API_VERSION}`;

    const analyzeResponse = await fetch(url, {
        method: "POST",
        headers: {
            "Ocp-Apim-Subscription-Key": AZURE_DOCINTEL_KEY,
            "Content-Type": contentType,
        },
        body: Buffer.from(fileBuffer),
    });

    if (analyzeResponse.status !== 202) {
        const errText = await analyzeResponse.text();
        throw new Error(`Azure OCR error: ${analyzeResponse.status} - ${errText}`);
    }

    const operationLocation = analyzeResponse.headers.get("operation-location");
    if (!operationLocation) {
        throw new Error("Azure OCR error: missing operation-location");
    }

    // Poll for result
    const maxAttempts = 20;
    for (let i = 0; i < maxAttempts; i++) {
        await sleep(2000);
        const pollResponse = await fetch(operationLocation, {
            headers: {
                "Ocp-Apim-Subscription-Key": AZURE_DOCINTEL_KEY,
            },
        });
        if (!pollResponse.ok) {
            const errText = await pollResponse.text();
            throw new Error(`Azure OCR polling error: ${pollResponse.status} - ${errText}`);
        }
        const data = await pollResponse.json();
        const status = data?.status;
        if (status === "succeeded") {
            return extractTextFromAzureResult(data);
        }
        if (status === "failed") {
            throw new Error("Azure OCR failed");
        }
    }

    throw new Error("Azure OCR timed out");
};

const buildFallbackOutline = (extractedText: string, fileName: string) => {
    const safeTitle = fileName.replace(/\.(pdf|pptx)$/i, "") || "Generated Course";
    const sentences = extractedText
        .split(/[\.\n]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 20)
        .slice(0, 12);
    const keyPoints = sentences.length > 0 ? sentences : ["Key concept 1", "Key concept 2", "Key concept 3"];
    const topics = [];
    const topicsCount = Math.max(3, Math.min(5, Math.ceil(keyPoints.length / 3)));
    for (let i = 0; i < topicsCount; i++) {
        const slice = keyPoints.slice(i * 3, i * 3 + 3);
        topics.push({
            title: slice[0] ? `Topic ${i + 1}: ${slice[0].slice(0, 60)}` : `Topic ${i + 1}`,
            description: slice[1] || "Detailed exploration of key concepts from the document.",
            keyPoints: slice.length > 0 ? slice : keyPoints.slice(0, 3),
        });
    }
    return {
        courseTitle: safeTitle,
        courseDescription: "AI-generated course from your study materials.",
        topics,
    };
};

// Generate course structure from extracted text
export const generateCourseFromText = action({
    args: {
        courseId: v.id("courses"),
        uploadId: v.id("uploads"),
        extractedText: v.string(),
        fileName: v.string(),
    },
    handler: async (ctx, args) => {
        const { courseId, uploadId, extractedText, fileName } = args;

        try {
            const startTime = Date.now();
            const checkTimeout = () => {
                if (Date.now() - startTime > DEFAULT_PROCESSING_TIMEOUT_MS) {
                    throw new Error("Processing timed out");
                }
            };
            // Update upload status to "generating" with 40% progress
            await ctx.runMutation(api.uploads.updateUploadStatus, {
                uploadId,
                status: "processing",
                processingStep: "generating_topics",
                processingProgress: 40,
            });

            // Step 1: Generate topic outline
            checkTimeout();
            const outlinePrompt = `You are an expert educational content creator. Analyze the following study material and create a structured course outline that is easy for a layperson to understand while still being detailed.

STUDY MATERIAL:
"""
${extractedText.slice(0, 15000)}
"""

Based on this content, create 5-7 distinct topics/chapters that cover the main concepts. Each topic should be a logical unit of study and phrased in plain, beginner-friendly language.
Only use concepts that are explicitly present in the study material. Avoid generic placeholders.

Respond in this exact JSON format only (no markdown, no explanation):
{
  "courseTitle": "A clear, descriptive title for this course",
  "courseDescription": "A 1-2 sentence description of what students will learn",
  "topics": [
    {
      "title": "Topic title",
      "description": "Brief description of what this topic covers",
      "keyPoints": ["key point 1", "key point 2", "key point 3"]
    }
  ]
}`;

            const outlineResponse = await callQwen([
                { role: "system", content: "You are a helpful educational assistant that creates structured learning content. Always respond with valid JSON only." },
                { role: "user", content: outlinePrompt },
            ], DEFAULT_MODEL, { maxTokens: 1200, responseFormat: "json_object" });

            // Parse the outline
            let courseOutline;
            try {
                courseOutline = parseJsonFromResponse(outlineResponse, "outline");
            } catch (parseError) {
                courseOutline = buildFallbackOutline(extractedText, fileName);
            }

            // Update course title and description
            await ctx.runMutation(api.courses.updateCourse, {
                courseId,
                title: courseOutline.courseTitle || fileName.replace(/\.(pdf|pptx)$/i, ""),
                description: courseOutline.courseDescription || "AI-generated course from your study materials",
            });

            // Update progress to generating content phase
            await ctx.runMutation(api.uploads.updateUploadStatus, {
                uploadId,
                status: "processing",
                processingStep: "generating_content",
                processingProgress: 55,
            });

            // Step 2: Create topics and lesson content for each
            const topicIds: string[] = [];
            const normalizedTopics = Array.isArray(courseOutline.topics) ? courseOutline.topics : [];
            let totalTopics = normalizedTopics.length;
            if (totalTopics < 3 && normalizedTopics.length > 0) {
                const seed = normalizedTopics[0];
                const baseKeyPoints = Array.isArray(seed?.keyPoints) ? seed.keyPoints : [];
                const splitPoints = baseKeyPoints
                    .filter((p: any) => typeof p === "string" && p.trim())
                    .slice(0, 4)
                    .map((p: string, idx: number) => ({
                        title: `Deep Dive: ${p}`,
                        description: `Focused exploration of ${p}.`,
                        keyPoints: [p],
                    }));
                normalizedTopics.push(...splitPoints);
            }
            totalTopics = normalizedTopics.length;

            for (let i = 0; i < totalTopics; i++) {
                const topicData = normalizedTopics[i];
                const keyPoints = Array.isArray(topicData?.keyPoints)
                    ? topicData.keyPoints.filter((p: any) => typeof p === "string" && p.trim())
                    : typeof topicData?.keyPoints === "string"
                        ? topicData.keyPoints.split(/[,;\n]+/).map((p: string) => p.trim()).filter(Boolean)
                        : [];
                const isFirstTopic = i === 0;

                // Calculate progress: 55% base + up to 40% for topics (leaving 5% for final)
                const topicProgress = 55 + Math.floor((i / totalTopics) * 40);
                await ctx.runMutation(api.uploads.updateUploadStatus, {
                    uploadId,
                    status: "processing",
                    processingStep: "generating_content",
                    processingProgress: topicProgress,
                });

                checkTimeout();

                // Generate lesson content only; questions are generated later by user request
                const lessonPrompt = `Create comprehensive lesson content for this study topic.

TOPIC: ${topicData.title}
DESCRIPTION: ${topicData.description}
KEY POINTS: ${keyPoints.join(", ") || "General concepts"}

CONTEXT FROM STUDY MATERIAL:
"""
${extractedText.slice(0, 6000)}
"""

Write detailed, educational content that teaches this topic thoroughly in **plain, beginner-friendly language**. Avoid jargon; when jargon is necessary, define it immediately.
Include:
1. **Simple Introduction** - Explain the topic like I'm new to it
2. **Key Ideas in Plain English** - Definitions + why they matter
3. **Step-by-Step Breakdown** - If there is a process, explain it simply
4. **Everyday Analogies** - Use relatable examples for laypeople
5. **Practical Examples** - Real-world examples or illustrations
6. **Quick Glossary** - 5–8 key terms with simple definitions
7. **Summary** - Key takeaways to remember

Format the content in clear markdown with headers and bullet points.
Make it engaging and easy to understand. Aim for about 800-1200 words.

Respond in this exact JSON format only:
{
  "lessonContent": "Markdown lesson content"
}`;

                const lessonResponse = await callQwen([
                    { role: "system", content: "You are an expert educator creating comprehensive lesson content. Always respond with valid JSON only." },
                    { role: "user", content: lessonPrompt },
                ], DEFAULT_MODEL, { maxTokens: 2600, responseFormat: "json_object" });

                let lessonData: any = null;
                try {
                    lessonData = parseJsonFromResponse(lessonResponse, "lesson content");
                } catch (parseError) {
                    lessonData = {
                        lessonContent: keyPoints.map((p: string) => `- ${p}`).join("\n") || "",
                    };
                }

                // Create the topic with comprehensive content
                const topicId = await ctx.runMutation(api.topics.createTopic, {
                    courseId,
                    title: topicData.title,
                    description: topicData.description,
                    content: lessonData.lessonContent || topicData.keyPoints?.join("\n• ") || "",
                    orderIndex: i,
                    isLocked: !isFirstTopic, // First topic is unlocked
                });

                topicIds.push(topicId);
            }

            // Update upload status to "ready" with 100% progress
            await ctx.runMutation(api.uploads.updateUploadStatus, {
                uploadId,
                status: "ready",
                processingStep: "ready",
                processingProgress: 100,
            });

            return {
                success: true,
                courseId,
                topicCount: topicIds.length,
            };
        } catch (error) {
            console.error("AI processing failed:", error);

            // Update upload status to "error"
            await ctx.runMutation(api.uploads.updateUploadStatus, {
                uploadId,
                status: "error",
            });

            throw error;
        }
    },
});

// Process an uploaded file - orchestrates the full pipeline
export const processUploadedFile = action({
    args: {
        uploadId: v.id("uploads"),
        courseId: v.id("courses"),
        userId: v.string(),
        extractedText: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { uploadId, courseId, userId, extractedText: providedText } = args;

        try {
            const startTime = Date.now();
            const checkTimeout = () => {
                if (Date.now() - startTime > DEFAULT_PROCESSING_TIMEOUT_MS) {
                    throw new Error("Processing timed out");
                }
            };
            // Get the upload record
            const upload = await ctx.runQuery(api.uploads.getUpload, { uploadId });
            if (!upload) {
                throw new Error("Upload not found");
            }

            // Update status to extracting with 5% progress
            await ctx.runMutation(api.uploads.updateUploadStatus, {
                uploadId,
                status: "processing",
                processingStep: "extracting",
                processingProgress: 5,
            });

            // Get the file from storage
            const fileUrl = await ctx.storage.getUrl(upload.storageId);
            if (!fileUrl) {
                throw new Error("Could not get file URL from storage");
            }

            // Fetch the file content
            checkTimeout();
            const fileResponse = await fetch(fileUrl);
            const fileBuffer = await fileResponse.arrayBuffer();

            // Update to analyzing phase
            await ctx.runMutation(api.uploads.updateUploadStatus, {
                uploadId,
                status: "processing",
                processingStep: "analyzing",
                processingProgress: 20,
            });

            // For PDFs and PPTX, we'll use AI to extract and summarize the content
            // This is a simplified approach - in production you'd use dedicated parsers
            let extractedText = (providedText || "").trim();

            if (upload.fileType === "pdf") {
                if (!extractedText || extractedText.length < 200) {
                    checkTimeout();
                    try {
                        const azureText = await callAzureDocIntelRead(fileBuffer, "application/pdf");
                        if (azureText && azureText.length > 200) {
                            extractedText = azureText;
                        }
                    } catch (azureError) {
                        console.error("Azure OCR failed:", azureError);
                    }
                }
                if (!extractedText || extractedText.length < 200) {
                    checkTimeout();
                    extractedText = await callQwen([
                        {
                            role: "system",
                            content: "You are a document analysis assistant. Extract and summarize the main educational content from this document.",
                        },
                        {
                            role: "user",
                            content: `The PDF text could not be fully parsed. Based on the filename and any partial text below, reconstruct the most likely educational content and key topics.

Filename: ${upload.fileName}

Partial text:
"""
${extractedText.slice(0, 2000)}
"""

Please provide:
1. Main topics covered
2. Key concepts and definitions
3. Important points and takeaways
4. Any formulas, processes, or methodologies mentioned

Format your response as educational content that can be used to generate quiz questions.`,
                        },
                    ], DEFAULT_MODEL, { maxTokens: 1200 });
                }
            } else {
                // PPTX processing
                if (!extractedText || extractedText.length < 200) {
                    checkTimeout();
                    try {
                        const azureText = await callAzureDocIntelRead(
                            fileBuffer,
                            "application/vnd.openxmlformats-officedocument.presentationml.presentation"
                        );
                        if (azureText && azureText.length > 200) {
                            extractedText = azureText;
                        }
                    } catch (azureError) {
                        console.error("Azure OCR failed:", azureError);
                    }
                }
                if (!extractedText || extractedText.length < 200) {
                checkTimeout();
                extractedText = await callQwen([
                    {
                        role: "system",
                        content: "You are a document analysis assistant. Extract and summarize the main educational content from this presentation.",
                    },
                    {
                        role: "user",
                        content: `This is a PowerPoint presentation named "${upload.fileName}". Please analyze it and extract the main educational content, key topics, and important information. Based on the filename, describe what content you would expect and generate appropriate educational material.

Filename: ${upload.fileName}

Please provide:
1. Main topics/slides covered
2. Key concepts and definitions
3. Important points and takeaways
4. Any diagrams, charts, or visual concepts that would be discussed

Format your response as educational content that can be used to generate quiz questions.`,
                    },
                ], DEFAULT_MODEL, { maxTokens: 1200 });
                }
            }

            // Now generate the course from the extracted text
            checkTimeout();
            const result = await ctx.runAction(api.ai.generateCourseFromText, {
                courseId,
                uploadId,
                extractedText,
                fileName: upload.fileName,
            });

            return result;
        } catch (error) {
            console.error("File processing failed:", error);

            await ctx.runMutation(api.uploads.updateUploadStatus, {
                uploadId,
                status: "error",
            });

            throw error;
        }
    },
});

// Generate quiz questions for a topic on demand
export const generateQuestionsForTopic = action({
    args: {
        topicId: v.id("topics"),
    },
    handler: async (ctx, args) => {
        const { topicId } = args;

        const topicWithQuestions = await ctx.runQuery(api.topics.getTopicWithQuestions, { topicId });
        if (!topicWithQuestions) {
            throw new Error("Topic not found");
        }

        if ((topicWithQuestions.questions || []).length > 0) {
            return { success: true, alreadyGenerated: true, count: topicWithQuestions.questions.length };
        }

        const prompt = `Create 5 multiple-choice quiz questions in plain language.

TOPIC: ${topicWithQuestions.title}
DESCRIPTION: ${topicWithQuestions.description || "General concepts"}

LESSON CONTENT:
"""
${(topicWithQuestions.content || "").slice(0, 6000)}
"""

Respond in this exact JSON format only:
{
  "questions": [
    {
      "questionText": "The question text here?",
      "options": [
        {"label": "A", "text": "First option", "isCorrect": false},
        {"label": "B", "text": "Second option", "isCorrect": true},
        {"label": "C", "text": "Third option", "isCorrect": false},
        {"label": "D", "text": "Fourth option", "isCorrect": false}
      ],
      "explanation": "Brief explanation of why the correct answer is correct",
      "difficulty": "medium"
    }
  ]
}`;

        const response = await callQwen([
            { role: "system", content: "You are an expert educator creating quiz questions. Always respond with valid JSON only." },
            { role: "user", content: prompt },
        ], DEFAULT_MODEL, { maxTokens: 1400, responseFormat: "json_object" });

        let questionsData: any;
        try {
            questionsData = parseJsonFromResponse(response, "questions");
        } catch (error) {
            questionsData = { questions: [] };
        }

        const saved = [];
        for (const question of questionsData.questions || []) {
            if (!question?.questionText || typeof question.questionText !== "string") {
                continue;
            }
            let options = normalizeOptions(question.options);
            if (options.length < 4) {
                const generated = await generateOptionsForQuestion(question.questionText, topicWithQuestions.title);
                const generatedOptions = normalizeOptions(generated?.options ?? generated);
                if (generatedOptions.length >= 4) {
                    options = generatedOptions;
                }
            }

            options = fillOptionLabels(fillMissingOptions(options)).slice(0, 4);
            options = ensureSingleCorrect(options);

            const correctOption = options.find((o: any) => o.isCorrect);
            const questionId = await ctx.runMutation(api.topics.createQuestion, {
                topicId,
                questionText: question.questionText,
                questionType: "multiple_choice",
                options,
                correctAnswer: correctOption?.label || "A",
                explanation: question.explanation,
                difficulty: question.difficulty || "medium",
            });
            saved.push(questionId);
        }

        return { success: true, alreadyGenerated: false, count: saved.length };
    },
});

// Force regenerate quiz questions for a topic
export const regenerateQuestionsForTopic = action({
    args: {
        topicId: v.id("topics"),
    },
    handler: async (ctx, args) => {
        const { topicId } = args;

        const topicWithQuestions = await ctx.runQuery(api.topics.getTopicWithQuestions, { topicId });
        if (!topicWithQuestions) {
            throw new Error("Topic not found");
        }

        await ctx.runMutation(api.topics.deleteQuestionsByTopic, { topicId });

        const result = await ctx.runAction(api.ai.generateQuestionsForTopic, { topicId });

        return { success: true, regenerated: true, count: result?.count ?? 0 };
    },
});

// Re-explain a topic in a different style on demand
export const reExplainTopic = action({
    args: {
        topicId: v.id("topics"),
        style: v.string(),
    },
    handler: async (ctx, args) => {
        const { topicId, style } = args;
        const topic = await ctx.runQuery(api.topics.getTopicWithQuestions, { topicId });
        if (!topic) {
            throw new Error("Topic not found");
        }

        const prompt = `Rewrite the lesson in the requested style while keeping all factual content.

STYLE: ${style}
TOPIC: ${topic.title}

ORIGINAL LESSON:
"""
${(topic.content || "").slice(0, 6000)}
"""

Return clear markdown with headings and bullet points. Keep it concise but complete.`;

        const response = await callQwen([
            { role: "system", content: "You are an expert educator rewriting lessons in different styles." },
            { role: "user", content: prompt },
        ], DEFAULT_MODEL, { maxTokens: 2000 });

        return { content: response || topic.content || "" };
    },
});
