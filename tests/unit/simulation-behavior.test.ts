import { describe, expect, it } from 'vitest';
import { Simulation } from '../../src/game/Simulation';

describe('simulation behavior loop', () => {
  it('stores food and expands the hive over time', () => {
    const simulation = new Simulation(seededRandom(42));
    const initialHiveSize = simulation.colony.getHiveSize(simulation.world);

    for (let step = 0; step < 1_500; step += 1) {
      simulation.update(0.2);
    }

    expect(simulation.colony.storedFood).toBeGreaterThan(0);
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
});

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x100000000;
  };
}
