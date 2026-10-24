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

    // Progression state & Defeated Bosses Tracking
    let savedDefeated = [];
    try {
      savedDefeated = JSON.parse(localStorage.getItem('tikapoo_defeated_boss_ids') || '[]');
    } catch (e) {
      savedDefeated = [];
    }
    this.defeatedBossIds = new Set(savedDefeated);

    const savedProgress = localStorage.getItem('tikapoo_boss_progress');
    this.unlockedBossIndex = savedProgress !== null ? parseInt(savedProgress, 10) : 0;
    this.unlockedBossIndex = isNaN(this.unlockedBossIndex) ? 0 : Math.max(0, Math.min(4, this.unlockedBossIndex));

    this.projectiles = [];
    this.particles = [];
    this.activeBoss = null; // currently targeted/engaged boss

    this.bossDefs = [
      {
        id: 'forestBeast',
        name: 'Muinainen Sarvipeto – Ukkosvaltias',
        title: 'Muinainen Hirvikuningas & Chieftain',
        biome: 'AARNIOMETSÄ & NIITYT',
        arenaPos: { x: -140, z: -140 },
        maxHealth: 1400,
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
        title: 'Mutaliskojen Keisari & Suoherra',
        biome: 'SUMUSUOT',
        arenaPos: { x: -170, z: 155 },
        maxHealth: 2400,
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
        maxHealth: 3800,
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
        maxHealth: 5400,
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
        maxHealth: 7800,
        damage: 75,
        scale: 4.8,
        color: 0x110e14,
        glowColor: 0xff3838,
        type: 'dragon',
        drops: { dragonCrown: 1, dragonTears: 3, shadow_essence: 10 },
        unlockMessage: '👑 Olet alistanut kaikki Pohjolan 5 Muinaista Petoa! Sait Lohikäärmeen Kyyneleet jumalvarusteisiin!'
      }
    ];

    // Backward-compat: if legacy save had unlockedBossIndex > 0, seed defeatedBossIds
    for (let i = 0; i < this.unlockedBossIndex; i++) {
      if (this.bossDefs[i]) {
        this.defeatedBossIds.add(this.bossDefs[i].id);
      }
    }

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

      // Central altar glowing crystal beacon (Zero shader stalls)
      const beaconGeo = new THREE.OctahedronGeometry(0.45, 0);
      const beaconMat = new THREE.MeshBasicMaterial({ color: def.glowColor });
      const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
      beaconMesh.position.set(0, 1.8, 0);
      arenaGroup.add(beaconMesh);

      this.scene.add(arenaGroup);
    });
  }

  // --- Create 3D Boss Mesh with Unique Archetypes ---
  _createBossMesh(def) {
    const group = new THREE.Group();
    const flashMaterials = [];

    if (def.type === 'beast') {
      // 1. Muinainen Sarvipeto – Ukkosvaltias (Chieftain Peto using Barbarian Asset)
      let barbarianMixer = null;
      if (this.assetLoader) {
        const charData = this.assetLoader.createAnimatedCharacter('Barbarian', 'Idle_A');
        if (charData && charData.model) {
          const model = charData.model;
          barbarianMixer = charData.mixer;
          group.userData.charMixer = barbarianMixer;
          group.userData.charActions = charData.actions;

          model.scale.set(1.0, 1.0, 1.0);
          model.position.set(0, 0, 0);

          let handBone = null;
          let leftHandBone = null;
          let headBone = null;

          model.traverse((child) => {
            if (child.isBone) {
              if (child.name === 'head' || child.name === 'Head') headBone = child;
              if (child.name === 'handslot.r' || child.name.includes('hand_r')) handBone = child;
              if (child.name === 'handslot.l' || child.name.includes('hand_l')) leftHandBone = child;
            }
            if (child.isMesh && child.material) {
              child.material = child.material.clone();
              child.material.roughness = 0.6;
              flashMaterials.push(child.material);
            }
          });

          // Branching Horned Antlers mounted on chieftain's head
          if (headBone) {
            const hornMat = new THREE.MeshStandardMaterial({
              color: def.glowColor,
              emissive: def.glowColor,
              emissiveIntensity: 0.8,
              roughness: 0.3
            });
            group.userData.hornMat = hornMat;
            for (const hx of [-0.25, 0.25]) {
              const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 1.3, 8), hornMat);
              horn.position.set(hx, 0.32, 0.08);
              horn.rotation.z = (hx < 0 ? 0.45 : -0.45);
              horn.rotation.x = -0.22;
              headBone.add(horn);

              const tine = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, 0.6, 6), hornMat);
              tine.position.set(hx * 1.6, 0.55, 0.12);
              tine.rotation.z = (hx < 0 ? 0.9 : -0.9);
              headBone.add(tine);
            }

            // Glowing Electric Rune Eyes
            const eyeMat = new THREE.MeshBasicMaterial({ color: def.glowColor });
            const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), eyeMat);
            eyeL.position.set(-0.065, 0.08, 0.12);
            const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), eyeMat);
            eyeR.position.set(0.065, 0.08, 0.12);
            headBone.add(eyeL, eyeR);
          }

          // Equip giant greatsword in right hand & barbarian round shield in left hand
          const wModel = this.assetLoader.get('sword_2handed') || this.assetLoader.get('Sword_Bronze');
          if (wModel && handBone) {
            wModel.scale.set(1.4, 1.4, 1.4);
            wModel.rotation.set(0, Math.PI / 2, 0);
            handBone.add(wModel);
          }
          const sModel = this.assetLoader.get('shield_round_barbarian') || this.assetLoader.get('shield_badge');
          if (sModel && leftHandBone) {
            sModel.scale.set(1.3, 1.3, 1.3);
            sModel.rotation.set(0, -Math.PI / 2, 0);
            leftHandBone.add(sModel);
          }

          group.add(model);
        }
      }

      // Fallback if glTF failed
      if (!group.children.length) {
        const bodyGeo = new THREE.BoxGeometry(1.8, 1.6, 3.2);
        const bodyMat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.85 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 1.6;
        group.add(body);
        flashMaterials.push(bodyMat);
      }
    } else if (def.type === 'wyrm') {
      // 2. Suon Kauhu – Vesipeto Näkki (Abyssal Swamp Draugr Lord using Skeleton_Warrior Asset)
      let wyrmMixer = null;
      if (this.assetLoader) {
        const charData = this.assetLoader.createAnimatedCharacter('Skeleton_Warrior', 'Idle_A');
        if (charData && charData.model) {
          const model = charData.model;
          wyrmMixer = charData.mixer;
          group.userData.charMixer = wyrmMixer;
          group.userData.charActions = charData.actions;

          model.scale.set(1.0, 1.0, 1.0);
          model.position.set(0, 0, 0);

          let handBone = null;
          let leftHandBone = null;
          let headBone = null;

          model.traverse((child) => {
            if (child.isBone) {
              if (child.name === 'head' || child.name === 'Head') headBone = child;
              if (child.name === 'handslot.r' || child.name.includes('hand_r')) handBone = child;
              if (child.name === 'handslot.l' || child.name.includes('hand_l')) leftHandBone = child;
            }
            if (child.isMesh && child.material) {
              child.material = child.material.clone();
              child.material.color.setHex(0x133824); // Dark swamp moss green
              child.material.roughness = 0.5;
              flashMaterials.push(child.material);
            }
          });

          // Glowing toxic emerald eyes
          if (headBone) {
            const eyeMat = new THREE.MeshBasicMaterial({ color: 0x2ecc71 });
            const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), eyeMat);
            eyeL.position.set(-0.065, 0.08, 0.12);
            const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), eyeMat);
            eyeR.position.set(0.065, 0.08, 0.12);
            headBone.add(eyeL, eyeR);
          }

          // Equip giant swamp greataxe & large heavy shield
          const axeModel = this.assetLoader.get('Skeleton_Axe') || this.assetLoader.get('axe_2handed');
          if (axeModel && handBone) {
            axeModel.scale.set(1.5, 1.5, 1.5);
            axeModel.rotation.set(0, Math.PI / 2, 0);
            handBone.add(axeModel);
          }
          const shieldModel = this.assetLoader.get('Skeleton_Shield_Large_A') || this.assetLoader.get('shield_spikes');
          if (shieldModel && leftHandBone) {
            shieldModel.scale.set(1.4, 1.4, 1.4);
            shieldModel.rotation.set(0, -Math.PI / 2, 0);
            leftHandBone.add(shieldModel);
          }

          // Orbiting toxic poison sludge orbs
          const orbs = [];
          for (let i = 0; i < 4; i++) {
            const orb = new THREE.Mesh(
              new THREE.SphereGeometry(0.2, 8, 8),
              new THREE.MeshBasicMaterial({ color: 0x2ecc71, transparent: true, opacity: 0.85 })
            );
            const ang = (i / 4) * Math.PI * 2;
            orb.position.set(Math.cos(ang) * 1.5, 1.2 + (i % 2) * 0.4, Math.sin(ang) * 1.5);
            group.add(orb);
            orbs.push(orb);
          }
          group.userData.sludgeOrbs = orbs;

          group.add(model);
        }
      }

      if (!group.children.length) {
        const bodyGeo = new THREE.CylinderGeometry(1.2, 1.6, 4.5, 12);
        bodyGeo.rotateX(Math.PI / 2);
        const bodyMat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.5 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 1.3;
        group.add(body);
        flashMaterials.push(bodyMat);
      }
    } else if (def.type === 'golem') {
      // 3. Harjanteen Jätti – Kallionmurskaaja (Titan Granite Colossus)
      const torsoGeo = new THREE.DodecahedronGeometry(2.1, 1);
      const golemMat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.95 });
      const torso = new THREE.Mesh(torsoGeo, golemMat);
      torso.position.y = 2.8;
      torso.castShadow = true;
      group.add(torso);
      flashMaterials.push(golemMat);

      // Articulated boulder shoulders & swinging arm groups
      const armGroups = [];
      for (const side of [-1, 1]) {
        const armGroup = new THREE.Group();
        armGroup.position.set(side * 2.4, 3.4, 0);

        const shoulder = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1, 1), golemMat);
        armGroup.add(shoulder);

        const fist = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.4, 0.9), golemMat);
        fist.position.set(0, -1.8, 0.4);
        fist.castShadow = true;
        armGroup.add(fist);

        group.add(armGroup);
        armGroups.push(armGroup);
      }
      group.userData.arms = armGroups;

      // Glowing Magma Core inside chest
      const coreGeo = new THREE.OctahedronGeometry(0.65, 0);
      const coreMat = new THREE.MeshBasicMaterial({ color: def.glowColor });
      const core = new THREE.Mesh(coreGeo, coreMat);
      core.position.set(0, 2.7, 1.8);
      group.add(core);
    } else if (def.type === 'wraith') {
      // 4. Muinainen Aave – Riimunvartija (Towering Undead Lich King using Skeleton_Mage)
      let mageMixer = null;
      if (this.assetLoader) {
        const charData = this.assetLoader.createAnimatedCharacter('Skeleton_Mage', 'Idle_A');
        if (charData && charData.model) {
          const mageModel = charData.model;
          mageMixer = charData.mixer;
          group.userData.charMixer = mageMixer;
          group.userData.charActions = charData.actions;

          mageModel.scale.set(1.0, 1.0, 1.0);
          mageModel.position.set(0, 0, 0);

          let handBone = null;
          let headBone = null;
          mageModel.traverse((child) => {
            if (child.isBone) {
              if (child.name === 'head' || child.name === 'Head') headBone = child;
              if (child.name === 'handslot.r' || child.name.includes('hand_r')) handBone = child;
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
        }
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
    } else if (def.type === 'dragon') {
      // 5. Sysipimeyden Ruhtinas – Varjodraakki (Cataclysm Shadow Dragon)
      const bodyGeo = new THREE.CylinderGeometry(1.4, 1.8, 5.0, 10);
      bodyGeo.rotateX(Math.PI / 2);
      const dragonMat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.7 });
      const body = new THREE.Mesh(bodyGeo, dragonMat);
      body.position.y = 2.2;
      body.castShadow = true;
      group.add(body);
      flashMaterials.push(dragonMat);

      // Giant Articulated Flapping Wings
      const wingGroups = [];
      for (const side of [-1, 1]) {
        const wingPivot = new THREE.Group();
        wingPivot.position.set(side * 1.2, 2.8, 0);

        const wingGeo = new THREE.BufferGeometry();
        const vertices = new Float32Array([
          0, 0, 0,
          side * 4.6, 2.2, -1.5,
          side * 3.4, -1.2, 0.8
        ]);
        wingGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        wingGeo.computeVertexNormals();
        const wingMat = new THREE.MeshStandardMaterial({
          color: 0x4a0e17,
          side: THREE.DoubleSide,
          roughness: 0.6
        });
        const wingMesh = new THREE.Mesh(wingGeo, wingMat);
        wingPivot.add(wingMesh);
        group.add(wingPivot);
        wingGroups.push(wingPivot);
      }
      group.userData.wings = wingGroups;

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

    // Glowing Eyes / Core for all bosses (Zero WebGL shader recompiles)
    const auraMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 10, 10),
      new THREE.MeshBasicMaterial({ color: def.glowColor, transparent: true, opacity: 0.65 })
    );
    auraMesh.position.set(0, 2.2, 1.0);
    group.add(auraMesh);
    group.userData.auraMesh = auraMesh;

    // Apply majestic boss scale
    group.scale.set(def.scale, def.scale, def.scale);

    return { group, flashMaterials };
  }

  // --- Spawn active bosses: STRICT SEQUENTIAL PROGRESSION (1 boss at a time) ---
  spawnActiveBosses() {
    // Remove existing boss meshes from scene
    this.bosses.forEach(b => {
      if (b.mesh) this.scene.remove(b.mesh);
    });
    this.bosses = [];

    // All bosses completed check
    if (this.unlockedBossIndex >= this.bossDefs.length) {
      return;
    }

    const activeDef = this.bossDefs[this.unlockedBossIndex];
    if (this.defeatedBossIds.has(activeDef.id)) {
      if (this.unlockedBossIndex < this.bossDefs.length - 1) {
        this.unlockedBossIndex++;
        localStorage.setItem('tikapoo_boss_progress', this.unlockedBossIndex.toString());
        this.spawnActiveBosses();
      }
      return;
    }

    const { group, flashMaterials } = this._createBossMesh(activeDef);
    flashMaterials.forEach(m => {
      if (m.color) m.userData.origColor = m.color.getHex();
    });
    const ay = this.world ? this.world.getGroundHeight(activeDef.arenaPos.x, activeDef.arenaPos.z) : 0;
    group.position.set(activeDef.arenaPos.x, ay, activeDef.arenaPos.z);
    this.scene.add(group);

    const boss = {
      def: activeDef,
      index: this.unlockedBossIndex,
      mesh: group,
      flashMaterials,
      health: activeDef.maxHealth,
      maxHealth: activeDef.maxHealth,
      damage: activeDef.damage,
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

      playAnim: (animName, loop = true) => {
        const actions = group.userData.charActions;
        if (!actions || !actions[animName]) return;
        const newAction = actions[animName];
        if (boss.currentAction === newAction && loop) return;
        if (boss.currentAction && boss.currentAction !== newAction) {
          boss.currentAction.fadeOut(0.15);
        }
        newAction.reset();
        newAction.fadeIn(0.15);
        if (!loop) {
          newAction.setLoop(THREE.LoopOnce);
          newAction.clampWhenFinished = true;
        } else {
          newAction.setLoop(THREE.LoopRepeat);
        }
        newAction.play();
        boss.currentAction = newAction;
      },

      isStaggered: false,
      staggerTimer: 0,
      damageMultiplier: 1.0,

      stagger: (duration = 1.4, damageMult = 1.5) => {
        if (!boss.isAlive || boss.invulnerable) return;
        boss.isStaggered = true;
        boss.staggerTimer = duration;
        boss.damageMultiplier = damageMult;
        boss.cooldown = duration + 0.6;
        if (boss.playAnim) boss.playAnim('Idle_A');
        if (this.hud && this.hud.showNotification) {
          this.hud.showNotification(`⚡ PARRY! ${boss.def?.name || 'Päävihollinen'} horjahti! (+50% bonusvahinko)`, 2200);
        }
      },

      takeDamage: (amount) => {
        if (!boss.isAlive) return;
        if (boss.isStaggered) {
          amount = Math.round(amount * (boss.damageMultiplier || 1.5));
        }
        if (boss.invulnerable) {
          if (this.hud) {
            if (this.hud.showBossTelegraph) this.hud.showBossTelegraph('🛡️ Bossi on suojattu riimukivillä! Tuhoa riimukivet ensin!');
            else this.hud.showNotification('🛡️ Bossi on suojattu riimukivillä! Tuhoa riimukivet ensin!');
          }
          return;
        }

        boss.health = Math.max(0, boss.health - amount);
        this.updateBossHud(boss);

        // Red hit flash with persistent original color restore
        flashMaterials.forEach(m => {
          if (m.color) {
            const orig = m.userData.origColor !== undefined ? m.userData.origColor : m.color.getHex();
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
          if (this.hud) {
            if (this.hud.showBossTelegraph) this.hud.showBossTelegraph(`⚠️ ${boss.def.name} siirtyy RAIVOTILAAN!`);
            else this.hud.showNotification(`⚠️ ${boss.def.name} siirtyy RAIVOTILAAN!`);
          }
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
  }

  triggerPhase2(boss) {
    if (this.hud) {
      if (this.hud.showBossTelegraph) this.hud.showBossTelegraph(`⚡ ${boss.def.name} – VAIHE 2 ALKAA!`);
      else this.hud.showNotification(`⚡ ${boss.def.name} – VAIHE 2 ALKAA!`);
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
            if (this.hud) {
              if (this.hud.showBossTelegraph) this.hud.showBossTelegraph('💥 Riimukivi tuhottu!');
              else this.hud.showNotification('💥 Riimukivi tuhottu!');
            }
            if (boss.runeStones.length === 0) {
              boss.invulnerable = false;
              if (this.hud) {
                if (this.hud.showBossTelegraph) this.hud.showBossTelegraph('✨ Riimukilpi murtui! Bossi on haavoittuvainen!');
                else this.hud.showNotification('✨ Riimukilpi murtui! Bossi on jälleen haavoittuvainen!');
              }
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

    // Mark boss as defeated in persistent set
    this.defeatedBossIds.add(boss.def.id);
    localStorage.setItem('tikapoo_defeated_boss_ids', JSON.stringify([...this.defeatedBossIds]));

    // Advance progression index
    this.unlockedBossIndex = Math.max(this.unlockedBossIndex, boss.index + 1);
    localStorage.setItem('tikapoo_boss_progress', this.unlockedBossIndex.toString());

    // Grant legendary drops and display prominent notifications for each reward
    const dropList = [];
    Object.entries(boss.def.drops).forEach(([mat, qty]) => {
      this.inventory.add(mat, qty);
      const itemName = this.inventory.getItemName ? this.inventory.getItemName(mat) : mat;
      dropList.push(`${qty}x ${itemName}`);
      if (this.hud && this.hud.showPickupText) {
        this.hud.showPickupText(`🎁 +${qty} ${itemName}!`);
      }
    });

    // Epic Multi-Stage Victory Announcements
    if (this.hud) {
      const isFi = !this.hud.currentLang || this.hud.currentLang === 'fi';
      const victoryTitle = isFi
        ? `🏆 ${boss.def.name.toUpperCase()} ON KUKISTETTU!`
        : `🏆 ${boss.def.name.toUpperCase()} DEFEATED!`;
      this.hud.showNotification(victoryTitle, 6500);

      setTimeout(() => {
        if (this.hud) {
          const rewardTitle = isFi ? '🎁 SAATU SAALIS' : '🎁 LOOT REWARD';
          this.hud.showNotification(`${rewardTitle}: ${dropList.join(' • ')}`, 7500);
        }
      }, 2500);

      setTimeout(() => {
        if (this.hud) {
          this.hud.showNotification(boss.def.unlockMessage, 8500);
        }
      }, 5500);
    }

    if (this.audioManager) {
      if (this.audioManager.stopBossMusic) {
        this.audioManager.stopBossMusic();
      }
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
    if (this.achievementManager) {
      this.achievementManager.onBossKill(boss.def.id);
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

  // --- Update Boss Health Bar HUD with Dirty-Checking Cache ---
  updateBossHud(boss) {
    if (!this.bossHudEl) return;

    if (!boss || !boss.isAlive) {
      if (this.bossHudEl.style.display !== 'none') {
        this.bossHudEl.style.display = 'none';
      }
      this._lastHudHp = -1;
      return;
    }

    if (this.bossHudEl.style.display !== 'block') {
      this.bossHudEl.style.display = 'block';
    }

    const roundHp = Math.round(boss.health);
    if (this._lastHudHp !== roundHp || this._lastHudPhase !== boss.phase || this._lastHudBossId !== boss.def.id) {
      this._lastHudHp = roundHp;
      this._lastHudPhase = boss.phase;
      this._lastHudBossId = boss.def.id;

      if (this.bossNameEl) this.bossNameEl.textContent = boss.def.name;
      if (this.bossBiomeEl) this.bossBiomeEl.textContent = boss.def.biome;
      if (this.bossPhaseEl) this.bossPhaseEl.textContent = `VAIHE ${boss.phase}`;
      if (this.bossHpValEl) this.bossHpValEl.textContent = `${roundHp} / ${boss.maxHealth}`;

      if (this.bossHpFillEl) {
        const pct = Math.max(0, Math.min(100, (boss.health / boss.maxHealth) * 100));
        this.bossHpFillEl.style.width = `${pct}%`;
      }
    }
  }

  // --- Boss AI & Combat Loop Update ---
  update(delta, playerPos) {
    let nearestBoss = null;
    let minDistance = 9999;

    for (const boss of this.bosses) {
      if (!boss.isAlive) continue;

      if (boss.isStaggered) {
        boss.staggerTimer -= delta;
        if (boss.staggerTimer <= 0) {
          boss.isStaggered = false;
          boss.damageMultiplier = 1.0;
        }
        continue;
      }

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

        // Update character mixer if glTF animated boss
        if (boss.mesh.userData.charMixer) {
          boss.mesh.userData.charMixer.update(delta);
        }

        // Mechanic 1: Muinainen Sarvipeto – Ukkosvaltias (Barbarian Chieftain with Glowing Antlers)
        if (boss.def.type === 'beast') {
          if (!boss.beastState) {
            boss.beastState = 'approach';
            boss.stateTimer = 0;
          }

          const hornMat = boss.mesh.userData.hornMat;

          if (boss.beastState === 'approach') {
            const targetAng = Math.atan2(dx, dz);
            boss.mesh.rotation.y = THREE.MathUtils.lerp(boss.mesh.rotation.y, targetAng, delta * 3.8);

            if (hornMat) hornMat.emissiveIntensity = 0.8;

            if (distToPlayer > 4.5) {
              const moveDir = new THREE.Vector3(dx, 0, dz).normalize();
              boss.mesh.position.addScaledVector(moveDir, delta * 3.8);
              if (boss.playAnim) boss.playAnim('Walking_A');
            } else {
              if (boss.playAnim) boss.playAnim('Idle_A');
              if (boss.cooldown <= 0) {
                boss.cooldown = 3.2;
                if (boss.playAnim) boss.playAnim('Use_Item', false);
                setTimeout(() => {
                  if (boss.isAlive && boss.mesh) {
                    this.createShockwave(boss.mesh.position, 0xf1c40f, 6.0);
                    if (this.audioManager && this.audioManager.playExplosion) {
                      this.audioManager.playExplosion();
                    }
                    if (distToPlayer < 5.2 && this.player) {
                      this.player.takeDamage(boss.damage, boss);
                    }
                  }
                }, 350);
              }
            }

            if (boss.specialTimer <= 0) {
              boss.beastState = 'telegraph';
              boss.stateTimer = 1.0;
              boss.specialTimer = 8.5;
              if (this.hud) {
                if (this.hud.showBossTelegraph) this.hud.showBossTelegraph('⚡ Sarvipeto virittää ukkosrynnäkköä! Väistä!');
                else this.hud.showNotification('⚡ Sarvipeto virittää ukkosrynnäkköä! Valmistaudu väistämään!');
              }
            }
          } else if (boss.beastState === 'telegraph') {
            boss.stateTimer -= delta;
            const targetAng = Math.atan2(dx, dz);
            boss.mesh.rotation.y = THREE.MathUtils.lerp(boss.mesh.rotation.y, targetAng, delta * 5.0);
            if (boss.playAnim) boss.playAnim('Idle_A');

            if (hornMat) {
              hornMat.emissiveIntensity = 2.8 + Math.sin(boss.animTime * 25) * 1.5;
            }

            if (boss.stateTimer <= 0) {
              boss.beastState = 'charge';
              boss.stateTimer = 1.25;
              boss.chargeDir.set(dx, 0, dz).normalize();
              boss.mesh.rotation.y = Math.atan2(boss.chargeDir.x, boss.chargeDir.z);
              if (boss.playAnim) boss.playAnim('Running_A');
            }
          } else if (boss.beastState === 'charge') {
            boss.stateTimer -= delta;
            boss.mesh.position.addScaledVector(boss.chargeDir, delta * 12.5);
            if (boss.playAnim) boss.playAnim('Running_A');

            if (distToPlayer < 3.4) {
              if (this.player) {
                this.player.takeDamage(boss.damage * 1.4, boss);
              }
              this.createShockwave(boss.mesh.position, 0xe74c3c, 4.5);
              boss.beastState = 'recoil';
              boss.stateTimer = 1.1;
              if (boss.playAnim) boss.playAnim('Idle_A');
            } else if (boss.stateTimer <= 0) {
              boss.beastState = 'recoil';
              boss.stateTimer = 0.9;
              if (boss.playAnim) boss.playAnim('Idle_A');
            }
          } else if (boss.beastState === 'recoil') {
            boss.stateTimer -= delta;
            if (hornMat) hornMat.emissiveIntensity = 0.6;
            if (boss.playAnim) boss.playAnim('Idle_A');
            if (boss.stateTimer <= 0) {
              boss.beastState = 'approach';
            }
          }
        }

        // Mechanic 2: Suon Kauhu – Vesipeto Näkki (Swamp Lord using Skeleton_Warrior)
        else if (boss.def.type === 'wyrm') {
          // Orbiting toxic sludge orbs animation
          const orbs = boss.mesh.userData.sludgeOrbs || [];
          orbs.forEach((orb, i) => {
            const ang = (i / orbs.length) * Math.PI * 2 + boss.animTime * 2.2;
            orb.position.x = Math.cos(ang) * 1.6;
            orb.position.z = Math.sin(ang) * 1.6;
            orb.position.y = 1.3 + Math.sin(boss.animTime * 3.5 + i) * 0.35;
          });

          if (boss.specialTimer <= 0) {
            boss.specialTimer = 4.8;
            this.fireProjectile(bPos, playerPos, 0x2ecc71, 26, 0.5);
            if (boss.playAnim) boss.playAnim('Use_Item', false);
            if (this.hud) {
              if (this.hud.showBossTelegraph) this.hud.showBossTelegraph('☣️ Näkki ampuu suomyrkkyä!');
              else this.hud.showNotification('☣️ Näkki ampuu suomyrkkyä!');
            }
          }

          if (distToPlayer > 5.5) {
            const moveDir = new THREE.Vector3(dx, 0, dz).normalize();
            boss.mesh.position.addScaledVector(moveDir, delta * 3.6);
            boss.mesh.lookAt(playerPos.x, boss.mesh.position.y, playerPos.z);
            if (boss.playAnim) boss.playAnim('Walking_A');
          } else {
            if (boss.playAnim && boss.currentAction !== boss.mesh.userData.charActions?.['Use_Item']) {
              boss.playAnim('Idle_A');
            }
            if (boss.cooldown <= 0) {
              boss.cooldown = 2.4;
              if (boss.playAnim) boss.playAnim('Use_Item', false);
              setTimeout(() => {
                if (boss.isAlive && distToPlayer < 5.8 && this.player) {
                  this.player.takeDamage(boss.damage, boss);
                }
              }, 300);
            }
          }
        }

        // Mechanic 3: Harjanteen Jätti – Kallionmurskaaja (Titan Granite Colossus)
        else if (boss.def.type === 'golem') {
          // Dynamic arm swinging while moving
          const arms = boss.mesh.userData.arms || [];
          const speed = (boss.phase === 3) ? 5.2 : 3.2;

          if (distToPlayer > 6.0) {
            const moveDir = new THREE.Vector3(dx, 0, dz).normalize();
            boss.mesh.position.addScaledVector(moveDir, delta * speed);
            boss.mesh.lookAt(playerPos.x, boss.mesh.position.y, playerPos.z);

            const swing = Math.sin(boss.animTime * 4.5) * 0.55;
            if (arms[0]) arms[0].rotation.x = swing;
            if (arms[1]) arms[1].rotation.x = -swing;
          } else {
            if (arms[0]) arms[0].rotation.x = 0;
            if (arms[1]) arms[1].rotation.x = 0;

              if (boss.cooldown <= 0) {
                boss.cooldown = 2.5;
                this.createShockwave(boss.mesh.position, 0xe74c3c, 5.0);
                if (this.player) this.player.takeDamage(boss.damage, boss);
              }
          }

          if (boss.specialTimer <= 0) {
            boss.specialTimer = 5.5;
            this.fireProjectile(bPos, playerPos, 0x888888, 38, 0.85);
            if (this.hud) {
              if (this.hud.showBossTelegraph) this.hud.showBossTelegraph('🪨 Kallionmurskaaja heittää lohkareen!');
              else this.hud.showNotification('🪨 Kallionmurskaaja heittää lohkareen!');
            }
          }
        }

        // Mechanic 4: Muinainen Aave – Riimunvartija (Towering Undead Lich King)
        else if (boss.def.type === 'wraith') {
          if (boss.mesh.userData.runeRing) {
            boss.mesh.userData.runeRing.rotation.z += delta * 2.0;
          }
          if (boss.mesh.userData.innerRuneRing) {
            boss.mesh.userData.innerRuneRing.rotation.x += delta * 1.8;
          }

          if (boss.specialTimer <= 0) {
            boss.specialTimer = 5.0;
            // Teleport across arena
            const randAng = Math.random() * Math.PI * 2;
            boss.mesh.position.x = boss.def.arenaPos.x + Math.cos(randAng) * 16;
            boss.mesh.position.z = boss.def.arenaPos.z + Math.sin(randAng) * 16;
            this.fireProjectile(boss.mesh.position, playerPos, 0x00d2d3, 32, 0.55);
            if (boss.playAnim) boss.playAnim('Use_Item', false);
            if (this.hud) {
              if (this.hud.showBossTelegraph) this.hud.showBossTelegraph('💠 Riimunvartija teleporttaa & ampuu riimusäteen!');
              else this.hud.showNotification('💠 Riimunvartija teleporttaa & ampuu riimusäteen!');
            }
          }

          if (distToPlayer > 6.0) {
            const moveDir = new THREE.Vector3(dx, 0, dz).normalize();
            boss.mesh.position.addScaledVector(moveDir, delta * 3.4);
            boss.mesh.lookAt(playerPos.x, boss.mesh.position.y, playerPos.z);
            if (boss.playAnim) boss.playAnim('Walking_A');
          } else {
            if (boss.playAnim && boss.currentAction !== boss.mesh.userData.charActions?.['Use_Item']) {
              boss.playAnim('Idle_A');
            }
            if (boss.cooldown <= 0) {
              boss.cooldown = 2.2;
              if (boss.playAnim) boss.playAnim('Use_Item', false);
              this.fireProjectile(boss.mesh.position, playerPos, 0x00d2d3, boss.damage * 0.7, 0.45);
            }
          }
        }

        // Mechanic 5: Sysipimeyden Ruhtinas – Varjodraakki (Shadow Dragon)
        else if (boss.def.type === 'dragon') {
          // Flapping wing animation
          const wings = boss.mesh.userData.wings || [];
          const flap = Math.sin(boss.animTime * 5.5) * 0.45;
          if (wings[0]) wings[0].rotation.z = flap;
          if (wings[1]) wings[1].rotation.z = -flap;

          if (boss.specialTimer <= 0) {
            boss.specialTimer = 6.0;
            this.fireProjectile(bPos, playerPos, 0xff3838, 55, 0.75);
            if (this.hud) {
              if (this.hud.showBossTelegraph) this.hud.showBossTelegraph('🔥 Varjodraakki syöksee varjotulta!');
              else this.hud.showNotification('🔥 Varjodraakki syöksee varjotulta!');
            }
          }
          if (distToPlayer > 8.0) {
            const moveDir = new THREE.Vector3(dx, 0, dz).normalize();
            boss.mesh.position.addScaledVector(moveDir, delta * 4.8);
            boss.mesh.lookAt(playerPos.x, boss.mesh.position.y, playerPos.z);
          } else if (boss.cooldown <= 0) {
            boss.cooldown = 1.8;
            if (this.player) this.player.takeDamage(boss.damage, boss);
          }
        }

        // Align Y with terrain
        const gy = this.world ? this.world.getGroundHeight(bPos.x, bPos.z) : 0;
        bPos.y = gy;
      }
    }

    // Manage active boss health bar visibility & battle music
    if (nearestBoss && minDistance < 48) {
      this.activeBoss = nearestBoss;
      this.updateBossHud(nearestBoss);
    } else {
      if (this.bossHudEl && this.bossHudEl.style.display !== 'none') {
        this.bossHudEl.style.display = 'none';
      }
      this.activeBoss = null;
      // Stop boss battle music immediately when boss is dead or player has retreated from arena
      if (this.audioManager && this.audioManager.isBossMusicActive) {
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
    let hasHitPlayer = false;
    const expandAnim = () => {
      progress += 0.055;
      const currentRadius = 0.5 + progress * (maxRadius - 0.5);
      ring.scale.set(currentRadius, currentRadius, currentRadius);
      ringMat.opacity = Math.max(0, 0.95 * (1 - progress));

      // Damage player AT MOST ONCE if in shockwave radius during expansion and grounded
      if (!hasHitPlayer && this.player && progress > 0.3 && progress < 0.8) {
        const pPos = this.player.getPosition ? this.player.getPosition() : this.player.playerPos;
        if (pPos) {
          const d = Math.hypot(pPos.x - pos.x, pPos.z - pos.z);
          if (Math.abs(d - currentRadius) < 1.4 && this.player.isGrounded) {
            hasHitPlayer = true;
            this.player.takeDamage(22, boss);
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

  fireProjectile(fromPos, toPos, colorHex, damage = 25, size = 0.4, sourceAttacker = null) {
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
      life: 3.5,
      attacker: sourceAttacker
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
          this.player.takeDamage(proj.damage, proj.attacker || this.activeBoss);
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

  // Returns all 5 boss info for the World Map & Minimap (with strict progression statuses)
  getBossMarkers() {
    return this.bossDefs.map((def, index) => {
      const isDefeated = this.defeatedBossIds.has(def.id) || (index < this.unlockedBossIndex);
      let status = 'locked';
      if (isDefeated) {
        status = 'defeated';
      } else if (index === this.unlockedBossIndex) {
        status = 'active';
      }

      return {
        id: def.id,
        name: def.name,
        biome: def.biome,
        x: def.arenaPos.x,
        z: def.arenaPos.z,
        status,
        index
      };
    });
  }
}
