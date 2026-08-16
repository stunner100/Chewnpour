import React from 'react';
import PracticeActionsCard from '../lesson/PracticeActionsCard';
import NextStepsGuidance from '../NextStepsGuidance';

const TopicQuizPanel = ({
    examTopicId,
    isTopicQuizRoute,
    openChat,
    postLessonPrompt,
    practiceDescription,
    practicePrimary,
    practiceSecondary,
    practiceTertiary,
    resolvedTopicTitle,
    topicId,
    topicProgress,
    wordBankTerms,
}) => (
    <>
        <PracticeActionsCard
            title={topicProgress?.bestScore != null ? 'Quiz done' : 'Test this lesson'}
            description={topicProgress?.bestScore != null ? postLessonPrompt : (isTopicQuizRoute ? 'A short quiz on what you just read.' : practiceDescription)}
            primaryActions={practicePrimary}
            secondaryActions={practiceSecondary}
            tertiaryActions={practiceTertiary}
            completed={Boolean(topicProgress?.completedAt)}
            bestScore={topicProgress?.bestScore ?? null}
        />

        {topicProgress?.bestScore != null ? (
            <div className="border-t border-border-subtle pt-5">
                <NextStepsGuidance
                    topicId={topicId}
                    examTopicId={examTopicId}
                    topicTitle={resolvedTopicTitle}
                    percentage={null}
                    completedAt={topicProgress?.completedAt}
                    bestScore={topicProgress?.bestScore}
                    hasWordBank={wordBankTerms?.length > 0}
                    onOpenChat={openChat}
                    examLabel={isTopicQuizRoute ? 'Start the objective quiz' : 'Take the final objective quiz'}
                    examDescription={isTopicQuizRoute
                        ? 'Retry this quiz, or try essay or concept practice.'
                        : 'This topic is assessed as part of the final exam.'}
                    variant="lesson"
                />
            </div>
        ) : null}
    </>
);

export default TopicQuizPanel;
