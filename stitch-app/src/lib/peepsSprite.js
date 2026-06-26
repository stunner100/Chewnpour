export const PEEPS_SPRITE_SRC = '/images/peeps/all-peeps.png';
export const PEEPS_SPRITE_ROWS = 15;
export const PEEPS_SPRITE_COLS = 7;

/** Friendly glasses + smile peep from the Open Peeps / Notion-style sheet. */
export const TUTOR_PEEPS_INDEX = 52;

/** Cropped peep used wherever the tutor avatar is shown. */
export const TUTOR_AVATAR_IMAGE_SRC = '/images/peeps/tutor.png';
export const TUTOR_AVATAR_ALT = 'ChewnPour AI Tutor';

export function getPeepSpriteStyle(
  index = TUTOR_PEEPS_INDEX,
  rows = PEEPS_SPRITE_ROWS,
  cols = PEEPS_SPRITE_COLS,
) {
  const col = index % rows;
  const row = Math.floor(index / rows);

  return {
    backgroundImage: `url(${PEEPS_SPRITE_SRC})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${rows * 100}% ${cols * 100}%`,
    backgroundPosition: `${(col / Math.max(rows - 1, 1)) * 100}% ${(row / Math.max(cols - 1, 1)) * 100}%`,
  };
}
