import React, { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';
import { useStudyTimer } from '../hooks/useStudyTimer';
import { useRouteResolvedTopic } from '../hooks/useRouteResolvedTopic';
import { useExamAttempt } from '../hooks/useExamAttempt';
import { captureSentryMessage } from '../lib/sentry';
import ExamPreparationLoader from '../components/ExamPreparationLoader';
import ExamLoadingShell from '../components/ExamLoadingShell';
import ExamFormatPicker from '../components/ExamFormatPicker';
import ExamActiveSession from '../components/ExamActiveSession';
import ExamGradingOverlay from '../components/ExamGradingOverlay';
import { EXAM_STEPS, resolveExamStep } from '../lib/resolveExamStep';
import { createInitialExamState, examModeReducer } from '../lib/examModeState';
import { getExamSessionExpiredMessage } from '../lib/examAttemptSupport';
import { resolveQuestionOptions } from '../lib/examQuestionOptions';

const ExamMode = () => {
    const { topicId: topicIdParam } = useParams();
    const routeTopicId = typeof topicIdParam === 'string' ? topicIdParam.trim() : '';
    const routerLocation = useLocation();
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();

    const [examState, dispatchExamState] = useReducer(
        examModeReducer,
        routerLocation.search,
        createInitialExamState,
    );
    const {
        attemptId,
        examFormat,
        examStarted,
        gradingEssay,
        routingBootstrapPending,
        selectedAnswers,
        startExamError,
        startingExamAttempt,
        submitError,
    } = examState;
    const invalidRouteReportedRef = useRef('');
    const routingBootstrapKeyRef = useRef('');

    const userId = user?.id;
    useStudyTimer(userId);

    const reloadDashboard = useCallback(() => {
        if (typeof window !== 'undefined') {
            window.location.assign('/dashboard');
            return;
        }
        navigate('/dashboard', { replace: true });
    }, [navigate]);

    const topicQueryResult = useQuery(
        api.topics.getTopicWithQuestions,
        routeTopicId ? { topicId: routeTopicId } : 'skip',
    );
    const {
        topic,
        topicId,
        rawTopicId,
        hasMismatchedCachedTopic,
        isLoadingRouteTopic,
        isMissingRouteTopic,
    } = useRouteResolvedTopic(routeTopicId, topicQueryResult);

    const hasFinalAssessmentRoutingContext = Boolean(topic?.courseId && topic?.sourceUploadId);
    const routedFinalAssessmentTopic = useQuery(
        api.topics.getFinalAssessmentTopicByCourseAndUpload,
        hasFinalAssessmentRoutingContext
            ? { courseId: topic.courseId, sourceUploadId: topic.sourceUploadId }
            : 'skip',
    );
    const ensureAssessmentRoutingForTopic = useAction(api.ai.ensureAssessmentRoutingForTopic);

    const {
        questions,
        hasAttemptQuestions,
        currentQuestion,
        attemptQualityTier,
        activePreparationMessage,
        formattedTime,
        isLowTime,
        progress,
        answeredQuestionCount,
        isEssaySubmitBlocked,
        handleAnswerSelect,
        handleNext,
        handlePrevious,
        handleNavigateToQuestion,
        handleSubmit,
        handleRetryStart,
    } = useExamAttempt({
        routeSearch: routerLocation.search,
        routeTopicId,
        topicId,
        userId,
        authLoading,
        examState,
        dispatchExamState,
        navigate,
        isLoadingRouteTopic,
        isMissingRouteTopic,
    });

    useEffect(() => {
        routingBootstrapKeyRef.current = '';
    }, [routeTopicId, routerLocation.search]);

    useEffect(() => {
        if (!topicId || !topic?.courseId || !topic?.sourceUploadId) {
            return;
        }

        const needsRoutingBootstrap = (
            !topic?.assessmentRoute
            || !topic?.assessmentClassification
            || (
                topic?.topicKind !== 'document_final_exam'
                && routedFinalAssessmentTopic === null
            )
        );

        if (!needsRoutingBootstrap) {
            return;
        }

        const bootstrapKey = `${topicId}:${topic.sourceUploadId}`;
        if (routingBootstrapKeyRef.current === bootstrapKey) {
            return;
        }

        routingBootstrapKeyRef.current = bootstrapKey;
        dispatchExamState({ type: 'patch', patch: { routingBootstrapPending: true } });

        ensureAssessmentRoutingForTopic({ topicId })
            .catch((error) => {
                console.warn('Failed to bootstrap assessment routing for exam topic', error);
            })
            .finally(() => {
                dispatchExamState({ type: 'patch', patch: { routingBootstrapPending: false } });
            });
    }, [
        ensureAssessmentRoutingForTopic,
        routedFinalAssessmentTopic,
        topic?.assessmentClassification,
        topic?.assessmentRoute,
        topic?.courseId,
        topic?.sourceUploadId,
        topic?.topicKind,
        topicId,
    ]);

    useEffect(() => {
        if (!routeTopicId || !isMissingRouteTopic) return;
        if (invalidRouteReportedRef.current === routeTopicId) return;
        invalidRouteReportedRef.current = routeTopicId;
        captureSentryMessage('Stale exam topic route encountered', {
            level: 'warning',
            tags: {
                area: 'exam_route',
                page: 'exam_mode',
            },
            extras: {
                routeTopicId,
                rawTopicId,
                hasMismatchedCachedTopic,
                pathname: routerLocation.pathname,
                referrer: typeof document !== 'undefined' ? document.referrer || '' : '',
            },
        });
    }, [hasMismatchedCachedTopic, isMissingRouteTopic, routerLocation.pathname, rawTopicId, routeTopicId]);

    const shouldRedirectToFinalExam = (
        topic?.topicKind !== 'document_final_exam'
        && topic?.assessmentRoute
        && topic.assessmentRoute !== 'topic_quiz'
    );

    useEffect(() => {
        if (!shouldRedirectToFinalExam) return;
        if (!routedFinalAssessmentTopic?._id) return;
        if (routedFinalAssessmentTopic._id === topicId) return;
        navigate(`/dashboard/quiz/${routedFinalAssessmentTopic._id}${routerLocation.search || ''}`, { replace: true });
    }, [navigate, routerLocation.search, routedFinalAssessmentTopic?._id, shouldRedirectToFinalExam, topicId]);

    const currentQuestionData = questions[currentQuestion];
    const finalOptions = useMemo(() => {
        const fromOptions = resolveQuestionOptions(currentQuestionData?.options);
        if (fromOptions.length > 0) return fromOptions;
        if (Array.isArray(currentQuestionData?.tokens) && currentQuestionData.tokens.length > 0) {
            return currentQuestionData.tokens.map((token, index) => ({
                label: String.fromCharCode(65 + index),
                value: token,
                text: token,
            }));
        }
        return fromOptions;
    }, [currentQuestionData]);

    const examStep = resolveExamStep({
        routeTopicId,
        isLoadingRouteTopic,
        isMissingRouteTopic,
        shouldRedirectToFinalExam,
        routedFinalAssessmentTopic,
        topicId,
        routingBootstrapPending,
        examFormat,
        examStarted,
        startingExamAttempt,
        hasAttemptQuestions,
        attemptId,
        questionCount: questions.length,
    });

    if (examStep === EXAM_STEPS.MISSING_TOPIC) {
        return (
            <ExamLoadingShell
                variant="status"
                icon="quiz"
                title="Select a topic to start a quiz"
                message="Go back to your dashboard and choose a topic to begin."
                action={{ type: 'link', to: '/dashboard', label: 'Back to Dashboard' }}
            />
        );
    }

    if (examStep === EXAM_STEPS.LOADING_TOPIC) {
        return (
            <ExamLoadingShell
                variant="loading"
                message="Preparing your quiz environment…"
            />
        );
    }

    if (examStep === EXAM_STEPS.STALE_LINK) {
        return (
            <ExamLoadingShell
                variant="status"
                icon="search_off"
                title="This quiz link is stale"
                message="Reload the dashboard, reopen the topic, and start the quiz from there."
                action={{ type: 'button', onClick: reloadDashboard, label: 'Reload Dashboard' }}
            />
        );
    }

    if (examStep === EXAM_STEPS.FINAL_EXAM_LOADING) {
        return (
            <ExamLoadingShell
                variant="loading"
                message="Preparing your final quiz…"
            />
        );
    }

    if (examStep === EXAM_STEPS.ROUTING_BOOTSTRAP) {
        return (
            <ExamLoadingShell
                variant="loading"
                message="Preparing the best assessment route for this topic…"
            />
        );
    }

    if (examStep === EXAM_STEPS.FINAL_EXAM_REDIRECT) {
        return (
            <ExamLoadingShell
                variant="loading"
                message="Redirecting to your final quiz…"
            />
        );
    }

    if (examStep === EXAM_STEPS.FINAL_EXAM_UNAVAILABLE) {
        return (
            <ExamLoadingShell
                variant="status"
                icon="hourglass_top"
                title="This topic is covered in the final quiz"
                message="The final quiz is still being prepared. Return to the course and try again in a moment."
                action={{ type: 'link', to: `/dashboard/topic/${topicId}`, label: 'Back to Topic' }}
            />
        );
    }

    if (examStep === EXAM_STEPS.CHOOSE_FORMAT) {
        return (
            <ExamFormatPicker
                onChooseFormat={(nextExamFormat) => {
                    dispatchExamState({ type: 'chooseFormat', examFormat: nextExamFormat });
                }}
            />
        );
    }

    if (examStep === EXAM_STEPS.PREPARATION) {
        return (
            <ExamPreparationLoader
                examFormat={examFormat}
                subtitle={activePreparationMessage}
                failed={Boolean(startExamError)}
                errorMsg={startExamError}
                onRetry={handleRetryStart}
                onBack={() => dispatchExamState({ type: 'clearStartAndFormat' })}
                isSessionExpired={startExamError === getExamSessionExpiredMessage()}
            />
        );
    }

    return (
        <>
            {gradingEssay ? <ExamGradingOverlay /> : null}
            <ExamActiveSession
                topicId={topicId}
                topicTitle={topic?.title}
                examFormat={examFormat}
                questions={questions}
                currentQuestion={currentQuestion}
                selectedAnswers={selectedAnswers}
                attemptId={attemptId}
                startExamError={startExamError}
                submitError={submitError}
                examQualityTier={attemptQualityTier}
                formattedTime={formattedTime}
                isLowTime={isLowTime}
                progress={progress}
                answeredQuestionCount={answeredQuestionCount}
                isEssaySubmitBlocked={isEssaySubmitBlocked}
                finalOptions={finalOptions}
                currentQuestionData={currentQuestionData}
                onAnswerSelect={handleAnswerSelect}
                onPrevious={handlePrevious}
                onNext={handleNext}
                onSubmit={handleSubmit}
                onNavigateToQuestion={handleNavigateToQuestion}
                sessionExpiredMessage={getExamSessionExpiredMessage()}
            />
        </>
    );
};

export default ExamMode;
