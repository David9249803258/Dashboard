import { supabase } from '../services/supabase';

// Single shared key — all devices read/write the same namespace.
const APP_ID = 'hdash';
const PREFIX = 'hdash_';

// ── Sync status event emitter ─────────────────────────────────────────────────
// Components subscribe via onSyncStatus() to show sync indicators.
const syncListeners = new Set();

export function onSyncStatus(fn) {
  syncListeners.add(fn);
  return () => syncListeners.delete(fn); // returns unsubscribe
}

let activeSaves = 0;
let hadError    = false;

function notifySync(event) {
  syncListeners.forEach(fn => fn(event));
}

// ── localStorage helpers ──────────────────────────────────────────────────────

function _write(key, value) {
  localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(value));
}

export function localGet(key) {
  try { return JSON.parse(localStorage.getItem(`${PREFIX}${key}`)); } catch { return null; }
}

export function localDel(key) {
  localStorage.removeItem(`${PREFIX}${key}`);
}

// ── Supabase upsert (with retry + sync status notifications) ──────────────────

async function upsertToSupabase(key, value) {
  if (!supabase) return;

  activeSaves++;
  hadError = false;
  notifySync('saving');

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { error } = await supabase.from('app_data').upsert(
        { device_id: APP_ID, key, payload: value, updated_at: new Date().toISOString() },
        { onConflict: 'device_id,key' }
      );
      if (!error) {
        activeSaves--;
        if (activeSaves === 0) notifySync('synced');
        return;
      }
    } catch { /* retry */ }
    if (attempt < 2) await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
  }

  // All retries exhausted — localStorage already has the data as backup
  hadError = true;
  activeSaves--;
  notifySync(activeSaves === 0 ? 'error' : 'saving');
}

// ── Debounce table per key ────────────────────────────────────────────────────
// Rapid writes (e.g. form input) are collapsed; only the last value is sent.
const debounceTimers = {};
const DEBOUNCE_MS = 1500;

function scheduledUpsert(key, value) {
  clearTimeout(debounceTimers[key]);
  debounceTimers[key] = setTimeout(() => upsertToSupabase(key, value), DEBOUNCE_MS);
}

// ── Public API ────────────────────────────────────────────────────────────────

// localSet: writes localStorage immediately, schedules Supabase sync.
// This means EVERY localSet call anywhere in the app auto-syncs — no component
// changes needed to fix cross-device data persistence.
export function localSet(key, value) {
  _write(key, value);
  scheduledUpsert(key, value);
}

// setData: same as localSet but awaitable (used when caller needs to know sync completed).
export async function setData(key, value) {
  _write(key, value);
  await upsertToSupabase(key, value);
}

// getData: reads Supabase first, falls back to localStorage.
export async function getData(key, fallback = null) {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('app_data')
        .select('payload')
        .eq('device_id', APP_ID)
        .eq('key', key)
        .maybeSingle();
      if (!error && data?.payload !== undefined) {
        _write(key, data.payload);
        return data.payload;
      }
    } catch { /* fall through */ }
  }
  const local = localGet(key);
  return local !== null ? local : fallback;
}

// forceSync: re-sync all localStorage data to Supabase (used by retry button).
export async function forceSync() {
  if (!supabase) return;
  const keys = Object.keys(localStorage)
    .filter(k => k.startsWith(PREFIX) && !k.includes('_sync'))
    .map(k => k.slice(PREFIX.length));

  for (const key of keys) {
    const value = localGet(key);
    if (value !== null) await upsertToSupabase(key, value);
  }
}

// syncLocalToSupabase: one-time migration — pushes all localStorage data to
// Supabase. Runs once per app install; after that localSet handles ongoing sync.
export async function syncLocalToSupabase() {
  if (!supabase) return;
  if (localGet('_sync_v2')) return;

  const keys = Object.keys(localStorage)
    .filter(k => k.startsWith(PREFIX) && !k.includes('_sync_v2'))
    .map(k => k.slice(PREFIX.length));

  const batch = keys
    .map(key => {
      const value = localGet(key);
      return value !== null
        ? { device_id: APP_ID, key, payload: value, updated_at: new Date().toISOString() }
        : null;
    })
    .filter(Boolean);

  if (batch.length === 0) { _write('_sync_v2', true); return; }

  try {
    for (let i = 0; i < batch.length; i += 50) {
      await supabase.from('app_data')
        .upsert(batch.slice(i, i + 50), { onConflict: 'device_id,key' });
    }
    _write('_sync_v2', true);
  } catch { /* non-critical — will retry next app load */ }
}
