import {
  User,
  UserRole,
  InstitutionSettings,
  StaffTaskItem,
  StaffAttendanceRecord,
  StaffAttendanceStatus,
  StaffProfileConfig,
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
