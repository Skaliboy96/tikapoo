import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

import AssetLoader from './AssetLoader.js';
import AudioManager from './AudioManager.js';
import HUD from './HUD.js';
import Inventory from './Inventory.js';
import World from './World.js';
import Player from './Player.js';
import ResourceNode from './ResourceNode.js';
import DayNightCycle from './DayNightCycle.js';
import EnemyManager, { getBiomeKey } from './EnemyManager.js';
import BuildingSystem from './BuildingSystem.js';
import Combat from './Combat.js';
import CraftingMenu from './CraftingMenu.js';
import NPC from './NPC.js';
import QuestManager from './QuestManager.js';
import MapScreen from './MapScreen.js';
import BackpackScreen from './BackpackScreen.js';
import LootManager from './LootManager.js';
import Hotbar from './Hotbar.js';
import AnimalManager from './AnimalManager.js';
import FishingSystem from './FishingSystem.js';
import FarmingSystem from './FarmingSystem.js';
import BossManager from './BossManager.js';
import SkillTree from './SkillTree.js';
import AchievementManager from './AchievementManager.js';
import CharacterCreator from './CharacterCreator.js';
import MobileControls from './MobileControls.js';
import Localization from './Localization.js';
import DevMode from './DevMode.js';
import SaveSystem from './SaveSystem.js';
import RagdollManager from './RagdollManager.js';
import AccountSystem from './AccountSystem.js';

window.addEventListener('error', (event) => {
  console.warn('Recovered from unhandled runtime error:', event.message, event.filename, event.lineno);
});
window.addEventListener('unhandledrejection', (event) => {
  console.warn('Recovered from unhandled promise rejection:', event.reason);
});

async function init() {
  try {
    // --- Loading Screen Preload ---
    const loadingScreen = document.getElementById('loading-screen');
    const loadingBar = document.getElementById('loading-bar');
    const loadingText = document.getElementById('loading-text');

    const assetLoader = new AssetLoader();
    await assetLoader.loadAll();

    if (loadingText) loadingText.textContent = 'Valmistellaan maailmaa... (100%)';
    if (loadingBar) loadingBar.style.width = '100%';

    // Yield to browser event loop to render 100% completion before starting scene initialization
    await new Promise((resolve) => setTimeout(resolve, 80));

  // --- Scene, Camera, Renderer Bootstrap ---
  const container = document.getElementById('game-container');

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xc8b69b, 0.0028);

  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1600
  );
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  // Detect mobile & touch devices early for optimal GPU memory & canvas scaling
  const isTouchDevice = (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    /Android|iPhone|iPad|iPod|Windows Phone|webOS|BlackBerry/i.test(navigator.userAgent) ||
    window.innerWidth <= 900
  );

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
    precision: isTouchDevice ? 'mediump' : 'highp',
    stencil: false,
    depth: true
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(isTouchDevice ? Math.min(window.devicePixelRatio, 1.5) : Math.min(window.devicePixelRatio, 2.0));
  // Enable clean grounded shadows on mobile with high performance
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = isTouchDevice ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);

  // Safe WebGL context restoration to prevent black screen or reload on mobile tab switch
  renderer.domElement.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    console.warn('[WebGL] Context lost. Preventing default to allow WebGL restoration.');
  }, false);

  // --- Controls & Pointer Lock Setup ---
  const controls = new PointerLockControls(camera, renderer.domElement);

  // UI Elements
  const crosshair = document.getElementById('crosshair');
  const mainMenu = document.getElementById('main-menu');
  const menuPlayBtn = document.getElementById('menu-play-btn');
  const menuInstructionsBtn = document.getElementById('menu-instructions-btn');
  const menuLoreBtn = document.getElementById('menu-lore-btn');
  const menuSettingsBtn = document.getElementById('menu-settings-btn');
  const pauseMenu = document.getElementById('pause-menu');
  const pauseResumeBtn = document.getElementById('pause-resume-btn');
  const pauseSettingsBtn = document.getElementById('pause-settings-btn');
  const pauseInstructionsBtn = document.getElementById('pause-instructions-btn');
  const pauseQuitBtn = document.getElementById('pause-quit-btn');

  const hudEl = document.getElementById('hud');
  const hotbarEl = document.getElementById('hotbar');
  const minimapEl = document.getElementById('minimap-container');
  const clockEl = document.getElementById('game-clock-container');
  const questLogEl = document.getElementById('quest-log');
  const invDisplayEl = document.getElementById('inventory-display');

  // --- Subsystem Instantiations (Staggered to prevent mobile UI freeze & WebKit SIGKILL watchdog triggers) ---
  const audioManager = new AudioManager();
  const hud = new HUD();
  const inventory = new Inventory(hud, audioManager);
  await new Promise((resolve) => setTimeout(resolve, 30));

  const world = new World(scene, assetLoader);
  await new Promise((resolve) => setTimeout(resolve, 30));

  // 3D Physical Ragdoll physics simulation for characters and creatures on death
  const ragdollManager = new RagdollManager(scene, world);

  const player = new Player(scene, camera, controls, inventory, hud, audioManager, assetLoader, world);
  player.ragdollManager = ragdollManager;
  await new Promise((resolve) => setTimeout(resolve, 20));

  const buildingSystem = new BuildingSystem(scene, inventory, hud, audioManager, assetLoader, controls);

  // QuestManager & AchievementManager
  const questManager = new QuestManager(inventory, player, hud);
  const achievementManager = new AchievementManager(player, hud, audioManager);
  player.achievementManager = achievementManager;

  // Loot drops manager (spawns 3D physical ground drops on enemy death)
  const lootManager = new LootManager(scene, world, inventory, hud, audioManager, questManager, assetLoader);

  // Wildlife manager (stags, hares, swimming river fish)
  const animalManager = new AnimalManager(scene, world, inventory, hud, audioManager, questManager);

  // Fishing system (cast rod at river, bite detection, timed catch mini-game)
  const fishingSystem = new FishingSystem(scene, world, player, inventory, hud, audioManager, questManager);
  fishingSystem.achievementManager = achievementManager;

  // Farming system (till soil with Rake, plant crops, harvest yield)
  const farmingSystem = new FarmingSystem(scene, world, inventory, hud, audioManager);
  farmingSystem.player = player;
  player.buildingSystem = buildingSystem;
  buildingSystem.player = player;
  inventory.buildingSystem = buildingSystem;
  inventory.player = player;

  // 5 Biome Bosses System (Unique Mechanics, Arenas, Progressive Unlocks & Legendary Drops)
  const bossManager = new BossManager(scene, world, inventory, hud, audioManager, questManager, assetLoader, player);
  bossManager.achievementManager = achievementManager;

  const craftingMenu = new CraftingMenu(inventory, buildingSystem, player, hud, audioManager, controls, questManager);
  craftingMenu.achievementManager = achievementManager;
  const resourceNode = new ResourceNode(scene, world, inventory, hud, player, audioManager, questManager);
  resourceNode.achievementManager = achievementManager;
  const enemyManager = new EnemyManager(scene, world, inventory, hud, audioManager, questManager, assetLoader, lootManager);
  enemyManager.achievementManager = achievementManager;
  enemyManager.ragdollManager = ragdollManager;
  enemyManager.buildingSystem = buildingSystem;
  buildingSystem.enemyManager = enemyManager;
  const combat = new Combat(scene, camera, player, enemyManager, inventory, hud, audioManager, assetLoader, animalManager, bossManager);
  combat.buildingSystem = buildingSystem;
  combat.farmingSystem = farmingSystem;
  const dayNightCycle = new DayNightCycle(scene, world, hud, audioManager, questManager);

  // Skill Tree & Special Abilities (Keys 1-4, Tree UI on [O], Quests Tab, Achievements Tab)
  const skillTree = new SkillTree(player, combat, hud, audioManager, questManager, achievementManager);
  player.skillTree = skillTree;

  // Valheim 8-slot Action Bar (Hotbar) with Top Abilities Bar
  const hotbar = new Hotbar(inventory, player, buildingSystem, combat, hud, audioManager, skillTree);
  inventory.hotbar = hotbar;
  skillTree.hotbar = hotbar;

  // NPC system (needs questManager and assetLoader)
  const npcManager = new NPC(scene, world, questManager, hud, controls, assetLoader);

  // Map screen (M key) with 5 Biome Boss markers & Arenas
  const mapScreen = new MapScreen(world, player, npcManager, enemyManager, buildingSystem, controls, camera, questManager, bossManager);

  // Backpack & Inventory screen (I / B keys with Paperdoll 3D Preview & Drop system)
  const backpackScreen = new BackpackScreen(inventory, player, controls, hud, hotbar, lootManager);

  // Nordic Character Creator (live 3D preview, gender, hair, skin, clothing)
  const characterCreator = new CharacterCreator(assetLoader, (charConfig) => {
    player.applyCharacterConfig(charConfig);
    startGame();
  });

  // Developer & Creative Mode (protected by password "kissa")
  const devMode = new DevMode(scene, camera, player, world, enemyManager, animalManager, bossManager, buildingSystem, inventory, hud);

  // Full Save & Load Management (File export / import and localStorage)
  const saveSystem = new SaveSystem({
    player,
    inventory,
    hotbar,
    buildingSystem,
    dayNightCycle,
    questManager,
    skillTree,
    world,
    hud
  });

  // Built-in User Account & Profile Save System (No external file handling needed)
  const accountSystem = new AccountSystem(saveSystem);

  // HUD Quick Action Buttons
  const btnSkills = document.getElementById('open-skills-btn');
  if (btnSkills) {
    btnSkills.addEventListener('click', (e) => {
      e.stopPropagation();
      skillTree.open();
    });
  }
  const btnCraft = document.getElementById('open-craft-btn');
  if (btnCraft) {
    btnCraft.addEventListener('click', (e) => {
      e.stopPropagation();
      craftingMenu.open();
    });
  }
  const btnBuild = document.getElementById('open-build-btn');
  if (btnBuild) {
    btnBuild.addEventListener('click', (e) => {
      e.stopPropagation();
      if (inventory.tools && inventory.tools.hammer) {
        if (inventory.hotbar) inventory.hotbar.selectSlot(6, true);
        else buildingSystem.setHammerActive(true);
      }
      buildingSystem.toggleBuildMenu();
    });
  }
  const btnBp = document.getElementById('open-backpack-btn');
  if (btnBp) {
    btnBp.addEventListener('click', (e) => {
      e.stopPropagation();
      backpackScreen.open();
    });
  }
  const btnMap = document.getElementById('open-map-btn');
  if (btnMap) {
    btnMap.addEventListener('click', (e) => {
      e.stopPropagation();
      mapScreen.open();
    });
  }
  const btnPause = document.getElementById('open-pause-btn');
  if (btnPause) {
    btnPause.addEventListener('click', (e) => {
      e.stopPropagation();
      const pMenu = document.getElementById('pause-menu');
      if (pMenu) {
        pMenu.classList.toggle('active');
        if (controls) controls.isLocked = !pMenu.classList.contains('active');
      }
    });
  }

  // --- Mobile & Touch Controls (Android & iOS) ---
  const mobileControls = new MobileControls({
    player,
    camera,
    controls,
    inventory,
    combat,
    buildingSystem,
    fishingSystem,
    npcManager,
    skillTree,
    hotbar,
    hud,
    audioManager,
    craftingMenu,
    backpackScreen,
    mapScreen,
    pauseMenu,
    resourceNode,
    world,
    renderer
  });

  // Forward buildingSystem quest & achievement notifications
  buildingSystem.onPlace = (structureType) => {
    questManager.onBuild(structureType);
    if (achievementManager) achievementManager.onBuild();
  };

  // Set player position above initial terrain spawn
  const initialGroundY = world.getGroundHeight(0, 0);
  player.playerPos.set(0, initialGroundY, 0);

  // Global dev reference for runtime diagnostics & benchmarking
  window.__game = { world, player, devMode, inventory, hud, audioManager, scene, controls, startGame: () => startGame() };

  // --- Initial Menu Visibility State ---
  let isGameStarted = false;
  let menuOrbitAngle = 0;

  if (hudEl) hudEl.style.display = 'none';
  if (hotbarEl) hotbarEl.style.display = 'none';
  if (minimapEl) minimapEl.style.display = 'none';
  if (clockEl) clockEl.style.display = 'none';
  if (questLogEl) questLogEl.style.display = 'none';
  if (invDisplayEl) invDisplayEl.style.display = 'none';
  if (crosshair) crosshair.style.display = 'none';
  if (mainMenu) mainMenu.style.display = 'flex';

  // Ensure mobile controls overlay is hidden while main menu is showing
  if (mobileControls) {
    mobileControls.disableMobileControls();
  }

  // Smoothly fade out loading screen once world & menu are ready
  if (loadingScreen) {
    loadingScreen.style.transition = 'opacity 0.4s ease-out';
    loadingScreen.style.opacity = '0';
    setTimeout(() => {
      loadingScreen.style.display = 'none';
    }, 420);
  }

  // --- Start Adventure ---
  const startGame = () => {
    audioManager.ensureContext();
    isGameStarted = true;
    if (mainMenu) mainMenu.style.display = 'none';
    if (pauseMenu) pauseMenu.classList.remove('active');
    if (hudEl) hudEl.style.display = 'flex';
    if (hotbarEl) hotbarEl.style.display = 'flex';
    if (minimapEl) minimapEl.style.display = 'block';
    if (clockEl) clockEl.style.display = 'block';
    if (questLogEl) questLogEl.style.display = 'block';
    if (invDisplayEl) invDisplayEl.style.display = 'none'; // Inventory is accessed via [I] key
    if (crosshair) crosshair.style.display = 'block';

    const pPos = player.getPosition();
    camera.position.set(pPos.x, pPos.y + player.heightAboveGround, pPos.z);

    if (mobileControls && mobileControls.isTouchDevice) {
      mobileControls.enableMobileControls();
      controls.isLocked = true;
    } else {
      controls.lock();
    }
  };

  const menuCharBtn = document.getElementById('menu-char-btn');
  // Unified touch-friendly button binder (Guarantees immediate responsiveness on iOS Safari and Android)
  const bindTouchClick = (el, handler) => {
    if (!el) return;
    let lastActionTime = 0;
    const trigger = (e) => {
      const now = performance.now();
      if (now - lastActionTime < 320) return;
      lastActionTime = now;
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      if (audioManager) audioManager.ensureContext();
      handler(e);
    };
    el.addEventListener('click', (e) => {
      const now = performance.now();
      if (now - lastActionTime < 320) return;
      lastActionTime = now;
      e.stopPropagation();
      if (audioManager) audioManager.ensureContext();
      handler(e);
    });
    el.addEventListener('touchend', trigger, { passive: false });
    el.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'touch' || e.pointerType === 'pen') {
        trigger(e);
      }
    });
  };

  if (menuCharBtn) {
    bindTouchClick(menuCharBtn, (e) => {
      if (mainMenu) mainMenu.style.display = 'none';
      characterCreator.open();
    });
  }

  if (menuPlayBtn) {
    bindTouchClick(menuPlayBtn, (e) => {
      const hasSavedChar = localStorage.getItem('tikapoo_character');
      if (!hasSavedChar) {
        if (mainMenu) mainMenu.style.display = 'none';
        characterCreator.open();
      } else {
        startGame();
      }
    });
  }

  // --- Main Menu Save / Continue / Load Buttons ---
  const menuContinueBtn = document.getElementById('menu-continue-btn');
  if (menuContinueBtn) {
    if (saveSystem.hasSave() || (accountSystem && accountSystem.loadCurrentProfile())) {
      menuContinueBtn.style.display = 'block';
    }
    bindTouchClick(menuContinueBtn, (e) => {
      if (accountSystem && accountSystem.isLoggedIn() && accountSystem.loadCurrentProfile()) {
        saveSystem.applySaveData(accountSystem.loadCurrentProfile());
      } else {
        saveSystem.loadFromLocalStorage();
      }
      startGame();
    });
  }

  const saveFileInput = document.getElementById('savegame-file-input');
  const menuLoadBtn = document.getElementById('menu-load-btn');
  if (menuLoadBtn && saveFileInput) {
    bindTouchClick(menuLoadBtn, (e) => {
      saveFileInput.click();
    });
  }

  if (saveFileInput) {
    saveFileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const ok = await saveSystem.importFromFile(file);
      if (ok) {
        if (!isGameStarted) {
          startGame();
        } else {
          resumeGame();
        }
      }
      saveFileInput.value = '';
    });
  }

  // --- Menu Modals (Instructions, Lore, Settings) ---
  const openModal = (id) => {
    const m = document.getElementById(id);
    if (m) {
      m.classList.add('active');
      if (typeof Localization !== 'undefined' && Localization.applyToDOM) {
        Localization.applyToDOM();
      }
    }
  };
  const closeModal = (id) => {
    const m = document.getElementById(id);
    if (m) m.classList.remove('active');
  };

  if (menuInstructionsBtn) {
    bindTouchClick(menuInstructionsBtn, (e) => {
      openModal('modal-instructions');
    });
  }
  if (menuLoreBtn) {
    bindTouchClick(menuLoreBtn, (e) => {
      openModal('modal-lore');
    });
  }
  if (menuSettingsBtn) {
    bindTouchClick(menuSettingsBtn, (e) => {
      openModal('modal-settings');
    });
  }

  if (pauseSettingsBtn) {
    bindTouchClick(pauseSettingsBtn, (e) => {
      openModal('modal-settings');
    });
  }

  // --- User Account & Cloud/Internal Profile Save Handlers ---
  const menuAccountBtn = document.getElementById('menu-account-btn');
  if (menuAccountBtn) {
    bindTouchClick(menuAccountBtn, (e) => {
      openModal('modal-account');
      updateAccountUI();
    });
  }

  const pauseAccountBtn = document.getElementById('pause-account-btn');
  if (pauseAccountBtn) {
    bindTouchClick(pauseAccountBtn, (e) => {
      openModal('modal-account');
      updateAccountUI();
    });
  }

  const updateAccountUI = () => {
    if (!accountSystem) return;
    const isLogged = accountSystem.isLoggedIn();
    const username = accountSystem.getCurrentUsername();
    const userBadgeText = isLogged ? `👤 ${username}` : '👤 Vieras';

    const menuBadge = document.getElementById('menu-user-badge');
    if (menuBadge) menuBadge.textContent = userBadgeText;

    const pauseBadge = document.getElementById('pause-user-badge');
    if (pauseBadge) pauseBadge.textContent = isLogged ? `👤 ${username}` : '👤 Vieras';

    const statusBadge = document.getElementById('account-status-badge');
    if (statusBadge) {
      statusBadge.textContent = isLogged ? `✅ Kirjautunut: ${username}` : '👤 Ei kirjautunut';
      statusBadge.style.color = isLogged ? '#2ecc71' : '#f1c40f';
    }

    const saveNowBtn = document.getElementById('acc-save-now-btn');
    if (saveNowBtn) saveNowBtn.style.display = isLogged ? 'block' : 'none';

    const logoutBtn = document.getElementById('acc-logout-btn');
    if (logoutBtn) logoutBtn.style.display = isLogged ? 'block' : 'none';

    const loginBtn = document.getElementById('acc-login-btn');
    const registerBtn = document.getElementById('acc-register-btn');
    if (loginBtn) loginBtn.style.display = isLogged ? 'none' : 'block';
    if (registerBtn) registerBtn.style.display = isLogged ? 'none' : 'block';

    const userInput = document.getElementById('acc-username-input');
    const passInput = document.getElementById('acc-password-input');
    if (userInput && isLogged) userInput.value = username;
    if (passInput && isLogged) passInput.value = '';

    if (menuContinueBtn && (saveSystem.hasSave() || (accountSystem && accountSystem.loadCurrentProfile()))) {
      menuContinueBtn.style.display = 'block';
    }
  };

  updateAccountUI();

  const accLoginBtn = document.getElementById('acc-login-btn');
  const accRegisterBtn = document.getElementById('acc-register-btn');
  const accSaveNowBtn = document.getElementById('acc-save-now-btn');
  const accLogoutBtn = document.getElementById('acc-logout-btn');
  const accMsgArea = document.getElementById('account-msg-area');

  if (accLoginBtn) {
    accLoginBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const user = (document.getElementById('acc-username-input')?.value || '').trim();
      const pass = (document.getElementById('acc-password-input')?.value || '').trim();
      const res = accountSystem.login(user, pass);
      if (accMsgArea) {
        accMsgArea.textContent = res.message;
        accMsgArea.style.color = res.success ? '#2ecc71' : '#e74c3c';
      }
      if (res.success) {
        updateAccountUI();
        const savedData = accountSystem.loadCurrentProfile();
        if (savedData) {
          saveSystem.applySaveData(savedData);
          if (hud) hud.showNotification(`💾 Profiilin tallennus ladattu käyttäjälle ${res.profile.username}!`, 4000);
        }
        setTimeout(() => {
          closeModal('modal-account');
        }, 900);
      }
    });
  }

  if (accRegisterBtn) {
    accRegisterBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const user = (document.getElementById('acc-username-input')?.value || '').trim();
      const pass = (document.getElementById('acc-password-input')?.value || '').trim();
      const res = accountSystem.register(user, pass);
      if (accMsgArea) {
        accMsgArea.textContent = res.message;
        accMsgArea.style.color = res.success ? '#2ecc71' : '#e74c3c';
      }
      if (res.success) {
        updateAccountUI();
        const payload = saveSystem.createSavePayload();
        accountSystem.saveCurrentProfile(payload);
        if (hud) hud.showNotification(`🎉 Tili luotu ja edistyminen tallennettu käyttäjälle ${res.profile.username}!`, 4500);
        setTimeout(() => {
          closeModal('modal-account');
        }, 900);
      }
    });
  }

  if (accSaveNowBtn) {
    accSaveNowBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (accountSystem.isLoggedIn()) {
        const payload = saveSystem.createSavePayload();
        accountSystem.saveCurrentProfile(payload);
        saveSystem.saveToLocalStorage();
        if (accMsgArea) {
          accMsgArea.textContent = `💾 Tallennettu tilille onnistuneesti! (${new Date().toLocaleTimeString()})`;
          accMsgArea.style.color = '#2ecc71';
        }
        if (hud) hud.showNotification(`💾 Edistyminen tallennettu tilillesi: ${accountSystem.getCurrentUsername()}!`, 3500);
        if (audioManager && audioManager.playPickup) audioManager.playPickup();
      }
    });
  }

  if (accLogoutBtn) {
    accLogoutBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      accountSystem.logout();
      updateAccountUI();
      if (accMsgArea) {
        accMsgArea.textContent = 'Kirjauduttu ulos.';
        accMsgArea.style.color = '#f1c40f';
      }
      if (hud) hud.showNotification('👤 Kirjauduttu ulos käyttäjätililtä.', 3000);
    });
  }

  // Auto-save progress to account every 25 seconds
  setInterval(() => {
    if (isGameStarted && player && !player.isDead && accountSystem && accountSystem.isLoggedIn()) {
      const payload = saveSystem.createSavePayload();
      accountSystem.saveCurrentProfile(payload);
      saveSystem.saveToLocalStorage();
    }
  }, 25000);

  document.querySelectorAll('.modal-close').forEach(btn => {
    const handleClose = (e) => {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      const target = btn.getAttribute('data-close');
      if (target) closeModal(target);
      if (isGameStarted && !controls.isLocked && pauseMenu &&
          !craftingMenu.isOpen && !backpackScreen.isOpen && !mapScreen.isOpen &&
          (!npcManager || !npcManager.activeNPC)) {
        pauseMenu.classList.add('active');
      }
    };
    btn.addEventListener('click', handleClose);
    btn.addEventListener('pointerdown', handleClose);
    btn.addEventListener('touchend', handleClose);
  });

  // --- Graphics & Gameplay Settings System (Very Low to Ultra) ---
  const shadowQualitySelect = document.getElementById('shadow-quality-select');
  if (shadowQualitySelect) {
    shadowQualitySelect.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'very_low') {
        renderer.shadowMap.enabled = false;
        if (world.sun) world.sun.castShadow = false;
      } else {
        renderer.shadowMap.enabled = true;
        if (world.sun) world.sun.castShadow = true;
        let mapRes = 2048;
        if (val === 'low') mapRes = 512;
        else if (val === 'medium') mapRes = 1024;
        else if (val === 'high') mapRes = 2048;
        else if (val === 'ultra') mapRes = 4096;

        if (world.sun) {
          world.sun.shadow.mapSize.set(mapRes, mapRes);
          if (world.sun.shadow.map) {
            world.sun.shadow.map.dispose();
            world.sun.shadow.map = null;
          }
        }
        renderer.shadowMap.type = (val === 'ultra' || val === 'high') ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;
      }
      renderer.shadowMap.needsUpdate = true;
      hud.showNotification(`Varjojen laatu: ${e.target.options[e.target.selectedIndex].text.split('(')[0].trim()}`);
    });
  }

  const renderDistSelect = document.getElementById('render-dist-select');
  if (renderDistSelect) {
    renderDistSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      let far = 1200;
      let fogDensity = 0.0028;
      if (val === 'very_low') { far = 400; fogDensity = 0.0075; }
      else if (val === 'low') { far = 650; fogDensity = 0.0048; }
      else if (val === 'medium') { far = 900; fogDensity = 0.0035; }
      else if (val === 'high') { far = 1200; fogDensity = 0.0028; }
      else if (val === 'ultra') { far = 1600; fogDensity = 0.0019; }

      camera.far = far;
      camera.updateProjectionMatrix();
      if (scene.fog) {
        scene.fog.density = fogDensity;
      }
      hud.showNotification(`Piirtoetäisyys: ${e.target.options[e.target.selectedIndex].text.split('(')[0].trim()}`);
    });
  }

  const foliageSelect = document.getElementById('foliage-density-select');
  const maxGrass = world.instancedGrass ? world.instancedGrass.count : 6000;
  const maxFerns = world.instancedFerns ? world.instancedFerns.count : 3000;
  if (foliageSelect) {
    foliageSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      let ratio = 0.85;
      if (val === 'very_low') ratio = 0.0;
      else if (val === 'low') ratio = 0.25;
      else if (val === 'medium') ratio = 0.55;
      else if (val === 'high') ratio = 0.85;
      else if (val === 'ultra') ratio = 1.0;

      if (world.instancedGrass) {
        world.instancedGrass.count = Math.floor(maxGrass * ratio);
        world.instancedGrass.visible = ratio > 0;
        world.instancedGrass.instanceMatrix.needsUpdate = true;
      }
      if (world.instancedFerns) {
        world.instancedFerns.count = Math.floor(maxFerns * ratio);
        world.instancedFerns.visible = ratio > 0;
        world.instancedFerns.instanceMatrix.needsUpdate = true;
      }
      hud.showNotification(`Kasvillisuus: ${e.target.options[e.target.selectedIndex].text.split('(')[0].trim()}`);
    });
  }

  const resSelect = document.getElementById('resolution-select');
  if (resSelect) {
    resSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      let scale = 1.25;
      if (val === 'very_low') scale = 0.75;
      else if (val === 'low') scale = 1.0;
      else if (val === 'medium') scale = 1.25;
      else if (val === 'high') scale = 1.5;
      else if (val === 'ultra') scale = 2.0;

      renderer.setPixelRatio(Math.min(window.devicePixelRatio, scale));
      renderer.setSize(window.innerWidth, window.innerHeight);
      hud.showNotification(`Resoluution skaalaus: ${scale}x`);
    });
  }

  // --- FPS Counter Setting ---
  const fpsSelect = document.getElementById('fps-counter-select');
  const fpsEl = document.getElementById('fps-counter');
  let showFps = (localStorage.getItem('tikapoo_show_fps') === 'on');
  if (fpsSelect) {
    fpsSelect.value = showFps ? 'on' : 'off';
    if (fpsEl) fpsEl.style.display = showFps ? 'block' : 'none';
    fpsSelect.addEventListener('change', (e) => {
      showFps = (e.target.value === 'on');
      localStorage.setItem('tikapoo_show_fps', showFps ? 'on' : 'off');
      if (fpsEl) fpsEl.style.display = showFps ? 'block' : 'none';
    });
  }

  const fovSlider = document.getElementById('fov-slider');
  const fovVal = document.getElementById('fov-val');
  if (fovSlider) {
    fovSlider.addEventListener('input', (e) => {
      const fov = parseFloat(e.target.value);
      camera.fov = fov;
      camera.updateProjectionMatrix();
      if (fovVal) fovVal.textContent = `${fov}°`;
    });
  }

  // --- Mouse Sensitivity Slider ---
  const mouseSensitivitySlider = document.getElementById('mouse-sensitivity-slider');
  const mouseSensitivityVal = document.getElementById('mouse-sensitivity-val');
  if (mouseSensitivitySlider) {
    const savedSensitivity = localStorage.getItem('tikapoo_mouse_sensitivity') || '100';
    mouseSensitivitySlider.value = savedSensitivity;
    if (mouseSensitivityVal) mouseSensitivityVal.textContent = `${savedSensitivity}%`;
    controls.pointerSpeed = parseFloat(savedSensitivity) / 100.0;

    mouseSensitivitySlider.addEventListener('input', (e) => {
      const val = e.target.value;
      if (mouseSensitivityVal) mouseSensitivityVal.textContent = `${val}%`;
      controls.pointerSpeed = parseFloat(val) / 100.0;
      localStorage.setItem('tikapoo_mouse_sensitivity', val);
    });
  }

  // --- Audio Volume Sliders (Master, Music, SFX, Ambient) ---
  const masterVolSlider = document.getElementById('master-volume-slider');
  const masterVolVal = document.getElementById('master-volume-val');
  if (masterVolSlider) {
    masterVolSlider.value = Math.round(audioManager.masterVolume * 100);
    if (masterVolVal) masterVolVal.textContent = `${masterVolSlider.value}%`;
    masterVolSlider.addEventListener('input', (e) => {
      const vol = parseInt(e.target.value, 10);
      audioManager.setMasterVolume(vol / 100);
      if (masterVolVal) masterVolVal.textContent = `${vol}%`;
    });
  }

  const musicVolSlider = document.getElementById('music-volume-slider');
  const musicVolVal = document.getElementById('music-volume-val');
  if (musicVolSlider) {
    musicVolSlider.value = Math.round(audioManager.musicVolume * 100);
    if (musicVolVal) musicVolVal.textContent = `${musicVolSlider.value}%`;
    musicVolSlider.addEventListener('input', (e) => {
      const vol = parseInt(e.target.value, 10);
      audioManager.setMusicVolume(vol / 100);
      if (musicVolVal) musicVolVal.textContent = `${vol}%`;
    });
  }

  const sfxVolSlider = document.getElementById('sfx-volume-slider');
  const sfxVolVal = document.getElementById('sfx-volume-val');
  if (sfxVolSlider) {
    sfxVolSlider.value = Math.round(audioManager.sfxVolume * 100);
    if (sfxVolVal) sfxVolVal.textContent = `${sfxVolSlider.value}%`;
    sfxVolSlider.addEventListener('input', (e) => {
      const vol = parseInt(e.target.value, 10);
      audioManager.setSfxVolume(vol / 100);
      if (sfxVolVal) sfxVolVal.textContent = `${vol}%`;
    });
  }

  const ambientVolSlider = document.getElementById('ambient-volume-slider');
  const ambientVolVal = document.getElementById('ambient-volume-val');
  if (ambientVolSlider) {
    ambientVolSlider.value = Math.round(audioManager.ambientVolume * 100);
    if (ambientVolVal) ambientVolVal.textContent = `${ambientVolSlider.value}%`;
    ambientVolSlider.addEventListener('input', (e) => {
      const vol = parseInt(e.target.value, 10);
      audioManager.setAmbientVolume(vol / 100);
      if (ambientVolVal) ambientVolVal.textContent = `${vol}%`;
    });
  }

  const camPrefSelect = document.getElementById('camera-pref-select');
  if (camPrefSelect) {
    camPrefSelect.addEventListener('change', (e) => {
      player.isThirdPerson = (e.target.value === '3rd');
    });
  }

  // --- Language Selector & Real-Time UI Updating ---
  const langSelect = document.getElementById('language-select');
  if (langSelect) {
    langSelect.value = Localization.getLanguage();
    langSelect.addEventListener('change', (e) => {
      Localization.setLanguage(e.target.value);
    });
  }

  const updateUILanguage = (lang) => {
    Localization.applyToDOM();
    const isFi = (lang === 'fi');

    // Main Menu Buttons
    const menuPlayText = document.querySelector('#menu-play-btn .btn-text');
    if (menuPlayText) menuPlayText.textContent = isFi ? 'ALOITA SEIKKAILU' : 'BEGIN ADVENTURE';
    const menuCharText = document.querySelector('#menu-char-btn .btn-text');
    if (menuCharText) menuCharText.textContent = isFi ? 'LUO / MUOKKAA HAHMOA' : 'CHARACTER CREATOR';
    const menuInstText = document.querySelector('#menu-instructions-btn .btn-text');
    if (menuInstText) menuInstText.textContent = isFi ? 'PELIOHJEET & NÄPPÄIMET' : 'CONTROLS & GUIDE';
    const menuLoreText = document.querySelector('#menu-lore-btn .btn-text');
    if (menuLoreText) menuLoreText.textContent = isFi ? 'KYLÄT & MAAILMA' : 'WORLD & LORE';
    const menuSettText = document.querySelector('#menu-settings-btn .btn-text');
    if (menuSettText) menuSettText.textContent = isFi ? 'ASETUKSET' : 'SETTINGS';

    // Pause Menu
    const pauseTitle = document.querySelector('#pause-menu h2');
    if (pauseTitle) pauseTitle.textContent = isFi ? 'PELI PYSÄYTETTY' : 'GAME PAUSED';
    const pauseResume = document.getElementById('pause-resume-btn');
    if (pauseResume) pauseResume.textContent = isFi ? '⚔️ JATKA PELIÄ' : '⚔️ RESUME GAME';
    const pauseSettings = document.getElementById('pause-settings-btn');
    if (pauseSettings) pauseSettings.textContent = isFi ? '⚙️ ASETUKSET' : '⚙️ SETTINGS';
    const pauseInstructions = document.getElementById('pause-instructions-btn');
    if (pauseInstructions) pauseInstructions.textContent = isFi ? '📜 OHJEET' : '📜 CONTROLS';
    const pauseQuit = document.getElementById('pause-quit-btn');
    if (pauseQuit) pauseQuit.textContent = isFi ? '🏠 PÄÄVALIKKOON' : '🏠 MAIN MENU';

    // HUD Buttons (Maintain exact labels and keys)
    const craftBtn = document.getElementById('open-craft-btn');
    if (craftBtn) {
      const textEl = craftBtn.querySelector('.hud-btn-text');
      if (textEl) textEl.textContent = isFi ? 'LAITTEET' : 'CRAFT';
    }
    const bpBtn = document.getElementById('open-backpack-btn');
    if (bpBtn) {
      const textEl = bpBtn.querySelector('.hud-btn-text');
      if (textEl) textEl.textContent = isFi ? 'INVENTAARIO' : 'INVENTORY';
    }
    const skillsBtn = document.getElementById('open-skills-btn');
    if (skillsBtn) {
      const textEl = skillsBtn.querySelector('.hud-btn-text');
      if (textEl) textEl.textContent = isFi ? 'TAIDOT' : 'SKILLS';
    }
    const mapBtn = document.getElementById('open-map-btn');
    if (mapBtn) {
      const textEl = mapBtn.querySelector('.hud-btn-text');
      if (textEl) textEl.textContent = isFi ? 'KARTTA' : 'MAP';
    }
    const buildBtn = document.getElementById('open-build-btn');
    if (buildBtn) {
      const textEl = buildBtn.querySelector('.hud-btn-text');
      if (textEl) textEl.textContent = isFi ? 'RAKENNA' : 'BUILD';
    }
    const pauseBtn = document.getElementById('open-pause-btn');
    if (pauseBtn) {
      const textEl = pauseBtn.querySelector('.hud-btn-text');
      if (textEl) textEl.textContent = isFi ? 'VALIKKO' : 'MENU';
    }

    // HUD Controls Hint
    const hudHints = document.querySelectorAll('.hud-controls-hint span');
    if (hudHints && hudHints.length >= 6) {
      hudHints[0].textContent = isFi ? '[1-4] Erikoisliikkeet' : '[1-4] Skills';
      hudHints[1].textContent = isFi ? '[V] Kamera 1st/3rd' : '[V] Camera 1st/3rd';
      hudHints[2].textContent = isFi ? '[C] Valmista' : '[C] Craft';
      hudHints[3].textContent = isFi ? '[I] Tavaraluettelo' : '[I] Inventory';
      hudHints[4].textContent = isFi ? '[O] Taidot' : '[O] Skill Tree';
      hudHints[5].textContent = isFi ? '[E] Vuorovaikuta' : '[E] Interact';
    }

    // Quest Log Header
    const qlHeader = document.querySelector('.quest-log-header');
    if (qlHeader) qlHeader.textContent = isFi ? '📋 TEHTÄVÄT' : '📋 QUEST LOG';

    // Update Hotbar
    if (hotbar) {
      hotbar.sync();
      hotbar.render();
    }
  };

  updateUILanguage(Localization.getLanguage());
  window.addEventListener('languageChanged', (e) => {
    updateUILanguage(e.detail.lang);
  });

  // --- Pointer Lock Controls & Pause Menu ---
  let lastResumeTime = 0;
  let lastMenuCloseTime = 0;

  const safeLockControls = () => {
    if (!isGameStarted) return;
    try {
      lastResumeTime = performance.now();
      const p = controls.lock();
      if (p && p.catch) p.catch(() => {});
    } catch (e) {}
  };
  window.safeLockControls = safeLockControls;

  window.restoreGameFocus = () => {
    if (!isGameStarted) return;
    const isTouch = (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      /Android|iPhone|iPad|iPod|Windows Phone|webOS|BlackBerry/i.test(navigator.userAgent) ||
      window.innerWidth <= 900
    );
    if (isTouch) {
      if (controls) controls.isLocked = true;
      return;
    }
    // Desktop: lock pointer
    safeLockControls();
  };

  document.addEventListener('pointerlockerror', () => {
    // Gracefully handle browser pointer lock cooldown rejection without UI lockup
  });

  const isAnyGameMenuOpen = () => {
    return (craftingMenu && craftingMenu.isOpen) ||
           (backpackScreen && backpackScreen.isOpen) ||
           (mapScreen && mapScreen.isOpen) ||
           (skillTree && skillTree.isOpen) ||
           (characterCreator && characterCreator.isOpen) ||
           (pauseMenu && pauseMenu.classList.contains('active')) ||
           (mainMenu && mainMenu.style.display !== 'none') ||
           document.querySelector('.menu-modal.active') ||
           document.querySelector('#death-screen.active') ||
           (npcManager && npcManager.activeNPC !== null) ||
           (devMode && (devMode.isActive || devMode.isPromptOpen)) ||
           Boolean(document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA'));
  };

  controls.addEventListener('lock', () => {
    if (crosshair && isGameStarted) crosshair.style.display = 'block';
    if (pauseMenu) pauseMenu.classList.remove('active');
  });

  controls.addEventListener('unlock', () => {
    if (mobileControls && mobileControls.isTouchDevice) return;
    if (isAnyGameMenuOpen() && crosshair) crosshair.style.display = 'none';
    if (!isGameStarted) return;

    const now = performance.now();
    // Prevent immediate bounce-back into pause menu if we just resumed or closed an in-game screen
    if (now - lastResumeTime < 800 || now - lastMenuCloseTime < 800) return;

    if (!isAnyGameMenuOpen() && pauseMenu) {
      pauseMenu.style.display = '';
      pauseMenu.classList.add('active');
    }
  });

  const resumeGame = () => {
    if (pauseMenu) {
      pauseMenu.style.display = '';
      pauseMenu.classList.remove('active');
    }
    if (crosshair && isGameStarted) crosshair.style.display = 'block';
    lastResumeTime = performance.now();
    lastMenuCloseTime = performance.now();
    window.restoreGameFocus();
  };

  // Seamless mouse movement camera look when resuming from ESC before pointer lock completes
  const _eulerCam = new THREE.Euler(0, 0, 0, 'YXZ');
  window.addEventListener('mousemove', (e) => {
    if (!isGameStarted || isAnyGameMenuOpen() || player.isDead) return;

    if (!controls.isLocked) {
      const movementX = e.movementX || 0;
      const movementY = e.movementY || 0;
      if (Math.abs(movementX) > 0 || Math.abs(movementY) > 0) {
        const speed = (controls.pointerSpeed || 1.0) * 0.002;
        _eulerCam.setFromQuaternion(camera.quaternion);
        _eulerCam.y -= movementX * speed;
        _eulerCam.x -= movementY * speed;
        _eulerCam.x = Math.max(-Math.PI * 0.48, Math.min(Math.PI * 0.48, _eulerCam.x));
        camera.quaternion.setFromEuler(_eulerCam);
      }

      if (performance.now() - lastResumeTime > 250) {
        safeLockControls();
      }
    }
  });

  if (pauseResumeBtn) {
    const handleResume = (e) => {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      resumeGame();
    };
    pauseResumeBtn.addEventListener('click', handleResume);
    pauseResumeBtn.addEventListener('pointerdown', handleResume);
    pauseResumeBtn.addEventListener('touchend', handleResume);
  }

  const pauseSaveBtn = document.getElementById('pause-save-btn');
  if (pauseSaveBtn) {
    pauseSaveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const payload = saveSystem.createSavePayload();
      saveSystem.saveToLocalStorage();
      if (accountSystem && accountSystem.isLoggedIn()) {
        accountSystem.saveCurrentProfile(payload);
        if (hud) hud.showNotification(`💾 Edistyminen tallennettu tilillesi: ${accountSystem.getCurrentUsername()}!`, 4000);
      } else {
        if (hud) hud.showNotification(`💾 Tallennettu laitteelle! Avaa TILI valikosta tallentaaksesi pysyvästi profiilille.`, 4500);
      }
      if (audioManager && audioManager.playPickup) audioManager.playPickup();
    });
  }

  const pauseLoadBtn = document.getElementById('pause-load-btn');
  if (pauseLoadBtn && saveFileInput) {
    pauseLoadBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      saveFileInput.click();
    });
  }

  if (pauseInstructionsBtn) {
    pauseInstructionsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openModal('modal-instructions');
    });
  }

  if (pauseQuitBtn) {
    pauseQuitBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (pauseMenu) pauseMenu.classList.remove('active');
      if (mainMenu) mainMenu.style.display = 'flex';
      if (hudEl) hudEl.style.display = 'none';
      if (hotbarEl) hotbarEl.style.display = 'none';
      if (minimapEl) minimapEl.style.display = 'none';
      if (clockEl) clockEl.style.display = 'none';
      if (questLogEl) questLogEl.style.display = 'none';
      if (invDisplayEl) invDisplayEl.style.display = 'none';
      isGameStarted = false;
    });
  }

  // --- Fullscreen Toggle System ---
  const toggleFullscreen = () => {
    if (audioManager) audioManager.ensureContext();
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      const el = document.documentElement;
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {});
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  };
  window.toggleGameFullscreen = toggleFullscreen;

  ['hud-fullscreen-btn', 'menu-fullscreen-btn', 'pause-fullscreen-btn'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFullscreen();
      });
    }
  });

  // --- In-Game Instant Restart System (No full browser reload!) ---
  const restartGame = () => {
    if (audioManager) audioManager.ensureContext();
    const isFi = (typeof Localization !== 'undefined' && Localization.lang === 'en') ? false : true;
    const msg = isFi
      ? 'Haluatko varmasti aloittaa alusta? Kaikki tallentamaton edistyminen nollataan.'
      : 'Are you sure you want to restart? All unsaved progress will be reset.';
    if (!window.confirm(msg)) return;

    try {
      localStorage.removeItem('tikapoo_savegame');
      localStorage.removeItem('tikapoo_daynight');
      localStorage.removeItem('tikapoo_quests');
      localStorage.removeItem('tikapoo_skills');
      localStorage.removeItem('tikapoo_world_edits');
      localStorage.removeItem('tikapoo_character');
      localStorage.removeItem('tikapoo_defeated_boss_ids');
      localStorage.removeItem('tikapoo_boss_progress');
      localStorage.removeItem('tikapoo_achievements');
    } catch (e) {}

    // 1. Reset player stats, state and position to spawn point (0, 0)
    if (player) {
      player.health = player.maxHealth || 100;
      player.stamina = player.maxStamina || 100;
      player.hunger = 100;
      player.thirst = 100;
      player.energy = 100;
      player.level = 1;
      player.xp = 0;
      player.xpToNext = 100;
      player.isDead = false;
      player.activeEffects = [];

      const startY = world ? world.getGroundHeight(0, 0) + 0.2 : 5.0;
      if (player.playerPos) player.playerPos.set(0, startY, 0);
      if (player.group) player.group.position.set(0, startY, 0);
      if (controls && controls.getObject) {
        controls.getObject().position.set(0, startY, 0);
      }
      player.unequipCurrentTool();
    }

    // 2. Reset Inventory and restore starter items
    if (inventory) {
      inventory.items = {
        stick: 6,
        stone: 6,
        wood: 12,
        food_apple: 4,
        potion_health: 1
      };
      inventory.equippedTool = null;
      inventory.equippedArmor = null;
      inventory.updateUI();
      inventory.updateQuickslotsUI();
    }

    // 3. Reset DayNightCycle to morning 09:00
    if (dayNightCycle) {
      dayNightCycle.time = 0.375;
    }

    // 4. Reset BossManager to Boss 0 (Sarvipeto)
    if (bossManager) {
      bossManager.defeatedBossIds = new Set();
      bossManager.unlockedBossIndex = 0;
      if (bossManager.bossHudEl) bossManager.bossHudEl.style.display = 'none';
      bossManager.spawnActiveBosses();
    }

    // 5. Reset Enemies in world
    if (enemyManager) {
      enemyManager.enemies.forEach(e => {
        if (e.mesh) scene.remove(e.mesh);
      });
      enemyManager.enemies = [];
      enemyManager.spawnInitialBiomeEnemies();
    }

    // 6. Reset Quests & SkillTree
    if (questManager && questManager.resetQuests) {
      questManager.resetQuests();
    }
    if (skillTree) {
      skillTree.unlockedSkills = new Set();
      skillTree.availablePoints = 0;
    }

    // 7. Stop boss music if playing and resume ambient
    if (audioManager) {
      audioManager.stopBossMusic();
      audioManager.playLevelUp();
    }

    // 8. Close pause menu and unpause cleanly
    if (pauseMenu) pauseMenu.classList.remove('active');
    if (controls) controls.isLocked = true;
    if (mobileControls && mobileControls.syncUIState) mobileControls.syncUIState();
    resumeGame();

    if (hud) {
      hud.updateVitals(player);
      hud.showNotification(
        isFi ? '🎮 Peli nollattu! Tervetuloa takaisin Pohjolaan!' : '🎮 Game reset! Welcome back to Pohjola!',
        5000
      );
    }
  };

  const pauseRestartBtn = document.getElementById('pause-restart-btn');
  if (pauseRestartBtn) {
    const handleRestart = (e) => {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      restartGame();
    };
    pauseRestartBtn.addEventListener('click', handleRestart);
    pauseRestartBtn.addEventListener('pointerdown', handleRestart);
    pauseRestartBtn.addEventListener('touchend', handleRestart);
  }

  // Global ESC key and browser protection handler
  window.addEventListener('keydown', (e) => {
    // 1. Prevent accidental browser tab close (Ctrl+W), reload (Ctrl+R), print (Ctrl+P), save (Ctrl+S) while playing with WASD
    if (e.ctrlKey && (e.code === 'KeyW' || e.code === 'KeyR' || e.code === 'KeyS' || e.code === 'KeyP' || e.code === 'KeyQ')) {
      e.preventDefault();
    }
    if (e.ctrlKey && e.shiftKey && (e.code === 'KeyW' || e.code === 'KeyR')) {
      e.preventDefault();
    }

    if (e.code === 'Escape') {
      // If Skill Tree is open, close it
      if (skillTree && skillTree.isOpen) {
        e.preventDefault();
        e.stopPropagation();
        lastMenuCloseTime = performance.now();
        skillTree.close();
        return;
      }

      // If Crafting Menu is open, close it
      if (craftingMenu && craftingMenu.isOpen) {
        e.preventDefault();
        e.stopPropagation();
        lastMenuCloseTime = performance.now();
        craftingMenu.close();
        return;
      }

      // If Backpack is open, close it
      if (backpackScreen && backpackScreen.isOpen) {
        e.preventDefault();
        e.stopPropagation();
        lastMenuCloseTime = performance.now();
        backpackScreen.close();
        return;
      }

      // If Map is open, close it
      if (mapScreen && mapScreen.isOpen) {
        e.preventDefault();
        e.stopPropagation();
        lastMenuCloseTime = performance.now();
        mapScreen.close();
        return;
      }

      // If NPC dialogue is open, close it
      if (npcManager && npcManager.activeNPC) {
        e.preventDefault();
        e.stopPropagation();
        lastMenuCloseTime = performance.now();
        npcManager.closeDialogue();
        return;
      }

      // If Dev Password prompt is open, close it
      if (devMode && devMode.isPromptOpen) {
        e.preventDefault();
        e.stopPropagation();
        lastMenuCloseTime = performance.now();
        devMode.closePasswordPrompt();
        return;
      }

      // If Dev Mode is open, exit it
      if (devMode && devMode.isActive) {
        e.preventDefault();
        e.stopPropagation();
        lastMenuCloseTime = performance.now();
        devMode.exit();
        return;
      }

      // If any menu modal is open (Instructions, Lore, Settings)
      const activeModal = document.querySelector('.menu-modal.active');
      if (activeModal) {
        e.preventDefault();
        e.stopPropagation();
        lastMenuCloseTime = performance.now();
        activeModal.classList.remove('active');
        if (isGameStarted && pauseMenu && !craftingMenu.isOpen && !backpackScreen.isOpen && !mapScreen.isOpen && (!npcManager || !npcManager.activeNPC)) {
          pauseMenu.classList.add('active');
        }
        return;
      }

      // If Character Creator is open, close it and return to main menu
      if (characterCreator && characterCreator.isOpen) {
        e.preventDefault();
        e.stopPropagation();
        characterCreator.close();
        if (mainMenu) mainMenu.style.display = 'flex';
        return;
      }

      // If Main Menu is open and user presses ESC: immediately start / enter game!
      if (mainMenu && mainMenu.style.display !== 'none') {
        e.preventDefault();
        e.stopPropagation();
        startGame();
        return;
      }

      // If game is started and Pause Menu is open, resume game cleanly!
      if (isGameStarted && pauseMenu && pauseMenu.classList.contains('active')) {
        e.preventDefault();
        e.stopPropagation();
        resumeGame();
        return;
      }

      // If game is started and no menus are open, pressing ESC opens the Pause Menu!
      if (isGameStarted && pauseMenu && !pauseMenu.classList.contains('active')) {
        e.preventDefault();
        e.stopPropagation();
        lastMenuCloseTime = performance.now();
        pauseMenu.style.display = '';
        pauseMenu.classList.add('active');
        if (controls && controls.isLocked) {
          controls.unlock();
        }
        return;
      }
    }
  }, { passive: false });

  // Click on canvas always relocks pointer if in-game and no modal is active
  renderer.domElement.addEventListener('click', () => {
    if (isGameStarted && !controls.isLocked) {
      const anyModal = document.querySelector('.modal.active') ||
                        document.querySelector('.menu-modal.active') ||
                        document.querySelector('#crafting-menu.active') ||
                        document.querySelector('#map-screen.active') ||
                        document.querySelector('#backpack-screen.active') ||
                        document.querySelector('#npc-dialogue.active') ||
                        document.querySelector('#pause-menu.active') ||
                        document.querySelector('#dev-password-modal.active') ||
                        (skillTree && skillTree.isOpen) ||
                        (devMode && (devMode.isActive || devMode.isPromptOpen)) ||
                        (characterCreator && characterCreator.isOpen);
      if (!anyModal) {
        safeLockControls();
      }
    }
  });

  // Proximity helpers for player activities
  function getNearbyCampfire(pos, radius = 4.2) {
    const fires = [
      ...world.campfires.map(c => ({ x: c.baseX, z: c.baseZ, y: c.baseY })),
      ...(buildingSystem.campfires || []).map(c => ({ x: c.position.x, z: c.position.z, y: c.position.y }))
    ];
    for (const f of fires) {
      if (Math.hypot(pos.x - f.x, pos.z - f.z) < radius) {
        return f;
      }
    }
    return null;
  }

  function isNearWaterEdge(pos) {
    const riverX = -16 + Math.sin(pos.z * 0.015) * 20;
    const distToRiver = Math.abs(pos.x - riverX);
    return distToRiver < 13 && pos.y < 1.4;
  }

  // --- Unified Interaction Trigger (Used by Key [E], Mobile Touch Buttons, and On-Screen Prompts) ---
  function triggerInteraction() {
    if (!isGameStarted) return false;
    const isFi = (typeof Localization !== 'undefined' && Localization.lang === 'en') ? false : true;

    // 1. NPC interaction takes precedence when looking at NPC
    if (npcManager && npcManager.targetedNPC) {
      npcManager.onKeyE();
      return true;
    }

    const pPos = player ? player.getPosition() : null;
    if (!pPos) return false;

    // 1.5 Player Gravestone loot recovery
    let nearbyTombstone = null;
    if (world && world.tombstones) {
      for (const t of world.tombstones) {
        if (pPos.distanceTo(t.position) < 3.8) {
          nearbyTombstone = t;
          break;
        }
      }
    }

    if (nearbyTombstone) {
      let countRecovered = 0;
      if (nearbyTombstone.items && inventory) {
        for (const [itemKey, amt] of Object.entries(nearbyTombstone.items)) {
          if (amt > 0) {
            inventory.add(itemKey, amt);
            countRecovered += amt;
          }
        }
      }
      if (audioManager && audioManager.playPickup) {
        audioManager.playPickup();
      }
      if (hud) {
        hud.showNotification(
          isFi ? `🪦 Sait tavarasi takaisin hautakiveltä! (+${countRecovered} esinettä)` : `🪦 Recovered your items from Gravestone! (+${countRecovered} items)`,
          4000
        );
        if (hud.showPickupText) hud.showPickupText(isFi ? '🪦 +Tavarat palautettu' : '🪦 +Items recovered');
        if (hud.hideTooltip) hud.hideTooltip();
      }
      world.removeTombstone(nearbyTombstone);
      return true;
    }

    // 2. Hidden Treasure Chests in the wild
    let nearbyChest = null;
    if (world && world.wildChests) {
      for (const c of world.wildChests) {
        if (!c.isOpened && pPos.distanceTo(c.position) < 3.8) {
          nearbyChest = c;
          break;
        }
      }
    }

    if (nearbyChest) {
      try {
        nearbyChest.isOpened = true;
        // Hide glow beacon cleanly (zero scene graph re-evaluation or shader recompilation hitch)
        if (nearbyChest.glowMarker) {
          nearbyChest.glowMarker.visible = false;
        }
        if (nearbyChest.glowLight) {
          nearbyChest.glowLight.intensity = 0;
          nearbyChest.glowLight.visible = false;
        }

        try {
          if (audioManager && audioManager.playChestOpen) {
            audioManager.playChestOpen();
          } else if (audioManager && audioManager.playPickup) {
            audioManager.playPickup();
          }
        } catch (audioErr) {
          console.warn('Chest audio notice:', audioErr);
        }

        // Visual chest lid opening animation on the armature bone ONLY
        if (nearbyChest.mesh) {
          const topBone = nearbyChest.mesh.getObjectByName('Chest_Top');
          if (topBone) {
            topBone.rotation.x = -Math.PI * 0.45;
          }
        }

        // Generous treasure rewards added in a single clean batch update
        const chestRewards = [
          { item: 'bronze', count: 2 },
          { item: 'iron', count: 2 },
          { item: 'cookedMeat', count: 3 },
          { item: 'leather', count: 3 },
          { item: 'wood', count: 14 },
          { item: 'stone', count: 10 }
        ];
        if (inventory) {
          if (inventory.addBatch) {
            inventory.addBatch(chestRewards);
          } else {
            chestRewards.forEach(r => inventory.add(r.item, r.count));
          }
        }
        if (hud) {
          if (hud.showNotification) {
            hud.showNotification(
              isFi ? '🎁 Aarrearkku avattu! (+2 Rauta, +2 Pronssi, +3 Liha, +3 Nahka, +14 Puu, +10 Kivi)' : '🎁 Treasure Chest opened! (+2 Iron, +2 Bronze, +3 Cooked Meat, +3 Leather, +14 Wood, +10 Stone)',
              3500
            );
          }
          if (hud.showPickupText) {
            hud.showPickupText(isFi ? '🎁 +Aarteet kerätty!' : '🎁 +Treasure collected!');
          }
          if (hud.hideTooltip) {
            hud.hideTooltip();
          }
        }
      } catch (err) {
        console.error('Chest opening error handled:', err);
      }
      return true;
    }

    const nearFire = getNearbyCampfire(pPos);

    // 2b. Ancient Altar Trophy Offering
    const distToAltar = Math.hypot(pPos.x - 85, pPos.z - (-25));
    if (distToAltar < 6.0) {
      if (inventory.has('trophy_ancient_stag', 1)) {
        inventory.remove('trophy_ancient_stag', 1);
        player.activateBossBuff('stag');
        if (hud) hud.showNotification('⚡ ALTTARI SYTTYY VALOON! Sait "Metsurin Voima" -buffin! (+100% Puunhakkuunopeus, paina [F] aktivoidaksesi)');
        return true;
      } else if (inventory.has('trophy_swamp_wyrm', 1)) {
        inventory.remove('trophy_swamp_wyrm', 1);
        player.activateBossBuff('wyrm');
        if (hud) hud.showNotification('⚡ ALTTARI SYTTYY VALOON! Sait "Suojuoksija" -buffin! (+35% Juoksunopeus, -50% staminankulutus)');
        return true;
      } else if (inventory.has('trophy_mountain_golem', 1)) {
        inventory.remove('trophy_mountain_golem', 1);
        player.activateBossBuff('golem');
        if (hud) hud.showNotification('⚡ ALTTARI SYTTYY VALOON! Sait "Vuoren Kilpi" -buffin! (+50% Panssari)');
        return true;
      } else if (inventory.has('trophy_rune_wraith', 1)) {
        inventory.remove('trophy_rune_wraith', 1);
        player.activateBossBuff('wraith');
        if (hud) hud.showNotification('⚡ ALTTARI SYTTYY VALOON! Sait "Arkaaninen Voima" -buffin!');
        return true;
      } else if (inventory.has('trophy_shadow_dragon', 1)) {
        inventory.remove('trophy_shadow_dragon', 1);
        player.activateBossBuff('dragon');
        if (hud) hud.showNotification('👑 JUMALTEN SIUNAUS! Sait "Lohikäärmeen Raivo" -buffin!');
        return true;
      }
    }

    // 3. Campfire cooking & resting
    if (nearFire) {
      if (inventory.has('meat', 1)) {
        inventory.remove('meat', 1);
        inventory.add('cookedMeat', 1);
        if (audioManager && audioManager.playEat) audioManager.playEat();
        if (hud) hud.showNotification(isFi ? '🍗 Paistoit mehukkaan paistin leiritulella! (+50 Nälkä, +35 HP)' : '🍗 Cooked a juicy roast on the campfire! (+50 Hunger, +35 HP)');
        questManager.onCraft('cookedMeat');
      } else if (inventory.has('salmon', 1) || inventory.has('pike', 1) || inventory.has('trout', 1)) {
        const fish = inventory.has('salmon', 1) ? 'salmon' : (inventory.has('pike', 1) ? 'pike' : 'trout');
        inventory.remove(fish, 1);
        inventory.add('cookedFish', 1);
        if (audioManager && audioManager.playEat) audioManager.playEat();
        if (hud) hud.showNotification(isFi ? '🍲 Paistoit kalan rapeaksi leiritulella! (+45 Nälkä, +30 HP)' : '🍲 Cooked fish crispy on the campfire! (+45 Hunger, +30 HP)');
        questManager.onCraft('cookedFish');
      }
      player.tryInteract();
      return true;
    }

    // 4. Water drinking
    if (isNearWaterEdge(pPos)) {
      player.tryInteract();
      return true;
    }

    // 5. General fallback
    if (player && player.tryInteract) {
      player.tryInteract();
    }
    return false;
  }
  window.triggerGameInteraction = triggerInteraction;

  // Direct click / tap on HUD interaction tooltip triggers interaction
  const hudTooltip = document.getElementById('tooltip');
  if (hudTooltip) {
    const handleTooltipTap = (e) => {
      e.stopPropagation();
      e.preventDefault();
      triggerInteraction();
    };
    hudTooltip.addEventListener('click', handleTooltipTap);
    hudTooltip.addEventListener('touchend', handleTooltipTap);
  }

  // --- Keyboard: E for Interactions ---
  window.addEventListener('keydown', (e) => {
    if (!isGameStarted || isAnyGameMenuOpen() || (player && player.isDead)) return;

    if (e.code === 'KeyE') {
      triggerInteraction();
    }
  });

  // --- Mouse Interaction Handling (Combat vs Building vs Harvesting vs Shield Block/Parry) ---
  window.addEventListener('mousedown', (e) => {
    if (!isGameStarted || isAnyGameMenuOpen() || (player && player.isDead)) return;

    if (!controls.isLocked) {
      safeLockControls();
    }

    if (e.button === 0) { // Left Click: Attack / Build / Demolish / Action
      if (buildingSystem.isDemolishMode) {
        buildingSystem.tryDemolish();
      } else if (buildingSystem.isPlacing()) {
        buildingSystem.tryPlace(world);
      } else if (inventory && inventory.equippedTool === 'fishingRod') {
        fishingSystem.onAction();
      } else if (resourceNode.isAimingAtHarvestable()) {
        // Harvesting is handled via hold in ResourceNode
      } else {
        // Melee attack enemy or air swing
        combat.performAttack();
      }
    } else if (e.button === 2) { // Right Click: Shield Block & Timed Parry
      e.preventDefault();
      if (player && player.startBlock) {
        player.startBlock();
      }
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (e.button === 2) {
      if (player && player.stopBlock) {
        player.stopBlock();
      }
    }
  });

  // Prevent browser context menu during gameplay so right-click shield guard feels seamless
  window.addEventListener('contextmenu', (e) => {
    if (isGameStarted && !isAnyGameMenuOpen()) {
      e.preventDefault();
    }
  });

  // --- Window Resize Handler ---
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    const maxRatio = (mobileControls && mobileControls.isTouchDevice) ? Math.min(window.devicePixelRatio, 1.5) : Math.min(window.devicePixelRatio, 2.0);
    renderer.setPixelRatio(maxRatio);
  });

  // --- Main Game Loop & Performance Monitor ---
  const clock = new THREE.Clock();
  let frameCount = 0;
  let lastFpsTime = performance.now();

  // Reusable vector for camera heading calculation in animate loop (prevents GC allocation churn)
  const _camDirReuse = new THREE.Vector3();

  function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const delta = Math.min(0.1, clock.getDelta());

    // FPS Counter Update
    frameCount++;
    if (time - lastFpsTime >= 350) {
      const fps = Math.round((frameCount * 1000) / (time - lastFpsTime));
      const ms = ((time - lastFpsTime) / frameCount).toFixed(1);
      if (fpsEl && showFps) {
        fpsEl.textContent = `${fps} FPS • ${ms}ms`;
      }
      frameCount = 0;
      lastFpsTime = time;
    }

    // --- Cinematic Background Camera Orbit During Main Menu ---
    if (!isGameStarted) {
      menuOrbitAngle += delta * 0.12;
      camera.position.x = 8 + Math.cos(menuOrbitAngle) * 36;
      camera.position.z = 4 + Math.sin(menuOrbitAngle) * 36;
      camera.position.y = 11 + Math.sin(menuOrbitAngle * 0.6) * 2;
      camera.lookAt(2, 3.2, -6);

      world.update(delta, new THREE.Vector3(8, 3, 4));
      dayNightCycle.update(delta * 0.4);
      renderer.render(scene, camera);
      return;
    }

    // Dev Mode Freecam & Simulation Freeze Handling
    if (devMode && devMode.isActive) {
      devMode.update(delta);
      if (devMode.isSimulationFrozen) {
        renderer.render(scene, camera);
        return;
      }
    }

    const activeInput = (!isAnyGameMenuOpen() && !player.isDead);

    // Update modules
    player.update(delta, world, combat);
    skillTree.update(delta);
    hotbar.update(delta);
    world.update(delta, player.getPosition());
    dayNightCycle.update(delta);
    lootManager.update(delta, player.getPosition());
    ragdollManager.update(delta);
    animalManager.update(delta, player.getPosition());
    fishingSystem.update(delta);
    farmingSystem.update(delta);
    resourceNode.update(delta, camera, activeInput);
    buildingSystem.update(delta, camera, activeInput, world);
    enemyManager.update(delta, player.getPosition(), dayNightCycle, player, camera);
    bossManager.update(delta, player.getPosition());
    combat.update(delta);
    npcManager.update(delta, camera, activeInput);
    if (mobileControls) mobileControls.update(delta);

    // Contextual interaction tooltips for gravestones, chests, campfire and water
    const pPos = player.getPosition();
    const isTouch = window.isTouchDevice || ('ontouchstart' in window) || /Android|iPhone|iPad|iPod|Windows Phone|webOS|BlackBerry/i.test(navigator.userAgent) || window.innerWidth <= 900;
    const isFi = (typeof Localization !== 'undefined' && Localization.lang === 'en') ? false : true;

    // Show tooltips whenever no modal is active (don't strictly require desktop pointer lock)
    const anyModal = (craftingMenu && craftingMenu.isOpen) || (mapScreen && mapScreen.isOpen) || (backpackScreen && backpackScreen.isOpen) || (skillTree && skillTree.isOpen) || (characterCreator && characterCreator.isOpen) || (pauseMenu && pauseMenu.classList.contains('active'));

    if (!anyModal && !resourceNode.isAimingAtHarvestable() && !npcManager.targetedNPC) {
      const nearTomb = (world && world.tombstones) ? world.tombstones.find(t => pPos.distanceTo(t.position) < 3.8) : null;
      let nearbyChest = null;
      if (!nearTomb && world && world.wildChests) {
        for (const c of world.wildChests) {
          if (!c.isOpened && pPos.distanceTo(c.position) < 3.8) {
            nearbyChest = c;
            break;
          }
        }
      }

      if (nearTomb) {
        hud.showTooltip(isTouch
          ? (isFi ? '🪦 Kerää tavarat hautakiveltä (napauta)' : '🪦 Recover items from Gravestone (tap)')
          : (isFi ? '[E] Kerää tavarat hautakiveltä 🪦' : '[E] Recover items from Gravestone 🪦')
        );
      } else if (nearbyChest) {
        hud.showTooltip(isTouch
          ? (isFi ? '🎁 Avaa Aarrearkku (napauta)' : '🎁 Open Treasure Chest (tap)')
          : (isFi ? '[E] Avaa Aarrearkku 🎁' : '[E] Open Treasure Chest 🎁')
        );
      } else {
        const nearFire = getNearbyCampfire(pPos);
        if (nearFire) {
          const canCook = inventory.has('meat', 1) || inventory.has('trout', 1) || inventory.has('pike', 1) || inventory.has('salmon', 1);
          if (canCook) {
            hud.showTooltip(isTouch
              ? (isFi ? '🍗 Paista ruokaa nuotiolla (napauta)' : '🍗 Cook food on campfire (tap)')
              : (isFi ? '[E] Paista raaka liha tai kala leiritulella 🔥' : '[E] Cook meat or fish on campfire 🔥')
            );
          } else {
            hud.showTooltip(isTouch
              ? (isFi ? '🔥 Lepää leiritulella (napauta)' : '🔥 Rest by campfire (tap)')
              : (isFi ? '[E] Lepää leiritulella 🔥' : '[E] Rest by campfire 🔥')
            );
          }
        } else if (isNearWaterEdge(pPos)) {
          hud.showTooltip(isTouch
            ? (isFi ? '💧 Juo raikasta tunturivettä (napauta)' : '💧 Drink fresh mountain water (tap)')
            : (isFi ? '[E] Juo raikasta tunturivettä 💧' : '[E] Drink mountain river water 💧')
          );
        } else {
          hud.hideTooltip();
        }
      }
    } else if (!anyModal && (resourceNode.isAimingAtHarvestable() || npcManager.targetedNPC)) {
      // Handled by resourceNode or npcManager
    } else {
      hud.hideTooltip();
    }

    // Check exploration proximity to Ancient Ruins Altar (x: 85, z: -25) and Highland Watchtower (x: 30, z: -68)
    const distToAltar = Math.hypot(pPos.x - 85, pPos.z - (-25));
    if (distToAltar < 16) {
      questManager.onExploreAltar();
    }
    if (distToAltar < 6.0 && !anyModal) {
      // Check if player has any Boss Trophy to offer at the Altar
      const hasStagTrophy = inventory.has('trophy_ancient_stag', 1);
      const hasWyrmTrophy = inventory.has('trophy_swamp_wyrm', 1);
      const hasGolemTrophy = inventory.has('trophy_mountain_golem', 1);
      const hasWraithTrophy = inventory.has('trophy_rune_wraith', 1);
      const hasDragonTrophy = inventory.has('trophy_shadow_dragon', 1);

      if (hasStagTrophy || hasWyrmTrophy || hasGolemTrophy || hasWraithTrophy || hasDragonTrophy) {
        hud.showTooltip(isTouch
          ? '🏛️ Uhraa Trophy Alttarille [Paina E]'
          : '[E] 🏛️ Aseta Päävihollisen Trophy Alttarille & Lunasta Buffi!'
        );
      } else {
        hud.showTooltip('🏛️ Muinainen Alttari (Tuo tähän bossien Trophyja saadaksesi voimakkaita Buffeja)');
      }
    }
    if (Math.hypot(pPos.x - 30, pPos.z - (-68)) < 12) {
      questManager.onExploreWatchtower();
    }

    // Update Biome Background Music based on player location
    const currentBiome = getBiomeKey(pPos.x, pPos.z);
    audioManager.updateBiomeMusic(currentBiome, delta);

    // Biome environmental hazards & gear requirements
    if (typeof biomeHazardTimer === 'undefined') window.biomeHazardTimer = 0;
    window.biomeHazardTimer += delta;
    if (window.biomeHazardTimer >= 3.0) {
      window.biomeHazardTimer = 0;
      const isFi = (typeof Localization !== 'undefined' && Localization.lang === 'en') ? false : true;

      if (currentBiome === 'mountain') {
        const hasColdArmor = inventory && (inventory.equippedArmor === 'armor_wolf' || inventory.equippedArmor === 'armor_silver' || inventory.equippedArmor === 'armor_blackmetal');
        const nearFire = buildingSystem && buildingSystem.campfires && buildingSystem.campfires.some(c => Math.hypot(c.position.x - pPos.x, c.position.z - pPos.z) < 8.0);
        if (!hasColdArmor && !nearFire) {
          player.takeDamage(2);
          hud.showNotification(
            isFi ? '❄️ Jäätävä tunturipakkanen! Tarvitset susiturkin tai nuotion lämmön!' : '❄️ Freezing mountain cold! You need wolf armor or fire warmth!',
            3000
          );
        }
      } else if (currentBiome === 'ashlands') {
        const hasHeatArmor = inventory && (inventory.equippedArmor === 'armor_blackmetal' || inventory.equippedArmor === 'armor_flametal');
        if (!hasHeatArmor) {
          player.takeDamage(3);
          hud.showNotification(
            isFi ? '🔥 Sysivuoren polttava pätsi! Tarvitset mustan metallin varusteet!' : '🔥 Scorching ashlands heat! You need black metal armor!',
            3000
          );
        }
      }
    }

    // Locked Boss Altar Proximity Warning
    if (bossManager && bossManager.bossDefs) {
      for (let bi = bossManager.unlockedBossIndex + 1; bi < bossManager.bossDefs.length; bi++) {
        const bDef = bossManager.bossDefs[bi];
        if (Math.hypot(pPos.x - bDef.arenaPos.x, pPos.z - bDef.arenaPos.z) < 22) {
          if (!window.lastLockedBossNotify || performance.now() - window.lastLockedBossNotify > 9000) {
            window.lastLockedBossNotify = performance.now();
            const prevBoss = bossManager.bossDefs[bi - 1];
            const isFi = (typeof Localization !== 'undefined' && Localization.lang === 'en') ? false : true;
            hud.showNotification(
              isFi ? `🔒 ${bDef.name} nukkuu sinetöitynä! Kukista ensin ${prevBoss.name}!` : `🔒 ${bDef.name} is sealed! Defeat ${prevBoss.name} first!`,
              4500
            );
          }
        }
      }
    }

    // Dynamic Boss Battle Music (when near alive boss)
    const bosses = bossManager ? bossManager.bosses : [];
    const activeBossNear = bosses.find(b => b && b.isAlive && b.mesh && b.mesh.position.distanceTo(pPos) < 50);
    if (activeBossNear) {
      audioManager.startBossMusic(activeBossNear.def || activeBossNear);
    } else if (audioManager.isBossMusicActive) {
      audioManager.stopBossMusic();
    }

    // Update Mini-map radar (color coded by biome with fog of war) and In-game Clock
    hud.updateClock(dayNightCycle.getClockTime());
    camera.getWorldDirection(_camDirReuse);
    const heading = Math.atan2(_camDirReuse.x, -_camDirReuse.z);

    hud.updateMinimap(
      player.getPosition(),
      heading,
      enemyManager.enemies,
      buildingSystem.campfires,
      currentBiome,
      world.tombstones,
      bossManager ? bossManager.getBossMarkers() : []
    );

    // Render 3D Scene
    renderer.render(scene, camera);
  }

    // Start Game Loop
    animate();
  } catch (fatalInitErr) {
    console.error('Fatal initialization error:', fatalInitErr);
    const loadingText = document.getElementById('loading-text');
    if (loadingText) loadingText.textContent = 'Virhe käynnistyksessä: ' + (fatalInitErr.message || fatalInitErr);
  }
}

// Start Game
init().catch(err => console.error('Unhandled init error:', err));
