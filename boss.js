// Sarang Root Warden: ruang batu berlumut dengan akar raksasa (dirakit dari KayKit Dungeon Pack + akar prosedural).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const BOSS_HALF = 24; // sumbu dinding; area main dibatasi 22
export const BOSS_PLAY = 22;
const NAMES = ['floor_dirt_large', 'floor_tile_large', 'wall', 'wall_pillar', 'pillar'];
export const BOSS_MODEL_COUNT = NAMES.length;

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

export async function buildBossRoom(onProgress) {
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
          // salinan sendiri (bukan material dungeon) lalu diberi nuansa lumut
          o.material = o.material.clone();
          o.material.color.set(n.startsWith('floor') ? 0x9fb08a : 0x86a07c);
        }
      });
      models[n] = g.scene;
      onProgress?.(++done, NAMES.length);
    })
  );

  const group = new THREE.Group();
  const colliders = [];
  const B = BOSS_HALF;
  const rnd = rng(31);

  const mat4 = (x, y, z, ry) =>
    new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry),
      new THREE.Vector3(1, 1, 1)
    );
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

  // Lantai: sebagian besar tanah, sebagian ubin tua
  const dirt = [];
  const tiles = [];
  for (let i = -6; i < 6; i++) {
    for (let j = -6; j < 6; j++) {
      const m = mat4(i * 4 + 2, -0.1, j * 4 + 2, Math.floor(rnd() * 4) * (Math.PI / 2));
      (rnd() < 0.3 ? tiles : dirt).push(m);
    }
  }
  instanced('floor_dirt_large', dirt);
  instanced('floor_tile_large', tiles);

  // Dinding keliling
  const plain = [];
  const pillars = [];
  const sides = [
    { rot: 0, at: (t) => [t, -B] },
    { rot: Math.PI, at: (t) => [t, B] },
    { rot: Math.PI / 2, at: (t) => [-B, t] },
    { rot: -Math.PI / 2, at: (t) => [B, t] },
  ];
  for (const s of sides) {
    for (let k = 0; k < 13; k++) {
      const [x, z] = s.at(-B + k * 4);
      (k % 4 === 0 ? pillars : plain).push(mat4(x, 0, z, s.rot));
    }
  }
  instanced('wall', plain);
  instanced('wall_pillar', pillars);

  // Tiang di dalam ruangan
  for (const [px, pz] of [[-12, -8], [12, -8], [-12, 12], [12, 12]]) {
    const p = models.pillar.clone();
    p.position.set(px, 0, pz);
    group.add(p);
    colliders.push({ x0: px - 0.9, x1: px + 0.9, z0: pz - 0.9, z1: pz + 0.9 });
  }

  // ---------- Akar prosedural ----------
  const rootMat = new THREE.MeshStandardMaterial({ color: 0x4a3220, roughness: 1, emissive: 0x16361a, emissiveIntensity: 0.6 });
  const addRoot = (pts, r0) => {
    const curve = new THREE.CatmullRomCurve3(pts);
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 28, r0, 6, false), rootMat);
    mesh.castShadow = true;
    group.add(mesh);
  };
  const jitter = (v, a) => v + (rnd() - 0.5) * a;
  for (const s of sides) {
    const inward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), s.rot);
    const along = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), s.rot);
    for (let n = 0; n < 7; n++) {
      const t = -B + 2 + rnd() * (2 * B - 4);
      const [bx, bz] = s.at(t);
      const P = (h, off, lat) =>
        new THREE.Vector3(bx + inward.x * off + along.x * lat, h, bz + inward.z * off + along.z * lat);
      // menjuntai dari atas dinding lalu melingkar di lantai
      addRoot(
        [P(4.4, 0.5, 0), P(3.2, 0.7, jitter(0, 0.8)), P(1.8, 0.6, jitter(0, 1.0)), P(0.5, 1.0, jitter(0, 1.2)), P(0.2, 1.8 + rnd() * 2, jitter(0, 2.0))],
        0.16 + rnd() * 0.14
      );
    }
    for (let n = 0; n < 4; n++) {
      // akar yang merayap di lantai
      const t = -B + 3 + rnd() * (2 * B - 6);
      const [bx, bz] = s.at(t);
      const pts = [];
      for (let i = 0; i < 6; i++) {
        pts.push(new THREE.Vector3(bx + inward.x * (0.8 + i * 1.5) + along.x * jitter(0, 1.6), 0.18 + (i % 2) * 0.12, bz + inward.z * (0.8 + i * 1.5) + along.z * jitter(0, 1.6)));
      }
      addRoot(pts, 0.22 + rnd() * 0.12);
    }
  }
  // Gundukan akar besar di belakang tempat boss muncul
  for (let i = 0; i < 7; i++) {
    const a = -0.9 + (i / 6) * 1.8;
    addRoot(
      [new THREE.Vector3(Math.sin(a) * 9, 0.1, 13), new THREE.Vector3(Math.sin(a) * 8, 2.2 + rnd(), 15), new THREE.Vector3(Math.sin(a) * 4, 5, B - 1.2), new THREE.Vector3(Math.sin(a) * 1.5, 6.8, B - 0.8)],
      0.35 + rnd() * 0.15
    );
  }

  // ---------- Cahaya hijau dan spora ----------
  const lights = [];
  for (const [lx, lz] of [[-14, -14], [14, -14], [-14, 14], [14, 14], [0, 0]]) {
    const l = new THREE.PointLight(0x7dff9a, lx === 0 ? 24 : 34, 30, 2);
    l.position.set(lx, 3.2, lz);
    group.add(l);
    lights.push({ l, base: l.intensity, phase: lx + lz });
  }
  const N = 140;
  const sporePos = new Float32Array(N * 3);
  const sporeSpeed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    sporePos[i * 3] = (rnd() - 0.5) * 2 * BOSS_PLAY;
    sporePos[i * 3 + 1] = rnd() * 6;
    sporePos[i * 3 + 2] = (rnd() - 0.5) * 2 * BOSS_PLAY;
    sporeSpeed[i] = 0.25 + rnd() * 0.5;
  }
  const sporeGeo = new THREE.BufferGeometry();
  sporeGeo.setAttribute('position', new THREE.BufferAttribute(sporePos, 3));
  const spores = new THREE.Points(
    sporeGeo,
    new THREE.PointsMaterial({ color: 0xa6ffb8, size: 0.16, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  spores.frustumCulled = false;
  group.add(spores);

  return {
    group,
    colliders,
    update(t, dt) {
      for (const f of lights) f.l.intensity = f.base * (0.9 + 0.1 * Math.sin(t * 1.7 + f.phase));
      for (let i = 0; i < N; i++) {
        sporePos[i * 3 + 1] += sporeSpeed[i] * dt;
        sporePos[i * 3] += Math.sin(t * 0.6 + i) * 0.2 * dt;
        if (sporePos[i * 3 + 1] > 6.5) sporePos[i * 3 + 1] = 0.1;
      }
      sporeGeo.attributes.position.needsUpdate = true;
    },
  };
}
