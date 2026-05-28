// calculateIncomeForMonth(source, year, month) — month is 0-indexed (Jan=0).
// Respects source start/end dates. Never returns income outside the active period.
// Used by Forecast chart, Forecast table, Income tab, and dashboard summary card.

export function calculateIncomeForMonth(source, year, month) {
  const net = +(source.netAmount || 0);
  if (!net || !source.startDate) return 0;

  const monthStart  = new Date(year, month, 1);
  const monthEnd    = new Date(year, month + 1, 0); // last day of month
  const sourceStart = new Date(source.startDate + 'T00:00:00');
  const sourceEnd   = source.endDate ? new Date(source.endDate + 'T00:00:00') : null;

  // Source hasn't started yet this month
  if (sourceStart > monthEnd) return 0;
  // Source ended before this month
  if (sourceEnd && sourceEnd < monthStart) return 0;

  const effectiveStart = sourceStart > monthStart ? sourceStart : monthStart;
  const effectiveEnd   = sourceEnd && sourceEnd < monthEnd ? sourceEnd : monthEnd;

  const freq = source.frequency;

  // ── Semi-monthly: pay on 1st and 15th ─────────────────────────────────────
  if (freq === 'semi-monthly') {
    let total = 0;

    const pay1 = new Date(year, month, 1);
    if (pay1 >= effectiveStart && pay1 <= effectiveEnd) {
      const isFirstEverMonth =
        sourceStart.getFullYear() === year &&
        sourceStart.getMonth() === month &&
        sourceStart.getDate() > 1;
      if (isFirstEverMonth) {
        // Period 1–14; pro-rate days from start date through 14th
        const daysInPeriod = 14;
        const daysWorked   = Math.max(0, 15 - sourceStart.getDate());
        total += +(net * (daysWorked / daysInPeriod)).toFixed(2);
      } else {
        total += net;
      }
    }

    const pay15 = new Date(year, month, 15);
    if (pay15 >= effectiveStart && pay15 <= effectiveEnd) {
      const isLastPartialMonth = sourceEnd && sourceEnd < monthEnd;
      if (isLastPartialMonth) {
        // Period 15–EOM; pro-rate days through source end date
        const lastDay      = monthEnd.getDate();
        const daysInPeriod = lastDay - 15 + 1;
        const daysWorked   = Math.max(0, sourceEnd.getDate() - 14);
        total += +(net * (daysWorked / daysInPeriod)).toFixed(2);
      } else {
        total += net;
      }
    }

    return +total.toFixed(2);
  }

  // ── Biweekly: walk pay dates from source start ─────────────────────────────
  if (freq === 'biweekly') {
    let payDate = new Date(sourceStart.getTime() + 14 * 86400000); // first pay 14d after start
    let total = 0, iters = 0;
    const ceiling = sourceEnd || monthEnd;
    while (payDate <= ceiling && iters++ < 200) {
      if (payDate >= monthStart && payDate <= monthEnd &&
          payDate >= effectiveStart && payDate <= effectiveEnd) {
        total += net;
      }
      payDate = new Date(payDate.getTime() + 14 * 86400000);
    }
    return total;
  }

  // ── Weekly ────────────────────────────────────────────────────────────────
  if (freq === 'weekly') {
    let payDate = new Date(sourceStart.getTime() + 7 * 86400000);
    let total = 0, iters = 0;
    const ceiling = sourceEnd || monthEnd;
    while (payDate <= ceiling && iters++ < 100) {
      if (payDate >= monthStart && payDate <= monthEnd &&
          payDate >= effectiveStart && payDate <= effectiveEnd) {
        total += net;
      }
      payDate = new Date(payDate.getTime() + 7 * 86400000);
    }
    return total;
  }

  // ── Monthly: pay on same day-of-month as start date ──────────────────────
  if (freq === 'monthly') {
    const payDay  = sourceStart.getDate();
    const payDate = new Date(year, month, payDay);
    return payDate >= effectiveStart && payDate <= effectiveEnd ? net : 0;
  }

  // ── Quarterly ─────────────────────────────────────────────────────────────
  if (freq === 'quarterly') {
    const monthsSinceStart =
      (year - sourceStart.getFullYear()) * 12 + (month - sourceStart.getMonth());
    if (monthsSinceStart >= 0 && monthsSinceStart % 3 === 0) {
      const payDate = new Date(year, month, sourceStart.getDate());
      return payDate >= effectiveStart && payDate <= effectiveEnd ? net : 0;
    }
    return 0;
  }

  // ── Annual ────────────────────────────────────────────────────────────────
  if (freq === 'annual') {
    if (sourceStart.getMonth() === month) {
      const payDate = new Date(year, month, sourceStart.getDate());
      return payDate >= effectiveStart && payDate <= effectiveEnd ? net : 0;
    }
    return 0;
  }

  // ── One-time ──────────────────────────────────────────────────────────────
  if (freq === 'one-time') {
    const payDate = new Date(source.startDate + 'T00:00:00');
    return payDate.getFullYear() === year && payDate.getMonth() === month ? net : 0;
  }

  return 0;
}

// ── Source status helpers ─────────────────────────────────────────────────────

export function isSourceCompleted(source) {
  if (!source.endDate) return false;
  const t = new Date().toISOString().slice(0, 10);
  return source.endDate < t;
}

export function isSourceUpcoming(source) {
  if (!source.startDate) return false;
  const t = new Date().toISOString().slice(0, 10);
  return source.startDate > t;
}

export function getSourceStatus(source) {
  if (source.active === false) return 'inactive';
  if (isSourceCompleted(source))  return 'completed';
  if (isSourceUpcoming(source))   return 'upcoming';
  return 'active';
}

export function fmtSourceStatus(source) {
  const s = getSourceStatus(source);
  if (s === 'completed') return 'Completed';
  if (s === 'inactive')  return 'Inactive';
  if (s === 'upcoming') {
    const d = new Date(source.startDate + 'T00:00:00');
    return `Starting ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }
  return 'Active';
}

export function getDaysUntilEnd(source) {
  if (!source.endDate || isSourceCompleted(source)) return null;
  const end = new Date(source.endDate + 'T00:00:00');
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((end - now) / 86400000);
}

// ── Next payment date ─────────────────────────────────────────────────────────

export function getNextPaymentDate(source) {
  if (!source.startDate || !source.netAmount) return null;
  const sourceStart = new Date(source.startDate + 'T00:00:00');
  const sourceEnd   = source.endDate ? new Date(source.endDate + 'T00:00:00') : null;
  const today = new Date(); today.setHours(0, 0, 0, 0);

  if (sourceEnd && sourceEnd < today) return null;

  const freq = source.frequency;

  if (freq === 'semi-monthly') {
    const y = today.getFullYear(), m = today.getMonth(), d = today.getDate();
    const candidates = [new Date(y, m, 1), new Date(y, m, 15), new Date(y, m + 1, 1), new Date(y, m + 1, 15)];
    for (const c of candidates) {
      if (c >= today && (!sourceEnd || c <= sourceEnd)) return c;
    }
    return null;
  }

  if (freq === 'biweekly') {
    let d = new Date(sourceStart.getTime() + 14 * 86400000);
    while (d < today) d = new Date(d.getTime() + 14 * 86400000);
    return (!sourceEnd || d <= sourceEnd) ? d : null;
  }

  if (freq === 'weekly') {
    let d = new Date(sourceStart.getTime() + 7 * 86400000);
    while (d < today) d = new Date(d.getTime() + 7 * 86400000);
    return (!sourceEnd || d <= sourceEnd) ? d : null;
  }

  if (freq === 'monthly') {
    const payDay = sourceStart.getDate();
    let d = new Date(today.getFullYear(), today.getMonth(), payDay);
    if (d < today) d = new Date(today.getFullYear(), today.getMonth() + 1, payDay);
    return (!sourceEnd || d <= sourceEnd) ? d : null;
  }

  if (freq === 'one-time') {
    return sourceStart >= today ? sourceStart : null;
  }

  return null;
}
