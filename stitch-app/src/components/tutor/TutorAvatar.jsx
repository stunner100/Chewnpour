import { BotIcon } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getPeepSpriteStyle, PEEPS_SPRITE_SRC, TUTOR_PEEPS_INDEX } from '@/lib/peepsSprite';
import { cn } from '@/lib/utils';

export const TUTOR_AVATAR_SRC = PEEPS_SPRITE_SRC;
export const TUTOR_AVATAR_ALT = 'ChewnPour AI Tutor';

export function TutorAvatar({ className, iconClassName = 'size-4', peepIndex = TUTOR_PEEPS_INDEX }) {
  return (
    <Avatar className={className}>
      <span
        aria-hidden="true"
        className="size-full rounded-full bg-black"
        style={getPeepSpriteStyle(peepIndex)}
      />
      <AvatarFallback className="border border-primary-fixed-dim bg-primary-soft text-primary">
        <BotIcon className={iconClassName} aria-hidden="true" />
      </AvatarFallback>
    </Avatar>
  );
}

export function TutorAvatarMark({ className, peepIndex = TUTOR_PEEPS_INDEX }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block shrink-0 rounded-full bg-black', className)}
      style={getPeepSpriteStyle(peepIndex)}
    />
  );
}
