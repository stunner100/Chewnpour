import { BotIcon } from 'lucide-react';
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
} from '@/components/ai-elements/prompt-input';
import { Suggestion, Suggestions } from '@/components/ai-elements/suggestion';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

const assistantBubbleClass =
  'rounded-2xl rounded-tl-sm border border-outline-variant bg-ai-subtle px-4 py-3 shadow-sm dark:!bg-[#212226]';
const userBubbleClass =
  'rounded-2xl rounded-tr-sm border border-border-subtle bg-surface-muted px-4 py-3 shadow-sm dark:!bg-[#2a241c]';

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
      className={cn('flex-1 min-h-0 overflow-y-auto p-space-5 flex flex-col gap-space-6', className)}
      aria-label={ariaLabel}
    >
      {courseBadge ? (
        <div className="text-center">{courseBadge}</div>
      ) : null}

      {loadingState}

      {!loadingState && messages.length === 0 && emptyState}

      {!loadingState &&
        messages.map((message) => {
          const isUser = message.role === 'user';
          const anchorRef = getMessageAnchorRef?.(message) ?? null;

          return (
            <div key={message._id} ref={anchorRef}>
              <Message
                from={isUser ? 'user' : 'assistant'}
                className={cn('max-w-full', isUser ? 'justify-end' : 'gap-4')}
              >
                {!isUser ? (
                  <div className="flex w-full items-start gap-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary-fixed-dim bg-primary-soft">
                      <BotIcon className="size-4 text-primary" aria-hidden="true" />
                    </div>
                    <MessageContent className={assistantBubbleClass}>
                      {message.pending ? (
                        <div className="flex items-center gap-3" role="status" aria-live="polite">
                          <span className="font-label-xs text-label-xs text-text-secondary">
                            Tutor is preparing an answer
                          </span>
                          <Spinner className="size-4 text-primary" />
                        </div>
                      ) : (
                        <MessageResponse className="font-body-sm text-body-sm text-text-primary">
                          {message.content}
                        </MessageResponse>
                      )}
                    </MessageContent>
                  </div>
                ) : (
                  <MessageContent className={userBubbleClass}>
                    <p className="font-body-sm text-body-sm text-text-primary whitespace-pre-wrap">
                      {message.content}
                    </p>
                  </MessageContent>
                )}
              </Message>
            </div>
          );
        })}
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

      <PromptInput
        className="shadow-sm"
        onSubmit={handleSubmit}
      >
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
