import { describe, expect, it } from 'vitest';
import { createActions } from '../../src/ai/Actions';
import type { ActionContext } from '../../src/ai/GOAPTypes';
import { Simulation } from '../../src/game/Simulation';

describe('food actions', () => {
  it('picks up food and deposits it into colony storage', () => {
    const simulation = new Simulation(() => 0.5);
    const ant = simulation.ants[0];
    const ctx: ActionContext = {
      ant,
      world: simulation.world,
      colony: simulation.colony,
      simulation,
    };
    const actions = createActions();
    const pickUpFood = actions.find((action) => action.name === 'PickUpFood');
    const depositFood = actions.find((action) => action.name === 'DepositFood');

    const tile = simulation.world.getTile(ant.position);
    expect(tile).toBeDefined();
    simulation.world.setTileType(ant.position, 'food');
    tile!.foodAmount = 2;

    expect(pickUpFood?.execute(ctx, 1)).toBe('success');
    expect(ant.carrying).toBe('food');
    expect(tile!.foodAmount).toBe(1);

    simulation.world.setTileType(ant.position, 'hive');
    expect(depositFood?.execute(ctx, 1)).toBe('success');
    expect(ant.carrying).toBeNull();
    expect(simulation.colony.storedFood).toBe(1);
  });
});
