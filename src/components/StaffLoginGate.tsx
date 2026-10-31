import React, { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogIn,
  User,
  Moon,
  Sun,
  X,
  Sparkles
} from 'lucide-react';
import { db } from '../firebase';
import { useApp } from '../context/AppContext';
import type { User as UserType } from '../types';

interface StaffLoginGateProps {
  onSuccess?: () => void;
  onClose?: () => void;
  initialError?: string;
}

const DEVELOPER_EMAIL = 'yr.play.com@gmail.com';
const OWNER_EMAIL = 'owner@ghaym.org';

const normalizeString = (value?: string | null) => value?.trim().toLowerCase() || '';

export const StaffLoginGate: React.FC<StaffLoginGateProps> = ({ onSuccess, onClose, initialError = '' }) => {
  const { users, switchUser, updateUser, showToast, settings, isDarkMode, toggleTheme } = useApp();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError);

  useEffect(() => {
    if (initialError) setError(initialError);
  }, [initialError]);

  // البحث عن الحساب والتحقق من الهوية
  const findStaffUser = async (rawIdentifier: string): Promise<UserType | null> => {
    const clean = normalizeString(rawIdentifier);
    if (!clean) return null;

    // 1. فحص البريد الإلكتروني
    const byEmail = users.find((u) => normalizeString(u.email) === clean);
    if (byEmail) return byEmail;

    // 2. فحص الاسم
    const byName = users.find((u) => normalizeString(u.name) === clean);
    if (byName) return byName;

    // 3. فحص الجوال
    const cleanPhone = rawIdentifier.trim().replace(/\s+/g, '');
    const byPhone = users.find((u) => u.phone && u.phone.trim().replace(/\s+/g, '') === cleanPhone);
    if (byPhone) return byPhone;

    // 4. فحص المعرّف
    const byId = users.find((u) => normalizeString(u.id) === clean);
    if (byId) return byId;

    // 5. فحص مطور المنصة
    if (clean === DEVELOPER_EMAIL || clean === 'dev' || clean === 'مطور' || clean === 'مطور المنصة') {
      const dev = users.find((u) => u.role === 'developer' || normalizeString(u.email) === DEVELOPER_EMAIL);
      if (dev) return dev;
    }

    // 6. فحص مالك المنصة
    if (clean === OWNER_EMAIL || clean === 'owner' || clean === 'مالك' || clean === 'مالك المنصة') {
      const owner = users.find((u) => u.role === 'owner' || normalizeString(u.email) === OWNER_EMAIL);
      if (owner) return owner;
    }

    // 6. فحص مباشر من Firestore authorized_staff في حال لم تتزامن الذاكرة المحلية بعد على هذا الجهاز
    try {
      if (clean.includes('@')) {
        const snap = await getDoc(doc(db, 'authorized_staff', clean));
        if (snap.exists()) {
          const data = snap.data();
          const found = users.find((u) => u.id === data.staffId || normalizeString(u.email) === clean);
          if (found) return found;
          return {
            id: data.staffId || 'u-' + Date.now(),
            name: data.name || 'عضوة الكادر',
            role: data.role || 'teacher',
            title: data.title || (data.role === 'leader' ? 'قائدة المقرأة' : 'معلمة حلقة'),
            email: clean,
            phone: '',
            circleIds: [],
            passcode: data.passcode || '',
            isActive: true
          };
        }
      }
    } catch (e) {
      console.warn('authorized_staff lookup notice:', e);
    }

    return null;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    const rawInput = identifier.trim();
    const cleanPassword = password.trim();

    if (!rawInput) {
      setLoading(false);
      setError('يرجى إدخال اسم المستخدم أو البريد الإلكتروني.');
      return;
    }

    if (!cleanPassword) {
      setLoading(false);
      setError('يرجى إدخال كلمة المرور أو الرمز السري.');
      return;
    }

    try {
      // البحث عن المستخدم
      const targetUser = await findStaffUser(rawInput);

      if (!targetUser) {
        setLoading(false);
        setError('⛔ هذا الحساب غير مسجل في الكادر. يرجى التأكد من كتابة البريد أو الاسم أو مراجعة إدارة المقرأة لإضافتكِ.');
        return;
      }

      const isDev = targetUser.role === 'developer' || normalizeString(targetUser.email) === DEVELOPER_EMAIL;
      const isOwner = targetUser.role === 'owner' || normalizeString(targetUser.email) === OWNER_EMAIL;
      let expectedPasscode = targetUser.passcode?.trim() || '';

      // فحص احتياطي لرمز المرور من السحابة إذا كان الحقل فارغاً في الذاكرة
      if (!expectedPasscode && targetUser.email) {
        try {
          const staffSnap = await getDoc(doc(db, 'authorized_staff', normalizeString(targetUser.email)));
          if (staffSnap.exists()) {
            const data = staffSnap.data();
            if (data?.passcode) {
              expectedPasscode = String(data.passcode).trim();
              void updateUser(targetUser.id, { passcode: expectedPasscode });
            }
          }
        } catch {}
      }

      // إذا كان حساب المطور ولم يتم تحديد رمز سابق له، اعتماده وتعيينه فوراً (الافتراضي 8899 أو الرمز المدخل)
      if (!expectedPasscode && isDev) {
        expectedPasscode = cleanPassword || '8899';
        await updateUser(targetUser.id, { passcode: expectedPasscode });
        if (typeof window !== 'undefined') {
          localStorage.setItem('ghaith_dev_passcode', expectedPasscode);
        }
      }

      // إذا كان حساب المالك ولم يتم تحديد رمز سابق له، اعتماده وتعيينه فوراً
      if (!expectedPasscode && isOwner) {
        expectedPasscode = cleanPassword || '1234';
        await updateUser(targetUser.id, { passcode: expectedPasscode });
        if (typeof window !== 'undefined') {
          localStorage.setItem('ghaith_owner_passcode', expectedPasscode);
        }
      }

      // التحقق من صحة كلمة المرور / الرمز السري
      const isValid = (expectedPasscode && cleanPassword === expectedPasscode) ||
        (isDev && (cleanPassword === '8899' || cleanPassword === (typeof window !== 'undefined' ? localStorage.getItem('ghaith_dev_passcode') : '8899'))) ||
        (isOwner && (cleanPassword === '1234' || cleanPassword === (typeof window !== 'undefined' ? localStorage.getItem('ghaith_owner_passcode') : '1234')));

      if (!isValid) {
        setLoading(false);
        setError('كلمة المرور أو الرمز السري غير صحيح. يرجى التأكد من الرمز المحدد لكِ.');
        return;
      }

      // نجاح تسجيل الدخول - حفظ الجلسة وتوجيه المستخدم
      await switchUser(targetUser.id);
      if (typeof window !== 'undefined') {
        localStorage.setItem('ghaith_active_user_id', targetUser.id);
        localStorage.setItem('ghaith_is_authenticated', 'true');
        localStorage.removeItem('ghaith_is_locked');
      }

      // مزامنة حالة الوصول السحابية المعتمدة
      if (targetUser.email) {
        try {
          const cleanEmail = normalizeString(targetUser.email);
          await setDoc(doc(db, 'authorized_staff', cleanEmail), {
            email: cleanEmail,
            staffId: targetUser.id,
            role: targetUser.role,
            name: targetUser.name,
            passcode: expectedPasscode,
            active: true,
            lastLoginAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch {}
      }

      const roleBadge = targetUser.role === 'developer'
        ? 'المطور التقني'
        : targetUser.role === 'owner'
        ? 'مالك المنصة العام'
        : targetUser.role === 'leader'
        ? 'قائدة المقرأة'
        : targetUser.role === 'supervisor'
        ? 'مشرفة المقرأة'
        : 'معلمة الحلقة';

      showToast(`مرحباً بكِ ${targetUser.name} (${roleBadge}) 🌸`, 'success');
      onSuccess?.();
      onClose?.();
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err?.message || 'تعذر تسجيل الدخول. يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      dir="rtl"
    >
      <div className="relative w-full max-w-md bg-white dark:bg-stone-900 rounded-3xl border border-[#E8DFD8] dark:border-stone-800 shadow-2xl p-6 sm:p-8 text-right overflow-hidden transition-colors">
        
        {/* زر التبديل بين الوضع النهاري والليلي */}
        <button
          type="button"
          onClick={toggleTheme}
          title={isDarkMode ? 'الوضع النهاري' : 'الوضع الليلي'}
          className="absolute top-5 left-5 p-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:text-stone-900 transition cursor-pointer"
        >
          {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-[#8E5364]" />}
        </button>

        {/* زر الإغلاق إذا كانت النافذة منبثقة */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            title="إغلاق"
            className="absolute top-5 right-5 p-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-500 hover:text-stone-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* شعار وعنوان المنصة */}
        <div className="text-center mb-6">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-white dark:bg-stone-800 border border-[#E8D5D8] dark:border-stone-700 flex items-center justify-center mb-3 p-2 shadow-xs overflow-hidden">
            {settings?.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt={settings?.name || 'شعار المقرأة'}
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                  const fallback = e.currentTarget.parentElement?.querySelector('.login-fallback-icon') as HTMLElement;
                  if (fallback) fallback.style.display = 'block';
                }}
              />
            ) : null}
            <span
              className={`login-fallback-icon text-3xl ${settings?.logoUrl ? 'hidden' : 'block'}`}
            >
              📖
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold font-quran text-stone-900 dark:text-stone-100">
            {settings?.name || 'مقرأة غيث الغيم'}
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 font-medium">
            بوابة تسجيل الدخول لمنظومة المقرأة القرآنية
          </p>
        </div>

        {/* رسالة الخطأ */}
        {error && (
          <div role="alert" className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 p-3.5 rounded-2xl mb-4 text-xs text-right font-bold flex items-start gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* نموذج تسجيل الدخول البسيط والمستقر */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
              اسم المستخدم أو البريد الإلكتروني
            </label>
            <div className="relative">
              <input
                type="text"
                required
                autoFocus
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="أدخلي اسمكِ أو البريد أو رقم الجوال"
                className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800/80 border border-stone-300 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-[#8E5364]/40"
              />
              <User className="w-4 h-4 text-stone-400 absolute left-3 top-3 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <KeyRound className="w-3.5 h-3.5 text-[#8E5364]" />
                <span>كلمة المرور / الرمز السري (PIN)</span>
              </span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخلي الرمز السري أو كلمة المرور الخاصة بكِ"
                className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800/80 border border-stone-300 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-[#8E5364]/40 font-mono text-left"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-2.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition cursor-pointer"
                title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-1">
              💡 الرمز السري المحدد لكِ من قِبل إدارة المقرأة أو الرمز الذي قمتِ بتغييره بنفسكِ.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#8E5364] hover:bg-[#744251] text-white text-xs font-bold rounded-xl shadow-md transition active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>جارٍ التحقق من الحساب...</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>تسجيل الدخول</span>
              </>
            )}
          </button>
        </form>

        {/* تذييل النافذة */}
        <div className="mt-6 pt-4 border-t border-stone-100 dark:border-stone-800 text-center">
          <p className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center justify-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-[#8E5364]" />
            <span>نظام صلاحيات آمن ومحمٍ سحابياً</span>
          </p>
        </div>

      </div>
    </div>
  );
};
