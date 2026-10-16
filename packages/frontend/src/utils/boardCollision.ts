import { closestCorners, pointerWithin, type CollisionDetection } from '@dnd-kit/core';

/**
 * Where a dragged card is going on the board. The lane under the pointer
 * wins: a card in it if the pointer is over one, else the lane itself (an
 * empty or short lane). closestCorners alone measured to the nearest card
 * corner anywhere, which was usually still a card in the lane the drag
 * started from - so cards reordered but never changed lanes (status).
 * Outside every lane, fall back to the closest corners.
 */
export const boardCollision: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  if (within.length) {
    const cards = within.filter((c) => !String(c.id).startsWith('column-'));
    return cards.length ? cards : within;
  }
  return closestCorners(args);
};
