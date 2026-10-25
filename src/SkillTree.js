import * as THREE from 'three';

/**
 * SkillTree & Abilities Manager
 * Tracks level, XP, skill points, and unlocked active skills (keys 1-4).
 * Supports 3 specialization paths:
 * - ⚔️ Soturi (Warrior / Swordsmanship)
 * - 🔮 Taikuus (Mage / Arcane Sorcery)
 * - 🏹 Jousiammunta (Ranger / Archery)
 */
export default class SkillTree {
  constructor(player, combat, hud, audioManager, questManager = null, achievementManager = null) {
    this.player = player;
    this.combat = combat;
    this.hud = hud;
    this.audioManager = audioManager;
    this.questManager = questManager;
    this.achievementManager = achievementManager;
    this.hotbar = null;

    this.isOpen = false;
    this.modalEl = null;
    this.currentTab = 'skills'; // 'skills', 'quests', or 'achievements'

    // Specialization definitions
    this.skills = {
      // --- WARRIOR ---
      whirlwind: {
        id: 'whirlwind',
        tree: 'warrior',
        slot: 1,
        tier: 1,
        name: '🌪️ Pyörähdys (Whirlwind)',
        desc: 'Tee 360° nopea pyyhkäisyisku aseella. Osuu kaikkiin ympärillä oleviin vihollisiin 2.0x vahingolla.',
        costType: 'stamina',
        cost: 25,
        cooldown: 5.0,
        reqLevel: 1,
        unlocked: true // Starter skill for slot 1
      },
      groundSlam: {
        id: 'groundSlam',
        tree: 'warrior',
        slot: 2,
        tier: 2,
        name: '💥 Maanjäristys-Isku (Ground Slam)',
        desc: 'Hyppää ilmaan ja iske ase maahan. Shokkiaalto tyrmää ja vahingoittaa maassa olevia vihollisia.',
        costType: 'stamina',
        cost: 35,
        cooldown: 9.0,
        reqLevel: 2,
        unlocked: false
      },
      dashSlash: {
        id: 'dashSlash',
        tree: 'warrior',
        slot: 3,
        tier: 3,
        name: '⚡ Syöksyviilto (Dash Strike)',
        desc: 'Syöksy salamannopeasti 12 metriä eteenpäin ja viillä vihollisten linjojen läpi.',
        costType: 'stamina',
        cost: 20,
        cooldown: 7.0,
        reqLevel: 4,
        unlocked: false
      },
      berserkRage: {
        id: 'berserkRage',
        tree: 'warrior',
        slot: 4,
        tier: 4,
        name: '🔥 Berserkkiraivo (Berserk Rage)',
        desc: 'Valtaa muinainen viikinkiraivo 12 sekunniksi: +100% vahinko, +50% nopeus ja 35% lifesteal!',
        costType: 'stamina',
        cost: 40,
        cooldown: 35.0,
        reqLevel: 6,
        unlocked: false
      },

      // --- MAGE ---
      fireball: {
        id: 'fireball',
        tree: 'mage',
        slot: 1,
        tier: 1,
        name: '🔥 Tulipallo (Fireball)',
        desc: 'Ammu räjähtävä tulipallo, joka sytyttää maalin ja aiheuttaa laajan räjähdysvahingon.',
        costType: 'mana',
        cost: 25,
        cooldown: 3.5,
        reqLevel: 1,
        unlocked: false
      },
      frostNova: {
        id: 'frostNova',
        tree: 'mage',
        slot: 2,
        tier: 2,
        name: '❄️ Jäänova (Frost Nova)',
        desc: 'Räjäytä jäinen hyhmäkehä ympärillesi. Jäädyttää viholliset ja hidastaa heitä 80% 5 sekunnin ajaksi.',
        costType: 'mana',
        cost: 30,
        cooldown: 8.0,
        reqLevel: 2,
        unlocked: false
      },
      chainLightning: {
        id: 'chainLightning',
        tree: 'mage',
        slot: 3,
        tier: 3,
        name: '⚡ Ketjusalama (Chain Lightning)',
        desc: 'Iske mahtava sähkökaari, joka pomppaa vihollisesta toiseen sähköistäen jopa 4 maalia.',
        costType: 'mana',
        cost: 35,
        cooldown: 9.0,
        reqLevel: 4,
        unlocked: false
      },
      celestialBeam: {
        id: 'celestialBeam',
        tree: 'mage',
        slot: 4,
        tier: 4,
        name: '☀️ Taivaallinen Valo (Celestial Impact)',
        desc: 'Kutsu pyhä valopilari taivaalta: parantaa pelaajan hengen täyteen ja tuhoaa pimeyden viholliset.',
        costType: 'mana',
        cost: 50,
        cooldown: 30.0,
        reqLevel: 6,
        unlocked: false
      },

      // --- RANGER ---
      powerShot: {
        id: 'powerShot',
        tree: 'ranger',
        slot: 1,
        tier: 1,
        name: '🎯 Tarkka Laukas (Power Shot)',
        desc: 'Viritä voimanuoli, joka lävistää puolustukset 2.5x vahingolla ja työntää kohdetta taaksepäin.',
        costType: 'stamina',
        cost: 20,
        cooldown: 4.0,
        reqLevel: 1,
        unlocked: false
      },
      rainOfArrows: {
        id: 'rainOfArrows',
        tree: 'ranger',
        slot: 2,
        tier: 2,
        name: '🌧️ Nuolisade (Rain of Arrows)',
        desc: 'Ammu taivaalle nuoliparvi, joka sataa kohdealueelle tehden toistuvaa vahinkoa 4 sekunnin ajan.',
        costType: 'stamina',
        cost: 35,
        cooldown: 11.0,
        reqLevel: 2,
        unlocked: false
      },
      multiShot: {
        id: 'multiShot',
        tree: 'ranger',
        slot: 3,
        tier: 3,
        name: '🏹 Monilaukaus (Multi-Shot)',
        desc: 'Ammu 5 terävää nuolta laajana viuhkana edessä oleviin vihollisiin yhdellä laukauksella.',
        costType: 'stamina',
        cost: 25,
        cooldown: 7.0,
        reqLevel: 4,
        unlocked: false
      },
      shadowPiercer: {
        id: 'shadowPiercer',
        tree: 'ranger',
        slot: 4,
        tier: 4,
        name: '👻 Aavenoole (Shadow Piercer)',
        desc: 'Yliluonnollinen läpäisevä nuoli, joka lentää minkä tahansa esteen läpi valtavalla tuhovoimalla.',
        costType: 'stamina',
        cost: 40,
        cooldown: 25.0,
        reqLevel: 6,
        unlocked: false
      }
    };

    // Active loaded skills for keys [1, 2, 3, 4]
    this.activeSlots = [
      'whirlwind', // Slot 1
      null,        // Slot 2
      null,        // Slot 3
      null         // Slot 4
    ];

    // Current cooldown timers
    this.cooldowns = {
      whirlwind: 0,
      groundSlam: 0,
      dashSlash: 0,
      berserkRage: 0,
      fireball: 0,
      frostNova: 0,
      chainLightning: 0,
      celestialBeam: 0,
      powerShot: 0,
      rainOfArrows: 0,
      multiShot: 0,
      shadowPiercer: 0
    };

    // Berserk buff timer
    this.berserkTimer = 0;

    this._createUI();
    this._setupListeners();
  }

  _createUI() {
    let el = document.getElementById('skill-tree-modal');
    if (!el) {
      el = document.createElement('div');
      el.id = 'skill-tree-modal';
      el.className = 'skill-tree-overlay';
      el.style.display = 'none';
      document.body.appendChild(el);
    }
    this.modalEl = el;
    this.render();
  }

  _setupListeners() {
    window.addEventListener('keydown', (e) => {
      const mainMenu = document.getElementById('main-menu');
      if (mainMenu && getComputedStyle(mainMenu).display !== 'none') return;
      // Toggle Skill Tree with [O]
      if (e.code === 'KeyO') {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (this.isOpen) {
          this.close();
        } else {
          this.open();
        }
      }

      // Close with ESC
      if (e.code === 'Escape' && this.isOpen) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.close();
        return;
      }

      const isTyping = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')
        || document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');
      if (isTyping) return;

      // Trigger Skills 1-4 when not typing in an input
      if (this.isOpen) return;

      const slotByCode = {
        Digit1: 0,
        Digit2: 1,
        Digit3: 2,
        Digit4: 3
      };
      const slotIdx = slotByCode[e.code];
      if (slotIdx !== undefined && this.activeSlots[slotIdx]) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.castSlot(slotIdx);
      }
    });
  }

  open() {
    this.isOpen = true;
    if (this.modalEl) this.modalEl.style.display = 'flex';
    if (this.player && this.player.controls) this.player.controls.unlock();
    this.render();
  }

  close() {
    this.isOpen = false;
    if (this.modalEl) this.modalEl.style.display = 'none';
    if (window.restoreGameFocus) {
      window.restoreGameFocus();
    } else if (this.player && this.player.controls) {
      this.player.controls.lock();
    }
  }

  render() {
    if (!this.modalEl) return;

    const p = this.player;
    const level = p ? p.level : 1;
    const xp = p ? p.xp : 0;
    const xpNext = p ? p.xpNext : 100;
    const skillPoints = p ? p.skillPoints : 0;

    const isFi = (typeof Localization !== 'undefined' && Localization.lang === 'en') ? false : true;

    let contentHtml = '';
    if (this.currentTab === 'quests') {
      const qm = this.questManager;
      const allQuests = qm ? Object.values(qm.quests) : [];
      const activeQuests = allQuests.filter(q => q.active && !q.completed);
      const completedQuests = allQuests.filter(q => q.completed);
      const availableQuests = allQuests.filter(q => !q.active && !q.completed);

      contentHtml = `
        <div class="st-quests-container" style="display: flex; flex-direction: column; gap: 20px; max-height: 60vh; overflow-y: auto; padding-right: 8px;">
          <!-- Active Quests -->
          <div class="st-quest-section">
            <h3 style="color: #4cd137; margin: 0 0 10px 0; font-size: 1.15rem; display: flex; align-items: center; gap: 8px;">
              🔥 ${isFi ? 'AKTIIVISET TEHTÄVÄT' : 'ACTIVE QUESTS'} (${activeQuests.length})
            </h3>
            ${activeQuests.length === 0 ? `
              <div style="background: rgba(0,0,0,0.3); border: 1px dashed rgba(255,255,255,0.15); border-radius: 8px; padding: 16px; color: #aaa; font-style: italic;">
                ${isFi ? 'Ei aktiivisia tehtäviä juuri nyt. Puhu kyläläisille (Einar, Matti, Aino, Toivo) Keskuskylässä ja Satamakylässä ottaaksesi vastaan uusia tehtäviä!' : 'No active quests right now. Talk to villagers (Einar, Matti, Aino, Toivo) in Central Village and Port Village to receive quests!'}
              </div>
            ` : `
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px;">
                ${activeQuests.map(q => {
                  const pct = Math.min(100, Math.round((q.progress / (q.required || 1)) * 100));
                  return `
                    <div style="background: rgba(20, 28, 38, 0.95); border: 1px solid #4cd137; border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 8px;">
                      <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: bold; color: #fff; font-size: 1.05rem;">📜 ${q.title}</span>
                        <span style="background: rgba(76, 209, 55, 0.2); color: #4cd137; border: 1px solid #4cd137; font-size: 0.75rem; padding: 2px 8px; border-radius: 4px; font-weight: bold;">
                          ${isFi ? 'KÄYNNISSÄ' : 'ACTIVE'}
                        </span>
                      </div>
                      <div style="color: #ccc; font-size: 0.9rem; line-height: 1.35;">${q.description}</div>
                      <!-- Progress bar -->
                      <div style="margin-top: 4px;">
                        <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: #aaa; margin-bottom: 3px;">
                          <span>${isFi ? 'Edistyminen' : 'Progress'}</span>
                          <span style="color: #4cd137; font-weight: bold;">${q.progress} / ${q.required}</span>
                        </div>
                        <div style="background: rgba(0,0,0,0.5); border-radius: 4px; height: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);">
                          <div style="background: linear-gradient(90deg, #4cd137, #44bd32); height: 100%; width: ${pct}%; transition: width 0.3s;"></div>
                        </div>
                      </div>
                      <div style="margin-top: 4px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 0.8rem; color: #f1c40f;">
                        🏆 ${isFi ? 'Palkkio' : 'Reward'}: <strong>${q.rewardText}</strong>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </div>

          <!-- Completed Quests -->
          ${completedQuests.length > 0 ? `
            <div class="st-quest-section">
              <h3 style="color: #00d2d3; margin: 0 0 10px 0; font-size: 1.05rem; display: flex; align-items: center; gap: 8px;">
                ✅ ${isFi ? 'SUORITETUT TEHTÄVÄT' : 'COMPLETED QUESTS'} (${completedQuests.length})
              </h3>
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 10px;">
                ${completedQuests.map(q => `
                  <div style="background: rgba(15, 20, 28, 0.75); border: 1px solid rgba(0, 210, 211, 0.4); border-radius: 6px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #eee; font-size: 0.9rem;">✅ ${q.title}</span>
                    <span style="color: #00d2d3; font-size: 0.75rem; font-weight: bold;">${isFi ? 'VALMIS' : 'DONE'}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Available Quests (Hints on where to find them) -->
          <div class="st-quest-section">
            <h3 style="color: #fbc531; margin: 0 0 10px 0; font-size: 1.05rem; display: flex; align-items: center; gap: 8px;">
              🗺️ ${isFi ? 'ERÄMAAN TEHTÄVÄT & KYLÄLÄISET' : 'WORLD QUESTS & VILLAGERS'}
            </h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px;">
              <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 10px 12px; font-size: 0.85rem; color: #bbb;">
                <strong style="color: #fff;">🧔 Einar (Keskuskylä):</strong> ${isFi ? 'Metsuri. Antaa puunhakkuutehtäviä ja palkitsee kalliilla kivityökaluilla.' : 'Woodsman. Offers woodcutting quests and rewards tools.'}
              </div>
              <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 10px 12px; font-size: 0.85rem; color: #bbb;">
                <strong style="color: #fff;">👴 Matti (Keskuskylä):</strong> ${isFi ? 'Kaivosmies. Opettaa louhimaan kiveä, malmeja ja selviytymään pedoista.' : 'Miner. Teaches mining and wilderness survival.'}
              </div>
              <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 10px 12px; font-size: 0.85rem; color: #bbb;">
                <strong style="color: #fff;">👧 Nuori Aino (Yrttitupa):</strong> ${isFi ? 'Parantaja. Pyytää marjoja, sieniä ja opettaa ruoanlaiton sekä elinvoiman palauttamisen.' : 'Healer. Requests berries/herbs and teaches cooking/healing.'}
              </div>
              <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 10px 12px; font-size: 0.85rem; color: #bbb;">
                <strong style="color: #fff;">🎣 Kalastaja Toivo (Satamakylä):</strong> ${isFi ? 'Jokilaiturilla. Opettaa kalastuksen ja palkitsee arvokkaalla kalastusvälineistöllä.' : 'Dock master. Teaches fishing and rewards angling gear.'}
              </div>
            </div>
          </div>
        </div>
      `;
    } else if (this.currentTab === 'achievements') {
      const am = this.achievementManager;
      const allAch = am ? Object.values(am.achievements) : [];
      const unlockedCount = allAch.filter(a => a.unlocked).length;

      contentHtml = `
        <div class="st-achievements-container" style="display: flex; flex-direction: column; gap: 16px; max-height: 60vh; overflow-y: auto; padding-right: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(15, 22, 32, 0.9); border: 1px solid rgba(212, 175, 55, 0.35); border-radius: 8px; padding: 12px 18px;">
            <div>
              <h3 style="margin: 0; color: #f1c40f; font-size: 1.15rem; display: flex; align-items: center; gap: 8px;">
                🏆 ${isFi ? 'SAAVUTUKSET & EDISTYMINEN' : 'ACHIEVEMENTS & PROGRESSION'}
              </h3>
              <p style="margin: 4px 0 0 0; color: #bbb; font-size: 0.85rem;">
                ${isFi ? 'Suorita saavutuksia ansaitaksesi kokemuspisteitä (XP) ja taitopisteitä!' : 'Complete achievements to earn XP and Skill Points!'}
              </p>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 1.3rem; font-weight: bold; color: #2ecc71;">${unlockedCount} / ${allAch.length}</span>
              <span style="display: block; font-size: 0.75rem; color: #888;">${isFi ? 'AVATTU' : 'UNLOCKED'}</span>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(310px, 1fr)); gap: 14px;">
            ${allAch.map(a => {
              const pct = Math.min(100, Math.round((a.progress / (a.target || 1)) * 100));
              const title = isFi ? a.title : (a.titleEn || a.title);
              const desc = isFi ? a.desc : (a.descEn || a.desc);
              return `
                <div style="background: ${a.unlocked ? 'rgba(25, 40, 30, 0.95)' : 'rgba(16, 20, 28, 0.9)'}; border: 1px solid ${a.unlocked ? '#2ecc71' : 'rgba(255,255,255,0.12)'}; border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span style="font-size: 1.5rem;">${a.icon}</span>
                      <span style="font-weight: bold; color: ${a.unlocked ? '#fff' : '#ddd'}; font-size: 1.02rem;">${title}</span>
                    </div>
                    <span style="background: ${a.unlocked ? 'rgba(46, 204, 113, 0.2)' : 'rgba(241, 196, 15, 0.15)'}; color: ${a.unlocked ? '#2ecc71' : '#f1c40f'}; border: 1px solid ${a.unlocked ? '#2ecc71' : 'rgba(241, 196, 15, 0.4)'}; font-size: 0.75rem; padding: 2px 8px; border-radius: 4px; font-weight: bold;">
                      ${a.unlocked ? (isFi ? '✅ AVATTU' : '✅ COMPLETED') : `${a.progress}/${a.target}`}
                    </span>
                  </div>
                  <div style="color: #bbb; font-size: 0.88rem; line-height: 1.35;">${desc}</div>
                  
                  <!-- Progress bar -->
                  <div style="margin-top: 4px;">
                    <div style="background: rgba(0,0,0,0.5); border-radius: 4px; height: 6px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);">
                      <div style="background: ${a.unlocked ? '#2ecc71' : 'linear-gradient(90deg, #f39c12, #f1c40f)'}; height: 100%; width: ${pct}%; transition: width 0.3s;"></div>
                    </div>
                  </div>

                  <div style="margin-top: 4px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 0.8rem; color: #f1c40f; display: flex; justify-content: space-between;">
                    <span>🎁 ${isFi ? 'Palkinto' : 'Reward'}: <strong>${a.rewardText}</strong></span>
                    ${a.unlocked ? '<span style="color: #2ecc71; font-weight: bold;">+ SAATU</span>' : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    } else {
      // Skills Tab
      const trees = [
        { key: 'warrior', title: isFi ? '⚔️ SOTURI & MIEKKAILU' : '⚔️ WARRIOR & COMBAT', desc: isFi ? 'Lähitaistelu, voimaiskut ja kestävyys' : 'Melee combat, power strikes and endurance' },
        { key: 'mage', title: isFi ? '🔮 TAIKUUS & RIIMULOITSUT' : '🔮 MAGE & ARCANE RUNES', desc: isFi ? 'Elementaalivoimat, räjähdykset ja parantaminen' : 'Elemental magic, bursts and recovery' },
        { key: 'ranger', title: isFi ? '🏹 JOUSIAMMUNTA & VALPPAUS' : '🏹 RANGER & AGILITY', desc: isFi ? 'Tarkat laukaukset, nuolisateet ja liikenopeus' : 'Precision shots, arrow volleys and speed' }
      ];

      contentHtml = `
        <div class="st-quickbar-assignment">
          <span class="st-qa-title">${isFi ? 'Aktiiviset erikoisliikkeet pikanäppäimissä [1] - [4]:' : 'Active abilities assigned to keys [1] - [4]:'}</span>
          <div class="st-slots-row">
            ${[0, 1, 2, 3].map(slotIdx => {
              const skillId = this.activeSlots[slotIdx];
              const s = skillId ? this.skills[skillId] : null;
              return `
                <div class="st-active-slot" data-slot="${slotIdx}">
                  <span class="st-key-num">[${slotIdx + 1}]</span>
                  <span class="st-slot-icon">${s ? s.name.split(' ')[0] : '➕'}</span>
                  <span class="st-slot-name">${s ? s.name.split(' ')[1] : (isFi ? 'Tyhjä' : 'Empty')}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div class="skill-tree-columns">
          ${trees.map(t => {
            const list = Object.values(this.skills).filter(s => s.tree === t.key);
            return `
              <div class="st-column st-col-${t.key}">
                <div class="st-col-header">
                  <h3>${t.title}</h3>
                  <small>${t.desc}</small>
                </div>
                <div class="st-nodes-list">
                  ${list.map(s => {
                    const isUnlocked = s.unlocked;
                    const canUnlock = !isUnlocked && skillPoints > 0 && level >= s.reqLevel;
                    const isAssigned = this.activeSlots.includes(s.id);
                    const slotNum = this.activeSlots.indexOf(s.id);

                    return `
                      <div class="st-node-card ${isUnlocked ? 'unlocked' : 'locked'}">
                        <div class="st-node-top">
                          <span class="st-node-name">${s.name}</span>
                          <span class="st-node-req">${isUnlocked ? (isFi ? '✅ Opittu' : '✅ Learned') : `${isFi ? 'Vaatii' : 'Req'}: ${isFi ? 'Taso' : 'Level'} ${s.reqLevel}`}</span>
                        </div>
                        <div class="st-node-desc">${s.desc}</div>
                        <div class="st-node-info">
                          <span>${isFi ? 'Kulu' : 'Cost'}: ${s.cost} ${s.costType === 'mana' ? (isFi ? '💧 Manaa' : '💧 Mana') : (isFi ? '⚡ Kestävyyttä' : '⚡ Stamina')}</span>
                          <span>${isFi ? 'Jäähtymisaika' : 'Cooldown'}: ${s.cooldown}s</span>
                        </div>
                        <div class="st-node-actions">
                          ${!isUnlocked ? `
                            <button class="st-btn-unlock" data-skill-id="${s.id}" ${canUnlock ? '' : 'disabled'}>
                              ${canUnlock ? (isFi ? '✨ Opi taito (1 piste)' : '✨ Learn Skill (1 pt)') : (skillPoints === 0 ? (isFi ? 'Ei taitopisteitä' : 'No skill points') : `${isFi ? 'Vaatii tason' : 'Requires Level'} ${s.reqLevel}`)}
                            </button>
                          ` : `
                            <button class="st-btn-equip" data-skill-id="${s.id}">
                              ${isAssigned ? `${isFi ? 'Varustettu paikassa' : 'Equipped in slot'} [${slotNum + 1}]` : `${isFi ? 'Aseta pikanäppäimeen' : 'Assign to slot'} [${s.slot}]`}
                            </button>
                          `}
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    let html = `
      <div class="skill-tree-box">
        <div class="skill-tree-header">
          <div class="skill-tree-title-group">
            <h2>⭐ ${isFi ? 'KOKEMUS, TEHTÄVÄT & SAAVUTUKSET [O]' : 'CHARACTER, QUESTS & ACHIEVEMENTS [O]'}</h2>
            <div class="skill-tree-meta" style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; align-items: center;">
              <span class="st-badge">🏆 ${isFi ? 'Taso' : 'Level'}: ${level}</span>
              <span class="st-badge st-xp">${isFi ? 'Kokemus' : 'XP'}: ${xp} / ${xpNext} XP</span>
              <span class="st-badge st-sp">✨ ${isFi ? 'Taitopisteet' : 'Skill Points'}: <strong>${skillPoints}</strong></span>
              <span class="st-badge" style="background: rgba(46, 204, 113, 0.15); border-color: #2ecc71; color: #2ecc71;">
                ❤️ HP: <strong>${p ? p.maxHealth : 100}</strong> • ⚡ Kestävyys: <strong>${p ? p.maxStamina : 100}</strong> • 🔮 Mana: <strong>${p ? p.maxMana : 100}</strong> • ⚔️ +${(level - 1) * 2} Vahinko
              </span>
            </div>
          </div>
          <button id="close-skilltree-btn" class="modal-close">✕</button>
        </div>

        <!-- Navigation Tabs: Skills vs Quests vs Achievements -->
        <div class="st-tabs-row" style="display: flex; gap: 10px; margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.12); padding-bottom: 10px; flex-wrap: wrap;">
          <button class="st-tab-btn ${this.currentTab === 'skills' ? 'active' : ''}" data-tab="skills" style="padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; background: ${this.currentTab === 'skills' ? '#2e7d32' : 'rgba(255,255,255,0.08)'}; color: #fff; border: 1px solid ${this.currentTab === 'skills' ? '#4caf50' : 'rgba(255,255,255,0.15)'}; font-family: inherit;">
            ${isFi ? '⭐ TAIDOT & ERIKOISLIIKKEET' : '⭐ SKILLS & ABILITIES'}
          </button>
          <button class="st-tab-btn ${this.currentTab === 'quests' ? 'active' : ''}" data-tab="quests" style="padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; background: ${this.currentTab === 'quests' ? '#2e7d32' : 'rgba(255,255,255,0.08)'}; color: #fff; border: 1px solid ${this.currentTab === 'quests' ? '#4caf50' : 'rgba(255,255,255,0.15)'}; font-family: inherit;">
            ${isFi ? '📜 TEHTÄVÄT (QUESTS)' : '📜 QUESTS & OBJECTIVES'}
          </button>
          <button class="st-tab-btn ${this.currentTab === 'achievements' ? 'active' : ''}" data-tab="achievements" style="padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; background: ${this.currentTab === 'achievements' ? '#2e7d32' : 'rgba(255,255,255,0.08)'}; color: #fff; border: 1px solid ${this.currentTab === 'achievements' ? '#4caf50' : 'rgba(255,255,255,0.15)'}; font-family: inherit;">
            ${isFi ? '🏆 SAAVUTUKSET (ACHIEVEMENTS)' : '🏆 ACHIEVEMENTS & TROPHIES'}
          </button>
        </div>

        ${contentHtml}
      </div>
    `;

    this.modalEl.innerHTML = html;

    // Attach listeners
    const closeBtn = this.modalEl.querySelector('#close-skilltree-btn');
    if (closeBtn) {
      const handleClose = (e) => {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        this.close();
      };
      closeBtn.addEventListener('click', handleClose);
      closeBtn.addEventListener('pointerdown', handleClose);
      closeBtn.addEventListener('touchend', handleClose);
    }

    // Tab buttons click
    this.modalEl.querySelectorAll('.st-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentTab = btn.getAttribute('data-tab');
        this.render();
      });
    });

    this.modalEl.querySelectorAll('.st-btn-unlock').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.skillId;
        this.unlockSkill(id);
      });
    });

    this.modalEl.querySelectorAll('.st-btn-equip').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.skillId;
        this.equipSkill(id);
      });
    });
  }

  unlockSkill(skillId) {
    const s = this.skills[skillId];
    if (!s || s.unlocked) return;
    if (this.player.skillPoints <= 0 || this.player.level < s.reqLevel) return;

    this.player.skillPoints -= 1;
    s.unlocked = true;

    // Automatically slot into its default slot (1-4)
    const slotIdx = Math.max(0, Math.min(3, s.slot - 1));
    this.activeSlots[slotIdx] = s.id;

    if (this.audioManager) this.audioManager.playLevelUp();
    if (this.hud) this.hud.showNotification(`✨ Opit uuden taidon: ${s.name}! [Asetettu näppäimeen ${slotIdx + 1}]`);

    this.render();
    if (this.hotbar) this.hotbar.render();
  }

  equipSkill(skillId) {
    const s = this.skills[skillId];
    if (!s || !s.unlocked) return;
    const slotIdx = Math.max(0, Math.min(3, s.slot - 1));
    this.activeSlots[slotIdx] = s.id;
    if (this.hud) this.hud.showNotification(`⚔️ Asetettu pikanäppäimeen [${slotIdx + 1}]: ${s.name}`);
    this.render();
    if (this.hotbar) this.hotbar.render();
  }

  update(delta) {
    // Tick cooldowns
    for (const key of Object.keys(this.cooldowns)) {
      if (this.cooldowns[key] > 0) {
        this.cooldowns[key] = Math.max(0, this.cooldowns[key] - delta);
      }
    }

    if (this.berserkTimer > 0) {
      this.berserkTimer -= delta;
      if (this.berserkTimer <= 0) {
        if (this.hud) this.hud.showNotification('🔥 Berserkkitila päättyi.');
      }
    }
  }

  castSlot(slotIdx) {
    const skillId = this.activeSlots[slotIdx];
    if (!skillId) {
      if (this.hud) this.hud.showNotification(`Pikanäppäimessä [${slotIdx + 1}] ei ole taitoa. Avaa [O] oppiaksesi taitoja!`, 2000);
      return;
    }

    const s = this.skills[skillId];
    if (!s || !s.unlocked) return;

    if (this.cooldowns[skillId] > 0) {
      if (this.hud) this.hud.showNotification(`⏳ ${s.name} jäähtyy vielä ${Math.ceil(this.cooldowns[skillId])}s!`, 1200);
      return;
    }

    // Check resource cost
    const p = this.player;
    if (s.costType === 'mana') {
      if (p.mana < s.cost) {
        if (this.hud) this.hud.showNotification(`💧 Ei tarpeeksi manaa! (Tarvitaan ${s.cost} Manaa)`, 1500);
        return;
      }
      p.mana -= s.cost;
    } else {
      if (p.stamina < s.cost) {
        if (this.hud) this.hud.showNotification(`⚡ Ei tarpeeksi kestävyyttä! (Tarvitaan ${s.cost})`, 1500);
        return;
      }
      p.stamina -= s.cost;
    }

    // Start cooldown
    this.cooldowns[skillId] = s.cooldown;

    // Execute skill effect!
    this.executeSkill(s);
  }

  executeSkill(s) {
    const p = this.player;
    const c = this.combat;

    if (s.id === 'whirlwind') {
      // 360 Spin attack around player
      if (p) p.playAnimation('Sword_Heavy_Combo');
      if (this.audioManager) this.audioManager.playSpecialMove('whirlwind');
      if (c) c.performWhirlwind(2.0, 5.0); // 2x dmg, 5m radius
      if (this.hud) this.hud.showNotification(`🌪️ ${s.name}!`);
    } else if (s.id === 'groundSlam') {
      // Jump and slam into ground
      if (p) p.playAnimation('NinjaJump_Land');
      if (this.audioManager) this.audioManager.playSpecialMove('groundSlam');
      if (c) c.performGroundSlam(3.0, 7.0); // 3x dmg, 7m radius, shockwave
      if (this.hud) this.hud.showNotification(`💥 ${s.name}!`);
    } else if (s.id === 'dashSlash') {
      // Fast forward dash
      if (p) p.playAnimation('Sword_Dash');
      if (this.audioManager) this.audioManager.playSpecialMove('dash');
      if (p) {
        const fwd = new THREE.Vector3();
        p.camera.getWorldDirection(fwd);
        fwd.y = 0;
        fwd.normalize();
        p.playerPos.add(fwd.multiplyScalar(10.0));
      }
      if (c) c.performWhirlwind(1.8, 3.5);
      if (this.hud) this.hud.showNotification(`⚡ ${s.name}!`);
    } else if (s.id === 'berserkRage') {
      this.berserkTimer = 12.0;
      if (this.audioManager) this.audioManager.playSpecialMove('groundSlam');
      if (this.hud) this.hud.showNotification(`🔥 ${s.name} aktivoitu! (+100% Vahinko, +50% Nopeus, 35% Lifesteal 12s)`, 3500);
    } else if (s.id === 'fireball') {
      if (this.audioManager) this.audioManager.playSpell('fireball');
      if (c) c.castFireball();
      if (this.hud) this.hud.showNotification(`🔥 ${s.name}!`);
    } else if (s.id === 'frostNova') {
      if (this.audioManager) this.audioManager.playSpell('frost');
      if (c) c.castFrostNova(8.0);
      if (this.hud) this.hud.showNotification(`❄️ ${s.name}!`);
    } else if (s.id === 'chainLightning') {
      if (this.audioManager) this.audioManager.playSpell('lightning');
      if (c) c.castChainLightning();
      if (this.hud) this.hud.showNotification(`⚡ ${s.name}!`);
    } else if (s.id === 'celestialBeam') {
      if (this.audioManager) this.audioManager.playLevelUp();
      if (p) p.heal(100);
      if (c) c.castCelestialBeam();
      if (this.hud) this.hud.showNotification(`☀️ ${s.name}! (Terveys palautettu täyteen!)`, 3000);
    } else if (s.id === 'powerShot') {
      if (this.audioManager) this.audioManager.playBowShot();
      if (c) c.shootArrow(2.5, true); // 2.5x dmg, piercing
      if (this.hud) this.hud.showNotification(`🎯 ${s.name}!`);
    } else if (s.id === 'rainOfArrows') {
      if (this.audioManager) this.audioManager.playBowShot();
      if (c) c.castRainOfArrows();
      if (this.hud) this.hud.showNotification(`🌧️ ${s.name}!`);
    } else if (s.id === 'multiShot') {
      if (this.audioManager) this.audioManager.playBowShot();
      if (c) c.shootMultiShot(5);
      if (this.hud) this.hud.showNotification(`🏹 ${s.name}!`);
    } else if (s.id === 'shadowPiercer') {
      if (this.audioManager) this.audioManager.playBowShot();
      if (c) c.shootArrow(4.0, true);
      if (this.hud) this.hud.showNotification(`👻 ${s.name}!`);
    }
  }
}
