import fs from 'fs';
['Barbarian.glb', 'Ranger.glb', 'Rogue.glb'].forEach(f => {
  const buf = fs.readFileSync('public/assets/KayKit_Adventurers_2.0_FREE/KayKit_Adventurers_2.0_FREE/Characters/gltf/' + f);
  const len = buf.readUInt32LE(12);
  const gltf = JSON.parse(buf.subarray(20, 20 + len).toString('utf8'));
  console.log(f);
  const headMesh = gltf.meshes.find(m => m.name.includes('Head'));
  console.log('head mesh:', headMesh);
});
