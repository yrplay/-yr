import React from 'react';
import { useApp } from '../context/AppContext';
import {
  LayoutDashboard, Layers, Users, Calendar, CheckSquare,
  BookOpenCheck, Sparkles, Trophy, FileText, Sliders,
  UserCheck, BarChart3, UserCog, Settings, X, History,
  CreditCard
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { hasFullAccess } from '../types';

export type ViewType =
  | 'dashboard'
  | 'tracks_circles'
  | 'track_detail'
  | 'students'
  | 'subscriptions'
  | 'monthly_plans'
  | 'attendance'
  | 'recitation'
  | 'atqini'
  | 'challenges'
  | 'exams'
  | 'grading'
  | 'portfolio'
  | 'reports'
  | 'staff'
  | 'settings';

interface SidebarProps {
  currentView: ViewType;
  onSelectView: (view: ViewType) => void;
  isOpen: boolean;
  onClose: () => void;
  onLockSession?: () => void;
  onOpenAuditLog?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onSelectView, isOpen, onClose, onLockSession, onOpenAuditLog }) => {
  const { circles, students, settings, isDarkMode, currentUser } = useApp();
  const primaryColor = settings?.primaryColor || '#8E5364';
  const hasAdminAccess = hasFullAccess(currentUser);

  const rawMenuItems: { id: ViewType; label: string; icon: any; badge?: string | number; accent?: string; adminOnly?: boolean }[] = [
    { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
    { id: 'tracks_circles', label: 'المسارات والحلقات', icon: Layers, badge: circles.length },
    { id: 'subscriptions', label: 'الاشتراكات والمالية', icon: CreditCard, adminOnly: true },
    { id: 'students', label: 'شؤون الطالبات', icon: Users, badge: students.length },
    { id: 'monthly_plans', label: 'الخطط الشهرية والمقرر', icon: Calendar },
    { id: 'attendance', label: 'الحضور والتحضير المبكر', icon: CheckSquare },
    { id: 'recitation', label: 'سجل الحفظ والتسميع', icon: BookOpenCheck },
    { id: 'atqini', label: 'واجبات «أتقني» للتجويد', icon: Sparkles, accent: 'text-[#9E5B6D]' },
    { id: 'challenges', label: 'التحديات والمراجعة الثنائية', icon: Trophy },
    { id: 'exams', label: 'الاختبارات الشهرية', icon: FileText },
    { id: 'grading', label: 'نظام الدرجات والمعايير', icon: Sliders },
    { id: 'portfolio', label: 'ملف الإنجاز الشهري', icon: UserCheck },
    { id: 'reports', label: 'التقارير والإحصائيات', icon: BarChart3 },
    { id: 'staff', label: 'المعلمات والمشرفات', icon: UserCog, adminOnly: true },
    { id: 'settings', label: 'الإعدادات والنسخ الاحتياطي', icon: Settings, adminOnly: true },
  ];

  // تخصيص الأقسام الإدارية والمالية والكادر بحسب الصلاحيات المخصصة
  const canAccessFinances = hasAdminAccess || !!currentUser?.permissions?.canManageFinances;
  const canAccessStaffSection = hasAdminAccess || !!currentUser?.permissions?.canAccessStaff || !!currentUser?.permissions?.canManageUsers;
  const menuItems = rawMenuItems.filter(item => {
    if (item.id === 'subscriptions') return canAccessFinances;
    if (item.id === 'staff') return canAccessStaffSection;
    if (item.adminOnly) return hasAdminAccess;
    return true;
  });

  return (
    <>
      {/* Mobile Backdrop - يظهر فقط عند الفتح ويختفي تماماً برمجياً ولَمْسياً عند الإغلاق */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-40 lg:hidden cursor-pointer touch-auto"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:sticky top-0 lg:top-20 z-50 lg:z-10 h-screen lg:h-[calc(100vh-5rem)] w-72 bg-[#FCFAF8] border-l border-[#EBE3DC] flex flex-col transition-transform duration-200 ease-in-out ${
          isOpen
            ? 'translate-x-0 shadow-2xl lg:shadow-none pointer-events-auto'
            : 'translate-x-full lg:translate-x-0 pointer-events-none lg:pointer-events-auto'
        }`}
      >
        {/* Sidebar Header with Maqra'ah Logo & Name */}
        <div className="flex items-center justify-between p-4 border-b border-[#EBE3DC]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white border border-[#E0D0D4] flex items-center justify-center shadow-xs p-1 overflow-hidden shrink-0">
              <img
                src={settings?.logoUrl || '/pwa-192x192.png'}
                alt={settings?.name || 'مقرأة غيث الغيم'}
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/pwa-192x192.png';
                }}
              />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-stone-800 font-quran text-sm block leading-tight truncate">
                {settings?.name || 'مقرأة غيث الغيم'}
              </span>
              <span className="text-[10px] text-stone-400 block truncate">
                {settings?.subtitle || 'المقرأة القرآنية النموذجية'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-stone-500 hover:bg-stone-200/60 active:scale-95 transition lg:hidden shrink-0"
            aria-label="إغلاق القائمة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1 overscroll-contain">
          <div className="text-[11px] font-bold text-stone-600 px-3 py-1 uppercase tracking-wider mb-1">
            القائمة الإدارية
          </div>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectView(item.id);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all active:scale-[0.98] ${
                  isActive
                    ? 'font-bold border shadow-xs'
                    : 'text-stone-700 hover:bg-[#F2ECE6] hover:text-stone-900'
                }`}
                style={
                  isActive
                    ? {
                        backgroundColor: isDarkMode ? 'rgba(226, 167, 181, 0.16)' : `${primaryColor}15`,
                        color: isDarkMode ? '#E2A7B5' : primaryColor,
                        borderColor: isDarkMode ? 'rgba(226, 167, 181, 0.35)' : `${primaryColor}35`
                      }
                    : undefined
                }
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className="w-4 h-4 shrink-0"
                    style={{ color: isActive ? (isDarkMode ? '#E2A7B5' : primaryColor) : undefined }}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      isActive ? 'text-white' : 'bg-[#EAE2D8] text-stone-600'
                    }`}
                    style={isActive ? { backgroundColor: isDarkMode ? '#9E5B6D' : primaryColor } : undefined}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Dedicated PWA Install Banner */}
        <PWAInstallButton variant="sidebar" />

        {/* Direct Audit Trail Action */}
        {onOpenAuditLog && (
          <div className="px-3 pt-1">
            <button
              type="button"
              onClick={() => {
                if (onClose) onClose();
                onOpenAuditLog();
              }}
              className="w-full py-2 px-3 rounded-xl bg-[#FAF5F2] hover:bg-[#F2ECE6] text-stone-700 text-xs font-bold transition flex items-center justify-between cursor-pointer border border-[#E2D5CC] shadow-2xs active:scale-98"
            >
              <div className="flex items-center gap-2">
                <History className="w-3.5 h-3.5 text-[#8E5364]" />
                <span>سجل التعديلات والعمليات</span>
              </div>
              <span className="text-[10px] bg-white text-stone-600 px-1.5 py-0.5 rounded-md border border-stone-200 font-normal">
                سجل الرقابة
              </span>
            </button>
          </div>
        )}
      </aside>
    </>
  );
};
