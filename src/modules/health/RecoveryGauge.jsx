import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { useModuleData } from '../../lib/useModuleData';
import { Card, CardTitle } from '../../components/ui/Card';
import { localGet } from '../../lib/storage';
import { today, uuid } from '../../lib/utils';
import { supabase } from '../../services/supabase';

// ── Arc math ──────────────────────────────────────────────────────────────────
// Angles: 0° = 12 o'clock, clockwise positive (compass convention)
function polarPoint(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function arcPath(cx, cy, r, startDeg, sweepDeg) {
  if (sweepDeg <= 0) return '';
  const clampedSweep = Math.min(sweepDeg, 359.99);
  const endDeg = (startDeg + clampedSweep) % 360;
  const [sx, sy] = polarPoint(cx, cy, r, startDeg);
  const [ex, ey] = polarPoint(cx, cy, r, endDeg);
  const large = clampedSweep > 180 ? 1 : 0;
  return `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
}

// ── Recovery score calculation (exported for use in TopBar) ──────────────────
export function computeRecoveryScore() {
  const t = today();
  const sleepLogs = localGet('health_sleep') || [];
  const sorted    = [...sleepLogs].sort((a, b) => b.date.localeCompare(a.date));
  const todaySleep = sorted[0]; // most recent sleep log

  // Sleep hours (35%)
  const sleepH     = todaySleep?.hours || 0;
  const sleepScore = Math.min(100, (sleepH / 8) * 100);

  // Sleep quality (20%) — default 50 if not rated
  const qualityScore = todaySleep?.quality ? (todaySleep.quality / 5) * 100 : 50;

  // HRV vs 7-day baseline (25%)
  const allLogs    = localGet('health_hrv_rhr') || [];
  const hrvWithVal = allLogs.filter(l => l.hrv_ms).sort((a, b) => b.date.localeCompare(a.date));
  const todayHRV   = hrvWithVal.find(l => l.date === t)?.hrv_ms || 0;
  const baseHRV    = hrvWithVal.filter(l => l.date !== t).slice(0, 7);
  const avgHRV     = baseHRV.length ? baseHRV.reduce((s, l) => s + l.hrv_ms, 0) / baseHRV.length : 0;
  let hrvScore     = 50;
  if (avgHRV > 0 && todayHRV > 0) {
    hrvScore = Math.min(100, Math.max(0, 50 + ((todayHRV - avgHRV) / avgHRV) * 150));
  }

  // RHR vs 7-day baseline (20%) — lower is better
  const rhrWithVal = allLogs.filter(l => l.rhr_bpm).sort((a, b) => b.date.localeCompare(a.date));
  const todayRHR   = rhrWithVal.find(l => l.date === t)?.rhr_bpm || 0;
  const baseRHR    = rhrWithVal.filter(l => l.date !== t).slice(0, 7);
  const avgRHR     = baseRHR.length ? baseRHR.reduce((s, l) => s + l.rhr_bpm, 0) / baseRHR.length : 0;
  let rhrScore     = 50;
  if (avgRHR > 0 && todayRHR > 0) {
    rhrScore = Math.min(100, Math.max(0, 50 + ((avgRHR - todayRHR) / avgRHR) * 150));
  }

  return Math.round(sleepScore * 0.35 + qualityScore * 0.20 + hrvScore * 0.25 + rhrScore * 0.20);
}

// ── Gauge SVG ─────────────────────────────────────────────────────────────────
export function ArcGaugeSVG({ pct, small = false }) {
  const cx = small ? 50 : 80;
  const cy = small ? 50 : 80;
  const r  = small ? 34 : 54;
  const sw = small ? 7  : 10;
  const vw = small ? 100 : 160;
  const vh = small ? 80  : 120;

  const fillColor = pct >= 67 ? '#22c55e' : pct >= 34 ? '#f59e0b' : '#ef4444';
  const bgArc   = arcPath(cx, cy, r, 225, 270);
  const fillArc = arcPath(cx, cy, r, 225, (pct / 100) * 270);

  return (
    <svg viewBox={`0 0 ${vw} ${vh}`} className={small ? 'w-20 h-16' : 'w-40 h-[120px]'}>
      <path d={bgArc}   fill="none" stroke="#374151"   strokeWidth={sw} strokeLinecap="round"/>
      {fillArc && <path d={fillArc} fill="none" stroke={fillColor} strokeWidth={sw} strokeLinecap="round"/>}
      <text x={cx} y={cy + (small ? 6 : 8)} textAnchor="middle"
        fill="white" fontSize={small ? 18 : 26} fontWeight="bold" fontFamily="ui-monospace,monospace">
        {pct}%
      </text>
      {!small && (
        <text x={cx} y={cy + 26} textAnchor="middle" fill="#9ca3af" fontSize={9} letterSpacing="2">
          RECOVERY
        </text>
      )}
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function RecoveryGauge() {
  const t = today();
  const [logs, setLogs] = useModuleData('health_hrv_rhr', []);
  const todayLog = logs.find(l => l.date === t);
  const [hrv, setHrv] = useState(todayLog?.hrv_ms != null ? String(todayLog.hrv_ms) : '');
  const [rhr, setRhr] = useState(todayLog?.rhr_bpm != null ? String(todayLog.rhr_bpm) : '');

  const recovery = computeRecoveryScore();
  const call = recovery >= 67
    ? { label: 'GO',       cls: 'text-green-400 bg-green-500/10 border-green-500/30'  }
    : recovery >= 34
    ? { label: 'MAINTAIN', cls: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' }
    : { label: 'REST',     cls: 'text-red-400 bg-red-500/10 border-red-500/30'        };

  function upsertLog(updates) {
    let updated;
    const existing = logs.find(l => l.date === t);
    if (existing) {
      updated = logs.map(l => l.date === t ? { ...l, ...updates } : l);
    } else {
      updated = [{ id: uuid(), date: t, hrv_ms: null, rhr_bpm: null, created_at: new Date().toISOString(), ...updates }, ...logs];
    }
    setLogs(updated);
    if (supabase) {
      supabase.from('hrv_rhr_logs')
        .upsert([{ date: t, ...updates }], { onConflict: 'date' })
        .then(() => {}, () => {});
    }
  }

  function commitHRV(val) {
    const v = parseInt(val);
    if (!isNaN(v) && v > 0) upsertLog({ hrv_ms: v });
  }
  function commitRHR(val) {
    const v = parseInt(val);
    if (!isNaN(v) && v > 0) upsertLog({ rhr_bpm: v });
  }

  function stepHRV(delta) {
    const next = Math.max(1, (parseInt(hrv) || 0) + delta);
    setHrv(String(next)); upsertLog({ hrv_ms: next });
  }
  function stepRHR(delta) {
    const next = Math.max(1, (parseInt(rhr) || 0) + delta);
    setRhr(String(next)); upsertLog({ rhr_bpm: next });
  }

  return (
    <Card className="border-red-500/20">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <CardTitle>Recovery Score</CardTitle>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${call.cls}`}>
            TODAY'S CALL: {call.label}
          </span>
          <p className="text-xs text-gray-500 mt-2">Sleep · Quality · HRV · RHR vs 7-day baseline</p>
        </div>
        <ArcGaugeSVG pct={recovery}/>
      </div>

      {/* HRV + RHR inputs */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {[
          { label: 'HRV (ms)',  val: hrv, setVal: setHrv, commit: commitHRV, step: stepHRV },
          { label: 'RHR (bpm)', val: rhr, setVal: setRhr, commit: commitRHR, step: stepRHR },
        ].map(({ label, val, setVal, commit, step }) => (
          <div key={label}>
            <p className="text-xs text-gray-400 font-medium mb-1.5">{label}</p>
            <div className="flex items-center gap-1.5">
              <button onClick={() => step(-1)}
                className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 transition-colors">
                <Minus size={11}/>
              </button>
              <input
                type="number" value={val}
                onChange={e => setVal(e.target.value)}
                onBlur={e => commit(e.target.value)}
                placeholder="—"
                className="w-14 text-center bg-gray-800 border border-gray-700 rounded-lg py-1.5 text-sm text-white focus:outline-none focus:border-red-500 tabular-nums"/>
              <button onClick={() => step(1)}
                className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 transition-colors">
                <Plus size={11}/>
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
