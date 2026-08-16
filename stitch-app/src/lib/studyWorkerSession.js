const storageKey = (userId, topicId) =>
    `chewnpour-study-worker:${String(userId || 'anon')}:${String(topicId || '')}`;

export const loadStudyWorkerSession = (userId, topicId) => {
    if (typeof window === 'undefined' || !topicId) return null;
    try {
        const raw = window.localStorage.getItem(storageKey(userId, topicId));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed?.session) return null;
        return {
            session: parsed.session,
            events: Array.isArray(parsed.events) ? parsed.events : [],
        };
    } catch {
        return null;
    }
};

export const saveStudyWorkerSession = (userId, topicId, snapshot) => {
    if (typeof window === 'undefined' || !topicId || !snapshot?.session) return;
    try {
        window.localStorage.setItem(
            storageKey(userId, topicId),
            JSON.stringify({
                session: snapshot.session,
                events: Array.isArray(snapshot.events) ? snapshot.events.slice(-200) : [],
            }),
        );
    } catch {
        // Ignore quota errors; the durable eve session can still resume from the cursor.
    }
};

export const clearStudyWorkerSession = (userId, topicId) => {
    if (typeof window === 'undefined' || !topicId) return;
    try {
        window.localStorage.removeItem(storageKey(userId, topicId));
    } catch {
        // Ignore
    }
};

export const tutorMessagesFromEve = (messages) => {
    if (!Array.isArray(messages)) return [];
    return messages
        .map((message) => {
            const text = (message.parts || [])
                .filter((part) => part.type === 'text' && String(part.text || '').trim())
                .map((part) => part.text)
                .join('\n')
                .trim();
            if (!text) return null;
            return {
                id: message.id,
                _id: message.id,
                role: message.role === 'user' ? 'user' : 'assistant',
                content: text,
            };
        })
        .filter(Boolean);
};

export const pendingInputRequestsFromEve = (messages) => {
    if (!Array.isArray(messages)) return [];
    const seen = new Set();
    const requests = [];
    for (const message of messages) {
        for (const part of message.parts || []) {
            if (part.type !== 'dynamic-tool') continue;
            if (part.state === 'approval-responded') continue;
            const request = part.toolMetadata?.eve?.inputRequest;
            if (!request?.requestId || seen.has(request.requestId)) continue;
            if (part.toolMetadata?.eve?.inputResponse) continue;
            seen.add(request.requestId);
            requests.push(request);
        }
    }
    return requests;
};
