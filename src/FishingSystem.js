import * as THREE from 'three';

/**
 * FishingSystem – Responsive and satisfying River Fishing system:
 * - Equip fishing rod from hotbar [5]
 * - Crosshair prompt displays: "[Vasen hiiri] Heitä onki veteen"
 * - Left-click casts the bobber into the river with splash ripples and dynamic line
 * - In 2-4 seconds, water bubbles and alert: "⚡ TÄRPPI! KLIKKAA NOPEASTI!"
 * - Left-click reels in the catch with celebration chime and floating reward!
 */
export default class FishingSystem {
  constructor(scene, world, player, inventory, hud, audioManager, questManager) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.inventory = inventory;
    this.hud = hud;
    this.audioManager = audioManager;
    this.questManager = questManager;

    this.state = 'idle'; // 'idle', 'waiting', 'bite', 'reeling'
    this.biteTimer = 0;
    this.reactionTimer = 0;
    this.reactionWindow = 2.5; // Generous 2.5s bite window

    this.bobber = null;
    this.bobberPos = new THREE.Vector3();
    this.line = null;

    this.raycaster = new THREE.Raycaster();
    this.screenCenter = new THREE.Vector2(0, 0);

    this._initBobber();
  }

  _initBobber() {
    const group = new THREE.Group();

    // Red & white float
    const topGeo = new THREE.SphereGeometry(0.12, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const topMat = new THREE.MeshBasicMaterial({ color: 0xe74c3c });
    const top = new THREE.Mesh(topGeo, topMat);

    const botGeo = new THREE.SphereGeometry(0.12, 8, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    const botMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const bot = new THREE.Mesh(botGeo, botMat);

    group.add(top, bot);

    // Ripple ring
    const ringGeo = new THREE.RingGeometry(0.18, 0.35, 16);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x88d5ec,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = -0.05;
    group.add(ring);

    group.visible = false;
    this.scene.add(group);
    this.bobber = group;

    // Dynamic 3D fishing line
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0)
    ]);
    const lineMat = new THREE.LineBasicMaterial({ color: 0xeeeeee, transparent: true, opacity: 0.85 });
    this.line = new THREE.Line(lineGeo, lineMat);
    this.line.visible = false;
    this.scene.add(this.line);
  }

  onAction() {
    if (this.state === 'idle') {
      this.tryCast();
    } else if (this.state === 'bite') {
      this.catchFish();
    } else if (this.state === 'waiting') {
      this.hud?.showNotification('⚠️ Odota tärppiä ennen kelaamista!', 1500);
    }
  }

  tryCast() {
    let target = null;

    // 1. Raycast to water surface
    if (this.world && this.world.waterMesh) {
      this.raycaster.setFromCamera(this.screenCenter, this.player.camera);
      const hits = this.raycaster.intersectObject(this.world.waterMesh);
      if (hits.length > 0 && hits[0].distance < 38) {
        target = hits[0].point;
      }
    }

    // 2. Fallback forward in front of player
    if (!target) {
      const p = this.player.getPosition();
      const fwd = new THREE.Vector3();
      this.player.camera.getWorldDirection(fwd);
      fwd.y = 0;
      fwd.normalize();
      target = new THREE.Vector3(p.x + fwd.x * 9.0, -0.85, p.z + fwd.z * 9.0);
    }

    this.bobberPos.set(target.x, -0.85, target.z);
    this.bobber.position.copy(this.bobberPos);
    this.bobber.visible = true;
    this.line.visible = true;

    this.state = 'waiting';
    this.biteTimer = 2.0 + Math.random() * 2.5; // Bite in 2-4.5s

    this.audioManager?.playCastRod?.();
    setTimeout(() => this.audioManager?.playSplash?.(), 300);
    this.hud?.showNotification('🎣 Heitit ongen veteen! Odotetaan tärppiä...', 2500);
  }

  update(delta) {
    const isRodEquipped = this.inventory && this.inventory.equippedTool === 'fishingRod';

    if (!isRodEquipped) {
      if (this.state !== 'idle') {
        this.resetFishing();
      }
      return;
    }

    // Update crosshair interaction prompt
    if (this.state === 'idle') {
      this.hud?.showTooltip('🎣 [Vasen hiiri] Heitä onki veteen');
    } else if (this.state === 'waiting') {
      this.hud?.showTooltip('🎣 Odotetaan tärppiä... Ole valmiina!');
    } else if (this.state === 'bite') {
      this.hud?.showTooltip('⚡ TÄRPPI! KLIKKAA [VASEN HIIRI] NOPEASTI!');
    }

    if (this.state === 'idle') return;

    const time = performance.now() * 0.005;

    // Bobber bobs gently on river surface
    if (this.bobber && this.state !== 'bite') {
      this.bobber.position.y = this.bobberPos.y + Math.sin(time * 5) * 0.05;
    }

    // Update line from player's rod tip to bobber
    if (this.line && this.line.visible) {
      const pPos = this.player.getPosition();
      const rodTip = new THREE.Vector3(pPos.x + 0.35, pPos.y + 1.5, pPos.z + 0.4);
      const points = [rodTip, this.bobber.position];
      this.line.geometry.setFromPoints(points);
    }

    if (this.state === 'waiting') {
      this.biteTimer -= delta;
      if (this.biteTimer <= 0) {
        // BITE!
        this.state = 'bite';
        this.reactionTimer = this.reactionWindow;
        this.audioManager?.playFishBite?.();

        if (this.bobber) {
          this.bobber.position.y = this.bobberPos.y - 0.28;
        }

        this.hud?.showNotification('⚡ TÄRPPI! KLIKKAA [VASEN HIIRI] NOSTAISIT KALA!', 2500);
      }
    } else if (this.state === 'bite') {
      this.reactionTimer -= delta;

      // Shake bobber
      if (this.bobber) {
        this.bobber.position.y = this.bobberPos.y - 0.22 + (Math.random() - 0.5) * 0.12;
      }

      if (this.reactionTimer <= 0) {
        // Missed
        this.hud?.showNotification('💨 Kala karkasi koukusta! Heitä onki uudelleen.', 2500);
        this.resetFishing();
      }
    }
  }

  catchFish() {
    this.state = 'reeling';
    this.audioManager?.playReel?.();
    setTimeout(() => this.audioManager?.playFishCatch?.(), 160);

    const roll = Math.random();
    let catchItem = { key: 'trout', name: 'Purotaimen', icon: '🐟', count: 1 };

    if (roll < 0.55) {
      catchItem = { key: 'trout', name: 'Purotaimen (River Trout)', icon: '🐟', count: 1 };
    } else if (roll < 0.82) {
      catchItem = { key: 'pike', name: 'Jokihauki (River Pike)', icon: '🦈', count: 1 };
    } else if (roll < 0.96) {
      catchItem = { key: 'salmon', name: 'Kultainen Lohi (Golden Salmon)', icon: '🐠', count: 1 };
    } else {
      catchItem = { key: 'treasure', name: 'Muinaislipas (Sunken Chest)', icon: '📦', count: 1, bronze: 4, stone: 8 };
    }

    if (catchItem.key === 'treasure') {
      this.inventory?.add('bronze', catchItem.bronze);
      this.inventory?.add('stone', catchItem.stone);
      this.hud?.showNotification(`✨ Aarre nostettu joesta! (+${catchItem.bronze} Pronssia, +${catchItem.stone} Kiveä)`, 4000);
      this.hud?.showPickupText('📦 Muinaislipas nostettu!');
    } else {
      this.inventory?.add(catchItem.key, catchItem.count);
      this.hud?.showNotification(`🎣 SAALIS! Nappasit: ${catchItem.icon} ${catchItem.name}!`, 3500);
      this.hud?.showPickupText(`+1 ${catchItem.icon} ${catchItem.name}`);
    }

    if (this.questManager && this.questManager.onCatchFish) {
      this.questManager.onCatchFish();
    }
    if (this.achievementManager) {
      this.achievementManager.onFish(1);
    }

    this._spawnLeapingFish(this.bobberPos, this.player.getPosition());
    this.resetFishing();
  }

  _spawnLeapingFish(startPos, endPos) {
    const pGeo = new THREE.SphereGeometry(0.2, 6, 6);
    const pMat = new THREE.MeshBasicMaterial({ color: 0x48c9b0 });
    const fishMesh = new THREE.Mesh(pGeo, pMat);
    fishMesh.position.copy(startPos);
    this.scene.add(fishMesh);

    let progress = 0;
    const anim = () => {
      progress += 0.05;
      fishMesh.position.lerpVectors(startPos, endPos, progress);
      fishMesh.position.y += Math.sin(progress * Math.PI) * 2.8;

      if (progress < 1.0) {
        requestAnimationFrame(anim);
      } else {
        this.scene.remove(fishMesh);
      }
    };
    anim();
  }

  resetFishing() {
    this.state = 'idle';
    if (this.bobber) this.bobber.visible = false;
    if (this.line) this.line.visible = false;
    this.hud?.hideTooltip();
  }
}
