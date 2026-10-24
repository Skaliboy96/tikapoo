import * as THREE from 'three';

export default class ResourceNode {
  constructor(scene, world, inventory, hud, player, audioManager, questManager) {
    this.scene = scene;
    this.world = world;
    this.inventory = inventory;
    this.hud = hud;
    this.player = player;
    this.audioManager = audioManager;
    this.questManager = questManager;

    this.raycaster = new THREE.Raycaster();
    this.screenCenter = new THREE.Vector2(0, 0); // Center of screen in NDC
    this.interactDistance = 4.2;
    this.harvestHoldTime = 2.4; // Slower, heavier harvesting (requires holding LMB)

    this.currentlyHolding = false;
    this.holdTimer = 0;
    this.swingSoundTimer = 0;
    this.targetNode = null;
    this.isMouseDown = false;
    this.fallingTrees = [];
    this.shatteredDebris = [];

    this.setupListeners();
  }

  setupListeners() {
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) { // Left click
        this.isMouseDown = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.isMouseDown = false;
        this.holdTimer = 0;
        this.swingSoundTimer = 0;
        if (this.player && this.player.isHarvesting) {
          this.player.isHarvesting = false;
          this.player.playAnimation('Idle_No_Loop');
        }
        if (this.hud) {
          this.hud.setHarvestProgress(0);
        }
      }
    });
  }

  getInteractableMeshes() {
    const meshes = [];
    if (!this.world) return meshes;

    if (this.world.trees) {
      for (const t of this.world.trees) {
        if (!t.harvested && t.mesh && t.mesh.visible) {
          meshes.push(t.mesh);
        }
      }
    }
    if (this.world.stones) {
      for (const s of this.world.stones) {
        if (!s.harvested && s.mesh && s.mesh.visible) {
          meshes.push(s.mesh);
        }
      }
    }
    if (this.world.ores) {
      for (const o of this.world.ores) {
        if (!o.harvested && o.mesh && o.mesh.visible) {
          meshes.push(o.mesh);
        }
      }
    }
    if (this.world.bushes) {
      for (const b of this.world.bushes) {
        if (!b.harvested && b.mesh && b.mesh.visible) {
          meshes.push(b.mesh);
        }
      }
    }
    if (this.world.wheatNodes) {
      for (const w of this.world.wheatNodes) {
        if (!w.harvested && w.mesh && w.mesh.visible) {
          meshes.push(w.mesh);
        }
      }
    }
    if (this.world.mossyWoodNodes) {
      for (const m of this.world.mossyWoodNodes) {
        if (!m.harvested && m.mesh && m.mesh.visible) {
          meshes.push(m.mesh);
        }
      }
    }
    if (this.world.mushrooms) {
      for (const m of this.world.mushrooms) {
        if (!m.harvested && m.mesh && m.mesh.visible) {
          meshes.push(m.mesh);
        }
      }
    }
    return meshes;
  }

  canHarvestNode(node) {
    if (!node) return { allowed: false, message: '' };
    const inv = this.inventory;
    const equipped = inv ? inv.equippedTool : null;

    const isAxe = equipped === 'stoneAxe' || equipped === 'bronzeAxe' || equipped === 'ironAxe' || equipped === 'blackMetalAxe';
    const isPickaxe = equipped === 'pickaxe' || equipped === 'antlerPickaxe' || equipped === 'bronzePickaxe' || equipped === 'ironPickaxe' || equipped === 'silverPickaxe';

    // 1. Trees require an AXE (Pickaxes cannot chop wood!)
    if (node.type === 'tree') {
      if (isPickaxe) {
        return { allowed: false, message: 'Hakulla ei voi hakata puuta! Tarvitset kirveen.' };
      }
      if (!isAxe) {
        return { allowed: false, message: 'Tarvitset kirveen puiden kaatamiseen!' };
      }
      return { allowed: true };
    }

    // 2. Stones and Ores require a PICKAXE (Axes cannot mine stone!)
    if (node.type === 'stone' || node.type === 'ore') {
      if (node.isLooseStone || (node.name && node.name.includes('Irtokivi'))) {
        return { allowed: true };
      }
      if (isAxe) {
        return { allowed: false, message: 'Kirveellä ei voi louhia kiveä! Tarvitset hakun.' };
      }
      if (!isPickaxe) {
        return { allowed: false, message: 'Tarvitset hakun kiven louhimiseen!' };
      }
      if (node.type === 'ore') {
        const canMine = this.canMineOre(node);
        if (!canMine) {
          const reqTier = this.getNodeTier(node);
          let tierMsg = 'Vaatii vahvemman hakun!';
          if (reqTier === 2) tierMsg = 'Perushakku ei pysty malmiin! Vaatii Sarvihakun (Valmista 1. bossin sarvista)';
          else if (reqTier === 3) tierMsg = 'Vaatii vähintään Pronssihakun tai Suoavaimen!';
          else if (reqTier === 4) tierMsg = 'Vaatii vähintään Rautahakun!';
          else if (reqTier >= 5) tierMsg = 'Vaatii vähintään Vuoristohakun (Hopeahakku)!';
          return { allowed: false, message: node.requiredMsg || tierMsg };
        }
      }
      return { allowed: true };
    }

    // 3. Ground bushes, wheat, and loose mossy branches on ground can be collected by hand
    return { allowed: true };
  }

  getPickaxeTier() {
    const inv = this.inventory;
    if (!inv) return 0;
    const tools = inv.tools || {};
    if (tools.silverPickaxe) return 5;
    if (tools.ironPickaxe) return 4;
    if (tools.bronzePickaxe) return 3;
    if (tools.antlerPickaxe) return 2;
    if (tools.pickaxe) return 1;
    return 0;
  }

  getNodeTier(node) {
    if (!node || node.type !== 'ore') return 1; // Basic stone is Tier 1
    if (node.minTool === 'antlerPickaxe') return 2; // Copper & Tin Ore (Tier 2)
    if (node.minTool === 'swampKey' || node.oreItem === 'ironOre') return 3; // Iron Ore (Tier 3)
    if (node.minTool === 'wishbone' || node.oreItem === 'silverOre') return 4; // Silver Ore (Tier 4)
    if (node.minTool === 'artisanCore' || node.oreItem === 'blackMetalScrap') return 5; // Black Metal (Tier 5)
    if (node.minTool === 'dragonTears' || node.oreItem === 'flametalOre') return 5; // Flametal (Tier 5)
    return 2;
  }

  canMineOre(node) {
    if (!node || node.type !== 'ore') return true;
    const inv = this.inventory;
    if (!inv) return true;

    const playerTier = this.getPickaxeTier();
    const reqTier = this.getNodeTier(node);

    // Basic stone pickaxe (Tier 1) can ONLY mine rocks, never ores!
    if (playerTier < 2) {
      return false;
    }

    if (reqTier === 2) {
      return playerTier >= 2;
    }
    if (reqTier === 3) {
      return playerTier >= 3 || inv.has('swampKey', 1);
    }
    if (reqTier === 4) {
      return playerTier >= 4 || inv.has('wishbone', 1);
    }
    if (reqTier >= 5) {
      return playerTier >= 5 || inv.has('artisanCore', 1) || inv.has('dragonTears', 1);
    }
    return true;
  }

  update(delta, camera, controlsLocked = true) {
    this._updateFallingTrees(delta);
    this._updateShatteredDebris(delta);

    if (!controlsLocked) {
      this.isMouseDown = false;
      this.holdTimer = 0;
      this.targetNode = null;
      if (this.player && this.player.isHarvesting) {
        this.player.isHarvesting = false;
        this.player.playAnimation('Idle_No_Loop');
      }
      if (this.hud) {
        this.hud.hideTooltip();
        this.hud.setHarvestProgress(0);
      }
      return;
    }

    // Raycast forward from camera center
    this.raycaster.setFromCamera(this.screenCenter, camera);
    const candidateMeshes = this.getInteractableMeshes();
    const hits = this.raycaster.intersectObjects(candidateMeshes, true);

    let activeNode = null;

    if (hits.length > 0) {
      const firstHit = hits[0];
      const pPos = this.player ? this.player.getPosition() : camera.position;
      const distFromPlayer = pPos.distanceTo(firstHit.point);
      if (distFromPlayer <= this.interactDistance + 1.2) {
        let obj = firstHit.object;
        while (obj) {
          if (obj.userData && obj.userData.resourceNode) {
            activeNode = obj.userData.resourceNode;
            break;
          }
          obj = obj.parent;
        }
      }
    }

    if (activeNode && !activeNode.harvested) {
      this.targetNode = activeNode;
      const nodeName = activeNode.name || (activeNode.type === 'tree' ? 'Puu' :
                                           activeNode.type === 'stone' ? 'Kivi' :
                                           activeNode.type === 'ore' ? 'Malmisuoni' :
                                           activeNode.type === 'wheat' ? 'Vilja' :
                                           activeNode.type === 'mushroom' ? 'Sieni' : 'Marjapensas');
      
      const check = this.canHarvestNode(activeNode);
      const isQuickGather = activeNode.isLooseStone || (activeNode.name && activeNode.name.includes('Irtokivi')) || activeNode.type === 'bush' || activeNode.type === 'wheat' || activeNode.type === 'mossyWood' || activeNode.type === 'mushroom';
      const requiredHoldTime = isQuickGather ? 0.6 : this.harvestHoldTime;

      if (this.hud) {
        if (!check.allowed) {
          this.hud.showTooltip(`🔒 ${nodeName}: ${check.message}`);
        } else {
          this.hud.showTooltip(`[Pidä hiirtä pohjassa] ${isQuickGather ? 'Poimi' : (activeNode.type === 'tree' ? 'Kaada' : 'Louhi')}: ${nodeName}`);
        }
      }

      if (this.isMouseDown) {
        if (!check.allowed) {
          if (this.hud && Math.random() < 0.05) {
            this.hud.showNotification(`⚠️ ${check.message}`);
          }
          this.holdTimer = 0;
          if (this.player && this.player.isHarvesting) {
            this.player.isHarvesting = false;
            this.player.playAnimation('Idle_No_Loop');
          }
          return;
        }

        // Trigger continuous harvesting animation
        if (this.player) {
          this.player.isHarvesting = true;
          if (activeNode.type === 'tree') {
            this.player.playAnimation('TreeChopping_Loop');
          } else if (activeNode.type === 'stone' || activeNode.type === 'ore') {
            this.player.playAnimation('Sword_Heavy_Combo');
          } else {
            this.player.playAnimation('Farm_Harvest');
          }
        }

        // Periodic strike sounds while holding LMB
        this.swingSoundTimer += delta;
        if (this.swingSoundTimer >= 0.72) {
          this.swingSoundTimer = 0;
          if (this.audioManager) {
            if (activeNode.type === 'tree') this.audioManager.playChop();
            else if (activeNode.type === 'stone' || activeNode.type === 'ore') this.audioManager.playMine();
            else this.audioManager.playHarvest('bush');
          }
        }

        this.holdTimer += delta;
        const progress = Math.min(1, this.holdTimer / requiredHoldTime);
        if (this.hud) {
          const actionText = activeNode.type === 'tree' ? 'Kaadetaan puuta' : (activeNode.type === 'stone' || activeNode.type === 'ore' ? 'Louhitaan kiveä' : (activeNode.type === 'mushroom' ? 'Poimitaan sieniä' : 'Kerätään'));
          this.hud.setHarvestProgress(progress, `${actionText}: ${nodeName}...`);
        }

        if (this.holdTimer >= requiredHoldTime) {
          this.harvest(this.targetNode);
          this.holdTimer = 0;
          this.swingSoundTimer = 0;
          if (this.player) {
            this.player.isHarvesting = false;
            this.player.playAnimation('Idle_No_Loop');
          }
          if (this.hud) {
            this.hud.setHarvestProgress(0);
          }
        }
      } else {
        this.holdTimer = 0;
        this.swingSoundTimer = 0;
        if (this.player && this.player.isHarvesting) {
          this.player.isHarvesting = false;
          this.player.playAnimation('Idle_No_Loop');
        }
        if (this.hud) {
          this.hud.setHarvestProgress(0);
        }
      }
    } else {
      // Not targeting any active node
      if (this.targetNode) {
        this.targetNode = null;
        this.holdTimer = 0;
        this.swingSoundTimer = 0;
        if (this.player && this.player.isHarvesting) {
          this.player.isHarvesting = false;
          this.player.playAnimation('Idle_No_Loop');
        }
        if (this.hud) {
          this.hud.hideTooltip();
          this.hud.setHarvestProgress(0);
        }
      }
    }
  }

  harvest(node) {
    if (!node || node.harvested) return;

    node.harvested = true;
    node.mesh.visible = false;

    let yieldCount = 0;

    if (node.type === 'ore') {
      yieldCount = Math.floor(Math.random() * 3) + 2; // 2 to 4
      this.inventory.add(node.oreItem, yieldCount);
      const itemName = this.inventory.getItemName ? this.inventory.getItemName(node.oreItem) : node.name;
      if (this.hud) {
        this.hud.showPickupText(`+${yieldCount} ${itemName}`);
      }
      if (this.audioManager) {
        if (this.audioManager.playRockShatter) this.audioManager.playRockShatter();
        else this.audioManager.playMine();
      }
      const pos = node.position || (node.mesh ? node.mesh.position : null);
      if (pos) this._spawnRockShatterParticles(pos, true);

      if (this.questManager) this.questManager.onCollect('stone', yieldCount);
      if (this.achievementManager) this.achievementManager.onMine(1);
      if (this.player) this.player.addXP(25);
    } else if (node.type === 'tree') {
      // 🌲 Valheim-style Falling Tree Physics Effect
      if (node.mesh) {
        const treeClone = node.mesh.clone(true);
        treeClone.visible = true;
        this.scene.add(treeClone);

        const pPos = this.player ? (this.player.getPosition ? this.player.getPosition() : this.player.playerPos) : null;
        let fallDir = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
        if (pPos && node.position) {
          fallDir = new THREE.Vector3(node.position.x - pPos.x, 0, node.position.z - pPos.z);
          if (fallDir.lengthSq() > 0.01) fallDir.normalize();
          else fallDir.set(1, 0, 0);
        }

        const pitchAxis = new THREE.Vector3(-fallDir.z, 0, fallDir.x).normalize();

        this.fallingTrees.push({
          mesh: treeClone,
          origPos: (node.position || node.mesh.position).clone(),
          fallDir: fallDir,
          pitchAxis: pitchAxis,
          angle: 0,
          angularVel: 0.45,
          timer: 0,
          hasCrashed: false
        });
      }

      yieldCount = Math.floor(Math.random() * 3) + 3; // 3 to 5
      this.inventory.add('wood', yieldCount);
      if (Math.random() < 0.4) {
        this.inventory.add('resin', 1);
        if (this.hud) this.hud.showPickupText('+1 Pihka (Havupuu-hartsi)');
      }
      if (this.hud) {
        this.hud.showPickupText(`+${yieldCount} ${node.name || 'Puuta'}`);
      }
      if (this.audioManager) this.audioManager.playChop();
      if (this.questManager) this.questManager.onCollect('wood', yieldCount);
      if (this.achievementManager) this.achievementManager.onChop(1);
      if (this.player) this.player.addXP(18);
    } else if (node.type === 'stone') {
      const isLoose = node.isLooseStone || (node.name && node.name.includes('Irtokivi'));
      yieldCount = isLoose ? 1 : (Math.floor(Math.random() * 3) + 2); // 1 or 2-4
      this.inventory.add('stone', yieldCount);
      if (this.hud) {
        this.hud.showPickupText(`+${yieldCount} ${isLoose ? 'Irtokivi maasta' : 'Louhittua kiveä'}`);
      }
      if (this.audioManager) {
        if (isLoose) this.audioManager.playHarvest('bush');
        else if (this.audioManager.playRockShatter) this.audioManager.playRockShatter();
        else this.audioManager.playMine();
      }

      if (!isLoose) {
        const pos = node.position || (node.mesh ? node.mesh.position : null);
        if (pos) this._spawnRockShatterParticles(pos, false);
      }

      if (this.questManager) this.questManager.onCollect('stone', yieldCount);
      if (this.achievementManager) this.achievementManager.onMine(1);
      if (this.player) this.player.addXP(isLoose ? 6 : 18);
    } else if (node.type === 'bush') {
      const berryRoll = Math.random();
      let berryType = 'berry';
      let berryLabel = 'Metsämarjoja';
      if (berryRoll < 0.4) {
        berryType = 'blueberry';
        berryLabel = 'Metsämustikoita';
      } else if (berryRoll < 0.75) {
        berryType = 'raspberry';
        berryLabel = 'Villivadelmia';
      }
      yieldCount = Math.floor(Math.random() * 3) + 2; // 2 to 4
      this.inventory.add(berryType, yieldCount);
      if (this.hud) {
        this.hud.showPickupText(`+${yieldCount} ${berryLabel}`);
      }
      if (this.audioManager) this.audioManager.playHarvest('bush');
      if (this.questManager) this.questManager.onCollect('berry', yieldCount);
      if (this.player) this.player.addXP(8);
    } else if (node.type === 'mushroom') {
      yieldCount = Math.floor(Math.random() * 2) + 1; // 1 to 2
      this.inventory.add('mushroom', yieldCount);
      if (this.hud) {
        this.hud.showPickupText(`+${yieldCount} ${node.name || 'Metsäsieniä'}`);
      }
      if (this.audioManager) this.audioManager.playHarvest('bush');
      if (this.questManager) this.questManager.onCollect('mushroom', yieldCount);
      if (this.player) this.player.addXP(8);
    } else if (node.type === 'wheat') {
      yieldCount = Math.floor(Math.random() * 2) + 2; // 2 to 3
      this.inventory.add('wheat', yieldCount);
      if (this.hud) {
        this.hud.showPickupText(`+${yieldCount} Pellon viljaa`);
      }
      if (this.audioManager) this.audioManager.playHarvest('bush');
      if (this.player) this.player.addXP(8);
    } else if (node.type === 'mossyWood') {
      yieldCount = Math.floor(Math.random() * 2) + 2;
      this.inventory.add('wood', yieldCount);
      if (Math.random() < 0.4) {
        this.inventory.add('stone', 1);
      }
      if (this.hud) {
        this.hud.showPickupText(`+${yieldCount} Irtopuuta maasta`);
      }
      if (this.audioManager) this.audioManager.playHarvest('bush');
      if (this.player) this.player.addXP(8);
    }

    // Respawn after 60 seconds
    setTimeout(() => {
      node.harvested = false;
      node.mesh.visible = true;
    }, 60000);
  }

  isAimingAtHarvestable() {
    return this.targetNode !== null && !this.targetNode.harvested;
  }

  _updateFallingTrees(delta) {
    for (let i = this.fallingTrees.length - 1; i >= 0; i--) {
      const ft = this.fallingTrees[i];
      ft.timer += delta;
      ft.angularVel += 4.5 * delta;
      ft.angle += ft.angularVel * delta;

      // Rotate tree from base pivot
      const q = new THREE.Quaternion().setFromAxisAngle(ft.pitchAxis, ft.angle);
      ft.mesh.quaternion.copy(q);

      if (ft.angle >= Math.PI * 0.46 && !ft.hasCrashed) {
        ft.hasCrashed = true;
        if (this.audioManager && this.audioManager.playTreeCrash) {
          this.audioManager.playTreeCrash();
        }
        this._spawnTreeImpactParticles(ft.origPos, ft.fallDir);
      }

      if (ft.hasCrashed && ft.timer > 1.8) {
        const fade = Math.max(0, 1 - (ft.timer - 1.8) / 0.8);
        ft.mesh.traverse((c) => {
          if (c.isMesh && c.material) {
            c.material.transparent = true;
            c.material.opacity = fade;
          }
        });
      }

      if (ft.timer >= 2.6) {
        this.scene.remove(ft.mesh);
        this.fallingTrees.splice(i, 1);
      }
    }
  }

  _updateShatteredDebris(delta) {
    for (let i = this.shatteredDebris.length - 1; i >= 0; i--) {
      const deb = this.shatteredDebris[i];
      deb.timer += delta;
      deb.vel.y -= 20 * delta;
      deb.mesh.position.addScaledVector(deb.vel, delta);
      deb.mesh.rotation.x += deb.rotVel.x * delta;
      deb.mesh.rotation.y += deb.rotVel.y * delta;
      deb.mesh.rotation.z += deb.rotVel.z * delta;

      const groundY = this.world ? this.world.getGroundHeight(deb.mesh.position.x, deb.mesh.position.z) : 0;
      if (deb.mesh.position.y <= groundY + 0.08) {
        deb.mesh.position.y = groundY + 0.08;
        deb.vel.y = -deb.vel.y * 0.35; // ground bounce
        deb.vel.x *= 0.65;
        deb.vel.z *= 0.65;
      }

      if (deb.timer > 1.8) {
        const s = Math.max(0, 1 - (deb.timer - 1.8) / 0.7);
        deb.mesh.scale.setScalar(deb.initialScale * s);
      }

      if (deb.timer >= 2.5) {
        this.scene.remove(deb.mesh);
        this.shatteredDebris.splice(i, 1);
      }
    }
  }

  _spawnRockShatterParticles(pos, isOre) {
    const count = 10;
    const colors = isOre ? [0xb87333, 0x888888, 0xd4af37, 0x555555] : [0x7f8c8d, 0x95a5a6, 0x555555, 0x3d3d3d];
    for (let i = 0; i < count; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      const size = 0.12 + Math.random() * 0.16;
      const geo = new THREE.DodecahedronGeometry(size, 0);
      const mat = new THREE.MeshLambertMaterial({ color: color });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        pos.x + (Math.random() - 0.5) * 0.5,
        pos.y + 0.4 + Math.random() * 0.6,
        pos.z + (Math.random() - 0.5) * 0.5
      );
      this.scene.add(mesh);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 6.5,
        Math.random() * 4.5 + 2.0,
        (Math.random() - 0.5) * 6.5
      );
      const rotVel = new THREE.Vector3(
        (Math.random() - 0.5) * 8.0,
        (Math.random() - 0.5) * 8.0,
        (Math.random() - 0.5) * 8.0
      );

      this.shatteredDebris.push({
        mesh,
        vel,
        rotVel,
        timer: 0,
        initialScale: 1.0
      });
    }
  }

  _spawnTreeImpactParticles(basePos, fallDir) {
    const count = 16;
    const colors = [0x27ae60, 0x2ecc71, 0x1b4332, 0x5c4033, 0x795548];
    const impactCenter = basePos.clone().addScaledVector(fallDir, 4.5);
    for (let i = 0; i < count; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      const size = 0.14 + Math.random() * 0.18;
      const geo = new THREE.BoxGeometry(size, size * 0.7, size);
      const mat = new THREE.MeshLambertMaterial({ color: color });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        impactCenter.x + (Math.random() - 0.5) * 2.2,
        impactCenter.y + 0.2 + Math.random() * 1.2,
        impactCenter.z + (Math.random() - 0.5) * 2.2
      );
      this.scene.add(mesh);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 5.0,
        Math.random() * 3.5 + 1.5,
        (Math.random() - 0.5) * 5.0
      );
      const rotVel = new THREE.Vector3(
        (Math.random() - 0.5) * 6.0,
        (Math.random() - 0.5) * 6.0,
        (Math.random() - 0.5) * 6.0
      );

      this.shatteredDebris.push({
        mesh,
        vel,
        rotVel,
        timer: 0,
        initialScale: 1.0
      });
    }
  }
}
