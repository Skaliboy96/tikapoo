import Localization from './Localization.js';

export default class CraftingMenu {
  constructor(inventory, buildingSystem, player, hud, audioManager, controls, questManager) {
    this.inventory = inventory;
    this.buildingSystem = buildingSystem;
    this.player = player;
    this.hud = hud;
    this.audioManager = audioManager;
    this.controls = controls;
    this.questManager = questManager;

    this.isOpen = false;
    this.currentCategory = 'all';

    this.container = document.getElementById('crafting-menu');
    this.tabsContainer = document.getElementById('crafting-tabs-container');
    this.recipeListEl = document.getElementById('recipe-list');
    this.closeBtn = document.getElementById('close-crafting-btn');

    window.addEventListener('languageChanged', () => {
      if (this.isOpen) this.render();
    });

    this.recipes = [
      // --- TOOLS & WEAPONS ---
      {
        id: 'rake',
        category: 'tools',
        name: '🌾 Harava (Rake)',
        type: 'tool',
        desc: 'Muokkaa maata viljelyspelloiksi! Klikkaa maata luodaksesi peltomaata ja istuta siemeniä.',
        cost: { wood: 5, stone: 2 }
      },
      {
        id: 'backpack',
        category: 'tools',
        name: '🎒 Nahkainen Reppu (Backpack)',
        type: 'item',
        desc: 'Laadukas nahkareppu, joka laajentaa tavaraluettelon 24 slotista 40 slottiin!',
        cost: { leather: 4, wood: 2 }
      },
      {
        id: 'stoneAxe',
        category: 'tools',
        name: '🪓 Kivikirves (Stone Axe)',
        type: 'tool',
        desc: 'Välttämätön työkalu puiden hakkuuseen! Kaataa koivut ja männyt. Tekee 25 vahinkoa.',
        cost: { wood: 3, stone: 3 }
      },
      {
        id: 'pickaxe',
        category: 'tools',
        name: '⛏️ Kivihakku (Stone Pickaxe)',
        type: 'tool',
        desc: 'Välttämätön työkalu kiven louhimiseen kalliosta! Tekee 22 vahinkoa.',
        cost: { wood: 4, stone: 4 }
      },
      {
        id: 'hammer',
        category: 'tools',
        name: '🔨 Rakennusvasara (Building Hammer)',
        type: 'tool',
        desc: 'Mahdollistaa seinien, lattioiden, leiritulien ja kalusteiden rakentamisen [B].',
        cost: { wood: 4, stone: 2 }
      },
      {
        id: 'huntingBow',
        category: 'tools',
        name: '🏹 Metsästäjän Jousi (Hunting Bow)',
        type: 'tool',
        requiresWorkbench: true,
        desc: 'Pitkän kantaman ase. Ampuu nuolia tarkasti kohteeseen. Tekee 60 vahinkoa.',
        cost: { wood: 6, leather: 2 }
      },
      {
        id: 'arrow',
        category: 'tools',
        name: '🏹 Nuoliviini (10x Nuolta)',
        type: 'item',
        count: 10,
        requiresWorkbench: true,
        desc: 'Teräväkärkisiä nuolia jousiammuntaa varten.',
        cost: { wood: 2, stone: 1 }
      },
      {
        id: 'runicStaff',
        category: 'tools',
        name: '🔮 Riimusauva (Runic Staff)',
        type: 'tool',
        requiresWorkbench: true,
        desc: 'Muinainen taikasauva. Ampuu hehkuvia riimukuulia ja valjastaa loitsuja.',
        cost: { wood: 6, resin: 3, stone: 2 }
      },
      {
        id: 'fishingRod',
        category: 'tools',
        name: '🎣 Kalastusvapa (Fishing Rod)',
        type: 'tool',
        requiresWorkbench: true,
        desc: 'Mahdollistaa kalastamisen järvistä ja joista [Paina E laiturilla].',
        cost: { wood: 4, leather: 1 }
      },
      {
        id: 'torch',
        category: 'tools',
        name: '🔥 Valaiseva Soihtu (Torch)',
        type: 'tool',
        requiresWorkbench: false,
        desc: 'Valaisee erämaan yön, luolat ja karkottaa pimeyden pedot. Tekee tulivahinkoa!',
        cost: { wood: 2, resin: 1 }
      },
      {
        id: 'stoneSpear',
        category: 'tools',
        name: '🗡️ Kivikeihäs (Stone Spear)',
        type: 'tool',
        requiresWorkbench: true,
        desc: 'Pitkävartinen pistoase. Ulottuu kauas ja tekee 35 vahinkoa.',
        cost: { wood: 4, stone: 5 }
      },
      {
        id: 'stoneClub',
        category: 'tools',
        name: '🪵 Kivinuija (Stone Mace)',
        type: 'tool',
        requiresWorkbench: false,
        desc: 'Raskas kivipäinen murskausase. Murskaa luut ja tekee 38 vahinkoa.',
        cost: { wood: 4, stone: 5 }
      },
      {
        id: 'stoneDagger',
        category: 'tools',
        name: '🗡️ Piikivitikari (Stone Dagger)',
        type: 'tool',
        requiresWorkbench: false,
        desc: 'Terävästä kivestä hiottu nopea tikari. Tekee 28 vahinkoa ripein iskuin.',
        cost: { stone: 3, wood: 2 }
      },
      {
        id: 'shield',
        category: 'tools',
        name: '🛡️ Puukilpi (Wooden Shield)',
        type: 'tool',
        requiresWorkbench: true,
        desc: 'Kevyt tamminen kilpi. Vaimentaa 35% vihollisten iskuista.',
        cost: { wood: 5, stone: 2 }
      },
      {
        id: 'stoneShield',
        category: 'tools',
        name: '🛡️ Kivinen Tornikilpi (Stone Tower Shield)',
        type: 'tool',
        requiresWorkbench: true,
        desc: 'Vankka kivilaatalla vahvistettu kilpi. Torjuu 75% saapuvasta vahingosta ja kestää kovia iskuja!',
        cost: { stone: 7, wood: 4 }
      },
      {
        id: 'bronzeShield',
        category: 'tools',
        name: '🛡️ Pronssikilpi (Bronze Buckler)',
        type: 'tool',
        requiresWorkbench: true,
        desc: 'Kevyt ja ketterä pronssinen kupurakilpi. Loistava parry-ajoitusikkuna ja 82% torjunta!',
        cost: { bronze: 4, wood: 4 }
      },
      {
        id: 'ironShield',
        category: 'tools',
        name: '🛡️ Rautakilpi (Iron Banded Shield)',
        type: 'tool',
        requiresWorkbench: true,
        desc: 'Rautavanteilla vahvistettu raskas kilpi. Kestää suuren määrän iskuja ja torjuu 88% vahingosta.',
        cost: { iron: 4, wood: 4, leather: 2 }
      },
      {
        id: 'silverShield',
        category: 'tools',
        name: '🛡️ Hopeakilpi (Silver Frost Shield)',
        type: 'tool',
        requiresWorkbench: true,
        desc: 'Vuoren hopeasta taottu riimukilpi. Torjuu 93% vahingosta ja omaa valtavan torjuntakestävyyden!',
        cost: { silver: 4, wolfPelt: 2, wood: 4 }
      },
      {
        id: 'blackmetalShield',
        category: 'tools',
        name: '🛡️ Mustametallikilpi (Black Metal Shield)',
        type: 'tool',
        requiresWorkbench: true,
        desc: 'Sysivuoren mustasta metallista takoma mestarikilpi. Huippuluokan 96% torjunta ja suurin kestävyys!',
        cost: { blackmetal: 4, linenThread: 4 }
      },
      {
        id: 'stoneArmor',
        category: 'tools',
        name: '🪨 Kivipanssari (Stone Plate Armor)',
        type: 'item',
        requiresWorkbench: true,
        desc: 'Kivilaatoista ja nahasta koottu luja rintapanssari. Vähentää vahinkoa 25%.',
        cost: { stone: 8, leather: 2, wood: 2 }
      },
      {
        id: 'leatherArmor',
        category: 'tools',
        name: '🥋 Nahkahaarniska (Leather Armor)',
        type: 'item',
        requiresWorkbench: true,
        desc: 'Vahvasta petonahasta ommeltu rintapanssari. Vähentää vahinkoa 18%.',
        cost: { leather: 4, wood: 2 }
      },
      {
        id: 'antlerPickaxe',
        category: 'tools',
        name: '🔱 Sarvihakku (Antler Pickaxe - Boss Tier 1)',
        type: 'tool',
        requiresWorkbench: true,
        desc: 'Metsän Kauhun sarvista kaiverrettu hakku. Mahdollistaa Kuparin ja Tinan louhinnan Mustametsästä!',
        cost: { hardAntler: 1, wood: 4 }
      },
      {
        id: 'antlerBow',
        category: 'tools',
        name: '🏹 Sarvijousi (Ancient Horn Bow - Boss Tier 1)',
        type: 'tool',
        requiresWorkbench: true,
        desc: 'Sarvipadon joustavista sarvista punottu jousi. Tekee 75 vahinkoa!',
        cost: { hardAntler: 1, wood: 6, leather: 2 }
      },

      // --- BRONZE TIER (Mustametsä) ---
      {
        id: 'bronzeAxe',
        category: 'tools',
        name: '🪓 Pronssikirves (Bronze Axe - Tier 2)',
        type: 'tool',
        requiresWorkbench: true,
        desc: 'Taottu pronssikirves. Kaataa isot männyt nopeasti ja tekee 36 vahinkoa.',
        cost: { bronze: 3, wood: 4 }
      },
      {
        id: 'bronzePickaxe',
        category: 'tools',
        name: '⛏️ Pronssihakku (Bronze Pickaxe - Tier 2)',
        type: 'tool',
        requiresWorkbench: true,
        desc: 'Vahva hakku. Louhii rautaa ja kiviä tuplanopeudella.',
        cost: { bronze: 4, wood: 4 }
      },
      {
        id: 'bronzeSword',
        category: 'tools',
        name: '⚔️ Pronssimiekka (Bronze Sword - Tier 2)',
        type: 'tool',
        requiresWorkbench: true,
        desc: 'Kevyt ja nopea pronssimiekka. Tekee 48 vahinkoa.',
        cost: { bronze: 4, wood: 3 }
      },
      {
        id: 'bronzeArmor',
        category: 'tools',
        name: '🪙 Pronssipanssari (Bronze Armor - Tier 2)',
        type: 'item',
        requiresWorkbench: true,
        desc: 'Pronssilevyistä koottu panssari. Vähentää vahinkoa 32%.',
        cost: { bronze: 6, leather: 2 }
      },
      {
        id: 'hornSpear',
        category: 'tools',
        name: '🔱 Sarvikeihäs (Horn Spear - Boss Tier 2)',
        type: 'tool',
        requiresWorkbench: true,
        desc: 'Metsän Kauhun sydämestä ja sarvista veistetty ase. Tekee 55 vahinkoa.',
        cost: { beastHeart: 1, wood: 6 }
      },
      {
        id: 'beastArmor',
        category: 'tools',
        name: '🫀 Hirvitaljanen Haarniska (Boss Tier 2)',
        type: 'item',
        requiresWorkbench: true,
        desc: 'Sarvipadon paksusta nahasta ommeltu haarniska. Vähentää vahinkoa 40%.',
        cost: { beastHeart: 1, leather: 4 }
      },

      // --- IRON TIER (Sumusuot) ---
      {
        id: 'ironAxe',
        category: 'tools',
        name: '🪓 Rautakirves (Iron Axe - Tier 3)',
        type: 'tool',
        requiresWorkbench: true,
        desc: 'Suoraudasta taottu raskas kirves. Tekee 56 vahinkoa.',
        cost: { iron: 4, wood: 4 }
      },
      {
        id: 'ironPickaxe',
        category: 'tools',
        name: '⛏️ Rautahakku (Iron Pickaxe - Tier 3)',
        type: 'tool',
        requiresWorkbench: true,
        desc: 'Murtamaton rautahakku. Louhii vuoriston kovia hopeasuonia.',
        cost: { iron: 6, wood: 4 }
      },
      {
        id: 'ironSword',
        category: 'tools',
        name: '⚔️ Rautamiekka (Iron Longsword - Tier 3)',
        type: 'tool',
        requiresWorkbench: true,
        desc: 'Pitkä karkaistu rautaterä. Tekee 68 vahinkoa.',
        cost: { iron: 6, wood: 3 }
      },
      {
        id: 'ironArmor',
        category: 'tools',
        name: '🛡️ Rautapanssari (Iron Scale Mail - Tier 3)',
        type: 'item',
        requiresWorkbench: true,
        desc: 'Rautarenkaista ja levyistä taottu suoja. Vähentää vahinkoa 52%.',
        cost: { iron: 8, leather: 4 }
      },
      {
        id: 'scaleSword',
        category: 'tools',
        name: '🗡️ Suomumiekka (Scale Cleaver - Boss Tier 3)',
        type: 'tool',
        requiresWorkbench: true,
        desc: 'Vesipeto Näkin murtamattomista suomuista taottu miekka. Tekee 85 vahinkoa.',
        cost: { swampScale: 1, iron: 4 }
      },
      {
        id: 'scaleArmor',
        category: 'tools',
        name: '🐉 Suomuhaarniska (Boss Tier 3)',
        type: 'item',
        requiresWorkbench: true,
        desc: 'Suohirviön suomupanssari. Vähentää vahinkoa 62%.',
        cost: { swampScale: 1, leather: 6 }
      },

      // --- STEEL & SILVER TIER (Kalliovuoristo) ---
      {
        id: 'steelSword',
        category: 'tools',
        name: '⚔️ Taottu Teräsmiekka (Steel Sword - Tier 4)',
        type: 'tool',
        requiresWorkbench: true,
        desc: 'Ahjossa korkeassa lämmössä karkaistu teräsmiekka. Tekee 95 vahinkoa.',
        cost: { steel: 6, wood: 4 }
      },
      {
        id: 'silverSword',
        category: 'tools',
        name: '❄️ Hopeamiekka / Vuoristoterä (Tier 4)',
        type: 'tool',
        requiresWorkbench: true,
        desc: 'Pohjoisen tunturinhopeasta taottu pyhä terä. Tekee 110 vahinkoa.',
        cost: { silver: 6, wood: 4 }
      },
      {
        id: 'silverPickaxe',
        category: 'tools',
        name: '⛏️ Vuoristohakku (Silver Pickaxe - Tier 4)',
        type: 'tool',
        requiresWorkbench: true,
        desc: 'Hopealla karkaistu vuoristohakku. Louhii mustametallia ja arkaanisia kiviä.',
        cost: { silver: 6, wood: 4 }
      },
      {
        id: 'steelArmor',
        category: 'tools',
        name: '🛡️ Teräshaarniska (Steel Plate - Tier 4)',
        type: 'item',
        requiresWorkbench: true,
        desc: 'Vankka teräksinen rintapanssari. Vähentää vahinkoa 70%.',
        cost: { steel: 8, leather: 4 }
      },
      {
        id: 'titanHammer',
        category: 'tools',
        name: '🔨 Titaanivasara (Titan Warhammer - Boss Tier 4)',
        type: 'tool',
        requiresWorkbench: true,
        desc: 'Kallionmurskaajan graniittisydämestä taottu sotavasara. Tekee 130 vahinkoa!',
        cost: { graniteCore: 1, steel: 4 }
      },
      {
        id: 'plateArmor',
        category: 'tools',
        name: '💎 Graniittilevyhaarniska (Boss Tier 4)',
        type: 'item',
        requiresWorkbench: true,
        desc: 'Kallionkestävä täyslevyhaarniska. Vähentää vahinkoa 78%.',
        cost: { graniteCore: 1, steel: 6 }
      },

      // --- BLACK METAL & RUNE TIER (Riimupyhäkkö) ---
      {
        id: 'blackMetalSword',
        category: 'tools',
        name: '🌌 Mustametalliterä (Black Metal Sword - Tier 5)',
        type: 'tool',
        requiresWorkbench: true,
        desc: 'Riimupajassa taottu pimeä ja terävä mustametallimiekka. Tekee 145 vahinkoa!',
        cost: { blackMetal: 6, wood: 4 }
      },
      {
        id: 'blackMetalAxe',
        category: 'tools',
        name: '🪓 Mustametallikirves (Tier 5)',
        type: 'tool',
        requiresWorkbench: true,
        desc: 'Mustametallista taottu sotakirves. Tekee 135 vahinkoa.',
        cost: { blackMetal: 6, wood: 4 }
      },
      {
        id: 'runeblade',
        category: 'tools',
        name: '💠 Riimumiekka (Runeblade of Light - Boss Tier 5)',
        type: 'tool',
        requiresWorkbench: true,
        desc: 'Riimunvartijan ytimestä taottu maaginen miekka. Tekee 175 vahinkoa!',
        cost: { runeCore: 1, blackMetal: 4 }
      },
      {
        id: 'runicArmor',
        category: 'tools',
        name: '✨ Riimumestarin Haarniska (Boss Tier 5)',
        type: 'item',
        requiresWorkbench: true,
        desc: 'Arkaania riimuvoimaa huokuva haarniska. Vähentää vahinkoa 85%.',
        cost: { runeCore: 1, blackMetal: 6 }
      },

      // --- DRAGON TIER (Sysivuori & Endgame) ---
      {
        id: 'dragonSlayer',
        category: 'tools',
        name: '🐉 Draakinsurmaaja (Dragon Slayer - Endgame)',
        type: 'tool',
        requiresWorkbench: true,
        desc: 'Varjodraakin kruunusta ja lohikäärmeteräksestä taottu jumalmiekka. Tekee 250 vahinkoa!',
        cost: { dragonCrown: 1, dragonSteel: 6 }
      },
      {
        id: 'dragonArmor',
        category: 'tools',
        name: '👑 Kuninkaan Lohikäärmepanssari (Endgame)',
        type: 'item',
        requiresWorkbench: true,
        desc: 'Lopullinen kuninkaan panssari. Vähentää 92% kaikesta vahingosta!',
        cost: { dragonCrown: 1, dragonSteel: 8 }
      },
      {
        id: 'fishingRod',
        category: 'tools',
        name: '🎣 Kalastusvapa & Koho (Fishing Rod)',
        type: 'tool',
        desc: 'Vankka kalastusvapa ja koho joen antimien pyydystämiseen.',
        cost: { wood: 3, leather: 1 }
      },

      // --- METALS & SMELTING (Malmien Sulatus) ---
      {
        id: 'coal',
        category: 'metals',
        name: '⚫ Puuhiili (Smelter Charcoal)',
        type: 'item',
        desc: 'Polttoainetta sulattouunille ja sepän pajalle.',
        cost: { wood: 2 }
      },
      {
        id: 'bronze',
        category: 'metals',
        name: '🪙 Sulata Pronssiharkko (Bronze Ingot)',
        type: 'item',
        desc: 'Sulata kuparimalmia ja tinamalmia hiilellä pronssiksi.',
        cost: { copperOre: 2, tinOre: 1, coal: 1 }
      },
      {
        id: 'iron',
        category: 'metals',
        name: '⚔️ Sulata Rautaharkko (Iron Ingot)',
        type: 'item',
        desc: 'Puhdista suomalmi puuhiilellä takoraudaksi.',
        cost: { ironOre: 1, coal: 1 }
      },
      {
        id: 'steel',
        category: 'metals',
        name: '🛡️ Tao Teräsharkko (Steel Ingot)',
        type: 'item',
        desc: 'Karkaise rautaa puuhiilellä vahvaksi teräkseksi.',
        cost: { iron: 1, coal: 2 }
      },
      {
        id: 'silver',
        category: 'metals',
        name: '✨ Sulata Hopeaharkko (Silver Ingot)',
        type: 'item',
        desc: 'Sulata tunturien kimmeltävää hopeamalmia.',
        cost: { silverOre: 1, coal: 1 }
      },
      {
        id: 'blackMetal',
        category: 'metals',
        name: '🌌 Sulata Mustametalliharkko (Black Metal)',
        type: 'item',
        desc: 'Sulattouunissa riimuilla rikastettu musta metalli.',
        cost: { blackMetalScrap: 2, coal: 2 }
      },
      {
        id: 'dragonSteel',
        category: 'metals',
        name: '👑 Sulata Lohikäärmeteräs (Dragon Steel)',
        type: 'item',
        desc: 'Sysivuoren tulimalmista ja lohikäärmeen kyyneleestä taottu jumalmetalli.',
        cost: { flametalOre: 2, dragonTears: 1, coal: 3 }
      },

      // --- BUILDINGS (Rakentaminen) ---
      {
        id: 'campfire',
        category: 'building',
        name: '🔥 Leirituli (Campfire)',
        type: 'building',
        desc: 'Luo valoa, lämpöä, paistaa ruokaa ja pitää pedot loitolla.',
        cost: { wood: 4, stone: 3 }
      },
      {
        id: 'standingTorch',
        category: 'building',
        name: '🕯️ Seisova Soihtuteline (Standing Brazier)',
        type: 'building',
        desc: 'Korkea valaiseva soihtuteline leirin ja polkujen valaisuun.',
        cost: { wood: 2, stone: 1 }
      },
      {
        id: 'woodenWall',
        category: 'building',
        name: '🪵 Hirsiseinä (Wooden Wall)',
        type: 'building',
        desc: 'Suojaava hirsiseinä tukikohdan rakentamiseen.',
        cost: { wood: 5, stone: 0 }
      },
      {
        id: 'stoneWall',
        category: 'building',
        name: '🧱 Kivimuuri (Stone Wall)',
        type: 'building',
        desc: 'Vankka kivilinnoitus, joka kestää peikkojenkin iskut.',
        cost: { wood: 0, stone: 6 }
      },
      {
        id: 'woodenFloor',
        category: 'building',
        name: '🪚 Puulattia (Wooden Floor)',
        type: 'building',
        desc: 'Vahva lankkulattia tukikohdan perustukseksi.',
        cost: { wood: 4, stone: 0 }
      },
      {
        id: 'stoneFloor',
        category: 'building',
        name: '🏛️ Kivilattia (Stone Floor)',
        type: 'building',
        desc: 'Monumentaalinen kivilattia taloihin ja pihoille.',
        cost: { wood: 0, stone: 4 }
      },
      {
        id: 'woodenRoof',
        category: 'building',
        name: '🏠 Tiilikatto (Roof)',
        type: 'building',
        desc: 'Sateelta ja pedoilta suojaava harjakatto.',
        cost: { wood: 6, stone: 2 }
      },
      {
        id: 'woodenStairs',
        category: 'building',
        name: '🪜 Puuportaat (Stairs)',
        type: 'building',
        desc: 'Portaat toiseen kerrokseen tai vartiotorniin.',
        cost: { wood: 4, stone: 0 }
      },
      {
        id: 'woodenDoor',
        category: 'building',
        name: '🚪 Puuovi (Door)',
        type: 'building',
        desc: 'Suljettava vankka puuovi.',
        cost: { wood: 4, stone: 0 }
      },
      {
        id: 'palisade',
        category: 'building',
        name: '🛡️ Paaluaita / Suojamuuri (Palisade)',
        type: 'building',
        desc: 'Teräväkärkinen paaluaita kylän ja pellon suojaamiseen.',
        cost: { wood: 6, stone: 0 }
      },
      {
        id: 'smelter',
        category: 'building',
        name: '🌋 Sulattouuni (Smelter)',
        type: 'building',
        desc: 'Korkealämpöuuni malmien sulattamiseen harkoiksi.',
        cost: { wood: 4, stone: 12 }
      },
      {
        id: 'forge',
        category: 'building',
        name: '🔨 Ahjo & Alasin (Forge)',
        type: 'building',
        desc: 'Sepän alasin ja tulisija aseiden ja panssarien takomiseen.',
        cost: { wood: 6, stone: 8 }
      },
      {
        id: 'bed',
        category: 'building',
        name: '🛏️ Viking-Sänky (Bed)',
        type: 'building',
        desc: 'Mukava taljasänky levähtämiseen ja yön viettoon.',
        cost: { wood: 6, stone: 0 }
      },
      {
        id: 'table',
        category: 'building',
        name: '🪵 Pirtin Ruokapöytä (Table)',
        type: 'building',
        desc: 'Massiivitamminen ruokapöytä tuvan sisustukseen.',
        cost: { wood: 5, stone: 0 }
      },
      {
        id: 'chair',
        category: 'building',
        name: '🪑 Tammipenkki (Chair)',
        type: 'building',
        desc: 'Vankkatekoinen tuoli pirtin pöydän ääreen.',
        cost: { wood: 3, stone: 0 }
      },
      {
        id: 'chest',
        category: 'building',
        name: '📦 Puuarkku (Storage Chest)',
        type: 'building',
        desc: 'Turvallinen puuarkku tavaroiden säilytykseen.',
        cost: { wood: 6, stone: 0 }
      },
      {
        id: 'barrel',
        category: 'building',
        name: '🛢️ Viljatynnyri (Storage Barrel)',
        type: 'building',
        desc: 'Raudalla vannotettu tynnyri viljan ja malmien säilömiseen.',
        cost: { wood: 5, stone: 1 }
      },
      {
        id: 'workbench',
        category: 'building',
        name: '🛠️ Työpöytä (Workbench)',
        type: 'building',
        desc: 'Puusepän pöytä työkalujen huoltamiseen.',
        cost: { wood: 8, stone: 4 }
      },

      // --- FOOD & SURVIVAL ---
      {
        id: 'cookedMeat',
        category: 'food',
        name: '🥩 Paistettu Liha (Cooked Meat)',
        type: 'item',
        desc: 'Herkullinen nuotiopaisti. Palauttaa +50 nälkää ja +35 terveyttä.',
        cost: { meat: 1, wood: 1 }
      },
      {
        id: 'cookedFish',
        category: 'food',
        name: '🍲 Paistettu Kala (Cooked Fish)',
        type: 'item',
        desc: 'Nuotiolla kullankeltaiseksi paistettu kala. Palauttaa +45 nälkää ja +30 terveyttä.',
        cost: { trout: 1, wood: 1 }
      },
      {
        id: 'bread',
        category: 'food',
        name: '🍞 Rapea Ruisleipä (Baked Bread)',
        type: 'item',
        desc: 'Pellon tuoreesta viljasta paistettu ruisleipä. Palauttaa +40 nälkää ja +20 terveyttä.',
        cost: { wheat: 3, wood: 1 }
      },
      {
        id: 'bandage',
        category: 'food',
        name: '🩹 Yrttiside (Herbal Bandage)',
        type: 'item',
        desc: 'Lääkintäside marjamehulla. Palauttaa välittömästi +45 terveyttä.',
        cost: { berry: 3, wood: 0 }
      },
      {
        id: 'berryStew',
        category: 'food',
        name: '🥣 Marjamuhennos (Berry Stew)',
        type: 'item',
        desc: 'Makea erämaamuhennos. Palauttaa +35 nälkää ja +20 terveyttä.',
        cost: { berry: 4, wood: 1 }
      },
      {
        id: 'mushroomSoup',
        category: 'food',
        name: '🍲 Kermainen Sienikeitto (Mushroom Soup)',
        type: 'item',
        desc: 'Metsän antimista keitetty täyteläinen keitto. Palauttaa +65 Nälkää, +45 HP ja +60 Staminaa.',
        cost: { mushroom: 3, wood: 1 }
      },
      {
        id: 'meatStew',
        category: 'food',
        name: '🥘 Tuhti Riistapata (Hearty Meat Stew)',
        type: 'item',
        desc: 'Valtavan voimistava metsästäjän pata. Palauttaa +85 Nälkää, +60 HP ja +75 Staminaa.',
        cost: { cookedMeat: 1, mushroom: 2, carrot: 1 }
      },
      {
        id: 'honeyBread',
        category: 'food',
        name: '🍞 Makea Hunajaleipä (Honey Bread)',
        type: 'item',
        desc: 'Pellon viljasta ja villihunajasta leivottu leipä. Palauttaa +55 Nälkää, +35 HP ja +50 Staminaa.',
        cost: { wheat: 2, honey: 1, wood: 1 }
      }
    ];

    this.setupListeners();
  }

  setupListeners() {
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
      // Both 'KeyC' and 'Tab' toggle crafting!
      if (e.code === 'KeyC' || e.code === 'Tab') {
        e.preventDefault();
        this.toggle();
      } else if (e.code === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    if (this.closeBtn) {
      const handleClose = (e) => {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        this.close();
      };
      this.closeBtn.addEventListener('click', handleClose);
      this.closeBtn.addEventListener('pointerdown', handleClose);
      this.closeBtn.addEventListener('touchend', handleClose);
    }

    // Connect HUD quick button if available
    const hudCraftBtn = document.getElementById('open-craft-btn');
    if (hudCraftBtn) {
      hudCraftBtn.addEventListener('click', () => {
        this.open();
      });
    }
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    this.isOpen = true;
    if (this.container) {
      this.container.classList.add('active');
    }
    if (this.controls && this.controls.isLocked) {
      this.controls.unlock();
    }
    this.render();
  }

  close() {
    this.isOpen = false;
    if (this.container) {
      this.container.classList.remove('active');
    }
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

  isNearWorkbench() {
    if (!this.player) return true;
    const pPos = (this.player.getPosition) ? this.player.getPosition() : (this.player.playerPos || { x: 0, z: 0 });

    // 1. Check world pre-placed town workbenches
    const worldWbs = (this.player.world && this.player.world.workbenches) ? this.player.world.workbenches : [
      { x: 5.5, z: 1.5 },
      { x: -24, z: -30 },
      { x: -22, z: 27 }
    ];

    for (const wb of worldWbs) {
      const d = Math.hypot(pPos.x - wb.x, pPos.z - wb.z);
      if (d <= 8.5) return true;
    }

    // 2. Check player-placed workbenches from buildingSystem (checks both placedStructures and placedPieces)
    const structures = (this.buildingSystem?.placedStructures || this.buildingSystem?.placedPieces || []);
    for (const p of structures) {
      if (p.type === 'workbench' || (typeof p.type === 'string' && p.type.includes('workbench'))) {
        const posX = p.position ? p.position.x : (p.mesh ? p.mesh.position.x : 0);
        const posZ = p.position ? p.position.z : (p.mesh ? p.mesh.position.z : 0);
        const d = Math.hypot(pPos.x - posX, pPos.z - posZ);
        if (d <= 8.5) return true;
      }
    }

    return false;
  }

  getRecipeName(recipe, isFi) {
    if (recipe.nameEn && !isFi) return recipe.nameEn;
    if (recipe.nameFi && isFi) return recipe.nameFi;
    const match = recipe.name.match(/^([^\s]+)\s+([^\(]+)\s*\((.+)\)$/);
    if (match) {
      const icon = match[1];
      const fiName = match[2].trim();
      const enName = match[3].trim();
      return isFi ? `${icon} ${fiName}` : `${icon} ${enName}`;
    }
    return recipe.name;
  }

  getRecipeDesc(recipe, isFi) {
    if (recipe.descEn && !isFi) return recipe.descEn;
    if (recipe.descFi && isFi) return recipe.descFi;
    if (!isFi) {
      const descMap = {
        stoneAxe: 'Essential tool for chopping trees! Cuts down birch and pine trees. Deals 25 damage.',
        pickaxe: 'Essential tool for mining rock and ore veins! Deals 22 damage.',
        hammer: 'Enables placing walls, floors, campfires, and crafting stations [B].',
        huntingBow: 'Ranged weapon. Shoots arrows with high accuracy. Deals 60 damage.',
        arrow: 'Quiver of 10 sharp arrows for bow combat.',
        runicStaff: 'Ancient mystical staff. Fires bolts of magical runic energy.',
        fishingRod: 'Enables fishing from river piers and lakeshores [Press E on pier].',
        torch: 'Illuminates the dark wilderness and wards off nocturnal beasts. Deals fire damage!',
        stoneSpear: 'Sharp throwing & thrusting spear. Great reach and quick attacks.',
        stoneClub: 'Heavy stone-headed mace. Crushes bones and deals 38 damage.',
        stoneDagger: 'Swift flint dagger. Delivers rapid attacks dealing 28 damage.',
        stoneShield: 'Bulky stone-plated shield. Blocks up to 45% incoming damage.',
        stoneArmor: 'Chiseled stone plate cuirass. Grants 25% physical damage resistance.',
        antlerPickaxe: 'Antler pickaxe carved from the Forest Beast. Mines copper and tin in the Black Forest.',
        antlerBow: 'Ancient recurve bow carved from legendary beast horns. Deals 75 damage.',
        bronzeAxe: 'Forged bronze woodcutting axe. Chops hard timber trees faster. Deals 36 damage.',
        bronzePickaxe: 'Forged bronze pickaxe. Mines copper, tin, and rock veins easily.',
        bronzeSword: 'Forged bronze blade. Deals 48 damage with rapid swings.',
        shield: 'Sturdy wooden shield. Blocks up to 35% incoming enemy damage.',
        ironAxe: 'Heavy iron battleaxe. Crushes wood and armored foes alike.',
        ironPickaxe: 'Forged iron pickaxe. Able to breach deep iron and silver ore nodes.',
        ironSword: 'Razor-sharp tempered iron longsword. Deals 68 damage.',
        steelSword: 'Master-forged Nordic steel blade. Deals 95 damage.',
        silverSword: 'Glacier silver sword forged with frost runes. Deals 110 damage.',
        titanHammer: 'Massive granite-reinforced warhammer. High stagger and 130 damage.',
        blackMetalSword: 'Dark otherworldly blackmetal blade. Deals 145 damage.',
        runeblade: 'Ancient runic blade pulsing with primordial arcane energy. Deals 175 damage.',
        dragonSlayer: 'Mythical greatsword forged in dragonfire. Supreme endgame weapon (250 DMG).',
        leatherArmor: 'Supple leather armor. Grants 18% physical damage resistance.',
        bronzeArmor: 'Tempered bronze armor. Grants 32% physical damage resistance.',
        beastArmor: 'Heavy beast hide vest. Grants 40% physical damage resistance.',
        ironArmor: 'Chainmail & iron plate cuirass. Grants 52% physical damage resistance.',
        scaleArmor: 'Glittering serpent scale coat. Grants 62% physical damage resistance.',
        steelArmor: 'Knightly forged steel full plate. Grants 70% physical damage resistance.',
        plateArmor: 'Granite-infused heavy bulwark armor. Grants 78% physical damage resistance.',
        runicArmor: 'Archmage runic infused vestment. Grants 85% physical damage resistance.',
        dragonArmor: 'Supreme God-King Dragonplate Armor. Grants 92% physical damage resistance.',
        bandage: 'Herbal wound dressing. Restores 35 Health over 4 seconds.',
        cookedMeat: 'Roast raw beast meat into a delicious steak (+50 Hunger, +35 HP).',
        bread: 'Bake harvested wheat into fresh rye bread (+45 Hunger, +25 HP).'
      };
      if (descMap[recipe.id]) return descMap[recipe.id];
    }
    return recipe.desc;
  }

  render() {
    if (!this.recipeListEl) return;

    const nearWorkbench = this.isNearWorkbench();
    const isFi = Localization.getLanguage() === 'fi';

    // Render tabs in dedicated tabs container
    const tabs = [
      { id: 'all', label: isFi ? 'Kaikki' : 'All' },
      { id: 'tools', label: isFi ? 'Aseet & Työkalut' : 'Weapons & Tools' },
      { id: 'metals', label: isFi ? 'Metallit & Sulatus' : 'Metals & Smelting' },
      { id: 'building', label: isFi ? 'Rakennukset [B]' : 'Building [B]' },
      { id: 'food', label: isFi ? 'Ruoka & Lääkkeet' : 'Food & Meds' }
    ];

    const tabsHtml = tabs.map(t =>
      `<button class="craft-tab ${this.currentCategory === t.id ? 'active' : ''}" data-cat="${t.id}">${t.label}</button>`
    ).join('');

    if (this.tabsContainer) {
      this.tabsContainer.innerHTML = tabsHtml;
      this.tabsContainer.querySelectorAll('.craft-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          this.currentCategory = tab.dataset.cat;
          this.render();
        });
      });
    }

    // Filter recipes by current category
    const filtered = this.currentCategory === 'all'
      ? this.recipes
      : this.recipes.filter(r => r.category === this.currentCategory);

    let html = '';

    filtered.forEach((recipe) => {
      const cost = recipe.cost;
      let canCraft = true;
      for (const [mat, amount] of Object.entries(cost)) {
        if (amount > 0 && !this.inventory.has(mat, amount)) {
          canCraft = false;
          break;
        }
      }

      const needsWb = !!recipe.requiresWorkbench;
      const wbMissing = needsWb && !nearWorkbench;
      if (wbMissing) {
        canCraft = false;
      }

      const isEquippedTool = recipe.type === 'tool' && this.inventory.tools && this.inventory.tools[recipe.id];
      const isEquippedArmor = recipe.id.includes('Armor') && this.inventory.equippedArmor === recipe.id;

      let btnLabel = isEquippedTool || isEquippedArmor 
        ? (isFi ? 'VARUSTETTU' : 'EQUIPPED')
        : (recipe.type === 'building' ? (isFi ? 'RAKENNA' : 'BUILD') : (isFi ? 'VALMISTA' : 'CRAFT'));
      if (wbMissing && !isEquippedTool && !isEquippedArmor) {
        btnLabel = isFi ? '🔨 VAATII TYÖPÖYDÄN' : '🔨 WORKBENCH NEEDED';
      }

      const wbLabel = isFi ? '🔨 Työpöytä' : '🔨 Workbench';

      html += `
        <div class="recipe-card ${wbMissing ? 'workbench-locked' : ''}">
          <div>
            <div class="recipe-title">${this.getRecipeName(recipe, isFi)}</div>
            <div class="recipe-desc">${this.getRecipeDesc(recipe, isFi)}</div>
            <div class="recipe-reqs">
              ${needsWb ? `<span class="req-pill ${nearWorkbench ? 'met' : 'unmet'}">${wbLabel}</span>` : ''}
              ${Object.entries(cost).map(([itemKey, amount]) => {
                if (amount <= 0) return '';
                const hasEnough = this.inventory.has(itemKey, amount);
                const itemName = this.inventory.getItemName ? this.inventory.getItemName(itemKey) : itemKey;
                return `<span class="req-pill ${hasEnough ? 'met' : 'unmet'}">${itemName}: ${amount}</span>`;
              }).join('')}
            </div>
          </div>
          <div>
            <button class="craft-btn" data-recipe-id="${recipe.id}" ${!canCraft ? 'disabled' : ''}>
              ${btnLabel}
            </button>
          </div>
        </div>
      `;
    });

    this.recipeListEl.innerHTML = html;

    // Attach craft buttons
    this.recipeListEl.querySelectorAll('.craft-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const recipeId = btn.getAttribute('data-recipe-id');
        const recipe = this.recipes.find(r => r.id === recipeId);
        if (recipe) {
          this.craft(recipe);
        }
      });
    });
  }

  craft(recipe) {
    if (recipe.requiresWorkbench && !this.isNearWorkbench()) {
      if (this.hud) {
        this.hud.showNotification('⚠️ Tämä esine vaatii työpöydän (Workbench) läheisyyttä! Mene kylän työpöydälle tai rakenna oma vasaralla [B].', 3500);
      }
      return;
    }

    const cost = recipe.cost;
    let canAfford = true;
    for (const [mat, amount] of Object.entries(cost)) {
      if (amount > 0 && !this.inventory.has(mat, amount)) {
        canAfford = false;
        break;
      }
    }

    if (!canAfford) {
      if (this.hud) this.hud.showNotification('Materiaaleja puuttuu!');
      return;
    }

    // Deduct resources
    for (const [mat, amount] of Object.entries(cost)) {
      if (amount > 0) {
        this.inventory.remove(mat, amount);
      }
    }

    if (recipe.type === 'tool') {
      if (!this.inventory.tools) this.inventory.tools = {};
      this.inventory.tools[recipe.id] = true;
      this.inventory.equip(recipe.id);

      if (this.audioManager) this.audioManager.playCraft();
      if (this.questManager) this.questManager.onCraft(recipe.id);
      if (this.achievementManager) this.achievementManager.onCraft(recipe.id);
      if (this.hud) {
        this.hud.showNotification(`⚔️ Valmistettu ja varustettu: ${recipe.name}!`);
      }
      this.render();
    } else if (recipe.type === 'building') {
      this.close();
      if (this.buildingSystem) {
        this.buildingSystem.startPlacing(recipe.id);
      }
    } else if (recipe.type === 'item') {
      const count = recipe.count || 1;
      if (recipe.id.includes('Armor')) {
        this.inventory.equipArmor(recipe.id);
      } else {
        this.inventory.add(recipe.id, count);
      }
      if (this.audioManager) this.audioManager.playCraft();
      if (this.achievementManager) this.achievementManager.onCraft(recipe.id);
      if (this.hud) {
        this.hud.showNotification(`📦 Valmistettu: ${recipe.name}!`);
        this.hud.showPickupText(`+${count} ${recipe.name}`);
      }
      this.render();
    }
  }
}
