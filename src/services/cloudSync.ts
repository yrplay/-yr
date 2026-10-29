import { doc, onSnapshot, runTransaction } from 'firebase/firestore';
import { db, FIRESTORE_COLLECTION, FIRESTORE_DOC_ID } from '../firebase';
import { mergeArrayByKey, mergeDeletedEntities, sanitizeCloudState, type DeletedEntities } from './cloudSyncHelpers';

export type CloudSyncStatus = 'connected' | 'syncing' | 'offline' | 'error';

const CLOUD_DOC_PATH = { collection: FIRESTORE_COLLECTION, id: FIRESTORE_DOC_ID };

export const subscribeToCloudDatabase = (
  onData: (data: any) => void,
  onStatusChange?: (status: CloudSyncStatus) => void
) => {
  try {
    const docRef = doc(db, CLOUD_DOC_PATH.collection, CLOUD_DOC_PATH.id);
    return onSnapshot(
      docRef,
      snapshot => {
        if (snapshot.exists()) onData(sanitizeCloudState(snapshot.data()));
        onStatusChange?.('connected');
      },
      error => {
        console.warn('Firebase sync listener error:', error);
        onStatusChange?.('offline');
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
    const finalPayload: Record<string, any> = {
      ...remoteData,
      ...incomingState,
      _deletedEntities: deletedEntities,
      settings: { ...(remoteData.settings || {}), ...(incomingState.settings || {}) },
      lastSyncedAt: new Date().toISOString()
    };

    for (const [collection, key] of arrayCollections) {
      finalPayload[collection] = mergeArrayByKey(
        remoteData[collection] || [],
        incomingState[collection] || [],
        key,
        deletedEntities[collection] || []
      );
    }

    transaction.set(docRef, finalPayload);
  });
};
