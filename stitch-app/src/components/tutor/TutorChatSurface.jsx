import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
} from '@/components/ai-elements/prompt-input';
import { Suggestion, Suggestions } from '@/components/ai-elements/suggestion';
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller';
import { TutorMessageRow, TutorWelcomeMessage } from '@/components/tutor/TutorMessageRow';
import { TutorTypingIndicator } from '@/components/tutor/TutorTypingIndicator';
import { cn } from '@/lib/utils';

export function TutorChatMessages({
  messages,
  isTyping = false,
  loadingState = null,
  emptyState = null,
  courseBadge = null,
  compact = false,
  scrollerKey,
  contentClassName,
  className,
  'aria-label': ariaLabel = 'AI Tutor conversation',
}) {
  const showTranscript = !loadingState && messages.length > 0;

  return (
    <MessageScrollerProvider
      key={scrollerKey}
      autoScroll
      defaultScrollPosition="last-anchor"
      scrollPreviousItemPeek={64}
    >
      <MessageScroller
        className={cn('min-h-0 flex-1', className)}
        aria-label={ariaLabel}
      >
        <MessageScrollerViewport>
          <MessageScrollerContent
            className={cn(compact ? 'gap-3 px-3 py-4' : 'gap-space-6 p-space-5', contentClassName)}
            aria-busy={isTyping || undefined}
          >
            {courseBadge ? (
              <MessageScrollerItem messageId="course-badge">
                <div className="text-center">{courseBadge}</div>
              </MessageScrollerItem>
            ) : null}

            {loadingState ? (
              <MessageScrollerItem messageId="loading-state">
                {loadingState}
              </MessageScrollerItem>
            ) : null}

            {!loadingState && messages.length === 0 && emptyState ? (
              <MessageScrollerItem messageId="welcome-state">
                {emptyState}
              </MessageScrollerItem>
            ) : null}

            {showTranscript
              ? messages.map((message, index) => {
                  const showAvatar = index === 0 || messages[index - 1].role !== message.role;
                  return (
                    <MessageScrollerItem
                      key={message._id}
                      messageId={String(message._id)}
                      scrollAnchor={message.role === 'user'}
                    >
                      <TutorMessageRow
                        message={message}
                        showAvatar={showAvatar}
                        compact={compact}
                      />
                    </MessageScrollerItem>
                  );
                })
              : null}

            {!loadingState && isTyping ? (
              <MessageScrollerItem messageId="typing-indicator">
                <TutorTypingIndicator compact={compact} />
              </MessageScrollerItem>
            ) : null}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}

export function TutorChatComposer({
  suggestedPrompts = [],
  onSuggestedPrompt,
  onSubmit,
  sending = false,
  error = '',
  placeholder,
  inputAriaLabel,
  disclaimer,
  disabled = false,
  initialInput = '',
  className,
}) {
  const handleSubmit = async ({ text }) => {
    const question = String(text || '').trim();
    if (!question || sending || disabled) return;
    await onSubmit(question);
  };

  const composer = (
    <div className={cn('flex flex-col gap-space-3 border-t border-border-subtle bg-surface p-space-4', className)}>
      {suggestedPrompts.length > 0 ? (
        <Suggestions>
          {suggestedPrompts.map((prompt) => (
            <Suggestion
              key={prompt.text || prompt.label}
              suggestion={prompt.prompt}
              disabled={sending || disabled}
              className="border-border-default bg-surface-soft font-label-xs text-label-xs text-text-secondary hover:bg-surface-muted hover:text-text-primary"
              onClick={(value) => onSuggestedPrompt?.(value)}
            >
              {prompt.text || prompt.label}
            </Suggestion>
          ))}
        </Suggestions>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-error/20 bg-error-soft px-space-3 py-space-2 font-body-sm text-body-sm text-error">
          {error}
        </p>
      ) : null}

      <PromptInput className="shadow-sm" onSubmit={handleSubmit}>
        <PromptInputBody>
          <PromptInputTextarea
            aria-label={inputAriaLabel}
            placeholder={placeholder}
            disabled={sending || disabled}
          />
        </PromptInputBody>
        <PromptInputFooter className="justify-end">
          <PromptInputSubmit
            disabled={sending || disabled}
            status={sending ? 'submitted' : undefined}
            className="bg-primary text-on-primary hover:bg-primary-hover"
            aria-label="Send message to AI Tutor"
          />
        </PromptInputFooter>
      </PromptInput>

      {disclaimer ? (
        <div className="text-center">
          <p className="font-label-xs text-label-xs text-text-muted">{disclaimer}</p>
        </div>
      ) : null}
    </div>
  );

  if (initialInput) {
    return (
      <PromptInputProvider initialInput={initialInput} key={initialInput}>
        {composer}
      </PromptInputProvider>
    );
  }

  return composer;
}

export { TutorWelcomeMessage };
