import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Menu, ChevronDown, Lock, KeyRound, Cloud, RefreshCw, UserCheck, Sparkles, Sun, Moon } from 'lucide-react';
import { StaffLoginGate } from './StaffLoginGate';
import { renderUserAvatarBadge } from './IslamicIconLibrary';
import { EditTeacherProfileModal } from './EditTeacherProfileModal';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { isLocalDemoMode } from '../demoMode';

interface HeaderProps {
  onToggleSidebar?: () => void;
  onOpenQuickModal?: (type: string) => void;
  onNavigateToStudent?: (studentId: string) => void;
  onLockSession?: () => void;
  onNavigateToSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  onLockSession,
  onNavigateToSettings,
}) => {
  const { currentUser, circles, settings, showToast, cloudStatus, syncNow, lastSynced, isDarkMode, toggleTheme } = useApp();
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (currentUser?.id) localStorage.removeItem(`ghaith_pin_${currentUser.id}`);
  }, [currentUser?.id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(event.target as Node)
      ) {
        setShowProfileMenu(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowProfileMenu(false);
      }
    };

    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showProfileMenu]);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await syncNow();
    } finally {
      setTimeout(() => setIsSyncing(false), 500);
    }
  };


  const isLeader = currentUser?.role === 'leader';
  const userCircle = circles.find((c) => c.teacherId === currentUser?.id);
  const subtitle = currentUser?.title || (userCircle ? userCircle.name : 'معلمة حلقة');

  const handlePasswordReset = async () => {
    if (isLocalDemoMode) {
      showToast('إعادة تعيين كلمة المرور غير متاحة في وضع المعاينة المحلي', 'info');
      return;
    }
    if (!currentUser?.email) {
      showToast('لا يوجد بريد إلكتروني مسجل لهذا الحساب', 'error');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, currentUser.email);
      showToast(`تم إرسال رابط إعادة تعيين كلمة المرور إلى ${currentUser.email}`, 'success');
    } catch {
      showToast('تعذر إرسال رابط إعادة التعيين. تحققي من إعداد Firebase Auth والبريد المسجل.', 'error');
    }
  };
  return (
    <>
      <header className="sticky top-0 z-30 bg-[#FCFAF8]/95 backdrop-blur-md border-b border-[#EBE3DC] px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between shadow-2xs" dir="rtl">
        {/* الجزء الأيمن: زر فتح القائمة للشاشات الصغيرة وشعار المقرأة */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="lg:hidden p-2 rounded-xl text-stone-600 hover:bg-stone-200/50 active:scale-95 transition"
            aria-label="القائمة الرئيسية"
          >
            <Menu className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => {
              if (isLeader) {
                onNavigateToSettings?.();
              } else {
                showToast('قسم الإعدادات والنسخ الاحتياطي مخصص لإدارة المقرأة فقط 🔒', 'info');
              }
            }}
            title={isLeader ? "الانتقال إلى الإعدادات والنسخ الاحتياطي" : (settings?.name || 'مقرأة غيث الغيم')}
            aria-label="الانتقال إلى الإعدادات"
            className="flex items-center gap-2.5 text-right p-1.5 -m-1.5 rounded-2xl hover:bg-[#722F37]/5 active:scale-98 transition group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#722F37]/30"
          >
            <div className="w-9 h-9 rounded-2xl bg-white border border-[#E0D0D4] flex items-center justify-center p-1 shadow-xs overflow-hidden group-hover:border-[#722F37]/50 group-hover:shadow-sm transition">
              <img
                src={settings?.logoUrl || '/pwa-192x192.png'}
                alt="شعار المقرأة"
                className="w-full h-full object-contain group-hover:scale-105 transition duration-200"
              />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold font-quran text-stone-900 leading-tight group-hover:text-[#722F37] transition">
                {settings?.name || 'مقرأة غيث الغيم'}
              </h1>
              <p className="text-[10px] text-stone-500 hidden sm:block group-hover:text-stone-700 transition">
                {settings?.subtitle || 'المقرأة القرآنية النموذجية'}
              </p>
            </div>
          </button>
        </div>

        {/* الجزء الأيسر: زر التبديل بين الوضع الليلي والنهاري + القائمة المنسدلة لحساب المعلمة */}
        <div className="flex items-center gap-2">
          {/* زر التبديل السريع بين الوضع النهاري والليلي */}
          <button
            type="button"
            onClick={toggleTheme}
            title={isDarkMode ? 'التبديل إلى الوضع النهاري ☀️' : 'التبديل إلى الوضع الليلي 🌙'}
            aria-label={isDarkMode ? 'تفعيل الوضع النهاري' : 'تفعيل الوضع الليلي'}
            className="p-2 sm:px-2.5 sm:py-1.5 rounded-2xl border transition flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95 bg-white hover:bg-stone-50 border-[#E8DFD8] text-stone-700"
          >
            {isDarkMode ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold hidden sm:inline text-amber-300">النهاري</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-[#8E5364]" />
                <span className="text-xs font-bold hidden sm:inline text-stone-700">الليلي</span>
              </>
            )}
          </button>

          <div className="relative" ref={profileDropdownRef}>
            <button
              type="button"
              onClick={() => setShowProfileMenu((prev) => !prev)}
              aria-expanded={showProfileMenu}
              aria-haspopup="true"
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl border transition text-right bg-white hover:bg-[#FAF7F5] border-[#E8D5D8] cursor-pointer shadow-xs active:scale-98"
            >
              <ChevronDown
                className={`w-3.5 h-3.5 text-stone-400 transition-transform duration-200 ${
                  showProfileMenu ? 'rotate-180 text-[#8E5364]' : ''
                }`}
              />

              <div className="text-right">
                <div className="flex items-center gap-1.5 justify-end">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                  <span className="text-xs sm:text-sm font-bold text-stone-800 leading-none">
                    {currentUser?.name || 'أ. ريفة المنصوري'}
                  </span>
                </div>
                <span className="text-[10px] sm:text-[11px] text-stone-500 block mt-0.5 font-normal">
                  {subtitle}
                </span>
              </div>

              {/* الأيقونة الرمزية أو الإيموجي المخصص للمعلمة */}
              <div
                className="w-7 h-7 rounded-xl border flex items-center justify-center text-xs font-bold shrink-0 transition shadow-2xs"
                style={{
                  backgroundColor: `${currentUser?.avatarColor || '#8E5364'}18`,
                  borderColor: `${currentUser?.avatarColor || '#8E5364'}40`,
                  color: currentUser?.avatarColor || '#8E5364'
                }}
                title="شعاركِ المعتمد"
              >
                {renderUserAvatarBadge(currentUser?.avatarIcon, currentUser?.avatarColor || '#8E5364', 'w-4 h-4')}
              </div>
            </button>

            {/* القائمة المنسدلة الأنيقة للملف الشخصي */}
            {showProfileMenu && (
              <div className="absolute left-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-[#EBE3DC] p-2.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                {/* رأس بطاقة المعلمة */}
                <div className="p-3 bg-[#FAF7F5] rounded-xl border border-[#EFE8E2] mb-2 text-right">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      متصلة الآن
                    </span>
                    <span className="text-[11px] text-stone-500 font-semibold">
                      {isLeader ? 'مشرفة المقرأة' : 'معلمة حلقة'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded-lg border flex items-center justify-center text-xs"
                      style={{
                        backgroundColor: `${currentUser?.avatarColor || '#8E5364'}18`,
                        borderColor: `${currentUser?.avatarColor || '#8E5364'}40`,
                        color: currentUser?.avatarColor || '#8E5364'
                      }}
                    >
                      {renderUserAvatarBadge(currentUser?.avatarIcon, currentUser?.avatarColor || '#8E5364', 'w-3.5 h-3.5')}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-stone-900 leading-tight">{currentUser?.name}</p>
                      <p className="text-[11px] text-stone-600 mt-0.5">{subtitle}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 text-right">
                  {/* زر تعديل الملف الشخصي والشعار والتوقيع */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      setShowEditProfileModal(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-stone-800 hover:bg-[#FAF5F2] hover:text-[#8E5364] text-xs font-bold transition text-right cursor-pointer border border-[#8E5364]/20 bg-[#FAF0F3]/50 shadow-2xs group"
                  >
                    <div className="w-6 h-6 rounded-lg bg-[#8E5364]/10 group-hover:bg-[#8E5364] group-hover:text-white flex items-center justify-center text-[#8E5364] transition">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 text-right">
                      <span className="text-stone-900 font-bold block">تعديل ملفي وشعاري وتوقيعي</span>
                      <span className="block text-[10px] text-stone-500 font-normal">الأيقونات والإيموجيات والألوان والتوقيع</span>
                    </div>
                  </button>

                  {/* بطاقة المزامنة السحابية الفورية */}
                  <div className="p-2.5 rounded-xl bg-[#F6FBF8] border border-emerald-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                        <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                        <span>المزامنة السحابية</span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-md">
                        {cloudStatus === 'connected' ? 'Firebase متصل ✅' : 'جاري المزامنة...'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-stone-500 mb-2">
                      <span>آخر مزامنة:</span>
                      <span className="font-mono text-stone-700 font-semibold">
                        {lastSynced ? new Date(lastSynced).toLocaleTimeString('ar-SA') : 'الآن'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleManualSync}
                      disabled={isSyncing}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-2xs active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>{isSyncing ? 'جاري المزامنة السحابية...' : 'مزامنة فورية الآن'}</span>
                    </button>
                  </div>

                  {/* إعادة تعيين كلمة المرور عبر البريد */}
                  {!isLocalDemoMode && <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      void handlePasswordReset();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-stone-700 hover:bg-[#FAF5F2] hover:text-[#8E5364] text-xs font-bold transition text-right cursor-pointer"
                  >
                    <div className="w-6 h-6 rounded-lg bg-[#FAF0F3] flex items-center justify-center text-[#8E5364]">
                      <KeyRound className="w-3.5 h-3.5" />
                    </div>
                    <span>إرسال رابط إعادة تعيين كلمة المرور</span>
                  </button>}

                  {/* إذا كانت مشرفة / قائدة: تبديل الحساب أو تسجيل معلمة أخرى */}
                  {!isLocalDemoMode && isLeader && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        setShowSwitchModal(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-stone-700 hover:bg-[#FAF5F2] hover:text-[#8E5364] text-xs font-bold transition text-right cursor-pointer"
                    >
                      <div className="w-6 h-6 rounded-lg bg-[#F5F2F9] flex items-center justify-center text-[#735290]">
                        <UserCheck className="w-3.5 h-3.5" />
                      </div>
                      <span>تبديل المعلمة / حساب الدخول</span>
                    </button>
                  )}

                  {/* مظهر المنصة: التبديل بين الوضع الليلي والنهاري */}
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-stone-700 hover:bg-[#FAF5F2] hover:text-[#8E5364] text-xs font-bold transition text-right cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
                        {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-500" /> : <Moon className="w-3.5 h-3.5 text-[#8E5364]" />}
                      </div>
                      <span>مظهر المنصة: {isDarkMode ? 'الوضع الليلي' : 'الوضع النهاري'}</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-md font-mono font-bold bg-stone-100 text-stone-600">
                      {isDarkMode ? '🌙 ليلي' : '☀️ نهاري'}
                    </span>
                  </button>

                  <div className="my-1 border-t border-[#F0E8E2]"></div>

                  {/* تسجيل الخروج وقفل المنصة */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      onLockSession?.();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-bold transition text-right cursor-pointer"
                  >
                    <div className="w-6 h-6 rounded-lg bg-rose-100/60 flex items-center justify-center text-rose-600">
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                    <span>قفل المنصة وتسجيل الخروج</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* نافذة تبديل الحساب (للقائدة فقط) */}
      {showSwitchModal && isLeader && !isLocalDemoMode && (
        <StaffLoginGate onClose={() => setShowSwitchModal(false)} />
      )}

      {/* نافذة تعديل بيانات وشعار وتوقيع المعلمة */}
      {showEditProfileModal && currentUser && (
        <EditTeacherProfileModal
          user={currentUser}
          onClose={() => setShowEditProfileModal(false)}
        />
      )}
    </>
  );
};
