const TZ = 'America/New_York';

// Returns YYYY-MM-DD in Eastern Time
export const today = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: TZ });

export const fmtDate = (d) => {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// "Sunday, May 21" format
export const fmtDateFull = (d) => {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
};

export const fmtCurrency = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0);

export const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

export const pct = (val, total) => (total > 0 ? Math.round((val / total) * 100) : 0);

export const uuid = () => crypto.randomUUID();

export const getDayOfWeek = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00');
  return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
};

export const getLast7Days = () => {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toLocaleDateString('en-CA', { timeZone: TZ });
  });
};

export const getLast30Days = () => {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return d.toLocaleDateString('en-CA', { timeZone: TZ });
  });
};

export const hoursFromTimes = (bedtime, waketime) => {
  if (!bedtime || !waketime) return 0;
  const [bh, bm] = bedtime.split(':').map(Number);
  const [wh, wm] = waketime.split(':').map(Number);
  let mins = (wh * 60 + wm) - (bh * 60 + bm);
  if (mins < 0) mins += 24 * 60;
  return +(mins / 60).toFixed(1);
};

export const sleepColor = (h) => {
  if (h >= 7) return 'text-green-400';
  if (h >= 6) return 'text-yellow-400';
  return 'text-red-400';
};

export const bmi = (weightKg, heightCm) => {
  if (!weightKg || !heightCm) return null;
  return +(weightKg / ((heightCm / 100) ** 2)).toFixed(1);
};

export const lbsToKg = (lbs) => +(lbs * 0.453592).toFixed(1);
export const kgToLbs = (kg) => +(kg * 2.20462).toFixed(1);

export const csvFromRows = (headers, rows) => {
  const lines = [headers.join(','), ...rows.map(r => headers.map(h => `"${r[h] ?? ''}"`).join(','))];
  return lines.join('\n');
};

export const downloadCSV = (filename, headers, rows) => {
  const blob = new Blob([csvFromRows(headers, rows)], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
};

export const calcStreak = (dates) => {
  if (!dates?.length) return 0;
  const sorted = [...new Set(dates)].sort().reverse();
  let streak = 0, cur = today();
  for (const d of sorted) {
    if (d === cur) { streak++; const dt = new Date(cur + 'T12:00:00'); dt.setDate(dt.getDate() - 1); cur = dt.toLocaleDateString('en-CA', { timeZone: TZ }); }
    else if (d < cur) break;
  }
  return streak;
};
