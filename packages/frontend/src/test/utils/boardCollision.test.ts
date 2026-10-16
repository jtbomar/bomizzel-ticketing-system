import { describe, it, expect } from 'vitest';
import { closestCorners } from '@dnd-kit/core';
import { boardCollision } from '../../utils/boardCollision';

// Two lanes side by side: "open" with two cards, "waiting" empty.
const rect = (left: number, top: number, width: number, height: number) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});
const rects = new Map<any, any>([
  ['column-open', rect(0, 0, 300, 800)],
  ['column-waiting', rect(320, 0, 300, 800)],
  ['1', rect(16, 60, 268, 100)],
  ['2', rect(16, 180, 268, 100)],
]);
const containers = [...rects.keys()].map((id) => ({
  id,
  rect: { current: rects.get(id) },
  data: { current: {} },
  disabled: false,
  node: { current: null },
}));

// Card 1 dragged right, the pointer now in the empty "waiting" lane
const args = (pointer: { x: number; y: number }) =>
  ({
    active: { id: '1' },
    collisionRect: rect(pointer.x - 134, pointer.y - 50, 268, 100),
    droppableRects: rects,
    droppableContainers: containers,
    pointerCoordinates: pointer,
  }) as any;

describe('board drop target', () => {
  it('closest corners alone keeps a card in its own lane (the bug)', () => {
    const [first] = closestCorners(args({ x: 400, y: 110 }));
    expect(first.id).not.toBe('column-waiting');
  });

  it('goes to the lane under the pointer, even an empty one', () => {
    expect(boardCollision(args({ x: 400, y: 110 }))[0].id).toBe('column-waiting');
  });

  it('a card under the pointer is the target within its lane', () => {
    expect(boardCollision(args({ x: 100, y: 200 }))[0].id).toBe('2');
  });
});
