import * as THREE from 'three';

export default class Combat {
  constructor(scene, camera, player, enemyManager, inventory, hud, audioManager, assetLoader = null, animalManager = null, bossManager = null) {
    this.scene = scene;
    this.camera = camera;
    this.player = player;
    this.enemyManager = enemyManager;
    this.inventory = inventory;
    this.hud = hud;
    this.audioManager = audioManager;
    this.assetLoader = assetLoader || null;
    this.animalManager = animalManager || null;
    this.bossManager = bossManager || null;

    this.attackCooldown = 0.45;
    this.currentCooldown = 0;
    this.attackRange = 3.6;

    this.raycaster = new THREE.Raycaster();
    this.screenCenter = new THREE.Vector2(0, 0);

    // Viewmodel rig attached to camera (1st person)
    this.weaponRig = new THREE.Group();
    this.camera.add(this.weaponRig);

    this.initViewmodel();

    this.isAttacking = false;
    this.swingProgress = 0;
    this.camShakeAmount = 0;

    // Active projectiles (Arrows, Fireballs, Magic Bolts)
    this.projectiles = [];
    // Active visual effects (Ground slam rings, Whirlwind arcs, Celestial beams)
    this.vfxList = [];
  }

  initViewmodel() {
    this.toolsMeshes = {};

    // 1. Bare Hands
    const fistGroup = new THREE.Group();
    const fistGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.22, 8);
    fistGeo.rotateX(Math.PI / 4);
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd2a679, roughness: 0.7 });
    const fist = new THREE.Mesh(fistGeo, skinMat);
    fistGroup.add(fist);
    fistGroup.position.set(0.28, -0.42, -0.45);
    this.weaponRig.add(fistGroup);
    this.toolsMeshes['hands'] = fistGroup;

    // 2. Axes
    const axeGroup = new THREE.Group();
    const axeModel = this.assetLoader ? this.assetLoader.get('Axe_Bronze') : null;
    if (axeModel) {
      axeModel.scale.set(0.65, 0.65, 0.65);
      axeModel.rotation.set(-0.2, -Math.PI / 2, 0.4);
      axeGroup.add(axeModel);
      axeGroup.position.set(0.32, -0.28, -0.55);
    } else {
      const handleMat = new THREE.MeshLambertMaterial({ color: 0x5c4033 });
      const handleGeo = new THREE.CylinderGeometry(0.02, 0.025, 0.6, 6);
      const handle = new THREE.Mesh(handleGeo, handleMat);
      handle.rotation.x = Math.PI / 4;
      axeGroup.add(handle);
      axeGroup.position.set(0.35, -0.3, -0.55);
    }
    axeGroup.visible = false;
    this.weaponRig.add(axeGroup);
    this.toolsMeshes['stoneAxe'] = axeGroup;

    // 3. Swords & Spears
    const spearGroup = new THREE.Group();
    const swordModel = this.assetLoader ? this.assetLoader.get('Sword_Bronze') : null;
    if (swordModel) {
      swordModel.scale.set(0.55, 0.55, 0.55);
      swordModel.rotation.set(-Math.PI / 3, 0.2, -0.3);
      spearGroup.add(swordModel);
      spearGroup.position.set(0.3, -0.3, -0.6);
    } else {
      const handleMat = new THREE.MeshLambertMaterial({ color: 0x5c4033 });
      const shaftGeo = new THREE.CylinderGeometry(0.018, 0.02, 1.2, 6);
      shaftGeo.rotateX(Math.PI / 2);
      const shaft = new THREE.Mesh(shaftGeo, handleMat);
      spearGroup.add(shaft);
      spearGroup.position.set(0.3, -0.25, -0.6);
    }
    spearGroup.visible = false;
    this.weaponRig.add(spearGroup);
    this.toolsMeshes['stoneSpear'] = spearGroup;

    // 4. Pickaxes
    const pickGroup = new THREE.Group();
    const pickModel = this.assetLoader ? this.assetLoader.get('Pickaxe_Bronze') : null;
    if (pickModel) {
      pickModel.scale.set(0.6, 0.6, 0.6);
      pickModel.rotation.set(-0.2, -Math.PI / 2, 0.35);
      pickGroup.add(pickModel);
      pickGroup.position.set(0.32, -0.28, -0.55);
    } else {
      const handleMat = new THREE.MeshLambertMaterial({ color: 0x5c4033 });
      const handleGeo = new THREE.CylinderGeometry(0.02, 0.025, 0.65, 6);
      const handle = new THREE.Mesh(handleGeo, handleMat);
      handle.rotation.x = Math.PI / 4;
      const pickHeadGeo = new THREE.BoxGeometry(0.24, 0.05, 0.05);
      const pickHeadMat = new THREE.MeshLambertMaterial({ color: 0x636e72 });
      const pickHead = new THREE.Mesh(pickHeadGeo, pickHeadMat);
      pickHead.position.set(0, 0.28, -0.25);
      pickGroup.add(handle, pickHead);
      pickGroup.position.set(0.32, -0.28, -0.55);
    }
    pickGroup.visible = false;
    this.weaponRig.add(pickGroup);
    this.toolsMeshes['pickaxe'] = pickGroup;

    // 5. Valheim Building Hammer
    const hammerGroup = new THREE.Group();
    const hammerShaftGeo = new THREE.CylinderGeometry(0.02, 0.025, 0.5, 6);
    const hammerHeadGeo = new THREE.BoxGeometry(0.12, 0.1, 0.16);
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.8 });
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.8, roughness: 0.3 });
    const hammerShaft = new THREE.Mesh(hammerShaftGeo, woodMat);
    const hammerHead = new THREE.Mesh(hammerHeadGeo, ironMat);
    hammerHead.position.y = 0.22;
    hammerGroup.add(hammerShaft, hammerHead);
    hammerGroup.rotation.set(-0.3, 0.2, -0.4);
    hammerGroup.position.set(0.32, -0.28, -0.5);
    hammerGroup.visible = false;
    this.weaponRig.add(hammerGroup);
    this.toolsMeshes['hammer'] = hammerGroup;

    // 6. Shield
    const shieldGroup = new THREE.Group();
    const shieldGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.04, 16);
    shieldGeo.rotateX(Math.PI / 2);
    const shieldMat = new THREE.MeshStandardMaterial({ color: 0x8d5524, roughness: 0.7 });
    const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    shieldGroup.add(shieldMesh);
    shieldGroup.position.set(-0.35, -0.28, -0.45);
    shieldGroup.visible = false;
    this.weaponRig.add(shieldGroup);
    this.toolsMeshes['shield'] = shieldGroup;

    // 7. Torch
    const torchGroup = new THREE.Group();
    const torchShaftGeo = new THREE.CylinderGeometry(0.02, 0.025, 0.6, 6);
    const torchWoodMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.85 });
    const torchShaft = new THREE.Mesh(torchShaftGeo, torchWoodMat);
    torchShaft.rotation.x = Math.PI / 4;
    torchGroup.add(torchShaft);
    const flameHeadGeo = new THREE.DodecahedronGeometry(0.09, 0);
    const flameHeadMat = new THREE.MeshBasicMaterial({ color: 0xff7700 });
    const flameHead = new THREE.Mesh(flameHeadGeo, flameHeadMat);
    flameHead.position.set(0, 0.24, -0.24);
    torchGroup.add(flameHead);
    torchGroup.position.set(0.32, -0.28, -0.5);
    torchGroup.visible = false;
    this.weaponRig.add(torchGroup);
    this.toolsMeshes['torch'] = torchGroup;

    // 8. Hunting Bow (Jousi)
    const bowGroup = new THREE.Group();
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, -0.55, 0.12),
      new THREE.Vector3(0, 0, -0.15),
      new THREE.Vector3(0, 0.55, 0.12)
    );
    const bowGeo = new THREE.TubeGeometry(curve, 14, 0.016, 6, false);
    const bWoodMat = new THREE.MeshStandardMaterial({ color: 0x4a2e18, roughness: 0.7 });
    const bowMesh = new THREE.Mesh(bowGeo, bWoodMat);
    bowGroup.add(bowMesh);
    const stringGeo = new THREE.CylinderGeometry(0.0025, 0.0025, 1.1, 4);
    const stringMat = new THREE.MeshBasicMaterial({ color: 0xdcdcdc });
    const stringMesh = new THREE.Mesh(stringGeo, stringMat);
    stringMesh.position.set(0, 0, 0.12);
    bowGroup.add(stringMesh);
    bowGroup.position.set(0.32, -0.25, -0.55);
    bowGroup.rotation.set(-0.2, 0.3, 0.2);
    bowGroup.visible = false;
    this.weaponRig.add(bowGroup);
    this.toolsMeshes['huntingBow'] = bowGroup;

    // 9. Runic Staff (Taikasauva)
    const staffGroup = new THREE.Group();
    const sShaftGeo = new THREE.CylinderGeometry(0.018, 0.024, 1.3, 6);
    const sShaftMat = new THREE.MeshStandardMaterial({ color: 0x3d2714, roughness: 0.8 });
    const sShaft = new THREE.Mesh(sShaftGeo, sShaftMat);
    staffGroup.add(sShaft);
    const sOrbGeo = new THREE.DodecahedronGeometry(0.08, 1);
    const sOrbMat = new THREE.MeshStandardMaterial({
      color: 0x33e0ff,
      emissive: 0x00c4ff,
      emissiveIntensity: 1.5,
      roughness: 0.2
    });
    const sOrb = new THREE.Mesh(sOrbGeo, sOrbMat);
    sOrb.position.y = 0.68;
    staffGroup.add(sOrb);
    staffGroup.position.set(0.32, -0.3, -0.55);
    staffGroup.rotation.set(-0.3, 0.2, -0.3);
    staffGroup.visible = false;
    this.weaponRig.add(staffGroup);
    this.toolsMeshes['runicStaff'] = staffGroup;

    // Tier weapon aliases
    this.toolsMeshes['bronzeAxe'] = axeGroup;
    this.toolsMeshes['ironAxe'] = axeGroup;
    this.toolsMeshes['blackMetalAxe'] = axeGroup;
    this.toolsMeshes['antlerPickaxe'] = pickGroup;
    this.toolsMeshes['bronzePickaxe'] = pickGroup;
    this.toolsMeshes['ironPickaxe'] = pickGroup;
    this.toolsMeshes['silverPickaxe'] = pickGroup;
    this.toolsMeshes['bronzeSword'] = spearGroup;
    this.toolsMeshes['hornSpear'] = spearGroup;
    this.toolsMeshes['ironSword'] = spearGroup;
    this.toolsMeshes['scaleSword'] = spearGroup;
    this.toolsMeshes['steelSword'] = spearGroup;
    this.toolsMeshes['silverSword'] = spearGroup;
    this.toolsMeshes['titanHammer'] = hammerGroup;
    this.toolsMeshes['blackMetalSword'] = spearGroup;
    this.toolsMeshes['runeblade'] = spearGroup;
    this.toolsMeshes['dragonSlayer'] = spearGroup;
  }

  equipTool(toolId) {
    if (this.inventory) {
      this.inventory.equippedTool = (toolId === 'hands') ? null : toolId;
    }
    this.updateEquippedViewmodel();
  }

  updateEquippedViewmodel() {
    const equipped = this.inventory ? (this.inventory.equippedTool || 'hands') : 'hands';
    if (this._lastViewmodelTool === equipped) return;
    this._lastViewmodelTool = equipped;

    for (const k in this.toolsMeshes) {
      if (this.toolsMeshes[k]) {
        this.toolsMeshes[k].visible = (k === equipped || (equipped === 'hands' && k === 'hands'));
      }
    }
  }

  performAttack() {
    if (this.currentCooldown > 0) return;

    const equipped = this.inventory ? this.inventory.equippedTool : null;

    // 1. Bow shooting
    if (equipped === 'huntingBow') {
      this.shootArrow(1.0, false);
      return;
    }

    // 2. Staff magic casting
    if (equipped === 'runicStaff') {
      this.castRunicBolt();
      return;
    }

    // 3. Melee attack
    this.attackCooldown = 0.45;
    this.currentCooldown = this.attackCooldown;
    this.isAttacking = true;
    this.swingProgress = 0;
    this.camShakeAmount = 0.05;

    if (this.audioManager) {
      this.audioManager.playAttack(equipped);
    }

    // Character swing in 3rd person
    if (this.player && this.player.playAttackAnimation) {
      this.player.playAttackAnimation(equipped);
    }

    // Dynamic visual melee slash arc trail effect
    this._spawnSlashVfx(equipped);

    // Calculate damage
    let damage = (this.inventory && this.inventory.getWeaponDamage) ? this.inventory.getWeaponDamage() : 15;
    if (this.player && this.player.skillTree && this.player.skillTree.berserkTimer > 0) {
      damage *= 2.0; // Berserk rage double damage!
    }

    // Raycast hit check
    this.raycaster.setFromCamera(this.screenCenter, this.camera);
    const enemyMeshes = this.enemyManager ? this.enemyManager.getEnemyMeshes() : [];
    const animalMeshes = this.animalManager ? this.animalManager.getAnimals().map(a => a.mesh) : [];
    const bossMeshes = this.bossManager ? this.bossManager.getBossMeshes() : [];
    const hits = this.raycaster.intersectObjects([...enemyMeshes, ...animalMeshes, ...bossMeshes], true);

    let targetHit = false;

    if (hits.length > 0) {
      const firstHit = hits[0];
      const pPos = this.player ? this.player.getPosition() : this.camera.position;
      const distFromPlayer = pPos.distanceTo(firstHit.point);

      let obj = firstHit.object;
      let enemy = null;
      let animal = null;
      let boss = null;

      while (obj) {
        if (obj.userData && obj.userData.boss) { boss = obj.userData.boss; break; }
        if (obj.userData && obj.userData.enemy) { enemy = obj.userData.enemy; break; }
        if (obj.userData && obj.userData.animal) { animal = obj.userData.animal; break; }
        obj = obj.parent;
      }

      const effectiveRange = boss ? (this.attackRange + 2.5) : this.attackRange;

      if (distFromPlayer <= effectiveRange) {
        if (boss && boss.isAlive) {
          boss.takeDamage(damage);
          if (this.hud) this.hud.showDamageNumber(damage, false);
          if (this.audioManager) this.audioManager.playHit();
          this._handleLifesteal(damage);
          targetHit = true;
        } else if (enemy && enemy.isAlive) {
          enemy.takeDamage(damage);
          if (this.hud) this.hud.showDamageNumber(damage, false, enemy.mesh.position, this.camera);
          if (this.audioManager) this.audioManager.playHit();
          this._handleLifesteal(damage);
          targetHit = true;
        } else if (animal && animal.isAlive) {
          animal.takeDamage(damage);
          if (this.hud) this.hud.showDamageNumber(damage, false, animal.mesh.position, this.camera);
          if (this.audioManager) this.audioManager.playHit();
          this._handleLifesteal(damage);
          targetHit = true;
        }
      }
    }

    // Generous forward cone sweep if direct raycast didn't hit (ensures melee always connects)
    if (!targetHit) {
      const pPos = this.player ? this.player.getPosition() : this.camera.position;
      const camDir = new THREE.Vector3();
      this.camera.getWorldDirection(camDir);
      camDir.y = 0;
      camDir.normalize();

      // Check bosses within reach
      if (this.bossManager && this.bossManager.bosses) {
        for (const b of this.bossManager.bosses) {
          if (!b.isAlive || !b.mesh) continue;
          const toTarget = new THREE.Vector3().subVectors(b.mesh.position, pPos);
          toTarget.y = 0;
          const dist = toTarget.length();
          if (dist <= (this.attackRange + 2.8)) {
            toTarget.normalize();
            if (camDir.dot(toTarget) > 0.3) {
              b.takeDamage(damage);
              if (this.hud) this.hud.showDamageNumber(damage, false);
              if (this.audioManager) this.audioManager.playHit();
              this._handleLifesteal(damage);
              targetHit = true;
              break;
            }
          }
        }
      }

      // Check enemies within reach
      if (!targetHit && this.enemyManager && this.enemyManager.enemies) {
        for (const e of this.enemyManager.enemies) {
          if (!e.isAlive || !e.mesh) continue;
          const toTarget = new THREE.Vector3().subVectors(e.mesh.position, pPos);
          toTarget.y = 0;
          const dist = toTarget.length();
          if (dist <= (this.attackRange + 1.4)) {
            toTarget.normalize();
            if (camDir.dot(toTarget) > 0.35) {
              e.takeDamage(damage);
              if (this.hud) this.hud.showDamageNumber(damage, false, e.mesh.position, this.camera);
              if (this.audioManager) this.audioManager.playHit();
              this._handleLifesteal(damage);
              targetHit = true;
              break;
            }
          }
        }
      }

      // Check animals within reach
      if (!targetHit && this.animalManager && this.animalManager.animals) {
        for (const a of this.animalManager.animals) {
          if (!a.isAlive || !a.mesh) continue;
          const toTarget = new THREE.Vector3().subVectors(a.mesh.position, pPos);
          toTarget.y = 0;
          const dist = toTarget.length();
          if (dist <= (this.attackRange + 0.9)) {
            toTarget.normalize();
            if (camDir.dot(toTarget) > 0.35) {
              a.takeDamage(damage);
              if (this.hud) this.hud.showDamageNumber(damage, false, a.mesh.position, this.camera);
              if (this.audioManager) this.audioManager.playHit();
              this._handleLifesteal(damage);
              targetHit = true;
              break;
            }
          }
        }
      }
    }
  }

  _handleLifesteal(damage) {
    if (this.player && this.player.skillTree && this.player.skillTree.berserkTimer > 0) {
      this.player.heal(Math.round(damage * 0.35));
    }
  }

  _spawnSlashVfx(equipped) {
    try {
      const pPos = (this.player && this.player.getPosition) ? this.player.getPosition() : this.camera.position.clone();
      const camDir = new THREE.Vector3();
      this.camera.getWorldDirection(camDir);
      camDir.y = 0;
      if (camDir.lengthSq() > 0.001) camDir.normalize();
      else camDir.set(0, 0, -1);

      const vfxPos = pPos.clone().add(camDir.clone().multiplyScalar(1.2));
      vfxPos.y += 1.0;

      const arcGeo = new THREE.TorusGeometry(0.75, 0.045, 6, 20, Math.PI * 0.65);
      const isFire = (equipped === 'torch');
      const isRune = equipped && (equipped.includes('runeblade') || equipped.includes('dragonSlayer'));
      const color = isFire ? 0xff6600 : (isRune ? 0x00d2d3 : 0xffffff);

      const arcMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide
      });
      const arcMesh = new THREE.Mesh(arcGeo, arcMat);
      arcMesh.position.copy(vfxPos);
      arcMesh.quaternion.copy(this.camera.quaternion);
      arcMesh.rotateZ(-Math.PI * 0.35 + (Math.random() - 0.5) * 0.25);
      arcMesh.rotateY(Math.PI / 4);

      this.scene.add(arcMesh);
      this.vfxList.push({
        mesh: arcMesh,
        duration: 0.18,
        maxDuration: 0.18,
        scaleUp: 1.2
      });
    } catch (e) {
      console.warn('Slash VFX error handled:', e);
    }
  }

  // --- Archery & Magic Projectiles ---

  _getProjectileOriginAndDir() {
    const is3rd = this.player ? this.player.isThirdPerson : false;
    const pPos = (this.player && this.player.getPosition) ? this.player.getPosition() : this.camera.position;

    // Raycast from camera center to find target impact point
    this.raycaster.setFromCamera(this.screenCenter, this.camera);
    const meshes = [
      ...(this.enemyManager ? this.enemyManager.getEnemyMeshes() : []),
      ...(this.bossManager ? this.bossManager.getBossMeshes() : []),
      ...(this.animalManager ? this.animalManager.getAnimals().map(a => a.mesh) : []),
      (this.player && this.player.world && this.player.world.terrainMesh) ? this.player.world.terrainMesh : null
    ].filter(Boolean);

    const hits = this.raycaster.intersectObjects(meshes, true);
    let targetPoint = null;
    if (hits.length > 0 && hits[0].distance > 1.8) {
      targetPoint = hits[0].point;
    } else {
      const camDir = new THREE.Vector3();
      this.camera.getWorldDirection(camDir);
      targetPoint = this.camera.position.clone().add(camDir.multiplyScalar(75.0));
    }

    // In 3rd person, spawn in front of character chest/shoulder (never behind the back!)
    let spawnPos;
    if (is3rd) {
      spawnPos = pPos.clone();
      spawnPos.y += 1.45;
      const camLook = new THREE.Vector3();
      this.camera.getWorldDirection(camLook);
      const camRight = new THREE.Vector3().crossVectors(camLook, new THREE.Vector3(0, 1, 0)).normalize();
      spawnPos.addScaledVector(camRight, 0.25);
      spawnPos.addScaledVector(camLook, 0.65);
    } else {
      const camLook = new THREE.Vector3();
      this.camera.getWorldDirection(camLook);
      spawnPos = this.camera.position.clone().addScaledVector(camLook, 0.6);
    }

    const dir = new THREE.Vector3().subVectors(targetPoint, spawnPos).normalize();
    return { spawnPos, dir };
  }

  shootArrow(damageMultiplier = 1.0, isPiercing = false) {
    if (this.currentCooldown > 0) return;
    this.attackCooldown = 0.55;
    this.currentCooldown = this.attackCooldown;

    // Check arrows in inventory if not special skill
    if (damageMultiplier === 1.0 && this.inventory) {
      if (!this.inventory.has('arrow', 1)) {
        if (this.hud) this.hud.showNotification('❌ Ei nuolia! Valmista nuolia [C]-valikosta.');
        return;
      }
      this.inventory.remove('arrow', 1);
    }

    if (this.audioManager) this.audioManager.playBowShot();
    if (this.player && this.player.playAttackAnimation) {
      this.player.playAttackAnimation('huntingBow');
    }

    // Spawn 3D arrow mesh
    const arrowGroup = new THREE.Group();
    const shaftGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.85, 6);
    shaftGeo.rotateX(Math.PI / 2);
    const sMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.8 });
    const shaft = new THREE.Mesh(shaftGeo, sMat);
    arrowGroup.add(shaft);

    const headGeo = new THREE.ConeGeometry(0.03, 0.12, 5);
    headGeo.rotateX(Math.PI / 2);
    const hMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 });
    const head = new THREE.Mesh(headGeo, hMat);
    head.position.z = 0.45;
    arrowGroup.add(head);

    // Accurate spawn position in front of chest/shoulder toward crosshair target
    const { spawnPos, dir } = this._getProjectileOriginAndDir();
    arrowGroup.position.copy(spawnPos);
    arrowGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);

    this.scene.add(arrowGroup);

    const baseDmg = (this.inventory && this.inventory.getWeaponDamage) ? this.inventory.getWeaponDamage() : 50;
    const finalDmg = Math.round(baseDmg * damageMultiplier);

    this.projectiles.push({
      mesh: arrowGroup,
      velocity: dir.multiplyScalar(48.0),
      gravity: -9.8,
      damage: finalDmg,
      isPiercing: isPiercing,
      life: 3.5,
      type: 'arrow'
    });
  }

  shootMultiShot(count = 5) {
    if (this.audioManager) this.audioManager.playBowShot();
    if (this.player && this.player.playAttackAnimation) {
      this.player.playAttackAnimation('huntingBow');
    }
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const right = new THREE.Vector3();
    right.crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();

    const angles = [-0.18, -0.09, 0, 0.09, 0.18];
    angles.forEach(angle => {
      const spreadDir = dir.clone().add(right.clone().multiplyScalar(angle)).normalize();
      const arrowGroup = new THREE.Group();
      const sGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.85, 4);
      sGeo.rotateX(Math.PI / 2);
      const sMesh = new THREE.Mesh(sGeo, new THREE.MeshBasicMaterial({ color: 0xddc090 }));
      arrowGroup.add(sMesh);
      arrowGroup.position.copy(this.camera.position.clone().add(dir.clone().multiplyScalar(0.6)));
      arrowGroup.quaternion.copy(this.camera.quaternion);
      this.scene.add(arrowGroup);

      this.projectiles.push({
        mesh: arrowGroup,
        velocity: spreadDir.multiplyScalar(44.0),
        gravity: -9.8,
        damage: 45,
        isPiercing: false,
        life: 3.0,
        type: 'arrow'
      });
    });
  }

  castRunicBolt() {
    if (this.currentCooldown > 0) return;
    this.attackCooldown = 0.45;
    this.currentCooldown = this.attackCooldown;

    if (this.player) {
      if (this.player.mana < 8) {
        if (this.hud) this.hud.showNotification('💧 Ei tarpeeksi manaa!');
        return;
      }
      this.player.mana -= 8;
    }

    if (this.audioManager) this.audioManager.playSpell('bolt');
    if (this.player && this.player.playAttackAnimation) {
      this.player.playAttackAnimation('runicStaff');
    }

    const boltGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const boltMat = new THREE.MeshBasicMaterial({ color: 0x33e0ff });
    const boltMesh = new THREE.Mesh(boltGeo, boltMat);

    // High performance glowing corona mesh (avoids WebGL PointLight shader recompilation hitch)
    const haloGeo = new THREE.SphereGeometry(0.32, 8, 8);
    const haloMat = new THREE.MeshBasicMaterial({ color: 0x00c4ff, transparent: true, opacity: 0.45 });
    boltMesh.add(new THREE.Mesh(haloGeo, haloMat));

    const { spawnPos, dir } = this._getProjectileOriginAndDir();
    boltMesh.position.copy(spawnPos);

    this.scene.add(boltMesh);

    this.projectiles.push({
      mesh: boltMesh,
      velocity: dir.multiplyScalar(42.0),
      gravity: 0,
      damage: 52,
      isPiercing: false,
      life: 2.5,
      type: 'bolt'
    });
  }

  castFireball() {
    const fGeo = new THREE.SphereGeometry(0.25, 10, 10);
    const fMat = new THREE.MeshBasicMaterial({ color: 0xff5500 });
    const fireball = new THREE.Mesh(fGeo, fMat);

    // High performance glowing fireball halo (avoids PointLight shader stalls)
    const fHaloGeo = new THREE.SphereGeometry(0.58, 10, 10);
    const fHaloMat = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.45 });
    fireball.add(new THREE.Mesh(fHaloGeo, fHaloMat));

    const { spawnPos, dir } = this._getProjectileOriginAndDir();
    fireball.position.copy(spawnPos);

    this.scene.add(fireball);

    this.projectiles.push({
      mesh: fireball,
      velocity: dir.multiplyScalar(36.0),
      gravity: -1.8,
      damage: 130,
      isExplosive: true,
      explosionRadius: 6.5,
      life: 3.5,
      type: 'fireball'
    });
  }

  // --- AOE Special Skills ---

  performWhirlwind(mult = 2.5, radius = 7.5) {
    const pPos = this.player ? this.player.getPosition() : this.camera.position;
    const baseDmg = (this.inventory && this.inventory.getWeaponDamage) ? this.inventory.getWeaponDamage() : 25;
    const finalDmg = Math.max(55, Math.round(baseDmg * mult));
    this.camShakeAmount = 0.22;

    // Spectacular Whirlwind VFX: Twin glowing energy slash ribbons + expanding dust ring
    const cycloneGroup = new THREE.Group();
    cycloneGroup.position.set(pPos.x, pPos.y + 0.8, pPos.z);

    // 1. Expanding energy disk
    const ringGeo = new THREE.RingGeometry(radius * 0.25, radius, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x48dbfb, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    cycloneGroup.add(ring);

    // 2. Twin curved cyclone blade trails
    const bladeGeo = new THREE.TorusGeometry(radius * 0.65, 0.18, 8, 32, Math.PI * 1.5);
    bladeGeo.rotateX(-Math.PI / 2);
    const bladeMat = new THREE.MeshBasicMaterial({ color: 0xf1c40f, transparent: true, opacity: 0.9 });
    const bladeMesh1 = new THREE.Mesh(bladeGeo, bladeMat);
    const bladeMesh2 = new THREE.Mesh(bladeGeo, bladeMat);
    bladeMesh2.rotation.y = Math.PI;
    cycloneGroup.add(bladeMesh1);
    cycloneGroup.add(bladeMesh2);

    this.scene.add(cycloneGroup);
    this.vfxList.push({ mesh: cycloneGroup, duration: 0.55, maxDuration: 0.55, scaleUp: 1.35, rotateY: 18.0 });

    // Deal damage to all targets in radius
    this._damageTargetsInRadius(pPos, radius, finalDmg);
  }

  performGroundSlam(mult = 3.5, radius = 8.5) {
    const pPos = this.player ? this.player.getPosition() : this.camera.position;
    const baseDmg = (this.inventory && this.inventory.getWeaponDamage) ? this.inventory.getWeaponDamage() : 30;
    const finalDmg = Math.max(90, Math.round(baseDmg * mult));
    this.camShakeAmount = 0.38;

    const slamGroup = new THREE.Group();
    slamGroup.position.set(pPos.x, pPos.y + 0.1, pPos.z);

    // Expanding fiery shockwave ring
    const ringGeo = new THREE.RingGeometry(0.5, radius, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xff793f, side: THREE.DoubleSide, transparent: true, opacity: 0.95 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    slamGroup.add(ring);

    // Ring of 8 bursting rock debris spikes
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const dist = radius * 0.65;
      const rockGeo = new THREE.ConeGeometry(0.35 + Math.random() * 0.2, 1.2 + Math.random() * 0.5, 5);
      const rockMat = new THREE.MeshLambertMaterial({ color: 0x57606f });
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.position.set(Math.cos(angle) * dist, 0.4, Math.sin(angle) * dist);
      rock.rotation.y = Math.random() * Math.PI;
      rock.rotation.z = (Math.random() - 0.5) * 0.4;
      slamGroup.add(rock);
    }

    this.scene.add(slamGroup);
    this.vfxList.push({ mesh: slamGroup, duration: 0.75, maxDuration: 0.75, scaleUp: 1.4 });

    this._damageTargetsInRadius(pPos, radius, finalDmg);
  }

  castFrostNova(radius = 9.0) {
    const pPos = this.player ? this.player.getPosition() : this.camera.position;
    const ringGeo = new THREE.RingGeometry(0.8, radius, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(pPos.x, pPos.y + 0.15, pPos.z);
    this.scene.add(ring);
    this.vfxList.push({ mesh: ring, duration: 0.8, maxDuration: 0.8, scaleUp: 1.4 });

    this._damageTargetsInRadius(pPos, radius, 85);
  }

  castChainLightning() {
    const pPos = this.player ? this.player.getPosition() : this.camera.position;
    const enemies = this.enemyManager ? this.enemyManager.enemies.filter(e => e.isAlive) : [];
    if (enemies.length === 0) return;

    // Find closest enemy
    enemies.sort((a, b) => a.mesh.position.distanceTo(pPos) - b.mesh.position.distanceTo(pPos));
    const hitList = enemies.slice(0, 4);

    hitList.forEach((e, idx) => {
      setTimeout(() => {
        if (!e.isAlive) return;
        e.takeDamage(85);
        if (this.hud) this.hud.showDamageNumber(85, false, e.mesh.position, this.camera);
        // Visual lightning bolt line
        const start = (idx === 0) ? pPos.clone().add(new THREE.Vector3(0, 1.4, 0)) : hitList[idx - 1].mesh.position.clone().add(new THREE.Vector3(0, 1, 0));
        const end = e.mesh.position.clone().add(new THREE.Vector3(0, 1, 0));
        this._spawnLightningBeam(start, end);
      }, idx * 120);
    });
  }

  _spawnLightningBeam(start, end) {
    const distance = start.distanceTo(end);
    const geom = new THREE.CylinderGeometry(0.06, 0.06, distance, 6);
    geom.translate(0, distance / 2, 0);
    geom.rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0x66ffff });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(start);
    mesh.lookAt(end);
    this.scene.add(mesh);
    this.vfxList.push({ mesh: mesh, duration: 0.22, maxDuration: 0.22 });
  }

  castCelestialBeam() {
    const pPos = this.player ? this.player.getPosition() : this.camera.position;
    const beamGeo = new THREE.CylinderGeometry(3.5, 3.5, 60, 16);
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xffea77, transparent: true, opacity: 0.85 });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(pPos.x, pPos.y + 28, pPos.z);
    this.scene.add(beam);
    this.vfxList.push({ mesh: beam, duration: 1.4, maxDuration: 1.4 });

    this._damageTargetsInRadius(pPos, 10.0, 180);
  }

  castRainOfArrows() {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const targetCenter = this.player.getPosition().add(dir.multiplyScalar(14.0));

    for (let i = 0; i < 18; i++) {
      setTimeout(() => {
        const offX = (Math.random() - 0.5) * 8.0;
        const offZ = (Math.random() - 0.5) * 8.0;
        const arrow = new THREE.Group();
        const sGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.8, 4);
        arrow.add(new THREE.Mesh(sGeo, new THREE.MeshBasicMaterial({ color: 0x333333 })));
        arrow.position.set(targetCenter.x + offX, targetCenter.y + 16, targetCenter.z + offZ);
        arrow.rotation.x = Math.PI / 2;
        this.scene.add(arrow);

        this.projectiles.push({
          mesh: arrow,
          velocity: new THREE.Vector3(0, -32, 0),
          gravity: 0,
          damage: 42,
          life: 1.2,
          type: 'arrow'
        });
      }, i * 160);
    }
  }

  _damageTargetsInRadius(center, radius, damage, excludeTarget = null) {
    let hitCount = 0;
    const radSq = radius * radius;

    // Enemies
    if (this.enemyManager && this.enemyManager.enemies) {
      this.enemyManager.enemies.forEach(e => {
        if (e && e.isAlive && e.mesh && e !== excludeTarget) {
          const dx = e.mesh.position.x - center.x;
          const dz = e.mesh.position.z - center.z;
          const distSq = dx * dx + dz * dz;
          const dy = Math.abs(e.mesh.position.y - center.y);
          if (distSq <= radSq && dy <= 5.5) {
            try {
              if (typeof e.takeDamage === 'function') {
                e.takeDamage(damage);
                hitCount++;
                if (this.hud) this.hud.showDamageNumber(damage, false, e.mesh.position, this.camera);
              }
            } catch (err) {
              console.error('[Combat] Error damaging enemy:', err);
            }
          }
        }
      });
    }

    // Animals
    if (this.animalManager && this.animalManager.animals) {
      this.animalManager.animals.forEach(a => {
        if (a && a.isAlive && a.mesh && a !== excludeTarget) {
          const dx = a.mesh.position.x - center.x;
          const dz = a.mesh.position.z - center.z;
          const distSq = dx * dx + dz * dz;
          const dy = Math.abs(a.mesh.position.y - center.y);
          if (distSq <= radSq && dy <= 5.5) {
            try {
              if (typeof a.takeDamage === 'function') {
                a.takeDamage(damage);
                hitCount++;
                if (this.hud) this.hud.showDamageNumber(damage, false, a.mesh.position, this.camera);
              }
            } catch (err) {
              console.error('[Combat] Error damaging animal:', err);
            }
          }
        }
      });
    }

    // Bosses
    if (this.bossManager && this.bossManager.bosses) {
      const bossRadSq = (radius + 4.0) * (radius + 4.0);
      this.bossManager.bosses.forEach(b => {
        if (b && b.isAlive && b.mesh && b !== excludeTarget) {
          const dx = b.mesh.position.x - center.x;
          const dz = b.mesh.position.z - center.z;
          const distSq = dx * dx + dz * dz;
          const dy = Math.abs(b.mesh.position.y - center.y);
          if (distSq <= bossRadSq && dy <= 6.5) {
            try {
              if (typeof b.takeDamage === 'function') {
                b.takeDamage(damage);
                hitCount++;
                if (this.hud) this.hud.showDamageNumber(damage, false);
              }
            } catch (err) {
              console.error('[Combat] Error damaging boss:', err);
            }
          }
        }
      });
    }

    if (hitCount > 0 && this.audioManager && this.audioManager.playHit) {
      this.audioManager.playHit();
    }
  }

  update(delta) {
    if (this.currentCooldown > 0) {
      this.currentCooldown = Math.max(0, this.currentCooldown - delta);
    }

    this.updateEquippedViewmodel();

    // Weapon swing and idle breathing in 1st person
    if (this.isAttacking) {
      this.swingProgress += delta * 3.4; // Fluid ~0.30s melee slash
      const p = Math.min(1.0, this.swingProgress);

      if (p < 0.22) {
        // Windup: raise weapon back and to the right
        const w = p / 0.22;
        this.weaponRig.position.set(0.04 * w, 0.05 * w, 0.04 * w);
        this.weaponRig.rotation.set(0.18 * w, -0.15 * w, 0.22 * w);
      } else if (p < 0.72) {
        // Slash: fast diagonal strike cutting across the center
        const s = (p - 0.22) / 0.50;
        const curve = Math.sin(s * Math.PI);
        this.weaponRig.position.set(0.04 - 0.26 * s, 0.05 - 0.12 * s, 0.04 - 0.18 * curve);
        this.weaponRig.rotation.set(0.18 - 0.42 * s, -0.15 + 0.65 * s, 0.22 - 1.25 * s);
      } else {
        // Recovery: smoothly return to ready stance
        const r = (p - 0.72) / 0.28;
        const invR = 1.0 - r;
        this.weaponRig.position.set(-0.22 * invR, -0.07 * invR, 0);
        this.weaponRig.rotation.set(-0.24 * invR, 0.50 * invR, -1.03 * invR);
      }

      if (this.swingProgress >= 1.0) {
        this.isAttacking = false;
        this.swingProgress = 0;
        this.weaponRig.rotation.set(0, 0, 0);
        this.weaponRig.position.set(0, 0, 0);
      }
    } else {
      const t = performance.now() * 0.002;
      this.weaponRig.position.y = Math.sin(t) * 0.015;
      this.weaponRig.position.x = Math.cos(t * 0.5) * 0.01;
      this.weaponRig.rotation.z = Math.sin(t * 0.8) * 0.02;
    }

    // Update active projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= delta;

      // Apply physics
      p.velocity.y += (p.gravity || 0) * delta;
      p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));

      // Orient mesh to velocity
      if (p.velocity.lengthSq() > 0.01) {
        p.mesh.lookAt(p.mesh.position.clone().add(p.velocity));
      }

      // Check hit against enemies & animals & bosses
      let hasHit = false;
      let hitTarget = null;
      const pPos = p.mesh.position;

      // Bosses (volumetric cylinder check from ground to horns)
      if (this.bossManager && this.bossManager.bosses) {
        for (const b of this.bossManager.bosses) {
          if (b.isAlive && b.mesh) {
            const bPos = b.mesh.position;
            const bScale = (b.def && b.def.scale) ? b.def.scale : 3.5;
            const horizDist = Math.hypot(bPos.x - pPos.x, bPos.z - pPos.z);
            const vertDist = pPos.y - bPos.y;
            if (horizDist <= bScale * 1.3 && vertDist >= -0.5 && vertDist <= bScale * 2.2) {
              b.takeDamage(p.damage);
              if (this.hud) this.hud.showDamageNumber(p.damage, false);
              if (this.audioManager) this.audioManager.playArrowHit();
              hasHit = true;
              hitTarget = b;
              break;
            }
          }
        }
      }

      // Enemies (volumetric cylinder check)
      if (!hasHit && this.enemyManager && this.enemyManager.enemies) {
        for (const e of this.enemyManager.enemies) {
          if (e.isAlive && e.mesh) {
            const ePos = e.mesh.position;
            const horizDist = Math.hypot(ePos.x - pPos.x, ePos.z - pPos.z);
            const vertDist = pPos.y - ePos.y;
            if (horizDist <= 1.5 && vertDist >= -0.3 && vertDist <= 2.4) {
              e.takeDamage(p.damage);
              if (this.hud) this.hud.showDamageNumber(p.damage, false, e.mesh.position, this.camera);
              if (this.audioManager) this.audioManager.playArrowHit();
              hasHit = true;
              hitTarget = e;
              break;
            }
          }
        }
      }

      // Animals
      if (!hasHit && this.animalManager && this.animalManager.animals) {
        for (const a of this.animalManager.animals) {
          if (a.isAlive && a.mesh) {
            const aPos = a.mesh.position;
            const horizDist = Math.hypot(aPos.x - pPos.x, aPos.z - pPos.z);
            const vertDist = pPos.y - aPos.y;
            if (horizDist <= 1.6 && vertDist >= -0.3 && vertDist <= 2.2) {
              a.takeDamage(p.damage);
              if (this.hud) this.hud.showDamageNumber(p.damage, false, a.mesh.position, this.camera);
              if (this.audioManager) this.audioManager.playArrowHit();
              hasHit = true;
              hitTarget = a;
              break;
            }
          }
        }
      }

      // Ground hit
      const groundH = this.player && this.player.world ? this.player.world.getGroundHeight(pPos.x, pPos.z) : 0;
      if (pPos.y <= groundH) {
        hasHit = true;
      }

      if (hasHit || p.life <= 0) {
        if (p.isExplosive) {
          this._damageTargetsInRadius(pPos, p.explosionRadius || 6.5, p.damage, hitTarget);
          if (this.audioManager && this.audioManager.playExplosion) {
            this.audioManager.playExplosion();
          }
        }
        this._disposeMesh(p.mesh);
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }

    // Update active visual effects
    for (let i = this.vfxList.length - 1; i >= 0; i--) {
      const v = this.vfxList[i];
      v.duration -= delta;
      const progress = 1 - (v.duration / v.maxDuration);

      if (v.rotateY) {
        v.mesh.rotation.y += v.rotateY * delta;
      }

      const fadeOpacity = Math.max(0, 1 - progress);
      if (v.mesh.material && v.mesh.material.opacity !== undefined) {
        v.mesh.material.opacity = fadeOpacity;
      }
      v.mesh.traverse(child => {
        if (child.material && child.material.opacity !== undefined) {
          child.material.opacity = fadeOpacity;
        }
      });

      if (v.scaleUp) {
        const s = 1 + progress * (v.scaleUp - 1);
        v.mesh.scale.set(s, s, s);
      }
      if (v.duration <= 0) {
        this._disposeMesh(v.mesh);
        this.scene.remove(v.mesh);
        this.vfxList.splice(i, 1);
      }
    }
  }

  _disposeMesh(obj) {
    if (!obj) return;
    obj.traverse((child) => {
      if (child.geometry) {
        child.geometry.dispose();
      }
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m && m.dispose && m.dispose());
        } else if (child.material.dispose) {
          child.material.dispose();
        }
      }
    });
  }
}
