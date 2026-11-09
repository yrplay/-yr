import type { StudentSubscription } from '../types';

export const deduplicateSubscriptionsByCycle = (
  subscriptions: StudentSubscription[],
  currentCycle: string,
  cycleFilter: string
) => {
  if (!subscriptions || subscriptions.length === 0) return [];

  if (cycleFilter === 'all') {
    // Return the single most recently updated subscription record for this student
    let latest: StudentSubscription | null = null;
    let latestTime = -1;
    subscriptions.forEach(subscription => {
      const subscriptionTime = Date.parse(subscription.updatedAt || '') || 0;
      if (!latest || subscriptionTime >= latestTime) {
        latest = subscription;
        latestTime = subscriptionTime;
      }
    });
    return latest ? [latest] : [];
  }

  const byCycle = new Map<string, StudentSubscription>();
  subscriptions.forEach(subscription => {
    const cycle = subscription.cycleMonth || currentCycle;
    if (cycle !== cycleFilter) return;
    const subscriptionTime = Date.parse(subscription.updatedAt || '') || 0;
    const existing = byCycle.get(cycle);
    const existingTime = existing ? Date.parse(existing.updatedAt || '') || 0 : -1;
    if (!existing || subscriptionTime >= existingTime) byCycle.set(cycle, subscription);
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
    const sub = studentSubscriptions[0];
    const isExempt = Boolean(sub && (sub.status === 'exempt' || sub.paymentMethod === 'exempt'));

    if (isExempt) {
      exemptCount++;
      // Exempt / Scholarship students have 0 remaining balance and are fee-exempt
      return;
    }

    const required = sub ? (sub.requiredAmount ?? defaultFee) : defaultFee;
    const paid = sub ? (sub.paidAmount ?? 0) : 0;
    const isPaid = sub?.status === 'paid' || (paid >= required && required > 0);
    const remaining = isPaid ? 0 : Math.max(0, required - paid);

    totalExpected += required;
    totalCollected += paid;
    totalRemaining += remaining;

    if (isPaid) {
      paidCount++;
    } else if (sub?.status === 'overdue') {
      overdueCount++;
      pendingCount++;
    } else if (sub?.status === 'partial' || (paid > 0 && paid < required)) {
      partialCount++;
      pendingCount++;
    } else {
      pendingCount++;
    }
  });

  const collectionRate = totalExpected > 0 ? Math.min(100, Math.round((totalCollected / totalExpected) * 100)) : 0;
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
