import { digExpansionTile } from '../systems/HiveSystem';
import { createPath, moveAntAlongPath } from '../systems/MovementSystem';
import { manhattan, samePoint, type Point } from '../utils/Grid';
import type { ActionContext, ActionStatus, GOAPAction } from './GOAPTypes';

export function createActions(): GOAPAction[] {
  return [
    exploreAction(),
    moveToFoodAction(),
    pickUpFoodAction(),
    moveToHiveAction(),
    depositFoodAction(),
    moveToDigSiteAction(),
    digTileAction(),
    moveToDumpSiteAction(),
    dropDirtAction(),
    restAction(),
  ];
}

function exploreAction(): GOAPAction {
  return {
    name: 'Explore',
    cost: 4,
    preconditions: { hasFood: false, hasDirt: false },
    effects: { foodKnown: true },
    isValid: () => true,
    getCost: (ctx) => {
      const nearbyFoodPheromone = ctx.world.getNeighbors(ctx.ant.position).reduce((sum, tile) => {
        return sum + tile.pheromoneFood;
      }, 0);
      return Math.max(1.5, 5 - nearbyFoodPheromone);
    },
    execute: (ctx, dt) => {
      const runtime = ctx.ant.beginAction('Explore');
      const found = ctx.world.scanFood(ctx.ant.position, 24);
      if (found.length > 0) {
        ctx.ant.rememberFood(found, ctx.world);
        return 'success';
      }

      if (!runtime.target || !runtime.path || runtime.path.length <= 1) {
        runtime.target = ctx.simulation.randomPassablePointNear(ctx.ant.position, 14, 38);
        runtime.path = createPath(ctx.world, ctx.ant.position, runtime.target) ?? undefined;
        runtime.attempts = (runtime.attempts ?? 0) + 1;
      }

      if (!runtime.path) {
        return 'failure';
      }

      const status = moveAntAlongPath(ctx.ant, ctx.world, runtime.path, dt);
      if (status === 'blocked') {
        runtime.path = undefined;
        return runtime.attempts && runtime.attempts > 3 ? 'failure' : 'running';
      }

      const scanned = ctx.world.scanFood(ctx.ant.position, 24);
      if (scanned.length > 0) {
        ctx.ant.rememberFood(scanned, ctx.world);
        return 'success';
      }

      if (status === 'arrived') {
        runtime.target = undefined;
        runtime.path = undefined;
        return runtime.attempts && runtime.attempts >= 4 ? 'failure' : 'running';
      }

      return 'running';
    },
  };
}

function moveToFoodAction(): GOAPAction {
  return {
    name: 'MoveToFood',
    cost: 3,
    preconditions: { foodKnown: true, hasFood: false },
    effects: { atFood: true },
    isValid: (ctx) => ctx.ant.getKnownFood(ctx.world).length > 0 && ctx.ant.carrying !== 'dirt',
    getCost: (ctx) => {
      const target = nearestKnownFood(ctx);
      return target ? Math.max(1, manhattan(ctx.ant.position, target) / 12) : 50;
    },
    execute: (ctx, dt) => {
      const runtime = ctx.ant.beginAction('MoveToFood');
      const currentTarget = runtime.target;
      const targetStillValid = currentTarget && isFoodAvailable(ctx, currentTarget);

      if (!targetStillValid) {
        runtime.target = nearestKnownFood(ctx) ?? undefined;
        runtime.path = undefined;
      }

      if (!runtime.target) {
        return 'failure';
      }

      if (samePoint(ctx.ant.position, runtime.target)) {
        return isFoodAvailable(ctx, runtime.target) ? 'success' : 'failure';
      }

      if (!runtime.path) {
        runtime.path = createPath(ctx.world, ctx.ant.position, runtime.target) ?? undefined;
      }

      if (!runtime.path) {
        ctx.ant.forgetFood(runtime.target);
        return 'failure';
      }

      const status = moveAntAlongPath(ctx.ant, ctx.world, runtime.path, dt);
      if (status === 'blocked') {
        runtime.path = undefined;
        return 'failure';
      }

      return status === 'arrived' ? 'success' : 'running';
    },
  };
}

function pickUpFoodAction(): GOAPAction {
  return {
    name: 'PickUpFood',
    cost: 1,
    preconditions: { atFood: true, hasFood: false },
    effects: { hasFood: true },
    isValid: (ctx) => ctx.world.getFoodTiles().length > 0,
    getCost: () => 1,
    execute: (ctx) => {
      const tile = ctx.world.getTile(ctx.ant.position);
      if (!tile || tile.type !== 'food' || tile.foodAmount <= 0) {
        ctx.ant.forgetFood(ctx.ant.position);
        return 'failure';
      }

      tile.foodAmount -= 1;
      ctx.ant.carrying = 'food';
      ctx.ant.forgetFood(ctx.ant.position);

      if (tile.foodAmount <= 0) {
        tile.type = 'empty';
      }

      return 'success';
    },
  };
}

function moveToHiveAction(): GOAPAction {
  return {
    name: 'MoveToHive',
    cost: 3,
    preconditions: { hasFood: true },
    effects: { atHive: true },
    isValid: (ctx) => ctx.world.nearestHiveTile(ctx.ant.position) !== null,
    getCost: (ctx) => {
      const target = ctx.world.nearestHiveTile(ctx.ant.position);
      return target ? Math.max(1, manhattan(ctx.ant.position, target) / 10) : 50;
    },
    execute: (ctx, dt) => moveToNearestHive(ctx, dt, 'MoveToHive'),
  };
}

function depositFoodAction(): GOAPAction {
  return {
    name: 'DepositFood',
    cost: 1,
    preconditions: { hasFood: true, atHive: true },
    effects: { hasFood: false, storageLow: false },
    isValid: (ctx) => ctx.world.nearestHiveTile(ctx.ant.position) !== null,
    getCost: () => 1,
    execute: (ctx) => {
      const tile = ctx.world.getTile(ctx.ant.position);
      if (tile?.type !== 'hive' || ctx.ant.carrying !== 'food') {
        return 'failure';
      }

      ctx.colony.storedFood += 1;
      ctx.ant.carrying = null;
      ctx.ant.energy = Math.min(100, ctx.ant.energy + 2);
      return 'success';
    },
  };
}

function moveToDigSiteAction(): GOAPAction {
  return {
    name: 'MoveToDigSite',
    cost: 5,
    preconditions: { hiveNeedsExpansion: true, hasFood: false, hasDirt: false },
    effects: { atDigSite: true },
    isValid: (ctx) => ctx.colony.needsExpansion(ctx.world, ctx.simulation.ants.length),
    getCost: (ctx) => {
      const target =
        ctx.ant.memory.targetTile ??
        ctx.world
          .findExpansionCandidates()
          .filter((tile) => !tile.reservedByAntId)
          .sort((a, b) => manhattan(a, ctx.ant.position) - manhattan(b, ctx.ant.position))[0];
      if (!target) {
        return 80;
      }
      return Math.max(2, manhattan(ctx.ant.position, target) / 8);
    },
    execute: (ctx, dt) => {
      const runtime = ctx.ant.beginAction('MoveToDigSite');
      const target =
        ctx.ant.memory.targetTile ??
        ctx.colony.reserveExpansionTarget(ctx.world, ctx.ant.id, ctx.ant.position);

      if (!target) {
        return 'failure';
      }

      ctx.ant.memory.targetTile = target;
      const targetTile = ctx.world.getTile(target);
      if (!targetTile || targetTile.type !== 'dirt') {
        ctx.colony.releaseExpansionTarget(ctx.world, ctx.ant.id, target);
        ctx.ant.memory.targetTile = undefined;
        return 'failure';
      }

      if (manhattan(ctx.ant.position, target) <= 1) {
        return 'success';
      }

      if (!runtime.target || !samePoint(runtime.target, target) || !runtime.path) {
        const workTile = ctx.world.getAdjacentPassableTile(target, ctx.ant.position);
        if (!workTile) {
          return 'failure';
        }

        runtime.target = target;
        runtime.path = createPath(ctx.world, ctx.ant.position, workTile) ?? undefined;
      }

      if (!runtime.path) {
        return 'failure';
      }

      const status = moveAntAlongPath(ctx.ant, ctx.world, runtime.path, dt);
      if (status === 'blocked') {
        runtime.path = undefined;
        return 'failure';
      }

      return manhattan(ctx.ant.position, target) <= 1 ? 'success' : 'running';
    },
  };
}

function digTileAction(): GOAPAction {
  return {
    name: 'DigTile',
    cost: 2,
    preconditions: { atDigSite: true, hasFood: false },
    effects: { hasDirt: true, hiveNeedsExpansion: false },
    isValid: (ctx) =>
      Boolean(ctx.ant.memory.targetTile) ||
      ctx.world.findExpansionCandidates().some((tile) => !tile.reservedByAntId),
    getCost: () => 2,
    execute: (ctx, dt) => {
      const runtime = ctx.ant.beginAction('DigTile');
      const target = ctx.ant.memory.targetTile;

      if (!target || manhattan(ctx.ant.position, target) > 1) {
        return 'failure';
      }

      runtime.elapsed = (runtime.elapsed ?? 0) + dt;
      if (runtime.elapsed < 0.65) {
        return 'running';
      }

      const dug = digExpansionTile(ctx.world, ctx.colony, ctx.ant.id, target);
      if (!dug) {
        ctx.ant.memory.targetTile = undefined;
        return 'failure';
      }

      ctx.ant.carrying = 'dirt';
      ctx.ant.memory.targetTile = undefined;
      return 'success';
    },
  };
}

function moveToDumpSiteAction(): GOAPAction {
  return {
    name: 'MoveToDumpSite',
    cost: 2,
    preconditions: { hasDirt: true },
    effects: { atHive: true },
    isValid: (ctx) => ctx.world.nearestHiveTile(ctx.ant.position) !== null,
    getCost: (ctx) => {
      const target = ctx.world.nearestHiveTile(ctx.ant.position);
      return target ? Math.max(1, manhattan(ctx.ant.position, target) / 10) : 50;
    },
    execute: (ctx, dt) => moveToNearestHive(ctx, dt, 'MoveToDumpSite'),
  };
}

function dropDirtAction(): GOAPAction {
  return {
    name: 'DropDirt',
    cost: 1,
    preconditions: { hasDirt: true, atHive: true },
    effects: { hasDirt: false },
    isValid: (ctx) => ctx.world.nearestHiveTile(ctx.ant.position) !== null,
    getCost: () => 1,
    execute: (ctx) => {
      const tile = ctx.world.getTile(ctx.ant.position);
      if (tile?.type !== 'hive' || ctx.ant.carrying !== 'dirt') {
        return 'failure';
      }

      ctx.ant.carrying = null;
      ctx.ant.energy = Math.min(100, ctx.ant.energy + 1);
      return 'success';
    },
  };
}

function restAction(): GOAPAction {
  return {
    name: 'Rest',
    cost: 1,
    preconditions: { energyLow: true },
    effects: { energyLow: false },
    isValid: () => true,
    getCost: () => 1,
    execute: (ctx, dt) => {
      const tile = ctx.world.getTile(ctx.ant.position);
      if (tile?.type !== 'hive') {
        const status = moveToNearestHive(ctx, dt, 'Rest');
        return status === 'success' ? 'running' : status;
      }

      ctx.ant.energy = Math.min(100, ctx.ant.energy + 48 * dt);
      return ctx.ant.energy >= 88 ? 'success' : 'running';
    },
  };
}

function moveToNearestHive(ctx: ActionContext, dt: number, actionName: string): ActionStatus {
  const tile = ctx.world.getTile(ctx.ant.position);
  if (tile?.type === 'hive') {
    return 'success';
  }

  const runtime = ctx.ant.beginAction(actionName);
  const target = ctx.world.nearestHiveTile(ctx.ant.position);
  if (!target) {
    return 'failure';
  }

  if (!runtime.target || !samePoint(runtime.target, target) || !runtime.path) {
    runtime.target = target;
    runtime.path = createPath(ctx.world, ctx.ant.position, target) ?? undefined;
  }

  if (!runtime.path) {
    return 'failure';
  }

  const status = moveAntAlongPath(ctx.ant, ctx.world, runtime.path, dt);
  if (status === 'blocked') {
    runtime.path = undefined;
    return 'failure';
  }

  return status === 'arrived' ? 'success' : 'running';
}

function nearestKnownFood(ctx: ActionContext): Point | null {
  const known = ctx.ant.getKnownFood(ctx.world);
  known.sort((a, b) => manhattan(ctx.ant.position, a) - manhattan(ctx.ant.position, b));
  return known[0] ?? null;
}

function isFoodAvailable(ctx: ActionContext, point: Point): boolean {
  const tile = ctx.world.getTile(point);
  return Boolean(tile && tile.type === 'food' && tile.foodAmount > 0);
}
