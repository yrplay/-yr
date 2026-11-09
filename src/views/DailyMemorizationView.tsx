import React, { useState, useMemo, useEffect } from 'react';
import { 
  BookOpen, Calendar, Clock, CheckCircle2, AlertCircle, 
  Search, Award, Edit3, X, Check, Sparkles, Plus, Minus,
  RotateCcw, Bookmark, ChevronLeft, Layers, Trash2, FileText, User
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { QURAN_SURAHS, SurahInfo } from '../data/quranData';
import { defaultMasteryGuideConfig, CustomMasteryCriterion, MasteryGuideConfig, Student } from '../types';
import { HijriDateNavigationBar, formatHijriDate, formatHijriShort, getHijriParts, getTodayISO } from '../utils/hijriDate';

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
    dailyRecords, saveDailyRecord, deleteDailyRecord, settings,
    attendanceRecords, saveAttendance,
    studentPlans, updateTrack, updateTrackSystemRules, showToast, allStudentScores,
    selectedTrackId, selectedCircleId, setSelectedCircleId, selectedDate, setSelectedDate
  } = useApp();

  const availableCircles = useMemo(() => {
    if (!selectedTrackId || selectedTrackId === 'all') return circles.filter(c => !c.isArchived);
    return circles.filter(c => !c.isArchived && c.trackId === selectedTrackId);
  }, [circles, selectedTrackId]);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeModalStudentId, setActiveModalStudentId] = useState<string | null>(null);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<any>(null);

  useEffect(() => {
    if (availableCircles.length > 0 && !availableCircles.some(c => c.id === selectedCircleId)) {
      setSelectedCircleId(availableCircles[0].id);
    }
  }, [availableCircles, selectedCircleId, setSelectedCircleId]);

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

  const modalStudentPlan = useMemo(() => {
    if (!modalStudent) return undefined;
    return (studentPlans || []).find(p => p.studentId === modalStudent.id && p.status === 'active')
      || (studentPlans || []).find(p => p.studentId === modalStudent.id);
  }, [modalStudent, studentPlans]);

  const isNewMemPlanEnabled = modalStudentPlan ? modalStudentPlan.newMemorization?.enabled !== false : true;
  const isMinorRevPlanEnabled = modalStudentPlan ? modalStudentPlan.minorRevision?.enabled !== false : true;
  const isTamkeenRevPlanEnabled = modalStudentPlan
    ? (modalStudentPlan.tamkeenRevision?.enabled ?? modalStudentPlan.revision?.enabled) !== false
    : true;

  const studentStats = useMemo(() => {
    if (!studentRecords.length) {
      return { totalPages: 0, totalUnconditionedPages: 0, avgScore: 10, totalSessions: 0, totalMistakes: 0 };
    }
    const totalPages = Math.round(
      studentRecords.reduce((acc, r) => acc + (r.newMemorizationPages || 0), 0) * 100
    ) / 100;
    const totalScore = studentRecords.reduce((acc, r) => acc + (r.recitationScore || 0), 0);
    const avgScore = Math.round((totalScore / studentRecords.length) * 10) / 10;
    const totalMistakes = studentRecords.reduce((acc, r) => acc + (r.memorizationMistakes || 0), 0);
    return {
      totalPages,
      totalUnconditionedPages: 0,
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
      { id: 'crit-listen', title: 'الاستماع للمقرئ', count: trackMastery?.listenToReciterTimes || 5, unit: 'مرات' },
      { id: 'crit-recite', title: 'التلاوة نظراً من المصحف', count: trackMastery?.reciteLookingTimes || 5, unit: 'مرات' },
      { id: 'crit-repeat', title: 'التكرار المتقن للوجه', count: trackMastery?.masteryRepetitionTimes || 10, unit: 'مرات' }
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
    newWithConditions: true, // رصد كمنجز بشروط
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

  // حساب درجة التحضير اليومي الآلية من 10 (الاستماع 3 + التلاوة 3 + التكرار المتقن 4) مع الخصم النسبي التلقائي
  const calculatedPrepScore = useMemo(() => {
    const listenCount = criteriaCounts['crit-listen'] ?? (activeCriteriaList[0] ? criteriaCounts[activeCriteriaList[0].id] : 0) ?? 0;
    const reciteCount = criteriaCounts['crit-recite'] ?? (activeCriteriaList[1] ? criteriaCounts[activeCriteriaList[1].id] : 0) ?? 0;
    const repeatCount = criteriaCounts['crit-repeat'] ?? (activeCriteriaList[2] ? criteriaCounts[activeCriteriaList[2].id] : 0) ?? 0;

    const listenTarget = (activeCriteriaList.find(c => c.id === 'crit-listen' || c.title.includes('استماع'))?.count) || 5;
    const reciteTarget = (activeCriteriaList.find(c => c.id === 'crit-recite' || c.title.includes('تلاوة'))?.count) || 5;
    const repeatTarget = (activeCriteriaList.find(c => c.id === 'crit-repeat' || c.title.includes('تكرار'))?.count) || 10;

    const listenPts = Math.min(3, (listenCount / listenTarget) * 3);
    const recitePts = Math.min(3, (reciteCount / reciteTarget) * 3);
    const repeatPts = Math.min(4, (repeatCount / repeatTarget) * 4);

    const sum = listenPts + recitePts + repeatPts;
    return Math.min(10, Math.max(0, Math.round(sum * 10) / 10));
  }, [criteriaCounts, activeCriteriaList]);

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

  // فتح نافذة الرصد مع دعم تعديل السجلات السابقة
  const handleOpenModal = (studentId: string, customRecord?: any) => {
    if (customRecord?.date) {
      setSelectedDate(customRecord.date);
    }
    setEditingRecordId(customRecord?.id || null);

    const targetDate = customRecord?.date || selectedDate;
    const existing: any = customRecord || (dailyRecords || []).find(
      r => r.studentId === studentId && r.date === targetDate
    );

    const studentPlan = (studentPlans || []).find(p => p.studentId === studentId && p.status === 'active')
      || (studentPlans || []).find(p => p.studentId === studentId);

    const planNewEnabled = studentPlan ? studentPlan.newMemorization?.enabled !== false : true;
    const planMinorEnabled = studentPlan ? studentPlan.minorRevision?.enabled !== false : true;
    const planTamkeenEnabled = studentPlan
      ? (studentPlan.tamkeenRevision?.enabled ?? studentPlan.revision?.enabled) !== false
      : true;

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
        newPages: planNewEnabled ? (existing.newMemorizationPages ?? existing.newPages ?? 1) : 0,
        newWithConditions: true,
        recitedPortion: existing.requiredPortionText ?? existing.recitedPortion ?? '',
        hifzErrors: existing.memorizationMistakes ?? existing.hifzErrors ?? 0,
        alerts: existing.hintsCount ?? existing.alerts ?? 0,
        tajweedErrors: existing.tajweedErrorsCount ?? existing.tajweedErrors ?? 0,
        notes: existing.notes || '',

        minorFromSurah: existing.minorRevisionPortion?.surahNumber ?? existing.minorFromSurah ?? 2,
        minorFromAyah: existing.minorRevisionPortion?.fromAyah ?? existing.minorFromAyah ?? 1,
        minorToSurah: existing.minorToSurah ?? existing.minorRevisionPortion?.surahNumber ?? 2,
        minorToAyah: existing.minorRevisionPortion?.toAyah ?? existing.minorToAyah ?? 25,
        minorPages: planMinorEnabled ? (existing.minorRevisionPortion?.pagesCount ?? existing.minorPages ?? 1) : 0,
        minorDone: planMinorEnabled ? (existing.minorDone ?? existing.conditions?.minorRevision ?? true) : false,

        majorFromSurah: existing.tamkeenRevisionPortion?.surahNumber ?? existing.majorFromSurah ?? 11,
        majorFromAyah: existing.tamkeenRevisionPortion?.fromAyah ?? existing.majorFromAyah ?? 36,
        majorToSurah: existing.majorToSurah ?? existing.tamkeenRevisionPortion?.surahNumber ?? 11,
        majorToAyah: existing.tamkeenRevisionPortion?.toAyah ?? existing.majorToAyah ?? 50,
        majorPages: planTamkeenEnabled ? (existing.tamkeenRevisionPortion?.pagesCount ?? existing.majorPages ?? 1) : 0,
        majorDone: planTamkeenEnabled ? (existing.majorDone ?? existing.conditions?.tamkeenRevision ?? true) : false,

        criteriaListen: existing.conditions?.listenedToReader ?? existing.criteriaListen ?? true,
        criteriaRecite: existing.conditions?.recitedLooking ?? existing.criteriaRecite ?? true,
        criteriaRepeat: existing.conditions?.masteryRepetition ?? existing.criteriaRepeat ?? true,
        hasMedal: existing.conditions?.achievedDistinction ?? existing.hasMedal ?? false
      });
    } else {
      // إعداد القيم الافتراضية من الخطة الشهرية للطالبة
      const defFromS = studentPlan?.newMemorization?.fromSurah || 2;
      const defFromA = studentPlan?.newMemorization?.fromAyah || 1;
      const defToS = studentPlan?.newMemorization?.toSurah || 2;
      const defToA = studentPlan?.newMemorization?.toAyah || 15;
      const initialNewPages = planNewEnabled
        ? (typeof studentPlan?.newMemorization?.dailyAmountPages === 'number' && studentPlan.newMemorization.dailyAmountPages > 0
            ? studentPlan.newMemorization.dailyAmountPages
            : calculatePortionPages(defFromS, defFromA, defToS, defToA))
        : 0;

      const minFromS = studentPlan?.minorRevision?.fromSurah || 2;
      const minFromA = studentPlan?.minorRevision?.fromAyah || 1;
      const minToS = studentPlan?.minorRevision?.toSurah || 2;
      const minToA = studentPlan?.minorRevision?.toAyah || 25;
      const initialMinorPages = planMinorEnabled
        ? (typeof studentPlan?.minorRevision?.dailyAmountPages === 'number' && studentPlan.minorRevision.dailyAmountPages > 0
            ? studentPlan.minorRevision.dailyAmountPages
            : calculatePortionPages(minFromS, minFromA, minToS, minToA))
        : 0;

      const tamkSource = studentPlan?.tamkeenRevision || studentPlan?.revision;
      const majFromS = tamkSource?.fromSurah || 11;
      const majFromA = tamkSource?.fromAyah || 36;
      const majToS = tamkSource?.toSurah || 11;
      const majToA = tamkSource?.toAyah || 50;
      const initialMajorPages = planTamkeenEnabled
        ? (typeof tamkSource?.dailyAmountPages === 'number' && tamkSource.dailyAmountPages > 0
            ? tamkSource.dailyAmountPages
            : calculatePortionPages(majFromS, majFromA, majToS, majToA))
        : 0;

      setForm({
        newFromSurah: defFromS,
        newFromAyah: defFromA,
        newToSurah: defToS,
        newToAyah: defToA,
        newPages: initialNewPages,
        newWithConditions: true,
        recitedPortion: planNewEnabled ? formatPortionText(defFromS, defFromA, defToS, defToA) : 'خطة الحفظ الجديد معطّلة لهذا الشهر',
        hifzErrors: 0,
        alerts: 0,
        tajweedErrors: 0,
        notes: '',

        minorFromSurah: minFromS,
        minorFromAyah: minFromA,
        minorToSurah: minToS,
        minorToAyah: minToA,
        minorPages: initialMinorPages,
        minorDone: planMinorEnabled,

        majorFromSurah: majFromS,
        majorFromAyah: majFromA,
        majorToSurah: majToS,
        majorToAyah: majToA,
        majorPages: initialMajorPages,
        majorDone: planTamkeenEnabled,

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

    const effectiveNewPages = isNewMemPlanEnabled ? Number(form.newPages || 0) : 0;
    const effectiveMinorPages = isMinorRevPlanEnabled ? Number(form.minorPages || 0) : 0;
    const effectiveMajorPages = isTamkeenRevPlanEnabled ? Number(form.majorPages || 0) : 0;
    const effectiveMinorDone = isMinorRevPlanEnabled ? form.minorDone : false;
    const effectiveMajorDone = isTamkeenRevPlanEnabled ? form.majorDone : false;

    await saveDailyRecord({
      ...(editingRecordId ? { id: editingRecordId } : {}),
      studentId: activeModalStudentId,
      circleId: selectedCircleId,
      date: selectedDate,
      dayName: getHijriParts(selectedDate).weekday,
      recitationScore: calculatedNewScore,
      preparationScore: calculatedPrepScore,
      memorizationMistakes: form.hifzErrors,
      hintsCount: form.alerts,
      tajweedErrorsCount: form.tajweedErrors,
      newMemorizationPages: effectiveNewPages,
      newMemorizationCompleted: isNewMemPlanEnabled,
      newMemorizationWithConditions: true,
      requiredPortionText: isNewMemPlanEnabled ? form.recitedPortion : 'مراجعة فقط (الحفظ الجديد معطّل)',
      revisionCompleted: effectiveMinorDone || effectiveMajorDone,
      revisionPages: effectiveMinorPages + effectiveMajorPages,
      minorRevisionPortion: {
        surahNumber: form.minorFromSurah,
        fromAyah: Number(form.minorFromAyah) || 1,
        toAyah: Number(form.minorToAyah) || 1,
        pagesCount: effectiveMinorPages,
        status: effectiveMinorDone ? 'excellent' : 'unrecited'
      },
      tamkeenRevisionPortion: {
        surahNumber: form.majorFromSurah,
        fromAyah: Number(form.majorFromAyah) || 1,
        toAyah: Number(form.majorToAyah) || 1,
        pagesCount: effectiveMajorPages,
        status: effectiveMajorDone ? 'excellent' : 'unrecited'
      },
      conditions: {
        listenedToReader: listenCount > 0,
        recitedLooking: reciteCount > 0,
        masteryRepetition: repeatCount > 0,
        minorRevision: effectiveMinorDone,
        tamkeenRevision: effectiveMajorDone,
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
      ...(form as any),
      newPages: effectiveNewPages,
      minorPages: effectiveMinorPages,
      majorPages: effectiveMajorPages,
      minorDone: effectiveMinorDone,
      majorDone: effectiveMajorDone,
      newWithConditions: true
    });

    setEditingRecordId(null);
    setActiveModalStudentId(null);
  };

  // تبديل التحضير المبكر بنقرة واحدة مباشرة من سجل التسميع ومزامنته مع سجل الحضور
  const handleQuickToggleEarlyPrep = async (student: Student) => {
    const existingAtt = (attendanceRecords || []).find(
      a => a.studentId === student.id && a.date === selectedDate
    );
    const nextEarly = !existingAtt?.earlyPrepCardSent;

    await saveAttendance({
      ...(existingAtt || {}),
      studentId: student.id,
      circleId: selectedCircleId || student.circleId || '',
      date: selectedDate,
      status: 'present',
      earlyPrepCardSent: nextEarly
    });
  };

  // تبديل حالة الحضور السريع للطالبة مباشرة من صف التسميع
  const handleQuickTogglePresent = async (student: Student) => {
    const existingAtt = (attendanceRecords || []).find(
      a => a.studentId === student.id && a.date === selectedDate
    );
    const isCurrentlyPresent = existingAtt?.status === 'present';

    await saveAttendance({
      ...(existingAtt || {}),
      studentId: student.id,
      circleId: selectedCircleId || student.circleId || '',
      date: selectedDate,
      status: isCurrentlyPresent ? 'unrecorded' : 'present',
      earlyPrepCardSent: isCurrentlyPresent ? false : !!existingAtt?.earlyPrepCardSent
    });
  };

  const isSelectedDateThursday = useMemo(() => {
    const d = new Date(`${selectedDate}T12:00:00`);
    if (!Number.isNaN(d.getTime()) && d.getDay() === 4) return true;
    const hijriWeekday = getHijriParts(selectedDate).weekday || '';
    return hijriWeekday.includes('الخميس');
  }, [selectedDate]);

  const dayPresentCount = useMemo(() => {
    return circleStudents.filter(st => {
      const att = (attendanceRecords || []).find(a => a.studentId === st.id && a.date === selectedDate);
      const rec = (dailyRecords || []).find(r => r.studentId === st.id && r.date === selectedDate);
      return att?.status === 'present' || !!rec;
    }).length;
  }, [circleStudents, attendanceRecords, dailyRecords, selectedDate]);

  const dayEarlyPrepCount = useMemo(() => {
    return circleStudents.filter(st => {
      const att = (attendanceRecords || []).find(a => a.studentId === st.id && a.date === selectedDate);
      return !!att?.earlyPrepCardSent;
    }).length;
  }, [circleStudents, attendanceRecords, selectedDate]);

  return (
    <div className="space-y-6 text-right pb-12" dir="rtl">
      {/* شريط رأس الصفحة */}
      <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl border border-[#E2D5CC] dark:border-stone-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-2xl">📖</span>
            <h1 className="text-xl font-bold text-stone-800 dark:text-stone-100 font-quran">
              سجل التسميع والمراجعة اليومية (الأحد – الأربعاء)
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
              حضور وتحضير مبكر تلقائي ⚡
            </span>
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            رصد الحفظ الجديد والمراجعة يسجّل الطالبة «حاضرة» تلقائياً، مع زر «⚡ تحضير مبكر» المباشر في كل صف
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <HijriDateNavigationBar
            selectedDate={selectedDate}
            onChangeDate={setSelectedDate}
          />

          <div className="flex items-center gap-1.5 bg-[#FAF7F5] dark:bg-stone-800 px-3 py-2 rounded-2xl border border-[#E2D5CC] dark:border-stone-700">
            <select
              value={selectedCircleId}
              onChange={e => setSelectedCircleId(e.target.value)}
              className="bg-transparent text-xs font-bold text-stone-800 dark:text-stone-100 outline-hidden cursor-pointer"
            >
              {availableCircles.map(c => (
                <option key={c.id} value={c.id} className="dark:bg-stone-900">
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* تنبيه سير عمل يوم الخميس (التحديات والمراجعة الثنائية) */}
      {isSelectedDateThursday && (
        <div className="bg-emerald-50/90 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200 font-bold">
            <span className="text-base">🏆</span>
            <span>
              يوم الخميس مخصص حصرياً لـ «التحديات والمراجعة الثنائية» — لا يُطلب إدخال تسميع يومي منفصل هنا، ويتم تسجيل حضور الخميس تلقائياً عند تقييم التحدي أو منح (+2 نقاط) في قسم التحديات.
            </span>
          </div>
        </div>
      )}

      {/* قائمة الطالبات */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl border border-[#E2D5CC] dark:border-stone-800 overflow-hidden shadow-xs space-y-3">
        <div className="p-5 border-b border-stone-100 dark:border-stone-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm text-stone-800 dark:text-stone-100">
              طالبات حلقة ({selectedCircle?.name || 'المحددة'}) — تاريخ: {formatHijriDate(selectedDate)}
            </h3>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-stone-500">
              <span>إجمالي طالبات الحلقة: <strong>{circleStudents.length}</strong> طالبة</span>
              <span>•</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                الحاضرات: {dayPresentCount} / {circleStudents.length} ✅
              </span>
              <span>•</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                ⚡ تحضير مبكر: {dayEarlyPrepCount}
              </span>
            </div>
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
            const attRecord = (attendanceRecords || []).find(
              a => a.studentId === st.id && a.date === selectedDate
            );
            const isEarlyPrep = !!attRecord?.earlyPrepCardSent;
            const isPresent = attRecord?.status === 'present' || !!record;

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
                    <span className="privacy-student-name">{st.name.charAt(0)}</span>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h4 className="font-bold text-stone-900 dark:text-stone-100 text-sm group-hover:text-[#8E5364] dark:group-hover:text-[#E8BDC8] transition flex items-center gap-1">
                        <span className="privacy-student-name">{st.name}</span>
                        <FileText className="w-3.5 h-3.5 text-stone-400 group-hover:text-[#8E5364] transition opacity-70" />
                      </h4>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          handleQuickTogglePresent(st);
                        }}
                        title={isPresent ? 'الطالبة مسجلة حاضرة — انقري لتغيير الحالة' : 'انقري لتسجيل الطالبة حاضرة مباشرة'}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition cursor-pointer ${
                          isPresent
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200/70 dark:border-emerald-800/50'
                            : 'bg-stone-100 dark:bg-stone-800 text-stone-500 border-stone-200 dark:border-stone-700 hover:border-emerald-300 hover:text-emerald-700'
                        }`}
                      >
                        {isPresent ? 'حاضرة ✅' : 'تسجيل حضور +'}
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-stone-400 font-mono">
                        <span className="privacy-phone">{st.code}</span>
                      </span>
                      <span className="text-[10px] text-[#8E5364] dark:text-[#E8BDC8] font-bold underline">
                        فتح كشف السجل 📜
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                  {record ? (
                    <div className="flex items-center gap-3 text-left">
                      <div className="text-xs text-stone-500 text-right">
                        <span>الدرجة: <strong className="text-[#8E5364] font-bold"><span className="privacy-score-digit">{record.recitationScore}</span>/10</strong></span>
                        <span className="mx-1.5">•</span>
                        <span>الأوجه: <strong className="text-stone-800 dark:text-stone-200"><span className="privacy-score-digit">{record.newMemorizationPages ?? 1}</span></strong></span>
                        <span className="mx-1.5">•</span>
                        <span>أخطاء: <strong className="text-rose-600"><span className="privacy-score-digit">{record.memorizationMistakes ?? 0}</span></strong></span>
                        <span className="mx-1.5">•</span>
                        <span>تنبيهات: <strong className="text-amber-600"><span className="privacy-score-digit">{record.hintsCount ?? 0}</span></strong></span>
                        {typeof record.preparationScore === 'number' && (
                          <>
                            <span className="mx-1.5">•</span>
                            <span className="text-emerald-700 dark:text-emerald-400 font-bold">التحضير: <strong><span className="privacy-score-digit">{record.preparationScore}</span>/10</strong></span>
                          </>
                        )}
                      </div>
                      <div className="px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                        تم الرصد ✅
                      </div>
                    </div>
                  ) : isSelectedDateThursday ? (
                    <span className="px-3 py-1 rounded-xl bg-[#FAF6F2] dark:bg-stone-800 text-[#8E5364] dark:text-[#E8BDC8] border border-[#E8DFD8] dark:border-stone-700 text-xs font-bold">
                      يوم التحديات والمراجعة الثنائية 🏆
                    </span>
                  ) : (
                    <span className="text-xs text-stone-400">بانتظار رصد التسميع</span>
                  )}

                  <div className="flex items-center gap-1.5">
                    {/* زر التحضير المبكر السريع بنقرة واحدة (أخضر ممتلئ عند التفعيل، إطار محايد عند عدم التفعيل) */}
                    <button
                      type="button"
                      onClick={() => handleQuickToggleEarlyPrep(st)}
                      title={
                        isEarlyPrep
                          ? 'مفعّل: الطالبة مسجلة حاضرة + تحضير مبكر — انقري للإلغاء'
                          : 'انقري لتسجيل الطالبة حاضرة + تحضير مبكر فوراً'
                      }
                      className={`px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer active:scale-95 select-none border ${
                        isEarlyPrep
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-500/20'
                          : 'bg-white dark:bg-stone-800 hover:bg-emerald-50 text-stone-600 dark:text-stone-300 hover:text-emerald-700 border-stone-300 dark:border-stone-700 hover:border-emerald-400'
                      }`}
                    >
                      <span>⚡ تحضير مبكر</span>
                      {isEarlyPrep && <span>✓</span>}
                    </button>

                    {(!isSelectedDateThursday || record) && (
                      <button
                        type="button"
                        onClick={() => handleOpenModal(st.id)}
                        className="px-4 py-2 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                        title={record ? 'تعديل هذا الرصد' : 'رصد التسميع اليومي (يسجل الطالبة حاضرة تلقائياً)'}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{record ? 'تعديل الرصد' : 'رصد التسميع'}</span>
                      </button>
                    )}

                    {record && (
                      <button
                        type="button"
                        onClick={() => setRecordToDelete(record)}
                        className="p-2 text-stone-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition cursor-pointer border border-stone-200 dark:border-stone-800"
                        title="حذف هذا الرصد"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
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
                <span className="text-[11px] text-stone-400 font-bold">
                  {formatHijriDate(selectedDate)} • يُسجَّل الحضور تلقائياً عند الحفظ ✅
                </span>
              </div>
              <div className="flex items-center gap-2">
                {(() => {
                  const modalAtt = (attendanceRecords || []).find(
                    a => a.studentId === modalStudent.id && a.date === selectedDate
                  );
                  const modalEarly = !!modalAtt?.earlyPrepCardSent;
                  return (
                    <button
                      type="button"
                      onClick={() => handleQuickToggleEarlyPrep(modalStudent)}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold inline-flex items-center gap-1 transition cursor-pointer border ${
                        modalEarly
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs ring-2 ring-emerald-500/20'
                          : 'bg-white text-stone-600 border-stone-300 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-400'
                      }`}
                    >
                      <span>⚡ تحضير مبكر</span>
                      {modalEarly && <span>✓</span>}
                    </button>
                  );
                })()}
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

              {/* مقرر الحفظ الجديد (يتزامن مع تفعيل/تعطيل القسم في الخطة الشهرية) */}
              {isNewMemPlanEnabled ? (
                <div className="p-3.5 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                      <Bookmark className="w-3.5 h-3.5 text-[#8E5364]" />
                      <span>مقرر الحفظ الجديد:</span>
                    </span>
                    
                    <div className="flex items-center gap-1.5 bg-[#FAF7F5] dark:bg-stone-800 px-2.5 py-1 rounded-xl border border-[#E2D5CC] dark:border-stone-700">
                      <span className="text-[11px] text-stone-500 font-bold">الأوجه المنجزة:</span>
                      <input
                        type="number"
                        min="0"
                        max="2"
                        step="0.25"
                        value={form.newPages}
                        onChange={e => setForm({ ...form, newPages: Math.min(2, Math.max(0, parseFloat(e.target.value) || 0)) })}
                        className="w-16 text-center text-xs font-extrabold text-[#8E5364] dark:text-[#E8BDC8] font-mono bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg py-0.5 outline-hidden focus:border-[#8E5364]"
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
              ) : (
                <div className="p-3.5 bg-stone-100/80 dark:bg-stone-800/50 rounded-2xl border border-stone-200 dark:border-stone-700 flex items-center justify-between text-xs text-stone-500">
                  <span className="font-bold">١. خطة ومقرر الحفظ الجديد</span>
                  <span className="px-2.5 py-1 rounded-full bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300 text-[11px] font-bold">
                    معطّل لهذا الشهر في الخطة الشهرية 🔒
                  </span>
                </div>
              )}

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
            {isMinorRevPlanEnabled ? (
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
                      step="0.25"
                      value={form.minorPages}
                      onChange={e => setForm({ ...form, minorPages: Math.max(0, parseFloat(e.target.value) || 0) })}
                      className="w-16 text-center text-xs font-extrabold text-[#8E5364] dark:text-[#E8BDC8] font-mono bg-[#FAF7F5] dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg py-0.5 outline-hidden focus:border-[#8E5364]"
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
            ) : (
              <div className="p-3.5 rounded-2xl bg-stone-100/80 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 flex items-center justify-between text-xs text-stone-500">
                <span className="font-bold">٢. خطة المراجعة الصغرى (الربط القريب)</span>
                <span className="px-2.5 py-1 rounded-full bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300 text-[11px] font-bold">
                  معطّل لهذا الشهر في الخطة الشهرية 🔒
                </span>
              </div>
            )}

            {/* ===================== 3. مراجعة التمكين (المراجعة الكبرى) ===================== */}
            {isTamkeenRevPlanEnabled ? (
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
                      step="0.25"
                      value={form.majorPages}
                      onChange={e => setForm({ ...form, majorPages: Math.max(0, parseFloat(e.target.value) || 0) })}
                      className="w-16 text-center text-xs font-extrabold text-[#8E5364] dark:text-[#E8BDC8] font-mono bg-[#FAF7F5] dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg py-0.5 outline-hidden focus:border-[#8E5364]"
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
            ) : (
              <div className="p-3.5 rounded-2xl bg-stone-100/80 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 flex items-center justify-between text-xs text-stone-500">
                <span className="font-bold">٣. خطة مراجعة التمكين (المراجعة الكبرى)</span>
                <span className="px-2.5 py-1 rounded-full bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300 text-[11px] font-bold">
                  معطّل لهذا الشهر في الخطة الشهرية 🔒
                </span>
              </div>
            )}

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

              {/* بطاقة حساب درجة التحضير اليومي الآلية من 10 مع التحديث الحي المباشر */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-l from-emerald-50 via-[#FAF7F5] to-amber-50 dark:from-emerald-950/30 dark:via-stone-900 dark:to-amber-950/30 border border-emerald-300 dark:border-emerald-700/60 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base">⭐</span>
                    <span className="text-xs font-bold text-stone-800 dark:text-stone-100">
                      درجة التحضير اليومي الآلية:
                    </span>
                    <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full ${
                      calculatedPrepScore >= 9
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : calculatedPrepScore >= 7
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                    }`}>
                      {calculatedPrepScore >= 9
                        ? 'ممتازة وملتزمة بالتحضير المتقن ⭐'
                        : calculatedPrepScore >= 7
                        ? 'جيدة جداً - تحتاج زيادة التكرار 📈'
                        : 'دون المستوى المطلوب - يلزم العناية بالاستماع والتكرار ⚠️'}
                    </span>
                  </div>
                  <p className="text-[10px] text-stone-500 dark:text-stone-400">
                    الاستماع للمقرئ (3 درجات) • التلاوة نظراً (3 درجات) • التكرار المتقن للوجه (4 درجات)
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-center bg-white dark:bg-stone-800 px-3.5 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 shadow-2xs">
                    <span className="block text-[9px] text-stone-400 font-bold">الدرجة من 10</span>
                    <span className="text-2xl font-black font-mono text-emerald-700 dark:text-emerald-400">
                      {calculatedPrepScore} <span className="text-xs text-stone-400 font-normal">/ 10</span>
                    </span>
                  </div>
                </div>
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
              </div>

              {/* التقييم التحفيزي المباشر لمعايير التحضير والإتقان */}
              {(() => {
                const totalCrit = activeCriteriaList.length;
                const fullCritCount = activeCriteriaList.filter(c => (criteriaCounts[c.id] ?? 0) >= c.count).length;
                const anyCritCount = activeCriteriaList.filter(c => (criteriaCounts[c.id] ?? 0) > 0).length;
                const prepStatus: 'full' | 'partial' | 'needs_care' =
                  totalCrit > 0 && fullCritCount === totalCrit
                    ? 'full'
                    : anyCritCount > 0
                      ? 'partial'
                      : 'needs_care';

                return (
                  <div className="p-3 rounded-2xl bg-white dark:bg-stone-800 border border-[#E2D5CC] dark:border-stone-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-stone-600 dark:text-stone-300">
                        تقييم التحضير اليومي (الاستماع • التلاوة • التكرار):
                      </span>
                      {prepStatus === 'full' && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold animate-in fade-in">
                          +1 تشجيع الإتقان الكامل 🎉
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const next: Record<string, number> = {};
                          activeCriteriaList.forEach(c => { next[c.id] = c.count; });
                          setCriteriaCounts(next);
                        }}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                          prepStatus === 'full'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-500/20'
                            : 'bg-[#FAF7F5] dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:border-emerald-300'
                        }`}
                      >
                        <span>تحضير كامل ومتقن ⭐</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const next: Record<string, number> = {};
                          activeCriteriaList.forEach(c => {
                            next[c.id] = Math.max(1, Math.floor(c.count / 2));
                          });
                          setCriteriaCounts(next);
                        }}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                          prepStatus === 'partial'
                            ? 'bg-amber-500 text-white border-amber-500 shadow-xs ring-2 ring-amber-400/20'
                            : 'bg-[#FAF7F5] dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:border-amber-300'
                        }`}
                      >
                        <span>تحضير جزئي ⏳</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const next: Record<string, number> = {};
                          activeCriteriaList.forEach(c => { next[c.id] = 0; });
                          setCriteriaCounts(next);
                        }}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                          prepStatus === 'needs_care'
                            ? 'bg-rose-600 text-white border-rose-600 shadow-xs ring-2 ring-rose-500/20'
                            : 'bg-[#FAF7F5] dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:border-rose-300'
                        }`}
                      >
                        <span>يحتاج إلى عناية واهتمام 💡</span>
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* وسام التميز لليوم */}
              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 cursor-pointer hover:border-amber-400 transition">
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
                  <span className="text-[10px] text-stone-500 font-bold block">إجمالي الحفظ الجديد المنجز</span>
                  <p className="text-base sm:text-lg font-bold text-[#8E5364] dark:text-[#E8BDC8] mt-0.5">
                    {studentStats.totalPages} <span className="text-xs font-normal">أوجه منجزة</span>
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
                            <th className="p-2.5 text-center">أوجه الحفظ الجديد</th>
                            <th className="p-2.5 text-center">أخطاء / تنبيهات</th>
                            <th className="p-2.5 text-center">الدرجة</th>
                            <th className="p-2.5">المراجعة والتمكين</th>
                            <th className="p-2.5">ملاحظات المعلمة</th>
                            <th className="p-2.5 text-center">الإجراءات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                          {studentRecords.map(r => {
                            return (
                              <tr key={r.id || r.date} className="hover:bg-stone-50/60 dark:hover:bg-stone-800/40">
                                <td className="p-2.5 font-bold whitespace-nowrap">
                                  <div>{formatHijriShort(r.date)}</div>
                                  <span className="text-[10px] text-stone-400 font-normal">{r.dayName || getHijriParts(r.date).weekday}</span>
                                </td>
                                <td className="p-2.5 font-bold text-stone-800 dark:text-stone-200">
                                  {r.requiredPortionText || 'مقرر الحفظ اليومي'}
                                </td>
                                <td className="p-2.5 text-center font-mono font-bold">
                                  <div className="flex flex-col items-center justify-center gap-0.5">
                                    <span className="text-[#8E5364] dark:text-[#E8BDC8]">
                                      {r.newMemorizationPages ?? 1} ص
                                    </span>
                                  </div>
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
                                <td className="p-2.5 text-[10px] text-stone-600 dark:text-stone-400 max-w-[150px]">
                                  <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] inline-flex items-center gap-1 ${
                                    r.revisionCompleted
                                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                      : 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400'
                                  }`}>
                                    {r.revisionCompleted ? 'منجزة بالشروط ✅' : 'لم تُسرد بعد'}
                                  </span>
                                </td>
                                <td className="p-2.5 text-[10px] text-stone-500 italic max-w-[140px] truncate">
                                  {r.notes || '—'}
                                </td>
                                <td className="p-2.5 text-center whitespace-nowrap">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const sid = viewingStudentRecord.id;
                                        setViewingStudentRecord(null);
                                        handleOpenModal(sid, r);
                                      }}
                                      className="p-1.5 text-stone-500 hover:text-[#8E5364] hover:bg-[#FAF0F3] rounded-lg transition cursor-pointer"
                                      title="تعديل هذا السجل السابق"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setRecordToDelete(r)}
                                      className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                      title="حذف هذا السجل"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
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

      {/* Delete Confirmation Alert Modal for Recitation Record */}
      {recordToDelete && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-stone-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200 dark:border-stone-800 text-right space-y-4" dir="rtl">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-stone-900 dark:text-stone-100 text-base font-quran">
                تأكيد حذف سجل التسميع
              </h3>
              <p className="text-sm font-bold text-rose-700 dark:text-rose-400">
                هل أنت متأكد من حذف هذا السجل؟
              </p>
              <p className="text-xs text-stone-600 dark:text-stone-400 font-semibold mt-1">
                تاريخ: {formatHijriDate(recordToDelete.date)} • {recordToDelete.requiredPortionText || 'مقرر التسميع'}
              </p>
            </div>

            <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed bg-[#FCFAF8] dark:bg-stone-800/60 p-3 rounded-2xl border border-stone-200 dark:border-stone-700 text-center">
              سيتم حذف سجل التسميع فوراً وتحديث درجات الطالبة سحابياً.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setRecordToDelete(null)}
                className="px-4 py-2 text-stone-600 dark:text-stone-300 text-xs font-bold rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={async () => {
                  const rid = recordToDelete.id;
                  setRecordToDelete(null);
                  await deleteDailyRecord(rid);
                  showToast?.('تم حذف سجل التسميع ومزامنة التغييرات سحابياً 🗑️');
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
