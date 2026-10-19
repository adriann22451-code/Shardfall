// Pemandangan desa pegunungan: hutan, batu, gunung, langit, dan kastil kerajaan.
// Semuanya prosedural (tanpa file model).
import * as THREE from 'three';

const rng = (seed) => {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
};

function noiseTex(base, specks, rep = 6, n = 500) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  const r = rng(5);
  for (let i = 0; i < n; i++) {
    g.fillStyle = specks[Math.floor(r() * specks.length)];
    const s = 2 + r() * 6;
    g.fillRect(r() * 256, r() * 256, s, s * (0.6 + r()));
  }
  // garis blok batu
  g.strokeStyle = 'rgba(0,0,0,.18)';
  g.lineWidth = 2;
  for (let y = 0; y < 256; y += 32) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(256, y);
    g.stroke();
    for (let x = (y / 32) % 2 ? 0 : 32; x < 256; x += 64) {
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x, y + 32);
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rep, rep);
  return t;
}

export const ROYAL_GATE = { x: -20, z: -35.2, r: 1.8, out: { x: -20, z: -32.6, rot: 0 } };
const CASTLE = { x: -20, z: -118 };

export function buildScenery(villageColliders, shops) {
  const group = new THREE.Group();
  const colliders = [];
  const r = rng(909);
  const R = (a, b) => a + r() * (b - a);

  // ---------- Area terlarang untuk pohon/batu di dalam desa ----------
  const inRect = (x, z, x0, x1, z0, z1) => x > x0 && x < x1 && z > z0 && z < z1;
  const blockedInside = (x, z) => {
    if (Math.abs(x) < 5 && z > -34) return true; // jalan utama
    if (Math.abs(z) < 3.8 && Math.abs(x) < 36) return true; // jalan timur-barat
    if (Math.hypot(x, z) < 17) return true; // plaza + rute warga
    if (inRect(x, z, -16, 16, 11.5, 18.5)) return true; // rute petani
    if (inRect(x, z, -19, -8, -15, -2)) return true; // rute traveler
    if (inRect(x, z, 11, 17, 1.5, 18.5)) return true; // rute warga timur
    if (Math.hypot(x, z + 30) < 8) return true; // titik awal
    if (z > 24 && Math.abs(x) < 15) return true; // gerbang dungeon
    if (Math.hypot(x - ROYAL_GATE.x, z - ROYAL_GATE.z) < 7) return true; // gerbang kerajaan
    for (const s of shops) if (Math.hypot(x - s.out.x, z - s.out.z) < 5.5 || Math.hypot(x - s.x, z - s.z) < 5) return true;
    for (const c of villageColliders) if (x > c.x0 - 2.4 && x < c.x1 + 2.4 && z > c.z0 - 2.4 && z < c.z1 + 2.4) return true;
    for (const c of colliders) if (x > c.x0 - 0.8 && x < c.x1 + 0.8 && z > c.z0 - 0.8 && z < c.z1 + 0.8) return true;
    return false;
  };
  const insideSpot = (edgeBias = 0.6) => {
    for (let i = 0; i < 60; i++) {
      let x;
      let z;
      if (r() < edgeBias) {
        // dekat pagar
        const side = Math.floor(R(0, 4));
        const t = R(-36, 36);
        const d = R(27.5, 36);
        [x, z] = [[t, -d], [t, d], [-d, t], [d, t]][side];
      } else {
        x = R(-36, 36);
        z = R(-36, 36);
      }
      if (!blockedInside(x, z)) return [x, z];
    }
    return null;
  };
  // Di luar pagar: hutan lebat, kecuali jalan ke kastil
  const outsideSpot = (minR = 41, maxR = 100) => {
    for (let i = 0; i < 40; i++) {
      const x = R(-maxR, maxR);
      const z = R(-maxR, maxR);
      const m = Math.max(Math.abs(x), Math.abs(z));
      if (m < minR || Math.hypot(x, z) > maxR * 1.15) continue;
      if (Math.abs(x - CASTLE.x) < 5 && z < -36 && z > CASTLE.z + 14) continue; // jalan kerajaan
      if (Math.hypot(x - CASTLE.x, z - CASTLE.z) < 44) continue; // bukit kastil
      if (Math.hypot(x - ROYAL_GATE.x, z - ROYAL_GATE.z) < 9) continue;
      return [x, z];
    }
    return null;
  };

  // ---------- Pohon (instanced) ----------
  const unitCone = new THREE.ConeGeometry(1, 1, 7);
  const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 6);
  const unitBlob = new THREE.IcosahedronGeometry(1, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3e28, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
  const d = new THREE.Object3D();

  // parts: [geometry, material, localY, sx, sy, sz, hue, lightness]
  const makeTrees = (pts, parts, withCollider) => {
    if (!pts.length) return;
    const meshes = parts.map(([geo, mat]) => {
      const m = new THREE.InstancedMesh(geo, mat, pts.length);
      m.frustumCulled = false;
      group.add(m);
      return m;
    });
    pts.forEach((p, i) => {
      const s = R(0.8, 1.55);
      const ry = R(0, 6.3);
      parts.forEach(([, , oy, sx, sy, sz, hue, lt], k) => {
        d.position.set(p[0], oy * s, p[1]);
        d.rotation.set(0, ry, 0);
        d.scale.set(sx * s, sy * s, sz * s);
        d.updateMatrix();
        meshes[k].setMatrixAt(i, d.matrix);
        if (hue != null) meshes[k].setColorAt(i, new THREE.Color().setHSL(hue + R(-0.03, 0.03), 0.4, lt + R(-0.06, 0.06)));
      });
      if (withCollider) colliders.push({ x0: p[0] - 0.55 * s, x1: p[0] + 0.55 * s, z0: p[1] - 0.55 * s, z1: p[1] + 0.55 * s });
    });
  };
  const pineParts = [
    [unitCyl, trunkMat, 0.9, 0.28, 1.8, 0.28, null],
    [unitCone, leafMat, 2.6, 1.7, 2.4, 1.7, 0.36, 0.22],
    [unitCone, leafMat, 4.0, 1.35, 2.2, 1.35, 0.37, 0.25],
    [unitCone, leafMat, 5.2, 0.95, 2.0, 0.95, 0.38, 0.28],
  ];
  const oakParts = [
    [unitCyl, trunkMat, 1.2, 0.35, 2.4, 0.35, null],
    [unitBlob, leafMat, 3.2, 1.9, 1.5, 1.9, 0.27, 0.3],
    [unitBlob, leafMat, 4.2, 1.4, 1.2, 1.4, 0.25, 0.34],
  ];
  // Dalam desa
  const inPine = [];
  const inOak = [];
  for (let i = 0; i < 46; i++) {
    const p = insideSpot();
    if (!p) continue;
    // daftarkan collider dulu agar pohon tidak saling menumpuk
    colliders.push({ x0: p[0] - 0.55, x1: p[0] + 0.55, z0: p[1] - 0.55, z1: p[1] + 0.55 });
    (r() < 0.55 ? inPine : inOak).push(p);
  }
  colliders.length = 0;
  makeTrees(inPine, pineParts, true);
  makeTrees(inOak, oakParts, true);
  // Hutan di luar pagar
  const outPine = [];
  const outOak = [];
  for (let i = 0; i < 560; i++) {
    const p = outsideSpot();
    if (p) (r() < 0.72 ? outPine : outOak).push(p);
  }
  makeTrees(outPine, pineParts, false);
  makeTrees(outOak, oakParts, false);

  // ---------- Semak dan bunga di dalam desa ----------
  const bushPts = [];
  for (let i = 0; i < 70; i++) {
    const p = insideSpot(0.4);
    if (p) bushPts.push(p);
  }
  const bushes = new THREE.InstancedMesh(unitBlob, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }), bushPts.length);
  bushPts.forEach((p, i) => {
    const s = R(0.5, 1.0);
    d.position.set(p[0], s * 0.5, p[1]);
    d.rotation.set(0, R(0, 6), 0);
    d.scale.set(s * 1.3, s * 0.8, s * 1.3);
    d.updateMatrix();
    bushes.setMatrixAt(i, d.matrix);
    bushes.setColorAt(i, new THREE.Color().setHSL(R(0.22, 0.3), 0.45, R(0.25, 0.35)));
  });
  bushes.frustumCulled = false;
  group.add(bushes);
  const flowerPts = [];
  for (let i = 0; i < 110; i++) {
    const p = insideSpot(0.2);
    if (p) flowerPts.push(p);
  }
  const flowers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 5, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }), flowerPts.length);
  const fcols = [0xffe45a, 0xff7a9a, 0xffffff, 0xb07aff, 0xff9a4a];
  flowerPts.forEach((p, i) => {
    d.position.set(p[0], 0.25, p[1]);
    d.rotation.set(0, 0, 0);
    d.scale.set(1, 1, 1);
    d.updateMatrix();
    flowers.setMatrixAt(i, d.matrix);
    flowers.setColorAt(i, new THREE.Color(fcols[i % fcols.length]));
  });
  flowers.frustumCulled = false;
  group.add(flowers);

  // ---------- Batu ----------
  const rockMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rocks = [];
  for (let i = 0; i < 30; i++) {
    const p = insideSpot(0.7);
    if (!p) continue;
    const s = R(0.5, 1.7);
    rocks.push([p[0], p[1], s]);
    if (s > 1.1) colliders.push({ x0: p[0] - s * 0.85, x1: p[0] + s * 0.85, z0: p[1] - s * 0.85, z1: p[1] + s * 0.85 });
  }
  for (let i = 0; i < 150; i++) {
    const p = outsideSpot(40, 105);
    if (p) rocks.push([p[0], p[1], R(1.2, 5)]);
  }
  const rockMesh = new THREE.InstancedMesh(rockGeo, rockMat, rocks.length);
  rocks.forEach(([x, z, s], i) => {
    d.position.set(x, s * 0.45, z);
    d.rotation.set(R(-0.3, 0.3), R(0, 6), R(-0.3, 0.3));
    d.scale.set(s * R(1, 1.5), s * R(0.7, 1.1), s * R(1, 1.5));
    d.updateMatrix();
    rockMesh.setMatrixAt(i, d.matrix);
    rockMesh.setColorAt(i, new THREE.Color().setHSL(R(0.08, 0.14), 0.06, R(0.38, 0.52)));
  });
  rockMesh.frustumCulled = false;
  group.add(rockMesh);

  // ---------- Tanah luas, bukit hijau, gunung ----------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshStandardMaterial({ color: 0x4a6a3a, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  group.add(ground);
  // bukit hijau berlapis
  const hillMat = new THREE.MeshStandardMaterial({ color: 0x3f5f35, roughness: 1, flatShading: true });
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + R(-0.1, 0.1);
    const dist = R(115, 150);
    const hx = Math.cos(a) * dist;
    const hz = Math.sin(a) * dist;
    if (Math.hypot(hx - CASTLE.x, hz - CASTLE.z) < 55) continue;
    const s = R(30, 55);
    const m = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 6), hillMat);
    m.scale.y = R(0.3, 0.5);
    m.position.set(hx, -s * 0.1, hz);
    group.add(m);
  }
  // gunung berbatu dengan puncak salju
  const mountMat = new THREE.MeshStandardMaterial({ color: 0x7a8494, roughness: 1, flatShading: true });
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xf4f8ff, roughness: 1, flatShading: true });
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2 + R(-0.08, 0.08);
    const dist = R(190, 250);
    const mx = Math.cos(a) * dist;
    const mz = Math.sin(a) * dist;
    const rad = R(45, 80);
    const h = R(70, 135);
    const geo = new THREE.ConeGeometry(rad, h, 7, 4);
    const pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const y = pos.getY(k);
      if (y > -h / 2 + 1 && y < h / 2 - 1) {
        pos.setX(k, pos.getX(k) + R(-0.14, 0.14) * rad * (1 - (y + h / 2) / h));
        pos.setZ(k, pos.getZ(k) + R(-0.14, 0.14) * rad * (1 - (y + h / 2) / h));
      }
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mountMat);
    m.position.set(mx, h / 2 - 4, mz);
    group.add(m);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(rad * 0.38, h * 0.34, 7, 2), snowMat);
    cap.position.set(mx, h * 0.83 - 4 - 0.5, mz);
    group.add(cap);
  }

  // ---------- Langit dan awan ----------
  const sc = document.createElement('canvas');
  sc.width = 8;
  sc.height = 256;
  const sg = sc.getContext('2d');
  const grad = sg.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#2f5fb8');
  grad.addColorStop(0.45, '#6f9fdc');
  grad.addColorStop(0.5, '#bcd6f0');
  grad.addColorStop(1, '#dfe9f6');
  sg.fillStyle = grad;
  sg.fillRect(0, 0, 8, 256);
  const skyTex = new THREE.CanvasTexture(sc);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(520, 24, 16), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -10;
  group.add(sky);
  const cc = document.createElement('canvas');
  cc.width = cc.height = 128;
  const cg = cc.getContext('2d');
  for (let i = 0; i < 9; i++) {
    const rg = cg.createRadialGradient(30 + r() * 68, 54 + r() * 20, 2, 64, 64, 30 + r() * 16);
    rg.addColorStop(0, 'rgba(255,255,255,.55)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    cg.fillStyle = rg;
    cg.fillRect(0, 0, 128, 128);
  }
  const cloudTex = new THREE.CanvasTexture(cc);
  const clouds = [];
  for (let i = 0; i < 16; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, fog: false, depthWrite: false, opacity: 0.9 }));
    const a = R(0, 6.28);
    const dist = R(180, 380);
    sp.position.set(Math.cos(a) * dist, R(110, 200), Math.sin(a) * dist);
    const s = R(90, 170);
    sp.scale.set(s, s * 0.45, 1);
    group.add(sp);
    clouds.push({ sp, a, dist, y: sp.position.y, v: R(0.004, 0.012) });
  }

  // ---------- Gerbang Kerajaan di pagar selatan ----------
  const stone = new THREE.MeshStandardMaterial({ map: noiseTex('#9a9a98', ['#7a7a78', '#b0b0ae', '#8a8a86'], 2, 250), roughness: 1 });
  const gate = new THREE.Group();
  for (const sx of [-1, 1]) {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(2.2, 6.5, 2.2), stone);
    tower.position.set(sx * 3.1, 3.25, 0);
    gate.add(tower);
    for (let k = 0; k < 3; k++) {
      const mer = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.6), stone);
      mer.position.set(sx * 3.1 + (k - 1) * 0.75, 6.85, 0);
      gate.add(mer);
    }
    colliders.push({ x0: ROYAL_GATE.x + sx * 3.1 - 1.2, x1: ROYAL_GATE.x + sx * 3.1 + 1.2, z0: -38.2, z1: -34.6 });
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(8.4, 1.4, 2), stone);
  lintel.position.set(0, 5.6, 0);
  gate.add(lintel);
  const arcBack = new THREE.Mesh(new THREE.BoxGeometry(4, 4.4, 0.4), new THREE.MeshBasicMaterial({ color: 0xffe9b0 }));
  arcBack.position.set(0, 2.2, -0.6);
  gate.add(arcBack);
  // spanduk kerajaan
  const bc = document.createElement('canvas');
  bc.width = 256;
  bc.height = 128;
  const bg = bc.getContext('2d');
  bg.fillStyle = '#7a1f2a';
  bg.fillRect(0, 0, 256, 128);
  bg.strokeStyle = '#e8c860';
  bg.lineWidth = 8;
  bg.strokeRect(6, 6, 244, 116);
  bg.fillStyle = '#ffe9a8';
  bg.font = 'bold 34px system-ui, sans-serif';
  bg.textAlign = 'center';
  bg.textBaseline = 'middle';
  bg.fillText('ROYAL ROAD', 128, 48);
  bg.font = 'bold 22px system-ui, sans-serif';
  bg.fillText('Kingdom of Aurelia', 128, 88);
  const bt = new THREE.CanvasTexture(bc);
  bt.colorSpace = THREE.SRGBColorSpace;
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(4, 2), new THREE.MeshBasicMaterial({ map: bt, side: THREE.DoubleSide }));
  banner.position.set(0, 4.6, 1.05);
  gate.add(banner);
  gate.position.set(ROYAL_GATE.x, 0, -37.8);
  group.add(gate);
  // jalan menuju kastil
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x9a8460, roughness: 1 });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(7, 70), roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.set(CASTLE.x, 0.02, -70);
  group.add(road);
  const gpath = new THREE.Mesh(new THREE.PlaneGeometry(5, 6), roadMat);
  gpath.rotation.x = -Math.PI / 2;
  gpath.position.set(ROYAL_GATE.x, 0.02, -32.5);
  group.add(gpath);

  // ---------- Kastil kerajaan di atas bukit ----------
  const castle = new THREE.Group();
  const hill = new THREE.Mesh(new THREE.SphereGeometry(44, 20, 10), new THREE.MeshStandardMaterial({ color: 0x4d6e3b, roughness: 1, flatShading: true }));
  hill.scale.y = 0.05;
  hill.position.y = -0.4;
  // bukit dihapus: pemain berjalan di tanah datar, bukit membuatnya tenggelam
  const BASE = 0;
  const castleStone = new THREE.MeshStandardMaterial({ map: noiseTex('#a2a29e', ['#8a8a86', '#b8b8b4', '#9a9690'], 4, 350), roughness: 1 });
  const roofRed = new THREE.MeshStandardMaterial({ color: 0x9a2a30, roughness: 0.9 });
  const roofBlue = new THREE.MeshStandardMaterial({ color: 0x2f4a9a, roughness: 0.9 });
  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y + BASE, z);
    castle.add(m);
    return m;
  };
  const W = 44;
  const D = 32;
  const WH = 8;
  // dinding tirai (depan dengan celah gerbang)
  add(new THREE.BoxGeometry(W / 2 - 4, WH, 2), castleStone, -(W / 4 + 2), WH / 2, D / 2);
  add(new THREE.BoxGeometry(W / 2 - 4, WH, 2), castleStone, W / 4 + 2, WH / 2, D / 2);
  add(new THREE.BoxGeometry(8, 2.2, 2), castleStone, 0, WH - 1.1, D / 2);
  add(new THREE.BoxGeometry(W, WH, 2), castleStone, 0, WH / 2, -D / 2);
  add(new THREE.BoxGeometry(2, WH, D), castleStone, -W / 2, WH / 2, 0);
  add(new THREE.BoxGeometry(2, WH, D), castleStone, W / 2, WH / 2, 0);
  // gerbang gelap + pintu kayu
  add(new THREE.BoxGeometry(5.6, 6, 0.6), new THREE.MeshStandardMaterial({ color: 0x3a2412, roughness: 1 }), 0, 3, D / 2 + 0.2);
  // gigi dinding (merlon) instanced
  const merPts = [];
  for (let x = -W / 2; x <= W / 2; x += 2.4) {
    merPts.push([x, D / 2], [x, -D / 2]);
  }
  for (let z = -D / 2 + 2.4; z < D / 2; z += 2.4) merPts.push([-W / 2, z], [W / 2, z]);
  const mer = new THREE.InstancedMesh(new THREE.BoxGeometry(1.2, 1.3, 1.2), castleStone, merPts.length);
  merPts.forEach(([x, z], i) => {
    d.position.set(x, WH + 0.65 + BASE, z);
    d.rotation.set(0, 0, 0);
    d.scale.set(1, 1, 1);
    d.updateMatrix();
    mer.setMatrixAt(i, d.matrix);
  });
  mer.frustumCulled = false;
  castle.add(mer);
  // menara sudut + menara gerbang
  const towerAt = (x, z, rad, h, roof) => {
    add(new THREE.CylinderGeometry(rad, rad * 1.08, h, 12), castleStone, x, h / 2, z);
    add(new THREE.CylinderGeometry(rad * 1.2, rad * 1.2, 0.8, 12), castleStone, x, h + 0.4, z);
    add(new THREE.ConeGeometry(rad * 1.3, rad * 2.2, 12), roof, x, h + 0.8 + rad * 1.1, z);
  };
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) towerAt(sx * W / 2, sz * D / 2, 3.2, 13, roofRed);
  for (const sx of [-1, 1]) towerAt(sx * 5.2, D / 2 + 0.5, 2.6, 11, roofBlue);
  // bangunan utama (keep)
  add(new THREE.BoxGeometry(18, 15, 14), castleStone, 0, 7.5, -4);
  add(new THREE.BoxGeometry(20, 1, 16), castleStone, 0, 15.5, -4);
  add(new THREE.ConeGeometry(14, 9, 4), roofBlue, 0, 16 + 4.5, -4).rotation.y = Math.PI / 4;
  for (const sx of [-1, 1]) towerAt(sx * 9, 3, 2.4, 17, roofRed);
  for (const sx of [-1, 1]) towerAt(sx * 9, -11, 2.4, 17, roofRed);
  // menara tengah tinggi + bendera
  add(new THREE.CylinderGeometry(3, 3.4, 12, 12), castleStone, 0, 21, -4);
  add(new THREE.ConeGeometry(4.4, 8, 12), roofRed, 0, 27 + 4, -4);
  const flagTex = bt;
  const mkFlag = (x, y, z) => {
    add(new THREE.CylinderGeometry(0.07, 0.07, 4, 5), new THREE.MeshStandardMaterial({ color: 0x3a2a1a }), x, y + 2, z);
    const f = add(new THREE.PlaneGeometry(2.4, 1.3), new THREE.MeshBasicMaterial({ map: flagTex, side: THREE.DoubleSide }), x + 1.2, y + 3.3, z);
    return f;
  };
  mkFlag(0, 35, -4);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mkFlag(sx * W / 2, 16.5, sz * D / 2);
  // jendela menyala di keep
  const winMat = new THREE.MeshBasicMaterial({ color: 0xffd98a });
  for (let i = 0; i < 18; i++) {
    const w = add(new THREE.BoxGeometry(0.9, 1.6, 0.2), winMat, -6 + (i % 6) * 2.4, 5 + Math.floor(i / 6) * 4.4, 3.2);
    w.position.z = -4 + 7.1;
  }
  const cb = (x0, x1, z0, z1) => colliders.push({ x0: CASTLE.x + x0, x1: CASTLE.x + x1, z0: CASTLE.z + z0, z1: CASTLE.z + z1 });
  cb(-W / 2 - 1, -4, D / 2 - 1.2, D / 2 + 1.2);
  cb(4, W / 2 + 1, D / 2 - 1.2, D / 2 + 1.2);
  cb(-W / 2 - 1, W / 2 + 1, -D / 2 - 1.2, -D / 2 + 1.2);
  cb(-W / 2 - 1.2, -W / 2 + 1.2, -D / 2, D / 2);
  cb(W / 2 - 1.2, W / 2 + 1.2, -D / 2, D / 2);
  cb(-4, 4, D / 2 + 0.4, D / 2 + 1.2); // pintu tertutup bila bukan lewat trigger
  cb(-9.8, 9.8, -11.2, 3.2);
  castle.position.set(CASTLE.x, 0, CASTLE.z);
  group.add(castle);

  return {
    group,
    colliders,
    royalGate: ROYAL_GATE,
    castleDoor: { x: CASTLE.x, z: CASTLE.z + 16 + 2.2, r: 1.6, out: { x: CASTLE.x, z: CASTLE.z + 16 + 5.5, rot: 0 } },
    update(t, dt) {
      for (const c of clouds) {
        c.a += c.v * dt * 0.1;
        c.sp.position.set(Math.cos(c.a) * c.dist, c.y, Math.sin(c.a) * c.dist);
      }
    },
  };
}
