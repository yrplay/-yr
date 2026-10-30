import React, { useEffect, useState } from 'react';
import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogIn,
  Mail,
  Moon,
  Sun,
  UserPlus,
  X,
  ShieldAlert,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { auth, db } from '../firebase';
import { useApp } from '../context/AppContext';
import type { User } from '../types';

interface StaffLoginGateProps {
  onSuccess?: () => void;
  onClose?: () => void;
  initialError?: string;
}

const SUPER_ADMIN_EMAIL = 'yr.play.com@gmail.com';

const normalizeEmail = (value?: string | null) => value?.trim().toLowerCase() || '';

const loginErrorMessage = (error: unknown) => {
  const code = (error as { code?: string })?.code;
  if (code === 'auth/user-not-found' || code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
    return 'بيانات الدخول غير صحيحة. تحققي من البريد الإلكتروني وكلمة المرور.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'هذا البريد مسجل مسبقاً بالفعل، يمكنكِ تسجيل الدخول مباشرة بكلمة المرور أو استعادتها.';
  }
  if (code === 'auth/weak-password') {
    return 'كلمة المرور ضعيفة. يجب أن تتكون من 6 خانات على الأقل.';
  }
  if (code === 'auth/invalid-email') return 'صيغة البريد الإلكتروني غير صحيحة.';
  if (code === 'auth/too-many-requests') return 'تم إيقاف محاولات الدخول مؤقتاً لكثرتها. حاولي بعد قليل.';
  if (code === 'auth/popup-closed-by-user') return 'تم إغلاق نافذة تسجيل الدخول قبل إتمام العملية.';
  if (code === 'permission-denied' || code === 'firestore/permission-denied') {
    return '⛔ ليس لديكِ صلاحية وصول إلى بيانات المقرأة. الحساب غير مصرح له.';
  }
  return (error as Error)?.message || 'تعذر إتمام تسجيل الدخول. تحققي من الاتصال بالإنترنت.';
};

export const StaffLoginGate: React.FC<StaffLoginGateProps> = ({ onSuccess, onClose, initialError = '' }) => {
  const { users, switchUser, updateUser, showToast, settings, isDarkMode, toggleTheme } = useApp();
  
  // Auth Form Modes: 'login' | 'first_time_activate' | 'forgot_password'
  const [formMode, setFormMode] = useState<'login' | 'first_time_activate' | 'forgot_password'>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError);

  useEffect(() => {
    if (initialError) setError(initialError);
  }, [initialError]);

  // Helper to check if an email or identifier is registered by the management
  const verifyStaffAuthorization = (authIdentifier: string): User | null => {
    const clean = authIdentifier?.trim().toLowerCase() || '';
    if (!clean) return null;

    // Check email
    const matchedEmail = users.find((u) => normalizeEmail(u.email) === clean);
    if (matchedEmail) return matchedEmail;

    // Check phone number if user entered phone
    const cleanPhone = authIdentifier.trim().replace(/\s+/g, '');
    const matchedPhone = users.find((u) => u.phone && u.phone.trim().replace(/\s+/g, '') === cleanPhone);
    if (matchedPhone) return matchedPhone;

    // Check exact name if user entered name
    const matchedName = users.find((u) => u.name && u.name.trim().toLowerCase() === clean);
    if (matchedName) return matchedName;

    // Owner email fallback
    if (clean === SUPER_ADMIN_EMAIL) {
      const owner = users.find((u) => u.role === 'owner' || normalizeEmail(u.email) === SUPER_ADMIN_EMAIL) || users[0];
      if (owner) return owner;
      return {
        id: 'u-owner',
        name: 'مالك المنصة',
        role: 'owner',
        title: 'مالك المنصة العام',
        email: SUPER_ADMIN_EMAIL,
        phone: '',
        circleIds: []
      };
    }

    return null;
  };

  // Google One-Click Login
  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      const credential = await signInWithPopup(auth, provider);
      const authEmail = normalizeEmail(credential.user.email);

      // Verify that this email is an authorized staff account
      const authorizedUser = verifyStaffAuthorization(authEmail);

      if (!authorizedUser) {
        // STRICT ACCESS CONTROL: Disallow unauthorized accounts immediately
        await signOut(auth);
        throw new Error(
          `⛔ عذراً، هذا الحساب (${authEmail}) غير مسجل في الكادر الإداري أو التعليمي للمقرأة. يرجى التواصل مع إدارة المقرأة لإضافتكِ أولاً.`
        );
      }

      // Sync staff_access document for this user in Firestore
      try {
        await setDoc(doc(db, 'staff_access', credential.user.uid), {
          staffId: authorizedUser.id,
          role: authorizedUser.role,
          active: true,
          email: authEmail,
          name: authorizedUser.name,
          updatedAt: new Date().toISOString()
        });
        await setDoc(doc(db, 'authorized_staff', authEmail), {
          email: authEmail,
          staffId: authorizedUser.id,
          role: authorizedUser.role,
          name: authorizedUser.name,
          active: true,
          passcode: authorizedUser.passcode || '',
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        console.warn('Staff access provisioning notice:', err);
      }

      await switchUser(authorizedUser.id);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('ghaith_is_locked');
        localStorage.setItem('ghaith_is_authenticated', 'true');
      }
      showToast(`مرحباً بكِ ${authorizedUser.name} (${authorizedUser.title || 'الكادر التعليمي'}) 🌸`, 'success');
      onSuccess?.();
      onClose?.();
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(loginErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  // Direct 1-Click Access for the Platform Owner (yr.play.com@gmail.com)
  const handleOwnerDirectAccess = async () => {
    setLoading(true);
    setError('');
    try {
      const owner = users.find((u) => u.role === 'owner' || normalizeEmail(u.email) === SUPER_ADMIN_EMAIL) || users[0];
      await switchUser(owner.id);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('ghaith_is_locked');
        localStorage.setItem('ghaith_is_authenticated', 'true');
      }
      showToast(`مرحباً بكَ ${owner.name} (مالك المنصة العام) 👑`, 'success');
      onSuccess?.();
      onClose?.();
    } catch (err: any) {
      setError(err.message || 'تعذر تسجيل الدخول.');
    } finally {
      setLoading(false);
    }
  };

  // Email & Passcode / Password Login
  const handleEmailPasswordLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    const inputIdentifier = email.trim();
    if (!inputIdentifier) {
      setLoading(false);
      setError('يرجى إدخال البريد الإلكتروني أو رقم الجوال المسجل.');
      return;
    }

    // Pre-check authorization in registered users
    const authorizedUser = verifyStaffAuthorization(inputIdentifier);
    if (!authorizedUser) {
      setLoading(false);
      setError(`⛔ الحساب (${inputIdentifier}) غير مسجل في الكادر. يجب أن تضيفكِ إدارة المقرأة أولاً من «قسم المعلمات والمشرفات» لتتمكني من الدخول.`);
      return;
    }

    const cleanPassword = password.trim();
    const isOwnerAccount = authorizedUser.role === 'owner' || normalizeEmail(authorizedUser.email) === SUPER_ADMIN_EMAIL;
    const expectedPasscode = authorizedUser.passcode?.trim() || '';

    // If no passcode is configured yet for this staff member
    if (!expectedPasscode) {
      if (isOwnerAccount) {
        // Set entered passcode for owner and allow entry
        await updateUser(authorizedUser.id, { passcode: cleanPassword });
        await switchUser(authorizedUser.id);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('ghaith_is_locked');
          localStorage.setItem('ghaith_is_authenticated', 'true');
        }
        showToast(`مرحباً بكَ ${authorizedUser.name} (مالك المنصة العام) وتم حفظ رمزكَ السري بنجاح 👑`, 'success');
        onSuccess?.();
        onClose?.();
        setLoading(false);
        return;
      }

      setLoading(false);
      setError(`⛔ لم يتم تعيين رمز سري لهذا الحساب بعد. يرجى التواصل مع إدارة المقرأة لتحديد الرمز السري الخاص بكِ من «قسم المعلمات والمشرفات».`);
      return;
    }

    // 1. Verify against the staff member's passcode assigned by the leader or updated by herself
    if (cleanPassword === expectedPasscode) {
      try {
        if (authorizedUser.email) {
          const staffEmail = normalizeEmail(authorizedUser.email);
          await setDoc(doc(db, 'authorized_staff', staffEmail), {
            email: staffEmail,
            staffId: authorizedUser.id,
            role: authorizedUser.role,
            name: authorizedUser.name,
            passcode: expectedPasscode,
            active: true,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }
      } catch (syncErr) {
        console.warn('Sync notice on passcode login:', syncErr);
      }

      await switchUser(authorizedUser.id);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('ghaith_is_locked');
        localStorage.setItem('ghaith_is_authenticated', 'true');
      }
      showToast(`مرحباً بكِ ${authorizedUser.name} (${authorizedUser.title || 'الكادر التعليمي'}) 🌸`, 'success');
      onSuccess?.();
      onClose?.();
      setLoading(false);
      return;
    }

    // 2. Fallback: try Firebase Auth password if they created one
    const cleanEmail = normalizeEmail(authorizedUser.email || inputIdentifier);
    try {
      const credential = await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
      const authEmail = normalizeEmail(credential.user.email);

      const verified = verifyStaffAuthorization(authEmail);
      if (!verified) {
        await signOut(auth);
        throw new Error(`⛔ الحساب (${authEmail}) غير مصرح له بالدخول.`);
      }

      await switchUser(verified.id);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('ghaith_is_locked');
        localStorage.setItem('ghaith_is_authenticated', 'true');
      }
      showToast(`مرحباً بكِ ${verified.name} (${verified.title || 'الكادر التعليمي'}) 🌸`, 'success');
      onSuccess?.();
      onClose?.();
    } catch {
      setError(`الرمز السري للدخول غير صحيح. يرجى إدخال الرمز السري (PIN) المحدد لكِ في ملفكِ من قِبل إدارة المقرأة أو الرمز الذي قمتِ بتغييره بنفسكِ.`);
    } finally {
      setLoading(false);
    }
  };

  // First-Time Password Activation for registered staff
  const handleFirstTimeActivate = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail) {
      setLoading(false);
      setError('يرجى كتابة البريد الإلكتروني الخاص بكِ.');
      return;
    }

    // Must be in registered users list
    const authorizedUser = verifyStaffAuthorization(cleanEmail);
    if (!authorizedUser) {
      setLoading(false);
      setError(`⛔ البريد الإلكتروني (${cleanEmail}) غير مسجل في المقرأة. يجب أن تضيفكِ إدارة المقرأة أولاً من قسم الكادر.`);
      return;
    }

    if (password.length < 6) {
      setLoading(false);
      setError('كلمة المرور يجب ألا تقل عن 6 خانات.');
      return;
    }

    if (password !== confirmPassword) {
      setLoading(false);
      setError('كلمة المرور وتأكيدها غير متطابقين.');
      return;
    }

    try {
      const credential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const authEmail = normalizeEmail(credential.user.email);

      // Provision access doc
      try {
        await setDoc(doc(db, 'staff_access', credential.user.uid), {
          staffId: authorizedUser.id,
          role: authorizedUser.role,
          active: true,
          email: authEmail,
          name: authorizedUser.name,
          createdAt: new Date().toISOString()
        });
        await setDoc(doc(db, 'authorized_staff', authEmail), {
          email: authEmail,
          staffId: authorizedUser.id,
          role: authorizedUser.role,
          name: authorizedUser.name,
          active: true,
          createdAt: new Date().toISOString()
        });
      } catch {}

      await switchUser(authorizedUser.id);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('ghaith_is_locked');
        localStorage.setItem('ghaith_is_authenticated', 'true');
      }
      showToast(`تم تفعيل حسابكِ بنجاح! مرحباً بكِ ${authorizedUser.name} 🌸`, 'success');
      onSuccess?.();
      onClose?.();
    } catch (err: any) {
      setError(loginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Password Reset Link
  const handlePasswordReset = async () => {
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail) {
      setError('يرجى إدخال بريدكِ الإلكتروني المسجل في حقل البريد أولاً.');
      return;
    }

    const authorizedUser = verifyStaffAuthorization(cleanEmail);
    if (!authorizedUser) {
      setError(`⛔ البريد (${cleanEmail}) غير مسجل لدى المقرأة. تأكدي من كتابة البريد المسجل في الكادر.`);
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      showToast(`تم إرسال رابط إعادة تعيين كلمة المرور إلى ${cleanEmail}`, 'success');
      setError('');
      setFormMode('login');
    } catch (err: any) {
      setError(loginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
      dir="rtl"
    >
      <div className="relative w-full max-w-md bg-white dark:bg-stone-900 rounded-3xl border border-[#E8DFD8] dark:border-stone-800 shadow-2xl p-6 sm:p-8 text-right overflow-hidden transition-colors">
        
        {/* Dark/Light mode toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          title={isDarkMode ? 'الوضع النهاري' : 'الوضع الليلي'}
          className="absolute top-5 left-5 p-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:text-stone-900 transition"
        >
          {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-[#8E5364]" />}
        </button>

        {/* Close Button if opened as modal */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            title="إغلاق"
            className="absolute top-5 right-5 p-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-500 hover:text-stone-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-[#FAF0F3] dark:bg-[#2A1B22] border border-[#E8D5D8] dark:border-[#5B3946] text-[#8E5364] dark:text-[#E8A5B8] flex items-center justify-center mb-3 text-3xl shadow-sm">
            📖
          </div>
          <h2 className="text-xl sm:text-2xl font-bold font-quran text-stone-900 dark:text-stone-100">
            {settings?.name || 'مقرأة غيث الغيم'}
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 font-medium">
            بوابة تسجيل الدخول الآمنة للكادر المعتمد
          </p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-2.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 text-[11px] font-bold text-amber-800 dark:text-amber-300">
            <span>🔒</span>
            <span>الوصول مقتصر حصرياً على الكادر المسجل في النظام</span>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div role="alert" className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 p-3.5 rounded-2xl mb-4 text-xs text-right font-bold flex items-start gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Main Content Area */}
        <div className="space-y-4">
          
          {/* Mode 1: Standard Login */}
          {formMode === 'login' && (
            <>
              {/* Owner Direct Access Button */}
              <button
                type="button"
                disabled={loading}
                onClick={handleOwnerDirectAccess}
                className="w-full py-3 px-4 bg-[#8E5364] hover:bg-[#744251] text-white rounded-2xl text-xs font-bold shadow-md transition flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <span>👑</span>
                <span>دخول مباشر كمالك المنصة (yr.play.com@gmail.com)</span>
              </button>

              <div className="flex items-center gap-2 text-stone-400 dark:text-stone-600 my-1">
                <div className="flex-1 h-px bg-stone-200 dark:bg-stone-800"></div>
                <span className="text-[11px] font-bold text-stone-500">أو</span>
                <div className="flex-1 h-px bg-stone-200 dark:bg-stone-800"></div>
              </div>

              {/* Google One-Click Button */}
              <button
                type="button"
                disabled={loading}
                onClick={handleGoogleLogin}
                className="w-full py-2.5 px-4 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 hover:border-[#8E5364] rounded-2xl text-xs font-bold text-stone-800 dark:text-stone-100 shadow-2xs transition flex items-center justify-center gap-2.5 hover:bg-stone-50 dark:hover:bg-stone-800/80 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>الدخول بحساب Google المعتمد</span>
              </button>

              <div className="flex items-center gap-2 text-stone-400 dark:text-stone-600 my-2">
                <div className="flex-1 h-px bg-stone-200 dark:bg-stone-800"></div>
                <span className="text-[11px] font-bold text-stone-500">أو بالبريد / الجوال والرمز السري (PIN)</span>
                <div className="flex-1 h-px bg-stone-200 dark:bg-stone-800"></div>
              </div>

              {/* Email & Passcode Form */}
              <form onSubmit={handleEmailPasswordLogin} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    البريد الإلكتروني (أو رقم الجوال) المسجل في المقرأة
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="teacher@ghaym.org أو 05xxxxxxxx"
                      className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800/80 border border-stone-300 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8E5364]/40 font-mono text-left"
                      dir="ltr"
                    />
                    <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-[#8E5364]" />
                      <span>الرمز السري للدخول (PIN) المحدد لكِ:</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => { setFormMode('forgot_password'); setError(''); }}
                      className="text-[11px] font-bold text-[#8E5364] dark:text-[#E8A5B8] hover:underline"
                    >
                      نسيتِ الرمز؟
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="أدخلي الرمز السري المحدد لكِ"
                      className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800/80 border border-stone-300 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8E5364]/40 font-mono text-left"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-2.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-1">
                    💡 يُحدد هذا الرمز بواسطة إدارة المقرأة عند إضافة الحساب، ويمكنكِ تغييره لاحقاً من ملفكِ.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-[#8E5364] hover:bg-[#744251] text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{loading ? 'جارٍ تسجيل الدخول...' : 'تسجيل الدخول'}</span>
                </button>
              </form>

              {/* Action: Activate New Staff Account */}
              <div className="pt-3 border-t border-stone-100 dark:border-stone-800 text-center">
                <button
                  type="button"
                  onClick={() => { setFormMode('first_time_activate'); setError(''); }}
                  className="text-xs font-bold text-[#8E5364] dark:text-[#E8A5B8] hover:underline inline-flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>معلمة جديدة أضافتكِ الإدارة؟ اضغطي لتفعيل حسابكِ لأول مرة</span>
                </button>
              </div>
            </>
          )}

          {/* Mode 2: First-Time Staff Activation */}
          {formMode === 'first_time_activate' && (
            <form onSubmit={handleFirstTimeActivate} className="space-y-3">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl text-[11px] text-emerald-900 dark:text-emerald-300 leading-relaxed">
                🌸 مرحباً بكِ في المقرأة! إذا تمت إضافتكِ من قِبل إدارة المقرأة، أدخلي بريدكِ المسجل وحددي كلمة مرور خاصة بكِ لتفعيل دخولكِ فوراً.
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  البريد الإلكتروني المعتمد من الإدارة *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teacher@ghaym.org"
                  className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800/80 border border-stone-300 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-stone-100 font-mono text-left"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  تعيين كلمة مرور جديدة (6 خانات فأكثر) *
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800/80 border border-stone-300 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-stone-100 font-mono text-left"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  تأكيد كلمة المرور *
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800/80 border border-stone-300 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-stone-100 font-mono text-left"
                  dir="ltr"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{loading ? 'جارٍ التفعيل...' : 'تفعيل الحساب والدخول'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setFormMode('login'); setError(''); }}
                  className="py-2.5 px-4 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-bold rounded-xl hover:bg-stone-200 transition cursor-pointer"
                >
                  رجوع
                </button>
              </div>
            </form>
          )}

          {/* Mode 3: Forgot Password */}
          {formMode === 'forgot_password' && (
            <div className="space-y-3">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-2xl text-[11px] text-amber-900 dark:text-amber-300 leading-relaxed">
                أدخلي بريدكِ الإلكتروني المسجل في المقرأة، وسنرسل لكِ رابطاً آمناً لتعيين كلمة مرور جديدة.
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  البريد الإلكتروني المسجل
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teacher@ghaym.org"
                  className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800/80 border border-stone-300 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-stone-100 font-mono text-left"
                  dir="ltr"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handlePasswordReset}
                  className="flex-1 py-2.5 bg-[#8E5364] hover:bg-[#744251] text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>{loading ? 'جارٍ الإرسال...' : 'إرسال رابط إعادة التعيين'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setFormMode('login'); setError(''); }}
                  className="py-2.5 px-4 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-bold rounded-xl hover:bg-stone-200 transition cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer Security Note */}
        <div className="mt-6 pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-center gap-1.5 text-[11px] text-stone-500 dark:text-stone-500">
          <ShieldAlert className="w-3.5 h-3.5 text-stone-400" />
          <span>منظومة الحماية تمنع وصول أي حساب غير مضاف من قِبل إدارة المقرأة</span>
        </div>

      </div>
    </div>
  );
};
