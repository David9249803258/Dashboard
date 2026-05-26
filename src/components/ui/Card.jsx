export function Card({ children, className = '' }) {
  return (
    <div className={`bg-gradient-to-br from-slate-900 to-slate-800/60 border border-slate-700/50 rounded-2xl p-4 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '' }) {
  return (
    <h2 className={`text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 ${className}`}>
      {children}
    </h2>
  );
}
