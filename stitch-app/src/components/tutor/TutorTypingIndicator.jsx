import { Marker, MarkerContent } from '@/components/ui/marker';
import {
  Message,
  MessageAvatar,
  MessageContent,
} from '@/components/ui/message';
import { TutorAvatar } from '@/components/tutor/TutorAvatar';
import { VoiceAssistantWidget } from '@/components/opensource-ui/VoiceAssistantWidget';

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
            <MarkerContent className="flex items-center gap-2 shimmer font-body-sm text-body-sm">
              <VoiceAssistantWidget
                layout="inline"
                active
                showButton={false}
                label=""
                idleLabel=""
                className="h-6 w-[4.5rem] border-0 bg-transparent p-0 shadow-none"
              />
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
