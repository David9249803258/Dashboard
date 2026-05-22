import { useState, useRef } from 'react';
import { Plus, Trash2, Upload } from 'lucide-react';
import { useModuleData } from '../../lib/useModuleData';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { today, uuid } from '../../lib/utils';

export default function StyleNotes() {
  const [notes, setNotes] = useModuleData('appearance_style_notes', []);
  const [form, setForm] = useState({ date: today(), text: '', photo: null });
  const imgRef = useRef(null);

  function handlePhoto(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setForm(p => ({ ...p, photo: ev.target.result }));
    reader.readAsDataURL(file);
  }

  function save() {
    if (!form.text.trim()) return;
    setNotes(prev => [{ id: uuid(), ...form }, ...prev]);
    setForm({ date: today(), text: '', photo: null });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>New Style Note</CardTitle>
        <div className="space-y-3">
          <Input label="Date" type="date" value={form.date} onChange={e => setForm(p=>({...p,date:e.target.value}))} className="max-w-xs"/>
          <Textarea label="What are you wearing / style notes" rows={3} placeholder="Outfit details, how you felt, what worked..."
            value={form.text} onChange={e => setForm(p=>({...p,text:e.target.value}))} />
          <div className="flex items-center gap-3">
            <Button size="sm" variant="secondary" onClick={() => imgRef.current?.click()}>
              <Upload size={13}/> Add Photo
            </Button>
            <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto}/>
            {form.photo && <span className="text-xs text-green-400">📸 Photo attached</span>}
          </div>
          <Button onClick={save}><Plus size={14}/> Save Note</Button>
        </div>
      </Card>

      <Card>
        <CardTitle>Style Journal</CardTitle>
        {notes.length === 0 ? (
          <EmptyState icon="👔" message="No style notes yet — start journaling your outfits above" />
        ) : (
          <div className="space-y-3">
            {notes.map(n => (
              <div key={n.id} className="p-3 bg-gray-800 rounded-xl">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-xs text-gray-400 mb-1">{n.date}</p>
                    <p className="text-sm text-gray-200 whitespace-pre-wrap">{n.text}</p>
                  </div>
                  {n.photo && (
                    <img src={n.photo} alt="outfit" className="w-20 h-20 object-cover rounded-lg flex-shrink-0"/>
                  )}
                  <button onClick={() => setNotes(p => p.filter(x => x.id !== n.id))} className="p-1 text-gray-600 hover:text-red-400 flex-shrink-0">
                    <Trash2 size={13}/>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
