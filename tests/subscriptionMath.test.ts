import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSubscriptionStats, deduplicateSubscriptionsByCycle } from '../src/services/subscriptionMath';
import type { StudentSubscription } from '../src/types';

const subscriptions: StudentSubscription[] = [
  { id: 'old-a', studentId: 's1', trackId: 't1', cycleMonth: 'A', requiredAmount: 100, paidAmount: 100, status: 'paid', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'new-a', studentId: 's1', trackId: 't1', cycleMonth: 'A', requiredAmount: 100, paidAmount: 50, status: 'partial', updatedAt: '2026-02-01T00:00:00.000Z' },
  { id: 'b', studentId: 's1', trackId: 't1', cycleMonth: 'B', requiredAmount: 100, paidAmount: 30, status: 'partial', updatedAt: '2026-02-02T00:00:00.000Z' }
];

test('all-cycle financial totals include each cycle once and use the latest record per cycle', () => {
  const result = calculateSubscriptionStats([{ id: 's1' }, { id: 's2' }], subscriptions, 'B', 'all', 100);
  assert.deepEqual(result, {
    totalExpected: 300,
    totalCollected: 80,
    totalRemaining: 220,
    collectionRate: 27,
    paidCount: 0,
    pendingCount: 2,
    exemptCount: 0
  });
});

test('cycle filter excludes other cycles and payment entry uses only selected cycle', () => {
  const filtered = deduplicateSubscriptionsByCycle(subscriptions, 'B', 'A');
  assert.deepEqual(filtered.map(subscription => subscription.id), ['new-a']);
  const result = calculateSubscriptionStats([{ id: 's1' }, { id: 's2' }], subscriptions, 'B', 'A', 100);
  assert.equal(result.totalExpected, 200);
  assert.equal(result.totalCollected, 50);
  assert.equal(result.totalRemaining, 150);
});
