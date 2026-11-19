// player.js — the player character: on-foot movement, entering and
// leaving cars, and the third-person follow camera (drag to look around).

import * as THREE from '../vendor/three.module.min.js';
import { makePedModel } from './pedestrians.js';

export class Player {
  constructor(scene, city, x, z) {
    this.scene = scene;
    this.city = city;
    this.mesh = makePedModel();
    // The hero wears the orange jacket.
    this.mesh.children[1].material = new THREE.MeshLambertMaterial({ color: 0xff7a3c });
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
    this.heading = 0;
    this.vel = { x: 0, z: 0 };
    this.speed = 0;
    this.health = 100;
    this.armour = 0;
    this.inCar = false;
    this.car = null;
    this.walkPhase = 0;
    this.camYaw = 0; // camera sits behind the player at (sin yaw, cos yaw)
    this.camPitch = 0.32;
    this.camOffsetYaw = 0;
    this.camDist = 7;
  }

  get pos() { return this.mesh.position; }
  get x() { return this.mesh.position.x; }
  get z() { return this.mesh.position.z; }

  damage(amount) {
    let rest = amount;
    if (this.armour > 0) {
      const absorbed = Math.min(this.armour, rest * 0.6);
      this.armour -= absorbed;
      rest -= absorbed;
    }
    this.health = Math.max(0, this.health - rest);
    return this.health <= 0;
  }

  heal(amount) {
    this.health = Math.min(100, this.health + amount);
  }

  // On-foot movement: input is {f, s} forward/strafe -1..1 in camera space.
  moveOnFoot(input, run, dt) {
    const speed = run ? 9 : 5;
    const sin = Math.sin(this.camYaw);
    const cos = Math.cos(this.camYaw);
    // Camera looks along (-sin yaw, -cos yaw); forward moves that way,
    // strafe moves along the right vector (cos yaw, -sin yaw).
    const mx = (-sin * input.f + cos * input.s);
    const mz = (-cos * input.f - sin * input.s);
    const len = Math.hypot(mx, mz);
    if (len > 0.01) {
      const nx = mx / len;
      const nz = mz / len;
      this.vel.x += (nx * speed - this.vel.x) * Math.min(1, dt * 10);
      this.vel.z += (nz * speed - this.vel.z) * Math.min(1, dt * 10);
      this.heading = Math.atan2(-nx, -nz);
    } else {
      this.vel.x += (0 - this.vel.x) * Math.min(1, dt * 10);
      this.vel.z += (0 - this.vel.z) * Math.min(1, dt * 10);
    }
    this.speed = Math.hypot(this.vel.x, this.vel.z);
    const pos = { x: this.x + this.vel.x * dt, z: this.z + this.vel.z * dt };
    this.city.resolveCircle(pos, 0.6);
    this.mesh.position.x = pos.x;
    this.mesh.position.z = pos.z;
    this.mesh.rotation.y = this.heading;
    // Walk cycle.
    if (this.speed > 0.5) {
      this.walkPhase += dt * (run ? 13 : 8);
      const swing = Math.sin(this.walkPhase) * 0.55;
      this.mesh.userData.armL.rotation.x = swing;
      this.mesh.userData.armR.rotation.x = -swing;
      this.mesh.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.08;
    } else {
      this.mesh.userData.armL.rotation.x = 0;
      this.mesh.userData.armR.rotation.x = 0;
      this.mesh.position.y = 0;
    }
  }

  enterCar(car) {
    this.car = car;
    this.inCar = true;
    this.mesh.visible = false;
    this.heading = car.heading;
    this.camYaw = car.heading;
    this.vel.x = 0;
    this.vel.z = 0;
  }

  exitCar() {
    if (!this.car) return;
    const car = this.car;
    // Step out to the left of the car.
    const side = { x: -Math.cos(car.heading), z: Math.sin(car.heading) };
    const px = car.x + side.x * 2.2;
    const pz = car.z + side.z * 2.2;
    const pos = { x: px, z: pz };
    this.city.resolveCircle(pos, 0.6);
    this.mesh.position.set(pos.x, 0, pos.z);
    this.mesh.visible = true;
    this.heading = car.heading;
    this.inCar = false;
    this.car = null;
    this.vel.x = 0;
    this.vel.z = 0;
  }

  // Drive the current car with arcade input.
  driveCar(throttle, steer, handbrake, dt) {
    if (!this.car) return;
    this.car.drive(throttle, steer, handbrake, dt);
    this.city.resolveCircle(this.car.mesh.position, 2.2);
    this.speed = Math.abs(this.car.speed);
    const fx = -Math.sin(this.car.heading);
    const fz = -Math.cos(this.car.heading);
    this.vel.x = fx * this.car.speed;
    this.vel.z = fz * this.car.speed;
    this.heading = this.car.heading;
    // Sync the hidden player mesh to the car so pos always means "where I am".
    this.mesh.position.set(this.car.x, 0, this.car.z);
    this.mesh.rotation.y = this.car.heading;
  }

  get carSpeedKmh() {
    return this.car ? this.car.speedKmh : 0;
  }

  // Third-person camera. In a car it swings behind the car's heading; on
  // foot it stays where the player left it (drag rotates it). Chasing the
  // heading on foot feeds back into camera-relative WASD: the heading
  // follows the movement direction, which follows the camera, so strafing
  // makes the player walk in circles instead of sidestepping.
  updateCamera(camera, dt, shake) {
    if (this.inCar) {
      const targetYaw = this.heading + this.camOffsetYaw;
      let diff = targetYaw - this.camYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.camYaw += diff * Math.min(1, dt * 3.2);
      // Offset decays back to behind-view.
      this.camOffsetYaw *= Math.max(0, 1 - dt * 0.7);
    }

    const dist = this.inCar ? 9 : 7;
    const height = this.inCar ? 3.4 : 3.2;
    const px = this.x;
    const pz = this.z;
    const cx = px + Math.sin(this.camYaw) * dist;
    const cz = pz + Math.cos(this.camYaw) * dist;
    camera.position.set(
      cx + (shake ? shake.x : 0),
      height + (shake ? shake.y : 0),
      cz
    );
    const lookX = px - Math.sin(this.camYaw) * 4 + this.vel.x * 0.25;
    const lookZ = pz - Math.cos(this.camYaw) * 4 + this.vel.z * 0.25;
    camera.lookAt(lookX, 1.4, lookZ);
    // Speed FOV kick in a car (a little extra while boosting).
    let targetFov = this.inCar ? 60 + Math.min(14, this.carSpeedKmh * 0.1) : 60;
    if (this.inCar && this.car && this.car.boosting && this.car.nitro > 0) targetFov += 6;
    if (Math.abs(camera.fov - targetFov) > 0.1) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 4);
      camera.updateProjectionMatrix();
    }
  }
}
