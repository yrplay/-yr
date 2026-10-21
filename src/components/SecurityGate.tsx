import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Lock, KeyRound, ShieldCheck, UserCheck, AlertCircle, Sparkles, LogIn } from 'lucide-react';

interface SecurityGateProps {
  children: React.ReactNode;
}

export const SecurityGate: React.FC<SecurityGateProps> = ({ children }) => {
  const { settings, users, currentUser, switchUser, showToast } = useApp();
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    return sessionStorage.getItem('ghaith_session_unlocked') === 'true';
  });

  const [selectedUserId, setSelectedUserId] = useState<string>(currentUser?.id || users[0]?.id || '');
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedUserId && users.length > 0) {
      setSelectedUserId(users[0].id);
    }
  }, [users]);

  // If security is disabled by the leader in settings, bypass gate
  if (settings.securityEnabled === false) {
    return <>{children}</>;
  }

  // If already unlocked in this browser session
  if (isUnlocked) {
    return <>{children}</>;
  }

  const selectedUser = users.find(u => u.id === selectedUserId) || users[0];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);

    if (!selectedUser) {
      setPinError('يرجى اختيار المستخدم أولاً');
      return;
    }

    // Determine correct passcode: user-specific passcode or leader passcode
    const expectedPasscode = selectedUser.passcode || (selectedUser.role === 'leader' ? (settings.leaderPasscode || '1234') : '1234');

    if (enteredPin === expectedPasscode || enteredPin === (settings.leaderPasscode || '1234')) {
      await switchUser(selectedUser.id);
      sessionStorage.setItem('ghaith_session_unlocked', 'true');
      sessionStorage.setItem('ghaith_logged_user_id', selectedUser.id);
      setIsUnlocked(true);
      showToast(`مرحباً بكِ أ. ${selectedUser.name} في منصة غيث الغيم 🪴`, 'success');
    } else {
      setPinError('رمز الدخول غير صحيح! يرجى التأكد من الرمز أو مراجعة قائدة المقرأة.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5ECEE] via-[#F9F7F5] to-[#EBF3EE] flex items-center justify-center p-4 selection:bg-[#E8D5D8] selection:text-[#5B3946] antialiased">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-[#E8DFD8] p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-br from-[#E8D5D8] via-[#F4ECEE] to-[#D8E6DE] flex items-center justify-center text-3xl shadow-xs border border-[#E0D0D4]">
            🪴
          </div>
          <h1 className="text-2xl font-bold text-stone-900 font-quran tracking-tight">
            مقرأة {settings.name}
          </h1>
          <p className="text-xs text-stone-500 font-medium">
            {settings.subtitle} • {settings.activeTrackName || 'مسار مشكاة الغيم للحفظ'}
          </p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FCFAF8] border border-[#EAE2DB] text-[11px] font-semibold text-stone-600 mt-1">
            <Lock className="w-3.5 h-3.5 text-[#8E5364]" />
            <span>بوابة الدخول المعتمد للكادر الإداري والتعليمي</span>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5">
              اختاري اسمكِ / حسابكِ المسجل:
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => {
                setSelectedUserId(e.target.value);
                setPinError(null);
              }}
              className="w-full px-3.5 py-2.5 bg-[#FAF7F4] border border-[#E4DBD3] rounded-2xl text-xs sm:text-sm font-semibold text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-[#8E5364] focus:border-transparent transition"
            >
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} — {u.title} ({u.role === 'leader' ? 'القائدة' : u.role === 'supervisor' ? 'المشرفة' : 'المعلمة'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-stone-700">
                رمز الدخول السري (PIN):
              </label>
              <span className="text-[10px] text-stone-400">
                (الرمز الافتراضي: 1234)
              </span>
            </div>
            <div className="relative">
              <input
                type="password"
                required
                maxLength={10}
                placeholder="أدخلي رمز الدخول (مثال: 1234)"
                value={enteredPin}
                onChange={(e) => {
                  setEnteredPin(e.target.value);
                  setPinError(null);
                }}
                className="w-full pl-10 pr-3.5 py-2.5 bg-[#FAF7F4] border border-[#E4DBD3] rounded-2xl text-center tracking-widest text-sm font-bold text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-[#8E5364] focus:border-transparent transition"
              />
              <KeyRound className="w-4 h-4 text-stone-400 absolute left-3.5 top-3 pointer-events-none" />
            </div>
          </div>

          {pinError && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{pinError}</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 bg-gradient-to-r from-[#8E5364] to-[#744251] hover:from-[#7D4756] hover:to-[#633543] text-white rounded-2xl text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>تسجيل الدخول ومتابعة الأعمال</span>
          </button>
        </form>

        {/* Security Note Footer */}
        <div className="pt-4 border-t border-stone-100 text-center space-y-1">
          <p className="text-[11px] text-stone-500 leading-relaxed">
            🛡️ <strong>حماية وأمان معتمد:</strong> لا يمكن لأي شخص الدخول إلا المعلمات والمشرفات المضافات مسبقاً من قِبل قائدة المقرأة: <strong>{settings.leaderName}</strong>.
          </p>
          <p className="text-[10px] text-stone-400">
            يمكن لقائدة المقرأة تغيير الرموز وإدارة الصلاحيات من قسم الإعدادات.
          </p>
        </div>

      </div>
    </div>
  );
};
