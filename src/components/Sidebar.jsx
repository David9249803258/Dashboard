import { NavLink } from 'react-router-dom';
import { useApp }  from '../context/AppContext';
import {
  LayoutDashboard, Heart, DollarSign, Sparkles,
  Target, Zap, UtensilsCrossed, Settings, X, Briefcase,
} from 'lucide-react';

const NAV_GROUPS = [
  {
    label: 'YOUR LIFE',
    items: [
      { to: '/', end: true, icon: LayoutDashboard, label: 'Home',
        activeClass: 'bg-indigo-500/10 text-indigo-300', accentColor: '#818cf8' },
      { to: '/goals', icon: Target, label: 'Goals',
        activeClass: 'bg-amber-500/10 text-amber-300', accentColor: '#fcd34d' },
    ],
  },
  {
    label: 'WELLNESS',
    items: [
      { to: '/health', icon: Heart, label: 'Health',
        activeClass: 'bg-rose-500/10 text-rose-300', accentColor: '#fda4af' },
      { to: '/nutrition', icon: UtensilsCrossed, label: 'Nutrition',
        activeClass: 'bg-emerald-500/10 text-emerald-300', accentColor: '#6ee7b7' },
      { to: '/appearance', icon: Sparkles, label: 'Appearance',
        activeClass: 'bg-teal-500/10 text-teal-300', accentColor: '#5eead4' },
    ],
  },
  {
    label: 'MONEY',
    items: [
      { to: '/finances', icon: DollarSign, label: 'Finances',
        activeClass: 'bg-sky-500/10 text-sky-300', accentColor: '#7dd3fc' },
    ],
  },
  {
    label: 'WORK',
    items: [
      { to: '/productivity', icon: Zap, label: 'Productivity',
        activeClass: 'bg-violet-500/10 text-violet-300', accentColor: '#c4b5fd' },
    ],
  },
];

export function Sidebar({ open, onClose }) {
  const { state } = useApp();
  const name   = state.profile?.name || 'Dashboard';
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'ME';

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-30 lg:hidden" onClick={onClose} />
      )}

      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-slate-950 border-r border-slate-800/50 z-40 flex flex-col
        transition-transform duration-200 ease-out
        ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Profile header */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-indigo-600/80 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm truncate leading-tight">{name || 'My Dashboard'}</p>
              <p className="text-[10px] text-slate-500 leading-tight mt-0.5">Personal command center</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 transition-colors flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Grouped nav */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-4">
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              <p className="section-label px-2 mb-1.5">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map(({ to, end, icon: Icon, label, activeClass, accentColor }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                        isActive
                          ? activeClass
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                      }`
                    }
                    style={({ isActive }) => isActive ? { borderLeft: `3px solid ${accentColor}` } : { borderLeft: '3px solid transparent' }}
                  >
                    {({ isActive }) => (
                      <>
                        <Icon size={17} />
                        <span>{label}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Divider + Settings */}
        <div className="px-3 pb-3 border-t border-slate-800/50 pt-3">
          <NavLink
            to="/settings"
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-slate-700/50 text-slate-200'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`
            }
            style={{ borderLeft: '3px solid transparent' }}
          >
            <Settings size={17} />
            Settings
          </NavLink>
        </div>
      </aside>
    </>
  );
}
