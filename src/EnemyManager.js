import * as THREE from 'three';

export function getBiomeKey(x, z) {
  if (z > 140) return 'ashlands';
  if (x < -70 && z > 50) return 'swamp';
  if (x > 70 && z < -60) return 'mountain';
  if (x < -60 && z < -50) return 'blackForest';
  if (x > 90 && Math.abs(z) < 100) return 'runePlains';
  return 'meadows';
}

const BIOME_ENEMIES = {
  meadows: [
    {
      type: 'meadow_boar',
      name: 'Villikarju (Wild Boar)',
      skeletonModel: null,
      maxHealth: 35,
      damage: 7,
      scale: 0.85,
      color: 0x5a3e28,
      eyeColor: 0x884422,
      weapon: null,
      speed: 2.2,
      drops: { meat: 2, leather: 1 }
    },
    {
      type: 'meadow_greyling',
      name: 'Luunoutaja (Skeleton Minion)',
      skeletonModel: 'Skeleton_Minion',
      maxHealth: 45,
      damage: 9,
      scale: 0.95,
      color: 0xcccccc,
      eyeColor: 0xf1c40f,
      weapon: 'Skeleton_Blade',
      speed: 2.2,
      drops: { wood: 2, resin: 2, bone: 2, stone: 1 }
    }
  ],
  blackForest: [
    {
      type: 'forest_greydwarf',
      name: 'Mustametsän Luusoturi (Skeleton Warrior)',
      skeletonModel: 'Skeleton_Warrior',
      maxHealth: 90,
      damage: 16,
      scale: 1.05,
      color: 0x3d434d,
      eyeColor: 0xe67e22,
      weapon: 'Skeleton_Blade',
      shield: 'Skeleton_Shield_Large_A',
      speed: 2.5,
      drops: { wood: 3, resin: 2, copperOre: 1, bone: 3 }
    },
    {
      type: 'forest_shaman',
      name: 'Varjoluuranko Nekromantikko (Skeleton Mage)',
      skeletonModel: 'Skeleton_Mage',
      maxHealth: 80,
      damage: 20,
      scale: 1.0,
      color: 0x223326,
      eyeColor: 0x2ecc71,
      weapon: 'Skeleton_Staff',
      speed: 2.3,
      drops: { bone: 3, resin: 3, bronze: 1 }
    }
  ],
  swamp: [
    {
      type: 'swamp_draugr',
      name: 'Suon Kiroussoturi Draugr (Draugr Skeleton)',
      skeletonModel: 'Skeleton_Warrior',
      maxHealth: 160,
      damage: 28,
      scale: 1.15,
      color: 0x203628,
      eyeColor: 0x00cec9,
      weapon: 'Skeleton_Axe',
      shield: 'Skeleton_Shield_Small_A',
      speed: 2.5,
      drops: { ironOre: 2, bone: 4, leather: 2 }
    },
    {
      type: 'swamp_slime',
      name: 'Myrkkylieju (Poison Slime)',
      skeletonModel: null,
      maxHealth: 110,
      damage: 22,
      scale: 0.9,
      color: 0x10ac84,
      eyeColor: 0x1dd1a1,
      weapon: null,
      speed: 1.8,
      drops: { slime: 2, ironOre: 1 }
    }
  ],
  mountain: [
    {
      type: 'mountain_wolf',
      name: 'Tunturisusi (Frost Wolf)',
      skeletonModel: null,
      maxHealth: 180,
      damage: 34,
      scale: 1.1,
      color: 0xdfe6e9,
      eyeColor: 0x74b9ff,
      weapon: null,
      speed: 4.2,
      drops: { wolfPelt: 2, fang: 3, silverOre: 1 }
    },
    {
      type: 'mountain_golem',
      name: 'Jääharjanteen Luujätti (Frost Skeleton Brute)',
      skeletonModel: 'Skeleton_Warrior',
      maxHealth: 340,
      damage: 48,
      scale: 1.45,
      color: 0x747d8c,
      eyeColor: 0x70a1ff,
      weapon: 'Skeleton_Blade',
      shield: 'Skeleton_Shield_Large_A',
      speed: 2.2,
      drops: { stone: 15, silverOre: 2, bone: 5 }
    }
  ],
  runePlains: [
    {
      type: 'plains_berserker',
      name: 'Riimuluuranko Salamurhaaja (Skeleton Rogue)',
      skeletonModel: 'Skeleton_Rogue',
      maxHealth: 380,
      damage: 54,
      scale: 1.25,
      color: 0x1e272e,
      eyeColor: 0x00d2d3,
      weapon: 'Skeleton_Blade',
      speed: 3.0,
      drops: { blackMetalScrap: 2, bone: 4 }
    },
    {
      type: 'plains_wraith',
      name: 'Riimumestari Luumaagi (Ancient Lich Mage)',
      skeletonModel: 'Skeleton_Mage',
      maxHealth: 300,
      damage: 48,
      scale: 1.2,
      color: 0x3d1c47,
      eyeColor: 0x9b59b6,
      weapon: 'Skeleton_Staff',
      speed: 3.1,
      drops: { blackMetalScrap: 2, shadow_essence: 2, bone: 4 }
    }
  ],
  ashlands: [
    {
      type: 'ash_demon',
      name: 'Sysiluun Sotapäällikkö (Ash Skeleton Warrior)',
      skeletonModel: 'Skeleton_Warrior',
      maxHealth: 540,
      damage: 66,
      scale: 1.35,
      color: 0x1c0b0b,
      eyeColor: 0xff4757,
      weapon: 'Skeleton_Blade',
      shield: 'Skeleton_Shield_Large_A',
      speed: 2.9,
      drops: { flametalOre: 2, coal: 4, bone: 5 }
    },
    {
      type: 'ash_dragonkin',
      name: 'Sysiluun Varjo (Ash Skeleton Rogue)',
      skeletonModel: 'Skeleton_Rogue',
      maxHealth: 620,
      damage: 72,
      scale: 1.4,
      color: 0x2f1414,
      eyeColor: 0xff6b81,
      weapon: 'Skeleton_Axe',
      speed: 3.3,
      drops: { flametalOre: 3, dragonSteel: 1, shadow_essence: 3, bone: 5 }
    }
  ]
};

export default class EnemyManager {
  constructor(scene, world, inventory, hud, audioManager, questManager, assetLoader = null, lootManager = null) {
    this.scene = scene;
    this.world = world;
    this.inventory = inventory;
    this.hud = hud;
    this.audioManager = audioManager;
    this.questManager = questManager;
    this.assetLoader = assetLoader || null;
    this.lootManager = lootManager || null;

    this.enemies = [];
    this.maxEnemies = 42;
    this.spawnRadiusMin = 22;
    this.spawnRadiusMax = 95;

    this.particles = [];

    // Pre-populate each biome with patrolling enemies on startup
    setTimeout(() => {
      this.spawnInitialBiomeEnemies();
    }, 100);
  }

  spawnInitialBiomeEnemies() {
    // 1. Black Forest (6 enemies)
    for (let i = 0; i < 6; i++) {
      this.spawnAt(-85 - Math.random() * 45, -85 - Math.random() * 45, 'blackForest');
    }
    // 2. Swamp (6 enemies)
    for (let i = 0; i < 6; i++) {
      this.spawnAt(-100 - Math.random() * 45, 95 + Math.random() * 45, 'swamp');
    }
    // 3. Mountain (6 enemies)
    for (let i = 0; i < 6; i++) {
      this.spawnAt(100 + Math.random() * 45, -100 - Math.random() * 45, 'mountain');
    }
    // 4. Rune Plains (6 enemies)
    for (let i = 0; i < 6; i++) {
      this.spawnAt(125 + Math.random() * 45, (Math.random() - 0.5) * 60, 'runePlains');
    }
    // 5. Ashlands (6 enemies)
    for (let i = 0; i < 6; i++) {
      this.spawnAt((Math.random() - 0.5) * 70, 185 + Math.random() * 55, 'ashlands');
    }
    // 6. Meadows (8 roaming creatures across valley and hills)
    const meadowSpawns = [
      { x: -32, z: 22 }, { x: 28, z: -25 }, { x: -45, z: -32 }, { x: 38, z: 35 },
      { x: -28, z: 52 }, { x: 50, z: -42 }, { x: -55, z: 38 }, { x: 45, z: -15 }
    ];
    meadowSpawns.forEach(sp => this.spawnAt(sp.x, sp.z, 'meadows'));
  }

  spawnAt(x, z, customBiome = null) {
    const biome = customBiome || getBiomeKey(x, z);
    const enemyList = BIOME_ENEMIES[biome] || BIOME_ENEMIES.meadows;
    const blueprint = enemyList[Math.floor(Math.random() * enemyList.length)];

    const { group, mixer, actions, bodyMat, flashMaterials, originalColors, hpGroup, hpFill } = this.createEnemyMesh(blueprint);

    const y = this.world ? this.world.getGroundHeight(x, z) : 0;
    if (y < -0.4) return null;

    group.position.set(x, y, z);
    this.scene.add(group);

    const enemy = {
      mesh: group,
      type: blueprint.type,
      name: blueprint.name,
      biome,
      speed: blueprint.speed || 2.2,
      drops: blueprint.drops,
      weapon: blueprint.weapon || null,
      mixer,
      actions,
      currentAction: actions['Zombie_Idle_Loop'] || null,
      bodyMat,
      flashMaterials,
      originalColors,
      hpGroup,
      hpFill,
      health: blueprint.maxHealth,
      maxHealth: blueprint.maxHealth,
      damage: blueprint.damage,
      attackCooldown: 1.6,
      cooldownTimer: 0,
      state: 'idle',
      wanderTarget: new THREE.Vector3(x + (Math.random() * 24 - 12), y, z + (Math.random() * 24 - 12)),
      wanderTimer: 0,
      animTimer: Math.random() * 10,
      isAlive: true,
      hasBeenHit: false,
      isBossMinion: false
    };

    if (actions['Zombie_Idle_Loop']) {
      actions['Zombie_Idle_Loop'].play();
    }

    enemy.playAnim = (animName, loop = true) => {
      if (!enemy.actions || !enemy.actions[animName]) return;
      const newAction = enemy.actions[animName];
      if (enemy.currentAction === newAction && loop) return;

      if (enemy.currentAction && enemy.currentAction !== newAction) {
        enemy.currentAction.fadeOut(0.12);
      }
      newAction.reset();
      newAction.fadeIn(0.12);
      if (!loop) {
        newAction.setLoop(THREE.LoopOnce);
        newAction.clampWhenFinished = true;
      } else {
        newAction.setLoop(THREE.LoopRepeat);
      }
      newAction.play();
      enemy.currentAction = newAction;
    };

    enemy.takeDamage = (amount) => {
      if (!enemy.isAlive) return;
      enemy.health -= amount;
      enemy.hasBeenHit = true;
      enemy.state = 'chase';
      if (enemy.hpFill) {
        const ratio = Math.max(0, Math.min(1.0, enemy.health / enemy.maxHealth));
        enemy.hpFill.scale.x = ratio;
        if (enemy.hpFill.material && enemy.hpFill.material.color) {
          if (ratio > 0.5) enemy.hpFill.material.color.setHex(0x2ecc71);
          else if (ratio > 0.25) enemy.hpFill.material.color.setHex(0xf39c12);
          else enemy.hpFill.material.color.setHex(0xff3838);
        }
      }

      enemy.playAnim('Hit_Knockback', false);
      setTimeout(() => {
        if (enemy.isAlive) {
          enemy.playAnim(enemy.state === 'chase' ? 'Zombie_Walk_Fwd_Loop' : 'Zombie_Idle_Loop');
        }
      }, 450);

      if (enemy.flashMaterials && enemy.flashMaterials.length > 0) {
        enemy.flashMaterials.forEach(m => {
          if (m.color) m.color.setHex(0xff2222);
        });
        setTimeout(() => {
          if (enemy.flashMaterials) {
            enemy.flashMaterials.forEach((m, idx) => {
              if (m.color && enemy.originalColors[idx]) {
                m.color.copy(enemy.originalColors[idx]);
              }
            });
          }
        }, 120);
      }

      if (enemy.health <= 0 && enemy.isAlive) {
        this.killEnemy(enemy);
      }
    };

    group.userData.enemy = enemy;
    group.traverse((child) => {
      child.userData.enemy = enemy;
    });

    this.enemies.push(enemy);
    return enemy;
  }

  createEnemyMesh(blueprint) {
    const group = new THREE.Group();
    let bodyMat = null;
    let flashMaterials = [];
    let originalColors = [];
    let mixer = null;
    let actions = {};

    const chosenModel = blueprint.skeletonModel !== undefined
      ? blueprint.skeletonModel
      : (blueprint.type === 'meadow_boar' || blueprint.type === 'swamp_slime' || blueprint.type === 'mountain_wolf' ? null : 'Skeleton_Warrior');

    if (this.assetLoader && chosenModel) {
      const charData = this.assetLoader.createAnimatedCharacter(chosenModel, 'Idle_A', {
        eyeColor: blueprint.eyeColor || 0xff002b,
        skinColor: blueprint.color || 0x33263a
      });

      if (charData && charData.model) {
        const model = charData.model;
        mixer = charData.mixer;
        actions = charData.actions;

        model.scale.set(blueprint.scale, blueprint.scale, blueprint.scale);

        // Find bones for equipment and glowing eye sockets
        let handBone = null;
        let leftHandBone = null;
        let headBone = null;

        model.traverse((child) => {
          if (child.isBone) {
            if (child.name === 'head' || child.name === 'Head') headBone = child;
            if (child.name === 'handslot.r') handBone = child;
            else if (!handBone && (child.name === 'hand.r' || child.name.includes('hand_r'))) handBone = child;

            if (child.name === 'handslot.l') leftHandBone = child;
            else if (!leftHandBone && (child.name === 'hand.l' || child.name.includes('hand_l') || child.name.includes('lowerarm_l'))) leftHandBone = child;
          }
          if (child.isMesh && child.material) {
            child.material = child.material.clone();
            if (blueprint.color && child.material.color) {
              const nodeName = (child.name || '').toLowerCase();
              if (nodeName.includes('cloak') || nodeName.includes('body') || nodeName.includes('helmet')) {
                child.material.color.lerp(new THREE.Color(blueprint.color), 0.45);
              }
            }
            child.material.roughness = 0.8;
            flashMaterials.push(child.material);
            originalColors.push(child.material.color.clone());
          }
        });

        // Glowing skeletal eye embers attached directly to head bone
        if (headBone && blueprint.eyeColor) {
          const eyeMat = new THREE.MeshBasicMaterial({ color: blueprint.eyeColor });
          const eyeGeo = new THREE.SphereGeometry(0.04, 6, 6);
          const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
          eyeL.position.set(-0.065, 0.08, 0.12);
          const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
          eyeR.position.set(0.065, 0.08, 0.12);
          headBone.add(eyeL, eyeR);
        }

        // Equip biome weapon to right hand
        if (blueprint.weapon && handBone) {
          const wModel = this.assetLoader.get(blueprint.weapon);
          if (wModel) {
            wModel.scale.set(0.85, 0.85, 0.85);
            wModel.rotation.set(0, Math.PI / 2, 0);
            handBone.add(wModel);
          }
        }

        // Equip biome shield to left hand
        if (blueprint.shield && leftHandBone) {
          const sModel = this.assetLoader.get(blueprint.shield);
          if (sModel) {
            sModel.scale.set(0.85, 0.85, 0.85);
            sModel.rotation.set(0, -Math.PI / 2, 0);
            leftHandBone.add(sModel);
          }
        }

        group.add(model);
      }
    }

    if (!mixer) {
      bodyMat = new THREE.MeshLambertMaterial({ color: blueprint.color });
      const bodyGeo = new THREE.BoxGeometry(0.8 * blueprint.scale, 0.8 * blueprint.scale, 1.4 * blueprint.scale);
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.6 * blueprint.scale;
      body.castShadow = true;
      group.add(body);

      const headMat = new THREE.MeshLambertMaterial({ color: blueprint.color });
      const headGeo = new THREE.BoxGeometry(0.6 * blueprint.scale, 0.6 * blueprint.scale, 0.7 * blueprint.scale);
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.set(0, 0.9 * blueprint.scale, 0.85 * blueprint.scale);
      head.castShadow = true;
      group.add(head);

      const eyeMat = new THREE.MeshBasicMaterial({ color: blueprint.eyeColor });
      const eyeGeo = new THREE.SphereGeometry(0.08 * blueprint.scale, 6, 6);
      const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
      leftEye.position.set(-0.18 * blueprint.scale, 0.95 * blueprint.scale, 1.22 * blueprint.scale);
      const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
      rightEye.position.set(0.18 * blueprint.scale, 0.95 * blueprint.scale, 1.22 * blueprint.scale);
      group.add(leftEye, rightEye);
    }

    // Overhead Health Bar Billboard with robust billboarding & z-fighting fix
    const hpGroup = new THREE.Group();
    hpGroup.position.set(0, 2.2 * blueprint.scale, 0);

    const bgGeo = new THREE.PlaneGeometry(1.2 * blueprint.scale, 0.14);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x111822, side: THREE.DoubleSide });
    const hpBg = new THREE.Mesh(bgGeo, bgMat);
    hpGroup.add(hpBg);

    const fillWidth = 1.16 * blueprint.scale;
    const fillGeo = new THREE.PlaneGeometry(fillWidth, 0.1);
    fillGeo.translate(fillWidth / 2, 0, 0); // Anchor to left edge so it shrinks from right to left
    const fillMat = new THREE.MeshBasicMaterial({
      color: 0x2ecc71,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2
    });
    const hpFill = new THREE.Mesh(fillGeo, fillMat);
    hpFill.position.set(-fillWidth / 2, 0, 0.02);
    hpFill.renderOrder = 3;
    hpGroup.add(hpFill);

    group.add(hpGroup);

    return {
      group,
      mixer,
      actions,
      bodyMat,
      flashMaterials,
      originalColors,
      hpGroup,
      hpFill
    };
  }

  spawnEnemy(playerPos, dayNight) {
    const isNight = dayNight ? !dayNight.isDay : false;

    const angle = Math.random() * Math.PI * 2;
    const dist = this.spawnRadiusMin + Math.random() * (this.spawnRadiusMax - this.spawnRadiusMin);
    const x = playerPos.x + Math.sin(angle) * dist;
    const z = playerPos.z + Math.cos(angle) * dist;

    // Safety checks: central village plaza is peaceful
    const distToVillage = Math.sqrt(x * x + z * z);
    if (distToVillage < 26) return;

    // Determine target biome
    const biome = getBiomeKey(x, z);

    // Starting meadows: Max 8 roaming creatures across valley
    if (biome === 'meadows') {
      const meadowCount = this.enemies.filter(e => e.biome === 'meadows').length;
      if (meadowCount >= 8) return;
    }

    const enemyList = BIOME_ENEMIES[biome] || BIOME_ENEMIES.meadows;
    const blueprint = enemyList[Math.floor(Math.random() * enemyList.length)];

    const { group, mixer, actions, bodyMat, flashMaterials, originalColors, hpGroup, hpFill } = this.createEnemyMesh(blueprint);

    const y = this.world ? this.world.getGroundHeight(x, z) : 0;
    if (y < -0.4) return;

    group.position.set(x, y, z);
    this.scene.add(group);

    const enemy = {
      mesh: group,
      type: blueprint.type,
      name: blueprint.name,
      biome,
      speed: blueprint.speed || 2.2,
      drops: blueprint.drops,
      weapon: blueprint.weapon || null,
      mixer,
      actions,
      currentAction: actions['Zombie_Idle_Loop'] || null,
      bodyMat,
      flashMaterials,
      originalColors,
      hpGroup,
      hpFill,
      health: blueprint.maxHealth,
      maxHealth: blueprint.maxHealth,
      damage: blueprint.damage,
      attackCooldown: 1.6,
      cooldownTimer: 0,
      state: 'idle',
      wanderTarget: new THREE.Vector3(x + (Math.random() * 24 - 12), y, z + (Math.random() * 24 - 12)),
      wanderTimer: 0,
      animTimer: Math.random() * 10,
      isAlive: true,

      playAnim: (animName, loop = true) => {
        if (!enemy.actions || !enemy.actions[animName]) return;
        const newAction = enemy.actions[animName];
        if (enemy.currentAction === newAction && loop) return;

        if (enemy.currentAction && enemy.currentAction !== newAction) {
          enemy.currentAction.fadeOut(0.12);
        }
        newAction.reset();
        newAction.fadeIn(0.12);
        if (!loop) {
          newAction.setLoop(THREE.LoopOnce);
          newAction.clampWhenFinished = true;
        } else {
          newAction.setLoop(THREE.LoopRepeat);
        }
        newAction.play();
        enemy.currentAction = newAction;
      },

      takeDamage: (amount) => {
        if (!enemy.isAlive) return;
        enemy.health -= amount;
        enemy.hasBeenHit = true;
        enemy.state = 'chase';
        if (enemy.hpFill) {
          const ratio = Math.max(0, Math.min(1.0, enemy.health / enemy.maxHealth));
          enemy.hpFill.scale.x = ratio;
          if (enemy.hpFill.material && enemy.hpFill.material.color) {
            if (ratio > 0.5) enemy.hpFill.material.color.setHex(0x2ecc71);
            else if (ratio > 0.25) enemy.hpFill.material.color.setHex(0xf39c12);
            else enemy.hpFill.material.color.setHex(0xff3838);
          }
        }

        enemy.playAnim('Hit_Knockback', false);
        setTimeout(() => {
          if (enemy.isAlive) {
            enemy.playAnim(enemy.state === 'chase' ? 'Zombie_Walk_Fwd_Loop' : 'Zombie_Idle_Loop');
          }
        }, 450);

        if (enemy.flashMaterials && enemy.flashMaterials.length > 0) {
          enemy.flashMaterials.forEach(m => {
            if (m.color) m.color.setHex(0xff2222);
          });
          setTimeout(() => {
            if (enemy.flashMaterials) {
              enemy.flashMaterials.forEach((m, idx) => {
                if (m.color && enemy.originalColors[idx]) {
                  m.color.copy(enemy.originalColors[idx]);
                }
              });
            }
          }, 120);
        }

        if (enemy.health <= 0 && enemy.isAlive) {
          this.killEnemy(enemy, (typeof isNight !== 'undefined' ? isNight : false));
        }
      }
    };

    group.userData.enemy = enemy;
    group.traverse((child) => {
      child.userData.enemy = enemy;
    });

    this.enemies.push(enemy);
  }

  update(delta, playerPos, dayNight, player, camera) {
    const isNight = dayNight ? !dayNight.isDay : false;
    const targetCount = isNight ? this.maxEnemies : Math.floor(this.maxEnemies * 0.85);

    this.enemies = this.enemies.filter(e => e.isAlive);

    // Spawn replacements actively across world
    if (this.enemies.length < targetCount && Math.random() < 0.16) {
      this.spawnEnemy(playerPos, dayNight);
    }

    const currentSpeed = isNight ? 2.8 : 2.2;
    const aggroRadius = isNight ? 15 : 10;
    const attackRadius = 2.4;

    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue;

      enemy.animTimer += delta;
      if (enemy.cooldownTimer > 0) {
        enemy.cooldownTimer -= delta;
      }

      if (enemy.mixer) {
        enemy.mixer.update(delta);
      }

      if (camera && enemy.hpGroup && enemy.mesh) {
        // Correctly orient billboard to face camera regardless of enemy body rotation
        enemy.hpGroup.quaternion.copy(enemy.mesh.quaternion).invert().multiply(camera.quaternion);
      }

      const distToPlayer = enemy.mesh.position.distanceTo(playerPos);
      const isHostileBiome = enemy.biome !== 'meadows';
      // Biome enemies (Greydwarf, Draugr, Wolf, Berserker, Drake) are territorial and actively aggro!
      const shouldAggro = (distToPlayer <= aggroRadius && (isHostileBiome || isNight)) ||
                          enemy.hasBeenHit ||
                          (enemy.biome === 'meadows' && distToPlayer <= 5.5);

      // State transitions
      if (shouldAggro) {
        if (enemy.state !== 'chase') {
          enemy.state = 'chase';
          enemy.playAnim('Zombie_Walk_Fwd_Loop');
        }
      } else if (distToPlayer > aggroRadius * 1.5) {
        if (enemy.state !== 'idle') {
          enemy.state = 'idle';
          enemy.playAnim('Zombie_Idle_Loop');
        }
      }

      if (enemy.state === 'chase') {
        const dir = new THREE.Vector3().subVectors(playerPos, enemy.mesh.position);
        dir.y = 0;

        if (dir.lengthSq() > 0.001) {
          dir.normalize();
          enemy.mesh.lookAt(playerPos.x, enemy.mesh.position.y, playerPos.z);

          if (distToPlayer > attackRadius * 0.8) {
            enemy.mesh.position.addScaledVector(dir, currentSpeed * delta);
          }
        }

        const baseGround = this.world ? this.world.getGroundHeight(enemy.mesh.position.x, enemy.mesh.position.z) : 0;
        enemy.mesh.position.y = baseGround;

        // Attack when in range
        if (distToPlayer <= attackRadius && enemy.cooldownTimer <= 0) {
          enemy.cooldownTimer = enemy.attackCooldown;
          const baseDmg = enemy.damage || 15;
          const nightBonus = isNight ? 4 : 0;
          const dmg = baseDmg + nightBonus;

          // Check if player has shield equipped to block damage
          let finalDmg = dmg;
          if (this.inventory && this.inventory.equippedTool === 'shield') {
            finalDmg = Math.round(dmg * 0.6); // 40% reduction
            if (this.hud) this.hud.showNotification('🛡️ Kilpi vaimenti iskua!');
          }

          player.takeDamage(finalDmg, enemy, true);

          // Attack animation & visceral physical strike lunge
          const hasWeapon = enemy.weapon !== null && enemy.weapon !== undefined;
          const anim = enemy.isRigMedium ? 'Use_Item' : (hasWeapon ? 'Sword_Regular_A' : (enemy.type.includes('boar') || enemy.type.includes('wolf') ? 'Melee_Hook' : 'Zombie_Scratch'));
          enemy.playAnim(anim, false);

          // Physical forward strike lunge tween
          if (enemy.mesh) {
            const lungeDir = new THREE.Vector3().subVectors(player.getPosition(), enemy.mesh.position).setY(0).normalize();
            enemy.mesh.position.addScaledVector(lungeDir, 0.45);
            setTimeout(() => {
              if (enemy.isAlive && enemy.mesh) {
                enemy.mesh.position.addScaledVector(lungeDir, -0.45);
              }
            }, 200);
          }

          if (this.audioManager && this.audioManager.playAttack) {
            this.audioManager.playAttack(hasWeapon ? 'sword' : 'fist');
          }

          setTimeout(() => {
            if (enemy.isAlive && enemy.state === 'chase') {
              const walkAnim = enemy.isRigMedium ? 'Walking_A' : 'Zombie_Walk_Fwd_Loop';
              enemy.playAnim(walkAnim);
            }
          }, 550);
        }
      } else {
        // Idle wander
        enemy.wanderTimer -= delta;
        if (enemy.wanderTimer <= 0) {
          enemy.wanderTimer = 3 + Math.random() * 4;
          const rx = enemy.mesh.position.x + (Math.random() * 20 - 10);
          const rz = enemy.mesh.position.z + (Math.random() * 20 - 10);
          enemy.wanderTarget.set(rx, 0, rz);
        }

        const wanderDir = new THREE.Vector3().subVectors(enemy.wanderTarget, enemy.mesh.position);
        wanderDir.y = 0;
        if (wanderDir.length() > 0.5) {
          wanderDir.normalize();
          enemy.mesh.lookAt(enemy.wanderTarget.x, enemy.mesh.position.y, enemy.wanderTarget.z);
          enemy.mesh.position.addScaledVector(wanderDir, 1.3 * delta);
        }

        const baseGround = this.world ? this.world.getGroundHeight(enemy.mesh.position.x, enemy.mesh.position.z) : 0;
        enemy.mesh.position.y = baseGround;
      }
    }

    this.updateParticles(delta);
  }

  killEnemy(enemy, isNight = false) {
    if (!enemy.isAlive) return;
    enemy.isAlive = false;

    if (enemy.playAnim) {
      enemy.playAnim('Death_A', false);
    }

    setTimeout(() => {
      this.scene.remove(enemy.mesh);
    }, 650);

    this.spawnDeathParticles(enemy.mesh.position);

    if (this.lootManager) {
      this.lootManager.spawnLoot(enemy.mesh.position, enemy.type, isNight, enemy.drops);
    } else {
      const meatCount = Math.floor(Math.random() * 2) + 1;
      if (this.inventory) {
        this.inventory.add('meat', meatCount);
      }
    }

    if (this.hud) {
      const typeLabel = enemy.name || 'Vihollinen';
      this.hud.showNotification(`⚔️ ${typeLabel} kukistettu! Esineet pudotettu maahan.`);
    }

    if (this.audioManager) {
      this.audioManager.playHit();
    }
    if (this.questManager) {
      this.questManager.onKill();
    }
    if (this.achievementManager) {
      this.achievementManager.onKill();
    }
  }

  spawnDeathParticles(pos) {
    const pGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    const pMat = new THREE.MeshBasicMaterial({ color: 0x9b59b6 });

    for (let i = 0; i < 22; i++) {
      const mesh = new THREE.Mesh(pGeo, pMat);
      mesh.position.copy(pos);
      mesh.position.y += 0.7;

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 5.5,
        Math.random() * 4.5 + 2.0,
        (Math.random() - 0.5) * 5.5
      );

      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vel,
        life: 0.95
      });
    }
  }

  updateParticles(delta) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= delta;
      p.vel.y -= 9.8 * delta;
      p.mesh.position.addScaledVector(p.vel, delta);
      p.mesh.scale.multiplyScalar(0.94);

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
      }
    }
  }

  getEnemyMeshes() {
    return this.enemies.filter(e => e.isAlive).map(e => e.mesh);
  }
}
