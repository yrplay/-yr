import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ApiError, requireDeveloper, sendApiError } from '../_lib/admin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'الطريقة غير مدعومة.' });
  }

  try {
    await requireDeveloper(req);
    const hook = process.env.VERCEL_DEPLOY_HOOK_URL;
    if (!hook) {
      throw new ApiError(503, 'لم تتم إضافة رابط نشر Vercel السري إلى إعدادات الخادم بعد.');
    }

    let hookUrl: URL;
    try {
      hookUrl = new URL(hook);
    } catch {
      throw new ApiError(503, 'إعداد رابط نشر Vercel غير صالح.');
    }
    if (hookUrl.protocol !== 'https:' || hookUrl.hostname !== 'api.vercel.com') {
      throw new ApiError(503, 'يجب أن يكون رابط النشر رابط Vercel Deploy Hook صالحًا.');
    }

    const deployResponse = await fetch(hookUrl, { method: 'POST' });
    if (!deployResponse.ok) {
      throw new ApiError(502, 'رفض Vercel تشغيل النشر. تحققي من صلاحية Deploy Hook.');
    }

    return res.status(202).json({
      ok: true,
      message: 'تم إرسال طلب النشر إلى Vercel. سيُنشر آخر commit موجود على الفرع المرتبط بـ Deploy Hook.',
    });
  } catch (error) {
    return sendApiError(res, error);
  }
}
