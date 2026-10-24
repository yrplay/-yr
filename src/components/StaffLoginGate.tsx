import React, { useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useApp } from '../context/AppContext';
import { User } from '../types';

interface StaffLoginGateProps {
  onClose?: () => void;
}

export const StaffLoginGate: React.FC<StaffLoginGateProps> = ({ onClose }) => {
  const { users, currentUser, switchUser, showToast } = useApp();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConfirmLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) {
      setError('يرجى تحديد المعلمة أو المشرفة');
      return;
    }

    setLoading(true);
    setError('');

    let correctPin = '1234';

    try {
      // التحقق أولاً من الرمز السري في السحابة
      const pinDocRef = doc(db, 'staff_pins', selectedUser.id);
      const pinSnap = await getDoc(pinDocRef);

      if (pinSnap.exists() && pinSnap.data()?.pin) {
        correctPin = pinSnap.data().pin;
        localStorage.setItem(`ghaith_pin_${selectedUser.id}`, correctPin);
      } else {
        correctPin =
          localStorage.getItem(`ghaith_pin_${selectedUser.id}`) ||
          selectedUser.passcode ||
          '1234';
      }
    } catch {
      correctPin =
        localStorage.getItem(`ghaith_pin_${selectedUser.id}`) ||
        selectedUser.passcode ||
        '1234';
    }

    if (pin.trim() === correctPin.trim()) {
      sessionStorage.setItem('ghaith_gate_authorized', 'true');
      sessionStorage.setItem('ghaith_current_user_id', selectedUser.id);
      
      await switchUser(selectedUser.id);
      showToast(`تم تسجيل الدخول بنجاح بصلاحية: ${selectedUser.name}`, 'success');
      
      if (onClose) onClose();
      window.location.reload();
    } else {
      setError('الرمز السري غير صحيح، لا يمكن تبديل الحساب');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="text-center mb-5">
          <span className="text-3xl">🔒</span>
          <h3 className="text-xl font-bold text-white mt-2">توثيق هوية المعلمة</h3>
          <p className="text-slate-400 text-xs mt-1">
            اختر حسابك وأدخل الرمز السري الخاص بك لمنع العمليات غير المصرح بها
          </p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-300 p-2.5 rounded-lg mb-4 text-xs text-center font-medium">
            {error}
          </div>
        )}

        <div className="space-y-2 max-h-56 overflow-y-auto mb-4 pr-1">
          {users.map((u) => {
            const isSelected = selectedUser?.id === u.id;
            const isCurrent = currentUser?.id === u.id;

            return (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  setSelectedUser(u);
                  setError('');
                  setPin('');
                }}
                className={`w-full text-right p-3 rounded-xl border transition flex items-center justify-between ${
                  isSelected
                    ? 'bg-emerald-600/25 border-emerald-500 text-white shadow-md'
                    : 'bg-slate-900/60 border-slate-700 text-slate-300 hover:bg-slate-700/40'
                }`}
              >
                <div>
                  <div className="font-semibold text-sm flex items-center gap-2">
                    {u.name}
                    {isCurrent && (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                        الحالي
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400">{u.title}</div>
                </div>

                <span className="text-xs px-2.5 py-1 bg-slate-800 rounded-lg border border-slate-700 text-slate-400">
                  {u.role === 'leader' ? 'إدارة' : u.role === 'supervisor' ? 'إشراف' : 'معلمة'}
                </span>
              </button>
            );
          })}
        </div>

        {selectedUser && (
          <form onSubmit={handleConfirmLogin} className="space-y-3 pt-3 border-t border-slate-700">
            <div>
              <label className="block text-xs text-slate-300 mb-1">
                الرمز السري لـ <span className="text-emerald-400 font-semibold">{selectedUser.name}</span>
              </label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                maxLength={6}
                required
                autoFocus
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-center text-lg tracking-widest focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium py-2 rounded-lg transition disabled:opacity-50"
              >
                {loading ? 'جاري التحقق...' : 'تأكيد الدخول'}
              </button>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm py-2 rounded-lg transition"
                >
                  إلغاء
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
