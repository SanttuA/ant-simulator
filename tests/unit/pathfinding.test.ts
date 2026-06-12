import { describe, expect, it } from 'vitest';
import { findPath } from '../../src/utils/Pathfinding';
import { pointKey, type Point } from '../../src/utils/Grid';

describe('findPath', () => {
  it('routes around blocked tiles', () => {
    const blocked = new Set(['1,0', '1,1', '1,2']);
    const path = findPath(
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      {
        width: 5,
        height: 5,
        isPassable: (point: Point) => !blocked.has(pointKey(point)),
      },
    );

    expect(path).not.toBeNull();
    expect(path?.at(0)).toEqual({ x: 0, y: 0 });
    expect(path?.at(-1)).toEqual({ x: 3, y: 0 });
    expect(path?.some((point) => blocked.has(pointKey(point)))).toBe(false);
    expect(path?.length).toBeGreaterThan(4);
  });
});
