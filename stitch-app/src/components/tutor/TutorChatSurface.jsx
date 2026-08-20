import { useLayoutEffect, useRef } from 'react';
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  usePromptInputController,
} from '@/components/ai-elements/prompt-input';
import { Suggestion, Suggestions } from '@/components/ai-elements/suggestion';
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  useMessageScroller,
} from '@/components/ui/message-scroller';
import { TutorMessageRow, TutorWelcomeMessage } from '@/components/tutor/TutorMessageRow';
import { TutorTypingIndicator } from '@/components/tutor/TutorTypingIndicator';
import { cn } from '@/lib/utils';

const TUTOR_MESSAGE_ITEM_CLASS = '[content-visibility:visible] [contain-intrinsic-size:none]';

function latestUserMessageId(messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user' && messages[index]?._id != null) {
      return String(messages[index]._id);
    }
  }
  return null;
}

function TutorLatestTurnFocus({ messageId }) {
  const { scrollToMessage } = useMessageScroller();
  const previousIdRef = useRef(null);
  const isFirstPassRef = useRef(true);

  useLayoutEffect(() => {
    if (isFirstPassRef.current) {
      isFirstPassRef.current = false;
      previousIdRef.current = messageId || null;
      return;
    }
    if (!messageId || previousIdRef.current === messageId) return;
    previousIdRef.current = messageId;
    scrollToMessage(messageId, { align: 'start' });
  }, [messageId, scrollToMessage]);

  return null;
}

export function TutorChatMessages({
  messages,
  isTyping = false,
  loadingState = null,
  emptyState = null,
  error = '',
  courseBadge = null,
  compact = false,
  scrollerKey,
  contentClassName,
  className,
  'aria-label': ariaLabel = 'AI Tutor conversation',
}) {
  const showTranscript = !loadingState && messages.length > 0;
  const hasUserScrollAnchor = messages.some((message) => message.role === 'user');
  const defaultScrollPosition = hasUserScrollAnchor ? 'last-anchor' : 'start';
  const latestUserTurnId = latestUserMessageId(messages);
  const hideWelcome = Boolean(loadingState) || messages.length > 0;

  return (
    <MessageScrollerProvider
      key={scrollerKey}
      defaultScrollPosition={defaultScrollPosition}
      scrollPreviousItemPeek={64}
    >
      <TutorLatestTurnFocus messageId={latestUserTurnId} />
      <MessageScroller
        className={cn('min-h-0 w-full flex-1 ph-mask', className)}
        aria-label={ariaLabel}
      >
        <MessageScrollerViewport>
          <MessageScrollerContent
            className={cn(compact ? 'gap-3 px-3 py-4' : 'gap-5 p-5 md:p-6', contentClassName)}
            aria-busy={isTyping || undefined}
          >
            {courseBadge ? (
              <MessageScrollerItem className={cn(TUTOR_MESSAGE_ITEM_CLASS, 'max-md:hidden')} messageId="course-badge">
                <div className="text-center">{courseBadge}</div>
              </MessageScrollerItem>
            ) : null}

            {loadingState ? (
              <MessageScrollerItem className={TUTOR_MESSAGE_ITEM_CLASS} messageId="loading-state">
                {loadingState}
              </MessageScrollerItem>
            ) : null}

            {emptyState ? (
              <MessageScrollerItem
                className={cn(TUTOR_MESSAGE_ITEM_CLASS, hideWelcome && 'hidden')}
                messageId="welcome-state"
                inert={hideWelcome || undefined}
              >
                {emptyState}
              </MessageScrollerItem>
            ) : null}

            {showTranscript
              ? messages.map((message, index) => {
                  const showAvatar = index === 0 || messages[index - 1].role !== message.role;
                  return (
                    <MessageScrollerItem
                      key={message._id}
                      className={TUTOR_MESSAGE_ITEM_CLASS}
                      messageId={String(message._id)}
                      scrollAnchor={String(message._id) === latestUserTurnId}
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

            {error ? (
              <MessageScrollerItem className={TUTOR_MESSAGE_ITEM_CLASS} messageId="tutor-error">
                <p className="rounded-[16px] border border-error/20 bg-error-soft px-3 py-2 text-body-sm text-error" role="alert">
                  {error}
                </p>
              </MessageScrollerItem>
            ) : null}

            {!loadingState && isTyping ? (
              <MessageScrollerItem className={TUTOR_MESSAGE_ITEM_CLASS} messageId="typing-indicator">
                <TutorTypingIndicator compact={compact} />
              </MessageScrollerItem>
            ) : null}
          </MessageScrollerContent>
        </MessageScrollerViewport>
      </MessageScroller>
    </MessageScrollerProvider>
  );
}

export function TutorChatComposer({
  suggestedPrompts = [],
  onSuggestedPrompt,
  onSubmit,
  onStop,
  sending = false,
  status,
  error = '',
  placeholder,
  inputAriaLabel,
  disclaimer,
  disabled = false,
  initialInput = '',
  className,
}) {
  const composer = (
    <div className={cn('flex shrink-0 flex-col gap-3 border-t border-border-subtle bg-surface p-4 md:p-5', className)}>
      {suggestedPrompts.length > 0 ? (
        <Suggestions>
          {suggestedPrompts.map((prompt) => (
            <Suggestion
              key={prompt.label || prompt.text || prompt.prompt}
              suggestion={prompt.prompt}
              disabled={sending || disabled}
              className="rounded-full border-border-default bg-surface-soft text-caption font-semibold text-text-secondary hover:bg-surface-muted hover:text-text-primary"
              onClick={async (value) => {
                const question = String(value || '').trim();
                if (!question || sending || disabled) return;
                try {
                  await (onSuggestedPrompt || onSubmit)(question);
                } catch {
                  // Parent owns error state.
                }
              }}
            >
              {prompt.label || prompt.text || prompt.prompt}
            </Suggestion>
          ))}
        </Suggestions>
      ) : null}

      {error ? (
        <p className="rounded-[16px] border border-error/20 bg-error-soft px-3 py-2 text-body-sm text-error" role="alert">
          {error}
        </p>
      ) : null}

      <TutorChatComposerFields
        disabled={disabled}
        inputAriaLabel={inputAriaLabel}
        onStop={onStop}
        onSubmit={onSubmit}
        placeholder={placeholder}
        sending={sending}
        status={status}
      />

      {disclaimer ? (
        <div className="text-center">
          <p className="text-caption text-text-muted">{disclaimer}</p>
        </div>
      ) : null}
    </div>
  );

  return (
    <PromptInputProvider initialInput={initialInput} key={`${initialInput || 'empty'}`}>
      {composer}
    </PromptInputProvider>
  );
}

function readComposerDraft(controller, eventTarget) {
  const fromController = String(controller?.textInput?.value || '').trim();
  if (fromController) return fromController;
  const root = eventTarget instanceof Element ? eventTarget : null;
  const textarea = root?.closest?.('form')?.querySelector('[name="message"]');
  return String(textarea?.value || '').trim();
}

function TutorChatComposerFields({
  disabled,
  inputAriaLabel,
  onStop,
  onSubmit,
  placeholder,
  sending,
  status,
}) {
  const controller = usePromptInputController();
  const isStreaming = status === 'streaming';
  const isWaiting = status === 'submitted';

  const submitText = (raw) => {
    const question = String(raw || '').trim();
    if (!question || sending || disabled) return;
    controller.textInput.clear();
    // Do not await the tutor turn. PromptInput only clears after a returned
    // promise settles, and agent.send() waits for the full stream.
    void Promise.resolve(onSubmit(question)).catch(() => {
      // Parent owns error state.
    });
  };

  return (
    <PromptInput className="rounded-[20px] border border-border-subtle bg-background-light shadow-sm dark:bg-background-dark" onSubmit={({ text }) => submitText(text)}>
      <PromptInputBody>
        <PromptInputTextarea
          aria-label={inputAriaLabel}
          placeholder={placeholder}
          disabled={sending || disabled}
          className="min-h-12 text-base md:text-sm text-text-primary placeholder:text-text-muted"
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
            event.preventDefault();
            submitText(event.currentTarget.value);
          }}
        />
      </PromptInputBody>
      <PromptInputFooter align="inline-end" className="relative z-20 self-end justify-end">
        <PromptInputSubmit
          type="button"
          disabled={disabled || isWaiting}
          status={isStreaming ? 'streaming' : undefined}
          onStop={onStop}
          className="size-11 shrink-0 rounded-full bg-cta text-cta-foreground hover:bg-cta-hover"
          aria-label={isStreaming ? 'Stop tutor reply' : 'Send message to AI Tutor'}
          onClick={(event) => {
            event.preventDefault();
            submitText(readComposerDraft(controller, event.currentTarget));
          }}
        />
      </PromptInputFooter>
    </PromptInput>
  );
}

export { TutorWelcomeMessage };
