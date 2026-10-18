import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { buildVillage, villageModelCount, NPCS, VILLAGE_NAME } from './village.js';
import { buildDungeon, DUNGEON_MODEL_COUNT } from './dungeon.js';
import { buildBossRoom, BOSS_MODEL_COUNT, BOSS_PLAY } from './boss.js';
import { ITEMS, SHOP, LOOT, LOOT_MODELS, LOOT_FILES } from './items.js';

const hpEl = document.getElementById('hp');
const infoEl = document.getElementById('info');

// ---------- Layar loading ----------
const loadingEl = document.getElementById('loading');
const loadBar = document.getElementById('loadBar');
const loadPct = document.getElementById('loadPct');
const loadStage = document.getElementById('loadStage');
const loadTip = document.getElementById('loadTip');
const BASE_FILES = 9;
const NPC_FILES = new Set(NPCS.map((n) => n.model)).size + new Set(NPCS.flatMap((n) => Object.values(n.items || {})).filter((i) => i !== 'sword_1handed')).size + 1; // +1: kapak dua tangan boss
const loadTotal = BASE_FILES + villageModelCount() + NPC_FILES + DUNGEON_MODEL_COUNT + BOSS_MODEL_COUNT + LOOT_FILES.length;
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
let ARENA = 38; // batas area main (desa/dungeon 38, sarang boss lebih kecil)
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ---------- Setup dasar ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x14161c);
scene.fog = new THREE.Fog(0x14161c, 25, 60);

const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 200);
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
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

// ---------- Kualitas grafis (Low / Medium / High), otomatis turun kalau FPS rendah ----------
const QUALITY = [
  { name: 'Low', pr: 0.7, shadow: 0 },
  { name: 'Medium', pr: 1, shadow: 1024 },
  { name: 'High', pr: Math.min(devicePixelRatio, 2), shadow: 2048 },
];
let quality = 1;
try {
  const q = parseInt(localStorage.getItem('shardfall_quality'), 10);
  if (q >= 0 && q <= 2) quality = q;
} catch (e) {}
function applyQuality() {
  const q = QUALITY[quality];
  renderer.setPixelRatio(q.pr);
  renderer.setSize(innerWidth, innerHeight);
  sun.castShadow = q.shadow > 0;
  if (q.shadow > 0 && sun.shadow.mapSize.x !== q.shadow) {
    sun.shadow.mapSize.set(q.shadow, q.shadow);
    if (sun.shadow.map) {
      sun.shadow.map.dispose();
      sun.shadow.map = null;
    }
  }
  try {
    localStorage.setItem('shardfall_quality', quality);
  } catch (e) {}
}
applyQuality();


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

// Pintu ke sarang Root Warden (dinding timur dungeon)
const BOSS_PORTAL = { x: 36, z: 0, r: 1.8 };
const bossPortal = new THREE.Mesh(
  new THREE.CylinderGeometry(1.6, 1.6, 3.2, 24, 1, true),
  new THREE.MeshBasicMaterial({ color: 0x6bff7a, transparent: true, opacity: 0.45, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
);
bossPortal.position.set(BOSS_PORTAL.x, 1.6, BOSS_PORTAL.z);
arenaGroup.add(bossPortal);
const bossPortalLight = new THREE.PointLight(0x6bff7a, 25, 16, 2);
bossPortalLight.position.set(BOSS_PORTAL.x - 1, 2, BOSS_PORTAL.z);
arenaGroup.add(bossPortalLight);
const bossPortalLabel = makeLabel("Root Warden's Lair");
bossPortalLabel.position.set(BOSS_PORTAL.x, 4.2, BOSS_PORTAL.z);
bossPortalLabel.scale.set(4.2, 1.05, 1);
arenaGroup.add(bossPortalLabel);

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

setStage('Awakening the Root Warden...');
let bossRoom;
try {
  bossRoom = await buildBossRoom(bump);
} catch (err) {
  console.error(err);
  loadError('Failed to load boss room assets.');
  throw err;
}
const bossGroup = bossRoom.group;
scene.add(bossGroup);

setStage('Stocking potions and loot...');
const lootModels = {};
try {
  const lootLoader = new GLTFLoader().setPath('assets/dungeon/');
  await Promise.all(
    LOOT_FILES.map(async (f) => {
      lootModels[f] = (await lootLoader.loadAsync(f + '.gltf')).scene;
      bump();
    })
  );
} catch (err) {
  console.error(err);
  loadError('Failed to load loot models.');
  throw err;
}

// Model warga desa (rig yang sama dengan Knight) dan perlengkapan di tangan mereka
setStage('Calling the villagers...');
const npcGltf = {};
const itemGltf = {};
try {
  const models = [...new Set(NPCS.map((n) => n.model))];
  const items = [...new Set([...NPCS.flatMap((n) => Object.values(n.items || {})), 'axe_2handed'])];
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
    type: warrior ? 'warrior' : 'minion',
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
  if (uiOpen || zone !== 'village' || state.hp <= 0) return;
  if (talk) {
    talk.i++;
    if (talk.i >= talk.npc.def.lines.length) closeDialog();
    else showLine();
    return;
  }
  const n = nearestNpc(3.2);
  if (!n) return;
  if (n.def.shop) {
    openShop();
    return;
  }
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
  boss: { bg: 0x07100a, fogNear: 22, fogFar: 70, sky: 0x9fe0a8, ground: 0x1a2a14, hemi: 0.6, sunColor: 0xb0ffc8, sun: 0.35 },
};
// Titik muncul: 'zona tujuan:asal'
const SPAWNS = {
  'village:start': { x: 0, z: -30, rot: 0 },
  'village:arena': { x: 0, z: 29, rot: Math.PI },
  'arena:village': { x: 0, z: -30, rot: 0 },
  'arena:boss': { x: 32, z: 0, rot: -Math.PI / 2 },
  'boss:arena': { x: 0, z: -14, rot: 0 },
};
function setZone(name, from = 'start') {
  zone = name;
  ARENA = name === 'boss' ? BOSS_PLAY : 38;
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
  bossGroup.visible = name === 'boss';

  for (const e of enemies) e.root.parent?.remove(e.root);
  enemies.length = 0;
  clearBossFx();
  clearPickups();
  closeUi();
  closeDialog();
  strikes.length = 0;
  state.dash = null;

  const sp = SPAWNS[name + ':' + from] || SPAWNS['village:start'];
  player.position.set(sp.x, 0, sp.z);
  player.rotation.y = sp.rot;
  camYaw = sp.rot + Math.PI;
  camera.position.set(sp.x + Math.sin(camYaw) * 8, 6, sp.z + Math.cos(camYaw) * 8);
  if (name === 'village' && state.hp > 0) state.hp = state.maxHp; // desa = tempat pulih
  if (name === 'arena') for (let i = 0; i < 6; i++) spawnEnemy();
  if (name === 'boss') spawnBoss();
}

// ---------- Kamera orbit (di belakang karakter, bisa diputar dan di-zoom) ----------
let camYaw = Math.PI; // kamera di belakang pemain yang awalnya menghadap +Z
let camPitch = 0.5;
let camDist = 9;
let camGoal = null; // { d, p } saat pindah preset kamera
const CAM_MODES = [
  { name: 'Close', d: 9, p: 0.5 },
  { name: 'Far', d: 17, p: 0.8 },
  { name: 'Overview', d: 28, p: 1.05 },
];
let camMode = 0;
function setCamMode(i) {
  camMode = i % CAM_MODES.length;
  camGoal = { d: CAM_MODES[camMode].d, p: CAM_MODES[camMode].p };
  toast(`Camera: ${CAM_MODES[camMode].name}`, 1200);
}
let shake = 0; // getaran kamera (hantaman boss)

function updateCamera(dt) {
  if (camGoal) {
    const k = 1 - Math.pow(0.002, dt);
    camDist += (camGoal.d - camDist) * k;
    camPitch += (camGoal.p - camPitch) * k;
    if (Math.abs(camGoal.d - camDist) < 0.05) camGoal = null;
  }
  const cp = Math.cos(camPitch);
  const target = new THREE.Vector3(player.position.x, 1.4, player.position.z);
  const desired = new THREE.Vector3(
    target.x + Math.sin(camYaw) * cp * camDist,
    target.y + Math.sin(camPitch) * camDist,
    target.z + Math.cos(camYaw) * cp * camDist
  );
  if (zone !== 'village') {
    // tetap di dalam aula supaya dinding tidak menutupi pandangan
    desired.x = clamp(desired.x, -ARENA - 0.5, ARENA + 0.5);
    desired.z = clamp(desired.z, -ARENA - 0.5, ARENA + 0.5);
  }
  camera.position.lerp(desired, 1 - Math.pow(0.0002, dt));
  if (shake > 0) {
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
    shake = Math.max(0, shake - dt * 1.4);
  }
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
  if (e.code === 'KeyI') toggleBag();
  if (e.code === 'KeyC') setCamMode(camMode + 1);
  if (e.code === 'KeyV') setCamMode(camMode + 1);
  if (e.code === 'Escape') closeUi();
  if (e.code === 'Digit3') quickUse('health_potion');
  if (e.code === 'Digit4') quickUse('greater_potion');
  if (e.code === 'Digit1') useSkill('s1');
  if (e.code === 'Digit2') useSkill('s2');
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') useSkill('dodge');
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('blur', () => keys.clear());

// Pantau FPS: kalau rata-rata rendah, turunkan kualitas otomatis
let fpsFrames = 0;
let fpsT = 0;
function watchFps(rawDt) {
  if (rawDt > 0.25) return; // abaikan lonjakan (ganti tab, dll.)
  fpsFrames++;
  fpsT += rawDt;
  if (fpsT < 2.5) return;
  const fps = fpsFrames / fpsT;
  fpsFrames = 0;
  fpsT = 0;
  if (fps < 38 && quality > 0) {
    quality--;
    applyQuality();
    toast(`Low FPS (${Math.round(fps)}) - graphics set to ${QUALITY[quality].name}`, 2200);
  }
}
const qualBtn = document.getElementById('btnQual');
qualBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  quality = (quality + 1) % 3;
  applyQuality();
  toast(`Graphics: ${QUALITY[quality].name}`, 1600);
});

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
    camGoal = null;
    camDist = clamp(camDist - (pinchDist() - before) * 0.03, 5, 34);
  } else {
    camYaw -= (e.clientX - p.x) * 0.006;
    camGoal = null;
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
    camGoal = null;
    camDist = clamp(camDist + e.deltaY * 0.01, 5, 34);
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
    const d = en.root.position.distanceTo(player.position) - (en.radius || 0);
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
  dmg *= state.buffs.power > 0 ? 1.5 : 1; // Might Elixir
  if (en.boss) {
    // boss tidak terpental / tidak kena stagger
    if (en.ai.state === 'intro' || en.dead) return;
    en.hp = Math.max(0, en.hp - dmg);
    en.flash = 0.12;
    bossHpEl.style.width = (en.hp / en.maxHp) * 100 + '%';
    if (en.hp <= 0) killBoss(en);
    return;
  }
  en.hp -= dmg;
  en.knock.copy(dir).setY(0).normalize().multiplyScalar(force);
  if (en.hp <= 0) {
    en.dead = true;
    en.deadTimer = 1.8;
    state.kills++;
    playOnce(en.actor, 'Death_A', { hold: true });
    dropLoot(en.type || 'minion', en.root.position.x, en.root.position.z);
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
    if (d < range + (en.radius || 0) && to.normalize().dot(facing) > minDot) damageEnemy(en, to, dmg, force);
  }
}

function hitCircle(radius, dmg, force) {
  for (const en of enemies) {
    if (en.dead) continue;
    const to = en.root.position.clone().sub(player.position);
    to.y = 0;
    if (to.length() <= radius + (en.radius || 0)) damageEnemy(en, to, dmg, force);
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
    const R = en.radius || 0;
    if (along > -0.3 - R && along < length + R && side < halfWidth + R * 0.7) damageEnemy(en, f, dmg, force);
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
  if (talk || uiOpen) return;
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

// ---------- Boss: Root Warden ----------
const bossBarEl = document.getElementById('bossBar');
const bossHpEl = document.getElementById('bossHp');
const toastEl = document.getElementById('toast');
let toastTimer = 0;
function toast(msg, ms = 2800) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}

// Kemajuan (pecahan kristal) disimpan di browser
const SAVE_KEY = 'shardfall_save_v1';
const save = { shards: [] };
try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) Object.assign(save, JSON.parse(raw));
} catch (e) { /* tanpa penyimpanan juga tidak masalah */ }
const persist = () => {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch (e) { /* abaikan */ }
};

// Portal keluar dari sarang boss
const BOSS_EXIT = { x: 0, z: -21, r: 1.7 };
const bossExit = new THREE.Mesh(
  new THREE.CylinderGeometry(1.5, 1.5, 3, 24, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.45, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
);
bossExit.position.set(BOSS_EXIT.x, 1.5, BOSS_EXIT.z);
bossGroup.add(bossExit);
const bossExitLight = new THREE.PointLight(0xffd36b, 22, 14, 2);
bossExitLight.position.set(BOSS_EXIT.x, 2, BOSS_EXIT.z + 1);
bossGroup.add(bossExitLight);

const bossFx = new THREE.Group();
bossGroup.add(bossFx);
const teles = []; // lingkaran peringatan serangan
const eruptions = []; // duri akar yang muncul dari tanah
let shardDrop = null;

const thornGeo = new THREE.ConeGeometry(0.28, 1, 6);
thornGeo.translate(0, 0.5, 0);
const thornMat = new THREE.MeshStandardMaterial({ color: 0x5a3a20, emissive: 0x1d5a24, emissiveIntensity: 0.8, roughness: 1 });

function clearBossFx() {
  for (const t of teles.splice(0)) bossFx.remove(t.g);
  for (const e of eruptions.splice(0)) bossFx.remove(e.g);
  if (shardDrop) bossFx.remove(shardDrop.g);
  shardDrop = null;
  bossBarEl.style.display = 'none';
}

function eruption(x, z, r) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const n = Math.max(5, Math.round(r * 4));
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU;
    const d = Math.sqrt(Math.random()) * r * 0.9;
    const m = new THREE.Mesh(thornGeo, thornMat);
    m.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
    m.rotation.set((Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.4);
    m.userData.h = 1.4 + Math.random() * 1.6;
    m.scale.set(1, 0.01, 1);
    m.castShadow = true;
    g.add(m);
  }
  bossFx.add(g);
  eruptions.push({ g, t: 0 });
}

function makeTele(x, z, r, dur, onHit) {
  const g = new THREE.Group();
  g.position.set(x, 0.06, z);
  const base = new THREE.Mesh(
    new THREE.CircleGeometry(r, 40),
    new THREE.MeshBasicMaterial({ color: 0xff3b2e, transparent: true, opacity: 0.25, depthWrite: false })
  );
  base.rotation.x = -Math.PI / 2;
  const fill = new THREE.Mesh(
    new THREE.CircleGeometry(r, 40),
    new THREE.MeshBasicMaterial({ color: 0xff8a3b, transparent: true, opacity: 0.45, depthWrite: false })
  );
  fill.rotation.x = -Math.PI / 2;
  fill.position.y = 0.01;
  fill.scale.set(0.01, 0.01, 1);
  const edge = new THREE.Mesh(
    new THREE.RingGeometry(r * 0.95, r, 48),
    new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide })
  );
  edge.rotation.x = -Math.PI / 2;
  edge.position.y = 0.02;
  g.add(base, fill, edge);
  bossFx.add(g);
  teles.push({ g, fill, t: 0, dur, onHit });
}

// Efek peringatan, duri akar, dan pecahan kristal yang dijatuhkan
function updateBossFx(dt) {
  for (let i = teles.length - 1; i >= 0; i--) {
    const t = teles[i];
    t.t += dt;
    const f = Math.min(1, t.t / t.dur);
    t.fill.scale.set(f, f, 1);
    if (t.t >= t.dur) {
      bossFx.remove(t.g);
      teles.splice(i, 1);
      t.onHit();
    }
  }
  for (let i = eruptions.length - 1; i >= 0; i--) {
    const e = eruptions[i];
    e.t += dt;
    const s = e.t < 0.1 ? e.t / 0.1 : e.t < 0.6 ? 1 : Math.max(0, 1 - (e.t - 0.6) / 0.3);
    for (const m of e.g.children) m.scale.y = Math.max(0.01, m.userData.h * s);
    if (e.t > 0.9) {
      bossFx.remove(e.g);
      eruptions.splice(i, 1);
    }
  }
  bossExitLight.intensity = 22 + Math.sin(clock.elapsedTime * 3) * 5;
  if (shardDrop) {
    const s = shardDrop;
    s.t += dt;
    s.mesh.position.y = 1.4 + Math.sin(s.t * 2.4) * 0.25;
    s.mesh.rotation.y += dt * 1.6;
    if (Math.hypot(player.position.x - s.x, player.position.z - s.z) < 2.2) {
      if (!save.shards.includes('root')) save.shards.push('root');
      persist();
      bossFx.remove(s.g);
      shardDrop = null;
      toast(`Root Shard obtained! (${save.shards.length}/4) — return to the village`, 4500);
    }
  }
}

function pushOut(pos, center, r) {
  const dx = pos.x - center.x;
  const dz = pos.z - center.z;
  const d = Math.hypot(dx, dz);
  if (d < r && d > 1e-6) {
    pos.x = center.x + (dx / d) * r;
    pos.z = center.z + (dz / d) * r;
  }
}

// Pasang mesh ke tulang supaya ikut bergerak; posisi/arah diberikan dalam koordinat model saat pose awal
function attachToBone(bone, mesh, x, y, z, qWorld) {
  mesh.position.copy(bone.worldToLocal(new THREE.Vector3(x, y, z)));
  mesh.quaternion.copy(bone.getWorldQuaternion(new THREE.Quaternion()).invert());
  if (qWorld) mesh.quaternion.multiply(qWorld);
  mesh.scale.setScalar(1 / (bone.getWorldScale(new THREE.Vector3()).x || 1));
  bone.add(mesh);
}

function spawnBoss() {
  const model = SkeletonUtils.clone(npcGltf.Barbarian.scene);
  prepareModel(model);
  const mats = [];
  model.traverse((o) => {
    if (o.isMesh) {
      o.material = o.material.clone();
      o.material.color.set(0x8fc36a); // nuansa lumut
      mats.push(o.material);
    }
  });
  const slot = model.getObjectByName('handslot.r');
  if (slot && itemGltf.axe_2handed) {
    const ax = SkeletonUtils.clone(itemGltf.axe_2handed.scene);
    prepareModel(ax);
    slot.add(ax);
  }
  // Duri akar di punggung dan mata hijau menyala
  model.updateMatrixWorld(true);
  const chest = model.getObjectByName('chest');
  if (chest) {
    for (let i = 0; i < 7; i++) {
      const th = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.55, 5), thornMat);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.5 - Math.random() * 0.3, 0, (Math.random() - 0.5) * 0.8));
      attachToBone(chest, th, (i - 3) * 0.1, 1.25 + Math.random() * 0.25, -0.22, q);
    }
  }
  const head = model.getObjectByName('head');
  const headMesh = model.getObjectByName('Barbarian_Head');
  if (head && headMesh) {
    const box = new THREE.Box3().setFromObject(headMesh);
    const c = box.getCenter(new THREE.Vector3());
    const sz = box.getSize(new THREE.Vector3());
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x9dff6a });
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(sz.x * 0.14, sz.y * 0.09, 0.02), eyeMat);
      attachToBone(head, eye, c.x + sx * sz.x * 0.2, c.y + sz.y * 0.05, box.max.z + 0.006);
    }
  }
  model.scale.setScalar(2.4);

  const root = new THREE.Group();
  root.add(model);
  root.position.set(0, 0, 10);
  root.rotation.y = Math.PI;
  bossGroup.add(root);
  const actor = makeActor(model);
  play(actor, 'Idle_A', { fade: 0 });
  playOnce(actor, 'Spawn_Ground', { maxLock: 2 });

  const boss = {
    boss: true,
    root, actor, mats,
    hp: 45, maxHp: 45,
    radius: 1.5,
    speed: 2.6,
    knock: new THREE.Vector3(),
    flash: 0,
    dead: false,
    deadTimer: 0,
    ai: { state: 'intro', t: 2.2, cd: 1.2, k: 1, phase2: false, clip: '', lead: 0.5, ts: 1, animDone: false },
  };
  enemies.push(boss);
  bossHpEl.style.width = '100%';
  bossBarEl.style.display = 'block';
  toast('The Root Warden awakens!', 2600);
}

function hitPlayerAt(x, z, r, dmg) {
  if (Math.hypot(player.position.x - x, player.position.z - z) < r + 0.35) damagePlayer(dmg);
  eruption(x, z, r * 0.9);
  shake = Math.max(shake, 0.3);
}

function bossChooseAttack(en) {
  const a = en.ai;
  const k = a.k;
  const b = en.root.position;
  const to = new THREE.Vector3(player.position.x - b.x, 0, player.position.z - b.z);
  const d = to.length();
  const fwd = to.clone().normalize();
  const r = Math.random();
  const kind = d > 6.5 ? 'roots' : r < 0.4 ? 'spin' : r < 0.75 ? 'slam' : 'roots';
  en.root.rotation.y = Math.atan2(fwd.x, fwd.z);
  a.state = 'wind';
  a.animDone = false;

  if (kind === 'slam') {
    const cx = b.x + fwd.x * 3.4;
    const cz = b.z + fwd.z * 3.4;
    a.t = 1.0 * k;
    makeTele(cx, cz, 3.2, a.t, () => hitPlayerAt(cx, cz, 3.2, 20));
    Object.assign(a, { clip: 'Melee_2H_Attack_Chop', lead: 0.6, ts: 1.5 });
  } else if (kind === 'spin') {
    const cx = b.x;
    const cz = b.z;
    a.t = 1.15 * k;
    makeTele(cx, cz, 5.4, a.t, () => hitPlayerAt(cx, cz, 5.4, 16));
    Object.assign(a, { clip: 'Melee_2H_Attack_Spin', lead: 0.75, ts: 1.2 });
  } else {
    const n = a.phase2 ? 6 : 3;
    a.t = 1.3 * k;
    for (let i = 0; i < n; i++) {
      let x = player.position.x;
      let z = player.position.z;
      if (i > 0) {
        const ang = Math.random() * TAU;
        const dd = 2.5 + Math.random() * 3;
        x = clamp(x + Math.cos(ang) * dd, -BOSS_PLAY + 1, BOSS_PLAY - 1);
        z = clamp(z + Math.sin(ang) * dd, -BOSS_PLAY + 1, BOSS_PLAY - 1);
      }
      makeTele(x, z, 1.9, a.t + i * 0.12, () => hitPlayerAt(x, z, 1.9, 12));
    }
    Object.assign(a, { clip: 'Melee_2H_Attack_Stab', lead: 0.65, ts: 1.4 });
  }
  play(en.actor, 'Melee_2H_Idle');
}

function updateBoss(en, dt, alive) {
  const a = en.ai;
  en.flash = Math.max(0, en.flash - dt);
  const glow = en.flash > 0 ? 0x663311 : 0x000000;
  for (const m of en.mats) m.emissive.setHex(glow);
  if (!alive) {
    if (en.actor.lock <= 0) play(en.actor, 'Idle_A');
    return;
  }
  const to = player.position.clone().sub(en.root.position);
  to.y = 0;
  const d = to.length();
  const turn = (rate) => {
    en.root.rotation.y = lerpAngle(en.root.rotation.y, Math.atan2(to.x, to.z), 1 - Math.exp(-rate * dt));
  };
  a.t -= dt;

  // Fase 2 saat HP tinggal separuh: lebih cepat, akar lebih banyak
  if (!a.phase2 && a.state !== 'intro' && en.hp <= en.maxHp * 0.5) {
    a.phase2 = true;
    a.k = 0.75;
    en.speed = 3.4;
    a.state = 'roar';
    a.t = 1.6;
    for (const t of teles.splice(0)) bossFx.remove(t.g);
    playOnce(en.actor, 'Use_Item', { maxLock: 1.6 });
    eruption(en.root.position.x, en.root.position.z, 6);
    shake = 0.5;
    toast('The Root Warden roars — the roots awaken!', 3000);
  }

  if (a.state === 'intro') {
    turn(5);
    if (a.t <= 0) {
      a.state = 'chase';
    }
  } else if (a.state === 'roar') {
    if (a.t <= 0) {
      a.state = 'chase';
      a.cd = 0.8;
    }
  } else if (a.state === 'chase') {
    turn(6);
    if (d > 3.8) en.root.position.addScaledVector(to.normalize(), en.speed * dt);
    if (en.actor.lock <= 0) play(en.actor, d > 3.8 ? 'Walking_B' : 'Idle_A', { timeScale: 0.85 });
    collidePos(en.root.position, 1.2, bossRoom.colliders);
    en.root.position.x = clamp(en.root.position.x, -BOSS_PLAY + 1, BOSS_PLAY - 1);
    en.root.position.z = clamp(en.root.position.z, -BOSS_PLAY + 1, BOSS_PLAY - 1);
    a.cd -= dt;
    if (a.cd <= 0) bossChooseAttack(en);
  } else if (a.state === 'wind') {
    if (!a.animDone && a.t <= a.lead) {
      a.animDone = true;
      playOnce(en.actor, a.clip, { maxLock: 1.3, timeScale: a.ts });
    }
    if (a.t <= 0 && teles.length === 0) {
      a.state = 'recover';
      a.t = 0.7 * a.k;
    }
  } else if (a.state === 'recover') {
    if (en.actor.lock <= 0) play(en.actor, 'Idle_A');
    if (a.t <= 0) {
      a.state = 'chase';
      a.cd = (a.phase2 ? 0.9 : 1.7) + Math.random() * 0.6;
    }
  }
}

function killBoss(en) {
  en.dead = true;
  en.deadTimer = 1e9; // jasad tetap di tempat
  state.kills++;
  playOnce(en.actor, 'Death_A', { hold: true });
  for (const t of teles.splice(0)) bossFx.remove(t.g);
  bossBarEl.style.display = 'none';
  eruption(en.root.position.x, en.root.position.z, 5);
  shake = 0.6;
  dropLoot('boss', en.root.position.x, en.root.position.z + 1.5);
  if (save.shards.includes('root')) {
    toast('Root Warden defeated — the roots fall silent once more.', 4000);
    return;
  }
  toast('Root Warden defeated!', 3500);
  // pecahan kristal jatuh dan melayang menunggu diambil
  const g = new THREE.Group();
  const x = en.root.position.x;
  const z = en.root.position.z + 3.5;
  g.position.set(x, 0, z);
  const mesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.6, 0),
    new THREE.MeshStandardMaterial({ color: 0x9dffb8, emissive: 0x2cff7a, emissiveIntensity: 1.6, roughness: 0.2 })
  );
  mesh.scale.set(0.8, 1.6, 0.8);
  mesh.position.y = 1.4;
  g.add(mesh);
  const light = new THREE.PointLight(0x6bff9a, 30, 14, 2);
  light.position.y = 1.6;
  g.add(light);
  bossFx.add(g);
  shardDrop = { g, mesh, x, z, t: 0 };
}

// ---------- Inventory, potion, loot, dan toko ----------
if (!save.inv) {
  save.inv = { health_potion: 3 }; // bekal awal
  save.gold = 25;
  persist();
}
if (typeof save.gold !== 'number') save.gold = 0;
state.buffs = { speed: 0, power: 0 };
state.potionCd = 0;
let uiOpen = false;

const goldEl = document.getElementById('gold');
const buffsEl = document.getElementById('buffs');
const popsEl = document.getElementById('pops');
const QUICK = [
  { id: 'health_potion', el: document.getElementById('btnQ1') },
  { id: 'greater_potion', el: document.getElementById('btnQ2') },
];
for (const q of QUICK) {
  q.cEl = q.el.querySelector('small');
  q.cdEl = q.el.querySelector('.cd');
  q.el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    quickUse(q.id);
  });
}

const invCount = (id) => (id === 'root_shard' ? save.shards.length : save.inv[id] || 0);
function addItem(id, n = 1) {
  save.inv[id] = Math.min(99, (save.inv[id] || 0) + n);
  persist();
}
function removeItem(id, n = 1) {
  save.inv[id] = (save.inv[id] || 0) - n;
  if (save.inv[id] <= 0) delete save.inv[id];
  persist();
}
function popText(text, color = '#fff') {
  const d = document.createElement('div');
  d.className = 'pop';
  d.textContent = text;
  d.style.color = color;
  d.style.top = 32 + Math.random() * 8 + '%';
  popsEl.appendChild(d);
  setTimeout(() => d.remove(), 1300);
}

function useItem(id) {
  const it = ITEMS[id];
  if (!it || invCount(id) <= 0 || state.hp <= 0) return false;
  if (state.potionCd > 0) return false;
  if (it.heal) {
    if (state.hp >= state.maxHp) {
      popText('HP is already full', '#ffd0d0');
      return false;
    }
    const gain = Math.min(it.heal, state.maxHp - state.hp);
    state.hp += gain;
    popText(`+${gain} HP`, '#7dff8a');
  } else if (it.buff) {
    state.buffs[it.buff] = it.dur;
    popText(`${it.name}!`, '#ffe08a');
  } else {
    return false;
  }
  removeItem(id);
  state.potionCd = 1.2;
  if (bagEl.classList.contains('open')) renderBag();
  return true;
}
function quickUse(id) {
  if (uiOpen) return;
  if (invCount(id) <= 0) {
    popText(`No ${ITEMS[id].name} left`, '#ff9a9a');
    return;
  }
  useItem(id);
}

// ----- Tas -----
const bagEl = document.getElementById('bag');
const bagGrid = document.getElementById('bagGrid');
const bagName = document.getElementById('bagName');
const bagDesc = document.getElementById('bagDesc');
const bagUse = document.getElementById('bagUse');
const bagGold = document.getElementById('bagGold');
let bagSel = null;
const bagEntries = () => {
  const list = Object.keys(save.inv).map((id) => ({ id, n: save.inv[id] }));
  if (save.shards.length) list.push({ id: 'root_shard', n: save.shards.length });
  return list.filter((e) => ITEMS[e.id]);
};
function renderBag() {
  bagGold.textContent = '🪙 ' + save.gold;
  bagGrid.innerHTML = '';
  const entries = bagEntries();
  for (let i = 0; i < 20; i++) {
    const e = entries[i];
    const slot = document.createElement('div');
    slot.className = 'slot' + (e ? ' has' : '') + (e && e.id === bagSel ? ' sel' : '');
    if (e) {
      slot.textContent = ITEMS[e.id].icon;
      if (e.n > 1) {
        const b = document.createElement('b');
        b.textContent = e.n;
        slot.appendChild(b);
      }
      slot.addEventListener('click', () => {
        bagSel = e.id;
        renderBag();
      });
    }
    bagGrid.appendChild(slot);
  }
  const it = ITEMS[bagSel];
  if (it && invCount(bagSel) > 0) {
    bagName.textContent = `${it.name} ×${invCount(bagSel)}`;
    bagDesc.textContent = it.desc + (it.sell ? ` Sells for ${it.sell} gold.` : '');
    bagUse.style.display = it.heal || it.buff ? 'inline-block' : 'none';
  } else {
    bagSel = null;
    bagName.textContent = 'Select an item';
    bagDesc.textContent = 'Tap an item to see what it does.';
    bagUse.style.display = 'none';
  }
}
bagUse.addEventListener('click', () => {
  if (bagSel) useItem(bagSel);
  renderBag();
});

// ----- Toko -----
const shopEl = document.getElementById('shop');
const shopList = document.getElementById('shopList');
const shopGold = document.getElementById('shopGold');
const tabBuy = document.getElementById('tabBuy');
const tabSell = document.getElementById('tabSell');
let shopTab = 'buy';
const updateUiOpen = () => (uiOpen = bagEl.classList.contains('open') || shopEl.classList.contains('open'));

function renderShop() {
  shopGold.textContent = '🪙 ' + save.gold;
  tabBuy.classList.toggle('on', shopTab === 'buy');
  tabSell.classList.toggle('on', shopTab === 'sell');
  shopList.innerHTML = '';
  const addRow = (id, sub, label, enabled, fn) => {
    const it = ITEMS[id];
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<div class="ri">${it.icon}</div><div class="rt">${it.name}<small>${sub}</small></div>`;
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.disabled = !enabled;
    btn.addEventListener('click', fn);
    row.appendChild(btn);
    shopList.appendChild(row);
  };
  if (shopTab === 'buy') {
    for (const id of SHOP) {
      const it = ITEMS[id];
      addRow(id, `${it.desc} (you have ${invCount(id)})`, `Buy ${it.buy} 🪙`, save.gold >= it.buy, () => {
        if (save.gold < it.buy) return;
        save.gold -= it.buy;
        addItem(id);
        persist();
        popText(`+1 ${it.name}`, '#bff4ff');
        renderShop();
      });
    }
  } else {
    const sellable = Object.keys(save.inv).filter((id) => ITEMS[id] && ITEMS[id].sell);
    if (!sellable.length) {
      shopList.innerHTML = '<div class="empty-note">You have nothing to sell yet. Hunt monsters for materials!</div>';
    }
    for (const id of sellable) {
      const it = ITEMS[id];
      addRow(id, `you have ${invCount(id)}`, `Sell ${it.sell} 🪙`, true, () => {
        if (invCount(id) <= 0) return;
        removeItem(id);
        save.gold += it.sell;
        persist();
        popText(`+${it.sell} 🪙`, '#ffe08a');
        renderShop();
      });
    }
  }
}
function openShop() {
  bagEl.classList.remove('open');
  shopEl.classList.add('open');
  updateUiOpen();
  renderShop();
}
function openBag() {
  shopEl.classList.remove('open');
  bagEl.classList.add('open');
  updateUiOpen();
  renderBag();
}
function closeUi() {
  bagEl.classList.remove('open');
  shopEl.classList.remove('open');
  updateUiOpen();
}
function toggleBag() {
  if (bagEl.classList.contains('open')) closeUi();
  else if (state.hp > 0 && !talk) openBag();
}
document.getElementById('btnBag').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  toggleBag();
});
document.getElementById('bagClose').addEventListener('click', closeUi);
document.getElementById('shopClose').addEventListener('click', closeUi);
for (const p of [bagEl, shopEl]) p.addEventListener('pointerdown', (e) => e.target === p && closeUi());
tabBuy.addEventListener('click', () => ((shopTab = 'buy'), renderShop()));
tabSell.addEventListener('click', () => ((shopTab = 'sell'), renderShop()));

// ----- Loot di dunia -----
const lootGroup = new THREE.Group();
scene.add(lootGroup);
const pickups = [];
const beamGeo = new THREE.CylinderGeometry(0.28, 0.28, 2.4, 10, 1, true);
beamGeo.translate(0, 1.2, 0);

function pickupVisual(id) {
  const g = new THREE.Group();
  const glow = id === 'gold' ? 0xffd36b : ITEMS[id].glow;
  const src = lootModels[LOOT_MODELS[id]];
  let body;
  if (src) {
    body = src.clone();
    body.scale.setScalar(id === 'gold' ? 2.2 : 1.3);
  } else {
    body = new THREE.Mesh(
      id === 'root_fiber' ? new THREE.ConeGeometry(0.2, 0.7, 5) : new THREE.OctahedronGeometry(0.25, 0),
      new THREE.MeshStandardMaterial({ color: glow, emissive: glow, emissiveIntensity: 0.7 })
    );
    body.position.y = 0.3;
  }
  g.add(body);
  g.add(
    new THREE.Mesh(
      beamGeo,
      new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0.28, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
    )
  );
  g.userData.body = body;
  return g;
}
function spawnPickup(id, n, x, z) {
  const g = pickupVisual(id);
  g.position.set(x, 0.4, z);
  lootGroup.add(g);
  const a = Math.random() * TAU;
  pickups.push({ g, id, n, x, z, y: 0.4, vx: Math.cos(a) * 2.2, vz: Math.sin(a) * 2.2, vy: 4 + Math.random() * 1.5, age: 0, landed: false });
}
function dropLoot(table, x, z) {
  for (const e of LOOT[table] || []) {
    if (Math.random() > e.chance) continue;
    const n = e.min ? e.min + Math.floor(Math.random() * (e.max - e.min + 1)) : 1;
    spawnPickup(e.id, n, x, z);
  }
}
function clearPickups() {
  for (const p of pickups.splice(0)) lootGroup.remove(p.g);
}
function updatePickups(dt) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.age += dt;
    if (!p.landed) {
      p.x = clamp(p.x + p.vx * dt, -ARENA, ARENA);
      p.z = clamp(p.z + p.vz * dt, -ARENA, ARENA);
      p.vy -= 14 * dt;
      p.y += p.vy * dt;
      if (p.y <= 0.05) {
        p.y = 0.05;
        p.landed = true;
      }
    }
    const dx = player.position.x - p.x;
    const dz = player.position.z - p.z;
    const d = Math.hypot(dx, dz);
    if (p.landed && p.id === 'gold' && d < 4 && state.hp > 0) {
      // koin tertarik ke pemain
      p.x += (dx / d) * 7 * dt;
      p.z += (dz / d) * 7 * dt;
    }
    p.g.position.set(p.x, p.y + (p.landed ? 0.18 + Math.sin(p.age * 3 + i) * 0.1 : 0), p.z);
    p.g.userData.body.rotation.y += dt * 1.8;
    p.g.visible = p.age < 80 || Math.floor(p.age * 6) % 2 === 0; // berkedip sebelum hilang
    if (p.age > 90) {
      lootGroup.remove(p.g);
      pickups.splice(i, 1);
      continue;
    }
    if (p.age > 0.5 && d < 1.4 && state.hp > 0) {
      lootGroup.remove(p.g);
      pickups.splice(i, 1);
      if (p.id === 'gold') {
        save.gold += p.n;
        persist();
        popText(`+${p.n} 🪙`, '#ffe08a');
      } else {
        addItem(p.id, p.n);
        popText(`+${p.n > 1 ? p.n + ' ' : ''}${ITEMS[p.id].name}`, '#bff4ff');
      }
      if (bagEl.classList.contains('open')) renderBag();
    }
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
const colliderList = () => (zone === 'village' ? village.colliders : zone === 'boss' ? bossRoom.colliders : dungeon.colliders);

// ---------- HUD ----------
const camBtn = document.getElementById('btnCam');
camBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  setCamMode(camMode + 1);
});
const hpTextEl = document.getElementById('hpText');
const deathEl = document.getElementById('death');
const helpEl = document.getElementById('help');
document.getElementById('btnHelp').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  helpEl.classList.toggle('open');
});
document.getElementById('btnRespawn').addEventListener('click', respawn);
function respawn() {
  if (state.hp > 0) return;
  state.hp = state.maxHp;
  state.invuln = 2;
  state.buffs.speed = 0;
  state.buffs.power = 0;
  state.potionCd = 0;
  bossBarEl.style.display = 'none';
  playerActor.lock = 0;
  play(playerActor, 'Idle_A', { fade: 0.1, force: true });
  setZone('village', 'start');
  toast('You wake up in the village...');
}
function updateHud() {
  hpEl.style.width = Math.max(0, (state.hp / state.maxHp) * 100) + '%';
  hpEl.classList.toggle('low', state.hp > 0 && state.hp / state.maxHp < 0.3);
  hpTextEl.textContent = `${Math.ceil(state.hp)} / ${state.maxHp}`;
  deathEl.classList.toggle('show', state.hp <= 0);
  const near = zone === 'village' && !talk ? nearestNpc(3.2) : null;
  talkBtn.style.display = near ? 'flex' : 'none';
  infoEl.textContent = state.hp <= 0
    ? 'Defeated'
    : zone === 'village'
      ? `${VILLAGE_NAME} · Shards ${save.shards.length}/4`
      : zone === 'boss'
        ? `Root Warden's Lair · Shards ${save.shards.length}/4`
        : `Dungeon · Kills ${state.kills} · Shards ${save.shards.length}/4`;
  updateSkillUi();
  goldEl.textContent = save.gold;
  const bf = [];
  if (state.buffs.speed > 0) bf.push(`⚡ ${Math.ceil(state.buffs.speed)}s`);
  if (state.buffs.power > 0) bf.push(`🔥 ${Math.ceil(state.buffs.power)}s`);
  buffsEl.textContent = bf.join('   ');
  for (const q of QUICK) {
    const c = invCount(q.id);
    q.cEl.textContent = c;
    q.el.classList.toggle('empty', c === 0);
    q.cdEl.style.transform = `scaleY(${state.potionCd / 1.2})`;
  }
}

// ---------- Loop ----------
const clock = new THREE.Clock();

let hudT = 0;
function tick() {
  const rawDt = clock.getDelta();
  watchFps(rawDt);
  const dt = uiOpen ? 0 : Math.min(rawDt, 0.05); // game berhenti saat tas / toko terbuka
  const alive = state.hp > 0;

  for (const sk of Object.values(SKILLS)) sk.t = Math.max(0, sk.t - dt);
  state.attackCooldown = Math.max(0, state.attackCooldown - dt);
  state.skillLock = Math.max(0, state.skillLock - dt);
  state.invuln = Math.max(0, state.invuln - dt);
  state.potionCd = Math.max(0, state.potionCd - dt);
  state.buffs.speed = Math.max(0, state.buffs.speed - dt);
  state.buffs.power = Math.max(0, state.buffs.power - dt);

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
      player.position.addScaledVector(dir, state.speed * (state.buffs.speed > 0 ? 1.4 : 1) * mag * slow * dt);
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
    for (const e of enemies) if (e.boss && !e.dead) pushOut(player.position, e.root.position, e.radius + 0.5);

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
    if (en.boss) {
      updateBoss(en, dt, alive);
      continue;
    }

    en.root.position.addScaledVector(en.knock, dt);
    en.knock.multiplyScalar(Math.exp(-8 * dt));
    en.root.position.x = clamp(en.root.position.x, -ARENA, ARENA);
    en.root.position.z = clamp(en.root.position.z, -ARENA, ARENA);
    collidePos(en.root.position, 0.5, colliderList());
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
      setZone('arena', 'village');
    } else if (zone === 'arena' && Math.hypot(player.position.x - ARENA_PORTAL.x, player.position.z - ARENA_PORTAL.z) < ARENA_PORTAL.r) {
      setZone('village', 'arena');
    } else if (zone === 'arena' && Math.hypot(player.position.x - BOSS_PORTAL.x, player.position.z - BOSS_PORTAL.z) < BOSS_PORTAL.r) {
      setZone('boss', 'arena');
    } else if (zone === 'boss' && Math.hypot(player.position.x - BOSS_EXIT.x, player.position.z - BOSS_EXIT.z) < BOSS_EXIT.r) {
      setZone('arena', 'boss');
    }
  }
  if (zone === 'village') {
    village.update(clock.elapsedTime);
    for (const n of npcs) updateActor(n.actor, dt);
    if (talk && Math.hypot(talk.npc.root.position.x - player.position.x, talk.npc.root.position.z - player.position.z) > 5.5) closeDialog();
  } else if (zone === 'arena') {
    arenaPortal.rotation.y += dt;
    arenaPortalLight.intensity = 25 + Math.sin(clock.elapsedTime * 3) * 6;
    bossPortal.rotation.y -= dt;
    bossPortalLight.intensity = 25 + Math.sin(clock.elapsedTime * 3.7) * 6;
    dungeon.update(clock.elapsedTime);
  } else {
    bossRoom.update(clock.elapsedTime, dt);
    updateBossFx(dt);
    bossExit.rotation.y += dt;
  }
  updatePickups(dt);
  sun.target.position.copy(player.position);
  sun.position.copy(player.position).add(SUN_OFFSET);

  updateCamera(dt);
  hudT -= rawDt;
  if (hudT <= 0) {
    hudT = 0.1;
    updateHud();
  }
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
