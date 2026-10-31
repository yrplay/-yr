export type UserRole = 'owner' | 'developer' | 'leader' | 'supervisor' | 'teacher';

export interface UserPermissions {
  canRecordAttendance: boolean;      // رصد الحضور والغياب اليومي
  canRecordRecitation: boolean;      // تسجيل التسميع وشروط الحفظ
  canGradeAtqini: boolean;           // تصحيح واجبات أتقني
  canManageChallenges: boolean;      // إدارة التحديات والمراجعة الثنائية
  canGradeExams: boolean;            // رصد درجات ومقررات الاختبارات
  canEditStudents: boolean;          // إضافة وتعديل ملفات الطالبات
  canViewReports: boolean;           // استعراض وتصدير التقارير
  canManagePlans: boolean;           // إدارة الخطط الشهرية
  canManageSettings: boolean;        // الوصول للإعدادات العامة
}

export const defaultPermissionsByRole: Record<UserRole, UserPermissions> = {
  owner: {
    canRecordAttendance: true,
    canRecordRecitation: true,
    canGradeAtqini: true,
    canManageChallenges: true,
    canGradeExams: true,
    canEditStudents: true,
    canViewReports: true,
    canManagePlans: true,
    canManageSettings: true,
  },
  developer: {
    canRecordAttendance: true,
    canRecordRecitation: true,
    canGradeAtqini: true,
    canManageChallenges: true,
    canGradeExams: true,
    canEditStudents: true,
    canViewReports: true,
    canManagePlans: true,
    canManageSettings: true,
  },
  leader: {
    canRecordAttendance: true,
    canRecordRecitation: true,
    canGradeAtqini: true,
    canManageChallenges: true,
    canGradeExams: true,
    canEditStudents: true,
    canViewReports: true,
    canManagePlans: true,
    canManageSettings: true,
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
    canManageSettings: false,
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
    canManageSettings: false,
  },
};

export interface User {
  id: string;
  name: string;
  role: UserRole;
  title: string;
  email: string;
  phone?: string;
  avatar?: string;
  avatarIcon?: string;    // الأيقونة الرمزية الإسلامية المختارة
  avatarColor?: string;   // لون الأيقونة المختار
  signatureUrl?: string; // توقيع المعلمة أو المشرفة المعتمد
  circleIds: string[]; // circles supervised or taught
  permissions?: Partial<UserPermissions>; // الصلاحيات المخصصة يدوياً
}

// 1. معايير دليل الإتقان (مشكاة الغيم) القابلة للتعديل
export interface MasteryGuideConfig {
  listenToReciterTimes: number;    // عدد مرات الاستماع للقارئ (مثلاً 3)
  reciteLookingTimes: number;       // عدد مرات التلاوة نظراً من المصحف (مثلاً 5)
  masteryRepetitionTimes: number;   // عدد مرات التكرار المتقن (مثلاً 20)
  minorRevisionAmount: string;      // مقدار المراجعة الصغرى (مثلاً: آخر 3 أوجه)
  tamkeenRevisionAmount: string;    // مقدار مراجعة التمكين (مثلاً: ربع حزب)
  pointsPerCondition: number;       // وزن كل شرط في النقاط
}

export const defaultMasteryGuideConfig: MasteryGuideConfig = {
  listenToReciterTimes: 3,
  reciteLookingTimes: 5,
  masteryRepetitionTimes: 20,
  minorRevisionAmount: 'آخر 3 أوجه',
  tamkeenRevisionAmount: 'ربع حزب',
  pointsPerCondition: 2
};

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

// تحديث كائن المسار الأساسي
export interface Track {
  id: string;
  name: string;
  code: string;
  description: string;              // نبذة ووصف المسار
  icon?: string;
  logoUrl?: string;                 // شعار المسار المرفوع
  subscriptionFee?: TrackSubscriptionFee;
  systemRules?: TrackSystemRules;
  isArchived: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Circle {
  id: string;
  trackId: string;
  name: string;
  icon: string;
  teacherId: string;
  teacherName: string;
  supervisorId: string;
  supervisorName: string;
  maxStudents: number;
  scheduleDays: string[]; // e.g. ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء"]
  startTime: string; // e.g. "16:00"
  endTime: string;   // e.g. "18:00"
  earlyPrepCutoffTime: string; // e.g. "15:45"
  isArchived: boolean;
  createdAt: string;
}

export type StudentStatus = 'active' | 'suspended' | 'withdrawn' | 'archived';

export interface Student {
  id: string;
  code: string;
  name: string;
  phone: string;
  email?: string;
  joinDate: string;
  status: StudentStatus;
  trackId: string;
  circleId: string;
  partnerStudentId?: string; // الرفيقة
  partnerStudentName?: string;
  notes?: string;
  avatar?: string;
  createdAt: string;
}

export interface MonthlyPlan {
  id: string;
  title: string;
  trackId: string;
  circleId?: string; // or applies to all circles in track
  hijriMonth: string;
  hijriYear: string;
  gregorianMonth?: string;
  gregorianYear?: string;
  startDateHijri: string;
  endDateHijri: string;
  examDateHijri: string;
  scheduleDays: string[];
  thursdayFocus: string; // e.g. "تحديات أسبوعية ومراجعة ثنائية"
  status: 'active' | 'archived' | 'draft';
  createdAt: string;
}

export interface StudentMonthlyPlan {
  id: string;
  studentId: string;
  monthlyPlanId: string;
  // الحفظ الجديد
  newMemorization: {
    fromSurah: number;
    fromAyah: number;
    toSurah: number;
    toAyah: number;
    targetPages: number;
    actualPages: number;
    targetDailyAmount: string; // مقدار الحفظ المطلوب يومياً
    actualDailyAmount?: string; // مقدار الحفظ الفعلي
    teacherNotes?: string;
  };
  // المراجعة
  revision: {
    fromSurah: number;
    fromAyah: number;
    toSurah: number;
    toAyah: number;
    targetPages: number;
    actualPages: number;
    revisionType: 'صغرى' | 'تمكين' | string;
    status: 'completed' | 'in_progress' | 'pending';
    teacherNotes?: string;
  };
  status: 'active' | 'completed' | 'paused';
}

// 3. سجلات اشتراكات ودفع الطالبات
export type PaymentStatus = 'paid' | 'partial' | 'pending' | 'exempt'; // مدفوع، جزئي، معلق، معفى
export type PaymentMethod = 'bank_transfer' | 'cash' | 'pos' | 'other';

export interface StudentSubscription {
  id: string;
  studentId: string;
  trackId: string;
  cycleMonth: string;               // الشهر/الفصل الدراسي (مثال: جمادى الأولى 1446)
  requiredAmount: number;           // المبلغ المطلوب
  paidAmount: number;               // المبلغ المدفوع
  status: PaymentStatus;
  paymentMethod?: PaymentMethod;
  paymentDate?: string;
  receiptNumber?: string;
  notes?: string;
  updatedAt: string;
}

// 4. سجل التسميع اليومي DailyRecord وفصل المراجعة الصغرى عن التمكين
export interface RevisionPortion {
  surahNumber: number;
  fromAyah: number;
  toAyah: number;
  pagesCount?: number;
  status: 'excellent' | 'acceptable' | 'needs_repetition' | 'unrecited';
}

export interface DailyRecord {
  id: string;
  studentId: string;
  circleId: string;
  date: string; // YYYY-MM-DD
  dayName: string; // الأحد، الاثنين، إلخ
  
  // المقرر المطلوب والمنجز
  requiredPortionText: string;
  newMemorizationCompleted: boolean;
  newMemorizationPages: number;
  revisionCompleted: boolean;
  revisionPages: number;

  // فصل المراجعة الصغرى ومراجعة التمكين تفصيلياً
  minorRevisionPortion?: RevisionPortion;
  tamkeenRevisionPortion?: RevisionPortion;
  
  // تقييم التسميع
  memorizationMistakes: number;  // أخطاء الحفظ
  hintsCount: number;            // عدد التنبيهات
  tajweedErrorsCount: number;    // عدد الأخطاء التجويدية
  recitationScore: number;       // درجة التسميع المحسوبة
  
  // شروط الحفظ المتقن (دليل مشكاة الغيم)
  conditions: {
    listenedToReader: boolean;   // الاستماع للقارئ المجوّد
    recitedLooking: boolean;     // التلاوة نظراً
    masteryRepetition: boolean;  // التكرار المتقن غيباً
    minorRevision: boolean;      // المراجعة الصغرى غيباً
    tamkeenRevision: boolean;    // مراجعة التمكين غيباً
    achievedDistinction: boolean;// هل حققت معيار التميز؟
  };
  
  status: 'completed' | 'partial' | 'incomplete' | 'unrecorded';
  notes: string;
  recordedBy: string;
  recordedAt: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  circleId: string;
  date: string; // YYYY-MM-DD
  status: 'present' | 'absent_unexcused' | 'absent_excused' | 'unrecorded';
  earlyPrepCardSent: boolean; // التحضير المبكر
  reason?: string;
  recordedBy: string;
  recordedAt: string;
}

// قسم «أتقني» - واجبات التجويد حصرياً
export interface AtqiniAssignment {
  id: string;
  trackId: string;
  circleId?: string; // if null, all circles in track
  title: string;
  tajweedRule: string; // عنوان الحكم التجويدي
  description: string; // شرح الحكم
  sheikhVideoUrl?: string; // رابط شرح الشيخ
  sheikhAudioUrl?: string;
  lessonImageUrl?: string; // صورة الدرس
  publishedDate: string;
  dueDate: string;
  requiredInstructions: string; // المطلوب من الطالبة
  examplesRequirement: string;  // الأمثلة المطلوب استخراجها من محفوظها
  recitationRuleApplication: string; // طريقة التطبيق أثناء التسميع
  maxScore: number;
}

export type AtqiniRating = 'ممتاز' | 'ممتاز جدًا' | 'جيد جدًا' | 'جيد' | 'يحتاج إلى تحسين' | 'لم يُنجز';

export interface StudentAtqiniSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  status: 'not_started' | 'in_progress' | 'completed';
  isCompletedCorrectly: boolean; // هل أتمت الواجب بالشكل المطلوب؟
  extractedExamplesDone: boolean; // هل استخرجت الأمثلة؟
  appliedDuringRecitation: boolean; // هل طبقت الحكم أثناء التسميع؟
  rating: AtqiniRating;
  score: number;
  teacherNotes: string;
  submittedAt?: string;
  evaluatedBy?: string;
}

// قسم التحديات القرآنية
export type ChallengeType = 'thursday_challenge' | 'grand_revision' | 'custom';

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
  repetitionRequirements: string; // مقدار التكرار والاستماع
  completionConditions: string;   // شروط إتمام التحدي
  dueDateDescription: string;
  maxTotalPoints: number;
  earlyPrepPoints: number;
  
  // المراجعة الثنائية وتعاون الرفيقة داخل التحديات
  includesPeerReview: boolean;
  peerReviewCriteria?: {
    commitmentToSyllabusPoints: number;     // الالتزام بالمقرر
    completedJointRevisionPoints: number;  // إتمام المراجعة المشتركة
    helpedDetectErrorsPoints: number;       // مساعدة الرفيقة على اكتشاف الأخطاء
    correctedErrorsPoints: number;          // تصحيح الأخطاء وفق الضوابط
    collaborationEtiquettePoints: number;   // التعاون والالتزام بآداب المراجعة
    onTimeDeliveryPoints: number;           // تسليم المهمة في الوقت المحدد
    maxPoints: number;
  };
  
  tasks: {
    id: string;
    name: string;
    maxPoints: number;
  }[];
  status: 'active' | 'upcoming' | 'completed';
  createdAt: string;
}

export interface StudentChallengeSubmission {
  id: string;
  challengeId: string;
  studentId: string;
  partnerStudentId?: string;
  partnerStudentName?: string;
  tasksCompleted: {
    taskId: string;
    completed: boolean;
    earnedPoints: number;
  }[];
  earlyPrepPointsEarned: number;
  peerReviewEvaluation?: {
    jointRevisionCompleted: boolean;
    commitmentScore: number;
    detectedErrorsScore: number;
    correctionScore: number;
    collaborationScore: number;
    onTimeScore: number;
    totalEarned: number;
    notes: string;
  };
  totalPointsEarned: number;
  teacherNotes: string;
  evaluatedBy?: string;
  evaluatedAt?: string;
}

// الاختبارات الشهرية والختامية
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
  customPortion?: string; // مقرر الاختبار الخاص بالطالبة (إذا كان مخصصاً لها)
  score: number;
  memorizationMistakes: number;
  tajweedErrors: number;
  warningsCount: number;
  notes: string;
  examinerName: string;
  evaluatedAt: string;
}

// نظام الدرجات والنسب المئوية
export interface GradingItemConfig {
  id: string;
  code: string;
  name: string;
  category: 'attendance' | 'early_prep' | 'perfect_week' | 'memorization' | 'conditions' | 'revision' | 'atqini' | 'thursday_challenge' | 'grand_revision' | 'peer_review' | 'exam' | 'custom';
  maxScore: number;
  weightPercentage: number; // e.g. 15 for 15%
  isMandatory: boolean;
  includesInFinalGrade: boolean;
  description: string;
}

export interface GradingScaleItem {
  minPercentage: number;
  label: string; // ممتاز مرتفع، ممتاز، جيد جداً مرتفع، ...
  letter: string; // أ+، أ، ب+، ...
  color: string;
}

export interface TrackGradingConfig {
  id: string;
  trackId: string;
  calculationMethod: 'points_ratio' | 'weighted_percentage';
  items: GradingItemConfig[];
  recitationFormula: {
    baseGrade: number;               // 10 or 100
    deductionPerMistake: number;     // e.g. 0.5
    deductionPerHint: number;        // e.g. 0.25
    deductionPerTajweedError: number;// e.g. 0.25
    maxDeduction: number;            // e.g. 10
    minGrade: number;                // e.g. 0
    newMemorizationWeight: number;   // e.g. 60%
    revisionWeight: number;          // e.g. 40%
  };
  attendanceRules: {
    presentScore: number;             // e.g. 5
    absentUnexcusedScore: number;     // e.g. 0
    absentExcusedScore: number;       // e.g. 2.5
    earlyPrepBonus: number;           // e.g. 1
    perfectWeekBonus: number;         // e.g. 5
  };
  gradeScale: GradingScaleItem[];
}

export interface InstitutionSettings {
  name: string;
  leaderName: string;
  subtitle: string;
  motto: string;
  academicYear: string;
  currentHijriMonth: string;
  supportEmail: string;
  supportPhone: string;
  notificationBanner?: string;
  welcomeTitle?: string; // عنوان الترحيب في لوحة التحكم
  welcomeSubtext?: string; // النص الترحيبي والوصف في لوحة التحكم
  
  // Customization & Visual Identity
  primaryColor?: string;
  secondaryColor?: string;
  buttonRadius?: 'rounded-xl' | 'rounded-2xl' | 'rounded-full';
  activeTrackName?: string;
  logoUrl?: string; // شعار المقرأة المرفوع من الجهاز
  fontFamily?: 'thmanyah-sans' | 'thmanyah-serif-display' | 'thmanyah-serif-text' | 'tajawal' | 'amiri';
  
  // Seal & Signatures
  sealType?: 'default_islamic' | 'custom_image' | 'royal_oval';
  sealText?: string;
  sealSubtitle?: string;
  sealImageUrl?: string; // صورة الختم المرفوعة
  leaderSignatureUrl?: string; // توقيع قائدة المقرأة المرفوع
  
  // Security controls
  securityEnabled?: boolean;
  
  // معايير دليل الإتقان الافتراضية للمقرأة (مشكاة الغيم)
  defaultMasteryGuide?: MasteryGuideConfig;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userName: string;
  userRole: UserRole;
  actionType: 'create' | 'update' | 'delete' | 'archive' | 'grade' | 'login' | 'backup' | 'restore';
  entity: string;
  entityId?: string;
  details: string;
}

export const hasFullAccess = (user: Pick<User, 'role'> | null | undefined): boolean =>
  user?.role === 'owner' || user?.role === 'developer' || user?.role === 'leader';

export const isPlatformOwner = (user: Pick<User, 'role'> | null | undefined): boolean =>
  user?.role === 'owner';

export const isTechnicalDeveloper = (user: Pick<User, 'role' | 'email'> | null | undefined): boolean =>
  user?.role === 'developer' || user?.email?.trim().toLowerCase() === 'yr.play.com@gmail.com';

