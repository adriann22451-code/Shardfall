// Dekorasi dungeon per wilayah (semua dari bentuk prosedural, tanpa file model).
import * as THREE from 'three';

const rng = (seed) => {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
};
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });

export function buildRegionDecor(id, isFree = () => true) {
  const group = new THREE.Group();
  const colliders = [];
  const anim = [];
  const rnd = rng({ root: 11, ember: 22, frost: 33, core: 44 }[id] || 1);
  const R = (a, b) => a + rnd() * (b - a);
  const col = (x, z, hx, hz) => colliders.push({ x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz });

  // Titik acak yang tidak menutupi tempat muncul pemain dan pintu portal
  const NO = [[0, -30], [0, 36], [36, 0]];
  const spot = (minR = 8, edge = 34) => {
    for (let i = 0; i < 40; i++) {
      const x = R(-edge, edge);
      const z = R(-edge, edge);
      if (Math.hypot(x, z) < minR) continue;
      if (NO.some(([px, pz]) => Math.hypot(x - px, z - pz) < 7)) continue;
      if (!isFree(x, z)) continue;
      return [x, z];
    }
    return [0, 0.01];
  };
  const inst = (geo, mat, n, place) => {
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    const d = new THREE.Object3D();
    for (let i = 0; i < n; i++) {
      d.position.set(0, 0, 0);
      d.rotation.set(0, 0, 0);
      d.scale.set(1, 1, 1);
      place(i, d);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    }
    mesh.frustumCulled = false;
    group.add(mesh);
    return mesh;
  };
  const points = (n, color, size, spread, h) => {
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = R(-spread, spread);
      pos[i * 3 + 1] = R(0, h);
      pos[i * 3 + 2] = R(-spread, spread);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
    p.frustumCulled = false;
    group.add(p);
    return { p, pos, n };
  };
  const rock = new THREE.DodecahedronGeometry(1, 0);

  if (id === 'root') {
    // Akar raksasa menjalar dari dinding
    const rootMat = std(0x4a3320, { emissive: 0x0e2a10, emissiveIntensity: 0.6 });
    for (let i = 0; i < 16; i++) {
      const side = Math.floor(R(0, 4));
      const t = R(-30, 30);
      const w = 37;
      const [sx, sz] = [[t, -w], [t, w], [-w, t], [w, t]][side];
      const dir = [[0, 1], [0, -1], [1, 0], [-1, 0]][side];
      const len = R(6, 12);
      const pts = [];
      for (let k = 0; k < 5; k++) {
        const f = k / 4;
        pts.push(new THREE.Vector3(sx + dir[0] * len * f + R(-1, 1) * f * 2, R(0.1, 1.4) * (k % 2 ? 1 : 0.3) + (k === 0 ? 1.5 : 0), sz + dir[1] * len * f + R(-1, 1) * f * 2));
      }
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, R(0.25, 0.5), 6), rootMat);
      tube.castShadow = false;
      group.add(tube);
    }
    // Batu berlumut (rendah) + batu besar
    inst(rock, std(0x55644a), 38, (i, d) => {
      const [x, z] = spot(7);
      const s = R(0.3, 0.8);
      d.position.set(x, s * 0.4, z);
      d.scale.set(s * R(1, 1.6), s * 0.7, s * R(1, 1.6));
      d.rotation.y = R(0, 6);
    });
    for (let i = 0; i < 6; i++) {
      const [x, z] = spot(10);
      const s = R(1.2, 1.8);
      const m = new THREE.Mesh(rock, std(0x4a5a40));
      m.position.set(x, s * 0.6, z);
      m.scale.set(s, s * 0.9, s);
      m.rotation.y = R(0, 6);
      group.add(m);
      col(x, z, s * 0.8, s * 0.8);
    }
    // Pohon mati
    const bark = std(0x3a2a1c);
    for (let i = 0; i < 9; i++) {
      const [x, z] = spot(10);
      const h = R(4, 6.5);
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.5, h, 7), bark);
      trunk.position.y = h / 2;
      g.add(trunk);
      for (let b = 0; b < 3; b++) {
        const len = R(1.4, 2.4);
        const br = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.16, len, 5), bark);
        br.position.set(Math.cos(b * 2.1) * 0.6, h * R(0.55, 0.85), Math.sin(b * 2.1) * 0.6);
        br.rotation.set(R(-0.9, 0.9), 0, R(-0.9, 0.9));
        g.add(br);
      }
      g.position.set(x, 0, z);
      group.add(g);
      col(x, z, 0.55, 0.55);
    }
    // Jamur menyala
    const capGeo = new THREE.SphereGeometry(0.5, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2);
    const cap = inst(capGeo, new THREE.MeshStandardMaterial({ color: 0x7dff9a, emissive: 0x3cff7a, emissiveIntensity: 1.2 }), 46, (i, d) => {
      const [x, z] = spot(6);
      const s = R(0.2, 0.5);
      d.position.set(x, s * 0.9, z);
      d.scale.setScalar(s);
    });
    inst(new THREE.CylinderGeometry(0.08, 0.1, 0.5, 5), std(0xd8e8d0), 46, (i, d) => {
      const m = new THREE.Matrix4();
      cap.getMatrixAt(i, m);
      const p = new THREE.Vector3().setFromMatrixPosition(m);
      d.position.set(p.x, 0.2, p.z);
    });
    const spores = points(90, 0xaaff9a, 0.12, 34, 6);
    anim.push((t, dt) => {
      for (let i = 0; i < spores.n; i++) {
        spores.pos[i * 3 + 1] += dt * 0.25;
        spores.pos[i * 3] += Math.sin(t + i) * dt * 0.2;
        if (spores.pos[i * 3 + 1] > 6) spores.pos[i * 3 + 1] = 0;
      }
      spores.p.geometry.attributes.position.needsUpdate = true;
    });
  } else if (id === 'ember') {
    // Kolam lava (tidak bisa dilewati)
    const lavaMat = new THREE.MeshStandardMaterial({ color: 0xff5a10, emissive: 0xff4a00, emissiveIntensity: 1.5 });
    const rimMat = std(0x1c1210);
    for (let i = 0; i < 8; i++) {
      const [x, z] = spot(10, 32);
      const r = R(1.6, 3.2);
      const rim = new THREE.Mesh(new THREE.CircleGeometry(r + 0.5, 18), rimMat);
      rim.rotation.x = -Math.PI / 2;
      rim.position.set(x, 0.03, z);
      const lava = new THREE.Mesh(new THREE.CircleGeometry(r, 18), lavaMat);
      lava.rotation.x = -Math.PI / 2;
      lava.position.set(x, 0.05, z);
      group.add(rim, lava);
      col(x, z, r * 0.85, r * 0.85);
    }
    anim.push((t) => {
      lavaMat.emissiveIntensity = 1.3 + Math.sin(t * 2.2) * 0.35;
    });
    // Batu membara
    inst(rock, std(0x2a1a14, { emissive: 0x7a2208, emissiveIntensity: 0.7 }), 40, (i, d) => {
      const [x, z] = spot(7);
      const s = R(0.3, 0.8);
      d.position.set(x, s * 0.4, z);
      d.scale.set(s * R(1, 1.5), s * 0.7, s * R(1, 1.5));
      d.rotation.y = R(0, 6);
    });
    // Kereta tambang berisi bijih
    const cartMat = std(0x3a2a20);
    for (let i = 0; i < 5; i++) {
      const [x, z] = spot(10);
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.9, 1.2), cartMat);
      body.position.y = 0.75;
      g.add(body);
      for (const sx of [-0.6, 0.6]) for (const sz of [-0.6, 0.6]) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.12, 10), std(0x151515));
        w.rotation.x = Math.PI / 2;
        w.position.set(sx, 0.28, sz);
        g.add(w);
      }
      const ore = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), new THREE.MeshStandardMaterial({ color: 0xff8a3a, emissive: 0xff5a10, emissiveIntensity: 1 }));
      ore.position.y = 1.3;
      ore.scale.set(1.3, 0.7, 0.8);
      g.add(ore);
      g.position.set(x, 0, z);
      g.rotation.y = R(0, 6);
      group.add(g);
      col(x, z, 1.1, 1.1);
    }
    // Rangka kayu penyangga di dekat dinding
    const beamMat = std(0x4a3220);
    for (let i = 0; i < 10; i++) {
      const side = i % 4;
      const t = R(-26, 26);
      const w = 33.5;
      const [px, pz] = [[t, -w], [t, w], [-w, t], [w, t]][side];
      if (NO.some(([qx, qz]) => Math.hypot(px - qx, pz - qz) < 7)) continue;
      const along = side < 2 ? [1, 0] : [0, 1];
      const g = new THREE.Group();
      for (const s of [-1.6, 1.6]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.6, 0.4), beamMat);
        post.position.set(along[0] * s, 1.8, along[1] * s);
        g.add(post);
      }
      const top = new THREE.Mesh(new THREE.BoxGeometry(along[0] ? 4 : 0.45, 0.4, along[1] ? 4 : 0.45), beamMat);
      top.position.y = 3.7;
      g.add(top);
      g.position.set(px, 0, pz);
      group.add(g);
    }
    const embers = points(110, 0xff8a2a, 0.14, 34, 8);
    anim.push((t, dt) => {
      for (let i = 0; i < embers.n; i++) {
        embers.pos[i * 3 + 1] += dt * (0.8 + (i % 5) * 0.2);
        embers.pos[i * 3] += Math.sin(t * 1.3 + i) * dt * 0.4;
        if (embers.pos[i * 3 + 1] > 8) embers.pos[i * 3 + 1] = 0;
      }
      embers.p.geometry.attributes.position.needsUpdate = true;
    });
  } else if (id === 'frost') {
    // Duri es
    const iceMat = new THREE.MeshStandardMaterial({ color: 0xbfe8ff, emissive: 0x3a8ac0, emissiveIntensity: 0.5, roughness: 0.2, transparent: true, opacity: 0.88 });
    for (let i = 0; i < 20; i++) {
      const [x, z] = spot(8);
      const g = new THREE.Group();
      const n = 3 + Math.floor(R(0, 3));
      let big = 0;
      for (let k = 0; k < n; k++) {
        const h = R(1.4, 4.2);
        const r = R(0.25, 0.7);
        big = Math.max(big, h);
        const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), iceMat);
        c.position.set(R(-0.8, 0.8), h / 2, R(-0.8, 0.8));
        c.rotation.set(R(-0.15, 0.15), 0, R(-0.15, 0.15));
        g.add(c);
      }
      g.position.set(x, 0, z);
      group.add(g);
      if (big > 2.4) col(x, z, 0.9, 0.9);
    }
    // Gundukan salju
    inst(new THREE.SphereGeometry(1, 10, 6), std(0xeef6ff), 28, (i, d) => {
      const [x, z] = spot(6);
      const s = R(1.2, 2.6);
      d.position.set(x, 0, z);
      d.scale.set(s, R(0.25, 0.45), s * R(0.8, 1.3));
      d.rotation.y = R(0, 6);
    });
    // Pilar es
    for (let i = 0; i < 6; i++) {
      const [x, z] = spot(10);
      const h = R(3, 5);
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.3, h, 1.3), new THREE.MeshStandardMaterial({ color: 0xa8d4f0, emissive: 0x2a6aa0, emissiveIntensity: 0.35, roughness: 0.25, transparent: true, opacity: 0.9 }));
      p.position.set(x, h / 2, z);
      p.rotation.y = R(0, 1.5);
      group.add(p);
      col(x, z, 0.85, 0.85);
    }
    inst(rock, std(0x6a7a8a), 24, (i, d) => {
      const [x, z] = spot(7);
      const s = R(0.3, 0.7);
      d.position.set(x, s * 0.4, z);
      d.scale.set(s * 1.3, s * 0.7, s);
      d.rotation.y = R(0, 6);
    });
    const snow = points(140, 0xffffff, 0.16, 36, 10);
    anim.push((t, dt) => {
      for (let i = 0; i < snow.n; i++) {
        snow.pos[i * 3 + 1] -= dt * (0.9 + (i % 4) * 0.25);
        snow.pos[i * 3] += Math.sin(t * 0.8 + i) * dt * 0.35;
        if (snow.pos[i * 3 + 1] < 0) snow.pos[i * 3 + 1] = 10;
      }
      snow.p.geometry.attributes.position.needsUpdate = true;
    });
  } else {
    // Retakan bercahaya di lantai
    const crackMat = new THREE.MeshBasicMaterial({ color: 0xb07aff });
    for (let i = 0; i < 24; i++) {
      const [x, z] = spot(6);
      const m = new THREE.Mesh(new THREE.BoxGeometry(R(2, 6), 0.02, R(0.1, 0.25)), crackMat);
      m.position.set(x, 0.04, z);
      m.rotation.y = R(0, 3.14);
      group.add(m);
    }
    // Pilar patah
    const pillarMat = std(0x2a2040);
    for (let i = 0; i < 9; i++) {
      const [x, z] = spot(10);
      const h = R(1.5, 4.2);
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.2, h, 1.2), pillarMat);
      p.position.set(x, h / 2, z);
      p.rotation.set(R(-0.08, 0.08), R(0, 3), R(-0.08, 0.08));
      group.add(p);
      col(x, z, 0.8, 0.8);
    }
    // Kristal melayang
    const crysMat = new THREE.MeshStandardMaterial({ color: 0xd8b8ff, emissive: 0xa060ff, emissiveIntensity: 1.3, roughness: 0.2 });
    const crystals = [];
    for (let i = 0; i < 16; i++) {
      const [x, z] = spot(8);
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0), crysMat);
      m.scale.set(0.7, 1.7, 0.7);
      m.position.set(x, 2.6, z);
      group.add(m);
      crystals.push({ m, y: R(2, 3.6), ph: R(0, 6) });
    }
    inst(rock, std(0x3a2a5a, { emissive: 0x2a1060, emissiveIntensity: 0.5 }), 30, (i, d) => {
      const [x, z] = spot(7);
      const s = R(0.3, 0.7);
      d.position.set(x, s * 0.4, z);
      d.scale.set(s * 1.3, s * 0.7, s);
      d.rotation.y = R(0, 6);
    });
    const orbs = points(80, 0xc890ff, 0.16, 34, 6);
    anim.push((t, dt) => {
      for (const c of crystals) {
        c.m.position.y = c.y + Math.sin(t * 1.2 + c.ph) * 0.4;
        c.m.rotation.y += dt * 0.8;
      }
      for (let i = 0; i < orbs.n; i++) {
        orbs.pos[i * 3 + 1] += Math.sin(t + i) * dt * 0.3;
        orbs.pos[i * 3] += Math.cos(t * 0.7 + i) * dt * 0.3;
      }
      orbs.p.geometry.attributes.position.needsUpdate = true;
    });
  }

  return {
    id,
    group,
    colliders,
    update(t, dt) {
      for (const f of anim) f(t, dt);
    },
  };
}
