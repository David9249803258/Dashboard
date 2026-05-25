import { useState, useRef, useEffect } from 'react';
import Papa from 'papaparse';
import { Upload, CheckCircle, Loader2, AlertCircle, Trash2, ChevronRight, History, X, Image } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Input';
import { useFinance, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from './FinanceContext';
import { uuid, today } from '../../lib/utils';
import { localGet, localSet } from '../../lib/storage';

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

// ── OFX/QFX parser ────────────────────────────────────────────────────────────
function parseOFX(text) {
  const transactions = [];
  const blocks = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];
  blocks.forEach(block => {
    const get = tag => { const m = block.match(new RegExp(`<${tag}>([^<]+)`, 'i')); return m ? m[1].trim() : ''; };
    const dtRaw = get('DTPOSTED'), amtRaw = get('TRNAMT'), name = get('NAME') || get('MEMO') || 'Unknown', memo = get('MEMO');
    if (!dtRaw || !amtRaw) return;
    const date = `${dtRaw.slice(0,4)}-${dtRaw.slice(4,6)}-${dtRaw.slice(6,8)}`;
    const amount = parseFloat(amtRaw);
    if (isNaN(amount) || isNaN(new Date(date).getTime())) return;
    transactions.push({ date, amount: Math.abs(amount), type: amount < 0 ? 'expense' : 'income', merchant: name, note: memo !== name ? memo : '' });
  });
  return transactions;
}

// ── Bank CSV templates ─────────────────────────────────────────────────────────
const BANK_TEMPLATES = {
  Chase:            { label:'Chase',            amountSign:'negative_expense', map:{ date:'Transaction Date', amount:'Amount', merchant:'Description', category:'Category', note:'Memo' } },
  'Bank of America':{ label:'Bank of America',  amountSign:'negative_expense', map:{ date:'Date', amount:'Amount', merchant:'Description' } },
  'Wells Fargo':    { label:'Wells Fargo',       amountSign:'negative_expense', map:{ date:'Date', amount:'Amount', merchant:'Description' } },
  'Capital One':    { label:'Capital One',       amountSign:'debit_credit',     map:{ date:'Transaction Date', merchant:'Description', category:'Category', debit:'Debit', credit:'Credit' } },
  Citi:             { label:'Citi',              amountSign:'debit_credit',     map:{ date:'Date', merchant:'Description', debit:'Debit', credit:'Credit' } },
};

const INTERNAL_FIELDS = ['date','amount','merchant','category','note'];
const FIELD_LABELS    = { date:'Date *', amount:'Amount *', merchant:'Merchant / Description', category:'Category', note:'Note / Memo' };

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseAmount(row, mapping, sign) {
  if (sign === 'debit_credit') {
    const debit  = parseFloat((row[mapping.debit]  || '').replace(/[,$]/g,'')) || 0;
    const credit = parseFloat((row[mapping.credit] || '').replace(/[,$]/g,'')) || 0;
    if (debit  > 0) return { amount: debit,  type: 'expense' };
    if (credit > 0) return { amount: credit, type: 'income'  };
    return null;
  }
  const raw = parseFloat((row[mapping.amount] || '').replace(/[,$]/g,''));
  if (isNaN(raw)) return null;
  if (sign === 'negative_expense') return raw < 0 ? { amount: Math.abs(raw), type:'expense' } : { amount: raw, type:'income' };
  return { amount: Math.abs(raw), type: raw >= 0 ? 'expense' : 'income' };
}

function guessCategory(merchant) {
  if (!merchant) return 'Other';
  const m = merchant.toLowerCase();
  if (/uber\s*eats|doordash|grubhub|seamless|postmates|instacart/i.test(m)) return 'Food';
  if (/grocery|kroger|safeway|whole foods|trader joe|aldi|publix|sprouts|food lion|stop & shop|wegmans|meijer|hy-vee/i.test(m)) return 'Food';
  if (/restaurant|mcdonald|burger king|starbuck|dunkin|chipotle|panera|chick-fil|taco bell|pizza|sushi|cafe|diner|deli|steakhouse|bbq|grill|bakery|coffee|boba|smoothie|wendy|sonic|domino|papa john|little caesar|five guys|shake shack|in-n-out/i.test(m)) return 'Food';
  if (/uber(?!\s*eats)|lyft|mta|metro|bart|caltrain|septa|mbta|wmata|nj transit|amtrak|greyhound|megabus|shell|chevron|bp |exxon|mobil|sunoco|marathon|speedway|wawa|kwiktrip|gas station|parking|toll|zipcar|enterprise|hertz|avis|budget|waymo/i.test(m)) return 'Transport';
  if (/amazon|walmart|target|costco|ikea|best buy|home depot|lowes|tj maxx|marshalls|nordstrom|macy|zara|h&m|gap|old navy|uniqlo|forever 21|express|banana republic|jcrew|anthropologie|urban outfitters|etsy|ebay|shopify|wayfair|overstock|chewy|petco|petsmart/i.test(m)) return 'Shopping';
  if (/netflix|hulu|spotify|disney\+|disney plus|hbo|apple tv|paramount|peacock|amazon prime|youtube premium|twitch|xbox|playstation|nintendo|steam|adobe|microsoft 365|google one|dropbox|icloud|notion|slack|zoom|github/i.test(m)) return 'Subscriptions';
  if (/apple\.com\/bill|apple store|google play|app store/i.test(m)) return 'Subscriptions';
  if (/gym|planet fitness|la fitness|equinox|crossfit|orange theory|peloton|cvs|walgreen|rite aid|pharmacy|drugstore|doctor|dentist|hospital|urgent care|vision|optometrist|psychiatrist|therapy|counseling|quest diagnostic|labcorp|uci health|kaiser|aetna|blue cross|cigna/i.test(m)) return 'Health';
  if (/rent|mortgage|hoa|electric|water bill|gas bill|comcast|xfinity|verizon|at&t|t-mobile|spectrum|internet|cox|dish|directv|utility|pge|con ed|nyseg|duke energy|florida power/i.test(m)) return 'Housing';
  if (/salary|payroll|direct deposit|zelle|venmo|cashapp|paypal|deposit|transfer in|income|dividend|interest|refund|rebate|reward|cashback/i.test(m)) return 'Income';
  return 'Other';
}

function detectType(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (['csv','tsv'].includes(ext) || file.type === 'text/csv') return 'csv';
  if (['ofx','qfx'].includes(ext)) return 'ofx';
  if (ext === 'pdf' || file.type === 'application/pdf') return 'pdf';
  if (['jpg','jpeg','png','heic','heif','webp'].includes(ext) || file.type.startsWith('image/')) return 'image';
  return 'csv';
}

function getMimeType(file) {
  if (file.type && file.type !== 'application/octet-stream') return file.type;
  const ext = file.name.split('.').pop().toLowerCase();
  return { jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', webp:'image/webp', heic:'image/jpeg', heif:'image/jpeg', pdf:'application/pdf' }[ext] || 'image/jpeg';
}

function isDuplicate(txn, existingTxns) {
  const m = (txn.merchant || '').toLowerCase().trim();
  const amt = parseFloat(txn.amount) || 0;
  return existingTxns.some(ex =>
    ex.date === txn.date &&
    Math.abs((ex.amount || 0) - amt) < 0.02 &&
    (ex.merchant || '').toLowerCase().trim() === m
  );
}

function recordImport({ fileName, fileType, rows, importedCount, skippedCount }) {
  const dates = rows.map(r => r.date).filter(Boolean).sort();
  const entry = {
    id: uuid(), fileName, fileType,
    dateRangeStart: dates[0] || '',
    dateRangeEnd: dates[dates.length - 1] || '',
    transactionsImported: importedCount,
    transactionsSkipped: skippedCount,
    importedAt: new Date().toISOString(),
  };
  localSet('fin_import_history', [entry, ...(localGet('fin_import_history') || [])]);
}

function fmtDateRange(start, end) {
  if (!start) return '—';
  const fmt = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : '';
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
}

// ── Base64 helper ──────────────────────────────────────────────────────────────
const toBase64 = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload  = () => resolve(reader.result.split(',')[1]);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

// ── Claude API ─────────────────────────────────────────────────────────────────
const EXTRACT_PROMPT = `Extract all transactions from this bank statement. Return ONLY a valid JSON array, no markdown, no explanation:
[{"date": "YYYY-MM-DD", "amount": number, "merchant": string, "type": "income" or "expense", "category": string}]
Negative/debit = expense. Positive/credit = income.
Categories: Food, Transport, Shopping, Entertainment, Health, Housing, Income, Subscriptions, Other.
Extract every single transaction visible in the document.`;

async function parseWithClaude(file, isPDF) {
  if (!API_KEY) throw new Error('Set VITE_ANTHROPIC_API_KEY in .env to enable AI statement parsing');

  const base64 = await toBase64(file);
  const mimeType = getMimeType(file);

  const content = isPDF
    ? [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
        { type: 'text', text: EXTRACT_PROMPT },
      ]
    : [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
        { type: 'text', text: EXTRACT_PROMPT },
      ];

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 4000,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || '';

  // Greedy match to capture the full array (not lazy *? which stops at first ])
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('NO_TRANSACTIONS');

  let parsed;
  try { parsed = JSON.parse(jsonMatch[0]); } catch { throw new Error('NO_TRANSACTIONS'); }
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('NO_TRANSACTIONS');
  return parsed;
}

// ── Import History view ───────────────────────────────────────────────────────
function ImportHistory({ onClose }) {
  const history = localGet('fin_import_history') || [];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white">Import History</p>
        <Button size="sm" variant="secondary" onClick={onClose}>← Back</Button>
      </div>
      {history.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-6">No imports yet</p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {history.map(h => (
            <div key={h.id} className="p-3 bg-gray-800 rounded-xl text-xs">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-white font-medium truncate">{h.fileName}</p>
                <span className="text-gray-500 flex-shrink-0">{new Date(h.importedAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-3 text-gray-400">
                <span className="uppercase font-medium text-gray-500">{h.fileType}</span>
                <span>{fmtDateRange(h.dateRangeStart, h.dateRangeEnd)}</span>
              </div>
              <p className="text-green-400 mt-1">
                {h.transactionsImported} imported
                {h.transactionsSkipped > 0 && <span className="text-gray-500"> · {h.transactionsSkipped} skipped</span>}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Editable confirm table ─────────────────────────────────────────────────────
function ConfirmTable({ rows, onChange }) {
  function update(i, field, val) {
    onChange(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  }
  function deleteRow(i) {
    onChange(prev => prev.filter((_, idx) => idx !== i));
  }

  const ALL_CATEGORIES = [...new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES])];

  return (
    <div className="overflow-x-auto max-h-80 overflow-y-auto rounded-xl border border-gray-800">
      <table className="w-full text-xs min-w-[640px]">
        <thead className="sticky top-0 bg-gray-900 z-10">
          <tr className="text-left text-gray-500 border-b border-gray-800">
            {['Date','Merchant','Amount','Type','Category',''].map(h => (
              <th key={h} className="pb-2 px-2 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={`border-b border-gray-800/50 ${r._isDup ? 'opacity-50' : ''}`}>
              <td className="py-1 px-2">
                <input type="date" value={r.date} onChange={e => update(i,'date',e.target.value)}
                  className="bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-white text-xs w-28"/>
              </td>
              <td className="py-1 px-2">
                <div className="flex items-center gap-1">
                  <input value={r.merchant||''} onChange={e => update(i,'merchant',e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-white text-xs w-36"/>
                  {r._isDup && <span className="text-[9px] bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-1 py-0.5 rounded flex-shrink-0">Dup</span>}
                </div>
              </td>
              <td className="py-1 px-2">
                <input type="number" step="0.01" value={r.amount} onChange={e => update(i,'amount',+e.target.value)}
                  className="bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-white text-xs w-20 text-right"/>
              </td>
              <td className="py-1 px-2">
                <select value={r.type} onChange={e => update(i,'type',e.target.value)}
                  className="bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-white text-xs">
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </td>
              <td className="py-1 px-2">
                <select value={r.category} onChange={e => update(i,'category',e.target.value)}
                  className="bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-white text-xs">
                  {ALL_CATEGORIES.map(c=><option key={c}>{c}</option>)}
                </select>
              </td>
              <td className="py-1 px-2">
                <button onClick={() => deleteRow(i)}
                  className="text-gray-600 hover:text-red-400 transition-colors p-0.5 rounded">
                  <Trash2 size={12}/>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function StatementImport({ open, onClose, initialFile = null, startOnHistory = false }) {
  const { transactions, setTransactions } = useFinance();

  const [step,         setStep]        = useState('init');
  // steps: init | csv_template | csv_upload | csv_map | parsing | confirm | done | error | history | scanned_pdf
  const [fileType,     setFileType]    = useState(null);
  const [fileName,     setFileName]    = useState('');
  const [dragging,     setDragging]    = useState(false);
  const [errorMsg,     setErrorMsg]    = useState('');
  const [importResult, setImportResult]= useState(null);

  // CSV-specific
  const [template,    setTemplate]    = useState('');
  const [headers,     setHeaders]     = useState([]);
  const [csvRows,     setCsvRows]     = useState([]);
  const [mapping,     setMapping]     = useState({});
  const [amountSign,  setAmountSign]  = useState('negative_expense');

  // Shared confirm state
  const [parsedRows, setParsedRows] = useState([]);

  const fileRef     = useRef(null);
  const imageRef    = useRef(null);
  const pendingFile = useRef(null);

  useEffect(() => {
    if (open && initialFile) {
      processFile(initialFile);
    } else if (open && startOnHistory) {
      setStep('history');
    }
    if (!open) resetAll();
  }, [open, initialFile, startOnHistory]);

  function resetAll() {
    setStep('init'); setFileType(null); setFileName(''); setDragging(false);
    setErrorMsg(''); setImportResult(null); setTemplate(''); setHeaders([]);
    setCsvRows([]); setMapping({}); setAmountSign('negative_expense'); setParsedRows([]);
    pendingFile.current = null;
  }

  function handleClose() { resetAll(); onClose(); }

  // ── File entry point ────────────────────────────────────────────────────────
  function processFile(file) {
    const type = detectType(file);
    setFileType(type);
    setFileName(file.name);
    if (type === 'csv') { pendingFile.current = file; setStep('csv_template'); }
    else if (type === 'ofx') handleOFX(file);
    else handleAIFile(file, type);
  }

  function handleDrop(e) {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer?.files[0] || e.target.files?.[0];
    if (file) processFile(file);
  }

  function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  // ── OFX ────────────────────────────────────────────────────────────────────
  function handleOFX(file) {
    const reader = new FileReader();
    reader.onload = ev => {
      const txns = parseOFX(ev.target.result);
      if (!txns.length) { setErrorMsg('No transactions found in this file.'); setStep('error'); return; }
      markAndSet(txns); setStep('confirm');
    };
    reader.readAsText(file);
  }

  // ── CSV ─────────────────────────────────────────────────────────────────────
  function applyTemplate(key) {
    setTemplate(key);
    if (BANK_TEMPLATES[key]) setAmountSign(BANK_TEMPLATES[key].amountSign);
  }

  function parseCSV(file) {
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: ({ data, meta }) => {
        const hdrs = meta.fields || [];
        setHeaders(hdrs); setCsvRows(data);
        const tpl = BANK_TEMPLATES[template];
        if (tpl) {
          const auto = {};
          for (const [f, col] of Object.entries(tpl.map)) { if (hdrs.includes(col)) auto[f] = col; }
          setMapping(auto);
        } else {
          const lc = {};
          hdrs.forEach(h => { lc[h.toLowerCase()] = h; });
          const auto = {};
          if (lc['date'] || lc['transaction date'] || lc['posted date']) auto.date = lc['date'] || lc['transaction date'] || lc['posted date'];
          if (lc['amount']) auto.amount = lc['amount'];
          if (lc['description'] || lc['merchant']) auto.merchant = lc['description'] || lc['merchant'];
          if (lc['category']) auto.category = lc['category'];
          if (lc['memo'] || lc['note']) auto.note = lc['memo'] || lc['note'];
          setMapping(auto);
        }
        setStep('csv_map');
      },
    });
  }

  function setMap(field, col) {
    setMapping(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { if (next[k] === col && k !== field) delete next[k]; });
      if (col === '__skip__') delete next[field]; else next[field] = col;
      return next;
    });
  }

  function confirmCSVMapping() {
    const built = [];
    csvRows.forEach(r => {
      const parsed = parseAmount(r, mapping, amountSign);
      if (!parsed) return;
      const dateRaw = mapping.date ? r[mapping.date] : '';
      let date = today();
      try { const d = new Date(dateRaw); if (!isNaN(d)) date = d.toISOString().slice(0,10); } catch {}
      const merchant = (mapping.merchant ? (r[mapping.merchant] || '') : '').trim();
      const cat = mapping.category
        ? (EXPENSE_CATEGORIES.includes(r[mapping.category]) ? r[mapping.category] : guessCategory(r[mapping.category] || merchant))
        : (parsed.type === 'income' ? 'Income' : guessCategory(merchant));
      built.push({ date, amount:parsed.amount, type:parsed.type, merchant, category:cat, note:(mapping.note ? r[mapping.note]||'' : '').trim() });
    });
    if (!built.length) { setErrorMsg('No valid transactions could be parsed. Check column mapping.'); setStep('error'); return; }
    markAndSet(built); setStep('confirm');
  }

  // ── AI (PDF/Image) ─────────────────────────────────────────────────────────
  async function handleAIFile(file, type) {
    setStep('parsing');
    try {
      const extracted = await parseWithClaude(file, type === 'pdf');
      const normalized = extracted.map(t => ({
        date:     t.date || today(),
        amount:   Math.abs(Number(t.amount) || 0),
        merchant: (t.merchant || '').trim(),
        type:     t.type === 'income' ? 'income' : 'expense',
        category: t.category || guessCategory(t.merchant),
      })).filter(t => t.amount > 0);

      if (!normalized.length) {
        if (type === 'pdf') { setStep('scanned_pdf'); return; }
        setErrorMsg('No transactions found. Try a clearer image or use CSV import.'); setStep('error'); return;
      }
      markAndSet(normalized); setStep('confirm');
    } catch (err) {
      if (err.message === 'NO_TRANSACTIONS' && type === 'pdf') {
        setStep('scanned_pdf');
      } else {
        setErrorMsg(err.message || 'Failed to parse statement. Please try again.');
        setStep('error');
      }
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function markAndSet(rows) {
    setParsedRows(rows.map(r => ({
      ...r,
      _include: !isDuplicate(r, transactions),
      _isDup: isDuplicate(r, transactions),
    })));
  }

  const csvPreview = csvRows.slice(0,5).map(r => ({
    date:     mapping.date     ? r[mapping.date]     || '' : '',
    merchant: mapping.merchant ? r[mapping.merchant] || '' : '',
    amount:   (() => { const p = parseAmount(r, mapping, amountSign); return p ? `$${p.amount.toFixed(2)} (${p.type})` : '—'; })(),
    category: mapping.category ? r[mapping.category] || '' : '',
  }));

  // ── Import ──────────────────────────────────────────────────────────────────
  function doImport() {
    const toImport = parsedRows;
    const newTxns  = toImport.map(r => ({
      id: uuid(), date: r.date, amount: r.amount, type: r.type,
      merchant: r.merchant, category: r.category, note: r.note || '',
      source: 'imported', createdAt: new Date().toISOString(),
    }));
    setTransactions(prev => [...prev, ...newTxns]);
    recordImport({ fileName, fileType: fileType||'csv', rows: parsedRows, importedCount: newTxns.length, skippedCount: 0 });
    const dates = toImport.map(r => r.date).filter(Boolean).sort();
    setImportResult({ imported: newTxns.length, skipped: 0, dateStart: dates[0]||'', dateEnd: dates[dates.length-1]||'' });
    setStep('done');
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <Modal open={open} onClose={handleClose} title="Import Bank Statement" size="lg">

      {/* ── History ─────────────────────────────────────────────────────────── */}
      {step === 'history' && <ImportHistory onClose={() => setStep('init')} />}

      {/* ── Init: drop zone ─────────────────────────────────────────────────── */}
      {step === 'init' && (
        <div className="space-y-4">
          <div
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${dragging ? 'border-blue-400 bg-blue-500/10' : 'border-gray-700 hover:border-gray-500'}`}>
            <Upload size={32} className="mx-auto mb-3 text-gray-500"/>
            <p className="text-sm font-semibold text-gray-200 mb-1">Drop your bank statement here</p>
            <p className="text-xs text-gray-500">Supports: CSV, OFX/QFX, PDF, JPG, PNG, HEIC — any bank statement format</p>
            <input ref={fileRef} type="file" accept=".csv,.ofx,.qfx,.pdf,.jpg,.jpeg,.png,.heic,.webp,image/*" className="hidden" onChange={handleDrop}/>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}><Upload size={13}/> Browse Files</Button>
            <Button size="sm" variant="secondary" onClick={() => setStep('history')}><History size={13}/> Import History</Button>
          </div>
        </div>
      )}

      {/* ── CSV: template picker ────────────────────────────────────────────── */}
      {step === 'csv_template' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
            <span className="text-white font-medium">{fileName}</span>
            <span className="text-gray-600">CSV detected</span>
          </div>
          <p className="text-sm text-gray-300">Select your bank to auto-map columns, or skip for manual mapping.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.keys(BANK_TEMPLATES).map(key => (
              <button key={key} onClick={() => applyTemplate(key)}
                className={`p-3 rounded-xl border text-sm font-medium transition-colors ${template === key ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'}`}>
                {key}
              </button>
            ))}
            <button onClick={() => setTemplate('')}
              className={`p-3 rounded-xl border text-sm font-medium transition-colors ${template === '' ? 'bg-gray-700 border-gray-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'}`}>
              Other / Manual
            </button>
          </div>
          <div className="flex gap-2 pt-1">
            <Button onClick={() => parseCSV(pendingFile.current)}>Continue <ChevronRight size={13}/></Button>
            <Button variant="secondary" onClick={() => setStep('init')}>← Back</Button>
          </div>
        </div>
      )}

      {/* ── CSV: column mapping ──────────────────────────────────────────────── */}
      {step === 'csv_map' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-400">{csvRows.length} rows detected. Map your CSV columns to transaction fields.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Select label="Amount Convention" value={amountSign} onChange={e => setAmountSign(e.target.value)}>
                <option value="negative_expense">Negative = Expense (Chase, BofA, Wells Fargo)</option>
                <option value="debit_credit">Separate Debit / Credit columns (Capital One, Citi)</option>
                <option value="positive_expense">Positive = Expense</option>
              </Select>
            </div>
            {INTERNAL_FIELDS.map(field => (
              <Select key={field} label={FIELD_LABELS[field]} value={mapping[field]||'__skip__'} onChange={e => setMap(field, e.target.value)}>
                <option value="__skip__">— Skip —</option>
                {headers.map(h => <option key={h} value={h}>{h}</option>)}
              </Select>
            ))}
          </div>

          {csvPreview.length > 0 && (
            <div className="overflow-x-auto">
              <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider font-medium">Preview (first 5 rows)</p>
              <table className="w-full text-xs">
                <thead><tr className="text-gray-500 border-b border-gray-800">
                  {['Date','Merchant','Amount','Category'].map(h => <th key={h} className="text-left pb-1 pr-3">{h}</th>)}
                </tr></thead>
                <tbody>
                  {csvPreview.map((r, i) => (
                    <tr key={i} className="border-b border-gray-800/50">
                      <td className="py-1.5 pr-3 text-gray-300">{r.date}</td>
                      <td className="py-1.5 pr-3 text-gray-300 max-w-[140px] truncate">{r.merchant||'—'}</td>
                      <td className={`py-1.5 pr-3 font-medium ${r.amount.includes('income')?'text-green-400':'text-white'}`}>{r.amount}</td>
                      <td className="py-1.5 text-gray-400">{r.category||'auto'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button onClick={confirmCSVMapping} disabled={!mapping.date}>Review {csvRows.length} Rows</Button>
            <Button variant="secondary" onClick={() => setStep('csv_template')}>← Back</Button>
          </div>
        </div>
      )}

      {/* ── Parsing (AI) ─────────────────────────────────────────────────────── */}
      {step === 'parsing' && (
        <div className="flex flex-col items-center gap-4 py-10">
          <div className="relative">
            <Loader2 size={44} className="animate-spin text-blue-400"/>
          </div>
          <p className="text-base font-semibold text-white">Reading your statement…</p>
          <p className="text-sm text-gray-400 text-center max-w-xs">
            Claude is extracting all transactions from your {fileType === 'pdf' ? 'PDF' : 'image'}.<br/>
            This takes 10–20 seconds.
          </p>
        </div>
      )}

      {/* ── Confirm table ─────────────────────────────────────────────────────── */}
      {step === 'confirm' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">{parsedRows.length} transactions found</p>
              {parsedRows.some(r => r._isDup) && (
                <p className="text-xs text-yellow-400">{parsedRows.filter(r=>r._isDup).length} possible duplicate{parsedRows.filter(r=>r._isDup).length>1?'s':''} — review before importing</p>
              )}
            </div>
            <p className="text-xs text-gray-400">{parsedRows.length} will be imported</p>
          </div>

          <ConfirmTable rows={parsedRows} onChange={setParsedRows}/>

          <p className="text-xs text-gray-500">Edit any field inline. Click <Trash2 size={10} className="inline"/> to remove a row.</p>

          <div className="flex gap-2 pt-1">
            <Button onClick={doImport} disabled={parsedRows.length === 0}>
              Import {parsedRows.length} Transaction{parsedRows.length !== 1 ? 's' : ''}
            </Button>
            <Button variant="secondary" onClick={() => setStep('init')}>← Start Over</Button>
          </div>
        </div>
      )}

      {/* ── Scanned PDF fallback ──────────────────────────────────────────────── */}
      {step === 'scanned_pdf' && (
        <div className="flex flex-col items-center gap-5 py-6">
          <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
            <Image size={24} className="text-yellow-400"/>
          </div>
          <div className="text-center space-y-2 max-w-sm">
            <p className="text-base font-semibold text-white">Could not read this PDF automatically.</p>
            <p className="text-sm text-gray-400">
              This may be a scanned image PDF. Try taking a screenshot of the transactions and uploading as an image instead.
            </p>
          </div>
          <div className="flex flex-col gap-2 w-full max-w-xs">
            <Button onClick={() => imageRef.current?.click()}>
              <Image size={14}/> Upload as Image
            </Button>
            <Button variant="secondary" onClick={() => setStep('init')}>← Try a Different File</Button>
          </div>
          <input ref={imageRef} type="file" accept=".jpg,.jpeg,.png,.heic,.webp,image/*" className="hidden" onChange={handleImageUpload}/>
        </div>
      )}

      {/* ── Done ─────────────────────────────────────────────────────────────── */}
      {step === 'done' && importResult && (
        <div className="flex flex-col items-center gap-4 py-6">
          <CheckCircle size={48} className="text-green-400"/>
          <div className="text-center">
            <p className="text-lg font-semibold text-white mb-1">
              Imported {importResult.imported} transaction{importResult.imported !== 1 ? 's' : ''}
            </p>
            {importResult.dateStart && (
              <p className="text-sm text-gray-400">{fmtDateRange(importResult.dateStart, importResult.dateEnd)}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={() => { resetAll(); setStep('init'); }}>Import Another</Button>
            <Button variant="secondary" onClick={handleClose}>Done</Button>
          </div>
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────────────────────── */}
      {step === 'error' && (
        <div className="flex flex-col items-center gap-4 py-6">
          <AlertCircle size={40} className="text-red-400"/>
          <div className="text-center">
            <p className="text-base font-semibold text-white mb-2">Import Failed</p>
            <p className="text-sm text-gray-400">{errorMsg}</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setStep('init')}>Try Again</Button>
            <Button variant="secondary" onClick={handleClose}>Cancel</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
