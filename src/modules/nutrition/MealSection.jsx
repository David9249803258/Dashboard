import { useState, useEffect, useRef } from 'react';
import { Search, Plus, X, Loader2, PenLine, Trash2, Camera, Check } from 'lucide-react';
import { searchFood, parseNutrients, scaleNutrients } from '../../services/usdaService';
import { analyzeMealPhoto } from '../../services/claudeService';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { localGet, localSet } from '../../lib/storage';
import { today, uuid } from '../../lib/utils';

function useDebounce(value, delay) {
  const [deb, setDeb] = useState(value);
  useEffect(() => { const t = setTimeout(()=>setDeb(value), delay); return ()=>clearTimeout(t); }, [value, delay]);
  return deb;
}

const QUICK_PORTIONS = [
  { label:'100g', grams:100 }, { label:'1 cup', grams:240 }, { label:'1 oz', grams:28 },
];

function NutrientPill({ label, value, unit }) {
  if (!value && value !== 0) return null;
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gray-800 text-[11px] text-gray-300">
      <span className="text-gray-500">{label}</span> <span className="font-medium text-white">{value}{unit}</span>
    </span>
  );
}

function ManualEntryForm({ mealType, onAdd, onCancel }) {
  const [form, setForm] = useState({ foodName:'', portionSize:'serving', calories:'', protein:'', carbs:'', fat:'', fiber:'', sodium:'', sugar:'' });
  const [error, setError] = useState('');
  const set = (k,v) => setForm(p=>({...p,[k]:v}));

  function submit() {
    if (!form.foodName.trim()) { setError('Food name required'); return; }
    if (!form.calories) { setError('Calories required'); return; }
    const entry = { id:uuid(), date:today(), mealType, foodName:form.foodName, portionSize:form.portionSize,
      calories:+form.calories||0, protein:+form.protein||0, carbs:+form.carbs||0, fat:+form.fat||0,
      fiber:+form.fiber||0, sodium:+form.sodium||0, sugar:+form.sugar||0, vitaminC:0, iron:0, calcium:0,
      createdAt: new Date().toISOString() };
    onAdd(entry);

    // Offer to save as custom food
    if (window.confirm(`Save "${form.foodName}" as a custom food for quick future access?`)) {
      const customs = localGet('custom_foods') || [];
      customs.push({ id:uuid(), ...entry });
      localSet('custom_foods', customs);
    }
  }

  return (
    <div className="mt-3 p-3 bg-gray-800/60 border border-gray-700 rounded-xl space-y-3">
      <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Manual Entry</p>
      <div className="grid grid-cols-2 gap-2">
        <Input label="Food name *" placeholder="e.g. Homemade soup" value={form.foodName} onChange={e=>set('foodName',e.target.value)} className="col-span-2"/>
        <Input label="Portion" placeholder="1 bowl" value={form.portionSize} onChange={e=>set('portionSize',e.target.value)}/>
        <Input label="Calories *" type="number" placeholder="0" value={form.calories} onChange={e=>set('calories',e.target.value)}/>
        <Input label="Protein (g)" type="number" placeholder="0" value={form.protein} onChange={e=>set('protein',e.target.value)}/>
        <Input label="Carbs (g)"   type="number" placeholder="0" value={form.carbs}   onChange={e=>set('carbs',e.target.value)}/>
        <Input label="Fat (g)"     type="number" placeholder="0" value={form.fat}     onChange={e=>set('fat',e.target.value)}/>
        <Input label="Fiber (g)"   type="number" placeholder="0" value={form.fiber}   onChange={e=>set('fiber',e.target.value)}/>
        <Input label="Sodium (mg)" type="number" placeholder="0" value={form.sodium}  onChange={e=>set('sodium',e.target.value)}/>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={submit}><Plus size={13}/> Add</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

// ── Photo AI confirmation modal ───────────────────────────────────────────────
function PhotoConfirmModal({ foods, recommendations, mealType, onConfirm, onClose }) {
  const [items, setItems] = useState(foods.map(f=>({...f,_include:true})));
  const updateItem = (i, k, v) => setItems(p=>p.map((x,idx)=>idx===i?{...x,[k]:v}:x));

  function confirm() {
    const t = today();
    const entries = items.filter(f=>f._include).map(f=>({
      id:uuid(), date:t, mealType, foodName:f.name, portionSize:f.portion||'serving',
      calories:+f.calories||0, protein:+f.protein||0, carbs:+f.carbs||0, fat:+f.fat||0,
      fiber:+f.fiber||0, sodium:+f.sodium||0, sugar:+f.sugar||0, vitaminC:+f.vitamin_c||0,
      iron:+f.iron||0, calcium:+f.calcium||0, createdAt:new Date().toISOString(),
    }));
    onConfirm(entries, recommendations);
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-400">Review identified foods — edit or uncheck to exclude:</p>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {items.map((f,i)=>(
          <div key={i} className={`flex items-start gap-2 p-2 rounded-lg border ${f._include?'border-gray-700 bg-gray-800':'border-gray-800 bg-gray-900 opacity-50'}`}>
            <input type="checkbox" checked={f._include} onChange={e=>updateItem(i,'_include',e.target.checked)} className="mt-1"/>
            <div className="flex-1 grid grid-cols-2 gap-1">
              <input value={f.name} onChange={e=>updateItem(i,'name',e.target.value)} className="col-span-2 bg-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none"/>
              <input type="number" value={f.calories} onChange={e=>updateItem(i,'calories',+e.target.value)} placeholder="Cal" className="bg-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none"/>
              <input value={f.portion} onChange={e=>updateItem(i,'portion',e.target.value)} placeholder="Portion" className="bg-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none"/>
            </div>
          </div>
        ))}
      </div>
      {recommendations && (
        <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl">
          <p className="text-xs font-semibold text-indigo-300 mb-1">💡 Recommendations</p>
          <p className="text-xs text-gray-300">{recommendations}</p>
        </div>
      )}
      <div className="flex gap-2">
        <Button onClick={confirm}>Log These Foods</Button>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}

export default function MealSection({ mealType, entries, recentFoods, onAdd, onRemove, latestRecommendation }) {
  const [query,      setQuery]      = useState('');
  const [results,    setResults]    = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [showDrop,   setShowDrop]   = useState(false);
  const [selected,   setSelected]   = useState(null);
  const [baseNutr,   setBaseNutr]   = useState(null);
  const [portionG,   setPortionG]   = useState(100);
  const [portionLbl, setPortionLbl] = useState('100g');
  const [customG,    setCustomG]    = useState('');
  const [showManual, setShowManual] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoModal,   setPhotoModal]   = useState(null);
  const wrapRef  = useRef(null);
  const photoRef = useRef(null);
  const debouncedQ = useDebounce(query, 500);

  // Custom foods appear first
  const customFoods = localGet('custom_foods') || [];

  useEffect(() => {
    if (!debouncedQ.trim() || debouncedQ.length < 2) { setResults([]); setShowDrop(false); setFetchError(''); return; }
    setLoading(true); setFetchError('');

    // Prepend matching custom foods
    const custom = customFoods.filter(f => f.foodName.toLowerCase().includes(debouncedQ.toLowerCase()))
      .map(f => ({ ...f, description: f.foodName, fdcId: `custom-${f.id}`, _isCustom: true }));

    searchFood(debouncedQ)
      .then(foods => { setResults([...custom, ...foods]); setShowDrop(true); })
      .catch(() => { setFetchError('Search failed — check connection.'); setShowDrop(false); })
      .finally(() => setLoading(false));
  }, [debouncedQ]);

  useEffect(() => {
    function h(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowDrop(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  function selectFood(food) {
    if (food._isCustom) {
      // Custom food — use stored nutrients directly
      setSelected({ ...food, description: food.foodName });
      setBaseNutr({ calories:food.calories*100/100, protein:food.protein, carbs:food.carbs, fat:food.fat, fiber:food.fiber||0, sodium:food.sodium||0, sugar:food.sugar||0, vitaminC:0, iron:0, calcium:0 });
    } else {
      setSelected(food);
      setBaseNutr(parseNutrients(food));
    }
    setQuery(food.description || food.foodName);
    setShowDrop(false);
    setPortionG(100); setPortionLbl('100g'); setCustomG('');
  }

  function setPortion(g, lbl) { setPortionG(g); setPortionLbl(lbl); setCustomG(''); }
  function handleCustomG(v) { setCustomG(v); const g=parseFloat(v); if (g>0){setPortionG(g);setPortionLbl(`${g}g`);} }

  const scaled = baseNutr && portionG > 0 ? scaleNutrients(baseNutr, portionG) : null;

  function handleAdd() {
    if (!selected || !scaled) return;
    onAdd({ id:uuid(), date:today(), mealType, foodName:selected.description||selected.foodName, portionSize:portionLbl, ...scaled, createdAt:new Date().toISOString() });
    setQuery(''); setSelected(null); setBaseNutr(null); setPortionG(100); setPortionLbl('100g'); setCustomG('');
  }

  function handleRecentChip(rf) { onAdd({ ...rf, id:uuid(), date:today(), createdAt:new Date().toISOString() }); }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setPhotoLoading(true);
    try {
      const base64 = await new Promise((res,rej) => {
        const reader = new FileReader();
        reader.onload = ev => res(ev.target.result.split(',')[1]);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      const { foods, recommendations } = await analyzeMealPhoto(base64, file.type);
      if (!foods.length) { alert("Couldn't read this meal clearly — please enter manually"); setShowManual(true); }
      else setPhotoModal({ foods, recommendations });
    } catch (err) {
      alert(import.meta.env.VITE_ANTHROPIC_API_KEY ? 'AI analysis failed — please enter manually' : 'Set VITE_ANTHROPIC_API_KEY to use photo analysis');
      setShowManual(true);
    } finally { setPhotoLoading(false); }
  }

  function confirmPhotoEntries(entries, recs) {
    entries.forEach(e => onAdd(e));
    setPhotoModal(null);
    if (recs) localSet('nutrition_last_recommendation', recs);
  }

  const mealTotals = entries.reduce((acc,e)=>({cal:acc.cal+(e.calories||0),prot:acc.prot+(e.protein||0),carbs:acc.carbs+(e.carbs||0),fat:acc.fat+(e.fat||0)}),{cal:0,prot:0,carbs:0,fat:0});

  return (
    <>
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">{mealType}</span>
            {entries.length > 0 && <span className="text-xs text-gray-500">{Math.round(mealTotals.cal)} kcal · {mealTotals.prot.toFixed(1)}g P</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={()=>photoRef.current?.click()} disabled={photoLoading}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-40">
              {photoLoading ? <Loader2 size={12} className="animate-spin"/> : <Camera size={12}/>}
              {photoLoading ? 'Analyzing…' : 'Log with Photo'}
            </button>
            <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload}/>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {recentFoods.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {recentFoods.slice(0,10).map((rf,i)=>(
                <button key={i} onClick={()=>handleRecentChip(rf)} title={`${rf.foodName} (${rf.portionSize})`}
                  className="px-2 py-0.5 rounded-full bg-gray-800 hover:bg-indigo-600/30 border border-gray-700 text-xs text-gray-300 hover:text-white transition-colors truncate max-w-[140px]">
                  {rf.foodName.length>20?rf.foodName.slice(0,20)+'…':rf.foodName}
                </button>
              ))}
            </div>
          )}

          <div className="relative" ref={wrapRef}>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"/>
              {loading && <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 animate-spin pointer-events-none"/>}
              <input className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-8 pr-8 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder={`Search foods for ${mealType.toLowerCase()}…`}
                value={query} onChange={e=>{setQuery(e.target.value);if(!e.target.value){setSelected(null);setBaseNutr(null);}}}
                onFocus={()=>results.length>0&&setShowDrop(true)}/>
              {query && <button onClick={()=>{setQuery('');setSelected(null);setBaseNutr(null);setShowDrop(false);}} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"><X size={13}/></button>}
            </div>
            {showDrop && results.length > 0 && (
              <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-h-56 overflow-y-auto">
                {results.map(food=>(
                  <button key={food.fdcId} onClick={()=>selectFood(food)} className="w-full text-left px-4 py-2.5 hover:bg-gray-800 transition-colors border-b border-gray-800/60 last:border-0">
                    <p className="text-sm text-white line-clamp-1">{food.description}{food._isCustom&&<span className="ml-1 text-xs text-indigo-400">Custom</span>}</p>
                    <p className="text-xs text-gray-500">{food.brandOwner||food.foodCategory||'Generic'}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {fetchError && <p className="text-xs text-red-400">{fetchError}</p>}

          {selected && baseNutr && (
            <div className="p-3 bg-gray-800/60 border border-indigo-500/30 rounded-xl space-y-3">
              <p className="text-xs text-indigo-300 font-medium line-clamp-1">{selected.description||selected.foodName}</p>
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-xs text-gray-500">Portion:</span>
                {QUICK_PORTIONS.map(p=>(
                  <button key={p.label} onClick={()=>setPortion(p.grams,p.label)}
                    className={`px-2 py-0.5 rounded-lg text-xs font-medium transition-colors ${portionLbl===p.label?'bg-indigo-600 text-white':'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>{p.label}</button>
                ))}
                <div className="flex items-center gap-1">
                  <input type="number" min="1" placeholder="g" value={customG} onChange={e=>handleCustomG(e.target.value)}
                    className="w-14 bg-gray-700 border border-gray-600 rounded-lg px-2 py-0.5 text-xs text-white focus:outline-none focus:border-indigo-500"/>
                  <span className="text-xs text-gray-500">g</span>
                </div>
              </div>
              {scaled && (
                <div className="flex flex-wrap gap-1">
                  <NutrientPill label="Cal"  value={Math.round(scaled.calories)} unit=""/>
                  <NutrientPill label="P"    value={scaled.protein}  unit="g"/>
                  <NutrientPill label="C"    value={scaled.carbs}    unit="g"/>
                  <NutrientPill label="F"    value={scaled.fat}      unit="g"/>
                  <NutrientPill label="Fib"  value={scaled.fiber}    unit="g"/>
                  <NutrientPill label="Na"   value={Math.round(scaled.sodium||0)} unit="mg"/>
                </div>
              )}
              <Button size="sm" onClick={handleAdd}><Plus size={13}/> Add to {mealType}</Button>
            </div>
          )}

          {!showManual && (
            <button onClick={()=>setShowManual(true)} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors">
              <PenLine size={11}/> Food not found? Enter manually
            </button>
          )}
          {showManual && <ManualEntryForm mealType={mealType} onAdd={onAdd} onCancel={()=>setShowManual(false)}/>}

          {entries.length > 0 && (
            <div className="space-y-1 pt-1 border-t border-gray-800">
              {entries.map(entry=>(
                <div key={entry.id} className="flex items-center justify-between gap-2 py-1.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate">{entry.foodName}</p>
                    <p className="text-xs text-gray-500">{entry.portionSize} · {Math.round(entry.calories||0)} kcal{entry.protein?` · ${entry.protein}g P`:''}</p>
                  </div>
                  <button onClick={()=>onRemove(entry.id)} className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-600 hover:text-red-400 flex-shrink-0"><Trash2 size={13}/></button>
                </div>
              ))}
            </div>
          )}
          {entries.length === 0 && !selected && !showManual && (
            <p className="text-xs text-gray-600 text-center py-1">No foods logged for {mealType.toLowerCase()} yet</p>
          )}
        </div>
      </div>

      <Modal open={!!photoModal} onClose={()=>setPhotoModal(null)} title="Confirm AI-Detected Foods" size="md">
        {photoModal && <PhotoConfirmModal {...photoModal} mealType={mealType} onConfirm={confirmPhotoEntries} onClose={()=>setPhotoModal(null)}/>}
      </Modal>
    </>
  );
}
