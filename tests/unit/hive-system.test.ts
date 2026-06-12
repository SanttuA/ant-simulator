import { describe, expect, it } from 'vitest';
import { Colony } from '../../src/entities/Colony';
import { World } from '../../src/game/World';
import { digExpansionTile } from '../../src/systems/HiveSystem';
import { pointKey } from '../../src/utils/Grid';

describe('hive expansion reservations', () => {
  it('reserves different dig targets for different ants and converts a target to hive', () => {
    const world = World.createDefault(() => 0.5);
    const colony = new Colony();
    colony.storedFood = 12;

    const first = colony.reserveExpansionTarget(world, 'ant-1', world.center);
    const second = colony.reserveExpansionTarget(world, 'ant-2', world.center);

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(pointKey(first!)).not.toBe(pointKey(second!));

    expect(digExpansionTile(world, colony, 'ant-1', first!)).toBe(true);
    expect(world.getTile(first!)?.type).toBe('hive');
    expect(world.getTile(first!)?.reservedByAntId).toBeUndefined();
  });
});
