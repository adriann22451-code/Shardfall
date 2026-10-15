import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const hpEl = document.getElementById('hp');
const infoEl = document.getElementById('info');
infoEl.textContent = 'Memuat aset...';

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

let knightGltf, minionGltf, warriorGltf, generalGltf, moveGltf, swordGltf, bladeGltf;
try {
  [knightGltf, minionGltf, warriorGltf, generalGltf, moveGltf, swordGltf, bladeGltf] = await Promise.all([
    load('Knight.glb'),
    load('Skeleton_Minion.glb'),
    load('Skeleton_Warrior.glb'),
    load('Rig_Medium_General.glb'),
    load('Rig_Medium_MovementBasic.glb'),
    load('sword_1handed.gltf'),
    load('Skeleton_Blade.gltf'),
  ]);
} catch (err) {
  console.error(err);
  infoEl.textContent = 'Gagal memuat aset. Buka lewat server lokal dan pastikan folder assets/ ada di samping index.html.';
  throw err;
}

// Semua karakter KayKit memakai rig yang sama (Rig_Medium), jadi animasinya dibagi bersama.
const clips = [...generalGltf.animations, ...moveGltf.animations];

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

function play(actor, name, { fade = 0.15, once = false, force = false } = {}) {
  const next = actor.actions[name];
  if (!next || (actor.current === next && !force)) return;
  next.reset();
  next.setEffectiveWeight(1);
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

// Mainkan animasi sekali (hit/mati). hold=true menahan pose terakhir selamanya.
function playOnce(actor, name, { hold = false, maxLock = Infinity } = {}) {
  const clip = actor.actions[name]?.getClip();
  play(actor, name, { once: true, force: true, fade: 0.08 });
  actor.lock = hold ? Infinity : Math.min(clip ? clip.duration : 0.4, maxLock);
}

function updateActor(actor, dt) {
  actor.lock = Math.max(0, actor.lock - dt);
  actor.mixer.update(dt);
}

const TAU = Math.PI * 2;
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
  swinging: false,
  swingT: 0,
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
    player.position.x + Math.cos(angle) * dist,
    0,
    player.position.z + Math.sin(angle) * dist
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

// ---------- Input ----------
const keys = new Set();
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('mousedown', () => keys.add('Attack'));
addEventListener('mouseup', () => keys.delete('Attack'));

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- Aksi ----------
function damagePlayer(amount) {
  if (state.hp <= 0) return;
  state.hp -= amount;
  if (state.hp <= 0) {
    state.hp = 0;
    playOnce(playerActor, 'Death_A', { hold: true });
  } else {
    playOnce(playerActor, 'Hit_A', { maxLock: 0.35 });
  }
}

function damageEnemy(en, dir) {
  en.hp -= 1;
  en.knock.copy(dir).multiplyScalar(7);
  if (en.hp <= 0) {
    en.dead = true;
    en.deadTimer = 1.8;
    state.kills++;
    playOnce(en.actor, 'Death_A', { hold: true });
  } else {
    playOnce(en.actor, 'Hit_A', { maxLock: 0.5 });
  }
}

function attack() {
  if (state.attackCooldown > 0) return;
  state.attackCooldown = 0.5;
  state.swinging = true;
  state.swingT = 0;

  // Auto-aim ke musuh terdekat dalam jangkauan
  let nearest = null;
  let nearestDist = 4;
  for (const en of enemies) {
    if (en.dead) continue;
    const d = en.root.position.distanceTo(player.position);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = en;
    }
  }
  if (nearest) {
    player.rotation.y = Math.atan2(
      nearest.root.position.x - player.position.x,
      nearest.root.position.z - player.position.z
    );
  }

  const facing = new THREE.Vector3(0, 0, 1).applyQuaternion(player.quaternion);
  for (const en of enemies) {
    if (en.dead) continue;
    const to = en.root.position.clone().sub(player.position);
    to.y = 0;
    const d = to.length();
    if (d < 2.6 && to.normalize().dot(facing) > 0.2) damageEnemy(en, to);
  }
}

// ---------- HUD ----------
function updateHud() {
  hpEl.style.width = Math.max(0, (state.hp / state.maxHp) * 100) + '%';
  infoEl.textContent = state.hp > 0
    ? `Kill: ${state.kills}`
    : `Kamu kalah! Kill: ${state.kills} — refresh untuk main lagi`;
}

// ---------- Loop ----------
const clock = new THREE.Clock();
const camOffset = new THREE.Vector3(0, 14, 10);

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const alive = state.hp > 0;

  if (alive) {
    // Gerak
    const dir = new THREE.Vector3(
      (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0),
      0,
      (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0)
    );
    const moving = dir.lengthSq() > 0;
    if (moving) {
      dir.normalize();
      player.position.addScaledVector(dir, state.speed * dt);
      const targetYaw = Math.atan2(dir.x, dir.z);
      player.rotation.y = lerpAngle(player.rotation.y, targetYaw, 1 - Math.exp(-18 * dt));
    }

    // Serang
    state.attackCooldown = Math.max(0, state.attackCooldown - dt);
    if (keys.has('Space') || keys.has('Attack')) attack();

    // Ayunan: putar badan, maju sedikit, kilatan tebasan
    if (state.swinging) {
      state.swingT += dt / 0.3;
      const t = Math.min(state.swingT, 1);
      playerModel.rotation.y = -Math.sin(t * Math.PI) * 1.0;
      const facing = new THREE.Vector3(0, 0, 1).applyQuaternion(player.quaternion);
      player.position.addScaledVector(facing, 5 * (1 - t) * dt);
      slash.material.opacity = 0.8 * (1 - t);
      if (state.swingT >= 1) {
        state.swinging = false;
        playerModel.rotation.y = 0;
        slash.material.opacity = 0;
      }
    }

    if (playerActor.lock <= 0) play(playerActor, moving ? 'Running_A' : 'Idle_A');
  }
  updateActor(playerActor, dt);

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

  // Kamera mengikuti
  const target = player.position.clone().add(camOffset);
  camera.position.lerp(target, 1 - Math.pow(0.001, dt));
  camera.lookAt(player.position.x, 1, player.position.z);

  updateHud();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
