import type { StudentSubscription } from '../types';

export const deduplicateSubscriptionsByCycle = (
  subscriptions: StudentSubscription[],
  currentCycle: string,
  cycleFilter: string
) => {
  const byCycle = new Map<string, StudentSubscription>();
  subscriptions.forEach(subscription => {
    const cycle = subscription.cycleMonth || currentCycle;
    if (cycleFilter !== 'all' && cycle !== cycleFilter) return;
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
  let paidCount = 0;
  let pendingCount = 0;
  let exemptCount = 0;

  students.forEach(student => {
    const studentSubscriptions = deduplicateSubscriptionsByCycle(
      subscriptions.filter(subscription => subscription.studentId === student.id),
      currentCycle,
      cycleFilter
    );
    const required = studentSubscriptions.length
      ? studentSubscriptions
          .filter(subscription => subscription.status !== 'exempt')
          .reduce((sum, subscription) => sum + (subscription.requiredAmount ?? defaultFee), 0)
      : defaultFee;
    const paid = studentSubscriptions.reduce((sum, subscription) => sum + (subscription.paidAmount ?? 0), 0);
    totalExpected += required;
    totalCollected += paid;

    if (studentSubscriptions.length > 0 && studentSubscriptions.every(subscription => subscription.status === 'exempt')) {
      exemptCount++;
    } else if (paid >= required && required > 0) {
      paidCount++;
    } else {
      pendingCount++;
    }
  });

  const totalRemaining = Math.max(0, totalExpected - totalCollected);
  const collectionRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;
  return { totalExpected, totalCollected, totalRemaining, collectionRate, paidCount, pendingCount, exemptCount };
};
