import * as THREE from 'three';
import Localization from './Localization.js';

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
      // 🪵 STRUCTURES
      { id: 'woodenWall', category: 'structures', wood: 5, stone: 0, nameEn: 'Wood Wall', nameFi: 'Hirsiseinä', icon: '🪵', descEn: 'Sturdy timber log wall for shelter', descFi: 'Tukeva hirsiseinä suojaksi' },
      { id: 'stoneWall', category: 'structures', wood: 0, stone: 6, nameEn: 'Stone Wall', nameFi: 'Kivimuuri', icon: '🧱', descEn: 'Heavy granite defensive barrier', descFi: 'Vahva graniittimuuri' },
      { id: 'woodenFloor', category: 'structures', wood: 4, stone: 0, nameEn: 'Wood Floor', nameFi: 'Lankkulattia', icon: '🪚', descEn: 'Smooth wooden plank foundation', descFi: 'Sileä puulattia asumuksen pohjaksi' },
      { id: 'stoneFloor', category: 'structures', wood: 0, stone: 4, nameEn: 'Stone Floor', nameFi: 'Kivilattia', icon: '🏛️', descEn: 'Paved stone floor for forges and hearths', descFi: 'Tasainen kivilattia tulisijoille ja pajoille' },
      { id: 'woodenRoof', category: 'structures', wood: 6, stone: 2, nameEn: 'Thatched Roof', nameFi: 'Harjakatto', icon: '🏠', descEn: 'Shelters from rain and grants Rested bonus', descFi: 'Suojaa sateelta ja antaa Levännyt-bonuksen' },
      { id: 'woodenStairs', category: 'structures', wood: 4, stone: 0, nameEn: 'Wood Stairs', nameFi: 'Puuportaat', icon: '🪜', descEn: 'Access upper floors and watchtowers', descFi: 'Portaat toiseen kerrokseen tai torniin' },
      { id: 'woodenDoor', category: 'structures', wood: 4, stone: 0, nameEn: 'Heavy Door', nameFi: 'Salpaovi', icon: '🚪', descEn: 'Secures your home against wild creatures', descFi: 'Avattava linnoituksen ovi' },
      { id: 'palisade', category: 'structures', wood: 6, stone: 0, nameEn: 'Palisade Wall', nameFi: 'Paaluaita', icon: '🛡️', descEn: 'Spiked defensive perimeter fortification', descFi: 'Teräväkärkinen suojamuuri kylän ympärille' },
      
      // 🔥 FIRE & LIGHT
      { id: 'campfire', category: 'fire', wood: 4, stone: 3, nameEn: 'Campfire', nameFi: 'Leirituli', icon: '🔥', descEn: 'Cooks meat and fish, provides warmth and light', descFi: 'Lämmittele, paista lihaa ja poista väsymys' },
      { id: 'standingTorch', category: 'fire', wood: 2, stone: 1, nameEn: 'Standing Torch', nameFi: 'Soihtuteline', icon: '🕯️', descEn: 'Permanent outdoor torch post', descFi: 'Valaisee pihan ja karkottaa petoja' },

      // 🛠️ WORKSTATIONS & STORAGE
      { id: 'workbench', category: 'crafting', wood: 8, stone: 4, nameEn: 'Workbench', nameFi: 'Työpöytä', icon: '🛠️', descEn: 'Enables advanced weapon, tool and armor crafting', descFi: 'Avaa aseiden ja työkalujen valmistuksen' },
      { id: 'smelter', category: 'crafting', wood: 4, stone: 12, nameEn: 'Smelter', nameFi: 'Sulattouuni', icon: '🌋', descEn: 'Smelt copper, tin, and iron ore into bars', descFi: 'Sulata kuparia ja rautamalmia harkoiksi' },
      { id: 'forge', category: 'crafting', wood: 6, stone: 8, nameEn: 'Forge & Anvil', nameFi: 'Ahjo & Alasin', icon: '🔨', descEn: 'Forge bronze, iron, and steel armaments', descFi: 'Tako pronssi-, rauta- ja teräsvarusteita' },
      { id: 'chest', category: 'crafting', wood: 6, stone: 0, nameEn: 'Wood Chest', nameFi: 'Puuarkku', icon: '📦', descEn: 'Safe storage for harvested materials and loot', descFi: 'Säilytä ylimääräisiä resursseja' },
      { id: 'barrel', category: 'crafting', wood: 5, stone: 1, nameEn: 'Grain Barrel', nameFi: 'Viljatynnyri', icon: '🛢️', descEn: 'Storage for crops, grain, and provisions', descFi: 'Säilytystynnyri viljalle ja ruualle' },

      // 🛏️ FURNITURE
      { id: 'bed', category: 'furniture', wood: 6, stone: 0, nameEn: 'Viking Bed', nameFi: 'Viking-Sänky', icon: '🛏️', descEn: 'Sleep through the night and restore player energy', descFi: 'Nuku yön yli ja palauta hahmon energia' },
      { id: 'table', category: 'furniture', wood: 5, stone: 0, nameEn: 'Rustic Table', nameFi: 'Pirtin Pöytä', icon: '🪵', descEn: 'Increases indoor comfort level', descFi: 'Lisää kodin mukavuutta' },
      { id: 'chair', category: 'furniture', wood: 3, stone: 0, nameEn: 'Oak Bench', nameFi: 'Tammipenkki', icon: '🪑', descEn: 'Rest and enjoy the warmth of a hearth fire', descFi: 'Istu ja nauti lämpimästä leiritulesta' }
    ];

    this.structureDefs.forEach(d => {
      d.name = d.nameEn;
      d.desc = d.descEn;
    });

    this.structureKeys = this.structureDefs.map(d => d.id);
    this.currentStructureIndex = 0; // 'woodenWall'
    this.isHammerActive = false;
    this.isBuildMenuOpen = false;
    this.currentCategory = 'all';

    window.addEventListener('languageChanged', () => {
      if (this.isBuildMenuOpen) this.renderBuildMenuGrid();
      this.updateSelectorBar();
    });

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

  getDefName(def) {
    if (!def) return '';
    return Localization.lang === 'fi' ? (def.nameFi || def.name) : (def.nameEn || def.name);
  }

  getDefDesc(def) {
    if (!def) return '';
    return Localization.lang === 'fi' ? (def.descFi || def.desc) : (def.descEn || def.desc);
  }

  updateSelectorBar() {
    if (!this.hudBarEl) return;
    const def = this.structureDefs[this.currentStructureIndex];
    if (!def) return;
    const isFi = Localization.lang === 'fi';

    const iconEl = this.hudBarEl.querySelector('#b-hud-icon');
    const nameEl = this.hudBarEl.querySelector('#b-hud-name');
    const costEl = this.hudBarEl.querySelector('#b-hud-cost');

    if (iconEl) iconEl.textContent = def.icon;
    if (nameEl) nameEl.textContent = this.getDefName(def);

    if (costEl && this.inventory) {
      const woodHave = this.inventory.items?.wood || 0;
      const stoneHave = this.inventory.items?.stone || 0;
      let costParts = [];
      if (def.wood > 0) {
        const ok = woodHave >= def.wood;
        costParts.push(`<span class="${ok ? 'cost-ok' : 'cost-missing'}">🪵 ${def.wood} ${isFi ? 'Puu' : 'Wood'} (${woodHave})</span>`);
      }
      if (def.stone > 0) {
        const ok = stoneHave >= def.stone;
        costParts.push(`<span class="${ok ? 'cost-ok' : 'cost-missing'}">🪨 ${def.stone} ${isFi ? 'Kivi' : 'Stone'} (${stoneHave})</span>`);
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
      const isHammerEquipped = this.inventory && this.inventory.equippedTool === 'hammer';
      const isDevActive = window.__game?.devMode?.isActive || document.getElementById('dev-mode-panel')?.style.display !== 'none';
      this.hudBarEl.style.display = (active && isHammerEquipped && !isDevActive) ? 'flex' : 'none';
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
    setTimeout(() => {
      const anyOtherModal = document.querySelector('.modal.active') ||
                            document.querySelector('.menu-modal.active') ||
                            document.querySelector('#crafting-menu.active') ||
                            document.querySelector('#backpack-screen.active');
      if (!anyOtherModal && this.controls && !this.controls.isLocked) {
        try { this.controls.lock(); } catch (e) {}
      }
    }, 60);
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
    const isFi = Localization.lang === 'fi';

    const cat = this.currentCategory || 'all';
    const list = this.structureDefs.filter(d => cat === 'all' || d.category === cat);

    const woodHave = this.inventory?.items?.wood || 0;
    const stoneHave = this.inventory?.items?.stone || 0;

    gridEl.innerHTML = list.map(def => {
      const isSelected = this.structureKeys[this.currentStructureIndex] === def.id;
      const canAffordWood = def.wood === 0 || woodHave >= def.wood;
      const canAffordStone = def.stone === 0 || stoneHave >= def.stone;
      const canAfford = canAffordWood && canAffordStone;
      const name = this.getDefName(def);
      const desc = this.getDefDesc(def);

      return `
        <div class="build-card ${isSelected ? 'selected' : ''} ${canAfford ? 'affordable' : 'unaffordable'}" data-structure-id="${def.id}">
          <div class="build-card-top">
            <span class="build-card-icon">${def.icon}</span>
            <span class="build-card-tag">${def.category.toUpperCase()}</span>
          </div>
          <div class="build-card-title">${name}</div>
          <div class="build-card-desc">${desc}</div>
          <div class="build-card-costs">
            ${def.wood > 0 ? `<span class="build-cost-pill ${canAffordWood ? 'ok' : 'missing'}">🪵 ${def.wood} (${woodHave})</span>` : ''}
            ${def.stone > 0 ? `<span class="build-cost-pill ${canAffordStone ? 'ok' : 'missing'}">🪨 ${def.stone} (${stoneHave})</span>` : ''}
          </div>
          <button class="build-card-btn ${canAfford ? 'btn-can-build' : 'btn-lacking'}">
            ${isSelected ? (isFi ? '✅ Valittuna' : '✅ Selected') : (canAfford ? (isFi ? 'Valitse pala' : 'Select Piece') : (isFi ? 'Puuttuu resursseja' : 'Need Resources'))}
          </button>
        </div>
      `;
    }).join('');

    // Attach click handlers to select structure
    gridEl.querySelectorAll('.build-card').forEach(card => {
      card.addEventListener('click', (e) => {
        e.preventDefault();
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
            this.hud.showNotification(`🔨 Valittu: ${def.icon} ${this.getDefName(def)}`);
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
            this.inventory.hotbar.selectSlot(5, true);
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

      // Never intercept keys when Dev Mode is active
      if (window.__game?.devMode?.isActive || document.getElementById('dev-mode-panel')?.style.display !== 'none') {
        return;
      }

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
              this.inventory.hotbar.selectSlot(5, true);
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
        // Never intercept RMB when Dev Mode is active (RMB is used for DevMode camera rotation!)
        if (window.__game?.devMode?.isActive || document.getElementById('dev-mode-panel')?.style.display !== 'none') {
          return;
        }

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
      // Never block context menu in DevMode
      if (window.__game?.devMode?.isActive || document.getElementById('dev-mode-panel')?.style.display !== 'none') {
        return;
      }
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

        // Active campfire warm embers flicker
        if (!isPreview) {
          this.campfires.push({
            flameMesh: embers,
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
          this.campfires.push({
            flameMesh: embers,
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
        this.campfires.push({ flameMesh: flame, seed: Math.random() * 100, position: group.position });
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
        this.campfires.push({ flameMesh: cauldron, seed: Math.random() * 100, position: group.position });
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
    // Ensure selector HUD bar visibility strictly reflects whether hammer is currently equipped
    if (this.hudBarEl) {
      const isHammerEquipped = this.inventory && this.inventory.equippedTool === 'hammer';
      const isDevActive = window.__game?.devMode?.isActive || document.getElementById('dev-mode-panel')?.style.display !== 'none';
      const shouldShow = this.isHammerActive && isHammerEquipped && !isDevActive;
      const curDisplay = this.hudBarEl.style.display;
      if (shouldShow && curDisplay !== 'flex') {
        this.hudBarEl.style.display = 'flex';
      } else if (!shouldShow && curDisplay !== 'none') {
        this.hudBarEl.style.display = 'none';
        if (this.previewMesh) this.previewMesh.visible = false;
      }
    }

    // Animate flickering for placed campfires and torches (Zero shader stalls)
    const time = performance.now() * 0.005;
    for (const camp of this.campfires) {
      if (camp.flameMesh) {
        const s = 1.0 + Math.sin(time * 4 + camp.seed) * 0.12;
        camp.flameMesh.scale.set(s, s * 1.08, s);
      }
    }

    if (!this.isPlacing() || !this.previewMesh) return;

    if (!controlsLocked) {
      this.previewMesh.visible = false;
      return;
    }

    // Raycast from camera center to ground and placed building structures
    const targets = [world.groundMesh];
    for (let i = 0; i < this.placedStructures.length; i++) {
      if (this.placedStructures[i].mesh) {
        targets.push(this.placedStructures[i].mesh);
      }
    }

    this.raycaster.setFromCamera(this.screenCenter, camera);
    const intersects = this.raycaster.intersectObjects(targets, true);

    if (intersects.length > 0 && intersects[0].distance < 16) {
      const hit = intersects[0];
      const hitPoint = hit.point;

      // Valheim-style Snap System: Check for snap sockets from nearby placed building pieces
      const snapSocket = this._findBestSnapSocket(hitPoint, this.selectedStructure, world);

      if (snapSocket) {
        // Snap locked directly to previous building piece!
        this.previewMesh.position.set(snapSocket.x, snapSocket.y, snapSocket.z);
        this.previewMesh.rotation.y = (snapSocket.rotY + this.currentRotation) % (Math.PI * 2);
        this.previewMesh.visible = true;

        // Visual feedback: glowing cyan wireframe indicating active piece-to-piece snap
        this._setPreviewColor(0x00d2d3, 0.9);

        if (this.hud && Math.random() < 0.05) {
          this.hud.showTooltip(`🧲 SNAP LUKITTU! [LMB] Rakenna | [R] Käännä 90° | [Q/E] Selaa | [RMB] Peruuta`);
        }
      } else {
        // Free ground placement snapped to terrain grid
        const snapX = Math.round(hitPoint.x * 2) / 2;
        const snapZ = Math.round(hitPoint.z * 2) / 2;
        const snapY = world.getGroundHeight(snapX, snapZ);

        this.previewMesh.position.set(snapX, snapY, snapZ);
        this.previewMesh.visible = true;

        // Align walls with camera facing + rotation offset
        if (this.selectedStructure === 'woodenWall' || this.selectedStructure === 'stoneWall' || this.selectedStructure === 'palisade' || this.selectedStructure === 'woodenDoor') {
          const camDir = new THREE.Vector3();
          camera.getWorldDirection(camDir);
          const angle = Math.atan2(camDir.x, camDir.z);
          const snappedAngle = Math.round(angle / (Math.PI / 2)) * (Math.PI / 2);
          this.previewMesh.rotation.y = (snappedAngle + this.currentRotation) % (Math.PI * 2);
        } else {
          this.previewMesh.rotation.y = this.currentRotation;
        }

        const canAfford = this.canAfford(this.recipes[this.selectedStructure]);
        this._setPreviewColor(canAfford ? 0x3498db : 0xe74c3c, 0.65);
      }
    } else {
      this.previewMesh.visible = false;
    }
  }

  _setPreviewColor(colorHex, opacity = 0.65) {
    if (!this.previewMesh) return;
    this.previewMesh.traverse(child => {
      if (child.isMesh && child.material) {
        if (child.material.color) child.material.color.setHex(colorHex);
        child.material.opacity = opacity;
      }
    });
  }

  _findBestSnapSocket(hitPoint, placingType, world) {
    if (!this.placedStructures || this.placedStructures.length === 0) return null;

    let bestSocket = null;
    let minDistance = 2.6; // Magnet snap radius in meters

    const isPlacingWall = ['woodenWall', 'stoneWall', 'palisade', 'woodenDoor'].includes(placingType);
    const isPlacingFloor = ['woodenFloor', 'stoneFloor'].includes(placingType);
    const isPlacingRoof = placingType === 'woodenRoof';
    const isPlacingStairs = placingType === 'woodenStairs';
    const isPlacingItem = ['workbench', 'smelter', 'forge', 'chest', 'barrel', 'bed', 'table', 'chair', 'campfire', 'standingTorch'].includes(placingType);

    for (let i = 0; i < this.placedStructures.length; i++) {
      const ps = this.placedStructures[i];
      if (!ps.mesh) continue;

      const pPos = ps.position;
      const distToPlaced = Math.hypot(pPos.x - hitPoint.x, pPos.z - hitPoint.z);
      if (distToPlaced > 6.0) continue; // Only evaluate structures within 6m

      const pRot = ps.mesh.rotation.y;
      const pType = ps.type;
      const cosR = Math.cos(pRot);
      const sinR = Math.sin(pRot);

      // Local to world rotated offset helper
      const rot = (dx, dz) => ({
        x: pPos.x + dx * cosR + dz * sinR,
        z: pPos.z - dx * sinR + dz * cosR
      });

      const sockets = [];

      // ----------------------------------------------------
      // CASE 1: Placed structure is a FLOOR (woodenFloor / stoneFloor)
      // ----------------------------------------------------
      if (pType === 'woodenFloor' || pType === 'stoneFloor') {
        const floorSize = 2.5;
        const half = floorSize / 2;

        if (isPlacingFloor) {
          // Snap adjacent floor pieces in 4 cardinal directions
          sockets.push(
            { ...rot(0, floorSize), y: pPos.y, rotY: pRot },
            { ...rot(0, -floorSize), y: pPos.y, rotY: pRot },
            { ...rot(floorSize, 0), y: pPos.y, rotY: pRot },
            { ...rot(-floorSize, 0), y: pPos.y, rotY: pRot }
          );
        } else if (isPlacingWall) {
          // Snap walls along the 4 perimeter edges of the floor
          sockets.push(
            { ...rot(0, half), y: pPos.y, rotY: pRot },
            { ...rot(0, -half), y: pPos.y, rotY: pRot },
            { ...rot(half, 0), y: pPos.y, rotY: pRot + Math.PI / 2 },
            { ...rot(-half, 0), y: pPos.y, rotY: pRot + Math.PI / 2 }
          );
        } else if (isPlacingItem) {
          // Snap furniture/crafting station directly onto floor surface
          sockets.push({ x: pPos.x, y: pPos.y + 0.05, z: pPos.z, rotY: pRot });
        } else if (isPlacingStairs) {
          sockets.push(
            { ...rot(0, half + 0.2), y: pPos.y, rotY: pRot },
            { ...rot(0, -half - 0.2), y: pPos.y, rotY: pRot + Math.PI }
          );
        }
      }

      // ----------------------------------------------------
      // CASE 2: Placed structure is a WALL (woodenWall / stoneWall / palisade / woodenDoor)
      // ----------------------------------------------------
      else if (['woodenWall', 'stoneWall', 'palisade', 'woodenDoor'].includes(pType)) {
        const wallWidth = 2.4;
        const wallHeight = 2.6;
        const halfW = wallWidth / 2;

        if (isPlacingWall) {
          // 1. Straight extension left and right
          sockets.push(
            { ...rot(wallWidth, 0), y: pPos.y, rotY: pRot },
            { ...rot(-wallWidth, 0), y: pPos.y, rotY: pRot },
            // 2. Corner walls (90 degrees right and left)
            { ...rot(halfW, -halfW), y: pPos.y, rotY: pRot + Math.PI / 2 },
            { ...rot(halfW, halfW), y: pPos.y, rotY: pRot - Math.PI / 2 },
            { ...rot(-halfW, -halfW), y: pPos.y, rotY: pRot + Math.PI / 2 },
            { ...rot(-halfW, halfW), y: pPos.y, rotY: pRot - Math.PI / 2 },
            // 3. Vertical stacking (2nd story wall!)
            { x: pPos.x, y: pPos.y + wallHeight, z: pPos.z, rotY: pRot }
          );
        } else if (isPlacingRoof) {
          // Snap roof directly on top of wall
          sockets.push({ x: pPos.x, y: pPos.y + wallHeight, z: pPos.z, rotY: pRot });
        } else if (isPlacingFloor) {
          // Snap floor at base of wall or ceiling/second story
          sockets.push(
            { ...rot(0, 1.25), y: pPos.y, rotY: pRot },
            { ...rot(0, -1.25), y: pPos.y, rotY: pRot },
            { ...rot(0, 1.25), y: pPos.y + wallHeight, z: pRot },
            { ...rot(0, -1.25), y: pPos.y + wallHeight, z: pRot }
          );
        }
      }

      // ----------------------------------------------------
      // CASE 3: Placed structure is a ROOF (woodenRoof)
      // ----------------------------------------------------
      else if (pType === 'woodenRoof') {
        const roofSpan = 2.5;
        if (isPlacingRoof) {
          sockets.push(
            { ...rot(roofSpan, 0), y: pPos.y, rotY: pRot },
            { ...rot(-roofSpan, 0), y: pPos.y, rotY: pRot },
            { ...rot(0, roofSpan), y: pPos.y, rotY: pRot + Math.PI },
            { ...rot(0, -roofSpan), y: pPos.y, rotY: pRot + Math.PI }
          );
        }
      }

      // ----------------------------------------------------
      // CASE 4: Placed structure is STAIRS (woodenStairs)
      // ----------------------------------------------------
      else if (pType === 'woodenStairs') {
        if (isPlacingFloor) {
          sockets.push(
            { ...rot(0, 1.8), y: pPos.y + 2.0, rotY: pRot },
            { ...rot(0, -1.8), y: pPos.y, rotY: pRot }
          );
        } else if (isPlacingStairs) {
          sockets.push({ ...rot(0, 1.8), y: pPos.y + 2.0, rotY: pRot });
        }
      }

      // Test all generated sockets against hitPoint
      for (let s = 0; s < sockets.length; s++) {
        const sock = sockets[s];
        const dist = Math.hypot(sock.x - hitPoint.x, (sock.y - hitPoint.y) * 1.5, sock.z - hitPoint.z);
        if (dist < minDistance) {
          minDistance = dist;
          bestSocket = sock;
        }
      }
    }

    return bestSocket;
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

    // Add solid structure collider so player cannot walk through walls/crafting stations/props
    const p = solidMesh.position;
    const type = this.selectedStructure;
    let rad = 0;
    const tLower = (type || '').toLowerCase();
    if (tLower.includes('wall') || tLower.includes('palisade') || tLower.includes('beam') || tLower.includes('log') || tLower.includes('gate')) {
      rad = 1.1;
    } else if (tLower.includes('door')) {
      rad = 0.9;
    } else if (tLower.includes('smelter') || tLower.includes('forge') || tLower.includes('workbench') || tLower.includes('cauldron')) {
      rad = 0.95;
    } else if (tLower.includes('table') || tLower.includes('chest') || tLower.includes('barrel') || tLower.includes('bed')) {
      rad = 0.75;
    } else if (tLower.includes('campfire') || tLower.includes('chair') || tLower.includes('torch')) {
      rad = 0.55;
    }

    if (rad > 0) {
      this.placedColliders.push({
        minX: p.x - rad,
        maxX: p.x + rad,
        minZ: p.z - rad,
        maxZ: p.z + rad,
        radius: rad,
        mesh: solidMesh
      });
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

  placeDirect(type, position, rotationY = 0, customId = null) {
    const solidMesh = this.createStructureMesh(type, false);
    solidMesh.position.copy(position);
    solidMesh.rotation.y = rotationY;
    if (customId) {
      solidMesh.userData.customId = customId;
    }
    this.scene.add(solidMesh);

    const structure = {
      mesh: solidMesh,
      type: type,
      position: solidMesh.position.clone(),
      customId: customId || null
    };
    this.placedStructures.push(structure);

    const p = solidMesh.position;
    let rad = 0;
    if (type === 'woodenWall' || type === 'stoneWall' || type === 'palisade') {
      rad = 1.1;
    } else if (type === 'woodenDoor') {
      rad = 0.9;
    } else if (type === 'smelter' || type === 'forge' || type === 'workbench') {
      rad = 0.95;
    } else if (type === 'table' || type === 'chest' || type === 'barrel' || type === 'bed') {
      rad = 0.75;
    } else if (type === 'campfire' || type === 'chair' || type === 'standingTorch') {
      rad = 0.55;
    }

    if (rad > 0) {
      this.placedColliders.push({
        minX: p.x - rad,
        maxX: p.x + rad,
        minZ: p.z - rad,
        maxZ: p.z + rad,
        radius: rad,
        mesh: solidMesh
      });
    }
    return structure;
  }

  removeStructure(mesh) {
    this.placedStructures = this.placedStructures.filter(s => s.mesh !== mesh);
    this.placedColliders = this.placedColliders.filter(c => c.mesh !== mesh);
    this.scene.remove(mesh);
  }
}
