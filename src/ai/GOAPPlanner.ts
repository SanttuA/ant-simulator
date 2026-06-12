import type { ActionContext, GOAPAction, GOAPState } from './GOAPTypes';
import { PriorityQueue } from '../utils/PriorityQueue';

interface SearchNode {
  state: GOAPState;
  plan: GOAPAction[];
  cost: number;
}

export class GOAPPlanner {
  plan(
    currentState: GOAPState,
    goalState: Partial<GOAPState>,
    actions: GOAPAction[],
    ctx: ActionContext,
  ): GOAPAction[] | null {
    if (satisfies(currentState, goalState)) {
      return [];
    }

    const frontier = new PriorityQueue<SearchNode>();
    const bestCosts = new Map<string, number>();
    const startKey = stateKey(currentState);

    frontier.enqueue({ state: currentState, plan: [], cost: 0 }, 0);
    bestCosts.set(startKey, 0);

    while (frontier.size > 0) {
      const node = frontier.dequeue();
      if (!node) {
        break;
      }

      if (satisfies(node.state, goalState)) {
        return node.plan;
      }

      for (const action of actions) {
        if (!action.isValid(ctx) || !satisfies(node.state, action.preconditions)) {
          continue;
        }

        const nextState = applyEffects(node.state, action.effects);
        const nextCost = node.cost + Math.max(0.01, action.getCost(ctx));
        const nextKey = stateKey(nextState);

        if (
          bestCosts.has(nextKey) &&
          nextCost >= (bestCosts.get(nextKey) ?? Number.POSITIVE_INFINITY)
        ) {
          continue;
        }

        bestCosts.set(nextKey, nextCost);
        frontier.enqueue(
          {
            state: nextState,
            plan: [...node.plan, action],
            cost: nextCost,
          },
          nextCost + unsatisfiedCount(nextState, goalState),
        );
      }
    }

    return null;
  }
}

export function satisfies(state: GOAPState, condition: Partial<GOAPState>): boolean {
  return Object.entries(condition).every(([key, value]) => state[key as keyof GOAPState] === value);
}

export function applyEffects(state: GOAPState, effects: Partial<GOAPState>): GOAPState {
  return { ...state, ...effects };
}

function unsatisfiedCount(state: GOAPState, goal: Partial<GOAPState>): number {
  return Object.entries(goal).filter(([key, value]) => state[key as keyof GOAPState] !== value)
    .length;
}

function stateKey(state: GOAPState): string {
  return [
    state.hasFood,
    state.hasDirt,
    state.atHive,
    state.atFood,
    state.atDigSite,
    state.atBuildSite,
    state.foodKnown,
    state.hiveNeedsExpansion,
    state.storageLow,
    state.energyLow,
  ]
    .map((value) => (value ? '1' : '0'))
    .join('');
}
