import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { localGet, localSet, getData, setData, syncLocalToSupabase } from '../lib/storage';
import { today } from '../lib/utils';

const Ctx = createContext(null);

const INITIAL = {
  profile: { name: '', heightCm: 175, weightUnit: 'lbs', dob: '', avatar: '' },
  theme: 'dark',
  notifications: { weeklyReview: true },
  loginDates: [],
  // module data — loaded lazily
  health: null,
  finances: null,
  appearance: null,
  goals: null,
  productivity: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET': return { ...state, [action.key]: action.value };
    case 'MERGE': return { ...state, [action.key]: { ...state[action.key], ...action.value } };
    case 'LOAD_ALL': return { ...state, ...action.data };
    default: return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, INITIAL, (init) => {
    const saved = localGet('app_state');
    return saved ? { ...init, ...saved } : init;
  });

  // On startup: run the one-time localStorage→Supabase migration,
  // then hydrate app_state from Supabase to get cross-device settings.
  useEffect(() => {
    syncLocalToSupabase();

    getData('app_state', null).then(remote => {
      if (remote) dispatch({ type: 'LOAD_ALL', data: remote });
    }).catch(() => {});
  }, []);

  // Persist state on change — both localStorage (cache) and Supabase
  useEffect(() => {
    localSet('app_state', state);
    setData('app_state', state).catch(() => {});
    // Apply theme
    document.documentElement.classList.toggle('dark', state.theme === 'dark');
  }, [state]);

  // Activity streak — only counts days where data was actually logged
  useEffect(() => {
    const t = today();
    const key = 'activity_dates';
    const dates = localGet(key) || [];
    const water = localGet('health_water') || {};
    const hasActivity =
      (water[t] || 0) > 0 ||
      (localGet('health_workouts') || []).some(w => w.date === t) ||
      (localGet('health_cardio') || []).some(c => c.date === t) ||
      (localGet('nutrition_logs') || []).some(n => n.date === t) ||
      Object.keys((localGet('productivity_habit_logs') || {})[t] || {}).length > 0 ||
      (localGet('health_sleep') || []).some(s => s.date === t);
    if (hasActivity && !dates.includes(t)) {
      const next = [...dates, t];
      localSet(key, next);
      dispatch({ type: 'SET', key: 'loginDates', value: next });
    } else {
      dispatch({ type: 'SET', key: 'loginDates', value: dates });
    }
  }, []);

  const set = useCallback((key, value) => {
    dispatch({ type: 'SET', key, value });
    setData(key, value);
  }, []);

  const merge = useCallback((key, value) => {
    dispatch({ type: 'MERGE', key, value });
  }, []);

  return (
    <Ctx.Provider value={{ state, dispatch, set, merge }}>
      {children}
    </Ctx.Provider>
  );
}

export const useApp = () => useContext(Ctx);
