import * as THREE from 'three';
import { getBiomeKey } from './EnemyManager.js';

const isMobileDevice = (
  typeof window !== 'undefined' && (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    /Android|iPhone|iPad|iPod|Windows Phone|webOS|BlackBerry/i.test(navigator.userAgent) ||
    window.innerWidth <= 900
  )
);

export default class World {
  constructor(scene, assetLoader = null) {
    this.scene = scene;
    this.assetLoader = assetLoader;

    this.trees = [];
    this.stones = [];
    this.ores = [];
    this.bushes = [];
    this.decorations = [];
    this.campfires = [];
    this.wheatNodes = [];
    this.mossyWoodNodes = [];
    this.mushrooms = [];
    this.wildChests = []; // Hidden lootable treasure chests across forests and ruins
    this.remoteBuildings = []; // Named asset buildings discovered in streamed chunks
    this.tombstones = []; // Player death gravestones (recover lost items)
    this.colliders = []; // World wall and obstacle colliders (prevents walking through buildings)
    this.workbenches = []; // Registered artisan crafting workbenches across the world

    this.windTime = 0;
    this._fireflyUpdateTimer = 0;
    this.instancedGrass = null;
    this.instancedFerns = null;
    this.waterMesh = null;
    this.waterNormal = null;
    this.fireflies = null;
    this.clouds = [];
    this.aurora = [];
    this.atmosphereTime = 0;
    this.altarLight = null;

    // Load saved dev world edits (deleted entity positions) to suppress them upon world generation
    this.deletedEdits = [];
    try {
      const savedEdits = localStorage.getItem('tikapoo_dev_world_edits');
      if (savedEdits) {
        const parsed = JSON.parse(savedEdits);
        this.deletedEdits = parsed.deleted || [];
      }
    } catch (e) {
      console.warn('Failed to parse saved dev world edits in World:', e);
    }

    // Infinite / Seamless Open World dynamic streaming
    this.generatedChunks = new Set();
    this._lastTerrainShiftX = 0;
    this._lastTerrainShiftZ = 0;

    this.initLighting();
    this.initSky();
    this.initTerrain();
    this.initWater();
    this.initInstancedGrass();
    this.initInstancedFerns();
    this.initFireflies();
    this.initClouds();
    this.initAurora();

    this.buildCentralTown();
    this.buildRiverBridge();
    this.buildFishingTown();
    this.buildHighlandFortress();
    this.buildAncientRuins();

    this.generateForests();
    this.generateBirchForests();
    this.generateWheatFields();
    this.generateMossyWood();
    this.generateRocks();
    this.generateOreVeins();
    this.generateBerryBushes();
    this.generateMushrooms();
    this.generateDecorations();
    this.generateWildChests();
  }

  // --- Multi-frequency Scandinavian Terrain Elevation Formula ---
  // Realistic geological fells, knolls, ridges and smooth plateaus (no playdough blobs)
  getGroundHeight(x, z) {
    const baseElevation = 5.2;

    // 1. Broad rolling Scandinavian fell swells
    const swell1 = Math.sin(x * 0.007 + 0.3) * Math.cos(z * 0.006 - 0.4) * 3.6;
    const swell2 = Math.sin(x * 0.014 + z * 0.011) * 2.0;

    // 2. Medium ridgelines and rocky knolls (gives natural geological structure instead of featureless dough)
    const knoll1 = Math.sin(x * 0.032) * Math.sin(z * 0.028) * 1.6;
    const knoll2 = Math.cos(x * 0.052 + z * 0.042) * 0.9;

    // 3. Subtle organic ground undulation (micro-relief)
    const micro = (Math.sin(x * 0.11) * Math.cos(z * 0.09) + Math.cos(x * 0.07 - z * 0.07)) * 0.35;

    // 4. Endless natural Scandinavian fell ridges & rolling wilderness terrain
    const regionalFells = Math.sin(x * 0.005 + 1.2) * Math.cos(z * 0.005 - 0.8) * 4.2 +
                          Math.sin(x * 0.012 - z * 0.010) * 2.2;

    let landHeight = baseElevation + swell1 + swell2 + knoll1 + knoll2 + micro + regionalFells;

    // Biome-specific topography (calibrated for expanded biome layout)
    // 1. Mountain Biome (Northeast: x > 68, z < -58) -> Towering alpine fells & snow peaks
    if (x > 65 && z < -55) {
      const mWeightX = Math.min(1.0, (x - 65) / 50.0);
      const mWeightZ = Math.min(1.0, (-55 - z) / 50.0);
      const mWeight = mWeightX * mWeightZ;
      const alpineNoise = Math.sin(x * 0.022) * Math.cos(z * 0.022) * 11.0 + Math.sin(x * 0.048 + z * 0.038) * 5.5;
      landHeight += (20.0 + alpineNoise) * mWeight;
    }

    // 2. Swamp Biome (Southwest: x < -68, z > 48) -> Low, waterlogged peat mire
    if (x < -65 && z > 45) {
      const sWeightX = Math.min(1.0, (-65 - x) / 45.0);
      const sWeightZ = Math.min(1.0, (z - 45) / 45.0);
      const sWeight = sWeightX * sWeightZ;
      landHeight = landHeight * (1.0 - sWeight * 0.65) + 2.4 * (sWeight * 0.65);
    }

    // 3. Ashlands Biome (South: z > 135) -> Jagged volcanic basalt crags
    if (z > 130) {
      const aWeight = Math.min(1.0, (z - 130) / 45.0);
      const volcanicNoise = Math.sin(x * 0.035) * 7.5 + Math.cos(z * 0.028) * 6.0;
      landHeight += (8.0 + volcanicNoise) * aWeight;
    }

    // 4. Smooth central village plateau (radius < 38m) for flat, natural town construction
    const distFromCenter = Math.hypot(x, z);
    if (distFromCenter < 38) {
      const t = 1 - distFromCenter / 38;
      landHeight = landHeight * (1 - t * 0.6) + 3.2 * (t * 0.6);
    }

    // River channel carving: Graceful S-curve from north to south
    const riverX = -16 + Math.sin(z * 0.015) * 20;
    const distToRiver = Math.abs(x - riverX);
    const riverWidth = 18.0;

    if (distToRiver < riverWidth) {
      const rT = distToRiver / riverWidth;
      const carve = Math.cos(rT * Math.PI * 0.5);
      const riverDepth = (landHeight - (-1.65)) * (carve * carve);
      landHeight -= riverDepth;
    }

    // River bridge deck (spanning x: -19.5 to 3.5 across z: 28)
    if (z >= 25.8 && z <= 30.2 && x >= -19.5 && x <= 3.5) {
      // Smoothly blend bridge elevation with eastern and western riverbanks
      let bridgeDeckY = 1.52;
      if (x < -16.0) {
        const rampT = Math.max(0, Math.min(1, (-16.0 - x) / 3.5));
        bridgeDeckY = 1.52 * (1 - rampT) + 3.0 * rampT;
      } else if (x > 0.5) {
        const rampT = Math.max(0, Math.min(1, (x - 0.5) / 3.0));
        bridgeDeckY = 1.52 * (1 - rampT) + 3.2 * rampT;
      }
      landHeight = Math.max(landHeight, bridgeDeckY);
    }

    // Satamakylä fishing boardwalk & pier
    if (Math.abs(x - (-18)) <= 2.2 && z >= 20.5 && z <= 43.5) {
      landHeight = Math.max(landHeight, 1.42);
    }
    if (z >= 30.2 && z <= 33.8 && x >= -19.0 && x <= -9.5) {
      landHeight = Math.max(landHeight, 1.42);
    }

    return landHeight;
  }

  // --- Procedural High-Definition Seamless Scandinavian Forest Floor & Rock Textures ---
  _generateGroundTextures() {
    const W = 512, H = 512;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(W, H);
    const data = imgData.data;
    const heightMap = new Float32Array(W * H);

    // Permutation table for seamless 2D gradient noise
    const p = new Uint8Array(512);
    for (let i = 0; i < 256; i++) p[i] = i;
    let seed = 4287;
    function rand() {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return (seed >>> 16) / 65536;
    }
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const t = p[i]; p[i] = p[j]; p[j] = t;
    }
    for (let i = 0; i < 256; i++) p[256 + i] = p[i];

    function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    function grad(hash, x, y) {
      const h = hash & 7;
      const u = h < 4 ? x : y;
      const v = h < 4 ? y : x;
      return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }
    function perlinSeamless(x, y, period) {
      const xi = Math.floor(x) % period;
      const yi = Math.floor(y) % period;
      const xf = x - Math.floor(x);
      const yf = y - Math.floor(y);
      const u = fade(xf);
      const v = fade(yf);
      const n00 = grad(p[p[xi] + yi], xf, yf);
      const n10 = grad(p[p[(xi + 1) % period] + yi], xf - 1, yf);
      const n01 = grad(p[p[xi] + (yi + 1) % period], xf, yf - 1);
      const n11 = grad(p[p[(xi + 1) % period] + (yi + 1) % period], xf - 1, yf - 1);
      const x1 = n00 + u * (n10 - n00);
      const x2 = n01 + u * (n11 - n01);
      return x1 + v * (x2 - x1);
    }

    // Multi-octave organic fractal soil, gravel and pebble noise (completely isotropic and seamless)
    for (let y = 0; y < H; y++) {
      const fy = y / H;
      for (let x = 0; x < W; x++) {
        const fx = x / W;

        // 5 Seamless octaves
        const o1 = perlinSeamless(fx * 4, fy * 4, 4) * 0.45;
        const o2 = perlinSeamless(fx * 8, fy * 8, 8) * 0.25;
        const o3 = perlinSeamless(fx * 16, fy * 16, 16) * 0.15;
        const o4 = perlinSeamless(fx * 32, fy * 32, 32) * 0.10;
        const o5 = perlinSeamless(fx * 64, fy * 64, 64) * 0.05;

        const total = (o1 + o2 + o3 + o4 + o5 + 1.0) * 0.5;
        heightMap[y * W + x] = total;

        // Micro-grit hash to simulate realistic ground sand and soil granularity
        const grit = (((Math.imul(x * 1973 + y * 9277, 2654435761) >>> 16) / 65536) - 0.5) * 14;
        const lum = Math.max(140, Math.min(255, Math.floor(180 + total * 60 + grit)));

        const idx = (y * W + x) * 4;
        data[idx]     = lum;
        data[idx + 1] = Math.floor(lum * 0.98);
        data[idx + 2] = Math.floor(lum * 0.94);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const groundTex = new THREE.CanvasTexture(canvas);
    groundTex.wrapS = THREE.RepeatWrapping;
    groundTex.wrapT = THREE.RepeatWrapping;
    groundTex.repeat.set(90, 90);
    groundTex.colorSpace = THREE.SRGBColorSpace;

    // 3x3 Sobel Normal Map for realistic tactile 3D gravel and rock micro-depth
    const normCanvas = document.createElement('canvas');
    normCanvas.width = W;
    normCanvas.height = H;
    const normCtx = normCanvas.getContext('2d');
    const normImg = normCtx.createImageData(W, H);
    const nd = normImg.data;

    for (let y = 0; y < H; y++) {
      const yPrev = (y - 1 + H) % H;
      const yNext = (y + 1) % H;
      for (let x = 0; x < W; x++) {
        const xPrev = (x - 1 + W) % W;
        const xNext = (x + 1) % W;

        // 3x3 Sobel convolution
        const tl = heightMap[yPrev * W + xPrev];
        const t  = heightMap[yPrev * W + x];
        const tr = heightMap[yPrev * W + xNext];
        const l  = heightMap[y * W + xPrev];
        const r  = heightMap[y * W + xNext];
        const bl = heightMap[yNext * W + xPrev];
        const b  = heightMap[yNext * W + x];
        const br = heightMap[yNext * W + xNext];

        const dx = (tr + 2 * r + br) - (tl + 2 * l + bl);
        const dy = (bl + 2 * b + br) - (tl + 2 * t + tr);
        const dz = 1.4; // Soft tactile Nordic earth depth
        const len = Math.hypot(dx, dy, dz);

        const i = (y * W + x) * 4;
        nd[i]     = Math.floor(((-dx / len) * 0.5 + 0.5) * 255);
        nd[i + 1] = Math.floor(((-dy / len) * 0.5 + 0.5) * 255);
        nd[i + 2] = Math.floor(((dz / len) * 0.5 + 0.5) * 255);
        nd[i + 3] = 255;
      }
    }
    normCtx.putImageData(normImg, 0, 0);

    const normalTex = new THREE.CanvasTexture(normCanvas);
    normalTex.wrapS = THREE.RepeatWrapping;
    normalTex.wrapT = THREE.RepeatWrapping;
    normalTex.repeat.set(90, 90);

    return { groundTex, normalTex };
  }

  // --- Procedural Flowing Water Normal Map ---
  _generateWaterNormal() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(256, 256);
    const d = imgData.data;

    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const i = (y * 256 + x) * 4;
        const u = (x / 256) * Math.PI * 4;
        const v = (y / 256) * Math.PI * 4;
        const nx = Math.sin(u + v * 0.5) * 0.35 + Math.cos(u * 2 - v) * 0.2;
        const ny = Math.cos(v + u * 0.5) * 0.35 + Math.sin(v * 2 + u) * 0.2;
        const nz = 1.0;
        const len = Math.hypot(nx, ny, nz);

        d[i]     = Math.floor(((nx / len) * 0.5 + 0.5) * 255);
        d[i + 1] = Math.floor(((ny / len) * 0.5 + 0.5) * 255);
        d[i + 2] = Math.floor(((nz / len) * 0.5 + 0.5) * 255);
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const waterNormal = new THREE.CanvasTexture(canvas);
    waterNormal.wrapS = THREE.RepeatWrapping;
    waterNormal.wrapT = THREE.RepeatWrapping;
    waterNormal.repeat.set(36, 36);
    return waterNormal;
  }

  initLighting() {
    // Warm Nordic golden ambient
    this.hemiLight = new THREE.HemisphereLight(0xffeedd, 0x243d1a, 0.9);
    this.hemiLight.position.set(0, 300, 0);
    this.scene.add(this.hemiLight);

    // Scandinavian Sun with tight high-density shadow frustum centered dynamically on player
    this.sun = new THREE.DirectionalLight(0xfff0d0, 1.95);
    this.sun.position.set(85, 120, 65);
    this.sun.castShadow = true; // Enabled for beautiful grounded shadows on both mobile and desktop
    if (!isMobileDevice) {
      this.sun.shadow.mapSize.width = 2048;
      this.sun.shadow.mapSize.height = 2048;
      this.sun.shadow.camera.near = 1.0;
      this.sun.shadow.camera.far = 380;

      const d = 95; // Crisp, sharp shadow texel density
      this.sun.shadow.camera.left = -d;
      this.sun.shadow.camera.right = d;
      this.sun.shadow.camera.top = d;
      this.sun.shadow.camera.bottom = -d;
      this.sun.shadow.bias = -0.0001;
      this.sun.shadow.normalBias = 0.04;
    } else {
      this.sun.shadow.mapSize.width = 1024;
      this.sun.shadow.mapSize.height = 1024;
      this.sun.shadow.camera.near = 1.0;
      this.sun.shadow.camera.far = 160;
      const d = 55; // Focused shadow frustum around mobile player
      this.sun.shadow.camera.left = -d;
      this.sun.shadow.camera.right = d;
      this.sun.shadow.camera.top = d;
      this.sun.shadow.camera.bottom = -d;
      this.sun.shadow.bias = -0.0005;
      this.sun.shadow.normalBias = 0.05;
    }

    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.moon = new THREE.DirectionalLight(0x7090ff, 0.0);
    this.moon.position.set(-85, -120, -65);
    this.moon.castShadow = false;
    this.scene.add(this.moon);
  }

  initSky() {
    const skyGeo = new THREE.SphereGeometry(1500, 32, 16);
    this.skyMat = new THREE.MeshBasicMaterial({
      color: 0x76aed9,
      side: THREE.BackSide,
      fog: false
    });
    this.skyMesh = new THREE.Mesh(skyGeo, this.skyMat);
    this.scene.add(this.skyMesh);
  }

  applyBiomeAtmosphere(biome) {
    const atmosphere = {
      meadows: { fog: 0xc8b69b, sky: 0x76aed9, sun: 0xfff0d0, hemi: 0xffeedd },
      blackForest: { fog: 0x43534a, sky: 0x35556b, sun: 0xd8e0c4, hemi: 0xc4d1c0 },
      swamp: { fog: 0x465545, sky: 0x536958, sun: 0xc0d2a8, hemi: 0xb5c6ab },
      mountain: { fog: 0x8295a4, sky: 0x88a9c2, sun: 0xe7f2ff, hemi: 0xdbeaff },
      runePlains: { fog: 0x635979, sky: 0x806f9c, sun: 0xf3d8ff, hemi: 0xe5cbef },
      ashlands: { fog: 0x5f433d, sky: 0x6e4038, sun: 0xffa36b, hemi: 0xe1aa8a }
    };
    const colors = atmosphere[biome] || atmosphere.meadows;
    if (this.scene.fog) this.scene.fog.color.setHex(colors.fog);
    if (this.skyMat) this.skyMat.color.setHex(colors.sky);
    if (this.sun) this.sun.color.setHex(colors.sun);
    if (this.hemiLight) {
      this.hemiLight.color.setHex(colors.hemi);
      this.hemiLight.groundColor.setHex(colors.fog);
    }
  }

  initTerrain() {
    const size = 1400; // Expansive Scandinavian wilderness
    const segments = isMobileDevice ? 180 : 250;
    const groundGeo = new THREE.PlaneGeometry(size, size, segments, segments);
    groundGeo.rotateX(-Math.PI / 2);

    const pos = groundGeo.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    // 1. First pass: Set elevations for all vertices
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = this.getGroundHeight(x, z);
      pos.setY(i, y);
    }
    pos.needsUpdate = true;

    // Compute accurate 3D vertex normals for geological slope calculation
    groundGeo.computeVertexNormals();
    const normals = groundGeo.attributes.normal;

    // Color definitions per biome - calibrated to blend with Grass texture without muddy oversaturation
    const cRiverSand     = new THREE.Color(0xb5a782);

    // Meadows (starting valley) - natural warm Nordic golden-green
    const cMeadowLush    = new THREE.Color(0xb2d99b);
    const cMeadowDeep    = new THREE.Color(0x8fae7a);
    const cMeadowSlope   = new THREE.Color(0x75806c);

    // Black Forest (Aarniometsä) - deep spruce needle humus & moss
    const cForestLoam    = new THREE.Color(0x4a5d40);
    const cForestMoss    = new THREE.Color(0x5e7850);
    const cForestDark    = new THREE.Color(0x35422d);

    // Swamp (Suomaa / Räme) - dark peat bog & damp mire
    const cSwampMud      = new THREE.Color(0x4a4635);
    const cSwampPeat     = new THREE.Color(0x3b3a28);
    const cSwampWet      = new THREE.Color(0x2d3020);

    // Mountain (Kalliovuoristo / Lumihuiput) - gleaming snow & alpine granite
    const cSnowWhite     = new THREE.Color(0xffffff);
    const cFrostStone    = new THREE.Color(0xa0acb8);
    const cMountainSlate = new THREE.Color(0x6e7682);

    // Rune Plains (Riimutasanne) - golden heather steppe
    const cPlainsGold    = new THREE.Color(0xdfc168);
    const cPlainsAmber   = new THREE.Color(0xc2a652);
    const cPlainsDry     = new THREE.Color(0x947e38);

    // Ashlands (Sysivuori / Tulimaa) - scorched volcanic basalt
    const cAshObsidian   = new THREE.Color(0x262227);
    const cAshCharcoal   = new THREE.Color(0x382c2d);
    const cAshEmber      = new THREE.Color(0x52231b);

    const tempColor = new THREE.Color();

    // 2. Second pass: Calculate geological vertex colors based on height, biome, and surface slope
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = pos.getY(i);
      const ny = normals.getY(i);
      const slope = Math.max(0, 1.0 - ny); // 0 = flat ground, 0.4+ = steep rocky cliff

      const biome = getBiomeKey(x, z);

      if (y < 0.2) {
        tempColor.copy(cRiverSand);
      } else if (y < 1.3) {
        tempColor.copy(cRiverSand).lerp(cMeadowLush, (y - 0.2) / 1.1);
      } else {
        // Biome-specific baseline coloring
        if (biome === 'mountain') {
          if (y > 22.0) {
            tempColor.copy(cSnowWhite);
            if (slope > 0.25) {
              tempColor.lerp(cFrostStone, Math.min(1.0, (slope - 0.25) / 0.25));
            }
          } else if (y > 14.0) {
            tempColor.copy(cFrostStone).lerp(cSnowWhite, (y - 14.0) / 8.0);
          } else {
            tempColor.copy(cMountainSlate).lerp(cFrostStone, Math.min(1.0, (y - 8.0) / 6.0));
          }
        } else if (biome === 'swamp') {
          if (y < 2.5) {
            tempColor.copy(cSwampWet);
          } else if (y < 5.0) {
            tempColor.copy(cSwampMud).lerp(cSwampPeat, (y - 2.5) / 2.5);
          } else {
            tempColor.copy(cSwampPeat);
          }
        } else if (biome === 'ashlands') {
          if (y > 10.0) {
            tempColor.copy(cAshObsidian).lerp(cAshEmber, 0.35);
          } else {
            tempColor.copy(cAshCharcoal).lerp(cAshObsidian, 0.5);
          }
        } else if (biome === 'runePlains') {
          tempColor.copy(cPlainsGold).lerp(cPlainsAmber, Math.sin(x * 0.05 + z * 0.05) * 0.5 + 0.5);
        } else if (biome === 'blackForest') {
          if (y < 8.0) {
            tempColor.copy(cForestMoss).lerp(cForestLoam, (y - 1.3) / 6.7);
          } else {
            tempColor.copy(cForestLoam).lerp(cForestDark, Math.min(1.0, (y - 8.0) / 10.0));
          }
        } else {
          // Meadows
          if (y < 8.0) {
            tempColor.copy(cMeadowLush).lerp(cMeadowDeep, (y - 1.3) / 6.7);
          } else if (y < 18.0) {
            tempColor.copy(cMeadowDeep).lerp(cMeadowSlope, Math.min(1.0, (y - 8.0) / 10.0));
          } else {
            tempColor.copy(cMeadowSlope);
          }
        }

        // 3. Slope-based cliff blending: Steep inclines reveal raw Nordic stone face instead of playdough
        if (slope > 0.22 && biome !== 'mountain') {
          const rockWeight = Math.min(0.85, (slope - 0.22) / 0.26);
          tempColor.lerp(cMountainSlate, rockWeight);
        }
      }

      colors[i * 3 + 0] = tempColor.r;
      colors[i * 3 + 1] = tempColor.g;
      colors[i * 3 + 2] = tempColor.b;
    }

    groundGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // High-definition seamless organic Scandinavian terrain textures
    const { groundTex, normalTex } = this._generateGroundTextures();

    this.groundMat = new THREE.MeshStandardMaterial({
      map: groundTex,
      normalMap: normalTex,
      normalScale: new THREE.Vector2(0.35, 0.35),
      vertexColors: true,
      roughness: 0.96,
      metalness: 0.0
    });

    this.groundMesh = new THREE.Mesh(groundGeo, this.groundMat);
    this.groundMesh.receiveShadow = true;
    this.scene.add(this.groundMesh);
  }

  initWater() {
    const size = 1400;
    const waterGeo = new THREE.PlaneGeometry(size, size, isMobileDevice ? 24 : 32, isMobileDevice ? 24 : 32);
    waterGeo.rotateX(-Math.PI / 2);

    this.waterNormal = this._generateWaterNormal();

    this.waterMat = new THREE.MeshStandardMaterial({
      color: 0x1a728a,
      normalMap: this.waterNormal,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: 0.12,
      metalness: 0.25,
      transparent: true,
      opacity: 0.85
    });

    this.waterMesh = new THREE.Mesh(waterGeo, this.waterMat);
    this.waterMesh.position.y = -1.0;
    this.waterMesh.receiveShadow = true;
    this.scene.add(this.waterMesh);
  }

  initInstancedGrass() {
    let grassSource = this.assetLoader ? this.assetLoader.get('Grass_Common_Tall') : null;
    if (!grassSource && this.assetLoader) {
      grassSource = this.assetLoader.get('Grass_Wispy_Tall');
    }

    let grassGeo = null;
    let grassMat = null;

    if (grassSource) {
      grassSource.traverse((child) => {
        if (child.isMesh && !grassGeo) {
          grassGeo = child.geometry.clone();
          grassMat = child.material.clone();
        }
      });
    }

    if (!grassGeo) {
      grassGeo = new THREE.PlaneGeometry(0.5, 1.2, 1, 3);
      grassGeo.translate(0, 0.6, 0);
      grassMat = new THREE.MeshStandardMaterial({
        color: 0x48a832,
        side: THREE.DoubleSide,
        roughness: 0.7,
        alphaTest: 0.5
      });
    } else {
      grassMat.side = THREE.DoubleSide;
      grassMat.shadowSide = THREE.DoubleSide;
    }

    const count = isMobileDevice ? 1600 : 7000;
    this.instancedGrass = new THREE.InstancedMesh(grassGeo, grassMat, count);
    this.instancedGrass.receiveShadow = true;

    const dummy = new THREE.Object3D();
    const tempColor = new THREE.Color();
    const grassColors = [0x5eb83b, 0x48a02c, 0x68c445, 0x3d8c24];

    let placed = 0;
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 550;
      const z = (Math.random() - 0.5) * 550;
      const y = this.getGroundHeight(x, z);

      // Clean riverbed: strictly no grass underwater or in river channel
      const riverX = -16 + Math.sin(z * 0.015) * 20;
      const distToRiver = Math.abs(x - riverX);
      const distToCenter = Math.sqrt(x * x + z * z);

      // Keep village paths, houses, and town square clean of grass
      if (x > -48 && x < 25 && z > -42 && z < 22) continue;
      if (distToCenter < 22) continue;

      const biome = getBiomeKey(x, z);
      if (biome === 'ashlands') continue; // No lush grass in volcanic ashlands
      if (biome === 'mountain' && y > 18.0) continue; // No grass on snowy peaks

      if (y > 0.8 && y < 28.0 && distToRiver > 20) {
        dummy.position.set(x, y - 0.05, z);
        const s = 0.8 + Math.random() * 0.6;
        dummy.scale.set(s, s * (0.85 + Math.random() * 0.4), s);
        dummy.rotation.y = Math.random() * Math.PI * 2;
        dummy.rotation.x = (Math.random() - 0.5) * 0.15;
        dummy.rotation.z = (Math.random() - 0.5) * 0.15;
        dummy.updateMatrix();

        this.instancedGrass.setMatrixAt(placed, dummy.matrix);

        if (biome === 'runePlains') {
          const goldGrass = [0xd4b854, 0xc4a648, 0xb8983e];
          tempColor.setHex(goldGrass[Math.floor(Math.random() * goldGrass.length)]);
        } else if (biome === 'blackForest') {
          const darkGrass = [0x234720, 0x1d3d19, 0x2b5227];
          tempColor.setHex(darkGrass[Math.floor(Math.random() * darkGrass.length)]);
        } else if (biome === 'swamp') {
          const swampGrass = [0x2b381e, 0x243018, 0x334222];
          tempColor.setHex(swampGrass[Math.floor(Math.random() * swampGrass.length)]);
        } else if (biome === 'mountain') {
          const frostGrass = [0x8fa895, 0xa3bca9, 0x7e9483];
          tempColor.setHex(frostGrass[Math.floor(Math.random() * frostGrass.length)]);
        } else {
          tempColor.setHex(grassColors[Math.floor(Math.random() * grassColors.length)]);
        }

        this.instancedGrass.setColorAt(placed, tempColor);
        placed++;
      }
    }

    this.instancedGrass.count = placed;
    this.instancedGrass.instanceMatrix.needsUpdate = true;
    if (this.instancedGrass.instanceColor) {
      this.instancedGrass.instanceColor.needsUpdate = true;
    }

    this.scene.add(this.instancedGrass);
  }

  initInstancedFerns() {
    let fernSource = this.assetLoader ? this.assetLoader.get('Fern_1') : null;
    let fernGeo = null;
    let fernMat = null;

    if (fernSource) {
      fernSource.traverse((child) => {
        if (child.isMesh && !fernGeo) {
          fernGeo = child.geometry.clone();
          fernMat = child.material.clone();
        }
      });
    }

    if (!fernGeo) {
      fernGeo = new THREE.PlaneGeometry(0.8, 1.4, 2, 4);
      fernGeo.translate(0, 0.7, 0);
      fernMat = new THREE.MeshStandardMaterial({
        color: 0x2e6924,
        side: THREE.DoubleSide,
        roughness: 0.65
      });
    } else {
      fernMat.side = THREE.DoubleSide;
      fernMat.shadowSide = THREE.DoubleSide;
    }

    const count = isMobileDevice ? 500 : 3500;
    this.instancedFerns = new THREE.InstancedMesh(fernGeo, fernMat, count);
    this.instancedFerns.receiveShadow = true;

    const dummy = new THREE.Object3D();
    const tempColor = new THREE.Color();
    const fernColors = [0x2f6b24, 0x3d7e2e, 0x27591e, 0x488a36];

    let placed = 0;
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 650;
      const z = (Math.random() - 0.5) * 650;
      const y = this.getGroundHeight(x, z);

      // Clean riverbed: strictly no ferns in water
      const riverX = -16 + Math.sin(z * 0.015) * 20;
      const distToRiver = Math.abs(x - riverX);
      const distToCenter = Math.sqrt(x * x + z * z);

      // Village exclusion
      if (x > -48 && x < 25 && z > -42 && z < 22) continue;
      if (distToCenter < 22) continue;

      const biome = getBiomeKey(x, z);
      if (biome === 'mountain' || biome === 'ashlands') continue;

      if (y > 0.8 && y < 22.0 && distToRiver > 20) {
        dummy.position.set(x, y - 0.05, z);
        const s = 1.0 + Math.random() * 0.9;
        dummy.scale.set(s, s * (0.9 + Math.random() * 0.3), s);
        dummy.rotation.y = Math.random() * Math.PI * 2;
        dummy.rotation.x = (Math.random() - 0.5) * 0.12;
        dummy.rotation.z = (Math.random() - 0.5) * 0.12;
        dummy.updateMatrix();

        this.instancedFerns.setMatrixAt(placed, dummy.matrix);

        tempColor.setHex(fernColors[Math.floor(Math.random() * fernColors.length)]);
        this.instancedFerns.setColorAt(placed, tempColor);
        placed++;
      }
    }

    this.instancedFerns.count = placed;
    this.instancedFerns.instanceMatrix.needsUpdate = true;
    if (this.instancedFerns.instanceColor) {
      this.instancedFerns.instanceColor.needsUpdate = true;
    }

    this.scene.add(this.instancedFerns);
  }

  initFireflies() {
    const particleCount = 200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const phases = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const x = (Math.random() - 0.5) * 350;
      const z = (Math.random() - 0.5) * 350;
      const y = this.getGroundHeight(x, z) + 0.8 + Math.random() * 3.0;

      positions[i * 3 + 0] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      phases[i] = Math.random() * Math.PI * 2;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));

    const material = new THREE.PointsMaterial({
      color: 0xe8ff66,
      size: 0.38,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });

    this.fireflies = new THREE.Points(geometry, material);
    this.scene.add(this.fireflies);
  }

  initClouds() {
    const cloudMat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.82
    });

    for (let i = 0; i < 24; i++) {
      const cloudGroup = new THREE.Group();
      const puffs = 4 + Math.floor(Math.random() * 4);

      for (let p = 0; p < puffs; p++) {
        const rad = 12 + Math.random() * 10;
        const sphereGeo = new THREE.DodecahedronGeometry(rad, 1);
        const sphereMesh = new THREE.Mesh(sphereGeo, cloudMat);
        sphereMesh.position.set(
          (Math.random() - 0.5) * 26,
          (Math.random() - 0.5) * 7,
          (Math.random() - 0.5) * 24
        );
        cloudGroup.add(sphereMesh);
      }

      const x = (Math.random() - 0.5) * 900;
      const y = 90 + Math.random() * 45;
      const z = (Math.random() - 0.5) * 900;

      cloudGroup.position.set(x, y, z);
      cloudGroup.userData.driftSpeed = 0.8 + Math.random() * 1.4;

      this.scene.add(cloudGroup);
      this.clouds.push(cloudGroup);
    }
  }

  initAurora() {
    const colors = [0x62f5c5, 0x6aa7ff, 0xc47cff];
    for (let i = 0; i < 3; i++) {
      const geometry = new THREE.PlaneGeometry(170, 34, 12, 4);
      const material = new THREE.MeshBasicMaterial({
        color: colors[i],
        transparent: true,
        opacity: 0.045,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false
      });
      const ribbon = new THREE.Mesh(geometry, material);
      ribbon.position.set((i - 1) * 95, 78 + i * 4, -150 - i * 28);
      ribbon.rotation.set(0.08, 0.18 + i * 0.12, (i - 1) * 0.08);
      ribbon.userData.phase = i * 1.7;
      this.scene.add(ribbon);
      this.aurora.push(ribbon);
    }
  }

  isDeletedAt(x, z, radius = 2.0) {
    if (!this.deletedEdits || this.deletedEdits.length === 0) return false;
    for (let i = 0; i < this.deletedEdits.length; i++) {
      const d = this.deletedEdits[i];
      const r = d.radius || radius;
      if (Math.hypot(d.x - x, d.z - z) < r) {
        return true;
      }
    }
    return false;
  }

  isNearRiver(x, z, margin = 22) {
    const riverX = -16 + Math.sin(z * 0.015) * 20;
    return Math.abs(x - riverX) < margin;
  }

  _placeModel(name, x, z, scale = 1.0, rotation = 0, ignoreDeleted = false) {
    if (!ignoreDeleted && this.isDeletedAt(x, z, 2.0)) {
      return null;
    }
    // Prevent natural and town assets from spawning submerged in riverbed
    const y = this.getGroundHeight(x, z);
    if (!ignoreDeleted && !name.includes('Floor') && !name.includes('Fence') && this.isNearRiver(x, z, 18) && y < 0.8) {
      return null;
    }
    if (!this.assetLoader) return null;
    const model = this.assetLoader.get(name);
    if (!model) return null;
    model.position.set(x, y, z);

    if (typeof scale === 'number') {
      model.scale.set(scale, scale, scale);
    } else if (scale && scale.x !== undefined) {
      model.scale.copy(scale);
    }

    if (typeof rotation === 'number') {
      model.rotation.y = rotation;
    } else if (rotation && rotation.y !== undefined) {
      model.rotation.copy(rotation);
    }

    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    // Automatically register solid colliders for props and town structures
    if (name === 'Chest_Wood') {
      this.addCircleCollider(x, z, 0.65, 'chest');
    } else if (name === 'Barrel' || name === 'Barrel_Apples') {
      this.addCircleCollider(x, z, 0.55, 'barrel');
    } else if (name === 'Anvil_Log') {
      this.addCircleCollider(x, z, 0.60, 'anvil');
    } else if (name === 'Bench') {
      this.addCircleCollider(x, z, 0.75, 'bench');
    } else if (name === 'Cauldron') {
      this.addCircleCollider(x, z, 0.70, 'cauldron');
    } else if (name === 'Workbench' || name === 'Workbench_Drawers') {
      this.addCircleCollider(x, z, 0.85, 'workbench');
    } else if (name === 'Stall_Empty' || name === 'Stall_Cart_Empty') {
      this.addCircleCollider(x, z, 1.25, 'stall');
    } else if (name === 'Prop_Wagon') {
      this.addCircleCollider(x, z, 1.40, 'wagon');
    } else if (name === 'FarmCrate_Apple' || name === 'FarmCrate_Carrot' || name === 'Prop_Crate') {
      this.addCircleCollider(x, z, 0.55, 'crate');
    } else if (name === 'WeaponStand') {
      this.addCircleCollider(x, z, 0.65, 'weaponstand');
    } else if (name === 'Bed_Twin1') {
      this.addCircleCollider(x, z, 0.95, 'bed');
    } else if (name === 'Table_Large') {
      this.addCircleCollider(x, z, 1.10, 'table');
    } else if (name === 'Wall_Arch') {
      this.addCircleCollider(x, z, 0.85, 'wall_arch');
    } else if (name.includes('Fence')) {
      this.addCircleCollider(x, z, 0.75, 'fence');
    } else if (name.includes('TreeStump')) {
      this.addCircleCollider(x, z, 0.75, 'stump');
    } else if (name.includes('WoodLog')) {
      this.addCircleCollider(x, z, 0.85, 'log');
    } else if (name.includes('Rock_Medium') || name.includes('Rock_Moss') || name === 'Rock_1') {
      this.addCircleCollider(x, z, 1.10, 'rock');
    } else if (name.includes('CandleStick')) {
      this.addCircleCollider(x, z, 0.45, 'candlestick');
    }

    this.scene.add(model);
    return model;
  }

  spawnTree(x, z, modelName = 'Pine_1', scale = null, rot = null, customId = null) {
    const y = this.getGroundHeight(x, z);
    const chosenScale = scale || (modelName.includes('Birch') ? 2.2 : 2.6);
    const chosenRot = rot !== null ? rot : Math.random() * Math.PI * 2;
    const treeMesh = this._placeModel(modelName, x, z, chosenScale, chosenRot, true);
    if (!treeMesh) return null;

    const treeNode = {
      mesh: treeMesh,
      position: new THREE.Vector3(x, y, z),
      type: 'tree',
      modelName,
      health: 100,
      maxHealth: 100,
      harvested: false,
      name: modelName.includes('Birch') ? 'Koivupuu' : 'Mäntypuu',
      customId: customId || null
    };
    treeMesh.userData.resourceNode = treeNode;
    treeMesh.userData.customId = customId || null;
    treeMesh.traverse((child) => {
      child.userData.resourceNode = treeNode;
      child.userData.customId = customId || null;
    });

    this.trees.push(treeNode);
    this.addCircleCollider(x, z, 0.45, 'tree', treeNode);
    return treeNode;
  }

  spawnStone(x, z, modelName = 'Rock_1', scale = null, rot = null, customId = null) {
    const y = this.getGroundHeight(x, z);
    const isLoose = modelName === 'Pebble_Round_1';
    const chosenScale = scale || (isLoose ? 1.4 : 1.2);
    const chosenRot = rot !== null ? rot : Math.random() * Math.PI * 2;
    const rockMesh = this._placeModel(modelName, x, z, chosenScale, chosenRot, true);
    if (!rockMesh) return null;

    const stoneNode = {
      mesh: rockMesh,
      position: new THREE.Vector3(x, y, z),
      type: 'stone',
      modelName,
      isLooseStone: isLoose,
      health: isLoose ? 20 : 100,
      maxHealth: isLoose ? 20 : 100,
      harvested: false,
      name: isLoose ? 'Irtokivi (Poimi käsin)' : 'Kivijärkäle',
      customId: customId || null
    };
    rockMesh.userData.resourceNode = stoneNode;
    rockMesh.userData.customId = customId || null;
    rockMesh.traverse((child) => {
      child.userData.resourceNode = stoneNode;
      child.userData.customId = customId || null;
    });

    this.stones.push(stoneNode);
    if (!isLoose) {
      this.addCircleCollider(x, z, 0.85, 'rock', stoneNode);
    }
    return stoneNode;
  }

  removeEntity(target) {
    if (!target) return;
    const mesh = target.mesh || target;

    // 1. Remove from trees
    this.trees = this.trees.filter(t => t.mesh !== mesh && t !== target);

    // 2. Remove from stones
    this.stones = this.stones.filter(s => s.mesh !== mesh && s !== target);

    // 3. Remove from wildChests
    const chestIndex = this.wildChests.findIndex(c => c.mesh === mesh || c === target);
    if (chestIndex !== -1) {
      const chest = this.wildChests[chestIndex];
      if (chest.glowMarker) this.scene.remove(chest.glowMarker);
      if (chest.glowLight) this.scene.remove(chest.glowLight);
      if (chest.position) {
        this.colliders = this.colliders.filter(c => !(c.type === 'circle' && c.name === 'wildChest' && Math.hypot(c.x - chest.position.x, c.z - chest.position.z) < 0.2));
      }
      this.wildChests.splice(chestIndex, 1);
    }

    // 4. Remove from decorations
    this.decorations = this.decorations.filter(d => d !== mesh);

    // 5. Remove from bushes, ores, mushrooms
    this.bushes = this.bushes.filter(b => b.mesh !== mesh);
    this.ores = this.ores.filter(o => o.mesh !== mesh);
    this.mushrooms = this.mushrooms.filter(m => m.mesh !== mesh);

    // 6. Remove any associated colliders
    if (mesh.position) {
      const px = mesh.position.x;
      const pz = mesh.position.z;
      this.colliders = this.colliders.filter(c => {
        if (c.type === 'box') {
          return !(px >= c.minX - 0.6 && px <= c.maxX + 0.6 && pz >= c.minZ - 0.6 && pz <= c.maxZ + 0.6);
        } else if (c.type === 'circle') {
          const dx = px - c.x;
          const dz = pz - c.z;
          const rad = (c.radius || 0.6) + 0.6;
          return (dx * dx + dz * dz) > (rad * rad);
        }
        return true;
      });
    }

    // 7. Remove from Three.js scene
    this.scene.remove(mesh);
  }

  addBoxCollider(minX, maxX, minZ, maxZ, name = '') {
    this.colliders.push({ type: 'box', minX, maxX, minZ, maxZ, name });
  }

  addCircleCollider(x, z, radius, name = '', node = null) {
    this.colliders.push({ type: 'circle', x, z, radius, name, node });
  }

  isPositionBlocked(x, z, playerRadius = 0.42, buildingSystem = null) {
    // 1. Check all registered World colliders (buildings, walls, props, trees, rocks, ores)
    for (let i = 0; i < this.colliders.length; i++) {
      const c = this.colliders[i];
      if (c.node && c.node.harvested) continue;

      if (c.type === 'box') {
        const halfW = (c.maxX - c.minX) * 0.5 + playerRadius;
        const halfD = (c.maxZ - c.minZ) * 0.5 + playerRadius;
        const midX = (c.minX + c.maxX) * 0.5;
        const midZ = (c.minZ + c.maxZ) * 0.5;
        if (Math.abs(x - midX) > halfW || Math.abs(z - midZ) > halfD) continue;

        const closestX = Math.max(c.minX, Math.min(x, c.maxX));
        const closestZ = Math.max(c.minZ, Math.min(z, c.maxZ));
        const dx = x - closestX;
        const dz = z - closestZ;
        if (dx * dx + dz * dz < playerRadius * playerRadius) {
          return true;
        }
      } else if (c.type === 'circle') {
        const maxDist = playerRadius + c.radius;
        const dx = x - c.x;
        const dz = z - c.z;
        if (Math.abs(dx) > maxDist || Math.abs(dz) > maxDist) continue;
        if (dx * dx + dz * dz < maxDist * maxDist) {
          return true;
        }
      }
    }

    // 2. Check placed building pieces (Walls, Smelters, Forges, Palisades)
    if (buildingSystem && buildingSystem.placedColliders) {
      const bCols = buildingSystem.placedColliders;
      for (let i = 0; i < bCols.length; i++) {
        const c = bCols[i];
        if (c.enabled === false) continue;
        const halfW = (c.maxX - c.minX) * 0.5 + playerRadius;
        const halfD = (c.maxZ - c.minZ) * 0.5 + playerRadius;
        const midX = (c.minX + c.maxX) * 0.5;
        const midZ = (c.minZ + c.maxZ) * 0.5;
        if (Math.abs(x - midX) > halfW || Math.abs(z - midZ) > halfD) continue;

        const closestX = Math.max(c.minX, Math.min(x, c.maxX));
        const closestZ = Math.max(c.minZ, Math.min(z, c.maxZ));
        const dx = x - closestX;
        const dz = z - closestZ;
        if (dx * dx + dz * dz < playerRadius * playerRadius) {
          const isInside = (x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ);
          if (isInside) continue;
          return true;
        }
      }
    }

    return false;
  }

  // --- Solid Stone Plinth Foundation ---
  // Sinks 2.5m into the ground beneath buildings, eliminating all light leaks, gaps, and terrain clipping
  _createFoundationBox(minX, maxX, minZ, maxZ, height = 2.5, color = 0x3d3a36) {
    const w = maxX - minX;
    const d = maxZ - minZ;
    const geo = new THREE.BoxGeometry(w, height, d);
    const mat = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.95,
      metalness: 0.05
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set((minX + maxX) / 2, -height / 2 + 0.02, (minZ + maxZ) / 2);
    mesh.receiveShadow = true;
    return mesh;
  }

  // Add piece to a building group in local coordinates
  _addPiece(group, name, lx, ly, lz, rotY = 0, scale = 1.0) {
    if (!this.assetLoader) return null;
    const model = this.assetLoader.get(name);
    if (!model) return null;

    model.position.set(lx, ly, lz);
    if (typeof scale === 'number') {
      model.scale.set(scale, scale, scale);
    } else if (scale && scale.x !== undefined) {
      model.scale.copy(scale);
    }
    model.rotation.y = rotY;

    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    group.add(model);
    return model;
  }

  // --- Chieftain's Great Hall (Päällikön Suurtupa, 6x8m Grid Snapped) ---
  buildGreatHall6x8(baseX, baseZ) {
    const c1 = this.getGroundHeight(baseX - 3.2, baseZ - 4.2);
    const c2 = this.getGroundHeight(baseX + 3.2, baseZ - 4.2);
    const c3 = this.getGroundHeight(baseX - 3.2, baseZ + 4.2);
    const c4 = this.getGroundHeight(baseX + 3.2, baseZ + 4.2);
    const c0 = this.getGroundHeight(baseX, baseZ);
    const baseY = Math.max(c1, c2, c3, c4, c0) + 0.12;

    const group = new THREE.Group();
    group.position.set(baseX, baseY, baseZ);

    // Stone foundation anchoring building into terrain
    group.add(this._createFoundationBox(-3.2, 3.2, -4.2, 4.2, 2.8, 0x3a3632));

    // Floor: 12 tiles (3x4 grid of 2x2m planks)
    for (const x of [-2, 0, 2]) {
      for (const z of [-3, -1, 1, 3]) {
        this._addPiece(group, 'Floor_WoodDark', x, 0, z, 0, 1.0);
      }
    }

    // Front facade (Z = 4, facing Z+)
    this._addPiece(group, 'Wall_Plaster_Window_Wide_Flat', -2, 0, 4, 0, 1.0);
    this._addPiece(group, 'Wall_Plaster_Door_Flat', 0, 0, 4, 0, 1.0);
    this._addPiece(group, 'Door_1_Flat', 0.45, 0, 3.85, 0.45, 1.0);
    this._addPiece(group, 'Wall_Plaster_Window_Wide_Flat', 2, 0, 4, 0, 1.0);

    // Back wall (Z = -4, facing Z-)
    this._addPiece(group, 'Wall_Plaster_Straight', -2, 0, -4, Math.PI, 1.0);
    this._addPiece(group, 'Wall_Plaster_Window_Wide_Flat', 0, 0, -4, Math.PI, 1.0);
    this._addPiece(group, 'Wall_Plaster_Straight', 2, 0, -4, Math.PI, 1.0);

    // Left wall (X = -3, facing X-)
    this._addPiece(group, 'Wall_Plaster_Straight', -3, 0, -3, Math.PI / 2, 1.0);
    this._addPiece(group, 'Wall_Plaster_Window_Wide_Flat', -3, 0, -1, Math.PI / 2, 1.0);
    this._addPiece(group, 'Wall_Plaster_Window_Wide_Flat', -3, 0, 1, Math.PI / 2, 1.0);
    this._addPiece(group, 'Wall_Plaster_Straight', -3, 0, 3, Math.PI / 2, 1.0);

    // Right wall (X = 3, facing X+)
    this._addPiece(group, 'Wall_Plaster_Straight', 3, 0, -3, -Math.PI / 2, 1.0);
    this._addPiece(group, 'Wall_Plaster_Window_Wide_Flat', 3, 0, -1, -Math.PI / 2, 1.0);
    this._addPiece(group, 'Wall_Plaster_Window_Wide_Flat', 3, 0, 1, -Math.PI / 2, 1.0);
    this._addPiece(group, 'Wall_Plaster_Straight', 3, 0, 3, -Math.PI / 2, 1.0);

    // Great Hall Roof & Chimney
    this._addPiece(group, 'Roof_RoundTiles_6x8', 0, 3.0, 0, 0, 1.0);
    this._addPiece(group, 'Prop_Chimney', 2.2, 3.6, -2.8, 0, 1.1);

    // Exterior entry porch steps
    this._addPiece(group, 'Floor_WoodDark', 0, -0.28, 4.8, 0, 0.9);
    this._addPiece(group, 'Floor_WoodDark', 0, -0.56, 5.6, 0, 0.9);

    // Interior Viking Longhouse Furnishings
    this._addPiece(group, 'Table_Large', 0, 0, 0, 0, 1.0);
    this._addPiece(group, 'Chair_1', -1.2, 0, 0, Math.PI / 2, 1.0);
    this._addPiece(group, 'Chair_1', 1.2, 0, 0, -Math.PI / 2, 1.0);
    this._addPiece(group, 'Chair_1', 0, 0, -1.2, 0, 1.0);
    this._addPiece(group, 'Chair_1', 0, 0, 1.2, Math.PI, 1.0);
    this._addPiece(group, 'Bed_Twin1', -1.8, 0, -2.8, 0, 1.0);
    this._addPiece(group, 'Bookcase_2', -2.7, 0, 0.5, Math.PI / 2, 1.0);
    this._addPiece(group, 'Chest_Wood', 2.0, 0, -2.8, -0.4, 1.0);

    // Warm hearth light
    const hallLight = new THREE.PointLight(0xffbe6b, 2.5, 22, 1.3);
    hallLight.position.set(0, 2.3, 0);
    group.add(hallLight);

    // Wall colliders (blocks walking through walls, doorway left open at front X: [-0.75, 0.75])
    this.addBoxCollider(baseX - 3.4, baseX - 2.7, baseZ - 4.3, baseZ + 4.3, 'GreatHall_Left');
    this.addBoxCollider(baseX + 2.7, baseX + 3.4, baseZ - 4.3, baseZ + 4.3, 'GreatHall_Right');
    this.addBoxCollider(baseX - 3.4, baseX + 3.4, baseZ - 4.4, baseZ - 3.7, 'GreatHall_Back');
    this.addBoxCollider(baseX - 3.4, baseX - 0.75, baseZ + 3.7, baseZ + 4.4, 'GreatHall_FrontL');
    this.addBoxCollider(baseX + 0.75, baseX + 3.4, baseZ + 3.7, baseZ + 4.4, 'GreatHall_FrontR');

    this.scene.add(group);
    return group;
  }

  // --- Scandinavian 4x4m Cottage (Snug, Seamless 2m Grid) ---
  buildCottage4x4(baseX, baseZ, rotY = 0, wallType = 'Plaster', floorType = 'Floor_WoodDark') {
    const c1 = this.getGroundHeight(baseX - 2.2, baseZ - 2.2);
    const c2 = this.getGroundHeight(baseX + 2.2, baseZ - 2.2);
    const c3 = this.getGroundHeight(baseX - 2.2, baseZ + 2.2);
    const c4 = this.getGroundHeight(baseX + 2.2, baseZ + 2.2);
    const c0 = this.getGroundHeight(baseX, baseZ);
    const baseY = Math.max(c1, c2, c3, c4, c0) + 0.12;

    const group = new THREE.Group();
    group.position.set(baseX, baseY, baseZ);
    group.rotation.y = rotY;

    // Stone foundation
    group.add(this._createFoundationBox(-2.2, 2.2, -2.2, 2.2, 2.5, wallType === 'UnevenBrick' ? 0x48423d : 0x3d3a36));

    // Floor: 4 tiles (2x2 grid)
    for (const x of [-1, 1]) {
      for (const z of [-1, 1]) {
        this._addPiece(group, floorType, x, 0, z, 0, 1.0);
      }
    }

    const wallPrefix = wallType === 'UnevenBrick' ? 'Wall_UnevenBrick' : 'Wall_Plaster';

    // Front wall (Z = 2)
    this._addPiece(group, `${wallPrefix}_Door_Flat`, -1, 0, 2, 0, 1.0);
    this._addPiece(group, 'Door_1_Flat', -0.55, 0, 1.85, 0.45, 1.0);
    this._addPiece(group, `${wallPrefix}_Window_Wide_Flat`, 1, 0, 2, 0, 1.0);

    // Back wall (Z = -2)
    this._addPiece(group, `${wallPrefix}_Straight`, -1, 0, -2, Math.PI, 1.0);
    this._addPiece(group, `${wallPrefix}_Window_Wide_Flat`, 1, 0, -2, Math.PI, 1.0);

    // Left wall (X = -2)
    this._addPiece(group, `${wallPrefix}_Straight`, -2, 0, -1, Math.PI / 2, 1.0);
    this._addPiece(group, `${wallPrefix}_Straight`, -2, 0, 1, Math.PI / 2, 1.0);

    // Right wall (X = 2)
    this._addPiece(group, `${wallPrefix}_Straight`, 2, 0, -1, -Math.PI / 2, 1.0);
    this._addPiece(group, `${wallPrefix}_Straight`, 2, 0, 1, -Math.PI / 2, 1.0);

    // Roof & Chimney
    this._addPiece(group, 'Roof_RoundTiles_4x4', 0, 3.0, 0, 0, 1.0);
    this._addPiece(group, 'Prop_Chimney', 1.2, 3.1, -1.2, 0, 1.0);

    // Entrance step
    this._addPiece(group, floorType, -1, -0.28, 2.7, 0, 0.85);

    // Warm interior emissive lantern (zero dynamic WebGL light cost)
    const lanternGeo = new THREE.SphereGeometry(0.12, 6, 6);
    const lanternMat = new THREE.MeshBasicMaterial({ color: 0xffb84d });
    const lantern = new THREE.Mesh(lanternGeo, lanternMat);
    lantern.position.set(0, 2.1, 0);
    group.add(lantern);

    // Solid cottage wall colliders (Door opening left at front X: [-1.6, -0.3])
    if (rotY === 0) {
      this.addBoxCollider(baseX - 2.3, baseX - 1.7, baseZ - 2.3, baseZ + 2.3, 'Cottage_L');
      this.addBoxCollider(baseX + 1.7, baseX + 2.3, baseZ - 2.3, baseZ + 2.3, 'Cottage_R');
      this.addBoxCollider(baseX - 2.3, baseX + 2.3, baseZ - 2.4, baseZ - 1.7, 'Cottage_B');
      this.addBoxCollider(baseX - 2.3, baseX - 1.6, baseZ + 1.7, baseZ + 2.4, 'Cottage_FL');
      this.addBoxCollider(baseX - 0.3, baseX + 2.3, baseZ + 1.7, baseZ + 2.4, 'Cottage_FR');
    } else {
      this.addBoxCollider(baseX - 2.1, baseX + 2.1, baseZ - 2.1, baseZ + 2.1, 'Cottage_Rot');
    }

    this.scene.add(group);
    return group;
  }

  // --- Keskuskylä (Main Valley Settlement) ---
  buildCentralTown() {
    // 1. Chieftain's Great Hall (Päällikön Suurtupa) at (x: 0, z: -16)
    this.buildGreatHall6x8(0, -16);

    // 1b. Grand Guildhall / Longhouse (Suuri Kiltatupa) at (x: 12, z: 6) – Village Elder Vanha Einari
    const grandHall = this._placeModel('LargeBuilding01', 12, 6, 1.0, 0);
    if (grandHall) {
      this.addBoxCollider(12 - 4.4, 12 + 4.4, 6 - 2.3, 6 + 2.3, 'LargeBuilding01_Guildhall');
    }

    // 2. Herbalist Cottage (Yrttitupa) at (x: 16, z: -8) – Nuori Aino
    const herbHouse = this._placeModel('SmallBuilding01', 16, -8, 1.0, 0);
    if (herbHouse) {
      this.addBoxCollider(16 - 1.4, 16 + 1.4, -8 - 1.7, -8 + 1.7, 'SmallBuilding01_Herb');
    }
    this._placeModel('Bench', 18.2, -5.5, 0.9, 0.3);
    this._placeModel('Flower_3_Group', 13.5, -5.5, 1.2, 0);
    this._placeModel('Flower_4_Group', 18.6, -7.5, 1.1, 0.6);

    // 3. Blacksmith Forge (Sepän Paja) at (x: -24, z: -30) – Seppä Ilmari
    const forgeHouse = this._placeModel('SmallBuilding02', -24, -30, 1.0, 0);
    if (forgeHouse) {
      this.addBoxCollider(-24 - 1.4, -24 + 1.4, -30 - 1.7, -30 + 1.7, 'SmallBuilding02_Forge');
    }

    // Outside forge workstations
    const forgeY = this.getGroundHeight(-24, -28);
    this._placeModel('Anvil_Log', -24, -27.2, 1.1, 0.3);
    this._placeModel('WeaponStand', -21.2, -27.5, 1.1, -0.7);
    this._placeModel('Barrel', -26.8, -27.5, 1.0, 0.4);
    this._placeModel('Bench', -24, -25.2, 1.0, 0);

    // Roaring Blacksmith Forge fire
    const forgeLight = new THREE.PointLight(0xff4500, 3.6, 18, 1.2);
    forgeLight.position.set(-24, forgeY + 1.2, -28);
    this.scene.add(forgeLight);
    this.campfires.push({ light: forgeLight, mesh: { scale: { set: () => {} } }, baseX: -24, baseZ: -28, baseY: forgeY + 1.2 });

    // 4. Market Square (Kylän Tori) & Trading Manor at (x: -36, z: 16) – Kauppias Matti
    const merchManor = this._placeModel('TallBuilding02', -36, 16, 1.0, 0);
    if (merchManor) {
      this.addBoxCollider(-36 - 1.4, -36 + 1.4, 16 - 1.7, 16 + 1.7, 'TallBuilding02_TradingPost');
    }
    this._placeModel('Stall_Empty', -35, 9, 1.1, 0.1);
    this._placeModel('Stall_Cart_Empty', -32, 16, 1.1, -0.4);
    this._placeModel('Prop_Wagon', -41, 14, 1.15, -0.6);
    this._placeModel('FarmCrate_Apple', -38, 9, 1.0, 0.2);
    this._placeModel('FarmCrate_Carrot', -34, 7.5, 1.0, 0.4);
    this._placeModel('Barrel_Apples', -33.5, 10.5, 1.0, 0);
    this._placeModel('Barrel', -43, 12, 1.0, 0.5);
    this._placeModel('Barrel', -31, 18, 1.0, 0);
    this._placeModel('Prop_Crate', -39, 17, 1.0, 0.3);
    this._placeModel('Prop_Crate', -42, 16, 0.9, -0.2);
    this._placeModel('Bench', -30, 12, 1.0, Math.PI / 2);

    // 4b. Western Gate Watchtower at (x: -20, z: 10) – Sotilas Pekka
    const westGateTower = this._placeModel('TallBuilding01', -20, 10, 1.0, 0);
    if (westGateTower) {
      this.addBoxCollider(-20 - 1.2, -20 + 1.2, 10 - 1.7, 10 + 1.7, 'TallBuilding01_WestGate');
    }

    // 5. Central Plaza & Roaring Campfire at (x: 8, z: 4)
    const campX = 8;
    const campZ = 4;
    const campY = this.getGroundHeight(campX, campZ);
    this._placeModel('Cauldron', campX, campZ, 1.2, 0);

    // Artisan Crafting Workbench beside town square (accessible immediately for crafting advanced gear)
    this._placeModel('Workbench', 5.5, 1.5, 1.1, -0.4);
    this._placeModel('Workbench_Drawers', 7.0, 1.8, 1.0, -0.4);
    this._placeModel('Anvil_Log', 4.5, 2.5, 1.05, 0.2);
    this._placeModel('WeaponStand', 3.8, 1.2, 1.0, 0.5);

    // Register all initial world workbenches
    this.workbenches.push(
      { x: 5.5, z: 1.5, name: 'Kylän Keskustyöpöytä' },
      { x: -24, z: -30, name: 'Sepän Pajan Työpöytä' },
      { x: -22, z: 27, name: 'Satamakylän Työpöytä' }
    );

    const fireLight = new THREE.PointLight(0xff7722, 3.5, 28, 1.4);
    fireLight.position.set(campX, campY + 0.9, campZ);
    fireLight.castShadow = true;
    this.scene.add(fireLight);

    const emberGeo = new THREE.SphereGeometry(0.38, 8, 6);
    const emberMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
    const ember = new THREE.Mesh(emberGeo, emberMat);
    ember.position.set(campX, campY + 0.5, campZ);
    this.scene.add(ember);
    this.campfires.push({ light: fireLight, mesh: ember, baseX: campX, baseZ: campZ, baseY: campY });

    this._placeModel('Bench', campX - 2.8, campZ, 1.0, Math.PI / 2);
    this._placeModel('Bench', campX + 2.8, campZ, 1.0, -Math.PI / 2);
    this._placeModel('Bench', campX, campZ + 2.8, 1.0, Math.PI);

    // 6. Pathway Lantern Posts
    const lanternSpots = [
      { x: -14, z: 12 },
      { x: 16, z: 12 },
      { x: -26, z: -25 },
      { x: 2, z: 22 },
      { x: -34, z: 13 },
      { x: -10, z: -8 }
    ];

    for (const spot of lanternSpots) {
      this._placeModel('CandleStick_Stand', spot.x, spot.z, 1.0, 0);
      const ly = this.getGroundHeight(spot.x, spot.z) + 1.2;
      // Glowing emissive candle flame (zero WebGL dynamic light overhead)
      const flameGeo = new THREE.SphereGeometry(0.08, 6, 6);
      const flameMat = new THREE.MeshBasicMaterial({ color: 0xffbb44 });
      const flameMesh = new THREE.Mesh(flameGeo, flameMat);
      flameMesh.position.set(spot.x, ly, spot.z);
      this.scene.add(flameMesh);
    }

    // 7. Perimeter fences along roads
    const fencePositions = [
      { x: -16, z: 8, rot: 0.3 },
      { x: -12, z: 12, rot: 0.5 },
      { x: 18, z: 14, rot: -0.4 },
      { x: 22, z: 8, rot: -0.6 },
      { x: 20, z: -6, rot: 1.2 },
      { x: -18, z: -8, rot: -1.2 },
      { x: -28, z: 6, rot: 0.8 },
      { x: -29, z: 18, rot: -0.5 }
    ];
    for (const f of fencePositions) {
      this._placeModel('Prop_WoodenFence_Single', f.x, f.z, 1.1, f.rot);
      this.addCircleCollider(f.x, f.z, 0.75, 'road_fence');
    }
  }

  // --- River Bridge spanning Keskuskylä and Satamakylä across z = 28 ---
  buildRiverBridge() {
    const bz = 28;
    const by = 1.35; // Positioned cleanly above river water (y: 1.0)

    for (let bx = -18.5; bx <= 2.5; bx += 1.8) {
      const plank = this._placeModel('Floor_WoodDark', bx, bz, 1.15, 0);
      if (plank) {
        let plankY = by;
        if (bx < -16.0) {
          const t = (-16.0 - bx) / 2.5;
          plankY = by * (1 - t) + 2.4 * t;
        } else if (bx > 0.5) {
          const t = (bx - 0.5) / 2.0;
          plankY = by * (1 - t) + 2.5 * t;
        }
        plank.position.y = plankY;
      }
    }

    // Bridge guardrails & colliders (prevents walking through railings or falling off sides)
    for (let rx = -18.0; rx <= 2.0; rx += 2.4) {
      const rail1 = this._placeModel('Prop_WoodenFence_Single', rx, bz + 1.4, 1.1, Math.PI / 2);
      const rail2 = this._placeModel('Prop_WoodenFence_Single', rx, bz - 1.4, 1.1, Math.PI / 2);
      let railY = by;
      if (rx < -16.0) {
        const t = (-16.0 - rx) / 2.5;
        railY = by * (1 - t) + 2.4 * t;
      } else if (rx > 0.5) {
        const t = (rx - 0.5) / 2.0;
        railY = by * (1 - t) + 2.5 * t;
      }
      if (rail1) rail1.position.y = railY;
      if (rail2) rail2.position.y = railY;
    }

    // Solid box colliders along bridge north and south guardrails
    this.addBoxCollider(-19.5, 3.2, bz + 1.15, bz + 2.2, 'bridge_rail_north');
    this.addBoxCollider(-19.5, 3.2, bz - 2.2, bz - 1.15, 'bridge_rail_south');

    this._placeModel('CandleStick_Stand', -19, bz + 1.8, 1.0, 0);
    this._placeModel('CandleStick_Stand', 3, bz - 1.8, 1.0, 0);
  }

  // --- Satamakylä (Fishermen's Village) on western riverbank ---
  buildFishingTown() {
    // 1. Fishermen's Cabin (Kalastajamökki) at (x: -26, z: 32) – Kalastaja Toivo
    const fishHouse = this._placeModel('TinyBuilding01', -26, 32, 1.0, 0);
    if (fishHouse) {
      this.addBoxCollider(-26 - 1.0, -26 + 1.0, 32 - 1.4, 32 + 1.4, 'TinyBuilding01_Fisher');
    }

    // 2. Grand Fishing Jetty & Boardwalk Network
    const py = 1.25; // Elevated above river water level
    for (let zStep = 22; zStep <= 42; zStep += 2.8) {
      const plank = this._placeModel('Floor_WoodDark', -18, zStep, 1.15, Math.PI / 2);
      if (plank) plank.position.y = py;
    }

    // Finger pier jutting into deep river water for fishing
    for (let xStep = -17; xStep >= -11; xStep += 2.0) {
      const plank = this._placeModel('Floor_WoodDark', xStep, 32, 1.1, 0);
      if (plank) plank.position.y = py;
    }

    // Pier guardrails & colliders
    const pierRails = [
      { x: -19.4, z: 24, rot: 0 },
      { x: -19.4, z: 28, rot: 0 },
      { x: -19.4, z: 38, rot: 0 },
      { x: -19.4, z: 42, rot: 0 },
      { x: -16.6, z: 24, rot: 0 },
      { x: -16.6, z: 42, rot: 0 },
      { x: -14, z: 33.4, rot: Math.PI / 2 },
      { x: -14, z: 30.6, rot: Math.PI / 2 }
    ];
    for (const pr of pierRails) {
      const r = this._placeModel('Prop_WoodenFence_Single', pr.x, pr.z, 1.0, pr.rot);
      if (r) r.position.y = py;
      this.addCircleCollider(pr.x, pr.z, 0.75, 'pier_rail');
    }

    // Pier Props
    const pierProps = [
      { name: 'Barrel', x: -19.2, z: 26, s: 1.0, r: 0.4 },
      { name: 'Barrel_Apples', x: -16.8, z: 27, s: 1.0, r: 0 },
      { name: 'Barrel', x: -18.2, z: 34, s: 1.0, r: 0.8 },
      { name: 'Prop_Crate', x: -19.2, z: 36, s: 0.9, r: 0.2 },
      { name: 'Bench', x: -19.2, z: 30, s: 0.95, r: Math.PI / 2 },
      { name: 'Workbench', x: -22, z: 27, s: 1.0, r: 0 }
    ];
    for (const pp of pierProps) {
      const p = this._placeModel(pp.name, pp.x, pp.z, pp.s, pp.r);
      if (p) p.position.y = py;
    }

    // Pier water-illuminating lanterns
    const pierLanterns = [
      { x: -16.8, z: 24 },
      { x: -11.0, z: 32 },
      { x: -16.8, z: 40 },
      { x: -24, z: 29 }
    ];
    for (const pl of pierLanterns) {
      this._placeModel('CandleStick_Stand', pl.x, pl.z, 1.0, 0);
      const ly = py + 1.25;
      // Glowing emissive candle flame
      const flameGeo = new THREE.SphereGeometry(0.08, 6, 6);
      const flameMat = new THREE.MeshBasicMaterial({ color: 0xffbb44 });
      const flameMesh = new THREE.Mesh(flameGeo, flameMat);
      flameMesh.position.set(pl.x, ly, pl.z);
      this.scene.add(flameMesh);
    }
  }

  // --- Highland Fortress (Metsävartion Linnake) on northern cliff ---
  buildHighlandFortress() {
    const tx = 30;
    const tz = -68;
    const ty = this.getGroundHeight(tx, tz);

    // Watchtower with stone foundation
    const towerGroup = new THREE.Group();
    towerGroup.position.set(tx, ty, tz);
    towerGroup.add(this._createFoundationBox(-2.2, 2.2, -2.2, 2.2, 2.8, 0x48423d));

    this._addPiece(towerGroup, 'Wall_UnevenBrick_Straight', -1, 0, -1, Math.PI / 2, 1.0);
    this._addPiece(towerGroup, 'Wall_UnevenBrick_Straight', 1, 0, -1, -Math.PI / 2, 1.0);
    this._addPiece(towerGroup, 'Wall_UnevenBrick_Straight', 0, 0, -1.8, Math.PI, 1.0);
    this._addPiece(towerGroup, 'Stairs_Exterior_Straight', 0, 0, 1.6, 0, 1.0);
    this._addPiece(towerGroup, 'Floor_WoodDark', 0, 3.0, 0, 0, 1.2);
    this._addPiece(towerGroup, 'Roof_Tower_RoundTiles', 0, 6.0, 0, 0, 1.2);

    const beaconLight = new THREE.PointLight(0xff9922, 3.8, 55, 1.3);
    beaconLight.position.set(0, 5.5, 0);
    towerGroup.add(beaconLight);
    this.scene.add(towerGroup);
    this.campfires.push({ light: beaconLight, mesh: { scale: { set: () => {} } }, baseX: tx, baseZ: tz, baseY: ty + 5.5 });

    // Garrison Barracks (Vartijoiden Kasarmi at 42, -58)
    const lodge = this.buildCottage4x4(42, -58, 0, 'Plaster', 'Floor_WoodDark');
    this._addPiece(lodge, 'Bed_Twin1', -1.2, 0, -1.0, 0, 0.95);
    this._addPiece(lodge, 'Bed_Twin1', 1.2, 0, -1.0, 0, 0.95);
    this._addPiece(lodge, 'WeaponStand', -1.2, 0, 1.0, Math.PI / 2, 1.1);
    this._addPiece(lodge, 'Chest_Wood', 1.2, 0, 1.0, 0, 1.0);

    // Scout Campfire & Tall Watchtower at (35, -57) – Vartiosotilas Lauri
    const highlandTower = this._placeModel('TallBuilding01', 35, -57, 1.0, 0);
    if (highlandTower) {
      this.addBoxCollider(35 - 1.2, 35 + 1.2, -57 - 1.7, -57 + 1.7, 'TallBuilding01_HighlandTower');
    }

    const scoutCampX = 35;
    const scoutCampZ = -52;
    const scoutCampY = this.getGroundHeight(scoutCampX, scoutCampZ);
    this._placeModel('Cauldron', scoutCampX, scoutCampZ, 1.0, 0);

    const sLight = new THREE.PointLight(0xff7722, 2.6, 20, 1.5);
    sLight.position.set(scoutCampX, scoutCampY + 0.8, scoutCampZ);
    this.scene.add(sLight);
    this.campfires.push({ light: sLight, mesh: { scale: { set: () => {} } }, baseX: scoutCampX, baseZ: scoutCampZ, baseY: scoutCampY + 0.8 });

    this._placeModel('Bench', scoutCampX - 2.2, scoutCampZ, 0.9, Math.PI / 2);
    this._placeModel('Bench', scoutCampX + 2.2, scoutCampZ, 0.9, -Math.PI / 2);

    const palisades = [
      { x: 25, z: -62, r: 0.4 },
      { x: 28, z: -56, r: 0.7 },
      { x: 33, z: -52, r: 1.1 },
      { x: 48, z: -54, r: -0.6 },
      { x: 51, z: -60, r: -1.2 },
      { x: 49, z: -66, r: -1.8 }
    ];
    for (const pal of palisades) {
      this._placeModel('Prop_WoodenFence_Single', pal.x, pal.z, 1.15, pal.r);
      this.addCircleCollider(pal.x, pal.z, 0.85, 'highland_palisade');
    }
  }

  // --- Ancient Sanctuary Altar at (x: 85, z: -25) ---
  buildAncientRuins() {
    const rx = 85;
    const rz = -25;
    const ry = this.getGroundHeight(rx, rz);

    this._placeModel('Wall_Arch', rx, rz - 5.5, 1.3, 0);
    this._placeModel('Wall_Arch', rx, rz + 5.5, 1.3, Math.PI);
    this._placeModel('Wall_Arch', rx - 5.5, rz, 1.3, Math.PI / 2);
    this._placeModel('Wall_Arch', rx + 5.5, rz, 1.3, -Math.PI / 2);

    this._placeModel('Rock_Medium_1', rx - 4.5, rz - 4.5, 1.8, 0.4);
    this._placeModel('Rock_Medium_2', rx + 4.5, rz - 4.0, 1.7, -0.6);
    this._placeModel('Rock_Medium_3', rx, rz + 6.2, 1.9, 1.2);
    this._placeModel('Rock_Medium_1', rx - 5.8, rz + 3.8, 1.6, 2.1);

    const altarLight = new THREE.PointLight(0x00d4ff, 2.8, 22, 1.4);
    altarLight.position.set(rx, ry + 1.2, rz);
    this.scene.add(altarLight);

    const crystalGeo = new THREE.OctahedronGeometry(0.5, 0);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x0088cc,
      emissiveIntensity: 0.9,
      roughness: 0.1,
      metalness: 0.9
    });
    const crystal = new THREE.Mesh(crystalGeo, crystalMat);
    crystal.position.set(rx, ry + 1.1, rz);
    this.scene.add(crystal);

    this.altarLight = { light: altarLight, mesh: crystal, baseY: ry + 1.1 };
  }

  // --- Expansive Biome Forests (1300+ trees across world) ---
  generateForests() {
    const pineModels = ['Pine_1', 'Pine_2', 'Pine_3', 'Pine_4', 'Pine_5'];
    const broadleafModels = ['CommonTree_1', 'CommonTree_2', 'CommonTree_3', 'CommonTree_4', 'CommonTree_5'];
    const cursedModels = ['DeadTree_1', 'DeadTree_2', 'DeadTree_3', 'TwistedTree_1', 'TwistedTree_2'];

    // Helper to spawn a single tree node
    const spawnTree = (name, x, z, scale, typeName) => {
      const riverX = -16 + Math.sin(z * 0.015) * 20;
      if (Math.abs(x - riverX) < 18) return;
      const y = this.getGroundHeight(x, z);
      if (y < 1.1) return;
      if (Math.hypot(x, z) < 18) return; // Keep spawn center clear

      const rot = Math.random() * Math.PI * 2;
      const treeMesh = this._placeModel(name, x, z, scale, rot);
      if (treeMesh) {
        const treeNode = {
          mesh: treeMesh,
          position: new THREE.Vector3(x, y, z),
          type: 'tree',
          health: 100,
          maxHealth: 100,
          harvested: false,
          name: typeName
        };
        treeMesh.userData.resourceNode = treeNode;
        treeMesh.traverse((child) => {
          child.userData.resourceNode = treeNode;
        });
        this.trees.push(treeNode);
        this.addCircleCollider(x, z, 0.45, 'tree', treeNode);
      }
    };

    // 1. Dedicated Black Forest Grove: 110 dense ancient pines on desktop, 45 on mobile
    const bfCount = isMobileDevice ? 45 : 110;
    for (let i = 0; i < bfCount; i++) {
      const x = -165 + Math.random() * 80;
      const z = -165 + Math.random() * 80;
      const model = pineModels[Math.floor(Math.random() * pineModels.length)];
      const scale = 2.8 + Math.random() * 1.6;
      spawnTree(model, x, z, scale, 'Aarniometsän Valtava Mänty');
    }

    // 2. Dedicated Swamp Bog: 85 eerie twisted trees on desktop, 35 on mobile
    const swampCount = isMobileDevice ? 35 : 85;
    for (let i = 0; i < swampCount; i++) {
      const x = -195 + Math.random() * 100;
      const z = 90 + Math.random() * 105;
      const model = cursedModels[Math.floor(Math.random() * cursedModels.length)];
      const scale = 1.6 + Math.random() * 0.9;
      spawnTree(model, x, z, scale, 'Suon Känsäinen Runkopuu');
    }

    // 3. Dedicated Mountain Alpine Pines: 75 alpine pines on desktop, 30 on mobile
    const mountainCount = isMobileDevice ? 30 : 75;
    for (let i = 0; i < mountainCount; i++) {
      const x = 95 + Math.random() * 100;
      const z = -195 + Math.random() * 110;
      const y = this.getGroundHeight(x, z);
      if (y > 22.0) continue; // Snow peaks above treeline
      const model = pineModels[Math.floor(Math.random() * pineModels.length)];
      const scale = 1.4 + Math.random() * 0.8;
      spawnTree(model, x, z, scale, 'Tunturin Alppimänty');
    }

    // 4. Dedicated Rune Plains: 50 broadleaf oaks on desktop, 25 on mobile
    const plainsCount = isMobileDevice ? 25 : 50;
    for (let i = 0; i < plainsCount; i++) {
      const x = 135 + Math.random() * 100;
      const z = -65 + Math.random() * 110;
      const model = broadleafModels[Math.floor(Math.random() * broadleafModels.length)];
      const scale = 2.4 + Math.random() * 1.0;
      spawnTree(model, x, z, scale, 'Riimutasangon Muinaistammi');
    }

    // 5. Dedicated Ashlands: 65 charred dead trees on desktop, 25 on mobile
    const ashCount = isMobileDevice ? 25 : 65;
    for (let i = 0; i < ashCount; i++) {
      const x = -60 + Math.random() * 120;
      const z = 190 + Math.random() * 110;
      const model = cursedModels[Math.floor(Math.random() * cursedModels.length)];
      const scale = 1.8 + Math.random() * 0.8;
      spawnTree(model, x, z, scale, 'Sysivuoren Hiiltynyt Runko');
    }

    // 6. Remaining trees distributed across the expansive wilderness (240 on mobile, 950 on desktop)
    const totalTrees = isMobileDevice ? 240 : 950;
    for (let i = 0; i < totalTrees; i++) {
      let x, z, dist;
      do {
        x = (Math.random() - 0.5) * 1100;
        z = (Math.random() - 0.5) * 1100;
        dist = Math.sqrt(x * x + z * z);
      } while (dist < 20);

      // Clean riverbed: keep trees strictly on dry land
      const riverX = -16 + Math.sin(z * 0.015) * 20;
      const distToRiver = Math.abs(x - riverX);
      if (distToRiver < 22) continue;

      const y = this.getGroundHeight(x, z);
      if (y < 1.2) continue;

      // Keep towns, plazas, and roads clear
      if (x > -50 && x < 26 && z > -45 && z < 22) continue;
      if (Math.hypot(x - (-24), z - 32) < 26) continue;
      if (Math.hypot(x - 36, z - (-60)) < 30) continue;
      if (Math.hypot(x - 85, z - (-25)) < 24) continue;

      const biome = getBiomeKey(x, z);
      let chosenName = '';
      let baseScale = 1.0;

      if (biome === 'ashlands' || biome === 'swamp') {
        chosenName = cursedModels[Math.floor(Math.random() * cursedModels.length)];
        baseScale = 1.6 + Math.random() * 0.8;
      } else if (biome === 'blackForest') {
        chosenName = pineModels[Math.floor(Math.random() * pineModels.length)];
        baseScale = 2.6 + Math.random() * 1.6;
      } else if (biome === 'mountain') {
        if (y > 22.0) continue;
        chosenName = pineModels[Math.floor(Math.random() * pineModels.length)];
        baseScale = 1.4 + Math.random() * 0.7;
      } else if (biome === 'runePlains') {
        if (Math.random() < 0.65) continue;
        chosenName = broadleafModels[Math.floor(Math.random() * broadleafModels.length)];
        baseScale = 2.0 + Math.random() * 0.8;
      } else {
        chosenName = (Math.random() < 0.55)
          ? broadleafModels[Math.floor(Math.random() * broadleafModels.length)]
          : pineModels[Math.floor(Math.random() * pineModels.length)];
        baseScale = 2.2 + Math.random() * 1.1;
      }

      spawnTree(chosenName, x, z, baseScale, chosenName.includes('Pine') ? 'Valtava Mänty' : 'Metsäpuu');
    }
  }

  // --- Authentic Finnish Birch Forests (Pohjolan Koivikot) ---
  generateBirchForests() {
    const birchModels = ['BirchTree_1', 'BirchTree_2', 'BirchTree_3'];
    const totalBirches = isMobileDevice ? 75 : 260;

    for (let i = 0; i < totalBirches; i++) {
      let x, z;
      if (Math.random() < 0.65) {
        z = (Math.random() - 0.5) * 500;
        const riverX = -16 + Math.sin(z * 0.015) * 20;
        const side = Math.random() < 0.5 ? -1 : 1;
        x = riverX + side * (16 + Math.random() * 28);
      } else {
        x = (Math.random() - 0.5) * 650;
        z = (Math.random() - 0.5) * 650;
      }

      const dist = Math.hypot(x, z);
      if (dist < 18) continue;

      const biome = getBiomeKey(x, z);
      if (biome !== 'meadows') continue;

      const riverX = -16 + Math.sin(z * 0.015) * 20;
      if (Math.abs(x - riverX) < 16) continue;

      const y = this.getGroundHeight(x, z);
      if (y < 1.1) continue;

      if (x > -45 && x < 24 && z > -42 && z < 20) continue;

      const modelName = birchModels[Math.floor(Math.random() * birchModels.length)];
      const scale = 1.6 + Math.random() * 0.9;
      const rot = Math.random() * Math.PI * 2;

      const treeMesh = this._placeModel(modelName, x, z, scale, rot);
      if (treeMesh) {
        const treeNode = {
          mesh: treeMesh,
          position: new THREE.Vector3(x, y, z),
          type: 'tree',
          health: 100,
          maxHealth: 100,
          harvested: false,
          name: 'Pohjolan Koivu'
        };

        treeMesh.userData.resourceNode = treeNode;
        treeMesh.traverse((child) => {
          child.userData.resourceNode = treeNode;
        });

        this.trees.push(treeNode);
        this.addCircleCollider(x, z, 0.45, 'tree', treeNode);
      }
    }
  }

  // --- Floating Lilypads (Lumpeenlehdet) in River - Disabled to keep riverbed crystal clear ---
  generateLilypads() {}

  // --- Village Farm Plot with Harvestable Wheat (Pellon Viljat) ---
  generateWheatFields() {
    const startX = 20;
    const startZ = 8;
    const width = 10;
    const depth = 12;

    for (let fx = startX; fx <= startX + width; fx += 2.8) {
      this._placeModel('Prop_WoodenFence_Single', fx, startZ - 0.5, 1.0, 0);
      this._placeModel('Prop_WoodenFence_Single', fx, startZ + depth + 0.5, 1.0, Math.PI);
    }
    for (let fz = startZ; fz <= startZ + depth; fz += 2.8) {
      this._placeModel('Prop_WoodenFence_Single', startX - 0.5, fz, 1.0, Math.PI / 2);
      this._placeModel('Prop_WoodenFence_Single', startX + width + 0.5, fz, 1.0, -Math.PI / 2);
    }

    // Solid box colliders for farm perimeter (leaving entrance opening at startX + 4 to startX + 6)
    this.addBoxCollider(startX - 0.5, startX + 3.8, startZ - 0.8, startZ - 0.2, 'farm_fence_n1');
    this.addBoxCollider(startX + 6.2, startX + width + 0.5, startZ - 0.8, startZ - 0.2, 'farm_fence_n2');
    this.addBoxCollider(startX - 0.5, startX + width + 0.5, startZ + depth + 0.2, startZ + depth + 0.8, 'farm_fence_s');
    this.addBoxCollider(startX - 0.8, startX - 0.2, startZ - 0.5, startZ + depth + 0.5, 'farm_fence_w');
    this.addBoxCollider(startX + width + 0.2, startX + width + 0.8, startZ - 0.5, startZ + depth + 0.5, 'farm_fence_e');

    for (let wx = startX + 1.2; wx < startX + width; wx += 1.3) {
      for (let wz = startZ + 1.2; wz < startZ + depth; wz += 1.3) {
        const jitterX = wx + (Math.random() - 0.5) * 0.35;
        const jitterZ = wz + (Math.random() - 0.5) * 0.35;
        const wy = this.getGroundHeight(jitterX, jitterZ);
        const scale = 1.0 + Math.random() * 0.3;
        const rot = Math.random() * Math.PI * 2;

        const wheatMesh = this._placeModel('Wheat', jitterX, jitterZ, scale, rot);
        if (wheatMesh) {
          const wheatNode = {
            mesh: wheatMesh,
            position: new THREE.Vector3(jitterX, wy, jitterZ),
            type: 'wheat',
            health: 50,
            maxHealth: 50,
            harvested: false,
            name: 'Pellon vilja'
          };
          wheatMesh.userData.resourceNode = wheatNode;
          wheatMesh.traverse((child) => {
            child.userData.resourceNode = wheatNode;
          });
          this.wheatNodes.push(wheatNode);
        }
      }
    }
  }

  // --- Forest Floor Mossy Fallen Logs & Tree Stumps ---
  generateMossyWood() {
    const totalLogs = isMobileDevice ? 12 : 35;
    for (let i = 0; i < totalLogs; i++) {
      const x = (Math.random() - 0.5) * 750;
      const z = (Math.random() - 0.5) * 750;
      if (Math.hypot(x, z) < 22) continue;

      const riverX = -16 + Math.sin(z * 0.015) * 20;
      if (Math.abs(x - riverX) < 18) continue;

      const y = this.getGroundHeight(x, z);
      if (y < 1.1) continue;

      const scale = 0.9 + Math.random() * 0.45;
      const rot = Math.random() * Math.PI * 2;

      const logMesh = this._placeModel('WoodLog_Moss', x, z, scale, rot);
      if (logMesh) {
        const logNode = {
          mesh: logMesh,
          position: new THREE.Vector3(x, y, z),
          type: 'mossyWood',
          health: 80,
          maxHealth: 80,
          harvested: false,
          name: 'Sammaloitunut tukki'
        };
        logMesh.userData.resourceNode = logNode;
        logMesh.traverse((child) => {
          child.userData.resourceNode = logNode;
        });
        this.mossyWoodNodes.push(logNode);
      }
    }

    const totalStumps = 25;
    for (let i = 0; i < totalStumps; i++) {
      const x = (Math.random() - 0.5) * 750;
      const z = (Math.random() - 0.5) * 750;
      if (Math.hypot(x, z) < 22) continue;

      const riverX = -16 + Math.sin(z * 0.015) * 20;
      if (Math.abs(x - riverX) < 18) continue;

      const y = this.getGroundHeight(x, z);
      if (y < 1.1) continue;

      const scale = 1.0 + Math.random() * 0.4;
      const rot = Math.random() * Math.PI * 2;

      const stumpMesh = this._placeModel('TreeStump_Moss', x, z, scale, rot);
      if (stumpMesh) {
        const stumpNode = {
          mesh: stumpMesh,
          position: new THREE.Vector3(x, y, z),
          type: 'mossyWood',
          health: 80,
          maxHealth: 80,
          harvested: false,
          name: 'Sammalkanto'
        };
        stumpMesh.userData.resourceNode = stumpNode;
        stumpMesh.traverse((child) => {
          child.userData.resourceNode = stumpNode;
        });
        this.mossyWoodNodes.push(stumpNode);
      }
    }

    // Starter fallen wood branches right around the meadow (6m-48m from spawn)
    for (let i = 0; i < 50; i++) {
      const angle = (i / 50) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const dist = 6 + Math.random() * 40;
      const lx = Math.cos(angle) * dist;
      const lz = Math.sin(angle) * dist;
      if (this.isNearRiver(lx, lz, 22)) continue;
      const ly = this.getGroundHeight(lx, lz);
      if (ly < 1.4) continue;

      const logMesh = this._placeModel('WoodLog_Moss', lx, lz, 0.7 + Math.random() * 0.35, Math.random() * Math.PI * 2);
      if (logMesh) {
        const logNode = {
          mesh: logMesh,
          position: new THREE.Vector3(lx, ly, lz),
          type: 'mossyWood',
          health: 40,
          maxHealth: 40,
          harvested: false,
          name: 'Maapuuta & Oksia (Poimi käsin)'
        };
        logMesh.userData.resourceNode = logNode;
        logMesh.traverse((child) => { child.userData.resourceNode = logNode; });
        this.mossyWoodNodes.push(logNode);
      }
    }
  }

  generateRocks() {
    const rockModels = ['Rock_Medium_1', 'Rock_Medium_2', 'Rock_Medium_3', 'Pebble_Round_1', 'Rock_Moss_1', 'Rock_Moss_2'];
    const count = isMobileDevice ? 25 : 75;

    for (let i = 0; i < count; i++) {
      let x, z, dist;
      do {
        x = (Math.random() - 0.5) * 850;
        z = (Math.random() - 0.5) * 850;
        dist = Math.sqrt(x * x + z * z);
      } while (dist < 20);

      const riverX = -16 + Math.sin(z * 0.015) * 20;
      const distToRiver = Math.abs(x - riverX);
      if (distToRiver < 22) continue;

      const y = this.getGroundHeight(x, z);
      if (y < 1.4) continue;

      if (x > -48 && x < 24 && z > -42 && z < 20) continue;
      if (Math.hypot(x - (-24), z - 32) < 22) continue;
      if (Math.hypot(x - 36, z - (-60)) < 22) continue;

      const chosenName = rockModels[Math.floor(Math.random() * rockModels.length)];
      const isLoose = chosenName === 'Pebble_Round_1';
      const scale = isLoose ? (1.4 + Math.random() * 0.4) : (0.9 + Math.random() * 0.85);
      const rot = Math.random() * Math.PI * 2;

      const rockMesh = this._placeModel(chosenName, x, z, scale, rot);
      if (rockMesh) {
        const stoneNode = {
          mesh: rockMesh,
          position: new THREE.Vector3(x, y, z),
          type: 'stone',
          isLooseStone: isLoose,
          health: isLoose ? 20 : 100,
          maxHealth: isLoose ? 20 : 100,
          harvested: false,
          name: isLoose ? 'Irtokivi (Poimi käsin)' : (chosenName.includes('Moss') ? 'Sammaloitunut kivi' : 'Kivijärkäle')
        };

        rockMesh.userData.resourceNode = stoneNode;
        rockMesh.traverse((child) => {
          child.userData.resourceNode = stoneNode;
        });

        this.stones.push(stoneNode);
        if (!isLoose) {
          this.addCircleCollider(x, z, 0.85, 'rock', stoneNode);
        }
      }
    }

    // Spawn guaranteed starter loose pebbles near the starting meadow (within 6m-48m of spawn)
    const starterPebbles = isMobileDevice ? 20 : 60;
    for (let i = 0; i < starterPebbles; i++) {
      const angle = (i / 60) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const dist = 6 + Math.random() * 40;
      const sx = Math.cos(angle) * dist;
      const sz = Math.sin(angle) * dist;
      if (this.isNearRiver(sx, sz, 22)) continue;
      const sy = this.getGroundHeight(sx, sz);

      if (sy < 1.4) continue;

      const pMesh = this._placeModel('Pebble_Round_1', sx, sz, 1.4 + Math.random() * 0.4, Math.random() * Math.PI * 2);
      if (pMesh) {
        const pebbleNode = {
          mesh: pMesh,
          position: new THREE.Vector3(sx, sy, sz),
          type: 'stone',
          isLooseStone: true,
          health: 20,
          maxHealth: 20,
          harvested: false,
          name: 'Irtokivi (Poimi käsin)'
        };
        pMesh.userData.resourceNode = pebbleNode;
        pMesh.traverse((child) => { child.userData.resourceNode = pebbleNode; });
        this.stones.push(pebbleNode);
      }
    }
  }

  generateOreVeins() {
    const rockModels = ['Rock_Medium_1', 'Rock_Medium_2', 'Rock_Medium_3'];

    const oreClusters = [
      // 1. Black Forest (Kuparimalmi & Tinamalmi)
      { name: 'Kuparimalmi (Copper Ore)', item: 'copperOre', minTool: 'antlerPickaxe', requiredMsg: 'Vaatii Sarvihakun! (Voita Sarvipeto Aarniometsässä)', color: 0xd35400, xMin: -160, xMax: -85, zMin: -160, zMax: -85, count: 7 },
      { name: 'Tinamalmi (Tin Ore)', item: 'tinOre', minTool: 'antlerPickaxe', requiredMsg: 'Vaatii Sarvihakun! (Voita Sarvipeto Aarniometsässä)', color: 0xbdc3c7, xMin: -150, xMax: -80, zMin: -150, zMax: -80, count: 6 },

      // 2. Swamp (Rautamalmi)
      { name: 'Rautamalmi (Iron Ore)', item: 'ironOre', minTool: 'swampKey', requiredMsg: 'Vaatii Suoavaimen ja Hakun! (Voita Vesipeto Näkki)', color: 0x5a4d41, xMin: -190, xMax: -105, zMin: 95, zMax: 185, count: 9 },

      // 3. Mountain (Hopeamalmi)
      { name: 'Hopeamalmi (Silver Ore)', item: 'silverOre', minTool: 'wishbone', requiredMsg: 'Vaatii Maan Sydämen ja Rautahakun! (Voita Kallionmurskaaja)', color: 0x74b9ff, xMin: 110, xMax: 195, zMin: -195, zMax: -110, count: 9 },

      // 4. Rune Plains (Mustametallisuoni)
      { name: 'Mustametallisuoni (Black Metal)', item: 'blackMetalScrap', minTool: 'artisanCore', requiredMsg: 'Vaatii Riimumestarin Kiven! (Voita Riimunvartija)', color: 0x575fcf, xMin: 140, xMax: 235, zMin: -65, zMax: 45, count: 8 },

      // 5. Sysivuori (Tulimalmi)
      { name: 'Tulimalmi (Flametal Ore)', item: 'flametalOre', minTool: 'dragonTears', requiredMsg: 'Vaatii Lohikäärmeen Kyyneleen! (Voita Varjodraakki)', color: 0xff3838, xMin: -55, xMax: 55, zMin: 210, zMax: 300, count: 8 }
    ];

    for (const cluster of oreClusters) {
      const oreCount = isMobileDevice ? Math.max(2, Math.ceil(cluster.count * 0.45)) : cluster.count;
      for (let i = 0; i < oreCount; i++) {
        const x = cluster.xMin + Math.random() * (cluster.xMax - cluster.xMin);
        const z = cluster.zMin + Math.random() * (cluster.zMax - cluster.zMin);
        const y = this.getGroundHeight(x, z);
        if (y < 0.5) continue;

        const chosenModel = rockModels[Math.floor(Math.random() * rockModels.length)];
        const scale = 1.1 + Math.random() * 0.5;
        const rot = Math.random() * Math.PI * 2;

        const oreMesh = this._placeModel(chosenModel, x, z, scale, rot);
        if (oreMesh) {
          // Tint ore veins with metallic/emissive luster
          oreMesh.traverse((c) => {
            if (c.isMesh && c.material) {
              c.material = c.material.clone();
              c.material.color.setHex(cluster.color);
              if (c.material.isMeshStandardMaterial || c.material.isMeshPhysicalMaterial) {
                c.material.metalness = 0.65;
                c.material.roughness = 0.55;
              }
            }
          });

          const oreNode = {
            mesh: oreMesh,
            position: new THREE.Vector3(x, y, z),
            type: 'ore',
            oreItem: cluster.item,
            name: cluster.name,
            minTool: cluster.minTool,
            requiredMsg: cluster.requiredMsg,
            health: 100,
            maxHealth: 100,
            harvested: false
          };

          oreMesh.userData.resourceNode = oreNode;
          oreMesh.traverse((child) => {
            child.userData.resourceNode = oreNode;
          });

          this.ores.push(oreNode);
          this.addCircleCollider(x, z, 0.95, 'ore', oreNode);
        }
      }
    }
  }

  generateBerryBushes() {
    const bushModels = ['Bush_Common_Flowers', 'Bush_Common', 'BushBerries_1'];
    const count = isMobileDevice ? 22 : 70;

    for (let i = 0; i < count; i++) {
      let x, z;
      if (i < 25) {
        // 25 starter berry bushes around meadow & village fringes (9m-38m)
        const angle = (i / 25) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        const dist = 9 + Math.random() * 29;
        x = Math.cos(angle) * dist;
        z = Math.sin(angle) * dist;
      } else {
        do {
          x = (Math.random() - 0.5) * 800;
          z = (Math.random() - 0.5) * 800;
        } while (Math.hypot(x, z) < 18);
      }

      const riverX = -16 + Math.sin(z * 0.015) * 20;
      const distToRiver = Math.abs(x - riverX);
      if (distToRiver < 22) continue;

      const y = this.getGroundHeight(x, z);
      if (y < 1.4) continue;

      if (x > -45 && x < 22 && z > -40 && z < 18) continue;
      if (Math.hypot(x - (-24), z - 32) < 20) continue;
      if (Math.hypot(x - 36, z - (-60)) < 20) continue;

      const chosenName = bushModels[Math.floor(Math.random() * bushModels.length)];
      const scale = 0.9 + Math.random() * 0.45;
      const rot = Math.random() * Math.PI * 2;

      const bushMesh = this._placeModel(chosenName, x, z, scale, rot);
      if (bushMesh) {
        const bushNode = {
          mesh: bushMesh,
          position: new THREE.Vector3(x, y, z),
          type: 'bush',
          health: 100,
          maxHealth: 100,
          harvested: false,
          name: chosenName === 'BushBerries_1' ? 'Marjapensas' : 'Villipensas'
        };

        bushMesh.userData.resourceNode = bushNode;
        bushMesh.traverse((child) => {
          child.userData.resourceNode = bushNode;
        });

        this.bushes.push(bushNode);
      }
    }
  }

  generateMushrooms() {
    const mushroomModels = ['Mushroom_Common', 'Mushroom_Laetiporus'];
    const count = isMobileDevice ? 20 : 60;

    for (let i = 0; i < count; i++) {
      let x, z;
      if (i < 25) {
        // 25 starter mushrooms in starting meadows and wood groves (8m-42m)
        const angle = (i / 25) * Math.PI * 2 + (Math.random() - 0.5) * 0.45;
        const dist = 8 + Math.random() * 34;
        x = Math.cos(angle) * dist;
        z = Math.sin(angle) * dist;
      } else {
        x = (Math.random() - 0.5) * 750;
        z = (Math.random() - 0.5) * 750;
        if (Math.hypot(x, z) < 18) continue;
      }

      const riverX = -16 + Math.sin(z * 0.015) * 20;
      const distToRiver = Math.abs(x - riverX);
      if (distToRiver < 22) continue;

      const y = this.getGroundHeight(x, z);
      if (y < 1.4) continue;

      // Keep buildings clear
      if (x > -45 && x < 20 && z > -38 && z < 16) continue;

      const chosenName = mushroomModels[Math.floor(Math.random() * mushroomModels.length)];
      const isChantarelle = chosenName === 'Mushroom_Common';
      const scale = 1.3 + Math.random() * 0.5;
      const rot = Math.random() * Math.PI * 2;

      const mMesh = this._placeModel(chosenName, x, z, scale, rot);
      if (mMesh) {
        const mushroomNode = {
          mesh: mMesh,
          position: new THREE.Vector3(x, y, z),
          type: 'mushroom',
          health: 20,
          maxHealth: 20,
          harvested: false,
          name: isChantarelle ? 'Kantarelli (Poimi käsin)' : 'Keltakääpä (Poimi käsin)'
        };

        mMesh.userData.resourceNode = mushroomNode;
        mMesh.traverse((child) => {
          child.userData.resourceNode = mushroomNode;
        });

        this.mushrooms.push(mushroomNode);
      }
    }
  }

  generateDecorations() {
    // Rich, diverse biome-specific vegetation and environmental dressing
    const biomeDecos = {
      meadows: [
        'Flower_3_Group', 'Flower_4_Group', 'Clover_1', 'Fern_1',
        'Plant_1', 'Plant_7', 'Bush_Common_Flowers', 'Grass_Common_Tall'
      ],
      blackForest: [
        'WoodLog_Moss', 'TreeStump_Moss', 'Fern_1', 'Rock_Moss_1',
        'Mushroom_Common', 'Mushroom_Laetiporus', 'Rock_Moss_2'
      ],
      swamp: [
        'Lilypad', 'Plant_1', 'Plant_7', 'TreeStump_Moss',
        'Mushroom_Laetiporus', 'DeadTree_2'
      ],
      mountain: [
        'Pebble_Round_1', 'Rock_Medium_1', 'Rock_Medium_2', 'DeadTree_3'
      ],
      runePlains: [
        'Grass_Wispy_Tall', 'Grass_Common_Tall', 'Clover_1',
        'Flower_3_Group', 'Plant_1'
      ],
      ashlands: [
        'DeadTree_1', 'Rock_Medium_3'
      ]
    };

    const count = isMobileDevice ? 220 : 540;

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 850;
      const z = (Math.random() - 0.5) * 850;

      const riverX = -16 + Math.sin(z * 0.015) * 20;
      const distToRiver = Math.abs(x - riverX);

      const y = this.getGroundHeight(x, z);

      // Keep starter camp clear
      if (Math.hypot(x, z) < 16) continue;
      if (x > -45 && x < 22 && z > -40 && z < 18) continue;

      const biome = getBiomeKey(x, z) || 'meadows';
      const models = biomeDecos[biome] || biomeDecos.meadows;
      const chosenName = models[Math.floor(Math.random() * models.length)];

      // Water lilypads spawn near river
      if (chosenName === 'Lilypad') {
        if (distToRiver > 18 || y > 1.2) continue;
      } else {
        if (distToRiver < 18 || y < 1.4) continue;
      }

      let scale = 0.85 + Math.random() * 0.45;
      if (chosenName.includes('Mushroom')) scale *= 1.4;
      else if (chosenName.includes('WoodLog')) scale *= 1.1;
      else if (chosenName.includes('TreeStump')) scale *= 1.0;

      const rot = Math.random() * Math.PI * 2;
      const mesh = this._placeModel(chosenName, x, z, scale, rot);
      if (mesh) {
        this.decorations.push(mesh);
      }
    }
  }

  // --- Infinite / Seamless Open World: Dynamic Terrain Centering & Nature Streaming ---
  _updateInfiniteTerrain(playerPos) {
    if (!this.groundMesh) return;

    // 1. Shift ground and water mesh when player moves beyond 80m from current ground center
    const dx = playerPos.x - this._lastTerrainShiftX;
    const dz = playerPos.z - this._lastTerrainShiftZ;
    if (Math.hypot(dx, dz) > 80) {
      const shiftX = Math.round(playerPos.x / 40) * 40;
      const shiftZ = Math.round(playerPos.z / 40) * 40;
      this._lastTerrainShiftX = shiftX;
      this._lastTerrainShiftZ = shiftZ;

      this.groundMesh.position.set(shiftX, 0, shiftZ);
      if (this.waterMesh) {
        this.waterMesh.position.x = shiftX;
        this.waterMesh.position.z = shiftZ;
      }

      // Re-sample vertex elevations from procedural Scandinavian formula
      const pos = this.groundMesh.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const localX = pos.getX(i);
        const localZ = pos.getZ(i);
        const worldX = localX + shiftX;
        const worldZ = localZ + shiftZ;
        pos.setY(i, this.getGroundHeight(worldX, worldZ));
      }
      pos.needsUpdate = true;
      this.groundMesh.geometry.computeVertexNormals();
    }

    // 2. Procedural chunk nature generation as player explores new 80m x 80m grid regions
    const chunkX = Math.floor(playerPos.x / 80);
    const chunkZ = Math.floor(playerPos.z / 80);
    for (let ox = -1; ox <= 1; ox++) {
      for (let oz = -1; oz <= 1; oz++) {
        const key = `${chunkX + ox}_${chunkZ + oz}`;
        if (!this.generatedChunks.has(key)) {
          this.generatedChunks.add(key);
          this._generateChunkNature(chunkX + ox, chunkZ + oz);
        }
      }
    }
  }

  _generateChunkNature(cx, cz) {
    // Avoid re-populating starting village center (within 65m of origin)
    const centerX = cx * 80 + 40;
    const centerZ = cz * 80 + 40;
    if (Math.hypot(centerX, centerZ) < 65) return;

    const biome = getBiomeKey(centerX, centerZ) || 'meadows';

    // Model selection based on biome
    let treeModels = ['Pine_1', 'Pine_2', 'Pine_3', 'Birch_1', 'Birch_2'];
    if (biome === 'swamp') treeModels = ['Pine_Crooked_1', 'TreeStump_Moss', 'TreeStump'];
    else if (biome === 'ashlands') treeModels = ['TreeStump', 'Pine_Crooked_1'];
    else if (biome === 'mountain') treeModels = ['Pine_Snow_1', 'Pine_Snow_2', 'Pine_1'];

    // Keep every explored 80x80 chunk visually alive instead of only dressing
    // the starting area. Biomes get denser tree lines while mobile stays lighter.
    const treeCountByBiome = {
      meadows: isMobileDevice ? 6 : 14,
      blackForest: isMobileDevice ? 9 : 20,
      swamp: isMobileDevice ? 7 : 16,
      mountain: isMobileDevice ? 5 : 12,
      runePlains: isMobileDevice ? 4 : 10,
      ashlands: isMobileDevice ? 6 : 14
    };
    const treeCount = treeCountByBiome[biome] || (isMobileDevice ? 6 : 14);
    for (let i = 0; i < treeCount; i++) {
      const tx = cx * 80 + 10 + Math.random() * 60;
      const tz = cz * 80 + 10 + Math.random() * 60;
      if (this.isNearRiver(tx, tz, 16)) {
        i--;
        continue;
      }
      const model = treeModels[Math.floor(Math.random() * treeModels.length)];
      const scale = biome === 'blackForest' ? 1.5 + Math.random() * 0.8 : 1.0 + Math.random() * 0.55;
      this.spawnTree(tx, tz, model, scale, Math.random() * Math.PI * 2);
    }

    // Scatter useful resources as well as scenery in remote wilderness.
    const rockModels = biome === 'mountain'
      ? ['Rock_Medium_1', 'Rock_Medium_2', 'Rock_Moss_1']
      : ['Rock_1', 'Rock_Medium_1', 'Rock_Moss_1'];
    const rockCount = isMobileDevice ? 3 : 7;
    for (let i = 0; i < rockCount; i++) {
      const rx = cx * 80 + 10 + Math.random() * 60;
      const rz = cz * 80 + 10 + Math.random() * 60;
      if (this.isNearRiver(rx, rz, 16)) {
        i--;
        continue;
      }
      const model = rockModels[Math.floor(Math.random() * rockModels.length)];
      this.spawnStone(rx, rz, model, 0.8 + Math.random() * 0.5);
    }

    this._generateChunkDressing(cx, cz, biome);
  }

  _generateChunkDressing(cx, cz, biome) {
    const dressing = {
      meadows: ['Flower_3_Group', 'Flower_4_Group', 'Clover_1', 'Bush_Common_Flowers'],
      blackForest: ['WoodLog_Moss', 'TreeStump_Moss', 'Mushroom_Common', 'Rock_Moss_1', 'Fern_1'],
      swamp: ['Plant_1', 'Plant_7', 'Mushroom_Laetiporus', 'TreeStump_Moss', 'DeadTree_2'],
      mountain: ['Pebble_Round_1', 'Rock_Medium_1', 'Rock_Medium_2', 'DeadTree_3'],
      runePlains: ['Grass_Wispy_Tall', 'Clover_1', 'Flower_3_Group', 'Plant_1'],
      ashlands: ['DeadTree_1', 'Rock_Medium_3', 'TreeStump']
    };
    const models = dressing[biome] || dressing.meadows;
    const countByBiome = {
      meadows: isMobileDevice ? 10 : 24,
      blackForest: isMobileDevice ? 12 : 28,
      swamp: isMobileDevice ? 10 : 24,
      mountain: isMobileDevice ? 8 : 20,
      runePlains: isMobileDevice ? 8 : 18,
      ashlands: isMobileDevice ? 8 : 20
    };
    const count = countByBiome[biome] || (isMobileDevice ? 9 : 22);
    const originX = cx * 80;
    const originZ = cz * 80;

    for (let i = 0; i < count; i++) {
      const x = originX + 8 + Math.random() * 64;
      const z = originZ + 8 + Math.random() * 64;
      const y = this.getGroundHeight(x, z);
      if (this.isNearRiver(x, z, 17) || y < 1.0 || Math.hypot(x, z) < 68) {
        i--;
        continue;
      }

      const name = models[Math.floor(Math.random() * models.length)];
      const scale = name.includes('Mushroom') ? 1.25 + Math.random() * 0.55 : 0.75 + Math.random() * 0.5;
      const mesh = this._placeModel(name, x, z, scale, Math.random() * Math.PI * 2);
      if (mesh) {
        mesh.userData.chunkDecoration = true;
        this.decorations.push(mesh);
      }
    }

    const landmarkTrees = biome === 'swamp'
      ? ['HexTreeSingle', 'HexTreeSmall']
      : biome === 'mountain'
        ? ['HexTreeSmall', 'HexTreeSingle']
        : ['HexTreeLarge', 'HexTreeSmall', 'HexTreeSingle'];
    const treeCount = isMobileDevice ? 3 : 7;
    for (let i = 0; i < treeCount; i++) {
      const x = originX + 8 + Math.random() * 64;
      const z = originZ + 8 + Math.random() * 64;
      const y = this.getGroundHeight(x, z);
      if (this.isNearRiver(x, z, 17) || y < 1.0 || Math.hypot(x, z) < 68) {
        i--;
        continue;
      }
      const name = landmarkTrees[Math.floor(Math.random() * landmarkTrees.length)];
      const mesh = this._placeModel(name, x, z, 0.9 + Math.random() * 0.35, Math.random() * Math.PI * 2);
      if (mesh) {
        mesh.userData.assetTree = true;
        this.decorations.push(mesh);
      }
    }

    // Small landmarks make remote chunks feel inhabited without turning the world
    // into a continuous town. One landmark is enough for each suitable chunk.
    const landmarkChunks = new Set(['1_-1', '2_0', '-2_-1', '1_1']);
    const chunkKey = `${cx}_${cz}`;
    if ((biome === 'meadows' || biome === 'runePlains') && landmarkChunks.has(chunkKey)) {
      const landmarks = {
        '1_-1': { model: 'HexMarketGreen', x: cx * 80 + 42, z: cz * 80 + 38, scale: 1.15, name: 'Rajaseudun markkinapaikka' },
        '2_0': { model: 'HexTowerRed', x: cx * 80 + 40, z: cz * 80 + 40, scale: 1.15, name: 'Riimuvartion torni' },
        '-2_-1': { model: 'HexBarracksBlue', x: cx * 80 + 38, z: cz * 80 + 42, scale: 1.15, name: 'Metsävartion kasarmi' },
        '1_1': { model: 'HexWindmillYellow', x: cx * 80 + 44, z: cz * 80 + 36, scale: 1.15, name: 'Kultatasangon tuulimylly' }
      };
      const landmark = landmarks[chunkKey];
      const y = this.getGroundHeight(landmark.x, landmark.z);
      if (!this.isNearRiver(landmark.x, landmark.z, 18) && y > 1.0) {
        const mesh = this._placeModel(landmark.model, landmark.x, landmark.z, landmark.scale, Math.random() * Math.PI * 2);
        if (mesh) {
          mesh.userData.landmark = landmark.name;
          this.decorations.push(mesh);
          this.remoteBuildings.push({
            x: landmark.x,
            z: landmark.z,
            name: landmark.name,
            biome,
            model: landmark.model
          });
          this.addCircleCollider(landmark.x, landmark.z, 2.2, 'landmark');
        }
      }
    }

    // Procedural remote settlements: a small landmark every few wilderness
    // chunks keeps long expeditions from becoming empty while preserving open space.
    const settlementModels = biome === 'blackForest'
      ? [
          { model: 'HexLumbermillRed', name: 'Metsän saha' },
          { model: 'HexArcheryGreen', name: 'Metsän jousirata' },
          { model: 'HexHomeAGreen', name: 'Metsämaja' }
        ]
      : biome === 'swamp'
        ? [
            { model: 'HexLumbermillRed', name: 'Suon saha' },
            { model: 'HexHomeBRed', name: 'Suomökki' }
          ]
      : biome === 'mountain'
        ? [
            { model: 'HexTowerRed', name: 'Vuoriston vartiotorni' },
            { model: 'HexBlacksmithBlue', name: 'Vuoriston paja' },
            { model: 'HexHomeBRed', name: 'Vuoristomökki' }
          ]
        : biome === 'ashlands'
          ? [{ model: 'HexTowerRed', name: 'Tuhkamaan vartiotorni' }]
          : [
              { model: 'HexHomeAGreen', name: 'Niittytalo' },
              { model: 'HexHomeBRed', name: 'Rajaseudun talo' },
              { model: 'HexTavernYellow', name: 'Kultainen krouvi' },
              { model: 'HexBlacksmithBlue', name: 'Kylän sepän paja' },
              { model: 'HexChurchBlue', name: 'Kyläkirkko' }
            ];
    const chunkHash = Math.abs((cx * 92821) ^ (cz * 68917));
    if (chunkHash % 4 === 0 && !landmarkChunks.has(chunkKey)) {
      const x = originX + 40;
      const z = originZ + 40;
      const y = this.getGroundHeight(x, z);
      if (!this.isNearRiver(x, z, 20) && y > 1.0) {
        const settlement = settlementModels[chunkHash % settlementModels.length];
        const settlementScale = settlement.model.includes('HexHome') ? 1.35 : 1.18;
        const mesh = this._placeModel(settlement.model, x, z, settlementScale, (chunkHash % 4) * Math.PI / 2);
        if (mesh) {
          mesh.userData.landmark = settlement.name;
          this.decorations.push(mesh);
          this.remoteBuildings.push({
            x,
            z,
            name: settlement.name,
            biome,
            model: settlement.model
          });
          this.addCircleCollider(x, z, 2.0, 'landmark');
        }
      }
    }
  }

  update(delta, playerPos = null) {
    this.atmosphereTime += delta;
    for (const ribbon of this.aurora) {
      const phase = ribbon.userData.phase || 0;
      ribbon.position.x += Math.sin(this.atmosphereTime * 0.08 + phase) * delta * 0.7;
      ribbon.rotation.z += Math.sin(this.atmosphereTime * 0.12 + phase) * delta * 0.0015;
      ribbon.material.opacity = 0.035 + (Math.sin(this.atmosphereTime * 0.35 + phase) + 1) * 0.018;
    }
    this.windTime += delta;

    // Infinite / Seamless Open World dynamic centering & chunk generation
    if (playerPos) {
      this._updateInfiniteTerrain(playerPos);
    }

    // Track sun shadow frustum tightly on player position for crisp, soft PCF shadows
    if (playerPos && this.sun) {
      this.sun.position.set(playerPos.x + 85, playerPos.y + 120, playerPos.z + 65);
      this.sun.target.position.set(playerPos.x, playerPos.y, playerPos.z);
    }

    // Dynamic water ripples
    if (this.waterNormal) {
      this.waterNormal.offset.x = (this.windTime * 0.02) % 1;
      this.waterNormal.offset.y = (this.windTime * 0.015) % 1;
    }

    if (this.waterMesh) {
      this.waterMesh.position.y = -1.0 + Math.sin(this.windTime * 1.5) * 0.04;
    }

    this._fireflyUpdateTimer -= delta;
    if (this.fireflies && this._fireflyUpdateTimer <= 0) {
      this._fireflyUpdateTimer = 0.033;
      const pos = this.fireflies.geometry.attributes.position;
      const phase = this.fireflies.geometry.attributes.phase;
      for (let i = 0; i < pos.count; i++) {
        const ph = phase.getX(i);
        const curY = pos.getY(i);
        pos.setY(i, curY + Math.sin(this.windTime * 2.0 + ph) * 0.005);
        pos.setX(i, pos.getX(i) + Math.cos(this.windTime * 1.2 + ph) * 0.004);
      }
      pos.needsUpdate = true;
    }

    for (const cloud of this.clouds) {
      cloud.position.x += cloud.userData.driftSpeed * delta * 2.5;
      if (cloud.position.x > 450) {
        cloud.position.x = -450;
      }
    }

    for (const camp of this.campfires) {
      const flicker = Math.sin(this.windTime * 14 + camp.baseX) * 0.4 +
                      Math.cos(this.windTime * 23 + camp.baseZ) * 0.25;
      camp.light.intensity = 2.8 + flicker;
      const s = 1.0 + flicker * 0.12;
      if (camp.mesh && camp.mesh.scale && camp.mesh.scale.set) {
        camp.mesh.scale.set(s, s, s);
      }
    }

    if (this.altarLight) {
      this.altarLight.mesh.rotation.y += delta * 1.5;
      this.altarLight.mesh.position.y = this.altarLight.baseY + Math.sin(this.windTime * 2.5) * 0.12;
      this.altarLight.light.intensity = 2.5 + Math.sin(this.windTime * 4.0) * 0.8;
    }

    if (this.tombstones) {
      for (let i = 0; i < this.tombstones.length; i++) {
        const t = this.tombstones[i];
        if (t && t.runeMesh) {
          t.runeMesh.rotation.y += delta * 2.0;
          t.runeMesh.position.y = 1.55 + Math.sin(this.windTime * 3.0 + i) * 0.12;
        }
      }
    }
  }

  // --- Hidden Treasure Chests in the Wild ---
  generateWildChests() {
    const chestCoords = [
      // Meadows & Valley Groves
      { x: -35, z: 28 }, { x: 38, z: -18 }, { x: -48, z: -48 }, { x: 55, z: 24 },
      { x: -52, z: -22 }, { x: 26, z: 46 }, { x: -68, z: 12 }, { x: 42, z: -55 },
      // Black Forest (North-West)
      { x: -85, z: -85 }, { x: -110, z: -95 }, { x: -125, z: -70 }, { x: -95, z: -120 },
      { x: -135, z: -115 }, { x: -75, z: -105 },
      // Swamp (South-West)
      { x: -90, z: 85 }, { x: -115, z: 110 }, { x: -130, z: 95 }, { x: -105, z: 135 },
      // Mountain Peaks (North-East)
      { x: 95, z: -85 }, { x: 120, z: -110 }, { x: 135, z: -95 }, { x: 110, z: -130 },
      // Rune Plains (East)
      { x: 110, z: -20 }, { x: 135, z: 25 }, { x: 150, z: -35 }, { x: 160, z: 15 },
      // Ashlands (South)
      { x: -25, z: 185 }, { x: 30, z: 205 }, { x: 0, z: 220 }
    ];

    chestCoords.forEach(coord => {
      this.spawnWildChest(coord.x, coord.z);
    });
  }

  spawnWildChest(x, z) {
    if (this.isNearRiver(x, z, 22)) return null;
    const y = this.getGroundHeight(x, z);
    if (y < 1.4) return null; // Avoid submerged in river or on steep bank slopes

    const biome = getBiomeKey(x, z);
    const rot = Math.random() * Math.PI * 2;
    const mesh = this._placeModel('Chest_Wood', x, z, 1.15, rot);
    if (!mesh) return null;

    // Golden floating beacon marker (MeshBasicMaterial = ZERO WebGL dynamic light shader recompilation hitch)
    const glowGeo = new THREE.OctahedronGeometry(0.18, 0);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
    const glowMarker = new THREE.Mesh(glowGeo, glowMat);
    glowMarker.position.set(x, y + 0.85, z);
    this.scene.add(glowMarker);

    const chestObj = {
      mesh,
      position: new THREE.Vector3(x, y, z),
      glowMarker,
      biome,
      isOpened: false
    };

    mesh.userData.wildChest = chestObj;
    mesh.traverse(child => {
      child.userData.wildChest = chestObj;
    });

    this.addCircleCollider(x, z, 0.65, 'wildChest');
    this.wildChests.push(chestObj);
    return chestObj;
  }

  // --- Gravestone / Hautakivi System (Dropped Player Loot Recovery) ---
  spawnTombstone(x, y, z, droppedItems = {}) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    // Weathered stone pedestal
    const baseGeo = new THREE.BoxGeometry(0.85, 0.18, 0.55);
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x484b50,
      roughness: 0.9,
      metalness: 0.15
    });
    const baseMesh = new THREE.Mesh(baseGeo, stoneMat);
    baseMesh.position.y = 0.09;
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    group.add(baseMesh);

    // Upright grave cross / rune tombstone slab
    const stoneGeo = new THREE.BoxGeometry(0.55, 1.05, 0.16);
    const stoneMesh = new THREE.Mesh(stoneGeo, stoneMat);
    stoneMesh.position.y = 0.65;
    stoneMesh.castShadow = true;
    group.add(stoneMesh);

    // Cross horizontal bar
    const crossBarGeo = new THREE.BoxGeometry(0.85, 0.16, 0.18);
    const crossBar = new THREE.Mesh(crossBarGeo, stoneMat);
    crossBar.position.y = 0.88;
    crossBar.castShadow = true;
    group.add(crossBar);

    // Floating glowing rune beacon
    const runeGeo = new THREE.OctahedronGeometry(0.18, 0);
    const runeMat = new THREE.MeshBasicMaterial({ color: 0x38ef7d });
    const rune = new THREE.Mesh(runeGeo, runeMat);
    rune.position.set(0, 1.55, 0);
    group.add(rune);

    this.scene.add(group);

    const tombstone = {
      id: Date.now(),
      mesh: group,
      runeMesh: rune,
      position: new THREE.Vector3(x, y, z),
      items: droppedItems
    };

    if (!this.tombstones) this.tombstones = [];
    this.addCircleCollider(x, z, 0.65, 'tombstone');
    this.tombstones.push(tombstone);
    return tombstone;
  }

  removeTombstone(tombstone) {
    if (!tombstone) return;
    if (tombstone.mesh) {
      this.scene.remove(tombstone.mesh);
    }
    if (tombstone.position) {
      this.colliders = this.colliders.filter(c => !(c.type === 'circle' && c.name === 'tombstone' && Math.hypot(c.x - tombstone.position.x, c.z - tombstone.position.z) < 0.2));
    }
    if (this.tombstones) {
      this.tombstones = this.tombstones.filter(t => t !== tombstone);
    }
  }
}
