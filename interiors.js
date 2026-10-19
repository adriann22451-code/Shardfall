// Interior toko: Blacksmith (smithy) dan General Store (store). Dibangun dari bentuk sederhana, tanpa file model.
import * as THREE from 'three';

export const INTERIOR_HALF = 5.4; // batas gerak pemain (dinding dalam di 6.0)
const ROOM = 6;
const WALL_H = 3.6;

function canvasTex(draw, w = 256, h = 256, rep = 1) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rep, rep);
  return t;
}

function plankTexture() {
  return canvasTex((g, w, h) => {
    g.fillStyle = '#7b5535';
    g.fillRect(0, 0, w, h);
    const n = 8;
    for (let i = 0; i < n; i++) {
      const y = (i * h) / n;
      g.fillStyle = `hsl(28, 38%, ${28 + ((i * 7) % 11)}%)`;
      g.fillRect(0, y + 1, w, h / n - 2);
      g.fillStyle = 'rgba(0,0,0,.35)';
      g.fillRect(0, y, w, 2);
      for (let k = 0; k < 5; k++) {
        g.fillStyle = 'rgba(0,0,0,.08)';
        g.fillRect(Math.random() * w, y + 3 + Math.random() * (h / n - 6), 30 + Math.random() * 60, 1);
      }
    }
  }, 256, 256, 6);
}

export function buildInterior(kind) {
  const group = new THREE.Group();
  const colliders = [];
  const flickers = [];
  let fillShelves = null; // toko: ganti botol sederhana dengan model 3D

  const mats = {};
  const mat = (color, extra = {}) => {
    const key = color + JSON.stringify(extra);
    return (mats[key] ||= new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra }));
  };
  const box = (w, h, d, color, x, y, z, extra) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, extra));
    m.position.set(x, y, z);
    group.add(m);
    return m;
  };
  const cyl = (rt, rb, h, color, x, y, z, seg = 14, extra) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color, extra));
    m.position.set(x, y, z);
    group.add(m);
    return m;
  };
  const col = (cx, cz, hx, hz) => colliders.push({ x0: cx - hx, x1: cx + hx, z0: cz - hz, z1: cz + hz });
  const light = (color, intensity, dist, x, y, z, flicker = 0) => {
    const l = new THREE.PointLight(color, intensity, dist, 2);
    l.position.set(x, y, z);
    group.add(l);
    flickers.push({ l, base: intensity, amp: flicker, ph: Math.random() * 10 });
    return l;
  };
  const lantern = (x, y, z) => {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd98a }));
    s.position.set(x, y, z);
    group.add(s);
    box(0.03, 0.5, 0.03, 0x222222, x, y + 0.35, z);
  };
  const barrel = (x, z) => {
    cyl(0.42, 0.42, 0.95, 0x6b4527, x, 0.48, z);
    for (const y of [0.2, 0.75]) cyl(0.44, 0.44, 0.06, 0x2a2a2e, x, y, z, 14);
    col(x, z, 0.45, 0.45);
  };
  const crate = (x, z, y = 0, s = 0.9) => {
    box(s, s, s, 0x8b6238, x, y + s / 2, z);
    box(s + 0.02, 0.08, s + 0.02, 0x5a3b1e, x, y + s * 0.15, z);
    box(s + 0.02, 0.08, s + 0.02, 0x5a3b1e, x, y + s * 0.85, z);
  };

  // ----- Lantai, dinding, pintu keluar -----
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM * 2 + 1, ROOM * 2 + 1), new THREE.MeshStandardMaterial({ map: plankTexture(), roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);

  const plaster = kind === 'smithy' ? 0x9a8f86 : 0xcdb78f;
  const T = 0.4;
  box(ROOM * 2 + 1, WALL_H, T, plaster, 0, WALL_H / 2, -ROOM - T / 2); // belakang
  box(T, WALL_H, ROOM * 2 + 1, plaster, -ROOM - T / 2, WALL_H / 2, 0);
  box(T, WALL_H, ROOM * 2 + 1, plaster, ROOM + T / 2, WALL_H / 2, 0);
  const seg = (ROOM * 2 + 1 - 2) / 2; // dinding depan dengan celah pintu selebar 2
  box(seg, WALL_H, T, plaster, -(1 + seg / 2), WALL_H / 2, ROOM + T / 2);
  box(seg, WALL_H, T, plaster, 1 + seg / 2, WALL_H / 2, ROOM + T / 2);
  box(2, WALL_H - 2.7, T, plaster, 0, 2.7 + (WALL_H - 2.7) / 2, ROOM + T / 2);
  for (const sx of [-1, 1]) box(0.28, 2.8, 0.55, 0x4a2f18, sx * 1.1, 1.4, ROOM + T / 2);
  box(2.5, 0.28, 0.55, 0x4a2f18, 0, 2.85, ROOM + T / 2);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2, 2.7), new THREE.MeshBasicMaterial({ color: 0xfff0c0 }));
  glow.position.set(0, 1.35, ROOM + T + 0.1);
  group.add(glow);
  // balok kayu dekoratif
  const beam = 0x4a2f18;
  for (const x of [-4, -1.5 * 0, 4]) {
    if (x === 0) continue;
    box(0.25, WALL_H, 0.12, beam, x, WALL_H / 2, -ROOM + 0.06);
  }
  box(ROOM * 2, 0.25, 0.14, beam, 0, WALL_H - 0.15, -ROOM + 0.07);
  box(0.14, 0.25, ROOM * 2, beam, -ROOM + 0.07, WALL_H - 0.15, 0);
  box(0.14, 0.25, ROOM * 2, beam, ROOM - 0.07, WALL_H - 0.15, 0);
  box(ROOM * 2, 0.9, 0.1, 0x5a3b1e, 0, 0.45, -ROOM + 0.05); // lis bawah
  box(0.1, 0.9, ROOM * 2, 0x5a3b1e, -ROOM + 0.05, 0.45, 0);
  box(0.1, 0.9, ROOM * 2, 0x5a3b1e, ROOM - 0.05, 0.45, 0);

  if (kind === 'smithy') {
    // Tungku
    box(2.8, 1.3, 1.9, 0x5b5b63, -4.2, 0.65, -4.9);
    box(2.0, 1.9, 1.3, 0x4a4a52, -4.2, 2.25, -5.2);
    box(0.9, 2.2, 0.9, 0x4a4a52, -4.2, 3.4, -5.3);
    const coal = box(1.9, 0.12, 1.2, 0xff5a10, -4.2, 1.33, -4.9, { emissive: 0xff5a10, emissiveIntensity: 1.6 });
    coal.userData.coal = true;
    col(-4.2, -4.9, 1.45, 1.0);
    light(0xff7a2a, 45, 18, -4.2, 2.0, -3.8, 0.25);
    // Paron
    box(0.6, 0.7, 0.5, 0x3a3a40, -1.9, 0.35, -2.9);
    box(1.1, 0.26, 0.5, 0x55555d, -1.9, 0.83, -2.9);
    box(0.4, 0.14, 0.3, 0x55555d, -1.15, 0.8, -2.9);
    col(-1.9, -2.9, 0.65, 0.35);
    // Bak air pendingin
    box(1.7, 0.6, 0.9, 0x4a3a2a, -4.9, 0.3, 0.6);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.7), new THREE.MeshStandardMaterial({ color: 0x3a7fd0, roughness: 0.2 }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(-4.9, 0.61, 0.6);
    group.add(water);
    col(-4.9, 0.6, 0.9, 0.5);
    // Meja jaga
    box(4.4, 1.0, 0.9, 0x6b4528, 2.6, 0.5, -1.7);
    box(4.6, 0.1, 1.1, 0x8a5d36, 2.6, 1.05, -1.7);
    col(2.6, -1.7, 2.3, 0.6);
    // Senjata di meja & dinding
    box(0.12, 0.05, 1.0, 0xb8c2cc, 1.5, 1.14, -1.7);
    box(0.12, 0.05, 0.8, 0xb8c2cc, 3.3, 1.14, -1.8);
    box(4.6, 0.12, 0.35, 0x5a3b1e, 2.6, 1.9, -ROOM + 0.3);
    for (const x of [0.8, 1.8, 2.8, 3.8, 4.7]) {
      box(0.1, 1.0, 0.04, 0xcfd6de, x, 2.5, -ROOM + 0.12);
      box(0.3, 0.07, 0.07, 0x7a5a30, x, 2.05, -ROOM + 0.12);
    }
    for (const x of [-0.6, 0.0]) {
      const s = cyl(0.4, 0.4, 0.06, 0x8a2a2a, x, 2.3, -ROOM + 0.15, 20);
      s.rotation.x = Math.PI / 2;
      const b = cyl(0.12, 0.12, 0.08, 0xcfd6de, x, 2.3, -ROOM + 0.2, 12);
      b.rotation.x = Math.PI / 2;
    }
    // Patung baju zirah di dinding kanan
    box(0.5, 1.5, 0.12, 0x5a3b1e, ROOM - 0.4, 0.75, -2.0);
    box(0.7, 0.9, 0.4, 0x8a929c, ROOM - 0.55, 1.45, -2.0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), mat(0x9aa2ac));
    head.position.set(ROOM - 0.55, 2.15, -2.0);
    group.add(head);
    col(ROOM - 0.55, -2.0, 0.45, 0.5);
    // Tong dan peti
    barrel(4.7, 4.4);
    barrel(-4.8, 3.6);
    crate(4.8, 3.2);
    crate(-4.8, -1.2);
    crate(-4.8, -1.2, 0.9, 0.7);
    col(4.8, 3.2, 0.5, 0.5);
    col(-4.8, -1.2, 0.5, 0.5);
    lantern(0, 3.0, 0.5);
    light(0xffd6a0, 32, 18, 0, 3.0, 0.8, 0.05);
  } else {
    // Meja toko
    box(6.2, 1.0, 0.9, 0x6b4528, 0, 0.5, -1.7);
    box(6.4, 0.1, 1.1, 0x8a5d36, 0, 1.05, -1.7);
    col(0, -1.7, 3.2, 0.6);
    // Rak botol di dinding belakang
    const shelfYs = [0.95, 1.75, 2.55];
    for (const y of shelfYs) box(10.6, 0.1, 0.55, 0x5a3b1e, 0, y, -ROOM + 0.3);
    for (const x of [-5.2, 5.2]) box(0.12, 2.8, 0.55, 0x5a3b1e, x, 1.4, -ROOM + 0.3);
    col(0, -ROOM + 0.35, 5.4, 0.4);
    const palette = [0xe14a4a, 0x4ac96a, 0xe879c8, 0xe89a3a, 0x4aa8ff, 0xb06aff];
    const bodyGeo = new THREE.CylinderGeometry(0.11, 0.13, 0.3, 10);
    const per = 16;
    const bottles = new THREE.InstancedMesh(bodyGeo, new THREE.MeshStandardMaterial({ roughness: 0.3 }), per * shelfYs.length);
    const neckGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.14, 8);
    const necks = new THREE.InstancedMesh(neckGeo, new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.3 }), per * shelfYs.length);
    const m4 = new THREE.Matrix4();
    let n = 0;
    for (let r = 0; r < shelfYs.length; r++) {
      for (let i = 0; i < per; i++) {
        const x = -4.7 + i * (9.4 / (per - 1));
        m4.makeTranslation(x, shelfYs[r] + 0.2, -ROOM + 0.3);
        bottles.setMatrixAt(n, m4);
        bottles.setColorAt(n, new THREE.Color(palette[(i + r * 2) % palette.length]));
        m4.makeTranslation(x, shelfYs[r] + 0.42, -ROOM + 0.3);
        necks.setMatrixAt(n, m4);
        n++;
      }
    }
    group.add(bottles, necks);
    const tableCyls = [];
    // Barang di meja
    for (const x of [-2.4, -1.2, 1.4, 2.6]) {
      tableCyls.push(cyl(0.13, 0.13, 0.3, palette[Math.abs(Math.round(x * 3)) % palette.length], x, 1.25, -1.75, 10, { roughness: 0.3 }));
    }
    box(0.5, 0.3, 0.4, 0xc9a24a, 0.1, 1.25, -1.6, { metalness: 0.4 }); // kotak uang
    fillShelves = (models) => {
      const list = Object.values(models).filter(Boolean);
      if (!list.length) return;
      bottles.visible = false;
      necks.visible = false;
      for (const c of tableCyls) c.visible = false;
      const put = (src, x, y, z, h) => {
        const o = src.clone();
        const b = new THREE.Box3().setFromObject(o);
        const sz = b.getSize(new THREE.Vector3());
        const k = h / Math.max(sz.y, 0.001);
        o.scale.setScalar(k);
        const b2 = new THREE.Box3().setFromObject(o);
        o.position.set(x - (b2.min.x + b2.max.x) / 2, y - b2.min.y, z - (b2.min.z + b2.max.z) / 2);
        const wrap = new THREE.Group();
        wrap.add(o);
        wrap.rotation.y = Math.random() * 6.28;
        wrap.traverse((m) => {
          if (m.isMesh) m.castShadow = true;
        });
        wrap.position.set(x, 0, z);
        o.position.x -= x;
        o.position.z -= z;
        group.add(wrap);
      };
      let n = 0;
      for (let r = 0; r < shelfYs.length; r++) {
        for (let i = 0; i < 14; i++) {
          const x = -4.7 + i * (9.4 / 13);
          put(list[(i + r * 2) % list.length], x, shelfYs[r] + 0.05, -ROOM + 0.3, 0.42 + ((i * 7 + r) % 3) * 0.05);
          n++;
        }
      }
      [-2.4, -1.2, 1.4, 2.6].forEach((x, i) => put(list[i % list.length], x, 1.1, -1.75, 0.45));
    };
    // Karpet
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 5.2), new THREE.MeshStandardMaterial({ color: 0x7a2530, roughness: 1 }));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, 0.02, 2.0);
    group.add(rug);
    const rug2 = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 4.5), new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 1 }));
    rug2.rotation.x = -Math.PI / 2;
    rug2.position.set(0, 0.025, 2.0);
    group.add(rug2);
    // Tong, peti, karung
    barrel(-4.8, 3.8);
    barrel(-4.8, 2.7);
    barrel(4.8, 4.2);
    crate(4.8, 2.9);
    crate(4.8, 2.9, 0.9, 0.7);
    crate(-4.8, -1.0);
    col(-4.8, 3.3, 0.5, 1.0);
    col(4.8, 4.2, 0.5, 0.5);
    col(4.8, 2.9, 0.5, 0.5);
    col(-4.8, -1.0, 0.5, 0.5);
    for (const [x, z] of [[4.5, -4.2], [3.7, -4.6], [4.7, -3.2]]) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), mat(0xb59a6a));
      s.scale.y = 0.85;
      s.position.set(x, 0.35, z);
      group.add(s);
    }
    col(4.3, -4.0, 0.9, 0.9);
    lantern(-2.2, 3.0, 0.5);
    lantern(2.2, 3.0, 0.5);
    light(0xffd6a0, 30, 18, -2.2, 3.0, 0.8, 0.05);
    light(0xffd6a0, 30, 18, 2.2, 3.0, 0.8, 0.05);
  }

  return {
    group,
    colliders,
    fillShelves,
    exit: { x: 0, z: 4.9, r: 1.0 },
    spawn: { x: 0, z: 3.4, rot: Math.PI },
    update(t) {
      for (const f of flickers) f.l.intensity = f.base * (1 + f.amp * Math.sin(t * 9 + f.ph) * Math.sin(t * 3.7 + f.ph));
    },
  };
}
