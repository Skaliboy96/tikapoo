import { readdirSync, copyFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const BASE = 'c:/Users/juhol/Desktop/tikapoo';

const JOBS = [
  {
    src: `${BASE}/Stylized Nature MegaKit[Standard]/glTF`,
    dst: `${BASE}/public/assets/nature`,
    pick: new Set([
      'Pine_1.gltf','Pine_2.gltf','Pine_3.gltf','Pine_4.gltf','Pine_5.gltf',
      'CommonTree_1.gltf','CommonTree_2.gltf','CommonTree_3.gltf',
      'DeadTree_1.gltf','DeadTree_2.gltf','DeadTree_3.gltf',
      'TwistedTree_1.gltf','TwistedTree_2.gltf',
      'Bush_Common.gltf','Bush_Common_Flowers.gltf',
      'Rock_Medium_1.gltf','Rock_Medium_2.gltf','Rock_Medium_3.gltf',
      'Mushroom_Common.gltf','Mushroom_Laetiporus.gltf',
      'Fern_1.gltf','Grass_Common_Tall.gltf',
      'Flower_3_Group.gltf','Flower_4_Group.gltf',
      'Plant_1.gltf','Plant_7.gltf','Clover_1.gltf',
    ]),
  },
  {
    src: `${BASE}/Fantasy Props MegaKit[Standard]/Exports/glTF`,
    dst: `${BASE}/public/assets/props`,
    pick: new Set([
      'Chest_Wood.gltf','Barrel.gltf','Barrel_Apples.gltf',
      'Axe_Bronze.gltf','Sword_Bronze.gltf','Pickaxe_Bronze.gltf',
      'Dummy.gltf','WeaponStand.gltf',
      'Anvil.gltf','Anvil_Log.gltf',
      'Bag.gltf','Cauldron.gltf',
      'FarmCrate_Apple.gltf','FarmCrate_Carrot.gltf',
      'Bench.gltf','Chair_1.gltf',
      'CandleStick.gltf','CandleStick_Stand.gltf',
    ]),
  },
  {
    src: `${BASE}/Medieval Village MegaKit[Standard]/Medieval Village MegaKit[Standard]/glTF`,
    dst: `${BASE}/public/assets/village`,
    pick: new Set([
      'Wall_Plaster_Straight.gltf',
      'Wall_UnevenBrick_Straight.gltf',
      'Door_1_Flat.gltf','Door_2_Flat.gltf',
      'Roof_RoundTiles_4x4.gltf','Roof_RoundTiles_4x6.gltf',
      'Floor_WoodDark.gltf','Floor_WoodLight.gltf',
      'Prop_Wagon.gltf','Prop_WoodenFence_Single.gltf',
      'Prop_Crate.gltf','Prop_Chimney.gltf',
      'Stairs_Exterior_Straight.gltf',
    ]),
  },
];

let total = 0;
for (const job of JOBS) {
  if (!existsSync(job.src)) { console.log('SKIP:', job.src); continue; }
  mkdirSync(job.dst, { recursive: true });
  const files = readdirSync(job.src);
  for (const f of files) {
    // Copy if it's an explicitly picked model OR it's a texture/binary (needed by any gltf)
    const isModel = job.pick.has(f);
    const isTexture = f.endsWith('.png') || f.endsWith('.bin') || f.endsWith('.jpg');
    if (!isModel && !isTexture) continue;
    const dst = join(job.dst, f);
    if (existsSync(dst)) continue;
    try { copyFileSync(join(job.src, f), dst); total++; }
    catch(e) { console.warn('  WARN:', f, e.message); }
  }
  console.log('Copied to', job.dst);
}
console.log('Total files copied:', total);
