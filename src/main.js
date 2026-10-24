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
import BossManager from './BossManager.js';
import SkillTree from './SkillTree.js';
import CharacterCreator from './CharacterCreator.js';
import MobileControls from './MobileControls.js';
import Localization from './Localization.js';
import DevMode from './DevMode.js';

window.addEventListener('error', (event) => {
  console.warn('Recovered from unhandled runtime error:', event.message, event.filename, event.lineno);
});
window.addEventListener('unhandledrejection', (event) => {
  console.warn('Recovered from unhandled promise rejection:', event.reason);
});

async function init() {
  // --- Loading Screen Preload ---
  const loadingScreen = document.getElementById('loading-screen');
  const loadingBar = document.getElementById('loading-bar');
  const loadingText = document.getElementById('loading-text');

  const assetLoader = new AssetLoader();
  await assetLoader.loadAll();

  // Hide loading screen once ready
  if (loadingScreen) {
    loadingScreen.style.display = 'none';
  }

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
  scene.add(camera);

  // Detect mobile & touch devices early for optimal GPU memory & canvas scaling
  const isTouchDevice = (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    /Android|iPhone|iPad|iPod|Windows Phone|webOS|BlackBerry/i.test(navigator.userAgent) ||
    window.innerWidth <= 900
  );

  const renderer = new THREE.WebGLRenderer({
    antialias: !isTouchDevice, // Save precious mobile GPU bandwidth & memory
    powerPreference: 'high-performance',
    precision: isTouchDevice ? 'mediump' : 'highp'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(isTouchDevice ? Math.min(window.devicePixelRatio, 1.25) : Math.min(window.devicePixelRatio, 2.0));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = isTouchDevice ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);

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

  // --- Subsystem Instantiations ---
  const audioManager = new AudioManager();
  const hud = new HUD();
  const inventory = new Inventory(hud, audioManager);
  const world = new World(scene, assetLoader);
  const player = new Player(scene, camera, controls, inventory, hud, audioManager, assetLoader, world);
  const buildingSystem = new BuildingSystem(scene, inventory, hud, audioManager, assetLoader, controls);

  // QuestManager needs inventory, player, hud
  const questManager = new QuestManager(inventory, player, hud);

  // Loot drops manager (spawns 3D physical ground drops on enemy death)
  const lootManager = new LootManager(scene, world, inventory, hud, audioManager, questManager, assetLoader);

  // Wildlife manager (stags, hares, swimming river fish)
  const animalManager = new AnimalManager(scene, world, inventory, hud, audioManager, questManager);

  // Fishing system (cast rod at river, bite detection, timed catch mini-game)
  const fishingSystem = new FishingSystem(scene, world, player, inventory, hud, audioManager, questManager);

  // 5 Biome Bosses System (Unique Mechanics, Arenas, Progressive Unlocks & Legendary Drops)
  const bossManager = new BossManager(scene, world, inventory, hud, audioManager, questManager, assetLoader, player);

  const craftingMenu = new CraftingMenu(inventory, buildingSystem, player, hud, audioManager, controls, questManager);
  const resourceNode = new ResourceNode(scene, world, inventory, hud, player, audioManager, questManager);
  const enemyManager = new EnemyManager(scene, world, inventory, hud, audioManager, questManager, assetLoader, lootManager);
  const combat = new Combat(scene, camera, player, enemyManager, inventory, hud, audioManager, assetLoader, animalManager, bossManager);
  const dayNightCycle = new DayNightCycle(scene, world, hud, audioManager, questManager);

  // Skill Tree & Special Abilities (Keys 1-4, Tree UI on [O])
  const skillTree = new SkillTree(player, combat, hud, audioManager);
  player.skillTree = skillTree;

  // Valheim 8-slot Action Bar (Hotbar) with Top Abilities Bar
  const hotbar = new Hotbar(inventory, player, buildingSystem, combat, hud, audioManager, skillTree);
  inventory.hotbar = hotbar;
  skillTree.hotbar = hotbar;

  // NPC system (needs questManager and assetLoader)
  const npcManager = new NPC(scene, world, questManager, hud, controls, assetLoader);

  // Map screen (M key) with 5 Biome Boss markers & Arenas
  const mapScreen = new MapScreen(world, player, npcManager, enemyManager, buildingSystem, controls, camera, questManager, bossManager);

  // Backpack screen (B key)
  const backpackScreen = new BackpackScreen(inventory, player, controls, hud, hotbar);

  // Nordic Character Creator (live 3D preview, gender, hair, skin, clothing)
  const characterCreator = new CharacterCreator(assetLoader, (charConfig) => {
    player.applyCharacterConfig(charConfig);
    startGame();
  });

  // Developer & Creative Mode (protected by password "kissa")
  const devMode = new DevMode(scene, camera, player, world, enemyManager, animalManager, bossManager, buildingSystem, inventory, hud);

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
        if (inventory.hotbar) inventory.hotbar.selectSlot(4, true);
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

  // Forward buildingSystem quest notifications
  buildingSystem.onPlace = (structureType) => {
    questManager.onBuild(structureType);
  };

  // Set player position above initial terrain spawn
  const initialGroundY = world.getGroundHeight(0, 0);
  player.playerPos.set(0, initialGroundY, 0);

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
  if (menuCharBtn) {
    menuCharBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (mainMenu) mainMenu.style.display = 'none';
      characterCreator.open();
    });
  }

  if (menuPlayBtn) {
    menuPlayBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const hasSavedChar = localStorage.getItem('tikapoo_character');
      if (!hasSavedChar) {
        if (mainMenu) mainMenu.style.display = 'none';
        characterCreator.open();
      } else {
        startGame();
      }
    });
  }

  // --- Menu Modals (Instructions, Lore, Settings) ---
  const openModal = (id) => {
    const m = document.getElementById(id);
    if (m) m.classList.add('active');
  };
  const closeModal = (id) => {
    const m = document.getElementById(id);
    if (m) m.classList.remove('active');
  };

  if (menuInstructionsBtn) {
    menuInstructionsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openModal('modal-instructions');
    });
  }
  if (menuLoreBtn) {
    menuLoreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openModal('modal-lore');
    });
  }
  if (menuSettingsBtn) {
    menuSettingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openModal('modal-settings');
    });
  }

  if (pauseSettingsBtn) {
    pauseSettingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openModal('modal-settings');
    });
  }

  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const target = btn.getAttribute('data-close');
      if (target) closeModal(target);
      if (isGameStarted && !controls.isLocked && pauseMenu &&
          !craftingMenu.isOpen && !backpackScreen.isOpen && !mapScreen.isOpen &&
          (!npcManager || !npcManager.activeNPC)) {
        pauseMenu.classList.add('active');
      }
    });
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

    // HUD Buttons
    const craftBtn = document.getElementById('open-craft-btn');
    if (craftBtn) craftBtn.textContent = isFi ? '⚒️ VALMISTA [C]' : '⚒️ CRAFT [C]';
    const bpBtn = document.getElementById('open-backpack-btn');
    if (bpBtn) bpBtn.textContent = isFi ? '🎒 TAVARAT [I]' : '🎒 INVENTORY [I]';
    const skillsBtn = document.getElementById('open-skills-btn');
    if (skillsBtn) skillsBtn.textContent = isFi ? '⭐ TAIDOT [O]' : '⭐ SKILLS [O]';
    const mapBtn = document.getElementById('open-map-btn');
    if (mapBtn) mapBtn.textContent = isFi ? '🗺️ KARTTA [M]' : '🗺️ MAP [M]';

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

  document.addEventListener('pointerlockerror', () => {
    // Gracefully handle browser pointer lock cooldown rejection without UI lockup
  });

  controls.addEventListener('lock', () => {
    if (crosshair && isGameStarted) crosshair.style.display = 'block';
    if (pauseMenu) pauseMenu.classList.remove('active');
  });

  controls.addEventListener('unlock', () => {
    if (mobileControls && mobileControls.isTouchDevice) return;
    if (crosshair) crosshair.style.display = 'none';
    if (!isGameStarted) return;

    const now = performance.now();
    // Prevent immediate bounce-back into pause menu if we just resumed or closed an in-game screen
    if (now - lastResumeTime < 350 || now - lastMenuCloseTime < 350) return;

    const anyMenuOpen = craftingMenu.isOpen || mapScreen.isOpen || backpackScreen.isOpen ||
                        (skillTree && skillTree.isOpen) ||
                        (npcManager && npcManager.activeNPC !== null) ||
                        (devMode && (devMode.isActive || devMode.isPromptOpen)) ||
                        (characterCreator && characterCreator.isOpen) ||
                        document.querySelector('.menu-modal.active') ||
                        document.querySelector('#dev-password-modal.active');
    if (!anyMenuOpen && pauseMenu) {
      pauseMenu.style.display = '';
      pauseMenu.classList.add('active');
    }
  });

  const resumeGame = () => {
    if (pauseMenu) {
      pauseMenu.style.display = '';
      pauseMenu.classList.remove('active');
    }
    lastResumeTime = performance.now();
    setTimeout(() => {
      safeLockControls();
    }, 70);
  };

  if (pauseResumeBtn) {
    pauseResumeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      resumeGame();
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

  // --- Keyboard: E for Interactions (NPC, Wild Chests, Campfire Cooking, River Drinking) ---
  window.addEventListener('keydown', (e) => {
    if (!controls.isLocked || !isGameStarted) return;

    if (e.code === 'KeyE') {
      // 1. NPC interaction takes precedence when looking at NPC
      if (npcManager.targetedNPC) {
        npcManager.onKeyE();
        return;
      }

      const pPos = player.getPosition();

      // 2. Hidden Treasure Chests in the wild
      let nearbyChest = null;
      if (world && world.wildChests) {
        for (const c of world.wildChests) {
          if (!c.isOpened && pPos.distanceTo(c.position) < 3.2) {
            nearbyChest = c;
            break;
          }
        }
      }

      if (nearbyChest) {
        try {
          nearbyChest.isOpened = true;
          // Clean up glow marker without removing any PointLight (avoids WebGL shader recompilation hitch)
          if (nearbyChest.glowMarker) {
            scene.remove(nearbyChest.glowMarker);
            nearbyChest.glowMarker = null;
          }
          if (nearbyChest.glowLight) {
            nearbyChest.glowLight.intensity = 0;
            nearbyChest.glowLight.visible = false;
          }
          if (audioManager && audioManager.playChestOpen) {
            audioManager.playChestOpen();
          } else if (audioManager && audioManager.playPickup) {
            audioManager.playPickup();
          }

          // Visual chest lid opening animation!
          if (nearbyChest.mesh) {
            nearbyChest.mesh.traverse(child => {
              if (child.name === 'Chest_Wood_Lid' || child.name === 'Chest_Top') {
                child.rotation.x = -Math.PI * 0.45;
              }
            });
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
              hud.showNotification('🎁 Aarrearkku avattu! (+2 Rauta, +2 Pronssi, +3 Liha, +3 Nahka, +14 Puu, +10 Kivi)', 3500);
            }
            if (hud.showPickupText) {
              hud.showPickupText('🎁 +Aarteet kerätty!');
            }
            if (hud.hideTooltip) {
              hud.hideTooltip();
            }
          }
        } catch (err) {
          console.error('Chest opening error handled:', err);
        }
        return;
      }

      const nearFire = getNearbyCampfire(pPos);

      // 3. Campfire cooking & resting
      if (nearFire) {
        if (inventory.has('meat', 1)) {
          inventory.remove('meat', 1);
          inventory.add('cookedMeat', 1);
          audioManager.playEat();
          hud.showNotification('🍗 Paistoit mehukkaan paistin leiritulella! (+50 Nälkä, +35 HP)');
          questManager.onCraft('cookedMeat');
        } else if (inventory.has('salmon', 1) || inventory.has('pike', 1) || inventory.has('trout', 1)) {
          const fish = inventory.has('salmon', 1) ? 'salmon' : (inventory.has('pike', 1) ? 'pike' : 'trout');
          inventory.remove(fish, 1);
          inventory.add('cookedFish', 1);
          audioManager.playEat();
          hud.showNotification('🍲 Paistoit kalan rapeaksi leiritulella! (+45 Nälkä, +30 HP)');
          questManager.onCraft('cookedFish');
        }
        player.tryInteract();
        return;
      }

      // 4. Water drinking
      if (isNearWaterEdge(pPos)) {
        player.tryInteract();
        return;
      }
    }
  });

  // --- Mouse Interaction Handling (Combat vs Building vs Harvesting) ---
  window.addEventListener('mousedown', (e) => {
    if (!controls.isLocked || !isGameStarted) return;

    if (e.button === 0) { // Left Click
      if (buildingSystem.isPlacing()) {
        buildingSystem.tryPlace(world);
      } else if (inventory && inventory.equippedTool === 'fishingRod') {
        fishingSystem.onAction();
      } else if (resourceNode.isAimingAtHarvestable()) {
        // Harvesting is handled via hold in ResourceNode
      } else {
        // Melee attack enemy or air swing
        combat.performAttack();
      }
    }
  });

  // --- Window Resize Handler ---
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    const maxRatio = (mobileControls && mobileControls.isTouchDevice) ? Math.min(window.devicePixelRatio, 1.25) : Math.min(window.devicePixelRatio, 2.0);
    renderer.setPixelRatio(maxRatio);
  });

  // --- Main Game Loop & Performance Monitor ---
  const clock = new THREE.Clock();
  let frameCount = 0;
  let lastFpsTime = performance.now();

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

    const locked = controls.isLocked;

    // Update modules
    player.update(delta, world, combat);
    skillTree.update(delta);
    hotbar.update(delta);
    world.update(delta, player.getPosition());
    dayNightCycle.update(delta);
    lootManager.update(delta, player.getPosition());
    animalManager.update(delta, player.getPosition());
    fishingSystem.update(delta);
    resourceNode.update(delta, camera, locked);
    buildingSystem.update(delta, camera, locked, world);
    enemyManager.update(delta, player.getPosition(), dayNightCycle, player, camera);
    bossManager.update(delta, player.getPosition());
    combat.update(delta);
    npcManager.update(delta, camera, locked);
    if (mobileControls) mobileControls.update(delta);

    // Contextual interaction tooltips for chests, campfire and water
    const pPos = player.getPosition();
    if (locked && !resourceNode.isAimingAtHarvestable() && !npcManager.targetedNPC) {
      let nearbyChest = null;
      if (world && world.wildChests) {
        for (const c of world.wildChests) {
          if (!c.isOpened && pPos.distanceTo(c.position) < 3.2) {
            nearbyChest = c;
            break;
          }
        }
      }

      if (nearbyChest) {
        hud.showTooltip(`[E] ${Localization.t('chest_prompt', 'Avaa Aarrearkku')}`);
      } else {
        const nearFire = getNearbyCampfire(pPos);
        if (nearFire) {
          const canCook = inventory.has('meat', 1) || inventory.has('trout', 1) || inventory.has('pike', 1) || inventory.has('salmon', 1);
          if (canCook) {
            hud.showTooltip('[E] Paista raaka liha tai kala leiritulella 🔥');
          } else {
            hud.showTooltip('🔥 Lämmin leirituli (Valmista ruokaa tai lämmittele)');
          }
        } else if (isNearWaterEdge(pPos)) {
          hud.showTooltip('[E] Juo raikasta tunturivettä 💧');
        } else {
          hud.hideTooltip();
        }
      }
    } else if (locked && (resourceNode.isAimingAtHarvestable() || npcManager.targetedNPC)) {
      // Handled by resourceNode or npcManager
    } else {
      hud.hideTooltip();
    }

    // Check exploration proximity to Ancient Ruins Altar (x: 85, z: -25) and Highland Watchtower (x: 30, z: -68)
    if (Math.hypot(pPos.x - 85, pPos.z - (-25)) < 16) {
      questManager.onExploreAltar();
    }
    if (Math.hypot(pPos.x - 30, pPos.z - (-68)) < 12) {
      questManager.onExploreWatchtower();
    }

    // Update Biome Background Music based on player location
    const currentBiome = getBiomeKey(pPos.x, pPos.z);
    audioManager.updateBiomeMusic(currentBiome, delta);

    // Dynamic Boss Battle Music (when near alive boss)
    const bosses = bossManager ? bossManager.bosses : [];
    const activeBossNear = bosses.find(b => b && b.isAlive && b.mesh && b.mesh.position.distanceTo(pPos) < 50);
    if (activeBossNear) {
      audioManager.startBossMusic(activeBossNear);
    } else if (audioManager.isBossMusicActive) {
      audioManager.stopBossMusic();
    }

    // Update Mini-map radar (color coded by biome with fog of war) and In-game Clock
    hud.updateClock(dayNightCycle.getClockTime());
    hud.updateMinimap(
      player.getPosition(),
      camera.rotation.y,
      enemyManager.enemies,
      buildingSystem.campfires,
      currentBiome
    );

    // Render 3D Scene
    renderer.render(scene, camera);
  }

  // Start Game Loop
  animate();
}

// Start Game
init();
