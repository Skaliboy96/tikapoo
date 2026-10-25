/**
 * MapScreen – Full-screen interactive map opened with [M].
 * Features:
 * - Zoom in / out (mouse wheel & +/- buttons)
 * - Drag pan (click and drag)
 * - Fog of War: only revealed explored areas are visible
 * - Coordinates & active quests display
 */
import * as THREE from 'three';
import explorationTracker from './ExplorationTracker.js';
import Localization from './Localization.js';

export default class MapScreen {
  constructor(world, player, npcManager, enemyManager, buildingSystem, controls, camera, questManager, bossManager = null) {
    this.world = world;
    this.player = player;
    this.npcManager = npcManager;
    this.enemyManager = enemyManager;
    this.buildingSystem = buildingSystem;
    this.controls = controls;
    this.camera = camera;
    this.questManager = questManager;
    this.bossManager = bossManager;

    this._camDir = new THREE.Vector3();

    this.isOpen = false;
    this.zoom = 1.0;
    this.pan = { x: 0, z: 0 };
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.panStart = { x: 0, z: 0 };

    this.overlayEl = document.getElementById('map-screen');
    this.canvasEl = document.getElementById('map-canvas');
    this.ctx = this.canvasEl ? this.canvasEl.getContext('2d') : null;
    this.closeBtn = document.getElementById('map-close-btn');
    this.legendEl = document.getElementById('map-legend');
    this.coordsEl = document.getElementById('map-coords');
    this.questsEl = document.getElementById('map-quests');

    this._setupListeners();
    this._buildLegend();
  }

  _setupListeners() {
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
      if (e.code === 'KeyM') {
        e.preventDefault();
        this.toggle();
      }
      if (e.code === 'Escape' && this.isOpen) this.close();
    });

    if (this.closeBtn) {
      const handleClose = (e) => {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        this.close();
      };
      this.closeBtn.addEventListener('click', handleClose);
      this.closeBtn.addEventListener('pointerdown', handleClose);
      this.closeBtn.addEventListener('touchend', handleClose);
    }

    // Zoom Buttons
    document.getElementById('map-zoom-in-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.zoom = Math.min(3.5, this.zoom * 1.25);
      this.draw();
    });

    document.getElementById('map-zoom-out-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.zoom = Math.max(0.55, this.zoom / 1.25);
      this.draw();
    });

    document.getElementById('map-zoom-reset-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.zoom = 1.0;
      if (this.player) {
        const pPos = this.player.getPosition();
        this.pan.x = pPos.x;
        this.pan.z = pPos.z;
      } else {
        this.pan.x = 0;
        this.pan.z = 0;
      }
      this.draw();
    });

    // Mouse Wheel Zoom
    if (this.canvasEl) {
      this.canvasEl.addEventListener('wheel', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const factor = e.deltaY < 0 ? 1.16 : 0.86;
        this.zoom = Math.max(0.55, Math.min(3.5, this.zoom * factor));
        this.draw();
      }, { passive: false });

      // Drag to Pan with Mouse
      this.canvasEl.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
          this.isDragging = true;
          this.dragStart = { x: e.clientX, y: e.clientY };
          this.panStart = { x: this.pan.x, z: this.pan.z };
          this.canvasEl.style.cursor = 'grabbing';
        }
      });

      // Touch Drag Panning & Pinch-to-Zoom for Mobile Screens
      let initialPinchDist = null;
      let initialZoom = 1.0;

      this.canvasEl.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          if (e.cancelable) e.preventDefault();
          const t = e.touches[0];
          this.isDragging = true;
          this.dragStart = { x: t.clientX, y: t.clientY };
          this.panStart = { x: this.pan.x, z: this.pan.z };
          initialPinchDist = null;
        } else if (e.touches.length === 2) {
          if (e.cancelable) e.preventDefault();
          this.isDragging = false;
          initialPinchDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          initialZoom = this.zoom;
        }
      }, { passive: false });

      this.canvasEl.addEventListener('touchmove', (e) => {
        if (!this.isOpen) return;

        if (e.touches.length === 1 && this.isDragging) {
          if (e.cancelable) e.preventDefault();
          const t = e.touches[0];
          const dx = t.clientX - this.dragStart.x;
          const dy = t.clientY - this.dragStart.y;
          const W = this.canvasEl.width;
          const WORLD = 330;
          this.pan.x = this.panStart.x - (dx / (W / 2)) * (WORLD / this.zoom);
          this.pan.z = this.panStart.z - (dy / (W / 2)) * (WORLD / this.zoom);
          this.draw();
        } else if (e.touches.length === 2 && initialPinchDist) {
          if (e.cancelable) e.preventDefault();
          const currentDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          const ratio = currentDist / initialPinchDist;
          this.zoom = Math.max(0.55, Math.min(3.5, initialZoom * ratio));
          this.draw();
        }
      }, { passive: false });

      const handleTouchEnd = (e) => {
        if (e.touches.length === 0) {
          this.isDragging = false;
          initialPinchDist = null;
        } else if (e.touches.length === 1) {
          const t = e.touches[0];
          this.isDragging = true;
          this.dragStart = { x: t.clientX, y: t.clientY };
          this.panStart = { x: this.pan.x, z: this.pan.z };
          initialPinchDist = null;
        }
      };
      this.canvasEl.addEventListener('touchend', handleTouchEnd, { passive: true });
      this.canvasEl.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    }

    window.addEventListener('mousemove', (e) => {
      if (!this.isOpen) return;

      if (this.isDragging && this.canvasEl) {
        const dx = e.clientX - this.dragStart.x;
        const dy = e.clientY - this.dragStart.y;
        const W = this.canvasEl.width;
        const WORLD = 330;
        // Inverse coordinate shift
        this.pan.x = this.panStart.x - (dx / (W / 2)) * (WORLD / this.zoom);
        this.pan.z = this.panStart.z - (dy / (W / 2)) * (WORLD / this.zoom);
        this.draw();
      }

      // Update cursor coordinates tooltip
      if (this.coordsEl && this.canvasEl) {
        const rect = this.canvasEl.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
          const W = this.canvasEl.width;
          const WORLD = 330;
          const px = ((e.clientX - rect.left) / rect.width) * W;
          const py = ((e.clientY - rect.top) / rect.height) * W;
          const wx = Math.round(this.pan.x + ((px - W / 2) / (W / 2) / this.zoom) * WORLD);
          const wz = Math.round(this.pan.z + ((py - W / 2) / (W / 2) / this.zoom) * WORLD);
          this.coordsEl.innerHTML = `X: ${wx} &nbsp; Z: ${wz}`;
        }
      }
    });

    window.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        if (this.canvasEl) this.canvasEl.style.cursor = 'grab';
      }
    });
  }

  _buildLegend() {
    if (!this.legendEl) return;
    const isFi = Localization.getLanguage() === 'fi';
    const items = [
      { color: '#2ecc71', label: isFi ? 'Sinä' : 'You' },
      { color: '#8e44ad', label: 'NPC' },
      { color: '#e74c3c', label: isFi ? 'Vihollinen' : 'Enemy' },
      { color: '#ff7675', label: isFi ? '🔥 Pomo (Boss)' : '🔥 Boss' },
      { color: '#f39c12', label: isFi ? 'Leirituli' : 'Campfire' },
      { color: '#2d6a30', label: isFi ? 'Puu' : 'Tree' },
      { color: '#7f8c8d', label: isFi ? 'Kivi' : 'Stone' },
      { color: '#8e244d', label: isFi ? 'Marjapensas' : 'Berry Bush' },
    ];
    this.legendEl.innerHTML = items.map(i =>
      `<div class="map-legend-row"><span class="map-legend-dot" style="background:${i.color}"></span>${i.label}</div>`
    ).join('');
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  open() {
    this.isOpen = true;
    if (this.overlayEl) this.overlayEl.classList.add('active');
    if (this.controls && this.controls.isLocked) this.controls.unlock();
    if (this.canvasEl) {
      this.canvasEl.style.cursor = 'grab';
      if (!this.canvasEl.width || this.canvasEl.width < 100) this.canvasEl.width = 600;
      if (!this.canvasEl.height || this.canvasEl.height < 100) this.canvasEl.height = 600;
    }

    // Center map on player upon opening and reveal local area on Fog of War
    if (this.player) {
      const pPos = this.player.getPosition ? this.player.getPosition() : this.player.playerPos;
      if (pPos) {
        this.pan.x = pPos.x;
        this.pan.z = pPos.z;
        if (explorationTracker && explorationTracker.revealArea) {
          explorationTracker.revealArea(pPos.x, pPos.z, 65);
        }
      }
    }

    this._buildLegend();
    this._updateQuests();
    this.draw();
    this._startAnimLoop();
  }

  _startAnimLoop() {
    if (this._animLoopId) cancelAnimationFrame(this._animLoopId);
    const loop = () => {
      if (!this.isOpen) return;
      try {
        this.draw();
      } catch (err) {
        console.error('[MapScreen] Draw loop error:', err);
      }
      this._animLoopId = requestAnimationFrame(loop);
    };
    this._animLoopId = requestAnimationFrame(loop);
  }

  close() {
    this.isOpen = false;
    this.isDragging = false;
    if (this._animLoopId) {
      cancelAnimationFrame(this._animLoopId);
      this._animLoopId = null;
    }
    if (this.overlayEl) this.overlayEl.classList.remove('active');
    if (window.restoreGameFocus) {
      window.restoreGameFocus();
    } else {
      setTimeout(() => {
        const mainMenu = document.getElementById('main-menu');
        const isMenu = mainMenu && mainMenu.style.display !== 'none';
        if (!isMenu && this.controls && !this.controls.isLocked) {
          this.controls.lock();
        }
      }, 60);
    }
  }

  _updateQuests() {
    if (!this.questsEl) return;
    if (this.questManager && this.questManager.quests) {
      const active = this.questManager.quests.filter(q => q.status === 'active');
      if (active.length === 0) {
        this.questsEl.innerHTML = `<div class="quest-log-empty">${Localization.t('quest_empty', 'Ei aktiivisia tehtäviä')}</div>`;
      } else {
        this.questsEl.innerHTML = active.map(q => `
          <div class="map-quest-item">
            <span class="map-quest-title">${q.title}</span>
            <span class="map-quest-prog">${q.progress}/${q.target} ${q.targetLabel || ''}</span>
          </div>
        `).join('');
      }
    }
  }

  draw() {
    if (!this.ctx || !this.canvasEl) return;
    const W = this.canvasEl.width;
    const H = this.canvasEl.height;
    const ctx = this.ctx;

    const WORLD = 330;
    const toMap = (wx, wz) => ({
      x: W / 2 + ((wx - this.pan.x) / WORLD) * (W / 2) * this.zoom,
      y: H / 2 + ((wz - this.pan.z) / WORLD) * (H / 2) * this.zoom,
    });

    // 1. Dark Shroud Canvas Base (Fog of War)
    ctx.fillStyle = '#0a0e14';
    ctx.fillRect(0, 0, W, H);

    // 2. Draw explored terrain tiles
    const STEP = 10;
    for (let px = 0; px < W; px += STEP) {
      for (let py = 0; py < H; py += STEP) {
        const wx = this.pan.x + ((px - W / 2) / (W / 2) / this.zoom) * WORLD;
        const wz = this.pan.z + ((py - H / 2) / (H / 2) / this.zoom) * WORLD;

        // Fog of War check: only draw if explored!
        if (!explorationTracker.isExplored(wx, wz)) {
          ctx.fillStyle = '#0a0e14';
          ctx.fillRect(px, py, STEP, STEP);
          continue;
        }

        const h = this.world ? this.world.getGroundHeight(wx, wz) : 0;
        if (h < 0) {
          // River water
          ctx.fillStyle = '#1b6982';
        } else {
          const t = Math.max(0, Math.min(1, (h - 1.5) / 32.0));
          const r = Math.round(36 + t * 50);
          const g = Math.round(70 + t * 35);
          const b = Math.round(30 + t * 40);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
        }
        ctx.fillRect(px, py, STEP, STEP);
      }
    }

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 6; i++) {
      const xp = (i / 6) * W;
      const yp = (i / 6) * H;
      ctx.beginPath(); ctx.moveTo(xp, 0); ctx.lineTo(xp, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, yp); ctx.lineTo(W, yp); ctx.stroke();
    }

    // 3. Resource nodes (only inside explored areas)
    if (this.world) {
      this.world.trees.forEach(t => {
        if (t.harvested || !explorationTracker.isExplored(t.position.x, t.position.z)) return;
        const p = toMap(t.position.x, t.position.z);
        if (p.x < -10 || p.x > W + 10 || p.y < -10 || p.y > H + 10) return;
        ctx.fillStyle = '#2d6a30';
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1.5, 2.5 * this.zoom), 0, Math.PI * 2);
        ctx.fill();
      });

      this.world.stones.forEach(s => {
        if (s.harvested || !explorationTracker.isExplored(s.position.x, s.position.z)) return;
        const p = toMap(s.position.x, s.position.z);
        if (p.x < -10 || p.x > W + 10 || p.y < -10 || p.y > H + 10) return;
        ctx.fillStyle = '#7f8c8d';
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1.5, 2.5 * this.zoom), 0, Math.PI * 2);
        ctx.fill();
      });

      this.world.bushes.forEach(b => {
        if (b.harvested || !explorationTracker.isExplored(b.position.x, b.position.z)) return;
        const p = toMap(b.position.x, b.position.z);
        if (p.x < -10 || p.x > W + 10 || p.y < -10 || p.y > H + 10) return;
        ctx.fillStyle = '#8e244d';
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1.5, 2.0 * this.zoom), 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // 4. Major Cities & Landmarks (visible as player explores)
    const isFi = Localization.lang === 'fi';
    const landmarks = [
      { name: isFi ? '🏰 Tuulentörmä' : '🏰 Windridge City', x: 0, z: -10, color: '#f1c40f' },
      { name: isFi ? '⚓ Kalliosatama' : '⚓ Crag Seaport', x: -140, z: 45, color: '#3498db' },
      { name: isFi ? '🔮 Riimulaakso' : '🔮 Rune Vale City', x: 135, z: -60, color: '#9b59b6' },
      { name: isFi ? '🏔️ Sysiharju' : '🏔️ Ash Peak Citadel', x: -40, z: -180, color: '#e67e22' },
      { name: isFi ? '🌲 Metsävartion Torni' : '🌲 Highland Watchtower', x: 35, z: -62, color: '#2ecc71' },
      { name: isFi ? '✨ Muinainen Alttari' : '✨ Ancient Altar', x: 85, z: -25, color: '#00d4ff' },
      { name: isFi ? '🌉 Suuri Jokisilta' : '🌉 Great River Bridge', x: -2, z: 28, color: '#bdc3c7' }
    ];
    landmarks.forEach(lm => {
      if (!explorationTracker.isExplored(lm.x, lm.z)) return;
      const p = toMap(lm.x, lm.z);
      if (p.x < -60 || p.x > W + 60 || p.y < -60 || p.y > H + 60) return;

      const tagW = Math.max(90, 105 * Math.min(1.2, this.zoom));
      ctx.fillStyle = 'rgba(8, 14, 22, 0.88)';
      ctx.fillRect(p.x - tagW / 2, p.y - 13, tagW, 18);
      ctx.strokeStyle = lm.color;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(p.x - tagW / 2, p.y - 13, tagW, 18);

      ctx.fillStyle = lm.color;
      ctx.font = 'bold 9.5px Cinzel, serif';
      ctx.textAlign = 'center';
      ctx.fillText(lm.name, p.x, p.y);
    });

    // 5. Boss Markers (Legendary Boss Arenas with Sequential Progression)
    if (this.bossManager && this.bossManager.getBossMarkers) {
      const bossMarkers = this.bossManager.getBossMarkers();
      bossMarkers.forEach(bm => {
        const p = toMap(bm.x, bm.z);
        if (p.x < -60 || p.x > W + 60 || p.y < -60 || p.y > H + 60) return;

        const isDefeated = bm.status === 'defeated';
        const isActive = bm.status === 'active';

        // Boss arena circle
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(12, 18 * this.zoom), 0, Math.PI * 2);

        if (isDefeated) {
          ctx.fillStyle = 'rgba(46, 204, 113, 0.16)';
          ctx.strokeStyle = '#2ecc71';
        } else if (isActive) {
          ctx.fillStyle = 'rgba(231, 76, 60, 0.35)';
          ctx.strokeStyle = '#e74c3c';
        } else {
          ctx.fillStyle = 'rgba(127, 140, 141, 0.15)';
          ctx.strokeStyle = '#7f8c8d';
        }

        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);

        // Center arena symbol
        ctx.font = `${Math.max(11, 14 * this.zoom)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const symbol = isDefeated ? '👑' : (isActive ? '🔥' : '🔒');
        ctx.fillText(symbol, p.x, p.y);
        ctx.restore();

        // Label box
        let tag = isFi ? '🔒 LUKITTU' : '🔒 LOCKED';
        let tagColor = '#95a5a6';
        if (isDefeated) {
          tag = isFi ? '👑 KUKISTETTU' : '👑 DEFEATED';
          tagColor = '#2ecc71';
        } else if (isActive) {
          tag = isFi ? '🔥 TAVOITE: AKTIIVINEN' : '🔥 ACTIVE TARGET';
          tagColor = '#e67e22';
        }

        ctx.fillStyle = 'rgba(10, 15, 20, 0.92)';
        ctx.fillRect(p.x - 70, p.y - 28, 140, 22);
        ctx.strokeStyle = tagColor;
        ctx.lineWidth = 1.2;
        ctx.strokeRect(p.x - 70, p.y - 28, 140, 22);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8.5px Cinzel, serif';
        ctx.textAlign = 'center';
        ctx.fillText(bm.name.split('–')[0].trim(), p.x, p.y - 17);

        ctx.fillStyle = tagColor;
        ctx.font = 'bold 7.5px sans-serif';
        ctx.fillText(`${bm.biome} • ${tag}`, p.x, p.y - 9);
      });
    }

    // 6. Campfires
    if (this.buildingSystem && this.buildingSystem.campfires) {
      this.buildingSystem.campfires.forEach(camp => {
        if (!explorationTracker.isExplored(camp.position.x, camp.position.z)) return;
        const p = toMap(camp.position.x, camp.position.z);
        ctx.fillStyle = '#f39c12';
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(2, 3.5 * this.zoom), 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // 7. NPCs
    if (this.npcManager && this.npcManager.npcs) {
      this.npcManager.npcs.forEach(npc => {
        if (!npc.mesh || !explorationTracker.isExplored(npc.mesh.position.x, npc.mesh.position.z)) return;
        const p = toMap(npc.mesh.position.x, npc.mesh.position.z);
        ctx.fillStyle = '#9b59b6';
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(3, 4.5 * this.zoom), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    }

    // 8. Player Gravestones / Tombstones (🪦 Hautakivi)
    if (this.world && this.world.tombstones) {
      const isFi = (typeof Localization !== 'undefined' && Localization.lang === 'en') ? false : true;
      this.world.tombstones.forEach(tomb => {
        const p = toMap(tomb.position.x, tomb.position.z);
        if (p.x < -40 || p.x > W + 40 || p.y < -40 || p.y > H + 40) return;

        ctx.save();
        ctx.fillStyle = 'rgba(231, 76, 60, 0.35)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(10, 14 * this.zoom), 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(15, 20, 25, 0.9)';
        ctx.fillRect(p.x - 46, p.y - 24, 92, 18);
        ctx.strokeStyle = '#ff4757';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(p.x - 46, p.y - 24, 92, 18);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px Cinzel, serif';
        ctx.textAlign = 'center';
        ctx.fillText(isFi ? '🪦 HAUTAKIVI' : '🪦 GRAVESTONE', p.x, p.y - 12);
        ctx.restore();
      });
    }

    // 9. Prominent Player Navigation Compass Arrow (Always Visible)
    if (this.player) {
      const pPos = this.player.getPosition ? this.player.getPosition() : this.player.playerPos;
      if (pPos) {
        const p = toMap(pPos.x, pPos.z);
        if (this.camera && this._camDir) {
          this.camera.getWorldDirection(this._camDir);
        } else if (this._camDir) {
          this._camDir.set(0, 0, -1);
        }

        // Precise mathematical orientation in 2D canvas space (+x right, +y down)
        const headingCanvas = this._camDir ? (Math.atan2(this._camDir.z, this._camDir.x) + Math.PI / 2) : 0;

        ctx.save();
        ctx.translate(p.x, p.y);

        // 1. Vision Cone (semi-transparent forward sector showing line of sight)
        ctx.save();
        ctx.rotate(headingCanvas);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 36 * Math.min(1.4, this.zoom), -Math.PI / 2 - 0.52, -Math.PI / 2 + 0.52);
        ctx.closePath();
        ctx.fillStyle = 'rgba(0, 210, 211, 0.18)';
        ctx.fill();
        ctx.restore();

        // 2. Animated Pulsing Radar Beacon
        const t = performance.now() * 0.003;
        const pulseR1 = 12 + (Math.sin(t) * 0.5 + 0.5) * 14;
        const pulseR2 = 8 + (Math.sin(t + 1.5) * 0.5 + 0.5) * 10;
        ctx.beginPath();
        ctx.arc(0, 0, pulseR1, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(46, 204, 113, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, pulseR2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(46, 204, 113, 0.25)';
        ctx.fill();

        // 3. Sleek, Bold Directional Navigation Chevron Arrow
        ctx.save();
        ctx.rotate(headingCanvas);

        // Navigation arrow shadow/drop outline
        ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 2;

        ctx.beginPath();
        ctx.moveTo(0, -16);
        ctx.lineTo(9.5, 9);
        ctx.lineTo(0, 4);
        ctx.lineTo(-9.5, 9);
        ctx.closePath();

        // Vibrant gradient fill (Golden amber top to cyan blade bottom)
        const grad = ctx.createLinearGradient(0, -16, 0, 9);
        grad.addColorStop(0, '#f1c40f');
        grad.addColorStop(0.6, '#00d2d3');
        grad.addColorStop(1, '#0984e3');
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.0;
        ctx.stroke();

        // Center spine accent
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.lineTo(0, 4);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();

        // 4. Player Badge Label
        const isFi = (typeof Localization !== 'undefined' && Localization.lang === 'en') ? false : true;
        const badgeText = isFi ? '🚩 SINÄ' : '🚩 YOU';
        ctx.font = 'bold 8.5px Cinzel, sans-serif';
        const txtW = ctx.measureText(badgeText).width;

        ctx.fillStyle = 'rgba(8, 14, 20, 0.9)';
        ctx.fillRect(-txtW / 2 - 6, 16, txtW + 12, 14);
        ctx.strokeStyle = '#f1c40f';
        ctx.lineWidth = 1;
        ctx.strokeRect(-txtW / 2 - 6, 16, txtW + 12, 14);

        ctx.fillStyle = '#f1c40f';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, 0, 23);

        ctx.restore();
      }
    }

    // Outer border frame
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.5)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }
}
