import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { isLikelyConvexId } from '../lib/convexId';

const ConceptIntro = () => {
    const { topicId: topicIdParam } = useParams();
    const normalizedTopicId = typeof topicIdParam === 'string' ? topicIdParam.trim() : '';
    const topicId = isLikelyConvexId(normalizedTopicId) ? normalizedTopicId : '';

    if (!topicId) {
        return <Navigate to="/dashboard" replace />;
    }

    return <Navigate to={`/dashboard/concept/${topicId}`} replace />;
};

export default ConceptIntro;
