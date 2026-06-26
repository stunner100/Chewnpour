import { Shimmer } from '@/components/ai-elements/shimmer';
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
  typingAnchorRef,
}) {
  const avatarClass = compact ? 'size-7' : 'size-9';

  return (
    <div ref={typingAnchorRef}>
      <Message align="start" className={className}>
        <MessageAvatar className={compact ? 'min-w-7' : 'min-w-9'}>
          <TutorAvatar className={avatarClass} />
        </MessageAvatar>
        <MessageContent>
          <Marker role="status" aria-live="polite">
            <MarkerContent>
              <Shimmer
                as="span"
                className="font-body-sm text-body-sm text-text-secondary"
              >
                {compact ? (
                  'Tutor is typing...'
                ) : (
                  <>
                    <span className="font-medium">Tutor</span> is typing...
                  </>
                )}
              </Shimmer>
            </MarkerContent>
          </Marker>
        </MessageContent>
      </Message>
    </div>
  );
}
