import * as THREE from 'three';

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

    this.level = 1;
    this.xp = 0;
    this.xpNext = 100;
    this.skillPoints = 1;
    this.restedTimer = 0; // 5-minute Rested buff from campfires / beds

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

    // Melee attack animation and combo state
    this.isAttacking = false;
    this.attackTimer = 0;
    this.comboStep = 0;
    this.lastAttackTime = 0;

    // Dynamic player torch PointLight (illuminates night and dark dungeons)
    this.torchLight = new THREE.PointLight(0xff8822, 0, 26, 2.0);
    this.torchLight.castShadow = false;
    this.scene.add(this.torchLight);

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
    }

    // Load saved or default character configuration
    const savedChar = localStorage.getItem('tikapoo_character');
    let config = {
      gender: 'male',
      headStyle: 'hood',
      hairStyle: 'short',
      hairColor: 0x3d2817,
      skinColor: 0xf5d0b5,
      clothingColor: 0x2e5339
    };
    if (savedChar) {
      try { config = { ...config, ...JSON.parse(savedChar) }; } catch (e) {}
    }
    this.charConfig = config;

    const isFemale = config.gender === 'female';
    const isHood = config.headStyle === 'hood';
    // New heroic adventurer models: Barbarian (male warrior) and Ranger_Adv (female ranger)
    const modelName = config.model || (isFemale ? (isHood ? 'Ranger_Adv' : 'Rogue_Hooded') : (isHood ? 'Barbarian' : 'Knight'));

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

    // Locate hand bones for weapons & shield attachment (supports both Rig_Medium and UAL2)
    let rightHandBone = null;
    let leftArmBone = null;
    this.playerModel.traverse((c) => {
      if (c.isBone) {
        if (c.name === 'handslot.r') rightHandBone = c;
        else if (!rightHandBone && (c.name === 'hand.r' || c.name.includes('hand_r'))) rightHandBone = c;

        if (c.name === 'handslot.l') leftArmBone = c;
        else if (!leftArmBone && (c.name === 'hand.l' || c.name.includes('hand_l') || c.name.includes('lowerarm_l'))) leftArmBone = c;
      }
    });

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
    this.shieldOnArm.position.set(0.06, 0.12, 0);
    this.shieldOnArm.rotation.set(0, Math.PI / 2, 0);

    if (leftArmBone) {
      leftArmBone.add(this.shieldOnArm);
    }

    // Pre-cache all held weapons on right hand bone for zero-stutter O(1) switching
    this._initHeldWeapons(rightHandBone);

    this.scene.add(this.playerModel);
    this.playAnimation('Idle_A');

    // Apply currently equipped armor visuals
    if (this.inventory && this.inventory.equippedArmor) {
      this.updateArmorVisuals(this.inventory.equippedArmor);
    }
  }

  _initHeldWeapons(rightHandBone) {
    this.weaponPool = {};
    if (!rightHandBone) return;

    // 1. Torch
    const tGroup = new THREE.Group();
    const tModel = this.assetLoader ? this.assetLoader.get('Torch_Metal') : null;
    if (tModel) {
      tModel.scale.set(0.65, 0.65, 0.65);
      tModel.rotation.set(Math.PI / 2, 0, 0);
      tModel.position.set(0.02, 0.04, 0.12);
      tGroup.add(tModel);
    } else {
      const shaftGeo = new THREE.CylinderGeometry(0.02, 0.025, 0.65, 6);
      const wMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.8 });
      const shaft = new THREE.Mesh(shaftGeo, wMat);
      shaft.rotation.x = Math.PI / 2;
      tGroup.add(shaft);
      const flameGeo = new THREE.DodecahedronGeometry(0.12, 0);
      const flameMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.set(0, 0, 0.38);
      tGroup.add(flame);
      tGroup.position.set(0.02, 0.04, 0.12);
    }
    tGroup.visible = false;
    rightHandBone.add(tGroup);
    this.weaponPool['torch'] = tGroup;

    // 2. Axe
    if (this.assetLoader) {
      const axeModel = this.assetLoader.get('Axe_Bronze');
      if (axeModel) {
        axeModel.scale.set(0.75, 0.75, 0.75);
        axeModel.rotation.set(Math.PI / 2, 0, 0);
        axeModel.position.set(0.02, 0.04, 0.15);
        axeModel.visible = false;
        rightHandBone.add(axeModel);
        this.weaponPool['axe'] = axeModel;
      }
    }

    // 3. Sword / Spear
    if (this.assetLoader) {
      const swordModel = this.assetLoader.get('Sword_Bronze');
      if (swordModel) {
        swordModel.scale.set(0.75, 0.75, 0.75);
        swordModel.rotation.set(Math.PI / 2, 0, 0);
        swordModel.position.set(0.02, 0.04, 0.12);
        swordModel.visible = false;
        rightHandBone.add(swordModel);
        this.weaponPool['sword'] = swordModel;
      }
    }

    // 4. Pickaxe
    if (this.assetLoader) {
      const pickModel = this.assetLoader.get('Pickaxe_Bronze');
      if (pickModel) {
        pickModel.scale.set(0.75, 0.75, 0.75);
        pickModel.rotation.set(Math.PI / 2, 0, 0);
        pickModel.position.set(0.02, 0.04, 0.15);
        pickModel.visible = false;
        rightHandBone.add(pickModel);
        this.weaponPool['pickaxe'] = pickModel;
      }
    }

    // 5. Building Hammer
    const hGroup = new THREE.Group();
    const hShaftGeo = new THREE.CylinderGeometry(0.02, 0.025, 0.5, 6);
    const headGeo = new THREE.BoxGeometry(0.12, 0.1, 0.16);
    const hWMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.8 });
    const hIMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.8, roughness: 0.3 });
    const hShaft = new THREE.Mesh(hShaftGeo, hWMat);
    const head = new THREE.Mesh(headGeo, hIMat);
    head.position.y = 0.22;
    hGroup.add(hShaft, head);
    hGroup.rotation.set(Math.PI / 2, 0, 0);
    hGroup.position.set(0.02, 0.04, 0.15);
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
    rodGroup.position.set(0.02, 0.04, 0.12);
    rodGroup.visible = false;
    rightHandBone.add(rodGroup);
    this.weaponPool['fishingRod'] = rodGroup;

    // 7. Hunting Bow
    const bowGroup = new THREE.Group();
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
    bowGroup.rotation.set(Math.PI / 2, 0, 0);
    bowGroup.position.set(0.02, 0.04, 0.10);
    bowGroup.visible = false;
    rightHandBone.add(bowGroup);
    this.weaponPool['huntingBow'] = bowGroup;

    // 8. Runic Staff
    const staffGroup = new THREE.Group();
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
    staffGroup.rotation.set(Math.PI / 2, 0, 0);
    staffGroup.position.set(0.02, 0.04, 0.18);
    staffGroup.visible = false;
    rightHandBone.add(staffGroup);
    this.weaponPool['runicStaff'] = staffGroup;

    this.updateHeldWeapon();
  }

  updateHeldWeapon() {
    if (!this.playerModel || !this.weaponPool) return;

    const equipped = this.inventory ? this.inventory.equippedTool : null;

    // 1. Shield visibility
    if (this.shieldOnArm) {
      this.shieldOnArm.visible = (equipped === 'shield');
    }

    // 2. Map equipped tool to weaponPool key
    let poolKey = null;
    if (equipped === 'torch') poolKey = 'torch';
    else if (equipped === 'stoneAxe' || equipped === 'bronzeAxe' || equipped === 'ironAxe' || equipped === 'blackMetalAxe') poolKey = 'axe';
    else if (equipped === 'pickaxe' || equipped === 'antlerPickaxe' || equipped === 'bronzePickaxe' || equipped === 'ironPickaxe' || equipped === 'silverPickaxe') poolKey = 'pickaxe';
    else if (equipped === 'stoneSpear' || equipped === 'hornSpear' || equipped === 'bronzeSword' || equipped === 'scaleSword' || equipped === 'ironSword' ||
             equipped === 'steelSword' || equipped === 'silverSword' || equipped === 'blackMetalSword' ||
             equipped === 'runeblade' || equipped === 'dragonSlayer') poolKey = 'sword';
    else if (equipped === 'hammer') poolKey = 'hammer';
    else if (equipped === 'fishingRod') poolKey = 'fishingRod';
    else if (equipped === 'huntingBow') poolKey = 'huntingBow';
    else if (equipped === 'runicStaff') poolKey = 'runicStaff';

    // Zero-allocation visibility toggle
    for (const [key, mesh] of Object.entries(this.weaponPool)) {
      if (mesh) mesh.visible = (key === poolKey);
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
          child.material.metalness = style.metalness;
          child.material.roughness = style.roughness;
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

  setupInputs() {
    window.addEventListener('keydown', (e) => {
      // Toggle 3rd person / 1st person with [V]
      if (e.code === 'KeyV') {
        this.isThirdPerson = !this.isThirdPerson;
        if (this.hud) {
          this.hud.showNotification(
            this.isThirdPerson ? '🎥 Kolmannen persoonan kuvakulma (Valheim)' : '🎥 Ensimmäisen persoonan kuvakulma',
            2000
          );
        }
      }

      if (!this.controls.isLocked) return;

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

    // Mouse wheel zoom in third person (hold Shift+Wheel to adjust camera distance)
    window.addEventListener('wheel', (e) => {
      if (this.isThirdPerson && this.controls.isLocked && (e.shiftKey || e.altKey)) {
        this.targetCameraDistance = Math.max(1.8, Math.min(6.5, this.targetCameraDistance + (e.deltaY > 0 ? 0.35 : -0.35)));
      }
    }, { passive: true });

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

  update(delta, world, combat = null) {
    if (this.playerMixer) {
      this.playerMixer.update(delta);
    }

    // Keep held weapon updated
    if (this.inventory && this._lastEquipped !== this.inventory.equippedTool) {
      this._lastEquipped = this.inventory.equippedTool;
      this.updateHeldWeapon();
    }

    // Keep equipped armor visuals updated
    if (this.inventory && this._lastArmor !== this.inventory.equippedArmor) {
      this._lastArmor = this.inventory.equippedArmor;
      this.updateArmorVisuals(this.inventory.equippedArmor);
    }

    if (!this.controls.isLocked) {
      return;
    }

    // Determine movement direction relative to camera facing
    const isMoving = this.keys.forward || this.keys.back || this.keys.left || this.keys.right;
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

    const currentSpeed = isSprinting ? this.sprintSpeed : this.moveSpeed;

    // Camera forward and right vectors projected on XZ plane
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, this.camera.up).normalize();

    this.direction.set(0, 0, 0);
    if (this.keys.forward) this.direction.add(forward);
    if (this.keys.back) this.direction.sub(forward);
    if (this.keys.right) this.direction.add(right);
    if (this.keys.left) this.direction.sub(right);

    // Apply horizontal WASD movement with sliding collision check against buildings and obstacles
    if (this.direction.lengthSq() > 0) {
      this.direction.normalize();
      const moveX = this.direction.x * currentSpeed * delta;
      const moveZ = this.direction.z * currentSpeed * delta;
      const bs = (this.inventory && this.inventory.buildingSystem) ? this.inventory.buildingSystem : null;

      // Sliding test X
      const testX = this.playerPos.x + moveX;
      if (!world || !world.isPositionBlocked(testX, this.playerPos.z, 0.45, bs)) {
        this.playerPos.x = testX;
      }

      // Sliding test Z
      const testZ = this.playerPos.z + moveZ;
      if (!world || !world.isPositionBlocked(this.playerPos.x, testZ, 0.45, bs)) {
        this.playerPos.z = testZ;
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

    // Jump handling
    if (this.keys.jump && this.isGrounded) {
      this.velocity.y = this.jumpForce;
      this.isGrounded = false;
      this.playAnimation('NinjaJump_Start');
      if (this.audioManager) {
        this.audioManager.playJump();
      }
    }

    // Gravity
    this.velocity.y -= 22 * delta;
    if (this.velocity.y < -35) this.velocity.y = -35;
    this.playerPos.y += this.velocity.y * delta;

    // Ground collision & landing
    const groundHeight = world ? world.getGroundHeight(this.playerPos.x, this.playerPos.z) : 0;
    if (this.playerPos.y <= groundHeight) {
      if (!this.isGrounded) {
        this.playAnimation('NinjaJump_Land');
        let surface = 'grass';
        if (world && world.getBiomeKey) {
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

    // Basic Needs (Hunger, Thirst, Energy) & Mana
    this.hunger = Math.max(0, this.hunger - 0.42 * delta);
    const thirstDrain = isSprinting ? 0.95 : 0.52;
    this.thirst = Math.max(0, this.thirst - thirstDrain * delta);
    const energyDrain = isSprinting ? 0.65 : 0.32;
    this.energy = Math.max(0, this.energy - energyDrain * delta);
    this.mana = Math.min(this.maxMana, this.mana + 8.0 * delta);

    if (this.hunger <= 0) {
      this.takeDamage(2.0 * delta, null, false);
    }
    if (this.thirst <= 0) {
      this.takeDamage(2.0 * delta, null, false);
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
      const lookDir = new THREE.Vector3();
      this.camera.getWorldDirection(lookDir);

      // Focus point on the character's upper chest (Y + 1.45m)
      const focusTarget = this.playerPos.clone().add(new THREE.Vector3(0, 1.45, 0));

      // Right vector perpendicular to camera look direction
      const camRight = new THREE.Vector3();
      camRight.crossVectors(lookDir, new THREE.Vector3(0, 1, 0)).normalize();

      // Subtle shoulder offset (0.22m) so line of sight and crosshair are unobstructed
      const shoulder = camRight.multiplyScalar(0.22);

      // Spherical boom position along look direction
      const desiredCamPos = focusTarget
        .clone()
        .add(shoulder)
        .sub(lookDir.clone().multiplyScalar(this.cameraDistance));

      // Ground terrain collision check (prevents camera sinking below hills)
      const groundAtCam = world ? world.getGroundHeight(desiredCamPos.x, desiredCamPos.z) : 0;
      if (desiredCamPos.y < groundAtCam + 0.45) {
        desiredCamPos.y = groundAtCam + 0.45;
      }

      // Smooth follow to eliminate harsh jitter
      this.camera.position.lerp(desiredCamPos, Math.min(1.0, delta * 24));

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

    // Contextual interaction prompts (Campfires / Beds, Water drinking)
    const pPos = this.playerPos;
    let nearCampfire = false;
    if (world && world.campfires) {
      for (const cf of world.campfires) {
        if (cf.position && cf.position.distanceTo(pPos) < 4.0) {
          nearCampfire = true;
          break;
        }
      }
    }
    const bs = (this.inventory && this.inventory.buildingSystem) ? this.inventory.buildingSystem : null;
    if (!nearCampfire && bs && bs.placedStructures) {
      for (const ps of bs.placedStructures) {
        if ((ps.type === 'campfire' || ps.type === 'bed') && ps.position.distanceTo(pPos) < 4.0) {
          nearCampfire = true;
          break;
        }
      }
    }

    const groundH = world ? world.getGroundHeight(pPos.x, pPos.z) : 2;
    const isNearWater = groundH <= 1.2 || (Math.abs(pPos.x - Math.sin(pPos.z * 0.02) * 20) < 6.0 && Math.abs(pPos.z) < 200);

    if (this.hud && !this.hud.harvestProgressContainer?.style?.display?.includes('flex')) {
      if (nearCampfire) {
        this.hud.showTooltip('[Paina E] Lepää leiritulen lämmössä 🔥 (Palauttaa hengen & Levännyt-buffi)');
      } else if (isNearWater) {
        this.hud.showTooltip('[Paina E] Juo raikasta järvivettä 💧');
      }
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
    if (this.health <= 0) return;

    // Apply armor & shield damage reduction
    const reduction = (this.inventory && this.inventory.getDamageReduction)
      ? this.inventory.getDamageReduction()
      : 0;
    const finalDamage = Math.max(1, Math.round(amount * (1 - reduction)));

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
    const bs = (this.inventory && this.inventory.buildingSystem) ? this.inventory.buildingSystem : null;
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
      this.maxHealth += 5;
      this.maxStamina += 5;
      this.health = this.maxHealth;
      this.stamina = this.maxStamina;

      if (this.audioManager) this.audioManager.playLevelUp();
      if (this.hud) {
        this.hud.showNotification(`🎉 TASO NOUSI! Olet nyt tasolla ${this.level}! Paina [O] avataksesi uusia taitoja.`, 5000);
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

  die() {
    if (this.hud) {
      this.hud.showNotification('Kaaduit maahan! Synnyit uudelleen leirissä.', 4500);
    }
    this.playerPos.set(0, 0, 0);
    this.velocity.set(0, 0, 0);
    this.health = 100;
    this.stamina = 180;
    this.hunger = 80;
    this.thirst = 80;
    this.energy = 80;
  }

  getPosition() {
    return this.playerPos.clone();
  }
}
