export type UserRole = 'leader' | 'supervisor' | 'teacher';

export type StudentStatus = 'active' | 'archived' | 'suspended';

export interface UserPermissions {
  canRecordAttendance?: boolean;
  canRecordRecitation?: boolean;
  canGradeAtqini?: boolean;
  canManageChallenges?: boolean;
  canGradeExams?: boolean;
  canEditStudents?: boolean;
  canViewReports?: boolean;
  canManagePlans?: boolean;
  canManageFinances?: boolean;
  canEditTrackCriteria?: boolean;
  canManageSettings?: boolean;
  canManageUsers?: boolean;
  canManageTracks?: boolean;
  canManageCircles?: boolean;
  canEditScores?: boolean;
  canExportReports?: boolean;
  [key: string]: boolean | undefined;
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  title: string;
  email?: string;
  phone?: string;
  circleIds: string[];
  passcode?: string;
  avatarIcon?: string;
  avatarColor?: string;
  isActive?: boolean;
  permissions?: UserPermissions;
  signatureUrl?: string;
}

// 1. معايير دليل الإتقان (مشكاة الغيم) الموحدة القابلة للتعديل
export interface CriterionItem {
  id: string;
  title: string;
  count: number;
  unit: string;
  description?: string;
}

export interface CustomMasteryCriterion {
  id: string;
  title: string;
  count?: number;
  unit?: string;
  description?: string;
}

export interface MasteryGuideConfig {
  listenToReciterTimes: number;    // عدد مرات الاستماع للقارئ (مثلاً 3)
  reciteLookingTimes: number;       // عدد مرات التلاوة نظراً من المصحف (مثلاً 5)
  masteryRepetitionTimes: number;   // عدد مرات التكرار المتقن (مثلاً 20)
  minorRevisionAmount: string;      // مقدار المراجعة الصغرى (مثلاً: آخر 3 أوجه)
  tamkeenRevisionAmount: string;    // مقدار مراجعة التمكين (مثلاً: ربع حزب)
  pointsPerCondition: number;       // وزن كل شرط في النقاط
  customCriteria?: CustomMasteryCriterion[]; // معايير إضافية مخصصة
  unifiedCriteria?: CriterionItem[]; // كافة المعايير موحدة (كلها زي بعض)
}

// 2. نظام العمل ورسوم الاشتراك التابعة للمسار
export interface TrackSystemRules {
  earlyPreparation: boolean;        // اشتراط التحضير المبكر
  atqiniHomeworkRequired: boolean;  // اشتراط واجبات أتقني للتجويد
  thursdayChallenges: boolean;      // تفعيل تحديات الخميس والمراجعة الثنائية
  customPlansAllowed: boolean;      // السماح بالخطط الفردية المرنة
  detailedWorkflowText: string;     // نص يشرح آلية ونظام المسار
  masteryGuide: MasteryGuideConfig; // معايير الدليل الخاصة بالمسار
}

export interface TrackSubscriptionFee {
  amount: number;                   // مبلغ الاشتراك
  currency: string;                 // العملة (ر.س)
  period: 'monthly' | 'term' | 'annual'; // دورية الدفع
  notes?: string;                   // ملاحظات أو شروط الرسوم
}

// 3. واجهة المسار المحدثة
export interface Track {
  id: string;
  name: string;
  code: string;
  description: string;              // نبذة ووصف المسار
  icon?: string;
  logoUrl?: string;
  subscriptionFee?: TrackSubscriptionFee;
  systemRules?: TrackSystemRules;
  isArchived: boolean;
  createdAt: string;
  updatedAt?: string;
}

// 4. الحلقات القرآنية
export interface Circle {
  id: string;
  trackId: string;
  name: string;
  icon?: string;
  teacherId: string;
  teacherName?: string;
  supervisorId: string;
  supervisorName?: string;
  maxStudents: number;
  scheduleDays: string[];
  startTime: string;
  endTime: string;
  earlyPrepCutoffTime: string;
  isArchived: boolean;
  createdAt: string;
}

// 5. الطالبات
export interface Student {
  id: string;
  code: string;
  name: string;
  phone?: string;
  email?: string;
  joinDate: string;
  status: 'active' | 'archived' | 'suspended';
  trackId: string;
  circleId: string;
  partnerStudentId?: string;
  partnerStudentName?: string;
  notes?: string;
  createdAt: string;
}

// 6. سجلات اشتراكات ودفع الطالبات
export type PaymentStatus = 'paid' | 'partial' | 'pending' | 'exempt'; // مدفوع، جزئي، معلق، معفى
export type PaymentMethod = 'bank_transfer' | 'cash' | 'pos' | 'other';

export interface StudentSubscription {
  id: string;
  studentId: string;
  trackId: string;
  cycleMonth: string;               // الشهر/الفصل الدراسي
  requiredAmount: number;           // المبلغ المطلوب
  paidAmount: number;               // المبلغ المدفوع
  status: PaymentStatus;
  paymentMethod?: PaymentMethod;
  paymentDate?: string;
  receiptNumber?: string;
  signatureUrl?: string;            // التوقيع اليدوي للاعتماد
  notes?: string;
  updatedAt: string;
}

// 7. الخطط والمقررات الشهرية
export interface MonthlyPlan {
  id: string;
  title: string;
  trackId: string;
  hijriMonth: string;
  hijriYear: string;
  startDateHijri: string;
  endDateHijri: string;
  examDateHijri: string;
  scheduleDays: string[];
  thursdayFocus: string;
  status: 'active' | 'archived';
  createdAt: string;
}

export interface StudentMonthlyPlan {
  id: string;
  studentId: string;
  monthlyPlanId: string;
  status: 'active' | 'completed' | 'on_hold';
  newMemorization: {
    fromSurah: number;
    fromAyah: number;
    toSurah: number;
    toAyah: number;
    targetPages: number;
    actualPages: number;
    targetDailyAmount: string;
  };
  revision: {
    fromSurah: number;
    fromAyah: number;
    toSurah: number;
    toAyah: number;
    targetPages: number;
    actualPages: number;
    revisionType: string;
    status: string;
  };
}

// 8. تفاصيل أجزاء المراجعة الصغرى والتمكين
export interface RevisionPortion {
  surahNumber: number;
  fromAyah: number;
  toAyah: number;
  pagesCount?: number;
  status: 'excellent' | 'acceptable' | 'needs_repetition' | 'unrecited';
}

// 9. السجل اليومي للتسميع المحدث
export interface DailyRecord {
  id: string;
  studentId: string;
  circleId: string;
  date: string;
  dayName: string;
  requiredPortionText?: string;
  newMemorizationCompleted: boolean;
  newMemorizationPages: number;
  revisionCompleted: boolean;
  revisionPages: number;
  memorizationMistakes: number;
  hintsCount: number;
  tajweedErrorsCount: number;
  recitationScore: number;
  
  // الخانات المستقلة للمراجعة الصغرى والتمكين
  minorRevisionPortion?: RevisionPortion;
  tamkeenRevisionPortion?: RevisionPortion;

  conditions: {
    listenedToReader: boolean;
    recitedLooking: boolean;
    masteryRepetition: boolean;
    minorRevision: boolean;
    tamkeenRevision: boolean;
    achievedDistinction: boolean;
  };
  criteriaCounts?: Record<string, number>; // أعداد المرات المنجزة يدويًا لكل معيار
  criteriaListenCount?: number;
  criteriaReciteCount?: number;
  criteriaRepeatCount?: number;
  status: 'completed' | 'absent' | 'excused' | 'pending';
  signatureUrl?: string; // التوقيع اليدوي للمعلمة
  notes?: string;
  recordedBy: string;
  recordedAt: string;
}

// 10. الحضور والغياب
export interface AttendanceRecord {
  id: string;
  studentId: string;
  circleId: string;
  date: string;
  status: 'present' | 'absent_unexcused' | 'absent_excused' | 'late' | 'unrecorded';
  earlyPrepCardSent: boolean;
  reason?: string;
  recordedBy: string;
  recordedAt: string;
}

export type AtqiniRating = 'ممتاز' | 'جيد جداً' | 'جيد' | 'يحتاج إعادة' | string;

// 11. واجبات التجويد «أتقني»
export interface AtqiniAssignment {
  id: string;
  trackId: string;
  title: string;
  tajweedRule: string;
  description: string;
  sheikhVideoUrl?: string;
  lessonImageUrl?: string;
  publishedDate: string;
  dueDate: string;
  requiredInstructions: string;
  examplesRequirement: string;
  recitationRuleApplication: string;
  maxScore: number;
}

export interface StudentAtqiniSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  status: 'completed' | 'pending' | 'late' | 'in_progress' | 'not_started';
  isCompletedCorrectly: boolean;
  extractedExamplesDone: boolean;
  appliedDuringRecitation: boolean;
  rating: string;
  score: number;
  teacherNotes?: string;
  submittedAt: string;
  evaluatedBy: string;
}

// 12. التحديات والمراجعة الثنائية
export interface ChallengeTask {
  id: string;
  title: string;
  name?: string;
  description: string;
  targetCount: number;
  points: number;
  maxPoints?: number;
}

export type ChallengeType = 'thursday_challenge' | 'peer_review' | 'ramadan_competition' | string;

export interface Challenge {
  id: string;
  trackId: string;
  circleId?: string;
  title: string;
  type: ChallengeType;
  description: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  requiredSurahs: string;
  repetitionRequirements: string;
  completionConditions: string;
  dueDateDescription: string;
  maxTotalPoints: number;
  earlyPrepPoints: number;
  includesPeerReview: boolean;
  tasks: ChallengeTask[] | any[];
  status: 'active' | 'completed';
  createdAt: string;
}

export interface StudentChallengeSubmission {
  id: string;
  challengeId: string;
  studentId: string;
  partnerStudentId?: string;
  partnerStudentName?: string;
  tasksCompleted: string[] | any;
  earlyPrepPointsEarned: number;
  totalPointsEarned: number;
  peerReviewEvaluation?: any;
  peerReviewDetails?: any;
  teacherNotes?: string;
  evaluatedBy: string;
  evaluatedAt: string;
}

// 13. الاختبارات الشهرية
export interface MonthlyExam {
  id: string;
  trackId: string;
  circleId?: string;
  monthlyPlanId: string;
  title: string;
  examDateHijri: string;
  examDateGregorian: string;
  requiredPortion: string;
  maxScore: number;
  notes?: string;
  createdAt: string;
}

export interface StudentExamResult {
  id: string;
  examId: string;
  studentId: string;
  score: number;
  memorizationMistakes: number;
  tajweedErrors: number;
  warningsCount: number;
  notes?: string;
  examinerName: string;
  evaluatedAt: string;
  customPortion?: string;
  signatureUrl?: string; // توقيع لجنة الاختبار
}

// 14. إعدادات نظام الدرجات والمعايير
export interface GradingCategoryItem {
  id: string;
  category: 'attendance' | 'memorization' | 'conditions' | 'atqini' | 'thursday_challenge' | 'exam' | 'custom';
  name: string;
  weightPercentage: number;
  maxScore: number;
  includesInFinalGrade: boolean;
  description?: string;
  isMandatory?: boolean;
  code?: string;
}

export interface GradeScaleItem {
  minPercentage: number;
  label: string;
  letter: string;
  color: string;
}

export type GradingItemConfig = GradingCategoryItem;

export interface TrackGradingConfig {
  id: string;
  trackId: string;
  calculationMethod: 'weighted_percentage' | 'total_points' | 'points_ratio';
  recitationFormula: {
    baseScore?: number;
    baseGrade?: number;
    memorizationMistakeDeduction?: number;
    deductionPerMistake?: number;
    hintDeduction?: number;
    deductionPerHint?: number;
    tajweedErrorDeduction?: number;
    deductionPerTajweedError?: number;
    maxDeduction?: number;
    minGrade?: number;
    newMemorizationWeight?: number;
    revisionWeight?: number;
  };
  attendanceRules: {
    pointsPerPresent?: number;
    presentScore?: number;
    pointsPerExcusedAbsent?: number;
    absentExcusedScore?: number;
    pointsPerUnexcusedAbsent?: number;
    absentUnexcusedScore?: number;
    earlyPrepBonusPoints?: number;
    earlyPrepBonus?: number;
    perfectWeekBonus?: number;
  };
  items: GradingCategoryItem[];
  gradeScale: GradeScaleItem[];
}

// 15. الإعدادات وسجل الرقابة
export interface InstitutionSettings {
  name: string;
  leaderName: string;
  subtitle: string;
  motto: string;
  academicYear: string;
  currentHijriMonth: string;
  supportEmail: string;
  supportPhone: string;
  securityEnabled: boolean;
  leaderPasscode: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  buttonRadius?: string;
  fontFamily?: string;
  welcomeTitle?: string;
  welcomeSubtext?: string;
  activeTrackName?: string;
  sealText?: string;
  sealSubtitle?: string;
  sealImageUrl?: string;
  showOfficialSeal?: boolean; // خيار تفعيل أو إخفاء الختم بالكامل من الشهادات والتقارير
  leaderSignatureUrl?: string;
  defaultMasteryGuide?: MasteryGuideConfig;
  defaultSubscriptionFee?: number;
  currency?: string;
  gradingRules?: {
    recitationBaseScore?: number;
    hifzErrorDeduction?: number;
    alertDeduction?: number;
    tajweedErrorDeduction?: number;
  };
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole?: string;
  action: string;
  actionType?: string;
  entity?: string;
  entityId?: string;
  details: string;
  timestamp: string;
}

// معايير دليل الإتقان الافتراضية
export const defaultMasteryGuideConfig: MasteryGuideConfig = {
  listenToReciterTimes: 3,
  reciteLookingTimes: 5,
  masteryRepetitionTimes: 20,
  minorRevisionAmount: 'آخر ٣ أوجه',
  tamkeenRevisionAmount: 'ربع حزب',
  pointsPerCondition: 2,
  customCriteria: []
};

// صلاحيات الأدوار الافتراضية
export const defaultPermissionsByRole: Record<string, UserPermissions> = {
  leader: {
    canRecordAttendance: true,
    canRecordRecitation: true,
    canGradeAtqini: true,
    canManageChallenges: true,
    canGradeExams: true,
    canEditStudents: true,
    canViewReports: true,
    canManagePlans: true,
    canManageFinances: true,
    canEditTrackCriteria: true,
    canManageSettings: true,
    canManageUsers: true,
    canManageTracks: true,
    canManageCircles: true,
    canEditScores: true,
    canExportReports: true
  },
  supervisor: {
    canRecordAttendance: true,
    canRecordRecitation: true,
    canGradeAtqini: true,
    canManageChallenges: true,
    canGradeExams: true,
    canEditStudents: true,
    canViewReports: true,
    canManagePlans: true,
    canManageFinances: false, // محصورة على الإدارة العليا فقط
    canEditTrackCriteria: false, // محصورة على الإدارة العليا فقط ما لم تمنح يدوياً
    canManageSettings: false,
    canManageUsers: false,
    canManageTracks: false,
    canManageCircles: true,
    canEditScores: true,
    canExportReports: true
  },
  teacher: {
    canRecordAttendance: true,
    canRecordRecitation: true,
    canGradeAtqini: true,
    canManageChallenges: true,
    canGradeExams: true,
    canEditStudents: false,
    canViewReports: false,
    canManagePlans: false,
    canManageFinances: false, // محصورة على الإدارة العليا فقط
    canEditTrackCriteria: false, // محصورة على الإدارة العليا فقط
    canManageSettings: false,
    canManageUsers: false,
    canManageTracks: false,
    canManageCircles: false,
    canEditScores: true,
    canExportReports: false
  }
};
