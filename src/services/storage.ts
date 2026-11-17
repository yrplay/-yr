import { auth } from '../firebase';

export type InstitutionAssetCategory =
  | 'institution-logo'
  | 'institution-seal'
  | 'leader-signature'
  | 'track-logo';

/**
 * Uploads a locally selected image through the authenticated server endpoint.
 * The server verifies the existing Firebase session and manager role before
 * writing to Cloud Storage; the client never receives service-account access.
 */
export const uploadImageDataUrl = async (
  dataUrl: string,
  category: InstitutionAssetCategory
): Promise<string> => {
  if (!dataUrl.startsWith('data:image/')) return dataUrl;

  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('انتهت الجلسة. أعيدي فتح التطبيق ثم حاولي رفع الصورة.');
  }

  const idToken = await currentUser.getIdToken();
  const response = await fetch('/api/admin/assets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ category, dataUrl }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || typeof result?.url !== 'string') {
    throw new Error(
      typeof result?.error === 'string'
        ? result.error
        : 'تعذر رفع الصورة إلى التخزين السحابي.'
    );
  }

  return result.url;
};
