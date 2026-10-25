import React, { useState, useMemo } from 'react';
import { 
  BookOpen, Calendar, Clock, CheckCircle2, AlertCircle, 
  Search, Award, Edit3, X, Check, PenTool, Sparkles 
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SignaturePad } from '../components/SignaturePad';

const QURAN_SURAHS = [
  '1. الفاتحة', '2. البقرة', '3. آل عمران', '4. النساء', '5. المائدة',
  '6. الأنعام', '7. الأعراف', '8. الأنفال', '9. التوبة', '10. يونس',
  '11. هود', '12. يوسف', '13. الرعد', '14. إبراهيم', '15. الحجر',
  '16. النحل', '17. الإسراء', '18. الكهف', '19. مريم', '20. طه',
  '21. الأنبياء', '22. الحج', '23. المؤمنون', '24. النور', '25. الفرقان',
  '26. الشعراء', '27. النمل', '28. القصص', '29. العنكبوت', '30. الروم',
  '31. لقمان', '32. السجدة', '33. الأحزاب', '34. سبأ', '35. فاطر',
  '36. يس', '37. الصافات', '38. ص', '39. الزمر', '40. غافر',
  '41. فصلت', '42. الشورى', '43. الزخرف', '44. الدخان', '45. الجاثية',
  '46. الأحقاف', '47. محمد', '48. الفتح', '49. الحجرات', '50. ق',
  '51. الذاريات', '52. الطور', '53. النجم', '54. القمر', '55. الرحمن',
  '56. الواقعة', '57. الحديد', '58. المجادلة', '59. الحشر', '60. الممتحنة',
  '61. الصف', '62. الجمعة', '63. المنافقون', '64. التغابن', '65. الطلاق',
  '66. التحريم', '67. الملك', '68. القلم', '69. الحاقة', '70. المعارج',
  '71. نوح', '72. الجن', '73. المزمل', '74. المدثر', '75. القيامة',
  '76. الإنسان', '77. المرسلات', '78. النبأ', '79. النازعات', '80. عبس',
  '81. التكوير', '82. الانفطار', '83. المطففين', '84. الانشقاق', '85. البروج',
  '86. الطارق', '87. الأعلى', '88. الغاشية', '89. الفجر', '90. البلد',
  '91. الشمس', '92. الليل', '93. الضحى', '94. الشرح', '95. التين',
  '96. العلق', '97. القدر', '98. البينة', '99. الزلزلة', '100. العاديات',
  '101. القارعة', '102. التكاثر', '103. العصر', '104. الهمزة', '105. الفيل',
  '106. قريش', '107. الماعون', '108. الكوثر', '109. الكافرون', '110. النصر',
  '111. المسد', '112. الإخلاص', '113. الفلق', '114. الناس'
];

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
  const [activeModalStudentId, setActiveModalStudentId] = useState<string | null>(null);
  const [showSigPad, setShowSigPad] = useState(false);

  // نموذج الرصد الكامل
  const [form, setForm] = useState({
    // قسم الحفظ الجديد (مطابق للصورة)
    hifzErrors: 0,
    alerts: 0,
    tajweedErrors: 0,
    recitedPortion: '',
    notes: '',

    // المراجعة الصغرى (الربط القريب)
    minorSurah: '2. سورة البقرة',
    minorFromAyah: '1',
    minorToAyah: '25',
    minorDone: true,

    // مراجعة التمكين (المراجعة الكبرى)
    majorSurah: '11. سورة هود',
    majorFromAyah: '36',
    majorToAyah: '50',
    majorPages: 2,
    majorDone: true,

    // معايير التحضير والإتقان
    criteriaListen: true,
    criteriaRecite: true,
    criteriaRepeat: true,
    hasMedal: false,

    // توقيع المعلمة
    signatureUrl: ''
  });

  // ثوابت الخصم من نظام المعايير
  const baseScore = settings?.gradingRules?.recitationBaseScore ?? 10;
  const hifzDeduction = settings?.gradingRules?.hifzErrorDeduction ?? 0.5;
  const alertDeduction = settings?.gradingRules?.alertDeduction ?? 0.25;
  const tajweedDeduction = settings?.gradingRules?.tajweedErrorDeduction ?? 0.25;

  // الحساب الفوري التلقائي للدرجة النهائية (من 10)
  const calculatedNewScore = useMemo(() => {
    const totalDeductions = 
      (Number(form.hifzErrors || 0) * hifzDeduction) +
      (Number(form.alerts || 0) * alertDeduction) +
      (Number(form.tajweedErrors || 0) * tajweedDeduction);
    
    return Math.max(0, Math.round((baseScore - totalDeductions) * 100) / 100);
  }, [form.hifzErrors, form.alerts, form.tajweedErrors, baseScore, hifzDeduction, alertDeduction, tajweedDeduction]);

  // تصفية الطالبات
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
  const modalStudent = students.find(s => s.id === activeModalStudentId);
  const modalTrack = tracks.find(t => t.id === modalStudent?.trackId) || tracks[0];

  const handleOpenModal = (studentId: string) => {
    const existing = (dailyRecitations || []).find(
      r => r.studentId === studentId && r.date === selectedDate
    );

    if (existing) {
      setForm({
        hifzErrors: existing.hifzErrors || 0,
        alerts: existing.alerts || 0,
        tajweedErrors: existing.tajweedErrors || 0,
        recitedPortion: existing.recitedPortion || existing.surahFrom || '',
        notes: existing.notes || '',
        minorSurah: existing.minorSurah || '2. سورة البقرة',
        minorFromAyah: existing.minorFromAyah || '1',
        minorToAyah: existing.minorToAyah || '25',
        minorDone: existing.minorDone ?? true,
        majorSurah: existing.majorSurah || '11. سورة هود',
        majorFromAyah: existing.majorFromAyah || '36',
        majorToAyah: existing.majorToAyah || '50',
        majorPages: existing.majorPages || 2,
        majorDone: existing.majorDone ?? true,
        criteriaListen: existing.criteriaListen ?? true,
        criteriaRecite: existing.criteriaRecite ?? true,
        criteriaRepeat: existing.criteriaRepeat ?? true,
        hasMedal: existing.hasMedal ?? false,
        signatureUrl: existing.signatureUrl || ''
      });
    } else {
      setForm({
        hifzErrors: 0,
        alerts: 0,
        tajweedErrors: 0,
        recitedPortion: '',
        notes: '',
        minorSurah: '2. سورة البقرة',
        minorFromAyah: '1',
        minorToAyah: '25',
        minorDone: true,
        majorSurah: '11. سورة هود',
        majorFromAyah: '36',
        majorToAyah: '50',
        majorPages: 2,
        majorDone: true,
        criteriaListen: true,
        criteriaRecite: true,
        criteriaRepeat: true,
        hasMedal: false,
        signatureUrl: ''
      });
    }
    setShowSigPad(false);
    setActiveModalStudentId(studentId);
  };

  const handleSaveRecitation = async () => {
    if (!activeModalStudentId) return;

    await saveDailyRecitation({
      studentId: activeModalStudentId,
      date: selectedDate,
      circleId: selectedCircleId,
      score: calculatedNewScore,
      maxScore: baseScore,
      ...form,
      surahFrom: form.recitedPortion,
      evaluatorId: currentUser?.id,
      evaluatorName: currentUser?.name
    });

    setActiveModalStudentId(null);
  };

  return (
    <div className="space-y-6 text-right pb-12" dir="rtl">
      {/* شريط رأس الصفحة */}
      <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl border border-[#E2D5CC] dark:border-stone-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">📖</span>
            <h1 className="text-xl font-bold text-stone-800 dark:text-stone-100 font-quran">
              سجل التسميع والمراجعة اليومية
            </h1>
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            رصد الحفظ الجديد، وتفاصيل المراجعة الصغرى والتمكين وفق معايير دليل الإتقان
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

      {/* قائمة الطالبات */}
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
                        <span>درجة الحفظ: <strong className="text-[#8E5364] font-bold">{record.score}/10</strong></span>
                        <span className="mx-1.5">•</span>
                        <span>أخطاء: <strong className="text-rose-600">{record.hifzErrors ?? 0}</strong></span>
                        <span className="mx-1.5">•</span>
                        <span>تنبيهات: <strong className="text-amber-600">{record.alerts ?? 0}</strong></span>
                      </div>
                      <div className="px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                        تم الرصد ✅
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

      {/* النافذة المنبثقة لرصد التسميع اليومي */}
      {activeModalStudentId && modalStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#1A1A1E] border border-[#E2D5CC] dark:border-stone-800 rounded-3xl w-full max-w-xl max-h-[92vh] overflow-y-auto p-6 space-y-5 shadow-2xl text-right" dir="rtl">
            
            {/* رأس النافذة */}
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 font-quran">
                  رصد تسميع: {modalStudent.name}
                </h3>
                <span className="text-[11px] text-stone-400 font-mono">{selectedDate}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-500 font-bold">
                  {modalTrack?.name || 'مشكاة الغيم للحفظ'}
                </span>
                <button 
                  onClick={() => setActiveModalStudentId(null)}
                  className="p-1 rounded-xl text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* ===================== قسم الحفظ الجديد (مطابق للصورة تماماً) ===================== */}
            <div className="p-4 rounded-3xl bg-[#FAF7F5] dark:bg-stone-900/60 border border-[#E2D5CC] dark:border-stone-800 space-y-4">
              
              {/* صندوق الدرجة النهائية المحصلة (من 10) */}
              <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-[#EAE2DC] dark:border-stone-800 text-center space-y-1 shadow-2xs">
                <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
                  الدرجة النهائية المحصلة (من 10):
                </span>
                <div className="text-4xl font-extrabold text-[#744251] dark:text-[#E8BDC8] font-mono tracking-tight pt-1">
                  {calculatedNewScore}
                </div>
                <span className="text-[11px] text-stone-400 block pt-0.5">
                  تُحسب تلقائياً وفق معادلة الخصم المعتمدة في نظام المعايير
                </span>
              </div>

              {/* حقول الأخطاء الثلاثة (حفظ - تنبيهات - تجويد) */}
              <div className="grid grid-cols-3 gap-2.5 text-center">
                {/* أخطاء الحفظ */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-rose-700 dark:text-rose-400">
                    أخطاء حفظ (-{hifzDeduction})
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.hifzErrors}
                    onChange={e => setForm({ ...form, hifzErrors: Math.max(0, Number(e.target.value)) })}
                    className="w-full text-center py-2.5 border-2 border-rose-200 dark:border-rose-900/60 bg-white dark:bg-stone-900 rounded-2xl text-base font-bold text-stone-900 dark:text-stone-100 outline-hidden focus:border-rose-500 shadow-2xs"
                  />
                </div>

                {/* التنبيهات */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-amber-700 dark:text-amber-400">
                    تنبيهات (-{alertDeduction})
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.alerts}
                    onChange={e => setForm({ ...form, alerts: Math.max(0, Number(e.target.value)) })}
                    className="w-full text-center py-2.5 border-2 border-amber-200 dark:border-amber-900/60 bg-white dark:bg-stone-900 rounded-2xl text-base font-bold text-stone-900 dark:text-stone-100 outline-hidden focus:border-amber-500 shadow-2xs"
                  />
                </div>

                {/* تجويد */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-purple-700 dark:text-purple-400">
                    تجويد (-{tajweedDeduction})
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.tajweedErrors}
                    onChange={e => setForm({ ...form, tajweedErrors: Math.max(0, Number(e.target.value)) })}
                    className="w-full text-center py-2.5 border-2 border-purple-200 dark:border-purple-900/60 bg-white dark:bg-stone-900 rounded-2xl text-base font-bold text-stone-900 dark:text-stone-100 outline-hidden focus:border-purple-500 shadow-2xs"
                  />
                </div>
              </div>

              {/* خانة المقرر الذي تم تسميعه بالكتابة اليدوية */}
              <div className="space-y-1 pt-1">
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300">
                  المقرر الذي تم تسميعه:
                </label>
                <input
                  type="text"
                  placeholder="مثال: من سورة البقرة آية ١ إلى ٢٥"
                  value={form.recitedPortion}
                  onChange={e => setForm({ ...form, recitedPortion: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl text-xs text-stone-800 dark:text-stone-100 outline-hidden focus:ring-2 focus:ring-[#8E5364]"
                />
              </div>

              {/* خانة ملاحظات وتوجيهات للمعلمة */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300">
                  ملاحظات وتوجيهات للمعلمة (اختياري):
                </label>
                <textarea
                  rows={2}
                  placeholder="مثال: إتقان ممتاز مع الانتباه لمراتب الغنن..."
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="w-full p-2.5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl text-xs text-stone-800 dark:text-stone-100 outline-hidden resize-none focus:ring-2 focus:ring-[#8E5364]"
                />
              </div>
            </div>

            {/* ===================== المراجعة الصغرى (الربط القريب) ===================== */}
            <div className="p-4 rounded-2xl bg-[#FCFAF8] dark:bg-stone-900/60 border border-[#EFEAE5] dark:border-stone-800 space-y-3">
              <h4 className=
