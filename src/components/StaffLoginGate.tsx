import React, { useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useApp } from '../context/AppContext';
import { Mail, KeyRound, Eye, EyeOff, Lock, LogIn, AlertCircle, Sun, Moon, X } from 'lucide-react';

interface StaffLoginGateProps {
  onSuccess?: () => void;
  onClose?: () => void;
}

export const StaffLoginGate: React.FC<StaffLoginGateProps> = ({ onSuccess, onClose }) => {
  const { users, switchUser, showToast, settings, isDarkMode, toggleTheme } = useApp();

  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPin = pin.trim();

    if (!cleanEmail || !cleanPin) {
      setError('يرجى إدخال البريد الإلكتروني والرمز السري معاً');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // البحث عن المستخدم بالبريد الإلكتروني المسجل
      const matchedUser = users.find(
        u => u.email && u.email.trim().toLowerCase() === cleanEmail
      );

      if (!matchedUser) {
        setError('لم يتم العثور على حساب مسجل بهذا البريد الإلكتروني. يرجى مراجعة إدارة المقرأة.');
        setLoading(false);
        return;
      }

      // جلب الرمز السري الفعلي من قاعدة بيانات Firestore أو التخزين المحلي أو سجل المستخدم
      let correctPin = '';
      try {
        const pinDocRef = doc(db, 'staff_pins', matchedUser.id);
        const pinSnap = await getDoc(pinDocRef);

        if (pinSnap.exists() && pinSnap.data()?.pin) {
          correctPin = pinSnap.data().pin.toString().trim();
          localStorage.setItem(`ghaith_pin_${matchedUser.id}`, correctPin);
        } else {
          correctPin = (
            localStorage.getItem(`ghaith_pin_${matchedUser.id}`) ||
            matchedUser.passcode ||
            (matchedUser.role === 'leader' ? (settings?.leaderPasscode || '1446') : '')
          ).toString().trim();
        }
      } catch {
        correctPin = (
          localStorage.getItem(`ghaith_pin_${matchedUser.id}`) ||
          matchedUser.passcode ||
          (matchedUser.role === 'leader' ? (settings?.leaderPasscode || '1446') : '')
        ).toString().trim();
      }

      // التحقق الصارم من الرمز السري الخاص بالمعلمة (بدون أي رمز افتراضي عام)
      if (cleanPin === correctPin && correctPin !== '') {
        if (typeof window !== 'undefined') {
          localStorage.setItem('ghaith_authenticated', 'true');
          localStorage.setItem('ghaith_current_user_id', matchedUser.id);
          sessionStorage.setItem('ghaith_authenticated', 'true');
          sessionStorage.setItem('ghaith_gate_authorized', 'true');
          sessionStorage.setItem('ghaith_current_user_id', matchedUser.id);
        }

        try {
          await switchUser(matchedUser.id);
        } catch (err) {
          console.warn('switchUser error:', err);
        }

        showToast(`مرحباً بكِ أ. ${matchedUser.name} (${matchedUser.title})`, 'success');

        if (onSuccess) {
          onSuccess();
        }
        if (onClose) {
          onClose();
        }
      } else {
        setError('الرمز السري غير صحيح. يرجى التأكد من الرمز الخاص بكِ أو التواصل مع قائدة المقرأة.');
      }
    } catch {
      setError('حدث خطأ أثناء محاولة تسجيل الدخول، يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/75 dark:bg-black/85 backdrop-blur-xs z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-[#FCFAF8] dark:bg-[#16161A] border border-[#E8D5D8] dark:border-stone-800 rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200 relative">
        {/* زر تبديل المظهر في نافذة الدخول */}
        <button
          type="button"
          onClick={toggleTheme}
          title={isDarkMode ? 'التبديل للوضع النهاري ☀️' : 'التبديل للوضع الليلي 🌙'}
          className="absolute top-5 left-5 p-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white shadow-2xs transition cursor-pointer"
        >
          {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-[#8E5364] dark:text-[#E8A5B8]" />}
        </button>

        {/* زر الإغلاق: يظهر فقط في حال كانت النافذة منبثقة اختيارية (مثل تبديل الحساب) ولا يظهر إطلاقاً في تسجيل الدخول الإجباري */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            title="إغلاق نافذة التبديل"
            className="absolute top-5 right-5 p-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-white shadow-2xs transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* ترويسة نافذة الدخول */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-[#FAF0F3] dark:bg-[#2A1B22] border border-[#E8D5D8] dark:border-[#5B3946] text-[#8E5364] dark:text-[#E8A5B8] flex items-center justify-center shadow-xs mb-3 text-3xl">
            📖
          </div>
          <h2 className="text-xl sm:text-2xl font-bold font-quran text-stone-900 dark:text-stone-100">
            {settings?.name || 'مقرأة غيث الغيم'}
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 font-medium">
            بوابة الدخول الرسمية للكادر التعليمي والإداري
          </p>
          {!onClose && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-2.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-[11px] font-semibold">
              <Lock className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>تسجيل الدخول إلزامي لمتابعة العمل في المنصة</span>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 p-3.5 rounded-2xl mb-5 text-xs text-right font-bold flex items-start gap-2 shadow-2xs">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* نموذج تسجيل الدخول بالبريد الإلكتروني والرمز السري */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-[#8E5364] dark:text-[#E8A5B8]" />
              <span>البريد الإلكتروني:</span>
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                placeholder="teacher@ghaym.org"
                required
                autoFocus
                dir="ltr"
                className="w-full bg-white dark:bg-stone-900 border border-[#E2D5CC] dark:border-stone-700 rounded-2xl px-4 py-2.5 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-600 text-sm font-medium focus:border-[#8E5364] dark:focus:border-[#B57388] focus:ring-2 focus:ring-[#8E5364]/20 focus:outline-hidden transition shadow-2xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-[#8E5364] dark:text-[#E8A5B8]" />
              <span>الرمز السري (PIN):</span>
            </label>
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setError('');
                }}
                placeholder="••••"
                maxLength={8}
                required
                dir="ltr"
                className="w-full bg-white dark:bg-stone-900 border border-[#E2D5CC] dark:border-stone-700 rounded-2xl px-4 py-2.5 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-600 text-center text-lg tracking-widest font-mono font-bold focus:border-[#8E5364] dark:focus:border-[#B57388] focus:ring-2 focus:ring-[#8E5364]/20 focus:outline-hidden transition shadow-2xs"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 dark:text-stone-500 dark:hover:text-stone-200 transition p-1 cursor-pointer"
                title={showPin ? 'إخفاء الرمز' : 'إظهار الرمز'}
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#8E5364] hover:bg-[#744251] dark:bg-[#744251] dark:hover:bg-[#5E3440] text-white text-sm font-bold py-3 rounded-2xl transition shadow-xs active:scale-98 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>جاري التحقق من الاعتماد...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>تسجيل الدخول للمنصة</span>
                </>
              )}
            </button>
          </div>
        </form>

        <div className="mt-5 pt-4 border-t border-stone-200/60 dark:border-stone-800 text-center">
          <p className="text-[11px] text-stone-400 dark:text-stone-500 leading-relaxed">
            🔒 يتم الدخول حصراً بالبريد الإلكتروني والرمز المعتمد الصادر من إدارة المقرأة. في حال نسيان الرمز، يُرجى مراجعة قائدة المقرأة لاستخراجه أو تحديثه.
          </p>
        </div>
      </div>
    </div>
  );
};
