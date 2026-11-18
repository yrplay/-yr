import { auth } from '../firebase';

export type InstitutionAssetCategory =
  | 'institution-logo'
  | 'institution-seal'
  | 'leader-signature'
  | 'track-logo';

const MAX_INLINE_DATA_URL_LENGTH = 48000;

/**
 * Ensures an inline data:image/* string stays compact enough for instant
 * Firestore cloud synchronization across desktop, iPad, and mobile devices.
 */
const ensureCompactDataUrl = (dataUrl: string, maxLength = MAX_INLINE_DATA_URL_LENGTH): Promise<string> => {
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

        for (const quality of [0.82, 0.68, 0.52]) {
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
        const jpegUrl = canvas.toDataURL('image/jpeg', 0.72);
        resolve(jpegUrl.length < dataUrl.length ? jpegUrl : dataUrl);
      } catch {
        resolve(dataUrl);
      }
    };
    img.src = dataUrl;
  });
};

/**
 * Uploads a locally selected image through the authenticated server endpoint when
 * a Firebase Auth session and server storage endpoint are active, and gracefully
 * falls back to an optimized compact Data URL for PIN-authenticated staff sessions
 * or static/preview deployments so logo, seal, and signature updates always succeed.
 */
export const uploadImageDataUrl = async (
  dataUrl: string,
  category: InstitutionAssetCategory
): Promise<string> => {
  if (!dataUrl || typeof dataUrl !== 'string') {
    throw new Error('ملف الصورة غير صالح.');
  }
  if (!dataUrl.startsWith('data:image/')) return dataUrl;

  const compactDataUrl = await ensureCompactDataUrl(dataUrl);
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return compactDataUrl;
  }

  try {
    const idToken = await currentUser.getIdToken();
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 8000) : null;

    try {
      const response = await fetch('/api/admin/assets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category, dataUrl: compactDataUrl }),
        ...(controller ? { signal: controller.signal } : {}),
      });

      const result = await response.json().catch(() => ({}));
      if (response.ok && typeof result?.url === 'string' && result.url) {
        return result.url;
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  } catch {
    // Fallback cleanly to compact inline Data URL when /api/admin/assets is unavailable
  }

  return compactDataUrl;
};
