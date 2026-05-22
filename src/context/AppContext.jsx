import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { localGet, localSet, getData, setData } from '../lib/storage';
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

  // Persist state on change
  useEffect(() => {
    localSet('app_state', state);
    // Apply theme
    document.documentElement.classList.toggle('dark', state.theme === 'dark');
  }, [state]);

  // Record login streak
  useEffect(() => {
    const dates = localGet('login_dates') || [];
    if (!dates.includes(today())) {
      const next = [...dates, today()];
      localSet('login_dates', next);
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
