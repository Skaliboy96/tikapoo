import * as THREE from 'three';

/**
 * MobileControls – Ergonomic touch controls and optimizations for Android & iOS:
 * 1. Virtual Joystick (Bottom-Left) for smooth 360-degree analog movement & auto-sprint
 * 2. Right Action Cluster (Attack ⚔️ with hold-to-mine, Jump 🦘, Interact ✋, View 🎥)
 * 3. Touch Camera Orbit on right screen half with smooth pitch/yaw and 2-finger pinch zoom
 * 4. Top Quick Menu bar (Backpack [I], Crafting [C], Map [M], Skills [O], Menu [Esc])
 * 5. Touch-friendly Hotbar & Abilities tap selection
 * 6. Mobile browser optimizations: touch-action, iOS AudioContext unlock, prevent scroll bounce
 */
export default class MobileControls {
  constructor(options) {
    this.player = options.player;
    this.camera = options.camera;
    this.controls = options.controls;
    this.inventory = options.inventory;
    this.combat = options.combat;
    this.buildingSystem = options.buildingSystem;
    this.fishingSystem = options.fishingSystem;
    this.npcManager = options.npcManager;
    this.skillTree = options.skillTree;
    this.hotbar = options.hotbar;
    this.hud = options.hud;
    this.audioManager = options.audioManager;
    this.craftingMenu = options.craftingMenu;
    this.backpackScreen = options.backpackScreen;
    this.mapScreen = options.mapScreen;
    this.pauseMenu = options.pauseMenu;
    this.resourceNode = options.resourceNode;
    this.world = options.world;
    this.renderer = options.renderer;

    // Detect touch / mobile device
    this.isTouchDevice = (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      /Android|iPhone|iPad|iPod|Windows Phone|webOS|BlackBerry/i.test(navigator.userAgent) ||
      window.innerWidth <= 900
    );

    // Joystick state
    this.joystickActive = false;
    this.joystickTouchId = null;
    this.joystickOrigin = { x: 0, y: 0 };
    this.joystickVector = { x: 0, y: 0 };
    this.joystickMaxRadius = 52; // max stick travel in px

    // Camera look touch state
    this.cameraTouchId = null;
    this.cameraLastPos = { x: 0, y: 0 };
    this.cameraSensitivity = 0.0075;

    // Pinch zoom state
    this.isPinching = false;
    this.pinchDist = 0;

    // Attack button hold timer for continuous chopping / mining
    this.isHoldingAttack = false;
    this.attackHoldInterval = null;

    this.container = null;
    this.init();
  }

  init() {
    this._injectStyles();
    this._createDOM();
    this._setupGlobalTouchPolicy();
    this._setupEventListeners();

    if (this.isTouchDevice) {
      document.body.classList.add('mobile-mode');
      this.enableMobileControls();
    }
  }

  enableMobileControls() {
    if (this.container) {
      this.container.style.display = 'block';
    }
    document.body.classList.add('mobile-mode');

    // Adapt pixel ratio for rock-solid 60fps on mobile GPUs & prevent WebKit canvas buffer crashes
    if (this.renderer) {
      this.renderer.setPixelRatio(1.0);
    }
  }

  disableMobileControls() {
    if (this.container) {
      this.container.style.display = 'none';
    }
  }

  _injectStyles() {
    if (document.getElementById('mobile-controls-styles')) return;
    const style = document.createElement('style');
    style.id = 'mobile-controls-styles';
    style.textContent = `
      /* Mobile Controls Root */
      #mobile-controls-root {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 105;
        display: none;
        user-select: none;
        -webkit-user-select: none;
        touch-action: none;
      }

      /* Joystick Area (Bottom-Left) */
      .mobile-joystick-container {
        position: absolute;
        bottom: 25px;
        left: 25px;
        width: 130px;
        height: 130px;
        pointer-events: auto;
        touch-action: none;
      }

      .mobile-joystick-base {
        position: absolute;
        inset: 0;
        background: radial-gradient(circle, rgba(20, 30, 45, 0.6) 0%, rgba(10, 15, 25, 0.8) 100%);
        border: 2px solid rgba(212, 175, 55, 0.4);
        border-radius: 50%;
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.7), inset 0 0 12px rgba(212, 175, 55, 0.2);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .mobile-joystick-ring {
        position: absolute;
        width: 70px;
        height: 70px;
        border: 1px dashed rgba(255, 255, 255, 0.25);
        border-radius: 50%;
        pointer-events: none;
      }

      .mobile-joystick-stick {
        position: absolute;
        width: 52px;
        height: 52px;
        background: radial-gradient(circle at 35% 35%, #ffd54f 0%, #b8860b 80%, #795548 100%);
        border: 2px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.8), 0 0 10px rgba(241, 196, 15, 0.5);
        top: calc(50% - 26px);
        left: calc(50% - 26px);
        transform: translate3d(0, 0, 0);
        pointer-events: none;
        transition: transform 0.05s ease-out;
      }

      .mobile-sprint-badge {
        position: absolute;
        top: -24px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(230, 126, 34, 0.9);
        color: #fff;
        font-size: 10px;
        font-weight: 800;
        padding: 2px 8px;
        border-radius: 10px;
        letter-spacing: 0.5px;
        opacity: 0;
        transition: opacity 0.15s ease;
        box-shadow: 0 2px 6px rgba(0,0,0,0.5);
      }
      .mobile-sprint-badge.active {
        opacity: 1;
      }

      /* Right Action Buttons Cluster (Bottom-Right) - Sleek Semi-Transparent */
      .mobile-actions-container {
        position: absolute;
        bottom: 15px;
        right: 15px;
        width: 160px;
        height: 160px;
        pointer-events: none;
      }

      .touch-action-btn {
        position: absolute;
        border-radius: 50%;
        pointer-events: auto;
        touch-action: none;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        user-select: none;
        -webkit-user-select: none;
        cursor: pointer;
        transition: transform 0.08s ease, filter 0.08s ease;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(4px);
        opacity: 0.88;
      }
      .touch-action-btn:active, .touch-action-btn.active {
        transform: scale(0.90);
        filter: brightness(1.3);
        opacity: 1;
      }

      /* Main Attack Button */
      #btn-mobile-attack {
        bottom: 4px;
        right: 4px;
        width: 60px;
        height: 60px;
        background: radial-gradient(circle at 35% 35%, rgba(231, 76, 60, 0.95) 0%, rgba(192, 57, 43, 0.9) 75%, rgba(127, 29, 29, 0.9) 100%);
        border: 2px solid #ff7675;
      }
      #btn-mobile-attack .btn-icon {
        font-size: 26px;
        line-height: 26px;
      }
      #btn-mobile-attack .btn-sub {
        font-size: 7.5px;
        font-weight: 800;
        color: #fff;
        text-transform: uppercase;
        margin-top: 1px;
      }

      /* Jump Button */
      #btn-mobile-jump {
        bottom: 76px;
        right: 6px;
        width: 46px;
        height: 46px;
        background: radial-gradient(circle at 35% 35%, rgba(52, 152, 219, 0.9) 0%, rgba(41, 128, 185, 0.85) 75%, rgba(27, 79, 114, 0.85) 100%);
        border: 1.5px solid #74b9ff;
      }
      #btn-mobile-jump .btn-icon {
        font-size: 20px;
        line-height: 20px;
      }
      #btn-mobile-jump .btn-sub {
        font-size: 7px;
        font-weight: 700;
        color: #fff;
      }

      /* Interact Button [E] */
      #btn-mobile-interact {
        bottom: 6px;
        right: 76px;
        width: 46px;
        height: 46px;
        background: radial-gradient(circle at 35% 35%, rgba(46, 204, 113, 0.9) 0%, rgba(39, 174, 96, 0.85) 75%, rgba(20, 90, 50, 0.85) 100%);
        border: 1.5px solid #55efc4;
      }
      #btn-mobile-interact .btn-icon {
        font-size: 19px;
        line-height: 19px;
      }
      #btn-mobile-interact .btn-sub {
        font-size: 7px;
        font-weight: 800;
        color: #fff;
      }

      /* Perspective Toggle (1st / 3rd Person) */
      #btn-mobile-camera {
        bottom: 68px;
        right: 68px;
        width: 38px;
        height: 38px;
        background: radial-gradient(circle at 35% 35%, rgba(155, 89, 182, 0.9) 0%, rgba(142, 68, 173, 0.85) 75%, rgba(74, 35, 90, 0.85) 100%);
        border: 1.5px solid #d2b4de;
      }
      #btn-mobile-camera .btn-icon {
        font-size: 16px;
        line-height: 16px;
      }

      /* Top Mobile Quick Navigation Bar */
      .mobile-top-bar {
        position: absolute;
        top: 8px;
        right: 8px;
        display: flex;
        gap: 4px;
        pointer-events: auto;
      }

      .mobile-pill-btn {
        background: rgba(15, 20, 30, 0.85);
        color: #f1c40f;
        border: 1px solid rgba(212, 175, 55, 0.5);
        border-radius: 14px;
        padding: 4px 8px;
        font-size: 10px;
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 3px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(6px);
        cursor: pointer;
        touch-action: manipulation;
      }
      .mobile-pill-btn:active {
        transform: scale(0.94);
        background: rgba(30, 40, 60, 0.95);
        border-color: #f39c12;
      }

      /* Screen Adaptation for Mobile */
      body.mobile-mode #hud {
        top: 8px;
        left: 8px;
        bottom: auto;
        transform: none;
        padding: 5px 8px;
        width: 140px;
        min-width: 120px;
        max-width: 150px;
        background: rgba(10, 14, 20, 0.85);
        border-radius: 6px;
        gap: 3px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.6);
      }

      body.mobile-mode #hud .bar-label span:last-child {
        display: none; /* Hide numerical 100/100 to save screen real estate */
      }
      body.mobile-mode #hud .bar-label {
        font-size: 8px;
      }
      body.mobile-mode #hud .bar {
        height: 4px;
        border-radius: 2px;
      }
      body.mobile-mode #hud .hud-top-meta {
        padding-bottom: 2px;
      }
      body.mobile-mode #hud .hud-level-badge {
        font-size: 8px;
      }
      body.mobile-mode #hud .hud-xp-bar-bg {
        width: 35px;
        height: 3px;
      }
      body.mobile-mode #hud .hud-xp-val {
        display: none;
      }
      body.mobile-mode #hud .hud-biome-badge {
        font-size: 8px;
        padding: 0 3px;
      }

      body.mobile-mode .hud-buttons-row,
      body.mobile-mode .hud-controls-hint {
        display: none !important;
      }

      body.mobile-mode #hotbar {
        bottom: 8px;
        transform: translateX(-50%) scale(0.75);
        transform-origin: bottom center;
      }

      body.mobile-mode #minimap-container {
        top: 42px;
        right: 8px;
        width: 90px;
        height: 90px;
        padding: 2px;
        transform: none;
        border-radius: 50%;
        background: rgba(10, 14, 20, 0.85);
      }
      body.mobile-mode #minimap {
        width: 86px !important;
        height: 86px !important;
        border-radius: 50%;
      }

      body.mobile-mode #game-clock-container {
        top: 138px;
        right: 8px;
        transform: none;
        padding: 2px 6px;
        font-size: 9px;
        border-radius: 4px;
        background: rgba(10, 14, 20, 0.85);
      }

      body.mobile-mode #quest-log {
        display: none; /* Accessible via map button [M] */
      }

      body.mobile-mode #tooltip {
        bottom: 140px;
        font-size: 12px;
        padding: 6px 14px;
      }

      /* Prevent browser gestures */
      html, body {
        overflow: hidden;
        overscroll-behavior: none;
        touch-action: none;
        -webkit-touch-callout: none;
      }
    `;
    document.head.appendChild(style);
  }

  _createDOM() {
    const root = document.createElement('div');
    root.id = 'mobile-controls-root';

    root.innerHTML = `
      <!-- Top Quick Navigation Bar -->
      <div class="mobile-top-bar">
        <button id="mbtn-backpack" class="mobile-pill-btn">🎒 <span>Reppu</span></button>
        <button id="mbtn-craft" class="mobile-pill-btn">⚒️ <span>Paja</span></button>
        <button id="mbtn-map" class="mobile-pill-btn">🗺️ <span>Kartta</span></button>
        <button id="mbtn-skills" class="mobile-pill-btn">⭐ <span>Taidot</span></button>
        <button id="mbtn-fullscreen" class="mobile-pill-btn" title="Koko näyttö / Fullscreen">⛶</button>
        <button id="mbtn-menu" class="mobile-pill-btn">⚙️ <span>Valikko</span></button>
      </div>

      <!-- Virtual Analog Joystick (Bottom-Left) -->
      <div id="mobile-joystick-zone" class="mobile-joystick-container">
        <div class="mobile-joystick-base">
          <div class="mobile-joystick-ring"></div>
          <div id="mobile-joystick-stick" class="mobile-joystick-stick"></div>
          <div id="mobile-sprint-badge" class="mobile-sprint-badge">⚡ JUOKSU</div>
        </div>
      </div>

      <!-- Action Cluster (Bottom-Right) -->
      <div class="mobile-actions-container">
        <!-- Attack / Mine / Fish Button -->
        <div id="btn-mobile-attack" class="touch-action-btn">
          <span class="btn-icon">⚔️</span>
          <span class="btn-sub">ISKU</span>
        </div>

        <!-- Jump Button -->
        <div id="btn-mobile-jump" class="touch-action-btn">
          <span class="btn-icon">🦘</span>
          <span class="btn-sub">HYPPY</span>
        </div>

        <!-- Interact Button [E] -->
        <div id="btn-mobile-interact" class="touch-action-btn">
          <span class="btn-icon">✋</span>
          <span id="btn-interact-sub" class="btn-sub">KÄYTÄ</span>
        </div>

        <!-- Camera Perspective Toggle [V] -->
        <div id="btn-mobile-camera" class="touch-action-btn">
          <span class="btn-icon">🎥</span>
        </div>
      </div>
    `;

    document.body.appendChild(root);
    this.container = root;
  }

  _setupGlobalTouchPolicy() {
    // Prevent iOS rubber-banding and pull-to-refresh while allowing natural touch scrolling in all menus
    document.addEventListener('touchmove', (e) => {
      // Allow scroll inside all active modals, dialogues, quests, recipes, achievements, and panels
      if (e.target.closest(
        '.modal, .menu-modal, .crafting-modal, #crafting-menu, ' +
        '#backpack-screen, .backpack-modal, #map-screen, .map-modal, ' +
        '#npc-dialogue, .npc-dialogue-modal, #skill-tree-modal, .skill-tree-box, ' +
        '#char-creator-modal, .char-creator-container, #pause-menu, ' +
        '.st-quests-container, .st-achievements-container, .skill-tree-columns, ' +
        '.recipe-grid, .crafting-list, .backpack-grid, .instructions-body, .modal-body, ' +
        '.npc-quests-list, #npc-dialogue-box, .guide-content, .backpack-items-panel, [data-scrollable]'
      )) {
        return;
      }
      e.preventDefault();
    }, { passive: false });

    // iOS Web Audio unlock on first touch
    const unlockAudio = () => {
      if (this.audioManager) {
        this.audioManager.ensureContext();
      }
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('touchend', unlockAudio);
    };
    window.addEventListener('touchstart', unlockAudio, { passive: true });
    window.addEventListener('touchend', unlockAudio, { passive: true });

    // Keep controls.isLocked true on mobile during active gameplay
    if (this.isTouchDevice && this.controls) {
      this.controls.isLocked = true;
    }
  }

  _setupEventListeners() {
    // 1. Virtual Joystick
    const jZone = document.getElementById('mobile-joystick-zone');
    const jStick = document.getElementById('mobile-joystick-stick');
    const sprintBadge = document.getElementById('mobile-sprint-badge');

    const handleJoystickStart = (e) => {
      const touch = e.targetTouches[0];
      const rect = jZone.getBoundingClientRect();
      this.joystickActive = true;
      this.joystickTouchId = touch.identifier;
      this.joystickOrigin = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
      handleJoystickMove(e);
    };

    const handleJoystickMove = (e) => {
      if (!this.joystickActive) return;
      let touch = null;
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === this.joystickTouchId) {
          touch = e.touches[i];
          break;
        }
      }
      if (!touch) return;

      const rawDx = touch.clientX - this.joystickOrigin.x;
      const rawDy = touch.clientY - this.joystickOrigin.y;
      const dist = Math.hypot(rawDx, rawDy);
      const angle = Math.atan2(rawDy, rawDx);

      const clampedDist = Math.min(dist, this.joystickMaxRadius);
      const nx = Math.cos(angle) * clampedDist;
      const ny = Math.sin(angle) * clampedDist;

      jStick.style.transform = `translate3d(${nx}px, ${ny}px, 0)`;

      // Normalize vector (-1 to 1)
      const normDist = clampedDist / this.joystickMaxRadius;
      const dirX = Math.cos(angle) * normDist;
      const dirY = Math.sin(angle) * normDist;

      // Smooth 360-degree analog movement in Player
      if (this.player && this.player.analogMove) {
        this.player.analogMove.set(dirX, dirY);
      }

      // Update player movement keys fallback
      this.player.keys.forward = dirY < -0.22;
      this.player.keys.back    = dirY > 0.22;
      this.player.keys.left    = dirX < -0.22;
      this.player.keys.right   = dirX > 0.22;

      // Auto-sprint when thumb is pushed > 70%
      const isSprint = normDist > 0.70;
      this.player.keys.sprint = isSprint;
      if (sprintBadge) {
        if (isSprint) sprintBadge.classList.add('active');
        else sprintBadge.classList.remove('active');
      }
    };

    const handleJoystickEnd = (e) => {
      let stillPresent = false;
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === this.joystickTouchId) {
          stillPresent = true;
          break;
        }
      }
      if (!stillPresent) {
        this.joystickActive = false;
        this.joystickTouchId = null;
        jStick.style.transform = 'translate3d(0, 0, 0)';
        if (this.player && this.player.analogMove) {
          this.player.analogMove.set(0, 0);
        }
        this.player.keys.forward = false;
        this.player.keys.back = false;
        this.player.keys.left = false;
        this.player.keys.right = false;
        this.player.keys.sprint = false;
        if (sprintBadge) sprintBadge.classList.remove('active');
      }
    };

    if (jZone) {
      jZone.addEventListener('touchstart', handleJoystickStart, { passive: false });
      window.addEventListener('touchmove', handleJoystickMove, { passive: false });
      window.addEventListener('touchend', handleJoystickEnd, { passive: true });
      window.addEventListener('touchcancel', handleJoystickEnd, { passive: true });
    }

    // 2. Right Action Buttons
    const btnAttack = document.getElementById('btn-mobile-attack');
    const btnJump = document.getElementById('btn-mobile-jump');
    const btnInteract = document.getElementById('btn-mobile-interact');
    const btnCam = document.getElementById('btn-mobile-camera');

    // Attack / Mine button with tap & hold support
    if (btnAttack) {
      const startAttack = (e) => {
        e.preventDefault();
        e.stopPropagation();
        btnAttack.classList.add('active');
        this.isHoldingAttack = true;

        if (this.resourceNode) {
          this.resourceNode.isMouseDown = true;
        }

        // Perform first attack instantly
        this.performActionTrigger();

        // Continue holding for chopping/mining
        if (this.attackHoldInterval) clearInterval(this.attackHoldInterval);
        this.attackHoldInterval = setInterval(() => {
          if (this.isHoldingAttack) {
            if (this.resourceNode) {
              this.resourceNode.isMouseDown = true;
            }
            this.performActionTrigger();
          }
        }, 180);
      };

      const stopAttack = (e) => {
        btnAttack.classList.remove('active');
        this.isHoldingAttack = false;
        if (this.resourceNode) {
          this.resourceNode.isMouseDown = false;
        }
        if (this.attackHoldInterval) {
          clearInterval(this.attackHoldInterval);
          this.attackHoldInterval = null;
        }
      };

      btnAttack.addEventListener('touchstart', startAttack, { passive: false });
      btnAttack.addEventListener('touchend', stopAttack, { passive: true });
      btnAttack.addEventListener('touchcancel', stopAttack, { passive: true });
    }

    // Jump button
    if (btnJump) {
      btnJump.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        btnJump.classList.add('active');
        this.player.keys.jump = true;
      }, { passive: false });

      btnJump.addEventListener('touchend', () => {
        btnJump.classList.remove('active');
        this.player.keys.jump = false;
      }, { passive: true });
    }

    // Interact button [E]
    if (btnInteract) {
      btnInteract.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        btnInteract.classList.add('active');
        this.performInteractTrigger();
      }, { passive: false });

      btnInteract.addEventListener('touchend', () => {
        btnInteract.classList.remove('active');
      }, { passive: true });
    }

    // Camera perspective toggle [V]
    if (btnCam) {
      btnCam.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        btnCam.classList.add('active');
        if (this.player) {
          this.player.isThirdPerson = !this.player.isThirdPerson;
          if (this.hud) {
            this.hud.showNotification(
              this.player.isThirdPerson ? '🎥 Kolmannen persoonan kuvakulma (Valheim)' : '🎥 Ensimmäisen persoonan kuvakulma',
              2000
            );
          }
        }
      }, { passive: false });

      btnCam.addEventListener('touchend', () => {
        btnCam.classList.remove('active');
      }, { passive: true });
    }

    // 3. Top Quick Menu Pills
    this._setupQuickMenuButtons();

    // 4. Touch Camera Look / Orbit on the right half of the screen (smooth multitouch, independent of joystick)
    const getActiveCameraTouches = (touches) => {
      const result = [];
      for (let i = 0; i < touches.length; i++) {
        const t = touches[i];
        if (this.joystickActive && t.identifier === this.joystickTouchId) continue;
        const target = document.elementFromPoint(t.clientX, t.clientY);
        if (target && target.closest('button, .touch-action-btn, .mobile-pill-btn, .hotbar-slot, .modal.active, .menu-modal.active, #mobile-joystick-zone, input, select')) {
          continue;
        }
        if (t.clientX > window.innerWidth * 0.28) {
          result.push(t);
        }
      }
      return result;
    };

    window.addEventListener('touchstart', (e) => {
      const camTouches = getActiveCameraTouches(e.touches);

      // Dedicated two-finger pinch zoom ONLY if two fingers are placed together in the camera look zone
      if (camTouches.length >= 2) {
        this.isPinching = true;
        this.pinchDist = Math.hypot(
          camTouches[0].clientX - camTouches[1].clientX,
          camTouches[0].clientY - camTouches[1].clientY
        );
        return;
      }

      // Single-finger camera orbit (works flawlessly while moving with joystick)
      if (camTouches.length === 1) {
        this.isPinching = false;
        if (this.cameraTouchId === null || this.cameraTouchId !== camTouches[0].identifier) {
          this.cameraTouchId = camTouches[0].identifier;
          this.cameraLastPos = { x: camTouches[0].clientX, y: camTouches[0].clientY };
          this.cameraTapStart = { time: performance.now(), x: camTouches[0].clientX, y: camTouches[0].clientY };
          this.cameraTapMoved = 0;
        }
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      const camTouches = getActiveCameraTouches(e.touches);

      // 1. Two-finger pinch zoom (strictly in camera area, never triggered by joystick)
      if (this.isPinching && camTouches.length >= 2 && this.player) {
        const currentDist = Math.hypot(
          camTouches[0].clientX - camTouches[1].clientX,
          camTouches[0].clientY - camTouches[1].clientY
        );
        const diff = this.pinchDist - currentDist;
        if (Math.abs(diff) > 8) {
          this.player.targetCameraDistance = Math.max(
            1.8,
            Math.min(6.5, this.player.targetCameraDistance + diff * 0.012)
          );
          this.pinchDist = currentDist;
        }
        return;
      }

      // 2. Camera look drag (independent of joystick)
      if (this.cameraTouchId !== null) {
        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          if (touch.identifier === this.cameraTouchId) {
            const dx = touch.clientX - this.cameraLastPos.x;
            const dy = touch.clientY - this.cameraLastPos.y;
            this.cameraTapMoved += Math.hypot(dx, dy);
            this.cameraLastPos = { x: touch.clientX, y: touch.clientY };

            // Rotate camera (YXZ order)
            if (this.camera) {
              this.camera.rotation.order = 'YXZ';
              this.camera.rotation.y -= dx * this.cameraSensitivity;
              this.camera.rotation.x -= dy * this.cameraSensitivity;
              // Clamp pitch between -75 deg and +75 deg
              const maxPitch = Math.PI * 0.42;
              this.camera.rotation.x = Math.max(-maxPitch, Math.min(maxPitch, this.camera.rotation.x));
            }
            break;
          }
        }
      }
    }, { passive: false });

    const handleCameraTouchEnd = (e) => {
      const camTouches = getActiveCameraTouches(e.touches);
      if (camTouches.length < 2) {
        this.isPinching = false;
      }
      let camFound = false;
      for (let i = 0; i < camTouches.length; i++) {
        if (camTouches[i].identifier === this.cameraTouchId) {
          camFound = true;
          break;
        }
      }
      if (!camFound) {
        // Quick tap: if near interactive target (chest, gravestone, NPC, campfire), trigger interaction!
        if (this.cameraTapStart && (performance.now() - this.cameraTapStart.time < 350) && this.cameraTapMoved < 16) {
          if (this.isNearAnyInteractable() && window.triggerGameInteraction) {
            window.triggerGameInteraction();
          }
        }
        this.cameraTapStart = null;

        if (camTouches.length > 0) {
          this.cameraTouchId = camTouches[0].identifier;
          this.cameraLastPos = { x: camTouches[0].clientX, y: camTouches[0].clientY };
        } else {
          this.cameraTouchId = null;
        }
      }
    };

    window.addEventListener('touchend', handleCameraTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleCameraTouchEnd, { passive: true });
  }

  _setupQuickMenuButtons() {
    const bindPill = (id, callback) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          callback();
        });
      }
    };

    bindPill('mbtn-backpack', () => {
      if (this.backpackScreen) this.backpackScreen.toggle();
    });

    bindPill('mbtn-craft', () => {
      if (this.craftingMenu) this.craftingMenu.toggle();
    });

    bindPill('mbtn-map', () => {
      if (this.mapScreen) this.mapScreen.toggle();
    });

    bindPill('mbtn-skills', () => {
      if (this.skillTree) this.skillTree.toggle();
    });

    bindPill('mbtn-fullscreen', () => {
      if (typeof window.toggleGameFullscreen === 'function') {
        window.toggleGameFullscreen();
      } else {
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
          const el = document.documentElement;
          if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
          else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
        } else {
          if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
          else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        }
      }
    });

    bindPill('mbtn-menu', () => {
      if (this.pauseMenu) {
        const isActive = this.pauseMenu.classList.contains('active');
        if (isActive) {
          this.pauseMenu.classList.remove('active');
          if (this.controls) this.controls.isLocked = true;
        } else {
          this.pauseMenu.classList.add('active');
          if (this.controls) this.controls.isLocked = false;
        }
      }
    });
  }

  performActionTrigger() {
    if (!this.player) return;

    if (this.buildingSystem && this.buildingSystem.isPlacing()) {
      this.buildingSystem.tryPlace(this.world);
      return;
    }

    if (this.inventory && this.inventory.equippedTool === 'fishingRod') {
      if (this.fishingSystem) this.fishingSystem.onAction();
      return;
    }

    if (this.resourceNode && this.resourceNode.isAimingAtHarvestable()) {
      this.resourceNode.tickHarvest(0.18);
      return;
    }

    if (this.combat) {
      this.combat.performAttack();
    }
  }

  isNearAnyInteractable() {
    if (!this.player) return false;
    const pPos = this.player.getPosition ? this.player.getPosition() : this.player.playerPos;
    if (!pPos) return false;

    // 1. NPC targeted
    if (this.npcManager && this.npcManager.targetedNPC) return true;

    // 2. Chest nearby
    if (this.world && this.world.wildChests) {
      for (const c of this.world.wildChests) {
        if (!c.isOpened && pPos.distanceTo(c.position) < 3.8) return true;
      }
    }

    // 3. Tombstone nearby
    if (this.world && this.world.tombstones) {
      for (const t of this.world.tombstones) {
        if (pPos.distanceTo(t.position) < 3.8) return true;
      }
    }

    // 4. Campfire nearby
    if (this.world && this.world.campfires) {
      for (const cf of this.world.campfires) {
        if (Math.hypot(pPos.x - cf.baseX, pPos.z - cf.baseZ) < 4.2) return true;
      }
    }

    return false;
  }

  performInteractTrigger() {
    if (window.triggerGameInteraction) {
      window.triggerGameInteraction();
      return;
    }

    // 1. NPC interaction
    if (this.npcManager && this.npcManager.targetedNPC) {
      this.npcManager.onKeyE();
      return;
    }

    // 2. Player generic interact
    if (this.player && this.player.tryInteract) {
      this.player.tryInteract();
    }
  }

  update(delta) {
    if (!this.container || !this.isTouchDevice) return;

    // Dynamically update interact button icon/label based on player context
    const subLabel = document.getElementById('btn-interact-sub');
    const interactBtn = document.getElementById('btn-mobile-interact');
    const iconSpan = interactBtn ? interactBtn.querySelector('.btn-icon') : null;

    if (subLabel && this.player) {
      const pPos = this.player.getPosition ? this.player.getPosition() : this.player.playerPos;
      const isFi = (typeof Localization !== 'undefined' && Localization.lang === 'en') ? false : true;

      // 1. NPC targeted
      if (this.npcManager && this.npcManager.targetedNPC) {
        subLabel.textContent = isFi ? 'PUHU' : 'TALK';
        if (iconSpan) iconSpan.textContent = '💬';
        if (interactBtn) interactBtn.classList.add('highlight');
        return;
      }

      // 2. Wild chest nearby
      let nearChest = false;
      if (this.world && this.world.wildChests && pPos) {
        for (const c of this.world.wildChests) {
          if (!c.isOpened && pPos.distanceTo(c.position) < 3.8) {
            nearChest = true;
            break;
          }
        }
      }
      if (nearChest) {
        subLabel.textContent = isFi ? 'AVAA' : 'OPEN';
        if (iconSpan) iconSpan.textContent = '🎁';
        if (interactBtn) interactBtn.classList.add('highlight');
        return;
      }

      // 3. Tombstone nearby
      let nearTomb = false;
      if (this.world && this.world.tombstones && pPos) {
        for (const t of this.world.tombstones) {
          if (pPos.distanceTo(t.position) < 3.8) {
            nearTomb = true;
            break;
          }
        }
      }
      if (nearTomb) {
        subLabel.textContent = isFi ? 'KERÄÄ' : 'LOOT';
        if (iconSpan) iconSpan.textContent = '🪦';
        if (interactBtn) interactBtn.classList.add('highlight');
        return;
      }

      // 4. Fishing bite
      if (this.fishingSystem && this.fishingSystem.state === 'bite') {
        subLabel.textContent = isFi ? 'KALA!' : 'FISH!';
        if (iconSpan) iconSpan.textContent = '🎣';
        if (interactBtn) interactBtn.classList.add('highlight');
        return;
      }

      // 5. Campfire / cooking / resting
      let nearFire = false;
      if (this.world && this.world.campfires && pPos) {
        for (const cf of this.world.campfires) {
          if (Math.hypot(pPos.x - cf.baseX, pPos.z - cf.baseZ) < 4.2) {
            nearFire = true;
            break;
          }
        }
      }
      if (nearFire) {
        const canCook = this.inventory && (this.inventory.has('meat', 1) || this.inventory.has('trout', 1) || this.inventory.has('pike', 1) || this.inventory.has('salmon', 1));
        subLabel.textContent = canCook ? (isFi ? 'PAISTA' : 'COOK') : (isFi ? 'LEPÄÄ' : 'REST');
        if (iconSpan) iconSpan.textContent = '🔥';
        if (interactBtn) interactBtn.classList.add('highlight');
        return;
      }

      // 6. Water edge
      if (pPos) {
        const riverX = -16 + Math.sin(pPos.z * 0.015) * 20;
        if (Math.abs(pPos.x - riverX) < 13 && pPos.y < 1.4) {
          subLabel.textContent = isFi ? 'JUO' : 'DRINK';
          if (iconSpan) iconSpan.textContent = '💧';
          if (interactBtn) interactBtn.classList.add('highlight');
          return;
        }
      }

      // Default state
      subLabel.textContent = isFi ? 'KÄYTÄ' : 'USE';
      if (iconSpan) iconSpan.textContent = '✋';
      if (interactBtn) interactBtn.classList.remove('highlight');
    }
  }
}
