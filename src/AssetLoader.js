import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const isMobileClient = (
  typeof window !== 'undefined' && (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    /Android|iPhone|iPad|iPod|Windows Phone|webOS|BlackBerry/i.test(navigator.userAgent) ||
    window.innerWidth <= 900
  )
);

export default class AssetLoader {
  constructor() {
    this.models = {};
    this.animations = {}; // clipName -> THREE.AnimationClip (all clips fallback)
    this.ual2Animations = {}; // UAL2 clips only
    this.rigMediumAnimations = {}; // KayKit Rig_Medium clips only
    this.textures = {};   // name -> THREE.Texture
    this.loader = new GLTFLoader();
    this.texLoader = new THREE.TextureLoader();
    this.total = 0;
    this.loaded = 0;
  }

  updateProgress(currentName = '') {
    const loadingBar = document.getElementById('loading-bar');
    const loadingText = document.getElementById('loading-text');
    const pct = this.total > 0 ? Math.min(100, Math.round((this.loaded / this.total) * 100)) : 100;
    if (loadingBar) {
      loadingBar.style.width = `${pct}%`;
    }
    if (loadingText) {
      loadingText.textContent = `Ladataan maailmaa: ${currentName || 'assetit'}... (${pct}%)`;
    }
  }

  async loadModel(name, url) {
    return new Promise((resolve) => {
      let settled = false;
      const done = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.loaded++;
        this.updateProgress(name);
        resolve(result);
      };

      // 6 second timeout to ensure mobile connections never hang indefinitely at 99%
      const timer = setTimeout(() => {
        console.warn(`[AssetLoader] Timeout loading model ${name} (${url})`);
        done(null);
      }, 6000);

      try {
        this.loader.load(
          url,
          (gltf) => {
            try {
              const model = gltf.scene;
              model.traverse((child) => {
                if (child.isMesh) {
                  child.castShadow = true;
                  child.receiveShadow = true;
                  if (child.material) {
                    const matName = child.material.name ? child.material.name.toLowerCase() : '';
                    const nodeName = child.name.toLowerCase();
                    if (matName.includes('leaf') || matName.includes('pine') || matName.includes('foliage') ||
                        matName.includes('flower') || matName.includes('grass') ||
                        nodeName.includes('leaf') || nodeName.includes('cone') || nodeName.includes('foliage')) {
                      child.material.side = THREE.DoubleSide;
                      child.material.shadowSide = THREE.DoubleSide;
                    }
                  }
                }
              });
              this.models[name] = model;
              done(model);
            } catch (err) {
              console.warn(`[AssetLoader] Parse error in model ${name}:`, err);
              done(null);
            }
          },
          undefined,
          (err) => {
            console.warn(`[AssetLoader] Could not load model ${name} (${url}):`, err);
            done(null);
          }
        );
      } catch (err) {
        console.warn(`[AssetLoader] Immediate error in loadModel ${name}:`, err);
        done(null);
      }
    });
  }

  async loadOBJ(name, objUrl, mtlUrl) {
    return new Promise((resolve) => {
      let settled = false;
      const done = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.loaded++;
        this.updateProgress(name);
        resolve(result);
      };

      const timer = setTimeout(() => {
        console.warn(`[AssetLoader] Timeout loading OBJ ${name}`);
        done(null);
      }, 7000);

      try {
        const mtlLoader = new MTLLoader();
        if (mtlUrl) {
          const lastSlash = mtlUrl.lastIndexOf('/');
          if (lastSlash !== -1) {
            const basePath = mtlUrl.substring(0, lastSlash + 1);
            mtlLoader.setPath(basePath);
            mtlLoader.setResourcePath(basePath);
            mtlUrl = mtlUrl.substring(lastSlash + 1);
          }
        }
        mtlLoader.load(
          mtlUrl,
          (materials) => {
            try {
              materials.preload();
              const objLoader = new OBJLoader();
              objLoader.setMaterials(materials);
              objLoader.load(
                objUrl,
                (obj) => {
                  try {
                    obj.traverse((child) => {
                      if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                      }
                    });
                    this.models[name] = obj;
                    done(obj);
                  } catch (err) {
                    console.warn(`[AssetLoader] Error traversing OBJ ${name}:`, err);
                    done(null);
                  }
                },
                undefined,
                (err) => {
                  console.warn(`[AssetLoader] Could not load OBJ ${name}:`, err);
                  done(null);
                }
              );
            } catch (err) {
              console.warn(`[AssetLoader] Error processing MTL for ${name}:`, err);
              done(null);
            }
          },
          undefined,
          (err) => {
            console.warn(`[AssetLoader] Could not load MTL for ${name}:`, err);
            done(null);
          }
        );
      } catch (err) {
        console.warn(`[AssetLoader] Immediate error in loadOBJ ${name}:`, err);
        done(null);
      }
    });
  }

  async loadAnimations(url, rigType = 'auto') {
    const isRigMedium = (rigType === 'rigMedium') || url.includes('Rig_Medium');
    return new Promise((resolve) => {
      let settled = false;
      const done = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.loaded++;
        this.updateProgress('animaatiot');
        resolve(result);
      };

      const timer = setTimeout(() => {
        console.warn(`[AssetLoader] Timeout loading animations from ${url}`);
        done([]);
      }, 7000);

      try {
        this.loader.load(
          url,
          (gltf) => {
            try {
              if (gltf.animations && gltf.animations.length > 0) {
                const targetDict = isRigMedium ? this.rigMediumAnimations : this.ual2Animations;

                // Natural resting quaternions from character bind pose (straight forward gaze, zero yaw/roll tilt)
                const restNeck = new THREE.Quaternion(0.257259, 0, 0, 0.966342);
                const restHead = new THREE.Quaternion(-0.132070, 0, 0, 0.991240);

                for (const clip of gltf.animations) {
                  const nameLower = clip.name.toLowerCase();

                  // Only stabilize UAL2 head/neck if it is UAL2
                  if (!isRigMedium && nameLower.includes('idle')) {
                    const duration = clip.duration || 2.0;
                    let hasNeckQuat = false;
                    let hasHeadQuat = false;

                    for (const track of clip.tracks) {
                      const trackLower = track.name.toLowerCase();
                      if (trackLower.includes('neck') && track.name.endsWith('.quaternion')) {
                        hasNeckQuat = true;
                        for (let k = 0; k < track.times.length; k++) {
                          const t = track.times[k];
                          const breath = Math.sin((t / duration) * Math.PI * 2) * 0.008;
                          const qNeck = restNeck.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), breath));
                          track.values[k * 4 + 0] = qNeck.x;
                          track.values[k * 4 + 1] = 0;
                          track.values[k * 4 + 2] = 0;
                          track.values[k * 4 + 3] = qNeck.w;
                        }
                      } else if (trackLower.includes('head') && track.name.endsWith('.quaternion')) {
                        hasHeadQuat = true;
                        for (let k = 0; k < track.times.length; k++) {
                          const t = track.times[k];
                          const breath = Math.sin((t / duration) * Math.PI * 2) * 0.008;
                          const qHead = restHead.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -breath * 0.5));
                          track.values[k * 4 + 0] = qHead.x;
                          track.values[k * 4 + 1] = 0;
                          track.values[k * 4 + 2] = 0;
                          track.values[k * 4 + 3] = qHead.w;
                        }
                      }
                    }

                    if (!hasNeckQuat) {
                      const times = [0, duration * 0.5, duration];
                      const values = [];
                      for (const t of times) {
                        const breath = Math.sin((t / duration) * Math.PI * 2) * 0.008;
                        const qNeck = restNeck.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), breath));
                        values.push(qNeck.x, 0, 0, qNeck.w);
                      }
                      clip.tracks.push(new THREE.QuaternionKeyframeTrack('neck_01.quaternion', times, values));
                    }

                    if (!hasHeadQuat) {
                      const times = [0, duration * 0.5, duration];
                      const values = [];
                      for (const t of times) {
                        const breath = Math.sin((t / duration) * Math.PI * 2) * 0.008;
                        const qHead = restHead.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -breath * 0.5));
                        values.push(qHead.x, 0, 0, qHead.w);
                      }
                      clip.tracks.push(new THREE.QuaternionKeyframeTrack('Head.quaternion', times, values));
                    }
                  }

                  targetDict[clip.name] = clip;
                  this.animations[clip.name] = clip;
                }

                // Create natural humanoid walk clip with relaxed arm carriage for UAL2
                if (!isRigMedium && this.ual2Animations['Walk_Carry_Loop'] && this.ual2Animations['Idle_No_Loop']) {
                  const walkOrig = this.ual2Animations['Walk_Carry_Loop'];
                  const idleOrig = this.ual2Animations['Idle_No_Loop'];
                  const walkDuration = walkOrig.duration;

                  // 1. Lower body, pelvis, root, spine, neck, head from Walk_Carry_Loop
                  const mergedTracks = walkOrig.tracks.filter(t => {
                    const n = t.name.toLowerCase();
                    return !n.includes('arm_') && !n.includes('hand_') && !n.includes('clavicle_') &&
                           !n.includes('finger') && !n.includes('thumb') && !n.includes('index') &&
                           !n.includes('pinky') && !n.includes('ring') && !n.includes('middle');
                  });

                  // Clamp neck and head in walk to eliminate lateral twisting or tilting
                  for (const track of mergedTracks) {
                    const tn = track.name.toLowerCase();
                    if ((tn.includes('neck') || tn.includes('head')) && track.name.endsWith('.quaternion')) {
                      for (let k = 0; k < track.times.length; k++) {
                        track.values[k * 4 + 1] = 0;
                        track.values[k * 4 + 2] = 0;
                        const len = Math.hypot(track.values[k * 4 + 0], track.values[k * 4 + 3]);
                        if (len > 0.0001) {
                          track.values[k * 4 + 0] /= len;
                          track.values[k * 4 + 3] /= len;
                        }
                      }
                    }
                  }

                  // 2. Arms & hands from Idle_No_Loop (retimed to walkDuration so they stay relaxed, NOT in T-pose!)
                  const armTracks = idleOrig.tracks.filter(t => {
                    const n = t.name.toLowerCase();
                    return n.includes('arm_') || n.includes('hand_') || n.includes('clavicle_') ||
                           n.includes('finger') || n.includes('thumb') || n.includes('index') ||
                           n.includes('pinky') || n.includes('ring') || n.includes('middle');
                  });

                  for (const at of armTracks) {
                    const cloned = at.clone();
                    const scale = walkDuration / idleOrig.duration;
                    for (let k = 0; k < cloned.times.length; k++) {
                      cloned.times[k] *= scale;
                    }
                    mergedTracks.push(cloned);
                  }

                  const walkClip = new THREE.AnimationClip('Walk_Natural_Loop', walkDuration, mergedTracks);
                  this.ual2Animations['Walk_Natural_Loop'] = walkClip;
                  this.animations['Walk_Natural_Loop'] = walkClip;

                  // 3. Create high-energy athletic sprint animation: 'Run_Sprint_Loop'
                  const sprintDuration = walkDuration * 0.52;
                  const sprintTracks = [];
                  const sprintLeanQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.20);

                  for (const origTrack of walkOrig.tracks) {
                    const n = origTrack.name.toLowerCase();
                    if (n.includes('arm_') || n.includes('hand_') || n.includes('clavicle_') ||
                        n.includes('finger') || n.includes('thumb') || n.includes('index') ||
                        n.includes('pinky') || n.includes('ring') || n.includes('middle')) {
                      continue;
                    }

                    const track = origTrack.clone();
                    for (let k = 0; k < track.times.length; k++) {
                      track.times[k] = (track.times[k] / walkDuration) * sprintDuration;
                    }

                    if (n.includes('spine') && track.name.endsWith('.quaternion')) {
                      for (let q = 0; q < track.values.length; q += 4) {
                        const quat = new THREE.Quaternion(
                          track.values[q],
                          track.values[q + 1],
                          track.values[q + 2],
                          track.values[q + 3]
                        );
                        quat.multiply(sprintLeanQuat);
                        track.values[q] = quat.x;
                        track.values[q + 1] = quat.y;
                        track.values[q + 2] = quat.z;
                        track.values[q + 3] = quat.w;
                      }
                    }

                    if ((n.includes('neck') || n.includes('head')) && track.name.endsWith('.quaternion')) {
                      for (let q = 0; q < track.values.length; q += 4) {
                        track.values[q + 1] = 0;
                        track.values[q + 2] = 0;
                        const len = Math.hypot(track.values[q], track.values[q + 3]);
                        if (len > 0.0001) {
                          track.values[q] /= len;
                          track.values[q + 3] /= len;
                        }
                      }
                    }

                    sprintTracks.push(track);
                  }

                  for (const at of armTracks) {
                    const cloned = at.clone();
                    const scale = sprintDuration / idleOrig.duration;
                    for (let k = 0; k < cloned.times.length; k++) {
                      cloned.times[k] *= scale;
                    }
                    sprintTracks.push(cloned);
                  }

                  const sprintClip = new THREE.AnimationClip('Run_Sprint_Loop', sprintDuration, sprintTracks);
                  this.ual2Animations['Run_Sprint_Loop'] = sprintClip;
                  this.animations['Run_Sprint_Loop'] = sprintClip;
                }
              }
              done(gltf.animations || []);
            } catch (err) {
              console.warn('[AssetLoader] Error processing animations from', url, err);
              done([]);
            }
          },
          undefined,
          (err) => {
            console.warn('[AssetLoader] Failed to load animations from', url, err);
            done([]);
          }
        );
      } catch (err) {
        console.warn('[AssetLoader] Immediate error in loadAnimations:', err);
        done([]);
      }
    });
  }

  async loadTexture(name, url, wrap = true, repeatX = 1, repeatY = 1) {
    return new Promise((resolve) => {
      let settled = false;
      const done = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.loaded++;
        this.updateProgress(name);
        resolve(result);
      };

      const timer = setTimeout(() => {
        console.warn(`[AssetLoader] Timeout loading texture ${name}`);
        done(null);
      }, 6000);

      try {
        this.texLoader.load(
          url,
          (tex) => {
            try {
              if (wrap) {
                tex.wrapS = THREE.RepeatWrapping;
                tex.wrapT = THREE.RepeatWrapping;
                tex.repeat.set(repeatX, repeatY);
              }
              tex.colorSpace = THREE.SRGBColorSpace;
              tex.anisotropy = Math.min(8, this.renderer?.capabilities?.getMaxAnisotropy?.() || 4);
              this.textures[name] = tex;
              done(tex);
            } catch (err) {
              console.warn(`[AssetLoader] Texture process error ${name}:`, err);
              done(null);
            }
          },
          undefined,
          (err) => {
            console.warn(`[AssetLoader] Texture load error ${name}:`, err);
            done(null);
          }
        );
      } catch (err) {
        console.warn(`[AssetLoader] Immediate error in loadTexture ${name}:`, err);
        done(null);
      }
    });
  }

  async loadAll() {
    const modelManifest = [
      // KayKit Adventurers 2.0 (Unique Heroic Characters)
      { name: 'Barbarian',      url: '/assets/KayKit_Adventurers_2.0_FREE/KayKit_Adventurers_2.0_FREE/Characters/gltf/Barbarian.glb' },
      { name: 'Knight',         url: '/assets/KayKit_Adventurers_2.0_FREE/KayKit_Adventurers_2.0_FREE/Characters/gltf/Knight.glb' },
      { name: 'Mage',           url: '/assets/KayKit_Adventurers_2.0_FREE/KayKit_Adventurers_2.0_FREE/Characters/gltf/Mage.glb' },
      { name: 'Ranger_Adv',     url: '/assets/KayKit_Adventurers_2.0_FREE/KayKit_Adventurers_2.0_FREE/Characters/gltf/Ranger.glb' },
      { name: 'Rogue',          url: '/assets/KayKit_Adventurers_2.0_FREE/KayKit_Adventurers_2.0_FREE/Characters/gltf/Rogue.glb' },
      { name: 'Rogue_Hooded',   url: '/assets/KayKit_Adventurers_2.0_FREE/KayKit_Adventurers_2.0_FREE/Characters/gltf/Rogue_Hooded.glb' },

      // KayKit Skeletons 1.1 (Biome Enemies & Boss Minions)
      { name: 'Skeleton_Warrior', url: '/assets/KayKit_Skeletons_1.1_FREE/KayKit_Skeletons_1.1_FREE/characters/gltf/Skeleton_Warrior.glb' },
      { name: 'Skeleton_Mage',    url: '/assets/KayKit_Skeletons_1.1_FREE/KayKit_Skeletons_1.1_FREE/characters/gltf/Skeleton_Mage.glb' },
      { name: 'Skeleton_Rogue',   url: '/assets/KayKit_Skeletons_1.1_FREE/KayKit_Skeletons_1.1_FREE/characters/gltf/Skeleton_Rogue.glb' },
      { name: 'Skeleton_Minion',  url: '/assets/KayKit_Skeletons_1.1_FREE/KayKit_Skeletons_1.1_FREE/characters/gltf/Skeleton_Minion.glb' },

      // Skeleton & Adventurer Weapons & Gear
      { name: 'Skeleton_Blade',          url: '/assets/KayKit_Skeletons_1.1_FREE/KayKit_Skeletons_1.1_FREE/assets/gltf/Skeleton_Blade.gltf' },
      { name: 'Skeleton_Axe',            url: '/assets/KayKit_Skeletons_1.1_FREE/KayKit_Skeletons_1.1_FREE/assets/gltf/Skeleton_Axe.gltf' },
      { name: 'Skeleton_Staff',          url: '/assets/KayKit_Skeletons_1.1_FREE/KayKit_Skeletons_1.1_FREE/assets/gltf/Skeleton_Staff.gltf' },
      { name: 'Skeleton_Crossbow',       url: '/assets/KayKit_Skeletons_1.1_FREE/KayKit_Skeletons_1.1_FREE/assets/gltf/Skeleton_Crossbow.gltf' },
      { name: 'Skeleton_Shield_Large_A', url: '/assets/KayKit_Skeletons_1.1_FREE/KayKit_Skeletons_1.1_FREE/assets/gltf/Skeleton_Shield_Large_A.gltf' },
      { name: 'Skeleton_Shield_Small_A', url: '/assets/KayKit_Skeletons_1.1_FREE/KayKit_Skeletons_1.1_FREE/assets/gltf/Skeleton_Shield_Small_A.gltf' },
      { name: 'sword_2handed',           url: '/assets/KayKit_Adventurers_2.0_FREE/KayKit_Adventurers_2.0_FREE/Assets/gltf/sword_2handed.gltf' },
      { name: 'sword_1handed',           url: '/assets/KayKit_Adventurers_2.0_FREE/KayKit_Adventurers_2.0_FREE/Assets/gltf/sword_1handed.gltf' },
      { name: 'shield_badge',            url: '/assets/KayKit_Adventurers_2.0_FREE/KayKit_Adventurers_2.0_FREE/Assets/gltf/shield_badge.gltf' },
      { name: 'shield_round_barbarian',  url: '/assets/KayKit_Adventurers_2.0_FREE/KayKit_Adventurers_2.0_FREE/Assets/gltf/shield_round_barbarian.gltf' },
      { name: 'staff',                   url: '/assets/KayKit_Adventurers_2.0_FREE/KayKit_Adventurers_2.0_FREE/Assets/gltf/staff.gltf' },
      { name: 'bow_withString',          url: '/assets/KayKit_Adventurers_2.0_FREE/KayKit_Adventurers_2.0_FREE/Assets/gltf/bow_withString.gltf' },
      { name: 'crossbow_1handed',        url: '/assets/KayKit_Adventurers_2.0_FREE/KayKit_Adventurers_2.0_FREE/Assets/gltf/crossbow_1handed.gltf' },
      { name: 'dagger',                  url: '/assets/KayKit_Adventurers_2.0_FREE/KayKit_Adventurers_2.0_FREE/Assets/gltf/dagger.gltf' },
      { name: 'wand',                    url: '/assets/KayKit_Adventurers_2.0_FREE/KayKit_Adventurers_2.0_FREE/Assets/gltf/wand.gltf' },

      // KayKit Nature Pack Assets
      { name: 'Tree_1_A', url: '/assets/KayKit_Forest_Nature_Pack_1.0_FREE/Assets/gltf/Tree_1_A_Color1.gltf' },
      { name: 'Tree_2_A', url: '/assets/KayKit_Forest_Nature_Pack_1.0_FREE/Assets/gltf/Tree_2_A_Color1.gltf' },
      { name: 'Tree_3_A', url: '/assets/KayKit_Forest_Nature_Pack_1.0_FREE/Assets/gltf/Tree_3_A_Color1.gltf' },
      { name: 'Bush_1_A', url: '/assets/KayKit_Forest_Nature_Pack_1.0_FREE/Assets/gltf/Bush_1_A_Color1.gltf' },
      { name: 'Rock_1_A', url: '/assets/KayKit_Forest_Nature_Pack_1.0_FREE/Assets/gltf/Rock_1_A_Color1.gltf' },
      { name: 'Rock_2_A', url: '/assets/KayKit_Forest_Nature_Pack_1.0_FREE/Assets/gltf/Rock_2_A_Color1.gltf' },

      // Trees
      { name: 'Pine_1', url: '/assets/nature/Pine_1.gltf' },
      { name: 'Pine_2', url: '/assets/nature/Pine_2.gltf' },
      { name: 'Pine_3', url: '/assets/nature/Pine_3.gltf' },
      { name: 'Pine_4', url: '/assets/nature/Pine_4.gltf' },
      { name: 'Pine_5', url: '/assets/nature/Pine_5.gltf' },
      { name: 'CommonTree_1', url: '/assets/nature/CommonTree_1.gltf' },
      { name: 'CommonTree_2', url: '/assets/nature/CommonTree_2.gltf' },
      { name: 'CommonTree_3', url: '/assets/nature/CommonTree_3.gltf' },
      { name: 'CommonTree_4', url: '/assets/nature/CommonTree_4.gltf' },
      { name: 'CommonTree_5', url: '/assets/nature/CommonTree_5.gltf' },
      { name: 'DeadTree_1', url: '/assets/nature/DeadTree_1.gltf' },
      { name: 'DeadTree_2', url: '/assets/nature/DeadTree_2.gltf' },
      { name: 'DeadTree_3', url: '/assets/nature/DeadTree_3.gltf' },
      { name: 'TwistedTree_1', url: '/assets/nature/TwistedTree_1.gltf' },
      { name: 'TwistedTree_2', url: '/assets/nature/TwistedTree_2.gltf' },

      // Bushes & Grass & Flowers
      { name: 'Bush_Common', url: '/assets/nature/Bush_Common.gltf' },
      { name: 'Bush_Common_Flowers', url: '/assets/nature/Bush_Common_Flowers.gltf' },
      { name: 'Grass_Common_Tall', url: '/assets/nature/Grass_Common_Tall.gltf' },
      { name: 'Grass_Common_Short', url: '/assets/nature/Grass_Common_Short.gltf' },
      { name: 'Grass_Wispy_Tall', url: '/assets/nature/Grass_Wispy_Tall.gltf' },
      { name: 'Flower_3_Group', url: '/assets/nature/Flower_3_Group.gltf' },
      { name: 'Flower_4_Group', url: '/assets/nature/Flower_4_Group.gltf' },
      { name: 'Clover_1', url: '/assets/nature/Clover_1.gltf' },
      { name: 'Fern_1', url: '/assets/nature/Fern_1.gltf' },
      { name: 'Plant_1', url: '/assets/nature/Plant_1.gltf' },
      { name: 'Plant_7', url: '/assets/nature/Plant_7.gltf' },
      { name: 'Mushroom_Common', url: '/assets/nature/Mushroom_Common.gltf' },
      { name: 'Mushroom_Laetiporus', url: '/assets/nature/Mushroom_Laetiporus.gltf' },

      // Rocks
      { name: 'Rock_Medium_1', url: '/assets/nature/Rock_Medium_1.gltf' },
      { name: 'Rock_Medium_2', url: '/assets/nature/Rock_Medium_2.gltf' },
      { name: 'Rock_Medium_3', url: '/assets/nature/Rock_Medium_3.gltf' },
      { name: 'Pebble_Round_1', url: '/assets/nature/Pebble_Round_1.gltf' },

      // Props & Weapons
      { name: 'Chest_Wood', url: '/assets/props/Chest_Wood.gltf' },
      { name: 'Barrel', url: '/assets/props/Barrel.gltf' },
      { name: 'Barrel_Apples', url: '/assets/props/Barrel_Apples.gltf' },
      { name: 'Axe_Bronze', url: '/assets/props/Axe_Bronze.gltf' },
      { name: 'Sword_Bronze', url: '/assets/props/Sword_Bronze.gltf' },
      { name: 'Pickaxe_Bronze', url: '/assets/props/Pickaxe_Bronze.gltf' },
      { name: 'WeaponStand', url: '/assets/props/WeaponStand.gltf' },
      { name: 'Anvil_Log', url: '/assets/props/Anvil_Log.gltf' },
      { name: 'Cauldron', url: '/assets/props/Cauldron.gltf' },
      { name: 'Bench', url: '/assets/props/Bench.gltf' },
      { name: 'CandleStick_Stand', url: '/assets/props/CandleStick_Stand.gltf' },
      { name: 'Torch_Metal', url: '/assets/props/Torch_Metal.gltf' },
      { name: 'FarmCrate_Carrot', url: '/assets/props/FarmCrate_Carrot.gltf' },
      { name: 'FarmCrate_Apple', url: '/assets/props/FarmCrate_Apple.gltf' },
      { name: 'Table_Large', url: '/assets/props/Table_Large.gltf' },
      { name: 'Chair_1', url: '/assets/props/Chair_1.gltf' },
      { name: 'Stall_Empty', url: '/assets/props/Stall_Empty.gltf' },
      { name: 'Stall_Cart_Empty', url: '/assets/props/Stall_Cart_Empty.gltf' },
      { name: 'Workbench', url: '/assets/props/Workbench.gltf' },
      { name: 'Workbench_Drawers', url: '/assets/props/Workbench_Drawers.gltf' },
      { name: 'Bed_Twin1', url: '/assets/props/Bed_Twin1.gltf' },
      { name: 'Bookcase_2', url: '/assets/props/Bookcase_2.gltf' },

      // Village
      { name: 'Wall_Plaster_Straight', url: '/assets/village/Wall_Plaster_Straight.gltf' },
      { name: 'Wall_Plaster_Window_Wide_Flat', url: '/assets/village/Wall_Plaster_Window_Wide_Flat.gltf' },
      { name: 'Wall_Plaster_Door_Flat', url: '/assets/village/Wall_Plaster_Door_Flat.gltf' },
      { name: 'Wall_UnevenBrick_Straight', url: '/assets/village/Wall_UnevenBrick_Straight.gltf' },
      { name: 'Wall_UnevenBrick_Window_Thin_Round', url: '/assets/village/Wall_UnevenBrick_Window_Thin_Round.gltf' },
      { name: 'Wall_UnevenBrick_Door_Flat', url: '/assets/village/Wall_UnevenBrick_Door_Flat.gltf' },
      { name: 'Wall_Arch', url: '/assets/village/Wall_Arch.gltf' },
      { name: 'Door_1_Flat', url: '/assets/village/Door_1_Flat.gltf' },
      { name: 'Door_2_Flat', url: '/assets/village/Door_2_Flat.gltf' },
      { name: 'Roof_RoundTiles_4x4', url: '/assets/village/Roof_RoundTiles_4x4.gltf' },
      { name: 'Roof_RoundTiles_6x8', url: '/assets/village/Roof_RoundTiles_6x8.gltf' },
      { name: 'Roof_Tower_RoundTiles', url: '/assets/village/Roof_Tower_RoundTiles.gltf' },
      { name: 'Roof_Wooden_2x1', url: '/assets/village/Roof_Wooden_2x1.gltf' },
      { name: 'Roof_Wooden_2x1_Corner', url: '/assets/village/Roof_Wooden_2x1_Corner.gltf' },
      { name: 'Roof_Log', url: '/assets/village/Roof_Log.gltf' },
      { name: 'WindowShutters_Wide_Flat_Open', url: '/assets/village/WindowShutters_Wide_Flat_Open.gltf' },
      { name: 'Floor_WoodDark', url: '/assets/village/Floor_WoodDark.gltf' },
      { name: 'Floor_WoodLight', url: '/assets/village/Floor_WoodLight.gltf' },
      { name: 'Floor_Brick', url: '/assets/village/Floor_Brick.gltf' },
      { name: 'Prop_Wagon', url: '/assets/village/Prop_Wagon.gltf' },
      { name: 'Prop_WoodenFence_Single', url: '/assets/village/Prop_WoodenFence_Single.gltf' },
      { name: 'Prop_WoodenFence_Extension1', url: '/assets/village/Prop_WoodenFence_Extension1.gltf' },
      { name: 'Prop_Crate', url: '/assets/village/Prop_Crate.gltf' },
      { name: 'Prop_Chimney', url: '/assets/village/Prop_Chimney.gltf' },
      { name: 'Stairs_Exterior_Straight', url: '/assets/village/Stairs_Exterior_Straight.gltf' },
      { name: 'Stairs_Exterior_Platform', url: '/assets/village/Stairs_Exterior_Platform.gltf' },

      // KayKit Medieval Hexagon landmarks used by explored biome settlements.
      { name: 'HexMarketGreen', url: '/assets/KayKit_Medieval_Hexagon_Pack_1.0_FREE/Assets/gltf/buildings/green/building_market_green.gltf' },
      { name: 'HexWindmillYellow', url: '/assets/KayKit_Medieval_Hexagon_Pack_1.0_FREE/Assets/gltf/buildings/yellow/building_windmill_yellow.gltf' },
      { name: 'HexTowerRed', url: '/assets/KayKit_Medieval_Hexagon_Pack_1.0_FREE/Assets/gltf/buildings/red/building_tower_A_red.gltf' },
      { name: 'HexBarracksBlue', url: '/assets/KayKit_Medieval_Hexagon_Pack_1.0_FREE/Assets/gltf/buildings/blue/building_barracks_blue.gltf' },
      { name: 'HexHomeAGreen', url: '/assets/KayKit_Medieval_Hexagon_Pack_1.0_FREE/Assets/gltf/buildings/green/building_home_A_green.gltf' },
      { name: 'HexHomeBRed', url: '/assets/KayKit_Medieval_Hexagon_Pack_1.0_FREE/Assets/gltf/buildings/red/building_home_B_red.gltf' },
      { name: 'HexBlacksmithBlue', url: '/assets/KayKit_Medieval_Hexagon_Pack_1.0_FREE/Assets/gltf/buildings/blue/building_blacksmith_blue.gltf' },
      { name: 'HexTavernYellow', url: '/assets/KayKit_Medieval_Hexagon_Pack_1.0_FREE/Assets/gltf/buildings/yellow/building_tavern_yellow.gltf' },
      { name: 'HexChurchBlue', url: '/assets/KayKit_Medieval_Hexagon_Pack_1.0_FREE/Assets/gltf/buildings/blue/building_church_blue.gltf' },
      { name: 'HexArcheryGreen', url: '/assets/KayKit_Medieval_Hexagon_Pack_1.0_FREE/Assets/gltf/buildings/green/building_archeryrange_green.gltf' },
      { name: 'HexLumbermillRed', url: '/assets/KayKit_Medieval_Hexagon_Pack_1.0_FREE/Assets/gltf/buildings/red/building_lumbermill_red.gltf' },
      { name: 'HexWellYellow', url: '/assets/KayKit_Medieval_Hexagon_Pack_1.0_FREE/Assets/gltf/buildings/yellow/building_well_yellow.gltf' },
      { name: 'HexTreeLarge', url: '/assets/KayKit_Medieval_Hexagon_Pack_1.0_FREE/Assets/gltf/decoration/nature/trees_A_large.gltf' },
      { name: 'HexTreeSmall', url: '/assets/KayKit_Medieval_Hexagon_Pack_1.0_FREE/Assets/gltf/decoration/nature/trees_B_small.gltf' },
      { name: 'HexTreeSingle', url: '/assets/KayKit_Medieval_Hexagon_Pack_1.0_FREE/Assets/gltf/decoration/nature/tree_single_A.gltf' },
      { name: 'HexRockA', url: '/assets/KayKit_Medieval_Hexagon_Pack_1.0_FREE/Assets/gltf/decoration/nature/rock_single_A.gltf' }
    ];

    const textureManifest = [
      { name: 'Grass', url: '/assets/textures/Grass.png', wrap: true, rx: 60, ry: 60 },
      { name: 'Rocks', url: '/assets/textures/Rocks_Diffuse.png', wrap: true, rx: 20, ry: 20 },
      { name: 'Noise_Terrain', url: '/assets/textures/T_Noise_Terrain.png', wrap: true, rx: 90, ry: 90 }
    ];

    const objManifest = [
      { name: 'BirchTree_1', obj: '/assets/nature/BirchTree_1.obj', mtl: '/assets/nature/BirchTree_1.mtl' },
      { name: 'BirchTree_2', obj: '/assets/nature/BirchTree_2.obj', mtl: '/assets/nature/BirchTree_2.mtl' },
      { name: 'BirchTree_3', obj: '/assets/nature/BirchTree_3.obj', mtl: '/assets/nature/BirchTree_3.mtl' },
      { name: 'BushBerries_1', obj: '/assets/nature/BushBerries_1.obj', mtl: '/assets/nature/BushBerries_1.mtl' },
      { name: 'Rock_Moss_1', obj: '/assets/nature/Rock_Moss_1.obj', mtl: '/assets/nature/Rock_Moss_1.mtl' },
      { name: 'Rock_Moss_2', obj: '/assets/nature/Rock_Moss_2.obj', mtl: '/assets/nature/Rock_Moss_2.mtl' },
      { name: 'WoodLog_Moss', obj: '/assets/nature/WoodLog_Moss.obj', mtl: '/assets/nature/WoodLog_Moss.mtl' },
      { name: 'TreeStump_Moss', obj: '/assets/nature/TreeStump_Moss.obj', mtl: '/assets/nature/TreeStump_Moss.mtl' },
      { name: 'Lilypad', obj: '/assets/nature/Lilypad.obj', mtl: '/assets/nature/Lilypad.mtl' },
      { name: 'Wheat', obj: '/assets/nature/Wheat.obj', mtl: '/assets/nature/Wheat.mtl' },

      // Real 3D Medieval Town & Village Buildings
      { name: 'LargeBuilding01', obj: '/assets/Large Building 01/Package/LargeBuilding01.obj', mtl: '/assets/Large Building 01/Package/LargeBuilding01.mtl' },
      { name: 'SmallBuilding01', obj: '/assets/Small Building 01/Package/SmallBuilding01.obj', mtl: '/assets/Small Building 01/Package/SmallBuilding01.mtl' },
      { name: 'SmallBuilding02', obj: '/assets/Small Building 02/Package/SmallBuilding02.obj', mtl: '/assets/Small Building 02/Package/SmallBuilding02.mtl' },
      { name: 'TallBuilding01',  obj: '/assets/Tall Building 01/Package/TallBuilding01.obj',  mtl: '/assets/Tall Building 01/Package/TallBuilding01.mtl' },
      { name: 'TallBuilding02',  obj: '/assets/Tall Building 02/Package/TallBuilding02.obj',  mtl: '/assets/Tall Building 02/Package/TallBuilding02.mtl' },
      { name: 'TinyBuilding01',  obj: '/assets/Tiny Building/Package/TinyBuilding01.obj',   mtl: '/assets/Tiny Building/Package/TinyBuilding01.mtl' }
    ];

    let activeModelManifest = modelManifest;
    let activeObjManifest = objManifest;

    if (isMobileClient) {
      const mobileModelNames = new Set([
        // Characters: 2 essential rigs (Rogue for player & all humanoids, Skeleton_Warrior for all skeletons)
        'Rogue', 'Skeleton_Warrior',
        // Weapons & Shields
        'sword_1handed', 'sword_2handed', 'shield_badge', 'staff', 'bow_withString', 'dagger',
        // Trees (1 of each core type: Pine, Common, Dead)
        'Pine_1', 'CommonTree_1', 'DeadTree_1',
        // Foliage & Rocks
        'Bush_Common', 'Grass_Common_Tall', 'Flower_3_Group', 'Fern_1',
        'Rock_Medium_1', 'Pebble_Round_1', 'Mushroom_Common',
        // Essential Props
        'Chest_Wood', 'Barrel', 'Torch_Metal', 'Workbench', 'Table_Large', 'Bench', 'Anvil_Log',
        // Modular Village Architecture
        'Wall_Plaster_Straight', 'Wall_Plaster_Door_Flat', 'Roof_RoundTiles_4x4',
        'Floor_WoodDark', 'Prop_WoodenFence_Single', 'Prop_Crate', 'Stairs_Exterior_Straight',
        // Placeable village buildings
        'HexHomeAGreen', 'HexHomeBRed', 'HexBlacksmithBlue', 'HexTavernYellow',
        'HexChurchBlue', 'HexArcheryGreen', 'HexLumbermillRed', 'HexWellYellow'
      ]);
      activeModelManifest = modelManifest.filter(m => mobileModelNames.has(m.name));
      // Completely eliminate heavy OBJ models and duplicate palettes on mobile (zero OBJ parsing & zero extra texture loads)
      activeObjManifest = [];
    }

    this.total = activeModelManifest.length + textureManifest.length + activeObjManifest.length + 2;
    this.loaded = 0;
    this.updateProgress('aloitetaan');

    // Safe throttled concurrency pool runner:
    // Uses concurrency of 2 on mobile to prevent socket timeout and peak memory spikes
    const runInPool = async (tasks, concurrency = 6) => {
      const results = [];
      const executing = [];
      for (const task of tasks) {
        const p = Promise.resolve().then(() => task());
        results.push(p);
        if (concurrency <= tasks.length) {
          const e = p.then(() => executing.splice(executing.indexOf(e), 1));
          executing.push(e);
          if (executing.length >= concurrency) {
            await Promise.race(executing);
          }
        }
      }
      return Promise.all(results);
    };

    const tasks = [
      ...activeModelManifest.map(m => () => this.loadModel(m.name, m.url)),
      ...activeObjManifest.map(o => () => this.loadOBJ(o.name, o.obj, o.mtl)),
      ...textureManifest.map(t => () => this.loadTexture(t.name, t.url, t.wrap, t.rx, t.ry)),
      () => this.loadAnimations('/assets/KayKit_Adventurers_2.0_FREE/KayKit_Adventurers_2.0_FREE/Animations/gltf/Rig_Medium/Rig_Medium_General.glb', 'rigMedium'),
      () => this.loadAnimations('/assets/KayKit_Adventurers_2.0_FREE/KayKit_Adventurers_2.0_FREE/Animations/gltf/Rig_Medium/Rig_Medium_MovementBasic.glb', 'rigMedium')
    ];

    const poolConcurrency = isMobileClient ? 2 : 6;
    await runInPool(tasks, poolConcurrency);

    // Guaranteed 100% completion
    this.loaded = this.total;
    this.updateProgress('Valmis!');
    const loadingBar = document.getElementById('loading-bar');
    if (loadingBar) loadingBar.style.width = '100%';

    return this;
  }

  get(name) {
    let source = this.models[name];
    if (!source) {
      if (name.startsWith('Pine_')) source = this.models['Pine_1'] || this.models['Pine_3'];
      else if (name.startsWith('CommonTree_')) source = this.models['CommonTree_1'] || this.models['CommonTree_3'];
      else if (name.startsWith('DeadTree_')) source = this.models['DeadTree_1'];
      else if (name.startsWith('TwistedTree_')) source = this.models['DeadTree_1'] || this.models['CommonTree_1'];
      else if (name.startsWith('BirchTree_')) source = this.models['CommonTree_1'];
      else if (name.startsWith('Rock_Medium_')) source = this.models['Rock_Medium_1'];
      else if (name.startsWith('Rock_Moss_')) source = this.models['Rock_Medium_1'];
      else if (name.startsWith('BushBerries_') || name.startsWith('Bush_')) source = this.models['Bush_Common'];
      else if (name.startsWith('WoodLog_Moss') || name === 'TreeStump_Moss') source = this.models['CommonTree_1'] || this.models['DeadTree_1'];
      else if (name === 'Wheat' || name.startsWith('Grass_')) source = this.models['Grass_Common_Tall'];
      else if (name.startsWith('Flower_') || name.startsWith('Plant_') || name === 'Clover_1') source = this.models['Flower_3_Group'] || this.models['Bush_Common'];
      else if (name.startsWith('Mushroom_')) source = this.models['Mushroom_Common'];
      else if (name === 'CandleStick_Stand') source = this.models['Torch_Metal'];
      else if (name.startsWith('FarmCrate_')) source = this.models['Prop_Crate'] || this.models['Chest_Wood'];
      else if (name === 'Chair_1') source = this.models['Bench'];
      else if (name.startsWith('Stall_') || name === 'Prop_Wagon') source = this.models['Table_Large'];
      else if (name.startsWith('Workbench')) source = this.models['Workbench'];
      else if (name === 'Bookcase_2' || name === 'Bed_Twin1') source = this.models['Table_Large'] || this.models['Bench'];
      else if (name === 'Barrel_Apples') source = this.models['Barrel'];
      else if (name.startsWith('Wall_UnevenBrick_')) source = this.models['Wall_Plaster_Straight'];
      else if (name === 'Wall_Arch' || name.startsWith('Door_') || name.includes('Window') || name === 'Prop_Chimney') source = this.models['Wall_Plaster_Door_Flat'] || this.models['Wall_Plaster_Straight'];
      else if (name.startsWith('Roof_')) source = this.models['Roof_RoundTiles_4x4'];
      else if (name.startsWith('Floor_')) source = this.models['Floor_WoodDark'];
      else if (name.startsWith('Prop_WoodenFence_')) source = this.models['Prop_WoodenFence_Single'];
      else if (name.startsWith('LargeBuilding') || name.startsWith('SmallBuilding') || name.startsWith('TallBuilding') || name.startsWith('TinyBuilding')) {
        source = this.models['Wall_Plaster_Straight'];
      }
      else if (name.startsWith('Skeleton_')) {
        if (name.includes('Blade') || name.includes('Axe') || name.includes('Staff')) source = this.models['sword_1handed'];
        else if (name.includes('Crossbow')) source = this.models['bow_withString'];
        else if (name.includes('Shield')) source = this.models['shield_badge'];
        else source = this.models['Skeleton_Warrior'];
      }
      else if (name === 'Barbarian' || name === 'Knight' || name === 'Mage' || name === 'Ranger_Adv' || name.includes('Rogue')) {
        source = this.models['Rogue'];
      }
      else if (name.includes('sword') || name.includes('Sword') || name.includes('dagger') || name.includes('Axe') || name.includes('Pickaxe')) {
        source = this.models['sword_1handed'] || this.models['sword_2handed'];
      }
      else if (name.includes('bow') || name.includes('crossbow')) {
        source = this.models['bow_withString'];
      }
      else if (name.includes('shield') || name.includes('Shield')) {
        source = this.models['shield_badge'];
      }
      else if (name.includes('staff') || name.includes('wand')) {
        source = this.models['staff'];
      }
    }
    if (!source) return null;

    let hasSkinnedMesh = false;
    source.traverse((c) => {
      if (c.isSkinnedMesh) hasSkinnedMesh = true;
    });

    const clone = hasSkinnedMesh
      ? SkeletonUtils.clone(source)
      : source.clone(true);

    const isMob = isMobileClient;
    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = !isMob;
        child.receiveShadow = !isMob;
        if (child.material) {
          const matName = child.material.name ? child.material.name.toLowerCase() : '';
          const nodeName = child.name.toLowerCase();
          if (matName.includes('leaf') || matName.includes('pine') || matName.includes('foliage') ||
              matName.includes('flower') || matName.includes('grass') ||
              nodeName.includes('leaf') || nodeName.includes('cone') || nodeName.includes('foliage')) {
            child.material.side = isMob ? THREE.FrontSide : THREE.DoubleSide;
            child.material.shadowSide = isMob ? THREE.FrontSide : THREE.DoubleSide;
          }
        }
      }
    });
    return clone;
  }

  getAnimation(clipName) {
    return this.animations[clipName] || null;
  }

  getTexture(name) {
    return this.textures[name] || null;
  }

  /**
   * Guarantees that every character has a head and expressive face with eyes, nose, mouth.
   * Works for both hooded characters (Rangers - mounts face inside the hood opening)
   * and unhooded characters (Peasants - builds full head with hair/coif).
   */
  ensureHead(characterModel, isFemale = false, eyeColor = 0x222222, skinColor = null, hairColor = null, hairStyle = 'short') {
    // Avoid double attaching if called twice
    let alreadyHasAttachedFace = false;
    let existingHead = null;
    characterModel.traverse((child) => {
      if (child.name === 'Attached_HeadGroup' || child.name === 'Attached_FaceGroup') {
        alreadyHasAttachedFace = true;
        existingHead = child;
      }
    });
    if (alreadyHasAttachedFace && existingHead && existingHead.parent) {
      existingHead.parent.remove(existingHead);
    }

    let hasHood = false;
    if (hairStyle === 'hood') {
      characterModel.traverse((child) => {
        if (child.isMesh && child.name.toLowerCase().includes('hood')) {
          hasHood = true;
        }
      });
    }

    let headBone = null;
    characterModel.traverse((child) => {
      if (child.isBone && (child.name === 'Head' || child.name === 'head')) {
        headBone = child;
      }
    });

    if (!headBone) {
      characterModel.traverse((child) => {
        if (child.isBone && child.name.toLowerCase().includes('neck')) {
          headBone = child;
        }
      });
    }

    if (!headBone) return;

    const headGroup = new THREE.Group();
    headGroup.name = 'Attached_HeadGroup';

    const isRigMed = !!(characterModel.getObjectByName('Rig_Medium') || characterModel.getObjectByName('root'));
    const headOffsetY = isRigMed ? 0.18 : 0.06;
    const headRadius = isRigMed ? 0.22 : 0.165;

    const defaultSkin = isFemale ? 0xf5d0b5 : 0xdba77a;
    const finalSkin = skinColor || defaultSkin;
    const defaultHair = isFemale ? 0x8a4b26 : 0x3d2817;
    const finalHair = hairColor || defaultHair;

    const skinMat = new THREE.MeshStandardMaterial({
      color: finalSkin,
      roughness: 0.65,
      metalness: 0.05
    });

    if (hasHood) {
      // 1. Character has a hood (Ranger): Build face nestled inside the hood opening
      const faceGeo = new THREE.SphereGeometry(headRadius * 0.85, 12, 10);
      faceGeo.scale(0.85, 1.05, 0.95);
      const faceMesh = new THREE.Mesh(faceGeo, skinMat);
      faceMesh.position.set(0, headOffsetY, 0.02);
      faceMesh.castShadow = true;
      faceMesh.receiveShadow = true;
      headGroup.add(faceMesh);

      // Sclera (eyewhite) + Iris/pupil
      const scleraMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const eyeMat = new THREE.MeshBasicMaterial({ color: eyeColor });

      const scleraGeo = new THREE.SphereGeometry(0.028, 8, 8);
      const pupilGeo = new THREE.SphereGeometry(0.016, 6, 6);

      const eyeSpread = isRigMed ? 0.058 : 0.045;
      const eyeZ = isRigMed ? 0.185 : 0.135;

      // Left eye
      const leftSclera = new THREE.Mesh(scleraGeo, scleraMat);
      leftSclera.position.set(-eyeSpread, headOffsetY + 0.02, eyeZ);
      const leftPupil = new THREE.Mesh(pupilGeo, eyeMat);
      leftPupil.position.set(-eyeSpread, headOffsetY + 0.02, eyeZ + 0.018);
      headGroup.add(leftSclera, leftPupil);

      // Right eye
      const rightSclera = new THREE.Mesh(scleraGeo, scleraMat);
      rightSclera.position.set(eyeSpread, headOffsetY + 0.02, eyeZ);
      const rightPupil = new THREE.Mesh(pupilGeo, eyeMat);
      rightPupil.position.set(eyeSpread, headOffsetY + 0.02, eyeZ + 0.018);
      headGroup.add(rightSclera, rightPupil);

      // Nose
      const noseGeo = new THREE.ConeGeometry(0.022, 0.045, 4);
      noseGeo.rotateX(Math.PI / 2);
      const nose = new THREE.Mesh(noseGeo, skinMat);
      nose.position.set(0, headOffsetY - 0.005, eyeZ + 0.02);
      headGroup.add(nose);

      // Beard for male ranger
      if (!isFemale) {
        const beardGeo = new THREE.BoxGeometry(headRadius * 0.52, 0.07, 0.06);
        const beardMat = new THREE.MeshStandardMaterial({ color: finalHair, roughness: 0.8 });
        const beard = new THREE.Mesh(beardGeo, beardMat);
        beard.position.set(0, headOffsetY - 0.07, eyeZ - 0.01);
        headGroup.add(beard);
      }
    } else {
      // 2. Character has no hood: Build full stylized head with open face, expressive eyes and non-overlapping hair
      const headGeo = new THREE.SphereGeometry(headRadius, 16, 14);
      headGeo.scale(0.88, 1.05, 0.95);
      const headMesh = new THREE.Mesh(headGeo, skinMat);
      headMesh.position.set(0, headOffsetY, 0.0);
      headMesh.castShadow = true;
      headMesh.receiveShadow = true;
      headGroup.add(headMesh);

      // Ears on sides of head
      const earGeo = new THREE.BoxGeometry(0.028, 0.05, 0.038);
      const earL = new THREE.Mesh(earGeo, skinMat);
      earL.position.set(-headRadius * 0.88, headOffsetY + 0.01, 0.0);
      const earR = new THREE.Mesh(earGeo, skinMat);
      earR.position.set(headRadius * 0.88, headOffsetY + 0.01, 0.0);
      headGroup.add(earL, earR);

      // Eyes (Clean white sclera and sharp pupil sitting cleanly on face front)
      const eyeMat = new THREE.MeshBasicMaterial({ color: eyeColor });
      const scleraMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const scleraGeo = new THREE.SphereGeometry(0.028, 8, 8);
      const eyeGeo = new THREE.SphereGeometry(0.018, 6, 6);

      const eyeSpread = isRigMed ? 0.065 : 0.050;
      const eyeY = headOffsetY + 0.02;
      const eyeZ = 0.198;

      const leftSclera = new THREE.Mesh(scleraGeo, scleraMat);
      leftSclera.position.set(-eyeSpread, eyeY, eyeZ);
      const leftPupil = new THREE.Mesh(eyeGeo, eyeMat);
      leftPupil.position.set(-eyeSpread, eyeY, eyeZ + 0.022);

      const rightSclera = new THREE.Mesh(scleraGeo, scleraMat);
      rightSclera.position.set(eyeSpread, eyeY, eyeZ);
      const rightPupil = new THREE.Mesh(eyeGeo, eyeMat);
      rightPupil.position.set(eyeSpread, eyeY, eyeZ + 0.022);

      headGroup.add(leftSclera, leftPupil, rightSclera, rightPupil);

      // Eyebrows (tinted in hair color, framing eyes)
      const browMat = new THREE.MeshStandardMaterial({ color: finalHair, roughness: 0.9 });
      const browGeo = new THREE.BoxGeometry(0.046, 0.014, 0.026);
      const browL = new THREE.Mesh(browGeo, browMat);
      browL.position.set(-eyeSpread, eyeY + 0.046, eyeZ - 0.005);
      browL.rotation.z = -0.12;
      const browR = new THREE.Mesh(browGeo, browMat);
      browR.position.set(eyeSpread, eyeY + 0.046, eyeZ - 0.005);
      browR.rotation.z = 0.12;
      headGroup.add(browL, browR);

      // Nose
      const noseGeo = new THREE.ConeGeometry(0.022, 0.048, 4);
      noseGeo.rotateX(Math.PI / 2);
      const nose = new THREE.Mesh(noseGeo, skinMat);
      nose.position.set(0, eyeY - 0.032, eyeZ + 0.015);
      headGroup.add(nose);

      // Subtle stylized mouth line
      const mouthMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(finalSkin).multiplyScalar(0.8),
        roughness: 0.8
      });
      const mouthGeo = new THREE.BoxGeometry(0.044, 0.012, 0.022);
      const mouth = new THREE.Mesh(mouthGeo, mouthMat);
      mouth.position.set(0, eyeY - 0.075, eyeZ - 0.01);
      headGroup.add(mouth);

      // Hair Styles – Carefully modeled caps that NEVER cover the face, eyes, or cheeks
      if (hairStyle !== 'bald') {
        const hairMat = new THREE.MeshStandardMaterial({
          color: finalHair,
          roughness: 0.75
        });

        // Scalp dome covering top and back of head only (thetaLength ensures it stays above the forehead)
        const capGeo = new THREE.SphereGeometry(headRadius * 1.03, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.44);
        capGeo.scale(0.92, 1.08, 0.96);
        const capMesh = new THREE.Mesh(capGeo, hairMat);
        capMesh.position.set(0, headOffsetY + 0.02, -0.025);
        capMesh.castShadow = true;
        headGroup.add(capMesh);

        // Nape/back of head coverage
        const napeGeo = new THREE.CylinderGeometry(headRadius * 0.88, headRadius * 0.80, 0.12, 10, 1, false, Math.PI * 0.65, Math.PI * 1.7);
        const napeMesh = new THREE.Mesh(napeGeo, hairMat);
        napeMesh.position.set(0, headOffsetY - 0.035, -0.055);
        headGroup.add(napeMesh);

        if (hairStyle === 'long') {
          // Flowing side locks framing cheeks without covering face
          const sideLockGeo = new THREE.BoxGeometry(0.038, 0.24, 0.08);
          const lockL = new THREE.Mesh(sideLockGeo, hairMat);
          lockL.position.set(-headRadius * 0.92, headOffsetY - 0.06, 0.02);
          const lockR = new THREE.Mesh(sideLockGeo, hairMat);
          lockR.position.set(headRadius * 0.92, headOffsetY - 0.06, 0.02);
          headGroup.add(lockL, lockR);

          // Flowing back mane down the shoulders
          const backManeGeo = new THREE.BoxGeometry(headRadius * 1.35, 0.32, 0.08);
          const backMane = new THREE.Mesh(backManeGeo, hairMat);
          backMane.position.set(0, headOffsetY - 0.12, -headRadius * 0.92);
          backMane.rotation.x = -0.15;
          headGroup.add(backMane);
        } else if (hairStyle === 'ponytail') {
          // High gathered warrior ponytail at back of head
          const knotGeo = new THREE.SphereGeometry(headRadius * 0.36, 8, 8);
          const knot = new THREE.Mesh(knotGeo, hairMat);
          knot.position.set(0, headOffsetY + 0.07, -headRadius * 0.96);

          const tailGeo = new THREE.CylinderGeometry(headRadius * 0.20, headRadius * 0.10, 0.30, 8);
          const tail = new THREE.Mesh(tailGeo, hairMat);
          tail.position.set(0, headOffsetY - 0.08, -headRadius * 1.15);
          tail.rotation.x = -0.32;
          headGroup.add(knot, tail);
        } else {
          // 'short' Viking trim: Stylish trimmed fringe at top of hairline (high above eyes)
          const fringeGeo = new THREE.BoxGeometry(headRadius * 0.72, 0.032, 0.045);
          fringeGeo.rotateX(0.22);
          const fringe = new THREE.Mesh(fringeGeo, hairMat);
          fringe.position.set(0, headOffsetY + 0.092, 0.145);
          headGroup.add(fringe);

          // Sideburns above/behind ears
          const sideburnGeo = new THREE.BoxGeometry(0.025, 0.075, 0.06);
          const sbL = new THREE.Mesh(sideburnGeo, hairMat);
          sbL.position.set(-headRadius * 0.88, headOffsetY + 0.015, -0.01);
          const sbR = new THREE.Mesh(sideburnGeo, hairMat);
          sbR.position.set(headRadius * 0.88, headOffsetY + 0.015, -0.01);
          headGroup.add(sbL, sbR);
        }
      }

      // Beard for male characters (Nordic trimmed goatee/beard under mouth along jawline)
      if (!isFemale && hairStyle !== 'bald') {
        const beardMat = new THREE.MeshStandardMaterial({ color: finalHair, roughness: 0.85 });
        const beardGeo = new THREE.BoxGeometry(headRadius * 0.52, 0.075, 0.065);
        beardGeo.rotateX(0.18);
        const beard = new THREE.Mesh(beardGeo, beardMat);
        beard.position.set(0, headOffsetY - 0.095, eyeZ - 0.05);
        headGroup.add(beard);
      }
    }

    headBone.add(headGroup);
  }

  createAnimatedCharacter(modelName, defaultAnimName = null, options = {}) {
    const model = this.get(modelName);
    if (!model) return null;

    const isFemale = modelName.toLowerCase().includes('female') || options.gender === 'female';
    const isHood = options.headStyle === 'hood' || modelName.includes('Hooded');
    const isSkeleton = modelName.toLowerCase().includes('skeleton');

    // Guarantee that character always has a complete customized head if using headless modular base or customizable adventurer
    const isOldHeadless = ['Male_Ranger', 'Female_Ranger', 'Male_Peasant', 'Female_Peasant', 'Mannequin_F'].includes(modelName);
    const isAdventurer = ['Barbarian', 'Knight', 'Mage', 'Ranger_Adv', 'Rogue', 'Rogue_Hooded'].includes(modelName);

    if (isAdventurer && !isSkeleton) {
      if (!isHood) {
        // Hide pre-baked static head/hat/helmet/cape meshes so custom dynamic head + hair renders cleanly on basic clothes
        model.traverse((child) => {
          if (child.isMesh) {
            const n = (child.name || '').toLowerCase();
            if (n.includes('head') || n.includes('bearhat') || n.includes('helmet') || n.includes('hat') || n.includes('mask') || n.includes('cape')) {
              child.visible = false;
            }
          }
        });
      } else {
        // Character wears hood: hide face masks so customized face is visible inside hood
        model.traverse((child) => {
          if (child.isMesh) {
            const n = (child.name || '').toLowerCase();
            if (n.includes('mask')) {
              child.visible = false;
            }
          }
        });
      }

      this.ensureHead(
        model,
        isFemale,
        options.eyeColor || 0x222222,
        options.skinColor || null,
        options.hairColor || null,
        options.hairStyle || 'short'
      );
    } else if (isOldHeadless) {
      this.ensureHead(
        model,
        isFemale,
        options.eyeColor || 0x222222,
        options.skinColor || null,
        options.hairColor || null,
        options.hairStyle || 'short'
      );
    }

    // Apply custom clothing tint if provided
    if (options.clothingColor) {
      model.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material = child.material.clone();
          const n = (child.name || '').toLowerCase();
          if (n.includes('body') || n.includes('legs') || n.includes('torso') || n.includes('arm') || n.includes('cape')) {
            if (child.material.color) {
              child.material.color.set(options.clothingColor);
            }
          }
        }
      });
    }

    const isRigMedium = [
      'Barbarian', 'Knight', 'Mage', 'Ranger_Adv', 'Rogue', 'Rogue_Hooded',
      'Skeleton_Warrior', 'Skeleton_Mage', 'Skeleton_Rogue', 'Skeleton_Minion'
    ].includes(modelName) || isSkeleton;

    const mixer = new THREE.AnimationMixer(model);
    const actions = {};

    if (isRigMedium) {
      // Rig_Medium characters ONLY bind Rig_Medium animation clips.
      // This completely prevents -90 deg root bone rotations and eliminates all DFS track search freezes!
      for (const [name, clip] of Object.entries(this.rigMediumAnimations)) {
        actions[name] = mixer.clipAction(clip);
      }

      // Bi-directional and legacy aliasing for Rig_Medium models
      if (actions['Idle_A']) {
        actions['Idle_No_Loop'] = actions['Idle_A'];
        actions['Zombie_Idle_Loop'] = actions['Idle_A'];
        actions['Idle_FoldArms_Loop'] = actions['Idle_A'];
        actions['Idle_Rail_Loop'] = actions['Idle_A'];
        actions['Idle_Shield_Loop'] = actions['Idle_A'];
        actions['Idle'] = actions['Idle_A'];
      }
      if (actions['Walking_A']) {
        actions['Walk_Natural_Loop'] = actions['Walking_A'];
        actions['Walk_Carry_Loop'] = actions['Walking_A'];
        actions['Zombie_Walk_Fwd_Loop'] = actions['Walking_A'];
        actions['Walk'] = actions['Walking_A'];
      }
      if (actions['Running_A']) {
        actions['Run_Sprint_Loop'] = actions['Running_A'];
        actions['Run'] = actions['Running_A'];
      }
      if (actions['Hit_A']) {
        actions['Hit_Knockback'] = actions['Hit_A'];
        actions['Hit'] = actions['Hit_A'];
      }
      if (actions['Death_A']) {
        actions['Death_Back'] = actions['Death_A'];
        actions['Death'] = actions['Death_A'];
      }
      if (actions['Jump_Start']) {
        actions['NinjaJump_Start'] = actions['Jump_Start'];
      }
      if (actions['Jump_Land']) {
        actions['NinjaJump_Land'] = actions['Jump_Land'];
      }
      if (actions['Jump_Idle']) {
        actions['NinjaJump_Idle_Loop'] = actions['Jump_Idle'];
      }
      if (actions['Use_Item']) {
        actions['Sword_Regular_A'] = actions['Use_Item'];
        actions['Sword_Regular_B'] = actions['Use_Item'];
        actions['Sword_Regular_C'] = actions['Use_Item'];
        actions['Sword_Heavy_Combo'] = actions['Use_Item'];
        actions['Sword_Regular_Combo'] = actions['Use_Item'];
        actions['Melee_Hook'] = actions['Use_Item'];
        actions['Melee_Hook_Rec'] = actions['Use_Item'];
        actions['Zombie_Scratch'] = actions['Use_Item'];
        actions['TreeChopping_Loop'] = actions['Use_Item'];
        actions['Interact'] = actions['Use_Item'];
        actions['Attack'] = actions['Use_Item'];
      }
      if (actions['Throw']) {
        actions['OverhandThrow'] = actions['Throw'];
      } else if (actions['Use_Item']) {
        actions['OverhandThrow'] = actions['Use_Item'];
      }

      // Default animation for Rig_Medium is Idle_A
      const defaultAction = (defaultAnimName && actions[defaultAnimName]) ? actions[defaultAnimName] : actions['Idle_A'];
      if (defaultAction) {
        defaultAction.play();
      }
    } else {
      // Legacy UAL2 models (Male_Ranger, Female_Ranger, Peasants, Mannequin)
      for (const [name, clip] of Object.entries(this.ual2Animations)) {
        actions[name] = mixer.clipAction(clip);
      }

      if (actions['Idle_No_Loop']) actions['Idle_A'] = actions['Idle_No_Loop'];
      if (actions['Walk_Natural_Loop']) actions['Walking_A'] = actions['Walk_Natural_Loop'];
      if (actions['Run_Sprint_Loop']) actions['Running_A'] = actions['Run_Sprint_Loop'];
      if (actions['Hit_Knockback']) actions['Hit_A'] = actions['Hit_Knockback'];
      if (actions['Death_Back']) actions['Death_A'] = actions['Death_Back'];
      if (actions['NinjaJump_Start']) actions['Jump_Start'] = actions['NinjaJump_Start'];
      if (actions['NinjaJump_Land']) actions['Jump_Land'] = actions['NinjaJump_Land'];
      if (actions['Sword_Regular_A']) actions['Use_Item'] = actions['Sword_Regular_A'];

      const defaultAction = (defaultAnimName && actions[defaultAnimName]) ? actions[defaultAnimName] : (actions['Idle_No_Loop'] || actions['Idle_A']);
      if (defaultAction) {
        defaultAction.play();
      }
    }

    return { model, mixer, actions, isRigMedium };
  }
}
