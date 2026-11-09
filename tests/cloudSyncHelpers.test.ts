import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeArrayByKey,
  mergeDeletedEntities,
  sanitizeCloudState,
  deduplicateAtqiniSubmissions,
  deduplicateChallengeSubmissions
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

test('cloud merge respects submittedAt and updatedAt timestamps on homework submissions', () => {
  const result = mergeArrayByKey(
    [
      { id: 'atqs-1', isCompletedCorrectly: true, submittedAt: '2026-01-01T00:00:00.000Z' }
    ],
    [
      { id: 'atqs-1', isCompletedCorrectly: false, updatedAt: '2026-01-02T12:00:00.000Z' }
    ],
    'id'
  );

  assert.equal(result[0].isCompletedCorrectly, false);
});

test('deduplicateAtqiniSubmissions merges duplicates for the same student and assignment into one newest record', () => {
  const duplicates = [
    { id: 'atqs-1', assignmentId: 'atq-1', studentId: 's-1', isCompletedCorrectly: true, submittedAt: '2026-01-01T00:00:00.000Z' },
    { id: 'atqs_atq-1_s-1', assignmentId: 'atq-1', studentId: 's-1', isCompletedCorrectly: false, updatedAt: '2026-01-02T12:00:00.000Z' },
    { id: 'atqs-2', assignmentId: 'atq-1', studentId: 's-2', isCompletedCorrectly: true, submittedAt: '2026-01-01T00:00:00.000Z' }
  ];

  const deduplicated = deduplicateAtqiniSubmissions(duplicates);
  assert.equal(deduplicated.length, 2);
  const s1 = deduplicated.find(d => d.studentId === 's-1');
  assert.equal(s1?.isCompletedCorrectly, false);
  assert.equal(s1?.id, 'atqs-1');
});

test('deduplicateChallengeSubmissions merges duplicates for the same student and challenge preserving newest points', () => {
  const duplicates = [
    { id: 'cs-1', challengeId: 'ch-1', studentId: 's-1', earlyPrepPointsEarned: 0, totalPointsEarned: 8, evaluatedAt: '2026-01-01T00:00:00.000Z' },
    { id: 'cs_ch-1_s-1', challengeId: 'ch-1', studentId: 's-1', earlyPrepPointsEarned: 2, totalPointsEarned: 10, updatedAt: '2026-01-02T12:00:00.000Z' }
  ];

  const deduplicated = deduplicateChallengeSubmissions(duplicates);
  assert.equal(deduplicated.length, 1);
  assert.equal(deduplicated[0].earlyPrepPointsEarned, 2);
  assert.equal(deduplicated[0].totalPointsEarned, 10);
  assert.equal(deduplicated[0].id, 'cs-1');
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

test('legacy leader passcodes are removed from settings while user records remain intact', () => {
  const source = {
    users: [{ id: 'u1', passcode: 'secret', name: 'A' }],
    currentUser: { id: 'u1', passcode: 'secret' },
    settings: { leaderPasscode: 'secret', currency: 'SAR' }
  };
  const sanitized = sanitizeCloudState(source);

  assert.deepEqual(sanitized.users, [{ id: 'u1', passcode: 'secret', name: 'A' }]);
  assert.deepEqual(sanitized.currentUser, { id: 'u1', passcode: 'secret' });
  assert.deepEqual(sanitized.settings, { currency: 'SAR' });
  assert.equal(source.users[0].passcode, 'secret');
});
