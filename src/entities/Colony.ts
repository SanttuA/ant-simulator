import { manhattan, pointKey, type Point } from '../utils/Grid';
import type { World } from '../game/World';

export class Colony {
  storedFood = 0;
  readonly foodTarget = 30;
  private readonly expansionReservations = new Map<string, string>();

  constructor(readonly id = 'colony-1') {}

  reset(): void {
    this.storedFood = 0;
    this.expansionReservations.clear();
  }

  getHiveSize(world: World): number {
    return world.countTiles('hive');
  }

  storageLow(): boolean {
    return this.storedFood < this.foodTarget;
  }

  needsExpansion(world: World, antCount: number): boolean {
    const hiveSize = this.getHiveSize(world);
    const capacityPressure = antCount > Math.max(8, Math.floor(hiveSize * 0.72));
    const resourcePressure = this.storedFood >= 8;
    return resourcePressure && capacityPressure && world.findExpansionCandidates().length > 0;
  }

  reserveExpansionTarget(world: World, antId: string, from: Point): Point | null {
    for (const [targetKey, reservedBy] of this.expansionReservations.entries()) {
      if (reservedBy === antId) {
        const tile = world.getTile(parseReservationKey(targetKey));
        if (tile?.type === 'dirt') {
          return { x: tile.x, y: tile.y };
        }
        this.expansionReservations.delete(targetKey);
      }
    }

    const candidates = world
      .findExpansionCandidates()
      .filter((tile) => !tile.reservedByAntId && !this.expansionReservations.has(pointKey(tile)))
      .sort((a, b) => manhattan(a, from) - manhattan(b, from));

    const selected = candidates[0];
    if (!selected) {
      return null;
    }

    selected.reservedByAntId = antId;
    this.expansionReservations.set(pointKey(selected), antId);
    return { x: selected.x, y: selected.y };
  }

  releaseExpansionTarget(world: World, antId: string, target?: Point): void {
    const keys = target ? [pointKey(target)] : [...this.expansionReservations.keys()];

    for (const key of keys) {
      if (this.expansionReservations.get(key) !== antId) {
        continue;
      }

      this.expansionReservations.delete(key);
      const tile = world.getTile(parseReservationKey(key));
      if (tile?.reservedByAntId === antId) {
        tile.reservedByAntId = undefined;
      }
    }
  }
}

function parseReservationKey(key: string): Point {
  const [x = '0', y = '0'] = key.split(',');
  return { x: Number(x), y: Number(y) };
}
