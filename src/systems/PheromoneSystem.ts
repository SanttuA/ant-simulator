import type { World } from '../game/World';
import type { Ant } from '../entities/Ant';

export function updatePheromones(world: World, ants: Ant[], decayRate = 0.995): void {
  world.decayPheromones(decayRate);

  for (const ant of ants) {
    if (ant.carrying === 'food') {
      world.addFoodPheromone(ant.position, 0.08);
    }

    const tile = world.getTile(ant.position);
    if (tile?.type === 'hive') {
      world.addHomePheromone(ant.position, 0.04);
    }
  }
}
