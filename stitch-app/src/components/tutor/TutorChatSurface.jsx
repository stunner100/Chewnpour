import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
} from '@/components/ai-elements/prompt-input';
import { Suggestion, Suggestions } from '@/components/ai-elements/suggestion';
import { TutorMessageRow, TutorWelcomeMessage } from '@/components/tutor/TutorMessageRow';
import { cn } from '@/lib/utils';

export function TutorChatMessages({
  messages,
  messagesContainerRef,
  getMessageAnchorRef,
  loadingState = null,
  emptyState = null,
  courseBadge = null,
  className,
  'aria-label': ariaLabel = 'AI Tutor conversation',
}) {
  return (
    <div
      ref={messagesContainerRef}
      className={cn('flex min-h-0 flex-1 flex-col gap-space-6 overflow-y-auto p-space-5', className)}
      aria-label={ariaLabel}
    >
      {courseBadge ? (
        <div className="text-center">{courseBadge}</div>
      ) : null}

      {loadingState}

      {!loadingState && messages.length === 0 && emptyState}

      {!loadingState &&
        messages.map((message) => (
          <div key={message._id} ref={getMessageAnchorRef?.(message) ?? null}>
            <TutorMessageRow message={message} />
          </div>
        ))}
    </div>
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
