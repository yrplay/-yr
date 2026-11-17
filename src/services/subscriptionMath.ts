import type { StudentSubscription } from '../types';

export const deduplicateSubscriptionsByCycle = (
  subscriptions: StudentSubscription[],
  currentCycle: string,
  cycleFilter: string
) => {
  if (!subscriptions || subscriptions.length === 0) return [];

  // The "all" view must retain the latest record for every cycle, not only
  // the latest record across the student's entire subscription history.
  const byCycle = new Map<string, StudentSubscription>();
  subscriptions.forEach(subscription => {
    const cycle = subscription.cycleMonth || currentCycle;
    if (cycleFilter !== 'all' && cycle !== cycleFilter) return;

    const subscriptionTime = Date.parse(subscription.updatedAt || '') || 0;
    const existing = byCycle.get(cycle);
    const existingTime = existing ? Date.parse(existing.updatedAt || '') || 0 : -1;
    if (!existing || subscriptionTime >= existingTime) {
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
