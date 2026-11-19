// police.js — the Solmara PD wanted system: stars, pursuit units with
// names and roles, roadblocks and the police helicopter.

import * as THREE from '../vendor/three.module.min.js';
import { Car, CAR_MODELS } from './vehicles.js';
import { NS_ROADS, EW_ROADS, BOULEVARD_Z } from './city.js';

const UNIT_NAMES = ['KITE-1', 'HERON-2', 'MARLIN-3', 'TERN-5', 'GECKO-25', 'CORAL-48', 'CORAL-85', 'CORAL-43', 'PELICAN-11', 'SHARK-7', 'REEF-9', 'DUNE-12'];
const ROLES = ['RAMMING', 'FLANKING', 'PURSUIT', 'ROADBLOCK', 'RESPONDING'];

// Snap a point onto the nearest road so pursuit units never spawn (or get
// stuck) inside a block where they can only ram a wall.
function snapToRoad(x, z) {
  let best = { d: Infinity, x, z };
  for (const rx of NS_ROADS) {
    const d = Math.abs(x - rx);
    if (d < best.d) best = { d, x: rx, z };
  }
  for (const rz of EW_ROADS) {
    const d = Math.abs(z - rz);
    if (d < best.d) best = { d, x, z: rz };
  }
  const bd = Math.abs(z - BOULEVARD_Z);
  if (bd < best.d) best = { d: bd, x, z: BOULEVARD_Z };
  return best;
}

export class Police {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.units = []; // { car, name, role, state }
    this.heli = null;
    this.heliName = 'HAWK-1';
    this.wanted = 0;
    this.heat = 0; // 0..100 within the current star; decays when unseen
    this.unseenTimer = 0;
    this.spawnTimer = 0;
    this.bustedTimer = 0;
    this.nameIndex = 0;
    this.flashTimer = 0;
    this.shotEvents = []; // drained by main.js each frame: { x, z, hit, damage }
    this.anySeesPlayer = false; // exposed for the HUD IN SIGHT pill
    this.nearestDist = Infinity;
  }

  targetUnitCount() {
    return [0, 2, 3, 4, 6, 8][this.wanted] || 0;
  }

  setWanted(stars, silent = false) {
    const next = Math.max(0, Math.min(5, stars));
    const rose = next > this.wanted;
    this.wanted = next;
    this.heat = next > 0 ? 60 : 0;
    this.unseenTimer = 0;
    // A new wanted level restarts the arrest clock: without this, a timer
    // built up under the old level can fire a busted a fraction of a second
    // after the level changes (e.g. right after spawning fresh units).
    this.bustedTimer = 0;
    if (next === 0) this.clearUnits();
    return rose;
  }

  addWanted(stars = 1) {
    return this.setWanted(this.wanted + stars);
  }

  clearUnits() {
    for (const u of this.units) this.scene.remove(u.car.mesh);
    this.units = [];
    if (this.heli) {
      this.scene.remove(this.heli.mesh);
      this.heli = null;
    }
  }

  nextName() {
    const n = UNIT_NAMES[this.nameIndex % UNIT_NAMES.length];
    this.nameIndex++;
    return n;
  }

  spawnUnit(playerPos) {
    // Spawn on a road ahead of the player's heading, off-screen-ish.
    const angle = Math.random() * Math.PI * 2;
    const dist = 70 + Math.random() * 50;
    let x = playerPos.x + Math.cos(angle) * dist;
    let z = playerPos.z + Math.sin(angle) * dist;
    x = Math.max(-245, Math.min(245, x));
    z = Math.max(-245, Math.min(245, z));
    // Snap onto the nearest road: a unit spawned inside a block can only
    // ram a wall and never reaches the player.
    const road = snapToRoad(x, z);
    x = road.x;
    z = road.z;
    const heading = Math.atan2(-(playerPos.x - x), -(playerPos.z - z));
    const car = new Car(this.scene, CAR_MODELS[1], x, z, heading, true);
    car.topSpeedBoost = true;
    const role = ROLES[(Math.random() * ROLES.length) | 0];
    const unit = { car, name: this.nextName(), role, state: 'chase', stuckTimer: 0, shotTimer: 1 + Math.random() * 1.5 };
    this.units.push(unit);
    return unit;
  }

  spawnHeli(playerPos) {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1a2a6a });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 3.6), bodyMat);
    g.add(body);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 1.2), new THREE.MeshLambertMaterial({ color: 0x9fd8ff }));
    glass.position.set(0, 0.2, -1.4);
    g.add(glass);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 3.4), bodyMat);
    tail.position.set(0, 0.2, 3.2);
    g.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.08, 0.3), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    rotor.position.y = 0.9;
    g.add(rotor);
    // Searchlight cone (reaches the ground from patrol height).
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(7, 30, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false })
    );
    cone.position.y = -15;
    cone.rotation.x = Math.PI;
    g.add(cone);
    g.position.set(playerPos.x + 20, 28, playerPos.z + 20);
    this.scene.add(g);
    this.heli = { mesh: g, rotor, angle: 0, altitude: 28 };
  }

  // Drive a unit toward a point with simple steering; returns distance.
  steerUnit(unit, tx, tz, dt, aggression = 1) {
    const car = unit.car;
    const dx = tx - car.x;
    const dz = tz - car.z;
    const dist = Math.hypot(dx, dz);
    // Desired heading: forward is (-sin h, -cos h), so h = atan2(-dx, -dz).
    const desired = Math.atan2(-dx, -dz);
    let diff = desired - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    // NEGATIVE diff: drive() subtracts steer from the heading, so steering
    // toward a larger desired heading needs a negative steer input.
    // (The positive sign here made every unit steer AWAY from the player.)
    const steer = Math.max(-1, Math.min(1, -diff * 2.2));
    const throttle = dist > 6 ? 1 : 0.2;
    car.drive(throttle * aggression, steer, false, dt);
    this.city.resolveCircle(car.mesh.position, 2.4);
    return dist;
  }

  update(dt, player, onBusted) {
    this.flashTimer += dt;
    const flash = Math.sin(this.flashTimer * 14) > 0;
    for (const u of this.units) {
      const m = u.car.mesh.userData;
      if (m.lightL) m.lightL.material.color.setHex(flash ? 0xff2a2a : 0x550000);
      if (m.lightR) m.lightR.material.color.setHex(flash ? 0x112266 : 0x2a6aff);
    }

    if (this.wanted === 0) {
      this.anySeesPlayer = false;
      this.nearestDist = Infinity;
      return;
    }

    // Spawn / despawn to match the wanted level.
    this.spawnTimer -= dt;
    if (this.units.length < this.targetUnitCount() && this.spawnTimer <= 0) {
      this.spawnUnit(player.pos);
      this.spawnTimer = 1.2;
    }
    if (this.units.length > this.targetUnitCount()) {
      // Wanted dropped: stand down the farthest units. Leftovers from a
      // higher wanted level blanket the map and block heat decay forever.
      this.units.sort((a, b) =>
        Math.hypot(a.car.x - player.pos.x, a.car.z - player.pos.z) -
        Math.hypot(b.car.x - player.pos.x, b.car.z - player.pos.z));
      while (this.units.length > this.targetUnitCount()) {
        const u = this.units.pop();
        this.scene.remove(u.car.mesh);
      }
    }
    if (this.wanted >= 3 && !this.heli) this.spawnHeli(player.pos);
    if (this.wanted < 3 && this.heli) {
      this.scene.remove(this.heli.mesh);
      this.heli = null;
    }

    // Each unit pursues by its role.
    let nearestDist = Infinity;
    let anySeesPlayer = false;
    for (const u of this.units) {
      const car = u.car;
      const d = Math.hypot(car.x - player.pos.x, car.z - player.pos.z);
      nearestDist = Math.min(nearestDist, d);
      if (d < 160) anySeesPlayer = true;
      if (car.dead) { u.state = 'disabled'; continue; }
      let tx = player.pos.x;
      let tz = player.pos.z;
      if (u.role === 'FLANKING') {
        // Aim ahead of the player's motion.
        tx += player.vel.x * 1.2;
        tz += player.vel.z * 1.2;
      } else if (u.role === 'ROADBLOCK' && d > 25) {
        // Park ahead on the player's path.
        tx += player.vel.x * 2.2;
        tz += player.vel.z * 2.2;
      }
      if (d > 25) {
        // Far away: follow the road grid instead of cutting diagonally
        // through buildings. Align one axis at a time (Manhattan routing);
        // the roads are axis-aligned, so this keeps the unit on asphalt
        // until it is close enough to close in directly.
        if (Math.abs(tx - car.x) > Math.abs(tz - car.z)) tz = car.z;
        else tx = car.x;
      }
      let dist;
      if (!player.inCar && d < 6) {
        // On foot and the cop is on top of you: it stops dead and the
        // arrest plays out (busted) instead of coasting past you at 47 m/s
        // and turning around forever. Kill the speed outright — handbrake
        // drag alone lets the unit overshoot ~30 m before it stops.
        car.speed = 0;
        car.drive(0, 0, true, dt);
        dist = d;
      } else {
        dist = this.steerUnit(u, tx, tz, dt, u.role === 'RAMMING' ? 1.15 : 1);
      }
      // Ram damage when touching the player's car.
      if (dist < 4.5 && player.inCar && u.role === 'RAMMING') {
        player.car.damage(6 * dt);
      }
      // Cops shoot: the only thing that can hurt the player on foot, so
      // WASTED is reachable in a real chase instead of a debug-only path.
      // Fire rate and accuracy scale with the wanted level; each shot is
      // queued as an event for main.js (tracer + sound + damage).
      u.shotTimer -= dt;
      if (u.shotTimer <= 0 && d < 50) {
        const interval = [0, 2.6, 2.2, 1.8, 1.3, 0.9][this.wanted] || 2.6;
        const hitChance = [0, 0.28, 0.34, 0.42, 0.5, 0.58][this.wanted] || 0.28;
        u.shotTimer = interval * (0.7 + Math.random() * 0.6);
        this.shotEvents.push({
          x: car.x, z: car.z,
          hit: Math.random() < hitChance,
          damage: player.inCar ? 3 : 8,
          carDamage: player.inCar ? 6 : 0,
        });
      }
      // Unstick: reverse briefly if barely moving while far away.
      if (Math.abs(car.speed) < 0.5 && d > 12) {
        u.stuckTimer += dt;
        if (u.stuckTimer > 1.5 && u.stuckTimer <= 4) {
          car.drive(-1, Math.random() < 0.5 ? -1 : 1, false, dt);
        }
        if (u.stuckTimer > 4) {
          // Still wedged after seconds of reversing: the unit found a side
          // street — put it back on the nearest road.
          const road = snapToRoad(car.x, car.z);
          car.setPosition(road.x, road.z);
          u.stuckTimer = 0;
        }
      } else {
        u.stuckTimer = 0;
      }
    }

    // Helicopter circles above the player: wide and low enough to stay
    // in the driver's view, slow enough to track.
    if (this.heli) {
      this.heli.angle += dt * 0.12;
      const hx = player.pos.x + Math.cos(this.heli.angle) * 55;
      const hz = player.pos.z + Math.sin(this.heli.angle) * 55;
      this.heli.mesh.position.x += (hx - this.heli.mesh.position.x) * Math.min(1, dt * 1.5);
      this.heli.mesh.position.z += (hz - this.heli.mesh.position.z) * Math.min(1, dt * 1.5);
      this.heli.mesh.position.y = this.heli.altitude + Math.sin(this.heli.angle * 2) * 1.5;
      this.heli.mesh.rotation.y = this.heli.angle + Math.PI / 2;
      this.heli.rotor.rotation.y += dt * 22;
      anySeesPlayer = true; // the eye in the sky always sees you
    }
    this.anySeesPlayer = anySeesPlayer;
    this.nearestDist = nearestDist;

    // Heat decay: unseen for a while and the law cools off.
    if (!anySeesPlayer && nearestDist > 90) {
      this.unseenTimer += dt;
      if (this.unseenTimer > 8) {
        this.heat -= dt * 12;
        if (this.heat <= 0) this.setWanted(this.wanted - 1);
      }
    } else {
      this.unseenTimer = 0;
      this.heat = Math.min(100, this.heat + dt * 4);
    }

    // Busted: on foot, slow, cop right on top of you. The timer decays
    // instead of resetting, so a unit wobbling in and out of range still
    // builds toward the arrest.
    if (!player.inCar && player.speed < 1 && nearestDist < 7 && this.wanted > 0) {
      this.bustedTimer += dt;
      if (this.bustedTimer > 2.5) {
        this.bustedTimer = 0;
        onBusted && onBusted();
      }
    } else {
      this.bustedTimer = Math.max(0, this.bustedTimer - dt * 2);
    }
  }

  // Rows for the HUD police panel: name, role, live distance.
  panelRows(playerPos) {
    const rows = this.units
      .filter((u) => !u.car.dead)
      .map((u) => ({
        name: u.name,
        role: u.role,
        dist: Math.round(Math.hypot(u.car.x - playerPos.x, u.car.z - playerPos.z)),
      }))
      .sort((a, b) => a.dist - b.dist);
    if (this.heli) rows.unshift({ name: this.heliName, role: 'SPOTLIGHT', dist: Math.round(Math.hypot(this.heli.mesh.position.x - playerPos.x, this.heli.mesh.position.z - playerPos.z)) });
    return rows;
  }

  get unitCount() {
    return this.units.filter((u) => !u.car.dead).length + (this.heli ? 1 : 0);
  }
}
