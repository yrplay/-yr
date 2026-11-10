import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  CheckSquare, Calendar, Users, Clock, CheckCircle2, XCircle,
  AlertCircle, Star, Sparkles, Filter, Save, ChevronLeft, ChevronRight, Trash2
} from 'lucide-react';
import { AttendanceRecord } from '../types';
import { HijriDateNavigationBar, formatHijriDate, formatHijriDateTime, getTodayISO } from '../utils/hijriDate';

export const AttendanceView: React.FC = () => {
  const {
    students, circles, attendanceRecords, dailyRecords, studentChallengeSubmissions,
    saveAttendance, saveBulkAttendance,
    clearStudentDayAttendance, toggleAttendanceWeeklyStar,
    showToast, allStudentScores, selectedTrackId,
    selectedCircleId, setSelectedCircleId, selectedDate, setSelectedDate
  } = useApp();

  const availableCircles = React.useMemo(() => {
    if (!selectedTrackId || selectedTrackId === 'all') return circles.filter(c => !c.isArchived);
    return circles.filter(c => !c.isArchived && c.trackId === selectedTrackId);
  }, [circles, selectedTrackId]);

  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'early_prep' | 'absent'>('all');
  const [reasonInputs, setReasonInputs] = useState<Record<string, string>>({});

  React.useEffect(() => {
    if (availableCircles.length > 0 && !availableCircles.some(c => c.id === selectedCircleId)) {
      setSelectedCircleId(availableCircles[0].id);
    }
  }, [availableCircles, selectedCircleId, setSelectedCircleId]);

  const activeCircle = availableCircles.find(c => c.id === selectedCircleId) || availableCircles[0] || circles[0];
  const circleStudents = students.filter(s => s.circleId === activeCircle?.id && s.status === 'active');

  const isSelectedDateThursday = React.useMemo(() => {
    if (!selectedDate) return false;
    const d = new Date(`${selectedDate}T12:00:00`);
    return d.getDay() === 4;
  }, [selectedDate]);

  // Get or compute record for a student on selectedDate (including passive real-time derivation if not yet persisted)
  const getRecord = (studentId: string): Partial<AttendanceRecord> & { syncSource?: string } => {
    const existing = attendanceRecords.find(a => a.studentId === studentId && a.date === selectedDate);

    // If teacher manually deleted/cleared this day's attendance, do NOT auto-repopulate from recitation/challenges
    if (existing?.isManuallyCleared) {
      return {
        ...existing,
        studentId,
        circleId: activeCircle?.id || existing.circleId || '',
        date: selectedDate,
        status: 'unrecorded',
        earlyPrepCardSent: false,
        syncSource: ''
      };
    }

    const hasDailyRecitation = dailyRecords.some(
      r => r.studentId === studentId && r.date === selectedDate && (r.status === 'completed' || (r.recitationScore ?? 0) > 0)
    );
    const hasChallengeActivity = studentChallengeSubmissions.some(
      sub => sub.studentId === studentId && (
        (sub.evaluatedAt || sub.updatedAt || '').startsWith(selectedDate) ||
        (isSelectedDateThursday && ((sub.earlyPrepPointsEarned ?? 0) > 0 || !!sub.earlyAchievementCompleted || !!sub.peerReviewEvaluation?.jointRevisionCompleted))
      )
    );
    const hasChallengeEarlyBonus = studentChallengeSubmissions.some(
      sub => sub.studentId === studentId && (
        (sub.evaluatedAt || sub.updatedAt || '').startsWith(selectedDate) || isSelectedDateThursday
      ) && ((sub.earlyPrepPointsEarned ?? 0) > 0 || !!sub.earlyAchievementCompleted)
    );

    let syncSource = existing?.recordedBy || '';
    if (isSelectedDateThursday && hasChallengeActivity) {
      syncSource = 'تلقائي • تحديات الخميس 🏆';
    } else if (hasDailyRecitation) {
      syncSource = 'تلقائي • سجل التسميع 📖';
    } else if (existing?.earlyPrepCardSent) {
      syncSource = 'تلقائي • التحضير المبكر ⚡';
    }

    if (existing) {
      return {
        ...existing,
        status: existing.status === 'unrecorded' && (hasDailyRecitation || hasChallengeActivity) ? 'present' : existing.status,
        earlyPrepCardSent: !!existing.earlyPrepCardSent,
        syncSource: syncSource || existing.recordedBy || 'متزامن تلقائياً'
      };
    }

    if (hasDailyRecitation || hasChallengeActivity) {
      return {
        studentId,
        circleId: activeCircle?.id || '',
        date: selectedDate,
        status: 'present',
        earlyPrepCardSent: hasChallengeEarlyBonus,
        syncSource
      };
    }

    return {
      studentId,
      circleId: activeCircle?.id || '',
      date: selectedDate,
      status: 'unrecorded',
      earlyPrepCardSent: false,
      syncSource: ''
    };
  };

  const handleUpdateStatus = async (studentId: string, status: 'present' | 'absent_unexcused' | 'absent_excused') => {
    const rec = getRecord(studentId);
    await saveAttendance({
      ...rec,
      studentId,
      circleId: activeCircle?.id || rec.circleId || '',
      date: selectedDate,
      status,
      earlyPrepCardSent: status === 'present' ? !!rec.earlyPrepCardSent : false,
      isManuallyCleared: false,
      reason: status === 'absent_excused' ? (reasonInputs[studentId] || rec.reason || '') : undefined
    });
  };

  const handleToggleEarlyPrep = async (studentId: string) => {
    const rec = getRecord(studentId);
    const nextEarly = !rec.earlyPrepCardSent;
    const nextStatus = nextEarly
      ? 'present'
      : (rec.status && rec.status !== 'unrecorded' ? rec.status : 'present');
    await saveAttendance({
      ...rec,
      studentId,
      circleId: activeCircle?.id || rec.circleId || '',
      date: selectedDate,
      status: nextStatus,
      earlyPrepCardSent: nextEarly,
      isManuallyCleared: false
    });
    showToast?.(
      nextEarly
        ? 'تم تفعيل التحضير المبكر ⚡ وإضافته لرصيد الطالبة'
        : 'تم إلغاء التحضير المبكر لهذا اليوم وخصمه من العداد الشهري'
    );
  };

  const handleClearStudentAttendance = async (studentId: string, studentName: string) => {
    await clearStudentDayAttendance(studentId, selectedDate);
    setReasonInputs(prev => {
      const next = { ...prev };
      delete next[studentId];
      return next;
    });
    showToast?.(`تم مسح سجل الحضور والتحضير المبكر للطالبة «${studentName}» وتحديث الإحصائية فوراً 🗑️`);
  };

  const handleToggleWeeklyStar = async (studentId: string, studentName: string) => {
    await toggleAttendanceWeeklyStar(studentId, selectedDate);
    showToast?.(`تم تحديث نجمة الالتزام الأسبوعي 🌟 للطالبة «${studentName}» ومزامنتها مع ملف الإنجاز`);
  };

  const handleBulkPresent = async () => {
    const updates = circleStudents.map(st => {
      const rec = getRecord(st.id);
      return {
        ...rec,
        studentId: st.id,
        circleId: activeCircle?.id || st.circleId || '',
        date: selectedDate,
        status: 'present' as const,
        isManuallyCleared: false
      };
    });
    await saveBulkAttendance(updates);
  };

  const handleBulkEarlyPrep = async () => {
    const updates = circleStudents.map(st => {
      const rec = getRecord(st.id);
      return {
        ...rec,
        studentId: st.id,
        circleId: activeCircle?.id || st.circleId || '',
        date: selectedDate,
        status: 'present' as const,
        earlyPrepCardSent: true,
        isManuallyCleared: false
      };
    });
    await saveBulkAttendance(updates);
  };

  // Stats for the day in this circle
  const dayRecords = circleStudents.map(s => getRecord(s.id));
  const presentCount = dayRecords.filter(r => r.status === 'present').length;
  const unexcusedCount = dayRecords.filter(r => r.status === 'absent_unexcused').length;
  const excusedCount = dayRecords.filter(r => r.status === 'absent_excused').length;
  const earlyPrepCount = dayRecords.filter(r => r.earlyPrepCardSent).length;
  const absentTotalCount = unexcusedCount + excusedCount;
  const weeklyStarQualifiedCount = circleStudents.filter(s => allStudentScores[s.id]?.hasWeeklyStar).length;

  const filteredStudents = circleStudents.filter(st => {
    const rec = getRecord(st.id);
    if (statusFilter === 'present') return rec.status === 'present';
    if (statusFilter === 'early_prep') return !!rec.earlyPrepCardSent;
    if (statusFilter === 'absent') return rec.status === 'absent_unexcused' || rec.status === 'absent_excused';
    return true;
  });

  return (
    <div className="space-y-6">

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-[#E8DFD8] shadow-2xs">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xl">📋</span>
            <h2 className="text-xl font-bold text-stone-900 font-quran">لوحة متابعة الحضور والتحضير المبكر التلقائي</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
              مزامنة فورية بالخلفية ⚡
            </span>
          </div>
          <p className="text-xs text-stone-500">
            مرآة تلقائية تعرض الحضور والتحضير المبكر ونجمة الالتزام الأسبوعي 🌟 مع إمكانية التعديل اليدوي الفوري ومزامنة ملف الإنجاز والشهادة
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleBulkPresent}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#EBF3EE] hover:bg-[#DCEADA] text-[#2D5A43] rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>اعتماد حضور الجميع ✅</span>
          </button>
          <button
            onClick={handleBulkEarlyPrep}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#FAF6E8] hover:bg-[#F2ECD0] text-amber-900 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            <span>⚡ تحضير مبكر للجميع</span>
          </button>
        </div>
      </div>

      {/* Circle & Date Bar */}
      <div className="bg-white p-4 rounded-3xl border border-[#E8DFD8] shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          
          {/* Circle Selector */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">الحلقة:</label>
            <select
              value={selectedCircleId}
              onChange={e => setSelectedCircleId(e.target.value)}
              className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-[#8E5364]"
            >
              {availableCircles.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} — أ. {c.teacherName} (حتى {c.earlyPrepCutoffTime} مبكر)
                </option>
              ))}
            </select>
          </div>

          {/* Hijri Date Selector & Navigation (السابق / اليوم / التالي) */}
          <div>
            <HijriDateNavigationBar
              label="تاريخ الجلسة (تقويم أم القرى):"
              selectedDate={selectedDate}
              onChangeDate={setSelectedDate}
            />
          </div>

          {/* Automation Mode Indicator */}
          <div className="p-2.5 rounded-xl bg-[#FCFAF8] border border-[#EFE8E2] text-xs flex flex-col justify-center">
            <span className="font-bold text-stone-700 block">
              {isSelectedDateThursday ? '🏆 وضع يوم الخميس (تتويج متألقة الأسبوع 🌟):' : '📖 وضع أيام الأحد–الأربعاء (سجل التسميع والانضباط):'}
            </span>
            <span className="text-[11px] text-stone-500 block mt-0.5">
              {isSelectedDateThursday
                ? 'تُمنح شارة «🌟 متألقة الأسبوع» تلقائياً لمن لم تغب من الأحد للأربعاء (مع إمكانية التبديل اليدوي)'
                : `يُسجَّل الحضور تلقائياً عند التسميع أو ضغط «⚡ تحضير مبكر» (قبل ${activeCircle?.earlyPrepCutoffTime})`}
            </span>
          </div>

        </div>

        {/* Interactive Filter & Metrics Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-stone-100">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-[#8E5364] text-white shadow-2xs'
                  : 'bg-[#FAF6F2] text-stone-600 hover:bg-stone-200/70'
              }`}
            >
              الكل ({circleStudents.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('present')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                statusFilter === 'present'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60'
              }`}
            >
              الحاضرات ✅ ({presentCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('early_prep')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                statusFilter === 'early_prep'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200/60'
              }`}
            >
              ⚡ التحضير المبكر ({earlyPrepCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('absent')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                statusFilter === 'absent'
                  ? 'bg-rose-700 text-white shadow-2xs'
                  : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200/60'
              }`}
            >
              الغياب والأعذار ({absentTotalCount})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-stone-600">
            <span>حضور: <strong className="text-emerald-700">{presentCount}</strong></span>
            <span>•</span>
            <span>تحضير مبكر: <strong className="text-amber-700">{earlyPrepCount}</strong></span>
            <span>•</span>
            <span>متألقات الأسبوع 🌟: <strong className="text-amber-600">{weeklyStarQualifiedCount}</strong></span>
            <span>•</span>
            <span>غياب بعذر: <strong className="text-amber-600">{excusedCount}</strong></span>
            <span>•</span>
            <span>دون عذر: <strong className="text-rose-600">{unexcusedCount}</strong></span>
          </div>
        </div>
      </div>

      {/* Attendance Content: Mobile Cards View (sm/md screens) & Desktop Table View (lg screens) */}
      
      {/* Mobile Card Layout for Phones & Tablets */}
      <div className="block lg:hidden space-y-3">
        {filteredStudents.map((student, idx) => {
          const rec = getRecord(student.id);
          const score = allStudentScores[student.id];
          const hasWeeklyStar = score?.hasWeeklyStar ?? true;
          const weeklyAbsences = score?.weeklyAbsenceCount ?? 0;
          const hasActiveLog = rec.status !== 'unrecorded' || !!rec.earlyPrepCardSent;

          return (
            <div
              key={student.id}
              className="bg-white rounded-2xl border border-[#E8DFD8] p-4 shadow-2xs space-y-3"
            >
              {/* Header: Student Name, Code & Early Prep Button */}
              <div className="flex items-start justify-between gap-2 border-b border-stone-100 pb-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-stone-100 text-stone-500 text-[10px] flex items-center justify-center font-bold">
                      {idx + 1}
                    </span>
                    <h3 className="font-bold text-stone-900 text-sm">
                      <span className="privacy-student-name">{student.name}</span>
                    </h3>
                  </div>
                  <div className="text-[11px] text-stone-400 font-mono mt-0.5 mr-7">
                    كود: <span className="privacy-phone">{student.code}</span> • حضور: <strong className="text-[#2D5A43]"><span className="privacy-score-digit">{score?.attendanceRate ?? 100}</span>%</strong> • مبكر: <strong className="text-amber-700 privacy-score-digit">{score?.earlyPrepCount ?? 0}</strong>
                  </div>
                  {rec.syncSource && rec.status === 'present' && (
                    <div className="mt-1 mr-7">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70 text-[10px] font-bold">
                        {rec.syncSource}
                      </span>
                    </div>
                  )}
                </div>

                {/* Mobile Early Prep & Delete Buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleToggleEarlyPrep(student.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition active:scale-95 cursor-pointer touch-manipulation ${
                      rec.earlyPrepCardSent
                        ? 'bg-emerald-600 text-white border border-emerald-700 shadow-2xs'
                        : 'bg-stone-100 text-stone-500 border border-stone-300 hover:bg-stone-200'
                    }`}
                  >
                    <span>⚡ تحضير مبكر</span>
                    {rec.earlyPrepCardSent && <span>✓</span>}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleClearStudentAttendance(student.id, student.name)}
                    disabled={!hasActiveLog}
                    className={`p-2 rounded-xl transition border ${
                      hasActiveLog
                        ? 'text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 border-rose-200 cursor-pointer'
                        : 'text-stone-300 bg-stone-50 border-stone-200 cursor-not-allowed'
                    }`}
                    title="مسح وإعادة ضبط حضور وتحضير الطالبة لهذا اليوم"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Mobile Weekly Star Badge Row */}
              <div className="flex items-center justify-between bg-[#FCFAF7] px-3 py-2 rounded-xl border border-amber-200/70">
                <span className="text-[11px] font-bold text-stone-700">نجمة الالتزام الأسبوعي 🌟:</span>
                <button
                  type="button"
                  onClick={() => handleToggleWeeklyStar(student.id, student.name)}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
                    hasWeeklyStar
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-sm ring-2 ring-amber-300/50'
                      : 'bg-stone-100 text-stone-500 border border-stone-300 hover:bg-amber-50 hover:text-amber-800'
                  }`}
                >
                  {hasWeeklyStar ? (
                    <>
                      <span>🌟 متألقة الأسبوع</span>
                      <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded-full">✓</span>
                    </>
                  ) : (
                    <span>☆ منح نجمة الأسبوع ({weeklyAbsences} غياب)</span>
                  )}
                </button>
              </div>

              {/* Status Action Buttons (Touch-friendly 44px min height) */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleUpdateStatus(student.id, 'present')}
                  className={`py-2.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 active:scale-95 cursor-pointer touch-manipulation border ${
                    rec.status === 'present'
                      ? 'bg-[#2D5A43] text-white border-[#2D5A43] shadow-xs'
                      : 'bg-[#FAF6F2] hover:bg-[#EFEAE5] text-stone-700 border-stone-200'
                  }`}
                >
                  <span>✅</span>
                  <span>حاضرة</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleUpdateStatus(student.id, 'absent_excused')}
                  className={`py-2.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 active:scale-95 cursor-pointer touch-manipulation border ${
                    rec.status === 'absent_excused'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-[#FAF6F2] hover:bg-[#EFEAE5] text-stone-700 border-stone-200'
                  }`}
                >
                  <span>⭕️</span>
                  <span>بعذر</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleUpdateStatus(student.id, 'absent_unexcused')}
                  className={`py-2.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 active:scale-95 cursor-pointer touch-manipulation border ${
                    rec.status === 'absent_unexcused'
                      ? 'bg-rose-700 text-white border-rose-700 shadow-xs'
                      : 'bg-[#FAF6F2] hover:bg-[#EFEAE5] text-stone-700 border-stone-200'
                  }`}
                >
                  <span>❌</span>
                  <span>بدون عذر</span>
                </button>
              </div>

              {/* Excused Reason Input on Mobile */}
              {rec.status === 'absent_excused' && (
                <div className="pt-1">
                  <input
                    type="text"
                    placeholder="اكتبي سبب العذر هنا..."
                    value={reasonInputs[student.id] !== undefined ? reasonInputs[student.id] : (rec.reason || '')}
                    onChange={e => setReasonInputs({ ...reasonInputs, [student.id]: e.target.value })}
                    onBlur={() => handleUpdateStatus(student.id, 'absent_excused')}
                    className="w-full px-3 py-2 text-xs border border-amber-300 rounded-xl bg-amber-50/50 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block bg-white rounded-3xl border border-[#E8DFD8] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-[#FAF6F2] text-stone-600 font-bold border-b border-stone-200">
                <th className="p-3.5">#</th>
                <th className="p-3.5">اسم الطالبة</th>
                <th className="p-3.5 text-center">التحضير المبكر ⚡</th>
                <th className="p-3.5 text-center">نجمة الالتزام 🌟</th>
                <th className="p-3.5 text-center">حالة الحضور</th>
                <th className="p-3.5">مصدر المزامنة التلقائية</th>
                <th className="p-3.5">سبب الغياب (إن وُجد)</th>
                <th className="p-3.5">الإحصائية التراكمية</th>
                <th className="p-3.5 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredStudents.map((student, idx) => {
                const rec = getRecord(student.id);
                const score = allStudentScores[student.id];
                const hasWeeklyStar = score?.hasWeeklyStar ?? true;
                const weeklyAbsences = score?.weeklyAbsenceCount ?? 0;
                const hasActiveLog = rec.status !== 'unrecorded' || !!rec.earlyPrepCardSent;

                return (
                  <tr key={student.id} className="hover:bg-[#FCF9FA] transition">
                    <td className="p-3.5 font-semibold text-stone-400">{idx + 1}</td>

                    <td className="p-3.5">
                      <div className="font-bold text-stone-900 text-sm">
                        <span className="privacy-student-name">{student.name}</span>
                      </div>
                      <div className="text-[11px] text-stone-400 font-mono">
                        <span className="privacy-phone">{student.code}</span>
                      </div>
                    </td>

                    {/* Early Prep 2-Way Toggle */}
                    <td className="p-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleEarlyPrep(student.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition active:scale-95 cursor-pointer touch-manipulation ${
                          rec.earlyPrepCardSent
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 shadow-2xs ring-2 ring-emerald-400/25'
                            : 'bg-stone-100 hover:bg-stone-200 text-stone-500 border border-stone-300'
                        }`}
                        title={rec.earlyPrepCardSent ? 'انقري لإلغاء التحضير المبكر وخصمه من العداد الشهري' : 'انقري لتفعيل التحضير المبكر وإضافته للعداد الشهري'}
                      >
                        <span>⚡ تحضير مبكر</span>
                        {rec.earlyPrepCardSent && <span>✓</span>}
                      </button>
                    </td>

                    {/* Weekly Commitment Star Column (نجمة الالتزام 🌟) */}
                    <td className="p-3.5 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleToggleWeeklyStar(student.id, student.name)}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition active:scale-95 cursor-pointer touch-manipulation ${
                            hasWeeklyStar
                              ? isSelectedDateThursday
                                ? 'bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 text-white border border-amber-400 shadow-md ring-2 ring-amber-300/60'
                                : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs'
                              : 'bg-stone-100 hover:bg-amber-50 text-stone-400 hover:text-amber-800 border border-stone-200'
                          }`}
                          title="تُحتسب تلقائياً عند عدم وجود غياب من الأحد للأربعاء — انقري لمنحها أو إلغائها يدوياً"
                        >
                          {hasWeeklyStar ? (
                            <>
                              <span>🌟 متألقة الأسبوع</span>
                              {isSelectedDateThursday && <span className="text-[10px] bg-white/25 px-1.5 py-0.2 rounded-full">تتويج</span>}
                            </>
                          ) : (
                            <span>☆ غير مستحقة ({weeklyAbsences} غياب)</span>
                          )}
                        </button>
                        <span className="text-[10px] text-stone-400">
                          {hasWeeklyStar
                            ? '0 غياب (الأحد–الأربعاء)'
                            : `انقري للمنح الاستثنائي`}
                        </span>
                      </div>
                    </td>

                    {/* Attendance Status Buttons */}
                    <td className="p-3.5 text-center">
                      <div className="inline-flex items-center gap-1.5 bg-[#FAF6F2] p-1 rounded-xl border border-[#EFE8E2]">
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(student.id, 'present')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 active:scale-95 cursor-pointer touch-manipulation ${
                            rec.status === 'present'
                              ? 'bg-[#2D5A43] text-white shadow-2xs'
                              : 'text-stone-600 hover:text-stone-900'
                          }`}
                        >
                          <span>✅ حاضرة</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(student.id, 'absent_unexcused')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 active:scale-95 cursor-pointer touch-manipulation ${
                            rec.status === 'absent_unexcused'
                              ? 'bg-rose-700 text-white shadow-2xs'
                              : 'text-stone-600 hover:text-rose-700'
                          }`}
                        >
                          <span>❌ بدون عذر</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(student.id, 'absent_excused')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 active:scale-95 cursor-pointer touch-manipulation ${
                            rec.status === 'absent_excused'
                              ? 'bg-amber-600 text-white shadow-2xs'
                              : 'text-stone-600 hover:text-amber-700'
                          }`}
                        >
                          <span>⭕️ بعذر</span>
                        </button>
                      </div>
                    </td>

                    {/* Sync Source & Time */}
                    <td className="p-3.5">
                      {rec.status === 'present' ? (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/70 text-[11px] font-bold">
                            {rec.syncSource || 'سجل التسميع / الحضور'}
                          </span>
                          {rec.recordedAt && (
                            <div className="text-[10px] text-stone-400">
                              {formatHijriDateTime(rec.recordedAt)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-stone-300 text-[11px]">لم يُسجل حضور بعد</span>
                      )}
                    </td>

                    {/* Reason input for excused absence */}
                    <td className="p-3.5">
                      {rec.status === 'absent_excused' ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            placeholder="اكتبي سبب العذر..."
                            value={reasonInputs[student.id] !== undefined ? reasonInputs[student.id] : (rec.reason || '')}
                            onChange={e => setReasonInputs({ ...reasonInputs, [student.id]: e.target.value })}
                            onBlur={() => handleUpdateStatus(student.id, 'absent_excused')}
                            className="px-2.5 py-1 text-xs border border-amber-300 rounded-lg w-full bg-amber-50/50"
                          />
                        </div>
                      ) : (
                        <span className="text-stone-300 text-[11px]">—</span>
                      )}
                    </td>

                    {/* Cumulative Monthly Stats */}
                    <td className="p-3.5">
                      <div className="font-semibold text-stone-800">
                        حضور: <span className="text-[#2D5A43] font-bold privacy-score-digit">{score?.attendanceRate ?? 100}%</span>
                      </div>
                      <div className="text-[10px] text-stone-500">
                        غياب: <span className="privacy-score-digit font-bold text-rose-700">{(score?.absentUnexcusedCount ?? 0) + (score?.absentExcusedCount ?? 0)}</span> ({score?.absentUnexcusedCount ?? 0} دون عذر) | مبكر: <span className="privacy-score-digit font-bold text-emerald-700">{score?.earlyPrepCount ?? 0}</span>
                      </div>
                      <div className="text-[10px] text-amber-700 font-bold mt-0.5">
                        نجوم الشهر: 🌟 <span className="privacy-score-digit">{score?.weeklyStarsCount ?? 4}</span>/4
                      </div>
                    </td>

                    {/* Actions: Reset/Delete Day Attendance */}
                    <td className="p-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleClearStudentAttendance(student.id, student.name)}
                        disabled={!hasActiveLog}
                        className={`p-2 rounded-xl transition inline-flex items-center justify-center border ${
                          hasActiveLog
                            ? 'text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 border-rose-200 shadow-2xs cursor-pointer'
                            : 'text-stone-300 bg-stone-50 border-stone-100 cursor-not-allowed'
                        }`}
                        title="حذف وإعادة ضبط حالة الحضور والتحضير المبكر لهذا اليوم"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
