import * as THREE from 'three';

export default class FarmingSystem {
  constructor(scene, world, inventory, hud, audioManager) {
    this.scene = scene;
    this.world = world;
    this.inventory = inventory;
    this.hud = hud;
    this.audioManager = audioManager;

    this.farmlands = []; // Array of { mesh, x, z, crop: { type, stage, timer, maxStage, cropMesh } }
    this.raycaster = new THREE.Raycaster();
    this.screenCenter = new THREE.Vector2(0, 0);

    // Shared soil geometry & dark earth material
    this.soilGeo = new THREE.BoxGeometry(1.8, 0.12, 1.8);
    this.soilMat = new THREE.MeshStandardMaterial({
      color: 0x3d2714,
      roughness: 0.95,
      metalness: 0.05
    });

    this.init();
  }

  init() {
    // Listen for interact key [E] for planting / harvesting
    window.addEventListener('keydown', (e) => {
      if (e.key === 'e' || e.key === 'E') {
        this.interactClosestPlot();
      }
    });
  }

  // Called when using Rake on ground
  tillGround(x, z) {
    // Check if plot already exists nearby
    for (const plot of this.farmlands) {
      if (Math.hypot(plot.x - x, plot.z - z) < 1.6) {
        if (this.hud) this.hud.showNotification('⚠️ Maa on jo muokattu pelloksi tässä!');
        return false;
      }
    }

    const groundY = this.world ? this.world.getGroundHeight(x, z) : 0;
    const mesh = new THREE.Mesh(this.soilGeo, this.soilMat);
    mesh.position.set(x, groundY + 0.06, z);
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    const plot = {
      mesh,
      x,
      z,
      crop: null
    };
    this.farmlands.push(plot);

    if (this.audioManager && this.audioManager.playHarvest) {
      this.audioManager.playHarvest('bush');
    }
    if (this.hud) {
      this.hud.showNotification('🌾 Muokkasit peltomaata! Paina [E] istuttaaksesi siemeniä.');
    }
    return true;
  }

  interactClosestPlot() {
    if (!this.player) return;
    const pPos = this.player.getPosition ? this.player.getPosition() : this.player.playerPos;
    if (!pPos) return;

    let closest = null;
    let minDist = 2.4;
    for (const plot of this.farmlands) {
      const d = Math.hypot(plot.x - pPos.x, plot.z - pPos.z);
      if (d < minDist) {
        minDist = d;
        closest = plot;
      }
    }

    if (!closest) return;

    // If plot has ready crop -> Harvest
    if (closest.crop) {
      if (closest.crop.stage >= 3) {
        this.harvestCrop(closest);
      } else {
        if (this.hud) {
          const names = { potato: 'Peruna', carrot: 'Porkkana', wheat: 'Vilja' };
          const cropName = names[closest.crop.type] || closest.crop.type;
          this.hud.showNotification(`🌱 ${cropName} kasvaa vielä... (Vaihe ${closest.crop.stage}/3)`);
        }
      }
      return;
    }

    // If plot is empty -> Plant seed from inventory
    if (this.inventory) {
      let seedToPlant = null;
      if (this.inventory.has('potato_seed', 1)) seedToPlant = 'potato';
      else if (this.inventory.has('carrot_seed', 1)) seedToPlant = 'carrot';
      else if (this.inventory.has('wheat_seed', 1)) seedToPlant = 'wheat';

      if (seedToPlant) {
        this.inventory.remove(`${seedToPlant}_seed`, 1);
        this.plantCrop(closest, seedToPlant);
      } else {
        if (this.hud) this.hud.showNotification('⚠️ Sinulla ei ole siemeniä (peruna, porkkana, vilja)! Löydät niitä marjapensaista.');
      }
    }
  }

  plantCrop(plot, type) {
    const cropGroup = new THREE.Group();
    cropGroup.position.set(plot.x, plot.mesh.position.y + 0.05, plot.z);

    // Initial sprout mesh
    const sproutGeo = new THREE.CylinderGeometry(0.02, 0.04, 0.25, 6);
    const sproutMat = new THREE.MeshStandardMaterial({ color: 0x55aa22 });
    const sprout = new THREE.Mesh(sproutGeo, sproutMat);
    sprout.position.y = 0.12;
    cropGroup.add(sprout);

    this.scene.add(cropGroup);

    plot.crop = {
      type,
      stage: 1,
      timer: 0,
      growTime: 12.0, // 12 seconds per stage
      cropMesh: cropGroup
    };

    if (this.hud) {
      const names = { potato: 'Perunan', carrot: 'Porkkanan', wheat: 'Viljan' };
      this.hud.showNotification(`🌱 Kylvit ${names[type] || type} siemenen!`);
    }
  }

  harvestCrop(plot) {
    if (!plot.crop) return;
    const type = plot.crop.type;

    // Remove 3D crop mesh
    if (plot.crop.cropMesh) {
      this.scene.remove(plot.crop.cropMesh);
    }
    plot.crop = null;

    // Yield items + chance to yield seeds back
    if (this.inventory) {
      const yieldQty = Math.floor(Math.random() * 2) + 2; // 2-3
      this.inventory.add(type, yieldQty);
      this.inventory.add(`${type}_seed`, 1); // 1 seed back

      const names = { potato: '🥔 Perunoita', carrot: '🥕 Porkkanoita', wheat: '🌾 Viljaa' };
      if (this.hud) {
        this.hud.showPickupText(`+${yieldQty} ${names[type] || type}! (+1 🌱 Siemen)`);
      }
    }

    if (this.audioManager && this.audioManager.playHarvest) {
      this.audioManager.playHarvest('bush');
    }
  }

  update(delta) {
    // Grow crops over time
    for (const plot of this.farmlands) {
      if (!plot.crop || plot.crop.stage >= 3) continue;

      plot.crop.timer += delta;
      if (plot.crop.timer >= plot.crop.growTime) {
        plot.crop.timer = 0;
        plot.crop.stage++;
        this.updateCropVisual(plot);
      }
    }
  }

  updateCropVisual(plot) {
    if (!plot.crop || !plot.crop.cropMesh) return;
    const grp = plot.crop.cropMesh;
    // Clear old children
    while (grp.children.length > 0) {
      grp.remove(grp.children[0]);
    }

    const stage = plot.crop.stage;
    const type = plot.crop.type;

    if (stage === 2) {
      // Half-grown plant
      const stemGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.5, 6);
      const stemMat = new THREE.MeshStandardMaterial({ color: 0x44bb22 });
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.y = 0.25;
      grp.add(stem);
    } else if (stage === 3) {
      // Fully grown ready-to-harvest plant!
      const stemGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.75, 6);
      const stemMat = new THREE.MeshStandardMaterial({
        color: type === 'wheat' ? 0xd4ac0d : (type === 'carrot' ? 0x27ae60 : 0x229954)
      });
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.y = 0.35;
      grp.add(stem);

      // Top fruit/head
      let fruitColor = 0xe67e22; // carrot
      if (type === 'potato') fruitColor = 0xa07855;
      if (type === 'wheat') fruitColor = 0xf1c40f;

      const fruitGeo = new THREE.SphereGeometry(0.18, 8, 8);
      const fruitMat = new THREE.MeshStandardMaterial({ color: fruitColor });
      const fruit = new THREE.Mesh(fruitGeo, fruitMat);
      fruit.position.y = 0.75;
      grp.add(fruit);
    }
  }
}
