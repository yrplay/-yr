import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeArrayByKey,
  mergeDeletedEntities,
  sanitizeCloudState
} from '../src/services/cloudSyncHelpers';

test('cloud merge uses newer records and tombstones prevent deleted records returning', () => {
  const result = mergeArrayByKey(
    [
      { id: 'student-1', name: 'Old', updatedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'student-2', name: 'Deleted', updatedAt: '2026-01-02T00:00:00.000Z' },
      { id: 'student-3', name: 'Keep' }
    ],
    [
      { id: 'student-1', name: 'New', updatedAt: '2026-01-03T00:00:00.000Z' },
      { id: 'student-2', name: 'Stale client copy' }
    ],
    'id',
    ['student-2']
  );

  assert.deepEqual(result, [
    { id: 'student-1', name: 'New', updatedAt: '2026-01-03T00:00:00.000Z' },
    { id: 'student-3', name: 'Keep' }
  ]);
});

test('deletion tombstones merge uniquely across clients', () => {
  assert.deepEqual(
    mergeDeletedEntities(
      { students: ['s1', 's2'], exams: ['e1'] },
      { students: ['s2', 's3'], exams: ['e2'] }
    ),
    { students: ['s1', 's2', 's3'], exams: ['e1', 'e2'] }
  );
});

test('legacy passcodes are removed from cached and cloud state', () => {
  const source = {
    users: [{ id: 'u1', passcode: 'secret', name: 'A' }],
    currentUser: { id: 'u1', passcode: 'secret' },
    settings: { leaderPasscode: 'secret', currency: 'SAR' }
  };
  const sanitized = sanitizeCloudState(source);

  assert.deepEqual(sanitized.users, [{ id: 'u1', name: 'A' }]);
  assert.deepEqual(sanitized.currentUser, { id: 'u1' });
  assert.deepEqual(sanitized.settings, { currency: 'SAR' });
  assert.equal(source.users[0].passcode, 'secret');
});
