import { useState, useRef } from 'react';
import { Upload, Trash2, ArrowLeftRight, Sparkles, Loader2, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useModuleData } from '../../lib/useModuleData';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { analyzeAppearancePhoto, extractStyleMemory } from '../../services/claudeService';
import { saveStyleMemory, getLocalStyleMemory } from '../../services/styleMemoryService';
import { today, uuid, fmtDate } from '../../lib/utils';

const SLOTS = [
  {
    key:          'face',
    label:        'Face & Grooming',
    icon:         '🧴',
    instructions: [
      'Straight on, neutral expression',
      'Good natural lighting, no filters',
      'Hair natural and visible — style and shape will be analysed',
      'Face fully visible from forehead to chin',
      'No sunglasses or hats',
    ],
    bestFor: 'skin analysis, haircut feedback, hair style recommendations, eyebrow grooming, jaw assessment, facial hair feedback',
  },
  {
    key:          'physique',
    label:        'Physique',
    icon:         '💪',
    instructions: [
      'Standing straight, arms relaxed at sides',
      'Fitted t-shirt or no shirt for accurate assessment',
      'Full torso visible front facing',
      'Good even lighting',
      'Neutral background if possible',
    ],
    bestFor: 'body composition feedback, posture analysis, frame assessment, muscle development suggestions',
  },
  {
    key:          'style',
    label:        'Style & Outfit',
    icon:         '👔',
    instructions: [
      'Full body or at minimum waist up',
      'Your actual daily style, not dressed up for the photo',
      'Clear view of outfit including shoes if possible',
      'Natural lighting',
      'Neutral or minimal background',
    ],
    bestFor: 'clothing fit assessment, color coordination, overall aesthetic, specific style upgrade recommendations',
  },
];

// ── Style score trend card ────────────────────────────────────────────────────
function StyleScoreTrend() {
  const memory = getLocalStyleMemory(20);
  const scored = [...memory].reverse().filter(e => typeof e.style_score === 'number');
  if (scored.length < 2) return null;

  const data = scored.map(e => ({ date: e.photo_date, score: e.style_score }));
  const avg  = Math.round(scored.reduce((s, e) => s + e.style_score, 0) / scored.length);
  const last = scored[scored.length - 1];
  const prev = scored[scored.length - 2];
  const trend = last.style_score > prev.style_score
    ? 'improving'
    : last.style_score < prev.style_score
    ? 'needs focus'
    : 'steady';
  const trendColor = trend === 'improving' ? 'text-emerald-400' : trend === 'needs focus' ? 'text-red-400' : 'text-slate-400';
  const mostRecent = memory[0];

  return (
    <Card className="border-teal-500/20 bg-teal-900/10">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-teal-400"/>
          <CardTitle className="mb-0 text-sm">Your Style Progress</CardTitle>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400">Avg</span>
          <span className="text-lg font-bold text-white">{avg}/10</span>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-2">
        <span className={`text-xs font-medium ${trendColor}`}>Trend: {trend}</span>
        <span className="text-[10px] text-slate-500">· {scored.length} outfit{scored.length !== 1 ? 's' : ''} analysed</span>
      </div>

      <ResponsiveContainer width="100%" height={72}>
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <XAxis dataKey="date" hide />
          <YAxis domain={[1, 10]} hide />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
            formatter={v => [`${v}/10`, 'Style Score']}
            labelFormatter={l => fmtDate(l)}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#14b8a6"
            strokeWidth={2}
            dot={{ fill: '#14b8a6', r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {mostRecent?.what_to_improve && (
        <p className="text-[10px] text-slate-500 mt-2">
          Last feedback: <span className="text-slate-400">{mostRecent.what_to_improve}</span>
        </p>
      )}
    </Card>
  );
}

// ── Before/after comparison slider ───────────────────────────────────────────
function CompareSlider({ photoA, photoB, onClose }) {
  const [pos, setPos] = useState(50);
  const ref = useRef(null);

  function move(clientX) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setPos(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{photoA.date}</span>
        <span>{photoB.date}</span>
      </div>
      <div ref={ref}
        className="relative select-none rounded-xl overflow-hidden cursor-col-resize aspect-[3/4]"
        onMouseMove={e => move(e.clientX)}
        onTouchMove={e => { e.preventDefault(); move(e.touches[0].clientX); }}
        style={{ touchAction: 'none' }}>
        <img src={photoB.src} alt="After" className="absolute inset-0 w-full h-full object-cover"/>
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
          <img src={photoA.src} alt="Before" className="w-full h-full object-cover" style={{ width: `${10000 / pos}%`, maxWidth: 'none' }}/>
        </div>
        <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg" style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}>
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

// ── AI analysis card ──────────────────────────────────────────────────────────
function AnalysisCard({ analysis }) {
  if (!analysis) return null;
  const sections = analysis.split(/(?=FACIAL:|STYLE:|PHYSIQUE:|TOP IMPROVEMENTS:)/);
  return (
    <div className="space-y-2 text-xs">
      {sections.map((s, i) => {
        const colonIdx = s.indexOf(':');
        if (colonIdx === -1) return null;
        const title = s.slice(0, colonIdx).trim();
        const body  = s.slice(colonIdx + 1).trim();
        if (!title || !body) return null;
        return (
          <div key={i} className="p-2.5 bg-gray-800 rounded-lg">
            <p className="text-indigo-300 font-semibold mb-1">{title}</p>
            <p className="text-gray-300 leading-relaxed whitespace-pre-line">{body}</p>
          </div>
        );
      }).filter(Boolean)}
    </div>
  );
}

// ── Single photo slot ─────────────────────────────────────────────────────────
function PhotoSlot({ config, analyzingId, onAnalyze }) {
  const [photos,      setPhotos]      = useModuleData(`appearance_slot_${config.key}`, []);
  const [comparing,   setComparing]   = useState(null);
  const [selected,    setSelected]    = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showInstr,   setShowInstr]   = useState(true);
  const inputRef = useRef(null);

  const sorted = [...photos].sort((a, b) => b.date.localeCompare(a.date));
  const latest = sorted[0] || null;
  const history = sorted.slice(1);

  function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setPhotos(prev => [{ id: uuid(), date: today(), src: ev.target.result }, ...prev]);
      setShowInstr(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function removePhoto(id) {
    setPhotos(prev => prev.filter(p => p.id !== id));
    setSelected(prev => prev.filter(x => x !== id));
  }

  function toggleSelect(id) {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }

  function startCompare() {
    const [aId, bId] = selected;
    const a = photos.find(p => p.id === aId);
    const b = photos.find(p => p.id === bId);
    if (a && b) { setComparing({ a, b }); setSelected([]); }
  }

  return (
    <Card>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <CardTitle className="mb-0">{config.icon} {config.label}</CardTitle>
        <div className="flex items-center gap-2">
          {latest && (
            <button onClick={() => setShowInstr(v => !v)} className="p-1.5 text-gray-500 hover:text-gray-300 rounded-lg">
              {showInstr ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
            </button>
          )}
          <Button size="sm" onClick={() => inputRef.current?.click()}>
            <Upload size={13}/> {latest ? 'Replace' : 'Upload'}
          </Button>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload}/>
        </div>
      </div>

      {/* Instructions card */}
      {showInstr && (
        <div className="mb-3 p-3 bg-gray-800/60 border border-gray-700/50 rounded-xl text-xs">
          <p className="font-medium text-gray-300 mb-2">For best results, submit a photo that shows:</p>
          <ul className="space-y-1 mb-2">
            {config.instructions.map((line, i) => (
              <li key={i} className="flex items-start gap-2 text-gray-400">
                <span className="text-indigo-400 mt-0.5 flex-shrink-0">•</span>{line}
              </li>
            ))}
          </ul>
          <p className="text-indigo-300/80">
            <span className="font-medium text-indigo-300">Best for:</span> {config.bestFor}
          </p>
        </div>
      )}

      {/* No photo yet */}
      {!latest ? (
        <EmptyState icon="📸" message="No photo uploaded yet — upload one above"/>
      ) : (
        <div className="space-y-3">
          {/* Latest photo */}
          <div className="relative rounded-xl overflow-hidden bg-gray-800 aspect-[4/3] group">
            <img src={latest.src} alt={config.label} className="w-full h-full object-cover"/>
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"/>
            <div className="absolute bottom-0 left-0 right-0 p-2.5 flex items-center justify-between">
              <span className="text-xs text-gray-300">{latest.date}</span>
              <div className="flex items-center gap-2">
                {latest.analysis
                  ? null
                  : (
                    <button
                      onClick={() => onAnalyze(latest, setPhotos)}
                      disabled={!!analyzingId}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-600/90 hover:bg-indigo-600 rounded-lg text-xs text-white disabled:opacity-50 transition-colors">
                      {analyzingId === latest.id
                        ? <><Loader2 size={10} className="animate-spin"/> Analyzing…</>
                        : <><Sparkles size={10}/> Analyze</>
                      }
                    </button>
                  )
                }
                <button onClick={() => removePhoto(latest.id)} className="p-1 bg-red-600/80 hover:bg-red-600 rounded-lg transition-colors">
                  <Trash2 size={11} className="text-white"/>
                </button>
              </div>
            </div>
          </div>

          {/* Loading state */}
          {analyzingId === latest.id && (
            <p className="text-xs text-indigo-300 text-center py-2 animate-pulse">
              Analysing your photo… this takes 10–15 seconds
            </p>
          )}

          {/* Inline analysis result */}
          {latest.analysis && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-indigo-300 flex items-center gap-1.5"><Sparkles size={11}/> AI Analysis</p>
                <button
                  onClick={() => onAnalyze(latest, setPhotos)}
                  disabled={!!analyzingId}
                  className="text-xs text-gray-500 hover:text-indigo-400 disabled:opacity-40 transition-colors">
                  {analyzingId === latest.id ? 'Analyzing…' : 'Re-analyze'}
                </button>
              </div>
              <AnalysisCard analysis={latest.analysis}/>
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div>
              <button
                onClick={() => setShowHistory(v => !v)}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 mb-2 transition-colors">
                {showHistory ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                {history.length} previous photo{history.length > 1 ? 's' : ''}
                {selected.length > 0 && <span className="text-indigo-400">({selected.length}/2 selected for compare)</span>}
              </button>

              {showHistory && (
                <>
                  <div className="grid grid-cols-4 gap-2">
                    {history.map(p => {
                      const isSel = selected.includes(p.id);
                      return (
                        <div key={p.id}
                          className={`relative rounded-lg overflow-hidden aspect-square cursor-pointer transition-all ${isSel ? 'ring-2 ring-indigo-500' : 'opacity-70 hover:opacity-100'}`}
                          onClick={() => toggleSelect(p.id)}>
                          <img src={p.src} alt="" className="w-full h-full object-cover"/>
                          {isSel && (
                            <div className="absolute top-1 right-1 w-4 h-4 bg-indigo-600 rounded-full flex items-center justify-center text-white text-[9px] font-bold">
                              {selected.indexOf(p.id) + 1}
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 p-1 bg-gradient-to-t from-black/70 to-transparent">
                            <p className="text-[9px] text-white truncate">{p.date}</p>
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); removePhoto(p.id); }}
                            className="absolute top-1 left-1 p-0.5 bg-red-600/80 rounded opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
                            <Trash2 size={9} className="text-white"/>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {selected.length === 2 && (
                    <Button size="sm" variant="secondary" className="mt-2" onClick={startCompare}>
                      <ArrowLeftRight size={11}/> Compare Selected
                    </Button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Compare modal */}
      <Modal open={!!comparing} onClose={() => setComparing(null)} title={`${config.label} — Comparison`} size="sm">
        {comparing && <CompareSlider photoA={comparing.a} photoB={comparing.b} onClose={() => setComparing(null)}/>}
      </Modal>
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PhotoTimeline() {
  const [analyzingId, setAnalyzingId] = useState(null);

  async function handleAnalyze(photo, setPhotos, slotKey, photoType) {
    setAnalyzingId(photo.id);
    let analysisText = null;
    try {
      const mediaType = photo.src.split(';')[0].split(':')[1] || 'image/jpeg';
      const base64 = photo.src.split(',')[1];
      analysisText = await analyzeAppearancePhoto(base64, mediaType, photoType);
      if (!analysisText) throw new Error('Empty response from Claude');
      try {
        setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, analysis: analysisText } : p));
      } catch (saveErr) {
        console.error('Could not save analysis result:', saveErr);
      }
      if (slotKey === 'style') {
        const structured = await extractStyleMemory(analysisText);
        await saveStyleMemory({
          photo_date: photo.date,
          raw_analysis: analysisText,
          ...(structured || {}),
        });
      }
    } catch (err) {
      if (!analysisText) {
        alert(import.meta.env.VITE_ANTHROPIC_API_KEY
          ? 'Analysis failed — please try again'
          : 'Set VITE_ANTHROPIC_API_KEY in .env to use AI analysis');
      }
    } finally {
      setAnalyzingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <StyleScoreTrend />

      <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-xs text-indigo-300 flex items-start gap-2">
        <Sparkles size={13} className="flex-shrink-0 mt-0.5"/>
        <p>Upload a photo to each slot below, then tap <strong>Analyze</strong> for AI feedback tailored to that category. Follow the photo tips for the most accurate results.</p>
      </div>

      {SLOTS.map(slot => (
        <PhotoSlot
          key={slot.key}
          config={slot}
          analyzingId={analyzingId}
          onAnalyze={(photo, setPhotos) => handleAnalyze(photo, setPhotos, slot.key, slot.label)}
        />
      ))}
    </div>
  );
}
