import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  FileText, Plus, Edit, CheckCircle2, Award, Calendar,
  AlertCircle, ChevronLeft, UserCheck, Shield, Trash2
} from 'lucide-react';
import { MonthlyExam, StudentExamResult } from '../types';

export const ExamsView: React.FC = () => {
  const {
    monthlyExams, studentExamResults, students, circles, tracks, monthlyPlans,
    createMonthlyExam, updateMonthlyExam, deleteMonthlyExam, saveExamResult, currentUser,
    quickModalAction, clearQuickModal, selectedTrackId, settings
  } = useApp();

  const [selectedExamId, setSelectedExamId] = useState<string>(
    monthlyExams[0]?.id || ''
  );

  const [examModalOpen, setExamModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<MonthlyExam | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const [evalModalOpen, setEvalModalOpen] = useState(false);
  const [evalStudent, setEvalStudent] = useState<any>(null);

  // Automatically open modal when quickModalAction is triggered
  React.useEffect(() => {
    if (quickModalAction?.type === 'exam') {
      handleOpenExamModal();
      clearQuickModal();
    }
  }, [quickModalAction]);

  // Exam Form State
  const [examForm, setExamForm] = useState({
    title: '',
    trackId: tracks[0]?.id || 't-1',
    monthlyPlanId: monthlyPlans[0]?.id || 'mp-1',
    examDateHijri: '٢٥ جمادى الأولى',
    examDateGregorian: new Date().toISOString().split('T')[0],
    requiredPortion: 'سورة البقرة: من الآية ١ إلى الآية ٧٥',
    maxScore: 100,
    notes: 'اختبار شهري تمكيني شامل لمقرر الحفظ والتجويد'
  });

  // Helper to extract clean teacher name without job title or parentheses
  const cleanTeacherName = (rawName?: string): string => {
    if (!rawName) return '—';
    return rawName
      .replace(/\s*\([^)]*\)/g, '') // remove parentheses and titles like (قائدة المقرأة), (مشرفة)
      .replace(/^(أ\.|أستاذة|معلمة)\s*/g, '') // remove title prefixes
      .trim();
  };

  // Student Result Form (Supports custom individual portions per student)
  const [resultForm, setResultForm] = useState({
    score: 95,
    memorizationMistakes: 0,
    tajweedErrors: 0,
    warningsCount: 0,
    customPortion: '',
    notes: '',
    examinerName: cleanTeacherName(currentUser?.name || 'ريفة المنصوري')
  });

  // Quick portion customization modal state directly from the grade sheet
  const [quickPortionStudent, setQuickPortionStudent] = useState<any>(null);
  const [quickPortionInput, setQuickPortionInput] = useState('');

  const currentExam = monthlyExams.find(e => e.id === selectedExamId) || monthlyExams[0];

  const handleOpenExamModal = (exam?: MonthlyExam) => {
    if (exam) {
      setEditingExam(exam);
      setExamForm({
        title: exam.title,
        trackId: exam.trackId,
        monthlyPlanId: exam.monthlyPlanId,
        examDateHijri: exam.examDateHijri,
        examDateGregorian: exam.examDateGregorian,
        requiredPortion: exam.requiredPortion,
        maxScore: exam.maxScore,
        notes: exam.notes || ''
      });
    } else {
      setEditingExam(null);
      setExamForm({
        title: 'الاختبار الشهري التمكيني - جمادى الآخرة',
        trackId: tracks[0]?.id || 't-1',
        monthlyPlanId: monthlyPlans[0]?.id || 'mp-1',
        examDateHijri: '٢٥ جمادى الآخرة',
        examDateGregorian: new Date().toISOString().split('T')[0],
        requiredPortion: 'سورة البقرة: من الآية ٧٦ إلى ١٤١',
        maxScore: 100,
        notes: 'سرد متصل مع تطبيق أحكام التجويد والوقف والابتداء'
      });
    }
    setExamModalOpen(true);
  };

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examForm.title.trim()) return;
    if (editingExam) {
      await updateMonthlyExam(editingExam.id, examForm);
    } else {
      const created = await createMonthlyExam(examForm);
      setSelectedExamId(created.id);
    }
    setExamModalOpen(false);
  };

  const handleDeleteCurrentExam = async () => {
    if (!currentExam) return;
    const remaining = monthlyExams.filter(e => e.id !== currentExam.id);
    await deleteMonthlyExam(currentExam.id);
    setSelectedExamId(remaining[0]?.id || '');
    setDeleteConfirmOpen(false);
  };

  const handleOpenEvalModal = (student: any) => {
    setEvalStudent(student);
    const existing = studentExamResults.find(
      r => r.examId === currentExam?.id && r.studentId === student.id
    );

    if (existing) {
      setResultForm({
        score: existing.score,
        memorizationMistakes: existing.memorizationMistakes,
        tajweedErrors: existing.tajweedErrors,
        warningsCount: existing.warningsCount,
        customPortion: existing.customPortion || '',
        notes: existing.notes || '',
        examinerName: cleanTeacherName(existing.examinerName || currentUser?.name || 'ريفة المنصوري')
      });
    } else {
      setResultForm({
        score: 95,
        memorizationMistakes: 0,
        tajweedErrors: 0,
        warningsCount: 0,
        customPortion: '',
        notes: 'حفظ متقن ومثبت بدون تردد',
        examinerName: cleanTeacherName(currentUser?.name || 'ريفة المنصوري')
      });
    }
    setEvalModalOpen(true);
  };

  const handleOpenQuickPortion = (student: any) => {
    setQuickPortionStudent(student);
    const existing = studentExamResults.find(
      r => r.examId === currentExam?.id && r.studentId === student.id
    );
    setQuickPortionInput(existing?.customPortion || '');
  };

  const handleSaveQuickPortion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPortionStudent || !currentExam) return;
    const existing = studentExamResults.find(
      r => r.examId === currentExam.id && r.studentId === quickPortionStudent.id
    );
    await saveExamResult({
      examId: currentExam.id,
      studentId: quickPortionStudent.id,
      customPortion: quickPortionInput.trim(),
      score: existing?.score ?? 0,
      memorizationMistakes: existing?.memorizationMistakes ?? 0,
      tajweedErrors: existing?.tajweedErrors ?? 0,
      warningsCount: existing?.warningsCount ?? 0,
      notes: existing?.notes || '',
      examinerName: cleanTeacherName(currentUser?.name || 'ريفة المنصوري')
    });
    setQuickPortionStudent(null);
  };

  const handleSaveResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evalStudent || !currentExam) return;

    await saveExamResult({
      examId: currentExam.id,
      studentId: evalStudent.id,
      score: Number(resultForm.score),
      memorizationMistakes: Number(resultForm.memorizationMistakes),
      tajweedErrors: Number(resultForm.tajweedErrors),
      warningsCount: Number(resultForm.warningsCount),
      customPortion: resultForm.customPortion,
      notes: resultForm.notes,
      examinerName: cleanTeacherName(resultForm.examinerName)
    });

    setEvalModalOpen(false);
  };

  return (
    <div className="space-y-6">

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-[#E8DFD8] shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">📝</span>
            <h2 className="text-xl font-bold text-stone-900 font-quran">الاختبارات الشهرية والختامية</h2>
          </div>
          <p className="text-xs text-stone-500">
            جدولة الاختبارات الشهرية التمكينية (٢٥ جمادى الأولى)، رصد أخطاء الحفظ والتجويد، والاحتفاظ بسجلات الشهور الماضية
          </p>
        </div>

        <button
          onClick={() => handleOpenExamModal()}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>جدولة اختبار شهري جديد</span>
        </button>
      </div>

      {/* Exam Selection Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {monthlyExams.map(ex => (
          <button
            key={ex.id}
            onClick={() => setSelectedExamId(ex.id)}
            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 ${
              selectedExamId === ex.id
                ? 'bg-[#8E5364] text-white shadow-xs'
                : 'bg-white text-stone-700 hover:bg-[#FAF6F2] border border-[#E8DFD8]'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>{ex.title}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
              selectedExamId === ex.id ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'
            }`}>
              {ex.examDateHijri}
            </span>
          </button>
        ))}
      </div>

      {/* Active Exam Details Card */}
      {currentExam && (
        <div className="bg-white p-6 rounded-3xl border border-[#E8DFD8] shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">🌟</span>
                <h3 className="text-base sm:text-lg font-bold text-stone-900">{currentExam.title}</h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#EBF3EE] text-[#2D5A43] font-bold">
                  {currentExam.maxScore} درجة كاملة
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-1">
                تاريخ الاختبار: <strong className="text-[#8E5364]">{currentExam.examDateHijri}</strong> ({currentExam.examDateGregorian})
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                onClick={() => handleOpenExamModal(currentExam)}
                className="px-3 py-1.5 text-stone-600 hover:text-stone-900 rounded-xl hover:bg-stone-100 text-xs font-bold flex items-center gap-1.5 border border-stone-200 transition cursor-pointer"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>تعديل</span>
              </button>
              <button
                onClick={() => setDeleteConfirmOpen(true)}
                className="px-3 py-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-rose-200 transition cursor-pointer"
                title="حذف هذا الاختبار وسجلاته"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف الاختبار</span>
              </button>
            </div>
          </div>

          {currentExam.notes && (
            <div className="p-3.5 rounded-2xl bg-[#FCFAF8] border border-[#EFE8E2] text-xs">
              <span className="font-bold text-stone-800 block mb-1">تعليمات وضوابط اللجنة:</span>
              <p className="text-stone-600 leading-relaxed text-[11px]">{currentExam.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Exam Results Table */}
      <div className="bg-white rounded-3xl border border-[#E8DFD8] shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-stone-100 flex items-center justify-between">
          <div>
            <h4 className="font-bold text-stone-800 text-sm">
              كشف رصد درجات ومقررات الاختبار الشهري للطالبات
            </h4>
            <p className="text-[11px] text-stone-400">
              تخصيص مقرر كل طالبة مباشرة من الكشف بحسب خطتها الفردية
            </p>
          </div>
          <span className="text-xs text-stone-500">
            المعلمة: <strong className="text-stone-700 font-semibold">{cleanTeacherName(currentUser?.name || settings.leaderName)}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-[#FAF6F2] text-stone-600 font-bold border-b border-stone-200">
                <th className="p-3.5 text-center w-12">#</th>
                <th className="p-3.5 min-w-[180px]">اسم الطالبة</th>
                <th className="p-3.5">الحلقة</th>
                <th className="p-3.5 w-36 whitespace-nowrap">المقرر</th>
                <th className="p-3.5 text-center">أخطاء الحفظ</th>
                <th className="p-3.5 text-center">التنبيهات</th>
                <th className="p-3.5 text-center">أخطاء التجويد</th>
                <th className="p-3.5 font-bold text-center">الدرجة</th>
                <th className="p-3.5">المعلمة</th>
                <th className="p-3.5">ملاحظات اللجنة</th>
                <th className="p-3.5 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {students.filter(s => s.status === 'active').map((student, idx) => {
                const res = studentExamResults.find(
                  r => r.examId === currentExam?.id && r.studentId === student.id
                );
                const circle = circles.find(c => c.id === student.circleId);

                return (
                  <tr key={student.id} className="hover:bg-[#FCF9FA] transition">
                    <td className="p-3.5 font-semibold text-stone-400 text-center w-12">{idx + 1}</td>
                    <td className="p-3.5 font-bold text-stone-900 min-w-[180px]">{student.name}</td>
                    <td className="p-3.5 text-stone-500">{circle?.name}</td>
                    <td className="p-3.5 w-36">
                      <button
                        type="button"
                        onClick={() => handleOpenQuickPortion(student)}
                        className="w-full inline-flex items-center justify-between gap-1.5 px-2.5 py-1 rounded-xl bg-stone-100 hover:bg-[#FAF0F3] hover:text-[#8E5364] border border-stone-200/90 hover:border-[#8E5364]/40 transition text-[11px] text-stone-700 font-medium cursor-pointer group"
                        title="انقري لتخصيص مقرر الطالبة مباشرة"
                      >
                        <span className="truncate">{res?.customPortion || 'تحديد المقرر...'}</span>
                        <Edit className="w-3 h-3 shrink-0 text-stone-400 group-hover:text-[#8E5364]" />
                      </button>
                    </td>

                    <td className="p-3.5 text-center">
                      {res !== undefined ? (
                        <span className={`font-semibold ${res.memorizationMistakes > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                          {res.memorizationMistakes}
                        </span>
                      ) : <span className="text-stone-300">—</span>}
                    </td>

                    <td className="p-3.5 text-center">
                      {res !== undefined ? (
                        <span className="font-semibold text-amber-700">{res.warningsCount}</span>
                      ) : <span className="text-stone-300">—</span>}
                    </td>

                    <td className="p-3.5 text-center">
                      {res !== undefined ? (
                        <span className="font-semibold text-purple-700">{res.tajweedErrors}</span>
                      ) : <span className="text-stone-300">—</span>}
                    </td>

                    <td className="p-3.5 text-center">
                      {res !== undefined ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="text-base font-extrabold text-[#2D5A43]">
                            {res.score}
                          </span>
                          <span className="text-[10px] text-stone-400">/ 100</span>
                        </div>
                      ) : (
                        <span className="text-stone-300 font-normal">بانتظار الاختبار</span>
                      )}
                    </td>

                    <td className="p-3.5 text-stone-700 font-medium text-[11px]">
                      {cleanTeacherName(res?.examinerName || circle?.teacherName)}
                    </td>

                    <td className="p-3.5 text-stone-600 max-w-xs truncate text-[11px]">
                      {res?.notes || '—'}
                    </td>

                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => handleOpenEvalModal(student)}
                        className="px-3 py-1 bg-[#8E5364] hover:bg-[#744251] text-white rounded-lg text-[11px] font-bold transition shadow-2xs"
                      >
                        {res !== undefined ? 'تعديل الدرجة' : 'رصد الاختبار'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Exam Modal */}
      {examModalOpen && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-stone-200">
            <h3 className="font-bold text-stone-900 text-base font-quran mb-3">
              {editingExam ? 'تعديل بيانات الاختبار الشهري' : 'جدولة اختبار شهري تمكيني'}
            </h3>
            <form onSubmit={handleSaveExam} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">عنوان الاختبار</label>
                <input
                  type="text"
                  required
                  value={examForm.title}
                  onChange={e => setExamForm({ ...examForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">التاريخ الهجري</label>
                  <input
                    type="text"
                    required
                    value={examForm.examDateHijri}
                    onChange={e => setExamForm({ ...examForm, examDateHijri: e.target.value })}
                    placeholder="مثال: ٢٥ جمادى الأولى"
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">الدرجة الكاملة</label>
                  <input
                    type="number"
                    min="1"
                    value={examForm.maxScore}
                    onChange={e => setExamForm({ ...examForm, maxScore: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs font-bold"
                  />
                </div>
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl text-amber-900 text-xs flex items-center gap-2">
                <span className="text-sm">💡</span>
                <span>تخصيص مقرر كل طالبة يتم بشكل فردي ومباشر من جدول رصد الدرجات لسهولة الإدارة والمرونة.</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">ملاحظات وضوابط اللجنة</label>
                <textarea
                  rows={2}
                  value={examForm.notes}
                  onChange={e => setExamForm({ ...examForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setExamModalOpen(false)}
                  className="px-4 py-2 text-stone-600 text-xs rounded-xl hover:bg-stone-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#8E5364] text-white text-xs font-bold rounded-xl hover:bg-[#744251]"
                >
                  حفظ وجدولة الاختبار
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Student Exam Result Modal */}
      {evalModalOpen && evalStudent && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-stone-200">
            <h3 className="font-bold text-stone-900 text-base font-quran mb-1">
              رصد نتيجة الاختبار الشهري
            </h3>
            <p className="text-xs text-stone-500 mb-4">
              للطالبة: <strong>{evalStudent.name}</strong> • الاختبار: <strong>{currentExam?.title}</strong>
            </p>

            <form onSubmit={handleSaveResult} className="space-y-4">
              
              <div className="p-4 bg-[#FAF6F2] rounded-2xl border border-[#EFE8E2]">
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  الدرجة النهائية المحصلة (من {currentExam?.maxScore || 100}):
                </label>
                <input
                  type="number"
                  min="0"
                  max={currentExam?.maxScore || 100}
                  step="0.5"
                  value={resultForm.score}
                  onChange={e => setResultForm({ ...resultForm, score: Number(e.target.value) })}
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-lg font-black text-[#2D5A43] bg-white text-center"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-rose-800 mb-1">أخطاء حفظ</label>
                  <input
                    type="number"
                    min="0"
                    value={resultForm.memorizationMistakes}
                    onChange={e => setResultForm({ ...resultForm, memorizationMistakes: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-rose-200 rounded-xl text-xs text-center"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-amber-800 mb-1">تنبيهات</label>
                  <input
                    type="number"
                    min="0"
                    value={resultForm.warningsCount}
                    onChange={e => setResultForm({ ...resultForm, warningsCount: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-amber-200 rounded-xl text-xs text-center"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-purple-800 mb-1">تجويد</label>
                  <input
                    type="number"
                    min="0"
                    value={resultForm.tajweedErrors}
                    onChange={e => setResultForm({ ...resultForm, tajweedErrors: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-purple-200 rounded-xl text-xs text-center"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  المقرر المخصص لهذه الطالبة في هذا الاختبار:
                </label>
                <input
                  type="text"
                  value={resultForm.customPortion}
                  onChange={e => setResultForm({ ...resultForm, customPortion: e.target.value })}
                  placeholder="مثال: من سورة البقرة آية ١ إلى ٧٥ (مقرر خاص بالطالبة)"
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs font-medium"
                />
                <span className="text-[10px] text-stone-400 mt-0.5 block">
                  يمكن تعديل الجزء المخصص لكل طالبة بحسب خطتها الشهرية الفردية
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">اسم المعلمة:</label>
                <input
                  type="text"
                  value={resultForm.examinerName}
                  onChange={e => setResultForm({ ...resultForm, examinerName: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">ملاحظات اللجنة:</label>
                <textarea
                  rows={2}
                  value={resultForm.notes}
                  onChange={e => setResultForm({ ...resultForm, notes: e.target.value })}
                  placeholder="تقييم الرسوخ، التمكين، الأداء الصوتي..."
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEvalModalOpen(false)}
                  className="px-4 py-2 text-stone-600 text-xs rounded-xl hover:bg-stone-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#8E5364] text-white text-xs font-bold rounded-xl hover:bg-[#744251]"
                >
                  اعتماد ورصد نتيجة الاختبار
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Quick Portion Customization Modal */}
      {quickPortionStudent && currentExam && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-stone-900 text-base font-quran">
                  تخصيص مقرر الاختبار الفردي
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  للطالبة: <strong className="text-stone-800">{quickPortionStudent.name}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuickPortionStudent(null)}
                className="w-8 h-8 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-700 flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveQuickPortion} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  المقرر المطلوب اختباره للطالبة:
                </label>
                <textarea
                  rows={3}
                  required
                  value={quickPortionInput}
                  onChange={e => setQuickPortionInput(e.target.value)}
                  placeholder="مثال: من بداية سورة النحل إلى نهاية سورة الإسراء (أو الجزء ١٥ كاملاً)..."
                  className="w-full px-3.5 py-2.5 border border-stone-200 rounded-xl text-xs leading-relaxed focus:outline-hidden focus:border-[#8E5364]"
                  autoFocus
                />
                <p className="text-[11px] text-stone-400 mt-1">
                  يمكنك تحديد مقرر مختلف لكل طالبة بحسب خطتها الفردية ومتابعتها.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setQuickPortionStudent(null)}
                  className="px-4 py-2 text-stone-600 text-xs rounded-xl hover:bg-stone-100 transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#8E5364] text-white text-xs font-bold rounded-xl hover:bg-[#744251] transition shadow-xs"
                >
                  حفظ المقرر للطالبة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Exam Confirmation Modal */}
      {deleteConfirmOpen && currentExam && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-xl border border-stone-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl">
              🗑️
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-bold text-stone-900 text-base">حذف الاختبار الشهري؟</h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                هل أنتِ متأكدة من حذف <strong>«{currentExam.title}»</strong>؟ سيتم حذف الاختبار وكافة النتائج والدرجات المرصودة فيه نهائياً.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="flex-1 py-2 rounded-xl border border-stone-200 text-stone-700 text-xs font-bold hover:bg-stone-50 transition cursor-pointer"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={handleDeleteCurrentExam}
                className="flex-1 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition cursor-pointer"
              >
                نعم، احذف الاختبار
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
