import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { calculateTargets } from '../../services/nutritionTargets';
import { localGet, setData } from '../../lib/storage';

const PRESETS = [
  { label:'Maintenance',   cals:null, protein:null, carbs:null, fat:null }, // TDEE-calculated
  { label:'Cut (−500)',    offset:-500, protein:2.2, carbPct:0.40, fatPct:0.25 },
  { label:'Lean Bulk (+300)', offset:300, protein:2.0, carbPct:0.45, fatPct:0.25 },
  { label:'Low Carb',      offset:0, protein:1.8, carbPct:0.20, fatPct:0.40 },
];

const ACTIVITY_FACTORS = {
  sedentary:   1.2,
  light:       1.375,
  moderate:    1.55,
  active:      1.725,
  very_active: 1.9,
};

function calcTDEE({ weightKg, heightCm, age, gender, activityLevel }) {
  if (!weightKg || !heightCm || !age || !gender) return null;
  const bmr = gender === 'male'
    ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
    : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  return Math.round(bmr * (ACTIVITY_FACTORS[activityLevel] || 1.55));
}

export default function NutritionSettings({ settings, onSave }) {
  const { state } = useApp();
  const [form,  setForm]  = useState({ ...settings });
  const [saved, setSaved] = useState(false);
  const set = (k,v) => setForm(p=>({...p,[k]:v}));

  // TDEE calculator state
  const [tdeeForm, setTdeeForm] = useState({
    weightKg: state.profile?.weightUnit === 'kg' ? '' : '',
    gender:   state.profile?.gender || 'male',
    activity: state.profile?.activityLevel || 'moderate',
    goal:     'maintain',
  });
  const setT = (k,v) => setTdeeForm(p=>({...p,[k]:v}));
  const [tdeeResult, setTdeeResult] = useState(null);

  function calculateTDEE() {
    const metrics = (() => { try { return JSON.parse(localStorage.getItem('hdash_health_metrics')) || []; } catch { return []; } })();
    const sorted  = [...metrics].sort((a,b)=>b.date.localeCompare(a.date));
    const latestW = sorted[0];
    let weightKg  = +tdeeForm.weightKg;
    if (!weightKg && latestW) weightKg = state.profile?.weightUnit === 'kg' ? latestW.weight : latestW.weight * 0.453592;

    const dob = state.profile?.dob;
    const age = dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 86400000)) : 25;
    const heightCm = state.profile?.heightCm || 175;

    const tdee = calcTDEE({ weightKg, heightCm, age, gender: tdeeForm.gender, activityLevel: tdeeForm.activity });
    if (!tdee) { alert('Please enter your height and date of birth in Settings → Profile'); return; }

    const offset = tdeeForm.goal === 'cut' ? -500 : tdeeForm.goal === 'gain' ? 300 : 0;
    const targetCals = tdee + offset;
    const proteinG   = Math.round(weightKg * (tdeeForm.goal === 'cut' ? 2.2 : 2.0));
    const fatG       = Math.round((targetCals * 0.25) / 9);
    const carbG      = Math.round((targetCals - proteinG * 4 - fatG * 9) / 4);

    setTdeeResult({ tdee, targetCals, proteinG, fatG, carbG });
    setForm(p => ({ ...p, calorieGoal: targetCals, proteinGoal: proteinG, carbsGoal: carbG, fatGoal: fatG }));
  }

  // Nutrition profile state
  const [profile, setProfile] = useState(() => localGet('nutrition_profile') || {
    weight_kg: '', height_cm: state.profile?.heightCm || '', age: '', gender: state.profile?.gender || 'male',
    activity_level: state.profile?.activityLevel || 'moderate', goal: 'maintain',
  });
  const [profileSaved, setProfileSaved] = useState(false);
  const setP = (k, v) => setProfile(p => ({ ...p, [k]: v }));

  function saveProfile() {
    const p = {
      ...profile,
      weight_kg:  +profile.weight_kg  || 0,
      height_cm:  +profile.height_cm  || (state.profile?.heightCm || 175),
      age:        +profile.age        || 0,
    };
    setData('nutrition_profile', p);
    const targets = calculateTargets(p);
    setData('nutrition_targets', targets);
    setProfileSaved(true); setTimeout(() => setProfileSaved(false), 2500);
    // Sync calorie goal to settings
    if (targets.calories) {
      onSave({ ...form, calorieGoal: targets.calories, proteinGoal: targets.protein_g, carbsGoal: targets.carbs_g, fatGoal: targets.fat_g });
    }
  }

  function saveSettings() {
    onSave({ calorieGoal: +form.calorieGoal || 2000, proteinGoal: +form.proteinGoal || 150, carbsGoal: +form.carbsGoal || 250, fatGoal: +form.fatGoal || 65 });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-4">

      {/* Nutrition Profile for personalised targets */}
      <Card>
        <CardTitle>Nutrition Profile</CardTitle>
        <p className="text-xs text-gray-500 mb-3">Used to calculate your personalised calorie and micronutrient targets.</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Input label="Weight (kg)" type="number" step="0.1" placeholder="e.g. 80"
            value={profile.weight_kg} onChange={e => setP('weight_kg', e.target.value)} />
          <Input label="Height (cm)" type="number" placeholder="e.g. 180"
            value={profile.height_cm} onChange={e => setP('height_cm', e.target.value)} />
          <Input label="Age" type="number" placeholder="e.g. 28"
            value={profile.age} onChange={e => setP('age', e.target.value)} />
          <Select label="Gender" value={profile.gender} onChange={e => setP('gender', e.target.value)}>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </Select>
          <Select label="Activity Level" value={profile.activity_level} onChange={e => setP('activity_level', e.target.value)} className="col-span-2">
            <option value="sedentary">Sedentary (desk job, no exercise)</option>
            <option value="light">Lightly active (1–3 days/week)</option>
            <option value="moderate">Moderately active (3–5 days/week)</option>
            <option value="active">Very active (6–7 days/week)</option>
            <option value="very_active">Athlete (2× per day)</option>
          </Select>
        </div>
        <p className="text-xs text-gray-400 font-medium mb-2">Goal</p>
        <div className="flex gap-2 mb-3 flex-wrap">
          {[['maintain','⚖️ Maintain weight'],['lose','📉 Lose weight (−500 kcal)'],['gain','📈 Gain muscle (+300 kcal)']].map(([v,l]) => (
            <label key={v} className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer text-sm transition-colors ${profile.goal===v?'border-indigo-500 bg-indigo-500/10 text-white':'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
              <input type="radio" name="goal" value={v} checked={profile.goal===v} onChange={e=>setP('goal',e.target.value)} className="sr-only" />{l}
            </label>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={saveProfile}>Save & Recalculate Targets</Button>
          {profileSaved && <span className="text-xs text-green-400">✓ Targets updated!</span>}
        </div>
      </Card>

      {/* TDEE Calculator */}
      <Card>
        <CardTitle>TDEE Calculator (Mifflin-St Jeor)</CardTitle>
        <p className="text-xs text-gray-500 mb-3">Height and age pulled from Profile. Set your latest weight in Health → Body Metrics.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
          <Input label="Weight (kg)" type="number" step="0.1" placeholder="auto from metrics" value={tdeeForm.weightKg}
            onChange={e=>setT('weightKg',e.target.value)}/>
          <Select label="Gender" value={tdeeForm.gender} onChange={e=>setT('gender',e.target.value)}>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </Select>
          <Select label="Activity Level" value={tdeeForm.activity} onChange={e=>setT('activity',e.target.value)}>
            <option value="sedentary">Sedentary (office job)</option>
            <option value="light">Light (1–3×/wk)</option>
            <option value="moderate">Moderate (3–5×/wk)</option>
            <option value="active">Active (6–7×/wk)</option>
            <option value="very_active">Very Active (athlete)</option>
          </Select>
          <Select label="Goal" value={tdeeForm.goal} onChange={e=>setT('goal',e.target.value)} className="sm:col-span-2">
            <option value="maintain">Maintain weight</option>
            <option value="cut">Lose weight (−500 kcal)</option>
            <option value="gain">Gain muscle (+300 kcal)</option>
          </Select>
          <Button onClick={calculateTDEE} className="self-end">Calculate</Button>
        </div>

        {tdeeResult && (
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-sm">
            <p className="text-indigo-300 font-semibold mb-2">Results</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <span className="text-gray-400">Maintenance TDEE</span><span className="text-white font-medium">{tdeeResult.tdee} kcal</span>
              <span className="text-gray-400">Target calories</span><span className="text-white font-medium">{tdeeResult.targetCals} kcal</span>
              <span className="text-gray-400">Protein</span><span className="text-white font-medium">{tdeeResult.proteinG}g</span>
              <span className="text-gray-400">Carbs</span><span className="text-white font-medium">{tdeeResult.carbG}g</span>
              <span className="text-gray-400">Fat</span><span className="text-white font-medium">{tdeeResult.fatG}g</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">These values have been filled in below — save when ready.</p>
          </div>
        )}
      </Card>

      {/* Manual targets */}
      <Card>
        <CardTitle>Daily Targets</CardTitle>
        <div className="space-y-3">
          <Input label="Calorie Goal (kcal)" type="number" min="500" max="10000" step="50" value={form.calorieGoal||''} onChange={e=>set('calorieGoal',e.target.value)}/>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Protein (g)" type="number" min="0" step="5" value={form.proteinGoal||''} onChange={e=>set('proteinGoal',e.target.value)}/>
            <Input label="Carbs (g)"   type="number" min="0" step="5" value={form.carbsGoal||''}   onChange={e=>set('carbsGoal',e.target.value)}/>
            <Input label="Fat (g)"     type="number" min="0" step="5" value={form.fatGoal||''}     onChange={e=>set('fatGoal',e.target.value)}/>
          </div>
          {form.calorieGoal && (
            <p className="text-xs text-gray-500">
              Macros → {(form.proteinGoal||0)*4 + (form.carbsGoal||0)*4 + (form.fatGoal||0)*9} kcal estimated
              {' '}({Math.round(((form.proteinGoal||0)*4/(form.calorieGoal||2000))*100)}% P / {Math.round(((form.carbsGoal||0)*4/(form.calorieGoal||2000))*100)}% C / {Math.round(((form.fatGoal||0)*9/(form.calorieGoal||2000))*100)}% F)
            </p>
          )}
          <div className="flex items-center gap-3">
            <Button onClick={saveSettings}>Save Targets</Button>
            {saved && <span className="text-xs text-green-400">✓ Saved!</span>}
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>Micronutrient Reference Values (FDA)</CardTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
          {[['Fiber','25g'],['Sodium','2300mg'],['Sugar','50g'],['Vitamin C','90mg'],['Iron','18mg'],['Calcium','1000mg']].map(([n,v])=>(
            <div key={n} className="flex justify-between p-2 bg-gray-800 rounded-lg">
              <span className="text-gray-400">{n}</span>
              <span className="font-medium text-white">{v}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
