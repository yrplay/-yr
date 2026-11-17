import { randomUUID } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ApiError, requireAccountManager, sendApiError } from '../_lib/admin';

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const CATEGORIES = new Set([
  'institution-logo',
  'institution-seal',
  'leader-signature',
  'track-logo',
]);

function decodeImage(dataUrl: unknown): { buffer: Buffer; contentType: string; extension: string } {
  if (typeof dataUrl !== 'string') throw new ApiError(400, 'ملف الصورة غير صالح.');
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\r\n]+)$/.exec(dataUrl);
  if (!match) throw new ApiError(400, 'صيغة الصورة غير مدعومة. استخدمي PNG أو JPEG أو WebP.');

  const contentType = match[1];
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
    throw new ApiError(413, 'حجم الصورة يتجاوز الحد المسموح (3 ميجابايت).');
  }

  const isPng = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isWebp = buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';

  if (
    (contentType === 'image/png' && !isPng) ||
    (contentType === 'image/jpeg' && !isJpeg) ||
    (contentType === 'image/webp' && !isWebp)
  ) {
    throw new ApiError(400, 'محتوى الصورة لا يطابق نوع الملف المعلن.');
  }

  return {
    buffer,
    contentType,
    extension: contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/png' ? 'png' : 'webp',
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'الطريقة غير مدعومة.' });
  }

  try {
    const { adminStorage, callerUid } = await requireAccountManager(req);
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const category = typeof body?.category === 'string' ? body.category : '';
    if (!CATEGORIES.has(category)) throw new ApiError(400, 'نوع الصورة غير مدعوم.');

    const { buffer, contentType, extension } = decodeImage(body?.dataUrl);
    const objectPath = `institution-assets/${callerUid}/${category}/${randomUUID()}.${extension}`;
    const downloadToken = randomUUID();
    const file = adminStorage.file(objectPath);

    await file.save(buffer, {
      resumable: false,
      validation: 'crc32c',
      metadata: {
        contentType,
        cacheControl: 'public, max-age=31536000, immutable',
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
          uploadedBy: callerUid,
        },
      },
    });

    const url =
      `https://firebasestorage.googleapis.com/v0/b/${adminStorage.name}/o/${encodeURIComponent(objectPath)}` +
      `?alt=media&token=${downloadToken}`;

    return res.status(201).json({ ok: true, url, path: objectPath });
  } catch (error) {
    return sendApiError(res, error);
  }
}
