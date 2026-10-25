import * as THREE from 'three';

/**
 * MobileControls – Ergonomic touch controls and optimizations for Android, iOS & Tablets
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

    // Varma kosketusnäytön tunnistus (toimii myös iPadilla ja Android-tableteilla)
    this.isTouchDevice = (
      'ontouchstart' in window ||
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
      /Android|iPhone|iPad|iPod|Windows Phone|webOS|BlackBerry/i.test(navigator.userAgent)
    );

    // Joystick state
    this.joystickActive = false;
    this.joystickTouchId = null;
    this.joystickOrigin = { x: 0, y: 0 };
    this.joystickVector = { x: 0, y: 0 };
    this.joystickMaxRadius = 52;

    // Camera look touch state
    this.cameraTouchId = null;
    this.cameraLastPos = { x: 0, y: 0 };
    this.cameraSensitivity = 0.0055; // Hieman pehmennetty vakautta varten

    // Pinch zoom state
    this.isPinching = false;
    this.pinchDist = 0;

    // Attack button hold timer
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

    if (this.renderer) {
      // Käytä tabletilla 1.25 tai 1.0 suorituskyvyn takaamiseksi
      const pr = Math.min(window.devicePixelRatio || 1, 1.25);
      this.renderer.setPixelRatio(pr);
    }
  }

  disableMobileControls() {
    if (this.container) {
      this.container.style.display = 'none';
    }
  }

  show() {
    if (this.container && this.isTouchDevice) {
      this.container.style.display = 'block';
    }
  }

  hide() {
    if (this.container) {
      this.container.style.display = 'none';
    }
  }

  syncUIState() {
    if (!this.container) return;

    const anyModalOpen = !!(
      document.querySelector('.modal.active') ||
      document.querySelector('.menu-modal.active') ||
      document.querySelector('#crafting-menu.active') ||
      document.querySelector('#backpack-screen.active') ||
      document.querySelector('#map-screen.active') ||
      document.querySelector('#skill-tree-modal.active') ||
      document.querySelector('#npc-dialogue.active') ||
      document.querySelector('#char-creator-modal.active') ||
      document.querySelector('#build-menu-modal.active') ||
      (this.pauseMenu && this.pauseMenu.classList.contains('active'))
    );

    if (this.isTouchDevice) {
      this.container.style.display = anyModalOpen ? 'none' : 'block';
    }

    this.joystickActive = false;
    this.joystickTouchId = null;
    this.cameraTouchId = null;
    this.isPinching = false;
    this.isHoldingAttack = false;

    if (this.attackHoldInterval) {
      clearInterval(this.attackHoldInterval);
      this.attackHoldInterval = null;
    }

    const jStick = document.getElementById('mobile-joystick-stick');
    if (jStick) jStick.style.transform = 'translate3d(0, 0, 0)';

    const sprintBadge = document.getElementById('mobile-sprint-badge');
    if (sprintBadge) sprintBadge.classList.remove('active');

    const attackBtn = document.getElementById('btn-mobile-attack');
    if (attackBtn) attackBtn.classList.remove('active');

    const jumpBtn = document.getElementById('btn-mobile-jump');
    if (jumpBtn) jumpBtn.classList.remove('active');

    const blockBtn = document.getElementById('btn-mobile-block');
    if (blockBtn) blockBtn.classList.remove('active');
    if (this.player && this.player.isBlocking) {
      this.player.stopBlock();
    }

    if (this.player) {
      if (this.player.analogMove) this.player.analogMove.set(0, 0);
      if (this.player.keys) {
        this.player.keys.forward = false;
        this.player.keys.back = false;
        this.player.keys.left = false;
        this.player.keys.right = false;
        this.player.keys.sprint = false;
        this.player.keys.jump = false;
      }
    }
  }

  _injectStyles() {
    if (document.getElementById('mobile-controls-styles')) return;
    const style = document.createElement('style');
    style.id = 'mobile-controls-styles';
    style.textContent = `
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

      .mobile-joystick-container {
        position: absolute;
        bottom: max(16px, env(safe-area-inset-bottom, 16px));
        left: max(16px, env(safe-area-inset-left, 16px));
        width: 140px;
        height: 140px;
        pointer-events: auto;
        touch-action: none;
        z-index: 106;
      }

      .mobile-joystick-base {
        position: absolute;
        inset: 0;
        background: radial-gradient(circle, rgba(20, 30, 45, 0.65) 0%, rgba(10, 15, 25, 0.85) 100%);
        border: 2px solid rgba(212, 175, 55, 0.45);
        border-radius: 50%;
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.7);
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
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.8);
        top: calc(50% - 26px);
        left: calc(50% - 26px);
        transform: translate3d(0, 0, 0);
        pointer-events: none;
        transition: transform 0.04s ease-out;
      }

      .mobile-sprint-badge {
        position: absolute;
        top: -24px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(230, 126, 34, 0.95);
        color: #fff;
        font-size: 10px;
        font-weight: 800;
        padding: 2px 8px;
        border-radius: 10px;
        opacity: 0;
        transition: opacity 0.15s ease;
      }
      .mobile-sprint-badge.active { opacity: 1; }

      .mobile-actions-container {
        position: absolute;
        bottom: max(14px, env(safe-area-inset-bottom, 14px));
        right: max(14px, env(safe-area-inset-right, 14px));
        width: 250px;
        height: 220px;
        pointer-events: none;
        z-index: 106;
      }

      .touch-action-btn {
        position: absolute;
        border-radius: 50%;
        pointer-events: auto !important;
        touch-action: none !important;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        user-select: none;
        -webkit-user-select: none;
        cursor: pointer;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(4px);
      }
      .touch-action-btn * {
        pointer-events: none !important; /* Estää klikkausten katoamisen lapsi-elementteihin */
      }
      .touch-action-btn:active, .touch-action-btn.active {
        transform: scale(0.92);
        filter: brightness(1.25);
      }

      #btn-mobile-attack {
        bottom: 4px;
        right: 4px;
        width: 72px;
        height: 72px;
        background: radial-gradient(circle at 35% 35%, rgba(231, 76, 60, 0.95) 0%, rgba(192, 57, 43, 0.9) 100%);
        border: 2.5px solid #ff7675;
      }
      #btn-mobile-attack .btn-icon { font-size: 32px; line-height: 32px; }
      #btn-mobile-attack .btn-sub { font-size: 8px; font-weight: 800; color: #fff; margin-top: 1px; }

      #btn-mobile-block {
        bottom: 10px;
        right: 86px;
        width: 50px;
        height: 50px;
        background: radial-gradient(circle at 35% 35%, rgba(243, 156, 18, 0.95) 0%, rgba(211, 84, 0, 0.9) 100%);
        border: 2px solid #f1c40f;
      }
      #btn-mobile-block .btn-icon { font-size: 22px; }
      #btn-mobile-block .btn-sub { font-size: 7.5px; font-weight: 800; color: #fff; }

      #btn-mobile-interact {
        bottom: 10px;
        right: 146px;
        width: 48px;
        height: 48px;
        background: radial-gradient(circle at 35% 35%, rgba(46, 204, 113, 0.92) 0%, rgba(39, 174, 96, 0.88) 100%);
        border: 1.5px solid #55efc4;
      }
      #btn-mobile-interact .btn-icon { font-size: 20px; }
      #btn-mobile-interact .btn-sub { font-size: 7.5px; font-weight: 800; color: #fff; }

      #btn-mobile-jump {
        bottom: 86px;
        right: 8px;
        width: 54px;
        height: 54px;
        background: radial-gradient(circle at 35% 35%, rgba(52, 152, 219, 0.92) 0%, rgba(41, 128, 185, 0.88) 100%);
        border: 2px solid #74b9ff;
      }
      #btn-mobile-jump .btn-icon { font-size: 24px; }
      #btn-mobile-jump .btn-sub { font-size: 7.5px; font-weight: 700; color: #fff; }

      #btn-mobile-build {
        bottom: 148px;
        right: 18px;
        width: 50px;
        height: 50px;
        background: radial-gradient(circle at 35% 35%, rgba(212, 175, 55, 0.95) 0%, rgba(184, 134, 11, 0.9) 100%);
        border: 2px solid #ffd700;
      }
      #btn-mobile-build .btn-icon { font-size: 22px; }
      #btn-mobile-build .btn-sub { font-size: 7px; font-weight: 800; color: #fff; }

      #btn-mobile-camera {
        bottom: 80px;
        right: 76px;
        width: 44px;
        height: 44px;
        background: radial-gradient(circle at 35% 35%, rgba(155, 89, 182, 0.92) 0%, rgba(142, 68, 173, 0.88) 100%);
        border: 1.5px solid #d2b4de;
      }
      #btn-mobile-camera .btn-icon { font-size: 19px; }

      #btn-mobile-sprint-toggle {
        bottom: 142px;
        right: 80px;
        width: 44px;
        height: 44px;
        background: radial-gradient(circle at 35% 35%, rgba(230, 126, 34, 0.92) 0%, rgba(211, 84, 0, 0.88) 100%);
        border: 1.5px solid #f39c12;
      }
      #btn-mobile-sprint-toggle .btn-icon { font-size: 19px; }

      .mobile-top-bar {
        position: absolute;
        top: max(8px, env(safe-area-inset-top, 8px));
        right: max(8px, env(safe-area-inset-right, 8px));
        display: flex;
        gap: 6px;
        pointer-events: auto !important;
        z-index: 108;
      }

      .mobile-pill-btn {
        background: rgba(15, 20, 30, 0.88);
        color: #f1c40f;
        border: 1px solid rgba(212, 175, 55, 0.5);
        border-radius: 14px;
        padding: 6px 10px;
        font-size: 11px;
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 4px;
        backdrop-filter: blur(6px);
        cursor: pointer;
        touch-action: manipulation;
      }
      .mobile-pill-btn * { pointer-events: none !important; }

      /* Siistitty responsiivinen HUD mobiilille ja tableteille */
      body.mobile-mode #hud-vitals-container {
        position: fixed !important;
        top: max(8px, env(safe-area-inset-top, 8px)) !important;
        left: max(8px, env(safe-area-inset-left, 8px)) !important;
        width: clamp(130px, 20vw, 170px) !important;
        height: auto !important;
        pointer-events: auto !important;
        background: rgba(10, 14, 20, 0.85);
        border: 1px solid rgba(255, 215, 0, 0.25);
        border-radius: 8px;
        padding: 6px 8px;
        z-index: 104;
      }

      body.mobile-mode #minimap-container {
        top: 48px !important;
        right: 8px !important;
        width: 86px !important;
        height: 86px !important;
      }

      body.mobile-mode #game-clock-container {
        top: 142px !important;
        right: 8px !important;
        font-size: 10px !important;
      }

      body.mobile-mode #hotbar {
        bottom: 10px !important;
        transform: translateX(-50%) scale(0.85) !important;
        z-index: 104 !important;
      }
    `;
    document.head.appendChild(style);
  }

  _createDOM() {
    const root = document.createElement('div');
    root.id = 'mobile-controls-root';

    root.innerHTML = `
      <div class="mobile-top-bar">
        <button id="mbtn-backpack" class="mobile-pill-btn">🎒 <span>Reppu</span></button>
        <button id="mbtn-craft" class="mobile-pill-btn">⚒️ <span>Paja</span></button>
        <button id="mbtn-map" class="mobile-pill-btn">🗺️ <span>Kartta</span></button>
        <button id="mbtn-skills" class="mobile-pill-btn">⭐ <span>Taidot</span></button>
        <button id="mbtn-menu" class="mobile-pill-btn">⚙️ <span>Valikko</span></button>
      </div>

      <div id="mobile-joystick-zone" class="mobile-joystick-container">
        <div class="mobile-joystick-base">
          <div class="mobile-joystick-ring"></div>
          <div id="mobile-joystick-stick" class="mobile-joystick-stick"></div>
          <div id="mobile-sprint-badge" class="mobile-sprint-badge">⚡ JUOKSU</div>
        </div>
      </div>

      <div class="mobile-actions-container">
        <div id="btn-mobile-attack" class="touch-action-btn">
          <span class="btn-icon">⚔️</span>
          <span class="btn-sub">ISKU</span>
        </div>
        <div id="btn-mobile-block" class="touch-action-btn">
          <span class="btn-icon">🛡️</span>
          <span class="btn-sub">TORJU</span>
        </div>
        <div id="btn-mobile-jump" class="touch-action-btn">
          <span class="btn-icon">🦘</span>
          <span class="btn-sub">HYPPY</span>
        </div>
        <div id="btn-mobile-interact" class="touch-action-btn">
          <span class="btn-icon">✋</span>
          <span id="btn-interact-sub" class="btn-sub">KÄYTÄ</span>
        </div>
        <div id="btn-mobile-build" class="touch-action-btn">
          <span class="btn-icon">🔨</span>
          <span class="btn-sub">RAKENNA</span>
        </div>
        <div id="btn-mobile-sprint-toggle" class="touch-action-btn">
          <span class="btn-icon">🏃</span>
        </div>
        <div id="btn-mobile-camera" class="touch-action-btn">
          <span class="btn-icon">🎥</span>
        </div>
      </div>
    `;

    document.body.appendChild(root);
    this.container = root;
  }

  _setupGlobalTouchPolicy() {
    document.addEventListener('touchmove', (e) => {
      if (e.target.closest(
        '.modal, .menu-modal, .crafting-modal, #crafting-menu, ' +
        '#backpack-screen, .backpack-modal, #map-screen, .map-modal, ' +
        '#npc-dialogue, #skill-tree-modal, #char-creator-modal, #pause-menu, ' +
        '#build-menu-modal, [data-scrollable], .scrollable, select, input, textarea'
      )) {
        return;
      }
      e.preventDefault();
    }, { passive: false });

    const unlockAudio = () => {
      if (this.audioManager) this.audioManager.ensureContext();
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('touchend', unlockAudio);
    };
    window.addEventListener('touchstart', unlockAudio, { passive: true });
    window.addEventListener('touchend', unlockAudio, { passive: true });
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

      const normDist = clampedDist / this.joystickMaxRadius;
      const dirX = Math.cos(angle) * normDist;
      const dirY = Math.sin(angle) * normDist;

      if (this.player && this.player.analogMove) {
        this.player.analogMove.set(dirX, dirY);
      }

      this.player.keys.forward = dirY < -0.22;
      this.player.keys.back    = dirY > 0.22;
      this.player.keys.left    = dirX < -0.22;
      this.player.keys.right   = dirX > 0.22;

      const isSprint = normDist > 0.70;
      this.player.keys.sprint = isSprint;
      if (sprintBadge) {
        sprintBadge.classList.toggle('active', isSprint);
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

    // 2. Action Painikkeet
    const btnAttack = document.getElementById('btn-mobile-attack');
    const btnJump = document.getElementById('btn-mobile-jump');
    const btnInteract = document.getElementById('btn-mobile-interact');
    const btnCam = document.getElementById('btn-mobile-camera');
    const btnBlock = document.getElementById('btn-mobile-block');
    const btnBuild = document.getElementById('btn-mobile-build');
    const btnSprint = document.getElementById('btn-mobile-sprint-toggle');

    // Attack
    if (btnAttack) {
      const startAttack = (e) => {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        btnAttack.classList.add('active');
        this.isHoldingAttack = true;
        if (this.resourceNode) this.resourceNode.isMouseDown = true;
        this.performActionTrigger();

        if (this.attackHoldInterval) clearInterval(this.attackHoldInterval);
        this.attackHoldInterval = setInterval(() => {
          if (this.isHoldingAttack) {
            if (this.resourceNode) this.resourceNode.isMouseDown = true;
            this.performActionTrigger();
          }
        }, 200);
      };

      const stopAttack = () => {
        btnAttack.classList.remove('active');
        this.isHoldingAttack = false;
        if (this.resourceNode) this.resourceNode.isMouseDown = false;
        if (this.attackHoldInterval) {
          clearInterval(this.attackHoldInterval);
          this.attackHoldInterval = null;
        }
      };

      btnAttack.addEventListener('touchstart', startAttack, { passive: false });
      btnAttack.addEventListener('touchend', stopAttack, { passive: true });
      btnAttack.addEventListener('touchcancel', stopAttack, { passive: true });
    }

    // Block
    if (btnBlock) {
      const handleBlockStart = (e) => {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        btnBlock.classList.add('active');
        if (this.player) this.player.startBlock();
      };
      const handleBlockEnd = () => {
        btnBlock.classList.remove('active');
        if (this.player) this.player.stopBlock();
      };
      btnBlock.addEventListener('touchstart', handleBlockStart, { passive: false });
      btnBlock.addEventListener('touchend', handleBlockEnd, { passive: true });
      btnBlock.addEventListener('touchcancel', handleBlockEnd, { passive: true });
    }

    // Jump
    if (btnJump) {
      const handleJumpStart = (e) => {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        btnJump.classList.add('active');
        if (this.player && this.player.keys) this.player.keys.jump = true;
      };
      const handleJumpEnd = () => {
        btnJump.classList.remove('active');
        if (this.player && this.player.keys) this.player.keys.jump = false;
      };
      btnJump.addEventListener('touchstart', handleJumpStart, { passive: false });
      btnJump.addEventListener('touchend', handleJumpEnd, { passive: true });
      btnJump.addEventListener('touchcancel', handleJumpEnd, { passive: true });
    }

    // Interact
    if (btnInteract) {
      const handleInteract = (e) => {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        btnInteract.classList.add('active');
        this.performInteractTrigger();
        setTimeout(() => btnInteract.classList.remove('active'), 180);
      };
      btnInteract.addEventListener('touchstart', handleInteract, { passive: false });
    }

    // Camera toggle
    if (btnCam) {
      const handleCamToggle = (e) => {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        if (this.player) {
          this.player.isThirdPerson = !this.player.isThirdPerson;
        }
      };
      btnCam.addEventListener('touchstart', handleCamToggle, { passive: false });
    }

    // Dedicated Building Mode Button (KORJATTU Avaus ilman estoja)
    if (btnBuild) {
      const handleBuild = (e) => {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        btnBuild.classList.add('active');
        setTimeout(() => btnBuild.classList.remove('active'), 180);

        if (this.buildingSystem) {
          // Varustetaan vasara jos löytyy, tai asetetaan tila suoraan
          if (this.inventory) {
            if (this.inventory.hotbar) {
              this.inventory.hotbar.selectSlot(6, true);
            }
          }
          if (typeof this.buildingSystem.setHammerActive === 'function') {
            this.buildingSystem.setHammerActive(true);
          }
          if (typeof this.buildingSystem.toggleBuildMenu === 'function') {
            this.buildingSystem.toggleBuildMenu();
          }
        }
      };
      btnBuild.addEventListener('touchstart', handleBuild, { passive: false });
    }

    // Sprint toggle
    if (btnSprint) {
      const handleSprint = (e) => {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        this.isSprintLocked = !this.isSprintLocked;
        btnSprint.classList.toggle('active', this.isSprintLocked);
        if (this.player && this.player.keys) {
          this.player.keys.sprint = this.isSprintLocked;
        }
      };
      btnSprint.addEventListener('touchstart', handleSprint, { passive: false });
    }

    // 3. Yläpalkin napit
    this._setupQuickMenuButtons();

    // 4. Kameran kääntö oikealta puoliskolta (KORJATTU vakaus ja rajaus)
    const getActiveCameraTouches = (touches) => {
      const result = [];
      for (let i = 0; i < touches.length; i++) {
        const t = touches[i];
        if (this.joystickActive && t.identifier === this.joystickTouchId) continue;
        
        // Varmista ettei kosketus osu joystickiin tai toimintanappeihin
        const target = document.elementFromPoint(t.clientX, t.clientY);
        if (target && target.closest('button, .touch-action-btn, .mobile-pill-btn, .hotbar-slot, .modal, .menu-modal, #mobile-joystick-zone, input, select')) {
          continue;
        }
        
        // Kameravyöhyke: näytön oikea puoli (yli 35% leveydestä)
        if (t.clientX > window.innerWidth * 0.35) {
          result.push(t);
        }
      }
      return result;
    };

    window.addEventListener('touchstart', (e) => {
      const camTouches = getActiveCameraTouches(e.touches);
      if (camTouches.length >= 2) {
        this.isPinching = true;
        this.pinchDist = Math.hypot(
          camTouches[0].clientX - camTouches[1].clientX,
          camTouches[0].clientY - camTouches[1].clientY
        );
        return;
      }
      if (camTouches.length === 1) {
        this.isPinching = false;
        this.cameraTouchId = camTouches[0].identifier;
        this.cameraLastPos = { x: camTouches[0].clientX, y: camTouches[0].clientY };
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      const camTouches = getActiveCameraTouches(e.touches);

      // Zoom
      if (this.isPinching && camTouches.length >= 2 && this.player) {
        const currentDist = Math.hypot(
          camTouches[0].clientX - camTouches[1].clientX,
          camTouches[0].clientY - camTouches[1].clientY
        );
        const diff = this.pinchDist - currentDist;
        if (Math.abs(diff) > 6) {
          this.player.targetCameraDistance = Math.max(
            1.8,
            Math.min(6.5, this.player.targetCameraDistance + diff * 0.015)
          );
          this.pinchDist = currentDist;
        }
        return;
      }

      // Kameran kääntö
      if (this.cameraTouchId !== null) {
        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          if (touch.identifier === this.cameraTouchId) {
            const dx = touch.clientX - this.cameraLastPos.x;
            const dy = touch.clientY - this.cameraLastPos.y;
            this.cameraLastPos = { x: touch.clientX, y: touch.clientY };

            if (this.camera) {
              this.camera.rotation.order = 'YXZ';
              this.camera.rotation.y -= dx * this.cameraSensitivity;
              this.camera.rotation.x -= dy * this.cameraSensitivity;

              // Lukitaan pystykulma niin ettei heitä ympäri
              const maxPitch = Math.PI * 0.40;
              this.camera.rotation.x = Math.max(-maxPitch, Math.min(maxPitch, this.camera.rotation.x));
              this.camera.rotation.z = 0;
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
      let found = false;
      for (let i = 0; i < camTouches.length; i++) {
        if (camTouches[i].identifier === this.cameraTouchId) {
          found = true;
          break;
        }
      }
      if (!found) {
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
        let lastTrigger = 0;
        const trigger = (e) => {
          const now = performance.now();
          if (now - lastTrigger < 260) return;
          lastTrigger = now;
          if (e.cancelable) e.preventDefault();
          e.stopPropagation();
          callback();
        };
        el.addEventListener('touchstart', trigger, { passive: false });
        el.addEventListener('click', trigger);
      }
    };

    bindPill('mbtn-backpack', () => { if (this.backpackScreen) this.backpackScreen.toggle(); });
    bindPill('mbtn-craft', () => { if (this.craftingMenu) this.craftingMenu.toggle(); });
    bindPill('mbtn-map', () => { if (this.mapScreen) this.mapScreen.toggle(); });
    bindPill('mbtn-skills', () => { if (this.skillTree) this.skillTree.toggle(); });
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

    if (this.buildingSystem && this.buildingSystem.isDemolishMode) {
      this.buildingSystem.tryDemolish();
      return;
    }

    if (this.buildingSystem && this.buildingSystem.isPlacing && this.buildingSystem.isPlacing()) {
      this.buildingSystem.tryPlace(this.world);
      return;
    }

    if (this.inventory && this.inventory.equippedTool === 'fishingRod') {
      if (this.fishingSystem) this.fishingSystem.onAction();
      return;
    }

    if (this.resourceNode && this.resourceNode.isAimingAtHarvestable && this.resourceNode.isAimingAtHarvestable()) {
      this.resourceNode.tickHarvest(0.18);
      return;
    }

    if (this.combat) {
      this.combat.performAttack();
    }
  }

  performInteractTrigger() {
    if (window.triggerGameInteraction) {
      window.triggerGameInteraction();
      return;
    }
    if (this.npcManager && this.npcManager.targetedNPC) {
      this.npcManager.onKeyE();
      return;
    }
    if (this.player && this.player.tryInteract) {
      this.player.tryInteract();
    }
  }

  update(delta) {
    if (!this.container || !this.isTouchDevice) return;

    const subLabel = document.getElementById('btn-interact-sub');
    const interactBtn = document.getElementById('btn-mobile-interact');
    const iconSpan = interactBtn ? interactBtn.querySelector('.btn-icon') : null;

    if (subLabel && this.player) {
      const pPos = this.player.getPosition ? this.player.getPosition() : this.player.playerPos;
      const isFi = (typeof Localization === 'undefined' || Localization.lang !== 'en');

      if (this.npcManager && this.npcManager.targetedNPC) {
        subLabel.textContent = isFi ? 'PUHU' : 'TALK';
        if (iconSpan) iconSpan.textContent = '💬';
        return;
      }

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
        return;
      }

      subLabel.textContent = isFi ? 'KÄYTÄ' : 'USE';
      if (iconSpan) iconSpan.textContent = '✋';
    }
  }
}