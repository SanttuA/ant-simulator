import { manhattan, neighbors4, pointKey, samePoint, type Point } from './Grid';
import { PriorityQueue } from './PriorityQueue';

export interface PathfindingGrid {
  width: number;
  height: number;
  isPassable(point: Point): boolean;
}

export function findPath(start: Point, goal: Point, grid: PathfindingGrid): Point[] | null {
  if (!isInBounds(start, grid) || !isInBounds(goal, grid)) {
    return null;
  }

  if (!grid.isPassable(start) || !grid.isPassable(goal)) {
    return null;
  }

  if (samePoint(start, goal)) {
    return [start];
  }

  const frontier = new PriorityQueue<Point>();
  const cameFrom = new Map<string, string | null>();
  const costSoFar = new Map<string, number>();
  const startKey = pointKey(start);

  frontier.enqueue(start, 0);
  cameFrom.set(startKey, null);
  costSoFar.set(startKey, 0);

  while (frontier.size > 0) {
    const current = frontier.dequeue();
    if (!current) {
      break;
    }

    if (samePoint(current, goal)) {
      return reconstructPath(cameFrom, start, goal);
    }

    for (const next of neighbors4(current)) {
      if (!isInBounds(next, grid) || !grid.isPassable(next)) {
        continue;
      }

      const nextKey = pointKey(next);
      const currentCost = costSoFar.get(pointKey(current)) ?? 0;
      const newCost = currentCost + 1;

      if (
        !costSoFar.has(nextKey) ||
        newCost < (costSoFar.get(nextKey) ?? Number.POSITIVE_INFINITY)
      ) {
        costSoFar.set(nextKey, newCost);
        cameFrom.set(nextKey, pointKey(current));
        frontier.enqueue(next, newCost + manhattan(next, goal));
      }
    }
  }

  return null;
}

function isInBounds(point: Point, grid: PathfindingGrid): boolean {
  return point.x >= 0 && point.y >= 0 && point.x < grid.width && point.y < grid.height;
}

function reconstructPath(cameFrom: Map<string, string | null>, start: Point, goal: Point): Point[] {
  const path: Point[] = [goal];
  let currentKey: string | null | undefined = pointKey(goal);

  while (currentKey && currentKey !== pointKey(start)) {
    currentKey = cameFrom.get(currentKey);
    if (currentKey) {
      const [x = '0', y = '0'] = currentKey.split(',');
      path.push({ x: Number(x), y: Number(y) });
    }
  }

  path.reverse();
  return path;
}
