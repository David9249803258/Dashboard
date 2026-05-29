import { useState, useMemo } from 'react';
import { Info, Droplets, ExternalLink, X, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useModuleData } from '../../lib/useModuleData';
import { supabase } from '../../services/supabase';
import { today } from '../../lib/utils';
import { localGet, localSet } from '../../lib/storage';
import { ProgressBar } from '../../components/ui/ProgressBar';
import MealSection from './MealSection';
import MacroProgress from './MacroProgress';
import MicroPanel from './MicroPanel';
import WeeklyReport from './WeeklyReport';
import NutritionSettings from './NutritionSettings';

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

  function addEntry(entry) { setLogs(prev=>[...prev,entry]); syncEntryToSupabase(entry); }
  function removeEntry(id) { setLogs(prev=>prev.filter(l=>l.id!==id)); }

  const totals = useMemo(() => {
    const s = f => +todayLogs.reduce((acc,e)=>acc+(e[f]||0),0).toFixed(1);
    return { calories:+s('calories').toFixed(0), protein:s('protein'), carbs:s('carbs'), fat:s('fat'),
      fiber:s('fiber'), sodium:s('sodium'), sugar:s('sugar'), vitaminC:s('vitaminC'), iron:s('iron'), calcium:s('calcium') };
  }, [todayLogs]);

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
            {/* Calorie goal progress bar */}
            {settings.calorieGoal > 0 && (
              <div className="p-3 bg-gray-900 border border-gray-800 rounded-xl">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-gray-400">Calories today</span>
                  <span className="text-white font-semibold">{Math.round(totals.calories)} <span className="text-gray-500 font-normal">/ {settings.calorieGoal} kcal</span></span>
                </div>
                <ProgressBar value={totals.calories} max={settings.calorieGoal}
                  color={totals.calories > settings.calorieGoal * 1.1 ? 'red' : totals.calories >= settings.calorieGoal * 0.8 ? 'green' : 'yellow'}/>
              </div>
            )}
            {/* Compact macro summary */}
            <div className="grid grid-cols-4 gap-2">
              {[['Cals',Math.round(totals.calories),settings.calorieGoal||0,''],['Protein',totals.protein,settings.proteinGoal,'g'],['Carbs',totals.carbs,settings.carbsGoal,'g'],['Fat',totals.fat,settings.fatGoal,'g']].map(([label,val,goal,unit])=>{
                const r = goal > 0 ? val/goal : 0;
                const barColor = label==='Protein' ? (r>=0.9?'bg-green-500':r>=0.5?'bg-yellow-500':'bg-gray-600') : (r<=0.85?'bg-indigo-500':r<=1?'bg-yellow-500':'bg-red-500');
                const textColor = label==='Protein' ? (r>=0.9?'text-green-400':r>=0.5?'text-yellow-400':'text-gray-400') : (r<=0.85?'text-gray-400':r<=1?'text-yellow-400':'text-red-400');
                return (
                  <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-2.5 text-center">
                    <p className={`text-sm font-bold tabular-nums ${textColor}`}>{val}{unit}</p>
                    <p className="text-xs text-gray-500">{label}</p>
                    {goal>0&&<div className="mt-1 h-1 bg-gray-800 rounded-full overflow-hidden"><div className={`h-full rounded-full ${barColor}`} style={{width:`${Math.min(100,r*100)}%`}}/></div>}
                  </div>
                );
              })}
            </div>
            {MEAL_TYPES.map(meal=>(
              <MealSection key={meal} mealType={meal} entries={todayLogs.filter(l=>l.mealType===meal)}
                recentFoods={recentFoods} onAdd={addEntry} onRemove={removeEntry}/>
            ))}
          </div>
        )}
        {tab === 'Macros'   && <MacroProgress totals={totals} settings={settings}/>}
        {tab === 'Micros'   && <MicroPanel    totals={totals}/>}
        {tab === 'Weekly'   && <WeeklyReport  logs={logs} calorieGoal={settings.calorieGoal}/>}
        {tab === 'Settings' && <NutritionSettings settings={settings} onSave={setSettings}/>}
      </div>
    </div>
  );
}
