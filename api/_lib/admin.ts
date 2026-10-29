import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import firebaseConfig from '../../firebase-applet-config.json';

const ADMIN_APP_NAME = 'ghaith-admin-api';

export class ApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getAdminServices() {
  const credentialJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!credentialJson) {
    throw new ApiError(503, 'لم تتم تهيئة خدمة الحسابات الآمنة على الخادم بعد.');
  }

  let serviceAccount: Record<string, unknown>;
  try {
    serviceAccount = JSON.parse(credentialJson) as Record<string, unknown>;
  } catch {
    throw new ApiError(503, 'إعداد اعتماد Firebase الخادمي غير صالح.');
  }
  if (serviceAccount.project_id !== firebaseConfig.projectId) {
    throw new ApiError(503, 'اعتماد Firebase الخادمي يعود إلى مشروع مختلف عن مشروع التطبيق.');
  }

  let app = getApps().find(candidate => candidate.name === ADMIN_APP_NAME);
  if (!app) {
    app = initializeApp(
      {
        credential: cert(serviceAccount as Parameters<typeof cert>[0]),
        projectId: firebaseConfig.projectId,
      },
      ADMIN_APP_NAME
    );
  }

  const adminAuth = getAuth(app);
  const adminDb = firebaseConfig.firestoreDatabaseId
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);
  return { adminAuth, adminDb };
}

export async function requireAccountManager(req: VercelRequest) {
  const authorization = req.headers.authorization;
  const token = typeof authorization === 'string' && authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';
  if (!token) throw new ApiError(401, 'يلزم تسجيل الدخول لإجراء هذه العملية.');

  const { adminAuth, adminDb } = getAdminServices();
  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(token);
  } catch {
    throw new ApiError(401, 'انتهت جلسة الدخول أو أن رمز المصادقة غير صالح.');
  }

  const accessSnapshot = await adminDb.collection('staff_access').doc(decodedToken.uid).get();
  const access = accessSnapshot.exists ? accessSnapshot.data() : undefined;
  const role = typeof access?.role === 'string' ? access.role : '';
  if (access?.active !== true || !['developer', 'leader'].includes(role)) {
    throw new ApiError(403, 'هذه العملية متاحة للمطور أو القائدة المخولة فقط.');
  }

  return { adminAuth, adminDb, callerUid: decodedToken.uid, callerRole: role };
}

export async function requireDeveloper(req: VercelRequest) {
  const context = await requireAccountManager(req);
  if (context.callerRole !== 'developer') {
    throw new ApiError(403, 'تشغيل نشر الموقع متاح لحساب المطور فقط.');
  }
  return context;
}

export function sendApiError(res: VercelResponse, error: unknown) {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({ ok: false, error: error.message });
  }
  // لا نعيد تفاصيل Firebase أو بيانات اعتماد الخادم إلى المتصفح.
  return res.status(500).json({ ok: false, error: 'تعذر إكمال العملية. تحققي من الإعدادات ثم أعيدي المحاولة.' });
}
