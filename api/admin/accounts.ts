import type { VercelRequest, VercelResponse } from '@vercel/node';
import { defaultPermissionsByRole, type User, type UserRole } from '../../src/types';
import { ApiError, requireAccountManager, sendApiError } from '../_lib/admin';

const VALID_ROLES: UserRole[] = ['developer', 'leader', 'supervisor', 'teacher'];
const STATE_COLLECTION = 'institution_database';
const STATE_DOCUMENT = 'master_state';

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'الطريقة غير مدعومة.' });
  }

  let rollbackCreatedUser: (() => Promise<void>) | undefined;
  try {
    const context = await requireAccountManager(req);

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const name = stringValue(body?.name);
    const email = stringValue(body?.email).toLowerCase();
    const title = stringValue(body?.title, 'معلمة حلقة');
    const role = stringValue(body?.role) as UserRole;
    const phone = stringValue(body?.phone);
    const circleIds = Array.isArray(body?.circleIds)
      ? body.circleIds.filter((value: unknown): value is string => typeof value === 'string').slice(0, 100)
      : [];

    if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ApiError(400, 'أدخلي الاسم وبريدًا إلكترونيًا صحيحًا.');
    }
    if (!VALID_ROLES.includes(role)) throw new ApiError(400, 'الدور المحدد غير صالح.');
    if (role === 'developer' && context.callerRole !== 'developer') {
      throw new ApiError(403, 'إنشاء حساب مطور آخر متاح للمطور الحالي فقط.');
    }

    const authUser = await context.adminAuth.createUser({
      email,
      displayName: name,
      emailVerified: false,
      disabled: false,
    });
    rollbackCreatedUser = () => context.adminAuth.deleteUser(authUser.uid);

    const profile: User = {
      id: authUser.uid,
      name,
      email,
      role,
      title,
      phone,
      circleIds,
      avatarIcon: stringValue(body?.avatarIcon, 'mushaf'),
      avatarColor: stringValue(body?.avatarColor, '#8E5364'),
      isActive: true,
      permissions: { ...defaultPermissionsByRole[role] },
    };

    const appStateRef = context.adminDb.collection(STATE_COLLECTION).doc(STATE_DOCUMENT);
    const accessRef = context.adminDb.collection('staff_access').doc(authUser.uid);
    await context.adminDb.runTransaction(async transaction => {
      const [stateSnapshot, accessSnapshot] = await Promise.all([
        transaction.get(appStateRef),
        transaction.get(accessRef),
      ]);
      if (accessSnapshot.exists) throw new ApiError(409, 'سجل الصلاحية موجود مسبقًا لهذا الحساب.');

      const state = stateSnapshot.exists ? (stateSnapshot.data() || {}) : {};
      const users: User[] = Array.isArray(state.users) ? state.users as User[] : [];
      if (users.some(user => user.id === profile.id || user.email?.trim().toLowerCase() === email)) {
        throw new ApiError(409, 'يوجد ملف مسجل بهذا البريد الإلكتروني مسبقًا.');
      }

      transaction.create(accessRef, {
        active: true,
        staffId: profile.id,
        role,
        createdAt: new Date().toISOString(),
        createdBy: context.callerUid,
      });
      transaction.set(appStateRef, {
        ...state,
        users: [...users, profile],
        lastSyncedAt: new Date().toISOString(),
      });
    });

    rollbackCreatedUser = undefined;
    return res.status(201).json({ ok: true, user: profile });
  } catch (error) {
    if (rollbackCreatedUser) {
      try {
        await rollbackCreatedUser();
      } catch {
        // لا نسرّب تفاصيل تنظيف الحساب إلى المستدعي.
      }
    }
    if (error instanceof Error && 'code' in error && error.code === 'auth/email-already-exists') {
      return res.status(409).json({ ok: false, error: 'يوجد حساب بهذا البريد الإلكتروني مسبقًا.' });
    }
    return sendApiError(res, error);
  }
}
