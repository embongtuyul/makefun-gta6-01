// main.js — SOLMARA entrypoint: renderer, game loop, input, crime rules,
// crew abilities, wasted/busted, saves and the screenshot presets.

import * as THREE from '../vendor/three.module.min.js';
import { buildCity, districtAt, BOULEVARD_Z } from './city.js';
import { Car, Traffic, CAR_MODELS } from './vehicles.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { MissionManager } from './missions.js';
import { Combat } from './combat.js';
import { Effects } from './effects.js';
import { Player } from './player.js';
import { HUD } from './hud.js';
import { AudioEngine } from './audio.js';
import { loadSave, writeSave, defaultSave, saveSummary } from './save.js';

const $ = (id) => document.getElementById(id);

const state = {
  mode: 'menu', // menu | playing | paused | howto
  cash: 250,
  rp: 0,
  jobIndex: 0,
  jobsDone: [],
  day: 1,
  clockMinutes: 16 * 60,
  muted: false,
  eyesOut: false,
  eyesOutTimer: 0,
  crew: {
    z: { cd: 0, max: 60 },
    x: { cd: 0, max: 45 },
    c: { cd: 0, max: 60 },
  },
  district: districtAt(0, 163),
};

// --- Three.js setup -------------------------------------------------------
const shell = $('game-shell');
const container = $('game-canvas-container');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1600);
camera.position.set(0, 4, 10);

function resize() {
  const w = shell.clientWidth || 1280;
  const h = shell.clientHeight || 720;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// --- World ----------------------------------------------------------------
const city = buildCity(scene);
const effects = new Effects(scene);
const audio = new AudioEngine();
const traffic = new Traffic(scene, city, 16);
const peds = new Pedestrians(scene, city, 26);
const police = new Police(scene, city);
const player = new Player(scene, city, 0, 163);
const combat = new Combat(scene, effects, audio);
const hud = new HUD();
const jobCars = [];
state.city = city;
state.traffic = traffic;
state.peds = peds;
state.police = police;
state.player = player;
state.combat = combat;
state.audio = audio;

// The hero's own orange GT, parked by the spawn.
const heroCar = new Car(scene, CAR_MODELS[0], 6, 168, -Math.PI / 2);
heroCar.owned = true;
jobCars.push(heroCar);
// Two more parked cars around the Strand for stealing.
const parked1 = new Car(scene, CAR_MODELS[3], -30, 160, Math.PI / 2);
jobCars.push(parked1);
const parked2 = new Car(scene, CAR_MODELS[1], 40, 186, -Math.PI / 2);
jobCars.push(parked2);

const missions = new MissionManager(scene, city, {
  player, police, hud, audio,
  jobCars,
  onJobComplete: (job) => {
    state.cash += job.pay;
    state.rp += job.rp;
    state.jobsDone.push(state.jobIndex);
    state.jobIndex++;
    state.district.standing = Math.min(100, state.district.standing + 2);
    saveGame();
    if (state.jobIndex < 6) {
      setTimeout(() => {
        // Only auto-start if the next job is not already running: the
        // player may have pressed J to retry/start it in the meantime, and
        // a second startJob would reset the stage and spawn a duplicate car.
        if (state.mode === 'playing' && !missions.active) missions.startJob(state.jobIndex);
      }, 3500);
    } else {
      setTimeout(() => hud.centerMessage('SOLMARA LEGEND', 'All six jobs done. The city is yours.', 'good'), 3500);
    }
  },
  onMissionFailed: () => {
    hud.toast('Job failed — press J to retry');
  },
});
state.missions = missions;

// --- Input ----------------------------------------------------------------
const keys = new Set();
let shooting = false;
let dragging = false;
let lastMouseX = 0;

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') e.preventDefault();
  audio.ensure();
  if (e.repeat) return;
  keys.add(e.code);
  if (state.mode !== 'playing') return;
  if (e.code === 'KeyE') toggleCar();
  if (e.code === 'KeyR') combat.reload();
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'KeyN') { audio.nextStation(); hud.toast(`${audio.currentStation().name} — ${audio.currentStation().song}`); }
  if (e.code === 'KeyJ') retryJob();
  if (e.code === 'KeyZ') crewAbility('z');
  if (e.code === 'KeyX') crewAbility('x');
  if (e.code === 'KeyC') crewAbility('c');
  if (e.code.startsWith('Digit')) {
    const n = parseInt(e.code.slice(5), 10);
    if (n >= 1 && n <= 5) combat.select(n - 1);
  }
  if (e.code === 'KeyP' || e.code === 'Escape') pauseGame();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));

renderer.domElement.addEventListener('pointerdown', (e) => {
  audio.ensure();
  if (state.mode !== 'playing') return;
  if (e.button === 0) {
    shooting = true;
    dragging = true;
    lastMouseX = e.clientX;
    tryShoot();
  }
});
window.addEventListener('pointerup', () => { shooting = false; dragging = false; });
window.addEventListener('pointermove', (e) => {
  if (!dragging || state.mode !== 'playing') return;
  const dx = e.clientX - lastMouseX;
  lastMouseX = e.clientX;
  if (player.inCar) {
    player.camOffsetYaw = Math.max(-1.4, Math.min(1.4, player.camOffsetYaw - dx * 0.004));
  } else {
    // On foot the camera does not follow the heading, so a drag turns the
    // camera itself (persistent — WASD stays relative to the view).
    player.camYaw -= dx * 0.004;
  }
});

// Touch controls.
if ('ontouchstart' in window) {
  $('touch-controls').classList.remove('hidden');
  document.querySelectorAll('.touch-btn').forEach((btn) => {
    const key = btn.dataset.key;
    const down = (e) => {
      e.preventDefault();
      audio.ensure();
      if (key === 'shoot') { shooting = true; tryShoot(); return; }
      keys.add(key);
      if (key === 'KeyE') toggleCar();
    };
    const up = (e) => {
      e.preventDefault();
      if (key === 'shoot') { shooting = false; return; }
      keys.delete(key);
    };
    btn.addEventListener('touchstart', down, { passive: false });
    btn.addEventListener('touchend', up, { passive: false });
  });
}

// --- Crime rules ----------------------------------------------------------
function onCrime(kind) {
  if (kind === 'shotFired') {
    if (police.wanted === 0) {
      police.setWanted(1);
      audio.wantedUp();
      hud.toast('Shots fired — the PD is coming');
    }
  } else if (kind === 'assault') {
    if (police.addWanted(1)) { audio.wantedUp(); hud.toast('Wanted level up!'); }
  } else if (kind === 'copHit') {
    if (police.addWanted(1)) { audio.wantedUp(); hud.toast('You hit a cop — wanted level up!'); }
  }
}

function tryShoot() {
  if (state.mode !== 'playing') return;
  combat.fire(camera, player.pos, { peds, traffic, jobCars, police }, onCrime);
}

function nearestCarToPlayer(maxDist) {
  let best = null;
  let bestD = maxDist;
  const all = [...traffic.cars, ...jobCars, ...police.units.map((u) => u.car)];
  for (const car of all) {
    if (car.dead) continue;
    const d = Math.hypot(car.x - player.x, car.z - player.z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function toggleCar() {
  if (player.inCar) {
    player.exitCar();
    audio.click();
    return;
  }
  const car = nearestCarToPlayer(4.5);
  if (!car) return;
  // Stealing a car someone is driving, or a police car, draws the law.
  const stolen = !car.owned && !car.jobCar;
  player.enterCar(car);
  audio.click();
  if (stolen) {
    if (police.wanted === 0) {
      police.setWanted(1);
      audio.wantedUp();
      hud.toast('Car stolen — the PD is coming');
    }
    // The car leaves traffic duty once stolen.
    const ti = traffic.cars.indexOf(car);
    if (ti >= 0) traffic.cars.splice(ti, 1);
  }
}

// --- Crew abilities -------------------------------------------------------
function crewAbility(key) {
  const c = state.crew[key];
  if (c.cd > 0) return;
  if (key === 'z') {
    if (police.wanted === 0) { hud.toast('No heat to lose right now'); return; }
    police.setWanted(Math.max(0, police.wanted - 1));
    hud.say('DANA', 'Plates swapped. They\'re looking for a different car now.');
    c.cd = c.max;
  } else if (key === 'x') {
    if (!player.inCar || !player.car) { hud.toast('Get in a car first — Bram can\'t fix fresh air'); return; }
    player.car.repair(60);
    hud.say('BRAM', 'Patched her up. Good as new — well, almost.');
    c.cd = c.max;
  } else if (key === 'c') {
    state.eyesOut = true;
    state.eyesOutTimer = 20;
    hud.say('JUNO', 'Eyes out — every unit is on your map for 20 seconds.');
    c.cd = c.max;
  }
  audio.click();
}

// --- Stunt scoring --------------------------------------------------------
// Drifts and near misses pay cash on the spot — the top entries all reward
// stylish driving, and it gives free-roam a reason to exist between jobs.
const stunts = {
  drifting: false,
  driftTime: 0,
  driftValue: 0,
  nearMissCd: new Map(), // car -> cooldown seconds
};

function awardStunt(amount, label) {
  state.cash += amount;
  hud.stuntPopup(`+$${amount}  ${label}`);
  audio.cashRegister();
}

function cashOutDrift() {
  if (!stunts.drifting) return;
  stunts.drifting = false;
  if (stunts.driftValue >= 50) {
    awardStunt(Math.round(stunts.driftValue), `DRIFT ${stunts.driftTime.toFixed(1)}s`);
  }
  stunts.driftTime = 0;
  stunts.driftValue = 0;
}

function updateStunts(dt) {
  if (!player.inCar || !player.car || player.car.dead) {
    cashOutDrift();
    return;
  }
  const car = player.car;
  const speedKmh = car.speedKmh;
  // Drift: handbrake + speed + steering held together. Keep the throttle
  // in and the drift sustains; lift off and it fades in under a second.
  const driftingNow = keys.has('Space') && speedKmh > 25 && Math.abs(car.steer) > 0.35;
  if (driftingNow) {
    stunts.drifting = true;
    stunts.driftTime += dt;
    stunts.driftValue = Math.min(500, stunts.driftValue + dt * 50);
  } else if (stunts.drifting) {
    cashOutDrift();
  }
  // Near miss: a fast pass within 4.5 m of a traffic car without touching it.
  if (speedKmh > 60) {
    for (const other of traffic.cars) {
      if (other.dead) continue;
      const d = Math.hypot(other.x - car.x, other.z - car.z);
      const cd = stunts.nearMissCd.get(other) || 0;
      if (d < 4.5 && d >= 3.4 && cd <= 0) {
        stunts.nearMissCd.set(other, 3);
        awardStunt(25, 'NEAR MISS');
      }
    }
  }
  for (const [c, t] of stunts.nearMissCd) {
    const next = t - dt;
    if (next <= 0) stunts.nearMissCd.delete(c);
    else stunts.nearMissCd.set(c, next);
  }
}

// Police gunfire: drain the shot events the pursuit queued this frame —
// tracer from the shooter, a gunshot, and damage on a hit.
function drainPoliceShots() {
  for (const shot of police.shotEvents) {
    combat.addTracer(
      new THREE.Vector3(shot.x, 1.4, shot.z),
      new THREE.Vector3(player.x, 1.2, player.z)
    );
    audio.gunshot(false);
    if (!shot.hit) continue;
    if (shot.carDamage && player.inCar && player.car) {
      const died = player.car.damage(shot.carDamage);
      effects.sparks(player.car.x, 1, player.car.z);
      if (died) effects.explosion(player.car.x, 0.5, player.car.z);
    }
    if (shot.damage > 0) {
      player.damage(shot.damage);
      effects.blood(player.x, 1.2, player.z);
    }
  }
  police.shotEvents.length = 0;
}

// --- Wasted / busted ------------------------------------------------------
function onWasted() {
  const fine = Math.min(state.cash, 100);
  state.cash -= fine;
  hud.centerMessage('WASTED', `Hospital bill -$${fine}`, 'bad');
  audio.missionSting(false);
  police.setWanted(0);
  respawn(-70, -70);
}

function onBusted() {
  const fine = Math.min(state.cash, 150);
  state.cash -= fine;
  hud.centerMessage('BUSTED', `Bail -$${fine}`, 'bad');
  audio.missionSting(false);
  police.setWanted(0);
  respawn(70, -70);
}

function respawn(x, z) {
  if (player.inCar) player.exitCar();
  player.mesh.position.set(x, 0, z);
  player.heal(100);
  player.armour = 0;
  player.vel.x = 0;
  player.vel.z = 0;
  player.heading = 0;
  player.camYaw = 0;
}

// --- Jobs -----------------------------------------------------------------
function retryJob() {
  if (missions.active) return;
  police.setWanted(0);
  missions.startJob(state.jobIndex);
}

// --- Save / load ----------------------------------------------------------
function saveGame() {
  const ok = writeSave({
    cash: state.cash,
    rp: state.rp,
    rank: 0,
    jobIndex: state.jobIndex,
    jobsDone: state.jobsDone,
    day: state.day,
    clockMinutes: state.clockMinutes,
    muted: state.muted,
    playerPos: { x: player.x, z: player.z },
  });
  return ok;
}

function applySave(save) {
  state.cash = save.cash;
  state.rp = save.rp;
  state.jobIndex = save.jobIndex;
  state.jobsDone = save.jobsDone || [];
  state.day = save.day;
  state.clockMinutes = save.clockMinutes;
  state.muted = save.muted;
  audio.setMuted(state.muted);
  if (save.playerPos) {
    player.mesh.position.set(save.playerPos.x, 0, save.playerPos.z);
  }
}

// --- Screens --------------------------------------------------------------
function showScreen(name) {
  $('start-screen').classList.toggle('hidden', name !== 'menu');
  $('howto-screen').classList.toggle('hidden', name !== 'howto');
  $('pause-screen').classList.toggle('hidden', name !== 'paused');
  if (name === 'playing') hud.show();
  else hud.hide();
}

function startGame(fromSave) {
  const save = fromSave ? loadSave() : null;
  if (save) applySave(save);
  else {
    const fresh = defaultSave();
    state.cash = fresh.cash;
    state.rp = fresh.rp;
    state.jobIndex = 0;
    state.jobsDone = [];
    state.day = 1;
    state.clockMinutes = fresh.clockMinutes;
    resetWorld();
  }
  audio.ensure();
  audio.setMuted(state.muted);
  state.mode = 'playing';
  showScreen('playing');
  missions.startJob(state.jobIndex);
  hud.say('SELMA', 'Welcome to Solmara, kid. The yellow marker is your next job — go earn.');
}

// NEW GAME puts the whole world back to its opening state: the player at
// the spawn, the PD stood down, the hero car and the two parked cars
// restored, and any job cars from a previous run (a wrecked Onyx, race
// rivals, the borrowed coupe) removed. Without this, a second NEW GAME
// starts standing in the last run's wreckage.
function resetWorld() {
  if (player.inCar) player.exitCar();
  player.mesh.position.set(0, 0, 163);
  player.mesh.visible = true;
  player.heading = 0;
  player.camYaw = 0;
  player.camOffsetYaw = 0;
  player.heal(100);
  player.armour = 0;
  player.vel.x = 0;
  player.vel.z = 0;
  police.setWanted(0);
  // Spawned job cars live past index 2 (hero + two parked cars are 0..2).
  for (let i = jobCars.length - 1; i >= 3; i--) {
    scene.remove(jobCars[i].mesh);
    jobCars.splice(i, 1);
  }
  const home = [
    { car: jobCars[0], x: 6, z: 168, h: -Math.PI / 2 },
    { car: jobCars[1], x: -30, z: 160, h: Math.PI / 2 },
    { car: jobCars[2], x: 40, z: 186, h: -Math.PI / 2 },
  ];
  for (const { car, x, z, h } of home) {
    if (!car) continue;
    car.setPosition(x, z);
    car.heading = h;
    car.mesh.rotation.y = h;
    car.speed = 0;
    car.condition = 100;
    car.dead = false;
    car.smoking = false;
    car.nitro = 100;
  }
  missions.targetCar = null;
  missions.targetWaypoints = [];
  missions.raceRivals = [];
  for (const k of ['z', 'x', 'c']) state.crew[k].cd = 0;
  state.eyesOut = false;
  state.eyesOutTimer = 0;
}

function pauseGame() {
  if (state.mode !== 'playing') return;
  state.mode = 'paused';
  $('pause-stats').innerHTML =
    `Cash $${Math.round(state.cash).toLocaleString()} &nbsp;·&nbsp; RP ${Math.round(state.rp).toLocaleString()}<br>` +
    `Job ${Math.min(state.jobIndex + 1, 6)}/6 &nbsp;·&nbsp; Day ${state.day} &nbsp;·&nbsp; Wanted ${'★'.repeat(police.wanted)}${'☆'.repeat(5 - police.wanted)}`;
  showScreen('paused');
}

function resumeGame() {
  state.mode = 'playing';
  showScreen('playing');
}

function quitToMenu() {
  saveGame();
  state.mode = 'menu';
  police.setWanted(0);
  missions.active = false;
  missions.beacon.visible = false;
  missions.beaconRing.visible = false;
  refreshMenu();
  showScreen('menu');
}

function toggleMute() {
  state.muted = !state.muted;
  audio.setMuted(state.muted);
  hud.toast(state.muted ? 'Sound off' : 'Sound on');
}

function refreshMenu() {
  const save = loadSave();
  $('btn-continue').classList.toggle('hidden', !save);
  $('start-save-note').textContent = save ? saveSummary(save) : 'No save yet — a new game starts with $250 and a borrowed reputation.';
}

$('btn-new').addEventListener('click', () => { audio.ensure(); audio.click(); startGame(false); });
$('btn-continue').addEventListener('click', () => { audio.ensure(); audio.click(); startGame(true); });
$('btn-howto').addEventListener('click', () => { audio.ensure(); audio.click(); state.mode = 'howto'; showScreen('howto'); });
$('btn-howto-back').addEventListener('click', () => { audio.click(); state.mode = 'menu'; showScreen('menu'); });
$('btn-resume').addEventListener('click', () => { audio.click(); resumeGame(); });
$('btn-save').addEventListener('click', () => { const ok = saveGame(); hud.toast(ok ? 'Game saved' : 'Save failed'); audio.cashRegister(); });
$('btn-restart-mission').addEventListener('click', () => {
  audio.click();
  police.setWanted(0);
  missions.startJob(state.jobIndex);
  resumeGame();
});
$('btn-quit').addEventListener('click', () => { audio.click(); quitToMenu(); });

// --- Collisions -----------------------------------------------------------
function collideCars(dt) {
  if (!player.inCar || !player.car) return;
  const me = player.car;
  const others = [...traffic.cars, ...jobCars.filter((c) => c !== me), ...police.units.map((u) => u.car)];
  for (const other of others) {
    if (other.dead) continue;
    const dx = me.x - other.x;
    const dz = me.z - other.z;
    const d = Math.hypot(dx, dz);
    if (d < 3.4 && d > 0.01) {
      const overlap = 3.4 - d;
      const nx = dx / d;
      const nz = dz / d;
      const impact = Math.abs(me.speed - other.speed);
      me.mesh.position.x += nx * overlap * 0.5;
      me.mesh.position.z += nz * overlap * 0.5;
      other.mesh.position.x -= nx * overlap * 0.5;
      other.mesh.position.z -= nz * overlap * 0.5;
      if (impact > 4) {
        // Ramming the mission target hurts it twice as much as you — the
        // Onyx job would be unwinnable on equal damage.
        const isTarget = other === missions.targetCar;
        const dmgMe = Math.min(30, impact * (isTarget ? 0.7 : 1.5));
        const dmgOther = Math.min(40, impact * (isTarget ? 3.0 : 1.5));
        me.damage(dmgMe);
        other.damage(dmgOther);
        effects.sparks((me.x + other.x) / 2, 1, (me.z + other.z) / 2);
        effects.addShake(0.25);
        audio.crash();
        if (other.dead) effects.explosion(other.x, 0.5, other.z);
        if (me.dead) effects.explosion(me.x, 0.5, me.z);
        me.speed *= 0.5;
      }
    }
  }
  // Player car vs pedestrians.
  if (Math.abs(me.speed) > 3) {
    const ped = peds.nearestTo(me.x, me.z, 2.4);
    if (ped) {
      ped.damage(200);
      peds.scare(me.x, me.z, 30);
      onCrime('assault');
      effects.blood(ped.x, 1, ped.z);
    }
  }
}

// --- Screenshot presets ---------------------------------------------------
// ?shot=chase|foot|mission — stage the game itself into a moment worth
// photographing. The game runs normally from there; nothing is faked.
function applyShotPreset(name) {
  startGame(false);
  if (name === 'chase') {
    state.cash = 12350;
    state.rp = 2450;
    state.clockMinutes = 16 * 60;
    player.enterCar(heroCar);
    heroCar.setPosition(-40, BOULEVARD_Z - 3.5);
    heroCar.heading = -Math.PI / 2;
    heroCar.mesh.rotation.y = heroCar.heading;
    heroCar.speed = 30;
    heroCar.condition = 62;
    missions.startJob(3);
    missions.stageIndex = 1;
    missions.beginStage();
    if (missions.targetCar) {
      missions.targetCar.setPosition(30, BOULEVARD_Z - 3.5);
      missions.targetCar.heading = -Math.PI / 2;
      missions.targetCar.mesh.rotation.y = -Math.PI / 2;
      missions.targetCar.speed = 22;
    }
    police.setWanted(4);
    // Stage the pursuit so the chase reads on camera: flanking units ahead
    // and beside the player (visible in frame), one behind for the panel.
    const chaseSpots = [
      { x: 10, z: BOULEVARD_Z - 10.5 },
      { x: -10, z: BOULEVARD_Z + 3.5 },
      { x: -25, z: BOULEVARD_Z + 3.5 },
      { x: 55, z: BOULEVARD_Z - 3.5 },
      { x: 15, z: BOULEVARD_Z + 3.5 },
    ];
    for (let i = 0; i < 5; i++) {
      const u = police.spawnUnit(player.pos);
      u.car.setPosition(chaseSpots[i].x, chaseSpots[i].z);
      u.car.heading = -Math.PI / 2;
      u.car.mesh.rotation.y = -Math.PI / 2;
      u.car.speed = 24;
    }
    police.spawnHeli(player.pos);
    police.heli.angle = -0.35; // drifts to dead ahead by capture time
    police.heli.altitude = 22; // low over the boulevard, in frame
    police.heli.mesh.position.set(player.pos.x + 52, 22, player.pos.z - 19);
    hud.say('JUNO', 'He\'s running for the pier — smash that Onyx before he sails!');
  } else if (name === 'foot') {
    player.mesh.position.set(0, 0, -60);
    player.heading = Math.PI;
    player.camYaw = Math.PI;
    state.cash = 1250;
  } else if (name === 'mission') {
    missions.startJob(1);
    player.mesh.position.set(66, 0, 40);
    player.heading = Math.PI; // face south, toward the parked coupe
    player.camYaw = Math.PI;
    state.cash = 980;
  }
}

// --- Main loop ------------------------------------------------------------
const clock = new THREE.Clock();
let hintTimer = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.1, clock.getDelta());

  if (state.mode === 'playing') {
    // Game clock: 1 game-minute per 5 real seconds.
    state.clockMinutes += dt / 5;
    if (state.clockMinutes >= 24 * 60) {
      state.clockMinutes -= 24 * 60;
      state.day++;
    }
    state.district = districtAt(player.x, player.z);

    // Crew cooldowns + Eyes Out timer.
    for (const k of ['z', 'x', 'c']) state.crew[k].cd = Math.max(0, state.crew[k].cd - dt);
    if (state.eyesOut) {
      state.eyesOutTimer -= dt;
      if (state.eyesOutTimer <= 0) state.eyesOut = false;
    }

    // Input → movement.
    const f = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
    const s = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    if (player.inCar) {
      const throttle = f;
      // D turns right: positive steer decreases the heading, and the car's
      // forward (-sin h, -cos h) rotates toward screen-right as h drops.
      // (This was `-s` until QA proved D turned the car left.)
      const steer = s;
      const handbrake = keys.has('Space');
      // Shift while driving = nitro (on foot it is the run key instead).
      player.car.boosting = (keys.has('ShiftLeft') || keys.has('ShiftRight')) && throttle > 0;
      player.driveCar(throttle, steer, handbrake, dt);
      collideCars(dt);
      updateStunts(dt);
      if (player.car.dead) {
        hud.toast('Your car is wrecked — get out!');
      }
      if (player.car.smoking && Math.random() < dt * 8) {
        effects.smoke(player.car.x, 1.2, player.car.z);
      }
    } else {
      player.moveOnFoot({ f, s }, keys.has('ShiftLeft') || keys.has('ShiftRight'), dt);
    }

    // Auto-fire while holding the mouse.
    if (shooting && combat.currentWeapon().auto) tryShoot();
    combat.update(dt);

    traffic.update(dt);
    peds.update(dt);
    police.update(dt, player, onBusted);
    drainPoliceShots();
    missions.update(dt, player);
    effects.update(dt);

    // Smoking wrecks.
    for (const car of [...traffic.cars, ...jobCars]) {
      if (car.smoking && !car.dead && Math.random() < dt * 3) {
        effects.smoke(car.x, 1.2, car.z);
      }
    }

    // Wasted check.
    if (player.health <= 0) onWasted();

    // Hints.
    hintTimer -= dt;
    if (hintTimer <= 0) {
      hintTimer = 0.25;
      if (!player.inCar) {
        const car = nearestCarToPlayer(4.5);
        hud.hint(car ? `E — ENTER ${car.model.name}` : '');
      } else {
        hud.hint(player.car.dead ? 'E — GET OUT, THIS CAR IS DONE' : '');
      }
    }

    // Audio follows the world.
    audio.setEngine(player.inCar ? player.carSpeedKmh : 0, player.inCar);
    audio.setSiren(police.wanted > 0);

    hud.update(state, dt);
  }

  // Camera always follows (even behind menus, for a living backdrop).
  player.updateCamera(camera, dt, effects.shakeOffset());
  renderer.render(scene, camera);
}

// --- Boot -----------------------------------------------------------------
refreshMenu();
showScreen('menu');
animate();

const params = new URLSearchParams(location.search);
if (params.has('shot')) {
  applyShotPreset(params.get('shot'));
}

// Playtest hook: the automated checks read the live game state here.
window.__solmara = { state, player, police, missions, traffic, peds, combat, city, hud, audio, stunts };
window.__solmaraReady = true;
