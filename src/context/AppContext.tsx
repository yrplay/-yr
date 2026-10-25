import React, { createContext, useContext, useState, useEffect, useMemo, useRef, ReactNode } from 'react';
import {
  User, Track, Circle, Student, MonthlyPlan, StudentMonthlyPlan,
  DailyRecord, AttendanceRecord, AtqiniAssignment, StudentAtqiniSubmission,
  Challenge, StudentChallengeSubmission, MonthlyExam, StudentExamResult,
  TrackGradingConfig, InstitutionSettings, AuditLog
} from '../types';
import initialData from '../data/initialData';
import { subscribeToCloudDatabase, pushStateToCloud, CloudSyncStatus } from '../services/cloudSync';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface StudentScoreSummary {
  studentId: string;
  attendanceScore: number;
  attendanceMax: number;
  attendanceRate: number;
  presentCount: number;
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
  attendanceRecords: AttendanceRecord[];
  atqiniAssignments: AtqiniAssignment[];
  studentAtqiniSubmissions: StudentAtqiniSubmission[];
  challenges: Challenge[];
  studentChallengeSubmissions: StudentChallengeSubmission[];
  monthlyExams: MonthlyExam[];
  studentExamResults: StudentExamResult[];
  gradingConfigs: TrackGradingConfig[];
  settings: InstitutionSettings;
  auditLogs: AuditLog[];
  loading: boolean;
  error: string | null;
  
  // Actions
  refreshData: () => Promise<void>;
  switchUser: (userId: string) => Promise<boolean>;
  
  // Tracks & Circles
  selectedTrackId: string | null;
  setSelectedTrackId: (id: string | null) => void;
  createTrack: (track: Partial<Track>) => Promise<Track>;
  updateTrack: (id: string, track: Partial<Track>) => Promise<void>;
  archiveTrack: (id: string) => Promise<void>;
  restoreTrack: (id: string) => Promise<void>;
  createCircle: (circle: Partial<Circle>) => Promise<Circle>;
  updateCircle: (id: string, circle: Partial<Circle>) => Promise<void>;
  archiveCircle: (id: string) => Promise<void>;
  restoreCircle: (id: string) => Promise<void>;
  
  // Students
  createStudent: (student: Partial<Student>) => Promise<Student>;
  updateStudent: (id: string, student: Partial<Student>) => Promise<void>;
  archiveStudent: (id: string) => Promise<void>;
  assignPartner: (studentId: string, partnerId: string | null) => Promise<void>;
  
  // Plans
  createMonthlyPlan: (plan: Partial<MonthlyPlan>) => Promise<MonthlyPlan>;
  updateMonthlyPlan: (id: string, plan: Partial<MonthlyPlan>) => Promise<void>;
  duplicateMonthlyPlan: (id: string) => Promise<void>;
  saveStudentPlan: (plan: Partial<StudentMonthlyPlan>) => Promise<void>;
  
  // Daily & Attendance
  saveDailyRecord: (record: Partial<DailyRecord>) => Promise<void>;
  saveAttendance: (record: Partial<AttendanceRecord>) => Promise<void>;
  saveBulkAttendance: (records: Partial<AttendanceRecord>[]) => Promise<void>;
  
  // Atqini
  createAtqiniAssignment: (assignment: Partial<AtqiniAssignment>) => Promise<AtqiniAssignment>;
  updateAtqiniAssignment: (id: string, assignment: Partial<AtqiniAssignment>) => Promise<void>;
  deleteAtqiniAssignment: (id: string) => Promise<void>;
  saveAtqiniSubmission: (sub: Partial<StudentAtqiniSubmission>) => Promise<void>;
  
  // Challenges
  createChallenge: (challenge: Partial<Challenge>) => Promise<Challenge>;
  updateChallenge: (id: string, challenge: Partial<Challenge>) => Promise<void>;
  deleteChallenge: (id: string) => Promise<void>;
  saveChallengeSubmission: (sub: Partial<StudentChallengeSubmission>) => Promise<void>;
  
  // Exams
  createMonthlyExam: (exam: Partial<MonthlyExam>) => Promise<MonthlyExam>;
  updateMonthlyExam: (id: string, exam: Partial<MonthlyExam>) => Promise<void>;
  deleteMonthlyExam: (id: string) => Promise<void>;
  saveExamResult: (result: Partial<StudentExamResult>) => Promise<void>;
  
  // Grading & Settings
  updateGradingConfig: (trackId: string, config: Partial<TrackGradingConfig>) => Promise<void>;
  updateSettings: (settings: Partial<InstitutionSettings>) => Promise<void>;
  downloadBackup: () => void;
  restoreBackup: (backupData: any) => Promise<boolean>;
  resetSampleData: () => Promise<void>;

  // Users & Staff
  createUser: (user: Partial<User>) => Promise<User>;
  updateUser: (id: string, user: Partial<User>) => Promise<void>;
  changeUserPasscode: (userId: string, newPasscode: string) => Promise<boolean>;
  
  // Computed helpers
  getStudentScoreSummary: (studentId: string) => StudentScoreSummary;
  allStudentScores: Record<string, StudentScoreSummary>;
  
  // Toast notifications
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;

  // Real-time synchronization
  lastSynced: Date;
  cloudStatus: CloudSyncStatus;
  syncNow: () => Promise<void>;
  switchToLeader: () => Promise<void>;

  // Global Quick Modal Trigger
  quickModalAction: { type: string; timestamp: number } | null;
  triggerQuickModal: (type: string) => void;
  clearQuickModal: () => void;

  // Theme Mode (Dark / Light)
  theme: 'light' | 'dark';
  isDarkMode: boolean;
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [monthlyPlans, setMonthlyPlans] = useState<MonthlyPlan[]>([]);
  const [studentPlans, setStudentPlans] = useState<StudentMonthlyPlan[]>([]);
  const [dailyRecords, setDailyRecords] = useState<DailyRecord[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [atqiniAssignments, setAtqiniAssignments] = useState<AtqiniAssignment[]>([]);
  const [studentAtqiniSubmissions, setStudentAtqiniSubmissions] = useState<StudentAtqiniSubmission[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [studentChallengeSubmissions, setStudentChallengeSubmissions] = useState<StudentChallengeSubmission[]>([]);
  const [monthlyExams, setMonthlyExams] = useState<MonthlyExam[]>([]);
  const [studentExamResults, setStudentExamResults] = useState<StudentExamResult[]>([]);
  const [gradingConfigs, setGradingConfigs] = useState<TrackGradingConfig[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('ghaith_grading_configs');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return (initialData.gradingConfigs as TrackGradingConfig[]) || [];
  });
  const [settings, setSettings] = useState<InstitutionSettings>({
    name: "غيث الغيم",
    leaderName: "ريفة المنصوري",
    subtitle: "المقرأة القرآنية النموذجية",
    motto: "غيثٌ يهمي على القلوب ليحيي بها معالم الوحي والرسوخ",
    academicYear: "١٤٤٦ - ١٤٤٧ هـ",
    currentHijriMonth: "ربيع الآخر - جمادى الأولى",
    supportEmail: "info@ghaym.org",
    supportPhone: "0500000001",
    securityEnabled: true,
    leaderPasscode: "1234"
  });
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [lastSynced, setLastSynced] = useState<Date>(new Date());
  const [cloudStatus, setCloudStatus] = useState<CloudSyncStatus>('syncing');
  const [quickModalAction, setQuickModalAction] = useState<{ type: string; timestamp: number } | null>(null);

  // Theme Mode (Light / Dark) State
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

  const toggleTheme = () => {
    setThemeState(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const setTheme = (newTheme: 'light' | 'dark') => {
    setThemeState(newTheme);
  };

  const isDarkMode = theme === 'dark';

  const triggerQuickModal = (type: string) => {
    setQuickModalAction({ type, timestamp: Date.now() });
  };

  const clearQuickModal = () => {
    setQuickModalAction(null);
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const STORAGE_KEY = 'ghaith_alghaym_db_v1';

  const masterStateRef = useRef<any>({
    currentUser: null,
    users: initialData.users || [],
    tracks: initialData.tracks || [],
    circles: initialData.circles || [],
    students: initialData.students || [],
    monthlyPlans: initialData.monthlyPlans || [],
    studentPlans: initialData.studentPlans || [],
    dailyRecords: initialData.dailyRecords || [],
    attendanceRecords: initialData.attendanceRecords || [],
    atqiniAssignments: initialData.atqiniAssignments || [],
    studentAtqiniSubmissions: initialData.studentAtqiniSubmissions || [],
    challenges: initialData.challenges || [],
    studentChallengeSubmissions: initialData.studentChallengeSubmissions || [],
    monthlyExams: initialData.monthlyExams || [],
    studentExamResults: initialData.studentExamResults || [],
    gradingConfigs: initialData.gradingConfigs || [],
    settings: {
      name: "غيث الغيم",
      leaderName: "ريفة المنصوري",
      subtitle: "المقرأة القرآنية النموذجية",
      motto: "غيثٌ يهمي على القلوب ليحيي بها معالم الوحي والرسوخ",
      academicYear: "١٤٤٦ - ١٤٤٧ هـ",
      currentHijriMonth: "ربيع الآخر - جمادى الأولى",
      supportEmail: "info@ghaym.org",
      supportPhone: "0500000001",
      securityEnabled: true,
      leaderPasscode: "5522"
    },
    auditLogs: initialData.auditLogs || []
  });

  const mergeDailyRecords = (localRecs: DailyRecord[] = [], incomingRecs: DailyRecord[] = []): DailyRecord[] => {
    const map = new Map<string, DailyRecord>();
    for (const inc of incomingRecs) {
      const key = inc.id || `${inc.studentId}_${inc.date}`;
      map.set(key, inc);
    }
    for (const loc of localRecs) {
      const key = loc.id || `${loc.studentId}_${loc.date}`;
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
      const key = inc.id || `${inc.studentId}_${inc.monthlyPlanId}`;
      map.set(key, inc);
    }
    for (const loc of localPlans) {
      const key = loc.id || `${loc.studentId}_${loc.monthlyPlanId}`;
      const inc = map.get(key);
      if (!inc) {
        map.set(key, loc);
      } else {
        map.set(key, { ...inc, ...loc });
      }
    }
    return Array.from(map.values());
  };

  const mergeAttendanceRecords = (localAtt: AttendanceRecord[] = [], incomingAtt: AttendanceRecord[] = []): AttendanceRecord[] => {
    const map = new Map<string, AttendanceRecord>();
    for (const inc of incomingAtt) {
      const key = inc.id || `${inc.studentId}_${inc.date}`;
      map.set(key, inc);
    }
    for (const loc of localAtt) {
      const key = loc.id || `${loc.studentId}_${loc.date}`;
      const inc = map.get(key);
      if (!inc) {
        map.set(key, loc);
      } else {
        map.set(key, { ...inc, ...loc });
      }
    }
    return Array.from(map.values());
  };

  const mergeGradingConfigs = (localConfigs: TrackGradingConfig[] = [], incomingConfigs: TrackGradingConfig[] = []): TrackGradingConfig[] => {
    const map = new Map<string, TrackGradingConfig>();
    for (const inc of incomingConfigs) {
      if (inc && inc.trackId) {
        map.set(inc.trackId, inc);
      }
    }
    for (const loc of localConfigs) {
      if (!loc || !loc.trackId) continue;
      const inc = map.get(loc.trackId);
      if (!inc) {
        map.set(loc.trackId, loc);
      } else {
        map.set(loc.trackId, {
          ...inc,
          ...loc,
          calculationMethod: loc.calculationMethod || inc.calculationMethod,
          recitationFormula: { ...(inc.recitationFormula || {}), ...(loc.recitationFormula || {}) },
          attendanceRules: { ...(inc.attendanceRules || {}), ...(loc.attendanceRules || {}) },
          items: (loc.items && loc.items.length > 0) ? loc.items : inc.items,
          gradeScale: (loc.gradeScale && loc.gradeScale.length > 0) ? loc.gradeScale : inc.gradeScale
        });
      }
    }
    return Array.from(map.values());
  };

  // تطبيق الحالة بدون محو البيانات المحفوظة
  const applyState = (data: any) => {
    if (!data || typeof data !== 'object') return;
    
    const {
      dailyRecords: incomingDaily,
      studentPlans: incomingPlans,
      attendanceRecords: incomingAtt,
      gradingConfigs: incomingGrading,
      ...restData
    } = data;

    masterStateRef.current = {
      ...masterStateRef.current,
      ...restData
    };

    // الحفاظ على المستخدم النشط من الجلسة
    const activeUserId = typeof window !== 'undefined' ? sessionStorage.getItem('ghaith_current_user_id') : null;
    const userList: User[] = Array.isArray(data.users) && data.users.length > 0 ? data.users : masterStateRef.current.users;
    
    if (activeUserId) {
      const found = userList.find(u => u.id === activeUserId);
      if (found) setCurrentUser(found);
      else if (data.currentUser) setCurrentUser(data.currentUser);
    } else if (data.currentUser !== undefined) {
      setCurrentUser(prev => prev || data.currentUser);
    }

    if (Array.isArray(data.users) && data.users.length > 0) {
      setUsers(data.users);
      if (typeof window !== 'undefined') {
        localStorage.setItem('ghaith_staff_users', JSON.stringify(data.users));
      }
    }

    if (Array.isArray(data.tracks) && data.tracks.length > 0) setTracks(data.tracks);
    if (Array.isArray(data.circles) && data.circles.length > 0) {
      const normalizedCircles = data.circles.map((c: any) => {
        const t = userList.find(u => u.id === c.teacherId);
        const s = userList.find(u => u.id === c.supervisorId);
        return {
          ...c,
          teacherName: t ? t.name : (c.teacherName || 'غير محدد'),
          supervisorName: s ? s.name : (c.supervisorName || 'غير محدد')
        };
      });
      masterStateRef.current.circles = normalizedCircles;
      setCircles(normalizedCircles);
    }
    if (Array.isArray(data.students) && data.students.length > 0) setStudents(data.students);
    if (Array.isArray(data.monthlyPlans) && data.monthlyPlans.length > 0) setMonthlyPlans(data.monthlyPlans);

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

    if (Array.isArray(incomingGrading)) {
      const mergedGrading = mergeGradingConfigs(masterStateRef.current.gradingConfigs, incomingGrading);
      masterStateRef.current.gradingConfigs = mergedGrading;
      setGradingConfigs(mergedGrading);
    }

    if (Array.isArray(data.atqiniAssignments)) setAtqiniAssignments(data.atqiniAssignments);
    if (Array.isArray(data.studentAtqiniSubmissions)) setStudentAtqiniSubmissions(data.studentAtqiniSubmissions);
    if (Array.isArray(data.challenges)) setChallenges(data.challenges);
    if (Array.isArray(data.studentChallengeSubmissions)) setStudentChallengeSubmissions(data.studentChallengeSubmissions);
    if (Array.isArray(data.monthlyExams)) setMonthlyExams(data.monthlyExams);
    if (Array.isArray(data.studentExamResults)) setStudentExamResults(data.studentExamResults);
    if (data.settings) {
      setSettings(prev => ({ ...prev, ...data.settings }));
    }
    if (Array.isArray(data.auditLogs)) setAuditLogs(data.auditLogs);
    setLastSynced(new Date());
  };

  const persistState = (overrides?: any) => {
    try {
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
        gradingConfigs: masterStateRef.current.gradingConfigs || gradingConfigs,
        settings: { ...(masterStateRef.current.settings || settings), ...(overrides?.settings || {}) },
        auditLogs: masterStateRef.current.auditLogs || auditLogs,
        ...overrides
      };

      masterStateRef.current = payload;

      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      }

      pushStateToCloud(payload)
        .then(() => setCloudStatus('connected'))
        .catch(() => setCloudStatus('offline'));

      fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => {});
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  };

  // توحيد مصدر البيانات: يقرأ المحفوظ أولاً ويمنع العودة لـ initialData إلا إذا كان التطبيق فارغاً تماماً
  const refreshData = async () => {
    try {
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
          try {
            const data = JSON.parse(cached);
            if (data && (Array.isArray(data.students) || Array.isArray(data.tracks))) {
              applyState(data);
              setLoading(false);
            }
          } catch {}
        }
      }

      const res = await fetch(`/api/state?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const serverData = await res.json();
          if (serverData && (Array.isArray(serverData.students) || Array.isArray(serverData.tracks))) {
            applyState(serverData);
            if (typeof window !== 'undefined') {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(serverData));
            }
            setError(null);
            return;
          }
        }
      }
    } catch {
      // الاعتماد التام على الكاش المحلي والسحابة في حال غياب سيرفر الـ API
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
          try {
            const data = JSON.parse(cached);
            applyState(data);
            setError(null);
            return;
          } catch {}
        }
      }
      
      // أول تشغيل للمشروع فقط
      applyState(initialData);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
      }
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  const syncNow = async () => {
    setCloudStatus('syncing');
    await refreshData();
    persistState();
    setCloudStatus('connected');
    showToast('تمت المزامنة السحابية الفورية بنجاح ✅ (Firebase)', 'success');
  };

  useEffect(() => {
    refreshData();

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
      (status) => {
        setCloudStatus(status);
      }
    );

    return () => {
      if (unsubscribeCloud) unsubscribeCloud();
    };
  }, []);

  const switchToLeader = async () => {
    const leader = users.find(u => u.role === 'leader') || users[0];
    if (leader) {
      await switchUser(leader.id);
    }
  };

  const switchUser = async (userId: string) => {
    try {
      const targetUser = users.find(u => u.id === userId);
      if (targetUser) {
        setCurrentUser(targetUser);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('ghaith_current_user_id', targetUser.id);
        }
        persistState({ currentUser: targetUser });
        showToast(`مرحباً بك: ${targetUser.name} (${targetUser.title})`, 'info');
      }
      try {
        await fetch('/api/auth/switch-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
        });
      } catch {}
      return true;
    } catch (err: any) {
      showToast(err.message, 'error');
      return false;
    }
  };

  const createTrack = async (track: Partial<Track>) => {
    const newTrack: Track = {
      id: track.id || `t-${Date.now()}`,
      name: track.name || 'مسار جديد',
      code: track.code || `TRK-${Date.now().toString().slice(-4)}`,
      description: track.description || '',
      logoUrl: track.logoUrl,
      icon: track.icon || '🪴',
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...track
    };
    const next = [...tracks, newTrack];
    setTracks(next);
    persistState({ tracks: next });
    showToast(`تمت إضافة المسار "${newTrack.name}" بنجاح`);
    try {
      await fetch('/api/tracks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTrack)
      });
    } catch {}
    return newTrack;
  };

  const updateTrack = async (id: string, track: Partial<Track>) => {
    const next = tracks.map(t => t.id === id ? { ...t, ...track, updatedAt: new Date().toISOString() } : t);
    setTracks(next);
    persistState({ tracks: next });
    showToast('تم تحديث المسار بنجاح');
    try {
      await fetch(`/api/tracks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(track)
      });
    } catch {}
  };

  const archiveTrack = async (id: string) => {
    const next = tracks.map(t => t.id === id ? { ...t, isArchived: true } : t);
    setTracks(next);
    persistState({ tracks: next });
    showToast('تمت أرشفة المسار بنجاح');
    try {
      await fetch(`/api/tracks/${id}`, { method: 'DELETE' });
    } catch {}
  };

  const restoreTrack = async (id: string) => {
    const next = tracks.map(t => t.id === id ? { ...t, isArchived: false } : t);
    setTracks(next);
    persistState({ tracks: next });
    showToast('تمت استعادة المسار بنجاح');
    try {
      await fetch(`/api/tracks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: false })
      });
    } catch {}
  };

  const createCircle = async (circle: Partial<Circle>) => {
    const teacherObj = users.find(u => u.id === circle.teacherId);
    const supervisorObj = users.find(u => u.id === circle.supervisorId);
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
      ...circle
    };
    const next = [...circles, newCircle];
    setCircles(next);
    persistState({ circles: next });
    showToast(`تمت إضافة الحلقة "${newCircle.name}" بنجاح`);
    try {
      await fetch('/api/circles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCircle)
      });
    } catch {}
    return newCircle;
  };

  const updateCircle = async (id: string, circle: Partial<Circle>) => {
    const teacherObj = users.find(u => u.id === circle.teacherId);
    const supervisorObj = users.find(u => u.id === circle.supervisorId);
    const next = circles.map(c => {
      if (c.id !== id) return c;
      const updatedTeacher = teacherObj ? teacherObj.name : (circle.teacherName || c.teacherName);
      const updatedSupervisor = supervisorObj ? supervisorObj.name : (circle.supervisorName || c.supervisorName);
      return {
        ...c,
        ...circle,
        teacherName: updatedTeacher,
        supervisorName: updatedSupervisor
      };
    });
    setCircles(next);
    persistState({ circles: next });
    showToast('تم تحديث بيانات الحلقة بنجاح');
    try {
      await fetch(`/api/circles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(circle)
      });
    } catch {}
  };

  const archiveCircle = async (id: string) => {
    const next = circles.map(c => c.id === id ? { ...c, isArchived: true } : c);
    setCircles(next);
    persistState({ circles: next });
    showToast('تمت أرشفة الحلقة وحفظ سجلاتها بأمان');
    try {
      await fetch(`/api/circles/${id}`, { method: 'DELETE' });
    } catch {}
  };

  const restoreCircle = async (id: string) => {
    const next = circles.map(c => c.id === id ? { ...c, isArchived: false } : c);
    setCircles(next);
    persistState({ circles: next });
    showToast('تمت استعادة الحلقة بنجاح');
    try {
      await fetch(`/api/circles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: false })
      });
    } catch {}
  };

  const createStudent = async (student: Partial<Student>) => {
    const circle = circles.find(c => c.id === student.circleId);
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
      ...student
    };
    const next = [...students, newStudent];
    setStudents(next);
    persistState({ students: next });
    showToast(`تم تسجيل الطالبة "${newStudent.name}" بنجاح`);
    try {
      await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStudent)
      });
    } catch {}
    return newStudent;
  };

  const updateStudent = async (id: string, student: Partial<Student>) => {
    const next = students.map(s => s.id === id ? { ...s, ...student } : s);
    setStudents(next);
    persistState({ students: next });
    showToast('تم تحديث ملف الطالبة بنجاح');
    try {
      await fetch(`/api/students/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(student)
      });
    } catch {}
  };

  const archiveStudent = async (id: string) => {
    const next = students.map(s => s.id === id ? { ...s, status: 'archived' as const } : s);
    setStudents(next);
    persistState({ students: next });
    showToast('تمت أرشفة سجل الطالبة بنجاح');
    try {
      await fetch(`/api/students/${id}`, { method: 'DELETE' });
    } catch {}
  };

  const assignPartner = async (studentId: string, partnerId: string | null) => {
    const s1 = students.find(s => s.id === studentId);
    const s2 = partnerId ? students.find(s => s.id === partnerId) : null;
    const next = students.map(s => {
      if (s.id === studentId) {
        return { ...s, partnerStudentId: partnerId || undefined, partnerStudentName: s2 ? s2.name : undefined };
      }
      if (partnerId && s.id === partnerId) {
        return { ...s, partnerStudentId: studentId, partnerStudentName: s1 ? s1.name : undefined };
      }
      return s;
    });
    setStudents(next);
    persistState({ students: next });

    if (!partnerId) {
      showToast('تم إلغاء اقتران الثنائي بنجاح 🔄');
    } else {
      showToast(`تم تعيين الثنائي بنجاح: ${s1?.name || ''} ↔ ${s2?.name || ''} 🪴`);
    }

    try {
      await fetch('/api/students/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId1: studentId, studentId2: partnerId || null })
      });
    } catch {}
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
      ...plan
    };
    const next = [...monthlyPlans, newPlan];
    setMonthlyPlans(next);
    persistState({ monthlyPlans: next });
    showToast(`تم إنشاء الخطة الشهرية: ${newPlan.title}`);
    try {
      await fetch('/api/monthly-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPlan)
      });
    } catch {}
    return newPlan;
  };

  const updateMonthlyPlan = async (id: string, plan: Partial<MonthlyPlan>) => {
    const next = monthlyPlans.map(p => p.id === id ? { ...p, ...plan } : p);
    setMonthlyPlans(next);
    persistState({ monthlyPlans: next });
    showToast('تم تعديل الخطة الشهرية');
    try {
      await fetch(`/api/monthly-plans/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plan)
      });
    } catch {}
  };

  const duplicateMonthlyPlan = async (id: string) => {
    const orig = monthlyPlans.find(p => p.id === id);
    if (!orig) return;
    const duplicated: MonthlyPlan = {
      ...orig,
      id: `mp-${Date.now()}`,
      title: `نسخة من: ${orig.title}`,
      createdAt: new Date().toISOString()
    };
    const next = [...monthlyPlans, duplicated];
    setMonthlyPlans(next);
    persistState({ monthlyPlans: next });
    showToast('تم نسخ الخطة الشهرية مع الحفاظ على سجلات الشهور الماضية');
    try {
      await fetch(`/api/monthly-plans/${id}/duplicate`, { method: 'POST' });
    } catch {}
  };

  const saveStudentPlan = async (plan: Partial<StudentMonthlyPlan>) => {
    const studentId = plan.studentId || '';
    const monthlyPlanId = plan.monthlyPlanId || monthlyPlans[0]?.id || 'mp-1';
    const cleanId = plan.id || `sp-${studentId}-${monthlyPlanId}`;

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
      p => (plan.id && p.id === plan.id) || (p.studentId === newPlan.studentId && p.monthlyPlanId === newPlan.monthlyPlanId)
    );

    let next: StudentMonthlyPlan[];
    if (existingIdx >= 0) {
      newPlan.id = currentPlans[existingIdx].id;
      next = [...currentPlans];
      next[existingIdx] = { ...next[existingIdx], ...newPlan };
    } else {
      next = [...currentPlans, newPlan];
    }

    masterStateRef.current.studentPlans = next;
    setStudentPlans(next);
    persistState({ studentPlans: next });
    showToast('تم حفظ خطة الطالبة وتحديث المقرر بنجاح');

    try {
      await fetch(newPlan.id ? `/api/student-plans/${newPlan.id}` : '/api/student-plans', {
        method: newPlan.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPlan)
      });
    } catch {}
  };

  const saveDailyRecord = async (record: Partial<DailyRecord>) => {
    const studentId = record.studentId || '';
    const recDate = record.date || new Date().toISOString().split('T')[0];
    const cleanId = record.id || `dr-${studentId}-${recDate}`;

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
      d => (record.id && d.id === record.id) || (d.studentId === newRecord.studentId && d.date === newRecord.date)
    );

    let next: DailyRecord[];
    if (existingIdx >= 0) {
      newRecord.id = currentRecords[existingIdx].id;
      next = [...currentRecords];
      next[existingIdx] = { ...next[existingIdx], ...newRecord };
    } else {
      next = [...currentRecords, newRecord];
    }

    masterStateRef.current.dailyRecords = next;
    setDailyRecords(next);
    persistState({ dailyRecords: next });
    showToast('تم رصد التسميع وتحديث درجات الطالبة 📖');

    try {
      await fetch(newRecord.id ? `/api/daily-records/${newRecord.id}` : '/api/daily-records', {
        method: newRecord.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRecord)
      });
    } catch {}
  };

  const saveAttendance = async (record: Partial<AttendanceRecord>) => {
    const cleanId = record.id || `att-${record.studentId}-${record.date}`;
    const newRecord: AttendanceRecord = {
      id: cleanId,
      studentId: record.studentId || '',
      circleId: record.circleId || '',
      date: record.date || new Date().toISOString().split('T')[0],
      status: record.status || 'present',
      earlyPrepCardSent: !!record.earlyPrepCardSent,
      reason: record.reason,
      recordedBy: currentUser?.name || 'معلمة الحلقة',
      recordedAt: new Date().toISOString(),
      ...record
    };

    const currentAtt = masterStateRef.current.attendanceRecords || attendanceRecords;
    const existingIdx = currentAtt.findIndex(
      (a: AttendanceRecord) => (a.id && a.id === cleanId) || (a.studentId === newRecord.studentId && a.date === newRecord.date)
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

    try {
      await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRecord)
      });
    } catch {}
  };

  const saveBulkAttendance = async (records: Partial<AttendanceRecord>[]) => {
    let next = [...(masterStateRef.current.attendanceRecords || attendanceRecords)];
    records.forEach(rec => {
      const cleanId = rec.id || `att-${rec.studentId}-${rec.date}`;
      const newRecord: AttendanceRecord = {
        id: cleanId,
        studentId: rec.studentId || '',
        circleId: rec.circleId || '',
        date: rec.date || new Date().toISOString().split('T')[0],
        status: rec.status || 'present',
        earlyPrepCardSent: !!rec.earlyPrepCardSent,
        reason: rec.reason,
        recordedBy: currentUser?.name || 'معلمة الحلقة',
        recordedAt: new Date().toISOString(),
        ...rec
      };
      const idx = next.findIndex(
        a => (a.id && a.id === cleanId) || (a.studentId === newRecord.studentId && a.date === newRecord.date)
      );
      if (idx >= 0) {
        next[idx] = { ...next[idx], ...newRecord };
      } else {
        next.push(newRecord);
      }
    });
    masterStateRef.current.attendanceRecords = next;
    setAttendanceRecords(next);
    persistState({ attendanceRecords: next });
    showToast(`تم رصد الحضور لـ ${records.length} طالبة بنجاح ✅`);

    try {
      await fetch('/api/attendance/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records })
      });
    } catch {}
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
      ...assignment
    };
    const next = [...atqiniAssignments, newAss];
    setAtqiniAssignments(next);
    persistState({ atqiniAssignments: next });
    showToast(`تم نشر واجب التجويد: ${newAss.title}`);
    try {
      await fetch('/api/atqini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAss)
      });
    } catch {}
    return newAss;
  };

  const updateAtqiniAssignment = async (id: string, assignment: Partial<AtqiniAssignment>) => {
    const next = atqiniAssignments.map(a => a.id === id ? { ...a, ...assignment } : a);
    setAtqiniAssignments(next);
    persistState({ atqiniAssignments: next });
    showToast('تم تعديل واجب التجويد');
    try {
      await fetch(`/api/atqini/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assignment)
      });
    } catch {}
  };

  const deleteAtqiniAssignment = async (id: string) => {
    const next = atqiniAssignments.filter(a => a.id !== id);
    setAtqiniAssignments(next);
    persistState({ atqiniAssignments: next });
    showToast('تم حذف واجب التجويد');
    try {
      await fetch(`/api/atqini/${id}`, { method: 'DELETE' });
    } catch {}
  };

  const saveAtqiniSubmission = async (sub: Partial<StudentAtqiniSubmission>) => {
    const cleanId = sub.id || `atqs-${Date.now()}`;
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
    const existingIdx = studentAtqiniSubmissions.findIndex(
      s => s.id === cleanId || (s.assignmentId === newSub.assignmentId && s.studentId === newSub.studentId)
    );
    let next: StudentAtqiniSubmission[];
    if (existingIdx >= 0) {
      next = [...studentAtqiniSubmissions];
      next[existingIdx] = { ...next[existingIdx], ...newSub };
    } else {
      next = [...studentAtqiniSubmissions, newSub];
    }
    setStudentAtqiniSubmissions(next);
    persistState({ studentAtqiniSubmissions: next });
    showToast('تم رصد تقييم واجب «أتقني» للتجويد');
    try {
      await fetch('/api/atqini-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSub)
      });
    } catch {}
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
      ...challenge
    };
    const next = [...challenges, newCh];
    setChallenges(next);
    persistState({ challenges: next });
    showToast(`تم إطلاق التحدي القرآني: ${newCh.title}`);
    try {
      await fetch('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCh)
      });
    } catch {}
    return newCh;
  };

  const updateChallenge = async (id: string, challenge: Partial<Challenge>) => {
    const next = challenges.map(c => c.id === id ? { ...c, ...challenge } : c);
    setChallenges(next);
    persistState({ challenges: next });
    showToast('تم تحديث التحدي القرآني');
    try {
      await fetch(`/api/challenges/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(challenge)
      });
    } catch {}
  };

  const deleteChallenge = async (id: string) => {
    const next = challenges.filter(c => c.id !== id);
    setChallenges(next);
    persistState({ challenges: next });
    showToast('تم حذف التحدي');
    try {
      await fetch(`/api/challenges/${id}`, { method: 'DELETE' });
    } catch {}
  };

  const saveChallengeSubmission = async (sub: Partial<StudentChallengeSubmission>) => {
    const cleanId = sub.id || `cs-${Date.now()}`;
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
    const existingIdx = studentChallengeSubmissions.findIndex(
      s => s.id === cleanId || (s.challengeId === newSub.challengeId && s.studentId === newSub.studentId)
    );
    let next: StudentChallengeSubmission[];
    if (existingIdx >= 0) {
      next = [...studentChallengeSubmissions];
      next[existingIdx] = { ...next[existingIdx], ...newSub };
    } else {
      next = [...studentChallengeSubmissions, newSub];
    }
    setStudentChallengeSubmissions(next);
    persistState({ studentChallengeSubmissions: next });
    showToast('تم رصد نتيجة التحدي والمراجعة الثنائية');
    try {
      await fetch('/api/challenge-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSub)
      });
    } catch {}
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
      ...exam
    };

    const next = [...monthlyExams, newExam];
    setMonthlyExams(next);
    persistState({ monthlyExams: next });
    showToast(`تمت جدولة الاختبار الشهري: ${newExam.title}`);

    try {
      await fetch('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newExam)
      });
    } catch {}

    return newExam;
  };

  const updateMonthlyExam = async (id: string, exam: Partial<MonthlyExam>) => {
    const next = monthlyExams.map(e => e.id === id ? { ...e, ...exam } : e);
    setMonthlyExams(next);
    persistState({ monthlyExams: next });
    showToast('تم تعديل بيانات الاختبار الشهري');

    try {
      await fetch(`/api/exams/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exam)
      });
    } catch {}
  };

  const deleteMonthlyExam = async (id: string) => {
    const nextExams = monthlyExams.filter(e => e.id !== id);
    const nextResults = studentExamResults.filter(r => r.examId !== id);
    setMonthlyExams(nextExams);
    setStudentExamResults(nextResults);
    persistState({ monthlyExams: nextExams, studentExamResults: nextResults });
    showToast('تم حذف الاختبار الشهري بنجاح 🗑️');

    try {
      await fetch(`/api/exams/${id}`, { method: 'DELETE' });
    } catch {}
  };

  const saveExamResult = async (result: Partial<StudentExamResult>) => {
    const existingIdx = studentExamResults.findIndex(
      r => r.examId === result.examId && r.studentId === result.studentId
    );
    let next: StudentExamResult[];
    if (existingIdx >= 0) {
      next = [...studentExamResults];
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
        id: result.id || `er-${Date.now()}`,
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
        ...result
      };
      next = [...studentExamResults, newResult];
    }
    setStudentExamResults(next);
    persistState({ studentExamResults: next });
    showToast('تم رصد درجة ومقرر الاختبار الشهري بنجاح');

    try {
      await fetch('/api/exam-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result)
      });
    } catch {}
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
        localStorage.setItem('ghaith_grading_configs', JSON.stringify(next));
      } catch {}
    }
    persistState({ gradingConfigs: next });
    showToast('تم حفظ وتحديث أوزان ومعايير نظام الدرجات بنجاح ⚖️');

    try {
      await fetch(`/api/grading-config/${trackId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
    } catch {}
  };

  const updateSettings = async (newSettings: Partial<InstitutionSettings>) => {
    const next = { ...settings, ...newSettings };
    setSettings(next);
    persistState({ settings: next });
    showToast('تم حفظ الإعدادات العامة للمقرأة والهوية البصرية');

    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
    } catch {}
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
      applyState(backupData);
      persistState(backupData);
      showToast('تمت استعادة قاعدة البيانات بالكامل بنجاح');

      try {
        await fetch('/api/backup/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ backupData })
        });
      } catch {}

      return true;
    } catch (err: any) {
      showToast(err.message, 'error');
      return false;
    }
  };

  const resetSampleData = async () => {
    applyState(initialData);
    persistState(initialData);
    showToast('تمت إعادة ضبط البيانات النموذجية بنجاح');

    try {
      await fetch('/api/backup/reset-sample', { method: 'POST' });
    } catch {}
  };

  const createUser = async (user: Partial<User>) => {
    const newUser: User = {
      id: user.id || 'u-' + Date.now(),
      name: user.name || 'معلمة جديدة',
      role: user.role || 'teacher',
      title: user.title || 'معلمة حلقة',
      email: user.email || '',
      phone: user.phone || '',
      circleIds: user.circleIds || [],
      passcode: user.passcode || '1234',
      avatarIcon: user.avatarIcon || 'mushaf',
      avatarColor: user.avatarColor || '#8E5364',
      ...user
    } as User;

    const next = [...users, newUser];
    setUsers(next);
    persistState({ users: next });
    showToast(`تمت إضافة ${newUser.name} إلى الكادر بنجاح`);

    try {
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
    } catch {}

    return newUser;
  };

  const updateUser = async (id: string, user: Partial<User>) => {
    const nextUsers = users.map(u => u.id === id ? { ...u, ...user } : u);
    setUsers(nextUsers);
    if (currentUser?.id === id) {
      setCurrentUser({ ...currentUser, ...user });
    }

    let nextCircles = circles;
    if (user.name) {
      nextCircles = circles.map(c => {
        let changed = false;
        let tName = c.teacherName;
        let sName = c.supervisorName;
        if (c.teacherId === id) {
          tName = user.name!;
          changed = true;
        }
        if (c.supervisorId === id) {
          sName = user.name!;
          changed = true;
        }
        return changed ? { ...c, teacherName: tName, supervisorName: sName } : c;
      });
      setCircles(nextCircles);
    }

    persistState({ users: nextUsers, circles: nextCircles });
    showToast('تم تحديث بيانات المعلمة / المشرفة والصلاحيات بنجاح');

    try {
      await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
      });
    } catch {}
  };

  const changeUserPasscode = async (userId: string, newPasscode: string): Promise<boolean> => {
    try {
      const cleanPasscode = newPasscode.trim();
      const next = users.map(u => u.id === userId ? { ...u, passcode: cleanPasscode } : u);
      setUsers(next);
      if (currentUser?.id === userId) {
        setCurrentUser({ ...currentUser, passcode: cleanPasscode });
      }
      persistState({ users: next });

      if (typeof window !== 'undefined') {
        localStorage.setItem(`ghaith_pin_${userId}`, cleanPasscode);
      }

      try {
        await setDoc(doc(db, 'staff_pins', userId), {
          userId,
          pin: cleanPasscode,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (e) {
        console.warn('Firestore pin sync failed:', e);
      }

      showToast('تم تغيير رمز الدخول السري ومزامنته سحابياً بنجاح 🔒');

      try {
        await fetch('/api/auth/change-passcode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, newPasscode: cleanPasscode })
        });
      } catch {}

      return true;
    } catch (err: any) {
      showToast(err.message, 'error');
      return false;
    }
  };

  const computeStudentScore = (studentId: string): StudentScoreSummary => {
    const student = students.find(s => s.id === studentId);
    const trackId = student?.trackId || tracks[0]?.id;
    const gradingConfig = gradingConfigs.find(g => g.trackId === trackId) || gradingConfigs[0];
    
    const sAttendance = attendanceRecords.filter(a => a.studentId === studentId);
    const presentCount = sAttendance.filter(a => a.status === 'present').length;
    const absentUnexcusedCount = sAttendance.filter(a => a.status === 'absent_unexcused').length;
    const absentExcusedCount = sAttendance.filter(a => a.status === 'absent_excused').length;
    const earlyPrepCount = sAttendance.filter(a => a.earlyPrepCardSent).length;
    const totalRecordedDays = presentCount + absentUnexcusedCount + absentExcusedCount;
    const attendanceRate = totalRecordedDays > 0 ? (presentCount / totalRecordedDays) * 100 : 100;
    
    const maxAttendanceItem = gradingConfig?.items.find(i => i.category === 'attendance');
    const attendanceMax = maxAttendanceItem?.maxScore || 10;
    const attendanceScore = totalRecordedDays > 0 ? Math.min(attendanceMax, (attendanceRate / 100) * attendanceMax) : attendanceMax;

    const sDaily = dailyRecords.filter(d => d.studentId === studentId);
    let memorizationScoreSum = 0;
    let memorizationMistakesTotal = 0;
    let hintsTotal = 0;
    let tajweedErrorsTotal = 0;
    let newPagesDone = 0;
    let revisionPagesDone = 0;
    let conditionsDistinctionCount = 0;
    let conditionsSum = 0;

    sDaily.forEach(dr => {
      memorizationMistakesTotal += (dr.memorizationMistakes || 0);
      hintsTotal += (dr.hintsCount || 0);
      tajweedErrorsTotal += (dr.tajweedErrorsCount || 0);
      newPagesDone += (dr.newMemorizationPages || 0);
      revisionPagesDone += (dr.revisionPages || 0);
      memorizationScoreSum += (dr.recitationScore || 0);
      
      const cond = dr.conditions;
      let cPoints = 0;
      if (cond.listenedToReader) cPoints += 2;
      if (cond.recitedLooking) cPoints += 2;
      if (cond.masteryRepetition) cPoints += 2;
      if (cond.minorRevision) cPoints += 2;
      if (cond.tamkeenRevision) cPoints += 2;
      if (cond.achievedDistinction) {
        conditionsDistinctionCount++;
      }
      conditionsSum += cPoints;
    });

    const memorizationItem = gradingConfig?.items.find(i => i.category === 'memorization');
    const memorizationMax = memorizationItem?.maxScore || 25;
    const avgRecitationOutOf10 = sDaily.length > 0 ? (memorizationScoreSum / sDaily.length) : 10;
    const memorizationScore = (avgRecitationOutOf10 / 10) * memorizationMax;

    const conditionsItem = gradingConfig?.items.find(i => i.category === 'conditions');
    const conditionsMax = conditionsItem?.maxScore || 10;
    const avgConditionsOutOf10 = sDaily.length > 0 ? (conditionsSum / sDaily.length) : 10;
    const conditionsFulfilledScore = (avgConditionsOutOf10 / 10) * conditionsMax;

    const sPlan = studentPlans.find(sp => sp.studentId === studentId);
    const newMemorizationPagesTarget = sPlan?.newMemorization?.targetPages || 8;
    const revisionPagesTarget = sPlan?.revision?.targetPages || 6;

    const sAtqini = studentAtqiniSubmissions.filter(a => a.studentId === studentId);
    const atqiniItem = gradingConfig?.items.find(i => i.category === 'atqini');
    const atqiniMax = atqiniItem?.maxScore || 10;
    const atqiniCompletedCount = sAtqini.filter(a => a.status === 'completed').length;
    let atqiniTotalScore = 0;
    sAtqini.forEach(a => { atqiniTotalScore += (a.score || 0); });
    const atqiniScore = sAtqini.length > 0 ? (atqiniTotalScore / (sAtqini.length * 10)) * atqiniMax : atqiniMax;

    const sChallenges = studentChallengeSubmissions.filter(c => c.studentId === studentId);
    const challengeItem = gradingConfig?.items.find(i => i.category === 'thursday_challenge');
    const challengesMax = challengeItem?.maxScore || 10;
    let challengeEarned = 0;
    let peerReviewEarned = 0;
    sChallenges.forEach(c => {
      challengeEarned += (c.totalPointsEarned || 0);
      if (c.peerReviewEvaluation) {
        peerReviewEarned += (c.peerReviewEvaluation.totalEarned || 0);
      }
    });
    const challengesScore = sChallenges.length > 0 ? Math.min(challengesMax, challengeEarned / sChallenges.length) : challengesMax;

    const studentExams = studentExamResults.filter(e => e.studentId === studentId);
    const sExam = studentExams[studentExams.length - 1];
    const examItem = gradingConfig?.items.find(i => i.category === 'exam');
    const examMax = examItem?.maxScore || 15;
    const hasExam = !!sExam && typeof sExam.score === 'number';
    const examScore = hasExam ? Math.round(((sExam.score || 0) / 100) * examMax * 10) / 10 : 0;

    const method = gradingConfig?.calculationMethod || 'weighted_percentage';
    let finalPercentage = 0;
    let totalEarnedPoints = attendanceScore + memorizationScore + conditionsFulfilledScore + atqiniScore + challengesScore + (hasExam ? examScore : 0);
    let totalPossiblePoints = attendanceMax + memorizationMax + conditionsMax + atqiniMax + challengesMax + (hasExam ? examMax : 0);

    if (method === 'weighted_percentage') {
      let earnedWeighted = 0;
      let totalWeights = 0;
      (gradingConfig?.items || []).forEach(item => {
        if (!item.includesInFinalGrade) return;
        if (item.category === 'exam' && !hasExam) return;
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
      finalPercentage = totalWeights > 0 ? Math.min(100, Math.max(0, (earnedWeighted / totalWeights) * 100)) : 100;
    } else {
      finalPercentage = totalPossiblePoints > 0 ? (totalEarnedPoints / totalPossiblePoints) * 100 : 100;
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

    const hasFrequentAbsence = absentUnexcusedCount >= 2;
    const hasUnrecordedLogs = sDaily.length === 0;

    return {
      studentId,
      attendanceScore: Number(attendanceScore.toFixed(1)),
      attendanceMax,
      attendanceRate: Number(attendanceRate.toFixed(1)),
      presentCount,
      absentUnexcusedCount,
      absentExcusedCount,
      earlyPrepCount,
      perfectWeeksCount: absentUnexcusedCount === 0 ? 1 : 0,
      memorizationScore: Number(memorizationScore.toFixed(1)),
      memorizationMax,
      newMemorizationPagesDone: newPagesDone,
      newMemorizationPagesTarget,
      revisionPagesDone,
      revisionPagesTarget,
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
      hasUnrecordedLogs,
      hasFrequentAbsence
    };
  };

  const allStudentScores = useMemo(() => {
    const scoresMap: Record<string, StudentScoreSummary> = {};
    students.forEach(st => {
      scoresMap[st.id] = computeStudentScore(st.id);
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
  }, [students, circles, tracks, attendanceRecords, dailyRecords, studentPlans, studentAtqiniSubmissions, studentChallengeSubmissions, studentExamResults, gradingConfigs]);

  const getStudentScoreSummary = (studentId: string): StudentScoreSummary => {
    return allStudentScores[studentId] || computeStudentScore(studentId);
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
        attendanceRecords,
        atqiniAssignments,
        studentAtqiniSubmissions,
        challenges,
        studentChallengeSubmissions,
        monthlyExams,
        studentExamResults,
        gradingConfigs,
        settings,
        auditLogs,
        loading,
        error,
        refreshData,
        switchUser,
        createTrack,
        updateTrack,
        archiveTrack,
        restoreTrack,
        createCircle,
        updateCircle,
        archiveCircle,
        restoreCircle,
        createStudent,
        updateStudent,
        archiveStudent,
        assignPartner,
        createMonthlyPlan,
        updateMonthlyPlan,
        duplicateMonthlyPlan,
        saveStudentPlan,
        saveDailyRecord,
        saveAttendance,
        saveBulkAttendance,
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
