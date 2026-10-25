import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export type CloudSyncStatus = 'connected' | 'syncing' | 'offline' | 'error';

const CLOUD_DOC_PATH = {
  collection: 'institution_database',
  id: 'master_state'
};

// دمج السجلات مع تفادي مسح مدخلات المعلمات المتزامنة
const mergeArrayByKey = (existingList: any[] = [], incomingList: any[] = [], key: string = 'id') => {
  const map = new Map<string, any>();
  
  for (const item of existingList) {
    if (item && item[key]) {
      map.set(item[key], item);
    }
  }

  for (const item of incomingList) {
    if (!item || !item[key]) continue;
    const existing = map.get(item[key]);
    if (!existing) {
      map.set(item[key], item);
    } else {
      // تفضيل السجل الأحدث زمنياً إذا توفر الطابع الزمني
      const existingTime = existing.recordedAt || existing.updatedAt || existing.evaluatedAt || 0;
      const incomingTime = item.recordedAt || item.updatedAt || item.evaluatedAt || 0;
      
      const t1 = typeof existingTime === 'string' ? new Date(existingTime).getTime() : 0;
      const t2 = typeof incomingTime === 'string' ? new Date(incomingTime).getTime() : 0;
      
      map.set(item[key], t2 >= t1 ? { ...existing, ...item } : { ...item, ...existing });
    }
  }

  return Array.from(map.values());
};

/**
 * الاشتراك في تحديثات قاعدة البيانات السحابية لحظياً
 */
export const subscribeToCloudDatabase = (
  onData: (data: any) => void,
  onStatusChange?: (status: CloudSyncStatus) => void
) => {
  try {
    const docRef = doc(db, CLOUD_DOC_PATH.collection, CLOUD_DOC_PATH.id);

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const cloudData = snapshot.data();
          onData(cloudData);
          if (onStatusChange) onStatusChange('connected');
        } else {
          // الوثيقة غير موجودة في السحابة
          if (onStatusChange) onStatusChange('connected');
        }
      },
      (error) => {
        console.warn('Firebase sync listener error:', error);
        if (onStatusChange) onStatusChange('offline');
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('Failed to subscribe to cloud database:', err);
    if (onStatusChange) onStatusChange('offline');
    return () => {};
  }
};

/**
 * رفع الحالة وتحديث السجلات في Firestore بأمان ودون محو سجلات الآخرين
 */
export const pushStateToCloud = async (statePayload: any): Promise<void> => {
  try {
    const docRef = doc(db, CLOUD_DOC_PATH.collection, CLOUD_DOC_PATH.id);
    
    // جلب أحدث نسخة موجودة بالسحابة لدمجها بدلاً من استبدالها
    const currentSnap = await getDoc(docRef);
    let finalPayload = { ...statePayload };

    if (currentSnap.exists()) {
      const remoteData = currentSnap.data();

      finalPayload = {
        ...remoteData,
        ...statePayload,
        // دمج السجلات الحيوية دون إقصاء أي تسجيل متزامن
        dailyRecords: mergeArrayByKey(remoteData.dailyRecords, statePayload.dailyRecords, 'id'),
        attendanceRecords: mergeArrayByKey(remoteData.attendanceRecords, statePayload.attendanceRecords, 'id'),
        studentPlans: mergeArrayByKey(remoteData.studentPlans, statePayload.studentPlans, 'id'),
        studentExamResults: mergeArrayByKey(remoteData.studentExamResults, statePayload.studentExamResults, 'id'),
        studentAtqiniSubmissions: mergeArrayByKey(remoteData.studentAtqiniSubmissions, statePayload.studentAtqiniSubmissions, 'id'),
        studentChallengeSubmissions: mergeArrayByKey(remoteData.studentChallengeSubmissions, statePayload.studentChallengeSubmissions, 'id'),
        gradingConfigs: mergeArrayByKey(remoteData.gradingConfigs, statePayload.gradingConfigs, 'trackId'),
        settings: { ...(remoteData.settings || {}), ...(statePayload.settings || {}) },
        lastSyncedAt: new Date().toISOString()
      };
    }

    await setDoc(docRef, finalPayload, { merge: true });
  } catch (error) {
    console.warn('Failed to push state to Firestore cloud:', error);
    throw error;
  }
};
