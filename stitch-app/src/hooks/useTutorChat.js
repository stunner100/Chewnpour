import { useState, useEffect, useCallback, useRef } from 'react';
import { parseTutorStreamError } from '@/lib/tutorStreamError';

export default function useTutorChat({ topicId, persona = 'coach', studyContext = null }) {
    const [messages, setMessages] = useState([]);
    const [status, setStatus] = useState('ready');
    const [error, setError] = useState(null);
    const abortControllerRef = useRef(null);
    const studyContextRef = useRef(studyContext);
    studyContextRef.current = studyContext;

    const loadMessages = useCallback(async () => {
        if (!topicId) return;
        setStatus('ready');
        setError(null);
        try {
            const response = await fetch(`/api/topics/${topicId}/chat`, {
                method: 'GET',
                credentials: 'include'
            });
            if (!response.ok) {
                throw new Error(`Failed to load messages: ${response.status}`);
            }
            const data = await response.json();
            if (data && data.messages) {
                const formattedMessages = data.messages.map(msg => {
                    const id = msg.id || msg._id;
                    return {
                        id,
                        _id: id,
                        role: msg.role,
                        content: msg.content,
                        createdAt: msg.createdAt
                    };
                });
                setMessages(formattedMessages);
            }
        } catch (err) {
            console.error('Error loading chat history:', err);
            setError(err.message);
            setStatus('error');
        }
    }, [topicId]);

    useEffect(() => {
        loadMessages();
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [loadMessages]);

    const send = useCallback(async (text) => {
        if (!text || text.trim() === '') return;
        if (status === 'streaming') return;

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        const tempUserId = `temp_user_${Date.now()}`;
        const tempAssistantId = `temp_assistant_${Date.now()}`;

        const optimisticUserMessage = {
            id: tempUserId,
            _id: tempUserId,
            role: 'user',
            content: text,
            createdAt: new Date().toISOString()
        };

        setMessages(prev => [...prev, optimisticUserMessage]);
        setStatus('streaming');
        setError(null);

        try {
            const response = await fetch(`/api/topics/${topicId}/chat/stream`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream'
                },
                body: JSON.stringify({
                    question: text,
                    persona,
                    studyContext: studyContextRef.current || undefined,
                }),
                signal: abortController.signal
            });

            if (!response.ok) {
                throw new Error(`Failed to send message: ${response.status}`);
            }

            setMessages(prev => [...prev, {
                id: tempAssistantId,
                _id: tempAssistantId,
                role: 'assistant',
                content: '',
                createdAt: new Date().toISOString()
            }]);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const parts = buffer.split('\n\n');
                buffer = parts.pop(); 
                
                for (const part of parts) {
                    const eventMatch = part.match(/^event:\s*(.+)$/m);
                    const dataMatch = part.match(/^data:\s*(.+)$/m);
                    
                    if (!eventMatch || !dataMatch) continue;
                    
                    const eventType = eventMatch[1].trim();
                    let data;
                    try {
                        data = JSON.parse(dataMatch[1]);
                    } catch (e) {
                        console.error('Failed to parse SSE data:', e);
                        continue;
                    }

                    if (eventType === 'text-delta') {
                        setMessages(prev => {
                            const newMessages = [...prev];
                            const lastIndex = newMessages.length - 1;
                            if (lastIndex >= 0 && newMessages[lastIndex].role === 'assistant') {
                                newMessages[lastIndex] = {
                                    ...newMessages[lastIndex],
                                    content: newMessages[lastIndex].content + data
                                };
                            }
                            return newMessages;
                        });
                    } else if (eventType === 'message-complete') {
                        setMessages(prev => {
                            const newMessages = prev.filter(
                                msg => msg.id !== tempUserId && msg.id !== tempAssistantId
                            );
                            if (data.userMessage) {
                                const id = data.userMessage.id || data.userMessage._id;
                                newMessages.push({
                                    ...data.userMessage,
                                    id,
                                    _id: id,
                                });
                            }
                            if (data.assistantMessage) {
                                const id = data.assistantMessage.id || data.assistantMessage._id;
                                newMessages.push({
                                    ...data.assistantMessage,
                                    id,
                                    _id: id,
                                });
                            }
                            return newMessages;
                        });
                    } else if (eventType === 'error') {
                        throw new Error(parseTutorStreamError(data));
                    }
                }
            }
            
            setStatus('ready');
        } catch (err) {
            if (err.name === 'AbortError') {
                console.log('Stream aborted');
                setStatus('ready');
            } else {
                console.error('Streaming error:', err);
                setError(err.message);
                setStatus('error');
            }
        } finally {
            if (abortControllerRef.current === abortController) {
                abortControllerRef.current = null;
            }
        }
    }, [topicId, persona, status]);

    const cancel = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
    }, []);

    const clear = useCallback(async () => {
        if (!topicId) return;
        try {
            await fetch(`/api/topics/${topicId}/chat`, {
                method: 'DELETE',
                credentials: 'include'
            });
            setMessages([]);
        } catch (err) {
            console.error('Failed to clear chat:', err);
            setError(err.message);
        }
    }, [topicId]);

    const reload = useCallback(() => {
        loadMessages();
    }, [loadMessages]);

    return { messages, status, error, send, cancel, clear, reload };
}
