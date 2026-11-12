import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { QURAN_SURAHS, getSurahByNumber, getAyahCount } from '../data/quranData';
import {
  Plus, Copy, CheckCircle2,
  ChevronDown, ChevronUp, Edit, Lock, Unlock,
  CalendarRange, Star, BarChart3, Zap, HeartHandshake, BookOpen
} from 'lucide-react';
import { MonthlyPlan, PlanBranchConfig } from '../types';
import { summarizeDailyPageProgress } from '../services/recitationProgress';

// قيم العداد التدريجي الموحد (0.25 ربع وجه لكل ضغطة) لجميع الأقسام الثلاثة
const NEW_MEM_STEPS = Array.from({ length: 41 }, (_, i) => Number((i * 0.25).toFixed(2))); // 0 إلى 10.0 بزيادة 0.25
const REVIEW_STEPS = Array.from({ length: 121 }, (_, i) => Number((i * 0.25).toFixed(2))); // 0 إلى 30.0 بزيادة 0.25

// دروس القاعدة النورانية السبعة عشر المعتمدة
export const NOORANIA_LESSONS = [
  { number: 1, title: 'الدرس الأول: حروف الهجاء المفردة' },
  { number: 2, title: 'الدرس الثاني: حروف الهجاء المركبة' },
  { number: 3, title: 'الدرس الثالث: الحروف المقطعة' },
  { number: 4, title: 'الدرس الرابع: الحروف المتحركة (الحركات)' },
  { number: 5, title: 'الدرس الخامس: الحروف المنونة (التنوين)' },
  { number: 6, title: 'الدرس السادس: تدريبات على الحركات والتنوين' },
  { number: 7, title: 'الدرس السابع: الألف الصغيرة والياء الصغيرة والواو الصغيرة' },
  { number: 8, title: 'الدرس الثامن: حروف المد واللين' },
  { number: 9, title: 'الدرس التاسع: تدريبات على التنوين وأحرف المد واللين' },
  { number: 10, title: 'الدرس العاشر: السكون' },
  { number: 11, title: 'الدرس الحادي عشر: تدريبات على السكون' },
  { number: 12, title: 'الدرس الثاني عشر: الشدة' },
  { number: 13, title: 'الدرس الثالث عشر: تدريبات على الشدة' },
  { number: 14, title: 'الدرس الرابع عشر: تدريبات على الشدة مع السكون' },
  { number: 15, title: 'الدرس الخامس عشر: تدريبات على الشدتين في كلمة' },
  { number: 16, title: 'الدرس السادس عشر: تدريبات على الشدة والسكون مع المد' },
  { number: 17, title: 'الدرس السابع عشر: التدريبات العامة (الأخير)' }
];

export const isStudentDefaultNoorania = (studentName?: string): boolean => {
  if (!studentName) return false;
  const normalized = studentName.trim();
  return normalized.includes('خولة حميد') || normalized.includes('خولة الحربي') || normalized.includes('خولة');
};

export const formatNooraniaRangeLabel = (
  fromLesson?: number,
  toLesson?: number,
  customLessonText?: string
): string => {
  if (customLessonText && customLessonText.trim()) {
    return customLessonText.trim();
  }
  const f = NOORANIA_LESSONS.find(l => l.number === (fromLesson || 1)) || NOORANIA_LESSONS[0];
  const t = NOORANIA_LESSONS.find(l => l.number === (toLesson || f.number)) || f;
  if (f.number === t.number) {
    return f.title;
  }
  return `من ${f.title} إلى ${t.title}`;
};

export const formatDailyStepLabel = (val: number, _isNewMemorization = false, isNoorania = false): string => {
  const num = Math.round((Number(val) || 0) * 100) / 100;
  if (num <= 0) return '0 (غير محدد)';

  if (isNoorania) {
    if (num === 0.25) return '0.25 (ربع وجه / ربع درس)';
    if (num === 0.5) return '0.5 (نصف وجه / نصف درس)';
    if (num === 0.75) return '0.75 (ثلاثة أرباع وجه / درس)';
    if (num === 1) return '1.0 (وجه كامل / درس كامل)';
    if (num === 1.25) return '1.25 (وجه وربع / درس وربع)';
    if (num === 1.5) return '1.5 (وجه ونصف / درس ونصف)';
    if (num === 1.75) return '1.75 (وجه وثلاثة أرباع)';
    if (num === 2) return '2.0 (وجهان / درسان)';
    if (num === 2.25) return '2.25 (وجهان وربع)';
    if (num === 2.5) return '2.5 (وجهان ونصف)';
    if (num === 2.75) return '2.75 (وجهان وثلاثة أرباع)';
  }

  if (num === 0.25) return '0.25 (ربع وجه)';
  if (num === 0.5) return '0.5 (نصف وجه)';
  if (num === 0.75) return '0.75 (ثلاثة أرباع وجه)';
  if (num === 1) return '1.0 (وجه كامل)';
  if (num === 1.25) return '1.25 (وجه وربع)';
  if (num === 1.5) return '1.5 (وجه ونصف)';
  if (num === 1.75) return '1.75 (وجه وثلاثة أرباع)';
  if (num === 2) return '2.0 (وجهان)';
  if (num === 2.25) return '2.25 (وجهان وربع)';
  if (num === 2.5) return '2.5 (وجهان ونصف)';
  if (num === 2.75) return '2.75 (وجهان وثلاثة أرباع)';

  const whole = Math.floor(num);
  const frac = Math.round((num - whole) * 100) / 100;
  const unitPlural = whole >= 3 && whole <= 10 ? 'أوجه' : 'وجهاً';

  if (frac === 0) {
    const formattedWhole = num.toFixed(1);
    if (whole === 3) return '3.0 (٣ أوجه)';
    if (whole === 4) return '4.0 (٤ أوجه)';
    if (whole === 5) return '5.0 (٥ أوجه - ربع حزب)';
    if (whole === 6) return '6.0 (٦ أوجه)';
    if (whole === 7) return '7.0 (٧ أوجه)';
    if (whole === 8) return '8.0 (٨ أوجه)';
    if (whole === 9) return '9.0 (٩ أوجه)';
    if (whole === 10) return '10.0 (١٠ أوجه - نصف جزء)';
    if (whole === 20) return '20.0 (٢٠ وجهاً - جزء كامل)';
    return `${formattedWhole} (${whole} ${unitPlural})`;
  }
  if (frac === 0.25) {
    return `${num} (${whole} ${unitPlural} وربع)`;
  }
  if (frac === 0.5) {
    return `${num} (${whole} ${unitPlural} ونصف)`;
  }
  if (frac === 0.75) {
    return `${num} (${whole} ${unitPlural} وثلاثة أرباع)`;
  }
  return `${num} وجه`;
};

const parseDailyStepFromLegacy = (branch: any, fallback: number, isNewMem: boolean): number => {
  const maxAllowed = isNewMem ? 10.0 : 30.0;
  if (typeof branch?.dailyAmountPages === 'number' && Number.isFinite(branch.dailyAmountPages)) {
    const clamped = Math.min(maxAllowed, Math.max(0, branch.dailyAmountPages));
    // Snap to closest 0.25 increment
    return Math.round(clamped * 4) / 4;
  }
  const text = String(branch?.targetDailyAmount || '');
  if (!text) return fallback;
  const numMatch = text.match(/(\d+(?:\.\d+)?)/);
  if (numMatch) {
    const parsed = parseFloat(numMatch[1]);
    if (Number.isFinite(parsed)) {
      return Math.min(maxAllowed, Math.max(0, Math.round(parsed * 4) / 4));
    }
  }
  if (text.includes('ثلاثة أرباع')) return 0.75;
  if (text.includes('وربع')) return 1.25;
  if (text.includes('ونصف')) return 1.5;
  if (text.includes('ربع')) return 0.25;
  if (text.includes('نصف')) return 0.5;
  if (text.includes('وجهين') || text.includes('وجهان') || text.includes('صفحتين')) return 2.0;
  if (text.includes('وجه') || text.includes('صفحة')) return 1.0;
  return fallback;
};

export const MonthlyPlansView: React.FC = () => {
  const {
    monthlyPlans, studentPlans, students, circles, tracks, dailyRecords,
    createMonthlyPlan, updateMonthlyPlan, duplicateMonthlyPlan, saveStudentPlan,
    showToast, selectedTrackId
  } = useApp();

  const availablePlans = useMemo(() => {
    if (!selectedTrackId || selectedTrackId === 'all') return monthlyPlans;
    return monthlyPlans.filter(p => !p.trackId || p.trackId === selectedTrackId);
  }, [monthlyPlans, selectedTrackId]);

  const availableStudents = useMemo(() => {
    if (!selectedTrackId || selectedTrackId === 'all') return students;
    return students.filter(s => s.trackId === selectedTrackId);
  }, [students, selectedTrackId]);

  const [selectedPlanId, setSelectedPlanId] = useState<string>(availablePlans[0]?.id || monthlyPlans[0]?.id || 'mp-1');
  const [selectedStudentId, setSelectedStudentId] = useState<string>(availableStudents[0]?.id || students[0]?.id || 's-1');
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState(false);

  React.useEffect(() => {
    if (availablePlans.length > 0 && !availablePlans.some(p => p.id === selectedPlanId)) {
      setSelectedPlanId(availablePlans[0].id);
    }
  }, [availablePlans, selectedPlanId]);

  React.useEffect(() => {
    if (availableStudents.length > 0 && !availableStudents.some(s => s.id === selectedStudentId)) {
      setSelectedStudentId(availableStudents[0].id);
    }
  }, [availableStudents, selectedStudentId]);

  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MonthlyPlan | null>(null);

  const [planForm, setPlanForm] = useState({
    title: '',
    trackId: (selectedTrackId && selectedTrackId !== 'all') ? selectedTrackId : (tracks[0]?.id || 't-1'),
    hijriMonth: 'ربيع الآخر - جمادى الأولى',
    hijriYear: '1446',
    startDateHijri: '٣٠ ربيع الآخر',
    endDateHijri: '٢٩ جمادى الأولى',
    examDateHijri: '٢٥ جمادى الأولى',
    scheduleDays: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء'],
    thursdayFocus: 'مخصص للتحديات والمراجعة الثنائية بحسب التحدي المعتمد'
  });

  const currentPlan = availablePlans.find(p => p.id === selectedPlanId) || availablePlans[0] || monthlyPlans[0];
  const selectedStudent = availableStudents.find(s => s.id === selectedStudentId) || availableStudents[0] || students[0];

  // حساب الصفحات المنجزة تلقائياً من سجل الحفظ والتسميع للطالبة المحددة
  const autoProgress = useMemo(() => {
    if (!selectedStudent) {
      return {
        newMemorizationPagesDone: 0,
        minorRevisionPagesDone: 0,
        tamkeenRevisionPagesDone: 0,
        revisionPagesDone: 0
      };
    }
    const studentDailyRecords = (dailyRecords || []).filter(
      r => r.studentId === selectedStudent.id && r.status === 'completed'
    );
    return summarizeDailyPageProgress(studentDailyRecords);
  }, [dailyRecords, selectedStudent]);

  // حالة تعديل مقرر الطالبة الفردي (الفروع الثلاثة المستقلة)
  const [editingStudentPlan, setEditingStudentPlan] = useState(false);
  const [studentPlanForm, setStudentPlanForm] = useState<{
    newMemorization: PlanBranchConfig;
    minorRevision: PlanBranchConfig;
    tamkeenRevision: PlanBranchConfig;
  }>({
    newMemorization: {
      enabled: true,
      isFreeMemorization: false,
      fromSurah: 2,
      fromAyah: 1,
      toSurah: 2,
      toAyah: 50,
      targetPages: 8,
      dailyAmountPages: 1.0,
      targetDailyAmount: formatDailyStepLabel(1.0, true),
      teacherNotes: ''
    },
    minorRevision: {
      enabled: true,
      isNoorania: false,
      fromLesson: 1,
      toLesson: 5,
      customLessonText: '',
      fromSurah: 2,
      fromAyah: 1,
      toSurah: 2,
      toAyah: 25,
      targetPages: 4,
      dailyAmountPages: 1.0,
      targetDailyAmount: formatDailyStepLabel(1.0, false),
      revisionType: 'صغرى',
      teacherNotes: ''
    },
    tamkeenRevision: {
      enabled: true,
      fromSurah: 1,
      fromAyah: 1,
      toSurah: 2,
      toAyah: 25,
      targetPages: 4,
      dailyAmountPages: 1.0,
      targetDailyAmount: formatDailyStepLabel(1.0, false),
      revisionType: 'تمكين',
      teacherNotes: ''
    }
  });

  const lastSelectedStudentIdRef = React.useRef(selectedStudentId);
  const lastPlanIdRef = React.useRef(currentPlan?.id);

  const buildBranchesFromExisting = React.useCallback((existing: any, studentName?: string) => {
    const defaultNoorania = isStudentDefaultNoorania(studentName);
    if (!existing) {
      return {
        newMemorization: {
          enabled: true,
          isFreeMemorization: false,
          fromSurah: 2,
          fromAyah: 1,
          toSurah: 2,
          toAyah: 25,
          targetPages: 5,
          dailyAmountPages: 0.5,
          targetDailyAmount: formatDailyStepLabel(0.5, true),
          teacherNotes: ''
        },
        minorRevision: {
          enabled: true,
          isNoorania: defaultNoorania,
          fromLesson: 1,
          toLesson: 6,
          customLessonText: defaultNoorania ? 'من الدرس الأول إلى الدرس السادس (مع التهجي والصفحات)' : '',
          fromSurah: 2,
          fromAyah: 1,
          toSurah: 2,
          toAyah: 25,
          targetPages: defaultNoorania ? 6 : 4,
          dailyAmountPages: 1.0,
          targetDailyAmount: formatDailyStepLabel(1.0, false, defaultNoorania),
          revisionType: defaultNoorania ? 'نورانية' : 'صغرى',
          teacherNotes: ''
        },
        tamkeenRevision: {
          enabled: true,
          fromSurah: 1,
          fromAyah: 1,
          toSurah: 2,
          toAyah: 25,
          targetPages: 4,
          dailyAmountPages: 1.0,
          targetDailyAmount: formatDailyStepLabel(1.0, false),
          revisionType: 'تمكين',
          teacherNotes: ''
        }
      };
    }

    const newStep = parseDailyStepFromLegacy(existing.newMemorization, 1.0, true);
    const rawMinor = existing.minorRevision || (existing.revision?.revisionType === 'صغرى' || existing.revision?.revisionType === 'نورانية' ? existing.revision : null);
    const rawTamkeen = existing.tamkeenRevision || (existing.revision?.revisionType !== 'صغرى' && existing.revision?.revisionType !== 'نورانية' ? existing.revision : null);

    const isMinorNoorania =
      typeof rawMinor?.isNoorania === 'boolean'
        ? rawMinor.isNoorania
        : rawMinor?.revisionType === 'نورانية'
        ? true
        : defaultNoorania;

    const minorStep = parseDailyStepFromLegacy(rawMinor, 1.0, false);
    const tamkeenStep = parseDailyStepFromLegacy(rawTamkeen, 1.0, false);

    return {
      newMemorization: {
        enabled: existing.newMemorization?.enabled !== false,
        isFreeMemorization: Boolean(existing.newMemorization?.isFreeMemorization),
        fromSurah: existing.newMemorization?.fromSurah || 2,
        fromAyah: existing.newMemorization?.fromAyah || 1,
        toSurah: existing.newMemorization?.toSurah || 2,
        toAyah: existing.newMemorization?.toAyah || 50,
        targetPages: existing.newMemorization?.targetPages ?? 8,
        dailyAmountPages: newStep,
        targetDailyAmount: existing.newMemorization?.isFreeMemorization
          ? 'الحفظ الحر (حسب الاستطاعة)'
          : formatDailyStepLabel(newStep, true),
        teacherNotes: existing.newMemorization?.teacherNotes || ''
      },
      minorRevision: {
        enabled: existing.minorRevision ? existing.minorRevision.enabled !== false : true,
        isNoorania: isMinorNoorania,
        fromLesson: rawMinor?.fromLesson || 1,
        toLesson: rawMinor?.toLesson || 6,
        customLessonText: rawMinor?.customLessonText || '',
        fromSurah: rawMinor?.fromSurah || 2,
        fromAyah: rawMinor?.fromAyah || 1,
        toSurah: rawMinor?.toSurah || 2,
        toAyah: rawMinor?.toAyah || 25,
        targetPages: rawMinor?.targetPages ?? (isMinorNoorania ? 6 : 4),
        dailyAmountPages: minorStep,
        targetDailyAmount: formatDailyStepLabel(minorStep, false, isMinorNoorania),
        revisionType: isMinorNoorania ? 'نورانية' : 'صغرى',
        teacherNotes: rawMinor?.teacherNotes || ''
      },
      tamkeenRevision: {
        enabled: existing.tamkeenRevision
          ? existing.tamkeenRevision.enabled !== false
          : (existing.revision?.enabled !== false),
        fromSurah: rawTamkeen?.fromSurah || 1,
        fromAyah: rawTamkeen?.fromAyah || 1,
        toSurah: rawTamkeen?.toSurah || 2,
        toAyah: rawTamkeen?.toAyah || 25,
        targetPages: rawTamkeen?.targetPages ?? 4,
        dailyAmountPages: tamkeenStep,
        targetDailyAmount: formatDailyStepLabel(tamkeenStep, false),
        revisionType: 'تمكين',
        teacherNotes: rawTamkeen?.teacherNotes || ''
      }
    };
  }, []);

  React.useEffect(() => {
    const studentChanged = lastSelectedStudentIdRef.current !== selectedStudentId;
    const planChanged = lastPlanIdRef.current !== currentPlan?.id;
    lastSelectedStudentIdRef.current = selectedStudentId;
    lastPlanIdRef.current = currentPlan?.id;

    if (studentChanged || planChanged) {
      setEditingStudentPlan(false);
    } else if (editingStudentPlan) {
      return;
    }

    const currentMonthPlan = studentPlans.find(
      sp => sp.studentId === selectedStudentId && sp.monthlyPlanId === currentPlan?.id
    );
    const existing = currentMonthPlan || studentPlans.find(sp => sp.studentId === selectedStudentId);
    setStudentPlanForm(buildBranchesFromExisting(existing, selectedStudent?.name));
  }, [selectedStudentId, currentPlan?.id, studentPlans, editingStudentPlan, buildBranchesFromExisting, selectedStudent?.name]);

  // حفظ فوري لخطة الطالبة في AppContext و localStorage
  const persistBranchesImmediately = async (
    nextBranches: {
      newMemorization: PlanBranchConfig;
      minorRevision: PlanBranchConfig;
      tamkeenRevision: PlanBranchConfig;
    },
    toastMsg?: string
  ) => {
    if (!selectedStudent || !currentPlan) return;
    const currentMonthPlan = studentPlans.find(
      sp => sp.studentId === selectedStudent.id && sp.monthlyPlanId === currentPlan.id
    );

    const combinedRevisionTarget =
      (nextBranches.minorRevision.enabled !== false ? (nextBranches.minorRevision.targetPages || 0) : 0) +
      (nextBranches.tamkeenRevision.enabled !== false ? (nextBranches.tamkeenRevision.targetPages || 0) : 0);

    const isMinorNoorania = !!nextBranches.minorRevision.isNoorania || nextBranches.minorRevision.revisionType === 'نورانية';

    await saveStudentPlan({
      id: currentMonthPlan?.id,
      studentId: selectedStudent.id,
      monthlyPlanId: currentPlan.id,
      newMemorization: {
        ...nextBranches.newMemorization,
        actualPages: autoProgress.newMemorizationPagesDone
      },
      minorRevision: {
        ...nextBranches.minorRevision,
        isNoorania: isMinorNoorania,
        actualPages: autoProgress.minorRevisionPagesDone,
        revisionType: isMinorNoorania ? 'نورانية' : 'صغرى'
      },
      tamkeenRevision: {
        ...nextBranches.tamkeenRevision,
        actualPages: autoProgress.tamkeenRevisionPagesDone,
        revisionType: 'تمكين'
      },
      revision: {
        ...nextBranches.tamkeenRevision,
        enabled: nextBranches.minorRevision.enabled !== false || nextBranches.tamkeenRevision.enabled !== false,
        targetPages: combinedRevisionTarget || 4,
        actualPages: autoProgress.revisionPagesDone,
        revisionType: 'تمكين',
        status: 'in_progress'
      },
      status: 'active'
    });

    if (toastMsg) {
      showToast(toastMsg, 'success');
    }
  };

  // تبديل القسم الأول بين "خطة الحفظ المحددة" و "الحفظ الحر (حسب الاستطاعة)" مع بقاء الطالبة في حلقتها ومسارها
  const handleToggleFreeMemorizationMode = async () => {
    const currentIsFree = Boolean(studentPlanForm.newMemorization.isFreeMemorization);
    const nextIsFree = !currentIsFree;
    const stepVal =
      typeof studentPlanForm.newMemorization.dailyAmountPages === 'number' &&
      studentPlanForm.newMemorization.dailyAmountPages > 0
        ? studentPlanForm.newMemorization.dailyAmountPages
        : 1.0;

    const nextForm = {
      ...studentPlanForm,
      newMemorization: {
        ...studentPlanForm.newMemorization,
        enabled: true,
        isFreeMemorization: nextIsFree,
        targetDailyAmount: nextIsFree
          ? 'الحفظ الحر (حسب الاستطاعة)'
          : formatDailyStepLabel(stepVal, true)
      }
    };
    setStudentPlanForm(nextForm);
    await persistBranchesImmediately(
      nextForm,
      nextIsFree
        ? `تم تفعيل «🔓 الحفظ الحر (حسب الاستطاعة)» للطالبة ${selectedStudent?.name || ''} داخل حلقتها الحالية 🌟`
        : `تم إعادة خطة الحفظ للطالبة ${selectedStudent?.name || ''} إلى المقرر الشهري المحدد 📖`
    );
  };

  // تبديل القسم الثاني بين "خطة المراجعة الصغرى" و "مسار القاعدة النورانية"
  const handleToggleNooraniaMode = async () => {
    const currentIsNoorania = !!studentPlanForm.minorRevision.isNoorania || studentPlanForm.minorRevision.revisionType === 'نورانية';
    const nextIsNoorania = !currentIsNoorania;
    const stepVal = typeof studentPlanForm.minorRevision.dailyAmountPages === 'number'
      ? studentPlanForm.minorRevision.dailyAmountPages
      : 1.0;

    const nextForm = {
      ...studentPlanForm,
      minorRevision: {
        ...studentPlanForm.minorRevision,
        enabled: true,
        isNoorania: nextIsNoorania,
        fromLesson: studentPlanForm.minorRevision.fromLesson || 1,
        toLesson: studentPlanForm.minorRevision.toLesson || 6,
        revisionType: nextIsNoorania ? 'نورانية' : 'صغرى',
        targetDailyAmount: formatDailyStepLabel(stepVal, false, nextIsNoorania)
      }
    };
    setStudentPlanForm(nextForm);
    await persistBranchesImmediately(
      nextForm,
      nextIsNoorania
        ? `تم تخصيص القسم الثاني ليكون «مسار القاعدة النورانية» للطالبة ${selectedStudent?.name || ''} 🔤`
        : `تم إعادة القسم الثاني ليكون «خطة المراجعة الصغرى» للطالبة ${selectedStudent?.name || ''} 🔄`
    );
  };

  // تبديل تفعيل/تعطيل أي فرع بنقرة واحدة مع حفظ فوري
  const handleToggleBranch = async (branchKey: 'newMemorization' | 'minorRevision' | 'tamkeenRevision') => {
    const currentEnabled = studentPlanForm[branchKey].enabled !== false;
    const nextEnabled = !currentEnabled;
    const isMinorNoorania = !!studentPlanForm.minorRevision.isNoorania || studentPlanForm.minorRevision.revisionType === 'نورانية';
    const branchTitle =
      branchKey === 'newMemorization'
        ? 'خطة ومقرر الحفظ الجديد'
        : branchKey === 'minorRevision'
          ? (isMinorNoorania ? 'مسار القاعدة النورانية' : 'خطة المراجعة الصغرى')
          : 'خطة مراجعة التمكين';

    const nextForm = {
      ...studentPlanForm,
      [branchKey]: {
        ...studentPlanForm[branchKey],
        enabled: nextEnabled
      }
    };
    setStudentPlanForm(nextForm);
    await persistBranchesImmediately(
      nextForm,
      nextEnabled
        ? `تم تفعيل «${branchTitle}» للطالبة ${selectedStudent?.name || ''} ✅`
        : `تم تعطيل «${branchTitle}» لهذا الشهر للطالبة ${selectedStudent?.name || ''} 🔒`
    );
  };

  // تحريك سهم المقدار اليومي المطلوب (▲ / ▼) بمقدار ربع وجه (0.25) مع حفظ فوري
  const handleStepDailyAmount = async (
    branchKey: 'newMemorization' | 'minorRevision' | 'tamkeenRevision',
    direction: 'up' | 'down'
  ) => {
    const branch = studentPlanForm[branchKey];
    if (branch.enabled === false) return;

    const isNewMem = branchKey === 'newMemorization';
    const isNooraniaBranch = branchKey === 'minorRevision' && (!!branch.isNoorania || branch.revisionType === 'نورانية');
    const maxLimit = isNewMem ? NEW_MEM_STEPS[NEW_MEM_STEPS.length - 1] : REVIEW_STEPS[REVIEW_STEPS.length - 1];
    const currentVal = typeof branch.dailyAmountPages === 'number' ? branch.dailyAmountPages : 1.0;

    // Snap current value to nearest 0.25 and step by +/- 0.25
    const snappedCurrent = Math.round(currentVal * 4) / 4;
    const rawNext = direction === 'up' ? snappedCurrent + 0.25 : snappedCurrent - 0.25;
    const nextVal = Math.max(0, Math.min(maxLimit, Math.round(rawNext * 4) / 4));

    if (nextVal === currentVal) return;

    const nextLabel = formatDailyStepLabel(nextVal, isNewMem, isNooraniaBranch);
    const nextForm = {
      ...studentPlanForm,
      [branchKey]: {
        ...branch,
        dailyAmountPages: nextVal,
        targetDailyAmount: nextLabel
      }
    };
    setStudentPlanForm(nextForm);
    await persistBranchesImmediately(nextForm);
  };

  // تحريك سهم إجمالي الصفحات المستهدفة للشهر بمقدار ربع وجه (0.25)
  const handleStepTargetPages = async (
    branchKey: 'newMemorization' | 'minorRevision' | 'tamkeenRevision',
    direction: 'up' | 'down',
    persistNow = false
  ) => {
    const branch = studentPlanForm[branchKey];
    if (branch.enabled === false) return;
    const currentTarget = Number(branch.targetPages) || 0;
    const rawNext = direction === 'up' ? currentTarget + 0.25 : currentTarget - 0.25;
    const nextTarget = Math.max(0.25, Math.round(rawNext * 100) / 100);
    const nextForm = {
      ...studentPlanForm,
      [branchKey]: {
        ...branch,
        targetPages: nextTarget
      }
    };
    setStudentPlanForm(nextForm);
    if (persistNow) {
      await persistBranchesImmediately(nextForm);
    }
  };

  const handleSaveStudentPlan = async () => {
    if (!selectedStudent || !currentPlan) return;
    await persistBranchesImmediately(
      studentPlanForm,
      `تم حفظ وتحديث مقرر الطالبة (${selectedStudent.name}) بنجاح ✅`
    );
    setEditingStudentPlan(false);
  };

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

  // الحسابات التلقائية لنسب الإنجاز لكل فرع (مع دعم الكسور العشرية مثل 4.25، 7.5، 12.75، 23.5 دون تقريب لأعداد صحيحة)
  const isNewEnabled = studentPlanForm.newMemorization.enabled !== false;
  const isFreeMem = Boolean(studentPlanForm.newMemorization.isFreeMemorization);
  const isMinorEnabled = studentPlanForm.minorRevision.enabled !== false;
  const isTamkeenEnabled = studentPlanForm.tamkeenRevision.enabled !== false;
  const isMinorNoorania = !!studentPlanForm.minorRevision.isNoorania || studentPlanForm.minorRevision.revisionType === 'نورانية';

  const parseDecimalTarget = (val: any, fallback: number): number => {
    const num = Number(val);
    return Number.isFinite(num) && num > 0 ? Math.round(num * 100) / 100 : fallback;
  };

  const newTarget = isNewEnabled && !isFreeMem ? parseDecimalTarget(studentPlanForm.newMemorization.targetPages, 8) : 0;
  const minorTarget = isMinorEnabled ? parseDecimalTarget(studentPlanForm.minorRevision.targetPages, isMinorNoorania ? 6 : 4) : 0;
  const tamkeenTarget = isTamkeenEnabled ? parseDecimalTarget(studentPlanForm.tamkeenRevision.targetPages, 4) : 0;

  const newDone = Math.round((autoProgress.newMemorizationPagesDone || 0) * 100) / 100;
  const minorDone = Math.round((autoProgress.minorRevisionPagesDone || 0) * 100) / 100;
  const tamkeenDone = Math.round((autoProgress.tamkeenRevisionPagesDone || 0) * 100) / 100;

  const newPercent = isNewEnabled
    ? isFreeMem
      ? 100
      : (newTarget > 0 ? Math.min(100, Math.round((newDone / newTarget) * 100)) : 0)
    : 0;
  const minorPercent = isMinorEnabled && minorTarget > 0 ? Math.min(100, Math.round((minorDone / minorTarget) * 100)) : 0;
  const tamkeenPercent = isTamkeenEnabled && tamkeenTarget > 0 ? Math.min(100, Math.round((tamkeenDone / tamkeenTarget) * 100)) : 0;

  const totalEnabledTarget = Math.round((((isNewEnabled && !isFreeMem) ? newTarget : 0) + (isMinorEnabled ? minorTarget : 0) + (isTamkeenEnabled ? tamkeenTarget : 0)) * 100) / 100;
  const totalEnabledDone = Math.round(((isNewEnabled ? newDone : 0) + (isMinorEnabled ? minorDone : 0) + (isTamkeenEnabled ? tamkeenDone : 0)) * 100) / 100;
  const fixedBranchesDone = Math.round((((isNewEnabled && !isFreeMem) ? newDone : 0) + (isMinorEnabled ? minorDone : 0) + (isTamkeenEnabled ? tamkeenDone : 0)) * 100) / 100;
  const overallPercent = totalEnabledTarget > 0
    ? Math.min(100, Math.round((fixedBranchesDone / totalEnabledTarget) * 100))
    : (isNewEnabled && isFreeMem ? 100 : 0);

  // دالة مساعدة لرسم قسم خطة فرعية متكامل مع زر التفعيل/التعطيل وأسهم المقدار اليومي
  const renderPlanBranchCard = (
    branchKey: 'newMemorization' | 'minorRevision' | 'tamkeenRevision',
    title: string,
    subtitle: string,
    accentColor: string,
    badgeBg: string,
    donePages: number,
    targetPages: number,
    percent: number,
    isNewMem: boolean
  ) => {
    const branch = studentPlanForm[branchKey];
    const isEnabled = branch.enabled !== false;
    const isFreeMemorizationBranch = branchKey === 'newMemorization' && Boolean(branch.isFreeMemorization);
    const isNooraniaBranch = branchKey === 'minorRevision' && (!!branch.isNoorania || branch.revisionType === 'نورانية');
    const steps = isNewMem ? NEW_MEM_STEPS : REVIEW_STEPS;
    const currentStepVal = typeof branch.dailyAmountPages === 'number' ? branch.dailyAmountPages : 1.0;
    const isAtMin = currentStepVal <= steps[0];
    const isAtMax = currentStepVal >= steps[steps.length - 1];

    const fromMaxVerses = getAyahCount(branch.fromSurah);
    const toMaxVerses = getAyahCount(branch.toSurah);

    return (
      <div
        className={`border rounded-3xl p-5 space-y-4 transition-all duration-200 ${
          isEnabled
            ? 'bg-white border-[#E8DFD8] shadow-2xs'
            : 'bg-stone-100/75 border-stone-200/90 opacity-75'
        }`}
      >
        {/* شريط رأس القسم + زر التقفيل والتعطيل */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: isEnabled ? accentColor : '#9CA3AF' }}
            />
            <h4 className={`font-bold text-sm sm:text-base ${isEnabled ? 'text-stone-900' : 'text-stone-500 line-through'}`}>
              {title}
            </h4>
            {!isEnabled ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-stone-200 text-stone-700 text-[11px] font-bold">
                <Lock className="w-3 h-3" />
                <span>معطّل لهذا الشهر</span>
              </span>
            ) : isFreeMemorizationBranch ? (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FDF6F2] text-[#9A5643] border border-[#E5C3B3] inline-flex items-center gap-1">
                <Star className="w-3 h-3 text-[#9A5643]" />
                <span>الحفظ الحر: رصد تراكمي مفتوح حسب استطاعة الطالبة</span>
              </span>
            ) : (
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1 ${badgeBg}`}>
                <CheckCircle2 className="w-3 h-3" />
                <span>مفعّل</span>
              </span>
            )}
            <span className="text-[11px] text-stone-400 hidden md:inline">• {subtitle}</span>
          </div>

          {/* مفتاح التفعيل / التعطيل التفاعلي + زر الحفظ الحر للقسم الأول + زر تحويل لمسار القاعدة النورانية للقسم الثاني */}
          <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
            {branchKey === 'newMemorization' && (
              <button
                type="button"
                onClick={handleToggleFreeMemorizationMode}
                className={`px-3 py-1.5 rounded-2xl text-xs font-bold border transition cursor-pointer active:scale-95 flex items-center gap-1.5 ${
                  isFreeMemorizationBranch
                    ? 'bg-[#8E5364] text-white border-[#8E5364] shadow-2xs ring-2 ring-[#8E5364]/20'
                    : 'bg-[#FAF6F2] text-stone-700 border-[#E2D5CC] hover:border-[#8E5364] hover:text-[#8E5364]'
                }`}
                title="تفعيل أو إلغاء الحفظ الحر (حسب الاستطاعة) مع بقاء الطالبة في حلقتها الحالية دون سقف صفحات شهري أو قيد يومي"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>{isFreeMemorizationBranch ? 'الحفظ الحر (حسب الاستطاعة) — مفعّل ✓' : 'الحفظ الحر (حسب الاستطاعة)'}</span>
              </button>
            )}

            {branchKey === 'minorRevision' && (
              <button
                type="button"
                onClick={handleToggleNooraniaMode}
                className={`px-3 py-1.5 rounded-2xl text-xs font-bold border transition cursor-pointer active:scale-95 flex items-center gap-1.5 ${
                  isNooraniaBranch
                    ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                    : 'bg-[#FAF6F2] text-stone-700 border-[#E2D5CC] hover:border-amber-500 hover:text-amber-800'
                }`}
                title="التبديل بين خطة المراجعة الصغرى ومسار القاعدة النورانية لهذه الطالبة"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>{isNooraniaBranch ? 'مسار القاعدة النورانية (مفعّل)' : 'تحويل إلى مسار القاعدة النورانية'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleToggleBranch(branchKey)}
              className={`relative inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl text-xs font-bold border transition cursor-pointer active:scale-95 select-none ${
                isEnabled
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-stone-200 text-stone-600 border-stone-300 hover:bg-stone-300'
              }`}
              title={isEnabled ? 'انقري لتعطيل هذا القسم لهذا الشهر' : 'انقري لتفعيل هذا القسم لهذا الشهر'}
            >
              <span
                className={`w-7 h-4 rounded-full p-0.5 transition-colors flex items-center ${
                  isEnabled ? 'bg-emerald-600 justify-start' : 'bg-stone-400 justify-end'
                }`}
              >
                <span className="w-3 h-3 rounded-full bg-white shadow-2xs" />
              </span>
              <span>{isEnabled ? 'مفعّل لهذا الشهر' : 'معطّل لهذا الشهر'}</span>
            </button>
          </div>
        </div>

        {/* جسم القسم (يُقفل ويصبح باهتاً عند التعطيل) */}
        <div className={!isEnabled ? 'pointer-events-none select-none opacity-55 grayscale' : ''}>
          {editingStudentPlan ? (
            <div className="space-y-4">
              {isNooraniaBranch ? (
                /* اختيار دروس وصفحات القاعدة النورانية */
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">من درس القاعدة النورانية:</label>
                    <select
                      disabled={!isEnabled}
                      value={branch.fromLesson || 1}
                      onChange={e => {
                        const num = Number(e.target.value);
                        setStudentPlanForm(prev => ({
                          ...prev,
                          [branchKey]: {
                            ...prev[branchKey],
                            fromLesson: num,
                            toLesson: Math.max(num, prev[branchKey].toLesson || num)
                          }
                        }));
                      }}
                      className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white disabled:bg-stone-100 font-bold"
                    >
                      {NOORANIA_LESSONS.map(l => (
                        <option key={l.number} value={l.number}>
                          {l.number}. {l.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">إلى درس القاعدة النورانية:</label>
                    <select
                      disabled={!isEnabled}
                      value={branch.toLesson || 6}
                      onChange={e => {
                        const num = Number(e.target.value);
                        setStudentPlanForm(prev => ({
                          ...prev,
                          [branchKey]: {
                            ...prev[branchKey],
                            toLesson: num
                          }
                        }));
                      }}
                      className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white disabled:bg-stone-100 font-bold"
                    >
                      {NOORANIA_LESSONS.map(l => (
                        <option key={l.number} value={l.number}>
                          {l.number}. {l.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">تفصيل الصفحات والتهجي المستهدف (اختياري):</label>
                    <input
                      type="text"
                      disabled={!isEnabled}
                      value={branch.customLessonText || ''}
                      onChange={e =>
                        setStudentPlanForm(prev => ({
                          ...prev,
                          [branchKey]: {
                            ...prev[branchKey],
                            customLessonText: e.target.value
                          }
                        }))
                      }
                      placeholder="مثال: من الدرس الأول إلى السادس مع التهجي الكامل"
                      className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white disabled:bg-stone-100"
                    />
                  </div>
                </div>
              ) : (
                /* اختيار من سورة / آية إلى سورة / آية */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">من سورة:</label>
                    <select
                      disabled={!isEnabled}
                      value={branch.fromSurah}
                      onChange={e => {
                        const num = Number(e.target.value);
                        setStudentPlanForm(prev => ({
                          ...prev,
                          [branchKey]: {
                            ...prev[branchKey],
                            fromSurah: num,
                            fromAyah: 1
                          }
                        }));
                      }}
                      className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white disabled:bg-stone-100"
                    >
                      {QURAN_SURAHS.map(s => (
                        <option key={s.number} value={s.number}>
                          {s.number}. سورة {s.name} ({s.versesCount} آية)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">من آية:</label>
                    <select
                      disabled={!isEnabled}
                      value={branch.fromAyah}
                      onChange={e =>
                        setStudentPlanForm(prev => ({
                          ...prev,
                          [branchKey]: {
                            ...prev[branchKey],
                            fromAyah: Number(e.target.value)
                          }
                        }))
                      }
                      className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white disabled:bg-stone-100"
                    >
                      {Array.from({ length: fromMaxVerses }, (_, i) => i + 1).map(num => (
                        <option key={num} value={num}>آية {num}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">إلى سورة:</label>
                    <select
                      disabled={!isEnabled}
                      value={branch.toSurah}
                      onChange={e => {
                        const num = Number(e.target.value);
                        setStudentPlanForm(prev => ({
                          ...prev,
                          [branchKey]: {
                            ...prev[branchKey],
                            toSurah: num,
                            toAyah: Math.min(prev[branchKey].toAyah, getAyahCount(num))
                          }
                        }));
                      }}
                      className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white disabled:bg-stone-100"
                    >
                      {QURAN_SURAHS.map(s => (
                        <option key={s.number} value={s.number}>
                          {s.number}. سورة {s.name} ({s.versesCount} آية)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">إلى آية:</label>
                    <select
                      disabled={!isEnabled}
                      value={branch.toAyah}
                      onChange={e =>
                        setStudentPlanForm(prev => ({
                          ...prev,
                          [branchKey]: {
                            ...prev[branchKey],
                            toAyah: Number(e.target.value)
                          }
                        }))
                      }
                      className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white disabled:bg-stone-100"
                    >
                      {Array.from({ length: toMaxVerses }, (_, i) => i + 1).map(num => (
                        <option key={num} value={num}>آية {num}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* الصفحات المستهدفة + المقدار اليومي + الإنجاز التلقائي (أو وضع الحفظ الحر التراكمي المفتوح) */}
              {isFreeMemorizationBranch ? (
                <div className="p-4 rounded-2xl bg-gradient-to-l from-[#FAF0F3] via-amber-50/40 to-[#FAF7F5] border border-[#E2D5CC] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🔓</span>
                      <span className="text-xs sm:text-sm font-extrabold text-[#744251]">
                        الحفظ الحر: رصد تراكمي مفتوح حسب استطاعة الطالبة
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-600 leading-relaxed">
                      تم إلغاء السقف الإلزامي لعدد الصفحات الشهرية وإزالة قيد المقدار اليومي الثابت، مع بقاء الطالبة في حلقتها الحالية وتراكم كل ما تُسمّعه من أرباع وأنصاف وأوجه تلقائياً.
                    </p>
                  </div>
                  <div className="px-4 py-2.5 rounded-2xl bg-white border border-emerald-200 shadow-2xs text-center shrink-0">
                    <span className="text-[10px] font-bold text-stone-500 block">نوع الخطة: الحفظ الحر</span>
                    <span className="text-xs sm:text-sm font-black text-emerald-800 inline-flex items-center gap-1 mt-0.5">
                      <span>إجمالي المنجز: <span className="privacy-score-digit">{donePages}</span> صفحة متقنة</span>
                      <Star className="w-3.5 h-3.5 text-[#9A5643]" />
                    </span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      {isNooraniaBranch ? 'إجمالي الدروس / الصفحات المستهدف للشهر' : 'إجمالي الصفحات المستهدف للشهر'}
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0.25"
                        step="0.25"
                        disabled={!isEnabled}
                        value={branch.targetPages}
                        onChange={e => {
                          const raw = e.target.value;
                          const parsed = raw === '' ? 0 : parseFloat(raw);
                          setStudentPlanForm(prev => ({
                            ...prev,
                            [branchKey]: {
                              ...prev[branchKey],
                              targetPages: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
                            }
                          }));
                        }}
                        placeholder="مثال: 4.25 أو 7.5 أو 12.75"
                        className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs font-extrabold bg-white disabled:bg-stone-100"
                      />
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={!isEnabled}
                          onClick={() => handleStepTargetPages(branchKey, 'up', false)}
                          className="w-7 h-7 rounded-lg bg-[#FAF6F2] border border-stone-200 hover:bg-[#8E5364] hover:text-white hover:border-[#8E5364] disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center text-stone-700 transition cursor-pointer shadow-2xs"
                          title="زيادة المستهدف الشهري بمقدار ربع وجه (+0.25)"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={!isEnabled || (Number(branch.targetPages) || 0) <= 0.25}
                          onClick={() => handleStepTargetPages(branchKey, 'down', false)}
                          className="w-7 h-7 rounded-lg bg-[#FAF6F2] border border-stone-200 hover:bg-[#8E5364] hover:text-white hover:border-[#8E5364] disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center text-stone-700 transition cursor-pointer shadow-2xs"
                          title="إنقاص المستهدف الشهري بمقدار ربع وجه (-0.25)"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* عداد الأسهم الذكي (▲ / ▼) للمقدار المطلوب يومياً بمضاعفات 0.25 */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      المقدار المطلوب يومياً {isNooraniaBranch ? '(بمضاعفات 0.25 ربع درس/صفحة)' : '(بمضاعفات 0.25 ربع وجه)'}
                    </label>
                    <div className="flex items-center justify-between bg-[#FAF6F2] border border-[#E2D5CC] rounded-xl px-3 py-1.5">
                      <span className="text-xs font-extrabold text-stone-900">
                        {formatDailyStepLabel(currentStepVal, isNewMem, isNooraniaBranch)}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={!isEnabled || isAtMax}
                          onClick={() => handleStepDailyAmount(branchKey, 'up')}
                          className="w-7 h-7 rounded-lg bg-white border border-stone-200 hover:bg-[#8E5364] hover:text-white hover:border-[#8E5364] disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center text-stone-700 transition cursor-pointer shadow-2xs"
                          title="زيادة المقدار اليومي بربع وجه (+0.25 ▲)"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={!isEnabled || isAtMin}
                          onClick={() => handleStepDailyAmount(branchKey, 'down')}
                          className="w-7 h-7 rounded-lg bg-white border border-stone-200 hover:bg-[#8E5364] hover:text-white hover:border-[#8E5364] disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center text-stone-700 transition cursor-pointer shadow-2xs"
                          title="إنقاص المقدار اليومي بربع وجه (-0.25 ▼)"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* الصفحات المنجزة تلقائياً من سجل التسميع */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      {isNooraniaBranch ? 'المنجز الفعلي (تلقائياً من سجل القاعدة النورانية)' : 'الصفحات المنجزة (تلقائياً من سجل التسميع)'}
                    </label>
                    <div
                      className="px-3 py-2 rounded-xl border border-[#E2D5CC] flex items-center justify-between"
                      style={{ backgroundColor: '#F6EFEA' }}
                    >
                      <span
                        className="text-xs font-extrabold"
                        style={{ color: '#7B3F30' }}
                      >
                        <span className="privacy-score-digit">{donePages}</span> من <span className="privacy-score-digit">{targetPages}</span> {isNooraniaBranch ? 'درس / صفحة' : 'صفحة'}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-full text-white text-[10px] font-bold"
                        style={{ backgroundColor: '#9A5643' }}
                      >
                        {percent}%
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">ملاحظات المعلمة على هذا القسم</label>
                <input
                  type="text"
                  disabled={!isEnabled}
                  value={branch.teacherNotes || ''}
                  onChange={e =>
                    setStudentPlanForm(prev => ({
                      ...prev,
                      [branchKey]: {
                        ...prev[branchKey],
                        teacherNotes: e.target.value
                      }
                    }))
                  }
                  placeholder="ملاحظات توجيهية للطالبة..."
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white disabled:bg-stone-100"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {isFreeMemorizationBranch ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-[#FAF6F2] rounded-xl border border-[#EFE8E2]">
                    <span className="text-stone-400 block text-[11px]">نطاق السور والآيات (نقطة الانطلاق):</span>
                    <span className="font-bold text-stone-800 block mt-0.5">
                      من سورة {getSurahByNumber(branch.fromSurah)?.name} (آية {branch.fromAyah}) إلى سورة {getSurahByNumber(branch.toSurah)?.name} (آية {branch.toAyah})
                    </span>
                  </div>

                  <div className="p-3 bg-gradient-to-l from-[#FAF0F3] to-[#FAF6F2] rounded-xl border border-[#E2D5CC] flex items-center gap-2.5">
                    <Unlock className="w-5 h-5 text-[#9A5643] shrink-0" />
                    <div>
                      <span className="text-[#8E5364] font-bold block text-[11px]">نوع الخطة: الحفظ الحر</span>
                      <span className="font-extrabold text-stone-900 block mt-0.5">
                        الحفظ الحر: رصد تراكمي مفتوح حسب استطاعة الطالبة
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200/80 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-emerald-700 font-bold block text-[11px]">الحصيلة التراكمية للشهر (بدون سقف محدد):</span>
                      <span className="font-black text-emerald-950 text-xs sm:text-sm inline-flex items-center gap-1 mt-0.5">
                        <span>إجمالي المنجز: <span className="privacy-score-digit">{donePages}</span> صفحة متقنة</span>
                        <Star className="w-3.5 h-3.5 text-[#9A5643]" />
                      </span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold shrink-0 inline-flex items-center gap-1">
                      <Unlock className="w-3 h-3" />
                      <span>مفتوح</span>
                    </span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-[#FAF6F2] rounded-xl border border-[#EFE8E2]">
                    <span className="text-stone-400 block text-[11px]">
                      {isNooraniaBranch ? 'مقرر دروس القاعدة النورانية والتهجي:' : 'نطاق السور والآيات:'}
                    </span>
                    <span className="font-bold text-stone-800 block mt-0.5">
                      {isNooraniaBranch
                        ? formatNooraniaRangeLabel(branch.fromLesson, branch.toLesson, branch.customLessonText)
                        : `من سورة ${getSurahByNumber(branch.fromSurah)?.name} (آية ${branch.fromAyah}) إلى سورة ${getSurahByNumber(branch.toSurah)?.name} (آية ${branch.toAyah})`}
                    </span>
                  </div>

                  {/* المقدار المطلوب يومياً مع أزرار الأسهم المباشرة (▲ / ▼) بمضاعفات 0.25 */}
                  <div className="p-3 bg-[#FAF6F2] rounded-xl border border-[#EFE8E2] flex items-center justify-between gap-2">
                    <div>
                      <span className="text-stone-400 block text-[11px]">المقدار المطلوب يومياً:</span>
                      <span className="font-extrabold text-stone-900 block mt-0.5">
                        {formatDailyStepLabel(currentStepVal, isNewMem, isNooraniaBranch)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={!isEnabled || isAtMax}
                        onClick={() => handleStepDailyAmount(branchKey, 'up')}
                        className="w-7 h-7 rounded-lg bg-white border border-stone-200 hover:bg-[#8E5364] hover:text-white hover:border-[#8E5364] disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center text-stone-700 transition cursor-pointer shadow-2xs"
                        title="زيادة المقدار اليومي بربع وجه (+0.25 ▲)"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={!isEnabled || isAtMin}
                        onClick={() => handleStepDailyAmount(branchKey, 'down')}
                        className="w-7 h-7 rounded-lg bg-white border border-stone-200 hover:bg-[#8E5364] hover:text-white hover:border-[#8E5364] disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center text-stone-700 transition cursor-pointer shadow-2xs"
                        title="إنقاص المقدار اليومي بربع وجه (-0.25 ▼)"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-[#FAF6F2] rounded-xl border border-[#EFE8E2] flex items-center justify-between gap-2">
                    <div>
                      <span className="text-stone-400 block text-[11px]">
                        {isNooraniaBranch ? 'الدروس / الصفحات المنجزة (من المستهدف):' : 'الصفحات المنجزة (من المستهدف الشهري):'}
                      </span>
                      <span className="font-extrabold block mt-0.5" style={{ color: accentColor }}>
                        <span className="privacy-score-digit">{donePages}</span> منجز من أصل <span className="privacy-score-digit">{targetPages}</span> {isNooraniaBranch ? 'درس / صفحة' : 'صفحة'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={!isEnabled}
                        onClick={() => handleStepTargetPages(branchKey, 'up', true)}
                        className="w-7 h-7 rounded-lg bg-white border border-stone-200 hover:bg-[#8E5364] hover:text-white hover:border-[#8E5364] disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center text-stone-700 transition cursor-pointer shadow-2xs"
                        title="زيادة إجمالي الصفحات المستهدف للشهر بربع وجه (+0.25 ▲)"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={!isEnabled || targetPages <= 0.25}
                        onClick={() => handleStepTargetPages(branchKey, 'down', true)}
                        className="w-7 h-7 rounded-lg bg-white border border-stone-200 hover:bg-[#8E5364] hover:text-white hover:border-[#8E5364] disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center text-stone-700 transition cursor-pointer shadow-2xs"
                        title="إنقاص إجمالي الصفحات المستهدف للشهر بربع وجه (-0.25 ▼)"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-[#FAF6F2] rounded-xl border border-[#EFE8E2] flex items-center gap-3">
                    {/* Vertical Progress Capsule / Indicator */}
                    <div
                      className="w-2.5 h-10 rounded-full overflow-hidden flex flex-col justify-end shrink-0 bg-[#F6EFEA]"
                      style={{ backgroundColor: '#F6EFEA' }}
                      title={`نسبة الإنجاز: ${isEnabled ? `${percent}%` : '0%'}`}
                    >
                      <div
                        className="w-full rounded-full transition-all duration-300 bg-[#9A5643]"
                        style={{
                          height: `${isEnabled ? percent : 0}%`,
                          backgroundColor: '#9A5643'
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-[11px] mb-1.5">
                        <span className="text-stone-500 font-medium">نسبة الإنجاز التلقائية:</span>
                        <span
                          className="font-extrabold text-[#7B3F30]"
                          style={{ color: '#7B3F30' }}
                        >
                          {isEnabled ? `${percent}%` : 'معطّل'}
                        </span>
                      </div>
                      <div
                        className="w-full h-2.5 rounded-full overflow-hidden bg-[#F6EFEA]"
                        style={{ backgroundColor: '#F6EFEA' }}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-300 bg-[#9A5643]"
                          style={{
                            width: `${isEnabled ? percent : 0}%`,
                            backgroundColor: '#9A5643'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-[#E8DFD8] shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CalendarRange className="w-5 h-5 text-[#9A5643]" />
            <h2 className="text-xl font-bold text-stone-900 font-quran">الخطط الشهرية للحفظ والمراجعة</h2>
          </div>
          <p className="text-xs text-stone-500">
            تقسيم ثلاثي مستقل (الحفظ الجديد • المراجعة الصغرى أو القاعدة النورانية • مراجعة التمكين) مع التحكم بالتفعيل والمقدار اليومي واحتساب الإنجاز تلقائياً من سجل التسميع
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
        {availablePlans.map(plan => (
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
            <CalendarRange className={`w-4 h-4 ${selectedPlanId === plan.id ? 'text-white' : 'text-[#9A5643]'}`} />
            <span>{plan.title}</span>
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
              <div className="text-sm font-bold text-[#7A4B37] inline-flex items-center gap-1">
                <span>التحديات والمراجعة الثنائية</span>
                <HeartHandshake className="w-3.5 h-3.5 text-[#9A5643]" />
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

      {/* Student Specific Syllabus & 3 Independent Branches */}
      <div className="bg-white p-6 rounded-3xl border border-[#E8DFD8] shadow-2xs space-y-6">
        
        {/* Student Selector Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FAF6F2] p-4 rounded-2xl border border-[#EFE8E2]">
          <div className="flex items-center gap-3">
            <div>
              <label className="block text-[11px] font-bold text-stone-600 mb-0.5">
                اختاري الطالبة لعرض وتعديل خطتها الفردية:
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsStudentDropdownOpen(!isStudentDropdownOpen)}
                  className="px-3 py-1.5 border border-stone-200 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-[#8E5364] flex items-center justify-between gap-2 min-w-[240px] text-right cursor-pointer shadow-2xs hover:border-[#8E5364]/40 transition"
                  title="اختاري الطالبة من هنا"
                >
                  <span className="truncate">
                    <span className="privacy-student-name">{selectedStudent?.name || 'اختاري الطالبة من هنا'}</span>
                    {selectedStudent && (
                      <span className="text-stone-400 font-normal mr-1 text-[11px]">
                        (<span className="privacy-phone">{selectedStudent.code}</span>) - {circles.find(c => c.id === selectedStudent.circleId)?.name}
                      </span>
                    )}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                </button>

                {isStudentDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsStudentDropdownOpen(false)}
                    />
                    <div className="absolute top-full right-0 mt-1 w-80 max-h-60 overflow-y-auto bg-white border border-stone-200 rounded-2xl shadow-xl z-50 py-1 divide-y divide-stone-100">
                      {availableStudents.map(s => {
                        const circle = circles.find(c => c.id === s.circleId);
                        const isSelected = s.id === selectedStudentId;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setSelectedStudentId(s.id);
                              setIsStudentDropdownOpen(false);
                            }}
                            className={`w-full text-right px-3.5 py-2 text-xs transition flex items-center justify-between cursor-pointer ${
                              isSelected ? 'bg-[#FAF0F3] text-[#8E5364] font-bold' : 'hover:bg-stone-50 text-stone-800'
                            }`}
                          >
                            <div className="min-w-0">
                              <span className="block font-bold privacy-student-name">{s.name}</span>
                              <span className="text-[10px] text-stone-400 block mt-0.5">
                                كود: <span className="privacy-phone">{s.code}</span> • {circle?.name}
                              </span>
                            </div>
                            {isSelected && <span className="text-[#8E5364] text-xs font-bold">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!editingStudentPlan ? (
              <button
                type="button"
                onClick={() => setEditingStudentPlan(true)}
                className="px-4 py-2 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>تعديل مقرر السور والصفحات</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingStudentPlan(false)}
                  className="px-3 py-2 text-stone-600 text-xs rounded-xl hover:bg-stone-200 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSaveStudentPlan}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>حفظ المقرر المحدث</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Automated Plan Progress Indicator */}
        <div className="bg-[#FCFAF8] p-4 rounded-2xl border border-[#EFE8E2] space-y-3">
          <div className="flex items-center gap-3">
            {/* Vertical Progress Capsule / Indicator */}
            <div
              className="w-3 h-11 rounded-full overflow-hidden flex flex-col justify-end shrink-0 bg-[#F6EFEA]"
              style={{ backgroundColor: '#F6EFEA' }}
              title={`نسبة إنجاز الخطة الشهرية: ${overallPercent}%`}
            >
              <div
                className="w-full rounded-full transition-all duration-300 bg-[#9A5643]"
                style={{
                  height: `${overallPercent}%`,
                  backgroundColor: '#9A5643'
                }}
              />
            </div>

            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-stone-800">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#9A5643]" />
                  <span>مؤشر إنجاز الخطة الشهرية التلقائي للطالبة (<span className="privacy-student-name">{selectedStudent?.name}</span>)</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold inline-flex items-center gap-1">
                    <Zap className="w-3 h-3 text-[#9A5643]" />
                    <span>يُحتسب تلقائياً من سجل التسميع</span>
                  </span>
                </div>
                <span className="font-extrabold text-[#7B3F30]" style={{ color: '#7B3F30' }}>
                  {isFreeMem ? (
                    <span className="inline-flex items-center gap-1">
                      <span>إجمالي المنجز الكلي: <span className="privacy-score-digit">{totalEnabledDone}</span> صفحة متقنة</span>
                      <Star className="w-3.5 h-3.5 text-[#9A5643]" />
                      <span>({overallPercent}%)</span>
                    </span>
                  ) : (
                    <span>
                      <span className="privacy-score-digit">{totalEnabledDone}</span> من أصل <span className="privacy-score-digit">{totalEnabledTarget}</span> صفحة منجزة ({overallPercent}%)
                    </span>
                  )}
                </span>
              </div>
              <div
                className="w-full h-3 rounded-full overflow-hidden bg-[#F6EFEA]"
                style={{ backgroundColor: '#F6EFEA' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-300 bg-[#9A5643]"
                  style={{
                    width: `${overallPercent}%`,
                    backgroundColor: '#9A5643'
                  }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
            <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-white border border-stone-200/70">
              <span className="text-stone-600 font-bold">
                {isFreeMem ? '١. الحفظ الحر:' : '١. الحفظ الجديد:'}
              </span>
              <span className="font-extrabold text-[#7B3F30] inline-flex items-center gap-1" style={{ color: '#7B3F30' }}>
                {!isNewEnabled
                  ? 'معطّل لهذا الشهر'
                  : isFreeMem
                    ? (
                      <>
                        <span>إجمالي المنجز: {newDone} صفحة متقنة</span>
                        <Star className="w-3 h-3 text-[#9A5643]" />
                      </>
                    )
                    : `${newDone} من ${newTarget} وجه (${newPercent}%)`}
              </span>
            </div>
            <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-white border border-stone-200/70">
              <span className="text-stone-600 font-bold">
                {isMinorNoorania ? '٢. مسار القاعدة النورانية:' : '٢. المراجعة الصغرى:'}
              </span>
              <span className="font-extrabold text-[#7B3F30]" style={{ color: '#7B3F30' }}>
                {isMinorEnabled
                  ? `${minorDone} من ${minorTarget} ${isMinorNoorania ? 'درس/ص' : 'وجه'} (${minorPercent}%)`
                  : 'معطّل لهذا الشهر'}
              </span>
            </div>
            <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-white border border-stone-200/70">
              <span className="text-stone-600 font-bold">٣. مراجعة التمكين:</span>
              <span className="font-extrabold text-[#7B3F30]" style={{ color: '#7B3F30' }}>
                {isTamkeenEnabled ? `${tamkeenDone} من ${tamkeenTarget} وجه (${tamkeenPercent}%)` : 'معطّل لهذا الشهر'}
              </span>
            </div>
          </div>
        </div>

        {/* 1. خطة ومقرر الحفظ الجديد أو الحفظ الحر */}
        {renderPlanBranchCard(
          'newMemorization',
          isFreeMem ? '١. الحفظ الحر (حسب الاستطاعة)' : '١. خطة ومقرر الحفظ الجديد',
          isFreeMem
            ? 'الحفظ الحر: رصد تراكمي مفتوح حسب استطاعة الطالبة'
            : 'بمضاعفات ربع وجه (0.25) يومياً — يُجمع الإنجاز تلقائياً من سجل التسميع',
          '#9A5643',
          'bg-[#F6EFEA] text-[#7B3F30]',
          newDone,
          newTarget || 8,
          newPercent,
          true
        )}

        {/* 2. خطة المراجعة الصغرى أو مسار القاعدة النورانية */}
        {renderPlanBranchCard(
          'minorRevision',
          isMinorNoorania ? '٢. مسار القاعدة النورانية' : '٢. خطة المراجعة الصغرى (الربط القريب)',
          isMinorNoorania
            ? 'دروس القاعدة النورانية والصفحات والتهجي المعتمدة للطالبة'
            : 'تثبيت المحفوظ القريب وربطه بالحفظ الجديد',
          '#96503E',
          'bg-amber-50 text-amber-800',
          minorDone,
          minorTarget || (isMinorNoorania ? 6 : 4),
          minorPercent,
          false
        )}

        {/* 3. خطة مراجعة التمكين (المراجعة الكبرى) */}
        {renderPlanBranchCard(
          'tamkeenRevision',
          '٣. خطة مراجعة التمكين (المراجعة الكبرى)',
          'مراجعة المحفوظ السابق وتثبيت الأجزاء',
          '#2D5A43',
          'bg-emerald-50 text-emerald-800',
          tamkeenDone,
          tamkeenTarget || 4,
          tamkeenPercent,
          false
        )}

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
