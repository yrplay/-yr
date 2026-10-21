import React from 'react';
import { useApp } from '../context/AppContext';
import {
  LayoutDashboard, Layers, Users, Calendar, CheckSquare,
  BookOpenCheck, Sparkles, Trophy, FileText, Sliders,
  UserCheck, BarChart3, UserCog, Settings, X, Heart, Lock
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

export type ViewType =
  | 'dashboard'
  | 'tracks_circles'
  | 'students'
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
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onSelectView, isOpen, onClose, onLockSession }) => {
  const { circles, students, settings } = useApp();
  const primaryColor = settings?.primaryColor || '#8E5364';

  const menuItems: { id: ViewType; label: string; icon: any; badge?: string | number; accent?: string }[] = [
    { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
    { id: 'tracks_circles', label: 'المسارات والحلقات', icon: Layers, badge: circles.length },
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
    { id: 'staff', label: 'المعلمات والمشرفات', icon: UserCog },
    { id: 'settings', label: 'الإعدادات والنسخ الاحتياطي', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:sticky top-0 lg:top-20 z-50 lg:z-10 h-screen lg:h-[calc(100vh-5rem)] w-72 bg-[#FCFAF8] border-l border-[#EBE3DC] flex flex-col transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Mobile Header in Drawer */}
        <div className="flex items-center justify-between p-4 border-b border-[#EBE3DC] lg:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white border border-[#E0D0D4] flex items-center justify-center shadow-xs p-0.5 overflow-hidden">
              <img
                src={settings?.logoUrl || '/pwa-192x192.png'}
                alt={settings?.name || 'مقرأة غيث الغيم'}
                className="w-full h-full object-contain"
              />
            </div>
            <span className="font-bold text-stone-800 font-quran text-base">{settings?.name || 'مقرأة غيث الغيم'}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-200/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="text-[11px] font-bold text-stone-600 px-3 py-1 uppercase tracking-wider mb-1">
            القائمة الإدارية
          </div>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectView(item.id);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                  isActive
                    ? 'font-bold border shadow-xs'
                    : 'text-stone-700 hover:bg-[#F2ECE6] hover:text-stone-900'
                }`}
                style={
                  isActive
                    ? {
                        backgroundColor: `${primaryColor}15`,
                        color: primaryColor,
                        borderColor: `${primaryColor}35`
                      }
                    : undefined
                }
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className="w-4 h-4"
                    style={{ color: isActive ? primaryColor : undefined }}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      isActive ? 'text-white' : 'bg-[#EAE2D8] text-stone-600'
                    }`}
                    style={isActive ? { backgroundColor: primaryColor } : undefined}
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

        {/* Lock Session / Logout Action */}
        {onLockSession && (
          <div className="px-3 py-1">
            <button
              onClick={() => {
                if (onClose) onClose();
                onLockSession();
              }}
              className="w-full py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100/80 text-rose-700 text-xs font-bold transition flex items-center justify-between cursor-pointer border border-rose-200/60 shadow-2xs active:scale-98"
            >
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-rose-600" />
                <span>قفل المنصة وتسجيل الخروج</span>
              </div>
              <span className="text-[10px] bg-white text-rose-700 px-1.5 py-0.5 rounded-md border border-rose-200 font-normal">
                خروج آمن
              </span>
            </button>
          </div>
        )}

        {/* Footer Brand note & Developer Signature */}
        <div className="p-4 border-t border-[#EBE3DC] bg-[#F7F3EE] space-y-2">
          <div className="flex items-center gap-2 text-xs text-stone-600 font-medium">
            <Heart className="w-3.5 h-3.5 text-[#9E5B6D] fill-[#9E5B6D]" />
            <span>مقرأة غيث الغيم • مسار مشكاة الغيم</span>
          </div>
          <div className="text-[11px] text-stone-400">
            الحلقات: راسخات (١، ٢، ٣) 🪴🤎
          </div>
          <div className="pt-2 border-t border-stone-200/70 text-[11px] text-stone-500 flex items-center justify-between">
            <span>تطوير وبناء:</span>
            <span className="font-bold text-[#8E5364] flex items-center gap-1 font-mono text-[11px]">
              <span>بواسطة ياسر التاج · yr_alhosine</span>
              <span>✨</span>
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};
