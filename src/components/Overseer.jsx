import { useState, useEffect, useRef } from 'react';
import { X, Send, Trash2, Zap, ChevronDown } from 'lucide-react';
import { localGet } from '../lib/storage';
import { askOverseer } from '../services/claudeService';

const STORAGE_KEY = 'overseer_chat';
const MAX_HISTORY  = 30;

const QUICK_CHIPS = [
  'How am I doing today?',
  'What should I focus on?',
  'Summarize my finances',
  'Am I hitting my goals?',
  'What habits need work?',
  'How is my health trending?',
];

function buildContext() {
  const lines = [];

  // Health
  const vitals   = localGet('health_vitals')      || {};
  const water    = localGet('health_water')        || {};
  const sups     = localGet('health_supplements')  || [];
  const supLogs  = localGet('health_sup_logs')     || {};
  const today    = new Date().toISOString().slice(0, 10);
  const todayLog = supLogs[today] || {};
  lines.push(`HEALTH: weight=${vitals.weight || '?'}lbs, sleep=${vitals.sleep || '?'}hrs, HRV=${vitals.hrv || '?'}, RHR=${vitals.rhr || '?'}, water=${water[today] || 0}/${water.goal || 8} cups`);
  const supsTotal  = sups.length;
  const supsTaken  = Object.keys(todayLog).length;
  lines.push(`SUPPLEMENTS: ${supsTaken}/${supsTotal} taken today`);

  // Nutrition
  const nutLogs  = localGet('nutrition_logs')  || {};
  const todayNut = nutLogs[today] || [];
  const totals   = todayNut.reduce((a, e) => ({
    cal: a.cal + (e.calories || 0),
    pro: a.pro + (e.protein  || 0),
    fat: a.fat + (e.fat      || 0),
    carb:a.carb+ (e.carbs    || 0),
  }), { cal: 0, pro: 0, fat: 0, carb: 0 });
  lines.push(`NUTRITION today: ${Math.round(totals.cal)} kcal, ${Math.round(totals.pro)}g protein, ${Math.round(totals.carb)}g carbs, ${Math.round(totals.fat)}g fat`);

  // Finances
  const income  = localGet('fin_income_sources') || [];
  const bills   = localGet('fin_bills')          || [];
  const assets  = localGet('fin_nw_assets')      || [];
  const liabs   = localGet('fin_nw_liabilities') || [];
  const netWorth = assets.reduce((s,a)=>s+(a.value||0),0) - liabs.reduce((s,l)=>s+(l.balance||0),0);
  const unpaidBills = bills.filter(b => !b.paid).length;
  const activeSrc = income.filter(s => s.active !== false).length;
  lines.push(`FINANCES: net worth=$${Math.round(netWorth).toLocaleString()}, ${activeSrc} active income source(s), ${unpaidBills} unpaid bill(s)`);

  // Productivity
  const tasks   = localGet('productivity_tasks')  || [];
  const habits  = localGet('productivity_habits') || [];
  const hLogs   = localGet('productivity_habit_logs') || {};
  const todayH  = hLogs[today] || {};
  const openTasks   = tasks.filter(t => !t.completed).length;
  const doneHabits  = habits.filter(h => todayH[h.id]).length;
  lines.push(`PRODUCTIVITY: ${openTasks} open task(s), ${doneHabits}/${habits.length} habits done today`);

  // Goals
  const goals = localGet('goals_list') || [];
  const activeGoals = goals.filter(g => g.status !== 'completed').length;
  lines.push(`GOALS: ${activeGoals} active goal(s) of ${goals.length} total`);

  // Appearance
  const slots    = localGet('appearance_slots')  || [];
  const outfits  = localGet('appearance_outfits')|| [];
  lines.push(`APPEARANCE: ${slots.length} routine slot(s), ${outfits.length} outfit(s) logged`);

  return lines.join('\n');
}

function loadHistory() {
  try {
    const raw = localStorage.getItem('hdash_' + STORAGE_KEY);
    return raw ? JSON.parse(raw).slice(-MAX_HISTORY) : [];
  } catch { return []; }
}

function saveHistory(msgs) {
  try {
    localStorage.setItem('hdash_' + STORAGE_KEY, JSON.stringify(msgs.slice(-MAX_HISTORY)));
  } catch {}
}

export default function Overseer() {
  const [open,    setOpen]    = useState(false);
  const [msgs,    setMsgs]    = useState(() => loadHistory());
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);
  const panelRef   = useRef(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [open, msgs.length]);

  useEffect(() => {
    function h(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  async function send(text) {
    const trimmed = (text || input).trim();
    if (!trimmed || loading) return;
    setInput('');
    setError('');

    const userMsg = { role: 'user', content: trimmed };
    const next    = [...msgs, userMsg];
    setMsgs(next);
    saveHistory(next);
    setLoading(true);

    try {
      const ctx     = buildContext();
      const apiMsgs = next.map(m => ({ role: m.role, content: m.content }));
      const reply   = await askOverseer(apiMsgs, ctx);
      const withReply = [...next, { role: 'assistant', content: reply }];
      setMsgs(withReply);
      saveHistory(withReply);
    } catch (e) {
      setError(e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    setMsgs([]);
    saveHistory([]);
    setError('');
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-20 right-4 lg:bottom-6 z-40 w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-900/50 flex items-center justify-center transition-all active:scale-95"
        aria-label="Open Overseer"
      >
        {open
          ? <ChevronDown size={20} className="text-white" />
          : <Zap size={20} className="text-white" />
        }
      </button>

      {/* Chat panel */}
      {open && (
        <div
          ref={panelRef}
          className="fixed bottom-36 right-4 lg:bottom-24 z-40 w-[min(340px,calc(100vw-2rem))] flex flex-col bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden"
          style={{ maxHeight: 'min(480px, calc(100vh - 160px))' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 flex-shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-indigo-400" />
                <span className="text-sm font-bold text-white tracking-wide">OVERSEER</span>
                <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  online
                </span>
              </div>
              <p className="text-[10px] text-gray-500 mt-0.5">Knows your entire dashboard. Ask anything.</p>
            </div>
            <div className="flex items-center gap-1">
              {msgs.length > 0 && (
                <button onClick={clear} className="p-1.5 text-gray-600 hover:text-red-400 transition-colors rounded-lg" title="Clear chat">
                  <Trash2 size={13} />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1.5 text-gray-600 hover:text-white transition-colors rounded-lg">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
            {msgs.length === 0 && (
              <div className="text-center py-4">
                <Zap size={28} className="mx-auto text-indigo-500 mb-2" />
                <p className="text-xs text-gray-400 font-medium">Your personal dashboard AI</p>
                <p className="text-[10px] text-gray-600 mt-1">Ask about your health, finances, habits, or goals</p>
              </div>
            )}

            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-sm'
                    : 'bg-gray-800 text-gray-200 rounded-bl-sm'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-800 px-3 py-2 rounded-2xl rounded-bl-sm flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            {error && (
              <div className="text-[10px] text-red-400 text-center px-2 py-1 bg-red-500/10 rounded-xl border border-red-500/20">
                {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Quick chips */}
          {msgs.length === 0 && (
            <div className="px-3 pb-2 flex-shrink-0">
              <div className="flex flex-wrap gap-1.5">
                {QUICK_CHIPS.map(chip => (
                  <button
                    key={chip}
                    onClick={() => send(chip)}
                    disabled={loading}
                    className="text-[10px] px-2.5 py-1 bg-gray-800 hover:bg-indigo-600/30 border border-gray-700 hover:border-indigo-500/50 text-gray-400 hover:text-indigo-300 rounded-xl transition-all disabled:opacity-50"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="px-3 pb-3 pt-2 border-t border-gray-800 flex-shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask anything about your dashboard…"
                rows={1}
                disabled={loading}
                className="flex-1 resize-none bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 outline-none transition-colors max-h-24 overflow-y-auto disabled:opacity-50"
                style={{ lineHeight: '1.4' }}
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || loading}
                className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors flex-shrink-0"
              >
                <Send size={14} className="text-white" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
