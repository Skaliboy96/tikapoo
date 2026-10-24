import * as THREE from 'three';
import Localization from './Localization.js';

/**
 * NPC – Friendly animated village inhabitants from Modular Character Outfits.
 * Every character has a head, idle animations, voice/quest dialogues, and markers.
 */
export default class NPC {
  constructor(scene, world, questManager, hud, controls, assetLoader = null) {
    this.scene = scene;
    this.world = world;
    this.questManager = questManager;
    this.hud = hud;
    this.controls = controls;
    this.assetLoader = assetLoader || null;

    this.npcs = [];
    this.raycaster = new THREE.Raycaster();
    this.interactDist = 5.5;

    this.dialogueEl = document.getElementById('npc-dialogue');
    this.dialogueNameEl = document.getElementById('npc-dialogue-name');
    this.dialogueTextEl = document.getElementById('npc-dialogue-text');
    this.dialogueQuestsEl = document.getElementById('npc-dialogue-quests');
    this.dialogueCloseBtn = document.getElementById('npc-dialogue-close');
    this.activeNPC = null;
    this._ePressed = false;

    this._setupNPCs();
    this._setupListeners();
  }

  _setupListeners() {
    if (this.dialogueCloseBtn) {
      this.dialogueCloseBtn.addEventListener('click', () => this.closeDialogue());
    }
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE' && this.activeNPC) {
        this.closeDialogue();
      }
    });
  }

  _createNPCCharacter(modelName, animName, color, weaponName = null) {
    const group = new THREE.Group();
    let mixer = null;
    let action = null;

    if (this.assetLoader) {
      // Use createAnimatedCharacter which guarantees a complete 3D head and animations
      const charData = this.assetLoader.createAnimatedCharacter(modelName, animName);
      if (charData && charData.model) {
        const charModel = charData.model;
        mixer = charData.mixer;
        action = charData.actions[animName];

        charModel.scale.set(1.0, 1.0, 1.0);
        charModel.position.set(0, 0, 0);

        // Tint materials slightly to distinguish character roles
        charModel.traverse((child) => {
          if (child.isMesh && child.material) {
            child.material = child.material.clone();
            if (child.material.color && color) {
              child.material.color.lerp(new THREE.Color(color), 0.2);
            }
          }
        });

        // Attach weapon if specified
        if (weaponName) {
          const weapon = this.assetLoader.get(weaponName);
          if (weapon) {
            weapon.scale.set(0.75, 0.75, 0.75);
            weapon.rotation.set(0, Math.PI / 2, 0);

            let handBone = null;
            charModel.traverse((child) => {
              if (child.isBone) {
                if (child.name === 'handslot.r') handBone = child;
                else if (!handBone && (child.name === 'hand.r' || child.name.includes('hand_r') || child.name.includes('Hand_R'))) {
                  handBone = child;
                }
              }
            });
            if (handBone) {
              handBone.add(weapon);
            } else {
              weapon.position.set(0.38, 0.88, 0.18);
              group.add(weapon);
            }
          }
        }

        group.add(charModel);
      }
    }

    // Fallback if character model failed
    if (!mixer) {
      const bodyGeo = new THREE.CylinderGeometry(0.35, 0.4, 1.4, 8);
      const bodyMat = new THREE.MeshStandardMaterial({ color });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.7;
      body.castShadow = true;
      group.add(body);

      const headGeo = new THREE.SphereGeometry(0.3, 10, 8);
      const headMat = new THREE.MeshStandardMaterial({ color: 0xf5cba7 });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.y = 1.65;
      head.castShadow = true;
      group.add(head);
    }

    // Golden Floating Quest Marker above head
    const markerGroup = new THREE.Group();
    markerGroup.position.y = 2.45;

    const diamondGeo = new THREE.OctahedronGeometry(0.2, 0);
    const diamondMat = new THREE.MeshStandardMaterial({
      color: 0xf1c40f,
      emissive: 0xffa500,
      emissiveIntensity: 0.65,
      roughness: 0.2,
      metalness: 0.8
    });
    const diamond = new THREE.Mesh(diamondGeo, diamondMat);
    markerGroup.add(diamond);

    const ringGeo = new THREE.RingGeometry(0.28, 0.34, 16);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffe066,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    markerGroup.add(ring);

    group.add(markerGroup);
    group.userData.questMarker = markerGroup;

    return { group, mixer, action };
  }

  _spawnAt(x, z, def) {
    const y = this.world.getGroundHeight(x, z);
    const { group, mixer, action } = this._createNPCCharacter(
      def.modelName,
      def.animName,
      def.color,
      def.weaponName
    );

    group.position.set(x, y, z);
    if (def.rotation !== undefined) {
      group.rotation.y = def.rotation;
    }
    this.scene.add(group);

    const npc = {
      mesh: group,
      mixer,
      action,
      name: def.name,
      title: def.title,
      greeting: def.greeting,
      questIds: def.questIds,
      position: new THREE.Vector3(x, y + 1.0, z),
      baseRotation: def.rotation || 0,
      animTime: Math.random() * 10
    };

    group.traverse((child) => {
      if (child.isMesh) child.userData.npc = npc;
    });

    this.npcs.push(npc);
  }

  _setupNPCs() {
    const defs = [
      {
        name: 'Vanha Einari',
        name_en: 'Elder Einari',
        title: 'Kylänvanhin (Mage)',
        title_en: 'Village Elder (Mage)',
        modelName: 'Mage',
        animName: 'Idle_A',
        weaponName: 'staff',
        color: 0x8e44ad,
        greeting: 'Tervehdys, nuori selviytyjä! Olen koonnut kyläläiset tähän suojaisaan laaksoon. Pohjolaa uhkaa 5 muinaista pimeyden petoa. Kukista ensimmäinen peto Mustametsässä!',
        greeting_en: 'Greetings, traveler! I have gathered our people in this sheltered valley. Five ancient beasts threaten this realm. Seek out and defeat the first beast in the forest!',
        questIds: ['collectWood', 'exploreRuins', 'slayBoss1', 'slayBoss4', 'slayBoss5'],
        pos: [12, 8.4],
        rotation: Math.PI
      },
      {
        name: 'Kauppias Matti',
        name_en: 'Merchant Matti',
        title: 'Karavaaninjohtaja (Rogue)',
        title_en: 'Caravan Master (Rogue)',
        modelName: 'Rogue',
        animName: 'Idle_A',
        weaponName: 'dagger',
        color: 0xe67e22,
        greeting: 'Päivää kauppapaikalle! Karavaanini tuo tavaroita kaukaisista kaupungeista. Kerää minulle kiviä ja makeita villimarjoja!',
        greeting_en: 'Welcome to the trading post! My caravan trades with distant towns. Bring me sturdy stones and sweet forest berries!',
        questIds: ['collectStone', 'collectBerries'],
        pos: [-36, 18.2],
        rotation: Math.PI
      },
      {
        name: 'Nuori Aino',
        name_en: 'Young Aino',
        title: 'Yrttikerääjä (Herbalist)',
        title_en: 'Herbalist (Gatherer)',
        modelName: 'Rogue',
        animName: 'Idle_A',
        color: 0x1abc9c,
        greeting: 'Ihanaa nähdä ystävällisiä kasvoja! Hoidan kylän yrttitarhaa. Valmista leiritulia ja selviä yön läpi, niin opetan sinulle selviytymistä!',
        greeting_en: 'Wonderful to see a friendly face! I look after the settlement herb gardens. Light a warm campfire and survive the night!',
        questIds: ['buildCampfire', 'surviveNight'],
        pos: [16, -6.0],
        rotation: Math.PI
      },
      {
        name: 'Kalastaja Toivo',
        name_en: 'Fisherman Toivo',
        title: 'Kylän Kalastaja (Fisherman)',
        title_en: 'Master Angler (Fisherman)',
        modelName: 'Ranger_Adv',
        animName: 'Idle_A',
        color: 0x3498db,
        greeting: 'Tervehdys kalastuslaiturilta! Joessa ui purotaimenia, haukia ja kultalohia. Valitse onki pikapalkista tai valmista se työpöydällä [C], heitä koukku veteen ja odota tärppiä!',
        greeting_en: 'Greetings from the river dock! The waters are full of trout, pike, and salmon. Equip your fishing rod, cast your line, and strike when they bite!',
        questIds: ['catchFish'],
        pos: [-23.5, 32],
        rotation: Math.PI / 2
      },
      {
        name: 'Sotilas Pekka',
        name_en: 'Captain Pekka',
        title: 'Vartiopäällikkö (Knight)',
        title_en: 'Gate Captain (Knight)',
        modelName: 'Knight',
        animName: 'Idle_A',
        weaponName: 'sword_2handed',
        color: 0xe74c3c,
        greeting: 'Valppaana siellä! Vartioin leirin läntistä porttia. Pedot vaeltavat syvällä metsässä. Valmista itsellesi keihäs ja suojele kylää!',
        greeting_en: 'Stay alert! I stand guard over the western gate. Beasts stalk the woods after dusk. Craft yourself a spear and defend our home!',
        questIds: ['craftSpear', 'killBeasts', 'slayBoss3'],
        pos: [-18, 10],
        rotation: Math.PI / 2
      },
      {
        name: 'Seppä Ilmari',
        name_en: 'Blacksmith Ilmari',
        title: 'Kyläseppä (Barbarian Smith)',
        title_en: 'Village Smith (Barbarian)',
        modelName: 'Barbarian',
        animName: 'Idle_A',
        weaponName: 'Skeleton_Axe',
        color: 0xd35400,
        greeting: 'Pajani kuumana pauhaa! Työpöydällä voit takoa itsellesi jalon Pronssimiekan ja Pronssipanssarin [C] valmistusvalikosta!',
        greeting_en: 'My forge blazes with northern steel! Place a workbench [C] to forge bronze blades and heavy armor!',
        questIds: ['craftWorkbench', 'craftBronze', 'craftBronzeArmor', 'slayBoss2'],
        pos: [-24, -28.2],
        rotation: 0
      },
      {
        name: 'Metsästäjä Otso',
        name_en: 'Hunter Otso',
        title: 'Eränkävijä (Ranger)',
        title_en: 'Wilderness Tracker (Ranger)',
        modelName: 'Ranger_Adv',
        animName: 'Idle_A',
        weaponName: 'bow_withString',
        color: 0x27ae60,
        greeting: 'Metsän aukiolla laiduntaa villipeuroja ja jäniksiä. Valmista Metsästäjän Jousi ja metsästä peuroja herkullisen paistolihan ja nahkojen saamiseksi!',
        greeting_en: 'Wild deer and rabbits graze in the meadows. Craft a hunting bow [C] and track game for nourishing steaks and leather hides!',
        questIds: ['craftHuntingBow', 'huntDeer'],
        pos: [22, -18],
        rotation: -1.2
      },
      {
        name: 'Vartija Kristiina',
        name_en: 'Scout Kristiina',
        title: 'Siltavahti (Shadow Scout)',
        title_en: 'Bridge Sentry (Rogue)',
        modelName: 'Rogue_Hooded',
        animName: 'Idle_A',
        weaponName: 'Skeleton_Blade',
        color: 0x2980b9,
        greeting: 'Tervehdys! Vartioin jokea ja siltaa. Joen toisella puolella etelässä on Kirottu Harjanne, missä varjo-olennot vaeltavat!',
        greeting_en: 'Greetings! I keep watch over the river crossing. The southern ridge is cursed territory where shadowy monsters lurk!',
        questIds: ['killBeasts', 'surviveNight'],
        pos: [-2, 28],
        rotation: 0
      },
      {
        name: 'Vartiosotilas Lauri',
        name_en: 'Lookout Lauri',
        title: 'Linnakkeen Tähystäjä (Lookout)',
        title_en: 'Highland Watchman (Knight)',
        modelName: 'Knight',
        animName: 'Idle_A',
        weaponName: 'sword_2handed',
        color: 0x8e44ad,
        greeting: 'Tervehdys Metsävartion Linnakkeelta! Koko pohjoinen harjanne on valvonnamme alla. Kiipeä vartiotornin huipulle tähystämään laaksoa!',
        greeting_en: 'Hail from Highland Fortress! The northern ridge is under our watch. Climb the stone watchtower for a panoramic view of the valley!',
        questIds: ['scoutTower', 'exploreRuins'],
        pos: [35, -55],
        rotation: 0.8
      }
    ];

    defs.forEach(d => this._spawnAt(d.pos[0], d.pos[1], d));
  }

  openDialogue(npc) {
    if (!this.dialogueEl) return;
    const isFi = (Localization.getLanguage() === 'fi');
    this.activeNPC = npc;

    const displayName = isFi ? npc.name : (npc.name_en || npc.name);
    const displayTitle = isFi ? npc.title : (npc.title_en || npc.title);
    const displayGreeting = isFi ? npc.greeting : (npc.greeting_en || npc.greeting);

    this.dialogueNameEl.textContent = `${displayName} (${displayTitle})`;
    this.dialogueTextEl.textContent = displayGreeting;

    let html = '';
    npc.questIds.forEach(qid => {
      const q = this.questManager.getQuest(qid);
      if (!q) return;
      const done = q.completed;
      const active = q.active;
      const statusIcon = done ? '✅' : active ? '🔵' : '❕';
      const qTitle = isFi ? (q.title_fi || q.title) : (q.title_en || q.title);
      const qDesc = isFi ? (q.description_fi || q.description) : (q.description_en || q.description);

      html += `
        <div class="quest-row ${done ? 'quest-done' : active ? 'quest-active' : ''}">
          <div class="quest-row-title">${statusIcon} ${qTitle}</div>
          <div class="quest-row-desc">${qDesc}</div>
          <div class="quest-row-progress">${this.questManager.getProgressText(qid)}</div>
          ${!done && !active ? `<button class="accept-quest-btn" data-qid="${qid}">${isFi ? 'Hyväksy tehtävä' : 'Accept Quest'}</button>` : ''}
          ${active && this.questManager.isComplete(qid) ? `<button class="complete-quest-btn" data-qid="${qid}">${isFi ? '🏆 Lunasta palkkio!' : '🏆 Claim Reward!'}</button>` : ''}
        </div>
      `;
    });
    this.dialogueQuestsEl.innerHTML = html;

    this.dialogueQuestsEl.querySelectorAll('.accept-quest-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const qid = btn.dataset.qid;
        this.questManager.accept(qid);
        const q = this.questManager.getQuest(qid);
        if (this.hud) {
          const qTitle = isFi ? (q.title_fi || q.title) : (q.title_en || q.title);
          this.hud.showNotification(`${isFi ? '⚔️ Tehtävä aloitettu' : '⚔️ Quest accepted'}: ${qTitle}`);
        }
        this.closeDialogue();
      });
    });
    this.dialogueQuestsEl.querySelectorAll('.complete-quest-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const qid = btn.dataset.qid;
        this.questManager.complete(qid);
        this.closeDialogue();
      });
    });

    this.dialogueEl.classList.add('active');
    if (this.controls && this.controls.isLocked) this.controls.unlock();
  }

  closeDialogue() {
    if (this.dialogueEl) this.dialogueEl.classList.remove('active');
    this.activeNPC = null;
    this.targetedNPC = null;
    if (window.restoreGameFocus) {
      window.restoreGameFocus();
    } else {
      setTimeout(() => {
        const mainMenu = document.getElementById('main-menu');
        const isMenu = mainMenu && mainMenu.style.display !== 'none';
        if (!isMenu && this.controls && !this.controls.isLocked) {
          this.controls.lock();
        }
      }, 60);
    }
  }

  update(delta, camera, isLocked) {
    const camPos = camera.position;

    this.npcs.forEach(npc => {
      npc.animTime += delta;

      if (npc.mixer) {
        npc.mixer.update(delta);
      }

      // Smooth turning towards player when approached
      const dx = camPos.x - npc.mesh.position.x;
      const dz = camPos.z - npc.mesh.position.z;
      const distToPlayer = Math.sqrt(dx * dx + dz * dz);

      if (distToPlayer < 7.5) {
        const targetAngle = Math.atan2(dx, dz);
        let diff = targetAngle - npc.mesh.rotation.y;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        npc.mesh.rotation.y += diff * delta * 3.5;
      }

      // Floating quest marker animation
      const marker = npc.mesh.userData.questMarker;
      if (marker) {
        marker.rotation.y += delta * 2.0;
        marker.position.y = 2.45 + Math.sin(npc.animTime * 3.0) * 0.08;
      }
    });

    const isTouch = window.isTouchDevice || ('ontouchstart' in window) || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if ((!isLocked && !isTouch) || this.activeNPC) return;

    this.raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const meshes = this.npcs.flatMap(n => {
      const arr = [];
      n.mesh.traverse(c => { if (c.isMesh) arr.push(c); });
      return arr;
    });

    const hits = this.raycaster.intersectObjects(meshes);
    if (hits.length > 0 && hits[0].distance < (this.interactDist + 3.5)) {
      const npc = hits[0].object.userData.npc;
      if (npc) {
        this.targetedNPC = npc;
        const prompt = isTouch
          ? `💬 Puhu: ${npc.name} (${npc.title}) (napauta)`
          : `[E] Puhu: ${npc.name} (${npc.title})`;
        this.hud.showTooltip(prompt);
        if (this._ePressed) {
          this._ePressed = false;
          this.openDialogue(npc);
        }
        return;
      }
    }
    this.targetedNPC = null;
  }

  onKeyE() {
    this._ePressed = true;
  }
}
