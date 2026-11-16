import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Sparkles, Plus, Edit, Trash2, ExternalLink, CheckCircle2,
  AlertCircle, BookOpen, Clock, Award, Star, Video, Image, FileText,
  AlertTriangle, X, Check, Archive, RotateCcw, Copy, Calendar, ChevronRight, ChevronLeft
} from 'lucide-react';
import {
  AtqiniAssignment, AtqiniRating, StudentAtqiniSubmission,
  isStudentEffectivelyArchived, isAtqiniAssignmentArchived, deduplicateStudentsByName
} from '../types';
import {
  formatHijriDate, formatHijriShort, formatHijriDateTime,
  HijriDateNavigationBar, getTodayISO, getHijriParts, shiftHijriDay
} from '../utils/hijriDate';

export const AtqiniView: React.FC = () => {
  const {
    atqiniAssignments, studentAtqiniSubmissions, students, circles, tracks,
    createAtqiniAssignment, updateAtqiniAssignment, deleteAtqiniAssignment,
    saveAtqiniSubmission, deleteStudentAtqiniSubmission, currentUser,
    quickModalAction, clearQuickModal, showToast, selectedTrackId
  } = useApp();

  const [assignmentTab, setAssignmentTab] = useState<'active' | 'archived'>('active');

  const trackScopedAssignments = React.useMemo(() => {
    if (!selectedTrackId || selectedTrackId === 'all') return atqiniAssignments;
    return atqiniAssignments.filter(a => !a.trackId || a.trackId === selectedTrackId);
  }, [atqiniAssignments, selectedTrackId]);

  const activeAssignments = React.useMemo(
    () => trackScopedAssignments.filter(a => !isAtqiniAssignmentArchived(a)),
    [trackScopedAssignments]
  );

  const archivedAssignments = React.useMemo(
    () => trackScopedAssignments.filter(a => isAtqiniAssignmentArchived(a)),
    [trackScopedAssignments]
  );

  const availableAssignments = assignmentTab === 'archived' ? archivedAssignments : activeAssignments;

  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>(
    activeAssignments[0]?.id || atqiniAssignments[0]?.id || ''
  );

  const currentAssignment =
    availableAssignments.find(a => a.id === selectedAssignmentId) ||
    availableAssignments[0] ||
    null;

  const isCurrentArchived = isAtqiniAssignmentArchived(currentAssignment);

  const availableStudents = React.useMemo(() => {
    const trackScopedStudents = students.filter(s => {
      if (!selectedTrackId || selectedTrackId === 'all') return true;
      const circle = circles.find(c => c.id === s.circleId);
      const stTrackId = s.trackId || circle?.trackId;
      return stTrackId === selectedTrackId;
    });

    if (!isCurrentArchived) {
      return deduplicateStudentsByName(
        trackScopedStudents.filter(s => !isStudentEffectivelyArchived(s, circles, tracks))
      );
    }

    // في الواجبات المؤرشفة: الحفاظ على السجل التاريخي الكامل للطالبات المؤرشفات أو اللاتي لديهن رصد في هذا الواجب
    const historicalStudents = trackScopedStudents.filter(
      s =>
        isStudentEffectivelyArchived(s, circles, tracks) ||
        studentAtqiniSubmissions.some(sub => sub.assignmentId === currentAssignment?.id && sub.studentId === s.id)
    );
    return historicalStudents.length > 0 ? historicalStudents : trackScopedStudents;
  }, [students, circles, tracks, selectedTrackId, isCurrentArchived, studentAtqiniSubmissions, currentAssignment?.id]);

  // Modals state
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<AtqiniAssignment | null>(null);

  // Deletion confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [assignmentToDelete, setAssignmentToDelete] = useState<AtqiniAssignment | null>(null);

  const [evalModalOpen, setEvalModalOpen] = useState(false);
  const [evalStudent, setEvalStudent] = useState<any>(null);
  const [submissionToDelete, setSubmissionToDelete] = useState<{ id: string; studentName: string } | null>(null);

  const todayIso = React.useMemo(() => getTodayISO(), []);
  const [selectedSessionDate, setSelectedSessionDate] = useState<string>(todayIso);

  const computeDailyCriteriaGrade = React.useCallback(
    (
      isCompletedCorrectly: boolean,
      extractedExamplesDone: boolean,
      appliedDuringRecitation: boolean,
      maxScore: number
    ): { score: number; rating: AtqiniRating; status: 'completed' | 'not_started' } => {
      const checkedCount =
        (isCompletedCorrectly ? 1 : 0) +
        (extractedExamplesDone ? 1 : 0) +
        (appliedDuringRecitation ? 1 : 0);
      if (checkedCount === 3) {
        return { score: maxScore, rating: 'ممتاز', status: 'completed' };
      }
      if (checkedCount === 2) {
        return {
          score: Math.round(((2 / 3) * maxScore) * 10) / 10,
          rating: 'جيد جدًا',
          status: 'completed'
        };
      }
      if (checkedCount === 1) {
        return {
          score: Math.round(((1 / 3) * maxScore) * 10) / 10,
          rating: 'جيد',
          status: 'completed'
        };
      }
      return { score: 0, rating: 'لم يُنجز', status: 'not_started' };
    },
    []
  );

  // Build Hijri session days between assignment publishDate & dueDate + active week's session days (الأحد - الأربعاء)
  const sessionHijriDays = React.useMemo(() => {
    const parseIso = (iso?: string): Date | null => {
      const m = String(iso || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) return null;
      const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
      return isNaN(dt.getTime()) ? null : dt;
    };
    const formatIso = (dt: Date): string => {
      const y = dt.getFullYear();
      const mo = String(dt.getMonth() + 1).padStart(2, '0');
      const da = String(dt.getDate()).padStart(2, '0');
      return `${y}-${mo}-${da}`;
    };

    const isoSet = new Set<string>();

    // 1. Add active week's session days (الأحد، الاثنين، الثلاثاء، الأربعاء) around selectedSessionDate
    const anchorDt = parseIso(selectedSessionDate) || parseIso(todayIso) || new Date();
    const dayOfWeek = anchorDt.getDay(); // 0 = Sun ... 6 = Sat
    const sundayDt = new Date(anchorDt);
    sundayDt.setDate(anchorDt.getDate() - dayOfWeek);
    for (let d = 0; d <= 3; d++) {
      const cur = new Date(sundayDt);
      cur.setDate(sundayDt.getDate() + d);
      isoSet.add(formatIso(cur));
    }

    // 2. Add session days between currentAssignment.publishedDate and currentAssignment.dueDate (up to 10 session days)
    if (currentAssignment?.publishedDate && currentAssignment?.dueDate) {
      const startDt = parseIso(currentAssignment.publishedDate);
      const endDt = parseIso(currentAssignment.dueDate);
      if (startDt && endDt && startDt.getTime() <= endDt.getTime()) {
        const cursor = new Date(startDt);
        let steps = 0;
        while (cursor.getTime() <= endDt.getTime() && steps < 14) {
          const wd = cursor.getDay();
          if (wd >= 0 && wd <= 3) {
            isoSet.add(formatIso(cursor));
          }
          cursor.setDate(cursor.getDate() + 1);
          steps++;
        }
      }
    }

    // 3. Always include any Hijri dates that already have recorded submissions for this assignment
    if (currentAssignment?.id) {
      studentAtqiniSubmissions.forEach(s => {
        if (s.assignmentId === currentAssignment.id && s.hijriDate && /^\d{4}-\d{2}-\d{2}$/.test(s.hijriDate)) {
          isoSet.add(s.hijriDate);
        }
      });
    }

    // 4. Always include selectedSessionDate and todayIso so the active day is visible
    isoSet.add(selectedSessionDate);
    isoSet.add(todayIso);

    const sortedIsos = Array.from(isoSet).sort();
    return sortedIsos.map(iso => {
      const parts = getHijriParts(iso);
      return {
        iso,
        weekday: parts.weekday,
        hijriDayMonth: `${parts.day.toLocaleString('ar-SA')} ${parts.monthName}`,
        hijriFull: formatHijriShort(iso),
        isToday: iso === todayIso
      };
    });
  }, [currentAssignment?.id, currentAssignment?.publishedDate, currentAssignment?.dueDate, selectedSessionDate, todayIso, studentAtqiniSubmissions]);

  const getStudentDaySubmission = React.useCallback(
    (studentId: string, dateIso: string = selectedSessionDate): StudentAtqiniSubmission | undefined => {
      if (!currentAssignment) return undefined;
      const studentSubs = studentAtqiniSubmissions.filter(
        s => s.assignmentId === currentAssignment.id && s.studentId === studentId
      );
      if (studentSubs.length === 0) return undefined;

      const exactMatch = studentSubs.find(s => String(s.hijriDate || '').trim() === dateIso);
      if (exactMatch) return exactMatch;

      // Fallback for legacy submissions saved before daily hijriDate was introduced
      const legacyMatch = studentSubs.find(s => {
        if (s.hijriDate && String(s.hijriDate).trim()) return false;
        const fallbackDate =
          (s.submittedAt && /^\d{4}-\d{2}-\d{2}/.test(s.submittedAt) ? s.submittedAt.slice(0, 10) : '') ||
          currentAssignment.publishedDate ||
          todayIso;
        return fallbackDate === dateIso || (dateIso === todayIso && studentSubs.length === 1);
      });
      return legacyMatch;
    },
    [currentAssignment, studentAtqiniSubmissions, selectedSessionDate, todayIso]
  );

  const getStudentCumulativeStats = React.useCallback(
    (studentId: string) => {
      const maxScore = currentAssignment?.maxScore || 10;
      if (!currentAssignment) {
        return { gradedDaysCount: 0, totalScore: 0, totalPossible: 0, avgScore: 0 };
      }
      const studentSubs = studentAtqiniSubmissions.filter(
        s =>
          s.assignmentId === currentAssignment.id &&
          s.studentId === studentId &&
          (s.status === 'completed' ||
            s.isCompletedCorrectly ||
            s.extractedExamplesDone ||
            s.appliedDuringRecitation ||
            (typeof s.score === 'number' && s.score > 0))
      );
      if (studentSubs.length === 0) {
        return { gradedDaysCount: 0, totalScore: 0, totalPossible: 0, avgScore: 0 };
      }
      const byDay = new Map<string, StudentAtqiniSubmission>();
      studentSubs.forEach((s, i) => {
        const key =
          (s.hijriDate && String(s.hijriDate).trim()) ||
          (s.submittedAt && /^\d{4}-\d{2}-\d{2}/.test(s.submittedAt) ? s.submittedAt.slice(0, 10) : `legacy_${i}`);
        byDay.set(key, s);
      });
      const uniqueDays = Array.from(byDay.values());
      const gradedDaysCount = uniqueDays.length;
      const rawSum = uniqueDays.reduce((acc, s) => acc + Math.min(maxScore, Math.max(0, Number(s.score) || 0)), 0);
      const totalScore = Math.round(rawSum * 10) / 10;
      const totalPossible = gradedDaysCount * maxScore;
      const avgScore = gradedDaysCount > 0 ? Math.round((rawSum / gradedDaysCount) * 10) / 10 : 0;
      return { gradedDaysCount, totalScore, totalPossible, avgScore };
    },
    [currentAssignment, studentAtqiniSubmissions]
  );

  // Automatically open modal when quickModalAction is triggered
  React.useEffect(() => {
    if (quickModalAction?.type === 'atqini') {
      handleOpenAssignmentModal();
      clearQuickModal();
    }
  }, [quickModalAction]);

  // Keep selectedAssignmentId pointing to a valid assignment in the active tab
  React.useEffect(() => {
    if (availableAssignments.length > 0 && !availableAssignments.some(a => a.id === selectedAssignmentId)) {
      setSelectedAssignmentId(availableAssignments[0].id);
    } else if (availableAssignments.length === 0 && selectedAssignmentId) {
      setSelectedAssignmentId('');
    }
  }, [availableAssignments, selectedAssignmentId]);

  // Tajweed Templates for instant 1-click creation
  const TAJWEED_TEMPLATES = [
    {
      name: 'الإدغام بغنة وبغير غنة',
      title: 'واجب إتقان أحكام الإدغام',
      rule: 'الإدغام بغنة (ينمو) وبغير غنة (ل، ر)',
      desc: 'إدخال النون الساكنة أو التنوين في حرف الإدغام ليصيرا حرفاً واحداً مشدداً كالثاني.',
      instructions: 'استخراج ٤ أمثلة من السور المحفوظة والتدرب على الغنة بمقدار حركتين.',
      examples: 'مثالان لإدغام بغنة ومثالان لإدغام بغير غنة من المحفوظ.',
      application: 'مراعاة الغنة دون إفراط أو تمطيط أثناء جلسة التسميع.'
    },
    {
      name: 'الإخفاء الحقيقي (١٥ حرفاً)',
      title: 'واجب إتقان حكم الإخفاء الحقيقي',
      rule: 'الإخفاء الحقيقي عند حروف (ص، ذ، ث، ك، ج، ش، ق، س، د، ط، ز، ف، ت، ض، ظ)',
      desc: 'النطق بالنون الساكنة والتنوين بحالة بين الإظهار والإدغام عارياً عن التشديد مع بقاء الغنة.',
      instructions: 'استخراج ٥ أمثلة وتطبيق وضع اللسان قريباً من مخرج حرف الإخفاء.',
      examples: '٥ أمثلة لحروف الإخفاء المختلفة من السور المقررة.',
      application: 'أداء الغنة مرققة أو مفخمة بحسب الحرف الذي يليها أثناء التسميع.'
    },
    {
      name: 'القلقلة ومراتبها',
      title: 'واجب إتقان مراتب القلقلة',
      rule: 'القلقلة في حروف (قطب جد)',
      desc: 'اضطراب المخرج عند النطق بالحرف الساكن حتى يسمع له نبرة قوية.',
      instructions: 'بيان مراتب القلقلة (صغرى في وسط الكلمة، كبرى عند الوقف، أكبر عند المشدد الموقوف عليه).',
      examples: 'استخراج مثال للقلقلة الصغرى ومثالين للقلقلة عند الوقف.',
      application: 'تطبيق نبرة القلقلة دون خلطها بصوت حركة أثناء التسميع.'
    },
    {
      name: 'أحكام الميم الساكنة',
      title: 'واجب أحكام الميم الساكنة الثلاثة',
      rule: 'الإخفاء الشفوي، إدغام المتماثلين، والإظهار الشفوي',
      desc: 'أحكام الميم الساكنة الواقعة قبل أحكام الهجاء.',
      instructions: 'استخراج مثال للإخفاء الشفوي عند الباء، ومثال للإدغام عند الميم، ومثال للإظهار الشفوي.',
      examples: '٣ أمثلة تمثل الأحكام الثلاثة من سورة المقرر.',
      application: 'مراعاة عدم إخفاء الميم عند الواو والفاء لقرب واتحاد المخرج.'
    },
    {
      name: 'التفخيم والترقيق في الراء',
      title: 'واجب حالات تفخيم وترقيق الراء',
      rule: 'التفخيم والترقيق لحرف الراء',
      desc: 'بيان متى تفخم الراء (مفتوحة، مضمومة، أو ساكنة بعد فتح/ضم) ومتى ترقق.',
      instructions: 'استخراج أمثلة لراء مفخمة وراء مرققة مع تعليل السبب.',
      examples: 'مثالان لراء مفخمة ومثالان لراء مرققة.',
      application: 'الامتثال لصوت التفخيم برفع أقصى اللسان أثناء التلاوة.'
    },
    {
      name: 'المدود المتصلة والمنفصلة',
      title: 'واجب إتقان مقادير المدود',
      rule: 'المد الواجب المتصل والمد الجائز المنفصل',
      desc: 'حكم مد الصوت بحرف المد إذا جاء بعده همز في نفس الكلمة أو كلمتين.',
      instructions: 'تحديد مقدار المد ٤ أو ٥ حركات في المنفصل والمتصل.',
      examples: '٣ أمثلة للمتصل و٣ أمثلة للمنفصل.',
      application: 'موازنة أزمنة المدود وعدم التفاوت بينها أثناء التسميع.'
    }
  ];

  // Assignment Form State
  const [assignmentForm, setAssignmentForm] = useState({
    title: '',
    tajweedRule: '',
    description: '',
    sheikhVideoUrl: '',
    lessonImageUrl: '',
    publishedDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    requiredInstructions: '',
    examplesRequirement: '',
    recitationRuleApplication: '',
    maxScore: 10
  });

  // Student Evaluation Form
  const [subForm, setSubForm] = useState<{
    status: 'completed' | 'in_progress' | 'not_started' | 'late' | 'pending';
    isCompletedCorrectly: boolean;
    extractedExamplesDone: boolean;
    appliedDuringRecitation: boolean;
    rating: AtqiniRating;
    score: number;
    teacherNotes: string;
  }>({
    status: 'completed',
    isCompletedCorrectly: true,
    extractedExamplesDone: true,
    appliedDuringRecitation: true,
    rating: 'ممتاز',
    score: 10,
    teacherNotes: ''
  });

  const handleToggleArchiveAssignment = async (assignment: AtqiniAssignment) => {
    const currentlyArchived = isAtqiniAssignmentArchived(assignment);
    const nextArchived = !currentlyArchived;
    const remainingInTab = availableAssignments.filter(a => a.id !== assignment.id);
    await updateAtqiniAssignment(assignment.id, {
      archived: nextArchived,
      isArchived: nextArchived,
      status: nextArchived ? 'archived' : 'active',
      archivedAt: nextArchived ? new Date().toISOString() : ''
    });
    if (remainingInTab.length > 0) {
      setSelectedAssignmentId(remainingInTab[0].id);
    }
  };

  const handleApplyTemplate = (tpl: typeof TAJWEED_TEMPLATES[0]) => {
    setAssignmentForm(prev => ({
      ...prev,
      title: tpl.title,
      tajweedRule: tpl.rule,
      description: tpl.desc,
      requiredInstructions: tpl.instructions,
      examplesRequirement: tpl.examples,
      recitationRuleApplication: tpl.application
    }));
    showToast(`تم تطبيق قالب "${tpl.name}" بنجاح ✨`);
  };

  const handleOpenAssignmentModal = (assignment?: AtqiniAssignment) => {
    if (assignment) {
      setEditingAssignment(assignment);
      setAssignmentForm({
        title: assignment.title,
        tajweedRule: assignment.tajweedRule,
        description: assignment.description,
        sheikhVideoUrl: assignment.sheikhVideoUrl || '',
        lessonImageUrl: assignment.lessonImageUrl || '',
        publishedDate: assignment.publishedDate,
        dueDate: assignment.dueDate,
        requiredInstructions: assignment.requiredInstructions,
        examplesRequirement: assignment.examplesRequirement,
        recitationRuleApplication: assignment.recitationRuleApplication,
        maxScore: assignment.maxScore || 10
      });
    } else {
      setEditingAssignment(null);
      setAssignmentForm({
        title: 'واجب الإدغام بغنة وبغير غنة',
        tajweedRule: 'حكم الإدغام في النون الساكنة والتنوين',
        description: 'بيان حروف الإدغام الستة (يرملون) وتقسيمها إلى إدغام بغنة (ينمو) وبغير غنة (اللام والراء).',
        sheikhVideoUrl: 'https://www.youtube.com/watch?v=sampleTajweedIdgham',
        lessonImageUrl: '',
        publishedDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        requiredInstructions: 'استخراج ٤ أمثلة وتطبيق الإدغام أثناء جلسة التسميع مع مراعاة مقدار حركتين.',
        examplesRequirement: 'استخراج مثالين لإدغام بغنة ومثالين لإدغام بغير غنة من السور المقررة.',
        recitationRuleApplication: 'مراعاة كمال الغنة وصفاء المخرج دون تكلف أو تشديد زائد.',
        maxScore: 10
      });
    }
    setAssignmentModalOpen(true);
  };

  const handleDuplicateAssignmentModal = (assignment: AtqiniAssignment) => {
    const todayIso = new Date().toISOString().split('T')[0];
    setEditingAssignment(null);
    setAssignmentForm({
      title: assignment.title,
      tajweedRule: assignment.tajweedRule,
      description: assignment.description || '',
      sheikhVideoUrl: assignment.sheikhVideoUrl || '',
      lessonImageUrl: assignment.lessonImageUrl || '',
      publishedDate: todayIso,
      dueDate: todayIso,
      requiredInstructions: assignment.requiredInstructions || '',
      examplesRequirement: assignment.examplesRequirement || '',
      recitationRuleApplication: assignment.recitationRuleApplication || '',
      maxScore: assignment.maxScore || 10
    });
    setAssignmentModalOpen(true);
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignmentForm.title.trim() || !assignmentForm.tajweedRule.trim()) {
      showToast('يرجى كتابة عنوان الواجب والحكم التجويدي', 'error');
      return;
    }

    if (editingAssignment) {
      await updateAtqiniAssignment(editingAssignment.id, assignmentForm);
    } else {
      const targetTrackId =
        selectedTrackId && selectedTrackId !== 'all'
          ? selectedTrackId
          : currentAssignment?.trackId || tracks[0]?.id || 't-1';
      const created = await createAtqiniAssignment({
        ...assignmentForm,
        trackId: targetTrackId
      });
      setAssignmentTab('active');
      setSelectedAssignmentId(created.id);
    }
    setAssignmentModalOpen(false);
  };

  const handleRestoreSampleAssignments = async () => {
    const defaultTemplates = TAJWEED_TEMPLATES.slice(0, 3);
    for (const tpl of defaultTemplates) {
      await createAtqiniAssignment({
        title: tpl.title,
        tajweedRule: tpl.rule,
        description: tpl.desc,
        requiredInstructions: tpl.instructions,
        examplesRequirement: tpl.examples,
        recitationRuleApplication: tpl.application,
        sheikhVideoUrl: 'https://www.youtube.com/watch?v=sampleTajweed',
        publishedDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        maxScore: 10,
        trackId: tracks[0]?.id || 't-1'
      });
    }
    showToast('تمت استعادة الواجبات التجويدية النموذجية بنجاح ✨');
  };

  const confirmDeleteAssignment = (assignment: AtqiniAssignment) => {
    setAssignmentToDelete(assignment);
    setDeleteConfirmOpen(true);
  };

  const executeDeleteAssignment = async () => {
    if (!assignmentToDelete) return;
    await deleteAtqiniAssignment(assignmentToDelete.id);
    setDeleteConfirmOpen(false);
    setAssignmentModalOpen(false);
    setAssignmentToDelete(null);
  };

  const handleOpenEvalModal = (student: any) => {
    setEvalStudent(student);
    const existing = getStudentDaySubmission(student.id, selectedSessionDate);
    if (existing) {
      const normalizedRating = (existing.rating as string) === 'ممتاز جدًا' || (existing.rating as string) === 'ممتاز جدا'
        ? 'ممتاز'
        : existing.rating;
      setSubForm({
        status: existing.status,
        isCompletedCorrectly: existing.isCompletedCorrectly,
        extractedExamplesDone: existing.extractedExamplesDone,
        appliedDuringRecitation: existing.appliedDuringRecitation,
        rating: normalizedRating as AtqiniRating,
        score: existing.score,
        teacherNotes: existing.teacherNotes || ''
      });
    } else {
      setSubForm({
        status: 'completed',
        isCompletedCorrectly: true,
        extractedExamplesDone: true,
        appliedDuringRecitation: true,
        rating: 'ممتاز',
        score: currentAssignment?.maxScore || 10,
        teacherNotes: ''
      });
    }
    setEvalModalOpen(true);
  };

  const handleSaveSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evalStudent || !currentAssignment) return;
    const existing = getStudentDaySubmission(evalStudent.id, selectedSessionDate);
    const anyChecked =
      subForm.isCompletedCorrectly || subForm.extractedExamplesDone || subForm.appliedDuringRecitation;
    await saveAtqiniSubmission({
      id: existing?.hijriDate === selectedSessionDate ? existing?.id : undefined,
      assignmentId: currentAssignment.id,
      studentId: evalStudent.id,
      hijriDate: selectedSessionDate,
      hijriDateLabel: formatHijriShort(selectedSessionDate),
      status: anyChecked ? 'completed' : 'not_started',
      isCompletedCorrectly: subForm.isCompletedCorrectly,
      extractedExamplesDone: subForm.extractedExamplesDone,
      appliedDuringRecitation: subForm.appliedDuringRecitation,
      rating: subForm.rating,
      score: Number(subForm.score),
      teacherNotes: subForm.teacherNotes
    });
    setEvalModalOpen(false);
  };

  const handleToggleCriterion = async (
    studentId: string,
    criterion: 'isCompletedCorrectly' | 'extractedExamplesDone' | 'appliedDuringRecitation'
  ) => {
    if (!currentAssignment) return;
    const existing = getStudentDaySubmission(studentId, selectedSessionDate);
    const maxScore = currentAssignment.maxScore || 10;

    const nextCompleted =
      criterion === 'isCompletedCorrectly'
        ? !existing?.isCompletedCorrectly
        : (existing?.isCompletedCorrectly ?? false);
    const nextExamples =
      criterion === 'extractedExamplesDone'
        ? !existing?.extractedExamplesDone
        : (existing?.extractedExamplesDone ?? false);
    const nextApplied =
      criterion === 'appliedDuringRecitation'
        ? !existing?.appliedDuringRecitation
        : (existing?.appliedDuringRecitation ?? false);

    const calc = computeDailyCriteriaGrade(nextCompleted, nextExamples, nextApplied, maxScore);

    await saveAtqiniSubmission({
      id: existing?.hijriDate === selectedSessionDate ? existing?.id : undefined,
      assignmentId: currentAssignment.id,
      studentId,
      hijriDate: selectedSessionDate,
      hijriDateLabel: formatHijriShort(selectedSessionDate),
      status: calc.status,
      isCompletedCorrectly: nextCompleted,
      extractedExamplesDone: nextExamples,
      appliedDuringRecitation: nextApplied,
      rating: calc.rating,
      score: calc.score,
      teacherNotes: existing?.teacherNotes || ''
    });
  };

  const handleToggleHomeworkStatus = async (studentId: string) => {
    await handleToggleCriterion(studentId, 'isCompletedCorrectly');
  };

  const handleToggleExamplesStatus = async (studentId: string) => {
    await handleToggleCriterion(studentId, 'extractedExamplesDone');
  };

  const handleToggleApplicationStatus = async (studentId: string) => {
    await handleToggleCriterion(studentId, 'appliedDuringRecitation');
  };

  return (
    <div className="space-y-6">

      {/* Header Bar */}
      <div className="flex flex-col gap-3 bg-white p-5 rounded-3xl border border-[#E8DFD8] shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-theme-primary shrink-0" />
              <h2 className="text-xl font-bold text-stone-900 font-quran">قسم «أتقني» — واجبات التجويد حصرياً</h2>
            </div>
            <p className="text-xs text-stone-500">
              مخصص حصرياً لواجبات أحكام التلاوة والتجويد، استخراج الأمثلة من المحفوظ، وتطبيقها أثناء التسميع
            </p>
          </div>

          <div className="flex items-center gap-2 flex-nowrap self-start sm:self-auto shrink-0">
            <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-white border border-stone-200 shadow-2xs shrink-0">
              <button
                type="button"
                onClick={() => setAssignmentTab('active')}
                title="الواجبات النشطة"
                aria-label="الواجبات النشطة"
                className={`h-9 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shrink-0 ${
                  assignmentTab === 'active'
                    ? 'bg-theme-primary text-white shadow-2xs'
                    : 'bg-white text-stone-600 hover:bg-stone-50 hover:text-theme-primary'
                }`}
              >
                <CheckCircle2 className={`w-4 h-4 shrink-0 ${assignmentTab === 'active' ? 'text-white' : 'text-theme-primary'}`} />
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono leading-none ${
                  assignmentTab === 'active'
                    ? 'bg-white/20 text-white'
                    : 'bg-stone-100 text-stone-600'
                }`}>
                  {activeAssignments.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setAssignmentTab('archived')}
                title="الواجبات المؤرشفة"
                aria-label="الواجبات المؤرشفة"
                className={`h-9 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shrink-0 ${
                  assignmentTab === 'archived'
                    ? 'bg-theme-primary text-white shadow-2xs'
                    : 'bg-white text-stone-600 hover:bg-stone-50 hover:text-theme-primary'
                }`}
              >
                <Archive className={`w-4 h-4 shrink-0 ${assignmentTab === 'archived' ? 'text-white' : 'text-theme-primary'}`} />
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono leading-none ${
                  assignmentTab === 'archived'
                    ? 'bg-white/20 text-white'
                    : 'bg-stone-100 text-stone-600'
                }`}>
                  {archivedAssignments.length}
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleOpenAssignmentModal()}
              title="نشر واجب تجويد جديد"
              aria-label="نشر واجب تجويد جديد"
              className="w-10 h-10 bg-theme-primary hover:bg-theme-primary-hover text-white border border-theme-primary rounded-xl flex items-center justify-center shadow-xs transition shrink-0 cursor-pointer active:scale-95"
            >
              <Plus className="w-5 h-5 shrink-0" />
            </button>
          </div>
        </div>

        {assignmentTab === 'archived' && (
          <div className="pt-2 border-t border-stone-100">
            <span className="text-[11px] text-theme-primary bg-stone-50 border border-stone-200 px-3 py-1 rounded-xl font-medium inline-block">
              سجل الواجبات المؤرشفة محفوظ بالكامل مع كشف إنجاز وتصحيح الطالبات السابق
            </span>
          </div>
        )}
      </div>

      {/* Assignments Selection Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {availableAssignments.map(as => (
          <button
            key={as.id}
            onClick={() => setSelectedAssignmentId(as.id)}
            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              selectedAssignmentId === as.id
                ? 'bg-[#8E5364] text-white shadow-xs'
                : 'bg-white text-stone-700 hover:bg-[#FAF6F2] border border-[#E8DFD8]'
            }`}
          >
            {isAtqiniAssignmentArchived(as) ? (
              <Archive className="w-4 h-4" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>{as.tajweedRule}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
              selectedAssignmentId === as.id ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'
            }`}>
              {as.maxScore} درجات
            </span>
          </button>
        ))}

        {availableAssignments.length === 0 && (
          <div className="w-full p-6 bg-white rounded-3xl border border-dashed border-[#8E5364]/40 text-center space-y-3 my-2 shadow-2xs">
            <div className="flex justify-center">
              {assignmentTab === 'archived' ? (
                <Archive className="w-8 h-8 text-amber-700" />
              ) : (
                <Sparkles className="w-8 h-8 text-[#9A5643]" />
              )}
            </div>
            <h4 className="font-bold text-stone-800 text-sm">
              {assignmentTab === 'archived' ? 'لا توجد واجبات مؤرشفة حالياً' : 'لا توجد واجبات تجويد نشطة حالية'}
            </h4>
            <p className="text-xs text-stone-500 max-w-md mx-auto">
              {assignmentTab === 'archived'
                ? 'عند أرشفة أي واجب من تبويب «الواجبات النشطة» سيظهر هنا بكامل سجلات ودرجات الطالبات التاريخية.'
                : 'يمكنكِ نشر واجب تجويد جديد مخصص الآن أو استعادة الواجبات النموذجية (أحكام الإدغام، الإخفاء، القلقلة) بضغطة زر واحدة.'}
            </p>
            {assignmentTab === 'active' && (
              <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                <button
                  onClick={handleRestoreSampleAssignments}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>استعادة الواجبات النموذجية التلقائية</span>
                </button>
                <button
                  onClick={() => handleOpenAssignmentModal()}
                  className="px-4 py-2 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>نشر واجب جديد</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Active Assignment Card Details */}
      {currentAssignment && (
        <div className="bg-white p-6 rounded-3xl border border-[#E8DFD8] shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#9A5643]" />
                <h3 className="text-base sm:text-lg font-bold text-stone-900">{currentAssignment.title}</h3>
                {isCurrentArchived && (
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 font-bold inline-flex items-center gap-1">
                    <Archive className="w-3 h-3" />
                    <span>واجب مؤرشف</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                الحكم: <strong className="text-[#8E5364]">{currentAssignment.tajweedRule}</strong> • النشر: <strong>{formatHijriShort(currentAssignment.publishedDate)}</strong> • التسليم: <strong className="text-rose-700">{formatHijriShort(currentAssignment.dueDate)}</strong>
              </p>
            </div>

            <div className="flex flex-nowrap items-center gap-2 shrink-0">
              {currentAssignment.sheikhVideoUrl && (
                <a
                  href={currentAssignment.sheikhVideoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="شرح الشيخ المرئي"
                  aria-label="شرح الشيخ المرئي"
                  className="w-9 h-9 p-2.5 rounded-xl bg-white hover:bg-stone-50 text-theme-primary border border-stone-200 flex items-center justify-center transition active:scale-95 shrink-0"
                >
                  <Video className="w-4 h-4" />
                </a>
              )}

              {/* Duplicate Assignment Button */}
              <button
                type="button"
                onClick={() => handleDuplicateAssignmentModal(currentAssignment)}
                title="نسخ الواجب"
                aria-label="نسخ الواجب"
                className="w-9 h-9 p-2.5 rounded-xl bg-white hover:bg-stone-50 text-theme-primary border border-stone-200 flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0"
              >
                <Copy className="w-4 h-4" />
              </button>

              {/* Archive / Unarchive Assignment Button */}
              <button
                type="button"
                onClick={() => handleToggleArchiveAssignment(currentAssignment)}
                title={isCurrentArchived ? 'إلغاء الأرشفة' : 'أرشفة الواجب'}
                aria-label={isCurrentArchived ? 'إلغاء الأرشفة' : 'أرشفة الواجب'}
                className="w-9 h-9 p-2.5 rounded-xl bg-white hover:bg-stone-50 text-theme-primary border border-stone-200 flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0"
              >
                {isCurrentArchived ? (
                  <RotateCcw className="w-4 h-4" />
                ) : (
                  <Archive className="w-4 h-4" />
                )}
              </button>

              {/* Edit Assignment Button */}
              <button
                type="button"
                onClick={() => handleOpenAssignmentModal(currentAssignment)}
                title="تعديل الواجب"
                aria-label="تعديل الواجب"
                className="w-9 h-9 p-2.5 rounded-xl bg-white hover:bg-stone-50 text-theme-primary border border-stone-200 flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0"
              >
                <Edit className="w-4 h-4" />
              </button>

              {/* Delete Assignment Button */}
              <button
                type="button"
                onClick={() => confirmDeleteAssignment(currentAssignment)}
                title="حذف الواجب"
                aria-label="حذف الواجب"
                className="w-9 h-9 p-2.5 rounded-xl bg-white hover:bg-stone-50 text-theme-primary border border-stone-200 flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-[#FCFAF8] border border-[#EFE8E2] text-xs">
              <span className="font-bold text-stone-800 block mb-1">شرح الحكم التجويدي:</span>
              <p className="text-stone-600 leading-relaxed text-[11px]">{currentAssignment.description}</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#FCFAF8] border border-[#EFE8E2] text-xs">
              <span className="font-bold text-stone-800 block mb-1">الأمثلة المطلوب استخراجها:</span>
              <p className="text-stone-600 leading-relaxed text-[11px]">{currentAssignment.examplesRequirement}</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#FCFAF8] border border-[#EFE8E2] text-xs">
              <span className="font-bold text-stone-800 block mb-1">طريقة التطبيق أثناء التسميع:</span>
              <p className="text-stone-600 leading-relaxed text-[11px]">{currentAssignment.recitationRuleApplication}</p>
            </div>
          </div>
        </div>
      )}

      {/* Students Submissions & Evaluation Roster */}
      {currentAssignment && (
        <div className="bg-white rounded-3xl border border-[#E8DFD8] shadow-2xs overflow-hidden">
          <div className="p-4 bg-[#FAF6F2] border-b border-stone-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-stone-900 text-sm font-quran">
                  كشف إنجاز وتصحيح الطالبات لواجب: {currentAssignment.tajweedRule}
                </h3>
                <span className="text-[11px] text-stone-500">
                  رصد يومي بالهجري لإتمام الواجب، استخراج الأمثلة، وتطبيق الحكم أثناء التسميع (تُحتسب الدرجة اليومية تلقائياً وتُرحّل للمعدل التراكمي)
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
                <span className="px-2.5 py-1 rounded-xl bg-white border border-[#E8DFD8] font-bold text-stone-700">
                  اليوم المحدد: <strong className="text-theme-primary">{formatHijriDate(selectedSessionDate, { includeWeekday: true })}</strong>
                </span>
                <span className="px-2.5 py-1 rounded-xl bg-white border border-[#E8DFD8]">
                  تم تصحيح اليوم:{' '}
                  <strong className="text-theme-primary">
                    {
                      availableStudents.filter(st => {
                        const sub = getStudentDaySubmission(st.id, selectedSessionDate);
                        return Boolean(
                          sub &&
                            (sub.status === 'completed' ||
                              sub.isCompletedCorrectly ||
                              sub.extractedExamplesDone ||
                              sub.appliedDuringRecitation ||
                              (typeof sub.score === 'number' && sub.score > 0))
                        );
                      }).length
                    }
                  </strong>{' '}
                  من {availableStudents.length} طالبة
                </span>
              </div>
            </div>

            {/* Daily Hijri Session Selector */}
            <div className="bg-white rounded-2xl p-2.5 border border-[#E8DFD8] flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
                <span className="text-[11px] font-bold text-stone-600 shrink-0 flex items-center gap-1 pl-1">
                  <Calendar className="w-3.5 h-3.5 text-theme-primary" />
                  <span>أيام الرصد الهجرية:</span>
                </span>
                {sessionHijriDays.map(dayItem => {
                  const isSelected = dayItem.iso === selectedSessionDate;
                  const gradedOnDayCount = availableStudents.filter(st => {
                    const s = getStudentDaySubmission(st.id, dayItem.iso);
                    return Boolean(
                      s &&
                        (s.status === 'completed' ||
                          s.isCompletedCorrectly ||
                          s.extractedExamplesDone ||
                          s.appliedDuringRecitation ||
                          (typeof s.score === 'number' && s.score > 0))
                    );
                  }).length;

                  return (
                    <button
                      key={dayItem.iso}
                      type="button"
                      onClick={() => setSelectedSessionDate(dayItem.iso)}
                      title={`رصد يوم ${dayItem.weekday} — ${dayItem.hijriFull}`}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 border ${
                        isSelected
                          ? 'bg-theme-primary text-white border-theme-primary shadow-2xs'
                          : 'bg-[#FAF6F2] text-stone-700 border-[#E8DFD8] hover:border-theme-primary/40 hover:text-theme-primary'
                      }`}
                    >
                      <span>{dayItem.weekday}</span>
                      <span className={`text-[10px] ${isSelected ? 'text-white/90' : 'text-stone-500'}`}>
                        ({dayItem.hijriDayMonth})
                      </span>
                      {dayItem.isToday && (
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                            isSelected ? 'bg-white/25 text-white' : 'bg-theme-primary/12 text-theme-primary'
                          }`}
                        >
                          اليوم
                        </span>
                      )}
                      {gradedOnDayCount > 0 && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono leading-none ${
                            isSelected ? 'bg-white text-theme-primary font-extrabold' : 'bg-emerald-100 text-emerald-800'
                          }`}
                          title={`تم تصحيح ${gradedOnDayCount} طالبة في هذا اليوم الهجري`}
                        >
                          {gradedOnDayCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="shrink-0">
                <HijriDateNavigationBar
                  selectedDate={selectedSessionDate}
                  onChangeDate={setSelectedSessionDate}
                  compact
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-stone-50 text-stone-500 font-bold border-b border-stone-200">
                  <th className="p-3.5">#</th>
                  <th className="p-3.5">اسم الطالبة</th>
                  <th className="p-3.5">الحلقة</th>
                  <th className="p-3.5 text-center">أتمت الواجب</th>
                  <th className="p-3.5 text-center">استخرجت الأمثلة</th>
                  <th className="p-3.5 text-center">طبقت أثناء التسميع</th>
                  <th className="p-3.5">التقدير</th>
                  <th className="p-3.5">الدرجة اليومية</th>
                  <th className="p-3.5 text-center">مجموع / متوسط الأيام</th>
                  <th className="p-3.5">ملاحظات المعلمة</th>
                  <th className="p-3.5 text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {availableStudents.map((student, idx) => {
                  const circle = circles.find(c => c.id === student.circleId);
                  const sub = getStudentDaySubmission(student.id, selectedSessionDate);
                  const cumStats = getStudentCumulativeStats(student.id);

                  return (
                    <tr key={student.id} className="hover:bg-[#FCF9FA] transition">
                      <td className="p-3.5 text-stone-400 font-semibold">{idx + 1}</td>

                      <td className="p-3.5 font-bold text-stone-900">
                        <div className="privacy-student-name">{student.name}</div>
                        <div className="text-[10px] text-stone-400 font-mono privacy-phone">{student.code}</div>
                      </td>

                      <td className="p-3.5 text-stone-600">
                        {circle?.name || 'غير محدد'}
                      </td>

                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleHomeworkStatus(student.id)}
                          title={sub?.isCompletedCorrectly ? 'انقري لإلغاء معيار إتمام الواجب لهذا اليوم الهجري' : 'انقري لتسجيل إتمام الواجب واحتساب درجته تلقائياً'}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-95 flex items-center justify-center gap-1.5 mx-auto ${
                            sub?.isCompletedCorrectly
                              ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300'
                              : 'bg-stone-100 text-stone-500 hover:bg-[#FDF6F2] hover:text-[#9A5643] hover:border-[#E5C3B3] border border-stone-200'
                          }`}
                        >
                          {sub?.isCompletedCorrectly ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>أتمت الواجب</span>
                            </>
                          ) : (
                            <>
                              <X className="w-3.5 h-3.5 text-stone-400" />
                              <span>لم يُنجز</span>
                            </>
                          )}
                        </button>
                      </td>

                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleExamplesStatus(student.id)}
                          title="انقري لتبديل حالة استخراج الأمثلة وتحديث الدرجة اليومية تلقائياً"
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer inline-flex items-center gap-1 ${
                            sub?.extractedExamplesDone
                              ? 'text-emerald-700 bg-emerald-50/70 hover:bg-emerald-100 border border-emerald-200'
                              : 'text-stone-400 bg-stone-50 hover:bg-stone-100 border border-stone-200'
                          }`}
                        >
                          {sub?.extractedExamplesDone ? (
                            <>
                              <span>استخرجت</span>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            </>
                          ) : (
                            <span>لم تستخرج</span>
                          )}
                        </button>
                      </td>

                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleApplicationStatus(student.id)}
                          title="انقري لتبديل حالة تطبيق الحكم أثناء التسميع وتحديث الدرجة اليومية تلقائياً"
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer inline-flex items-center gap-1 ${
                            sub?.appliedDuringRecitation
                              ? 'text-emerald-700 bg-emerald-50/70 hover:bg-emerald-100 border border-emerald-200'
                              : 'text-stone-400 bg-stone-50 hover:bg-stone-100 border border-stone-200'
                          }`}
                        >
                          {sub?.appliedDuringRecitation ? (
                            <>
                              <span>طبقت</span>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            </>
                          ) : (
                            <span>بانتظار التسميع</span>
                          )}
                        </button>
                      </td>

                      <td className="p-3.5">
                        {sub?.rating ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#FAF2F4] text-[#8E5364] border border-[#EBD5DC]">
                            {sub.rating}
                          </span>
                        ) : (
                          <span className="text-stone-300">لم تقيم</span>
                        )}
                      </td>

                      <td className="p-3.5">
                        {sub ? (
                          <span className="font-extrabold text-sm text-stone-900">
                            <span className="privacy-score-digit">{sub.score}</span> <span className="text-[10px] text-stone-400">/ {currentAssignment?.maxScore || 10}</span>
                          </span>
                        ) : (
                          <span className="text-stone-300">—</span>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        {cumStats.gradedDaysCount > 0 ? (
                          <div className="inline-flex flex-col items-center px-2.5 py-1 rounded-xl bg-[#FAF6F2] border border-[#E8DFD8]">
                            <span className="font-extrabold text-xs text-theme-primary">
                              المتوسط: <span className="privacy-score-digit">{cumStats.avgScore}</span> / {currentAssignment?.maxScore || 10}
                            </span>
                            <span className="text-[10px] text-stone-500">
                              المجموع: <span className="privacy-score-digit">{cumStats.totalScore}</span> من {cumStats.totalPossible} ({cumStats.gradedDaysCount} {cumStats.gradedDaysCount === 1 ? 'يوم' : 'أيام'})
                            </span>
                          </div>
                        ) : (
                          <span className="text-stone-300">—</span>
                        )}
                      </td>

                      <td className="p-3.5 text-stone-600 max-w-xs">
                        <div className="truncate">{sub?.teacherNotes || '—'}</div>
                        {(sub?.updatedAt || sub?.submittedAt) && (
                          <div className="text-[10px] text-stone-400 mt-0.5 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 text-[#8E5364]" />
                            <span>{formatHijriDateTime(sub?.updatedAt || sub?.submittedAt)}</span>
                          </div>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEvalModal(student)}
                            className="px-2.5 py-1 bg-[#8E5364] hover:bg-[#744251] text-white rounded-lg text-[11px] font-bold transition shadow-2xs cursor-pointer active:scale-95 flex items-center gap-1"
                          >
                            {sub ? (
                              <>
                                <Edit className="w-3 h-3" />
                                <span>تعديل</span>
                              </>
                            ) : (
                              <span>تصحيح</span>
                            )}
                          </button>
                          {sub && (
                            <button
                              type="button"
                              onClick={() => setSubmissionToDelete({ id: sub.id, studentName: student.name })}
                              className="p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="حذف تصحيح هذا اليوم الهجري"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal for Assignment */}
      {deleteConfirmOpen && assignmentToDelete && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-100 space-y-4 text-right" dir="rtl">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-stone-900 text-base font-quran">
                تأكيد حذف واجب «أتقني» للتجويد
              </h3>
              <p className="text-sm font-bold text-rose-700">
                هل أنت متأكد من حذف هذا السجل؟
              </p>
              <p className="text-xs text-stone-600 font-bold mt-1">
                «{assignmentToDelete.title}»
              </p>
            </div>

            <p className="text-xs text-stone-500 leading-relaxed bg-[#FCFAF8] p-3 rounded-2xl border border-stone-200 text-center">
              سيتم حذف الواجب وسجلات تصحيح الطالبات المرتبطة به نهائياً وتحديث السحابة فوراً.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="px-4 py-2 text-stone-600 text-xs font-bold rounded-xl hover:bg-stone-100 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={executeDeleteAssignment}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal for Student Submission */}
      {submissionToDelete && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-100 space-y-4 text-right" dir="rtl">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-stone-900 text-base font-quran">
                تأكيد حذف تصحيح الواجب
              </h3>
              <p className="text-sm font-bold text-rose-700">
                هل أنت متأكد من حذف هذا السجل؟
              </p>
              <p className="text-xs text-stone-600 font-bold mt-1">
                للطالبة: «{submissionToDelete.studentName}»
              </p>
            </div>

            <p className="text-xs text-stone-500 leading-relaxed bg-[#FCFAF8] p-3 rounded-2xl border border-stone-200 text-center">
              سيتم مسح درجة وتقييم الطالبة لهذا الواجب وتحديث النتائج سحابياً فوراً.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setSubmissionToDelete(null)}
                className="px-4 py-2 text-stone-600 text-xs font-bold rounded-xl hover:bg-stone-100 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={async () => {
                  const targetId = submissionToDelete.id;
                  setSubmissionToDelete(null);
                  await deleteStudentAtqiniSubmission(targetId);
                  showToast?.('تم حذف تقييم الواجب بنجاح ومزامنة التغييرات سحابياً 🗑️');
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

      {/* Add / Edit Assignment Modal */}
      {assignmentModalOpen && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-xl border border-stone-200 max-h-[92vh] overflow-y-auto space-y-4">
            
            <div className="flex items-center justify-between border-b border-stone-100 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#9A5643]" />
                <h3 className="font-bold text-stone-900 text-base font-quran">
                  {editingAssignment ? 'تعديل واجب «أتقني»' : 'نشر واجب تجويد جديد'}
                </h3>
              </div>
              <button onClick={() => setAssignmentModalOpen(false)} className="text-stone-400 hover:text-stone-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Templates Selector */}
            {!editingAssignment && (
              <div className="p-3 bg-[#FAF7F4] rounded-2xl border border-[#EFE8E2] space-y-1.5">
                <span className="text-[11px] font-bold text-stone-700 block">
                  قوالب تجويدية جاهزة بضغطة زر (اختياري للسرعة):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {TAJWEED_TEMPLATES.map(tpl => (
                    <button
                      key={tpl.name}
                      type="button"
                      onClick={() => handleApplyTemplate(tpl)}
                      className="px-2.5 py-1 rounded-xl bg-white hover:bg-stone-50 border border-stone-200 text-[10px] font-bold text-stone-700 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      <Sparkles className="w-3 h-3 text-[#9A5643]" />
                      <span>{tpl.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSaveAssignment} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">عنوان الواجب التجويدي *</label>
                <input
                  type="text"
                  required
                  value={assignmentForm.title}
                  onChange={e => setAssignmentForm({ ...assignmentForm, title: e.target.value })}
                  placeholder="مثال: واجب الإدغام بغنة وبغير غنة وأمثلته"
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-[#8E5364]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">الحكم التجويدي *</label>
                <input
                  type="text"
                  required
                  value={assignmentForm.tajweedRule}
                  onChange={e => setAssignmentForm({ ...assignmentForm, tajweedRule: e.target.value })}
                  placeholder="مثال: الإدغام بغنة وبغير غنة"
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-[#8E5364]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">شرح الحكم</label>
                <textarea
                  rows={2}
                  value={assignmentForm.description}
                  onChange={e => setAssignmentForm({ ...assignmentForm, description: e.target.value })}
                  placeholder="شرح مبسط وميسر لأحكام القاعدة..."
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-[#8E5364]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">رابط شرح الشيخ (يوتيوب/صوت)</label>
                  <input
                    type="url"
                    value={assignmentForm.sheikhVideoUrl}
                    onChange={e => setAssignmentForm({ ...assignmentForm, sheikhVideoUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">الدرجة القصوى للواجب</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={assignmentForm.maxScore}
                    onChange={e => setAssignmentForm({ ...assignmentForm, maxScore: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="space-y-2.5">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">تاريخ النشر (تقويم أم القرى)</label>
                  <HijriDateNavigationBar
                    selectedDate={assignmentForm.publishedDate}
                    onChangeDate={date => setAssignmentForm({ ...assignmentForm, publishedDate: date })}
                    compact
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">موعد التسليم النهائي (تقويم أم القرى)</label>
                  <HijriDateNavigationBar
                    selectedDate={assignmentForm.dueDate}
                    onChangeDate={date => setAssignmentForm({ ...assignmentForm, dueDate: date })}
                    compact
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">الأمثلة المطلوب استخراجها من المحفوظ</label>
                <input
                  type="text"
                  value={assignmentForm.examplesRequirement}
                  onChange={e => setAssignmentForm({ ...assignmentForm, examplesRequirement: e.target.value })}
                  placeholder="مثال: استخراج ٤ أمثلة للنون الساكنة والتنوين"
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">طريقة التطبيق أثناء التسميع</label>
                <input
                  type="text"
                  value={assignmentForm.recitationRuleApplication}
                  onChange={e => setAssignmentForm({ ...assignmentForm, recitationRuleApplication: e.target.value })}
                  placeholder="مثال: النطق السليم الصافي مع مراعاة زمن الغنة"
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-stone-100">
                {editingAssignment ? (
                  <button
                    type="button"
                    onClick={() => confirmDeleteAssignment(editingAssignment)}
                    className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف هذا الواجب</span>
                  </button>
                ) : <span />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAssignmentModalOpen(false)}
                    className="px-4 py-2 text-stone-600 text-xs rounded-xl hover:bg-stone-100 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#8E5364] text-white text-xs font-bold rounded-xl hover:bg-[#744251] shadow-xs active:scale-95 transition cursor-pointer"
                  >
                    حفظ
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Correction & Rating Modal */}
      {evalModalOpen && evalStudent && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-stone-200">
            <h3 className="font-bold text-stone-900 text-base font-quran mb-1">
              تصحيح ورصد واجب «أتقني» للتجويد
            </h3>
            <p className="text-xs text-stone-500 mb-1">
              للطالبة: <strong className="privacy-student-name">{evalStudent.name}</strong> • الواجب: <strong>{currentAssignment?.tajweedRule}</strong>
            </p>
            <p className="text-[11px] text-theme-primary font-bold mb-4">
              تاريخ الرصد الهجري: {formatHijriDate(selectedSessionDate, { includeWeekday: true })}
            </p>

            <form onSubmit={handleSaveSubmission} className="space-y-4">
              
              {/* Checkboxes for completion requirements */}
              <div className="space-y-2 bg-[#FAF6F2] p-3 rounded-2xl border border-[#EFE8E2]">
                <label className="flex items-center gap-2 text-xs font-medium text-stone-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={subForm.isCompletedCorrectly}
                    onChange={e => {
                      const checked = e.target.checked;
                      const maxScore = currentAssignment?.maxScore || 10;
                      const calc = computeDailyCriteriaGrade(
                        checked,
                        subForm.extractedExamplesDone,
                        subForm.appliedDuringRecitation,
                        maxScore
                      );
                      setSubForm(prev => ({
                        ...prev,
                        isCompletedCorrectly: checked,
                        status: calc.status,
                        score: calc.score,
                        rating: calc.rating
                      }));
                    }}
                    className="rounded text-[#8E5364]"
                  />
                  <span>أتمت الواجب بالشكل المطلوب كاملاً ✅</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-medium text-stone-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={subForm.extractedExamplesDone}
                    onChange={e => {
                      const checked = e.target.checked;
                      const maxScore = currentAssignment?.maxScore || 10;
                      const calc = computeDailyCriteriaGrade(
                        subForm.isCompletedCorrectly,
                        checked,
                        subForm.appliedDuringRecitation,
                        maxScore
                      );
                      setSubForm(prev => ({
                        ...prev,
                        extractedExamplesDone: checked,
                        status: calc.status,
                        score: calc.score,
                        rating: calc.rating
                      }));
                    }}
                    className="rounded text-[#8E5364]"
                  />
                  <span>استخرجت الأمثلة من محفوظها بدقة</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-medium text-stone-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={subForm.appliedDuringRecitation}
                    onChange={e => {
                      const checked = e.target.checked;
                      const maxScore = currentAssignment?.maxScore || 10;
                      const calc = computeDailyCriteriaGrade(
                        subForm.isCompletedCorrectly,
                        subForm.extractedExamplesDone,
                        checked,
                        maxScore
                      );
                      setSubForm(prev => ({
                        ...prev,
                        appliedDuringRecitation: checked,
                        status: calc.status,
                        score: calc.score,
                        rating: calc.rating
                      }));
                    }}
                    className="rounded text-[#8E5364]"
                  />
                  <span>طبقت الحكم التجويدي أثناء جلسة التسميع</span>
                </label>
              </div>

              {/* Rating and Score */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">التقدير اللفظي</label>
                  <select
                    value={subForm.rating}
                    onChange={e => {
                      const newRating = e.target.value as AtqiniRating;
                      const isNotDone = newRating === 'لم يُنجز';
                      setSubForm(prev => ({
                        ...prev,
                        rating: newRating,
                        isCompletedCorrectly: !isNotDone,
                        status: isNotDone ? 'not_started' : 'completed',
                        score: isNotDone ? 0 : (prev.score > 0 ? prev.score : (currentAssignment?.maxScore || 10))
                      }));
                    }}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white font-bold"
                  >
                    <option value="ممتاز">ممتاز ⭐⭐⭐</option>
                    <option value="جيد جدًا">جيد جدًا ⭐⭐</option>
                    <option value="جيد">جيد ⭐</option>
                    <option value="يحتاج إلى تحسين">يحتاج إلى تحسين</option>
                    <option value="لم يُنجز">لم يُنجز</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    الدرجة المستحقة (من {currentAssignment?.maxScore || 10})
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max={currentAssignment?.maxScore || 10}
                    value={subForm.score}
                    onChange={e => setSubForm({ ...subForm, score: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs font-bold text-stone-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">ملاحظات المعلمة وتوجيهات الإتقان</label>
                <textarea
                  rows={2}
                  value={subForm.teacherNotes}
                  onChange={e => setSubForm({ ...subForm, teacherNotes: e.target.value })}
                  placeholder="تشجيع الطالبة أو التنبيه على ملاحظات المخارج والصفات..."
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
                  className="px-5 py-2 bg-[#8E5364] text-white text-xs font-bold rounded-xl hover:bg-[#744251] shadow-xs active:scale-95 transition cursor-pointer"
                >
                  حفظ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
