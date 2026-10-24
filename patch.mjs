import { readFileSync, writeFileSync } from 'fs';

// Patch DayNightCycle.js – inject questManager parameter + night survived hook
let dayNight = readFileSync('./src/DayNightCycle.js', 'utf8');

// Add questManager property after audioManager assignment
dayNight = dayNight.replace(
  'this.questManager = questManager;',
  '' // already done by edit_file above – noop if already there
);

// If not already patched, add quest call after dawn notification
if (!dayNight.includes('questManager.onNightSurvived')) {
  // Find the dawn notification block and append quest call
  // We search for the dawn comment + hud notification pattern
  dayNight = dayNight.replace(
    /\/\/ Dawn breaks[\s\S]*?this\.hud\.showNotification\([^)]+\);\s*\n(\s*)\}/,
    (match, indent) => {
      return match.replace(
        /(\s*)\}/,
        `
      if (this.questManager) {
        this.questManager.onNightSurvived();
      }
    }`
      );
    }
  );
}

writeFileSync('./src/DayNightCycle.js', dayNight, 'utf8');

// Patch CraftingMenu.js – inject questManager parameter + onCraft call
let crafting = readFileSync('./src/CraftingMenu.js', 'utf8');

if (!crafting.includes('this.questManager')) {
  crafting = crafting.replace(
    'constructor(inventory, buildingSystem, player, hud, audioManager, controls)',
    'constructor(inventory, buildingSystem, player, hud, audioManager, controls, questManager)'
  );
  crafting = crafting.replace(
    `    this.controls = controls;\n\n    this.isOpen`,
    `    this.controls = controls;\n    this.questManager = questManager;\n\n    this.isOpen`
  );
}

// Inject quest notification after tool craft
if (!crafting.includes('questManager.onCraft')) {
  crafting = crafting.replace(
    `      if (this.audioManager) this.audioManager.playCraft();`,
    `      if (this.audioManager) this.audioManager.playCraft();\n      if (this.questManager) this.questManager.onCraft(recipe.id);`
  );
}

writeFileSync('./src/CraftingMenu.js', crafting, 'utf8');

// Patch BuildingSystem.js – add onPlace callback hook
let building = readFileSync('./src/BuildingSystem.js', 'utf8');
if (!building.includes('this.onPlace')) {
  // Add onPlace property in constructor near end
  building = building.replace(
    /this\.campfires\s*=\s*\[\];/,
    `this.campfires = [];\n    this.onPlace = null; // callback(structureType)`
  );
  // Call it when a structure is placed
  // Find where campfire/wall/floor is added to scene
  building = building.replace(
    /this\.campfires\.push\(([^)]+)\);/,
    `this.campfires.push($1);\n    if (this.onPlace) this.onPlace('campfire');`
  );
}
writeFileSync('./src/BuildingSystem.js', building, 'utf8');

console.log('Patches applied successfully!');
