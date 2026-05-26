const variants = {
  primary:   'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm hover:shadow-indigo-500/25 hover:shadow-md',
  secondary: 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 hover:border-slate-600',
  danger:    'bg-red-600 hover:bg-red-500 text-white shadow-sm hover:shadow-red-500/25',
  ghost:     'hover:bg-slate-800 text-slate-400 hover:text-white',
  success:   'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm hover:shadow-emerald-500/25',
  sky:       'bg-sky-600 hover:bg-sky-500 text-white shadow-sm hover:shadow-sky-500/25',
};

const sizes = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

export function Button({ children, variant = 'primary', size = 'md', className = '', ...props }) {
  return (
    <button
      className={`inline-flex items-center gap-1.5 rounded-xl font-medium transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
