import Localization from './Localization.js';

/**
 * Hotbar & Action Bar – Displays both:
 * 1. Special Skills Bar (Pikanäppäimet [1] - [4] erikoisliikkeille)
 * 2. Equipment & Tools Action Bar (Aseet, Kirves, Hakku, Soihtu, Vasara, Ruoka)
 * With crystal clear fantasy icons.
 */
export default class Hotbar {
  constructor(inventory, player, buildingSystem, combat, hud, audioManager, skillTree = null) {
    this.inventory = inventory;
    this.player = player;
    this.buildingSystem = buildingSystem;
    this.combat = combat;
    this.hud = hud;
    this.audioManager = audioManager;
    this.skillTree = skillTree;

    this.activeSlot = 0; // Starts with Hands / Fists active (slot index 0)
    this.isFistsMode = true;
    this.highestWeaponId = null;
    this.isCustomized = !!localStorage.getItem('tikapoo_hotbar_slots');
    this.slots = [
      { id: 'fists', key: '1', type: 'tool', toolId: 'hands', name: 'Nyrkit', icon: '✊', count: 1 },
      { id: 'weapon', key: '2', type: 'empty', toolId: null, name: 'Miekka/Ase', icon: '—', count: 0 },
      { id: 'ranged', key: '3', type: 'empty', toolId: null, name: 'Jousi/Sauva', icon: '—', count: 0 },
      { id: 'axe', key: '4', type: 'empty', toolId: null, name: 'Kirves', icon: '—', count: 0 },
      { id: 'pickaxe', key: '5', type: 'empty', toolId: null, name: 'Hakku', icon: '—', count: 0 },
      { id: 'torch', key: '6', type: 'tool', toolId: 'torch', name: 'Soihtu', icon: '🔥', count: 1 },
      { id: 'hammer', key: '7', type: 'empty', toolId: null, name: 'Vasara', icon: '—', count: 0 },
      { id: 'rod', key: '8', type: 'empty', toolId: null, name: 'Onki', icon: '—', count: 0 },
      { id: 'food', key: '9', type: 'empty', itemId: null, name: 'Ruoka', icon: '—', count: 0 },
      { id: 'medicine', key: '0', type: 'empty', itemId: null, name: 'Lääkintä', icon: '—', count: 0 }
    ];

    this.container = null;
    this._loadSlots();
    this._initUI();
    this._setupListeners();
    this.sync();
  }

  _initUI() {
    let el = document.getElementById('hotbar');
    if (!el) {
      el = document.createElement('div');
      el.id = 'hotbar';
      el.className = 'hotbar-root-container';
      document.body.appendChild(el);
    }
    this.container = el;
    this.render();
  }

  render() {
    if (!this.container) return;

    // 1. Special Abilities Bar (Keys 1-4)
    const st = this.skillTree;
    let skillsHtml = '<div class="hotbar-skills-bar">';
    for (let i = 0; i < 4; i++) {
      const skillId = (st && st.activeSlots) ? st.activeSlots[i] : null;
      const s = (st && skillId && st.skills) ? st.skills[skillId] : null;
      const cd = (st && skillId && st.cooldowns) ? Math.ceil(st.cooldowns[skillId]) : 0;
      const hasSkill = s && s.unlocked;

      skillsHtml += `
        <div class="skill-hotbar-slot ${hasSkill ? 'has-skill' : 'empty-skill'} ${cd > 0 ? 'on-cooldown' : ''}" data-skill-slot="${i}">
          <span class="skill-key-badge">[${i + 1}]</span>
          <span class="skill-slot-icon">${hasSkill ? s.name.split(' ')[0] : '🔒'}</span>
          <span class="skill-slot-name">${hasSkill ? s.name.split(' ')[1] : Localization.t('hotbar_empty', 'Empty')}</span>
          ${cd > 0 ? `<div class="skill-cd-overlay">${cd}s</div>` : ''}
        </div>
      `;
    }
    skillsHtml += '</div>';

    // 2. Equipment / Tool Hotbar
    let toolsHtml = '<div class="hotbar-tools-row">';
    this.slots.forEach((slot, index) => {
      const isActive = index === this.activeSlot;
      const isEmpty = slot.type === 'empty' || (!slot.count && slot.id !== 'fists');
      const hasItem = !isEmpty;
      const itemClass = hasItem ? 'has-item' : 'empty-item';
      const countLabel = (slot.type === 'consume' || slot.count > 1) && slot.count > 0 ? `<span class="hotbar-count">${slot.count}</span>` : '';
      const renderedIcon = hasItem ? getIcon(slot.toolId || slot.itemId || slot.id || slot.icon) : '—';

      toolsHtml += `
        <div class="hotbar-slot ${isActive ? 'active' : ''} ${itemClass}" data-slot="${index}" title="${hasItem ? slot.name : ''}">
          ${slot.key ? `<span class="hotbar-key-badge">[${slot.key}]</span>` : ''}
          <span class="hotbar-icon">${renderedIcon}</span>
          <span class="hotbar-name">${hasItem ? slot.name : Localization.t('hotbar_empty', 'Empty')}</span>
          ${countLabel}
        </div>
      `;
    });
    toolsHtml += '</div>';

    this.container.innerHTML = skillsHtml + toolsHtml;

    // Attach touch & click listeners to skill slots (1-4)
    this.container.querySelectorAll('.skill-hotbar-slot').forEach(el => {
      const onSelectSkill = (e) => {
        e.stopPropagation();
        e.preventDefault();
        const slotIdx = parseInt(el.getAttribute('data-skill-slot'), 10);
        if (this.skillTree) this.skillTree.castSlot(slotIdx);
      };
      el.addEventListener('pointerdown', onSelectSkill);
    });

    // Attach touch & click listeners to tools slots
    this.container.querySelectorAll('.hotbar-slot').forEach(slotEl => {
      const onSelectTool = (e) => {
        e.stopPropagation();
        e.preventDefault();
        const slotIdx = parseInt(slotEl.getAttribute('data-slot'), 10);
        this.selectSlot(slotIdx, true);
      };
      slotEl.addEventListener('pointerdown', onSelectTool);
    });
  }

  update(delta) {
    if (!this.container || !this.skillTree) return;
    const slots = this.container.querySelectorAll('.skill-hotbar-slot');
    slots.forEach((el, i) => {
      const skillId = this.skillTree.activeSlots ? this.skillTree.activeSlots[i] : null;
      const cd = (skillId && this.skillTree.cooldowns && this.skillTree.cooldowns[skillId]) ? Math.ceil(this.skillTree.cooldowns[skillId]) : 0;
      let cdOverlay = el.querySelector('.skill-cd-overlay');
      if (cd > 0) {
        el.classList.add('on-cooldown');
        if (!cdOverlay) {
          cdOverlay = document.createElement('div');
          cdOverlay.className = 'skill-cd-overlay';
          el.appendChild(cdOverlay);
        }
        cdOverlay.textContent = `${cd}s`;
      } else {
        el.classList.remove('on-cooldown');
        if (cdOverlay) {
          cdOverlay.remove();
        }
      }
    });
  }

  _setupListeners() {
    let lastWheelTime = 0;

    window.addEventListener('keydown', (e) => {
      if (e.defaultPrevented) return;
      const mainMenu = document.getElementById('main-menu');
      if (mainMenu && getComputedStyle(mainMenu).display !== 'none') return;
      if (this.skillTree && this.skillTree.isOpen) return;
      if (document.getElementById('crafting-menu')?.classList.contains('active')) return;
      if (document.getElementById('backpack-screen')?.classList.contains('active')) return;
      if (document.getElementById('map-screen')?.classList.contains('active')) return;
      if (document.getElementById('pause-menu')?.classList.contains('active')) return;

      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;

      if (e.code === 'KeyX') {
        e.preventDefault();
        this.selectSlot(0, true);
        return;
      }
      if (e.code === 'KeyF') {
        e.preventDefault();
        this.selectSlot(1, true);
        return;
      }
      if (e.code === 'KeyZ') {
        e.preventDefault();
        this.selectSlot(3, true);
        return;
      }
      if (e.code === 'KeyV') {
        e.preventDefault();
        this.selectSlot(4, true);
        return;
      }
      if (e.code === 'Digit5') {
        e.preventDefault();
        this.selectSlot(4, true);
        return;
      }
      if (e.code === 'Digit6') {
        e.preventDefault();
        this.selectSlot(5, true);
        return;
      }
      if (e.code === 'Digit7') {
        e.preventDefault();
        this.selectSlot(6, true);
        return;
      }
      if (e.code === 'Digit8') {
        e.preventDefault();
        this.selectSlot(7, true);
        return;
      }
      if (e.code === 'Digit9') {
        e.preventDefault();
        this.selectSlot(8, true);
        return;
      }
      if (e.code === 'Digit0') {
        e.preventDefault();
        this.selectSlot(9, true);
        return;
      }
      if (e.shiftKey) {
        if (e.code === 'Digit1') { e.preventDefault(); this.selectSlot(0, true); return; }
        if (e.code === 'Digit2') { e.preventDefault(); this.selectSlot(1, true); return; }
        if (e.code === 'Digit3') { e.preventDefault(); this.selectSlot(2, true); return; }
        if (e.code === 'Digit4') { e.preventDefault(); this.selectSlot(3, true); return; }
      }
    });

    window.addEventListener('wheel', (e) => {
      const mainMenu = document.getElementById('main-menu');
      if (mainMenu && getComputedStyle(mainMenu).display !== 'none') return;
      if (this.skillTree && this.skillTree.isOpen) return;
      if (document.getElementById('crafting-menu')?.classList.contains('active')) return;
      if (document.getElementById('backpack-screen')?.classList.contains('active')) return;
      if (document.getElementById('map-screen')?.classList.contains('active')) return;
      if (document.getElementById('modal-settings')?.classList.contains('active')) return;
      if (document.getElementById('modal-instructions')?.classList.contains('active')) return;
      if (document.getElementById('dev-mode-panel')?.style.display !== 'none') return;
      if (document.getElementById('building-selector-modal')?.style.display !== 'none') return;
      if (e.ctrlKey || e.shiftKey || e.altKey) return;

      const now = performance.now();
      if (now - lastWheelTime < 140) return;
      lastWheelTime = now;

      if (e.deltaY > 0) {
        const next = this.findNextAvailableSlot(this.activeSlot, 1);
        this.selectSlot(next, false);
      } else if (e.deltaY < 0) {
        const prev = this.findNextAvailableSlot(this.activeSlot, -1);
        this.selectSlot(prev, false);
      }
    }, { passive: true });
  }

  toggleFists() {
    this.isFistsMode = !this.isFistsMode;
    this.activeSlot = 0;
    if (this.buildingSystem) {
      this.buildingSystem.setHammerActive(false);
    }
    this.sync();

    if (this.isFistsMode) {
      if (this.inventory) this.inventory.equip(null);
      if (this.combat) this.combat.equipTool('hands');
      if (this.player && this.player.updateHeldWeapon) this.player.updateHeldWeapon();
      if (this.hud) {
        this.hud.showNotification(Localization.t('fists_equipped', '✊ Nyrkit varustettu (Fists equipped)'), 1500);
      }
    } else {
      const wep = this.highestWeaponId;
      if (this.inventory) this.inventory.equip(wep);
      if (this.combat) this.combat.equipTool(wep || 'hands');
      if (this.player && this.player.updateHeldWeapon) this.player.updateHeldWeapon();
      if (this.hud) {
        this.hud.showNotification(Localization.t('weapon_equipped', `⚔️ Varustettu: ${this.slots[0].name}`), 1500);
      }
    }

    if (this.container) {
      const slotEls = this.container.querySelectorAll('.hotbar-slot');
      slotEls.forEach((el, idx) => {
        if (idx === 0) el.classList.add('active');
        else el.classList.remove('active');
      });
    }
  }

  findNextAvailableSlot(currentIdx, direction) {
    const totalSlots = this.slots.length;
    for (let step = 1; step <= totalSlots; step++) {
      const idx = (currentIdx + direction * step + totalSlots) % totalSlots;
      const slot = this.slots[idx];
      if (!slot || slot.type === 'empty') continue;
      if (slot.type === 'tool') {
        const hasTool = slot.toolId === 'hands' || (this.inventory && this.inventory.tools && this.inventory.tools[slot.toolId]);
        if (hasTool) return idx;
      } else if (slot.type === 'build') {
        if (this.inventory && this.inventory.tools && this.inventory.tools.hammer) return idx;
      } else if (slot.type === 'consume') {
        if (this.inventory && slot.itemId && this.inventory.has(slot.itemId, 1)) return idx;
      }
    }
    return 0;
  }

  selectSlot(index, activate = false) {
    if (index < 0 || index >= this.slots.length) return;
    const previousSlot = this.activeSlot;

    if (previousSlot === index && !activate && index !== 8 && index !== 9) return;
    this.activeSlot = index;
    const slot = this.slots[index];

    if (this.container) {
      const slotEls = this.container.querySelectorAll('.hotbar-slot');
      slotEls.forEach((el, idx) => {
        if (idx === index) el.classList.add('active');
        else el.classList.remove('active');
      });
    }

    if (previousSlot !== index && this.audioManager && this.audioManager.playClick) {
      this.audioManager.playClick();
    }

    if (!slot || slot.type === 'empty') {
      if (this.buildingSystem) {
        this.buildingSystem.setHammerActive(false);
      }
      if (this.hud && previousSlot !== index) {
        this.hud.showNotification(Localization.t('slot_empty_msg', 'Tämä paikka on tyhjä.'), 1500);
      }
      return;
    }

    if (slot.type === 'tool') {
      if (this.buildingSystem) {
        this.buildingSystem.setHammerActive(false);
      }

      if (slot.id === 'fists' || slot.toolId === 'hands') {
        if (this.inventory) this.inventory.equip('hands');
        if (this.combat) this.combat.equipTool('hands');
        if (this.player && this.player.updateHeldWeapon) this.player.updateHeldWeapon();
        if (this.hud && previousSlot !== index) {
          this.hud.showNotification(Localization.t('fists_equipped', '✊ Nyrkit varustettu (Fists equipped)'), 1500);
        }
        return;
      }

      const hasTool = (this.inventory && this.inventory.tools && this.inventory.tools[slot.toolId]);
      if (!hasTool) {
        if (this.hud && previousSlot !== index) {
          this.hud.showNotification(Localization.t('slot_empty_msg', 'Tämä paikka on tyhjä.'), 1500);
        }
        return;
      }

      if (this.inventory) this.inventory.equip(slot.toolId);
      if (this.combat) this.combat.equipTool(slot.toolId);
      if (this.player && this.player.updateHeldWeapon) this.player.updateHeldWeapon();
      if (this.hud && previousSlot !== index) {
        this.hud.showNotification(`${Localization.t('notif_equipped_item', 'Varustettu:')} ${slot.name}`, 1500);
      }
    } else if (slot.type === 'build') {
      const hasHammer = this.inventory && this.inventory.tools && this.inventory.tools.hammer;
      if (!hasHammer) {
        if (this.hud && previousSlot !== index) {
          this.hud.showNotification(Localization.t('notif_craft_hammer_first', '⚠️ Valmista Rakennusvasara [C]-valikosta ennen rakentamista!'), 2000);
        }
        return;
      }

      if (this.inventory) this.inventory.equip('hammer');
      if (this.combat) this.combat.equipTool('hammer');
      if (this.player && this.player.updateHeldWeapon) this.player.updateHeldWeapon();
      if (this.buildingSystem) this.buildingSystem.setHammerActive(true);
      if (this.hud && previousSlot !== index) {
        this.hud.showNotification(Localization.t('notif_hammer_active', '🔨 Rakennusvasara aktivoitu! [Q/E] Selaa paloja, [B] Valikko'), 2000);
      }
    } else if (slot.type === 'consume') {
      if (this.buildingSystem) {
        this.buildingSystem.setHammerActive(false);
      }
      if (activate || previousSlot === index) {
        const itemId = (this.inventory.has(slot.itemId, 1)) ? slot.itemId : (slot.fallbackItemId && this.inventory.has(slot.fallbackItemId, 1) ? slot.fallbackItemId : null);
        if (itemId && this.player) {
          this.inventory.consume(itemId, this.player);
          this.sync();
        } else {
          if (this.hud) {
            this.hud.showNotification(Localization.t('notif_no_food', '❌ Ei syötävää tai ensiapua') + `: ${slot.name}`);
          }
        }
      }
    }
  }

  sync() {
    if (!this.inventory) return;
    const t = this.inventory.tools || {};

    if (this.isCustomized) {
      this.slots.forEach(slot => {
        if (!slot) return;
        if (slot.type === 'tool') {
          const toolId = slot.toolId;
          const hasTool = (toolId === 'hands') ? true : !!(t && t[toolId]);
          slot.count = hasTool ? 1 : 0;
        } else if (slot.type === 'build') {
          const hasHammer = !!(t && t.hammer);
          slot.count = hasHammer ? 1 : 0;
        } else if (slot.type === 'consume') {
          slot.count = (this.inventory && this.inventory.items && this.inventory.items[slot.itemId]) || 0;
        }
      });
    } else {
      // 0. Fists
      this.slots[0].type = 'tool';
      this.slots[0].toolId = 'hands';
      this.slots[0].name = Localization.t('slot_hands', 'Fists');
      this.slots[0].icon = '✊';
      this.slots[0].count = 1;

      // 1. Primary Melee Weapon Slot
      let bestWeaponId = null;
      let bestWeaponName = '';
      let bestWeaponIcon = '🗡️';

      if (t.dragonSlayer) { bestWeaponId = 'dragonSlayer'; bestWeaponName = Localization.t('tool_dragonSlayer', 'Dragonslayer'); }
      else if (t.runeblade) { bestWeaponId = 'runeblade'; bestWeaponName = Localization.t('tool_runeblade', 'Runic Blade'); }
      else if (t.blackMetalSword) { bestWeaponId = 'blackMetalSword'; bestWeaponName = Localization.t('tool_blackMetalSword', 'Blackmetal Blade'); }
      else if (t.titanHammer) { bestWeaponId = 'titanHammer'; bestWeaponName = Localization.t('tool_titanHammer', 'Titan War Hammer'); }
      else if (t.silverSword) { bestWeaponId = 'silverSword'; bestWeaponName = Localization.t('tool_silverSword', 'Silver Sword'); }
      else if (t.steelSword) { bestWeaponId = 'steelSword'; bestWeaponName = Localization.t('tool_steelSword', 'Steel Sword'); }
      else if (t.scaleSword) { bestWeaponId = 'scaleSword'; bestWeaponName = Localization.t('tool_scaleSword', 'Scale Sword'); }
      else if (t.ironSword) { bestWeaponId = 'ironSword'; bestWeaponName = Localization.t('tool_ironSword', 'Iron Sword'); }
      else if (t.hornSpear) { bestWeaponId = 'hornSpear'; bestWeaponName = Localization.t('tool_hornSpear', 'Horn Spear'); }
      else if (t.bronzeSword) { bestWeaponId = 'bronzeSword'; bestWeaponName = Localization.t('tool_bronzeSword', 'Bronze Sword'); }
      else if (t.stoneSpear) { bestWeaponId = 'stoneSpear'; bestWeaponName = Localization.t('tool_stoneSpear', 'Stone Spear'); }

      this.highestWeaponId = bestWeaponId;
      if (bestWeaponId) {
        this.slots[1].type = 'tool';
        this.slots[1].toolId = bestWeaponId;
        this.slots[1].name = bestWeaponName;
        this.slots[1].icon = bestWeaponIcon;
        this.slots[1].count = 1;
      } else {
        this.slots[1].type = 'empty';
        this.slots[1].toolId = null;
        this.slots[1].name = Localization.t('hotbar_empty', 'Empty');
        this.slots[1].icon = '—';
        this.slots[1].count = 0;
      }

      // 2. Ranged / Magic
      let rangedId = null;
      let rangedName = '';
      if (t.huntingBow) { rangedId = 'huntingBow'; rangedName = Localization.t('tool_huntingBow', 'Hunting Bow'); }
      else if (t.runicStaff) { rangedId = 'runicStaff'; rangedName = Localization.t('tool_runicStaff', 'Runic Staff'); }

      if (rangedId) {
        this.slots[2].type = 'tool';
        this.slots[2].toolId = rangedId;
        this.slots[2].name = rangedName;
        this.slots[2].count = 1;
      } else {
        this.slots[2].type = 'empty';
        this.slots[2].toolId = null;
        this.slots[2].name = Localization.t('hotbar_empty', 'Empty');
        this.slots[2].count = 0;
      }

      // 3. Axe
      let axeId = null;
      let axeName = '';
      if (t.blackMetalAxe) { axeId = 'blackMetalAxe'; axeName = Localization.t('tool_blackMetalAxe', 'Blackmetal Axe'); }
      else if (t.ironAxe) { axeId = 'ironAxe'; axeName = Localization.t('tool_ironAxe', 'Iron Axe'); }
      else if (t.bronzeAxe) { axeId = 'bronzeAxe'; axeName = Localization.t('tool_bronzeAxe', 'Bronze Axe'); }
      else if (t.stoneAxe) { axeId = 'stoneAxe'; axeName = Localization.t('tool_stoneAxe', 'Stone Axe'); }

      if (axeId) {
        this.slots[3].type = 'tool';
        this.slots[3].toolId = axeId;
        this.slots[3].name = axeName;
        this.slots[3].count = 1;
      } else {
        this.slots[3].type = 'empty';
        this.slots[3].toolId = null;
        this.slots[3].name = Localization.t('hotbar_empty', 'Empty');
        this.slots[3].count = 0;
      }

      // 4. Pickaxe
      let pickId = null;
      let pickName = '';
      if (t.silverPickaxe) { pickId = 'silverPickaxe'; pickName = Localization.t('tool_pickaxe', 'Mountain Pickaxe'); }
      else if (t.ironPickaxe) { pickId = 'ironPickaxe'; pickName = Localization.t('tool_ironPickaxe', 'Iron Pickaxe'); }
      else if (t.bronzePickaxe) { pickId = 'bronzePickaxe'; pickName = Localization.t('tool_bronzePickaxe', 'Bronze Pickaxe'); }
      else if (t.antlerPickaxe) { pickId = 'antlerPickaxe'; pickName = Localization.t('tool_antlerPickaxe', 'Antler Pickaxe'); }
      else if (t.pickaxe) { pickId = 'pickaxe'; pickName = Localization.t('tool_pickaxe', 'Stone Pickaxe'); }

      if (pickId) {
        this.slots[4].type = 'tool';
        this.slots[4].toolId = pickId;
        this.slots[4].name = pickName;
        this.slots[4].count = 1;
      } else {
        this.slots[4].type = 'empty';
        this.slots[4].toolId = null;
        this.slots[4].name = Localization.t('hotbar_empty', 'Empty');
        this.slots[4].count = 0;
      }

      // 5. Torch
      if (t.torch) {
        this.slots[5].type = 'tool';
        this.slots[5].toolId = 'torch';
        this.slots[5].name = Localization.t('slot_torch', 'Torch');
        this.slots[5].count = 1;
      } else {
        this.slots[5].type = 'empty';
        this.slots[5].toolId = null;
        this.slots[5].name = Localization.t('hotbar_empty', 'Empty');
        this.slots[5].count = 0;
      }

      // 6. Hammer
      if (t.hammer) {
        this.slots[6].type = 'build';
        this.slots[6].toolId = 'hammer';
        this.slots[6].name = Localization.t('slot_hammer', 'Hammer');
        this.slots[6].count = 1;
      } else {
        this.slots[6].type = 'empty';
        this.slots[6].toolId = null;
        this.slots[6].name = Localization.t('hotbar_empty', 'Empty');
        this.slots[6].count = 0;
      }

      // 7. Rod
      if (t.fishingRod) {
        this.slots[7].type = 'tool';
        this.slots[7].toolId = 'fishingRod';
        this.slots[7].name = Localization.t('slot_rod', 'Fishing Rod');
        this.slots[7].count = 1;
      } else {
        this.slots[7].type = 'empty';
        this.slots[7].toolId = null;
        this.slots[7].name = Localization.t('hotbar_empty', 'Empty');
        this.slots[7].count = 0;
      }

      // 8. Food
      const berryCount = (this.inventory && this.inventory.items && this.inventory.items.berry) || 0;
      const appleCount = (this.inventory && this.inventory.items && this.inventory.items.apple) || 0;
      const cookedMeatCount = (this.inventory && this.inventory.items && this.inventory.items.cookedMeat) || 0;
      const breadCount = (this.inventory && this.inventory.items && this.inventory.items.bread) || 0;

      if (cookedMeatCount > 0) {
        this.slots[8].type = 'consume';
        this.slots[8].itemId = 'cookedMeat';
        this.slots[8].name = Localization.t('item_cookedMeat', 'Cooked Meat');
        this.slots[8].count = cookedMeatCount;
      } else if (breadCount > 0) {
        this.slots[8].type = 'consume';
        this.slots[8].itemId = 'bread';
        this.slots[8].name = Localization.t('item_bread', 'Bread');
        this.slots[8].count = breadCount;
      } else if (appleCount > 0) {
        this.slots[8].type = 'consume';
        this.slots[8].itemId = 'apple';
        this.slots[8].name = Localization.t('item_apple', 'Apple');
        this.slots[8].count = appleCount;
      } else if (berryCount > 0) {
        this.slots[8].type = 'consume';
        this.slots[8].itemId = 'berry';
        this.slots[8].name = Localization.t('item_berry', 'Berries');
        this.slots[8].count = berryCount;
      } else {
        this.slots[8].type = 'empty';
        this.slots[8].itemId = null;
        this.slots[8].name = Localization.t('hotbar_empty', 'Empty');
        this.slots[8].count = 0;
      }

      // 9. Medicine
      const bandageCount = (this.inventory && this.inventory.items && this.inventory.items.bandage) || 0;
      const potionHealthCount = (this.inventory && this.inventory.items && (this.inventory.items.potion_health || this.inventory.items.potion)) || 0;
      const potionStaminaCount = (this.inventory && this.inventory.items && this.inventory.items.potion_stamina) || 0;

      if (bandageCount > 0) {
        this.slots[9].type = 'consume';
        this.slots[9].itemId = 'bandage';
        this.slots[9].name = Localization.t('slot_bandage', 'Bandage');
        this.slots[9].count = bandageCount;
      } else if (potionHealthCount > 0) {
        this.slots[9].type = 'consume';
        this.slots[9].itemId = 'potion_health';
        this.slots[9].name = Localization.t('item_potion', 'Mead of Health');
        this.slots[9].count = potionHealthCount;
      } else if (potionStaminaCount > 0) {
        this.slots[9].type = 'consume';
        this.slots[9].itemId = 'potion_stamina';
        this.slots[9].name = 'Kestävyysrohto';
        this.slots[9].count = potionStaminaCount;
      } else {
        this.slots[9].type = 'empty';
        this.slots[9].itemId = null;
        this.slots[9].name = Localization.t('hotbar_empty', 'Empty');
        this.slots[9].count = 0;
      }
    }

    if (!this.container) return;
    const slotEls = this.container.querySelectorAll('.hotbar-slot');
    slotEls.forEach((slotEl, index) => {
      const slot = this.slots[index];
      if (!slot) return;
      const isActive = index === this.activeSlot;
      const isEmpty = slot.type === 'empty' || (!slot.count && slot.toolId !== 'hands');
      const hasItem = !isEmpty;

      if (isActive) slotEl.classList.add('active');
      else slotEl.classList.remove('active');

      if (hasItem) {
        slotEl.classList.add('has-item');
        slotEl.classList.remove('empty-item');
      } else {
        slotEl.classList.add('empty-item');
        slotEl.classList.remove('has-item');
      }

      const iconEl = slotEl.querySelector('.hotbar-icon');
      const currentIconHtml = hasItem ? getIcon(slot.toolId || slot.itemId || slot.id || slot.icon) : '—';
      if (iconEl && iconEl.innerHTML !== currentIconHtml) {
        iconEl.innerHTML = currentIconHtml;
      }

      const nameEl = slotEl.querySelector('.hotbar-name');
      const currentName = hasItem ? slot.name : Localization.t('hotbar_empty', 'Empty');
      if (nameEl && nameEl.textContent !== currentName) nameEl.textContent = currentName;

      let countEl = slotEl.querySelector('.hotbar-count');
      const showCount = (slot.type === 'consume' || slot.count > 1) && slot.count > 0;
      if (showCount) {
        if (!countEl) {
          countEl = document.createElement('span');
          countEl.className = 'hotbar-count';
          slotEl.appendChild(countEl);
        }
        countEl.textContent = slot.count;
      } else if (countEl) {
        countEl.remove();
      }
    });

    const st = this.skillTree;
    const skillEls = this.container.querySelectorAll('.skill-hotbar-slot');
    skillEls.forEach((el, i) => {
      const skillId = (st && st.activeSlots) ? st.activeSlots[i] : null;
      const s = (st && skillId && st.skills) ? st.skills[skillId] : null;
      const hasSkill = s && s.unlocked;

      if (hasSkill) {
        el.classList.add('has-skill');
        el.classList.remove('empty-skill');
      } else {
        el.classList.add('empty-skill');
        el.classList.remove('has-skill');
      }

      const sIcon = el.querySelector('.skill-slot-icon');
      const sName = el.querySelector('.skill-slot-name');
      if (sIcon) sIcon.textContent = hasSkill ? s.name.split(' ')[0] : '🔒';
      if (sName) sName.textContent = hasSkill ? s.name.split(' ')[1] : 'Tyhjä';
    });
  }

  swapSlots(indexA, indexB) {
    if (indexA < 0 || indexA >= this.slots.length || indexB < 0 || indexB >= this.slots.length || indexA === indexB) return;
    const a = this.slots[indexA];
    const b = this.slots[indexB];

    const tempKeyA = a.key;
    const tempKeyB = b.key;
    this.slots[indexA] = { ...b, key: tempKeyA };
    this.slots[indexB] = { ...a, key: tempKeyB };

    this.isCustomized = true;
    this._saveSlots();
    this.sync();
    this.render();
  }

  setSlotItem(index, itemKey, isTool = false, meta = null) {
    if (index < 0 || index >= this.slots.length) return;
    const currentKey = this.slots[index].key;
    if (isTool) {
      this.slots[index] = {
        id: itemKey,
        key: currentKey,
        type: itemKey === 'hammer' ? 'build' : 'tool',
        toolId: itemKey,
        name: meta ? meta.name : itemKey,
        icon: meta ? meta.icon : '⚔️',
        count: (this.inventory && this.inventory.tools && this.inventory.tools[itemKey]) ? 1 : 0
      };
    } else {
      this.slots[index] = {
        id: itemKey,
        key: currentKey,
        type: 'consume',
        itemId: itemKey,
        fallbackItemId: null,
        name: meta ? meta.name : itemKey,
        icon: meta ? meta.icon : '📦',
        count: this.inventory ? (this.inventory.items[itemKey] || 0) : 1
      };
    }
    this.isCustomized = true;
    this._saveSlots();
    this.sync();
    this.render();
  }

  _saveSlots() {
    try {
      const data = this.slots.map(s => ({
        id: s.id,
        key: s.key,
        type: s.type,
        toolId: s.toolId,
        itemId: s.itemId,
        name: s.name,
        icon: s.icon
      }));
      localStorage.setItem('tikapoo_hotbar_slots', JSON.stringify(data));
    } catch (e) {}
  }

  _loadSlots() {
    try {
      const saved = localStorage.getItem('tikapoo_hotbar_slots');
      if (saved) {
        const data = JSON.parse(saved);
        if (Array.isArray(data) && data.length === this.slots.length) {
          data.forEach((d, i) => {
            if (d && d.id) {
              this.slots[i] = { ...this.slots[i], ...d };
            }
          });
        }
      }
    } catch (e) {}
  }
}

// ==========================================
// UUDET PIKSELIKUVAKKEET (/assets/kuvakkeet)
// ==========================================
const ICON_BASE_PATH = '/assets/kuvakkeet';

export const ITEM_ICONS = {
  // 1. Nyrkit & lähitaisteluaseet
  hands: `${ICON_BASE_PATH}/tile095.png`,            // Nyrkki
  fists: `${ICON_BASE_PATH}/tile095.png`,            // Nyrkki
  sword: `${ICON_BASE_PATH}/tile080.png`,            // Perusmiekka
  stoneSpear: `${ICON_BASE_PATH}/tile086.png`,       // Keihäs / pistomiekka
  bronzeSword: `${ICON_BASE_PATH}/tile081.png`,      // Pronssimiekka
  hornSpear: `${ICON_BASE_PATH}/tile087.png`,        // Sarvikeihäs
  ironSword: `${ICON_BASE_PATH}/tile082.png`,        // Rautamiekka
  scaleSword: `${ICON_BASE_PATH}/tile083.png`,       // Suomumiekka
  steelSword: `${ICON_BASE_PATH}/tile084.png`,       // Teräsmiekka
  silverSword: `${ICON_BASE_PATH}/tile085.png`,      // Hopeamiekka
  blackMetalSword: `${ICON_BASE_PATH}/tile088.png`,  // Mustametallimiekka
  runeblade: `${ICON_BASE_PATH}/tile089.png`,        // Riimumiekka
  dragonSlayer: `${ICON_BASE_PATH}/tile090.png`,     // Lohikäärmeen surmaaja
  titanHammer: `${ICON_BASE_PATH}/tile093.png`,      // Titaanivasara / sotavasara

  // 2. Kirveet
  axe: `${ICON_BASE_PATH}/tile161.png`,              // Peruskirves
  stoneAxe: `${ICON_BASE_PATH}/tile161.png`,         // Kivikirves
  bronzeAxe: `${ICON_BASE_PATH}/tile161.png`,        // Pronssikirves
  ironAxe: `${ICON_BASE_PATH}/tile091.png`,          // Rautataistelukirves
  blackMetalAxe: `${ICON_BASE_PATH}/tile092.png`,     // Mustametallikirves

  // 3. Hakut
  pickaxe: `${ICON_BASE_PATH}/tile162.png`,          // Perushakku
  antlerPickaxe: `${ICON_BASE_PATH}/tile162.png`,    // Sarvihakku
  bronzePickaxe: `${ICON_BASE_PATH}/tile163.png`,    // Pronssihakku
  ironPickaxe: `${ICON_BASE_PATH}/tile163.png`,      // Rautahakku
  silverPickaxe: `${ICON_BASE_PATH}/tile163.png`,    // Vuoristohakku

  // 4. Työkalut & kaukoaseet
  hammer: `${ICON_BASE_PATH}/tile165.png`,           // Rakennusvasara
  torch: `${ICON_BASE_PATH}/tile169.png`,            // Soihtu
  huntingBow: `${ICON_BASE_PATH}/tile099.png`,       // Metsästysjousi
  bow: `${ICON_BASE_PATH}/tile099.png`,              // Jousi
  runicStaff: `${ICON_BASE_PATH}/tile104.png`,       // Riimusauva / sauva
  fishingRod: `${ICON_BASE_PATH}/tile256.png`,       // Onkivapa
  rod: `${ICON_BASE_PATH}/tile256.png`,              // Onki

  // 5. Rakennusmateriaalit & resurssit
  wood: `${ICON_BASE_PATH}/tile265.png`,             // Hirsipuu / puu
  stone: `${ICON_BASE_PATH}/tile266.png`,            // Kivi
  iron: `${ICON_BASE_PATH}/tile268.png`,             // Rauta / metalliharkko

  // 6. Ruoat & ravinto
  cookedMeat: `${ICON_BASE_PATH}/tile239.png`,       // Kypsennetty liha / paisti
  meat: `${ICON_BASE_PATH}/tile240.png`,             // Raaka liha
  bread: `${ICON_BASE_PATH}/tile236.png`,            // Leipä
  apple: `${ICON_BASE_PATH}/tile224.png`,            // Omena
  berry: `${ICON_BASE_PATH}/tile228.png`,            // Marjat

  // 7. Ensiapu & taikajuomat
  bandage: `${ICON_BASE_PATH}/tile159.png`,          // Ensiapuside / sideharso
  potion_health: `${ICON_BASE_PATH}/tile148.png`,    // Terveysjuoma (punainen)
  potion_stamina: `${ICON_BASE_PATH}/tile149.png`    // Kestävyysjuoma (vihreä)
};

export function getIcon(id) {
  const iconPath = ITEM_ICONS[id];
  if (iconPath) {
    return `<img src="${iconPath}" class="hotbar-icon-img" alt="${id}" draggable="false" />`;
  }
  return id || '—';
}