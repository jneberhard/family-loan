export type LedgerItem = {
  id: string;
  date: string;
  type: "Loan" | "Payment" | "Interest" | "Adjustment" | "Rate change";
  description: string;
  amount: number;
  rate: number | null;
};

export type AprInterestSegment = {
  startDate: string;
  endDate: string;
  days: number;
  balance: number;
  apr: number;
  interest: number;
};

export function calculateRunningLedger(items: LedgerItem[]) {
  let balance = 0;
  return [...items]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((item) => {
      balance += item.amount;
      return { ...item, balance: Math.round(balance * 100) / 100 };
    });
}

export function calculateInterest(
  principal: number,
  annualRate: number,
  periodStart: Date,
  periodEnd: Date,
) {
  const days = Math.max(1, Math.round((periodEnd.getTime() - periodStart.getTime()) / 86_400_000));
  return Math.round(principal * (annualRate / 100) * (days / 365) * 100) / 100;
}

function utcDay(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function daysBetween(startDate: string, endDate: string) {
  return Math.max(0, Math.round((utcDay(endDate) - utcDay(startDate)) / 86_400_000));
}

/**
 * Calculates simple daily interest from an annual percentage rate (APR).
 *
 * Transactions are effective at the start of their date. A loan begins
 * accruing on its loan date; a payment or negative adjustment reduces the
 * interest-bearing balance beginning on its effective date.
 */
export function calculateAprInterest(
  items: LedgerItem[],
  defaultApr: number,
  periodStart: string,
  periodEnd: string,
) {
  if (daysBetween(periodStart, periodEnd) <= 0) {
    return { total: 0, totalDays: 0, segments: [] as AprInterestSegment[] };
  }

  const ordered = items
    .map((item, index) => ({ ...item, index }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.index - b.index);

  let balance = 0;
  let activeApr = defaultApr;
  let cursor = periodStart;
  const segments: AprInterestSegment[] = [];

  function addSegment(endDate: string) {
    const days = daysBetween(cursor, endDate);
    const interestBearingBalance = Math.max(0, balance);
    if (days > 0 && interestBearingBalance > 0 && activeApr > 0) {
      const rawInterest = interestBearingBalance * (activeApr / 100) * (days / 365);
      segments.push({
        startDate: cursor,
        endDate,
        days,
        balance: Math.round(interestBearingBalance * 100) / 100,
        apr: activeApr,
        interest: Math.round(rawInterest * 10000) / 10000,
      });
    }
    cursor = endDate;
  }

  for (const item of ordered) {
    if (item.date <= periodStart) {
      balance += item.amount;
      if (item.rate !== null) activeApr = item.rate;
      continue;
    }
    if (item.date >= periodEnd) break;
    addSegment(item.date);
    balance += item.amount;
    if (item.rate !== null) activeApr = item.rate;
  }

  addSegment(periodEnd);
  const rawTotal = segments.reduce((sum, segment) => sum + segment.interest, 0);
  return {
    total: Math.round(rawTotal * 100) / 100,
    totalDays: daysBetween(periodStart, periodEnd),
    segments,
  };
}
