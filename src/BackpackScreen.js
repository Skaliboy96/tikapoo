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

    const equipped = this.inventory ? this.inventory.equippedTool : null;
    let weaponName = 'Paljaat kädet';
    let weaponIcon = '✊';
    if (this.inventory && this.inventory.getItemName && equipped) {
      weaponName = this.inventory.getItemName(equipped);
    }

    const hasShield = this.inventory && this.inventory.tools.shield;
    const armorKey = this.inventory ? this.inventory.equippedArmor : 'none';
    const armorNames = {
      none: 'Ei haarniskaa (0% suojaus)',
      leatherArmor: '🥋 Nahkahaarniska (-18%)',
      bronzeArmor: '🪙 Pronssipanssari (-32%)',
      beastArmor: '🫀 Hirvitaljanen Haarniska (-40%)',
      ironArmor: '⚔️ Rautapanssari (-52%)',
      scaleArmor: '🐉 Suomupanssari (-62%)',
      steelArmor: '🛡️ Taottu Teräshaarniska (-70%)',
      plateArmor: '💎 Graniittilevyhaarniska (-78%)',
      runicArmor: '✨ Riimumestarin Haarniska (-85%)',
      dragonArmor: '👑 Pohjolan Kuninkaan Jumalhaarniska (-92%)'
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
      { slot: 'Kypärä & Pää', icon: '🧕', name: this.player?.charConfig?.headStyle === 'hood' ? 'Eränkävijän Huppu' : 'Pohjolan Viikinki', desc: 'Pohjoinen hahmon päähine' },
      { slot: 'Rintapanssari', icon: armorIcons[armorKey] || '🥋', name: armorNames[armorKey] || 'Peruspanssari', desc: 'Vähentää vihollisten aiheuttamaa vahinkoa' },
      { slot: 'Pääase / Työkalu', icon: weaponIcon, name: weaponName, desc: `Aktiivinen esine (Vahinko: ${this.inventory ? this.inventory.getWeaponDamage() : 15} DMG)` },
      { slot: 'Kilpi / Sivukäsi', icon: hasShield ? '🛡️' : '⚪', name: hasShield ? 'Tamminen Puukilpi' : 'Tyhjä käsi', desc: hasShield ? '-35% Vahingonesto' : 'Ei kilpeä' },
      { slot: 'Vyö & Työkalut', icon: '🔨', name: 'Rakennusvasara', desc: 'Valheim-rakentaminen [B]' }
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
  }

  _renderStats() {
    if (!this.player) return;

    const atk = `${this.inventory ? this.inventory.getWeaponDamage() : 15} DMG`;
    const defPct = this.inventory ? Math.round(this.inventory.getDamageReduction() * 100) : 0;
    const def = `${defPct}% (Panssari & Kilpi)`;
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

    const itemMeta = {
      wood:           { name: 'Puu', icon: '🪵', type: 'Resurssi' },
      stone:          { name: 'Kivi', icon: '🪨', type: 'Resurssi' },
      berry:          { name: 'Villimarja', icon: '🫐', type: 'Ruoka', usable: true },
      blueberry:      { name: 'Metsämustikka', icon: '🫐', type: 'Ruoka', usable: true },
      raspberry:      { name: 'Villivadelma', icon: '🍓', type: 'Ruoka', usable: true },
      mushroom:       { name: 'Kantarelli', icon: '🍄', type: 'Ruoka', usable: true },
      honey:          { name: 'Villihunaja', icon: '🍯', type: 'Ruoka', usable: true },
      mushroomSoup:   { name: 'Sienikeitto', icon: '🍲', type: 'Ruoka', usable: true },
      meatStew:       { name: 'Riistapata', icon: '🥘', type: 'Ruoka', usable: true },
      honeyBread:     { name: 'Hunajaleipä', icon: '🍞', type: 'Ruoka', usable: true },
      apple:          { name: 'Tunturiomena', icon: '🍎', type: 'Ruoka', usable: true },
      carrot:         { name: 'Porkkana', icon: '🥕', type: 'Ruoka', usable: true },
      meat:           { name: 'Raaka petoliha', icon: '🥩', type: 'Ruoka', usable: true },
      cookedMeat:     { name: 'Paistettu liha', icon: '🍖', type: 'Ruoka', usable: true },
      trout:          { name: 'Purotaimen', icon: '🐟', type: 'Kala', usable: true },
      pike:           { name: 'Jokihauki', icon: '🦈', type: 'Kala', usable: true },
      salmon:         { name: 'Kultainen lohi', icon: '🐠', type: 'Kala', usable: true },
      cookedFish:     { name: 'Paistettu kala', icon: '🍲', type: 'Ruoka', usable: true },
      wheat:          { name: 'Pellon vilja', icon: '🌾', type: 'Raaka-aine' },
      bread:          { name: 'Tuore ruisleipä', icon: '🍞', type: 'Ruoka', usable: true },
      bandage:        { name: 'Yrttiside', icon: '🩹', type: 'Lääkintä', usable: true },
      leather:        { name: 'Petonahka', icon: '🥋', type: 'Materiaali' },
      fang:           { name: 'Petohammas', icon: '🦷', type: 'Materiaali' },
      resin:          { name: 'Havupuu-hartsi', icon: '🌲', type: 'Polttoaine' },
      coal:           { name: 'Puuhiili', icon: '⚫', type: 'Polttoaine' },
      copperOre:      { name: 'Kuparimalmi', icon: '🥉', type: 'Malmi' },
      tinOre:         { name: 'Tinamalmi', icon: '🪙', type: 'Malmi' },
      bronze:         { name: 'Pronssiharkko', icon: '🪙', type: 'Metalli' },
      ironOre:        { name: 'Rautamalmi', icon: '🪨', type: 'Malmi' },
      iron:           { name: 'Rautaharkko', icon: '⚔️', type: 'Metalli' },
      steel:          { name: 'Teräsharkko', icon: '🛡️', type: 'Metalli' },
      silverOre:      { name: 'Hopeamalmi', icon: '❄️', type: 'Malmi' },
      silver:         { name: 'Hopeaharkko', icon: '✨', type: 'Metalli' },
      blackMetalScrap:{ name: 'Mustametallijäte', icon: '🔮', type: 'Malmi' },
      blackMetal:     { name: 'Mustametalliharkko', icon: '🌌', type: 'Metalli' },
      flametalOre:    { name: 'Tulimalmi', icon: '🌋', type: 'Malmi' },
      dragonSteel:    { name: 'Lohikäärmeteräs', icon: '👑', type: 'Legendaarinen' },
      hardAntler:     { name: 'Kova Sarvi', icon: '🔱', type: 'Pomoavain' },
      swampKey:       { name: 'Suoavain', icon: '🗝️', type: 'Pomoavain' },
      wishbone:       { name: 'Maan Sydän', icon: '🦴', type: 'Pomoavain' },
      artisanCore:    { name: 'Riimumestarin Kide', icon: '💠', type: 'Pomoavain' },
      dragonTears:    { name: 'Varjokyynel', icon: '💧', type: 'Pomoavain' },
      bone:           { name: 'Kirottu luu', icon: '🦴', type: 'Materiaali' },
      slime:          { name: 'Suoliejua', icon: '🧪', type: 'Materiaali' },
      wolfPelt:       { name: 'Sudentalja', icon: '🐺', type: 'Materiaali' },
      shadow_essence: { name: 'Varjoesanssi', icon: '🔮', type: 'Harvinainen' },
      beastHeart:     { name: 'Sarvisydän', icon: '🫀', type: 'Pomomateriaali' },
      swampScale:     { name: 'Vesipedon Suomu', icon: '🐉', type: 'Pomomateriaali' },
      graniteCore:    { name: 'Graniittiydin', icon: '💎', type: 'Pomomateriaali' },
      runeCore:       { name: 'Riimuydin', icon: '💠', type: 'Pomomateriaali' },
      dragonCrown:    { name: 'Varjokruunu', icon: '👑', type: 'Pomomateriaali' }
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
      torch:           { name: 'Soihtu', icon: '🔥', type: 'Valonlähde' },
      stoneAxe:        { name: 'Kivikirves', icon: '🪓', type: 'Kirves' },
      bronzeAxe:       { name: 'Pronssikirves', icon: '🪓', type: 'Kirves' },
      ironAxe:         { name: 'Rautakirves', icon: '🪓', type: 'Kirves' },
      blackMetalAxe:   { name: 'Mustametallikirves', icon: '🪓', type: 'Kirves' },
      pickaxe:         { name: 'Kivihakku', icon: '⛏️', type: 'Hakku' },
      antlerPickaxe:   { name: 'Sarvihakku', icon: '🔱', type: 'Hakku' },
      bronzePickaxe:   { name: 'Pronssihakku', icon: '⛏️', type: 'Hakku' },
      ironPickaxe:     { name: 'Rautahakku', icon: '⛏️', type: 'Hakku' },
      silverPickaxe:   { name: 'Vuoristohakku', icon: '⛏️', type: 'Hakku' },
      stoneSpear:      { name: 'Kivikeihäs', icon: '🗡️', type: 'Ase' },
      hornSpear:       { name: 'Sarvikeihäs', icon: '🔱', type: 'Ase' },
      bronzeSword:     { name: 'Pronssimiekka', icon: '⚔️', type: 'Ase' },
      scaleSword:      { name: 'Suomumiekka', icon: '🗡️', type: 'Ase' },
      ironSword:       { name: 'Rautamiekka', icon: '⚔️', type: 'Ase' },
      steelSword:      { name: 'Teräsmiekka', icon: '⚔️', type: 'Ase' },
      silverSword:     { name: 'Hopeamiekka', icon: '❄️', type: 'Ase' },
      titanHammer:     { name: 'Titaanivasara', icon: '🔨', type: 'Ase' },
      blackMetalSword: { name: 'Mustametalliterä', icon: '🌌', type: 'Ase' },
      runeblade:       { name: 'Riimumiekka', icon: '💠', type: 'Ase' },
      dragonSlayer:    { name: 'Draakinsurmaaja', icon: '🐉', type: 'Legendaarinen Ase' },
      huntingBow:      { name: 'Metsästäjän Jousi', icon: '🏹', type: 'Jousi' },
      runicStaff:      { name: 'Riimusauva', icon: '🔮', type: 'Taikasauva' },
      hammer:          { name: 'Rakennusvasara', icon: '🔨', type: 'Työkalu' },
      fishingRod:      { name: 'Kalastusvapa', icon: '🎣', type: 'Kalastus' },
      shield:          { name: 'Puukilpi', icon: '🛡️', type: 'Suoja' }
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
