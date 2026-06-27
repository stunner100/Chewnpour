import { Marker, MarkerContent } from '@/components/ui/marker';
import {
  Message,
  MessageAvatar,
  MessageContent,
} from '@/components/ui/message';
import { TutorAvatar } from '@/components/tutor/TutorAvatar';

export function TutorTypingIndicator({
  compact = false,
  className,
}) {
  const avatarClass = compact ? 'size-7' : 'size-9';

  return (
    <Message align="start" className={className}>
        <MessageAvatar className={compact ? 'min-w-7' : 'min-w-9'}>
          <TutorAvatar className={avatarClass} />
        </MessageAvatar>
        <MessageContent>
          <Marker role="status" aria-live="polite">
            <MarkerContent className="shimmer font-body-sm text-body-sm">
              {compact ? (
                'Tutor is typing...'
              ) : (
                <>
                  <span className="font-medium">Tutor</span> is typing...
                </>
              )}
            </MarkerContent>
          </Marker>
      </MessageContent>
    </Message>
  );
}
