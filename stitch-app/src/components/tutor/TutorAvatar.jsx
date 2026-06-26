import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TUTOR_AVATAR_ALT, TUTOR_AVATAR_IMAGE_SRC } from '@/lib/peepsSprite';
import { cn } from '@/lib/utils';

export { TUTOR_AVATAR_ALT, TUTOR_AVATAR_IMAGE_SRC as TUTOR_AVATAR_SRC };

export function TutorAvatar({ className }) {
  return (
    <Avatar className={className}>
      <AvatarImage src={TUTOR_AVATAR_IMAGE_SRC} alt={TUTOR_AVATAR_ALT} />
      <AvatarFallback className="bg-black text-xs text-white" delayMs={0}>
        AI
      </AvatarFallback>
    </Avatar>
  );
}

export function TutorAvatarMark({ className }) {
  return (
    <img
      src={TUTOR_AVATAR_IMAGE_SRC}
      alt={TUTOR_AVATAR_ALT}
      className={cn('inline-block shrink-0 rounded-full object-cover', className)}
    />
  );
}
