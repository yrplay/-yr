/**
 * أداة ضغط وتحسين الصور قبل حفظها في قاعدة البيانات والتخزين المحلي
 * تمنع تجاوز حد الـ 1 ميغابايت لمستند فايربيس وحد الـ 5 ميغابايت للتخزين المحلي (LocalStorage)
 */

export async function optimizeImageForStorage(
  file: File | Blob,
  maxWidth = 512,
  maxHeight = 512,
  quality = 0.88
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('فشل قراءة ملف الصورة'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('فشل تحميل الصورة في المتصفح'));
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // حساب الأبعاد التناسبية
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // في حال تعذر إنشاء السياق، نرجع الصورة الأصلية كبديل
          resolve(e.target?.result as string);
          return;
        }

        // تحسين جودة التنعيم
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // الحفاظ على شفافية ملفات PNG
        const isPng = file.type === 'image/png';
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        try {
          // نفضل PNG إذا كانت الصورة الأصلية PNG لحفظ الشفافية
          const outputType = isPng ? 'image/png' : 'image/jpeg';
          const dataUrl = canvas.toDataURL(outputType, quality);
          resolve(dataUrl);
        } catch {
          resolve(e.target?.result as string);
        }
      };

      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}
