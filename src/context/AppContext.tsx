import React, { createContext, useContext, useState, useEffect, useMemo, useRef, ReactNode } from 'react';
import {
  User, Track, Circle, Student, MonthlyPlan, StudentMonthlyPlan,
  DailyRecord, AttendanceRecord, AtqiniAssignment, StudentAtqiniSubmission,
  Challenge, StudentChallengeSubmission, MonthlyExam, StudentExamResult,
  TrackGradingConfig, InstitutionSettings, AuditLog, StudentSubscription,
  TrackSystemRules
} from '../types';
import initialData from '../data/initialData';
import { subscribeToCloudDatabase, pushStateToCloud, CloudSyncStatus } from '../services/cloudSync';
import { summarizeDailyPageProgress } from '../services/recitationProgress';
import { doc, getDoc } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '../firebase';
import { isLocalDemoMode } from '../demoMode';

export interface StudentScoreSummary {
  studentId: string;
  attendanceScore: number;
  attendanceMax: number;
  attendanceRate: number;
  presentCount: number;
  lateCount: number;
  absentUnexcusedCount: number;
  absentExcusedCount: number;
  earlyPrepCount: number;
  perfectWeeksCount: number;
  
  memorizationScore: number;
  memorizationMax: number;
  newMemorizationPagesDone: number;
  newMemorizationPagesTarget: number;
  revisionPagesDone: number;
  revisionPagesTarget: number;
  minorRevisionPagesDone: number;
  tamkeenRevisionPagesDone: number;
  unclassifiedRevisionPagesDone: number;
  memorizationMistakesTotal: number;
  hintsTotal: number;
  tajweedErrorsTotal: number;
  
  conditionsFulfilledScore: number;
  conditionsMax: number;
  conditionsDistinctionCount: number;
  
  atqiniScore: number;
  atqiniMax: number;
  atqiniCompletedCount: number;
  
  challengesScore: number;
  challengesMax: number;
  peerReviewScore: number;
  
  examScore: number;
  examMax: number;
  
  totalEarnedPoints: number;
  totalPossiblePoints: number;
  finalPercentage: number;
  gradeLabel: string;
  gradeLetter: string;
  gradeColor: string;
  rankInCircle: number;
  rankInTrack: number;
  hasUnrecordedLogs: boolean;
  hasFrequentAbsence: boolean;
}

interface AppContextType {
  currentUser: User | null;
  users: User[];
  tracks: Track[];
  circles: Circle[];
  students: Student[];
  monthlyPlans: MonthlyPlan[];
  studentPlans: StudentMonthlyPlan[];
  dailyRecords: DailyRecord[];
  dailyRecitations?: any[];
  attendanceRecords: AttendanceRecord[];
  atqiniAssignments: AtqiniAssignment[];
  studentAtqiniSubmissions: StudentAtqiniSubmission[];
  challenges: Challenge[];
  studentChallengeSubmissions: StudentChallengeSubmission[];
  monthlyExams: MonthlyExam[];
  studentExamResults: StudentExamResult[];
  gradingConfigs: TrackGradingConfig[];
  studentSubscriptions: StudentSubscription[];
  settings: InstitutionSettings;
  auditLogs: AuditLog[];
  loading: boolean;
  error: string | null;
  
  refreshData: () => Promise<void>;
  switchUser: (userId: string) => Promise<boolean>;
  
  selectedTrackId: string | null;
  setSelectedTrackId: (id: string | null) => void;
  createTrack: (track: Partial<Track>) => Promise<Track>;
  updateTrack: (id: string, track: Partial<Track>) => Promise<void>;
  updateTrackSystemRules: (trackId: string, rules: Partial<TrackSystemRules>) => Promise<void>;
  archiveTrack: (id: string) => Promise<void>;
  restoreTrack: (id: string) => Promise<void>;
  createCircle: (circle: Partial<Circle>) => Promise<Circle>;
  updateCircle: (id: string, circle: Partial<Circle>) => Promise<void>;
  archiveCircle: (id: string) => Promise<void>;
  restoreCircle: (id: string) => Promise<void>;
  
  createStudent: (student: Partial<Student>) => Promise<Student>;
  updateStudent: (id: string, student: Partial<Student>) => Promise<void>;
  archiveStudent: (id: string) => Promise<void>;
  deleteStudent: (id: string) => Promise<void>;
  assignPartner: (studentId: string, partnerId: string | null) => Promise<void>;
  
  createMonthlyPlan: (plan: Partial<MonthlyPlan>) => Promise<MonthlyPlan>;
  updateMonthlyPlan: (id: string, plan: Partial<MonthlyPlan>) => Promise<void>;
  duplicateMonthlyPlan: (id: string) => Promise<void>;
  saveStudentPlan: (plan: Partial<StudentMonthlyPlan>) => Promise<void>;
  
  saveDailyRecord: (record: Partial<DailyRecord>) => Promise<void>;
  saveDailyRecitation?: (record: any) => Promise<void>;
  saveAttendance: (record: Partial<AttendanceRecord>) => Promise<void>;
  saveBulkAttendance: (records: Partial<AttendanceRecord>[]) => Promise<void>;
  
  saveStudentSubscription: (sub: Partial<StudentSubscription>) => Promise<void>;

  createAtqiniAssignment: (assignment: Partial<AtqiniAssignment>) => Promise<AtqiniAssignment>;
  updateAtqiniAssignment: (id: string, assignment: Partial<AtqiniAssignment>) => Promise<void>;
  deleteAtqiniAssignment: (id: string) => Promise<void>;
  saveAtqiniSubmission: (sub: Partial<StudentAtqiniSubmission>) => Promise<void>;
  
  createChallenge: (challenge: Partial<Challenge>) => Promise<Challenge>;
  updateChallenge: (id: string, challenge: Partial<Challenge>) => Promise<void>;
  deleteChallenge: (id: string) => Promise<void>;
  saveChallengeSubmission: (sub: Partial<StudentChallengeSubmission>) => Promise<void>;
  
  createMonthlyExam: (exam: Partial<MonthlyExam>) => Promise<MonthlyExam>;
  updateMonthlyExam: (id: string, exam: Partial<MonthlyExam>) => Promise<void>;
  deleteMonthlyExam: (id: string) => Promise<void>;
  saveExamResult: (result: Partial<StudentExamResult>) => Promise<void>;
  
  updateGradingConfig: (trackId: string, config: Partial<TrackGradingConfig>) => Promise<void>;
  updateSettings: (settings: Partial<InstitutionSettings>) => Promise<void>;
  downloadBackup: () => void;
  restoreBackup: (backupData: any) => Promise<boolean>;
  resetSampleData: () => Promise<void>;

  createUser: (user: Partial<User>) => Promise<User>;
  updateUser: (id: string, user: Partial<User>) => Promise<void>;
  changeUserPasscode: (userId: string, newPasscode: string) => Promise<boolean>;
  
  getStudentScoreSummary: (studentId: string) => StudentScoreSummary;
  allStudentScores: Record<string, StudentScoreSummary>;
  
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;

  lastSynced: Date;
  cloudStatus: CloudSyncStatus;
  syncNow: () => Promise<void>;
  switchToLeader: () => Promise<void>;

  quickModalAction: { type: string; timestamp: number } | null;
  triggerQuickModal: (type: string) => void;
  clearQuickModal: () => void;

  theme: 'light' | 'dark';
  isDarkMode: boolean;
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);
const STORAGE_KEY = isLocalDemoMode ? 'ghaith_demo_db_v1' : 'ghaith_alghaym_db_v1';
const CURRENT_USER_KEY = isLocalDemoMode ? 'ghaith_demo_current_user_id' : 'ghaith_current_user_id';
const GRADING_CONFIGS_KEY = isLocalDemoMode ? 'ghaith_demo_grading_configs' : 'ghaith_grading_configs';

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const defaultLeader: User = (initialData.users?.[0] as unknown as User) || {
    id: 'u-1',
    name: 'ريفة المنصوري',
    role: 'leader',
    title: 'قائدة المقرأة',
    phone: '0500000001',
    email: 'leader@ghaym.org',
    circleIds: [],
    isArchived: false,
    createdAt: new Date().toISOString()
  };

  const getCachedDb = () => {
    if (typeof window !== 'undefined') {
      try {
        for (const storage of [localStorage, sessionStorage]) {
          const obsoleteKeys: string[] = [];
          for (let index = 0; index < storage.length; index++) {
            const key = storage.key(index);
            if (key?.startsWith('ghaith_pin_') || key === 'ghaith_authenticated' || key === 'ghaith_gate_authorized') {
              obsoleteKeys.push(key);
            }
          }
          obsoleteKeys.forEach(key => storage.removeItem(key));
        }
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            if (Array.isArray(parsed.users)) {
              parsed.users = parsed.users.map(({ passcode: _passcode, ...user }: any) => user);
            }
            if (parsed.currentUser && typeof parsed.currentUser === 'object') {
              const { passcode: _passcode, ...safeCurrentUser } = parsed.currentUser;
              parsed.currentUser = safeCurrentUser;
            }
            if (parsed.settings && typeof parsed.settings === 'object') delete parsed.settings.leaderPasscode;
            localStorage.setItem('ghaith_alghaym_db_v1', JSON.stringify(parsed));
            return parsed;
          }
        }
      } catch {}
    }
    return null;
  };

  const initialCached = getCachedDb();

  const getCachedArray = <T,>(key: string, fallback: T[]): T[] =>
    Array.isArray(initialCached?.[key]) ? initialCached[key] as T[] : fallback;

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    if (isLocalDemoMode) return defaultLeader;
    if (typeof window !== 'undefined') {
      try {
        const savedId = localStorage.getItem(CURRENT_USER_KEY) || sessionStorage.getItem(CURRENT_USER_KEY);
        const userPool = Array.isArray(initialCached?.users) ? initialCached.users : initialData.users;
        if (savedId && Array.isArray(userPool)) {
          const found = (userPool as unknown as User[]).find(u => u.id === savedId);
          if (found) return found;
        }
      } catch {}
    }
    return (initialCached?.currentUser as User) || defaultLeader;
  });

  const [users, setUsers] = useState<User[]>(() => {
    return getCachedArray<User>('users', initialData.users as unknown as User[]);
  });
  const [tracks, setTracks] = useState<Track[]>(() => {
    return getCachedArray<Track>('tracks', initialData.tracks as unknown as Track[]);
  });
  const [circles, setCircles] = useState<Circle[]>(() => {
    return getCachedArray<Circle>('circles', initialData.circles as unknown as Circle[]);
  });
  const [students, setStudents] = useState<Student[]>(() => {
    return getCachedArray<Student>('students', initialData.students as unknown as Student[]);
  });
  const [monthlyPlans, setMonthlyPlans] = useState<MonthlyPlan[]>(() => {
    return getCachedArray<MonthlyPlan>('monthlyPlans', initialData.monthlyPlans as unknown as MonthlyPlan[]);
  });
  const [studentPlans, setStudentPlans] = useState<StudentMonthlyPlan[]>(() => {
    return getCachedArray<StudentMonthlyPlan>('studentPlans', initialData.studentPlans as unknown as StudentMonthlyPlan[]);
  });
  const [dailyRecords, setDailyRecords] = useState<DailyRecord[]>(() => {
    return getCachedArray<DailyRecord>('dailyRecords', initialData.dailyRecords as unknown as DailyRecord[]);
  });
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() => {
    return getCachedArray<AttendanceRecord>('attendanceRecords', initialData.attendanceRecords as unknown as AttendanceRecord[]);
  });
  const [atqiniAssignments, setAtqiniAssignments] = useState<AtqiniAssignment[]>(() => {
    return getCachedArray<AtqiniAssignment>('atqiniAssignments', initialData.atqiniAssignments as unknown as AtqiniAssignment[]);
  });
  const [studentAtqiniSubmissions, setStudentAtqiniSubmissions] = useState<StudentAtqiniSubmission[]>(() => {
    return getCachedArray<StudentAtqiniSubmission>('studentAtqiniSubmissions', initialData.studentAtqiniSubmissions as unknown as StudentAtqiniSubmission[]);
  });
  const [challenges, setChallenges] = useState<Challenge[]>(() => {
    return getCachedArray<Challenge>('challenges', initialData.challenges as unknown as Challenge[]);
  });
  const [studentChallengeSubmissions, setStudentChallengeSubmissions] = useState<StudentChallengeSubmission[]>(() => {
    return getCachedArray<StudentChallengeSubmission>('studentChallengeSubmissions', initialData.studentChallengeSubmissions as unknown as StudentChallengeSubmission[]);
  });
  const [monthlyExams, setMonthlyExams] = useState<MonthlyExam[]>(() => {
    return getCachedArray<MonthlyExam>('monthlyExams', initialData.monthlyExams as unknown as MonthlyExam[]);
  });
  const [studentExamResults, setStudentExamResults] = useState<StudentExamResult[]>(() => {
    return getCachedArray<StudentExamResult>('studentExamResults', initialData.studentExamResults as unknown as StudentExamResult[]);
  });
  const [studentSubscriptions, setStudentSubscriptions] = useState<StudentSubscription[]>(() => {
    return getCachedArray<StudentSubscription>(
      'studentSubscriptions',
      (initialData.studentSubscriptions || []) as unknown as StudentSubscription[]
    );
  });
  const [gradingConfigs, setGradingConfigs] = useState<TrackGradingConfig[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(GRADING_CONFIGS_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {}
    }
    return getCachedArray<TrackGradingConfig>('gradingConfigs', initialData.gradingConfigs as unknown as TrackGradingConfig[]);
  });
  const [settings, setSettings] = useState<InstitutionSettings>(() => {
    const baseSettings: InstitutionSettings = {
      name: "غيث الغيم",
      leaderName: "ريفة المنصوري",
      subtitle: "المقرأة القرآنية النموذجية",
      motto: "غيثٌ يهمي على القلوب ليحيي بها معالم الوحي والرسوخ",
      academicYear: "١٤٤٦ - ١٤٤٧ هـ",
      currentHijriMonth: "ربيع الآخر - جمادى الأولى",
      supportEmail: "info@ghaym.org",
      supportPhone: "0500000001",
      securityEnabled: true
    };
    return initialCached?.settings ? { ...baseSettings, ...initialCached.settings } : baseSettings;
  });
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    return initialCached?.auditLogs || initialData.auditLogs || [];
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [lastSynced, setLastSynced] = useState<Date>(new Date());
  const [cloudStatus, setCloudStatus] = useState<CloudSyncStatus>(isLocalDemoMode ? 'offline' : 'connected');
  const [quickModalAction, setQuickModalAction] = useState<{ type: string; timestamp: number } | null>(null);

  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ghaith_theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const root = document.documentElement;
      if (theme === 'dark') {
        root.classList.add('dark');
        root.setAttribute('data-theme', 'dark');
        root.style.colorScheme = 'dark';
      } else {
        root.classList.remove('dark');
        root.setAttribute('data-theme', 'light');
        root.style.colorScheme = 'light';
      }
      localStorage.setItem('ghaith_theme', theme);
    }
  }, [theme]);

  const toggleTheme = () => setThemeState(prev => (prev === 'light' ? 'dark' : 'light'));
  const setTheme = (newTheme: 'light' | 'dark') => setThemeState(newTheme);
  const isDarkMode = theme === 'dark';

  const triggerQuickModal = (type: string) => setQuickModalAction({ type, timestamp: Date.now() });
  const clearQuickModal = () => setQuickModalAction(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const masterStateRef = useRef<any>({
    currentUser: initialCached?.currentUser || defaultLeader,
    users: getCachedArray('users', initialData.users || []),
    tracks: getCachedArray('tracks', initialData.tracks || []),
    circles: getCachedArray('circles', initialData.circles || []),
    students: getCachedArray('students', initialData.students || []),
    monthlyPlans: getCachedArray('monthlyPlans', initialData.monthlyPlans || []),
    studentPlans: getCachedArray('studentPlans', initialData.studentPlans || []),
    dailyRecords: getCachedArray('dailyRecords', initialData.dailyRecords || []),
    attendanceRecords: getCachedArray('attendanceRecords', initialData.attendanceRecords || []),
    atqiniAssignments: getCachedArray('atqiniAssignments', initialData.atqiniAssignments || []),
    studentAtqiniSubmissions: getCachedArray('studentAtqiniSubmissions', initialData.studentAtqiniSubmissions || []),
    challenges: getCachedArray('challenges', initialData.challenges || []),
    studentChallengeSubmissions: getCachedArray('studentChallengeSubmissions', initialData.studentChallengeSubmissions || []),
    monthlyExams: getCachedArray('monthlyExams', initialData.monthlyExams || []),
    studentExamResults: getCachedArray('studentExamResults', initialData.studentExamResults || []),
    studentSubscriptions: getCachedArray('studentSubscriptions', (initialData.studentSubscriptions || []) as unknown as StudentSubscription[]),
    gradingConfigs: getCachedArray('gradingConfigs', initialData.gradingConfigs || []),
    _deletedEntities: initialCached?._deletedEntities || {},
    settings: initialCached?.settings ? {
      name: "غيث الغيم",
      leaderName: "ريفة المنصوري",
      subtitle: "المقرأة القرآنية النموذجية",
      motto: "غيثٌ يهمي على القلوب ليحيي بها معالم الوحي والرسوخ",
      academicYear: "١٤٤٦ - ١٤٤٧ هـ",
      currentHijriMonth: "ربيع الآخر - جمادى الأولى",
      supportEmail: "info@ghaym.org",
      supportPhone: "0500000001",
      securityEnabled: true,
      ...initialCached.settings
    } : {
      name: "غيث الغيم",
      leaderName: "ريفة المنصوري",
      subtitle: "المقرأة القرآنية النموذجية",
      motto: "غيثٌ يهمي على القلوب ليحيي بها معالم الوحي والرسوخ",
      academicYear: "١٤٤٦ - ١٤٤٧ هـ",
      currentHijriMonth: "ربيع الآخر - جمادى الأولى",
      supportEmail: "info@ghaym.org",
      supportPhone: "0500000001",
      securityEnabled: true,
    },
    auditLogs: initialCached?.auditLogs || initialData.auditLogs || []
  });

  const mergeEntities = <T extends Record<string, any>>(
    localList: T[] = [],
    incomingList: T[] = [],
    idKey: string = 'id'
  ): T[] => {
    const map = new Map<string, T>();
    for (const inc of incomingList) {
      if (inc && inc[idKey] !== undefined) map.set(String(inc[idKey]), inc);
    }
    for (const loc of localList) {
      if (!loc || loc[idKey] === undefined) continue;
      const key = String(loc[idKey]);
      const inc = map.get(key);
      if (!inc) {
        map.set(key, loc);
      } else {
        const locTime = (loc.updatedAt || loc.recordedAt || loc.createdAt)
          ? new Date(loc.updatedAt || loc.recordedAt || loc.createdAt).getTime()
          : 0;
        const incTime = (inc.updatedAt || inc.recordedAt || inc.createdAt)
          ? new Date(inc.updatedAt || inc.recordedAt || inc.createdAt).getTime()
          : 0;
        map.set(key, locTime >= incTime ? { ...inc, ...loc } : { ...loc, ...inc });
      }
    }
    return Array.from(map.values());
  };

  const mergeDeletedEntityMaps = (...maps: Array<Record<string, string[]> | undefined>) => {
    const merged: Record<string, string[]> = {};
    for (const source of maps) {
      if (!source || typeof source !== 'object') continue;
      for (const [collection, ids] of Object.entries(source)) {
        if (!Array.isArray(ids)) continue;
        merged[collection] = [...new Set([...(merged[collection] || []), ...ids.map(String)])];
      }
    }
    return merged;
  };

  const addDeletedEntity = (collection: string, id: string) => mergeDeletedEntityMaps(
    masterStateRef.current._deletedEntities,
    { [collection]: [id] }
  );

  const mergeDailyRecords = (localRecs: DailyRecord[] = [], incomingRecs: DailyRecord[] = []): DailyRecord[] => {
    const map = new Map<string, DailyRecord>();
    for (const inc of incomingRecs) {
      const key = inc.id || `dr_${inc.studentId}_${inc.date}`;
      map.set(key, inc);
    }
    for (const loc of localRecs) {
      const key = loc.id || `dr_${loc.studentId}_${loc.date}`;
      const inc = map.get(key);
      if (!inc) {
        map.set(key, loc);
      } else {
        const incTime = inc.recordedAt ? new Date(inc.recordedAt).getTime() : 0;
        const locTime = loc.recordedAt ? new Date(loc.recordedAt).getTime() : 0;
        map.set(key, locTime >= incTime ? loc : inc);
      }
    }
    return Array.from(map.values());
  };

  const mergeStudentPlans = (localPlans: StudentMonthlyPlan[] = [], incomingPlans: StudentMonthlyPlan[] = []): StudentMonthlyPlan[] => {
    const map = new Map<string, StudentMonthlyPlan>();
    for (const inc of incomingPlans) {
      const key = inc.id || `sp_${inc.studentId}_${inc.monthlyPlanId}`;
      map.set(key, inc);
    }
    for (const loc of localPlans) {
      const key = loc.id || `sp_${loc.studentId}_${loc.monthlyPlanId}`;
      const inc = map.get(key);
      if (!inc) map.set(key, loc);
      else map.set(key, { ...inc, ...loc });
    }
    return Array.from(map.values());
  };

  const mergeAttendanceRecords = (localAtt: AttendanceRecord[] = [], incomingAtt: AttendanceRecord[] = []): AttendanceRecord[] => {
    const map = new Map<string, AttendanceRecord>();
    for (const inc of incomingAtt) {
      const key = inc.id || `att_${inc.studentId}_${inc.date}`;
      map.set(key, inc);
    }
    for (const loc of localAtt) {
      const key = loc.id || `att_${loc.studentId}_${loc.date}`;
      const inc = map.get(key);
      if (!inc) map.set(key, loc);
      else map.set(key, { ...inc, ...loc });
    }
    return Array.from(map.values());
  };

  const mergeSubscriptions = (localSubs: StudentSubscription[] = [], incomingSubs: StudentSubscription[] = []): StudentSubscription[] => {
    const map = new Map<string, StudentSubscription>();
    for (const inc of incomingSubs) {
      const key = inc.id || `sub_${inc.studentId}_${inc.cycleMonth}`;
      map.set(key, inc);
    }
    for (const loc of localSubs) {
      const key = loc.id || `sub_${loc.studentId}_${loc.cycleMonth}`;
      map.set(key, loc);
    }
    return Array.from(map.values());
  };

  const applyState = (incomingData: any) => {
    if (!incomingData || typeof incomingData !== 'object') return;

    const deletedEntities = mergeDeletedEntityMaps(
      masterStateRef.current._deletedEntities,
      incomingData._deletedEntities
    );
    const data = { ...incomingData, _deletedEntities: deletedEntities };
    const sanitizeUser = (user: any) => {
      if (!user || typeof user !== 'object') return user;
      const { passcode: _passcode, ...safeUser } = user;
      return safeUser;
    };
    if (Array.isArray(data.users)) data.users = data.users.map(sanitizeUser);
    if (Array.isArray(masterStateRef.current.users)) masterStateRef.current.users = masterStateRef.current.users.map(sanitizeUser);
    if (data.currentUser) data.currentUser = sanitizeUser(data.currentUser);
    if (masterStateRef.current.currentUser) masterStateRef.current.currentUser = sanitizeUser(masterStateRef.current.currentUser);
    if (data.settings && typeof data.settings === 'object') delete data.settings.leaderPasscode;
    if (masterStateRef.current.settings && typeof masterStateRef.current.settings === 'object') {
      delete masterStateRef.current.settings.leaderPasscode;
    }
    for (const [collection, deletedIds] of Object.entries(deletedEntities)) {
      const deleted = new Set(deletedIds.map(String));
      if (Array.isArray(masterStateRef.current[collection])) {
        masterStateRef.current[collection] = masterStateRef.current[collection].filter(
          (item: any) => !deleted.has(String(collection === 'gradingConfigs' ? item.trackId : item.id))
        );
      }
      if (Array.isArray(data[collection])) {
        data[collection] = data[collection].filter(
          (item: any) => !deleted.has(String(collection === 'gradingConfigs' ? item.trackId : item.id))
        );
      }
    }
    
    const {
      dailyRecords: incomingDaily,
      studentPlans: incomingPlans,
      attendanceRecords: incomingAtt,
      studentSubscriptions: incomingSubs,
      tracks: incomingTracks,
      circles: incomingCircles,
      students: incomingStudents,
      monthlyPlans: incomingMonthlyPlans,
      atqiniAssignments: incomingAtqini,
      challenges: incomingChallenges,
      monthlyExams: incomingExams,
      studentAtqiniSubmissions: incomingAtqSubmissions,
      studentChallengeSubmissions: incomingChSubmissions,
      studentExamResults: incomingExamResults,
      gradingConfigs: incomingGrading,
      ...restData
    } = data;

    masterStateRef.current = {
      ...masterStateRef.current,
      ...restData,
      _deletedEntities: deletedEntities
    };

    const activeUserId = typeof window !== 'undefined'
      ? (localStorage.getItem(CURRENT_USER_KEY) || sessionStorage.getItem(CURRENT_USER_KEY))
      : null;

    const userList: User[] = Array.isArray(data.users) && data.users.length > 0
      ? mergeEntities(masterStateRef.current.users, data.users)
      : masterStateRef.current.users;
    
    if (activeUserId) {
      const found = userList.find(u => u.id === activeUserId);
      if (found) setCurrentUser(found);
      else if (data.currentUser) setCurrentUser(data.currentUser);
      else setCurrentUser(prev => prev || userList[0] || defaultLeader);
    } else if (data.currentUser) {
      setCurrentUser(data.currentUser);
    } else {
      setCurrentUser(prev => prev || userList[0] || defaultLeader);
    }

    if (Array.isArray(data.users) && data.users.length > 0) {
      masterStateRef.current.users = userList;
      setUsers(userList);
      if (typeof window !== 'undefined') {
        localStorage.setItem('ghaith_staff_users', JSON.stringify(userList));
      }
    }

    if (Array.isArray(incomingTracks)) {
      const mergedTracks = mergeEntities(masterStateRef.current.tracks, incomingTracks);
      masterStateRef.current.tracks = mergedTracks;
      setTracks(mergedTracks);
    }

    if (Array.isArray(incomingCircles)) {
      const normalizedCircles = incomingCircles.map((c: any) => {
        const t = userList.find(u => u.id === c.teacherId);
        const s = userList.find(u => u.id === c.supervisorId);
        return {
          ...c,
          teacherName: t ? t.name : (c.teacherName || 'غير محدد'),
          supervisorName: s ? s.name : (c.supervisorName || 'غير محدد')
        };
      });
      const mergedCircles = mergeEntities(masterStateRef.current.circles, normalizedCircles);
      masterStateRef.current.circles = mergedCircles;
      setCircles(mergedCircles);
    }

    if (Array.isArray(incomingStudents)) {
      const mergedStudents = mergeEntities(masterStateRef.current.students, incomingStudents);
      masterStateRef.current.students = mergedStudents;
      setStudents(mergedStudents);
    }

    if (Array.isArray(incomingMonthlyPlans)) {
      const mergedPlans = mergeEntities(masterStateRef.current.monthlyPlans, incomingMonthlyPlans);
      masterStateRef.current.monthlyPlans = mergedPlans;
      setMonthlyPlans(mergedPlans);
    }

    if (Array.isArray(incomingPlans)) {
      const mergedPlans = mergeStudentPlans(masterStateRef.current.studentPlans, incomingPlans);
      masterStateRef.current.studentPlans = mergedPlans;
      setStudentPlans(mergedPlans);
    }

    if (Array.isArray(incomingDaily)) {
      const mergedDaily = mergeDailyRecords(masterStateRef.current.dailyRecords, incomingDaily);
      masterStateRef.current.dailyRecords = mergedDaily;
      setDailyRecords(mergedDaily);
    }

    if (Array.isArray(incomingAtt)) {
      const mergedAtt = mergeAttendanceRecords(masterStateRef.current.attendanceRecords, incomingAtt);
      masterStateRef.current.attendanceRecords = mergedAtt;
      setAttendanceRecords(mergedAtt);
    }

    if (Array.isArray(incomingSubs)) {
      const merged = mergeSubscriptions(masterStateRef.current.studentSubscriptions, incomingSubs);
      masterStateRef.current.studentSubscriptions = merged;
      setStudentSubscriptions(merged);
    }

    if (Array.isArray(incomingAtqini)) {
      const mergedAtq = mergeEntities(masterStateRef.current.atqiniAssignments, incomingAtqini);
      masterStateRef.current.atqiniAssignments = mergedAtq;
      setAtqiniAssignments(mergedAtq);
    }

    if (Array.isArray(incomingAtqSubmissions)) {
      const mergedAtqSubs = mergeEntities(masterStateRef.current.studentAtqiniSubmissions, incomingAtqSubmissions);
      masterStateRef.current.studentAtqiniSubmissions = mergedAtqSubs;
      setStudentAtqiniSubmissions(mergedAtqSubs);
    }

    if (Array.isArray(incomingChallenges)) {
      const mergedChallenges = mergeEntities(masterStateRef.current.challenges, incomingChallenges);
      masterStateRef.current.challenges = mergedChallenges;
      setChallenges(mergedChallenges);
    }

    if (Array.isArray(incomingChSubmissions)) {
      const mergedChSubs = mergeEntities(masterStateRef.current.studentChallengeSubmissions, incomingChSubmissions);
      masterStateRef.current.studentChallengeSubmissions = mergedChSubs;
      setStudentChallengeSubmissions(mergedChSubs);
    }

    if (Array.isArray(incomingExams)) {
      const mergedExams = mergeEntities(masterStateRef.current.monthlyExams, incomingExams);
      masterStateRef.current.monthlyExams = mergedExams;
      setMonthlyExams(mergedExams);
    }

    if (Array.isArray(incomingExamResults)) {
      const mergedExamResults = mergeEntities(masterStateRef.current.studentExamResults, incomingExamResults);
      masterStateRef.current.studentExamResults = mergedExamResults;
      setStudentExamResults(mergedExamResults);
    }

    if (Array.isArray(incomingGrading)) {
      const mergedGrading = mergeEntities(masterStateRef.current.gradingConfigs, incomingGrading, 'trackId');
      masterStateRef.current.gradingConfigs = mergedGrading;
      setGradingConfigs(mergedGrading);
    }

    if (data.settings) {
      const mergedSettings = { ...masterStateRef.current.settings, ...data.settings };
      masterStateRef.current.settings = mergedSettings;
      setSettings(mergedSettings);
    }

    if (Array.isArray(data.auditLogs)) setAuditLogs(data.auditLogs);
    setLastSynced(new Date());
  };

  const persistState = (overrides?: any) => {
    try {
      const replaceCloudState = Boolean(overrides?._replaceState);
      const payload = {
        currentUser: masterStateRef.current.currentUser || currentUser,
        users: masterStateRef.current.users || users,
        tracks: masterStateRef.current.tracks || tracks,
        circles: masterStateRef.current.circles || circles,
        students: masterStateRef.current.students || students,
        monthlyPlans: masterStateRef.current.monthlyPlans || monthlyPlans,
        studentPlans: masterStateRef.current.studentPlans || studentPlans,
        dailyRecords: masterStateRef.current.dailyRecords || dailyRecords,
        attendanceRecords: masterStateRef.current.attendanceRecords || attendanceRecords,
        atqiniAssignments: masterStateRef.current.atqiniAssignments || atqiniAssignments,
        studentAtqiniSubmissions: masterStateRef.current.studentAtqiniSubmissions || studentAtqiniSubmissions,
        challenges: masterStateRef.current.challenges || challenges,
        studentChallengeSubmissions: masterStateRef.current.studentChallengeSubmissions || studentChallengeSubmissions,
        monthlyExams: masterStateRef.current.monthlyExams || monthlyExams,
        studentExamResults: masterStateRef.current.studentExamResults || studentExamResults,
        studentSubscriptions: masterStateRef.current.studentSubscriptions || studentSubscriptions,
        gradingConfigs: masterStateRef.current.gradingConfigs || gradingConfigs,
        _deletedEntities: masterStateRef.current._deletedEntities || {},
        settings: { ...(masterStateRef.current.settings || settings), ...(overrides?.settings || {}) },
        auditLogs: masterStateRef.current.auditLogs || auditLogs,
        ...overrides
      };
      delete payload._replaceState;

      masterStateRef.current = payload;

      try {
        if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch (storageError) {
        console.warn('LocalStorage save failed; continuing with cloud sync:', storageError);
      }

      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
      if (isLocalDemoMode) {
        setCloudStatus('offline');
        return;
      }
      
      syncTimeoutRef.current = setTimeout(() => {
        pushStateToCloud(replaceCloudState ? { ...payload, _replaceState: true } : payload)
          .then(() => setCloudStatus('connected'))
          .catch(error => {
            console.warn('Cloud save failed:', error);
            setCloudStatus('offline');
          });
      }, 1200);

    } catch (e) {
      console.error('Unable to build local/cloud state payload:', e);
      setCloudStatus('error');
    }
  };

  const refreshData = async () => {
    try {
      let loadedFromCache = false;
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
          try {
            const data = JSON.parse(cached);
            if (data && (Array.isArray(data.students) || Array.isArray(data.tracks))) {
              applyState(data);
              loadedFromCache = true;
            }
          } catch {}
        }
      }
      if (!loadedFromCache) applyState(initialData);
      setError(null);
    } catch (error) {
      console.warn('Failed to initialize cached state; using bundled starter data:', error);
      try { applyState(initialData); } catch {}
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  const syncNow = async () => {
    if (isLocalDemoMode) {
      setCloudStatus('offline');
      showToast('وضع معاينة محلي: لا توجد مزامنة مع Firebase', 'info');
      return;
    }
    setCloudStatus('syncing');
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    try {
      const payload = { ...masterStateRef.current };
      await pushStateToCloud(payload);
      setCloudStatus('connected');
      setLastSynced(new Date());
      showToast('تمت المزامنة السحابية بنجاح', 'success');
    } catch (error: any) {
      console.error('Manual cloud sync failed:', error);
      setCloudStatus('error');
      showToast('تعذرت المزامنة السحابية: ' + (error?.message || 'تحققي من الاتصال والصلاحيات'), 'error');
    }
  };

  useEffect(() => {
    refreshData();
    if (isLocalDemoMode) {
      setCloudStatus('offline');
      return () => {
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      };
    }
    const unsubscribeCloud = subscribeToCloudDatabase(
      (cloudData) => {
        if (cloudData && typeof cloudData === 'object' && (Array.isArray(cloudData.tracks) || Array.isArray(cloudData.students))) {
          applyState(cloudData);
          setCloudStatus('connected');
          setLastSynced(new Date());
        } else {
          persistState();
          setCloudStatus('connected');
        }
      },
      (status) => setCloudStatus(status)
    );
    return () => {
      if (unsubscribeCloud) unsubscribeCloud();
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, []);

  const switchToLeader = async () => {
    showToast('تبديل الأدوار داخل الجلسة غير مسموح؛ سجّلي الخروج ثم ادخلي بحساب الإدارة', 'info');
  };

  const switchUser = async (userId: string) => {
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) throw new Error('يجب تسجيل الدخول عبر Firebase Auth أولاً');
      const accessSnapshot = await getDoc(doc(db, 'staff_access', firebaseUser.uid));
      const access = accessSnapshot.exists() ? accessSnapshot.data() : null;
      const storedUser = users.find(user => user.id === userId);
      if (!storedUser) throw new Error('ملف الموظفة غير موجود في بيانات المؤسسة');
      const staffId = typeof access?.staffId === 'string' ? access.staffId.trim().toLowerCase() : '';
      const matchesStaff = staffId === userId.toLowerCase()
        || (!!storedUser.email && staffId === storedUser.email.trim().toLowerCase());
      if (!access || access.active !== true || !matchesStaff) {
        throw new Error('هذا الحساب غير مرتبط بملف موظفة فعال');
      }
      if (!['leader', 'supervisor', 'teacher'].includes(access.role)) {
        throw new Error('دور الحساب غير صالح؛ راجعي إعداد staff_access');
      }
      const targetUser = { ...storedUser, role: access.role as User['role'] };
      setCurrentUser(targetUser);
      if (typeof window !== 'undefined') {
        localStorage.setItem(CURRENT_USER_KEY, targetUser.id);
        sessionStorage.setItem(CURRENT_USER_KEY, targetUser.id);
      }
      persistState({ currentUser: targetUser });
      showToast(`مرحباً بك: ${targetUser.name} (${targetUser.title})`, 'info');
      return true;
    } catch (err: any) {
      showToast(err.message, 'error');
      return false;
    }
  };

  const createTrack = async (track: Partial<Track>) => {
    const defaultMastery = {
      listenToReciterTimes: 3,
      reciteLookingTimes: 5,
      masteryRepetitionTimes: 20,
      minorRevisionAmount: 'آخر ٣ أوجه',
      tamkeenRevisionAmount: 'ربع حزب',
      pointsPerCondition: 2
    };

    const newTrack: Track = {
      id: track.id || `t-${Date.now()}`,
      name: track.name || 'مسار جديد',
      code: track.code || `TRK-${Date.now().toString().slice(-4)}`,
      description: track.description || '',
      logoUrl: track.logoUrl,
      icon: track.icon || '🪴',
      isArchived: false,
      subscriptionFee: track.subscriptionFee || {
        amount: 150,
        currency: 'ر.س',
        period: 'monthly'
      },
      systemRules: track.systemRules || {
        earlyPreparation: true,
        atqiniHomeworkRequired: true,
        thursdayChallenges: true,
        customPlansAllowed: false,
        detailedWorkflowText: 'نظام الحفظ والتمكين اليومي مع التحضير المسبق وتسميع الواجبات.',
        masteryGuide: defaultMastery
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...track
    };
    const currentTracks = masterStateRef.current.tracks?.length ? masterStateRef.current.tracks : tracks;
    const next = [...currentTracks.filter((t: Track) => t.id !== newTrack.id), newTrack];
    masterStateRef.current.tracks = next;
    setTracks(next);
    persistState({ tracks: next });
    showToast(`تمت إضافة المسار "${newTrack.name}" بنجاح`);
    return newTrack;
  };

  const updateTrack = async (id: string, track: Partial<Track>) => {
    const currentTracks = masterStateRef.current.tracks?.length ? masterStateRef.current.tracks : tracks;
    const next = currentTracks.map((t: Track) => t.id === id ? { ...t, ...track, updatedAt: new Date().toISOString() } : t);
    masterStateRef.current.tracks = next;
    setTracks(next);
    persistState({ tracks: next });
    showToast('تم تحديث المسار بنجاح');
  };

  const updateTrackSystemRules = async (trackId: string, rules: Partial<TrackSystemRules>) => {
    const currentTracks = masterStateRef.current.tracks?.length ? masterStateRef.current.tracks : tracks;
    const next = currentTracks.map((t: Track) => {
      if (t.id !== trackId) return t;
      const currentRules = t.systemRules || {
        earlyPreparation: true,
        atqiniHomeworkRequired: true,
        thursdayChallenges: true,
        customPlansAllowed: false,
        detailedWorkflowText: '',
        masteryGuide: {
          listenToReciterTimes: 3,
          reciteLookingTimes: 5,
          masteryRepetitionTimes: 20,
          minorRevisionAmount: 'آخر ٣ أوجه',
          tamkeenRevisionAmount: 'ربع حزب',
          pointsPerCondition: 2
        }
      };
      return {
        ...t,
        systemRules: {
          ...currentRules,
          ...rules,
          masteryGuide: {
            ...currentRules.masteryGuide,
            ...(rules.masteryGuide || {})
          }
        },
        updatedAt: new Date().toISOString()
      };
    });
    masterStateRef.current.tracks = next;
    setTracks(next);
    persistState({ tracks: next });
    showToast('تم تحديث نظام ومعايير المسار بنجاح ⚙️');
  };

  const archiveTrack = async (id: string) => {
    const currentTracks = masterStateRef.current.tracks?.length ? masterStateRef.current.tracks : tracks;
    const next = currentTracks.map((t: Track) => t.id === id ? { ...t, isArchived: true, updatedAt: new Date().toISOString() } : t);
    masterStateRef.current.tracks = next;
    setTracks(next);
    persistState({ tracks: next });
    showToast('تمت أرشفة المسار بنجاح');
  };

  const restoreTrack = async (id: string) => {
    const currentTracks = masterStateRef.current.tracks?.length ? masterStateRef.current.tracks : tracks;
    const next = currentTracks.map((t: Track) => t.id === id ? { ...t, isArchived: false, updatedAt: new Date().toISOString() } : t);
    masterStateRef.current.tracks = next;
    setTracks(next);
    persistState({ tracks: next });
    showToast('تمت استعادة المسار بنجاح');
  };

  const createCircle = async (circle: Partial<Circle>) => {
    const currentUsers = masterStateRef.current.users?.length ? masterStateRef.current.users : users;
    const teacherObj = currentUsers.find((u: User) => u.id === circle.teacherId);
    const supervisorObj = currentUsers.find((u: User) => u.id === circle.supervisorId);
    const newCircle: Circle = {
      id: circle.id || `c-${Date.now()}`,
      trackId: circle.trackId || (tracks[0]?.id ?? 't-1'),
      name: circle.name || 'حلقة جديدة',
      icon: circle.icon || '🪴',
      teacherId: circle.teacherId || '',
      teacherName: teacherObj ? teacherObj.name : (circle.teacherName || 'غير محدد'),
      supervisorId: circle.supervisorId || '',
      supervisorName: supervisorObj ? supervisorObj.name : (circle.supervisorName || 'غير محدد'),
      maxStudents: circle.maxStudents || 15,
      scheduleDays: circle.scheduleDays || ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء'],
      startTime: circle.startTime || '16:00',
      endTime: circle.endTime || '18:00',
      earlyPrepCutoffTime: circle.earlyPrepCutoffTime || '15:45',
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...circle
    };
    const currentCircles = masterStateRef.current.circles?.length ? masterStateRef.current.circles : circles;
    const next = [...currentCircles.filter((c: Circle) => c.id !== newCircle.id), newCircle];
    masterStateRef.current.circles = next;
    setCircles(next);
    persistState({ circles: next });
    showToast(`تمت إضافة الحلقة "${newCircle.name}" بنجاح`);
    return newCircle;
  };

  const updateCircle = async (id: string, circle: Partial<Circle>) => {
    const currentUsers = masterStateRef.current.users?.length ? masterStateRef.current.users : users;
    const teacherObj = currentUsers.find((u: User) => u.id === circle.teacherId);
    const supervisorObj = currentUsers.find((u: User) => u.id === circle.supervisorId);
    const currentCircles = masterStateRef.current.circles?.length ? masterStateRef.current.circles : circles;
    const next = currentCircles.map((c: Circle) => {
      if (c.id !== id) return c;
      return {
        ...c,
        ...circle,
        teacherName: teacherObj ? teacherObj.name : (circle.teacherName || c.teacherName),
        supervisorName: supervisorObj ? supervisorObj.name : (circle.supervisorName || c.supervisorName),
        updatedAt: new Date().toISOString()
      };
    });
    masterStateRef.current.circles = next;
    setCircles(next);
    persistState({ circles: next });
    showToast('تم تحديث بيانات الحلقة بنجاح');
  };

  const archiveCircle = async (id: string) => {
    const currentCircles = masterStateRef.current.circles?.length ? masterStateRef.current.circles : circles;
    const next = currentCircles.map((c: Circle) => c.id === id ? { ...c, isArchived: true, updatedAt: new Date().toISOString() } : c);
    masterStateRef.current.circles = next;
    setCircles(next);
    persistState({ circles: next });
    showToast('تمت أرشفة الحلقة');
  };

  const restoreCircle = async (id: string) => {
    const currentCircles = masterStateRef.current.circles?.length ? masterStateRef.current.circles : circles;
    const next = currentCircles.map((c: Circle) => c.id === id ? { ...c, isArchived: false, updatedAt: new Date().toISOString() } : c);
    masterStateRef.current.circles = next;
    setCircles(next);
    persistState({ circles: next });
    showToast('تمت استعادة الحلقة');
  };

  const createStudent = async (student: Partial<Student>) => {
    const currentCircles = masterStateRef.current.circles?.length ? masterStateRef.current.circles : circles;
    const circle = currentCircles.find((c: Circle) => c.id === student.circleId);
    const newStudent: Student = {
      id: student.id || `s-${Date.now()}`,
      code: student.code || `GH-${Math.floor(100 + Math.random() * 900)}`,
      name: student.name || 'طالبة جديدة',
      phone: student.phone || '',
      email: student.email || '',
      joinDate: student.joinDate || new Date().toISOString().split('T')[0],
      status: student.status || 'active',
      trackId: student.trackId || circle?.trackId || (tracks[0]?.id ?? 't-1'),
      circleId: student.circleId || circles[0]?.id || '',
      partnerStudentId: student.partnerStudentId,
      partnerStudentName: student.partnerStudentName,
      notes: student.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...student
    };
    const currentStudents = masterStateRef.current.students?.length ? masterStateRef.current.students : students;
    const next = [...currentStudents.filter((s: Student) => s.id !== newStudent.id), newStudent];
    masterStateRef.current.students = next;
    setStudents(next);
    persistState({ students: next });
    showToast(`تم تسجيل الطالبة "${newStudent.name}" بنجاح`);
    return newStudent;
  };

  const updateStudent = async (id: string, student: Partial<Student>) => {
    const currentStudents = masterStateRef.current.students?.length ? masterStateRef.current.students : students;
    const next = currentStudents.map((s: Student) => s.id === id ? { ...s, ...student, updatedAt: new Date().toISOString() } : s);
    masterStateRef.current.students = next;
    setStudents(next);
    persistState({ students: next });
    showToast('تم تحديث ملف الطالبة بنجاح');
  };

  const archiveStudent = async (id: string) => {
    const currentStudents = masterStateRef.current.students?.length ? masterStateRef.current.students : students;
    const next = currentStudents.map((s: Student) => s.id === id ? { ...s, status: 'archived' as const, updatedAt: new Date().toISOString() } : s);
    masterStateRef.current.students = next;
    setStudents(next);
    persistState({ students: next });
    showToast('تمت أرشفة سجل الطالبة بنجاح');
  };

  const deleteStudent = async (id: string) => {
    const currentStudents = masterStateRef.current.students?.length ? masterStateRef.current.students : students;
    const studentToDelete = currentStudents.find((s: Student) => s.id === id);
    const next = currentStudents.filter((s: Student) => s.id !== id);
    masterStateRef.current.students = next;
    setStudents(next);
    persistState({ students: next, _deletedEntities: addDeletedEntity('students', id) });
    showToast(`تم حذف سجل الطالبة "${studentToDelete?.name || ''}" نهائياً من المقرأة بنجاح`);
  };

  const assignPartner = async (studentId: string, partnerId: string | null) => {
    const currentStudents = masterStateRef.current.students?.length ? masterStateRef.current.students : students;
    const s1 = currentStudents.find((s: Student) => s.id === studentId);
    const s2 = partnerId ? currentStudents.find((s: Student) => s.id === partnerId) : null;
    const next = currentStudents.map((s: Student) => {
      if (s.id === studentId) {
        return { ...s, partnerStudentId: partnerId || undefined, partnerStudentName: s2 ? s2.name : undefined, updatedAt: new Date().toISOString() };
      }
      if (partnerId && s.id === partnerId) {
        return { ...s, partnerStudentId: studentId, partnerStudentName: s1 ? s1.name : undefined, updatedAt: new Date().toISOString() };
      }
      return s;
    });
    masterStateRef.current.students = next;
    setStudents(next);
    persistState({ students: next });
    showToast(partnerId ? `تم تعيين الثنائي: ${s1?.name || ''} ↔ ${s2?.name || ''}` : 'تم إلغاء اقتران الثنائي');
  };

  const saveStudentSubscription = async (sub: Partial<StudentSubscription>) => {
    const studentId = sub.studentId || '';
    const cycleMonth = sub.cycleMonth || settings.currentHijriMonth || 'جمادى الأولى';
    const cleanId = sub.id || `sub_${studentId}_${cycleMonth.replace(/\s+/g, '_')}`;

    const newSub: StudentSubscription = {
      id: cleanId,
      studentId,
      trackId: sub.trackId || (students.find(s => s.id === studentId)?.trackId || tracks[0]?.id || 't-1'),
      cycleMonth,
      requiredAmount: sub.requiredAmount ?? 150,
      paidAmount: sub.paidAmount ?? 0,
      status: sub.status || ((sub.paidAmount ?? 0) >= (sub.requiredAmount ?? 150) ? 'paid' : (sub.paidAmount ?? 0) > 0 ? 'partial' : 'pending'),
      paymentMethod: sub.paymentMethod || 'bank_transfer',
      paymentDate: sub.paymentDate || new Date().toISOString().split('T')[0],
      receiptNumber: sub.receiptNumber || '',
      signatureUrl: sub.signatureUrl,
      notes: sub.notes || '',
      updatedAt: new Date().toISOString(),
      ...sub
    };

    const currentSubs: StudentSubscription[] = masterStateRef.current.studentSubscriptions || [];
    const existingIdx = currentSubs.findIndex(s => s.id === cleanId || (s.studentId === studentId && s.cycleMonth === cycleMonth));

    let next: StudentSubscription[];
    if (existingIdx >= 0) {
      next = [...currentSubs];
      next[existingIdx] = { ...next[existingIdx], ...newSub };
    } else {
      next = [...currentSubs, newSub];
    }

    masterStateRef.current.studentSubscriptions = next;
    setStudentSubscriptions(next);
    persistState({ studentSubscriptions: next });
    showToast('تم رصد وتحديث سند السداد والاشتراك المالي بنجاح 💳');
  };

  const createMonthlyPlan = async (plan: Partial<MonthlyPlan>) => {
    const newPlan: MonthlyPlan = {
      id: plan.id || `mp-${Date.now()}`,
      title: plan.title || 'خطة شهرية جديدة',
      trackId: plan.trackId || (tracks[0]?.id ?? 't-1'),
      hijriMonth: plan.hijriMonth || 'جمادى الأولى',
      hijriYear: plan.hijriYear || '1446',
      startDateHijri: plan.startDateHijri || '١ جمادى الأولى',
      endDateHijri: plan.endDateHijri || '٣٠ جمادى الأولى',
      examDateHijri: plan.examDateHijri || '٢٥ جمادى الأولى',
      scheduleDays: plan.scheduleDays || ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء'],
      thursdayFocus: plan.thursdayFocus || 'مخصص للتحديات والمراجعة الثنائية',
      status: plan.status || 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...plan
    };
    const currentPlans = masterStateRef.current.monthlyPlans?.length ? masterStateRef.current.monthlyPlans : monthlyPlans;
    const next = [...currentPlans.filter((p: MonthlyPlan) => p.id !== newPlan.id), newPlan];
    masterStateRef.current.monthlyPlans = next;
    setMonthlyPlans(next);
    persistState({ monthlyPlans: next });
    showToast(`تم إنشاء الخطة الشهرية: ${newPlan.title}`);
    return newPlan;
  };

  const updateMonthlyPlan = async (id: string, plan: Partial<MonthlyPlan>) => {
    const currentPlans = masterStateRef.current.monthlyPlans?.length ? masterStateRef.current.monthlyPlans : monthlyPlans;
    const next = currentPlans.map((p: MonthlyPlan) => p.id === id ? { ...p, ...plan, updatedAt: new Date().toISOString() } : p);
    masterStateRef.current.monthlyPlans = next;
    setMonthlyPlans(next);
    persistState({ monthlyPlans: next });
    showToast('تم تعديل الخطة الشهرية');
  };

  const duplicateMonthlyPlan = async (id: string) => {
    const currentPlans = masterStateRef.current.monthlyPlans?.length ? masterStateRef.current.monthlyPlans : monthlyPlans;
    const orig = currentPlans.find((p: MonthlyPlan) => p.id === id);
    if (!orig) return;
    const duplicated: MonthlyPlan = {
      ...orig,
      id: `mp-${Date.now()}`,
      title: `نسخة من: ${orig.title}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const next = [...currentPlans, duplicated];
    masterStateRef.current.monthlyPlans = next;
    setMonthlyPlans(next);
    persistState({ monthlyPlans: next });
    showToast('تم نسخ الخطة الشهرية بنجاح');
  };

  const saveStudentPlan = async (plan: Partial<StudentMonthlyPlan>) => {
    const studentId = plan.studentId || '';
    const monthlyPlanId = plan.monthlyPlanId || monthlyPlans[0]?.id || 'mp-1';
    const cleanId = plan.id || `sp_${studentId}_${monthlyPlanId}`;

    const newPlan: StudentMonthlyPlan = {
      id: cleanId,
      studentId,
      monthlyPlanId,
      status: plan.status || 'active',
      newMemorization: plan.newMemorization || {
        fromSurah: 2,
        fromAyah: 1,
        toSurah: 2,
        toAyah: 50,
        targetPages: 8,
        actualPages: 0,
        targetDailyAmount: 'نصف وجه يومياً'
      },
      revision: plan.revision || {
        fromSurah: 2,
        fromAyah: 1,
        toSurah: 2,
        toAyah: 25,
        targetPages: 4,
        actualPages: 0,
        revisionType: 'تمكين',
        status: 'in_progress'
      },
      ...plan
    };

    const currentPlans: StudentMonthlyPlan[] = masterStateRef.current.studentPlans || [];
    const existingIdx = currentPlans.findIndex(
      p => p.id === cleanId || (p.studentId === newPlan.studentId && p.monthlyPlanId === newPlan.monthlyPlanId)
    );

    let next: StudentMonthlyPlan[];
    if (existingIdx >= 0) {
      next = [...currentPlans];
      next[existingIdx] = { ...next[existingIdx], ...newPlan };
    } else {
      next = [...currentPlans, newPlan];
    }

    masterStateRef.current.studentPlans = next;
    setStudentPlans(next);
    persistState({ studentPlans: next });
    showToast('تم حفظ خطة الطالبة وتحديث المقرر بنجاح');
  };

  const saveDailyRecord = async (record: Partial<DailyRecord>) => {
    const studentId = record.studentId || '';
    const recDate = record.date || new Date().toISOString().split('T')[0];
    const cleanId = record.id || `dr_${studentId}_${recDate}`;

    const newRecord: DailyRecord = {
      id: cleanId,
      studentId,
      circleId: record.circleId || '',
      date: recDate,
      dayName: record.dayName || 'الأحد',
      requiredPortionText: record.requiredPortionText || '',
      newMemorizationCompleted: !!record.newMemorizationCompleted,
      newMemorizationPages: record.newMemorizationPages || 0,
      revisionCompleted: !!record.revisionCompleted,
      revisionPages: record.revisionPages || 0,
      memorizationMistakes: record.memorizationMistakes || 0,
      hintsCount: record.hintsCount || 0,
      tajweedErrorsCount: record.tajweedErrorsCount || 0,
      recitationScore: record.recitationScore ?? 10,
      minorRevisionPortion: record.minorRevisionPortion,
      tamkeenRevisionPortion: record.tamkeenRevisionPortion,
      signatureUrl: record.signatureUrl,
      conditions: record.conditions || {
        listenedToReader: false,
        recitedLooking: false,
        masteryRepetition: false,
        minorRevision: false,
        tamkeenRevision: false,
        achievedDistinction: false
      },
      status: record.status || 'completed',
      notes: record.notes || '',
      recordedBy: currentUser?.name || 'معلمة الحلقة',
      recordedAt: new Date().toISOString(),
      ...record
    };

    const currentRecords: DailyRecord[] = masterStateRef.current.dailyRecords || [];
    const existingIdx = currentRecords.findIndex(
      d => d.id === cleanId || (d.studentId === newRecord.studentId && d.date === newRecord.date)
    );

    let next: DailyRecord[];
    if (existingIdx >= 0) {
      next = [...currentRecords];
      next[existingIdx] = { ...next[existingIdx], ...newRecord };
    } else {
      next = [...currentRecords, newRecord];
    }

    masterStateRef.current.dailyRecords = next;
    setDailyRecords(next);
    persistState({ dailyRecords: next });
    showToast('تم رصد التسميع وتحديث درجات الطالبة 📖');
  };

  const saveAttendance = async (record: Partial<AttendanceRecord>) => {
    const recDate = record.date || new Date().toISOString().split('T')[0];
    const cleanId = record.id || `att_${record.studentId}_${recDate}`;
    const newRecord: AttendanceRecord = {
      id: cleanId,
      studentId: record.studentId || '',
      circleId: record.circleId || '',
      date: recDate,
      status: record.status || 'present',
      earlyPrepCardSent: !!record.earlyPrepCardSent,
      reason: record.reason,
      recordedBy: currentUser?.name || 'معلمة الحلقة',
      recordedAt: new Date().toISOString(),
      ...record
    };

    const currentAtt = masterStateRef.current.attendanceRecords || attendanceRecords;
    const existingIdx = currentAtt.findIndex(
      (a: AttendanceRecord) => a.id === cleanId || (a.studentId === newRecord.studentId && a.date === newRecord.date)
    );
    let next: AttendanceRecord[];
    if (existingIdx >= 0) {
      next = [...currentAtt];
      next[existingIdx] = { ...next[existingIdx], ...newRecord };
    } else {
      next = [...currentAtt, newRecord];
    }
    masterStateRef.current.attendanceRecords = next;
    setAttendanceRecords(next);
    persistState({ attendanceRecords: next });
    showToast('تم تسجيل الحضور والتحضير بنجاح ✅');
  };

  const saveBulkAttendance = async (records: Partial<AttendanceRecord>[]) => {
    let next = [...(masterStateRef.current.attendanceRecords || attendanceRecords)];
    records.forEach(rec => {
      const recDate = rec.date || new Date().toISOString().split('T')[0];
      const cleanId = rec.id || `att_${rec.studentId}_${recDate}`;
      const newRecord: AttendanceRecord = {
        id: cleanId,
        studentId: rec.studentId || '',
        circleId: rec.circleId || '',
        date: recDate,
        status: rec.status || 'present',
        earlyPrepCardSent: !!rec.earlyPrepCardSent,
        reason: rec.reason,
        recordedBy: currentUser?.name || 'معلمة الحلقة',
        recordedAt: new Date().toISOString(),
        ...rec
      };
      const idx = next.findIndex(
        a => a.id === cleanId || (a.studentId === newRecord.studentId && a.date === newRecord.date)
      );
      if (idx >= 0) next[idx] = { ...next[idx], ...newRecord };
      else next.push(newRecord);
    });
    masterStateRef.current.attendanceRecords = next;
    setAttendanceRecords(next);
    persistState({ attendanceRecords: next });
    showToast(`تم رصد الحضور لـ ${records.length} طالبة بنجاح ✅`);
  };

  const createAtqiniAssignment = async (assignment: Partial<AtqiniAssignment>) => {
    const newAss: AtqiniAssignment = {
      id: assignment.id || `atq-${Date.now()}`,
      trackId: assignment.trackId || (tracks[0]?.id ?? 't-1'),
      title: assignment.title || 'واجب تجويد جديد',
      tajweedRule: assignment.tajweedRule || '',
      description: assignment.description || '',
      sheikhVideoUrl: assignment.sheikhVideoUrl,
      publishedDate: assignment.publishedDate || new Date().toISOString().split('T')[0],
      dueDate: assignment.dueDate || '',
      requiredInstructions: assignment.requiredInstructions || '',
      examplesRequirement: assignment.examplesRequirement || '',
      recitationRuleApplication: assignment.recitationRuleApplication || '',
      maxScore: assignment.maxScore || 10,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...assignment
    };
    const currentAtq = masterStateRef.current.atqiniAssignments?.length ? masterStateRef.current.atqiniAssignments : atqiniAssignments;
    const next = [...currentAtq.filter((a: AtqiniAssignment) => a.id !== newAss.id), newAss];
    masterStateRef.current.atqiniAssignments = next;
    setAtqiniAssignments(next);
    persistState({ atqiniAssignments: next });
    showToast(`تم نشر واجب التجويد: ${newAss.title}`);
    return newAss;
  };

  const updateAtqiniAssignment = async (id: string, assignment: Partial<AtqiniAssignment>) => {
    const currentAtq = masterStateRef.current.atqiniAssignments?.length ? masterStateRef.current.atqiniAssignments : atqiniAssignments;
    const next = currentAtq.map((a: AtqiniAssignment) => a.id === id ? { ...a, ...assignment, updatedAt: new Date().toISOString() } : a);
    masterStateRef.current.atqiniAssignments = next;
    setAtqiniAssignments(next);
    persistState({ atqiniAssignments: next });
    showToast('تم تعديل واجب التجويد');
  };

  const deleteAtqiniAssignment = async (id: string) => {
    const currentAtq = masterStateRef.current.atqiniAssignments?.length ? masterStateRef.current.atqiniAssignments : atqiniAssignments;
    const next = currentAtq.filter((a: AtqiniAssignment) => a.id !== id);
    masterStateRef.current.atqiniAssignments = next;
    setAtqiniAssignments(next);
    persistState({ atqiniAssignments: next, _deletedEntities: addDeletedEntity('atqiniAssignments', id) });
    showToast('تم حذف واجب التجويد');
  };

  const saveAtqiniSubmission = async (sub: Partial<StudentAtqiniSubmission>) => {
    const cleanId = sub.id || `atqs_${sub.assignmentId}_${sub.studentId}`;
    const newSub: StudentAtqiniSubmission = {
      id: cleanId,
      assignmentId: sub.assignmentId || '',
      studentId: sub.studentId || '',
      status: sub.status || 'completed',
      isCompletedCorrectly: !!sub.isCompletedCorrectly,
      extractedExamplesDone: !!sub.extractedExamplesDone,
      appliedDuringRecitation: !!sub.appliedDuringRecitation,
      rating: sub.rating || 'ممتاز',
      score: sub.score ?? 10,
      teacherNotes: sub.teacherNotes || '',
      submittedAt: new Date().toISOString(),
      evaluatedBy: currentUser?.name || 'معلمة الحلقة',
      ...sub
    };
    const currentSubs = masterStateRef.current.studentAtqiniSubmissions || studentAtqiniSubmissions;
    const existingIdx = currentSubs.findIndex(
      (s: StudentAtqiniSubmission) => s.id === cleanId || (s.assignmentId === newSub.assignmentId && s.studentId === newSub.studentId)
    );
    let next: StudentAtqiniSubmission[];
    if (existingIdx >= 0) {
      next = [...currentSubs];
      next[existingIdx] = { ...next[existingIdx], ...newSub };
    } else {
      next = [...currentSubs, newSub];
    }
    masterStateRef.current.studentAtqiniSubmissions = next;
    setStudentAtqiniSubmissions(next);
    persistState({ studentAtqiniSubmissions: next });
    showToast('تم رصد تقييم واجب «أتقني» للتجويد');
  };

  const createChallenge = async (challenge: Partial<Challenge>) => {
    const newCh: Challenge = {
      id: challenge.id || `ch-${Date.now()}`,
      trackId: challenge.trackId || (tracks[0]?.id ?? 't-1'),
      circleId: challenge.circleId,
      title: challenge.title || 'تحدٍ قرآني جديد',
      type: challenge.type || 'thursday_challenge',
      description: challenge.description || '',
      startDate: challenge.startDate || new Date().toISOString().split('T')[0],
      endDate: challenge.endDate || new Date().toISOString().split('T')[0],
      requiredSurahs: challenge.requiredSurahs || '',
      repetitionRequirements: challenge.repetitionRequirements || '',
      completionConditions: challenge.completionConditions || '',
      dueDateDescription: challenge.dueDateDescription || '',
      maxTotalPoints: challenge.maxTotalPoints || 10,
      earlyPrepPoints: challenge.earlyPrepPoints || 2,
      includesPeerReview: challenge.includesPeerReview ?? true,
      tasks: challenge.tasks || [],
      status: challenge.status || 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...challenge
    };
    const currentCh = masterStateRef.current.challenges?.length ? masterStateRef.current.challenges : challenges;
    const next = [...currentCh.filter((c: Challenge) => c.id !== newCh.id), newCh];
    masterStateRef.current.challenges = next;
    setChallenges(next);
    persistState({ challenges: next });
    showToast(`تم إطلاق التحدي القرآني: ${newCh.title}`);
    return newCh;
  };

  const updateChallenge = async (id: string, challenge: Partial<Challenge>) => {
    const currentCh = masterStateRef.current.challenges?.length ? masterStateRef.current.challenges : challenges;
    const next = currentCh.map((c: Challenge) => c.id === id ? { ...c, ...challenge, updatedAt: new Date().toISOString() } : c);
    masterStateRef.current.challenges = next;
    setChallenges(next);
    persistState({ challenges: next });
    showToast('تم تحديث التحدي القرآني');
  };

  const deleteChallenge = async (id: string) => {
    const currentCh = masterStateRef.current.challenges?.length ? masterStateRef.current.challenges : challenges;
    const next = currentCh.filter((c: Challenge) => c.id !== id);
    masterStateRef.current.challenges = next;
    setChallenges(next);
    persistState({ challenges: next, _deletedEntities: addDeletedEntity('challenges', id) });
    showToast('تم حذف التحدي');
  };

  const saveChallengeSubmission = async (sub: Partial<StudentChallengeSubmission>) => {
    const cleanId = sub.id || `cs_${sub.challengeId}_${sub.studentId}`;
    const newSub: StudentChallengeSubmission = {
      id: cleanId,
      challengeId: sub.challengeId || '',
      studentId: sub.studentId || '',
      partnerStudentId: sub.partnerStudentId,
      partnerStudentName: sub.partnerStudentName,
      tasksCompleted: sub.tasksCompleted || [],
      earlyPrepPointsEarned: sub.earlyPrepPointsEarned || 0,
      totalPointsEarned: sub.totalPointsEarned || 0,
      teacherNotes: sub.teacherNotes || '',
      evaluatedBy: currentUser?.name || 'معلمة الحلقة',
      evaluatedAt: new Date().toISOString(),
      ...sub
    };
    const currentSubs = masterStateRef.current.studentChallengeSubmissions || studentChallengeSubmissions;
    const existingIdx = currentSubs.findIndex(
      (s: StudentChallengeSubmission) => s.id === cleanId || (s.challengeId === newSub.challengeId && s.studentId === newSub.studentId)
    );
    let next: StudentChallengeSubmission[];
    if (existingIdx >= 0) {
      next = [...currentSubs];
      next[existingIdx] = { ...next[existingIdx], ...newSub };
    } else {
      next = [...currentSubs, newSub];
    }
    masterStateRef.current.studentChallengeSubmissions = next;
    setStudentChallengeSubmissions(next);
    persistState({ studentChallengeSubmissions: next });
    showToast('تم رصد نتيجة التحدي والمراجعة الثنائية');
  };

  const createMonthlyExam = async (exam: Partial<MonthlyExam>) => {
    const newExam: MonthlyExam = {
      id: exam.id || `ex-${Date.now()}`,
      trackId: exam.trackId || (tracks[0]?.id ?? 't-1'),
      circleId: exam.circleId,
      monthlyPlanId: exam.monthlyPlanId || 'mp-1',
      title: exam.title || 'اختبار شهري تمكيني',
      examDateHijri: exam.examDateHijri || '٢٥ جمادى الأولى',
      examDateGregorian: exam.examDateGregorian || new Date().toISOString().split('T')[0],
      requiredPortion: exam.requiredPortion || '',
      maxScore: exam.maxScore || 100,
      notes: exam.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...exam
    };
    const currentExams = masterStateRef.current.monthlyExams?.length ? masterStateRef.current.monthlyExams : monthlyExams;
    const next = [...currentExams.filter((e: MonthlyExam) => e.id !== newExam.id), newExam];
    masterStateRef.current.monthlyExams = next;
    setMonthlyExams(next);
    persistState({ monthlyExams: next });
    showToast(`تمت جدولة الاختبار الشهري: ${newExam.title}`);
    return newExam;
  };

  const updateMonthlyExam = async (id: string, exam: Partial<MonthlyExam>) => {
    const currentExams = masterStateRef.current.monthlyExams?.length ? masterStateRef.current.monthlyExams : monthlyExams;
    const next = currentExams.map((e: MonthlyExam) => e.id === id ? { ...e, ...exam, updatedAt: new Date().toISOString() } : e);
    masterStateRef.current.monthlyExams = next;
    setMonthlyExams(next);
    persistState({ monthlyExams: next });
    showToast('تم تعديل بيانات الاختبار الشهري');
  };

  const deleteMonthlyExam = async (id: string) => {
    const currentExams = masterStateRef.current.monthlyExams?.length ? masterStateRef.current.monthlyExams : monthlyExams;
    const nextExams = currentExams.filter((e: MonthlyExam) => e.id !== id);
    const currentResults = masterStateRef.current.studentExamResults || studentExamResults;
    const nextResults = currentResults.filter((r: StudentExamResult) => r.examId !== id);
    const removedResults = currentResults.filter((r: StudentExamResult) => r.examId === id);
    masterStateRef.current.monthlyExams = nextExams;
    masterStateRef.current.studentExamResults = nextResults;
    setMonthlyExams(nextExams);
    setStudentExamResults(nextResults);
    persistState({
      monthlyExams: nextExams,
      studentExamResults: nextResults,
      _deletedEntities: mergeDeletedEntityMaps(
        addDeletedEntity('monthlyExams', id),
        { studentExamResults: removedResults.map((result: StudentExamResult) => result.id) }
      )
    });
    showToast('تم حذف الاختبار الشهري بنجاح 🗑️');
  };

  const saveExamResult = async (result: Partial<StudentExamResult>) => {
    const cleanId = result.id || `er_${result.examId}_${result.studentId}`;
    const currentResults = masterStateRef.current.studentExamResults || studentExamResults;
    const existingIdx = currentResults.findIndex(
      (r: StudentExamResult) => r.id === cleanId || (r.examId === result.examId && r.studentId === result.studentId)
    );
    let next: StudentExamResult[];
    if (existingIdx >= 0) {
      next = [...currentResults];
      next[existingIdx] = {
        ...next[existingIdx],
        ...result,
        score: result.score ?? next[existingIdx].score,
        memorizationMistakes: result.memorizationMistakes ?? next[existingIdx].memorizationMistakes,
        tajweedErrors: result.tajweedErrors ?? next[existingIdx].tajweedErrors,
        warningsCount: result.warningsCount ?? next[existingIdx].warningsCount,
        notes: result.notes ?? next[existingIdx].notes,
        examinerName: currentUser?.name || result.examinerName || next[existingIdx].examinerName,
        evaluatedAt: new Date().toISOString()
      };
    } else {
      const newResult: StudentExamResult = {
        id: cleanId,
        examId: result.examId || '',
        studentId: result.studentId || '',
        score: result.score ?? 0,
        memorizationMistakes: result.memorizationMistakes ?? 0,
        tajweedErrors: result.tajweedErrors ?? 0,
        warningsCount: result.warningsCount ?? 0,
        notes: result.notes || '',
        examinerName: currentUser?.name || result.examinerName || 'لجنة الاختبارات',
        evaluatedAt: new Date().toISOString(),
        customPortion: result.customPortion || '',
        signatureUrl: result.signatureUrl,
        ...result
      };
      next = [...currentResults, newResult];
    }
    masterStateRef.current.studentExamResults = next;
    setStudentExamResults(next);
    persistState({ studentExamResults: next });
    showToast('تم رصد درجة ومقرر الاختبار الشهري بنجاح');
  };

  const updateGradingConfig = async (trackId: string, config: Partial<TrackGradingConfig>) => {
    const current: TrackGradingConfig[] = masterStateRef.current.gradingConfigs || gradingConfigs || [];
    const existingIdx = current.findIndex((g: TrackGradingConfig) => g.trackId === trackId);
    let next: TrackGradingConfig[];
    if (existingIdx >= 0) {
      next = [...current];
      next[existingIdx] = {
        ...next[existingIdx],
        ...config,
        trackId
      };
    } else {
      const template = current[0] || (initialData as any).gradingConfigs?.[0];
      const newConfig: TrackGradingConfig = {
        ...template,
        id: `gc-${Date.now()}`,
        trackId,
        ...config
      };
      next = [...current, newConfig];
    }
    masterStateRef.current.gradingConfigs = next;
    setGradingConfigs(next);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(GRADING_CONFIGS_KEY, JSON.stringify(next));
      } catch {}
    }
    persistState({ gradingConfigs: next });
    showToast('تم حفظ وتحديث أوزان ومعايير نظام الدرجات بنجاح ⚖️');
  };

  const updateSettings = async (newSettings: Partial<InstitutionSettings>) => {
    const next = { ...settings, ...newSettings };
    masterStateRef.current.settings = next;
    setSettings(next);
    persistState({ settings: next });
    showToast('تم حفظ الإعدادات العامة للمقرأة');
  };

  const downloadBackup = async () => {
    try {
      const currentData = {
        currentUser,
        users,
        tracks,
        circles,
        students,
        monthlyPlans,
        studentPlans,
        dailyRecords,
        attendanceRecords,
        atqiniAssignments,
        studentAtqiniSubmissions,
        challenges,
        studentChallengeSubmissions,
        monthlyExams,
        studentExamResults,
        studentSubscriptions,
        gradingConfigs,
        settings,
        auditLogs
      };
      const jsonStr = JSON.stringify(currentData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GhaithAlGhaym_backup_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('تم تحميل ملف النسخة الاحتياطية بنجاح 📁');
    } catch (err: any) {
      showToast('تعذر تنزيل النسخة: ' + err.message, 'error');
    }
  };

  const restoreBackup = async (backupData: any) => {
    try {
      if (!backupData || !backupData.tracks || !backupData.students) {
        throw new Error('صيغة النسخة الاحتياطية غير صالحة');
      }
      const arrayFields = [
        'users', 'tracks', 'circles', 'students', 'monthlyPlans', 'studentPlans',
        'dailyRecords', 'attendanceRecords', 'atqiniAssignments', 'studentAtqiniSubmissions',
        'challenges', 'studentChallengeSubmissions', 'monthlyExams', 'studentExamResults',
        'studentSubscriptions', 'gradingConfigs', 'auditLogs'
      ];
      const normalizedBackup = { ...backupData, settings: backupData.settings || initialData.settings };
      arrayFields.forEach(field => {
        if (!Array.isArray(normalizedBackup[field])) normalizedBackup[field] = [];
      });
      if (!normalizedBackup._deletedEntities || typeof normalizedBackup._deletedEntities !== 'object') {
        normalizedBackup._deletedEntities = {};
      }
      masterStateRef.current = {};
      applyState(normalizedBackup);
      persistState({ ...normalizedBackup, _replaceState: true });
      showToast('تمت استعادة قاعدة البيانات بالكامل بنجاح');
      return true;
    } catch (err: any) {
      showToast(err.message, 'error');
      return false;
    }
  };

  const resetSampleData = async () => {
    masterStateRef.current = {};
    applyState({ ...initialData, _deletedEntities: {} });
    persistState({ ...initialData, _deletedEntities: {}, _replaceState: true });
    showToast('تمت إعادة ضبط البيانات النموذجية بنجاح');
  };

  const createUser = async (user: Partial<User>) => {
    const { passcode: _passcode, ...safeUser } = user as Partial<User> & { passcode?: string };
    const newUser: User = {
      id: user.id || 'u-' + Date.now(),
      name: user.name || 'معلمة جديدة',
      role: user.role || 'teacher',
      title: user.title || 'معلمة حلقة',
      email: user.email || '',
      phone: user.phone || '',
      circleIds: user.circleIds || [],
      avatarIcon: user.avatarIcon || 'mushaf',
      avatarColor: user.avatarColor || '#8E5364',
      ...safeUser
    } as User;

    const next = [...users, newUser];
    setUsers(next);
    persistState({ users: next });
    showToast(`تمت إضافة ${newUser.name} إلى الكادر بنجاح`);
    return newUser;
  };

  const updateUser = async (id: string, user: Partial<User>) => {
    const { passcode: _passcode, role: _role, ...safeUser } = user as Partial<User> & { passcode?: string };
    const nextUsers = users.map(u => u.id === id ? { ...u, ...safeUser } : u);
    setUsers(nextUsers);
    if (currentUser?.id === id) {
      setCurrentUser({ ...currentUser, ...safeUser });
    }

    let nextCircles = circles;
    if (safeUser.name) {
      nextCircles = circles.map(c => {
        let changed = false;
        let tName = c.teacherName;
        let sName = c.supervisorName;
        if (c.teacherId === id) {
          tName = safeUser.name!;
          changed = true;
        }
        if (c.supervisorId === id) {
          sName = safeUser.name!;
          changed = true;
        }
        return changed ? { ...c, teacherName: tName, supervisorName: sName } : c;
      });
      setCircles(nextCircles);
    }

    persistState({ users: nextUsers, circles: nextCircles });
    showToast('تم تحديث بيانات المعلمة / المشرفة بنجاح');
  };

  const changeUserPasscode = async (userId: string, _newPasscode: string): Promise<boolean> => {
    if (isLocalDemoMode) {
      showToast('روابط إعادة تعيين الدخول غير متاحة في وضع المعاينة المحلي', 'info');
      return false;
    }
    try {
      const targetUser = users.find(user => user.id === userId);
      if (!targetUser?.email) throw new Error('لا يوجد بريد إلكتروني صالح لإرسال رابط الاستعادة');
      await sendPasswordResetEmail(auth, targetUser.email);
      showToast(`تم إرسال رابط إعادة تعيين كلمة المرور إلى ${targetUser.email}`);
      return true;
    } catch (err: any) {
      showToast(err.message, 'error');
      return false;
    }
  };

  const computeStudentScoreFast = (
    studentId: string,
    sAttendance: AttendanceRecord[],
    sDaily: DailyRecord[],
    sPlan: StudentMonthlyPlan | undefined,
    sAtqini: StudentAtqiniSubmission[],
    sChallenges: StudentChallengeSubmission[],
    sExam: StudentExamResult | undefined,
    examDefinition: MonthlyExam | undefined,
    atqiniAssignmentList: AtqiniAssignment[],
    gradingConfig: TrackGradingConfig | undefined
  ): StudentScoreSummary => {
    const presentCount = sAttendance.filter(a => a.status === 'present').length;
    const lateCount = sAttendance.filter(a => a.status === 'late').length;
    const absentUnexcusedCount = sAttendance.filter(a => a.status === 'absent_unexcused').length;
    const absentExcusedCount = sAttendance.filter(a => a.status === 'absent_excused').length;
    const earlyPrepCount = sAttendance.filter(a => a.earlyPrepCardSent && (a.status === 'present' || a.status === 'late')).length;
    const totalRecordedDays = presentCount + lateCount + absentUnexcusedCount + absentExcusedCount;
    const rules = gradingConfig?.attendanceRules || {
      presentScore: 5,
      absentUnexcusedScore: 0,
      absentExcusedScore: 2.5
    };
    const maxDayPoints = rules.presentScore ?? rules.pointsPerPresent ?? 5;
    const excusedDayPoints = rules.absentExcusedScore ?? rules.pointsPerExcusedAbsent ?? 2.5;
    const unexcusedDayPoints = rules.absentUnexcusedScore ?? rules.pointsPerUnexcusedAbsent ?? 0;
    const lateDayPoints = maxDayPoints * 0.5;
    const earlyPrepBonus = rules.earlyPrepBonus ?? rules.earlyPrepBonusPoints ?? 0;
    const earnedDayPoints = (presentCount * maxDayPoints) + (lateCount * lateDayPoints)
      + (absentExcusedCount * excusedDayPoints) + (absentUnexcusedCount * unexcusedDayPoints)
      + (earlyPrepCount * earlyPrepBonus);
    const totalPossibleDayPoints = totalRecordedDays * maxDayPoints;
    const attendanceRatio = totalPossibleDayPoints > 0 ? Math.min(1, earnedDayPoints / totalPossibleDayPoints) : 1;
    const attendanceRate = totalRecordedDays > 0
      ? Math.min(100, Math.round(((presentCount + lateCount * 0.5 + absentExcusedCount * 0.5) / totalRecordedDays) * 1000) / 10)
      : 0;
    
    const maxAttendanceItem = gradingConfig?.items.find(i => i.category === 'attendance');
    const attendanceMax = maxAttendanceItem?.maxScore ?? 10;
    const attendanceScore = totalRecordedDays > 0
      ? Math.min(attendanceMax, Math.round(attendanceRatio * attendanceMax * 10) / 10)
      : 0;

    let memorizationScoreSum = 0;
    let memorizationMistakesTotal = 0;
    let hintsTotal = 0;
    let tajweedErrorsTotal = 0;
    let conditionsDistinctionCount = 0;
    let conditionsSum = 0;
    const completedDailyRecords = sDaily.filter(dr => dr.status === 'completed');
    const pageProgress = summarizeDailyPageProgress(completedDailyRecords);
    let newPagesDone = pageProgress.newMemorizationPagesDone;
    let revisionPagesDone = pageProgress.revisionPagesDone;
    let unclassifiedRevisionPagesDone = pageProgress.unclassifiedRevisionPagesDone;

    for (let i = 0; i < sDaily.length; i++) {
      const dr = sDaily[i];
      if (dr.status !== 'completed') continue;
      memorizationMistakesTotal += (dr.memorizationMistakes || 0);
      hintsTotal += (dr.hintsCount || 0);
      tajweedErrorsTotal += (dr.tajweedErrorsCount || 0);

      memorizationScoreSum += Math.min(10, Math.max(0, dr.recitationScore || 0));
      
      const cond = dr.conditions;
      if (cond) {
        let cPoints = 0;
        if (cond.listenedToReader) cPoints += 2;
        if (cond.recitedLooking) cPoints += 2;
        if (cond.masteryRepetition) cPoints += 2;
        if (cond.minorRevision) cPoints += 2;
        if (cond.tamkeenRevision) cPoints += 2;
        if (cond.achievedDistinction) conditionsDistinctionCount++;
        conditionsSum += cPoints;
      }
    }

    // سجل اليوم هو مصدر المنجز. نستخدم الأرقام القديمة بالخطة فقط عندما لا توجد سجلات يومية.
    if (completedDailyRecords.length === 0) {
      const planNewActual = sPlan?.newMemorization?.actualPages;
      if (typeof planNewActual === 'number' && Number.isFinite(planNewActual) && planNewActual > 0) {
        newPagesDone = planNewActual;
      }
      const planRevActual = sPlan?.revision?.actualPages;
      if (typeof planRevActual === 'number' && Number.isFinite(planRevActual) && planRevActual > 0) {
        revisionPagesDone = planRevActual;
        unclassifiedRevisionPagesDone = planRevActual;
      }
    }

    const memorizationItem = gradingConfig?.items.find(i => i.category === 'memorization');
    const memorizationMax = memorizationItem?.maxScore ?? 25;
    const hasMemorizationData = completedDailyRecords.length > 0;
    const avgRecitationOutOf10 = hasMemorizationData ? (memorizationScoreSum / completedDailyRecords.length) : 0;
    const memorizationScore = hasMemorizationData ? (avgRecitationOutOf10 / 10) * memorizationMax : 0;

    const conditionsItem = gradingConfig?.items.find(i => i.category === 'conditions');
    const conditionsMax = conditionsItem?.maxScore ?? 10;
    const hasConditionsData = completedDailyRecords.length > 0;
    const avgConditionsOutOf10 = hasConditionsData ? (conditionsSum / completedDailyRecords.length) : 0;
    const conditionsFulfilledScore = hasConditionsData ? (avgConditionsOutOf10 / 10) * conditionsMax : 0;

    const newMemorizationPagesTarget = (typeof sPlan?.newMemorization?.targetPages === 'number' && sPlan.newMemorization.targetPages > 0) ? sPlan.newMemorization.targetPages : 8;
    const revisionPagesTarget = (typeof sPlan?.revision?.targetPages === 'number' && sPlan.revision.targetPages > 0) ? sPlan.revision.targetPages : 4;

    const atqiniItem = gradingConfig?.items.find(i => i.category === 'atqini');
    const atqiniMax = atqiniItem?.maxScore ?? 10;
    const atqiniCompletedCount = sAtqini.filter(a => a.status === 'completed' || a.isCompletedCorrectly).length;
    const assignmentMaxById = new Map(atqiniAssignmentList.map(assignment => [assignment.id, assignment.maxScore ?? 10]));
    const atqiniRatioSum = sAtqini.reduce((sum, submission) => {
      const maxScore = assignmentMaxById.get(submission.assignmentId) ?? 10;
      const score = Math.min(maxScore, Math.max(0, submission.score || 0));
      return sum + (maxScore > 0 ? score / maxScore : 0);
    }, 0);
    const hasAtqiniData = sAtqini.length > 0;
    const atqiniScore = hasAtqiniData ? (atqiniRatioSum / sAtqini.length) * atqiniMax : 0;

    const challengeItem = gradingConfig?.items.find(i => i.category === 'thursday_challenge');
    const challengesMax = challengeItem?.maxScore ?? 10;
    let challengeEarned = 0;
    let peerReviewEarned = 0;
    for (let i = 0; i < sChallenges.length; i++) {
      const c = sChallenges[i];
      challengeEarned += (c.totalPointsEarned || 0);
      if (c.peerReviewEvaluation) {
        peerReviewEarned += (c.peerReviewEvaluation.totalEarned || 0);
      }
    }
    const hasChallengeData = sChallenges.length > 0;
    const challengesScore = hasChallengeData ? Math.min(challengesMax, challengeEarned / sChallenges.length) : 0;

    const examItem = gradingConfig?.items.find(i => i.category === 'exam');
    const examMax = examItem?.maxScore ?? 15;
    const hasExam = !!sExam && !!examDefinition && typeof sExam.score === 'number';
    const examBaseMax = examDefinition?.maxScore ?? 100;
    const examScore = hasExam && examBaseMax > 0
      ? Math.round((Math.min(examBaseMax, Math.max(0, sExam?.score ?? 0)) / examBaseMax) * examMax * 10) / 10
      : 0;

    const method = gradingConfig?.calculationMethod || 'weighted_percentage';
    let finalPercentage = 0;
    const assessedScores = [
      ...(totalRecordedDays > 0 ? [[attendanceScore, attendanceMax]] : []),
      ...(hasMemorizationData ? [[memorizationScore, memorizationMax]] : []),
      ...(hasConditionsData ? [[conditionsFulfilledScore, conditionsMax]] : []),
      ...(hasAtqiniData ? [[atqiniScore, atqiniMax]] : []),
      ...(hasChallengeData ? [[challengesScore, challengesMax]] : []),
      ...(hasExam ? [[examScore, examMax]] : [])
    ];
    const totalEarnedPoints = assessedScores.reduce((sum, [earned]) => sum + earned, 0);
    const totalPossiblePoints = assessedScores.reduce((sum, [, possible]) => sum + possible, 0);

    if (method === 'weighted_percentage') {
      let earnedWeighted = 0;
      let totalWeights = 0;
      (gradingConfig?.items || []).forEach(item => {
        if (!item.includesInFinalGrade) return;
        if (item.category === 'custom') return;
        if (item.category === 'exam' && !hasExam) return;
        if (item.category === 'attendance' && totalRecordedDays === 0) return;
        if ((item.category === 'memorization' || item.category === 'conditions') && !hasMemorizationData) return;
        if (item.category === 'atqini' && !hasAtqiniData) return;
        if (item.category === 'thursday_challenge' && !hasChallengeData) return;
        totalWeights += item.weightPercentage;
        let scoreRatio = 1;
        if (item.category === 'attendance') scoreRatio = attendanceMax > 0 ? attendanceScore / attendanceMax : 1;
        else if (item.category === 'memorization') scoreRatio = memorizationMax > 0 ? memorizationScore / memorizationMax : 1;
        else if (item.category === 'conditions') scoreRatio = conditionsMax > 0 ? conditionsFulfilledScore / conditionsMax : 1;
        else if (item.category === 'atqini') scoreRatio = atqiniMax > 0 ? atqiniScore / atqiniMax : 1;
        else if (item.category === 'thursday_challenge') scoreRatio = challengesMax > 0 ? challengesScore / challengesMax : 1;
        else if (item.category === 'exam') scoreRatio = examMax > 0 ? examScore / examMax : 1;
        earnedWeighted += scoreRatio * item.weightPercentage;
      });
      finalPercentage = totalWeights > 0 ? Math.min(100, Math.max(0, (earnedWeighted / totalWeights) * 100)) : 0;
    } else {
      finalPercentage = totalPossiblePoints > 0 ? (totalEarnedPoints / totalPossiblePoints) * 100 : 0;
    }

    const scale = gradingConfig?.gradeScale || [
      { minPercentage: 95, label: "ممتاز مرتفع", letter: "أ+", color: "#2D5A43" },
      { minPercentage: 90, label: "ممتاز", letter: "أ", color: "#3E6B48" },
      { minPercentage: 85, label: "جيد جداً مرتفع", letter: "ب+", color: "#4A6E5D" },
      { minPercentage: 80, label: "جيد جداً", letter: "ب", color: "#6A7B68" },
      { minPercentage: 75, label: "جيد مرتفع", letter: "ج+", color: "#8E7D5B" },
      { minPercentage: 70, label: "جيد", letter: "ج", color: "#A88450" },
      { minPercentage: 60, label: "مقبول", letter: "د", color: "#B8624E" },
      { minPercentage: 0, label: "يحتاج لمتابعة", letter: "هـ", color: "#9E3C3C" }
    ];

    const matchedScale = scale.find(s => finalPercentage >= s.minPercentage) || scale[scale.length - 1];

    return {
      studentId,
      attendanceScore: Number(attendanceScore.toFixed(1)),
      attendanceMax,
      attendanceRate: Number(attendanceRate.toFixed(1)),
      presentCount,
      lateCount,
      absentUnexcusedCount,
      absentExcusedCount,
      earlyPrepCount,
      perfectWeeksCount: totalRecordedDays > 0 && absentUnexcusedCount === 0 ? 1 : 0,
      memorizationScore: Number(memorizationScore.toFixed(1)),
      memorizationMax,
      newMemorizationPagesDone: newPagesDone,
      newMemorizationPagesTarget,
      revisionPagesDone,
      revisionPagesTarget,
      minorRevisionPagesDone: pageProgress.minorRevisionPagesDone,
      tamkeenRevisionPagesDone: pageProgress.tamkeenRevisionPagesDone,
      unclassifiedRevisionPagesDone,
      memorizationMistakesTotal,
      hintsTotal,
      tajweedErrorsTotal,
      conditionsFulfilledScore: Number(conditionsFulfilledScore.toFixed(1)),
      conditionsMax,
      conditionsDistinctionCount,
      atqiniScore: Number(atqiniScore.toFixed(1)),
      atqiniMax,
      atqiniCompletedCount,
      challengesScore: Number(challengesScore.toFixed(1)),
      challengesMax,
      peerReviewScore: Number(peerReviewEarned.toFixed(1)),
      examScore: Number(examScore.toFixed(1)),
      examMax,
      totalEarnedPoints: Number(totalEarnedPoints.toFixed(1)),
      totalPossiblePoints,
      finalPercentage: Number(finalPercentage.toFixed(1)),
      gradeLabel: matchedScale.label,
      gradeLetter: matchedScale.letter,
      gradeColor: matchedScale.color,
      rankInCircle: 1,
      rankInTrack: 1,
      hasUnrecordedLogs: completedDailyRecords.length === 0,
      hasFrequentAbsence: absentUnexcusedCount >= 2
    };
  };

  const allStudentScores = useMemo(() => {
    const scoresMap: Record<string, StudentScoreSummary> = {};

    const attByStudent = new Map<string, AttendanceRecord[]>();
    attendanceRecords.forEach(a => {
      const arr = attByStudent.get(a.studentId) || [];
      arr.push(a);
      attByStudent.set(a.studentId, arr);
    });

    const dailyByStudent = new Map<string, DailyRecord[]>();
    dailyRecords.forEach(d => {
      const arr = dailyByStudent.get(d.studentId) || [];
      arr.push(d);
      dailyByStudent.set(d.studentId, arr);
    });

    const plansByStudent = new Map<string, StudentMonthlyPlan>();
    studentPlans.forEach(p => {
      const existing = plansByStudent.get(p.studentId);
      if (!existing || p.status === 'active') {
        plansByStudent.set(p.studentId, p);
      }
    });

    const atqiniByStudent = new Map<string, StudentAtqiniSubmission[]>();
    studentAtqiniSubmissions.forEach(sub => {
      const arr = atqiniByStudent.get(sub.studentId) || [];
      arr.push(sub);
      atqiniByStudent.set(sub.studentId, arr);
    });

    const chByStudent = new Map<string, StudentChallengeSubmission[]>();
    studentChallengeSubmissions.forEach(sub => {
      const arr = chByStudent.get(sub.studentId) || [];
      arr.push(sub);
      chByStudent.set(sub.studentId, arr);
    });

    const resultsByStudent = new Map<string, StudentExamResult[]>();
    studentExamResults.forEach(result => {
      const items = resultsByStudent.get(result.studentId) || [];
      items.push(result);
      resultsByStudent.set(result.studentId, items);
    });
    const examById = new Map(monthlyExams.map(exam => [exam.id, exam]));

    const gradingByTrack = new Map<string, TrackGradingConfig>();
    gradingConfigs.forEach(g => gradingByTrack.set(g.trackId, g));
    const fallbackGrading = gradingConfigs[0];

    students.forEach(st => {
      const trackId = st.trackId || tracks[0]?.id;
      const gConfig = gradingByTrack.get(trackId) || fallbackGrading;
      const studentPlan = plansByStudent.get(st.id);
      const allResults = resultsByStudent.get(st.id) || [];
      const planResults = studentPlan?.status === 'active'
        ? allResults.filter(result => examById.get(result.examId)?.monthlyPlanId === studentPlan.monthlyPlanId)
        : allResults;
      const latestResult = [...planResults].sort((a, b) => {
        const aTime = Date.parse(a.evaluatedAt || '') || 0;
        const bTime = Date.parse(b.evaluatedAt || '') || 0;
        return bTime - aTime;
      })[0];

      scoresMap[st.id] = computeStudentScoreFast(
        st.id,
        attByStudent.get(st.id) || [],
        dailyByStudent.get(st.id) || [],
        studentPlan,
        atqiniByStudent.get(st.id) || [],
        chByStudent.get(st.id) || [],
        latestResult,
        latestResult ? examById.get(latestResult.examId) : undefined,
        atqiniAssignments,
        gConfig
      );
    });

    circles.forEach(circle => {
      const circleStudents = students
        .filter(s => s.circleId === circle.id)
        .sort((a, b) => (scoresMap[b.id]?.finalPercentage || 0) - (scoresMap[a.id]?.finalPercentage || 0));
      circleStudents.forEach((st, idx) => {
        if (scoresMap[st.id]) scoresMap[st.id].rankInCircle = idx + 1;
      });
    });

    tracks.forEach(track => {
      const trackStudents = students
        .filter(s => s.trackId === track.id)
        .sort((a, b) => (scoresMap[b.id]?.finalPercentage || 0) - (scoresMap[a.id]?.finalPercentage || 0));
      trackStudents.forEach((st, idx) => {
        if (scoresMap[st.id]) scoresMap[st.id].rankInTrack = idx + 1;
      });
    });

    return scoresMap;
  }, [students, circles, tracks, attendanceRecords, dailyRecords, studentPlans, studentAtqiniSubmissions, studentChallengeSubmissions, studentExamResults, monthlyExams, atqiniAssignments, gradingConfigs]);

  const getStudentScoreSummary = (studentId: string): StudentScoreSummary => {
    return allStudentScores[studentId] || {
      studentId,
      attendanceScore: 0,
      attendanceMax: 10,
      attendanceRate: 0,
      presentCount: 0,
      lateCount: 0,
      absentUnexcusedCount: 0,
      absentExcusedCount: 0,
      earlyPrepCount: 0,
      perfectWeeksCount: 0,
      memorizationScore: 0,
      memorizationMax: 25,
      newMemorizationPagesDone: 0,
      newMemorizationPagesTarget: 8,
      revisionPagesDone: 0,
      revisionPagesTarget: 6,
      minorRevisionPagesDone: 0,
      tamkeenRevisionPagesDone: 0,
      unclassifiedRevisionPagesDone: 0,
      memorizationMistakesTotal: 0,
      hintsTotal: 0,
      tajweedErrorsTotal: 0,
      conditionsFulfilledScore: 0,
      conditionsMax: 10,
      conditionsDistinctionCount: 0,
      atqiniScore: 0,
      atqiniMax: 10,
      atqiniCompletedCount: 0,
      challengesScore: 0,
      challengesMax: 10,
      peerReviewScore: 0,
      examScore: 0,
      examMax: 15,
      totalEarnedPoints: 0,
      totalPossiblePoints: 0,
      finalPercentage: 0,
      gradeLabel: "لا توجد سجلات",
      gradeLetter: "—",
      gradeColor: "#78716c",
      rankInCircle: 1,
      rankInTrack: 1,
      hasUnrecordedLogs: true,
      hasFrequentAbsence: false
    };
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        users,
        tracks,
        circles,
        students,
        monthlyPlans,
        studentPlans,
        dailyRecords,
        dailyRecitations: dailyRecords,
        attendanceRecords,
        atqiniAssignments,
        studentAtqiniSubmissions,
        challenges,
        studentChallengeSubmissions,
        monthlyExams,
        studentExamResults,
        studentSubscriptions,
        gradingConfigs,
        settings,
        auditLogs,
        loading,
        error,
        refreshData,
        switchUser,
        createTrack,
        updateTrack,
        updateTrackSystemRules,
        archiveTrack,
        restoreTrack,
        createCircle,
        updateCircle,
        archiveCircle,
        restoreCircle,
        createStudent,
        updateStudent,
        archiveStudent,
        deleteStudent,
        assignPartner,
        createMonthlyPlan,
        updateMonthlyPlan,
        duplicateMonthlyPlan,
        saveStudentPlan,
        saveDailyRecord,
        saveDailyRecitation: saveDailyRecord,
        saveAttendance,
        saveBulkAttendance,
        saveStudentSubscription,
        createAtqiniAssignment,
        updateAtqiniAssignment,
        deleteAtqiniAssignment,
        saveAtqiniSubmission,
        createChallenge,
        updateChallenge,
        deleteChallenge,
        saveChallengeSubmission,
        selectedTrackId,
        setSelectedTrackId,
        createMonthlyExam,
        updateMonthlyExam,
        deleteMonthlyExam,
        saveExamResult,
        updateGradingConfig,
        updateSettings,
        downloadBackup,
        restoreBackup,
        resetSampleData,
        createUser,
        updateUser,
        changeUserPasscode,
        getStudentScoreSummary,
        allStudentScores,
        toast,
        showToast,
        lastSynced,
        cloudStatus,
        syncNow,
        switchToLeader,
        quickModalAction,
        triggerQuickModal,
        clearQuickModal,
        theme,
        isDarkMode,
        toggleTheme,
        setTheme
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
