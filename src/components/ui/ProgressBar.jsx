export function ProgressBar({ value, max = 100, color = 'indigo', className = '', showLabel = false }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const colors = {
    indigo: 'bg-indigo-500',
    green:  'bg-emerald-500',
    yellow: 'bg-amber-500',
    red:    'bg-red-500',
    cyan:   'bg-cyan-500',
    blue:   'bg-sky-500',
    rose:   'bg-rose-500',
    violet: 'bg-violet-500',
    teal:   'bg-teal-500',
    amber:  'bg-amber-500',
  };
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colors[color] || colors.indigo}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && <span className="text-xs text-slate-400 w-8 text-right tabular-nums">{pct}%</span>}
    </div>
  );
}
