import Localization from './Localization.js';

/**
 * Hotbar & Action Bar – Displays both:
 * 1. Special Skills Bar (Pikanäppäimet [1] - [4] erikoisliikkeille)
 * 2. Equipment & Tools Action Bar (Aseet, Kirves, Hakku, Soihtu, Vasara, Ruoka)
 * With crystal clear icons for Axe (🪓) and Pickaxe (⛏️).
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

    this.activeSlot = 4; // Starts with Torch active (slot index 4: Soihtu)
    this.isFistsMode = false;
    this.highestWeaponId = null;
    this.slots = [
      { id: 'fists', key: 'X', type: 'tool', toolId: 'hands', name: 'Fists', icon: '✊', count: 1 },
      { id: 'weapon', key: 'F', type: 'tool', toolId: 'stoneSpear', name: 'Weapon', icon: '⚔️', count: 1 },
      { id: 'axe', key: 'Z', type: 'tool', toolId: 'stoneAxe', name: 'Axe', icon: '🪓', count: 1 },
      { id: 'pickaxe', key: 'V', type: 'tool', toolId: 'pickaxe', name: 'Pickaxe', icon: '⛏️', count: 1 },
      { id: 'torch', key: '5', type: 'tool', toolId: 'torch', name: 'Torch', icon: '🔥', count: 1 },
      { id: 'hammer', key: '6', type: 'build', toolId: 'hammer', name: 'Hammer', icon: '🔨', count: 1 },
      { id: 'rod', key: '7', type: 'tool', toolId: 'fishingRod', name: 'Fishing Rod', icon: '🎣', count: 1 },
      { id: 'food', key: '8', type: 'consume', itemId: 'berry', fallbackItemId: 'cookedMeat', name: 'Food', icon: '🫐', count: 0 }
    ];

    this.container = null;
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
          <span class="skill-slot-name">${hasSkill ? s.name.split(' ')[1] : 'Tyhjä'}</span>
          ${cd > 0 ? `<div class="skill-cd-overlay">${cd}s</div>` : ''}
        </div>
      `;
    }
    skillsHtml += '</div>';

    // 2. Equipment / Tool Hotbar
    let toolsHtml = '<div class="hotbar-tools-row">';
    this.slots.forEach((slot, index) => {
      const isActive = index === this.activeSlot;
      const hasItem = slot.count > 0 || (this.inventory && this.inventory.tools && this.inventory.tools[slot.toolId]);
      const itemClass = hasItem ? 'has-item' : 'empty-item';
      const countLabel = (slot.type === 'consume' || slot.count > 1) && slot.count > 0 ? `<span class="hotbar-count">${slot.count}</span>` : '';

      toolsHtml += `
        <div class="hotbar-slot ${isActive ? 'active' : ''} ${itemClass}" data-slot="${index}" title="${slot.name}">
          ${slot.key ? `<span class="hotbar-key-badge">[${slot.key}]</span>` : ''}
          <span class="hotbar-icon">${slot.icon}</span>
          <span class="hotbar-name">${slot.name}</span>
          ${countLabel}
          ${!hasItem && slot.id !== 'fists' ? `<span class="hotbar-craft-hint">${Localization.t('hotbar_craft_hint', 'craft [C]')}</span>` : ''}
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

    // Dedicated keydown for quickly toggling fists [X] or [0]
    window.addEventListener('keydown', (e) => {
      const mainMenu = document.getElementById('main-menu');
      if (mainMenu && mainMenu.style.display !== 'none') return;
      if (this.skillTree && this.skillTree.isOpen) return;
      if (document.getElementById('crafting-menu')?.classList.contains('active')) return;
      if (document.getElementById('backpack-screen')?.classList.contains('active')) return;
      if (document.getElementById('map-screen')?.classList.contains('active')) return;
      if (document.getElementById('pause-menu')?.classList.contains('active')) return;

      // Dedicated keyboard shortcuts for hotbar slots
      if (e.code === 'KeyX' || e.code === 'Digit0') {
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
        this.selectSlot(2, true);
        return;
      }
      if (e.code === 'KeyV') {
        e.preventDefault();
        this.selectSlot(3, true);
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
      if (e.shiftKey) {
        if (e.code === 'Digit1') { e.preventDefault(); this.selectSlot(0, true); return; }
        if (e.code === 'Digit2') { e.preventDefault(); this.selectSlot(1, true); return; }
        if (e.code === 'Digit3') { e.preventDefault(); this.selectSlot(2, true); return; }
        if (e.code === 'Digit4') { e.preventDefault(); this.selectSlot(3, true); return; }
      }
    });

    // Mouse wheel scrolling across tools bar (throttled to prevent rapid event spam)
    window.addEventListener('wheel', (e) => {
      const mainMenu = document.getElementById('main-menu');
      if (mainMenu && mainMenu.style.display !== 'none') return;
      if (this.skillTree && this.skillTree.isOpen) return;
      if (document.getElementById('crafting-menu')?.classList.contains('active')) return;
      if (document.getElementById('backpack-screen')?.classList.contains('active')) return;
      if (document.getElementById('map-screen')?.classList.contains('active')) return;
      if (document.getElementById('modal-settings')?.classList.contains('active')) return;
      if (document.getElementById('modal-instructions')?.classList.contains('active')) return;
      if (document.getElementById('dev-mode-panel')?.style.display !== 'none') return;
      if (document.getElementById('building-selector-modal')?.style.display !== 'none') return;
      if (e.ctrlKey || e.shiftKey || e.altKey) return; // Ctrl/Shift+Wheel is reserved for camera zoom

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
    for (let step = 1; step <= 8; step++) {
      const idx = (currentIdx + direction * step + 8) % 8;
      const slot = this.slots[idx];
      if (slot.type === 'tool') {
        const hasTool = slot.toolId === 'hands' || (this.inventory && this.inventory.tools && this.inventory.tools[slot.toolId]);
        if (hasTool) return idx;
      } else if (slot.type === 'build') {
        if (this.inventory && this.inventory.tools && this.inventory.tools.hammer) return idx;
      } else if (slot.type === 'consume') {
        if (this.inventory && (this.inventory.has(slot.itemId, 1) || (slot.fallbackItemId && this.inventory.has(slot.fallbackItemId, 1)))) return idx;
      }
    }
    return 0; // Hands (fists) is always available fallback
  }

  selectSlot(index, activate = false) {
    if (index < 0 || index >= 8) return;
    const previousSlot = this.activeSlot;

    if (previousSlot === index && !activate && index !== 7) return; // Already in this slot
    this.activeSlot = index;
    const slot = this.slots[index];

    // Update active highlight class in DOM without destroying HTML tree
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

    if (slot.type === 'tool') {
      if (this.buildingSystem) {
        this.buildingSystem.setHammerActive(false);
      }

      // Slot 0 is bare fists / hands
      if (slot.id === 'fists') {
        if (this.inventory) this.inventory.equip(null);
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
          this.hud.showNotification(`⚠️ Sinulla ei ole vielä esinettä: ${slot.icon} ${slot.name}. Valmista se painamalla [C]!`, 2000);
        }
        return;
      }

      if (this.inventory) {
        this.inventory.equip(slot.toolId);
      }
      if (this.combat) {
        this.combat.equipTool(slot.toolId);
      }
      if (this.player && this.player.updateHeldWeapon) {
        this.player.updateHeldWeapon();
      }
      if (this.hud && previousSlot !== index) {
        this.hud.showNotification(`⚔️ Varustettu: ${slot.icon} ${slot.name}`, 1500);
      }
    } else if (slot.type === 'build') {
      const hasHammer = this.inventory && this.inventory.tools && this.inventory.tools.hammer;
      if (!hasHammer) {
        if (this.hud && previousSlot !== index) {
          this.hud.showNotification(`⚠️ Valmista Rakennusvasara [C]-valikosta ennen rakentamista!`, 2000);
        }
        return;
      }

      if (this.inventory) this.inventory.equip('hammer');
      if (this.combat) this.combat.equipTool('hammer');
      if (this.player && this.player.updateHeldWeapon) {
        this.player.updateHeldWeapon();
      }
      if (this.buildingSystem) {
        this.buildingSystem.setHammerActive(true);
      }
      if (this.hud && previousSlot !== index) {
        this.hud.showNotification(`🔨 Rakennusvasara aktivoitu! [Q/E] Selaa paloja, [B] Valikko`, 2000);
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
            this.hud.showNotification(`❌ Ei syötävää tai ensiapua: ${slot.name}`);
          }
        }
      }
    }
  }

  sync() {
    if (!this.inventory) return;
    const t = this.inventory.tools || {};

    // 0. Fists (Always available bare fists)
    this.slots[0].toolId = 'hands';
    this.slots[0].name = Localization.t('slot_hands', 'Fists');
    this.slots[0].icon = '✊';
    this.slots[0].count = 1;

    // 1. Weapon Slot (Dragon Slayer down to Bow, Staff, Swords, Spear)
    let bestWeaponId = null;
    let bestWeaponName = Localization.t('tool_stoneSpear', 'Stone Spear');
    let bestWeaponIcon = '🗡️';

    if (t.dragonSlayer) {
      bestWeaponId = 'dragonSlayer';
      bestWeaponName = Localization.t('tool_dragonSlayer', 'Dragonslayer');
      bestWeaponIcon = '🐉';
    } else if (t.runeblade) {
      bestWeaponId = 'runeblade';
      bestWeaponName = Localization.t('tool_runeblade', 'Runic Blade');
      bestWeaponIcon = '💠';
    } else if (t.blackMetalSword) {
      bestWeaponId = 'blackMetalSword';
      bestWeaponName = Localization.t('tool_blackMetalSword', 'Blackmetal Blade');
      bestWeaponIcon = '🌌';
    } else if (t.titanHammer) {
      bestWeaponId = 'titanHammer';
      bestWeaponName = Localization.t('tool_titanHammer', 'Titan War Hammer');
      bestWeaponIcon = '🔨';
    } else if (t.silverSword) {
      bestWeaponId = 'silverSword';
      bestWeaponName = Localization.t('tool_silverSword', 'Silver Sword');
      bestWeaponIcon = '❄️';
    } else if (t.steelSword) {
      bestWeaponId = 'steelSword';
      bestWeaponName = Localization.t('tool_steelSword', 'Steel Sword');
      bestWeaponIcon = '🛡️';
    } else if (t.scaleSword) {
      bestWeaponId = 'scaleSword';
      bestWeaponName = Localization.t('tool_scaleSword', 'Scale Sword');
      bestWeaponIcon = '🗡️';
    } else if (t.huntingBow) {
      bestWeaponId = 'huntingBow';
      bestWeaponName = Localization.t('tool_huntingBow', 'Hunting Bow');
      bestWeaponIcon = '🏹';
    } else if (t.runicStaff) {
      bestWeaponId = 'runicStaff';
      bestWeaponName = Localization.t('tool_runicStaff', 'Runic Staff');
      bestWeaponIcon = '🔮';
    } else if (t.ironSword) {
      bestWeaponId = 'ironSword';
      bestWeaponName = Localization.t('tool_ironSword', 'Iron Sword');
      bestWeaponIcon = '⚔️';
    } else if (t.hornSpear) {
      bestWeaponId = 'hornSpear';
      bestWeaponName = Localization.t('tool_hornSpear', 'Horn Spear');
      bestWeaponIcon = '🔱';
    } else if (t.bronzeSword) {
      bestWeaponId = 'bronzeSword';
      bestWeaponName = Localization.t('tool_bronzeSword', 'Bronze Sword');
      bestWeaponIcon = '⚔️';
    } else if (t.stoneSpear) {
      bestWeaponId = 'stoneSpear';
      bestWeaponName = Localization.t('tool_stoneSpear', 'Stone Spear');
      bestWeaponIcon = '🗡️';
    }

    this.highestWeaponId = bestWeaponId;
    this.slots[1].toolId = bestWeaponId || 'stoneSpear';
    this.slots[1].name = bestWeaponId ? bestWeaponName : Localization.t('slot_weapon', 'Weapon');
    this.slots[1].icon = bestWeaponId ? bestWeaponIcon : '⚔️';
    this.slots[1].count = bestWeaponId ? 1 : 0;

    // 2. Axe Slot (ALWAYS HAS 🪓 ICON!)
    this.slots[2].icon = '🪓';
    if (t.blackMetalAxe) {
      this.slots[2].toolId = 'blackMetalAxe';
      this.slots[2].name = Localization.t('tool_blackMetalAxe', 'Blackmetal Axe');
      this.slots[2].count = 1;
    } else if (t.ironAxe) {
      this.slots[2].toolId = 'ironAxe';
      this.slots[2].name = Localization.t('tool_ironAxe', 'Iron Axe');
      this.slots[2].count = 1;
    } else if (t.bronzeAxe) {
      this.slots[2].toolId = 'bronzeAxe';
      this.slots[2].name = Localization.t('tool_bronzeAxe', 'Bronze Axe');
      this.slots[2].count = 1;
    } else if (t.stoneAxe) {
      this.slots[2].toolId = 'stoneAxe';
      this.slots[2].name = Localization.t('tool_stoneAxe', 'Stone Axe');
      this.slots[2].count = 1;
    } else {
      this.slots[2].toolId = 'stoneAxe';
      this.slots[2].name = Localization.t('slot_axe', 'Axe');
      this.slots[2].count = 0;
    }

    // 3. Pickaxe Slot (ALWAYS HAS ⛏️ ICON!)
    this.slots[3].icon = '⛏️';
    if (t.silverPickaxe) {
      this.slots[3].toolId = 'silverPickaxe';
      this.slots[3].name = Localization.t('tool_pickaxe', 'Mountain Pickaxe');
      this.slots[3].count = 1;
    } else if (t.ironPickaxe) {
      this.slots[3].toolId = 'ironPickaxe';
      this.slots[3].name = Localization.t('tool_ironPickaxe', 'Iron Pickaxe');
      this.slots[3].count = 1;
    } else if (t.bronzePickaxe) {
      this.slots[3].toolId = 'bronzePickaxe';
      this.slots[3].name = Localization.t('tool_bronzePickaxe', 'Bronze Pickaxe');
      this.slots[3].count = 1;
    } else if (t.antlerPickaxe) {
      this.slots[3].toolId = 'antlerPickaxe';
      this.slots[3].name = Localization.t('tool_antlerPickaxe', 'Antler Pickaxe');
      this.slots[3].count = 1;
    } else if (t.pickaxe) {
      this.slots[3].toolId = 'pickaxe';
      this.slots[3].name = Localization.t('tool_pickaxe', 'Stone Pickaxe');
      this.slots[3].count = 1;
    } else {
      this.slots[3].toolId = 'pickaxe';
      this.slots[3].name = Localization.t('slot_pickaxe', 'Pickaxe');
      this.slots[3].count = 0;
    }

    // 4. Torch Slot (ALWAYS HAS 🔥 ICON!)
    this.slots[4].icon = '🔥';
    this.slots[4].toolId = 'torch';
    this.slots[4].name = Localization.t('slot_torch', 'Torch');
    this.slots[4].count = t.torch ? 1 : 0;

    // 5. Building Hammer
    this.slots[5].icon = '🔨';
    this.slots[5].toolId = 'hammer';
    this.slots[5].name = Localization.t('slot_hammer', 'Hammer');
    this.slots[5].count = t.hammer ? 1 : 0;

    // 6. Fishing Rod
    this.slots[6].icon = '🎣';
    this.slots[6].toolId = 'fishingRod';
    this.slots[6].name = Localization.t('slot_rod', 'Fishing Rod');
    this.slots[6].count = t.fishingRod ? 1 : 0;

    // 7. Food / Healing
    const berryCount = this.inventory.items.berry || 0;
    const appleCount = this.inventory.items.apple || 0;
    const cookedMeatCount = this.inventory.items.cookedMeat || 0;
    const breadCount = this.inventory.items.bread || 0;
    const bandageCount = this.inventory.items.bandage || 0;
    if (cookedMeatCount > 0) {
      this.slots[7].icon = '🍖';
      this.slots[7].name = Localization.t('item_cookedMeat', 'Cooked Meat');
      this.slots[7].itemId = 'cookedMeat';
      this.slots[7].count = cookedMeatCount;
    } else if (breadCount > 0) {
      this.slots[7].icon = '🍞';
      this.slots[7].name = 'Bread';
      this.slots[7].itemId = 'bread';
      this.slots[7].count = breadCount;
    } else if (appleCount > 0) {
      this.slots[7].icon = '🍎';
      this.slots[7].name = 'Apple';
      this.slots[7].itemId = 'apple';
      this.slots[7].count = appleCount;
    } else if (bandageCount > 0) {
      this.slots[7].icon = '🩹';
      this.slots[7].name = Localization.t('slot_bandage', 'Bandage');
      this.slots[7].itemId = 'bandage';
      this.slots[7].count = bandageCount;
    } else {
      this.slots[7].icon = '🫐';
      this.slots[7].name = Localization.t('item_berry', 'Berries');
      this.slots[7].itemId = 'berry';
      this.slots[7].count = berryCount;
    }
    // Targeted in-place DOM updates: ZERO layout thrashing, ZERO memory leaks!
    if (!this.container) return;
    const slotEls = this.container.querySelectorAll('.hotbar-slot');
    slotEls.forEach((slotEl, index) => {
      const slot = this.slots[index];
      if (!slot) return;
      const isActive = index === this.activeSlot;
      const hasItem = slot.count > 0 || (this.inventory && this.inventory.tools && this.inventory.tools[slot.toolId]);

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
      if (iconEl && iconEl.textContent !== slot.icon) iconEl.textContent = slot.icon;

      const nameEl = slotEl.querySelector('.hotbar-name');
      if (nameEl && nameEl.textContent !== slot.name) nameEl.textContent = slot.name;

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

      let hintEl = slotEl.querySelector('.hotbar-craft-hint');
      const showHint = !hasItem && slot.id !== 'fists' && slot.id !== 'weapon';
      if (showHint) {
        if (!hintEl) {
          hintEl = document.createElement('span');
          hintEl.className = 'hotbar-craft-hint';
          hintEl.textContent = 'valmista [C]';
          slotEl.appendChild(hintEl);
        }
      } else if (hintEl) {
        hintEl.remove();
      }
    });

    // Also update skill hotbar slots in-place
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
}
