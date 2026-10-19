// Desa hub Shardfall: dirakit dari paket modular (dinding, atap, jendela, prop) di assets/village/.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const VILLAGE_NAME = 'Cracked Valley Village';

// Kalau bagian depan/belakang atap terlihat dobel atau tembus, ubah ke false / true.
const USE_GABLES = true;

const WALL_H = 3.0; // tinggi dinding modular (atap dipasang di sini)

// Tata letak rumah. rot: 0 = pintu menghadap +z, PI = -z, PI/2 = +x, -PI/2 = -x.
// nw = lebar (modul 2 unit), nd = kedalaman (modul 2 unit), t = jenis dinding.
// Rumah yang bisa dimasuki (indeks di HOUSES -> interior)
const SHOP_HOUSES = { 2: { id: 'smithy', name: 'Blacksmith' }, 3: { id: 'store', name: 'General Store' } };

const HOUSES = [
  { x: -22, z: -8, rot: Math.PI / 2, nw: 3, nd: 3, t: 'Plaster' },
  { x: -22, z: 11, rot: Math.PI / 2, nw: 4, nd: 4, t: 'UnevenBrick' },
  { x: 22, z: -9, rot: -Math.PI / 2, nw: 3, nd: 4, t: 'Plaster' },
  { x: 22, z: 12, rot: -Math.PI / 2, nw: 3, nd: 3, t: 'UnevenBrick' },
  { x: -11, z: 23, rot: Math.PI, nw: 3, nd: 3, t: 'Plaster' },
  { x: 12, z: 24, rot: Math.PI, nw: 4, nd: 4, t: 'UnevenBrick' },
  { x: -13, z: -23, rot: 0, nw: 3, nd: 3, t: 'UnevenBrick' },
  { x: 13, z: -24, rot: 0, nw: 2, nd: 2, t: 'Plaster' },
];

// Warga desa (model Knight tanpa pedang). Dialog ditampilkan satu per satu.
export const NPCS = [
  {
    id: 'elder',
    name: 'Village Elder',
    model: 'Mage', items: { r: 'staff' },
    look: { headMesh: 'Mage_Head', hide: ['Mage_Hat'], hair: 0xe9e9ef, beard: 0xf4f4f4, lean: 0.12, scale: 0.93 },
    x: -5, z: -5, face: Math.PI / 4,
    lines: [
      'Do you see that crystal? It used to pulse so calmly. Now its cracks widen every night.',
      'Those who vanished did not simply leave. The crystal called them, and the monsters out there were once our neighbors.',
      'Four crystal shards lie scattered across four regions. Their wardens must be felled one by one.',
    ],
  },
  {
    id: 'smith',
    name: 'Blacksmith',
    model: 'Barbarian', items: { r: 'axe_1handed' },
    shop: 'gear',
    zone: 'smithy',
    x: 2.6, z: -3.3, face: 0,
    lines: ['Weapons and armor, forged right here.'],
  },
  {
    id: 'merchant',
    name: 'Merchant',
    model: 'Rogue_Hooded', items: {},
    shop: 'items',
    zone: 'store',
    x: 0, z: -3.3, face: 0,
    lines: ['Potions, elixirs, anything a hunter needs.'],
  },
  // Warga yang berjalan di sekitar desa (path = titik tujuan bergantian)
  {
    id: 'v1', name: 'Villager', model: 'Rogue', items: {}, speed: 1.3,
    x: 9.5, z: 0, face: 0,
    path: [[0, 9.5], [6.7, 6.7], [9.5, 0], [6.7, -6.7], [0, -9.5], [-6.7, -6.7], [-9.5, 0], [-6.7, 6.7]].reverse(),
    lines: ['The crystal hums louder every night. I can hardly sleep.', 'My brother went into the forest last winter. I still keep his supper warm.'],
  },
  {
    id: 'v2', name: 'Farmer', model: 'Barbarian', items: {}, speed: 1.1,
    x: -13, z: 15, face: Math.PI / 2,
    path: [[-13, 15], [13, 15]],
    lines: ['The fields are dying. Nothing grows near the crystal anymore.', 'Strange how the crows left first.'],
  },
  {
    id: 'v3', name: 'Traveler', model: 'Ranger', items: {}, speed: 1.4,
    x: -16, z: -13, face: 0,
    path: [[-16, -13], [-11, -13], [-11, -5], [-16, -5]],
    lines: ['I came looking for shelter. This place is not what the maps promised.', 'They say a hero is on the way. I hope it is true.'],
  },
  {
    id: 'v4', name: 'Villager', model: 'Mage', items: {}, speed: 1.2,
    look: { headMesh: 'Mage_Head', hide: ['Mage_Hat'], hair: 0x5a3a22, scale: 0.95 },
    x: 14, z: 4, face: 0,
    path: [[14, 4], [14, 16]],
    lines: ['Good day! Be careful out past the gate.', 'The merchant and the smith are open every day, even now.'],
  },
  // Aula takhta kerajaan (zona castle)
  {
    id: 'king',
    name: 'King Aldric',
    model: 'Barbarian', items: {},
    look: { headMesh: 'Barbarian_Head', crown: true, hair: 0xd8d8de, beard: 0xe6e6ea, scale: 1.05 },
    zone: 'castle',
    x: 0, z: -9.6, y: 0.6, face: 0,
    lines: ['Welcome to Aurelia.'],
  },
  {
    id: 'rguard1', name: 'Royal Guard', model: 'Knight', items: { r: 'sword_1handed', l: 'shield_round' },
    zone: 'castle', x: -2.6, z: -8.4, y: 0.6, face: 0,
    lines: ['Stand tall before the King.', 'No monster has ever crossed these walls. Not yet.'],
  },
  {
    id: 'rguard2', name: 'Royal Guard', model: 'Knight', items: { r: 'sword_1handed', l: 'shield_round' },
    zone: 'castle', x: 2.6, z: -8.4, y: 0.6, face: 0,
    lines: ['The King listens to anyone who fights for the realm.'],
  },
  {
    id: 'rguard3', name: 'Royal Guard', model: 'Rogue', items: { r: 'sword_1handed', l: 'shield_round' },
    zone: 'castle', x: -3.2, z: 9.2, face: 0,
    lines: ['The gates stay open for travelers, but we watch the road at night.'],
  },
  {
    id: 'guard',
    name: 'Gate Guard',
    model: 'Ranger', items: { r: 'sword_1handed', l: 'shield_round' },
    x: -3.6, z: 31.5, face: Math.PI,
    lines: [
      'This gate leads to the Root Forest, the first region. Its warden is called the Root Warden.',
      'He used to be a farmer who tended the edge of the forest. Do not hesitate when you fight him.',
    ],
  },
  {
    id: 'guard2',
    name: 'Gate Guard',
    model: 'Rogue', items: { r: 'sword_1handed', l: 'shield_round' },
    x: 3.6, z: 31.5, face: Math.PI,
    lines: [
      'We two have stood guard since the first crack appeared. No one has come back from inside unscathed.',
      'Come back alive. This village cannot afford to lose one more soul.',
    ],
  },
];

const WALL_KINDS = ['Straight', 'Door_Round', 'Window_Wide_Round', 'Window_Thin_Round'];

function modelNames() {
  const n = new Set([
    'Corner_Exterior_Wood', 'Door_4_Round',
    'Window_Wide_Round1', 'Window_Thin_Round1',
    'WindowShutters_Wide_Round_Open', 'WindowShutters_Thin_Round_Open',
    'Wall_Arch', 'Wall_UnevenBrick_Straight',
    'Floor_UnevenBrick', 'Floor_Brick',
    'Prop_Crate', 'Prop_Wagon', 'Prop_MetalFence_Simple', 'Prop_MetalFence_Ornament',
    'Prop_Chimney',
  ]);
  for (const t of ['Plaster', 'UnevenBrick']) for (const k of WALL_KINDS) n.add(`Wall_${t}_${k}`);
  for (const h of HOUSES) {
    n.add(`Roof_RoundTiles_${h.nw * 2}x${h.nd * 2}`);
    if (USE_GABLES) n.add(`Roof_Front_Brick${h.nw * 2}`);
  }
  return [...n];
}

export const villageModelCount = () => modelNames().length;

export async function buildVillage(onProgress) {
  THREE.Cache.enabled = true;
  const loader = new GLTFLoader().setPath('assets/village/');
  const names = modelNames();
  const models = {};
  let done = 0;
  await Promise.all(
    names.map(async (name) => {
      const gltf = await loader.loadAsync(name + '.gltf');
      gltf.scene.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      models[name] = gltf.scene;
      onProgress?.(++done, names.length);
    })
  );

  const group = new THREE.Group();
  const colliders = []; // kotak sumbu-sejajar { x0, x1, z0, z1 }
  const animated = [];

  // Tempatkan salinan model. center=true memusatkan x/z berdasarkan bounding box (untuk atap).
  const put = (parent, name, x, y, z, ry = 0, s = 1, center = false) => {
    const src = models[name];
    if (!src) {
      console.warn('Village model not found:', name);
      return null;
    }
    const o = src.clone();
    o.scale.setScalar(s);
    if (center) {
      const box = new THREE.Box3().setFromObject(src);
      const c = box.getCenter(new THREE.Vector3());
      o.position.set(x - c.x * s, y, z - c.z * s);
    } else {
      o.position.set(x, y, z);
    }
    o.rotation.y = ry;
    parent.add(o);
    return o;
  };

  const shops = [];
  function makeSign(text) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#4a2f18';
    g.fillRect(0, 0, 512, 128);
    g.strokeStyle = '#d9b36a';
    g.lineWidth = 8;
    g.strokeRect(6, 6, 500, 116);
    g.font = 'bold 56px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#ffe9a8';
    g.fillText(text, 256, 68);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    return m;
  }
  const addRect = (cx, cz, hx, hz) => colliders.push({ x0: cx - hx, x1: cx + hx, z0: cz - hz, z1: cz + hz });

  // ---------- Tanah, jalan, plaza ----------
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 90),
    new THREE.MeshStandardMaterial({ color: 0x587a3f, roughness: 1 })
  );
  grass.rotation.x = -Math.PI / 2;
  grass.receiveShadow = true;
  group.add(grass);

  const dirtMat = new THREE.MeshStandardMaterial({ color: 0x86704c, roughness: 1 });
  const path = (cx, cz, w, d) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), dirtMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(cx, 0.01, cz);
    m.receiveShadow = true;
    group.add(m);
  };
  path(0, 21, 5, 28); // plaza ke gerbang
  path(0, -19, 5, 24); // titik awal ke plaza
  path(-14, 0, 22, 4); // ke rumah kiri
  path(14, 0, 22, 4); // ke rumah kanan

  // Plaza batu: 8x8 ubin (16x16 unit); bagian tepi pakai ubin batu bata biasa
  for (let i = -4; i < 4; i++) {
    for (let j = -4; j < 4; j++) {
      const edge = Math.abs(i + 0.5) > 3 || Math.abs(j + 0.5) > 3;
      put(group, edge ? 'Floor_Brick' : 'Floor_UnevenBrick', i * 2 + 1, 0.03, j * 2 + 1);
    }
  }

  // Segitiga penutup bagian depan/belakang atap (di atas dinding), supaya tidak bolong
  const wallMats = {};
  const wallMat = (t) => {
    if (wallMats[t]) return wallMats[t];
    let found = null;
    models[`Wall_${t}_Straight`].traverse((o) => {
      if (!found && o.isMesh) {
        const arr = Array.isArray(o.material) ? o.material : [o.material];
        found = arr.find((m) => m.name && m.name.includes(t === 'Plaster' ? 'Plaster' : 'UnevenBrick')) || arr[0];
      }
    });
    wallMats[t] = found.clone();
    wallMats[t].side = THREE.DoubleSide;
    return wallMats[t];
  };
  function gableFill(house, t, W, D) {
    const box = new THREE.Box3().setFromObject(models[`Roof_RoundTiles_${W}x${D}`]);
    const ridge = WALL_H + box.max.y;
    const eave = WALL_H + box.min.y;
    const halfRoof = (box.max.x - box.min.x) / 2;
    const hx = W / 2;
    const sideY = ridge - ((ridge - eave) * hx) / halfRoof - 0.15;
    const pts = [
      [-hx, WALL_H - 0.05],
      [hx, WALL_H - 0.05],
      [hx, sideY],
      [0, ridge - 0.2],
      [-hx, sideY],
    ];
    const pos = [];
    const uv = [];
    for (const [x, y] of pts) {
      pos.push(x, y, 0);
      uv.push(x / 2 + 0.5, 1 - y / 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4]);
    geo.computeVertexNormals();
    const mat = wallMat(t);
    for (const side of [1, -1]) {
      const m = new THREE.Mesh(geo, mat);
      m.position.z = side * (D / 2 - 0.1);
      m.castShadow = m.receiveShadow = true;
      house.add(m);
    }
  }

  // ---------- Rumah ----------
  function buildHouse(h, idx) {
    const W = h.nw * 2;
    const D = h.nd * 2;
    const house = new THREE.Group();
    house.position.set(h.x, 0, h.z);
    house.rotation.y = h.rot;

    // Ruang dalam gelap agar celah pintu/jendela tidak tembus pandang
    const inside = new THREE.Mesh(
      new THREE.BoxGeometry(W - 0.5, WALL_H - 0.1, D - 0.5),
      new THREE.MeshBasicMaterial({ color: 0x2a1f16 })
    );
    inside.position.y = WALL_H / 2;
    house.add(inside);

    const wall = (kind, x, z, ry) => put(house, `Wall_${h.t}_${kind}`, x, 0, z, ry);

    // Depan (+z): pintu di tengah, sisanya jendela lebar
    const doorIdx = Math.floor(h.nw / 2);
    for (let i = 0; i < h.nw; i++) {
      const ox = (i - (h.nw - 1) / 2) * 2;
      if (i === doorIdx) {
        wall('Door_Round', ox, D / 2, 0);
        // Daun pintu (ada gagang/engsel logam): engsel di x=0 model, bukaan dinding lebar 1.3
        const door = put(house, 'Door_4_Round', ox - 0.65, 0, D / 2 - 0.1, 0);
        if (door) door.scale.x = 1.18;
      } else {
        wall('Window_Wide_Round', ox, D / 2, 0);
        put(house, 'Window_Wide_Round1', ox, 0, D / 2, 0);
        put(house, 'WindowShutters_Wide_Round_Open', ox, 0, D / 2, 0);
      }
    }
    // Belakang (-z)
    for (let i = 0; i < h.nw; i++) {
      const ox = (i - (h.nw - 1) / 2) * 2;
      if (i % 2 === 1) {
        wall('Window_Thin_Round', ox, -D / 2, Math.PI);
        put(house, 'Window_Thin_Round1', ox, 0, -D / 2, Math.PI);
      } else {
        wall('Straight', ox, -D / 2, Math.PI);
      }
    }
    // Sisi kanan (+x) dan kiri (-x)
    for (let i = 0; i < h.nd; i++) {
      const oz = (i - (h.nd - 1) / 2) * 2;
      const win = i % 2 === 0 && h.nd > 2 ? true : i === 0 && h.nd === 2;
      for (const side of [1, -1]) {
        const ry = side * (Math.PI / 2);
        if (win) {
          wall('Window_Thin_Round', side * (W / 2), oz, ry);
          put(house, 'Window_Thin_Round1', side * (W / 2), 0, oz, ry);
        } else {
          wall('Straight', side * (W / 2), oz, ry);
        }
      }
    }
    // Tiang sudut
    for (const sx of [1, -1]) for (const sz of [1, -1]) put(house, 'Corner_Exterior_Wood', sx * (W / 2), 0, sz * (D / 2), 0);

    // Atap + muka depan/belakang atap
    put(house, `Roof_RoundTiles_${W}x${D}`, 0, WALL_H, 0, 0, 1, true);
    gableFill(house, h.t, W, D);
    if (USE_GABLES) {
      put(house, `Roof_Front_Brick${W}`, 0, WALL_H, D / 2, 0);
      put(house, `Roof_Front_Brick${W}`, 0, WALL_H, -D / 2, Math.PI);
    }
    group.add(house);

    const swap = Math.abs(Math.sin(h.rot)) > 0.5;
    addRect(h.x, h.z, (swap ? D : W) / 2 + 0.5, (swap ? W : D) / 2 + 0.5);

    const shop = SHOP_HOUSES[idx];
    if (shop) {
      const ox = (doorIdx - (h.nw - 1) / 2) * 2;
      const toWorld = (lx, lz) => ({
        x: h.x + lx * Math.cos(h.rot) + lz * Math.sin(h.rot),
        z: h.z - lx * Math.sin(h.rot) + lz * Math.cos(h.rot),
      });
      const trig = toWorld(ox, D / 2 + 1.0);
      const out = toWorld(ox, D / 2 + 2.8);
      shops.push({ id: shop.id, x: trig.x, z: trig.z, r: 1.5, out: { x: out.x, z: out.z, rot: h.rot } });
      const sign = makeSign(shop.name);
      sign.position.set(ox + 1.9, 2.0, D / 2 + 0.9);
      house.add(sign);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.3, 0.12), new THREE.MeshStandardMaterial({ color: 0x4a2f18 }));
      post.position.set(ox + 1.9, 1.15, D / 2 + 0.85);
      house.add(post);
      // jalan setapak dari jalan utama ke pintu
      path(out.x, out.z, 4.5, 4.5);
    }
  }
  HOUSES.forEach((h, i) => buildHouse(h, i));

  // ---------- Kristal Inti (pusat plaza) ----------
  const crystal = new THREE.Group();
  crystal.position.set(0, 0, 0);
  group.add(crystal);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6, 3, 0.5, 8),
    new THREE.MeshStandardMaterial({ color: 0x555a66, roughness: 0.9 })
  );
  base.position.y = 0.25;
  base.castShadow = base.receiveShadow = true;
  crystal.add(base);

  const crystalMat = new THREE.MeshStandardMaterial({
    color: 0x8fe9ff,
    emissive: 0x39c7ff,
    emissiveIntensity: 1.4,
    roughness: 0.2,
    metalness: 0.1,
    transparent: true,
    opacity: 0.92,
  });
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), crystalMat);
  core.scale.set(0.9, 1.9, 0.9);
  core.position.y = 3.2;
  crystal.add(core);
  const cracks = new THREE.LineSegments(
    new THREE.EdgesGeometry(core.geometry),
    new THREE.LineBasicMaterial({ color: 0xff5ad8 })
  );
  core.add(cracks);

  const shardMat = new THREE.MeshStandardMaterial({ color: 0x6fd8ff, emissive: 0x2aa8e0, emissiveIntensity: 1, roughness: 0.3 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), shardMat);
    s.scale.set(0.6, 1.6, 0.6);
    s.position.set(Math.cos(a) * 2, 0.9, Math.sin(a) * 2);
    s.rotation.set(Math.sin(a) * 0.4, a, Math.cos(a) * 0.4);
    crystal.add(s);
  }
  const crystalLight = new THREE.PointLight(0x5fd4ff, 40, 28, 2);
  crystalLight.position.set(0, 3.5, 0);
  crystal.add(crystalLight);
  colliders.push({ x0: -2.8, x1: 2.8, z0: -2.8, z1: 2.8 });

  animated.push((t) => {
    core.position.y = 3.2 + Math.sin(t * 1.3) * 0.25;
    core.rotation.y = t * 0.5;
    crystalLight.intensity = 40 + Math.sin(t * 2.1) * 9 + Math.sin(t * 5.3) * 3;
  });

  // ---------- Gerbang dungeon (z = +34) ----------
  const GZ = 34;
  const GS = 1.5; // skala modul gerbang
  const gate = new THREE.Group();
  gate.position.set(0, 0, GZ);
  group.add(gate);
  put(gate, 'Wall_Arch', 0, 0, 0, 0, GS);
  for (let i = 1; i <= 3; i++) {
    for (const sx of [1, -1]) put(gate, 'Wall_UnevenBrick_Straight', sx * i * 2 * GS, 0, 0, 0, GS);
  }
  addRect(-6, GZ, 4.5, 0.8); // dinding gerbang kiri (x -10.5..-1.5)
  addRect(6, GZ, 4.5, 0.8); // dinding gerbang kanan

  const portalMat = new THREE.MeshBasicMaterial({
    color: 0xa86bff,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const portal = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.6), portalMat);
  portal.position.set(0, 1.9, 0);
  gate.add(portal);
  const portalLight = new THREE.PointLight(0xa86bff, 28, 18, 2);
  portalLight.position.set(0, 2.2, -1.5);
  gate.add(portalLight);
  animated.push((t) => {
    portalMat.opacity = 0.5 + Math.sin(t * 2.4) * 0.15;
    portalLight.intensity = 28 + Math.sin(t * 3.1) * 6;
  });

  // ---------- Pagar batas desa ----------
  const fenceAlong = (x0, z0, x1, z1, ry, skip) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.round(len / 2);
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n;
      const x = x0 + (x1 - x0) * f;
      const z = z0 + (z1 - z0) * f;
      if (skip?.(x, z)) continue;
      if (ry === 0) colliders.push({ x0: x - 1.1, x1: x + 1.1, z0: z - 0.3, z1: z + 0.3 });
      else colliders.push({ x0: x - 0.3, x1: x + 0.3, z0: z - 1.1, z1: z + 1.1 });
      put(group, i % 4 === 0 ? 'Prop_MetalFence_Ornament' : 'Prop_MetalFence_Simple', x, 0, z, ry);
    }
  };
  const E = 38;
  fenceAlong(-E, -E, E, -E, 0, (x) => Math.abs(x + 20) < 5); // gerbang kerajaan di x=-20; selatan (belakang titik awal)
  fenceAlong(-E, -E, -E, E, Math.PI / 2); // barat
  fenceAlong(E, -E, E, E, Math.PI / 2); // timur
  fenceAlong(-E, GZ, E, GZ, 0, (x) => Math.abs(x) < 10.5); // utara, menyambung ke dinding gerbang
  addRect(-31.5, -E, 6.5, 0.5); // pagar belakang, celah gerbang kerajaan x -25..-15
  addRect(11.5, -E, 26.5, 0.5);
  addRect(-E, 0, 0.5, E);
  addRect(E, 0, 0.5, E);
  addRect(-24.25, GZ, 13.75, 0.6);
  addRect(24.25, GZ, 13.75, 0.6);

  // ---------- Prop: peti dan gerobak ----------
  const crate = (x, z, ry = 0, y = 0) => put(group, 'Prop_Crate', x, y, z, ry);
  crate(10.5, 7, 0.2);
  crate(11.8, 6.4, -0.3);
  crate(10.9, 7.1, 0.5, 1.1);
  addRect(11.2, 6.8, 1.4, 1);
  crate(-9, -9, 0.4);
  crate(-9.1, -7.6, 0);
  addRect(-9, -8.3, 1, 1.3);
  put(group, 'Prop_Wagon', 16, 0, -1.5, Math.PI / 2 + 0.2);
  addRect(15, -1.5, 3.2, 1.3);
  crate(-18, -22, 0.3);
  crate(-17.7, -20.6, -0.2);
  addRect(-17.8, -21.3, 1, 1.3);

  return {
    group,
    colliders,
    gate: { x: 0, z: GZ - 0.8, r: 1.6 },
    shops,
    spawn: { x: 0, z: -30 },
    update(t) {
      for (const fn of animated) fn(t);
    },
  };
}
