import type { Simulation } from '../game/Simulation';
import type { World } from '../game/World';
import type { Ant } from '../entities/Ant';
import type { Colony } from '../entities/Colony';

export interface GOAPState {
  hasFood: boolean;
  hasDirt: boolean;
  atHive: boolean;
  atFood: boolean;
  atDigSite: boolean;
  atBuildSite: boolean;
  foodKnown: boolean;
  hiveNeedsExpansion: boolean;
  storageLow: boolean;
  energyLow: boolean;
}

export type ActionStatus = 'running' | 'success' | 'failure';

export interface ActionContext {
  ant: Ant;
  world: World;
  colony: Colony;
  simulation: Simulation;
}

export interface GOAPAction {
  name: string;
  cost: number;
  preconditions: Partial<GOAPState>;
  effects: Partial<GOAPState>;
  isValid(ctx: ActionContext): boolean;
  getCost(ctx: ActionContext): number;
  execute(ctx: ActionContext, dt: number): ActionStatus;
}

export interface Goal {
  name: string;
  desiredState: Partial<GOAPState>;
  getPriority(ctx: ActionContext, state: GOAPState): number;
}
