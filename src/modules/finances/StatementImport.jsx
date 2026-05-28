import { useState, useRef, useEffect } from 'react';
import { Upload, CheckCircle, Loader2, AlertCircle, Trash2, History, Image, AlertTriangle } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { useFinance, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from './FinanceContext';
import { uuid, today } from '../../lib/utils';
import { localGet, localSet } from '../../lib/storage';

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

// ── Helpers ───────────────────────────────────────────────────────────────────
function getMimeType(file) {
  if (file.type && file.type !== 'application/octet-stream') return file.type;
  const ext = file.name.split('.').pop().toLowerCase();
  return { jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', webp:'image/webp', heic:'image/jpeg', heif:'image/jpeg', pdf:'application/pdf' }[ext] || 'image/jpeg';
}

function detectType(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'pdf' || file.type === 'application/pdf') return 'pdf';
  if (['jpg','jpeg','png','heic','heif','webp'].includes(ext) || file.type?.startsWith('image/')) return 'image';
  return 'image';
}

function guessCategory(merchant) {
  if (!merchant) return 'Other';
  const m = merchant.toLowerCase();
  if (/uber\s*eats|doordash|grubhub|seamless|postmates|instacart/i.test(m)) return 'Food';
  if (/grocery|kroger|safeway|whole foods|trader joe|aldi|publix|sprouts|food lion|stop & shop|wegmans|meijer|hy-vee/i.test(m)) return 'Food';
  if (/restaurant|mcdonald|burger king|starbuck|dunkin|chipotle|panera|chick-fil|taco bell|pizza|sushi|cafe|diner|deli|steakhouse|bbq|grill|bakery|coffee|boba|smoothie|wendy|sonic|domino|papa john|little caesar|five guys|shake shack|in-n-out/i.test(m)) return 'Food';
  if (/uber(?!\s*eats)|lyft|mta|metro|bart|caltrain|septa|mbta|wmata|nj transit|amtrak|greyhound|megabus|shell|chevron|bp |exxon|mobil|sunoco|marathon|speedway|wawa|kwiktrip|gas station|parking|toll|zipcar|enterprise|hertz|avis|budget/i.test(m)) return 'Transport';
  if (/amazon|walmart|target|costco|ikea|best buy|home depot|lowes|tj maxx|marshalls|nordstrom|macy|zara|h&m|gap|old navy|uniqlo|forever 21|express|banana republic|jcrew|anthropologie|urban outfitters|etsy|ebay|shopify|wayfair|overstock|chewy|petco|petsmart/i.test(m)) return 'Shopping';
  if (/netflix|hulu|spotify|disney\+|disney plus|hbo|apple tv|paramount|peacock|amazon prime|youtube premium|twitch|xbox|playstation|nintendo|steam|adobe|microsoft 365|google one|dropbox|icloud|notion|slack|zoom|github/i.test(m)) return 'Subscriptions';
  if (/apple\.com\/bill|apple store|google play|app store/i.test(m)) return 'Subscriptions';
  if (/gym|planet fitness|la fitness|equinox|crossfit|orange theory|peloton|cvs|walgreen|rite aid|pharmacy|drugstore|doctor|dentist|hospital|urgent care|vision|optometrist|psychiatrist|therapy|counseling|quest diagnostic|labcorp|kaiser|aetna|blue cross|cigna/i.test(m)) return 'Health';
  if (/rent|mortgage|hoa|electric|water bill|gas bill|comcast|xfinity|verizon|at&t|t-mobile|spectrum|internet|cox|dish|directv|utility|pge|con ed|duke energy|florida power/i.test(m)) return 'Housing';
  if (/salary|payroll|direct deposit|zelle|venmo|cashapp|paypal|deposit|transfer in|income|dividend|interest|refund|rebate|reward|cashback/i.test(m)) return 'Income';
  return 'Other';
}

function isDuplicate(txn, existingTxns) {
  const m   = (txn.merchant || '').toLowerCase().trim();
  const amt = parseFloat(txn.amount) || 0;
  return existingTxns.some(ex =>
    ex.date === txn.date &&
    Math.abs((ex.amount || 0) - amt) < 0.02 &&
    (ex.merchant || '').toLowerCase().trim() === m
  );
}

function recordImport({ importId, fileName, fileType, rows, importedCount, duplicatesSkipped }) {
  const dates = rows.map(r => r.date).filter(Boolean).sort();
  const entry = {
    id: importId,
    fileName, fileType,
    dateRangeStart: dates[0] || '',
    dateRangeEnd:   dates[dates.length - 1] || '',
    transactionsImported: importedCount,
    duplicatesSkipped: duplicatesSkipped || 0,
    importedAt: new Date().toISOString(),
  };
  localSet('fin_import_history', [entry, ...(localGet('fin_import_history') || [])]);
}

function checkOverlap(newStart, newEnd) {
  const history = localGet('fin_import_history') || [];
  return history.filter(imp => {
    if (!imp.dateRangeStart || !imp.dateRangeEnd) return false;
    const impStart = new Date(imp.dateRangeStart + 'T00:00:00');
    const impEnd   = new Date(imp.dateRangeEnd   + 'T00:00:00');
    const nStart   = new Date(newStart + 'T00:00:00');
    const nEnd     = new Date(newEnd   + 'T00:00:00');
    return nStart <= impEnd && nEnd >= impStart;
  });
}

function fmtDateRange(start, end) {
  if (!start) return '—';
  const fmt = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : '';
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
}

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => { resolve(reader.result.split(',')[1]); };
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const IMAGE_PROMPT = `You are an expert bank statement parser. Extract every single transaction from this bank statement image. Return ONLY a raw JSON array, absolutely no markdown, no backticks, no explanation text, just the raw array starting with [ and ending with ]. Use this exact structure for each transaction: [{"date":"YYYY-MM-DD","amount":0.00,"merchant":"name","type":"expense","category":"Food"}]. Rules: all transactions are expenses unless the description says deposit, payroll, salary, credit, refund or transfer in - those are income. Categories must be one of: Food, Transport, Shopping, Entertainment, Health, Housing, Income, Subscriptions, Groceries, Personal, Gas, Other. Extract every row you can see.`;

async function parseWithClaude(file, isPDF) {
  if (!API_KEY) throw new Error('Set VITE_ANTHROPIC_API_KEY in .env to enable AI statement parsing');
  const base64Data = await fileToBase64(file);
  const mimeType   = getMimeType(file);

  let response;
  if (isPDF) {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } },
            { type: 'text', text: 'Extract every single transaction from this bank statement. Return ONLY a raw JSON array, absolutely no markdown, no backticks, no explanation text, just the raw array starting with [ and ending with ]. Use this exact structure for each transaction: [{"date":"YYYY-MM-DD","amount":0.00,"merchant":"name","type":"expense","category":"Food"}]. Rules: all transactions are expenses unless the description says deposit, payroll, salary, credit, refund or transfer in - those are income. Categories must be one of: Food, Transport, Shopping, Entertainment, Health, Housing, Income, Subscriptions, Groceries, Personal, Gas, Other. Extract every row you can see.' },
          ],
        }],
      }),
    });
  } else {
    response = await fetch('https://api.anthropic.com/v1/messages', {
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
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Data } },
            { type: 'text', text: IMAGE_PROMPT },
          ],
        }],
      }),
    });
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  const text = (data.content?.[0]?.text || '').trim();
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('NO_TRANSACTIONS');
  let parsed;
  try { parsed = JSON.parse(jsonMatch[0]); } catch { throw new Error('NO_TRANSACTIONS'); }
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('NO_TRANSACTIONS');
  return parsed;
}

// ── Import History ─────────────────────────────────────────────────────────────
function ImportHistory({ onClose, transactions, setTransactions }) {
  const [history,    setHistory]    = useState(() => localGet('fin_import_history') || []);
  const [confirmId,  setConfirmId]  = useState(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [toast,      setToast]      = useState('');

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  }

  function deleteImport(entry) {
    const count = transactions.filter(t => t.import_id === entry.id).length;
    setTransactions(prev => prev.filter(t => t.import_id !== entry.id));
    const next = history.filter(h => h.id !== entry.id);
    localSet('fin_import_history', next);
    setHistory(next);
    setConfirmId(null);
    showToast(`Import deleted — ${count} transaction${count !== 1 ? 's' : ''} removed`);
  }

  function deleteAllImports() {
    const importIds = new Set(history.map(h => h.id));
    const count = transactions.filter(t => t.import_id && importIds.has(t.import_id)).length;
    setTransactions(prev => prev.filter(t => !t.import_id || !importIds.has(t.import_id)));
    localSet('fin_import_history', []);
    setHistory([]);
    setConfirmAll(false);
    showToast(`All imports deleted — ${count} transaction${count !== 1 ? 's' : ''} removed`);
  }

  const allDates     = history.flatMap(h => [h.dateRangeStart, h.dateRangeEnd]).filter(Boolean).sort();
  const overallStart = allDates[0];
  const overallEnd   = allDates[allDates.length - 1];
  const totalImported = history.reduce((s, h) => s + (h.transactionsImported || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white">Import History</p>
        <Button size="sm" variant="secondary" onClick={onClose}>← Back</Button>
      </div>

      {toast && (
        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/15 border border-emerald-500/20 rounded-xl text-xs text-emerald-400">
          <CheckCircle size={12} className="flex-shrink-0" /> {toast}
        </div>
      )}

      {history.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-6">No imports yet</p>
      ) : (
        <>
          {/* Summary */}
          <div className="px-3 py-2.5 bg-slate-800/60 rounded-xl text-xs text-slate-400">
            <span className="text-white font-medium">{totalImported}</span> transaction{totalImported !== 1 ? 's' : ''} imported across{' '}
            <span className="text-white font-medium">{history.length}</span> import{history.length !== 1 ? 's' : ''}
            {overallStart && (
              <> covering <span className="text-sky-300">{fmtDateRange(overallStart, overallEnd)}</span></>
            )}
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-0.5">
            {history.map(h => (
              <div key={h.id} className="p-3 bg-slate-800/60 rounded-2xl text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{h.fileName}</p>
                    <p className="text-slate-400 mt-0.5">{fmtDateRange(h.dateRangeStart, h.dateRangeEnd)}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-emerald-400">{h.transactionsImported} imported</span>
                      {(h.duplicatesSkipped || 0) > 0 && (
                        <span className="text-amber-400">{h.duplicatesSkipped} dup{h.duplicatesSkipped !== 1 ? 's' : ''} skipped</span>
                      )}
                      <span className="text-slate-500">{new Date(h.importedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setConfirmId(prev => prev === h.id ? null : h.id)}
                    className="p-1.5 text-slate-600 hover:text-red-400 transition-colors rounded-xl hover:bg-red-500/10 flex-shrink-0"
                    title="Delete import"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {confirmId === h.id && (
                  <div className="mt-3 pt-3 border-t border-slate-700/50">
                    <p className="text-slate-300 mb-2 leading-relaxed">
                      Delete this import? This will also remove all{' '}
                      <span className="text-white font-semibold">
                        {transactions.filter(t => t.import_id === h.id).length}
                      </span>{' '}
                      transactions from this import. This cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => deleteImport(h)}
                        className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs rounded-xl border border-red-500/20 transition-colors font-medium"
                      >
                        Yes, delete import
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-xl transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Delete All */}
          {!confirmAll ? (
            <button
              onClick={() => setConfirmAll(true)}
              className="w-full text-center text-xs text-slate-600 hover:text-red-400 transition-colors py-1.5"
            >
              Delete All Imports
            </button>
          ) : (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl space-y-2">
              <p className="text-xs text-red-300 font-medium leading-relaxed">
                This will delete ALL imported transactions and cannot be undone. Manually entered transactions will not be affected.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={deleteAllImports}
                  className="flex-1 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs rounded-xl border border-red-500/20 transition-colors font-medium"
                >
                  Delete All Imports
                </button>
                <button
                  onClick={() => setConfirmAll(false)}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-xl transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
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
  const ALL_CATS = [...new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES])];

  return (
    <div className="overflow-x-auto max-h-80 overflow-y-auto rounded-2xl border border-slate-800/60">
      <table className="w-full text-xs min-w-[600px]">
        <thead className="sticky top-0 bg-slate-900 z-10">
          <tr className="text-left text-slate-500 border-b border-slate-800">
            {['Date','Merchant','Amount','Type','Category',''].map(h => (
              <th key={h} className="pb-2 px-2 font-medium py-2">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={`border-b border-slate-800/50 ${r._isDup ? 'opacity-50' : ''}`}>
              <td className="py-1 px-2">
                <input type="date" value={r.date} onChange={e => update(i,'date',e.target.value)}
                  className="bg-slate-700/60 border border-slate-600/40 rounded-xl px-1.5 py-0.5 text-white text-xs w-28"/>
              </td>
              <td className="py-1 px-2">
                <div className="flex items-center gap-1">
                  <input value={r.merchant||''} onChange={e => update(i,'merchant',e.target.value)}
                    className="bg-slate-700/60 border border-slate-600/40 rounded-xl px-1.5 py-0.5 text-white text-xs w-36"/>
                  {r._isDup && <span className="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1 py-0.5 rounded flex-shrink-0">Dup</span>}
                </div>
              </td>
              <td className="py-1 px-2">
                <input type="number" step="0.01" value={r.amount} onChange={e => update(i,'amount',+e.target.value)}
                  className="bg-slate-700/60 border border-slate-600/40 rounded-xl px-1.5 py-0.5 text-white text-xs w-20 text-right"/>
              </td>
              <td className="py-1 px-2">
                <select value={r.type} onChange={e => update(i,'type',e.target.value)}
                  className="bg-slate-700/60 border border-slate-600/40 rounded-xl px-1.5 py-0.5 text-white text-xs">
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </td>
              <td className="py-1 px-2">
                <select value={r.category} onChange={e => update(i,'category',e.target.value)}
                  className="bg-slate-700/60 border border-slate-600/40 rounded-xl px-1.5 py-0.5 text-white text-xs">
                  {ALL_CATS.map(c=><option key={c}>{c}</option>)}
                </select>
              </td>
              <td className="py-1 px-2">
                <button onClick={() => deleteRow(i)} className="text-slate-600 hover:text-red-400 transition-colors p-0.5 rounded">
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

// ── Main component ─────────────────────────────────────────────────────────────
export default function StatementImport({ open, onClose, initialFile = null, startOnHistory = false }) {
  const { transactions, setTransactions } = useFinance();

  const [step,               setStep]              = useState('init');
  const [fileType,           setFileType]          = useState(null);
  const [fileName,           setFileName]          = useState('');
  const [dragging,           setDragging]          = useState(false);
  const [errorMsg,           setErrorMsg]          = useState('');
  const [importResult,       setImportResult]      = useState(null);
  const [parsedRows,         setParsedRows]        = useState([]);
  const [overlappingImports, setOverlappingImports]= useState([]);

  const fileRef  = useRef(null);
  const imageRef = useRef(null);

  useEffect(() => {
    if (open && initialFile) processFile(initialFile);
    else if (open && startOnHistory) setStep('history');
    if (!open) resetAll();
  }, [open, initialFile, startOnHistory]);

  function resetAll() {
    setStep('init'); setFileType(null); setFileName(''); setDragging(false);
    setErrorMsg(''); setImportResult(null); setParsedRows([]); setOverlappingImports([]);
  }

  function handleClose() { resetAll(); onClose(); }

  function processFile(file) {
    const type = detectType(file);
    setFileType(type);
    setFileName(file.name);
    handleAIFile(file, type);
  }

  function handleDrop(e) {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer?.files[0] || e.target.files?.[0];
    if (file) processFile(file);
    if (e.target) e.target.value = '';
  }

  function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  async function handleAIFile(file, type) {
    setStep('parsing');
    try {
      const extracted  = await parseWithClaude(file, type === 'pdf');
      const normalized = extracted.map(t => ({
        date:     t.date || today(),
        amount:   Math.abs(Number(t.amount) || 0),
        merchant: (t.merchant || '').trim(),
        type:     t.type === 'income' ? 'income' : 'expense',
        category: t.category || guessCategory(t.merchant),
      })).filter(t => t.amount > 0);

      if (!normalized.length) {
        if (type === 'pdf') { setStep('scanned_pdf'); return; }
        setErrorMsg('No transactions found. Try a clearer image.'); setStep('error'); return;
      }

      const rows = normalized.map(r => ({ ...r, _isDup: isDuplicate(r, transactions) }));
      setParsedRows(rows);

      const dates    = normalized.map(r => r.date).filter(Boolean).sort();
      const newStart = dates[0];
      const newEnd   = dates[dates.length - 1];
      if (newStart && newEnd) {
        const overlaps = checkOverlap(newStart, newEnd);
        if (overlaps.length > 0) {
          setOverlappingImports(overlaps);
          setStep('overlap');
          return;
        }
      }

      setStep('confirm');
    } catch (err) {
      if (err.message === 'NO_TRANSACTIONS' && type === 'pdf') {
        setStep('scanned_pdf');
      } else {
        setErrorMsg(err.message || 'Failed to parse statement. Please try again.');
        setStep('error');
      }
    }
  }

  function handleOverlapChoice(choice) {
    if (choice === 'skip') {
      setParsedRows(prev => prev.filter(r => !r._isDup));
      setStep('confirm');
    } else if (choice === 'delete') {
      const overlapIds    = new Set(overlappingImports.map(h => h.id));
      const updatedTxns   = transactions.filter(t => !t.import_id || !overlapIds.has(t.import_id));
      setTransactions(() => updatedTxns);
      const hist = localGet('fin_import_history') || [];
      localSet('fin_import_history', hist.filter(h => !overlapIds.has(h.id)));
      setParsedRows(prev => prev.map(r => ({ ...r, _isDup: isDuplicate(r, updatedTxns) })));
      setStep('confirm');
    } else {
      resetAll();
    }
  }

  function doImport() {
    const newImportId      = uuid();
    const duplicatesSkipped = parsedRows.filter(r => r._isDup).length;
    const newTxns = parsedRows.map(r => ({
      id: uuid(), date: r.date, amount: r.amount, type: r.type,
      merchant: r.merchant, category: r.category, note: r.note || '',
      source: 'import', import_id: newImportId,
      createdAt: new Date().toISOString(),
    }));
    setTransactions(prev => [...prev, ...newTxns]);
    recordImport({ importId: newImportId, fileName, fileType: fileType || 'image', rows: parsedRows, importedCount: newTxns.length, duplicatesSkipped });
    const dates = parsedRows.map(r => r.date).filter(Boolean).sort();
    setImportResult({ imported: newTxns.length, dateStart: dates[0]||'', dateEnd: dates[dates.length-1]||'' });
    setStep('done');
  }

  // ── Derived for overlap step
  const parsedDates  = parsedRows.map(r => r.date).filter(Boolean).sort();
  const parsedStart  = parsedDates[0] || '';
  const parsedEnd    = parsedDates[parsedDates.length - 1] || '';

  return (
    <Modal open={open} onClose={handleClose} title="Import Bank Statement" size="lg">

      {step === 'history' && (
        <ImportHistory
          onClose={() => setStep('init')}
          transactions={transactions}
          setTransactions={setTransactions}
        />
      )}

      {step === 'init' && (
        <div className="space-y-4">
          <div
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-150 ${
              dragging ? 'border-sky-400 bg-sky-500/10 scale-[1.01]' : 'border-slate-700/60 hover:border-sky-500/50 hover:bg-slate-800/30'
            }`}>
            <div className={`w-12 h-12 mx-auto mb-3 rounded-2xl flex items-center justify-center ${dragging ? 'bg-sky-500/20' : 'bg-slate-800'}`}>
              <Upload size={22} className={dragging ? 'text-sky-400' : 'text-slate-400'}/>
            </div>
            <p className="text-sm font-semibold text-white mb-1">Drop your bank statement here</p>
            <p className="text-xs text-slate-500">Supports PDF and images — AI will read it automatically</p>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,.webp,image/*" className="hidden" onChange={handleDrop}/>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}><Upload size={13}/> Browse Files</Button>
            <Button size="sm" variant="secondary" onClick={() => setStep('history')}><History size={13}/> Import History</Button>
          </div>
        </div>
      )}

      {step === 'parsing' && (
        <div className="flex flex-col items-center gap-4 py-12">
          <Loader2 size={44} className="animate-spin text-sky-400"/>
          <p className="text-base font-semibold text-white">Reading your statement…</p>
          <p className="text-sm text-slate-400 text-center max-w-xs">
            Claude is extracting all transactions from your {fileType === 'pdf' ? 'PDF' : 'image'}.<br/>
            This takes 10–20 seconds.
          </p>
        </div>
      )}

      {step === 'overlap' && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
            <AlertTriangle size={18} className="text-amber-400 flex-shrink-0 mt-0.5"/>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white mb-1">Date Range Overlap Detected</p>
              <p className="text-xs text-slate-400">
                This file covers{' '}
                <span className="text-white font-medium">{fmtDateRange(parsedStart, parsedEnd)}</span>
                {' '}which overlaps with:
              </p>
              <div className="mt-2 space-y-1">
                {overlappingImports.map(h => (
                  <p key={h.id} className="text-xs text-amber-300">
                    • {h.fileName} ({fmtDateRange(h.dateRangeStart, h.dateRangeEnd)}) — {h.transactionsImported} transactions
                  </p>
                ))}
              </div>
            </div>
          </div>

          <p className="text-sm font-medium text-slate-300">What would you like to do?</p>

          <div className="space-y-2">
            <button
              onClick={() => handleOverlapChoice('skip')}
              className="w-full text-left p-3 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/40 hover:border-slate-600 rounded-xl transition-colors"
            >
              <p className="text-sm text-white font-medium">Skip duplicates — import only new transactions</p>
              <p className="text-xs text-slate-500 mt-0.5">Detected duplicates will be filtered out before import</p>
            </button>

            <button
              onClick={() => handleOverlapChoice('delete')}
              className="w-full text-left p-3 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 hover:border-red-500/30 rounded-xl transition-colors"
            >
              <p className="text-sm text-red-300 font-medium">Delete overlapping imports first, then import</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Removes{' '}
                {overlappingImports.reduce((s, h) => s + (h.transactionsImported || 0), 0)}{' '}
                transactions from overlapping imports, then imports this file fresh
              </p>
            </button>

            <button
              onClick={() => handleOverlapChoice('cancel')}
              className="w-full text-left p-3 bg-slate-800/40 hover:bg-slate-700/40 border border-slate-700/30 rounded-xl transition-colors"
            >
              <p className="text-sm text-slate-400 font-medium">Cancel — don't import</p>
            </button>
          </div>
        </div>
      )}

      {step === 'confirm' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-sm font-semibold text-white">{parsedRows.length} transactions found</p>
              {parsedRows.some(r => r._isDup) && (
                <p className="text-xs text-amber-400">
                  {parsedRows.filter(r=>r._isDup).length} possible duplicate{parsedRows.filter(r=>r._isDup).length>1?'s':''} — review before importing
                </p>
              )}
            </div>
            <p className="text-xs text-slate-400">{parsedRows.length} will be imported</p>
          </div>
          <ConfirmTable rows={parsedRows} onChange={setParsedRows}/>
          <p className="text-xs text-slate-500">Edit any field inline. Click <Trash2 size={10} className="inline"/> to remove a row.</p>
          <div className="flex gap-2">
            <Button onClick={doImport} disabled={parsedRows.length === 0}>
              Import {parsedRows.length} Transaction{parsedRows.length !== 1 ? 's' : ''}
            </Button>
            <Button variant="secondary" onClick={() => setStep('init')}>← Start Over</Button>
          </div>
        </div>
      )}

      {step === 'scanned_pdf' && (
        <div className="flex flex-col items-center gap-5 py-8">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center">
            <Image size={26} className="text-amber-400"/>
          </div>
          <div className="text-center space-y-2 max-w-sm">
            <p className="text-base font-semibold text-white">Claude could not extract transactions.</p>
            <p className="text-sm text-slate-400">Please try uploading as an image screenshot instead.</p>
          </div>
          <div className="flex flex-col gap-2 w-full max-w-xs">
            <Button onClick={() => imageRef.current?.click()}><Image size={14}/> Upload as Image</Button>
            <Button variant="secondary" onClick={() => setStep('init')}>← Try a Different File</Button>
          </div>
          <input ref={imageRef} type="file" accept=".jpg,.jpeg,.png,.heic,.webp,image/*" className="hidden" onChange={handleImageUpload}/>
        </div>
      )}

      {step === 'done' && importResult && (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 flex items-center justify-center">
            <CheckCircle size={32} className="text-emerald-400"/>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-white mb-1">
              Imported {importResult.imported} transaction{importResult.imported !== 1 ? 's' : ''}
            </p>
            {importResult.dateStart && (
              <p className="text-sm text-slate-400">{fmtDateRange(importResult.dateStart, importResult.dateEnd)}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={() => { resetAll(); setStep('init'); }}>Import Another</Button>
            <Button variant="secondary" onClick={handleClose}>Done</Button>
          </div>
        </div>
      )}

      {step === 'error' && (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center">
            <AlertCircle size={28} className="text-red-400"/>
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-white mb-2">Import Failed</p>
            <p className="text-sm text-slate-400">{errorMsg}</p>
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
