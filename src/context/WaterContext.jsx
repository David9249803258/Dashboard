import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { localGet, getData, setData } from '../lib/storage';
import { today } from '../lib/utils';

const WaterCtx = createContext(null);

export function WaterProvider({ children }) {
  const [data, setDataState] = useState(() => localGet('health_water') || { goal: 8 });
  const mounted  = useRef(false);
  const dirtyRef = useRef(false);

  // Hydrate from Supabase once on mount (handles new-device / cross-device sync).
  // Skip if the user has already made a change (dirtyRef guards against overwrites).
  useEffect(() => {
    getData('health_water', null).then(remote => {
      if (remote !== null && !dirtyRef.current) {
        setDataState(remote);
      }
    }).catch(() => {});
  }, []);

  // Sync to Supabase whenever data changes (skip the initial mount to avoid
  // a redundant write before hydration has even returned).
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    dirtyRef.current = true;
    setData('health_water', data).catch(() => {});
  }, [data]);

  const t    = today();
  const cups = data[t] || 0;
  const goal = data.goal || 8;

  function updateWater(fn) {
    setDataState(prev => (typeof fn === 'function' ? fn(prev) : fn));
  }

  function addCup(n = 1) {
    const now = today();
    updateWater(prev => ({ ...prev, [now]: Math.max(0, (prev[now] || 0) + n) }));
  }

  function setGoal(g) {
    updateWater(prev => ({ ...prev, goal: g }));
  }

  return (
    <WaterCtx.Provider value={{ cups, goal, data, addCup, setGoal, updateWater }}>
      {children}
    </WaterCtx.Provider>
  );
}

export const useWater = () => useContext(WaterCtx);
