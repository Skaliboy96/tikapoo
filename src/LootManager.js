import * as THREE from 'three';

/**
 * LootManager – Handles physical 3D ground loot drops from defeated enemies.
 * Drops bob, rotate, emit glowing light, and magnetically pull into the player
 * when within proximity, triggering pickup sounds, HUD float text, and inventory addition.
 */
export default class LootManager {
  constructor(scene, world, inventory, hud, audioManager, questManager, assetLoader = null) {
    this.scene = scene;
    this.world = world;
    this.inventory = inventory;
    this.hud = hud;
    this.audioManager = audioManager;
    this.questManager = questManager;
    this.assetLoader = assetLoader;

    this.drops = [];
    this.pickupRadius = 3.2;
    this.magnetRadius = 6.0;
    this.magnetSpeed = 12.0;

    // Item definitions with display names, emojis, and colors
    this.lootTable = {
      meat: {
        name: 'Raaka petoliha',
        icon: '🥩',
        color: 0xc0392b,
        emissive: 0x551111,
        weight: 1.0
      },
      leather: {
        name: 'Petohirren nahka',
        icon: '🥋',
        color: 0x8d6e63,
        emissive: 0x3e2723,
        weight: 1.0
      },
      fang: {
        name: 'Terävä petohammas',
        icon: '🦷',
        color: 0xf5f5f5,
        emissive: 0x888866,
        weight: 0.8
      },
      bronze: {
        name: 'Pronssiromu',
        icon: '🪙',
        color: 0xd4af37,
        emissive: 0x664411,
        weight: 0.6
      },
      bone: {
        name: 'Kirottu luu',
        icon: '🦴',
        color: 0xddddcf,
        emissive: 0x444433,
        weight: 0.7
      },
      shadow_essence: {
        name: 'Varjoesanssi',
        icon: '🔮',
        color: 0x9b59b6,
        emissive: 0x6c3483,
        weight: 0.4
      },
      wood: { name: 'Puu', icon: '🪵', color: 0x85532a, emissive: 0x2e1a0d, weight: 1.0 },
      stone: { name: 'Kivi', icon: '🪨', color: 0x7f8c8d, emissive: 0x2c3e50, weight: 1.0 },
      resin: { name: 'Havupuu-hartsi', icon: '🌲', color: 0xf39c12, emissive: 0xd35400, weight: 1.0 },
      copperOre: { name: 'Kuparimalmi', icon: '🥉', color: 0xd35400, emissive: 0xba4a00, weight: 0.8 },
      ironOre: { name: 'Rautamalmi', icon: '🪨', color: 0x5a4d41, emissive: 0x332820, weight: 0.8 },
      silverOre: { name: 'Hopeamalmi', icon: '❄️', color: 0xdfe6e9, emissive: 0x74b9ff, weight: 0.7 },
      blackMetalScrap: { name: 'Mustametallijäte', icon: '🔮', color: 0x1e272e, emissive: 0x575fcf, weight: 0.6 },
      flametalOre: { name: 'Tulimalmi', icon: '🌋', color: 0xe74c3c, emissive: 0xc0392b, weight: 0.6 },
      dragonSteel: { name: 'Lohikäärmeteräs', icon: '👑', color: 0xf1c40f, emissive: 0x9b59b6, weight: 0.5 },
      slime: { name: 'Suoliejua', icon: '🧪', color: 0x2ecc71, emissive: 0x27ae60, weight: 0.8 },
      wolfPelt: { name: 'Sudentalja', icon: '🐺', color: 0xbdc3c7, emissive: 0x7f8c8d, weight: 0.8 },
      hardAntler: { name: 'Kova Sarvi', icon: '🔱', color: 0xf1c40f, emissive: 0xd4ac0d, weight: 0.5 },
      swampKey: { name: 'Suoavain', icon: '🗝️', color: 0x00cec9, emissive: 0x0984e3, weight: 0.5 },
      wishbone: { name: 'Maan Sydän', icon: '🦴', color: 0x0984e3, emissive: 0x6c5ce7, weight: 0.5 },
      artisanCore: { name: 'Riimumestarin Kide', icon: '💠', color: 0xa29bfe, emissive: 0x6c5ce7, weight: 0.5 },
      dragonTears: { name: 'Varjokyynel', icon: '💧', color: 0x74b9ff, emissive: 0x0984e3, weight: 0.5 }
    };
  }

  /**
   * Spawns physical 3D loot drops at a given world position
   */
  spawnLoot(pos, enemyType = 'walker', isNight = false, customDrops = null) {
    const dropsToCreate = [];

    if (customDrops && Object.keys(customDrops).length > 0) {
      for (const [mat, count] of Object.entries(customDrops)) {
        if (count > 0) {
          dropsToCreate.push({ type: mat, count });
        }
      }
    } else {
      // Always drops meat
      dropsToCreate.push({ type: 'meat', count: Math.floor(Math.random() * 2) + 1 });

      // 70% chance of leather hide
      if (Math.random() < 0.75) {
        dropsToCreate.push({ type: 'leather', count: Math.floor(Math.random() * 2) + 1 });
      }

      // 50% chance of fangs
      if (Math.random() < 0.5) {
        dropsToCreate.push({ type: 'fang', count: 1 });
      }

      // Corrupted warrior drops bronze scrap & bones
      if (enemyType === 'warrior') {
        dropsToCreate.push({ type: 'bronze', count: Math.floor(Math.random() * 3) + 1 });
        dropsToCreate.push({ type: 'bone', count: Math.floor(Math.random() * 2) + 1 });
      } else {
        if (Math.random() < 0.6) {
          dropsToCreate.push({ type: 'bone', count: 1 });
        }
      }

      // Night beasts drop shadow essence!
      if (isNight || Math.random() < 0.35) {
        dropsToCreate.push({ type: 'shadow_essence', count: 1 });
      }
    }

    // Scatter drops slightly around death location
    dropsToCreate.forEach((drop, idx) => {
      const angle = (idx / dropsToCreate.length) * Math.PI * 2 + (Math.random() * 0.4);
      const dist = 0.6 + Math.random() * 0.8;
      const dropPos = new THREE.Vector3(
        pos.x + Math.cos(angle) * dist,
        pos.y + 0.2,
        pos.z + Math.sin(angle) * dist
      );
      this._createDropMesh(drop.type, drop.count, dropPos);
    });
  }

  _createDropMesh(itemType, count, pos) {
    const meta = this.lootTable[itemType] || { name: itemType, icon: '📦', color: 0xffffff, emissive: 0x222222 };
    const group = new THREE.Group();

    let mesh = null;

    if (itemType === 'meat') {
      // Organic steak slab
      const geo = new THREE.BoxGeometry(0.3, 0.12, 0.22);
      const mat = new THREE.MeshStandardMaterial({
        color: meta.color,
        roughness: 0.6,
        metalness: 0.1
      });
      mesh = new THREE.Mesh(geo, mat);
    } else if (itemType === 'fang') {
      // Curved ivory tooth
      const geo = new THREE.ConeGeometry(0.08, 0.35, 6);
      geo.rotateZ(0.3);
      const mat = new THREE.MeshStandardMaterial({
        color: meta.color,
        roughness: 0.3,
        metalness: 0.1
      });
      mesh = new THREE.Mesh(geo, mat);
    } else if (itemType === 'bronze') {
      // Bronze ingot bar
      const geo = new THREE.BoxGeometry(0.28, 0.1, 0.16);
      const mat = new THREE.MeshStandardMaterial({
        color: meta.color,
        roughness: 0.35,
        metalness: 0.85
      });
      mesh = new THREE.Mesh(geo, mat);
    } else if (itemType === 'bone') {
      // Skeletal bone
      const geo = new THREE.CylinderGeometry(0.04, 0.04, 0.38, 6);
      geo.rotateZ(Math.PI / 4);
      const mat = new THREE.MeshStandardMaterial({
        color: meta.color,
        roughness: 0.7,
        metalness: 0.05
      });
      mesh = new THREE.Mesh(geo, mat);
    } else if (itemType === 'shadow_essence') {
      // Pulsing magic crystal sphere
      const geo = new THREE.DodecahedronGeometry(0.2, 0);
      const mat = new THREE.MeshStandardMaterial({
        color: meta.color,
        emissive: meta.emissive,
        emissiveIntensity: 0.8,
        roughness: 0.15,
        metalness: 0.9
      });
      mesh = new THREE.Mesh(geo, mat);
    } else {
      // Leather hide roll
      const geo = new THREE.CylinderGeometry(0.09, 0.09, 0.32, 8);
      const mat = new THREE.MeshStandardMaterial({
        color: meta.color,
        roughness: 0.8,
        metalness: 0.05
      });
      mesh = new THREE.Mesh(geo, mat);
    }

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    // Glowing ground aura ring
    const ringGeo = new THREE.RingGeometry(0.25, 0.38, 16);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: meta.color,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = -0.22;
    group.add(ring);

    // Soft pointlight for rare drops
    if (itemType === 'shadow_essence' || itemType === 'bronze') {
      const pLight = new THREE.PointLight(meta.color, 1.2, 4.0);
      pLight.position.y = 0.2;
      group.add(pLight);
    }

    const groundY = this.world ? this.world.getGroundHeight(pos.x, pos.z) : pos.y;
    group.position.set(pos.x, groundY + 0.35, pos.z);

    this.scene.add(group);

    const drop = {
      group,
      mesh,
      ring,
      type: itemType,
      count,
      meta,
      baseY: groundY + 0.35,
      animTime: Math.random() * Math.PI * 2,
      isCollected: false
    };

    this.drops.push(drop);
  }

  update(delta, playerPos) {
    if (!playerPos) return;

    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      if (drop.isCollected) continue;

      drop.animTime += delta * 2.5;

      // Bobbing and rotating
      drop.mesh.rotation.y += delta * 1.8;
      drop.mesh.position.y = Math.sin(drop.animTime) * 0.08;
      drop.ring.rotation.z += delta * 0.8;

      const dist = drop.group.position.distanceTo(playerPos);

      // Magnetic pull when player is close
      if (dist <= this.magnetRadius) {
        const pullDir = new THREE.Vector3().subVectors(playerPos, drop.group.position).normalize();
        const speed = this.magnetSpeed * (1.0 - dist / this.magnetRadius + 0.4);
        drop.group.position.addScaledVector(pullDir, speed * delta);
      }

      // Pickup
      if (dist <= this.pickupRadius) {
        this._collectDrop(drop, i);
      }
    }
  }

  _collectDrop(drop, index) {
    drop.isCollected = true;
    this.scene.remove(drop.group);
    this.drops.splice(index, 1);

    if (this.inventory) {
      this.inventory.add(drop.type, drop.count);
    }

    if (this.hud) {
      this.hud.showPickupText(`+${drop.count} ${drop.meta.icon} ${drop.meta.name}`);
      this.hud.showNotification(`Kerätty: ${drop.meta.icon} ${drop.meta.name} (x${drop.count})`, 2500);
    }

    if (this.audioManager) {
      this.audioManager.playPickup();
    }

    if (this.questManager) {
      if (drop.type === 'meat' && this.questManager.onCollectMeat) {
        this.questManager.onCollectMeat(drop.count);
      }
    }
  }
}
