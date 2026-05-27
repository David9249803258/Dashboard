// Pro rata calculation utilities for income sources

export function getDaysInMonth(year, month) { // month is 0-indexed
  return new Date(year, month + 1, 0).getDate();
}

export function getPaymentsPerYear(frequency) {
  const map = { weekly: 52, biweekly: 26, 'semi-monthly': 24, monthly: 12, quarterly: 4, annual: 1, 'one-time': 1 };
  return map[frequency] || 12;
}

/**
 * Returns pro rata info for the first payment when a source starts mid-period.
 * Returns null if the source starts at the beginning of a period (no proration needed).
 */
export function calcProRataFirst(startDateStr, frequency, netAmount) {
  if (!startDateStr || !netAmount || +netAmount <= 0) return null;
  const d = new Date(startDateStr + 'T00:00:00');
  const day = d.getDate();
  const dim = getDaysInMonth(d.getFullYear(), d.getMonth());

  switch (frequency) {
    case 'semi-monthly': {
      // Period A: days 1–14 (14 days total), paid on 15th
      // Period B: days 15–dim, paid on 1st of next month
      if (day === 1 || day === 15) return null; // starts exactly on a pay period start
      if (day < 15) {
        const daysWorked = 15 - day; // e.g., start day 5 → 10 days (5,6,...,14)
        return { amount: +(daysWorked / 14 * netAmount).toFixed(2), days: daysWorked, totalDays: 14 };
      } else {
        const daysWorked = dim - day + 1;
        const totalDays = dim - 14;
        if (daysWorked >= totalDays) return null;
        return { amount: +(daysWorked / totalDays * netAmount).toFixed(2), days: daysWorked, totalDays };
      }
    }
    case 'biweekly': {
      // Assume pay periods start on Mondays (daysIntoWeek = 0 → period start)
      const daysIntoWeek = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
      if (daysIntoWeek === 0) return null;
      const daysWorked = 14 - daysIntoWeek;
      return { amount: +(daysWorked / 14 * netAmount).toFixed(2), days: daysWorked, totalDays: 14 };
    }
    case 'monthly': {
      if (day === 1) return null;
      const daysWorked = dim - day + 1;
      return { amount: +(daysWorked / dim * netAmount).toFixed(2), days: daysWorked, totalDays: dim };
    }
    case 'weekly': {
      const daysIntoWeek = (d.getDay() + 6) % 7;
      if (daysIntoWeek === 0) return null;
      const daysWorked = 7 - daysIntoWeek;
      return { amount: +(daysWorked / 7 * netAmount).toFixed(2), days: daysWorked, totalDays: 7 };
    }
    default: return null;
  }
}

/**
 * Returns pro rata info for the last payment when a source ends mid-period.
 * Returns null if the source ends at the end of a period (no proration needed).
 */
export function calcProRataLast(endDateStr, frequency, netAmount) {
  if (!endDateStr || !netAmount || +netAmount <= 0) return null;
  const d = new Date(endDateStr + 'T00:00:00');
  const day = d.getDate();
  const dim = getDaysInMonth(d.getFullYear(), d.getMonth());

  switch (frequency) {
    case 'semi-monthly': {
      if (day === 14) return null; // completes period A
      if (day === dim) return null; // completes period B
      if (day < 15) {
        const daysWorked = day; // worked days 1 through day
        return { amount: +(daysWorked / 14 * netAmount).toFixed(2), days: daysWorked, totalDays: 14 };
      } else {
        const daysWorked = day - 14;
        const totalDays = dim - 14;
        if (daysWorked >= totalDays) return null;
        return { amount: +(daysWorked / totalDays * netAmount).toFixed(2), days: daysWorked, totalDays };
      }
    }
    case 'biweekly': {
      const daysWorked = ((d.getDay() + 6) % 7) + 1;
      if (daysWorked >= 14) return null;
      return { amount: +(daysWorked / 14 * netAmount).toFixed(2), days: daysWorked, totalDays: 14 };
    }
    case 'monthly': {
      if (day === dim) return null;
      return { amount: +(day / dim * netAmount).toFixed(2), days: day, totalDays: dim };
    }
    case 'weekly': {
      const daysWorked = ((d.getDay() + 6) % 7) + 1;
      if (daysWorked >= 7) return null;
      return { amount: +(daysWorked / 7 * netAmount).toFixed(2), days: daysWorked, totalDays: 7 };
    }
    default: return null;
  }
}

/**
 * Computes adjusted monthly income for a source in a given YYYY-MM month,
 * accounting for pro rata start/end periods.
 * Returns { income: number, isProRata: boolean }
 */
export function getMonthlyIncomeForSource(src, monthStr) {
  const netAmount = +(src.netAmount || 0);
  const ppy = getPaymentsPerYear(src.frequency);
  const fullMonthly = netAmount * ppy / 12;

  const srcStartMonth = src.startDate ? src.startDate.slice(0, 7) : null;
  const srcEndMonth   = src.endDate   ? src.endDate.slice(0, 7)   : null;

  if (srcStartMonth && srcStartMonth > monthStr) return { income: 0, isProRata: false };
  if (srcEndMonth   && srcEndMonth   < monthStr) return { income: 0, isProRata: false };

  const isFirstMonth = srcStartMonth === monthStr;
  const isLastMonth  = srcEndMonth   === monthStr;

  // Same month start and end — use the smaller of the two prorations
  if (isFirstMonth && isLastMonth && src.startDate && src.endDate) {
    const prFirst = calcProRataFirst(src.startDate, src.frequency, netAmount);
    const prLast  = calcProRataLast(src.endDate,   src.frequency, netAmount);
    const a = prFirst ? prFirst.amount : fullMonthly;
    const b = prLast  ? prLast.amount  : fullMonthly;
    return { income: +Math.min(a, b).toFixed(0), isProRata: true };
  }

  if (isFirstMonth && src.startDate) {
    if (src.frequency === 'semi-monthly') {
      const startDay = new Date(src.startDate + 'T00:00:00').getDate();
      if (startDay <= 1)  return { income: +fullMonthly.toFixed(0), isProRata: false };
      if (startDay < 15) {
        const pr = calcProRataFirst(src.startDate, src.frequency, netAmount);
        // pro rata first half + full second half payment
        return { income: +((pr?.amount ?? netAmount) + netAmount).toFixed(0), isProRata: true };
      }
      if (startDay === 15) return { income: netAmount, isProRata: false }; // one full payment
      const pr = calcProRataFirst(src.startDate, src.frequency, netAmount);
      return pr
        ? { income: +pr.amount.toFixed(0), isProRata: true }
        : { income: netAmount, isProRata: false };
    }
    const pr = calcProRataFirst(src.startDate, src.frequency, netAmount);
    return pr
      ? { income: +pr.amount.toFixed(0), isProRata: true }
      : { income: +fullMonthly.toFixed(0), isProRata: false };
  }

  if (isLastMonth && src.endDate) {
    if (src.frequency === 'semi-monthly') {
      const d = new Date(src.endDate + 'T00:00:00');
      const endDay = d.getDate();
      const dim = getDaysInMonth(d.getFullYear(), d.getMonth());
      if (endDay >= dim) return { income: +fullMonthly.toFixed(0), isProRata: false };
      if (endDay >= 15) {
        const pr = calcProRataLast(src.endDate, src.frequency, netAmount);
        // full first half + pro rata second half
        return pr
          ? { income: +(netAmount + pr.amount).toFixed(0), isProRata: true }
          : { income: +fullMonthly.toFixed(0), isProRata: false };
      }
      if (endDay === 14) return { income: netAmount, isProRata: false }; // one full payment
      const pr = calcProRataLast(src.endDate, src.frequency, netAmount);
      return pr
        ? { income: +pr.amount.toFixed(0), isProRata: true }
        : { income: netAmount, isProRata: false };
    }
    const pr = calcProRataLast(src.endDate, src.frequency, netAmount);
    return pr
      ? { income: +pr.amount.toFixed(0), isProRata: true }
      : { income: +fullMonthly.toFixed(0), isProRata: false };
  }

  return { income: +fullMonthly.toFixed(0), isProRata: false };
}
