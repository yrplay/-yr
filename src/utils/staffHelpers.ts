import {
  User,
  UserRole,
  InstitutionSettings,
  StaffTaskItem,
  StaffAttendanceRecord,
  StaffAttendanceStatus,
  StaffProfileConfig,
  StaffChatMessage,
  PinnedStaffAnnouncement,
  hasFullAccess
} from '../types';
import { formatHijriDate } from './hijriDate';

export const STAFF_ATTENDANCE_LOCAL_KEY = 'ghaith_staff_attendance_local_v1';
export const STAFF_PROFILES_LOCAL_KEY = 'ghaith_staff_profiles_local_v1';

/**
 * Strictly identifies Founders ("مؤسس المنصة" - e.g. أ. عمر عبدالرحمن)
 * and Platform Owners / Leaders ("مالك المنصة" / "قائدة" - e.g. ريفة المنصوري).
 * These accounts have 100% full administrative oversight and are strictly EXCLUDED
 * from personal attendance check-in, daily/monthly attendance tables, working hours, tasks, and salary cards.
 */
export const isFounderOrOwnerOrLeader = (
  user: Pick<User, 'id' | 'role' | 'name' | 'title' | 'email'> | null | undefined
): boolean => {
  if (!user) return false;
  if (hasFullAccess(user)) return true;
  if (user.role === 'developer' || user.role === 'owner' || user.role === 'leader') return true;
  if (user.id === 'u-dev' || user.id === 'u-owner' || user.id === 'u-admin') return true;
  const email = (user.email || '').trim().toLowerCase();
  if (email === 'yr.play.com@gmail.com' || email === 'owner@ghaym.org') return true;
  const name = (user.name || '').trim();
  const title = (user.title || '').trim();
  if (
    name.includes('عمر عبدالرحمن') ||
    name.includes('ريفة المنصوري') ||
    name.includes('مطور المنصة') ||
    name.includes('مؤسس المنصة') ||
    name.includes('مالك المنصة') ||
    title.includes('مؤسس المنصة') ||
    title.includes('مالك المنصة')
  ) {
    return true;
  }
  return false;
};

/**
 * Strictly returns true ONLY for Supervisors (مشرفة) and Teachers (معلمة),
 * excluding Founders (مؤسس المنصة) and Platform Owners/Leaders (مالك المنصة / قائدة).
 */
export const isSupervisorOrTeacherOnly = (
  user: Pick<User, 'id' | 'role' | 'name' | 'title' | 'email'> | null | undefined
): boolean => {
  if (!user) return false;
  if (isFounderOrOwnerOrLeader(user)) return false;
  return user.role === 'supervisor' || user.role === 'teacher';
};

/**
 * Formats current time as Arabic 12-hour string, e.g. "04:02 م" or "03:45 م"
 */
export const formatCurrentArabicTime = (date: Date = new Date()): string => {
  try {
    const hours24 = date.getHours();
    const minutes = date.getMinutes();
    const period = hours24 >= 12 ? 'م' : 'ص';
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
    const hh = String(hours12).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    return `${hh}:${mm} ${period}`;
  } catch {
    return '04:00 م';
  }
};

/**
 * Returns the original Role Badge label:
 * [ مالك المنصة / قائدة المقرأة / المطور التقني / مشرفة حلقات / معلمة حلقة ]
 */
export const getStaffShortRoleLabel = (
  role?: UserRole,
  user?: Pick<User, 'name' | 'title' | 'email'> | null
): string => {
  const email = (user?.email || '').trim().toLowerCase();
  const name = (user?.name || '').trim();
  if (role === 'developer' || email === 'yr.play.com@gmail.com') {
    return 'المطور التقني';
  }
  if (role === 'owner' || email === 'reef@ghaym.org' || name.includes('ريفة المنصوري')) {
    return 'مالك المنصة';
  }
  if (role === 'leader' || email === 'omar@ghaym.org' || name.includes('عمر عبدالرحمن')) {
    return 'قائدة المقرأة';
  }
  if (role === 'supervisor') return 'مشرفة حلقات';
  return 'معلمة حلقة';
};

export const LOGIN_WELCOME_DURATION_MS = 120000; // 2 full minutes (120 seconds)
export const WELCOME_MESSAGES_LOCAL_KEY = 'ghaith_welcome_messages_v1';

/**
 * Grants equal full edit access to customize welcome messages for ALL accounts to:
 * - ريفة المنصوري (مالك المنصة / reef@ghaym.org)
 * - أ. عمر عبدالرحمن (مؤسس غيث الغيم / omar@ghaym.org)
 * - Any full-access leader/owner/developer
 */
export const canManageAllWelcomeMessages = (
  user: Pick<User, 'id' | 'role' | 'name' | 'title' | 'email'> | null | undefined
): boolean => {
  if (!user) return false;
  if (hasFullAccess(user)) return true;
  const email = (user.email || '').trim().toLowerCase();
  const name = (user.name || '').trim();
  const title = (user.title || '').trim();
  if (
    email === 'reef@ghaym.org' ||
    email === 'omar@ghaym.org' ||
    email === 'owner@ghaym.org' ||
    email === 'yr.play.com@gmail.com' ||
    name.includes('ريفة المنصوري') ||
    name.includes('عمر عبدالرحمن') ||
    title.includes('مالك المنصة') ||
    title.includes('مؤسس غيث الغيم')
  ) {
    return true;
  }
  return false;
};

/**
 * Returns the descriptive role/title subtitle for the welcome target dropdown & default toast:
 * - ريفة المنصوري -> مالك المنصة العام
 * - أ. عمر عبدالرحمن -> مؤسس غيث الغيم
 * - مشرفة -> مشرفة حلقات (or custom title)
 * - معلمة -> معلمة حلقة (or custom title)
 */
export const getStaffDropdownRoleBadge = (
  user: Pick<User, 'role' | 'name' | 'title' | 'email'> | null | undefined
): string => {
  if (!user) return 'مالك المنصة العام';
  const email = (user.email || '').trim().toLowerCase();
  const name = (user.name || '').trim();
  const title = (user.title || '').trim();
  if (email === 'reef@ghaym.org' || name.includes('ريفة المنصوري') || user.role === 'owner') {
    return title || 'مالك المنصة العام';
  }
  if (email === 'omar@ghaym.org' || name.includes('عمر عبدالرحمن')) {
    return title || 'مؤسس غيث الغيم';
  }
  if (user.role === 'developer' || email === 'yr.play.com@gmail.com') {
    return title || 'المطور التقني';
  }
  if (user.role === 'leader') {
    return title || 'قائدة المقرأة';
  }
  if (user.role === 'supervisor') {
    return title || 'مشرفة حلقات';
  }
  return title || 'معلمة حلقة';
};

export const readLocalWelcomeMessages = (): Record<string, string> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(WELCOME_MESSAGES_LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {}
  return {};
};

export const writeLocalWelcomeMessages = (map: Record<string, string>): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(WELCOME_MESSAGES_LOCAL_KEY, JSON.stringify(map));
  } catch {}
};

/**
 * Resolves the cloud-synced personalized login welcome message for any user
 * by checking id, email, and name keys across settings.welcomeMessages,
 * settings.staffWelcomeConfigs, user.welcomeTitle, and localStorage cache.
 */
export const resolveUserWelcomeConfig = (
  targetUser: User | null | undefined,
  settings?: InstitutionSettings | null
): {
  welcomeTitle: string;
  canEditOwnWelcome: boolean;
} => {
  if (!targetUser) {
    return {
      welcomeTitle: `مرحباً بك ${settings?.leaderName || 'ريفة المنصوري'} (مالك المنصة العام)`,
      canEditOwnWelcome: false
    };
  }

  const cleanEmail = (targetUser.email || '').trim().toLowerCase();
  const cleanName = (targetUser.name || '').trim();
  const lookupKeys = [targetUser.id, cleanEmail, cleanName].filter(Boolean);

  // Also add canonical alias keys for Reefa and Omar so cross-device ID differences never miss
  if (cleanEmail === 'reef@ghaym.org' || cleanName.includes('ريفة المنصوري') || targetUser.role === 'owner') {
    lookupKeys.push('u-owner', 'reef@ghaym.org', 'ريفة المنصوري');
  }
  if (cleanEmail === 'omar@ghaym.org' || cleanName.includes('عمر عبدالرحمن')) {
    lookupKeys.push('u-omar', 'u-founder-omar', 'omar@ghaym.org', 'أ. عمر عبدالرحمن');
  }

  const localMap = readLocalWelcomeMessages();
  const welcomeMessagesMap = settings?.welcomeMessages || {};
  const staffConfigsMap = settings?.staffWelcomeConfigs || {};

  let resolvedMessage = '';
  for (const key of lookupKeys) {
    const fromConfigs = staffConfigsMap[key]?.welcomeTitle?.trim();
    if (fromConfigs) {
      resolvedMessage = fromConfigs;
      break;
    }
    const fromWelcomeMap = welcomeMessagesMap[key]?.trim();
    if (fromWelcomeMap) {
      resolvedMessage = fromWelcomeMap;
      break;
    }
  }

  if (!resolvedMessage && targetUser.welcomeTitle?.trim()) {
    resolvedMessage = targetUser.welcomeTitle.trim();
  }

  if (!resolvedMessage) {
    for (const key of lookupKeys) {
      const fromLocal = localMap[key]?.trim();
      if (fromLocal) {
        resolvedMessage = fromLocal;
        break;
      }
    }
  }

  const defaultLoginToast = `مرحباً بك ${targetUser.name} (${getStaffDropdownRoleBadge(targetUser)})`;
  const isTargetAdmin = canManageAllWelcomeMessages(targetUser);

  let resolvedCanEdit = isTargetAdmin;
  if (!resolvedCanEdit) {
    for (const key of lookupKeys) {
      const cfg = staffConfigsMap[key];
      if (cfg && typeof cfg.canEditOwnWelcome === 'boolean') {
        resolvedCanEdit = cfg.canEditOwnWelcome;
        break;
      }
    }
    if (!resolvedCanEdit) {
      resolvedCanEdit =
        typeof targetUser.canEditOwnWelcome === 'boolean'
          ? targetUser.canEditOwnWelcome
          : !!targetUser.permissions?.canEditOwnWelcome;
    }
  }

  return {
    welcomeTitle: resolvedMessage || defaultLoginToast,
    canEditOwnWelcome: resolvedCanEdit
  };
};

export const getDefaultWorkingHoursForRole = (role?: UserRole): string => {
  if (role === 'supervisor') {
    return 'من 3:45 عصراً إلى 6:15 مساءً';
  }
  return 'من 4:00 عصراً إلى 6:00 مساءً';
};

export const getDefaultMonthlySalaryForRole = (role?: UserRole): number => {
  if (role === 'supervisor') return 1800;
  return 1500;
};

export const getDefaultTasksForUser = (user: Pick<User, 'id' | 'role'>): StaffTaskItem[] => {
  if (user.role === 'supervisor') {
    return [
      {
        id: `task-${user.id}-1`,
        title: 'متابعة التحضير المبكر وانضباط الحلقات اليومي',
        completed: false
      },
      {
        id: `task-${user.id}-2`,
        title: 'مراجعة تقارير الإنجاز الأسبوعي وتفقد حالات الغياب المتكرر',
        completed: false
      },
      {
        id: `task-${user.id}-3`,
        title: 'التنسيق مع المعلمات في رصد التحديات والاختبارات الشهرية',
        completed: false
      }
    ];
  }
  return [
    {
      id: `task-${user.id}-1`,
      title: 'تسميع المقرر اليومي للطالبات وتطبيق شروط الحفظ المتقن',
      completed: false
    },
    {
      id: `task-${user.id}-2`,
      title: 'رصد الحضور والتحضير المبكر وتقييم واجبات «أتقني» للتجويد',
      completed: false
    },
    {
      id: `task-${user.id}-3`,
      title: 'متابعة المراجعة الثنائية وتحديث نسب إنجاز خطط الطالبات',
      completed: false
    }
  ];
};

export const readLocalStaffProfiles = (): Record<string, StaffProfileConfig> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STAFF_PROFILES_LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    // ignore storage errors
  }
  return {};
};

export const writeLocalStaffProfiles = (profiles: Record<string, StaffProfileConfig>): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STAFF_PROFILES_LOCAL_KEY, JSON.stringify(profiles));
  } catch {
    // ignore storage errors
  }
};

export const resolveStaffProfile = (
  user: User,
  settings?: InstitutionSettings
): {
  workingHours: string;
  monthlySalary: number;
  tasks: StaffTaskItem[];
  leaderPrivateNotes: string;
} => {
  const localMap = readLocalStaffProfiles();
  const localCfg = localMap[user.id];
  const settingsCfg = settings?.staffProfiles?.[user.id];

  const workingHours =
    user.workingHours?.trim() ||
    settingsCfg?.workingHours?.trim() ||
    localCfg?.workingHours?.trim() ||
    getDefaultWorkingHoursForRole(user.role);

  const monthlySalary =
    typeof user.monthlySalary === 'number' && !isNaN(user.monthlySalary)
      ? user.monthlySalary
      : typeof settingsCfg?.monthlySalary === 'number' && !isNaN(settingsCfg.monthlySalary)
      ? settingsCfg.monthlySalary
      : typeof localCfg?.monthlySalary === 'number' && !isNaN(localCfg.monthlySalary)
      ? localCfg.monthlySalary
      : getDefaultMonthlySalaryForRole(user.role);

  const tasks = Array.isArray(user.tasks)
    ? user.tasks
    : Array.isArray(settingsCfg?.tasks)
    ? settingsCfg.tasks
    : Array.isArray(localCfg?.tasks)
    ? localCfg.tasks
    : getDefaultTasksForUser(user);

  const leaderPrivateNotes =
    typeof user.leaderPrivateNotes === 'string'
      ? user.leaderPrivateNotes
      : typeof settingsCfg?.leaderPrivateNotes === 'string'
      ? settingsCfg.leaderPrivateNotes
      : typeof localCfg?.leaderPrivateNotes === 'string'
      ? localCfg.leaderPrivateNotes
      : '';

  return {
    workingHours,
    monthlySalary,
    tasks,
    leaderPrivateNotes
  };
};

export const readAllStaffAttendanceRecords = (
  settings?: InstitutionSettings
): Record<string, StaffAttendanceRecord> => {
  let localRecords: Record<string, StaffAttendanceRecord> = {};
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(STAFF_ATTENDANCE_LOCAL_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          localRecords = parsed;
        }
      }
    } catch {
      // ignore storage errors
    }
  }
  const fromSettings = settings?.staffAttendanceRecords || {};
  const merged: Record<string, StaffAttendanceRecord> = { ...localRecords };
  for (const [key, rec] of Object.entries(fromSettings)) {
    if (!rec || typeof rec !== 'object') continue;
    const ex = merged[key];
    const recTime = Date.parse(rec.updatedAt || '') || 0;
    const exTime = ex ? (Date.parse(ex.updatedAt || '') || 0) : -1;
    if (!ex || recTime >= exTime) {
      merged[key] = rec;
    }
  }
  return merged;
};

export const writeLocalStaffAttendanceRecords = (
  records: Record<string, StaffAttendanceRecord>
): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STAFF_ATTENDANCE_LOCAL_KEY, JSON.stringify(records));
  } catch {
    // ignore storage errors
  }
};

export const buildStaffAttendanceRecord = (params: {
  user: User;
  dateIso: string;
  status: StaffAttendanceStatus;
  checkInTime?: string;
  excuseText?: string;
  recordedBy?: string;
}): StaffAttendanceRecord => {
  const key = `${params.user.id}_${params.dateIso}`;
  return {
    id: key,
    userId: params.user.id,
    userName: params.user.name,
    userRole: params.user.role,
    date: params.dateIso,
    hijriDateFormatted: formatHijriDate(params.dateIso, { includeWeekday: true }),
    status: params.status,
    checkInTime:
      params.status === 'present'
        ? params.checkInTime || formatCurrentArabicTime()
        : params.checkInTime || '',
    excuseText: params.excuseText?.trim() || '',
    recordedBy: params.recordedBy || params.user.name,
    updatedAt: new Date().toISOString()
  };
};

// ============================================================================
// 24-Hour Staff Group Chat ("مساحة تواصل الكادر") & Pinned Announcement Helpers
// ============================================================================

export const STAFF_CHAT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
export const STAFF_CHAT_LOCAL_KEY = 'ghaith_staff_chat_messages_v1';
export const STAFF_CHAT_DELETED_LOCAL_KEY = 'ghaith_staff_chat_deleted_ids_v1';
export const STAFF_PINNED_ANNOUNCEMENT_LOCAL_KEY = 'ghaith_staff_pinned_announcement_v1';

/**
 * Exclusive Edit & Delete permission on Staff Chat messages and Pinned Announcement:
 * Strictly returns true ONLY when the logged-in user is ريفة المنصوري or أ. عمر عبدالرحمن (or developer).
 * Strictly returns false for all Supervisors (مشرفة حلقات) and Teachers (معلمة حلقة).
 */
export const canEditOrDeleteStaffChat = (
  user: Pick<User, 'id' | 'role' | 'name' | 'title' | 'email'> | null | undefined
): boolean => {
  if (!user) return false;
  if (user.role === 'supervisor' || user.role === 'teacher') return false;
  const email = (user.email || '').trim().toLowerCase();
  const name = (user.name || '').trim();
  const title = (user.title || '').trim();
  if (
    email === 'reef@ghaym.org' ||
    email === 'omar@ghaym.org' ||
    email === 'owner@ghaym.org' ||
    email === 'yr.play.com@gmail.com' ||
    name.includes('ريفة المنصوري') ||
    name.includes('عمر عبدالرحمن') ||
    user.role === 'owner' ||
    user.role === 'leader' ||
    user.role === 'developer' ||
    title.includes('مالك المنصة') ||
    title.includes('مؤسس غيث الغيم')
  ) {
    return true;
  }
  return false;
};

export const parseMessageCreatedAtMs = (msg: Partial<StaffChatMessage> | any): number => {
  if (!msg) return 0;
  if (typeof msg.createdAt === 'number' && Number.isFinite(msg.createdAt)) {
    return msg.createdAt;
  }
  if (typeof msg.createdAt === 'string') {
    const parsed = Number(msg.createdAt) || Date.parse(msg.createdAt);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (typeof msg.createdAtIso === 'string') {
    const parsed = Date.parse(msg.createdAtIso);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

export const readLocalDeletedStaffChatIds = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STAFF_CHAT_DELETED_LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
    }
  } catch {}
  return [];
};

export const writeLocalDeletedStaffChatIds = (ids: string[]): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STAFF_CHAT_DELETED_LOCAL_KEY, JSON.stringify([...new Set(ids.map(String))]));
  } catch {}
};

/**
 * Filters out deleted messages and messages older than 24 hours (Date.now() - msg.createdAt >= 24 * 60 * 60 * 1000),
 * deduplicating by ID and sorting chronologically.
 */
export const filterAndSortActiveStaffChatMessages = (
  messages: StaffChatMessage[] = [],
  deletedIds: string[] = [],
  nowMs: number = Date.now()
): StaffChatMessage[] => {
  if (!Array.isArray(messages)) return [];
  const deletedSet = new Set(deletedIds.map(String));
  const map = new Map<string, StaffChatMessage>();

  for (const rawMsg of messages) {
    if (!rawMsg || typeof rawMsg !== 'object' || !rawMsg.id) continue;
    const id = String(rawMsg.id);
    if (deletedSet.has(id)) continue;

    const createdAtMs = parseMessageCreatedAtMs(rawMsg);
    if (!createdAtMs || nowMs - createdAtMs >= STAFF_CHAT_TTL_MS) {
      continue; // Auto-delete messages older than 24 hours
    }

    const normalized: StaffChatMessage = {
      ...rawMsg,
      id,
      createdAt: createdAtMs
    };

    const existing = map.get(id);
    if (!existing) {
      map.set(id, normalized);
    } else {
      const existingUpdate = existing.editedAt || existing.createdAt || 0;
      const incomingUpdate = normalized.editedAt || normalized.createdAt || 0;
      map.set(id, incomingUpdate >= existingUpdate ? { ...existing, ...normalized } : { ...normalized, ...existing });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.createdAt - b.createdAt);
};

export const readLocalStaffChatMessages = (): StaffChatMessage[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STAFF_CHAT_LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
};

export const writeLocalStaffChatMessages = (messages: StaffChatMessage[]): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STAFF_CHAT_LOCAL_KEY, JSON.stringify(messages));
  } catch {}
};

export const readResolvedStaffChatMessages = (
  settings?: InstitutionSettings | null,
  nowMs: number = Date.now()
): StaffChatMessage[] => {
  const localDeleted = readLocalDeletedStaffChatIds();
  const settingsDeleted = Array.isArray(settings?.deletedStaffChatIds) ? settings!.deletedStaffChatIds! : [];
  const allDeleted = [...new Set([...localDeleted, ...settingsDeleted])];

  const localMsgs = readLocalStaffChatMessages();
  const settingsMsgs = Array.isArray(settings?.staffChatMessages) ? settings!.staffChatMessages! : [];

  return filterAndSortActiveStaffChatMessages([...localMsgs, ...settingsMsgs], allDeleted, nowMs);
};

export const DEFAULT_PINNED_STAFF_ANNOUNCEMENT: PinnedStaffAnnouncement = {
  text: 'يرجى من جميع المعلمات والمشرفات الالتزام بتسجيل التحضير اليومي فور بدء وقت الدوام، ومراجعة المهام اليومية المسندة.',
  updatedAt: 0,
  updatedBy: 'إدارة المقرأة'
};

export const readLocalPinnedAnnouncement = (): PinnedStaffAnnouncement | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STAFF_PINNED_ANNOUNCEMENT_LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && typeof parsed.text === 'string') {
        return parsed;
      }
    }
  } catch {}
  return null;
};

export const writeLocalPinnedAnnouncement = (announcement: PinnedStaffAnnouncement): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STAFF_PINNED_ANNOUNCEMENT_LOCAL_KEY, JSON.stringify(announcement));
  } catch {}
};

export const resolvePinnedStaffAnnouncement = (
  settings?: InstitutionSettings | null
): PinnedStaffAnnouncement => {
  const localAnn = readLocalPinnedAnnouncement();
  const settingsAnn = settings?.pinnedStaffAnnouncement;

  if (localAnn && settingsAnn) {
    return (settingsAnn.updatedAt || 0) >= (localAnn.updatedAt || 0) ? settingsAnn : localAnn;
  }
  if (settingsAnn && typeof settingsAnn.text === 'string') return settingsAnn;
  if (localAnn && typeof localAnn.text === 'string') return localAnn;
  return DEFAULT_PINNED_STAFF_ANNOUNCEMENT;
};
