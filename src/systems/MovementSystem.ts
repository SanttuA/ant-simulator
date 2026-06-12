import { findPath } from '../utils/Pathfinding';
import { samePoint, type Point } from '../utils/Grid';
import type { World } from '../game/World';
import type { Ant } from '../entities/Ant';

export type MovementStatus = 'running' | 'arrived' | 'blocked';

export function createPath(world: World, start: Point, goal: Point): Point[] | null {
  return findPath(start, goal, {
    width: world.width,
    height: world.height,
    isPassable: (point) => world.isPassable(point),
  });
}

export function moveAntAlongPath(
  ant: Ant,
  world: World,
  path: Point[],
  dt: number,
): MovementStatus {
  if (path.length <= 1) {
    return 'arrived';
  }

  const speedFactor = ant.energy <= 3 ? 0.45 : 1;
  ant.stepProgress += dt * ant.moveSpeed * speedFactor;

  while (ant.stepProgress >= 1 && path.length > 1) {
    ant.stepProgress -= 1;
    const next = path[1];

    if (!world.isPassable(next)) {
      return 'blocked';
    }

    ant.x = next.x;
    ant.y = next.y;
    ant.energy = Math.max(0, ant.energy - 0.12);
    path.shift();

    if (samePoint(ant.position, path[0])) {
      continue;
    }
  }

  return path.length <= 1 ? 'arrived' : 'running';
}
