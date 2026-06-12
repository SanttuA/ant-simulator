import { describe, expect, it } from 'vitest';
import { GOAPPlanner, satisfies } from '../../src/ai/GOAPPlanner';
import type { ActionContext, GOAPAction, GOAPState } from '../../src/ai/GOAPTypes';
import { Simulation } from '../../src/game/Simulation';

const baseState: GOAPState = {
  hasFood: false,
  hasDirt: false,
  atHive: false,
  atFood: false,
  atDigSite: false,
  atBuildSite: false,
  foodKnown: false,
  hiveNeedsExpansion: false,
  storageLow: true,
  energyLow: false,
};

describe('GOAPPlanner', () => {
  it('checks partial state satisfaction', () => {
    expect(satisfies(baseState, { storageLow: true, hasFood: false })).toBe(true);
    expect(satisfies(baseState, { storageLow: false })).toBe(false);
  });

  it('returns the lowest-cost valid plan', () => {
    const simulation = new Simulation(() => 0.5);
    const ctx: ActionContext = {
      ant: simulation.ants[0],
      world: simulation.world,
      colony: simulation.colony,
      simulation,
    };
    const actions: GOAPAction[] = [
      action('ExpensiveDirect', 20, {}, { storageLow: false }),
      action('FindFood', 1, {}, { foodKnown: true }),
      action('GatherFood', 1, { foodKnown: true }, { hasFood: true }),
      action('DepositFood', 1, { hasFood: true }, { hasFood: false, storageLow: false }),
    ];

    const plan = new GOAPPlanner().plan(
      baseState,
      { storageLow: false, hasFood: false },
      actions,
      ctx,
    );

    expect(plan?.map((step) => step.name)).toEqual(['FindFood', 'GatherFood', 'DepositFood']);
  });
});

function action(
  name: string,
  cost: number,
  preconditions: Partial<GOAPState>,
  effects: Partial<GOAPState>,
): GOAPAction {
  return {
    name,
    cost,
    preconditions,
    effects,
    isValid: () => true,
    getCost: () => cost,
    execute: () => 'success',
  };
}
