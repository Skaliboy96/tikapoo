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
  constructor(player, combat, hud, audioManager) {
    this.player = player;
    this.combat = combat;
    this.hud = hud;
    this.audioManager = audioManager;
    this.hotbar = null;

    this.isOpen = false;
    this.modalEl = null;

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
      // Toggle Skill Tree with [O]
      if (e.code === 'KeyO') {
        if (this.isOpen) {
          this.close();
        } else {
          this.open();
        }
      }

      // Close with ESC
      if (e.code === 'Escape' && this.isOpen) {
        this.close();
      }

      // Trigger Skills 1-4 when not typing in an input
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (this.isOpen) return;

      if (e.code === 'Digit1') this.castSlot(0);
      else if (e.code === 'Digit2') this.castSlot(1);
      else if (e.code === 'Digit3') this.castSlot(2);
      else if (e.code === 'Digit4') this.castSlot(3);
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
  }

  render() {
    if (!this.modalEl) return;

    const p = this.player;
    const level = p ? p.level : 1;
    const xp = p ? p.xp : 0;
    const xpNext = p ? p.xpNext : 100;
    const skillPoints = p ? p.skillPoints : 0;

    const trees = [
      { key: 'warrior', title: '⚔️ SOTURI & MIEKKAILU', desc: 'Lähitaistelu, voimaiskut ja kestävyys' },
      { key: 'mage', title: '🔮 TAIKUUS & RIIMULOITSUT', desc: 'Elementaalivoimat, räjähdykset ja parantaminen' },
      { key: 'ranger', title: '🏹 JOUSIAMMUNTA & VALPPAUS', desc: 'Tarkat laukaukset, nuolisateet ja liikenopeus' }
    ];

    let html = `
      <div class="skill-tree-box">
        <div class="skill-tree-header">
          <div class="skill-tree-title-group">
            <h2>⭐ TAIDOT &amp; ERIKOISLIIKKEET</h2>
            <div class="skill-tree-meta">
              <span class="st-badge">🏆 Taso: ${level}</span>
              <span class="st-badge st-xp">Kokemus: ${xp} / ${xpNext} XP</span>
              <span class="st-badge st-sp">✨ Taitopisteet: <strong>${skillPoints}</strong></span>
            </div>
          </div>
          <button id="close-skilltree-btn" class="modal-close">✕</button>
        </div>

        <div class="st-quickbar-assignment">
          <span class="st-qa-title">Aktiiviset erikoisliikkeet pikanäppäimissä [1] - [4]:</span>
          <div class="st-slots-row">
            ${[0, 1, 2, 3].map(slotIdx => {
              const skillId = this.activeSlots[slotIdx];
              const s = skillId ? this.skills[skillId] : null;
              return `
                <div class="st-active-slot" data-slot="${slotIdx}">
                  <span class="st-key-num">[${slotIdx + 1}]</span>
                  <span class="st-slot-icon">${s ? s.name.split(' ')[0] : '➕'}</span>
                  <span class="st-slot-name">${s ? s.name.split(' ')[1] : 'Tyhjä'}</span>
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
                          <span class="st-node-req">${isUnlocked ? '✅ Opittu' : `Vaatii: Taso ${s.reqLevel}`}</span>
                        </div>
                        <div class="st-node-desc">${s.desc}</div>
                        <div class="st-node-info">
                          <span>Kulu: ${s.cost} ${s.costType === 'mana' ? '💧 Manaa' : '⚡ Kestävyyttä'}</span>
                          <span>Jäähtymisaika: ${s.cooldown}s</span>
                        </div>
                        <div class="st-node-actions">
                          ${!isUnlocked ? `
                            <button class="st-btn-unlock" data-skill-id="${s.id}" ${canUnlock ? '' : 'disabled'}>
                              ${canUnlock ? '✨ Opi taito (1 piste)' : (skillPoints === 0 ? 'Ei taitopisteitä' : `Vaatii tason ${s.reqLevel}`)}
                            </button>
                          ` : `
                            <button class="st-btn-equip" data-skill-id="${s.id}">
                              ${isAssigned ? `Varustettu paikassa [${slotNum + 1}]` : `Aseta pikanäppäimeen [${s.slot}]`}
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
      </div>
    `;

    this.modalEl.innerHTML = html;

    // Attach listeners
    const closeBtn = this.modalEl.querySelector('#close-skilltree-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());

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
