// combat.js — weapons, shooting and damage. Hitscan raycasts from the
// camera; fists are a short-range melee swing. Shooting in public raises
// the wanted level, and hitting police raises it faster.

import * as THREE from '../vendor/three.module.min.js';

export const WEAPONS = [
  { key: '1', name: 'FISTS', icon: '\u270A', damage: 25, range: 2.6, rate: 0.45, mag: Infinity, reserve: Infinity, auto: false, spread: 0 },
  { key: '2', name: 'PISTOL', icon: '\uD83D\uDD2B', damage: 34, range: 70, rate: 0.28, mag: 12, reserve: 60, auto: false, spread: 0.012 },
  { key: '3', name: 'SMG', icon: '\u26A1', damage: 20, range: 55, rate: 0.09, mag: 30, reserve: 120, auto: true, spread: 0.03 },
  { key: '4', name: 'SHOTGUN', icon: '\uD83D\uDCA5', damage: 18, range: 28, rate: 0.8, mag: 6, reserve: 24, auto: false, spread: 0.09, pellets: 6 },
  { key: '5', name: 'RIFLE', icon: '\uD83C\uDFAF', damage: 55, range: 120, rate: 0.16, mag: 30, reserve: 90, auto: true, spread: 0.006 },
];

export class Combat {
  constructor(scene, effects, audio) {
    this.scene = scene;
    this.effects = effects;
    this.audio = audio;
    this.raycaster = new THREE.Raycaster();
    this.selected = 1; // pistol by default
    this.ammo = WEAPONS.map((w) => ({ mag: w.mag, reserve: w.reserve }));
    this.cooldown = 0;
    this.tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9 });
    this.tracers = [];
  }

  currentWeapon() { return WEAPONS[this.selected]; }
  currentAmmo() { return this.ammo[this.selected]; }

  select(index) {
    if (index >= 0 && index < WEAPONS.length) {
      this.selected = index;
      this.audio.click();
    }
  }

  reload() {
    const w = this.currentWeapon();
    const a = this.currentAmmo();
    if (!isFinite(w.mag) || a.mag >= w.mag || a.reserve <= 0) return false;
    const need = w.mag - a.mag;
    const take = Math.min(need, a.reserve);
    a.mag += take;
    a.reserve -= take;
    this.audio.click();
    return true;
  }

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        this.tracers.splice(i, 1);
      } else {
        t.line.material.opacity = t.life / 0.09;
      }
    }
  }

  addTracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, this.tracerMat.clone());
    this.scene.add(line);
    this.tracers.push({ line, life: 0.09 });
  }

  // Fire from the camera toward the crosshair. Targets: peds, cars, police.
  // Returns { hit: 'ped'|'car'|'police'|'world'|null, target }.
  fire(camera, origin, targets, onCrime) {
    const w = this.currentWeapon();
    if (this.cooldown > 0) return null;
    const a = this.currentAmmo();
    if (isFinite(w.mag) && a.mag <= 0) {
      this.audio.click();
      this.cooldown = 0.3;
      return { hit: 'empty' };
    }
    this.cooldown = w.rate;
    if (isFinite(w.mag)) a.mag--;

    if (w.name === 'FISTS') {
      this.audio.punch();
      const ped = targets.peds.nearestTo(origin.x, origin.z, w.range);
      if (ped) {
        ped.damage(w.damage);
        this.effects.blood(ped.x, 1.2, ped.z);
        onCrime && onCrime('assault');
        return { hit: 'ped', target: ped };
      }
      return { hit: null };
    }

    this.audio.gunshot(w.name === 'SHOTGUN' || w.name === 'RIFLE');
    const pellets = w.pellets || 1;
    let best = { hit: null };
    for (let i = 0; i < pellets; i++) {
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      dir.x += (Math.random() - 0.5) * w.spread * 2;
      dir.y += (Math.random() - 0.5) * w.spread * 2;
      dir.z += (Math.random() - 0.5) * w.spread * 2;
      dir.normalize();
      this.raycaster.set(camera.position, dir);
      this.raycaster.far = w.range;
      const from = camera.position.clone();
      const end = from.clone().add(dir.clone().multiplyScalar(w.range));
      this.addTracer(from, end);

      // Muzzle flash at the camera.
      this.effects.muzzle(from.x + dir.x * 1.2, from.y + dir.y * 1.2 - 0.2, from.z + dir.z * 1.2);

      // Test peds (sphere at torso).
      let hitDist = w.range;
      let hitKind = null;
      let hitTarget = null;
      for (const ped of targets.peds.peds) {
        if (ped.state === 'down') continue;
        const center = new THREE.Vector3(ped.x, 1.1, ped.z);
        const toPed = center.clone().sub(from);
        const along = toPed.dot(dir);
        if (along < 0 || along > hitDist) continue;
        const closest = from.clone().add(dir.clone().multiplyScalar(along));
        if (closest.distanceTo(center) < 0.9) {
          hitDist = along;
          hitKind = 'ped';
          hitTarget = ped;
        }
      }
      // Test cars (sphere at center, radius 2.4).
      const allCars = [...targets.traffic.cars, ...(targets.jobCars || []), ...targets.police.units.map((u) => u.car)];
      for (const car of allCars) {
        if (car.dead) continue;
        const center = new THREE.Vector3(car.x, 0.9, car.z);
        const toCar = center.clone().sub(from);
        const along = toCar.dot(dir);
        if (along < 0 || along > hitDist) continue;
        const closest = from.clone().add(dir.clone().multiplyScalar(along));
        if (closest.distanceTo(center) < 2.6) {
          hitDist = along;
          hitKind = car.police ? 'police' : 'car';
          hitTarget = car;
        }
      }
      if (hitKind === 'ped') {
        hitTarget.damage(w.damage);
        this.effects.blood(hitTarget.x, 1.2, hitTarget.z);
        targets.peds.scare(hitTarget.x, hitTarget.z, 25);
        onCrime && onCrime('assault');
        best = { hit: 'ped', target: hitTarget };
      } else if (hitKind === 'car' || hitKind === 'police') {
        const died = hitTarget.damage(w.damage * 0.6);
        this.effects.sparks(hitTarget.x, 1, hitTarget.z);
        if (died) {
          this.effects.explosion(hitTarget.x, 0.5, hitTarget.z);
          this.audio.crash();
        }
        onCrime && onCrime(hitKind === 'police' ? 'copHit' : 'property');
        best = { hit: hitKind, target: hitTarget };
      }
    }
    onCrime && onCrime('shotFired');
    return best;
  }
}
