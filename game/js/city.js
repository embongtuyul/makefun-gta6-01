// city.js — the procedural city of Solmara: a low-poly golden-hour coastal
// city with a road grid, downtown towers, a beach boulevard, palms, a pier
// and an ocean. Layout is seeded so every run builds the same city.

import * as THREE from '../vendor/three.module.min.js';

export const WORLD = { minX: -250, maxX: 250, minZ: -250, maxZ: 250 };
export const ROAD_WIDTH = 14;
export const NS_ROADS = [-210, -140, -70, 0, 70, 140, 210];
export const EW_ROADS = [-210, -140, -70, 0, 70, 140];
export const BOULEVARD_Z = 175;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeWindowTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#2a2438';
  g.fillRect(0, 0, 64, 128);
  const lit = ['#ffd98a', '#ffe9b0', '#ffb86b', '#9fd8ff'];
  for (let y = 6; y < 122; y += 12) {
    for (let x = 6; x < 58; x += 12) {
      if (Math.random() < 0.55) {
        g.fillStyle = lit[(Math.random() * lit.length) | 0];
        g.fillRect(x, y, 8, 7);
      } else {
        g.fillStyle = '#17131f';
        g.fillRect(x, y, 8, 7);
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSkyTexture() {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#2b1b4d');
  grad.addColorStop(0.35, '#7b2d8e');
  grad.addColorStop(0.62, '#e85d75');
  grad.addColorStop(0.82, '#ff9a5a');
  grad.addColorStop(1.0, '#ffd98a');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const DISTRICTS = [
  { name: 'CORAL STRAND', street: 'Strand Boulevard', standing: 58, test: (x, z) => z > 140 },
  { name: 'OLD PORT', street: 'Harbour Road', standing: 41, test: (x, z) => x < -140 && z <= 140 },
  { name: 'DOWNTOWN', street: 'Meridian Avenue', standing: 66, test: (x, z) => x >= -70 && x <= 70 && z < -70 },
  { name: 'MARINA', street: 'Yacht Row', standing: 52, test: (x, z) => x > 140 && z > 70 && z <= 140 },
  { name: 'THE HILLS', street: 'Vista Drive', standing: 34, test: (x, z) => z < -140 },
  { name: 'MIDTOWN', street: 'Solmara Avenue', standing: 47, test: () => true },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (d.test(x, z)) return d;
  }
  return DISTRICTS[DISTRICTS.length - 1];
}

export function buildCity(scene) {
  const rng = mulberry32(20261119);
  const city = {
    buildings: [],
    palms: [],
    lamps: [],
    roadMeshes: [],
    ocean: null,
    sunLight: null,
  };

  // Sky dome: vertical sunset gradient.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 24, 16),
    new THREE.MeshBasicMaterial({ map: makeSkyTexture(), side: THREE.BackSide, fog: false })
  );
  scene.add(sky);

  // Warm haze.
  scene.fog = new THREE.Fog(0xe88a6a, 180, 700);

  // Lights: low warm sun + soft ambient.
  const sun = new THREE.DirectionalLight(0xffb27a, 2.4);
  sun.position.set(-180, 120, 320);
  scene.add(sun);
  city.sunLight = sun;
  scene.add(new THREE.HemisphereLight(0xffd9b0, 0x3a2a4a, 1.1));

  // Sun disc over the ocean.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(34, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false })
  );
  sunDisc.position.set(-60, 46, 620);
  sunDisc.lookAt(0, 46, 0);
  scene.add(sunDisc);

  // Ground base.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(520, 520),
    new THREE.MeshLambertMaterial({ color: 0x8a7a68 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -20);
  scene.add(ground);

  // Sand + ocean (south edge).
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(520, 60),
    new THREE.MeshLambertMaterial({ color: 0xf2d8a0 })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.05, 215);
  scene.add(sand);
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(1200, 400),
    new THREE.MeshLambertMaterial({ color: 0x2e7f9e, transparent: true, opacity: 0.94 })
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, 0.02, 440);
  scene.add(ocean);
  city.ocean = ocean;

  // Roads: dark asphalt strips. Center dashes are one InstancedMesh
  // (hundreds of dashes, a single draw call).
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x33323e });
  const dashTransforms = [];
  function addRoad(x, z, w, d, horizontal) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(w, d), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(x, 0.08, z);
    scene.add(road);
    city.roadMeshes.push(road);
    const len = horizontal ? w : d;
    const n = Math.floor(len / 12);
    for (let i = 0; i < n; i++) {
      const t = -len / 2 + 6 + i * 12;
      dashTransforms.push({
        x: horizontal ? x + t : x,
        z: horizontal ? z : z + t,
        horizontal,
      });
    }
  }
  for (const x of NS_ROADS) addRoad(x, -35, ROAD_WIDTH, 430, false);
  for (const z of EW_ROADS) addRoad(0, z, 500, ROAD_WIDTH, true);
  addRoad(0, BOULEVARD_Z, 500, 20, true);
  {
    const dashGeo = new THREE.PlaneGeometry(5, 0.7);
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xffd94d });
    const dashes = new THREE.InstancedMesh(dashGeo, dashMat, dashTransforms.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3(1, 1, 1);
    dashTransforms.forEach((d, i) => {
      e.set(-Math.PI / 2, 0, d.horizontal ? 0 : Math.PI / 2);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(d.x, 0.1, d.z), q, s);
      dashes.setMatrixAt(i, m);
    });
    dashes.instanceMatrix.needsUpdate = true;
    scene.add(dashes);
  }

  // Buildings: fill the blocks between roads.
  const windowTex = makeWindowTexture();
  const palette = [0xd8b8a0, 0xc9d6dd, 0xe8c8c8, 0xb8c8b0, 0xd8d0b8, 0xa8b8d8, 0xe8b8a0];
  const blockXs = [-175, -105, -35, 35, 105, 175];
  const blockZs = [-175, -105, -35, 35, 105];
  for (const bx of blockXs) {
    for (const bz of blockZs) {
      const downtown = Math.abs(bx) <= 70 && bz < -70;
      const count = downtown ? 1 : 1 + ((rng() * 2) | 0);
      for (let k = 0; k < count; k++) {
        const w = downtown ? 44 : 16 + rng() * 22;
        const d = downtown ? 44 : 16 + rng() * 22;
        const h = downtown ? 55 + rng() * 70 : 10 + rng() * 26;
        const ox = count === 1 ? 0 : (k - 0.5) * 26;
        const oz = count === 1 ? 0 : (rng() - 0.5) * 10;
        const x = bx + ox;
        const z = bz + oz;
        const color = palette[(rng() * palette.length) | 0];
        const mat = new THREE.MeshLambertMaterial({
          color,
          emissive: 0xffca7a,
          emissiveMap: windowTex,
          emissiveIntensity: 0.55,
        });
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        b.position.set(x, h / 2, z);
        scene.add(b);
        // Rooftop box.
        if (rng() < 0.6) {
          const roof = new THREE.Mesh(
            new THREE.BoxGeometry(w * 0.4, 3, d * 0.4),
            new THREE.MeshLambertMaterial({ color: 0x6a5a6a })
          );
          roof.position.set(x, h + 1.5, z);
          scene.add(roof);
        }
        city.buildings.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
    }
  }

  // Palms along the boulevard and beach.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x2fae5f });
  function addPalm(x, z, s = 1) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35 * s, 0.5 * s, 7 * s, 6), trunkMat);
    trunk.position.y = 3.5 * s;
    trunk.rotation.z = (rng() - 0.5) * 0.25;
    g.add(trunk);
    for (let i = 0; i < 6; i++) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(1.1 * s, 5.5 * s, 4), frondMat);
      const a = (i / 6) * Math.PI * 2;
      frond.position.set(Math.cos(a) * 1.6 * s, 7.2 * s, Math.sin(a) * 1.6 * s);
      frond.rotation.z = Math.cos(a) * 1.1;
      frond.rotation.x = -Math.sin(a) * 1.1;
      frond.scale.set(1, 1, 0.25);
      g.add(frond);
    }
    g.position.set(x, 0, z);
    scene.add(g);
    city.palms.push(g);
  }
  for (let x = -240; x <= 240; x += 24) {
    addPalm(x + (rng() - 0.5) * 6, 162 + (rng() - 0.5) * 3, 0.9 + rng() * 0.4);
    if (rng() < 0.7) addPalm(x + (rng() - 0.5) * 8, 196 + rng() * 18, 0.8 + rng() * 0.5);
  }
  for (const x of NS_ROADS) {
    if (rng() < 0.8) addPalm(x + 9, -100 + rng() * 160, 0.8);
  }

  // Street lamps along the boulevard.
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x444050 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a0 });
  for (let x = -230; x <= 230; x += 46) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 6, 6), lampMat);
    pole.position.set(x, 3, 164);
    scene.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), bulbMat);
    bulb.position.set(x, 6.2, 164);
    scene.add(bulb);
    city.lamps.push(pole);
  }

  // Pier reaching into the ocean.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x9a7a5a });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 70), pierMat);
  pier.position.set(120, 1, 260);
  scene.add(pier);
  for (let z = 232; z <= 292; z += 12) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 3, 6), pierMat);
    post.position.set(115, 0.5, z);
    scene.add(post);
    const post2 = post.clone();
    post2.position.x = 125;
    scene.add(post2);
  }
  // Pier end hut.
  const hut = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 8), new THREE.MeshLambertMaterial({ color: 0xe8a0a0 }));
  hut.position.set(120, 3.5, 290);
  scene.add(hut);
  city.buildings.push({ minX: 116, maxX: 124, minZ: 286, maxZ: 294 });

  // Airstrip at the far north-east (finale destination): flat strip + hangar.
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(18, 130), new THREE.MeshLambertMaterial({ color: 0x3a3a44 }));
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(225, 0.09, -180);
  scene.add(strip);
  const hangar = new THREE.Mesh(new THREE.BoxGeometry(24, 10, 30), new THREE.MeshLambertMaterial({ color: 0x9aa8b8 }));
  hangar.position.set(200, 5, -180);
  scene.add(hangar);
  city.buildings.push({ minX: 188, maxX: 212, minZ: -195, maxZ: -165 });

  // Collision: push a circle out of building AABBs and the world bounds.
  city.resolveCircle = function (pos, radius) {
    for (const b of city.buildings) {
      const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          pos.x = cx + (dx / d) * radius;
          pos.z = cz + (dz / d) * radius;
        } else {
          // Center inside the box: push out along the smallest penetration.
          const pushes = [
            { d: pos.x - (b.minX - radius), x: b.minX - radius, z: pos.z },
            { d: (b.maxX + radius) - pos.x, x: b.maxX + radius, z: pos.z },
            { d: pos.z - (b.minZ - radius), x: pos.x, z: b.minZ - radius },
            { d: (b.maxZ + radius) - pos.z, x: pos.x, z: b.maxZ + radius },
          ];
          pushes.sort((a, b2) => a.d - b2.d);
          pos.x = pushes[0].x;
          pos.z = pushes[0].z;
        }
      }
    }
    pos.x = Math.max(WORLD.minX + 2, Math.min(WORLD.maxX - 2, pos.x));
    pos.z = Math.max(WORLD.minZ + 2, Math.min(WORLD.maxZ - 2, pos.z));
  };

  // Is a point on a road (for traffic/pedestrian logic)?
  city.onRoad = function (x, z) {
    if (Math.abs(z - BOULEVARD_Z) < 11) return true;
    for (const rx of NS_ROADS) if (Math.abs(x - rx) < ROAD_WIDTH / 2 + 1) return true;
    for (const rz of EW_ROADS) if (Math.abs(z - rz) < ROAD_WIDTH / 2 + 1) return true;
    return false;
  };

  return city;
}
