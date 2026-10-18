// Aula takhta kerajaan (interior). Lebih luas dari toko: 24x24, batas gerak 11.
import * as THREE from 'three';

export const HALL_HALF = 11;
const R = 12;
const H = 9;

export function buildCastleHall() {
  const group = new THREE.Group();
  const colliders = [];
  const flickers = [];
  const mats = {};
  const mat = (c, ex = {}) => (mats[c + JSON.stringify(ex)] ||= new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, ...ex }));
  const box = (w, h, d, c, x, y, z, ex) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c, ex));
    m.position.set(x, y, z);
    group.add(m);
    return m;
  };
  const cyl = (rt, rb, h, c, x, y, z, seg = 14, ex) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(c, ex));
    m.position.set(x, y, z);
    group.add(m);
    return m;
  };
  const col = (x, z, hx, hz) => colliders.push({ x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz });

  // lantai marmer kotak-kotak
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    g.fillStyle = (i + j) % 2 ? '#8e8c88' : '#b9b6b0';
    g.fillRect(i * 32, j * 32, 32, 32);
  }
  const ft = new THREE.CanvasTexture(cv);
  ft.colorSpace = THREE.SRGBColorSpace;
  ft.wrapS = ft.wrapT = THREE.RepeatWrapping;
  ft.repeat.set(6, 6);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(R * 2 + 1, R * 2 + 1), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.6 }));
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(R * 2 + 1, R * 2 + 1), mat(0x4a3a30));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = H;
  group.add(ceil);

  // dinding batu (depan dengan celah pintu 3 lebar)
  const wall = 0x8d8a84;
  box(R * 2 + 1, H, 0.6, wall, 0, H / 2, -R - 0.3);
  box(0.6, H, R * 2 + 1, wall, -R - 0.3, H / 2, 0);
  box(0.6, H, R * 2 + 1, wall, R + 0.3, H / 2, 0);
  const seg = (R * 2 + 1 - 3) / 2;
  box(seg, H, 0.6, wall, -(1.5 + seg / 2), H / 2, R + 0.3);
  box(seg, H, 0.6, wall, 1.5 + seg / 2, H / 2, R + 0.3);
  box(3, H - 3.6, 0.6, wall, 0, 3.6 + (H - 3.6) / 2, R + 0.3);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(3, 3.6), new THREE.MeshBasicMaterial({ color: 0xcfe6ff }));
  glow.position.set(0, 1.8, R + 0.55);
  group.add(glow);

  // karpet merah sampai singgasana + tepi emas
  box(3.2, 0.04, R * 2 - 3, 0xa01c28, 0, 0.03, 1.4);
  box(0.25, 0.05, R * 2 - 3, 0xe0b84a, -1.7, 0.035, 1.4);
  box(0.25, 0.05, R * 2 - 3, 0xe0b84a, 1.7, 0.035, 1.4);

  // dais + singgasana
  box(11, 0.5, 5, 0x6e6a64, 0, 0.25, -R + 2.5);
  box(8, 0.5, 4, 0x7e7a74, 0, 0.75, -R + 2.1);
  col(0, -R + 2.5, 5.5, 2.5);
  box(2.2, 0.3, 1.6, 0xb8892a, 0, 1.15, -R + 1.4);
  box(2.2, 3.2, 0.35, 0x8a1f2c, 0, 2.7, -R + 0.7);
  box(0.3, 3.5, 0.5, 0xe0b84a, -1.15, 2.6, -R + 0.7);
  box(0.3, 3.5, 0.5, 0xe0b84a, 1.15, 2.6, -R + 0.7);
  box(2.6, 0.3, 0.5, 0xe0b84a, 0, 4.4, -R + 0.7);
  for (const sx of [-1, 1]) box(0.25, 0.7, 1.4, 0xe0b84a, sx * 1.1, 1.65, -R + 1.4);

  // pilar dua baris
  for (const sx of [-1, 1]) {
    for (let z = -6; z <= 9; z += 3.75) {
      cyl(0.75, 0.9, 0.5, 0x9a968e, sx * 6, 0.25, z, 12);
      cyl(0.55, 0.55, H - 1, 0xb2aea6, sx * 6, H / 2, z, 12);
      cyl(0.8, 0.6, 0.5, 0x9a968e, sx * 6, H - 0.5, z, 12);
      col(sx * 6, z, 0.8, 0.8);
    }
  }
  // spanduk di dinding
  const bc = document.createElement('canvas');
  bc.width = 64;
  bc.height = 160;
  const bg = bc.getContext('2d');
  bg.fillStyle = '#8a1f2c';
  bg.fillRect(0, 0, 64, 160);
  bg.fillStyle = '#e0b84a';
  bg.fillRect(0, 0, 64, 8);
  bg.beginPath();
  bg.moveTo(32, 40);
  bg.lineTo(52, 80);
  bg.lineTo(32, 120);
  bg.lineTo(12, 80);
  bg.closePath();
  bg.fill();
  const bt = new THREE.CanvasTexture(bc);
  bt.colorSpace = THREE.SRGBColorSpace;
  for (const sx of [-1, 1]) {
    for (let z = -8; z <= 8; z += 4) {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 3.5), new THREE.MeshBasicMaterial({ map: bt, side: THREE.DoubleSide }));
      b.position.set(sx * (R - 0.05), 5, z);
      b.rotation.y = -sx * Math.PI / 2;
      group.add(b);
    }
  }
  b0: {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 6), new THREE.MeshBasicMaterial({ map: bt, side: THREE.DoubleSide }));
    b.position.set(0, 5.2, -R + 0.1);
    group.add(b);
    break b0;
  }

  // lampu gantung + obor
  const lamp = (x, z, intensity) => {
    cyl(0.05, 0.05, 1.4, 0x222222, x, H - 0.7, z, 5);
    cyl(0.5, 0.35, 0.18, 0xe0b84a, x, H - 1.5, z, 10);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
    flame.position.set(x, H - 1.35, z);
    group.add(flame);
    const l = new THREE.PointLight(0xffd9a0, intensity, 24, 1.6);
    l.position.set(x, H - 1.9, z);
    l.userData.keep = true;
    group.add(l);
    flickers.push({ l, base: intensity, amp: 0.08, ph: x * 3 + z });
  };
  for (const z of [-6, 0, 6]) for (const x of [-6, 0, 6]) lamp(x, z, 9);
  lamp(0, -R + 3, 12);

  // meja bundar dan bangku di sisi aula
  for (const sx of [-1, 1]) {
    cyl(1.3, 1.3, 0.12, 0x6a4a28, sx * 9, 1.0, 5, 16);
    cyl(0.2, 0.3, 1, 0x4a3018, sx * 9, 0.5, 5, 8);
    col(sx * 9, 5, 1.4, 1.4);
    box(2.6, 0.45, 0.6, 0x5a3b1e, sx * 9, 0.23, 7.2);
    box(2.6, 0.45, 0.6, 0x5a3b1e, sx * 9, 0.23, 2.8);
  }

  return {
    group,
    colliders,
    half: HALL_HALF,
    exit: { x: 0, z: R - 1.1, r: 1.2 },
    spawn: { x: 0, z: R - 2.6, rot: Math.PI },
    update(t) {
      for (const f of flickers) f.l.intensity = f.base * (1 + f.amp * Math.sin(t * 7 + f.ph));
    },
  };
}
