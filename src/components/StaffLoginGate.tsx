import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useApp } from '../context/AppContext';
import { User } from '../types';
import { ShieldCheck, KeyRound, CheckCircle2, RotateCcw, Sun, Moon } from 'lucide-react';

interface StaffLoginGateProps {
  onClose?: () => void;
}

export const StaffLoginGate: React.FC<StaffLoginGateProps> = ({ onClose }) => {
  const { users, currentUser, switchUser, showToast, settings, isDarkMode, toggleTheme } = useApp();
  
  // تحديد الحساب المختار افتراضياً (القائدة أو الحساب الحالي) لتسهيل الدخول المباشر
  const [selectedUser, setSelectedUser] = useState<User | null>(() => {
    const savedUserId = typeof window !== 'undefined' ? localStorage.getItem('ghaith_current_user_id') : null;
    return users.find(u => u.id === savedUserId) || currentUser || users[0] || null;
  });

  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // في حال تم تحميل قائمة المستخدمين بعد المرة الأولى
  useEffect(() => {
    if (!selectedUser && users.length > 0) {
      const savedUserId = typeof window !== 'undefined' ? localStorage.getItem('ghaith_current_user_id') : null;
      const initial = users.find(u => u.id === savedUserId) || currentUser || users[0];
      setSelectedUser(initial);
    }
  }, [users, currentUser, selectedUser]);

  const handleConfirmLogin = async (e?: React.FormEvent, bypassPin?: string) => {
    if (e) e.preventDefault();
    const activePinInput = bypassPin !== undefined ? bypassPin : pin;

    if (!selectedUser) {
      setError('يرجى تحديد المعلمة أو المشرفة من القائمة');
      return;
    }

    setLoading(true);
    setError('');

    let correctPin = '1234';

    try {
      // التحقق أولاً من السحابة ثم التخزين المحلي
      const pinDocRef = doc(db, 'staff_pins', selectedUser.id);
      const pinSnap = await getDoc(pinDocRef);

      if (pinSnap.exists() && pinSnap.data()?.pin) {
        correctPin = pinSnap.data().pin.toString().trim();
        localStorage.setItem(`ghaith_pin_${selectedUser.id}`, correctPin);
      } else {
        correctPin = (
          localStorage.getItem(`ghaith_pin_${selectedUser.id}`) ||
          selectedUser.passcode ||
          '1234'
        ).toString().trim();
      }
    } catch {
      correctPin = (
        localStorage.getItem(`ghaith_pin_${selectedUser.id}`) ||
        selectedUser.passcode ||
        '1234'
      ).toString().trim();
    }

    // قبول الدخول إذا تطابق الرمز أو كان الرمز الافتراضي 1234
    if (activePinInput.trim() === correctPin || activePinInput.trim() === '1234') {
      if (typeof window !== 'undefined') {
        localStorage.setItem('ghaith_authenticated', 'true');
        localStorage.setItem('ghaith_current_user_id', selectedUser.id);
        sessionStorage.setItem('ghaith_authenticated', 'true');
        sessionStorage.setItem('ghaith_gate_authorized', 'true');
        sessionStorage.setItem('ghaith_current_user_id', selectedUser.id);
      }
      
      try {
        await switchUser(selectedUser.id);
      } catch (err) {
        console.warn('switchUser error:', err);
      }

      showToast(`مرحباً بكِ أ. ${selectedUser.name}`, 'success');
      
      if (onClose) {
        onClose();
      }
    } else {
      setError('الرمز السري غير صحيح. يمكنك استخدام الرمز الافتراضي (1234)');
      setLoading(false);
    }
  };

  const handleResetToDefaultPin = async () => {
    if (!selectedUser) return;
    try {
      setLoading(true);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`ghaith_pin_${selectedUser.id}`, '1234');
      }
      const pinDocRef = doc(db, 'staff_pins', selectedUser.id);
      await setDoc(pinDocRef, {
        userId: selectedUser.id,
        pin: '1234',
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setPin('1234');
      showToast('تمت استعادة الرمز الافتراضي (1234) بنجاح', 'success');
      setError('');
    } catch (err) {
      setPin('1234');
      showToast('تم ضبط الرمز محلياً إلى 1234', 'info');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-[#FCFAF8] border border-[#E8D5D8] rounded-3xl p-6 sm:p-7 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200 relative">
        {/* زر تبديل المظهر في نافذة الدخول */}
        <button
          type="button"
          onClick={toggleTheme}
          title={isDarkMode ? 'التبديل للوضع النهاري ☀️' : 'التبديل للوضع الليلي 🌙'}
          className="absolute top-5 left-5 p-2 rounded-xl bg-white border border-stone-200 text-stone-600 hover:text-stone-900 shadow-2xs transition cursor-pointer"
        >
          {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-[#8E5364]" />}
        </button>

        {/* ترويسة نافذة الدخول */}
        <div className="text-center mb-5">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FAF0F3] border border-[#E8D5D8] text-[#8E5364] flex items-center justify-center shadow-xs mb-3 text-2xl">
            📖
          </div>
          <h2 className="text-lg sm:text-xl font-bold font-quran text-stone-900">
            {settings?.name || 'مقرأة غيث الغيم'}
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            بوابة تسجيل دخول الكادر التعليمي والإداري
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-2xl mb-4 text-xs text-center font-bold">
            {error}
          </div>
        )}

        {/* قائمة اختيار المعلمة أو المشرفة */}
        <div className="mb-4">
          <label className="block text-xs font-bold text-stone-700 mb-2">
            ١. حددي حسابكِ:
          </label>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {users.map((u) => {
              const isSelected = selectedUser?.id === u.id;

              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    setSelectedUser(u);
                    setError('');
                    setPin('');
                  }}
                  className={`w-full text-right p-2.5 rounded-xl border transition flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-[#FAF0F3] border-[#8E5364] text-[#8E5364] shadow-xs ring-1 ring-[#8E5364]/20'
                      : 'bg-white border-[#EBE3DC] text-stone-700 hover:bg-[#FAF7F5]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-[#8E5364]' : 'bg-stone-300'}`} />
                    <div>
                      <div className="font-bold text-xs sm:text-sm text-stone-900">
                        {u.name}
                      </div>
                      <div className="text-[11px] text-stone-500">{u.title}</div>
                    </div>
                  </div>

                  <span className="text-[10px] px-2 py-0.5 rounded-lg bg-stone-100 border border-stone-200 font-bold text-stone-600">
                    {u.role === 'leader' ? 'إدارة' : u.role === 'supervisor' ? 'إشراف' : 'معلمة'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* إدخال الرمز السري */}
        {selectedUser && (
          <form onSubmit={(e) => handleConfirmLogin(e)} className="space-y-3 pt-3 border-t border-[#EBE3DC]">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-stone-700">
                  ٢. الرمز السري لـ <span className="text-[#8E5364]">{selectedUser.name}</span>
                </label>
                <button
                  type="button"
                  onClick={() => setPin('1234')}
                  className="text-[11px] text-[#8E5364] hover:underline font-bold cursor-pointer"
                >
                  تعبئة الافتراضي (1234)
                </button>
              </div>

              <div className="relative">
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="••••"
                  maxLength={6}
                  required
                  autoFocus
                  className="w-full bg-white border border-[#E2D5CC] rounded-xl px-3 py-2.5 text-stone-900 text-center text-lg tracking-widest font-mono focus:border-[#8E5364] focus:outline-hidden"
                />
              </div>

              <p className="text-[11px] text-stone-400 mt-1.5 text-center">
                الرمز الافتراضي لجميع الحسابات: <span className="font-bold font-mono text-stone-600">1234</span>
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-[#8E5364] hover:bg-[#774252] text-white text-xs font-bold py-2.5 rounded-xl transition shadow-xs active:scale-98 cursor-pointer disabled:opacity-50"
              >
                {loading ? 'جاري التحقق...' : 'تأكيد الدخول'}
              </button>
              
              <button
                type="button"
                onClick={() => handleConfirmLogin(undefined, '1234')}
                className="px-3 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-xl transition active:scale-98 cursor-pointer"
                title="دخول مباشر بالرمز الافتراضي 1234"
              >
                دخول سريع (1234)
              </button>
            </div>

            {/* خيار استعادة الرمز */}
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={handleResetToDefaultPin}
                className="text-[11px] text-stone-400 hover:text-stone-600 transition inline-flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>نسيت الرمز؟ اضغط هنا لإعادة ضبطه إلى 1234</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
