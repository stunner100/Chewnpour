import { useEffect, useMemo, useState } from 'react';

const STALE_ROUTE_CACHE_TIMEOUT_MS = 300;
const ROUTE_TOPIC_RESOLUTION_TIMEOUT_MS = 3000;

export const useRouteResolvedTopic = (routeTopicId, topicQueryResult) => {
    const [timedOutRouteKey, setTimedOutRouteKey] = useState('');

    const rawTopicId = typeof topicQueryResult?._id === 'string'
        ? topicQueryResult._id
        : '';
    const hasMismatchedCachedTopic = Boolean(routeTopicId && rawTopicId && rawTopicId !== routeTopicId);
    const routeTopicStateKey = topicQueryResult === null ? 'missing' : rawTopicId || 'pending';
    const routeResolutionKey = `${routeTopicId}:${routeTopicStateKey}`;

    const routeTopic = useMemo(() => {
        if (!routeTopicId || !rawTopicId || rawTopicId !== routeTopicId) {
            return null;
        }
        return topicQueryResult;
    }, [rawTopicId, routeTopicId, topicQueryResult]);

    useEffect(() => {
        if (!routeTopicId || topicQueryResult === null || routeTopic) {
            return undefined;
        }

        if (typeof window === 'undefined') {
            return undefined;
        }

        const timeoutMs = hasMismatchedCachedTopic
            ? STALE_ROUTE_CACHE_TIMEOUT_MS
            : ROUTE_TOPIC_RESOLUTION_TIMEOUT_MS;
        const timeoutId = window.setTimeout(() => {
            setTimedOutRouteKey(routeResolutionKey);
        }, timeoutMs);

        return () => window.clearTimeout(timeoutId);
    }, [hasMismatchedCachedTopic, routeResolutionKey, routeTopic, routeTopicId, topicQueryResult]);

    const routeLookupTimedOut = timedOutRouteKey === routeResolutionKey;
    const isMissingRouteTopic = Boolean(routeTopicId) && (topicQueryResult === null || routeLookupTimedOut) && !routeTopic;
    const isLoadingRouteTopic = Boolean(routeTopicId) && !routeTopic && !isMissingRouteTopic;

    return {
        topic: routeTopic,
        topicId: typeof routeTopic?._id === 'string' ? routeTopic._id : '',
        rawTopicId,
        hasMismatchedCachedTopic,
        isLoadingRouteTopic,
        isMissingRouteTopic,
    };
};

export default useRouteResolvedTopic;
