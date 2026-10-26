import * as THREE from 'three';

export const SHIELD_DEFS = {
  shield: {
    id: 'shield',
    nameFi: 'Puukilpi',
    nameEn: 'Wooden Shield',
    maxBlock: 75,
    damageReduction: 0.65,
    parryWindow: 0.28,
    staggerDuration: 1.8,
    parryMult: 2.0,
    color: 0x8a5526,
    icon: '🛡️'
  },
  stoneShield: {
    id: 'stoneShield',
    nameFi: 'Kivinen Tornikilpi',
    nameEn: 'Stone Tower Shield',
    maxBlock: 110,
    damageReduction: 0.75,
    parryWindow: 0.22,
    staggerDuration: 2.0,
    parryMult: 2.0,
    color: 0x7f8c8d,
    icon: '🛡️'
  },
  bronzeShield: {
    id: 'bronzeShield',
    nameFi: 'Pronssikilpi',
    nameEn: 'Bronze Buckler',
    maxBlock: 145,
    damageReduction: 0.82,
    parryWindow: 0.35,
    staggerDuration: 2.4,
    parryMult: 2.2,
    color: 0xcd7f32,
    icon: '🛡️'
  },
  ironShield: {
    id: 'ironShield',
    nameFi: 'Rautakilpi',
    nameEn: 'Iron Banded Shield',
    maxBlock: 190,
    damageReduction: 0.88,
    parryWindow: 0.30,
    staggerDuration: 2.6,
    parryMult: 2.2,
    color: 0x555b63,
    icon: '🛡️'
  },
  silverShield: {
    id: 'silverShield',
    nameFi: 'Hopeakilpi',
    nameEn: 'Silver Round Shield',
    maxBlock: 240,
    damageReduction: 0.93,
    parryWindow: 0.32,
    staggerDuration: 2.8,
    parryMult: 2.4,
    color: 0xdfe6e9,
    icon: '🛡️'
  },
  blackmetalShield: {
    id: 'blackmetalShield',
    nameFi: 'Mustametallikilpi',
    nameEn: 'Black Metal Shield',
    maxBlock: 310,
    damageReduction: 0.96,
    parryWindow: 0.32,
    staggerDuration: 3.2,
    parryMult: 2.5,
    color: 0x222f3e,
    icon: '🛡️'
  }
};

/**
 * Player – Handles movement physics, vitals (HP, Stamina, Hunger),
 * and dual camera perspectives (Valheim 3rd-person over-the-shoulder & 1st-person FPS toggle with [V]).
 */
export default class Player {
  constructor(scene, camera, controls, inventory, hud, audioManager, assetLoader = null, world = null) {
    this.scene = scene;
    this.camera = camera;
    this.controls = controls;
    this.inventory = inventory;
    this.hud = hud;
    this.audioManager = audioManager;
    this.assetLoader = assetLoader;
    this.world = world;

    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();

    const startY = (world && world.getGroundHeight) ? world.getGroundHeight(0, 0) : 3.0;
    this.playerPos = new THREE.Vector3(0, startY, 0);

    this.health = 100;
    this.maxHealth = 100;

    this.stamina = 180;
    this.maxStamina = 180;

    this.hunger = 100;
    this.maxHunger = 100;

    this.thirst = 100;
    this.maxThirst = 100;

    this.energy = 100;
    this.maxEnergy = 100;

    this.mana = 100;
    this.maxMana = 100;

    // Mobile analog joystick 360-degree input vector
    this.analogMove = new THREE.Vector2(0, 0);

    this.level = 1;
    this.xp = 0;
    this.xpNext = 100;
    this.skillPoints = 1;
    this.restedTimer = 0; // 5-minute Rested buff from campfires / beds

    this.isDead = false;
    this.ragdollManager = null;
    this.lastDamageDir = null;

    this.isHarvesting = false; // Set to true while holding LMB to chop/mine
    this.skillTree = null; // Injected from main.js
    this.footstepTimer = 0; // Cadence timer for authentic footsteps

    this.isGrounded = true;
    this.moveSpeed = 5.2;
    this.sprintSpeed = 9.2;
    this.jumpForce = 8.5;
    this.heightAboveGround = 1.7;

    this.isThirdPerson = true; // Valheim style 3rd person by default!
    this.cameraDistance = 3.2;
    this.targetCameraDistance = 3.2;

    // Reusable camera vectors to prevent GC allocations
    this._camLookDir = new THREE.Vector3();
    this._camRight = new THREE.Vector3();
    this._camDesiredPos = new THREE.Vector3();
    this._camFocusTarget = new THREE.Vector3();

    this.keys = {
      forward: false,
      back: false,
      left: false,
      right: false,
      sprint: false,
      jump: false
    };

    // Third person player model
    this.playerModel = null;
    this.playerMixer = null;
    this.playerActions = {};
    this.currentAnim = null;
    this.weaponInHand = null;
    this.shieldOnArm = null;

    // Shield Block & Timed Parry Mechanics
    this.isBlocking = false;
    this.blockStartTime = 0;
    this.blockStamina = 100;
    this.maxBlockStamina = 100;
    this.isGuardBroken = false;
    this.guardBreakTimer = 0;
    this.activeShield = null;

    // Melee attack animation and combo state
    this.isAttacking = false;
    this.attackTimer = 0;
    this.comboStep = 0;
    this.lastAttackTime = 0;

    // Dynamic player torch PointLight (illuminates night and dark dungeons)
    this.torchLight = new THREE.PointLight(0xff8822, 0, 26, 2.0);
    this.torchLight.castShadow = false;
    this.scene.add(this.torchLight);

    // Boss Trophy Altar Buffs
    this.activeBossBuff = null; // 'stag', 'wyrm', 'golem', 'wraith', 'dragon'
    this.woodcuttingBuffTimer = 0;
    this.buffCooldownTimer = 0;
    this.buffDurationTimer = 0;

    this._initPlayerModel();
    this.setupInputs();

    // Initial HUD update
    if (this.hud) {
      this.hud.updateHealth(this.health, this.maxHealth);
      this.hud.updateStamina(this.stamina, this.maxStamina);
      this.hud.updateHunger(this.hunger, this.maxHunger);
    }
  }

  _initPlayerModel() {
    if (!this.assetLoader) return;

    // Remove existing player model if re-initializing (e.g. from character creator)
    if (this.playerModel) {
      this.scene.remove(this.playerModel);
      this.playerModel = null;
      this.playerMixer = null;
      this.playerActions = {};
      this.currentAnim = null;
    }

    // Load saved or default character configuration
    const savedChar = localStorage.getItem('tikapoo_character');
    let config = {
      name: 'Eerik',
      gender: 'male',
      headStyle: 'hair',
      hairStyle: 'short',
      hairColor: 0x3d2817,
      skinColor: 0xf5d0b5,
      clothingColor: 0x2e5339,
      model: 'Rogue'
    };
    if (savedChar) {
      try {
        config = { ...config, ...JSON.parse(savedChar) };
      } catch (e) {}
    }
    // Always enforce basic starting clothes with open head and customizable hair (no forced hoods or starting outfits)
    config.headStyle = 'hair';
    config.model = 'Rogue';
    this.charConfig = config;

    const modelName = 'Rogue';

    // Create animated Valheim Viking character with natural standing idle and customizations
    const charData = this.assetLoader.createAnimatedCharacter(modelName, 'Idle_A', config);
    if (!charData || !charData.model) return;

    this.playerModel = charData.model;
    this.playerMixer = charData.mixer;
    this.playerActions = charData.actions;

    this.playerModel.traverse((c) => {
      if (c.isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });

    // Locate hand bones/slots for weapons & shield attachment (supports KayKit Rig_Medium and standard armatures)
    let rightHandBone = null;
    let leftArmBone = null;
    this.playerModel.traverse((c) => {
      const n = (c.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (n === 'handslotr') rightHandBone = c;
      else if (!rightHandBone && (n === 'handr' || n.includes('righthand') || n.includes('handright'))) rightHandBone = c;

      if (n === 'handslotl') leftArmBone = c;
      else if (!leftArmBone && (n === 'handl' || n.includes('lefthand') || n.includes('handleft') || n.includes('lowerarml'))) leftArmBone = c;
    });

    if (!rightHandBone) {
      this.playerModel.traverse((c) => {
        const n = (c.name || '').toLowerCase();
        if (!rightHandBone && n.includes('hand') && (n.includes('r') || n.includes('right'))) rightHandBone = c;
      });
    }

    // Round Viking shield (only attached if specifically equipped!)
    const shieldGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.04, 16);
    shieldGeo.rotateX(Math.PI / 2);
    const shieldMat = new THREE.MeshStandardMaterial({
      color: 0x8a5526,
      roughness: 0.75,
      metalness: 0.1
    });
    this.shieldOnArm = new THREE.Mesh(shieldGeo, shieldMat);
    this.shieldOnArm.castShadow = true;
    this.shieldOnArm.visible = false;

    const bossGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.3 });
    const boss = new THREE.Mesh(bossGeo, ironMat);
    boss.position.z = 0.025;
    this.shieldOnArm.add(boss);
    const isSlotL = (leftArmBone && leftArmBone.name && leftArmBone.name.toLowerCase().includes('slot'));
    this.shieldRestPos = new THREE.Vector3();
    this.shieldRestRot = new THREE.Euler();
    if (isSlotL) {
      this.shieldRestPos.set(0, 0, 0.05);
      this.shieldRestRot.set(-Math.PI / 2, 0, 0);
    } else {
      // Attached to forearm bone: face outward to the left side
      this.shieldRestPos.set(-0.10, 0.14, 0.04);
      this.shieldRestRot.set(0, -Math.PI / 2, 0);
    }
    this.shieldOnArm.position.copy(this.shieldRestPos);
    this.shieldOnArm.rotation.copy(this.shieldRestRot);

    if (leftArmBone) {
      leftArmBone.add(this.shieldOnArm);
    }

    // Pre-cache all held weapons on right hand bone for zero-stutter O(1) switching
    this._initHeldWeapons(rightHandBone);

    this.scene.add(this.playerModel);
    this.playAnimation('Idle_A');

    // Apply currently equipped armor visuals and re-equip active held weapon
    if (this.inventory && this.inventory.equippedArmor) {
      this.updateArmorVisuals(this.inventory.equippedArmor);
    }
    if (this.inventory && this.inventory.equippedTool) {
      this.updateHeldWeapon(this.inventory.equippedTool);
    }
  }

  _initHeldWeapons(rightHandBone) {
    this.weaponPool = {};
    if (!rightHandBone) return;

    const isSlot = rightHandBone.name.includes('handslot');

    // 1. Torch
    const tGroup = new THREE.Group();
    const tModel = this.assetLoader ? this.assetLoader.get('Torch_Metal') : null;
    if (tModel) {
      tModel.scale.set(0.7, 0.7, 0.7);
      if (isSlot) {
        tModel.rotation.set(0, 0, 0);
        tModel.position.set(0, 0, 0);
      } else {
        tModel.rotation.set(Math.PI / 2, 0, 0);
        tModel.position.set(0.02, 0.04, 0.12);
      }
      tGroup.add(tModel);
    } else {
      const shaftGeo = new THREE.CylinderGeometry(0.02, 0.025, 0.65, 6);
      const wMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.8 });
      const shaft = new THREE.Mesh(shaftGeo, wMat);
      shaft.position.y = 0.25;
      tGroup.add(shaft);
      const flameGeo = new THREE.DodecahedronGeometry(0.12, 0);
      const flameMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.set(0, 0.6, 0);
      tGroup.add(flame);
      if (!isSlot) tGroup.rotation.x = Math.PI / 2;
    }
    tGroup.visible = false;
    rightHandBone.add(tGroup);
    this.weaponPool['torch'] = tGroup;

    // 2. Axe
    const aGroup = new THREE.Group();
    const axeModel = this.assetLoader ? this.assetLoader.get('Axe_Bronze') : null;
    if (axeModel) {
      axeModel.scale.set(0.75, 0.75, 0.75);
      if (isSlot) {
        axeModel.rotation.set(0, 0, -Math.PI / 2);
        axeModel.position.set(0, 0.05, 0);
      } else {
        axeModel.rotation.set(Math.PI / 2, 0, -Math.PI / 2);
        axeModel.position.set(0.02, 0.04, 0.15);
      }
      aGroup.add(axeModel);
    } else {
      const aShaftGeo = new THREE.CylinderGeometry(0.02, 0.024, 0.65, 8);
      const aWMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.8 });
      const aShaft = new THREE.Mesh(aShaftGeo, aWMat);
      aShaft.position.y = 0.25;
      const aHeadGeo = new THREE.BoxGeometry(0.14, 0.18, 0.04);
      const aHeadMat = new THREE.MeshStandardMaterial({ color: 0xcd7f32, metalness: 0.85, roughness: 0.25 });
      const aHead = new THREE.Mesh(aHeadGeo, aHeadMat);
      aHead.position.set(0.06, 0.45, 0);
      aGroup.add(aShaft, aHead);
      if (!isSlot) aGroup.rotation.x = Math.PI / 2;
    }
    aGroup.visible = false;
    rightHandBone.add(aGroup);
    this.weaponPool['axe'] = aGroup;

    // 3. Sword / Spear (uses KayKit adventurer sword for authentic look)
    const sGroup = new THREE.Group();
    const swordModel = this.assetLoader ? (this.assetLoader.get('sword_1handed') || this.assetLoader.get('Sword_Bronze')) : null;
    if (swordModel) {
      swordModel.scale.set(0.8, 0.8, 0.8);
      if (isSlot) {
        swordModel.rotation.set(0, 0, 0);
        swordModel.position.set(0, 0, 0);
      } else {
        swordModel.rotation.set(Math.PI / 2, 0, 0);
        swordModel.position.set(0.02, 0.04, 0.12);
      }
      sGroup.add(swordModel);
    } else {
      const sShaftGeo = new THREE.CylinderGeometry(0.016, 0.02, 0.22, 8);
      const sGripMat = new THREE.MeshStandardMaterial({ color: 0x3d2714, roughness: 0.8 });
      const sGrip = new THREE.Mesh(sShaftGeo, sGripMat);
      const sGuardGeo = new THREE.BoxGeometry(0.22, 0.03, 0.05);
      const sBrassMat = new THREE.MeshStandardMaterial({ color: 0xcd7f32, metalness: 0.85, roughness: 0.3 });
      const sGuard = new THREE.Mesh(sGuardGeo, sBrassMat);
      sGuard.position.y = 0.11;
      const sBladeGeo = new THREE.BoxGeometry(0.06, 0.7, 0.014);
      const sSteelMat = new THREE.MeshStandardMaterial({ color: 0xdcdde1, metalness: 0.95, roughness: 0.15 });
      const sBlade = new THREE.Mesh(sBladeGeo, sSteelMat);
      sBlade.position.y = 0.47;
      sGroup.add(sGrip, sGuard, sBlade);
      if (!isSlot) sGroup.rotation.x = Math.PI / 2;
    }
    sGroup.visible = false;
    rightHandBone.add(sGroup);
    this.weaponPool['sword'] = sGroup;

    // 4. Pickaxe
    const pGroup = new THREE.Group();
    const pickModel = this.assetLoader ? this.assetLoader.get('Pickaxe_Bronze') : null;
    if (pickModel) {
      pickModel.scale.set(0.75, 0.75, 0.75);
      if (isSlot) {
        pickModel.rotation.set(0, 0, -Math.PI / 2);
        pickModel.position.set(0, 0.05, 0);
      } else {
        pickModel.rotation.set(Math.PI / 2, 0, -Math.PI / 2);
        pickModel.position.set(0.02, 0.04, 0.15);
      }
      pGroup.add(pickModel);
    } else {
      const pShaftGeo = new THREE.CylinderGeometry(0.02, 0.025, 0.7, 8);
      const pWMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.8 });
      const pShaft = new THREE.Mesh(pShaftGeo, pWMat);
      pShaft.position.y = 0.28;
      const pHeadGeo = new THREE.BoxGeometry(0.28, 0.06, 0.05);
      const pMetalMat = new THREE.MeshStandardMaterial({ color: 0x555b63, metalness: 0.85, roughness: 0.3 });
      const pHead = new THREE.Mesh(pHeadGeo, pMetalMat);
      pHead.position.y = 0.6;
      pGroup.add(pShaft, pHead);
      if (!isSlot) pGroup.rotation.x = Math.PI / 2;
    }
    pGroup.visible = false;
    rightHandBone.add(pGroup);
    this.weaponPool['pickaxe'] = pGroup;

    // 5. Building Hammer
    const hGroup = new THREE.Group();
    const hShaftGeo = new THREE.CylinderGeometry(0.02, 0.025, 0.5, 6);
    const headGeo = new THREE.BoxGeometry(0.12, 0.1, 0.16);
    const hWMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.8 });
    const hIMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.8, roughness: 0.3 });
    const hShaft = new THREE.Mesh(hShaftGeo, hWMat);
    hShaft.position.y = 0.18;
    const head = new THREE.Mesh(headGeo, hIMat);
    head.position.y = 0.42;
    hGroup.add(hShaft, head);
    if (!isSlot) {
      hGroup.rotation.set(Math.PI / 2, 0, 0);
      hGroup.position.set(0.02, 0.04, 0.15);
    }
    hGroup.visible = false;
    rightHandBone.add(hGroup);
    this.weaponPool['hammer'] = hGroup;

    // 6. Fishing Rod
    const rodGroup = new THREE.Group();
    const rodGeo = new THREE.CylinderGeometry(0.012, 0.025, 1.8, 6);
    rodGeo.translate(0, 0.9, 0);
    const rodMat = new THREE.MeshStandardMaterial({ color: 0x9b673c, roughness: 0.7 });
    const rod = new THREE.Mesh(rodGeo, rodMat);
    rod.rotation.x = Math.PI / 3;
    rodGroup.add(rod);

    const bobberGeo = new THREE.SphereGeometry(0.045, 6, 6);
    const bobberMat = new THREE.MeshBasicMaterial({ color: 0xe74c3c });
    const bobber = new THREE.Mesh(bobberGeo, bobberMat);
    bobber.position.set(0, 1.4, 0.8);
    rodGroup.add(bobber);
    if (!isSlot) {
      rodGroup.position.set(0.02, 0.04, 0.12);
    }
    rodGroup.visible = false;
    rightHandBone.add(rodGroup);
    this.weaponPool['fishingRod'] = rodGroup;

    // 7. Hunting Bow
    const bowGroup = new THREE.Group();
    const bowAsset = this.assetLoader ? this.assetLoader.get('bow_withString') : null;
    if (bowAsset) {
      bowAsset.scale.set(0.8, 0.8, 0.8);
      if (isSlot) {
        bowAsset.rotation.set(0, Math.PI / 2, -Math.PI / 2);
        bowAsset.position.set(0.02, 0.06, 0.08);
      } else {
        bowAsset.rotation.set(Math.PI / 2, 0, 0);
        bowAsset.position.set(0.02, 0.04, 0.1);
      }
      bowGroup.add(bowAsset);
    } else {
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(0, -0.65, 0.15),
        new THREE.Vector3(0, 0, -0.2),
        new THREE.Vector3(0, 0.65, 0.15)
      );
      const bowGeo = new THREE.TubeGeometry(curve, 16, 0.018, 6, false);
      const bowWoodMat = new THREE.MeshStandardMaterial({ color: 0x4a2e18, roughness: 0.7 });
      const bowMesh = new THREE.Mesh(bowGeo, bowWoodMat);
      bowGroup.add(bowMesh);
      const stringGeo = new THREE.CylinderGeometry(0.003, 0.003, 1.3, 4);
      const stringMat = new THREE.MeshBasicMaterial({ color: 0xe0e0e0 });
      const stringMesh = new THREE.Mesh(stringGeo, stringMat);
      stringMesh.position.set(0, 0, 0.15);
      bowGroup.add(stringMesh);
      if (!isSlot) {
        bowGroup.rotation.set(Math.PI / 2, 0, 0);
        bowGroup.position.set(0.02, 0.04, 0.10);
      }
    }
    bowGroup.visible = false;
    rightHandBone.add(bowGroup);
    this.weaponPool['huntingBow'] = bowGroup;

    // 8. Runic Staff
    const staffGroup = new THREE.Group();
    const staffAsset = this.assetLoader ? this.assetLoader.get('staff') : null;
    if (staffAsset) {
      staffAsset.scale.set(0.8, 0.8, 0.8);
      if (isSlot) {
        staffAsset.rotation.set(0, 0, 0);
        staffAsset.position.set(0, 0, 0);
      } else {
        staffAsset.rotation.set(Math.PI / 2, 0, 0);
        staffAsset.position.set(0.02, 0.04, 0.15);
      }
      staffGroup.add(staffAsset);
    } else {
      const staffGeo = new THREE.CylinderGeometry(0.02, 0.028, 1.5, 8);
      const staffMat = new THREE.MeshStandardMaterial({ color: 0x3d2714, roughness: 0.8 });
      const staff = new THREE.Mesh(staffGeo, staffMat);
      staffGroup.add(staff);
      const orbGeo = new THREE.DodecahedronGeometry(0.09, 1);
      const orbMat = new THREE.MeshStandardMaterial({
        color: 0x33e0ff,
        emissive: 0x11bbff,
        emissiveIntensity: 1.8,
        roughness: 0.2
      });
      const orb = new THREE.Mesh(orbGeo, orbMat);
      orb.position.set(0, 0.8, 0);
      staffGroup.add(orb);
      if (!isSlot) {
        staffGroup.rotation.set(Math.PI / 2, 0, 0);
        staffGroup.position.set(0.02, 0.04, 0.18);
      }
    }
    staffGroup.visible = false;
    rightHandBone.add(staffGroup);
    this.weaponPool['runicStaff'] = staffGroup;

    this.updateHeldWeapon();
  }

  updateHeldWeapon() {
    if (!this.playerModel || !this.weaponPool) return;

    const equipped = this.inventory ? this.inventory.equippedTool : null;
    const activeShield = this.getEquippedShield();

    // 1. Shield visibility & material tinting based on shield tier
    if (this.shieldOnArm) {
      this.shieldOnArm.visible = !!activeShield;
      if (activeShield && this.shieldOnArm.material && this.shieldOnArm.material.color) {
        this.shieldOnArm.material.color.setHex(activeShield.color);
      }
    }

    // 2. Map equipped tool to weaponPool key
    let poolKey = null;
    if (equipped === 'torch') poolKey = 'torch';
    else if (equipped === 'stoneAxe' || equipped === 'bronzeAxe' || equipped === 'ironAxe' || equipped === 'blackMetalAxe') poolKey = 'axe';
    else if (equipped === 'pickaxe' || equipped === 'antlerPickaxe' || equipped === 'bronzePickaxe' || equipped === 'ironPickaxe' || equipped === 'silverPickaxe') poolKey = 'pickaxe';
    else if (equipped === 'stoneSpear' || equipped === 'hornSpear' || equipped === 'bronzeSword' || equipped === 'scaleSword' || equipped === 'ironSword' ||
             equipped === 'steelSword' || equipped === 'silverSword' || equipped === 'blackMetalSword' ||
             equipped === 'runeblade' || equipped === 'dragonSlayer' || equipped === 'weapon' || equipped === 'stoneDagger') poolKey = 'sword';
    else if (equipped === 'hammer' || equipped === 'stoneClub' || equipped === 'titanHammer') poolKey = 'hammer';
    else if (equipped === 'fishingRod') poolKey = 'fishingRod';
    else if (equipped === 'huntingBow' || equipped === 'antlerBow') poolKey = 'huntingBow';
    else if (equipped === 'runicStaff') poolKey = 'runicStaff';

    // Zero-allocation visibility toggle
    for (const [key, mesh] of Object.entries(this.weaponPool)) {
      if (mesh) {
        const isTarget = (key === poolKey);
        mesh.visible = isTarget;
        mesh.traverse(child => {
          if (child.isMesh) child.visible = isTarget;
        });
      }
    }

    // Torch ambient lighting
    if (this.torchLight) {
      this.torchLight.intensity = (equipped === 'torch') ? 2.5 : 0;
    }
  }

  /**
   * Updates 3D visual appearance of player's armor on model (leather, bronze, iron, steel, etc.)
   */
  updateArmorVisuals(armorKey) {
    if (!this.playerModel) return;

    const armorStyles = {
      none:         { color: this.charConfig?.clothingColor || 0x2e5339, metalness: 0.05, roughness: 0.85, name: 'none' },
      stoneArmor:   { color: 0x7f8c8d, metalness: 0.2,  roughness: 0.9,  name: 'stone' },
      leatherArmor: { color: 0x6e411b, metalness: 0.1,  roughness: 0.75, name: 'leather' },
      bronzeArmor:  { color: 0xcd7f32, metalness: 0.85, roughness: 0.25, name: 'bronze' },
      beastArmor:   { color: 0x48321d, metalness: 0.15, roughness: 0.8,  name: 'beast' },
      ironArmor:    { color: 0x555b63, metalness: 0.82, roughness: 0.35, name: 'iron' },
      scaleArmor:   { color: 0x16423c, metalness: 0.65, roughness: 0.3,  name: 'scale' },
      steelArmor:   { color: 0xc8d6e5, metalness: 0.95, roughness: 0.15, name: 'steel' },
      plateArmor:   { color: 0x2f3640, metalness: 0.7,  roughness: 0.45, name: 'plate' },
      runicArmor:   { color: 0x192a56, metalness: 0.5,  roughness: 0.25, emissive: 0x00d2d3, emissiveIntensity: 0.6, name: 'runic' },
      dragonArmor:  { color: 0x110e14, metalness: 0.9,  roughness: 0.2,  emissive: 0xff3838, emissiveIntensity: 0.8, name: 'dragon' }
    };

    const style = armorStyles[armorKey] || armorStyles.none;

    this.playerModel.traverse((child) => {
      if (child.isMesh && child.material) {
        const n = (child.name || '').toLowerCase();
        // Tunic, chest, body, bracers, pauldrons
        if (n.includes('body') || n.includes('pauldron') || n.includes('bracer') || n.includes('torso')) {
          child.material = child.material.clone();
          if (child.material.color) child.material.color.set(style.color);
          if (child.material.isMeshStandardMaterial || child.material.isMeshPhysicalMaterial) {
            child.material.metalness = style.metalness;
            child.material.roughness = style.roughness;
          }
          if (style.emissive !== undefined && child.material.emissive) {
            child.material.emissive.set(style.emissive);
            child.material.emissiveIntensity = style.emissiveIntensity;
          } else if (child.material.emissive) {
            child.material.emissive.set(0x000000);
            child.material.emissiveIntensity = 0;
          }
        }
      }
    });
  }

  applyCharacterConfig(newConfig) {
    this.charConfig = { ...this.charConfig, ...newConfig };
    localStorage.setItem('tikapoo_character', JSON.stringify(this.charConfig));
    this._initPlayerModel();
  }

  getEquippedShield() {
    if (!this.inventory) return null;
    const order = ['blackmetalShield', 'silverShield', 'ironShield', 'bronzeShield', 'stoneShield', 'shield'];
    const cur = this.inventory.equippedTool;
    if (cur && SHIELD_DEFS[cur]) return SHIELD_DEFS[cur];

    if (this.inventory.tools) {
      for (const k of order) {
        if (this.inventory.tools[k]) return SHIELD_DEFS[k];
      }
    }
    if (this.inventory.items) {
      for (const k of order) {
        if (this.inventory.items[k] > 0) return SHIELD_DEFS[k];
      }
    }
    return null;
  }

  startBlock() {
    if (this.isDead || this.isGuardBroken || this._isAnyMenuOpen()) return false;
    const shield = this.getEquippedShield();
    if (!shield) return false;

    this.isBlocking = true;
    this.blockStartTime = performance.now();
    this.activeShield = shield;
    this.maxBlockStamina = shield.maxBlock;
    if (this.blockStamina <= 0) {
      this.blockStamina = shield.maxBlock * 0.25;
    }

    // Shield arm block pose
    if (this.shieldOnArm) {
      this.shieldOnArm.visible = true;
      if (this.shieldOnArm.material && this.shieldOnArm.material.color) {
        this.shieldOnArm.material.color.setHex(shield.color);
      }
      this.shieldOnArm.position.set(0.18, 0.16, 0.22);
      this.shieldOnArm.rotation.set(0.2, Math.PI * 0.65, 0.3);
    }

    // Show HUD block meter
    if (this.hud && this.hud.updateBlockMeter) {
      this.hud.updateBlockMeter(this.blockStamina, this.maxBlockStamina, shield);
    }
    return true;
  }

  stopBlock() {
    this.isBlocking = false;
    if (this.shieldOnArm) {
      if (this.shieldRestPos && this.shieldRestRot) {
        this.shieldOnArm.position.copy(this.shieldRestPos);
        this.shieldOnArm.rotation.copy(this.shieldRestRot);
      } else {
        this.shieldOnArm.position.set(-0.10, 0.14, 0.04);
        this.shieldOnArm.rotation.set(0, -Math.PI / 2, 0);
      }
      const shield = this.getEquippedShield();
      this.shieldOnArm.visible = !!shield;
    }
    if (this.hud && this.hud.hideBlockMeter) {
      this.hud.hideBlockMeter(1200);
    }
  }

  activateBossBuff(buffType) {
    this.activeBossBuff = buffType;
    try {
      localStorage.setItem('tikapoo_boss_buff', buffType);
    } catch (e) {}
  }

  triggerBossBuffPower() {
    if (!this.activeBossBuff) {
      if (this.hud) this.hud.showNotification('⚠️ Sinulla ei ole aktiivista Alttaribuffia! Tuo bossin Trophy alttarille.');
      return;
    }
    if (this.buffCooldownTimer > 0) {
      if (this.hud) this.hud.showNotification(`⏳ Buffin latausaika jäljellä: ${Math.ceil(this.buffCooldownTimer)}s`);
      return;
    }

    if (this.activeBossBuff === 'stag') {
      this.woodcuttingBuffTimer = 120.0; // 2 minutes
      this.buffDurationTimer = 120.0;
      this.buffCooldownTimer = 300.0; // 5 min cooldown
      if (this.hud) this.hud.showNotification('🌲 METSURIN VOIMA AKTIVOITU! (Puunhakkuu 2x nopeampaa 2 minuutin ajan!)');
    } else if (this.activeBossBuff === 'wyrm') {
      this.buffDurationTimer = 120.0;
      this.buffCooldownTimer = 300.0;
      if (this.hud) this.hud.showNotification('⚡ SUOJUOKSIJA AKTIVOITU! (+35% Nopeus 2 minuutin ajan!)');
    } else if (this.activeBossBuff === 'golem') {
      this.buffDurationTimer = 120.0;
      this.buffCooldownTimer = 300.0;
      if (this.hud) this.hud.showNotification('🗿 VUOREN KILPI AKTIVOITU! (+50% Panssari 2 minuutin ajan!)');
    }
  }

  playAnimation(name) {
    if (!this.playerActions || !this.playerActions[name]) return;
    if (this.currentAnim === name) return;

    if (this.currentAnim && this.playerActions[this.currentAnim]) {
      this.playerActions[this.currentAnim].fadeOut(0.2);
    }

    const action = this.playerActions[name];
    action.reset();
    action.fadeIn(0.2);
    action.play();
    this.currentAnim = name;
  }

  playAttackAnimation(equippedTool) {
    if (!this.playerActions) return;

    const now = performance.now();
    if (now - this.lastAttackTime < 1100) {
      this.comboStep = (this.comboStep + 1) % 3;
    } else {
      this.comboStep = 0;
    }
    this.lastAttackTime = now;

    let animName = 'Sword_Regular_A';
    let duration = 0.42;
    let speed = 1.45;

    const isFist = !equippedTool || equippedTool === 'hands';
    const isBow = equippedTool === 'huntingBow';
    const isStaff = equippedTool === 'runicStaff';

    if (isFist) {
      // Crisp alternating punches
      animName = (this.comboStep % 2 === 0) ? 'Melee_Hook' : 'Melee_Hook_Rec';
      duration = 0.35;
      speed = 1.5;
    } else if (isBow) {
      // Clean arrow loose motion
      animName = 'OverhandThrow';
      duration = 0.45;
      speed = 1.35;
    } else if (isStaff) {
      // Runic magic thrust / blast
      animName = 'Sword_Heavy_Combo';
      duration = 0.46;
      speed = 1.6;
    } else {
      // 3-hit fluid melee weapon combo
      if (this.comboStep === 0) {
        animName = 'Sword_Regular_A';
        duration = 0.38;
        speed = 1.45;
      } else if (this.comboStep === 1) {
        animName = 'Sword_Regular_B';
        duration = 0.38;
        speed = 1.45;
      } else {
        animName = 'Sword_Regular_C';
        duration = 0.48;
        speed = 1.35;
      }
    }

    if (!this.playerActions[animName]) {
      animName = 'Sword_Regular_A';
    }

    const action = this.playerActions[animName];
    if (action) {
      if (this.currentAnim && this.playerActions[this.currentAnim]) {
        this.playerActions[this.currentAnim].fadeOut(0.06);
      }
      action.reset();
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = false;
      action.timeScale = speed;
      action.fadeIn(0.06);
      action.play();
      this.currentAnim = animName;
      this.isAttacking = true;
      this.attackTimer = duration;
    }
  }

  _isAnyMenuOpen() {
    const pauseMenu = document.getElementById('pause-menu');
    const isPaused = pauseMenu && (pauseMenu.classList.contains('active') || (pauseMenu.style.display !== 'none' && pauseMenu.style.display !== ''));
    const mainMenu = document.getElementById('main-menu');
    const isMainMenu = mainMenu && (mainMenu.style.display !== 'none');
    const hasModal = !!(
      document.querySelector('.modal.active') ||
      document.querySelector('.menu-modal.active') ||
      document.querySelector('#crafting-menu.active') ||
      document.querySelector('#backpack-screen.active') ||
      document.querySelector('#map-screen.active') ||
      document.querySelector('#skill-tree-modal.active') ||
      document.querySelector('#npc-dialogue.active') ||
      document.querySelector('#char-creator-modal.active') ||
      document.querySelector('#death-screen.active') ||
      document.querySelector('#modal-account.active')
    );
    return isPaused || isMainMenu || hasModal;
  }

  setupInputs() {
    // Respawn button listener for Cinematic Red Death Screen
    const respawnBtn = document.getElementById('death-respawn-btn');
    if (respawnBtn) {
      const handleRespawn = (e) => {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        this.respawn();
      };
      respawnBtn.addEventListener('click', handleRespawn);
      respawnBtn.addEventListener('pointerdown', handleRespawn);
      respawnBtn.addEventListener('touchend', handleRespawn);
    }

    window.addEventListener('keydown', (e) => {
      // Prevent browser from closing tab on Ctrl+W, reload on Ctrl+R, etc. while playing
      if (e.ctrlKey && (e.code === 'KeyW' || e.code === 'KeyR' || e.code === 'KeyS' || e.code === 'KeyP' || e.code === 'KeyQ')) {
        e.preventDefault();
      }

      // Ignore movement and action keys while typing in input fields, when dead, or when a menu is open
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;

      // Activate Boss Trophy Buff with [F] key
      if (e.code === 'KeyF') {
        this.triggerBossBuffPower();
      }

      // Toggle 3rd person / 1st person with [F5] or [P] (leaves [V] exclusively for Stone Pickaxe)
      if (e.code === 'F5' || e.code === 'KeyP') {
        e.preventDefault();
        this.isThirdPerson = !this.isThirdPerson;
        if (this.hud) {
          const isFi = (typeof Localization !== 'undefined' && Localization.lang === 'en') ? false : true;
          this.hud.showNotification(
            this.isThirdPerson ? (isFi ? '🎥 Kolmannen persoonan kuvakulma [F5]' : '🎥 Third Person Camera [F5]') : (isFi ? '🎥 Ensimmäisen persoonan kuvakulma [F5]' : '🎥 First Person Camera [F5]'),
            2000
          );
        }
      }

      // Camera distance zoom in third person via keyboard (PageUp / PageDown or [ / ])
      if (this.isThirdPerson) {
        if (e.code === 'PageUp' || e.code === 'BracketRight') {
          e.preventDefault();
          this.targetCameraDistance = Math.max(1.4, this.targetCameraDistance - 0.5);
        } else if (e.code === 'PageDown' || e.code === 'BracketLeft') {
          e.preventDefault();
          this.targetCameraDistance = Math.min(8.5, this.targetCameraDistance + 0.5);
        }
      }

      if (this.isDead || this._isAnyMenuOpen()) return;

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.keys.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.keys.back = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.keys.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.keys.right = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.keys.sprint = true;
          break;
        case 'Space':
          this.keys.jump = true;
          break;
      }
    });

    // Mouse wheel zoom in third person (hold CTRL, Shift, or Alt + Wheel to adjust camera distance)
    window.addEventListener('wheel', (e) => {
      if (this.isThirdPerson && (e.ctrlKey || e.shiftKey || e.altKey)) {
        e.preventDefault();
        const zoomDelta = e.deltaY > 0 ? 0.45 : -0.45;
        this.targetCameraDistance = Math.max(1.4, Math.min(8.5, this.targetCameraDistance + zoomDelta));
      }
    }, { passive: false });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.keys.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.keys.back = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.keys.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.keys.right = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.keys.sprint = false;
          break;
        case 'Space':
          this.keys.jump = false;
          break;
      }
    });
  }

  isAnyMenuOpen() {
    const mainMenu = document.getElementById('main-menu');
    if (mainMenu && mainMenu.style.display !== 'none' && !mainMenu.classList.contains('hidden')) return true;

    const pauseMenu = document.getElementById('pause-menu');
    if (pauseMenu && (pauseMenu.classList.contains('active') || pauseMenu.style.display === 'flex')) return true;

    const modal = document.querySelector(
      '.modal.active, .menu-modal.active, #crafting-menu.active, #backpack-screen.active, #map-screen.active, #npc-dialogue.active, #char-creator-modal.active, #dev-password-modal.active'
    );
    if (modal) return true;

    const stModal = document.getElementById('skill-tree-modal');
    if (stModal && stModal.style.display !== 'none' && stModal.style.display !== '') return true;

    return false;
  }

  update(delta, world, combat = null) {
    if (this.playerMixer) {
      this.playerMixer.update(delta);
    }

    // Keep held weapon updated
    if (this.inventory && this._lastEquipped !== this.inventory.equippedTool) {
      this._lastEquipped = this.inventory.equippedTool;
      this.updateHeldWeapon();
    }

    // Update Boss Buff timers
    if (this.buffCooldownTimer > 0) this.buffCooldownTimer = Math.max(0, this.buffCooldownTimer - delta);
    if (this.buffDurationTimer > 0) this.buffDurationTimer = Math.max(0, this.buffDurationTimer - delta);
    if (this.woodcuttingBuffTimer > 0) this.woodcuttingBuffTimer = Math.max(0, this.woodcuttingBuffTimer - delta);

    // Keep equipped armor visuals updated
    if (this.inventory && this._lastArmor !== this.inventory.equippedArmor) {
      this._lastArmor = this.inventory.equippedArmor;
      this.updateArmorVisuals(this.inventory.equippedArmor);
    }

    // Check if any UI menu or dialogue is open
    const isMobile = window.isTouchDevice || ('ontouchstart' in window) || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const hasModal = this.isAnyMenuOpen();

    if (hasModal) {
      // Menu is open: freeze player movement inputs, but ensure gravity updates if in mid-air
      if (!this.isGrounded) {
        this.velocity.y -= 25.0 * delta;
        this.playerPos.y += this.velocity.y * delta;
        if (world) {
          const groundY = world.getGroundHeight(this.playerPos.x, this.playerPos.z);
          if (this.playerPos.y <= groundY) {
            this.playerPos.y = groundY;
            this.velocity.y = 0;
            this.isGrounded = true;
          }
        }
        if (this.camera) {
          this.camera.position.set(this.playerPos.x, this.playerPos.y + this.heightAboveGround, this.playerPos.z);
        }
      }
      return;
    }

    // Active gameplay proceeds whenever no menu is open and player is not dead
    // This allows instant movement on ESC unpause without requiring an extra mouse click
    if (this._isAnyMenuOpen() || this.isDead) {
      return;
    }

    // Determine movement direction relative to camera facing (supports keyboard WASD and mobile analog joystick)
    const isAnalogMoving = this.analogMove && (Math.abs(this.analogMove.x) > 0.05 || Math.abs(this.analogMove.y) > 0.05);
    const isMoving = this.keys.forward || this.keys.back || this.keys.left || this.keys.right || isAnalogMoving;
    const canSprint = this.stamina > 5 && this.thirst > 5;
    const isSprinting = this.keys.sprint && isMoving && canSprint;

    // Stamina drain / regen with Rested buff and basic needs penalties
    let staminaRegenRate = 28.0;
    if (this.restedTimer > 0) {
      this.restedTimer = Math.max(0, this.restedTimer - delta);
      staminaRegenRate *= 1.6; // +60% Rested stamina regen!
    }
    if (this.thirst < 20) {
      staminaRegenRate *= 0.6; // Dehydrated slow regen
    }
    if (this.hunger < 20) {
      staminaRegenRate *= 0.75; // Starving slow regen
    }

    if (isSprinting) {
      this.stamina = Math.max(0, this.stamina - 9.0 * delta); // Halved sprint drain!
    } else {
      this.stamina = Math.min(this.maxStamina, this.stamina + staminaRegenRate * delta);
    }

    // Guard Break Recovery
    if (this.isGuardBroken) {
      this.guardBreakTimer -= delta;
      if (this.guardBreakTimer <= 0) {
        this.isGuardBroken = false;
      }
    }

    // Shield Block Stamina Recovery & Drain
    if (this.isBlocking) {
      this.stamina = Math.max(0, this.stamina - 2.5 * delta);
      if (this.stamina <= 0) {
        this.stopBlock();
      }
    } else if (!this.isGuardBroken) {
      const shield = this.getEquippedShield();
      if (shield) {
        this.maxBlockStamina = shield.maxBlock;
        if (this.blockStamina < this.maxBlockStamina) {
          this.blockStamina = Math.min(this.maxBlockStamina, this.blockStamina + 45.0 * delta);
          if (this.hud && this.hud.updateBlockMeter) {
            this.hud.updateBlockMeter(this.blockStamina, this.maxBlockStamina, shield);
          }
        }
      }
    }

    let currentSpeed = isSprinting ? this.sprintSpeed : this.moveSpeed;
    if (this.activeBossBuff === 'wyrm' && this.buffDurationTimer > 0) {
      currentSpeed *= 1.35; // Swamp Wyrm buff: 35% faster movement speed!
    }
    if (this.isBlocking) {
      currentSpeed *= 0.72; // Braced movement speed while holding shield guard
    } else if (this.isGuardBroken) {
      currentSpeed *= 0.45; // Stumbled speed during guard break
    }

    // Camera forward and right vectors projected on XZ plane
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, this.camera.up).normalize();

    this.direction.set(0, 0, 0);
    if (this.analogMove && (this.analogMove.x !== 0 || this.analogMove.y !== 0)) {
      // Smooth 360-degree analog joystick movement
      this.direction.addScaledVector(forward, -this.analogMove.y);
      this.direction.addScaledVector(right, this.analogMove.x);
    } else {
      // Keyboard WASD input
      if (this.keys.forward) this.direction.add(forward);
      if (this.keys.back) this.direction.sub(forward);
      if (this.keys.right) this.direction.add(right);
      if (this.keys.left) this.direction.sub(right);
    }

    // Apply horizontal WASD movement with substepped Continuous Collision Detection (CCD)
    // Prevents tunneling through walls, fences, rocks, trees and buildings regardless of sprint speed or frame drops
    if (this.direction.lengthSq() > 0) {
      this.direction.normalize();
      const totalMoveX = this.direction.x * currentSpeed * delta;
      const totalMoveZ = this.direction.z * currentSpeed * delta;
      const bs = this.buildingSystem || (this.inventory && this.inventory.buildingSystem) || null;
      const playerRadius = 0.45;

      const totalDist = Math.hypot(totalMoveX, totalMoveZ);
      const maxSubStep = 0.09; // Max 9cm per step to guarantee 0-tunneling
      const substeps = Math.max(1, Math.ceil(totalDist / maxSubStep));
      const subX = totalMoveX / substeps;
      const subZ = totalMoveZ / substeps;

      for (let s = 0; s < substeps; s++) {
        // Sliding test X
        const testX = this.playerPos.x + subX;
        if (!world || !world.isPositionBlocked(testX, this.playerPos.z, playerRadius, bs)) {
          this.playerPos.x = testX;
        }

        // Sliding test Z
        const testZ = this.playerPos.z + subZ;
        if (!world || !world.isPositionBlocked(this.playerPos.x, testZ, playerRadius, bs)) {
          this.playerPos.z = testZ;
        }
      }
    }

    // Tick attack animation timer
    if (this.attackTimer > 0) {
      this.attackTimer -= delta;
      if (this.attackTimer <= 0) {
        this.isAttacking = false;
      }
    }

    // Animation state machine for 3rd Person: Idle, Walk, Sprint, Jump, Chopping, Attack
    const walkAnimName = this.playerActions['Walk_Natural_Loop'] ? 'Walk_Natural_Loop' : 'Walk_Carry_Loop';
    const sprintAnimName = this.playerActions['Run_Sprint_Loop'] ? 'Run_Sprint_Loop' : walkAnimName;

    if (this.isHarvesting) {
      // Chopping / mining animation is managed actively by ResourceNode
    } else if (this.isAttacking) {
      // Melee attack animation is playing – DO NOT interrupt with idle/walk!
    } else if (!this.isGrounded) {
      this.playAnimation('NinjaJump_Start');
    } else if (this.direction.lengthSq() > 0) {
      if (isSprinting) {
        this.playAnimation(sprintAnimName);
        if (this.currentAnim && this.playerActions[this.currentAnim]) {
          this.playerActions[this.currentAnim].timeScale = 1.0;
        }
      } else {
        this.playAnimation(walkAnimName);
        if (this.currentAnim && this.playerActions[this.currentAnim]) {
          this.playerActions[this.currentAnim].timeScale = 1.0;
        }
      }

      // Footstep sound cadence when on ground
      if (this.isGrounded) {
        this.footstepTimer -= delta;
        const stepInterval = isSprinting ? 0.28 : 0.48;
        if (this.footstepTimer <= 0) {
          this.footstepTimer = stepInterval;
          let surface = 'grass';
          if (world && world.getBiomeKey) {
            const b = world.getBiomeKey(this.playerPos.x, this.playerPos.z);
            if (b === 'mountain') surface = 'stone';
            else if (b === 'swamp') surface = 'mud';
            else if (b === 'ashlands') surface = 'dirt';
          }
          if (this.audioManager) {
            this.audioManager.playFootstep(isSprinting, surface);
          }
        }
      }
    } else {
      this.footstepTimer = 0.08;
      this.playAnimation('Idle_No_Loop');
      if (this.currentAnim && this.playerActions[this.currentAnim]) {
        this.playerActions[this.currentAnim].timeScale = 1.0;
      }
    }

    // 🪜 Climbing Ladder Mechanics (Vertical climbing on ladders & structures)
    let activeClimbable = null;
    const bsForFloor = this.buildingSystem || (this.inventory && this.inventory.buildingSystem) || null;
    if (bsForFloor && bsForFloor.placedStructures) {
      for (let i = 0; i < bsForFloor.placedStructures.length; i++) {
        const st = bsForFloor.placedStructures[i];
        const isClimbType = st.type === 'ladder' || (st.mesh && st.mesh.userData && st.mesh.userData.isClimbable);
        if (isClimbType && st.position) {
          const dX = Math.abs(this.playerPos.x - st.position.x);
          const dZ = Math.abs(this.playerPos.z - st.position.z);
          if (dX <= 0.85 && dZ <= 0.85) {
            const ladderBottom = st.position.y;
            const ladderTop = st.position.y + 3.4;
            if (this.playerPos.y >= ladderBottom - 0.4 && this.playerPos.y <= ladderTop + 0.6) {
              activeClimbable = st;
              break;
            }
          }
        }
      }
    }

    if (activeClimbable) {
      if (this.hud && !this.isClimbing) {
        this.hud.showTooltip('🧗 [W / Space] Kiipeä tikkaille | [S] Laskeudu');
      }

      const wantsUp = this.keys.forward || (this.keys.jump && !this.isGrounded);
      const wantsDown = this.keys.back;

      if (wantsUp) {
        this.isClimbing = true;
        this.velocity.y = 3.6;
        this.stamina = Math.max(0, this.stamina - 4.0 * delta);

        // Auto-vault onto ledge at top of ladder
        if (this.playerPos.y >= activeClimbable.position.y + 3.2) {
          this.playerPos.y = activeClimbable.position.y + 3.5;
          const facing = activeClimbable.mesh.rotation.y;
          this.playerPos.x += Math.sin(facing) * 0.75;
          this.playerPos.z += Math.cos(facing) * 0.75;
          this.velocity.y = 1.0;
          this.isClimbing = false;
        }
      } else if (wantsDown) {
        this.isClimbing = true;
        this.velocity.y = -3.2;
      } else if (this.isClimbing) {
        // Hold position on ladder
        this.velocity.y = 0;
      }
    } else {
      this.isClimbing = false;
    }

    // Jump handling
    if (this.keys.jump && this.isGrounded && !this.isClimbing) {
      this.velocity.y = this.jumpForce;
      this.isGrounded = false;
      this.playAnimation('NinjaJump_Start');
      if (this.audioManager) {
        this.audioManager.playJump();
      }
    }

    // Gravity (Suppressed during active climbing)
    if (!this.isClimbing) {
      this.velocity.y -= 22 * delta;
      if (this.velocity.y < -35) this.velocity.y = -35;
    }
    this.playerPos.y += this.velocity.y * delta;

    // Ground collision & landing (with guaranteed elevation floor so character never sinks underground or below riverbed)
    const rawGroundH = world ? world.getGroundHeight(this.playerPos.x, this.playerPos.z) : 0;

    // Check placed floors & platforms (woodenFloor, stoneFloor, floorDarkWood, floorLightWood, stairsPlatform)
    let highestFloor = -999;
    if (bsForFloor && bsForFloor.placedStructures) {
      for (let i = 0; i < bsForFloor.placedStructures.length; i++) {
        const st = bsForFloor.placedStructures[i];
        const tLower = (st.type || '').toLowerCase();
        if ((tLower.includes('floor') || tLower.includes('platform') || tLower.includes('stair')) && st.position) {
          if (Math.abs(this.playerPos.x - st.position.x) <= 1.45 && Math.abs(this.playerPos.z - st.position.z) <= 1.45) {
            const fTop = st.position.y + 0.18;
            if (fTop > highestFloor && fTop <= this.playerPos.y + 0.65) {
              highestFloor = fTop;
            }
          }
        }
      }
    }

    const groundHeight = Math.max(rawGroundH, highestFloor, -0.65);
    if (this.playerPos.y <= groundHeight) {
      if (!this.isGrounded) {
        this.playAnimation('NinjaJump_Land');
        let surface = 'grass';
        if (highestFloor > rawGroundH) surface = 'wood';
        else if (world && world.getBiomeKey) {
          const b = world.getBiomeKey(this.playerPos.x, this.playerPos.z);
          if (b === 'mountain') surface = 'stone';
          else if (b === 'swamp') surface = 'mud';
          else if (b === 'ashlands') surface = 'dirt';
        }
        if (this.audioManager) {
          this.audioManager.playLand(surface);
        }
      }
      this.playerPos.y = groundHeight;
      this.velocity.y = 0;
      this.isGrounded = true;
    }

    // Basic Needs (Hunger, Thirst, Energy) & Mana - balanced survival pacing
    this.hunger = Math.max(0, this.hunger - 0.055 * delta);
    const thirstDrain = isSprinting ? 0.16 : 0.085;
    this.thirst = Math.max(0, this.thirst - thirstDrain * delta);
    const energyDrain = isSprinting ? 0.35 : 0.08;
    this.energy = Math.max(0, this.energy - energyDrain * delta);
    this.mana = Math.min(this.maxMana, this.mana + 8.0 * delta);

    // Periodic Starvation/Thirst Tick (deal damage every 4s, never per-frame!)
    this.needsTickTimer = (this.needsTickTimer || 0) + delta;
    if (this.needsTickTimer >= 4.0) {
      this.needsTickTimer = 0;
      if (this.hunger <= 0 || this.thirst <= 0) {
        if (this.health > 15) {
          this.takeDamage(4, null, false);
          if (this.hud && this.hud.showNotification) {
            const isFi = !this.currentLang || this.currentLang === 'fi';
            const msg = this.thirst <= 0
              ? (isFi ? '⚠️ Kärsit janosta! Etsi vettä tai juomaa!' : '⚠️ Dehydrated! Drink water or beverage!')
              : (isFi ? '⚠️ Olet nääntymässä nälkään! Syö ruokaa!' : '⚠️ Starving! Eat food to survive!');
            this.hud.showNotification(msg, 3200);
          }
        }
      }
    }
    if (this.hunger > 60 && this.thirst > 60 && this.health < this.maxHealth) {
      this.heal(0.8 * delta);
    }

    // Smooth camera distance zoom
    this.cameraDistance += (this.targetCameraDistance - this.cameraDistance) * Math.min(1.0, delta * 14);

    // Update Player 3D Model position & rotation
    if (this.playerModel) {
      this.playerModel.position.copy(this.playerPos);

      // Smooth model rotation towards movement or camera facing
      const targetAngle = (this.direction.lengthSq() > 0.001)
        ? Math.atan2(this.direction.x, this.direction.z)
        : Math.atan2(forward.x, forward.z);

      let diff = targetAngle - this.playerModel.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.playerModel.rotation.y += diff * Math.min(1.0, delta * 14);

      this.playerModel.visible = this.isThirdPerson;
    }

    // Adjust camera position based on perspective mode
    if (this.isThirdPerson) {
      // Natural RPG spherical boom camera (Valheim / Witcher 3)
      this.camera.getWorldDirection(this._camLookDir);

      // Focus point on the character's upper chest (Y + 1.45m)
      this._camFocusTarget.copy(this.playerPos);
      this._camFocusTarget.y += 1.45;

      // Right vector perpendicular to camera look direction
      this._camRight.crossVectors(this._camLookDir, new THREE.Vector3(0, 1, 0)).normalize();

      // Subtle shoulder offset (0.22m) so line of sight and crosshair are unobstructed
      this._camDesiredPos.copy(this._camFocusTarget);
      this._camDesiredPos.addScaledVector(this._camRight, 0.22);
      this._camDesiredPos.addScaledVector(this._camLookDir, -this.cameraDistance);

      // Ground terrain collision check (prevents camera sinking below hills)
      const groundAtCam = world ? world.getGroundHeight(this._camDesiredPos.x, this._camDesiredPos.z) : 0;
      if (this._camDesiredPos.y < groundAtCam + 0.45) {
        this._camDesiredPos.y = groundAtCam + 0.45;
      }

      // Directly sync camera position with mouse rotation for 100% instant, jitter-free turns!
      this.camera.position.copy(this._camDesiredPos);

      // Hide 1st-person viewmodel in third person mode
      if (combat && combat.weaponRig) {
        combat.weaponRig.visible = false;
      }
    } else {
      // First person camera right at eye height
      this.camera.position.set(
        this.playerPos.x,
        this.playerPos.y + this.heightAboveGround,
        this.playerPos.z
      );

      if (combat && combat.weaponRig) {
        combat.weaponRig.visible = true;
      }
    }

    // Guarantee upright horizon with proper 'YXZ' Euler order so roll cannot accumulate
    if (this.camera) {
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.z = 0;
    }

    // Update HUD bars with full vitals and level data
    if (this.hud && this.hud.updateVitals) {
      this.hud.updateVitals(
        this.health, this.maxHealth,
        this.stamina, this.maxStamina,
        this.hunger, this.maxHunger,
        this.thirst, this.maxThirst,
        this.energy, this.maxEnergy,
        this.mana, this.maxMana,
        this.restedTimer,
        this.level, this.xp, this.xpNext
      );
    } else if (this.hud) {
      this.hud.updateHealth(this.health, this.maxHealth);
      this.hud.updateStamina(this.stamina, this.maxStamina);
      this.hud.updateHunger(this.hunger, this.maxHunger);
    }

    // Dynamic torch PointLight update (illuminates wilderness, caves, and night with warm flame)
    const isTorchEquipped = this.inventory && this.inventory.equippedTool === 'torch';
    if (this.torchLight) {
      if (isTorchEquipped) {
        this.torchLight.visible = true;
        this.torchLight.position.set(this.playerPos.x, this.playerPos.y + 1.45, this.playerPos.z);
        const flicker = Math.sin(Date.now() * 0.015) * 0.25 + Math.cos(Date.now() * 0.028) * 0.15;
        this.torchLight.intensity = 2.8 + flicker;
      } else {
        this.torchLight.visible = false;
        this.torchLight.intensity = 0;
      }
    }
  }

  takeDamage(amount, attacker = null, playAudio = true) {
    if (this.health <= 0 || this.isDead) return;

    // Check Shield Block & Parry Mechanics
    const shield = this.getEquippedShield();
    if (this.isBlocking && shield && !this.isGuardBroken) {
      const timeSinceBlock = (performance.now() - this.blockStartTime) / 1000;
      const isParry = timeSinceBlock <= shield.parryWindow;

      if (isParry) {
        // ⚡ PERFECT TIMED PARRY!
        if (this.audioManager && this.audioManager.playParry) {
          this.audioManager.playParry();
        }
        if (this.hud) {
          const isFi = (typeof Localization === 'undefined' || Localization.getLanguage() !== 'en');
          this.hud.showNotification(isFi ? `⚡ PARRY! VASTA-ISKU (${shield.nameFi})!` : `⚡ PARRY! COUNTER STRIKE (${shield.nameEn})!`, 2200);
          this.hud.showDamageNumber('⚡ PARRY!', false, this.playerPos, this.camera);
          if (this.hud.flashParry) this.hud.flashParry();
        }

        // Stagger attacker!
        if (attacker && typeof attacker.stagger === 'function') {
          attacker.stagger(shield.staggerDuration, shield.parryMult);
        }

        // Parry stamina reward
        this.stamina = Math.min(this.maxStamina, this.stamina + 12);
        if (this.hud) this.hud.updateStamina(this.stamina, this.maxStamina);
        return; // Zero damage taken on parry!
      }

      // Normal SHIELD BLOCK
      const absorbed = amount * shield.damageReduction;
      const passThroughDamage = amount - absorbed;
      const blockCost = Math.round(amount * (1.15 - shield.damageReduction * 0.4));

      this.blockStamina = Math.max(0, this.blockStamina - blockCost);

      if (this.audioManager && this.audioManager.playShieldBlock) {
        this.audioManager.playShieldBlock();
      }
      if (this.hud) {
        if (this.hud.updateBlockMeter) this.hud.updateBlockMeter(this.blockStamina, this.maxBlockStamina, shield);
        const isFi = (typeof Localization === 'undefined' || Localization.getLanguage() !== 'en');
        this.hud.showNotification(isFi ? `🛡️ ${shield.nameFi} torjui ${Math.round(absorbed)} vahinkoa!` : `🛡️ ${shield.nameEn} blocked ${Math.round(absorbed)} DMG!`, 1600);
      }

      // Guard Break if block stamina depleted!
      if (this.blockStamina <= 0) {
        this.isGuardBroken = true;
        this.guardBreakTimer = 1.4;
        this.stopBlock();
        if (this.audioManager && this.audioManager.playGuardBreak) {
          this.audioManager.playGuardBreak();
        }
        if (this.hud) {
          const isFi = (typeof Localization === 'undefined' || Localization.getLanguage() !== 'en');
          this.hud.showNotification(isFi ? '💥 KILVEN SUOJAUS MURTUI (GUARD BROKEN)!' : '💥 SHIELD POSTURE BROKEN!', 2600);
        }
      }

      amount = passThroughDamage;
    }

    // Apply armor & shield damage reduction
    const reduction = (this.inventory && this.inventory.getDamageReduction)
      ? this.inventory.getDamageReduction()
      : 0;
    const rawDamage = amount * (1 - reduction);
    if (rawDamage < 0.5) return; // Ignore microscopic continuous ticks to prevent false -1 damage spam

    const finalDamage = Math.max(1, Math.round(rawDamage));

    this.health = Math.max(0, this.health - finalDamage);

    if (this.hud) {
      this.hud.showDamageNumber(finalDamage, true);
      this.hud.flashRed();
      this.hud.updateHealth(this.health, this.maxHealth);
    }

    if (playAudio && this.audioManager) {
      this.audioManager.playHurt();
    }

    if (this.health <= 0) {
      this.die();
    }
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
    if (this.hud) {
      this.hud.updateHealth(this.health, this.maxHealth);
    }
  }

  tryInteract() {
    const pPos = this.playerPos;

    // 1. Check near Campfire or Bed (within 3.8m)
    let nearRest = false;
    if (this.world && this.world.campfires) {
      for (const cf of this.world.campfires) {
        if (cf.position && cf.position.distanceTo(pPos) < 3.8) {
          nearRest = true;
          break;
        }
      }
    }
    const bs = this.buildingSystem || (this.inventory && this.inventory.buildingSystem) || null;
    if (!nearRest && bs && bs.placedStructures) {
      for (const ps of bs.placedStructures) {
        if ((ps.type === 'campfire' || ps.type === 'bed') && ps.position.distanceTo(pPos) < 3.8) {
          nearRest = true;
          break;
        }
      }
    }

    if (nearRest) {
      this.energy = 100;
      this.stamina = this.maxStamina;
      this.health = Math.min(this.maxHealth, this.health + 40);
      this.restedTimer = 300; // 5 min Rested buff!
      if (this.audioManager) this.audioManager.playRest();
      if (this.hud) {
        this.hud.showNotification('🛋️ Lepäsit tulen ääressä! Sait "Levännyt"-buffin (+50% Kestävyys, +25% XP 5 min)', 4500);
      }
      return;
    }

    // 2. Check near Water (Lake, River, Shore)
    const groundH = this.world ? this.world.getGroundHeight(pPos.x, pPos.z) : 2;
    const isNearWater = groundH <= 1.2 || (Math.abs(pPos.x - Math.sin(pPos.z * 0.02) * 20) < 6.0 && Math.abs(pPos.z) < 200);

    if (isNearWater) {
      this.thirst = 100;
      if (this.audioManager) this.audioManager.playDrink();
      if (this.hud) {
        this.hud.showNotification('💧 Sammutit janosi raikkaalla järvivedellä! (+100 Jano)', 3000);
      }
      return;
    }
  }

  addXP(amount) {
    let finalXP = amount;
    if (this.restedTimer > 0) {
      finalXP = Math.round(amount * 1.25); // +25% Rested XP bonus!
    }
    this.xp += finalXP;

    if (this.hud) {
      this.hud.showPickupText(`+${finalXP} XP`);
    }

    if (this.xp >= this.xpNext) {
      this.level += 1;
      this.xp -= this.xpNext;
      this.xpNext = Math.round(this.xpNext * 1.5);
      this.skillPoints += 1;

      // Passive level-up stat increases (+8 Max HP, +6 Max Stamina, +5 Max Mana)
      this.maxHealth = 100 + (this.level - 1) * 8;
      this.maxStamina = 100 + (this.level - 1) * 6;
      this.maxMana = 100 + (this.level - 1) * 5;
      this.health = this.maxHealth;
      this.stamina = this.maxStamina;
      this.mana = this.maxMana;

      if (this.audioManager) this.audioManager.playLevelUp();
      if (this.hud) {
        const isFi = !this.currentLang || this.currentLang === 'fi';
        const msg = isFi
          ? `🎉 TASO NOUSI! Olet nyt tasolla ${this.level}! (+8 Max HP, +6 Kestävyys, +5 Mana, +1 Taitopiste)`
          : `🎉 LEVEL UP! You reached Level ${this.level}! (+8 Max HP, +6 Stamina, +5 Mana, +1 Skill Point)`;
        this.hud.showNotification(msg, 5500);
        this.hud.updateHealth(this.health, this.maxHealth);
        this.hud.updateStamina(this.stamina, this.maxStamina);
      }

      if (this.skillTree) {
        this.skillTree.render();
      }
    }
  }

  eat(hungerRestore, healthRestore, thirstRestore = 0, staminaRestore = 0) {
    this.hunger = Math.min(this.maxHunger, this.hunger + hungerRestore);
    if (thirstRestore > 0) {
      this.thirst = Math.min(this.maxThirst, this.thirst + thirstRestore);
    }
    if (healthRestore > 0) {
      this.heal(healthRestore);
    }
    if (staminaRestore > 0) {
      this.stamina = Math.min(this.maxStamina, this.stamina + staminaRestore);
    }
  }

  die(hitDirection = null) {
    if (this.isDead) return;
    this.isDead = true;

    // Reset movement keys
    this.keys.forward = false;
    this.keys.back = false;
    this.keys.left = false;
    this.keys.right = false;
    this.keys.sprint = false;
    this.keys.jump = false;
    if (this.analogMove) this.analogMove.set(0, 0);

    const deathPos = this.playerPos.clone();

    // Death always returns the world to its surface state. Otherwise a dungeon
    // death leaves the terrain hidden after respawn.
    if (this.world && this.world.activeDungeon && this.world.exitDungeon) {
      this.world.exitDungeon();
    }

    // 1. Drop player's inventory items into a recoverable Gravestone
    const droppedItems = {};
    let hasItems = false;
    if (this.inventory && this.inventory.items) {
      for (const [key, count] of Object.entries(this.inventory.items)) {
        if (count > 0) {
          droppedItems[key] = count;
          this.inventory.items[key] = 0;
          hasItems = true;
        }
      }
      this.inventory.updateDisplay();
    }

    // 2. Spawn 3D Gravestone in the world at death location
    if (this.world && this.world.spawnTombstone) {
      this.world.spawnTombstone(deathPos.x, deathPos.y, deathPos.z, droppedItems);
    }

    // 3. Spawn physical Ragdoll corpse of player
    if (this.ragdollManager && this.playerModel) {
      const dir = hitDirection || this.lastDamageDir || new THREE.Vector3((Math.random() - 0.5), 0, (Math.random() - 0.5));
      this.ragdollManager.spawnRagdoll(this.playerModel, dir, 1.35, true);
      this.playerModel.visible = false;
    }

    // 4. Audio & Notification
    if (this.audioManager && this.audioManager.playHurt) {
      this.audioManager.playHurt();
    }
    if (this.hud) {
      this.hud.flashRed();
      this.hud.showNotification(
        hasItems
          ? '☠️ Kaaduit maahan! Tavarat putosivat kuolinpaikkasi hautakivelle 🪦. Noutamalla hautakiven saat tavarasi takaisin!'
          : '☠️ Kaaduit maahan! Valitse "Synty uudelleen" herätäksesi leirissä.',
        6000
      );
    }

    // 5. Unlock pointer so player can click Respawn button cleanly
    if (this.controls && this.controls.isLocked) {
      try { this.controls.unlock(); } catch (e) {}
    }

    // 6. Fade in Cinematic Red Death Screen
    setTimeout(() => {
      const deathScreen = document.getElementById('death-screen');
      if (deathScreen) {
        const titleEl = deathScreen.querySelector('.death-title');
        const subEl = deathScreen.querySelector('.death-subtitle');
        const respawnEl = deathScreen.querySelector('#death-respawn-btn span');
        const isEn = (typeof Localization !== 'undefined' && Localization.getLanguage && Localization.getLanguage() === 'en');
        if (titleEl) titleEl.textContent = isEn ? 'YOU DIED' : 'SINÄ KUOLIT';
        if (subEl) subEl.textContent = isEn
          ? 'The freezing winds of Pohjola claimed your life... Your belongings dropped onto a gravestone 🪦.'
          : 'Pohjolan hyinen viima vei voimasi... Tavarat putosivat kuolinpaikkasi hautakivelle 🪦.';
        if (respawnEl) respawnEl.textContent = isEn ? '⚔️ RESPAWN' : '⚔️ SYNNY UUDELLEEN (RESPAWN)';

        deathScreen.style.display = 'flex';
        void deathScreen.offsetWidth;
        deathScreen.classList.add('active');
      }
    }, 600);
  }

  respawn() {
    // Defensive cleanup for deaths that occurred while the dungeon state was
    // already transitioning or before the death handler restored the surface.
    if (this.world && this.world.activeDungeon && this.world.exitDungeon) {
      this.world.exitDungeon();
    }

    // 1. Hide death screen
    const deathScreen = document.getElementById('death-screen');
    if (deathScreen) {
      deathScreen.classList.remove('active');
      deathScreen.style.display = 'none';
    }

    // 2. Clean up player ragdoll
    if (this.ragdollManager) {
      this.ragdollManager.removePlayerRagdoll();
    }

    // 3. Make living player model visible again & guarantee complete head & hair integrity
    if (this.playerModel) {
      this.playerModel.visible = true;
      if (this.assetLoader && this.assetLoader.ensureHead) {
        const isFemale = this.charConfig?.gender === 'female';
        this.assetLoader.ensureHead(
          this.playerModel,
          isFemale,
          0x222222,
          this.charConfig?.skinColor || null,
          this.charConfig?.hairColor || null,
          this.charConfig?.hairStyle || 'short'
        );
      }
      this.currentAnim = null;
      this.playAnimation('Idle_A');
    }

    // 4. Reset position to central village campfire
    const spawnY = (this.world && this.world.getGroundHeight) ? this.world.getGroundHeight(0, 0) : 3.0;
    this.playerPos.set(0, Math.max(spawnY, 2.5), 0);
    this.velocity.set(0, 0, 0);

    // 5. Restore vitals
    this.health = this.maxHealth;
    this.stamina = this.maxStamina;
    this.hunger = 80;
    this.thirst = 80;
    this.energy = 80;
    this.isDead = false;

    if (this.hud) {
      this.hud.updateHealth(this.health, this.maxHealth);
      this.hud.updateStamina(this.stamina, this.maxStamina);
      this.hud.updateHunger(this.hunger, this.maxHunger);
      this.hud.showNotification('☀️ Synnyit uudelleen leirissä! Hae varusteesi hautakiveltäsi.', 5000);
    }

    // 6. Lock controls back into active gameplay
    if (window.restoreGameFocus) {
      window.restoreGameFocus();
    }
  }

  getPosition() {
    return this.playerPos;
  }
}
