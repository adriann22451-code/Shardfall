import * as THREE from 'three';

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

scene.add(new THREE.HemisphereLight(0xaabbff, 0x332211, 0.7));
const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(10, 20, 8);
sun.castShadow = true;
sun.shadow.camera.left = -30;
sun.shadow.camera.right = 30;
sun.shadow.camera.top = 30;
sun.shadow.camera.bottom = -30;
scene.add(sun);

// Lantai
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 80),
  new THREE.MeshStandardMaterial({ color: 0x2b2f3a })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
scene.add(new THREE.GridHelper(80, 40, 0x444a5a, 0x333846));

// ---------- Pemain (placeholder, ganti dengan model GLB nanti) ----------
const player = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.4, 1, 4, 12),
  new THREE.MeshStandardMaterial({ color: 0x4aa3ff })
);
player.position.y = 0.9;
player.castShadow = true;
scene.add(player);

const state = {
  hp: 100,
  maxHp: 100,
  speed: 6,
  attackCooldown: 0,
  attackFlash: 0,
  kills: 0,
};

// Efek tebasan
const slash = new THREE.Mesh(
  new THREE.RingGeometry(1.2, 1.8, 24, 1, -0.9, 1.8),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide })
);
slash.rotation.x = -Math.PI / 2;
slash.position.y = 0.9;
player.add(slash);

// ---------- Musuh ----------
const enemies = [];
const enemyGeo = new THREE.BoxGeometry(0.9, 1.2, 0.9);

function spawnEnemy() {
  const angle = Math.random() * Math.PI * 2;
  const dist = 18 + Math.random() * 8;
  const mesh = new THREE.Mesh(enemyGeo, new THREE.MeshStandardMaterial({ color: 0xd04a4a }));
  mesh.position.set(
    player.position.x + Math.cos(angle) * dist,
    0.6,
    player.position.z + Math.sin(angle) * dist
  );
  mesh.castShadow = true;
  scene.add(mesh);
  enemies.push({ mesh, hp: 3, speed: 2 + Math.random() * 1.2, hitCooldown: 0 });
}
for (let i = 0; i < 6; i++) spawnEnemy();
setInterval(() => { if (enemies.length < 12) spawnEnemy(); }, 3000);

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
function attack() {
  if (state.attackCooldown > 0) return;
  state.attackCooldown = 0.45;
  state.attackFlash = 0.15;

  const facing = new THREE.Vector3(0, 0, 1).applyQuaternion(player.quaternion);
  for (const en of enemies) {
    const to = en.mesh.position.clone().sub(player.position);
    to.y = 0;
    const d = to.length();
    if (d < 2.4 && to.normalize().dot(facing) > 0.2) {
      en.hp -= 1;
      en.mesh.position.addScaledVector(to, 0.8); // knockback
      en.mesh.material.color.set(0xffffff);
      setTimeout(() => en.mesh.material.color.set(0xd04a4a), 80);
    }
  }
}

function removeDeadEnemies() {
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (enemies[i].hp <= 0) {
      scene.remove(enemies[i].mesh);
      enemies.splice(i, 1);
      state.kills++;
    }
  }
}

// ---------- HUD ----------
const hpEl = document.getElementById('hp');
const infoEl = document.getElementById('info');
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

  if (state.hp > 0) {
    // Gerak
    const dir = new THREE.Vector3(
      (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0),
      0,
      (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0)
    );
    if (dir.lengthSq() > 0) {
      dir.normalize();
      player.position.addScaledVector(dir, state.speed * dt);
      player.rotation.y = Math.atan2(dir.x, dir.z);
    }

    // Serang
    state.attackCooldown = Math.max(0, state.attackCooldown - dt);
    if (keys.has('Space') || keys.has('Attack')) attack();

    // Musuh mengejar
    for (const en of enemies) {
      const to = player.position.clone().sub(en.mesh.position);
      to.y = 0;
      const d = to.length();
      if (d > 1.1) {
        en.mesh.position.addScaledVector(to.normalize(), en.speed * dt);
        en.mesh.lookAt(player.position.x, en.mesh.position.y, player.position.z);
      }
      en.hitCooldown = Math.max(0, en.hitCooldown - dt);
      if (d <= 1.3 && en.hitCooldown === 0) {
        state.hp -= 8;
        en.hitCooldown = 1;
      }
    }
    removeDeadEnemies();
  }

  // Efek tebasan
  state.attackFlash = Math.max(0, state.attackFlash - dt);
  slash.material.opacity = state.attackFlash > 0 ? 0.8 : 0;

  // Kamera mengikuti
  const target = player.position.clone().add(camOffset);
  camera.position.lerp(target, 1 - Math.pow(0.001, dt));
  camera.lookAt(player.position);

  updateHud();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
