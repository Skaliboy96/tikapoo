import Localization from './Localization.js';

export default class Inventory {
  constructor(hud, audioManager) {
    this.hud = hud;
    this.audioManager = audioManager;

    this.items = {
      wood: 25,
      stone: 20,
      berry: 5,
      blueberry: 0,
      raspberry: 0,
      mushroom: 0,
      honey: 0,
      apple: 0,
      carrot: 0,
      meat: 0,
      cookedMeat: 0,
      trout: 0,
      pike: 0,
      salmon: 0,
      cookedFish: 0,
      wheat: 0,
      bread: 3,
      mushroomSoup: 0,
      meatStew: 0,
      honeyBread: 0,
      bandage: 2,
      arrow: 0,
      leather: 0,
      fang: 0,
      resin: 0,
      coal: 0,
      copperOre: 0,
      tinOre: 0,
      bronze: 0,
      ironOre: 0,
      iron: 0,
      steel: 0,
      silverOre: 0,
      silver: 0,
      blackMetalScrap: 0,
      blackMetal: 0,
      flametalOre: 0,
      dragonSteel: 0,
      bone: 0,
      slime: 0,
      wolfPelt: 0,
      shadow_essence: 0,
      // Unique Boss Key Progression Items (Valheim-loop)
      hardAntler: 0,   // Boss 1 drop: unlocks Antler Pickaxe & Bronze mining
      swampKey: 0,     // Boss 2 drop: unlocks Swamp Iron mining & smelting
      wishbone: 0,     // Boss 3 drop: unlocks Mountain Silver & Steel
      artisanCore: 0,  // Boss 4 drop: unlocks Artisan Forge & Black Metal
      dragonTears: 0,  // Boss 5 drop: unlocks Dragon Steel & Endgame Master Gear
      beastHeart: 0,
      swampScale: 0,
      graniteCore: 0,
      runeCore: 0,
      dragonCrown: 0
    };

    this.tools = {
      hands: true,
      torch: true, // Only bare fists and torch at the beginning - all tools and weapons must be crafted!
      stoneAxe: false,
      pickaxe: false,
      stoneSpear: false,
      hammer: false,
      fishingRod: false,
      antlerPickaxe: false,
      bronzeAxe: false,
      bronzePickaxe: false,
      bronzeSword: false,
      huntingBow: false,
      runicStaff: false,
      ironAxe: false,
      ironPickaxe: false,
      ironSword: false,
      steelSword: false,
      silverSword: false,
      silverPickaxe: false,
      blackMetalSword: false,
      blackMetalAxe: false,
      shield: false,
      stoneShield: false,
      stoneClub: false,
      stoneDagger: false,
      antlerBow: false,
      hornSpear: false,
      scaleSword: false,
      titanHammer: false,
      runeblade: false,
      dragonSlayer: false
    };

    this.equippedArmor = 'none';
    this.equippedTool = 'hands'; // Starts with bare hands!
    this.hotbar = null;
    this.displayEl = document.getElementById('inventory-items');
    this.equippedEl = document.getElementById('equipped-tool');

    this.updateDisplay();
  }

  add(item, count = 1) {
    if (this.items[item] !== undefined) {
      this.items[item] += count;
    } else {
      this.items[item] = count;
    }
    this.updateDisplay();
  }

  addBatch(itemsArray) {
    if (!Array.isArray(itemsArray)) return;
    for (const entry of itemsArray) {
      const item = entry.item || entry.id;
      const count = entry.count !== undefined ? entry.count : 1;
      if (this.items[item] !== undefined) {
        this.items[item] += count;
      } else {
        this.items[item] = count;
      }
    }
    this.updateDisplay();
  }

  remove(item, count = 1) {
    if (!this.has(item, count)) {
      return false;
    }
    this.items[item] -= count;
    this.updateDisplay();
    return true;
  }

  has(item, count = 1) {
    return (this.items[item] || 0) >= count;
  }

  getItemName(key) {
    const isFi = Localization.lang === 'fi';
    const namesFi = {
      wood: '🪵 Puu',
      stone: '🪨 Kivi',
      berry: '🫐 Marja',
      apple: '🍎 Omena',
      carrot: '🥕 Porkkana',
      meat: '🥩 Liha',
      cookedMeat: '🍖 Paistettu liha',
      trout: '🐟 Taimen',
      pike: '🦈 Hauki',
      salmon: '🐠 Lohi',
      cookedFish: '🍲 Paistettu kala',
      wheat: '🌾 Vilja',
      bread: '🍞 Leipä',
      bandage: '🩹 Yrttiside',
      arrow: '🏹 Nuoli',
      huntingBow: '🏹 Metsästäjän Jousi',
      runicStaff: '🔮 Riimusauva',
      leather: '🥋 Nahka',
      fang: '🦷 Hammas',
      resin: '🌲 Havupuu-hartsi',
      coal: '⚫ Puuhiili',
      copperOre: '🥉 Kuparimalmi',
      tinOre: '🪙 Tinamalmi',
      bronze: '🪙 Pronssiharkko',
      ironOre: '🪨 Rautamalmi',
      iron: '🧱 Rautaharkko',
      steel: '🔩 Teräsharkko',
      silverOre: '❄️ Hopeamalmi',
      silver: '✨ Hopeaharkko',
      blackMetalScrap: '🔮 Mustametallijäte',
      blackMetal: '🌌 Mustametalliharkko',
      flametalOre: '🌋 Tulimalmi',
      dragonSteel: '👑 Lohikäärmeteräs',
      bone: '🦴 Luu',
      slime: '🧪 Suoliejua',
      wolfPelt: '🐺 Sudentalja',
      shadow_essence: '🔮 Varjoesanssi',
      hands: '✊ Paljaat kädet',
      torch: '🔥 Soihtu',
      stoneAxe: '🪓 Kivikirves',
      bronzeAxe: '🪓 Pronssikirves',
      ironAxe: '🪓 Rautakirves',
      blackMetalAxe: '🪓 Mustametallikirves',
      pickaxe: '⛏️ Kivihakku',
      antlerPickaxe: '🔱 Sarvihakku',
      bronzePickaxe: '⛏️ Pronssihakku',
      ironPickaxe: '⛏️ Rautahakku',
      silverPickaxe: '⛏️ Vuoristohakku',
      stoneSpear: '🗡️ Kivikeihäs',
      hornSpear: '🔱 Sarvikeihäs',
      bronzeSword: '⚔️ Pronssimiekka',
      scaleSword: '🗡️ Suomumiekka',
      ironSword: '⚔️ Rautamiekka',
      steelSword: '⚔️ Taottu Teräsmiekka',
      silverSword: '❄️ Hopeamiekka',
      titanHammer: '🔨 Titaanivasara',
      blackMetalSword: '🌌 Mustametalliterä',
      runeblade: '💠 Riimumiekka',
      dragonSlayer: '🐉 Draakinsurmaaja',
      hammer: '🔨 Rakennusvasara',
      fishingRod: '🎣 Kalastusvapa',
      shield: '🛡️ Puukilpi',
      stoneShield: '🛡️ Kivinen Tornikilpi',
      stoneClub: '🪵 Raskas Kivinuija',
      stoneDagger: '🗡️ Piikivitikari',
      stoneArmor: '🪨 Kivipanssari (Kalliosuoja)',
      antlerBow: '🏹 Sarvijousi (Muinainen Sarvi)',
      leatherArmor: '🦺 Nahkahaarniska (Ruskea)',
      bronzeArmor: '🛡️ Pronssipanssari (Pronssi)',
      beastArmor: '🦺 Hirvitaljanen Haarniska (Turkis)',
      ironArmor: '🛡️ Rautapanssari (Tumma Rauta)',
      scaleArmor: '🐉 Suomuhaarniska (Vesisuomu)',
      steelArmor: '🛡️ Taottu Teräshaarniska (Kiiltoteräs)',
      plateArmor: '💎 Graniittilevyhaarniska (Kalliopanssari)',
      runicArmor: '✨ Riimumestarin Haarniska (Arkaani)',
      dragonArmor: '👑 Pohjolan Kuninkaan Jumalhaarniska',
      hardAntler: '🔱 Kova Sarvi',
      swampKey: '🗝️ Suoavain',
      wishbone: '🦴 Maan Sydän',
      artisanCore: '💠 Riimumestarin Kide',
      dragonTears: '💧 Varjokyynel',
      beastHeart: '🫀 Sarvisydän',
      swampScale: '🐉 Suomu',
      graniteCore: '💎 Graniittisydän',
      runeCore: '💠 Riimuydin',
      dragonCrown: '👑 Varjokruunu'
    };

    const namesEn = {
      wood: '🪵 Wood',
      stone: '🪨 Stone',
      berry: '🫐 Wild Berry',
      apple: '🍎 Mountain Apple',
      carrot: '🥕 Carrot',
      meat: '🥩 Raw Meat',
      cookedMeat: '🍖 Cooked Meat',
      trout: '🐟 Stream Trout',
      pike: '🦈 Northern Pike',
      salmon: '🐠 Golden Salmon',
      cookedFish: '🍲 Cooked Fish',
      wheat: '🌾 Field Wheat',
      bread: '🍞 Fresh Bread',
      bandage: '🩹 Herbal Bandage',
      arrow: '🏹 Arrow',
      huntingBow: '🏹 Hunting Bow',
      runicStaff: '🔮 Runic Staff',
      leather: '🥋 Leather Hide',
      fang: '🦷 Sharp Fang',
      resin: '🌲 Pine Resin',
      coal: '⚫ Charcoal',
      copperOre: '🥉 Copper Ore',
      tinOre: '🪙 Tin Ore',
      bronze: '🪙 Bronze Bar',
      ironOre: '🪨 Iron Ore',
      iron: '🧱 Iron Bar',
      steel: '🔩 Steel Bar',
      silverOre: '❄️ Silver Ore',
      silver: '✨ Silver Bar',
      blackMetalScrap: '🔮 Blackmetal Scrap',
      blackMetal: '🌌 Blackmetal Bar',
      flametalOre: '🌋 Flametal Ore',
      dragonSteel: '👑 Dragonsteel',
      bone: '🦴 Cursed Bone',
      slime: '🧪 Swamp Slime',
      wolfPelt: '🐺 Wolf Pelt',
      shadow_essence: '🔮 Shadow Essence',
      hands: '✊ Bare Hands',
      torch: '🔥 Torch',
      stoneAxe: '🪓 Stone Axe',
      bronzeAxe: '🪓 Bronze Axe',
      ironAxe: '🪓 Iron Axe',
      blackMetalAxe: '🪓 Blackmetal Axe',
      pickaxe: '⛏️ Stone Pickaxe',
      antlerPickaxe: '🔱 Antler Pickaxe',
      bronzePickaxe: '⛏️ Bronze Pickaxe',
      ironPickaxe: '⛏️ Iron Pickaxe',
      silverPickaxe: '⛏️ Mountain Pickaxe',
      stoneSpear: '🗡️ Stone Spear',
      hornSpear: '🔱 Horn Spear',
      bronzeSword: '⚔️ Bronze Sword',
      scaleSword: '🗡️ Scale Sword',
      ironSword: '⚔️ Iron Sword',
      steelSword: '⚔️ Steel Sword',
      silverSword: '❄️ Silver Sword',
      titanHammer: '🔨 Titan War Hammer',
      blackMetalSword: '🌌 Blackmetal Blade',
      runeblade: '💠 Runic Blade',
      dragonSlayer: '🐉 Dragonslayer',
      hammer: '🔨 Building Hammer',
      fishingRod: '🎣 Fishing Rod',
      shield: '🛡️ Wood Shield',
      stoneShield: '🛡️ Stone Tower Shield',
      stoneClub: '🪵 Heavy Stone Club',
      stoneDagger: '🗡️ Flint Dagger',
      stoneArmor: '🪨 Stone Plate Armor',
      antlerBow: '🏹 Ancient Antler Bow',
      leatherArmor: '🦺 Leather Armor (Brown)',
      bronzeArmor: '🛡️ Bronze Armor (Bronze)',
      beastArmor: '🦺 Beast Hide Armor (Fur)',
      ironArmor: '🛡️ Iron Armor (Dark Iron)',
      scaleArmor: '🐉 Scale Armor (Aquatic)',
      steelArmor: '🛡️ Steel Armor (Polished Steel)',
      plateArmor: '💎 Granite Plate Armor (Rock)',
      runicArmor: '✨ Archmage Runic Armor (Arcane)',
      dragonArmor: '👑 Godly Dragon King Armor',
      hardAntler: '🔱 Hard Antler',
      swampKey: '🗝️ Swamp Key',
      wishbone: '🦴 Wishbone',
      artisanCore: '💠 Artisan Core',
      dragonTears: '💧 Dragon Tears',
      beastHeart: '🫀 Beast Heart',
      swampScale: '🐉 Swamp Scale',
      graniteCore: '💎 Granite Core',
      runeCore: '💠 Rune Core',
      dragonCrown: '👑 Shadow Crown'
    };

    const map = isFi ? namesFi : namesEn;
    return map[key] || key;
  }

  getAll() {
    return { ...this.items };
  }

  equip(tool) {
    const nextTool = (tool && this.tools && this.tools[tool]) ? tool : null;
    if (this.equippedTool === nextTool) return;
    this.equippedTool = nextTool;
    this.updateDisplay();
    if (this.player && this.player.updateHeldWeapon) {
      this.player.updateHeldWeapon();
    }
  }

  getWeaponDamage() {
    if (this.equippedTool === 'dragonSlayer') return 250;
    if (this.equippedTool === 'runeblade') return 175;
    if (this.equippedTool === 'blackMetalSword') return 145;
    if (this.equippedTool === 'titanHammer') return 130;
    if (this.equippedTool === 'silverSword') return 110;
    if (this.equippedTool === 'steelSword') return 95;
    if (this.equippedTool === 'scaleSword') return 85;
    if (this.equippedTool === 'antlerBow') return 75;
    if (this.equippedTool === 'ironSword') return 68;
    if (this.equippedTool === 'huntingBow') return 60;
    if (this.equippedTool === 'runicStaff') return 58;
    if (this.equippedTool === 'ironAxe') return 56;
    if (this.equippedTool === 'hornSpear') return 55;
    if (this.equippedTool === 'bronzeSword') return 48;
    if (this.equippedTool === 'stoneClub') return 38;
    if (this.equippedTool === 'bronzeAxe') return 36;
    if (this.equippedTool === 'stoneSpear') return 35;
    if (this.equippedTool === 'stoneDagger') return 28;
    if (this.equippedTool === 'stoneAxe') return 25;
    if (this.equippedTool === 'antlerPickaxe') return 24;
    if (this.equippedTool === 'torch') return 22; // deals burn damage!
    if (this.equippedTool === 'pickaxe' || this.equippedTool === 'bronzePickaxe') return 22;
    return 15; // Bare hands
  }

  getDamageReduction() {
    let red = 0;
    if (this.tools.stoneShield && this.equippedTool === 'stoneShield') red += 0.45;
    else if (this.tools.shield && this.equippedTool === 'shield') red += 0.35;

    if (this.equippedArmor === 'dragonArmor') red = Math.max(red, 0.92);
    else if (this.equippedArmor === 'runicArmor') red = Math.max(red, 0.85);
    else if (this.equippedArmor === 'plateArmor') red = Math.max(red, 0.78);
    else if (this.equippedArmor === 'steelArmor') red = Math.max(red, 0.70);
    else if (this.equippedArmor === 'scaleArmor') red = Math.max(red, 0.62);
    else if (this.equippedArmor === 'ironArmor') red = Math.max(red, 0.52);
    else if (this.equippedArmor === 'beastArmor') red = Math.max(red, 0.40);
    else if (this.equippedArmor === 'bronzeArmor') red = Math.max(red, 0.32);
    else if (this.equippedArmor === 'stoneArmor') red = Math.max(red, 0.25);
    else if (this.equippedArmor === 'leatherArmor') red = Math.max(red, 0.18);
    return Math.min(0.92, red);
  }

  equipArmor(armorId) {
    this.equippedArmor = armorId;
    if (this.hud) {
      const names = {
        stoneArmor: '🪨 Kivipanssari (-25% DMG)',
        leatherArmor: '🥋 Nahkahaarniska (-18% DMG)',
        bronzeArmor: '🪙 Pronssipanssari (-32% DMG)',
        beastArmor: '🫀 Hirvitaljanen Haarniska (-40% DMG)',
        ironArmor: '⚔️ Rautapanssari (-52% DMG)',
        scaleArmor: '🐉 Suomupanssari (-62% DMG)',
        steelArmor: '🛡️ Taottu Teräshaarniska (-70% DMG)',
        plateArmor: '💎 Graniittilevyhaarniska (-78% DMG)',
        runicArmor: '✨ Riimumestarin Haarniska (-85% DMG)',
        dragonArmor: '👑 Pohjolan Kuninkaan Jumalhaarniska (-92% DMG)'
      };
      this.hud.showNotification(`🛡️ Puettu: ${names[armorId] || armorId}`);
    }
    this.updateDisplay();
  }

  consume(item, player) {
    if (!this.has(item, 1)) {
      if (this.hud) {
        this.hud.showNotification(`Ei enää ${item}-esinettä jäljellä!`);
      }
      return false;
    }

    if (item === 'berry') {
      this.remove('berry', 1);
      player.eat(18, 8, 8, 20); // +18 nälkä, +8 hp, +8 jano, +20 stamina
      if (this.audioManager) this.audioManager.playEat();
      if (this.hud) this.hud.showPickupText('🫐 +18 Nälkä, +8 Jano, +20 Stamina');
      return true;
    }

    if (item === 'blueberry') {
      this.remove('blueberry', 1);
      player.eat(20, 10, 15, 25);
      if (this.audioManager) this.audioManager.playEat();
      if (this.hud) this.hud.showPickupText('🫐 +20 Nälkä, +15 Jano, +25 Stamina, +10 HP');
      return true;
    }

    if (item === 'raspberry') {
      this.remove('raspberry', 1);
      player.eat(20, 10, 15, 25);
      if (this.audioManager) this.audioManager.playEat();
      if (this.hud) this.hud.showPickupText('🍓 +20 Nälkä, +15 Jano, +25 Stamina, +10 HP');
      return true;
    }

    if (item === 'mushroom') {
      this.remove('mushroom', 1);
      player.eat(25, 12, 0, 30);
      if (this.audioManager) this.audioManager.playEat();
      if (this.hud) this.hud.showPickupText('🍄 +25 Nälkä, +30 Stamina, +12 HP');
      return true;
    }

    if (item === 'honey') {
      this.remove('honey', 1);
      player.eat(35, 25, 10, 50);
      if (this.audioManager) this.audioManager.playEat();
      if (this.hud) this.hud.showPickupText('🍯 +35 Nälkä, +50 Stamina, +25 HP');
      return true;
    }

    if (item === 'mushroomSoup') {
      this.remove('mushroomSoup', 1);
      player.eat(65, 45, 20, 60);
      if (this.audioManager) this.audioManager.playEat();
      if (this.hud) this.hud.showPickupText('🍲 +65 Nälkä, +60 Stamina, +45 HP');
      return true;
    }

    if (item === 'meatStew') {
      this.remove('meatStew', 1);
      player.eat(85, 60, 15, 75);
      if (this.audioManager) this.audioManager.playEat();
      if (this.hud) this.hud.showPickupText('🥘 +85 Nälkä, +75 Stamina, +60 HP');
      return true;
    }

    if (item === 'honeyBread') {
      this.remove('honeyBread', 1);
      player.eat(55, 35, 0, 50);
      if (this.audioManager) this.audioManager.playEat();
      if (this.hud) this.hud.showPickupText('🍞 +55 Nälkä, +50 Stamina, +35 HP');
      return true;
    }

    if (item === 'apple') {
      this.remove('apple', 1);
      player.eat(20, 10, 12, 20);
      if (this.audioManager) this.audioManager.playEat();
      if (this.hud) this.hud.showPickupText('🍎 +20 Nälkä, +12 Jano, +20 Stamina');
      return true;
    }

    if (item === 'carrot') {
      this.remove('carrot', 1);
      player.eat(22, 12, 6, 25);
      if (this.audioManager) this.audioManager.playEat();
      if (this.hud) this.hud.showPickupText('🥕 +22 Nälkä, +6 Jano, +25 Stamina');
      return true;
    }

    if (item === 'bread') {
      this.remove('bread', 1);
      player.eat(48, 22, 0, 40);
      if (this.audioManager) this.audioManager.playEat();
      if (this.hud) this.hud.showPickupText('🍞 +48 Nälkä, +40 Stamina, +22 HP');
      return true;
    }

    if (item === 'meat') {
      this.remove('meat', 1);
      player.eat(35, 18, 0, 20);
      if (this.audioManager) this.audioManager.playEat();
      if (this.hud) this.hud.showPickupText('🥩 +35 Nälkä, +20 Stamina, +18 HP');
      return true;
    }

    if (item === 'cookedMeat') {
      this.remove('cookedMeat', 1);
      player.eat(55, 38, 0, 35);
      if (this.audioManager) this.audioManager.playEat();
      if (this.hud) this.hud.showPickupText('🍖 +55 Nälkä, +35 Stamina, +38 HP');
      return true;
    }

    if (item === 'trout' || item === 'pike' || item === 'salmon') {
      const hg = item === 'salmon' ? 60 : (item === 'pike' ? 42 : 30);
      const hp = item === 'salmon' ? 35 : (item === 'pike' ? 20 : 15);
      const st = item === 'salmon' ? 40 : (item === 'pike' ? 25 : 20);
      this.remove(item, 1);
      player.eat(hg, hp, 0, st);
      if (this.audioManager) this.audioManager.playEat();
      if (this.hud) this.hud.showPickupText(`🐟 +${hg} Nälkä, +${st} Stamina, +${hp} HP`);
      return true;
    }

    if (item === 'cookedFish') {
      this.remove('cookedFish', 1);
      player.eat(50, 32, 0, 35);
      if (this.audioManager) this.audioManager.playEat();
      if (this.hud) this.hud.showPickupText('🍲 +50 Nälkä, +35 Stamina, +32 HP');
      if (this.hotbar && this.hotbar.sync) this.hotbar.sync();
      return true;
    }

    if (item === 'bandage') {
      this.remove('bandage', 1);
      player.heal(45);
      if (this.audioManager) this.audioManager.playEat();
      if (this.hud) {
        this.hud.showPickupText('🩹 +45 HP (Yrttiside)');
      }
      if (this.hotbar && this.hotbar.sync) this.hotbar.sync();
      return true;
    }

    if (this.hotbar && this.hotbar.sync) {
      this.hotbar.sync();
    }
    return false;
  }

  updateDisplay() {
    if (this.hotbar && this.hotbar.sync) {
      this.hotbar.sync();
    }
    if (!this.displayEl) return;

    const icons = {
      wood: '🪵',
      stone: '🪨',
      berry: '🫐',
      blueberry: '🫐',
      raspberry: '🍓',
      mushroom: '🍄',
      honey: '🍯',
      mushroomSoup: '🍲',
      meatStew: '🥘',
      honeyBread: '🍞',
      apple: '🍎',
      carrot: '🥕',
      meat: '🥩',
      cookedMeat: '🍖',
      trout: '🐟',
      pike: '🦈',
      salmon: '🐠',
      cookedFish: '🍲',
      wheat: '🌾',
      bread: '🍞',
      bandage: '🩹',
      leather: '🥋',
      fang: '🦷',
      bronze: '🪙',
      bone: '🦴',
      shadow_essence: '🔮',
      beastHeart: '🫀',
      swampScale: '🐉',
      graniteCore: '💎',
      runeCore: '💠',
      dragonCrown: '👑'
    };

    const names = {
      wood: 'Puu',
      stone: 'Kivi',
      berry: 'Villimarja',
      blueberry: 'Metsämustikka',
      raspberry: 'Villivadelma',
      mushroom: 'Kantarelli (Metsäsieni)',
      honey: 'Villihunaja',
      mushroomSoup: 'Kermainen Sienikeitto',
      meatStew: 'Tuhti Riistapata',
      honeyBread: 'Makea Hunajaleipä',
      apple: 'Villitunturin omena',
      carrot: 'Pellon porkkana',
      meat: 'Raaka liha',
      cookedMeat: 'Paistettu liha',
      trout: 'Purotaimen',
      pike: 'Jokihauki',
      salmon: 'Kultainen lohi',
      cookedFish: 'Paistettu kala',
      wheat: 'Pellon vilja',
      bread: 'Tuore ruisleipä',
      bandage: 'Yrttiside',
      leather: 'Nahka',
      fang: 'Petohammas',
      bronze: 'Pronssiromu',
      bone: 'Luu',
      shadow_essence: 'Varjoesanssi',
      beastHeart: 'Sarvipadon Sydän (Boss 1)',
      swampScale: 'Vesipedon Suomut (Boss 2)',
      graniteCore: 'Titaanin Graniittisydän (Boss 3)',
      runeCore: 'Muinainen Riimuydin (Boss 4)',
      dragonCrown: 'Varjodraakin Kruunu (Boss 5)'
    };

    let html = '';
    for (const [key, qty] of Object.entries(this.items)) {
      html += `
        <div class="inv-row">
          <span>${this.getItemName(key)}</span>
          <span class="inv-count">${qty}</span>
        </div>
      `;
    }
    if (this.displayEl) this.displayEl.innerHTML = html;

    if (this.equippedEl) {
      const isFi = Localization.lang === 'fi';
      const toolName = this.equippedTool ? this.getItemName(this.equippedTool) : (isFi ? 'Paljaat kädet' : 'Bare Hands');
      this.equippedEl.textContent = `${isFi ? 'Varustettu' : 'Equipped'}: ${toolName} (${this.getWeaponDamage()} DMG)`;
    }
  }
}
