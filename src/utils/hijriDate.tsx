import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronRight, ChevronLeft } from 'lucide-react';

export const HIJRI_LOCALE = 'ar-SA-u-ca-islamic-umalqura';

const parseDateInput = (input?: string | Date | number): Date | null => {
  if (!input) return null;
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }
  if (typeof input === 'number') {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }
  const str = String(input).trim();
  if (!str) return null;
  // Handle YYYY-MM-DD safely in local noon to avoid timezone date shifts
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number);
    const dt = new Date(y, m - 1, d, 12, 0, 0);
    return isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(str);
  return isNaN(dt.getTime()) ? null : dt;
};

/**
 * Formats a date into Umm al-Qura Hijri format: e.g. "الأحد، ١٥ جمادى الأولى ١٤٤٧ هـ"
 */
export const formatHijriDate = (
  input?: string | Date | number,
  options?: { includeWeekday?: boolean; short?: boolean }
): string => {
  if (!input) return '—';
  // If already a formatted Hijri string (contains Arabic letters and no ISO pattern), return as is
  if (typeof input === 'string' && !/^\d{4}-\d{2}-\d{2}/.test(input.trim()) && /[\u0600-\u06FF]/.test(input)) {
    return input;
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
    const weekOfMonth = Math.min(4, Math.floor((day - 1) / 7) + 1);
    const weekNames = ['الأسبوع الأول', 'الأسبوع الثاني', 'الأسبوع الثالث', 'الأسبوع الرابع'];
    const weekLabel = `${weekNames[weekOfMonth - 1]} من ${monthName}`;

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
