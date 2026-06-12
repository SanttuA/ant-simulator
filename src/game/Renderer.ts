import type { Simulation } from './Simulation';
import { TILE_SIZE, type Tile, type World } from './World';

const TILE_COLORS: Record<Tile['type'], string> = {
  empty: '#090b0a',
  dirt: '#5a3a22',
  hive: '#b36b2c',
  food: '#43bf57',
  wall: '#1b211e',
};

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly terrainCanvas: HTMLCanvasElement;
  private readonly terrainCtx: CanvasRenderingContext2D;
  private cachedWorld: World | null = null;
  private cachedTerrainRevision = -1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context is unavailable.');
    }
    this.ctx = ctx;

    this.terrainCanvas = document.createElement('canvas');
    this.terrainCanvas.width = canvas.width;
    this.terrainCanvas.height = canvas.height;

    const terrainCtx = this.terrainCanvas.getContext('2d');
    if (!terrainCtx) {
      throw new Error('Canvas 2D context is unavailable.');
    }
    this.terrainCtx = terrainCtx;
  }

  render(simulation: Simulation, showDebug: boolean): void {
    const { ctx } = this;

    this.ensureTerrainCache(simulation.world);
    ctx.drawImage(this.terrainCanvas, 0, 0);

    for (const tile of simulation.world.getFoodTiles()) {
      ctx.fillStyle = TILE_COLORS.food;
      ctx.fillRect(tile.x * TILE_SIZE, tile.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = '#9bf06a';
      ctx.fillRect(tile.x * TILE_SIZE + 2, tile.y * TILE_SIZE + 2, 2, 2);
    }

    if (showDebug) {
      for (const tile of simulation.world.tiles) {
        this.renderPheromone(tile);
        if (tile.reservedByAntId) {
          ctx.strokeStyle = '#f2d15a';
          ctx.lineWidth = 1;
          ctx.strokeRect(
            tile.x * TILE_SIZE + 0.5,
            tile.y * TILE_SIZE + 0.5,
            TILE_SIZE - 1,
            TILE_SIZE - 1,
          );
        }
      }
    }

    if (showDebug) {
      this.renderPaths(simulation);
    }

    for (const ant of simulation.ants) {
      const selected = ant.id === simulation.selectedAntId;
      const x = ant.x * TILE_SIZE;
      const y = ant.y * TILE_SIZE;

      ctx.fillStyle =
        ant.carrying === 'food' ? '#f15c43' : ant.carrying === 'dirt' ? '#d19d61' : '#d83d34';
      ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);

      if (ant.carrying === 'food') {
        ctx.fillStyle = '#7ff071';
        ctx.fillRect(x + 3, y, 2, 2);
      }

      if (selected) {
        ctx.strokeStyle = '#f7f2c5';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
      }
    }
  }

  private ensureTerrainCache(world: World): void {
    const resized =
      this.terrainCanvas.width !== this.canvas.width ||
      this.terrainCanvas.height !== this.canvas.height;
    if (
      !resized &&
      this.cachedWorld === world &&
      this.cachedTerrainRevision === world.terrainRevision
    ) {
      return;
    }

    if (resized) {
      this.terrainCanvas.width = this.canvas.width;
      this.terrainCanvas.height = this.canvas.height;
    }

    this.terrainCtx.clearRect(0, 0, this.terrainCanvas.width, this.terrainCanvas.height);

    for (const tile of world.tiles) {
      this.terrainCtx.fillStyle = tile.type === 'food' ? TILE_COLORS.empty : TILE_COLORS[tile.type];
      this.terrainCtx.fillRect(tile.x * TILE_SIZE, tile.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }

    this.cachedWorld = world;
    this.cachedTerrainRevision = world.terrainRevision;
  }

  private renderPheromone(tile: Tile): void {
    const foodStrength = Math.min(0.28, tile.pheromoneFood * 0.24);
    const homeStrength = Math.min(0.2, tile.pheromoneHome * 0.18);

    if (foodStrength > 0) {
      this.ctx.fillStyle = `rgba(89, 214, 97, ${foodStrength})`;
      this.ctx.fillRect(tile.x * TILE_SIZE, tile.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }

    if (homeStrength > 0) {
      this.ctx.fillStyle = `rgba(240, 169, 65, ${homeStrength})`;
      this.ctx.fillRect(tile.x * TILE_SIZE, tile.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }

  private renderPaths(simulation: Simulation): void {
    for (const ant of simulation.ants) {
      const path = ant.actionRuntime?.path;
      if (!path || path.length < 2) {
        continue;
      }

      this.ctx.strokeStyle =
        ant.id === simulation.selectedAntId ? '#f7f2c5' : 'rgba(223, 226, 184, 0.28)';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(path[0].x * TILE_SIZE + TILE_SIZE / 2, path[0].y * TILE_SIZE + TILE_SIZE / 2);
      for (let index = 1; index < path.length; index += 1) {
        const point = path[index];
        this.ctx.lineTo(point.x * TILE_SIZE + TILE_SIZE / 2, point.y * TILE_SIZE + TILE_SIZE / 2);
      }
      this.ctx.stroke();
    }
  }
}
