import {
  distanceSquared,
  manhattan,
  neighbors4,
  pointKey,
  samePoint,
  type Point,
} from '../utils/Grid';

export const WORLD_WIDTH = 160;
export const WORLD_HEIGHT = 100;
export const TILE_SIZE = 6;

export type TileType = 'empty' | 'dirt' | 'hive' | 'food' | 'wall';

export interface Tile extends Point {
  type: TileType;
  foodAmount: number;
  pheromoneFood: number;
  pheromoneHome: number;
  reservedByAntId?: string;
}

export class World {
  readonly tiles: Tile[];
  private readonly foodTileKeys = new Set<string>();
  private terrainRevisionValue = 0;

  constructor(
    readonly width = WORLD_WIDTH,
    readonly height = WORLD_HEIGHT,
    private readonly random: () => number = Math.random,
  ) {
    this.tiles = [];

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        this.tiles.push({
          x,
          y,
          type: 'empty',
          foodAmount: 0,
          pheromoneFood: 0,
          pheromoneHome: 0,
        });
      }
    }
  }

  static createDefault(random: () => number = Math.random): World {
    const world = new World(WORLD_WIDTH, WORLD_HEIGHT, random);
    world.generateDefaultMap();
    return world;
  }

  get center(): Point {
    return { x: Math.floor(this.width / 2), y: Math.floor(this.height / 2) };
  }

  get terrainRevision(): number {
    return this.terrainRevisionValue;
  }

  generateDefaultMap(): void {
    this.foodTileKeys.clear();

    this.tiles.forEach((tile) => {
      tile.type = 'empty';
      tile.foodAmount = 0;
      tile.pheromoneFood = 0;
      tile.pheromoneHome = 0;
      tile.reservedByAntId = undefined;
    });

    const center = this.center;

    for (let y = center.y - 2; y <= center.y + 2; y += 1) {
      for (let x = center.x - 2; x <= center.x + 2; x += 1) {
        this.setTileType({ x, y }, 'hive');
      }
    }

    this.addDiggableSoil(center);
    this.addWallOutcrops();
    this.terrainRevisionValue += 1;

    for (let i = 0; i < 4; i += 1) {
      this.spawnFoodPatch(
        this.randomOpenPointAround(center, 10, 22),
        14 + Math.floor(this.random() * 14),
      );
    }

    for (let i = 0; i < 7; i += 1) {
      this.spawnFoodPatch(
        this.randomOpenPointAround(center, 24, 62),
        14 + Math.floor(this.random() * 18),
      );
    }
  }

  inBounds(point: Point): boolean {
    return point.x >= 0 && point.y >= 0 && point.x < this.width && point.y < this.height;
  }

  getTile(point: Point): Tile | undefined {
    if (!this.inBounds(point)) {
      return undefined;
    }

    return this.tiles[point.y * this.width + point.x];
  }

  setTileType(point: Point, type: TileType): void {
    const tile = this.getTile(point);
    if (!tile) {
      return;
    }

    const previousTerrainType = terrainTypeForRender(tile.type);
    const nextTerrainType = terrainTypeForRender(type);

    if (tile.type === 'food') {
      this.foodTileKeys.delete(pointKey(tile));
    }

    tile.type = type;
    if (type === 'food') {
      this.foodTileKeys.add(pointKey(tile));
    }

    if (type !== 'food') {
      tile.foodAmount = 0;
    }

    if (previousTerrainType !== nextTerrainType) {
      this.terrainRevisionValue += 1;
    }
  }

  isPassable(point: Point): boolean {
    const tile = this.getTile(point);
    return Boolean(tile && (tile.type === 'empty' || tile.type === 'hive' || tile.type === 'food'));
  }

  getNeighbors(point: Point): Tile[] {
    return neighbors4(point)
      .map((next) => this.getTile(next))
      .filter((tile): tile is Tile => Boolean(tile));
  }

  getHiveTiles(): Tile[] {
    return this.tiles.filter((tile) => tile.type === 'hive');
  }

  getFoodTiles(): Tile[] {
    const foodTiles: Tile[] = [];

    for (const key of this.foodTileKeys) {
      const tile = this.getTile(parsePointKey(key));
      if (tile?.type === 'food' && tile.foodAmount > 0) {
        foodTiles.push(tile);
        continue;
      }

      this.foodTileKeys.delete(key);
    }

    return foodTiles;
  }

  countTiles(type: TileType): number {
    return this.tiles.filter((tile) => tile.type === type).length;
  }

  scanFood(origin: Point, radius: number): Point[] {
    const radiusSquared = radius * radius;
    return this.getFoodTiles()
      .filter((tile) => distanceSquared(tile, origin) <= radiusSquared)
      .map((tile) => ({ x: tile.x, y: tile.y }));
  }

  nearestHiveTile(origin: Point): Point | null {
    let nearest: Point | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const hiveTile of this.getHiveTiles()) {
      const distance = manhattan(origin, hiveTile);
      if (distance < bestDistance) {
        bestDistance = distance;
        nearest = { x: hiveTile.x, y: hiveTile.y };
      }
    }

    return nearest;
  }

  getAdjacentPassableTile(target: Point, from: Point): Point | null {
    const candidates = this.getNeighbors(target)
      .filter((tile) => this.isPassable(tile))
      .map((tile) => ({ x: tile.x, y: tile.y }))
      .sort((a, b) => manhattan(a, from) - manhattan(b, from));

    return candidates[0] ?? null;
  }

  findExpansionCandidates(): Tile[] {
    const seen = new Set<string>();
    const candidates: Tile[] = [];

    for (const hiveTile of this.getHiveTiles()) {
      for (const neighbor of this.getNeighbors(hiveTile)) {
        const key = pointKey(neighbor);
        if (seen.has(key) || neighbor.type !== 'dirt') {
          continue;
        }

        if (this.getAdjacentPassableTile(neighbor, hiveTile)) {
          seen.add(key);
          candidates.push(neighbor);
        }
      }
    }

    return candidates.sort((a, b) => manhattan(a, this.center) - manhattan(b, this.center));
  }

  spawnFoodPatch(center: Point, amount: number): void {
    const radius = 2 + Math.floor(this.random() * 2);

    for (let i = 0; i < amount; i += 1) {
      const x = center.x + Math.floor(this.random() * (radius * 2 + 1)) - radius;
      const y = center.y + Math.floor(this.random() * (radius * 2 + 1)) - radius;
      const tile = this.getTile({ x, y });

      if (!tile || tile.type === 'hive' || tile.type === 'wall' || tile.type === 'dirt') {
        continue;
      }

      this.setTileType({ x, y }, 'food');
      tile.foodAmount += 2 + Math.floor(this.random() * 4);
    }
  }

  spawnRandomFood(): void {
    this.spawnFoodPatch(this.randomOpenPointAround(this.center, 18, 62), 28);
  }

  decayPheromones(rate: number): void {
    for (const tile of this.tiles) {
      tile.pheromoneFood *= rate;
      tile.pheromoneHome *= rate;
      if (tile.pheromoneFood < 0.01) {
        tile.pheromoneFood = 0;
      }
      if (tile.pheromoneHome < 0.01) {
        tile.pheromoneHome = 0;
      }
    }
  }

  addFoodPheromone(point: Point, amount: number): void {
    const tile = this.getTile(point);
    if (tile) {
      tile.pheromoneFood = Math.min(1, tile.pheromoneFood + amount);
    }
  }

  addHomePheromone(point: Point, amount: number): void {
    const tile = this.getTile(point);
    if (tile) {
      tile.pheromoneHome = Math.min(1, tile.pheromoneHome + amount);
    }
  }

  private addDiggableSoil(center: Point): void {
    for (let ring = 3; ring <= 17; ring += 1) {
      for (let y = center.y - ring; y <= center.y + ring; y += 1) {
        for (let x = center.x - ring; x <= center.x + ring; x += 1) {
          const point = { x, y };
          const tile = this.getTile(point);
          if (!tile || tile.type === 'hive') {
            continue;
          }

          const onRing = Math.abs(x - center.x) === ring || Math.abs(y - center.y) === ring;
          const corridor = Math.abs(y - center.y) <= 1 || Math.abs(x - center.x) <= 1;
          if (onRing && !corridor && this.random() > 0.18) {
            tile.type = 'dirt';
          }
        }
      }
    }
  }

  private addWallOutcrops(): void {
    for (let i = 0; i < 18; i += 1) {
      const start = this.randomOpenPointAround(this.center, 24, 70);
      const length = 3 + Math.floor(this.random() * 6);
      const horizontal = this.random() > 0.5;

      for (let step = 0; step < length; step += 1) {
        const point = horizontal
          ? { x: start.x + step, y: start.y }
          : { x: start.x, y: start.y + step };
        const tile = this.getTile(point);
        if (tile && tile.type === 'empty' && !samePoint(point, this.center)) {
          tile.type = 'wall';
        }
      }
    }
  }

  private randomOpenPointAround(origin: Point, minDistance: number, maxDistance: number): Point {
    for (let attempt = 0; attempt < 400; attempt += 1) {
      const angle = this.random() * Math.PI * 2;
      const distance = minDistance + this.random() * (maxDistance - minDistance);
      const point = {
        x: Math.floor(origin.x + Math.cos(angle) * distance),
        y: Math.floor(origin.y + Math.sin(angle) * distance),
      };
      const tile = this.getTile(point);

      if (tile && tile.type === 'empty' && manhattan(origin, point) >= minDistance) {
        return point;
      }
    }

    return {
      x: Math.min(this.width - 5, Math.max(4, origin.x + minDistance)),
      y: origin.y,
    };
  }
}

function terrainTypeForRender(type: TileType): TileType {
  return type === 'food' ? 'empty' : type;
}

function parsePointKey(key: string): Point {
  const [x = '0', y = '0'] = key.split(',');
  return { x: Number(x), y: Number(y) };
}
