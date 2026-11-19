// pedestrians.js — low-poly citizens walking Solmara's sidewalks.
// They stroll along road edges, stop and chat, and flee from gunfire.

import * as THREE from '../vendor/three.module.min.js';
import { NS_ROADS, EW_ROADS, BOULEVARD_Z } from './city.js';

const SHIRTS = [0xff8a5a, 0x5ab8ff, 0x9be07a, 0xffd94d, 0xc9a0ff, 0xffffff, 0xff6a8a, 0x5ad8c9];
const PANTS = [0x2a2a3a, 0x4a3a2a, 0x3a4a6a, 0x5a5a5a];
const SKINS = [0xf2c9a0, 0xc98a5a, 0x8a5a3a, 0xf2e0c9];

export function makePedModel() {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: SHIRTS[(Math.random() * SHIRTS.length) | 0] });
  const pants = new THREE.MeshLambertMaterial({ color: PANTS[(Math.random() * PANTS.length) | 0] });
  const skin = new THREE.MeshLambertMaterial({ color: SKINS[(Math.random() * SKINS.length) | 0] });

  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.8, 0.3), pants);
  legs.position.y = 0.4;
  g.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.32), shirt);
  torso.position.y = 1.15;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
  head.position.y = 1.78;
  g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8, 0, Math.PI * 2, 0, 1.4), new THREE.MeshLambertMaterial({ color: 0x2a1a12 }));
  hair.position.y = 1.82;
  g.add(hair);
  // Arms swing while walking.
  const armGeo = new THREE.BoxGeometry(0.14, 0.62, 0.14);
  const armL = new THREE.Mesh(armGeo, shirt);
  armL.position.set(-0.36, 1.15, 0);
  g.add(armL);
  const armR = new THREE.Mesh(armGeo, shirt);
  armR.position.set(0.36, 1.15, 0);
  g.add(armR);
  g.userData.armL = armL;
  g.userData.armR = armR;
  g.userData.legs = legs;
  return g;
}

class Ped {
  constructor(scene, x, z) {
    this.mesh = makePedModel();
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
    this.heading = Math.random() * Math.PI * 2;
    this.speed = 1.1 + Math.random() * 0.7;
    this.state = 'walk'; // walk | idle | flee | down
    this.timer = 2 + Math.random() * 6;
    this.walkPhase = Math.random() * 10;
    this.health = 100;
  }

  get x() { return this.mesh.position.x; }
  get z() { return this.mesh.position.z; }

  fleeFrom(x, z) {
    if (this.state === 'down') return;
    this.state = 'flee';
    this.heading = Math.atan2(-(this.x - x), -(this.z - z));
    this.timer = 3 + Math.random() * 2;
  }

  damage(amount) {
    this.health -= amount;
    if (this.health <= 0 && this.state !== 'down') {
      this.state = 'down';
      this.mesh.rotation.x = Math.PI / 2;
      this.mesh.position.y = 0.3;
      return true;
    }
    return false;
  }

  update(dt, city) {
    if (this.state === 'down') return;
    this.timer -= dt;
    if (this.timer <= 0) {
      if (this.state === 'flee') {
        this.state = 'walk';
        this.heading = Math.random() * Math.PI * 2;
        this.timer = 4 + Math.random() * 6;
      } else if (this.state === 'walk') {
        if (Math.random() < 0.3) {
          this.state = 'idle';
          this.timer = 2 + Math.random() * 4;
        } else {
          // Turn onto a new sidewalk direction.
          this.heading = Math.round((Math.random() * 4)) * (Math.PI / 2) + (Math.random() - 0.5) * 0.4;
          this.timer = 4 + Math.random() * 6;
        }
      } else {
        this.state = 'walk';
        this.timer = 4 + Math.random() * 6;
      }
    }
    if (this.state === 'walk' || this.state === 'flee') {
      const speed = this.state === 'flee' ? this.speed * 3.2 : this.speed;
      const nx = this.x - Math.sin(this.heading) * speed * dt;
      const nz = this.z - Math.cos(this.heading) * speed * dt;
      // Keep peds on sidewalks: steer away from building interiors and roads.
      const pos = { x: nx, z: nz };
      city.resolveCircle(pos, 0.6);
      this.mesh.position.x = pos.x;
      this.mesh.position.z = pos.z;
      if (pos.x !== nx || pos.z !== nz) this.heading += Math.PI / 2;
      // Walk-cycle arm swing.
      this.walkPhase += dt * (this.state === 'flee' ? 14 : 7);
      const swing = Math.sin(this.walkPhase) * 0.5;
      this.mesh.userData.armL.rotation.x = swing;
      this.mesh.userData.armR.rotation.x = -swing;
      this.mesh.rotation.y = this.heading;
    }
  }
}

export class Pedestrians {
  constructor(scene, city, count = 26) {
    this.scene = scene;
    this.city = city;
    this.peds = [];
    for (let i = 0; i < count; i++) {
      // Spawn on sidewalks: beside a road, not on it.
      const horizontal = Math.random() < 0.5;
      let x, z;
      if (horizontal) {
        const road = Math.random() < 0.4 ? BOULEVARD_Z : EW_ROADS[(Math.random() * EW_ROADS.length) | 0];
        x = Math.random() * 480 - 240;
        z = road + (Math.random() < 0.5 ? -1 : 1) * (9 + Math.random() * 3);
      } else {
        const road = NS_ROADS[(Math.random() * NS_ROADS.length) | 0];
        x = road + (Math.random() < 0.5 ? -1 : 1) * (9 + Math.random() * 3);
        z = Math.random() * 420 - 245;
      }
      // Beach strollers.
      if (Math.random() < 0.25) {
        x = Math.random() * 460 - 230;
        z = 195 + Math.random() * 25;
      }
      this.peds.push(new Ped(scene, x, z));
    }
  }

  update(dt) {
    for (const p of this.peds) p.update(dt, this.city);
  }

  scare(x, z, radius) {
    for (const p of this.peds) {
      if (Math.hypot(p.x - x, p.z - z) < radius) p.fleeFrom(x, z);
    }
  }

  nearestTo(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const p of this.peds) {
      if (p.state === 'down') continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  countDown() {
    return this.peds.filter((p) => p.state === 'down').length;
  }
}
