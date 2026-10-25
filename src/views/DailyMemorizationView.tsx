import React, { useState, useMemo } from 'react';
import { 
  BookOpen, CheckCircle2, AlertCircle, Save, 
  Calendar, Award, PenTool, Check, RotateCcw
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DailyRecord, Student, Circle, RevisionPortion } from '../types';
import { SignaturePad } from '../components/SignaturePad';

// قائمة سور القرآن الكريم
const QURAN_SURAHS = [
  "الفاتحة", "البقرة", "آل عمران", "النساء", "المائدة", "الأنعام", "الأعراف", "الأنفال", "التوبة", "يونس",
  "هود", "يوسف", "الرعد", "إبراهيم", "الحجر", "النحل", "الإسراء", "الكهف", "مريم", "طه",
  "الأنبياء", "الحج", "المؤمنون", "النور", "الفرقان", "الشعراء", "النمل", "القصص", "العنكبوت", "الروم",
  "لقمان", "السجدة", "الأحزاب", "سبأ", "فاطر", "يس", "الصافات", "ص", "الزمر", "غافر",
  "فصلت", "الشورى", "الزخرف", "الدخان", "الجاثية", "الأحقاف", "محمد", "الفتح", "الحجرات", "ق",
  "الذاريات", "الطور", "النجم", "القمر", "الرحمن", "الواقعة", "الحديد", "المجادلة", "الحشر", "الممتحنة",
  "الصف", "الجمعة", "المنافقون", "التغابن", "الطلاق", "التحريم", "الملك", "القلم", "الحاقة", "المعارج",
  "نوح", "الجن", "المزمل", "المدثر", "القيامة", "الإنسان", "المرسلات", "النبأ", "النازعات", "عبس",
  "التكوير", "الانفطار", "المطففين", "الانشقاق", "البروج", "الطارق", "الأعلى", "الغاشية", "الفجر", "البلد",
  "الشمس", "الليل", "الضحى", "الشرح", "التين", "العلق", "القدر", "البينة", "الزلزلة", "العاديات",
  "القارعة", "التكاثر", "العصر", "الهمزة", "الفيل", "قريش", "الماعون", "الكوثر", "الكافرون", "النصر",
  "المسد", "الإخلاص", "الفلق", "الناس"
];

export const DailyMemorizationView: React.FC = () => {
  const { 
    students, circles, tracks, dailyRecords, saveDailyRecord,
    currentUser, settings
  } = useApp();

  const [selectedCircleId, setSelectedCircleId] = useState<string>(circles[0]?.id || '');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [showSigPad, setShowSigPad] = useState(false);

  // تصفية الحلقات حسب صلاحيات المستخدم
  const availableCircles = useMemo(() => {
    if (currentUser?.role === 'leader') return circles.filter(c => !c.isArchived);
    if (currentUser?.role === 'supervisor') return circles.filter(c => c.supervisorId === currentUser.id && !c.isArchived);
    return circles.filter(c => c.teacherId === currentUser?.id && !c.isArchived);
  }, [circles, currentUser]);

  const activeCircle = circles.find(c => c.id === selectedCircleId);
  const activeTrack = tracks.find(t => t.id === activeCircle?.trackId);
  const masteryConfig = activeTrack?.systemRules?.masteryGuide;

  // طالبات الحلقة المحددة
  const circleStudents = useMemo(() => {
    return students.filter(s => s.circleId === selectedCircleId && s.status === 'active');
  }, [students, selectedCircleId]);

  // حالة نموذج الرصد
  const [formData, setFormData] = useState<Partial<DailyRecord>>({
    newMemorizationCompleted: true,
    newMemorizationPages: 1,
    revisionCompleted: true,
    revisionPages: 2,
    recitationScore: 10,
    memorizationMistakes: 0,
    hintsCount: 0,
    tajweedErrorsCount: 0,
    conditions: {
      listenedToReader: true,
      recitedLooking: true,
      masteryRepetition: true,
      minorRevision: true,
      tamkeenRevision: true,
      achievedDistinction: false
    },
    minorRevisionPortion: {
      surahNumber: 2,
      fromAyah: 1,
      toAyah: 25,
      status: 'excellent'
    },
    tamkeenRevisionPortion: {
      surahNumber: 2,
      fromAyah: 26,
      toAyah: 50,
      pagesCount: 2,
      status: 'excellent'
    },
    notes: '',
    status: 'completed'
  });

  const openStudentModal = (st: Student) => {
    setActiveStudentId(st.id);
    const existing = dailyRecords.find(d => d.studentId === st.id && d.date === selectedDate);
    if (existing) {
      setFormData(existing);
    } else {
      setFormData({
        studentId: st.id,
        circleId: st.circleId,
        date: selectedDate,
        newMemorizationCompleted: true,
        newMemorizationPages: 1,
        revisionCompleted: true,
        revisionPages: 2,
        recitationScore: 10,
        memorizationMistakes: 0,
        hintsCount: 0,
        tajweedErrorsCount: 0,
        conditions: {
          listenedToReader: true,
          recitedLooking: true,
          masteryRepetition: true,
          minorRevision: true,
          tamkeenRevision: true,
          achievedDistinction: false
        },
        minorRevisionPortion: {
          surahNumber: 2,
          fromAyah: 1,
          toAyah: 25,
          status: 'excellent'
        },
        tamkeenRevisionPortion: {
          surahNumber: 2,
          fromAyah: 26,
          toAyah: 50,
          pagesCount: 2,
          status: 'excellent'
        },
        notes: '',
        status: 'completed'
      });
    }
  };

  const handleSave = async () => {
    if (!activeStudentId) return;
    await saveDailyRecord({
      ...formData,
      studentId: activeStudentId,
      circleId: selectedCircleId,
      date: selectedDate
    });
    setActiveStudentId(null);
  };

  return (
    <div className="space-y-6 text-right pb-12" dir="rtl">
      {/* رأس شاشة التسميع والفلترة */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-stone-900 p-6 rounded-3xl border border-[#E2D5CC] dark:border-stone-800 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#8E5364]" />
            سجل التسميع والمراجعة اليومية
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            رصد الحفظ الجديد، وتفاصيل المراجعة الصغرى والتمكين وفق معايير دليل الإتقان
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-[#FAF7F5] dark:bg-stone-800 px-3 py-1.5 rounded-2xl border border-stone-200 dark:border-stone-700">
            <Calendar className="w-4 h-4 text-stone-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-stone-700 dark:text-stone-200 outline-hidden"
            />
          </div>

          <select
            value={selectedCircleId}
            onChange={e => setSelectedCircleId(e.target.value)}
            className="bg-[#FAF7F5] dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 rounded-2xl px-3 py-2 text-xs font-bold"
          >
            {availableCircles.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* قائمة طالبات الحلقة وجدول الرصد */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl border border-[#E2D5CC] dark:border-stone-800 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs text-stone-500">
          <span>الحلقة: <strong className="text-stone-800 dark:text-stone-200">{activeCircle?.name || 'غير محدد'}</strong></span>
          <span>المسار: <strong className="text-[#8E5364] dark:text-[#E8BDC8]">{activeTrack?.name || 'غير محدد'}</strong></span>
        </div>

        <div className="divide-y divide-stone-100 dark:divide-stone-800">
          {circleStudents.map(st => {
            const rec = dailyRecords.find(d => d.studentId === st.id && d.date === selectedDate);
            const isRecorded = !!rec;

            return (
              <div key={st.id} className="p-4 flex items-center justify-between hover:bg-[#FAF7F5] dark:hover:bg-stone-800/40 transition">
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    isRecorded ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-stone-100 text-stone-500 dark:bg-stone-800'
                  }`}>
                    {st.name.charAt(0)}
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-stone-800 dark:text-stone-100">{st.name}</h4>
                    <p className="text-[11px] text-stone-400 font-mono">{st.code}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {isRecorded ? (
                    <div className="text-left text-xs">
                      <span className="font-bold text-emerald-600 block">درجة التسميع: {rec.recitationScore}/10</span>
                      <span className="text-[10px] text-stone-400">
                        صغرى: سورة {QURAN_SURAHS[(rec.minorRevisionPortion?.surahNumber || 1) - 1] || 'محددة'}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-stone-400">لم يُرصد اليوم</span>
                  )}

                  <button
                    onClick={() => openStudentModal(st)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                      isRecorded 
                        ? 'bg-[#FAF7F5] dark:bg-stone-800 text-stone-700 dark:text-stone-200 border border-stone-200 dark:border-stone-700' 
                        : 'bg-[#8E5364] text-white hover:bg-[#744251]'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    {isRecorded ? 'تعديل الرصد' : 'رصد التسميع'}
                  </button>
                </div>
              </div>
            );
          })}

          {circleStudents.length === 0 && (
            <div className="p-12 text-center text-stone-400 text-xs">
              لا توجد طالبات مقيدات في هذه الحلقة حالياً.
            </div>
          )}
        </div>
      </div>

      {/* نافذة الرصد اليومي الشاملة للطالبة */}
      {activeStudentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-stone-900 border border-[#E2D5CC] dark:border-stone-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl text-right" dir="rtl">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-stone-800 dark:text-stone-100">
                  رصد تسميع: {students.find(s => s.id === activeStudentId)?.name}
                </h3>
                <span className="text-[11px] text-stone-500 font-mono">{selectedDate}</span>
              </div>
              <span className="text-xs bg-[#FAF7F5] dark:bg-stone-800 text-[#8E5364] px-2.5 py-1 rounded-full font-bold">
                {activeTrack?.name}
              </span>
            </div>

            <div className="space-y-4 text-xs">
              {/* قسم 1: الحفظ الجديد */}
              <div className="p-4 rounded-2xl bg-[#FAF7F5] dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700 space-y-3">
                <span className="font-bold text-stone-800 dark:text-stone-100 block">📖 الحفظ الجديد:</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[11px] text-stone-500 mb-1">الدرجة المستحقة (من 10)</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={formData.recitationScore ?? 10}
                      onChange={e => setFormData({ ...formData, recitationScore: Number(e.target.value) })}
                      className="w-full bg-white dark:bg-stone-900 border border-stone-200 rounded-xl p-2 font-bold text-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-stone-500 mb-1">أوجه الحفظ</label>
                    <input
                      type="number"
                      value={formData.newMemorizationPages ?? 1}
                      onChange={e => setFormData({ ...formData, newMemorizationPages: Number(e.target.value) })}
                      className="w-full bg-white dark:bg-stone-900 border border-stone-200 rounded-xl p-2"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-stone-500 mb-1">أخطاء الحفظ</label>
                    <input
                      type="number"
                      value={formData.memorizationMistakes ?? 0}
                      onChange={e => setFormData({ ...formData, memorizationMistakes: Number(e.target.value) })}
                      className="w-full bg-white dark:bg-stone-900 border border-stone-200 rounded-xl p-2"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-stone-500 mb-1">أخطاء التجويد</label>
                    <input
                      type="number"
                      value={formData.tajweedErrorsCount ?? 0}
                      onChange={e => setFormData({ ...formData, tajweedErrorsCount: Number(e.target.value) })}
                      className="w-full bg-white dark:bg-stone-900 border border-stone-200 rounded-xl p-2"
                    />
                  </div>
                </div>
              </div>

              {/* قسم 2: خانات المراجعة الصغرى المستقلة */}
              <div className="p-4 rounded-2xl bg-[#FAF7F5] dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700 space-y-3">
                <span className="font-bold text-[#8E5364] dark:text-[#E8BDC8] block">🔄 المراجعة الصغرى (الربط القريب):</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] text-stone-500 mb-1">السورة</label>
                    <select
                      value={formData.minorRevisionPortion?.surahNumber || 2}
                      onChange={e => setFormData({
                        ...formData,
                        minorRevisionPortion: {
                          ...(formData.minorRevisionPortion || { fromAyah: 1, toAyah: 10, status: 'excellent' }),
                          surahNumber: Number(e.target.value)
                        }
                      })}
                      className="w-full bg-white dark:bg-stone-900 border border-stone-200 rounded-xl p-2"
                    >
                      {QURAN_SURAHS.map((sName, idx) => (
                        <option key={idx} value={idx + 1}>{idx + 1}. سورة {sName}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-stone-500 mb-1">من آية</label>
                    <input
                      type="number"
                      value={formData.minorRevisionPortion?.fromAyah || 1}
                      onChange={e => setFormData({
                        ...formData,
                        minorRevisionPortion: {
                          ...(formData.minorRevisionPortion || { surahNumber: 2, toAyah: 10, status: 'excellent' }),
                          fromAyah: Number(e.target.value)
                        }
                      })}
                      className="w-full bg-white dark:bg-stone-900 border border-stone-200 rounded-xl p-2"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-stone-500 mb-1">إلى آية</label>
                    <input
                      type="number"
                      value={formData.minorRevisionPortion?.toAyah || 25}
                      onChange={e => setFormData({
                        ...formData,
                        minorRevisionPortion: {
                          ...(formData.minorRevisionPortion || { surahNumber: 2, fromAyah: 1, status: 'excellent' }),
                          toAyah: Number(e.target.value)
                        }
                      })}
                      className="w-full bg-white dark:bg-stone-900 border border-stone-200 rounded-xl p-2"
                    />
                  </div>
                </div>
              </div>

              {/* قسم 3: خانات مراجعة التمكين المستقلة */}
              <div className="p-4 rounded-2xl bg-[#FAF7F5] dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700 space-y-3">
                <span className="font-bold text-emerald-700 dark:text-emerald-400 block">✨ مراجعة التمكين (المراجعة الكبرى):</span>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[11px] text-stone-500 mb-1">السورة</label>
                    <select
                      value={formData.tamkeenRevisionPortion?.surahNumber || 2}
                      onChange={e => setFormData({
                        ...formData,
                        tamkeenRevisionPortion: {
                          ...(formData.tamkeenRevisionPortion || { fromAyah: 1, toAyah: 50, pagesCount: 2, status: 'excellent' }),
                          surahNumber: Number(e.target.value)
                        }
                      })}
                      className="w-full bg-white dark:bg-stone-900 border border-stone-200 rounded-xl p-2"
                    >
                      {QURAN_SURAHS.map((sName, idx) => (
                        <option key={idx} value={idx + 1}>{idx + 1}. سورة {sName}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-stone-500 mb-1">من آية</label>
                    <input
                      type="number"
                      value={formData.tamkeenRevisionPortion?.fromAyah || 1}
                      onChange={e => setFormData({
                        ...formData,
                        tamkeenRevisionPortion: {
                          ...(formData.tamkeenRevisionPortion || { surahNumber: 2, toAyah: 50, pagesCount: 2, status: 'excellent' }),
                          fromAyah: Number(e.target.value)
                        }
                      })}
                      className="w-full bg-white dark:bg-stone-900 border border-stone-200 rounded-xl p-2"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-stone-500 mb-1">إلى آية</label>
                    <input
                      type="number"
                      value={formData.tamkeenRevisionPortion?.toAyah || 50}
                      onChange={e => setFormData({
                        ...formData,
                        tamkeenRevisionPortion: {
                          ...(formData.tamkeenRevisionPortion || { surahNumber: 2, fromAyah: 1, pagesCount: 2, status: 'excellent' }),
                          toAyah: Number(e.target.value)
                        }
                      })}
                      className="w-full bg-white dark:bg-stone-900 border border-stone-200 rounded-xl p-2"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-stone-500 mb-1">الأوجه المنجزة</label>
                    <input
                      type="number"
                      value={formData.tamkeenRevisionPortion?.pagesCount || 2}
                      onChange={e => setFormData({
                        ...formData,
                        tamkeenRevisionPortion: {
                          ...(formData.tamkeenRevisionPortion || { surahNumber: 2, fromAyah: 1, toAyah: 50, status: 'excellent' }),
                          pagesCount: Number(e.target.value)
                        }
                      })}
                      className="w-full bg-white dark:bg-stone-900 border border-stone-200 rounded-xl p-2"
                    />
                  </div>
                </div>
              </div>

              {/* قسم 4: معايير دليل مشكاة الغيم (ديناميكية حسب المسار) */}
              <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-2">
                <span className="font-bold text-stone-800 dark:text-stone-100 block mb-1">معايير التحضير والإتقان:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 p-2 rounded-xl bg-[#FAF7F5] dark:bg-stone-800/40 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.conditions?.listenedToReader}
                      onChange={e => setFormData({
                        ...formData,
                        conditions: { ...formData.conditions!, listenedToReader: e.target.checked }
                      })}
                      className="accent-[#8E5364]"
                    />
                    <span>الاستماع للمقرئ ({masteryConfig?.listenToReciterTimes || 3} مرات)</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-xl bg-[#FAF7F5] dark:bg-stone-800/40 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.conditions?.recitedLooking}
                      onChange={e => setFormData({
                        ...formData,
                        conditions: { ...formData.conditions!, recitedLooking: e.target.checked }
                      })}
                      className="accent-[#8E5364]"
                    />
                    <span>التلاوة نظراً من المصحف ({masteryConfig?.reciteLookingTimes || 5} مرات)</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-xl bg-[#FAF7F5] dark:bg-stone-800/40 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.conditions?.masteryRepetition}
                      onChange={e => setFormData({
                        ...formData,
                        conditions: { ...formData.conditions!, masteryRepetition: e.target.checked }
                      })}
                      className="accent-[#8E5364]"
                    />
                    <span>التكرار المتقن للوجه ({masteryConfig?.masteryRepetitionTimes || 20} مرة)</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-xl bg-[#FAF7F5] dark:bg-stone-800/40 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.conditions?.achievedDistinction}
                      onChange={e => setFormData({
                        ...formData,
                        conditions: { ...formData.conditions!, achievedDistinction: e.target.checked }
                      })}
                      className="accent-[#8E5364]"
                    />
                    <span className="font-bold text-[#8E5364] dark:text-[#E8BDC8]">نيل وسام التميز لليوم ⭐</span>
                  </label>
                </div>
              </div>

              {/* قسم 5: توقيع المعلمة للاعتماد */}
              <div className="pt-2 border-t border-stone-100 dark:border-stone-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-stone-700 dark:text-stone-300">توقيع المعلمة المعتمدة</span>
                  <button
                    type="button"
                    onClick={() => setShowSigPad(!showSigPad)}
                    className="text-[11px] text-[#8E5364] flex items-center gap-1 font-bold"
                  >
                    <PenTool className="w-3 h-3" />
                    {showSigPad ? 'إغلاق لوحة التوقيع' : 'توقيع يدوي'}
                  </button>
                </div>

                {showSigPad && (
                  <div className="flex justify-center my-2">
                    <SignaturePad
                      onSave={(dataUrl) => {
                        setFormData({ ...formData, signatureUrl: dataUrl });
                        setShowSigPad(false);
                      }}
                      title="توقيع المعلمة على التسميع"
                    />
                  </div>
                )}

                {formData.signatureUrl && !showSigPad && (
                  <div className="flex items-center gap-3 p-2 bg-[#FAF7F5] dark:bg-stone-800 rounded-xl">
                    <img src={formData.signatureUrl} alt="توقيع المعلمة" className="h-8 bg-white border border-stone-200 rounded-md" />
                    <span className="text-[10px] text-emerald-600 font-bold">تم اعتماد التوقيع لهذا اليوم ✅</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-stone-100 dark:border-stone-800">
              <button
                onClick={handleSave}
                className="flex-1 py-2.5 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                حفظ واعتماد التسميع
              </button>
              <button
                onClick={() => setActiveStudentId(null)}
                className="px-4 py-2.5 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-xl text-xs font-bold"
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