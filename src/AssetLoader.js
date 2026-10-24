import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

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
    const pct = this.total > 0 ? Math.round((this.loaded / this.total) * 100) : 100;
    if (loadingBar) {
      loadingBar.style.width = `${pct}%`;
    }
    if (loadingText) {
      loadingText.textContent = `Ladataan maailmaa: ${currentName || 'assetit'}... (${pct}%)`;
    }
  }

  async loadModel(name, url) {
    return new Promise((resolve) => {
      this.loader.load(
        url,
        (gltf) => {
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
          this.loaded++;
          this.updateProgress(name);
          resolve(model);
        },
        undefined,
        (err) => {
          console.warn(`[AssetLoader] Could not load model ${name} (${url}):`, err);
          this.loaded++;
          this.updateProgress(name);
          resolve(null);
        }
      );
    });
  }

  async loadOBJ(name, objUrl, mtlUrl) {
    return new Promise((resolve) => {
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
          materials.preload();
          const objLoader = new OBJLoader();
          objLoader.setMaterials(materials);
          objLoader.load(
            objUrl,
            (obj) => {
              obj.traverse((child) => {
                if (child.isMesh) {
                  child.castShadow = true;
                  child.receiveShadow = true;
                }
              });
              this.models[name] = obj;
              this.loaded++;
              this.updateProgress(name);
              resolve(obj);
            },
            undefined,
            (err) => {
              console.warn(`[AssetLoader] Could not load OBJ ${name}:`, err);
              this.loaded++;
              this.updateProgress(name);
              resolve(null);
            }
          );
        },
        undefined,
        (err) => {
          console.warn(`[AssetLoader] Could not load MTL for ${name}:`, err);
          this.loaded++;
          this.updateProgress(name);
          resolve(null);
        }
      );
    });
  }

  async loadAnimations(url, rigType = 'auto') {
    const isRigMedium = (rigType === 'rigMedium') || url.includes('Rig_Medium');
    return new Promise((resolve) => {
      this.loader.load(
        url,
        (gltf) => {
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
          this.loaded++;
          this.updateProgress('animaatiot');
          resolve(gltf.animations);
        },
        undefined,
        (err) => {
          console.warn('[AssetLoader] Failed to load animations from', url, err);
          this.loaded++;
          this.updateProgress('animaatiot');
          resolve([]);
        }
      );
    });
  }

  async loadTexture(name, url, wrap = true, repeatX = 1, repeatY = 1) {
    return new Promise((resolve) => {
      this.texLoader.load(
        url,
        (tex) => {
          if (wrap) {
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(repeatX, repeatY);
          }
          tex.colorSpace = THREE.SRGBColorSpace;
          this.textures[name] = tex;
          this.loaded++;
          this.updateProgress(name);
          resolve(tex);
        },
        undefined,
        (err) => {
          console.warn(`[AssetLoader] Texture load error ${name}:`, err);
          this.loaded++;
          this.updateProgress(name);
          resolve(null);
        }
      );
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
      { name: 'WindowShutters_Wide_Flat_Open', url: '/assets/village/WindowShutters_Wide_Flat_Open.gltf' },
      { name: 'Floor_WoodDark', url: '/assets/village/Floor_WoodDark.gltf' },
      { name: 'Floor_Brick', url: '/assets/village/Floor_Brick.gltf' },
      { name: 'Prop_Wagon', url: '/assets/village/Prop_Wagon.gltf' },
      { name: 'Prop_WoodenFence_Single', url: '/assets/village/Prop_WoodenFence_Single.gltf' },
      { name: 'Prop_WoodenFence_Extension1', url: '/assets/village/Prop_WoodenFence_Extension1.gltf' },
      { name: 'Prop_Crate', url: '/assets/village/Prop_Crate.gltf' },
      { name: 'Prop_Chimney', url: '/assets/village/Prop_Chimney.gltf' },
      { name: 'Stairs_Exterior_Straight', url: '/assets/village/Stairs_Exterior_Straight.gltf' }
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

    this.total = modelManifest.length + textureManifest.length + objManifest.length + 2;
    this.loaded = 0;
    this.updateProgress('aloitetaan');

    const modelPromises = modelManifest.map(m => this.loadModel(m.name, m.url));
    const objPromises = objManifest.map(o => this.loadOBJ(o.name, o.obj, o.mtl));
    const texPromises = textureManifest.map(t => this.loadTexture(t.name, t.url, t.wrap, t.rx, t.ry));
    const rigGeneralPromise = this.loadAnimations('/assets/KayKit_Adventurers_2.0_FREE/KayKit_Adventurers_2.0_FREE/Animations/gltf/Rig_Medium/Rig_Medium_General.glb', 'rigMedium');
    const rigMovementPromise = this.loadAnimations('/assets/KayKit_Adventurers_2.0_FREE/KayKit_Adventurers_2.0_FREE/Animations/gltf/Rig_Medium/Rig_Medium_MovementBasic.glb', 'rigMedium');

    await Promise.all([...modelPromises, ...objPromises, ...texPromises, rigGeneralPromise, rigMovementPromise]);
    this.updateProgress('Valmis!');
    return this;
  }

  get(name) {
    if (!this.models[name]) return null;
    let hasSkinnedMesh = false;
    this.models[name].traverse((c) => {
      if (c.isSkinnedMesh) hasSkinnedMesh = true;
    });

    const clone = hasSkinnedMesh
      ? SkeletonUtils.clone(this.models[name])
      : this.models[name].clone(true);

    clone.traverse((child) => {
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
    characterModel.traverse((child) => {
      if (child.isMesh && child.name.toLowerCase().includes('hood')) {
        hasHood = true;
      }
    });

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
      const faceGeo = new THREE.SphereGeometry(0.14, 12, 10);
      faceGeo.scale(0.85, 1.05, 0.95);
      const faceMesh = new THREE.Mesh(faceGeo, skinMat);
      faceMesh.position.set(0, 0.06, 0.02);
      faceMesh.castShadow = true;
      faceMesh.receiveShadow = true;
      headGroup.add(faceMesh);

      // Sclera (eyewhite) + Iris/pupil
      const scleraMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const eyeMat = new THREE.MeshBasicMaterial({ color: eyeColor });

      const scleraGeo = new THREE.SphereGeometry(0.025, 8, 8);
      const pupilGeo = new THREE.SphereGeometry(0.015, 6, 6);

      // Left eye
      const leftSclera = new THREE.Mesh(scleraGeo, scleraMat);
      leftSclera.position.set(-0.045, 0.08, 0.12);
      const leftPupil = new THREE.Mesh(pupilGeo, eyeMat);
      leftPupil.position.set(-0.045, 0.08, 0.138);
      headGroup.add(leftSclera, leftPupil);

      // Right eye
      const rightSclera = new THREE.Mesh(scleraGeo, scleraMat);
      rightSclera.position.set(0.045, 0.08, 0.12);
      const rightPupil = new THREE.Mesh(pupilGeo, eyeMat);
      rightPupil.position.set(0.045, 0.08, 0.138);
      headGroup.add(rightSclera, rightPupil);

      // Eyebrows
      const browMat = new THREE.MeshBasicMaterial({ color: isFemale ? 0x4a2e18 : 0x2e1d0f });
      const browGeo = new THREE.BoxGeometry(0.038, 0.009, 0.012);
      const leftBrow = new THREE.Mesh(browGeo, browMat);
      leftBrow.position.set(-0.045, 0.11, 0.125);
      leftBrow.rotation.z = -0.08;
      const rightBrow = new THREE.Mesh(browGeo, browMat);
      rightBrow.position.set(0.045, 0.11, 0.125);
      rightBrow.rotation.z = 0.08;
      headGroup.add(leftBrow, rightBrow);

      // Nose
      const noseGeo = new THREE.ConeGeometry(0.02, 0.045, 4);
      noseGeo.rotateX(Math.PI / 2);
      const nose = new THREE.Mesh(noseGeo, skinMat);
      nose.position.set(0, 0.055, 0.145);
      headGroup.add(nose);

      // Beard for male ranger
      if (!isFemale) {
        const beardGeo = new THREE.BoxGeometry(0.08, 0.06, 0.05);
        const beardMat = new THREE.MeshStandardMaterial({ color: finalHair, roughness: 0.8 });
        const beard = new THREE.Mesh(beardGeo, beardMat);
        beard.position.set(0, 0.0, 0.11);
        headGroup.add(beard);
      }
    } else {
      // 2. Character has no hood (Peasant): Build full head with hair/cap
      const headGeo = new THREE.SphereGeometry(0.165, 12, 10);
      headGeo.scale(0.85, 1.05, 0.95);
      const headMesh = new THREE.Mesh(headGeo, skinMat);
      headMesh.position.set(0, 0.06, 0.01);
      headMesh.castShadow = true;
      headMesh.receiveShadow = true;
      headGroup.add(headMesh);

      // Eyes
      const eyeMat = new THREE.MeshBasicMaterial({ color: eyeColor });
      const scleraMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const eyeGeo = new THREE.SphereGeometry(0.022, 6, 6);
      const scleraGeo = new THREE.SphereGeometry(0.028, 6, 6);

      const leftSclera = new THREE.Mesh(scleraGeo, scleraMat);
      leftSclera.position.set(-0.048, 0.075, 0.13);
      const leftPupil = new THREE.Mesh(eyeGeo, eyeMat);
      leftPupil.position.set(-0.048, 0.075, 0.148);

      const rightSclera = new THREE.Mesh(scleraGeo, scleraMat);
      rightSclera.position.set(0.048, 0.075, 0.13);
      const rightPupil = new THREE.Mesh(eyeGeo, eyeMat);
      rightPupil.position.set(0.048, 0.075, 0.148);

      headGroup.add(leftSclera, leftPupil, rightSclera, rightPupil);

      // Nose
      const noseGeo = new THREE.ConeGeometry(0.022, 0.05, 4);
      noseGeo.rotateX(Math.PI / 2);
      const nose = new THREE.Mesh(noseGeo, skinMat);
      nose.position.set(0, 0.05, 0.155);
      headGroup.add(nose);

      // Hair Styles
      if (hairStyle !== 'bald') {
        const hairMat = new THREE.MeshStandardMaterial({
          color: finalHair,
          roughness: 0.8
        });

        if (hairStyle === 'long') {
          const hairGeo = new THREE.SphereGeometry(0.185, 12, 10);
          hairGeo.scale(0.98, 1.25, 1.15);
          const hair = new THREE.Mesh(hairGeo, hairMat);
          hair.position.set(0, 0.07, -0.03);
          hair.castShadow = true;
          headGroup.add(hair);

          const tailGeo = new THREE.CylinderGeometry(0.08, 0.04, 0.28, 8);
          const tail = new THREE.Mesh(tailGeo, hairMat);
          tail.position.set(0, -0.06, -0.14);
          tail.rotation.x = 0.2;
          headGroup.add(tail);
        } else if (hairStyle === 'ponytail') {
          const hairGeo = new THREE.SphereGeometry(0.18, 12, 10);
          hairGeo.scale(0.96, 1.1, 1.05);
          const hair = new THREE.Mesh(hairGeo, hairMat);
          hair.position.set(0, 0.09, -0.01);
          headGroup.add(hair);

          const knotGeo = new THREE.SphereGeometry(0.06, 8, 8);
          const knot = new THREE.Mesh(knotGeo, hairMat);
          knot.position.set(0, 0.10, -0.18);
          const pTailGeo = new THREE.CylinderGeometry(0.04, 0.02, 0.22, 6);
          const pTail = new THREE.Mesh(pTailGeo, hairMat);
          pTail.position.set(0, -0.02, -0.21);
          pTail.rotation.x = -0.25;
          headGroup.add(knot, pTail);
        } else {
          // 'short' Viking trim
          const hairGeo = new THREE.SphereGeometry(0.18, 12, 10);
          hairGeo.scale(0.96, 1.12, 1.05);
          const hair = new THREE.Mesh(hairGeo, hairMat);
          hair.position.set(0, 0.09, -0.01);
          hair.castShadow = true;
          headGroup.add(hair);
        }
      }

      // Beard for male peasant
      if (!isFemale && hairStyle !== 'bald') {
        const beardGeo = new THREE.BoxGeometry(0.075, 0.05, 0.045);
        const beardMat = new THREE.MeshStandardMaterial({ color: finalHair, roughness: 0.85 });
        const beard = new THREE.Mesh(beardGeo, beardMat);
        beard.position.set(0, -0.01, 0.125);
        headGroup.add(beard);
      }
    }

    headBone.add(headGroup);
  }

  createAnimatedCharacter(modelName, defaultAnimName = null, options = {}) {
    const model = this.get(modelName);
    if (!model) return null;

    const isFemale = modelName.toLowerCase().includes('female');

    // Guarantee that character always has a complete customized head if using headless modular base
    const isOldHeadless = ['Male_Ranger', 'Female_Ranger', 'Male_Peasant', 'Female_Peasant', 'Mannequin_F'].includes(modelName);
    if (isOldHeadless) {
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
          if (n.includes('body') || n.includes('legs') || n.includes('torso') || n.includes('arm')) {
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
    ].includes(modelName) || modelName.toLowerCase().includes('skeleton');

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
