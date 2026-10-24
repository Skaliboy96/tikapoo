import * as THREE from 'three';

/**
 * DevMode – Developer & Creative Mode
 * Protected by password ("kissa").
 * Provides:
 * - Noclip freecam flying across the world (WASD + Space/Shift + mouse)
 * - Game simulation pause/freeze toggle while editing
 * - Raycast object selection, inspection, moving, and deletion ([Delete] key)
 * - Quick object spawn tools (trees, rocks, chests, workbenches, enemies)
 * - Biome & boss teleportation
 * - Godmode and item cheats
 */
export default class DevMode {
  constructor(scene, camera, player, world, enemyManager, animalManager, bossManager, buildingSystem, inventory, hud) {
    this.scene = scene;
    this.camera = camera;
    this.player = player;
    this.world = world;
    this.enemyManager = enemyManager;
    this.animalManager = animalManager;
    this.bossManager = bossManager;
    this.buildingSystem = buildingSystem;
    this.inventory = inventory;
    this.hud = hud;

    this.isUnlocked = false;
    this.isActive = false;
    this.isSimulationFrozen = true;
    this.isNoclip = true;
    this.flySpeedMultiplier = 3.0; // 3x default
    this.baseSpeed = 16.0;

    this.keys = { forward: false, backward: false, left: false, right: false, up: false, down: false };
    this.selectedObject = null;
    this.selectedTargetData = null;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // DOM Elements
    this.panelEl = document.getElementById('dev-mode-panel');
    this.passwordModal = document.getElementById('dev-password-modal');
    this.passwordInput = document.getElementById('dev-password-input');
    this.passwordError = document.getElementById('dev-pw-error');
    this.inspectorCard = document.getElementById('dev-inspector');
    this.inspTitle = document.getElementById('dev-insp-title');
    this.inspType = document.getElementById('dev-insp-type');
    this.inspPos = document.getElementById('dev-insp-pos');

    this._setupUI();
    this._setupControls();
  }

  _setupUI() {
    // Password Modal Handlers
    document.getElementById('dev-pw-submit-btn')?.addEventListener('click', () => this.verifyPassword());
    document.getElementById('dev-password-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.verifyPassword();
    });
    document.getElementById('dev-pw-close-btn')?.addEventListener('click', () => {
      if (this.passwordModal) this.passwordModal.style.display = 'none';
    });

    // Pause menu dev button
    document.getElementById('pause-dev-btn')?.addEventListener('click', () => {
      const pauseMenu = document.getElementById('pause-menu');
      if (pauseMenu) pauseMenu.style.display = 'none';
      this.promptPassword();
    });

    // Toolbar Controls
    const pauseToggle = document.getElementById('dev-pause-toggle');
    pauseToggle?.addEventListener('click', () => {
      this.isSimulationFrozen = !this.isSimulationFrozen;
      pauseToggle.classList.toggle('active', this.isSimulationFrozen);
      pauseToggle.textContent = this.isSimulationFrozen ? '⏸️ Simulaatio: PYSÄYTETTY' : '▶️ Simulaatio: KÄYNNISSÄ';
    });

    const flyToggle = document.getElementById('dev-fly-toggle');
    flyToggle?.addEventListener('click', () => {
      this.isNoclip = !this.isNoclip;
      flyToggle.classList.toggle('active', this.isNoclip);
      flyToggle.textContent = this.isNoclip ? '🕊️ Vapaa Lento: PÄÄLLÄ' : '🚶 Vapaa Lento: POIS';
    });

    // Speed buttons
    document.querySelectorAll('.dev-speed-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.dev-speed-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.flySpeedMultiplier = parseFloat(btn.dataset.speed) || 3.0;
      });
    });

    // Godmode
    const godBtn = document.getElementById('dev-godmode-btn');
    godBtn?.addEventListener('click', () => {
      this.player.isGodmode = !this.player.isGodmode;
      godBtn.classList.toggle('active', this.player.isGodmode);
      godBtn.textContent = this.player.isGodmode ? '🛡️ Kuolemattomuus: PÄÄLLÄ' : '🛡️ Kuolemattomuus: POIS';
    });

    // Give 999 items
    document.getElementById('dev-give-items-btn')?.addEventListener('click', () => {
      if (this.inventory) {
        const items = ['wood', 'stone', 'resin', 'copperOre', 'tinOre', 'bronze', 'ironOre', 'iron', 'silverOre', 'silver', 'blackMetalScrap', 'meat', 'cookedMeat', 'leather'];
        items.forEach(it => this.inventory.add(it, 999));
        if (this.hud) this.hud.showNotification('🎒 Kaikki materiaalit x999 lisätty reppuun!', 2500);
      }
    });

    // Exit Dev Mode
    document.getElementById('dev-close-btn')?.addEventListener('click', () => this.exit());

    // Object Deletion
    document.getElementById('dev-delete-obj-btn')?.addEventListener('click', () => this.deleteSelectedObject());
    document.getElementById('dev-tp-to-obj-btn')?.addEventListener('click', () => this.teleportToSelected());

    // Spawn Buttons
    document.querySelectorAll('.dev-spawn-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.spawn;
        this.spawnObjectAtCrosshair(type);
      });
    });

    // Teleport Buttons
    document.querySelectorAll('.dev-tp-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const x = parseFloat(btn.dataset.x) || 0;
        const z = parseFloat(btn.dataset.z) || 0;
        this.teleportPlayerTo(x, z);
      });
    });
  }

  _setupControls() {
    window.addEventListener('keydown', (e) => {
      // Toggle Dev mode prompt on F1
      if (e.code === 'F1') {
        e.preventDefault();
        if (this.isActive) {
          this.exit();
        } else {
          this.promptPassword();
        }
        return;
      }

      if (!this.isActive) return;

      // Escape exits dev mode
      if (e.code === 'Escape') {
        this.exit();
        return;
      }

      // Delete key deletes selected object
      if (e.code === 'Delete' && this.selectedObject) {
        this.deleteSelectedObject();
        return;
      }

      // Noclip Flight Controls (WASD + Space/Shift)
      switch (e.code) {
        case 'KeyW': this.keys.forward = true; break;
        case 'KeyS': this.keys.backward = true; break;
        case 'KeyA': this.keys.left = true; break;
        case 'KeyD': this.keys.right = true; break;
        case 'Space': this.keys.up = true; break;
        case 'ShiftLeft':
        case 'ShiftRight': this.keys.down = true; break;
      }
    });

    window.addEventListener('keyup', (e) => {
      if (!this.isActive) return;
      switch (e.code) {
        case 'KeyW': this.keys.forward = false; break;
        case 'KeyS': this.keys.backward = false; break;
        case 'KeyA': this.keys.left = false; break;
        case 'KeyD': this.keys.right = false; break;
        case 'Space': this.keys.up = false; break;
        case 'ShiftLeft':
        case 'ShiftRight': this.keys.down = false; break;
      }
    });

    // Mouse click selection in Dev Mode
    window.addEventListener('click', (e) => {
      if (!this.isActive) return;
      // Ignore click if clicking toolbar or modals
      if (e.target.closest('.dev-toolbar') || e.target.closest('.dev-bottom-drawer') || e.target.closest('.dev-inspector-card') || e.target.closest('.menu-modal')) {
        return;
      }

      this.selectObjectUnderMouse(e);
    });
  }

  promptPassword() {
    if (this.isUnlocked) {
      this.enter();
      return;
    }
    if (this.passwordModal) {
      this.passwordModal.style.display = 'flex';
      if (this.passwordInput) {
        this.passwordInput.value = '';
        this.passwordInput.focus();
      }
      if (this.passwordError) this.passwordError.style.display = 'none';
    }
  }

  verifyPassword() {
    if (!this.passwordInput) return;
    const val = this.passwordInput.value.trim().toLowerCase();
    if (val === 'kissa') {
      this.isUnlocked = true;
      if (this.passwordModal) this.passwordModal.style.display = 'none';
      this.enter();
    } else {
      if (this.passwordError) this.passwordError.style.display = 'block';
    }
  }

  enter() {
    this.isActive = true;
    if (this.panelEl) this.panelEl.style.display = 'flex';
    if (this.player && this.player.controls) {
      this.player.controls.unlock();
    }
    if (this.hud) {
      this.hud.showNotification('🛠️ Kehittäjätila aktivoitu! [WASD + Space/Shift] lennä, klikkaa kohteita muokataksesi.', 4000);
    }
  }

  exit() {
    this.isActive = false;
    this.keys = { forward: false, backward: false, left: false, right: false, up: false, down: false };
    if (this.panelEl) this.panelEl.style.display = 'none';
    if (this.inspectorCard) this.inspectorCard.style.display = 'none';
    this.deselectObject();

    // Snap player position to camera position if noclip moved far away
    if (this.player && this.camera) {
      const p = this.camera.position;
      const gh = this.world ? this.world.getGroundHeight(p.x, p.z) : 0;
      this.player.playerPos.set(p.x, Math.max(gh, p.y - 1.5), p.z);
    }

    if (this.hud) {
      this.hud.showNotification('Poistuttu kehittäjätilasta.', 2000);
    }
  }

  selectObjectUnderMouse(e) {
    const mouse = new THREE.Vector2(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1
    );

    this.raycaster.setFromCamera(mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);

    if (intersects.length > 0) {
      // Find top root group under scene
      let hitObj = intersects[0].object;
      if (hitObj === this.world?.terrainMesh || hitObj === this.world?.waterMesh) {
        this.deselectObject();
        return;
      }

      while (hitObj.parent && hitObj.parent !== this.scene) {
        hitObj = hitObj.parent;
      }

      this.selectObject(hitObj);
    } else {
      this.deselectObject();
    }
  }

  selectObject(obj) {
    this.deselectObject();
    this.selectedObject = obj;

    // Identify object
    let typeName = 'Objekti (Scene Object)';
    if (this.world?.trees.some(t => t.mesh === obj)) typeName = 'Puu (Tree)';
    else if (this.world?.stones.some(s => s.mesh === obj)) typeName = 'Kivi (Boulder)';
    else if (this.buildingSystem?.structures?.some(s => s.mesh === obj)) typeName = 'Rakenne (Building)';
    else if (this.enemyManager?.enemies?.some(e => e.mesh === obj)) typeName = 'Vihollinen (Enemy)';
    else if (this.animalManager?.animals?.some(a => a.mesh === obj)) typeName = 'Eläin (Animal)';
    else if (this.bossManager?.bosses?.some(b => b.mesh === obj)) typeName = '🔥 Pomo (Boss)';

    if (this.inspectorCard) {
      this.inspectorCard.style.display = 'block';
      if (this.inspTitle) this.inspTitle.textContent = obj.name || 'World Entity';
      if (this.inspType) this.inspType.textContent = typeName;
      if (this.inspPos) {
        const p = obj.position;
        this.inspPos.textContent = `X: ${p.x.toFixed(1)}, Y: ${p.y.toFixed(1)}, Z: ${p.z.toFixed(1)}`;
      }
    }
  }

  deselectObject() {
    this.selectedObject = null;
    if (this.inspectorCard) this.inspectorCard.style.display = 'none';
  }

  deleteSelectedObject() {
    if (!this.selectedObject) return;
    const obj = this.selectedObject;

    // Remove from world tree list
    if (this.world?.trees) {
      this.world.trees = this.world.trees.filter(t => t.mesh !== obj);
    }
    // Remove from world stones
    if (this.world?.stones) {
      this.world.stones = this.world.stones.filter(s => s.mesh !== obj);
    }
    // Remove from building structures
    if (this.buildingSystem?.structures) {
      this.buildingSystem.structures = this.buildingSystem.structures.filter(s => s.mesh !== obj);
    }
    // Remove from enemies
    if (this.enemyManager?.enemies) {
      this.enemyManager.enemies = this.enemyManager.enemies.filter(e => e.mesh !== obj);
    }
    // Remove from animals
    if (this.animalManager?.animals) {
      this.animalManager.animals = this.animalManager.animals.filter(a => a.mesh !== obj);
    }

    // Remove from Three.js scene
    this.scene.remove(obj);
    this.deselectObject();

    if (this.hud) this.hud.showNotification('🗑️ Kohde poistettu maailmasta!', 2000);
  }

  teleportToSelected() {
    if (!this.selectedObject) return;
    const p = this.selectedObject.position;
    this.camera.position.set(p.x, p.y + 4.0, p.z + 5.0);
    this.camera.lookAt(p);
  }

  teleportPlayerTo(x, z) {
    const y = (this.world ? this.world.getGroundHeight(x, z) : 0) + 1.5;
    this.camera.position.set(x, y + 2.5, z);
    if (this.player) {
      this.player.playerPos.set(x, y, z);
    }
    if (this.hud) this.hud.showNotification(`📍 Teleportoitu: X=${x}, Z=${z}`);
  }

  spawnObjectAtCrosshair(type) {
    // Raycast center of screen onto ground
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const intersects = this.raycaster.intersectObject(this.world.terrainMesh);

    let spawnPos = new THREE.Vector3();
    if (intersects.length > 0) {
      spawnPos.copy(intersects[0].point);
    } else {
      const fwd = new THREE.Vector3();
      this.camera.getWorldDirection(fwd);
      spawnPos.copy(this.camera.position).addScaledVector(fwd, 8.0);
      spawnPos.y = this.world ? this.world.getGroundHeight(spawnPos.x, spawnPos.z) : 0;
    }

    switch (type) {
      case 'tree_birch':
      case 'tree_pine':
        if (this.world) this.world.spawnTree(spawnPos.x, spawnPos.z);
        break;
      case 'rock':
        if (this.world) this.world.spawnStone(spawnPos.x, spawnPos.z);
        break;
      case 'chest':
        if (this.world && this.world.spawnWildChest) {
          this.world.spawnWildChest(spawnPos.x, spawnPos.z);
        }
        break;
      case 'workbench':
        if (this.buildingSystem) this.buildingSystem.placeStructure('workbench', spawnPos, 0);
        break;
      case 'campfire':
        if (this.buildingSystem) this.buildingSystem.placeStructure('campfire', spawnPos, 0);
        break;
      case 'boar':
        if (this.enemyManager) this.enemyManager.spawnAt(spawnPos.x, spawnPos.z, 'meadows');
        break;
      case 'skeleton':
        if (this.enemyManager) this.enemyManager.spawnAt(spawnPos.x, spawnPos.z, 'blackForest');
        break;
    }

    if (this.hud) this.hud.showNotification(`✨ Luotu: ${type} sijaintiin (${Math.round(spawnPos.x)}, ${Math.round(spawnPos.z)})`);
  }

  update(delta) {
    if (!this.isActive || !this.isNoclip) return;

    // Camera free-flying movement
    const speed = this.baseSpeed * this.flySpeedMultiplier * delta;
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);

    const right = new THREE.Vector3().crossVectors(forward, this.camera.up).normalize();

    if (this.keys.forward) this.camera.position.addScaledVector(forward, speed);
    if (this.keys.backward) this.camera.position.addScaledVector(forward, -speed);
    if (this.keys.right) this.camera.position.addScaledVector(right, speed);
    if (this.keys.left) this.camera.position.addScaledVector(right, -speed);
    if (this.keys.up) this.camera.position.y += speed;
    if (this.keys.down) this.camera.position.y -= speed;
  }
}
