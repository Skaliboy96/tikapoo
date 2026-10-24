import * as THREE from 'three';
import Localization from './Localization.js';

/**
 * BackpackScreen – Valheim-inspired RPG equipment and inventory grid screen.
 * Displays live 3D character paperdoll with surrounding interactive equipment slots,
 * RPG vitals & attributes, 24-slot inventory grid with drop actions,
 * and an interactive Action Bar (Hotbar 1-8) reordering grid.
 */
export default class BackpackScreen {
  constructor(inventory, player, controls, hud, hotbar = null, lootManager = null) {
    this.inventory = inventory;
    this.player = player;
    this.controls = controls;
    this.hud = hud;
    this.hotbar = hotbar;
    this.lootManager = lootManager;

    this.isOpen = false;
    this.overlayEl = document.getElementById('backpack-screen');
    this.closeBtn = document.getElementById('backpack-close-btn');

    this.itemsGridEl = document.getElementById('bp-items-grid');
    this.hotbarGridEl = document.getElementById('bp-hotbar-reorder-grid');
    this.actionsBarEl = document.getElementById('bp-item-actions-bar');
    this.selectedItemNameEl = document.getElementById('bp-selected-item-name');
    this.dropOneBtn = document.getElementById('bp-drop-one-btn');
    this.dropAllBtn = document.getElementById('bp-drop-all-btn');

    this.statAtkEl = document.getElementById('bp-stat-atk');
    this.statDefEl = document.getElementById('bp-stat-def');
    this.statHpEl = document.getElementById('bp-stat-hp');
    this.statHungerEl = document.getElementById('bp-stat-hunger');
    this.statWeightEl = document.getElementById('bp-stat-weight');

    // Selection & Hotbar state
    this.selectedItemKey = null;
    this.selectedIsTool = false;
    this.selectedHotbarIndex = null;

    // 3D Paperdoll Viewport
    this.pdCanvas = document.getElementById('bp-paperdoll-canvas');
    this.pdScene = null;
    this.pdCamera = null;
    this.pdRenderer = null;
    this.pdModel = null;
    this.pdWeaponModel = null;
    this.pdAngle = 0;
    this.pdDragging = false;
    this.pdLastMouseX = 0;
    this.pdAnimReq = null;

    window.addEventListener('languageChanged', () => {
      if (this.isOpen) this.refresh();
    });

    this._setupListeners();
    this._setupDropListeners();
  }

  _setupListeners() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyI') {
        // Toggle inventory screen [I]
        e.preventDefault();
        this.toggle();
      }
      if (e.code === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }

    // Equipment slot click listeners
    const headSlot = document.querySelector('.bp-slot-box[data-slot="head"]');
    if (headSlot) {
      headSlot.addEventListener('click', () => {
        if (this.player && this.player.charConfig) {
          // Toggle hood / hair on the fly
          const cur = this.player.charConfig.headStyle || 'hair';
          this.player.charConfig.headStyle = cur === 'hood' ? 'hair' : 'hood';
          this.player.applyCharacterConfig(this.player.charConfig);
          this.refresh();
        }
      });
    }

    const chestSlot = document.querySelector('.bp-slot-box[data-slot="chest"]');
    if (chestSlot) {
      chestSlot.addEventListener('click', () => {
        // Cycle owned armors or unequip
        if (!this.inventory) return;
        const armors = ['none', 'leatherArmor', 'bronzeArmor', 'beastArmor', 'ironArmor', 'scaleArmor', 'steelArmor', 'plateArmor', 'runicArmor', 'dragonArmor'];
        const owned = armors.filter(a => a === 'none' || (this.inventory.items[a] > 0 || this.inventory.tools[a]));
        let curIdx = owned.indexOf(this.inventory.equippedArmor || 'none');
        let nextIdx = (curIdx + 1) % owned.length;
        this.inventory.equippedArmor = owned[nextIdx];
        if (this.player && this.player.updateArmorAppearance) {
          this.player.updateArmorAppearance(this.inventory.equippedArmor);
        }
        this.refresh();
      });
    }

    const weaponSlot = document.querySelector('.bp-slot-box[data-slot="weapon"]');
    if (weaponSlot) {
      weaponSlot.addEventListener('click', () => {
        if (this.hotbar && this.hotbar.toggleFists) {
          this.hotbar.toggleFists();
        } else if (this.inventory) {
          this.inventory.equip(null);
        }
        this.refresh();
      });
    }

    const shieldSlot = document.querySelector('.bp-slot-box[data-slot="shield"]');
    if (shieldSlot) {
      shieldSlot.addEventListener('click', () => {
        if (!this.inventory) return;
        if (this.inventory.tools.shield) {
          this.inventory.tools.shield = false;
          if (this.hud) this.hud.showNotification(Localization.lang === 'fi' ? 'Kilpi riisuttu' : 'Shield unequipped');
        } else if (this.inventory.items.shield > 0 || this.inventory.tools.shield !== undefined) {
          this.inventory.tools.shield = true;
          if (this.hud) this.hud.showNotification(Localization.lang === 'fi' ? 'Kilpi varustettu' : 'Shield equipped');
        }
        this.refresh();
      });
    }

    const toolSlot = document.querySelector('.bp-slot-box[data-slot="tool"]');
    if (toolSlot) {
      toolSlot.addEventListener('click', () => {
        if (this.inventory && this.inventory.tools.hammer) {
          this.inventory.equip(this.inventory.equippedTool === 'hammer' ? null : 'hammer');
          if (this.hotbar) this.hotbar.sync();
          this.refresh();
        }
      });
    }
  }

  _setupDropListeners() {
    if (this.dropOneBtn) {
      this.dropOneBtn.addEventListener('click', () => this._dropSelectedItem(1));
    }
    if (this.dropAllBtn) {
      this.dropAllBtn.addEventListener('click', () => this._dropSelectedItem(Infinity));
    }
  }

  _dropSelectedItem(amountToDrop) {
    if (!this.selectedItemKey || !this.inventory) return;
    const isFi = Localization.lang === 'fi';
    const key = this.selectedItemKey;

    if (this.selectedIsTool) {
      // Drop tool
      if (this.inventory.tools && this.inventory.tools[key]) {
        this.inventory.tools[key] = false;
        if (this.inventory.equippedTool === key) {
          this.inventory.equip(null);
        }

        // Spawn physical loot drop in world in front of player
        if (this.lootManager && this.player) {
          const pos = this.player.getPosition();
          const dropPos = { x: pos.x + Math.sin(this.player.rotation || 0) * 1.5, y: pos.y + 0.4, z: pos.z + Math.cos(this.player.rotation || 0) * 1.5 };
          this.lootManager.spawnLoot(dropPos, null, false, { [key]: 1 });
        }

        if (this.hud) this.hud.showNotification(isFi ? `Pudotettu: ${key}` : `Dropped: ${key}`);
        this.selectedItemKey = null;
        this.selectedIsTool = false;
        if (this.actionsBarEl) this.actionsBarEl.style.display = 'none';
        if (this.hotbar) this.hotbar.sync();
        this.refresh();
      }
    } else {
      // Drop resource / consumable item
      const curCount = this.inventory.items[key] || 0;
      if (curCount <= 0) return;
      const count = Math.min(curCount, amountToDrop);
      this.inventory.remove(key, count);

      if (this.lootManager && this.player) {
        const pos = this.player.getPosition();
        const dropPos = { x: pos.x + Math.sin(this.player.rotation || 0) * 1.5, y: pos.y + 0.4, z: pos.z + Math.cos(this.player.rotation || 0) * 1.5 };
        this.lootManager.spawnLoot(dropPos, null, false, { [key]: count });
      }

      if (this.hud) this.hud.showNotification(isFi ? `Pudotettu: ${key} x${count}` : `Dropped: ${key} x${count}`);

      const remaining = this.inventory.items[key] || 0;
      if (remaining <= 0) {
        this.selectedItemKey = null;
        if (this.actionsBarEl) this.actionsBarEl.style.display = 'none';
      }
      if (this.hotbar) this.hotbar.sync();
      this.refresh();
    }
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  open() {
    this.isOpen = true;
    if (this.overlayEl) this.overlayEl.classList.add('active');
    if (this.controls && this.controls.isLocked) this.controls.unlock();
    this._initPaperdoll();
    this.refresh();
    this._startPaperdollLoop();
  }

  close() {
    this.isOpen = false;
    this._stopPaperdollLoop();
    if (this.overlayEl) this.overlayEl.classList.remove('active');
    this.selectedHotbarIndex = null;
    this.selectedItemKey = null;
    if (this.actionsBarEl) this.actionsBarEl.style.display = 'none';

    setTimeout(() => {
      const mainMenu = document.getElementById('main-menu');
      const isMenu = mainMenu && mainMenu.style.display !== 'none';
      if (!isMenu && this.controls && !this.controls.isLocked) {
        this.controls.lock();
      }
    }, 60);
  }

  refresh() {
    this._renderEquipment();
    this._renderStats();
    this._renderGrid();
    this._renderHotbarReorder();
    this._updatePaperdollModel();
  }

  // ============================================================
  // LIVE 3D CHARACTER PAPERDOLL
  // ============================================================
  _initPaperdoll() {
    if (!this.pdCanvas || this.pdRenderer) return;

    const w = this.pdCanvas.clientWidth || 136;
    const h = this.pdCanvas.clientHeight || 186;

    this.pdScene = new THREE.Scene();
    this.pdScene.background = new THREE.Color(0x0e131d);

    this.pdCamera = new THREE.PerspectiveCamera(36, w / h, 0.1, 20);
    this.pdCamera.position.set(0, 0.95, 2.3);
    this.pdCamera.lookAt(0, 0.85, 0);

    this.pdRenderer = new THREE.WebGLRenderer({
      canvas: this.pdCanvas,
      antialias: true,
      alpha: true,
      powerPreference: 'low-power'
    });
    this.pdRenderer.setSize(w, h);
    this.pdRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.pdRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.pdRenderer.toneMappingExposure = 1.15;

    // Pedestal
    const pedGeo = new THREE.CylinderGeometry(0.55, 0.6, 0.04, 28);
    const pedMat = new THREE.MeshStandardMaterial({ color: 0x222d3d, roughness: 0.75, metalness: 0.2 });
    const ped = new THREE.Mesh(pedGeo, pedMat);
    ped.position.y = -0.02;
    this.pdScene.add(ped);

    // Warm character studio lights
    const ambLight = new THREE.AmbientLight(0xfff3e5, 1.1);
    this.pdScene.add(ambLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(1.5, 2.6, 2.2);
    this.pdScene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x7fb5ff, 1.0);
    fillLight.position.set(-1.8, 1.4, -1.2);
    this.pdScene.add(fillLight);

    // Turntable mouse interaction
    this.pdCanvas.addEventListener('mousedown', (e) => {
      this.pdDragging = true;
      this.pdLastMouseX = e.clientX;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.pdDragging || !this.pdModel) return;
      const dx = e.clientX - this.pdLastMouseX;
      this.pdLastMouseX = e.clientX;
      this.pdAngle += dx * 0.02;
      this.pdModel.rotation.y = this.pdAngle;
    });

    window.addEventListener('mouseup', () => {
      this.pdDragging = false;
    });
  }

  _updatePaperdollModel() {
    if (!this.pdScene || !this.player || !this.player.assetLoader) return;

    // Recreate preview model if missing
    if (!this.pdModel) {
      const cfg = this.player.charConfig || { gender: 'male', headStyle: 'hair', model: 'Rogue' };
      const isFemale = cfg.gender === 'female';
      const isHood = cfg.headStyle === 'hood';
      const modelName = cfg.model || (isFemale ? (isHood ? 'Ranger_Adv' : 'Rogue_Hooded') : (isHood ? 'Barbarian' : 'Rogue'));

      const charData = this.player.assetLoader.createAnimatedCharacter(modelName, 'Idle_A', cfg);
      if (charData && charData.model) {
        this.pdModel = charData.model;
        this.pdModel.position.set(0, 0, 0);
        this.pdModel.rotation.y = this.pdAngle;
        this.pdScene.add(this.pdModel);
      }
    }

    if (!this.pdModel) return;

    // Apply current equipped armor material tint to paperdoll
    const armorKey = this.inventory ? this.inventory.equippedArmor : 'none';
    const armorTints = {
      none:         { color: this.player.charConfig?.clothingColor || 0x2e5339, metalness: 0.05, roughness: 0.85 },
      leatherArmor: { color: 0x6e411b, metalness: 0.1,  roughness: 0.75 },
      bronzeArmor:  { color: 0xcd7f32, metalness: 0.85, roughness: 0.25 },
      beastArmor:   { color: 0x48321d, metalness: 0.15, roughness: 0.8 },
      ironArmor:    { color: 0x555b63, metalness: 0.82, roughness: 0.35 },
      scaleArmor:   { color: 0x16423c, metalness: 0.65, roughness: 0.3 },
      steelArmor:   { color: 0x95a5a6, metalness: 0.9,  roughness: 0.2 },
      plateArmor:   { color: 0x2c3e50, metalness: 0.75, roughness: 0.4 },
      runicArmor:   { color: 0x8e44ad, metalness: 0.8,  roughness: 0.25 },
      dragonArmor:  { color: 0xd4af37, metalness: 0.95, roughness: 0.15 }
    };
    const tint = armorTints[armorKey] || armorTints.none;

    this.pdModel.traverse(c => {
      if (c.isMesh && c.material) {
        const mat = c.material;
        if (!c.name.includes('Eye') && !c.name.includes('Hair') && !c.name.includes('Skin')) {
          if (mat.color) mat.color.setHex(tint.color);
          mat.metalness = tint.metalness;
          mat.roughness = tint.roughness;
        }
      }
    });

    // Update weapon attached to paperdoll right hand
    this._attachPaperdollWeapon();
  }

  _attachPaperdollWeapon() {
    if (!this.pdModel) return;

    // Remove old weapon
    if (this.pdWeaponModel && this.pdWeaponModel.parent) {
      this.pdWeaponModel.parent.remove(this.pdWeaponModel);
      this.pdWeaponModel = null;
    }

    const equipped = this.inventory ? this.inventory.equippedTool : null;
    if (!equipped || equipped === 'hands') return;

    // Find right hand bone
    let handNode = null;
    this.pdModel.traverse(c => {
      const n = (c.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (n === 'handslotr') handNode = c;
      else if (!handNode && (n === 'handr' || n.includes('righthand') || n.includes('handright'))) handNode = c;
    });
    if (!handNode) return;

    const al = this.player.assetLoader;
    if (!al) return;

    let weaponObj = null;
    if (equipped.includes('Axe')) {
      weaponObj = al.get('Axe_Bronze')?.clone();
      if (weaponObj) weaponObj.rotation.set(0, 0, -Math.PI / 2);
    } else if (equipped.includes('Pickaxe') || equipped === 'pickaxe') {
      weaponObj = al.get('Pickaxe_Bronze')?.clone();
      if (weaponObj) weaponObj.rotation.set(0, 0, -Math.PI / 2);
    } else if (equipped.includes('Sword') || equipped.includes('Blade') || equipped.includes('dragonSlayer')) {
      weaponObj = (al.get('sword_1handed') || al.get('Sword_Bronze'))?.clone();
      if (weaponObj) weaponObj.rotation.set(0, 0, -Math.PI / 2);
    } else if (equipped === 'hammer') {
      weaponObj = al.get('hammer')?.clone();
    } else if (equipped === 'torch') {
      weaponObj = al.get('Torch_Metal')?.clone();
    } else if (equipped === 'huntingBow') {
      weaponObj = al.get('bow_withString')?.clone();
    } else if (equipped === 'runicStaff') {
      weaponObj = al.get('staff')?.clone();
    }

    if (weaponObj) {
      weaponObj.scale.set(0.7, 0.7, 0.7);
      this.pdWeaponModel = weaponObj;
      handNode.add(weaponObj);
    }
  }

  _startPaperdollLoop() {
    this._stopPaperdollLoop();
    const render = () => {
      if (!this.isOpen) return;
      if (this.pdRenderer && this.pdScene && this.pdCamera) {
        if (!this.pdDragging && this.pdModel) {
          this.pdAngle += 0.005;
          this.pdModel.rotation.y = this.pdAngle;
        }
        this.pdRenderer.render(this.pdScene, this.pdCamera);
      }
      this.pdAnimReq = requestAnimationFrame(render);
    };
    this.pdAnimReq = requestAnimationFrame(render);
  }

  _stopPaperdollLoop() {
    if (this.pdAnimReq) {
      cancelAnimationFrame(this.pdAnimReq);
      this.pdAnimReq = null;
    }
  }

  // ============================================================
  // EQUIPMENT SLOTS
  // ============================================================
  _renderEquipment() {
    const isFi = Localization.lang === 'fi';

    // 1. Head
    const headIconEl = document.getElementById('bp-icon-head');
    const headLabelEl = document.getElementById('bp-label-head');
    const isHood = this.player?.charConfig?.headStyle === 'hood';
    if (headIconEl) headIconEl.textContent = isHood ? '🧕' : '🧔';
    if (headLabelEl) headLabelEl.textContent = isHood ? (isFi ? 'Huppu' : 'Hood') : (isFi ? 'Hiukset' : 'Hair');

    // 2. Chest (Armor)
    const armorKey = this.inventory ? this.inventory.equippedArmor : 'none';
    const armorMeta = {
      none:         { icon: '👕', name: isFi ? 'Ei suojaa' : 'None' },
      leatherArmor: { icon: '🥋', name: isFi ? 'Nahka (-18%)' : 'Leather' },
      bronzeArmor:  { icon: '🪙', name: isFi ? 'Pronssi (-32%)' : 'Bronze' },
      beastArmor:   { icon: '🫀', name: isFi ? 'Talja (-40%)' : 'Beast' },
      ironArmor:    { icon: '⚔️', name: isFi ? 'Rauta (-52%)' : 'Iron' },
      scaleArmor:   { icon: '🐉', name: isFi ? 'Suomu (-62%)' : 'Scale' },
      steelArmor:   { icon: '🛡️', name: isFi ? 'Teräs (-70%)' : 'Steel' },
      plateArmor:   { icon: '💎', name: isFi ? 'Levy (-78%)' : 'Plate' },
      runicArmor:   { icon: '✨', name: isFi ? 'Riimu (-85%)' : 'Runic' },
      dragonArmor:  { icon: '👑', name: isFi ? 'Lohikäärme (-92%)' : 'Dragon' }
    };
    const curArmor = armorMeta[armorKey] || armorMeta.none;
    const chestIconEl = document.getElementById('bp-icon-chest');
    const chestLabelEl = document.getElementById('bp-label-chest');
    if (chestIconEl) chestIconEl.textContent = curArmor.icon;
    if (chestLabelEl) chestLabelEl.textContent = curArmor.name;

    // 3. Legs
    const legsIconEl = document.getElementById('bp-icon-legs');
    const legsLabelEl = document.getElementById('bp-label-legs');
    if (legsIconEl) legsIconEl.textContent = '👖';
    if (legsLabelEl) legsLabelEl.textContent = isFi ? 'Housut' : 'Trousers';

    // 4. Weapon
    const equipped = this.inventory ? this.inventory.equippedTool : null;
    let weaponName = isFi ? 'Nyrkit' : 'Fists';
    let weaponIcon = '✊';
    if (this.inventory && this.inventory.getItemName && equipped) {
      weaponName = this.inventory.getItemName(equipped);
    }
    const toolIcons = {
      stoneAxe: '🪓', bronzeAxe: '🪓', ironAxe: '🪓', blackMetalAxe: '🪓',
      pickaxe: '⛏️', antlerPickaxe: '🔱', bronzePickaxe: '⛏️', ironPickaxe: '⛏️', silverPickaxe: '⛏️',
      stoneSpear: '🗡️', hornSpear: '🔱', bronzeSword: '⚔️', scaleSword: '🗡️', ironSword: '⚔️', steelSword: '⚔️',
      silverSword: '❄️', titanHammer: '🔨', blackMetalSword: '🌌', runeblade: '💠', dragonSlayer: '🐉',
      huntingBow: '🏹', runicStaff: '🔮', hammer: '🔨', torch: '🔥', fishingRod: '🎣', hands: '✊'
    };
    if (equipped && toolIcons[equipped]) weaponIcon = toolIcons[equipped];

    const weaponIconEl = document.getElementById('bp-icon-weapon');
    const weaponLabelEl = document.getElementById('bp-label-weapon');
    if (weaponIconEl) weaponIconEl.textContent = weaponIcon;
    if (weaponLabelEl) weaponLabelEl.textContent = weaponName;

    // 5. Shield
    const hasShield = this.inventory && this.inventory.tools && this.inventory.tools.shield;
    const shieldIconEl = document.getElementById('bp-icon-shield');
    const shieldLabelEl = document.getElementById('bp-label-shield');
    if (shieldIconEl) shieldIconEl.textContent = hasShield ? '🛡️' : '⚪';
    if (shieldLabelEl) shieldLabelEl.textContent = hasShield ? (isFi ? 'Puukilpi' : 'Shield') : (isFi ? 'Ei kilpeä' : 'None');

    // 6. Belt / Tool
    const hasHammer = this.inventory && this.inventory.tools && this.inventory.tools.hammer;
    const isHammerEquipped = equipped === 'hammer';
    const toolIconEl = document.getElementById('bp-icon-tool');
    const toolLabelEl = document.getElementById('bp-label-tool');
    if (toolIconEl) toolIconEl.textContent = '🔨';
    if (toolLabelEl) toolLabelEl.textContent = isHammerEquipped ? (isFi ? 'Vasara [B]' : 'Hammer [B]') : (hasHammer ? (isFi ? 'Vyöllä' : 'On Belt') : (isFi ? 'Ei vasaraa' : 'None'));

    // Enable drag & drop onto equipment slots
    this._setupEquipmentDropTargets();
  }

  _setupEquipmentDropTargets() {
    const slots = document.querySelectorAll('.bp-slot-box');
    slots.forEach(slotEl => {
      slotEl.ondragover = (e) => {
        e.preventDefault();
        slotEl.classList.add('drag-over');
      };
      slotEl.ondragleave = () => {
        slotEl.classList.remove('drag-over');
      };
      slotEl.ondrop = (e) => {
        e.preventDefault();
        slotEl.classList.remove('drag-over');
        try {
          const raw = e.dataTransfer.getData('application/json');
          if (!raw) return;
          const data = JSON.parse(raw);
          const slotType = slotEl.getAttribute('data-slot');

          if (slotType === 'weapon' && data.isTool) {
            this.inventory.equip(data.key);
            if (this.hotbar) this.hotbar.sync();
            this.refresh();
          } else if (slotType === 'chest' && (data.key.includes('Armor') || data.key === 'none')) {
            this.inventory.equippedArmor = data.key;
            if (this.player && this.player.updateArmorAppearance) {
              this.player.updateArmorAppearance(data.key);
            }
            this.refresh();
          } else if (slotType === 'shield' && data.key === 'shield') {
            this.inventory.tools.shield = true;
            this.refresh();
          } else if (slotType === 'tool' && data.key === 'hammer') {
            this.inventory.equip('hammer');
            if (this.hotbar) this.hotbar.sync();
            this.refresh();
          }
        } catch (err) {}
      };
    });
  }

  // ============================================================
  // STATS CARD
  // ============================================================
  _renderStats() {
    if (!this.player) return;
    const isFi = Localization.lang === 'fi';

    const atk = `${this.inventory ? this.inventory.getWeaponDamage() : 15} DMG`;
    const defPct = this.inventory ? Math.round(this.inventory.getDamageReduction() * 100) : 0;
    const def = `${defPct}% (${isFi ? 'Panssari & Kilpi' : 'Armor & Shield'})`;
    const hp = `${Math.round(this.player.health)} / ${this.player.maxHealth}`;
    const hunger = `${Math.round(this.player.hunger)}%`;

    let totalWeight = 8;
    if (this.inventory) {
      for (const [item, qty] of Object.entries(this.inventory.items)) {
        totalWeight += qty * 1.5;
      }
    }
    const weight = `${Math.round(totalWeight)} / 300 kg`;

    if (this.statAtkEl) this.statAtkEl.textContent = atk;
    if (this.statDefEl) this.statDefEl.textContent = def;
    if (this.statHpEl) this.statHpEl.textContent = hp;
    if (this.statHungerEl) this.statHungerEl.textContent = hunger;
    if (this.statWeightEl) this.statWeightEl.textContent = weight;
  }

  // ============================================================
  // 24-SLOT INVENTORY GRID
  // ============================================================
  _renderGrid() {
    if (!this.itemsGridEl || !this.inventory) return;
    const isFi = Localization.lang === 'fi';

    const itemMeta = {
      wood:           { name: isFi ? 'Puu' : 'Wood', icon: '🪵', type: isFi ? 'Resurssi' : 'Resource' },
      stone:          { name: isFi ? 'Kivi' : 'Stone', icon: '🪨', type: isFi ? 'Resurssi' : 'Resource' },
      berry:          { name: isFi ? 'Villimarja' : 'Wild Berry', icon: '🫐', type: isFi ? 'Ruoka' : 'Food', usable: true },
      blueberry:      { name: isFi ? 'Mustikka' : 'Blueberry', icon: '🫐', type: isFi ? 'Ruoka' : 'Food', usable: true },
      raspberry:      { name: isFi ? 'Vadelma' : 'Raspberry', icon: '🍓', type: isFi ? 'Ruoka' : 'Food', usable: true },
      mushroom:       { name: isFi ? 'Kantarelli' : 'Chanterelle', icon: '🍄', type: isFi ? 'Ruoka' : 'Food', usable: true },
      honey:          { name: isFi ? 'Villihunaja' : 'Wild Honey', icon: '🍯', type: isFi ? 'Ruoka' : 'Food', usable: true },
      mushroomSoup:   { name: isFi ? 'Sienikeitto' : 'Mushroom Soup', icon: '🍲', type: isFi ? 'Ruoka' : 'Food', usable: true },
      meatStew:       { name: isFi ? 'Riistapata' : 'Meat Stew', icon: '🥘', type: isFi ? 'Ruoka' : 'Food', usable: true },
      honeyBread:     { name: isFi ? 'Hunajaleipä' : 'Honey Bread', icon: '🍞', type: isFi ? 'Ruoka' : 'Food', usable: true },
      apple:          { name: isFi ? 'Tunturiomena' : 'Apple', icon: '🍎', type: isFi ? 'Ruoka' : 'Food', usable: true },
      carrot:         { name: isFi ? 'Porkkana' : 'Carrot', icon: '🥕', type: isFi ? 'Ruoka' : 'Food', usable: true },
      meat:           { name: isFi ? 'Raaka petoliha' : 'Raw Meat', icon: '🥩', type: isFi ? 'Ruoka' : 'Food', usable: true },
      cookedMeat:     { name: isFi ? 'Paistettu liha' : 'Cooked Meat', icon: '🍖', type: isFi ? 'Ruoka' : 'Food', usable: true },
      trout:          { name: isFi ? 'Purotaimen' : 'Stream Trout', icon: '🐟', type: isFi ? 'Kala' : 'Fish', usable: true },
      pike:           { name: isFi ? 'Jokihauki' : 'River Pike', icon: '🦈', type: isFi ? 'Kala' : 'Fish', usable: true },
      salmon:         { name: isFi ? 'Kultainen lohi' : 'Salmon', icon: '🐠', type: isFi ? 'Kala' : 'Fish', usable: true },
      cookedFish:     { name: isFi ? 'Paistettu kala' : 'Cooked Fish', icon: '🍲', type: isFi ? 'Ruoka' : 'Food', usable: true },
      wheat:          { name: isFi ? 'Pellon vilja' : 'Wheat', icon: '🌾', type: isFi ? 'Raaka-aine' : 'Material' },
      bread:          { name: isFi ? 'Tuore leipä' : 'Bread', icon: '🍞', type: isFi ? 'Ruoka' : 'Food', usable: true },
      bandage:        { name: isFi ? 'Yrttiside' : 'Bandage', icon: '🩹', type: isFi ? 'Lääkintä' : 'Medicine', usable: true },
      leather:        { name: isFi ? 'Petonahka' : 'Leather', icon: '🥋', type: isFi ? 'Materiaali' : 'Material' },
      fang:           { name: isFi ? 'Petohammas' : 'Sharp Fang', icon: '🦷', type: isFi ? 'Materiaali' : 'Material' },
      resin:          { name: isFi ? 'Puu-hartsi' : 'Resin', icon: '🌲', type: isFi ? 'Polttoaine' : 'Fuel' },
      coal:           { name: isFi ? 'Puuhiili' : 'Charcoal', icon: '⚫', type: isFi ? 'Polttoaine' : 'Fuel' },
      copperOre:      { name: isFi ? 'Kuparimalmi' : 'Copper Ore', icon: '🥉', type: isFi ? 'Malmi' : 'Ore' },
      tinOre:         { name: isFi ? 'Tinamalmi' : 'Tin Ore', icon: '🪙', type: isFi ? 'Malmi' : 'Ore' },
      bronze:         { name: isFi ? 'Pronssiharkko' : 'Bronze Bar', icon: '🪙', type: isFi ? 'Metalli' : 'Metal' },
      ironOre:        { name: isFi ? 'Rautamalmi' : 'Iron Ore', icon: '🪨', type: isFi ? 'Malmi' : 'Ore' },
      iron:           { name: isFi ? 'Rautaharkko' : 'Iron Bar', icon: '🧱', type: isFi ? 'Metalli' : 'Metal' },
      steel:          { name: isFi ? 'Teräsharkko' : 'Steel Bar', icon: '🔩', type: isFi ? 'Metalli' : 'Metal' },
      silverOre:      { name: isFi ? 'Hopeamalmi' : 'Silver Ore', icon: '❄️', type: isFi ? 'Malmi' : 'Ore' },
      silver:         { name: isFi ? 'Hopeaharkko' : 'Silver Bar', icon: '✨', type: isFi ? 'Metalli' : 'Metal' },
      blackMetalScrap:{ name: isFi ? 'Mustametallijäte' : 'Blackmetal Scrap', icon: '🔮', type: isFi ? 'Malmi' : 'Ore' },
      blackMetal:     { name: isFi ? 'Mustametalliharkko' : 'Blackmetal Bar', icon: '🌌', type: isFi ? 'Metalli' : 'Metal' },
      flametalOre:    { name: isFi ? 'Tulimalmi' : 'Flametal Ore', icon: '🌋', type: isFi ? 'Malmi' : 'Ore' },
      dragonSteel:    { name: isFi ? 'Lohikäärmeteräs' : 'Dragonsteel', icon: '👑', type: isFi ? 'Legendaarinen' : 'Legendary' },
      hardAntler:     { name: isFi ? 'Kova Sarvi' : 'Hard Antler', icon: '🔱', type: isFi ? 'Pomoavain' : 'Boss Key' },
      swampKey:       { name: isFi ? 'Suoavain' : 'Swamp Key', icon: '🗝️', type: isFi ? 'Pomoavain' : 'Boss Key' },
      wishbone:       { name: isFi ? 'Maan Sydän' : 'Wishbone', icon: '🦴', type: isFi ? 'Pomoavain' : 'Boss Key' },
      artisanCore:    { name: isFi ? 'Riimumestarin Kide' : 'Artisan Core', icon: '💠', type: isFi ? 'Pomoavain' : 'Boss Key' },
      dragonTears:    { name: isFi ? 'Varjokyynel' : 'Dragon Tears', icon: '💧', type: isFi ? 'Pomoavain' : 'Boss Key' },
      bone:           { name: isFi ? 'Kirottu luu' : 'Cursed Bone', icon: '🦴', type: isFi ? 'Materiaali' : 'Material' },
      slime:          { name: isFi ? 'Suoliejua' : 'Swamp Slime', icon: '🧪', type: isFi ? 'Materiaali' : 'Material' },
      wolfPelt:       { name: isFi ? 'Sudentalja' : 'Wolf Pelt', icon: '🐺', type: isFi ? 'Materiaali' : 'Material' },
      shadow_essence: { name: isFi ? 'Varjoesanssi' : 'Shadow Essence', icon: '🔮', type: isFi ? 'Harvinainen' : 'Rare' },
      beastHeart:     { name: isFi ? 'Sarvisydän' : 'Beast Heart', icon: '🫀', type: isFi ? 'Pomomateriaali' : 'Boss Material' },
      swampScale:     { name: isFi ? 'Vesipedon Suomu' : 'Swamp Scale', icon: '🐉', type: isFi ? 'Pomomateriaali' : 'Boss Material' },
      graniteCore:    { name: isFi ? 'Graniittiydin' : 'Granite Core', icon: '💎', type: isFi ? 'Pomomateriaali' : 'Boss Material' },
      runeCore:       { name: isFi ? 'Riimuydin' : 'Rune Core', icon: '💠', type: isFi ? 'Pomomateriaali' : 'Boss Material' },
      dragonCrown:    { name: isFi ? 'Varjokruunu' : 'Shadow Crown', icon: '👑', type: isFi ? 'Pomomateriaali' : 'Boss Material' }
    };

    const slots = [];
    // Collect non-zero items
    for (const [key, qty] of Object.entries(this.inventory.items)) {
      if (qty > 0 && itemMeta[key]) {
        slots.push({ key, qty, meta: itemMeta[key] });
      }
    }

    // Add crafted/owned tools
    const toolMeta = {
      torch:           { name: isFi ? 'Soihtu' : 'Torch', icon: '🔥', type: isFi ? 'Valonlähde' : 'Light Source' },
      stoneAxe:        { name: isFi ? 'Kivikirves' : 'Stone Axe', icon: '🪓', type: isFi ? 'Kirves' : 'Axe' },
      bronzeAxe:       { name: isFi ? 'Pronssikirves' : 'Bronze Axe', icon: '🪓', type: isFi ? 'Kirves' : 'Axe' },
      ironAxe:         { name: isFi ? 'Rautakirves' : 'Iron Axe', icon: '🪓', type: isFi ? 'Kirves' : 'Axe' },
      blackMetalAxe:   { name: isFi ? 'Mustametallikirves' : 'Blackmetal Axe', icon: '🪓', type: isFi ? 'Kirves' : 'Axe' },
      pickaxe:         { name: isFi ? 'Kivihakku' : 'Stone Pickaxe', icon: '⛏️', type: isFi ? 'Hakku' : 'Pickaxe' },
      antlerPickaxe:   { name: isFi ? 'Sarvihakku' : 'Antler Pickaxe', icon: '🔱', type: isFi ? 'Hakku' : 'Pickaxe' },
      bronzePickaxe:   { name: isFi ? 'Pronssihakku' : 'Bronze Pickaxe', icon: '⛏️', type: isFi ? 'Hakku' : 'Pickaxe' },
      ironPickaxe:     { name: isFi ? 'Rautahakku' : 'Iron Pickaxe', icon: '⛏️', type: isFi ? 'Hakku' : 'Pickaxe' },
      silverPickaxe:   { name: isFi ? 'Vuoristohakku' : 'Mountain Pickaxe', icon: '⛏️', type: isFi ? 'Hakku' : 'Pickaxe' },
      stoneSpear:      { name: isFi ? 'Kivikeihäs' : 'Stone Spear', icon: '🗡️', type: isFi ? 'Ase' : 'Weapon' },
      hornSpear:       { name: isFi ? 'Sarvikeihäs' : 'Horn Spear', icon: '🔱', type: isFi ? 'Ase' : 'Weapon' },
      bronzeSword:     { name: isFi ? 'Pronssimiekka' : 'Bronze Sword', icon: '⚔️', type: isFi ? 'Ase' : 'Weapon' },
      scaleSword:      { name: isFi ? 'Suomumiekka' : 'Scale Sword', icon: '🗡️', type: isFi ? 'Ase' : 'Weapon' },
      ironSword:       { name: isFi ? 'Rautamiekka' : 'Iron Sword', icon: '⚔️', type: isFi ? 'Ase' : 'Weapon' },
      steelSword:      { name: isFi ? 'Teräsmiekka' : 'Steel Sword', icon: '⚔️', type: isFi ? 'Ase' : 'Weapon' },
      silverSword:     { name: isFi ? 'Hopeamiekka' : 'Silver Sword', icon: '❄️', type: isFi ? 'Ase' : 'Weapon' },
      titanHammer:     { name: isFi ? 'Titaanivasara' : 'Titan Hammer', icon: '🔨', type: isFi ? 'Ase' : 'Weapon' },
      blackMetalSword: { name: isFi ? 'Mustametalliterä' : 'Blackmetal Blade', icon: '🌌', type: isFi ? 'Ase' : 'Weapon' },
      runeblade:       { name: isFi ? 'Riimumiekka' : 'Runic Blade', icon: '💠', type: isFi ? 'Ase' : 'Weapon' },
      dragonSlayer:    { name: isFi ? 'Draakinsurmaaja' : 'Dragonslayer', icon: '🐉', type: isFi ? 'Legendaarinen' : 'Legendary' },
      huntingBow:      { name: isFi ? 'Metsästäjän Jousi' : 'Hunting Bow', icon: '🏹', type: isFi ? 'Jousi' : 'Bow' },
      runicStaff:      { name: isFi ? 'Riimusauva' : 'Runic Staff', icon: '🔮', type: isFi ? 'Taikasauva' : 'Magic Staff' },
      hammer:          { name: isFi ? 'Rakennusvasara' : 'Building Hammer', icon: '🔨', type: isFi ? 'Työkalu' : 'Tool' },
      fishingRod:      { name: isFi ? 'Kalastusvapa' : 'Fishing Rod', icon: '🎣', type: isFi ? 'Kalastus' : 'Fishing' },
      shield:          { name: isFi ? 'Puukilpi' : 'Wood Shield', icon: '🛡️', type: isFi ? 'Suoja' : 'Shield' }
    };

    if (this.inventory.tools) {
      for (const [toolKey, isOwned] of Object.entries(this.inventory.tools)) {
        if (isOwned && toolMeta[toolKey] && toolKey !== 'hands') {
          slots.push({ key: toolKey, qty: 1, isTool: true, meta: toolMeta[toolKey] });
        }
      }
    }

    // Fill up to 24 slots (4 rows x 6 cols)
    const totalSlots = 24;
    let html = '';

    for (let i = 0; i < totalSlots; i++) {
      if (i < slots.length) {
        const item = slots[i];
        const isSelected = this.selectedItemKey === item.key;
        html += `
          <div class="bp-grid-slot has-item ${isSelected ? 'selected-slot' : ''}" draggable="true" data-item="${item.key}" data-istool="${item.isTool || false}">
            <div class="bp-slot-icon">${item.meta.icon}</div>
            <div class="bp-slot-name">${item.meta.name}</div>
            ${item.qty > 1 ? `<div class="bp-slot-qty">x${item.qty}</div>` : ''}
            <div class="bp-slot-type">${item.meta.type}</div>
          </div>
        `;
      } else {
        html += `
          <div class="bp-grid-slot empty">
            <div class="bp-slot-empty-dot">•</div>
          </div>
        `;
      }
    }

    this.itemsGridEl.innerHTML = html;

    // Attach click and drag events
    const slotElements = this.itemsGridEl.querySelectorAll('.bp-grid-slot.has-item');
    slotElements.forEach((slotEl, idx) => {
      const item = slots[idx];
      if (!item) return;

      // HTML5 Drag
      slotEl.ondragstart = (e) => {
        slotEl.classList.add('drag-source');
        const payload = JSON.stringify({
          type: 'inventory',
          key: item.key,
          isTool: !!item.isTool,
          meta: item.meta
        });
        e.dataTransfer.setData('text/plain', payload);
        e.dataTransfer.setData('application/json', payload);
      };
      slotEl.ondragend = () => {
        slotEl.classList.remove('drag-source');
      };

      // Click to select & show Drop Bar
      slotEl.addEventListener('click', () => {
        this.selectedItemKey = item.key;
        this.selectedIsTool = !!item.isTool;
        this.selectedItemMeta = item.meta;

        if (this.actionsBarEl) {
          this.actionsBarEl.style.display = 'flex';
          if (this.selectedItemNameEl) {
            this.selectedItemNameEl.textContent = `${item.meta.icon} ${item.meta.name} ${item.qty > 1 ? `(x${item.qty})` : ''}`;
          }
        }

        // Highlight selected
        this.itemsGridEl.querySelectorAll('.bp-grid-slot').forEach(s => s.classList.remove('selected-slot'));
        slotEl.classList.add('selected-slot');
      });

      // Double-click to equip or consume
      slotEl.addEventListener('dblclick', () => {
        if (item.isTool) {
          this.inventory.equip(item.key);
          if (this.hotbar) this.hotbar.sync();
          this.refresh();
          if (this.hud) this.hud.showNotification(isFi ? `Varustettu: ${item.meta.name}` : `Equipped: ${item.meta.name}`);
        } else if (item.meta && item.meta.usable) {
          this.inventory.consume(item.key, this.player);
          if (this.hotbar) this.hotbar.sync();
          this.refresh();
        }
      });
    });
  }

  // ============================================================
  // ACTION BAR (HOTBAR 1-8) REORDERING GRID
  // ============================================================
  _renderHotbarReorder() {
    if (!this.hotbarGridEl || !this.hotbar || !this.hotbar.slots) return;

    let html = '';
    this.hotbar.slots.forEach((slot, i) => {
      const isSelectedForSwap = this.selectedHotbarIndex === i;
      const isActiveInGame = this.hotbar.activeSlot === i;
      html += `
        <div class="bp-hb-slot ${isSelectedForSwap ? 'selected-swap' : ''} ${isActiveInGame ? 'active-slot' : ''}" draggable="true" data-hb-idx="${i}" title="${slot.name}">
          <span class="bp-hb-key">[${slot.key || (i + 1)}]</span>
          <span class="bp-hb-icon">${slot.icon}</span>
          <span class="bp-hb-name">${slot.name}</span>
        </div>
      `;
    });

    this.hotbarGridEl.innerHTML = html;

    const hbSlots = this.hotbarGridEl.querySelectorAll('.bp-hb-slot');
    hbSlots.forEach((el, i) => {
      // Click-to-assign from inventory OR click-to-swap hotbar slots
      el.addEventListener('click', () => {
        if (this.selectedItemKey) {
          // Assign inventory item/tool into this hotbar slot
          this.hotbar.setSlotItem(i, this.selectedItemKey, this.selectedIsTool, this.selectedItemMeta);
          const assignedName = this.selectedItemMeta ? this.selectedItemMeta.name : this.selectedItemKey;
          this.selectedItemKey = null;
          this.selectedIsTool = false;
          this.selectedItemMeta = null;
          this.selectedHotbarIndex = null;
          this._renderHotbarReorder();
          this.refresh();
          if (this.hud) {
            this.hud.showNotification(Localization.lang === 'fi' ? `Asetettu paikkaan [${i + 1}]: ${assignedName}` : `Assigned to slot [${i + 1}]: ${assignedName}`);
          }
          return;
        }

        if (this.selectedHotbarIndex === null) {
          this.selectedHotbarIndex = i;
          this._renderHotbarReorder();
        } else if (this.selectedHotbarIndex === i) {
          this.selectedHotbarIndex = null;
          this._renderHotbarReorder();
        } else {
          // Perform swap between selectedHotbarIndex and i
          this.hotbar.swapSlots(this.selectedHotbarIndex, i);
          this.selectedHotbarIndex = null;
          this._renderHotbarReorder();
          if (this.hud) {
            this.hud.showNotification(Localization.lang === 'fi' ? 'Pikanäppäimet järjestetty!' : 'Hotbar reordered!');
          }
        }
      });

      // HTML5 Drag between hotbar slots OR from inventory grid onto hotbar slot
      el.ondragstart = (e) => {
        const payload = JSON.stringify({
          type: 'hotbar',
          index: i
        });
        e.dataTransfer.setData('text/plain', payload);
        e.dataTransfer.setData('application/json', payload);
      };

      el.ondragover = (e) => {
        e.preventDefault();
        el.classList.add('drag-over');
      };

      el.ondragleave = () => {
        el.classList.remove('drag-over');
      };

      el.ondrop = (e) => {
        e.preventDefault();
        el.classList.remove('drag-over');
        try {
          const raw = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('application/json');
          if (!raw) return;
          const data = JSON.parse(raw);

          if (data.type === 'hotbar' && data.index !== undefined) {
            // Swap two hotbar slots
            this.hotbar.swapSlots(data.index, i);
            this.selectedHotbarIndex = null;
            this._renderHotbarReorder();
          } else if (data.type === 'inventory' && data.key) {
            // Assign inventory item/tool into this hotbar slot
            this.hotbar.setSlotItem(i, data.key, data.isTool, data.meta);
            this._renderHotbarReorder();
            if (this.hud) {
              this.hud.showNotification(Localization.lang === 'fi' ? `Asetettu paikkaan [${i + 1}]: ${data.meta?.name || data.key}` : `Bound to [${i + 1}]: ${data.meta?.name || data.key}`);
            }
          }
        } catch (err) {}
      };
    });
  }
}
