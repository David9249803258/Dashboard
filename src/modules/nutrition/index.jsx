import { useState, useMemo } from 'react';
import { Info, Droplets, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useModuleData } from '../../lib/useModuleData';
import { supabase } from '../../services/supabase';
import { today } from '../../lib/utils';
import { localGet, localSet, setData } from '../../lib/storage';
import MealSection from './MealSection';
import MacroProgress from './MacroProgress';
import MicroPanel from './MicroPanel';
import WeeklyReport from './WeeklyReport';
import NutritionSettings from './NutritionSettings';
import NutritionDashboard from './NutritionDashboard';
import { calculateTargets, sumTodayTotals, DEFAULT_TARGETS } from '../../services/nutritionTargets';

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
const TABS       = ['Log', 'Macros', 'Micros', 'Weekly', 'Settings'];
const DEFAULT_SETTINGS = { calorieGoal: 0, proteinGoal: 150, carbsGoal: 250, fatGoal: 65 };

async function syncEntryToSupabase(entry) {
  if (!supabase) return;
  try {
    await supabase.from('nutrition_logs').insert({
      id: entry.id, date: entry.date, meal_type: entry.mealType, food_name: entry.foodName,
      portion_size: entry.portionSize, calories: entry.calories, protein: entry.protein,
      carbs: entry.carbs, fat: entry.fat, fiber: entry.fiber, sodium: entry.sodium,
      sugar: entry.sugar, vitamin_c: entry.vitaminC, iron: entry.iron, calcium: entry.calcium,
      vitamin_d_mcg: entry.vitaminD, vitamin_b12_mcg: entry.vitaminB12,
      potassium_mg: entry.potassium, magnesium_mg: entry.magnesium,
      zinc_mg: entry.zinc, omega3_g: entry.omega3, source: entry.source || 'manual',
    });
  } catch {}
}

export default function NutritionModule() {
  const [logs, setLogs]         = useModuleData('nutrition_logs',    []);
  const [settings, setSettings] = useModuleData('nutrition_settings', DEFAULT_SETTINGS);
  const [tab, setTab]           = useState('Log');
  const navigate = useNavigate();

  const todayLogs    = useMemo(() => logs.filter(l => l.date === today()), [logs]);
  const recentFoods  = useMemo(() => {
    const seen = new Set();
    return [...logs].sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''))
      .filter(e => { if (seen.has(e.foodName)) return false; seen.add(e.foodName); return true; }).slice(0,20);
  }, [logs]);

  // Personalized targets from profile
  const nutritionProfile = localGet('nutrition_profile') || {};
  const targets = useMemo(() => {
    const saved = localGet('nutrition_targets');
    if (saved) return saved;
    return calculateTargets(nutritionProfile);
  }, [nutritionProfile]);

  function addEntry(entry) { setLogs(prev=>[...prev,entry]); syncEntryToSupabase(entry); }
  function removeEntry(id) { setLogs(prev=>prev.filter(l=>l.id!==id)); }

  // Expanded totals including micronutrients
  const totals = useMemo(() => sumTodayTotals(todayLogs), [todayLogs]);

  // Also compute legacy format for existing components
  const legacyTotals = useMemo(() => ({
    calories: totals.calories, protein: totals.protein_g, carbs: totals.carbs_g, fat: totals.fat_g,
    fiber: totals.fiber_g, sodium: totals.sodium_mg, sugar: totals.sugar_g,
    vitaminC: totals.vitamin_c_mg, iron: totals.iron_mg, calcium: totals.calcium_mg,
  }), [totals]);

  // Next meal type (for recommendations)
  const nextMeal = useMemo(() => {
    const h = new Date().getHours();
    if (h < 10) return 'Breakfast';
    if (h < 14) return 'Lunch';
    if (h < 19) return 'Dinner';
    return 'Snacks';
  }, []);

  function quickLog(mealName) {
    // Pre-fill the search with the meal name (scroll to Log tab)
    setTab('Log');
  }

  // Water integration
  const waterData = localGet('health_water') || {};
  const waterCups = waterData[today()] || 0;
  const waterGoal = waterData.goal || 8;

  // Latest AI recommendation
  const lastRec = localGet('nutrition_last_recommendation');

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Nutrition</h1>
        {tab === 'Log' && (
          <div className="text-sm text-gray-400">
            <span className="text-white font-semibold">{Math.round(totals.calories)}</span>
            {settings.calorieGoal > 0 && <span className="text-gray-500"> / {settings.calorieGoal} kcal</span>}
          </div>
        )}
      </div>

      {/* USDA info banner — shown once */}
      {!localGet('usda_banner_seen') && (
        <div className="flex items-start gap-3 p-3 bg-gray-800/60 border border-gray-700 rounded-xl text-xs text-gray-400">
          <Info size={13} className="flex-shrink-0 mt-0.5 text-indigo-400"/>
          <span>Food search powered by the <span className="text-indigo-400 font-medium">USDA FoodData Central</span> database — over 600,000 foods. Can't find something? Use manual entry or save a custom food.</span>
          <button onClick={()=>localSet('usda_banner_seen',true)} className="ml-auto flex-shrink-0 text-gray-600 hover:text-gray-300">
            <X size={13}/>
          </button>
        </div>
      )}

      {/* AI recommendation card */}
      {lastRec && tab === 'Log' && (
        <div className="flex items-start gap-3 p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl">
          <span className="text-base flex-shrink-0">💡</span>
          <div>
            <p className="text-xs font-semibold text-indigo-300 mb-0.5">Based on your meals so far:</p>
            <p className="text-xs text-gray-300">{lastRec}</p>
          </div>
        </div>
      )}

      {/* Water — compact link to Health module */}
      {tab === 'Log' && (
        <button onClick={() => navigate('/health')}
          className="w-full flex items-center gap-2 p-2.5 bg-gray-900 border border-gray-800 rounded-xl text-left hover:border-cyan-500/40 transition-colors">
          <Droplets size={14} className="text-cyan-400 flex-shrink-0"/>
          <span className="text-xs text-cyan-400 font-medium">Track water in Health →</span>
        </button>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button key={t} onClick={()=>setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${tab===t?'bg-green-600 text-white':'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="page-enter" key={tab}>
        {tab === 'Log' && (
          <div className="space-y-4">
            {/* Profile incomplete prompt */}
            {!nutritionProfile.weight_kg && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300">
                Set your height, weight, and age in{' '}
                <button onClick={() => setTab('Settings')} className="underline font-medium">Settings</button>
                {' '}for personalized calorie and macro targets.
              </div>
            )}

            {/* Daily nutrition dashboard (ring + bars + micronutrients + timeline) */}
            <NutritionDashboard
              totals={totals}
              targets={targets}
              todayLogs={todayLogs}
              onRemove={removeEntry}
              nextMeal={nextMeal}
              onQuickLog={quickLog}
            />

            {/* Meal entry sections */}
            {MEAL_TYPES.map(meal => (
              <MealSection key={meal} mealType={meal} entries={todayLogs.filter(l => l.mealType === meal)}
                recentFoods={recentFoods} onAdd={addEntry} onRemove={removeEntry} />
            ))}
          </div>
        )}
        {tab === 'Macros'   && <MacroProgress totals={legacyTotals} settings={settings}/>}
        {tab === 'Micros'   && <MicroPanel    totals={legacyTotals}/>}
        {tab === 'Weekly'   && <WeeklyReport  logs={logs} calorieGoal={settings.calorieGoal}/>}
        {tab === 'Settings' && <NutritionSettings settings={settings} onSave={setSettings}/>}
      </div>
    </div>
  );
}
