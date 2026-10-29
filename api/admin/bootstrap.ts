import { timingSafeEqual } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { defaultPermissionsByRole, type User } from '../../src/types';
import { ApiError, getAdminServices, sendApiError } from '../_lib/admin';

const STATE_COLLECTION = 'institution_database';
const STATE_DOCUMENT = 'master_state';
const BOOTSTRAP_LOCK = 'system_metadata/developer_bootstrap';

function secretMatches(provided: unknown, expected: string): boolean {
  if (typeof provided !== 'string' || !provided || provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    try {
      if (!process.env.BOOTSTRAP_DEVELOPER_SECRET || process.env.BOOTSTRAP_DEVELOPER_SECRET.length < 32) {
        return res.status(200).json({ available: false });
      }
      const { adminDb } = getAdminServices();
      const [developers, lock] = await Promise.all([
        adminDb.collection('staff_access').where('role', '==', 'developer').limit(1).get(),
        adminDb.doc(BOOTSTRAP_LOCK).get(),
      ]);
      return res.status(200).json({ available: developers.empty && !lock.exists });
    } catch {
      return res.status(200).json({ available: false });
    }
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'الطريقة غير مدعومة.' });
  }

  let rollbackCreatedUser: (() => Promise<void>) | undefined;
  try {
    const expectedSecret = process.env.BOOTSTRAP_DEVELOPER_SECRET;
    if (!expectedSecret || expectedSecret.length < 32) {
      throw new ApiError(503, 'إعداد التأسيس الأولي للمطور غير مكتمل على الخادم.');
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!secretMatches(body?.secret, expectedSecret)) {
      throw new ApiError(403, 'رمز الإعداد الأولي غير صحيح.');
    }

    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ApiError(400, 'أدخلي اسم المطور وبريدًا إلكترونيًا صحيحًا.');
    }

    const { adminAuth, adminDb } = getAdminServices();
    const existingDevelopers = await adminDb.collection('staff_access')
      .where('role', '==', 'developer')
      .limit(1)
      .get();
    const lockRef = adminDb.doc(BOOTSTRAP_LOCK);
    const existingLock = await lockRef.get();
    if (!existingDevelopers.empty || existingLock.exists) {
      throw new ApiError(409, 'تم إعداد حساب المطور الأول مسبقًا.');
    }

    const authUser = await adminAuth.createUser({
      email,
      displayName: name,
      emailVerified: false,
      disabled: false,
    });
    rollbackCreatedUser = () => adminAuth.deleteUser(authUser.uid);

    const profile: User = {
      id: authUser.uid,
      name,
      email,
      role: 'developer',
      title: 'مطوّر المنصة',
      phone: '',
      circleIds: [],
      avatarIcon: 'mushaf',
      avatarColor: '#7152A3',
      isActive: true,
      permissions: { ...defaultPermissionsByRole.developer },
    };

    const accessRef = adminDb.collection('staff_access').doc(authUser.uid);
    const stateRef = adminDb.collection(STATE_COLLECTION).doc(STATE_DOCUMENT);
    await adminDb.runTransaction(async transaction => {
      const [lockSnapshot, accessSnapshot, stateSnapshot] = await Promise.all([
        transaction.get(lockRef),
        transaction.get(accessRef),
        transaction.get(stateRef),
      ]);
      if (lockSnapshot.exists || accessSnapshot.exists) {
        throw new ApiError(409, 'تم إعداد حساب المطور الأول مسبقًا.');
      }

      const state = stateSnapshot.exists ? (stateSnapshot.data() || {}) : {};
      const users: User[] = Array.isArray(state.users) ? state.users as User[] : [];
      if (users.some(user => user.email?.trim().toLowerCase() === email)) {
        throw new ApiError(409, 'يوجد ملف مسجل بهذا البريد الإلكتروني مسبقًا.');
      }

      transaction.create(lockRef, {
        uid: authUser.uid,
        email,
        createdAt: new Date().toISOString(),
      });
      transaction.create(accessRef, {
        active: true,
        staffId: authUser.uid,
        role: 'developer',
        createdAt: new Date().toISOString(),
        bootstrap: true,
      });
      transaction.set(stateRef, {
        ...state,
        users: [...users, profile],
        lastSyncedAt: new Date().toISOString(),
      });
    });

    rollbackCreatedUser = undefined;
    return res.status(201).json({ ok: true, user: profile });
  } catch (error) {
    if (rollbackCreatedUser) {
      try { await rollbackCreatedUser(); } catch { /* Keep bootstrap errors generic. */ }
    }
    if (error instanceof Error && 'code' in error && error.code === 'auth/email-already-exists') {
      return res.status(409).json({ ok: false, error: 'هذا البريد لديه حساب Firebase مسبقًا؛ استخدمي بريدًا جديدًا للإعداد الأول.' });
    }
    return sendApiError(res, error);
  }
}
