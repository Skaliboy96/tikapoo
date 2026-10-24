import Localization from './Localization.js';

/**
 * QuestManager – Manages all quests, progress tracking and rewards.
 */
export default class QuestManager {
  constructor(inventory, player, hud) {
    this.inventory = inventory;
    this.player = player;
    this.hud = hud;

    this.quests = {
      collectWood: {
        id: 'collectWood',
        title: 'Kerää Puuta',
        description: 'Hakkaa 10 puuta Einarille.',
        type: 'collect',
        resource: 'wood',
        required: 10,
        progress: 0,
        active: false,
        completed: false,
        reward: { wood: 0, stone: 5, berry: 3, health: 20 },
        rewardText: '+5 Kiveä, +3 Marjaa, +20 Terveyttä',
      },
      collectStone: {
        id: 'collectStone',
        title: 'Louhinta-apua',
        description: 'Lohi 8 kiveä Matille.',
        type: 'collect',
        resource: 'stone',
        required: 8,
        progress: 0,
        active: false,
        completed: false,
        reward: { wood: 10, stone: 0, berry: 5, health: 0 },
        rewardText: '+10 Puuta, +5 Marjaa',
      },
      collectBerries: {
        id: 'collectBerries',
        title: 'Talvipuutarha',
        description: 'Kerää 6 marjaa Matin puutarhaan.',
        type: 'collect',
        resource: 'berry',
        required: 6,
        progress: 0,
        active: false,
        completed: false,
        reward: { wood: 5, stone: 5, berry: 0, health: 30 },
        rewardText: '+5 Puuta, +5 Kiveä, +30 Terveyttä',
      },
      killBeasts: {
        id: 'killBeasts',
        title: 'Hirviöjahti',
        description: 'Tapa 3 Shadow Beast -hirviötä.',
        type: 'kill',
        required: 3,
        progress: 0,
        active: false,
        completed: false,
        reward: { wood: 8, stone: 8, berry: 0, health: 50 },
        rewardText: '+8 Puuta, +8 Kiveä, +50 Terveyttä',
      },
      buildCampfire: {
        id: 'buildCampfire',
        title: 'Leiritulen Rakentaja',
        description: 'Rakenna leirituli.',
        type: 'build',
        required: 1,
        progress: 0,
        active: false,
        completed: false,
        reward: { wood: 10, stone: 0, berry: 8, health: 0 },
        rewardText: '+10 Puuta, +8 Marjaa',
      },
      surviveNight: {
        id: 'surviveNight',
        title: 'Yön Selviytyjä',
        description: 'Selviä yö elossa (odota yötä).',
        type: 'survive',
        required: 1,
        progress: 0,
        active: false,
        completed: false,
        reward: { wood: 15, stone: 10, berry: 5, health: 40 },
        rewardText: '+15 Puuta, +10 Kiveä, +5 Marjaa, +40 Terveyttä',
      },
      craftSpear: {
        id: 'craftSpear',
        title: 'Keihäsmestaruus',
        description: 'Valmista kivikärki-keihäs.',
        type: 'craft',
        required: 1,
        progress: 0,
        active: false,
        completed: false,
        reward: { wood: 12, stone: 6, berry: 0, health: 0 },
        rewardText: '+12 Puuta, +6 Kiveä',
      },
      catchFish: {
        id: 'catchFish',
        title: '🎣 Joen Kalastaja',
        description: 'Pyydystä 2 kalaa joesta tai kalastuslaiturilta ongen avulla.',
        type: 'fish',
        required: 2,
        progress: 0,
        active: false,
        completed: false,
        reward: { wood: 15, stone: 8, berry: 4, health: 35 },
        rewardText: '+15 Puuta, +8 Kiveä, +4 Marjaa, +35 Terveyttä',
      },
      huntDeer: {
        id: 'huntDeer',
        title: '🦌 Metsän Peuranpyytäjä',
        description: 'Metsästä 2 villipeuraa aarniometsästä lihan ja nahkojen saamiseksi.',
        type: 'hunt',
        required: 2,
        progress: 0,
        active: false,
        completed: false,
        reward: { wood: 10, stone: 5, berry: 0, health: 45 },
        rewardText: '+10 Puuta, +5 Kiveä, +45 Terveyttä',
      },
      exploreRuins: {
        id: 'exploreRuins',
        title: '🔮 Muinaisalttarin Mysteeri',
        description: 'Etsi ja tutki hehkuva muinainen kristillialttari idän vuorilla.',
        type: 'explore',
        required: 1,
        progress: 0,
        active: false,
        completed: false,
        reward: { wood: 20, stone: 15, berry: 5, health: 50 },
        rewardText: '+20 Puuta, +15 Kiveä, +50 Terveyttä',
      },
      craftBronze: {
        id: 'craftBronze',
        title: '⚔️ Sepän Pronssimiekka',
        description: 'Valmista terävä Pronssimiekka [C] valmistusvalikosta.',
        type: 'craft',
        required: 1,
        progress: 0,
        active: false,
        completed: false,
        reward: { wood: 15, stone: 10, berry: 0, health: 40 },
        rewardText: '+15 Puuta, +10 Kiveä, +40 Terveyttä',
      },
      scoutTower: {
        id: 'scoutTower',
        title: '🏔️ Pohjoisen Linnakkeen Tähystäjä',
        description: 'Nouse ylös Metsävartion linnakkeen korkeaan torniin ja tähystä laaksoa.',
        type: 'explore',
        required: 1,
        progress: 0,
        active: false,
        completed: false,
        reward: { wood: 20, stone: 15, berry: 6, health: 50 },
        rewardText: '+20 Puuta, +15 Kiveä, +6 Marjaa, +50 Terveyttä',
      },
      craftWorkbench: {
        id: 'craftWorkbench',
        title: '🔨 Työpöydän Rakennus',
        description: 'Käytä kylän työpöytää tai rakenna oma vasaran [B] avulla aseiden ja haarniskojen valmistukseen.',
        type: 'craft',
        required: 1,
        progress: 0,
        active: false,
        completed: false,
        reward: { wood: 15, stone: 10, health: 30 },
        rewardText: '+15 Puuta, +10 Kiveä, +30 Terveyttä',
      },
      craftHuntingBow: {
        id: 'craftHuntingBow',
        title: '🏹 Metsästäjän Jousi & Nuolia',
        description: 'Valmista metsästäjän jousi ja nuolia työpöydän äärellä etätaisteluun.',
        type: 'craft',
        required: 1,
        progress: 0,
        active: false,
        completed: false,
        reward: { wood: 20, stone: 10, health: 40 },
        rewardText: '+20 Puuta, +10 Kiveä, +40 Terveyttä',
      },
      slayBoss1: {
        id: 'slayBoss1',
        title: '🔱 Metsän Kauhun Kukistus',
        description: 'Matkaa syvälle Mustametsään (-140, -140) ja kukista Sarvipeto. Hanki Kova Sarvi pronssikauden aloittamiseen!',
        type: 'boss',
        required: 1,
        progress: 0,
        active: false,
        completed: false,
        reward: { wood: 25, stone: 20, health: 100 },
        rewardText: '+25 Puuta, +20 Kiveä, +100 Terveyttä',
      },
      craftBronzeArmor: {
        id: 'craftBronzeArmor',
        title: '🛡️ Pronssipanssarin Valmistus',
        description: 'Takoa pronssilevyistä rintapanssari suojaamaan ankaralta erämaalta.',
        type: 'craft',
        required: 1,
        progress: 0,
        active: false,
        completed: false,
        reward: { wood: 20, stone: 15, health: 60 },
        rewardText: '+20 Puuta, +15 Kiveä, +60 Terveyttä',
      },
      slayBoss2: {
        id: 'slayBoss2',
        title: '🐉 Sumusoiden Vesipeto',
        description: 'Kukista Näkki eteläisiltä rämeiltä (-170, 155) ja avaa rautakausi!',
        type: 'boss',
        required: 1,
        progress: 0,
        active: false,
        completed: false,
        reward: { wood: 30, stone: 25, health: 120 },
        rewardText: '+30 Puuta, +25 Kiveä, +120 Terveyttä',
      },
      slayBoss3: {
        id: 'slayBoss3',
        title: '🏔️ Vuoriston Graniittijätti',
        description: 'Kohtaa Kallionmurskaaja lumihuipuilla (175, -170) ja hanki Maan Sydän!',
        type: 'boss',
        required: 1,
        progress: 0,
        active: false,
        completed: false,
        reward: { wood: 40, stone: 30, health: 150 },
        rewardText: '+40 Puuta, +30 Kiveä, +150 Terveyttä',
      },
      slayBoss4: {
        id: 'slayBoss4',
        title: '💠 Riimupyhäkön Arvoitus',
        description: 'Vapauta itäinen pyhäkkö kukistamalla Riimunvartija (215, -25)!',
        type: 'boss',
        required: 1,
        progress: 0,
        active: false,
        completed: false,
        reward: { wood: 50, stone: 40, health: 180 },
        rewardText: '+50 Puuta, +40 Kiveä, +180 Terveyttä',
      },
      slayBoss5: {
        id: 'slayBoss5',
        title: '👑 Pohjolan Viimeinen Taistelu',
        description: 'Astu tulivuorelle (0, 275) ja kukista Varjodraakki pelastaaksesi Pohjolan!',
        type: 'boss',
        required: 1,
        progress: 0,
        active: false,
        completed: false,
        reward: { wood: 100, stone: 100, health: 250 },
        rewardText: '👑 Pohjolan Legendan Arvonimi, +250 Terveyttä',
      }
    };

    this.questLogEl = document.getElementById('quest-log-entries');
    this._updateQuestLog();
    window.addEventListener('languageChanged', () => this._updateQuestLog());
  }

  getQuest(id) {
    return this.quests[id] || null;
  }

  accept(id) {
    const q = this.quests[id];
    if (!q || q.active || q.completed) return;
    q.active = true;
    this.hud.showNotification(`📋 Tehtävä hyväksytty: ${q.title}`);
    this._updateQuestLog();
  }

  // Called by game systems when relevant events happen
  onCollect(resource, amount) {
    Object.values(this.quests).forEach(q => {
      if (!q.active || q.completed || q.type !== 'collect') return;
      if (q.resource === resource) {
        q.progress = Math.min(q.required, q.progress + amount);
        this._updateQuestLog();
        if (this.isComplete(q.id)) {
          this.hud.showNotification(`✅ Tehtävä valmis: ${q.title} — Palaa NPC:lle!`);
        }
      }
    });
  }

  onKill() {
    Object.values(this.quests).forEach(q => {
      if (!q.active || q.completed || q.type !== 'kill') return;
      q.progress = Math.min(q.required, q.progress + 1);
      this._updateQuestLog();
      if (this.isComplete(q.id)) {
        this.hud.showNotification(`✅ Tehtävä valmis: ${q.title} — Palaa NPC:lle!`);
      }
    });
  }

  onBuild(structureType) {
    if (structureType === 'campfire') {
      Object.values(this.quests).forEach(q => {
        if (!q.active || q.completed || q.type !== 'build') return;
        q.progress = Math.min(q.required, q.progress + 1);
        this._updateQuestLog();
        if (this.isComplete(q.id)) {
          this.hud.showNotification(`✅ Tehtävä valmis: ${q.title} — Palaa NPC:lle!`);
        }
      });
    }
  }

  onCraft(itemId) {
    Object.values(this.quests).forEach(q => {
      if (!q.active || q.completed || q.type !== 'craft') return;
      if (itemId === 'stoneSpear' && q.id === 'craftSpear') {
        q.progress = Math.min(q.required, q.progress + 1);
      } else if (itemId === 'bronzeSword' && q.id === 'craftBronze') {
        q.progress = Math.min(q.required, q.progress + 1);
      } else if (itemId === 'huntingBow' && q.id === 'craftHuntingBow') {
        q.progress = Math.min(q.required, q.progress + 1);
      } else if (itemId === 'bronzeArmor' && q.id === 'craftBronzeArmor') {
        q.progress = Math.min(q.required, q.progress + 1);
      } else if (itemId === 'workbench' && q.id === 'craftWorkbench') {
        q.progress = Math.min(q.required, q.progress + 1);
      }
      this._updateQuestLog();
      if (this.isComplete(q.id)) {
        this.hud.showNotification(`✅ Tehtävä valmis: ${q.title} — Palaa NPC:lle!`);
      }
    });
  }

  onBossKill(bossId) {
    const bossMap = {
      forestBeast: 'slayBoss1',
      swampWyrm: 'slayBoss2',
      mountainGolem: 'slayBoss3',
      runeWraith: 'slayBoss4',
      shadowDragon: 'slayBoss5'
    };
    const questId = bossMap[bossId];
    if (questId && this.quests[questId]) {
      const q = this.quests[questId];
      if (q.active && !q.completed) {
        q.progress = 1;
        this._updateQuestLog();
        if (this.hud) {
          this.hud.showNotification(`👑 Saaga-tehtävä suoritettu: ${q.title}!`);
        }
      }
    }
  }

  onCatchFish() {
    const q = this.quests['catchFish'];
    if (q && q.active && !q.completed) {
      q.progress = Math.min(q.required, q.progress + 1);
      this._updateQuestLog();
      if (this.isComplete(q.id)) {
        this.hud.showNotification(`✅ Tehtävä valmis: ${q.title} — Palaa Kalastajalle!`);
      }
    }
  }

  onHuntDeer() {
    const q = this.quests['huntDeer'];
    if (q && q.active && !q.completed) {
      q.progress = Math.min(q.required, q.progress + 1);
      this._updateQuestLog();
      if (this.isComplete(q.id)) {
        this.hud.showNotification(`✅ Tehtävä valmis: ${q.title} — Palaa Metsästäjälle!`);
      }
    }
  }

  onExploreAltar() {
    const q = this.quests['exploreRuins'];
    if (q && q.active && !q.completed) {
      q.progress = 1;
      this._updateQuestLog();
      if (this.isComplete(q.id)) {
        this.hud.showNotification(`✅ Tehtävä valmis: ${q.title} — Alttari löydetty!`);
      }
    }
  }

  onExploreWatchtower() {
    const q = this.quests['scoutTower'];
    if (q && q.active && !q.completed) {
      q.progress = 1;
      this._updateQuestLog();
      if (this.isComplete(q.id)) {
        this.hud.showNotification(`✅ Tehtävä valmis: ${q.title} — Linnakkeen torni valloitettu!`);
      }
    }
  }

  onNightSurvived() {
    Object.values(this.quests).forEach(q => {
      if (!q.active || q.completed || q.type !== 'survive') return;
      q.progress = Math.min(q.required, q.progress + 1);
      this._updateQuestLog();
      if (this.isComplete(q.id)) {
        this.hud.showNotification(`✅ Tehtävä valmis: ${q.title} — Palaa NPC:lle!`);
      }
    });
  }

  isComplete(id) {
    const q = this.quests[id];
    return q && q.active && !q.completed && q.progress >= q.required;
  }

  complete(id) {
    const q = this.quests[id];
    if (!q || !this.isComplete(id)) return;
    q.completed = true;
    q.active = false;

    // Give rewards
    if (q.reward.wood > 0) this.inventory.add('wood', q.reward.wood);
    if (q.reward.stone > 0) this.inventory.add('stone', q.reward.stone);
    if (q.reward.berry > 0) this.inventory.add('berry', q.reward.berry);
    if (q.reward.health > 0) this.player.heal(q.reward.health);

    this.hud.showNotification(`🎉 Tehtävä suoritettu! ${q.title}  |  Palkinto: ${q.rewardText}`, 5000);
    this._updateQuestLog();
  }

  getProgressText(id) {
    const q = this.quests[id];
    if (!q) return '';
    const isFi = Localization.getLanguage() === 'fi';
    if (q.completed) return isFi ? 'Suoritettu!' : 'Completed!';
    if (!q.active) return '';
    return `${isFi ? 'Edistyminen' : 'Progress'}: ${q.progress} / ${q.required}`;
  }

  _updateQuestLog() {
    if (!this.questLogEl) return;
    const isFi = (Localization.getLanguage() === 'fi');
    const active = Object.values(this.quests).filter(q => q.active || q.completed);
    if (active.length === 0) {
      this.questLogEl.innerHTML = `<div class="quest-log-empty">${isFi ? 'Ei aktiivisia tehtäviä' : 'No active quests'}</div>`;
      return;
    }
    this.questLogEl.innerHTML = active.map(q => {
      const title = isFi ? (q.title_fi || q.title) : (q.title_en || q.title);
      return `
        <div class="quest-log-entry ${q.completed ? 'ql-done' : this.isComplete(q.id) ? 'ql-ready' : 'ql-active'}">
          <span class="ql-icon">${q.completed ? '✅' : this.isComplete(q.id) ? '🔔' : '🔵'}</span>
          <span class="ql-title">${title}</span>
          ${!q.completed ? `<span class="ql-prog">${q.progress}/${q.required}</span>` : ''}
        </div>
      `;
    }).join('');
  }

  getActiveQuests() {
    return Object.values(this.quests).filter(q => q.active && !q.completed);
  }

  getAllForMap() {
    return Object.values(this.quests);
  }
}
