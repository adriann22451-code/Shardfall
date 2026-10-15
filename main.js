import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const hpEl = document.getElementById('hp');
const infoEl = document.getElementById('info');
infoEl.textContent = 'Memuat aset...';

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

scene.add(new THREE.HemisphereLight(0xaabbff, 0x332211, 0.9));
const sun = new THREE.DirectionalLight(0xffffff, 1.3);
sun.position.set(10, 20, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -30;
sun.shadow.camera.right = 30;
sun.shadow.camera.top = 30;
sun.shadow.camera.bottom = -30;
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 80),
  new THREE.MeshStandardMaterial({ color: 0x2b2f3a })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
scene.add(new THREE.GridHelper(80, 40, 0x444a5a, 0x333846));

// ---------- Muat aset (KayKit, CC0) ----------
const loader = new GLTFLoader();
const load = (file) => loader.loadAsync('assets/' + file);

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
  infoEl.textContent = 'Gagal memuat aset. Buka lewat server lokal dan pastikan folder assets/ ada di samping index.html.';
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
for (let i = 0; i < 6; i++) spawnEnemy();
setInterval(() => {
  if (enemies.filter((e) => !e.dead).length < 12) spawnEnemy();
}, 3000);

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

// ---------- HUD ----------
function updateHud() {
  hpEl.style.width = Math.max(0, (state.hp / state.maxHp) * 100) + '%';
  infoEl.textContent = state.hp > 0
    ? `Kill: ${state.kills}`
    : `Kamu kalah! Kill: ${state.kills} — refresh untuk main lagi`;
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

  updateCamera(dt);
  updateHud();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
