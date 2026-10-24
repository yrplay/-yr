import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { QURAN_SURAHS, getSurahByNumber, getAyahCount } from '../data/quranData';
import {
  Calendar, Plus, Copy, BookOpen, CheckCircle2, Clock,
  ChevronLeft, Award, FileText, Sparkles, AlertCircle, Edit
} from 'lucide-react';
import { MonthlyPlan, StudentMonthlyPlan } from '../types';

export const MonthlyPlansView: React.FC = () => {
  const {
    monthlyPlans, studentPlans, students, circles, tracks,
    createMonthlyPlan, updateMonthlyPlan, duplicateMonthlyPlan, saveStudentPlan,
    currentUser, allStudentScores, showToast
  } = useApp();

  const [selectedPlanId, setSelectedPlanId] = useState<string>(monthlyPlans[0]?.id || 'mp-1');
  const [selectedStudentId, setSelectedStudentId] = useState<string>(students[0]?.id || 's-1');

  // Modals state
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MonthlyPlan | null>(null);

  // New/Edit Plan form
  const [planForm, setPlanForm] = useState({
    title: '',
    trackId: tracks[0]?.id || 't-1',
    hijriMonth: 'ربيع الآخر - جمادى الأولى',
    hijriYear: '1446',
    startDateHijri: '٣٠ ربيع الآخر',
    endDateHijri: '٢٩ جمادى الأولى',
    examDateHijri: '٢٥ جمادى الأولى',
    scheduleDays: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء'],
    thursdayFocus: 'مخصص للتحديات والمراجعة الثنائية بحسب التحدي المعتمد'
  });

  const currentPlan = monthlyPlans.find(p => p.id === selectedPlanId) || monthlyPlans[0];
  const selectedStudent = students.find(s => s.id === selectedStudentId) || students[0];
  const studentPlan = studentPlans.find(sp => sp.studentId === selectedStudentId && sp.monthlyPlanId === currentPlan?.id) || studentPlans.find(sp => sp.studentId === selectedStudentId);

  // Student plan edit form state
  const [editingStudentPlan, setEditingStudentPlan] = useState(false);
  const [studentPlanForm, setStudentPlanForm] = useState<{
    newMemorization: {
      fromSurah: number;
      fromAyah: number;
      toSurah: number;
      toAyah: number;
      targetPages: number;
      actualPages: number;
      targetDailyAmount: string;
      actualDailyAmount?: string;
      teacherNotes?: string;
    };
    revision: {
      fromSurah: number;
      fromAyah: number;
      toSurah: number;
      toAyah: number;
      targetPages: number;
      actualPages: number;
      revisionType: 'صغرى' | 'تمكين' | string;
      status: 'completed' | 'in_progress' | 'pending';
      teacherNotes?: string;
    };
  }>({
    newMemorization: {
      fromSurah: 2,
      fromAyah: 1,
      toSurah: 2,
      toAyah: 50,
      targetPages: 8,
      actualPages: 8,
      targetDailyAmount: 'صفحة واحدة يومياً',
      actualDailyAmount: 'صفحة واحدة يومياً',
      teacherNotes: ''
    },
    revision: {
      fromSurah: 1,
      fromAyah: 1,
      toSurah: 2,
      toAyah: 25,
      targetPages: 4,
      actualPages: 4,
      revisionType: 'تمكين',
      status: 'completed',
      teacherNotes: ''
    }
  });

  // Track student and plan changes so active edits aren't wiped out by background re-renders
  const lastSelectedStudentIdRef = React.useRef(selectedStudentId);
  const lastPlanIdRef = React.useRef(currentPlan?.id);

  // When selected student changes, populate studentPlanForm
  React.useEffect(() => {
    const studentChanged = lastSelectedStudentIdRef.current !== selectedStudentId;
    const planChanged = lastPlanIdRef.current !== currentPlan?.id;
    lastSelectedStudentIdRef.current = selectedStudentId;
    lastPlanIdRef.current = currentPlan?.id;

    if (studentChanged || planChanged) {
      setEditingStudentPlan(false);
    } else if (editingStudentPlan) {
      // User is actively editing this student's syllabus; do NOT overwrite!
      return;
    }

    const currentMonthPlan = studentPlans.find(
      sp => sp.studentId === selectedStudentId && sp.monthlyPlanId === currentPlan?.id
    );
    const existing = currentMonthPlan || studentPlans.find(sp => sp.studentId === selectedStudentId);

    if (existing) {
      setStudentPlanForm({
        newMemorization: { ...existing.newMemorization },
        revision: { ...existing.revision }
      });
    } else {
      setStudentPlanForm({
        newMemorization: {
          fromSurah: 2,
          fromAyah: 1,
          toSurah: 2,
          toAyah: 25,
          targetPages: 5,
          actualPages: 0,
          targetDailyAmount: 'نصف صفحة إلى صفحة يومياً',
          actualDailyAmount: '',
          teacherNotes: ''
        },
        revision: {
          fromSurah: 1,
          fromAyah: 1,
          toSurah: 1,
          toAyah: 7,
          targetPages: 1,
          actualPages: 1,
          revisionType: 'صغرى',
          status: 'in_progress',
          teacherNotes: ''
        }
      });
    }
  }, [selectedStudentId, currentPlan?.id, studentPlans, editingStudentPlan]);

  const handleOpenPlanModal = (plan?: MonthlyPlan) => {
    if (plan) {
      setEditingPlan(plan);
      setPlanForm({
        title: plan.title,
        trackId: plan.trackId,
        hijriMonth: plan.hijriMonth,
        hijriYear: plan.hijriYear,
        startDateHijri: plan.startDateHijri,
        endDateHijri: plan.endDateHijri,
        examDateHijri: plan.examDateHijri,
        scheduleDays: plan.scheduleDays || ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء'],
        thursdayFocus: plan.thursdayFocus
      });
    } else {
      setEditingPlan(null);
      setPlanForm({
        title: 'خطة شهرية جديدة لمسار مشكاة الغيم',
        trackId: tracks[0]?.id || 't-1',
        hijriMonth: 'جمادى الآخرة',
        hijriYear: '1446',
        startDateHijri: '١ جمادى الآخرة',
        endDateHijri: '٣٠ جمادى الآخرة',
        examDateHijri: '٢٥ جمادى الآخرة',
        scheduleDays: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء'],
        thursdayFocus: 'مخصص للتحديات والمراجعة الثنائية بحسب التحدي المعتمد'
      });
    }
    setPlanModalOpen(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPlan) {
      await updateMonthlyPlan(editingPlan.id, planForm);
    } else {
      const created = await createMonthlyPlan(planForm);
      setSelectedPlanId(created.id);
    }
    setPlanModalOpen(false);
  };

  const handleSaveStudentPlan = async () => {
    if (!selectedStudent || !currentPlan) return;
    const currentMonthPlan = studentPlans.find(
      sp => sp.studentId === selectedStudent.id && sp.monthlyPlanId === currentPlan.id
    );

    await saveStudentPlan({
      id: currentMonthPlan?.id,
      studentId: selectedStudent.id,
      monthlyPlanId: currentPlan.id,
      newMemorization: { ...studentPlanForm.newMemorization },
      revision: { ...studentPlanForm.revision },
      status: 'active'
    });
    setEditingStudentPlan(false);
    showToast(`تم حفظ وتحديث مقرر الطالبة (${selectedStudent.name}) بنجاح ✅`, 'success');
  };

  // Helper calculations for Surah verses
  const fromSurahMaxVerses = getAyahCount(studentPlanForm.newMemorization.fromSurah);
  const toSurahMaxVerses = getAyahCount(studentPlanForm.newMemorization.toSurah);
  const revFromSurahMaxVerses = getAyahCount(studentPlanForm.revision.fromSurah);
  const revToSurahMaxVerses = getAyahCount(studentPlanForm.revision.toSurah);

  const fromSurahInfo = getSurahByNumber(studentPlanForm.newMemorization.fromSurah);
  const toSurahInfo = getSurahByNumber(studentPlanForm.newMemorization.toSurah);

  const studentScore = allStudentScores[selectedStudent?.id];

  return (
    <div className="space-y-6">

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-[#E8DFD8] shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">📅</span>
            <h2 className="text-xl font-bold text-stone-900 font-quran">الخطط الشهرية للحفظ والمراجعة</h2>
          </div>
          <p className="text-xs text-stone-500">
            تحديد مواعيد البداية والنهاية، أيام الحفظ والتسميع، وتعيين مقرر السور والآيات بدقة
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => duplicateMonthlyPlan(currentPlan.id)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#FAF6F2] hover:bg-[#F2ECE6] text-[#744251] border border-[#E2D5CC] rounded-xl text-xs font-bold transition cursor-pointer active:scale-95"
            title="نسخ الخطة السابقة وتعديلها دون فقد سجلات الماضي"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>نسخ الخطة السابقة</span>
          </button>
          <button
            type="button"
            onClick={() => handleOpenPlanModal()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إنشاء خطة شهرية جديدة</span>
          </button>
        </div>
      </div>

      {/* Monthly Plan Selection Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {monthlyPlans.map(plan => (
          <button
            key={plan.id}
            type="button"
            onClick={() => setSelectedPlanId(plan.id)}
            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition flex items-center gap-2 shrink-0 cursor-pointer active:scale-95 ${
              selectedPlanId === plan.id
                ? 'bg-[#8E5364] text-white shadow-xs'
                : 'bg-white text-stone-700 hover:bg-[#FAF6F2] border border-[#E8DFD8]'
            }`}
          >
            <span>📅 {plan.title}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
              selectedPlanId === plan.id ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'
            }`}>
              {plan.hijriMonth}
            </span>
          </button>
        ))}
      </div>

      {/* Plan Details & Calendar Rules Card */}
      {currentPlan && (
        <div className="bg-white p-6 rounded-3xl border border-[#E8DFD8] shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-stone-900">{currentPlan.title}</h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                  نشطة معتمدة
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-1">
                المسار: {tracks.find(t => t.id === currentPlan.trackId)?.name || 'مشكاة الغيم للحفظ'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleOpenPlanModal(currentPlan)}
              className="px-3.5 py-2 text-[#744251] bg-[#FAF6F2] hover:bg-[#F2ECE6] rounded-xl text-xs font-bold flex items-center gap-1.5 border border-[#E2D5CC] self-start sm:self-auto cursor-pointer active:scale-95 transition"
            >
              <Edit className="w-3.5 h-3.5" />
              <span>تعديل تواريخ وتفاصيل الخطة</span>
            </button>
          </div>

          {/* Schedule Rules Grid (as specified in prompt) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-[#FCFAF8] border border-[#EFE8E2]">
              <div className="text-[11px] text-stone-600 mb-0.5 font-medium">بداية الخطة:</div>
              <div className="text-sm font-bold text-stone-900">{currentPlan.startDateHijri}</div>
              <div className="text-[10px] text-stone-500 mt-0.5">سنة {currentPlan.hijriYear} هـ</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#FCFAF8] border border-[#EFE8E2]">
              <div className="text-[11px] text-stone-600 mb-0.5 font-medium">أيام الحفظ والتسميع:</div>
              <div className="text-sm font-bold text-[#8E5364]">
                {currentPlan.scheduleDays?.join('، ') || 'الأحد - الأربعاء'}
              </div>
              <div className="text-[10px] text-stone-500 mt-0.5">٤ جلسات أسبوعية</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#FCFAF8] border border-[#EFE8E2]">
              <div className="text-[11px] text-stone-600 mb-0.5 font-medium">يوم الخميس:</div>
              <div className="text-sm font-bold text-[#7A4B37]">
                التحديات والمراجعة الثنائية 🤝
              </div>
              <div className="text-[10px] text-stone-500 mt-0.5">{currentPlan.thursdayFocus}</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#FCFAF8] border border-[#EFE8E2]">
              <div className="text-[11px] text-stone-600 mb-0.5 font-medium">الاختبار الشهري التمكيني:</div>
              <div className="text-sm font-bold text-[#2D5A43]">{currentPlan.examDateHijri}</div>
              <div className="text-[10px] text-stone-500 mt-0.5">في ختام الخطة الشهرية</div>
            </div>
          </div>
        </div>
      )}

      {/* Student Specific Syllabus & Quran Selection Section */}
      <div className="bg-white p-6 rounded-3xl border border-[#E8DFD8] shadow-2xs space-y-6">
        
        {/* Student Selector Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FAF6F2] p-4 rounded-2xl border border-[#EFE8E2]">
          <div className="flex items-center gap-3">
            <span className="text-xl">🪴</span>
            <div>
              <label className="block text-[11px] font-bold text-stone-600 mb-0.5">
                اختاري الطالبة لعرض وتعديل خطتها الفردية:
              </label>
              <select
                value={selectedStudentId}
                onChange={e => setSelectedStudentId(e.target.value)}
                className="px-3 py-1.5 border border-stone-200 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-[#8E5364]"
              >
                {students.map(s => {
                  const circle = circles.find(c => c.id === s.circleId);
                  return (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code}) - {circle?.name}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!editingStudentPlan ? (
              <button
                onClick={() => setEditingStudentPlan(true)}
                className="px-4 py-2 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>تعديل مقرر الطالبة</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingStudentPlan(false)}
                  className="px-3 py-2 text-stone-600 text-xs rounded-xl hover:bg-stone-200"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleSaveStudentPlan}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition shadow-xs"
                >
                  حفظ المقرر المحدث
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Plan Progress Indicator */}
        <div className="bg-[#FCFAF8] p-4 rounded-2xl border border-[#EFE8E2]">
          <div className="flex items-center justify-between text-xs font-bold text-stone-800 mb-2">
            <span>مؤشر إنجاز الخطة الشهرية للطالبة ({selectedStudent?.name})</span>
            <span className="text-[#8E5364]">
              {studentScore?.newMemorizationPagesDone} من أصل {studentScore?.newMemorizationPagesTarget} صفحات منجزة
            </span>
          </div>
          <div className="w-full bg-[#EFEAE5] h-3 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-[#9E5B6D] to-[#2D5A43] h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(100, ((studentScore?.newMemorizationPagesDone || 0) / (studentScore?.newMemorizationPagesTarget || 1)) * 100)}%`
              }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-stone-400 mt-2">
            <span>بداية المقرر: {fromSurahInfo?.name} (صفحة {fromSurahInfo?.startPage})</span>
            <span>نهاية المقرر: {toSurahInfo?.name} (صفحة {toSurahInfo?.startPage})</span>
          </div>
        </div>

        {/* Section A: New Memorization (خطة الحفظ الجديد) */}
        <div className="border border-[#E8DFD8] rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#8E5364]"></span>
              <h4 className="font-bold text-stone-900 text-sm">أ. خطة ومقرر الحفظ الجديد</h4>
            </div>
            <span className="text-[11px] text-stone-500">
              جميع سور القرآن (١١٤ سورة) مصنفة من البقرة إلى الناس
            </span>
          </div>

          {editingStudentPlan ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* From Surah */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">من سورة:</label>
                  <select
                    value={studentPlanForm.newMemorization.fromSurah}
                    onChange={e => {
                      const num = Number(e.target.value);
                      setStudentPlanForm({
                        ...studentPlanForm,
                        newMemorization: {
                          ...studentPlanForm.newMemorization,
                          fromSurah: num,
                          fromAyah: 1
                        }
                      });
                    }}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white"
                  >
                    {QURAN_SURAHS.map(s => (
                      <option key={s.number} value={s.number}>
                        {s.number}. سورة {s.name} ({s.versesCount} آية)
                      </option>
                    ))}
                  </select>
                </div>

                {/* From Ayah */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">من آية:</label>
                  <select
                    value={studentPlanForm.newMemorization.fromAyah}
                    onChange={e => setStudentPlanForm({
                      ...studentPlanForm,
                      newMemorization: {
                        ...studentPlanForm.newMemorization,
                        fromAyah: Number(e.target.value)
                      }
                    })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white"
                  >
                    {Array.from({ length: fromSurahMaxVerses }, (_, i) => i + 1).map(num => (
                      <option key={num} value={num}>آية {num}</option>
                    ))}
                  </select>
                </div>

                {/* To Surah */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">إلى سورة:</label>
                  <select
                    value={studentPlanForm.newMemorization.toSurah}
                    onChange={e => {
                      const num = Number(e.target.value);
                      setStudentPlanForm({
                        ...studentPlanForm,
                        newMemorization: {
                          ...studentPlanForm.newMemorization,
                          toSurah: num,
                          toAyah: Math.min(studentPlanForm.newMemorization.toAyah, getAyahCount(num))
                        }
                      });
                    }}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white"
                  >
                    {QURAN_SURAHS.map(s => (
                      <option key={s.number} value={s.number}>
                        {s.number}. سورة {s.name} ({s.versesCount} آية)
                      </option>
                    ))}
                  </select>
                </div>

                {/* To Ayah */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">إلى آية:</label>
                  <select
                    value={studentPlanForm.newMemorization.toAyah}
                    onChange={e => setStudentPlanForm({
                      ...studentPlanForm,
                      newMemorization: {
                        ...studentPlanForm.newMemorization,
                        toAyah: Number(e.target.value)
                      }
                    })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white"
                  >
                    {Array.from({ length: toSurahMaxVerses }, (_, i) => i + 1).map(num => (
                      <option key={num} value={num}>آية {num}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">عدد الصفحات المستهدف</label>
                  <input
                    type="number"
                    min="1"
                    value={studentPlanForm.newMemorization.targetPages}
                    onChange={e => setStudentPlanForm({
                      ...studentPlanForm,
                      newMemorization: { ...studentPlanForm.newMemorization, targetPages: Number(e.target.value) }
                    })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">الصفحات المنجزة فعلياً</label>
                  <input
                    type="number"
                    min="0"
                    value={studentPlanForm.newMemorization.actualPages}
                    onChange={e => setStudentPlanForm({
                      ...studentPlanForm,
                      newMemorization: { ...studentPlanForm.newMemorization, actualPages: Number(e.target.value) }
                    })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">المقدار المطلوب يومياً</label>
                  <input
                    type="text"
                    value={studentPlanForm.newMemorization.targetDailyAmount}
                    onChange={e => setStudentPlanForm({
                      ...studentPlanForm,
                      newMemorization: { ...studentPlanForm.newMemorization, targetDailyAmount: e.target.value }
                    })}
                    placeholder="مثال: صفحة واحدة يومياً"
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">ملاحظات المعلمة على الحفظ</label>
                <input
                  type="text"
                  value={studentPlanForm.newMemorization.teacherNotes || ''}
                  onChange={e => setStudentPlanForm({
                    ...studentPlanForm,
                    newMemorization: { ...studentPlanForm.newMemorization, teacherNotes: e.target.value }
                  })}
                  placeholder="ملاحظات توجيهية للطالبة..."
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-[#FAF6F2] rounded-xl">
                <span className="text-stone-400 block text-[11px]">بداية المقرر:</span>
                <span className="font-bold text-stone-800">
                  سورة {getSurahByNumber(studentPlanForm.newMemorization.fromSurah)?.name} (آية {studentPlanForm.newMemorization.fromAyah})
                </span>
              </div>
              <div className="p-3 bg-[#FAF6F2] rounded-xl">
                <span className="text-stone-400 block text-[11px]">نهاية المقرر:</span>
                <span className="font-bold text-stone-800">
                  سورة {getSurahByNumber(studentPlanForm.newMemorization.toSurah)?.name} (آية {studentPlanForm.newMemorization.toAyah})
                </span>
              </div>
              <div className="p-3 bg-[#FAF6F2] rounded-xl">
                <span className="text-stone-400 block text-[11px]">عدد الصفحات:</span>
                <span className="font-bold text-[#8E5364]">
                  {studentPlanForm.newMemorization.actualPages} منجز من {studentPlanForm.newMemorization.targetPages} صفحة
                </span>
              </div>
              <div className="p-3 bg-[#FAF6F2] rounded-xl">
                <span className="text-stone-400 block text-[11px]">المقدار اليومي:</span>
                <span className="font-bold text-stone-800">
                  {studentPlanForm.newMemorization.targetDailyAmount}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Section B: Revision Plan (خطة المراجعة والتمكين) */}
        <div className="border border-[#E8DFD8] rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#2D5A43]"></span>
              <h4 className="font-bold text-stone-900 text-sm">ب. خطة المراجعة والتمكين</h4>
            </div>
            <span className="text-[11px] text-stone-500">
              مراجعة صغرى للمقرر القريب ومراجعة تمكين للمحفوظ البعيد
            </span>
          </div>

          {editingStudentPlan ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Rev From Surah */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">من سورة:</label>
                  <select
                    value={studentPlanForm.revision.fromSurah}
                    onChange={e => setStudentPlanForm({
                      ...studentPlanForm,
                      revision: { ...studentPlanForm.revision, fromSurah: Number(e.target.value), fromAyah: 1 }
                    })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white"
                  >
                    {QURAN_SURAHS.map(s => (
                      <option key={s.number} value={s.number}>{s.number}. سورة {s.name}</option>
                    ))}
                  </select>
                </div>

                {/* Rev From Ayah */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">من آية:</label>
                  <select
                    value={studentPlanForm.revision.fromAyah}
                    onChange={e => setStudentPlanForm({
                      ...studentPlanForm,
                      revision: { ...studentPlanForm.revision, fromAyah: Number(e.target.value) }
                    })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white"
                  >
                    {Array.from({ length: revFromSurahMaxVerses }, (_, i) => i + 1).map(num => (
                      <option key={num} value={num}>آية {num}</option>
                    ))}
                  </select>
                </div>

                {/* Rev To Surah */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">إلى سورة:</label>
                  <select
                    value={studentPlanForm.revision.toSurah}
                    onChange={e => setStudentPlanForm({
                      ...studentPlanForm,
                      revision: { ...studentPlanForm.revision, toSurah: Number(e.target.value), toAyah: 1 }
                    })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white"
                  >
                    {QURAN_SURAHS.map(s => (
                      <option key={s.number} value={s.number}>{s.number}. سورة {s.name}</option>
                    ))}
                  </select>
                </div>

                {/* Rev To Ayah */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">إلى آية:</label>
                  <select
                    value={studentPlanForm.revision.toAyah}
                    onChange={e => setStudentPlanForm({
                      ...studentPlanForm,
                      revision: { ...studentPlanForm.revision, toAyah: Number(e.target.value) }
                    })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white"
                  >
                    {Array.from({ length: revToSurahMaxVerses }, (_, i) => i + 1).map(num => (
                      <option key={num} value={num}>آية {num}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">نوع المراجعة</label>
                  <select
                    value={studentPlanForm.revision.revisionType}
                    onChange={e => setStudentPlanForm({
                      ...studentPlanForm,
                      revision: { ...studentPlanForm.revision, revisionType: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white"
                  >
                    <option value="تمكين">تمكين (تثبيت المحفوظ القديم)</option>
                    <option value="صغرى">صغرى (مقرر الأسبوع الماضي)</option>
                    <option value="تثبيت المتشابهات">تثبيت المتشابهات</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">عدد صفحات المراجعة</label>
                  <input
                    type="number"
                    min="1"
                    value={studentPlanForm.revision.targetPages}
                    onChange={e => setStudentPlanForm({
                      ...studentPlanForm,
                      revision: { ...studentPlanForm.revision, targetPages: Number(e.target.value) }
                    })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">حالة إنجاز المراجعة</label>
                  <select
                    value={studentPlanForm.revision.status}
                    onChange={e => setStudentPlanForm({
                      ...studentPlanForm,
                      revision: { ...studentPlanForm.revision, status: e.target.value as any }
                    })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white"
                  >
                    <option value="completed">منجزة بالكامل ✅</option>
                    <option value="in_progress">قيد المراجعة والتمكين</option>
                    <option value="pending">مجدولة لاحقاً</option>
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-[#FAF6F2] rounded-xl">
                <span className="text-stone-400 block text-[11px]">مقرر المراجعة:</span>
                <span className="font-bold text-stone-800">
                  سورة {getSurahByNumber(studentPlanForm.revision.fromSurah)?.name} (آية {studentPlanForm.revision.fromAyah}) إلى سورة {getSurahByNumber(studentPlanForm.revision.toSurah)?.name} (آية {studentPlanForm.revision.toAyah})
                </span>
              </div>
              <div className="p-3 bg-[#FAF6F2] rounded-xl">
                <span className="text-stone-400 block text-[11px]">النوع:</span>
                <span className="font-bold text-[#2D5A43]">{studentPlanForm.revision.revisionType}</span>
              </div>
              <div className="p-3 bg-[#FAF6F2] rounded-xl">
                <span className="text-stone-400 block text-[11px]">عدد الصفحات:</span>
                <span className="font-bold text-stone-800">{studentPlanForm.revision.targetPages} صفحات</span>
              </div>
              <div className="p-3 bg-[#FAF6F2] rounded-xl">
                <span className="text-stone-400 block text-[11px]">الحالة:</span>
                <span className="font-bold text-emerald-800">
                  {studentPlanForm.revision.status === 'completed' ? 'منجزة بالكامل ✅' : 'قيد التمكين'}
                </span>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Plan Modal (Add / Edit) */}
      {planModalOpen && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-xl border border-stone-200 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-stone-900 text-base font-quran mb-3">
              {editingPlan ? 'تعديل الخطة الشهرية ومواعيدها' : 'إنشاء خطة شهرية جديدة'}
            </h3>
            <form onSubmit={handleSavePlan} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">عنوان الخطة</label>
                <input
                  type="text"
                  required
                  value={planForm.title}
                  onChange={e => setPlanForm({ ...planForm, title: e.target.value })}
                  placeholder="مثال: الخطة الثانية - جمادى الأولى وجمادى الآخرة"
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-[#8E5364]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">الشهر الهجري</label>
                  <input
                    type="text"
                    value={planForm.hijriMonth}
                    onChange={e => setPlanForm({ ...planForm, hijriMonth: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">السنة الهجرية</label>
                  <input
                    type="text"
                    value={planForm.hijriYear}
                    onChange={e => setPlanForm({ ...planForm, hijriYear: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">بداية الخطة</label>
                  <input
                    type="text"
                    value={planForm.startDateHijri}
                    onChange={e => setPlanForm({ ...planForm, startDateHijri: e.target.value })}
                    placeholder="مثال: ٣٠ ربيع الآخر"
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">نهاية الخطة</label>
                  <input
                    type="text"
                    value={planForm.endDateHijri}
                    onChange={e => setPlanForm({ ...planForm, endDateHijri: e.target.value })}
                    placeholder="مثال: ٢٩ جمادى الأولى"
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">الاختبار الشهري</label>
                  <input
                    type="text"
                    value={planForm.examDateHijri}
                    onChange={e => setPlanForm({ ...planForm, examDateHijri: e.target.value })}
                    placeholder="مثال: ٢٥ جمادى الأولى"
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">تخصيص يوم الخميس</label>
                <input
                  type="text"
                  value={planForm.thursdayFocus}
                  onChange={e => setPlanForm({ ...planForm, thursdayFocus: e.target.value })}
                  placeholder="مخصص للتحديات والمراجعة الثنائية بحسب التحدي المعتمد"
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPlanModalOpen(false)}
                  className="px-4 py-2 text-stone-600 text-xs rounded-xl hover:bg-stone-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#8E5364] text-white text-xs font-bold rounded-xl hover:bg-[#744251]"
                >
                  حفظ الخطة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
