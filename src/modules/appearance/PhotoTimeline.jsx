import { useState, useRef } from 'react';
import { Upload, Trash2, ArrowLeftRight, Sparkles, X, Loader2 } from 'lucide-react';
import { useModuleData } from '../../lib/useModuleData';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { analyzeAppearancePhoto } from '../../services/claudeService';
import { today, uuid } from '../../lib/utils';
import { localGet, localSet } from '../../lib/storage';

// ── Before/after slider ───────────────────────────────────────────────────────
function CompareSlider({ photoA, photoB, onClose }) {
  const [pos, setPos] = useState(50);
  const containerRef = useRef(null);

  function onMouseMove(e) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    setPos(x);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{photoA.date}</span>
        <span>{photoB.date}</span>
      </div>
      <div ref={containerRef} className="relative select-none rounded-xl overflow-hidden cursor-col-resize aspect-[3/4]"
        onMouseMove={onMouseMove} onTouchMove={e=>{e.preventDefault();const t=e.touches[0];const rect=containerRef.current?.getBoundingClientRect();if(rect)setPos(Math.max(0,Math.min(100,((t.clientX-rect.left)/rect.width)*100)));}} style={{touchAction:'none'}}>
        {/* Right (newer) photo */}
        <img src={photoB.src} alt="After" className="absolute inset-0 w-full h-full object-cover"/>
        {/* Left (older) photo clipped */}
        <div className="absolute inset-0 overflow-hidden" style={{width:`${pos}%`}}>
          <img src={photoA.src} alt="Before" className="w-full h-full object-cover" style={{width:`${10000/pos}%`, maxWidth:'none'}}/>
        </div>
        {/* Divider */}
        <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg" style={{left:`${pos}%`, transform:'translateX(-50%)'}}>
          <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
            <ArrowLeftRight size={14} className="text-gray-700"/>
          </div>
        </div>
        <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded text-xs text-white">Before</div>
        <div className="absolute bottom-2 right-2 bg-black/60 px-2 py-0.5 rounded text-xs text-white">After</div>
      </div>
      <Button onClick={onClose} variant="secondary" className="w-full justify-center">Close</Button>
    </div>
  );
}

// ── Analysis display ──────────────────────────────────────────────────────────
function AnalysisCard({ analysis }) {
  if (!analysis) return null;
  const sections = analysis.split(/(?=GROOMING:|STYLE:|TOP IMPROVEMENTS:)/);
  return (
    <div className="space-y-2 text-xs">
      {sections.map((s, i) => {
        const [title, ...rest] = s.split(':');
        return rest.length > 0 ? (
          <div key={i} className="p-2 bg-gray-800 rounded-lg">
            <p className="text-indigo-300 font-semibold mb-0.5">{title.trim()}</p>
            <p className="text-gray-300 leading-relaxed">{rest.join(':').trim()}</p>
          </div>
        ) : null;
      }).filter(Boolean)}
    </div>
  );
}

// ── Common themes across analyses ────────────────────────────────────────────
function commonThemes(photos) {
  const analyses = photos.filter(p=>p.analysis).slice(0,3).map(p=>p.analysis||'');
  if (analyses.length < 2) return null;
  const words = analyses.flatMap(a => a.toLowerCase().match(/\b\w{5,}\b/g)||[]);
  const freq = {};
  words.forEach(w => { freq[w] = (freq[w]||0)+1; });
  const common = Object.entries(freq).filter(([,n])=>n>=2).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([w])=>w);
  return common.length ? common.join(', ') : null;
}

export default function PhotoTimeline() {
  const [photos,    setPhotos]    = useModuleData('appearance_photos', []);
  const [comparing, setComparing] = useState(null); // { a, b }
  const [selected,  setSelected]  = useState([]);
  const [analyzing, setAnalyzing] = useState(null);
  const [viewAnalysis, setViewAnalysis] = useState(null);
  const inputRef = useRef(null);

  function getWeekLabel() {
    const d = new Date(); const start = new Date(d.getFullYear(),0,1);
    return `Week ${Math.ceil(((d-start)/86400000+start.getDay()+1)/7)}, ${d.getFullYear()}`;
  }

  function handleUpload(e) {
    const files = Array.from(e.target.files||[]);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        setPhotos(prev => [{ id:uuid(), date:today(), week:getWeekLabel(), src:ev.target.result }, ...prev]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  }

  function remove(id) {
    setPhotos(prev=>prev.filter(p=>p.id!==id));
    setSelected(prev=>prev.filter(x=>x!==id));
  }

  function toggleSelect(id) {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x=>x!==id);
      if (prev.length >= 2) return [prev[1], id]; // keep latest 2
      return [...prev, id];
    });
  }

  function startCompare() {
    const [aId, bId] = selected;
    const a = photos.find(p=>p.id===aId), b = photos.find(p=>p.id===bId);
    if (a && b) setComparing({ a, b });
  }

  async function analyzePhoto(photo) {
    setAnalyzing(photo.id);
    try {
      const base64 = photo.src.split(',')[1];
      const result = await analyzeAppearancePhoto(base64, 'image/jpeg');
      setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, analysis: result } : p));
    } catch (err) {
      alert(import.meta.env.VITE_ANTHROPIC_API_KEY ? 'Analysis failed — please try again' : 'Set VITE_ANTHROPIC_API_KEY in .env to use AI analysis');
    } finally {
      setAnalyzing(null);
    }
  }

  const themes = commonThemes(photos);
  const sorted = [...photos].sort((a,b)=>b.date.localeCompare(a.date));

  return (
    <div className="space-y-4">
      {/* Progress summary from analyses */}
      {themes && (
        <div className="flex items-start gap-3 p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-xs text-indigo-300">
          <Sparkles size={13} className="flex-shrink-0 mt-0.5"/>
          <div>
            <p className="font-semibold mb-0.5">Based on your last 3 analyses, consistent feedback includes:</p>
            <p className="text-gray-300 capitalize">{themes}</p>
          </div>
        </div>
      )}

      <Card>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <CardTitle className="mb-0">Weekly Photos</CardTitle>
          <div className="flex items-center gap-2">
            {selected.length === 2 && (
              <Button size="sm" variant="secondary" onClick={startCompare}><ArrowLeftRight size={12}/> Compare</Button>
            )}
            {selected.length > 0 && (
              <span className="text-xs text-gray-400">{selected.length}/2 selected</span>
            )}
            <Button size="sm" onClick={()=>inputRef.current?.click()}><Upload size={13}/> Upload</Button>
          </div>
          <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload}/>
        </div>

        {selected.length > 0 && (
          <p className="text-xs text-gray-500 mb-2">Click photos to select for comparison (max 2)</p>
        )}

        {sorted.length === 0 ? (
          <EmptyState icon="📸" message="No progress photos yet — upload your first one above"/>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {sorted.map(p => {
              const isSelected = selected.includes(p.id);
              return (
                <div key={p.id} className={`group relative rounded-xl overflow-hidden bg-gray-800 aspect-[3/4] cursor-pointer ${isSelected?'ring-2 ring-indigo-500':''}`}
                  onClick={()=>toggleSelect(p.id)}>
                  <img src={p.src} alt={p.week} className="w-full h-full object-cover"/>
                  {isSelected && <div className="absolute top-2 right-2 w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold">{selected.indexOf(p.id)+1}</div>}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-end justify-start p-2 gap-1" onClick={e=>e.stopPropagation()}>
                    {p.analysis
                      ? <button onClick={()=>setViewAnalysis(p)} className="flex items-center gap-1 px-2 py-1 bg-indigo-600/80 rounded-lg text-xs text-white"><Sparkles size={10}/> View</button>
                      : <button onClick={()=>analyzePhoto(p)} disabled={!!analyzing} className="flex items-center gap-1 px-2 py-1 bg-indigo-600/80 hover:bg-indigo-600 rounded-lg text-xs text-white disabled:opacity-50">
                          {analyzing===p.id?<Loader2 size={10} className="animate-spin"/>:<Sparkles size={10}/>} Analyze
                        </button>
                    }
                    <button onClick={()=>remove(p.id)} className="p-1 bg-red-600/80 rounded-lg"><Trash2 size={11} className="text-white"/></button>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent pointer-events-none group-hover:opacity-0">
                    <p className="text-[10px] text-white truncate">{p.week}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Compare modal */}
      <Modal open={!!comparing} onClose={()=>setComparing(null)} title="Photo Comparison" size="sm">
        {comparing && <CompareSlider photoA={comparing.a} photoB={comparing.b} onClose={()=>setComparing(null)}/>}
      </Modal>

      {/* Analysis modal */}
      <Modal open={!!viewAnalysis} onClose={()=>setViewAnalysis(null)} title={`Analysis — ${viewAnalysis?.date}`} size="md">
        {viewAnalysis && <AnalysisCard analysis={viewAnalysis.analysis}/>}
      </Modal>
    </div>
  );
}
