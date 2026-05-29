import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { runDetectionEngine } from '../services/detectionEngine';
import { localSet, setData }  from '../lib/storage';
import { supabase }           from '../services/supabase';

const Ctx = createContext(null);

const SCAN_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const INITIAL_DELAY_MS = 3_000;           // 3s after mount

export function DetectionProvider({ children }) {
  const [detections, setDetections] = useState([]);
  const [scanning,   setScanning]   = useState(false);
  const [lastScan,   setLastScan]   = useState(null);
  const mountedRef = useRef(true);

  const runScan = useCallback(async () => {
    if (scanning) return;
    setScanning(true);
    try {
      const results = await runDetectionEngine();
      if (!mountedRef.current) return;
      setDetections(results);
      setLastScan(new Date());
      // Cache results so Overseer can read them without re-running the engine
      localSet('last_detections', results);
      // Persist last scan time
      if (supabase) {
        supabase.from('user_settings').upsert(
          { key: 'last_detection_scan', value: { timestamp: new Date().toISOString() }, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        ).then(null, () => {});
      }
    } catch {
      /* never crash the app */
    } finally {
      if (mountedRef.current) setScanning(false);
    }
  }, [scanning]);

  useEffect(() => {
    mountedRef.current = true;
    const initial = setTimeout(runScan, INITIAL_DELAY_MS);
    const interval = setInterval(runScan, SCAN_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function resolveDetection(id) {
    setDetections(prev => prev.filter(d => d.id !== id));
  }

  async function dismissDetection(id) {
    resolveDetection(id);
    if (!supabase) return;
    const until = new Date(); until.setHours(until.getHours() + 24);
    supabase.from('dismissed_detections')
      .insert({ detection_id: id, dismissed_until: until.toISOString() })
      .then(null, () => {});
  }

  const criticalCount  = detections.filter(d => d.severity === 'critical').length;
  const warningCount   = detections.filter(d => d.severity === 'warning').length;
  const badgeCount     = detections.length;
  const badgeSeverity  = criticalCount > 0 ? 'critical' : warningCount > 0 ? 'warning' : detections.length > 0 ? 'info' : 'none';

  return (
    <Ctx.Provider value={{ detections, scanning, lastScan, runScan, resolveDetection, dismissDetection, badgeCount, badgeSeverity }}>
      {children}
    </Ctx.Provider>
  );
}

export const useDetections = () => useContext(Ctx);
