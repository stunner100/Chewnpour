import { useEffect, useMemo, useState } from 'react';
import { isStaleTopicRouteLookupError } from '../lib/chunkLoadRecovery.js';

const STALE_ROUTE_CACHE_TIMEOUT_MS = 300;
const ROUTE_TOPIC_RESOLUTION_TIMEOUT_MS = 3000;

export const useRouteResolvedTopic = (routeTopicId, topicQueryResult, options = {}) => {
    const suspendMissingDetection = options?.suspendMissingDetection === true;
    const [timedOutRouteKey, setTimedOutRouteKey] = useState('');
    const [failedRouteKey, setFailedRouteKey] = useState('');

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
        if (suspendMissingDetection || !routeTopicId || topicQueryResult === null || routeTopic) {
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
    }, [hasMismatchedCachedTopic, routeResolutionKey, routeTopic, routeTopicId, suspendMissingDetection, topicQueryResult]);

    useEffect(() => {
        if (typeof window === 'undefined' || suspendMissingDetection || !routeTopicId) {
            return undefined;
        }

        const markRouteFailed = (errorLike) => {
            if (!isStaleTopicRouteLookupError(errorLike)) return;
            setFailedRouteKey(routeResolutionKey);
        };

        const handleError = (event) => {
            markRouteFailed(event?.error || event?.message);
        };
        const handleUnhandledRejection = (event) => {
            markRouteFailed(event?.reason);
        };

        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleUnhandledRejection);

        return () => {
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleUnhandledRejection);
        };
    }, [routeResolutionKey, routeTopicId, suspendMissingDetection]);

    const routeLookupTimedOut = timedOutRouteKey === routeResolutionKey;
    const routeLookupFailed = failedRouteKey === routeResolutionKey;
    const isMissingRouteTopic =
        !suspendMissingDetection
        && Boolean(routeTopicId)
        && (topicQueryResult === null || routeLookupTimedOut || routeLookupFailed)
        && !routeTopic;
    const isLoadingRouteTopic =
        Boolean(routeTopicId)
        && (suspendMissingDetection || (!routeTopic && !isMissingRouteTopic));

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
