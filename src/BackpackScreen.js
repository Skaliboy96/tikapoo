import Localization from './Localization.js';

/**
 * BackpackScreen – Valheim-inspired RPG equipment and inventory grid screen.
 * Displays character paperdoll equipment slots, RPG vitals & attributes,
 * and a 24-slot inventory grid showing all owned resources, enemy loot, and gear.
 */
export default class BackpackScreen {
  constructor(inventory, player, controls, hud, hotbar = null) {
    this.inventory = inventory;
    this.player = player;
    this.controls = controls;
    this.hud = hud;
    this.hotbar = hotbar;

    this.isOpen = false;
    this.overlayEl = document.getElementById('backpack-screen');
    this.closeBtn = document.getElementById('backpack-close-btn');

    this.equipEl = document.getElementById('bp-equipment');
    this.itemsGridEl = document.getElementById('bp-items-grid');

    this.statAtkEl = document.getElementById('bp-stat-atk');
    this.statDefEl = document.getElementById('bp-stat-def');
    this.statHpEl = document.getElementById('bp-stat-hp');
    this.statHungerEl = document.getElementById('bp-stat-hunger');
    this.statWeightEl = document.getElementById('bp-stat-weight');

    window.addEventListener('languageChanged', () => {
      if (this.isOpen) this.render();
    });

    this._setupListeners();
  }

  _setupListeners() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyI') {
        // Toggle inventory screen [I]
        e.preventDefault();
        this.toggle();
      }
      if (e.code === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  open() {
    this.isOpen = true;
    if (this.overlayEl) this.overlayEl.classList.add('active');
    if (this.controls && this.controls.isLocked) this.controls.unlock();
    this.refresh();
  }

  close() {
    this.isOpen = false;
    if (this.overlayEl) this.overlayEl.classList.remove('active');
    setTimeout(() => {
      const mainMenu = document.getElementById('main-menu');
      const isMenu = mainMenu && mainMenu.style.display !== 'none';
      if (!isMenu && this.controls && !this.controls.isLocked) {
        this.controls.lock();
      }
    }, 60);
  }

  refresh() {
    this._renderEquipment();
    this._renderStats();
    this._renderGrid();
  }

  _renderEquipment() {
    if (!this.equipEl) return;
    const isFi = Localization.lang === 'fi';

    const equipped = this.inventory ? this.inventory.equippedTool : null;
    let weaponName = isFi ? 'Paljaat kädet' : 'Bare Hands';
    let weaponIcon = '✊';
    if (this.inventory && this.inventory.getItemName && equipped) {
      weaponName = this.inventory.getItemName(equipped);
    }

    const hasShield = this.inventory && this.inventory.tools.shield;
    const armorKey = this.inventory ? this.inventory.equippedArmor : 'none';
    const armorNames = {
      none: isFi ? 'Ei haarniskaa (0% suojaus)' : 'No Armor (0% protection)',
      leatherArmor: isFi ? '🥋 Nahkahaarniska (-18%)' : '🥋 Leather Armor (-18%)',
      bronzeArmor: isFi ? '🪙 Pronssipanssari (-32%)' : '🪙 Bronze Armor (-32%)',
      beastArmor: isFi ? '🫀 Hirvitaljanen Haarniska (-40%)' : '🫀 Beast Hide Armor (-40%)',
      ironArmor: isFi ? '⚔️ Rautapanssari (-52%)' : '⚔️ Iron Armor (-52%)',
      scaleArmor: isFi ? '🐉 Suomupanssari (-62%)' : '🐉 Scale Armor (-62%)',
      steelArmor: isFi ? '🛡️ Taottu Teräshaarniska (-70%)' : '🛡️ Forged Steel Armor (-70%)',
      plateArmor: isFi ? '💎 Graniittilevyhaarniska (-78%)' : '💎 Granite Plate Armor (-78%)',
      runicArmor: isFi ? '✨ Riimumestarin Haarniska (-85%)' : '✨ Runic Archmage Armor (-85%)',
      dragonArmor: isFi ? '👑 Pohjolan Kuninkaan Jumalhaarniska (-92%)' : '👑 Godly Dragon Armor (-92%)'
    };

    const armorIcons = {
      none: '👕',
      leatherArmor: '🥋',
      bronzeArmor: '🪙',
      beastArmor: '🫀',
      ironArmor: '⚔️',
      scaleArmor: '🐉',
      steelArmor: '🛡️',
      plateArmor: '💎',
      runicArmor: '✨',
      dragonArmor: '👑'
    };

    const equipSlots = [
      { slot: isFi ? 'Kypärä & Pää' : 'Helmet & Head', icon: '🧕', name: this.player?.charConfig?.headStyle === 'hood' ? (isFi ? 'Eränkävijän Huppu' : 'Ranger Hood') : (isFi ? 'Pohjolan Viikinki' : 'Nordic Helm'), desc: isFi ? 'Päähine' : 'Headgear' },
      { slot: isFi ? 'Rintapanssari' : 'Chest Armor', icon: armorIcons[armorKey] || '🥋', name: armorNames[armorKey] || (isFi ? 'Peruspanssari' : 'Basic Armor'), desc: isFi ? 'Vähentää vihollisten aiheuttamaa vahinkoa' : 'Reduces damage taken from enemies' },
      { slot: isFi ? 'Pääase / Työkalu' : 'Main Weapon / Tool', icon: weaponIcon, name: weaponName, desc: `${isFi ? 'Vahinko' : 'Damage'}: ${this.inventory ? this.inventory.getWeaponDamage() : 15} DMG` },
      { slot: isFi ? 'Kilpi / Sivukäsi' : 'Shield / Offhand', icon: hasShield ? '🛡️' : '⚪', name: hasShield ? (isFi ? 'Tamminen Puukilpi' : 'Oak Wood Shield') : (isFi ? 'Tyhjä käsi' : 'Empty Hand'), desc: hasShield ? (isFi ? '-35% Vahingonesto' : '-35% Damage Blocked') : (isFi ? 'Ei kilpeä' : 'No shield') },
      { slot: isFi ? 'Vyö & Työkalut' : 'Belt & Utilities', icon: '🔨', name: isFi ? 'Rakennusvasara' : 'Building Hammer', desc: isFi ? 'Valheim-rakentaminen [B]' : 'Construction [B]' }
    ];

    let html = '';
    equipSlots.forEach(s => {
      html += `
        <div class="bp-equip-slot">
          <div class="bp-equip-icon">${s.icon}</div>
          <div class="bp-equip-info">
            <div class="bp-equip-slot-name">${s.slot}</div>
            <div class="bp-equip-item-name">${s.name}</div>
            <div class="bp-equip-item-desc">${s.desc}</div>
          </div>
        </div>
      `;
    });

    this.equipEl.innerHTML = html;

    // Allow clicking the weapon slot to toggle weapon / fists
    const weaponSlotEl = this.equipEl.children[2];
    if (weaponSlotEl) {
      weaponSlotEl.style.cursor = 'pointer';
      weaponSlotEl.title = isFi ? 'Klikkaa riisuaksesi ase tai vaihtaaksesi nyrkkeihin [X]' : 'Click to unequip weapon or switch to fists [X]';
      weaponSlotEl.addEventListener('click', () => {
        if (this.hotbar && this.hotbar.toggleFists) {
          this.hotbar.toggleFists();
        } else if (this.inventory) {
          this.inventory.equip(null);
        }
        this.refresh();
      });
    }
  }

  _renderStats() {
    if (!this.player) return;
    const isFi = Localization.lang === 'fi';

    const atk = `${this.inventory ? this.inventory.getWeaponDamage() : 15} DMG`;
    const defPct = this.inventory ? Math.round(this.inventory.getDamageReduction() * 100) : 0;
    const def = `${defPct}% (${isFi ? 'Panssari & Kilpi' : 'Armor & Shield'})`;
    const hp = `${Math.round(this.player.health)} / ${this.player.maxHealth}`;
    const hunger = `${Math.round(this.player.hunger)}%`;

    // Compute carry weight based on inventory items
    let totalWeight = 8;
    if (this.inventory) {
      for (const [item, qty] of Object.entries(this.inventory.items)) {
        totalWeight += qty * 1.5;
      }
    }
    const weight = `${Math.round(totalWeight)} / 300 kg`;

    if (this.statAtkEl) this.statAtkEl.textContent = atk;
    if (this.statDefEl) this.statDefEl.textContent = def;
    if (this.statHpEl) this.statHpEl.textContent = hp;
    if (this.statHungerEl) this.statHungerEl.textContent = hunger;
    if (this.statWeightEl) this.statWeightEl.textContent = weight;
  }

  _renderGrid() {
    if (!this.itemsGridEl || !this.inventory) return;
    const isFi = Localization.lang === 'fi';

    const itemMeta = {
      wood:           { name: isFi ? 'Puu' : 'Wood', icon: '🪵', type: isFi ? 'Resurssi' : 'Resource' },
      stone:          { name: isFi ? 'Kivi' : 'Stone', icon: '🪨', type: isFi ? 'Resurssi' : 'Resource' },
      berry:          { name: isFi ? 'Villimarja' : 'Wild Berry', icon: '🫐', type: isFi ? 'Ruoka' : 'Food', usable: true },
      blueberry:      { name: isFi ? 'Metsämustikka' : 'Forest Blueberry', icon: '🫐', type: isFi ? 'Ruoka' : 'Food', usable: true },
      raspberry:      { name: isFi ? 'Villivadelma' : 'Wild Raspberry', icon: '🍓', type: isFi ? 'Ruoka' : 'Food', usable: true },
      mushroom:       { name: isFi ? 'Kantarelli' : 'Chanterelle', icon: '🍄', type: isFi ? 'Ruoka' : 'Food', usable: true },
      honey:          { name: isFi ? 'Villihunaja' : 'Wild Honey', icon: '🍯', type: isFi ? 'Ruoka' : 'Food', usable: true },
      mushroomSoup:   { name: isFi ? 'Sienikeitto' : 'Mushroom Soup', icon: '🍲', type: isFi ? 'Ruoka' : 'Food', usable: true },
      meatStew:       { name: isFi ? 'Riistapata' : 'Meat Stew', icon: '🥘', type: isFi ? 'Ruoka' : 'Food', usable: true },
      honeyBread:     { name: isFi ? 'Hunajaleipä' : 'Honey Bread', icon: '🍞', type: isFi ? 'Ruoka' : 'Food', usable: true },
      apple:          { name: isFi ? 'Tunturiomena' : 'Mountain Apple', icon: '🍎', type: isFi ? 'Ruoka' : 'Food', usable: true },
      carrot:         { name: isFi ? 'Porkkana' : 'Carrot', icon: '🥕', type: isFi ? 'Ruoka' : 'Food', usable: true },
      meat:           { name: isFi ? 'Raaka petoliha' : 'Raw Meat', icon: '🥩', type: isFi ? 'Ruoka' : 'Food', usable: true },
      cookedMeat:     { name: isFi ? 'Paistettu liha' : 'Cooked Meat', icon: '🍖', type: isFi ? 'Ruoka' : 'Food', usable: true },
      trout:          { name: isFi ? 'Purotaimen' : 'Stream Trout', icon: '🐟', type: isFi ? 'Kala' : 'Fish', usable: true },
      pike:           { name: isFi ? 'Jokihauki' : 'River Pike', icon: '🦈', type: isFi ? 'Kala' : 'Fish', usable: true },
      salmon:         { name: isFi ? 'Kultainen lohi' : 'Golden Salmon', icon: '🐠', type: isFi ? 'Kala' : 'Fish', usable: true },
      cookedFish:     { name: isFi ? 'Paistettu kala' : 'Cooked Fish', icon: '🍲', type: isFi ? 'Ruoka' : 'Food', usable: true },
      wheat:          { name: isFi ? 'Pellon vilja' : 'Wheat', icon: '🌾', type: isFi ? 'Raaka-aine' : 'Material' },
      bread:          { name: isFi ? 'Tuore ruisleipä' : 'Fresh Bread', icon: '🍞', type: isFi ? 'Ruoka' : 'Food', usable: true },
      bandage:        { name: isFi ? 'Yrttiside' : 'Herbal Bandage', icon: '🩹', type: isFi ? 'Lääkintä' : 'Medicine', usable: true },
      leather:        { name: isFi ? 'Petonahka' : 'Leather Hide', icon: '🥋', type: isFi ? 'Materiaali' : 'Material' },
      fang:           { name: isFi ? 'Petohammas' : 'Sharp Fang', icon: '🦷', type: isFi ? 'Materiaali' : 'Material' },
      resin:          { name: isFi ? 'Havupuu-hartsi' : 'Resin', icon: '🌲', type: isFi ? 'Polttoaine' : 'Fuel' },
      coal:           { name: isFi ? 'Puuhiili' : 'Charcoal', icon: '⚫', type: isFi ? 'Polttoaine' : 'Fuel' },
      copperOre:      { name: isFi ? 'Kuparimalmi' : 'Copper Ore', icon: '🥉', type: isFi ? 'Malmi' : 'Ore' },
      tinOre:         { name: isFi ? 'Tinamalmi' : 'Tin Ore', icon: '🪙', type: isFi ? 'Malmi' : 'Ore' },
      bronze:         { name: isFi ? 'Pronssiharkko' : 'Bronze Bar', icon: '🪙', type: isFi ? 'Metalli' : 'Metal' },
      ironOre:        { name: isFi ? 'Rautamalmi' : 'Iron Ore', icon: '🪨', type: isFi ? 'Malmi' : 'Ore' },
      iron:           { name: isFi ? 'Rautaharkko' : 'Iron Bar', icon: '⚔️', type: isFi ? 'Metalli' : 'Metal' },
      steel:          { name: isFi ? 'Teräsharkko' : 'Steel Bar', icon: '🛡️', type: isFi ? 'Metalli' : 'Metal' },
      silverOre:      { name: isFi ? 'Hopeamalmi' : 'Silver Ore', icon: '❄️', type: isFi ? 'Malmi' : 'Ore' },
      silver:         { name: isFi ? 'Hopeaharkko' : 'Silver Bar', icon: '✨', type: isFi ? 'Metalli' : 'Metal' },
      blackMetalScrap:{ name: isFi ? 'Mustametallijäte' : 'Blackmetal Scrap', icon: '🔮', type: isFi ? 'Malmi' : 'Ore' },
      blackMetal:     { name: isFi ? 'Mustametalliharkko' : 'Blackmetal Bar', icon: '🌌', type: isFi ? 'Metalli' : 'Metal' },
      flametalOre:    { name: isFi ? 'Tulimalmi' : 'Flametal Ore', icon: '🌋', type: isFi ? 'Malmi' : 'Ore' },
      dragonSteel:    { name: isFi ? 'Lohikäärmeteräs' : 'Dragonsteel', icon: '👑', type: isFi ? 'Legendaarinen' : 'Legendary' },
      hardAntler:     { name: isFi ? 'Kova Sarvi' : 'Hard Antler', icon: '🔱', type: isFi ? 'Pomoavain' : 'Boss Key' },
      swampKey:       { name: isFi ? 'Suoavain' : 'Swamp Key', icon: '🗝️', type: isFi ? 'Pomoavain' : 'Boss Key' },
      wishbone:       { name: isFi ? 'Maan Sydän' : 'Wishbone', icon: '🦴', type: isFi ? 'Pomoavain' : 'Boss Key' },
      artisanCore:    { name: isFi ? 'Riimumestarin Kide' : 'Artisan Core', icon: '💠', type: isFi ? 'Pomoavain' : 'Boss Key' },
      dragonTears:    { name: isFi ? 'Varjokyynel' : 'Dragon Tears', icon: '💧', type: isFi ? 'Pomoavain' : 'Boss Key' },
      bone:           { name: isFi ? 'Kirottu luu' : 'Cursed Bone', icon: '🦴', type: isFi ? 'Materiaali' : 'Material' },
      slime:          { name: isFi ? 'Suoliejua' : 'Swamp Slime', icon: '🧪', type: isFi ? 'Materiaali' : 'Material' },
      wolfPelt:       { name: isFi ? 'Sudentalja' : 'Wolf Pelt', icon: '🐺', type: isFi ? 'Materiaali' : 'Material' },
      shadow_essence: { name: isFi ? 'Varjoesanssi' : 'Shadow Essence', icon: '🔮', type: isFi ? 'Harvinainen' : 'Rare' },
      beastHeart:     { name: isFi ? 'Sarvisydän' : 'Beast Heart', icon: '🫀', type: isFi ? 'Pomomateriaali' : 'Boss Material' },
      swampScale:     { name: isFi ? 'Vesipedon Suomu' : 'Swamp Scale', icon: '🐉', type: isFi ? 'Pomomateriaali' : 'Boss Material' },
      graniteCore:    { name: isFi ? 'Graniittiydin' : 'Granite Core', icon: '💎', type: isFi ? 'Pomomateriaali' : 'Boss Material' },
      runeCore:       { name: isFi ? 'Riimuydin' : 'Rune Core', icon: '💠', type: isFi ? 'Pomomateriaali' : 'Boss Material' },
      dragonCrown:    { name: isFi ? 'Varjokruunu' : 'Shadow Crown', icon: '👑', type: isFi ? 'Pomomateriaali' : 'Boss Material' }
    };

    const slots = [];
    // Collect non-zero items
    for (const [key, qty] of Object.entries(this.inventory.items)) {
      if (qty > 0 && itemMeta[key]) {
        slots.push({ key, qty, meta: itemMeta[key] });
      }
    }

    // Add all crafted/owned tools
    const toolMeta = {
      torch:           { name: isFi ? 'Soihtu' : 'Torch', icon: '🔥', type: isFi ? 'Valonlähde' : 'Light Source' },
      stoneAxe:        { name: isFi ? 'Kivikirves' : 'Stone Axe', icon: '🪓', type: isFi ? 'Kirves' : 'Axe' },
      bronzeAxe:       { name: isFi ? 'Pronssikirves' : 'Bronze Axe', icon: '🪓', type: isFi ? 'Kirves' : 'Axe' },
      ironAxe:         { name: isFi ? 'Rautakirves' : 'Iron Axe', icon: '🪓', type: isFi ? 'Kirves' : 'Axe' },
      blackMetalAxe:   { name: isFi ? 'Mustametallikirves' : 'Blackmetal Axe', icon: '🪓', type: isFi ? 'Kirves' : 'Axe' },
      pickaxe:         { name: isFi ? 'Kivihakku' : 'Stone Pickaxe', icon: '⛏️', type: isFi ? 'Hakku' : 'Pickaxe' },
      antlerPickaxe:   { name: isFi ? 'Sarvihakku' : 'Antler Pickaxe', icon: '🔱', type: isFi ? 'Hakku' : 'Pickaxe' },
      bronzePickaxe:   { name: isFi ? 'Pronssihakku' : 'Bronze Pickaxe', icon: '⛏️', type: isFi ? 'Hakku' : 'Pickaxe' },
      ironPickaxe:     { name: isFi ? 'Rautahakku' : 'Iron Pickaxe', icon: '⛏️', type: isFi ? 'Hakku' : 'Pickaxe' },
      silverPickaxe:   { name: isFi ? 'Vuoristohakku' : 'Mountain Pickaxe', icon: '⛏️', type: isFi ? 'Hakku' : 'Pickaxe' },
      stoneSpear:      { name: isFi ? 'Kivikeihäs' : 'Stone Spear', icon: '🗡️', type: isFi ? 'Ase' : 'Weapon' },
      hornSpear:       { name: isFi ? 'Sarvikeihäs' : 'Horn Spear', icon: '🔱', type: isFi ? 'Ase' : 'Weapon' },
      bronzeSword:     { name: isFi ? 'Pronssimiekka' : 'Bronze Sword', icon: '⚔️', type: isFi ? 'Ase' : 'Weapon' },
      scaleSword:      { name: isFi ? 'Suomumiekka' : 'Scale Sword', icon: '🗡️', type: isFi ? 'Ase' : 'Weapon' },
      ironSword:       { name: isFi ? 'Rautamiekka' : 'Iron Sword', icon: '⚔️', type: isFi ? 'Ase' : 'Weapon' },
      steelSword:      { name: isFi ? 'Teräsmiekka' : 'Steel Sword', icon: '⚔️', type: isFi ? 'Ase' : 'Weapon' },
      silverSword:     { name: isFi ? 'Hopeamiekka' : 'Silver Sword', icon: '❄️', type: isFi ? 'Ase' : 'Weapon' },
      titanHammer:     { name: isFi ? 'Titaanivasara' : 'Titan War Hammer', icon: '🔨', type: isFi ? 'Ase' : 'Weapon' },
      blackMetalSword: { name: isFi ? 'Mustametalliterä' : 'Blackmetal Blade', icon: '🌌', type: isFi ? 'Ase' : 'Weapon' },
      runeblade:       { name: isFi ? 'Riimumiekka' : 'Runic Blade', icon: '💠', type: isFi ? 'Ase' : 'Weapon' },
      dragonSlayer:    { name: isFi ? 'Draakinsurmaaja' : 'Dragonslayer', icon: '🐉', type: isFi ? 'Legendaarinen Ase' : 'Legendary Weapon' },
      huntingBow:      { name: isFi ? 'Metsästäjän Jousi' : 'Hunting Bow', icon: '🏹', type: isFi ? 'Jousi' : 'Bow' },
      runicStaff:      { name: isFi ? 'Riimusauva' : 'Runic Staff', icon: '🔮', type: isFi ? 'Taikasauva' : 'Magic Staff' },
      hammer:          { name: isFi ? 'Rakennusvasara' : 'Building Hammer', icon: '🔨', type: isFi ? 'Työkalu' : 'Tool' },
      fishingRod:      { name: isFi ? 'Kalastusvapa' : 'Fishing Rod', icon: '🎣', type: isFi ? 'Kalastus' : 'Fishing' },
      shield:          { name: isFi ? 'Puukilpi' : 'Wood Shield', icon: '🛡️', type: isFi ? 'Suoja' : 'Shield' }
    };

    if (this.inventory.tools) {
      for (const [toolKey, isOwned] of Object.entries(this.inventory.tools)) {
        if (isOwned && toolMeta[toolKey]) {
          slots.push({ key: toolKey, qty: 1, isTool: true, meta: toolMeta[toolKey] });
        }
      }
    }

    // Fill remaining up to 24 slots (4 rows x 6 cols)
    const totalSlots = 24;
    let html = '';

    for (let i = 0; i < totalSlots; i++) {
      if (i < slots.length) {
        const item = slots[i];
        html += `
          <div class="bp-grid-slot has-item" data-item="${item.key}" data-istool="${item.isTool || false}">
            <div class="bp-slot-icon">${item.meta.icon}</div>
            <div class="bp-slot-name">${item.meta.name}</div>
            ${item.qty > 1 ? `<div class="bp-slot-qty">x${item.qty}</div>` : ''}
            <div class="bp-slot-type">${item.meta.type}</div>
          </div>
        `;
      } else {
        html += `
          <div class="bp-grid-slot empty">
            <div class="bp-slot-empty-dot">•</div>
          </div>
        `;
      }
    }

    this.itemsGridEl.innerHTML = html;

    // Attach click events on slots
    this.itemsGridEl.querySelectorAll('.bp-grid-slot.has-item').forEach(slotEl => {
      slotEl.addEventListener('click', () => {
        const itemKey = slotEl.getAttribute('data-item');
        const isTool = slotEl.getAttribute('data-istool') === 'true';

        if (isTool) {
          this.inventory.equip(itemKey);
          if (this.hotbar) this.hotbar.sync();
          this.refresh();
          if (this.hud) this.hud.showNotification(`Varustettu: ${itemKey}`);
        } else if (itemMeta[itemKey] && itemMeta[itemKey].usable) {
          this.inventory.consume(itemKey, this.player);
          if (this.hotbar) this.hotbar.sync();
          this.refresh();
        }
      });
    });
  }
}
