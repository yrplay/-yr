import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import {
  User, Track, Circle, Student, MonthlyPlan, StudentMonthlyPlan,
  DailyRecord, AttendanceRecord, AtqiniAssignment, StudentAtqiniSubmission,
  Challenge, StudentChallengeSubmission, MonthlyExam, StudentExamResult,
  TrackGradingConfig, InstitutionSettings, AuditLog
} from '../types';
import initialData from '../data/initialData';

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
  syncNow: () => Promise<void>;
  switchToLeader: () => Promise<void>;

  // Global Quick Modal Trigger
  quickModalAction: { type: string; timestamp: number } | null;
  triggerQuickModal: (type: string) => void;
  clearQuickModal: () => void;
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
  const [gradingConfigs, setGradingConfigs] = useState<TrackGradingConfig[]>([]);
  const [settings, setSettings] = useState<InstitutionSettings>({
    name: "غيث الغيم",
    leaderName: "ريفة المنصوري",
    subtitle: "المقرأة القرآنية النموذجية",
    motto: "غيثٌ يهمي على القلوب ليحيي بها معالم الوحي والرسوخ",
    academicYear: "١٤٤٦ - ١٤٤٧ هـ",
    currentHijriMonth: "ربيع الآخر - جمادى الأولى",
    supportEmail: "info@ghaym.org",
    supportPhone: "0500000001"
  });
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [lastSynced, setLastSynced] = useState<Date>(new Date());
  const [quickModalAction, setQuickModalAction] = useState<{ type: string; timestamp: number } | null>(null);

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

  // Apply state from any source (server, localStorage, or initialData)
  const applyState = (data: any) => {
    if (!data) return;
    if (data.currentUser !== undefined) setCurrentUser(data.currentUser);
    if (Array.isArray(data.users)) setUsers(data.users);
    if (Array.isArray(data.tracks)) setTracks(data.tracks);
    if (Array.isArray(data.circles)) setCircles(data.circles);
    if (Array.isArray(data.students)) setStudents(data.students);
    if (Array.isArray(data.monthlyPlans)) setMonthlyPlans(data.monthlyPlans);
    if (Array.isArray(data.studentPlans)) setStudentPlans(data.studentPlans);
    if (Array.isArray(data.dailyRecords)) setDailyRecords(data.dailyRecords);
    if (Array.isArray(data.attendanceRecords)) setAttendanceRecords(data.attendanceRecords);
    if (Array.isArray(data.atqiniAssignments)) setAtqiniAssignments(data.atqiniAssignments);
    if (Array.isArray(data.studentAtqiniSubmissions)) setStudentAtqiniSubmissions(data.studentAtqiniSubmissions);
    if (Array.isArray(data.challenges)) setChallenges(data.challenges);
    if (Array.isArray(data.studentChallengeSubmissions)) setStudentChallengeSubmissions(data.studentChallengeSubmissions);
    if (Array.isArray(data.monthlyExams)) setMonthlyExams(data.monthlyExams);
    if (Array.isArray(data.studentExamResults)) setStudentExamResults(data.studentExamResults);
    if (Array.isArray(data.gradingConfigs)) setGradingConfigs(data.gradingConfigs);
    if (data.settings) setSettings(data.settings);
    if (Array.isArray(data.auditLogs)) setAuditLogs(data.auditLogs);
    setLastSynced(new Date());
  };

  // Helper to persist current state to LocalStorage
  const persistState = (overrides?: any) => {
    try {
      if (typeof window !== 'undefined') {
        const payload = {
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
          ...overrides
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      }
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  };

  const refreshData = async (silent: boolean = false) => {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          applyState(data);
          try {
            if (typeof window !== 'undefined') {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            }
          } catch {}
          setError(null);
          return;
        }
      }
      throw new Error('Server returned non-JSON or status ' + res.status);
    } catch (err: any) {
      // Backend unavailable or static deployment (e.g. Vercel)
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
      // First visit on static host: initialize from bundled initialData
      applyState(initialData);
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
        }
      } catch {}
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  const syncNow = async () => {
    await refreshData(false);
    showToast('تمت مزامنة كافة البيانات والسجلات بنجاح ✅', 'success');
  };

  useEffect(() => {
    refreshData(false);
    // Real-time multi-user synchronization: poll every 8 seconds
    const interval = setInterval(() => {
      refreshData(true);
    }, 8000);
    return () => clearInterval(interval);
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
    const res = await fetch('/api/tracks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(track)
    });
    const created = await res.json();
    showToast(`تمت إضافة المسار "${created.name}" بنجاح`);
    await refreshData();
    return created;
  };

  const updateTrack = async (id: string, track: Partial<Track>) => {
    await fetch(`/api/tracks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(track)
    });
    showToast('تم تحديث المسار بنجاح');
    await refreshData();
  };

  const archiveTrack = async (id: string) => {
    await fetch(`/api/tracks/${id}`, { method: 'DELETE' });
    showToast('تمت أرشفة المسار بنجاح');
    await refreshData();
  };

  const restoreTrack = async (id: string) => {
    await fetch(`/api/tracks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isArchived: false })
    });
    showToast('تمت استعادة المسار بنجاح');
    await refreshData();
  };

  const createCircle = async (circle: Partial<Circle>) => {
    const res = await fetch('/api/circles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(circle)
    });
    const created = await res.json();
    showToast(`تمت إضافة الحلقة "${created.name}" بنجاح`);
    await refreshData();
    return created;
  };

  const updateCircle = async (id: string, circle: Partial<Circle>) => {
    await fetch(`/api/circles/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(circle)
    });
    showToast('تم تحديث بيانات الحلقة بنجاح');
    await refreshData();
  };

  const archiveCircle = async (id: string) => {
    await fetch(`/api/circles/${id}`, { method: 'DELETE' });
    showToast('تمت أرشفة الحلقة وحفظ سجلاتها بأمان');
    await refreshData();
  };

  const restoreCircle = async (id: string) => {
    await fetch(`/api/circles/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isArchived: false })
    });
    showToast('تمت استعادة الحلقة بنجاح');
    await refreshData();
  };

  const createStudent = async (student: Partial<Student>) => {
    const res = await fetch('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(student)
    });
    const created = await res.json();
    showToast(`تم تسجيل الطالبة "${created.name}" بنجاح`);
    await refreshData();
    return created;
  };

  const updateStudent = async (id: string, student: Partial<Student>) => {
    await fetch(`/api/students/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(student)
    });
    showToast('تم تحديث ملف الطالبة بنجاح');
    await refreshData();
  };

  const archiveStudent = async (id: string) => {
    await fetch(`/api/students/${id}`, { method: 'DELETE' });
    showToast('تمت أرشفة سجل الطالبة بنجاح');
    await refreshData();
  };

  const assignPartner = async (studentId: string, partnerId: string | null) => {
    try {
      const res = await fetch('/api/students/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId1: studentId, studentId2: partnerId || null })
      });
      if (res.ok) {
        if (!partnerId) {
          showToast('تم إلغاء اقتران الثنائي بنجاح 🔄');
        } else {
          const s1 = students.find(s => s.id === studentId);
          const s2 = students.find(s => s.id === partnerId);
          showToast(`تم تعيين الثنائي بنجاح: ${s1?.name || ''} ↔ ${s2?.name || ''} 🪴`);
        }
        await refreshData();
      }
    } catch (err: any) {
      showToast('تعذر تعيين الثنائي: ' + err.message, 'error');
    }
  };

  const createMonthlyPlan = async (plan: Partial<MonthlyPlan>) => {
    const res = await fetch('/api/monthly-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(plan)
    });
    const created = await res.json();
    showToast(`تم إنشاء الخطة الشهرية: ${created.title}`);
    await refreshData();
    return created;
  };

  const updateMonthlyPlan = async (id: string, plan: Partial<MonthlyPlan>) => {
    await fetch(`/api/monthly-plans/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(plan)
    });
    showToast('تم تعديل الخطة الشهرية');
    await refreshData();
  };

  const duplicateMonthlyPlan = async (id: string) => {
    await fetch(`/api/monthly-plans/${id}/duplicate`, { method: 'POST' });
    showToast('تم نسخ الخطة الشهرية مع الحفاظ على سجلات الشهور الماضية');
    await refreshData();
  };

  const saveStudentPlan = async (plan: Partial<StudentMonthlyPlan>) => {
    const method = plan.id ? 'PUT' : 'POST';
    const url = plan.id ? `/api/student-plans/${plan.id}` : '/api/student-plans';
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(plan)
    });
    showToast('تم حفظ خطة الطالبة وتحديث المقرر');
    await refreshData();
  };

  const saveDailyRecord = async (record: Partial<DailyRecord>) => {
    const method = record.id ? 'PUT' : 'POST';
    const url = record.id ? `/api/daily-records/${record.id}` : '/api/daily-records';
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    });
    showToast('تم رصد التسميع وتحديث درجات الطالبة');
    await refreshData();
  };

  const saveAttendance = async (record: Partial<AttendanceRecord>) => {
    await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    });
    showToast('تم تسجيل الحضور بنجاح');
    await refreshData();
  };

  const saveBulkAttendance = async (records: Partial<AttendanceRecord>[]) => {
    await fetch('/api/attendance/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records })
    });
    showToast(`تم رصد الحضور لـ ${records.length} طالبة`);
    await refreshData();
  };

  const createAtqiniAssignment = async (assignment: Partial<AtqiniAssignment>) => {
    const res = await fetch('/api/atqini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assignment)
    });
    const created = await res.json();
    showToast(`تم نشر واجب التجويد: ${created.title}`);
    await refreshData();
    return created;
  };

  const updateAtqiniAssignment = async (id: string, assignment: Partial<AtqiniAssignment>) => {
    await fetch(`/api/atqini/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assignment)
    });
    showToast('تم تعديل واجب التجويد');
    await refreshData();
  };

  const deleteAtqiniAssignment = async (id: string) => {
    await fetch(`/api/atqini/${id}`, { method: 'DELETE' });
    showToast('تم حذف واجب التجويد');
    await refreshData();
  };

  const saveAtqiniSubmission = async (sub: Partial<StudentAtqiniSubmission>) => {
    await fetch('/api/atqini-submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub)
    });
    showToast('تم رصد تقييم واجب «أتقني» للتجويد');
    await refreshData();
  };

  const createChallenge = async (challenge: Partial<Challenge>) => {
    const res = await fetch('/api/challenges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(challenge)
    });
    const created = await res.json();
    showToast(`تم إطلاق التحدي القرآني: ${created.title}`);
    await refreshData();
    return created;
  };

  const updateChallenge = async (id: string, challenge: Partial<Challenge>) => {
    await fetch(`/api/challenges/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(challenge)
    });
    showToast('تم تحديث التحدي القرآني');
    await refreshData();
  };

  const deleteChallenge = async (id: string) => {
    await fetch(`/api/challenges/${id}`, { method: 'DELETE' });
    showToast('تم حذف التحدي');
    await refreshData();
  };

  const saveChallengeSubmission = async (sub: Partial<StudentChallengeSubmission>) => {
    await fetch('/api/challenge-submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub)
    });
    showToast('تم رصد نتيجة التحدي والمراجعة الثنائية');
    await refreshData();
  };

  const createMonthlyExam = async (exam: Partial<MonthlyExam>) => {
    const res = await fetch('/api/exams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(exam)
    });
    const created = await res.json();
    showToast(`تم جدول الاختبار الشهري: ${created.title}`);
    await refreshData();
    return created;
  };

  const updateMonthlyExam = async (id: string, exam: Partial<MonthlyExam>) => {
    await fetch(`/api/exams/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(exam)
    });
    showToast('تم تعديل بيانات الاختبار الشهري');
    await refreshData();
  };

  const saveExamResult = async (result: Partial<StudentExamResult>) => {
    await fetch('/api/exam-results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result)
    });
    showToast('تم رصد درجة الاختبار الشهري بنجاح');
    await refreshData();
  };

  const updateGradingConfig = async (trackId: string, config: Partial<TrackGradingConfig>) => {
    await fetch(`/api/grading-config/${trackId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    showToast('تم تحديث أوزان ومعايير نظام الدرجات');
    await refreshData();
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
    const next = users.map(u => u.id === id ? { ...u, ...user } : u);
    setUsers(next);
    if (currentUser?.id === id) {
      setCurrentUser({ ...currentUser, ...user });
    }
    persistState({ users: next });
    showToast('تم تحديث بيانات المعلمة / المشرفة والصلاحيات');

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
      const next = users.map(u => u.id === userId ? { ...u, passcode: newPasscode } : u);
      setUsers(next);
      if (currentUser?.id === userId) {
        setCurrentUser({ ...currentUser, passcode: newPasscode });
      }
      persistState({ users: next });
      showToast('تم تغيير رمز الدخول السري بنجاح 🔒');

      try {
        await fetch('/api/auth/change-passcode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, newPasscode })
        });
      } catch {}

      return true;
    } catch (err: any) {
      showToast(err.message, 'error');
      return false;
    }
  };

  // Dynamic Grade & Score computation engine
  const computeStudentScore = (studentId: string): StudentScoreSummary => {
    const student = students.find(s => s.id === studentId);
    const trackId = student?.trackId || tracks[0]?.id;
    const gradingConfig = gradingConfigs.find(g => g.trackId === trackId) || gradingConfigs[0];
    
    // Attendance calculations
    const sAttendance = attendanceRecords.filter(a => a.studentId === studentId);
    const presentCount = sAttendance.filter(a => a.status === 'present').length;
    const absentUnexcusedCount = sAttendance.filter(a => a.status === 'absent_unexcused').length;
    const absentExcusedCount = sAttendance.filter(a => a.status === 'absent_excused').length;
    const earlyPrepCount = sAttendance.filter(a => a.earlyPrepCardSent).length;
    const totalRecordedDays = presentCount + absentUnexcusedCount + absentExcusedCount;
    const attendanceRate = totalRecordedDays > 0 ? (presentCount / totalRecordedDays) * 100 : 100;
    
    // Attendance score
    const rules = gradingConfig?.attendanceRules || { presentScore: 5, absentUnexcusedScore: 0, absentExcusedScore: 2.5, earlyPrepBonus: 1, perfectWeekBonus: 5 };
    const maxAttendanceItem = gradingConfig?.items.find(i => i.category === 'attendance');
    const attendanceMax = maxAttendanceItem?.maxScore || 10;
    const attendanceScore = totalRecordedDays > 0 ? Math.min(attendanceMax, (attendanceRate / 100) * attendanceMax) : attendanceMax;

    // Daily records calculations
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
      
      // Conditions check
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

    // Conditions item
    const conditionsItem = gradingConfig?.items.find(i => i.category === 'conditions');
    const conditionsMax = conditionsItem?.maxScore || 10;
    const avgConditionsOutOf10 = sDaily.length > 0 ? (conditionsSum / sDaily.length) : 10;
    const conditionsFulfilledScore = (avgConditionsOutOf10 / 10) * conditionsMax;

    // Student Monthly plan targets
    const sPlan = studentPlans.find(sp => sp.studentId === studentId);
    const newMemorizationPagesTarget = sPlan?.newMemorization?.targetPages || 8;
    const revisionPagesTarget = sPlan?.revision?.targetPages || 6;

    // Atqini submissions
    const sAtqini = studentAtqiniSubmissions.filter(a => a.studentId === studentId);
    const atqiniItem = gradingConfig?.items.find(i => i.category === 'atqini');
    const atqiniMax = atqiniItem?.maxScore || 10;
    const atqiniCompletedCount = sAtqini.filter(a => a.status === 'completed').length;
    let atqiniTotalScore = 0;
    sAtqini.forEach(a => { atqiniTotalScore += (a.score || 0); });
    const atqiniScore = sAtqini.length > 0 ? (atqiniTotalScore / (sAtqini.length * 10)) * atqiniMax : atqiniMax;

    // Challenges & Peer review
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

    // Monthly Exam score
    const sExam = studentExamResults.find(e => e.studentId === studentId);
    const examItem = gradingConfig?.items.find(i => i.category === 'exam');
    const examMax = examItem?.maxScore || 15;
    const examScore = sExam ? ((sExam.score || 0) / 100) * examMax : examMax * 0.95;

    // Total earned points & weighted percentage
    const method = gradingConfig?.calculationMethod || 'weighted_percentage';
    let finalPercentage = 0;
    let totalEarnedPoints = attendanceScore + memorizationScore + conditionsFulfilledScore + atqiniScore + challengesScore + examScore;
    let totalPossiblePoints = attendanceMax + memorizationMax + conditionsMax + atqiniMax + challengesMax + examMax;

    if (method === 'weighted_percentage') {
      // Sum weights of components
      let earnedWeighted = 0;
      let totalWeights = 0;
      (gradingConfig?.items || []).forEach(item => {
        if (!item.includesInFinalGrade) return;
        totalWeights += item.weightPercentage;
        let scoreRatio = 1;
        if (item.category === 'attendance') scoreRatio = attendanceScore / attendanceMax;
        else if (item.category === 'memorization') scoreRatio = memorizationScore / memorizationMax;
        else if (item.category === 'conditions') scoreRatio = conditionsFulfilledScore / conditionsMax;
        else if (item.category === 'atqini') scoreRatio = atqiniScore / atqiniMax;
        else if (item.category === 'thursday_challenge') scoreRatio = challengesScore / challengesMax;
        else if (item.category === 'exam') scoreRatio = examScore / examMax;
        earnedWeighted += scoreRatio * item.weightPercentage;
      });
      finalPercentage = totalWeights > 0 ? Math.min(100, Math.max(0, (earnedWeighted / totalWeights) * 100)) : 100;
    } else {
      finalPercentage = totalPossiblePoints > 0 ? (totalEarnedPoints / totalPossiblePoints) * 100 : 100;
    }

    // Grade scale lookup
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
      rankInCircle: 1, // Will be computed in bulk
      rankInTrack: 1,  // Will be computed in bulk
      hasUnrecordedLogs,
      hasFrequentAbsence
    };
  };

  // Precompute all student scores and rankings
  const allStudentScores = useMemo(() => {
    const scoresMap: Record<string, StudentScoreSummary> = {};
    students.forEach(st => {
      scoresMap[st.id] = computeStudentScore(st.id);
    });

    // Compute rankings in circles
    circles.forEach(circle => {
      const circleStudents = students
        .filter(s => s.circleId === circle.id)
        .sort((a, b) => (scoresMap[b.id]?.finalPercentage || 0) - (scoresMap[a.id]?.finalPercentage || 0));
      circleStudents.forEach((st, idx) => {
        if (scoresMap[st.id]) scoresMap[st.id].rankInCircle = idx + 1;
      });
    });

    // Compute rankings in tracks
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
        createMonthlyExam,
        updateMonthlyExam,
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
        syncNow,
        switchToLeader,
        quickModalAction,
        triggerQuickModal,
        clearQuickModal
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
