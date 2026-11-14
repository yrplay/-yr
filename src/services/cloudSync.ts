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

  for (const [collection, key] of ARRAY_COLLECTIONS) {
    let mergedItems = mergeArrayByKey(
      remoteData[collection] || [],
      incomingState[collection] || [],
      key,
      deletedEntities[collection] || []
    );
    if (collection === 'users') {
      mergedItems = mergedItems.map((u: any) => {
        if (!u || !u.id) return u;
        const profileCfg = mergedStaffProfiles[u.id];
        const isAdminRecord =
          u.role === 'owner' || u.role === 'leader' || u.role === 'developer';
        const withSharedChat = isAdminRecord
          ? {
              ...u,
              staffChatMessages: mergedStaffChatMessages,
              deletedStaffChatIds: mergedDeletedChatIds,
              ...(mergedPinnedAnnouncement
                ? { pinnedStaffAnnouncement: mergedPinnedAnnouncement }
                : {})
            }
          : u;
        const mergedUser = !profileCfg
          ? withSharedChat
          : {
              ...withSharedChat,
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
 * Atomically merge app state and deletion tombstones into Firestore (`institution_database/master_state`).
 * If `runTransaction` times out or encounters contention in the preview environment, falls back immediately
 * to `setDoc(..., { merge: true })` so the staff list and cloud state are always persisted directly.
 */
export const pushStateToCloud = async (statePayload: any): Promise<void> => {
  const docRef = doc(db, CLOUD_DOC_PATH.collection, CLOUD_DOC_PATH.id);

  try {
    await Promise.race([
      runTransaction(db, async transaction => {
        const currentSnap = await transaction.get(docRef);
        const remoteRaw = currentSnap.exists() ? currentSnap.data() : {};
        const cleanedPayload = buildMergedCloudPayload(remoteRaw, statePayload);
        transaction.set(docRef, cleanedPayload);
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TRANSACTION_TIMEOUT')), 4500)
      )
    ]);
  } catch (txErr) {
    // Fallback to direct merged setDoc on the exact same Firestore document so preview hiccups never block saving
    let remoteRaw: any = {};
    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        remoteRaw = snap.data();
      }
    } catch {
      // proceed with incoming state if read fails
    }
    const cleanedPayload = buildMergedCloudPayload(remoteRaw, statePayload);
    await setDoc(docRef, cleanedPayload, { merge: true });
  }
};
