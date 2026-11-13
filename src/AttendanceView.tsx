import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ErrorBoundary } from '../components/ErrorBoundary';
import {
  CheckSquare, Calendar, Users, Clock, CheckCircle2, XCircle,
  AlertCircle, AlertTriangle, Star, Sparkles, Filter, Save, ChevronLeft, ChevronRight, Trash2,
  Download, Award, X, Camera, Palette, Image as ImageIcon, Type, Plus, Minus, RotateCcw, Archive,
  ClipboardCheck, Zap, Send
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { AttendanceRecord } from '../types';
import { HijriDateNavigationBar, formatHijriDate, formatHijriDateTime, getHijriParts, getTodayISO } from '../utils/hijriDate';
import { triggerStudentTelegramAlert } from '../utils/telegramAlert';

interface HonorsBoardStudentItem {
  id: string;
  name: string;
  stars: number;
}

export const AttendanceView: React.FC = () => {
  const {
    students, circles, tracks, attendanceRecords, dailyRecords, studentChallengeSubmissions,
    saveAttendance, saveBulkAttendance,
    clearStudentDayAttendance,
    archiveStudent, restoreStudent,
    showToast, allStudentScores, selectedTrackId,
    selectedCircleId, setSelectedCircleId, selectedDate, setSelectedDate, settings
  } = useApp();

  const availableCircles = React.useMemo(() => {
    if (!selectedTrackId || selectedTrackId === 'all') return circles.filter(c => !c.isArchived);
    return circles.filter(c => !c.isArchived && c.trackId === selectedTrackId);
  }, [circles, selectedTrackId]);

  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'early_prep' | 'absent' | 'archived'>('all');
  const [reasonInputs, setReasonInputs] = useState<Record<string, string>>({});
  const [showHonorsBoardModal, setShowHonorsBoardModal] = useState(false);
  const [isExportingPng, setIsExportingPng] = useState(false);
  const honorsBoardRef = useRef<HTMLDivElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const bgInputRef = useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (availableCircles.length > 0 && !availableCircles.some(c => c.id === selectedCircleId)) {
      const nextId = availableCircles[0].id;
      if (nextId && nextId !== selectedCircleId) {
        setSelectedCircleId(nextId);
      }
    }
  }, [availableCircles, selectedCircleId, setSelectedCircleId]);

  const activeCircle = React.useMemo(
    () => availableCircles.find(c => c.id === selectedCircleId) || availableCircles[0] || circles[0],
    [availableCircles, selectedCircleId, circles]
  );
  const activeTrack = React.useMemo(
    () => tracks.find(t => t.id === activeCircle?.trackId),
    [tracks, activeCircle?.trackId]
  );
  const circleStudents = React.useMemo(
    () => students.filter(s => s.circleId === activeCircle?.id && s.status === 'active' && !s.archived),
    [students, activeCircle?.id]
  );
  const archivedCircleStudents = React.useMemo(
    () => students.filter(s => s.circleId === activeCircle?.id && (s.status === 'archived' || s.archived)),
    [students, activeCircle?.id]
  );

  const isSelectedDateThursday = React.useMemo(() => {
    if (!selectedDate) return false;
    const d = new Date(`${selectedDate}T12:00:00`);
    return d.getDay() === 4;
  }, [selectedDate]);

  // Compute Sunday–Thursday ISO dates for the selected week
  const selectedWeekDaysISO = React.useMemo(() => {
    const cleanBase = selectedDate || getTodayISO();
    const parts = cleanBase.split('-').map(Number);
    const d = parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0) : new Date();
    if (Number.isNaN(d.getTime())) return [cleanBase];
    const dayOfWeek = d.getDay(); // 0=Sun ... 6=Sat
    const sunday = new Date(d);
    sunday.setDate(d.getDate() - dayOfWeek);

    const days: string[] = [];
    for (let i = 0; i <= 4; i++) {
      const cur = new Date(sunday);
      cur.setDate(sunday.getDate() + i);
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const dayNum = String(cur.getDate()).padStart(2, '0');
      days.push(`${y}-${m}-${dayNum}`);
    }
    return days;
  }, [selectedDate]);

  const selectedHijriParts = React.useMemo(() => getHijriParts(selectedDate || getTodayISO()), [selectedDate]);

  // Formatted Hijri Week & Month header for the Weekly Honors Board
  const hijriWeekHeader = React.useMemo(() => {
    const weekNames = ['الأسبوع الأول', 'الأسبوع الثاني', 'الأسبوع الثالث', 'الأسبوع الرابع'];
    const weekName = weekNames[(selectedHijriParts.weekOfMonth || 1) - 1] || 'الأسبوع الأول';
    return `${weekName} - ${selectedHijriParts.monthName} ${selectedHijriParts.year} هـ`;
  }, [selectedHijriParts]);

  // Strict weekly absence counter (Sunday through Thursday): counts both excused and unexcused absences
  const getStudentWeeklyAbsencesForDates = (studentId: string, weekDays: string[]): number => {
    let absences = 0;
    for (const dateIso of weekDays) {
      const existing = attendanceRecords.find(a => a.studentId === studentId && a.date === dateIso);
      if (existing?.isManuallyCleared) {
        continue;
      }
      if (existing) {
        if (existing.status === 'absent_unexcused' || existing.status === 'absent_excused') {
          absences += 1;
        }
        continue;
      }
      const dailyRec = dailyRecords.find(r => r.studentId === studentId && r.date === dateIso);
      if (dailyRec && (dailyRec.status === 'absent' || dailyRec.status === 'excused')) {
        absences += 1;
      }
    }
    return absences;
  };

  const getStudentWeeklyAbsences = (studentId: string): number => {
    return getStudentWeeklyAbsencesForDates(studentId, selectedWeekDaysISO);
  };

  // Compute cumulative stars up to the selected week of the month (Week 1 -> 1 star, Week 2 -> 2 stars, Week 3 -> 3 stars, Week 4 -> 4 stars)
  const getStudentCumulativeMonthStars = (studentId: string): number => {
    const targetWeekNumber = Math.min(4, Math.max(1, selectedHijriParts.weekOfMonth || 1));
    const cleanBase = selectedDate || getTodayISO();
    const parts = cleanBase.split('-').map(Number);
    const d = parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0) : new Date();
    if (Number.isNaN(d.getTime())) return targetWeekNumber;
    const currentSunday = new Date(d);
    currentSunday.setDate(d.getDate() - d.getDay());

    let earnedStars = 0;
    for (let w = 0; w < targetWeekNumber; w++) {
      const wkSun = new Date(currentSunday);
      wkSun.setDate(currentSunday.getDate() - w * 7);
      const wkDays: string[] = [];
      for (let i = 0; i <= 4; i++) {
        const cur = new Date(wkSun);
        cur.setDate(wkSun.getDate() + i);
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, '0');
        const dayNum = String(cur.getDate()).padStart(2, '0');
        wkDays.push(`${y}-${m}-${dayNum}`);
      }
      if (getStudentWeeklyAbsencesForDates(studentId, wkDays) === 0) {
        earnedStars += 1;
      }
    }
    return Math.max(1, Math.min(4, earnedStars));
  };

  // Strict Zero-Absence Qualification for Weekly Honors Board (متألقات الأسبوع = صفر غياب)
  const weeklyHonorStudents = React.useMemo(() => {
    return circleStudents.filter(st => getStudentWeeklyAbsences(st.id) === 0);
  }, [circleStudents, attendanceRecords, dailyRecords, selectedWeekDaysISO]);

  // ============================================================================
  // Interactive Honors Board Studio State (محرر وتصميم لوحة الشرف التفاعلي)
  // ============================================================================
  const [boardAcademyTitle, setBoardAcademyTitle] = useState<string>(
    settings?.name || 'مقرأة غيث الغيم لتعليم القرآن الكريم'
  );
  const [boardMainTitle, setBoardMainTitle] = useState<string>('لوحة شرف متألقات الأسبوع');
  const [boardTrackCircleBadge, setBoardTrackCircleBadge] = useState<string>(
    `${activeCircle?.name || 'الحلقة'} • ${activeTrack?.name || 'مسار الحفظ والتمكين'}`
  );
  const [boardWeekDateLabel, setBoardWeekDateLabel] = useState<string>(hijriWeekHeader);
  const [boardSubtitle, setBoardSubtitle] = useState<string>(
    'نجمات الانضباط والحضور التام طوال الأسبوع 🌟'
  );
  const [boardDescription, setBoardDescription] = useState<string>(
    'انضباط كامل بنسبة ١٠٠٪ (صفر غياب من الأحد إلى الخميس)'
  );
  const [boardClosingDua, setBoardClosingDua] = useState<string>(
    '«مع خالص الدعوات بالتوفيق والاستمرار في درب القرآن الكريم»'
  );
  const [boardTeacherLabel, setBoardTeacherLabel] = useState<string>('معلمة الحلقة:');
  const [boardTeacherName, setBoardTeacherName] = useState<string>(
    `أ. ${activeCircle?.teacherName || 'معلمة الحلقة'}`
  );
  const [boardLeaderLabel, setBoardLeaderLabel] = useState<string>('قائدة المقرأة / المشرفة:');
  const [boardLeaderName, setBoardLeaderName] = useState<string>(
    `أ. ${settings?.leaderName || 'ريفة المنصوري'}`
  );

  // Studio Visual Controls
  const [boardBgColor, setBoardBgColor] = useState<string>('#FAF4E8');
  const [boardBgTintColor, setBoardBgTintColor] = useState<string>('#FFFFFF');
  const [boardBgTintOpacity, setBoardBgTintOpacity] = useState<number>(0);
  const [boardHeaderBgColor, setBoardHeaderBgColor] = useState<string>('#2D5A43');
  const [boardAccentColor, setBoardAccentColor] = useState<string>('#C9A24D');
  // Dedicated Text Color States for all 5 board text groups
  const [headerTextColor, setHeaderTextColor] = useState<string>('#FFFFFF');
  const [subheadDateTextColor, setSubheadDateTextColor] = useState<string>('#2D5A43');
  const [studentNameTextColor, setStudentNameTextColor] = useState<string>('#1C1917');
  const [closingDuaTextColor, setClosingDuaTextColor] = useState<string>('#2D5A43');
  const [signatureTextColor, setSignatureTextColor] = useState<string>('#1C1917');

  const [boardFontFamily, setBoardFontFamily] = useState<'Thmanyah Sans' | 'Cairo' | 'Tajawal' | 'Amiri' | 'Readex Pro'>('Thmanyah Sans');
  const [boardFontScale, setBoardFontScale] = useState<number>(1);
  const [boardLogoUrl, setBoardLogoUrl] = useState<string>(() => {
    try {
      return localStorage.getItem('ghaith_honors_custom_logo_v1') || settings?.logoUrl || '';
    } catch {
      return settings?.logoUrl || '';
    }
  });
  const [boardLogoSize, setBoardLogoSize] = useState<number>(68);
  const [boardCustomBgUrl, setBoardCustomBgUrl] = useState<string>(() => {
    try {
      return localStorage.getItem('ghaith_honors_custom_bg_v1') || '';
    } catch {
      return '';
    }
  });
  const [showOuterBorder, setShowOuterBorder] = useState<boolean>(true);
  const [showHeaderBox, setShowHeaderBox] = useState<boolean>(true);
  const [headerWidthPercent, setHeaderWidthPercent] = useState<number>(85);
  const [headerPaddingY, setHeaderPaddingY] = useState<number>(12);
  const [canvasExtraHeight, setCanvasExtraHeight] = useState<number>(0);

  // Refs for active drag/resize cleanup & ObjectURL memory management
  const activeDragCleanupRef = useRef<(() => void) | null>(null);
  const bgObjectUrlRef = useRef<string | null>(null);
  const logoObjectUrlRef = useRef<string | null>(null);

  // Strictly clean up any active window drag listeners and ObjectURLs on unmount
  useEffect(() => {
    return () => {
      if (activeDragCleanupRef.current) {
        activeDragCleanupRef.current();
        activeDragCleanupRef.current = null;
      }
      if (bgObjectUrlRef.current) {
        URL.revokeObjectURL(bgObjectUrlRef.current);
        bgObjectUrlRef.current = null;
      }
      if (logoObjectUrlRef.current) {
        URL.revokeObjectURL(logoObjectUrlRef.current);
        logoObjectUrlRef.current = null;
      }
    };
  }, []);

  // Freehand Drag-and-Drop State for all 7 Primary Canvas Elements
  type CanvasElementKey = 'logo' | 'banner' | 'badge' | 'students' | 'dua' | 'teacherSig' | 'leaderSig';
  interface CanvasElementTransform {
    x: number;
    y: number;
    scale: number;
  }

  const DEFAULT_ELEMENT_TRANSFORMS: Record<CanvasElementKey, CanvasElementTransform> = {
    logo: { x: 0, y: 0, scale: 1 },
    banner: { x: 0, y: 0, scale: 1 },
    badge: { x: 0, y: 0, scale: 1 },
    students: { x: 0, y: 0, scale: 1 },
    dua: { x: 0, y: 0, scale: 1 },
    teacherSig: { x: 0, y: 0, scale: 1 },
    leaderSig: { x: 0, y: 0, scale: 1 }
  };

  const [elementTransforms, setElementTransforms] = useState<Record<CanvasElementKey, CanvasElementTransform>>(
    DEFAULT_ELEMENT_TRANSFORMS
  );
  const [selectedCanvasElement, setSelectedCanvasElement] = useState<CanvasElementKey | null>(null);
  const [draggingElement, setDraggingElement] = useState<CanvasElementKey | null>(null);

  const [showBgColorMenu, setShowBgColorMenu] = useState<boolean>(false);
  const [showTextColorMenu, setShowTextColorMenu] = useState<boolean>(false);
  const [showLayoutSliders, setShowLayoutSliders] = useState<boolean>(false);

  const BG_COLOR_PRESETS = [
    { label: 'بيج ملكي', color: '#FAF4E8' },
    { label: 'أوف وايت', color: '#FDFBF7' },
    { label: 'وردي باستيل', color: '#FDF2F5' },
    { label: 'أخضر باستيل', color: '#EFF7F3' },
    { label: 'سماوي هادئ', color: '#F0F6FA' },
    { label: 'زمردي داكن', color: '#1B3B2B' },
    { label: 'كحلي ملكي', color: '#17253B' }
  ];

  const TEXT_COLOR_SWATCHES = [
    { label: 'ذهبي', color: '#B8860B', headerText: '#FFF8DC' },
    { label: 'كحلي', color: '#1E3A5F', headerText: '#FFFFFF' },
    { label: 'زيتي', color: '#2D5A43', headerText: '#FFFFFF' },
    { label: 'عنابي', color: '#7A283B', headerText: '#FFF5F7' },
    { label: 'أسود ملكي', color: '#141413', headerText: '#FFFFFF' }
  ];

  const updateElementScale = (key: CanvasElementKey, delta: number) => {
    setElementTransforms(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        scale: Math.max(0.55, Math.min(1.85, Number((prev[key].scale + delta).toFixed(2))))
      }
    }));
  };

  const resetAllElementTransforms = () => {
    setElementTransforms(DEFAULT_ELEMENT_TRANSFORMS);
    setCanvasExtraHeight(0);
    setSelectedCanvasElement(null);
  };

  // Optimized Pointer / Touch Freehand Drag Handler:
  // Uses requestAnimationFrame + direct DOM CSS translate3d during drag,
  // and commits final (x, y) to React state ONLY ONCE on mouseup / touchend.
  const handleStartDragElement = (
    key: CanvasElementKey,
    e: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>
  ) => {
    const targetEl = e.target as HTMLElement;
    if (targetEl.closest('[data-no-drag="true"]')) {
      return;
    }

    // Ensure any previous drag listeners are cleaned up before starting a new drag
    if (activeDragCleanupRef.current) {
      activeDragCleanupRef.current();
      activeDragCleanupRef.current = null;
    }

    const containerEl = e.currentTarget as HTMLElement;
    const isTouch = 'touches' in e;
    const startClientX = isTouch ? e.touches[0].clientX : e.clientX;
    const startClientY = isTouch ? e.touches[0].clientY : e.clientY;
    const initialTransform = elementTransforms[key] || { x: 0, y: 0, scale: 1 };

    setSelectedCanvasElement(key);
    let hasMoved = false;
    let latestDx = 0;
    let latestDy = 0;
    let rafId: number | null = null;

    const applyDomPreview = () => {
      rafId = null;
      if (!containerEl) return;
      containerEl.style.willChange = 'transform';
      containerEl.style.transform = `translate3d(calc(-50% + ${Math.round(latestDx)}px), ${Math.round(latestDy)}px, 0) scale(${initialTransform.scale})`;
    };

    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      const curX = 'touches' in moveEvent ? moveEvent.touches[0]?.clientX ?? startClientX : moveEvent.clientX;
      const curY = 'touches' in moveEvent ? moveEvent.touches[0]?.clientY ?? startClientY : moveEvent.clientY;
      const dx = curX - startClientX;
      const dy = curY - startClientY;

      if (!hasMoved && Math.hypot(dx, dy) > 4) {
        hasMoved = true;
        setDraggingElement(key);
        if (document.activeElement instanceof HTMLElement && document.activeElement.isContentEditable) {
          document.activeElement.blur();
        }
      }

      if (hasMoved) {
        if (moveEvent.cancelable) {
          moveEvent.preventDefault();
        }
        latestDx = dx;
        latestDy = dy;
        if (rafId === null) {
          rafId = window.requestAnimationFrame(applyDomPreview);
        }
      }
    };

    const cleanupListeners = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
      window.removeEventListener('touchcancel', handleUp);
    };

    const handleUp = () => {
      cleanupListeners();
      activeDragCleanupRef.current = null;

      if (containerEl) {
        containerEl.style.willChange = 'auto';
        containerEl.style.transform = `translateX(-50%) scale(${initialTransform.scale})`;
      }

      setDraggingElement(null);

      if (hasMoved) {
        const finalX = Math.round(initialTransform.x + latestDx);
        const finalY = Math.round(initialTransform.y + latestDy);
        setElementTransforms(prev => ({
          ...prev,
          [key]: {
            ...prev[key],
            x: finalX,
            y: finalY
          }
        }));
      }
    };

    activeDragCleanupRef.current = cleanupListeners;
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleUp);
    window.addEventListener('touchcancel', handleUp);
  };

  // Optimized Corner Resize Handle Drag:
  // Uses requestAnimationFrame + direct DOM CSS scale during drag, commits once on mouseup / touchend.
  const handleStartResizeElement = (
    key: CanvasElementKey,
    e: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>
  ) => {
    e.stopPropagation();

    if (activeDragCleanupRef.current) {
      activeDragCleanupRef.current();
      activeDragCleanupRef.current = null;
    }

    const handleEl = e.currentTarget as HTMLElement;
    const containerEl = handleEl.parentElement as HTMLElement | null;
    const isTouch = 'touches' in e;
    const startClientY = isTouch ? e.touches[0].clientY : e.clientY;
    const initialScale = elementTransforms[key]?.scale || 1;
    let latestScale = initialScale;
    let hasResized = false;
    let rafId: number | null = null;

    setSelectedCanvasElement(key);

    const applyResizePreview = () => {
      rafId = null;
      if (!containerEl) return;
      containerEl.style.willChange = 'transform';
      containerEl.style.transform = `translate3d(-50%, 0, 0) scale(${latestScale})`;
    };

    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      if (moveEvent.cancelable) moveEvent.preventDefault();
      const curY = 'touches' in moveEvent ? moveEvent.touches[0]?.clientY ?? startClientY : moveEvent.clientY;
      const dy = curY - startClientY;
      hasResized = true;
      latestScale = Math.max(0.55, Math.min(1.85, Number((initialScale + dy * 0.005).toFixed(2))));
      if (rafId === null) {
        rafId = window.requestAnimationFrame(applyResizePreview);
      }
    };

    const cleanupListeners = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
      window.removeEventListener('touchcancel', handleUp);
    };

    const handleUp = () => {
      cleanupListeners();
      activeDragCleanupRef.current = null;

      if (containerEl) {
        containerEl.style.willChange = 'auto';
        containerEl.style.transform = `translateX(-50%) scale(${latestScale})`;
      }

      if (hasResized) {
        setElementTransforms(prev => ({
          ...prev,
          [key]: {
            ...prev[key],
            scale: latestScale
          }
        }));
      }
    };

    activeDragCleanupRef.current = cleanupListeners;
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleUp);
    window.addEventListener('touchcancel', handleUp);
  };

  // Editable Student List & Cumulative Stars inside the Studio
  const [boardStudentItems, setBoardStudentItems] = useState<HonorsBoardStudentItem[]>([]);
  const lastSyncedHonorSignatureRef = useRef<string>('');

  // Compute deterministic auto-list & primitive string signature to prevent infinite useEffect loops
  const autoHonorItems = React.useMemo<HonorsBoardStudentItem[]>(() => {
    return weeklyHonorStudents.map(st => ({
      id: st.id,
      name: st.name,
      stars: getStudentCumulativeMonthStars(st.id)
    }));
  }, [weeklyHonorStudents, selectedHijriParts.weekOfMonth, selectedDate, attendanceRecords, dailyRecords]);

  const autoHonorSignature = React.useMemo(
    () => autoHonorItems.map(item => `${item.id}:${item.name}:${item.stars}`).join('|'),
    [autoHonorItems]
  );

  // Manual reset callback for the "استعادة التلقائي" button
  const resetStudioStudentsFromAuto = React.useCallback(() => {
    lastSyncedHonorSignatureRef.current = autoHonorSignature;
    setBoardStudentItems(autoHonorItems);
  }, [autoHonorItems, autoHonorSignature]);

  useEffect(() => {
    const nextBadge = `${activeCircle?.name || 'الحلقة'} • ${activeTrack?.name || 'مسار الحفظ والتمكين'}`;
    const nextTeacher = `أ. ${activeCircle?.teacherName || 'معلمة الحلقة'}`;
    setBoardTrackCircleBadge(prev => (prev === nextBadge ? prev : nextBadge));
    setBoardTeacherName(prev => (prev === nextTeacher ? prev : nextTeacher));
  }, [activeCircle?.id, activeCircle?.name, activeCircle?.teacherName, activeTrack?.name]);

  useEffect(() => {
    setBoardWeekDateLabel(prev => (prev === hijriWeekHeader ? prev : hijriWeekHeader));
  }, [hijriWeekHeader]);

  useEffect(() => {
    if (lastSyncedHonorSignatureRef.current !== autoHonorSignature) {
      lastSyncedHonorSignatureRef.current = autoHonorSignature;
      setBoardStudentItems(autoHonorItems);
    }
  }, [autoHonorSignature, autoHonorItems]);

  const handleSetStudentStars = (id: string, starsCount: number) => {
    setBoardStudentItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, stars: Math.max(1, Math.min(6, starsCount)) } : item
      )
    );
  };

  const handleSetAllStudentsStars = (starsCount: number) => {
    setBoardStudentItems(prev =>
      prev.map(item => ({ ...item, stars: Math.max(1, Math.min(4, starsCount)) }))
    );
  };

  const handleAddBoardStudent = () => {
    const defaultStars = Math.min(4, Math.max(1, selectedHijriParts.weekOfMonth || 1));
    const newId = `custom-honor-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setBoardStudentItems(prev => [
      ...prev,
      {
        id: newId,
        name: 'اسم الطالبة المتألقة',
        stars: defaultStars
      }
    ]);
  };

  const handleRemoveBoardStudent = (id: string) => {
    setBoardStudentItems(prev => prev.filter(item => item.id !== id));
  };

  const handleUpdateBoardStudentName = (id: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setBoardStudentItems(prev =>
      prev.map(item => (item.id === id ? { ...item, name: trimmed } : item))
    );
  };

  // Offscreen Canvas Image Downscaler (max 1920x1080 at 0.75 quality) to protect localStorage 5MB quota
  const downscaleImageUrlForStorage = (
    srcUrl: string,
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 0.75,
    preservePngAlpha = false
  ): Promise<string> => {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        try {
          let targetW = img.naturalWidth || img.width || maxWidth;
          let targetH = img.naturalHeight || img.height || maxHeight;
          if (targetW > maxWidth || targetH > maxHeight) {
            const ratio = Math.min(maxWidth / targetW, maxHeight / targetH);
            targetW = Math.max(1, Math.round(targetW * ratio));
            targetH = Math.max(1, Math.round(targetH * ratio));
          }
          const offCanvas = document.createElement('canvas');
          offCanvas.width = targetW;
          offCanvas.height = targetH;
          const ctx = offCanvas.getContext('2d');
          if (!ctx) {
            resolve('');
            return;
          }
          ctx.drawImage(img, 0, 0, targetW, targetH);
          const mime = preservePngAlpha ? 'image/png' : 'image/jpeg';
          const compressedDataUrl = offCanvas.toDataURL(mime, quality);
          resolve(compressedDataUrl);
        } catch {
          resolve('');
        }
      };
      img.onerror = () => resolve('');
      img.src = srcUrl;
    });
  };

  const handleUploadLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    // 1. Instant zero-lag preview via URL.createObjectURL
    if (logoObjectUrlRef.current) {
      URL.revokeObjectURL(logoObjectUrlRef.current);
    }
    const objectUrl = URL.createObjectURL(file);
    logoObjectUrlRef.current = objectUrl;
    setBoardLogoUrl(objectUrl);
    showToast?.('تم رفع شعار المقرأة وإضافته أعلى اللوحة فوراً 🖼️');

    // 2. Asynchronous offscreen downscale (max 512x512) for safe localStorage persistence
    downscaleImageUrlForStorage(objectUrl, 512, 512, 0.8, true).then(compressed => {
      if (compressed) {
        try {
          localStorage.setItem('ghaith_honors_custom_logo_v1', compressed);
        } catch {
          // Ignore quota errors silently — objectUrl preview remains active in memory
        }
      }
    });
  };

  const handleUploadBackground = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    // 1. Instant zero-lag preview via URL.createObjectURL (no 10MB+ raw base64 in React state)
    if (bgObjectUrlRef.current) {
      URL.revokeObjectURL(bgObjectUrlRef.current);
    }
    const objectUrl = URL.createObjectURL(file);
    bgObjectUrlRef.current = objectUrl;
    setBoardCustomBgUrl(objectUrl);
    showToast?.('تم تطبيق الخلفية المخصصة بوضوح كامل ١٠٠٪ وبدون أي بطء 🌄');

    // 2. Asynchronous offscreen canvas downscaler (max 1920x1080 at 0.75 JPEG quality) for localStorage
    downscaleImageUrlForStorage(objectUrl, 1920, 1080, 0.75, false).then(compressed => {
      if (compressed) {
        try {
          localStorage.setItem('ghaith_honors_custom_bg_v1', compressed);
        } catch {
          // Ignore quota errors silently — objectUrl preview remains active in memory
        }
      }
    });
  };

  // Get or compute record for a student on selectedDate (including passive real-time derivation if not yet persisted)
  const getRecord = (studentId: string): Partial<AttendanceRecord> & { syncSource?: string } => {
    const existing = attendanceRecords.find(a => a.studentId === studentId && a.date === selectedDate);

    // If teacher manually deleted/cleared this day's attendance, do NOT auto-repopulate from recitation/challenges
    if (existing?.isManuallyCleared) {
      return {
        ...existing,
        studentId,
        circleId: activeCircle?.id || existing.circleId || '',
        date: selectedDate,
        status: 'unrecorded',
        earlyPrepCardSent: false,
        syncSource: ''
      };
    }

    const hasDailyRecitation = dailyRecords.some(
      r => r.studentId === studentId && r.date === selectedDate && (r.status === 'completed' || (r.recitationScore ?? 0) > 0)
    );
    const hasChallengeActivity = studentChallengeSubmissions.some(
      sub => sub.studentId === studentId && (
        (sub.evaluatedAt || sub.updatedAt || '').startsWith(selectedDate) ||
        (isSelectedDateThursday && ((sub.earlyPrepPointsEarned ?? 0) > 0 || !!sub.earlyAchievementCompleted || !!sub.peerReviewEvaluation?.jointRevisionCompleted))
      )
    );
    const hasChallengeEarlyBonus = studentChallengeSubmissions.some(
      sub => sub.studentId === studentId && (
        (sub.evaluatedAt || sub.updatedAt || '').startsWith(selectedDate) || isSelectedDateThursday
      ) && ((sub.earlyPrepPointsEarned ?? 0) > 0 || !!sub.earlyAchievementCompleted)
    );

    let syncSource = existing?.recordedBy || '';
    if (isSelectedDateThursday && hasChallengeActivity) {
      syncSource = 'تلقائي • تحديات الخميس 🏆';
    } else if (hasDailyRecitation) {
      syncSource = 'تلقائي • سجل التسميع 📖';
    } else if (existing?.earlyPrepCardSent) {
      syncSource = 'تلقائي • التحضير المبكر ⚡';
    }

    if (existing) {
      return {
        ...existing,
        status: existing.status === 'unrecorded' && (hasDailyRecitation || hasChallengeActivity) ? 'present' : existing.status,
        earlyPrepCardSent: !!existing.earlyPrepCardSent,
        syncSource: syncSource || existing.recordedBy || 'متزامن تلقائياً'
      };
    }

    if (hasDailyRecitation || hasChallengeActivity) {
      return {
        studentId,
        circleId: activeCircle?.id || '',
        date: selectedDate,
        status: 'present',
        earlyPrepCardSent: hasChallengeEarlyBonus,
        syncSource
      };
    }

    return {
      studentId,
      circleId: activeCircle?.id || '',
      date: selectedDate,
      status: 'unrecorded',
      earlyPrepCardSent: false,
      syncSource: ''
    };
  };

  const handleUpdateStatus = async (studentId: string, status: 'present' | 'absent_unexcused' | 'absent_excused') => {
    const rec = getRecord(studentId);
    await saveAttendance({
      ...rec,
      studentId,
      circleId: activeCircle?.id || rec.circleId || '',
      date: selectedDate,
      status,
      earlyPrepCardSent: status === 'present' ? !!rec.earlyPrepCardSent : false,
      isManuallyCleared: false,
      reason: status === 'absent_excused' ? (reasonInputs[studentId] || rec.reason || '') : undefined
    });
  };

  const handleToggleEarlyPrep = async (studentId: string) => {
    const rec = getRecord(studentId);
    const nextEarly = !rec.earlyPrepCardSent;
    const nextStatus = nextEarly
      ? 'present'
      : (rec.status && rec.status !== 'unrecorded' ? rec.status : 'present');
    await saveAttendance({
      ...rec,
      studentId,
      circleId: activeCircle?.id || rec.circleId || '',
      date: selectedDate,
      status: nextStatus,
      earlyPrepCardSent: nextEarly,
      isManuallyCleared: false
    });
    showToast?.(
      nextEarly
        ? 'تم تفعيل التحضير المبكر ⚡ وإضافته لرصيد الطالبة'
        : 'تم إلغاء التحضير المبكر لهذا اليوم وخصمه من العداد الشهري'
    );
  };

  const handleClearStudentAttendance = async (studentId: string, studentName: string) => {
    await clearStudentDayAttendance(studentId, selectedDate);
    setReasonInputs(prev => {
      const next = { ...prev };
      delete next[studentId];
      return next;
    });
    showToast?.(`تم مسح سجل الحضور والتحضير المبكر للطالبة «${studentName}» وتحديث الإحصائية فوراً 🗑️`);
  };

  const handleBulkPresent = async () => {
    const updates = circleStudents.map(st => {
      const rec = getRecord(st.id);
      return {
        ...rec,
        studentId: st.id,
        circleId: activeCircle?.id || st.circleId || '',
        date: selectedDate,
        status: 'present' as const,
        isManuallyCleared: false
      };
    });
    await saveBulkAttendance(updates);
  };

  const handleBulkEarlyPrep = async () => {
    const updates = circleStudents.map(st => {
      const rec = getRecord(st.id);
      return {
        ...rec,
        studentId: st.id,
        circleId: activeCircle?.id || st.circleId || '',
        date: selectedDate,
        status: 'present' as const,
        earlyPrepCardSent: true,
        isManuallyCleared: false
      };
    });
    await saveBulkAttendance(updates);
  };

  const loadImageElement = (src: string): Promise<HTMLImageElement | null> => {
    return new Promise(resolve => {
      if (!src) {
        resolve(null);
        return;
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  };

  // Compute dynamic base Y positions & total canvas height for the Freehand Drag-and-Drop Canvas
  const hasLogoOnBoard = Boolean(boardLogoUrl);
  const studentRowsCount = Math.max(1, Math.ceil(boardStudentItems.length / 3));
  const baseLogoTop = 20;
  const baseBannerTop = hasLogoOnBoard ? 98 : 26;
  const baseBadgeTop = hasLogoOnBoard ? 196 : 124;
  const baseStudentsTop = hasLogoOnBoard ? 286 : 214;
  const studentsBlockHeight = Math.max(66, studentRowsCount * 62);
  const baseDuaTop = baseStudentsTop + studentsBlockHeight + 24;
  const baseSigTop = baseDuaTop + 42;
  const computedCanvasHeight = Math.max(480, baseSigTop + 82 + canvasExtraHeight);

  // High-resolution Canvas fallback generator (1080px Retina) respecting all Freehand Drag-and-Drop coordinates
  const generateHonorsBoardCanvasDataUrl = async (): Promise<string> => {
    const width = 1080;
    const ratio = 1.85;
    const height = Math.round(computedCanvasHeight * ratio);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const scale = boardFontScale;
    const fontName = boardFontFamily;

    // 1. Solid Background Color + Optional Custom Image + Optional Tint Overlay
    ctx.fillStyle = boardBgColor;
    ctx.fillRect(0, 0, width, height);

    const bgImg = await loadImageElement(boardCustomBgUrl);
    if (bgImg) {
      ctx.drawImage(bgImg, 0, 0, width, height);
    }

    if (boardBgTintOpacity > 0) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, boardBgTintOpacity / 100));
      ctx.fillStyle = boardBgTintColor;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    // 2. Optional Outer Gold/Accent Frame
    if (showOuterBorder) {
      ctx.strokeStyle = boardAccentColor;
      ctx.lineWidth = 7;
      ctx.strokeRect(28, 28, width - 56, height - 56);
      ctx.strokeStyle = `${boardAccentColor}88`;
      ctx.lineWidth = 2;
      ctx.strokeRect(42, 42, width - 84, height - 84);
    }

    ctx.textAlign = 'center';
    ctx.direction = 'rtl';

    // 3. Free Logo
    const logoImg = await loadImageElement(boardLogoUrl);
    if (logoImg) {
      const t = elementTransforms.logo;
      const logoSize = Math.round(boardLogoSize * ratio * t.scale);
      const lx = width / 2 + t.x * ratio - logoSize / 2;
      const ly = (baseLogoTop + t.y) * ratio;
      ctx.drawImage(logoImg, lx, ly, logoSize, logoSize);
    }

    // 4. Top Banner / Rectangle
    {
      const t = elementTransforms.banner;
      const s = scale * t.scale;
      const centerX = width / 2 + t.x * ratio;
      const headerY = (baseBannerTop + t.y) * ratio;
      const bannerW = Math.round((width - 140) * (headerWidthPercent / 100) * t.scale);
      const bannerX = Math.round(centerX - bannerW / 2);
      const padY = Math.round(headerPaddingY * ratio * t.scale);
      const bannerH = Math.round(105 * t.scale + padY * 2);

      if (showHeaderBox) {
        ctx.fillStyle = boardHeaderBgColor;
        ctx.beginPath();
        ctx.roundRect(bannerX, headerY, bannerW, bannerH, 26);
        ctx.fill();
        ctx.strokeStyle = boardAccentColor;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.fillStyle = headerTextColor;
        ctx.font = `bold ${Math.round(23 * s)}px "${fontName}", sans-serif`;
        ctx.fillText(boardAcademyTitle, centerX, headerY + padY + 32 * t.scale);

        ctx.fillStyle = headerTextColor;
        ctx.font = `bold ${Math.round(42 * s)}px "${fontName}", serif`;
        ctx.fillText(boardMainTitle, centerX, headerY + padY + 86 * t.scale);
      } else {
        ctx.fillStyle = headerTextColor === '#FFFFFF' ? boardHeaderBgColor : headerTextColor;
        ctx.font = `bold ${Math.round(24 * s)}px "${fontName}", sans-serif`;
        ctx.fillText(boardAcademyTitle, centerX, headerY + 30);

        ctx.fillStyle = headerTextColor === '#FFFFFF' ? studentNameTextColor : headerTextColor;
        ctx.font = `bold ${Math.round(44 * s)}px "${fontName}", serif`;
        ctx.fillText(boardMainTitle, centerX, headerY + 86);
      }
    }

    // 5. Subtitle Badge & Description Block
    {
      const t = elementTransforms.badge;
      const s = scale * t.scale;
      const centerX = width / 2 + t.x * ratio;
      const badgeY = (baseBadgeTop + t.y) * ratio;

      ctx.fillStyle = subheadDateTextColor;
      ctx.font = `bold ${Math.round(23 * s)}px "${fontName}", sans-serif`;
      ctx.fillText(`${boardTrackCircleBadge}  •  ${boardWeekDateLabel}`, centerX, badgeY + 24);

      ctx.font = `bold ${Math.round(28 * s)}px "${fontName}", sans-serif`;
      ctx.fillText(boardSubtitle, centerX, badgeY + 68);

      ctx.font = `bold ${Math.round(20 * s)}px "${fontName}", sans-serif`;
      ctx.fillText(boardDescription, centerX, badgeY + 104);
    }

    // 6. Compact Student Name Cards Grid
    {
      const t = elementTransforms.students;
      const s = scale * t.scale;
      const cols = 3;
      const cardRowHeight = Math.round(94 * t.scale);
      const gridStartY = (baseStudentsTop + t.y) * ratio;
      const gridOffsetX = t.x * ratio;

      boardStudentItems.forEach((st, idx) => {
        const row = Math.floor(idx / cols);
        const colInRow = idx % cols;
        ctx.font = `bold ${Math.round(24 * s)}px "${fontName}", sans-serif`;
        const textWidth = ctx.measureText(st.name).width;
        const cardW = Math.max(210 * t.scale, Math.min(300 * t.scale, Math.round(textWidth + 62 * t.scale)));
        const cardH = Math.round(72 * t.scale);
        const slotW = (width - 150) / cols;
        const slotCenterX = width - 75 - slotW * colInRow - slotW / 2 + gridOffsetX;
        const x = Math.round(slotCenterX - cardW / 2);
        const y = gridStartY + row * cardRowHeight;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.strokeStyle = boardAccentColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x, y, cardW, cardH, 16);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = studentNameTextColor;
        ctx.font = `bold ${Math.round(24 * s)}px "${fontName}", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(st.name, x + cardW / 2, y + Math.round(31 * t.scale));

        const starsStr = Array.from({ length: st.stars }, () => '🌟').join('');
        ctx.font = `bold ${Math.round(19 * s)}px sans-serif`;
        ctx.fillText(starsStr, x + cardW / 2, y + Math.round(58 * t.scale));
      });
    }

    // 7. Closing Dua Quote
    {
      const t = elementTransforms.dua;
      const s = scale * t.scale;
      const duaX = width / 2 + t.x * ratio;
      const duaY = (baseDuaTop + t.y) * ratio + 24;
      ctx.textAlign = 'center';
      ctx.fillStyle = closingDuaTextColor;
      ctx.font = `bold ${Math.round(26 * s)}px "${fontName}", serif`;
      ctx.fillText(boardClosingDua, duaX, duaY);
    }

    // 8. Teacher Signature Block (Right Side, Internally Centered)
    {
      const t = elementTransforms.teacherSig;
      const s = scale * t.scale;
      const sigX = width * 0.76 + t.x * ratio;
      const sigY = (baseSigTop + t.y) * ratio + 22;
      ctx.textAlign = 'center';
      ctx.fillStyle = signatureTextColor;
      ctx.font = `bold ${Math.round(21 * s)}px "${fontName}", sans-serif`;
      ctx.fillText(boardTeacherLabel, sigX, sigY);
      ctx.font = `bold ${Math.round(25 * s)}px "${fontName}", sans-serif`;
      ctx.fillText(boardTeacherName, sigX, sigY + Math.round(34 * t.scale));
    }

    // 9. Leader Signature Block (Left Side, Internally Centered)
    {
      const t = elementTransforms.leaderSig;
      const s = scale * t.scale;
      const sigX = width * 0.24 + t.x * ratio;
      const sigY = (baseSigTop + t.y) * ratio + 22;
      ctx.textAlign = 'center';
      ctx.fillStyle = signatureTextColor;
      ctx.font = `bold ${Math.round(21 * s)}px "${fontName}", sans-serif`;
      ctx.fillText(boardLeaderLabel, sigX, sigY);
      ctx.font = `bold ${Math.round(25 * s)}px "${fontName}", sans-serif`;
      ctx.fillText(boardLeaderName, sigX, sigY + Math.round(34 * t.scale));
    }

    return canvas.toDataURL('image/png');
  };

  const handleDownloadHonorsPng = async () => {
    if (isExportingPng) return;
    setSelectedCanvasElement(null);
    setIsExportingPng(true);
    try {
      let dataUrl = '';
      if (honorsBoardRef.current) {
        try {
          dataUrl = await toPng(honorsBoardRef.current, {
            pixelRatio: 3,
            cacheBust: true,
            backgroundColor: boardBgColor,
            filter: (node: Node) => {
              if (node instanceof HTMLElement && node.dataset?.exportIgnore === 'true') {
                return false;
              }
              return true;
            }
          });
        } catch {
          dataUrl = await generateHonorsBoardCanvasDataUrl();
        }
      } else {
        dataUrl = await generateHonorsBoardCanvasDataUrl();
      }

      if (!dataUrl) {
        dataUrl = await generateHonorsBoardCanvasDataUrl();
      }

      const link = document.createElement('a');
      const safeCircleName = (activeCircle?.name || 'الحلقة').replace(/\s+/g, '-');
      link.download = `لوحة-شرف-متألقات-الأسبوع-${safeCircleName}-${selectedDate}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast?.('تم حفظ وتحميل لوحة شرف متألقات الأسبوع بدقة Retina عالية للواتساب 📸');
    } catch {
      showToast?.('حدث خطأ أثناء تصدير الصورة، يرجى المحاولة مرة أخرى', 'error');
    } finally {
      setIsExportingPng(false);
    }
  };

  // Stats for the day in this circle
  const dayRecords = circleStudents.map(s => getRecord(s.id));
  const presentCount = dayRecords.filter(r => r.status === 'present').length;
  const unexcusedCount = dayRecords.filter(r => r.status === 'absent_unexcused').length;
  const excusedCount = dayRecords.filter(r => r.status === 'absent_excused').length;
  const earlyPrepCount = dayRecords.filter(r => r.earlyPrepCardSent).length;
  const absentTotalCount = unexcusedCount + excusedCount;
  const weeklyStarQualifiedCount = weeklyHonorStudents.length;

  const filteredStudents = circleStudents.filter(st => {
    const rec = getRecord(st.id);
    if (statusFilter === 'present') return rec.status === 'present';
    if (statusFilter === 'early_prep') return !!rec.earlyPrepCardSent;
    if (statusFilter === 'absent') return rec.status === 'absent_unexcused' || rec.status === 'absent_excused';
    return true;
  });

  return (
    <div className="space-y-6">

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-[#E8DFD8] shadow-2xs">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <ClipboardCheck className="w-5 h-5 text-[#9A5643]" />
            <h2 className="text-xl font-bold text-stone-900 font-quran">لوحة متابعة الحضور والتحضير المبكر التلقائي</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold inline-flex items-center gap-1">
              <Zap className="w-3 h-3 text-[#9A5643]" />
              <span>مزامنة فورية بالخلفية</span>
            </span>
          </div>
          <p className="text-xs text-stone-500 flex flex-wrap items-center gap-1">
            <span>مرآة تلقائية تعرض الحضور والتحضير المبكر ونجمة الالتزام الأسبوعي</span>
            <Star className="w-3.5 h-3.5 text-[#9A5643] inline" />
            <span>(متألقات الأسبوع = صفر غياب) مع استوديو تصميم لوحة الشرف للواتساب</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowHonorsBoardModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
          >
            <Star className="w-3.5 h-3.5 fill-white text-white" />
            <span>لوحة متألقات الأسبوع (صورة للواتساب)</span>
            <span className="px-1.5 py-0.2 rounded-full bg-white/25 text-[10px]">{weeklyStarQualifiedCount}</span>
          </button>
          <button
            type="button"
            onClick={handleBulkPresent}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#EBF3EE] hover:bg-[#DCEADA] text-[#2D5A43] rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>اعتماد حضور الجميع</span>
          </button>
          <button
            type="button"
            onClick={handleBulkEarlyPrep}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#FAF6E8] hover:bg-[#F2ECD0] text-amber-900 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-[#9A5643]" />
            <span>تحضير مبكر للجميع</span>
          </button>
        </div>
      </div>

      {/* Circle & Date Bar */}
      <div className="bg-white p-4 rounded-3xl border border-[#E8DFD8] shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          
          {/* Circle Selector */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">الحلقة:</label>
            <select
              value={selectedCircleId}
              onChange={e => setSelectedCircleId(e.target.value)}
              className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-[#8E5364]"
            >
              {availableCircles.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} — أ. {c.teacherName} (حتى {c.earlyPrepCutoffTime} مبكر)
                </option>
              ))}
            </select>
          </div>

          {/* Hijri Date Selector & Navigation (السابق / اليوم / التالي) */}
          <div>
            <HijriDateNavigationBar
              label="تاريخ الجلسة (تقويم أم القرى):"
              selectedDate={selectedDate}
              onChangeDate={setSelectedDate}
            />
          </div>

          {/* Automation Mode Indicator */}
          <div className="p-2.5 rounded-xl bg-[#FCFAF8] border border-[#EFE8E2] text-xs flex flex-col justify-center">
            <span className="font-bold text-stone-700 flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-[#9A5643]" />
              <span>معيار متألقات الأسبوع ({hijriWeekHeader}):</span>
            </span>
            <span className="text-[11px] text-stone-500 block mt-0.5">
              تُؤهَّل الطالبة للقب «متألقة الأسبوع» تلقائياً بشرط واحد فقط: <strong className="text-emerald-700">صفر غياب (بعذر أو بدون عذر)</strong> طوال الأسبوع
            </span>
          </div>

        </div>

        {/* Interactive Filter & Metrics Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-stone-100">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-[#8E5364] text-white shadow-2xs'
                  : 'bg-[#FAF6F2] text-stone-600 hover:bg-stone-200/70'
              }`}
            >
              الكل ({circleStudents.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('present')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer inline-flex items-center gap-1 ${
                statusFilter === 'present'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>الحاضرات ({presentCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('early_prep')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer inline-flex items-center gap-1 ${
                statusFilter === 'early_prep'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200/60'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>التحضير المبكر ({earlyPrepCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('absent')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                statusFilter === 'absent'
                  ? 'bg-[#9A5643] text-white shadow-2xs'
                  : 'bg-[#FDF6F2] text-[#9A5643] hover:bg-[#F7E8DF] border border-[#E5C3B3]'
              }`}
            >
              الغياب والأعذار ({absentTotalCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('archived')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5 ${
                statusFilter === 'archived'
                  ? 'bg-[#7B3F30] text-white shadow-2xs'
                  : 'bg-[#F6EFEA] text-[#7B3F30] hover:bg-[#EDE0D6] border border-[#DFCEBF]'
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              <span>الأرشيف / المؤرشفات ({archivedCircleStudents.length})</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-stone-600">
            <span>حضور: <strong className="text-emerald-700">{presentCount}</strong></span>
            <span>•</span>
            <span>تحضير مبكر: <strong className="text-amber-700">{earlyPrepCount}</strong></span>
            <span>•</span>
            <span className="inline-flex items-center gap-1">
              <span>متألقات الأسبوع (0 غياب):</span>
              <Star className="w-3.5 h-3.5 text-[#9A5643]" />
              <strong className="text-amber-600">{weeklyStarQualifiedCount}</strong>
            </span>
            <span>•</span>
            <span>غياب بعذر: <strong className="text-amber-600">{excusedCount}</strong></span>
            <span>•</span>
            <span>دون عذر: <strong className="text-[#9A5643]">{unexcusedCount}</strong></span>
          </div>
        </div>
      </div>

      {/* Dedicated Archive Section ("قسم الطالبات المؤرشفات") when tab is active */}
      {statusFilter === 'archived' ? (
        <div className="bg-white rounded-3xl border border-[#DFCEBF] shadow-2xs p-5 sm:p-6 space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-stone-900 flex items-center gap-2 font-quran">
                <Archive className="w-5 h-5 text-[#9A5643]" />
                <span>قسم الطالبات المؤرشفات — حلقة {activeCircle?.name} ({archivedCircleStudents.length})</span>
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                الطالبات اللاتي تجاوزن حد الغياب بدون عذر (&gt; 3 أيام) أو تم نقلهن للأرشيف. مخفيات من جدول الحضور اليومي وشاشة التسميع ومخصومات من عداد الحلقة النشط، مع الاحتفاظ بـ 100% من سجلاتهن وملف الإنجاز.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className="px-3.5 py-2 rounded-xl bg-[#FAF6F2] hover:bg-[#EFEAE5] text-stone-700 text-xs font-bold border border-stone-200 transition cursor-pointer self-start sm:self-auto"
            >
              ← العودة لجدول الحضور النشط
            </button>
          </div>

          {archivedCircleStudents.length === 0 ? (
            <div className="p-8 text-center bg-[#FAF7F5] rounded-2xl border border-dashed border-[#DFCEBF] space-y-2">
              <div className="flex justify-center">
                <Archive className="w-8 h-8 text-[#9A5643]/60" />
              </div>
              <p className="text-sm font-bold text-stone-700">لا توجد طالبات مؤرشفات في هذه الحلقة حالياً</p>
              <p className="text-xs text-stone-500">
                عند تجاوز الطالبة 3 أيام غياب بدون عذر (&gt; 3 بدون عذر) يتم نقلها تلقائياً إلى هذا القسم مع حفظ كامل بياناتها.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {archivedCircleStudents.map((st, i) => {
                const stScore = allStudentScores[st.id];
                const stUnexcused = stScore?.absentUnexcusedCount ?? 0;
                return (
                  <div
                    key={st.id}
                    className="p-4 rounded-2xl bg-[#FCFAF8] border border-[#E6D7CC] flex flex-col justify-between gap-3 shadow-2xs"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-[#F6EFEA] text-[#7B3F30] text-xs font-bold flex items-center justify-center">
                            {i + 1}
                          </span>
                          <div>
                            <h4 className="font-bold text-stone-900 text-sm">
                              <span className="privacy-student-name">{st.name}</span>
                            </h4>
                            <span className="text-[11px] text-stone-400 font-mono">
                              كود: <span className="privacy-phone">{st.code}</span>
                            </span>
                          </div>
                        </div>

                        <span className="px-2.5 py-1 rounded-full bg-[#FDF6F2] text-[#9A5643] border border-[#E5C3B3] text-[11px] font-bold inline-flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-[#9A5643]" />
                          <span>تجاوزت حد الغياب (منقطعة)</span>
                        </span>
                      </div>

                      <div className="text-[11px] text-stone-600 bg-white px-3 py-2 rounded-xl border border-stone-100 flex flex-wrap items-center justify-between gap-2">
                        <span>
                          سبب الأرشفة: <strong className="text-[#9A5643]">{st.archivedReason || `تجاوزت حد الغياب (${stUnexcused} بدون عذر)`}</strong>
                        </span>
                        <span>
                          الحفظ المحفوظ: <strong className="text-[#2D5A43]">{stScore?.newMemorizationPagesDone ?? 0} ص</strong> • المعدل: <strong className="text-[#7B3F30]">{stScore?.finalPercentage ?? 100}%</strong>
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-stone-200/60">
                      <button
                        type="button"
                        onClick={() =>
                          triggerStudentTelegramAlert({
                            studentName: st.name,
                            circleName: activeCircle?.name || 'الحلقة القرآنية',
                            absenceCount: Math.max(4, stUnexcused || 4),
                            telegramUsername: st.telegramUsername,
                            showToast
                          })
                        }
                        className="w-full sm:w-auto px-3.5 py-2 bg-[#FDF6F2] hover:bg-[#9A5643] text-[#9A5643] hover:text-white border border-[#E5C3B3] rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>تنبيه تيليجرام</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => restoreStudent(st.id)}
                        className="w-full sm:w-auto px-4 py-2 bg-[#EBF3EE] hover:bg-[#DCEADA] text-[#2D5A43] border border-[#B8D8C5] rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>إلغاء الأرشفة واستعادة للحلقة</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <>

      {/* Attendance Content: Mobile Cards View (sm/md screens) & Desktop Table View (lg screens) */}
      
      {/* Mobile Card Layout for Phones & Tablets */}
      <div className="block lg:hidden space-y-3">
        {filteredStudents.map((student, idx) => {
          const rec = getRecord(student.id);
          const score = allStudentScores[student.id];
          const weeklyAbsences = getStudentWeeklyAbsences(student.id);
          const hasWeeklyStar = weeklyAbsences === 0;
          const hasActiveLog = rec.status !== 'unrecorded' || !!rec.earlyPrepCardSent;

          return (
            <div
              key={student.id}
              className="bg-white rounded-2xl border border-[#E8DFD8] p-4 shadow-2xs space-y-3"
            >
              {/* Header: Student Name, Code & Early Prep Button */}
              <div className="flex items-start justify-between gap-2 border-b border-stone-100 pb-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-stone-100 text-stone-500 text-[10px] flex items-center justify-center font-bold">
                      {idx + 1}
                    </span>
                    <h3 className="font-bold text-stone-900 text-sm">
                      <span className="privacy-student-name">{student.name}</span>
                    </h3>
                  </div>
                  <div className="text-[11px] text-stone-400 font-mono mt-0.5 mr-7">
                    كود: <span className="privacy-phone">{student.code}</span> • حضور: <strong className="text-[#2D5A43]"><span className="privacy-score-digit">{score?.attendanceRate ?? 100}</span>%</strong> • مبكر: <strong className="text-amber-700 privacy-score-digit">{score?.earlyPrepCount ?? 0}</strong>
                  </div>
                  {(score?.absentUnexcusedCount ?? 0) >= 3 && (
                    <div className="mt-1.5 mr-7 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FDF6F2] text-[#9A5643] border border-[#E5C3B3] text-[10px] font-bold">
                        <AlertTriangle className="w-3 h-3 text-[#9A5643]" />
                        <span>تجاوزت حد الغياب (منقطعة) ({score?.absentUnexcusedCount} بدون عذر)</span>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          triggerStudentTelegramAlert({
                            studentName: student.name,
                            circleName: activeCircle?.name || 'الحلقة القرآنية',
                            absenceCount: Math.max(4, score?.absentUnexcusedCount ?? 4),
                            telegramUsername: student.telegramUsername,
                            showToast
                          })
                        }
                        className="px-2.5 py-0.5 rounded-lg bg-[#FDF6F2] hover:bg-[#9A5643] text-[#9A5643] hover:text-white border border-[#E5C3B3] text-[10px] font-bold inline-flex items-center gap-1 transition cursor-pointer"
                      >
                        <Send className="w-3 h-3" />
                        <span>تنبيه تيليجرام</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => archiveStudent(student.id, `تجاوزت حد الغياب (${score?.absentUnexcusedCount ?? 4} بدون عذر) — منقطعة`)}
                        className="px-2.5 py-0.5 rounded-lg bg-[#7B3F30] hover:bg-[#613024] text-white text-[10px] font-bold transition cursor-pointer"
                      >
                        نقل إلى قسم المؤرشفات
                      </button>
                    </div>
                  )}
                  {rec.syncSource && rec.status === 'present' && (
                    <div className="mt-1 mr-7">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70 text-[10px] font-bold">
                        {rec.syncSource}
                      </span>
                    </div>
                  )}
                </div>

                {/* Mobile Early Prep & Delete Buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleToggleEarlyPrep(student.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition active:scale-95 cursor-pointer touch-manipulation ${
                      rec.earlyPrepCardSent
                        ? 'bg-emerald-600 text-white border border-emerald-700 shadow-2xs'
                        : 'bg-stone-100 text-stone-500 border border-stone-300 hover:bg-stone-200'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>تحضير مبكر</span>
                    {rec.earlyPrepCardSent && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleClearStudentAttendance(student.id, student.name)}
                    disabled={!hasActiveLog}
                    className={`p-2 rounded-xl transition border ${
                      hasActiveLog
                        ? 'text-[#9A5643] hover:text-white bg-[#FDF6F2] hover:bg-[#9A5643] border-[#E5C3B3] cursor-pointer'
                        : 'text-stone-300 bg-stone-50 border-stone-200 cursor-not-allowed'
                    }`}
                    title="مسح وإعادة ضبط حضور وتحضير الطالبة لهذا اليوم"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Mobile Weekly Star Badge Row */}
              <div className="flex items-center justify-between bg-[#FCFAF7] px-3 py-2 rounded-xl border border-amber-200/70">
                <span className="text-[11px] font-bold text-stone-700 inline-flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-[#9A5643]" />
                  <span>نجمة الالتزام الأسبوعي:</span>
                </span>
                {hasWeeklyStar ? (
                  <span className="px-3 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-sm ring-2 ring-amber-300/50">
                    <Star className="w-3 h-3 fill-white text-white" />
                    <span>متألقة الأسبوع</span>
                    <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded-full">0 غياب</span>
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1.5 bg-stone-100 text-stone-500 border border-stone-300">
                    <span>مستبعدة ({weeklyAbsences} غياب هذا الأسبوع)</span>
                  </span>
                )}
              </div>

              {/* Status Action Buttons (Touch-friendly 44px min height) */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleUpdateStatus(student.id, 'present')}
                  className={`py-2.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 active:scale-95 cursor-pointer touch-manipulation border ${
                    rec.status === 'present'
                      ? 'bg-[#2D5A43] text-white border-[#2D5A43] shadow-xs'
                      : 'bg-[#FAF6F2] hover:bg-[#EFEAE5] text-stone-700 border-stone-200'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>حاضرة</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleUpdateStatus(student.id, 'absent_excused')}
                  className={`py-2.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 active:scale-95 cursor-pointer touch-manipulation border ${
                    rec.status === 'absent_excused'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-[#FAF6F2] hover:bg-[#EFEAE5] text-stone-700 border-stone-200'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>بعذر</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleUpdateStatus(student.id, 'absent_unexcused')}
                  className={`py-2.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 active:scale-95 cursor-pointer touch-manipulation border ${
                    rec.status === 'absent_unexcused'
                      ? 'bg-[#9A5643] text-white border-[#9A5643] shadow-xs'
                      : 'bg-[#FAF6F2] hover:bg-[#EFEAE5] text-stone-700 border-stone-200'
                  }`}
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>بدون عذر</span>
                </button>
              </div>

              {/* Excused Reason Input on Mobile */}
              {rec.status === 'absent_excused' && (
                <div className="pt-1">
                  <input
                    type="text"
                    placeholder="اكتبي سبب العذر هنا..."
                    value={reasonInputs[student.id] !== undefined ? reasonInputs[student.id] : (rec.reason || '')}
                    onChange={e => setReasonInputs({ ...reasonInputs, [student.id]: e.target.value })}
                    onBlur={() => handleUpdateStatus(student.id, 'absent_excused')}
                    className="w-full px-3 py-2 text-xs border border-amber-300 rounded-xl bg-amber-50/50 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block bg-white rounded-3xl border border-[#E8DFD8] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-[#FAF6F2] text-stone-600 font-bold border-b border-stone-200">
                <th className="p-3.5">#</th>
                <th className="p-3.5">اسم الطالبة</th>
                <th className="p-3.5 text-center">
                  <span className="inline-flex items-center gap-1">
                    <span>التحضير المبكر</span>
                    <Zap className="w-3.5 h-3.5 text-[#9A5643]" />
                  </span>
                </th>
                <th className="p-3.5 text-center">
                  <span className="inline-flex items-center gap-1">
                    <span>نجمة الالتزام</span>
                    <Star className="w-3.5 h-3.5 text-[#9A5643]" />
                  </span>
                </th>
                <th className="p-3.5 text-center">حالة الحضور</th>
                <th className="p-3.5">مصدر المزامنة التلقائية</th>
                <th className="p-3.5">سبب الغياب (إن وُجد)</th>
                <th className="p-3.5">الإحصائية التراكمية</th>
                <th className="p-3.5 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredStudents.map((student, idx) => {
                const rec = getRecord(student.id);
                const score = allStudentScores[student.id];
                const weeklyAbsences = getStudentWeeklyAbsences(student.id);
                const hasWeeklyStar = weeklyAbsences === 0;
                const hasActiveLog = rec.status !== 'unrecorded' || !!rec.earlyPrepCardSent;

                return (
                  <tr key={student.id} className="hover:bg-[#FCF9FA] transition">
                    <td className="p-3.5 font-semibold text-stone-400">{idx + 1}</td>

                    <td className="p-3.5">
                      <div className="font-bold text-stone-900 text-sm flex flex-wrap items-center gap-1.5">
                        <span className="privacy-student-name">{student.name}</span>
                        {(score?.absentUnexcusedCount ?? 0) >= 3 && (
                          <span className="px-2.5 py-0.5 rounded-full bg-[#FDF6F2] text-[#9A5643] border border-[#E5C3B3] text-[10px] font-bold inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-[#9A5643]" />
                            <span>تجاوزت حد الغياب (منقطعة)</span>
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-stone-400 font-mono">
                        <span className="privacy-phone">{student.code}</span>
                      </div>
                      {(score?.absentUnexcusedCount ?? 0) >= 3 && (
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              triggerStudentTelegramAlert({
                                studentName: student.name,
                                circleName: activeCircle?.name || 'الحلقة القرآنية',
                                absenceCount: Math.max(4, score?.absentUnexcusedCount ?? 4),
                                telegramUsername: student.telegramUsername,
                                showToast
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-[#FDF6F2] hover:bg-[#9A5643] text-[#9A5643] hover:text-white border border-[#E5C3B3] text-[10px] font-bold inline-flex items-center gap-1 transition cursor-pointer shadow-2xs"
                          >
                            <Send className="w-3 h-3" />
                            <span>تنبيه تيليجرام</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => archiveStudent(student.id, `تجاوزت حد الغياب (${score?.absentUnexcusedCount ?? 4} بدون عذر) — منقطعة`)}
                            className="px-2.5 py-1 rounded-lg bg-[#7B3F30] hover:bg-[#613024] text-white text-[10px] font-bold inline-flex items-center gap-1 transition cursor-pointer shadow-2xs"
                          >
                            <Archive className="w-3 h-3" />
                            <span>نقل إلى قسم المؤرشفات</span>
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Early Prep 2-Way Toggle */}
                    <td className="p-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleEarlyPrep(student.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition active:scale-95 cursor-pointer touch-manipulation ${
                          rec.earlyPrepCardSent
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 shadow-2xs ring-2 ring-emerald-400/25'
                            : 'bg-stone-100 hover:bg-stone-200 text-stone-500 border border-stone-300'
                        }`}
                        title={rec.earlyPrepCardSent ? 'انقري لإلغاء التحضير المبكر وخصمه من العداد الشهري' : 'انقري لتفعيل التحضير المبكر وإضافته للعداد الشهري'}
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>تحضير مبكر</span>
                        {rec.earlyPrepCardSent && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </button>
                    </td>

                    {/* Weekly Commitment Star Column */}
                    <td className="p-3.5 text-center">
                      <div className="flex flex-col items-center gap-1">
                        {hasWeeklyStar ? (
                          <span
                            className={`px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${
                              isSelectedDateThursday
                                ? 'bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 text-white border border-amber-400 shadow-md ring-2 ring-amber-300/60'
                                : 'bg-amber-50 text-amber-900 border border-amber-300 shadow-2xs'
                            }`}
                          >
                            <Star className="w-3.5 h-3.5 text-[#9A5643]" />
                            <span>متألقة الأسبوع</span>
                            {isSelectedDateThursday && <span className="text-[10px] bg-white/25 px-1.5 py-0.2 rounded-full">تتويج</span>}
                          </span>
                        ) : (
                          <span className="px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 bg-stone-100 text-stone-400 border border-stone-200">
                            <span>غير مستحقة ({weeklyAbsences} غياب)</span>
                          </span>
                        )}
                        <span className="text-[10px] text-stone-400">
                          {hasWeeklyStar
                            ? '0 غياب (الأحد–الخميس)'
                            : 'تُمنح لمن لم تغب طوال الأسبوع'}
                        </span>
                      </div>
                    </td>

                    {/* Attendance Status Buttons */}
                    <td className="p-3.5 text-center">
                      <div className="inline-flex items-center gap-1.5 bg-[#FAF6F2] p-1 rounded-xl border border-[#EFE8E2]">
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(student.id, 'present')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 active:scale-95 cursor-pointer touch-manipulation ${
                            rec.status === 'present'
                              ? 'bg-[#2D5A43] text-white shadow-2xs'
                              : 'text-stone-600 hover:text-stone-900'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>حاضرة</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(student.id, 'absent_unexcused')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 active:scale-95 cursor-pointer touch-manipulation ${
                            rec.status === 'absent_unexcused'
                              ? 'bg-[#9A5643] text-white shadow-2xs'
                              : 'text-stone-600 hover:text-[#9A5643]'
                          }`}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>بدون عذر</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(student.id, 'absent_excused')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 active:scale-95 cursor-pointer touch-manipulation ${
                            rec.status === 'absent_excused'
                              ? 'bg-amber-600 text-white shadow-2xs'
                              : 'text-stone-600 hover:text-amber-700'
                          }`}
                        >
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>بعذر</span>
                        </button>
                      </div>
                    </td>

                    {/* Sync Source & Time */}
                    <td className="p-3.5">
                      {rec.status === 'present' ? (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/70 text-[11px] font-bold">
                            {rec.syncSource || 'سجل التسميع / الحضور'}
                          </span>
                          {rec.recordedAt && (
                            <div className="text-[10px] text-stone-400">
                              {formatHijriDateTime(rec.recordedAt)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-stone-300 text-[11px]">لم يُسجل حضور بعد</span>
                      )}
                    </td>

                    {/* Reason input for excused absence */}
                    <td className="p-3.5">
                      {rec.status === 'absent_excused' ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            placeholder="اكتبي سبب العذر..."
                            value={reasonInputs[student.id] !== undefined ? reasonInputs[student.id] : (rec.reason || '')}
                            onChange={e => setReasonInputs({ ...reasonInputs, [student.id]: e.target.value })}
                            onBlur={() => handleUpdateStatus(student.id, 'absent_excused')}
                            className="px-2.5 py-1 text-xs border border-amber-300 rounded-lg w-full bg-amber-50/50"
                          />
                        </div>
                      ) : (
                        <span className="text-stone-300 text-[11px]">—</span>
                      )}
                    </td>

                    {/* Cumulative Monthly Stats */}
                    <td className="p-3.5">
                      <div className="font-semibold text-stone-800">
                        حضور: <span className="text-[#2D5A43] font-bold privacy-score-digit">{score?.attendanceRate ?? 100}%</span>
                      </div>
                      <div className="text-[10px] text-stone-500">
                        غياب: <span className="privacy-score-digit font-bold text-[#9A5643]">{(score?.absentUnexcusedCount ?? 0) + (score?.absentExcusedCount ?? 0)}</span> ({score?.absentUnexcusedCount ?? 0} دون عذر) | مبكر: <span className="privacy-score-digit font-bold text-emerald-700">{score?.earlyPrepCount ?? 0}</span>
                      </div>
                      <div className="text-[10px] text-[#7B3F30] font-bold mt-0.5 inline-flex items-center gap-1">
                        <span>نجوم الشهر:</span>
                        <Star className="w-3 h-3 text-[#9A5643]" />
                        <span className="privacy-score-digit">{score?.weeklyStarsCount ?? 4}</span>/4
                      </div>
                    </td>

                    {/* Actions: Reset/Delete Day Attendance or Quick Archive */}
                    <td className="p-3.5 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleClearStudentAttendance(student.id, student.name)}
                          disabled={!hasActiveLog}
                          className={`p-2 rounded-xl transition inline-flex items-center justify-center border ${
                            hasActiveLog
                              ? 'text-[#9A5643] hover:text-white bg-[#FDF6F2] hover:bg-[#9A5643] border-[#E5C3B3] shadow-2xs cursor-pointer'
                              : 'text-stone-300 bg-stone-50 border-stone-100 cursor-not-allowed'
                          }`}
                          title="حذف وإعادة ضبط حالة الحضور والتحضير المبكر لهذا اليوم"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => archiveStudent(student.id, 'نقل يدوي إلى قسم المؤرشفات (منقطعة)')}
                          className="p-2 rounded-xl transition inline-flex items-center justify-center border text-[#7B3F30] hover:text-white bg-[#F6EFEA] hover:bg-[#7B3F30] border-[#DFCEBF] shadow-2xs cursor-pointer"
                          title="نقل إلى قسم المؤرشفات"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {/* ==========================================================================
          Weekly Honors Board Visual Studio Modal (محرر وتصميم لوحة الشرف التفاعلي)
         ========================================================================== */}
      {showHonorsBoardModal && (
        <ErrorBoundary fallbackTitle="حدث خطأ غير متوقع في عرض استوديو لوحة الشرف — اضغطي لإعادة التنشيط">
        <div
          className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-xs flex items-start sm:items-center justify-center p-2 sm:p-5 overflow-y-auto animate-in fade-in"
          dir="rtl"
        >
          {/* Hidden File Inputs for Logo & Custom Background */}
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            onChange={handleUploadLogo}
            className="hidden"
          />
          <input
            ref={bgInputRef}
            type="file"
            accept="image/*"
            onChange={handleUploadBackground}
            className="hidden"
          />

          <div className="w-full max-w-2xl my-auto space-y-3">
            {/* Studio Floating Control Toolbar (شريط أدوات التصميم والتحكم البصري) */}
            <div className="bg-white/95 backdrop-blur-md p-3.5 rounded-2xl border border-amber-200/80 shadow-xl space-y-2.5">
              {/* Top Row: Studio Title + Export PNG & Close */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-stone-100">
                <div className="flex items-center gap-2">
                  <span className="text-lg">✋</span>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-stone-900">
                      استوديو لوحة الشرف التفاعلي (سحب وإفلات حر ✋)
                    </h3>
                    <p className="text-[10px] text-stone-500">
                      اسحبي أي عنصر بالماوس أو اللمس لتحريكه بحرية في أي مكان • وانقري على أي نص لتعديله أو تكبيره
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleDownloadHonorsPng}
                    disabled={isExportingPng}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#2D5A43] to-emerald-700 hover:from-[#234735] hover:to-emerald-800 text-white text-xs font-bold shadow-md transition active:scale-95 cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>{isExportingPng ? 'جاري التصدير...' : '📸 حفظ ومشاركة كصورة PNG'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowHonorsBoardModal(false)}
                    className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 transition cursor-pointer"
                    title="إغلاق"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Second Row: Visual Controls (Background Color, Text Colors, Logo, Custom Bg, Border Toggle, Header Box Toggle, Font, A+/A-, Add Student) */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {/* [ 🎨 لون الخلفية ] */}
                <button
                  type="button"
                  onClick={() => {
                    setShowBgColorMenu(prev => !prev);
                    setShowTextColorMenu(false);
                  }}
                  className={`px-2.5 py-1.5 rounded-xl font-bold inline-flex items-center gap-1.5 border transition cursor-pointer ${
                    showBgColorMenu
                      ? 'bg-[#2D5A43] text-white border-[#2D5A43] shadow-2xs'
                      : 'bg-[#FAF6F2] hover:bg-emerald-50 text-stone-800 border-stone-200'
                  }`}
                >
                  <span
                    style={{ backgroundColor: boardBgColor }}
                    className="w-3.5 h-3.5 rounded-full border border-stone-400 inline-block"
                  />
                  <span>🎨 لون الخلفية</span>
                </button>

                {/* [ 🎨 ألوان النصوص ] */}
                <button
                  type="button"
                  onClick={() => {
                    setShowTextColorMenu(prev => !prev);
                    setShowBgColorMenu(false);
                  }}
                  className={`px-2.5 py-1.5 rounded-xl font-bold inline-flex items-center gap-1.5 border transition cursor-pointer ${
                    showTextColorMenu
                      ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                      : 'bg-[#FAF6F2] hover:bg-amber-50 text-stone-800 border-stone-200'
                  }`}
                >
                  <Palette className="w-3.5 h-3.5" />
                  <span>🎨 ألوان النصوص</span>
                </button>

                {/* [ إظهار / إخفاء المستطيل العلوي ] */}
                <button
                  type="button"
                  onClick={() => setShowHeaderBox(prev => !prev)}
                  className={`px-2.5 py-1.5 rounded-xl font-bold inline-flex items-center gap-1.5 border transition cursor-pointer ${
                    showHeaderBox
                      ? 'bg-[#EBF3EE] text-[#2D5A43] border-emerald-200'
                      : 'bg-stone-100 text-stone-600 border-stone-200'
                  }`}
                >
                  <span>{showHeaderBox ? '▭ إخفاء المستطيل العلوي' : '▭ إظهار المستطيل العلوي'}</span>
                </button>

                {/* [ 🔲 إظهار / إخفاء الإطار الخارجي ] */}
                <button
                  type="button"
                  onClick={() => setShowOuterBorder(prev => !prev)}
                  className={`px-2.5 py-1.5 rounded-xl font-bold inline-flex items-center gap-1.5 border transition cursor-pointer ${
                    showOuterBorder
                      ? 'bg-amber-50 text-amber-900 border-amber-200'
                      : 'bg-stone-100 text-stone-600 border-stone-200'
                  }`}
                >
                  <span>🔲 {showOuterBorder ? 'إخفاء الإطار الخارجي' : 'إظهار الإطار الخارجي'}</span>
                </button>

                {/* [ 🖼️ رفع شعار المقرأة ] */}
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="px-2.5 py-1.5 rounded-xl bg-[#FAF6F2] hover:bg-emerald-50 text-stone-700 hover:text-emerald-900 font-bold inline-flex items-center gap-1.5 border border-stone-200 transition cursor-pointer"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>🖼️ رفع شعار المقرأة</span>
                </button>

                {/* [ 🌄 رفع خلفية مخصصة ] */}
                <button
                  type="button"
                  onClick={() => bgInputRef.current?.click()}
                  className="px-2.5 py-1.5 rounded-xl bg-[#FAF6F2] hover:bg-amber-50 text-stone-700 hover:text-amber-900 font-bold inline-flex items-center gap-1.5 border border-stone-200 transition cursor-pointer"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>🌄 رفع خلفية مخصصة</span>
                </button>
                {boardCustomBgUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      if (bgObjectUrlRef.current) {
                        URL.revokeObjectURL(bgObjectUrlRef.current);
                        bgObjectUrlRef.current = null;
                      }
                      try {
                        localStorage.removeItem('ghaith_honors_custom_bg_v1');
                      } catch {
                        // ignore
                      }
                      setBoardCustomBgUrl('');
                    }}
                    className="px-2 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold cursor-pointer"
                    title="إلغاء الخلفية المخصصة"
                  >
                    إلغاء الخلفية ✕
                  </button>
                )}

                {/* [ 🔤 نوع الخط ] */}
                <div className="inline-flex items-center gap-1 bg-[#FAF6F2] px-2 py-1 rounded-xl border border-stone-200">
                  <Type className="w-3.5 h-3.5 text-stone-500" />
                  <select
                    value={boardFontFamily}
                    onChange={e => setBoardFontFamily(e.target.value as any)}
                    className="bg-transparent text-xs font-bold text-stone-800 focus:outline-hidden cursor-pointer"
                    title="نوع الخط العربي"
                  >
                    <option value="Thmanyah Sans">خط ثمانية (Thmanyah)</option>
                    <option value="Cairo">خط القاهرة (Cairo)</option>
                    <option value="Tajawal">خط تجوال (Tajawal)</option>
                    <option value="Amiri">خط أميري (Amiri)</option>
                    <option value="Readex Pro">خط Readex Pro</option>
                  </select>
                </div>

                {/* [ A+ / A- ] */}
                <div className="inline-flex items-center bg-[#FAF6F2] rounded-xl border border-stone-200 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setBoardFontScale(prev => Math.min(1.35, Number((prev + 0.06).toFixed(2))))}
                    className="px-2.5 py-1.5 hover:bg-stone-200/70 font-bold text-stone-800 cursor-pointer"
                    title="تكبير حجم النص العام"
                  >
                    A+
                  </button>
                  <span className="text-[10px] font-mono text-stone-500 px-1.5 border-x border-stone-200">
                    {Math.round(boardFontScale * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setBoardFontScale(prev => Math.max(0.8, Number((prev - 0.06).toFixed(2))))}
                    className="px-2.5 py-1.5 hover:bg-stone-200/70 font-bold text-stone-800 cursor-pointer"
                    title="تصغير حجم النص العام"
                  >
                    A-
                  </button>
                </div>

                {/* [ ➕ إضافة طالبة ] */}
                <button
                  type="button"
                  onClick={handleAddBoardStudent}
                  className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold inline-flex items-center gap-1 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>➕ إضافة طالبة</span>
                </button>

                {/* Quick Stars Preset for Month Week (1..4) */}
                <div className="inline-flex items-center gap-1 bg-amber-50/80 px-2 py-1 rounded-xl border border-amber-200">
                  <span className="text-[10px] font-bold text-amber-900">تراكم النجوم:</span>
                  {[1, 2, 3, 4].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => handleSetAllStudentsStars(n)}
                      className="px-1.5 py-0.5 rounded-lg bg-white hover:bg-amber-500 hover:text-white text-amber-900 border border-amber-200 text-[10px] font-bold transition cursor-pointer"
                      title={`تعيين ${n} نجوم لجميع الطالبات (الأسبوع ${n})`}
                    >
                      {n}🌟
                    </button>
                  ))}
                </div>

                {/* Toggle Dimensions Sliders Bar */}
                <button
                  type="button"
                  onClick={() => setShowLayoutSliders(prev => !prev)}
                  className="px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-[11px] transition cursor-pointer"
                >
                  {showLayoutSliders ? '📐 إخفاء أبعاد المستطيل والشعار' : '📐 أبعاد المستطيل والشعار'}
                </button>

                {/* Reset All Dragged Positions & Studio List */}
                <button
                  type="button"
                  onClick={() => {
                    resetStudioStudentsFromAuto();
                    resetAllElementTransforms();
                  }}
                  className="px-2 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-[11px] inline-flex items-center gap-1 transition cursor-pointer"
                  title="إعادة ضبط مواضع العناصر التلقائية"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>إعادة ضبط المواضع</span>
                </button>
              </div>

              {/* Dedicated [ 🎨 لون الخلفية ] Popover Menu (Solid Background Color + Image Tint Overlay & Opacity) */}
              {showBgColorMenu && (
                <div className="pt-2.5 border-t border-stone-100 bg-[#FCFAF8] p-3 rounded-xl space-y-3 animate-in fade-in text-[11px]">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-stone-200/70">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-stone-800">🎨 لون خلفية اللوحة الأساسي:</span>
                      <input
                        type="color"
                        value={boardBgColor}
                        onChange={e => setBoardBgColor(e.target.value)}
                        className="w-7 h-7 rounded-lg border border-stone-300 cursor-pointer"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {BG_COLOR_PRESETS.map(p => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => setBoardBgColor(p.color)}
                          style={{ backgroundColor: p.color }}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border shadow-2xs transition cursor-pointer ${
                            p.color === '#1B3B2B' || p.color === '#17253B'
                              ? 'text-white border-white/30'
                              : 'text-stone-800 border-stone-300'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Background Tint / Overlay Controls (Especially helpful over custom background images) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                    <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-stone-200">
                      <span className="font-bold text-stone-700">لون طبقة التظليل (Overlay Tint):</span>
                      <div className="flex items-center gap-1.5">
                        {['#FFFFFF', '#FAF4E8', '#1B3B2B', '#17253B', '#000000'].map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setBoardBgTintColor(c)}
                            style={{ backgroundColor: c }}
                            className="w-4 h-4 rounded-full border border-stone-300 cursor-pointer"
                            title={c}
                          />
                        ))}
                        <input
                          type="color"
                          value={boardBgTintColor}
                          onChange={e => setBoardBgTintColor(e.target.value)}
                          className="w-6 h-6 rounded-md border border-stone-300 cursor-pointer"
                        />
                      </div>
                    </div>

                    <label className="flex flex-col gap-1 font-bold text-stone-700 bg-white p-2 rounded-xl border border-stone-200">
                      <div className="flex justify-between">
                        <span>درجة شفافية التظليل فوق الخلفية:</span>
                        <span className="text-emerald-800 font-mono">{boardBgTintOpacity}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={boardBgTintOpacity}
                        onChange={e => setBoardBgTintOpacity(Number(e.target.value))}
                        className="accent-[#2D5A43] cursor-pointer"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Dedicated [ 🎨 ألوان النصوص ] Popover Menu */}
              {showTextColorMenu && (
                <div className="pt-2.5 border-t border-stone-100 bg-[#FCFAF8] p-3 rounded-xl space-y-3 animate-in fade-in">
                  {/* Top Strip: Quick Preset Swatches (ذهبي، كحلي، زيتي، عنابي، أسود ملكي) */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-stone-200/70">
                    <span className="text-[11px] font-bold text-stone-700">
                      🎨 قوالب ألوان النصوص الجاهزة:
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {TEXT_COLOR_SWATCHES.map(preset => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setHeaderTextColor(showHeaderBox ? preset.headerText : preset.color);
                            setSubheadDateTextColor(preset.color);
                            setStudentNameTextColor(preset.color);
                            setClosingDuaTextColor(preset.color);
                            setSignatureTextColor(preset.color);
                          }}
                          style={{ backgroundColor: preset.color }}
                          className="px-2.5 py-1 rounded-lg text-white text-[10px] font-bold shadow-2xs hover:opacity-90 transition cursor-pointer inline-flex items-center gap-1"
                        >
                          <span className="w-2 h-2 rounded-full bg-white/80 inline-block" />
                          <span>{preset.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 5 Individual Text Color Pickers + Swatch Dots */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-[11px]">
                    {/* 1. لون عنوان اللوحة والمستطيل */}
                    <div className="flex items-center justify-between gap-2 bg-white p-2 rounded-xl border border-stone-200">
                      <span className="font-bold text-stone-700">لون عنوان اللوحة والمستطيل:</span>
                      <div className="flex items-center gap-1">
                        {['#FFFFFF', '#F6D88C', '#B8860B', '#1E3A5F', '#2D5A43', '#7A283B', '#141413'].map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setHeaderTextColor(c)}
                            style={{ backgroundColor: c }}
                            className="w-3.5 h-3.5 rounded-full border border-stone-300 cursor-pointer"
                            title={c}
                          />
                        ))}
                        <input
                          type="color"
                          value={headerTextColor}
                          onChange={e => setHeaderTextColor(e.target.value)}
                          className="w-6 h-6 rounded-md border border-stone-300 cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* 2. لون المسار والتاريخ */}
                    <div className="flex items-center justify-between gap-2 bg-white p-2 rounded-xl border border-stone-200">
                      <span className="font-bold text-stone-700">لون المسار والتاريخ:</span>
                      <div className="flex items-center gap-1">
                        {TEXT_COLOR_SWATCHES.map(s => (
                          <button
                            key={s.label}
                            type="button"
                            onClick={() => setSubheadDateTextColor(s.color)}
                            style={{ backgroundColor: s.color }}
                            className="w-3.5 h-3.5 rounded-full border border-stone-300 cursor-pointer"
                            title={s.label}
                          />
                        ))}
                        <input
                          type="color"
                          value={subheadDateTextColor}
                          onChange={e => setSubheadDateTextColor(e.target.value)}
                          className="w-6 h-6 rounded-md border border-stone-300 cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* 3. لون أسماء الطالبات */}
                    <div className="flex items-center justify-between gap-2 bg-white p-2 rounded-xl border border-stone-200">
                      <span className="font-bold text-stone-700">لون أسماء الطالبات:</span>
                      <div className="flex items-center gap-1">
                        {TEXT_COLOR_SWATCHES.map(s => (
                          <button
                            key={s.label}
                            type="button"
                            onClick={() => setStudentNameTextColor(s.color)}
                            style={{ backgroundColor: s.color }}
                            className="w-3.5 h-3.5 rounded-full border border-stone-300 cursor-pointer"
                            title={s.label}
                          />
                        ))}
                        <input
                          type="color"
                          value={studentNameTextColor}
                          onChange={e => setStudentNameTextColor(e.target.value)}
                          className="w-6 h-6 rounded-md border border-stone-300 cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* 4. لون عبارة الدعاء والتهنئة */}
                    <div className="flex items-center justify-between gap-2 bg-white p-2 rounded-xl border border-stone-200">
                      <span className="font-bold text-stone-700">لون عبارة الدعاء والتهنئة:</span>
                      <div className="flex items-center gap-1">
                        {TEXT_COLOR_SWATCHES.map(s => (
                          <button
                            key={s.label}
                            type="button"
                            onClick={() => setClosingDuaTextColor(s.color)}
                            style={{ backgroundColor: s.color }}
                            className="w-3.5 h-3.5 rounded-full border border-stone-300 cursor-pointer"
                            title={s.label}
                          />
                        ))}
                        <input
                          type="color"
                          value={closingDuaTextColor}
                          onChange={e => setClosingDuaTextColor(e.target.value)}
                          className="w-6 h-6 rounded-md border border-stone-300 cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* 5. لون نصوص التوقيع */}
                    <div className="flex items-center justify-between gap-2 bg-white p-2 rounded-xl border border-stone-200">
                      <span className="font-bold text-stone-700">لون نصوص التوقيع:</span>
                      <div className="flex items-center gap-1">
                        {TEXT_COLOR_SWATCHES.map(s => (
                          <button
                            key={s.label}
                            type="button"
                            onClick={() => setSignatureTextColor(s.color)}
                            style={{ backgroundColor: s.color }}
                            className="w-3.5 h-3.5 rounded-full border border-stone-300 cursor-pointer"
                            title={s.label}
                          />
                        ))}
                        <input
                          type="color"
                          value={signatureTextColor}
                          onChange={e => setSignatureTextColor(e.target.value)}
                          className="w-6 h-6 rounded-md border border-stone-300 cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* 6. لون خلفية المستطيل والإطار */}
                    <div className="flex items-center justify-between gap-2 bg-white p-2 rounded-xl border border-stone-200">
                      <span className="font-bold text-stone-700">لون المستطيل والإطار:</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          value={boardHeaderBgColor}
                          onChange={e => setBoardHeaderBgColor(e.target.value)}
                          className="w-6 h-6 rounded-md border border-stone-300 cursor-pointer"
                          title="لون خلفية المستطيل العلوي"
                        />
                        <input
                          type="color"
                          value={boardAccentColor}
                          onChange={e => setBoardAccentColor(e.target.value)}
                          className="w-6 h-6 rounded-md border border-stone-300 cursor-pointer"
                          title="لون الإطار والحدود"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Optional Sliders for Header Box Dimensions, Logo Size, & Canvas Height */}
              {showLayoutSliders && (
                <div className="pt-2 border-t border-stone-100 bg-[#FCFAF8] p-2.5 rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-[11px]">
                  <label className="flex flex-col gap-1 font-bold text-stone-700 bg-white p-2 rounded-lg border border-stone-200/70">
                    <div className="flex justify-between">
                      <span>عرض المستطيل العلوي:</span>
                      <span className="text-amber-800 font-mono">{headerWidthPercent}%</span>
                    </div>
                    <input
                      type="range"
                      min={45}
                      max={100}
                      value={headerWidthPercent}
                      onChange={e => setHeaderWidthPercent(Number(e.target.value))}
                      disabled={!showHeaderBox}
                      className="accent-[#2D5A43] cursor-pointer disabled:opacity-40"
                    />
                  </label>

                  <label className="flex flex-col gap-1 font-bold text-stone-700 bg-white p-2 rounded-lg border border-stone-200/70">
                    <div className="flex justify-between">
                      <span>ارتفاع المستطيل العلوي:</span>
                      <span className="text-amber-800 font-mono">{headerPaddingY}px</span>
                    </div>
                    <input
                      type="range"
                      min={4}
                      max={30}
                      value={headerPaddingY}
                      onChange={e => setHeaderPaddingY(Number(e.target.value))}
                      disabled={!showHeaderBox}
                      className="accent-[#2D5A43] cursor-pointer disabled:opacity-40"
                    />
                  </label>

                  <label className="flex flex-col gap-1 font-bold text-stone-700 bg-white p-2 rounded-lg border border-stone-200/70">
                    <div className="flex justify-between">
                      <span>حجم الشعار الأساسي:</span>
                      <span className="text-amber-800 font-mono">{boardLogoSize}px</span>
                    </div>
                    <input
                      type="range"
                      min={36}
                      max={140}
                      value={boardLogoSize}
                      onChange={e => setBoardLogoSize(Number(e.target.value))}
                      className="accent-[#2D5A43] cursor-pointer"
                    />
                  </label>

                  <label className="flex flex-col gap-1 font-bold text-stone-700 bg-white p-2 rounded-lg border border-stone-200/70">
                    <div className="flex justify-between">
                      <span>مساحة إضافية للوحة:</span>
                      <span className="text-emerald-800 font-mono" dir="ltr">+{canvasExtraHeight}px</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={220}
                      value={canvasExtraHeight}
                      onChange={e => setCanvasExtraHeight(Number(e.target.value))}
                      className="accent-[#2D5A43] cursor-pointer"
                    />
                  </label>
                </div>
              )}
            </div>

            {/* ====================================================================
                The Freehand Drag-and-Drop Celebratory Honors Board Canvas
                - Every element is position: absolute and freely draggable (mouse/touch)
                - Direct scaling handles (+ / - and corner resize handle ⤡) on hover/select
                - Signatures on Right & Left with internal centered flex alignment
                - Solid Background Color + Custom Image + Tint Overlay
               ==================================================================== */}
            <div
              ref={honorsBoardRef}
              onClick={e => {
                if (e.target === e.currentTarget) {
                  setSelectedCanvasElement(null);
                }
              }}
              style={{
                fontFamily: `"${boardFontFamily}", sans-serif`,
                height: `${computedCanvasHeight}px`,
                borderColor: showOuterBorder ? boardAccentColor : 'transparent',
                borderWidth: showOuterBorder ? '4px' : '0px',
                borderStyle: showOuterBorder ? 'solid' : 'none',
                color: studentNameTextColor,
                backgroundColor: boardBgColor,
                backgroundImage: boardCustomBgUrl ? `url(${boardCustomBgUrl})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
              className="relative overflow-hidden rounded-[32px] shadow-2xl text-center select-none"
              dir="rtl"
            >
              {/* Adjustable Background Tint / Overlay Layer */}
              {boardBgTintOpacity > 0 && (
                <div
                  style={{
                    backgroundColor: boardBgTintColor,
                    opacity: boardBgTintOpacity / 100
                  }}
                  className="pointer-events-none absolute inset-0 z-0"
                />
              )}

              {/* Optional Inner Decorative Frame */}
              {showOuterBorder && (
                <div
                  style={{
                    borderColor: `${boardAccentColor}80`,
                    borderWidth: '1.5px',
                    borderStyle: 'solid'
                  }}
                  className="pointer-events-none absolute inset-3 sm:inset-4 rounded-[24px] z-0"
                />
              )}

              {/* 1. DRAGGABLE LOGO (الشعار) */}
              {boardLogoUrl && (
                <div
                  onMouseDown={e => handleStartDragElement('logo', e)}
                  onTouchStart={e => handleStartDragElement('logo', e)}
                  style={{
                    position: 'absolute',
                    top: `${baseLogoTop + elementTransforms.logo.y}px`,
                    left: `calc(50% + ${elementTransforms.logo.x}px)`,
                    transform: `translateX(-50%) scale(${elementTransforms.logo.scale})`,
                    cursor: draggingElement === 'logo' ? 'grabbing' : 'grab',
                    zIndex: selectedCanvasElement === 'logo' ? 30 : 15
                  }}
                  className={`group p-1 rounded-2xl transition-shadow ${
                    selectedCanvasElement === 'logo'
                      ? 'ring-2 ring-amber-500/80 bg-amber-50/20'
                      : 'hover:ring-1 hover:ring-amber-400/60'
                  }`}
                >
                  {/* Floating Scale & Remove Controls (Excluded from PNG export) */}
                  <div
                    data-export-ignore="true"
                    data-no-drag="true"
                    className="opacity-0 group-hover:opacity-100 absolute -top-7 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-stone-900/90 text-white px-2 py-0.5 rounded-full text-[10px] shadow-md whitespace-nowrap transition z-40"
                  >
                    <span>✋ اسحبي</span>
                    <button
                      type="button"
                      onClick={() => updateElementScale('logo', 0.08)}
                      className="px-1 hover:text-amber-300 font-bold cursor-pointer"
                      title="تكبير الشعار"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => updateElementScale('logo', -0.08)}
                      className="px-1 hover:text-amber-300 font-bold cursor-pointer"
                      title="تصغير الشعار"
                    >
                      -
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (logoObjectUrlRef.current) {
                          URL.revokeObjectURL(logoObjectUrlRef.current);
                          logoObjectUrlRef.current = null;
                        }
                        try {
                          localStorage.removeItem('ghaith_honors_custom_logo_v1');
                        } catch {
                          // ignore
                        }
                        setBoardLogoUrl('');
                      }}
                      className="px-1 text-rose-300 hover:text-rose-200 font-bold cursor-pointer"
                      title="حذف الشعار"
                    >
                      ✕
                    </button>
                  </div>

                  <img
                    src={boardLogoUrl}
                    alt="شعار المقرأة"
                    crossOrigin="anonymous"
                    draggable={false}
                    style={{
                      width: `${boardLogoSize}px`,
                      height: `${boardLogoSize}px`
                    }}
                    className="object-contain drop-shadow-xs pointer-events-none"
                  />

                  {/* Corner Resize Handle */}
                  <div
                    data-export-ignore="true"
                    data-no-drag="true"
                    onMouseDown={e => handleStartResizeElement('logo', e)}
                    onTouchStart={e => handleStartResizeElement('logo', e)}
                    className="opacity-0 group-hover:opacity-100 absolute -bottom-1.5 -left-1.5 w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] flex items-center justify-center shadow-xs cursor-nwse-resize"
                    title="اسحبي لتغيير الحجم"
                  >
                    ⤡
                  </div>
                </div>
              )}

              {/* 2. DRAGGABLE TOP BANNER / RECTANGLE (المستطيل العلوي) */}
              <div
                onMouseDown={e => handleStartDragElement('banner', e)}
                onTouchStart={e => handleStartDragElement('banner', e)}
                style={{
                  position: 'absolute',
                  top: `${baseBannerTop + elementTransforms.banner.y}px`,
                  left: `calc(50% + ${elementTransforms.banner.x}px)`,
                  width: `${headerWidthPercent}%`,
                  transform: `translateX(-50%) scale(${elementTransforms.banner.scale})`,
                  cursor: draggingElement === 'banner' ? 'grabbing' : 'grab',
                  zIndex: selectedCanvasElement === 'banner' ? 30 : 14
                }}
                className={`group rounded-2xl transition-shadow ${
                  selectedCanvasElement === 'banner'
                    ? 'ring-2 ring-amber-500/80'
                    : 'hover:ring-1 hover:ring-amber-400/60'
                }`}
              >
                {/* Floating Scale Toolbar */}
                <div
                  data-export-ignore="true"
                  data-no-drag="true"
                  className="opacity-0 group-hover:opacity-100 absolute -top-7 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-stone-900/90 text-white px-2.5 py-0.5 rounded-full text-[10px] shadow-md whitespace-nowrap transition z-40"
                >
                  <span>✋ اسحبي المستطيل</span>
                  <button
                    type="button"
                    onClick={() => updateElementScale('banner', 0.06)}
                    className="px-1 hover:text-amber-300 font-bold cursor-pointer"
                    title="تكبير المستطيل"
                  >
                    A+
                  </button>
                  <button
                    type="button"
                    onClick={() => updateElementScale('banner', -0.06)}
                    className="px-1 hover:text-amber-300 font-bold cursor-pointer"
                    title="تصغير المستطيل"
                  >
                    A-
                  </button>
                </div>

                <div
                  style={
                    showHeaderBox
                      ? {
                          paddingTop: `${headerPaddingY}px`,
                          paddingBottom: `${headerPaddingY}px`,
                          paddingLeft: '20px',
                          paddingRight: '20px',
                          backgroundColor: boardHeaderBgColor,
                          borderColor: boardAccentColor,
                          borderWidth: '2px',
                          borderStyle: 'solid'
                        }
                      : {
                          paddingTop: '4px',
                          paddingBottom: '4px'
                        }
                  }
                  className={`w-full transition-all ${
                    showHeaderBox ? 'rounded-2xl shadow-md' : 'bg-transparent'
                  }`}
                >
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={e => setBoardAcademyTitle(e.currentTarget.textContent || '')}
                    style={{
                      fontSize: `${Math.round(12 * boardFontScale)}px`,
                      color: showHeaderBox
                        ? headerTextColor
                        : headerTextColor === '#FFFFFF'
                          ? boardHeaderBgColor
                          : headerTextColor
                    }}
                    className="font-bold tracking-wide mb-0.5 opacity-95 outline-hidden hover:bg-black/5 rounded-lg px-2 py-0.5 cursor-text"
                  >
                    {boardAcademyTitle}
                  </div>

                  <h2
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={e => setBoardMainTitle(e.currentTarget.textContent || '')}
                    style={{
                      fontSize: `${Math.round(23 * boardFontScale)}px`,
                      color: showHeaderBox
                        ? headerTextColor
                        : headerTextColor === '#FFFFFF'
                          ? studentNameTextColor
                          : headerTextColor
                    }}
                    className="font-bold outline-hidden hover:bg-black/5 rounded-lg px-2 py-0.5 cursor-text"
                  >
                    {boardMainTitle}
                  </h2>
                </div>

                {/* Corner Resize Handle */}
                <div
                  data-export-ignore="true"
                  data-no-drag="true"
                  onMouseDown={e => handleStartResizeElement('banner', e)}
                  onTouchStart={e => handleStartResizeElement('banner', e)}
                  className="opacity-0 group-hover:opacity-100 absolute -bottom-1.5 -left-1.5 w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] flex items-center justify-center shadow-xs cursor-nwse-resize"
                  title="اسحبي لتكبير أو تصغير المستطيل"
                >
                  ⤡
                </div>
              </div>

              {/* 3. DRAGGABLE SUBTITLE BADGE & DESCRIPTION (اسم المسار والحلقة والتاريخ والوصف) */}
              <div
                onMouseDown={e => handleStartDragElement('badge', e)}
                onTouchStart={e => handleStartDragElement('badge', e)}
                style={{
                  position: 'absolute',
                  top: `${baseBadgeTop + elementTransforms.badge.y}px`,
                  left: `calc(50% + ${elementTransforms.badge.x}px)`,
                  width: '90%',
                  transform: `translateX(-50%) scale(${elementTransforms.badge.scale})`,
                  cursor: draggingElement === 'badge' ? 'grabbing' : 'grab',
                  zIndex: selectedCanvasElement === 'badge' ? 30 : 13
                }}
                className={`group p-1 rounded-2xl space-y-1 transition-shadow ${
                  selectedCanvasElement === 'badge'
                    ? 'ring-2 ring-amber-500/80 bg-amber-50/15'
                    : 'hover:ring-1 hover:ring-amber-400/60'
                }`}
              >
                {/* Floating Scale Toolbar */}
                <div
                  data-export-ignore="true"
                  data-no-drag="true"
                  className="opacity-0 group-hover:opacity-100 absolute -top-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-stone-900/90 text-white px-2.5 py-0.5 rounded-full text-[10px] shadow-md whitespace-nowrap transition z-40"
                >
                  <span>✋ اسحبي المسار والوصف</span>
                  <button
                    type="button"
                    onClick={() => updateElementScale('badge', 0.06)}
                    className="px-1 hover:text-amber-300 font-bold cursor-pointer"
                  >
                    A+
                  </button>
                  <button
                    type="button"
                    onClick={() => updateElementScale('badge', -0.06)}
                    className="px-1 hover:text-amber-300 font-bold cursor-pointer"
                  >
                    A-
                  </button>
                </div>

                <div className="flex justify-center">
                  <div
                    style={{
                      fontSize: `${Math.round(12 * boardFontScale)}px`,
                      borderColor: `${boardAccentColor}99`,
                      color: subheadDateTextColor
                    }}
                    className="inline-flex flex-wrap items-center justify-center gap-2 px-4 py-1 rounded-full bg-white/85 border font-bold shadow-2xs"
                  >
                    <span
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={e => setBoardTrackCircleBadge(e.currentTarget.textContent || '')}
                      className="outline-hidden hover:bg-amber-50 rounded-md px-1 cursor-text"
                    >
                      {boardTrackCircleBadge}
                    </span>
                    <span style={{ color: boardAccentColor }}>•</span>
                    <span
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={e => setBoardWeekDateLabel(e.currentTarget.textContent || '')}
                      className="outline-hidden hover:bg-amber-50 rounded-md px-1 cursor-text"
                    >
                      {boardWeekDateLabel}
                    </span>
                  </div>
                </div>

                <div className="space-y-0.5">
                  <p
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={e => setBoardSubtitle(e.currentTarget.textContent || '')}
                    style={{
                      fontSize: `${Math.round(15 * boardFontScale)}px`,
                      color: subheadDateTextColor
                    }}
                    className="font-bold outline-hidden hover:bg-amber-100/50 rounded-lg px-2 py-0.5 inline-block cursor-text"
                  >
                    {boardSubtitle}
                  </p>
                  <div>
                    <p
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={e => setBoardDescription(e.currentTarget.textContent || '')}
                      style={{
                        fontSize: `${Math.round(11.5 * boardFontScale)}px`,
                        color: subheadDateTextColor
                      }}
                      className="font-bold opacity-90 outline-hidden hover:bg-amber-100/50 rounded-lg px-2 py-0.5 inline-block cursor-text"
                    >
                      {boardDescription}
                    </p>
                  </div>
                </div>

                <div
                  data-export-ignore="true"
                  data-no-drag="true"
                  onMouseDown={e => handleStartResizeElement('badge', e)}
                  onTouchStart={e => handleStartResizeElement('badge', e)}
                  className="opacity-0 group-hover:opacity-100 absolute -bottom-1.5 -left-1.5 w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] flex items-center justify-center shadow-xs cursor-nwse-resize"
                  title="اسحبي لتغيير الحجم"
                >
                  ⤡
                </div>
              </div>

              {/* 4. DRAGGABLE STUDENT CARDS GRID (شبكة بطاقات أسماء الطالبات) */}
              <div
                onMouseDown={e => handleStartDragElement('students', e)}
                onTouchStart={e => handleStartDragElement('students', e)}
                style={{
                  position: 'absolute',
                  top: `${baseStudentsTop + elementTransforms.students.y}px`,
                  left: `calc(50% + ${elementTransforms.students.x}px)`,
                  width: '92%',
                  transform: `translateX(-50%) scale(${elementTransforms.students.scale})`,
                  cursor: draggingElement === 'students' ? 'grabbing' : 'grab',
                  zIndex: selectedCanvasElement === 'students' ? 30 : 12
                }}
                className={`group p-1.5 rounded-2xl transition-shadow ${
                  selectedCanvasElement === 'students'
                    ? 'ring-2 ring-amber-500/80 bg-amber-50/15'
                    : 'hover:ring-1 hover:ring-amber-400/60'
                }`}
              >
                {/* Floating Scale Toolbar */}
                <div
                  data-export-ignore="true"
                  data-no-drag="true"
                  className="opacity-0 group-hover:opacity-100 absolute -top-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-stone-900/90 text-white px-2.5 py-0.5 rounded-full text-[10px] shadow-md whitespace-nowrap transition z-40"
                >
                  <span>✋ اسحبي شبكة الطالبات</span>
                  <button
                    type="button"
                    onClick={() => updateElementScale('students', 0.06)}
                    className="px-1 hover:text-amber-300 font-bold cursor-pointer"
                  >
                    A+
                  </button>
                  <button
                    type="button"
                    onClick={() => updateElementScale('students', -0.06)}
                    className="px-1 hover:text-amber-300 font-bold cursor-pointer"
                  >
                    A-
                  </button>
                </div>

                {boardStudentItems.length > 0 ? (
                  <div className="flex flex-wrap items-center justify-center gap-2.5">
                    {boardStudentItems.map(st => (
                      <div
                        key={st.id}
                        style={{ borderColor: boardAccentColor }}
                        className="group/card relative w-fit inline-flex flex-col items-center justify-center py-1.5 px-4 rounded-xl bg-white/95 border shadow-2xs transition hover:shadow-md"
                      >
                        <button
                          type="button"
                          data-export-ignore="true"
                          data-no-drag="true"
                          onClick={() => handleRemoveBoardStudent(st.id)}
                          className="opacity-0 group-hover/card:opacity-100 absolute -top-2 -left-2 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[9px] shadow-xs transition cursor-pointer"
                          title="حذف الطالبة من اللوحة"
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </button>

                        <div
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={e => handleUpdateBoardStudentName(st.id, e.currentTarget.textContent || st.name)}
                          style={{
                            fontSize: `${Math.round(14 * boardFontScale)}px`,
                            color: studentNameTextColor
                          }}
                          className="font-bold text-center leading-snug outline-hidden hover:bg-amber-50/80 rounded-md px-1 cursor-text whitespace-nowrap privacy-student-name"
                        >
                          {st.name}
                        </div>

                        <div
                          data-no-drag="true"
                          className="mt-0.5 flex items-center justify-center gap-0.5 leading-none"
                        >
                          <button
                            type="button"
                            data-export-ignore="true"
                            onClick={() => handleSetStudentStars(st.id, st.stars - 1)}
                            disabled={st.stars <= 1}
                            className="opacity-0 group-hover/card:opacity-100 w-3.5 h-3.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 text-[9px] font-bold flex items-center justify-center transition cursor-pointer disabled:opacity-20"
                            title="إنقاص نجمة"
                          >
                            -
                          </button>

                          <div
                            onClick={() => handleSetStudentStars(st.id, st.stars >= 4 ? 1 : st.stars + 1)}
                            className="inline-flex items-center justify-center gap-0.5 cursor-pointer select-none"
                            title="انقري لتغيير عدد النجوم التراكمية (1 إلى 4 نجوم)"
                          >
                            {Array.from({ length: st.stars }).map((_, sIdx) => (
                              <span
                                key={sIdx}
                                style={{ fontSize: `${Math.round(12 * boardFontScale)}px` }}
                                className="leading-none"
                              >
                                🌟
                              </span>
                            ))}
                          </div>

                          <button
                            type="button"
                            data-export-ignore="true"
                            onClick={() => handleSetStudentStars(st.id, st.stars + 1)}
                            disabled={st.stars >= 6}
                            className="opacity-0 group-hover/card:opacity-100 w-3.5 h-3.5 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-900 text-[9px] font-bold flex items-center justify-center transition cursor-pointer disabled:opacity-20"
                            title="إضافة نجمة"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-5 px-4 rounded-2xl bg-white/80 border border-stone-200 text-stone-500 text-xs font-bold">
                    لا توجد طالبات مدرجات حالياً — يمكنك النقر على «➕ إضافة طالبة» لإضافة الأسماء يدوياً.
                  </div>
                )}

                <div
                  data-export-ignore="true"
                  data-no-drag="true"
                  onMouseDown={e => handleStartResizeElement('students', e)}
                  onTouchStart={e => handleStartResizeElement('students', e)}
                  className="opacity-0 group-hover:opacity-100 absolute -bottom-1.5 -left-1.5 w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] flex items-center justify-center shadow-xs cursor-nwse-resize"
                  title="اسحبي لتكبير أو تصغير البطاقات"
                >
                  ⤡
                </div>
              </div>

              {/* 5. DRAGGABLE MAIN DUA / QUOTE (عبارة الدعاء والتهنئة) */}
              <div
                onMouseDown={e => handleStartDragElement('dua', e)}
                onTouchStart={e => handleStartDragElement('dua', e)}
                style={{
                  position: 'absolute',
                  top: `${baseDuaTop + elementTransforms.dua.y}px`,
                  left: `calc(50% + ${elementTransforms.dua.x}px)`,
                  width: '88%',
                  transform: `translateX(-50%) scale(${elementTransforms.dua.scale})`,
                  cursor: draggingElement === 'dua' ? 'grabbing' : 'grab',
                  zIndex: selectedCanvasElement === 'dua' ? 30 : 14
                }}
                className={`group p-1 rounded-xl transition-shadow ${
                  selectedCanvasElement === 'dua'
                    ? 'ring-2 ring-amber-500/80 bg-amber-50/15'
                    : 'hover:ring-1 hover:ring-amber-400/60'
                }`}
              >
                <div
                  data-export-ignore="true"
                  data-no-drag="true"
                  className="opacity-0 group-hover:opacity-100 absolute -top-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-stone-900/90 text-white px-2.5 py-0.5 rounded-full text-[10px] shadow-md whitespace-nowrap transition z-40"
                >
                  <span>✋ اسحبي الدعاء</span>
                  <button
                    type="button"
                    onClick={() => updateElementScale('dua', 0.06)}
                    className="px-1 hover:text-amber-300 font-bold cursor-pointer"
                  >
                    A+
                  </button>
                  <button
                    type="button"
                    onClick={() => updateElementScale('dua', -0.06)}
                    className="px-1 hover:text-amber-300 font-bold cursor-pointer"
                  >
                    A-
                  </button>
                </div>

                <p
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={e => setBoardClosingDua(e.currentTarget.textContent || '')}
                  style={{
                    fontSize: `${Math.round(13.5 * boardFontScale)}px`,
                    color: closingDuaTextColor
                  }}
                  className="font-bold outline-hidden hover:bg-amber-50/80 rounded-lg px-2 py-0.5 inline-block cursor-text"
                >
                  {boardClosingDua}
                </p>

                <div
                  data-export-ignore="true"
                  data-no-drag="true"
                  onMouseDown={e => handleStartResizeElement('dua', e)}
                  onTouchStart={e => handleStartResizeElement('dua', e)}
                  className="opacity-0 group-hover:opacity-100 absolute -bottom-1.5 -left-1.5 w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] flex items-center justify-center shadow-xs cursor-nwse-resize"
                  title="اسحبي لتغيير الحجم"
                >
                  ⤡
                </div>
              </div>

              {/* 6. DRAGGABLE TEACHER SIGNATURE BLOCK (Right Side, Internal Centered Alignment) */}
              <div
                onMouseDown={e => handleStartDragElement('teacherSig', e)}
                onTouchStart={e => handleStartDragElement('teacherSig', e)}
                style={{
                  position: 'absolute',
                  top: `${baseSigTop + elementTransforms.teacherSig.y}px`,
                  left: `calc(76% + ${elementTransforms.teacherSig.x}px)`,
                  transform: `translateX(-50%) scale(${elementTransforms.teacherSig.scale})`,
                  cursor: draggingElement === 'teacherSig' ? 'grabbing' : 'grab',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  zIndex: selectedCanvasElement === 'teacherSig' ? 30 : 15
                }}
                className={`group px-3 py-1.5 rounded-xl space-y-0.5 transition-shadow ${
                  selectedCanvasElement === 'teacherSig'
                    ? 'ring-2 ring-amber-500/80 bg-amber-50/20'
                    : 'hover:ring-1 hover:ring-amber-400/60'
                }`}
              >
                <div
                  data-export-ignore="true"
                  data-no-drag="true"
                  className="opacity-0 group-hover:opacity-100 absolute -top-6 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-stone-900/90 text-white px-2 py-0.5 rounded-full text-[10px] shadow-md whitespace-nowrap transition z-40"
                >
                  <span>✋ اسحبي توقيع المعلمة</span>
                  <button
                    type="button"
                    onClick={() => updateElementScale('teacherSig', 0.06)}
                    className="px-1 hover:text-amber-300 font-bold cursor-pointer"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => updateElementScale('teacherSig', -0.06)}
                    className="px-1 hover:text-amber-300 font-bold cursor-pointer"
                  >
                    -
                  </button>
                </div>

                <div
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={e => setBoardTeacherLabel(e.currentTarget.textContent || '')}
                  style={{
                    fontSize: `${Math.round(11.5 * boardFontScale)}px`,
                    color: signatureTextColor
                  }}
                  className="font-bold opacity-85 text-center outline-hidden hover:bg-amber-50/70 rounded-md px-1.5 cursor-text whitespace-nowrap"
                >
                  {boardTeacherLabel}
                </div>
                <div
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={e => setBoardTeacherName(e.currentTarget.textContent || '')}
                  style={{
                    fontSize: `${Math.round(14 * boardFontScale)}px`,
                    color: signatureTextColor
                  }}
                  className="font-bold text-center outline-hidden hover:bg-amber-50/70 rounded-md px-1.5 cursor-text whitespace-nowrap"
                >
                  {boardTeacherName}
                </div>

                <div
                  data-export-ignore="true"
                  data-no-drag="true"
                  onMouseDown={e => handleStartResizeElement('teacherSig', e)}
                  onTouchStart={e => handleStartResizeElement('teacherSig', e)}
                  className="opacity-0 group-hover:opacity-100 absolute -bottom-1.5 -left-1.5 w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] flex items-center justify-center shadow-xs cursor-nwse-resize"
                  title="اسحبي لتغيير الحجم"
                >
                  ⤡
                </div>
              </div>

              {/* 7. DRAGGABLE LEADER SIGNATURE BLOCK (Left Side, Internal Centered Alignment) */}
              <div
                onMouseDown={e => handleStartDragElement('leaderSig', e)}
                onTouchStart={e => handleStartDragElement('leaderSig', e)}
                style={{
                  position: 'absolute',
                  top: `${baseSigTop + elementTransforms.leaderSig.y}px`,
                  left: `calc(24% + ${elementTransforms.leaderSig.x}px)`,
                  transform: `translateX(-50%) scale(${elementTransforms.leaderSig.scale})`,
                  cursor: draggingElement === 'leaderSig' ? 'grabbing' : 'grab',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  zIndex: selectedCanvasElement === 'leaderSig' ? 30 : 15
                }}
                className={`group px-3 py-1.5 rounded-xl space-y-0.5 transition-shadow ${
                  selectedCanvasElement === 'leaderSig'
                    ? 'ring-2 ring-amber-500/80 bg-amber-50/20'
                    : 'hover:ring-1 hover:ring-amber-400/60'
                }`}
              >
                <div
                  data-export-ignore="true"
                  data-no-drag="true"
                  className="opacity-0 group-hover:opacity-100 absolute -top-6 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-stone-900/90 text-white px-2 py-0.5 rounded-full text-[10px] shadow-md whitespace-nowrap transition z-40"
                >
                  <span>✋ اسحبي توقيع القائدة</span>
                  <button
                    type="button"
                    onClick={() => updateElementScale('leaderSig', 0.06)}
                    className="px-1 hover:text-amber-300 font-bold cursor-pointer"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => updateElementScale('leaderSig', -0.06)}
                    className="px-1 hover:text-amber-300 font-bold cursor-pointer"
                  >
                    -
                  </button>
                </div>

                <div
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={e => setBoardLeaderLabel(e.currentTarget.textContent || '')}
                  style={{
                    fontSize: `${Math.round(11.5 * boardFontScale)}px`,
                    color: signatureTextColor
                  }}
                  className="font-bold opacity-85 text-center outline-hidden hover:bg-amber-50/70 rounded-md px-1.5 cursor-text whitespace-nowrap"
                >
                  {boardLeaderLabel}
                </div>
                <div
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={e => setBoardLeaderName(e.currentTarget.textContent || '')}
                  style={{
                    fontSize: `${Math.round(14 * boardFontScale)}px`,
                    color: signatureTextColor
                  }}
                  className="font-bold text-center outline-hidden hover:bg-amber-50/70 rounded-md px-1.5 cursor-text whitespace-nowrap"
                >
                  {boardLeaderName}
                </div>

                <div
                  data-export-ignore="true"
                  data-no-drag="true"
                  onMouseDown={e => handleStartResizeElement('leaderSig', e)}
                  onTouchStart={e => handleStartResizeElement('leaderSig', e)}
                  className="opacity-0 group-hover:opacity-100 absolute -bottom-1.5 -left-1.5 w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] flex items-center justify-center shadow-xs cursor-nwse-resize"
                  title="اسحبي لتغيير الحجم"
                >
                  ⤡
                </div>
              </div>

            </div>
          </div>
        </div>
        </ErrorBoundary>
      )}

    </div>
  );
};
