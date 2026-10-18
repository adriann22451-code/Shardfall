// Tata ruang dungeon unik untuk wilayah 2-4 (Root Forest memakai dungeon.js).
// Setiap bangun mengembalikan: group, colliders, portals{home,boss}, spawn, isFree(x,z), update(t)
import * as THREE from 'three';

const rng = (seed) => {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
};

function noiseTex(base, specks, rep = 10, n = 700) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  const r = rng(7);
  for (let i = 0; i < n; i++) {
    g.fillStyle = specks[Math.floor(r() * specks.length)];
    const s = 1 + r() * 5;
    g.fillRect(r() * 256, r() * 256, s, s);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rep, rep);
  return t;
}

// Gabungkan sel padat (grid) jadi kotak tabrakan per baris
function mergeRows(solid, n, cell, offset, out) {
  for (let gz = 0; gz < n; gz++) {
    let start = -1;
    for (let gx = 0; gx <= n; gx++) {
      const s = gx < n && solid(gx, gz);
      if (s && start < 0) start = gx;
      if (!s && start >= 0) {
        out.push({ x0: offset + start * cell, x1: offset + gx * cell, z0: offset + gz * cell, z1: offset + (gz + 1) * cell });
        start = -1;
      }
    }
  }
}

const inBox = (cols, x, z, m) => cols.some((c) => x > c.x0 - m && x < c.x1 + m && z > c.z0 - m && z < c.z1 + m);

function light(group, color, intensity, dist, x, y, z) {
  const l = new THREE.PointLight(color, intensity, dist, 2);
  l.position.set(x, y, z);
  group.add(l);
  return l;
}

// ===================== EMBER MINES: persimpangan lorong tambang =====================
function buildEmber() {
  const group = new THREE.Group();
  const colliders = [];
  const r = rng(101);
  const lavaMat = new THREE.MeshStandardMaterial({ color: 0xff5a10, emissive: 0xff4a00, emissiveIntensity: 1.5 });

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 90),
    new THREE.MeshStandardMaterial({ map: noiseTex('#3a2a24', ['#2a1c18', '#4a3a30', '#5a2a18'], 14), roughness: 1 })
  );
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);

  // Empat massa batu (kuadran) + lorong silang di antaranya
  const rockMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: noiseTex('#4a3a34', ['#2a1e1a', '#5a4a42', '#6a3a22'], 3, 300), roughness: 1 });
  const chunks = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      colliders.push({ x0: sx > 0 ? 9 : -33, x1: sx > 0 ? 33 : -9, z0: sz > 0 ? 9 : -33, z1: sz > 0 ? 33 : -9 });
      for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
        chunks.push([sx * (9 + 2 + i * 4), sz * (9 + 2 + j * 4), 4.1, 5 + r() * 3.5, 4.1]);
      }
    }
  }
  const rock = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), rockMat, chunks.length);
  const d = new THREE.Object3D();
  chunks.forEach((c, i) => {
    d.position.set(c[0], c[3] / 2, c[1]);
    d.scale.set(c[2], c[3], c[4]);
    d.updateMatrix();
    rock.setMatrixAt(i, d.matrix);
    rock.setColorAt(i, new THREE.Color().setHSL(0.05, 0.2, 0.7 + r() * 0.35));
  });
  rock.frustumCulled = false;
  group.add(rock);

  // Garis lava di kaki dinding batu
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const a = new THREE.Mesh(new THREE.BoxGeometry(24, 0.12, 0.7), lavaMat);
    a.position.set(sx * 21, 0.08, sz * 8.6);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 24), lavaMat);
    b.position.set(sx * 8.6, 0.08, sz * 21);
    group.add(a, b);
  }
  // Kawah lava di tengah
  const rim = new THREE.Mesh(new THREE.CircleGeometry(5.2, 24), new THREE.MeshStandardMaterial({ color: 0x1c1210, roughness: 1 }));
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.03;
  const lava = new THREE.Mesh(new THREE.CircleGeometry(4.2, 24), lavaMat);
  lava.rotation.x = -Math.PI / 2;
  lava.position.y = 0.06;
  group.add(rim, lava);
  colliders.push({ x0: -3.6, x1: 3.6, z0: -3.6, z1: 3.6 });

  // Dinding batas luar
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x3a2c28, roughness: 1 });
  for (const [x, z, w, dd] of [[0, -40, 84, 3], [0, 40, 84, 3], [-40, 0, 3, 84], [40, 0, 3, 84]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 8, dd), wallMat);
    m.position.set(x, 4, z);
    group.add(m);
  }
  // Penyangga kayu melintang di lorong
  const beam = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 1 });
  for (const [x, z, rot] of [[0, -16, 0], [0, 16, 0], [-16, 0, 1], [16, 0, 1]]) {
    const g = new THREE.Group();
    for (const s of [-8.4, 8.4]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5.4, 0.6), beam);
      p.position.set(s, 2.7, 0);
      g.add(p);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(18, 0.6, 0.7), beam);
    top.position.y = 5.5;
    g.add(top);
    g.position.set(x, 0, z);
    g.rotation.y = rot ? Math.PI / 2 : 0;
    group.add(g);
  }
  const lights = [
    light(group, 0xff5a20, 40, 30, 0, 3, 0),
    light(group, 0xff6a2a, 30, 26, 0, 4, -20),
    light(group, 0xff6a2a, 30, 26, 0, 4, 20),
    light(group, 0xff6a2a, 30, 26, -20, 4, 0),
    light(group, 0xff6a2a, 30, 26, 20, 4, 0),
  ];
  return {
    group,
    colliders,
    portals: { home: { x: 0, z: 34 }, boss: { x: 34, z: 0 } },
    spawn: { x: 0, z: -30, rot: 0 },
    isFree: (x, z) => !inBox(colliders, x, z, 1),
    update(t) {
      lavaMat.emissiveIntensity = 1.3 + Math.sin(t * 2.2) * 0.35;
      lights.forEach((l, i) => (l.intensity = (i ? 30 : 40) * (1 + 0.1 * Math.sin(t * 5 + i * 1.7))));
    },
  };
}

// ===================== FROZEN DEPTHS: gua es melingkar =====================
function buildFrost() {
  const group = new THREE.Group();
  const colliders = [];
  const r = rng(202);
  const R_IN = 30;

  const back = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshStandardMaterial({ color: 0x16223a, roughness: 1 }));
  back.rotation.x = -Math.PI / 2;
  back.position.y = -0.02;
  group.add(back);
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(R_IN + 2, 64),
    new THREE.MeshStandardMaterial({ map: noiseTex('#8fb4d0', ['#a8cce6', '#7aa0c0', '#c8e4f4'], 8, 500), roughness: 0.25, metalness: 0.1 })
  );
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);
  // Danau beku di tengah
  const lake = new THREE.Mesh(new THREE.CircleGeometry(9, 40), new THREE.MeshStandardMaterial({ color: 0xd6f0ff, roughness: 0.05, metalness: 0.2, emissive: 0x2a5a80, emissiveIntensity: 0.4 }));
  lake.rotation.x = -Math.PI / 2;
  lake.position.y = 0.03;
  group.add(lake);
  for (const rr of [3, 6, 8.5]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(rr - 0.06, rr, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    group.add(ring);
  }

  // Dinding balok es membentuk lingkaran
  const CELL = 3;
  const N = Math.ceil(84 / CELL);
  const off = -N * CELL / 2;
  const solid = (gx, gz) => Math.hypot(off + (gx + 0.5) * CELL, off + (gz + 0.5) * CELL) > R_IN;
  mergeRows(solid, N, CELL, off, colliders);
  const cells = [];
  for (let gx = 0; gx < N; gx++) for (let gz = 0; gz < N; gz++) if (solid(gx, gz)) cells.push([off + (gx + 0.5) * CELL, off + (gz + 0.5) * CELL]);
  const iceMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, emissive: 0x2a6aa0, emissiveIntensity: 0.3 });
  const blocks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), iceMat, cells.length);
  const caps = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xf2f8ff, roughness: 1 }), cells.length);
  const d = new THREE.Object3D();
  cells.forEach(([x, z], i) => {
    const near = Math.hypot(x, z) < R_IN + 4;
    const h = near ? 3 + r() * 3 : 5 + r() * 5;
    d.rotation.set(0, 0, 0);
    d.position.set(x, h / 2, z);
    d.scale.set(CELL * 1.02, h, CELL * 1.02);
    d.updateMatrix();
    blocks.setMatrixAt(i, d.matrix);
    blocks.setColorAt(i, new THREE.Color().setHSL(0.56, 0.45, 0.62 + r() * 0.25));
    d.position.set(x, h + 0.1, z);
    d.scale.set(CELL * 1.04, 0.35, CELL * 1.04);
    d.updateMatrix();
    caps.setMatrixAt(i, d.matrix);
  });
  blocks.frustumCulled = caps.frustumCulled = false;
  group.add(blocks, caps);

  // Pilar es melingkar di sekeliling danau
  const pilMat = new THREE.MeshStandardMaterial({ color: 0xa8d4f0, emissive: 0x2a6aa0, emissiveIntensity: 0.4, roughness: 0.2, transparent: true, opacity: 0.9 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    const x = Math.cos(a) * 16;
    const z = Math.sin(a) * 16;
    const h = 4 + r() * 2.5;
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.5, h, 1.5), pilMat);
    p.position.set(x, h / 2, z);
    p.rotation.y = a;
    group.add(p);
    colliders.push({ x0: x - 0.95, x1: x + 0.95, z0: z - 0.95, z1: z + 0.95 });
  }
  const lights = [
    light(group, 0x8fd0ff, 38, 34, 0, 5, 0),
    light(group, 0x8fd0ff, 28, 28, -16, 4, -12),
    light(group, 0x8fd0ff, 28, 28, 16, 4, -12),
    light(group, 0x8fd0ff, 28, 28, 0, 4, 18),
  ];
  return {
    group,
    colliders,
    portals: { home: { x: 0, z: 27 }, boss: { x: 27, z: 0 } },
    spawn: { x: 0, z: -25, rot: 0 },
    isFree: (x, z) => Math.hypot(x, z) < R_IN - 1.5 && !inBox(colliders, x, z, 1),
    update(t) {
      lights.forEach((l, i) => (l.intensity = (i ? 28 : 38) * (1 + 0.06 * Math.sin(t * 1.5 + i))));
    },
  };
}

// ===================== SHATTERED CORE: platform melayang di atas jurang =====================
function buildCore() {
  const group = new THREE.Group();
  const colliders = [];
  const r = rng(303);
  const PLAT = [
    [0, 0, 11],
    [0, -27, 8],
    [0, 27, 8],
    [27, 0, 8],
    [-27, 0, 8],
  ];
  const walk = (x, z) => {
    for (const [px, pz, pr] of PLAT) if (Math.hypot(x - px, z - pz) < pr) return true;
    if (Math.abs(x) < 3 && Math.abs(z) < 27) return true; // jembatan utara-selatan
    if (Math.abs(z) < 3 && Math.abs(x) < 27) return true; // jembatan barat-timur
    return false;
  };
  const CELL = 2;
  const N = 42;
  const off = -N * CELL / 2;
  const cx = (gx) => off + (gx + 0.5) * CELL;
  const solid = (gx, gz) => !walk(cx(gx), cx(gz));
  mergeRows(solid, N, CELL, off, colliders);

  const tiles = [];
  for (let gx = 0; gx < N; gx++) for (let gz = 0; gz < N; gz++) if (!solid(gx, gz)) tiles.push([cx(gx), cx(gz)]);
  const tileMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.2 });
  const tm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), tileMat, tiles.length);
  const d = new THREE.Object3D();
  tiles.forEach(([x, z], i) => {
    d.rotation.set(0, 0, 0);
    d.position.set(x, -0.2, z);
    d.scale.set(CELL * 1.0, 0.4, CELL * 1.0);
    d.updateMatrix();
    tm.setMatrixAt(i, d.matrix);
    tm.setColorAt(i, new THREE.Color().setHSL(0.74, 0.35, 0.18 + r() * 0.08));
  });
  tm.frustumCulled = false;
  group.add(tm);

  // Garis cahaya di tepi platform
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0xb07aff });
  const edges = [];
  for (const [x, z] of tiles) {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!walk(x + dx * CELL, z + dz * CELL)) edges.push([x + dx * (CELL / 2), z + dz * (CELL / 2), dx ? 0.14 : CELL, dz ? 0.14 : CELL]);
    }
  }
  const em = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), edgeMat, edges.length);
  edges.forEach(([x, z, w, dd], i) => {
    d.position.set(x, 0.02, z);
    d.scale.set(w, 0.1, dd);
    d.updateMatrix();
    em.setMatrixAt(i, d.matrix);
  });
  em.frustumCulled = false;
  group.add(em);

  // Rune di tengah platform
  const runeMat = new THREE.MeshBasicMaterial({ color: 0xb07aff, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
  for (const [px, pz, pr] of PLAT) {
    for (const k of [0.45, 0.7]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(pr * k - 0.12, pr * k, 40), runeMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(px, 0.03, pz);
      group.add(ring);
    }
  }
  // Jurang gelap di bawah
  const abyss = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial({ color: 0x050310 }));
  abyss.rotation.x = -Math.PI / 2;
  abyss.position.y = -9;
  group.add(abyss);
  // Batu melayang kecil di sekitar
  const rock = new THREE.DodecahedronGeometry(1, 0);
  const fm = new THREE.InstancedMesh(rock, new THREE.MeshStandardMaterial({ color: 0x2a2048, emissive: 0x2a1060, emissiveIntensity: 0.5, roughness: 0.8 }), 28);
  const floaters = [];
  for (let i = 0; i < 28; i++) {
    let x;
    let z;
    do {
      x = (r() - 0.5) * 80;
      z = (r() - 0.5) * 80;
    } while (walk(x, z) || Math.hypot(x, z) < 12);
    floaters.push({ x, z, y: -2 + r() * 8, s: 0.5 + r() * 1.4, ph: r() * 6 });
  }
  fm.frustumCulled = false;
  group.add(fm);

  const lights = [
    light(group, 0xb07aff, 40, 34, 0, 5, 0),
    light(group, 0xb07aff, 30, 28, 0, 4, -27),
    light(group, 0xb07aff, 30, 28, 0, 4, 27),
    light(group, 0xb07aff, 30, 28, 27, 4, 0),
    light(group, 0xb07aff, 30, 28, -27, 4, 0),
  ];
  return {
    group,
    colliders,
    portals: { home: { x: 0, z: 29 }, boss: { x: 29, z: 0 } },
    spawn: { x: 0, z: -26, rot: 0 },
    isFree: (x, z) => walk(x, z) && !inBox(colliders, x, z, 0.8),
    update(t) {
      floaters.forEach((f, i) => {
        d.rotation.set(t * 0.3 + f.ph, t * 0.2, 0);
        d.position.set(f.x, f.y + Math.sin(t * 0.8 + f.ph) * 0.8, f.z);
        d.scale.setScalar(f.s);
        d.updateMatrix();
        fm.setMatrixAt(i, d.matrix);
      });
      fm.instanceMatrix.needsUpdate = true;
      lights.forEach((l, i) => (l.intensity = (i ? 30 : 40) * (1 + 0.08 * Math.sin(t * 2 + i))));
    },
  };
}

export function buildArena(id) {
  if (id === 'ember') return buildEmber();
  if (id === 'frost') return buildFrost();
  if (id === 'core') return buildCore();
  return null;
}
