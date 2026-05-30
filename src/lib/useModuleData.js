import { useState, useEffect, useRef, useCallback } from 'react';
import { localGet, getData, setData } from './storage';

/**
 * useModuleData(key, initial)
 *
 * Supabase-first storage hook:
 * 1. Initialises from localStorage immediately (fast, zero flicker).
 * 2. Fetches from module_data table on mount and updates state if remote
 *    is newer / device is fresh.
 * 3. Every save writes to localStorage + upserts to module_data.
 * 4. Returns [data, save, loaded] — third element is optional (most callers
 *    only destructure [data, save]).
 */
export function useModuleData(key, initial) {
  const [data,   setLocalData] = useState(() => {
    const stored = localGet(key);
    return stored !== null ? stored : initial;
  });
  const [loaded, setLoaded] = useState(false);

  // Stable ref so the save callback never has a stale closure on data.
  const dataRef = useRef(data);
  dataRef.current = data;

  // Track whether the user has written since mount.
  // If yes, skip applying any late-arriving Supabase value so we never
  // overwrite a local change with a stale remote value.
  const dirtyRef = useRef(false);

  // Hydrate from Supabase once on mount.
  useEffect(() => {
    let cancelled = false;

    getData(key, null)
      .then(remote => {
        if (cancelled || remote === null) return;
        if (!dirtyRef.current) {
          setLocalData(remote);
          dataRef.current = remote;
        }
      })
      .catch(() => {
        // Supabase unreachable — localStorage value already set in useState.
        const local = localGet(key);
        if (local !== null && !dirtyRef.current) {
          setLocalData(local);
          dataRef.current = local;
        }
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // save — writes to localStorage immediately and upserts to Supabase.
  const save = useCallback(async (updater) => {
    dirtyRef.current = true;
    const newData = typeof updater === 'function' ? updater(dataRef.current) : updater;
    dataRef.current = newData;
    setLocalData(newData);

    try {
      await setData(key, newData);
    } catch (err) {
      console.error(`[useModuleData] Save failed for "${key}":`, err);
      // localStorage backup already written inside setData
    }
  }, [key]);

  return [data, save, loaded];
}
