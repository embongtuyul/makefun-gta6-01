// vehicles.js — low-poly cars, arcade driving physics and city traffic.
// Every car is a THREE.Group of boxes: body, cabin, wheels, lights.

import * as THREE from '../vendor/three.module.min.js';
import { NS_ROADS, EW_ROADS, BOULEVARD_Z } from './city.js';

export const CAR_MODELS = [
  { name: 'MERIDIAN GT', color: 0xff7a3c, sport: true, topSpeed: 52, accel: 26 },
  { name: 'SORRA SEDAN', color: 0x7ab8ff, sport: false, topSpeed: 36, accel: 18 },
  { name: 'VOLTA COUPE', color: 0xffd94d, sport: true, topSpeed: 48, accel: 24 },
  { name: 'KOBO HATCH', color: 0x9be07a, sport: false, topSpeed: 33, accel: 16 },
  { name: 'MARLIN SUV', color: 0xc9a0ff, sport: false, topSpeed: 38, accel: 17 },
  { name: 'TIDE VAN', color: 0xe8e8e8, sport: false, topSpeed: 30, accel: 14 },
  { name: 'KADE ONYX', color: 0x2a2a34, sport: true, topSpeed: 46, accel: 22 },
];

export function makeCarModel(model, police = false) {
  const g = new THREE.Group();
  const bodyColor = police ? 0xf2f2f2 : model.color;
  const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x181822 });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.75, 4.4), bodyMat);
  body.position.y = 0.62;
  g.add(body);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.65, 2.2), glassMat);
  cabin.position.set(0, 1.3, -0.2);
  g.add(cabin);

  if (police) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.3, 4.42), new THREE.MeshLambertMaterial({ color: 0x1a2a6a }));
    stripe.position.y = 0.62;
    g.add(stripe);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.5), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    bar.position.set(0, 1.72, -0.2);
    g.add(bar);
    const lightL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    lightL.position.set(-0.32, 1.85, -0.2);
    g.add(lightL);
    const lightR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.4), new THREE.MeshBasicMaterial({ color: 0x2a6aff }));
    lightR.position.set(0.32, 1.85, -0.2);
    g.add(lightR);
    g.userData.lightL = lightL;
    g.userData.lightR = lightR;
  } else if (model.sport) {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 0.4), darkMat);
    spoiler.position.set(0, 1.05, 2.05);
    g.add(spoiler);
  }

  // Headlights + taillights.
  const hlMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tlMat = new THREE.MeshBasicMaterial({ color: 0xff3a3a });
  for (const s of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.1), hlMat);
    hl.position.set(s * 0.65, 0.62, -2.22);
    g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.1), tlMat);
    tl.position.set(s * 0.65, 0.62, 2.22);
    g.add(tl);
  }

  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [wx, wz] of [[-0.95, -1.45], [0.95, -1.45], [-0.95, 1.45], [0.95, 1.45]]) {
    const w = new THREE.Mesh(wheelGeo, darkMat);
    w.position.set(wx, 0.38, wz);
    g.add(w);
    wheels.push(w);
  }
  g.userData.wheels = wheels;
  return g;
}

// Arcade car: position, heading, speed, condition. Steering follows speed.
export class Car {
  constructor(scene, model, x, z, heading, police = false) {
    this.model = model;
    this.police = police;
    this.mesh = makeCarModel(model, police);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    scene.add(this.mesh);
    this.heading = heading;
    this.speed = 0; // m/s, forward positive
    this.condition = 100;
    this.smoking = false;
    this.dead = false;
    this.steer = 0;
    this.topSpeedBoost = false; // police cars: set by spawnUnit
    this.nitro = 100; // 0..100; Shift while driving spends it for a boost
    this.boosting = false; // set by the driver each frame
  }

  get x() { return this.mesh.position.x; }
  get z() { return this.mesh.position.z; }

  setPosition(x, z) {
    this.mesh.position.x = x;
    this.mesh.position.z = z;
  }

  // throttle: -1..1, steerInput: -1..1, handbrake: bool, dt seconds.
  drive(throttle, steerInput, handbrake, dt) {
    if (this.dead) { throttle = 0; }
    let top = this.model.topSpeed * (this.condition < 30 ? 0.6 : 1);
    if (this.topSpeedBoost) top *= 1.3; // pursuit units stay in the fight
    // Nitro: Shift while driving burns the gauge for more accel and top speed.
    const boosting = this.boosting && this.nitro > 0 && throttle > 0 && !this.dead;
    if (boosting) {
      top *= 1.25;
      this.nitro = Math.max(0, this.nitro - 25 * dt);
    } else {
      this.nitro = Math.min(100, this.nitro + 15 * dt);
    }
    this.speed += throttle * this.model.accel * (boosting ? 1.6 : 1) * dt;
    // Drag + rolling resistance.
    this.speed -= this.speed * (handbrake ? 1.6 : 0.35) * dt;
    if (this.speed > top) this.speed = top;
    if (this.speed < -12) this.speed = -12;
    // Steering: sharper at low speed, drift with handbrake.
    const grip = handbrake ? 0.55 : 1;
    const steerRate = 1.9 * Math.min(1, Math.abs(this.speed) / 8 + 0.25);
    this.steer += (steerInput - this.steer) * Math.min(1, dt * 8);
    this.heading -= this.steer * steerRate * grip * dt * Math.sign(this.speed || 1) * Math.min(1, Math.abs(this.speed) / 6 + 0.15);
    const fx = -Math.sin(this.heading);
    const fz = -Math.cos(this.heading);
    // Model faces local -Z (headlights at z=-2.22), so forward is (-sin h, -cos h).
    this.mesh.position.x += fx * this.speed * dt;
    this.mesh.position.z += fz * this.speed * dt;
    this.mesh.rotation.y = this.heading;
    // Wheel spin.
    for (const w of this.mesh.userData.wheels) w.rotation.x += this.speed * dt * 2.2;
    // Body roll on steering.
    this.mesh.rotation.z = -this.steer * Math.min(0.06, Math.abs(this.speed) * 0.0012);
    if (this.condition < 35 && !this.smoking) this.smoking = true;
  }

  damage(amount) {
    this.condition = Math.max(0, this.condition - amount);
    if (this.condition <= 0 && !this.dead) {
      this.dead = true;
      this.speed = 0;
    }
    return this.dead;
  }

  repair(amount) {
    this.condition = Math.min(100, this.condition + amount);
    if (this.condition > 0) this.dead = false;
    if (this.condition >= 35) this.smoking = false;
  }

  get speedKmh() { return Math.abs(this.speed) * 3.6; }
}

// Traffic: cars cruising the road grid, wrapping at the edges.
export class Traffic {
  constructor(scene, city, count = 16) {
    this.scene = scene;
    this.city = city;
    this.cars = [];
    for (let i = 0; i < count; i++) this.spawn();
  }

  spawn() {
    const model = CAR_MODELS[1 + ((Math.random() * (CAR_MODELS.length - 2)) | 0)];
    const horizontal = Math.random() < 0.5;
    let x, z, heading;
    if (horizontal) {
      const road = Math.random() < 0.3 ? BOULEVARD_Z : EW_ROADS[(Math.random() * EW_ROADS.length) | 0];
      const dir = Math.random() < 0.5 ? 1 : -1;
      x = (Math.random() * 480 - 240);
      z = road + dir * 3.5;
      heading = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    } else {
      const road = NS_ROADS[(Math.random() * NS_ROADS.length) | 0];
      const dir = Math.random() < 0.5 ? 1 : -1;
      x = road + dir * 3.5;
      z = (Math.random() * 420 - 245);
      heading = dir > 0 ? Math.PI : 0;
    }
    const car = new Car(this.scene, model, x, z, heading);
    car.cruise = 9 + Math.random() * 5;
    car.horizontal = horizontal;
    this.cars.push(car);
  }

  update(dt) {
    for (const car of this.cars) {
      if (car.dead) continue;
      // Gentle cruise with occasional slow-downs near intersections.
      const nearJunction = NS_ROADS.some((rx) => Math.abs(car.x - rx) < 8) && EW_ROADS.some((rz) => Math.abs(car.z - rz) < 8);
      const target = nearJunction && Math.random() < 0.3 ? car.cruise * 0.4 : car.cruise;
      const throttle = car.speed < target ? 0.5 : -0.2;
      car.drive(throttle, 0, false, dt);
      // Wrap around the map edges.
      if (car.x > 248) car.setPosition(-248, car.z);
      if (car.x < -248) car.setPosition(248, car.z);
      if (car.z > 248) car.setPosition(car.x, -248);
      if (car.z < -248) car.setPosition(car.x, 248);
    }
  }

  nearestTo(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of this.cars) {
      if (car.dead) continue;
      const d = Math.hypot(car.x - x, car.z - z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }
}
