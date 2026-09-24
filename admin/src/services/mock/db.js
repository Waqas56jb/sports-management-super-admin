/**
 * In-browser mock database — development only.
 * Mirrors the relational schema of the future `server/` API so services can switch
 * to real HTTP calls without the UI changing. Data persists in localStorage.
 */
import { createSeed, SEED_VERSION } from '@/data/seed';
import { todayISO } from '@/utils/format';

const KEY = 'shf.mockdb';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data?.meta?.version !== SEED_VERSION) return null;
    // Untouched demo data is regenerated each day so fixtures stay relative to "today".
    if (!data.meta.dirty && data.meta.seededOn !== todayISO()) return null;
    return data;
  } catch {
    return null;
  }
}

function persist(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage full or blocked — keep working in memory */
  }
  return data;
}

let db = load() ?? persist(createSeed());

export const getDb = () => db;

export function commit() {
  db.meta.dirty = true;
  persist(db);
}

export function resetDb() {
  db = persist(createSeed());
}

export function uid(prefix) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Simulated network latency so loading states are exercised during development. */
export const delay = (ms = 280) => new Promise((resolve) => setTimeout(resolve, ms + Math.random() * 220));

export const clone = (value) => (value === undefined ? value : structuredClone(value));

export const nowIso = () => new Date().toISOString();
