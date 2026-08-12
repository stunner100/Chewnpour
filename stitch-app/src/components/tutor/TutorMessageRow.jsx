import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import {
  Message,
  MessageAvatar,
  MessageContent,
} from '@/components/ui/message';
import { TutorAvatar } from '@/components/tutor/TutorAvatar';
import { cn } from '@/lib/utils';

const bubbleShapeClass = 'rounded-[20px] px-4 py-3';

function StudentAvatar({ className }) {
  const { profile, user } = useAuth();
  const displayName =
    profile?.fullName || user?.name || user?.email?.split('@')[0] || 'You';
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <Avatar className={className}>
      <AvatarImage src={profile?.avatarUrl || ''} alt={displayName} />
      <AvatarFallback className="bg-primary-soft text-xs font-medium text-primary">
        {initials || 'ME'}
      </AvatarFallback>
    </Avatar>
  );
}

export function TutorMessageRow({
  message,
  showAvatar = true,
  compact = false,
  className,
}) {
  const isUser = message.role === 'user';
  const avatarClass = compact ? 'size-7' : 'size-9';
  const avatarSlotClass = compact ? 'min-w-7' : 'min-w-9';
  const bubbleWidthClass = compact ? 'max-w-[85%]' : 'max-w-[80%] md:max-w-[70%]';

  if (isUser) {
    return (
      <Message align="end" className={className}>
        <MessageAvatar className={cn(avatarSlotClass, !showAvatar && 'invisible')}>
          {showAvatar ? <StudentAvatar className={avatarClass} /> : null}
        </MessageAvatar>
        <MessageContent>
          <Bubble variant="default" className={bubbleWidthClass}>
            <BubbleContent className={bubbleShapeClass}>
              <p className="whitespace-pre-wrap font-body-sm text-body-sm">
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
      <MessageAvatar className={cn(avatarSlotClass, !showAvatar && 'invisible')}>
        {showAvatar ? (
          <TutorAvatar className={avatarClass} />
        ) : null}
      </MessageAvatar>
      <MessageContent>
        <Bubble variant="muted" className={compact ? 'max-w-[85%]' : 'max-w-[85%] md:max-w-[75%]'}>
          <BubbleContent className={cn(bubbleShapeClass, 'bg-surface-soft dark:bg-surface-hover-dark')}>
            <p className="whitespace-pre-wrap font-body-sm text-body-sm text-foreground">
              {message.content}
            </p>
          </BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  );
}

const promptChipLabel = (prompt) => prompt.label || prompt.text || prompt.prompt;

export function TutorWelcomeMessage({
  topicTitle,
  description,
  compact = false,
  suggestedPrompts = [],
  onSuggestedPrompt,
  sending = false,
}) {
  const lessonLabel = topicTitle || 'this lesson';
  const prompts = Array.isArray(suggestedPrompts) ? suggestedPrompts : [];

  const handleSuggested = async (value) => {
    const question = String(value || '').trim();
    if (!question || sending) return;
    try {
      await onSuggestedPrompt?.(question);
    } catch {
      // Parent owns error state.
    }
  };

  return (
    <Message align="start">
      <MessageAvatar className={compact ? 'min-w-7' : 'min-w-9'}>
        <TutorAvatar className={compact ? 'size-7' : 'size-9'} />
      </MessageAvatar>
      <MessageContent>
        <Bubble variant="muted" className="max-w-[85%]">
          <BubbleContent className={cn(bubbleShapeClass, 'bg-surface-soft dark:bg-surface-hover-dark')}>
            <p className="font-body-sm text-body-sm text-foreground">
              Ask about a confusing idea, get an example, or start a quick review of {lessonLabel}.
            </p>
            {!compact && description ? (
              <p className="mt-space-3 font-body-sm text-body-sm text-muted-foreground">{description}</p>
            ) : null}
            {prompts.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {prompts.map((prompt) => (
                  <button
                    key={promptChipLabel(prompt)}
                    type="button"
                    disabled={sending}
                    onClick={() => handleSuggested(prompt.prompt)}
                    className="rounded-[999px] border border-border-default bg-surface px-3 py-1.5 text-left text-caption font-semibold text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary disabled:opacity-50"
                  >
                    {promptChipLabel(prompt)}
                  </button>
                ))}
              </div>
            ) : null}
          </BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  );
}
