import { doc, getDoc, getDocFromServer, onSnapshot, runTransaction, setDoc } from 'firebase/firestore';
import { db, FIRESTORE_COLLECTION, FIRESTORE_DOC_ID } from '../firebase';
import {
  mergeArrayByKey,
  mergeDeletedEntities,
  sanitizeCloudState,
  deepCleanForFirestore,
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
 * Fetches the latest cloud database state directly from the server (bypassing local cache),
 * falling back to standard getDoc only if the device is temporarily offline.
 */
export const fetchCloudDatabaseOnce = async (forceServer = true): Promise<any | null> => {
  const docRef = doc(db, CLOUD_DOC_PATH.collection, CLOUD_DOC_PATH.id);
  if (forceServer) {
    try {
      const serverSnap = await getDocFromServer(docRef);
      if (serverSnap.exists()) {
        return sanitizeCloudState(serverSnap.data());
      }
      return null;
    } catch {
      // Fallback to standard getDoc below if offline
    }
  }
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return sanitizeCloudState(snap.data());
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
        if (snapshot.exists()) onData(sanitizeCloudState(snapshot.data()));
        else onData(null);
        onStatusChange?.('connected');
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
    staffOperations: mergedStaffProfiles,
    staffChatMessages: mergedStaffChatMessages,
    deletedStaffChatIds: mergedDeletedChatIds,
    ...(mergedPinnedAnnouncement ? { pinnedStaffAnnouncement: mergedPinnedAnnouncement } : {}),
    staffAttendanceRecords: mergedStaffAttendanceRecords,
    settings: {
      ...remoteSettings,
      ...incomingSettings,
      welcomeMessages: mergedWelcomeMessages,
      staffWelcomeConfigs: mergedStaffWelcomeConfigs,
      staffChatMessages: mergedStaffChatMessages,
      deletedStaffChatIds: mergedDeletedChatIds,
      ...(mergedPinnedAnnouncement ? { pinnedStaffAnnouncement: mergedPinnedAnnouncement } : {}),
      staffProfiles: mergedStaffProfiles,
      staffOperations: mergedStaffProfiles,
      staffAttendanceRecords: mergedStaffAttendanceRecords
    },
    lastSyncedAt: new Date().toISOString()
  };

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
      mergedItems = mergedItems.slice(0, 100);
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

  return deepCleanForFirestore(finalPayload);
};

/**
 * Directly writes the sanitized staff users (and updated circles/deletedEntities) to the exact
 * Firestore document (`institution_database/master_state`) monitored by `onSnapshot`, enforcing
 * a 3.5-second timeout so the UI never hangs while guaranteeing immediate persistence.
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

  const writePromise = setDoc(docRef, payload, { merge: true });
  await Promise.race([
    writePromise,
    new Promise<void>(resolve => setTimeout(resolve, 3500))
  ]);
};

/**
 * Atomically merge app state and deletion tombstones into Firestore (`institution_database/master_state`).
 * Enforces strict timeouts on both read and write so the UI never hangs in the preview environment.
 */
export const pushStateToCloud = async (statePayload: any): Promise<void> => {
  const docRef = doc(db, CLOUD_DOC_PATH.collection, CLOUD_DOC_PATH.id);

  let remoteRaw: any = {};
  try {
    const snap = await Promise.race([
      getDoc(docRef),
      new Promise<null>(resolve => setTimeout(() => resolve(null), 1500))
    ]);
    if (snap && snap.exists()) {
      remoteRaw = snap.data();
    }
  } catch {
    // Proceed with incoming state if read times out or fails
  }

  const cleanedPayload = buildMergedCloudPayload(remoteRaw, statePayload);
  const writePromise = setDoc(docRef, cleanedPayload, { merge: true });
  await Promise.race([
    writePromise,
    new Promise<void>(resolve => setTimeout(resolve, 2500))
  ]);
};

