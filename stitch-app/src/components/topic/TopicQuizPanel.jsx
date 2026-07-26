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
            title={topicProgress?.completedAt ? 'Lesson complete — keep the momentum' : 'Ready to test your understanding?'}
            description={topicProgress?.completedAt ? postLessonPrompt : (isTopicQuizRoute ? 'Pick how you want to practice this lesson.' : practiceDescription)}
            primaryActions={practicePrimary}
            secondaryActions={practiceSecondary}
            tertiaryActions={practiceTertiary}
            completed={Boolean(topicProgress?.completedAt)}
            bestScore={topicProgress?.bestScore ?? null}
        />

        {topicProgress?.completedAt ? (
            <div className="rounded-[24px] border border-border-subtle bg-surface p-5 shadow-sm md:p-6">
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
                        ? 'Choose objective, essay, or concept practice for this topic.'
                        : 'This topic is assessed as part of the final exam.'}
                    variant="lesson"
                />
            </div>
        ) : null}
    </>
);

export default TopicQuizPanel;
