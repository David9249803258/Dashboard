import { useState, useEffect, useMemo, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, ReferenceArea,
} from 'recharts';
import { localGet, localSet } from '../lib/storage';
import { today, uuid } from '../lib/utils';
import { Card, CardTitle } from './ui/Card';
import { Button } from './ui/Button';

// ── Circadian baseline curve ──────────────────────────────────────────────────
const BASE_CURVE = {
  0:2, 1:1, 2:1, 3:1, 4:2, 5:3,
  6:5, 7:6, 8:7, 9:8, 10:8, 11:7,
  12:6, 13:5, 14:4, 15:5, 16:6, 17:6,
  18:5, 19:5, 20:4, 21:3, 22:2, 23:2,
};

function getSleepAdj(hours, quality) {
  if (hours >= 8 && quality >= 4) return 1.2;
  if (hours >= 7) return 1.0;
  if (hours >= 6) return 0.85;
  if (hours >= 5) return 0.7;
  return 0.55;
}

function getPredicted(hour, sleepHours, sleepQuality, historyLogs) {
  const uniqueDays = new Set(historyLogs.map(l => l.date));
  if (uniqueDays.size >= 14) {
    const hourLogs = historyLogs.filter(l => l.hour === hour);
    if (hourLogs.length >= 3) {
      return Math.round(hourLogs.reduce((s, l) => s + l.energy_level, 0) / hourLogs.length);
    }
  }
  const base = BASE_CURVE[hour] ?? 5;
  const adj  = getSleepAdj(sleepHours, sleepQuality);
  return Math.min(10, Math.max(1, Math.round(base * adj)));
}

function fmtHour(h) {
  if (h === 0) return '12AM';
  if (h === 12) return '12PM';
  return h < 12 ? `${h}AM` : `${h - 12}PM`;
}

function energyEmoji(v) {
  if (v <= 2) return '😴';
  if (v <= 4) return '😔';
  if (v <= 6) return '😐';
  if (v <= 8) return '⚡';
  return '🔥';
}

function energyLabel(v) {
  if (v <= 2) return 'Exhausted';
  if (v <= 4) return 'Low';
  if (v <= 6) return 'Okay';
  if (v <= 8) return 'Good';
  return 'Peak';
}

// ── Custom tooltip ─────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const pred = payload.find(p => p.dataKey === 'predicted');
  const logd = payload.find(p => p.dataKey === 'logged');
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-white mb-1">{fmtHour(label)}</p>
      {pred && <p className="text-gray-400">Predicted: <span className="text-blue-300 font-medium">{pred.value}/10</span></p>}
      {logd?.value != null && (
        <p className="text-gray-400">Logged: <span className="text-indigo-300 font-medium">{logd.value}/10 {energyEmoji(logd.value)}</span></p>
      )}
    </div>
  );
}

// ── Logged dot — only renders where data exists ───────────────────────────────
function LoggedDot(props) {
  const { cx, cy, payload } = props;
  if (payload.logged == null || !isFinite(cx) || !isFinite(cy)) return null;
  return <circle cx={cx} cy={cy} r={5} fill="#6366f1" stroke="#1e1b4b" strokeWidth={2} />;
}

// ── Recommendation card ───────────────────────────────────────────────────────
function RecCard({ icon, label, window: win, energy, past }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border ${
      past ? 'border-gray-700/40 bg-gray-800/20' : 'border-indigo-500/20 bg-indigo-500/5'
    }`}>
      <span className="text-2xl flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-semibold ${past ? 'text-gray-500' : 'text-white'}`}>{label}</p>
        <p className={`text-xs mt-0.5 ${past ? 'text-gray-600' : 'text-gray-400'}`}>{win}</p>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-lg font-medium flex-shrink-0 ${
        past ? 'bg-gray-700 text-gray-500' : 'bg-indigo-500/20 text-indigo-300'
      }`}>
        {past ? 'Passed' : `${energy}/10`}
      </span>
    </div>
  );
}

// ── Weekly patterns ───────────────────────────────────────────────────────────
function WeeklyPatterns({ logs }) {
  const info = useMemo(() => {
    const hourAvgs = Array.from({ length: 24 }, (_, h) => {
      const entries = logs.filter(l => l.hour === h);
      return entries.length
        ? { h, avg: entries.reduce((s, l) => s + l.energy_level, 0) / entries.length }
        : { h, avg: 0 };
    });
    const peaks = hourAvgs.filter(x => x.avg >= 7).sort((a, b) => b.avg - a.avg).slice(0, 4);
    const lows  = hourAvgs.filter(x => x.avg > 0 && x.avg <= 4).sort((a, b) => a.avg - b.avg).slice(0, 2);

    const sleepLogs = localGet('health_sleep') || [];
    const days = [...new Set(logs.map(l => l.date))];
    let gSum = 0, gN = 0, pSum = 0, pN = 0;
    days.forEach(date => {
      const sl = sleepLogs.find(s => s.date === date);
      if (!sl) return;
      const dl = logs.filter(l => l.date === date);
      const avg = dl.reduce((s, l) => s + l.energy_level, 0) / dl.length;
      if (sl.hours >= 7) { gSum += avg; gN++; } else { pSum += avg; pN++; }
    });
    return {
      peaks, lows,
      goodAvg: gN ? (gSum / gN).toFixed(1) : null,
      poorAvg: pN ? (pSum / pN).toFixed(1) : null,
    };
  }, [logs]);

  return (
    <div className="space-y-1.5 text-xs text-gray-400">
      <p className="text-xs font-semibold text-white mb-2">Weekly Patterns</p>
      {info.peaks.length > 0 && (
        <p>⚡ Peak energy typically at <span className="text-white font-medium">{info.peaks.map(x => fmtHour(x.h)).join(', ')}</span></p>
      )}
      {info.lows.length > 0 && (
        <p>😴 Lowest point typically at <span className="text-white font-medium">{info.lows.map(x => fmtHour(x.h)).join(', ')}</span></p>
      )}
      {info.goodAvg && info.poorAvg && (
        <p>
          💤 <span className="text-emerald-400 font-medium">{info.goodAvg}/10</span> avg on 7h+ sleep vs{' '}
          <span className="text-red-400 font-medium">{info.poorAvg}/10</span> on under 7h
        </p>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function EnergyTimeline() {
  const t   = today();
  const KEY = 'energy_logs';

  const allLogsRef = useRef(localGet(KEY) || []);
  const [logs,     setLogs]     = useState(allLogsRef.current);
  const [logHour,  setLogHour]  = useState(() => new Date().getHours());
  const [energy,   setEnergy]   = useState(5);
  const [focus,    setFocus]    = useState(3);
  const [note,     setNote]     = useState('');
  const [saved,    setSaved]    = useState(false);
  const [showFull, setShowFull] = useState(false);
  const [nowPos,   setNowPos]   = useState(() => new Date().getHours() + new Date().getMinutes() / 60);

  // Tick current-time marker every minute
  useEffect(() => {
    const id = setInterval(() => {
      const n = new Date();
      setNowPos(n.getHours() + n.getMinutes() / 60);
    }, 60000);
    return () => clearInterval(id);
  }, []);

  // Sleep data for prediction
  const sleepLogs    = useMemo(() => localGet('health_sleep') || [], []);
  const lastSleep    = useMemo(() => [...sleepLogs].sort((a, b) => b.date.localeCompare(a.date))[0], [sleepLogs]);
  const sleepHours   = lastSleep?.hours   || 7;
  const sleepQuality = lastSleep?.quality || 3;

  const todayLogs   = useMemo(() => logs.filter(l => l.date === t), [logs, t]);
  const historyLogs = useMemo(() => logs.filter(l => l.date !== t), [logs, t]);
  const uniqueDays  = useMemo(() => new Set(historyLogs.map(l => l.date)).size, [historyLogs]);

  const minHour = showFull ? 0 : 6;
  const maxHour = 23;
  const hours   = useMemo(() =>
    Array.from({ length: maxHour - minHour + 1 }, (_, i) => i + minHour),
    [minHour]
  );

  const chartData = useMemo(() => hours.map(h => ({
    hour:      h,
    predicted: getPredicted(h, sleepHours, sleepQuality, historyLogs),
    logged:    todayLogs.find(l => l.hour === h)?.energy_level ?? null,
  })), [hours, sleepHours, sleepQuality, historyLogs, todayLogs]);

  // Compute optimal windows from predicted curve
  const { dwHour, dwEnergy, woHour, woEnergy, recovHour } = useMemo(() => {
    const morning   = chartData.filter(d => d.hour >= 8  && d.hour <= 12);
    const afternoon = chartData.filter(d => d.hour >= 12 && d.hour <= 20);
    const dw = morning.length   ? morning.reduce((b, c)   => c.predicted >= b.predicted ? c : b, morning[0])   : { hour: 9,  predicted: 7 };
    const wo = afternoon.length ? afternoon.reduce((b, c) => c.predicted >= b.predicted ? c : b, afternoon[0]) : { hour: 17, predicted: 6 };
    const rv = chartData.length ? chartData.reduce((b, c) => c.predicted <= b.predicted ? c : b, chartData[0]) : { hour: 14, predicted: 4 };
    return { dwHour: dw.hour, dwEnergy: dw.predicted, woHour: wo.hour, woEnergy: wo.predicted, recovHour: rv.hour };
  }, [chartData]);

  const xTicks = useMemo(() => hours.filter(h => h % (showFull ? 3 : 2) === 0), [hours, showFull]);
  const nowInt = Math.floor(nowPos);

  const hasPersonalData = useMemo(() => new Set(historyLogs.map(l => l.date)).size >= 14, [historyLogs]);

  function logEnergy() {
    const entry = {
      id: uuid(), date: t, hour: logHour,
      energy_level: energy, focus_quality: focus,
      notes: note, created_at: new Date().toISOString(),
    };
    // Upsert: replace existing entry for same hour today
    const updated = [...logs.filter(l => !(l.date === t && l.hour === logHour)), entry];
    setLogs(updated);
    localSet(KEY, updated);
    setSaved(true);
    setNote('');
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <Card>
      {/* Header */}
      <div className="flex items-start justify-between mb-3 gap-2 flex-wrap">
        <div>
          <CardTitle className="mb-0">Energy Timeline — Today</CardTitle>
          {!hasPersonalData && (
            <p className="text-[10px] text-gray-500 mt-0.5">Typical circadian curve — log sleep and hourly energy to personalize</p>
          )}
        </div>
        <button onClick={() => setShowFull(v => !v)}
          className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors whitespace-nowrap flex-shrink-0">
          {showFull ? 'Show 6AM–11PM' : 'Full 24h'}
        </button>
      </div>

      {/* Chart */}
      <div className="overflow-x-auto -mx-1">
        <div style={{ minWidth: 460 }} className="px-1">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>

              {/* Zone bands */}
              {dwHour >= minHour && (
                <ReferenceArea x1={dwHour} x2={Math.min(maxHour, dwHour + 2)}
                  fill="rgba(99,102,241,0.09)" fillOpacity={1} />
              )}
              {woHour >= minHour && (
                <ReferenceArea x1={woHour} x2={Math.min(maxHour, woHour + 2)}
                  fill="rgba(34,197,94,0.07)" fillOpacity={1} />
              )}
              {recovHour >= minHour && (
                <ReferenceArea
                  x1={Math.max(minHour, recovHour - 1)}
                  x2={Math.min(maxHour, recovHour + 1)}
                  fill="rgba(239,68,68,0.06)" fillOpacity={1} />
              )}

              {/* Current time line */}
              {nowPos >= minHour && nowPos <= maxHour && (
                <ReferenceLine x={nowPos} stroke="#818cf8" strokeWidth={1.5} strokeDasharray="4 3"
                  label={{ value: 'Now', position: 'insideTopRight', fill: '#818cf8', fontSize: 8 }} />
              )}

              <XAxis dataKey="hour" type="number" domain={[minHour, maxHour]}
                ticks={xTicks} tickFormatter={fmtHour}
                stroke="#374151" tick={{ fontSize: 9, fill: '#6b7280' }} />
              <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]}
                stroke="#374151" tick={{ fontSize: 9, fill: '#6b7280' }} />
              <Tooltip content={<ChartTooltip />} />

              {/* Predicted — dashed */}
              <Line dataKey="predicted" type="monotone" stroke="#475569" strokeWidth={1.5}
                strokeDasharray="5 3" dot={false} name="Predicted" />

              {/* Logged — solid with dots */}
              <Line dataKey="logged" type="monotone" stroke="#6366f1" strokeWidth={2.5}
                dot={<LoggedDot />} activeDot={{ r: 6, fill: '#6366f1' }}
                connectNulls={false} name="Logged" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[10px] text-gray-500">
        <span className="flex items-center gap-1.5">
          <svg width={20} height={4}><line x1={0} y1={2} x2={20} y2={2} stroke="#475569" strokeWidth={1.5} strokeDasharray="5 3"/></svg>
          Predicted
        </span>
        <span className="flex items-center gap-1.5">
          <svg width={20} height={4}><line x1={0} y1={2} x2={20} y2={2} stroke="#6366f1" strokeWidth={2}/></svg>
          Logged
        </span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-indigo-500/20 inline-block"/> Deep Work</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500/15 inline-block"/> Workout</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500/10 inline-block"/> Recovery</span>
      </div>

      {/* Recommendations */}
      <div className="grid sm:grid-cols-2 gap-2 mt-4">
        <RecCard
          icon="🧠" label="Deep Work Window"
          window={`${fmtHour(dwHour)}–${fmtHour(dwHour + 2)} · predicted ${dwEnergy}/10`}
          energy={dwEnergy} past={nowInt > dwHour + 2}
        />
        <RecCard
          icon="💪" label="Optimal Workout Window"
          window={`${fmtHour(woHour)}–${fmtHour(woHour + 2)} · predicted ${woEnergy}/10`}
          energy={woEnergy} past={nowInt > woHour + 2}
        />
      </div>

      {/* Log panel */}
      <div className="mt-4 pt-4 border-t border-gray-800">
        <p className="text-xs font-semibold text-white mb-3">Log How You Feel</p>
        <div className="space-y-3">
          {/* Hour picker */}
          <div>
            <p className="text-[10px] text-gray-500 mb-1.5 uppercase tracking-wider">Hour</p>
            <div className="flex flex-wrap gap-1">
              {[6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23].map(h => {
                const logged = todayLogs.some(l => l.hour === h);
                return (
                  <button key={h} onClick={() => setLogHour(h)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-medium transition-all ${
                      logHour === h
                        ? 'bg-indigo-600 text-white'
                        : logged
                        ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                        : 'bg-gray-800 text-gray-500 hover:text-white hover:bg-gray-700'
                    }`}>
                    {fmtHour(h)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Energy slider */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Energy Level</p>
              <span className="text-sm font-semibold text-white">{energyEmoji(energy)} {energy}/10 — {energyLabel(energy)}</span>
            </div>
            <input type="range" min={1} max={10} value={energy}
              onChange={e => setEnergy(+e.target.value)}
              className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
              style={{ background: `linear-gradient(to right, #ef4444 0%, #f59e0b 40%, #22c55e 100%)` }}
            />
            <div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
              <span>😴 Low</span><span>😐 Okay</span><span>🔥 Peak</span>
            </div>
          </div>

          {/* Focus stars */}
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Focus Quality</p>
            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map(s => (
                <button key={s} onClick={() => setFocus(s)}
                  className={`text-xl transition-transform hover:scale-110 ${s <= focus ? 'opacity-100' : 'opacity-20'}`}>
                  ⭐
                </button>
              ))}
              <span className="text-xs text-gray-500 ml-1">{focus}/5</span>
            </div>
          </div>

          {/* Note */}
          <input
            type="text" value={note} onChange={e => setNote(e.target.value)}
            placeholder="Note (optional) — e.g. post-lunch dip, coffee kicked in"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
          />

          <Button onClick={logEnergy} size="sm" className="w-full justify-center">
            {saved ? '✓ Logged!' : `Log ${fmtHour(logHour)}`}
          </Button>
        </div>
      </div>

      {/* Weekly patterns */}
      <div className="mt-4 pt-4 border-t border-gray-800">
        {uniqueDays >= 7 ? (
          <WeeklyPatterns logs={logs} />
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-white mb-0.5">Weekly Patterns</p>
              <p className="text-xs text-gray-500">Keep logging hourly energy — patterns unlock after 7 days of data</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xl font-bold text-indigo-400">{uniqueDays}/7</p>
              <p className="text-[10px] text-gray-600">days logged</p>
            </div>
          </div>
        )}
      </div>

      {/* Health band integration placeholder */}
      <div className="mt-4 pt-4 border-t border-gray-800">
        <div className="flex items-start gap-3 p-3 bg-gray-800/40 rounded-xl border border-gray-700/30">
          <span className="text-xl flex-shrink-0 mt-0.5">⌚</span>
          <div>
            <p className="text-xs font-semibold text-gray-300">Connect Your Wearable</p>
            <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
              Once connected, HRV, heart rate, and sleep stages will automatically build your energy graph without manual logging.
              Integration ready — connect in Settings when your device arrives.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
