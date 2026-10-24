import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

/**
 * RagdollManager – Physical ragdoll collapse, tumbling physics, and lingering corpses.
 * When enemies or the player die, this handles:
 * 1. Disabling animation rig constraints.
 * 2. Applying directional impact impulse and angular tumble velocities.
 * 3. Simulating gravity, air drag, and terrain collision against world ground height.
 * 4. Realistic ground bounce, sliding friction, and limb bone relaxation / flopping.
 * 5. Lingering corpse settling with gradual dissolve & memory-safe resource disposal.
 */
export default class RagdollManager {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.ragdolls = [];
  }

  /**
   * Spawns a physical ragdoll from a dying character mesh (enemy or player)
   * @param {THREE.Object3D} sourceModel 
   * @param {THREE.Vector3} hitDirection - Direction of the fatal blow
   * @param {number} impactForce - Strength of knockback impulse
   * @param {boolean} isPlayer - Whether this is the player's ragdoll
   */
  spawnRagdoll(sourceModel, hitDirection = null, impactForce = 1.0, isPlayer = false) {
    if (!sourceModel) return null;

    try {
      // Use SkeletonUtils to completely clone skinned mesh and all attached sub-nodes (including dynamic head/hair)
      const ragdoll = SkeletonUtils.clone(sourceModel);
      ragdoll.position.copy(sourceModel.position);
      ragdoll.quaternion.copy(sourceModel.quaternion);

      // Stop any animation mixers from overriding bone positions
      ragdoll.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          // Ensure material is cloned so dissolve fade does not affect living characters
          if (child.material) {
            child.material = Array.isArray(child.material)
              ? child.material.map(m => m.clone())
              : child.material.clone();
            child.material.transparent = true;
          }
        }
      });

      // Find key bones for procedural flopping
      const bones = {};
      ragdoll.traverse((child) => {
        if (child.isBone) {
          const n = (child.name || '').toLowerCase();
          if (n.includes('head')) bones.head = child;
          else if (n.includes('spine')) bones.spine = child;
          else if (n.includes('arml') || n.includes('leftarm')) bones.armL = child;
          else if (n.includes('armr') || n.includes('rightarm')) bones.armR = child;
          else if (n.includes('legl') || n.includes('leftleg')) bones.legL = child;
          else if (n.includes('legr') || n.includes('rightleg')) bones.legR = child;
        }
      });

      // Calculate initial velocities from fatal blow: realistic limp collapse onto ground
      const dir = hitDirection ? hitDirection.clone().normalize() : new THREE.Vector3(
        (Math.random() - 0.5) * 0.6,
        0,
        (Math.random() - 0.5) * 0.6
      ).normalize();

      const pushSpeed = Math.min(2.4, 1.2 * impactForce);
      const upwardPop = 0.15; // Natural collapse without flying into the sky

      const velocity = new THREE.Vector3(
        dir.x * pushSpeed,
        upwardPop,
        dir.z * pushSpeed
      );

      // Gentle limp tumble angular velocity
      const angularVel = new THREE.Vector3(
        (Math.random() - 0.5) * 2.5,
        (Math.random() - 0.5) * 1.5,
        (Math.random() - 0.5) * 2.5
      );

      this.scene.add(ragdoll);

      const corpseData = {
        mesh: ragdoll,
        velocity,
        angularVel,
        bones,
        isGrounded: false,
        settled: false,
        settleTimer: 0,
        lifeTime: 0,
        maxLife: isPlayer ? 9999 : 14.0, // Lingers limp on ground for 14s before dissolving
        fadeDuration: 3.5,
        isPlayer
      };

      this.ragdolls.push(corpseData);
      return corpseData;
    } catch (err) {
      console.warn('[RagdollManager] spawnRagdoll notice:', err);
      return null;
    }
  }

  update(delta) {
    if (this.ragdolls.length === 0) return;

    for (let i = this.ragdolls.length - 1; i >= 0; i--) {
      const rd = this.ragdolls[i];
      rd.lifeTime += delta;

      if (!rd.settled) {
        // 1. Apply gravity & air drag
        rd.velocity.y -= 22.0 * delta;
        rd.velocity.x *= 0.985;
        rd.velocity.z *= 0.985;

        // 2. Translate position
        rd.mesh.position.addScaledVector(rd.velocity, delta);

        // 3. Tumble rotation
        rd.mesh.rotation.x += rd.angularVel.x * delta;
        rd.mesh.rotation.y += rd.angularVel.y * delta;
        rd.mesh.rotation.z += rd.angularVel.z * delta;

        // 4. Ground collision with terrain
        const groundY = this.world ? this.world.getGroundHeight(rd.mesh.position.x, rd.mesh.position.z) : 0;
        const floorHeight = Math.max(groundY, -0.65) + 0.18;

        if (rd.mesh.position.y <= floorHeight) {
          rd.mesh.position.y = floorHeight;

          // Ground bounce & friction
          if (Math.abs(rd.velocity.y) > 1.2) {
            rd.velocity.y = -rd.velocity.y * 0.35; // bounce
            rd.velocity.x *= 0.65;
            rd.velocity.z *= 0.65;
            rd.angularVel.multiplyScalar(0.6);
          } else {
            rd.velocity.set(0, 0, 0);
            rd.angularVel.set(0, 0, 0);
            rd.isGrounded = true;
          }

          // Procedural limb bone relaxation on impact
          if (rd.bones) {
            if (rd.bones.head) rd.bones.head.rotation.x = 0.45;
            if (rd.bones.spine) rd.bones.spine.rotation.x = -0.25;
            if (rd.bones.armL) rd.bones.armL.rotation.z = 0.75;
            if (rd.bones.armR) rd.bones.armR.rotation.z = -0.75;
            if (rd.bones.legL) rd.bones.legL.rotation.x = 0.35;
            if (rd.bones.legR) rd.bones.legR.rotation.x = 0.25;
          }

          // Orient corpse onto its back/side naturally
          rd.mesh.rotation.x = THREE.MathUtils.lerp(rd.mesh.rotation.x, Math.PI / 2, delta * 5.0);
          rd.mesh.rotation.z = THREE.MathUtils.lerp(rd.mesh.rotation.z, (Math.random() - 0.5) * 0.4, delta * 3.0);
        }

        // Check if settled
        if (rd.isGrounded && rd.velocity.lengthSq() < 0.05) {
          rd.settleTimer += delta;
          if (rd.settleTimer > 0.4) {
            rd.settled = true;
          }
        }
      }

      // Fade out, sink into ground, and cleanup for non-player corpses
      if (!rd.isPlayer && rd.lifeTime >= rd.maxLife - rd.fadeDuration) {
        const remaining = rd.maxLife - rd.lifeTime;
        const progress = Math.max(0, Math.min(1, remaining / rd.fadeDuration));

        // Slowly sink into the earth as spirit departs
        rd.mesh.position.y -= delta * 0.05;

        rd.mesh.traverse((child) => {
          if (child.isMesh && child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.opacity = progress);
            } else {
              child.material.opacity = progress;
            }
          }
        });
      }

      // Final removal & GPU buffer disposal
      if (!rd.isPlayer && rd.lifeTime >= rd.maxLife) {
        this.disposeRagdoll(rd);
        this.ragdolls.splice(i, 1);
      }
    }
  }

  /**
   * Removes and cleans up a specific ragdoll (e.g. on player respawn)
   */
  removePlayerRagdoll() {
    for (let i = this.ragdolls.length - 1; i >= 0; i--) {
      if (this.ragdolls[i].isPlayer) {
        this.disposeRagdoll(this.ragdolls[i]);
        this.ragdolls.splice(i, 1);
      }
    }
  }

  /**
   * Memory-safe GPU buffer disposal for materials (preserves shared geometries for living characters)
   */
  disposeRagdoll(rd) {
    if (!rd || !rd.mesh) return;
    this.scene.remove(rd.mesh);

    rd.mesh.traverse((child) => {
      if (child.isMesh) {
        // Only dispose cloned materials, NEVER shared geometries!
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m && m.dispose && m.dispose());
          } else if (child.material.dispose) {
            child.material.dispose();
          }
        }
      }
    });
  }

  clearAll() {
    for (const rd of this.ragdolls) {
      this.disposeRagdoll(rd);
    }
    this.ragdolls = [];
  }
}
