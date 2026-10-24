/**
 * ExplorationTracker
 * Manages Fog of War exploration grid across the world (from -400m to +400m).
 * Updates automatically when the player moves and provides queries for both
 * the Mini-map (HUD) and the Full Map (M).
 */
export class ExplorationTracker {
  constructor(worldSize = 800, resolution = 5) {
    this.worldSize = worldSize; // Total span: -400 to +400
    this.halfSize = worldSize / 2;
    this.resolution = resolution; // 5 meters per cell
    this.gridWidth = Math.ceil(worldSize / resolution); // 160 cells
    this.grid = new Uint8Array(this.gridWidth * this.gridWidth);

    // Initial reveal: starting area around central village (radius 45m)
    this.revealArea(0, 0, 48);
  }

  worldToGrid(wx, wz) {
    const gx = Math.floor((wx + this.halfSize) / this.resolution);
    const gz = Math.floor((wz + this.halfSize) / this.resolution);
    return { gx, gz };
  }

  gridToWorld(gx, gz) {
    const wx = (gx * this.resolution) - this.halfSize + (this.resolution / 2);
    const wz = (gz * this.resolution) - this.halfSize + (this.resolution / 2);
    return { wx, wz };
  }

  isExplored(wx, wz) {
    const { gx, gz } = this.worldToGrid(wx, wz);
    if (gx < 0 || gx >= this.gridWidth || gz < 0 || gz >= this.gridWidth) return false;
    return this.grid[gz * this.gridWidth + gx] === 1;
  }

  isGridExplored(gx, gz) {
    if (gx < 0 || gx >= this.gridWidth || gz < 0 || gz >= this.gridWidth) return false;
    return this.grid[gz * this.gridWidth + gx] === 1;
  }

  revealArea(wx, wz, radius = 35) {
    const { gx, gz } = this.worldToGrid(wx, wz);
    const radiusCells = Math.ceil(radius / this.resolution);
    const rSq = radiusCells * radiusCells;

    for (let dz = -radiusCells; dz <= radiusCells; dz++) {
      const cz = gz + dz;
      if (cz < 0 || cz >= this.gridWidth) continue;
      for (let dx = -radiusCells; dx <= radiusCells; dx++) {
        const cx = gx + dx;
        if (cx < 0 || cx >= this.gridWidth) continue;
        if (dx * dx + dz * dz <= rSq) {
          this.grid[cz * this.gridWidth + cx] = 1;
        }
      }
    }
  }

  update(playerPos) {
    if (!playerPos) return;
    this.revealArea(playerPos.x, playerPos.z, 36);
  }
}

export const explorationTracker = new ExplorationTracker();
export default explorationTracker;
