import { describe, expect, it } from 'vitest';
import { Simulation } from '../../src/game/Simulation';

describe('simulation behavior loop', () => {
  it('stores food and expands the hive over time', () => {
    const simulation = new Simulation(() => 0.5);
    const [gatherer, digger] = simulation.ants;
    if (!gatherer || !digger) {
      throw new Error('Expected simulation to start with ants');
    }

    simulation.colony.storedFood = 29;
    const initialStoredFood = simulation.colony.storedFood;
    const initialHiveSize = simulation.colony.getHiveSize(simulation.world);

    const foodPoint = { x: simulation.world.center.x + 3, y: simulation.world.center.y };
    const foodTile = simulation.world.getTile(foodPoint);
    if (!foodTile) {
      throw new Error('Expected test food tile to exist');
    }
    simulation.world.setTileType(foodPoint, 'food');
    foodTile.foodAmount = 1;
    gatherer.x = foodPoint.x;
    gatherer.y = foodPoint.y;

    const expansionTarget = simulation.world.findExpansionCandidates()[0];
    const digPosition = expansionTarget
      ? simulation.world.getAdjacentPassableTile(expansionTarget, simulation.world.center)
      : null;
    if (!expansionTarget || !digPosition) {
      throw new Error('Expected an expansion target with an adjacent work tile');
    }
    digger.x = digPosition.x;
    digger.y = digPosition.y;
    digger.memory.targetTile = { x: expansionTarget.x, y: expansionTarget.y };

    for (let step = 0; step < 30; step += 1) {
      simulation.update(0.2);
    }

    expect(simulation.colony.storedFood).toBeGreaterThan(initialStoredFood);
    expect(simulation.colony.getHiveSize(simulation.world)).toBeGreaterThan(initialHiveSize);
  });

  it('tracks active simulated runtime', () => {
    const simulation = new Simulation(() => 0.5);

    expect(simulation.getStats().elapsedTime).toBe(0);

    simulation.update(1.25);
    expect(simulation.getStats().elapsedTime).toBeCloseTo(1.25);

    simulation.paused = true;
    simulation.update(2.5);
    expect(simulation.getStats().elapsedTime).toBeCloseTo(1.25);

    simulation.reset();
    expect(simulation.getStats().elapsedTime).toBe(0);
  });

  it('continues collecting known food after storage reaches the target', () => {
    const simulation = new Simulation(() => 0.5);
    const ant = simulation.ants[0];
    simulation.ants = [ant];
    simulation.colony.storedFood = simulation.colony.foodTarget;

    ant.x = simulation.world.center.x;
    ant.y = simulation.world.center.y;

    const foodPoint = { x: simulation.world.center.x + 3, y: simulation.world.center.y };
    const foodTile = simulation.world.getTile(foodPoint);
    if (!foodTile) {
      throw new Error('Expected test food tile to exist');
    }
    simulation.world.setTileType(foodPoint, 'food');
    foodTile.foodAmount = 1;
    ant.memory.knownFoodTiles = [foodPoint];

    const initialStoredFood = simulation.colony.storedFood;

    for (let step = 0; step < 80; step += 1) {
      simulation.update(0.1);
    }

    expect(simulation.colony.storedFood).toBeGreaterThan(initialStoredFood);
    expect(ant.carrying).toBeNull();
  });

  it('dumps carried dirt even when the hive no longer needs expansion', () => {
    const simulation = new Simulation(() => 0.5);
    const ant = simulation.ants[0];
    simulation.ants = [ant];
    simulation.colony.storedFood = 0;

    ant.x = simulation.world.center.x + 3;
    ant.y = simulation.world.center.y;
    ant.carrying = 'dirt';

    let droppedAtHive = false;
    for (let step = 0; step < 80; step += 1) {
      simulation.update(0.1);
      if (ant.carrying === null) {
        droppedAtHive = simulation.world.getTile(ant.position)?.type === 'hive';
        break;
      }
    }

    expect(ant.carrying).toBeNull();
    expect(droppedAtHive).toBe(true);
  });
});
