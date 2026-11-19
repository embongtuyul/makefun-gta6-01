// missions.js — the story of SOLMARA: six staged jobs from Selma the fixer,
// with objectives, markers, dialogue and pay. The job system drives the
// beacon, the minimap blip and the HUD mission box.

import * as THREE from '../vendor/three.module.min.js';
import { Car, CAR_MODELS } from './vehicles.js';
import { BOULEVARD_Z } from './city.js';

export const JOBS = [
  {
    title: 'JOB 1 · FIRST FARE',
    giver: 'SELMA',
    intro: 'New in town, kid? Drive Dana from the cab rank to the Marina. No scratches, no cops. Easy money.',
    pay: 500, rp: 200,
    stages: [
      { name: 'PICK UP DANA', type: 'goto', x: -60, z: 163, radius: 9,
        objective: 'Drive to the pickup point on Strand Boulevard.',
        next: 'Dana at the Coral Strand cab rank',
        line: ['DANA', 'You must be the new wheel. Marina, and step on it — I hate the 5 o\'clock crowd.'] },
      { name: 'DROP AT THE MARINA', type: 'goto', x: 180, z: 120, radius: 9,
        objective: 'Deliver Dana to the Marina before the yacht sails.',
        next: 'Yacht Row, east end',
        line: ['DANA', 'Not bad. Selma picks good drivers. Tell her I said thanks.'] },
      { name: 'REPORT TO SELMA', type: 'goto', x: 0, z: 140, radius: 9,
        objective: 'Head back to Selma\'s spot on the Strand and collect your pay.',
        next: 'Selma waits by the palms',
        line: ['SELMA', 'First fare, clean run. There\'s more where that came from — much more.'] },
    ],
  },
  {
    title: 'JOB 2 · BORROWED WHEELS',
    giver: 'SELMA',
    intro: 'A Volta Coupe is parked uptown with the keys in it. Borrow it, shake the heat, bring it to Bram\'s garage.',
    pay: 800, rp: 300,
    stages: [
      { name: 'STEAL THE COUPE', type: 'enterCar', x: 70, z: 60, radius: 6, carModel: 2,
        objective: 'Steal the yellow Volta Coupe parked on Meridian Avenue.',
        next: 'Walk up and press E',
        line: ['SELMA', 'That\'s the one. Don\'t look at the cameras. Actually, do — smile.'] },
      { name: 'SHAKE THE HEAT', type: 'loseHeat',
        objective: 'Lose the cops: break line of sight until the wanted level clears.',
        next: 'Hide, or call Dana (Z)',
        line: ['JUNO', 'Eyes out — two units on your tail. Duck behind the towers and go dark.'] },
      { name: 'DELIVER TO BRAM', type: 'goto', x: -140, z: 70, radius: 9,
        objective: 'Deliver the Coupe to Bram\'s garage in Old Port.',
        next: 'Bram\'s garage, Harbour Road',
        line: ['BRAM', 'Sweet. New plates, new paint, new life. You drive, I make it disappear.'] },
    ],
  },
  {
    title: 'JOB 3 · HEAT RUN',
    giver: 'SELMA',
    intro: 'Kade\'s boys tipped the PD. They want you in a cell tonight — survive the heat, then meet Juno at the pier.',
    pay: 1200, rp: 450,
    stages: [
      { name: 'SURVIVE THE MANHUNT', type: 'survive', seconds: 75, wanted: 3,
        objective: 'Survive 75 seconds at 3 stars. Keep moving — never stop.',
        next: 'Use the towers for cover',
        line: ['DISPATCH', 'All units: suspect vehicle, Coral Strand. Air unit overhead. Do not let them reach the pier.'] },
      { name: 'MEET JUNO', type: 'goto', x: 120, z: 220, radius: 9,
        objective: 'The heat is off. Meet Juno at the end of Coral Pier.',
        next: 'Pier end, past the hut',
        line: ['JUNO', 'You outran a helicopter. Selma owes me twenty bucks — I said you would.'] },
    ],
  },
  {
    title: 'JOB 4 · WRECK THE ONYX',
    giver: 'SELMA',
    intro: 'Silas Kade is leaving town in his black Onyx. Wreck it before it reaches the pier — he does not get to sail away.',
    pay: 2000, rp: 700,
    stages: [
      { name: 'INTERCEPT THE ONYX', type: 'goto', x: 0, z: 175, radius: 12,
        objective: 'Get onto Strand Boulevard and find Silas Kade\'s black Onyx.',
        next: 'The Onyx heads east',
        line: ['JUNO', 'There he is — black Onyx, eastbound. Ram him. Hard.'] },
      { name: 'WRECK THE ONYX', type: 'ram', target: 'onyx',
        objective: 'Ram Silas Kade\'s Onyx until it is wrecked — before it reaches the pier.',
        next: 'Hit it from the side',
        line: ['SILAS KADE', 'You think a dent stops me? I own this city\'s harbour!'] },
    ],
  },
  {
    title: 'JOB 5 · PIER LIGHTS RACE',
    giver: 'DANA',
    intro: 'Street race, boulevard to boulevard, six gates. Beat the clock and the pack takes notice.',
    pay: 1500, rp: 550,
    stages: [
      { name: 'RACE THE BOULEVARD', type: 'race', seconds: 150,
        checkpoints: [
          { x: -210, z: 175 }, { x: -70, z: 175 }, { x: 70, z: 175 }, { x: 210, z: 175 },
          { x: 210, z: 70 }, { x: 120, z: 220 },
        ],
        objective: 'Hit all 6 gates before the clock runs out.',
        next: 'Gate 1 is west — go!',
        line: ['DANA', 'Six gates, two minutes thirty. Show them what that GT can do.'] },
    ],
  },
  {
    title: 'JOB 6 · SOLMARA NIGHTS',
    giver: 'SELMA',
    intro: 'Last job. Pick up the crew, then run a five-star manhunt to the airstrip. The plane leaves with or without you.',
    pay: 5000, rp: 1200,
    stages: [
      { name: 'PICK UP THE CREW', type: 'goto', x: 0, z: 140, radius: 9,
        objective: 'Pick up Dana, Bram and Juno at Selma\'s spot.',
        next: 'The crew waits by the palms',
        line: ['DANA', 'All in. Bram, Juno — let\'s go home.'] },
      { name: 'RUN TO THE AIRSTRIP', type: 'escape', x: 225, z: -180, radius: 14, wanted: 5,
        objective: 'Outrun a 5-star manhunt and reach the airstrip in the north-east.',
        next: 'The plane is on the strip',
        line: ['SELMA', 'Five stars and a helicopter. Fly, kid. Solmara will remember you.'] },
    ],
  },
];

export class MissionManager {
  constructor(scene, city, ctx) {
    this.scene = scene;
    this.city = city;
    this.ctx = ctx; // { player, police, hud, audio, traffic, onJobComplete, onMissionFailed }
    this.jobIndex = 0;
    this.stageIndex = 0;
    this.active = false;
    this.stageTimer = 0;
    this.raceIndex = 0;
    this.targetCar = null;
    this.targetWaypoints = [];
    this.raceRivals = [];
    this.beacon = null;
    this.beaconRing = null;
    this.makeBeacon();
  }

  makeBeacon() {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd94d, transparent: true, opacity: 0.35, depthWrite: false });
    this.beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 60, 16, 1, true), mat);
    this.beacon.visible = false;
    this.scene.add(this.beacon);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd94d, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
    this.beaconRing = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.4, 24), ringMat);
    this.beaconRing.rotation.x = -Math.PI / 2;
    this.beaconRing.visible = false;
    this.scene.add(this.beaconRing);
  }

  currentJob() { return JOBS[this.jobIndex] || null; }
  currentStage() {
    const job = this.currentJob();
    return job ? job.stages[this.stageIndex] : null;
  }

  startJob(index) {
    this.jobIndex = index;
    this.stageIndex = 0;
    this.active = true;
    this.raceIndex = 0;
    this.stageTimer = 0;
    // Clear references to the previous job's cars: a restarted job must not
    // keep steering a wrecked Onyx or dead race rivals from the last run.
    this.targetCar = null;
    this.targetWaypoints = [];
    this.raceRivals = [];
    const job = this.currentJob();
    if (!job) { this.active = false; return; }
    this.ctx.hud.toast(`${job.title} — ${job.giver}`);
    this.ctx.hud.say(job.giver, job.intro);
    this.beginStage();
  }

  beginStage() {
    const stage = this.currentStage();
    if (!stage) { this.completeJob(); return; }
    this.stageTimer = stage.seconds || 0;
    if (stage.line) this.ctx.hud.say(stage.line[0], stage.line[1]);
    if (stage.wanted) this.ctx.police.setWanted(stage.wanted);
    if (stage.type === 'enterCar') this.spawnJobCar(stage);
    if (stage.type === 'ram') this.spawnOnyx();
    if (stage.type === 'race') this.spawnRivals();
    this.updateBeacon();
  }

  spawnJobCar(stage) {
    // A second startJob for the same stage must not spawn a duplicate car:
    // the player would enter the first one while carRef points at the
    // second and the stage could never advance.
    if (stage.carRef && !stage.carRef.dead) return;
    const model = CAR_MODELS[stage.carModel || 2];
    const car = new Car(this.scene, model, stage.x, stage.z, Math.PI / 2);
    car.jobCar = true;
    this.ctx.jobCars = this.ctx.jobCars || [];
    this.ctx.jobCars.push(car);
    stage.carRef = car;
  }

  spawnOnyx() {
    const car = new Car(this.scene, CAR_MODELS[6], -140, BOULEVARD_Z - 3.5, -Math.PI / 2);
    car.jobCar = true;
    car.condition = 100;
    this.targetCar = car;
    this.targetWaypoints = [
      { x: -70, z: BOULEVARD_Z - 3.5 }, { x: 0, z: BOULEVARD_Z - 3.5 },
      { x: 70, z: BOULEVARD_Z - 3.5 }, { x: 120, z: BOULEVARD_Z - 3.5 }, { x: 120, z: 220 },
    ];
    this.ctx.jobCars = this.ctx.jobCars || [];
    this.ctx.jobCars.push(car);
  }

  spawnRivals() {
    const models = [CAR_MODELS[2], CAR_MODELS[0], CAR_MODELS[4]];
    this.raceRivals = models.map((m, i) => {
      const car = new Car(this.scene, m, -20 - i * 5, BOULEVARD_Z + 3.5 + i * 2, -Math.PI / 2);
      car.jobCar = true;
      this.ctx.jobCars = this.ctx.jobCars || [];
      this.ctx.jobCars.push(car);
      return { car, wp: 0, speed: 24 + i * 2 };
    });
  }

  updateBeacon() {
    const stage = this.currentStage();
    let tx = null;
    let tz = null;
    if (stage) {
      if (stage.type === 'race') {
        const cp = stage.checkpoints[Math.min(this.raceIndex, stage.checkpoints.length - 1)];
        tx = cp.x; tz = cp.z;
      } else if (stage.type === 'ram' && this.targetCar) {
        tx = this.targetCar.x; tz = this.targetCar.z;
      } else if (typeof stage.x === 'number') {
        tx = stage.x; tz = stage.z;
      }
    }
    const show = this.active && tx !== null;
    this.beacon.visible = show;
    this.beaconRing.visible = show;
    if (show) {
      this.beacon.position.set(tx, 30, tz);
      this.beaconRing.position.set(tx, 0.15, tz);
    }
    this.targetPos = show ? { x: tx, z: tz } : null;
  }

  // Distance from the player to the current objective (for HUD + minimap).
  targetDistance(playerPos) {
    if (!this.targetPos) return null;
    return Math.round(Math.hypot(this.targetPos.x - playerPos.x, this.targetPos.z - playerPos.z));
  }

  advanceStage() {
    this.ctx.audio.cashRegister();
    this.stageIndex++;
    this.raceIndex = 0;
    if (this.stageIndex >= this.currentJob().stages.length) {
      this.completeJob();
    } else {
      this.beginStage();
    }
  }

  completeJob() {
    const job = this.currentJob();
    this.active = false;
    this.beacon.visible = false;
    this.beaconRing.visible = false;
    this.targetPos = null;
    this.ctx.audio.missionSting(true);
    this.ctx.hud.centerMessage('JOB DONE', `+$${job.pay.toLocaleString()}  ·  +${job.rp} RP`, 'good');
    this.ctx.onJobComplete && this.ctx.onJobComplete(job);
  }

  failJob(reason) {
    this.active = false;
    this.beacon.visible = false;
    this.beaconRing.visible = false;
    this.targetPos = null;
    this.ctx.audio.missionSting(false);
    this.ctx.hud.centerMessage('JOB FAILED', reason, 'bad');
    this.ctx.onMissionFailed && this.ctx.onMissionFailed(reason);
  }

  steerToward(car, tx, tz, dt, speed) {
    const dx = tx - car.x;
    const dz = tz - car.z;
    const dist = Math.hypot(dx, dz);
    const desired = Math.atan2(-dx, -dz);
    let diff = desired - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    // NEGATIVE diff: drive() subtracts steer from the heading (see police.js).
    const steer = Math.max(-1, Math.min(1, -diff * 2.0));
    car.drive(car.speed < speed ? 0.8 : 0, steer, false, dt);
    this.city.resolveCircle(car.mesh.position, 2.4);
    return dist;
  }

  update(dt, player) {
    // Beacon pulse.
    if (this.beacon.visible) {
      const s = 1 + Math.sin(performance.now() / 300) * 0.12;
      this.beacon.scale.set(s, 1, s);
      this.beaconRing.scale.set(s, s, 1);
    }
    if (!this.active) return;
    const stage = this.currentStage();
    if (!stage) return;

    // Onyx drives toward the pier; fail if it arrives.
    if (this.targetCar && !this.targetCar.dead) {
      const wp = this.targetWaypoints[0];
      if (wp) {
        const d = this.steerToward(this.targetCar, wp.x, wp.z, dt, 20);
        if (d < 8) this.targetWaypoints.shift();
      } else {
        this.failJob('Silas reached the pier and sailed away.');
        return;
      }
      this.updateBeacon();
    }

    // Rivals run the race route.
    if (stage.type === 'race') {
      for (const r of this.raceRivals) {
        const cp = stage.checkpoints[Math.min(r.wp, stage.checkpoints.length - 1)];
        if (cp) {
          const d = this.steerToward(r.car, cp.x, cp.z, dt, r.speed);
          if (d < 9) r.wp++;
        }
      }
    }

    switch (stage.type) {
      case 'goto':
      case 'deliver':
      case 'escape': {
        const d = Math.hypot(player.pos.x - stage.x, player.pos.z - stage.z);
        if (d < stage.radius) this.advanceStage();
        break;
      }
      case 'enterCar': {
        if (player.inCar && player.car === stage.carRef) {
          this.ctx.police.addWanted(1);
          this.advanceStage();
        }
        break;
      }
      case 'loseHeat': {
        if (this.ctx.police.wanted === 0) this.advanceStage();
        break;
      }
      case 'survive': {
        this.stageTimer -= dt;
        if (this.stageTimer <= 0) {
          this.ctx.police.setWanted(0);
          this.advanceStage();
        }
        break;
      }
      case 'ram': {
        if (this.targetCar && this.targetCar.dead) {
          this.ctx.police.addWanted(1);
          this.advanceStage();
        }
        break;
      }
      case 'race': {
        this.stageTimer -= dt;
        const cp = stage.checkpoints[this.raceIndex];
        if (cp && Math.hypot(player.pos.x - cp.x, player.pos.z - cp.z) < 12) {
          this.raceIndex++;
          this.ctx.audio.click();
          this.ctx.hud.toast(`GATE ${this.raceIndex}/${stage.checkpoints.length}`);
          if (this.raceIndex >= stage.checkpoints.length) {
            this.advanceStage();
            return;
          }
          this.updateBeacon();
        }
        if (this.stageTimer <= 0) {
          this.failJob('Out of time on the race.');
        }
        break;
      }
      default:
        break;
    }
  }
}
