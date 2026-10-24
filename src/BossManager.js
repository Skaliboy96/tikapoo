import * as THREE from 'three';

/**
 * BossManager – 5 Unique Biome Bosses with Complex Combat Mechanics,
 * Progressive Unlocks, Valheim/Dark Souls Boss Health Bar, and Legendary Gear Drops.
 */
export default class BossManager {
  constructor(scene, world, inventory, hud, audioManager, questManager, assetLoader = null, player = null) {
    this.scene = scene;
    this.world = world;
    this.inventory = inventory;
    this.hud = hud;
    this.audioManager = audioManager;
    this.questManager = questManager;
    this.assetLoader = assetLoader;
    this.player = player;

    // Boss HUD DOM Elements
    this.bossHudEl = document.getElementById('boss-hud');
    this.bossNameEl = document.getElementById('boss-hud-name');
    this.bossBiomeEl = document.getElementById('boss-hud-biome');
    this.bossHpFillEl = document.getElementById('boss-hud-bar-fill');
    this.bossPhaseEl = document.getElementById('boss-hud-phase');
    this.bossHpValEl = document.getElementById('boss-hud-hp-val');

    // Progression state: 0 = Boss 1 unlocked, 1 = Boss 2, ..., 4 = Boss 5
    const savedProgress = localStorage.getItem('tikapoo_boss_progress');
    this.unlockedBossIndex = savedProgress !== null ? parseInt(savedProgress, 10) : 0;

    this.projectiles = [];
    this.particles = [];
    this.activeBoss = null; // currently targeted/engaged boss

    this.bossDefs = [
      {
        id: 'forestBeast',
        name: 'Metsän Kauhu – Sarvipeto',
        title: 'Muinainen Hirvikuningas',
        biome: 'AARNIOMETSÄ',
        arenaPos: { x: -140, z: -140 },
        maxHealth: 1200,
        damage: 24,
        scale: 3.2,
        color: 0x2e401e,
        glowColor: 0xf1c40f,
        type: 'beast',
        drops: { beastHeart: 1, hardAntler: 2, leather: 6, meat: 5 },
        unlockMessage: 'Suon sumut hälvenevät... Sait Kovan Sarven! Valmista Sarvihakku ja louhi Pronssia Mustametsästä.'
      },
      {
        id: 'swampWyrm',
        name: 'Suon Kauhu – Vesipeto Näkki',
        title: 'Mutaliskojen Keisari',
        biome: 'SUMUSUOT',
        arenaPos: { x: -170, z: 155 },
        maxHealth: 2200,
        damage: 34,
        scale: 3.5,
        color: 0x1b4332,
        glowColor: 0x2ecc71,
        type: 'wyrm',
        drops: { swampScale: 1, swampKey: 1, salmon: 4, bronze: 6 },
        unlockMessage: 'Sait Suoavaimen! Sumusoilta voit nyt louhia Rautamalmia ja takoa rauta-aseita.'
      },
      {
        id: 'mountainGolem',
        name: 'Harjanteen Jätti – Kallionmurskaaja',
        title: 'Titaaninen Graniittikuningas',
        biome: 'KALLIOVUORISTO',
        arenaPos: { x: 175, z: -170 },
        maxHealth: 3600,
        damage: 46,
        scale: 4.2,
        color: 0x4a4a4a,
        glowColor: 0xe74c3c,
        type: 'golem',
        drops: { graniteCore: 1, wishbone: 1, stone: 25, bronze: 6 },
        unlockMessage: 'Sait Maan Sydämen! Kalliovuoriston kätketyt Hopeasuonet ja Teräs ovat nyt louhittavissa.'
      },
      {
        id: 'runeWraith',
        name: 'Muinainen Aave – Riimunvartija',
        title: 'Arkaanisen Valon Suojelija',
        biome: 'RIIMUPYHÄKKÖ',
        arenaPos: { x: 215, z: -25 },
        maxHealth: 5200,
        damage: 58,
        scale: 3.4,
        color: 0x192a56,
        glowColor: 0x00d2d3,
        type: 'wraith',
        drops: { runeCore: 1, artisanCore: 1, shadow_essence: 6, bone: 8 },
        unlockMessage: 'Sait Riimumestarin Kiven! Rakenna Sulatto & Ahjo ja sulata legendaarista Mustaa Metallia.'
      },
      {
        id: 'shadowDragon',
        name: 'Sysipimeyden Ruhtinas – Varjodraakki',
        title: 'Pohjolan Tuhoaja',
        biome: 'SYSIVUORI',
        arenaPos: { x: 0, z: 275 },
        maxHealth: 7500,
        damage: 75,
        scale: 4.8,
        color: 0x110e14,
        glowColor: 0xff3838,
        type: 'dragon',
        drops: { dragonCrown: 1, dragonTears: 3, shadow_essence: 10 },
        unlockMessage: '👑 Olet alistanut kaikki Pohjolan 5 Muinaista Petoa! Sait Lohikäärmeen Kyyneleet jumalvarusteisiin!'
      }
    ];

    this.bosses = [];
    this.buildArenas();
    this.spawnActiveBosses();
  }

  // --- Build Atmospheric Arenas for each Biome Boss ---
  buildArenas() {
    this.bossDefs.forEach((def, index) => {
      const ax = def.arenaPos.x;
      const az = def.arenaPos.z;
      const ay = this.world ? this.world.getGroundHeight(ax, az) : 0;

      const arenaGroup = new THREE.Group();
      arenaGroup.position.set(ax, ay, az);

      // Arena boundary rune pillars
      const pillarCount = 8;
      const arenaRadius = 26;
      for (let p = 0; p < pillarCount; p++) {
        const ang = (p / pillarCount) * Math.PI * 2;
        const px = Math.cos(ang) * arenaRadius;
        const pz = Math.sin(ang) * arenaRadius;

        const pGeo = new THREE.CylinderGeometry(0.55, 0.75, 4.2, 7);
        const pMat = new THREE.MeshStandardMaterial({
          color: index === 4 ? 0x2b1c2e : (index === 3 ? 0x3d4b63 : 0x48423d),
          roughness: 0.9
        });
        const pillar = new THREE.Mesh(pGeo, pMat);
        pillar.position.set(px, 2.1, pz);
        pillar.castShadow = true;
        pillar.receiveShadow = true;
        arenaGroup.add(pillar);

        // Glowing Rune engraving on pillar
        const rGeo = new THREE.BoxGeometry(0.12, 1.2, 0.4);
        const rMat = new THREE.MeshBasicMaterial({
          color: def.glowColor
        });
        const rune = new THREE.Mesh(rGeo, rMat);
        rune.position.set(px, 2.4, pz);
        arenaGroup.add(rune);
      }

      // Central summoning circle platform
      const circleGeo = new THREE.CylinderGeometry(4.5, 4.8, 0.4, 24);
      const circleMat = new THREE.MeshStandardMaterial({
        color: 0x33302c,
        roughness: 0.92
      });
      const circle = new THREE.Mesh(circleGeo, circleMat);
      circle.position.y = 0.2;
      circle.receiveShadow = true;
      arenaGroup.add(circle);

      // Central altar light
      const aLight = new THREE.PointLight(def.glowColor, 2.2, 28, 1.4);
      aLight.position.set(0, 1.8, 0);
      arenaGroup.add(aLight);

      this.scene.add(arenaGroup);
    });
  }

  // --- Create 3D Boss Mesh with Unique Archetypes ---
  _createBossMesh(def) {
    const group = new THREE.Group();
    const flashMaterials = [];

    if (def.type === 'beast') {
      // 1. Ancient Elk/Horned Beast
      const bodyGeo = new THREE.BoxGeometry(1.8, 1.6, 3.2);
      const bodyMat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.85 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 1.6;
      body.castShadow = true;
      group.add(body);
      flashMaterials.push(bodyMat);

      // 4 Animated Leg Pivots for natural trotting and galloping
      const legs = [];
      const legOffsets = [
        { x: -0.7, z: 1.1, isFront: true, isLeft: true },
        { x: 0.7, z: 1.1, isFront: true, isLeft: false },
        { x: -0.7, z: -1.1, isFront: false, isLeft: true },
        { x: 0.7, z: -1.1, isFront: false, isLeft: false }
      ];

      for (const off of legOffsets) {
        const pivot = new THREE.Group();
        pivot.position.set(off.x, 1.5, off.z);
        const legGeo = new THREE.CylinderGeometry(0.24, 0.2, 1.5, 8);
        const leg = new THREE.Mesh(legGeo, bodyMat);
        leg.position.set(0, -0.75, 0);
        leg.castShadow = true;
        pivot.add(leg);
        group.add(pivot);
        legs.push({ pivot, ...off });
      }
      group.userData.legs = legs;

      // Head & Massive Antlers
      const headGeo = new THREE.BoxGeometry(0.9, 0.9, 1.4);
      const head = new THREE.Mesh(headGeo, bodyMat);
      head.position.set(0, 2.4, 1.7);
      head.castShadow = true;
      group.add(head);

      // Glowing Antlers
      const hornMat = new THREE.MeshStandardMaterial({
        color: def.glowColor,
        emissive: def.glowColor,
        emissiveIntensity: 0.7,
        roughness: 0.3
      });
      group.userData.hornMat = hornMat;
      for (const hx of [-0.65, 0.65]) {
        const hornGeo = new THREE.CylinderGeometry(0.08, 0.18, 2.2, 8);
        const horn = new THREE.Mesh(hornGeo, hornMat);
        horn.position.set(hx, 3.3, 1.4);
        horn.rotation.z = (hx < 0 ? 0.45 : -0.45);
        horn.rotation.x = -0.3;
        group.add(horn);

        // Branch tines
        const tineGeo = new THREE.CylinderGeometry(0.05, 0.1, 0.9, 6);
        const tine = new THREE.Mesh(tineGeo, hornMat);
        tine.position.set(hx * 1.5, 3.8, 1.5);
        tine.rotation.z = (hx < 0 ? 0.9 : -0.9);
        group.add(tine);
      }

      // Glowing Nordic Rune Eyes & Chest Sigil
      const beastEyeMat = new THREE.MeshBasicMaterial({ color: def.glowColor });
      for (const ex of [-0.48, 0.48]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), beastEyeMat);
        eye.position.set(ex, 2.5, 2.1);
        group.add(eye);
      }
      const sigilGeo = new THREE.OctahedronGeometry(0.42, 0);
      const sigil = new THREE.Mesh(sigilGeo, beastEyeMat);
      sigil.position.set(0, 1.8, 1.62);
      group.add(sigil);
    } else if (def.type === 'wyrm') {
      // 2. Swamp Water Wyrm / Behemoth
      const bodyGeo = new THREE.CylinderGeometry(1.2, 1.6, 4.5, 12);
      bodyGeo.rotateX(Math.PI / 2);
      const bodyMat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.5, metalness: 0.2 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 1.3;
      body.castShadow = true;
      group.add(body);
      flashMaterials.push(bodyMat);

      // Spine ridges
      const spineMat = new THREE.MeshStandardMaterial({ color: def.glowColor, emissive: def.glowColor, emissiveIntensity: 0.5 });
      for (let s = -1.8; s <= 1.8; s += 0.8) {
        const spGeo = new THREE.ConeGeometry(0.35, 1.1, 5);
        const sp = new THREE.Mesh(spGeo, spineMat);
        sp.position.set(0, 2.3, s);
        group.add(sp);
      }

      // Snapping Crocodile/Serpent Jaws
      const jawGeo = new THREE.BoxGeometry(1.1, 0.7, 1.8);
      const jaw = new THREE.Mesh(jawGeo, bodyMat);
      jaw.position.set(0, 1.4, 2.7);
      group.add(jaw);
    } else if (def.type === 'golem') {
      // 3. Mountain Granite Golem
      const torsoGeo = new THREE.DodecahedronGeometry(2.1, 1);
      const golemMat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.95 });
      const torso = new THREE.Mesh(torsoGeo, golemMat);
      torso.position.y = 2.8;
      torso.castShadow = true;
      group.add(torso);
      flashMaterials.push(golemMat);

      // Huge boulder shoulders & arms
      for (const side of [-1, 1]) {
        const shoulder = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1, 1), golemMat);
        shoulder.position.set(side * 2.4, 3.4, 0);
        group.add(shoulder);

        const fist = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.4, 0.9), golemMat);
        fist.position.set(side * 2.4, 1.5, 0.4);
        fist.castShadow = true;
        group.add(fist);
      }

      // Glowing Magma Core inside chest
      const coreGeo = new THREE.OctahedronGeometry(0.65, 0);
      const coreMat = new THREE.MeshBasicMaterial({ color: def.glowColor });
      const core = new THREE.Mesh(coreGeo, coreMat);
      core.position.set(0, 2.7, 1.8);
      group.add(core);
    } else if (def.type === 'wraith') {
      // 4. Muinainen Aave – Riimunvartija (Towering Undead Lich King)
      let mageMixer = null;
      if (this.assetLoader) {
        const charData = this.assetLoader.createAnimatedCharacter('Skeleton_Mage', 'Idle_A');
        if (charData && charData.model) {
          const mageModel = charData.model;
          mageMixer = charData.mixer;
          mageModel.scale.set(3.4, 3.4, 3.4);
          mageModel.position.set(0, 0, 0);

          let handBone = null;
          let headBone = null;
          mageModel.traverse((child) => {
            if (child.isBone) {
              if (child.name === 'head' || child.name === 'Head') headBone = child;
              if (child.name === 'handslot.r') handBone = child;
              else if (!handBone && (child.name === 'hand.r' || child.name.includes('hand_r'))) handBone = child;
            }
            if (child.isMesh && child.material) {
              child.material = child.material.clone();
              child.material.roughness = 0.6;
              flashMaterials.push(child.material);
            }
          });

          // Equip Necrotic Runic Staff
          const staffModel = this.assetLoader.get('Skeleton_Staff');
          if (staffModel && handBone) {
            staffModel.scale.set(1.3, 1.3, 1.3);
            staffModel.rotation.set(0, Math.PI / 2, 0);
            handBone.add(staffModel);
          }

          // Glowing cyan eye flames on skull
          if (headBone) {
            const eyeMat = new THREE.MeshBasicMaterial({ color: def.glowColor });
            const eyeGeo = new THREE.SphereGeometry(0.045, 6, 6);
            const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
            eyeL.position.set(-0.065, 0.08, 0.12);
            const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
            eyeR.position.set(0.065, 0.08, 0.12);
            headBone.add(eyeL, eyeR);
          }

          group.add(mageModel);
          group.userData.charMixer = mageMixer;
        }
      }

      // If glTF character not available, fallback to ethereal wraith robes
      if (!group.children.length) {
        const cloakGeo = new THREE.ConeGeometry(1.6, 4.0, 10, 1, true);
        const cloakMat = new THREE.MeshStandardMaterial({
          color: def.color,
          roughness: 0.4,
          transparent: true,
          opacity: 0.88,
          side: THREE.DoubleSide
        });
        const cloak = new THREE.Mesh(cloakGeo, cloakMat);
        cloak.position.y = 2.4;
        group.add(cloak);
        flashMaterials.push(cloakMat);
      }

      // Concentric Rotating Runic Rings
      const ringGeo = new THREE.TorusGeometry(2.4, 0.09, 8, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: def.glowColor, transparent: true, opacity: 0.85 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 3.2;
      ring.rotation.x = Math.PI / 3;
      group.add(ring);
      group.userData.runeRing = ring;

      const innerRingGeo = new THREE.TorusGeometry(1.6, 0.06, 6, 24);
      const innerRingMat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.75 });
      const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
      innerRing.position.y = 3.2;
      innerRing.rotation.y = Math.PI / 4;
      group.add(innerRing);
      group.userData.innerRuneRing = innerRing;

      // Dark Arcane Aura Light
      const auraLight = new THREE.PointLight(def.glowColor, 2.5, 20, 1.2);
      auraLight.position.set(0, 3.2, 0);
      group.add(auraLight);
    } else if (def.type === 'dragon') {
      // 5. Cursed Shadow Dragon
      const bodyGeo = new THREE.CylinderGeometry(1.4, 1.8, 5.0, 10);
      bodyGeo.rotateX(Math.PI / 2);
      const dragonMat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.7 });
      const body = new THREE.Mesh(bodyGeo, dragonMat);
      body.position.y = 2.2;
      body.castShadow = true;
      group.add(body);
      flashMaterials.push(dragonMat);

      // Giant Wings
      for (const side of [-1, 1]) {
        const wingGeo = new THREE.BufferGeometry();
        const vertices = new Float32Array([
          0, 2.6, 0,
          side * 4.8, 4.5, -1.5,
          side * 3.6, 1.2, 0.8
        ]);
        wingGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        wingGeo.computeVertexNormals();
        const wingMat = new THREE.MeshStandardMaterial({
          color: 0x4a0e17,
          side: THREE.DoubleSide,
          roughness: 0.6
        });
        const wing = new THREE.Mesh(wingGeo, wingMat);
        group.add(wing);
      }

      // Dragon Head with Glowing Horns & Mouth
      const headGeo = new THREE.BoxGeometry(1.2, 1.1, 2.2);
      const head = new THREE.Mesh(headGeo, dragonMat);
      head.position.set(0, 3.2, 3.2);
      head.castShadow = true;
      group.add(head);

      const eyeMat = new THREE.MeshBasicMaterial({ color: def.glowColor });
      for (const ex of [-0.48, 0.48]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), eyeMat);
        eye.position.set(ex, 3.5, 3.8);
        group.add(eye);
      }
    }

    // Glowing Eyes / Core for all
    const auraLight = new THREE.PointLight(def.glowColor, 2.8, 16, 1.5);
    auraLight.position.set(0, 2.2, 1.0);
    group.add(auraLight);

    // Apply majestic boss scale
    group.scale.set(def.scale, def.scale, def.scale);

    return { group, flashMaterials };
  }

  // --- Spawn currently unlocked bosses ---
  spawnActiveBosses() {
    this.bosses = [];

    this.bossDefs.forEach((def, index) => {
      // Spawn bosses up to the unlocked index
      const isDefeated = (index < this.unlockedBossIndex);
      const isUnlocked = (index <= this.unlockedBossIndex);

      if (!isUnlocked || isDefeated) {
        return; // Locked or already slain
      }

      const { group, flashMaterials } = this._createBossMesh(def);
      const ay = this.world ? this.world.getGroundHeight(def.arenaPos.x, def.arenaPos.z) : 0;
      group.position.set(def.arenaPos.x, ay, def.arenaPos.z);
      this.scene.add(group);

      const boss = {
        def,
        index,
        mesh: group,
        flashMaterials,
        health: def.maxHealth,
        maxHealth: def.maxHealth,
        damage: def.damage,
        isAlive: true,
        phase: 1,
        state: 'idle',
        cooldown: 0,
        specialTimer: 4.0,
        isCharging: false,
        chargeDir: new THREE.Vector3(),
        submerged: false,
        invulnerable: false,
        runeStones: [],
        animTime: 0,

        takeDamage: (amount) => {
          if (!boss.isAlive) return;
          if (boss.invulnerable) {
            if (this.hud) this.hud.showNotification('🛡️ Bossi on suojattu riimukivillä! Tuhoa riimukivet ensin!');
            return;
          }

          boss.health = Math.max(0, boss.health - amount);
          this.updateBossHud(boss);

          // Red hit flash
          flashMaterials.forEach(m => {
            if (m.color) {
              const orig = m.color.getHex();
              m.color.setHex(0xff2222);
              setTimeout(() => { if (m.color) m.color.setHex(orig); }, 120);
            }
          });

          // Phase checks
          if (boss.health < boss.maxHealth * 0.5 && boss.phase === 1) {
            boss.phase = 2;
            this.triggerPhase2(boss);
          }
          if (boss.health < boss.maxHealth * 0.25 && boss.phase === 2) {
            boss.phase = 3;
            if (this.hud) this.hud.showNotification(`⚠️ ${boss.def.name} siirtyy RAIVOTILAAN!`);
          }

          if (boss.health <= 0) {
            this.defeatBoss(boss);
          }
        }
      };

      group.userData.boss = boss;
      group.userData.enemy = boss;
      group.traverse(c => {
        c.userData.boss = boss;
        c.userData.enemy = boss;
      });

      this.bosses.push(boss);
    });
  }

  triggerPhase2(boss) {
    if (this.hud) {
      this.hud.showNotification(`⚡ ${boss.def.name} – VAIHE 2 ALKAA!`);
    }
    if (boss.def.type === 'wraith') {
      // Spawn 3 floating rune stones that grant invulnerability until broken
      boss.invulnerable = true;
      for (let i = 0; i < 3; i++) {
        const ang = (i / 3) * Math.PI * 2;
        const stoneGeo = new THREE.DodecahedronGeometry(0.9, 0);
        const stoneMat = new THREE.MeshStandardMaterial({
          color: 0x00d2d3,
          emissive: 0x00d2d3,
          emissiveIntensity: 0.8
        });
        const stone = new THREE.Mesh(stoneGeo, stoneMat);
        stone.position.set(Math.cos(ang) * 5.5, 2.5, Math.sin(ang) * 5.5);
        stone.userData.boss = {
          isAlive: true,
          takeDamage: () => {
            boss.mesh.remove(stone);
            boss.runeStones = boss.runeStones.filter(s => s !== stone);
            if (this.hud) this.hud.showNotification('💥 Riimukivi tuhottu!');
            if (boss.runeStones.length === 0) {
              boss.invulnerable = false;
              if (this.hud) this.hud.showNotification('✨ Riimukilpi murtui! Bossi on jälleen haavoittuvainen!');
            }
          }
        };
        boss.mesh.add(stone);
        boss.runeStones.push(stone);
      }
    }
  }

  // --- Boss Defeat & Progression Trigger ---
  defeatBoss(boss) {
    if (!boss.isAlive) return;
    boss.isAlive = false;

    // Remove from scene & spawn epic death particles
    this.scene.remove(boss.mesh);
    this.spawnDeathExplosion(boss.mesh.position, boss.def.glowColor);

    // Hide Boss HUD
    if (this.bossHudEl) {
      this.bossHudEl.style.display = 'none';
    }
    this.activeBoss = null;

    // Grant legendary drops
    Object.entries(boss.def.drops).forEach(([mat, qty]) => {
      this.inventory.add(mat, qty);
    });

    // Advance progression
    this.unlockedBossIndex = Math.max(this.unlockedBossIndex, boss.index + 1);
    localStorage.setItem('tikapoo_boss_progress', this.unlockedBossIndex.toString());

    // Epic Victory Announcement
    if (this.hud) {
      this.hud.showNotification(`🏆 ${boss.def.name} ON KUKISTETTU!`, 5500);
      setTimeout(() => {
        if (this.hud) {
          this.hud.showNotification(boss.def.unlockMessage, 6500);
        }
      }, 3500);
    }

    if (this.audioManager) {
      if (this.audioManager.playBossDefeatedFanfare) {
        this.audioManager.playBossDefeatedFanfare();
      } else {
        this.audioManager.playCraft();
      }
    }
    if (this.questManager) {
      this.questManager.onKill();
      if (this.questManager.onBossKill) {
        this.questManager.onBossKill(boss.def.id);
      }
    }

    // Spawn the next boss immediately
    setTimeout(() => {
      this.spawnActiveBosses();
    }, 1500);
  }

  spawnDeathExplosion(pos, colorHex) {
    const count = 60;
    const pGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
    const pMat = new THREE.MeshBasicMaterial({ color: colorHex });

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(pGeo, pMat);
      mesh.position.copy(pos);
      mesh.position.y += 2.0;

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 14,
        Math.random() * 9 + 4,
        (Math.random() - 0.5) * 14
      );

      this.scene.add(mesh);
      this.particles.push({ mesh, vel, life: 1.6 });
    }
  }

  // --- Update Boss Health Bar HUD ---
  updateBossHud(boss) {
    if (!this.bossHudEl) return;

    if (!boss || !boss.isAlive) {
      this.bossHudEl.style.display = 'none';
      return;
    }

    this.bossHudEl.style.display = 'block';
    if (this.bossNameEl) this.bossNameEl.textContent = boss.def.name;
    if (this.bossBiomeEl) this.bossBiomeEl.textContent = boss.def.biome;
    if (this.bossPhaseEl) this.bossPhaseEl.textContent = `VAIHE ${boss.phase}`;
    if (this.bossHpValEl) this.bossHpValEl.textContent = `${Math.round(boss.health)} / ${boss.maxHealth}`;

    if (this.bossHpFillEl) {
      const pct = Math.max(0, Math.min(100, (boss.health / boss.maxHealth) * 100));
      this.bossHpFillEl.style.width = `${pct}%`;
    }
  }

  // --- Boss AI & Combat Loop Update ---
  update(delta, playerPos) {
    let nearestBoss = null;
    let minDistance = 9999;

    for (const boss of this.bosses) {
      if (!boss.isAlive) continue;

      boss.animTime += delta;
      const bPos = boss.mesh.position;
      const distToPlayer = Math.hypot(playerPos.x - bPos.x, playerPos.z - bPos.z);

      if (distToPlayer < minDistance) {
        minDistance = distToPlayer;
        nearestBoss = boss;
      }

      // Proximity Aggro & Intense Boss Battle Music (within 48m of boss arena)
      if (distToPlayer < 48) {
        boss.state = 'combat';

        const dx = playerPos.x - bPos.x;
        const dz = playerPos.z - bPos.z;
        boss.specialTimer -= delta;
        boss.cooldown -= delta;

        if (this.audioManager && !this.audioManager.isBossMusicActive) {
          this.audioManager.startBossMusic(boss.def);
          if (this.hud) {
            this.hud.showNotification(`⚔️ ${boss.def.name} ilmestyi! Taistele hengestäsi!`, 4000);
          }
        }

        // Mechanic 1: Ancient Elk / Horned Beast (Eikthyr style)
        if (boss.def.type === 'beast') {
          if (!boss.beastState) {
            boss.beastState = 'approach';
            boss.stateTimer = 0;
          }

          const legs = boss.mesh.userData.legs || [];
          const hornMat = boss.mesh.userData.hornMat;

          if (boss.beastState === 'approach') {
            // Smoothly rotate towards player
            const targetAng = Math.atan2(dx, dz);
            boss.mesh.rotation.y = THREE.MathUtils.lerp(boss.mesh.rotation.y, targetAng, delta * 3.5);
            boss.mesh.rotation.x = THREE.MathUtils.lerp(boss.mesh.rotation.x, 0, delta * 5.0);

            // Trotting gait animation
            const trotSpeed = 7.0;
            const trotAngle = Math.sin(boss.animTime * trotSpeed) * 0.45;
            for (const leg of legs) {
              const sign = (leg.isFront === leg.isLeft) ? 1 : -1;
              leg.pivot.rotation.x = trotAngle * sign;
            }
            const ground = this.world ? this.world.getGroundHeight(bPos.x, bPos.z) : 0;
            boss.mesh.position.y = ground + Math.abs(Math.sin(boss.animTime * trotSpeed * 2)) * 0.08;

            if (hornMat) hornMat.emissiveIntensity = 0.7;

            // Move closer if further than 4.5m
            if (distToPlayer > 4.5) {
              const moveDir = new THREE.Vector3(dx, 0, dz).normalize();
              boss.mesh.position.addScaledVector(moveDir, delta * 3.8);
            } else if (boss.cooldown <= 0) {
              // Close-range Hoof Stomp shockwave
              boss.cooldown = 3.5;
              boss.mesh.rotation.x = -0.25; // Rears hooves up
              setTimeout(() => {
                if (boss.isAlive && boss.mesh) {
                  boss.mesh.rotation.x = 0;
                  this.createShockwave(boss.mesh.position, 0xf39c12, 5.5);
                  if (this.audioManager && this.audioManager.playExplosion) {
                    this.audioManager.playExplosion();
                  }
                  if (distToPlayer < 4.8 && this.player) {
                    this.player.takeDamage(boss.damage);
                  }
                }
              }, 400);
            }

            // Trigger charge windup when specialTimer expires (every ~7-8 seconds)
            if (boss.specialTimer <= 0) {
              boss.beastState = 'telegraph';
              boss.stateTimer = 1.0;
              boss.specialTimer = 8.5;
              if (this.hud) this.hud.showNotification('⚡ Sarvipeto virittää ukkosrynnäkköä! Valmistaudu väistämään!');
            }
          } else if (boss.beastState === 'telegraph') {
            boss.stateTimer -= delta;

            // Face player while telegraphing
            const targetAng = Math.atan2(dx, dz);
            boss.mesh.rotation.y = THREE.MathUtils.lerp(boss.mesh.rotation.y, targetAng, delta * 4.0);

            // Rearing back posture + antler electric flashing
            boss.mesh.rotation.x = THREE.MathUtils.lerp(boss.mesh.rotation.x, -0.22, delta * 6.0);
            for (const leg of legs) {
              leg.pivot.rotation.x = leg.isFront ? -0.35 : 0.15;
            }

            if (hornMat) {
              hornMat.emissiveIntensity = 2.5 + Math.sin(boss.animTime * 25) * 1.2;
            }

            if (boss.stateTimer <= 0) {
              // Lock charge direction firmly
              boss.beastState = 'charge';
              boss.stateTimer = 1.25;
              boss.chargeDir.set(dx, 0, dz).normalize();
              boss.mesh.rotation.y = Math.atan2(boss.chargeDir.x, boss.chargeDir.z);
            }
          } else if (boss.beastState === 'charge') {
            boss.stateTimer -= delta;

            // Lower head and horns forward into battering ram posture
            boss.mesh.rotation.x = 0.12;
            // Charge forward strictly along locked chargeDir (no curving/bulldozing!)
            boss.mesh.position.addScaledVector(boss.chargeDir, delta * 13.0);

            // Fast galloping legs
            const gallopAngle = Math.sin(boss.animTime * 20.0) * 0.7;
            for (const leg of legs) {
              leg.pivot.rotation.x = leg.isFront ? gallopAngle : -gallopAngle;
            }

            // Hit player
            if (distToPlayer < 3.2) {
              if (this.player) {
                this.player.takeDamage(boss.damage * 1.4);
              }
              this.createShockwave(boss.mesh.position, 0xe74c3c, 4.0);
              boss.beastState = 'recoil';
              boss.stateTimer = 1.2;
            } else if (boss.stateTimer <= 0) {
              // Charge ended without hitting
              boss.beastState = 'recoil';
              boss.stateTimer = 1.0;
            }
          } else if (boss.beastState === 'recoil') {
            boss.stateTimer -= delta;

            // Recoil panting/recovery pause
            boss.mesh.rotation.x = THREE.MathUtils.lerp(boss.mesh.rotation.x, 0.05, delta * 4.0);
            for (const leg of legs) {
              leg.pivot.rotation.x = 0;
            }
            if (hornMat) hornMat.emissiveIntensity = 0.5;

            if (boss.stateTimer <= 0) {
              boss.beastState = 'approach';
            }
          }
        }

        // Mechanic 2: Swamp Wyrm Poison Spit
        else if (boss.def.type === 'wyrm') {
          if (boss.specialTimer <= 0) {
            boss.specialTimer = 4.5;
            this.fireProjectile(bPos, playerPos, 0x2ecc71, 24);
            if (this.hud) this.hud.showNotification('☣️ Näkki ampuu myrkkyä!');
          }
          if (distToPlayer > 6.0) {
            const moveDir = new THREE.Vector3(dx, 0, dz).normalize();
            boss.mesh.position.addScaledVector(moveDir, delta * 3.8);
          } else if (boss.cooldown <= 0) {
            boss.cooldown = 2.0;
            if (this.player) this.player.takeDamage(boss.damage);
          }
        }

        // Mechanic 3: Mountain Golem Boulder Throw
        else if (boss.def.type === 'golem') {
          if (boss.specialTimer <= 0) {
            boss.specialTimer = 5.5;
            this.fireProjectile(bPos, playerPos, 0x888888, 38, 0.8);
            if (this.hud) this.hud.showNotification('🪨 Kallionmurskaaja heittää lohkareen!');
          }
          const speed = (boss.phase === 3) ? 5.2 : 3.0;
          if (distToPlayer > 6.5) {
            const moveDir = new THREE.Vector3(dx, 0, dz).normalize();
            boss.mesh.position.addScaledVector(moveDir, delta * speed);
          } else if (boss.cooldown <= 0) {
            boss.cooldown = 2.4;
            if (this.player) this.player.takeDamage(boss.damage);
          }
        }

        // Mechanic 4: Rune Wraith Teleport & Starburst
        else if (boss.def.type === 'wraith') {
          if (boss.specialTimer <= 0) {
            boss.specialTimer = 5.0;
            // Teleport across arena
            const randAng = Math.random() * Math.PI * 2;
            boss.mesh.position.x = boss.def.arenaPos.x + Math.cos(randAng) * 16;
            boss.mesh.position.z = boss.def.arenaPos.z + Math.sin(randAng) * 16;
            this.fireProjectile(boss.mesh.position, playerPos, 0x00d2d3, 30);
          }
          if (boss.userData.runeRing) {
            boss.userData.runeRing.rotation.z += delta * 2.0;
          }
          if (boss.userData.innerRuneRing) {
            boss.userData.innerRuneRing.rotation.x += delta * 1.8;
          }
          if (boss.userData.charMixer) {
            boss.userData.charMixer.update(delta);
          }
        }

        // Mechanic 5: Shadow Dragon Breath & Cataclysm
        else if (boss.def.type === 'dragon') {
          if (boss.specialTimer <= 0) {
            boss.specialTimer = 6.0;
            // Dragon flame barrage
            this.fireProjectile(bPos, playerPos, 0xff3838, 55, 0.6);
            if (this.hud) this.hud.showNotification('🔥 Varjodraakki syöksee varjotulta!');
          }
          if (distToPlayer > 8.0) {
            const moveDir = new THREE.Vector3(dx, 0, dz).normalize();
            boss.mesh.position.addScaledVector(moveDir, delta * 4.8);
          } else if (boss.cooldown <= 0) {
            boss.cooldown = 1.8;
            if (this.player) this.player.takeDamage(boss.damage);
          }
        }

        // Align Y with terrain
        const gy = this.world ? this.world.getGroundHeight(bPos.x, bPos.z) : 0;
        bPos.y = gy;
      }
    }

    // Manage active boss health bar visibility & battle music
    if (nearestBoss && minDistance < 50) {
      this.activeBoss = nearestBoss;
      this.updateBossHud(nearestBoss);
    } else {
      if (this.bossHudEl && this.bossHudEl.style.display !== 'none') {
        this.bossHudEl.style.display = 'none';
      }
      this.activeBoss = null;
      if (this.audioManager && this.audioManager.isBossMusicActive && minDistance > 60) {
        this.audioManager.stopBossMusic();
      }
    }

    // Update projectiles & particles
    this.updateProjectiles(delta, playerPos);
    this.updateParticles(delta);
  }

  createShockwave(pos, color = 0xf39c12, maxRadius = 5.0) {
    const ringGeo = new THREE.RingGeometry(0.3, 0.6, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(pos.x, pos.y + 0.12, pos.z);
    this.scene.add(ring);

    let progress = 0;
    const expandAnim = () => {
      progress += 0.055;
      const currentRadius = 0.5 + progress * (maxRadius - 0.5);
      ring.scale.set(currentRadius, currentRadius, currentRadius);
      ringMat.opacity = Math.max(0, 0.95 * (1 - progress));

      // Damage player if in shockwave radius during expansion and grounded
      if (this.player && progress > 0.3 && progress < 0.8) {
        const pPos = this.player.getPosition ? this.player.getPosition() : this.player.playerPos;
        if (pPos) {
          const d = Math.hypot(pPos.x - pos.x, pPos.z - pos.z);
          if (Math.abs(d - currentRadius) < 1.0 && this.player.isGrounded) {
            this.player.takeDamage(22);
          }
        }
      }

      if (progress < 1) {
        requestAnimationFrame(expandAnim);
      } else {
        this.scene.remove(ring);
        ringGeo.dispose();
        ringMat.dispose();
      }
    };
    requestAnimationFrame(expandAnim);
  }

  fireProjectile(fromPos, toPos, colorHex, damage = 25, size = 0.4) {
    const geo = new THREE.SphereGeometry(size, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: colorHex });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(fromPos);
    mesh.position.y += 2.2;

    const dir = new THREE.Vector3().subVectors(toPos, mesh.position).normalize();
    this.scene.add(mesh);

    this.projectiles.push({
      mesh,
      dir,
      speed: 18.0,
      damage,
      life: 3.5
    });
  }

  updateProjectiles(delta, playerPos) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.life -= delta;
      proj.mesh.position.addScaledVector(proj.dir, proj.speed * delta);

      // Check hit against player
      const dist = proj.mesh.position.distanceTo(playerPos);
      if (dist < 1.8) {
        if (this.player) {
          this.player.takeDamage(proj.damage);
        }
        this.scene.remove(proj.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }

      if (proj.life <= 0) {
        this.scene.remove(proj.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  updateParticles(delta) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= delta;
      p.vel.y -= 9.8 * delta;
      p.mesh.position.addScaledVector(p.vel, delta);
      p.mesh.scale.multiplyScalar(0.96);

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
      }
    }
  }

  getBossMeshes() {
    return this.bosses.filter(b => b.isAlive).map(b => b.mesh);
  }

  // Returns all 5 boss info for the World Map
  getBossMarkers() {
    return this.bossDefs.map((def, index) => {
      let status = 'locked';
      if (index < this.unlockedBossIndex) status = 'defeated';
      else if (index === this.unlockedBossIndex) status = 'active';

      return {
        id: def.id,
        name: def.name,
        biome: def.biome,
        x: def.arenaPos.x,
        z: def.arenaPos.z,
        status
      };
    });
  }
}
