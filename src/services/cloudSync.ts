import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  onSnapshot,
  runTransaction
} from 'firebase/firestore';
import { auth, db, FIRESTORE_COLLECTION, FIRESTORE_DOC_ID } from '../firebase';
import {
  ALL_SHARD_DOC_IDS,
  ATTENDANCE_SHARD_DOC_IDS,
  DAILY_SHARD_DOC_IDS,
  MAX_AUDIT_LOGS_COUNT,
  MAX_RECENT_OP_IDS,
  MigrationCheckpoint,
  PendingSyncOperation,
  PendingSyncQueueManager,
  SHARDED_COLLECTION_KEYS,
  SHARD_SAFE_BYTE_LIMIT,
  SHARD_SUBMISSIONS_DOC_ID,
  SHARD_SUBSCRIPTIONS_LOGS_DOC_ID,
  ShardMigrationReport,
  ShardSubscriptionCoordinator,
  StaleCacheWriteError,
  StaleReplaceStateError,
  VersionedDocEnvelope,
  assembleShardedCloudState,
  assertServerReadForWrite,
  createOperationId,
  deepCleanForFirestore,
  deduplicateAtqiniSubmissions,
  deduplicateAttendanceRecords,
  deduplicateChallengeSubmissions,
  deduplicateDailyRecords,
  executeBoundedShardSync,
  executeSafeLegacyShardMigration,
  extractReferencedOverflowShardIds,
  getAttendanceRecordShardId,
  getDailyRecordShardId,
  mergeArrayByKey,
  mergeDeletedEntities,
  pruneDeadStaffProfiles,
  sanitizeCloudState,
  sanitizeStaffUserForFirestore,
  validateDocumentSizeWithinLimit,
  validateReplaceStateFreshness
} from './cloudSyncHelpers';
import {
  extractStaffProfilesFromUsers,
  filterAndSortActiveStaffChatMessages,
  mergeStaffAttendanceMap,
  mergeStaffProfilesMap
} from '../utils/staffHelpers';

export type CloudSyncStatus = 'connected' | 'synced' | 'syncing' | 'pending' | 'offline' | 'error';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write'
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: Array<{
      providerId?: string | null;
      email?: string | null;
    }>;
  };
}

const handleFirestoreError = (
  error: unknown,
  operationType: OperationType,
  path: string | null
): never => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map(provider => ({
          providerId: provider.providerId,
          email: provider.email
        })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
};

const isPermissionDeniedError = (err: unknown): boolean => {
  const code = (err as any)?.code;
  const msg = String((err as any)?.message || err || '').toLowerCase();
  return code === 'permission-denied' || msg.includes('missing or insufficient permissions');
};

const isTransientOrOfflineError = (err: unknown): boolean => {
  if (err instanceof StaleCacheWriteError) return true;
  const code = String((err as any)?.code || '').toLowerCase();
  const msg = String((err as any)?.message || err || '').toLowerCase();
  return (
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    code === 'aborted' ||
    msg.includes('offline') ||
    msg.includes('timeout') ||
    msg.includes('unavailable') ||
    msg.includes('network') ||
    msg.includes('cloud_read_timeout') ||
    msg.includes('cloud_write_timeout') ||
    msg.includes('cloud_tx_timeout') ||
    msg.includes('cloud_master_state_unreachable')
  );
};

const CLOUD_DOC_PATH = { collection: FIRESTORE_COLLECTION, id: FIRESTORE_DOC_ID };

const CORE_ARRAY_COLLECTIONS: Array<[string, string]> = [
  ['users', 'id'],
  ['tracks', 'id'],
  ['circles', 'id'],
  ['students', 'id'],
  ['monthlyPlans', 'id'],
  ['studentPlans', 'id'],
  ['atqiniAssignments', 'id'],
  ['challenges', 'id'],
  ['monthlyExams', 'id'],
  ['studentExamResults', 'id'],
  ['gradingConfigs', 'trackId']
];

const FAKE_DEMO_IDS = new Set(['u-1', 'u-2', 'u-3', 'u-4', 'u-5', 'u-leader']);
const FAKE_DEMO_EMAILS = new Set([
  'rifa@ghaym.org',
  'khadija@ghaym.org',
  'maryam@ghaym.org',
  'fatima@ghaym.org',
  'hind@ghaym.org',
  'leader@ghaym.org'
]);

const withRejectingTimeout = <T,>(promise: Promise<T>, ms: number, errorCode: string): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(errorCode)), ms);
    promise.then(
      val => {
        clearTimeout(timer);
        resolve(val);
      },
      err => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
};

// Persistent Pending Operations Queue for offline resilience & guaranteed eventual consistency
export const pendingSyncQueue = new PendingSyncQueueManager();

export const getPendingSyncOperationsCount = (): number => pendingSyncQueue.size();

// Serialized local write queue prevents concurrent local mutations in the same browser tab from overlapping,
// while Firestore server transactions (`runTransaction`) prevent cross-device race conditions.
let writeQueueTail: Promise<void> = Promise.resolve();
const enqueueCloudWrite = <T,>(task: () => Promise<T>): Promise<T> => {
  const run = writeQueueTail.then(task, task);
  writeQueueTail = run.then(
    () => undefined,
    () => undefined
  );
  return run;
};

/**
 * Reconciles active records from `authorized_staff` into `stateData.users` if a stale published tab
 * accidentally omitted a staff member without deleting them (`_deletedEntities.users`).
 */
const reconcileAuthorizedStaffUsers = async (stateData: any): Promise<any> => {
  if (!stateData || typeof stateData !== 'object') return stateData;
  try {
    const authSnap = await getDocs(collection(db, 'authorized_staff'));
    if (authSnap.empty) return stateData;

    const users: any[] = Array.isArray(stateData.users) ? [...stateData.users] : [];
    const circles: any[] = Array.isArray(stateData.circles) ? stateData.circles : [];
    const deletedUsers = new Set<string>(
      Array.isArray(stateData._deletedEntities?.users)
        ? stateData._deletedEntities.users.map(String)
        : []
    );

    let modified = false;
    authSnap.forEach(docSnap => {
      const d = docSnap.data();
      if (!d || d.active === false || !d.staffId) return;
      const staffId = String(d.staffId);
      if (deletedUsers.has(staffId)) return;
      const cleanEmail = String(d.email || docSnap.id || '')
        .trim()
        .toLowerCase();
      const role = d.role || 'teacher';

      const alreadyExists = users.some(
        u =>
          u &&
          (String(u.id) === staffId ||
            (u.role === role &&
              cleanEmail &&
              String(u.email || '')
                .trim()
                .toLowerCase() === cleanEmail))
      );
      if (alreadyExists) return;

      const linkedCircleIds = circles
        .filter(c => c && (c.teacherId === staffId || c.supervisorId === staffId))
        .map(c => c.id);

      users.push(
        sanitizeStaffUserForFirestore({
          id: staffId,
          name: d.name || 'عضوة الكادر',
          role,
          title: d.title || (role === 'supervisor' ? 'مشرفة حلقات' : 'معلمة حلقة قرآنية'),
          email: cleanEmail,
          phone: d.phone || '',
          passcode: d.passcode || '',
          pin: d.passcode || '',
          circleIds: linkedCircleIds,
          isActive: true,
          ...(d.welcomeTitle ? { welcomeTitle: String(d.welcomeTitle).trim() } : {}),
          updatedAt: d.updatedAt || new Date().toISOString()
        })
      );
      modified = true;
    });

    if (modified) {
      return {
        ...stateData,
        users
      };
    }
  } catch {
    // Non-blocking fallback if offline
  }
  return stateData;
};

/**
 * Strictly reads a document from the live Firestore server (`getDocFromServer`).
 * Never falls back to local cache — used before any write/merge operation so stale cache
 * can never overwrite newer server state.
 */
export const readDocServerOnly = async (
  docId: string,
  timeoutMs = 9000
): Promise<{ exists: boolean; data: Record<string, any> | null; fromServer: true }> => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new StaleCacheWriteError(docId, `الجهاز غير متصل بالإنترنت؛ تم إيقاف الكتابة المباشرة للمستند (${docId}).`);
  }
  const ref = doc(db, CLOUD_DOC_PATH.collection, docId);
  try {
    const serverSnap = await withRejectingTimeout(
      getDocFromServer(ref),
      timeoutMs,
      `CLOUD_READ_TIMEOUT_${docId}`
    );
    return {
      exists: serverSnap.exists(),
      data: serverSnap.exists() ? (serverSnap.data() as Record<string, any>) : null,
      fromServer: true
    };
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      handleFirestoreError(err, OperationType.GET, `${CLOUD_DOC_PATH.collection}/${docId}`);
    }
    throw new StaleCacheWriteError(
      docId,
      `تعذر التحقق من أحدث نسخة على الخادم للمستند (${docId}): ${err instanceof Error ? err.message : String(err)}`
    );
  }
};

/**
 * Reads a document from the server first, and ONLY falls back to local cache when `allowCacheFallback === true`
 * (for read-only UI display when offline). Explicitly tags `fromServer` and `readError` so callers never mistake
 * a cache read or a failed read for an authoritative server read.
 */
export const readDocServerThenCache = async (
  docId: string,
  forceServer: boolean,
  allowCacheFallback = false
): Promise<{
  exists: boolean;
  data: Record<string, any> | null;
  fromServer: boolean;
  readError: boolean;
}> => {
  const ref = doc(db, CLOUD_DOC_PATH.collection, docId);
  const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;

  if (forceServer && !isOffline) {
    try {
      const serverSnap = await withRejectingTimeout(
        getDocFromServer(ref),
        8000,
        `CLOUD_READ_TIMEOUT_${docId}`
      );
      return {
        exists: serverSnap.exists(),
        data: serverSnap.exists() ? (serverSnap.data() as Record<string, any>) : null,
        fromServer: true,
        readError: false
      };
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.GET, `${CLOUD_DOC_PATH.collection}/${docId}`);
      }
      if (!allowCacheFallback) {
        return { exists: false, data: null, fromServer: false, readError: true };
      }
    }
  } else if (forceServer && isOffline && !allowCacheFallback) {
    return { exists: false, data: null, fromServer: false, readError: true };
  }

  try {
    const cacheSnap = await getDoc(ref);
    return {
      exists: cacheSnap.exists(),
      data: cacheSnap.exists() ? (cacheSnap.data() as Record<string, any>) : null,
      fromServer: false,
      readError: false
    };
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      handleFirestoreError(err, OperationType.GET, `${CLOUD_DOC_PATH.collection}/${docId}`);
    }
    return { exists: false, data: null, fromServer: false, readError: true };
  }
};

/**
 * Fetches the complete cloud database state (`master_state` + all shard documents).
 * Guarantees that if any shard fails to load, the result is rejected as incomplete
 * rather than treating a failed shard as an empty array (`[]`).
 */
export const fetchCloudDatabaseOnce = async (forceServer = true): Promise<any | null> => {
  try {
    const docIds = [CLOUD_DOC_PATH.id, ...ALL_SHARD_DOC_IDS];
    const results = await Promise.all(
      docIds.map(async id => ({
        id,
        res: await readDocServerThenCache(id, forceServer, !forceServer)
      }))
    );

    // Reject partial/failed reads so a missing or timed-out shard is never treated as empty data
    if (results.some(r => r.res.readError)) {
      return null;
    }
    if (forceServer && results.some(r => !r.res.fromServer)) {
      return null;
    }

    const masterEntry = results.find(r => r.id === CLOUD_DOC_PATH.id);
    if (!masterEntry?.res.exists || !masterEntry.res.data) {
      return null;
    }

    const shardsById: Record<string, Record<string, any> | null> = {};
    for (const r of results) {
      if (r.id !== CLOUD_DOC_PATH.id) {
        shardsById[r.id] = r.res.data;
      }
    }

    // Dynamically discover and load any overflow shards created by partitionItemsIntoBoundedShards
    const referencedOverflowIds = new Set<string>(extractReferencedOverflowShardIds(shardsById));
    const masterRevs = masterEntry.res.data?._shardRevisions;
    if (masterRevs && typeof masterRevs === 'object') {
      for (const revKey of Object.keys(masterRevs)) {
        if (!docIds.includes(revKey)) {
          referencedOverflowIds.add(revKey);
        }
      }
    }

    if (referencedOverflowIds.size > 0) {
      const overflowResults = await Promise.all(
        Array.from(referencedOverflowIds).map(async id => ({
          id,
          res: await readDocServerThenCache(id, forceServer, !forceServer)
        }))
      );
      if (overflowResults.some(r => r.res.readError)) {
        return null;
      }
      if (forceServer && overflowResults.some(r => !r.res.fromServer)) {
        return null;
      }
      for (const r of overflowResults) {
        shardsById[r.id] = r.res.data;
      }
    }

    const assembled = assembleShardedCloudState(masterEntry.res.data, shardsById);
    if (!assembled) return null;
    return await reconcileAuthorizedStaffUsers(assembled);
  } catch (err) {
    console.warn('Initial cloud database fetch notice:', err);
    return null;
  }
};

let activeSubscriptionCleanup: (() => void) | null = null;

/**
 * Subscribes to `master_state` and all required shard documents (`ALL_SHARD_DOC_IDS` + any dynamic overflow shards).
 * - Waits until ALL required documents (`master_state` + all base & overflow shards) have loaded AND satisfy
 *   the `_shardRevisions` generation manifest before emitting state.
 * - Never declares `'connected'` while any shard is still loading, has an error, has pending writes,
 *   is behind the generation revision expected by `master_state`, or while offline / pending queue is non-empty.
 * - Prevents duplicate subscriptions, listener leaks, and out-of-order async state updates.
 */
export const subscribeToCloudDatabase = (
  onData: (data: any) => void,
  onStatusChange?: (status: CloudSyncStatus) => void
) => {
  if (activeSubscriptionCleanup) {
    try {
      activeSubscriptionCleanup();
    } catch {
      // ignore cleanup errors
    }
    activeSubscriptionCleanup = null;
  }

  const watchedDocIds = [CLOUD_DOC_PATH.id, ...ALL_SHARD_DOC_IDS];
  const coordinator = new ShardSubscriptionCoordinator(CLOUD_DOC_PATH.id, ALL_SHARD_DOC_IDS);
  let emitTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const isCurrentlyOnline = () =>
    typeof navigator === 'undefined' ? true : navigator.onLine !== false;

  const emitCurrentStatus = () => {
    if (disposed) return;
    const status = coordinator.computeStatus({
      isOnline: isCurrentlyOnline(),
      pendingQueueCount: pendingSyncQueue.size(),
      masterDocId: CLOUD_DOC_PATH.id
    });
    onStatusChange?.(status);
  };

  const scheduleEmit = () => {
    if (disposed) return;
    emitCurrentStatus();

    // Never emit partial or generation-mismatched state before every required shard + master_state is consistent
    if (!coordinator.isAllRequiredLoaded(CLOUD_DOC_PATH.id)) {
      return;
    }

    if (emitTimer) clearTimeout(emitTimer);
    emitTimer = setTimeout(() => {
      if (disposed) return;
      const assembly = coordinator.assembleIfComplete(CLOUD_DOC_PATH.id);
      if (!assembly.complete) {
        emitCurrentStatus();
        return;
      }

      if (!assembly.state) {
        onData(null);
        emitCurrentStatus();
        return;
      }

      const seq = coordinator.nextEmitSequence();
      if (assembly.fromServer && isCurrentlyOnline()) {
        void reconcileAuthorizedStaffUsers(assembly.state).then(reconciled => {
          if (disposed || seq !== coordinator.getCurrentEmitSequence()) {
            return;
          }
          onData(reconciled);
          emitCurrentStatus();
        });
      } else {
        onData(assembly.state);
        emitCurrentStatus();
      }
    }, 60);
  };

  const handleOnlineStatusChange = () => {
    if (disposed) return;
    emitCurrentStatus();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnlineStatusChange);
    window.addEventListener('offline', handleOnlineStatusChange);
  }

  try {
    const subscribedDocSet = new Set<string>();
    const unsubscribes: Array<() => void> = [];

    const attachDocListener = (docId: string) => {
      if (disposed || subscribedDocSet.has(docId)) return;
      subscribedDocSet.add(docId);
      const docRef = doc(db, CLOUD_DOC_PATH.collection, docId);
      const unsub = onSnapshot(
        docRef,
        { includeMetadataChanges: true },
        snapshot => {
          if (disposed) return;
          const newlyDiscoveredOverflowIds = coordinator.recordSnapshot(docId, {
            exists: snapshot.exists(),
            data: snapshot.exists() ? (snapshot.data() as Record<string, any>) : null,
            fromCache: snapshot.metadata.fromCache,
            hasPendingWrites: snapshot.metadata.hasPendingWrites
          });

          for (const ovId of newlyDiscoveredOverflowIds) {
            attachDocListener(ovId);
          }

          if (snapshot.metadata.hasPendingWrites) {
            emitCurrentStatus();
            return;
          }

          scheduleEmit();
        },
        error => {
          if (disposed) return;
          console.warn(`Firebase sync listener error (${docId}):`, error);
          coordinator.recordError(
            docId,
            error instanceof Error ? error.message : String(error)
          );
          onStatusChange?.('error');
        }
      );
      unsubscribes.push(unsub);
    };

    watchedDocIds.forEach(attachDocListener);

    const cleanup = () => {
      disposed = true;
      if (emitTimer) clearTimeout(emitTimer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnlineStatusChange);
        window.removeEventListener('offline', handleOnlineStatusChange);
      }
      unsubscribes.forEach(unsub => {
        try {
          unsub();
        } catch {
          // ignore
        }
      });
      if (activeSubscriptionCleanup === cleanup) {
        activeSubscriptionCleanup = null;
      }
    };

    activeSubscriptionCleanup = cleanup;
    return cleanup;
  } catch (error) {
    console.warn('Failed to subscribe to cloud database:', error);
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', handleOnlineStatusChange);
      window.removeEventListener('offline', handleOnlineStatusChange);
    }
    onStatusChange?.('offline');
    return () => {};
  }
};

const buildMergedCorePayload = (remoteRaw: any, statePayload: any): Record<string, any> => {
  const remoteData = sanitizeCloudState(remoteRaw || {});
  const incomingState = sanitizeCloudState(statePayload);

  if (incomingState._replaceState === true) {
    // Protect against overwriting newer server data with a stale local snapshot
    validateReplaceStateFreshness(remoteRaw, incomingState);

    const replacement = { ...incomingState };
    delete replacement._replaceState;
    delete replacement._expectedBaseRevision;
    delete replacement._forceOverwriteNewerServer;
    delete replacement._replaceTimestampMs;
    for (const shardedKey of SHARDED_COLLECTION_KEYS) {
      delete replacement[shardedKey];
    }
    delete replacement.staffOperations;
    delete replacement.staffChatMessages;
    delete replacement.deletedStaffChatIds;
    delete replacement.pinnedStaffAnnouncement;
    delete replacement.staffAttendanceRecords;
    if (replacement.settings && typeof replacement.settings === 'object') {
      replacement.settings = { ...replacement.settings };
      delete replacement.settings.staffOperations;
    }
    if (Array.isArray(replacement.users)) {
      replacement.users = replacement.users.map(sanitizeStaffUserForFirestore);
    } else {
      replacement.users = [];
    }
    return deepCleanForFirestore({
      ...replacement,
      lastSyncedAt: new Date().toISOString()
    });
  }

  const deletedEntities = mergeDeletedEntities(remoteData._deletedEntities, incomingState._deletedEntities);
  const remoteSettings = remoteData.settings || {};
  const incomingSettings = incomingState.settings || {};

  const mergedStaffWelcomeConfigs: Record<string, any> = {
    ...(remoteSettings.staffWelcomeConfigs || {})
  };
  for (const [k, incCfg] of Object.entries(incomingSettings.staffWelcomeConfigs || {})) {
    if (!incCfg || typeof incCfg !== 'object') continue;
    const exCfg = mergedStaffWelcomeConfigs[k];
    const incTime = Date.parse((incCfg as any).updatedAt || '') || 0;
    const exTime = exCfg ? Date.parse(exCfg.updatedAt || '') || 0 : -1;
    if (!exCfg || incTime >= exTime) {
      mergedStaffWelcomeConfigs[k] = { ...(exCfg || {}), ...(incCfg as any) };
    }
  }

  const mergedWelcomeMessages: Record<string, string> = {
    ...(remoteSettings.welcomeMessages || {}),
    ...(incomingSettings.welcomeMessages || {})
  };
  for (const [k, cfg] of Object.entries(mergedStaffWelcomeConfigs)) {
    if (cfg && typeof cfg.welcomeTitle === 'string' && cfg.welcomeTitle.trim()) {
      mergedWelcomeMessages[k] = cfg.welcomeTitle.trim();
    }
  }

  const remoteUsersList = Array.isArray(remoteData.users) ? remoteData.users : [];
  const incomingUsersList = Array.isArray(incomingState.users) ? incomingState.users : [];

  const userDeletedChatIds: string[] = [];
  const userChatMessages: any[] = [];
  const userPinnedCandidates: any[] = [];
  for (const u of [...remoteUsersList, ...incomingUsersList]) {
    if (Array.isArray(u?.deletedStaffChatIds)) {
      userDeletedChatIds.push(...u.deletedStaffChatIds);
    }
    if (Array.isArray(u?.staffChatMessages)) {
      userChatMessages.push(...u.staffChatMessages);
    }
    if (u?.pinnedStaffAnnouncement && typeof u.pinnedStaffAnnouncement.text === 'string') {
      userPinnedCandidates.push(u.pinnedStaffAnnouncement);
    }
  }

  const mergedDeletedChatIds = [
    ...new Set(
      [
        ...(Array.isArray(remoteData.deletedStaffChatIds) ? remoteData.deletedStaffChatIds : []),
        ...(Array.isArray(incomingState.deletedStaffChatIds) ? incomingState.deletedStaffChatIds : []),
        ...(Array.isArray(remoteSettings.deletedStaffChatIds) ? remoteSettings.deletedStaffChatIds : []),
        ...(Array.isArray(incomingSettings.deletedStaffChatIds) ? incomingSettings.deletedStaffChatIds : []),
        ...userDeletedChatIds
      ].map(String)
    )
  ];

  const mergedStaffChatMessages = filterAndSortActiveStaffChatMessages(
    [
      ...(Array.isArray(remoteData.staffChatMessages) ? remoteData.staffChatMessages : []),
      ...(Array.isArray(incomingState.staffChatMessages) ? incomingState.staffChatMessages : []),
      ...(Array.isArray(remoteSettings.staffChatMessages) ? remoteSettings.staffChatMessages : []),
      ...(Array.isArray(incomingSettings.staffChatMessages) ? incomingSettings.staffChatMessages : []),
      ...userChatMessages
    ],
    mergedDeletedChatIds
  );

  const pinCandidates = [
    remoteData.pinnedStaffAnnouncement,
    incomingState.pinnedStaffAnnouncement,
    remoteSettings.pinnedStaffAnnouncement,
    incomingSettings.pinnedStaffAnnouncement,
    ...userPinnedCandidates
  ].filter(p => p && typeof p === 'object' && typeof p.text === 'string');

  let mergedPinnedAnnouncement = pinCandidates[0];
  for (const p of pinCandidates) {
    if ((p.updatedAt || 0) >= (mergedPinnedAnnouncement?.updatedAt || 0)) {
      mergedPinnedAnnouncement = p;
    }
  }

  const mergedStaffProfiles = mergeStaffProfilesMap(
    extractStaffProfilesFromUsers(remoteUsersList),
    remoteData.staffOperations,
    remoteSettings.staffProfiles,
    remoteSettings.staffOperations,
    extractStaffProfilesFromUsers(incomingUsersList),
    incomingState.staffOperations,
    incomingSettings.staffProfiles,
    incomingSettings.staffOperations
  );

  const mergedStaffAttendanceRecords = mergeStaffAttendanceMap(
    remoteData.staffAttendanceRecords,
    remoteSettings.staffAttendanceRecords,
    incomingState.staffAttendanceRecords,
    incomingSettings.staffAttendanceRecords
  );

  const finalPayload: Record<string, any> = {
    ...remoteData,
    ...incomingState,
    _deletedEntities: deletedEntities,
    settings: {
      ...remoteSettings,
      ...incomingSettings,
      welcomeMessages: mergedWelcomeMessages,
      staffWelcomeConfigs: mergedStaffWelcomeConfigs,
      staffChatMessages: mergedStaffChatMessages,
      deletedStaffChatIds: mergedDeletedChatIds,
      ...(mergedPinnedAnnouncement ? { pinnedStaffAnnouncement: mergedPinnedAnnouncement } : {}),
      staffProfiles: mergedStaffProfiles,
      staffAttendanceRecords: mergedStaffAttendanceRecords
    },
    lastSyncedAt: new Date().toISOString()
  };

  // Never store sharded collections or duplicate legacy bloat fields inside master_state
  for (const shardedKey of SHARDED_COLLECTION_KEYS) {
    delete finalPayload[shardedKey];
  }
  delete finalPayload.staffOperations;
  delete finalPayload.staffChatMessages;
  delete finalPayload.deletedStaffChatIds;
  delete finalPayload.pinnedStaffAnnouncement;
  delete finalPayload.staffAttendanceRecords;
  delete finalPayload.settings.staffOperations;

  for (const [col, key] of CORE_ARRAY_COLLECTIONS) {
    let mergedItems = mergeArrayByKey(
      remoteData[col] || [],
      incomingState[col] || [],
      key,
      deletedEntities[col] || []
    );
    if (col === 'users') {
      mergedItems = mergedItems
        .filter((u: any) => {
          if (!u || !u.id) return false;
          const email = (u.email || '').trim().toLowerCase();
          return !FAKE_DEMO_IDS.has(String(u.id)) && !FAKE_DEMO_EMAILS.has(email);
        })
        .map((u: any) => {
          const profileCfg = mergedStaffProfiles[u.id];
          const cleanedUser = { ...u };
          delete cleanedUser.staffChatMessages;
          delete cleanedUser.deletedStaffChatIds;
          delete cleanedUser.pinnedStaffAnnouncement;
          const mergedUser = !profileCfg
            ? cleanedUser
            : {
                ...cleanedUser,
                ...(profileCfg.workingHours !== undefined ? { workingHours: profileCfg.workingHours } : {}),
                ...(profileCfg.monthlySalary !== undefined ? { monthlySalary: profileCfg.monthlySalary } : {}),
                ...(Array.isArray(profileCfg.tasks) ? { tasks: profileCfg.tasks } : {}),
                ...(profileCfg.leaderPrivateNotes !== undefined
                  ? { leaderPrivateNotes: profileCfg.leaderPrivateNotes }
                  : {}),
                updatedAt: profileCfg.updatedAt || u.updatedAt
              };
          return sanitizeStaffUserForFirestore(mergedUser);
        });
    }
    finalPayload[col] = mergedItems;
  }

  if (!Array.isArray(finalPayload.users)) {
    finalPayload.users = [];
  }

  finalPayload.settings.staffProfiles = pruneDeadStaffProfiles(
    mergedStaffProfiles,
    finalPayload.users,
    deletedEntities.users || []
  );

  return deepCleanForFirestore(finalPayload);
};

/**
 * Builds a Firestore-safe `staffProfiles` patch that explicitly emits `deleteField()`
 * for any stale/deleted user keys still present on the remote document so `{ merge: true }`
 * never preserves dead keys indefinitely.
 */
const buildStaffProfilesPatch = (
  prunedProfiles: Record<string, any>,
  remoteStaffProfiles: Record<string, any> | undefined
): Record<string, any> => {
  const patch: Record<string, any> = { ...prunedProfiles };
  if (remoteStaffProfiles && typeof remoteStaffProfiles === 'object') {
    for (const remoteKey of Object.keys(remoteStaffProfiles)) {
      if (!(remoteKey in prunedProfiles)) {
        patch[remoteKey] = deleteField();
      }
    }
  }
  return patch;
};

/**
 * Executes an atomic Firestore Server Transaction (`runTransaction`) on a single document (`docId`)
 * with optimistic concurrency control (`_revision`), idempotency tracking (`opId`, `recentOpIds`),
 * and strict 1 MiB document size validation.
 *
 * Because Firestore `runTransaction` requires live server connectivity and automatically retries
 * when another device concurrently modifies `docId` between `tx.get` and `tx.set`, this prevents
 * both multi-device lost updates AND stale-cache overwrites.
 */
const runServerDocTransaction = async (params: {
  docId: string;
  opId: string;
  merge?: boolean;
  timeoutMs?: number;
  buildNext: (
    remoteData: Record<string, any> | null,
    exists: boolean
  ) => { skipWrite?: boolean; payload: Record<string, any> };
}): Promise<{ committed: boolean; skipped: boolean; revision: number }> => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new StaleCacheWriteError(
      params.docId,
      `لا يوجد اتصال بالإنترنت؛ تم حفظ التعديلات في قائمة الانتظار المحلية (${params.docId}).`
    );
  }

  const docRef = doc(db, CLOUD_DOC_PATH.collection, params.docId);
  const timeoutMs = params.timeoutMs ?? 15000;

  try {
    return await withRejectingTimeout(
      runTransaction(
        db,
        async tx => {
          const snap = await tx.get(docRef);
          const exists = snap.exists();
          const remoteData = exists ? (snap.data() as Record<string, any>) : null;
          const remoteRevision =
            remoteData && typeof remoteData._revision === 'number' ? remoteData._revision : 0;
          const recentOpIds = Array.isArray(remoteData?.recentOpIds)
            ? remoteData!.recentOpIds.map(String)
            : [];

          // Idempotency check: if this operation ID was already applied on the server, skip duplicate write
          if (
            params.opId &&
            (remoteData?.lastOpId === params.opId || recentOpIds.includes(params.opId))
          ) {
            return { committed: true, skipped: true, revision: remoteRevision };
          }

          const { skipWrite, payload } = params.buildNext(remoteData, exists);
          if (skipWrite) {
            return { committed: true, skipped: true, revision: remoteRevision };
          }

          const nextRevision = remoteRevision + 1;
          const updatedRecentOps = params.opId
            ? [...recentOpIds.filter(id => id !== params.opId), params.opId].slice(-MAX_RECENT_OP_IDS)
            : recentOpIds.slice(-MAX_RECENT_OP_IDS);

          const finalPayload: VersionedDocEnvelope = {
            ...payload,
            _revision: nextRevision,
            ...(params.opId ? { lastOpId: params.opId, recentOpIds: updatedRecentOps } : {})
          };

          validateDocumentSizeWithinLimit(params.docId, finalPayload);

          if (params.merge) {
            tx.set(docRef, finalPayload, { merge: true });
          } else {
            tx.set(docRef, finalPayload);
          }

          return { committed: true, skipped: false, revision: nextRevision };
        },
        { maxAttempts: 5 }
      ),
      timeoutMs,
      `CLOUD_TX_TIMEOUT_${params.docId}`
    );
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      handleFirestoreError(err, OperationType.WRITE, `${CLOUD_DOC_PATH.collection}/${params.docId}`);
    }
    throw err;
  }
};

/**
 * Transactional staff users & circles update against `institution_database/master_state`.
 * Merges incoming staff changes with the latest server document inside a Firestore transaction
 * so concurrent edits from Desktop, iPad, or Mobile never overwrite each other.
 */
export const pushStaffUsersToCloudDirect = async (
  usersList: any[],
  circlesList?: any[],
  deletedEntities?: any,
  settings?: any,
  opId = createOperationId('staff')
): Promise<void> => {
  return enqueueCloudWrite(async () => {
    await runServerDocTransaction({
      docId: CLOUD_DOC_PATH.id,
      opId,
      merge: true,
      timeoutMs: 15000,
      buildNext: (remoteData) => {
        const remoteRaw = remoteData || {};
        const remoteSettings = remoteRaw?.settings || {};

        const mergedDeleted = mergeDeletedEntities(remoteRaw._deletedEntities, deletedEntities);
        const deletedUserIds = Array.isArray(mergedDeleted.users)
          ? mergedDeleted.users.map(String)
          : [];

        const incomingSanitizedUsers = (Array.isArray(usersList) ? usersList : []).map(u => {
          const cleaned = { ...(u || {}) };
          delete cleaned.staffChatMessages;
          delete cleaned.deletedStaffChatIds;
          delete cleaned.pinnedStaffAnnouncement;
          return sanitizeStaffUserForFirestore(cleaned);
        });

        const mergedUsers = mergeArrayByKey(
          Array.isArray(remoteRaw.users) ? remoteRaw.users : [],
          incomingSanitizedUsers,
          'id',
          deletedUserIds
        ).map(sanitizeStaffUserForFirestore);

        const mergedCircles = Array.isArray(circlesList)
          ? mergeArrayByKey(
              Array.isArray(remoteRaw.circles) ? remoteRaw.circles : [],
              circlesList,
              'id',
              mergedDeleted.circles || []
            )
          : undefined;

        const sanitizedSettings =
          settings && typeof settings === 'object' ? sanitizeCloudState({ settings }).settings : null;

        const baseClean = deepCleanForFirestore({
          users: mergedUsers,
          ...(mergedCircles ? { circles: mergedCircles } : {}),
          _deletedEntities: mergedDeleted,
          lastSyncedAt: new Date().toISOString()
        });

        if (sanitizedSettings) {
          const cleanedSettingsFields: Record<string, any> = {};
          for (const [k, v] of Object.entries(sanitizedSettings)) {
            if (k === 'staffProfiles' || k === 'staffOperations') continue;
            if (
              (k === 'logoUrl' || k === 'sealImageUrl' || k === 'leaderSignatureUrl') &&
              remoteSettings[k] &&
              v === remoteSettings[k]
            ) {
              continue;
            }
            cleanedSettingsFields[k] = deepCleanForFirestore(v);
          }
          cleanedSettingsFields.staffProfiles = buildStaffProfilesPatch(
            deepCleanForFirestore(
              pruneDeadStaffProfiles(
                mergeStaffProfilesMap(
                  extractStaffProfilesFromUsers(mergedUsers),
                  remoteSettings.staffProfiles,
                  sanitizedSettings?.staffProfiles
                ),
                mergedUsers,
                deletedUserIds
              )
            ),
            remoteSettings.staffProfiles
          );
          if ('staffOperations' in remoteSettings) {
            cleanedSettingsFields.staffOperations = deleteField();
          }
          baseClean.settings = cleanedSettingsFields;
        }

        return {
          skipWrite: false,
          payload: baseClean
        };
      }
    });
  });
};

const arraysHaveSameIdsAndTimestamps = (a: any[], b: any[]): boolean => {
  if (a.length !== b.length) return false;
  if (a.length === 0) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
};

const syncDailyShards = async (
  incomingDaily: any[],
  legacyMasterDaily: any[],
  deletedIds: string[],
  isFullReplace: boolean,
  opId: string
): Promise<{ totalVerifiedCount: number; shardRevisions: Record<string, number> }> => {
  const incomingBuckets: Record<string, any[]> = {};
  const legacyBuckets: Record<string, any[]> = {};
  for (const shardId of DAILY_SHARD_DOC_IDS) {
    incomingBuckets[shardId] = [];
    legacyBuckets[shardId] = [];
  }
  for (const item of incomingDaily) {
    if (!item) continue;
    const shardId = getDailyRecordShardId(item);
    incomingBuckets[shardId].push(deepCleanForFirestore(item));
  }
  for (const item of legacyMasterDaily) {
    if (!item) continue;
    const shardId = getDailyRecordShardId(item);
    legacyBuckets[shardId].push(deepCleanForFirestore(item));
  }

  let totalVerifiedCount = 0;
  const shardRevisions: Record<string, number> = {};

  await Promise.all(
    DAILY_SHARD_DOC_IDS.map(async shardId => {
      const bucketIndex = Number(shardId.replace('shard_daily_', '')) || 0;
      const syncRes = await executeBoundedShardSync({
        baseShardId: shardId,
        shardType: 'dailyRecords',
        bucket: bucketIndex,
        opId: `${opId}_${shardId}`,
        incomingItems: incomingBuckets[shardId],
        deletedIds,
        replaceState: isFullReplace,
        maxBytesPerShard: SHARD_SAFE_BYTE_LIMIT,
        deduplicateAndMerge: (existingItems, incomingItems, delIds, replace) => {
          if (replace) {
            return deduplicateDailyRecords(incomingItems);
          }
          const mergedWithLegacy = mergeArrayByKey(existingItems, legacyBuckets[shardId], 'id', delIds);
          const merged = mergeArrayByKey(mergedWithLegacy, incomingItems, 'id', delIds);
          return deduplicateDailyRecords(merged);
        },
        readOverflowDoc: async docId => {
          const readRes = await readDocServerOnly(docId);
          return readRes.exists ? readRes.data : null;
        },
        runDocTransaction: txParams =>
          runServerDocTransaction({
            docId: txParams.docId,
            opId: txParams.opId,
            merge: false,
            timeoutMs: 15000,
            buildNext: txParams.buildNext
          })
      });

      totalVerifiedCount += syncRes.totalCount;
      Object.assign(shardRevisions, syncRes.writtenShardRevisions);
    })
  );

  return { totalVerifiedCount, shardRevisions };
};

const syncAttendanceShards = async (
  incomingAttendance: any[],
  legacyMasterAttendance: any[],
  deletedIds: string[],
  isFullReplace: boolean,
  opId: string
): Promise<{ totalVerifiedCount: number; shardRevisions: Record<string, number> }> => {
  const incomingBuckets: Record<string, any[]> = {};
  const legacyBuckets: Record<string, any[]> = {};
  for (const shardId of ATTENDANCE_SHARD_DOC_IDS) {
    incomingBuckets[shardId] = [];
    legacyBuckets[shardId] = [];
  }
  for (const item of incomingAttendance) {
    if (!item) continue;
    const shardId = getAttendanceRecordShardId(item);
    incomingBuckets[shardId].push(deepCleanForFirestore(item));
  }
  for (const item of legacyMasterAttendance) {
    if (!item) continue;
    const shardId = getAttendanceRecordShardId(item);
    legacyBuckets[shardId].push(deepCleanForFirestore(item));
  }

  let totalVerifiedCount = 0;
  const shardRevisions: Record<string, number> = {};

  await Promise.all(
    ATTENDANCE_SHARD_DOC_IDS.map(async shardId => {
      const bucketIndex = Number(shardId.replace('shard_attendance_', '')) || 0;
      const syncRes = await executeBoundedShardSync({
        baseShardId: shardId,
        shardType: 'attendanceRecords',
        bucket: bucketIndex,
        opId: `${opId}_${shardId}`,
        incomingItems: incomingBuckets[shardId],
        deletedIds,
        replaceState: isFullReplace,
        maxBytesPerShard: SHARD_SAFE_BYTE_LIMIT,
        deduplicateAndMerge: (existingItems, incomingItems, delIds, replace) => {
          if (replace) {
            return deduplicateAttendanceRecords(incomingItems);
          }
          const mergedWithLegacy = mergeArrayByKey(existingItems, legacyBuckets[shardId], 'id', delIds);
          const merged = mergeArrayByKey(mergedWithLegacy, incomingItems, 'id', delIds);
          return deduplicateAttendanceRecords(merged);
        },
        readOverflowDoc: async docId => {
          const readRes = await readDocServerOnly(docId);
          return readRes.exists ? readRes.data : null;
        },
        runDocTransaction: txParams =>
          runServerDocTransaction({
            docId: txParams.docId,
            opId: txParams.opId,
            merge: false,
            timeoutMs: 15000,
            buildNext: txParams.buildNext
          })
      });

      totalVerifiedCount += syncRes.totalCount;
      Object.assign(shardRevisions, syncRes.writtenShardRevisions);
    })
  );

  return { totalVerifiedCount, shardRevisions };
};

const syncSubmissionsShard = async (
  incomingAtqini: any[],
  incomingChallenges: any[],
  legacyMasterAtqini: any[],
  legacyMasterChallenges: any[],
  deletedEntities: Record<string, string[]>,
  isFullReplace: boolean,
  opId: string
): Promise<{ atqiniCount: number; challengesCount: number; revision: number }> => {
  let finalAtqiniCount = 0;
  let finalChallengesCount = 0;

  const txRes = await runServerDocTransaction({
    docId: SHARD_SUBMISSIONS_DOC_ID,
    opId: `${opId}_${SHARD_SUBMISSIONS_DOC_ID}`,
    merge: false,
    timeoutMs: 15000,
    buildNext: (remoteData, exists) => {
      const remoteAtqini: any[] = Array.isArray(remoteData?.studentAtqiniSubmissions)
        ? remoteData!.studentAtqiniSubmissions
        : [];
      const remoteChallenges: any[] = Array.isArray(remoteData?.studentChallengeSubmissions)
        ? remoteData!.studentChallengeSubmissions
        : [];

      const deletedAtqini = deletedEntities.studentAtqiniSubmissions || [];
      const deletedChallenges = deletedEntities.studentChallengeSubmissions || [];

      const nextAtqini = isFullReplace
        ? deduplicateAtqiniSubmissions(incomingAtqini)
        : deduplicateAtqiniSubmissions(
            mergeArrayByKey(
              mergeArrayByKey(remoteAtqini, legacyMasterAtqini, 'id', deletedAtqini),
              incomingAtqini,
              'id',
              deletedAtqini
            )
          );

      const nextChallenges = isFullReplace
        ? deduplicateChallengeSubmissions(incomingChallenges)
        : deduplicateChallengeSubmissions(
            mergeArrayByKey(
              mergeArrayByKey(remoteChallenges, legacyMasterChallenges, 'id', deletedChallenges),
              incomingChallenges,
              'id',
              deletedChallenges
            )
          );

      finalAtqiniCount = nextAtqini.length;
      finalChallengesCount = nextChallenges.length;

      const unchanged =
        exists &&
        !isFullReplace &&
        arraysHaveSameIdsAndTimestamps(remoteAtqini, nextAtqini) &&
        arraysHaveSameIdsAndTimestamps(remoteChallenges, nextChallenges);

      return {
        skipWrite: unchanged,
        payload: {
          users: [],
          shardType: 'submissions',
          studentAtqiniSubmissions: deepCleanForFirestore(nextAtqini),
          studentChallengeSubmissions: deepCleanForFirestore(nextChallenges),
          updatedAt: new Date().toISOString()
        }
      };
    }
  });

  return { atqiniCount: finalAtqiniCount, challengesCount: finalChallengesCount, revision: txRes.revision };
};

const syncSubscriptionsAndLogsShard = async (
  incomingSubs: any[],
  incomingLogs: any[],
  legacyMasterSubs: any[],
  legacyMasterLogs: any[],
  deletedEntities: Record<string, string[]>,
  isFullReplace: boolean,
  opId: string
): Promise<{ subsCount: number; logsCount: number; revision: number }> => {
  let finalSubsCount = 0;
  let finalLogsCount = 0;

  const txRes = await runServerDocTransaction({
    docId: SHARD_SUBSCRIPTIONS_LOGS_DOC_ID,
    opId: `${opId}_${SHARD_SUBSCRIPTIONS_LOGS_DOC_ID}`,
    merge: false,
    timeoutMs: 15000,
    buildNext: (remoteData, exists) => {
      const remoteSubs: any[] = Array.isArray(remoteData?.studentSubscriptions)
        ? remoteData!.studentSubscriptions
        : [];
      const remoteLogs: any[] = Array.isArray(remoteData?.auditLogs) ? remoteData!.auditLogs : [];

      const deletedSubs = deletedEntities.studentSubscriptions || [];
      const deletedLogs = deletedEntities.auditLogs || [];

      const nextSubs = isFullReplace
        ? deepCleanForFirestore(incomingSubs)
        : mergeArrayByKey(
            mergeArrayByKey(remoteSubs, legacyMasterSubs, 'id', deletedSubs),
            incomingSubs,
            'id',
            deletedSubs
          );

      const mergedLogs = isFullReplace
        ? [...incomingLogs]
        : mergeArrayByKey(
            mergeArrayByKey(remoteLogs, legacyMasterLogs, 'id', deletedLogs),
            incomingLogs,
            'id',
            deletedLogs
          );

      mergedLogs.sort(
        (a: any, b: any) => (Date.parse(b?.timestamp || '') || 0) - (Date.parse(a?.timestamp || '') || 0)
      );
      const nextLogs = mergedLogs.slice(0, MAX_AUDIT_LOGS_COUNT);

      finalSubsCount = nextSubs.length;
      finalLogsCount = nextLogs.length;

      const unchanged =
        exists &&
        !isFullReplace &&
        arraysHaveSameIdsAndTimestamps(remoteSubs, nextSubs) &&
        arraysHaveSameIdsAndTimestamps(remoteLogs, nextLogs);

      return {
        skipWrite: unchanged,
        payload: {
          users: [],
          shardType: 'subscriptionsAndLogs',
          studentSubscriptions: deepCleanForFirestore(nextSubs),
          auditLogs: deepCleanForFirestore(nextLogs),
          updatedAt: new Date().toISOString()
        }
      };
    }
  });

  return { subsCount: finalSubsCount, logsCount: finalLogsCount, revision: txRes.revision };
};

/**
 * Internal core executor for a single state push operation (`opId`).
 * Uses strict server reads (`readDocServerOnly`), per-document Firestore transactions (`runServerDocTransaction`),
 * dynamic overflow sharding (`executeBoundedShardSync`), `_replaceState` freshness validation, and a unified
 * generation manifest (`_syncGeneration`, `_shardRevisions`) across `master_state` and `Shards`.
 */
const executeCloudStatePushInternal = async (statePayload: any, opId: string): Promise<void> => {
  const isFullReplace = Boolean(statePayload?._replaceState);
  const changedKeys: string[] | null =
    !isFullReplace && Array.isArray(statePayload?._changedKeys) && statePayload._changedKeys.length > 0
      ? statePayload._changedKeys.map(String)
      : null;

  const isAllDocs = isFullReplace || !changedKeys || changedKeys.includes('__FULL__');
  const keySet = new Set(changedKeys || []);
  if (keySet.has('staffOperations')) keySet.add('settings');

  const incomingClean = { ...(statePayload || {}) };
  delete incomingClean._changedKeys;
  delete incomingClean._opId;

  // Strictly read master_state from the live server (never from stale cache!)
  const masterRead = await readDocServerOnly(CLOUD_DOC_PATH.id);
  assertServerReadForWrite(CLOUD_DOC_PATH.id, masterRead);
  const remoteRaw: Record<string, any> = masterRead.data || {};

  // Validate _replaceState freshness BEFORE modifying any shards so a stale local tab cannot wipe newer server shards
  if (isFullReplace) {
    validateReplaceStateFreshness(remoteRaw, incomingClean);
  }

  const mergedDeletedEntities = isFullReplace
    ? incomingClean._deletedEntities || {}
    : mergeDeletedEntities(remoteRaw._deletedEntities, incomingClean._deletedEntities);

  const needsDaily = isAllDocs || keySet.has('dailyRecords') || Array.isArray(remoteRaw.dailyRecords);
  const needsAttendance =
    isAllDocs || keySet.has('attendanceRecords') || Array.isArray(remoteRaw.attendanceRecords);
  const needsSubmissions =
    isAllDocs ||
    keySet.has('studentAtqiniSubmissions') ||
    keySet.has('studentChallengeSubmissions') ||
    Array.isArray(remoteRaw.studentAtqiniSubmissions) ||
    Array.isArray(remoteRaw.studentChallengeSubmissions);
  const needsSubsLogs =
    isAllDocs ||
    keySet.has('studentSubscriptions') ||
    keySet.has('auditLogs') ||
    Array.isArray(remoteRaw.studentSubscriptions) ||
    Array.isArray(remoteRaw.auditLogs);

  let verifiedDailyShardCount = -1;
  let verifiedAttendanceShardCount = -1;
  let verifiedAtqiniShardCount = -1;
  let verifiedChallengesShardCount = -1;
  let verifiedSubsShardCount = -1;
  let verifiedLogsShardCount = -1;
  const updatedShardRevisions: Record<string, number> = {};

  const shardWrites: Promise<void>[] = [];
  if (needsDaily) {
    shardWrites.push(
      syncDailyShards(
        Array.isArray(incomingClean.dailyRecords) ? incomingClean.dailyRecords : [],
        Array.isArray(remoteRaw.dailyRecords) ? remoteRaw.dailyRecords : [],
        mergedDeletedEntities.dailyRecords || [],
        isFullReplace,
        opId
      ).then(({ totalVerifiedCount, shardRevisions }) => {
        verifiedDailyShardCount = totalVerifiedCount;
        Object.assign(updatedShardRevisions, shardRevisions);
      })
    );
  }
  if (needsAttendance) {
    shardWrites.push(
      syncAttendanceShards(
        Array.isArray(incomingClean.attendanceRecords) ? incomingClean.attendanceRecords : [],
        Array.isArray(remoteRaw.attendanceRecords) ? remoteRaw.attendanceRecords : [],
        mergedDeletedEntities.attendanceRecords || [],
        isFullReplace,
        opId
      ).then(({ totalVerifiedCount, shardRevisions }) => {
        verifiedAttendanceShardCount = totalVerifiedCount;
        Object.assign(updatedShardRevisions, shardRevisions);
      })
    );
  }
  if (needsSubmissions) {
    shardWrites.push(
      syncSubmissionsShard(
        Array.isArray(incomingClean.studentAtqiniSubmissions) ? incomingClean.studentAtqiniSubmissions : [],
        Array.isArray(incomingClean.studentChallengeSubmissions) ? incomingClean.studentChallengeSubmissions : [],
        Array.isArray(remoteRaw.studentAtqiniSubmissions) ? remoteRaw.studentAtqiniSubmissions : [],
        Array.isArray(remoteRaw.studentChallengeSubmissions) ? remoteRaw.studentChallengeSubmissions : [],
        mergedDeletedEntities,
        isFullReplace,
        opId
      ).then(({ atqiniCount, challengesCount, revision }) => {
        verifiedAtqiniShardCount = atqiniCount;
        verifiedChallengesShardCount = challengesCount;
        updatedShardRevisions[SHARD_SUBMISSIONS_DOC_ID] = revision;
      })
    );
  }
  if (needsSubsLogs) {
    shardWrites.push(
      syncSubscriptionsAndLogsShard(
        Array.isArray(incomingClean.studentSubscriptions) ? incomingClean.studentSubscriptions : [],
        Array.isArray(incomingClean.auditLogs) ? incomingClean.auditLogs : [],
        Array.isArray(remoteRaw.studentSubscriptions) ? remoteRaw.studentSubscriptions : [],
        Array.isArray(remoteRaw.auditLogs) ? remoteRaw.auditLogs : [],
        mergedDeletedEntities,
        isFullReplace,
        opId
      ).then(({ subsCount, logsCount, revision }) => {
        verifiedSubsShardCount = subsCount;
        verifiedLogsShardCount = logsCount;
        updatedShardRevisions[SHARD_SUBSCRIPTIONS_LOGS_DOC_ID] = revision;
      })
    );
  }

  if (shardWrites.length > 0) {
    await Promise.all(shardWrites);
  }

  const hasLegacyFieldsOnMaster =
    'dailyRecords' in remoteRaw ||
    'attendanceRecords' in remoteRaw ||
    'studentAtqiniSubmissions' in remoteRaw ||
    'studentChallengeSubmissions' in remoteRaw ||
    'studentSubscriptions' in remoteRaw ||
    'auditLogs' in remoteRaw ||
    'staffOperations' in remoteRaw ||
    'staffChatMessages' in remoteRaw ||
    'deletedStaffChatIds' in remoteRaw ||
    'pinnedStaffAnnouncement' in remoteRaw ||
    'staffAttendanceRecords' in remoteRaw ||
    Boolean(remoteRaw?.settings && 'staffOperations' in remoteRaw.settings);

  const hasShardRevisionUpdates = Object.keys(updatedShardRevisions).length > 0;
  const hasCoreChanges =
    isAllDocs ||
    hasShardRevisionUpdates ||
    keySet.has('_deletedEntities') ||
    Array.from(keySet).some(k => !SHARDED_COLLECTION_KEYS.has(k));

  if (!hasCoreChanges && !hasLegacyFieldsOnMaster) {
    return;
  }

  // Commit master_state inside an atomic Firestore Server Transaction with _syncGeneration & _shardRevisions
  await runServerDocTransaction({
    docId: CLOUD_DOC_PATH.id,
    opId: `${opId}_master`,
    merge: !isFullReplace,
    timeoutMs: 15000,
    buildNext: latestRemoteData => {
      const latestRemote = latestRemoteData || {};
      const cleanedCore = buildMergedCorePayload(latestRemote, incomingClean);
      const mergedShardRevisions: Record<string, number> = {
        ...(latestRemote._shardRevisions && typeof latestRemote._shardRevisions === 'object'
          ? latestRemote._shardRevisions
          : {}),
        ...updatedShardRevisions
      };

      if (isFullReplace) {
        return {
          skipWrite: false,
          payload: {
            ...cleanedCore,
            _syncGeneration: opId,
            _shardRevisions: mergedShardRevisions
          }
        };
      }

      let masterWritePayload: Record<string, any>;
      if (!isAllDocs && changedKeys) {
        masterWritePayload = {
          lastSyncedAt: cleanedCore.lastSyncedAt,
          _syncGeneration: opId,
          ...(Object.keys(mergedShardRevisions).length > 0
            ? { _shardRevisions: mergedShardRevisions }
            : {})
        };
        if (keySet.has('_deletedEntities') || Object.keys(incomingClean._deletedEntities || {}).length > 0) {
          if (cleanedCore._deletedEntities) {
            masterWritePayload._deletedEntities = cleanedCore._deletedEntities;
          }
        }

        for (const k of keySet) {
          if (
            k === 'staffOperations' ||
            k === 'lastSyncedAt' ||
            k === '_deletedEntities' ||
            SHARDED_COLLECTION_KEYS.has(k)
          ) {
            continue;
          }
          if (k === 'settings' && cleanedCore.settings && typeof cleanedCore.settings === 'object') {
            const nextSettingsPatch: Record<string, any> = { ...cleanedCore.settings };
            for (const imgField of ['logoUrl', 'sealImageUrl', 'leaderSignatureUrl']) {
              if (
                latestRemote?.settings?.[imgField] &&
                nextSettingsPatch[imgField] === latestRemote.settings[imgField]
              ) {
                delete nextSettingsPatch[imgField];
              }
            }
            nextSettingsPatch.staffProfiles = buildStaffProfilesPatch(
              cleanedCore.settings.staffProfiles || {},
              latestRemote?.settings?.staffProfiles
            );
            if (latestRemote?.settings && 'staffOperations' in latestRemote.settings) {
              nextSettingsPatch.staffOperations = deleteField();
            }
            masterWritePayload.settings = nextSettingsPatch;
          } else if (cleanedCore[k] !== undefined) {
            masterWritePayload[k] = cleanedCore[k];
          }
        }
      } else {
        masterWritePayload = {
          ...cleanedCore,
          _syncGeneration: opId,
          ...(Object.keys(mergedShardRevisions).length > 0
            ? { _shardRevisions: mergedShardRevisions }
            : {}),
          settings: {
            ...(cleanedCore.settings || {}),
            staffProfiles: buildStaffProfilesPatch(
              cleanedCore.settings?.staffProfiles || {},
              latestRemote?.settings?.staffProfiles
            ),
            ...(latestRemote?.settings && 'staffOperations' in latestRemote.settings
              ? { staffOperations: deleteField() }
              : {})
          }
        };
      }

      // Only clean legacy sharded arrays from master_state AFTER verifying their target shards committed
      // at least as many deduplicated records as existed on master_state (Section 6 safety rule)
      if (
        needsDaily &&
        'dailyRecords' in latestRemote &&
        verifiedDailyShardCount >=
          deduplicateDailyRecords(Array.isArray(latestRemote.dailyRecords) ? latestRemote.dailyRecords : []).length
      ) {
        masterWritePayload.dailyRecords = deleteField();
      }
      if (
        needsAttendance &&
        'attendanceRecords' in latestRemote &&
        verifiedAttendanceShardCount >=
          deduplicateAttendanceRecords(
            Array.isArray(latestRemote.attendanceRecords) ? latestRemote.attendanceRecords : []
          ).length
      ) {
        masterWritePayload.attendanceRecords = deleteField();
      }
      if (
        needsSubmissions &&
        'studentAtqiniSubmissions' in latestRemote &&
        verifiedAtqiniShardCount >=
          deduplicateAtqiniSubmissions(
            Array.isArray(latestRemote.studentAtqiniSubmissions) ? latestRemote.studentAtqiniSubmissions : []
          ).length
      ) {
        masterWritePayload.studentAtqiniSubmissions = deleteField();
      }
      if (
        needsSubmissions &&
        'studentChallengeSubmissions' in latestRemote &&
        verifiedChallengesShardCount >=
          deduplicateChallengeSubmissions(
            Array.isArray(latestRemote.studentChallengeSubmissions)
              ? latestRemote.studentChallengeSubmissions
              : []
          ).length
      ) {
        masterWritePayload.studentChallengeSubmissions = deleteField();
      }
      if (
        needsSubsLogs &&
        'studentSubscriptions' in latestRemote &&
        verifiedSubsShardCount >=
          (Array.isArray(latestRemote.studentSubscriptions) ? latestRemote.studentSubscriptions.length : 0)
      ) {
        masterWritePayload.studentSubscriptions = deleteField();
      }
      if (needsSubsLogs && 'auditLogs' in latestRemote && verifiedLogsShardCount >= 0) {
        masterWritePayload.auditLogs = deleteField();
      }
      if ('staffOperations' in latestRemote) masterWritePayload.staffOperations = deleteField();
      if ('staffChatMessages' in latestRemote) masterWritePayload.staffChatMessages = deleteField();
      if ('deletedStaffChatIds' in latestRemote) masterWritePayload.deletedStaffChatIds = deleteField();
      if ('pinnedStaffAnnouncement' in latestRemote) masterWritePayload.pinnedStaffAnnouncement = deleteField();
      if ('staffAttendanceRecords' in latestRemote) masterWritePayload.staffAttendanceRecords = deleteField();

      return {
        skipWrite: false,
        payload: masterWritePayload
      };
    }
  });
};

/**
 * Explicit, callable entrypoint for running a safe, idempotent, deep-content-verified migration
 * of legacy sharded arrays from `master_state` to shard documents using `executeSafeLegacyShardMigration`.
 * Never auto-executes on production; must be explicitly invoked when administrative migration is requested.
 */
export const runSafeCloudShardMigration = async (options?: {
  cleanupLegacyAfterVerification?: boolean;
  checkpoint?: MigrationCheckpoint | null;
}): Promise<{ report: ShardMigrationReport; checkpoint: MigrationCheckpoint }> => {
  return enqueueCloudWrite(async () => {
    return await executeSafeLegacyShardMigration({
      checkpoint: options?.checkpoint ?? null,
      cleanupLegacyAfterVerification: options?.cleanupLegacyAfterVerification ?? false,
      adapter: {
        async readAllDocs() {
          const baseIds = [CLOUD_DOC_PATH.id, ...ALL_SHARD_DOC_IDS];
          const results = await Promise.all(
            baseIds.map(async id => ({
              id,
              res: await readDocServerThenCache(id, true, false)
            }))
          );
          if (results.some(r => r.res.readError || !r.res.fromServer)) {
            return { completeRead: false, docs: {} };
          }
          const docs: Record<string, Record<string, any> | null> = {};
          for (const r of results) {
            docs[r.id] = r.res.exists ? r.res.data : null;
          }

          // Also read any referenced dynamic overflow shards
          const overflowIds = extractReferencedOverflowShardIds(docs);
          if (overflowIds.length > 0) {
            const ovResults = await Promise.all(
              overflowIds.map(async id => ({
                id,
                res: await readDocServerThenCache(id, true, false)
              }))
            );
            if (ovResults.some(r => r.res.readError || !r.res.fromServer)) {
              return { completeRead: false, docs: {} };
            }
            for (const r of ovResults) {
              docs[r.id] = r.res.exists ? r.res.data : null;
            }
          }

          return { completeRead: true, docs };
        },
        async writeDoc(docId: string, data: Record<string, any>) {
          await runServerDocTransaction({
            docId,
            opId: createOperationId(`mig_${docId}`),
            merge: false,
            timeoutMs: 15000,
            buildNext: () => ({
              skipWrite: false,
              payload: deepCleanForFirestore(data)
            })
          });
        }
      }
    });
  });
};

/**
 * Flushes any queued offline operations from `pendingSyncQueue` in FIFO order once online.
 */
export const flushPendingCloudQueue = async (): Promise<{
  flushedCount: number;
  remainingCount: number;
  errors: string[];
}> => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      flushedCount: 0,
      remainingCount: pendingSyncQueue.size(),
      errors: ['OFFLINE']
    };
  }
  await pendingSyncQueue.hydrateFromDurableStorage();
  if (pendingSyncQueue.size() === 0) {
    return { flushedCount: 0, remainingCount: 0, errors: [] };
  }

  return enqueueCloudWrite(async () => {
    return await pendingSyncQueue.flush(async (op: PendingSyncOperation) => {
      await executeCloudStatePushInternal(
        {
          ...op.payload,
          ...(op.isFullReplace ? { _replaceState: true } : { _changedKeys: op.changedKeys })
        },
        op.opId
      );
    });
  });
};

/**
 * Merges and persists changed portions of the application state into Firestore's sharded
 * `institution_database` documents (`master_state` + scoped shard docs) using server-verified
 * transactions and a durable offline-first Pending Sync Queue (localStorage + IndexedDB fallback).
 * An operation is ONLY marked `queuedOffline: true` after durable persistence succeeds.
 */
export const pushStateToCloud = async (
  statePayload: any
): Promise<{ cloudSynced: boolean; queuedOffline: boolean; opId: string }> => {
  const opId: string =
    typeof statePayload?._opId === 'string' && statePayload._opId
      ? statePayload._opId
      : createOperationId('sync');

  const isFullReplace = Boolean(statePayload?._replaceState);
  const changedKeys: string[] =
    !isFullReplace && Array.isArray(statePayload?._changedKeys) && statePayload._changedKeys.length > 0
      ? statePayload._changedKeys.map(String)
      : ['__FULL__'];

  // Extract only the changed collections for a compact pending queue entry
  const buildQueueSnapshot = () => {
    if (isFullReplace || changedKeys.includes('__FULL__')) {
      const fullCopy = { ...(statePayload || {}) };
      delete fullCopy._changedKeys;
      delete fullCopy._opId;
      return fullCopy;
    }
    const partial: Record<string, any> = {
      _deletedEntities: statePayload?._deletedEntities || {}
    };
    for (const k of changedKeys) {
      if (statePayload && k in statePayload) {
        partial[k] = statePayload[k];
      }
    }
    return partial;
  };

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    await pendingSyncQueue.enqueueDurable({
      opId,
      changedKeys,
      isFullReplace,
      payload: buildQueueSnapshot()
    });
    return {
      cloudSynced: false,
      queuedOffline: true,
      opId
    };
  }

  return enqueueCloudWrite(async () => {
    try {
      await pendingSyncQueue.hydrateFromDurableStorage();
      // First flush any earlier queued operations in causal FIFO order
      if (pendingSyncQueue.size() > 0) {
        const flushRes = await pendingSyncQueue.flush(async (queuedOp: PendingSyncOperation) => {
          await executeCloudStatePushInternal(
            {
              ...queuedOp.payload,
              ...(queuedOp.isFullReplace
                ? { _replaceState: true }
                : { _changedKeys: queuedOp.changedKeys })
            },
            queuedOp.opId
          );
        });
        if (flushRes.remainingCount > 0) {
          // Queue still blocked by error; durably enqueue current operation after existing queue
          await pendingSyncQueue.enqueueDurable({
            opId,
            changedKeys,
            isFullReplace,
            payload: buildQueueSnapshot()
          });
          return {
            cloudSynced: false,
            queuedOffline: true,
            opId
          };
        }
      }

      await executeCloudStatePushInternal(statePayload, opId);
      pendingSyncQueue.markSuccess(opId);
      return {
        cloudSynced: true,
        queuedOffline: false,
        opId
      };
    } catch (err) {
      if (err instanceof StaleReplaceStateError) {
        throw err;
      }
      if (isTransientOrOfflineError(err)) {
        await pendingSyncQueue.enqueueDurable({
          opId,
          changedKeys,
          isFullReplace,
          payload: buildQueueSnapshot()
        });
        return {
          cloudSynced: false,
          queuedOffline: true,
          opId
        };
      }
      throw err;
    }
  });
};
