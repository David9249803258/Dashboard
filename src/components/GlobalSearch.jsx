import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { localGet } from '../lib/storage';
import { Modal } from './ui/Modal';

function searchAll(query) {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  const results = [];

  // Transactions
  (localGet('fin_transactions') || []).filter(t =>
    (t.merchant || '').toLowerCase().includes(q) || (t.note || '').toLowerCase().includes(q)
  ).slice(0, 5).forEach(t => results.push({
    section: 'Finances', label: t.merchant || 'Transaction', sub: `${t.date} · $${t.amount}`, route: '/finances',
  }));

  // Journal entries
  const journal = localGet('productivity_journal') || {};
  Object.entries(journal).filter(([, text]) => (text || '').toLowerCase().includes(q)).slice(0, 3).forEach(([date, text]) =>
    results.push({ section: 'Journal', label: `Journal — ${date}`, sub: text.slice(0, 60) + '…', route: '/productivity' })
  );

  // Workouts
  (localGet('health_workouts') || []).filter(w => (w.exercise || '').toLowerCase().includes(q)).slice(0, 5).forEach(w =>
    results.push({ section: 'Health', label: w.exercise, sub: `${w.date} · ${w.sets}×${w.reps} @ ${w.weight}${w.weightUnit || 'lbs'}`, route: '/health' })
  );

  // Goals
  (localGet('goals_list') || []).filter(g =>
    (g.title || '').toLowerCase().includes(q) || (g.description || '').toLowerCase().includes(q)
  ).slice(0, 4).forEach(g =>
    results.push({ section: 'Goals', label: g.title, sub: g.category + ' · ' + g.status, route: '/goals' })
  );

  // Tasks
  (localGet('productivity_tasks') || []).filter(t => (t.text || '').toLowerCase().includes(q)).slice(0, 4).forEach(t =>
    results.push({ section: 'Tasks', label: t.text, sub: `${t.priority} priority${t.done ? ' · Done' : ''}`, route: '/productivity' })
  );

  // Foods logged
  (localGet('nutrition_logs') || []).filter(l => (l.foodName || '').toLowerCase().includes(q)).slice(0, 4).forEach(l =>
    results.push({ section: 'Nutrition', label: l.foodName, sub: `${l.date} · ${l.mealType} · ${Math.round(l.calories || 0)} kcal`, route: '/nutrition' })
  );

  return results;
}

const SECTION_COLORS = {
  Finances:   'text-green-400',
  Journal:    'text-indigo-400',
  Health:     'text-red-400',
  Goals:      'text-yellow-400',
  Tasks:      'text-cyan-400',
  Nutrition:  'text-orange-400',
};

export default function GlobalSearch() {
  const [open,    setOpen]    = useState(false);
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  // Keyboard shortcut Cmd/Ctrl+K
  useEffect(() => {
    function h(e) { if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setOpen(true); } }
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    setResults(searchAll(query));
  }, [query]);

  function go(route) {
    navigate(route);
    setOpen(false);
    setQuery('');
  }

  // Group by section
  const grouped = results.reduce((acc, r) => {
    if (!acc[r.section]) acc[r.section] = [];
    acc[r.section].push(r);
    return acc;
  }, {});

  return (
    <>
      <button onClick={() => setOpen(true)} title="Search (⌘K)"
        className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
        <Search size={16} />
      </button>

      <Modal open={open} onClose={() => { setOpen(false); setQuery(''); }} title="" size="md">
        <div className="-mx-5 -mt-5">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
            <Search size={16} className="text-gray-500 flex-shrink-0" />
            <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search everything… (⌘K)"
              className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm outline-none" />
            {query && <button onClick={() => setQuery('')} className="text-gray-500 hover:text-white"><X size={14}/></button>}
          </div>

          <div className="max-h-80 overflow-y-auto p-2">
            {!query && (
              <p className="text-center text-sm text-gray-500 py-8">
                Type to search transactions, journal, workouts, goals, tasks, and foods
              </p>
            )}
            {query && results.length === 0 && (
              <p className="text-center text-sm text-gray-500 py-8">No results for "{query}"</p>
            )}
            {Object.entries(grouped).map(([section, items]) => (
              <div key={section} className="mb-2">
                <p className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider ${SECTION_COLORS[section] || 'text-gray-400'}`}>{section}</p>
                {items.map((r, i) => (
                  <button key={i} onClick={() => go(r.route)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors">
                    <p className="text-sm text-white truncate">{r.label}</p>
                    <p className="text-xs text-gray-500 truncate">{r.sub}</p>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </>
  );
}
