// effects.js — particles and feedback: muzzle flashes, smoke, sparks,
// explosions and skid marks. All pooled, all plain three.js meshes.

import * as THREE from '../vendor/three.module.min.js';

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.pool = [];
    const geo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    this.geo = geo;
    this.shake = 0;
  }

  spawn(x, y, z, color, count, speed, life, up = 2, scaleMax = 2.0) {
    for (let i = 0; i < count; i++) {
      let p = this.pool.pop();
      if (!p) {
        p = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }));
        this.scene.add(p);
      }
      p.material.color.setHex(color);
      p.material.opacity = 1;
      p.visible = true;
      p.position.set(x, y, z);
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      p.userData.vx = Math.cos(a) * s;
      p.userData.vz = Math.sin(a) * s;
      p.userData.vy = up * (0.4 + Math.random());
      p.userData.life = life * (0.6 + Math.random() * 0.7);
      p.userData.maxLife = p.userData.life;
      p.scale.setScalar(0.6 + Math.random() * (scaleMax - 0.6));
      this.particles.push(p);
    }
  }

  // Small, rising smoke so it never looms in front of the chase camera.
  smoke(x, y, z) { this.spawn(x, y + 0.6, z, 0x555560, 2, 0.8, 1.4, 2.5, 0.9); }
  sparks(x, y, z) { this.spawn(x, y, z, 0xffd94d, 6, 5, 0.4, 3); }
  blood(x, y, z) { this.spawn(x, y, z, 0xaa2222, 5, 2, 0.5, 1.5); }
  muzzle(x, y, z) { this.spawn(x, y, z, 0xffe9a0, 3, 3, 0.12, 0.5); }

  explosion(x, y, z) {
    this.spawn(x, y + 1, z, 0xff7a2a, 26, 7, 0.9, 5);
    this.spawn(x, y + 1, z, 0x555560, 18, 3, 1.8, 4);
    this.spawn(x, y + 1, z, 0xffd94d, 12, 9, 0.5, 4);
    this.shake = Math.min(1, this.shake + 0.7);
  }

  addShake(amount) {
    this.shake = Math.min(1, this.shake + amount);
  }

  update(dt) {
    this.shake = Math.max(0, this.shake - dt * 1.8);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.userData.life -= dt;
      if (p.userData.life <= 0) {
        p.visible = false;
        this.pool.push(p);
        this.particles.splice(i, 1);
        continue;
      }
      p.position.x += p.userData.vx * dt;
      p.position.y += p.userData.vy * dt;
      p.position.z += p.userData.vz * dt;
      p.userData.vy -= 4 * dt;
      p.material.opacity = p.userData.life / p.userData.maxLife;
    }
  }

  // Camera shake offset, decays with the shake value.
  shakeOffset() {
    const s = this.shake * this.shake * 0.5;
    return { x: (Math.random() - 0.5) * s, y: (Math.random() - 0.5) * s };
  }
}
