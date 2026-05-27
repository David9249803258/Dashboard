import { useModuleData } from '../../lib/useModuleData';
import { Card, CardTitle } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { getLast30Days, today } from '../../lib/utils';

function rolling7Avg(data, key) {
  return data.map((point, i) => {
    const window = data.slice(Math.max(0, i - 6), i + 1).filter(p => p[key] != null);
    if (!window.length) return { ...point, avg: null };
    return { ...point, avg: +(window.reduce((s, p) => s + p[key], 0) / window.length).toFixed(1) };
  });
}

function TrendCard({ logs, metric, label, unit, color, note }) {
  const last30 = getLast30Days();
  const byDate = Object.fromEntries(logs.filter(l => l[metric]).map(l => [l.date, l[metric]]));
  const raw = last30.map(d => ({ date: d.slice(5), [metric]: byDate[d] ?? null }));
  const data = rolling7Avg(raw, metric);

  const t = today();
  const todayVal   = logs.find(l => l.date === t)?.[metric];
  const base7      = logs.filter(l => l.date !== t && l[metric]).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
  const avg7       = base7.length ? +(base7.reduce((s, l) => s + l[metric], 0) / base7.length).toFixed(1) : null;
  const diff       = todayVal != null && avg7 != null ? +(todayVal - avg7).toFixed(1) : null;
  const isHRV      = metric === 'hrv_ms';
  const diffGood   = diff != null && (isHRV ? diff >= 0 : diff <= 0);
  const diffLabel  = diff != null
    ? `${diff > 0 ? '+' : ''}${diff}${unit} ${diffGood ? 'above' : 'below'} baseline`
    : null;

  const hasData = data.some(d => d[metric] != null);

  return (
    <Card>
      <div className="flex items-start justify-between mb-2">
        <div>
          <CardTitle className="mb-0">{label}</CardTitle>
          {todayVal != null
            ? <p className="text-3xl font-bold text-white tabular-nums mt-0.5">{todayVal}<span className="text-sm text-gray-500 ml-1">{unit}</span></p>
            : <p className="text-sm text-gray-500 mt-1">No reading today</p>
          }
          {diffLabel && (
            <p className={`text-xs mt-0.5 font-medium ${diffGood ? 'text-green-400' : 'text-red-400'}`}>{diffLabel}</p>
          )}
        </div>
        <p className="text-xs text-gray-600 text-right max-w-[120px] leading-relaxed">{note}</p>
      </div>

      {hasData ? (
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`grad-${metric}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={color} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="date" stroke="#6b7280" tick={{ fontSize: 9 }} interval={6}/>
            <YAxis stroke="#6b7280" tick={{ fontSize: 10 }}/>
            <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              formatter={(v, n) => [v != null ? `${v}${unit}` : '—', n === 'avg' ? '7-day avg' : 'Reading']}/>
            <Area type="monotone" dataKey={metric} stroke={color} strokeWidth={2}
              fill={`url(#grad-${metric})`} dot={false} connectNulls/>
            <Line type="monotone" dataKey="avg" stroke={color} strokeWidth={1.5}
              strokeDasharray="4 3" dot={false} connectNulls/>
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <EmptyState icon="📊" message={`No ${label} data yet — log readings in the Recovery tab`}/>
      )}
    </Card>
  );
}

export default function HRVRHRTracker() {
  const [logs] = useModuleData('health_hrv_rhr', []);

  return (
    <div className="space-y-4">
      <TrendCard
        logs={logs} metric="hrv_ms" label="HRV" unit="ms" color="#22c55e"
        note="Higher HRV = better recovery readiness"
      />
      <TrendCard
        logs={logs} metric="rhr_bpm" label="Resting Heart Rate" unit="bpm" color="#ef4444"
        note="Lower RHR = better cardiovascular fitness"
      />
    </div>
  );
}
