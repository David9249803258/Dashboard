import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Heart, DollarSign, Sparkles, Target, Zap, UtensilsCrossed, Settings, X } from 'lucide-react';

const NAV = [
  { to: '/',             icon: LayoutDashboard, label: 'Dashboard'    },
  { to: '/health',       icon: Heart,           label: 'Health'       },
  { to: '/nutrition',    icon: UtensilsCrossed, label: 'Nutrition'    },
  { to: '/finances',     icon: DollarSign,      label: 'Finances'     },
  { to: '/appearance',   icon: Sparkles,        label: 'Appearance'   },
  { to: '/goals',        icon: Target,          label: 'Goals'        },
  { to: '/productivity', icon: Zap,             label: 'Productivity' },
];

export function Sidebar({ open, onClose }) {
  return (
    <>
      {/* Overlay on mobile */}
      {open && <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={onClose} />}

      <aside className={`
        fixed top-0 left-0 h-full w-56 bg-gray-950 border-r border-gray-800 z-40 flex flex-col
        transition-transform duration-200
        ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <span className="text-white font-bold text-base tracking-tight">MyDashboard</span>
          <button onClick={onClose} className="lg:hidden p-1 rounded-md hover:bg-gray-800 text-gray-400">
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-800">
          <NavLink
            to="/settings"
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`
            }
          >
            <Settings size={16} />
            Settings
          </NavLink>
        </div>
      </aside>
    </>
  );
}
