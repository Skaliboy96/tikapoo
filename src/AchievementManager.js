/**
 * AchievementManager
 * Tracks in-game achievements, progress, persistence, rewards (XP & Skill Points),
 * and celebratory popup fanfare.
 */
export default class AchievementManager {
  constructor(player, hud, audioManager) {
    this.player = player;
    this.hud = hud;
    this.audioManager = audioManager;

    // Load saved unlocked achievements
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem('tikapoo_achievements') || '{}');
    } catch (e) {
      saved = {};
    }

    this.achievements = {
      first_chop: {
        id: 'first_chop',
        icon: '🪓',
        title: 'Metsuri',
        titleEn: 'First Timber',
        desc: 'Kaada ensimmäinen puu erämaassa.',
        descEn: 'Chop down your first tree in the wilderness.',
        progress: 0,
        target: 1,
        unlocked: false,
        rewardXP: 50,
        rewardPoints: 0,
        rewardText: '+50 XP'
      },
      tree_feller: {
        id: 'tree_feller',
        icon: '🌲',
        title: 'Metsurimestari',
        titleEn: 'Master Woodcutter',
        desc: 'Kaada yhteensä 15 puuta.',
        descEn: 'Chop down 15 trees in total.',
        progress: 0,
        target: 15,
        unlocked: false,
        rewardXP: 150,
        rewardPoints: 1,
        rewardText: '+150 XP, +1 Taitopiste'
      },
      first_mine: {
        id: 'first_mine',
        icon: '⛏️',
        title: 'Kivikausi',
        titleEn: 'Stone Age',
        desc: 'Louhi ensimmäinen kivi tai malmi kalliosta.',
        descEn: 'Mine your first stone or ore vein.',
        progress: 0,
        target: 1,
        unlocked: false,
        rewardXP: 50,
        rewardPoints: 0,
        rewardText: '+50 XP'
      },
      mine_master: {
        id: 'mine_master',
        icon: '💎',
        title: 'Kallionmurtaja',
        titleEn: 'Rockbreaker',
        desc: 'Louhi yhteensä 20 kivi- tai malmisuonta.',
        descEn: 'Mine 20 stone or ore deposits.',
        progress: 0,
        target: 20,
        unlocked: false,
        rewardXP: 200,
        rewardPoints: 1,
        rewardText: '+200 XP, +1 Taitopiste'
      },
      first_craft: {
        id: 'first_craft',
        icon: '🔨',
        title: 'Käsityöläinen',
        titleEn: 'Artisan',
        desc: 'Valmista ensimmäinen työkalu tai ase työpöydällä.',
        descEn: 'Craft your first tool or weapon at a workbench.',
        progress: 0,
        target: 1,
        unlocked: false,
        rewardXP: 60,
        rewardPoints: 0,
        rewardText: '+60 XP'
      },
      builder: {
        id: 'builder',
        icon: '🏠',
        title: 'Kodinrakentaja',
        titleEn: 'Master Builder',
        desc: 'Pystytä 5 rakennusosaa (seiniä, lattioita tai tulta).',
        descEn: 'Place 5 building structures (walls, floors, or campfires).',
        progress: 0,
        target: 5,
        unlocked: false,
        rewardXP: 120,
        rewardPoints: 0,
        rewardText: '+120 XP'
      },
      first_kill: {
        id: 'first_kill',
        icon: '⚔️',
        title: 'Ensimmäinen Veri',
        titleEn: 'First Blood',
        desc: 'Kukista ensimmäinen vihollinen.',
        descEn: 'Defeat your first enemy.',
        progress: 0,
        target: 1,
        unlocked: false,
        rewardXP: 75,
        rewardPoints: 0,
        rewardText: '+75 XP'
      },
      slayer: {
        id: 'slayer',
        icon: '💀',
        title: 'Pohjolan Soturi',
        titleEn: 'Northern Slayer',
        desc: 'Kukista 15 vihollista maastossa.',
        descEn: 'Slay 15 enemies in the wilderness.',
        progress: 0,
        target: 15,
        unlocked: false,
        rewardXP: 250,
        rewardPoints: 1,
        rewardText: '+250 XP, +1 Taitopiste'
      },
      master_smith: {
        id: 'master_smith',
        icon: '🪙',
        title: 'Ahjon Mestari',
        titleEn: 'Forge Master',
        desc: 'Sulata malmia metalliharkoksi sulattouunissa.',
        descEn: 'Smelt ore into an ingot at the smelter.',
        progress: 0,
        target: 1,
        unlocked: false,
        rewardXP: 180,
        rewardPoints: 0,
        rewardText: '+180 XP'
      },
      master_angler: {
        id: 'master_angler',
        icon: '🐟',
        title: 'Erämies & Kalamies',
        titleEn: 'Master Angler',
        desc: 'Nappaa 3 kalaa järvistä tai joista.',
        descEn: 'Catch 3 fish from lakes or rivers.',
        progress: 0,
        target: 3,
        unlocked: false,
        rewardXP: 140,
        rewardPoints: 0,
        rewardText: '+140 XP'
      },
      boss_forest: {
        id: 'boss_forest',
        icon: '🔱',
        title: 'Metsän Kauhun Kaataja',
        titleEn: 'Bane of the Forest Beast',
        desc: 'Kukista 1. päävihollinen (Sarvipeto).',
        descEn: 'Defeat the 1st mythical boss (Forest Beast).',
        progress: 0,
        target: 1,
        unlocked: false,
        rewardXP: 500,
        rewardPoints: 2,
        rewardText: '+500 XP, +2 Taitopistettä'
      },
      boss_swamp: {
        id: 'boss_swamp',
        icon: '🗝️',
        title: 'Suon Valtias',
        titleEn: 'Swamp Sovereign',
        desc: 'Kukista 2. päävihollinen (Vesipeto Näkki).',
        descEn: 'Defeat the 2nd mythical boss (Swamp Wyrm).',
        progress: 0,
        target: 1,
        unlocked: false,
        rewardXP: 750,
        rewardPoints: 2,
        rewardText: '+750 XP, +2 Taitopistettä'
      },
      boss_mountain: {
        id: 'boss_mountain',
        icon: '⛰️',
        title: 'Vuoriston Jätti',
        titleEn: 'Titan of the Mountain',
        desc: 'Kukista 3. päävihollinen (Harjanteen Jätti Kalliovuoristossa).',
        descEn: 'Defeat the 3rd mythical boss (Mountain Golem).',
        progress: 0,
        target: 1,
        unlocked: false,
        rewardXP: 1000,
        rewardPoints: 2,
        rewardText: '+1000 XP, +2 Taitopistettä'
      },
      boss_rune: {
        id: 'boss_rune',
        icon: '🌌',
        title: 'Riimumestari',
        titleEn: 'Rune Conqueror',
        desc: 'Kukista 4. päävihollinen (Riimunvartija).',
        descEn: 'Defeat the 4th mythical boss (Rune Wraith).',
        progress: 0,
        target: 1,
        unlocked: false,
        rewardXP: 1500,
        rewardPoints: 3,
        rewardText: '+1500 XP, +3 Taitopistettä'
      },
      boss_dragon: {
        id: 'boss_dragon',
        icon: '👑',
        title: 'Pohjolan Hallitsija',
        titleEn: 'Dragon King Slayer',
        desc: 'Kukista 5. päävihollinen (Varjodraakki).',
        descEn: 'Defeat the 5th mythical boss (Shadow Dragon).',
        progress: 0,
        target: 1,
        unlocked: false,
        rewardXP: 2500,
        rewardPoints: 5,
        rewardText: '+2500 XP, +5 Taitopistettä'
      }
    };

    // Apply saved progress
    for (const [id, data] of Object.entries(saved)) {
      if (this.achievements[id]) {
        this.achievements[id].progress = data.progress || 0;
        this.achievements[id].unlocked = !!data.unlocked;
      }
    }
  }

  save() {
    try {
      const state = {};
      for (const [id, a] of Object.entries(this.achievements)) {
        state[id] = { progress: a.progress, unlocked: a.unlocked };
      }
      localStorage.setItem('tikapoo_achievements', JSON.stringify(state));
    } catch (e) {
      console.warn('Could not save achievements:', e);
    }
  }

  unlock(id) {
    const ach = this.achievements[id];
    if (!ach || ach.unlocked) return;

    ach.unlocked = true;
    ach.progress = ach.target;
    this.save();

    // Grant rewards
    if (this.player) {
      if (ach.rewardXP) this.player.addXP(ach.rewardXP);
      if (ach.rewardPoints) this.player.skillPoints += ach.rewardPoints;
    }

    // Audio & Visual notification
    if (this.audioManager && this.audioManager.playLevelUp) {
      this.audioManager.playLevelUp();
    }
    if (this.hud && this.hud.showNotification) {
      this.hud.showNotification(`🏆 SAAVUTUS AVATTU: ${ach.icon} ${ach.title.toUpperCase()}! (${ach.rewardText})`, 6000);
    }
  }

  addProgress(id, amount = 1) {
    const ach = this.achievements[id];
    if (!ach || ach.unlocked) return;

    ach.progress = Math.min(ach.target, ach.progress + amount);
    if (ach.progress >= ach.target) {
      this.unlock(id);
    } else {
      this.save();
    }
  }

  onChop(count = 1) {
    this.addProgress('first_chop', count);
    this.addProgress('tree_feller', count);
  }

  onMine(count = 1) {
    this.addProgress('first_mine', count);
    this.addProgress('mine_master', count);
  }

  onKill() {
    this.addProgress('first_kill', 1);
    this.addProgress('slayer', 1);
  }

  onBossKill(bossId) {
    if (bossId === 'forestBeast') this.unlock('boss_forest');
    else if (bossId === 'swampWyrm') this.unlock('boss_swamp');
    else if (bossId === 'mountainGolem') this.unlock('boss_mountain');
    else if (bossId === 'runeWraith') this.unlock('boss_rune');
    else if (bossId === 'shadowDragon') this.unlock('boss_dragon');
  }

  onCraft(recipeId) {
    this.addProgress('first_craft', 1);
    if (['bronze', 'iron', 'steel', 'silver', 'blackMetal', 'dragonSteel'].includes(recipeId)) {
      this.unlock('master_smith');
    }
  }

  onBuild() {
    this.addProgress('builder', 1);
  }

  onFish(count = 1) {
    this.addProgress('master_angler', count);
  }
}
