import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeArrayByKey,
  mergeDeletedEntities,
  sanitizeCloudState,
  deduplicateAtqiniSubmissions,
  deduplicateChallengeSubmissions,
  getDailyRecordShardId,
  getAttendanceRecordShardId,
  assembleShardedCloudState,
  pruneDeadStaffProfiles
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

test('shard routing is deterministic per student and assembleShardedCloudState merges shard + legacy data cleanly', () => {
  const shardA = getDailyRecordShardId({ id: 'dr_1', studentId: 's-42', date: '2026-11-01' });
  const shardB = getDailyRecordShardId({ id: 'dr_2', studentId: 's-42', date: '2026-11-02' });
  assert.equal(shardA, shardB);
  assert.match(shardA, /^shard_daily_[0-3]$/);

  const attShard = getAttendanceRecordShardId({ id: 'att_1', studentId: 's-42', date: '2026-11-01' });
  assert.match(attShard, /^shard_attendance_[0-1]$/);

  const assembled = assembleShardedCloudState(
    {
      users: [{ id: 'u-1', name: 'Teacher' }],
      dailyRecords: [{ id: 'dr_1', studentId: 's-1', date: '2026-11-01', actualNewPages: 1, updatedAt: '2026-11-01T10:00:00.000Z' }],
      _deletedEntities: { dailyRecords: ['dr_deleted'] }
    },
    {
      shard_daily_0: {
        items: [
          { id: 'dr_1', studentId: 's-1', date: '2026-11-01', actualNewPages: 2, updatedAt: '2026-11-02T10:00:00.000Z' },
          { id: 'dr_deleted', studentId: 's-2', date: '2026-11-01', actualNewPages: 1 }
        ]
      },
      shard_attendance_0: {
        items: [{ id: 'att_1', studentId: 's-1', date: '2026-11-01', status: 'present' }]
      },
      shard_submissions: {
        studentAtqiniSubmissions: [{ id: 'atqs_1', assignmentId: 'a1', studentId: 's-1' }],
        studentChallengeSubmissions: [{ id: 'cs_1', challengeId: 'c1', studentId: 's-1' }]
      },
      shard_subscriptions_logs: {
        studentSubscriptions: [{ id: 'sub_1', studentId: 's-1', paidAmount: 100 }],
        auditLogs: [
          { id: 'log_old', timestamp: '2026-11-01T00:00:00.000Z' },
          { id: 'log_new', timestamp: '2026-11-05T00:00:00.000Z' }
        ]
      }
    }
  );

  assert.ok(assembled);
  assert.equal(assembled.dailyRecords.length, 1);
  assert.equal(assembled.dailyRecords[0].actualNewPages, 2);
  assert.equal(assembled.attendanceRecords.length, 1);
  assert.equal(assembled.studentAtqiniSubmissions.length, 1);
  assert.equal(assembled.studentChallengeSubmissions.length, 1);
  assert.equal(assembled.studentSubscriptions.length, 1);
  assert.equal(assembled.auditLogs[0].id, 'log_new');
});

test('pruneDeadStaffProfiles retains only active non-deleted users', () => {
  const pruned = pruneDeadStaffProfiles(
    {
      'u-active': { workingHours: '4-6' },
      'u-deleted': { workingHours: '1-2' },
      'u-ghost': { workingHours: '2-3' }
    },
    [{ id: 'u-active' }],
    ['u-deleted']
  );
  assert.deepEqual(pruned, { 'u-active': { workingHours: '4-6' } });
});

