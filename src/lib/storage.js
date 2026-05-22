import { supabase } from '../services/supabase';

const DEVICE_ID = (() => {
  let id = localStorage.getItem('hdash_device_id');
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('hdash_device_id', id); }
  return id;
})();

export function localGet(key) {
  try { return JSON.parse(localStorage.getItem(`hdash_${key}`)); } catch { return null; }
}

export function localSet(key, value) {
  localStorage.setItem(`hdash_${key}`, JSON.stringify(value));
}

export function localDel(key) {
  localStorage.removeItem(`hdash_${key}`);
}

export async function getData(key, fallback = null) {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('app_data')
        .select('payload')
        .eq('device_id', DEVICE_ID)
        .eq('key', key)
        .maybeSingle();
      if (!error && data?.payload !== undefined) {
        localSet(key, data.payload);
        return data.payload;
      }
    } catch { /* fall through */ }
  }
  const local = localGet(key);
  return local !== null ? local : fallback;
}

export async function setData(key, value) {
  localSet(key, value);
  if (supabase) {
    try {
      await supabase.from('app_data').upsert(
        { device_id: DEVICE_ID, key, payload: value, updated_at: new Date().toISOString() },
        { onConflict: 'device_id,key' }
      );
    } catch { /* silent */ }
  }
}

export function useLocalState(key, initial) {
  const stored = localGet(key);
  return stored !== null ? stored : initial;
}
