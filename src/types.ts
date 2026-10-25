export type UserRole = 'leader' | 'supervisor' | 'teacher';

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
  status: 'present' | 'absent_unexcused' | 'absent_excused' | 'late';
  earlyPrepCardSent: boolean;
  reason?: string;
  recordedBy: string;
  recordedAt: string;
}

// 11. واجبات التجويد «أتقني»
export interface AtqiniAssignment {
  id: string;
  trackId: string;
  title: string;
  tajweedRule: string;
  description: string;
  sheikhVideoUrl?: string;
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
  status: 'completed' | 'pending' | 'late';
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
  description: string;
  targetCount: number;
  points: number;
}

export interface Challenge {
  id: string;
  trackId: string;
  circleId?: string;
  title: string;
  type: string;
  description: string;
  startDate: string;
  endDate: string;
  requiredSurahs: string;
  repetitionRequirements: string;
  completionConditions: string;
  dueDateDescription: string;
  maxTotalPoints: number;
  earlyPrepPoints: number;
  includesPeerReview: boolean;
  tasks: ChallengeTask[];
  status: 'active' | 'completed';
  createdAt: string;
}

export interface StudentChallengeSubmission {
  id: string;
  challengeId: string;
  studentId: string;
  partnerStudentId?: string;
  partnerStudentName?: string;
  tasksCompleted: string[];
  earlyPrepPointsEarned: number;
  totalPointsEarned: number;
  peerReviewEvaluation?: {
    partnerRecitationScore: number;
    tajweedScore: number;
    totalEarned: number;
    notes: string;
  };
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
  category: 'attendance' | 'memorization' | 'conditions' | 'atqini' | 'thursday_challenge' | 'exam';
  name: string;
  weightPercentage: number;
  maxScore: number;
  includesInFinalGrade: boolean;
}

export interface GradeScaleItem {
  minPercentage: number;
  label: string;
  letter: string;
  color: string;
}

export interface TrackGradingConfig {
  id: string;
  trackId: string;
  calculationMethod: 'weighted_percentage' | 'total_points';
  recitationFormula: {
    baseScore: number;
    memorizationMistakeDeduction: number;
    hintDeduction: number;
    tajweedErrorDeduction: number;
  };
  attendanceRules: {
    pointsPerPresent: number;
    pointsPerExcusedAbsent: number;
    pointsPerUnexcusedAbsent: number;
    earlyPrepBonusPoints: number;
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
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: string;
}