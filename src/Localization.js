/**
 * Localization Manager (Monikielisyysjärjestelmä)
 * English by default ('en'), with full Finnish ('fi') toggle in Settings.
 * Automatically updates DOM elements with data-i18n attributes.
 */
class LocalizationManager {
  constructor() {
    this.lang = localStorage.getItem('tikapoo_language') || 'en';

    this.strings = {
      en: {
        // Main Menu
        menu_title: 'TIKAPOO',
        menu_play: 'BEGIN ADVENTURE',
        menu_char: 'CHARACTER CREATOR',
        menu_instructions: 'CONTROLS & GUIDE',
        menu_lore: 'WORLD & SETTLEMENTS',
        menu_settings: 'SETTINGS',
        menu_continue: 'Continue Adventure',
        menu_back: 'Back to Menu',

        // Pause Menu
        pause_title: 'GAME PAUSED',
        pause_resume: 'RESUME GAME',
        pause_settings: 'SETTINGS',
        pause_instructions: 'CONTROLS & GUIDE',
        pause_dev: '🛠️ DEV MODE (kissa)',
        pause_quit: 'MAIN MENU',

        // HUD & Status
        hud_level: 'Level 1 🏆',
        hud_health: '❤️ HEALTH',
        hud_stamina: '⚡ STAMINA',
        hud_hunger: '🍖 HUNGER',
        hud_mana: '🔮 MANA',
        hud_rested: 'Rested',
        hud_day: 'Day',
        hud_night: 'Night',
        hud_equipped: 'Equipped',
        hud_fists: 'Bare Hands',

        // Quick buttons
        btn_craft: '⚒️ CRAFT [C]',
        btn_build: '🔨 BUILD [B]',
        btn_backpack: '🎒 BAG [I]',
        btn_skills: '⭐ SKILLS [O]',
        btn_map: '🗺️ MAP [M]',

        // Settings
        settings_title: 'Settings',
        setting_master_volume: 'Master Volume',
        setting_sfx_volume: 'Sound Effects',
        setting_music_volume: 'Music Volume',
        setting_mouse_sens: 'Mouse Sensitivity',
        setting_language: 'Language / Kieli',
        setting_graphics: 'Graphics & Performance',
        setting_fov: 'Field of View (FOV)',
        setting_fps: 'Show FPS',
        setting_fps_sub: 'In-game frame rate counter',
        lang_en: 'English (EN)',
        lang_fi: 'Suomi (FI)',

        // Character Creator
        cc_title: 'Nordic Character Forge',
        cc_name: 'Character Name',
        cc_gender: 'Gender',
        cc_male: '🧔 Male',
        cc_female: '👩 Female',
        cc_head: 'Headwear & Hair',
        cc_hood: '🧕 Scout Hood',
        cc_hair: '🧑 Unhooded Viking',
        cc_hair_style: 'Hairstyle',
        cc_hair_short: '✂️ Short',
        cc_hair_ponytail: '👱 Braided Ponytail',
        cc_hair_long: '💇 Long Hair',
        cc_hair_bald: '🪓 Shaved / Bald',
        cc_hair_color: 'Hair Color',
        cc_skin_color: 'Skin Tone',
        cc_cloth_color: 'Tunic Color',
        cc_confirm: '⚔️ CONFIRM & ENTER VALHEIM',
        cc_back: '⬅️ BACK TO MENU',

        // Biomes
        biome_meadows: 'Meadows',
        biome_black_forest: 'Black Forest',
        biome_swamp: 'Swamp',
        biome_mountain: 'Mountains',
        biome_plains: 'Plains',
        biome_ashlands: 'Ashlands',

        // Hotbar Slots
        slot_hands: 'Fists',
        slot_axe: 'Axe',
        slot_pickaxe: 'Pickaxe',
        slot_torch: 'Torch',
        slot_hammer: 'Hammer',
        slot_rod: 'Fishing Rod',
        slot_food: 'Food',
        slot_bandage: 'Herbal Bandage',
        hotbar_craft_hint: 'craft [C]',
        hotbar_empty: 'Empty',

        // Equipment & Weapons
        tool_stoneAxe: 'Stone Axe',
        tool_bronzeAxe: 'Bronze Axe',
        tool_ironAxe: 'Iron Axe',
        tool_blackMetalAxe: 'Blackmetal Axe',
        tool_pickaxe: 'Pickaxe',
        tool_antlerPickaxe: 'Antler Pickaxe',
        tool_bronzePickaxe: 'Bronze Pickaxe',
        tool_torch: 'Torch',
        tool_hammer: 'Building Hammer',
        tool_fishingRod: 'Fishing Rod',
        tool_stoneSpear: 'Stone Spear',
        tool_hornSpear: 'Horn Spear',
        tool_bronzeSword: 'Bronze Sword',
        tool_scaleSword: 'Scale Sword',
        tool_ironSword: 'Iron Sword',
        tool_steelSword: 'Steel Sword',
        tool_silverSword: 'Silver Sword',
        tool_blackMetalSword: 'Blackmetal Blade',
        tool_titanHammer: 'Titan War Hammer',
        tool_runeblade: 'Runic Blade',
        tool_dragonSlayer: 'Dragonslayer Greatsword',
        tool_huntingBow: 'Hunting Bow',
        tool_runicStaff: 'Runic Staff',
        tool_shield: 'Wooden Round Shield',

        // Armors
        armor_none: 'Simple Tunic',
        armor_leather: 'Leather Armor (-18% DMG)',
        armor_bronze: 'Bronze Armor (-32% DMG)',
        armor_beast: 'Beast Hide Armor (-40% DMG)',
        armor_iron: 'Iron Chainmail (-52% DMG)',
        armor_scale: 'Scale Armor (-62% DMG)',
        armor_steel: 'Steel Knight Armor (-70% DMG)',
        armor_plate: 'Heavy Plate Armor (-78% DMG)',
        armor_runic: 'Runic Enchanted Armor (-85% DMG)',
        armor_dragon: 'Dragonscale Armor (-92% DMG)',

        // Items / Resources
        item_wood: 'Wood',
        item_stone: 'Stone',
        item_flint: 'Flint',
        item_berry: 'Forest Berries',
        item_rawMeat: 'Raw Meat',
        item_cookedMeat: 'Cooked Meat',
        item_fish: 'Fresh Fish',
        item_copperOre: 'Copper Ore',
        item_tinOre: 'Tin Ore',
        item_bronze: 'Bronze Ingot',
        item_ironOre: 'Iron Ore',
        item_iron: 'Iron Ingot',
        item_silverOre: 'Silver Ore',
        item_silver: 'Silver Ingot',
        item_blackMetalOre: 'Blackmetal Scrap',
        item_blackMetal: 'Blackmetal Ingot',
        item_dragonScale: 'Dragon Scale',
        item_bandage: 'Herbal Bandage',
        item_potion: 'Mead of Health',

        // Notifications & Tooltips
        notif_saved: '💾 Game progress saved!',
        notif_item_needed: '⚠️ You do not own this item yet. Craft it with [C]!',
        notif_hammer_active: '🔨 Hammer Active! [Q / E] Cycle pieces, [R] Rotate, [B] Menu',
        notif_workbench_needed: '🔨 Workbench required! Build or find a workbench nearby first.',
        notif_shield_blocked: '🛡️ Shield blocked damage!',
        notif_fishing_bite: '🐟 A fish took the bait! Press [SPACE] to reel in!',
        notif_fishing_caught: '🎣 Caught a fresh fish! Cook it on a campfire.',
        notif_rested_gained: '🛋️ You feel well rested! +50% stamina recovery.',
        chest_prompt: 'Press [E] to Open Treasure Chest',
        chest_opened: '🎁 You opened a treasure chest and found valuable resources!',

        // Bosses
        boss1_name: 'Forest Terror – Horned Beast',
        boss1_biome: 'ANCIENT FOREST',
        boss1_telegraph: '⚡ The Horned Beast charges with lightning! Dodge!',
        boss1_appeared: '⚔️ The Horned Beast emerges from the woods! Fight for your life!',
        boss2_name: 'The Elder – Forest Colossus',
        boss2_biome: 'BLACK FOREST',
        boss3_name: 'Bonemass – Rotten Behemoth',
        boss3_biome: 'CURSED SWAMP',
        boss4_name: 'Moder – Frost Drake Conjurer',
        boss4_biome: 'FROZEN PEAKS',
        boss5_name: 'Yagluth – Ancient Shadow Draak',
        boss5_biome: 'ASHLANDS',

        // Quests
        quest_log_title: '📋 QUEST LOG',
        quest_empty: 'No active quests. Speak with villagers in town!',
        quest_accept: 'Accept Quest',
        quest_complete: 'Claim Reward',
        quest_completed: 'Completed',
        quest_reward: 'Reward',

        // Guide Modal
        guide_title: '📜 Game Controls & Guide',
        guide_move_title: '🎮 Movement & Camera',
        guide_move_wasd: '<strong>W, A, S, D</strong> : Move forward, backward, strafe',
        guide_move_shift: '<strong>Shift</strong> : Sprint (consumes stamina)',
        guide_move_space: '<strong>Space</strong> : Jump',
        guide_move_v: '<strong>V</strong> : Toggle camera view (3rd person / 1st person)',
        guide_move_zoom: '<strong>CTRL + Mouse Wheel</strong> : Adjust camera distance (Zoom in/out)',
        guide_move_mouse: '<strong>Mouse</strong> : Look around',
        guide_action_title: '⚔️ Actions & Tools',
        guide_act_hotbar: '<strong>1 – 8</strong> : Hotbar equipment (Weapons, Rod, Hammer, Food)',
        guide_act_harvest: '<strong>Left Click (Hold)</strong> : Harvest trees, rocks, crops',
        guide_act_attack: '<strong>Left Click</strong> : Attack enemies or cast fishing rod',
        guide_act_e: '<strong>E</strong> : Interact (Talk to NPCs, open chests, campfire cooking)',
        guide_menu_title: '🎒 Menus & Inventory',
        guide_menu_c: '<strong>C</strong> : Crafting Menu (Weapons, tools, armor, food)',
        guide_menu_b: '<strong>B</strong> : Building Mode & Structures',
        guide_menu_tab: '<strong>I / Tab</strong> : Backpack & Character Equipment',
        guide_menu_m: '<strong>M</strong> : World Map & Landmarks',
        guide_menu_o: '<strong>O</strong> : Skill Tree & Special Abilities',
        guide_menu_esc: '<strong>Esc</strong> : Pause Menu / Settings',
        guide_rules_title: '🔥 Survival Rules',
        guide_rule_food: 'Eat berries, cooked meat, and fish to restore health & stamina.',
        guide_rule_fire: 'Campfires grant warmth, rested buffs, and cook raw food!',
        guide_rule_night: 'Dangerous night beasts roam in the dark — stay near light!',

        // Backpack
        bp_char_title: '🛡️ EQUIPMENT & ATTRIBUTES',
        bp_atk: '⚔️ Attack Power:',
        bp_def: '🛡️ Defense:',
        bp_hp: '❤️ Health:',
        bp_hunger: '🍗 Hunger:',
        bp_weight: '⚖️ Carry Weight:',
        bp_items_title: '🎒 INVENTORY (24 SLOTS)'
      },

      fi: {
        // Main Menu
        menu_title: 'TIKAPOO',
        menu_play: 'ALOITA SEIKKAILU',
        menu_char: 'LUO / MUOKKAA HAHMOA',
        menu_instructions: 'PELIOHJEET & NÄPPÄIMET',
        menu_lore: 'KYLÄT & MAAILMA',
        menu_settings: 'ASETUKSET',
        menu_continue: 'Jatka seikkailua',
        menu_back: 'Takaisin valikkoon',

        // Pause Menu
        pause_title: 'PELI PYSÄYTETTY',
        pause_resume: 'JATKA PELIÄ',
        pause_settings: 'ASETUKSET',
        pause_instructions: 'OHJEET',
        pause_dev: '🛠️ DEVAUSTILA (kissa)',
        pause_quit: 'PÄÄVALIKKOON',

        // HUD & Status
        hud_level: 'Taso 1 🏆',
        hud_health: '❤️ TERVEYS',
        hud_stamina: '⚡ KESTÄVYYS',
        hud_hunger: '🍖 NÄLKÄ',
        hud_mana: '🔮 MANA',
        hud_rested: 'Levännyt',
        hud_day: 'Päivä',
        hud_night: 'Yö',
        hud_equipped: 'Varustettu',
        hud_fists: 'Paljaat kädet',

        // Quick buttons
        btn_craft: '⚒️ VALMISTA [C]',
        btn_build: '🔨 RAKENNA [B]',
        btn_backpack: '🎒 TAVARAT [I]',
        btn_skills: '⭐ TAIDOT [O]',
        btn_map: '🗺️ KARTTA [M]',

        // Settings
        settings_title: 'Asetukset',
        setting_master_volume: 'Pää-äänenvoimakkuus',
        setting_sfx_volume: 'Ääniefektit',
        setting_music_volume: 'Taustamusiikki',
        setting_mouse_sens: 'Hiiren herkkyys',
        setting_language: 'Kieli / Language',
        setting_graphics: 'Grafiikka & Suorituskyky',
        setting_fov: 'Näkökenttä (FOV)',
        setting_fps: 'Näytä FPS / Show FPS',
        setting_fps_sub: 'Ruudunpäivitysnopeuden mittari',
        lang_en: 'English (EN)',
        lang_fi: 'Suomi (FI)',

        // Character Creator
        cc_title: 'Pohjolan Hahmonluonti',
        cc_name: 'Hahmon Nimi',
        cc_gender: 'Sukupuoli',
        cc_male: '🧔 Mies',
        cc_female: '👩 Nainen',
        cc_head: 'Päähine & Hiukset',
        cc_hood: '🧕 Erämiehen Huppu',
        cc_hair: '🧑 Avopäinen Viikinki',
        cc_hair_style: 'Hiustyyli',
        cc_hair_short: '✂️ Lyhyet',
        cc_hair_ponytail: '👱 Ponnari',
        cc_hair_long: '💇 Pitkät',
        cc_hair_bald: '🪓 Kalju',
        cc_hair_color: 'Hiusten Väri',
        cc_skin_color: 'Ihonväri',
        cc_cloth_color: 'Aloitusvaatteiden Väri',
        cc_confirm: '⚔️ VAHVISTA & ASTU POHJOLAAN',
        cc_back: '⬅️ TAKAISIN VALIKKOON',

        // Biomes
        biome_meadows: 'Aarniometsä',
        biome_black_forest: 'Mustametsä',
        biome_swamp: 'Kirottu Suo',
        biome_mountain: 'Jäävuoret',
        biome_plains: 'Tasangot',
        biome_ashlands: 'Tuhkatasangot',

        // Hotbar Slots
        slot_hands: 'Nyrkit',
        slot_axe: 'Kirves',
        slot_pickaxe: 'Hakku',
        slot_torch: 'Soihtu',
        slot_hammer: 'Vasara',
        slot_rod: 'Onkivapa',
        slot_food: 'Ruoka',
        slot_bandage: 'Yrttiside',
        hotbar_craft_hint: 'valmista [C]',
        hotbar_empty: 'Tyhjä',

        // Equipment & Weapons
        tool_stoneAxe: 'Kivikirves',
        tool_bronzeAxe: 'Pronssikirves',
        tool_ironAxe: 'Rautakirves',
        tool_blackMetalAxe: 'Mustametallikirves',
        tool_pickaxe: 'Kivihakku',
        tool_antlerPickaxe: 'Sarvihakku',
        tool_bronzePickaxe: 'Pronssihakku',
        tool_torch: 'Soihtu',
        tool_hammer: 'Rakennusvasara',
        tool_fishingRod: 'Kalastusvapa',
        tool_stoneSpear: 'Kivikeihäs',
        tool_hornSpear: 'Sarvikeihäs',
        tool_bronzeSword: 'Pronssimiekka',
        tool_scaleSword: 'Suomumiekka',
        tool_ironSword: 'Rautamiekka',
        tool_steelSword: 'Teräsmiekka',
        tool_silverSword: 'Hopeamiekka',
        tool_blackMetalSword: 'Mustametallimiekka',
        tool_titanHammer: 'Titaanisotavasara',
        tool_runeblade: 'Riimumiekka',
        tool_dragonSlayer: 'Lohikäärmeensurmaaja',
        tool_huntingBow: 'Metsästäjän Jousi',
        tool_runicStaff: 'Riimusauva',
        tool_shield: 'Puukilpi',

        // Armors
        armor_none: 'Yksinkertainen Tunika',
        armor_leather: 'Nahkahaarniska (-18% DMG)',
        armor_bronze: 'Pronssihaarniska (-32% DMG)',
        armor_beast: 'Petotaljahaarniska (-40% DMG)',
        armor_iron: 'Rautainen Rengaspanssari (-52% DMG)',
        armor_scale: 'Suomuhaarniska (-62% DMG)',
        armor_steel: 'Teräksinen Ritaripanssari (-70% DMG)',
        armor_plate: 'Raskas Levyhaarniska (-78% DMG)',
        armor_runic: 'Riimuriivattu Taikapanssari (-85% DMG)',
        armor_dragon: 'Lohikäärmeensuomuhaarniska (-92% DMG)',

        // Items / Resources
        item_wood: 'Puu',
        item_stone: 'Kivi',
        item_flint: 'Piikivi',
        item_berry: 'Metsämarjat',
        item_rawMeat: 'Raaka liha',
        item_cookedMeat: 'Paistettu liha',
        item_fish: 'Tuore kala',
        item_copperOre: 'Kuparimalmi',
        item_tinOre: 'Tinamalmi',
        item_bronze: 'Pronssiharkko',
        item_ironOre: 'Rautamalmi',
        item_iron: 'Rautaharkko',
        item_silverOre: 'Hopeamalmi',
        item_silver: 'Hopeaharkko',
        item_blackMetalOre: 'Mustametalliromu',
        item_blackMetal: 'Mustametalliharkko',
        item_dragonScale: 'Lohikäärmeen suomu',
        item_bandage: 'Yrttiside',
        item_potion: 'Terveyssimma',

        // Notifications & Tooltips
        notif_saved: '💾 Pelitilanne tallennettu!',
        notif_item_needed: '⚠️ Sinulla ei ole vielä esinettä. Valmista se painamalla [C]!',
        notif_hammer_active: '🔨 Rakennusvasara aktivoitu! [Q/E] Selaa paloja, [R] Käännä, [B] Valikko',
        notif_workbench_needed: '🔨 Työpöytä vaaditaan! Rakenna työpöytä lähistölle ensin.',
        notif_shield_blocked: '🛡️ Kilpi vaimenti iskua!',
        notif_fishing_bite: '🐟 Kala nappasi kiinni! Paina [VÄLILYÖNTI] kelataksesi!',
        notif_fishing_caught: '🎣 Nappasit kalan! Paista se nuotiolla syötäväksi!',
        notif_rested_gained: '🛋️ Olet levännyt! Stamina palautuu +50% nopeammin.',
        chest_prompt: 'Paina [E] avataksesi Aarrearkku',
        chest_opened: '🎁 Avasit aarrearkun ja löysit arvokkaita aarteita!',

        // Bosses
        boss1_name: 'Metsän Kauhu – Sarvipeto',
        boss1_biome: 'AARNIOMETSÄ',
        boss1_telegraph: '⚡ Sarvipeto virittää ukkosrynnäkköä! Valmistaudu väistämään!',
        boss1_appeared: '⚔️ Sarvipeto ilmestyi metsästä! Taistele hengestäsi!',
        boss2_name: 'Vanha Valtias – Metsänjätti',
        boss2_biome: 'MUSTAMETSÄ',
        boss3_name: 'Suojärkäle – Mätäolento',
        boss3_biome: 'KIROTTU SUO',
        boss4_name: 'Moder – Jäälohikäärmeen Manaaja',
        boss4_biome: 'JÄÄVUORET',
        boss5_name: 'Yagluth – Varjodraakki',
        boss5_biome: 'TUHKATASANGOT',

        // Quests
        quest_log_title: '📋 TEHTÄVÄLOKI',
        quest_empty: 'Ei aktiivisia tehtäviä. Puhu kyläläisille kaupungissa!',
        quest_accept: 'Ota tehtävä',
        quest_complete: 'Lunasta palkkio',
        quest_completed: 'Suoritettu',
        quest_reward: 'Palkkio',

        // Guide Modal
        guide_title: '📜 Peliohjeet ja Näppäimet',
        guide_move_title: '🎮 Liikkuminen & Kamera',
        guide_move_wasd: '<strong>W, A, S, D</strong> : Liiku eteen, taakse, sivuille',
        guide_move_shift: '<strong>Shift</strong> : Juokse (kuluttaa kestävyyttä)',
        guide_move_space: '<strong>Space</strong> : Hyppy',
        guide_move_v: '<strong>V</strong> : Vaihda kuvakulmaa (3rd person / 1st person)',
        guide_move_zoom: '<strong>CTRL + Hiiren rulla</strong> : Kameran etäisyyden säätö (Zoom in/out)',
        guide_move_mouse: '<strong>Hiiri</strong> : Katso ympärille',
        guide_action_title: '⚔️ Toiminnot & Työkalut',
        guide_act_hotbar: '<strong>1 – 8</strong> : Pikapalkin esineet (Aseet, Onki, Vasara, Ruoka)',
        guide_act_harvest: '<strong>Vasen hiiri (pohjassa)</strong> : Kerää puuta, kiveä, marjoja',
        guide_act_attack: '<strong>Vasen hiiri</strong> : Lyö aseella tai heitä siima veteen',
        guide_act_e: '<strong>E</strong> : Vuorovaikuta (Puhu hahmoille, avaa arkkua, paista ruokaa)',
        guide_menu_title: '🎒 Valikot & Hallinta',
        guide_menu_c: '<strong>C</strong> : Valmistusvalikko (Aseet, työkalut, varusteet)',
        guide_menu_b: '<strong>B</strong> : Rakennustila & Kalusteet',
        guide_menu_tab: '<strong>I / Tab</strong> : Reppu & Varusteet',
        guide_menu_m: '<strong>M</strong> : Maailmankartta & Maamerkit',
        guide_menu_o: '<strong>O</strong> : Taitopuu & Erikoisliikkeet',
        guide_menu_esc: '<strong>Esc</strong> : Taukovalikko / Asetukset',
        guide_rules_title: '🔥 Selviytymissäännöt',
        guide_rule_food: 'Syö marjoja, paistettua lihaa ja kalaa pysyäksesi kylläisenä.',
        guide_rule_fire: 'Leiritulet antavat lämpöä, levännyt-bonuksen ja paistavat ruuan!',
        guide_rule_night: 'Yöllä vaanii vaarallisia varjopetoja — pysy tulen valossa!',

        // Backpack
        bp_char_title: '🛡️ VARUSTEET & OMINAISUUDET',
        bp_atk: '⚔️ Hyökkäysvoima:',
        bp_def: '🛡️ Suojaus:',
        bp_hp: '❤️ Terveys:',
        bp_hunger: '🍗 Nälkä:',
        bp_weight: '⚖️ Kantopaino:',
        bp_items_title: '🎒 REPPU (24 PAIKKAA)'
      }
    };

    // Apply on startup
    setTimeout(() => this.applyToDOM(), 0);
  }

  getLanguage() {
    return this.lang;
  }

  setLanguage(lang) {
    this.lang = lang === 'fi' ? 'fi' : 'en';
    localStorage.setItem('tikapoo_language', this.lang);
    this.applyToDOM();
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang: this.lang } }));
  }

  t(key, fallback = null) {
    const curDict = this.strings[this.lang] || this.strings.en;
    if (curDict && curDict[key] !== undefined) {
      return curDict[key];
    }
    const enDict = this.strings.en;
    if (enDict && enDict[key] !== undefined) {
      return enDict[key];
    }
    return fallback !== null ? fallback : key;
  }

  applyToDOM() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const val = this.t(key);
      if (val) {
        if (el.tagName === 'INPUT' && el.getAttribute('placeholder')) {
          el.setAttribute('placeholder', val);
        } else if (typeof val === 'string' && val.includes('<') && val.includes('>')) {
          el.innerHTML = val;
        } else {
          el.textContent = val;
        }
      }
    });

    const isFi = this.lang === 'fi';

    // Quest log title
    const questHeader = document.querySelector('.quest-log-header');
    if (questHeader) {
      questHeader.textContent = isFi ? '📋 TEHTÄVÄT' : '📋 QUEST LOG';
    }

    // Pause title
    const pauseTitle = document.querySelector('.pause-box h2');
    if (pauseTitle) {
      pauseTitle.textContent = isFi ? 'PELI PYSÄYTETTY' : 'GAME PAUSED';
    }
  }
}

export const Localization = new LocalizationManager();
export default Localization;
