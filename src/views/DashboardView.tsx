import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ViewType } from '../components/Sidebar';
import {
  Users, Layers, Award, CheckCircle2, AlertTriangle,
  TrendingUp, Calendar, Sparkles, BookOpen, Clock,
  UserCheck, UserCog, Plus, ChevronLeft, History, Eye, EyeOff, Star, Send,
  PenLine, X
} from 'lucide-react';
import { AuditLogModal } from '../components/AuditLogModal';
import { hasFullAccess, User, StaffWelcomeConfig } from '../types';
import { formatHijriDate, formatHijriShort, getTodayISO } from '../utils/hijriDate';
import { RenderEntityIcon } from '../components/CircleIconLibrary';
import { triggerStudentTelegramAlert } from '../utils/telegramAlert';

interface DashboardViewProps {
  onNavigate: (view: ViewType) => void;
  onOpenQuickModal: (type: string) => void;
  onSelectStudent: (studentId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenQuickModal,
  onSelectStudent
}) => {
  const {
    users, students, circles, tracks, attendanceRecords, dailyRecords,
    allStudentScores, settings, auditLogs, selectedTrackId, setSelectedTrackId,
    updateSettings, updateUser, currentUser, isPrivacyMode, togglePrivacyMode, showToast
  } = useApp();

  const privacyBlurClass = isPrivacyMode
    ? 'blur-[6px] select-none transition-all duration-200 inline-block'
    : 'blur-0 transition-all duration-200 inline-block';

  const [auditModalOpen, setAuditModalOpen] = useState(false);

  const isLeaderOrAdmin = hasFullAccess(currentUser);

  const getRoleBadgeLabel = (user: User | null | undefined) => {
    if (!user) return 'مالك المنصة العام';
    if (user.role === 'developer') return 'المطور التقني';
    if (user.role === 'owner') return 'مالك المنصة العام';
    if (user.role === 'leader') return 'قائدة المقرأة';
    if (user.role === 'supervisor') return 'مشرفة المقرأة';
    return 'معلمة الحلقة';
  };

  // Resolve personalized login welcome toast config for any user (Leader or Staff)
  const resolveUserLoginToastConfig = (targetUser: User | null | undefined): {
    welcomeTitle: string;
    canEditOwnWelcome: boolean;
  } => {
    if (!targetUser) {
      return {
        welcomeTitle: `مرحباً بك ${settings.leaderName || 'ريفة المنصوري'} (مالك المنصة العام)`,
        canEditOwnWelcome: false
      };
    }

    const savedMapConfig = settings.staffWelcomeConfigs?.[targetUser.id];
    const isTargetLeader = hasFullAccess(targetUser);
    const defaultLoginToast = `مرحباً بك ${targetUser.name} (${getRoleBadgeLabel(targetUser)})`;

    const resolvedCanEdit = isTargetLeader
      ? true
      : typeof savedMapConfig?.canEditOwnWelcome === 'boolean'
      ? savedMapConfig.canEditOwnWelcome
      : typeof targetUser.canEditOwnWelcome === 'boolean'
      ? targetUser.canEditOwnWelcome
      : !!targetUser.permissions?.canEditOwnWelcome;

    return {
      welcomeTitle:
        savedMapConfig?.welcomeTitle?.trim() ||
        targetUser.welcomeTitle?.trim() ||
        defaultLoginToast,
      canEditOwnWelcome: resolvedCanEdit
    };
  };

  const currentLoginToastConfig = resolveUserLoginToastConfig(currentUser);
  const canCurrentUserEditWelcome = isLeaderOrAdmin || !!currentLoginToastConfig.canEditOwnWelcome;

  // Editable staff list for Leader's target dropdown (Leader's own account + all Supervisors & Teachers)
  const customizableStaffList = users.filter(
    u => u.role === 'supervisor' || u.role === 'teacher'
  );

  // Simple Login Welcome Toast Customization Modal State
  const [editBannerModalOpen, setEditBannerModalOpen] = useState(false);
  const [selectedTargetUserId, setSelectedTargetUserId] = useState<string>(currentUser?.id || 'leader');
  const [loginToastTextInput, setLoginToastTextInput] = useState(currentLoginToastConfig.welcomeTitle);
  const [targetCanEditOwnWelcome, setTargetCanEditOwnWelcome] = useState<boolean>(!!currentLoginToastConfig.canEditOwnWelcome);

  const loadTargetUserIntoModal = (targetId: string) => {
    setSelectedTargetUserId(targetId);
    const targetUserObj =
      targetId === 'leader' || targetId === currentUser?.id
        ? currentUser
        : users.find(u => u.id === targetId) || currentUser;
    const cfg = resolveUserLoginToastConfig(targetUserObj);
    setLoginToastTextInput(cfg.welcomeTitle);
    setTargetCanEditOwnWelcome(!!cfg.canEditOwnWelcome);
  };

  const handleOpenWelcomeModal = () => {
    if (!canCurrentUserEditWelcome) return;
    const initialTargetId = currentUser?.id || 'leader';
    loadTargetUserIntoModal(initialTargetId);
    setEditBannerModalOpen(true);
  };

  const handleSaveLoginToastText = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetUserObj =
      isLeaderOrAdmin
        ? (users.find(u => u.id === selectedTargetUserId) || currentUser)
        : currentUser;

    const fallbackText = targetUserObj
      ? `مرحباً بك ${targetUserObj.name} (${getRoleBadgeLabel(targetUserObj)})`
      : `مرحباً بك ${settings.leaderName || 'ريفة المنصوري'} (مالك المنصة العام)`;
    const cleanTitle = loginToastTextInput.trim() || fallbackText;

    if (targetUserObj) {
      const isTargetLeader = hasFullAccess(targetUserObj);
      const nextCanEdit = isTargetLeader ? true : targetCanEditOwnWelcome;

      await updateUser(targetUserObj.id, {
        welcomeTitle: cleanTitle,
        canEditOwnWelcome: nextCanEdit,
        permissions: {
          ...(targetUserObj.permissions || {}),
          canEditOwnWelcome: nextCanEdit
        }
      }, true);

      const nextStaffConfigs: Record<string, StaffWelcomeConfig> = {
        ...(settings.staffWelcomeConfigs || {}),
        [targetUserObj.id]: {
          welcomeTitle: cleanTitle,
          personalGoal: '',
          animatedEmojis: [],
          canEditOwnWelcome: nextCanEdit,
          updatedAt: new Date().toISOString()
        }
      };

      await updateSettings({
        staffWelcomeConfigs: nextStaffConfigs
      }, true);

      showToast(cleanTitle, 'success');
    } else {
      showToast(cleanTitle, 'success');
    }

    setEditBannerModalOpen(false);
  };

  // Active track information
  const currentTrack = tracks.find(t => t.id === selectedTrackId);

  // Filter students and circles based on selected track
  const displayedStudents = selectedTrackId
    ? students.filter(s => s.trackId === selectedTrackId)
    : students;

  const displayedCircles = selectedTrackId
    ? circles.filter(c => !c.isArchived && c.trackId === selectedTrackId)
    : circles.filter(c => !c.isArchived);

  const activeStudents = displayedStudents.filter(s => s.status === 'active' && !s.archived);
  const archivedStudentsCount = displayedStudents.filter(s => s.status === 'archived' || s.archived).length;
  const totalStudents = activeStudents.length;
  const totalAllActiveStudents = students.filter(s => s.status === 'active' && !s.archived).length;

  // Today attendance for displayed track (active students only)
  const today = getTodayISO();
  const displayedStudentIds = new Set(activeStudents.map(s => s.id));
  const todayAttendance = attendanceRecords.filter(
    a => a.date === today && displayedStudentIds.has(a.studentId)
  );
  const presentToday = todayAttendance.filter(a => a.status === 'present').length;
  const earlyPrepToday = todayAttendance.filter(a => a.earlyPrepCardSent).length;

  // Average percentage of displayed active students
  const displayedScoresList = activeStudents
    .map(s => allStudentScores[s.id])
    .filter(Boolean);
  const avgPercentage = displayedScoresList.length > 0
    ? (displayedScoresList.reduce((acc, s) => acc + s.finalPercentage, 0) / displayedScoresList.length).toFixed(1)
    : '0';

  // Outstanding students (Top 5 in displayed track)
  const outstandingStudents = [...activeStudents]
    .sort((a, b) => (allStudentScores[b.id]?.finalPercentage || 0) - (allStudentScores[a.id]?.finalPercentage || 0))
    .slice(0, 5);

  // Frequent absence alerts
  const atRiskAbsence = activeStudents.filter(s => {
    const score = allStudentScores[s.id];
    return score && score.absentUnexcusedCount >= 2;
  });

  // Students with incomplete/unrecorded daily logs
  const incompleteDailyLogs = activeStudents.filter(s => {
    const recs = dailyRecords.filter(d => d.studentId === s.id);
    return recs.length === 0 || recs.some(r => r.status === 'pending' || (r.status as any) === 'incomplete' || (r.status as any) === 'partial');
  });

  return (
    <div className="space-y-6">
      
      {/* Welcome Banner (Exact Compact Hero Banner Layout) */}
      <div
        style={{
          backgroundColor: settings.primaryColor || '#8E5364'
        }}
        data-privacy="banner"
        className="relative overflow-hidden rounded-3xl p-5 sm:p-7 text-white shadow-md transition-all duration-300 privacy-exempt"
      >
        <div className="relative z-10 max-w-2xl">
          {/* Track Dropdown Selector in Badge Position */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur text-xs font-medium border border-white/20">
              <span className="font-bold text-white/95">{settings.name || 'مقرأة غيث الغيم'}</span>
              <span className="text-white/40">•</span>
              <span className="text-white/80 text-[11px]">المسار المعروض:</span>
              <div className="relative inline-flex items-center gap-1.5 bg-black/25 hover:bg-black/40 text-white font-bold text-xs rounded-xl px-3 py-1 border border-white/30 transition shadow-2xs cursor-pointer">
                <span>
                  {currentTrack
                    ? (currentTrack.name || '').replace(/[🪴🤎]/g, '').trim()
                    : 'كافة المسارات'}
                </span>
                <span
                  className={`privacy-count-digit text-[11px] font-bold text-amber-200 ${
                    isPrivacyMode ? 'blur-[5px] select-none' : ''
                  }`}
                  style={isPrivacyMode ? { filter: 'blur(5px)', userSelect: 'none' } : undefined}
                >
                  ({isPrivacyMode ? '••' : activeStudents.length} طالبة)
                </span>
                <span className="text-[10px] text-white/75 mr-0.5">▾</span>
                <select
                  value={selectedTrackId || 'all'}
                  onChange={e => setSelectedTrackId(e.target.value === 'all' ? null : e.target.value)}
                  aria-label="المسار المعروض"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                >
                  <option value="all" className="bg-stone-800 text-white">
                    {isPrivacyMode ? 'كافة المسارات (•• طالبة)' : `كافة المسارات (${totalAllActiveStudents} طالبة)`}
                  </option>
                  {tracks.filter(t => !t.isArchived).map(track => {
                    const count = students.filter(s => s.trackId === track.id && s.status === 'active' && !s.archived).length;
                    const cleanTrackName = (track.name || '').replace(/[🪴🤎]/g, '').trim();
                    return (
                      <option key={track.id} value={track.id} className="bg-stone-800 text-white">
                        {isPrivacyMode ? `${cleanTrackName} (•• طالبة)` : `${cleanTrackName} (${count} طالبة)`}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur text-xs font-bold text-white border border-white/20">
              <Calendar className="w-3.5 h-3.5 text-amber-200" />
              <span>{formatHijriDate(today, { includeWeekday: true })}</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 mb-1.5">
            <h2 className="text-lg sm:text-xl font-bold tracking-normal text-white">
              مرحباً بكِ في منصة غيث الغيم الإدارية
            </h2>
            {canCurrentUserEditWelcome && (
              <button
                type="button"
                onClick={handleOpenWelcomeModal}
                className="p-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/20 transition cursor-pointer flex items-center justify-center hover:scale-105 active:scale-95 shadow-2xs"
                title={isLeaderOrAdmin ? 'تعديل نص ترحيب الدخول لكِ أو للمشرفات والمعلمات' : 'تعديل نص ترحيب الدخول'}
                aria-label="تعديل نص ترحيب الدخول"
              >
                <PenLine className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <p className="text-white/85 text-xs sm:text-sm leading-relaxed mb-5">
            لوحة قيادة المقرأة، متابعة الحلقات، التحضير والإنجاز، ورصد التحديات والاختبارات المعتمدة
          </p>
          
          {/* Quick Buttons Bar: Row 1 + Row 2 */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => onOpenQuickModal('student')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-[#744251] text-xs font-bold hover:bg-white/90 shadow-xs transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة طالبة</span>
              </button>
              <button
                onClick={() => onNavigate('attendance')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 backdrop-blur text-white text-xs font-medium hover:bg-white/25 border border-white/20 transition cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>رصد الحضور السريع</span>
              </button>
              <button
                onClick={() => onNavigate('recitation')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 backdrop-blur text-white text-xs font-medium hover:bg-white/25 border border-white/20 transition cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>تسجيل التسميع</span>
              </button>
              <button
                onClick={() => onNavigate('atqini')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 backdrop-blur text-white text-xs font-medium hover:bg-white/25 border border-white/20 transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>واجبات «أتقني»</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {hasFullAccess(currentUser) && (
                <button
                  onClick={() => onNavigate('staff')}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 backdrop-blur text-white text-xs font-medium hover:bg-white/25 border border-white/20 transition cursor-pointer"
                  title="الوصول إلى قسم المعلمات والمشرفات"
                >
                  <UserCog className="w-3.5 h-3.5" />
                  <span>المعلمات والمشرفات</span>
                </button>
              )}
              <button
                type="button"
                onClick={togglePrivacyMode}
                className={`flex items-center justify-center w-9 h-9 rounded-xl text-xs font-bold border transition cursor-pointer shadow-xs ${
                  isPrivacyMode
                    ? 'bg-amber-400 text-stone-900 border-amber-300 hover:bg-amber-300'
                    : 'bg-white/15 backdrop-blur text-white border-white/25 hover:bg-white/25'
                }`}
                title={isPrivacyMode ? 'إلغاء وضع الخصوصية وإظهار الأرقام والأسماء' : 'تفعيل وضع الخصوصية وتمويه الأرقام الحساسة'}
                aria-label="وضع الخصوصية"
              >
                {isPrivacyMode ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Decorative cloud pattern */}
        <div className="absolute left-[-20px] bottom-[-40px] opacity-10 pointer-events-none text-9xl">
          ☁️
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Total Students */}
        <div
          onClick={() => onNavigate('students')}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E8DFD8] shadow-2xs hover:border-[#D4C4BC] transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-semibold">إجمالي الطالبات</span>
            <div className="w-8 h-8 rounded-xl bg-[#F7EFE9] text-[#8B5E3C] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-xl sm:text-2xl font-bold text-stone-900 mb-1 flex items-baseline ${privacyBlurClass}`}>
            <span>{totalStudents}</span>
            <span className="text-xs font-normal text-stone-400 mr-1.5">طالبة</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-stone-500">
            <span className={privacyBlurClass}>
              {activeStudents.length} نشطة في الحلقات{archivedStudentsCount > 0 ? ` • ${archivedStudentsCount} بالمؤرشفات` : ''}
            </span>
            <ChevronLeft className="w-3.5 h-3.5 text-stone-400 group-hover:translate-x-[-2px] transition" />
          </div>
        </div>

        {/* Tracks & Circles */}
        <div
          onClick={() => onNavigate('tracks_circles')}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E8DFD8] shadow-2xs hover:border-[#D4C4BC] transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-semibold">الحلقات النشطة</span>
            <div className="w-8 h-8 rounded-xl bg-[#EBF3EE] text-[#2D5A43] flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-xl sm:text-2xl font-bold text-stone-900 mb-1 flex items-baseline ${privacyBlurClass}`}>
            <span>{displayedCircles.length}</span>
            <span className="text-xs font-normal text-stone-400 mr-1.5">حلقة</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-stone-500">
            <span>{currentTrack ? (currentTrack.name || '').replace(/[🪴🤎]/g, '').trim() : `${tracks.length} مسارات معتمدة`}</span>
            <ChevronLeft className="w-3.5 h-3.5 text-stone-400 group-hover:translate-x-[-2px] transition" />
          </div>
        </div>

        {/* Average Achievement */}
        <div
          onClick={() => onNavigate('grading')}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E8DFD8] shadow-2xs hover:border-[#D4C4BC] transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-semibold">متوسط الدرجات والنسب</span>
            <div className="w-8 h-8 rounded-xl bg-[#F9EFF2] text-[#9E5B6D] flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-xl sm:text-2xl font-bold text-stone-900 mb-1 flex items-baseline ${privacyBlurClass}`}>
            <span>{avgPercentage}%</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#2D5A43] font-medium">
            <span>نظام النسب المئوية الموزونة</span>
            <ChevronLeft className="w-3.5 h-3.5 text-stone-400 group-hover:translate-x-[-2px] transition" />
          </div>
        </div>

        {/* Early Prep & Attendance */}
        <div
          onClick={() => onNavigate('attendance')}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E8DFD8] shadow-2xs hover:border-[#D4C4BC] transition cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-semibold">التحضير المبكر والحضور</span>
            <div className="w-8 h-8 rounded-xl bg-[#F2F6F3] text-[#3E6B48] flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          {todayAttendance.length > 0 ? (
            <div className={`text-lg sm:text-xl font-semibold text-stone-900 mb-1 flex items-baseline ${privacyBlurClass}`}>
              <span>{presentToday} / {todayAttendance.length}</span>
              <span className="text-xs font-normal text-stone-400 mr-1.5">حاضرة</span>
            </div>
          ) : (
            <div className="text-[1.05rem] sm:text-[1.15rem] font-semibold text-stone-900 mb-1.5 leading-snug">
              <span>{formatHijriShort(today)}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-[11px] text-stone-500">
            <span className="inline-flex items-center gap-1">
              <span className={privacyBlurClass}>{earlyPrepToday}</span>
              <span>بطاقة تحضير مبكر</span>
              <Star className="w-3.5 h-3.5 text-[#9A5643] shrink-0" />
            </span>
            <ChevronLeft className="w-3.5 h-3.5 text-stone-400 group-hover:translate-x-[-2px] transition" />
          </div>
        </div>

      </div>

      {/* Circle breakdown overview */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#8E5364]" />
            <span>حلقات {currentTrack ? (currentTrack.name || '').replace(/[🪴🤎]/g, '').trim() : 'المقرأة'}:</span>
          </h3>
          <div className="flex items-center gap-2">
            {hasFullAccess(currentUser) && (
              <>
                <button
                  onClick={() => onNavigate('staff')}
                  className="text-xs text-[#8E5364] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  title="الانتقال إلى سجل المعلمات والمشرفات"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>المعلمات والمشرفات</span>
                </button>
                <span className="text-stone-300">•</span>
              </>
            )}
            <button
              onClick={() => onNavigate('tracks_circles')}
              className="text-xs text-[#8E5364] font-bold hover:underline cursor-pointer"
            >
              إدارة الحلقات والمسارات
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {displayedCircles.map((circle) => {
            const circleStudents = students.filter(s => s.circleId === circle.id && s.status === 'active');
            const avgCircleScore = circleStudents.length > 0
              ? (circleStudents.reduce((acc, s) => acc + (allStudentScores[s.id]?.finalPercentage || 0), 0) / circleStudents.length).toFixed(1)
              : '0';

            return (
              <div
                key={circle.id}
                onClick={() => onNavigate('tracks_circles')}
                className="bg-white p-4 rounded-2xl border border-[#E8DFD8] shadow-2xs hover:shadow-xs hover:border-[#C4B2AA] transition cursor-pointer"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <RenderEntityIcon icon={circle.icon} className="text-xl" sproutClassName="w-5 h-5 text-[#96503E]" />
                    <div>
                      <h3 className="font-bold text-stone-900 text-sm">{(circle.name || '').replace(/[🪴🤎]/g, '').trim()}</h3>
                      <p className="text-[11px] text-stone-500">المعلمة: <span className={privacyBlurClass}>{circle.teacherName}</span></p>
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-[#EBF3EE] text-[#2D5A43] ${privacyBlurClass}`}>
                    {avgCircleScore}%
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-stone-600 mb-3">
                  <div className="flex justify-between text-[11px]">
                    <span>النصاب وعدد الطالبات:</span>
                    <span className="font-semibold text-stone-800"><span className={privacyBlurClass}>{circleStudents.length}</span> من {circle.maxStudents} طالبة</span>
                  </div>
                  <div
                    className="w-full h-1.5 rounded-full overflow-hidden"
                    style={{ backgroundColor: '#F6EFEA' }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (circleStudents.length / circle.maxStudents) * 100)}%`,
                        backgroundColor: '#9A5643'
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-stone-400 pt-1">
                    <span>المشرفة: <span className={privacyBlurClass}>{circle.supervisorName}</span></span>
                    <span>{circle.scheduleDays.join('، ')}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two columns: Outstanding Leaderboard + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Outstanding Students (نجمات المقرأة) */}
        <div className="bg-white p-5 rounded-3xl border border-[#E8DFD8] shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#FBF1F3] text-[#9E5B6D] flex items-center justify-center">
                <Award className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-stone-900 text-sm flex items-center gap-1.5">
                  <span>نجمات المقرأة المتميزات</span>
                  <Star className="w-4 h-4 text-[#9A5643] shrink-0" />
                </h3>
                <p className="text-[11px] text-stone-400">أعلى نسب تراكمية وانضباط في الحفظ والتجويد</p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('students')}
              className="text-xs text-[#9E5B6D] font-bold hover:underline"
            >
              عرض الكل
            </button>
          </div>

          <div className="space-y-2.5">
            {outstandingStudents.map((student, idx) => {
              const score = allStudentScores[student.id];
              const circle = circles.find(c => c.id === student.circleId);
              return (
                <div
                  key={student.id}
                  onClick={() => onSelectStudent(student.id)}
                  className="flex items-center justify-between p-3 rounded-2xl bg-[#FCFAF8] hover:bg-[#F8F2F4] border border-[#EFE8E2] transition cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      idx === 0 ? 'bg-amber-100 text-amber-800' : idx === 1 ? 'bg-stone-200 text-stone-700' : 'bg-orange-100 text-orange-800'
                    }`}>
                      {idx + 1}
                    </span>
                    <div>
                      <div className="font-bold text-xs sm:text-sm text-stone-900 group-hover:text-[#9E5B6D] transition">
                        <span className={privacyBlurClass}>{student.name}</span>
                      </div>
                      <div className="text-[11px] text-stone-400">
                        {circle?.name} • رفيقتها: <span className={privacyBlurClass}>{student.partnerStudentName || 'لم تعين'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-xl text-white shadow-2xs font-mono border border-white/20 select-none inline-flex items-center gap-1 ${privacyBlurClass}`}
                      style={{ backgroundColor: settings.primaryColor || '#8E5364' }}
                    >
                      <span>{score?.finalPercentage}%</span>
                      <span className="opacity-80 text-[10px]">({score?.gradeLabel})</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Administrative Alerts & Follow-up */}
        <div className="bg-white p-5 rounded-3xl border border-[#E8DFD8] shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#FDF6F2] border border-[#E5C3B3] text-[#9A5643] flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-stone-900 text-sm">تنبيهات المتابعة والغياب المتكرر</h3>
                <p className="text-[11px] text-stone-400">طالبات بحاجة إلى رعاية وتواصل من المشرفة</p>
              </div>
            </div>
            <span className={`text-xs font-bold text-[#9A5643] bg-[#FDF6F2] border border-[#E5C3B3] px-2.5 py-0.5 rounded-full ${privacyBlurClass}`}>
              {atRiskAbsence.length + (incompleteDailyLogs.length > 0 ? 1 : 0)} تنبيه
            </span>
          </div>

          {atRiskAbsence.length > 0 ? (
            <div className="space-y-2">
              {atRiskAbsence.map(st => {
                const score = allStudentScores[st.id];
                const circle = circles.find(c => c.id === st.circleId);
                return (
                  <div key={st.id} className="p-3 rounded-2xl bg-[#FDF6F2] border border-[#E5C3B3] flex items-center justify-between gap-2 text-xs">
                    <div>
                      <div className="font-bold text-[#7B3F30]"><span className={privacyBlurClass}>{st.name}</span></div>
                      <div className="text-[#9A5643] text-[11px]">
                        {circle?.name} • غياب دون عذر: <strong className="text-[#A14A2A]"><span className={privacyBlurClass}>{score?.absentUnexcusedCount}</span> مرات</strong>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => triggerStudentTelegramAlert({
                          studentName: st.name,
                          circleName: circle?.name || 'الحلقة',
                          absenceCount: score?.absentUnexcusedCount || 0,
                          telegramUsername: st.telegramUsername,
                          showToast
                        })}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#FDF6F2] hover:bg-[#F6E8E0] text-[#9A5643] border border-[#E5C3B3] font-bold rounded-lg shadow-2xs transition text-[11px] cursor-pointer"
                        title="نسخ رسالة التنبيه وفتح محادثة تيليجرام"
                      >
                        <Send className="w-3 h-3 shrink-0" />
                        <span>تنبيه تيليجرام</span>
                      </button>
                      <button
                        onClick={() => onSelectStudent(st.id)}
                        className="px-2.5 py-1 bg-white text-[#7B3F30] border border-[#E5C3B3] font-semibold rounded-lg shadow-2xs hover:bg-[#FAF3EE] transition text-[11px] cursor-pointer"
                      >
                        متابعة الملف
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-[#EBF3EE] text-[#2D5A43] text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#3E6B48]" />
              <span>لا توجد حالات غياب متكرر حرجة حالياً، جميع الطالبات منتظمات.</span>
            </div>
          )}

          {/* Incomplete daily logs */}
          {incompleteDailyLogs.length > 0 && (
            <div className="p-3 rounded-2xl bg-[#FBF6EE] border border-[#E9DFD0] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-700" />
                <div>
                  <div className={`font-bold text-stone-800 ${privacyBlurClass}`}>
                    هناك {incompleteDailyLogs.length} طالبة لم يكتمل تسجيل إنجازهن اليومي
                  </div>
                  <div className="text-[11px] text-stone-500">
                    يمكن للمعلمة إدخال التسميع أو شروط الحفظ المتبقية
                  </div>
                </div>
              </div>
              <button
                onClick={() => onNavigate('recitation')}
                className="px-2.5 py-1 bg-[#8E5364] text-white font-medium rounded-lg text-[11px] hover:bg-[#744251]"
              >
                رصد التسميع
              </button>
            </div>
          )}

          {/* Quick link to Audit trail */}
          <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
            <span className={`truncate max-w-[240px] ${privacyBlurClass}`}>آخر عملية: {auditLogs[0]?.details || 'تهيئة النظام'}</span>
            <button
              type="button"
              onClick={() => setAuditModalOpen(true)}
              className="text-[#8E5364] font-bold hover:underline cursor-pointer flex items-center gap-1 shrink-0"
            >
              <History className="w-3.5 h-3.5" />
              <span>فتح سجل التعديلات</span>
            </button>
          </div>

        </div>

      </div>

      {/* Simple Login Welcome Toast Customization Modal (No Goal Box, No Emojis) */}
      {editBannerModalOpen && canCurrentUserEditWelcome && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-[#E8DFD8] space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="font-bold text-stone-900 text-base flex items-center gap-2 font-quran">
                <PenLine className="w-4 h-4 text-[#9A5643] shrink-0" />
                <span>تعديل نص ترحيب الدخول</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditBannerModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveLoginToastText} className="space-y-4">
              {/* 1. Leader's Target Selector Dropdown */}
              {isLeaderOrAdmin && (
                <div className="p-3.5 rounded-2xl bg-[#FDF6F2] border border-[#E5C3B3] space-y-2">
                  <label className="block text-xs font-bold text-[#7B3F30] flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-[#9A5643] shrink-0" />
                    <span>تخصيص ترحيب الدخول لـ:</span>
                  </label>
                  <select
                    value={selectedTargetUserId}
                    onChange={e => loadTargetUserIntoModal(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#E5C3B3] rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#9A5643] cursor-pointer"
                  >
                    <option value={currentUser?.id || 'leader'}>
                      حسابي الشخصي ({currentUser?.name || settings.leaderName})
                    </option>
                    {customizableStaffList.map(staff => (
                      <option key={staff.id} value={staff.id}>
                        {staff.name} ({staff.role === 'supervisor' ? 'مشرفة المقرأة' : 'معلمة الحلقة'})
                      </option>
                    ))}
                  </select>

                  {/* Quick permission toggle when a supervisor/teacher is selected */}
                  {selectedTargetUserId !== (currentUser?.id || 'leader') && (
                    <div className="pt-2 border-t border-[#E5C3B3]/60 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-[#7B3F30]">
                        صلاحية تعديل ترحيب الدخول:
                      </span>
                      <button
                        type="button"
                        onClick={() => setTargetCanEditOwnWelcome(prev => !prev)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-bold transition cursor-pointer ${
                          targetCanEditOwnWelcome
                            ? 'bg-white text-[#7B3F30] border-[#9A5643]'
                            : 'bg-stone-100 text-stone-500 border-stone-200'
                        }`}
                      >
                        <div
                          className={`w-7 h-4 flex items-center rounded-full p-0.5 transition duration-200 ${
                            targetCanEditOwnWelcome ? 'bg-[#9A5643] justify-end' : 'bg-stone-300 justify-start'
                          }`}
                        >
                          <div className="bg-white w-3 h-3 rounded-full shadow-2xs" />
                        </div>
                        <span>{targetCanEditOwnWelcome ? 'مسموح بالتعديل' : 'مخفي (افتراضي)'}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 2. Custom Login Welcome Toast Text Input */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5 flex items-center gap-1.5">
                  <PenLine className="w-3.5 h-3.5 text-[#9A5643] shrink-0" />
                  <span>نص إشعار ترحيب الدخول:</span>
                </label>
                <input
                  type="text"
                  required
                  value={loginToastTextInput}
                  onChange={e => setLoginToastTextInput(e.target.value)}
                  placeholder="مثال: مرحباً بك ريفة المنصوري (مالك المنصة العام)"
                  className="w-full px-3.5 py-2.5 border border-stone-200 rounded-xl text-xs font-bold text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#9A5643]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setEditBannerModalOpen(false)}
                  className="px-4 py-2 text-stone-600 text-xs rounded-xl hover:bg-stone-100 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#9A5643] hover:bg-[#7B3F30] text-white text-xs font-bold rounded-xl shadow-2xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>حفظ النص</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audit Log Modal */}
      <AuditLogModal
        isOpen={auditModalOpen}
        onClose={() => setAuditModalOpen(false)}
      />

    </div>
  );
};

