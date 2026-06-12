import type { Colony } from '../entities/Colony';
import type { World } from '../game/World';
import type { Point } from '../utils/Grid';

export function digExpansionTile(
  world: World,
  colony: Colony,
  antId: string,
  target: Point,
): boolean {
  const tile = world.getTile(target);
  if (!tile || tile.type !== 'dirt') {
    colony.releaseExpansionTarget(world, antId, target);
    return false;
  }

  world.setTileType(target, 'hive');
  tile.reservedByAntId = undefined;
  colony.releaseExpansionTarget(world, antId, target);
  return true;
}
