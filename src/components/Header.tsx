import React, { useState } from 'react';

export const Header: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [message, setMessage] = useState({ text: '', isError: false });

  const currentUserId = sessionStorage.getItem('ghaith_current_user_id') || 'u-1';

  const handleChangePin = (e: React.FormEvent) => {
    e.preventDefault();
    const activePin = localStorage.getItem(`ghaith_pin_${currentUserId}`) || '1234';

    if (oldPin.trim() !== activePin) {
      setMessage({ text: 'الرمز الحالي غير صحيح', isError: true });
      return;
    }

    if (newPin.trim().length < 4) {
      setMessage({ text: 'يجب أن يكون الرمز الجديد 4 أرقام على الأقل', isError: true });
      return;
    }

    if (newPin.trim() !== confirmPin.trim()) {
      setMessage({ text: 'الرمز الجديد وتأكيده غير متطابقين', isError: true });
      return;
    }

    // حفظ الرمز الجديد الخاص بهذه المعلمة فقط
    localStorage.setItem(`ghaith_pin_${currentUserId}`, newPin.trim());
    setMessage({ text: 'تم تغيير رمزك السري بنجاح!', isError: false });

    setTimeout(() => {
      setShowModal(false);
      setOldPin('');
      setNewPin('');
      setConfirmPin('');
      setMessage({ text: '', isError: false });
    }, 1200);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('ghaith_gate_authorized');
    sessionStorage.removeItem('ghaith_current_user_id');
    window.location.reload();
  };

  return (
    <>
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-3 flex items-center justify-between" dir="rtl">
        <div className="flex items-center space-x-3 space-x-reverse">
          <span className="text-2xl">🪴</span>
          <span className="text-white font-bold text-lg">مقرأة غيث الغيم</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowModal(true)}
            className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-600 transition"
          >
            🔑 تغيير رمزي السري
          </button>
          <button
            onClick={handleLogout}
            className="text-xs bg-red-500/20 hover:bg-red-500/30 text-red-300 px-3 py-1.5 rounded-lg border border-red-500/30 transition"
          >
            تسجيل خروج
          </button>
        </div>
      </header>

      {/* نافذة تغيير الرمز */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span>🔑</span> تغيير الرمز السري الخاص بك
            </h3>

            {message.text && (
              <div
                className={`p-2.5 rounded-lg text-sm mb-3 text-center ${
                  message.isError
                    ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                {message.text}
              </div>
            )}

            <form onSubmit={handleChangePin} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">الرمز السري الحالي</label>
                <input
                  type="password"
                  value={oldPin}
                  onChange={(e) => setOldPin(e.target.value)}
                  placeholder="••••"
                  maxLength={6}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-center focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">الرمز الجديد</label>
                <input
                  type="password"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="••••"
                  maxLength={6}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-center focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">تأكيد الرمز الجديد</label>
                <input
                  type="password"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  placeholder="••••"
                  maxLength={6}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-center focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium py-2 rounded-lg transition"
                >
                  حفظ الرمز
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setMessage({ text: '', isError: false });
                  }}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm py-2 rounded-lg transition"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
