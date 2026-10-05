import { describe, expect, test } from 'vitest';
import { normalizeIndex, resolveDirection, resolveSwipe, slideKeyframes } from '../carousel';

describe('normalizeIndex', () => {
  test('wraps past either end', () => {
    expect(normalizeIndex(4, 4)).toBe(0);
    expect(normalizeIndex(-1, 4)).toBe(3);
    expect(normalizeIndex(-5, 4)).toBe(3);
    expect(normalizeIndex(2, 4)).toBe(2);
  });
});

describe('resolveDirection', () => {
  test('steps forward for the short path and at the half-way tie', () => {
    expect(resolveDirection(0, 1, 4)).toBe(1);
    expect(resolveDirection(3, 0, 4)).toBe(1);
    expect(resolveDirection(2, 0, 4)).toBe(1);
  });

  test('steps backward when the wrap-around is closer than going forward', () => {
    expect(resolveDirection(0, 3, 4)).toBe(-1);
    expect(resolveDirection(1, 0, 4)).toBe(-1);
  });
});

describe('slideKeyframes', () => {
  test('moves the incoming and outgoing slides in opposite directions', () => {
    expect(slideKeyframes(1, 'in')).toEqual(['translateX(100%)', 'translateX(0%)']);
    expect(slideKeyframes(1, 'out')).toEqual(['translateX(0%)', 'translateX(-100%)']);
    expect(slideKeyframes(-1, 'in')).toEqual(['translateX(-100%)', 'translateX(0%)']);
    expect(slideKeyframes(-1, 'out')).toEqual(['translateX(0%)', 'translateX(100%)']);
  });

  test('never parks a slide on identical keyframes', () => {
    // A degenerate pair (both ends equal) leaves the slide where it already was,
    // which is how the outgoing slide once jumped off-screen instead of sliding.
    for (const direction of [1, -1] as const) {
      for (const kind of ['in', 'out'] as const) {
        const [from, to] = slideKeyframes(direction, kind);
        expect(from).not.toBe(to);
      }
    }
  });
});

describe('resolveSwipe', () => {
  test('a leftward swipe advances and a rightward swipe goes back', () => {
    expect(resolveSwipe({ x: 200, y: 300 }, { x: 100, y: 300 })).toBe(1);
    expect(resolveSwipe({ x: 100, y: 300 }, { x: 200, y: 300 })).toBe(-1);
  });

  test('ignores movements below the distance threshold', () => {
    expect(resolveSwipe({ x: 200, y: 300 }, { x: 160, y: 300 })).toBeNull();
  });

  test('ignores gestures whose vertical component rivals the horizontal one', () => {
    // 60px horizontal against 50px vertical: a diagonal scroll, not a swipe.
    expect(resolveSwipe({ x: 200, y: 300 }, { x: 140, y: 250 })).toBeNull();
    // 60px horizontal against 30px vertical: clearly horizontal.
    expect(resolveSwipe({ x: 200, y: 300 }, { x: 140, y: 270 })).toBe(1);
  });

  test('honours a custom threshold', () => {
    expect(resolveSwipe({ x: 200, y: 300 }, { x: 170, y: 300 }, 24)).toBe(1);
    expect(resolveSwipe({ x: 200, y: 300 }, { x: 170, y: 300 }, 48)).toBeNull();
  });
});
