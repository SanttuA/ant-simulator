import { Ant } from '../entities/Ant';
import { Colony } from '../entities/Colony';
import { updatePheromones } from '../systems/PheromoneSystem';
import { pointKey, type Point } from '../utils/Grid';
import { World } from './World';

export interface SimulationStats {
  antCount: number;
  storedFood: number;
  hiveSize: number;
  knownFoodSources: number;
  speed: number;
  paused: boolean;
}

export class Simulation {
  world: World;
  colony: Colony;
  ants: Ant[] = [];
  paused = false;
  speed = 1;
  selectedAntId: string | null = null;

  private antSequence = 0;

  constructor(private readonly random: () => number = Math.random) {
    this.world = World.createDefault(this.random);
    this.colony = new Colony();
    this.reset();
  }

  reset(): void {
    this.world = World.createDefault(this.random);
    this.colony = new Colony();
    this.ants = [];
    this.antSequence = 0;

    for (let i = 0; i < 20; i += 1) {
      this.spawnAnt();
    }

    this.selectedAntId = this.ants[0]?.id ?? null;
  }

  update(dt: number): void {
    if (this.paused) {
      return;
    }

    updatePheromones(this.world, this.ants);

    for (const ant of this.ants) {
      ant.update(
        {
          ant,
          world: this.world,
          colony: this.colony,
          simulation: this,
        },
        dt,
      );
    }

    if (this.selectedAntId && !this.ants.some((ant) => ant.id === this.selectedAntId)) {
      this.selectedAntId = this.ants[0]?.id ?? null;
    }
  }

  spawnAnt(): Ant {
    const hiveTiles = this.world.getHiveTiles();
    const spawn =
      hiveTiles[Math.floor(this.random() * hiveTiles.length)] ??
      this.world.getTile(this.world.center);
    const ant = new Ant(
      `ant-${String(this.antSequence + 1).padStart(3, '0')}`,
      spawn?.x ?? this.world.center.x,
      spawn?.y ?? this.world.center.y,
    );
    this.antSequence += 1;
    this.ants.push(ant);
    this.selectedAntId ??= ant.id;
    return ant;
  }

  spawnFood(): void {
    this.world.spawnRandomFood();
  }

  get selectedAnt(): Ant | null {
    return this.ants.find((ant) => ant.id === this.selectedAntId) ?? null;
  }

  selectAntAt(point: Point): void {
    const selected = this.ants
      .map((ant) => ({ ant, distance: Math.abs(ant.x - point.x) + Math.abs(ant.y - point.y) }))
      .filter(({ distance }) => distance <= 2)
      .sort((a, b) => a.distance - b.distance)[0]?.ant;

    if (selected) {
      this.selectedAntId = selected.id;
    }
  }

  getStats(): SimulationStats {
    const knownFood = new Set<string>();
    for (const ant of this.ants) {
      for (const food of ant.getKnownFood(this.world)) {
        knownFood.add(pointKey(food));
      }
    }

    return {
      antCount: this.ants.length,
      storedFood: this.colony.storedFood,
      hiveSize: this.colony.getHiveSize(this.world),
      knownFoodSources: knownFood.size,
      speed: this.speed,
      paused: this.paused,
    };
  }

  randomPassablePointNear(origin: Point, minDistance: number, maxDistance: number): Point {
    let fallback = origin;
    let bestPheromone = -1;

    for (let attempt = 0; attempt < 80; attempt += 1) {
      const angle = this.random() * Math.PI * 2;
      const distance = minDistance + this.random() * (maxDistance - minDistance);
      const point = {
        x: Math.floor(origin.x + Math.cos(angle) * distance),
        y: Math.floor(origin.y + Math.sin(angle) * distance),
      };
      const tile = this.world.getTile(point);

      if (!tile || !this.world.isPassable(point)) {
        continue;
      }

      if (tile.pheromoneFood > bestPheromone) {
        bestPheromone = tile.pheromoneFood;
        fallback = point;
      }

      if (tile.pheromoneFood > 0.05 || this.random() > 0.68) {
        return point;
      }
    }

    return fallback;
  }
}
