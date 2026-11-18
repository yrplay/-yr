import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  onSnapshot,
  setDoc
} from 'firebase/firestore';
import { auth, db, FIRESTORE_COLLECTION, FIRESTORE_DOC_ID } from '../firebase';
import {
  ALL_SHARD_DOC_IDS,
  ATTENDANCE_SHARD_DOC_IDS,
  DAILY_SHARD_DOC_IDS,
  SHARDED_COLLECTION_KEYS,
  SHARD_SUBMISSIONS_DOC_ID,
  SHARD_SUBSCRIPTIONS_LOGS_DOC_ID,
  assembleShardedCloudState,
  deepCleanForFirestore,
  deduplicateAtqiniSubmissions,
  deduplicateAttendanceRecords,
  deduplicateChallengeSubmissions,
  deduplicateDailyRecords,
  getAttendanceRecordShardId,
  getDailyRecordShardId,
  mergeArrayByKey,
  mergeDeletedEntities,
  pruneDeadStaffProfiles,
  sanitizeCloudState,
  sanitizeStaffUserForFirestore
} from './cloudSyncHelpers';
import {
  extractStaffProfilesFromUsers,
  filterAndSortActiveStaffChatMessages,
  mergeStaffAttendanceMap,
  mergeStaffProfilesMap
} from '../utils/staffHelpers';

export type CloudSyncStatus = 'connected' | 'syncing' | 'offline' | 'error';

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

// Serialized async write mutex prevents concurrent UI actions in the same client
// from racing against each other or causing Firestore transaction contention.
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

const readDocServerThenCache = async (
  docId: string,
  forceServer: boolean
): Promise<{ exists: boolean; data: Record<string, any> | null; fromServer: boolean }> => {
  const ref = doc(db, CLOUD_DOC_PATH.collection, docId);
  if (forceServer) {
    try {
      const serverSnap = await withRejectingTimeout(
        getDocFromServer(ref),
        8000,
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
      // Fallback to cache below when offline or transiently unreachable
    }
  }

  try {
    const cacheSnap = await getDoc(ref);
    return {
      exists: cacheSnap.exists(),
      data: cacheSnap.exists() ? (cacheSnap.data() as Record<string, any>) : null,
      fromServer: false
    };
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      handleFirestoreError(err, OperationType.GET, `${CLOUD_DOC_PATH.collection}/${docId}`);
    }
    return { exists: false, data: null, fromServer: false };
  }
};

/**
 * Fetches the latest cloud database state (`master_state` + all shard documents)
 * directly from the server in parallel, falling back cleanly to local cache if offline.
 */
export const fetchCloudDatabaseOnce = async (forceServer = true): Promise<any | null> => {
  try {
    const docIds = [CLOUD_DOC_PATH.id, ...ALL_SHARD_DOC_IDS];
    const results = await Promise.all(
      docIds.map(async id => ({
        id,
        res: await readDocServerThenCache(id, forceServer)
      }))
    );

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

    const assembled = assembleShardedCloudState(masterEntry.res.data, shardsById);
    if (!assembled) return null;
    return await reconcileAuthorizedStaffUsers(assembled);
  } catch (err) {
    console.warn('Initial cloud database fetch notice:', err);
    return null;
  }
};

export const subscribeToCloudDatabase = (
  onData: (data: any) => void,
  onStatusChange?: (status: CloudSyncStatus) => void
) => {
  const watchedDocIds = [CLOUD_DOC_PATH.id, ...ALL_SHARD_DOC_IDS];
  const docDataById: Record<string, Record<string, any> | null> = {};
  const docMetaById: Record<string, { loaded: boolean; fromCache: boolean; hasPendingWrites: boolean }> = {};
  let emitTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const computeCombinedStatus = (): CloudSyncStatus => {
    const metas = Object.values(docMetaById);
    if (metas.some(m => m.hasPendingWrites || m.fromCache)) return 'syncing';
    return 'connected';
  };

  const scheduleEmit = () => {
    if (disposed) return;
    if (!docMetaById[CLOUD_DOC_PATH.id]?.loaded) return;

    if (emitTimer) clearTimeout(emitTimer);
    emitTimer = setTimeout(() => {
      if (disposed) return;
      const masterRaw = docDataById[CLOUD_DOC_PATH.id];
      if (!masterRaw) {
        onData(null);
        onStatusChange?.(computeCombinedStatus());
        return;
      }

      const shardsById: Record<string, Record<string, any> | null> = {};
      for (const id of ALL_SHARD_DOC_IDS) {
        shardsById[id] = docDataById[id] || null;
      }

      const assembled = assembleShardedCloudState(masterRaw, shardsById);
      if (!assembled) {
        onData(null);
        onStatusChange?.(computeCombinedStatus());
        return;
      }

      const masterFromCache = Boolean(docMetaById[CLOUD_DOC_PATH.id]?.fromCache);
      if (!masterFromCache) {
        void reconcileAuthorizedStaffUsers(assembled).then(reconciled => {
          if (!disposed) {
            onData(reconciled);
            onStatusChange?.(computeCombinedStatus());
          }
        });
      } else {
        onData(assembled);
        onStatusChange?.(computeCombinedStatus());
      }
    }, 60);
  };

  try {
    const unsubscribes = watchedDocIds.map(docId => {
      const docRef = doc(db, CLOUD_DOC_PATH.collection, docId);
      return onSnapshot(
        docRef,
        { includeMetadataChanges: true },
        snapshot => {
          docMetaById[docId] = {
            loaded: true,
            fromCache: snapshot.metadata.fromCache,
            hasPendingWrites: snapshot.metadata.hasPendingWrites
          };

          if (snapshot.metadata.hasPendingWrites) {
            onStatusChange?.('syncing');
            return;
          }

          docDataById[docId] = snapshot.exists()
            ? (snapshot.data() as Record<string, any>)
            : null;
          scheduleEmit();
        },
        error => {
          console.warn(`Firebase sync listener error (${docId}):`, error);
          if (isPermissionDeniedError(error)) {
            onStatusChange?.('error');
          } else if (docId === CLOUD_DOC_PATH.id) {
            onStatusChange?.('error');
          }
        }
      );
    });

    return () => {
      disposed = true;
      if (emitTimer) clearTimeout(emitTimer);
      unsubscribes.forEach(unsub => {
        try {
          unsub();
        } catch {
          // ignore
        }
      });
    };
  } catch (error) {
    console.warn('Failed to subscribe to cloud database:', error);
    onStatusChange?.('offline');
    return () => {};
  }
};

const buildMergedCorePayload = (remoteRaw: any, statePayload: any): Record<string, any> => {
  const remoteData = sanitizeCloudState(remoteRaw || {});
  const incomingState = sanitizeCloudState(statePayload);

  if (incomingState._replaceState === true) {
    const replacement = { ...incomingState };
    delete replacement._replaceState;
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

const safeSetDoc = async (docId: string, data: Record<string, any>, merge = false, timeoutMs = 12000) => {
  const docRef = doc(db, CLOUD_DOC_PATH.collection, docId);
  try {
    await withRejectingTimeout(
      merge ? setDoc(docRef, data, { merge: true }) : setDoc(docRef, data),
      timeoutMs,
      `CLOUD_WRITE_TIMEOUT_${docId}`
    );
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      handleFirestoreError(err, OperationType.WRITE, `${CLOUD_DOC_PATH.collection}/${docId}`);
    }
    throw err;
  }
};

/**
 * Directly writes sanitized staff users (and updated circles/deletedEntities/settings) to
 * `institution_database/master_state` through the serialized write queue so rapid edits
 * from Desktop, iPad, or Mobile never race or fail with transaction contention.
 */
export const pushStaffUsersToCloudDirect = async (
  usersList: any[],
  circlesList?: any[],
  deletedEntities?: any,
  settings?: any
): Promise<void> => {
  return enqueueCloudWrite(async () => {
    const masterSnap = await readDocServerThenCache(CLOUD_DOC_PATH.id, true);
    const remoteRaw = masterSnap.data || {};
    const remoteSettings = remoteRaw?.settings || {};

    const sanitizedUsers = (Array.isArray(usersList) ? usersList : []).map(u => {
      const cleaned = { ...(u || {}) };
      delete cleaned.staffChatMessages;
      delete cleaned.deletedStaffChatIds;
      delete cleaned.pinnedStaffAnnouncement;
      return sanitizeStaffUserForFirestore(cleaned);
    });

    const sanitizedSettings =
      settings && typeof settings === 'object' ? sanitizeCloudState({ settings }).settings : null;

    const deletedUserIds = Array.isArray(deletedEntities?.users)
      ? deletedEntities.users.map(String)
      : Array.isArray(remoteRaw?._deletedEntities?.users)
      ? remoteRaw._deletedEntities.users.map(String)
      : [];

    let settingsPatch: Record<string, any> | undefined;
    if (sanitizedSettings) {
      const nextSettingsPatch: Record<string, any> = { ...sanitizedSettings };
      delete nextSettingsPatch.staffOperations;
      for (const imgField of ['logoUrl', 'sealImageUrl', 'leaderSignatureUrl']) {
        if (remoteSettings[imgField] && nextSettingsPatch[imgField] === remoteSettings[imgField]) {
          delete nextSettingsPatch[imgField];
        }
      }
      const prunedProfiles = pruneDeadStaffProfiles(
        mergeStaffProfilesMap(
          extractStaffProfilesFromUsers(sanitizedUsers),
          remoteSettings.staffProfiles,
          nextSettingsPatch.staffProfiles
        ),
        sanitizedUsers,
        deletedUserIds
      );
      nextSettingsPatch.staffProfiles = buildStaffProfilesPatch(
        prunedProfiles,
        remoteSettings.staffProfiles
      );
      if ('staffOperations' in remoteSettings) {
        nextSettingsPatch.staffOperations = deleteField();
      }
      settingsPatch = nextSettingsPatch;
    }

    const baseClean = deepCleanForFirestore({
      users: sanitizedUsers,
      ...(Array.isArray(circlesList) ? { circles: circlesList } : {}),
      ...(deletedEntities && typeof deletedEntities === 'object' ? { _deletedEntities: deletedEntities } : {}),
      lastSyncedAt: new Date().toISOString()
    });

    if (settingsPatch) {
      // Preserve deleteField() markers inside settingsPatch cleanly
      const cleanedSettingsFields: Record<string, any> = {};
      for (const [k, v] of Object.entries(settingsPatch)) {
        if (k === 'staffProfiles' || k === 'staffOperations') continue;
        cleanedSettingsFields[k] = deepCleanForFirestore(v);
      }
      cleanedSettingsFields.staffProfiles = buildStaffProfilesPatch(
        deepCleanForFirestore(
          pruneDeadStaffProfiles(
            mergeStaffProfilesMap(
              extractStaffProfilesFromUsers(sanitizedUsers),
              remoteSettings.staffProfiles,
              sanitizedSettings?.staffProfiles
            ),
            sanitizedUsers,
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

    await safeSetDoc(CLOUD_DOC_PATH.id, baseClean, true, 12000);
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
  isFullReplace: boolean
): Promise<void> => {
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

  const remoteShards = await Promise.all(
    DAILY_SHARD_DOC_IDS.map(async shardId => ({
      shardId,
      snap: await readDocServerThenCache(shardId, !isFullReplace)
    }))
  );

  const nowIso = new Date().toISOString();
  await Promise.all(
    remoteShards.map(async ({ shardId, snap }) => {
      const remoteItems: any[] = Array.isArray(snap.data?.items) ? snap.data!.items : [];
      const bucketIndex = Number(shardId.replace('shard_daily_', '')) || 0;

      let nextItems: any[];
      if (isFullReplace) {
        nextItems = deduplicateDailyRecords(incomingBuckets[shardId]);
      } else {
        const mergedWithLegacy = mergeArrayByKey(
          remoteItems,
          legacyBuckets[shardId],
          'id',
          deletedIds
        );
        const merged = mergeArrayByKey(
          mergedWithLegacy,
          incomingBuckets[shardId],
          'id',
          deletedIds
        );
        nextItems = deduplicateDailyRecords(merged);
      }

      if (snap.exists && !isFullReplace && arraysHaveSameIdsAndTimestamps(remoteItems, nextItems)) {
        return;
      }

      await safeSetDoc(
        shardId,
        {
          users: [],
          shardType: 'dailyRecords',
          bucket: bucketIndex,
          items: deepCleanForFirestore(nextItems),
          updatedAt: nowIso
        },
        false,
        12000
      );
    })
  );
};

const syncAttendanceShards = async (
  incomingAttendance: any[],
  legacyMasterAttendance: any[],
  deletedIds: string[],
  isFullReplace: boolean
): Promise<void> => {
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

  const remoteShards = await Promise.all(
    ATTENDANCE_SHARD_DOC_IDS.map(async shardId => ({
      shardId,
      snap: await readDocServerThenCache(shardId, !isFullReplace)
    }))
  );

  const nowIso = new Date().toISOString();
  await Promise.all(
    remoteShards.map(async ({ shardId, snap }) => {
      const remoteItems: any[] = Array.isArray(snap.data?.items) ? snap.data!.items : [];
      const bucketIndex = Number(shardId.replace('shard_attendance_', '')) || 0;

      let nextItems: any[];
      if (isFullReplace) {
        nextItems = deduplicateAttendanceRecords(incomingBuckets[shardId]);
      } else {
        const mergedWithLegacy = mergeArrayByKey(
          remoteItems,
          legacyBuckets[shardId],
          'id',
          deletedIds
        );
        const merged = mergeArrayByKey(
          mergedWithLegacy,
          incomingBuckets[shardId],
          'id',
          deletedIds
        );
        nextItems = deduplicateAttendanceRecords(merged);
      }

      if (snap.exists && !isFullReplace && arraysHaveSameIdsAndTimestamps(remoteItems, nextItems)) {
        return;
      }

      await safeSetDoc(
        shardId,
        {
          users: [],
          shardType: 'attendanceRecords',
          bucket: bucketIndex,
          items: deepCleanForFirestore(nextItems),
          updatedAt: nowIso
        },
        false,
        12000
      );
    })
  );
};

const syncSubmissionsShard = async (
  incomingAtqini: any[],
  incomingChallenges: any[],
  legacyMasterAtqini: any[],
  legacyMasterChallenges: any[],
  deletedEntities: Record<string, string[]>,
  isFullReplace: boolean
): Promise<void> => {
  const snap = await readDocServerThenCache(SHARD_SUBMISSIONS_DOC_ID, !isFullReplace);
  const remoteAtqini: any[] = Array.isArray(snap.data?.studentAtqiniSubmissions)
    ? snap.data!.studentAtqiniSubmissions
    : [];
  const remoteChallenges: any[] = Array.isArray(snap.data?.studentChallengeSubmissions)
    ? snap.data!.studentChallengeSubmissions
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

  if (
    snap.exists &&
    !isFullReplace &&
    arraysHaveSameIdsAndTimestamps(remoteAtqini, nextAtqini) &&
    arraysHaveSameIdsAndTimestamps(remoteChallenges, nextChallenges)
  ) {
    return;
  }

  await safeSetDoc(
    SHARD_SUBMISSIONS_DOC_ID,
    {
      users: [],
      shardType: 'submissions',
      studentAtqiniSubmissions: deepCleanForFirestore(nextAtqini),
      studentChallengeSubmissions: deepCleanForFirestore(nextChallenges),
      updatedAt: new Date().toISOString()
    },
    false,
    12000
  );
};

const syncSubscriptionsAndLogsShard = async (
  incomingSubs: any[],
  incomingLogs: any[],
  legacyMasterSubs: any[],
  legacyMasterLogs: any[],
  deletedEntities: Record<string, string[]>,
  isFullReplace: boolean
): Promise<void> => {
  const snap = await readDocServerThenCache(SHARD_SUBSCRIPTIONS_LOGS_DOC_ID, !isFullReplace);
  const remoteSubs: any[] = Array.isArray(snap.data?.studentSubscriptions)
    ? snap.data!.studentSubscriptions
    : [];
  const remoteLogs: any[] = Array.isArray(snap.data?.auditLogs) ? snap.data!.auditLogs : [];

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
  const nextLogs = mergedLogs.slice(0, 60);

  if (
    snap.exists &&
    !isFullReplace &&
    arraysHaveSameIdsAndTimestamps(remoteSubs, nextSubs) &&
    arraysHaveSameIdsAndTimestamps(remoteLogs, nextLogs)
  ) {
    return;
  }

  await safeSetDoc(
    SHARD_SUBSCRIPTIONS_LOGS_DOC_ID,
    {
      users: [],
      shardType: 'subscriptionsAndLogs',
      studentSubscriptions: deepCleanForFirestore(nextSubs),
      auditLogs: deepCleanForFirestore(nextLogs),
      updatedAt: new Date().toISOString()
    },
    false,
    12000
  );
};

/**
 * Merges and persists changed portions of the application state into Firestore's sharded
 * `institution_database` documents (`master_state` + scoped shard docs), keeping `master_state`
 * lightweight (~75 KB) and eliminating 1 MiB ceiling and transaction contention failures.
 */
export const pushStateToCloud = async (statePayload: any): Promise<void> => {
  return enqueueCloudWrite(async () => {
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

    const masterRead = await readDocServerThenCache(CLOUD_DOC_PATH.id, true);
    const remoteRaw: Record<string, any> = masterRead.data || {};
    const isOfflineNow = typeof navigator !== 'undefined' && navigator.onLine === false;

    // Safety guard: never overwrite an unknown server doc against `{}` on slow online timeout
    if (!isFullReplace && !masterRead.exists && !masterRead.fromServer && !isOfflineNow) {
      throw new Error('CLOUD_MASTER_STATE_UNREACHABLE');
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

    const shardWrites: Promise<void>[] = [];
    if (needsDaily) {
      shardWrites.push(
        syncDailyShards(
          Array.isArray(incomingClean.dailyRecords) ? incomingClean.dailyRecords : [],
          Array.isArray(remoteRaw.dailyRecords) ? remoteRaw.dailyRecords : [],
          mergedDeletedEntities.dailyRecords || [],
          isFullReplace
        )
      );
    }
    if (needsAttendance) {
      shardWrites.push(
        syncAttendanceShards(
          Array.isArray(incomingClean.attendanceRecords) ? incomingClean.attendanceRecords : [],
          Array.isArray(remoteRaw.attendanceRecords) ? remoteRaw.attendanceRecords : [],
          mergedDeletedEntities.attendanceRecords || [],
          isFullReplace
        )
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
          isFullReplace
        )
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
          isFullReplace
        )
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

    const hasCoreChanges =
      isAllDocs ||
      keySet.has('_deletedEntities') ||
      Array.from(keySet).some(k => !SHARDED_COLLECTION_KEYS.has(k));

    if (!hasCoreChanges && !hasLegacyFieldsOnMaster) {
      return;
    }

    const cleanedCore = buildMergedCorePayload(remoteRaw, incomingClean);

    let masterWritePayload: Record<string, any>;
    if (!isAllDocs && changedKeys) {
      masterWritePayload = { lastSyncedAt: cleanedCore.lastSyncedAt };
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
            if (remoteRaw?.settings?.[imgField] && nextSettingsPatch[imgField] === remoteRaw.settings[imgField]) {
              delete nextSettingsPatch[imgField];
            }
          }
          nextSettingsPatch.staffProfiles = buildStaffProfilesPatch(
            cleanedCore.settings.staffProfiles || {},
            remoteRaw?.settings?.staffProfiles
          );
          if (remoteRaw?.settings && 'staffOperations' in remoteRaw.settings) {
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
        settings: {
          ...(cleanedCore.settings || {}),
          staffProfiles: buildStaffProfilesPatch(
            cleanedCore.settings?.staffProfiles || {},
            remoteRaw?.settings?.staffProfiles
          ),
          ...(remoteRaw?.settings && 'staffOperations' in remoteRaw.settings
            ? { staffOperations: deleteField() }
            : {})
        }
      };
    }

    // Delete any legacy sharded or bloat fields from master_state now that their shards are synced
    if (needsDaily && 'dailyRecords' in remoteRaw) masterWritePayload.dailyRecords = deleteField();
    if (needsAttendance && 'attendanceRecords' in remoteRaw) masterWritePayload.attendanceRecords = deleteField();
    if (needsSubmissions && 'studentAtqiniSubmissions' in remoteRaw) {
      masterWritePayload.studentAtqiniSubmissions = deleteField();
    }
    if (needsSubmissions && 'studentChallengeSubmissions' in remoteRaw) {
      masterWritePayload.studentChallengeSubmissions = deleteField();
    }
    if (needsSubsLogs && 'studentSubscriptions' in remoteRaw) {
      masterWritePayload.studentSubscriptions = deleteField();
    }
    if (needsSubsLogs && 'auditLogs' in remoteRaw) masterWritePayload.auditLogs = deleteField();
    if ('staffOperations' in remoteRaw) masterWritePayload.staffOperations = deleteField();
    if ('staffChatMessages' in remoteRaw) masterWritePayload.staffChatMessages = deleteField();
    if ('deletedStaffChatIds' in remoteRaw) masterWritePayload.deletedStaffChatIds = deleteField();
    if ('pinnedStaffAnnouncement' in remoteRaw) masterWritePayload.pinnedStaffAnnouncement = deleteField();
    if ('staffAttendanceRecords' in remoteRaw) masterWritePayload.staffAttendanceRecords = deleteField();
    if (!isFullReplace && remoteRaw?.settings && 'staffOperations' in remoteRaw.settings && !masterWritePayload.settings) {
      masterWritePayload.settings = { staffOperations: deleteField() };
    }

    await safeSetDoc(CLOUD_DOC_PATH.id, masterWritePayload, !isFullReplace, 15000);
  });
};
