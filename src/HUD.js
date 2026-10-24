import * as THREE from 'three';
import explorationTracker from './ExplorationTracker.js';
import Localization from './Localization.js';

export default class HUD {
  constructor() {
    this.healthFill = document.getElementById('health-fill');
    this.staminaFill = document.getElementById('stamina-fill');
    this.hungerFill = document.getElementById('hunger-fill');
    this.thirstFill = document.getElementById('thirst-fill');
    this.energyFill = document.getElementById('energy-fill');
    this.manaFill = document.getElementById('mana-fill');

    this.healthVal = document.getElementById('health-val');
    this.staminaVal = document.getElementById('stamina-val');
    this.hungerVal = document.getElementById('hunger-val');
    this.thirstVal = document.getElementById('thirst-val');
    this.energyVal = document.getElementById('energy-val');
    this.manaVal = document.getElementById('mana-val');

    this.playerLevelBadge = document.getElementById('player-level-badge');
    this.xpFill = document.getElementById('xp-fill');
    this.xpVal = document.getElementById('xp-val');
    this.restedBuffBadge = document.getElementById('rested-buff-badge');
    this.restedTimerVal = document.getElementById('rested-timer-val');
    this.biomeTag = document.getElementById('hud-biome-tag');

    this.tooltip = document.getElementById('tooltip');
    this.notification = document.getElementById('notification');
    this.flashOverlay = document.getElementById('flash-overlay');
    this.damageNumbersContainer = document.getElementById('damage-numbers');
    
    this.harvestProgressContainer = document.getElementById('harvest-progress-container');
    this.harvestFill = document.getElementById('harvest-fill');
    this.harvestLabel = document.getElementById('harvest-label');

    this.minimapCanvas = document.getElementById('minimap');
    this.minimapCtx = this.minimapCanvas ? this.minimapCanvas.getContext('2d') : null;

    this.clockContainer = document.getElementById('game-clock-container');
    this.clockTimeEl = document.getElementById('game-clock-time');
    this.clockPhaseEl = document.getElementById('game-clock-phase');

    this.notificationTimeout = null;
    this.tempVector = new THREE.Vector3();
  }

  updateClock(clockData) {
    if (!clockData) return;
    if (this.clockTimeEl && clockData.timeStr) {
      this.clockTimeEl.textContent = clockData.timeStr;
    }
    if (this.clockPhaseEl && clockData.phaseStr) {
      this.clockPhaseEl.textContent = clockData.phaseStr;
    }
  }

  updateVitals(health, maxHealth, stamina, maxStamina, hunger, maxHunger, thirst, maxThirst, energy, maxEnergy, mana, maxMana, restedTimer, level, xp, xpNext) {
    this.updateHealth(health, maxHealth);
    this.updateStamina(stamina, maxStamina);
    this.updateHunger(hunger, maxHunger);

    // Thirst
    if (this.thirstFill) {
      const pct = Math.max(0, Math.min(100, (thirst / maxThirst) * 100));
      this.thirstFill.style.width = `${pct}%`;
    }
    if (this.thirstVal) this.thirstVal.textContent = `${Math.ceil(thirst)}/${maxThirst}`;

    // Energy / Fatigue
    if (this.energyFill) {
      const pct = Math.max(0, Math.min(100, (energy / maxEnergy) * 100));
      this.energyFill.style.width = `${pct}%`;
    }
    if (this.energyVal) this.energyVal.textContent = `${Math.ceil(energy)}/${maxEnergy}`;

    // Mana
    if (this.manaFill) {
      const pct = Math.max(0, Math.min(100, (mana / maxMana) * 100));
      this.manaFill.style.width = `${pct}%`;
    }
    if (this.manaVal) this.manaVal.textContent = `${Math.ceil(mana)}/${maxMana}`;

    // Level & XP
    if (this.playerLevelBadge) this.playerLevelBadge.textContent = `🏆 Taso ${level}`;
    if (this.xpFill) {
      const xpPct = Math.max(0, Math.min(100, (xp / xpNext) * 100));
      this.xpFill.style.width = `${xpPct}%`;
    }
    if (this.xpVal) this.xpVal.textContent = `${xp}/${xpNext} XP`;

    // Rested Buff Badge
    if (this.restedBuffBadge) {
      if (restedTimer > 0) {
        this.restedBuffBadge.style.display = 'inline-flex';
        const mins = Math.floor(restedTimer / 60);
        const secs = Math.floor(restedTimer % 60);
        const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        if (this.restedTimerVal) this.restedTimerVal.textContent = timeStr;
      } else {
        this.restedBuffBadge.style.display = 'none';
      }
    }
  }

  updateHealth(current, max) {
    const pct = Math.max(0, Math.min(100, (current / max) * 100));
    if (this.healthFill) this.healthFill.style.width = `${pct}%`;
    if (this.healthVal) this.healthVal.textContent = `${Math.ceil(current)}/${max}`;
  }

  updateStamina(current, max) {
    const pct = Math.max(0, Math.min(100, (current / max) * 100));
    if (this.staminaFill) this.staminaFill.style.width = `${pct}%`;
    if (this.staminaVal) this.staminaVal.textContent = `${Math.ceil(current)}/${max}`;
  }

  updateHunger(current, max) {
    const pct = Math.max(0, Math.min(100, (current / max) * 100));
    if (this.hungerFill) this.hungerFill.style.width = `${pct}%`;
    if (this.hungerVal) this.hungerVal.textContent = `${Math.ceil(current)}/${max}`;
  }

  showTooltip(text) {
    if (this.tooltip) {
      this.tooltip.textContent = text;
      this.tooltip.classList.add('visible');
    }
  }

  hideTooltip() {
    if (this.tooltip) {
      this.tooltip.classList.remove('visible');
    }
  }

  setHarvestProgress(ratio, label = 'Harvesting...') {
    if (!this.harvestProgressContainer) return;
    if (ratio > 0) {
      this.harvestProgressContainer.style.display = 'flex';
      if (this.harvestFill) {
        this.harvestFill.style.width = `${Math.min(100, ratio * 100)}%`;
      }
      if (this.harvestLabel) {
        this.harvestLabel.textContent = `${label} ${Math.floor(ratio * 100)}%`;
      }
    } else {
      this.harvestProgressContainer.style.display = 'none';
      if (this.harvestFill) {
        this.harvestFill.style.width = '0%';
      }
    }
  }

  showNotification(text, duration = 3000) {
    if (!this.notification) return;
    this.notification.textContent = text;
    this.notification.classList.add('show');

    if (this.notificationTimeout) {
      clearTimeout(this.notificationTimeout);
    }

    this.notificationTimeout = setTimeout(() => {
      this.notification.classList.remove('show');
    }, duration);
  }

  flashRed() {
    if (!this.flashOverlay) return;
    this.flashOverlay.classList.add('active');
    setTimeout(() => {
      this.flashOverlay.classList.remove('active');
    }, 150);
  }

  showDamageNumber(amount, isPlayer = false, worldPos = null, camera = null) {
    if (!this.damageNumbersContainer) return;

    const el = document.createElement('div');
    el.className = `damage-num ${isPlayer ? 'player-damage' : ''}`;
    el.textContent = `-${Math.round(amount)}`;

    let screenX = window.innerWidth / 2;
    let screenY = window.innerHeight / 2;

    if (worldPos && camera) {
      this.tempVector.copy(worldPos);
      this.tempVector.project(camera);

      // Check if in front of camera
      if (this.tempVector.z < 1) {
        screenX = (this.tempVector.x * 0.5 + 0.5) * window.innerWidth;
        screenY = (-(this.tempVector.y * 0.5) + 0.5) * window.innerHeight;
      }
    } else if (isPlayer) {
      // Center screen jitter for player damage
      screenX = window.innerWidth / 2 + (Math.random() * 80 - 40);
      screenY = window.innerHeight / 2 + (Math.random() * 80 - 40);
    }

    el.style.left = `${screenX}px`;
    el.style.top = `${screenY}px`;

    this.damageNumbersContainer.appendChild(el);
    setTimeout(() => {
      el.remove();
    }, 900);
  }

  showPickupText(text) {
    if (!this.damageNumbersContainer) return;

    const el = document.createElement('div');
    el.className = 'pickup-number';
    el.textContent = text;

    const screenX = window.innerWidth / 2 + (Math.random() * 60 - 30);
    const screenY = window.innerHeight / 2 + 60 + (Math.random() * 20 - 10);

    el.style.left = `${screenX}px`;
    el.style.top = `${screenY}px`;

    this.damageNumbersContainer.appendChild(el);
    setTimeout(() => {
      el.remove();
    }, 1200);
  }

  updateMinimap(playerPos, playerHeading, enemies = [], campfires = [], biomeKey = 'meadows') {
    if (!this.minimapCtx || !playerPos) return;
    const ctx = this.minimapCtx;
    const width = 150;
    const height = 150;
    const center = width / 2;
    const range = 60; // World units displayed radius

    // Update exploration tracker around player
    explorationTracker.update(playerPos);

    // Update Biome badge text
    if (this.biomeTag) {
      const biomeLabels = {
        meadows: Localization.t('biome_meadows', 'AARNIOMETSÄ'),
        blackForest: Localization.t('biome_black_forest', 'MUSTAMETSÄ'),
        swamp: Localization.t('biome_swamp', 'KIROTTU SUO'),
        mountain: Localization.t('biome_mountain', 'JÄÄVUORET'),
        runePlains: Localization.t('biome_plains', 'TASANGOT'),
        ashlands: Localization.t('biome_ashlands', 'TUHKATASANGOT')
      };
      this.biomeTag.textContent = (biomeLabels[biomeKey] || biomeKey).toUpperCase();
    }

    ctx.clearRect(0, 0, width, height);

    // Save for circular clipping mask
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, center - 2, 0, Math.PI * 2);
    ctx.clip();

    // 1. Biome terrain background
    const biomeColors = {
      meadows: '#2c5427',
      blackForest: '#173022',
      swamp: '#2b341c',
      mountain: '#6f7e8a',
      runePlains: '#6a5927',
      ashlands: '#2e1414'
    };
    ctx.fillStyle = biomeColors[biomeKey] || '#2c5427';
    ctx.fillRect(0, 0, width, height);

    // 2. Fog of war shroud over unexplored tiles
    const tileSize = 12; // 12x12 px samples
    for (let py = 0; py < height; py += tileSize) {
      for (let px = 0; px < width; px += tileSize) {
        // Map radar px back to world coords
        const rdx = ((px + tileSize / 2) - center) / center;
        const rdz = ((py + tileSize / 2) - center) / center;
        const wx = playerPos.x + rdx * range;
        const wz = playerPos.z + rdz * range;

        if (!explorationTracker.isExplored(wx, wz)) {
          ctx.fillStyle = '#0a0e14';
          ctx.fillRect(px, py, tileSize, tileSize);
        }
      }
    }

    // 3. Radar rings
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(center, center, center * 0.4, 0, Math.PI * 2);
    ctx.arc(center, center, center * 0.75, 0, Math.PI * 2);
    ctx.stroke();

    // Cross axes
    ctx.beginPath();
    ctx.moveTo(center, 4);
    ctx.lineTo(center, height - 4);
    ctx.moveTo(4, center);
    ctx.lineTo(width - 4, center);
    ctx.stroke();

    // World to radar mapping
    const toRadar = (worldX, worldZ) => {
      const dx = worldX - playerPos.x;
      const dz = worldZ - playerPos.z;
      const rx = center + (dx / range) * center;
      const ry = center + (dz / range) * center;
      return { x: rx, y: ry };
    };

    // Draw campfires (only if in explored area)
    if (campfires) {
      campfires.forEach(camp => {
        if (!explorationTracker.isExplored(camp.position.x, camp.position.z)) return;
        const pt = toRadar(camp.position.x, camp.position.z);
        const distSq = (pt.x - center) ** 2 + (pt.y - center) ** 2;
        if (distSq < (center - 6) ** 2) {
          ctx.fillStyle = '#f39c12';
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    // Draw enemies (only if in explored area)
    if (enemies) {
      enemies.forEach(enemy => {
        if (!enemy.isAlive) return;
        const ex = enemy.mesh.position.x;
        const ez = enemy.mesh.position.z;
        if (!explorationTracker.isExplored(ex, ez)) return;
        const pt = toRadar(ex, ez);
        const distSq = (pt.x - center) ** 2 + (pt.y - center) ** 2;
        if (distSq < (center - 6) ** 2) {
          ctx.fillStyle = enemy.state === 'chase' ? '#e74c3c' : '#9b59b6';
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    // Draw Player pointer at center
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(playerHeading);

    ctx.fillStyle = '#2ecc71';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(5, 5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.restore(); // restore clipping mask
  }
}
