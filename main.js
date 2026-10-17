import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { buildVillage, villageModelCount, NPCS, VILLAGE_NAME } from './village.js';
import { buildDungeon, DUNGEON_MODEL_COUNT } from './dungeon.js';

const hpEl = document.getElementById('hp');
const infoEl = document.getElementById('info');

// ---------- Layar loading ----------
const loadingEl = document.getElementById('loading');
const loadBar = document.getElementById('loadBar');
const loadPct = document.getElementById('loadPct');
const loadStage = document.getElementById('loadStage');
const loadTip = document.getElementById('loadTip');
const BASE_FILES = 9;
const NPC_FILES = new Set(NPCS.map((n) => n.model)).size + new Set(NPCS.flatMap((n) => Object.values(n.items || {})).filter((i) => i !== 'sword_1handed')).size;
const loadTotal = BASE_FILES + villageModelCount() + NPC_FILES + DUNGEON_MODEL_COUNT;
let loadDone = 0;
let loadShown = 0;
let loadFinished = false;
const bump = () => {
  loadDone = Math.min(loadTotal, loadDone + 1);
};
const setStage = (t) => (loadStage.textContent = t);
function loadError(msg) {
  loadingEl.classList.add('error');
  loadStage.textContent = msg;
  loadTip.textContent = 'Open it through a local server / GitHub Pages and make sure the assets/ folder is uploaded too.';
}
// Bar bergerak halus menuju nilai sebenarnya
(function animateLoad() {
  const target = loadFinished ? 1 : loadDone / loadTotal;
  loadShown += (target - loadShown) * 0.12;
  if (target - loadShown < 0.001) loadShown = target;
  loadBar.style.transform = `scaleX(${loadShown})`;
  loadPct.textContent = Math.round(loadShown * 100) + '%';
  if (!(loadFinished && loadShown >= 1)) requestAnimationFrame(animateLoad);
})();
const TIPS = [
  'The Core Crystal cracks a little wider every night.',
  'The monsters out there were once villagers who were sacrificed.',
  'Four crystal shards lie in four regions, each guarded by a warden.',
  'Press Dodge just before an enemy strike lands to avoid it.',
  'The Village Elder knows more than he says.',
  'Leap hits every enemy around you, perfect when surrounded.',
];
let tipIdx = Math.floor(Math.random() * TIPS.length);
const showTip = () => {
  loadTip.classList.add('swap');
  setTimeout(() => {
    loadTip.textContent = TIPS[tipIdx++ % TIPS.length];
    loadTip.classList.remove('swap');
  }, 350);
};
showTip();
const tipTimer = setInterval(showTip, 3800);
// Serpihan kristal melayang di latar
const shardLayer = document.getElementById('loadShards');
for (let i = 0; i < 18; i++) {
  const s = document.createElement('i');
  s.style.left = Math.random() * 100 + '%';
  s.style.setProperty('--sz', 6 + Math.random() * 16 + 'px');
  s.style.animationDuration = 9 + Math.random() * 10 + 's';
  s.style.animationDelay = -Math.random() * 14 + 's';
  s.style.opacity = 0.25 + Math.random() * 0.5;
  shardLayer.appendChild(s);
}
setStage('Loading characters and weapons...');

const TAU = Math.PI * 2;
const ARENA = 38; // batas lantai (lantai 80x80)
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ---------- Setup dasar ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x14161c);
scene.fog = new THREE.Fog(0x14161c, 25, 60);

const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 200);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const canvas = renderer.domElement;

const hemi = new THREE.HemisphereLight(0xaabbff, 0x332211, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -28;
sun.shadow.camera.right = 28;
sun.shadow.camera.top = 28;
sun.shadow.camera.bottom = -28;
sun.shadow.camera.far = 80;
sun.shadow.bias = -0.0005;
scene.add(sun);
scene.add(sun.target);
const SUN_OFFSET = new THREE.Vector3(10, 20, 8);

// Arena dungeon (lantai gelap + grid); desa punya tanahnya sendiri
const arenaGroup = new THREE.Group();
scene.add(arenaGroup);

// Portal kembali ke desa (di ujung arena)
const ARENA_PORTAL = { x: 0, z: 36, r: 1.8 };
const arenaPortal = new THREE.Mesh(
  new THREE.CylinderGeometry(1.6, 1.6, 3.2, 24, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.45, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
);
arenaPortal.position.set(ARENA_PORTAL.x, 1.6, ARENA_PORTAL.z);
arenaGroup.add(arenaPortal);
const arenaPortalLight = new THREE.PointLight(0xffd36b, 25, 16, 2);
arenaPortalLight.position.set(ARENA_PORTAL.x, 2, ARENA_PORTAL.z);
arenaGroup.add(arenaPortalLight);

// ---------- Muat aset (KayKit, CC0) ----------
const loader = new GLTFLoader();
const load = (file) => loader.loadAsync('assets/' + file).then((g) => (bump(), g));

let village, dungeon;
let knightGltf, minionGltf, warriorGltf, generalGltf, moveGltf, moveAdvGltf, meleeGltf, swordGltf, bladeGltf;
try {
  [knightGltf, minionGltf, warriorGltf, generalGltf, moveGltf, moveAdvGltf, meleeGltf, swordGltf, bladeGltf] =
    await Promise.all([
      load('Knight.glb'),
      load('Skeleton_Minion.glb'),
      load('Skeleton_Warrior.glb'),
      load('Rig_Medium_General.glb'),
      load('Rig_Medium_MovementBasic.glb'),
      load('Rig_Medium_MovementAdvanced.glb'),
      load('Rig_Medium_CombatMelee.glb'),
      load('sword_1handed.gltf'),
      load('Skeleton_Blade.gltf'),
    ]);
} catch (err) {
  console.error(err);
  loadError('Failed to load game assets.');
  throw err;
}

setStage('Building the village...');
try {
  village = await buildVillage(bump);
} catch (err) {
  console.error(err);
  loadError('Failed to load village assets (assets/village/).');
  throw err;
}
scene.add(village.group);

setStage('Lighting the dungeon torches...');
try {
  dungeon = await buildDungeon(bump);
} catch (err) {
  console.error(err);
  loadError('Failed to load dungeon assets (assets/dungeon/).');
  throw err;
}
arenaGroup.add(dungeon.group);

// Model warga desa (rig yang sama dengan Knight) dan perlengkapan di tangan mereka
setStage('Calling the villagers...');
const npcGltf = {};
const itemGltf = {};
try {
  const models = [...new Set(NPCS.map((n) => n.model))];
  const items = [...new Set(NPCS.flatMap((n) => Object.values(n.items || {})))];
  await Promise.all([
    ...models.map(async (n) => (npcGltf[n] = await load(n + '.glb'))),
    ...items.map(async (n) => (itemGltf[n] = n === 'sword_1handed' ? swordGltf : await load(n + '.gltf'))),
  ]);
} catch (err) {
  console.error(err);
  loadError('Failed to load villager models.');
  throw err;
}

// Semua karakter KayKit memakai rig yang sama (Rig_Medium), jadi animasinya dibagi bersama.
const clips = [
  ...generalGltf.animations,
  ...moveGltf.animations,
  ...moveAdvGltf.animations,
  ...meleeGltf.animations,
];

function prepareModel(root) {
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      if (o.isSkinnedMesh) o.frustumCulled = false;
    }
  });
}

// ---------- Aktor beranimasi ----------
function makeActor(model) {
  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  for (const clip of clips) actions[clip.name] = mixer.clipAction(clip);
  return { mixer, actions, current: null, lock: 0 };
}

function play(actor, name, { fade = 0.15, once = false, force = false, timeScale = 1 } = {}) {
  const next = actor.actions[name];
  if (!next || (actor.current === next && !force)) return;
  next.reset();
  next.setEffectiveWeight(1);
  next.setEffectiveTimeScale(timeScale);
  if (once) {
    next.setLoop(THREE.LoopOnce, 1);
    next.clampWhenFinished = true;
  } else {
    next.setLoop(THREE.LoopRepeat, Infinity);
  }
  next.fadeIn(fade);
  next.play();
  if (actor.current && actor.current !== next) actor.current.fadeOut(fade);
  actor.current = next;
}

// Mainkan animasi sekali (serang/hit/mati). hold=true menahan pose terakhir selamanya.
function playOnce(actor, name, { hold = false, maxLock = Infinity, timeScale = 1 } = {}) {
  const clip = actor.actions[name]?.getClip();
  play(actor, name, { once: true, force: true, fade: 0.08, timeScale });
  actor.lock = hold ? Infinity : Math.min(clip ? clip.duration / timeScale : 0.4, maxLock);
}

function updateActor(actor, dt) {
  actor.lock = Math.max(0, actor.lock - dt);
  actor.mixer.update(dt);
}

function lerpAngle(a, b, t) {
  const d = ((((b - a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
  return a + d * t;
}

// ---------- Pemain (Knight + pedang) ----------
const player = new THREE.Group();
scene.add(player);

const playerModel = knightGltf.scene;
prepareModel(playerModel);
player.add(playerModel);

const swordModel = swordGltf.scene;
prepareModel(swordModel);
const rightHand = playerModel.getObjectByName('handslot.r');
if (rightHand) rightHand.add(swordModel);

const playerActor = makeActor(playerModel);
play(playerActor, 'Idle_A', { fade: 0 });

const state = {
  hp: 100,
  maxHp: 100,
  speed: 6,
  attackCooldown: 0,
  combo: 0,
  lastAttackAt: 0,
  skillLock: 0, // > 0 selama animasi skill berjalan
  invuln: 0, // kebal sesaat saat hindar
  dash: null, // { dir, speed, t } gerakan paksa (skill tusuk / hindar)
  lunge: 0, // maju sedikit saat serangan biasa
  slashT: 0,
  ringT: 0,
  kills: 0,
};

// Efek tebasan (busur di depan pemain, ke arah +Z)
const slash = new THREE.Mesh(
  new THREE.RingGeometry(1.2, 2.0, 24, 1, -Math.PI / 2 - 0.9, 1.8),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide })
);
slash.rotation.x = -Math.PI / 2;
slash.position.y = 0.9;
player.add(slash);

// Efek lingkaran untuk skill area
const ring = new THREE.Mesh(
  new THREE.RingGeometry(0.85, 1, 48),
  new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0, side: THREE.DoubleSide })
);
ring.rotation.x = -Math.PI / 2;
ring.position.y = 0.05;
scene.add(ring);

function showRing(radius) {
  ring.position.x = player.position.x;
  ring.position.z = player.position.z;
  ring.scale.set(radius, radius, 1);
  state.ringT = 1;
}

// ---------- Musuh (Skeleton Minion / Warrior) ----------
const enemies = [];

function spawnEnemy() {
  const warrior = Math.random() < 0.4;
  const model = SkeletonUtils.clone((warrior ? warriorGltf : minionGltf).scene);
  prepareModel(model);

  if (warrior) {
    const slot = model.getObjectByName('handslot.r');
    if (slot) {
      const blade = SkeletonUtils.clone(bladeGltf.scene);
      prepareModel(blade);
      slot.add(blade);
    }
  }

  const root = new THREE.Group();
  root.add(model);
  const angle = Math.random() * TAU;
  const dist = 18 + Math.random() * 8;
  root.position.set(
    clamp(player.position.x + Math.cos(angle) * dist, -ARENA, ARENA),
    0,
    clamp(player.position.z + Math.sin(angle) * dist, -ARENA, ARENA)
  );
  scene.add(root);

  const actor = makeActor(model);
  play(actor, 'Idle_A', { fade: 0 });

  enemies.push({
    root,
    actor,
    hp: warrior ? 4 : 2,
    speed: warrior ? 1.8 : 2.4,
    hitCooldown: 0,
    knock: new THREE.Vector3(),
    dead: false,
    deadTimer: 0,
  });
}
setInterval(() => {
  if (zone === 'arena' && enemies.filter((e) => !e.dead).length < 12) spawnEnemy();
}, 3000);

// ---------- Warga desa ----------
const npcs = [];
function makeLabel(text) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 30px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 6;
  g.strokeStyle = 'rgba(0,0,0,.85)';
  g.strokeText(text, 128, 32);
  g.fillStyle = '#ffe9a8';
  g.fillText(text, 128, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sp.scale.set(2.6, 0.65, 1);
  sp.position.y = 2.7;
  sp.renderOrder = 10;
  return sp;
}
// Tampilan khusus NPC (mis. kakek: tanpa topi penyihir, rambut dan jenggot putih, sedikit membungkuk)
function applyLook(model, look) {
  model.updateMatrixWorld(true);
  for (const n of look.hide || []) {
    const o = model.getObjectByName(n);
    if (o) o.visible = false;
  }
  const head = model.getObjectByName('head');
  const headMesh = look.headMesh && model.getObjectByName(look.headMesh);
  if (head && headMesh && (look.hair || look.beard)) {
    const box = new THREE.Box3().setFromObject(headMesh);
    const c = box.getCenter(new THREE.Vector3());
    const sz = box.getSize(new THREE.Vector3());
    const boneQ = head.getWorldQuaternion(new THREE.Quaternion());
    const inv = boneQ.clone().invert();
    const ws = head.getWorldScale(new THREE.Vector3()).x || 1;
    // pasang ke tulang kepala supaya ikut bergerak, tetap tegak seperti pose awal
    const attach = (mesh, x, y, z, flip = false) => {
      const local = head.worldToLocal(new THREE.Vector3(x, y, z));
      mesh.position.copy(local);
      mesh.quaternion.copy(inv);
      if (flip) mesh.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI));
      mesh.scale.setScalar(1 / ws);
      mesh.castShadow = true;
      head.add(mesh);
    };
    if (look.hair) {
      const mat = new THREE.MeshStandardMaterial({ color: look.hair, roughness: 0.9 });
      attach(new THREE.Mesh(new THREE.BoxGeometry(sz.x * 1.08, sz.y * 0.34, sz.z * 1.08), mat), c.x, box.max.y - sz.y * 0.12, c.z);
      attach(new THREE.Mesh(new THREE.BoxGeometry(sz.x * 1.08, sz.y * 0.75, sz.z * 0.3), mat), c.x, c.y - sz.y * 0.02, box.min.z + sz.z * 0.1);
      for (const sx of [-1, 1]) {
        attach(new THREE.Mesh(new THREE.BoxGeometry(sz.x * 0.12, sz.y * 0.55, sz.z * 0.6), mat), c.x + sx * sz.x * 0.5, c.y + sz.y * 0.05, c.z - sz.z * 0.1);
      }
    }
    if (look.beard) {
      const mat = new THREE.MeshStandardMaterial({ color: look.beard, roughness: 0.9 });
      attach(new THREE.Mesh(new THREE.BoxGeometry(sz.x * 0.82, sz.y * 0.42, sz.z * 0.22), mat), c.x, box.min.y + sz.y * 0.2, box.max.z - sz.z * 0.04);
      attach(new THREE.Mesh(new THREE.ConeGeometry(sz.x * 0.3, sz.y * 0.5, 4), mat), c.x, box.min.y - sz.y * 0.08, box.max.z - sz.z * 0.12, true);
    }
  }
  if (look.scale) model.scale.multiplyScalar(look.scale);
  if (look.lean) model.rotation.x = look.lean;
}

for (const def of NPCS) {
  const model = SkeletonUtils.clone(npcGltf[def.model].scene);
  prepareModel(model);
  if (def.look) applyLook(model, def.look);
  for (const [hand, item] of Object.entries(def.items || {})) {
    const slot = model.getObjectByName('handslot.' + hand);
    const src = itemGltf[item];
    if (slot && src) {
      const it = SkeletonUtils.clone(src.scene);
      prepareModel(it);
      slot.add(it);
    }
  }
  const root = new THREE.Group();
  root.add(model);
  root.position.set(def.x, 0, def.z);
  root.rotation.y = def.face;
  root.add(makeLabel(def.name));
  village.group.add(root);
  const actor = makeActor(model);
  play(actor, 'Idle_A', { fade: 0 });
  actor.mixer.update(Math.random() * 2);
  npcs.push({ def, root, actor });
  village.colliders.push({ x0: def.x - 0.5, x1: def.x + 0.5, z0: def.z - 0.5, z1: def.z + 0.5 });
}

// Dialog: tombol Bicara / F untuk mulai dan lanjut
const talkBtn = document.getElementById('btnTalk');
const dialogEl = document.getElementById('dialog');
const dialogName = document.getElementById('dialogName');
const dialogText = document.getElementById('dialogText');
let talk = null; // { npc, i }

function nearestNpc(range) {
  let best = null;
  let bd = range;
  for (const n of npcs) {
    const d = Math.hypot(n.root.position.x - player.position.x, n.root.position.z - player.position.z);
    if (d < bd) {
      bd = d;
      best = n;
    }
  }
  return best;
}
function showLine() {
  dialogName.textContent = talk.npc.def.name;
  dialogText.textContent = talk.npc.def.lines[talk.i];
  dialogEl.style.display = 'block';
}
function closeDialog() {
  talk = null;
  dialogEl.style.display = 'none';
}
function interact() {
  if (zone !== 'village' || state.hp <= 0) return;
  if (talk) {
    talk.i++;
    if (talk.i >= talk.npc.def.lines.length) closeDialog();
    else showLine();
    return;
  }
  const n = nearestNpc(3.2);
  if (!n) return;
  talk = { npc: n, i: 0 };
  // NPC menoleh ke pemain
  n.root.rotation.y = Math.atan2(player.position.x - n.root.position.x, player.position.z - n.root.position.z);
  showLine();
}
talkBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  interact();
});
dialogEl.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  interact();
});

// ---------- Zona: desa (aman) dan arena dungeon ----------
let zone = 'village';
const ZONES = {
  village: { bg: 0x7b8fb5, fogNear: 50, fogFar: 120, sky: 0xd0dcff, ground: 0x6a5a48, hemi: 1.15, sunColor: 0xffe0b5, sun: 1.7 },
  arena: { bg: 0x0d0e14, fogNear: 30, fogFar: 85, sky: 0x8fa0d8, ground: 0x2a1c14, hemi: 0.7, sunColor: 0x9fb4ff, sun: 0.6 },
};
function setZone(name) {
  zone = name;
  const z = ZONES[name];
  scene.background.setHex(z.bg);
  scene.fog.color.setHex(z.bg);
  scene.fog.near = z.fogNear;
  scene.fog.far = z.fogFar;
  hemi.color.setHex(z.sky);
  hemi.groundColor.setHex(z.ground);
  hemi.intensity = z.hemi;
  sun.color.setHex(z.sunColor);
  sun.intensity = z.sun;
  village.group.visible = name === 'village';
  arenaGroup.visible = name === 'arena';

  for (const e of enemies) scene.remove(e.root);
  enemies.length = 0;
  closeDialog();
  strikes.length = 0;
  state.dash = null;

  const sp = name === 'village' ? (setZone.fromArena ? { x: 0, z: 29 } : village.spawn) : { x: 0, z: -30 };
  setZone.fromArena = false;
  player.position.set(sp.x, 0, sp.z);
  player.rotation.y = 0;
  camYaw = Math.PI;
  camera.position.set(sp.x, 7, sp.z - 9);
  if (name === 'arena') for (let i = 0; i < 6; i++) spawnEnemy();
}

// ---------- Kamera orbit (di belakang karakter, bisa diputar dan di-zoom) ----------
let camYaw = Math.PI; // kamera di belakang pemain yang awalnya menghadap +Z
let camPitch = 0.5;
let camDist = 9;

function updateCamera(dt) {
  const cp = Math.cos(camPitch);
  const target = new THREE.Vector3(player.position.x, 1.4, player.position.z);
  const desired = new THREE.Vector3(
    target.x + Math.sin(camYaw) * cp * camDist,
    target.y + Math.sin(camPitch) * camDist,
    target.z + Math.cos(camYaw) * cp * camDist
  );
  if (zone === 'arena') {
    // tetap di dalam aula supaya dinding tidak menutupi pandangan
    desired.x = clamp(desired.x, -ARENA - 0.5, ARENA + 0.5);
    desired.z = clamp(desired.z, -ARENA - 0.5, ARENA + 0.5);
  }
  camera.position.lerp(desired, 1 - Math.pow(0.0002, dt));
  camera.lookAt(target);
}

// ---------- Input ----------
const keys = new Set();
const stick = { x: 0, y: 0 }; // y positif = ke bawah

addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'Space') e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'KeyF') interact();
  if (e.code === 'Digit1') useSkill('s1');
  if (e.code === 'Digit2') useSkill('s2');
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') useSkill('dodge');
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('blur', () => keys.clear());

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Arah gerak relatif terhadap kamera (atas = menjauhi kamera)
function readMove() {
  let ix = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + stick.x;
  let iy = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - stick.y;
  const len = Math.hypot(ix, iy);
  if (len < 0.15) return { dir: new THREE.Vector3(), mag: 0 };
  if (len > 1) {
    ix /= len;
    iy /= len;
  }
  const sinY = Math.sin(camYaw);
  const cosY = Math.cos(camYaw);
  const dir = new THREE.Vector3(-sinY * iy + cosY * ix, 0, -cosY * iy - sinY * ix).normalize();
  return { dir, mag: Math.min(1, len) };
}

// Putar kamera: klik kanan + geser (mouse) atau geser satu jari di area kosong; cubit / roda mouse untuk zoom
const camPointers = new Map();
const pinchDist = () => {
  const [a, b] = [...camPointers.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
};

canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse') {
    if (e.button === 0) {
      keys.add('Attack');
      return;
    }
    if (e.button !== 2) return;
  }
  canvas.setPointerCapture(e.pointerId);
  camPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
});
canvas.addEventListener('pointermove', (e) => {
  const p = camPointers.get(e.pointerId);
  if (!p) return;
  if (camPointers.size >= 2) {
    const before = pinchDist();
    p.x = e.clientX;
    p.y = e.clientY;
    camDist = clamp(camDist - (pinchDist() - before) * 0.03, 5, 16);
  } else {
    camYaw -= (e.clientX - p.x) * 0.006;
    camPitch = clamp(camPitch + (e.clientY - p.y) * 0.005, 0.2, 1.25);
    p.x = e.clientX;
    p.y = e.clientY;
  }
});
const endCamPointer = (e) => {
  camPointers.delete(e.pointerId);
  if (e.pointerType === 'mouse' && e.button === 0) keys.delete('Attack');
};
addEventListener('pointerup', endCamPointer);
addEventListener('pointercancel', endCamPointer);
canvas.addEventListener(
  'wheel',
  (e) => {
    camDist = clamp(camDist + e.deltaY * 0.01, 5, 16);
    e.preventDefault();
  },
  { passive: false }
);

// Joystick di layar
const stickEl = document.getElementById('stick');
const knobEl = document.getElementById('knob');
let stickId = null;

function moveStick(e) {
  const r = stickEl.getBoundingClientRect();
  let dx = e.clientX - (r.left + r.width / 2);
  let dy = e.clientY - (r.top + r.height / 2);
  const max = r.width / 2 - 10;
  const len = Math.hypot(dx, dy);
  if (len > max) {
    dx = (dx / len) * max;
    dy = (dy / len) * max;
  }
  knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
  stick.x = dx / max;
  stick.y = dy / max;
}
function endStick(e) {
  if (e.pointerId !== stickId) return;
  stickId = null;
  stick.x = 0;
  stick.y = 0;
  knobEl.style.transform = '';
}
stickEl.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  stickId = e.pointerId;
  stickEl.setPointerCapture(e.pointerId);
  moveStick(e);
});
stickEl.addEventListener('pointermove', (e) => {
  if (e.pointerId === stickId) moveStick(e);
});
stickEl.addEventListener('pointerup', endStick);
stickEl.addEventListener('pointercancel', endStick);

// Tombol serang (tahan untuk menyerang terus) dan tombol skill
const btnAttack = document.getElementById('btnAttack');
btnAttack.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  btnAttack.setPointerCapture(e.pointerId);
  keys.add('AttackBtn');
});
const releaseAttackBtn = () => keys.delete('AttackBtn');
btnAttack.addEventListener('pointerup', releaseAttackBtn);
btnAttack.addEventListener('pointercancel', releaseAttackBtn);

// ---------- Skill ----------
const SKILLS = {
  s1: { cd: 6, t: 0, el: document.getElementById('btnS1') }, // Lompat: hantaman area
  s2: { cd: 3, t: 0, el: document.getElementById('btnS2') }, // Tusuk: maju menusuk lurus
  dodge: { cd: 1.2, t: 0, el: document.getElementById('btnDodge') }, // Hindar: berguling, kebal sesaat
};
for (const [id, sk] of Object.entries(SKILLS)) {
  sk.cdEl = sk.el.querySelector('.cd');
  sk.txtEl = sk.el.querySelector('.cdt');
  sk.el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    useSkill(id);
  });
}

// Waktu damage dijadwalkan agar jatuh di tengah ayunan, bukan saat tombol ditekan
const strikes = [];
function schedule(delay, fn) {
  strikes.push({ t: delay, fn });
}

const facingVec = () => new THREE.Vector3(0, 0, 1).applyQuaternion(player.quaternion);

function nearestEnemy(range) {
  let best = null;
  let bestDist = range;
  for (const en of enemies) {
    if (en.dead) continue;
    const d = en.root.position.distanceTo(player.position);
    if (d < bestDist) {
      bestDist = d;
      best = en;
    }
  }
  return best;
}

function aimAtNearest(range) {
  const en = nearestEnemy(range);
  if (!en) return;
  player.rotation.y = Math.atan2(en.root.position.x - player.position.x, en.root.position.z - player.position.z);
}

function damageEnemy(en, dir, dmg = 1, force = 7) {
  en.hp -= dmg;
  en.knock.copy(dir).setY(0).normalize().multiplyScalar(force);
  if (en.hp <= 0) {
    en.dead = true;
    en.deadTimer = 1.8;
    state.kills++;
    playOnce(en.actor, 'Death_A', { hold: true });
  } else {
    playOnce(en.actor, 'Hit_A', { maxLock: 0.5 });
  }
}

function hitCone(range, minDot, dmg, force) {
  const facing = facingVec();
  for (const en of enemies) {
    if (en.dead) continue;
    const to = en.root.position.clone().sub(player.position);
    to.y = 0;
    const d = to.length();
    if (d < range && to.normalize().dot(facing) > minDot) damageEnemy(en, to, dmg, force);
  }
}

function hitCircle(radius, dmg, force) {
  for (const en of enemies) {
    if (en.dead) continue;
    const to = en.root.position.clone().sub(player.position);
    to.y = 0;
    if (to.length() <= radius) damageEnemy(en, to, dmg, force);
  }
}

function hitLine(length, halfWidth, dmg, force) {
  const f = facingVec();
  for (const en of enemies) {
    if (en.dead) continue;
    const to = en.root.position.clone().sub(player.position);
    to.y = 0;
    const along = to.dot(f);
    const side = Math.abs(to.x * f.z - to.z * f.x);
    if (along > -0.3 && along < length && side < halfWidth) damageEnemy(en, f, dmg, force);
  }
}

// Serangan biasa: kombo 3 tebasan (animasi KayKit Combat Melee, pedang satu tangan)
const COMBO = [
  'Melee_1H_Attack_Slice_Horizontal',
  'Melee_1H_Attack_Chop',
  'Melee_1H_Attack_Slice_Diagonal',
];
// Atur ini kalau momen kena pukul terasa terlalu cepat/lambat dibanding ayunan pedang
const ATTACK_ANIM_SPEED = 2; // kecepatan animasi serangan (1 = asli)
const STRIKE_DELAY = 0.14; // detik dari mulai animasi sampai damage jatuh

function attack() {
  if (talk) return;
  if (state.hp <= 0 || state.attackCooldown > 0 || state.skillLock > 0 || state.dash) return;
  state.attackCooldown = 0.5;
  state.lunge = 0.3;

  // Kombo kembali ke awal kalau jeda antar serangan lebih dari 1 detik
  const now = performance.now();
  if (now - state.lastAttackAt > 1000) state.combo = 0;
  state.lastAttackAt = now;
  playOnce(playerActor, COMBO[state.combo % COMBO.length], { maxLock: 0.5, timeScale: ATTACK_ANIM_SPEED });
  state.combo++;

  aimAtNearest(4);
  schedule(STRIKE_DELAY, () => {
    state.slashT = 1;
    hitCone(2.6, 0.2, 1, 7);
  });
}

function useSkill(id) {
  const sk = SKILLS[id];
  if (!sk || state.hp <= 0 || sk.t > 0) return;
  if (state.dash) return;
  if (id !== 'dodge' && state.skillLock > 0) return;

  if (id === 's1') {
    // Lompat: hantaman area di sekitar pemain
    sk.t = sk.cd;
    state.skillLock = 0.9;
    aimAtNearest(5);
    playOnce(playerActor, 'Melee_1H_Attack_Jump_Chop', { maxLock: 0.9, timeScale: 1.5 });
    schedule(0.38, () => {
      showRing(3.6);
      hitCircle(3.6, 3, 11);
    });
  } else if (id === 's2') {
    // Tusuk: maju cepat sambil menusuk lurus ke depan
    sk.t = sk.cd;
    state.skillLock = 0.7;
    aimAtNearest(6);
    playOnce(playerActor, 'Melee_1H_Attack_Stab', { maxLock: 0.7, timeScale: 2 });
    state.dash = { dir: facingVec(), speed: 14, t: 0.25 };
    schedule(0.18, () => {
      state.slashT = 1;
      hitLine(3.4, 1.1, 2, 9);
    });
  } else if (id === 'dodge') {
    // Hindar: berguling ke arah gerak (atau ke depan), kebal sesaat
    sk.t = sk.cd;
    const { dir } = readMove();
    const d = dir.lengthSq() > 0 ? dir : facingVec();
    player.rotation.y = Math.atan2(d.x, d.z);
    state.skillLock = 0;
    state.invuln = 0.4;
    strikes.length = 0;
    state.dash = { dir: d.clone(), speed: 11, t: 0.35 };
    playOnce(playerActor, 'Dodge_Forward', { maxLock: 0.45, timeScale: 1.1 });
  }
}

function updateSkillUi() {
  for (const sk of Object.values(SKILLS)) {
    sk.cdEl.style.transform = `scaleY(${sk.t / sk.cd})`;
    sk.txtEl.textContent = sk.t > 0 ? Math.ceil(sk.t) : '';
  }
}

function damagePlayer(amount) {
  if (state.hp <= 0 || state.invuln > 0) return;
  state.hp -= amount;
  if (state.hp <= 0) {
    state.hp = 0;
    strikes.length = 0;
    state.dash = null;
    playOnce(playerActor, 'Death_A', { hold: true });
  } else {
    playOnce(playerActor, 'Hit_A', { maxLock: 0.35 });
  }
}

// Dorong titik keluar dari bangunan / pagar / kristal (lingkaran vs kotak)
function collidePos(pos, r, list) {
  for (const c of list) {
    const cx = clamp(pos.x, c.x0, c.x1);
    const cz = clamp(pos.z, c.z0, c.z1);
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      pos.x = cx + (dx / d) * r;
      pos.z = cz + (dz / d) * r;
    } else {
      const l = pos.x - c.x0, rt = c.x1 - pos.x, t = pos.z - c.z0, b = c.z1 - pos.z;
      const mn = Math.min(l, rt, t, b);
      if (mn === l) pos.x = c.x0 - r;
      else if (mn === rt) pos.x = c.x1 + r;
      else if (mn === t) pos.z = c.z0 - r;
      else pos.z = c.z1 + r;
    }
  }
}
const colliderList = () => (zone === 'village' ? village.colliders : dungeon.colliders);

// ---------- HUD ----------
function updateHud() {
  hpEl.style.width = Math.max(0, (state.hp / state.maxHp) * 100) + '%';
  const near = zone === 'village' && !talk ? nearestNpc(3.2) : null;
  talkBtn.style.display = near ? 'flex' : 'none';
  infoEl.textContent = state.hp <= 0
    ? `You were defeated! Kills: ${state.kills} — refresh to play again`
    : zone === 'village'
      ? `${VILLAGE_NAME} — the north gate leads to the Root Forest`
      : `Dungeon — Kills: ${state.kills} · golden portal at the far end = back to the village`;
  updateSkillUi();
}

// ---------- Loop ----------
const clock = new THREE.Clock();

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const alive = state.hp > 0;

  for (const sk of Object.values(SKILLS)) sk.t = Math.max(0, sk.t - dt);
  state.attackCooldown = Math.max(0, state.attackCooldown - dt);
  state.skillLock = Math.max(0, state.skillLock - dt);
  state.invuln = Math.max(0, state.invuln - dt);

  if (keys.has('KeyQ')) camYaw += 1.8 * dt;
  if (keys.has('KeyE')) camYaw -= 1.8 * dt;

  if (alive) {
    // Damage yang dijadwalkan
    for (let i = strikes.length - 1; i >= 0; i--) {
      strikes[i].t -= dt;
      if (strikes[i].t <= 0) strikes.splice(i, 1)[0].fn();
    }

    // Gerak
    const { dir, mag } = readMove();
    const moving = mag > 0;
    if (state.dash) {
      player.position.addScaledVector(state.dash.dir, state.dash.speed * dt);
      state.dash.t -= dt;
      if (state.dash.t <= 0) state.dash = null;
    } else if (moving) {
      const slow = state.skillLock > 0 ? 0.2 : playerActor.lock > 0 ? 0.5 : 1;
      player.position.addScaledVector(dir, state.speed * mag * slow * dt);
      if (state.skillLock <= 0) {
        const targetYaw = Math.atan2(dir.x, dir.z);
        player.rotation.y = lerpAngle(player.rotation.y, targetYaw, 1 - Math.exp(-18 * dt));
      }
    }
    if (state.lunge > 0) {
      player.position.addScaledVector(facingVec(), 4 * (state.lunge / 0.3) * dt);
      state.lunge = Math.max(0, state.lunge - dt);
    }
    player.position.x = clamp(player.position.x, -ARENA, ARENA);
    player.position.z = clamp(player.position.z, -ARENA, ARENA);
    collidePos(player.position, 0.5, colliderList());

    // Serang
    if (keys.has('Space') || keys.has('KeyJ') || keys.has('Attack') || keys.has('AttackBtn')) attack();

    if (playerActor.lock <= 0) play(playerActor, moving && !state.dash ? 'Running_A' : 'Idle_A');
  }
  updateActor(playerActor, dt);

  // Efek
  state.slashT = Math.max(0, state.slashT - dt / 0.18);
  slash.material.opacity = 0.7 * state.slashT;
  state.ringT = Math.max(0, state.ringT - dt / 0.35);
  ring.material.opacity = 0.8 * state.ringT;

  // Musuh
  for (let i = enemies.length - 1; i >= 0; i--) {
    const en = enemies[i];
    updateActor(en.actor, dt);

    if (en.dead) {
      en.deadTimer -= dt;
      if (en.deadTimer <= 0) {
        scene.remove(en.root);
        enemies.splice(i, 1);
      }
      continue;
    }

    en.root.position.addScaledVector(en.knock, dt);
    en.knock.multiplyScalar(Math.exp(-8 * dt));
    en.root.position.x = clamp(en.root.position.x, -ARENA, ARENA);
    en.root.position.z = clamp(en.root.position.z, -ARENA, ARENA);
    collidePos(en.root.position, 0.5, dungeon.colliders);
    en.hitCooldown = Math.max(0, en.hitCooldown - dt);

    const stunned = en.actor.lock > 0;
    if (!alive) {
      if (!stunned) play(en.actor, 'Idle_A');
      continue;
    }

    const to = player.position.clone().sub(en.root.position);
    to.y = 0;
    const d = to.length();
    if (!stunned) {
      en.root.lookAt(player.position.x, en.root.position.y, player.position.z);
      if (d > 1.2) {
        en.root.position.addScaledVector(to.normalize(), en.speed * dt);
        play(en.actor, 'Walking_B');
      } else {
        play(en.actor, 'Idle_A');
      }
      if (d <= 1.4 && en.hitCooldown === 0) {
        damagePlayer(8);
        en.hitCooldown = 1.1;
      }
    }
  }

  // Pindah zona lewat gerbang / portal
  if (alive) {
    if (zone === 'village' && Math.hypot(player.position.x - village.gate.x, player.position.z - village.gate.z) < village.gate.r) {
      setZone('arena');
    } else if (zone === 'arena' && Math.hypot(player.position.x - ARENA_PORTAL.x, player.position.z - ARENA_PORTAL.z) < ARENA_PORTAL.r) {
      setZone.fromArena = true;
      setZone('village');
    }
  }
  if (zone === 'village') {
    village.update(clock.elapsedTime);
    for (const n of npcs) updateActor(n.actor, dt);
    if (talk && Math.hypot(talk.npc.root.position.x - player.position.x, talk.npc.root.position.z - player.position.z) > 5.5) closeDialog();
  } else {
    arenaPortal.rotation.y += dt;
    arenaPortalLight.intensity = 25 + Math.sin(clock.elapsedTime * 3) * 6;
    dungeon.update(clock.elapsedTime);
  }
  sun.target.position.copy(player.position);
  sun.position.copy(player.position).add(SUN_OFFSET);

  updateCamera(dt);
  updateHud();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
setZone('village'); // zona awal
renderer.render(scene, camera); // pemanasan shader sebelum layar loading dibuka
setStage('Ready!');
loadFinished = true;
clearInterval(tipTimer);
setTimeout(() => {
  loadingEl.classList.add('done');
  setTimeout(() => loadingEl.remove(), 900);
}, 450);
tick();
