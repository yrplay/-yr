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

/**
 * Strips undefined keys from a StaffProfileConfig so spreading never clobbers defined fields.
 */
const stripUndefinedProfileFields = (cfg: StaffProfileConfig): StaffProfileConfig => {
  const clean: StaffProfileConfig = {};
  if (typeof cfg.workingHours === 'string' && cfg.workingHours.trim()) {
    clean.workingHours = cfg.workingHours.trim();
  }
  if (typeof cfg.monthlySalary === 'number' && !isNaN(cfg.monthlySalary)) {
    clean.monthlySalary = cfg.monthlySalary;
  }
  if (Array.isArray(cfg.tasks)) {
    clean.tasks = cfg.tasks;
  }
  if (typeof cfg.leaderPrivateNotes === 'string') {
    clean.leaderPrivateNotes = cfg.leaderPrivateNotes;
  }
  if (typeof cfg.updatedAt === 'string' && cfg.updatedAt.trim()) {
    clean.updatedAt = cfg.updatedAt.trim();
  }
  return clean;
};

/**
 * Extracts a StaffProfileConfig map directly from the central `users` array.
 */
export const extractStaffProfilesFromUsers = (
  users?: User[] | null
): Record<string, StaffProfileConfig> => {
  const map: Record<string, StaffProfileConfig> = {};
  if (!Array.isArray(users)) return map;
  for (const u of users) {
    if (!u || !u.id) continue;
    const hasAnyField =
      (typeof u.workingHours === 'string' && u.workingHours.trim() !== '') ||
      (typeof u.monthlySalary === 'number' && !isNaN(u.monthlySalary)) ||
      Array.isArray(u.tasks) ||
      typeof u.leaderPrivateNotes === 'string';
    if (!hasAnyField) continue;
    map[u.id] = stripUndefinedProfileFields({
      workingHours: u.workingHours,
      monthlySalary: u.monthlySalary,
      tasks: u.tasks,
      leaderPrivateNotes: u.leaderPrivateNotes,
      updatedAt: u.updatedAt || u.createdAt
    });
  }
  return map;
};

/**
 * Merges multiple staff profile/operation maps by comparing `updatedAt` timestamps
 * per user so stale cloud or local state never overwrites newer workingHours, tasks, salary, or notes.
 * Also ensures `undefined` fields never overwrite defined fields.
 */
export const mergeStaffProfilesMap = (
  ...maps: Array<Record<string, StaffProfileConfig> | undefined | null>
): Record<string, StaffProfileConfig> => {
  const merged: Record<string, StaffProfileConfig> = {};
  for (const map of maps) {
    if (!map || typeof map !== 'object') continue;
    for (const [userId, rawCfg] of Object.entries(map)) {
      if (!rawCfg || typeof rawCfg !== 'object') continue;
      const cfg = stripUndefinedProfileFields(rawCfg);
      const existing = merged[userId];
      if (!existing) {
        merged[userId] = { ...cfg };
        continue;
      }
      const incTime = Date.parse(cfg.updatedAt || '') || 0;
      const exTime = Date.parse(existing.updatedAt || '') || 0;
      if (incTime >= exTime) {
        merged[userId] = {
          ...existing,
          ...cfg,
          updatedAt: cfg.updatedAt || existing.updatedAt
        };
      } else {
        merged[userId] = {
          ...cfg,
          ...existing,
          updatedAt: existing.updatedAt || cfg.updatedAt
        };
      }
    }
  }
  return merged;
};

/**
 * Merges multiple staff attendance record maps by comparing `updatedAt` timestamps,
 * preserving `_deleted: true` tombstones so deleted records are never resurrected by stale copies.
 */
export const mergeStaffAttendanceMap = (
  ...maps: Array<Record<string, StaffAttendanceRecord> | undefined | null>
): Record<string, StaffAttendanceRecord> => {
  const merged: Record<string, StaffAttendanceRecord> = {};
  for (const map of maps) {
    if (!map || typeof map !== 'object') continue;
    for (const [key, rec] of Object.entries(map)) {
      if (!rec || typeof rec !== 'object') continue;
      const ex = merged[key];
      const recTime = Date.parse(rec.updatedAt || '') || 0;
      const exTime = ex ? Date.parse(ex.updatedAt || '') || 0 : -1;
      if (!ex || recTime >= exTime) {
        merged[key] = rec;
      }
    }
  }
  return merged;
};

/**
 * Resolves the staff member's operational profile (`workingHours`, `monthlySalary`, `tasks`, `leaderPrivateNotes`)
 * from the central cloud-synced staff record (`user`) and `settings.staffOperations` / `settings.staffProfiles`.
 * CRITICAL: NEVER overwrites a staff member's `tasks` with default template tasks on page load.
 * Default template tasks are ONLY applied once when a brand-new staff member is first created.
 */
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
  const settingsProfileCfg = settings?.staffProfiles?.[user.id];
  const settingsOpsCfg = settings?.staffOperations?.[user.id];
  const userCfg: StaffProfileConfig = stripUndefinedProfileFields({
    workingHours: user.workingHours,
    monthlySalary: user.monthlySalary,
    tasks: user.tasks,
    leaderPrivateNotes: user.leaderPrivateNotes,
    updatedAt: user.updatedAt
  });

  // Merge in order from oldest fallback to newest timestamped source
  const resolvedMap = mergeStaffProfilesMap(
    localCfg ? { [user.id]: localCfg } : undefined,
    settingsProfileCfg ? { [user.id]: settingsProfileCfg } : undefined,
    settingsOpsCfg ? { [user.id]: settingsOpsCfg } : undefined,
    { [user.id]: userCfg }
  );
  const winner = resolvedMap[user.id] || {};

  const workingHours =
    winner.workingHours?.trim() ||
    user.workingHours?.trim() ||
    settingsOpsCfg?.workingHours?.trim() ||
    settingsProfileCfg?.workingHours?.trim() ||
    localCfg?.workingHours?.trim() ||
    getDefaultWorkingHoursForRole(user.role);

  const monthlySalary =
    typeof winner.monthlySalary === 'number' && !isNaN(winner.monthlySalary)
      ? winner.monthlySalary
      : typeof user.monthlySalary === 'number' && !isNaN(user.monthlySalary)
      ? user.monthlySalary
      : typeof settingsOpsCfg?.monthlySalary === 'number' && !isNaN(settingsOpsCfg.monthlySalary)
      ? settingsOpsCfg.monthlySalary
      : typeof settingsProfileCfg?.monthlySalary === 'number' && !isNaN(settingsProfileCfg.monthlySalary)
      ? settingsProfileCfg.monthlySalary
      : typeof localCfg?.monthlySalary === 'number' && !isNaN(localCfg.monthlySalary)
      ? localCfg.monthlySalary
      : getDefaultMonthlySalaryForRole(user.role);

  // Strictly use the cloud-synced tasks array without falling back to default template tasks on page load
  const tasks: StaffTaskItem[] = Array.isArray(winner.tasks)
    ? winner.tasks
    : Array.isArray(user.tasks)
    ? user.tasks
    : Array.isArray(settingsOpsCfg?.tasks)
    ? settingsOpsCfg.tasks
    : Array.isArray(settingsProfileCfg?.tasks)
    ? settingsProfileCfg.tasks
    : Array.isArray(localCfg?.tasks)
    ? localCfg.tasks
    : [];

  const leaderPrivateNotes =
    typeof winner.leaderPrivateNotes === 'string'
      ? winner.leaderPrivateNotes
      : typeof user.leaderPrivateNotes === 'string'
      ? user.leaderPrivateNotes
      : typeof settingsOpsCfg?.leaderPrivateNotes === 'string'
      ? settingsOpsCfg.leaderPrivateNotes
      : typeof settingsProfileCfg?.leaderPrivateNotes === 'string'
      ? settingsProfileCfg.leaderPrivateNotes
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

/**
 * Reads the raw staff attendance map INCLUDING `_deleted: true` tombstones
 * so deletions propagate cleanly across cloud sync and local storage merges.
 */
export const readRawStaffAttendanceMap = (
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
  return mergeStaffAttendanceMap(localRecords, settings?.staffAttendanceRecords);
};

/**
 * Returns only active (non-deleted) staff attendance records for UI tables and monthly counters.
 */
export const readAllStaffAttendanceRecords = (
  settings?: InstitutionSettings
): Record<string, StaffAttendanceRecord> => {
  const rawMerged = readRawStaffAttendanceMap(settings);
  const activeOnly: Record<string, StaffAttendanceRecord> = {};
  for (const [key, rec] of Object.entries(rawMerged)) {
    if (!rec || rec._deleted === true) continue;
    activeOnly[key] = rec;
  }
  return activeOnly;
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
    _deleted: false,
    updatedAt: new Date().toISOString()
  };
};

export const buildDeletedStaffAttendanceTombstone = (params: {
  user: User;
  dateIso: string;
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
    status: 'present',
    checkInTime: '',
    excuseText: '',
    recordedBy: params.recordedBy || 'إدارة المنصة',
    _deleted: true,
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
  nowMs: number = Date.now(),
  users?: User[] | null
): StaffChatMessage[] => {
  const localDeleted = readLocalDeletedStaffChatIds();
  const settingsDeleted = Array.isArray(settings?.deletedStaffChatIds) ? settings!.deletedStaffChatIds! : [];
  const usersDeleted: string[] = [];
  const usersMsgs: StaffChatMessage[] = [];
  if (Array.isArray(users)) {
    for (const u of users) {
      if (Array.isArray(u?.deletedStaffChatIds)) {
        usersDeleted.push(...u.deletedStaffChatIds);
      }
      if (Array.isArray(u?.staffChatMessages)) {
        usersMsgs.push(...u.staffChatMessages);
      }
    }
  }
  const allDeleted = [...new Set([...localDeleted, ...settingsDeleted, ...usersDeleted])];

  const localMsgs = readLocalStaffChatMessages();
  const settingsMsgs = Array.isArray(settings?.staffChatMessages) ? settings!.staffChatMessages! : [];

  return filterAndSortActiveStaffChatMessages([...localMsgs, ...settingsMsgs, ...usersMsgs], allDeleted, nowMs);
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
  settings?: InstitutionSettings | null,
  users?: User[] | null
): PinnedStaffAnnouncement => {
  const candidates: PinnedStaffAnnouncement[] = [];
  const localAnn = readLocalPinnedAnnouncement();
  if (localAnn && typeof localAnn.text === 'string') {
    candidates.push(localAnn);
  }
  const settingsAnn = settings?.pinnedStaffAnnouncement;
  if (settingsAnn && typeof settingsAnn.text === 'string') {
    candidates.push(settingsAnn);
  }
  if (Array.isArray(users)) {
    for (const u of users) {
      if (u?.pinnedStaffAnnouncement && typeof u.pinnedStaffAnnouncement.text === 'string') {
        candidates.push(u.pinnedStaffAnnouncement);
      }
    }
  }

  if (candidates.length === 0) {
    return DEFAULT_PINNED_STAFF_ANNOUNCEMENT;
  }

  let newest = candidates[0];
  for (const c of candidates) {
    if ((c.updatedAt || 0) >= (newest.updatedAt || 0)) {
      newest = c;
    }
  }
  return newest;
};

