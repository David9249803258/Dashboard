import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Heart, DollarSign, Sparkles, Target, Zap, UtensilsCrossed, Settings, X } from 'lucide-react';

const NAV = [
  {
    to: '/',
    icon: LayoutDashboard,
    label: 'Dashboard',
    activeClass: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 shadow-[0_0_10px_rgba(99,102,241,0.15)]',
    dotColor: 'bg-indigo-400',
  },
  {
    to: '/health',
    icon: Heart,
    label: 'Health',
    activeClass: 'bg-rose-500/15 text-rose-400 border border-rose-500/20 shadow-[0_0_10px_rgba(251,113,133,0.15)]',
    dotColor: 'bg-rose-400',
  },
  {
    to: '/nutrition',
    icon: UtensilsCrossed,
    label: 'Nutrition',
    activeClass: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(52,211,153,0.15)]',
    dotColor: 'bg-emerald-400',
  },
  {
    to: '/finances',
    icon: DollarSign,
    label: 'Finances',
    activeClass: 'bg-sky-500/15 text-sky-400 border border-sky-500/20 shadow-[0_0_10px_rgba(56,189,248,0.15)]',
    dotColor: 'bg-sky-400',
  },
  {
    to: '/appearance',
    icon: Sparkles,
    label: 'Appearance',
    activeClass: 'bg-teal-500/15 text-teal-400 border border-teal-500/20 shadow-[0_0_10px_rgba(45,212,191,0.15)]',
    dotColor: 'bg-teal-400',
  },
  {
    to: '/goals',
    icon: Target,
    label: 'Goals',
    activeClass: 'bg-amber-500/15 text-amber-400 border border-amber-500/20 shadow-[0_0_10px_rgba(251,191,36,0.15)]',
    dotColor: 'bg-amber-400',
  },
  {
    to: '/productivity',
    icon: Zap,
    label: 'Productivity',
    activeClass: 'bg-violet-500/15 text-violet-400 border border-violet-500/20 shadow-[0_0_10px_rgba(167,139,250,0.15)]',
    dotColor: 'bg-violet-400',
  },
];

export function Sidebar({ open, onClose }) {
  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-30 lg:hidden" onClick={onClose} />
      )}

      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-slate-950 border-r border-slate-800/60 z-40 flex flex-col
        transition-transform duration-200 ease-out
        ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-slate-800/60">
          <div>
            <p className="text-white font-bold text-lg tracking-tight leading-none">MyDashboard</p>
            <p className="text-xs text-slate-500 mt-1">Personal command center</p>
          </div>
          <button onClick={onClose} className="lg:hidden p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto mt-1">
          {NAV.map(({ to, icon: Icon, label, activeClass }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? activeClass
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/70 border border-transparent'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Settings */}
        <div className="p-3 border-t border-slate-800/60">
          <NavLink
            to="/settings"
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 border ${
                isActive
                  ? 'bg-slate-700/60 text-white border-slate-600/50'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/70 border-transparent'
              }`
            }
          >
            <Settings size={18} />
            Settings
          </NavLink>
        </div>
      </aside>
    </>
  );
}
