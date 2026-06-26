import { Bubble, BubbleContent } from '@/components/ui/bubble';
import {
  Message,
  MessageAvatar,
  MessageContent,
} from '@/components/ui/message';
import { TutorAvatar } from '@/components/tutor/TutorAvatar';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

const assistantBubbleClass =
  'rounded-2xl rounded-tl-sm border border-outline-variant bg-ai-subtle px-4 py-3 shadow-sm dark:!bg-[#212226]';
const userBubbleClass =
  'rounded-2xl rounded-tr-sm border border-border-subtle bg-surface-muted px-4 py-3 shadow-sm dark:!bg-[#2a241c]';

export function TutorMessageRow({
  message,
  showAvatar = true,
  compact = false,
  className,
}) {
  const isUser = message.role === 'user';
  const avatarClass = compact ? 'size-7' : 'size-9';

  if (isUser) {
    return (
      <Message align="end" className={className}>
        <MessageContent>
          <Bubble variant="ghost" className={compact ? 'max-w-[85%]' : 'max-w-[80%] md:max-w-[70%]'}>
            <BubbleContent className={userBubbleClass}>
              <p className="whitespace-pre-wrap font-body-sm text-body-sm text-text-primary">
                {message.content}
              </p>
            </BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
    );
  }

  return (
    <Message align="start" className={className}>
      <MessageAvatar className={cn(compact ? 'min-w-7' : 'min-w-9', !showAvatar && 'invisible')}>
        {showAvatar ? (
          <TutorAvatar className={avatarClass} />
        ) : null}
      </MessageAvatar>
      <MessageContent>
        <Bubble variant="ghost" className={compact ? 'max-w-[85%]' : 'max-w-[85%] md:max-w-[75%]'}>
          <BubbleContent className={assistantBubbleClass}>
            {message.pending ? (
              <div className="flex items-center gap-3" role="status" aria-live="polite">
                <span className="font-label-xs text-label-xs text-text-secondary">
                  {compact ? 'Thinking' : 'Tutor is preparing an answer'}
                </span>
                <Spinner className={compact ? 'size-3.5' : 'size-4 text-primary'} />
              </div>
            ) : (
              <p className="whitespace-pre-wrap font-body-sm text-body-sm text-text-primary">
                {message.content}
              </p>
            )}
          </BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  );
}

export function TutorWelcomeMessage({ topicTitle, description, compact = false }) {
  return (
    <Message align="start">
      <MessageAvatar className={compact ? 'min-w-7' : 'min-w-9'}>
        <TutorAvatar className={compact ? 'size-7' : 'size-9'} />
      </MessageAvatar>
      <MessageContent>
        <Bubble variant="ghost" className="max-w-[85%]">
          <BubbleContent className={assistantBubbleClass}>
            <p className="font-body-sm text-body-sm text-text-primary">
              {compact ? (
                <>Hi! I&apos;m your AI tutor{topicTitle ? ` for "${topicTitle}"` : ''}. Ask anything, or try one of these:</>
              ) : (
                <>
                  I can help with {topicTitle}. Ask about a confusing idea, request examples, or start a quick review.
                </>
              )}
            </p>
            {!compact && description ? (
              <p className="mt-space-3 font-body-sm text-body-sm text-text-secondary">{description}</p>
            ) : null}
          </BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  );
}
