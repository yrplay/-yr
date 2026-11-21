import type { StudentSubscription } from '../types';

export const CANONICAL_HIJRI_MONTHS = [
  'محرم',
  'صفر',
  'ربيع الأول',
  'ربيع الآخر',
  'جمادى الأولى',
  'جمادى الآخرة',
  'رجب',
  'شعبان',
  'رمضان',
  'شوال',
  'ذو القعدة',
  'ذو الحجة'
] as const;

export const toWesternDigits = (value: string): string =>
  value.replace(/[٠-٩]/g, ch => String(ch.charCodeAt(0) - 0x0660));

const HIJRI_MONTH_VARIANTS: Array<{ index: number; canonical: string; patterns: string[] }> = [
  { index: 1, canonical: 'محرم', patterns: ['المحرم', 'محرم'] },
  { index: 2, canonical: 'صفر', patterns: ['صفر'] },
  { index: 3, canonical: 'ربيع الأول', patterns: ['ربيع الأول', 'ربيع الاول'] },
  { index: 4, canonical: 'ربيع الآخر', patterns: ['ربيع الآخر', 'ربيع الاخر', 'ربيع الثاني', 'ربيع الثانى'] },
  { index: 5, canonical: 'جمادى الأولى', patterns: ['جمادى الأولى', 'جمادى الاولى', 'جماد الأولى', 'جماد الاولى', 'جماد الأول'] },
  {
    index: 6,
    canonical: 'جمادى الآخرة',
    patterns: ['جمادى الآخرة', 'جمادى الاخرة', 'جمادى الآخر', 'جمادى الاخر', 'جمادى الثانية', 'جمادى الثانيه', 'جماد الآخرة', 'جماد الآخر']
  },
  { index: 7, canonical: 'رجب', patterns: ['رجب'] },
  { index: 8, canonical: 'شعبان', patterns: ['شعبان'] },
  { index: 9, canonical: 'رمضان', patterns: ['رمضان'] },
  { index: 10, canonical: 'شوال', patterns: ['شوال'] },
  { index: 11, canonical: 'ذو القعدة', patterns: ['ذو القعدة', 'ذي القعدة', 'ذى القعدة', 'ذو القعده'] },
  { index: 12, canonical: 'ذو الحجة', patterns: ['ذو الحجة', 'ذي الحجة', 'ذى الحجة', 'ذو الحجه'] }
];

export interface ParsedHijriCycle {
  canonicalLabel: string;
  monthName: string;
  monthIndex: number;
  hijriYear: number;
  hasExplicitYear: boolean;
}

export const parseHijriCycle = (
  rawCycle: string | undefined | null,
  fallbackHijriYear = 1448
): ParsedHijriCycle | null => {
  if (!rawCycle || typeof rawCycle !== 'string') return null;
  const cleaned = toWesternDigits(rawCycle).trim().replace(/\s+/g, ' ');
  if (!cleaned) return null;

  const matchedMonths: Array<{ index: number; canonical: string }> = [];
  for (const entry of HIJRI_MONTH_VARIANTS) {
    if (entry.patterns.some(p => cleaned.includes(p))) {
      matchedMonths.push({ index: entry.index, canonical: entry.canonical });
    }
  }

  // Reject compound multi-month legacy strings (e.g. "ربيع الآخر - جمادى الأولى 1446") or non-month strings
  if (matchedMonths.length !== 1) {
    return null;
  }

  const yearMatch = cleaned.match(/\b(14\d{2})\b/) || cleaned.match(/(14\d{2})/);
  const hasExplicitYear = Boolean(yearMatch);
  const hijriYear = yearMatch ? Number(yearMatch[1]) : fallbackHijriYear;
  const month = matchedMonths[0];
  const canonicalLabel = `${month.canonical} ${hijriYear}هـ`;

  return {
    canonicalLabel,
    monthName: month.canonical,
    monthIndex: month.index,
    hijriYear,
    hasExplicitYear
  };
};

export const normalizeHijriCycleLabel = (
  rawCycle: string | undefined | null,
  fallbackHijriYear = 1448
): string => {
  const parsed = parseHijriCycle(rawCycle, fallbackHijriYear);
  if (parsed) return parsed.canonicalLabel;
  return (rawCycle || '').trim();
};

const hasActiveSubscriptionData = (sub: StudentSubscription): boolean =>
  Boolean(
    (sub.paidAmount ?? 0) > 0 ||
      sub.status === 'paid' ||
      sub.status === 'partial' ||
      sub.status === 'exempt' ||
      sub.status === 'overdue' ||
      sub.receiptNumber?.trim() ||
      sub.notes?.trim()
  );

export const deduplicateSubscriptionsByCycle = (
  subscriptions: StudentSubscription[],
  currentCycle: string,
  cycleFilter: string,
  fallbackHijriYear = 1448
) => {
  if (!subscriptions || subscriptions.length === 0) return [];

  const normalizedCurrentCycle = normalizeHijriCycleLabel(currentCycle, fallbackHijriYear);
  const normalizedFilter =
    cycleFilter === 'all' ? 'all' : normalizeHijriCycleLabel(cycleFilter, fallbackHijriYear);

  // The "all" view must retain the latest record for every canonical cycle, not only
  // the latest record across the student's entire subscription history.
  const byCycle = new Map<string, StudentSubscription>();
  subscriptions.forEach(subscription => {
    const parsed = parseHijriCycle(subscription.cycleMonth, fallbackHijriYear);
    const rawCycle = (subscription.cycleMonth || '').trim();
    // Keep valid non-Hijri cycle identifiers (e.g. named terms) as opaque keys.
    // Only discard legacy strings that combine multiple Hijri months and cannot
    // be assigned unambiguously to one collection cycle.
    const matchedMonthCount = HIJRI_MONTH_VARIANTS.filter(entry =>
      entry.patterns.some(pattern => rawCycle.includes(pattern))
    ).length;
    if (rawCycle && !parsed && matchedMonthCount > 1) return;

    const cycle = parsed ? parsed.canonicalLabel : (rawCycle || normalizedCurrentCycle);
    if (normalizedFilter !== 'all' && cycle !== normalizedFilter) return;

    const subscriptionTime = Date.parse(subscription.updatedAt || '') || 0;
    const existing = byCycle.get(cycle);
    if (!existing) {
      byCycle.set(cycle, subscription);
      return;
    }

    const subActive = hasActiveSubscriptionData(subscription);
    const existingActive = hasActiveSubscriptionData(existing);
    if (subActive && !existingActive) {
      byCycle.set(cycle, subscription);
      return;
    }
    if (!subActive && existingActive) {
      return;
    }

    const existingTime = Date.parse(existing.updatedAt || '') || 0;
    if (subscriptionTime >= existingTime) {
      byCycle.set(cycle, subscription);
    }
  });

  return [...byCycle.values()];
};

export const calculateSubscriptionStats = (
  students: Array<{ id: string }>,
  subscriptions: StudentSubscription[],
  currentCycle: string,
  cycleFilter: string,
  defaultFee: number
) => {
  let totalExpected = 0;
  let totalCollected = 0;
  let totalRemaining = 0;
  let paidCount = 0;
  let partialCount = 0;
  let pendingCount = 0;
  let overdueCount = 0;
  let exemptCount = 0;

  students.forEach(student => {
    const studentSubscriptions = deduplicateSubscriptionsByCycle(
      subscriptions.filter(subscription => subscription.studentId === student.id),
      currentCycle,
      cycleFilter
    );

    if (studentSubscriptions.length === 0) {
      totalExpected += defaultFee;
      totalRemaining += defaultFee;
      pendingCount++;
      return;
    }

    let hasNonExemptCycle = false;
    let hasUnpaidCycle = false;
    let hasPartialCycle = false;
    let hasOverdueCycle = false;

    studentSubscriptions.forEach(sub => {
      const isExempt = sub.status === 'exempt' || sub.paymentMethod === 'exempt';
      if (isExempt) return;

      hasNonExemptCycle = true;
      const required = sub.requiredAmount ?? defaultFee;
      const paid = sub.paidAmount ?? 0;
      const isPaid = sub.status === 'paid' || (paid >= required && required > 0);
      const remaining = isPaid ? 0 : Math.max(0, required - paid);

      totalExpected += required;
      totalCollected += paid;
      totalRemaining += remaining;

      if (!isPaid) hasUnpaidCycle = true;
      if (sub.status === 'overdue') hasOverdueCycle = true;
      if (sub.status === 'partial' || (paid > 0 && paid < required)) {
        hasPartialCycle = true;
      }
    });

    if (!hasNonExemptCycle) {
      exemptCount++;
      return;
    }

    if (hasUnpaidCycle) pendingCount++;
    else paidCount++;
    if (hasPartialCycle) partialCount++;
    if (hasOverdueCycle) overdueCount++;
  });

  const collectionRate = totalExpected > 0
    ? Math.min(100, Math.round((totalCollected / totalExpected) * 100))
    : 0;

  return {
    totalExpected,
    totalCollected,
    totalRemaining,
    collectionRate,
    paidCount,
    partialCount,
    pendingCount,
    overdueCount,
    exemptCount
  };
};
