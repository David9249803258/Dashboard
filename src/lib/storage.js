import { supabase } from '../services/supabase';

const PREFIX = 'hdash_';

// ── Sync status event emitter ─────────────────────────────────────────────────
const syncListeners = new Set();

export function onSyncStatus(fn) {
  syncListeners.add(fn);
  return () => syncListeners.delete(fn);
}

let activeSaves = 0;

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

// ── Supabase upsert into module_data ──────────────────────────────────────────
// module_data uses (key) as the unique identifier — no device isolation needed.

async function upsertToSupabase(key, value) {
  if (!supabase) return;

  activeSaves++;
  notifySync('saving');

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { error } = await supabase.from('module_data').upsert(
        { key, value, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
      if (!error) {
        activeSaves--;
        if (activeSaves === 0) notifySync('synced');
        return;
      }
    } catch { /* retry */ }
    if (attempt < 2) await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
  }

  // All retries exhausted — localStorage still has the data as backup
  activeSaves--;
  notifySync(activeSaves === 0 ? 'error' : 'saving');
}

// ── Debounce per key — collapses rapid writes ─────────────────────────────────
const debounceTimers = {};
const DEBOUNCE_MS = 1500;

function scheduledUpsert(key, value) {
  clearTimeout(debounceTimers[key]);
  debounceTimers[key] = setTimeout(() => upsertToSupabase(key, value), DEBOUNCE_MS);
}

// ── Public API ────────────────────────────────────────────────────────────────

// localSet — writes localStorage immediately, schedules Supabase sync.
// Every localSet anywhere in the app auto-syncs to module_data.
export function localSet(key, value) {
  _write(key, value);
  scheduledUpsert(key, value);
}

// setData — awaitable write to both localStorage and Supabase.
export async function setData(key, value) {
  _write(key, value);
  await upsertToSupabase(key, value);
}

// getData — reads module_data first, falls back to localStorage.
export async function getData(key, fallback = null) {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('module_data')
        .select('value')
        .eq('key', key)
        .maybeSingle();
      if (!error && data?.value !== undefined) {
        _write(key, data.value);   // keep localStorage as cache
        return data.value;
      }
    } catch { /* fall through to localStorage */ }
  }
  const local = localGet(key);
  return local !== null ? local : fallback;
}

// forceSync — re-uploads every hdash_ key from localStorage to module_data.
export async function forceSync() {
  if (!supabase) return;
  const keys = Object.keys(localStorage)
    .filter(k => k.startsWith(PREFIX))
    .map(k => k.slice(PREFIX.length));

  const batch = keys
    .map(key => { const v = localGet(key); return v !== null ? { key, value: v, updated_at: new Date().toISOString() } : null; })
    .filter(Boolean);

  for (let i = 0; i < batch.length; i += 50) {
    await supabase.from('module_data')
      .upsert(batch.slice(i, i + 50), { onConflict: 'key' })
      .then(null, () => {});
  }
}

// checkConnection — returns true if Supabase is reachable.
export async function checkConnection() {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('module_data').select('key').limit(1);
    return !error;
  } catch { return false; }
}

// syncLocalToSupabase — migrates all hdash_ localStorage keys to module_data.
// Safe to run on every load: uses upsert so existing Supabase data is only
// overwritten if the localStorage version is more recent (we can't compare
// timestamps, so we always upsert — last write wins).
export async function syncLocalToSupabase() {
  if (!supabase) return;

  const keys = Object.keys(localStorage)
    .filter(k => k.startsWith(PREFIX) && !k.includes('_sync'))
    .map(k => k.slice(PREFIX.length));

  if (keys.length === 0) return;

  const batch = keys
    .map(key => { const v = localGet(key); return v !== null ? { key, value: v, updated_at: new Date().toISOString() } : null; })
    .filter(Boolean);

  try {
    for (let i = 0; i < batch.length; i += 50) {
      await supabase.from('module_data')
        .upsert(batch.slice(i, i + 50), { onConflict: 'key' });
    }
  } catch { /* non-critical */ }
}
