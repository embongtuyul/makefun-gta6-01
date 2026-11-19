// save.js — localStorage persistence for SOLMARA.
// Saves cash, reputation, job progress, player position and settings.
// Everything is plain JSON under one key; a corrupt save is ignored.

const SAVE_KEY = 'solmara-save-v1';

export function defaultSave() {
  return {
    version: 1,
    cash: 250,
    rp: 0,
    rank: 0,
    jobIndex: 0,
    jobsDone: [],
    day: 1,
    clockMinutes: 16 * 60,
    muted: false,
    playerPos: null,
    savedAt: 0,
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return { ...defaultSave(), ...data };
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadSave() !== null;
}

export function writeSave(state) {
  try {
    const data = {
      version: 1,
      cash: Math.round(state.cash),
      rp: Math.round(state.rp),
      rank: state.rank,
      jobIndex: state.jobIndex,
      jobsDone: state.jobsDone.slice(),
      day: state.day,
      clockMinutes: state.clockMinutes,
      muted: !!state.muted,
      playerPos: state.playerPos ? { x: state.playerPos.x, z: state.playerPos.z } : null,
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* storage unavailable */ }
}

export function saveSummary(save) {
  if (!save) return '';
  const d = new Date(save.savedAt);
  const when = save.savedAt ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'earlier';
  return `Save from ${when} — $${save.cash.toLocaleString()} · Job ${Math.min(save.jobIndex + 1, 6)}/6 · Day ${save.day}`;
}
