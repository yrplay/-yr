import React from 'react';
import { useApp } from '../context/AppContext';
import { ViewType } from '../components/Sidebar';
import {
  Users, Layers, Award, CheckCircle2, AlertTriangle, ArrowUpRight,
  TrendingUp, Calendar, Sparkles, BookOpen, Clock, HeartHandshake,
  UserCheck, ShieldAlert, Plus, ChevronLeft
} from 'lucide-react';

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
    students, circles, tracks, attendanceRecords, dailyRecords,
    studentAtqiniSubmissions, studentChallengeSubmissions,
    allStudentScores, settings, auditLogs
  } = useApp();

  // Metrics
  const activeStudents = students.filter(s => s.status === 'active');
  const totalStudents = students.length;
  const activeTracks = tracks.filter(t => !t.isArchived).length;
  const activeCircles = circles.filter(c => !c.isArchived);

  // Today attendance
  const today = new Date().toISOString().split('T')[0];
  const todayAttendance = attendanceRecords.filter(a => a.date === today);
  const presentToday = todayAttendance.filter(a => a.status === 'present').length;
  const earlyPrepToday = todayAttendance.filter(a => a.earlyPrepCardSent).length;

  // Average percentage of students
  const studentScoresList = Object.values(allStudentScores);
  const avgPercentage = studentScoresList.length > 0
    ? (studentScoresList.reduce((acc, s) => acc + s.finalPercentage, 0) / studentScoresList.length).toFixed(1)
    : '0';

  // Outstanding students (Top 5)
  const outstandingStudents = [...students]
    .filter(s => s.status === 'active')
    .sort((a, b) => (allStudentScores[b.id]?.finalPercentage || 0) - (allStudentScores[a.id]?.finalPercentage || 0))
    .slice(0, 5);

  // Frequent absence alerts (students with >= 2 absences)
  const atRiskAbsence = students.filter(s => {
    const score = allStudentScores[s.id];
    return score && score.absentUnexcusedCount >= 2;
  });

  // Students with incomplete/unrecorded daily logs
  const incompleteDailyLogs = students.filter(s => {
    const recs = dailyRecords.filter(d => d.studentId === s.id);
    return recs.length === 0 || recs.some(r => r.status === 'incomplete' || r.status === 'partial');
  });

  return (
    <div className="space-y-6">
      
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#8E5364] via-[#744251] to-[#55323C] p-6 sm:p-8 text-white shadow-md">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur text-xs font-medium mb-3 border border-white/20">
            <span>🪴</span>
            <span>مقرأة غيث الغيم • مسار مشكاة الغيم للحفظ</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-quran mb-2">
            مرحباً بكِ في منصة غيث الغيم الإدارية
          </h2>
          <p className="text-white/80 text-xs sm:text-sm leading-relaxed mb-6">
            {settings.motto} — إشراف قائدة المقرأة: <strong>{settings.leaderName}</strong>. مرحلة متابعة الخطة الشهرية الأولى بحلقات راسخات.
          </p>
          
          {/* Quick Buttons Bar */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => onOpenQuickModal('student')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-[#744251] text-xs font-bold hover:bg-white/90 shadow-xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة طالبة</span>
            </button>
            <button
              onClick={() => onNavigate('attendance')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 backdrop-blur text-white text-xs font-medium hover:bg-white/25 border border-white/20 transition"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>رصد الحضور السريع</span>
            </button>
            <button
              onClick={() => onNavigate('recitation')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 backdrop-blur text-white text-xs font-medium hover:bg-white/25 border border-white/20 transition"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>تسجيل التسميع</span>
            </button>
            <button
              onClick={() => onNavigate('atqini')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 backdrop-blur text-white text-xs font-medium hover:bg-white/25 border border-white/20 transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>واجبات «أتقني»</span>
            </button>
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
          <div className="text-xl sm:text-2xl font-bold text-stone-900 mb-1 flex items-baseline">
            <span>{totalStudents}</span>
            <span className="text-xs font-normal text-stone-400 mr-1.5">طالبة</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-stone-500">
            <span>{activeStudents.length} نشطة في الحلقات</span>
            <ChevronLeft className="w-3.5 h-3.5 text-stone-400 group-hover:translate-x-[-2px] transition" />
          </div>
        </div>

        {/* Tracks & Circles */}
        <div
          onClick={() => onNavigate('tracks_circles')}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E8DFD8] shadow-2xs hover:border-[#D4C4BC] transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-semibold">المسارات والحلقات</span>
            <div className="w-8 h-8 rounded-xl bg-[#EBF3EE] text-[#2D5A43] flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-stone-900 mb-1 flex items-baseline">
            <span>{activeCircles.length}</span>
            <span className="text-xs font-normal text-stone-400 mr-1.5">حلقات راسخات</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-stone-500">
            <span>مسار {tracks[0]?.name || 'مشكاة الغيم'}</span>
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
          <div className="text-xl sm:text-2xl font-bold text-stone-900 mb-1 flex items-baseline">
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
          className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E8DFD8] shadow-2xs hover:border-[#D4C4BC] transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-semibold">التحضير المبكر والحضور</span>
            <div className="w-8 h-8 rounded-xl bg-[#F2F6F3] text-[#3E6B48] flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-stone-900 mb-1 flex items-baseline">
            <span>{todayAttendance.length > 0 ? `${presentToday} / ${todayAttendance.length}` : 'سجل اليوم'}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-stone-500">
            <span>{earlyPrepToday} بطاقة تحضير مبكر ⭐</span>
            <ChevronLeft className="w-3.5 h-3.5 text-stone-400 group-hover:translate-x-[-2px] transition" />
          </div>
        </div>

      </div>

      {/* Circle breakdown overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {activeCircles.map((circle) => {
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
                  <span className="text-xl">{circle.icon || '🪴'}</span>
                  <div>
                    <h3 className="font-bold text-stone-900 text-sm">{circle.name}</h3>
                    <p className="text-[11px] text-stone-500">المعلمة: {circle.teacherName}</p>
                  </div>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#EBF3EE] text-[#2D5A43]">
                  {avgCircleScore}%
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-stone-600 mb-3">
                <div className="flex justify-between text-[11px]">
                  <span>عدد الطالبات:</span>
                  <span className="font-semibold text-stone-800">{circleStudents.length} من {circle.maxStudents} طالبة</span>
                </div>
                <div className="w-full bg-[#EFEAE5] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#8E5364] h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, (circleStudents.length / circle.maxStudents) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-stone-400 pt-1">
                  <span>المشرفة: {circle.supervisorName}</span>
                  <span>{circle.scheduleDays.join('، ')}</span>
                </div>
              </div>
            </div>
          );
        })}
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
                <h3 className="font-bold text-stone-900 text-sm">نجمات المقرأة المتميزات 🌟</h3>
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
                        {student.name}
                      </div>
                      <div className="text-[11px] text-stone-400">
                        {circle?.name} • رفيقتها: {student.partnerStudentName || 'لم تعين'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: score?.gradeColor || '#2D5A43' }}
                    >
                      {score?.finalPercentage}% ({score?.gradeLabel})
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
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-stone-900 text-sm">تنبيهات المتابعة والغياب المتكرر</h3>
                <p className="text-[11px] text-stone-400">طالبات بحاجة إلى رعاية وتواصل من المشرفة</p>
              </div>
            </div>
            <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
              {atRiskAbsence.length + (incompleteDailyLogs.length > 0 ? 1 : 0)} تنبيه
            </span>
          </div>

          {atRiskAbsence.length > 0 ? (
            <div className="space-y-2">
              {atRiskAbsence.map(st => {
                const score = allStudentScores[st.id];
                const circle = circles.find(c => c.id === st.circleId);
                return (
                  <div key={st.id} className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-amber-900">{st.name}</div>
                      <div className="text-amber-700 text-[11px]">
                        {circle?.name} • غياب دون عذر: <strong className="text-rose-700">{score?.absentUnexcusedCount} مرات</strong>
                      </div>
                    </div>
                    <button
                      onClick={() => onSelectStudent(st.id)}
                      className="px-2.5 py-1 bg-white text-amber-900 font-semibold rounded-lg shadow-2xs hover:bg-amber-100 transition text-[11px]"
                    >
                      متابعة الملف
                    </button>
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
                  <div className="font-bold text-stone-800">
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
            <span>آخر عملية: {auditLogs[0]?.details || 'تهيئة النظام'}</span>
            <button
              onClick={() => onNavigate('settings')}
              className="text-[#8E5364] font-bold hover:underline"
            >
              سجل التغييرات
            </button>
          </div>

        </div>

      </div>

    </div>
  );
};
