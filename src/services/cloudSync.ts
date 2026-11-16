import { collection, deleteField, doc, getDoc, getDocFromServer, getDocs, onSnapshot, setDoc } from 'firebase/firestore';
import { db, FIRESTORE_COLLECTION, FIRESTORE_DOC_ID } from '../firebase';
import {
  mergeArrayByKey,
  mergeDeletedEntities,
  sanitizeCloudState,
  deepCleanForFirestore,
  pruneDeadStaffProfiles,
  sanitizeStaffUserForFirestore,
  deduplicateAtqiniSubmissions,
  deduplicateChallengeSubmissions,
  deduplicateAttendanceRecords,
  deduplicateDailyRecords
} from './cloudSyncHelpers';
import {
  extractStaffProfilesFromUsers,
  filterAndSortActiveStaffChatMessages,
  mergeStaffAttendanceMap,
  mergeStaffProfilesMap
} from '../utils/staffHelpers';

export type CloudSyncStatus = 'connected' | 'syncing' | 'offline' | 'error';

const CLOUD_DOC_PATH = { collection: FIRESTORE_COLLECTION, id: FIRESTORE_DOC_ID };

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
    authSnap.forEach((docSnap) => {
      const d = docSnap.data();
      if (!d || d.active === false || !d.staffId) return;
      const staffId = String(d.staffId);
      if (deletedUsers.has(staffId)) return;
      const cleanEmail = String(d.email || docSnap.id || '').trim().toLowerCase();
      const role = d.role || 'teacher';

      const alreadyExists = users.some(
        (u) =>
          u &&
          (String(u.id) === staffId ||
            (u.role === role && cleanEmail && String(u.email || '').trim().toLowerCase() === cleanEmail))
      );
      if (alreadyExists) return;

      const linkedCircleIds = circles
        .filter((c) => c && (c.teacherId === staffId || c.supervisorId === staffId))
        .map((c) => c.id);

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
 * Fetches the latest cloud database state directly from the server (bypassing local cache),
 * falling back to standard getDoc only if the device is temporarily offline.
 */
export const fetchCloudDatabaseOnce = async (forceServer = true): Promise<any | null> => {
  const docRef = doc(db, CLOUD_DOC_PATH.collection, CLOUD_DOC_PATH.id);
  if (forceServer) {
    try {
      const serverSnap = await getDocFromServer(docRef);
      if (serverSnap.exists()) {
        const sanitized = sanitizeCloudState(serverSnap.data());
        return await reconcileAuthorizedStaffUsers(sanitized);
      }
      return null;
    } catch {
      // Fallback to standard getDoc below if offline
    }
  }
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const sanitized = sanitizeCloudState(snap.data());
      return await reconcileAuthorizedStaffUsers(sanitized);
    }
  } catch (err) {
    console.warn('Initial cloud database fetch notice:', err);
  }
  return null;
};

export const subscribeToCloudDatabase = (
  onData: (data: any) => void,
  onStatusChange?: (status: CloudSyncStatus) => void
) => {
  try {
    const docRef = doc(db, CLOUD_DOC_PATH.collection, CLOUD_DOC_PATH.id);
    return onSnapshot(
      docRef,
      { includeMetadataChanges: true },
      snapshot => {
        // Skip local pending-write echoes so optimistic UI edits don't feed stale cache back into state
        if (snapshot.metadata.hasPendingWrites) {
          onStatusChange?.('syncing');
          return;
        }
        if (snapshot.exists()) {
          const sanitized = sanitizeCloudState(snapshot.data());
          if (!snapshot.metadata.fromCache) {
            void reconcileAuthorizedStaffUsers(sanitized).then(reconciled => {
              onData(reconciled);
            });
          } else {
            onData(sanitized);
          }
        } else {
          onData(null);
        }
        onStatusChange?.(snapshot.metadata.fromCache ? 'syncing' : 'connected');
      },
      error => {
        console.warn('Firebase sync listener error:', error);
        onStatusChange?.('error');
      }
    );
  } catch (error) {
    console.warn('Failed to subscribe to cloud database:', error);
    onStatusChange?.('offline');
    return () => {};
  }
};

const ARRAY_COLLECTIONS: Array<[string, string]> = [
  ['users', 'id'], ['tracks', 'id'], ['circles', 'id'], ['students', 'id'],
  ['monthlyPlans', 'id'], ['studentPlans', 'id'], ['dailyRecords', 'id'],
  ['attendanceRecords', 'id'], ['atqiniAssignments', 'id'],
  ['studentAtqiniSubmissions', 'id'], ['challenges', 'id'],
  ['studentChallengeSubmissions', 'id'], ['monthlyExams', 'id'],
  ['studentExamResults', 'id'], ['studentSubscriptions', 'id'],
  ['gradingConfigs', 'trackId'], ['auditLogs', 'id']
];

const buildMergedCloudPayload = (remoteRaw: any, statePayload: any): Record<string, any> => {
  const remoteData = sanitizeCloudState(remoteRaw || {});
  const incomingState = sanitizeCloudState(statePayload);
  if (incomingState._replaceState === true) {
    const replacement = { ...incomingState };
    delete replacement._replaceState;
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
    const exTime = exCfg ? (Date.parse(exCfg.updatedAt || '') || 0) : -1;
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
    ...new Set([
      ...(Array.isArray(remoteData.deletedStaffChatIds) ? remoteData.deletedStaffChatIds : []),
      ...(Array.isArray(incomingState.deletedStaffChatIds) ? incomingState.deletedStaffChatIds : []),
      ...(Array.isArray(remoteSettings.deletedStaffChatIds) ? remoteSettings.deletedStaffChatIds : []),
      ...(Array.isArray(incomingSettings.deletedStaffChatIds) ? incomingSettings.deletedStaffChatIds : []),
      ...userDeletedChatIds
    ].map(String))
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

  // Remove redundant top-level/duplicate bloat fields from the cloud payload
  delete finalPayload.staffOperations;
  delete finalPayload.staffChatMessages;
  delete finalPayload.deletedStaffChatIds;
  delete finalPayload.pinnedStaffAnnouncement;
  delete finalPayload.staffAttendanceRecords;
  delete finalPayload.settings.staffOperations;

  const FAKE_DEMO_IDS = new Set(['u-1', 'u-2', 'u-3', 'u-4', 'u-5', 'u-leader']);
  const FAKE_DEMO_EMAILS = new Set([
    'rifa@ghaym.org',
    'khadija@ghaym.org',
    'maryam@ghaym.org',
    'fatima@ghaym.org',
    'hind@ghaym.org',
    'leader@ghaym.org'
  ]);

  for (const [collection, key] of ARRAY_COLLECTIONS) {
    let mergedItems = mergeArrayByKey(
      remoteData[collection] || [],
      incomingState[collection] || [],
      key,
      deletedEntities[collection] || []
    );
    if (collection === 'users') {
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
    } else if (collection === 'auditLogs') {
      mergedItems.sort(
        (a: any, b: any) => (Date.parse(b?.timestamp || '') || 0) - (Date.parse(a?.timestamp || '') || 0)
      );
      mergedItems = mergedItems.slice(0, 60);
    } else if (collection === 'studentAtqiniSubmissions') {
      mergedItems = deduplicateAtqiniSubmissions(mergedItems);
    } else if (collection === 'studentChallengeSubmissions') {
      mergedItems = deduplicateChallengeSubmissions(mergedItems);
    } else if (collection === 'attendanceRecords') {
      mergedItems = deduplicateAttendanceRecords(mergedItems);
    } else if (collection === 'dailyRecords') {
      mergedItems = deduplicateDailyRecords(mergedItems);
    }
    finalPayload[collection] = mergedItems;
  }

  if (!Array.isArray(finalPayload.users)) {
    finalPayload.users = [];
  }

  // Prune dead/deleted user keys from staffProfiles so Firestore doc never accumulates orphan profiles
  finalPayload.settings.staffProfiles = pruneDeadStaffProfiles(
    mergedStaffProfiles,
    finalPayload.users,
    deletedEntities.users || []
  );

  return deepCleanForFirestore(finalPayload);
};

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

/**
 * Directly writes the sanitized staff users (and updated circles/deletedEntities) to the exact
 * Firestore document (`institution_database/master_state`) monitored by `onSnapshot`, waiting for
 * real server/SDK confirmation with a rejecting timeout so errors are never silently swallowed.
 */
export const pushStaffUsersToCloudDirect = async (
  usersList: any[],
  circlesList?: any[],
  deletedEntities?: any
): Promise<void> => {
  const docRef = doc(db, CLOUD_DOC_PATH.collection, CLOUD_DOC_PATH.id);
  const sanitizedUsers = (Array.isArray(usersList) ? usersList : []).map(u => {
    const cleaned = { ...(u || {}) };
    delete cleaned.staffChatMessages;
    delete cleaned.deletedStaffChatIds;
    delete cleaned.pinnedStaffAnnouncement;
    return sanitizeStaffUserForFirestore(cleaned);
  });

  const payload = deepCleanForFirestore({
    users: sanitizedUsers,
    ...(Array.isArray(circlesList) ? { circles: circlesList } : {}),
    ...(deletedEntities && typeof deletedEntities === 'object' ? { _deletedEntities: deletedEntities } : {}),
    lastSyncedAt: new Date().toISOString()
  });

  await withRejectingTimeout(setDoc(docRef, payload, { merge: true }), 12000, 'CLOUD_STAFF_WRITE_TIMEOUT');
};

/**
 * Atomically merge app state and deletion tombstones into Firestore (`institution_database/master_state`).
 * Reads server state first (with local cache fallback ONLY if server is unreachable) and never merges
 * against an empty `{}` object on timeout, so slow mobile connections never overwrite newer desktop edits.
 */
export const pushStateToCloud = async (statePayload: any): Promise<void> => {
  const docRef = doc(db, CLOUD_DOC_PATH.collection, CLOUD_DOC_PATH.id);

  let snap: any = null;
  try {
    snap = await withRejectingTimeout(getDocFromServer(docRef), 5000, 'SERVER_READ_TIMEOUT');
  } catch {
    try {
      snap = await withRejectingTimeout(getDoc(docRef), 3000, 'CACHE_READ_TIMEOUT');
    } catch {
      throw new Error('CLOUD_SYNC_READ_FAILED');
    }
  }

  const remoteRaw: any = snap && snap.exists() ? snap.data() : {};
  const isFullReplace = Boolean(statePayload?._replaceState);
  const changedKeys: string[] | null =
    !isFullReplace && Array.isArray(statePayload?._changedKeys) && statePayload._changedKeys.length > 0
      ? statePayload._changedKeys.map(String)
      : null;

  const incomingClean = { ...(statePayload || {}) };
  delete incomingClean._changedKeys;

  const cleanedPayload = buildMergedCloudPayload(remoteRaw, incomingClean);

  let writePayload: Record<string, any>;
  if (changedKeys && !changedKeys.includes('__FULL__')) {
    writePayload = {
      lastSyncedAt: cleanedPayload.lastSyncedAt
    };
    const keySet = new Set(changedKeys);
    if (keySet.has('staffOperations')) keySet.add('settings');
    if (keySet.has('_deletedEntities') || Object.keys(incomingClean._deletedEntities || {}).length > 0) {
      if (cleanedPayload._deletedEntities) {
        writePayload._deletedEntities = cleanedPayload._deletedEntities;
      }
    }
    for (const k of keySet) {
      if (k === 'staffOperations' || k === 'lastSyncedAt' || k === '_deletedEntities') continue;
      if (k === 'settings' && cleanedPayload.settings && typeof cleanedPayload.settings === 'object') {
        const nextSettingsPatch = { ...cleanedPayload.settings };
        // Omit unchanged heavy data-URL images when merging settings
        for (const imgField of ['logoUrl', 'sealImageUrl', 'leaderSignatureUrl']) {
          if (
            remoteRaw?.settings?.[imgField] &&
            nextSettingsPatch[imgField] === remoteRaw.settings[imgField]
          ) {
            delete nextSettingsPatch[imgField];
          }
        }
        if (remoteRaw?.settings && 'staffOperations' in remoteRaw.settings) {
          nextSettingsPatch.staffOperations = deleteField();
        }
        writePayload.settings = nextSettingsPatch;
      } else if (cleanedPayload[k] !== undefined) {
        writePayload[k] = cleanedPayload[k];
      }
    }
  } else {
    writePayload = {
      ...cleanedPayload,
      ...(remoteRaw && 'staffOperations' in remoteRaw ? { staffOperations: deleteField() } : {}),
      ...(remoteRaw && 'staffChatMessages' in remoteRaw ? { staffChatMessages: deleteField() } : {}),
      ...(remoteRaw && 'deletedStaffChatIds' in remoteRaw ? { deletedStaffChatIds: deleteField() } : {}),
      ...(remoteRaw && 'pinnedStaffAnnouncement' in remoteRaw ? { pinnedStaffAnnouncement: deleteField() } : {}),
      ...(remoteRaw && 'staffAttendanceRecords' in remoteRaw ? { staffAttendanceRecords: deleteField() } : {}),
      settings: {
        ...(cleanedPayload.settings || {}),
        ...(remoteRaw?.settings && 'staffOperations' in remoteRaw.settings
          ? { staffOperations: deleteField() }
          : {})
      }
    };
  }

  await withRejectingTimeout(setDoc(docRef, writePayload, { merge: true }), 15000, 'CLOUD_WRITE_TIMEOUT');
};

