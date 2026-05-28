import { supabase } from '../services/supabase';

// Single shared key for this single-user app.
// Previously used crypto.randomUUID() per device — that broke cross-device access.
const APP_ID = 'hdash';
const PREFIX = 'hdash_';

export function localGet(key) {
  try { return JSON.parse(localStorage.getItem(`${PREFIX}${key}`)); } catch { return null; }
}

export function localSet(key, value) {
  localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(value));
}

export function localDel(key) {
  localStorage.removeItem(`${PREFIX}${key}`);
}

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
        localSet(key, data.payload);
        return data.payload;
      }
    } catch { /* fall through to localStorage */ }
  }
  const local = localGet(key);
  return local !== null ? local : fallback;
}

async function upsertToSupabase(key, value) {
  if (!supabase) return;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { error } = await supabase.from('app_data').upsert(
        { device_id: APP_ID, key, payload: value, updated_at: new Date().toISOString() },
        { onConflict: 'device_id,key' }
      );
      if (!error) return;
    } catch { /* retry */ }
    if (attempt < 2) await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
  }
  // All retries failed — localStorage already has the data as local backup
}

export async function setData(key, value) {
  localSet(key, value); // localStorage written synchronously — data never lost
  upsertToSupabase(key, value).catch(() => {});
}

// One-time migration: push all existing localStorage data to Supabase.
// Runs once after switching from per-device IDs to the shared APP_ID.
export async function syncLocalToSupabase() {
  if (!supabase) return;
  if (localGet('_sync_v2')) return; // already done

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

  if (batch.length === 0) { localSet('_sync_v2', true); return; }

  try {
    // Upsert in chunks of 50
    for (let i = 0; i < batch.length; i += 50) {
      await supabase.from('app_data')
        .upsert(batch.slice(i, i + 50), { onConflict: 'device_id,key' });
    }
    localSet('_sync_v2', true);
  } catch { /* non-critical — will retry next app load */ }
}
