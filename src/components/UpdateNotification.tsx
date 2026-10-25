import React, { useEffect, useState } from 'react';
import { RefreshCw, X, Sparkles } from 'lucide-react';

export const UpdateNotification: React.FC = () => {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [updateFunction, setUpdateFunction] = useState<(() => void) | null>(null);

  useEffect(() => {
    let mounted = true;

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      import('virtual:pwa-register')
        .then(({ registerSW }) => {
          if (!mounted) return;
          const updateSW = registerSW({
            onNeedRefresh() {
              if (mounted) {
                setNeedRefresh(true);
                setUpdateFunction(() => () => updateSW(true));
              }
            },
            onOfflineReady() {
              if (mounted) {
                setOfflineReady(true);
                setTimeout(() => setOfflineReady(false), 5000);
              }
            },
          });
        })
        .catch(() => {
          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.addEventListener('controllerchange', () => {
              if (mounted) setNeedRefresh(true);
            });
          }
        });
    }

    return () => {
      mounted = false;
    };
  }, []);

  const handleRefresh = () => {
    if (updateFunction) {
      updateFunction();
    } else {
      window.location.reload();
    }
  };

  if (!needRefresh && !offlineReady) {
    return null;
  }

  return (
    <div
      dir="rtl"
      className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 z-50 max-w-sm w-full bg-white border border-[#E8DFD8] shadow-xl rounded-2xl p-4 animate-in fade-in slide-in-from-top-4 duration-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FAF2F4] text-[#8E5364] flex items-center justify-center shrink-0 border border-[#E8D5D8]">
            {needRefresh ? (
              <RefreshCw className="w-5 h-5 animate-spin" style={{ animationDuration: '4s' }} />
            ) : (
              <Sparkles className="w-5 h-5 text-emerald-600" />
            )}
          </div>
          <div>
            <h4 className="font-bold text-stone-900 text-xs sm:text-sm">
              {needRefresh ? 'تحديث جديد متوفر للمقرأة' : 'جاهز للعمل دون إنترنت'}
            </h4>
            <p className="text-[11px] text-stone-500 mt-0.5 leading-relaxed">
              {needRefresh
                ? 'تم تجهيز تحسينات وإصلاحات جديدة للمنصة، انقري لتحديث التطبيق فوراً.'
                : 'تم حفظ بيانات المقرأة للاستخدام أثناء انقطاع الشبكة.'}
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setNeedRefresh(false);
            setOfflineReady(false);
          }}
          className="text-stone-400 hover:text-stone-600 p-1 rounded-lg"
          aria-label="إغلاق"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {needRefresh && (
        <div className="mt-3 flex justify-end gap-2 pt-2 border-t border-stone-100">
          <button
            onClick={() => setNeedRefresh(false)}
            className="px-3 py-1.5 text-xs text-stone-500 hover:text-stone-700 font-medium"
          >
            لاحقاً
          </button>
          <button
            onClick={handleRefresh}
            className="px-4 py-1.5 bg-[#8E5364] hover:bg-[#744251] text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>تحديث الآن</span>
          </button>
        </div>
      )}
    </div>
  );
};
