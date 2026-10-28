import React, { useState, useMemo, useEffect } from 'react';
import { 
  BookOpen, Calendar, Clock, CheckCircle2, AlertCircle, 
  Search, Award, Edit3, X, Check, Sparkles, Plus, Minus,
  RotateCcw, Bookmark, ChevronLeft, Layers, Trash2, FileText, User
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { QURAN_SURAHS, SurahInfo } from '../data/quranData';
import { defaultMasteryGuideConfig, CustomMasteryCriterion, MasteryGuideConfig, Student } from '../types';

/**
 * دالة مساعدة لحساب عدد أوجه القرآن الكريم تقريبياً وبدقة
 * بناءً على رقم وبداية ونهاية السور والآيات
 */
export function calculatePortionPages(
  fromSurahNum: number,
  fromAyah: number,
  toSurahNum: number,
  toAyah: number
): number {
  if (!fromSurahNum || !toSurahNum) return 1;
  const s1 = QURAN_SURAHS.find(s => s.number === fromSurahNum);
  const s2 = QURAN_SURAHS.find(s => s.number === toSurahNum);
  if (!s1 || !s2) return 1;

  const getSurahEndPage = (num: number) => {
    const next = QURAN_SURAHS.find(s => s.number === num + 1);
    return next ? next.startPage : 604;
  };

  const s1EndPage = getSurahEndPage(fromSurahNum);
  const s1PagesTotal = Math.max(1, s1EndPage - s1.startPage);
  const clampedFromAyah = Math.max(1, Math.min(fromAyah || 1, s1.versesCount));

  if (fromSurahNum === toSurahNum) {
    const clampedToAyah = Math.max(clampedFromAyah, Math.min(toAyah || s1.versesCount, s1.versesCount));
    const versesSpan = clampedToAyah - clampedFromAyah + 1;
    const est = (versesSpan / s1.versesCount) * s1PagesTotal;
    const rounded = Math.round(est * 2) / 2;
    return Math.max(0.5, rounded);
  }

  if (fromSurahNum > toSurahNum) {
    return 1;
  }

  // عبر أكثر من سورة
  const s1RemVerses = s1.versesCount - clampedFromAyah + 1;
  const s1Pages = (s1RemVerses / s1.versesCount) * s1PagesTotal;

  let midPages = 0;
  for (let n = fromSurahNum + 1; n < toSurahNum; n++) {
    const mid = QURAN_SURAHS.find(s => s.number === n);
    if (mid) {
      midPages += Math.max(1, getSurahEndPage(n) - mid.startPage);
    }
  }

  const s2EndPage = getSurahEndPage(toSurahNum);
  const s2PagesTotal = Math.max(1, s2EndPage - s2.startPage);
  const clampedToAyah = Math.max(1, Math.min(toAyah || s2.versesCount, s2.versesCount));
  const s2Pages = (clampedToAyah / s2.versesCount) * s2PagesTotal;

  const total = s1Pages + midPages + s2Pages;
  return Math.max(0.5, Math.round(total * 2) / 2);
}

function formatPortionText(fromSurahNum: number, fromAyah: number, toSurahNum: number, toAyah: number): string {
  const s1 = QURAN_SURAHS.find(s => s.number === fromSurahNum);
  const s2 = QURAN_SURAHS.find(s => s.number === toSurahNum);
  if (!s1 || !s2) return '';
  if (fromSurahNum === toSurahNum) {
    return `سورة ${s1.name} (من آية ${fromAyah || 1} إلى آية ${toAyah || s1.versesCount})`;
  }
  return `من سورة ${s1.name} آية ${fromAyah || 1} إلى سورة ${s2.name} آية ${toAyah || s2.versesCount}`;
}

/**
 * مكوّن عداد تفاعلي بأزرار إضافة وإنقاص مع إمكانية الكتابة اليدوية
 */
interface CounterStepperProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  deductionNote?: string;
  variant?: 'danger' | 'warning' | 'purple' | 'primary' | 'emerald';
}

const CounterStepper: React.FC<CounterStepperProps> = ({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max = 999,
  unit,
  deductionNote,
  variant = 'primary'
}) => {
  const colorMap = {
    danger: {
      border: 'border-rose-200 dark:border-rose-900/60',
      text: 'text-rose-700 dark:text-rose-400',
      btnHover: 'hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-300'
    },
    warning: {
      border: 'border-amber-200 dark:border-amber-900/60',
      text: 'text-amber-700 dark:text-amber-400',
      btnHover: 'hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-700 dark:text-amber-300'
    },
    purple: {
      border: 'border-purple-200 dark:border-purple-900/60',
      text: 'text-purple-700 dark:text-purple-400',
      btnHover: 'hover:bg-purple-50 dark:hover:bg-purple-950/40 text-purple-700 dark:text-purple-300'
    },
    primary: {
      border: 'border-[#E2D5CC] dark:border-stone-700',
      text: 'text-[#8E5364] dark:text-[#E8BDC8]',
      btnHover: 'hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-200'
    },
    emerald: {
      border: 'border-emerald-200 dark:border-emerald-900/60',
      text: 'text-emerald-700 dark:text-emerald-400',
      btnHover: 'hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
    }
  };

  const currentStyle = colorMap[variant];

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className={`block text-xs font-bold ${currentStyle.text}`}>
          {label}
        </label>
        {deductionNote && (
          <span className="text-[10px] text-stone-400 font-mono">
            {deductionNote}
          </span>
        )}
      </div>

      <div className={`flex items-center border-2 ${currentStyle.border} bg-white dark:bg-stone-900 rounded-2xl overflow-hidden shadow-2xs`}>
        <button
          type="button"
          onClick={() => onChange(Math.max(min, Math.round((value - step) * 10) / 10))}
          className={`w-9 h-9 flex items-center justify-center transition active:scale-95 cursor-pointer select-none ${currentStyle.btnHover}`}
          title="إنقاص (-)"
        >
          <Minus className="w-4 h-4" />
        </button>

        <div className="flex-1 flex items-center justify-center gap-0.5">
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={e => {
              const parsed = parseFloat(e.target.value);
              onChange(isNaN(parsed) ? min : Math.max(min, Math.min(max, parsed)));
            }}
            className="w-12 text-center text-sm font-extrabold text-stone-900 dark:text-stone-100 bg-transparent outline-hidden"
          />
          {unit && <span className="text-[10px] text-stone-400 font-bold">{unit}</span>}
        </div>

        <button
          type="button"
          onClick={() => onChange(Math.min(max, Math.round((value + step) * 10) / 10))}
          className={`w-9 h-9 flex items-center justify-center transition active:scale-95 cursor-pointer select-none ${currentStyle.btnHover}`}
          title="إضافة (+)"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

interface DailyMemorizationViewProps {
  onSelectStudent?: (studentId: string) => void;
}

export const DailyMemorizationView: React.FC<DailyMemorizationViewProps> = ({
  onSelectStudent
}) => {
  const { 
    students, circles, tracks, currentUser, 
    dailyRecords, saveDailyRecord, settings,
    studentPlans, updateTrack, updateTrackSystemRules, showToast, allStudentScores
  } = useApp();

  const [selectedCircleId, setSelectedCircleId] = useState<string>(circles[0]?.id || '');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [activeModalStudentId, setActiveModalStudentId] = useState<string | null>(null);

  // حالة فتح كشف سجل الطالبة الشامل
  const [viewingStudentRecord, setViewingStudentRecord] = useState<Student | null>(null);

  const selectedCircle = circles.find(c => c.id === selectedCircleId);
  const modalStudent = students.find(s => s.id === activeModalStudentId);
  const modalTrack = tracks.find(t => t.id === modalStudent?.trackId) || tracks[0];

  // حساب بيانات كشف سجل الطالبة المحددة
  const studentRecords = useMemo(() => {
    if (!viewingStudentRecord) return [];
    return (dailyRecords || [])
      .filter(r => r.studentId === viewingStudentRecord.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [viewingStudentRecord, dailyRecords]);

  const studentCircle = useMemo(() => {
    if (!viewingStudentRecord) return null;
    return circles.find(c => c.id === viewingStudentRecord.circleId);
  }, [viewingStudentRecord, circles]);

  const studentTrack = useMemo(() => {
    if (!viewingStudentRecord) return null;
    return tracks.find(t => t.id === viewingStudentRecord.trackId) || tracks[0];
  }, [viewingStudentRecord, tracks]);

  const studentScore = useMemo(() => {
    if (!viewingStudentRecord) return null;
    return allStudentScores ? allStudentScores[viewingStudentRecord.id] : null;
  }, [viewingStudentRecord, allStudentScores]);

  const studentStats = useMemo(() => {
    if (!studentRecords.length) {
      return { totalPages: 0, avgScore: 10, totalSessions: 0, totalMistakes: 0 };
    }
    const totalPages = studentRecords.reduce((acc, r) => acc + (r.newMemorizationPages || 0), 0);
    const totalScore = studentRecords.reduce((acc, r) => acc + (r.recitationScore || 0), 0);
    const avgScore = Math.round((totalScore / studentRecords.length) * 10) / 10;
    const totalMistakes = studentRecords.reduce((acc, r) => acc + (r.memorizationMistakes || 0), 0);
    return {
      totalPages,
      avgScore,
      totalSessions: studentRecords.length,
      totalMistakes
    };
  }, [studentRecords]);

  const trackMastery: MasteryGuideConfig = modalTrack?.systemRules?.masteryGuide || settings?.defaultMasteryGuide || defaultMasteryGuideConfig;
  
  // معايير المسار موحدة بالكامل (كلها زي بعض بدون تقسيم أساسي وإضافي)
  const activeCriteriaList = useMemo(() => {
    if (trackMastery?.unifiedCriteria && trackMastery.unifiedCriteria.length > 0) {
      return trackMastery.unifiedCriteria;
    }
    const list: Array<{ id: string; title: string; count: number; unit: string }> = [
      { id: 'crit-listen', title: 'الاستماع للمقرئ', count: trackMastery?.listenToReciterTimes || 3, unit: 'مرات' },
      { id: 'crit-recite', title: 'التلاوة نظراً من المصحف', count: trackMastery?.reciteLookingTimes || 5, unit: 'مرات' },
      { id: 'crit-repeat', title: 'التكرار المتقن للوجه', count: trackMastery?.masteryRepetitionTimes || 20, unit: 'مرة' }
    ];
    if (trackMastery?.customCriteria && Array.isArray(trackMastery.customCriteria)) {
      trackMastery.customCriteria.forEach((c, i) => {
        list.push({
          id: c.id || `crit-custom-${i}`,
          title: c.title,
          count: c.count || 1,
          unit: c.unit || 'مرات'
        });
      });
    }
    return list;
  }, [trackMastery]);

  const [isEditingMastery, setIsEditingMastery] = useState(false);
  const [editingCriteriaList, setEditingCriteriaList] = useState<Array<{ id: string; title: string; count: number; unit: string }>>([]);
  const [newCritName, setNewCritName] = useState('');
  const [newCritTimes, setNewCritTimes] = useState(2);
  const [newCritUnit, setNewCritUnit] = useState('مرات');

  // أعداد المرات المنجزة يدويًا لكل معيار (مثلاً: تسمع مرة نحط 1 ومرتين نحط 2)
  const [criteriaCounts, setCriteriaCounts] = useState<Record<string, number>>({});

  const handleOpenMasteryEditor = () => {
    setEditingCriteriaList(activeCriteriaList.map(c => ({ ...c })));
    setIsEditingMastery(prev => !prev);
  };

  const handleSaveMasteryStandards = async () => {
    if (!modalTrack) return;
    try {
      const currentRules = modalTrack.systemRules || {
        earlyPreparation: true,
        atqiniHomeworkRequired: true,
        thursdayChallenges: true,
        customPlansAllowed: true,
        detailedWorkflowText: '',
        masteryGuide: { ...defaultMasteryGuideConfig }
      };

      const listenItem = editingCriteriaList.find(c => c.id === 'crit-listen' || c.title.includes('استماع'));
      const reciteItem = editingCriteriaList.find(c => c.id === 'crit-recite' || c.title.includes('نظراً'));
      const repeatItem = editingCriteriaList.find(c => c.id === 'crit-repeat' || c.title.includes('تكرار'));

      const updatedGuide = {
        ...currentRules.masteryGuide,
        unifiedCriteria: editingCriteriaList,
        listenToReciterTimes: listenItem?.count || 3,
        reciteLookingTimes: reciteItem?.count || 5,
        masteryRepetitionTimes: repeatItem?.count || 20,
        customCriteria: editingCriteriaList.filter(c => c.id !== 'crit-listen' && c.id !== 'crit-recite' && c.id !== 'crit-repeat')
      };

      await updateTrackSystemRules(modalTrack.id, {
        masteryGuide: updatedGuide
      });
      setIsEditingMastery(false);
      showToast?.('تم حفظ وتحديث معايير دليل الإتقان بنجاح ✨');
    } catch (err: any) {
      showToast?.('تعذر تحديث المعايير: ' + err.message, 'error');
    }
  };

  // نموذج الرصد الكامل
  const [form, setForm] = useState({
    // قسم الحفظ الجديد
    newFromSurah: 2,
    newFromAyah: 1,
    newToSurah: 2,
    newToAyah: 15,
    newPages: 1,
    recitedPortion: 'سورة البقرة (من آية 1 إلى آية 15)',
    hifzErrors: 0,
    alerts: 0,
    tajweedErrors: 0,
    notes: '',

    // المراجعة الصغرى (الربط القريب)
    minorFromSurah: 2,
    minorFromAyah: 1,
    minorToSurah: 2,
    minorToAyah: 25,
    minorPages: 3,
    minorDone: true,

    // مراجعة التمكين (المراجعة الكبرى)
    majorFromSurah: 11,
    majorFromAyah: 36,
    majorToSurah: 11,
    majorToAyah: 50,
    majorPages: 2,
    majorDone: true,

    // معايير التحضير والإتقان
    criteriaListen: true,
    criteriaRecite: true,
    criteriaRepeat: true,
    hasMedal: false
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

  // فتح نافذة الرصد
  const handleOpenModal = (studentId: string) => {
    const existing: any = (dailyRecords || []).find(
      r => r.studentId === studentId && r.date === selectedDate
    );

    const studentPlan = (studentPlans || []).find(p => p.studentId === studentId);

    // تجهيز أعداد مرات المعايير المنجزة يدويًا
    const initCounts: Record<string, number> = {};
    activeCriteriaList.forEach(crit => {
      if (existing?.criteriaCounts && existing.criteriaCounts[crit.id] !== undefined) {
        initCounts[crit.id] = Number(existing.criteriaCounts[crit.id]) || 0;
      } else if (crit.id === 'crit-listen') {
        const val = existing?.criteriaListenCount ?? (existing?.conditions?.listenedToReader ? crit.count : 0);
        initCounts[crit.id] = existing ? val : crit.count;
      } else if (crit.id === 'crit-recite') {
        const val = existing?.criteriaReciteCount ?? (existing?.conditions?.recitedLooking ? crit.count : 0);
        initCounts[crit.id] = existing ? val : crit.count;
      } else if (crit.id === 'crit-repeat') {
        const val = existing?.criteriaRepeatCount ?? (existing?.conditions?.masteryRepetition ? crit.count : 0);
        initCounts[crit.id] = existing ? val : crit.count;
      } else {
        initCounts[crit.id] = existing ? 0 : crit.count;
      }
    });
    setCriteriaCounts(initCounts);

    if (existing) {
      setForm({
        newFromSurah: existing.newFromSurah ?? 2,
        newFromAyah: existing.newFromAyah ?? 1,
        newToSurah: existing.newToSurah ?? 2,
        newToAyah: existing.newToAyah ?? 15,
        newPages: existing.newMemorizationPages ?? existing.newPages ?? 1,
        recitedPortion: existing.requiredPortionText ?? existing.recitedPortion ?? '',
        hifzErrors: existing.memorizationMistakes ?? existing.hifzErrors ?? 0,
        alerts: existing.hintsCount ?? existing.alerts ?? 0,
        tajweedErrors: existing.tajweedErrorsCount ?? existing.tajweedErrors ?? 0,
        notes: existing.notes || '',

        minorFromSurah: existing.minorRevisionPortion?.surahNumber ?? existing.minorFromSurah ?? 2,
        minorFromAyah: existing.minorRevisionPortion?.fromAyah ?? existing.minorFromAyah ?? 1,
        minorToSurah: existing.minorToSurah ?? existing.minorRevisionPortion?.surahNumber ?? 2,
        minorToAyah: existing.minorRevisionPortion?.toAyah ?? existing.minorToAyah ?? 25,
        minorPages: existing.minorRevisionPortion?.pagesCount ?? existing.minorPages ?? 3,
        minorDone: existing.minorDone ?? existing.conditions?.minorRevision ?? true,

        majorFromSurah: existing.tamkeenRevisionPortion?.surahNumber ?? existing.majorFromSurah ?? 11,
        majorFromAyah: existing.tamkeenRevisionPortion?.fromAyah ?? existing.majorFromAyah ?? 36,
        majorToSurah: existing.majorToSurah ?? existing.tamkeenRevisionPortion?.surahNumber ?? 11,
        majorToAyah: existing.tamkeenRevisionPortion?.toAyah ?? existing.majorToAyah ?? 50,
        majorPages: existing.tamkeenRevisionPortion?.pagesCount ?? existing.majorPages ?? 2,
        majorDone: existing.majorDone ?? existing.conditions?.tamkeenRevision ?? true,

        criteriaListen: existing.conditions?.listenedToReader ?? existing.criteriaListen ?? true,
        criteriaRecite: existing.conditions?.recitedLooking ?? existing.criteriaRecite ?? true,
        criteriaRepeat: existing.conditions?.masteryRepetition ?? existing.criteriaRepeat ?? true,
        hasMedal: existing.conditions?.achievedDistinction ?? existing.hasMedal ?? false
      });
    } else {
      // إعداد القيم الافتراضية
      const defFromS = studentPlan?.newMemorization?.fromSurah || 2;
      const defFromA = studentPlan?.newMemorization?.fromAyah || 1;
      const defToS = studentPlan?.newMemorization?.toSurah || 2;
      const defToA = studentPlan?.newMemorization?.toAyah || 15;
      const initialPages = calculatePortionPages(defFromS, defFromA, defToS, defToA);

      setForm({
        newFromSurah: defFromS,
        newFromAyah: defFromA,
        newToSurah: defToS,
        newToAyah: defToA,
        newPages: initialPages,
        recitedPortion: formatPortionText(defFromS, defFromA, defToS, defToA),
        hifzErrors: 0,
        alerts: 0,
        tajweedErrors: 0,
        notes: '',

        minorFromSurah: 2,
        minorFromAyah: 1,
        minorToSurah: 2,
        minorToAyah: 25,
        minorPages: calculatePortionPages(2, 1, 2, 25),
        minorDone: true,

        majorFromSurah: 11,
        majorFromAyah: 36,
        majorToSurah: 11,
        majorToAyah: 50,
        majorPages: calculatePortionPages(11, 36, 11, 50),
        majorDone: true,

        criteriaListen: true,
        criteriaRecite: true,
        criteriaRepeat: true,
        hasMedal: false
      });
    }

    setActiveModalStudentId(studentId);
  };

  // معالجات تغيير نطاق الحفظ الجديد وتحديث الأوجه والنص تلقائياً
  const handleNewPortionChange = (field: 'newFromSurah' | 'newFromAyah' | 'newToSurah' | 'newToAyah', val: number) => {
    setForm(prev => {
      const next = { ...prev, [field]: val };
      const autoPages = calculatePortionPages(next.newFromSurah, next.newFromAyah, next.newToSurah, next.newToAyah);
      const text = formatPortionText(next.newFromSurah, next.newFromAyah, next.newToSurah, next.newToAyah);
      return {
        ...next,
        newPages: autoPages,
        recitedPortion: text
      };
    });
  };

  // معالجات تغيير نطاق المراجعة الصغرى وتحديث الأوجه تلقائياً
  const handleMinorPortionChange = (field: 'minorFromSurah' | 'minorFromAyah' | 'minorToSurah' | 'minorToAyah', val: number) => {
    setForm(prev => {
      const next = { ...prev, [field]: val };
      const autoPages = calculatePortionPages(next.minorFromSurah, next.minorFromAyah, next.minorToSurah, next.minorToAyah);
      return {
        ...next,
        minorPages: autoPages
      };
    });
  };

  // معالجات تغيير نطاق مراجعة التمكين وتحديث الأوجه تلقائياً
  const handleMajorPortionChange = (field: 'majorFromSurah' | 'majorFromAyah' | 'majorToSurah' | 'majorToAyah', val: number) => {
    setForm(prev => {
      const next = { ...prev, [field]: val };
      const autoPages = calculatePortionPages(next.majorFromSurah, next.majorFromAyah, next.majorToSurah, next.majorToAyah);
      return {
        ...next,
        majorPages: autoPages
      };
    });
  };

  // حفظ واعتماد الرصد
  const handleSaveRecitation = async () => {
    if (!activeModalStudentId) return;

    const listenCount = criteriaCounts['crit-listen'] ?? (activeCriteriaList[0] ? criteriaCounts[activeCriteriaList[0].id] : 0) ?? 0;
    const reciteCount = criteriaCounts['crit-recite'] ?? (activeCriteriaList[1] ? criteriaCounts[activeCriteriaList[1].id] : 0) ?? 0;
    const repeatCount = criteriaCounts['crit-repeat'] ?? (activeCriteriaList[2] ? criteriaCounts[activeCriteriaList[2].id] : 0) ?? 0;

    await saveDailyRecord({
      studentId: activeModalStudentId,
      circleId: selectedCircleId,
      date: selectedDate,
      dayName: new Date(selectedDate).toLocaleDateString('ar-SA', { weekday: 'long' }),
      recitationScore: calculatedNewScore,
      memorizationMistakes: form.hifzErrors,
      hintsCount: form.alerts,
      tajweedErrorsCount: form.tajweedErrors,
      newMemorizationPages: form.newPages,
      newMemorizationCompleted: true,
      requiredPortionText: form.recitedPortion,
      revisionCompleted: form.minorDone || form.majorDone,
      revisionPages: form.minorPages + form.majorPages,
      minorRevisionPortion: {
        surahNumber: form.minorFromSurah,
        fromAyah: Number(form.minorFromAyah) || 1,
        toAyah: Number(form.minorToAyah) || 1,
        pagesCount: form.minorPages,
        status: form.minorDone ? 'excellent' : 'needs_repetition'
      },
      tamkeenRevisionPortion: {
        surahNumber: form.majorFromSurah,
        fromAyah: Number(form.majorFromAyah) || 1,
        toAyah: Number(form.majorToAyah) || 1,
        pagesCount: form.majorPages,
        status: form.majorDone ? 'excellent' : 'needs_repetition'
      },
      conditions: {
        listenedToReader: listenCount > 0,
        recitedLooking: reciteCount > 0,
        masteryRepetition: repeatCount > 0,
        minorRevision: form.minorDone,
        tamkeenRevision: form.majorDone,
        achievedDistinction: form.hasMedal
      },
      criteriaCounts,
      criteriaListenCount: listenCount,
      criteriaReciteCount: reciteCount,
      criteriaRepeatCount: repeatCount,
      status: 'completed',
      notes: form.notes,
      recordedBy: currentUser?.name || 'معلمة الحلقة',
      recordedAt: new Date().toISOString(),
      ...(form as any)
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
            رصد الحفظ الجديد، وتفاصيل المراجعة الصغرى والتمكين مع احتساب الأوجه تلقائياً
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
            const record = (dailyRecords || []).find(
              r => r.studentId === st.id && r.date === selectedDate
            );

            return (
              <div 
                key={st.id} 
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-stone-50/50 dark:hover:bg-stone-800/30 transition"
              >
                <div 
                  onClick={() => setViewingStudentRecord(st)}
                  className="flex items-center gap-3 cursor-pointer group p-1.5 -m-1.5 rounded-2xl hover:bg-stone-100/70 dark:hover:bg-stone-800/70 transition select-none"
                  title="انقر لفتح كشف سجل الطالبة ومتابعة محفوظاتها ودرجاتها"
                >
                  <div className="w-10 h-10 rounded-2xl bg-[#FAF7F5] dark:bg-stone-800 flex items-center justify-center font-bold text-sm text-[#8E5364] dark:text-[#E8BDC8] group-hover:bg-[#8E5364] group-hover:text-white transition shadow-2xs shrink-0">
                    {st.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-bold text-stone-900 dark:text-stone-100 text-sm group-hover:text-[#8E5364] dark:group-hover:text-[#E8BDC8] transition flex items-center gap-1">
                        <span>{st.name}</span>
                        <FileText className="w-3.5 h-3.5 text-stone-400 group-hover:text-[#8E5364] transition opacity-70" />
                      </h4>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-stone-400 font-mono">{st.code}</span>
                      <span className="text-[10px] text-[#8E5364] dark:text-[#E8BDC8] font-bold underline">
                        فتح كشف السجل 📜
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {record ? (
                    <div className="flex items-center gap-3 text-left">
                      <div className="text-xs text-stone-500 text-right">
                        <span>الدرجة: <strong className="text-[#8E5364] font-bold">{record.recitationScore}/10</strong></span>
                        <span className="mx-1.5">•</span>
                        <span>الأوجه: <strong className="text-stone-800 dark:text-stone-200">{record.newMemorizationPages ?? 1}</strong></span>
                        <span className="mx-1.5">•</span>
                        <span>أخطاء: <strong className="text-rose-600">{record.memorizationMistakes ?? 0}</strong></span>
                        <span className="mx-1.5">•</span>
                        <span>تنبيهات: <strong className="text-amber-600">{record.hintsCount ?? 0}</strong></span>
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

      {/* ===================== النافذة المنبثقة لرصد التسميع اليومي ===================== */}
      {activeModalStudentId && modalStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#1A1A1E] border border-[#E2D5CC] dark:border-stone-800 rounded-3xl w-full max-w-xl max-h-[92vh] overflow-y-auto p-6 space-y-5 shadow-2xl text-right" dir="rtl">
            
            {/* رأس النافذة */}
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 font-quran flex items-center gap-2">
                  <span>📖</span>
                  <span>رصد تسميع: {modalStudent.name}</span>
                </h3>
                <span className="text-[11px] text-stone-400 font-mono">{selectedDate}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-500 font-bold">
                  {modalTrack?.name || 'مشكاة الغيم'}
                </span>
                <button 
                  onClick={() => setActiveModalStudentId(null)}
                  className="p-1 rounded-xl text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* ===================== 1. قسم الحفظ الجديد (المقرر والدرجة والأخطاء) ===================== */}
            <div className="p-4 rounded-3xl bg-[#FAF7F5] dark:bg-stone-900/60 border border-[#E2D5CC] dark:border-stone-800 space-y-4">
              
              {/* صندوق الدرجة النهائية المحصلة */}
              <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-[#EAE2DC] dark:border-stone-800 text-center space-y-1 shadow-2xs">
                <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
                  الدرجة النهائية المحصلة (من 10):
                </span>
                <div className="text-4xl font-extrabold text-[#744251] dark:text-[#E8BDC8] font-mono tracking-tight pt-1">
                  {calculatedNewScore}
                </div>
                <span className="text-[11px] text-stone-400 block pt-0.5">
                  تُحسب تلقائياً وفق معادلة الخصم المعتمدة بنظام المعايير
                </span>
              </div>

              {/* عدادات الأخطاء الثلاثة بأزرار (+ / -) وكتابة يدوية */}
              <div className="grid grid-cols-3 gap-2.5">
                <CounterStepper
                  label="أخطاء الحفظ"
                  value={form.hifzErrors}
                  onChange={v => setForm({ ...form, hifzErrors: v })}
                  step={1}
                  min={0}
                  deductionNote={`-${hifzDeduction}`}
                  variant="danger"
                />

                <CounterStepper
                  label="التنبيهات"
                  value={form.alerts}
                  onChange={v => setForm({ ...form, alerts: v })}
                  step={1}
                  min={0}
                  deductionNote={`-${alertDeduction}`}
                  variant="warning"
                />

                <CounterStepper
                  label="أخطاء التجويد"
                  value={form.tajweedErrors}
                  onChange={v => setForm({ ...form, tajweedErrors: v })}
                  step={1}
                  min={0}
                  deductionNote={`-${tajweedDeduction}`}
                  variant="purple"
                />
              </div>

              {/* مقرر الحفظ الجديد */}
              <div className="p-3.5 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                    <Bookmark className="w-3.5 h-3.5 text-[#8E5364]" />
                    <span>مقرر الحفظ الجديد:</span>
                  </span>
                  
                  <div className="flex items-center gap-1.5 bg-[#FAF7F5] dark:bg-stone-800 px-2.5 py-1 rounded-xl border border-[#E2D5CC] dark:border-stone-700">
                    <span className="text-[11px] text-stone-500 font-bold">الأوجه المقررة:</span>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={form.newPages}
                      onChange={e => setForm({ ...form, newPages: parseFloat(e.target.value) || 0 })}
                      className="w-14 text-center text-xs font-extrabold text-[#8E5364] dark:text-[#E8BDC8] font-mono bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg py-0.5 outline-hidden focus:border-[#8E5364]"
                    />
                  </div>
                </div>

                {/* نص المقرر التسميعي - كتابة وتعديل يدوي */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-400">
                    المقرر الذي تم تسميعه:
                  </label>
                  <input
                    type="text"
                    value={form.recitedPortion}
                    onChange={e => setForm({ ...form, recitedPortion: e.target.value })}
                    placeholder="مثال: من سورة البقرة آية ١ إلى ٢٥"
                    className="w-full px-3.5 py-2.5 bg-[#FAF7F5] dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 rounded-xl text-xs text-stone-800 dark:text-stone-100 outline-hidden focus:ring-2 focus:ring-[#8E5364]"
                  />
                </div>
              </div>

              {/* ملاحظات وتوجيهات للمعلمة */}
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

            {/* ===================== 2. المراجعة الصغرى (الربط القريب) ===================== */}
            <div className="p-4 rounded-2xl bg-[#FCFAF8] dark:bg-stone-900/60 border border-[#EFEAE5] dark:border-stone-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                  <span>🔄</span>
                  <span>المراجعة الصغرى (الربط القريب):</span>
                </h4>

                {/* الأوجه المنجزة للمراجعة الصغرى */}
                <div className="flex items-center gap-1.5 bg-white dark:bg-stone-800 px-2.5 py-1 rounded-xl border border-stone-200 dark:border-stone-700">
                  <span className="text-[11px] text-stone-500 font-bold">الأوجه المنجزة:</span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={form.minorPages}
                    onChange={e => setForm({ ...form, minorPages: parseFloat(e.target.value) || 0 })}
                    className="w-14 text-center text-xs font-extrabold text-[#8E5364] dark:text-[#E8BDC8] font-mono bg-[#FAF7F5] dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg py-0.5 outline-hidden focus:border-[#8E5364]"
                  />
                </div>
              </div>

              {/* من سورة ومن آية إلى سورة وإلى آية */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <label className="block text-[11px] text-stone-500 mb-1">من سورة</label>
                  <select
                    value={form.minorFromSurah}
                    onChange={e => handleMinorPortionChange('minorFromSurah', Number(e.target.value))}
                    className="w-full py-1.5 px-2 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 rounded-xl font-bold text-xs"
                  >
                    {QURAN_SURAHS.map(s => (
                      <option key={s.number} value={s.number}>{s.number}. {s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-stone-500 mb-1">من آية</label>
                  <input
                    type="number"
                    min="1"
                    value={form.minorFromAyah}
                    onChange={e => handleMinorPortionChange('minorFromAyah', Number(e.target.value))}
                    className="w-full text-center py-1.5 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 rounded-xl font-bold text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-stone-500 mb-1">إلى سورة</label>
                  <select
                    value={form.minorToSurah}
                    onChange={e => handleMinorPortionChange('minorToSurah', Number(e.target.value))}
                    className="w-full py-1.5 px-2 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 rounded-xl font-bold text-xs"
                  >
                    {QURAN_SURAHS.map(s => (
                      <option key={s.number} value={s.number}>{s.number}. {s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-stone-500 mb-1">إلى آية</label>
                  <input
                    type="number"
                    min="1"
                    value={form.minorToAyah}
                    onChange={e => handleMinorPortionChange('minorToAyah', Number(e.target.value))}
                    className="w-full text-center py-1.5 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 rounded-xl font-bold text-xs"
                  />
                </div>
              </div>
            </div>

            {/* ===================== 3. مراجعة التمكين (المراجعة الكبرى) ===================== */}
            <div className="p-4 rounded-2xl bg-[#FCFAF8] dark:bg-stone-900/60 border border-[#EFEAE5] dark:border-stone-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                  <span>✨</span>
                  <span>مراجعة التمكين (المراجعة الكبرى):</span>
                </h4>

                {/* الأوجه المنجزة لمراجعة التمكين */}
                <div className="flex items-center gap-1.5 bg-white dark:bg-stone-800 px-2.5 py-1 rounded-xl border border-stone-200 dark:border-stone-700">
                  <span className="text-[11px] text-stone-500 font-bold">الأوجه المنجزة:</span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={form.majorPages}
                    onChange={e => setForm({ ...form, majorPages: parseFloat(e.target.value) || 0 })}
                    className="w-14 text-center text-xs font-extrabold text-[#8E5364] dark:text-[#E8BDC8] font-mono bg-[#FAF7F5] dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg py-0.5 outline-hidden focus:border-[#8E5364]"
                  />
                </div>
              </div>

              {/* من سورة ومن آية إلى سورة وإلى آية */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <label className="block text-[11px] text-stone-500 mb-1">من سورة</label>
                  <select
                    value={form.majorFromSurah}
                    onChange={e => handleMajorPortionChange('majorFromSurah', Number(e.target.value))}
                    className="w-full py-1.5 px-2 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 rounded-xl font-bold text-xs"
                  >
                    {QURAN_SURAHS.map(s => (
                      <option key={s.number} value={s.number}>{s.number}. {s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-stone-500 mb-1">من آية</label>
                  <input
                    type="number"
                    min="1"
                    value={form.majorFromAyah}
                    onChange={e => handleMajorPortionChange('majorFromAyah', Number(e.target.value))}
                    className="w-full text-center py-1.5 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 rounded-xl font-bold text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-stone-500 mb-1">إلى سورة</label>
                  <select
                    value={form.majorToSurah}
                    onChange={e => handleMajorPortionChange('majorToSurah', Number(e.target.value))}
                    className="w-full py-1.5 px-2 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 rounded-xl font-bold text-xs"
                  >
                    {QURAN_SURAHS.map(s => (
                      <option key={s.number} value={s.number}>{s.number}. {s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-stone-500 mb-1">إلى آية</label>
                  <input
                    type="number"
                    min="1"
                    value={form.majorToAyah}
                    onChange={e => handleMajorPortionChange('majorToAyah', Number(e.target.value))}
                    className="w-full text-center py-1.5 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 rounded-xl font-bold text-xs"
                  />
                </div>
              </div>
            </div>

            {/* ===================== 4. معايير التحضير والإتقان ===================== */}
            <div className="p-4 rounded-2xl bg-[#FCFAF8] dark:bg-stone-900/60 border border-[#EFEAE5] dark:border-stone-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="block text-xs font-bold text-stone-800 dark:text-stone-200">
                    معايير التحضير والإتقان (دليل مشكاة الغيم):
                  </span>
                  <span className="text-[10px] text-stone-400">
                    خاصة بمسار: {modalTrack?.name || 'المسار الحالي'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleOpenMasteryEditor}
                  className="px-2.5 py-1 text-[11px] font-bold text-[#8E5364] dark:text-[#E8BDC8] bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl hover:bg-stone-50 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                >
                  <span>{isEditingMastery ? 'إغلاق ✕' : '⚙️ تعديل أو إضافة معايير'}</span>
                </button>
              </div>

              {/* لوحة التعديل الموحدة لكافة المعايير (كلها زي بعض) */}
              {isEditingMastery && (
                <div className="p-3.5 bg-white dark:bg-stone-800 rounded-2xl border border-[#8E5364]/30 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between pb-1 border-b border-stone-100 dark:border-stone-700">
                    <span className="text-xs font-bold text-[#8E5364] dark:text-[#E8BDC8]">
                      إدارة معايير دليل الإتقان لمسار ({modalTrack?.name}):
                    </span>
                    <span className="text-[10px] text-stone-400">معايير موحدة قابلة للتعديل والإضافة والحذف</span>
                  </div>

                  {/* قائمة المعايير الموحدة الحالية */}
                  <div className="space-y-2">
                    {editingCriteriaList.map((crit, idx) => (
                      <div 
                        key={crit.id} 
                        className="p-2.5 bg-stone-50 dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="flex-1">
                          <input
                            type="text"
                            value={crit.title}
                            onChange={e => {
                              const nextTitle = e.target.value;
                              setEditingCriteriaList(prev => prev.map((c, i) => i === idx ? { ...c, title: nextTitle } : c));
                            }}
                            className="w-full text-xs font-bold text-stone-800 dark:text-stone-100 bg-transparent outline-hidden"
                            placeholder="اسم المعيار"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 bg-white dark:bg-stone-800 px-2 py-1 rounded-lg border border-stone-200 dark:border-stone-700">
                            <span className="text-[10px] text-stone-400">المستهدف:</span>
                            <input
                              type="number"
                              min="1"
                              value={crit.count}
                              onChange={e => {
                                const nextCount = Math.max(1, parseInt(e.target.value, 10) || 1);
                                setEditingCriteriaList(prev => prev.map((c, i) => i === idx ? { ...c, count: nextCount } : c));
                              }}
                              className="w-12 text-center text-xs font-extrabold text-[#8E5364] dark:text-[#E8BDC8] bg-transparent outline-hidden"
                            />
                            <span className="text-[10px] text-stone-500 font-bold">{crit.unit || 'مرات'}</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingCriteriaList(prev => prev.filter((_, i) => i !== idx));
                            }}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer transition"
                            title="حذف هذا المعيار"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* إضافة معيار جديد إلى القائمة */}
                  <div className="pt-2 border-t border-stone-100 dark:border-stone-700 space-y-2">
                    <span className="block text-[11px] font-bold text-stone-700 dark:text-stone-300">
                      إضافة معيار جديد:
                    </span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        placeholder="اسم المعيار (مثال: الاستماع، التلاوة، التكرار، حفظ المعاني، التسميع للرفيقة...)"
                        value={newCritName}
                        onChange={e => setNewCritName(e.target.value)}
                        className="flex-1 py-1.5 px-2.5 bg-[#FAF7F5] dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-hidden"
                      />
                      <input
                        type="number"
                        min="1"
                        value={newCritTimes}
                        onChange={e => setNewCritTimes(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-14 text-center py-1.5 bg-[#FAF7F5] dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-bold"
                        title="عدد المرات المستهدفة"
                      />
                      <input
                        type="text"
                        value={newCritUnit}
                        onChange={e => setNewCritUnit(e.target.value)}
                        placeholder="مرات"
                        className="w-14 text-center py-1.5 bg-[#FAF7F5] dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-bold"
                        title="الوحدة (مرات، مرة، حزب)"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!newCritName.trim()) return;
                          const newC = {
                            id: `crit-${Date.now()}`,
                            title: newCritName.trim(),
                            count: Number(newCritTimes) || 1,
                            unit: newCritUnit.trim() || 'مرات'
                          };
                          setEditingCriteriaList(prev => [...prev, newC]);
                          setNewCritName('');
                        }}
                        className="px-2.5 py-1.5 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer whitespace-nowrap active:scale-95 shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>إضافة</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-stone-100 dark:border-stone-700">
                    <button
                      type="button"
                      onClick={() => setIsEditingMastery(false)}
                      className="px-3 py-1.5 text-xs text-stone-500 hover:text-stone-700 cursor-pointer"
                    >
                      إلغاء
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveMasteryStandards}
                      className="px-4 py-1.5 text-xs font-bold text-white bg-[#8E5364] hover:bg-[#744251] rounded-xl transition shadow-xs cursor-pointer flex items-center gap-1 active:scale-95"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>حفظ وتطبيق المعايير</span>
                    </button>
                  </div>
                </div>
              )}

              {/* بطاقات المعايير الموحدة مع خانة كتابة الرقم يدوياً (تسمع مرة تحط 1 ومرتين تحط 2) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                {activeCriteriaList.map(crit => {
                  const currentCount = criteriaCounts[crit.id] ?? 0;
                  const isDone = currentCount >= crit.count;
                  const isPartial = currentCount > 0 && !isDone;

                  return (
                    <div
                      key={crit.id}
                      className="p-3 rounded-2xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 space-y-2 hover:border-[#8E5364]/40 transition shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-bold text-xs text-stone-800 dark:text-stone-100 block">
                            {crit.title}
                          </span>
                          <span className="text-[10px] text-stone-400">
                            المستهدف: {crit.count} {crit.unit || 'مرات'}
                          </span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isDone 
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' 
                            : isPartial 
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300' 
                            : 'bg-stone-100 text-stone-500 dark:bg-stone-700 dark:text-stone-400'
                        }`}>
                          {isDone ? 'مكتمل ✅' : isPartial ? 'منجز جزئياً ⏳' : 'لم يُنجز'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-stone-100 dark:border-stone-700/60">
                        <label className="text-[11px] font-bold text-stone-600 dark:text-stone-400 cursor-pointer">
                          المنجز (اكتب الرقم):
                        </label>
                        
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setCriteriaCounts(prev => ({
                              ...prev,
                              [crit.id]: Math.max(0, (Number(prev[crit.id]) || 0) - 1)
                            }))}
                            className="w-7 h-7 rounded-lg bg-[#FAF7F5] dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 flex items-center justify-center font-bold hover:bg-stone-200 cursor-pointer active:scale-95"
                            title="إنقاص مرة واحدة"
                          >
                            -
                          </button>

                          <input
                            type="number"
                            min="0"
                            max="999"
                            value={criteriaCounts[crit.id] ?? 0}
                            onChange={e => {
                              const val = e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0);
                              setCriteriaCounts(prev => ({ ...prev, [crit.id]: val }));
                            }}
                            className="w-14 text-center text-xs font-extrabold text-[#8E5364] dark:text-[#E8BDC8] font-mono bg-[#FAF7F5] dark:bg-stone-900 border-2 border-stone-200 dark:border-stone-700 focus:border-[#8E5364] rounded-lg py-1 outline-hidden"
                            title="اكتب عدد المرات المنجزة مباشرة"
                          />

                          <button
                            type="button"
                            onClick={() => setCriteriaCounts(prev => ({
                              ...prev,
                              [crit.id]: (Number(prev[crit.id]) || 0) + 1
                            }))}
                            className="w-7 h-7 rounded-lg bg-[#FAF7F5] dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 flex items-center justify-center font-bold hover:bg-stone-200 cursor-pointer active:scale-95"
                            title="زيادة مرة واحدة"
                          >
                            +
                          </button>

                          <span className="text-[10px] text-stone-400 font-bold mr-1">
                            {crit.unit || 'مرات'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* وسام التميز لليوم */}
                <label className="col-span-full flex items-center gap-2 p-2.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 cursor-pointer hover:border-amber-400 transition">
                  <input
                    type="checkbox"
                    checked={form.hasMedal}
                    onChange={e => setForm({ ...form, hasMedal: e.target.checked })}
                    className="accent-amber-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-amber-800 dark:text-amber-300 font-bold text-xs">
                    ⭐ نيل وسام التميز والتفوق لليوم
                  </span>
                </label>
              </div>
            </div>

            {/* ===================== أزرار الحفظ والإلغاء ===================== */}
            <div className="flex gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
              <button
                type="button"
                onClick={handleSaveRecitation}
                className="flex-1 py-3 bg-[#744251] hover:bg-[#5e3541] text-white rounded-2xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>اعتماد وحفظ الدرجة ({calculatedNewScore})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveModalStudentId(null)}
                className="px-5 py-3 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-2xl text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== نافذة كشف سجل الطالبة الشامل ===================== */}
      {viewingStudentRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs">
          <div 
            className="bg-white dark:bg-stone-900 border border-[#E2D5CC] dark:border-stone-800 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl text-right animate-in fade-in"
            dir="rtl"
          >
            {/* ترويسة الكشف */}
            <div className="p-5 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#FAF7F5] dark:bg-stone-800 border border-[#E2D5CC] dark:border-stone-700 text-[#8E5364] dark:text-[#E8BDC8] flex items-center justify-center text-xl font-bold shadow-2xs shrink-0">
                  📜
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100 font-quran">
                      كشف سجل الطالبة: {viewingStudentRecord.name}
                    </h3>
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#FAF7F5] dark:bg-stone-800 text-[#8E5364] dark:text-[#E8BDC8] font-mono font-bold">
                      {viewingStudentRecord.code}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                    حلقة: {studentCircle?.name || 'غير محدد'} • المسار: {studentTrack?.name || 'العام'} • المعلمة: أ. {studentCircle?.teacherName || 'معلمة الحلقة'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setViewingStudentRecord(null)}
                className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-500 flex items-center justify-center transition cursor-pointer"
                title="إغلاق الكشف"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* محتوى الكشف القابل للتمرير */}
            <div className="p-5 overflow-y-auto space-y-5 text-xs flex-1">
              
              {/* بطاقات المؤشرات السريعة لكشف الطالبة */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-[#FAF7F5] dark:bg-stone-800/60 p-3.5 rounded-2xl border border-[#E2D5CC] dark:border-stone-700/60">
                  <span className="text-[10px] text-stone-500 font-bold block">إجمالي الأوجه المرصودة</span>
                  <p className="text-base sm:text-lg font-bold text-[#8E5364] dark:text-[#E8BDC8] mt-0.5">
                    {studentStats.totalPages} <span className="text-xs font-normal">أوجه</span>
                  </p>
                </div>
                <div className="bg-[#FAF7F5] dark:bg-stone-800/60 p-3.5 rounded-2xl border border-[#E2D5CC] dark:border-stone-700/60">
                  <span className="text-[10px] text-stone-500 font-bold block">متوسط درجات التسميع</span>
                  <p className="text-base sm:text-lg font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {studentStats.avgScore} <span className="text-xs font-normal">/ 10</span>
                  </p>
                </div>
                <div className="bg-[#FAF7F5] dark:bg-stone-800/60 p-3.5 rounded-2xl border border-[#E2D5CC] dark:border-stone-700/60">
                  <span className="text-[10px] text-stone-500 font-bold block">جلسات التسميع المسجلة</span>
                  <p className="text-base sm:text-lg font-bold text-stone-800 dark:text-stone-100 mt-0.5">
                    {studentStats.totalSessions} <span className="text-xs font-normal">جلسة</span>
                  </p>
                </div>
                <div className="bg-[#FAF7F5] dark:bg-stone-800/60 p-3.5 rounded-2xl border border-[#E2D5CC] dark:border-stone-700/60">
                  <span className="text-[10px] text-stone-500 font-bold block">النتيجة والتقدير العام</span>
                  <p className="text-base sm:text-lg font-bold text-amber-700 dark:text-amber-400 mt-0.5">
                    {studentScore?.gradeLabel || 'متميز'} ({studentScore?.finalPercentage || 100}%)
                  </p>
                </div>
              </div>

              {/* جدول كشف جلسات التسميع والمراجعة اليومية */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-stone-800 dark:text-stone-200 text-xs flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-[#8E5364]" />
                    <span>بيان جلسات التسميع والمراجعة اليومية ({studentRecords.length} سجل)</span>
                  </h4>
                  {studentRecords.length > 0 && (
                    <span className="text-[10px] text-stone-400">مرتب تنازلياً حسب أحدث تاريخ</span>
                  )}
                </div>

                <div className="border border-[#E2D5CC] dark:border-stone-700 rounded-2xl overflow-hidden bg-white dark:bg-stone-900">
                  {studentRecords.length === 0 ? (
                    <div className="p-8 text-center text-stone-400 text-xs space-y-2">
                      <div className="text-2xl">📖</div>
                      <p className="font-bold text-stone-600 dark:text-stone-300">لا توجد سجلات تسميع سابقة لهذه الطالبة حتى الآن</p>
                      <p className="text-[11px] text-stone-400 max-w-sm mx-auto">
                        يمكنك رصد أول جلسة تسميع ومراجعة اليوم بالضغط على زر "رصد التسميع اليومي".
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-72">
                      <table className="w-full text-right text-[11px]">
                        <thead className="bg-[#FAF7F5] dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-bold sticky top-0 border-b border-[#E2D5CC] dark:border-stone-700">
                          <tr>
                            <th className="p-2.5">التاريخ واليوم</th>
                            <th className="p-2.5">المقرر المطلوب</th>
                            <th className="p-2.5 text-center">أوجه الجديد</th>
                            <th className="p-2.5 text-center">أخطاء / تنبيهات</th>
                            <th className="p-2.5 text-center">الدرجة</th>
                            <th className="p-2.5">المراجعة والتمكين</th>
                            <th className="p-2.5">ملاحظات المعلمة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                          {studentRecords.map(r => (
                            <tr key={r.id || r.date} className="hover:bg-stone-50/60 dark:hover:bg-stone-800/40">
                              <td className="p-2.5 font-bold whitespace-nowrap">
                                <div>{r.date}</div>
                                <span className="text-[10px] text-stone-400 font-normal">{r.dayName || ''}</span>
                              </td>
                              <td className="p-2.5 font-bold text-stone-800 dark:text-stone-200">
                                {r.requiredPortionText || 'مقرر الحفظ اليومي'}
                              </td>
                              <td className="p-2.5 text-center font-mono font-bold text-[#8E5364] dark:text-[#E8BDC8]">
                                {r.newMemorizationPages ?? 1} ص
                              </td>
                              <td className="p-2.5 text-center whitespace-nowrap">
                                <span className="text-rose-600 font-mono font-bold">{r.memorizationMistakes ?? 0}</span>
                                <span className="text-stone-400 mx-1">/</span>
                                <span className="text-amber-600 font-mono">{r.hintsCount ?? 0}</span>
                              </td>
                              <td className="p-2.5 text-center whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded-lg font-bold text-[10px] ${
                                  (r.recitationScore ?? 10) >= 9 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' :
                                  (r.recitationScore ?? 10) >= 7 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' :
                                  'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                                }`}>
                                  {r.recitationScore ?? 10} / 10
                                </span>
                              </td>
                              <td className="p-2.5 text-[10px] text-stone-600 dark:text-stone-400 max-w-[150px] truncate">
                                {r.revisionCompleted ? 'منجزة بالشروط ✅' : 'لم تُسرد بعد'}
                              </td>
                              <td className="p-2.5 text-[10px] text-stone-500 italic max-w-[140px] truncate">
                                {r.notes || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* شريط الإجراءات السفلي */}
            <div className="p-4 bg-[#FAF7F5] dark:bg-stone-800/80 border-t border-[#E2D5CC] dark:border-stone-800 rounded-b-3xl flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                {onSelectStudent && (
                  <button
                    type="button"
                    onClick={() => {
                      const sid = viewingStudentRecord.id;
                      setViewingStudentRecord(null);
                      onSelectStudent(sid);
                    }}
                    className="px-4 py-2 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                    title="الانتقال لملف الإنجاز والشهادة الرسمية لهذه الطالبة"
                  >
                    <span>📜 فتح ملف الإنجاز والشهادة المعتمدة</span>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const sid = viewingStudentRecord.id;
                    setViewingStudentRecord(null);
                    handleOpenModal(sid);
                  }}
                  className="px-3.5 py-2 bg-white dark:bg-stone-900 border border-[#E2D5CC] dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:border-[#8E5364] rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Edit3 className="w-3.5 h-3.5 text-[#8E5364]" />
                  <span>رصد تسميع اليوم لهذه الطالبة</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setViewingStudentRecord(null)}
                className="px-4 py-2 bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-200 rounded-xl text-xs font-bold cursor-pointer transition"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
