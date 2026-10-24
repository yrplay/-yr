import { db, doc, setDoc, onSnapshot, FIRESTORE_COLLECTION, FIRESTORE_DOC_ID } from '../firebase';

export type CloudSyncStatus = 'connected' | 'syncing' | 'offline' | 'error';

// Central Firestore document reference
const getCentralDocRef = () => doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC_ID);

/**
 * Listen to real-time updates from Firebase Firestore
 */
export function subscribeToCloudDatabase(
  onData: (data: any) => void,
  onStatusChange: (status: CloudSyncStatus, errorMsg?: string) => void
) {
  try {
    const docRef = getCentralDocRef();
    onStatusChange('syncing');

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          onData(data);
          onStatusChange('connected');
        } else {
          // Document does not exist yet on cloud, signal that we need initial upload
          onStatusChange('connected');
        }
      },
      (error) => {
        console.warn('Firestore cloud sync listener error:', error);
        onStatusChange('offline', error.message);
      }
    );

    return unsubscribe;
  } catch (err: any) {
    console.warn('Failed to subscribe to Firestore:', err);
    onStatusChange('offline', err?.message);
    return () => {};
  }
}

/**
 * Save updated state directly to Firebase Firestore for instant multi-device sync
 */
export async function pushStateToCloud(payload: any): Promise<boolean> {
  try {
    const docRef = getCentralDocRef();
    // Clean payload to prevent undefined fields in Firestore
    const cleanPayload = JSON.parse(JSON.stringify({
      ...payload,
      _lastUpdatedCloud: new Date().toISOString()
    }));
    await setDoc(docRef, cleanPayload, { merge: true });
    return true;
  } catch (err) {
    console.warn('Failed to push state to Firestore:', err);
    return false;
  }
}
