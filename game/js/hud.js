// hud.js — every DOM overlay: mission box, police panel, wanted stars,
// cash, weapons, crew cards, minimap, vitals, speedometer, dialogue,
// radio, toasts and center messages.

import { WEAPONS } from './combat.js';
import { NS_ROADS, EW_ROADS, BOULEVARD_Z, WORLD } from './city.js';

export const RANKS = [
  { letter: 'D', name: 'ROOKIE', rp: 0 },
  { letter: 'C', name: 'HUSTLER', rp: 500 },
  { letter: 'B', name: 'FIXER', rp: 1500 },
  { letter: 'A', name: 'SHOT CALLER', rp: 3000 },
  { letter: 'S', name: 'LEGEND', rp: 6000 },
];

export function rankFor(rp) {
  let r = RANKS[0];
  for (const rank of RANKS) if (rp >= rank.rp) r = rank;
  return r;
}

const PORTRAITS = { SELMA: '\uD83D\uDC69', DANA: '\uD83D\uDE97', BRAM: '\uD83D\uDD27', JUNO: '\uD83D\uDD2D', 'SILAS KADE': '\uD83D\uDC51', DISPATCH: '\uD83D\uDCDE' };

export class HUD {
  constructor() {
    this.el = {};
    for (const id of [
      'hud', 'mission-box', 'mission-title', 'mission-stage', 'mission-stage-name',
      'mission-progress', 'mission-objective', 'mission-next',
      'police-panel', 'police-count', 'police-list', 'in-sight',
      'clock', 'cash', 'stars', 'air-unit',
      'rank-letter', 'rank-name', 'rank-bar', 'rank-rp',
      'weapons', 'district-name', 'street-name', 'standing-label', 'standing-bar',
      'minimap', 'health-bar', 'health-num', 'armour-bar', 'armour-num',
      'speed-num', 'car-name', 'car-condition', 'nitro-wrap', 'nitro-bar',
      'dialogue', 'dialogue-portrait',
      'dialogue-name', 'dialogue-text', 'radio-line', 'center-msg', 'hint-line',
      'objective-toast', 'touch-controls', 'mission-timer', 'stunt-popup',
    ]) this.el[id] = document.getElementById(id);
    this.minimapCtx = this.el.minimap.getContext('2d');
    this.dialogueTimer = 0;
    this.centerTimer = 0;
    this.toastTimer = 0;
    this.stuntTimer = 0;
    this.lastMissionKey = '';
    this.buildWeaponSlots();
  }

  buildWeaponSlots() {
    this.el.weapons.innerHTML = '';
    this.weaponEls = WEAPONS.map((w, i) => {
      const d = document.createElement('div');
      d.className = 'weapon-slot';
      d.innerHTML = `<span class="w-key">${w.key}</span><span class="w-icon">${w.icon}</span><span class="w-name">${w.name}</span><span class="w-ammo"></span>`;
      this.el.weapons.appendChild(d);
      return d;
    });
  }

  show() { this.el.hud.classList.remove('hidden'); }
  hide() { this.el.hud.classList.add('hidden'); }

  say(name, text) {
    this.el.dialogue.classList.remove('hidden');
    this.el['dialogue-name'].textContent = name;
    this.el['dialogue-text'].textContent = text;
    this.el['dialogue-portrait'].textContent = PORTRAITS[name] || '\uD83D\uDC64';
    this.dialogueTimer = 6;
  }

  centerMessage(title, sub, kind) {
    const el = this.el['center-msg'];
    el.className = kind || '';
    el.id = 'center-msg';
    el.innerHTML = `${title}${sub ? `<span class="sub">${sub}</span>` : ''}`;
    el.classList.remove('hidden');
    this.centerTimer = 3.2;
  }

  toast(text) {
    const el = this.el['objective-toast'];
    el.textContent = text;
    el.classList.remove('hidden');
    this.toastTimer = 2.6;
  }

  // Floating cash popup for stunt awards (drift / near miss).
  stuntPopup(text) {
    const el = this.el['stunt-popup'];
    el.textContent = text;
    el.classList.remove('hidden');
    this.stuntTimer = 1.6;
  }

  hint(text) {
    this.el['hint-line'].textContent = text || '';
    this.el['hint-line'].style.display = text ? 'block' : 'none';
  }

  updateMission(missions, playerPos) {
    const job = missions.currentJob();
    const stage = missions.currentStage();
    const box = this.el['mission-box'];
    if (!job || !missions.active) {
      box.style.display = 'none';
      return;
    }
    box.style.display = 'block';
    const key = `${missions.jobIndex}-${missions.stageIndex}-${stage ? stage.name : ''}`;
    if (key !== this.lastMissionKey) {
      this.lastMissionKey = key;
      this.el['mission-title'].textContent = job.title;
      this.el['mission-stage'].textContent = `STAGE ${missions.stageIndex + 1}/${job.stages.length}`;
      this.el['mission-stage-name'].textContent = stage.name;
      this.el['mission-objective'].textContent = stage.objective;
    }
    const progress = ((missions.stageIndex + 1) / job.stages.length) * 100;
    this.el['mission-progress'].style.width = `${progress}%`;
    // Timed stages get a big countdown in the mission box — the top entries
    // all make the clock impossible to miss.
    const timerEl = this.el['mission-timer'];
    if (stage.type === 'survive' || stage.type === 'race') {
      const left = Math.max(0, Math.ceil(missions.stageTimer));
      const mm = Math.floor(left / 60);
      const ss = String(left % 60).padStart(2, '0');
      timerEl.textContent = `${mm}:${ss}`;
      timerEl.classList.toggle('urgent', left <= 10);
      timerEl.classList.remove('hidden');
    } else {
      timerEl.classList.add('hidden');
    }
    let next = stage.next || '';
    if (stage.type === 'survive' || stage.type === 'race') {
      next = `${next}  ·  ${Math.max(0, Math.ceil(missions.stageTimer))}s left`;
    }
    const dist = missions.targetDistance(playerPos);
    if (dist !== null) next = `${next}  ·  ${dist} m`;
    this.el['mission-next'].textContent = `NEXT  ${next}`;
  }

  updatePolice(police, playerPos) {
    const panel = this.el['police-panel'];
    const sight = this.el['in-sight'];
    if (police.wanted === 0) {
      panel.classList.add('hidden');
      // Keep the pill honest even while the panel is hidden: without this
      // it keeps a stale "● IN SIGHT" after a busted/wasted/heat-decay
      // clears the wanted level (found by QA run 6: the M4 check read a
      // stale pill for the whole test).
      sight.textContent = '○ HIDDEN — COOLING OFF';
      sight.className = 'hidden-sight';
      return;
    }
    panel.classList.remove('hidden');
    const rows = police.panelRows(playerPos);
    this.el['police-count'].textContent = `${police.unitCount} UNITS${police.wanted >= 4 ? ' · CODE 4' : ''}`;
    // IN SIGHT pill: the single most useful piece of chase information —
    // whether anyone can see you right now (heat only drops while hidden).
    if (police.anySeesPlayer) {
      sight.textContent = '● IN SIGHT';
      sight.className = 'seen';
    } else {
      sight.textContent = '○ HIDDEN — COOLING OFF';
      sight.className = 'hidden-sight';
    }
    const shown = rows.slice(0, 5);
    this.el['police-list'].innerHTML = shown.map((r) =>
      `<div class="police-row"><span class="unit">${r.name}</span><span class="role">${r.role}</span><span class="dist">${r.dist} m</span></div>`
    ).join('') + (rows.length > 5 ? `<div class="police-more">+${rows.length - 5} more</div>` : '');
  }

  updateWeapons(combat) {
    this.weaponEls.forEach((el, i) => {
      el.classList.toggle('active', i === combat.selected);
      const ammo = combat.ammo[i];
      el.querySelector('.w-ammo').textContent = isFinite(ammo.mag) ? `${ammo.mag}/${ammo.reserve}` : '∞';
    });
  }

  updateCrew(crew) {
    for (const [key, id] of [['z', 'crew-z'], ['x', 'crew-x'], ['c', 'crew-c']]) {
      const el = document.getElementById(id);
      const cd = crew[key].cd;
      el.classList.toggle('cooling', cd > 0);
      el.querySelector('.crew-cd').textContent = cd > 0 ? `${Math.ceil(cd)}s` : '';
    }
  }

  drawMinimap(state) {
    const g = this.minimapCtx;
    const S = 190;
    const scale = S / (WORLD.maxX - WORLD.minX);
    const px = (x) => (x - WORLD.minX) * scale;
    const pz = (z) => (z - WORLD.minZ) * scale;
    // Land + ocean.
    g.fillStyle = '#3a2f45';
    g.fillRect(0, 0, S, S);
    g.fillStyle = '#2e7f9e';
    g.fillRect(0, pz(245), S, S - pz(245));
    g.fillStyle = '#f2d8a0';
    g.fillRect(0, pz(190), S, pz(245) - pz(190));
    // Roads.
    g.strokeStyle = '#6a6478';
    g.lineWidth = 3;
    for (const x of NS_ROADS) {
      g.beginPath(); g.moveTo(px(x), pz(-250)); g.lineTo(px(x), pz(175)); g.stroke();
    }
    for (const z of EW_ROADS) {
      g.beginPath(); g.moveTo(px(-250), pz(z)); g.lineTo(px(250), pz(z)); g.stroke();
    }
    g.strokeStyle = '#8a8098';
    g.lineWidth = 4;
    g.beginPath(); g.moveTo(px(-250), pz(BOULEVARD_Z)); g.lineTo(px(250), pz(BOULEVARD_Z)); g.stroke();
    // Buildings.
    g.fillStyle = '#54455f';
    for (const b of state.city.buildings) {
      g.fillRect(px(b.minX), pz(b.minZ), (b.maxX - b.minX) * scale, (b.maxZ - b.minZ) * scale);
    }
    // Mission target blip.
    const t = state.missions.targetPos;
    if (t) {
      const blink = Math.sin(performance.now() / 180) > 0 ? 1 : 0.4;
      g.globalAlpha = blink;
      g.fillStyle = '#ffd94d';
      const bx = px(t.x);
      const bz = pz(t.z);
      g.beginPath();
      g.moveTo(bx, bz - 6); g.lineTo(bx + 5, bz); g.lineTo(bx, bz + 6); g.lineTo(bx - 5, bz);
      g.closePath(); g.fill();
      g.globalAlpha = 1;
    }
    // Police blips (blue) — always shown when Eyes Out is active, else only nearby.
    for (const u of state.police.units) {
      if (u.car.dead) continue;
      const d = Math.hypot(u.car.x - state.player.x, u.car.z - state.player.z);
      if (!state.eyesOut && d > 120) continue;
      g.fillStyle = '#4d9fff';
      g.beginPath(); g.arc(px(u.car.x), pz(u.car.z), 3, 0, Math.PI * 2); g.fill();
    }
    if (state.police.heli) {
      g.fillStyle = '#4d9fff';
      g.beginPath(); g.arc(px(state.police.heli.mesh.position.x), pz(state.police.heli.mesh.position.z), 4, 0, Math.PI * 2); g.fill();
    }
    // Traffic dots.
    g.fillStyle = 'rgba(255,255,255,0.65)';
    for (const c of state.traffic.cars) {
      g.fillRect(px(c.x) - 1, pz(c.z) - 1, 2, 2);
    }
    // Player arrow.
    const pxx = px(state.player.x);
    const pzz = pz(state.player.z);
    g.save();
    g.translate(pxx, pzz);
    g.rotate(Math.atan2(-Math.sin(state.player.heading), -Math.cos(state.player.heading)) + Math.PI / 2);
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#1a0f1e';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, -7); g.lineTo(5, 5); g.lineTo(0, 2); g.lineTo(-5, 5);
    g.closePath(); g.fill(); g.stroke();
    g.restore();
  }

  update(state, dt) {
    // Timers.
    if (this.dialogueTimer > 0) {
      this.dialogueTimer -= dt;
      if (this.dialogueTimer <= 0) this.el.dialogue.classList.add('hidden');
    }
    if (this.centerTimer > 0) {
      this.centerTimer -= dt;
      if (this.centerTimer <= 0) this.el['center-msg'].classList.add('hidden');
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.el['objective-toast'].classList.add('hidden');
    }
    if (this.stuntTimer > 0) {
      this.stuntTimer -= dt;
      if (this.stuntTimer <= 0) this.el['stunt-popup'].classList.add('hidden');
    }

    // Clock + cash + stars.
    const hh = String(Math.floor(state.clockMinutes / 60) % 24).padStart(2, '0');
    const mm = String(Math.floor(state.clockMinutes % 60)).padStart(2, '0');
    this.el.clock.textContent = `${hh}:${mm} · DAY ${state.day}`;
    this.el.cash.textContent = `$${Math.round(state.cash).toLocaleString()}`;
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < state.police.wanted ? '★' : '☆';
    this.el.stars.textContent = stars;
    this.el.stars.style.color = state.police.wanted >= 3 ? '#ff5a5a' : '#ffd94d';
    this.el['air-unit'].classList.toggle('hidden', !state.police.heli);

    // Rank.
    const rank = rankFor(state.rp);
    const next = RANKS[RANKS.indexOf(rank) + 1];
    this.el['rank-letter'].textContent = `RANK ${rank.letter}`;
    this.el['rank-name'].textContent = rank.name;
    const span = next ? next.rp - rank.rp : 1;
    const prog = next ? Math.min(100, ((state.rp - rank.rp) / span) * 100) : 100;
    this.el['rank-bar'].style.width = `${prog}%`;
    this.el['rank-rp'].textContent = next ? `${Math.round(state.rp).toLocaleString()} / ${next.rp.toLocaleString()} RP` : `${Math.round(state.rp).toLocaleString()} RP · MAX`;

    // Location.
    const d = state.district;
    this.el['district-name'].textContent = d.name;
    this.el['street-name'].textContent = d.street;
    this.el['standing-label'].textContent = `${d.standing >= 55 ? 'FRIENDLY' : d.standing >= 40 ? 'NEUTRAL' : 'HOSTILE'} · ${d.standing}`;
    this.el['standing-bar'].style.width = `${d.standing}%`;

    // Vitals.
    this.el['health-bar'].style.width = `${state.player.health}%`;
    this.el['health-num'].textContent = Math.round(state.player.health);
    this.el['armour-bar'].style.width = `${state.player.armour}%`;
    this.el['armour-num'].textContent = Math.round(state.player.armour);

    // Speedometer + nitro gauge.
    if (state.player.inCar && state.player.car) {
      this.el['speed-num'].textContent = Math.round(state.player.carSpeedKmh);
      this.el['car-name'].textContent = state.player.car.model.name;
      const cond = Math.round(state.player.car.condition);
      this.el['car-condition'].textContent = cond < 100 ? `${cond}% CONDITION` : '';
      this.el['car-condition'].style.color = cond < 35 ? '#ff5a5a' : '#ffd9a0';
      this.el['nitro-wrap'].style.display = 'block';
      this.el['nitro-bar'].style.width = `${Math.round(state.player.car.nitro)}%`;
      this.el['nitro-bar'].className = state.player.car.boosting && state.player.car.nitro > 0 ? 'boosting' : '';
    } else {
      this.el['speed-num'].textContent = Math.round(state.player.speed * 3.6);
      this.el['car-name'].textContent = 'ON FOOT';
      this.el['car-condition'].textContent = '';
      this.el['nitro-wrap'].style.display = 'none';
    }

    // Radio.
    const st = state.audio.currentStation();
    this.el['radio-line'].textContent = `${st.name} — ${st.song}`;

    this.updateMission(state.missions, state.player.pos);
    this.updatePolice(state.police, state.player.pos);
    this.updateWeapons(state.combat);
    this.updateCrew(state.crew);
    this.drawMinimap(state);
  }
}
