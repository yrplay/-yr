import { InstitutionSettings, PinnedStaffAnnouncement, StaffChatMessage, User } from '../types';
import {
  isSupervisorOrTeacherOnly,
  readAllStaffAttendanceRecords,
  readResolvedStaffChatMessages,
  resolvePinnedStaffAnnouncement,
  resolveStaffProfile
} from './staffHelpers';
import { formatHijriShort } from './hijriDate';

const NOTIFICATIONS_ENABLED_KEY = 'ghaith_staff_notifications_enabled';
const LAST_SEEN_CHAT_PREFIX = 'ghaith_staff_chat_last_seen_';
const SEEN_MESSAGE_IDS_PREFIX = 'ghaith_seen_staff_chat_ids_';
const SHIFT_REMINDER_LOG_PREFIX = 'ghaith_staff_shift_reminder_hijri_';

/**
 * Checks whether the current user/device has enabled staff notifications.
 */
export function isStaffNotificationsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const localOptIn = localStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
    if (localOptIn === 'true') return true;
    if (localOptIn === 'false') return false;
    if ('Notification' in window && Notification.permission === 'granted') {
      return true;
    }
  } catch {
    // ignore storage errors
  }
  return false;
}

/**
 * Requests browser/PWA notification permission and activates staff alerts.
 */
export async function enableStaffNotifications(): Promise<{
  enabled: boolean;
  nativeGranted: boolean;
}> {
  if (typeof window === 'undefined') {
    return { enabled: false, nativeGranted: false };
  }

  let nativeGranted = false;
  try {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        nativeGranted = true;
      } else if (Notification.permission !== 'denied') {
        const result = await Notification.requestPermission();
        nativeGranted = result === 'granted';
      }
    }
  } catch {
    // In restricted iframes Notification.requestPermission may throw or resolve default
  }

  try {
    localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, 'true');
    window.dispatchEvent(new CustomEvent('ghaith-staff-notifications-changed'));
  } catch {
    // ignore
  }

  return { enabled: true, nativeGranted };
}

/**
 * Plays a gentle, pleasant two-tone notification chime using the Web Audio API.
 */
export function playGentleNotificationChime(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playTone = (freq: number, startOffset: number, duration: number, peakGain: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + startOffset);

      gain.gain.setValueAtTime(0.0001, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(peakGain, now + startOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration + 0.02);
    };

    // Warm, calm two-note chime (E5 -> G#5)
    playTone(659.25, 0, 0.22, 0.09);
    playTone(830.61, 0.14, 0.34, 0.08);

    setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 750);
  } catch {
    // AudioContext may be blocked if no user gesture has occurred yet
  }
}

/**
 * Delivers a native device notification via both PWA Service Worker
 * (`navigator.serviceWorker.ready.then(reg => reg.showNotification(...))`)
 * and standard `new Notification(...)` fallback.
 */
export async function deliverNativeOrPwaNotification(options: {
  title: string;
  body: string;
  tag?: string;
  playChime?: boolean;
}): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  if (options.playChime !== false) {
    playGentleNotificationChime();
  }

  const iconUrl = '/pwa-192x192.png';
  const notificationOptions: NotificationOptions = {
    body: options.body,
    icon: iconUrl,
    badge: iconUrl,
    tag: options.tag || `ghaith-alert-${Date.now()}`,
    dir: 'rtl',
    lang: 'ar'
  };

  let deliveredNatively = false;

  // 1. Try PWA Service Worker showNotification first for reliable mobile/PWA background alerts
  try {
    if ('serviceWorker' in navigator && 'Notification' in window && Notification.permission === 'granted') {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>(resolve => setTimeout(() => resolve(null), 1200))
      ]);
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(options.title, notificationOptions);
        deliveredNatively = true;
      }
    }
  } catch {
    // Fallback to standard Notification constructor below
  }

  // 2. Fallback to standard Notification API if Service Worker did not show it
  if (!deliveredNatively) {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        const n = new Notification(options.title, notificationOptions);
        n.onclick = () => {
          try {
            window.focus();
          } catch {}
          n.close();
        };
        deliveredNatively = true;
      }
    } catch {
      // Ignore if browser environment requires SW or blocks constructor
    }
  }

  return deliveredNatively;
}

/**
 * Normalizes Arabic-Indic digits (٠-٩) and Persian digits (۰-۹) to standard ASCII digits (0-9).
 */
function normalizeArabicDigits(input: string): string {
  return String(input || '')
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    // Remove Arabic diacritics (tashkeel like fathatan ً ) for easier token matching
    .replace(/[\u064B-\u065F]/g, '');
}

/**
 * Dedicated Arabic time parser for `ساعات الدوام`.
 * Accurately extracts the shift start time from formats such as:
 * - "من 3:30 عصراً إلى 6:30 مساءً" -> 15:30 (930 mins)
 * - "من 4:00 عصراً" -> 16:00 (960 mins)
 * - "8:30 صباحاً" -> 08:30 (510 mins)
 * - "04:00 م" -> 16:00 (960 mins)
 * - "16:00" -> 16:00 (960 mins)
 * Returns minutes from midnight (0 - 1439) or null if unparseable.
 */
export function parseShiftStartMinutes(workingHours: string | undefined): number | null {
  if (!workingHours) return null;
  const normalized = normalizeArabicDigits(workingHours).trim();
  if (!normalized) return null;

  // Isolate the start segment (before "الى" / "إلى" / "-" / "حتى") so we always parse the START time
  const startSegment = normalized.split(/\b(?:الى|إلى|حتى)\b|[-–—]/)[0] || normalized;

  // Match hours, optional :minutes, and optional Arabic/English period indicator
  const timeMatch = startSegment.match(
    /(\d{1,2})(?:\s*[:.]\s*(\d{1,2}))?\s*(صباحا|صباح|ص|فجرا|فجر|عصرا|عصر|مساء|م|ظهرا|ظهر|ليلا|ليل|am|pm|a\.m\.|p\.m\.)?/i
  );
  if (!timeMatch) return null;

  let hours = parseInt(timeMatch[1], 10);
  const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  // If already in 24-hour format (13..23), keep as-is
  if (hours >= 13 && hours <= 23) {
    return hours * 60 + minutes;
  }

  const immediateToken = (timeMatch[3] || '').toLowerCase().trim();
  const isImmediateMorning =
    /^(صباحا|صباح|ص|فجرا|فجر|am|a\.m\.)$/.test(immediateToken) ||
    /\b(صباحا|صباح|ص|فجرا|فجر)\b/.test(startSegment);
  const isImmediatePM =
    /^(عصرا|عصر|مساء|م|ظهرا|ظهر|ليلا|ليل|pm|p\.m\.)$/.test(immediateToken) ||
    /\b(عصرا|عصر|مساء|م|ظهرا|ظهر|ليلا|ليل)\b/.test(startSegment);

  // If the start segment didn't have an explicit AM/PM word (e.g. "من 4:00 إلى 6:00 مساءً"),
  // check the full string context
  const hasFullStringMorning = /\b(صباحا|صباح|ص|فجرا|فجر)\b/.test(normalized);
  const hasFullStringPM = /\b(عصرا|عصر|مساء|م|ظهرا|ظهر)\b/.test(normalized);

  if (isImmediateMorning) {
    if (hours === 12) hours = 0;
  } else if (isImmediatePM) {
    if (hours < 12) hours += 12;
  } else if (hasFullStringMorning && !hasFullStringPM) {
    if (hours === 12) hours = 0;
  } else if (hasFullStringPM) {
    if (hours < 12) hours += 12;
  } else {
    // Default heuristic for Maqra'ah afternoon shifts when no suffix is written (e.g. "4:00 - 6:00")
    if (hours >= 1 && hours <= 7) {
      hours += 12;
    }
  }

  return hours * 60 + minutes;
}

/**
 * Formats 24-hour minutes from midnight into a readable Arabic time label (e.g., "4:00 عصراً").
 */
export function formatMinutesToArabicTime(totalMinutes: number): string {
  const hours24 = Math.floor(totalMinutes / 60) % 24;
  const mins = totalMinutes % 60;
  const minsStr = String(mins).padStart(2, '0');
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  let period = 'صباحاً';
  if (hours24 >= 12 && hours24 < 15) period = 'ظهراً';
  else if (hours24 >= 15 && hours24 < 18) period = 'عصراً';
  else if (hours24 >= 18) period = 'مساءً';
  return `${hours12}:${minsStr} ${period}`;
}

export interface ShiftReminderEvaluation {
  shouldTrigger: boolean;
  reminderType?: 'pre_15m' | 'shift_start';
  title?: string;
  body?: string;
  bannerTitle?: string;
  bannerSubtitle?: string;
  tag?: string;
  hijriDayKey?: string;
}

/**
 * Evaluates whether a shift reminder should fire right now for a Supervisor or Teacher:
 * - Strictly excludes Reefa Al-Mansouri (Platform Owner) and Omar Abdulrahman (Founder).
 * - Checks if the Supervisor/Teacher has NOT logged attendance for Today's Umm al-Qura Hijri date.
 * - 15 minutes before shift start (within the 15-to-1 minute window before start):
 *   triggers `تنبيه: تبقّى 15 دقيقة على بداية دوامكِ` (once per day using a daily Hijri key).
 * - At shift start time (within the first 15 minutes after start if still unlogged):
 *   triggers `بدأ وقت دوامكِ الآن، يرجى تسجيل الحضور` (once per day using a daily Hijri key).
 */
export function evaluateShiftReminderForStaff(params: {
  user: User | null | undefined;
  settings?: InstitutionSettings | null;
  todayIso: string;
  nowDate?: Date;
}): ShiftReminderEvaluation {
  const { user, settings, todayIso, nowDate = new Date() } = params;

  // Strictly for Supervisors (مشرفة حلقات) and Teachers (معلمة حلقة) ONLY.
  // Never trigger shift reminders for Reefa Al-Mansouri or Omar Abdulrahman.
  if (!user || !isSupervisorOrTeacherOnly(user)) {
    return { shouldTrigger: false };
  }

  const allAttendance = readAllStaffAttendanceRecords(settings ?? undefined);
  const todayRecord = allAttendance[`${user.id}_${todayIso}`];
  if (todayRecord) {
    // Attendance for Today's Umm al-Qura Hijri date is already logged
    return { shouldTrigger: false };
  }

  const profile = resolveStaffProfile(user, settings ?? undefined);
  const shiftStartMinutes = parseShiftStartMinutes(profile.workingHours);
  if (shiftStartMinutes === null) {
    return { shouldTrigger: false };
  }

  const currentMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
  // Positive diffMinutes = minutes remaining BEFORE shift start.
  // Zero or negative diffMinutes = minutes elapsed SINCE shift start.
  const diffMinutes = shiftStartMinutes - currentMinutes;

  let reminderType: 'pre_15m' | 'shift_start' | null = null;
  if (diffMinutes >= 1 && diffMinutes <= 15) {
    reminderType = 'pre_15m';
  } else if (diffMinutes <= 0 && diffMinutes >= -15) {
    reminderType = 'shift_start';
  }

  if (!reminderType) {
    return { shouldTrigger: false };
  }

  const hijriShortKey = formatHijriShort(todayIso).replace(/\s+/g, '_');
  const dailyHijriKey = `${SHIFT_REMINDER_LOG_PREFIX}${user.id}_${todayIso}_${hijriShortKey}_${reminderType}`;

  try {
    if (localStorage.getItem(dailyHijriKey) === 'fired') {
      return { shouldTrigger: false };
    }
    localStorage.setItem(dailyHijriKey, 'fired');
  } catch {
    // ignore storage errors
  }

  if (reminderType === 'pre_15m') {
    return {
      shouldTrigger: true,
      reminderType: 'pre_15m',
      hijriDayKey: dailyHijriKey,
      bannerTitle: 'تنبيه: تبقّى 15 دقيقة على بداية دوامكِ',
      bannerSubtitle: `أهلاً بكِ ${user.name} — موعد دوامكِ المجدول (${profile.workingHours}). يمكنكِ تسجيل حضور اليوم مباشرة.`,
      title: 'تنبيه: تبقّى 15 دقيقة على بداية دوامكِ',
      body: `أهلاً بكِ ${user.name}، موعد دوامكِ (${profile.workingHours}). بادري بتسجيل حضور اليوم في مقرأة غيث الغيم.`,
      tag: `shift-pre15-${user.id}-${todayIso}`
    };
  }

  return {
    shouldTrigger: true,
    reminderType: 'shift_start',
    hijriDayKey: dailyHijriKey,
    bannerTitle: 'بدأ وقت دوامكِ الآن، يرجى تسجيل الحضور',
    bannerSubtitle: `أهلاً بكِ ${user.name} — حان موعد بداية دوامكِ (${profile.workingHours}) ولم يتم تسجيل حضور اليوم بعد.`,
    title: 'بدأ وقت دوامكِ الآن، يرجى تسجيل الحضور',
    body: `أهلاً بكِ ${user.name}، بدأ وقت دوامكِ (${profile.workingHours}) ولم يُسجّل الحضور لليوم بعد. يرجى تسجيل الحضور الآن.`,
    tag: `shift-start-${user.id}-${todayIso}`
  };
}

/**
 * Checks whether a chat message or announcement was authored by the current user.
 */
export function isAuthoredByCurrentUser(
  currentUser: User | null | undefined,
  authorId?: string,
  authorName?: string
): boolean {
  if (!currentUser) return false;
  if (authorId && currentUser.id === authorId) return true;
  if (authorName && currentUser.name.trim() === authorName.trim()) return true;
  return false;
}

/**
 * Global Seen Message IDs Tracker (`seenMessageIds` in localStorage).
 * Ensures cross-device incoming messages and pinned announcements are reliably detected
 * whenever cloud sync delivers an item whose ID has not been seen yet.
 */
export function readSeenMessageIdsForUser(
  userId: string,
  seedItemsOnFirstInit?: string[]
): Set<string> {
  if (typeof window === 'undefined' || !userId) return new Set();
  const storageKey = `${SEEN_MESSAGE_IDS_PREFIX}${userId}`;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw === null) {
      const initialList = Array.isArray(seedItemsOnFirstInit) ? seedItemsOnFirstInit : [];
      localStorage.setItem(storageKey, JSON.stringify(initialList));
      return new Set(initialList);
    }
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

export function writeSeenMessageIdsForUser(userId: string, ids: Set<string>): void {
  if (typeof window === 'undefined' || !userId) return;
  const storageKey = `${SEEN_MESSAGE_IDS_PREFIX}${userId}`;
  try {
    const trimmed = Array.from(ids).slice(-200);
    localStorage.setItem(storageKey, JSON.stringify(trimmed));
  } catch {
    // ignore
  }
}

export function markMessageIdAsSeenByUser(userId: string | undefined, itemKey: string): void {
  if (!userId || !itemKey) return;
  const current = readSeenMessageIdsForUser(userId);
  current.add(itemKey);
  writeSeenMessageIdsForUser(userId, current);
}

/**
 * Builds the canonical seen-key for a chat message or pinned announcement.
 */
export function getChatMessageSeenKey(msg: StaffChatMessage): string {
  return msg.editedAt ? `msg_${msg.id}_edit_${msg.editedAt}` : `msg_${msg.id}`;
}

export function getPinnedAnnouncementSeenKey(pinned: PinnedStaffAnnouncement): string {
  return `pin_${pinned.updatedAt || 0}_${(pinned.text || '').slice(0, 24)}`;
}

/**
 * Unread Staff Chat & Pinned Announcement Tracking per user for Sidebar Badge.
 */
export function getLastSeenStaffChatTimestamp(userId: string | undefined): number {
  if (!userId || typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(`${LAST_SEEN_CHAT_PREFIX}${userId}`);
    if (!raw) {
      const initialNow = Date.now() - 1000;
      localStorage.setItem(`${LAST_SEEN_CHAT_PREFIX}${userId}`, String(initialNow));
      return initialNow;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

export function markStaffChatSeenNow(
  userId: string | undefined,
  settings?: InstitutionSettings | null
): void {
  if (!userId || typeof window === 'undefined') return;
  try {
    let latestTs = Date.now();
    const msgs = readResolvedStaffChatMessages(settings);
    for (const m of msgs) {
      if (m.createdAt > latestTs) latestTs = m.createdAt;
      if (m.editedAt && m.editedAt > latestTs) latestTs = m.editedAt;
    }
    const pinned = resolvePinnedStaffAnnouncement(settings);
    if (pinned.updatedAt && pinned.updatedAt > latestTs) {
      latestTs = pinned.updatedAt;
    }
    localStorage.setItem(`${LAST_SEEN_CHAT_PREFIX}${userId}`, String(latestTs));
    window.dispatchEvent(new CustomEvent('ghaith-staff-chat-seen-updated'));
  } catch {
    // ignore
  }
}

/**
 * Computes the unread message + pinned announcement count for the sidebar badge
 * on "تحضير ومهام الكادر", strictly excluding items sent/updated by the current user.
 */
export function computeUnreadStaffChatCount(
  currentUser: User | null | undefined,
  settings?: InstitutionSettings | null
): number {
  if (!currentUser) return 0;
  const lastSeen = getLastSeenStaffChatTimestamp(currentUser.id);
  const activeMessages: StaffChatMessage[] = readResolvedStaffChatMessages(settings);
  let count = 0;

  for (const msg of activeMessages) {
    if (isAuthoredByCurrentUser(currentUser, msg.senderId, msg.senderName)) continue;
    const msgTimestamp = msg.editedAt || msg.createdAt;
    if (msgTimestamp > lastSeen) {
      count += 1;
    }
  }

  const pinned: PinnedStaffAnnouncement = resolvePinnedStaffAnnouncement(settings);
  if (
    pinned.text &&
    pinned.updatedAt > lastSeen &&
    !isAuthoredByCurrentUser(currentUser, undefined, pinned.updatedBy)
  ) {
    count += 1;
  }

  return count;
}
