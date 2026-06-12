import { createActions } from '../ai/Actions';
import { createGoals } from '../ai/Goals';
import { GOAPPlanner } from '../ai/GOAPPlanner';
import type { ActionContext, GOAPAction, GOAPState, Goal } from '../ai/GOAPTypes';
import type { World } from '../game/World';
import { pointKey, samePoint, type Point, uniquePoints } from '../utils/Grid';

export type Carrying = null | 'food' | 'dirt';

export interface AntMemory {
  knownFoodTiles: Point[];
  knownHiveTiles: Point[];
  targetTile?: Point;
}

export interface ActionRuntime {
  name: string;
  path?: Point[];
  target?: Point;
  elapsed?: number;
  attempts?: number;
}

export class Ant {
  carrying: Carrying = null;
  energy = 100;
  hunger = 0;
  currentGoal: Goal | null = null;
  currentPlan: GOAPAction[] = [];
  currentAction: GOAPAction | null = null;
  currentGoalPriority = 0;
  memory: AntMemory = {
    knownFoodTiles: [],
    knownHiveTiles: [],
  };
  actionRuntime: ActionRuntime | null = null;
  stepProgress = 0;
  readonly moveSpeed = 7.5;

  private readonly planner = new GOAPPlanner();
  private readonly actions = createActions();
  private readonly goals = createGoals();
  private replanTimer = 0;

  constructor(
    readonly id: string,
    public x: number,
    public y: number,
  ) {}

  get position(): Point {
    return { x: this.x, y: this.y };
  }

  update(ctx: ActionContext, dt: number): void {
    this.hunger = Math.min(100, this.hunger + dt * 0.45);
    this.rememberFood(ctx.world.scanFood(this.position, 22), ctx.world);
    this.rememberHive(ctx.world);

    this.replanTimer -= dt;
    const state = this.buildGOAPState(ctx);
    const shouldPlan = !this.currentAction && this.currentPlan.length === 0;
    const shouldInterrupt = this.replanTimer <= 0 && this.hasHigherPriorityPlan(ctx, state);

    if (shouldPlan || shouldInterrupt) {
      this.choosePlan(ctx, state);
    }

    if (!this.currentAction) {
      this.currentAction = this.currentPlan.shift() ?? null;
      this.actionRuntime = null;
    }

    if (!this.currentAction) {
      return;
    }

    const status = this.currentAction.execute(ctx, dt);
    if (status === 'success') {
      this.currentAction = null;
      this.actionRuntime = null;
      this.stepProgress = 0;
      return;
    }

    if (status === 'failure') {
      this.clearPlan(ctx);
    }
  }

  buildGOAPState(ctx: ActionContext): GOAPState {
    const tile = ctx.world.getTile(this.position);
    const targetTile = this.memory.targetTile
      ? ctx.world.getTile(this.memory.targetTile)
      : undefined;

    return {
      hasFood: this.carrying === 'food',
      hasDirt: this.carrying === 'dirt',
      atHive: tile?.type === 'hive',
      atFood: tile?.type === 'food' && tile.foodAmount > 0,
      atDigSite: Boolean(
        targetTile?.type === 'dirt' && this.distanceTo(this.memory.targetTile) <= 1,
      ),
      atBuildSite: false,
      foodKnown: this.getKnownFood(ctx.world).length > 0,
      hiveNeedsExpansion: ctx.colony.needsExpansion(ctx.world, ctx.simulation.ants.length),
      storageLow: ctx.colony.storageLow(),
      energyLow: this.energy < 24,
    };
  }

  beginAction(name: string): ActionRuntime {
    if (this.actionRuntime?.name !== name) {
      this.actionRuntime = { name };
      this.stepProgress = 0;
    }

    return this.actionRuntime;
  }

  rememberFood(points: Point[], world: World): void {
    if (points.length === 0) {
      return;
    }

    const valid = points.filter((point) => {
      const tile = world.getTile(point);
      return tile?.type === 'food' && tile.foodAmount > 0;
    });

    this.memory.knownFoodTiles = uniquePoints([...this.memory.knownFoodTiles, ...valid]).slice(-40);
  }

  rememberHive(world: World): void {
    const tile = world.getTile(this.position);
    if (tile?.type === 'hive') {
      this.memory.knownHiveTiles = uniquePoints([
        ...this.memory.knownHiveTiles,
        { x: tile.x, y: tile.y },
      ]).slice(-24);
    }
  }

  getKnownFood(world: World): Point[] {
    const valid = this.memory.knownFoodTiles.filter((point) => {
      const tile = world.getTile(point);
      return tile?.type === 'food' && tile.foodAmount > 0;
    });

    if (valid.length !== this.memory.knownFoodTiles.length) {
      this.memory.knownFoodTiles = valid;
    }

    return [...valid];
  }

  forgetFood(point: Point): void {
    const key = pointKey(point);
    this.memory.knownFoodTiles = this.memory.knownFoodTiles.filter(
      (known) => pointKey(known) !== key,
    );
  }

  distanceTo(point?: Point): number {
    if (!point) {
      return Number.POSITIVE_INFINITY;
    }

    return Math.abs(this.x - point.x) + Math.abs(this.y - point.y);
  }

  private choosePlan(ctx: ActionContext, state: GOAPState): void {
    let best: {
      goal: Goal;
      priority: number;
      plan: GOAPAction[];
    } | null = null;

    for (const goal of this.goals) {
      const priority = goal.getPriority(ctx, state);
      if (priority <= 0) {
        continue;
      }

      const plan = this.planner.plan(state, goal.desiredState, this.actions, ctx);
      if (!plan || plan.length === 0) {
        continue;
      }

      if (!best || priority > best.priority) {
        best = { goal, priority, plan };
      }
    }

    if (!best) {
      return;
    }

    if (this.memory.targetTile && best.goal.name !== this.currentGoal?.name) {
      ctx.colony.releaseExpansionTarget(ctx.world, this.id, this.memory.targetTile);
      this.memory.targetTile = undefined;
    }

    this.currentGoal = best.goal;
    this.currentGoalPriority = best.priority;
    this.currentPlan = [...best.plan];
    this.currentAction = null;
    this.actionRuntime = null;
    this.replanTimer = 1.4;
  }

  private hasHigherPriorityPlan(ctx: ActionContext, state: GOAPState): boolean {
    let bestPriority = 0;

    for (const goal of this.goals) {
      const priority = goal.getPriority(ctx, state);
      if (priority > bestPriority) {
        bestPriority = priority;
      }
    }

    return bestPriority > this.currentGoalPriority + 120;
  }

  private clearPlan(ctx: ActionContext): void {
    if (this.memory.targetTile) {
      ctx.colony.releaseExpansionTarget(ctx.world, this.id, this.memory.targetTile);
    }

    this.currentGoal = null;
    this.currentGoalPriority = 0;
    this.currentPlan = [];
    this.currentAction = null;
    this.actionRuntime = null;
    this.stepProgress = 0;

    this.memory.targetTile = undefined;
  }

  isAt(point: Point): boolean {
    return samePoint(this.position, point);
  }
}
