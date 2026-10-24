import * as THREE from 'three';

/**
 * DevMode – Developer & Creative World Editor
 * Protected by password ("kissa").
 * Provides:
 * - Freecam noclip flight (WASD + Space/Shift, RMB drag to steer/look)
 * - Game simulation pause/freeze toggle while editing
 * - Visual BoxHelper glowing selection & object inspector
 * - One-click Delete Tool mode (X key / toolbar button)
 * - Categorized ghost placement tool (Nature, Structures, Crafting, Furniture, Creatures)
 * - Persistent local editing (localStorage 'tikapoo_dev_world_edits')
 * - World reset and JSON export
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
    this.isPromptOpen = false;
    this.isActive = false;
    this.isSimulationFrozen = true;
    this.isNoclip = true;
    this.flySpeedMultiplier = 3.0; // 3x default
    this.baseSpeed = 16.0;

    this.isDeleteToolActive = false;
    this.activePlacement = null; // { type, modelName, displayName, category }
    this.placementGhost = null;
    this.placementRotation = 0;

    this.isRightMouseDown = false;
    this.prevMouseX = 0;
    this.prevMouseY = 0;
    this.cameraEuler = new THREE.Euler(0, 0, 0, 'YXZ');

    this.keys = { forward: false, backward: false, left: false, right: false, up: false, down: false };
    this.selectedObject = null;
    this.selectionBox = null;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Local Storage Edits
    this.storageKey = 'tikapoo_dev_world_edits';
    this.edits = this.loadEdits();

    // DOM Elements
    this.panelEl = document.getElementById('dev-mode-panel');
    this.passwordModal = document.getElementById('dev-password-modal');
    this.passwordInput = document.getElementById('dev-password-input');
    this.passwordError = document.getElementById('dev-pw-error');
    this.inspectorCard = document.getElementById('dev-inspector');
    this.inspTitle = document.getElementById('dev-insp-title');
    this.inspType = document.getElementById('dev-insp-type');
    this.inspPos = document.getElementById('dev-insp-pos');
    this.placementBanner = document.getElementById('dev-placement-banner');
    this.placementText = document.getElementById('dev-placement-text');
    this.exportModal = document.getElementById('dev-export-modal');
    this.exportTextarea = document.getElementById('dev-export-textarea');

    this._setupUI();
    this._setupControls();

    // Check if previously unlocked in this browser
    if (localStorage.getItem('tikapoo_dev_unlocked') === 'true') {
      this.isUnlocked = true;
    }

    // Apply any previously placed entities after world initialization
    setTimeout(() => {
      this.applySavedPlacements();
    }, 400);
  }

  loadEdits() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        const parsed = JSON.parse(data);
        return {
          deleted: Array.isArray(parsed.deleted) ? parsed.deleted : [],
          placed: Array.isArray(parsed.placed) ? parsed.placed : []
        };
      }
    } catch (e) {
      console.warn('Failed to load dev world edits:', e);
    }
    return { deleted: [], placed: [] };
  }

  saveEdits() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.edits));
      if (this.world) {
        this.world.deletedEdits = this.edits.deleted;
      }
      this.updateEditsBadge();
    } catch (e) {
      console.error('Failed to save dev world edits:', e);
    }
  }

  updateEditsBadge() {
    const totalEdits = (this.edits.deleted?.length || 0) + (this.edits.placed?.length || 0);
    const saveBtn = document.getElementById('dev-save-edits-btn');
    if (saveBtn) {
      saveBtn.textContent = `💾 Tallennettu (${totalEdits})`;
    }
  }

  applySavedPlacements() {
    if (!this.edits.placed || this.edits.placed.length === 0) return;
    let count = 0;
    this.edits.placed.forEach(item => {
      try {
        const pos = new THREE.Vector3(item.x, item.y, item.z);
        this.instantiateEntity(item.type, item.modelName, pos, item.rotY || 0, item.id);
        count++;
      } catch (err) {
        console.warn('Failed to place saved entity:', item, err);
      }
    });
    if (count > 0 && this.hud) {
      this.hud.showNotification(`🌲 Ladattu ${count} paikallista maailmanmuokkausta.`, 3000);
    }
    this.updateEditsBadge();
  }

  _setupUI() {
    // Password Modal Handlers
    document.getElementById('dev-pw-submit-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.verifyPassword();
    });

    this.passwordInput?.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        this.verifyPassword();
      } else if (e.key === 'Escape') {
        this.closePasswordPrompt();
      }
    });
    this.passwordInput?.addEventListener('keyup', (e) => e.stopPropagation());
    this.passwordInput?.addEventListener('keypress', (e) => e.stopPropagation());

    document.getElementById('dev-pw-close-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closePasswordPrompt();
    });

    this.passwordModal?.addEventListener('click', (e) => {
      if (e.target === this.passwordModal) {
        this.closePasswordPrompt();
      }
    });

    // Pause menu dev button
    document.getElementById('pause-dev-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const pauseMenu = document.getElementById('pause-menu');
      if (pauseMenu) {
        pauseMenu.classList.remove('active');
        pauseMenu.style.display = '';
      }
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

    // Delete tool toggle button
    const deleteToolBtn = document.getElementById('dev-delete-mode-btn');
    deleteToolBtn?.addEventListener('click', () => {
      this.toggleDeleteTool();
    });

    // Save button
    document.getElementById('dev-save-edits-btn')?.addEventListener('click', () => {
      this.saveEdits();
      if (this.hud) {
        const total = (this.edits.deleted?.length || 0) + (this.edits.placed?.length || 0);
        this.hud.showNotification(`💾 Kaikki ${total} muokkausta tallennettu selaimeen!`, 2500);
      }
    });

    // Reset world edits button
    document.getElementById('dev-reset-edits-btn')?.addEventListener('click', () => {
      const confirmReset = window.confirm('⚠️ Haluatko varmasti palauttaa maailman oletustilaan?\n\nTämä poistaa kaikki tekemäsi sijoitukset ja palauttaa poistetut puut ja kivet. Sivu ladataan uudelleen.');
      if (confirmReset) {
        localStorage.removeItem(this.storageKey);
        window.location.reload();
      }
    });

    // JSON export
    document.getElementById('dev-export-btn')?.addEventListener('click', () => {
      this.openExportModal();
    });
    document.getElementById('dev-export-close-btn')?.addEventListener('click', () => {
      if (this.exportModal) this.exportModal.style.display = 'none';
    });
    document.getElementById('dev-export-close-modal-btn')?.addEventListener('click', () => {
      if (this.exportModal) this.exportModal.style.display = 'none';
    });
    document.getElementById('dev-copy-json-btn')?.addEventListener('click', () => {
      if (this.exportTextarea) {
        this.exportTextarea.select();
        navigator.clipboard?.writeText(this.exportTextarea.value);
        if (this.hud) this.hud.showNotification('📋 JSON kopioitu leikepöydälle!', 2000);
      }
    });

    // Godmode
    const godBtn = document.getElementById('dev-godmode-btn');
    godBtn?.addEventListener('click', () => {
      this.player.isGodmode = !this.player.isGodmode;
      godBtn.classList.toggle('active', this.player.isGodmode);
      godBtn.textContent = this.player.isGodmode ? '🛡️ Kuolemattomuus: PÄÄLLÄ' : '🛡️ Kuolemattomuus: POIS';
    });

    // Give 999 items & unlock all tools
    document.getElementById('dev-give-items-btn')?.addEventListener('click', () => {
      if (this.inventory) {
        Object.keys(this.inventory.items).forEach(it => {
          this.inventory.items[it] = 999;
        });
        if (this.inventory.tools) {
          Object.keys(this.inventory.tools).forEach(tool => {
            this.inventory.tools[tool] = true;
          });
        }
        this.inventory.updateDisplay();
        if (this.buildingSystem?.hotbar) {
          this.buildingSystem.hotbar.sync();
        }
        if (this.hud) this.hud.showNotification('🎒 Kaikki materiaalit x999 ja kaikki työkalut/aseet avattu!', 2500);
      }
    });

    // Exit Dev Mode
    document.getElementById('dev-close-btn')?.addEventListener('click', () => this.exit());

    // Cancel placement button in banner
    document.getElementById('dev-cancel-placement-btn')?.addEventListener('click', () => {
      this.cancelPlacement();
    });

    // Inspector Actions
    document.getElementById('dev-delete-obj-btn')?.addEventListener('click', () => this.deleteSelectedObject());
    document.getElementById('dev-tp-to-obj-btn')?.addEventListener('click', () => this.teleportToSelected());
    document.getElementById('dev-insp-close-btn')?.addEventListener('click', () => this.deselectObject());

    // Category Tabs in Drawer
    document.querySelectorAll('.dev-category-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.dev-category-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.dev-palette-content').forEach(p => p.style.display = 'none');

        tab.classList.add('active');
        const cat = tab.dataset.category;
        const targetPalette = document.getElementById(`dev-palette-${cat}`);
        if (targetPalette) targetPalette.style.display = 'flex';
      });
    });

    // Palette Buttons (Click to enter placement mode)
    document.querySelectorAll('.dev-palette-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const type = btn.dataset.type;
        const model = btn.dataset.model || null;
        const name = btn.dataset.name || btn.textContent.trim();
        const category = btn.dataset.category || 'nature';
        this.startPlacement(type, model, name, category);
      });
    });

    // Teleport Buttons
    document.querySelectorAll('.dev-tp-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const x = parseFloat(btn.dataset.x) || 0;
        const z = parseFloat(btn.dataset.z) || 0;
        this.teleportPlayerTo(x, z);
      });
    });
  }

  _setupControls() {
    window.addEventListener('keydown', (e) => {
      // Toggle Dev mode on F1
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

      // Escape key behavior
      if (e.code === 'Escape') {
        if (this.activePlacement) {
          e.preventDefault();
          this.cancelPlacement();
          return;
        }
        if (this.isDeleteToolActive) {
          e.preventDefault();
          this.toggleDeleteTool(false);
          return;
        }
        if (this.selectedObject) {
          e.preventDefault();
          this.deselectObject();
          return;
        }
        e.preventDefault();
        this.exit();
        return;
      }

      // X key toggles Delete Tool
      if (e.code === 'KeyX' && !e.ctrlKey && !e.altKey) {
        if (!document.activeElement || document.activeElement.tagName !== 'INPUT') {
          this.toggleDeleteTool();
          return;
        }
      }

      // R key rotates placement ghost
      if (e.code === 'KeyR' && this.activePlacement) {
        this.placementRotation = (this.placementRotation + Math.PI / 4) % (Math.PI * 2);
        if (this.placementGhost) {
          this.placementGhost.rotation.y = this.placementRotation;
        }
        return;
      }

      // Delete or Backspace key deletes selected object
      if ((e.code === 'Delete' || e.code === 'Backspace') && this.selectedObject) {
        if (!document.activeElement || document.activeElement.tagName !== 'INPUT') {
          this.deleteSelectedObject();
          return;
        }
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

    // Right-mouse look & mouse movement in DevMode
    window.addEventListener('mousedown', (e) => {
      if (!this.isActive) return;
      if (e.button === 2) {
        this.isRightMouseDown = true;
        this.prevMouseX = e.clientX;
        this.prevMouseY = e.clientY;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (!this.isActive) return;
      if (e.button === 2) {
        this.isRightMouseDown = false;
      }
    });

    window.addEventListener('contextmenu', (e) => {
      if (this.isActive) {
        e.preventDefault(); // Prevent browser context menu
        if (this.activePlacement) {
          this.cancelPlacement();
        }
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isActive) return;

      // Mouse Look when RMB is held
      if (this.isRightMouseDown) {
        const deltaX = e.clientX - this.prevMouseX;
        const deltaY = e.clientY - this.prevMouseY;
        this.prevMouseX = e.clientX;
        this.prevMouseY = e.clientY;

        this.cameraEuler.setFromQuaternion(this.camera.quaternion, 'YXZ');
        this.cameraEuler.y -= deltaX * 0.0035;
        this.cameraEuler.x -= deltaY * 0.0035;
        this.cameraEuler.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.cameraEuler.x));
        this.camera.quaternion.setFromEuler(this.cameraEuler);
      }

      // Update ghost preview placement position if active
      if (this.activePlacement && this.placementGhost) {
        this.updatePlacementGhost(e);
      }
    });

    // Mouse wheel rotates placement ghost
    window.addEventListener('wheel', (e) => {
      if (this.isActive && this.activePlacement && this.placementGhost) {
        e.preventDefault();
        const dir = Math.sign(e.deltaY);
        this.placementRotation = (this.placementRotation + dir * (Math.PI / 8)) % (Math.PI * 2);
        this.placementGhost.rotation.y = this.placementRotation;
      }
    }, { passive: false });

    // Left click handling in Dev Mode (Select, Delete, or Place)
    window.addEventListener('click', (e) => {
      if (!this.isActive) return;

      // Ignore clicks on dev panel UI elements
      if (e.target.closest('.dev-toolbar') ||
          e.target.closest('.dev-bottom-drawer') ||
          e.target.closest('.dev-inspector-card') ||
          e.target.closest('.dev-placement-banner') ||
          e.target.closest('.menu-modal')) {
        return;
      }

      // If in placement mode: confirm placement
      if (this.activePlacement) {
        this.confirmPlacement();
        return;
      }

      // If delete tool is active: direct click-to-delete
      if (this.isDeleteToolActive) {
        this.directDeleteUnderMouse(e);
        return;
      }

      // Normal mode: select object under mouse
      this.selectObjectUnderMouse(e);
    });
  }

  promptPassword() {
    if (this.isUnlocked) {
      this.enter();
      return;
    }

    if (this.player && this.player.controls && this.player.controls.isLocked) {
      this.player.controls.unlock();
    }
    if (document.exitPointerLock) {
      document.exitPointerLock();
    }

    this.isPromptOpen = true;
    if (this.passwordModal) {
      this.passwordModal.classList.add('active');
      this.passwordModal.style.display = 'flex';
      if (this.passwordInput) {
        this.passwordInput.value = '';
        setTimeout(() => {
          this.passwordInput.focus();
        }, 60);
      }
      if (this.passwordError) this.passwordError.style.display = 'none';
    }
  }

  closePasswordPrompt() {
    this.isPromptOpen = false;
    if (this.passwordModal) {
      this.passwordModal.classList.remove('active');
      this.passwordModal.style.display = 'none';
    }
    const pauseMenu = document.getElementById('pause-menu');
    if (pauseMenu) pauseMenu.style.display = '';
  }

  verifyPassword() {
    if (!this.passwordInput) return;
    const val = this.passwordInput.value.trim().toLowerCase();
    if (val === 'kissa') {
      this.isUnlocked = true;
      localStorage.setItem('tikapoo_dev_unlocked', 'true');
      this.closePasswordPrompt();
      this.enter();
    } else {
      if (this.passwordError) this.passwordError.style.display = 'block';
      this.passwordInput.focus();
    }
  }

  enter() {
    this.isActive = true;
    if (this.panelEl) this.panelEl.style.display = 'flex';
    if (this.player && this.player.controls && this.player.controls.isLocked) {
      this.player.controls.unlock();
    }
    if (document.exitPointerLock) {
      document.exitPointerLock();
    }

    this.updateEditsBadge();

    // Camera orientation
    this.cameraEuler.setFromQuaternion(this.camera.quaternion, 'YXZ');

    if (this.hud) {
      this.hud.showNotification('🛠️ Maailmaneditori aktivoitu! [WASD] Lennä, Pidä [Oikea hiiri] kääntääksesi kameraa. Klikkaa kohteita muokataksesi.', 4500);
    }
  }

  exit() {
    this.isActive = false;
    this.isRightMouseDown = false;
    this.toggleDeleteTool(false);
    this.cancelPlacement();
    this.deselectObject();
    this.keys = { forward: false, backward: false, left: false, right: false, up: false, down: false };

    if (this.panelEl) this.panelEl.style.display = 'none';
    if (this.inspectorCard) this.inspectorCard.style.display = 'none';
    if (this.exportModal) this.exportModal.style.display = 'none';

    // Ensure pause menu has no lingering inline display style
    const pauseMenu = document.getElementById('pause-menu');
    if (pauseMenu) pauseMenu.style.display = '';

    // Snap player position to camera position if noclip moved far away
    if (this.player && this.camera) {
      const p = this.camera.position;
      const gh = this.world ? this.world.getGroundHeight(p.x, p.z) : 0;
      this.player.playerPos.set(p.x, Math.max(gh + 0.5, p.y - 1.5), p.z);
    }

    if (this.hud) {
      this.hud.showNotification('Poistuttu kehittäjätilasta.', 2000);
    }
  }

  toggleDeleteTool(forceState = null) {
    this.isDeleteToolActive = forceState !== null ? forceState : !this.isDeleteToolActive;
    if (this.isDeleteToolActive) {
      this.cancelPlacement();
      this.deselectObject();
    }
    this.updateDeleteButtonUI();
  }

  updateDeleteButtonUI() {
    const btn = document.getElementById('dev-delete-mode-btn');
    if (btn) {
      btn.classList.toggle('dev-btn-delete-active', this.isDeleteToolActive);
      btn.textContent = this.isDeleteToolActive ? '🗑️ Poistotila: PÄÄLLÄ (Klikkaa kohdetta)' : '🗑️ Poistotyökalu [X]: POIS';
    }
  }

  startPlacement(type, modelName, displayName, category) {
    this.cancelPlacement();
    this.deselectObject();
    this.toggleDeleteTool(false);

    this.activePlacement = { type, modelName, displayName, category };
    this.placementRotation = 0;

    // Create ghost mesh preview
    if (category === 'structures' || category === 'crafting' || category === 'props') {
      if (this.buildingSystem) {
        this.placementGhost = this.buildingSystem.createStructureMesh(type, true, true);
      }
    }

    if (!this.placementGhost && modelName && this.world && this.world.assetLoader) {
      const cloned = this.world.assetLoader.get(modelName);
      if (cloned) {
        const ghostMat = new THREE.MeshBasicMaterial({
          color: 0x00e5ff,
          transparent: true,
          opacity: 0.55,
          wireframe: false
        });
        cloned.traverse(c => {
          if (c.isMesh) c.material = ghostMat;
        });
        this.placementGhost = cloned;
      }
    }

    // Fallback simple geometric preview
    if (!this.placementGhost) {
      const geo = new THREE.CylinderGeometry(0.5, 0.5, 1.2, 16);
      const mat = new THREE.MeshBasicMaterial({ color: 0x2ecc71, transparent: true, opacity: 0.6 });
      this.placementGhost = new THREE.Mesh(geo, mat);
    }

    this.placementGhost.visible = false;
    this.scene.add(this.placementGhost);

    if (this.placementBanner) {
      this.placementBanner.style.display = 'flex';
      if (this.placementText) {
        this.placementText.textContent = `🛠️ Asetustila: ${displayName} — Klikkaa maata | [R] Käännä | [ESC] Peruuta`;
      }
    }
  }

  updatePlacementGhost(e) {
    this.mouse.set(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1
    );

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.world.groundMesh);

    if (intersects.length > 0) {
      const hit = intersects[0];
      this.placementGhost.position.copy(hit.point);
      this.placementGhost.rotation.y = this.placementRotation;
      this.placementGhost.visible = true;
    } else {
      this.placementGhost.visible = false;
    }
  }

  confirmPlacement() {
    if (!this.activePlacement || !this.placementGhost || !this.placementGhost.visible) return;

    const pos = this.placementGhost.position.clone();
    const rot = this.placementRotation;
    const { type, modelName, displayName } = this.activePlacement;

    // Create unique ID for local persistence
    const customId = `placed_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    // Record in local edits
    this.edits.placed.push({
      id: customId,
      type,
      modelName,
      x: Number(pos.x.toFixed(2)),
      y: Number(pos.y.toFixed(2)),
      z: Number(pos.z.toFixed(2)),
      rotY: Number(rot.toFixed(2))
    });
    this.saveEdits();

    // Instantiate in the live world
    this.instantiateEntity(type, modelName, pos, rot, customId);

    if (this.hud) {
      this.hud.showNotification(`✨ ${displayName} sijoitettu ja tallennettu!`, 2200);
    }
  }

  cancelPlacement() {
    if (this.placementGhost) {
      this.scene.remove(this.placementGhost);
      this.placementGhost = null;
    }
    this.activePlacement = null;
    if (this.placementBanner) {
      this.placementBanner.style.display = 'none';
    }
  }

  instantiateEntity(type, modelName, pos, rotY, customId) {
    let spawned = null;

    switch (type) {
      case 'tree_pine':
        spawned = this.world?.spawnTree(pos.x, pos.z, modelName || 'Pine_1', 2.6, rotY, customId);
        break;
      case 'tree_tall':
        spawned = this.world?.spawnTree(pos.x, pos.z, 'Pine_3', 3.4, rotY, customId);
        break;
      case 'tree_birch':
        spawned = this.world?.spawnTree(pos.x, pos.z, 'BirchTree_1', 2.2, rotY, customId);
        break;
      case 'tree_oak':
        spawned = this.world?.spawnTree(pos.x, pos.z, 'CommonTree_1', 2.8, rotY, customId);
        break;
      case 'tree_dead':
        spawned = this.world?.spawnTree(pos.x, pos.z, 'DeadTree_1', 2.0, rotY, customId);
        break;
      case 'rock_boulder':
        spawned = this.world?.spawnStone(pos.x, pos.z, 'Rock_1', 1.3, rotY, customId);
        break;
      case 'rock_moss':
        spawned = this.world?.spawnStone(pos.x, pos.z, 'Rock_Moss_1', 1.4, rotY, customId);
        break;
      case 'rock_pebble':
        spawned = this.world?.spawnStone(pos.x, pos.z, 'Pebble_Round_1', 1.5, rotY, customId);
        break;
      case 'chest':
        if (this.world?.spawnWildChest) {
          const chestObj = this.world.spawnWildChest(pos.x, pos.z);
          if (chestObj && chestObj.mesh) {
            chestObj.mesh.userData.customId = customId;
            spawned = chestObj;
          }
        }
        break;
      case 'woodenWall':
      case 'stoneWall':
      case 'woodenFloor':
      case 'stoneFloor':
      case 'woodenRoof':
      case 'woodenDoor':
      case 'palisade':
      case 'woodenStairs':
      case 'workbench':
      case 'campfire':
      case 'torchPole':
      case 'smelter':
      case 'forge':
      case 'cauldron':
      case 'barrel':
      case 'table':
      case 'chair':
      case 'bed':
        if (this.buildingSystem?.placeDirect) {
          spawned = this.buildingSystem.placeDirect(type, pos, rotY, customId);
        }
        break;
      case 'prop_wagon':
      case 'prop_crate':
      case 'prop_fence':
      case 'bush_berry':
        if (this.world?._placeModel) {
          const mesh = this.world._placeModel(modelName || 'Prop_Crate', pos.x, pos.z, 1.0, rotY, true);
          if (mesh) {
            mesh.userData.customId = customId;
            this.world.decorations.push(mesh);
            spawned = mesh;
          }
        }
        break;
      case 'boar':
        if (this.enemyManager) spawned = this.enemyManager.spawnAt(pos.x, pos.z, 'meadows');
        break;
      case 'skeleton':
        if (this.enemyManager) spawned = this.enemyManager.spawnAt(pos.x, pos.z, 'blackForest');
        break;
      case 'greydwarf':
        if (this.enemyManager) spawned = this.enemyManager.spawnAt(pos.x, pos.z, 'blackForest');
        break;
      case 'wolf':
        if (this.enemyManager) spawned = this.enemyManager.spawnAt(pos.x, pos.z, 'mountain');
        break;
      default:
        if (this.world?._placeModel && modelName) {
          const mesh = this.world._placeModel(modelName, pos.x, pos.z, 1.0, rotY, true);
          if (mesh) {
            mesh.userData.customId = customId;
            this.world.decorations.push(mesh);
            spawned = mesh;
          }
        }
        break;
    }
    return spawned;
  }

  findSelectableEntity(hitObj) {
    if (!hitObj) return null;
    // Strictly ignore terrain and water
    if (hitObj === this.world?.groundMesh || hitObj === this.world?.waterMesh) return null;
    if (hitObj === this.selectionBox || hitObj === this.placementGhost) return null;
    if (hitObj === this.player?.mesh) return null;

    // Check if hit object or an ancestor has resourceNode or custom entity data
    let curr = hitObj;
    while (curr) {
      if (curr.userData?.resourceNode) {
        return curr.userData.resourceNode.mesh || curr;
      }
      if (curr.userData?.customId) {
        return curr;
      }
      if (this.world?.wildChests?.some(c => c.mesh === curr)) {
        return curr;
      }
      if (this.buildingSystem?.placedStructures?.some(s => s.mesh === curr)) {
        return curr;
      }
      if (this.enemyManager?.enemies?.some(e => e.mesh === curr)) {
        return curr;
      }
      if (this.animalManager?.animals?.some(a => a.mesh === curr)) {
        return curr;
      }
      if (this.world?.decorations?.some(d => d === curr)) {
        return curr;
      }
      if (curr.parent === this.scene) {
        // Direct child under scene
        if (curr !== this.world?.groundMesh && curr !== this.world?.waterMesh && curr !== this.player?.mesh) {
          return curr;
        }
        return null;
      }
      curr = curr.parent;
    }
    return null;
  }

  selectObjectUnderMouse(e) {
    this.mouse.set(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1
    );

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);

    for (let i = 0; i < intersects.length; i++) {
      const hit = intersects[i].object;
      const entity = this.findSelectableEntity(hit);
      if (entity) {
        this.selectObject(entity);
        return;
      }
    }

    this.deselectObject();
  }

  selectObject(obj) {
    this.deselectObject();
    this.selectedObject = obj;

    // Create glowing neon cyan BoxHelper
    this.selectionBox = new THREE.BoxHelper(obj, 0x00e5ff);
    if (this.selectionBox.material) {
      this.selectionBox.material.depthTest = false;
      this.selectionBox.material.transparent = true;
      this.selectionBox.material.opacity = 0.95;
    }
    this.selectionBox.renderOrder = 999;
    this.scene.add(this.selectionBox);

    // Identify object name and type
    let typeName = 'Objekti (Scene Prop)';
    let objName = obj.name || 'Maailman Kohde';

    if (this.world?.trees?.some(t => t.mesh === obj)) {
      typeName = 'Puu (Tree)';
      const tNode = this.world.trees.find(t => t.mesh === obj);
      if (tNode?.name) objName = tNode.name;
    } else if (this.world?.stones?.some(s => s.mesh === obj)) {
      typeName = 'Kivi (Boulder)';
      const sNode = this.world.stones.find(s => s.mesh === obj);
      if (sNode?.name) objName = sNode.name;
    } else if (this.buildingSystem?.placedStructures?.some(s => s.mesh === obj)) {
      typeName = 'Rakenne (Building)';
      const st = this.buildingSystem.placedStructures.find(s => s.mesh === obj);
      if (st?.type) objName = st.type;
    } else if (this.world?.wildChests?.some(c => c.mesh === obj)) {
      typeName = 'Aarrearkku (Chest)';
      objName = 'Salattu Metsäarkku';
    } else if (this.enemyManager?.enemies?.some(e => e.mesh === obj)) {
      typeName = 'Vihollinen (Enemy)';
      const en = this.enemyManager.enemies.find(e => e.mesh === obj);
      if (en?.name) objName = en.name;
    } else if (this.animalManager?.animals?.some(a => a.mesh === obj)) {
      typeName = 'Eläin (Animal)';
    }

    if (this.inspectorCard) {
      this.inspectorCard.style.display = 'block';
      if (this.inspTitle) this.inspTitle.textContent = objName;
      if (this.inspType) this.inspType.textContent = typeName;
      if (this.inspPos) {
        const p = obj.position;
        this.inspPos.textContent = `X: ${p.x.toFixed(1)}, Y: ${p.y.toFixed(1)}, Z: ${p.z.toFixed(1)}`;
      }
    }
  }

  deselectObject() {
    if (this.selectionBox) {
      this.scene.remove(this.selectionBox);
      this.selectionBox.geometry?.dispose();
      this.selectionBox.material?.dispose();
      this.selectionBox = null;
    }
    this.selectedObject = null;
    if (this.inspectorCard) this.inspectorCard.style.display = 'none';
  }

  directDeleteUnderMouse(e) {
    this.mouse.set(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1
    );

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);

    for (let i = 0; i < intersects.length; i++) {
      const hit = intersects[i].object;
      const entity = this.findSelectableEntity(hit);
      if (entity) {
        this.deleteObject(entity);
        return;
      }
    }
  }

  deleteSelectedObject() {
    if (!this.selectedObject) return;
    this.deleteObject(this.selectedObject);
  }

  deleteObject(obj) {
    if (!obj) return;

    const pos = obj.position.clone();
    const customId = obj.userData?.customId;

    // Check if this was a custom placed entity
    if (customId) {
      this.edits.placed = this.edits.placed.filter(p => p.id !== customId);
    } else {
      // Natural / generated entity: record coordinate deletion
      this.edits.deleted.push({
        x: Number(pos.x.toFixed(1)),
        y: Number(pos.y.toFixed(1)),
        z: Number(pos.z.toFixed(1)),
        radius: 2.2
      });
    }
    this.saveEdits();

    // Remove from World entity arrays & colliders
    if (this.world?.removeEntity) {
      this.world.removeEntity(obj);
    }
    // Remove from BuildingSystem
    if (this.buildingSystem?.removeStructure) {
      this.buildingSystem.removeStructure(obj);
    }
    // Remove from EnemyManager
    if (this.enemyManager?.enemies) {
      this.enemyManager.enemies = this.enemyManager.enemies.filter(e => e.mesh !== obj);
    }
    // Remove from AnimalManager
    if (this.animalManager?.animals) {
      this.animalManager.animals = this.animalManager.animals.filter(a => a.mesh !== obj);
    }
    if (this.animalManager?.deers) {
      this.animalManager.deers = this.animalManager.deers.filter(d => d.mesh !== obj);
    }
    if (this.animalManager?.rabbits) {
      this.animalManager.rabbits = this.animalManager.rabbits.filter(r => r.mesh !== obj);
    }

    // Remove from scene directly
    this.scene.remove(obj);
    this.deselectObject();

    if (this.hud) {
      this.hud.showNotification(`🗑️ Kohde poistettu ja tallennettu! (${Math.round(pos.x)}, ${Math.round(pos.z)})`, 2000);
    }
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
    if (this.hud) this.hud.showNotification(`📍 Teleportoitu: X=${x}, Z=${z}`, 2000);
  }

  openExportModal() {
    if (!this.exportModal || !this.exportTextarea) return;
    this.exportTextarea.value = JSON.stringify(this.edits, null, 2);
    this.exportModal.style.display = 'flex';
  }

  update(delta) {
    if (!this.isActive) return;

    // Keep selection outline synchronized with object
    if (this.selectionBox && this.selectedObject) {
      this.selectionBox.update();
    }

    // Camera free-flying movement
    if (this.isNoclip) {
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
}
