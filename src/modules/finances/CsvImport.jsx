import { useState, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import { Upload, CheckCircle, ChevronRight } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Input';
import { useFinance, EXPENSE_CATEGORIES } from './FinanceContext';
import { uuid, today } from '../../lib/utils';

// ── OFX/QFX native parser ─────────────────────────────────────────────────────
function parseOFX(text) {
  const transactions = [];
  // OFX is SGML-like — extract STMTTRN blocks
  const blocks = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];
  blocks.forEach(block => {
    const get = (tag) => { const m = block.match(new RegExp(`<${tag}>([^<]+)`, 'i')); return m ? m[1].trim() : ''; };
    const dtRaw  = get('DTPOSTED');
    const amtRaw = get('TRNAMT');
    const name   = get('NAME') || get('MEMO') || 'Unknown';
    const memo   = get('MEMO');

    if (!dtRaw || !amtRaw) return;

    // Parse YYYYMMDD[hhmmss] date format
    const year = dtRaw.slice(0,4), mon = dtRaw.slice(4,6), day = dtRaw.slice(6,8);
    const date = `${year}-${mon}-${day}`;
    const amount = parseFloat(amtRaw);
    if (isNaN(amount) || isNaN(new Date(date).getTime())) return;

    transactions.push({ date, amount: Math.abs(amount), type: amount < 0 ? 'expense' : 'income', merchant: name, note: memo !== name ? memo : '' });
  });
  return transactions;
}

// ── Bank format templates ─────────────────────────────────────────────────────
const BANK_TEMPLATES = {
  Chase: {
    label: 'Chase',
    map: { date: 'Transaction Date', amount: 'Amount', merchant: 'Description', category: 'Category', note: 'Memo' },
    amountSign: 'negative_expense',
  },
  'Bank of America': {
    label: 'Bank of America',
    map: { date: 'Date', amount: 'Amount', merchant: 'Description' },
    amountSign: 'negative_expense',
  },
  'Wells Fargo': {
    label: 'Wells Fargo',
    map: { date: 'Date', amount: 'Amount', merchant: 'Description' },
    amountSign: 'negative_expense',
  },
  'Capital One': {
    label: 'Capital One',
    map: { date: 'Transaction Date', merchant: 'Description', category: 'Category', debit: 'Debit', credit: 'Credit' },
    amountSign: 'debit_credit',
  },
  Citi: {
    label: 'Citi',
    map: { date: 'Date', merchant: 'Description', debit: 'Debit', credit: 'Credit' },
    amountSign: 'debit_credit',
  },
};

const INTERNAL_FIELDS = ['date', 'amount', 'merchant', 'category', 'note', 'skip'];
const FIELD_LABELS = { date: 'Date', amount: 'Amount', merchant: 'Merchant/Description', category: 'Category', note: 'Note', skip: 'Skip' };

function parseAmount(row, mapping, sign) {
  if (sign === 'debit_credit') {
    const debitCol  = mapping.debit;
    const creditCol = mapping.credit;
    const debit  = debitCol  ? parseFloat((row[debitCol]  || '').replace(/[,$]/g, '')) || 0 : 0;
    const credit = creditCol ? parseFloat((row[creditCol] || '').replace(/[,$]/g, '')) || 0 : 0;
    if (debit  > 0) return { amount: debit,  type: 'expense' };
    if (credit > 0) return { amount: credit, type: 'income'  };
    return null;
  }
  const amtCol = mapping.amount;
  if (!amtCol) return null;
  const raw = parseFloat((row[amtCol] || '').replace(/[,$]/g, ''));
  if (isNaN(raw)) return null;
  if (sign === 'negative_expense') {
    return raw < 0
      ? { amount: Math.abs(raw), type: 'expense' }
      : { amount: raw, type: 'income' };
  }
  return { amount: Math.abs(raw), type: raw >= 0 ? 'expense' : 'income' };
}

function guessCategory(merchant) {
  if (!merchant) return 'Other';
  const m = merchant.toLowerCase();
  if (/grocery|kroger|safeway|whole foods|trader joe|aldi|publix|food/i.test(m)) return 'Food';
  if (/uber|lyft|gas|shell|chevron|bp|exxon|transit|parking/i.test(m)) return 'Transport';
  if (/amazon|walmart|target|costco|ikea|shop/i.test(m)) return 'Shopping';
  if (/netflix|hulu|spotify|disney|hbo|apple|google play/i.test(m)) return 'Subscriptions';
  if (/gym|cvs|walgreen|pharmacy|doctor|hospital/i.test(m)) return 'Health';
  if (/restaurant|doordash|grubhub|seamless|mcdonald|starbuck|dunkin/i.test(m)) return 'Food';
  if (/rent|mortgage|electric|water|gas bill|comcast|verizon|at&t/i.test(m)) return 'Housing';
  return 'Other';
}

export default function CsvImport({ open, onClose }) {
  const { setTransactions } = useFinance();
  const [importMode,  setImportMode]  = useState('CSV'); // 'CSV' | 'OFX'
  const [step,        setStep]        = useState(1); // 1=template, 2=upload, 3=map, 4=done
  const [template,    setTemplate]    = useState('');
  const [headers,     setHeaders]     = useState([]);
  const [rows,        setRows]        = useState([]);
  const [mapping,     setMapping]     = useState({});
  const [amountSign,  setAmountSign]  = useState('negative_expense');
  const [dragging,    setDragging]    = useState(false);
  const [importCount, setImportCount] = useState(null);
  const fileRef = useRef(null);

  function reset() {
    setStep(1); setTemplate(''); setHeaders([]); setRows([]); setMapping({});
    setAmountSign('negative_expense'); setImportCount(null);
  }

  function handleClose() { reset(); onClose(); }

  function applyTemplate(key) {
    setTemplate(key);
    if (BANK_TEMPLATES[key]) setAmountSign(BANK_TEMPLATES[key].amountSign);
  }

  function handleOFXFile(file) {
    const reader = new FileReader();
    reader.onload = ev => {
      const parsed = parseOFX(ev.target.result);
      if (!parsed.length) { alert('No transactions found in this file.'); return; }
      const newTxns = parsed.map(t => ({
        id: uuid(), ...t,
        category: guessCategory(t.merchant),
        source: 'imported', createdAt: new Date().toISOString(),
      }));
      setTransactions(prev => [...prev, ...newTxns]);
      setImportCount(newTxns.length);
      setStep(4);
    };
    reader.readAsText(file);
  }

  function parseFile(file) {
    if (importMode === 'OFX') { handleOFXFile(file); return; }
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: ({ data, meta }) => {
        const hdrs = meta.fields || [];
        setHeaders(hdrs);
        setRows(data);
        // Auto-map from template if selected
        if (template && BANK_TEMPLATES[template]) {
          const tplMap = BANK_TEMPLATES[template].map;
          const autoMapping = {};
          for (const [field, col] of Object.entries(tplMap)) {
            if (hdrs.includes(col)) autoMapping[field] = col;
          }
          setMapping(autoMapping);
        } else {
          // Auto-detect common names
          const autoMapping = {};
          const lcMap = {};
          hdrs.forEach(h => { lcMap[h.toLowerCase()] = h; });
          if (lcMap['date'] || lcMap['transaction date'] || lcMap['posted date']) autoMapping.date = lcMap['date'] || lcMap['transaction date'] || lcMap['posted date'];
          if (lcMap['amount']) autoMapping.amount = lcMap['amount'];
          if (lcMap['description'] || lcMap['merchant']) autoMapping.merchant = lcMap['description'] || lcMap['merchant'];
          if (lcMap['category']) autoMapping.category = lcMap['category'];
          if (lcMap['memo'] || lcMap['note']) autoMapping.note = lcMap['memo'] || lcMap['note'];
          setMapping(autoMapping);
        }
        setStep(3);
      },
    });
  }

  function handleFileDrop(e) {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer?.files[0] || e.target.files?.[0];
    if (file) parseFile(file);
  }

  function setMap(field, col) {
    setMapping(prev => {
      const next = { ...prev };
      // Remove any existing assignment of this CSV column to another field
      Object.keys(next).forEach(k => { if (next[k] === col && k !== field) delete next[k]; });
      if (col === '__skip__') delete next[field];
      else next[field] = col;
      return next;
    });
  }

  const preview = rows.slice(0, 5).map(r => ({
    date:     mapping.date     ? r[mapping.date]     || '' : '',
    merchant: mapping.merchant ? r[mapping.merchant] || '' : '',
    amount:   (() => { const p = parseAmount(r, mapping, amountSign); return p ? `$${p.amount.toFixed(2)} (${p.type})` : '—'; })(),
    category: mapping.category ? r[mapping.category] || '' : '',
  }));

  function confirmImport() {
    const newTxns = [];
    rows.forEach(r => {
      const parsed = parseAmount(r, mapping, amountSign);
      if (!parsed) return;
      const dateRaw = mapping.date ? r[mapping.date] : '';
      let date = '';
      try {
        const d = new Date(dateRaw);
        if (!isNaN(d)) date = d.toISOString().slice(0, 10);
      } catch { date = today(); }
      if (!date) date = today();
      const merchant = mapping.merchant ? (r[mapping.merchant] || '').trim() : '';
      const cat = mapping.category
        ? (EXPENSE_CATEGORIES.includes(r[mapping.category]) ? r[mapping.category] : guessCategory(r[mapping.category] || merchant))
        : (parsed.type === 'income' ? 'Other Income' : guessCategory(merchant));
      newTxns.push({
        id: uuid(), date, amount: parsed.amount, type: parsed.type,
        category: cat,
        merchant,
        note: mapping.note ? (r[mapping.note] || '').trim() : '',
        source: 'imported',
        createdAt: new Date().toISOString(),
      });
    });
    setTransactions(prev => [...prev, ...newTxns]);
    setImportCount(newTxns.length);
    setStep(4);
  }

  return (
    <Modal open={open} onClose={handleClose} title="Import Bank Transactions" size="lg">
      {/* Format tabs */}
      <div className="flex gap-1 mb-5 bg-gray-800 p-1 rounded-xl w-fit">
        {['CSV','OFX/QFX'].map(m=>(
          <button key={m} onClick={()=>{setImportMode(m==='OFX/QFX'?'OFX':'CSV');reset();}}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${(importMode==='OFX'?'OFX/QFX':importMode)===m?'bg-indigo-600 text-white':'text-gray-400 hover:text-white'}`}>
            {m}
          </button>
        ))}
      </div>

      {/* OFX short-circuit: just upload */}
      {importMode === 'OFX' && step !== 4 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-400">Drop your .ofx or .qfx file exported from your bank. Transactions will be parsed automatically.</p>
          <div onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)handleOFXFile(f);}}
            onDragOver={e=>e.preventDefault()} onClick={()=>fileRef.current?.click()}
            className="border-2 border-dashed border-gray-700 hover:border-gray-500 rounded-xl p-10 text-center cursor-pointer">
            <Upload size={28} className="mx-auto mb-2 text-gray-500"/>
            <p className="text-sm text-gray-300">Drop .ofx / .qfx file or click to browse</p>
            <input ref={fileRef} type="file" accept=".ofx,.qfx" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)handleOFXFile(f);}}/>
          </div>
        </div>
      )}

      {importMode === 'OFX' && step === 4 && (
        <div className="flex flex-col items-center gap-4 py-6">
          <CheckCircle size={48} className="text-green-400"/>
          <p className="text-lg font-semibold text-white">{importCount} transactions imported successfully</p>
          <Button onClick={handleClose}>Done</Button>
        </div>
      )}

      {importMode !== 'OFX' && (
      <>
      {/* Step indicators */}
      <div className="flex items-center gap-2 mb-6 text-xs">
        {['Bank', 'Upload', 'Map', 'Done'].map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs ${step > i+1 ? 'bg-green-600' : step === i+1 ? 'bg-indigo-600' : 'bg-gray-700'} text-white`}>
              {step > i+1 ? '✓' : i+1}
            </div>
            <span className={step === i+1 ? 'text-white' : 'text-gray-500'}>{s}</span>
            {i < 3 && <ChevronRight size={12} className="text-gray-700" />}
          </div>
        ))}
      </div>

      {/* Step 1: Select bank template */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-300">Select your bank to auto-map columns, or skip to map manually.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.keys(BANK_TEMPLATES).map(key => (
              <button key={key} onClick={() => applyTemplate(key)}
                className={`p-3 rounded-xl border text-sm font-medium transition-colors ${template === key ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'}`}>
                {key}
              </button>
            ))}
            <button onClick={() => setTemplate('')}
              className={`p-3 rounded-xl border text-sm font-medium transition-colors ${template === '' ? 'bg-gray-700 border-gray-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'}`}>
              Other / Manual
            </button>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={() => setStep(2)}>Continue →</Button>
          </div>
        </div>
      )}

      {/* Step 2: Upload file */}
      {step === 2 && (
        <div className="space-y-4">
          <div
            onDrop={handleFileDrop} onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)} onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${dragging ? 'border-indigo-400 bg-indigo-500/10' : 'border-gray-700 hover:border-gray-500'}`}>
            <Upload size={32} className="mx-auto mb-3 text-gray-500" />
            <p className="text-sm text-gray-300 font-medium">Drop your CSV file here</p>
            <p className="text-xs text-gray-500 mt-1">or click to browse</p>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileDrop} />
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(1)}>← Back</Button>
          </div>
        </div>
      )}

      {/* Step 3: Column mapping */}
      {step === 3 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-400">Map your CSV columns to transaction fields. <span className="text-indigo-400">{rows.length} rows detected.</span></p>

          <div className="grid sm:grid-cols-2 gap-3">
            {/* Amount sign convention */}
            <div className="sm:col-span-2">
              <Select label="Amount Convention"
                value={amountSign} onChange={e => setAmountSign(e.target.value)}>
                <option value="negative_expense">Negative = Expense (Chase, BofA, WF)</option>
                <option value="debit_credit">Separate Debit / Credit columns (Capital One, Citi)</option>
                <option value="positive_expense">Positive = Expense</option>
              </Select>
            </div>
            {INTERNAL_FIELDS.filter(f => f !== 'skip').map(field => (
              <div key={field}>
                <Select label={`${FIELD_LABELS[field]}${['date','amount'].includes(field) ? ' *' : ''}`}
                  value={mapping[field] || '__skip__'}
                  onChange={e => setMap(field, e.target.value)}>
                  <option value="__skip__">— Skip —</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </Select>
              </div>
            ))}
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div className="overflow-x-auto">
              <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">Preview (first 5 rows)</p>
              <table className="w-full text-xs">
                <thead><tr className="text-gray-500 border-b border-gray-800">
                  {['Date','Merchant','Amount','Category'].map(h => <th key={h} className="text-left pb-1 pr-3">{h}</th>)}
                </tr></thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i} className="border-b border-gray-800/50">
                      <td className="py-1.5 pr-3 text-gray-300">{r.date}</td>
                      <td className="py-1.5 pr-3 text-gray-300 max-w-[160px] truncate">{r.merchant || '—'}</td>
                      <td className={`py-1.5 pr-3 font-medium ${r.amount.includes('income') ? 'text-green-400' : 'text-white'}`}>{r.amount}</td>
                      <td className="py-1.5 text-gray-400">{r.category || 'auto'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button onClick={confirmImport} disabled={!mapping.date}>Import {rows.length} Rows</Button>
            <Button variant="secondary" onClick={() => setStep(2)}>← Back</Button>
          </div>
        </div>
      )}

      {/* Step 4: Success */}
      {step === 4 && (
        <div className="flex flex-col items-center gap-4 py-6">
          <CheckCircle size={48} className="text-green-400" />
          <p className="text-lg font-semibold text-white">{importCount} transactions imported successfully</p>
          <p className="text-sm text-gray-400 text-center">Your transactions have been saved. Review them in the Transactions tab.</p>
          <Button onClick={handleClose}>Done</Button>
        </div>
      )}
      </>
      )}
    </Modal>
  );
}
