import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_SHARD_DOC_IDS,
  ATTENDANCE_SHARD_DOC_IDS,
  DAILY_SHARD_DOC_IDS,
  DebouncedPersistCoordinator,
  FIRESTORE_HARD_BYTE_LIMIT,
  SHARD_SAFE_BYTE_LIMIT,
  SHARD_SUBMISSIONS_DOC_ID,
  SHARD_SUBSCRIPTIONS_LOGS_DOC_ID,
  FirestoreDocumentSizeLimitError,
  PendingQueuePersistenceError,
  PendingSyncQueueManager,
  ShardSubscriptionCoordinator,
  StaleCacheWriteError,
  StaleReplaceStateError,
  assembleShardedCloudState,
  assertServerReadForWrite,
  createOperationId,
  deduplicateAttendanceRecords,
  deduplicateAtqiniSubmissions,
  deduplicateChallengeSubmissions,
  deduplicateDailyRecords,
  estimateFirestoreDocSizeBytes,
  executeBoundedShardSync,
  executeOptimisticDocMerge,
  executeSafeLegacyShardMigration,
  getAttendanceRecordShardId,
  getDailyRecordShardId,
  mergeArrayByKey,
  partitionItemsIntoBoundedShards,
  pruneDeadStaffProfiles,
  sanitizeStaffUserForFirestore,
  validateDocumentSizeWithinLimit,
  validateReplaceStateFreshness,
  verifyCollectionContentParity
} from '../src/services/cloudSyncHelpers';
import {
  ImageStorageError,
  MAX_FIRESTORE_INLINE_IMAGE_BYTES,
  MAX_RAW_IMAGE_BYTES,
  estimateDataUrlByteSize,
  getCachedAssetUrl,
  isQuotaExceededError,
  persistAssetLocallyWithQuotaRecovery,
  uploadImageDataUrlWithMeta,
  validateImageDataUrlBeforeProcessing
} from '../src/services/storage';
import {
  HijriConversionError,
  HIJRI_MAX_YEAR,
  HIJRI_MIN_YEAR,
  formatHijriDate,
  getHijriMonthLength,
  getHijriParts,
  getHijriYearTotalDays,
  isHijriLeapYear,
  parseDateInput,
  parseHijriJoinDate,
  resolveHijriToGregorianStrict,
  shiftHijriDay,
  tryResolveHijriToGregorian,
  validateHijriDateParts
} from '../src/utils/hijriDate';
import { summarizeDailyPageProgress } from '../src/services/recitationProgress';

// Helper for in-memory Storage mock
function createMockStorage(quotaLimitEntries = 1000) {
  const store = new Map<string, string>();
  let failNextWithQuota = false;
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      if (failNextWithQuota || (!store.has(key) && store.size >= quotaLimitEntries)) {
        failNextWithQuota = false;
        const err = new Error('QuotaExceededError: The quota has been exceeded.');
        err.name = 'QuotaExceededError';
        throw err;
      }
      store.set(key, value);
    },
    _triggerNextQuotaError() {
      failNextWithQuota = true;
    }
  };
}

describe('1. Sync & Concurrency Tests (Distributed Multi-Device & Optimistic Concurrency)', () => {
  it('merges concurrent edits to the same record across two devices deterministically by timestamp', () => {
    const serverItems = [
      {
        id: 'att_s1_2026-03-10',
        studentId: 's1',
        date: '2026-03-10',
        status: 'present',
        updatedAt: '2026-03-10T08:00:00.000Z'
      }
    ];

    const deviceARecord = {
      id: 'att_s1_2026-03-10',
      studentId: 's1',
      date: '2026-03-10',
      status: 'late',
      updatedAt: '2026-03-10T08:05:00.000Z'
    };
    const deviceBRecord = {
      id: 'att_s1_2026-03-10',
      studentId: 's1',
      date: '2026-03-10',
      status: 'absent_excused',
      excuseReason: 'موعد طبي',
      updatedAt: '2026-03-10T08:10:00.000Z'
    };

    const mergedAfterA = deduplicateAttendanceRecords([...serverItems, deviceARecord]);
    const mergedAfterBoth = deduplicateAttendanceRecords([...mergedAfterA, deviceBRecord]);

    assert.equal(mergedAfterBoth.length, 1);
    assert.equal(mergedAfterBoth[0].status, 'absent_excused');
    assert.equal(mergedAfterBoth[0].excuseReason, 'موعد طبي');
  });

  it('preserves all records when two devices add different records concurrently to the same shard', async () => {
    let simulatedFirestoreDoc: Record<string, any> | null = {
      shardIndex: 0,
      _revision: 1,
      items: [
        { id: 'dr_s0_2026-03-01', studentId: 's0', date: '2026-03-01', score: 10, updatedAt: '2026-03-01T10:00:00Z' }
      ]
    };

    const adapter = {
      readFromServer: async () => ({
        exists: simulatedFirestoreDoc !== null,
        data: simulatedFirestoreDoc ? structuredClone(simulatedFirestoreDoc) : null,
        fromServer: true
      }),
      writeIfRevisionMatches: async (
        _docId: string,
        expectedRevision: number | null,
        nextData: Record<string, any>
      ) => {
        const currentRev = simulatedFirestoreDoc?._revision ?? null;
        if (currentRev !== expectedRevision) {
          return { committed: false, conflict: true };
        }
        simulatedFirestoreDoc = structuredClone(nextData);
        return { committed: true };
      }
    };

    // Device 1 writes student s1
    const res1 = await executeOptimisticDocMerge({
      docId: 'shard_daily_0',
      opId: 'op_device_1',
      adapter,
      buildNextDoc: existing => ({
        nextDoc: {
          shardIndex: 0,
          items: deduplicateDailyRecords([
            ...(existing?.items || []),
            { id: 'dr_s1_2026-03-02', studentId: 's1', date: '2026-03-02', score: 9.5, updatedAt: '2026-03-02T10:00:00Z' }
          ])
        }
      })
    });

    // Device 2 writes student s2
    const res2 = await executeOptimisticDocMerge({
      docId: 'shard_daily_0',
      opId: 'op_device_2',
      adapter,
      buildNextDoc: existing => ({
        nextDoc: {
          shardIndex: 0,
          items: deduplicateDailyRecords([
            ...(existing?.items || []),
            { id: 'dr_s2_2026-03-02', studentId: 's2', date: '2026-03-02', score: 10, updatedAt: '2026-03-02T10:01:00Z' }
          ])
        }
      })
    });

    assert.equal(res1.committed, true);
    assert.equal(res2.committed, true);
    assert.equal(simulatedFirestoreDoc?._revision, 3);
    assert.deepEqual(
      simulatedFirestoreDoc?.items.map((r: any) => r.studentId).sort(),
      ['s0', 's1', 's2']
    );
  });

  it('automatically retries on optimistic concurrency revision conflict and merges without losing concurrent writes', async () => {
    let simulatedServerDoc: Record<string, any> = {
      _revision: 5,
      items: [{ id: 'a1', studentId: 's1', date: '2026-03-01', status: 'present', updatedAt: '2026-03-01T08:00:00Z' }]
    };

    let readCallCount = 0;
    let conflictInjected = false;

    const adapter = {
      readFromServer: async () => {
        readCallCount++;
        return {
          exists: true,
          data: structuredClone(simulatedServerDoc),
          fromServer: true
        };
      },
      writeIfRevisionMatches: async (
        _docId: string,
        expectedRevision: number | null,
        nextData: Record<string, any>
      ) => {
        if (!conflictInjected) {
          conflictInjected = true;
          simulatedServerDoc = {
            _revision: 6,
            items: [
              ...simulatedServerDoc.items,
              { id: 'a2', studentId: 's2', date: '2026-03-01', status: 'present', updatedAt: '2026-03-01T08:01:00Z' }
            ]
          };
        }
        if (simulatedServerDoc._revision !== expectedRevision) {
          return { committed: false, conflict: true };
        }
        simulatedServerDoc = structuredClone(nextData);
        return { committed: true };
      }
    };

    const result = await executeOptimisticDocMerge({
      docId: 'shard_attendance_0',
      opId: 'op_retry_test',
      maxAttempts: 4,
      adapter,
      buildNextDoc: existing => ({
        nextDoc: {
          items: deduplicateAttendanceRecords([
            ...(existing?.items || []),
            { id: 'a3', studentId: 's3', date: '2026-03-01', status: 'late', updatedAt: '2026-03-01T08:02:00Z' }
          ])
        }
      })
    });

    assert.equal(result.committed, true);
    assert.equal(result.attempts, 2);
    assert.equal(readCallCount, 2);
    assert.equal(simulatedServerDoc._revision, 7);
    assert.deepEqual(
      simulatedServerDoc.items.map((x: any) => x.studentId).sort(),
      ['s1', 's2', 's3']
    );
  });

  it('rejects writing over server documents when the read came from local cache (StaleCacheWriteError)', async () => {
    assert.throws(
      () =>
        assertServerReadForWrite('master_state', {
          exists: true,
          data: { _revision: 1 },
          fromServer: false
        }),
      StaleCacheWriteError
    );

    await assert.rejects(
      () =>
        executeOptimisticDocMerge({
          docId: 'master_state',
          opId: 'op_stale_cache',
          adapter: {
            readFromServer: async () => ({
              exists: true,
              data: { _revision: 1, users: [] },
              fromServer: false
            }),
            writeIfRevisionMatches: async () => ({ committed: true })
          },
          buildNextDoc: existing => ({ nextDoc: existing || {} })
        }),
      StaleCacheWriteError
    );
  });

  it('prevents duplicate record creation or double revision increment when retrying an operation with the same opId', async () => {
    let serverDoc: Record<string, any> = {
      _revision: 1,
      lastOpId: 'op_initial',
      recentOpIds: ['op_initial'],
      count: 1
    };

    const adapter = {
      readFromServer: async () => ({
        exists: true,
        data: structuredClone(serverDoc),
        fromServer: true
      }),
      writeIfRevisionMatches: async (
        _docId: string,
        expectedRevision: number | null,
        nextData: Record<string, any>
      ) => {
        if (serverDoc._revision !== expectedRevision) {
          return { committed: false, conflict: true };
        }
        serverDoc = structuredClone(nextData);
        return { committed: true };
      }
    };

    const firstAttempt = await executeOptimisticDocMerge({
      docId: 'shard_submissions',
      opId: 'op_unique_123',
      adapter,
      buildNextDoc: existing => ({
        nextDoc: {
          count: (existing?.count || 0) + 1
        }
      })
    });

    // Replay the exact same opId (e.g. client retry after ACK timeout)
    const replayAttempt = await executeOptimisticDocMerge({
      docId: 'shard_submissions',
      opId: 'op_unique_123',
      adapter,
      buildNextDoc: existing => ({
        nextDoc: {
          count: (existing?.count || 0) + 1
        }
      })
    });

    assert.equal(firstAttempt.committed, true);
    assert.equal(firstAttempt.skippedAsDuplicateOp, false);
    assert.equal(replayAttempt.committed, true);
    assert.equal(replayAttempt.skippedAsDuplicateOp, true);
    assert.equal(serverDoc.count, 2); // Incremented only once!
    assert.equal(serverDoc._revision, 2);
  });

  it('queues operations offline in PendingSyncQueueManager and flushes them in causal order on reconnect', async () => {
    const queue = new PendingSyncQueueManager('test_pending_queue_v1', {
      primaryStorage: createMockStorage()
    });
    queue.clear();

    queue.enqueue({
      opId: 'op_offline_1',
      createdAt: '2026-03-10T09:00:00.000Z',
      changedKeys: ['users', 'circles'],
      payload: { users: [{ id: 'u1', name: 'أ. سارة' }] }
    });

    queue.enqueue({
      opId: 'op_offline_2',
      createdAt: '2026-03-10T09:01:00.000Z',
      changedKeys: ['attendanceRecords'],
      payload: { attendanceRecords: [{ id: 'att_1', studentId: 's1', date: '2026-03-10' }] }
    });

    // Re-enqueuing the same opId is idempotent and does not duplicate
    queue.enqueue({
      opId: 'op_offline_2',
      createdAt: '2026-03-10T09:01:30.000Z',
      changedKeys: ['attendanceRecords'],
      payload: { attendanceRecords: [{ id: 'att_1', studentId: 's1', date: '2026-03-10', status: 'present' }] }
    });

    assert.equal(queue.size(), 2);

    const executedOrder: string[] = [];
    const flushResult = await queue.flush(async op => {
      executedOrder.push(op.opId);
    });

    assert.equal(flushResult.flushedCount, 2);
    assert.equal(flushResult.remainingCount, 0);
    assert.deepEqual(executedOrder, ['op_offline_1', 'op_offline_2']);
    assert.equal(queue.size(), 0);
  });
});

describe('2. Sharding & Subscription Coordinator Tests', () => {
  it('blocks partial state emission until master_state and all 8 shard documents have loaded', () => {
    const coordinator = new ShardSubscriptionCoordinator();
    assert.equal(coordinator.isAllRequiredLoaded(), false);
    assert.equal(coordinator.computeStatus(), 'syncing');

    // Mark master_state and 7 shards loaded (leaving shard_subscriptions_logs pending)
    coordinator.recordSnapshot('master_state', {
      exists: true,
      data: { users: [{ id: 'u1' }] },
      fromCache: false,
      hasPendingWrites: false
    });

    for (let i = 0; i < ALL_SHARD_DOC_IDS.length - 1; i++) {
      coordinator.recordSnapshot(ALL_SHARD_DOC_IDS[i], {
        exists: true,
        data: { items: [] },
        fromCache: false,
        hasPendingWrites: false
      });
    }

    // Still 1 delayed shard -> must NOT emit partial data
    assert.equal(coordinator.isAllRequiredLoaded(), false);
    assert.equal(coordinator.computeStatus(), 'syncing');
    assert.equal(coordinator.assembleIfComplete().complete, false);

    // Now the final delayed shard arrives
    const lastShardId = ALL_SHARD_DOC_IDS[ALL_SHARD_DOC_IDS.length - 1];
    coordinator.recordSnapshot(lastShardId, {
      exists: true,
      data: { studentSubscriptions: [], auditLogs: [] },
      fromCache: false,
      hasPendingWrites: false
    });

    assert.equal(coordinator.isAllRequiredLoaded(), true);
    assert.equal(coordinator.computeStatus(), 'connected');
    assert.equal(coordinator.assembleIfComplete().complete, true);
  });

  it('surfaces listener failure on any shard and blocks corrupt state emission', () => {
    const coordinator = new ShardSubscriptionCoordinator();
    coordinator.recordSnapshot('master_state', {
      exists: true,
      data: { users: [] },
      fromCache: false,
      hasPendingWrites: false
    });
    for (const shardId of ALL_SHARD_DOC_IDS) {
      coordinator.recordSnapshot(shardId, {
        exists: true,
        data: { items: [] },
        fromCache: false,
        hasPendingWrites: false
      });
    }
    assert.equal(coordinator.isAllRequiredLoaded(), true);

    // Simulate listener failure on shard_daily_2
    coordinator.recordError('shard_daily_2', 'permission-denied');
    assert.equal(coordinator.hasAnyError(), true);
    assert.equal(coordinator.isAllRequiredLoaded(), false);
    assert.equal(coordinator.computeStatus(), 'error');
    assert.deepEqual(coordinator.getFailedDocIds(), ['shard_daily_2']);
  });

  it('distinguishes pending writes and cache-only snapshots from server-confirmed snapshots', () => {
    const coordinator = new ShardSubscriptionCoordinator();
    coordinator.recordSnapshot('master_state', {
      exists: true,
      data: { users: [] },
      fromCache: true,
      hasPendingWrites: true
    });
    for (const shardId of ALL_SHARD_DOC_IDS) {
      coordinator.recordSnapshot(shardId, {
        exists: true,
        data: { items: [] },
        fromCache: false,
        hasPendingWrites: false
      });
    }

    assert.equal(coordinator.isAllRequiredLoaded(), true);
    assert.equal(coordinator.computeStatus(), 'syncing');
    assert.equal(coordinator.computeStatus({ pendingQueueCount: 2 }), 'pending');
    assert.equal(coordinator.computeStatus({ isOnline: false }), 'offline');
  });

  it('enforces monotonic emission sequence numbers to discard out-of-order async updates', () => {
    const coordinator = new ShardSubscriptionCoordinator();
    const seq1 = coordinator.nextEmitSequence();
    const seq2 = coordinator.nextEmitSequence();
    assert.equal(seq2 > seq1, true);
    assert.equal(coordinator.getCurrentEmitSequence(), seq2);
  });

  it('enforces Firestore document size limits and partitions large item lists into bounded shards', () => {
    const smallDoc = { id: 'doc1', items: [{ id: '1', name: 'طالبة' }] };
    const sizeCheck = validateDocumentSizeWithinLimit('doc1', smallDoc);
    assert.equal(sizeCheck.ok, true);
    assert.equal(sizeCheck.byteSize < SHARD_SAFE_BYTE_LIMIT, true);

    // Create an oversized document exceeding FIRESTORE_HARD_BYTE_LIMIT
    const hugeDoc = {
      id: 'oversized_doc',
      blob: 'أ'.repeat(600_000) // > 1.2 MB in UTF-8
    };
    assert.equal(estimateFirestoreDocSizeBytes(hugeDoc) > FIRESTORE_HARD_BYTE_LIMIT, true);
    assert.throws(
      () => validateDocumentSizeWithinLimit('oversized_doc', hugeDoc),
      FirestoreDocumentSizeLimitError
    );

    // Partition items into bounded shards with a strict per-shard byte ceiling
    const items = Array.from({ length: 50 }, (_, i) => ({
      id: `item_${i}`,
      notes: 'سجل تسميع ومراجعة '.repeat(30)
    }));
    const boundedShards = partitionItemsIntoBoundedShards('shard_daily_0', items, 5_000);
    assert.equal(boundedShards.length > 1, true);
    const totalPartitionedItems = boundedShards.reduce((acc, s) => acc + s.items.length, 0);
    assert.equal(totalPartitionedItems, 50);
    for (const shard of boundedShards) {
      assert.equal(shard.byteSize <= 5_000, true);
    }
  });
});

describe('3. Data Integrity & Sandboxed Migration Tests', () => {
  it('maintains 100% record parity across sharding and reassembly for attendance, daily records, submissions, and subscriptions', () => {
    const dailyRecords = [
      { id: 'dr-1', studentId: 'stu-1', date: '2026-03-01', newMemorizationScore: 10, updatedAt: '2026-03-01T10:00:00Z' },
      { id: 'dr-2', studentId: 'stu-2', date: '2026-03-02', newMemorizationScore: 9.5, updatedAt: '2026-03-02T10:00:00Z' }
    ];
    const attendanceRecords = [
      { id: 'att-1', studentId: 'stu-1', date: '2026-03-01', status: 'present', updatedAt: '2026-03-01T09:00:00Z' },
      { id: 'att-2', studentId: 'stu-2', date: '2026-03-01', status: 'late', updatedAt: '2026-03-01T09:05:00Z' }
    ];

    const shardsById: Record<string, Record<string, any>> = {};
    for (const shardId of DAILY_SHARD_DOC_IDS) {
      shardsById[shardId] = {
        items: dailyRecords.filter(r => getDailyRecordShardId(r) === shardId)
      };
    }
    for (const shardId of ATTENDANCE_SHARD_DOC_IDS) {
      shardsById[shardId] = {
        items: attendanceRecords.filter(r => getAttendanceRecordShardId(r) === shardId)
      };
    }
    shardsById[SHARD_SUBMISSIONS_DOC_ID] = {
      studentAtqiniSubmissions: [
        { id: 'atq-1', studentId: 'stu-1', assignmentId: 'a-1', hijriDate: '1447-09-01', score: 10, updatedAt: '2026-03-01T11:00:00Z' }
      ],
      studentChallengeSubmissions: [
        { id: 'ch-1', studentId: 'stu-2', challengeId: 'c-1', totalPointsEarned: 10, updatedAt: '2026-03-01T12:00:00Z' }
      ]
    };
    shardsById[SHARD_SUBSCRIPTIONS_LOGS_DOC_ID] = {
      studentSubscriptions: [
        { id: 'sub-1', studentId: 'stu-1', cycleMonth: '1447-09', status: 'active', updatedAt: '2026-03-01T15:00:00Z' }
      ],
      auditLogs: [
        { id: 'log-1', action: 'create', details: 'إضافة طالبة', timestamp: '2026-03-01T15:00:00Z' }
      ]
    };

    const masterCore = {
      users: [{ id: 'u-1', name: 'أ. عائشة', role: 'teacher' }],
      students: [
        { id: 'stu-1', name: 'فاطمة', trackId: 't-1', circleId: 'c-1' },
        { id: 'stu-2', name: 'مريم', trackId: 't-1', circleId: 'c-1' }
      ]
    };

    const assembled = assembleShardedCloudState(masterCore, shardsById)!;
    assert.equal(assembled.dailyRecords.length, 2);
    assert.equal(assembled.attendanceRecords.length, 2);
    assert.equal(assembled.studentAtqiniSubmissions.length, 1);
    assert.equal(assembled.studentChallengeSubmissions.length, 1);
    assert.equal(assembled.studentSubscriptions.length, 1);
    assert.equal(assembled.auditLogs.length, 1);
  });

  it('executes sandboxed legacy-to-shard migration with parity verification, idempotency, checkpoint resume, and atomic rollback on failure', async () => {
    const sandboxStore = new Map<string, Record<string, any>>();
    sandboxStore.set('master_state', {
      users: [{ id: 'u1', name: 'أ. نورة', role: 'teacher' }],
      students: [{ id: 's1', name: 'طالبة ١' }, { id: 's2', name: 'طالبة ٢' }],
      dailyRecords: [
        { id: 'dr1', studentId: 's1', date: '2026-03-01', newMemorizationScore: 10, updatedAt: '2026-03-01T10:00:00Z' },
        { id: 'dr2', studentId: 's2', date: '2026-03-02', newMemorizationScore: 9, updatedAt: '2026-03-02T10:00:00Z' }
      ],
      attendanceRecords: [
        { id: 'att1', studentId: 's1', date: '2026-03-01', status: 'present', updatedAt: '2026-03-01T08:00:00Z' }
      ],
      studentAtqiniSubmissions: [
        { id: 'atq1', studentId: 's1', assignmentId: 'a1', hijriDate: '1447-09-01', score: 10 }
      ],
      studentChallengeSubmissions: [],
      studentSubscriptions: [
        { id: 'sub1', studentId: 's1', cycleMonth: '1447-09', status: 'active' }
      ],
      auditLogs: [{ id: 'log1', details: 'اختبار', timestamp: '2026-03-01T08:00:00Z' }]
    });

    const migrationWriteOrder: string[] = [];
    const adapter = {
      readAllDocs: async () => {
        const docs: Record<string, Record<string, any> | null> = {};
        for (const [k, v] of sandboxStore.entries()) {
          docs[k] = structuredClone(v);
        }
        return { completeRead: true, docs };
      },
      writeDoc: async (docId: string, payload: Record<string, any>) => {
        migrationWriteOrder.push(docId);
        sandboxStore.set(docId, structuredClone(payload));
      }
    };

    // 1. Simulate interruption after 3 shards, then resume from checkpoint
    const partialRun = await executeSafeLegacyShardMigration({
      adapter,
      simulateInterruptAfterShardCount: 3,
      maxBytesPerShard: 1
    });
    assert.equal(partialRun.report.status, 'partial_paused');
    assert.equal(partialRun.checkpoint.completedShards.length, 3);
    // The migration writes its unique overflow document before publishing the base pointer.
    assert.equal(migrationWriteOrder[0].startsWith('shard_daily_0_overflow_mig_'), true);
    assert.equal(migrationWriteOrder[1], 'shard_daily_0');
    assert.equal(
      sandboxStore.get('shard_daily_0')?.overflowShardIds?.every((id: string) => sandboxStore.has(id)),
      true
    );
    // Legacy source is still retained on master_state while paused
    assert.equal(Array.isArray(sandboxStore.get('master_state')?.dailyRecords), true);

    // 2. Resume from checkpoint and clean legacy fields after verification
    const resumedRun = await executeSafeLegacyShardMigration({
      adapter,
      checkpoint: partialRun.checkpoint,
      cleanupLegacyAfterVerification: true,
      maxBytesPerShard: 1
    });

    assert.equal(resumedRun.report.status, 'completed');
    assert.equal(resumedRun.report.rolledBack, false);
    assert.equal(resumedRun.report.legacySourceCleanedAfterVerification, true);
    assert.equal(resumedRun.report.collections.every(c => c.verified), true);
    assert.equal(sandboxStore.get('master_state')?.dailyRecords, undefined);

    // 3. Run migration again (Idempotency check -> zero data loss or duplication)
    const idempotentRun = await executeSafeLegacyShardMigration({
      adapter,
      cleanupLegacyAfterVerification: true
    });
    assert.equal(idempotentRun.report.status, 'completed');
    assert.deepEqual(
      idempotentRun.report.collections.map(c => c.targetCount),
      resumedRun.report.collections.map(c => c.targetCount)
    );

    // 4. Test automatic rollback if a write fails mid-migration
    const failingSandbox = new Map<string, Record<string, any>>();
    const initialMaster = {
      users: [{ id: 'u1', name: 'أ. نورة' }],
      dailyRecords: [{ id: 'dr1', studentId: 's1', date: '2026-03-01', updatedAt: '2026-03-01T10:00:00Z' }],
      attendanceRecords: [{ id: 'att1', studentId: 's1', date: '2026-03-01', updatedAt: '2026-03-01T09:00:00Z' }]
    };
    failingSandbox.set('master_state', structuredClone(initialMaster));

    const rollbackRes = await executeSafeLegacyShardMigration({
      adapter: {
        readAllDocs: async () => {
          const docs: Record<string, Record<string, any> | null> = {};
          for (const [k, v] of failingSandbox.entries()) {
            docs[k] = structuredClone(v);
          }
          return { completeRead: true, docs };
        },
        writeDoc: async (docId, payload) => {
          if (docId === 'shard_submissions') {
            throw new Error('Simulated network write failure during shard_submissions');
          }
          failingSandbox.set(docId, structuredClone(payload));
        }
      }
    });

    assert.equal(rollbackRes.report.status, 'rolled_back');
    assert.equal(rollbackRes.report.rolledBack, true);
    // Verify original master_state is untouched with all legacy records intact
    assert.equal(failingSandbox.get('master_state')?.dailyRecords?.length, 1);
    assert.equal(failingSandbox.get('master_state')?.attendanceRecords?.length, 1);
  });

  it('aborts migration immediately without writing if source read is incomplete', async () => {
    let writeCalled = false;
    const res = await executeSafeLegacyShardMigration({
      adapter: {
        readAllDocs: async () => ({
          completeRead: false,
          docs: {}
        }),
        writeDoc: async () => {
          writeCalled = true;
        }
      }
    });

    assert.equal(res.report.status, 'failed');
    assert.equal(writeCalled, false);
  });
});

describe('4. Image Storage & LocalStorage Quota Recovery Tests', () => {
  const validPngDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  it('validates image format and byte size before processing', () => {
    const res = validateImageDataUrlBeforeProcessing(validPngDataUrl);
    assert.equal(res.isDataUrl, true);
    assert.equal(res.byteSize > 0, true);
    assert.equal(res.byteSize < MAX_FIRESTORE_INLINE_IMAGE_BYTES, true);

    // Reject non-image data URL
    assert.throws(
      () => validateImageDataUrlBeforeProcessing('data:application/pdf;base64,JVBERi0xLjQK'),
      ImageStorageError
    );

    // Reject oversized image exceeding Firestore embedded limit
    const hugeBase64 = 'data:image/png;base64,' + 'A'.repeat(400_000);
    assert.equal(estimateDataUrlByteSize(hugeBase64) > MAX_FIRESTORE_INLINE_IMAGE_BYTES, true);
    assert.throws(
      () => validateImageDataUrlBeforeProcessing(hugeBase64, MAX_FIRESTORE_INLINE_IMAGE_BYTES),
      ImageStorageError
    );
    assert.equal(MAX_RAW_IMAGE_BYTES > MAX_FIRESTORE_INLINE_IMAGE_BYTES, true);
  });

  it('recovers from QuotaExceededError in localStorage by evicting disposable keys and preserving the new asset', () => {
    const mockStorage = createMockStorage();
    mockStorage.setItem('ghaith_pwa_icon_cache_v1', 'data:image/png;base64,OLD');

    // Trigger QuotaExceededError on first setItem attempt
    mockStorage._triggerNextQuotaError();

    assert.equal(
      isQuotaExceededError({ name: 'QuotaExceededError', message: 'Quota exceeded' }),
      true
    );

    const saved = persistAssetLocallyWithQuotaRecovery('institution-logo', validPngDataUrl, mockStorage);
    assert.equal(saved.persisted, true);
    assert.equal(saved.quotaExceeded, false);

    // Disposable key was evicted and new logo was persisted
    assert.equal(mockStorage.getItem('ghaith_pwa_icon_cache_v1'), null);
    assert.equal(getCachedAssetUrl('institution-logo', mockStorage), validPngDataUrl);
  });

  it('handles online cloud upload, cloud upload failure, and offline pending mode in uploadImageDataUrlWithMeta', async () => {
    const mockStorage = createMockStorage();

    // 1. Successful cloud uploader
    const cloudSuccess = await uploadImageDataUrlWithMeta(validPngDataUrl, 'institution-logo', {
      isOnline: true,
      storageObj: mockStorage,
      customUploader: async () => ({ ok: true, url: 'https://cdn.ghaym.org/logo-verified.png' })
    });
    assert.equal(cloudSuccess.cloudVerified, true);
    assert.equal(cloudSuccess.storageMode, 'cloud-storage');
    assert.equal(cloudSuccess.url, 'https://cdn.ghaym.org/logo-verified.png');
    assert.equal(getCachedAssetUrl('institution-logo', mockStorage), 'https://cdn.ghaym.org/logo-verified.png');

    // 2. Offline upload -> queued as offline-pending without false cloudVerified claim
    const offlineUpload = await uploadImageDataUrlWithMeta(validPngDataUrl, 'institution-seal', {
      isOnline: false,
      storageObj: mockStorage
    });
    assert.equal(offlineUpload.cloudVerified, false);
    assert.equal(offlineUpload.storageMode, 'offline-pending');
    assert.equal(offlineUpload.localPersisted, true);

    // 3. Explicit cloud upload failure when requireCloudEndpoint is true
    await assert.rejects(
      () =>
        uploadImageDataUrlWithMeta(validPngDataUrl, 'leader-signature', {
          isOnline: true,
          storageObj: mockStorage,
          requireCloudEndpoint: true,
          customUploader: async () => ({ ok: false })
        }),
      ImageStorageError
    );
  });
});

describe('5. Hijri Date Resolver (Umm al-Qura) Strict Validation & Boundary Tests', () => {
  it('resolves valid Hijri dates strictly to the exact Gregorian date matching Umm al-Qura', () => {
    const resolved = resolveHijriToGregorianStrict(1447, 9, 1); // 1 Ramadan 1447 AH
    const parts = getHijriParts(resolved);
    assert.equal(parts.year, 1447);
    assert.equal(parts.month, 9);
    assert.equal(parts.day, 1);
    assert.equal(parts.monthKey, '1447-09');
  });

  it('correctly determines 29-day vs 30-day months and rejects day 30 in a 29-day Hijri month instead of silently returning an approximate date', () => {
    const lengths = Array.from({ length: 12 }, (_, idx) => ({
      month: idx + 1,
      length: getHijriMonthLength(1447, idx + 1)
    }));

    const month29 = lengths.find(m => m.length === 29);
    const month30 = lengths.find(m => m.length === 30);

    assert.notEqual(month29, undefined);
    assert.notEqual(month30, undefined);

    // Day 30 in a 30-day month must succeed
    const validDay30 = resolveHijriToGregorianStrict(1447, month30!.month, 30);
    assert.equal(getHijriParts(validDay30).day, 30);

    // Day 30 in a 29-day month MUST throw HijriConversionError (no silent approximate fallback!)
    assert.throws(
      () => resolveHijriToGregorianStrict(1447, month29!.month, 30),
      HijriConversionError
    );
    const tryRes = tryResolveHijriToGregorian({ year: 1447, month: month29!.month, day: 30 });
    assert.equal(tryRes.ok, false);
    assert.equal(tryRes.errorCode, 'HIJRI_DAY_30_IN_29_DAY_MONTH');
  });

  it('handles Hijri year boundaries (29/30 Dhu al-Hijjah -> 1 Muharram) and leap years (354 vs 355 days)', () => {
    const lastDayOf1446Len = getHijriMonthLength(1446, 12);
    const endOf1446 = resolveHijriToGregorianStrict(1446, 12, lastDayOf1446Len);
    const startOf1447 = shiftHijriDay(
      `${endOf1446.getFullYear()}-${String(endOf1446.getMonth() + 1).padStart(2, '0')}-${String(endOf1446.getDate()).padStart(2, '0')}`,
      1
    );
    const startParts = getHijriParts(startOf1447);
    assert.equal(startParts.year, 1447);
    assert.equal(startParts.month, 1);
    assert.equal(startParts.day, 1);

    // Check total year days (354 or 355 in Umm al-Qura)
    for (let y = 1444; y <= 1448; y++) {
      const totalDays = getHijriYearTotalDays(y);
      assert.equal(totalDays === 354 || totalDays === 355, true);
      assert.equal(isHijriLeapYear(y), totalDays === 355);
    }
  });

  it('rejects out-of-range Hijri years, months, days, and invalid Gregorian calendar overflow dates', () => {
    assert.equal(validateHijriDateParts(HIJRI_MIN_YEAR - 1, 1, 1).valid, false);
    assert.equal(validateHijriDateParts(HIJRI_MAX_YEAR + 1, 1, 1).valid, false);
    assert.equal(validateHijriDateParts(1447, 0, 1).valid, false);
    assert.equal(validateHijriDateParts(1447, 13, 1).valid, false);
    assert.equal(validateHijriDateParts(1447, 1, 0).valid, false);
    assert.equal(validateHijriDateParts(1447, 1, 31).valid, false);

    assert.throws(() => resolveHijriToGregorianStrict(HIJRI_MIN_YEAR - 1, 1, 1), HijriConversionError);
    assert.throws(() => resolveHijriToGregorianStrict(HIJRI_MAX_YEAR + 1, 1, 1), HijriConversionError);
    assert.throws(() => resolveHijriToGregorianStrict(1447, 13, 1), HijriConversionError);

    // Invalid Gregorian overflow date like 2026-02-30 must return null (rejected)
    assert.equal(parseDateInput('2026-02-30'), null);
  });

  it('produces deterministic, repeatable results across repeated calls and day shifts', () => {
    const iso = '2026-03-15';
    const firstFormat = formatHijriDate(iso, { includeWeekday: true });
    for (let i = 0; i < 10; i++) {
      assert.equal(formatHijriDate(iso, { includeWeekday: true }), firstFormat);
    }

    const nextDayIso = shiftHijriDay(iso, 1);
    const prevDayIso = shiftHijriDay(nextDayIso, -1);
    assert.equal(prevDayIso, iso);
  });
});

describe('6. Core Domain & Recitation Progress Regression Tests', () => {
  it('locks new memorization at target and does not pollute minor or tamkeen review when consolidation mode is active', () => {
    const summary = summarizeDailyPageProgress([
      {
        id: 'dr-1',
        studentId: 'stu-1',
        circleId: 'c-1',
        date: '2026-03-01',
        status: 'completed',
        newMemorizationPages: 5,
        minorRevisionPortion: { surahOrJuz: 'البقرة', from: '1', to: '2', pagesCount: 2 },
        tamkeenRevisionPortion: { surahOrJuz: 'آل عمران', from: '1', to: '3', pagesCount: 3 }
      } as any,
      {
        id: 'dr-2',
        studentId: 'stu-1',
        circleId: 'c-1',
        date: '2026-03-02',
        status: 'completed',
        newMemorizationPages: 4,
        minorRevisionPortion: { surahOrJuz: 'البقرة', from: '3', to: '4', pagesCount: 2 },
        tamkeenRevisionPortion: { surahOrJuz: 'آل عمران', from: '4', to: '6', pagesCount: 3 }
      } as any,
      {
        id: 'dr-3',
        studentId: 'stu-1',
        circleId: 'c-1',
        date: '2026-03-03',
        status: 'completed',
        postPlanCompletionMode: 'consolidation',
        newMemorizationPages: 0,
        minorRevisionPortion: { surahOrJuz: 'البقرة', from: '5', to: '6', pagesCount: 2 },
        tamkeenRevisionPortion: { surahOrJuz: 'آل عمران', from: '7', to: '9', pagesCount: 3 }
      } as any
    ]);

    assert.equal(summary.newMemorizationPagesDone, 9);
    assert.equal(summary.minorRevisionPagesDone, 6);
    assert.equal(summary.tamkeenRevisionPagesDone, 9);
    assert.equal(summary.revisionPagesDone, 15);
    assert.equal(summary.unclassifiedRevisionPagesDone, 0);
  });

  it('preserves existing staff and passcodes during cloud merges and prunes deleted staff profiles', () => {
    const existingUsers = [
      { id: 'u1', name: 'أ. هند', role: 'teacher', passcode: '1234', updatedAt: '2026-03-01T08:00:00Z' }
    ];
    const incomingUsers = [
      { id: 'u1', name: 'أ. هند بنت خالد', role: 'teacher', passcode: '', updatedAt: '2026-03-02T08:00:00Z' },
      { id: 'u2', name: 'أ. مريم', role: 'supervisor', passcode: '5678', updatedAt: '2026-03-02T08:00:00Z' }
    ];
    const mergedUsers = mergeArrayByKey(existingUsers, incomingUsers, 'id', []);
    assert.equal(mergedUsers.length, 2);
    assert.equal(mergedUsers.find((u: any) => u.id === 'u1')?.passcode, '1234');

    const pruned = pruneDeadStaffProfiles(
      { u1: { workingHours: '4' }, u_deleted: { workingHours: '4' } },
      mergedUsers,
      ['u_deleted']
    );
    assert.notEqual(pruned.u1, undefined);
    assert.equal(pruned.u_deleted, undefined);

    const sanitized = sanitizeStaffUserForFirestore({
      id: 'u1',
      name: 'أ. هند',
      role: 'teacher'
    });
    assert.equal(sanitized.id, 'u1');
    assert.equal(sanitized.role, 'teacher');
    assert.equal(createOperationId('test').startsWith('test_'), true);
    assert.equal(deduplicateAtqiniSubmissions([{ id: '1', assignmentId: 'a1', studentId: 's1', hijriDate: '1447-09-01' }]).length, 1);
    assert.equal(deduplicateChallengeSubmissions([{ id: '1', challengeId: 'c1', studentId: 's1' }]).length, 1);
  });
});

describe('7. Production Hardening & Edge-Case Verification Suite (9 Required Scenarios)', () => {
  it('Scenario 1: App reload while Offline preserves queued operations via localStorage or IndexedDB fallback', async () => {
    const primaryLocalStorage = createMockStorage(0); // Quota full in localStorage (0 entries allowed)
    const idbBackingMap = new Map<string, string>();
    const asyncIndexedDbFallback = {
      async getItem(key: string) {
        return idbBackingMap.get(key) ?? null;
      },
      async setItem(key: string, value: string) {
        idbBackingMap.set(key, value);
      },
      async removeItem(key: string) {
        idbBackingMap.delete(key);
      }
    };

    // Session 1 (before reload): localStorage fails with QuotaExceededError, automatically falls back to IndexedDB
    const queueBeforeReload = new PendingSyncQueueManager('test_offline_reload_q', {
      primaryStorage: primaryLocalStorage,
      fallbackStorage: asyncIndexedDbFallback
    });

    const queuedEntry = await queueBeforeReload.enqueueDurable({
      opId: 'op_offline_1',
      changedKeys: ['attendanceRecords'],
      payload: {
        attendanceRecords: [{ id: 'att_1', studentId: 'stu_1', date: '2026-03-10', status: 'present' }]
      }
    });
    assert.equal(queuedEntry.storageBackend, 'indexedDB');
    assert.equal(queueBeforeReload.size(), 1);

    // Session 2 (simulate full browser reload while still offline -> fresh PendingSyncQueueManager instance)
    const queueAfterReload = new PendingSyncQueueManager('test_offline_reload_q', {
      primaryStorage: primaryLocalStorage,
      fallbackStorage: asyncIndexedDbFallback
    });
    const hydrated = await queueAfterReload.hydrateFromDurableStorage();
    assert.equal(hydrated.length, 1);
    assert.equal(hydrated[0].opId, 'op_offline_1');
    assert.equal(hydrated[0].payload.attendanceRecords[0].id, 'att_1');
  });

  it('serializes concurrent durable enqueues so the final persisted snapshot retains every operation', async () => {
    let persisted = '';
    let writeCount = 0;
    const delayedIndexedDb = {
      getItem: async () => persisted || null,
      setItem: async (_key: string, value: string) => {
        const currentWrite = ++writeCount;
        // Force the first snapshot to finish after a later call would have started without serialization.
        await new Promise(resolve => setTimeout(resolve, currentWrite === 1 ? 20 : 0));
        persisted = value;
      },
      removeItem: async () => {
        persisted = '';
      }
    };
    const queue = new PendingSyncQueueManager('test_concurrent_durable_enqueue', {
      primaryStorage: null,
      fallbackStorage: delayedIndexedDb
    });

    await Promise.all([
      queue.enqueueDurable({ opId: 'concurrent_1', changedKeys: ['students'], payload: { students: [{ id: 's1' }] } }),
      queue.enqueueDurable({ opId: 'concurrent_2', changedKeys: ['attendanceRecords'], payload: { attendanceRecords: [{ id: 'a1' }] } })
    ]);

    const stored = JSON.parse(persisted) as Array<{ opId: string }>;
    assert.deepEqual(stored.map(item => item.opId), ['concurrent_1', 'concurrent_2']);
    assert.equal(queue.size(), 2);
  });

  it('Scenario 2: Local storage failure rejects fake offline save when both localStorage and IndexedDB fail', async () => {
    const brokenPrimaryStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {}
    };
    const brokenIndexedDbStorage = {
      getItem: async () => null,
      setItem: async () => {
        throw new Error('IDB_DISK_FULL');
      },
      removeItem: async () => {}
    };

    const queue = new PendingSyncQueueManager('test_broken_storage_q', {
      primaryStorage: brokenPrimaryStorage,
      fallbackStorage: brokenIndexedDbStorage
    });

    // Synchronous enqueue must throw PendingQueuePersistenceError and NOT leave item in memoryQueue
    assert.throws(
      () =>
        queue.enqueue({
          opId: 'op_unpersisted_sync',
          changedKeys: ['users'],
          payload: { users: [{ id: 'u1', name: 'معلمة' }] }
        }),
      PendingQueuePersistenceError
    );
    assert.equal(queue.size(), 0);

    // Async enqueueDurable must also throw PendingQueuePersistenceError and roll back memoryQueue
    await assert.rejects(
      () =>
        queue.enqueueDurable({
          opId: 'op_unpersisted_async',
          changedKeys: ['users'],
          payload: { users: [{ id: 'u1', name: 'معلمة' }] }
        }),
      PendingQueuePersistenceError
    );
    assert.equal(queue.size(), 0);
  });

  it('Scenario 3: Two consecutive persistState calls within < 350ms resolve BOTH promises cleanly with zero hanging promises', async () => {
    const coordinator = new DebouncedPersistCoordinator(120); // < 350ms window
    const executedBatches: Array<{ opId: string; changedKeys: string[] }> = [];

    const firstCallPromise = coordinator.schedule({
      opId: 'op_call_1',
      changedKeys: ['users'],
      payload: { users: [{ id: 'u1', name: 'أ. فاطمة' }] },
      executor: async (mergedPayload, opId) => {
        executedBatches.push({ opId, changedKeys: mergedPayload._changedKeys });
        return { cloudSynced: true, queuedOffline: false, opId };
      }
    });

    // Wait 30ms (< 350ms debounce) and trigger second persistState call
    await new Promise(r => setTimeout(r, 30));

    const secondCallPromise = coordinator.schedule({
      opId: 'op_call_2',
      changedKeys: ['circles'],
      payload: {
        users: [{ id: 'u1', name: 'أ. فاطمة' }],
        circles: [{ id: 'c1', name: 'حلقة النور' }]
      },
      executor: async (mergedPayload, opId) => {
        executedBatches.push({ opId, changedKeys: mergedPayload._changedKeys });
        return { cloudSynced: true, queuedOffline: false, opId };
      }
    });

    const [firstResult, secondResult] = await Promise.all([firstCallPromise, secondCallPromise]);

    // Exactly ONE coalesced cloud write ran, and BOTH promises resolved with a clear outcome!
    assert.equal(executedBatches.length, 1);
    assert.deepEqual(executedBatches[0].changedKeys.sort(), ['circles', 'users']);
    assert.equal(firstResult.cloudSynced, true);
    assert.equal(secondResult.cloudSynced, true);
    assert.equal(firstResult.coalescedCount, 2);
    assert.equal(secondResult.coalescedCount, 2);
  });

  it('Scenario 4: Exceeding Shard size limit dynamically creates overflow shards in sync path and reassembles them seamlessly', async () => {
    const firestoreDocs = new Map<string, Record<string, any>>();
    firestoreDocs.set('master_state', {
      _revision: 1,
      users: [{ id: 'u1', name: 'أ. سارة' }]
    });

    // Generate 40 large daily records that exceed a 6 KB bounded shard threshold
    const writeOrder: string[] = [];
    const incomingLargeRecords = Array.from({ length: 40 }, (_, i) => ({
      id: `dr_stu_${i}_2026-03-10`,
      studentId: `stu_${i}`,
      date: '2026-03-10',
      notes: 'تسميع ممتاز مع مراجعة التجويد وأحكام المدود '.repeat(6),
      updatedAt: '2026-03-10T10:00:00.000Z'
    }));

    const syncRes = await executeBoundedShardSync({
      baseShardId: 'shard_daily_0',
      shardType: 'dailyRecords',
      bucket: 0,
      opId: 'op_overflow_test',
      incomingItems: incomingLargeRecords,
      deletedIds: [],
      replaceState: false,
      maxBytesPerShard: 6000, // Force dynamic overflow sharding
      deduplicateAndMerge: (existing, incoming) => deduplicateDailyRecords([...existing, ...incoming]),
      readOverflowDoc: async docId => firestoreDocs.get(docId) ?? null,
      runDocTransaction: async txParams => {
        writeOrder.push(txParams.docId);
        const existing = firestoreDocs.get(txParams.docId) ?? null;
        const prevRev = typeof existing?._revision === 'number' ? existing._revision : 0;
        const built = txParams.buildNext(existing, existing !== null);
        if (!built.skipWrite) {
          const nextRev = prevRev + 1;
          firestoreDocs.set(txParams.docId, { ...built.payload, _revision: nextRev });
          return { committed: true, skipped: false, revision: nextRev };
        }
        return { committed: true, skipped: true, revision: prevRev };
      }
    });

    assert.equal(syncRes.totalCount, 40);
    assert.equal(syncRes.overflowShardIds.length >= 2, true);
    assert.equal(syncRes.overflowShardIds.every(id => firestoreDocs.has(id)), true);
    assert.equal(writeOrder[0].startsWith('shard_daily_0_overflow_'), true);
    assert.equal(writeOrder[writeOrder.length - 1], 'shard_daily_0');

    // Simulate an unreferenced overflow document left by an interrupted prior attempt.
    // Assembly must ignore it because the base pointer never committed it.
    firestoreDocs.set('shard_daily_0_overflow_orphan', {
      shardType: 'dailyRecords_overflow',
      parentShardId: 'shard_daily_0',
      items: [{ id: 'orphan_record', studentId: 'orphan_student', date: '2026-03-10' }]
    });

    // Verify full reassembly follows only the committed base pointer + dynamic overflow shards.
    const allShardsObj: Record<string, Record<string, any> | null> = {};
    for (const [k, v] of firestoreDocs.entries()) {
      if (k !== 'master_state') allShardsObj[k] = v;
    }
    const reassembled = assembleShardedCloudState(firestoreDocs.get('master_state'), allShardsObj);
    assert.equal(reassembled?.dailyRecords.length, 40);
    assert.equal(reassembled?.dailyRecords.some((record: any) => record.id === 'orphan_record'), false);
  });

  it('retries a bounded shard commit after a concurrent base update and preserves both writers data', async () => {
    const firestoreDocs = new Map<string, Record<string, any>>();
    firestoreDocs.set('shard_daily_0', {
      _revision: 1,
      items: [{ id: 'existing_record', studentId: 'existing_student', date: '2026-03-10', notes: 'existing' }],
      overflowShardIds: []
    });

    const incoming = Array.from({ length: 32 }, (_, index) => ({
      id: `incoming_${index}`,
      studentId: `incoming_student_${index}`,
      date: '2026-03-11',
      notes: 'تسميع ومراجعة '.repeat(20),
      updatedAt: '2026-03-11T10:00:00.000Z'
    }));
    const concurrentRecord = {
      id: 'concurrent_device_record',
      studentId: 'concurrent_student',
      date: '2026-03-12',
      notes: 'سجل أضافه جهاز آخر',
      updatedAt: '2026-03-12T10:00:00.000Z'
    };

    let baseTransactionCalls = 0;
    const syncRes = await executeBoundedShardSync({
      baseShardId: 'shard_daily_0',
      shardType: 'dailyRecords',
      bucket: 0,
      opId: 'op_concurrent_overflow_test',
      incomingItems: incoming,
      deletedIds: [],
      replaceState: false,
      maxBytesPerShard: 3000,
      deduplicateAndMerge: (existing, next) => deduplicateDailyRecords([...existing, ...next]),
      readOverflowDoc: async docId => firestoreDocs.get(docId) ?? null,
      runDocTransaction: async txParams => {
        if (txParams.docId === 'shard_daily_0' && baseTransactionCalls++ === 0) {
          // Simulate another device committing after our initial read but before our publish transaction.
          firestoreDocs.set('shard_daily_0', {
            ...firestoreDocs.get('shard_daily_0')!,
            _revision: 2,
            items: [...firestoreDocs.get('shard_daily_0')!.items, concurrentRecord]
          });
        }
        const existing = firestoreDocs.get(txParams.docId) ?? null;
        const previousRevision = typeof existing?._revision === 'number' ? existing._revision : 0;
        const built = txParams.buildNext(existing, existing !== null);
        if (!built.skipWrite) {
          const revision = previousRevision + 1;
          firestoreDocs.set(txParams.docId, { ...built.payload, _revision: revision });
          return { committed: true, skipped: false, revision };
        }
        return { committed: true, skipped: true, revision: previousRevision };
      }
    });

    assert.equal(baseTransactionCalls >= 2, true);
    assert.equal(syncRes.totalCount, 34);
    const base = firestoreDocs.get('shard_daily_0')!;
    assert.equal(base.items.some((item: any) => item.id === 'concurrent_device_record'), true);
    assert.equal(base.overflowShardIds.every((id: string) => firestoreDocs.has(id)), true);
    const allItems = [
      ...base.items,
      ...base.overflowShardIds.flatMap((id: string) => firestoreDocs.get(id)!.items)
    ];
    assert.equal(allItems.some((item: any) => item.id === 'existing_record'), true);
    assert.equal(allItems.some((item: any) => item.id === 'concurrent_device_record'), true);
    assert.equal(incoming.every(item => allItems.some((stored: any) => stored.id === item.id)), true);
  });

  it('Scenario 5: Concurrent edits on master_state and Shards enforce Generation Marker (_shardRevisions) and protect _replaceState from stale overwrite', () => {
    const coordinator = new ShardSubscriptionCoordinator('master_state', ALL_SHARD_DOC_IDS);

    // Load all 8 shards at initial _revision = 2
    for (const shardId of ALL_SHARD_DOC_IDS) {
      coordinator.recordSnapshot(shardId, {
        exists: true,
        data: { _revision: 2, items: [{ id: `item_${shardId}`, studentId: 's1', date: '2026-03-01' }] },
        fromCache: false,
        hasPendingWrites: false
      });
    }

    // Now master_state arrives from a newer multi-document write (generation G2) expecting shard_daily_0 at _revision = 3
    coordinator.recordSnapshot('master_state', {
      exists: true,
      data: {
        _revision: 5,
        _syncGeneration: 'gen_2',
        _shardRevisions: { shard_daily_0: 3 },
        users: [{ id: 'u1', name: 'أ. مريم' }]
      },
      fromCache: false,
      hasPendingWrites: false
    });

    // Because shard_daily_0 is still at _revision = 2 (< expected 3), state is NOT generation-consistent yet!
    assert.equal(coordinator.isGenerationConsistent('master_state'), false);
    assert.deepEqual(coordinator.getOutdatedShardIds('master_state'), ['shard_daily_0']);
    assert.equal(coordinator.computeStatus({ isOnline: true, pendingQueueCount: 0 }), 'syncing');
    const prematureAssembly = coordinator.assembleIfComplete('master_state');
    assert.equal(prematureAssembly.complete, false);
    assert.equal(prematureAssembly.generationConsistent, false);

    // Once shard_daily_0 snapshot arrives at _revision = 3, generation consistency is satisfied!
    coordinator.recordSnapshot('shard_daily_0', {
      exists: true,
      data: { _revision: 3, items: [{ id: 'item_shard_daily_0_v3', studentId: 's1', date: '2026-03-02' }] },
      fromCache: false,
      hasPendingWrites: false
    });
    assert.equal(coordinator.isGenerationConsistent('master_state'), true);
    assert.equal(coordinator.computeStatus({ isOnline: true, pendingQueueCount: 0 }), 'connected');
    const consistentAssembly = coordinator.assembleIfComplete('master_state');
    assert.equal(consistentAssembly.complete, true);
    assert.equal(consistentAssembly.generationConsistent, true);

    // A shard newer than the published manifest is not proof that it belongs to this generation.
    coordinator.recordSnapshot('shard_daily_0', {
      exists: true,
      data: { _revision: 4, items: [{ id: 'item_from_unpublished_generation' }] },
      fromCache: false,
      hasPendingWrites: false
    });
    assert.equal(coordinator.isGenerationConsistent('master_state'), false);
    assert.deepEqual(coordinator.getOutdatedShardIds('master_state'), ['shard_daily_0']);

    // Restore the published base revision, then verify that every overflow pointer is
    // represented in the manifest and resolves to an existing, loaded document.
    coordinator.recordSnapshot('shard_daily_0', {
      exists: true,
      data: { _revision: 3, overflowShardIds: ['shard_daily_0_overflow_1'], items: [] },
      fromCache: false,
      hasPendingWrites: false
    });
    assert.equal(coordinator.isGenerationConsistent('master_state'), false);
    assert.deepEqual(coordinator.getOutdatedShardIds('master_state'), ['shard_daily_0_overflow_1']);

    coordinator.recordSnapshot('shard_daily_0_overflow_1', {
      exists: false,
      data: null,
      fromCache: false,
      hasPendingWrites: false
    });
    assert.deepEqual(coordinator.getOutdatedShardIds('master_state'), ['shard_daily_0_overflow_1']);

    coordinator.recordSnapshot('master_state', {
      exists: true,
      data: {
        _revision: 6,
        _syncGeneration: 'gen_3',
        _shardRevisions: { shard_daily_0: 3, shard_daily_0_overflow_1: 1 },
        users: [{ id: 'u1', name: 'أ. مريم' }]
      },
      fromCache: false,
      hasPendingWrites: false
    });
    coordinator.recordSnapshot('shard_daily_0_overflow_1', {
      exists: true,
      data: { _revision: 1, items: [{ id: 'overflow_item_1' }] },
      fromCache: false,
      hasPendingWrites: false
    });
    assert.equal(coordinator.isGenerationConsistent('master_state'), true);

    // Also test _replaceState protection against overwriting newer server data with stale local state
    const newerRemoteMaster = {
      _revision: 10,
      lastSyncedAt: '2026-03-15T12:00:00.000Z',
      users: [{ id: 'u1', name: 'معلمة محدثة على الخادم', updatedAt: '2026-03-15T12:00:00.000Z' }]
    };
    const staleLocalReplace = {
      _replaceState: true,
      _expectedBaseRevision: 8,
      lastSyncedAt: '2026-03-14T10:00:00.000Z',
      users: [{ id: 'u1', name: 'نسخة قديمة', updatedAt: '2026-03-14T10:00:00.000Z' }]
    };
    assert.throws(
      () => validateReplaceStateFreshness(newerRemoteMaster, staleLocalReplace),
      StaleReplaceStateError
    );
  });

  it('Scenario 6: Record content mismatch with equal record counts during migration is detected and triggers automatic rollback', async () => {
    const sandbox = new Map<string, Record<string, any>>();
    const originalMaster = {
      users: [{ id: 'u1', name: 'أ. نورة' }],
      dailyRecords: [
        { id: 'dr_s1_2026-03-01', studentId: 's1', date: '2026-03-01', score: 100, updatedAt: '2026-03-01T10:00:00Z' },
        { id: 'dr_s2_2026-03-01', studentId: 's2', date: '2026-03-01', score: 95, updatedAt: '2026-03-01T10:00:00Z' }
      ]
    };
    sandbox.set('master_state', structuredClone(originalMaster));

    // Direct unit check on verifyCollectionContentParity when counts match (2 === 2) but content differs
    const parityCheck = verifyCollectionContentParity(
      originalMaster.dailyRecords,
      [
        { id: 'dr_s1_2026-03-01', studentId: 's1', date: '2026-03-01', score: 100, updatedAt: '2026-03-01T10:00:00Z' },
        { id: 'dr_s2_2026-03-01', studentId: 's2', date: '2026-03-01', score: 50, updatedAt: '2026-03-01T10:00:00Z' } // Corrupted score!
      ],
      r => r.id
    );
    assert.equal(parityCheck.countMatched, true);
    assert.equal(parityCheck.idsMatched, true);
    assert.equal(parityCheck.contentMatched, false);
    assert.equal(parityCheck.verified, false);

    // Simulate subtle content corruption on write where record count stays identical (2 records)
    const migrationRes = await executeSafeLegacyShardMigration({
      cleanupLegacyAfterVerification: true,
      adapter: {
        readAllDocs: async () => {
          const docs: Record<string, Record<string, any> | null> = {};
          for (const [k, v] of sandbox.entries()) {
            docs[k] = structuredClone(v);
          }
          return { completeRead: true, docs };
        },
        writeDoc: async (docId, payload) => {
          const copy = structuredClone(payload);
          if (docId.startsWith('shard_daily_') && Array.isArray(copy.items) && copy.items.length > 0) {
            // Mutate content without changing record count
            copy.items[0].score = 0;
          }
          sandbox.set(docId, copy);
        }
      }
    });

    assert.equal(migrationRes.report.status, 'rolled_back');
    assert.equal(migrationRes.report.rolledBack, true);
    assert.equal(migrationRes.report.error, 'VERIFICATION_CONTENT_MISMATCH');
    // Verify original master_state was restored intact with score = 100 and 95
    assert.equal(sandbox.get('master_state')?.dailyRecords?.[0]?.score, 100);
    assert.equal(sandbox.get('master_state')?.dailyRecords?.[1]?.score, 95);
  });

  it('Scenario 7: Data recovery after sync interruption replays queued operations in causal order without data loss', async () => {
    const primaryStorage = createMockStorage();
    const queue = new PendingSyncQueueManager('test_recovery_q', {
      primaryStorage
    });

    await queue.enqueueDurable({
      opId: 'op_rec_1',
      changedKeys: ['students'],
      payload: { students: [{ id: 'stu_1', name: 'طالبة 1', updatedAt: '2026-03-10T08:00:00Z' }] }
    });
    await queue.enqueueDurable({
      opId: 'op_rec_2',
      changedKeys: ['attendanceRecords'],
      payload: {
        attendanceRecords: [{ id: 'att_stu_1', studentId: 'stu_1', date: '2026-03-10', status: 'present' }]
      }
    });

    // Simulate interruption on second operation during first flush attempt
    let failOnSecond = true;
    const committedOps: string[] = [];
    const firstFlush = await queue.flush(async op => {
      if (op.opId === 'op_rec_2' && failOnSecond) {
        throw new Error('NETWORK_INTERRUPTED_MID_SYNC');
      }
      committedOps.push(op.opId);
    });

    assert.equal(firstFlush.flushedCount, 1);
    assert.equal(firstFlush.remainingCount, 1);

    // Simulate app reload and reconnection -> resume remaining operation
    failOnSecond = false;
    const reloadedQueue = new PendingSyncQueueManager('test_recovery_q', {
      primaryStorage
    });
    const secondFlush = await reloadedQueue.flush(async op => {
      committedOps.push(op.opId);
    });

    assert.equal(secondFlush.flushedCount, 1);
    assert.equal(secondFlush.remainingCount, 0);
    assert.deepEqual(committedOps, ['op_rec_1', 'op_rec_2']);
  });

  it('Scenario 8: Invalid Hijri dates in parseHijriJoinDate are rejected without silent clamping while preserving historical records', () => {
    // 1. Default empty/undefined initialization returns 1448-01-01
    assert.deepEqual(parseHijriJoinDate(undefined), { year: 1448, month: 1, day: 1 });
    assert.deepEqual(parseHijriJoinDate(''), { year: 1448, month: 1, day: 1 });

    // 2. Valid historical Hijri date before 1440 AH (e.g. 1435-04-15) is preserved without clamping to 1440!
    assert.deepEqual(parseHijriJoinDate('1435-04-15'), { year: 1435, month: 4, day: 15 });

    // 3. Valid Gregorian join date converts accurately to Hijri parts
    const gregConverted = parseHijriJoinDate('2025-03-01');
    assert.equal(gregConverted.year, 1446);
    assert.equal(gregConverted.month, 9);

    // 4. Out-of-bounds month (1447-13-01) or day (1447-05-35) MUST throw instead of silently clamping to 12 or 30
    assert.throws(() => parseHijriJoinDate('1447-13-01'), HijriConversionError);
    assert.throws(() => parseHijriJoinDate('1447-00-10'), HijriConversionError);
    assert.throws(() => parseHijriJoinDate('1447-05-35'), HijriConversionError);

    // 5. Day 30 in a 29-day Umm al-Qura Hijri month MUST throw instead of silently passing
    const month29 = Array.from({ length: 12 }, (_, i) => i + 1).find(
      m => getHijriMonthLength(1447, m) === 29
    )!;
    assert.throws(
      () => parseHijriJoinDate(`1447-${String(month29).padStart(2, '0')}-30`),
      HijriConversionError
    );

    // 6. Malformed string or invalid Gregorian date (2026-02-30) MUST throw instead of falling back to 1448-01-01
    assert.throws(() => parseHijriJoinDate('not-a-date'), HijriConversionError);
    assert.throws(() => parseHijriJoinDate('2026-02-30'), HijriConversionError);
  });

  it('Scenario 9: Invalid image URLs and offline storage failures are caught and cloudVerified is never true without server confirmation', async () => {
    const validPngDataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const workingStorage = createMockStorage();

    // 1. External HTTPS URL when online WITHOUT a cloud verification uploader MUST NOT claim cloudVerified: true
    const unverifiedExternal = await uploadImageDataUrlWithMeta(
      'https://example.com/logo.png',
      'institution-logo',
      {
        isOnline: true,
        storageObj: workingStorage
      }
    );
    assert.equal(unverifiedExternal.cloudVerified, false);
    assert.equal(unverifiedExternal.localPersisted, true);

    // 2. Invalid image URLs (malformed host, spaces, protocol-relative //, corrupted base64) MUST throw ImageStorageError
    await assert.rejects(
      () => uploadImageDataUrlWithMeta('https://', 'institution-logo', { isOnline: true, storageObj: workingStorage }),
      ImageStorageError
    );
    await assert.rejects(
      () =>
        uploadImageDataUrlWithMeta('https://bad url with spaces.com/a.png', 'institution-logo', {
          isOnline: true,
          storageObj: workingStorage
        }),
      ImageStorageError
    );
    await assert.rejects(
      () =>
        uploadImageDataUrlWithMeta('//evil.example.com/a.png', 'institution-logo', {
          isOnline: true,
          storageObj: workingStorage
        }),
      ImageStorageError
    );
    await assert.rejects(
      () =>
        uploadImageDataUrlWithMeta('data:image/png;base64,!!!invalid_base64!!!', 'institution-logo', {
          isOnline: true,
          storageObj: workingStorage
        }),
      ImageStorageError
    );

    // 3. Offline upload when local storage fails MUST throw ImageStorageError('STORAGE_QUOTA_EXCEEDED')
    const failingOfflineStorage = createMockStorage(0); // 0 capacity -> always throws QuotaExceededError
    await assert.rejects(
      () =>
        uploadImageDataUrlWithMeta(validPngDataUrl, 'institution-logo', {
          isOnline: false,
          storageObj: failingOfflineStorage
        }),
      (err: any) => err instanceof ImageStorageError && err.code === 'STORAGE_QUOTA_EXCEEDED'
    );
  });
});
