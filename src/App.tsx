import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { Sidebar, type ViewType } from './components/Sidebar';
import { DashboardView } from './views/DashboardView';
import { TracksCirclesView } from './views/TracksCirclesView';
import { StudentsView } from './views/StudentsView';
import { MonthlyPlansView } from './views/MonthlyPlansView';
import { AttendanceView } from './views/AttendanceView';
import { DailyMemorizationView } from './views/DailyMemorizationView';
import { AtqiniView } from './views/AtqiniView';
import { ChallengesView } from './views/ChallengesView';
import { ExamsView } from './views/ExamsView';
import { GradingSystemView } from './views/GradingSystemView';
import { StudentPortfolioView } from './views/StudentPortfolioView';
import { ReportsView } from './views/ReportsView';
import { StaffView } from './views/StaffView';
import { StaffAttendanceTasksView } from './views/StaffAttendanceTasksView';
import { SettingsView } from './views/SettingsView';
import { TrackDetailPage } from './views/TrackDetailPage';
import { SubscriptionsFinancialsView } from './views/SubscriptionsFinancialsView';
import { StaffLoginGate } from './components/StaffLoginGate';
import { Footer } from './components/Footer';
import { CheckCircle2, AlertCircle, Info, Lock, X, BellRing, MessageSquare, Clock, Pin } from 'lucide-react';
import { UpdateNotification } from './components/UpdateNotification';
import { isLocalDemoMode } from './demoMode';
import { hasFullAccess } from './types';
import { syncInstitutionLogoAsPWAAppIcon } from './services/pwaIconSync';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  resolveUserWelcomeConfig,
  LOGIN_WELCOME_DURATION_MS,
  readResolvedStaffChatMessages,
  resolvePinnedStaffAnnouncement,
  isSupervisorOrTeacherOnly,
  readAllStaffAttendanceRecords,
  writeLocalStaffAttendanceRecords,
  buildStaffAttendanceRecord,
  formatCurrentArabicTime
} from './utils/staffHelpers';
import {
  computeUnreadStaffChatCount,
  deliverNativeOrPwaNotification,
  evaluateShiftReminderForStaff,
  getChatMessageSeenKey,
  getPinnedAnnouncementSeenKey,
  isAuthoredByCurrentUser,
  markStaffChatSeenNow,
  playGentleNotificationChime,
  readSeenMessageIdsForUser,
  writeSeenMessageIdsForUser,
  type ShiftReminderEvaluation
} from './utils/staffNotifications';
import { getTodayISO } from './utils/hijriDate';

const VIEW_TYPES: ViewType[] = [
  'dashboard', 'tracks_circles', 'track_detail', 'students', 'subscriptions',
  'monthly_plans', 'attendance', 'recitation', 'atqini', 'challenges',
  'exams', 'grading', 'portfolio', 'reports', 'staff', 'staff-attendance', 'settings'
];

const readNavigationFromUrl = () => {
  if (typeof window === 'undefined') return { view: 'dashboard' as ViewType, studentId: '', trackId: '' };
  const params = new URLSearchParams(window.location.search);
  const requestedView = params.get('view') as ViewType | null;
  return {
    view: requestedView && VIEW_TYPES.includes(requestedView) ? requestedView : 'dashboard',
    studentId: params.get('studentId') || '',
    trackId: params.get('trackId') || ''
  };
};

interface FloatingChatAlert {
  id: string;
  senderName: string;
  senderTitle: string;
  messagePreview: string;
  isPinnedAnnouncement?: boolean;
}

const AppContent: React.FC = () => {
  const { loading, error, toast, triggerQuickModal, settings, updateSettings, currentUser, users, switchUser, showToast, dismissToast, cloudDataReady, cloudStatus, isPrivacyMode } = useApp();
  const [initialNavigation] = useState(readNavigationFromUrl);
  const [currentView, setCurrentView] = useState<ViewType>(initialNavigation.view);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string>(initialNavigation.studentId);
  const [selectedTrackId, setSelectedTrackId] = useState<string>(initialNavigation.trackId);
  const [unreadStaffChatCount, setUnreadStaffChatCount] = useState<number>(0);

  // Sleek 15-second auto-dismissing top floating alert banner for incoming chat messages / announcements
  const [floatingChatAlert, setFloatingChatAlert] = useState<FloatingChatAlert | null>(null);
  const floatingChatTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Global pre-shift / shift-start reminder banner state for Supervisors & Teachers ONLY
  const [activeShiftReminder, setActiveShiftReminder] = useState<ShiftReminderEvaluation | null>(null);

  // Per-user seenMessageIds ref synced with localStorage
  const seenMessageIdsRef = React.useRef<Set<string>>(new Set());
  const initializedSeenForUserRef = React.useRef<string>('');
  
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ghaith_is_authenticated') === 'true' && localStorage.getItem('ghaith_is_locked') !== 'true';
    }
    return false;
  });
  const [authChecking, setAuthChecking] = useState(true);
  const [authError, setAuthError] = useState('');
  const authDataRef = React.useRef({ users, switchUser });
  authDataRef.current = { users, switchUser };

  React.useEffect(() => {
    const url = new URL(window.location.href);
    const currentUrlView = url.searchParams.get('view');
    const currentUrlStudentId = url.searchParams.get('studentId') || '';
    const currentUrlTrackId = url.searchParams.get('trackId') || '';
    if (currentUrlView === currentView && currentUrlStudentId === (currentView === 'portfolio' ? selectedStudentId : '')
      && currentUrlTrackId === (currentView === 'track_detail' ? selectedTrackId : '')) return;

    url.searchParams.set('view', currentView);
    if (currentView === 'portfolio' && selectedStudentId) url.searchParams.set('studentId', selectedStudentId);
    else url.searchParams.delete('studentId');
    if (currentView === 'track_detail' && selectedTrackId) url.searchParams.set('trackId', selectedTrackId);
    else url.searchParams.delete('trackId');

    const requestedView = new URLSearchParams(window.location.search).get('view');
    const invalidInitialView = requestedView !== null && !VIEW_TYPES.includes(requestedView as ViewType);
    window.history[invalidInitialView ? 'replaceState' : 'pushState']({ view: currentView }, '', url);
  }, [currentView, selectedStudentId, selectedTrackId]);

  useEffect(() => {
    const handlePopState = () => {
      const navigation = readNavigationFromUrl();
      setCurrentView(navigation.view);
      setSelectedStudentId(navigation.studentId);
      setSelectedTrackId(navigation.trackId);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const hasRestoredSessionRef = React.useRef(false);

  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
      if (typeof window !== 'undefined') {
        const isAuth = localStorage.getItem('ghaith_is_authenticated') === 'true';
        const isLocked = localStorage.getItem('ghaith_is_locked') === 'true';
        const savedUserId = localStorage.getItem('ghaith_active_user_id') || localStorage.getItem('ghaith_current_user_id');

        if (isAuth && !isLocked) {
          if (savedUserId && authDataRef.current.users.length > 0 && !hasRestoredSessionRef.current) {
            const found = authDataRef.current.users.find(u => u.id === savedUserId);
            if (found) {
              hasRestoredSessionRef.current = true;
              try {
                await authDataRef.current.switchUser(found.id, true);
              } catch (e) {
                console.warn('Session user restore notice:', e);
              }
            }
          }
          if (active) {
            setAuthError('');
            setIsAuthenticated(true);
            setAuthChecking(false);
          }
          return;
        }
      }
      if (active) {
        setIsAuthenticated(false);
        setAuthChecking(false);
      }
    };

    restoreSession();
    return () => { active = false; };
  }, [users.length]);

  const lastWelcomeUserIdRef = React.useRef<string>('');
  useEffect(() => {
    if (!isAuthenticated || !currentUser || !cloudDataReady) return;
    const resolvedWelcome = resolveUserWelcomeConfig(currentUser, settings).welcomeTitle;
    if (lastWelcomeUserIdRef.current !== currentUser.id) {
      lastWelcomeUserIdRef.current = currentUser.id;
      showToast(resolvedWelcome, 'success', LOGIN_WELCOME_DURATION_MS);
    }
  }, [isAuthenticated, currentUser?.id, cloudDataReady, settings?.welcomeMessages, settings?.staffWelcomeConfigs]);

  const triggerTopFloatingChatAlert = (alertData: FloatingChatAlert) => {
    if (floatingChatTimerRef.current) {
      clearTimeout(floatingChatTimerRef.current);
    }
    setFloatingChatAlert(alertData);
    floatingChatTimerRef.current = setTimeout(() => {
      setFloatingChatAlert(null);
      floatingChatTimerRef.current = null;
    }, 15000);
  };

  // =========================================================================
  // 1. GLOBAL ROOT-LEVEL CLOUD SYNC WATCHER FOR STAFF CHAT & ANNOUNCEMENTS
  // Monitors `settings.staffChatMessages` & `settings.pinnedStaffAnnouncement`
  // Tracks `seenMessageIds` in localStorage / ref. Whenever cloud sync delivers
  // a new message or updated pinned announcement whose `id` has not been seen yet
  // AND `senderId !== currentUser.id`:
  //   1) Triggers native browser/PWA notification (`Notification` / `ServiceWorkerRegistration.showNotification`)
  //   2) Plays soft notification chime AND shows sleek 15s in-app floating alert banner at top of screen
  // =========================================================================
  useEffect(() => {
    if (!isAuthenticated || !currentUser || !cloudDataReady) return;

    const activeMsgs = readResolvedStaffChatMessages(settings);
    const pinned = resolvePinnedStaffAnnouncement(settings);
    const nowMs = Date.now();

    // Initialize `seenMessageIdsRef` for the active user on first mount
    if (initializedSeenForUserRef.current !== currentUser.id) {
      // Seed only historical messages older than 45 seconds or authored by currentUser on first-ever init
      const seedIds: string[] = [];
      for (const m of activeMsgs) {
        const msgAge = nowMs - (m.editedAt || m.createdAt);
        if (msgAge > 45000 || isAuthoredByCurrentUser(currentUser, m.senderId, m.senderName)) {
          seedIds.push(getChatMessageSeenKey(m));
        }
      }
      if (
        pinned.text &&
        (nowMs - (pinned.updatedAt || 0) > 45000 ||
          isAuthoredByCurrentUser(currentUser, undefined, pinned.updatedBy))
      ) {
        seedIds.push(getPinnedAnnouncementSeenKey(pinned));
      }
      seenMessageIdsRef.current = readSeenMessageIdsForUser(currentUser.id, seedIds);
      initializedSeenForUserRef.current = currentUser.id;
    }

    const seenSet = seenMessageIdsRef.current;
    let seenMutated = false;
    let latestIncomingAlert: FloatingChatAlert | null = null;

    // Inspect all active messages from cloud sync
    for (const msg of activeMsgs) {
      const seenKey = getChatMessageSeenKey(msg);
      if (seenSet.has(seenKey)) continue;

      seenSet.add(seenKey);
      seenMutated = true;

      // Strictly exclude the user who sent/updated the message themselves
      if (isAuthoredByCurrentUser(currentUser, msg.senderId, msg.senderName)) {
        continue;
      }

      // 1) Trigger native browser / PWA notification with sender name and message preview
      void deliverNativeOrPwaNotification({
        title: `رسالة جديدة من ${msg.senderName}`,
        body: msg.text,
        tag: `staff-chat-${msg.id}`,
        playChime: false
      });

      // 2) Queue soft chime + sleek 15s floating alert banner at the top of the screen
      latestIncomingAlert = {
        id: seenKey,
        senderName: msg.senderName,
        senderTitle: msg.senderTitle || 'عضو الكادر',
        messagePreview: msg.text,
        isPinnedAnnouncement: false
      };
    }

    // Inspect pinned administrative announcement updates
    if (pinned.text) {
      const pinnedKey = getPinnedAnnouncementSeenKey(pinned);
      if (!seenSet.has(pinnedKey)) {
        seenSet.add(pinnedKey);
        seenMutated = true;

        if (!isAuthoredByCurrentUser(currentUser, undefined, pinned.updatedBy)) {
          void deliverNativeOrPwaNotification({
            title: `تعميم إداري مثبت — ${pinned.updatedBy || 'إدارة المنصة'}`,
            body: pinned.text,
            tag: `staff-pinned-${pinned.updatedAt}`,
            playChime: false
          });

          latestIncomingAlert = {
            id: pinnedKey,
            senderName: pinned.updatedBy || 'إدارة المنصة',
            senderTitle: 'تعميم إداري مثبت',
            messagePreview: pinned.text,
            isPinnedAnnouncement: true
          };
        }
      }
    }

    if (seenMutated) {
      writeSeenMessageIdsForUser(currentUser.id, seenSet);
    }

    if (latestIncomingAlert) {
      playGentleNotificationChime();
      triggerTopFloatingChatAlert(latestIncomingAlert);
    }

    // Update unread sidebar badge (or clear if currently viewing staff-attendance)
    if (currentView === 'staff-attendance') {
      markStaffChatSeenNow(currentUser.id, settings);
      setUnreadStaffChatCount(0);
    } else {
      setUnreadStaffChatCount(computeUnreadStaffChatCount(currentUser, settings));
    }
  }, [
    isAuthenticated,
    currentUser?.id,
    cloudDataReady,
    currentView,
    settings?.staffChatMessages,
    settings?.pinnedStaffAnnouncement
  ]);

  // Listen for custom seen-updated events
  useEffect(() => {
    const syncUnread = () => {
      if (!currentUser) return;
      if (currentView === 'staff-attendance') {
        setUnreadStaffChatCount(0);
      } else {
        setUnreadStaffChatCount(computeUnreadStaffChatCount(currentUser, settings));
      }
    };
    window.addEventListener('ghaith-staff-chat-seen-updated', syncUnread);
    return () => window.removeEventListener('ghaith-staff-chat-seen-updated', syncUnread);
  }, [currentUser, currentView, settings]);

  // =========================================================================
  // 2. GLOBAL ROOT-LEVEL PRE-SHIFT & SHIFT-START REMINDERS (Every 30 Seconds)
  // Strictly for Supervisors (`مشرفة حلقات`) & Teachers (`معلمة حلقة`) ONLY
  // (strictly excluding Reefa Al-Mansouri & Omar Abdulrahman).
  // =========================================================================
  useEffect(() => {
    if (!isAuthenticated || !currentUser || !cloudDataReady) {
      setActiveShiftReminder(null);
      return;
    }

    if (!isSupervisorOrTeacherOnly(currentUser)) {
      setActiveShiftReminder(null);
      return;
    }

    const todayIso = getTodayISO();
    const allAttendance = readAllStaffAttendanceRecords(settings);
    if (allAttendance[`${currentUser.id}_${todayIso}`]) {
      // Attendance for today is logged -> clear any active shift reminder banner
      setActiveShiftReminder(null);
      return;
    }

    const runGlobalShiftCheck = () => {
      const currentTodayIso = getTodayISO();
      const latestAttendance = readAllStaffAttendanceRecords(settings);
      if (latestAttendance[`${currentUser.id}_${currentTodayIso}`]) {
        setActiveShiftReminder(null);
        return;
      }

      const evaluation = evaluateShiftReminderForStaff({
        user: currentUser,
        settings,
        todayIso: currentTodayIso
      });

      if (evaluation.shouldTrigger && evaluation.title && evaluation.body) {
        // Trigger native device notification + gentle chime + prominent in-app reminder banner
        void deliverNativeOrPwaNotification({
          title: evaluation.title,
          body: evaluation.body,
          tag: evaluation.tag,
          playChime: true
        });
        setActiveShiftReminder(evaluation);
      }
    };

    runGlobalShiftCheck();
    const interval = setInterval(runGlobalShiftCheck, 30000);
    window.addEventListener('ghaith-staff-sync', runGlobalShiftCheck);
    return () => {
      clearInterval(interval);
      window.removeEventListener('ghaith-staff-sync', runGlobalShiftCheck);
    };
  }, [
    isAuthenticated,
    currentUser?.id,
    currentUser?.workingHours,
    cloudDataReady,
    settings?.staffAttendanceRecords,
    settings?.staffProfiles,
    settings?.staffOperations
  ]);

  // Quick Direct Self Check-In Handler from the Global Pre-Shift / Shift-Start Reminder Banner
  const handleGlobalQuickCheckInToday = async () => {
    if (!currentUser || !isSupervisorOrTeacherOnly(currentUser)) return;
    const todayIso = getTodayISO();
    const nowTime = formatCurrentArabicTime();
    const record = buildStaffAttendanceRecord({
      user: currentUser,
      dateIso: todayIso,
      status: 'present',
      checkInTime: nowTime,
      excuseText: '',
      recordedBy: currentUser.name
    });
    const nextRecords = {
      ...readAllStaffAttendanceRecords(settings),
      [record.id]: record
    };
    writeLocalStaffAttendanceRecords(nextRecords);
    setActiveShiftReminder(null);
    await updateSettings({ staffAttendanceRecords: nextRecords }, true);
    showToast(`تم تسجيل حضوركِ لليوم (${nowTime}) بنجاح`, 'success');
  };

  // تطبيق الهوية البصرية ونوع الخط تلقائياً
  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      if (settings?.primaryColor) {
        document.documentElement.style.setProperty('--theme-primary', settings.primaryColor);
        try {
          const num = parseInt(settings.primaryColor.replace('#', ''), 16);
          const r = Math.max(0, (num >> 16) - 25);
          const g = Math.max(0, ((num >> 8) & 0xff) - 25);
          const b = Math.max(0, (num & 0xff) - 25);
          const hoverHex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
          document.documentElement.style.setProperty('--theme-primary-hover', hoverHex);
        } catch {}
      }
      if (settings?.secondaryColor) {
        document.documentElement.style.setProperty('--theme-secondary', settings.secondaryColor);
        try {
          const num = parseInt(settings.secondaryColor.replace('#', ''), 16);
          const r = Math.max(0, (num >> 16) - 25);
          const g = Math.max(0, ((num >> 8) & 0xff) - 25);
          const b = Math.max(0, (num & 0xff) - 25);
          const hoverHex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
          document.documentElement.style.setProperty('--theme-secondary-hover', hoverHex);
        } catch {}
      }
      if (settings?.buttonRadius === 'rounded-full') {
        document.documentElement.style.setProperty('--btn-radius', '9999px');
      } else if (settings?.buttonRadius === 'rounded-xl') {
        document.documentElement.style.setProperty('--btn-radius', '0.75rem');
      } else {
        document.documentElement.style.setProperty('--btn-radius', '1rem');
      }

      let fontStr = "'Thmanyah Sans', 'Tajawal', sans-serif";
      if (settings?.fontFamily === 'amiri') {
        fontStr = "'Amiri', serif";
      } else if (settings?.fontFamily === 'tajawal') {
        fontStr = "'Tajawal', sans-serif";
      } else {
        fontStr = "'Thmanyah Sans', 'Tajawal', sans-serif";
      }
      document.documentElement.style.setProperty('--font-active', fontStr);
      document.body.style.fontFamily = fontStr;
    }
  }, [settings?.primaryColor, settings?.secondaryColor, settings?.buttonRadius, settings?.fontFamily]);

  // تطبيق الشعار المختار للمقرأة في صفحة الويب، تبويب المتصفح، وأيقونة تثبيت التطبيق على الجهاز (PWA Manifest + Apple Touch Icon + Favicon)
  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      const siteName = settings?.name || 'مقرأة غيث الغيم';
      const siteSubtitle = settings?.subtitle || 'منصة الإدارة والمقرأة القرآنية';
      document.title = `${siteName} | ${siteSubtitle}`;
      syncInstitutionLogoAsPWAAppIcon(settings);
    }
  }, [settings?.logoUrl, settings?.name, settings?.subtitle, settings?.primaryColor]);

  const handleLockSession = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ghaith_is_locked', 'true');
      localStorage.removeItem('ghaith_is_authenticated');
      localStorage.removeItem('ghaith_active_user_id');
      localStorage.removeItem('ghaith_current_user_id');
    }
    setIsAuthenticated(false);
    setAuthError('');
    void signOut(auth);
  };

  const handleSelectStudentForPortfolio = (studentId: string) => {
    setSelectedStudentId(studentId);
    setCurrentView('portfolio');
  };

  const handleOpenQuickModal = (type: string) => {
    if (type === 'student') {
      setCurrentView('students');
      triggerQuickModal('student');
    } else if (type === 'circle') {
      setCurrentView('tracks_circles');
      triggerQuickModal('circle');
    } else if (type === 'track') {
      setCurrentView('tracks_circles');
      triggerQuickModal('track');
    } else if (type === 'atqini') {
      setCurrentView('atqini');
      triggerQuickModal('atqini');
    } else if (type === 'challenge') {
      setCurrentView('challenges');
      triggerQuickModal('challenge');
    } else if (type === 'exam') {
      setCurrentView('exams');
      triggerQuickModal('exam');
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F9F7F5] text-stone-700" dir="rtl">
        <div className="w-12 h-12 rounded-2xl border-4 border-[#E8D5D8] border-t-[#8E5364] animate-spin mb-4" />
        <p className="text-sm">جارٍ التحقق من جلسة Firebase وصلاحية الموظفة...</p>
      </div>
    );
  }
  if (!isAuthenticated) {
    return <StaffLoginGate initialError={authError} onSuccess={() => { setAuthError(''); setIsAuthenticated(true); }} />;
  }
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F9F7F5] dark:bg-[#0E0E11] text-stone-700 dark:text-stone-300">
        <div className="w-20 h-20 rounded-3xl bg-white dark:bg-stone-800 border border-[#E8D5D8] dark:border-stone-700 p-2 flex items-center justify-center text-3xl shadow-sm animate-pulse mb-4 overflow-hidden">
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt="شعار المقرأة" className="w-full h-full object-contain" />
          ) : (
            <span className="text-[#9A5643] font-quran font-bold text-2xl">غيث</span>
          )}
        </div>
        <h2 className="text-xl font-bold font-quran text-stone-900 dark:text-stone-100 mb-1">{settings?.name || 'مقرأة غيث الغيم'}</h2>
        <p className="text-xs text-stone-500 dark:text-stone-400">جاري الاتصال بقاعدة البيانات وتحميل الحلقات والمسارات...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F9F7F5] p-4 text-center">
        <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-stone-900 mb-1">تعذر الاتصال بالخادم</h2>
        <p className="text-xs text-stone-500 max-w-sm mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-[#8E5364] text-white rounded-xl text-xs font-bold"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-[#FAF8F6] dark:bg-[#0E0E11] text-stone-900 dark:text-stone-100 flex flex-col antialiased selection:bg-[#E8D5D8] dark:selection:bg-[#5B3946] selection:text-[#5B3946] dark:selection:text-white transition-colors duration-200">
      {/* تنبيه التحديث التلقائي للتطبيق */}
      {isLocalDemoMode && (
        <div className="bg-amber-100 text-amber-950 border-b border-amber-300 px-4 py-2 text-center text-xs font-bold" role="status">
          وضع اختبار محلي — بيانات تجريبية؛ التغييرات تُحفظ في هذا المتصفح فقط ولا تتصل بـ Firebase.
        </div>
      )}
      <UpdateNotification />

      {/* الشريط العلوي */}
      <Header
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onOpenQuickModal={handleOpenQuickModal}
        onNavigateToStudent={handleSelectStudentForPortfolio}
        onLockSession={handleLockSession}
        onNavigateToSettings={() => setCurrentView('settings')}
      />

      {/* شريط التذكير الذكي بالدوام في أعلى الشاشة — للمشرفات والمعلمات فقط (قبل الدوام بـ 15 دقيقة وعند بداية الدوام) */}
      {activeShiftReminder && isSupervisorOrTeacherOnly(currentUser) && (
        <div className="bg-[#FAF6F3] border-b border-[#E5C3B3] px-4 py-3 shadow-xs animate-in fade-in slide-in-from-top duration-200" dir="rtl">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-white border border-[#E5C3B3] text-[#9A5643] flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs sm:text-sm font-bold text-[#7B3F30]">
                    {activeShiftReminder.bannerTitle}
                  </span>
                </div>
                {activeShiftReminder.bannerSubtitle && (
                  <p className="text-[11px] text-stone-600 mt-0.5">
                    {activeShiftReminder.bannerSubtitle}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
              <button
                type="button"
                onClick={handleGlobalQuickCheckInToday}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#9A5643] hover:bg-[#7B3F30] text-white text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>تسجيل حضور اليوم</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveShiftReminder(null)}
                title="إغلاق التنبيه"
                aria-label="إغلاق التنبيه"
                className="p-1.5 rounded-xl bg-white hover:bg-stone-100 text-stone-500 border border-[#E8E2DC] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* الإشعار العائم العلوي للرسائل والتعاميم الواردة (يختفي تلقائياً بعد 15 ثانية) */}
      {floatingChatAlert && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-xl animate-in fade-in slide-in-from-top duration-200"
          dir="rtl"
        >
          <div className="bg-white rounded-2xl border border-[#E5C3B3] shadow-xl p-3.5 sm:p-4 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-[#F6EFEA] border border-[#E5C3B3] text-[#9A5643] flex items-center justify-center shrink-0">
                {floatingChatAlert.isPinnedAnnouncement ? (
                  <Pin className="w-4 h-4" />
                ) : (
                  <MessageSquare className="w-4 h-4" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-stone-900">
                    {floatingChatAlert.senderName}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#FAF6F3] text-[#7B3F30] border border-[#E5C3B3]">
                    {floatingChatAlert.senderTitle}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#9A5643]">
                    <BellRing className="w-3 h-3 shrink-0" />
                    <span>إشعار مساحة تواصل الكادر</span>
                  </span>
                </div>
                <p className="text-xs text-stone-700 mt-1 line-clamp-2 leading-relaxed break-words">
                  {floatingChatAlert.messagePreview}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {currentView !== 'staff-attendance' && (
                <button
                  type="button"
                  onClick={() => {
                    setCurrentView('staff-attendance');
                    setFloatingChatAlert(null);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#9A5643] hover:bg-[#7B3F30] text-white text-[11px] font-bold transition cursor-pointer"
                >
                  عرض الرسالة
                </button>
              )}
              <button
                type="button"
                onClick={() => setFloatingChatAlert(null)}
                title="إغلاق الإشعار"
                aria-label="إغلاق الإشعار"
                className="p-1.5 rounded-xl bg-[#FAF6F3] hover:bg-[#EFE3DA] text-stone-500 border border-[#E8E2DC] transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* الحاوية الرئيسية للمنصة */}
      <div className="flex-1 max-w-7xl w-full mx-auto flex">
        
        {/* القائمة الجانبية */}
        <Sidebar
          currentView={currentView}
          onSelectView={setCurrentView}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onLockSession={handleLockSession}
          unreadStaffChatCount={unreadStaffChatCount}
        />

        {/* مساحة عرض المحتوى */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-full">
          {currentView === 'dashboard' && (
            <DashboardView
              onNavigate={setCurrentView}
              onOpenQuickModal={handleOpenQuickModal}
              onSelectStudent={handleSelectStudentForPortfolio}
            />
          )}

          {currentView === 'tracks_circles' && (
            <TracksCirclesView
              onSelectStudent={handleSelectStudentForPortfolio}
              onNavigateToSection={(s) => setCurrentView(s as ViewType)}
              onNavigateToTrackDetail={(trackId) => {
                setSelectedTrackId(trackId);
                setCurrentView('track_detail');
              }}
            />
          )}

          {currentView === 'track_detail' && (
            <TrackDetailPage
              trackId={selectedTrackId || undefined}
              onNavigateBack={() => setCurrentView('tracks_circles')}
              onNavigateToStudent={handleSelectStudentForPortfolio}
            />
          )}

          {currentView === 'subscriptions' && (
            <SubscriptionsFinancialsView
              onNavigateToStudent={handleSelectStudentForPortfolio}
            />
          )}

          {currentView === 'students' && (
            <StudentsView
              onSelectStudent={handleSelectStudentForPortfolio}
              onOpenQuickModal={handleOpenQuickModal}
            />
          )}

          <div className={currentView === 'monthly_plans' ? 'block' : 'hidden'}>
            <MonthlyPlansView />
          </div>

          <div className={currentView === 'attendance' ? 'block' : 'hidden'}>
            <AttendanceView />
          </div>

          <div className={currentView === 'recitation' ? 'block' : 'hidden'}>
            <DailyMemorizationView
              onSelectStudent={handleSelectStudentForPortfolio}
            />
          </div>

          {currentView === 'atqini' && (
            <AtqiniView />
          )}

          <div className={currentView === 'challenges' ? 'block' : 'hidden'}>
            <ChallengesView />
          </div>

          {currentView === 'exams' && (
            <ExamsView />
          )}

          {currentView === 'grading' && (
            <GradingSystemView />
          )}

          {currentView === 'portfolio' && (
            <StudentPortfolioView
              initialStudentId={selectedStudentId}
              onSelectStudent={setSelectedStudentId}
              onNavigateToSection={(s) => setCurrentView(s as ViewType)}
            />
          )}

          {currentView === 'reports' && (
            <ReportsView />
          )}

          {currentView === 'staff' && (
            (hasFullAccess(currentUser) || !!currentUser?.permissions?.canAccessStaff || !!currentUser?.permissions?.canManageUsers) ? (
              <StaffView />
            ) : (
              <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center" dir="rtl">
                <div className="w-16 h-16 rounded-3xl bg-[#F6EFEA] border border-[#E5C3B3] text-[#9A5643] flex items-center justify-center shadow-xs mb-4">
                  <Lock className="w-7 h-7" />
                </div>
                <h2 className="text-xl font-bold font-quran text-stone-900 mb-2">
                  قسم المعلمات والمشرفات خاص بإدارة المقرأة فقط
                </h2>
                <p className="text-xs sm:text-sm text-stone-500 max-w-md mb-6 leading-relaxed">
                  عذراً، هذا القسم يشتمل على حسابات الكادر التعليمي، والتواقيع المعتمدة، والصلاحيات، والرموز السرية، وصلاحية الوصول إليه محصورة على قائدة المقرأة. يمكنكِ تسجيل حضوركِ ومتابعة مهامكِ من قسم «تحضير ومهام الكادر».
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setCurrentView('staff-attendance')}
                    className="px-5 py-2.5 bg-[#9A5643] text-white rounded-xl text-xs font-bold shadow-xs hover:bg-[#7B3F30] transition cursor-pointer"
                  >
                    الانتقال إلى تحضير ومهام الكادر
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentView('dashboard')}
                    className="px-5 py-2.5 bg-[#F6EFEA] text-[#7B3F30] border border-[#E5C3B3] rounded-xl text-xs font-bold shadow-xs hover:bg-[#EFE3DA] transition cursor-pointer"
                  >
                    العودة للوحة التحكم
                  </button>
                </div>
              </div>
            )
          )}

          {currentView === 'staff-attendance' && (
            <StaffAttendanceTasksView />
          )}

          {currentView === 'settings' && (
            hasFullAccess(currentUser) ? (
              <SettingsView />
            ) : (
              <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center" dir="rtl">
                <div className="w-16 h-16 rounded-3xl bg-[#F6EFEA] border border-[#E5C3B3] text-[#9A5643] flex items-center justify-center shadow-xs mb-4">
                  <Lock className="w-7 h-7" />
                </div>
                <h2 className="text-xl font-bold font-quran text-stone-900 mb-2">
                  قسم الإعدادات والنسخ الاحتياطي خاص بإدارة المقرأة فقط
                </h2>
                <p className="text-xs sm:text-sm text-stone-500 max-w-md mb-6 leading-relaxed">
                  عذراً، صلاحية الوصول إلى إعدادات الهوية والشعار، وضبط درجات النظام، والنسخ الاحتياطي مقصورة على قائدة المقرأة.
                </p>
                <button
                  type="button"
                  onClick={() => setCurrentView('dashboard')}
                  className="px-5 py-2.5 bg-[#9A5643] text-white rounded-xl text-xs font-bold shadow-xs hover:bg-[#7B3F30] transition cursor-pointer"
                >
                  العودة للوحة التحكم الرئيسية
                </button>
              </div>
            )
          )}

          {/* التذييل الرسمي */}
          <Footer />
        </main>
      </div>

      {/* التنبيهات المنبثقة (Toast) — مع زر إغلاق يدوي وتوقيت دقيقتين لترحيب الدخول */}
      {toast && (
        <div className="fixed bottom-5 left-5 z-50 animate-in fade-in slide-in-from-bottom duration-200">
          <div className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border text-xs font-semibold ${
            toast.type === 'error'
              ? 'bg-rose-50 text-rose-900 border-rose-200'
              : toast.type === 'info'
              ? 'bg-sky-50 text-sky-900 border-sky-200'
              : 'bg-emerald-50 text-emerald-900 border-emerald-200'
          }`}>
            {toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : toast.type === 'info' ? (
              <Info className="w-4 h-4 text-sky-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span className="leading-relaxed">{toast.message}</span>
            <button
              type="button"
              onClick={dismissToast}
              title="إغلاق الإشعار"
              aria-label="إغلاق الإشعار"
              className="mr-1 p-1 rounded-lg opacity-60 hover:opacity-100 hover:bg-black/5 transition cursor-pointer shrink-0 flex items-center justify-center"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <ErrorBoundary>
          <AppContent />
        </ErrorBoundary>
      </AppProvider>
    </ErrorBoundary>
  );
}
