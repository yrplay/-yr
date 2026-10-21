import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { Sidebar, ViewType } from './components/Sidebar';
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
import { StaffLoginGate } from './components/StaffLoginGate';
import { Footer } from './components/Footer';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const AppContent: React.FC = () => {
  const { loading, error, toast, triggerQuickModal, settings } = useApp();
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return sessionStorage.getItem('ghaith_authenticated') === 'true';
  });

  // Apply visual identity, font family & custom theme dynamically
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

      // Apply selected font family to document body and --font-active
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

  const handleLockSession = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('ghaith_authenticated');
    }
    setIsAuthenticated(false);
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

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F9F7F5] text-stone-700">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#E8D5D8] to-[#D8E6DE] flex items-center justify-center text-3xl shadow-sm animate-pulse mb-4">
          🪴
        </div>
        <h2 className="text-xl font-bold font-quran text-stone-900 mb-1">مقرأة غيث الغيم</h2>
        <p className="text-xs text-stone-500">جاري الاتصال بقاعدة البيانات وتحميل الحلقات والمسارات...</p>
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

  // Security Gate: Protect app access if security is active (defaults to true) and session is locked
  const securityActive = settings?.securityEnabled ?? true;
  if (securityActive && !isAuthenticated) {
    return <StaffLoginGate onSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-[#F9F7F5] flex flex-col antialiased selection:bg-[#E8D5D8] selection:text-[#5B3946]">
      
      {/* Header */}
      <Header
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onOpenQuickModal={handleOpenQuickModal}
        onNavigateToStudent={handleSelectStudentForPortfolio}
        onLockSession={handleLockSession}
      />

      {/* Main Layout Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto flex">
        
        {/* Sidebar */}
        <Sidebar
          currentView={currentView}
          onSelectView={setCurrentView}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onLockSession={handleLockSession}
        />

        {/* View Content Area */}
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
            <DailyMemorizationView />
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
            />
          )}

          {currentView === 'reports' && (
            <ReportsView />
          )}

          {currentView === 'staff' && (
            <StaffView />
          )}

          {currentView === 'settings' && (
            <SettingsView />
          )}

          {/* Platform Footer with Developer Signature */}
          <Footer />
        </main>
      </div>

      {/* Toast Notification Popup */}
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
