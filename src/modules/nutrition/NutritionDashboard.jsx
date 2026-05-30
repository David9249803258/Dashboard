import { useState }  from 'react';
import { Trash2, Camera, ChevronDown, ChevronUp, RefreshCw, ExternalLink } from 'lucide-react';
import { labelForKey, unitForKey } from '../../services/nutritionTargets';

// ── Calorie ring (SVG) ────────────────────────────────────────────────────────
function CalorieRing({ consumed, target }) {
  const pct = target > 0 ? Math.min(110, (consumed / target) * 100) : 0;
  const color = pct > 105 ? '#ef4444' : pct > 90 ? '#f59e0b' : '#22c55e';
  const r = 48; const cx = 60; const cy = 60;
  const circ  = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(1, pct / 100));
  const remaining = Math.max(0, target - consumed);

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width={120} height={120} viewBox="0 0 120 120">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e293b" strokeWidth={9} />
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={9}
            strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-xl font-bold text-white tabular-nums leading-none">{Math.round(consumed)}</p>
          <p className="text-[10px] text-gray-400 leading-none mt-0.5">/ {target} kcal</p>
        </div>
      </div>
      <p className={`text-xs font-medium mt-1 ${remaining > 0 ? 'text-green-400' : 'text-red-400'}`}>
        {remaining > 0 ? `${remaining} kcal left` : `${Math.abs(target - consumed)} over`}
      </p>
    </div>
  );
}

// ── Single macro bar ──────────────────────────────────────────────────────────
function MacroBar({ label, current, target, color, unit }) {
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const barColor = pct >= 100 ? '#ef4444' : pct >= 80 ? '#22c55e' : color;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="text-white font-medium tabular-nums">{current}{unit} <span className="text-gray-600">/ {target}{unit}</span></span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: barColor }} />
      </div>
    </div>
  );
}

// ── Micronutrient grid ────────────────────────────────────────────────────────
const MICRO_KEYS = [
  'fiber_g', 'sodium_mg', 'vitamin_c_mg', 'vitamin_d_mcg',
  'vitamin_b12_mcg', 'iron_mg', 'calcium_mg', 'potassium_mg',
  'magnesium_mg', 'zinc_mg', 'omega3_g',
];

function MicroPanel({ totals, targets }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-gray-800 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-gray-400 hover:text-white hover:bg-gray-800/40 transition-colors">
        <span>Micronutrients</span>
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {open && (
        <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
          {MICRO_KEYS.map(key => {
            const current  = +(totals[key] || 0).toFixed(1);
            const target   = targets[key] || 0;
            const pct      = target > 0 ? Math.round((current / target) * 100) : 0;
            const warn     = pct < 50;
            const barColor = pct >= 75 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';
            const unit     = unitForKey(key);
            return (
              <div key={key}>
                <div className="flex items-center justify-between text-[11px] mb-0.5">
                  <span className={`${warn ? 'text-red-400' : 'text-gray-400'}`}>
                    {labelForKey(key)} {warn && '⚠️'}
                  </span>
                  <span className="text-gray-300 tabular-nums">{current}{unit} / {target}{unit}</span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, background: barColor }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Meal timeline ─────────────────────────────────────────────────────────────
function MealTimeline({ entries, onRemove }) {
  const [expanded, setExpanded] = useState({});
  const toggle = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  // Group by mealType
  const groups = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'].map(mt => ({
    type: mt,
    items: entries.filter(e => e.mealType === mt),
  })).filter(g => g.items.length > 0);

  if (groups.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Today's Meals</p>
      {groups.map(g => {
        const gCal  = g.items.reduce((s, e) => s + (e.calories || 0), 0);
        const gProt = g.items.reduce((s, e) => s + (e.protein || 0), 0);
        const key   = g.type;
        return (
          <div key={key} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <button onClick={() => toggle(key)} className="w-full flex items-center justify-between px-3 py-2.5">
              <div className="flex items-center gap-2">
                {g.items.some(e => e.source === 'photo_analysis') && (
                  <Camera size={11} className="text-indigo-400 flex-shrink-0" />
                )}
                <span className="text-sm font-medium text-white">{g.type}</span>
                <span className="text-xs text-gray-500">{Math.round(gCal)} kcal · {gProt.toFixed(1)}g P</span>
              </div>
              {expanded[key] ? <ChevronUp size={13} className="text-gray-500" /> : <ChevronDown size={13} className="text-gray-500" />}
            </button>

            {expanded[key] && (
              <div className="border-t border-gray-800 divide-y divide-gray-800">
                {g.items.map(e => (
                  <div key={e.id} className="flex items-center gap-2 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white truncate">{e.foodName}</p>
                      <p className="text-[10px] text-gray-500">{e.portionSize} · {e.calories}cal · {(e.protein||0).toFixed(1)}g P · {(e.carbs||0).toFixed(1)}g C · {(e.fat||0).toFixed(1)}g F</p>
                    </div>
                    <button onClick={() => onRemove(e.id)} className="p-1 text-gray-600 hover:text-red-400 flex-shrink-0">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Meal recommendation cards ─────────────────────────────────────────────────
const API_KEY    = import.meta.env.VITE_ANTHROPIC_API_KEY;
const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';

async function fetchRecommendations(totals, targets, nextMeal) {
  if (!API_KEY) throw new Error('API key not set');

  const remaining = {};
  Object.keys(targets).forEach(k => {
    const r = (targets[k] || 0) - (totals[k] || 0);
    if (r > 0) remaining[k] = r;
  });

  const remLines = Object.entries(remaining)
    .map(([k, v]) => `${labelForKey(k)}: ${v.toFixed(1)}${unitForKey(k)} remaining`)
    .join('\n');

  const res = await fetch(CLAUDE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 600,
      system: `You are a precision nutrition coach. Suggest 3 meals to close today's nutrient gaps.

REMAINING TARGETS:
${remLines}

Next meal type: ${nextMeal}

Return ONLY a valid JSON array, no markdown:
[{"meal_name":"string","ingredients":["string"],"why":"one sentence on what gaps it closes","approx_calories":0,"top_nutrients":["Protein: 35g"]}]`,
      messages: [{ role: 'user', content: 'Suggest 3 meals for my remaining nutrient gaps.' }],
    }),
  });

  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  const text = data.content?.[0]?.text?.trim() || '';
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Could not parse suggestions');
  return JSON.parse(match[0]);
}

function MealRecommendations({ totals, targets, nextMeal, onQuickLog }) {
  const [recs,    setRecs]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const data = await fetchRecommendations(totals, targets, nextMeal);
      setRecs(data);
    } catch (e) {
      setError(e.message || 'Could not load suggestions');
    }
    setLoading(false);
  }

  if (!API_KEY) return null;

  return (
    <div className="border border-gray-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <p className="text-xs font-semibold text-white uppercase tracking-wider">Next Meal Suggestions</p>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-white transition-colors disabled:opacity-50">
          <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
          {recs ? 'Refresh' : 'Get suggestions'}
        </button>
      </div>

      <div className="p-3">
        {loading && (
          <div className="flex items-center gap-2 py-4 text-xs text-gray-400">
            <div className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin" />
            Analysing your nutrient gaps…
          </div>
        )}
        {error && <p className="text-xs text-red-400 py-2">{error}</p>}
        {!loading && !recs && !error && (
          <p className="text-xs text-gray-500 py-2">Tap "Get suggestions" for AI-personalised meal ideas based on your remaining nutrients.</p>
        )}
        {recs && !loading && (
          <div className="space-y-2">
            {recs.map((r, i) => (
              <div key={i} className="p-3 bg-gray-800/60 rounded-xl border border-gray-700/40">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <p className="text-sm font-semibold text-white leading-snug">{r.meal_name}</p>
                  <span className="text-xs text-gray-500 flex-shrink-0 tabular-nums">~{r.approx_calories} kcal</span>
                </div>
                <p className="text-xs text-green-400 italic mb-2 leading-snug">{r.why}</p>
                <div className="flex flex-wrap gap-1 mb-2">
                  {(r.ingredients || []).map((ing, j) => (
                    <span key={j} className="text-[10px] px-1.5 py-0.5 bg-gray-700 rounded-full text-gray-300">{ing}</span>
                  ))}
                </div>
                {r.top_nutrients?.length > 0 && (
                  <p className="text-[10px] text-gray-500 mb-2">{r.top_nutrients.join(' · ')}</p>
                )}
                <button onClick={() => onQuickLog(r.meal_name)}
                  className="text-[10px] px-2.5 py-1 bg-green-600/30 hover:bg-green-600/50 text-green-400 border border-green-600/30 rounded-lg transition-colors">
                  Log this meal →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function NutritionDashboard({ totals, targets, todayLogs, onRemove, nextMeal, onQuickLog }) {
  return (
    <div className="space-y-4">
      {/* Calorie ring + macro bars */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex gap-5 items-center">
          <CalorieRing consumed={totals.calories || 0} target={targets.calories} />
          <div className="flex-1 space-y-3 min-w-0">
            <MacroBar label="Protein" current={+(totals.protein_g||0).toFixed(1)} target={targets.protein_g} color="#3b82f6" unit="g" />
            <MacroBar label="Carbs"   current={+(totals.carbs_g||0).toFixed(1)}   target={targets.carbs_g}   color="#22c55e" unit="g" />
            <MacroBar label="Fat"     current={+(totals.fat_g||0).toFixed(1)}     target={targets.fat_g}     color="#f59e0b" unit="g" />
            <MacroBar label="Fiber"   current={+(totals.fiber_g||0).toFixed(1)}   target={targets.fiber_g||25} color="#f97316" unit="g" />
          </div>
        </div>
      </div>

      {/* Micronutrients */}
      <MicroPanel totals={totals} targets={targets} />

      {/* Meal timeline */}
      <MealTimeline entries={todayLogs} onRemove={onRemove} />

      {/* Meal recommendations */}
      <MealRecommendations totals={totals} targets={targets} nextMeal={nextMeal} onQuickLog={onQuickLog} />
    </div>
  );
}
