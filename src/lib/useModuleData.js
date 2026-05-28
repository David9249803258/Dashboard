import { useState, useEffect, useCallback, useRef } from 'react';
import { localGet, getData, setData } from './storage';

export function useModuleData(key, initial) {
  const [data, setLocalData] = useState(() => {
    const stored = localGet(key);
    return stored !== null ? stored : initial;
  });

  // Track whether the user has written since mount.
  // If yes, we skip applying any late-arriving Supabase data so we
  // never overwrite a user's change with a stale remote value.
  const dirtyRef = useRef(false);

  // Hydrate from Supabase once on mount.
  // On a new device (empty localStorage), this is what populates all data.
  // On an existing device, this keeps the view fresh across tab/device changes.
  useEffect(() => {
    getData(key, null).then(remote => {
      if (remote !== null && !dirtyRef.current) {
        setLocalData(remote);
      }
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useCallback((next) => {
    dirtyRef.current = true;
    const value = typeof next === 'function' ? next(data) : next;
    setLocalData(value);
    setData(key, value).catch(() => {});
  }, [key, data]);

  return [data, save];
}
