/**
 * MapScreen – Full-screen interactive map opened with [M].
 * Features:
 * - Zoom in / out (mouse wheel & +/- buttons)
 * - Drag pan (click and drag)
 * - Fog of War: only revealed explored areas are visible
 * - Coordinates & active quests display
 */
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
      if (e.code === 'KeyM') {
        e.preventDefault();
        this.toggle();
      }
      if (e.code === 'Escape' && this.isOpen) this.close();
    });

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
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

      // Drag to Pan
      this.canvasEl.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
          this.isDragging = true;
          this.dragStart = { x: e.clientX, y: e.clientY };
          this.panStart = { x: this.pan.x, z: this.pan.z };
          this.canvasEl.style.cursor = 'grabbing';
        }
      });
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
    if (this.canvasEl) this.canvasEl.style.cursor = 'grab';

    // Center map on player upon opening
    if (this.player) {
      const pPos = this.player.getPosition();
      this.pan.x = pPos.x;
      this.pan.z = pPos.z;
    }

    this._buildLegend();
    this._updateQuests();
    this.draw();
  }

  close() {
    this.isOpen = false;
    this.isDragging = false;
    if (this.overlayEl) this.overlayEl.classList.remove('active');
    setTimeout(() => {
      const mainMenu = document.getElementById('main-menu');
      const isMenu = mainMenu && mainMenu.style.display !== 'none';
      if (!isMenu && this.controls && !this.controls.isLocked) {
        this.controls.lock();
      }
    }, 60);
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

    // 4. Landmarks (only if explored)
    const landmarks = [
      { name: '🏛️ Keskuskylä', x: 0, z: -10, color: '#f1c40f' },
      { name: '⚓ Satamakylä', x: -22, z: 32, color: '#3498db' },
      { name: '🏰 Metsävartion Linnake', x: 35, z: -62, color: '#e67e22' },
      { name: '🔮 Muinainen Pyhäkkö', x: 85, z: -25, color: '#00d4ff' },
      { name: '🌉 Jokisilta', x: -2, z: 28, color: '#bdc3c7' }
    ];
    landmarks.forEach(lm => {
      if (!explorationTracker.isExplored(lm.x, lm.z)) return;
      const p = toMap(lm.x, lm.z);
      if (p.x < -40 || p.x > W + 40 || p.y < -40 || p.y > H + 40) return;

      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(p.x - 48, p.y - 12, 96, 17);
      ctx.strokeStyle = lm.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(p.x - 48, p.y - 12, 96, 17);

      ctx.fillStyle = lm.color;
      ctx.font = 'bold 9.5px Cinzel, serif';
      ctx.textAlign = 'center';
      ctx.fillText(lm.name, p.x, p.y);
    });

    // 5. Boss Markers (once discovered or defeated)
    if (this.bossManager && this.bossManager.getBossMarkers) {
      const bossMarkers = this.bossManager.getBossMarkers();
      bossMarkers.forEach(bm => {
        if (!explorationTracker.isExplored(bm.x, bm.z) && bm.status !== 'defeated') return;
        const p = toMap(bm.x, bm.z);
        if (p.x < -60 || p.x > W + 60 || p.y < -60 || p.y > H + 60) return;

        // Boss arena circle
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(12, 18 * this.zoom), 0, Math.PI * 2);
        ctx.fillStyle = bm.status === 'defeated' ? 'rgba(46, 204, 113, 0.16)' : 'rgba(231, 76, 60, 0.28)';
        ctx.strokeStyle = bm.status === 'defeated' ? '#2ecc71' : '#e74c3c';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // Label box
        const tag = bm.status === 'defeated' ? '👑 KUKISTETTU' : '🔥 AKTIIVINEN';
        const tagColor = bm.status === 'defeated' ? '#2ecc71' : '#ff7675';

        ctx.fillStyle = 'rgba(10, 15, 20, 0.9)';
        ctx.fillRect(p.x - 60, p.y - 26, 120, 20);
        ctx.strokeStyle = tagColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(p.x - 60, p.y - 26, 120, 20);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8.5px Cinzel, serif';
        ctx.textAlign = 'center';
        ctx.fillText(bm.name.split('–')[0].trim(), p.x, p.y - 15);

        ctx.fillStyle = tagColor;
        ctx.font = 'bold 7.5px sans-serif';
        ctx.fillText(`${bm.biome} • ${tag}`, p.x, p.y - 8);
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

    // 8. Player marker (always visible)
    if (this.player) {
      const pPos = this.player.getPosition();
      const p = toMap(pPos.x, pPos.z);
      const camDir = new THREE.Vector3();
      if (this.camera) this.camera.getWorldDirection(camDir);
      const heading = Math.atan2(camDir.x, -camDir.z);

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(heading);

      // Pulse circle
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(7, 10 * this.zoom), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(46, 204, 113, 0.25)';
      ctx.fill();

      // Heading triangle
      ctx.fillStyle = '#2ecc71';
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(6, 7);
      ctx.lineTo(-6, 7);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.restore();
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
