import React, { useEffect, useState } from 'react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { AlertCircle, Eye, EyeOff, Lock, LogIn, Mail, Moon, Sun, X } from 'lucide-react';
import { auth, db } from '../firebase';
import { useApp } from '../context/AppContext';

interface StaffLoginGateProps {
  onSuccess?: () => void;
  onClose?: () => void;
  initialError?: string;
}

const normalizeEmail = (value?: string | null) => value?.trim().toLowerCase() || '';

const loginErrorMessage = (error: unknown) => {
  const code = (error as { code?: string })?.code;
  if (code === 'auth/user-not-found' || code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
    return 'تعذر التحقق من البريد أو كلمة المرور. تأكدي من بيانات حساب Firebase Email/Password.';
  }
  if (code === 'auth/invalid-email') return 'صيغة البريد الإلكتروني غير صحيحة.';
  if (code === 'auth/too-many-requests') return 'تم إيقاف محاولات الدخول مؤقتاً لكثرتها. حاولي لاحقاً.';
  if (code === 'permission-denied' || code === 'firestore/permission-denied') {
    return 'تعذر قراءة صلاحية الحساب. تحققي من نشر قواعد Firestore ومن إعداد وثيقة staff_access/{uid}.';
  }
  return 'تعذر تسجيل الدخول. تحققي من الاتصال وإعداد حساب Firebase ثم حاولي مجدداً.';
};

export const StaffLoginGate: React.FC<StaffLoginGateProps> = ({ onSuccess, onClose, initialError = '' }) => {
  const { users, switchUser, showToast, settings, isDarkMode, toggleTheme } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError);

  useEffect(() => {
    if (initialError) setError(initialError);
  }, [initialError]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const cleanEmail = normalizeEmail(email);
      const credential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const accessSnapshot = await getDoc(doc(db, 'staff_access', credential.user.uid));
      if (!accessSnapshot.exists()) throw new Error('bootstrap-missing');

      const access = accessSnapshot.data();
      const staffId = typeof access.staffId === 'string' ? access.staffId.trim() : '';
      const role = typeof access.role === 'string' ? access.role.trim() : '';
      if (access.active !== true || !staffId || !role) throw new Error('bootstrap-inactive');

      const authEmail = normalizeEmail(credential.user.email);
      const linkedUser = users.find((user) => {
        const userEmail = normalizeEmail(user.email);
        const staffIdMatches = staffId === user.id || normalizeEmail(staffId) === userEmail;
        return staffIdMatches || (Boolean(authEmail) && userEmail === authEmail);
      });
      if (!linkedUser) throw new Error('bootstrap-user-missing');
      if (linkedUser.email && authEmail && normalizeEmail(linkedUser.email) !== authEmail) {
        throw new Error('bootstrap-email-mismatch');
      }
      if (linkedUser.role !== role) throw new Error('bootstrap-role-mismatch');

      const switched = await switchUser(linkedUser.id);
      if (!switched) throw new Error('bootstrap-user-missing');
      showToast(`مرحباً بكِ أ. ${linkedUser.name} (${linkedUser.title})`, 'success');
      onSuccess?.();
      onClose?.();
    } catch (loginError) {
      const reason = (loginError as Error)?.message;
      const bootstrapMessages: Record<string, string> = {
        'bootstrap-missing': 'تم التحقق من كلمة المرور، لكن لا توجد وثيقة staff_access لهذا الحساب. يلزم إنشاء staff_access/{uid} وتفعيلها قبل الدخول.',
        'bootstrap-inactive': 'وثيقة staff_access موجودة لكنها غير مفعّلة أو ينقصها staffId/role. راجعي إدارة النظام قبل الدخول.',
        'bootstrap-user-missing': 'لا يوجد سجل موظفة مطابق في بيانات المستخدمين. راجعي staffId والبريد في users ووثيقة staff_access.',
        'bootstrap-email-mismatch': 'البريد في حساب Firebase لا يطابق البريد المسجل للموظفة. راجعي الربط الإداري قبل الدخول.',
        'bootstrap-role-mismatch': 'الدور في staff_access لا يطابق دور سجل الموظفة. صححي الربط الإداري قبل الدخول.'
      };
      const message = bootstrapMessages[reason] || loginErrorMessage(loginError);
      setError(message);
      showToast(message, 'error');
      if (auth.currentUser) {
        try { await signOut(auth); } catch { /* Keep the actionable login error. */ }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/75 dark:bg-black/85 backdrop-blur-xs z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-[#FCFAF8] dark:bg-[#16161A] border border-[#E8D5D8] dark:border-stone-800 rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl relative">
        <button type="button" onClick={toggleTheme} title={isDarkMode ? 'التبديل للوضع النهاري' : 'التبديل للوضع الليلي'} className="absolute top-5 left-5 p-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 shadow-2xs">
          {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-[#8E5364] dark:text-[#E8A5B8]" />}
        </button>
        {onClose && <button type="button" onClick={onClose} title="إغلاق" className="absolute top-5 right-5 p-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-500"><X className="w-4 h-4" /></button>}

        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-[#FAF0F3] dark:bg-[#2A1B22] border border-[#E8D5D8] dark:border-[#5B3946] text-[#8E5364] dark:text-[#E8A5B8] flex items-center justify-center mb-3 text-3xl">📖</div>
          <h2 className="text-xl sm:text-2xl font-bold font-quran text-stone-900 dark:text-stone-100">{settings?.name || 'مقرأة غيث الغيم'}</h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 font-medium">بوابة الدخول الرسمية للكادر التعليمي والإداري</p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-2.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-[11px] font-semibold"><Lock className="w-3 h-3 shrink-0" /><span>يلزم حساب Firebase مفعّل وصلاحية موظفة معتمدة</span></div>
        </div>

        {error && <div role="alert" className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 p-3.5 rounded-2xl mb-5 text-xs text-right font-bold flex items-start gap-2"><AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" /><span className="leading-relaxed">{error}</span></div>}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="staff-email" className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-[#8E5364]" /><span>البريد الإلكتروني:</span></label>
            <input id="staff-email" type="email" autoComplete="username" value={email} onChange={(event) => { setEmail(event.target.value); setError(''); }} placeholder="teacher@example.org" required autoFocus dir="ltr" className="w-full bg-white dark:bg-stone-900 border border-[#E2D5CC] dark:border-stone-700 rounded-2xl px-4 py-2.5 text-stone-900 dark:text-stone-100 text-sm font-medium focus:border-[#8E5364] focus:outline-hidden" />
          </div>
          <div>
            <label htmlFor="staff-password" className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">كلمة المرور:</label>
            <div className="relative">
              <input id="staff-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => { setPassword(event.target.value); setError(''); }} required dir="ltr" className="w-full bg-white dark:bg-stone-900 border border-[#E2D5CC] dark:border-stone-700 rounded-2xl px-4 py-2.5 text-stone-900 dark:text-stone-100 text-sm font-medium focus:border-[#8E5364] focus:outline-hidden" />
              <button type="button" onClick={() => setShowPassword((shown) => !shown)} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 p-1" title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}>{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full bg-[#8E5364] hover:bg-[#744251] text-white text-sm font-bold py-3 rounded-2xl transition disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <><span className="animate-spin">⏳</span><span>جارٍ التحقق من الحساب والصلاحية...</span></> : <><LogIn className="w-4 h-4" /><span>تسجيل الدخول للمنصة</span></>}
          </button>
        </form>
        <p className="mt-4 text-center text-[10px] text-stone-400 leading-relaxed">لا يوجد دخول تجريبي أو PIN محلي. إذا لم يتم إعداد الحساب، تواصلي مع الإدارة.</p>
      </div>
    </div>
  );
};
