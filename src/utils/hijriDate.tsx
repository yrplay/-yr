import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronRight, ChevronLeft } from 'lucide-react';

export const HIJRI_LOCALE = 'ar-SA-u-ca-islamic-umalqura';

export const HIJRI_MONTHS = [
  'المحرم',
  'صفر',
  'ربيع الأول',
  'ربيع الآخر',
  'جمادى الأولى',
  'جمادى الآخرة',
  'رجب',
  'شعبان',
  'رمضان',
  'شوال',
  'ذو القعدة',
  'ذو الحجة'
] as const;

export const HIJRI_YEARS = Array.from({ length: 16 }, (_, idx) => 1440 + idx); // 1440 هـ إلى 1455 هـ

export const parseHijriJoinDate = (input?: string): { year: number; month: number; day: number } => {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    const directHijriMatch = trimmed.match(/^(14\d{2})-(\d{1,2})-(\d{1,2})$/);
    if (directHijriMatch) {
      const y = Math.min(1455, Math.max(1440, Number(directHijriMatch[1]) || 1448));
      const m = Math.min(12, Math.max(1, Number(directHijriMatch[2]) || 1));
      const d = Math.min(30, Math.max(1, Number(directHijriMatch[3]) || 1));
      return { year: y, month: m, day: d };
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const parts = getHijriParts(trimmed);
      const y = parts.year >= 1440 && parts.year <= 1455 ? parts.year : 1448;
      const m = Math.min(12, Math.max(1, parts.month || 1));
      const d = Math.min(30, Math.max(1, parts.day || 1));
      return { year: y, month: m, day: d };
    }
  }
  return { year: 1448, month: 1, day: 1 };
};

const resolveHijriYmdToGregorianDate = (hYear: number, hMonth: number, hDay: number): Date => {
  const numFmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  });
  // Estimate Gregorian date from Hijri (year, month, day) and refine within ±45 days
  const approxDays = (hYear - 1448) * 354.367 + (hMonth - 6) * 29.53 + (hDay - 8);
  const base = new Date(2026, 10, 18, 12, 0, 0);
  base.setDate(base.getDate() + Math.round(approxDays));
  base.setHours(12, 0, 0, 0);

  for (let offset = -45; offset <= 45; offset++) {
    const cand = new Date(base);
    cand.setDate(base.getDate() + offset);
    cand.setHours(12, 0, 0, 0);
    const parts = numFmt.formatToParts(cand);
    const cy = Number(parts.find(p => p.type === 'year')?.value || 0);
    const cm = Number(parts.find(p => p.type === 'month')?.value || 0);
    const cd = Number(parts.find(p => p.type === 'day')?.value || 0);
    if (cy === hYear && cm === hMonth && cd === hDay) {
      return cand;
    }
  }
  return base;
};

const parseDateInput = (input?: string | Date | number): Date | null => {
  if (!input) return null;
  if (input instanceof Date) {
    if (isNaN(input.getTime())) return null;
    const copy = new Date(input);
    copy.setHours(12, 0, 0, 0);
    return copy;
  }
  if (typeof input === 'number') {
    const d = new Date(input);
    if (isNaN(d.getTime())) return null;
    d.setHours(12, 0, 0, 0);
    return d;
  }
  const str = String(input)
    .trim()
    .replace(/[٠-٩]/g, ch => String(ch.charCodeAt(0) - 0x0660));
  if (!str) return null;

  // Handle YYYY-MM-DD safely in local noon; if year is 1400..1500 (Hijri), convert via Umm al-Qura
  const ymdMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymdMatch) {
    const y = Number(ymdMatch[1]);
    const m = Number(ymdMatch[2]);
    const d = Number(ymdMatch[3]);
    if (y >= 1350 && y <= 1550) {
      return resolveHijriYmdToGregorianDate(y, m, d);
    }
    const dt = new Date(y, m - 1, d, 12, 0, 0);
    return isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(str);
  if (isNaN(dt.getTime())) return null;
  dt.setHours(12, 0, 0, 0);
  return dt;
};

export const STUDY_WEEK_NAMES = [
  'الأسبوع الأول',
  'الأسبوع الثاني',
  'الأسبوع الثالث',
  'الأسبوع الرابع',
  'الأسبوع الخامس'
] as const;

export interface StudyWeekInfo {
  weekdayIndex: number;
  weekStartSunday: Date;
  weekEndThursday: Date;
  weekStartSundayISO: string;
  weekEndThursdayISO: string;
  weekDaysISO: string[];
  weekNumber: number;
  weekName: string;
  hijriMonthName: string;
  hijriYear: number;
  weekLabelArabic: string;
}

const formatLocalDateISO = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dayNum = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dayNum}`;
};

/**
 * Shared helper that anchors every study week strictly to the Sunday–Thursday cycle (الأحد إلى الخميس).
 * Every day from Sunday through Thursday (plus Friday/Saturday before the next Sunday) shares the exact same
 * weekStartSunday, weekEndThursday, weekDaysISO, weekNumber, and weekLabelArabic.
 */
export const getStudyWeekInfo = (
  input?: string | Date | number,
  options?: {
    planStartDateHijri?: string;
    planHijriMonth?: string;
    isDefaultSeedPlan?: boolean;
  }
): StudyWeekInfo => {
  const date = parseDateInput(input) || new Date();
  date.setHours(12, 0, 0, 0);

  const weekdayIndex = date.getDay(); // 0 = الأحد ... 6 = السبت
  const weekStartSunday = new Date(date);
  weekStartSunday.setDate(date.getDate() - weekdayIndex);
  weekStartSunday.setHours(12, 0, 0, 0);

  const weekEndThursday = new Date(weekStartSunday);
  weekEndThursday.setDate(weekStartSunday.getDate() + 4);
  weekEndThursday.setHours(12, 0, 0, 0);

  const weekDaysISO: string[] = [];
  for (let i = 0; i <= 4; i++) {
    const cur = new Date(weekStartSunday);
    cur.setDate(weekStartSunday.getDate() + i);
    cur.setHours(12, 0, 0, 0);
    weekDaysISO.push(formatLocalDateISO(cur));
  }

  const numFmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  });

  const getRawHijri = (d: Date) => {
    const p = numFmt.formatToParts(d);
    return {
      year: Number(p.find(x => x.type === 'year')?.value || 1448),
      month: Number(p.find(x => x.type === 'month')?.value || 1),
      day: Number(p.find(x => x.type === 'day')?.value || 1)
    };
  };

  const sunHijri = getRawHijri(weekStartSunday);
  const sunMonthName = new Intl.DateTimeFormat(HIJRI_LOCALE, { month: 'long' }).format(weekStartSunday);

  // Find the first Sunday of weekStartSunday's Hijri month by stepping back 7 days at a time
  let monthWeek1Sunday = new Date(weekStartSunday);
  for (let step = 0; step < 5; step++) {
    const prevSunday = new Date(monthWeek1Sunday);
    prevSunday.setDate(monthWeek1Sunday.getDate() - 7);
    prevSunday.setHours(12, 0, 0, 0);
    const prevH = getRawHijri(prevSunday);
    if (prevH.month === sunHijri.month && prevH.year === sunHijri.year) {
      monthWeek1Sunday = prevSunday;
    } else {
      break;
    }
  }

  let anchorWeek1Sunday = monthWeek1Sunday;

  // Check if an active Monthly Plan start date ("بداية الخطة") anchors Week 1
  const rawPlanStart = options?.planStartDateHijri?.trim();
  if (rawPlanStart) {
    const normalized = rawPlanStart.replace(/[٠-٩]/g, ch => String(ch.charCodeAt(0) - 0x0660));
    let resolvedPlanDate: Date | null = null;

    if (/^(19|20)\d{2}-\d{1,2}-\d{1,2}$/.test(normalized)) {
      resolvedPlanDate = parseDateInput(normalized);
    } else {
      let targetMonth = 0;
      let targetDay = 0;
      const directHijri = normalized.match(/^(14\d{2})-(\d{1,2})-(\d{1,2})$/);
      if (directHijri) {
        targetMonth = Number(directHijri[2]);
        targetDay = Number(directHijri[3]);
      } else {
        const dayMatch = normalized.match(/(\d{1,2})/);
        if (dayMatch) targetDay = Number(dayMatch[1]);
        const monthAliases: Array<{ idx: number; name: string }> = [
          ...HIJRI_MONTHS.map((m, idx) => ({ idx: idx + 1, name: m })),
          { idx: 1, name: 'محرم' },
          { idx: 4, name: 'ربيع الثاني' },
          { idx: 6, name: 'جمادى الثانية' },
          { idx: 6, name: 'جمادى الاخرة' },
          { idx: 5, name: 'جمادى الاولى' }
        ];
        for (const entry of monthAliases) {
          if (normalized.includes(entry.name)) {
            targetMonth = entry.idx;
            break;
          }
        }
      }

      if (targetMonth >= 1 && targetMonth <= 12 && targetDay >= 1 && targetDay <= 30) {
        const isUnrelatedDefaultSeed =
          options?.isDefaultSeedPlan &&
          targetMonth === 4 &&
          targetDay === 30 &&
          sunHijri.month !== 4 &&
          sunHijri.month !== 5;

        if (!isUnrelatedDefaultSeed) {
          for (let offset = -35; offset <= 7; offset++) {
            const cand = new Date(weekStartSunday);
            cand.setDate(weekStartSunday.getDate() + offset);
            cand.setHours(12, 0, 0, 0);
            const ch = getRawHijri(cand);
            if (ch.month === targetMonth && ch.day === targetDay) {
              resolvedPlanDate = cand;
              break;
            }
          }
        }
      }
    }

    if (resolvedPlanDate) {
      const planWeek1Sunday = new Date(resolvedPlanDate);
      if (resolvedPlanDate.getDay() <= 4) {
        planWeek1Sunday.setDate(resolvedPlanDate.getDate() - resolvedPlanDate.getDay());
      } else {
        planWeek1Sunday.setDate(resolvedPlanDate.getDate() + (7 - resolvedPlanDate.getDay()));
      }
      planWeek1Sunday.setHours(12, 0, 0, 0);

      const diffWeeksFromPlan = Math.round(
        (weekStartSunday.getTime() - planWeek1Sunday.getTime()) / (7 * 24 * 60 * 60 * 1000)
      );
      if (diffWeeksFromPlan >= 0 && diffWeeksFromPlan <= 4) {
        anchorWeek1Sunday = planWeek1Sunday;
      }
    }
  }

  const weekNumber = Math.max(
    1,
    Math.min(
      5,
      Math.round((weekStartSunday.getTime() - anchorWeek1Sunday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
    )
  );
  const weekName = STUDY_WEEK_NAMES[weekNumber - 1] || 'الأسبوع الأول';
  const weekLabelArabic = `${weekName} - ${sunMonthName} ${sunHijri.year} هـ`;

  return {
    weekdayIndex,
    weekStartSunday,
    weekEndThursday,
    weekStartSundayISO: formatLocalDateISO(weekStartSunday),
    weekEndThursdayISO: formatLocalDateISO(weekEndThursday),
    weekDaysISO,
    weekNumber,
    weekName,
    hijriMonthName: sunMonthName,
    hijriYear: sunHijri.year,
    weekLabelArabic
  };
};

/**
 * Formats a date into Umm al-Qura Hijri format: e.g. "الأحد، ١٥ جمادى الأولى ١٤٤٧ هـ"
 */
export const formatHijriDate = (
  input?: string | Date | number,
  options?: { includeWeekday?: boolean; short?: boolean }
): string => {
  if (!input) return '—';
  if (typeof input === 'string') {
    const trimmed = input.trim();
    const directHijriMatch = trimmed.match(/^(14\d{2})-(\d{1,2})-(\d{1,2})$/);
    if (directHijriMatch) {
      const y = Number(directHijriMatch[1]);
      const m = Math.min(12, Math.max(1, Number(directHijriMatch[2]) || 1));
      const d = Math.min(30, Math.max(1, Number(directHijriMatch[3]) || 1));
      return `${d} ${HIJRI_MONTHS[m - 1]} ${y} هـ`;
    }
    // If already a formatted Hijri string (contains Arabic letters and no ISO pattern), return as is
    if (!/^\d{4}-\d{2}-\d{2}/.test(trimmed) && /[\u0600-\u06FF]/.test(trimmed)) {
      return trimmed;
    }
  }
  const date = parseDateInput(input);
  if (!date) return String(input);

  const includeWeekday = options?.includeWeekday ?? true;
  const short = options?.short ?? false;

  try {
    const fmt = new Intl.DateTimeFormat(HIJRI_LOCALE, {
      ...(includeWeekday && !short ? { weekday: 'long' } : {}),
      day: 'numeric',
      month: short ? 'short' : 'long',
      year: 'numeric'
    });
    return fmt.format(date);
  } catch {
    return date.toLocaleDateString('ar-SA');
  }
};

/**
 * Formats a short Hijri date without weekday: e.g. "١٥ جمادى الأولى ١٤٤٧ هـ"
 */
export const formatHijriShort = (input?: string | Date | number): string => {
  return formatHijriDate(input, { includeWeekday: false });
};

/**
 * Formats a timestamp into Hijri date + time: e.g. "١٥ جمادى الأولى ١٤٤٧ هـ • ٠٤:٣٠ م"
 */
export const formatHijriDateTime = (input?: string | Date | number): string => {
  if (!input) return '—';
  const date = parseDateInput(input);
  if (!date) return String(input);

  try {
    const datePart = new Intl.DateTimeFormat(HIJRI_LOCALE, {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(date);
    const timePart = new Intl.DateTimeFormat('ar-SA', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
    return `${datePart} • ${timePart}`;
  } catch {
    return date.toLocaleString('ar-SA');
  }
};

/**
 * Extracts numeric Hijri parts { year, month, day, monthName, weekday } from a Date or ISO string
 */
export const getHijriParts = (input?: string | Date | number): {
  year: number;
  month: number;
  day: number;
  monthName: string;
  weekday: string;
  monthKey: string;
  monthLabel: string;
  weekOfMonth: number;
  weekLabel: string;
} => {
  const date = parseDateInput(input) || new Date();
  try {
    const numFmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    });
    const parts = numFmt.formatToParts(date);
    const year = Number(parts.find(p => p.type === 'year')?.value || 1447);
    const month = Number(parts.find(p => p.type === 'month')?.value || 1);
    const day = Number(parts.find(p => p.type === 'day')?.value || 1);

    const monthName = new Intl.DateTimeFormat(HIJRI_LOCALE, { month: 'long' }).format(date);
    const yearAr = new Intl.DateTimeFormat(HIJRI_LOCALE, { year: 'numeric' }).format(date);
    const weekday = new Intl.DateTimeFormat(HIJRI_LOCALE, { weekday: 'long' }).format(date);

    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const monthLabel = `${monthName} ${yearAr}`;

    const studyWeek = getStudyWeekInfo(date);
    const weekOfMonth = studyWeek.weekNumber;
    const weekLabel = `${studyWeek.weekName} من ${studyWeek.hijriMonthName}`;

    return {
      year,
      month,
      day,
      monthName,
      weekday,
      monthKey,
      monthLabel,
      weekOfMonth,
      weekLabel
    };
  } catch {
    return {
      year: 1447,
      month: 1,
      day: 1,
      monthName: 'محرم',
      weekday: 'الأحد',
      monthKey: '1447-01',
      monthLabel: 'محرم ١٤٤٧ هـ',
      weekOfMonth: 1,
      weekLabel: 'الأسبوع الأول'
    };
  }
};

/**
 * Returns today's date as YYYY-MM-DD in local time
 */
export const getTodayISO = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Adds or subtracts Hijri days from a YYYY-MM-DD string and returns the new YYYY-MM-DD string
 */
export const shiftHijriDay = (isoDate: string, deltaDays: number): string => {
  const dt = parseDateInput(isoDate) || new Date();
  dt.setDate(dt.getDate() + deltaDays);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

interface HijriDateNavigationBarProps {
  selectedDate: string;
  onChangeDate: (newDate: string) => void;
  label?: string;
  compact?: boolean;
}

/**
 * Interactive Umm al-Qura Hijri Date Selector & Navigation Bar (السابق / اليوم / التالي + منتقي تقويم أم القرى)
 */
export const HijriDateNavigationBar: React.FC<HijriDateNavigationBarProps> = ({
  selectedDate,
  onChangeDate,
  label,
  compact = false
}) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [viewMonthBaseDate, setViewMonthBaseDate] = useState<string>(selectedDate);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setViewMonthBaseDate(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    if (pickerOpen) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [pickerOpen]);

  const todayIso = getTodayISO();
  const isToday = selectedDate === todayIso;

  // Build days of the currently viewed Hijri month
  const getHijriMonthDays = (anchorIso: string) => {
    const anchorParts = getHijriParts(anchorIso);
    // Find first day of this Hijri month by stepping backward up to 30 days
    let cursor = anchorIso;
    for (let i = 0; i < 32; i++) {
      const prev = shiftHijriDay(cursor, -1);
      const prevParts = getHijriParts(prev);
      if (prevParts.month !== anchorParts.month || prevParts.year !== anchorParts.year) {
        break;
      }
      cursor = prev;
    }

    const days: Array<{ iso: string; hijriDay: number; weekdayIndex: number }> = [];
    let current = cursor;
    for (let i = 0; i < 31; i++) {
      const p = getHijriParts(current);
      if (p.month !== anchorParts.month || p.year !== anchorParts.year) {
        break;
      }
      const dObj = parseDateInput(current) || new Date();
      days.push({
        iso: current,
        hijriDay: p.day,
        weekdayIndex: dObj.getDay() // 0 = Sun ... 6 = Sat
      });
      current = shiftHijriDay(current, 1);
    }

    return {
      monthLabel: anchorParts.monthLabel,
      days,
      firstIso: days[0]?.iso || anchorIso,
      lastIso: days[days.length - 1]?.iso || anchorIso
    };
  };

  const monthData = getHijriMonthDays(viewMonthBaseDate);
  const toArabicDigits = (n: number) => n.toLocaleString('ar-SA');

  return (
    <div className="relative" ref={containerRef} dir="rtl">
      {label && (
        <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
          {label}
        </label>
      )}
      <div className={`flex flex-wrap items-center gap-1.5 ${compact ? '' : 'bg-[#FAF7F5] dark:bg-stone-800 p-1.5 rounded-2xl border border-[#E2D5CC] dark:border-stone-700'}`}>
        {/* زر اليوم السابق */}
        <button
          type="button"
          onClick={() => onChangeDate(shiftHijriDay(selectedDate, -1))}
          className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-stone-900 hover:bg-[#FAF0F3] text-stone-700 dark:text-stone-200 border border-stone-200 dark:border-stone-700 text-xs font-bold flex items-center gap-1 transition cursor-pointer active:scale-95 shadow-2xs"
          title="اليوم الهجري السابق"
        >
          <ChevronRight className="w-3.5 h-3.5 text-[#8E5364]" />
          <span>السابق</span>
        </button>

        {/* عرض التاريخ الهجري مع فتح تقويم أم القرى */}
        <button
          type="button"
          onClick={() => setPickerOpen(prev => !prev)}
          className="flex-1 min-w-[185px] px-3 py-1.5 rounded-xl bg-white dark:bg-stone-900 hover:border-[#8E5364] border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center justify-center gap-2 transition cursor-pointer shadow-2xs"
          title="انقري لاختيار يوم من تقويم أم القرى الهجري"
        >
          <Calendar className="w-3.5 h-3.5 text-[#8E5364] shrink-0" />
          <span className="truncate">{formatHijriDate(selectedDate, { includeWeekday: true })}</span>
        </button>

        {/* زر اليوم */}
        <button
          type="button"
          onClick={() => onChangeDate(todayIso)}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 border ${
            isToday
              ? 'bg-[#8E5364] text-white border-[#8E5364] shadow-2xs'
              : 'bg-white dark:bg-stone-900 text-[#8E5364] border-stone-200 dark:border-stone-700 hover:bg-[#FAF0F3]'
          }`}
          title="العودة إلى تاريخ اليوم الهجري"
        >
          اليوم
        </button>

        {/* زر اليوم التالي */}
        <button
          type="button"
          onClick={() => onChangeDate(shiftHijriDay(selectedDate, 1))}
          className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-stone-900 hover:bg-[#FAF0F3] text-stone-700 dark:text-stone-200 border border-stone-200 dark:border-stone-700 text-xs font-bold flex items-center gap-1 transition cursor-pointer active:scale-95 shadow-2xs"
          title="اليوم الهجري التالي"
        >
          <span>التالي</span>
          <ChevronLeft className="w-3.5 h-3.5 text-[#8E5364]" />
        </button>
      </div>

      {/* نافذة تقويم أم القرى المنسدلة */}
      {pickerOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-stone-900 rounded-2xl shadow-xl border border-[#E2D5CC] dark:border-stone-700 p-3.5 z-50 space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-2">
            <button
              type="button"
              onClick={() => setViewMonthBaseDate(shiftHijriDay(monthData.firstIso, -1))}
              className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 text-xs font-bold cursor-pointer flex items-center gap-0.5"
              title="الشهر الهجري السابق"
            >
              <ChevronRight className="w-4 h-4" />
              <span className="text-[10px]">الشهر السابق</span>
            </button>

            <span className="text-xs font-extrabold text-[#8E5364] dark:text-[#E8BDC8]">
              {monthData.monthLabel}
            </span>

            <button
              type="button"
              onClick={() => setViewMonthBaseDate(shiftHijriDay(monthData.lastIso, 1))}
              className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 text-xs font-bold cursor-pointer flex items-center gap-0.5"
              title="الشهر الهجري التالي"
            >
              <span className="text-[10px]">الشهر التالي</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-stone-400">
            <span>أحد</span>
            <span>إثنين</span>
            <span>ثلاثاء</span>
            <span>أربعاء</span>
            <span>خميس</span>
            <span>جمعة</span>
            <span>سبت</span>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {Array.from({ length: monthData.days[0]?.weekdayIndex || 0 }).map((_, idx) => (
              <div key={`empty-${idx}`} className="h-8" />
            ))}
            {monthData.days.map(d => {
              const isSelected = d.iso === selectedDate;
              const isDayToday = d.iso === todayIso;
              return (
                <button
                  key={d.iso}
                  type="button"
                  onClick={() => {
                    onChangeDate(d.iso);
                    setPickerOpen(false);
                  }}
                  className={`h-8 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                    isSelected
                      ? 'bg-[#8E5364] text-white shadow-2xs'
                      : isDayToday
                      ? 'bg-amber-50 text-amber-900 border border-amber-300'
                      : 'hover:bg-[#FAF0F3] text-stone-700 dark:text-stone-200'
                  }`}
                >
                  {toArabicDigits(d.hijriDay)}
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-[11px]">
            <span className="text-stone-400">تقويم أم القرى المعتمد</span>
            <button
              type="button"
              onClick={() => {
                onChangeDate(todayIso);
                setPickerOpen(false);
              }}
              className="text-[#8E5364] font-bold hover:underline cursor-pointer"
            >
              الانتقال لليوم الحالي
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

interface HijriJoinDateSelectorProps {
  value?: string;
  onChange: (hijriIsoDate: string) => void;
  label?: string;
}

/**
 * Flexible Hijri Join Date Selector with 3 dropdowns:
 * - Day (1 to 30)
 * - Hijri Month (1 to 12: المحرم to ذو الحجة)
 * - Hijri Year (1440 هـ to 1455 هـ, default 1448 هـ)
 */
export const HijriJoinDateSelector: React.FC<HijriJoinDateSelectorProps> = ({
  value,
  onChange,
  label
}) => {
  const parsed = parseHijriJoinDate(value);

  const handlePartChange = (nextYear: number, nextMonth: number, nextDay: number) => {
    const formatted = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;
    onChange(formatted);
  };

  return (
    <div dir="rtl" className="space-y-1.5">
      {label && (
        <label className="block text-xs font-bold text-stone-700 dark:text-stone-300">
          {label}
        </label>
      )}
      <div className="grid grid-cols-3 gap-2 bg-[#FAF7F5] dark:bg-stone-800 p-2 rounded-2xl border border-[#E2D5CC] dark:border-stone-700">
        {/* اليوم */}
        <div>
          <label className="block text-[10px] font-bold text-stone-500 dark:text-stone-400 mb-1">
            اليوم
          </label>
          <select
            value={parsed.day}
            onChange={e => handlePartChange(parsed.year, parsed.month, Number(e.target.value))}
            className="w-full px-2.5 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-bold text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#8E5364] cursor-pointer"
          >
            {Array.from({ length: 30 }, (_, i) => i + 1).map(d => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        {/* الشهر الهجري */}
        <div>
          <label className="block text-[10px] font-bold text-stone-500 dark:text-stone-400 mb-1">
            الشهر الهجري
          </label>
          <select
            value={parsed.month}
            onChange={e => handlePartChange(parsed.year, Number(e.target.value), parsed.day)}
            className="w-full px-2.5 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-bold text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#8E5364] cursor-pointer"
          >
            {HIJRI_MONTHS.map((mName, idx) => (
              <option key={mName} value={idx + 1}>
                {mName}
              </option>
            ))}
          </select>
        </div>

        {/* السنة الهجرية */}
        <div>
          <label className="block text-[10px] font-bold text-stone-500 dark:text-stone-400 mb-1">
            السنة الهجرية
          </label>
          <select
            value={parsed.year}
            onChange={e => handlePartChange(Number(e.target.value), parsed.month, parsed.day)}
            className="w-full px-2.5 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-bold text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#8E5364] cursor-pointer"
          >
            {HIJRI_YEARS.map(yr => (
              <option key={yr} value={yr}>
                {yr} هـ
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center justify-between px-1 text-[11px] text-stone-500 dark:text-stone-400">
        <span>التاريخ المختار:</span>
        <span className="font-bold text-[#8E5364] dark:text-[#E8BDC8]">
          {parsed.day} {HIJRI_MONTHS[parsed.month - 1]} {parsed.year} هـ
        </span>
      </div>
    </div>
  );
};

