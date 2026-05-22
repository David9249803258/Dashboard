import { useState, useEffect, useCallback } from 'react';
import { localGet, localSet, getData, setData } from './storage';

export function useModuleData(key, initial) {
  const [data, setLocalData] = useState(() => {
    const stored = localGet(key);
    return stored !== null ? stored : initial;
  });

  const save = useCallback((next) => {
    const value = typeof next === 'function' ? next(data) : next;
    setLocalData(value);
    localSet(key, value);
    setData(key, value).catch(() => {});
  }, [key, data]);

  return [data, save];
}
