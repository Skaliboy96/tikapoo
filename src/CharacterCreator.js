import * as THREE from 'three';

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

    // Default character setup
    const saved = localStorage.getItem('tikapoo_character');
    this.config = {
      name: 'Eerik',
      gender: 'male',
      headStyle: 'hood',
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

    this._initThreePreview();
    this._initUI();
    this._setupListeners();
  }

  _initThreePreview() {
    if (!this.previewCanvas) return;

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
      antialias: !isMobile,
      alpha: false,
      powerPreference: 'low-power'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(isMobile ? Math.min(window.devicePixelRatio, 1.25) : Math.min(window.devicePixelRatio, 1.5));
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

    // Head style buttons
    document.querySelectorAll('[data-char-head]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.charHead === this.config.headStyle);
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

    // Toggle hair style section visibility if hood is selected
    const hairStyleRow = document.getElementById('char-hair-style-row');
    if (hairStyleRow) {
      hairStyleRow.style.display = (this.config.headStyle === 'hair') ? 'flex' : 'none';
    }
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

    // Head style selection (Hood vs Hair)
    document.querySelectorAll('[data-char-head]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.config.headStyle = btn.dataset.charHead;
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
      confirmBtn.addEventListener('click', () => {
        this.confirmAndStart();
      });
    }

    // Back button
    const backBtn = document.getElementById('char-create-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        this.close();
        const mm = document.getElementById('main-menu');
        if (mm) mm.style.display = 'flex';
      });
    }

    // Turntable mouse drag controls
    if (this.previewCanvas) {
      this.previewCanvas.addEventListener('mousedown', (e) => {
        this.isDragging = true;
        this.prevMouseX = e.clientX;
      });

      window.addEventListener('mousemove', (e) => {
        if (!this.isDragging) return;
        const deltaX = e.clientX - this.prevMouseX;
        this.prevMouseX = e.clientX;
        this.turntableAngle += deltaX * 0.015;
      });

      window.addEventListener('mouseup', () => {
        this.isDragging = false;
      });
    }
  }

  buildPreviewModel() {
    if (!this.scene || !this.assetLoader) return;

    // Remove old model
    if (this.previewModel) {
      this.scene.remove(this.previewModel);
      this.previewModel = null;
      this.previewMixer = null;
    }

    const isFemale = this.config.gender === 'female';
    const isHood = this.config.headStyle === 'hood';
    const modelName = this.config.model || (isFemale ? (isHood ? 'Ranger_Adv' : 'Rogue_Hooded') : (isHood ? 'Barbarian' : 'Knight'));

    const charData = this.assetLoader.createAnimatedCharacter(modelName, 'Idle_A', this.config);
    if (!charData || !charData.model) return;

    this.previewModel = charData.model;
    this.previewMixer = charData.mixer;
    this.animAction = charData.actions ? (charData.actions['Idle_A'] || charData.actions['Idle_No_Loop']) : null;

    this.previewModel.position.set(0, 0, 0);
    this.scene.add(this.previewModel);
  }

  open() {
    this.isOpen = true;
    if (this.container) {
      this.container.style.display = 'flex';
    }
    this._syncUIFromConfig();
    this.buildPreviewModel();
    this.clock.start();
    this._loop();
  }

  close() {
    this.isOpen = false;
    if (this.container) {
      this.container.style.display = 'none';
    }
  }

  confirmAndStart() {
    localStorage.setItem('tikapoo_character', JSON.stringify(this.config));
    this.close();
    if (this.onConfirmCallback) {
      this.onConfirmCallback(this.config);
    }
  }

  _loop() {
    if (!this.isOpen) return;
    requestAnimationFrame(() => this._loop());

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
