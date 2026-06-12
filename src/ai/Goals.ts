import type { Goal } from './GOAPTypes';

export function createGoals(): Goal[] {
  return [
    {
      name: 'RestGoal',
      desiredState: { energyLow: false },
      getPriority: (_ctx, state) => (state.energyLow ? 1000 : 0),
    },
    {
      name: 'ExpandHiveGoal',
      desiredState: { hiveNeedsExpansion: false, hasDirt: false },
      getPriority: (ctx, state) => {
        if (!state.hiveNeedsExpansion || state.hasFood || ctx.colony.storedFood < 8) {
          return 0;
        }

        const crowding =
          ctx.simulation.ants.length / Math.max(1, ctx.colony.getHiveSize(ctx.world));
        return 72 + crowding * 30;
      },
    },
    {
      name: 'GatherFoodGoal',
      desiredState: { storageLow: false, hasFood: false },
      getPriority: (ctx, state) => {
        if (state.hasDirt) {
          return 0;
        }

        if (state.hasFood) {
          return 120;
        }

        const deficit = Math.max(0, ctx.colony.foodTarget - ctx.colony.storedFood);
        return state.storageLow ? 80 + deficit : state.foodKnown ? 18 : 0;
      },
    },
    {
      name: 'ExploreGoal',
      desiredState: { foodKnown: true },
      getPriority: (_ctx, state) => {
        if (state.hasFood || state.hasDirt) {
          return 0;
        }

        return state.foodKnown ? 8 : 58;
      },
    },
  ];
}
