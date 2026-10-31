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
import { SettingsView } from './views/SettingsView';
import { TrackDetailPage } from './views/TrackDetailPage';
import { SubscriptionsFinancialsView } from './views/SubscriptionsFinancialsView';
import { StaffLoginGate } from './components/StaffLoginGate';
import { Footer } from './components/Footer';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { UpdateNotification } from './components/UpdateNotification';
import { isLocalDemoMode } from './demoMode';
import { hasFullAccess } from './types';

const VIEW_TYPES: ViewType[] = [
  'dashboard', 'tracks_circles', 'track_detail', 'students', 'subscriptions',
  'monthly_plans', 'attendance', 'recitation', 'atqini', 'challenges',
  'exams', 'grading', 'portfolio', 'reports', 'staff', 'settings'
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

const AppContent: React.FC = () => {
  const { loading, error, toast, triggerQuickModal, settings, currentUser, users, switchUser, showToast, cloudDataReady, cloudStatus } = useApp();
  const [initialNavigation] = useState(readNavigationFromUrl);
  const [currentView, setCurrentView] = useState<ViewType>(initialNavigation.view);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string>(initialNavigation.studentId);
  const [selectedTrackId, setSelectedTrackId] = useState<string>(initialNavigation.trackId);
  
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

  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
      if (typeof window !== 'undefined') {
        const isAuth = localStorage.getItem('ghaith_is_authenticated') === 'true';
        const isLocked = localStorage.getItem('ghaith_is_locked') === 'true';
        const savedUserId = localStorage.getItem('ghaith_active_user_id') || localStorage.getItem('ghaith_current_user_id');

        if (isAuth && !isLocked) {
          if (savedUserId && authDataRef.current.users.length > 0) {
            const found = authDataRef.current.users.find(u => u.id === savedUserId);
            if (found) {
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

  // تطبيق الشعار المختار للمقرأة في صفحة الويب وتبويب المتصفح (Favicon + Apple Touch Icon + Tab Title)
  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      const siteName = settings?.name || 'مقرأة غيث الغيم';
      const siteSubtitle = settings?.subtitle || 'منصة الإدارة والمقرأة القرآنية';
      document.title = `${siteName} | ${siteSubtitle}`;

      const logo = settings?.logoUrl;
      if (logo) {
        // تحديث أيقونة الموقع (Favicon) وروابط الأيقونات في ترويسة صفحة الويب فوراً
        const updateFaviconLink = (rel: string) => {
          let link = document.querySelector(`link[rel='${rel}']`) as HTMLLinkElement | null;
          if (!link) {
            link = document.createElement('link');
            link.rel = rel;
            document.head.appendChild(link);
          }
          link.href = logo;
        };

        updateFaviconLink('icon');
        updateFaviconLink('shortcut icon');
        updateFaviconLink('apple-touch-icon');
      }
    }
  }, [settings?.logoUrl, settings?.name, settings?.subtitle]);

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
            <span>📖</span>
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
    <div className="min-h-screen bg-[#F9F7F5] dark:bg-[#0E0E11] text-stone-900 dark:text-stone-100 flex flex-col antialiased selection:bg-[#E8D5D8] dark:selection:bg-[#5B3946] selection:text-[#5B3946] dark:selection:text-white transition-colors duration-200">
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

      {/* الحاوية الرئيسية للمنصة */}
      <div className="flex-1 max-w-7xl w-full mx-auto flex">
        
        {/* القائمة الجانبية */}
        <Sidebar
          currentView={currentView}
          onSelectView={setCurrentView}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onLockSession={handleLockSession}
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

          {currentView === 'monthly_plans' && (
            <MonthlyPlansView />
          )}

          {currentView === 'attendance' && (
            <AttendanceView />
          )}

          {currentView === 'recitation' && (
            <DailyMemorizationView
              onSelectStudent={handleSelectStudentForPortfolio}
            />
          )}

          {currentView === 'atqini' && (
            <AtqiniView />
          )}

          {currentView === 'challenges' && (
            <ChallengesView />
          )}

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
                <div className="w-16 h-16 rounded-3xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center text-3xl shadow-xs mb-4">
                  🔒
                </div>
                <h2 className="text-xl font-bold font-quran text-stone-900 mb-2">
                  قسم المعلمات والمشرفات خاص بإدارة المقرأة فقط
                </h2>
                <p className="text-xs sm:text-sm text-stone-500 max-w-md mb-6 leading-relaxed">
                  عذراً، هذا القسم يشتمل على سجلات الكادر التعليمي، والتواقيع المعتمدة، والصلاحيات، والرموز السرية، وصلاحية الوصول إليه محصورة على قائدة المقرأة.
                </p>
                <button
                  type="button"
                  onClick={() => setCurrentView('dashboard')}
                  className="px-5 py-2.5 bg-[#8E5364] text-white rounded-xl text-xs font-bold shadow-xs hover:bg-[#744251] transition cursor-pointer"
                >
                  العودة للوحة التحكم الرئيسية
                </button>
              </div>
            )
          )}

          {currentView === 'settings' && (
            hasFullAccess(currentUser) ? (
              <SettingsView />
            ) : (
              <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center" dir="rtl">
                <div className="w-16 h-16 rounded-3xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center text-3xl shadow-xs mb-4">
                  🔒
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
                  className="px-5 py-2.5 bg-[#8E5364] text-white rounded-xl text-xs font-bold shadow-xs hover:bg-[#744251] transition cursor-pointer"
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

      {/* التنبيهات المنبثقة (Toast) */}
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
            <span>{toast.message}</span>
          </div>
        </div>
      )}

    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
