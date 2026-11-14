/**
 * Optimizes and resizes an uploaded image file (such as a signature or logo)
 * on an HTML5 Canvas so the resulting base64 data URL stays lightweight (~10-25 KB)
 * and never exceeds Firestore document limits.
 */
export const optimizeImageFile = (
  file: File,
  maxWidth = 400,
  maxHeight = 200
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) {
        reject(new Error('Empty file data'));
        return;
      }
      const img = new Image();
      img.onerror = () => resolve(dataUrl);
      img.onload = () => {
        try {
          let width = img.width || maxWidth;
          let height = img.height || maxHeight;
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
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
          const pngUrl = canvas.toDataURL('image/png');
          if (pngUrl.length <= 60000) {
            resolve(pngUrl);
          } else {
            resolve(canvas.toDataURL('image/webp', 0.85));
          }
        } catch {
          resolve(dataUrl);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
};
