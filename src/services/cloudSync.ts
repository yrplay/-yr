import { getAuth } from 'firebase/auth';
import { collection, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * دالة مزامنة آمنة تتحقق من تسجيل الدخول قبل إرسال أي بيان
 */
export const syncRecordSafely = async (
  collectionName: string,
  recordId: string,
  data: Record<string, any>
) => {
  const auth = getAuth();
  const user = auth.currentUser;

  // منع أي عملية مزامنة إذا لم يكن المستخدم مسجل دخول رسمياً
  if (!user) {
    console.error('عملية مرفوضة: المستخدم غير مسجل');
    throw new Error('عملية غير مصرح بها: يجب تسجيل الدخول أولاً');
  }

  // إرفاق هوية المستخدم ووقت التعديل لتوثيق السجل
  const payload = {
    ...data,
    updatedBy: user.uid,
    updatedAt: new Date().toISOString(),
  };

  const docRef = doc(collection(db, collectionName), recordId);
  await setDoc(docRef, payload, { merge: true });
};
