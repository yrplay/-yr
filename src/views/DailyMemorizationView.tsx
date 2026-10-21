import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  BookOpen, Calendar, CheckCircle2, AlertCircle, Sparkles,
  Award, Edit, Save, Plus, ChevronLeft, Sliders, Check,
  Users, UserCheck, Shuffle, X, ArrowRightLeft
} from 'lucide-react';
import { DailyRecord, Student } from '../types';

export const DailyMemorizationView: React.FC = () => {
  const {
    students, circles, dailyRecords, saveDailyRecord,
    gradingConfigs, allStudentScores, currentUser, assignPartner, showToast
  } = useApp();

  const [selectedCircleId, setSelectedCircleId] = useState<string>(circles[0]?.id || 'c-1');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState<'roster' | 'peers'>('roster');

  // Drawer / Modal for evaluating recitation
  const [evalModalOpen, setEvalModalOpen] = useState(false);
  const [selectedStudentForEval, setSelectedStudentForEval] = useState<any>(null);

  const activeCircle = circles.find(c => c.id === selectedCircleId) || circles[0];
  const circleStudents = students.filter(s => s.circleId === activeCircle?.id && s.status === 'active');
  const gradingConfig = gradingConfigs.find(g => g.trackId === activeCircle?.trackId) || gradingConfigs[0];
  const formula = gradingConfig?.recitationFormula || {
    baseGrade: 10,
    deductionPerMistake: 0.5,
    deductionPerHint: 0.25,
    deductionPerTajweedError: 0.25,
    maxDeduction: 10,
    minGrade: 0
  };

  // Evaluation Form State
  const [evalForm, setEvalForm] = useState<{
    requiredPortionText: string;
    newMemorizationCompleted: boolean;
    newMemorizationPages: number;
    revisionCompleted: boolean;
    revisionPages: number;
    memorizationMistakes: number;
    hintsCount: number;
    tajweedErrorsCount: number;
    conditions: {
      listenedToReader: boolean;
      recitedLooking: boolean;
      masteryRepetition: boolean;
      minorRevision: boolean;
      tamkeenRevision: boolean;
      achievedDistinction: boolean;
    };
    status: 'completed' | 'partial' | 'incomplete' | 'unrecorded';
    notes: string;
  }>({
    requiredPortionText: 'مقرر الخطة اليومي',
    newMemorizationCompleted: true,
    newMemorizationPages: 1,
    revisionCompleted: true,
    revisionPages: 2,
    memorizationMistakes: 0,
    hintsCount: 0,
    tajweedErrorsCount: 0,
    conditions: {
      listenedToReader: true,
      recitedLooking: true,
      masteryRepetition: true,
      minorRevision: true,
      tamkeenRevision: true,
      achievedDistinction: true
    },
    status: 'completed',
    notes: ''
  });

  // Calculate live recitation grade
  const calculateScore = (mistakes: number, hints: number, tajweed: number) => {
    const totalDeduction = Math.min(
      formula.maxDeduction,
      (mistakes * formula.deductionPerMistake) +
      (hints * formula.deductionPerHint) +
      (tajweed * formula.deductionPerTajweedError)
    );
    const finalScore = Math.max(formula.minGrade, formula.baseGrade - totalDeduction);
    return Number(finalScore.toFixed(2));
  };

  const getDailyRecord = (studentId: string): DailyRecord | undefined => {
    return dailyRecords.find(d => d.studentId === studentId && d.date === selectedDate);
  };

  const handleOpenEvalModal = (student: any) => {
    setSelectedStudentForEval(student);
    const existing = getDailyRecord(student.id);
    if (existing) {
      setEvalForm({
        requiredPortionText: existing.requiredPortionText,
        newMemorizationCompleted: existing.newMemorizationCompleted,
        newMemorizationPages: existing.newMemorizationPages,
        revisionCompleted: existing.revisionCompleted,
        revisionPages: existing.revisionPages,
        memorizationMistakes: existing.memorizationMistakes,
        hintsCount: existing.hintsCount,
        tajweedErrorsCount: existing.tajweedErrorsCount,
        conditions: { ...existing.conditions },
        status: existing.status,
        notes: existing.notes || ''
      });
    } else {
      setEvalForm({
        requiredPortionText: 'مقرر الخطة اليومي',
        newMemorizationCompleted: true,
        newMemorizationPages: 1,
        revisionCompleted: true,
        revisionPages: 2,
        memorizationMistakes: 0,
        hintsCount: 0,
        tajweedErrorsCount: 0,
        conditions: {
          listenedToReader: true,
          recitedLooking: true,
          masteryRepetition: true,
          minorRevision: true,
          tamkeenRevision: true,
          achievedDistinction: true
        },
        status: 'completed',
        notes: ''
      });
    }
    setEvalModalOpen(true);
  };

  const handleSaveEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentForEval || !activeCircle) return;
    const existing = getDailyRecord(selectedStudentForEval.id);
    const computedScore = calculateScore(
      evalForm.memorizationMistakes,
      evalForm.hintsCount,
      evalForm.tajweedErrorsCount
    );

    await saveDailyRecord({
      id: existing?.id,
      studentId: selectedStudentForEval.id,
      circleId: activeCircle.id,
      date: selectedDate,
      dayName: new Date(selectedDate).toLocaleDateString('ar-SA', { weekday: 'long' }),
      requiredPortionText: evalForm.requiredPortionText,
      newMemorizationCompleted: evalForm.newMemorizationCompleted,
      newMemorizationPages: Number(evalForm.newMemorizationPages),
      revisionCompleted: evalForm.revisionCompleted,
      revisionPages: Number(evalForm.revisionPages),
      memorizationMistakes: Number(evalForm.memorizationMistakes),
      hintsCount: Number(evalForm.hintsCount),
      tajweedErrorsCount: Number(evalForm.tajweedErrorsCount),
      recitationScore: computedScore,
      conditions: evalForm.conditions,
      status: evalForm.status,
      notes: evalForm.notes
    });

    setEvalModalOpen(false);
  };

  // Direct partner change handler
  const handlePartnerChange = async (studentId: string, partnerId: string) => {
    if (partnerId === 'none') {
      await assignPartner(studentId, null);
    } else if (partnerId && partnerId !== studentId) {
      await assignPartner(studentId, partnerId);
    }
  };

  // Automatic smart pairing for unpaired students
  const handleAutoPairUnpaired = async () => {
    const unpaired = circleStudents.filter(s => !s.partnerStudentId);
    if (unpaired.length < 2) {
      showToast('لا يوجد عدد كافٍ من الطالبات غير المقترنات للتوزيع التلقائي', 'info');
      return;
    }

    let pairsCount = 0;
    for (let i = 0; i < unpaired.length - 1; i += 2) {
      const s1 = unpaired[i];
      const s2 = unpaired[i + 1];
      await assignPartner(s1.id, s2.id);
      pairsCount++;
    }
    showToast(`تم توزيع ${pairsCount} ثنائيات تلقائياً بنجاح 👯‍♀️`);
  };

  // Group circle students into unique pairs for the peer matrix tab
  const pairedIds = new Set<string>();
  const peerPairs: { s1: Student; s2: Student | null }[] = [];

  circleStudents.forEach(st => {
    if (pairedIds.has(st.id)) return;
    if (st.partnerStudentId) {
      const partner = circleStudents.find(p => p.id === st.partnerStudentId);
      if (partner) {
        pairedIds.add(st.id);
        pairedIds.add(partner.id);
        peerPairs.push({ s1: st, s2: partner });
        return;
      }
    }
    // Student without partner
    pairedIds.add(st.id);
    peerPairs.push({ s1: st, s2: null });
  });

  return (
    <div className="space-y-6">

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-[#E8DFD8] shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">📖</span>
            <h2 className="text-xl font-bold text-stone-900 font-quran">مصفوفة المراجعة والحفظ وتعيين الثنائيات</h2>
          </div>
          <p className="text-xs text-stone-500">
            رصد التسميع اليومي، تعيين وتعديل الرفيقة (الثنائي) مباشرة لكل طالبة، واحتساب الخصومات فوراً
          </p>
        </div>

        {/* Recitation formula badge */}
        <div className="flex items-center gap-2 p-2.5 bg-[#FAF6F2] rounded-2xl border border-[#EFE8E2] text-[11px] text-stone-600">
          <span className="font-bold text-[#8E5364]">معادلة التسميع:</span>
          <span>الأساس: <strong>{formula.baseGrade}</strong> | خطأ: <strong>-{formula.deductionPerMistake}</strong> | تنبيه: <strong>-{formula.deductionPerHint}</strong> | تجويد: <strong>-{formula.deductionPerTajweedError}</strong></span>
        </div>
      </div>

      {/* Circle & Date Bar & Tab Switcher */}
      <div className="bg-white p-4 rounded-3xl border border-[#E8DFD8] shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[11px] font-bold text-stone-600 mb-0.5">الحلقة:</label>
            <select
              value={selectedCircleId}
              onChange={e => setSelectedCircleId(e.target.value)}
              className="px-3 py-1.5 border border-stone-200 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-[#8E5364] cursor-pointer"
            >
              {circles.map(c => (
                <option key={c.id} value={c.id}>{c.name} — أ. {c.teacherName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-stone-600 mb-0.5">تاريخ التسميع:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 border border-stone-200 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-[#8E5364]"
            />
          </div>
        </div>

        {/* Tab Switcher & Quick Actions */}
        <div className="flex items-center gap-2">
          <div className="bg-[#FAF6F2] p-1 rounded-2xl border border-[#EFE8E2] flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('roster')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'roster'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              سجل التسميع والحفظ
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('peers')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                activeTab === 'peers'
                  ? 'bg-[#8E5364] text-white shadow-2xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <span>مصفوفة الثنائيات والرفيقات</span>
              <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded-full font-mono">
                {peerPairs.filter(p => p.s2 !== null).length}
              </span>
            </button>
          </div>

          {activeTab === 'peers' && (
            <button
              type="button"
              onClick={handleAutoPairUnpaired}
              className="px-3 py-2 bg-[#EBF3EE] hover:bg-[#DCEADA] text-[#2D5A43] border border-[#CDE0D4] rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="توزيع الطالبات غير المرتبطات تلقائياً"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>توزيع الثنائيات تلقائياً</span>
            </button>
          )}
        </div>
      </div>

      {/* VIEW 1: Daily Records Table with Inline Partner Dropdown */}
      {activeTab === 'roster' && (
        <div className="bg-white rounded-3xl border border-[#E8DFD8] shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-[#FAF6F2] text-stone-600 font-bold border-b border-stone-200">
                  <th className="p-3.5">#</th>
                  <th className="p-3.5">اسم الطالبة</th>
                  <th className="p-3.5">الرفيقة (الثنائي) 👯‍♀️</th>
                  <th className="p-3.5">المقرر المسموع</th>
                  <th className="p-3.5">الحفظ والمراجعة</th>
                  <th className="p-3.5">الأخطاء والتنبيهات</th>
                  <th className="p-3.5">درجة التسميع</th>
                  <th className="p-3.5">شروط الحفظ المتقن</th>
                  <th className="p-3.5">حالة الإنجاز</th>
                  <th className="p-3.5 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {circleStudents.map((student, idx) => {
                  const rec = getDailyRecord(student.id);
                  const partner = circleStudents.find(p => p.id === student.partnerStudentId);

                  return (
                    <tr key={student.id} className="hover:bg-[#FCF9FA] transition">
                      <td className="p-3.5 font-semibold text-stone-400">{idx + 1}</td>

                      <td className="p-3.5">
                        <div className="font-bold text-stone-900 text-sm">{student.name}</div>
                        <div className="text-[11px] text-stone-400">كود: {student.code}</div>
                      </td>

                      {/* Direct Inline Partner Selector / Modifier */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5">
                          <select
                            value={student.partnerStudentId || 'none'}
                            onChange={e => handlePartnerChange(student.id, e.target.value)}
                            className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition cursor-pointer max-w-[150px] truncate ${
                              partner
                                ? 'bg-[#FAF0F3] text-[#8E5364] border-[#E8D5D8] focus:ring-2 focus:ring-[#8E5364]'
                                : 'bg-stone-50 text-stone-500 border-dashed border-stone-300 hover:bg-stone-100'
                            }`}
                          >
                            <option value="none">بدون رفيقة ⭕</option>
                            {circleStudents
                              .filter(other => other.id !== student.id)
                              .map(other => (
                                <option key={other.id} value={other.id}>
                                  {other.name} {other.partnerStudentId && other.partnerStudentId !== student.id ? '(مقترنة)' : ''}
                                </option>
                              ))}
                          </select>

                          {partner && (
                            <button
                              type="button"
                              onClick={() => assignPartner(student.id, null)}
                              className="text-stone-300 hover:text-rose-600 transition p-1"
                              title="إلغاء اقتران الرفيقة"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="p-3.5">
                        <span className="font-medium text-stone-700">
                          {rec?.requiredPortionText || 'مقرر الخطة اليومي'}
                        </span>
                      </td>

                      <td className="p-3.5">
                        {rec ? (
                          <div className="space-y-0.5">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${rec.newMemorizationCompleted ? 'text-emerald-700' : 'text-stone-400'}`}>
                              {rec.newMemorizationCompleted ? '✅ حفظ جديد' : '⭕️ لم يُسمع'} ({rec.newMemorizationPages} ص)
                            </span>
                            <span className="block text-[11px] text-stone-500">
                              مراجعة: {rec.revisionCompleted ? `✅ (${rec.revisionPages} ص)` : '⭕️ لم تتم'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-stone-300 text-[11px]">لم يُرصد اليوم</span>
                        )}
                      </td>

                      <td className="p-3.5">
                        {rec ? (
                          <div className="text-[11px] space-y-0.5">
                            <span className="text-rose-700 font-medium block">
                              أخطاء: {rec.memorizationMistakes} • تنبيهات: {rec.hintsCount}
                            </span>
                            <span className="text-amber-700 font-medium block">
                              تجويد: {rec.tajweedErrorsCount}
                            </span>
                          </div>
                        ) : (
                          <span className="text-stone-300 text-[11px]">—</span>
                        )}
                      </td>

                      <td className="p-3.5">
                        {rec ? (
                          <div className="font-extrabold text-sm text-[#8E5364]">
                            {rec.recitationScore} <span className="text-[10px] text-stone-400">/ {formula.baseGrade}</span>
                          </div>
                        ) : (
                          <span className="text-stone-300 text-[11px]">—</span>
                        )}
                      </td>

                      <td className="p-3.5">
                        {rec ? (
                          <div className="text-[11px] space-y-0.5 text-stone-600">
                            <span>{rec.conditions.masteryRepetition ? 'تكرار متقن ✅' : 'لم تكرر'}</span>
                            <span className="block text-stone-400">
                              {rec.conditions.tamkeenRevision ? 'تمكين ✅' : '—'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-stone-300 text-[11px]">—</span>
                        )}
                      </td>

                      <td className="p-3.5">
                        {rec ? (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            rec.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : rec.status === 'partial'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}>
                            {rec.status === 'completed' ? 'مكتمل' : rec.status === 'partial' ? 'جزئي' : 'لم يكتمل'}
                          </span>
                        ) : (
                          <span className="text-stone-300 text-[11px]">بانتظار التسميع</span>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => handleOpenEvalModal(student)}
                          className="px-3.5 py-1.5 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
                        >
                          {rec ? 'تعديل التسميع' : 'رصد التسميع'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: Peer Review & Duo Matrix Cards */}
      {activeTab === 'peers' && (
        <div className="space-y-4">
          <div className="bg-[#FAF7F4] p-4 rounded-3xl border border-[#EFE8E2] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-lg">👯‍♀️</span>
              <div>
                <strong className="text-stone-900 block font-bold">مصفوفة الثنائيات والرفيقات في حلقة {activeCircle?.name}:</strong>
                <span className="text-stone-500 text-[11px]">
                  تعديل واختيار الرفيقة بضغطة زر واحدة. تتزامن الرفيقتان تلقائياً في التحديات والتقارير الشهرية.
                </span>
              </div>
            </div>
            <span className="text-stone-600 font-bold bg-white px-3 py-1.5 rounded-xl border border-stone-200 shadow-2xs">
              إجمالي الطالبات: {circleStudents.length} • المقترنات: {circleStudents.filter(s => s.partnerStudentId).length}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {peerPairs.map((pair, idx) => {
              const rec1 = getDailyRecord(pair.s1.id);
              const rec2 = pair.s2 ? getDailyRecord(pair.s2.id) : null;

              return (
                <div
                  key={pair.s1.id}
                  className={`p-5 rounded-3xl border transition shadow-2xs space-y-4 ${
                    pair.s2
                      ? 'bg-white border-[#E8DFD8] hover:border-[#D4C4BC]'
                      : 'bg-[#FCFAF8] border-dashed border-stone-300'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                    <span className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
                      <span>الثنائي #{idx + 1}</span>
                      {pair.s2 ? (
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                          ثنائي مكتمل ✅
                        </span>
                      ) : (
                        <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-bold">
                          طالبة بانتظار رفيقة ⚠️
                        </span>
                      )}
                    </span>

                    {pair.s2 && (
                      <button
                        type="button"
                        onClick={() => assignPartner(pair.s1.id, null)}
                        className="text-xs text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer font-semibold"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>إلغاء الثنائي</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                    
                    {/* Student 1 */}
                    <div className="p-3 bg-[#FAF7F4] rounded-2xl border border-stone-200 space-y-1 text-xs">
                      <div className="font-bold text-stone-900">{pair.s1.name}</div>
                      <div className="text-[10px] text-stone-400 font-mono">كود: {pair.s1.code}</div>
                      <div className="pt-1 flex items-center justify-between text-[11px]">
                        <span className="text-stone-500">التسميع اليوم:</span>
                        <span className={rec1 ? 'text-emerald-700 font-bold' : 'text-stone-400'}>
                          {rec1 ? `${rec1.recitationScore} / 10 ✅` : 'لم يُرصد'}
                        </span>
                      </div>
                    </div>

                    {/* Connector Icon / Switcher */}
                    {pair.s2 ? (
                      <div className="p-3 bg-[#FAF0F3] rounded-2xl border border-[#E8D5D8] space-y-1 text-xs">
                        <div className="font-bold text-[#8E5364]">{pair.s2.name}</div>
                        <div className="text-[10px] text-stone-400 font-mono">كود: {pair.s2.code}</div>
                        <div className="pt-1 flex items-center justify-between text-[11px]">
                          <span className="text-stone-500">التسميع اليوم:</span>
                          <span className={rec2 ? 'text-emerald-700 font-bold' : 'text-stone-400'}>
                            {rec2 ? `${rec2.recitationScore} / 10 ✅` : 'لم يُرصد'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-white rounded-2xl border border-dashed border-stone-300 text-center space-y-2">
                        <span className="text-[11px] text-stone-400 block">اختاري رفيقة لها:</span>
                        <select
                          onChange={e => handlePartnerChange(pair.s1.id, e.target.value)}
                          defaultValue=""
                          className="w-full px-2 py-1.5 text-xs font-bold border border-stone-200 rounded-xl bg-white text-stone-800"
                        >
                          <option value="" disabled>اختاري من طالبات الحلقة...</option>
                          {circleStudents
                            .filter(other => other.id !== pair.s1.id && !other.partnerStudentId)
                            .map(other => (
                              <option key={other.id} value={other.id}>{other.name}</option>
                            ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recitation Evaluation Modal */}
      {evalModalOpen && selectedStudentForEval && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-xl border border-stone-200 max-h-[92vh] overflow-y-auto space-y-4">
            
            <div className="flex items-center justify-between border-b border-stone-100 pb-2">
              <div>
                <h3 className="font-bold text-stone-900 text-base font-quran">
                  رصد التسميع اليومي ومطابقة الشروط
                </h3>
                <p className="text-xs text-stone-500">
                  للطالبة: <strong>{selectedStudentForEval.name}</strong> • حلقة: <strong>{activeCircle.name}</strong>
                </p>
              </div>
              <button onClick={() => setEvalModalOpen(false)} className="text-stone-400 hover:text-stone-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Partner Quick Badge in Modal */}
            <div className="p-3 bg-[#FAF7F4] rounded-2xl border border-[#EFE8E2] flex items-center justify-between text-xs">
              <span className="font-bold text-stone-700 flex items-center gap-1">
                <span>👯‍♀️</span>
                <span>الرفيقة في المراجعة الثنائية:</span>
              </span>
              <select
                value={selectedStudentForEval.partnerStudentId || 'none'}
                onChange={e => handlePartnerChange(selectedStudentForEval.id, e.target.value)}
                className="px-2 py-1 border border-stone-200 rounded-lg text-xs font-bold bg-white text-[#8E5364]"
              >
                <option value="none">بدون رفيقة</option>
                {circleStudents
                  .filter(o => o.id !== selectedStudentForEval.id)
                  .map(o => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
              </select>
            </div>

            <form onSubmit={handleSaveEvaluation} className="space-y-4">
              
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">المقرر المسموع اليوم</label>
                <input
                  type="text"
                  required
                  value={evalForm.requiredPortionText}
                  onChange={e => setEvalForm({ ...evalForm, requiredPortionText: e.target.value })}
                  placeholder="مثال: سورة البقرة من آية 15 إلى 25"
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                />
              </div>

              {/* Mistakes, Hints & Tajweed Deductions */}
              <div className="bg-[#FCFAF8] p-4 rounded-2xl border border-stone-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-800">الأخطاء والتنبيهات الملاحظة:</span>
                  <div className="text-xs font-bold text-[#8E5364]">
                    الدرجة المستحقة: <span className="text-base font-extrabold">{calculateScore(evalForm.memorizationMistakes, evalForm.hintsCount, evalForm.tajweedErrorsCount)}</span> / {formula.baseGrade}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <label className="block text-stone-600 mb-1 text-[11px]">أخطاء الحفظ (-{formula.deductionPerMistake})</label>
                    <input
                      type="number"
                      min="0"
                      value={evalForm.memorizationMistakes}
                      onChange={e => setEvalForm({ ...evalForm, memorizationMistakes: Math.max(0, Number(e.target.value)) })}
                      className="w-full py-1.5 border border-stone-200 rounded-xl text-center font-bold text-rose-700"
                    />
                  </div>

                  <div>
                    <label className="block text-stone-600 mb-1 text-[11px]">التنبيهات والتردد (-{formula.deductionPerHint})</label>
                    <input
                      type="number"
                      min="0"
                      value={evalForm.hintsCount}
                      onChange={e => setEvalForm({ ...evalForm, hintsCount: Math.max(0, Number(e.target.value)) })}
                      className="w-full py-1.5 border border-stone-200 rounded-xl text-center font-bold text-amber-700"
                    />
                  </div>

                  <div>
                    <label className="block text-stone-600 mb-1 text-[11px]">أخطاء التجويد (-{formula.deductionPerTajweedError})</label>
                    <input
                      type="number"
                      min="0"
                      value={evalForm.tajweedErrorsCount}
                      onChange={e => setEvalForm({ ...evalForm, tajweedErrorsCount: Math.max(0, Number(e.target.value)) })}
                      className="w-full py-1.5 border border-stone-200 rounded-xl text-center font-bold text-amber-800"
                    />
                  </div>
                </div>
              </div>

              {/* Conditions Checklist */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  شروط الحفظ المتقن (دليل مشكاة الغيم):
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 p-2 rounded-xl bg-stone-50 hover:bg-[#F6EEF1] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={evalForm.conditions.listenedToReader}
                      onChange={e => setEvalForm({
                        ...evalForm,
                        conditions: { ...evalForm.conditions, listenedToReader: e.target.checked }
                      })}
                      className="rounded text-[#8E5364]"
                    />
                    <span>الاستماع للقارئ</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-xl bg-stone-50 hover:bg-[#F6EEF1] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={evalForm.conditions.recitedLooking}
                      onChange={e => setEvalForm({
                        ...evalForm,
                        conditions: { ...evalForm.conditions, recitedLooking: e.target.checked }
                      })}
                      className="rounded text-[#8E5364]"
                    />
                    <span>التلاوة نظراً</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-xl bg-stone-50 hover:bg-[#F6EEF1] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={evalForm.conditions.masteryRepetition}
                      onChange={e => setEvalForm({
                        ...evalForm,
                        conditions: { ...evalForm.conditions, masteryRepetition: e.target.checked }
                      })}
                      className="rounded text-[#8E5364]"
                    />
                    <span>التكرار المتقن غيباً</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-xl bg-stone-50 hover:bg-[#F6EEF1] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={evalForm.conditions.minorRevision}
                      onChange={e => setEvalForm({
                        ...evalForm,
                        conditions: { ...evalForm.conditions, minorRevision: e.target.checked }
                      })}
                      className="rounded text-[#8E5364]"
                    />
                    <span>المراجعة الصغرى</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-xl bg-stone-50 hover:bg-[#F6EEF1] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={evalForm.conditions.tamkeenRevision}
                      onChange={e => setEvalForm({
                        ...evalForm,
                        conditions: { ...evalForm.conditions, tamkeenRevision: e.target.checked }
                      })}
                      className="rounded text-[#8E5364]"
                    />
                    <span>مراجعة التمكين</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={evalForm.conditions.achievedDistinction}
                      onChange={e => setEvalForm({
                        ...evalForm,
                        conditions: { ...evalForm.conditions, achievedDistinction: e.target.checked }
                      })}
                      className="rounded text-amber-600"
                    />
                    <span className="font-bold">معيار التميز 🌟</span>
                  </label>
                </div>
              </div>

              {/* Status & Pages */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">صفحات الحفظ الجديد</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={evalForm.newMemorizationPages}
                    onChange={e => setEvalForm({ ...evalForm, newMemorizationPages: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">صفحات المراجعة</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={evalForm.revisionPages}
                    onChange={e => setEvalForm({ ...evalForm, revisionPages: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">حالة الإنجاز</label>
                  <select
                    value={evalForm.status}
                    onChange={e => setEvalForm({ ...evalForm, status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white"
                  >
                    <option value="completed">✅ مكتمل بالشروط المعتمدة</option>
                    <option value="partial">مقرر جزئي</option>
                    <option value="incomplete">لم يكتمل</option>
                  </select>
                </div>
              </div>

              {/* Teacher Remarks */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">ملاحظات وتوجيهات المعلمة:</label>
                <textarea
                  rows={2}
                  value={evalForm.notes}
                  onChange={e => setEvalForm({ ...evalForm, notes: e.target.value })}
                  placeholder="ملاحظات حول ضبط مخارج الحروف، ترتيل الآيات، أو الوقف والابتداء..."
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                />
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setEvalModalOpen(false)}
                  className="px-4 py-2 text-stone-600 text-xs rounded-xl hover:bg-stone-100 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#8E5364] text-white text-xs font-bold rounded-xl hover:bg-[#744251] shadow-xs cursor-pointer active:scale-95 transition"
                >
                  اعتماد ورصد التسميع
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
