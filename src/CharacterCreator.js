import * as THREE from 'three';
import Localization from './Localization.js';

/**
 * CharacterCreator – Full Nordic RPG Character Creation System:
 * - Gender: Mies / Nainen (Male / Female)
 * - Head Style: Erämiehen Huppu (Hood) / Avoin pää & Hiukset (Hair)
 * - Hair Styles: Lyhyet, Pitkät, Ponnari, Kalju
 * - Hair Colors: Vaalea, Ruskea, Punainen, Musta, Harmaa
 * - Skin Tones: Vaalea pohjoinen, Päivettynyt, Sään karaisema
 * - Starting Clothing Tints: Havunvihreä, Eränruskea, Pohjolansininen, Viininpunainen
 * - Interactive 3D Turntable Preview with mouse orbit and real-time animation
 */
export default class CharacterCreator {
  constructor(assetLoader, onConfirmCallback = null) {
    this.assetLoader = assetLoader;
    this.onConfirmCallback = onConfirmCallback;

    this.container = document.getElementById('character-creator');
    this.previewCanvas = document.getElementById('char-preview-canvas');

    // Default character setup: basic starting clothes with open head and customizable hair/skin/clothes
    const saved = localStorage.getItem('tikapoo_character');
    this.config = {
      name: 'Eerik',
      gender: 'male',
      headStyle: 'hair',
      hairStyle: 'short',
      hairColor: 0x3d2817,
      skinColor: 0xf5d0b5,
      clothingColor: 0x2e5339
    };
    if (saved) {
      try {
        this.config = { ...this.config, ...JSON.parse(saved) };
      } catch (e) {}
    }
    // Always enforce open head with customizable hair (no forced hoods)
    this.config.headStyle = 'hair';
    this.config.model = 'Rogue';

    // 3D Preview Scene & Renderer
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.previewModel = null;
    this.previewMixer = null;
    this.animAction = null;
    this.isOpen = false;

    // Turntable interaction
    this.turntableAngle = 0;
    this.isDragging = false;
    this.prevMouseX = 0;
    this.clock = new THREE.Clock();

    // Lazy WebGL preview: Only initialize renderer when modal is actually opened!
    // Prevents allocating 2 simultaneous WebGL contexts on mobile (iOS WebKit context crash fix)
    this._initUI();
    this._setupListeners();
  }

  _initThreePreview() {
    if (!this.previewCanvas || this.renderer) return;

    try {
      const width = this.previewCanvas.clientWidth || 360;
      const height = this.previewCanvas.clientHeight || 480;

      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x121721);

      this.camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 50);
      this.camera.position.set(0, 1.25, 2.9);
      this.camera.lookAt(0, 0.95, 0);

      const isMobile = window.innerWidth <= 900 || ('ontouchstart' in window);
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.previewCanvas,
        antialias: false,
        alpha: false,
        powerPreference: 'low-power'
      });
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(isMobile ? 1.0 : Math.min(window.devicePixelRatio, 1.25));
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.1;

      // Pedestal disk
      const pedGeo = new THREE.CylinderGeometry(0.7, 0.75, 0.08, 32);
      const pedMat = new THREE.MeshStandardMaterial({ color: 0x242e3b, roughness: 0.8, metalness: 0.2 });
      const ped = new THREE.Mesh(pedGeo, pedMat);
      ped.position.y = -0.04;
      this.scene.add(ped);

      // Warm Nordic Studio Lighting
      const ambLight = new THREE.AmbientLight(0xffeedd, 0.9);
      this.scene.add(ambLight);

      const dirLight = new THREE.DirectionalLight(0xfffaed, 2.2);
      dirLight.position.set(2, 3, 2.5);
      this.scene.add(dirLight);

      const rimLight = new THREE.DirectionalLight(0x66aaff, 1.2);
      rimLight.position.set(-2, 2, -2);
      this.scene.add(rimLight);
    } catch (err) {
      console.warn('[CharacterCreator] Preview WebGL init notice:', err);
    }
  }

  _initUI() {
    this._syncUIFromConfig();
  }

  _syncUIFromConfig() {
    const nameInput = document.getElementById('char-name-input');
    if (nameInput) nameInput.value = this.config.name || 'Eerik';

    // Gender buttons
    document.querySelectorAll('[data-char-gender]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.charGender === this.config.gender);
    });

    // Hair style buttons
    document.querySelectorAll('[data-char-hair-style]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.charHairStyle === this.config.hairStyle);
    });

    // Swatches (Hair Color, Skin Color, Clothes Color)
    document.querySelectorAll('[data-char-hair-color]').forEach(btn => {
      const hex = parseInt(btn.dataset.charHairColor, 16);
      btn.classList.toggle('active', hex === this.config.hairColor);
    });

    document.querySelectorAll('[data-char-skin]').forEach(btn => {
      const hex = parseInt(btn.dataset.charSkin, 16);
      btn.classList.toggle('active', hex === this.config.skinColor);
    });

    document.querySelectorAll('[data-char-cloth]').forEach(btn => {
      const hex = parseInt(btn.dataset.charCloth, 16);
      btn.classList.toggle('active', hex === this.config.clothingColor);
    });
  }

  _setupListeners() {
    // Name input
    const nameInput = document.getElementById('char-name-input');
    if (nameInput) {
      nameInput.addEventListener('input', (e) => {
        this.config.name = e.target.value.trim() || (this.config.gender === 'female' ? 'Aino' : 'Eerik');
      });
    }

    // Gender selection
    document.querySelectorAll('[data-char-gender]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.config.gender = btn.dataset.charGender;
        if (nameInput && (!nameInput.value || nameInput.value === 'Eerik' || nameInput.value === 'Aino')) {
          nameInput.value = this.config.gender === 'female' ? 'Aino' : 'Eerik';
          this.config.name = nameInput.value;
        }
        this._syncUIFromConfig();
        this.buildPreviewModel();
      });
    });

    // Hair style selection
    document.querySelectorAll('[data-char-hair-style]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.config.hairStyle = btn.dataset.charHairStyle;
        this._syncUIFromConfig();
        this.buildPreviewModel();
      });
    });

    // Hair color swatches
    document.querySelectorAll('[data-char-hair-color]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.config.hairColor = parseInt(btn.dataset.charHairColor, 16);
        this._syncUIFromConfig();
        this.buildPreviewModel();
      });
    });

    // Skin tone swatches
    document.querySelectorAll('[data-char-skin]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.config.skinColor = parseInt(btn.dataset.charSkin, 16);
        this._syncUIFromConfig();
        this.buildPreviewModel();
      });
    });

    // Clothing color swatches
    document.querySelectorAll('[data-char-cloth]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.config.clothingColor = parseInt(btn.dataset.charCloth, 16);
        this._syncUIFromConfig();
        this.buildPreviewModel();
      });
    });

    // Confirm button
    const confirmBtn = document.getElementById('char-create-confirm-btn');
    if (confirmBtn) {
      const handleConfirm = (e) => {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        this.confirmAndStart();
      };
      confirmBtn.addEventListener('click', handleConfirm);
      confirmBtn.addEventListener('pointerdown', handleConfirm);
      confirmBtn.addEventListener('touchend', handleConfirm);
    }

    // Back button
    const backBtn = document.getElementById('char-create-back-btn');
    if (backBtn) {
      const handleBack = (e) => {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        this.close();
        const mm = document.getElementById('main-menu');
        if (mm) mm.style.display = 'flex';
      };
      backBtn.addEventListener('click', handleBack);
      backBtn.addEventListener('pointerdown', handleBack);
      backBtn.addEventListener('touchend', handleBack);
    }

    // Randomize button
    const randBtn = document.getElementById('char-btn-random');
    if (randBtn) {
      randBtn.addEventListener('click', () => {
        this.randomize();
      });
    }

    // Quick Rotate Left/Right buttons
    const rotLeft = document.getElementById('char-btn-rot-left');
    if (rotLeft) {
      rotLeft.addEventListener('click', () => {
        this.turntableAngle -= Math.PI / 4;
      });
    }
    const rotRight = document.getElementById('char-btn-rot-right');
    if (rotRight) {
      rotRight.addEventListener('click', () => {
        this.turntableAngle += Math.PI / 4;
      });
    }

    // Preset Chips
    document.querySelectorAll('[data-char-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.applyPreset(btn.dataset.charPreset);
      });
    });

    // Turntable touch & mouse drag controls
    if (this.previewCanvas) {
      const startDrag = (clientX) => {
        this.isDragging = true;
        this.prevMouseX = clientX;
      };
      const moveDrag = (clientX) => {
        if (!this.isDragging) return;
        const deltaX = clientX - this.prevMouseX;
        this.prevMouseX = clientX;
        this.turntableAngle += deltaX * 0.015;
      };
      const endDrag = () => {
        this.isDragging = false;
      };

      this.previewCanvas.addEventListener('mousedown', (e) => startDrag(e.clientX));
      window.addEventListener('mousemove', (e) => moveDrag(e.clientX));
      window.addEventListener('mouseup', endDrag);

      this.previewCanvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          startDrag(e.touches[0].clientX);
        }
      }, { passive: true });
      window.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1 && this.isDragging) {
          moveDrag(e.touches[0].clientX);
        }
      }, { passive: true });
      window.addEventListener('touchend', endDrag, { passive: true });
      window.addEventListener('touchcancel', endDrag, { passive: true });
    }
  }

  applyPreset(presetKey) {
    if (presetKey === 'warrior') {
      this.config.gender = 'male';
      this.config.name = 'Eerik';
      this.config.hairStyle = 'short';
      this.config.hairColor = 0xe6c280; // Blonde
      this.config.skinColor = 0xf5d0b5; // Fair
      this.config.clothingColor = 0x2e5339; // Forest Green
    } else if (presetKey === 'ranger') {
      this.config.gender = 'female';
      this.config.name = 'Aino';
      this.config.hairStyle = 'ponytail';
      this.config.hairColor = 0x3d2817; // Chestnut
      this.config.skinColor = 0xdba77a; // Tanned
      this.config.clothingColor = 0x4a3c2c; // Hunter Brown
    } else if (presetKey === 'shaman') {
      this.config.gender = 'female';
      this.config.name = 'Mielikki';
      this.config.hairStyle = 'long';
      this.config.hairColor = 0xf0f0f0; // Platinum
      this.config.skinColor = 0xf5d0b5; // Fair
      this.config.clothingColor = 0x233d54; // Mystic Blue
    }
    this._syncUIFromConfig();
    this.buildPreviewModel();
  }

  randomize() {
    const genders = ['male', 'female'];
    const hairStyles = ['short', 'long', 'ponytail', 'bald'];
    const hairColors = [0xe6c280, 0x3d2817, 0x8a3324, 0x1a1a1a, 0x9e9e9e, 0xf0f0f0];
    const skinTones = [0xf5d0b5, 0xdba77a, 0xaa7855, 0x6b4423];
    const clothes = [0x2e5339, 0x4a3c2c, 0x233d54, 0x5c2429, 0x2d3436, 0x8a7b64];
    const maleNames = ['Eerik', 'Tapio', 'Väinö', 'Ilmari', 'Ukko', 'Ahto', 'Kaleva'];
    const femaleNames = ['Aino', 'Mielikki', 'Tuulikki', 'Kyllikki', 'Ilmatar', 'Tellervo'];

    this.config.gender = genders[Math.floor(Math.random() * genders.length)];
    this.config.name = this.config.gender === 'female'
      ? femaleNames[Math.floor(Math.random() * femaleNames.length)]
      : maleNames[Math.floor(Math.random() * maleNames.length)];
    this.config.hairStyle = hairStyles[Math.floor(Math.random() * hairStyles.length)];
    this.config.hairColor = hairColors[Math.floor(Math.random() * hairColors.length)];
    this.config.skinColor = skinTones[Math.floor(Math.random() * skinTones.length)];
    this.config.clothingColor = clothes[Math.floor(Math.random() * clothes.length)];

    this._syncUIFromConfig();
    this.buildPreviewModel();
  }

  buildPreviewModel() {
    if (!this.scene || !this.assetLoader) return;

    try {
      // Remove old model
      if (this.previewModel) {
        this.scene.remove(this.previewModel);
        this.previewModel = null;
        this.previewMixer = null;
      }

      // Always use clean humanoid base model (simple starting linen clothes, no armor/hoods)
      this.config.headStyle = 'hair';
      this.config.model = 'Rogue';

      const charData = this.assetLoader.createAnimatedCharacter('Rogue', 'Idle_A', this.config);
      if (!charData || !charData.model) return;

      this.previewModel = charData.model;
      this.previewMixer = charData.mixer;
      this.animAction = charData.actions ? (charData.actions['Idle_A'] || charData.actions['Idle_No_Loop']) : null;

      this.previewModel.position.set(0, 0, 0);
      this.scene.add(this.previewModel);
    } catch (err) {
      console.warn('[CharacterCreator] buildPreviewModel notice:', err);
    }
  }

  _resizePreview() {
    if (!this.renderer || !this.previewCanvas || !this.camera) return;
    const rect = this.previewCanvas.getBoundingClientRect();
    const width = rect.width || 360;
    const height = rect.height || 440;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  open() {
    if (this._loopReq) {
      cancelAnimationFrame(this._loopReq);
      this._loopReq = null;
    }
    this.isOpen = true;
    if (this.container) {
      this.container.style.display = 'flex';
    }
    if (Localization && Localization.applyToDOM) {
      Localization.applyToDOM();
    }
    this._initThreePreview();
    this._resizePreview();
    this._syncUIFromConfig();
    this.buildPreviewModel();
    this.clock.start();
    this._loop();
  }

  close() {
    this.isOpen = false;
    if (this._loopReq) {
      cancelAnimationFrame(this._loopReq);
      this._loopReq = null;
    }
    if (this.container) {
      this.container.style.display = 'none';
    }
    // Note: Do not dispose WebGLRenderer on the canvas! Setting isOpen = false stops rendering loop (0% GPU/CPU overhead)
  }

  confirmAndStart() {
    localStorage.setItem('tikapoo_character', JSON.stringify(this.config));
    this.close();
    if (this.onConfirmCallback) {
      try {
        this.onConfirmCallback(this.config);
      } catch (err) {
        console.error('[CharacterCreator] onConfirmCallback error:', err);
      }
    }
  }

  _loop() {
    if (!this.isOpen) {
      this._loopReq = null;
      return;
    }
    this._loopReq = requestAnimationFrame(() => this._loop());

    const delta = this.clock.getDelta();

    // Auto rotate slightly when not dragging
    if (!this.isDragging) {
      this.turntableAngle += delta * 0.45;
    }

    if (this.previewModel) {
      this.previewModel.rotation.y = this.turntableAngle;
    }

    if (this.previewMixer) {
      this.previewMixer.update(delta);
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
