import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  Cloud, Sparkles, UserCheck, Search, PlusCircle, CheckCircle2,
  Menu, X, Bell, Shield, ChevronDown, RotateCw, Lock, Key, Edit, Eye, EyeOff
} from 'lucide-react';
import { getIslamicIcon, IslamicIconPicker } from './IslamicIconLibrary';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  onToggleSidebar: () => void;
  onOpenQuickModal: (type: string) => void;
  onNavigateToStudent: (studentId: string) => void;
  onLockSession?: () => void;
  onNavigateToSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  onOpenQuickModal,
  onNavigateToStudent,
  onLockSession,
  onNavigateToSettings
}) => {
  const {
    currentUser, users, switchUser, settings, students, circles,
    lastSynced, cloudStatus, syncNow, triggerQuickModal, changeUserPasscode, updateUser,
    tracks, selectedTrackId
  } = useApp();

  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResultsOpen, setSearchResultsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Passcode modal
  const [passcodeModalOpen, setPasscodeModalOpen] = useState(false);
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [showPasscodeText, setShowPasscodeText] = useState(false);
  const [passcodeError, setPasscodeError] = useState<string | null>(null);
  const [isSavingPasscode, setIsSavingPasscode] = useState(false);

  // Avatar Icon Picker Modal
  const [iconModalOpen, setIconModalOpen] = useState(false);
  const [selectedIconId, setSelectedIconId] = useState(currentUser?.avatarIcon || 'mushaf');
  const [selectedIconColor, setSelectedIconColor] = useState(currentUser?.avatarColor || '#8E5364');

  const quickAddRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (quickAddRef.current && !quickAddRef.current.contains(event.target as Node)) {
        setQuickAddOpen(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchResultsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    await syncNow();
    setIsSyncing(false);
  };

  const handleSaveNewPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasscodeError(null);
    if (!currentUser) return;
    if (newPasscode.trim().length < 4) {
      setPasscodeError('يجب أن يتكون الرمز السري من ٤ خانات على الأقل');
      return;
    }
    if (newPasscode !== confirmPasscode) {
      setPasscodeError('الرمزان غير متطابقين! يرجى إعادة التأكيد');
      return;
    }
    setIsSavingPasscode(true);
    const success = await changeUserPasscode(currentUser.id, newPasscode.trim());
    setIsSavingPasscode(false);
    if (success) {
      setPasscodeModalOpen(false);
      setNewPasscode('');
      setConfirmPasscode('');
    }
  };

  const handleSaveAvatarIcon = async () => {
    if (!currentUser) return;
    await updateUser(currentUser.id, {
      avatarIcon: selectedIconId,
      avatarColor: selectedIconColor
    });
    setIconModalOpen(false);
  };

  const filteredStudents = searchQuery.trim()
    ? students.filter(s =>
        s.name.includes(searchQuery) ||
        s.code.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 5)
    : [];

  const currentIcon = getIslamicIcon(currentUser?.avatarIcon);

  return (
    <header className="bg-white border-b border-[#E8DFD8] sticky top-0 z-40 transition-colors shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-3">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <button
              onClick={onToggleSidebar}
              className="lg:hidden p-2 rounded-xl text-stone-600 hover:bg-[#F2ECE6] transition-colors cursor-pointer"
              aria-label="القائمة"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div
              onClick={onNavigateToSettings}
              className="flex items-center gap-3 cursor-pointer group select-none"
              title="انقري هنا لفتح إعدادات المقرأة وتخصيص الهوية والشعار"
            >
              {settings.logoUrl ? (
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white flex items-center justify-center shadow-xs border border-[#E0D0D4]/60 p-1 overflow-hidden group-hover:border-[#8E5364] group-hover:shadow-sm transition">
                  <img
                    src={settings.logoUrl}
                    alt={settings.name}
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white flex items-center justify-center shadow-xs border border-[#E0D0D4]/60 p-1 overflow-hidden group-hover:border-[#8E5364] group-hover:shadow-sm transition">
                  <img
                    src="/pwa-192x192.png"
                    alt={settings.name || 'مقرأة غيث الغيم'}
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h1
                    style={{ color: settings.primaryColor || '#8E5364' }}
                    className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-1.5 font-quran transition"
                  >
                    {settings.name || 'غيث الغيم'}
                  </h1>
                  <span
                    style={{
                      backgroundColor: `${settings.secondaryColor || '#2D5A43'}15`,
                      color: settings.secondaryColor || '#2D5A43',
                      borderColor: `${settings.secondaryColor || '#2D5A43'}30`
                    }}
                    className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border"
                  >
                    {tracks.find(t => t.id === selectedTrackId)?.name || settings.activeTrackName || 'المسارات القرآنية'}
                  </span>
                </div>
                <p className="text-xs text-stone-500 hidden sm:block group-hover:text-stone-700 transition">
                  إشراف قائدة المقرأة: <strong className="text-stone-700 font-semibold">{settings.leaderName || 'ريفة المنصوري'}</strong>
                </p>
              </div>
            </div>
          </div>

          {/* Quick Search */}
          <div ref={searchRef} className="relative flex-1 max-w-xs sm:max-w-sm hidden md:block">
            <div className="relative">
              <input
                type="text"
                placeholder="ابحثي عن طالبة أو كود..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchResultsOpen(e.target.value.trim().length > 0);
                }}
                onFocus={() => setSearchResultsOpen(searchQuery.trim().length > 0)}
                className="w-full pl-3 pr-9 py-2 bg-[#FAF7F4] border border-[#E4DBD3] rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#8E5364] focus:border-transparent transition"
              />
              <Search className="w-4 h-4 text-stone-400 absolute right-3 top-2.5 pointer-events-none" />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setSearchResultsOpen(false); }}
                  className="absolute left-2.5 top-2.5 text-stone-400 hover:text-stone-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Search Results Dropdown */}
            {searchResultsOpen && (
              <div className="absolute left-0 right-0 mt-1.5 bg-white rounded-xl shadow-lg border border-stone-200 py-1.5 z-50 max-h-64 overflow-y-auto">
                {filteredStudents.length > 0 ? (
                  filteredStudents.map(student => {
                    const circle = circles.find(c => c.id === student.circleId);
                    return (
                      <button
                        key={student.id}
                        onClick={() => {
                          onNavigateToStudent(student.id);
                          setSearchResultsOpen(false);
                          setSearchQuery('');
                        }}
                        className="w-full text-right px-3.5 py-2 hover:bg-[#F9F5F6] flex items-center justify-between text-xs transition cursor-pointer"
                      >
                        <div>
                          <div className="font-semibold text-stone-800">{student.name}</div>
                          <div className="text-stone-400 text-[11px]">{student.code} • {circle?.name || 'غير محدد'}</div>
                        </div>
                        <span className="text-[11px] text-[#7D5363] font-medium bg-[#F6EEF1] px-2 py-0.5 rounded-full">
                          عرض الملف
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className="p-3 text-center text-xs text-stone-500">
                    لا توجد طالبة مطابقة لـ "{searchQuery}"
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Tools & User Profile */}
          <div className="flex items-center gap-2 sm:gap-3">

            {/* Dedicated PWA Install Button */}
            <PWAInstallButton variant="header" />

            {/* Cloud Sync Status Indicator & Trigger */}
            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl border text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95 ${
                cloudStatus === 'connected'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  : cloudStatus === 'syncing' || isSyncing
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
              }`}
              title="مزامنة سحابية فورية ومباشرة بقاعدة بيانات Firebase المركزية (Firestore)"
            >
              <Cloud className={`w-3.5 h-3.5 ${isSyncing || cloudStatus === 'syncing' ? 'animate-pulse text-amber-600' : 'text-emerald-600'}`} />
              <span className="hidden sm:inline">
                {isSyncing || cloudStatus === 'syncing' ? 'جاري المزامنة...' : 'سحابي فوري'}
              </span>
              <span className={`w-2 h-2 rounded-full ${
                cloudStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
              }`} />
            </button>

            {/* Quick Action Menu (+) */}
            <div ref={quickAddRef} className="relative">
              <button
                type="button"
                onClick={() => setQuickAddOpen(!quickAddOpen)}
                style={{
                  color: settings.primaryColor || '#8E5364',
                  borderColor: `${settings.primaryColor || '#8E5364'}40`
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FAF5F2] hover:bg-[#EFEAE5] border text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95"
                title="إضافة سريعة"
              >
                <PlusCircle className="w-4 h-4" />
                <span className="hidden sm:inline">إضافة سريعة</span>
              </button>

              {quickAddOpen && (
                <div className="absolute left-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-stone-200 py-2 z-50 text-xs animate-in fade-in">
                  <div className="px-3 py-1.5 text-[11px] font-bold text-stone-400 uppercase tracking-wider border-b border-stone-100 mb-1">
                    إجراءات سريعة فورية
                  </div>
                  <button
                    type="button"
                    onClick={() => { setQuickAddOpen(false); onOpenQuickModal('student'); }}
                    className="w-full text-right px-3.5 py-2.5 hover:bg-[#F9F5F6] text-stone-700 flex items-center justify-between font-semibold cursor-pointer active:scale-95 transition"
                  >
                    <span>تسجيل طالبة جديدة</span>
                    <span className="text-stone-400">👩‍🎓</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setQuickAddOpen(false); onOpenQuickModal('circle'); }}
                    className="w-full text-right px-3.5 py-2.5 hover:bg-[#F9F5F6] text-stone-700 flex items-center justify-between font-semibold cursor-pointer active:scale-95 transition"
                  >
                    <span>إنشاء حلقة جديدة</span>
                    <span className="text-stone-400">🪴</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setQuickAddOpen(false); onOpenQuickModal('atqini'); }}
                    className="w-full text-right px-3.5 py-2.5 hover:bg-[#F9F5F6] text-stone-700 flex items-center justify-between font-semibold cursor-pointer active:scale-95 transition"
                  >
                    <span>نشر واجب «أتقني»</span>
                    <span className="text-stone-400">✨</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setQuickAddOpen(false); onOpenQuickModal('challenge'); }}
                    className="w-full text-right px-3.5 py-2.5 hover:bg-[#F9F5F6] text-stone-700 flex items-center justify-between font-semibold cursor-pointer active:scale-95 transition"
                  >
                    <span>إطلاق تحدٍ قرآني</span>
                    <span className="text-stone-400">🌟</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setQuickAddOpen(false); onOpenQuickModal('exam'); }}
                    className="w-full text-right px-3.5 py-2.5 hover:bg-[#F9F5F6] text-stone-700 flex items-center justify-between font-semibold cursor-pointer active:scale-95 transition"
                  >
                    <span>جدولة اختبار شهري</span>
                    <span className="text-stone-400">📝</span>
                  </button>
                </div>
              )}
            </div>

            {/* User Profile & Passcode Dropdown */}
            <div ref={userDropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-2 rounded-xl bg-[#F8F5F2] hover:bg-[#EFEAE5] border border-[#E4DBD3] transition text-right cursor-pointer active:scale-95"
              >
                <div
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-bold text-xs"
                  style={{
                    backgroundColor: `${currentUser?.avatarColor || settings.primaryColor || '#8E5364'}20`,
                    color: currentUser?.avatarColor || settings.primaryColor || '#8E5364'
                  }}
                >
                  {currentUser?.avatarIcon ? (
                    currentIcon.svg({ className: 'w-4 h-4 sm:w-5 sm:h-5', color: currentUser.avatarColor || settings.primaryColor || '#8E5364' })
                  ) : (
                    <span>{currentUser?.name ? currentUser.name.charAt(0) : 'ق'}</span>
                  )}
                </div>
                <div className="hidden md:block">
                  <div className="text-xs font-bold text-stone-800 leading-tight">
                    {currentUser?.name || 'قائدة المقرأة'}
                  </div>
                  <div className="text-[10px] text-stone-500 font-medium flex items-center gap-1">
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        backgroundColor: currentUser?.role === 'leader' ? (settings.primaryColor || '#8E5364') : currentUser?.role === 'supervisor' ? '#F59E0B' : '#10B981'
                      }}
                    ></span>
                    {currentUser?.title || 'الإدارة'}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-stone-400 hidden sm:block" />
              </button>

              {userDropdownOpen && (
                <div className="absolute left-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-stone-200 p-2 z-50 text-xs">
                  
                  {/* Current User Info Card */}
                  <div className="p-3 bg-[#FAF7F4] rounded-xl border border-[#EFE8E2] mb-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-stone-900 text-xs">{currentUser?.name}</div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        currentUser?.role === 'leader'
                          ? 'bg-rose-100 text-rose-800'
                          : currentUser?.role === 'supervisor'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {currentUser?.role === 'leader' ? 'قائدة' : currentUser?.role === 'supervisor' ? 'مشرفة' : 'معلمة'}
                      </span>
                    </div>
                    <div className="text-[11px] text-stone-500">{currentUser?.email}</div>

                    <div className="flex items-center gap-2 pt-2 border-t border-stone-200/60 mt-2">
                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          setSelectedIconId(currentUser?.avatarIcon || 'mushaf');
                          setSelectedIconColor(currentUser?.avatarColor || '#8E5364');
                          setIconModalOpen(true);
                        }}
                        className="flex-1 py-1 px-2 rounded-lg bg-white border border-stone-200 text-[11px] font-bold text-stone-700 hover:bg-stone-50 flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3 text-[#8E5364]" />
                        <span>أيقونتي الرمزية</span>
                      </button>

                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          setPasscodeModalOpen(true);
                        }}
                        className="flex-1 py-1 px-2 rounded-lg bg-white border border-stone-200 text-[11px] font-bold text-stone-700 hover:bg-stone-50 flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Key className="w-3 h-3 text-amber-600" />
                        <span>تغيير الرمز السري</span>
                      </button>
                    </div>
                  </div>

                  {/* Switch account list */}
                  <div className="px-2 py-1 text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                    تبديل الحساب المعاين / الصلاحيات
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {users.map(u => {
                      const uIcon = getIslamicIcon(u.avatarIcon);
                      return (
                        <button
                          key={u.id}
                          onClick={() => {
                            switchUser(u.id);
                            setUserDropdownOpen(false);
                          }}
                          className={`w-full text-right px-2.5 py-1.5 rounded-xl flex items-center justify-between text-xs transition cursor-pointer ${
                            currentUser?.id === u.id
                              ? 'bg-[#F9EFF2] text-[#8E5364] font-bold border border-[#E8D5D8]'
                              : 'hover:bg-stone-50 text-stone-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <div
                              className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                              style={{ backgroundColor: `${u.avatarColor || '#8E5364'}18` }}
                            >
                              {uIcon.svg({ className: 'w-3 h-3', color: u.avatarColor || '#8E5364' })}
                            </div>
                            <div className="truncate">
                              <span className="font-semibold block truncate">{u.name}</span>
                              <span className="text-[10px] text-stone-400 block truncate">{u.title}</span>
                            </div>
                          </div>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full shrink-0 font-medium ${
                            u.role === 'leader'
                              ? 'bg-rose-100 text-rose-800'
                              : u.role === 'supervisor'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {u.role === 'leader' ? 'قائدة' : u.role === 'supervisor' ? 'مشرفة' : 'معلمة'}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {onLockSession && (
                    <div className="pt-2 mt-2 border-t border-stone-100">
                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          onLockSession();
                        }}
                        className="w-full text-right px-3 py-2 rounded-xl flex items-center justify-between text-xs text-rose-700 hover:bg-rose-50 transition font-bold cursor-pointer"
                      >
                        <span>قفل المنصة وتسجيل الخروج</span>
                        <Lock className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Developer Signature in Header Dropdown */}
                  <div className="mt-2 pt-2 border-t border-stone-100 px-2 py-1.5 bg-[#FAF4F6] rounded-xl flex items-center justify-between text-[10px]">
                    <span className="text-stone-400">بناء وتطوير:</span>
                    <span className="font-bold text-[#8E5364] font-mono flex items-center gap-1">
                      <span>بواسطة ياسر التاج · yr_alhosine</span>
                      <span>✨</span>
                    </span>
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>
      </div>

      {/* Change Passcode Modal */}
      {passcodeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-stone-900 text-sm">تغيير رمز الدخول السري</h3>
                  <p className="text-[11px] text-stone-500">لحساب: {currentUser?.name}</p>
                </div>
              </div>
              <button
                onClick={() => setPasscodeModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewPasscode} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  الرمز السري الجديد (PIN):
                </label>
                <div className="relative">
                  <input
                    type={showPasscodeText ? 'text' : 'password'}
                    required
                    maxLength={16}
                    placeholder="مثال: 5678"
                    value={newPasscode}
                    onChange={e => setNewPasscode(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-stone-200 rounded-xl text-xs font-mono font-bold tracking-widest text-center focus:ring-2 focus:ring-[#8E5364]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasscodeText(!showPasscodeText)}
                    className="absolute left-2.5 top-2.5 text-stone-400 hover:text-stone-600"
                  >
                    {showPasscodeText ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  تأكيد الرمز السري الجديد:
                </label>
                <input
                  type={showPasscodeText ? 'text' : 'password'}
                  required
                  maxLength={16}
                  placeholder="أعيدي إدخال الرمز للتأكيد..."
                  value={confirmPasscode}
                  onChange={e => setConfirmPasscode(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs font-mono font-bold tracking-widest text-center focus:ring-2 focus:ring-[#8E5364]"
                />
              </div>

              {passcodeError && (
                <div className="p-2.5 rounded-xl bg-rose-50 text-rose-800 text-xs">
                  {passcodeError}
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSavingPasscode || !newPasscode}
                  className="flex-1 py-2.5 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
                >
                  {isSavingPasscode ? 'جاري الحفظ...' : 'حفظ الرمز السري الجديد'}
                </button>
                <button
                  type="button"
                  onClick={() => setPasscodeModalOpen(false)}
                  className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Islamic Icon Picker Modal */}
      {iconModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-stone-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-[#F6EEF1] text-[#8E5364] flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-stone-900 text-sm">اختيار الأيقونة الرمزية الإسلامية</h3>
                  <p className="text-[11px] text-stone-500">تخصيص أيقونتك ولونها في سجلات المقرأة والحلقات</p>
                </div>
              </div>
              <button
                onClick={() => setIconModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <IslamicIconPicker
              selectedIconId={selectedIconId}
              selectedColor={selectedIconColor}
              onSelect={(iconId, color) => {
                setSelectedIconId(iconId);
                setSelectedIconColor(color);
              }}
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setIconModalOpen(false)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveAvatarIcon}
                className="px-6 py-2 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                حفظ واعتماد الأيقونة
              </button>
            </div>
          </div>
        </div>
      )}

    </header>
  );
};
