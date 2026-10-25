import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Menu, Key, LogOut, History, Shield, Cloud, CloudCheck,
  CheckCircle2, AlertCircle, Settings as SettingsIcon, Sparkles
} from 'lucide-react';

export interface HeaderProps {
  onToggleSidebar?: () => void;
  onOpenQuickModal?: (type: string) => void;
  onNavigateToStudent?: (studentId: string) => void;
  onLockSession?: () => void;
  onNavigateToSettings?: () => void;
  onOpenAuditLog?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  onOpenQuickModal,
  onNavigateToStudent,
  onLockSession,
  onNavigateToSettings,
  onOpenAuditLog
}) => {
  const { settings, cloudStatus, currentUser } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [message, setMessage] = useState({ text: '', isError: false });

  const currentUserId = (typeof window !== 'undefined' ? sessionStorage.getItem('ghaith_current_user_id') : null) || currentUser?.id || 'u-1';
  const primaryColor = settings?.primaryColor || '#8E5364';

  const handleChangePin = (e: React.FormEvent) => {
    e.preventDefault();
    const activePin = (typeof window !== 'undefined' ? localStorage.getItem(`ghaith_pin_${currentUserId}`) : null) || '1234';

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

    if (typeof window !== 'undefined') {
      localStorage.setItem(`ghaith_pin_${currentUserId}`, newPin.trim());
    }
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
    if (onLockSession) {
      onLockSession();
      return;
    }
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('ghaith_gate_authorized');
      sessionStorage.removeItem('ghaith_current_user_id');
      sessionStorage.removeItem('ghaith_authenticated');
      window.location.reload();
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-[#FCFAF8] border-b border-[#EBE3DC] px-4 sm:px-6 py-2.5 flex items-center justify-between" dir="rtl">
        {/* Right side: Sidebar toggle and Brand title */}
        <div className="flex items-center gap-3">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="p-2 rounded-xl text-stone-600 hover:bg-[#F2ECE6] hover:text-stone-900 transition cursor-pointer"
              aria-label="القائمة الجانبية"
              title="القائمة الجانبية"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white border border-[#E0D0D4] flex items-center justify-center shadow-xs overflow-hidden shrink-0">
              {settings?.logoUrl ? (
                <img
                  src={settings.logoUrl}
                  alt={settings.name || 'مقرأة غيث الغيم'}
                  className="w-full h-full object-contain p-0.5"
                />
              ) : (
                <span className="text-xl">🪴</span>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-stone-900 font-quran text-base sm:text-lg leading-tight">
                  {settings?.name || 'مقرأة غيث الغيم'}
                </span>
                <span
                  className="hidden md:inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  نظام التمكين القرآني
                </span>
              </div>
              <p className="text-[11px] text-stone-500 hidden sm:block">
                {settings?.motto || 'المقرأة القرآنية النموذجية وحلقات الحفظ المتقن'}
              </p>
            </div>
          </div>
        </div>

        {/* Left side actions */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Cloud Sync indicator */}
          <div
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold"
            title="حالة الاتصال بالسحابة وقاعدة البيانات"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px]">مزامنة سحابية متصلة</span>
          </div>

          {/* Direct Audit Log button */}
          {onOpenAuditLog && (
            <button
              onClick={onOpenAuditLog}
              className="text-xs bg-[#FAF5F2] hover:bg-[#F2ECE6] text-stone-700 px-3 py-1.5 rounded-xl border border-[#E2D5CC] font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="عرض سجل التعديلات والعمليات الإدارية"
            >
              <History className="w-3.5 h-3.5 text-[#8E5364]" />
              <span className="hidden sm:inline">سجل التعديلات</span>
            </button>
          )}

          {/* Change PIN button */}
          <button
            onClick={() => setShowModal(true)}
            className="text-xs bg-[#FAF5F2] hover:bg-[#F2ECE6] text-stone-700 px-3 py-1.5 rounded-xl border border-[#E2D5CC] font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="تغيير رمز الدخول السري للمعلمة"
          >
            <Key className="w-3.5 h-3.5 text-amber-600" />
            <span className="hidden sm:inline">تغيير رمزي السري</span>
          </button>

          {/* Logout button */}
          <button
            onClick={handleLogout}
            className="text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 px-3 py-1.5 rounded-xl border border-rose-200 font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="تسجيل الخروج وقفل الجلسة"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-600" />
            <span className="hidden sm:inline">تسجيل خروج</span>
          </button>
        </div>
      </header>

      {/* نافذة تغيير الرمز السري للمعلمة */}
      {showModal && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white border border-stone-200 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-base font-bold text-stone-900 mb-1 flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-sm border border-amber-200">
                🔑
              </span>
              <span>تغيير الرمز السري الخاص بكِ</span>
            </h3>
            <p className="text-xs text-stone-500 mb-4">
              رمز الدخول السري خاص بحسابكِ الحالي ومحفوظ في هذا الجهاز
            </p>

            {message.text && (
              <div
                className={`p-2.5 rounded-xl text-xs mb-3 text-center font-bold ${
                  message.isError
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}
              >
                {message.text}
              </div>
            )}

            <form onSubmit={handleChangePin} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">الرمز السري الحالي</label>
                <input
                  type="password"
                  value={oldPin}
                  onChange={(e) => setOldPin(e.target.value)}
                  placeholder="••••"
                  maxLength={6}
                  required
                  autoFocus
                  className="w-full bg-[#FAF8F5] border border-stone-300 rounded-xl px-3 py-2 text-stone-900 text-center font-mono tracking-widest text-lg focus:border-[#8E5364] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">الرمز الجديد (٤ أرقام فأكثر)</label>
                <input
                  type="password"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="••••"
                  maxLength={6}
                  required
                  className="w-full bg-[#FAF8F5] border border-stone-300 rounded-xl px-3 py-2 text-stone-900 text-center font-mono tracking-widest text-lg focus:border-[#8E5364] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">تأكيد الرمز الجديد</label>
                <input
                  type="password"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  placeholder="••••"
                  maxLength={6}
                  required
                  className="w-full bg-[#FAF8F5] border border-stone-300 rounded-xl px-3 py-2 text-stone-900 text-center font-mono tracking-widest text-lg focus:border-[#8E5364] focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-[#8E5364] hover:bg-[#744251] text-white text-xs font-bold py-2.5 rounded-xl transition cursor-pointer shadow-xs"
                >
                  حفظ الرمز
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setMessage({ text: '', isError: false });
                  }}
                  className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold py-2.5 rounded-xl transition cursor-pointer"
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
