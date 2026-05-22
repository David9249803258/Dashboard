const colors = {
  indigo: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  green:  'bg-green-500/20 text-green-300 border-green-500/30',
  yellow: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  red:    'bg-red-500/20 text-red-300 border-red-500/30',
  gray:   'bg-gray-500/20 text-gray-300 border-gray-500/30',
  purple: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  cyan:   'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
};

export function Badge({ children, color = 'indigo', className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${colors[color]} ${className}`}>
      {children}
    </span>
  );
}
