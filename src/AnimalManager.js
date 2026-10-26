import * as THREE from 'three';

/**
 * AnimalManager – Populates the wilderness with living, breathing wildlife:
 * 1. Metsäpeurat (Wild Forest Stags/Deer) - graze, walk, and flee gracefully when approached
 * 2. Metsäjänikset (Woodland Hares/Rabbits) - hop across meadows, sit up alertly
 * 3. Joen Uivat Kalat (Swimming River Fish) - swim with undulating tails in the river
 */
export default class AnimalManager {
  constructor(scene, world, inventory, hud, audioManager, questManager) {
    this.scene = scene;
    this.world = world;
    this.inventory = inventory;
    this.hud = hud;
    this.audioManager = audioManager;
    this.questManager = questManager;

    this.deers = [];
    this.rabbits = [];
    this.fishSchools = [];
    this._fleeDirection = new THREE.Vector3();
    this._animalDirection = new THREE.Vector3();

    this._spawnWildlife();
  }

  _spawnWildlife() {
    // Spawn 7 Stags/Deer in meadows and forest edges
    const deerSpawns = [
      { x: -30, z: -15 },
      { x: 35,  z: -25 },
      { x: -45, z: 45 },
      { x: 50,  z: 30 },
      { x: -65, z: -40 },
      { x: 25,  z: 55 },
      { x: -10, z: -55 }
    ];
    deerSpawns.forEach((sp, i) => this._createDeer(sp.x, sp.z, i));

    // Spawn 10 Woodland Hares/Rabbits around village paths
    const rabbitSpawns = [
      { x: -12, z: -6 },
      { x: 14,  z: -12 },
      { x: -8,  z: 14 },
      { x: 20,  z: 18 },
      { x: -28, z: 8 },
      { x: 30,  z: -8 },
      { x: -20, z: -25 },
      { x: 10,  z: 32 },
      { x: -35, z: -10 },
      { x: 42,  z: 12 }
    ];
    rabbitSpawns.forEach((sp, i) => this._createRabbit(sp.x, sp.z, i));
  }

  // ==========================================
  // METSÄPEURA (WILD FOREST STAG / DEER)
  // ==========================================
  _createDeer(x, z, index) {
    const group = new THREE.Group();
    const deerMat = new THREE.MeshStandardMaterial({
      color: 0x965a2d,
      roughness: 0.75,
      metalness: 0.05
    });
    const bellyMat = new THREE.MeshStandardMaterial({
      color: 0xdfcbaf,
      roughness: 0.8
    });
    const antlerMat = new THREE.MeshStandardMaterial({
      color: 0xe2d7bc,
      roughness: 0.6,
      metalness: 0.1
    });

    // 1. Torso
    const bodyGeo = new THREE.BoxGeometry(0.7, 0.75, 1.4);
    const body = new THREE.Mesh(bodyGeo, deerMat);
    body.position.y = 1.05;
    body.castShadow = true;
    group.add(body);

    // Underbelly
    const bellyGeo = new THREE.BoxGeometry(0.65, 0.2, 1.1);
    const belly = new THREE.Mesh(bellyGeo, bellyMat);
    belly.position.set(0, 0.75, 0);
    group.add(belly);

    // 2. Neck & Head
    const neckGeo = new THREE.BoxGeometry(0.35, 0.7, 0.45);
    neckGeo.rotateX(Math.PI / 6);
    const neck = new THREE.Mesh(neckGeo, deerMat);
    neck.position.set(0, 1.45, 0.6);
    group.add(neck);

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.8, 0.85);

    const headGeo = new THREE.BoxGeometry(0.32, 0.35, 0.55);
    const head = new THREE.Mesh(headGeo, deerMat);
    head.position.z = 0.15;
    head.castShadow = true;
    headGroup.add(head);

    // Snout
    const snoutGeo = new THREE.BoxGeometry(0.24, 0.22, 0.28);
    const snoutMat = new THREE.MeshStandardMaterial({ color: 0x3d2719, roughness: 0.9 });
    const snout = new THREE.Mesh(snoutGeo, snoutMat);
    snout.position.set(0, -0.05, 0.45);
    headGroup.add(snout);

    // Antlers (majestic multi-branched rack)
    const antlerBaseGeo = new THREE.CylinderGeometry(0.025, 0.035, 0.65, 5);
    const leftAntler = new THREE.Mesh(antlerBaseGeo, antlerMat);
    leftAntler.position.set(-0.16, 0.38, 0.05);
    leftAntler.rotation.set(-0.2, 0, -0.4);

    const leftBranch = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.025, 0.35, 4), antlerMat);
    leftBranch.position.set(-0.08, 0.15, 0.08);
    leftBranch.rotation.set(0.4, 0, -0.6);
    leftAntler.add(leftBranch);

    const rightAntler = new THREE.Mesh(antlerBaseGeo, antlerMat);
    rightAntler.position.set(0.16, 0.38, 0.05);
    rightAntler.rotation.set(-0.2, 0, 0.4);

    const rightBranch = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.025, 0.35, 4), antlerMat);
    rightBranch.position.set(0.08, 0.15, 0.08);
    rightBranch.rotation.set(0.4, 0, 0.6);
    rightAntler.add(rightBranch);

    headGroup.add(leftAntler, rightAntler);

    // Ears
    const earGeo = new THREE.ConeGeometry(0.06, 0.22, 4);
    const leftEar = new THREE.Mesh(earGeo, deerMat);
    leftEar.position.set(-0.18, 0.18, -0.05);
    leftEar.rotation.z = -0.7;
    const rightEar = new THREE.Mesh(earGeo, deerMat);
    rightEar.position.set(0.18, 0.18, -0.05);
    rightEar.rotation.z = 0.7;
    headGroup.add(leftEar, rightEar);

    group.add(headGroup);

    // 3. Four Slender Legs
    const legGeo = new THREE.CylinderGeometry(0.045, 0.035, 0.85, 6);
    legGeo.translate(0, -0.42, 0);

    const flLeg = new THREE.Mesh(legGeo, deerMat);
    flLeg.position.set(-0.25, 0.75, 0.45);
    const frLeg = new THREE.Mesh(legGeo, deerMat);
    frLeg.position.set(0.25, 0.75, 0.45);
    const blLeg = new THREE.Mesh(legGeo, deerMat);
    blLeg.position.set(-0.25, 0.75, -0.45);
    const brLeg = new THREE.Mesh(legGeo, deerMat);
    brLeg.position.set(0.25, 0.75, -0.45);

    group.add(flLeg, frLeg, blLeg, brLeg);

    // 4. White tail
    const tailGeo = new THREE.ConeGeometry(0.06, 0.22, 4);
    const tail = new THREE.Mesh(tailGeo, bellyMat);
    tail.position.set(0, 1.15, -0.72);
    tail.rotation.x = -Math.PI / 4;
    group.add(tail);

    const groundY = this.world.getGroundHeight(x, z);
    group.position.set(x, groundY, z);
    group.rotation.y = Math.random() * Math.PI * 2;
    this.scene.add(group);

    const deer = {
      mesh: group,
      headGroup,
      legs: [flLeg, frLeg, blLeg, brLeg],
      state: 'graze', // 'graze', 'walk', 'flee'
      health: 35,
      isAlive: true,
      wanderTarget: new THREE.Vector3(x, groundY, z),
      wanderTimer: 2 + Math.random() * 4,
      animTime: Math.random() * 10,
      fleeTimer: 0,
      takeDamage: (dmg) => {
        deer.health -= dmg;
        deer.state = 'flee';
        deer.fleeTimer = 6.0;
        if (deer.health <= 0 && deer.isAlive) {
          this._killDeer(deer);
        }
      }
    };

    group.userData.animal = deer;
    group.traverse(c => { if (c.isMesh) c.userData.animal = deer; });
    this.deers.push(deer);
  }

  _killDeer(deer) {
    if (!deer.isAlive) return;
    deer.isAlive = false;
    this.scene.remove(deer.mesh);

    if (this.inventory) {
      this.inventory.add('meat', 2);
      this.inventory.add('leather', 2);
    }
    if (this.hud) {
      this.hud.showNotification('🦌 Metsäpeura saalistettu! (+2 Peuranlihaa, +2 Nahkaa)', 3000);
      this.hud.showPickupText('+2 Peuranlihaa, +2 Nahkaa');
    }
    if (this.audioManager) this.audioManager.playHit();
    if (this.questManager && this.questManager.onHuntDeer) {
      this.questManager.onHuntDeer();
    }
  }

  // ==========================================
  // METSÄJÄNIS (WOODLAND HARE / RABBIT)
  // ==========================================
  _createRabbit(x, z, index) {
    const group = new THREE.Group();
    const furMat = new THREE.MeshStandardMaterial({
      color: 0xb59975,
      roughness: 0.8
    });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf5f0eb, roughness: 0.9 });

    // Body
    const bodyGeo = new THREE.SphereGeometry(0.22, 8, 8);
    bodyGeo.scale(0.85, 0.9, 1.25);
    const body = new THREE.Mesh(bodyGeo, furMat);
    body.position.y = 0.22;
    body.castShadow = true;
    group.add(body);

    // Head
    const headGeo = new THREE.SphereGeometry(0.14, 8, 8);
    const head = new THREE.Mesh(headGeo, furMat);
    head.position.set(0, 0.32, 0.2);
    group.add(head);

    // Long Ears
    const earGeo = new THREE.BoxGeometry(0.04, 0.25, 0.03);
    const leftEar = new THREE.Mesh(earGeo, furMat);
    leftEar.position.set(-0.06, 0.48, 0.16);
    leftEar.rotation.z = -0.15;
    leftEar.rotation.x = -0.1;

    const rightEar = new THREE.Mesh(earGeo, furMat);
    rightEar.position.set(0.06, 0.48, 0.16);
    rightEar.rotation.z = 0.15;
    rightEar.rotation.x = -0.1;

    group.add(leftEar, rightEar);

    // Puffy tail
    const tailGeo = new THREE.SphereGeometry(0.06, 6, 6);
    const tail = new THREE.Mesh(tailGeo, whiteMat);
    tail.position.set(0, 0.25, -0.25);
    group.add(tail);

    const groundY = this.world.getGroundHeight(x, z);
    group.position.set(x, groundY, z);
    group.rotation.y = Math.random() * Math.PI * 2;
    this.scene.add(group);

    const rabbit = {
      mesh: group,
      groundY,
      state: 'hop',
      health: 15,
      isAlive: true,
      hopTime: Math.random() * 5,
      wanderTarget: new THREE.Vector3(x, groundY, z),
      wanderTimer: 2 + Math.random() * 3,
      takeDamage: (dmg) => {
        rabbit.health -= dmg;
        if (rabbit.health <= 0 && rabbit.isAlive) {
          this._killRabbit(rabbit);
        }
      }
    };

    group.userData.animal = rabbit;
    group.traverse(c => { if (c.isMesh) c.userData.animal = rabbit; });
    this.rabbits.push(rabbit);
  }

  _killRabbit(rabbit) {
    if (!rabbit.isAlive) return;
    rabbit.isAlive = false;
    this.scene.remove(rabbit.mesh);

    if (this.inventory) {
      this.inventory.add('meat', 1);
      this.inventory.add('leather', 1);
    }
    if (this.hud) {
      this.hud.showNotification('🐇 Metsäjänis napattu! (+1 Liha, +1 Nahka)', 2500);
      this.hud.showPickupText('+1 Liha, +1 Nahka');
    }
    if (this.audioManager) this.audioManager.playHit();
  }

  // ==========================================
  // JOEN UIVAT KALAT (SWIMMING RIVER FISH)
  // ==========================================
  _createRiverFish(x, z, index) {
    const group = new THREE.Group();
    const fishMat = new THREE.MeshStandardMaterial({
      color: 0x3a7d99,
      roughness: 0.25,
      metalness: 0.6
    });

    const bodyGeo = new THREE.SphereGeometry(0.18, 8, 6);
    bodyGeo.scale(0.4, 0.6, 1.5);
    const body = new THREE.Mesh(bodyGeo, fishMat);
    group.add(body);

    // Tail fin
    const tailGeo = new THREE.ConeGeometry(0.12, 0.25, 3);
    tailGeo.rotateX(Math.PI / 2);
    const tail = new THREE.Mesh(tailGeo, fishMat);
    tail.position.z = -0.32;
    group.add(tail);

    const waterY = -0.85 + Math.random() * 0.3;
    group.position.set(x, waterY, z);
    group.scale.set(0.85, 0.85, 0.85);
    this.scene.add(group);

    this.fishSchools.push({
      mesh: group,
      tail,
      waterY,
      baseZ: z,
      swimAngle: Math.random() * Math.PI * 2,
      swimSpeed: 0.9 + Math.random() * 0.7,
      wiggleTime: Math.random() * 10
    });
  }

  update(delta, playerPos) {
    // 1. Update Stags / Deer
    for (const deer of this.deers) {
      if (!deer.isAlive) continue;
      deer.animTime += delta;

      const distToPlayer = deer.mesh.position.distanceTo(playerPos);

      // Flee from player if within 11 meters
      if (distToPlayer < 11.0 || deer.fleeTimer > 0) {
        deer.state = 'flee';
        deer.fleeTimer = Math.max(0, deer.fleeTimer - delta);

        const fleeDir = this._fleeDirection.subVectors(deer.mesh.position, playerPos);
        fleeDir.y = 0;
        if (fleeDir.lengthSq() > 0.001) {
          fleeDir.normalize();
          deer.mesh.lookAt(deer.mesh.position.x + fleeDir.x, deer.mesh.position.y, deer.mesh.position.z + fleeDir.z);
          deer.mesh.position.addScaledVector(fleeDir, 7.5 * delta);

          // Gallop leg animation
          const legSwing = Math.sin(deer.animTime * 14) * 0.45;
          deer.legs[0].rotation.x = legSwing;
          deer.legs[1].rotation.x = -legSwing;
          deer.legs[2].rotation.x = -legSwing;
          deer.legs[3].rotation.x = legSwing;
        }
      } else {
        // Peaceful graze / wander
        deer.wanderTimer -= delta;
        if (deer.wanderTimer <= 0) {
          deer.wanderTimer = 3 + Math.random() * 5;
          deer.state = Math.random() < 0.4 ? 'graze' : 'walk';
          const rx = deer.mesh.position.x + (Math.random() * 16 - 8);
          const rz = deer.mesh.position.z + (Math.random() * 16 - 8);
          deer.wanderTarget.set(rx, 0, rz);
        }

        if (deer.state === 'walk') {
          const dir = this._animalDirection.subVectors(deer.wanderTarget, deer.mesh.position);
          dir.y = 0;
          if (dir.length() > 0.5) {
            dir.normalize();
            deer.mesh.lookAt(deer.wanderTarget.x, deer.mesh.position.y, deer.wanderTarget.z);
            deer.mesh.position.addScaledVector(dir, 1.8 * delta);

            const legSwing = Math.sin(deer.animTime * 5) * 0.3;
            deer.legs[0].rotation.x = legSwing;
            deer.legs[1].rotation.x = -legSwing;
            deer.legs[2].rotation.x = -legSwing;
            deer.legs[3].rotation.x = legSwing;
          }
          deer.headGroup.rotation.x = Math.sin(deer.animTime * 2) * 0.08;
        } else {
          // Graze head dipped down to ground
          deer.headGroup.rotation.x = 0.5 + Math.sin(deer.animTime * 1.5) * 0.12;
          deer.legs.forEach(l => l.rotation.x = 0);
        }
      }

      const gy = this.world.getGroundHeight(deer.mesh.position.x, deer.mesh.position.z);
      deer.mesh.position.y = gy;
    }

    // 2. Update Woodland Hares
    for (const rabbit of this.rabbits) {
      if (!rabbit.isAlive) continue;
      rabbit.hopTime += delta * 6;

      const dist = rabbit.mesh.position.distanceTo(playerPos);
      const isScared = dist < 8.0;

      rabbit.wanderTimer -= delta;
      if (rabbit.wanderTimer <= 0) {
        rabbit.wanderTimer = 2 + Math.random() * 3;
        const rx = rabbit.mesh.position.x + (Math.random() * 10 - 5);
        const rz = rabbit.mesh.position.z + (Math.random() * 10 - 5);
        rabbit.wanderTarget.set(rx, 0, rz);
      }

      const dir = isScared
        ? new THREE.Vector3().subVectors(rabbit.mesh.position, playerPos)
        : new THREE.Vector3().subVectors(rabbit.wanderTarget, rabbit.mesh.position);
      dir.y = 0;

      if (dir.lengthSq() > 0.1) {
        dir.normalize();
        rabbit.mesh.lookAt(rabbit.mesh.position.x + dir.x, rabbit.mesh.position.y, rabbit.mesh.position.z + dir.z);
        const speed = isScared ? 5.5 : 2.0;
        rabbit.mesh.position.addScaledVector(dir, speed * delta);

        // Bouncy hopping physics
        const hopY = Math.abs(Math.sin(rabbit.hopTime)) * (isScared ? 0.4 : 0.22);
        const gy = this.world.getGroundHeight(rabbit.mesh.position.x, rabbit.mesh.position.z);
        rabbit.mesh.position.y = gy + hopY;
      }
    }
  }

  getAnimals() {
    return [...this.deers, ...this.rabbits];
  }
}
