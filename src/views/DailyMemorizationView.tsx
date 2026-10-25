import React, { useState, useMemo } from 'react';
import { 
  BookOpen, Calendar, Clock, CheckCircle2, AlertCircle, 
  Search, Award, Edit3, X, Check, Sparkles, ChevronDown 
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DailyRecitationRecord } from '../types';

export const DailyMemorizationView: React.FC = () => {
  const { 
    students, circles, tracks, currentUser, 
    dailyRecitations, saveDailyRecitation, settings 
  } = useApp();

  const [selectedCircleId, setSelectedCircleId] = useState<string>(circles[0]?.id || '');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [searchQuery, setSearchQuery] = useState('');

  // نافذة الرصد التلقائي
  const [activeModalStudentId, setActiveModalStudentId] = useState<string | null>(null);

  // حقول رصد الأخطاء التلقائية
  const [scoringForm, setScoringForm] = useState({
    hifzErrors: 0,
    alerts: 0,
    tajweedErrors: 0,
    notes: '',
    surahFrom: '',
    surahTo: '',
    passed: true
  });

  // استخراج معايير الخصم من إعدادات النظام إن وجدت أو الاعتماد على المعادلة المعتمدة
  const baseScore = settings?.gradingRules?.recitationBaseScore ?? 10;
  const hifzDeduction = settings?.gradingRules?.hifzErrorDeduction ?? 0.5;
  const alertDeduction = settings?.gradingRules?.alertDeduction ?? 0.25;
  const tajweedDeduction = settings?.gradingRules?.tajweedErrorDeduction ?? 0.25;
  const minScore = 0;

  // الحساب الرياضي التلقائي الفوري للدرجة النهائية
  const calculatedScore = useMemo(() => {
    const totalDeductions = 
      (scoringForm.hifzErrors * hifzDeduction) +
      (scoringForm.alerts * alertDeduction) +
      (scoringForm.tajweedErrors * tajweedDeduction);
    
    const finalScore = Math.max(minScore, baseScore - totalDeductions);
    return Math.round(finalScore * 100) / 100;
  }, [scoringForm.hifzErrors, scoringForm.alerts, scoringForm.tajweedErrors, baseScore, hifzDeduction, alertDeduction, tajweedDeduction]);

  // تصفية الطالبات التابعات للحلقة المحددة
  const circleStudents = useMemo(() => {
    let list = students.filter(s => s.status === 'active');
    if (selectedCircleId) {
      list = list.filter(s => s.circleId === selectedCircleId);
    }
    if (searchQuery.trim()) {
      list = list.filter(s => 
        s.name.includes(searchQuery) || (s.code && s.code.includes(searchQuery))
      );
    }
    return list;
  }, [students, selectedCircleId, searchQuery]);

  const selectedCircle = circles.find(c => c.id === selectedCircleId);

  // فتح نافذة الرصد للطالبة
  const handleOpenModal = (studentId: string) => {
    const existing = (dailyRecitations || []).find(
      r => r.studentId === studentId && r.date === selectedDate
    );

    if (existing) {
      setScoringForm({
        hifzErrors: existing.hifzErrors ?? 0,
        alerts: existing.alerts ?? 0,
        tajweedErrors: existing.tajweedErrors ?? 0,
        notes: existing.notes || '',
        surahFrom: existing.surahFrom || '',
        surahTo: existing.surahTo || '',
        passed: existing.score >= (baseScore * 0.6)
      });
    } else {
      setScoringForm({
        hifzErrors: 0,
        alerts: 0,
        tajweedErrors: 0,
        notes: '',
        surahFrom: '',
        surahTo: '',
        passed: true
      });
    }
    setActiveModalStudentId(studentId);
  };

  // حفظ السجل بعد الحساب التلقائي
  const handleSaveRecitation = async () => {
    if (!activeModalStudentId) return;

    await saveDailyRecitation({
      studentId: activeModalStudentId,
      date: selectedDate,
      circleId: selectedCircleId,
      score: calculatedScore,
      maxScore: baseScore,
      hifzErrors: scoringForm.hifzErrors,
      alerts: scoringForm.alerts,
      tajweedErrors: scoringForm.tajweedErrors,
      notes: scoringForm.notes,
      surahFrom: scoringForm.surahFrom,
      surahTo: scoringForm.surahTo,
      evaluatorId: currentUser?.id,
      evaluatorName: currentUser?.name
    });

    setActiveModalStudentId(null);
  };

  const modalStudent = students.find(s => s.id === activeModalStudentId);

  return (
    <div className="space-y-6 text-right pb-12" dir="rtl">
      {/* رأس الصفحة مع المحددات */}
      <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl border border-[#E2D5CC] dark:border-stone-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">📖</span>
            <h1 className="text-xl font-bold text-stone-800 dark:text-stone-100 font-quran">
              سجل التسميع والمراجعة اليومية
            </h1>
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            رصد التسميع اليومي بحساب آلي فوري يربط الأخطاء والتنبيهات مباشرة بمعايير الدرجات
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-[#FAF7F5] dark:bg-stone-800 px-3 py-2 rounded-2xl border border-[#E2D5CC] dark:border-stone-700">
            <Calendar className="w-4 h-4 text-stone-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-stone-800 dark:text-stone-100 outline-hidden cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-[#FAF7F5] dark:bg-stone-800 px-3 py-2 rounded-2xl border border-[#E2D5CC] dark:border-stone-700">
            <select
              value={selectedCircleId}
              onChange={e => setSelectedCircleId(e.target.value)}
              className="bg-transparent text-xs font-bold text-stone-800 dark:text-stone-100 outline-hidden cursor-pointer"
            >
              {circles.map(c => (
                <option key={c.id} value={c.id} className="dark:bg-stone-900">
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* قائمة الطالبات للتسميع */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl border border-[#E2D5CC] dark:border-stone-800 overflow-hidden shadow-xs space-y-3">
        <div className="p-5 border-b border-stone-100 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm text-stone-800 dark:text-stone-100">
              طالبات حلقة ({selectedCircle?.name || 'المحددة'}) — تاريخ: {selectedDate}
            </h3>
            <span className="text-xs text-stone-500 mt-0.5 block">
              إجمالي طالبات الحلقة: {circleStudents.length} طالبة
            </span>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-stone-400 absolute right-3 top-2.5" />
            <input
              type="text"
              placeholder="بحث باسم الطالبة..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[#FAF7F5] dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl pr-9 pl-3 py-2 text-xs outline-hidden"
            />
          </div>
        </div>

        <div className="divide-y divide-stone-100 dark:divide-stone-800">
          {circleStudents.map(st => {
            const record = (dailyRecitations || []).find(
              r => r.studentId === st.id && r.date === selectedDate
            );

            return (
              <div 
                key={st.id} 
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-stone-50/50 dark:hover:bg-stone-800/30 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#FAF7F5] dark:bg-stone-800 flex items-center justify-center font-bold text-sm text-[#8E5364] dark:text-[#E8BDC8]">
                    {st.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-stone-900 dark:text-stone-100 text-sm">{st.name}</h4>
                    <span className="text-[11px] text-stone-400 font-mono">{st.code}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {record ? (
                    <div className="flex items-center gap-3 text-left">
                      <div className="text-xs text-stone-500 text-right">
                        <span>أخطاء: <strong className="text-rose-600">{record.hifzErrors ?? 0}</strong></span>
                        <span className="mx-1.5">•</span>
                        <span>تنبيهات: <strong className="text-amber-600">{record.alerts ?? 0}</strong></span>
                        <span className="mx-1.5">•</span>
                        <span>تجويد: <strong className="text-purple-600">{record.tajweedErrors ?? 0}</strong></span>
                      </div>
                      <div className="px-3.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                        {record.score} / {record.maxScore || 10}
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-stone-400">لم يُرصد التسميع اليوم</span>
                  )}

                  <button
                    onClick={() => handleOpenModal(st.id)}
                    className="px-4 py-2 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{record ? 'تعديل الرصد' : 'رصد التسميع'}</span>
                  </button>
                </div>
              </div>
            );
          })}

          {circleStudents.length === 0 && (
            <div className="p-8 text-center text-stone-400 text-xs">
              لا توجد طالبات في هذه الحلقة.
            </div>
          )}
        </div>
      </div>

      {/* نافذة الرصد الفوري الذكية (مطابقة للصورة تماماً) */}
      {activeModalStudentId && modalStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#1A1A1E] border border-[#E2D5CC] dark:border-stone-800 rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl text-right" dir="rtl">
            
            {/* عنوان النافذة */}
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 font-quran">
                  رصد التسميع اليومي
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                  للطالبة: <strong>{modalStudent.name}</strong> • تاريخ: {selectedDate}
                </p>
              </div>
              <button 
                onClick={() => setActiveModalStudentId(null)}
                className="p-1 rounded-xl text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* بطاقة الدرجة النهائية المحصلة التلقائية (مطابقة للصورة 100%) */}
            <div className="p-5 rounded-3xl bg-[#FAF7F5] dark:bg-[#141417] border border-[#EAE2DC] dark:border-stone-800 text-center space-y-1">
              <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
                الدرجة النهائية المحصلة (من {baseScore}):
              </span>
              <div className="text-4xl font-extrabold text-[#744251] dark:text-[#E8BDC8] font-mono tracking-tight pt-1">
                {calculatedScore}
              </div>
              <span className="text-[11px] text-stone-400 block pt-0.5">
                تُحسب تلقائياً وفق معادلة الخصم المعتمدة في نظام المعايير
              </span>
            </div>

            {/* حقول الأخطاء الثلاثة (حفظ - تنبيهات - تجويد) */}
            <div className="grid grid-cols-3 gap-2.5 pt-1 text-center">
              {/* أخطاء الحفظ */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-rose-700 dark:text-rose-400">
                  أخطاء حفظ (-{hifzDeduction})
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={scoringForm.hifzErrors}
                    onChange={e => setScoringForm({ ...scoringForm, hifzErrors: Math.max(0, Number(e.target.value)) })}
                    className="w-full text-center py-2.5 border-2 border-rose-200 dark:border-rose-900/60 bg-white dark:bg-stone-900 rounded-2xl text-base font-bold text-stone-900 dark:text-stone-100 outline-hidden focus:border-rose-500"
                  />
                </div>
              </div>

              {/* التنبيهات */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-amber-700 dark:text-amber-400">
                  تنبيهات (-{alertDeduction})
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={scoringForm.alerts}
                    onChange={e => setScoringForm({ ...scoringForm, alerts: Math.max(0, Number(e.target.value)) })}
                    className="w-full text-center py-2.5 border-2 border-amber-200 dark:border-amber-900/60 bg-white dark:bg-stone-900 rounded-2xl text-base font-bold text-stone-900 dark:text-stone-100 outline-hidden focus:border-amber-500"
                  />
                </div>
              </div>

              {/* أخطاء التجويد */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-purple-700 dark:text-purple-400">
                  تجويد (-{tajweedDeduction})
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={scoringForm.tajweedErrors}
                    onChange={e => setScoringForm({ ...scoringForm, tajweedErrors: Math.max(0, Number(e.target.value)) })}
                    className="w-full text-center py-2.5 border-2 border-purple-200 dark:border-purple-900/60 bg-white dark:bg-stone-900 rounded-2xl text-base font-bold text-stone-900 dark:text-stone-100 outline-hidden focus:border-purple-500"
                  />
                </div>
              </div>
            </div>

            {/* المقرر المسمع */}
            <div className="space-y-1 pt-1">
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300">
                المقرر الذي تم تسميعه:
              </label>
              <input
                type="text"
                placeholder="مثال: من سورة البقرة آية ١ إلى ٢٥"
                value={scoringForm.surahFrom}
                onChange={e => setScoringForm({ ...scoringForm, surahFrom: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-[#FAF7F5] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl text-xs text-stone-800 dark:text-stone-100 outline-hidden focus:ring-2 focus:ring-[#8E5364]"
              />
            </div>

            {/* ملاحظات المعلمة */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300">
                ملاحظات وتوجيهات للمعلمة (اختياري):
              </label>
              <textarea
                rows={2}
                placeholder="مثال: إتقان ممتاز مع الانتباه لمراتب الغنن..."
                value={scoringForm.notes}
                onChange={e => setScoringForm({ ...scoringForm, notes: e.target.value })}
                className="w-full p-2.5 bg-[#FAF7F5] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl text-xs text-stone-800 dark:text-stone-100 outline-hidden resize-none focus:ring-2 focus:ring-[#8E5364]"
              />
            </div>

            {/* أزرار الحفظ والإلغاء */}
            <div className="flex gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
              <button
                type="button"
                onClick={handleSaveRecitation}
                className="flex-1 py-3 bg-[#8E5364] hover:bg-[#744251] text-white rounded-2xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                اعتماد وحفظ الدرجة ({calculatedScore})
              </button>
              <button
                type="button"
                onClick={() => setActiveModalStudentId(null)}
                className="px-4 py-3 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-2xl text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
