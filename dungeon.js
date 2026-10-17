// Arena dungeon Shardfall: aula batu 80x80 dari KayKit Dungeon Pack (CC0) di assets/dungeon/.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const E = 40; // sumbu dinding (bagian dalam ada di E - 0.5)

const NAMES = [
  'floor_tile_large', 'floor_dirt_large',
  'wall', 'wall_pillar', 'wall_doorway',
  'pillar', 'pillar_decorated',
  'torch_mounted',
  'banner_red', 'banner_shield_blue',
  'barrel_large', 'barrel_small', 'barrel_small_stack', 'keg',
  'crates_stacked', 'chest_gold', 'rubble_large', 'table_long_decorated_A',
];

export const DUNGEON_MODEL_COUNT = NAMES.length;

// Pengacak deterministik supaya lantai selalu sama
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

export async function buildDungeon(onProgress) {
  const loader = new GLTFLoader().setPath('assets/dungeon/');
  const models = {};
  let done = 0;
  await Promise.all(
    NAMES.map(async (n) => {
      const g = await loader.loadAsync(n + '.gltf');
      g.scene.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      models[n] = g.scene;
      onProgress?.(++done, NAMES.length);
    })
  );

  const group = new THREE.Group();
  const colliders = [];
  const flames = [];
  const lights = [];

  const put = (name, x, y, z, ry = 0, s = 1) => {
    const o = models[name].clone();
    o.position.set(x, y, z);
    o.rotation.y = ry;
    o.scale.setScalar(s);
    group.add(o);
    return o;
  };
  const rect = (cx, cz, hx, hz) => colliders.push({ x0: cx - hx, x1: cx + hx, z0: cz - hz, z1: cz + hz });

  // Banyak salinan model yang sama -> InstancedMesh (hemat draw call, penting di HP)
  function instanced(name, mats) {
    const model = models[name];
    model.updateMatrixWorld(true);
    const m = new THREE.Matrix4();
    model.traverse((o) => {
      if (!o.isMesh) return;
      const im = new THREE.InstancedMesh(o.geometry, o.material, mats.length);
      mats.forEach((mat, i) => im.setMatrixAt(i, m.multiplyMatrices(mat, o.matrixWorld)));
      im.castShadow = o.castShadow;
      im.receiveShadow = true;
      im.frustumCulled = false;
      group.add(im);
    });
  }
  const mat4 = (x, y, z, ry) => new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry),
    new THREE.Vector3(1, 1, 1)
  );

  // ---------- Lantai: ubin besar 4x4, sebagian tanah ----------
  const rnd = rng(7);
  const tiles = [];
  const dirt = [];
  for (let i = -10; i < 10; i++) {
    for (let j = -10; j < 10; j++) {
      const m = mat4(i * 4 + 2, -0.1, j * 4 + 2, Math.floor(rnd() * 4) * (Math.PI / 2));
      (rnd() < 0.14 ? dirt : tiles).push(m);
    }
  }
  instanced('floor_tile_large', tiles);
  instanced('floor_dirt_large', dirt);

  // ---------- Dinding keliling (+z lokal = sisi dalam) ----------
  // Tiap sisi: 21 modul 4 unit; tiap modul ke-4 berupa tiang dinding; pintu keluar di tengah dinding utara.
  const plain = [];
  const pillars = [];
  const doorway = [];
  const sides = [
    { rot: 0, at: (t) => [t, -E] }, // selatan
    { rot: Math.PI, at: (t) => [t, E] }, // utara
    { rot: Math.PI / 2, at: (t) => [-E, t] }, // barat
    { rot: -Math.PI / 2, at: (t) => [E, t] }, // timur
  ];
  sides.forEach((s, si) => {
    for (let k = 0; k < 21; k++) {
      const t = -E + k * 4;
      const [x, z] = s.at(t);
      const m = mat4(x, 0, z, s.rot);
      if (si === 1 && k === 10) doorway.push(m);
      else if (k % 4 === 0) pillars.push(m);
      else plain.push(m);
    }
  });
  instanced('wall', plain);
  instanced('wall_pillar', pillars);
  instanced('wall_doorway', doorway);
  rect(0, -E, E + 2, 1);
  rect(-E, 0, 1, E + 2);
  rect(E, 0, 1, E + 2);
  rect(-21, E, 19, 1);
  rect(21, E, 19, 1);

  // ---------- Obor, spanduk, dan cahaya ----------
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffa83a });
  const flameGeo = new THREE.ConeGeometry(0.14, 0.5, 6);
  const wallFrame = (si, t, local) => {
    // titik di sisi dalam dinding: t sepanjang dinding, local = [x, y, z] relatif muka dinding (+z = ke dalam)
    const s = sides[si];
    const [bx, bz] = s.at(t);
    const g = new THREE.Group();
    g.position.set(bx, 0, bz);
    g.rotation.y = s.rot;
    group.add(g);
    return g;
  };
  const lightSpots = new Set(['0:-12', '0:12', '1:-12', '1:12', '2:4', '3:-4']);
  for (let si = 0; si < 4; si++) {
    for (const t of [-12, -4, 4, 12]) {
      const g = wallFrame(si, t);
      const torch = models.torch_mounted.clone();
      torch.position.set(0, 2.4, 0.5);
      g.add(torch);
      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.set(0, 3.15, 0.8);
      g.add(flame);
      flames.push(flame);
      if (lightSpots.has(si + ':' + t)) {
        const l = new THREE.PointLight(0xff9a3c, 40, 34, 2);
        l.position.set(0, 3.1, 1.4);
        g.add(l);
        lights.push({ l, base: 40, phase: si * 1.7 + t });
      }
    }
    for (const t of [-32, -16, 16, 32]) {
      const g = wallFrame(si, t);
      const b = models[(si + (t > 0 ? 1 : 0)) % 2 ? 'banner_red' : 'banner_shield_blue'].clone();
      b.position.set(0, 0, 0.1);
      g.add(b);
    }
  }

  // ---------- Tiang dan prop ----------
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      put('pillar_decorated', sx * 14, 0, sz * 14);
      rect(sx * 14, sz * 14, 1.2, 1);
      put('pillar', sx * 28, 0, sz * 28);
      rect(sx * 28, sz * 28, 0.9, 0.9);
    }
  }
  // sudut barat daya
  put('barrel_large', -35, 0, -35);
  put('barrel_small', -32.8, 0, -35.6, 0.6);
  put('crates_stacked', -36, 0, -31, 0.3);
  rect(-34, -34, 3, 3.5);
  // sudut tenggara
  put('barrel_small_stack', 35, 0, -35.5, 0.2);
  put('keg', 32, 0, -36.2, 1.2);
  put('chest_gold', 36, 0, -31.5, -Math.PI / 2);
  rect(34, -34, 3, 3.5);
  // sudut barat laut
  put('table_long_decorated_A', -34, 0, 31, Math.PI / 2);
  put('barrel_large', -36, 0, 36);
  rect(-34, 33, 3, 4);
  // sudut timur laut
  put('crates_stacked', 35, 0, 35, -0.2);
  put('barrel_small', 32.7, 0, 36, 0.4);
  rect(34, 35, 3, 2);
  // reruntuhan di sepanjang dinding barat
  put('rubble_large', -37, 0, 14, Math.PI / 2);
  rect(-37, 14, 2, 4.2);

  return {
    group,
    colliders,
    update(t) {
      for (const f of lights) f.l.intensity = f.base * (0.88 + 0.12 * Math.sin(t * 7 + f.phase) + 0.05 * Math.sin(t * 17 + f.phase * 2));
      const s = 1 + 0.18 * Math.sin(t * 11);
      for (const fl of flames) fl.scale.set(s, 0.9 + 0.2 * Math.sin(t * 13), s);
    },
  };
}
