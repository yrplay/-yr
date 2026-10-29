import React, { useState } from 'react';
import { ExternalLink, Github, Rocket, ShieldCheck } from 'lucide-react';
import { auth } from '../firebase';
import { useApp } from '../context/AppContext';

export const DeveloperDeploymentPanel: React.FC = () => {
  const { currentUser, showToast } = useApp();
  const [isPublishing, setIsPublishing] = useState(false);

  if (currentUser?.role !== 'developer') return null;

  const publishLatestCommit = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      showToast('انتهت جلسة المطور. سجّلي الدخول مجددًا.', 'error');
      return;
    }

    setIsPublishing(true);
    try {
      const response = await fetch('/api/admin/deploy', {
        method: 'POST',
        headers: { Authorization: `Bearer ${await firebaseUser.getIdToken()}` },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'تعذر بدء النشر.');
      showToast(result.message || 'تم إرسال طلب النشر إلى Vercel.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'تعذر بدء النشر. أعيدي المحاولة.', 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <section className="bg-white p-6 rounded-3xl border border-violet-200 shadow-2xs space-y-4" dir="rtl">
      <div className="flex items-start justify-between gap-4 border-b border-violet-100 pb-3">
        <div>
          <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
            <Rocket className="w-4 h-4 text-violet-700" />
            نشر نسخة الموقع
          </h3>
          <p className="text-xs text-stone-600 mt-1 leading-relaxed">
            يشغّل نشر آخر commit موجود على فرع GitHub المرتبط بـ Vercel. لا ينشئ commit ولا يدمج الفروع.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] text-violet-800 bg-violet-50 border border-violet-200 rounded-full px-2.5 py-1 shrink-0">
          <ShieldCheck className="w-3 h-3" />
          للمطور فقط
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void publishLatestCommit()}
          disabled={isPublishing}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-700 hover:bg-violet-800 text-white text-xs font-bold transition disabled:opacity-60"
        >
          <Rocket className={`w-4 h-4 ${isPublishing ? 'animate-pulse' : ''}`} />
          {isPublishing ? 'جارٍ إرسال طلب النشر…' : 'نشر آخر تحديث على Vercel'}
        </button>
        <a
          href="https://github.com/yrplay/-yr/tree/fix/audit-findings"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-50 text-xs font-semibold"
        >
          <Github className="w-4 h-4" />
          فتح فرع GitHub
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <p className="text-[11px] text-stone-500 leading-relaxed">
        يلزم إعداد Vercel Deploy Hook ورابطه السري في متغير الخادم <code dir="ltr">VERCEL_DEPLOY_HOOK_URL</code>. لا يُرسل الرابط السري إلى المتصفح.
      </p>
    </section>
  );
};
