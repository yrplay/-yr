import { InstitutionSettings, PinnedStaffAnnouncement, StaffChatMessage, User } from '../types';
import {
  isSupervisorOrTeacherOnly,
  readAllStaffAttendanceRecords,
  readResolvedStaffChatMessages,
  resolvePinnedStaffAnnouncement,
  resolveStaffProfile
} from './staffHelpers';

const NOTIFICATIONS_ENABLED_KEY = 'ghaith_staff_notifications_enabled';
const LAST_SEEN_CHAT_PREFIX = 'ghaith_staff_chat_last_seen_';
const NOTIFIED_ITEMS_PREFIX = 'ghaith_staff_notified_items_';
const SHIFT_REMINDER_LOG_PREFIX = 'ghaith_staff_shift_reminder_';

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
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
    playTone(659.25, 0, 0.22, 0.08);
    playTone(830.61, 0.14, 0.32, 0.07);

    setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 700);
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
 * Normalizes Arabic-Indic digits (٠-٩) to standard ASCII digits (0-9).
 */
function normalizeDigits(input: string): string {
  return String(input || '').replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

/**
 * Parses the start time from an Arabic working hours string such as:
 * "من 4:00 عصراً إلى 6:00 مساءً" or "من 8:30 صباحاً إلى 11:30 صباحاً"
 * Returns minutes from midnight (0 - 1439) or null if unparseable.
 */
export function parseShiftStartMinutes(workingHours: string | undefined): number | null {
  if (!workingHours) return null;
  const normalized = normalizeDigits(workingHours);

  // Match the first time occurrence (typically after "من" or at start of string)
  const timeMatch = normalized.match(/(\d{1,2})(?::(\d{2}))?\s*(صباحا|صباحاً|ص|عصرا|عصراً|مساء|مساءً|ظهرا|ظهراً|م)?/);
  if (!timeMatch) return null;

  let hours = parseInt(timeMatch[1], 10);
  const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
  if (isNaN(hours) || isNaN(minutes) || hours > 23 || minutes > 59) return null;

  const periodToken = timeMatch[3] || '';
  const hasMorningContext = /صباح|ص\b|فجر/.test(periodToken) || /من\s*\d+(?::\d+)?\s*(?:صباح|ص)/.test(normalized);
  const hasAfternoonEveningContext =
    /عصر|مساء|م\b|ظهر/.test(periodToken) ||
    (!hasMorningContext && /عصر|مساء/.test(normalized));

  if (hasMorningContext) {
    if (hours === 12) hours = 0;
  } else if (hasAfternoonEveningContext) {
    if (hours < 12) hours += 12;
  } else {
    // Default heuristic for Maqra'ah afternoon shifts (e.g. 3:00 - 9:00 without explicit suffix)
    if (hours >= 1 && hours <= 8) {
      hours += 12;
    }
  }

  return hours * 60 + minutes;
}

/**
 * Checks if a shift reminder (15 minutes prior or at shift start) should fire
 * strictly for Supervisors & Teachers whose attendance for today is unlogged.
 */
export function evaluateShiftReminderForStaff(params: {
  user: User | null | undefined;
  settings?: InstitutionSettings | null;
  todayIso: string;
  nowDate?: Date;
}): {
  shouldTrigger: boolean;
  reminderType?: 'pre_15m' | 'shift_start';
  title?: string;
  body?: string;
  tag?: string;
} {
  const { user, settings, todayIso, nowDate = new Date() } = params;
  // Strictly for Supervisors (مشرفة حلقات) and Teachers (معلمة حلقة) ONLY.
  // Never trigger shift reminders for Reefa Al-Mansouri or Omar Abdulrahman.
  if (!user || !isSupervisorOrTeacherOnly(user)) {
    return { shouldTrigger: false };
  }

  const allAttendance = readAllStaffAttendanceRecords(settings ?? undefined);
  const todayRecord = allAttendance[`${user.id}_${todayIso}`];
  if (todayRecord) {
    // Already logged attendance for today
    return { shouldTrigger: false };
  }

  const profile = resolveStaffProfile(user, settings ?? undefined);
  const shiftStartMinutes = parseShiftStartMinutes(profile.workingHours);
  if (shiftStartMinutes === null) {
    return { shouldTrigger: false };
  }

  const currentMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
  const diffMinutes = shiftStartMinutes - currentMinutes;

  // 15 minutes before shift window: [14..16] minutes before start
  let reminderType: 'pre_15m' | 'shift_start' | null = null;
  if (diffMinutes >= 14 && diffMinutes <= 16) {
    reminderType = 'pre_15m';
  } else if (diffMinutes >= -2 && diffMinutes <= 1) {
    reminderType = 'shift_start';
  }

  if (!reminderType) {
    return { shouldTrigger: false };
  }

  const storageKey = `${SHIFT_REMINDER_LOG_PREFIX}${user.id}_${todayIso}_${reminderType}`;
  try {
    if (localStorage.getItem(storageKey) === 'sent') {
      return { shouldTrigger: false };
    }
    localStorage.setItem(storageKey, 'sent');
  } catch {
    // ignore storage errors
  }

  if (reminderType === 'pre_15m') {
    return {
      shouldTrigger: true,
      reminderType: 'pre_15m',
      title: 'تذكير بقرب موعد الدوام — مقرأة غيث الغيم',
      body: `أهلاً بكِ ${user.name}، يتبقى 15 دقيقة على بداية دوامكِ (${profile.workingHours}). نسعد بتسجيل حضوركِ اليوم.`,
      tag: `shift-pre15-${user.id}-${todayIso}`
    };
  }

  return {
    shouldTrigger: true,
    reminderType: 'shift_start',
    title: 'حان موعد بداية الدوام — مقرأة غيث الغيم',
    body: `أهلاً بكِ ${user.name}، بدأ وقت دوامكِ (${profile.workingHours}) ولم يتم تسجيل الحضور لليوم بعد. بادري بتسجيل الحضور من قسم تحضير ومهام الكادر.`,
    tag: `shift-start-${user.id}-${todayIso}`
  };
}

/**
 * Unread Staff Chat & Pinned Announcement Tracking per user.
 */
export function getLastSeenStaffChatTimestamp(userId: string | undefined): number {
  if (!userId || typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(`${LAST_SEEN_CHAT_PREFIX}${userId}`);
    if (!raw) {
      // Initialize to current time on very first load so historical seed data doesn't spam notifications,
      // while any new message or announcement after this moment is counted.
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

/**
 * Tracks already-notified message/announcement IDs per user so each incoming message
 * or pinned announcement update triggers at most one alert on that device.
 */
export function hasAlreadyNotifiedItem(userId: string, itemKey: string): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = localStorage.getItem(`${NOTIFIED_ITEMS_PREFIX}${userId}`);
    if (!raw) return false;
    const list: string[] = JSON.parse(raw);
    return Array.isArray(list) && list.includes(itemKey);
  } catch {
    return false;
  }
}

export function markItemAsNotified(userId: string, itemKey: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(`${NOTIFIED_ITEMS_PREFIX}${userId}`);
    const list: string[] = raw ? JSON.parse(raw) : [];
    const next = Array.isArray(list) ? [...new Set([...list, itemKey])].slice(-80) : [itemKey];
    localStorage.setItem(`${NOTIFIED_ITEMS_PREFIX}${userId}`, JSON.stringify(next));
  } catch {
    // ignore
  }
}
