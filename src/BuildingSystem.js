import * as THREE from 'three';

export default class BuildingSystem {
  constructor(scene, inventory, hud, audioManager, assetLoader = null, controls = null) {
    this.scene = scene;
    this.inventory = inventory;
    this.hud = hud;
    this.audioManager = audioManager;
    this.assetLoader = assetLoader || null;
    this.controls = controls || null;

    this.selectedStructure = null;
    this.previewMesh = null;
    this.placedStructures = [];
    this.placedColliders = [];
    this.campfires = [];
    this.onPlace = null; // callback(structureType)

    this.raycaster = new THREE.Raycaster();
    this.screenCenter = new THREE.Vector2(0, 0);

    this.currentRotation = 0;

    // Full catalog of 18 craftable structures grouped into clear survival categories
    this.structureDefs = [
      // 🪵 RAKENTEET
      { id: 'woodenWall', category: 'structures', wood: 5, stone: 0, name: 'Hirsiseinä', icon: '🪵', desc: 'Tukeva hirsiseinä suojaksi' },
      { id: 'stoneWall', category: 'structures', wood: 0, stone: 6, name: 'Kivimuuri', icon: '🧱', desc: 'Vahva graniittimuuri' },
      { id: 'woodenFloor', category: 'structures', wood: 4, stone: 0, name: 'Lankkulattia', icon: '🪚', desc: 'Sileä puulattia asumuksen pohjaksi' },
      { id: 'stoneFloor', category: 'structures', wood: 0, stone: 4, name: 'Kivilattia', icon: '🏛️', desc: 'Tasainen kivilattia tulisijoille ja pajoille' },
      { id: 'woodenRoof', category: 'structures', wood: 6, stone: 2, name: 'Harjakatto', icon: '🏠', desc: 'Suojaa sateelta ja antaa Levännyt-bonuksen' },
      { id: 'woodenStairs', category: 'structures', wood: 4, stone: 0, name: 'Puuportaat', icon: '🪜', desc: 'Portaat toiseen kerrokseen tai torniin' },
      { id: 'woodenDoor', category: 'structures', wood: 4, stone: 0, name: 'Salpaovi', icon: '🚪', desc: 'Avattava linnoituksen ovi' },
      { id: 'palisade', category: 'structures', wood: 6, stone: 0, name: 'Paaluaita', icon: '🛡️', desc: 'Teräväkärkinen suojamuuri kylän ympärille' },
      
      // 🔥 TULI & VALO
      { id: 'campfire', category: 'fire', wood: 4, stone: 3, name: 'Leirituli', icon: '🔥', desc: 'Lämmittele, paista lihaa ja poista väsymys' },
      { id: 'standingTorch', category: 'fire', wood: 2, stone: 1, name: 'Soihtuteline', icon: '🕯️', desc: 'Valaisee pihan ja karkottaa petoja' },

      // 🛠️ TYÖPAJAT & VARASTO
      { id: 'workbench', category: 'crafting', wood: 8, stone: 4, name: 'Työpöytä', icon: '🛠️', desc: 'Avaa aseiden ja työkalujen valmistuksen' },
      { id: 'smelter', category: 'crafting', wood: 4, stone: 12, name: 'Sulattouuni', icon: '🌋', desc: 'Sulata kuparia ja rautamalmia harkoiksi' },
      { id: 'forge', category: 'crafting', wood: 6, stone: 8, name: 'Ahjo & Alasin', icon: '🔨', desc: 'Tako pronssi-, rauta- ja teräsvarusteita' },
      { id: 'chest', category: 'crafting', wood: 6, stone: 0, name: 'Puuarkku', icon: '📦', desc: 'Säilytä ylimääräisiä resursseja' },
      { id: 'barrel', category: 'crafting', wood: 5, stone: 1, name: 'Viljatynnyri', icon: '🛢️', desc: 'Säilytystynnyri viljalle ja ruualle' },

      // 🛏️ HUONEKALUT
      { id: 'bed', category: 'furniture', wood: 6, stone: 0, name: 'Viking-Sänky', icon: '🛏️', desc: 'Nuku yön yli ja palauta hahmon energia' },
      { id: 'table', category: 'furniture', wood: 5, stone: 0, name: 'Pirtin Pöytä', icon: '🪵', desc: 'Lisää kodin mukavuutta' },
      { id: 'chair', category: 'furniture', wood: 3, stone: 0, name: 'Tammipenkki', icon: '🪑', desc: 'Istu ja nauti lämpimästä leiritulesta' }
    ];

    this.structureKeys = this.structureDefs.map(d => d.id);
    this.currentStructureIndex = 0; // 'woodenWall'
    this.isHammerActive = false;
    this.isBuildMenuOpen = false;
    this.currentCategory = 'all';

    this.recipes = {};
    this.structureDefs.forEach(d => {
      this.recipes[d.id] = {
        wood: d.wood,
        stone: d.stone,
        name: `${d.icon} ${d.name}`
      };
    });

    this._initUI();
    this.setupListeners();
  }

  _initUI() {
    // 1. Floating Build Selector HUD Bar (Positioned above Hotbar when hammer is equipped)
    let hudBar = document.getElementById('build-selector-hud');
    if (!hudBar) {
      hudBar = document.createElement('div');
      hudBar.id = 'build-selector-hud';
      hudBar.className = 'build-selector-hud-container';
      hudBar.style.display = 'none';
      hudBar.innerHTML = `
        <button id="b-hud-prev" class="b-hud-btn b-hud-arrow" title="Edellinen pala [Q]">◀ [Q]</button>
        <div id="b-hud-active-info" class="b-hud-info-box">
          <span id="b-hud-icon" class="b-hud-icon">🪵</span>
          <div class="b-hud-text-col">
            <span id="b-hud-name" class="b-hud-name">Hirsiseinä</span>
            <span id="b-hud-cost" class="b-hud-cost">🪵 5 Puuta</span>
          </div>
        </div>
        <button id="b-hud-next" class="b-hud-btn b-hud-arrow" title="Seuraava pala [E]">[E] ▶</button>
        <button id="b-hud-rot" class="b-hud-btn b-hud-action" title="Käännä palaa 90° [R]">🔄 Käännä [R]</button>
        <button id="b-hud-menu" class="b-hud-btn b-hud-menu-btn" title="Avaa koko rakennusvalikko [B]">⚒️ Valikko [B]</button>
      `;
      document.body.appendChild(hudBar);

      // Event listeners for UI buttons (touch & mouse friendly)
      const prevBtn = hudBar.querySelector('#b-hud-prev');
      const nextBtn = hudBar.querySelector('#b-hud-next');
      const rotBtn = hudBar.querySelector('#b-hud-rot');
      const menuBtn = hudBar.querySelector('#b-hud-menu');

      prevBtn.addEventListener('click', (e) => { e.stopPropagation(); this.cycleStructure(-1); });
      nextBtn.addEventListener('click', (e) => { e.stopPropagation(); this.cycleStructure(1); });
      rotBtn.addEventListener('click', (e) => { e.stopPropagation(); this.rotate(); });
      menuBtn.addEventListener('click', (e) => { e.stopPropagation(); this.toggleBuildMenu(); });
    }
    this.hudBarEl = hudBar;

    // 2. Full Valheim Building Selector Grid Modal
    let modal = document.getElementById('build-menu-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'build-menu-modal';
      modal.className = 'menu-modal build-modal-overlay';
      modal.style.display = 'none';
      modal.innerHTML = `
        <div class="modal-box modal-box-wide build-modal-box">
          <div class="modal-header">
            <div class="build-modal-header-title">
              <h2>⚒️ RAKENNUSVALIKKO (VALHEIM)</h2>
              <span class="build-modal-subtitle">Valitse rakennettava kohde vasaralla sijoitettavaksi</span>
            </div>
            <button id="close-build-menu-btn" class="modal-close">✕</button>
          </div>

          <div class="build-tabs-row">
            <button class="build-tab-btn active" data-cat="all">Kaikki (18)</button>
            <button class="build-tab-btn" data-cat="structures">🪵 Rakenteet (8)</button>
            <button class="build-tab-btn" data-cat="fire">🔥 Tuli &amp; Valo (2)</button>
            <button class="build-tab-btn" data-cat="crafting">🛠️ Pajat &amp; Varasto (5)</button>
            <button class="build-tab-btn" data-cat="furniture">🛏️ Huonekalut (3)</button>
          </div>

          <div id="build-modal-grid" class="build-modal-cards-grid">
            <!-- Rendered dynamically -->
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      modal.querySelector('#close-build-menu-btn').addEventListener('click', () => {
        this.closeBuildMenu();
      });

      modal.querySelectorAll('.build-tab-btn').forEach(tabBtn => {
        tabBtn.addEventListener('click', (e) => {
          modal.querySelectorAll('.build-tab-btn').forEach(b => b.classList.remove('active'));
          tabBtn.classList.add('active');
          this.currentCategory = tabBtn.getAttribute('data-cat') || 'all';
          this.renderBuildMenuGrid();
        });
      });
    }
    this.modalEl = modal;
  }

  updateSelectorBar() {
    if (!this.hudBarEl) return;
    const def = this.structureDefs[this.currentStructureIndex];
    if (!def) return;

    const iconEl = this.hudBarEl.querySelector('#b-hud-icon');
    const nameEl = this.hudBarEl.querySelector('#b-hud-name');
    const costEl = this.hudBarEl.querySelector('#b-hud-cost');

    if (iconEl) iconEl.textContent = def.icon;
    if (nameEl) nameEl.textContent = def.name;

    if (costEl && this.inventory) {
      const woodHave = this.inventory.items?.wood || 0;
      const stoneHave = this.inventory.items?.stone || 0;
      let costParts = [];
      if (def.wood > 0) {
        const ok = woodHave >= def.wood;
        costParts.push(`<span class="${ok ? 'cost-ok' : 'cost-missing'}">🪵 ${def.wood} Puu (${woodHave})</span>`);
      }
      if (def.stone > 0) {
        const ok = stoneHave >= def.stone;
        costParts.push(`<span class="${ok ? 'cost-ok' : 'cost-missing'}">🪨 ${def.stone} Kivi (${stoneHave})</span>`);
      }
      costEl.innerHTML = costParts.join(' &bull; ');
    }
  }

  cycleStructure(dir) {
    this.currentStructureIndex = (this.currentStructureIndex + dir + this.structureKeys.length) % this.structureKeys.length;
    const def = this.structureDefs[this.currentStructureIndex];
    this.startPlacing(def.id);
    this.updateSelectorBar();
    if (this.audioManager && this.audioManager.playClick) {
      this.audioManager.playClick();
    }
    if (this.hud) {
      this.hud.showNotification(`🔨 Valittu: ${def.icon} ${def.name}`, 1200);
    }
  }

  rotate() {
    this.currentRotation = (this.currentRotation + Math.PI / 2) % (Math.PI * 2);
    if (this.previewMesh) {
      this.previewMesh.rotation.y = this.currentRotation;
    }
    if (this.audioManager && this.audioManager.playClick) {
      this.audioManager.playClick();
    }
    if (this.hud) {
      this.hud.showNotification(`🔄 Käännetty 90°`, 800);
    }
  }

  setHammerActive(active) {
    this.isHammerActive = active;
    if (this.hudBarEl) {
      this.hudBarEl.style.display = active ? 'flex' : 'none';
    }

    if (active) {
      const def = this.structureDefs[this.currentStructureIndex];
      this.startPlacing(def.id);
      this.updateSelectorBar();
    } else {
      this.cancelPlacing();
      this.closeBuildMenu();
    }
  }

  openBuildMenu() {
    this.isBuildMenuOpen = true;
    if (this.modalEl) {
      this.modalEl.style.display = 'flex';
      this.renderBuildMenuGrid();
    }
    if (this.controls) {
      this.controls.unlock();
    }
  }

  closeBuildMenu() {
    this.isBuildMenuOpen = false;
    if (this.modalEl) {
      this.modalEl.style.display = 'none';
    }
  }

  toggleBuildMenu() {
    if (this.isBuildMenuOpen) {
      this.closeBuildMenu();
    } else {
      this.openBuildMenu();
    }
  }

  renderBuildMenuGrid() {
    if (!this.modalEl) return;
    const gridEl = this.modalEl.querySelector('#build-modal-grid');
    if (!gridEl) return;

    const cat = this.currentCategory || 'all';
    const list = this.structureDefs.filter(d => cat === 'all' || d.category === cat);

    const woodHave = this.inventory?.items?.wood || 0;
    const stoneHave = this.inventory?.items?.stone || 0;

    gridEl.innerHTML = list.map(def => {
      const isSelected = this.structureKeys[this.currentStructureIndex] === def.id;
      const canAffordWood = def.wood === 0 || woodHave >= def.wood;
      const canAffordStone = def.stone === 0 || stoneHave >= def.stone;
      const canAfford = canAffordWood && canAffordStone;

      return `
        <div class="build-card ${isSelected ? 'selected' : ''} ${canAfford ? 'affordable' : 'unaffordable'}" data-structure-id="${def.id}">
          <div class="build-card-top">
            <span class="build-card-icon">${def.icon}</span>
            <span class="build-card-tag">${def.category.toUpperCase()}</span>
          </div>
          <div class="build-card-title">${def.name}</div>
          <div class="build-card-desc">${def.desc}</div>
          <div class="build-card-costs">
            ${def.wood > 0 ? `<span class="build-cost-pill ${canAffordWood ? 'ok' : 'missing'}">🪵 ${def.wood} (${woodHave})</span>` : ''}
            ${def.stone > 0 ? `<span class="build-cost-pill ${canAffordStone ? 'ok' : 'missing'}">🪨 ${def.stone} (${stoneHave})</span>` : ''}
          </div>
          <button class="build-card-btn ${canAfford ? 'btn-can-build' : 'btn-lacking'}">
            ${isSelected ? '✅ Valittuna' : (canAfford ? 'Valitse pala' : 'Puuttuu resursseja')}
          </button>
        </div>
      `;
    }).join('');

    // Attach click handlers to select structure
    gridEl.querySelectorAll('.build-card').forEach(card => {
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = card.getAttribute('data-structure-id');
        const idx = this.structureKeys.indexOf(id);
        if (idx !== -1) {
          this.currentStructureIndex = idx;
          this.startPlacing(id);
          this.updateSelectorBar();
          this.closeBuildMenu();
          if (this.hud) {
            const def = this.structureDefs[idx];
            this.hud.showNotification(`🔨 Valittu: ${def.icon} ${def.name}`);
          }
        }
      });
    });
  }

  setupListeners() {
    const hudBuildBtn = document.getElementById('open-build-btn');
    if (hudBuildBtn) {
      hudBuildBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.inventory && this.inventory.tools && this.inventory.tools.hammer) {
          if (this.inventory.hotbar) {
            this.inventory.hotbar.selectSlot(4, true);
          } else {
            this.setHammerActive(true);
          }
        }
        this.toggleBuildMenu();
      });
    }

    window.addEventListener('keydown', (e) => {
      // Ignore if typing in input/textarea
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;

      // Close menu with ESC
      if (e.code === 'Escape') {
        if (this.isBuildMenuOpen) {
          this.closeBuildMenu();
          return;
        }
        if (this.isPlacing()) {
          this.cancelPlacing();
          return;
        }
      }

      // [B] Key: Toggle Building Menu / Place Mode
      if (e.code === 'KeyB') {
        if (this.isHammerActive || this.isPlacing()) {
          this.toggleBuildMenu();
        } else {
          // If hammer is in inventory, equip it and open building
          if (this.inventory && this.inventory.tools && this.inventory.tools.hammer) {
            if (this.inventory.hotbar) {
              this.inventory.hotbar.selectSlot(4, true);
            } else {
              this.setHammerActive(true);
            }
          } else {
            if (this.hud) this.hud.showNotification('⚠️ Sinulla ei ole Rakennusvasaraa! Valmista se painamalla [C].');
          }
        }
        return;
      }

      // Controls when hammer is active or placing
      if (this.isHammerActive || this.isPlacing()) {
        // [Q] Previous structure piece
        if (e.code === 'KeyQ') {
          this.cycleStructure(-1);
          return;
        }
        // [E] Next structure piece (when hammer is active)
        if (e.code === 'KeyE') {
          this.cycleStructure(1);
          return;
        }
        // [R] Rotate structure 90 degrees
        if (e.code === 'KeyR') {
          this.rotate();
          return;
        }
      }
    });

    window.addEventListener('mousedown', (e) => {
      if (e.button === 2) { // Right click
        if (this.isBuildMenuOpen) {
          this.closeBuildMenu();
          return;
        }
        if (this.isPlacing()) {
          this.cancelPlacing();
        } else if (this.isHammerActive) {
          this.openBuildMenu();
        }
      }
    });

    window.addEventListener('contextmenu', (e) => {
      if (this.isPlacing() || this.isHammerActive || this.isBuildMenuOpen) {
        e.preventDefault();
      }
    });
  }

  isPlacing() {
    return this.selectedStructure !== null;
  }

  startPlacing(type) {
    const idx = this.structureKeys.indexOf(type);
    if (idx !== -1) {
      this.currentStructureIndex = idx;
    }

    const recipe = this.recipes[type];
    if (!recipe) return;

    this.cancelPlacing();

    this.selectedStructure = type;
    const canAfford = this.canAfford(recipe);
    this.previewMesh = this.createStructureMesh(type, true, canAfford);
    this.previewMesh.rotation.y = this.currentRotation;
    this.scene.add(this.previewMesh);

    this.updateSelectorBar();

    if (this.hud) {
      const def = this.structureDefs[this.currentStructureIndex];
      this.hud.showTooltip(`[LMB] Rakenna: ${recipe.name} | [Q / E] Selaa | [R] Käännä | [B] Valikko | [RMB] Peruuta`);
    }
  }

  cancelPlacing() {
    if (this.previewMesh) {
      this.scene.remove(this.previewMesh);
      this.previewMesh = null;
    }
    this.selectedStructure = null;
    if (this.hud) {
      this.hud.hideTooltip();
    }
  }

  canAfford(recipe) {
    if (!recipe) return false;
    if (recipe.wood && !this.inventory.has('wood', recipe.wood)) return false;
    if (recipe.stone && !this.inventory.has('stone', recipe.stone)) return false;
    return true;
  }

  createStructureMesh(type, isPreview = false, canAfford = true) {
    const group = new THREE.Group();

    const previewMat = isPreview
      ? new THREE.MeshBasicMaterial({
          color: canAfford ? 0x3498db : 0xe74c3c,
          wireframe: true,
          transparent: true,
          opacity: 0.65
        })
      : null;

    if (type === 'campfire') {
      const cauldronModel = this.assetLoader ? this.assetLoader.get('Cauldron') : null;

      if (cauldronModel) {
        cauldronModel.position.set(0, 0, 0);
        cauldronModel.scale.set(1.1, 1.1, 1.1);

        if (isPreview) {
          cauldronModel.traverse(child => {
            if (child.isMesh) child.material = previewMat;
          });
        } else {
          cauldronModel.traverse(child => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
        }
        group.add(cauldronModel);

        // Embers inside cauldron
        const emberMat = isPreview ? previewMat : new THREE.MeshBasicMaterial({ color: 0xff4500 });
        const emberGeo = new THREE.DodecahedronGeometry(0.3, 0);
        const embers = new THREE.Mesh(emberGeo, emberMat);
        embers.position.set(0, 0.45, 0);
        group.add(embers);

        // Active campfire warm point light
        if (!isPreview) {
          const fireLight = new THREE.PointLight(0xff6600, 2.5, 14, 2);
          fireLight.position.set(0, 0.8, 0);
          fireLight.castShadow = true;
          group.add(fireLight);

          this.campfires.push({
            light: fireLight,
            baseIntensity: 2.5,
            seed: Math.random() * 100,
            position: group.position
          });
        }
      } else {
        // Fallback procedural campfire
        const stoneMat = previewMat || new THREE.MeshLambertMaterial({ color: 0x5a6268 });
        const ringGeo = new THREE.TorusGeometry(0.7, 0.18, 6, 12);
        ringGeo.rotateX(Math.PI / 2);
        const ring = new THREE.Mesh(ringGeo, stoneMat);
        ring.position.y = 0.18;
        if (!isPreview) ring.castShadow = true;
        group.add(ring);

        // Wooden logs criss-cross
        const logMat = previewMat || new THREE.MeshLambertMaterial({ color: 0x6e2c00 });
        const logGeo = new THREE.CylinderGeometry(0.09, 0.09, 1.0, 6);
        logGeo.rotateZ(Math.PI / 2);

        const log1 = new THREE.Mesh(logGeo, logMat);
        log1.position.set(0, 0.22, 0);
        log1.rotation.y = 0.6;
        group.add(log1);

        const log2 = new THREE.Mesh(logGeo, logMat);
        log2.position.set(0, 0.24, 0);
        log2.rotation.y = -0.7;
        group.add(log2);

        // Embers in center
        const emberMat = previewMat || new THREE.MeshBasicMaterial({ color: 0xff4500 });
        const emberGeo = new THREE.DodecahedronGeometry(0.28, 0);
        const embers = new THREE.Mesh(emberGeo, emberMat);
        embers.position.set(0, 0.3, 0);
        group.add(embers);

        if (!isPreview) {
          const fireLight = new THREE.PointLight(0xff6600, 2.5, 14, 2);
          fireLight.position.set(0, 0.8, 0);
          fireLight.castShadow = true;
          group.add(fireLight);

          this.campfires.push({
            light: fireLight,
            baseIntensity: 2.5,
            seed: Math.random() * 100,
            position: group.position
          });
        }
      }
    } else if (type === 'woodenWall') {
      const wallModel = this.assetLoader ? this.assetLoader.get('Wall_Plaster_Straight') : null;

      if (wallModel) {
        wallModel.scale.set(1.2, 1.0, 1.2);
        if (isPreview) {
          wallModel.traverse(child => {
            if (child.isMesh) child.material = previewMat;
          });
        } else {
          wallModel.traverse(child => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
        }
        group.add(wallModel);
      } else {
        // Fallback procedural wall
        const wallMat = previewMat || new THREE.MeshLambertMaterial({ color: 0x85532a });
        const wallGeo = new THREE.BoxGeometry(2.4, 2.8, 0.25);
        wallGeo.translate(0, 1.4, 0);
        const wallMesh = new THREE.Mesh(wallGeo, wallMat);
        if (!isPreview) {
          wallMesh.castShadow = true;
          wallMesh.receiveShadow = true;
        }
        group.add(wallMesh);
      }
    } else if (type === 'woodenFloor') {
      const floorModel = this.assetLoader ? this.assetLoader.get('Floor_WoodDark') : null;

      if (floorModel) {
        floorModel.scale.set(1.3, 1.0, 1.3);
        if (isPreview) {
          floorModel.traverse(child => {
            if (child.isMesh) child.material = previewMat;
          });
        } else {
          floorModel.traverse(child => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
        }
        group.add(floorModel);
      } else {
        // Fallback procedural floor
        const floorMat = previewMat || new THREE.MeshLambertMaterial({ color: 0x9c6644 });
        const floorGeo = new THREE.BoxGeometry(2.6, 0.18, 2.6);
        floorGeo.translate(0, 0.09, 0);
        const floorMesh = new THREE.Mesh(floorGeo, floorMat);
        if (!isPreview) {
          floorMesh.castShadow = true;
          floorMesh.receiveShadow = true;
        }
        group.add(floorMesh);
      }
    } else if (type === 'woodenRoof') {
      const roofModel = this.assetLoader ? this.assetLoader.get('Roof_RoundTiles_4x4') : null;
      if (roofModel) {
        roofModel.scale.set(1.1, 1.1, 1.1);
        if (isPreview) {
          roofModel.traverse(c => { if (c.isMesh) c.material = previewMat; });
        } else {
          roofModel.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
        }
        group.add(roofModel);
      }
    } else if (type === 'woodenStairs') {
      const stairsModel = this.assetLoader ? this.assetLoader.get('Stairs_Exterior_Straight') : null;
      if (stairsModel) {
        stairsModel.scale.set(1.0, 1.0, 1.0);
        if (isPreview) {
          stairsModel.traverse(c => { if (c.isMesh) c.material = previewMat; });
        } else {
          stairsModel.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
        }
        group.add(stairsModel);
      }
    } else if (type === 'woodenDoor') {
      const doorModel = this.assetLoader ? this.assetLoader.get('Door_1_Flat') : null;
      if (doorModel) {
        doorModel.scale.set(1.0, 1.0, 1.0);
        if (isPreview) {
          doorModel.traverse(c => { if (c.isMesh) c.material = previewMat; });
        } else {
          doorModel.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
        }
        group.add(doorModel);
      }
    } else if (type === 'workbench') {
      const anvilModel = this.assetLoader ? this.assetLoader.get('Anvil_Log') : null;
      const standModel = this.assetLoader ? this.assetLoader.get('WeaponStand') : null;
      if (anvilModel) {
        anvilModel.scale.set(1.0, 1.0, 1.0);
        if (isPreview) {
          anvilModel.traverse(c => { if (c.isMesh) c.material = previewMat; });
        } else {
          anvilModel.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
        }
        group.add(anvilModel);
      }
      if (standModel) {
        standModel.scale.set(0.8, 0.8, 0.8);
        standModel.position.set(0.8, 0, 0);
        if (isPreview) {
          standModel.traverse(c => { if (c.isMesh) c.material = previewMat; });
        } else {
          standModel.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
        }
        group.add(standModel);
      }
    } else if (type === 'standingTorch') {
      const torchModel = this.assetLoader ? this.assetLoader.get('Torch_Metal') : null;
      if (torchModel) {
        torchModel.scale.set(1.1, 1.1, 1.1);
        if (isPreview) {
          torchModel.traverse(c => { if (c.isMesh) c.material = previewMat; });
        } else {
          torchModel.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
        }
        group.add(torchModel);
      } else {
        const postMat = previewMat || new THREE.MeshLambertMaterial({ color: 0x4a3728 });
        const postGeo = new THREE.CylinderGeometry(0.06, 0.08, 1.6, 6);
        postGeo.translate(0, 0.8, 0);
        const post = new THREE.Mesh(postGeo, postMat);
        group.add(post);
      }

      // Flame and real warm flickering point light
      const flameGeo = new THREE.DodecahedronGeometry(0.18, 0);
      const flameMat = isPreview ? previewMat : new THREE.MeshBasicMaterial({ color: 0xff6600 });
      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.set(0, 1.7, 0);
      group.add(flame);

      if (!isPreview) {
        const tLight = new THREE.PointLight(0xff7722, 2.2, 16, 2);
        tLight.position.set(0, 1.8, 0);
        group.add(tLight);
        this.campfires.push({ light: tLight, baseIntensity: 2.2, seed: Math.random() * 100, position: group.position });
      }
    } else if (type === 'stoneWall') {
      const wallModel = this.assetLoader ? this.assetLoader.get('Wall_UnevenBrick_Straight') : null;
      if (wallModel) {
        wallModel.scale.set(1.2, 1.0, 1.2);
        if (isPreview) {
          wallModel.traverse(c => { if (c.isMesh) c.material = previewMat; });
        } else {
          wallModel.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
        }
        group.add(wallModel);
      } else {
        const stoneMat = previewMat || new THREE.MeshLambertMaterial({ color: 0x636e72 });
        const stoneGeo = new THREE.BoxGeometry(2.4, 2.8, 0.35);
        stoneGeo.translate(0, 1.4, 0);
        const stoneWall = new THREE.Mesh(stoneGeo, stoneMat);
        group.add(stoneWall);
      }
    } else if (type === 'stoneFloor') {
      const floorModel = this.assetLoader ? this.assetLoader.get('Floor_Brick') : null;
      if (floorModel) {
        floorModel.scale.set(1.3, 1.0, 1.3);
        if (isPreview) {
          floorModel.traverse(c => { if (c.isMesh) c.material = previewMat; });
        } else {
          floorModel.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
        }
        group.add(floorModel);
      } else {
        const floorMat = previewMat || new THREE.MeshLambertMaterial({ color: 0x555555 });
        const floorGeo = new THREE.BoxGeometry(3.0, 0.15, 3.0);
        floorGeo.translate(0, 0.075, 0);
        const floor = new THREE.Mesh(floorGeo, floorMat);
        group.add(floor);
      }
    } else if (type === 'palisade') {
      const fenceModel = this.assetLoader ? this.assetLoader.get('Prop_WoodenFence_Single') : null;
      if (fenceModel) {
        fenceModel.scale.set(1.4, 1.4, 1.4);
        if (isPreview) {
          fenceModel.traverse(c => { if (c.isMesh) c.material = previewMat; });
        } else {
          fenceModel.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
        }
        group.add(fenceModel);
      } else {
        const palMat = previewMat || new THREE.MeshLambertMaterial({ color: 0x5c4033 });
        const palGeo = new THREE.BoxGeometry(2.4, 2.2, 0.2);
        palGeo.translate(0, 1.1, 0);
        const pal = new THREE.Mesh(palGeo, palMat);
        group.add(pal);
      }
    } else if (type === 'smelter') {
      // Smelter / Uuni (Chimney + Cauldron with glowing magma core)
      const chimney = this.assetLoader ? this.assetLoader.get('Prop_Chimney') : null;
      if (chimney) {
        chimney.scale.set(1.3, 1.3, 1.3);
        if (isPreview) {
          chimney.traverse(c => { if (c.isMesh) c.material = previewMat; });
        } else {
          chimney.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
        }
        group.add(chimney);
      }
      const cauldron = this.assetLoader ? this.assetLoader.get('Cauldron') : null;
      if (cauldron) {
        cauldron.scale.set(1.1, 1.1, 1.1);
        cauldron.position.set(0, 0.2, 0.8);
        if (isPreview) {
          cauldron.traverse(c => { if (c.isMesh) c.material = previewMat; });
        } else {
          cauldron.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
        }
        group.add(cauldron);
      }
      if (!isPreview) {
        const sLight = new THREE.PointLight(0xff4400, 2.8, 16, 2);
        sLight.position.set(0, 1.2, 0.8);
        group.add(sLight);
        this.campfires.push({ light: sLight, baseIntensity: 2.8, seed: Math.random() * 100, position: group.position });
      }
    } else if (type === 'bed') {
      const bedModel = this.assetLoader ? this.assetLoader.get('Bed_Twin1') : null;
      if (bedModel) {
        bedModel.scale.set(1.1, 1.1, 1.1);
        if (isPreview) {
          bedModel.traverse(c => { if (c.isMesh) c.material = previewMat; });
        } else {
          bedModel.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
        }
        group.add(bedModel);
      }
    } else if (type === 'table') {
      const tableModel = this.assetLoader ? this.assetLoader.get('Table_Large') : null;
      if (tableModel) {
        tableModel.scale.set(1.0, 1.0, 1.0);
        if (isPreview) {
          tableModel.traverse(c => { if (c.isMesh) c.material = previewMat; });
        } else {
          tableModel.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
        }
        group.add(tableModel);
      }
    } else if (type === 'chair') {
      const chairModel = this.assetLoader ? this.assetLoader.get('Chair_1') : null;
      if (chairModel) {
        chairModel.scale.set(1.0, 1.0, 1.0);
        if (isPreview) {
          chairModel.traverse(c => { if (c.isMesh) c.material = previewMat; });
        } else {
          chairModel.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
        }
        group.add(chairModel);
      }
    } else if (type === 'barrel') {
      const barrelModel = this.assetLoader ? this.assetLoader.get('Barrel') : null;
      if (barrelModel) {
        barrelModel.scale.set(1.1, 1.1, 1.1);
        if (isPreview) {
          barrelModel.traverse(c => { if (c.isMesh) c.material = previewMat; });
        } else {
          barrelModel.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
        }
        group.add(barrelModel);
      }
    } else if (type === 'chest' || type === 'woodenChest') {
      const chestModel = this.assetLoader ? this.assetLoader.get('Chest_Wood') : null;

      if (chestModel) {
        chestModel.scale.set(1.0, 1.0, 1.0);
        if (isPreview) {
          chestModel.traverse(child => {
            if (child.isMesh) child.material = previewMat;
          });
        } else {
          chestModel.traverse(child => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
        }
        group.add(chestModel);
      } else {
        // Fallback procedural chest
        const chestMat = previewMat || new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
        const chestGeo = new THREE.BoxGeometry(0.8, 0.6, 0.6);
        chestGeo.translate(0, 0.3, 0);
        const chestMesh = new THREE.Mesh(chestGeo, chestMat);
        if (!isPreview) {
          chestMesh.castShadow = true;
          chestMesh.receiveShadow = true;
        }
        group.add(chestMesh);
      }
    }

    return group;
  }

  update(delta, camera, controlsLocked, world) {
    // Animate flickering for placed campfires
    const time = performance.now() * 0.005;
    for (const camp of this.campfires) {
      if (camp.light) {
        camp.light.intensity = camp.baseIntensity + Math.sin(time * 3 + camp.seed) * 0.35 + (Math.random() - 0.5) * 0.2;
      }
    }

    if (!this.isPlacing() || !this.previewMesh) return;

    if (!controlsLocked) {
      this.previewMesh.visible = false;
      return;
    }

    // Raycast from camera center to ground
    this.raycaster.setFromCamera(this.screenCenter, camera);
    const intersects = this.raycaster.intersectObject(world.groundMesh);

    if (intersects.length > 0 && intersects[0].distance < 14) {
      const hit = intersects[0];
      // Snap to 1 meter grid
      const snapX = Math.round(hit.point.x);
      const snapZ = Math.round(hit.point.z);
      const snapY = world.getGroundHeight(snapX, snapZ);

      this.previewMesh.position.set(snapX, snapY, snapZ);
      this.previewMesh.visible = true;

      // Keep walls aligned with player facing + manual rotation offset
      if (this.selectedStructure === 'woodenWall' || this.selectedStructure === 'stoneWall' || this.selectedStructure === 'palisade' || this.selectedStructure === 'woodenDoor') {
        const camDir = new THREE.Vector3();
        camera.getWorldDirection(camDir);
        const angle = Math.atan2(camDir.x, camDir.z);
        // Snap rotation to 90 degree increments
        const snappedAngle = Math.round(angle / (Math.PI / 2)) * (Math.PI / 2);
        this.previewMesh.rotation.y = (snappedAngle + this.currentRotation) % (Math.PI * 2);
      } else {
        this.previewMesh.rotation.y = this.currentRotation;
      }
    } else {
      this.previewMesh.visible = false;
    }
  }

  tryPlace(world) {
    if (!this.isPlacing() || !this.previewMesh || !this.previewMesh.visible) return false;

    const recipe = this.recipes[this.selectedStructure];
    if (!this.canAfford(recipe)) {
      if (this.hud) {
        this.hud.showNotification('Not enough materials to place structure!');
      }
      this.cancelPlacing();
      return false;
    }

    // Deduct resources
    this.inventory.remove('wood', recipe.wood);
    if (recipe.stone) {
      this.inventory.remove('stone', recipe.stone);
    }

    // Spawn solid structure
    const solidMesh = this.createStructureMesh(this.selectedStructure, false);
    solidMesh.position.copy(this.previewMesh.position);
    solidMesh.rotation.copy(this.previewMesh.rotation);
    this.scene.add(solidMesh);

    this.placedStructures.push({
      mesh: solidMesh,
      type: this.selectedStructure,
      position: solidMesh.position.clone()
    });

    // Add solid structure collider so player cannot walk through walls/crafting stations
    const p = solidMesh.position;
    const type = this.selectedStructure;
    if (type === 'woodenWall' || type === 'stoneWall' || type === 'palisade') {
      this.placedColliders.push({ minX: p.x - 1.2, maxX: p.x + 1.2, minZ: p.z - 1.2, maxZ: p.z + 1.2 });
    } else if (type === 'smelter' || type === 'forge' || type === 'workbench') {
      this.placedColliders.push({ minX: p.x - 0.9, maxX: p.x + 0.9, minZ: p.z - 0.9, maxZ: p.z + 0.9 });
    } else if (type === 'table' || type === 'chest' || type === 'barrel' || type === 'bed') {
      this.placedColliders.push({ minX: p.x - 0.7, maxX: p.x + 0.7, minZ: p.z - 0.7, maxZ: p.z + 0.7 });
    }

    if (this.audioManager) {
      this.audioManager.playBuild();
    }

    if (this.hud) {
      this.hud.showNotification(`🔨 Placed ${recipe.name}!`);
    }

    if (this.onPlace) {
      this.onPlace(this.selectedStructure);
    }

    // If player still has resources, keep placing; otherwise cancel
    if (!this.canAfford(recipe)) {
      this.cancelPlacing();
    }

    return true;
  }
}
