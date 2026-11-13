import { doc, getDoc, getDocFromServer, onSnapshot, runTransaction } from 'firebase/firestore';
import { db, FIRESTORE_COLLECTION, FIRESTORE_DOC_ID } from '../firebase';
import {
  mergeArrayByKey,
  mergeDeletedEntities,
  sanitizeCloudState,
  deduplicateAtqiniSubmissions,
  deduplicateChallengeSubmissions,
  deduplicateAttendanceRecords,
  deduplicateDailyRecords
} from './cloudSyncHelpers';
import {
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

/**
 * Atomically merge app state and deletion tombstones. Transactions prevent two
 * clients from both reading the same old document and silently overwriting one
 * another's merge. Tombstones remain until all clients can safely be reconciled.
 */
export const pushStateToCloud = async (statePayload: any): Promise<void> => {
  const docRef = doc(db, CLOUD_DOC_PATH.collection, CLOUD_DOC_PATH.id);
  const arrayCollections: Array<[string, string]> = [
    ['users', 'id'], ['tracks', 'id'], ['circles', 'id'], ['students', 'id'],
    ['monthlyPlans', 'id'], ['studentPlans', 'id'], ['dailyRecords', 'id'],
    ['attendanceRecords', 'id'], ['atqiniAssignments', 'id'],
    ['studentAtqiniSubmissions', 'id'], ['challenges', 'id'],
    ['studentChallengeSubmissions', 'id'], ['monthlyExams', 'id'],
    ['studentExamResults', 'id'], ['studentSubscriptions', 'id'],
    ['gradingConfigs', 'trackId'], ['auditLogs', 'id']
  ];

  await runTransaction(db, async transaction => {
    const currentSnap = await transaction.get(docRef);
    const remoteData = sanitizeCloudState(currentSnap.exists() ? currentSnap.data() : {});
    const incomingState = sanitizeCloudState(statePayload);
    if (incomingState._replaceState === true) {
      const replacement = { ...incomingState };
      delete replacement._replaceState;
      transaction.set(docRef, { ...replacement, lastSyncedAt: new Date().toISOString() });
      return;
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

    const mergedDeletedChatIds = [
      ...new Set([
        ...(Array.isArray(remoteSettings.deletedStaffChatIds) ? remoteSettings.deletedStaffChatIds : []),
        ...(Array.isArray(incomingSettings.deletedStaffChatIds) ? incomingSettings.deletedStaffChatIds : [])
      ].map(String))
    ];

    const mergedStaffChatMessages = filterAndSortActiveStaffChatMessages(
      [
        ...(Array.isArray(remoteSettings.staffChatMessages) ? remoteSettings.staffChatMessages : []),
        ...(Array.isArray(incomingSettings.staffChatMessages) ? incomingSettings.staffChatMessages : [])
      ],
      mergedDeletedChatIds
    );

    const remotePin = remoteSettings.pinnedStaffAnnouncement;
    const incomingPin = incomingSettings.pinnedStaffAnnouncement;
    const mergedPinnedAnnouncement =
      remotePin && incomingPin
        ? (incomingPin.updatedAt || 0) >= (remotePin.updatedAt || 0)
          ? incomingPin
          : remotePin
        : incomingPin || remotePin;

    // Timestamp-aware merge for staff workingHours, tasks, monthlySalary, and leaderPrivateNotes
    const mergedStaffProfiles = mergeStaffProfilesMap(
      remoteData.staffOperations,
      remoteSettings.staffProfiles,
      remoteSettings.staffOperations,
      incomingState.staffOperations,
      incomingSettings.staffProfiles,
      incomingSettings.staffOperations
    );

    const mergedStaffAttendanceRecords = mergeStaffAttendanceMap(
      remoteSettings.staffAttendanceRecords,
      incomingSettings.staffAttendanceRecords
    );

    const finalPayload: Record<string, any> = {
      ...remoteData,
      ...incomingState,
      _deletedEntities: deletedEntities,
      staffOperations: mergedStaffProfiles,
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

    for (const [collection, key] of arrayCollections) {
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
          if (!profileCfg) return u;
          const profileTime = Date.parse(profileCfg.updatedAt || '') || 0;
          const userTime = Date.parse(u.updatedAt || '') || 0;
          if (profileTime >= userTime) {
            return {
              ...u,
              ...(profileCfg.workingHours !== undefined ? { workingHours: profileCfg.workingHours } : {}),
              ...(profileCfg.monthlySalary !== undefined ? { monthlySalary: profileCfg.monthlySalary } : {}),
              ...(profileCfg.tasks !== undefined ? { tasks: profileCfg.tasks } : {}),
              ...(profileCfg.leaderPrivateNotes !== undefined
                ? { leaderPrivateNotes: profileCfg.leaderPrivateNotes }
                : {}),
              updatedAt: profileCfg.updatedAt || u.updatedAt
            };
          }
          return u;
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

    transaction.set(docRef, finalPayload);
  });
};
