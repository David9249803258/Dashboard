import { useState, useRef } from 'react';
import { Upload, Trash2, Pin, Type, Image } from 'lucide-react';
import { useModuleData } from '../../lib/useModuleData';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { uuid } from '../../lib/utils';

const BG_COLORS = ['#1e1b4b','#14532d','#7f1d1d','#1c1917','#0c4a6e','#2d1b69','#1a1a2e'];

export default function VisionBoard() {
  const [items, setItems] = useModuleData('goals_vision_board', []);
  const [textModal, setTextModal] = useState(false);
  const [textForm, setTextForm] = useState({ text: '', bgColor: BG_COLORS[0] });
  const inputRef = useRef(null);

  const images = items.filter(i=>i.type!=='text');
  const canAdd = images.length < 12;

  function handleUpload(e) {
    const files = Array.from(e.target.files || []).slice(0, 12 - images.length);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => setItems(prev => [...prev, { id: uuid(), type: 'image', src: ev.target.result, pinned: false }]);
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  }

  function addTextCard() {
    if (!textForm.text.trim()) return;
    setItems(prev => [...prev, { id: uuid(), type: 'text', text: textForm.text, bgColor: textForm.bgColor, pinned: false }]);
    setTextForm({ text: '', bgColor: BG_COLORS[0] });
    setTextModal(false);
  }

  function remove(id) { setItems(prev => prev.filter(x => x.id !== id)); }

  function togglePin(id) {
    const pinned = items.filter(i=>i.pinned).length;
    setItems(prev => prev.map(x => {
      if (x.id !== id) return x;
      if (!x.pinned && pinned >= 3) return x; // max 3 pinned
      return { ...x, pinned: !x.pinned };
    }));
  }

  const pinnedCount = items.filter(i=>i.pinned).length;

  return (
    <Card>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <CardTitle className="mb-0">Vision Board</CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{items.length} items · {pinnedCount}/3 pinned to Home</span>
          <Button size="sm" variant="secondary" onClick={() => setTextModal(true)}><Type size={12}/> Add Text</Button>
          {canAdd && <Button size="sm" onClick={() => inputRef.current?.click()}><Upload size={12}/> Add Image</Button>}
        </div>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload}/>
      </div>

      {items.length === 0 ? (
        <EmptyState icon="🎯" message="Your vision board is empty — add images or text cards to visualize your goals"/>
      ) : (
        <div className="columns-2 sm:columns-3 gap-2 space-y-2">
          {items.map(item => (
            <div key={item.id} className="group relative rounded-xl overflow-hidden break-inside-avoid">
              {item.type === 'text'
                ? <div className="p-4 min-h-[80px] flex items-center justify-center text-center" style={{background: item.bgColor}}>
                    <p className="text-sm text-white font-medium leading-relaxed">{item.text}</p>
                  </div>
                : <img src={item.src} alt="vision" className="w-full object-cover"/>
              }
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-2">
                <button onClick={() => togglePin(item.id)} title={item.pinned ? 'Unpin from Home' : (pinnedCount >= 3 ? 'Max 3 pinned' : 'Pin to Home')}
                  className={`p-1.5 rounded-lg ${item.pinned ? 'bg-yellow-500 text-white' : 'bg-gray-700/80 text-gray-300 hover:text-yellow-400'} disabled:opacity-40`}
                  disabled={!item.pinned && pinnedCount >= 3}>
                  <Pin size={12}/>
                </button>
                <button onClick={() => remove(item.id)} className="p-1.5 bg-red-600/80 hover:bg-red-600 rounded-lg">
                  <Trash2 size={12} className="text-white"/>
                </button>
              </div>
              {item.pinned && <div className="absolute top-1.5 right-1.5"><Pin size={12} className="text-yellow-400"/></div>}
            </div>
          ))}
        </div>
      )}

      <Modal open={textModal} onClose={() => setTextModal(false)} title="Add Text Card" size="sm">
        <div className="space-y-4">
          <Input label="Text / Quote" placeholder="What do you want to achieve?" value={textForm.text}
            onChange={e => setTextForm(p=>({...p,text:e.target.value}))}/>
          <div>
            <p className="text-xs text-gray-400 font-medium mb-2">Background color</p>
            <div className="flex gap-2 flex-wrap">
              {BG_COLORS.map(c=>(
                <button key={c} onClick={()=>setTextForm(p=>({...p,bgColor:c}))}
                  className={`w-8 h-8 rounded-lg transition-transform ${textForm.bgColor===c?'ring-2 ring-white scale-110':''}`}
                  style={{background:c}}/>
              ))}
            </div>
          </div>
          <div className="p-3 rounded-lg" style={{background:textForm.bgColor}}>
            <p className="text-sm text-white text-center">{textForm.text||'Preview'}</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={addTextCard} disabled={!textForm.text.trim()}>Add Card</Button>
            <Button variant="secondary" onClick={() => setTextModal(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
