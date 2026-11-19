import { auth } from '../firebase';

export type InstitutionAssetCategory =
  | 'institution-logo'
  | 'institution-seal'
  | 'leader-signature'
  | 'track-logo';

export const MAX_RAW_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MiB max raw upload file
export const MAX_INLINE_DATA_URL_LENGTH = 48_000; // ~48 KB target for instant cross-device sync
export const MAX_FIRESTORE_INLINE_IMAGE_BYTES = 160_000; // Hard ceiling for inline Firestore asset

export class ImageStorageError extends Error {
  readonly code:
    | 'INVALID_IMAGE_FORMAT'
    | 'IMAGE_TOO_LARGE'
    | 'STORAGE_QUOTA_EXCEEDED'
    | 'CLOUD_UPLOAD_FAILED';
  constructor(
    code:
      | 'INVALID_IMAGE_FORMAT'
      | 'IMAGE_TOO_LARGE'
      | 'STORAGE_QUOTA_EXCEEDED'
      | 'CLOUD_UPLOAD_FAILED',
    message: string
  ) {
    super(message);
    this.name = 'ImageStorageError';
    this.code = code;
  }
}

export interface ImageUploadResult {
  url: string;
  category: InstitutionAssetCategory;
  storageMode: 'cloud-storage' | 'firestore-inline' | 'offline-pending';
  cloudVerified: boolean;
  localPersisted: boolean;
  quotaExceeded: boolean;
  byteSize: number;
  error?: string;
}

const ASSET_CACHE_PREFIX = 'ghaith_asset_cache_v1_';

export const estimateDataUrlByteSize = (dataUrl: string): number => {
  if (!dataUrl || typeof dataUrl !== 'string') return 0;
  if (!dataUrl.startsWith('data:')) {
    return new TextEncoder().encode(dataUrl).length;
  }
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx < 0) return dataUrl.length;
  const base64Part = dataUrl.slice(commaIdx + 1);
  return Math.ceil((base64Part.length * 3) / 4);
};

export const isQuotaExceededError = (err: unknown): boolean => {
  if (!err || typeof err !== 'object') return false;
  const name = String((err as any).name || '');
  const code = Number((err as any).code || 0);
  const msg = String((err as any).message || '').toLowerCase();
  return (
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    code === 22 ||
    code === 1014 ||
    msg.includes('quota')
  );
};

export const validateImageDataUrlBeforeProcessing = (
  dataUrl: string,
  maxRawBytes = MAX_RAW_IMAGE_BYTES
): { byteSize: number; isDataUrl: boolean } => {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.trim()) {
    throw new ImageStorageError('INVALID_IMAGE_FORMAT', 'ملف الصورة غير صالح أو فارغ.');
  }
  const trimmed = dataUrl.trim();

  // Strictly validate external or relative URLs (reject malformed URLs, spaces, javascript:, or protocol-relative //)
  if (!trimmed.startsWith('data:')) {
    if (/\s/.test(trimmed)) {
      throw new ImageStorageError('INVALID_IMAGE_FORMAT', 'رابط الصورة يحتوي على مسافات أو محارف غير صالحة.');
    }
    if (trimmed.startsWith('/')) {
      if (trimmed.startsWith('//') || trimmed.length < 2 || !/^\/[a-zA-Z0-9._/-]+$/.test(trimmed)) {
        throw new ImageStorageError('INVALID_IMAGE_FORMAT', 'مسار الصورة المحلي غير صالح.');
      }
      return { byteSize: trimmed.length, isDataUrl: false };
    }
    if (/^https?:\/\//i.test(trimmed)) {
      try {
        const parsed = new URL(trimmed);
        if (
          (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') ||
          !parsed.hostname ||
          (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost')
        ) {
          throw new ImageStorageError('INVALID_IMAGE_FORMAT', 'رابط الصورة الخارجي غير صالح.');
        }
        return { byteSize: trimmed.length, isDataUrl: false };
      } catch (err) {
        if (err instanceof ImageStorageError) throw err;
        throw new ImageStorageError('INVALID_IMAGE_FORMAT', 'رابط الصورة الخارجي غير صالح.');
      }
    }
    throw new ImageStorageError(
      'INVALID_IMAGE_FORMAT',
      'صيغة رابط الصورة غير مدعومة؛ يرجى استخدام صورة بصيغة PNG أو JPG أو WebP أو رابط HTTPS صالح.'
    );
  }

  const dataUrlMatch = trimmed.match(/^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,([A-Za-z0-9+/=]+)$/i);
  if (!dataUrlMatch || !dataUrlMatch[2] || dataUrlMatch[2].length < 4) {
    throw new ImageStorageError(
      'INVALID_IMAGE_FORMAT',
      'صيغة الصورة غير مدعومة أو محتوى Base64 تالف؛ يرجى اختيار صورة بصيغة PNG أو JPG أو WebP.'
    );
  }
  const byteSize = estimateDataUrlByteSize(trimmed);
  if (byteSize <= 0) {
    throw new ImageStorageError('INVALID_IMAGE_FORMAT', 'بيانات الصورة فارغة أو تالفة.');
  }
  if (byteSize > maxRawBytes) {
    throw new ImageStorageError(
      'IMAGE_TOO_LARGE',
      `حجم الصورة (${Math.round(byteSize / 1024)} كيلوبايت) يتجاوز الحد الأقصى المسموح به قبل المعالجة (${Math.round(
        maxRawBytes / (1024 * 1024)
      )} ميجابايت).`
    );
  }
  return { byteSize, isDataUrl: true };
};

/**
 * Persists an uploaded asset in `localStorage` with automatic eviction recovery if `QuotaExceededError` occurs.
 */
export const persistAssetLocallyWithQuotaRecovery = (
  category: InstitutionAssetCategory,
  url: string,
  storageObj: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null = typeof window !== 'undefined' &&
  window.localStorage
    ? window.localStorage
    : null
): { persisted: boolean; quotaExceeded: boolean } => {
  if (!storageObj) {
    return { persisted: false, quotaExceeded: false };
  }
  const key = `${ASSET_CACHE_PREFIX}${category}`;
  try {
    if (!url) {
      storageObj.removeItem(key);
    } else {
      storageObj.setItem(key, url);
      const verifyRead = storageObj.getItem(key);
      if (verifyRead !== url) {
        return { persisted: false, quotaExceeded: false };
      }
    }
    return { persisted: true, quotaExceeded: false };
  } catch (err) {
    if (!isQuotaExceededError(err)) {
      return { persisted: false, quotaExceeded: false };
    }
    // Attempt eviction of non-essential cache keys to free localStorage space
    const disposableKeys = [
      'ghaith_pwa_icon_cache_v1',
      'ghaith_honors_custom_bg_v1',
      'ghaith_platform_db_v17_clean'
    ];
    for (const dKey of disposableKeys) {
      try {
        storageObj.removeItem(dKey);
      } catch {
        // ignore
      }
    }
    try {
      storageObj.setItem(key, url);
      const verifyRead = storageObj.getItem(key);
      if (verifyRead !== url) {
        return { persisted: false, quotaExceeded: true };
      }
      return { persisted: true, quotaExceeded: false };
    } catch {
      return { persisted: false, quotaExceeded: true };
    }
  }
};

export const getCachedAssetUrl = (
  category: InstitutionAssetCategory,
  storageObj: Pick<Storage, 'getItem'> | null = typeof window !== 'undefined' && window.localStorage
    ? window.localStorage
    : null
): string | null => {
  if (!storageObj) return null;
  try {
    return storageObj.getItem(`${ASSET_CACHE_PREFIX}${category}`);
  } catch {
    return null;
  }
};

/**
 * Ensures an inline data:image/* string stays compact enough for instant
 * Firestore cloud synchronization across desktop, iPad, and mobile devices.
 */
export const ensureCompactDataUrl = (
  dataUrl: string,
  maxLength = MAX_INLINE_DATA_URL_LENGTH
): Promise<string> => {
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    !dataUrl.startsWith('data:image/') ||
    dataUrl.length <= maxLength
  ) {
    return Promise.resolve(dataUrl);
  }

  return new Promise(resolve => {
    const img = new Image();
    img.onerror = () => resolve(dataUrl);
    img.onload = () => {
      try {
        const maxDim = 320;
        let width = img.width || maxDim;
        let height = img.height || maxDim;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        for (const quality of [0.82, 0.68, 0.52, 0.4]) {
          const webpUrl = canvas.toDataURL('image/webp', quality);
          if (webpUrl.startsWith('data:image/webp') && webpUrl.length <= maxLength) {
            resolve(webpUrl);
            return;
          }
        }

        // White background fallback for JPEG if WebP isn't compact enough (e.g., iOS Safari older canvas)
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        for (const q of [0.72, 0.55, 0.4]) {
          const jpegUrl = canvas.toDataURL('image/jpeg', q);
          if (jpegUrl.length <= maxLength) {
            resolve(jpegUrl);
            return;
          }
        }
        const fallbackJpeg = canvas.toDataURL('image/jpeg', 0.4);
        resolve(fallbackJpeg.length < dataUrl.length ? fallbackJpeg : dataUrl);
      } catch {
        resolve(dataUrl);
      }
    };
    img.src = dataUrl;
  });
};

export interface UploadImageOptions {
  maxInlineBytes?: number;
  isOnline?: boolean;
  storageObj?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
  customUploader?: (params: {
    category: InstitutionAssetCategory;
    dataUrl: string;
    idToken?: string;
  }) => Promise<{ ok: boolean; url?: string }>;
  requireCloudEndpoint?: boolean;
}

/**
 * Full-featured image upload and verification pipeline:
 * 1. Validates format (both data:image/*;base64 and external/relative URLs) and raw byte size before processing.
 * 2. Downscales/compresses to a Firestore-safe compact size and rejects images that still exceed `MAX_FIRESTORE_INLINE_IMAGE_BYTES`.
 * 3. Attempts cloud storage endpoint upload when authenticated or when `customUploader` is provided.
 * 4. Never claims `cloudVerified: true` merely because `isOnline` is true; `cloudVerified` is ONLY `true`
 *    when the cloud upload endpoint / customUploader actually confirms persistence.
 * 5. When working offline (or when cloud verification did not occur and local storage fails), throws
 *    `ImageStorageError('STORAGE_QUOTA_EXCEEDED', ...)` if local persistence fails so the caller is never misled.
 */
export const uploadImageDataUrlWithMeta = async (
  dataUrl: string,
  category: InstitutionAssetCategory,
  options?: UploadImageOptions
): Promise<ImageUploadResult> => {
  const { isDataUrl } = validateImageDataUrlBeforeProcessing(dataUrl);
  const trimmedUrl = dataUrl.trim();
  const isOnline =
    options?.isOnline !== undefined
      ? options.isOnline
      : typeof navigator === 'undefined'
      ? true
      : navigator.onLine !== false;

  if (!isDataUrl) {
    const localRes = persistAssetLocallyWithQuotaRecovery(category, trimmedUrl, options?.storageObj);

    if (!isOnline) {
      if (options?.requireCloudEndpoint) {
        throw new ImageStorageError(
          'CLOUD_UPLOAD_FAILED',
          'تعذر التحقق من رابط الصورة سحابياً بسبب انقطاع الاتصال بالإنترنت.'
        );
      }
      if (!localRes.persisted) {
        throw new ImageStorageError(
          'STORAGE_QUOTA_EXCEEDED',
          'فشل حفظ رابط الصورة في التخزين المحلي أثناء العمل دون اتصال.'
        );
      }
      return {
        url: trimmedUrl,
        category,
        storageMode: 'offline-pending',
        cloudVerified: false,
        localPersisted: localRes.persisted,
        quotaExceeded: localRes.quotaExceeded,
        byteSize: trimmedUrl.length
      };
    }

    if (options?.customUploader) {
      try {
        const upRes = await options.customUploader({ category, dataUrl: trimmedUrl });
        if (upRes.ok && upRes.url) {
          const verifiedLocal = persistAssetLocallyWithQuotaRecovery(category, upRes.url, options?.storageObj);
          return {
            url: upRes.url,
            category,
            storageMode: 'cloud-storage',
            cloudVerified: true,
            localPersisted: verifiedLocal.persisted,
            quotaExceeded: verifiedLocal.quotaExceeded,
            byteSize: upRes.url.length
          };
        }
        if (options.requireCloudEndpoint) {
          throw new ImageStorageError('CLOUD_UPLOAD_FAILED', 'فشل تأكيد رابط الصورة في الخادم السحابي.');
        }
      } catch (err) {
        if (err instanceof ImageStorageError || options.requireCloudEndpoint) {
          throw err instanceof ImageStorageError
            ? err
            : new ImageStorageError('CLOUD_UPLOAD_FAILED', 'فشل تأكيد رابط الصورة في الخادم السحابي.');
        }
      }
    } else if (options?.requireCloudEndpoint) {
      throw new ImageStorageError(
        'CLOUD_UPLOAD_FAILED',
        'لم يتم توفير خدمة التحقق السحابي لتأكيد حفظ رابط الصورة.'
      );
    }

    if (!localRes.persisted && localRes.quotaExceeded) {
      throw new ImageStorageError(
        'STORAGE_QUOTA_EXCEEDED',
        'تجاوزت مساحة التخزين المحلي الحد المسموح ولم يتم التحقق من الصورة سحابياً.'
      );
    }

    return {
      url: trimmedUrl,
      category,
      storageMode: 'firestore-inline',
      cloudVerified: false,
      localPersisted: localRes.persisted,
      quotaExceeded: localRes.quotaExceeded,
      byteSize: trimmedUrl.length
    };
  }

  const compactDataUrl = await ensureCompactDataUrl(trimmedUrl);
  const maxInlineBytes = options?.maxInlineBytes ?? MAX_FIRESTORE_INLINE_IMAGE_BYTES;
  const compactByteSize = estimateDataUrlByteSize(compactDataUrl);

  if (compactByteSize > maxInlineBytes) {
    throw new ImageStorageError(
      'IMAGE_TOO_LARGE',
      `حجم الصورة بعد الضغط (${Math.round(compactByteSize / 1024)} كيلوبايت) يتجاوز الحد المسموح به للتخزين السحابي في Firestore (${Math.round(
        maxInlineBytes / 1024
      )} كيلوبايت). يرجى اختيار صورة أصغر.`
    );
  }

  // Persist locally first with QuotaExceededError recovery so reload never loses the selected image
  const localRes = persistAssetLocallyWithQuotaRecovery(category, compactDataUrl, options?.storageObj);

  if (!isOnline) {
    if (options?.requireCloudEndpoint) {
      throw new ImageStorageError(
        'CLOUD_UPLOAD_FAILED',
        'تعذر رفع الصورة سحابياً بسبب انقطاع الاتصال بالإنترنت.'
      );
    }
    if (!localRes.persisted) {
      throw new ImageStorageError(
        'STORAGE_QUOTA_EXCEEDED',
        'فشل حفظ الصورة في التخزين المحلي أثناء العمل دون اتصال؛ تعذر تأمين الصورة محلياً.'
      );
    }
    return {
      url: compactDataUrl,
      category,
      storageMode: 'offline-pending',
      cloudVerified: false,
      localPersisted: localRes.persisted,
      quotaExceeded: localRes.quotaExceeded,
      byteSize: compactByteSize
    };
  }

  // Try custom uploader (for tests or external storage providers) or `/api/admin/assets`
  if (options?.customUploader) {
    try {
      const upRes = await options.customUploader({ category, dataUrl: compactDataUrl });
      if (upRes.ok && upRes.url) {
        const verifiedLocal = persistAssetLocallyWithQuotaRecovery(category, upRes.url, options?.storageObj);
        return {
          url: upRes.url,
          category,
          storageMode: 'cloud-storage',
          cloudVerified: true,
          localPersisted: verifiedLocal.persisted,
          quotaExceeded: verifiedLocal.quotaExceeded,
          byteSize: compactByteSize
        };
      }
      if (options.requireCloudEndpoint) {
        throw new ImageStorageError('CLOUD_UPLOAD_FAILED', 'فشل رفع الصورة إلى الخادم السحابي.');
      }
    } catch (err) {
      if (err instanceof ImageStorageError || options.requireCloudEndpoint) {
        throw err instanceof ImageStorageError
          ? err
          : new ImageStorageError('CLOUD_UPLOAD_FAILED', 'فشل رفع الصورة إلى الخادم السحابي.');
      }
    }
  } else {
    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        const idToken = await currentUser.getIdToken();
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timeoutId = controller ? setTimeout(() => controller.abort(), 8000) : null;

        try {
          const response = await fetch('/api/admin/assets', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${idToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ category, dataUrl: compactDataUrl }),
            ...(controller ? { signal: controller.signal } : {})
          });

          const result = await response.json().catch(() => ({}));
          if (response.ok && typeof result?.url === 'string' && result.url) {
            const verifiedLocal = persistAssetLocallyWithQuotaRecovery(category, result.url, options?.storageObj);
            return {
              url: result.url,
              category,
              storageMode: 'cloud-storage',
              cloudVerified: true,
              localPersisted: verifiedLocal.persisted,
              quotaExceeded: verifiedLocal.quotaExceeded,
              byteSize: compactByteSize
            };
          }
        } finally {
          if (timeoutId) clearTimeout(timeoutId);
        }
      } catch {
        if (options?.requireCloudEndpoint) {
          throw new ImageStorageError('CLOUD_UPLOAD_FAILED', 'تعذر الاتصال بخادم رفع الصور.');
        }
      }
    } else if (options?.requireCloudEndpoint) {
      throw new ImageStorageError(
        'CLOUD_UPLOAD_FAILED',
        'يتطلب الرفع السحابي المباشر جلسة مصادقة نشطة.'
      );
    }
  }

  if (!localRes.persisted && localRes.quotaExceeded) {
    throw new ImageStorageError(
      'STORAGE_QUOTA_EXCEEDED',
      'فشل حفظ الصورة في التخزين المحلي بسبب امتلاء المساحة ولم يتم رفعها لخادم التخزين السحابي.'
    );
  }

  return {
    url: compactDataUrl,
    category,
    storageMode: 'firestore-inline',
    cloudVerified: false, // Verified once Firestore transaction in updateSettings/createTrack commits
    localPersisted: localRes.persisted,
    quotaExceeded: localRes.quotaExceeded,
    byteSize: compactByteSize
  };
};

/**
 * Backward-compatible helper that returns the validated, size-bounded image URL/DataURL.
 */
export const uploadImageDataUrl = async (
  dataUrl: string,
  category: InstitutionAssetCategory,
  options?: UploadImageOptions
): Promise<string> => {
  const res = await uploadImageDataUrlWithMeta(dataUrl, category, options);
  return res.url;
};
