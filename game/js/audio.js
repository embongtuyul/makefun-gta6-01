// audio.js — fully synthesized sound for SOLMARA (no audio files).
// WebAudio only: engine hum, police sirens, gunshots, radio music,
// UI blips and mission stings. Starts on the first user gesture.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenOn = false;
    this.radioTimer = null;
    this.radioStep = 0;
    this.station = 0;
    this.stations = [
      { name: 'SHORE FM 97.1', song: 'Sunset Drive', root: 220.0, mode: [0, 3, 5, 7, 10] },
      { name: 'CORAL 88.4', song: 'Neon Palms', root: 196.0, mode: [0, 2, 4, 7, 9] },
      { name: 'TIDE TALK 101.9', song: 'Harbour Nights', root: 174.61, mode: [0, 3, 5, 8, 10] },
    ];
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.startEngine();
      this.startRadio();
      return true;
    } catch {
      return false;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.05);
    }
  }

  nextStation() {
    this.station = (this.station + 1) % this.stations.length;
    this.radioStep = 0;
    return this.stations[this.station];
  }

  currentStation() {
    return this.stations[this.station];
  }

  startEngine() {
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.0;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start();
    this.engineOsc = osc;
    this.engineGain = gain;
  }

  // speedKmh 0..180, inCar true when driving.
  setEngine(speedKmh, inCar) {
    if (!this.ctx || !this.engineOsc) return;
    const t = this.ctx.currentTime;
    const f = 50 + Math.min(speedKmh, 180) * 0.9;
    this.engineOsc.frequency.setTargetAtTime(f, t, 0.08);
    this.engineGain.gain.setTargetAtTime(inCar ? 0.05 + Math.min(speedKmh, 180) / 180 * 0.05 : 0.0, t, 0.1);
  }

  setSiren(on) {
    if (!this.ctx) return;
    if (on === this.sirenOn) return;
    this.sirenOn = on;
    if (!on) {
      if (this.sirenGain) this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
      return;
    }
    if (!this.sirenOsc) {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 720;
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(this.master);
      osc.start();
      this.sirenOsc = osc;
      this.sirenGain = gain;
      // Two-tone wail via a slow LFO on frequency.
      const lfo = this.ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 0.55;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 160;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start();
    }
    this.sirenGain.gain.setTargetAtTime(0.035, this.ctx.currentTime, 0.3);
  }

  // A gentle procedural radio loop: bass notes + soft plucks on the pentatonic.
  startRadio() {
    if (this.radioTimer) return;
    const tick = () => {
      if (!this.ctx || this.muted) return;
      const st = this.stations[this.station];
      const step = this.radioStep++;
      const scale = st.mode;
      const note = scale[step % scale.length] + 12 * Math.floor((step / scale.length) % 2);
      const freq = st.root * Math.pow(2, note / 12);
      if (step % 2 === 0) this.pluck(freq / 2, 0.10, 'sine', 0.35);
      if (step % 4 === 1) this.pluck(freq, 0.16, 'triangle', 0.18);
      if (step % 8 === 6) this.pluck(freq * 1.5, 0.12, 'triangle', 0.10);
    };
    this.radioTimer = setInterval(tick, 420);
  }

  pluck(freq, dur, type, vol) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noiseBurst(dur, vol, freq) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t);
  }

  gunshot(big = false) {
    this.noiseBurst(big ? 0.22 : 0.11, big ? 0.5 : 0.32, big ? 900 : 2400);
  }

  punch() { this.noiseBurst(0.07, 0.3, 500); }

  crash() { this.noiseBurst(0.3, 0.45, 350); }

  sirenBlip() { this.pluck(880, 0.09, 'square', 0.08); }

  click() { this.pluck(660, 0.06, 'sine', 0.15); }

  cashRegister() {
    this.pluck(1320, 0.09, 'sine', 0.18);
    setTimeout(() => this.pluck(1760, 0.14, 'sine', 0.18), 90);
  }

  missionSting(win = true) {
    const notes = win ? [523.25, 659.25, 783.99, 1046.5] : [392, 329.63, 261.63];
    notes.forEach((f, i) => setTimeout(() => this.pluck(f, 0.28, 'triangle', 0.22), i * 120));
  }

  wantedUp() {
    this.pluck(440, 0.12, 'square', 0.12);
    setTimeout(() => this.pluck(554.37, 0.16, 'square', 0.12), 130);
  }
}
