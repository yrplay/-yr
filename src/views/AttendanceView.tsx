import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  CheckSquare, Calendar, Users, Clock, CheckCircle2, XCircle,
  AlertCircle, Star, Sparkles, Filter, Save, ChevronLeft, ChevronRight
} from 'lucide-react';
import { AttendanceRecord } from '../types';

export const AttendanceView: React.FC = () => {
  const {
    students, circles, attendanceRecords, saveAttendance, saveBulkAttendance,
    currentUser, allStudentScores
  } = useApp();

  const [selectedCircleId, setSelectedCircleId] = useState<string>(circles[0]?.id || 'c-1');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [reasonInputs, setReasonInputs] = useState<Record<string, string>>({});

  const activeCircle = circles.find(c => c.id === selectedCircleId) || circles[0];
  const circleStudents = students.filter(s => s.circleId === activeCircle?.id && s.status === 'active');

  // Get or compute record for a student on selectedDate
  const getRecord = (studentId: string): Partial<AttendanceRecord> => {
    const existing = attendanceRecords.find(a => a.studentId === studentId && a.date === selectedDate);
    return existing || {
      studentId,
      circleId: activeCircle.id,
      date: selectedDate,
      status: 'unrecorded',
      earlyPrepCardSent: false
    };
  };

  const handleUpdateStatus = async (studentId: string, status: 'present' | 'absent_unexcused' | 'absent_excused') => {
    const rec = getRecord(studentId);
    await saveAttendance({
      ...rec,
      studentId,
      circleId: activeCircle.id,
      date: selectedDate,
      status,
      reason: status === 'absent_excused' ? (reasonInputs[studentId] || rec.reason || '') : undefined
    });
  };

  const handleToggleEarlyPrep = async (studentId: string) => {
    const rec = getRecord(studentId);
    await saveAttendance({
      ...rec,
      studentId,
      circleId: activeCircle.id,
      date: selectedDate,
      earlyPrepCardSent: !rec.earlyPrepCardSent
    });
  };

  const handleBulkPresent = async () => {
    const updates = circleStudents.map(st => {
      const rec = getRecord(st.id);
      return {
        ...rec,
        studentId: st.id,
        circleId: activeCircle.id,
        date: selectedDate,
        status: 'present' as const
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
        circleId: activeCircle.id,
        date: selectedDate,
        earlyPrepCardSent: true
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

  return (
    <div className="space-y-6">

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-[#E8DFD8] shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">📋</span>
            <h2 className="text-xl font-bold text-stone-900 font-quran">سجل الحضور والتحضير المبكر</h2>
          </div>
          <p className="text-xs text-stone-500">
            رصد حضور جلسات التحفيظ، وتوثيق بطاقات التحضير المبكر ⭐ وأسباب الغياب
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleBulkPresent}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#EBF3EE] hover:bg-[#DCEADA] text-[#2D5A43] rounded-xl text-xs font-bold transition"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>رصد الجميع حضور ✅</span>
          </button>
          <button
            onClick={handleBulkEarlyPrep}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#FAF6E8] hover:bg-[#F2ECD0] text-amber-900 rounded-xl text-xs font-bold transition"
          >
            <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            <span>رصد التحضير المبكر للكل ⭐</span>
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
              {circles.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} — أ. {c.teacherName} (حتى {c.earlyPrepCutoffTime} مبكر)
                </option>
              ))}
            </select>
          </div>

          {/* Date Selector */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">تاريخ الجلسة:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-[#8E5364]"
            />
          </div>

          {/* Circle Timing Rules */}
          <div className="p-2.5 rounded-xl bg-[#FCFAF8] border border-[#EFE8E2] text-xs">
            <span className="font-bold text-stone-700 block">ضوابط وقت الحلقة:</span>
            <span className="text-[11px] text-stone-500 block">
              الوقت: {activeCircle?.startTime} - {activeCircle?.endTime} • حد التحضير المبكر: <strong>{activeCircle?.earlyPrepCutoffTime}</strong>
            </span>
          </div>

        </div>

        {/* Day Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-stone-100 text-xs">
          <div className="flex items-center gap-2 text-stone-700">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span>حضور اليوم: <strong>{presentCount}</strong> طالبة</span>
          </div>
          <div className="flex items-center gap-2 text-stone-700">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            <span>غياب دون عذر: <strong>{unexcusedCount}</strong></span>
          </div>
          <div className="flex items-center gap-2 text-stone-700">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <span>غياب بعذر: <strong>{excusedCount}</strong></span>
          </div>
          <div className="flex items-center gap-2 text-stone-700">
            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            <span>بطاقات مبكرة: <strong>{earlyPrepCount}</strong></span>
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-3xl border border-[#E8DFD8] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-[#FAF6F2] text-stone-600 font-bold border-b border-stone-200">
                <th className="p-3.5">#</th>
                <th className="p-3.5">اسم الطالبة</th>
                <th className="p-3.5 text-center">التحضير المبكر ⭐</th>
                <th className="p-3.5 text-center">حالة الحضور</th>
                <th className="p-3.5">سبب الغياب (إن وُجد)</th>
                <th className="p-3.5">إحصائية الشهر</th>
                <th className="p-3.5">المسؤول ووقت الرصد</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {circleStudents.map((student, idx) => {
                const rec = getRecord(student.id);
                const score = allStudentScores[student.id];

                return (
                  <tr key={student.id} className="hover:bg-[#FCF9FA] transition">
                    <td className="p-3.5 font-semibold text-stone-400">{idx + 1}</td>

                    <td className="p-3.5">
                      <div className="font-bold text-stone-900 text-sm">{student.name}</div>
                      <div className="text-[11px] text-stone-400 font-mono">{student.code}</div>
                    </td>

                    {/* Early Prep Toggle */}
                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => handleToggleEarlyPrep(student.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition ${
                          rec.earlyPrepCardSent
                            ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs'
                            : 'bg-stone-100 hover:bg-stone-200 text-stone-400'
                        }`}
                        title="أرسلت الطالبة بطاقة التحضير المبكر ضمن الوقت المحدد"
                      >
                        <Star className={`w-3.5 h-3.5 ${rec.earlyPrepCardSent ? 'text-amber-600 fill-amber-500' : ''}`} />
                        <span>{rec.earlyPrepCardSent ? 'مبكر ⭐' : 'لم ترسل'}</span>
                      </button>
                    </td>

                    {/* Attendance Status Buttons */}
                    <td className="p-3.5 text-center">
                      <div className="inline-flex items-center gap-1.5 bg-[#FAF6F2] p-1 rounded-xl border border-[#EFE8E2]">
                        <button
                          onClick={() => handleUpdateStatus(student.id, 'present')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                            rec.status === 'present'
                              ? 'bg-[#2D5A43] text-white shadow-2xs'
                              : 'text-stone-600 hover:text-stone-900'
                          }`}
                        >
                          <span>✅ حضور</span>
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(student.id, 'absent_unexcused')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                            rec.status === 'absent_unexcused'
                              ? 'bg-rose-700 text-white shadow-2xs'
                              : 'text-stone-600 hover:text-rose-700'
                          }`}
                        >
                          <span>❌ بدون عذر</span>
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(student.id, 'absent_excused')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                            rec.status === 'absent_excused'
                              ? 'bg-amber-600 text-white shadow-2xs'
                              : 'text-stone-600 hover:text-amber-700'
                          }`}
                        >
                          <span>⭕️ بعذر</span>
                        </button>
                      </div>
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
                        حضور: <span className="text-[#2D5A43] font-bold">{score?.attendanceRate}%</span>
                      </div>
                      <div className="text-[10px] text-stone-500">
                        غياب: {score?.absentUnexcusedCount} دون عذر | مبكر: {score?.earlyPrepCount}
                      </div>
                    </td>

                    {/* Recorder & Time */}
                    <td className="p-3.5 text-stone-500 text-[11px]">
                      <div>{rec.recordedBy || 'المعلمة'}</div>
                      <div className="text-[10px] text-stone-400">
                        {rec.recordedAt ? new Date(rec.recordedAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </div>
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
