import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, Check, X, Share, PlusSquare, ArrowUpRight } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface PWAInstallButtonProps {
  variant?: 'header' | 'sidebar' | 'settings' | 'card';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'header', className = '' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const { settings, showToast } = useApp();
  const [showGuide, setShowGuide] = useState(false);

  const handleInstallClick = async () => {
    if (isInstalled) {
      showToast('التطبيق مثبت بالفعل ويعمل كنسخة أصلية على جهازكِ ✨', 'info');
      return;
    }

    if (isInstallable) {
      const success = await install();
      if (success) {
        showToast('تم تثبيت تطبيق مقرأة غيث الغيم على جهازكِ بنجاح 🎉', 'success');
      }
    } else {
      setShowGuide(true);
    }
  };

  // If already installed in standalone mode
  if (isInstalled && variant === 'header') {
    return null;
  }

  return (
    <>
      {variant === 'header' && (
        <button
          type="button"
          onClick={handleInstallClick}
          style={!isInstalled ? {
            background: `linear-gradient(135deg, ${settings.primaryColor || '#8E5364'}, ${settings.secondaryColor || '#744251'})`,
            borderColor: settings.primaryColor || '#744251'
          } : undefined}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer active:scale-95 border ${
            isInstalled
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'text-white hover:brightness-105'
          } ${className}`}
          title="تثبيت التطبيق على جهازكِ للوصول السريع بدون متصفح"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span className="hidden md:inline">
            {isInstalled ? 'التطبيق مثبت ✅' : 'تثبيت التطبيق 📲'}
          </span>
          <span className="md:hidden">تثبيت</span>
        </button>
      )}

      {variant === 'sidebar' && (
        <div className="p-3 mx-3 my-2 bg-[#FAF2F4] rounded-2xl border border-[#E8D5D8] space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white border border-[#E0D0D4] flex items-center justify-center text-sm shadow-xs overflow-hidden">
              {settings.logoUrl ? (
                <img src={settings.logoUrl} alt="شعار المقرأة" className="w-full h-full object-contain" />
              ) : (
                <img src="/pwa-192x192.png" alt="شعار المقرأة" className="w-full h-full object-contain" />
              )}
            </div>
            <div>
              <div className="text-xs font-bold text-stone-900">تطبيق {settings.name || 'غيث الغيم'}</div>
              <div className="text-[10px] text-stone-500">يعمل بكفاءة على هاتفكِ وجهازكِ</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleInstallClick}
            className="w-full py-2 px-3 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isInstalled ? 'التطبيق مثبت بالفعل ✅' : 'تثبيت على الشاشة الرئيسية 📲'}</span>
          </button>
        </div>
      )}

      {variant === 'settings' && (
        <div className="p-4 bg-[#FCFAF8] rounded-2xl border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white border border-stone-200 flex items-center justify-center shadow-xs overflow-hidden">
              {settings.logoUrl ? (
                <img src={settings.logoUrl} alt="شعار" className="w-full h-full object-contain" />
              ) : (
                <img src="/pwa-192x192.png" alt="شعار" className="w-full h-full object-contain" />
              )}
            </div>
            <div>
              <strong className="block text-xs font-bold text-stone-900">
                تثبيت التطبيق على الجوال أو الحاسوب (PWA):
              </strong>
              <p className="text-[11px] text-stone-500">
                يمكنكِ تثبيت تطبيق المقرأة ليعمل مثل التطبيقات الأصلية بشعار المقرأة وسرعة تامة
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleInstallClick}
            className="px-4 py-2.5 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
          >
            <Smartphone className="w-4 h-4" />
            <span>{isInstalled ? 'التطبيق مثبت ✅' : 'تثبيت التطبيق الآن 📲'}</span>
          </button>
        </div>
      )}

      {/* Installation Guidance Modal */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-white border border-stone-200 overflow-hidden flex items-center justify-center p-1">
                  {settings.logoUrl ? (
                    <img src={settings.logoUrl} alt="شعار" className="w-full h-full object-contain" />
                  ) : (
                    <img src="/pwa-192x192.png" alt="شعار" className="w-full h-full object-contain" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-stone-900 font-quran">تثبيت تطبيق المقرأة</h3>
                  <span className="text-[10px] text-stone-400">على شاشة هاتفكِ أو حاسوبكِ</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-3 text-xs text-stone-700">
                <p className="font-bold text-stone-900 flex items-center gap-1.5">
                  <span className="text-base">🍏</span>
                  <span>طريقة التثبيت على الآيفون والآيباد (iOS):</span>
                </p>
                <ol className="space-y-2 list-decimal list-inside text-[12px] leading-relaxed bg-[#FAF6F4] p-3.5 rounded-2xl border border-[#EFE8E2]">
                  <li>
                    انقري على زر <strong>المشاركة</strong> (<Share className="w-3.5 h-3.5 inline mx-1 text-sky-600" />) في أسفل شاشة متصفح سفاري Safari.
                  </li>
                  <li>
                    مرري للأسفل واختاري <strong>«إضافة إلى الشاشة الرئيسية»</strong> (<PlusSquare className="w-3.5 h-3.5 inline mx-1 text-emerald-600" />).
                  </li>
                  <li>
                    انقري على <strong>«إضافة» (Add)</strong> في أعلى الزاوية.
                  </li>
                </ol>
                <p className="text-[11px] text-stone-500">
                  سيظهر التطبيق فوراً على شاشتكِ الرئيسية بنفس شعار المقرأة ويعمل بكامل الشاشة وبدون شريط المتصفح! 🪴
                </p>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-stone-700">
                <p className="font-bold text-stone-900 flex items-center gap-1.5">
                  <span className="text-base">📱</span>
                  <span>طريقة التثبيت على الأندرويد والكمبيوتر:</span>
                </p>
                <ol className="space-y-2 list-decimal list-inside text-[12px] leading-relaxed bg-[#FAF6F4] p-3.5 rounded-2xl border border-[#EFE8E2]">
                  <li>
                    انقري على قائمة المتصفح (نقاط القائمة الثلاث <strong>⋮</strong> في أعلى المتصفح).
                  </li>
                  <li>
                    اختاري <strong>«تثبيت التطبيق»</strong> أو <strong>«إضافة إلى الشاشة الرئيسية»</strong>.
                  </li>
                  <li>
                    أكدي التثبيت لتظهر أيقونة المقرأة على سطح المكتب وشاشة الجوال.
                  </li>
                </ol>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full py-2.5 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs font-bold shadow-xs transition"
            >
              فهمت، حسناً
            </button>
          </div>
        </div>
      )}
    </>
  );
};
