import Localization from './Localization.js';
import { explorationTracker } from './ExplorationTracker.js';

/**
 * SaveSystem – Nordic RPG Full Save & Load Management
 * Supports:
 * 1. Automatic & manual local save (localStorage)
 * 2. File Download (tikapoo_savegame.json export)
 * 3. File Upload / Import (.json load from player's device)
 * Serializes:
 * - Character appearance & name
 * - Player position & stats (HP, hunger, stamina)
 * - Inventory items, tools, equipped armor & weapons
 * - Hotbar custom ordering
 * - Player-built structures & Valheim bases
 * - Exploration Fog of War
 * - Day / Night cycle & time
 * - Quest progress & skill tree
 */
export default class SaveSystem {
  constructor({ player, inventory, hotbar, buildingSystem, explorationTracker, dayNightCycle, questManager, skillTree, world, hud }) {
    this.player = player;
    this.inventory = inventory;
    this.hotbar = hotbar;
    this.buildingSystem = buildingSystem;
    this.explorationTracker = explorationTracker;
    this.dayNightCycle = dayNightCycle;
    this.questManager = questManager;
    this.skillTree = skillTree;
    this.world = world;
    this.hud = hud;

    this.saveKey = 'tikapoo_savegame';
  }

  hasSave() {
    try {
      const data = localStorage.getItem(this.saveKey);
      return !!data && data.length > 20;
    } catch (e) {
      return false;
    }
  }

  createSavePayload() {
    const isFi = Localization.lang === 'fi';
    const charConfig = this.player?.charConfig || {};
    const pos = this.player?.getPosition ? this.player.getPosition() : { x: 0, y: 1.5, z: 0 };

    const payload = {
      version: 1,
      timestamp: Date.now(),
      saveDate: new Date().toLocaleString(),
      character: {
        name: charConfig.name || 'Eerik',
        gender: charConfig.gender || 'male',
        style: charConfig.style || 'rogue',
        headStyle: charConfig.headStyle || 'hair',
        hairStyle: charConfig.hairStyle || 'short',
        hairColor: charConfig.hairColor || 0x3d2817,
        skinColor: charConfig.skinColor || 0xf5d0b5,
        clothingColor: charConfig.clothingColor || 0x2e5339,
        model: charConfig.model || 'Rogue'
      },
      player: {
        x: Math.round(pos.x * 100) / 100,
        y: Math.round(pos.y * 100) / 100,
        z: Math.round(pos.z * 100) / 100,
        health: this.player?.health || 100,
        maxHealth: this.player?.maxHealth || 100,
        stamina: this.player?.stamina || 100,
        hunger: this.player?.hunger || 100
      },
      inventory: {
        items: this.inventory ? { ...this.inventory.items } : {},
        tools: this.inventory ? { ...this.inventory.tools } : {},
        equippedTool: this.inventory ? this.inventory.equippedTool : 'hands',
        equippedArmor: this.inventory ? this.inventory.equippedArmor : 'none'
      },
      hotbar: {
        isCustomized: !!this.hotbar?.isCustomized,
        slots: this.hotbar?.slots ? this.hotbar.slots.map(s => ({
          id: s.id,
          key: s.key,
          type: s.type,
          toolId: s.toolId,
          itemId: s.itemId,
          name: s.name,
          icon: s.icon,
          count: s.count
        })) : []
      },
      world: {
        explorationGrid: explorationTracker?.grid ? Array.from(explorationTracker.grid) : [],
        gameTime: this.dayNightCycle?.gameTime || 0.25,
        dayCount: this.dayNightCycle?.dayCount || 1,
        deletedAssets: this.world?.deletedAssets ? Array.from(this.world.deletedAssets) : []
      },
      structures: this.buildingSystem?.placedStructures ? this.buildingSystem.placedStructures.map(st => ({
        type: st.type,
        x: Math.round(st.position.x * 100) / 100,
        y: Math.round(st.position.y * 100) / 100,
        z: Math.round(st.position.z * 100) / 100,
        rotationY: st.baseRotationY !== undefined
          ? Math.round(st.baseRotationY * 1000) / 1000
          : (st.mesh ? Math.round(st.mesh.rotation.y * 1000) / 1000 : 0),
        isOpen: Boolean(st.isOpen)
      })) : [],
      quests: {
        currentQuestIndex: this.questManager?.currentQuestIndex || 0
      },
      skills: {
        unlocked: this.skillTree?.skills ? Object.keys(this.skillTree.skills).filter(k => this.skillTree.skills[k].unlocked) : [],
        activeSlots: this.skillTree?.activeSlots ? [...this.skillTree.activeSlots] : []
      }
    };

    return payload;
  }

  saveToLocalStorage() {
    const isFi = Localization.lang === 'fi';
    try {
      const payload = this.createSavePayload();
      const str = JSON.stringify(payload);
      localStorage.setItem(this.saveKey, str);
      if (this.hud) {
        this.hud.showNotification(isFi ? '💾 Peli tallennettu paikalliseen muistiin!' : '💾 Game saved to local storage!', 2500);
      }
      return true;
    } catch (e) {
      console.error('[SaveSystem] Error saving to localStorage:', e);
      if (this.hud) {
        this.hud.showNotification(isFi ? '❌ Tallennus epäonnistui!' : '❌ Save failed!', 2500);
      }
      return false;
    }
  }

  exportSaveToFile() {
    const isFi = Localization.lang === 'fi';
    try {
      const payload = this.createSavePayload();
      const str = JSON.stringify(payload, null, 2);

      // Save locally first
      localStorage.setItem(this.saveKey, str);

      // Download file to player's computer
      const charName = (payload.character?.name || 'adventurer').toLowerCase().replace(/[^a-z0-9]/g, '_');
      const filename = `tikapoo_save_${charName}_${Date.now()}.json`;

      const blob = new Blob([str], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 250);

      if (this.hud) {
        this.hud.showNotification(isFi ? `💾 Tallennettu ja ladattu tiedostona: ${filename}` : `💾 Saved & downloaded file: ${filename}`, 3500);
      }
      return true;
    } catch (e) {
      console.error('[SaveSystem] Error exporting save to file:', e);
      if (this.hud) {
        this.hud.showNotification(isFi ? '❌ Tiedoston vienti epäonnistui!' : '❌ File export failed!', 2500);
      }
      return false;
    }
  }

  loadFromLocalStorage() {
    const isFi = Localization.lang === 'fi';
    try {
      const str = localStorage.getItem(this.saveKey);
      if (!str) return false;
      const data = JSON.parse(str);
      return this.applySaveData(data);
    } catch (e) {
      console.error('[SaveSystem] Error loading from localStorage:', e);
      return false;
    }
  }

  importFromFile(file) {
    const isFi = Localization.lang === 'fi';
    return new Promise((resolve, reject) => {
      if (!file) return resolve(false);
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target.result;
          const data = JSON.parse(content);
          if (!data || (!data.player && !data.character && !data.inventory)) {
            throw new Error('Virheellinen tallennustiedoston muoto');
          }
          localStorage.setItem(this.saveKey, content);
          const success = this.applySaveData(data);
          if (success && this.hud) {
            this.hud.showNotification(isFi ? '📂 Tallennus ladattu onnistuneesti!' : '📂 Save file loaded successfully!', 3000);
          }
          resolve(success);
        } catch (err) {
          console.error('[SaveSystem] Invalid JSON save file:', err);
          if (this.hud) {
            this.hud.showNotification(isFi ? '❌ Virheellinen tallennustiedosto!' : '❌ Invalid save file!', 3000);
          }
          resolve(false);
        }
      };
      reader.onerror = () => {
        if (this.hud) this.hud.showNotification(isFi ? '❌ Tiedoston luku epäonnistui!' : '❌ Could not read file!', 3000);
        resolve(false);
      };
      reader.readAsText(file);
    });
  }

  applySaveData(data) {
    if (!data) return false;

    // 1. Restore Character Config
    if (data.character && this.player) {
      this.player.charConfig = { ...(this.player.charConfig || {}), ...data.character };
      try {
        localStorage.setItem('tikapoo_character', JSON.stringify(this.player.charConfig));
      } catch (e) {}
    }

    // 2. Restore Player Position & Stats
    if (data.player && this.player) {
      if (data.player.x !== undefined && data.player.z !== undefined) {
        this.player.playerPos.set(data.player.x, data.player.y || 1.5, data.player.z);
        if (this.player.mesh) this.player.mesh.position.copy(this.player.playerPos);
      }
      if (data.player.health !== undefined) this.player.health = data.player.health;
      if (data.player.stamina !== undefined) this.player.stamina = data.player.stamina;
      if (data.player.hunger !== undefined) this.player.hunger = data.player.hunger;
    }

    // 3. Restore Inventory
    if (data.inventory && this.inventory) {
      if (data.inventory.items) {
        this.inventory.items = { ...data.inventory.items };
      }
      if (data.inventory.tools) {
        this.inventory.tools = { ...data.inventory.tools };
      }
      if (data.inventory.equippedArmor) {
        this.inventory.equipArmor(data.inventory.equippedArmor);
      }
      if (data.inventory.equippedTool) {
        this.inventory.equip(data.inventory.equippedTool);
      }
      this.inventory.updateUI();
    }

    // 4. Restore Hotbar
    if (data.hotbar && this.hotbar) {
      if (Array.isArray(data.hotbar.slots) && data.hotbar.slots.length === 8) {
        this.hotbar.slots = data.hotbar.slots.map(s => ({ ...s }));
        this.hotbar.isCustomized = !!data.hotbar.isCustomized;
        this.hotbar._saveSlots();
        this.hotbar.sync();
        this.hotbar.render();
      }
    }

    // 5. Restore Built Structures
    if (Array.isArray(data.structures) && this.buildingSystem) {
      // Clear current structures
      if (this.buildingSystem.placedStructures) {
        for (const st of this.buildingSystem.placedStructures) {
          if (st.mesh && st.mesh.parent) {
            st.mesh.parent.remove(st.mesh);
          }
        }
        this.buildingSystem.placedStructures = [];
        this.buildingSystem.placedColliders = [];
      }
      // Re-place structures from save
      for (const st of data.structures) {
        if (this.buildingSystem.placeDirect) {
          this.buildingSystem.placeDirect(st.type, { x: st.x, y: st.y, z: st.z }, st.rotationY || 0, null, Boolean(st.isOpen));
        }
      }
    }

    // 6. Restore Exploration Fog
    if (data.world && data.world.explorationGrid && explorationTracker) {
      try {
        explorationTracker.grid.set(data.world.explorationGrid);
      } catch (e) {}
    }

    // 7. Restore Day/Night Cycle
    if (data.world && this.dayNightCycle) {
      if (data.world.gameTime !== undefined) this.dayNightCycle.gameTime = data.world.gameTime;
      if (data.world.dayCount !== undefined) this.dayNightCycle.dayCount = data.world.dayCount;
    }

    // 8. Restore Quests
    if (data.quests && this.questManager) {
      if (data.quests.currentQuestIndex !== undefined) {
        this.questManager.currentQuestIndex = data.quests.currentQuestIndex;
        if (this.questManager.renderHUD) this.questManager.renderHUD();
      }
    }

    // 9. Restore Skills
    if (data.skills && this.skillTree) {
      if (Array.isArray(data.skills.unlocked) && this.skillTree.skills) {
        data.skills.unlocked.forEach(id => {
          if (this.skillTree.skills[id]) this.skillTree.skills[id].unlocked = true;
        });
      }
      if (Array.isArray(data.skills.activeSlots)) {
        this.skillTree.activeSlots = [...data.skills.activeSlots];
      }
      this.skillTree.saveProgress();
      if (this.hotbar) this.hotbar.render();
    }

    return true;
  }
}
