import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHmac, timingSafeEqual, randomBytes, scryptSync } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial seed data
function getInitialDatabase() {
  return {
    currentUser: {
      id: "u-1",
      name: "ريفة المنصوري",
      role: "leader",
      title: "قائدة مقرأة غيث الغيم",
      email: "rifa@ghaym.org",
      phone: "+966500000001",
      circleIds: ["c-1", "c-2", "c-3"]
    },
    users: [
      {
        id: "u-1",
        name: "ريفة المنصوري",
        role: "leader",
        title: "قائدة مقرأة غيث الغيم",
        email: "rifa@ghaym.org",
        phone: "+966500000001",
        circleIds: ["c-1", "c-2", "c-3"]
      },
      {
        id: "u-2",
        name: "أ. خديجة العتيبي",
        role: "supervisor",
        title: "مشرفة مسار مشكاة الغيم",
        email: "khadija@ghaym.org",
        phone: "+966500000002",
        circleIds: ["c-1", "c-2", "c-3"]
      },
      {
        id: "u-3",
        name: "أ. مريم الدوسري",
        role: "teacher",
        title: "معلمة حلقة راسخات (١)",
        email: "maryam@ghaym.org",
        phone: "+966500000003",
        circleIds: ["c-1"]
      },
      {
        id: "u-4",
        name: "أ. فاطمة الشهري",
        role: "teacher",
        title: "معلمة حلقة راسخات (٢)",
        email: "fatima@ghaym.org",
        phone: "+966500000004",
        circleIds: ["c-2"]
      },
      {
        id: "u-5",
        name: "أ. هند القحطاني",
        role: "teacher",
        title: "معلمة حلقة راسخات (٣)",
        email: "hind@ghaym.org",
        phone: "+966500000005",
        circleIds: ["c-3"]
      }
    ],
    tracks: [
      {
        id: "t-1",
        name: "مشكاة الغيم للحفظ",
        code: "MG-MEM",
        description: "المسار التأسيسي والتمكيني لحفظ كتاب الله وضبطه وإتقانه وتطبيق أحكام التجويد وفق خطط مشكاة الغيم المعتمدة.",
        isArchived: false,
        createdAt: "2024-10-01T08:00:00Z",
        updatedAt: "2024-10-01T08:00:00Z"
      }
    ],
    circles: [
      {
        id: "c-1",
        trackId: "t-1",
        name: "راسخات (١) 🪴🤎",
        icon: "🪴",
        teacherId: "u-3",
        teacherName: "أ. مريم الدوسري",
        supervisorId: "u-2",
        supervisorName: "أ. خديجة العتيبي",
        maxStudents: 15,
        scheduleDays: ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء"],
        startTime: "16:00",
        endTime: "18:00",
        earlyPrepCutoffTime: "15:45",
        isArchived: false,
        createdAt: "2024-10-01T08:00:00Z"
      },
      {
        id: "c-2",
        trackId: "t-1",
        name: "راسخات (٢) 🪴🤎",
        icon: "🪴",
        teacherId: "u-4",
        teacherName: "أ. فاطمة الشهري",
        supervisorId: "u-2",
        supervisorName: "أ. خديجة العتيبي",
        maxStudents: 15,
        scheduleDays: ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء"],
        startTime: "16:30",
        endTime: "18:30",
        earlyPrepCutoffTime: "16:15",
        isArchived: false,
        createdAt: "2024-10-01T08:00:00Z"
      },
      {
        id: "c-3",
        trackId: "t-1",
        name: "راسخات (٣) 🪴🤎",
        icon: "🪴",
        teacherId: "u-5",
        teacherName: "أ. هند القحطاني",
        supervisorId: "u-2",
        supervisorName: "أ. خديجة العتيبي",
        maxStudents: 15,
        scheduleDays: ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء"],
        startTime: "17:00",
        endTime: "19:00",
        earlyPrepCutoffTime: "16:45",
        isArchived: false,
        createdAt: "2024-10-01T08:00:00Z"
      }
    ],
    students: [
      {
        id: "s-1",
        code: "GH-101",
        name: "سارة بنت خالد المطيري",
        phone: "0551112233",
        email: "sara.m@example.com",
        joinDate: "1446-02-15",
        status: "active",
        trackId: "t-1",
        circleId: "c-1",
        partnerStudentId: "s-2",
        partnerStudentName: "نورة بنت عبد الله السبيعي",
        notes: "طالبة متفوقة وملتزمة بشروط الحفظ المتقن والتحضير المبكر.",
        createdAt: "2024-10-01T08:00:00Z"
      },
      {
        id: "s-2",
        code: "GH-102",
        name: "نورة بنت عبد الله السبيعي",
        phone: "0552223344",
        email: "noura.s@example.com",
        joinDate: "1446-02-15",
        status: "active",
        trackId: "t-1",
        circleId: "c-1",
        partnerStudentId: "s-1",
        partnerStudentName: "سارة بنت خالد المطيري",
        notes: "رفيقة سارة في المراجعة الثنائية وتحدي الخميس.",
        createdAt: "2024-10-01T08:00:00Z"
      },
      {
        id: "s-3",
        code: "GH-103",
        name: "أروى بنت محمد الحربي",
        phone: "0553334455",
        email: "arwa.h@example.com",
        joinDate: "1446-02-18",
        status: "active",
        trackId: "t-1",
        circleId: "c-1",
        partnerStudentId: "s-4",
        partnerStudentName: "ريم بنت فهد الدوسري",
        notes: "صوت ندي في الترتيل والتزام عالي بالواجبات التجويدية.",
        createdAt: "2024-10-01T08:00:00Z"
      },
      {
        id: "s-4",
        code: "GH-104",
        name: "ريم بنت فهد الدوسري",
        phone: "0554445566",
        email: "reem.d@example.com",
        joinDate: "1446-02-20",
        status: "active",
        trackId: "t-1",
        circleId: "c-1",
        partnerStudentId: "s-3",
        partnerStudentName: "أروى بنت محمد الحربي",
        notes: "تحتاج إلى تمكين أحكام الإظهار الحلقي وضبط مخارج الحروف.",
        createdAt: "2024-10-01T08:00:00Z"
      },
      {
        id: "s-5",
        code: "GH-105",
        name: "شهد بنت عبد العزيز العتيبي",
        phone: "0555556677",
        email: "shahad.o@example.com",
        joinDate: "1446-03-01",
        status: "active",
        trackId: "t-1",
        circleId: "c-1",
        notes: "انضمت حديثاً، تسير وفق خطة الاستدراك.",
        createdAt: "2024-10-01T08:00:00Z"
      },
      {
        id: "s-6",
        code: "GH-201",
        name: "وفاء بنت صالح العمري",
        phone: "0556667788",
        email: "wafaa.o@example.com",
        joinDate: "1446-02-15",
        status: "active",
        trackId: "t-1",
        circleId: "c-2",
        partnerStudentId: "s-7",
        partnerStudentName: "أسماء بنت إبراهيم الغامدي",
        notes: "أداء متميز في التحديات القرآنية.",
        createdAt: "2024-10-01T08:00:00Z"
      },
      {
        id: "s-7",
        code: "GH-202",
        name: "أسماء بنت إبراهيم الغامدي",
        phone: "0557778899",
        email: "asmaa.g@example.com",
        joinDate: "1446-02-15",
        status: "active",
        trackId: "t-1",
        circleId: "c-2",
        partnerStudentId: "s-6",
        partnerStudentName: "وفاء بنت صالح العمري",
        notes: "حضور تام والتزام ممتاز.",
        createdAt: "2024-10-01T08:00:00Z"
      },
      {
        id: "s-8",
        code: "GH-203",
        name: "لطيفة بنت حمد الشمري",
        phone: "0558889900",
        email: "latifa.s@example.com",
        joinDate: "1446-03-05",
        status: "active",
        trackId: "t-1",
        circleId: "c-2",
        notes: "تأخرت في جلستين بعذر مقبول.",
        createdAt: "2024-10-01T08:00:00Z"
      },
      {
        id: "s-9",
        code: "GH-301",
        name: "مها بنت فهد السليمان",
        phone: "0559990011",
        email: "maha.s@example.com",
        joinDate: "1446-02-15",
        status: "active",
        trackId: "t-1",
        circleId: "c-3",
        partnerStudentId: "s-10",
        partnerStudentName: "عبير بنت تركي المالكي",
        notes: "حفظ متقن ومتميز.",
        createdAt: "2024-10-01T08:00:00Z"
      },
      {
        id: "s-10",
        code: "GH-302",
        name: "عبير بنت تركي المالكي",
        phone: "0550001122",
        email: "abeer.m@example.com",
        joinDate: "1446-02-15",
        status: "active",
        trackId: "t-1",
        circleId: "c-3",
        partnerStudentId: "s-9",
        partnerStudentName: "مها بنت فهد السليمان",
        notes: "تعاون مثمر مع الرفيقة في المراجعة الثنائية.",
        createdAt: "2024-10-01T08:00:00Z"
      }
    ],
    monthlyPlans: [
      {
        id: "mp-1",
        title: "الخطة الأولى: خطة الحفظ والتمكين - ربيع الآخر وجمادى الأولى",
        trackId: "t-1",
        hijriMonth: "ربيع الآخر - جمادى الأولى",
        hijriYear: "1446",
        startDateHijri: "٣٠ ربيع الآخر",
        endDateHijri: "٢٩ جمادى الأولى",
        examDateHijri: "٢٥ جمادى الأولى",
        scheduleDays: ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء"],
        thursdayFocus: "مخصص للتحديات والمراجعة الثنائية بحسب التحدي المعتمد",
        status: "active",
        createdAt: "2024-10-01T08:00:00Z"
      }
    ],
    studentPlans: [
      {
        id: "sp-1",
        studentId: "s-1",
        monthlyPlanId: "mp-1",
        newMemorization: {
          fromSurah: 2,
          fromAyah: 1,
          toSurah: 2,
          toAyah: 50,
          targetPages: 8,
          actualPages: 8,
          targetDailyAmount: "صفحة واحدة يومياً",
          actualDailyAmount: "صفحة واحدة يومياً",
          teacherNotes: "إتقان ممتاز لمخارج الحروف والوقف والابتداء"
        },
        revision: {
          fromSurah: 1,
          fromAyah: 1,
          toSurah: 2,
          toAyah: 25,
          targetPages: 4,
          actualPages: 4,
          revisionType: "تمكين",
          status: "completed",
          teacherNotes: "تمكين تام بدون تردد"
        },
        status: "active"
      },
      {
        id: "sp-2",
        studentId: "s-2",
        monthlyPlanId: "mp-1",
        newMemorization: {
          fromSurah: 2,
          fromAyah: 1,
          toSurah: 2,
          toAyah: 50,
          targetPages: 8,
          actualPages: 7,
          targetDailyAmount: "صفحة واحدة يومياً",
          actualDailyAmount: "صفحة إلا ربع",
          teacherNotes: "إنجاز طيب ومستمر"
        },
        revision: {
          fromSurah: 1,
          fromAyah: 1,
          toSurah: 2,
          toAyah: 20,
          targetPages: 3,
          actualPages: 3,
          revisionType: "صغرى",
          status: "completed"
        },
        status: "active"
      },
      {
        id: "sp-3",
        studentId: "s-3",
        monthlyPlanId: "mp-1",
        newMemorization: {
          fromSurah: 2,
          fromAyah: 51,
          toSurah: 2,
          toAyah: 90,
          targetPages: 7,
          actualPages: 7,
          targetDailyAmount: "صفحة واحدة يومياً",
          actualDailyAmount: "صفحة يومياً"
        },
        revision: {
          fromSurah: 2,
          fromAyah: 1,
          toSurah: 2,
          toAyah: 50,
          targetPages: 8,
          actualPages: 8,
          revisionType: "تمكين",
          status: "completed"
        },
        status: "active"
      }
    ],
    dailyRecords: [
      {
        id: "dr-1",
        studentId: "s-1",
        circleId: "c-1",
        date: "2024-11-03",
        dayName: "الأحد",
        requiredPortionText: "البقرة: آية ١ إلى ١٠",
        newMemorizationCompleted: true,
        newMemorizationPages: 1,
        revisionCompleted: true,
        revisionPages: 2,
        memorizationMistakes: 0,
        hintsCount: 0,
        tajweedErrorsCount: 0,
        recitationScore: 10,
        conditions: {
          listenedToReader: true,
          recitedLooking: true,
          masteryRepetition: true,
          minorRevision: true,
          tamkeenRevision: true,
          achievedDistinction: true
        },
        status: "completed",
        notes: "قراءة متقنة ومجودة ما شاء الله",
        recordedBy: "أ. مريم الدوسري",
        recordedAt: "2024-11-03T16:45:00Z"
      },
      {
        id: "dr-2",
        studentId: "s-2",
        circleId: "c-1",
        date: "2024-11-03",
        dayName: "الأحد",
        requiredPortionText: "البقرة: آية ١ إلى ١٠",
        newMemorizationCompleted: true,
        newMemorizationPages: 1,
        revisionCompleted: true,
        revisionPages: 2,
        memorizationMistakes: 1,
        hintsCount: 1,
        tajweedErrorsCount: 0,
        recitationScore: 9.25,
        conditions: {
          listenedToReader: true,
          recitedLooking: true,
          masteryRepetition: true,
          minorRevision: true,
          tamkeenRevision: false,
          achievedDistinction: false
        },
        status: "completed",
        notes: "تردد يسير في آية ٧، تم التنبيه والتصويب فوراً",
        recordedBy: "أ. مريم الدوسري",
        recordedAt: "2024-11-03T16:50:00Z"
      },
      {
        id: "dr-3",
        studentId: "s-3",
        circleId: "c-1",
        date: "2024-11-03",
        dayName: "الأحد",
        requiredPortionText: "البقرة: آية ٥١ إلى ٥٧",
        newMemorizationCompleted: true,
        newMemorizationPages: 1,
        revisionCompleted: true,
        revisionPages: 3,
        memorizationMistakes: 0,
        hintsCount: 1,
        tajweedErrorsCount: 0,
        recitationScore: 9.75,
        conditions: {
          listenedToReader: true,
          recitedLooking: true,
          masteryRepetition: true,
          minorRevision: true,
          tamkeenRevision: true,
          achievedDistinction: true
        },
        status: "completed",
        notes: "أداء رائع مع الرفيقة",
        recordedBy: "أ. مريم الدوسري",
        recordedAt: "2024-11-03T17:10:00Z"
      }
    ],
    attendanceRecords: [
      {
        id: "att-1",
        studentId: "s-1",
        circleId: "c-1",
        date: "2024-11-03",
        status: "present",
        earlyPrepCardSent: true,
        recordedBy: "أ. مريم الدوسري",
        recordedAt: "2024-11-03T15:40:00Z"
      },
      {
        id: "att-2",
        studentId: "s-2",
        circleId: "c-1",
        date: "2024-11-03",
        status: "present",
        earlyPrepCardSent: true,
        recordedBy: "أ. مريم الدوسري",
        recordedAt: "2024-11-03T15:42:00Z"
      },
      {
        id: "att-3",
        studentId: "s-3",
        circleId: "c-1",
        date: "2024-11-03",
        status: "present",
        earlyPrepCardSent: true,
        recordedBy: "أ. مريم الدوسري",
        recordedAt: "2024-11-03T15:35:00Z"
      },
      {
        id: "att-4",
        studentId: "s-4",
        circleId: "c-1",
        date: "2024-11-03",
        status: "absent_excused",
        earlyPrepCardSent: false,
        reason: "ظرف صحي طارئ وتم إشعار الإدارة",
        recordedBy: "أ. مريم الدوسري",
        recordedAt: "2024-11-03T16:00:00Z"
      },
      {
        id: "att-5",
        studentId: "s-5",
        circleId: "c-1",
        date: "2024-11-03",
        status: "present",
        earlyPrepCardSent: false,
        recordedBy: "أ. مريم الدوسري",
        recordedAt: "2024-11-03T16:05:00Z"
      }
    ],
    atqiniAssignments: [
      {
        id: "atq-1",
        trackId: "t-1",
        title: "واجب التجويد الأسبوعي: حكم الإظهار الحلقي",
        tajweedRule: "الإظهار الحلقي (أحكام النون الساكنة والتنوين)",
        description: "الإظهار الحلقي هو إخراج النون الساكنة أو التنوين من مخرجهما بغير غنة ظاهرة إذا جاء بعدهما أحد حروف الحلق الستة: الهمزة، الهاء، العين، الحاء، الغين، الخاء (أخي هاك علماً حازه غير خاسر).",
        sheikhVideoUrl: "https://www.youtube.com/watch?v=sampleTajweed1",
        publishedDate: "2024-11-01",
        dueDate: "2024-11-07",
        requiredInstructions: "مشاهدة شرح الحكم وتدوين الخلاصة، ثم استخراج الأمثلة من مقرر الحفظ، وإظهار النطق السليم عند التسميع للمعلمة.",
        examplesRequirement: "استخراج ٦ أمثلة: مثالين للنون في كلمة، ومثالين في كلمتين، ومثالين للتنوين.",
        recitationRuleApplication: "تطبيق الإظهار الصافي دون سكت أو تمطيط أثناء تسميع جلسة يوم الأربعاء.",
        maxScore: 10
      },
      {
        id: "atq-2",
        trackId: "t-1",
        title: "واجب التجويد: أحكام الميم الساكنة (الإخفاء الشفوي)",
        tajweedRule: "الإخفاء الشفوي للميم الساكنة عند حرف الباء",
        description: "بيان تلامس الشفتين برفق مع إخراج الغنة بمقدار حركتين عند ملاقاة الميم الساكنة لحرف الباء.",
        sheikhVideoUrl: "https://www.youtube.com/watch?v=sampleTajweed2",
        publishedDate: "2024-11-08",
        dueDate: "2024-11-14",
        requiredInstructions: "استخراج ٤ أمثلة وتطبيقها بدقة.",
        examplesRequirement: "استخراج ٤ أمثلة من محفوظك في سورة البقرة.",
        recitationRuleApplication: "عدم كز الشفتين ومراعاة انسياب الغنة.",
        maxScore: 10
      }
    ],
    studentAtqiniSubmissions: [
      {
        id: "atqs-1",
        assignmentId: "atq-1",
        studentId: "s-1",
        status: "completed",
        isCompletedCorrectly: true,
        extractedExamplesDone: true,
        appliedDuringRecitation: true,
        rating: "ممتاز",
        score: 10,
        teacherNotes: "استخراج دقيق وأداء ناصع للحكم أثناء التسميع.",
        submittedAt: "2024-11-04T14:30:00Z",
        evaluatedBy: "أ. مريم الدوسري"
      },
      {
        id: "atqs-2",
        assignmentId: "atq-1",
        studentId: "s-2",
        status: "completed",
        isCompletedCorrectly: true,
        extractedExamplesDone: true,
        appliedDuringRecitation: true,
        rating: "جيد جدًا",
        score: 9,
        teacherNotes: "الأمثلة صحيحة ومحتاجة ضبط حرف الخاء برفق.",
        submittedAt: "2024-11-05T15:00:00Z",
        evaluatedBy: "أ. مريم الدوسري"
      },
      {
        id: "atqs-3",
        assignmentId: "atq-1",
        studentId: "s-3",
        status: "in_progress",
        isCompletedCorrectly: false,
        extractedExamplesDone: true,
        appliedDuringRecitation: false,
        rating: "جيد",
        score: 7,
        teacherNotes: "تم استخراج الأمثلة وبانتظار جلسة التطبيق العملي.",
        submittedAt: "2024-11-05T18:00:00Z",
        evaluatedBy: "أ. مريم الدوسري"
      }
    ],
    challenges: [
      {
        id: "ch-1",
        trackId: "t-1",
        circleId: "c-1",
        title: "تحدي الخميس القرآني: تمكين سورة البقرة والمراجعة الثنائية",
        type: "thursday_challenge",
        description: "تحدي أسبوعي يوم الخميس لتكثيف السماع وتكرار المحفوظ والمراجعة الثنائية مع الرفيقة واكتشاف الأخطاء.",
        startDate: "2024-11-07",
        endDate: "2024-11-07",
        startTime: "16:00",
        endTime: "20:00",
        requiredSurahs: "سورة البقرة: من الآية ١ إلى الآية ٢٥",
        repetitionRequirements: "الاستماع مرتين بصوت الشيخ الحصري + التكرار ٥ مرات غيباً",
        completionConditions: "إتمام الاستماع والتكرار، والتسميع للرفيقة، ورصد الأخطاء المتبادلة في استمارة التحدي.",
        dueDateDescription: "تسليم الاستمارة قبل الساعة ٨:٠٠ مساءً",
        maxTotalPoints: 10,
        earlyPrepPoints: 2,
        includesPeerReview: true,
        peerReviewCriteria: {
          commitmentToSyllabusPoints: 2,
          completedJointRevisionPoints: 2,
          helpedDetectErrorsPoints: 2,
          correctedErrorsPoints: 1,
          collaborationEtiquettePoints: 1,
          onTimeDeliveryPoints: 2,
          maxPoints: 10
        },
        tasks: [
          { id: "task-1", name: "الاستماع المجود للمقرر مرتين", maxPoints: 2 },
          { id: "task-2", name: "التكرار الفردي المتقن غيباً ٥ مرات", maxPoints: 2 },
          { id: "task-3", name: "المراجعة الثنائية مع الرفيقة والتصحيح المتبادل", maxPoints: 4 },
          { id: "task-4", name: "التحضير المبكر وإرسال بطاقة الإنجاز", maxPoints: 2 }
        ],
        status: "active",
        createdAt: "2024-11-01T08:00:00Z"
      },
      {
        id: "ch-2",
        trackId: "t-1",
        title: "تحدي المراجعة الكبرى: ركائز التمكين لربع الحزب الأول",
        type: "grand_revision",
        description: "تحدي مراجعة كبرى شاملة لسرد المحفوظ سرداً متصلاً دون أخطاء أو تردد لاختبار الجاهزية للاختبار الشهري.",
        startDate: "2024-11-15",
        endDate: "2024-11-17",
        requiredSurahs: "سورة البقرة: من الآية ١ إلى الآية ٥٠ (٨ صفحات)",
        repetitionRequirements: "سرد كامل ومراجعة متصلة",
        completionConditions: "سرد المقاطع في جلسة واحدة بأقل من خطأين",
        dueDateDescription: "الأحد قبل بدء الحلقة",
        maxTotalPoints: 20,
        earlyPrepPoints: 0,
        includesPeerReview: false,
        tasks: [
          { id: "gr-1", name: "سرد الجزء الأول بدون توقف", maxPoints: 10 },
          { id: "gr-2", name: "سرد الجزء الثاني مع تطبيق أحكام التجويد", maxPoints: 10 }
        ],
        status: "upcoming",
        createdAt: "2024-11-01T08:00:00Z"
      }
    ],
    studentChallengeSubmissions: [
      {
        id: "cs-1",
        challengeId: "ch-1",
        studentId: "s-1",
        partnerStudentId: "s-2",
        partnerStudentName: "نورة بنت عبد الله السبيعي",
        tasksCompleted: [
          { taskId: "task-1", completed: true, earnedPoints: 2 },
          { taskId: "task-2", completed: true, earnedPoints: 2 },
          { taskId: "task-3", completed: true, earnedPoints: 4 },
          { taskId: "task-4", completed: true, earnedPoints: 2 }
        ],
        earlyPrepPointsEarned: 2,
        peerReviewEvaluation: {
          jointRevisionCompleted: true,
          commitmentScore: 2,
          detectedErrorsScore: 2,
          correctionScore: 1,
          collaborationScore: 1,
          onTimeScore: 2,
          totalEarned: 8,
          notes: "تعاون مثالي مع الرفيقة نورة ومساعدة فعالة في تثبيت آيات الربع الأول."
        },
        totalPointsEarned: 10,
        teacherNotes: "إنجاز مكتمل ومبهر في تحدي الخميس 🌟",
        evaluatedBy: "أ. مريم الدوسري",
        evaluatedAt: "2024-11-07T19:30:00Z"
      },
      {
        id: "cs-2",
        challengeId: "ch-1",
        studentId: "s-2",
        partnerStudentId: "s-1",
        partnerStudentName: "سارة بنت خالد المطيري",
        tasksCompleted: [
          { taskId: "task-1", completed: true, earnedPoints: 2 },
          { taskId: "task-2", completed: true, earnedPoints: 2 },
          { taskId: "task-3", completed: true, earnedPoints: 3.5 },
          { taskId: "task-4", completed: true, earnedPoints: 2 }
        ],
        earlyPrepPointsEarned: 2,
        peerReviewEvaluation: {
          jointRevisionCompleted: true,
          commitmentScore: 2,
          detectedErrorsScore: 1.5,
          correctionScore: 1,
          collaborationScore: 1,
          onTimeScore: 2,
          totalEarned: 7.5,
          notes: "أداء ممتاز وتفاعل مميز مع الرفيقة سارة."
        },
        totalPointsEarned: 9.5,
        teacherNotes: "بارك الله في همتكما يا رفيقات الخير.",
        evaluatedBy: "أ. مريم الدوسري",
        evaluatedAt: "2024-11-07T19:35:00Z"
      }
    ],
    monthlyExams: [
      {
        id: "ex-1",
        trackId: "t-1",
        circleId: "c-1",
        monthlyPlanId: "mp-1",
        title: "الاختبار الشهري التمكيني - جمادى الأولى ١٤٤٦هـ",
        examDateHijri: "٢٥ جمادى الأولى",
        examDateGregorian: "2024-11-27",
        requiredPortion: "سورة البقرة: من الآية ١ إلى الآية ٧٥",
        maxScore: 100,
        notes: "يشمل أسئلة الحفظ والتسميع وأسئلة أحكام التجويد العملية.",
        createdAt: "2024-10-15T08:00:00Z"
      }
    ],
    studentExamResults: [
      {
        id: "er-1",
        examId: "ex-1",
        studentId: "s-1",
        score: 98,
        memorizationMistakes: 0,
        tajweedErrors: 1,
        warningsCount: 1,
        notes: "حفظ متقن ومثبت كالجبال الراسية، بارك الله فيها ونفع بها.",
        examinerName: "ريفة المنصوري (قائدة المقرأة)",
        evaluatedAt: "2024-11-27T17:00:00Z"
      },
      {
        id: "er-2",
        examId: "ex-1",
        studentId: "s-2",
        score: 93,
        memorizationMistakes: 1,
        tajweedErrors: 1,
        warningsCount: 2,
        notes: "أداء متميز وتثبيت رائع للمحفوظ.",
        examinerName: "أ. خديجة العتيبي (المشرفة)",
        evaluatedAt: "2024-11-27T17:30:00Z"
      }
    ],
    gradingConfigs: [
      {
        id: "gc-1",
        trackId: "t-1",
        calculationMethod: "weighted_percentage",
        items: [
          {
            id: "gi-1",
            code: "attendance",
            name: "الحضور اليومي",
            category: "attendance",
            maxScore: 10,
            weightPercentage: 10,
            isMandatory: true,
            includesInFinalGrade: true,
            description: "نسبة الالتزام بحضور جلسات الحلقة في المواعيد المحددة"
          },
          {
            id: "gi-2",
            code: "early_prep",
            name: "التحضير المبكر",
            category: "early_prep",
            maxScore: 5,
            weightPercentage: 5,
            isMandatory: false,
            includesInFinalGrade: true,
            description: "إرسال بطاقة التحضير المبكر قبل الوقت المحدد للحلقة"
          },
          {
            id: "gi-3",
            code: "memorization",
            name: "الحفظ الجديد المتقن",
            category: "memorization",
            maxScore: 25,
            weightPercentage: 25,
            isMandatory: true,
            includesInFinalGrade: true,
            description: "درجة إتقان الحفظ الجديد اليومي بعد احتساب الخصومات"
          },
          {
            id: "gi-4",
            code: "conditions",
            name: "استيفاء شروط الحفظ (دليل مشكاة)",
            category: "conditions",
            maxScore: 10,
            weightPercentage: 10,
            isMandatory: true,
            includesInFinalGrade: true,
            description: "الاستماع للقارئ، التلاوة نظراً، التكرار المتقن، ومعيار التميز"
          },
          {
            id: "gi-5",
            code: "revision",
            name: "المراجعة اليومية والتمكين",
            category: "revision",
            maxScore: 15,
            weightPercentage: 15,
            isMandatory: true,
            includesInFinalGrade: true,
            description: "المراجعة الصغرى ومراجعة التمكين للمحفوظ السابق"
          },
          {
            id: "gi-6",
            code: "atqini",
            name: "واجبات التجويد «أتقني»",
            category: "atqini",
            maxScore: 10,
            weightPercentage: 10,
            isMandatory: true,
            includesInFinalGrade: true,
            description: "حل واستخراج واجبات التجويد وتطبيقها أثناء التسميع"
          },
          {
            id: "gi-7",
            code: "thursday_challenge",
            name: "تحدي الخميس والمراجعة الثنائية",
            category: "thursday_challenge",
            maxScore: 10,
            weightPercentage: 10,
            isMandatory: true,
            includesInFinalGrade: true,
            description: "إنجاز مهام تحدي الخميس وتعاون الرفيقة في المراجعة الثنائية"
          },
          {
            id: "gi-8",
            code: "exam",
            name: "الاختبار الشهري التمكيني",
            category: "exam",
            maxScore: 15,
            weightPercentage: 15,
            isMandatory: true,
            includesInFinalGrade: true,
            description: "درجة الاختبار الختامي في نهاية الخطة الشهرية"
          }
        ],
        recitationFormula: {
          baseGrade: 10,
          deductionPerMistake: 0.5,
          deductionPerHint: 0.25,
          deductionPerTajweedError: 0.25,
          maxDeduction: 10,
          minGrade: 0,
          newMemorizationWeight: 60,
          revisionWeight: 40
        },
        attendanceRules: {
          presentScore: 5,
          absentUnexcusedScore: 0,
          absentExcusedScore: 2.5,
          earlyPrepBonus: 1,
          perfectWeekBonus: 5
        },
        gradeScale: [
          { minPercentage: 95, label: "ممتاز مرتفع", letter: "أ+", color: "#2D5A43" },
          { minPercentage: 90, label: "ممتاز", letter: "أ", color: "#3E6B48" },
          { minPercentage: 85, label: "جيد جداً مرتفع", letter: "ب+", color: "#4A6E5D" },
          { minPercentage: 80, label: "جيد جداً", letter: "ب", color: "#6A7B68" },
          { minPercentage: 75, label: "جيد مرتفع", letter: "ج+", color: "#8E7D5B" },
          { minPercentage: 70, label: "جيد", letter: "ج", color: "#A88450" },
          { minPercentage: 60, label: "مقبول", letter: "د", color: "#B8624E" },
          { minPercentage: 0, label: "يحتاج لمتابعة", letter: "هـ", color: "#9E3C3C" }
        ]
      }
    ],
    settings: {
      name: "غيث الغيم",
      leaderName: "ريفة المنصوري",
      subtitle: "المقرأة القرآنية النموذجية",
      motto: "غيثٌ يهمي على القلوب ليحيي بها معالم الوحي والرسوخ",
      academicYear: "١٤٤٦ - ١٤٤٧ هـ / ٢٠٢٤ - ٢٠٢٥ م",
      currentHijriMonth: "ربيع الآخر - جمادى الأولى",
      supportEmail: "info@ghaym.org",
      supportPhone: "0500000001",
      notificationBanner: "مرحباً بكم في منصة غيث الغيم الإدارية المتكاملة 🪴 مرحلة انطلاق الخطة الأولى لمسار مشكاة الغيم للحفظ",
      primaryColor: "#8E5364",
      secondaryColor: "#2D5A43",
      buttonRadius: "rounded-2xl",
      activeTrackName: "مشكاة الغيم للحفظ",
      securityEnabled: true,
      leaderPasscode: ""
    },
    auditLogs: [
      {
        id: "log-1",
        timestamp: new Date().toISOString(),
        userName: "ريفة المنصوري",
        userRole: "leader",
        actionType: "create",
        entity: "system",
        details: "تهيئة النظام واعتماد مسار مشكاة الغيم وحلقات راسخات (١، ٢، ٣)"
      }
    ]
  };
}

// Helper to safely get user info
function getCurrentUserInfo(db: any) {
  return {
    name: db?.currentUser?.name || db?.users?.[0]?.name || 'ريفة المنصوري',
    role: db?.currentUser?.role || db?.users?.[0]?.role || 'leader'
  };
}

// Read database from disk or init
function readDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (!parsed.currentUser && parsed.users && parsed.users.length > 0) {
        parsed.currentUser = parsed.users[0];
      }
      if (!parsed.currentUser) {
        parsed.currentUser = {
          id: "u-1",
          name: "ريفة المنصوري",
          role: "leader",
          title: "قائدة مقرأة غيث الغيم"
        };
      }
      if (parsed.settings) {
        if (!parsed.settings.primaryColor) parsed.settings.primaryColor = "#8E5364";
        if (!parsed.settings.secondaryColor) parsed.settings.secondaryColor = "#2D5A43";
        if (!parsed.settings.buttonRadius) parsed.settings.buttonRadius = "rounded-2xl";
        if (!parsed.settings.activeTrackName) parsed.settings.activeTrackName = "مشكاة الغيم للحفظ";
        if (parsed.settings.securityEnabled === undefined) parsed.settings.securityEnabled = true;
      }
      return parsed;
    }
  } catch (err) {
    console.error('Error reading database file:', err);
  }
  const initial = getInitialDatabase();
  writeDatabase(initial);
  return initial;
}

// Write database atomically
function writeDatabase(data: any) {
  try {
    const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('Error writing database file:', err);
  }
}

// Log audit action with bulletproof fallbacks
function addAudit(db: any, userName: any, userRole: any, actionType: any, entity: string, details: string, entityId?: string) {
  try {
    const fallbackUser = getCurrentUserInfo(db);
    const finalName = (typeof userName === 'string' && userName.trim()) ? userName : fallbackUser.name;
    const finalRole = userRole || fallbackUser.role;
    const newLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      userName: finalName,
      userRole: finalRole,
      actionType,
      entity,
      entityId,
      details
    };
    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift(newLog);
    // Keep last 500 logs
    if (db.auditLogs.length > 500) {
      db.auditLogs = db.auditLogs.slice(0, 500);
    }
  } catch (err) {
    console.warn('addAudit error suppressed:', err);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // Cross-origin access is opt-in. Same-origin frontend requests need no CORS headers.
  const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean));
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(origin && !allowedOrigins.has(origin) ? 403 : 204);
    next();
  });

  // API Router
  const api = express.Router();

  const SESSION_COOKIE = 'ghaith_session';
  const SESSION_TTL_SECONDS = 8 * 60 * 60;

  function sessionSecret() {
    const secret = process.env.SESSION_SECRET || '';
    if (secret.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters');
    return secret;
  }

  function hashPasscode(passcode: string) {
    const salt = randomBytes(16).toString('hex');
    const digest = scryptSync(passcode, salt, 64).toString('hex');
    return `scrypt${salt}${digest}`;
  }

  function verifyPasscode(passcode: string, stored: string) {
    if (stored.startsWith('scrypt
  function createSession(user: any) {
    const payload = Buffer.from(JSON.stringify({
      userId: user.id,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
    })).toString('base64url');
    const signature = createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
    return payload + '.' + signature;
  }

  function getSession(req: express.Request): { userId: string; role: string; exp: number } | null {
    try {
      const cookieHeader = req.headers.cookie || '';
      const token = cookieHeader.split(';').map(v => v.trim()).find(v => v.startsWith(SESSION_COOKIE + '='))?.slice(SESSION_COOKIE.length + 1);
      if (!token) return null;
      const parts = token.split('.');
      if (parts.length !== 2) return null;
      const expected = createHmac('sha256', sessionSecret()).update(parts[0]).digest();
      const supplied = Buffer.from(parts[1], 'base64url');
      if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
      const session = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      if (!session.userId || !session.role || !Number.isFinite(session.exp) || session.exp <= Math.floor(Date.now() / 1000)) return null;
      return session;
    } catch {
      return null;
    }
  }

  function setSessionCookie(res: express.Response, token: string) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure}`);
  }

  function clearSessionCookie(res: express.Response) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`);
  }



  // Health check
  api.get('/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Public login directory: expose only the minimum fields needed by the sign-in selector.
  // Never send student records, staff contact details, or credentials before authentication.
  api.get('/auth/users', (_req, res) => {
    const db = readDatabase();
    res.setHeader('Cache-Control', 'no-store');
    res.json(db.users.map((user: any) => ({
      id: user.id,
      name: user.name,
      role: user.role,
      title: user.title,
      avatarIcon: user.avatarIcon,
      avatarColor: user.avatarColor
    })));
  });

  // Login is the only public data-adjacent endpoint. Configure SESSION_SECRET and
  // GHAYM_INITIAL_LEADER_PASSCODE before deploying; no built-in PIN is accepted.
  api.post('/auth/login', (req, res) => {
    let secret: string;
    try { secret = sessionSecret(); } catch { return res.status(503).json({ error: 'لم يتم إعداد أمان الجلسات على الخادم' }); }
    const userId = typeof req.body?.userId === 'string' ? req.body.userId : '';
    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode.trim() : '';
    if (!userId || !passcode || passcode.length > 128) return res.status(400).json({ error: 'اسم المستخدم والرمز السري مطلوبان' });
    const db = readDatabase();
    const user = db.users.find((u: any) => u.id === userId);
    if (!user) return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    const configuredPasscode = typeof user.passcode === 'string' ? user.passcode : '';
    const bootstrapPasscode = user.role === 'leader' && !configuredPasscode
      ? (process.env.GHAYM_INITIAL_LEADER_PASSCODE || '')
      : '';
    const valid = (configuredPasscode.length > 0 && verifyPasscode(passcode, configuredPasscode)) ||
      (bootstrapPasscode.length > 0 && verifyPasscode(passcode, bootstrapPasscode));
    if (!valid) return res.status(401).json({ error: 'بيانات الدخول غير صحيحة أو لم يتم إعداد رمز لهذا الحساب' });

    // Upgrade legacy PINs and one-time bootstrap credentials to salted hashes at first login.
    if (!configuredPasscode || !configuredPasscode.startsWith('scrypt
    res.setHeader('Cache-Control', 'no-store');
    const { passcode: _passcode, ...safeUser } = user;
    return res.json({ success: true, user: safeUser });
  });

  api.post('/auth/logout', (_req, res) => {
    clearSessionCookie(res);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true });
  });

  // Every other API route requires a signed, expiring server-side identity.
  api.use((req, res, next) => {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'يلزم تسجيل الدخول للوصول إلى هذه البيانات' });
    const db = readDatabase();
    const user = db.users.find((u: any) => u.id === session.userId);
    if (!user || user.role !== session.role) return res.status(401).json({ error: 'الجلسة غير صالحة؛ يرجى تسجيل الدخول مجددًا' });
    (req as any).authUser = { id: user.id, role: user.role, name: user.name };
    const route = req.path;
    const leaderOnly = route === '/users' || route.startsWith('/users/') || route === '/settings' || route.startsWith('/backup/') || route.startsWith('/grading-config/') || route === '/auth/switch-user';
    if (leaderOnly && user.role !== 'leader') return res.status(403).json({ error: 'لا تملك الصلاحية لتنفيذ هذه العملية' });
    next();
  });

  // Get sanitized state; never return PINs or the leader bootstrap credential.
  api.get('/state', (req, res) => {
    const db = readDatabase();
    const authUser = (req as any).authUser;
    const currentUser = db.users.find((u: any) => u.id === authUser.id) || null;
    const safeUser = (u: any) => { const { passcode: _passcode, ...safe } = u; return safe; };
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ...db, currentUser: currentUser ? safeUser(currentUser) : null, users: db.users.map(safeUser), settings: { ...db.settings, leaderPasscode: undefined } });
  });

  // Switch current active user
  api.post('/auth/switch-user', (req, res) => {
    const { userId } = req.body;
    const db = readDatabase();
    const user = db.users.find((u: any) => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }
    db.currentUser = user;
    addAudit(db, user.name, user.role, 'login', 'auth', `تسجيل الدخول / تبديل المستخدم إلى: ${user.name} (${user.title})`);
    writeDatabase(db);
    const { passcode: _passcode, ...safeUser } = user;
    res.json({ user: safeUser, success: true });
  });

  // Change user passcode
  api.post('/auth/change-passcode', (req, res) => {
    const { userId, newPasscode } = req.body;
    const authUser = (req as any).authUser;
    if (userId !== authUser.id && authUser.role !== 'leader') return res.status(403).json({ error: 'لا تملك الصلاحية لتغيير رمز هذا الحساب' });
    if (!newPasscode || !String(newPasscode).trim()) {
      return res.status(400).json({ error: 'الرمز السري الجديد مطلوب' });
    }
    const cleanNew = String(newPasscode).trim();
    const db = readDatabase();
    const user = db.users.find((u: any) => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }
    user.passcode = hashPasscode(cleanNew);
    if (user.role === 'leader') {
      db.settings.leaderPasscode = '';
    }
    if (db.currentUser && db.currentUser.id === userId) {
      db.currentUser.passcode = user.passcode;
    }
    addAudit(db, user.name, user.role, 'update', 'user', `تحديث الرمز السري بنجاح للمستخدم: ${user.name}`, user.id);
    writeDatabase(db);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, message: 'تم تغيير الرمز السري بنجاح' });
  });

  // Tracks endpoints
  api.post('/tracks', (req, res) => {
    const db = readDatabase();
    const newTrack = {
      id: `t-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isArchived: false,
      ...req.body
    };
    db.tracks.push(newTrack);
    // Also create default grading config for this track if not exists
    const existingGc = db.gradingConfigs.find((g: any) => g.trackId === newTrack.id);
    if (!existingGc) {
      const templateGc = db.gradingConfigs[0];
      db.gradingConfigs.push({
        ...templateGc,
        id: `gc-${Date.now()}`,
        trackId: newTrack.id
      });
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'track', `إضافة مسار جديد: ${newTrack.name}`, newTrack.id);
    writeDatabase(db);
    res.status(201).json(newTrack);
  });

  api.put('/tracks/:id', (req, res) => {
    const db = readDatabase();
    const index = db.tracks.findIndex((t: any) => t.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'المسار غير موجود' });
    db.tracks[index] = { ...db.tracks[index], ...req.body, updatedAt: new Date().toISOString() };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'track', `تعديل المسار: ${db.tracks[index].name}`, req.params.id);
    writeDatabase(db);
    res.json(db.tracks[index]);
  });

  api.delete('/tracks/:id', (req, res) => {
    const db = readDatabase();
    const track = db.tracks.find((t: any) => t.id === req.params.id);
    if (!track) return res.status(404).json({ error: 'المسار غير موجود' });
    // Soft delete / archive
    track.isArchived = true;
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'archive', 'track', `أرشفة المسار: ${track.name}`, req.params.id);
    writeDatabase(db);
    res.json({ success: true, track });
  });

  // Circles endpoints
  api.post('/circles', (req, res) => {
    const db = readDatabase();
    const newCircle = {
      id: `c-${Date.now()}`,
      createdAt: new Date().toISOString(),
      isArchived: false,
      ...req.body
    };
    db.circles.push(newCircle);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'circle', `إضافة حلقة جديدة: ${newCircle.name}`, newCircle.id);
    writeDatabase(db);
    res.status(201).json(newCircle);
  });

  api.put('/circles/:id', (req, res) => {
    const db = readDatabase();
    const index = db.circles.findIndex((c: any) => c.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'الحلقة غير موجودة' });
    db.circles[index] = { ...db.circles[index], ...req.body };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'circle', `تعديل الحلقة: ${db.circles[index].name}`, req.params.id);
    writeDatabase(db);
    res.json(db.circles[index]);
  });

  api.delete('/circles/:id', (req, res) => {
    const db = readDatabase();
    const circle = db.circles.find((c: any) => c.id === req.params.id);
    if (!circle) return res.status(404).json({ error: 'الحلقة غير موجودة' });
    circle.isArchived = true;
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'archive', 'circle', `أرشفة الحلقة: ${circle.name}`, req.params.id);
    writeDatabase(db);
    res.json({ success: true, circle });
  });

  // Students endpoints
  api.post('/students', (req, res) => {
    const db = readDatabase();
    const newStudent = {
      id: `s-${Date.now()}`,
      code: req.body.code || `GH-${Math.floor(100 + Math.random() * 900)}`,
      createdAt: new Date().toISOString(),
      status: 'active',
      ...req.body
    };
    db.students.push(newStudent);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'student', `إضافة طالبة: ${newStudent.name} (كود: ${newStudent.code})`, newStudent.id);
    writeDatabase(db);
    res.status(201).json(newStudent);
  });

  api.put('/students/:id', (req, res) => {
    const db = readDatabase();
    const index = db.students.findIndex((s: any) => s.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'الطالبة غير موجودة' });
    db.students[index] = { ...db.students[index], ...req.body };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'student', `تعديل بيانات الطالبة: ${db.students[index].name}`, req.params.id);
    writeDatabase(db);
    res.json(db.students[index]);
  });

  api.delete('/students/:id', (req, res) => {
    const db = readDatabase();
    const student = db.students.find((s: any) => s.id === req.params.id);
    if (!student) return res.status(404).json({ error: 'الطالبة غير موجودة' });
    student.status = 'archived';
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'archive', 'student', `أرشفة الطالبة: ${student.name}`, req.params.id);
    writeDatabase(db);
    res.json({ success: true, student });
  });

  // Pair or unpair two students directly for Revision Matrix & Challenges
  api.post('/students/pair', (req, res) => {
    const { studentId1, studentId2 } = req.body;
    const db = readDatabase();
    const s1 = db.students.find((s: any) => s.id === studentId1);
    if (!s1) return res.status(404).json({ error: 'الطالبة الأولى غير موجودة' });

    if (!studentId2) {
      // Unpair s1 and whatever previous partner she had
      const oldPartnerId = s1.partnerStudentId;
      s1.partnerStudentId = undefined;
      s1.partnerStudentName = undefined;
      if (oldPartnerId) {
        const oldPartner = db.students.find((s: any) => s.id === oldPartnerId);
        if (oldPartner && oldPartner.partnerStudentId === studentId1) {
          oldPartner.partnerStudentId = undefined;
          oldPartner.partnerStudentName = undefined;
        }
      }
      addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'student', `إلغاء ثنائي الطالبة: ${s1.name}`, studentId1);
      writeDatabase(db);
      return res.json({ success: true, unpair: true, student: s1 });
    }

    const s2 = db.students.find((s: any) => s.id === studentId2);
    if (!s2) return res.status(404).json({ error: 'الطالبة المحددة كرفيقة غير موجودة' });

    // If s1 or s2 already had other partners, clear them first
    if (s1.partnerStudentId && s1.partnerStudentId !== s2.id) {
      const prev1 = db.students.find((s: any) => s.id === s1.partnerStudentId);
      if (prev1 && prev1.partnerStudentId === s1.id) {
        prev1.partnerStudentId = undefined;
        prev1.partnerStudentName = undefined;
      }
    }
    if (s2.partnerStudentId && s2.partnerStudentId !== s1.id) {
      const prev2 = db.students.find((s: any) => s.id === s2.partnerStudentId);
      if (prev2 && prev2.partnerStudentId === s2.id) {
        prev2.partnerStudentId = undefined;
        prev2.partnerStudentName = undefined;
      }
    }

    // Set reciprocal pairing
    s1.partnerStudentId = s2.id;
    s1.partnerStudentName = s2.name;
    s2.partnerStudentId = s1.id;
    s2.partnerStudentName = s1.name;

    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'student', `تحديد وتحديث الثنائي القرآني: ${s1.name} و ${s2.name}`, studentId1);
    writeDatabase(db);
    res.json({ success: true, s1, s2 });
  });

  // Monthly Plans endpoints
  api.post('/monthly-plans', (req, res) => {
    const db = readDatabase();
    const newPlan = {
      id: `mp-${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: 'active',
      ...req.body
    };
    db.monthlyPlans.push(newPlan);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'monthlyPlan', `إنشاء خطة شهرية: ${newPlan.title}`, newPlan.id);
    writeDatabase(db);
    res.status(201).json(newPlan);
  });

  api.put('/monthly-plans/:id', (req, res) => {
    const db = readDatabase();
    const index = db.monthlyPlans.findIndex((p: any) => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'الخطة غير موجودة' });
    db.monthlyPlans[index] = { ...db.monthlyPlans[index], ...req.body };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'monthlyPlan', `تعديل الخطة: ${db.monthlyPlans[index].title}`, req.params.id);
    writeDatabase(db);
    res.json(db.monthlyPlans[index]);
  });

  api.post('/monthly-plans/:id/duplicate', (req, res) => {
    const db = readDatabase();
    const sourcePlan = db.monthlyPlans.find((p: any) => p.id === req.params.id);
    if (!sourcePlan) return res.status(404).json({ error: 'الخطة الأصلية غير موجودة' });
    const newPlan = {
      ...sourcePlan,
      id: `mp-${Date.now()}`,
      title: `${sourcePlan.title} (نسخة جديدة)`,
      createdAt: new Date().toISOString(),
      status: 'active'
    };
    db.monthlyPlans.push(newPlan);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'monthlyPlan', `نسخ خطة شهرية سابقة إلى: ${newPlan.title}`, newPlan.id);
    writeDatabase(db);
    res.status(201).json(newPlan);
  });

  // Student Plans
  api.post('/student-plans', (req, res) => {
    const db = readDatabase();
    const newPlan = {
      id: `sp-${Date.now()}`,
      status: 'active',
      ...req.body
    };
    db.studentPlans.push(newPlan);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'studentPlan', `تخصيص خطة شهرية لطالبة`, newPlan.id);
    writeDatabase(db);
    res.status(201).json(newPlan);
  });

  api.put('/student-plans/:id', (req, res) => {
    const db = readDatabase();
    const index = db.studentPlans.findIndex((p: any) => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'خطة الطالبة غير موجودة' });
    db.studentPlans[index] = { ...db.studentPlans[index], ...req.body };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'studentPlan', `تحديث خطة الطالبة`, req.params.id);
    writeDatabase(db);
    res.json(db.studentPlans[index]);
  });

  // Daily records (Memorization, Revision, Conditions, Recitation grade)
  api.post('/daily-records', (req, res) => {
    const db = readDatabase();
    const newRecord = {
      id: `dr-${Date.now()}`,
      recordedBy: (db.currentUser?.name || 'ريفة المنصوري'),
      recordedAt: new Date().toISOString(),
      ...req.body
    };
    db.dailyRecords.push(newRecord);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'grade', 'dailyRecord', `تسجيل إنجاز يومي لطالبة بتاريخ ${newRecord.date}`, newRecord.id);
    writeDatabase(db);
    res.status(201).json(newRecord);
  });

  api.put('/daily-records/:id', (req, res) => {
    const db = readDatabase();
    const index = db.dailyRecords.findIndex((r: any) => r.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'السجل اليومي غير موجود' });
    db.dailyRecords[index] = {
      ...db.dailyRecords[index],
      ...req.body,
      recordedBy: (db.currentUser?.name || 'ريفة المنصوري'),
      recordedAt: new Date().toISOString()
    };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'dailyRecord', `تعديل السجل اليومي`, req.params.id);
    writeDatabase(db);
    res.json(db.dailyRecords[index]);
  });

  // Attendance & Early prep
  api.post('/attendance', (req, res) => {
    const db = readDatabase();
    // Check if record exists for this student & date
    const existingIndex = db.attendanceRecords.findIndex(
      (a: any) => a.studentId === req.body.studentId && a.date === req.body.date
    );
    let record;
    if (existingIndex >= 0) {
      db.attendanceRecords[existingIndex] = {
        ...db.attendanceRecords[existingIndex],
        ...req.body,
        recordedBy: (db.currentUser?.name || 'ريفة المنصوري'),
        recordedAt: new Date().toISOString()
      };
      record = db.attendanceRecords[existingIndex];
    } else {
      record = {
        id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        recordedBy: (db.currentUser?.name || 'ريفة المنصوري'),
        recordedAt: new Date().toISOString(),
        ...req.body
      };
      db.attendanceRecords.push(record);
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'attendance', `تسجيل حضور/تحضير لطالبة بتاريخ ${record.date}`, record.id);
    writeDatabase(db);
    res.json(record);
  });

  // Bulk attendance
  api.post('/attendance/bulk', (req, res) => {
    const { records } = req.body;
    if (!Array.isArray(records)) return res.status(400).json({ error: 'بيانات غير صالحة' });
    const db = readDatabase();
    records.forEach((rec: any) => {
      const idx = db.attendanceRecords.findIndex((a: any) => a.studentId === rec.studentId && a.date === rec.date);
      if (idx >= 0) {
        db.attendanceRecords[idx] = {
          ...db.attendanceRecords[idx],
          ...rec,
          recordedBy: (db.currentUser?.name || 'ريفة المنصوري'),
          recordedAt: new Date().toISOString()
        };
      } else {
        db.attendanceRecords.push({
          id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          recordedBy: (db.currentUser?.name || 'ريفة المنصوري'),
          recordedAt: new Date().toISOString(),
          ...rec
        });
      }
    });
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'attendance', `تسجيل حضور جماعي لـ ${records.length} طالبة`);
    writeDatabase(db);
    res.json({ success: true, count: records.length });
  });

  // Atqini assignments (strictly Tajweed)
  api.post('/atqini', (req, res) => {
    const db = readDatabase();
    const assignment = {
      id: `atq-${Date.now()}`,
      ...req.body
    };
    db.atqiniAssignments.push(assignment);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'atqini', `إضافة واجب تجويد جديد: ${assignment.title}`, assignment.id);
    writeDatabase(db);
    res.status(201).json(assignment);
  });

  api.put('/atqini/:id', (req, res) => {
    const db = readDatabase();
    const idx = db.atqiniAssignments.findIndex((a: any) => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'الواجب غير موجود' });
    db.atqiniAssignments[idx] = { ...db.atqiniAssignments[idx], ...req.body };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'atqini', `تعديل واجب التجويد: ${db.atqiniAssignments[idx].title}`, req.params.id);
    writeDatabase(db);
    res.json(db.atqiniAssignments[idx]);
  });

  api.delete('/atqini/:id', (req, res) => {
    const db = readDatabase();
    const idx = db.atqiniAssignments.findIndex((a: any) => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'الواجب غير موجود' });
    const deleted = db.atqiniAssignments.splice(idx, 1)[0];
    // Cascade remove submissions for this assignment
    db.studentAtqiniSubmissions = db.studentAtqiniSubmissions.filter((s: any) => s.assignmentId !== req.params.id);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'delete', 'atqini', `حذف واجب التجويد: ${deleted.title} وكافة تقييماته`, req.params.id);
    writeDatabase(db);
    res.json({ success: true, deletedId: req.params.id });
  });

  // Atqini submissions
  api.post('/atqini-submissions', (req, res) => {
    const db = readDatabase();
    const existing = db.studentAtqiniSubmissions.findIndex(
      (s: any) => s.assignmentId === req.body.assignmentId && s.studentId === req.body.studentId
    );
    let submission;
    if (existing >= 0) {
      db.studentAtqiniSubmissions[existing] = {
        ...db.studentAtqiniSubmissions[existing],
        ...req.body,
        evaluatedBy: (db.currentUser?.name || 'ريفة المنصوري')
      };
      submission = db.studentAtqiniSubmissions[existing];
    } else {
      submission = {
        id: `atqs-${Date.now()}`,
        evaluatedBy: (db.currentUser?.name || 'ريفة المنصوري'),
        ...req.body
      };
      db.studentAtqiniSubmissions.push(submission);
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'grade', 'atqiniSubmission', `تصحيح واجب تجويد لطالبة بدرجة ${submission.score}`, submission.id);
    writeDatabase(db);
    res.json(submission);
  });

  // Challenges (Thursday Challenge & Grand Revision)
  api.post('/challenges', (req, res) => {
    const db = readDatabase();
    const challenge = {
      id: `ch-${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: 'active',
      ...req.body
    };
    db.challenges.push(challenge);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'challenge', `إضافة تحدٍ قرآني جديد: ${challenge.title}`, challenge.id);
    writeDatabase(db);
    res.status(201).json(challenge);
  });

  api.put('/challenges/:id', (req, res) => {
    const db = readDatabase();
    const idx = db.challenges.findIndex((c: any) => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'التحدي غير موجود' });
    db.challenges[idx] = { ...db.challenges[idx], ...req.body };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'challenge', `تعديل التحدي القرآني: ${db.challenges[idx].title}`, req.params.id);
    writeDatabase(db);
    res.json(db.challenges[idx]);
  });

  api.delete('/challenges/:id', (req, res) => {
    const db = readDatabase();
    const idx = db.challenges.findIndex((c: any) => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'التحدي غير موجود' });
    const deleted = db.challenges.splice(idx, 1)[0];
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'delete', 'challenge', `حذف التحدي: ${deleted.title}`, req.params.id);
    writeDatabase(db);
    res.json({ success: true });
  });

  // Challenge Submissions (including peer review & partner collaboration)
  api.post('/challenge-submissions', (req, res) => {
    const db = readDatabase();
    const existing = db.studentChallengeSubmissions.findIndex(
      (s: any) => s.challengeId === req.body.challengeId && s.studentId === req.body.studentId
    );
    let submission;
    if (existing >= 0) {
      db.studentChallengeSubmissions[existing] = {
        ...db.studentChallengeSubmissions[existing],
        ...req.body,
        evaluatedBy: (db.currentUser?.name || 'ريفة المنصوري'),
        evaluatedAt: new Date().toISOString()
      };
      submission = db.studentChallengeSubmissions[existing];
    } else {
      submission = {
        id: `cs-${Date.now()}`,
        evaluatedBy: (db.currentUser?.name || 'ريفة المنصوري'),
        evaluatedAt: new Date().toISOString(),
        ...req.body
      };
      db.studentChallengeSubmissions.push(submission);
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'grade', 'challengeSubmission', `تقييم تحدي قرآني ومراجعة ثنائية للطالبة`, submission.id);
    writeDatabase(db);
    res.json(submission);
  });

  // Exams & Exam results
  api.post('/exams', (req, res) => {
    const db = readDatabase();
    const exam = {
      id: `ex-${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...req.body
    };
    db.monthlyExams.push(exam);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'exam', `إضافة اختبار شهري: ${exam.title}`, exam.id);
    writeDatabase(db);
    res.status(201).json(exam);
  });

  api.put('/exams/:id', (req, res) => {
    const db = readDatabase();
    const idx = db.monthlyExams.findIndex((e: any) => e.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'الاختبار غير موجود' });
    db.monthlyExams[idx] = { ...db.monthlyExams[idx], ...req.body };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'exam', `تعديل الاختبار: ${db.monthlyExams[idx].title}`, req.params.id);
    writeDatabase(db);
    res.json(db.monthlyExams[idx]);
  });

  api.delete('/exams/:id', (req, res) => {
    const db = readDatabase();
    const idx = db.monthlyExams.findIndex((e: any) => e.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'الاختبار غير موجود' });
    const deleted = db.monthlyExams.splice(idx, 1)[0];
    db.studentExamResults = db.studentExamResults.filter((r: any) => r.examId !== req.params.id);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'delete', 'exam', `حذف الاختبار الشهري: ${deleted.title}`, req.params.id);
    writeDatabase(db);
    res.json({ success: true });
  });

  api.post('/exam-results', (req, res) => {
    const db = readDatabase();
    const existing = db.studentExamResults.findIndex(
      (r: any) => r.examId === req.body.examId && r.studentId === req.body.studentId
    );
    let result;
    if (existing >= 0) {
      db.studentExamResults[existing] = {
        ...db.studentExamResults[existing],
        ...req.body,
        examinerName: (db.currentUser?.name || 'ريفة المنصوري'),
        evaluatedAt: new Date().toISOString()
      };
      result = db.studentExamResults[existing];
    } else {
      result = {
        id: `er-${Date.now()}`,
        examinerName: (db.currentUser?.name || 'ريفة المنصوري'),
        evaluatedAt: new Date().toISOString(),
        ...req.body
      };
      db.studentExamResults.push(result);
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'grade', 'examResult', `رصد درجة اختبار شهري للطالبة: ${result.score}`, result.id);
    writeDatabase(db);
    res.json(result);
  });

  // Grading config
  api.put('/grading-config/:trackId', (req, res) => {
    const db = readDatabase();
    const idx = db.gradingConfigs.findIndex((g: any) => g.trackId === req.params.trackId);
    if (idx >= 0) {
      db.gradingConfigs[idx] = { ...db.gradingConfigs[idx], ...req.body };
    } else {
      db.gradingConfigs.push({
        id: `gc-${Date.now()}`,
        trackId: req.params.trackId,
        ...req.body
      });
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'gradingConfig', `تعديل نظام الدرجات والنسب المئوية للمسار`, req.params.trackId);
    writeDatabase(db);
    res.json(db.gradingConfigs[idx >= 0 ? idx : db.gradingConfigs.length - 1]);
  });

  // Settings
  api.put('/settings', (req, res) => {
    const db = readDatabase();
    const settingsPatch = { ...req.body };
    delete settingsPatch.leaderPasscode;
    db.settings = { ...db.settings, ...settingsPatch };
    if (typeof req.body.leaderPasscode === 'string' && req.body.leaderPasscode.trim()) {
      const cleanPass = req.body.leaderPasscode.trim();
      const leaderUser = db.users.find((u: any) => u.role === 'leader');
      if (leaderUser) {
        leaderUser.passcode = hashPasscode(cleanPass);
        if (db.currentUser?.id === leaderUser.id) db.currentUser.passcode = leaderUser.passcode;
      }
      // Credentials are not stored in settings; only the user credential hash is retained.
      db.settings.leaderPasscode = '';
    }
    // Sync PWA icons with uploaded logo
    if (req.body.logoUrl && typeof req.body.logoUrl === 'string' && req.body.logoUrl.startsWith('data:image/')) {
      try {
        const base64Data = req.body.logoUrl.replace(/^data:image\/\w+;base64,/, '');
        const imgBuffer = Buffer.from(base64Data, 'base64');
        import('sharp').then(({ default: sharp }) => {
          sharp(imgBuffer).resize(192, 192).png().toFile('public/pwa-192x192.png').catch(() => {});
          sharp(imgBuffer).resize(512, 512).png().toFile('public/pwa-512x512.png').catch(() => {});
          sharp(imgBuffer).resize(180, 180).png().toFile('public/apple-touch-icon.png').catch(() => {});
          sharp(imgBuffer).resize(388, 388).toBuffer().then(inner => {
            sharp({
              create: { width: 512, height: 512, channels: 4, background: { r: 250, g: 245, b: 242, alpha: 1 } }
            }).composite([{ input: inner, gravity: 'center' }]).png().toFile('public/pwa-maskable-512x512.png').catch(() => {});
          }).catch(() => {});
        }).catch(() => {});
      } catch (err) {
        console.error('PWA icon sync error', err);
      }
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'settings', `تحديث الإعدادات العامة للمقرأة والهوية والشعار`);
    writeDatabase(db);
    const { leaderPasscode: _leaderPasscode, ...safeSettings } = db.settings;
    res.setHeader('Cache-Control', 'no-store');
    res.json(safeSettings);
  });

  // Manage users / permissions
  api.post('/users', (req, res) => {
    const db = readDatabase();
    const newUser = {
      id: `u-${Date.now()}`,
      circleIds: [],
      passcode: req.body.passcode ? String(req.body.passcode).trim() : '',
      ...req.body
    };
    db.users.push(newUser);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'user', `إضافة مستخدم جديد: ${newUser.name} (${newUser.title})`, newUser.id);
    writeDatabase(db);
    const { passcode: _passcode, ...safeNewUser } = newUser;
    res.status(201).json(safeNewUser);
  });

  api.put('/users/:id', (req, res) => {
    const db = readDatabase();
    const idx = db.users.findIndex((u: any) => u.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'المستخدم غير موجود' });
    const cleanBody = { ...req.body };
    if (cleanBody.passcode) {
      cleanBody.passcode = String(cleanBody.passcode).trim();
    }
    db.users[idx] = { ...db.users[idx], ...cleanBody };
    // If leader user passcode is changed, sync with settings.leaderPasscode
    if (db.users[idx].role === 'leader' && cleanBody.passcode) {
      db.settings.leaderPasscode = cleanBody.passcode;
    }
    if (db.currentUser.id === req.params.id) {
      db.currentUser = { ...db.currentUser, ...cleanBody };
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'user', `تعديل بيانات وصلاحيات المستخدم: ${db.users[idx].name}`, req.params.id);
    writeDatabase(db);
    const { passcode: _passcode, ...safeUpdatedUser } = db.users[idx];
    res.json(safeUpdatedUser);
  });

  // Backup & Restore
  api.get('/backup/download', (_req, res) => {
    const db = readDatabase();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=GhaithAlGhaym_backup_${Date.now()}.json`);
    res.send(JSON.stringify(db, null, 2));
  });

  api.post('/backup/restore', (req, res) => {
    const { backupData } = req.body;
    if (!backupData || !backupData.tracks || !backupData.students) {
      return res.status(400).json({ error: 'صيغة النسخة الاحتياطية غير صالحة' });
    }
    writeDatabase(backupData);
    addAudit(backupData, backupData.currentUser?.name || 'المدير', 'leader', 'restore', 'backup', 'استعادة قاعدة البيانات بالكامل من نسخة احتياطية');
    res.json({ success: true, message: 'تمت استعادة البيانات بنجاح' });
  });

  api.post('/backup/reset-sample', (_req, res) => {
    const freshDb = getInitialDatabase();
    addAudit(freshDb, freshDb.currentUser.name, 'leader', 'backup', 'reset', 'إعادة ضبط قاعدة البيانات إلى البيانات النموذجية الأصلية');
    writeDatabase(freshDb);
    res.json({ success: true, database: freshDb });
  });

  app.use('/api', api);

  const httpServer = http.createServer(app);

  const distPath = path.join(__dirname, 'dist');
  const hasDist = fs.existsSync(path.join(distPath, 'index.html'));

  if (process.env.NODE_ENV === 'production' || (hasDist && process.env.NODE_ENV !== 'development')) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          hmr: false
        },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (err) {
      if (hasDist) {
        app.use(express.static(distPath));
        app.get('*', (_req, res) => {
          res.sendFile(path.join(distPath, 'index.html'));
        });
      } else {
        console.error('Vite dev middleware failed and no dist found:', err);
      }
    }
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🌸 Ghaith Al-Ghaym Platform running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
)) {
      const [, salt, digestHex] = stored.split('
  function createSession(user: any) {
    const payload = Buffer.from(JSON.stringify({
      userId: user.id,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
    })).toString('base64url');
    const signature = createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
    return payload + '.' + signature;
  }

  function getSession(req: express.Request): { userId: string; role: string; exp: number } | null {
    try {
      const cookieHeader = req.headers.cookie || '';
      const token = cookieHeader.split(';').map(v => v.trim()).find(v => v.startsWith(SESSION_COOKIE + '='))?.slice(SESSION_COOKIE.length + 1);
      if (!token) return null;
      const parts = token.split('.');
      if (parts.length !== 2) return null;
      const expected = createHmac('sha256', sessionSecret()).update(parts[0]).digest();
      const supplied = Buffer.from(parts[1], 'base64url');
      if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
      const session = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      if (!session.userId || !session.role || !Number.isFinite(session.exp) || session.exp <= Math.floor(Date.now() / 1000)) return null;
      return session;
    } catch {
      return null;
    }
  }

  function setSessionCookie(res: express.Response, token: string) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure}`);
  }

  function clearSessionCookie(res: express.Response) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`);
  }



  // Health check
  api.get('/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Public login directory: expose only the minimum fields needed by the sign-in selector.
  // Never send student records, staff contact details, or credentials before authentication.
  api.get('/auth/users', (_req, res) => {
    const db = readDatabase();
    res.setHeader('Cache-Control', 'no-store');
    res.json(db.users.map((user: any) => ({
      id: user.id,
      name: user.name,
      role: user.role,
      title: user.title,
      avatarIcon: user.avatarIcon,
      avatarColor: user.avatarColor
    })));
  });

  // Login is the only public data-adjacent endpoint. Configure SESSION_SECRET and
  // GHAYM_INITIAL_LEADER_PASSCODE before deploying; no built-in PIN is accepted.
  api.post('/auth/login', (req, res) => {
    let secret: string;
    try { secret = sessionSecret(); } catch { return res.status(503).json({ error: 'لم يتم إعداد أمان الجلسات على الخادم' }); }
    const userId = typeof req.body?.userId === 'string' ? req.body.userId : '';
    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode.trim() : '';
    if (!userId || !passcode || passcode.length > 128) return res.status(400).json({ error: 'اسم المستخدم والرمز السري مطلوبان' });
    const db = readDatabase();
    const user = db.users.find((u: any) => u.id === userId);
    if (!user) return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    const configuredPasscode = typeof user.passcode === 'string' ? user.passcode : '';
    const bootstrapPasscode = user.role === 'leader' ? (process.env.GHAYM_INITIAL_LEADER_PASSCODE || '') : '';
    const valid = (configuredPasscode.length > 0 && passcode === configuredPasscode) || (bootstrapPasscode.length > 0 && passcode === bootstrapPasscode);
    if (!valid) return res.status(401).json({ error: 'بيانات الدخول غير صحيحة أو لم يتم إعداد رمز لهذا الحساب' });
    setSessionCookie(res, createSession(user));
    res.setHeader('Cache-Control', 'no-store');
    const { passcode: _passcode, ...safeUser } = user;
    return res.json({ success: true, user: safeUser });
  });

  api.post('/auth/logout', (_req, res) => {
    clearSessionCookie(res);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true });
  });

  // Every other API route requires a signed, expiring server-side identity.
  api.use((req, res, next) => {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'يلزم تسجيل الدخول للوصول إلى هذه البيانات' });
    const db = readDatabase();
    const user = db.users.find((u: any) => u.id === session.userId);
    if (!user || user.role !== session.role) return res.status(401).json({ error: 'الجلسة غير صالحة؛ يرجى تسجيل الدخول مجددًا' });
    (req as any).authUser = { id: user.id, role: user.role, name: user.name };
    const route = req.path;
    const leaderOnly = route === '/users' || route.startsWith('/users/') || route === '/settings' || route.startsWith('/backup/') || route.startsWith('/grading-config/') || route === '/auth/switch-user';
    if (leaderOnly && user.role !== 'leader') return res.status(403).json({ error: 'لا تملك الصلاحية لتنفيذ هذه العملية' });
    next();
  });

  // Get sanitized state; never return PINs or the leader bootstrap credential.
  api.get('/state', (req, res) => {
    const db = readDatabase();
    const authUser = (req as any).authUser;
    const currentUser = db.users.find((u: any) => u.id === authUser.id) || null;
    const safeUser = (u: any) => { const { passcode: _passcode, ...safe } = u; return safe; };
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ...db, currentUser: currentUser ? safeUser(currentUser) : null, users: db.users.map(safeUser), settings: { ...db.settings, leaderPasscode: undefined } });
  });

  // Switch current active user
  api.post('/auth/switch-user', (req, res) => {
    const { userId } = req.body;
    const db = readDatabase();
    const user = db.users.find((u: any) => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }
    db.currentUser = user;
    addAudit(db, user.name, user.role, 'login', 'auth', `تسجيل الدخول / تبديل المستخدم إلى: ${user.name} (${user.title})`);
    writeDatabase(db);
    const { passcode: _passcode, ...safeUser } = user;
    res.json({ user: safeUser, success: true });
  });

  // Change user passcode
  api.post('/auth/change-passcode', (req, res) => {
    const { userId, newPasscode } = req.body;
    const authUser = (req as any).authUser;
    if (userId !== authUser.id && authUser.role !== 'leader') return res.status(403).json({ error: 'لا تملك الصلاحية لتغيير رمز هذا الحساب' });
    if (!newPasscode || !String(newPasscode).trim()) {
      return res.status(400).json({ error: 'الرمز السري الجديد مطلوب' });
    }
    const cleanNew = String(newPasscode).trim();
    const db = readDatabase();
    const user = db.users.find((u: any) => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }
    user.passcode = cleanNew;
    if (user.role === 'leader') {
      db.settings.leaderPasscode = cleanNew;
    }
    if (db.currentUser && db.currentUser.id === userId) {
      db.currentUser.passcode = cleanNew;
    }
    addAudit(db, user.name, user.role, 'update', 'user', `تحديث الرمز السري بنجاح للمستخدم: ${user.name}`, user.id);
    writeDatabase(db);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, message: 'تم تغيير الرمز السري بنجاح' });
  });

  // Tracks endpoints
  api.post('/tracks', (req, res) => {
    const db = readDatabase();
    const newTrack = {
      id: `t-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isArchived: false,
      ...req.body
    };
    db.tracks.push(newTrack);
    // Also create default grading config for this track if not exists
    const existingGc = db.gradingConfigs.find((g: any) => g.trackId === newTrack.id);
    if (!existingGc) {
      const templateGc = db.gradingConfigs[0];
      db.gradingConfigs.push({
        ...templateGc,
        id: `gc-${Date.now()}`,
        trackId: newTrack.id
      });
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'track', `إضافة مسار جديد: ${newTrack.name}`, newTrack.id);
    writeDatabase(db);
    res.status(201).json(newTrack);
  });

  api.put('/tracks/:id', (req, res) => {
    const db = readDatabase();
    const index = db.tracks.findIndex((t: any) => t.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'المسار غير موجود' });
    db.tracks[index] = { ...db.tracks[index], ...req.body, updatedAt: new Date().toISOString() };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'track', `تعديل المسار: ${db.tracks[index].name}`, req.params.id);
    writeDatabase(db);
    res.json(db.tracks[index]);
  });

  api.delete('/tracks/:id', (req, res) => {
    const db = readDatabase();
    const track = db.tracks.find((t: any) => t.id === req.params.id);
    if (!track) return res.status(404).json({ error: 'المسار غير موجود' });
    // Soft delete / archive
    track.isArchived = true;
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'archive', 'track', `أرشفة المسار: ${track.name}`, req.params.id);
    writeDatabase(db);
    res.json({ success: true, track });
  });

  // Circles endpoints
  api.post('/circles', (req, res) => {
    const db = readDatabase();
    const newCircle = {
      id: `c-${Date.now()}`,
      createdAt: new Date().toISOString(),
      isArchived: false,
      ...req.body
    };
    db.circles.push(newCircle);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'circle', `إضافة حلقة جديدة: ${newCircle.name}`, newCircle.id);
    writeDatabase(db);
    res.status(201).json(newCircle);
  });

  api.put('/circles/:id', (req, res) => {
    const db = readDatabase();
    const index = db.circles.findIndex((c: any) => c.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'الحلقة غير موجودة' });
    db.circles[index] = { ...db.circles[index], ...req.body };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'circle', `تعديل الحلقة: ${db.circles[index].name}`, req.params.id);
    writeDatabase(db);
    res.json(db.circles[index]);
  });

  api.delete('/circles/:id', (req, res) => {
    const db = readDatabase();
    const circle = db.circles.find((c: any) => c.id === req.params.id);
    if (!circle) return res.status(404).json({ error: 'الحلقة غير موجودة' });
    circle.isArchived = true;
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'archive', 'circle', `أرشفة الحلقة: ${circle.name}`, req.params.id);
    writeDatabase(db);
    res.json({ success: true, circle });
  });

  // Students endpoints
  api.post('/students', (req, res) => {
    const db = readDatabase();
    const newStudent = {
      id: `s-${Date.now()}`,
      code: req.body.code || `GH-${Math.floor(100 + Math.random() * 900)}`,
      createdAt: new Date().toISOString(),
      status: 'active',
      ...req.body
    };
    db.students.push(newStudent);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'student', `إضافة طالبة: ${newStudent.name} (كود: ${newStudent.code})`, newStudent.id);
    writeDatabase(db);
    res.status(201).json(newStudent);
  });

  api.put('/students/:id', (req, res) => {
    const db = readDatabase();
    const index = db.students.findIndex((s: any) => s.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'الطالبة غير موجودة' });
    db.students[index] = { ...db.students[index], ...req.body };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'student', `تعديل بيانات الطالبة: ${db.students[index].name}`, req.params.id);
    writeDatabase(db);
    res.json(db.students[index]);
  });

  api.delete('/students/:id', (req, res) => {
    const db = readDatabase();
    const student = db.students.find((s: any) => s.id === req.params.id);
    if (!student) return res.status(404).json({ error: 'الطالبة غير موجودة' });
    student.status = 'archived';
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'archive', 'student', `أرشفة الطالبة: ${student.name}`, req.params.id);
    writeDatabase(db);
    res.json({ success: true, student });
  });

  // Pair or unpair two students directly for Revision Matrix & Challenges
  api.post('/students/pair', (req, res) => {
    const { studentId1, studentId2 } = req.body;
    const db = readDatabase();
    const s1 = db.students.find((s: any) => s.id === studentId1);
    if (!s1) return res.status(404).json({ error: 'الطالبة الأولى غير موجودة' });

    if (!studentId2) {
      // Unpair s1 and whatever previous partner she had
      const oldPartnerId = s1.partnerStudentId;
      s1.partnerStudentId = undefined;
      s1.partnerStudentName = undefined;
      if (oldPartnerId) {
        const oldPartner = db.students.find((s: any) => s.id === oldPartnerId);
        if (oldPartner && oldPartner.partnerStudentId === studentId1) {
          oldPartner.partnerStudentId = undefined;
          oldPartner.partnerStudentName = undefined;
        }
      }
      addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'student', `إلغاء ثنائي الطالبة: ${s1.name}`, studentId1);
      writeDatabase(db);
      return res.json({ success: true, unpair: true, student: s1 });
    }

    const s2 = db.students.find((s: any) => s.id === studentId2);
    if (!s2) return res.status(404).json({ error: 'الطالبة المحددة كرفيقة غير موجودة' });

    // If s1 or s2 already had other partners, clear them first
    if (s1.partnerStudentId && s1.partnerStudentId !== s2.id) {
      const prev1 = db.students.find((s: any) => s.id === s1.partnerStudentId);
      if (prev1 && prev1.partnerStudentId === s1.id) {
        prev1.partnerStudentId = undefined;
        prev1.partnerStudentName = undefined;
      }
    }
    if (s2.partnerStudentId && s2.partnerStudentId !== s1.id) {
      const prev2 = db.students.find((s: any) => s.id === s2.partnerStudentId);
      if (prev2 && prev2.partnerStudentId === s2.id) {
        prev2.partnerStudentId = undefined;
        prev2.partnerStudentName = undefined;
      }
    }

    // Set reciprocal pairing
    s1.partnerStudentId = s2.id;
    s1.partnerStudentName = s2.name;
    s2.partnerStudentId = s1.id;
    s2.partnerStudentName = s1.name;

    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'student', `تحديد وتحديث الثنائي القرآني: ${s1.name} و ${s2.name}`, studentId1);
    writeDatabase(db);
    res.json({ success: true, s1, s2 });
  });

  // Monthly Plans endpoints
  api.post('/monthly-plans', (req, res) => {
    const db = readDatabase();
    const newPlan = {
      id: `mp-${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: 'active',
      ...req.body
    };
    db.monthlyPlans.push(newPlan);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'monthlyPlan', `إنشاء خطة شهرية: ${newPlan.title}`, newPlan.id);
    writeDatabase(db);
    res.status(201).json(newPlan);
  });

  api.put('/monthly-plans/:id', (req, res) => {
    const db = readDatabase();
    const index = db.monthlyPlans.findIndex((p: any) => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'الخطة غير موجودة' });
    db.monthlyPlans[index] = { ...db.monthlyPlans[index], ...req.body };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'monthlyPlan', `تعديل الخطة: ${db.monthlyPlans[index].title}`, req.params.id);
    writeDatabase(db);
    res.json(db.monthlyPlans[index]);
  });

  api.post('/monthly-plans/:id/duplicate', (req, res) => {
    const db = readDatabase();
    const sourcePlan = db.monthlyPlans.find((p: any) => p.id === req.params.id);
    if (!sourcePlan) return res.status(404).json({ error: 'الخطة الأصلية غير موجودة' });
    const newPlan = {
      ...sourcePlan,
      id: `mp-${Date.now()}`,
      title: `${sourcePlan.title} (نسخة جديدة)`,
      createdAt: new Date().toISOString(),
      status: 'active'
    };
    db.monthlyPlans.push(newPlan);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'monthlyPlan', `نسخ خطة شهرية سابقة إلى: ${newPlan.title}`, newPlan.id);
    writeDatabase(db);
    res.status(201).json(newPlan);
  });

  // Student Plans
  api.post('/student-plans', (req, res) => {
    const db = readDatabase();
    const newPlan = {
      id: `sp-${Date.now()}`,
      status: 'active',
      ...req.body
    };
    db.studentPlans.push(newPlan);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'studentPlan', `تخصيص خطة شهرية لطالبة`, newPlan.id);
    writeDatabase(db);
    res.status(201).json(newPlan);
  });

  api.put('/student-plans/:id', (req, res) => {
    const db = readDatabase();
    const index = db.studentPlans.findIndex((p: any) => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'خطة الطالبة غير موجودة' });
    db.studentPlans[index] = { ...db.studentPlans[index], ...req.body };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'studentPlan', `تحديث خطة الطالبة`, req.params.id);
    writeDatabase(db);
    res.json(db.studentPlans[index]);
  });

  // Daily records (Memorization, Revision, Conditions, Recitation grade)
  api.post('/daily-records', (req, res) => {
    const db = readDatabase();
    const newRecord = {
      id: `dr-${Date.now()}`,
      recordedBy: (db.currentUser?.name || 'ريفة المنصوري'),
      recordedAt: new Date().toISOString(),
      ...req.body
    };
    db.dailyRecords.push(newRecord);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'grade', 'dailyRecord', `تسجيل إنجاز يومي لطالبة بتاريخ ${newRecord.date}`, newRecord.id);
    writeDatabase(db);
    res.status(201).json(newRecord);
  });

  api.put('/daily-records/:id', (req, res) => {
    const db = readDatabase();
    const index = db.dailyRecords.findIndex((r: any) => r.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'السجل اليومي غير موجود' });
    db.dailyRecords[index] = {
      ...db.dailyRecords[index],
      ...req.body,
      recordedBy: (db.currentUser?.name || 'ريفة المنصوري'),
      recordedAt: new Date().toISOString()
    };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'dailyRecord', `تعديل السجل اليومي`, req.params.id);
    writeDatabase(db);
    res.json(db.dailyRecords[index]);
  });

  // Attendance & Early prep
  api.post('/attendance', (req, res) => {
    const db = readDatabase();
    // Check if record exists for this student & date
    const existingIndex = db.attendanceRecords.findIndex(
      (a: any) => a.studentId === req.body.studentId && a.date === req.body.date
    );
    let record;
    if (existingIndex >= 0) {
      db.attendanceRecords[existingIndex] = {
        ...db.attendanceRecords[existingIndex],
        ...req.body,
        recordedBy: (db.currentUser?.name || 'ريفة المنصوري'),
        recordedAt: new Date().toISOString()
      };
      record = db.attendanceRecords[existingIndex];
    } else {
      record = {
        id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        recordedBy: (db.currentUser?.name || 'ريفة المنصوري'),
        recordedAt: new Date().toISOString(),
        ...req.body
      };
      db.attendanceRecords.push(record);
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'attendance', `تسجيل حضور/تحضير لطالبة بتاريخ ${record.date}`, record.id);
    writeDatabase(db);
    res.json(record);
  });

  // Bulk attendance
  api.post('/attendance/bulk', (req, res) => {
    const { records } = req.body;
    if (!Array.isArray(records)) return res.status(400).json({ error: 'بيانات غير صالحة' });
    const db = readDatabase();
    records.forEach((rec: any) => {
      const idx = db.attendanceRecords.findIndex((a: any) => a.studentId === rec.studentId && a.date === rec.date);
      if (idx >= 0) {
        db.attendanceRecords[idx] = {
          ...db.attendanceRecords[idx],
          ...rec,
          recordedBy: (db.currentUser?.name || 'ريفة المنصوري'),
          recordedAt: new Date().toISOString()
        };
      } else {
        db.attendanceRecords.push({
          id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          recordedBy: (db.currentUser?.name || 'ريفة المنصوري'),
          recordedAt: new Date().toISOString(),
          ...rec
        });
      }
    });
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'attendance', `تسجيل حضور جماعي لـ ${records.length} طالبة`);
    writeDatabase(db);
    res.json({ success: true, count: records.length });
  });

  // Atqini assignments (strictly Tajweed)
  api.post('/atqini', (req, res) => {
    const db = readDatabase();
    const assignment = {
      id: `atq-${Date.now()}`,
      ...req.body
    };
    db.atqiniAssignments.push(assignment);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'atqini', `إضافة واجب تجويد جديد: ${assignment.title}`, assignment.id);
    writeDatabase(db);
    res.status(201).json(assignment);
  });

  api.put('/atqini/:id', (req, res) => {
    const db = readDatabase();
    const idx = db.atqiniAssignments.findIndex((a: any) => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'الواجب غير موجود' });
    db.atqiniAssignments[idx] = { ...db.atqiniAssignments[idx], ...req.body };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'atqini', `تعديل واجب التجويد: ${db.atqiniAssignments[idx].title}`, req.params.id);
    writeDatabase(db);
    res.json(db.atqiniAssignments[idx]);
  });

  api.delete('/atqini/:id', (req, res) => {
    const db = readDatabase();
    const idx = db.atqiniAssignments.findIndex((a: any) => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'الواجب غير موجود' });
    const deleted = db.atqiniAssignments.splice(idx, 1)[0];
    // Cascade remove submissions for this assignment
    db.studentAtqiniSubmissions = db.studentAtqiniSubmissions.filter((s: any) => s.assignmentId !== req.params.id);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'delete', 'atqini', `حذف واجب التجويد: ${deleted.title} وكافة تقييماته`, req.params.id);
    writeDatabase(db);
    res.json({ success: true, deletedId: req.params.id });
  });

  // Atqini submissions
  api.post('/atqini-submissions', (req, res) => {
    const db = readDatabase();
    const existing = db.studentAtqiniSubmissions.findIndex(
      (s: any) => s.assignmentId === req.body.assignmentId && s.studentId === req.body.studentId
    );
    let submission;
    if (existing >= 0) {
      db.studentAtqiniSubmissions[existing] = {
        ...db.studentAtqiniSubmissions[existing],
        ...req.body,
        evaluatedBy: (db.currentUser?.name || 'ريفة المنصوري')
      };
      submission = db.studentAtqiniSubmissions[existing];
    } else {
      submission = {
        id: `atqs-${Date.now()}`,
        evaluatedBy: (db.currentUser?.name || 'ريفة المنصوري'),
        ...req.body
      };
      db.studentAtqiniSubmissions.push(submission);
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'grade', 'atqiniSubmission', `تصحيح واجب تجويد لطالبة بدرجة ${submission.score}`, submission.id);
    writeDatabase(db);
    res.json(submission);
  });

  // Challenges (Thursday Challenge & Grand Revision)
  api.post('/challenges', (req, res) => {
    const db = readDatabase();
    const challenge = {
      id: `ch-${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: 'active',
      ...req.body
    };
    db.challenges.push(challenge);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'challenge', `إضافة تحدٍ قرآني جديد: ${challenge.title}`, challenge.id);
    writeDatabase(db);
    res.status(201).json(challenge);
  });

  api.put('/challenges/:id', (req, res) => {
    const db = readDatabase();
    const idx = db.challenges.findIndex((c: any) => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'التحدي غير موجود' });
    db.challenges[idx] = { ...db.challenges[idx], ...req.body };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'challenge', `تعديل التحدي القرآني: ${db.challenges[idx].title}`, req.params.id);
    writeDatabase(db);
    res.json(db.challenges[idx]);
  });

  api.delete('/challenges/:id', (req, res) => {
    const db = readDatabase();
    const idx = db.challenges.findIndex((c: any) => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'التحدي غير موجود' });
    const deleted = db.challenges.splice(idx, 1)[0];
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'delete', 'challenge', `حذف التحدي: ${deleted.title}`, req.params.id);
    writeDatabase(db);
    res.json({ success: true });
  });

  // Challenge Submissions (including peer review & partner collaboration)
  api.post('/challenge-submissions', (req, res) => {
    const db = readDatabase();
    const existing = db.studentChallengeSubmissions.findIndex(
      (s: any) => s.challengeId === req.body.challengeId && s.studentId === req.body.studentId
    );
    let submission;
    if (existing >= 0) {
      db.studentChallengeSubmissions[existing] = {
        ...db.studentChallengeSubmissions[existing],
        ...req.body,
        evaluatedBy: (db.currentUser?.name || 'ريفة المنصوري'),
        evaluatedAt: new Date().toISOString()
      };
      submission = db.studentChallengeSubmissions[existing];
    } else {
      submission = {
        id: `cs-${Date.now()}`,
        evaluatedBy: (db.currentUser?.name || 'ريفة المنصوري'),
        evaluatedAt: new Date().toISOString(),
        ...req.body
      };
      db.studentChallengeSubmissions.push(submission);
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'grade', 'challengeSubmission', `تقييم تحدي قرآني ومراجعة ثنائية للطالبة`, submission.id);
    writeDatabase(db);
    res.json(submission);
  });

  // Exams & Exam results
  api.post('/exams', (req, res) => {
    const db = readDatabase();
    const exam = {
      id: `ex-${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...req.body
    };
    db.monthlyExams.push(exam);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'exam', `إضافة اختبار شهري: ${exam.title}`, exam.id);
    writeDatabase(db);
    res.status(201).json(exam);
  });

  api.put('/exams/:id', (req, res) => {
    const db = readDatabase();
    const idx = db.monthlyExams.findIndex((e: any) => e.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'الاختبار غير موجود' });
    db.monthlyExams[idx] = { ...db.monthlyExams[idx], ...req.body };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'exam', `تعديل الاختبار: ${db.monthlyExams[idx].title}`, req.params.id);
    writeDatabase(db);
    res.json(db.monthlyExams[idx]);
  });

  api.delete('/exams/:id', (req, res) => {
    const db = readDatabase();
    const idx = db.monthlyExams.findIndex((e: any) => e.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'الاختبار غير موجود' });
    const deleted = db.monthlyExams.splice(idx, 1)[0];
    db.studentExamResults = db.studentExamResults.filter((r: any) => r.examId !== req.params.id);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'delete', 'exam', `حذف الاختبار الشهري: ${deleted.title}`, req.params.id);
    writeDatabase(db);
    res.json({ success: true });
  });

  api.post('/exam-results', (req, res) => {
    const db = readDatabase();
    const existing = db.studentExamResults.findIndex(
      (r: any) => r.examId === req.body.examId && r.studentId === req.body.studentId
    );
    let result;
    if (existing >= 0) {
      db.studentExamResults[existing] = {
        ...db.studentExamResults[existing],
        ...req.body,
        examinerName: (db.currentUser?.name || 'ريفة المنصوري'),
        evaluatedAt: new Date().toISOString()
      };
      result = db.studentExamResults[existing];
    } else {
      result = {
        id: `er-${Date.now()}`,
        examinerName: (db.currentUser?.name || 'ريفة المنصوري'),
        evaluatedAt: new Date().toISOString(),
        ...req.body
      };
      db.studentExamResults.push(result);
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'grade', 'examResult', `رصد درجة اختبار شهري للطالبة: ${result.score}`, result.id);
    writeDatabase(db);
    res.json(result);
  });

  // Grading config
  api.put('/grading-config/:trackId', (req, res) => {
    const db = readDatabase();
    const idx = db.gradingConfigs.findIndex((g: any) => g.trackId === req.params.trackId);
    if (idx >= 0) {
      db.gradingConfigs[idx] = { ...db.gradingConfigs[idx], ...req.body };
    } else {
      db.gradingConfigs.push({
        id: `gc-${Date.now()}`,
        trackId: req.params.trackId,
        ...req.body
      });
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'gradingConfig', `تعديل نظام الدرجات والنسب المئوية للمسار`, req.params.trackId);
    writeDatabase(db);
    res.json(db.gradingConfigs[idx >= 0 ? idx : db.gradingConfigs.length - 1]);
  });

  // Settings
  api.put('/settings', (req, res) => {
    const db = readDatabase();
    db.settings = { ...db.settings, ...req.body };
    if (req.body.leaderPasscode) {
      const cleanPass = String(req.body.leaderPasscode).trim();
      db.settings.leaderPasscode = cleanPass;
      // Keep leader user in sync
      const leaderUser = db.users.find((u: any) => u.role === 'leader');
      if (leaderUser) {
        leaderUser.passcode = cleanPass;
      }
      if (db.currentUser && (db.currentUser?.role || 'leader') === 'leader') {
        db.currentUser.passcode = cleanPass;
      }
    }
    // Sync PWA icons with uploaded logo
    if (req.body.logoUrl && typeof req.body.logoUrl === 'string' && req.body.logoUrl.startsWith('data:image/')) {
      try {
        const base64Data = req.body.logoUrl.replace(/^data:image\/\w+;base64,/, '');
        const imgBuffer = Buffer.from(base64Data, 'base64');
        import('sharp').then(({ default: sharp }) => {
          sharp(imgBuffer).resize(192, 192).png().toFile('public/pwa-192x192.png').catch(() => {});
          sharp(imgBuffer).resize(512, 512).png().toFile('public/pwa-512x512.png').catch(() => {});
          sharp(imgBuffer).resize(180, 180).png().toFile('public/apple-touch-icon.png').catch(() => {});
          sharp(imgBuffer).resize(388, 388).toBuffer().then(inner => {
            sharp({
              create: { width: 512, height: 512, channels: 4, background: { r: 250, g: 245, b: 242, alpha: 1 } }
            }).composite([{ input: inner, gravity: 'center' }]).png().toFile('public/pwa-maskable-512x512.png').catch(() => {});
          }).catch(() => {});
        }).catch(() => {});
      } catch (err) {
        console.error('PWA icon sync error', err);
      }
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'settings', `تحديث الإعدادات العامة للمقرأة والهوية والشعار`);
    writeDatabase(db);
    const { leaderPasscode: _leaderPasscode, ...safeSettings } = db.settings;
    res.setHeader('Cache-Control', 'no-store');
    res.json(safeSettings);
  });

  // Manage users / permissions
  api.post('/users', (req, res) => {
    const db = readDatabase();
    const newUser = {
      id: `u-${Date.now()}`,
      circleIds: [],
      passcode: req.body.passcode ? String(req.body.passcode).trim() : '',
      ...req.body
    };
    db.users.push(newUser);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'user', `إضافة مستخدم جديد: ${newUser.name} (${newUser.title})`, newUser.id);
    writeDatabase(db);
    const { passcode: _passcode, ...safeNewUser } = newUser;
    res.status(201).json(safeNewUser);
  });

  api.put('/users/:id', (req, res) => {
    const db = readDatabase();
    const idx = db.users.findIndex((u: any) => u.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'المستخدم غير موجود' });
    const cleanBody = { ...req.body };
    if (cleanBody.passcode) {
      cleanBody.passcode = String(cleanBody.passcode).trim();
    }
    db.users[idx] = { ...db.users[idx], ...cleanBody };
    // If leader user passcode is changed, sync with settings.leaderPasscode
    if (db.users[idx].role === 'leader' && cleanBody.passcode) {
      db.settings.leaderPasscode = cleanBody.passcode;
    }
    if (db.currentUser.id === req.params.id) {
      db.currentUser = { ...db.currentUser, ...cleanBody };
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'user', `تعديل بيانات وصلاحيات المستخدم: ${db.users[idx].name}`, req.params.id);
    writeDatabase(db);
    const { passcode: _passcode, ...safeUpdatedUser } = db.users[idx];
    res.json(safeUpdatedUser);
  });

  // Backup & Restore
  api.get('/backup/download', (_req, res) => {
    const db = readDatabase();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=GhaithAlGhaym_backup_${Date.now()}.json`);
    res.send(JSON.stringify(db, null, 2));
  });

  api.post('/backup/restore', (req, res) => {
    const { backupData } = req.body;
    if (!backupData || !backupData.tracks || !backupData.students) {
      return res.status(400).json({ error: 'صيغة النسخة الاحتياطية غير صالحة' });
    }
    writeDatabase(backupData);
    addAudit(backupData, backupData.currentUser?.name || 'المدير', 'leader', 'restore', 'backup', 'استعادة قاعدة البيانات بالكامل من نسخة احتياطية');
    res.json({ success: true, message: 'تمت استعادة البيانات بنجاح' });
  });

  api.post('/backup/reset-sample', (_req, res) => {
    const freshDb = getInitialDatabase();
    addAudit(freshDb, freshDb.currentUser.name, 'leader', 'backup', 'reset', 'إعادة ضبط قاعدة البيانات إلى البيانات النموذجية الأصلية');
    writeDatabase(freshDb);
    res.json({ success: true, database: freshDb });
  });

  app.use('/api', api);

  const httpServer = http.createServer(app);

  const distPath = path.join(__dirname, 'dist');
  const hasDist = fs.existsSync(path.join(distPath, 'index.html'));

  if (process.env.NODE_ENV === 'production' || (hasDist && process.env.NODE_ENV !== 'development')) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          hmr: false
        },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (err) {
      if (hasDist) {
        app.use(express.static(distPath));
        app.get('*', (_req, res) => {
          res.sendFile(path.join(distPath, 'index.html'));
        });
      } else {
        console.error('Vite dev middleware failed and no dist found:', err);
      }
    }
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🌸 Ghaith Al-Ghaym Platform running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
);
      if (!salt || !digestHex || !/^[a-f0-9]{128}$/i.test(digestHex)) return false;
      const expected = Buffer.from(digestHex, 'hex');
      const actual = scryptSync(passcode, salt, expected.length);
      return expected.length === actual.length && timingSafeEqual(expected, actual);
    }
    // Legacy plain-text PINs are accepted only for migration, then upgraded on login.
    const expected = Buffer.from(stored);
    const actual = Buffer.from(passcode);
    return expected.length > 0 && expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  function createSession(user: any) {
    const payload = Buffer.from(JSON.stringify({
      userId: user.id,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
    })).toString('base64url');
    const signature = createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
    return payload + '.' + signature;
  }

  function getSession(req: express.Request): { userId: string; role: string; exp: number } | null {
    try {
      const cookieHeader = req.headers.cookie || '';
      const token = cookieHeader.split(';').map(v => v.trim()).find(v => v.startsWith(SESSION_COOKIE + '='))?.slice(SESSION_COOKIE.length + 1);
      if (!token) return null;
      const parts = token.split('.');
      if (parts.length !== 2) return null;
      const expected = createHmac('sha256', sessionSecret()).update(parts[0]).digest();
      const supplied = Buffer.from(parts[1], 'base64url');
      if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
      const session = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      if (!session.userId || !session.role || !Number.isFinite(session.exp) || session.exp <= Math.floor(Date.now() / 1000)) return null;
      return session;
    } catch {
      return null;
    }
  }

  function setSessionCookie(res: express.Response, token: string) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure}`);
  }

  function clearSessionCookie(res: express.Response) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`);
  }



  // Health check
  api.get('/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Public login directory: expose only the minimum fields needed by the sign-in selector.
  // Never send student records, staff contact details, or credentials before authentication.
  api.get('/auth/users', (_req, res) => {
    const db = readDatabase();
    res.setHeader('Cache-Control', 'no-store');
    res.json(db.users.map((user: any) => ({
      id: user.id,
      name: user.name,
      role: user.role,
      title: user.title,
      avatarIcon: user.avatarIcon,
      avatarColor: user.avatarColor
    })));
  });

  // Login is the only public data-adjacent endpoint. Configure SESSION_SECRET and
  // GHAYM_INITIAL_LEADER_PASSCODE before deploying; no built-in PIN is accepted.
  api.post('/auth/login', (req, res) => {
    let secret: string;
    try { secret = sessionSecret(); } catch { return res.status(503).json({ error: 'لم يتم إعداد أمان الجلسات على الخادم' }); }
    const userId = typeof req.body?.userId === 'string' ? req.body.userId : '';
    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode.trim() : '';
    if (!userId || !passcode || passcode.length > 128) return res.status(400).json({ error: 'اسم المستخدم والرمز السري مطلوبان' });
    const db = readDatabase();
    const user = db.users.find((u: any) => u.id === userId);
    if (!user) return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    const configuredPasscode = typeof user.passcode === 'string' ? user.passcode : '';
    const bootstrapPasscode = user.role === 'leader' ? (process.env.GHAYM_INITIAL_LEADER_PASSCODE || '') : '';
    const valid = (configuredPasscode.length > 0 && passcode === configuredPasscode) || (bootstrapPasscode.length > 0 && passcode === bootstrapPasscode);
    if (!valid) return res.status(401).json({ error: 'بيانات الدخول غير صحيحة أو لم يتم إعداد رمز لهذا الحساب' });
    setSessionCookie(res, createSession(user));
    res.setHeader('Cache-Control', 'no-store');
    const { passcode: _passcode, ...safeUser } = user;
    return res.json({ success: true, user: safeUser });
  });

  api.post('/auth/logout', (_req, res) => {
    clearSessionCookie(res);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true });
  });

  // Every other API route requires a signed, expiring server-side identity.
  api.use((req, res, next) => {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'يلزم تسجيل الدخول للوصول إلى هذه البيانات' });
    const db = readDatabase();
    const user = db.users.find((u: any) => u.id === session.userId);
    if (!user || user.role !== session.role) return res.status(401).json({ error: 'الجلسة غير صالحة؛ يرجى تسجيل الدخول مجددًا' });
    (req as any).authUser = { id: user.id, role: user.role, name: user.name };
    const route = req.path;
    const leaderOnly = route === '/users' || route.startsWith('/users/') || route === '/settings' || route.startsWith('/backup/') || route.startsWith('/grading-config/') || route === '/auth/switch-user';
    if (leaderOnly && user.role !== 'leader') return res.status(403).json({ error: 'لا تملك الصلاحية لتنفيذ هذه العملية' });
    next();
  });

  // Get sanitized state; never return PINs or the leader bootstrap credential.
  api.get('/state', (req, res) => {
    const db = readDatabase();
    const authUser = (req as any).authUser;
    const currentUser = db.users.find((u: any) => u.id === authUser.id) || null;
    const safeUser = (u: any) => { const { passcode: _passcode, ...safe } = u; return safe; };
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ...db, currentUser: currentUser ? safeUser(currentUser) : null, users: db.users.map(safeUser), settings: { ...db.settings, leaderPasscode: undefined } });
  });

  // Switch current active user
  api.post('/auth/switch-user', (req, res) => {
    const { userId } = req.body;
    const db = readDatabase();
    const user = db.users.find((u: any) => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }
    db.currentUser = user;
    addAudit(db, user.name, user.role, 'login', 'auth', `تسجيل الدخول / تبديل المستخدم إلى: ${user.name} (${user.title})`);
    writeDatabase(db);
    const { passcode: _passcode, ...safeUser } = user;
    res.json({ user: safeUser, success: true });
  });

  // Change user passcode
  api.post('/auth/change-passcode', (req, res) => {
    const { userId, newPasscode } = req.body;
    const authUser = (req as any).authUser;
    if (userId !== authUser.id && authUser.role !== 'leader') return res.status(403).json({ error: 'لا تملك الصلاحية لتغيير رمز هذا الحساب' });
    if (!newPasscode || !String(newPasscode).trim()) {
      return res.status(400).json({ error: 'الرمز السري الجديد مطلوب' });
    }
    const cleanNew = String(newPasscode).trim();
    const db = readDatabase();
    const user = db.users.find((u: any) => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }
    user.passcode = cleanNew;
    if (user.role === 'leader') {
      db.settings.leaderPasscode = cleanNew;
    }
    if (db.currentUser && db.currentUser.id === userId) {
      db.currentUser.passcode = cleanNew;
    }
    addAudit(db, user.name, user.role, 'update', 'user', `تحديث الرمز السري بنجاح للمستخدم: ${user.name}`, user.id);
    writeDatabase(db);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, message: 'تم تغيير الرمز السري بنجاح' });
  });

  // Tracks endpoints
  api.post('/tracks', (req, res) => {
    const db = readDatabase();
    const newTrack = {
      id: `t-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isArchived: false,
      ...req.body
    };
    db.tracks.push(newTrack);
    // Also create default grading config for this track if not exists
    const existingGc = db.gradingConfigs.find((g: any) => g.trackId === newTrack.id);
    if (!existingGc) {
      const templateGc = db.gradingConfigs[0];
      db.gradingConfigs.push({
        ...templateGc,
        id: `gc-${Date.now()}`,
        trackId: newTrack.id
      });
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'track', `إضافة مسار جديد: ${newTrack.name}`, newTrack.id);
    writeDatabase(db);
    res.status(201).json(newTrack);
  });

  api.put('/tracks/:id', (req, res) => {
    const db = readDatabase();
    const index = db.tracks.findIndex((t: any) => t.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'المسار غير موجود' });
    db.tracks[index] = { ...db.tracks[index], ...req.body, updatedAt: new Date().toISOString() };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'track', `تعديل المسار: ${db.tracks[index].name}`, req.params.id);
    writeDatabase(db);
    res.json(db.tracks[index]);
  });

  api.delete('/tracks/:id', (req, res) => {
    const db = readDatabase();
    const track = db.tracks.find((t: any) => t.id === req.params.id);
    if (!track) return res.status(404).json({ error: 'المسار غير موجود' });
    // Soft delete / archive
    track.isArchived = true;
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'archive', 'track', `أرشفة المسار: ${track.name}`, req.params.id);
    writeDatabase(db);
    res.json({ success: true, track });
  });

  // Circles endpoints
  api.post('/circles', (req, res) => {
    const db = readDatabase();
    const newCircle = {
      id: `c-${Date.now()}`,
      createdAt: new Date().toISOString(),
      isArchived: false,
      ...req.body
    };
    db.circles.push(newCircle);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'circle', `إضافة حلقة جديدة: ${newCircle.name}`, newCircle.id);
    writeDatabase(db);
    res.status(201).json(newCircle);
  });

  api.put('/circles/:id', (req, res) => {
    const db = readDatabase();
    const index = db.circles.findIndex((c: any) => c.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'الحلقة غير موجودة' });
    db.circles[index] = { ...db.circles[index], ...req.body };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'circle', `تعديل الحلقة: ${db.circles[index].name}`, req.params.id);
    writeDatabase(db);
    res.json(db.circles[index]);
  });

  api.delete('/circles/:id', (req, res) => {
    const db = readDatabase();
    const circle = db.circles.find((c: any) => c.id === req.params.id);
    if (!circle) return res.status(404).json({ error: 'الحلقة غير موجودة' });
    circle.isArchived = true;
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'archive', 'circle', `أرشفة الحلقة: ${circle.name}`, req.params.id);
    writeDatabase(db);
    res.json({ success: true, circle });
  });

  // Students endpoints
  api.post('/students', (req, res) => {
    const db = readDatabase();
    const newStudent = {
      id: `s-${Date.now()}`,
      code: req.body.code || `GH-${Math.floor(100 + Math.random() * 900)}`,
      createdAt: new Date().toISOString(),
      status: 'active',
      ...req.body
    };
    db.students.push(newStudent);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'student', `إضافة طالبة: ${newStudent.name} (كود: ${newStudent.code})`, newStudent.id);
    writeDatabase(db);
    res.status(201).json(newStudent);
  });

  api.put('/students/:id', (req, res) => {
    const db = readDatabase();
    const index = db.students.findIndex((s: any) => s.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'الطالبة غير موجودة' });
    db.students[index] = { ...db.students[index], ...req.body };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'student', `تعديل بيانات الطالبة: ${db.students[index].name}`, req.params.id);
    writeDatabase(db);
    res.json(db.students[index]);
  });

  api.delete('/students/:id', (req, res) => {
    const db = readDatabase();
    const student = db.students.find((s: any) => s.id === req.params.id);
    if (!student) return res.status(404).json({ error: 'الطالبة غير موجودة' });
    student.status = 'archived';
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'archive', 'student', `أرشفة الطالبة: ${student.name}`, req.params.id);
    writeDatabase(db);
    res.json({ success: true, student });
  });

  // Pair or unpair two students directly for Revision Matrix & Challenges
  api.post('/students/pair', (req, res) => {
    const { studentId1, studentId2 } = req.body;
    const db = readDatabase();
    const s1 = db.students.find((s: any) => s.id === studentId1);
    if (!s1) return res.status(404).json({ error: 'الطالبة الأولى غير موجودة' });

    if (!studentId2) {
      // Unpair s1 and whatever previous partner she had
      const oldPartnerId = s1.partnerStudentId;
      s1.partnerStudentId = undefined;
      s1.partnerStudentName = undefined;
      if (oldPartnerId) {
        const oldPartner = db.students.find((s: any) => s.id === oldPartnerId);
        if (oldPartner && oldPartner.partnerStudentId === studentId1) {
          oldPartner.partnerStudentId = undefined;
          oldPartner.partnerStudentName = undefined;
        }
      }
      addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'student', `إلغاء ثنائي الطالبة: ${s1.name}`, studentId1);
      writeDatabase(db);
      return res.json({ success: true, unpair: true, student: s1 });
    }

    const s2 = db.students.find((s: any) => s.id === studentId2);
    if (!s2) return res.status(404).json({ error: 'الطالبة المحددة كرفيقة غير موجودة' });

    // If s1 or s2 already had other partners, clear them first
    if (s1.partnerStudentId && s1.partnerStudentId !== s2.id) {
      const prev1 = db.students.find((s: any) => s.id === s1.partnerStudentId);
      if (prev1 && prev1.partnerStudentId === s1.id) {
        prev1.partnerStudentId = undefined;
        prev1.partnerStudentName = undefined;
      }
    }
    if (s2.partnerStudentId && s2.partnerStudentId !== s1.id) {
      const prev2 = db.students.find((s: any) => s.id === s2.partnerStudentId);
      if (prev2 && prev2.partnerStudentId === s2.id) {
        prev2.partnerStudentId = undefined;
        prev2.partnerStudentName = undefined;
      }
    }

    // Set reciprocal pairing
    s1.partnerStudentId = s2.id;
    s1.partnerStudentName = s2.name;
    s2.partnerStudentId = s1.id;
    s2.partnerStudentName = s1.name;

    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'student', `تحديد وتحديث الثنائي القرآني: ${s1.name} و ${s2.name}`, studentId1);
    writeDatabase(db);
    res.json({ success: true, s1, s2 });
  });

  // Monthly Plans endpoints
  api.post('/monthly-plans', (req, res) => {
    const db = readDatabase();
    const newPlan = {
      id: `mp-${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: 'active',
      ...req.body
    };
    db.monthlyPlans.push(newPlan);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'monthlyPlan', `إنشاء خطة شهرية: ${newPlan.title}`, newPlan.id);
    writeDatabase(db);
    res.status(201).json(newPlan);
  });

  api.put('/monthly-plans/:id', (req, res) => {
    const db = readDatabase();
    const index = db.monthlyPlans.findIndex((p: any) => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'الخطة غير موجودة' });
    db.monthlyPlans[index] = { ...db.monthlyPlans[index], ...req.body };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'monthlyPlan', `تعديل الخطة: ${db.monthlyPlans[index].title}`, req.params.id);
    writeDatabase(db);
    res.json(db.monthlyPlans[index]);
  });

  api.post('/monthly-plans/:id/duplicate', (req, res) => {
    const db = readDatabase();
    const sourcePlan = db.monthlyPlans.find((p: any) => p.id === req.params.id);
    if (!sourcePlan) return res.status(404).json({ error: 'الخطة الأصلية غير موجودة' });
    const newPlan = {
      ...sourcePlan,
      id: `mp-${Date.now()}`,
      title: `${sourcePlan.title} (نسخة جديدة)`,
      createdAt: new Date().toISOString(),
      status: 'active'
    };
    db.monthlyPlans.push(newPlan);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'monthlyPlan', `نسخ خطة شهرية سابقة إلى: ${newPlan.title}`, newPlan.id);
    writeDatabase(db);
    res.status(201).json(newPlan);
  });

  // Student Plans
  api.post('/student-plans', (req, res) => {
    const db = readDatabase();
    const newPlan = {
      id: `sp-${Date.now()}`,
      status: 'active',
      ...req.body
    };
    db.studentPlans.push(newPlan);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'studentPlan', `تخصيص خطة شهرية لطالبة`, newPlan.id);
    writeDatabase(db);
    res.status(201).json(newPlan);
  });

  api.put('/student-plans/:id', (req, res) => {
    const db = readDatabase();
    const index = db.studentPlans.findIndex((p: any) => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'خطة الطالبة غير موجودة' });
    db.studentPlans[index] = { ...db.studentPlans[index], ...req.body };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'studentPlan', `تحديث خطة الطالبة`, req.params.id);
    writeDatabase(db);
    res.json(db.studentPlans[index]);
  });

  // Daily records (Memorization, Revision, Conditions, Recitation grade)
  api.post('/daily-records', (req, res) => {
    const db = readDatabase();
    const newRecord = {
      id: `dr-${Date.now()}`,
      recordedBy: (db.currentUser?.name || 'ريفة المنصوري'),
      recordedAt: new Date().toISOString(),
      ...req.body
    };
    db.dailyRecords.push(newRecord);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'grade', 'dailyRecord', `تسجيل إنجاز يومي لطالبة بتاريخ ${newRecord.date}`, newRecord.id);
    writeDatabase(db);
    res.status(201).json(newRecord);
  });

  api.put('/daily-records/:id', (req, res) => {
    const db = readDatabase();
    const index = db.dailyRecords.findIndex((r: any) => r.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'السجل اليومي غير موجود' });
    db.dailyRecords[index] = {
      ...db.dailyRecords[index],
      ...req.body,
      recordedBy: (db.currentUser?.name || 'ريفة المنصوري'),
      recordedAt: new Date().toISOString()
    };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'dailyRecord', `تعديل السجل اليومي`, req.params.id);
    writeDatabase(db);
    res.json(db.dailyRecords[index]);
  });

  // Attendance & Early prep
  api.post('/attendance', (req, res) => {
    const db = readDatabase();
    // Check if record exists for this student & date
    const existingIndex = db.attendanceRecords.findIndex(
      (a: any) => a.studentId === req.body.studentId && a.date === req.body.date
    );
    let record;
    if (existingIndex >= 0) {
      db.attendanceRecords[existingIndex] = {
        ...db.attendanceRecords[existingIndex],
        ...req.body,
        recordedBy: (db.currentUser?.name || 'ريفة المنصوري'),
        recordedAt: new Date().toISOString()
      };
      record = db.attendanceRecords[existingIndex];
    } else {
      record = {
        id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        recordedBy: (db.currentUser?.name || 'ريفة المنصوري'),
        recordedAt: new Date().toISOString(),
        ...req.body
      };
      db.attendanceRecords.push(record);
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'attendance', `تسجيل حضور/تحضير لطالبة بتاريخ ${record.date}`, record.id);
    writeDatabase(db);
    res.json(record);
  });

  // Bulk attendance
  api.post('/attendance/bulk', (req, res) => {
    const { records } = req.body;
    if (!Array.isArray(records)) return res.status(400).json({ error: 'بيانات غير صالحة' });
    const db = readDatabase();
    records.forEach((rec: any) => {
      const idx = db.attendanceRecords.findIndex((a: any) => a.studentId === rec.studentId && a.date === rec.date);
      if (idx >= 0) {
        db.attendanceRecords[idx] = {
          ...db.attendanceRecords[idx],
          ...rec,
          recordedBy: (db.currentUser?.name || 'ريفة المنصوري'),
          recordedAt: new Date().toISOString()
        };
      } else {
        db.attendanceRecords.push({
          id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          recordedBy: (db.currentUser?.name || 'ريفة المنصوري'),
          recordedAt: new Date().toISOString(),
          ...rec
        });
      }
    });
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'attendance', `تسجيل حضور جماعي لـ ${records.length} طالبة`);
    writeDatabase(db);
    res.json({ success: true, count: records.length });
  });

  // Atqini assignments (strictly Tajweed)
  api.post('/atqini', (req, res) => {
    const db = readDatabase();
    const assignment = {
      id: `atq-${Date.now()}`,
      ...req.body
    };
    db.atqiniAssignments.push(assignment);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'atqini', `إضافة واجب تجويد جديد: ${assignment.title}`, assignment.id);
    writeDatabase(db);
    res.status(201).json(assignment);
  });

  api.put('/atqini/:id', (req, res) => {
    const db = readDatabase();
    const idx = db.atqiniAssignments.findIndex((a: any) => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'الواجب غير موجود' });
    db.atqiniAssignments[idx] = { ...db.atqiniAssignments[idx], ...req.body };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'atqini', `تعديل واجب التجويد: ${db.atqiniAssignments[idx].title}`, req.params.id);
    writeDatabase(db);
    res.json(db.atqiniAssignments[idx]);
  });

  api.delete('/atqini/:id', (req, res) => {
    const db = readDatabase();
    const idx = db.atqiniAssignments.findIndex((a: any) => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'الواجب غير موجود' });
    const deleted = db.atqiniAssignments.splice(idx, 1)[0];
    // Cascade remove submissions for this assignment
    db.studentAtqiniSubmissions = db.studentAtqiniSubmissions.filter((s: any) => s.assignmentId !== req.params.id);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'delete', 'atqini', `حذف واجب التجويد: ${deleted.title} وكافة تقييماته`, req.params.id);
    writeDatabase(db);
    res.json({ success: true, deletedId: req.params.id });
  });

  // Atqini submissions
  api.post('/atqini-submissions', (req, res) => {
    const db = readDatabase();
    const existing = db.studentAtqiniSubmissions.findIndex(
      (s: any) => s.assignmentId === req.body.assignmentId && s.studentId === req.body.studentId
    );
    let submission;
    if (existing >= 0) {
      db.studentAtqiniSubmissions[existing] = {
        ...db.studentAtqiniSubmissions[existing],
        ...req.body,
        evaluatedBy: (db.currentUser?.name || 'ريفة المنصوري')
      };
      submission = db.studentAtqiniSubmissions[existing];
    } else {
      submission = {
        id: `atqs-${Date.now()}`,
        evaluatedBy: (db.currentUser?.name || 'ريفة المنصوري'),
        ...req.body
      };
      db.studentAtqiniSubmissions.push(submission);
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'grade', 'atqiniSubmission', `تصحيح واجب تجويد لطالبة بدرجة ${submission.score}`, submission.id);
    writeDatabase(db);
    res.json(submission);
  });

  // Challenges (Thursday Challenge & Grand Revision)
  api.post('/challenges', (req, res) => {
    const db = readDatabase();
    const challenge = {
      id: `ch-${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: 'active',
      ...req.body
    };
    db.challenges.push(challenge);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'challenge', `إضافة تحدٍ قرآني جديد: ${challenge.title}`, challenge.id);
    writeDatabase(db);
    res.status(201).json(challenge);
  });

  api.put('/challenges/:id', (req, res) => {
    const db = readDatabase();
    const idx = db.challenges.findIndex((c: any) => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'التحدي غير موجود' });
    db.challenges[idx] = { ...db.challenges[idx], ...req.body };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'challenge', `تعديل التحدي القرآني: ${db.challenges[idx].title}`, req.params.id);
    writeDatabase(db);
    res.json(db.challenges[idx]);
  });

  api.delete('/challenges/:id', (req, res) => {
    const db = readDatabase();
    const idx = db.challenges.findIndex((c: any) => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'التحدي غير موجود' });
    const deleted = db.challenges.splice(idx, 1)[0];
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'delete', 'challenge', `حذف التحدي: ${deleted.title}`, req.params.id);
    writeDatabase(db);
    res.json({ success: true });
  });

  // Challenge Submissions (including peer review & partner collaboration)
  api.post('/challenge-submissions', (req, res) => {
    const db = readDatabase();
    const existing = db.studentChallengeSubmissions.findIndex(
      (s: any) => s.challengeId === req.body.challengeId && s.studentId === req.body.studentId
    );
    let submission;
    if (existing >= 0) {
      db.studentChallengeSubmissions[existing] = {
        ...db.studentChallengeSubmissions[existing],
        ...req.body,
        evaluatedBy: (db.currentUser?.name || 'ريفة المنصوري'),
        evaluatedAt: new Date().toISOString()
      };
      submission = db.studentChallengeSubmissions[existing];
    } else {
      submission = {
        id: `cs-${Date.now()}`,
        evaluatedBy: (db.currentUser?.name || 'ريفة المنصوري'),
        evaluatedAt: new Date().toISOString(),
        ...req.body
      };
      db.studentChallengeSubmissions.push(submission);
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'grade', 'challengeSubmission', `تقييم تحدي قرآني ومراجعة ثنائية للطالبة`, submission.id);
    writeDatabase(db);
    res.json(submission);
  });

  // Exams & Exam results
  api.post('/exams', (req, res) => {
    const db = readDatabase();
    const exam = {
      id: `ex-${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...req.body
    };
    db.monthlyExams.push(exam);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'exam', `إضافة اختبار شهري: ${exam.title}`, exam.id);
    writeDatabase(db);
    res.status(201).json(exam);
  });

  api.put('/exams/:id', (req, res) => {
    const db = readDatabase();
    const idx = db.monthlyExams.findIndex((e: any) => e.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'الاختبار غير موجود' });
    db.monthlyExams[idx] = { ...db.monthlyExams[idx], ...req.body };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'exam', `تعديل الاختبار: ${db.monthlyExams[idx].title}`, req.params.id);
    writeDatabase(db);
    res.json(db.monthlyExams[idx]);
  });

  api.delete('/exams/:id', (req, res) => {
    const db = readDatabase();
    const idx = db.monthlyExams.findIndex((e: any) => e.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'الاختبار غير موجود' });
    const deleted = db.monthlyExams.splice(idx, 1)[0];
    db.studentExamResults = db.studentExamResults.filter((r: any) => r.examId !== req.params.id);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'delete', 'exam', `حذف الاختبار الشهري: ${deleted.title}`, req.params.id);
    writeDatabase(db);
    res.json({ success: true });
  });

  api.post('/exam-results', (req, res) => {
    const db = readDatabase();
    const existing = db.studentExamResults.findIndex(
      (r: any) => r.examId === req.body.examId && r.studentId === req.body.studentId
    );
    let result;
    if (existing >= 0) {
      db.studentExamResults[existing] = {
        ...db.studentExamResults[existing],
        ...req.body,
        examinerName: (db.currentUser?.name || 'ريفة المنصوري'),
        evaluatedAt: new Date().toISOString()
      };
      result = db.studentExamResults[existing];
    } else {
      result = {
        id: `er-${Date.now()}`,
        examinerName: (db.currentUser?.name || 'ريفة المنصوري'),
        evaluatedAt: new Date().toISOString(),
        ...req.body
      };
      db.studentExamResults.push(result);
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'grade', 'examResult', `رصد درجة اختبار شهري للطالبة: ${result.score}`, result.id);
    writeDatabase(db);
    res.json(result);
  });

  // Grading config
  api.put('/grading-config/:trackId', (req, res) => {
    const db = readDatabase();
    const idx = db.gradingConfigs.findIndex((g: any) => g.trackId === req.params.trackId);
    if (idx >= 0) {
      db.gradingConfigs[idx] = { ...db.gradingConfigs[idx], ...req.body };
    } else {
      db.gradingConfigs.push({
        id: `gc-${Date.now()}`,
        trackId: req.params.trackId,
        ...req.body
      });
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'gradingConfig', `تعديل نظام الدرجات والنسب المئوية للمسار`, req.params.trackId);
    writeDatabase(db);
    res.json(db.gradingConfigs[idx >= 0 ? idx : db.gradingConfigs.length - 1]);
  });

  // Settings
  api.put('/settings', (req, res) => {
    const db = readDatabase();
    db.settings = { ...db.settings, ...req.body };
    if (req.body.leaderPasscode) {
      const cleanPass = String(req.body.leaderPasscode).trim();
      db.settings.leaderPasscode = cleanPass;
      // Keep leader user in sync
      const leaderUser = db.users.find((u: any) => u.role === 'leader');
      if (leaderUser) {
        leaderUser.passcode = cleanPass;
      }
      if (db.currentUser && (db.currentUser?.role || 'leader') === 'leader') {
        db.currentUser.passcode = cleanPass;
      }
    }
    // Sync PWA icons with uploaded logo
    if (req.body.logoUrl && typeof req.body.logoUrl === 'string' && req.body.logoUrl.startsWith('data:image/')) {
      try {
        const base64Data = req.body.logoUrl.replace(/^data:image\/\w+;base64,/, '');
        const imgBuffer = Buffer.from(base64Data, 'base64');
        import('sharp').then(({ default: sharp }) => {
          sharp(imgBuffer).resize(192, 192).png().toFile('public/pwa-192x192.png').catch(() => {});
          sharp(imgBuffer).resize(512, 512).png().toFile('public/pwa-512x512.png').catch(() => {});
          sharp(imgBuffer).resize(180, 180).png().toFile('public/apple-touch-icon.png').catch(() => {});
          sharp(imgBuffer).resize(388, 388).toBuffer().then(inner => {
            sharp({
              create: { width: 512, height: 512, channels: 4, background: { r: 250, g: 245, b: 242, alpha: 1 } }
            }).composite([{ input: inner, gravity: 'center' }]).png().toFile('public/pwa-maskable-512x512.png').catch(() => {});
          }).catch(() => {});
        }).catch(() => {});
      } catch (err) {
        console.error('PWA icon sync error', err);
      }
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'settings', `تحديث الإعدادات العامة للمقرأة والهوية والشعار`);
    writeDatabase(db);
    const { leaderPasscode: _leaderPasscode, ...safeSettings } = db.settings;
    res.setHeader('Cache-Control', 'no-store');
    res.json(safeSettings);
  });

  // Manage users / permissions
  api.post('/users', (req, res) => {
    const db = readDatabase();
    const newUser = {
      id: `u-${Date.now()}`,
      circleIds: [],
      passcode: req.body.passcode ? String(req.body.passcode).trim() : '',
      ...req.body
    };
    db.users.push(newUser);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'user', `إضافة مستخدم جديد: ${newUser.name} (${newUser.title})`, newUser.id);
    writeDatabase(db);
    const { passcode: _passcode, ...safeNewUser } = newUser;
    res.status(201).json(safeNewUser);
  });

  api.put('/users/:id', (req, res) => {
    const db = readDatabase();
    const idx = db.users.findIndex((u: any) => u.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'المستخدم غير موجود' });
    const cleanBody = { ...req.body };
    if (cleanBody.passcode) {
      cleanBody.passcode = String(cleanBody.passcode).trim();
    }
    db.users[idx] = { ...db.users[idx], ...cleanBody };
    // If leader user passcode is changed, sync with settings.leaderPasscode
    if (db.users[idx].role === 'leader' && cleanBody.passcode) {
      db.settings.leaderPasscode = cleanBody.passcode;
    }
    if (db.currentUser.id === req.params.id) {
      db.currentUser = { ...db.currentUser, ...cleanBody };
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'user', `تعديل بيانات وصلاحيات المستخدم: ${db.users[idx].name}`, req.params.id);
    writeDatabase(db);
    const { passcode: _passcode, ...safeUpdatedUser } = db.users[idx];
    res.json(safeUpdatedUser);
  });

  // Backup & Restore
  api.get('/backup/download', (_req, res) => {
    const db = readDatabase();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=GhaithAlGhaym_backup_${Date.now()}.json`);
    res.send(JSON.stringify(db, null, 2));
  });

  api.post('/backup/restore', (req, res) => {
    const { backupData } = req.body;
    if (!backupData || !backupData.tracks || !backupData.students) {
      return res.status(400).json({ error: 'صيغة النسخة الاحتياطية غير صالحة' });
    }
    writeDatabase(backupData);
    addAudit(backupData, backupData.currentUser?.name || 'المدير', 'leader', 'restore', 'backup', 'استعادة قاعدة البيانات بالكامل من نسخة احتياطية');
    res.json({ success: true, message: 'تمت استعادة البيانات بنجاح' });
  });

  api.post('/backup/reset-sample', (_req, res) => {
    const freshDb = getInitialDatabase();
    addAudit(freshDb, freshDb.currentUser.name, 'leader', 'backup', 'reset', 'إعادة ضبط قاعدة البيانات إلى البيانات النموذجية الأصلية');
    writeDatabase(freshDb);
    res.json({ success: true, database: freshDb });
  });

  app.use('/api', api);

  const httpServer = http.createServer(app);

  const distPath = path.join(__dirname, 'dist');
  const hasDist = fs.existsSync(path.join(distPath, 'index.html'));

  if (process.env.NODE_ENV === 'production' || (hasDist && process.env.NODE_ENV !== 'development')) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          hmr: false
        },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (err) {
      if (hasDist) {
        app.use(express.static(distPath));
        app.get('*', (_req, res) => {
          res.sendFile(path.join(distPath, 'index.html'));
        });
      } else {
        console.error('Vite dev middleware failed and no dist found:', err);
      }
    }
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🌸 Ghaith Al-Ghaym Platform running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
)) {
      user.passcode = hashPasscode(passcode);
      if (user.role === 'leader') db.settings.leaderPasscode = '';
      if (db.currentUser?.id === user.id) db.currentUser.passcode = user.passcode;
      writeDatabase(db);
    }
    setSessionCookie(res, createSession(user));
    res.setHeader('Cache-Control', 'no-store');
    const { passcode: _passcode, ...safeUser } = user;
    return res.json({ success: true, user: safeUser });
  });

  api.post('/auth/logout', (_req, res) => {
    clearSessionCookie(res);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true });
  });

  // Every other API route requires a signed, expiring server-side identity.
  api.use((req, res, next) => {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'يلزم تسجيل الدخول للوصول إلى هذه البيانات' });
    const db = readDatabase();
    const user = db.users.find((u: any) => u.id === session.userId);
    if (!user || user.role !== session.role) return res.status(401).json({ error: 'الجلسة غير صالحة؛ يرجى تسجيل الدخول مجددًا' });
    (req as any).authUser = { id: user.id, role: user.role, name: user.name };
    const route = req.path;
    const leaderOnly = route === '/users' || route.startsWith('/users/') || route === '/settings' || route.startsWith('/backup/') || route.startsWith('/grading-config/') || route === '/auth/switch-user';
    if (leaderOnly && user.role !== 'leader') return res.status(403).json({ error: 'لا تملك الصلاحية لتنفيذ هذه العملية' });
    next();
  });

  // Get sanitized state; never return PINs or the leader bootstrap credential.
  api.get('/state', (req, res) => {
    const db = readDatabase();
    const authUser = (req as any).authUser;
    const currentUser = db.users.find((u: any) => u.id === authUser.id) || null;
    const safeUser = (u: any) => { const { passcode: _passcode, ...safe } = u; return safe; };
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ...db, currentUser: currentUser ? safeUser(currentUser) : null, users: db.users.map(safeUser), settings: { ...db.settings, leaderPasscode: undefined } });
  });

  // Switch current active user
  api.post('/auth/switch-user', (req, res) => {
    const { userId } = req.body;
    const db = readDatabase();
    const user = db.users.find((u: any) => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }
    db.currentUser = user;
    addAudit(db, user.name, user.role, 'login', 'auth', `تسجيل الدخول / تبديل المستخدم إلى: ${user.name} (${user.title})`);
    writeDatabase(db);
    const { passcode: _passcode, ...safeUser } = user;
    res.json({ user: safeUser, success: true });
  });

  // Change user passcode
  api.post('/auth/change-passcode', (req, res) => {
    const { userId, newPasscode } = req.body;
    const authUser = (req as any).authUser;
    if (userId !== authUser.id && authUser.role !== 'leader') return res.status(403).json({ error: 'لا تملك الصلاحية لتغيير رمز هذا الحساب' });
    if (!newPasscode || !String(newPasscode).trim()) {
      return res.status(400).json({ error: 'الرمز السري الجديد مطلوب' });
    }
    const cleanNew = String(newPasscode).trim();
    const db = readDatabase();
    const user = db.users.find((u: any) => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }
    user.passcode = cleanNew;
    if (user.role === 'leader') {
      db.settings.leaderPasscode = cleanNew;
    }
    if (db.currentUser && db.currentUser.id === userId) {
      db.currentUser.passcode = cleanNew;
    }
    addAudit(db, user.name, user.role, 'update', 'user', `تحديث الرمز السري بنجاح للمستخدم: ${user.name}`, user.id);
    writeDatabase(db);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, message: 'تم تغيير الرمز السري بنجاح' });
  });

  // Tracks endpoints
  api.post('/tracks', (req, res) => {
    const db = readDatabase();
    const newTrack = {
      id: `t-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isArchived: false,
      ...req.body
    };
    db.tracks.push(newTrack);
    // Also create default grading config for this track if not exists
    const existingGc = db.gradingConfigs.find((g: any) => g.trackId === newTrack.id);
    if (!existingGc) {
      const templateGc = db.gradingConfigs[0];
      db.gradingConfigs.push({
        ...templateGc,
        id: `gc-${Date.now()}`,
        trackId: newTrack.id
      });
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'track', `إضافة مسار جديد: ${newTrack.name}`, newTrack.id);
    writeDatabase(db);
    res.status(201).json(newTrack);
  });

  api.put('/tracks/:id', (req, res) => {
    const db = readDatabase();
    const index = db.tracks.findIndex((t: any) => t.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'المسار غير موجود' });
    db.tracks[index] = { ...db.tracks[index], ...req.body, updatedAt: new Date().toISOString() };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'track', `تعديل المسار: ${db.tracks[index].name}`, req.params.id);
    writeDatabase(db);
    res.json(db.tracks[index]);
  });

  api.delete('/tracks/:id', (req, res) => {
    const db = readDatabase();
    const track = db.tracks.find((t: any) => t.id === req.params.id);
    if (!track) return res.status(404).json({ error: 'المسار غير موجود' });
    // Soft delete / archive
    track.isArchived = true;
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'archive', 'track', `أرشفة المسار: ${track.name}`, req.params.id);
    writeDatabase(db);
    res.json({ success: true, track });
  });

  // Circles endpoints
  api.post('/circles', (req, res) => {
    const db = readDatabase();
    const newCircle = {
      id: `c-${Date.now()}`,
      createdAt: new Date().toISOString(),
      isArchived: false,
      ...req.body
    };
    db.circles.push(newCircle);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'circle', `إضافة حلقة جديدة: ${newCircle.name}`, newCircle.id);
    writeDatabase(db);
    res.status(201).json(newCircle);
  });

  api.put('/circles/:id', (req, res) => {
    const db = readDatabase();
    const index = db.circles.findIndex((c: any) => c.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'الحلقة غير موجودة' });
    db.circles[index] = { ...db.circles[index], ...req.body };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'circle', `تعديل الحلقة: ${db.circles[index].name}`, req.params.id);
    writeDatabase(db);
    res.json(db.circles[index]);
  });

  api.delete('/circles/:id', (req, res) => {
    const db = readDatabase();
    const circle = db.circles.find((c: any) => c.id === req.params.id);
    if (!circle) return res.status(404).json({ error: 'الحلقة غير موجودة' });
    circle.isArchived = true;
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'archive', 'circle', `أرشفة الحلقة: ${circle.name}`, req.params.id);
    writeDatabase(db);
    res.json({ success: true, circle });
  });

  // Students endpoints
  api.post('/students', (req, res) => {
    const db = readDatabase();
    const newStudent = {
      id: `s-${Date.now()}`,
      code: req.body.code || `GH-${Math.floor(100 + Math.random() * 900)}`,
      createdAt: new Date().toISOString(),
      status: 'active',
      ...req.body
    };
    db.students.push(newStudent);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'student', `إضافة طالبة: ${newStudent.name} (كود: ${newStudent.code})`, newStudent.id);
    writeDatabase(db);
    res.status(201).json(newStudent);
  });

  api.put('/students/:id', (req, res) => {
    const db = readDatabase();
    const index = db.students.findIndex((s: any) => s.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'الطالبة غير موجودة' });
    db.students[index] = { ...db.students[index], ...req.body };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'student', `تعديل بيانات الطالبة: ${db.students[index].name}`, req.params.id);
    writeDatabase(db);
    res.json(db.students[index]);
  });

  api.delete('/students/:id', (req, res) => {
    const db = readDatabase();
    const student = db.students.find((s: any) => s.id === req.params.id);
    if (!student) return res.status(404).json({ error: 'الطالبة غير موجودة' });
    student.status = 'archived';
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'archive', 'student', `أرشفة الطالبة: ${student.name}`, req.params.id);
    writeDatabase(db);
    res.json({ success: true, student });
  });

  // Pair or unpair two students directly for Revision Matrix & Challenges
  api.post('/students/pair', (req, res) => {
    const { studentId1, studentId2 } = req.body;
    const db = readDatabase();
    const s1 = db.students.find((s: any) => s.id === studentId1);
    if (!s1) return res.status(404).json({ error: 'الطالبة الأولى غير موجودة' });

    if (!studentId2) {
      // Unpair s1 and whatever previous partner she had
      const oldPartnerId = s1.partnerStudentId;
      s1.partnerStudentId = undefined;
      s1.partnerStudentName = undefined;
      if (oldPartnerId) {
        const oldPartner = db.students.find((s: any) => s.id === oldPartnerId);
        if (oldPartner && oldPartner.partnerStudentId === studentId1) {
          oldPartner.partnerStudentId = undefined;
          oldPartner.partnerStudentName = undefined;
        }
      }
      addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'student', `إلغاء ثنائي الطالبة: ${s1.name}`, studentId1);
      writeDatabase(db);
      return res.json({ success: true, unpair: true, student: s1 });
    }

    const s2 = db.students.find((s: any) => s.id === studentId2);
    if (!s2) return res.status(404).json({ error: 'الطالبة المحددة كرفيقة غير موجودة' });

    // If s1 or s2 already had other partners, clear them first
    if (s1.partnerStudentId && s1.partnerStudentId !== s2.id) {
      const prev1 = db.students.find((s: any) => s.id === s1.partnerStudentId);
      if (prev1 && prev1.partnerStudentId === s1.id) {
        prev1.partnerStudentId = undefined;
        prev1.partnerStudentName = undefined;
      }
    }
    if (s2.partnerStudentId && s2.partnerStudentId !== s1.id) {
      const prev2 = db.students.find((s: any) => s.id === s2.partnerStudentId);
      if (prev2 && prev2.partnerStudentId === s2.id) {
        prev2.partnerStudentId = undefined;
        prev2.partnerStudentName = undefined;
      }
    }

    // Set reciprocal pairing
    s1.partnerStudentId = s2.id;
    s1.partnerStudentName = s2.name;
    s2.partnerStudentId = s1.id;
    s2.partnerStudentName = s1.name;

    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'student', `تحديد وتحديث الثنائي القرآني: ${s1.name} و ${s2.name}`, studentId1);
    writeDatabase(db);
    res.json({ success: true, s1, s2 });
  });

  // Monthly Plans endpoints
  api.post('/monthly-plans', (req, res) => {
    const db = readDatabase();
    const newPlan = {
      id: `mp-${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: 'active',
      ...req.body
    };
    db.monthlyPlans.push(newPlan);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'monthlyPlan', `إنشاء خطة شهرية: ${newPlan.title}`, newPlan.id);
    writeDatabase(db);
    res.status(201).json(newPlan);
  });

  api.put('/monthly-plans/:id', (req, res) => {
    const db = readDatabase();
    const index = db.monthlyPlans.findIndex((p: any) => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'الخطة غير موجودة' });
    db.monthlyPlans[index] = { ...db.monthlyPlans[index], ...req.body };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'monthlyPlan', `تعديل الخطة: ${db.monthlyPlans[index].title}`, req.params.id);
    writeDatabase(db);
    res.json(db.monthlyPlans[index]);
  });

  api.post('/monthly-plans/:id/duplicate', (req, res) => {
    const db = readDatabase();
    const sourcePlan = db.monthlyPlans.find((p: any) => p.id === req.params.id);
    if (!sourcePlan) return res.status(404).json({ error: 'الخطة الأصلية غير موجودة' });
    const newPlan = {
      ...sourcePlan,
      id: `mp-${Date.now()}`,
      title: `${sourcePlan.title} (نسخة جديدة)`,
      createdAt: new Date().toISOString(),
      status: 'active'
    };
    db.monthlyPlans.push(newPlan);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'monthlyPlan', `نسخ خطة شهرية سابقة إلى: ${newPlan.title}`, newPlan.id);
    writeDatabase(db);
    res.status(201).json(newPlan);
  });

  // Student Plans
  api.post('/student-plans', (req, res) => {
    const db = readDatabase();
    const newPlan = {
      id: `sp-${Date.now()}`,
      status: 'active',
      ...req.body
    };
    db.studentPlans.push(newPlan);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'studentPlan', `تخصيص خطة شهرية لطالبة`, newPlan.id);
    writeDatabase(db);
    res.status(201).json(newPlan);
  });

  api.put('/student-plans/:id', (req, res) => {
    const db = readDatabase();
    const index = db.studentPlans.findIndex((p: any) => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'خطة الطالبة غير موجودة' });
    db.studentPlans[index] = { ...db.studentPlans[index], ...req.body };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'studentPlan', `تحديث خطة الطالبة`, req.params.id);
    writeDatabase(db);
    res.json(db.studentPlans[index]);
  });

  // Daily records (Memorization, Revision, Conditions, Recitation grade)
  api.post('/daily-records', (req, res) => {
    const db = readDatabase();
    const newRecord = {
      id: `dr-${Date.now()}`,
      recordedBy: (db.currentUser?.name || 'ريفة المنصوري'),
      recordedAt: new Date().toISOString(),
      ...req.body
    };
    db.dailyRecords.push(newRecord);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'grade', 'dailyRecord', `تسجيل إنجاز يومي لطالبة بتاريخ ${newRecord.date}`, newRecord.id);
    writeDatabase(db);
    res.status(201).json(newRecord);
  });

  api.put('/daily-records/:id', (req, res) => {
    const db = readDatabase();
    const index = db.dailyRecords.findIndex((r: any) => r.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'السجل اليومي غير موجود' });
    db.dailyRecords[index] = {
      ...db.dailyRecords[index],
      ...req.body,
      recordedBy: (db.currentUser?.name || 'ريفة المنصوري'),
      recordedAt: new Date().toISOString()
    };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'dailyRecord', `تعديل السجل اليومي`, req.params.id);
    writeDatabase(db);
    res.json(db.dailyRecords[index]);
  });

  // Attendance & Early prep
  api.post('/attendance', (req, res) => {
    const db = readDatabase();
    // Check if record exists for this student & date
    const existingIndex = db.attendanceRecords.findIndex(
      (a: any) => a.studentId === req.body.studentId && a.date === req.body.date
    );
    let record;
    if (existingIndex >= 0) {
      db.attendanceRecords[existingIndex] = {
        ...db.attendanceRecords[existingIndex],
        ...req.body,
        recordedBy: (db.currentUser?.name || 'ريفة المنصوري'),
        recordedAt: new Date().toISOString()
      };
      record = db.attendanceRecords[existingIndex];
    } else {
      record = {
        id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        recordedBy: (db.currentUser?.name || 'ريفة المنصوري'),
        recordedAt: new Date().toISOString(),
        ...req.body
      };
      db.attendanceRecords.push(record);
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'attendance', `تسجيل حضور/تحضير لطالبة بتاريخ ${record.date}`, record.id);
    writeDatabase(db);
    res.json(record);
  });

  // Bulk attendance
  api.post('/attendance/bulk', (req, res) => {
    const { records } = req.body;
    if (!Array.isArray(records)) return res.status(400).json({ error: 'بيانات غير صالحة' });
    const db = readDatabase();
    records.forEach((rec: any) => {
      const idx = db.attendanceRecords.findIndex((a: any) => a.studentId === rec.studentId && a.date === rec.date);
      if (idx >= 0) {
        db.attendanceRecords[idx] = {
          ...db.attendanceRecords[idx],
          ...rec,
          recordedBy: (db.currentUser?.name || 'ريفة المنصوري'),
          recordedAt: new Date().toISOString()
        };
      } else {
        db.attendanceRecords.push({
          id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          recordedBy: (db.currentUser?.name || 'ريفة المنصوري'),
          recordedAt: new Date().toISOString(),
          ...rec
        });
      }
    });
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'attendance', `تسجيل حضور جماعي لـ ${records.length} طالبة`);
    writeDatabase(db);
    res.json({ success: true, count: records.length });
  });

  // Atqini assignments (strictly Tajweed)
  api.post('/atqini', (req, res) => {
    const db = readDatabase();
    const assignment = {
      id: `atq-${Date.now()}`,
      ...req.body
    };
    db.atqiniAssignments.push(assignment);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'atqini', `إضافة واجب تجويد جديد: ${assignment.title}`, assignment.id);
    writeDatabase(db);
    res.status(201).json(assignment);
  });

  api.put('/atqini/:id', (req, res) => {
    const db = readDatabase();
    const idx = db.atqiniAssignments.findIndex((a: any) => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'الواجب غير موجود' });
    db.atqiniAssignments[idx] = { ...db.atqiniAssignments[idx], ...req.body };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'atqini', `تعديل واجب التجويد: ${db.atqiniAssignments[idx].title}`, req.params.id);
    writeDatabase(db);
    res.json(db.atqiniAssignments[idx]);
  });

  api.delete('/atqini/:id', (req, res) => {
    const db = readDatabase();
    const idx = db.atqiniAssignments.findIndex((a: any) => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'الواجب غير موجود' });
    const deleted = db.atqiniAssignments.splice(idx, 1)[0];
    // Cascade remove submissions for this assignment
    db.studentAtqiniSubmissions = db.studentAtqiniSubmissions.filter((s: any) => s.assignmentId !== req.params.id);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'delete', 'atqini', `حذف واجب التجويد: ${deleted.title} وكافة تقييماته`, req.params.id);
    writeDatabase(db);
    res.json({ success: true, deletedId: req.params.id });
  });

  // Atqini submissions
  api.post('/atqini-submissions', (req, res) => {
    const db = readDatabase();
    const existing = db.studentAtqiniSubmissions.findIndex(
      (s: any) => s.assignmentId === req.body.assignmentId && s.studentId === req.body.studentId
    );
    let submission;
    if (existing >= 0) {
      db.studentAtqiniSubmissions[existing] = {
        ...db.studentAtqiniSubmissions[existing],
        ...req.body,
        evaluatedBy: (db.currentUser?.name || 'ريفة المنصوري')
      };
      submission = db.studentAtqiniSubmissions[existing];
    } else {
      submission = {
        id: `atqs-${Date.now()}`,
        evaluatedBy: (db.currentUser?.name || 'ريفة المنصوري'),
        ...req.body
      };
      db.studentAtqiniSubmissions.push(submission);
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'grade', 'atqiniSubmission', `تصحيح واجب تجويد لطالبة بدرجة ${submission.score}`, submission.id);
    writeDatabase(db);
    res.json(submission);
  });

  // Challenges (Thursday Challenge & Grand Revision)
  api.post('/challenges', (req, res) => {
    const db = readDatabase();
    const challenge = {
      id: `ch-${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: 'active',
      ...req.body
    };
    db.challenges.push(challenge);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'challenge', `إضافة تحدٍ قرآني جديد: ${challenge.title}`, challenge.id);
    writeDatabase(db);
    res.status(201).json(challenge);
  });

  api.put('/challenges/:id', (req, res) => {
    const db = readDatabase();
    const idx = db.challenges.findIndex((c: any) => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'التحدي غير موجود' });
    db.challenges[idx] = { ...db.challenges[idx], ...req.body };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'challenge', `تعديل التحدي القرآني: ${db.challenges[idx].title}`, req.params.id);
    writeDatabase(db);
    res.json(db.challenges[idx]);
  });

  api.delete('/challenges/:id', (req, res) => {
    const db = readDatabase();
    const idx = db.challenges.findIndex((c: any) => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'التحدي غير موجود' });
    const deleted = db.challenges.splice(idx, 1)[0];
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'delete', 'challenge', `حذف التحدي: ${deleted.title}`, req.params.id);
    writeDatabase(db);
    res.json({ success: true });
  });

  // Challenge Submissions (including peer review & partner collaboration)
  api.post('/challenge-submissions', (req, res) => {
    const db = readDatabase();
    const existing = db.studentChallengeSubmissions.findIndex(
      (s: any) => s.challengeId === req.body.challengeId && s.studentId === req.body.studentId
    );
    let submission;
    if (existing >= 0) {
      db.studentChallengeSubmissions[existing] = {
        ...db.studentChallengeSubmissions[existing],
        ...req.body,
        evaluatedBy: (db.currentUser?.name || 'ريفة المنصوري'),
        evaluatedAt: new Date().toISOString()
      };
      submission = db.studentChallengeSubmissions[existing];
    } else {
      submission = {
        id: `cs-${Date.now()}`,
        evaluatedBy: (db.currentUser?.name || 'ريفة المنصوري'),
        evaluatedAt: new Date().toISOString(),
        ...req.body
      };
      db.studentChallengeSubmissions.push(submission);
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'grade', 'challengeSubmission', `تقييم تحدي قرآني ومراجعة ثنائية للطالبة`, submission.id);
    writeDatabase(db);
    res.json(submission);
  });

  // Exams & Exam results
  api.post('/exams', (req, res) => {
    const db = readDatabase();
    const exam = {
      id: `ex-${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...req.body
    };
    db.monthlyExams.push(exam);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'exam', `إضافة اختبار شهري: ${exam.title}`, exam.id);
    writeDatabase(db);
    res.status(201).json(exam);
  });

  api.put('/exams/:id', (req, res) => {
    const db = readDatabase();
    const idx = db.monthlyExams.findIndex((e: any) => e.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'الاختبار غير موجود' });
    db.monthlyExams[idx] = { ...db.monthlyExams[idx], ...req.body };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'exam', `تعديل الاختبار: ${db.monthlyExams[idx].title}`, req.params.id);
    writeDatabase(db);
    res.json(db.monthlyExams[idx]);
  });

  api.delete('/exams/:id', (req, res) => {
    const db = readDatabase();
    const idx = db.monthlyExams.findIndex((e: any) => e.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'الاختبار غير موجود' });
    const deleted = db.monthlyExams.splice(idx, 1)[0];
    db.studentExamResults = db.studentExamResults.filter((r: any) => r.examId !== req.params.id);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'delete', 'exam', `حذف الاختبار الشهري: ${deleted.title}`, req.params.id);
    writeDatabase(db);
    res.json({ success: true });
  });

  api.post('/exam-results', (req, res) => {
    const db = readDatabase();
    const existing = db.studentExamResults.findIndex(
      (r: any) => r.examId === req.body.examId && r.studentId === req.body.studentId
    );
    let result;
    if (existing >= 0) {
      db.studentExamResults[existing] = {
        ...db.studentExamResults[existing],
        ...req.body,
        examinerName: (db.currentUser?.name || 'ريفة المنصوري'),
        evaluatedAt: new Date().toISOString()
      };
      result = db.studentExamResults[existing];
    } else {
      result = {
        id: `er-${Date.now()}`,
        examinerName: (db.currentUser?.name || 'ريفة المنصوري'),
        evaluatedAt: new Date().toISOString(),
        ...req.body
      };
      db.studentExamResults.push(result);
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'grade', 'examResult', `رصد درجة اختبار شهري للطالبة: ${result.score}`, result.id);
    writeDatabase(db);
    res.json(result);
  });

  // Grading config
  api.put('/grading-config/:trackId', (req, res) => {
    const db = readDatabase();
    const idx = db.gradingConfigs.findIndex((g: any) => g.trackId === req.params.trackId);
    if (idx >= 0) {
      db.gradingConfigs[idx] = { ...db.gradingConfigs[idx], ...req.body };
    } else {
      db.gradingConfigs.push({
        id: `gc-${Date.now()}`,
        trackId: req.params.trackId,
        ...req.body
      });
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'gradingConfig', `تعديل نظام الدرجات والنسب المئوية للمسار`, req.params.trackId);
    writeDatabase(db);
    res.json(db.gradingConfigs[idx >= 0 ? idx : db.gradingConfigs.length - 1]);
  });

  // Settings
  api.put('/settings', (req, res) => {
    const db = readDatabase();
    db.settings = { ...db.settings, ...req.body };
    if (req.body.leaderPasscode) {
      const cleanPass = String(req.body.leaderPasscode).trim();
      db.settings.leaderPasscode = cleanPass;
      // Keep leader user in sync
      const leaderUser = db.users.find((u: any) => u.role === 'leader');
      if (leaderUser) {
        leaderUser.passcode = cleanPass;
      }
      if (db.currentUser && (db.currentUser?.role || 'leader') === 'leader') {
        db.currentUser.passcode = cleanPass;
      }
    }
    // Sync PWA icons with uploaded logo
    if (req.body.logoUrl && typeof req.body.logoUrl === 'string' && req.body.logoUrl.startsWith('data:image/')) {
      try {
        const base64Data = req.body.logoUrl.replace(/^data:image\/\w+;base64,/, '');
        const imgBuffer = Buffer.from(base64Data, 'base64');
        import('sharp').then(({ default: sharp }) => {
          sharp(imgBuffer).resize(192, 192).png().toFile('public/pwa-192x192.png').catch(() => {});
          sharp(imgBuffer).resize(512, 512).png().toFile('public/pwa-512x512.png').catch(() => {});
          sharp(imgBuffer).resize(180, 180).png().toFile('public/apple-touch-icon.png').catch(() => {});
          sharp(imgBuffer).resize(388, 388).toBuffer().then(inner => {
            sharp({
              create: { width: 512, height: 512, channels: 4, background: { r: 250, g: 245, b: 242, alpha: 1 } }
            }).composite([{ input: inner, gravity: 'center' }]).png().toFile('public/pwa-maskable-512x512.png').catch(() => {});
          }).catch(() => {});
        }).catch(() => {});
      } catch (err) {
        console.error('PWA icon sync error', err);
      }
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'settings', `تحديث الإعدادات العامة للمقرأة والهوية والشعار`);
    writeDatabase(db);
    const { leaderPasscode: _leaderPasscode, ...safeSettings } = db.settings;
    res.setHeader('Cache-Control', 'no-store');
    res.json(safeSettings);
  });

  // Manage users / permissions
  api.post('/users', (req, res) => {
    const db = readDatabase();
    const newUser = {
      id: `u-${Date.now()}`,
      circleIds: [],
      passcode: req.body.passcode ? String(req.body.passcode).trim() : '',
      ...req.body
    };
    db.users.push(newUser);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'user', `إضافة مستخدم جديد: ${newUser.name} (${newUser.title})`, newUser.id);
    writeDatabase(db);
    const { passcode: _passcode, ...safeNewUser } = newUser;
    res.status(201).json(safeNewUser);
  });

  api.put('/users/:id', (req, res) => {
    const db = readDatabase();
    const idx = db.users.findIndex((u: any) => u.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'المستخدم غير موجود' });
    const cleanBody = { ...req.body };
    if (cleanBody.passcode) {
      cleanBody.passcode = String(cleanBody.passcode).trim();
    }
    db.users[idx] = { ...db.users[idx], ...cleanBody };
    // If leader user passcode is changed, sync with settings.leaderPasscode
    if (db.users[idx].role === 'leader' && cleanBody.passcode) {
      db.settings.leaderPasscode = cleanBody.passcode;
    }
    if (db.currentUser.id === req.params.id) {
      db.currentUser = { ...db.currentUser, ...cleanBody };
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'user', `تعديل بيانات وصلاحيات المستخدم: ${db.users[idx].name}`, req.params.id);
    writeDatabase(db);
    const { passcode: _passcode, ...safeUpdatedUser } = db.users[idx];
    res.json(safeUpdatedUser);
  });

  // Backup & Restore
  api.get('/backup/download', (_req, res) => {
    const db = readDatabase();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=GhaithAlGhaym_backup_${Date.now()}.json`);
    res.send(JSON.stringify(db, null, 2));
  });

  api.post('/backup/restore', (req, res) => {
    const { backupData } = req.body;
    if (!backupData || !backupData.tracks || !backupData.students) {
      return res.status(400).json({ error: 'صيغة النسخة الاحتياطية غير صالحة' });
    }
    writeDatabase(backupData);
    addAudit(backupData, backupData.currentUser?.name || 'المدير', 'leader', 'restore', 'backup', 'استعادة قاعدة البيانات بالكامل من نسخة احتياطية');
    res.json({ success: true, message: 'تمت استعادة البيانات بنجاح' });
  });

  api.post('/backup/reset-sample', (_req, res) => {
    const freshDb = getInitialDatabase();
    addAudit(freshDb, freshDb.currentUser.name, 'leader', 'backup', 'reset', 'إعادة ضبط قاعدة البيانات إلى البيانات النموذجية الأصلية');
    writeDatabase(freshDb);
    res.json({ success: true, database: freshDb });
  });

  app.use('/api', api);

  const httpServer = http.createServer(app);

  const distPath = path.join(__dirname, 'dist');
  const hasDist = fs.existsSync(path.join(distPath, 'index.html'));

  if (process.env.NODE_ENV === 'production' || (hasDist && process.env.NODE_ENV !== 'development')) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          hmr: false
        },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (err) {
      if (hasDist) {
        app.use(express.static(distPath));
        app.get('*', (_req, res) => {
          res.sendFile(path.join(distPath, 'index.html'));
        });
      } else {
        console.error('Vite dev middleware failed and no dist found:', err);
      }
    }
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🌸 Ghaith Al-Ghaym Platform running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
)) {
      const [, salt, digestHex] = stored.split('
  function createSession(user: any) {
    const payload = Buffer.from(JSON.stringify({
      userId: user.id,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
    })).toString('base64url');
    const signature = createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
    return payload + '.' + signature;
  }

  function getSession(req: express.Request): { userId: string; role: string; exp: number } | null {
    try {
      const cookieHeader = req.headers.cookie || '';
      const token = cookieHeader.split(';').map(v => v.trim()).find(v => v.startsWith(SESSION_COOKIE + '='))?.slice(SESSION_COOKIE.length + 1);
      if (!token) return null;
      const parts = token.split('.');
      if (parts.length !== 2) return null;
      const expected = createHmac('sha256', sessionSecret()).update(parts[0]).digest();
      const supplied = Buffer.from(parts[1], 'base64url');
      if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
      const session = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      if (!session.userId || !session.role || !Number.isFinite(session.exp) || session.exp <= Math.floor(Date.now() / 1000)) return null;
      return session;
    } catch {
      return null;
    }
  }

  function setSessionCookie(res: express.Response, token: string) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure}`);
  }

  function clearSessionCookie(res: express.Response) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`);
  }



  // Health check
  api.get('/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Public login directory: expose only the minimum fields needed by the sign-in selector.
  // Never send student records, staff contact details, or credentials before authentication.
  api.get('/auth/users', (_req, res) => {
    const db = readDatabase();
    res.setHeader('Cache-Control', 'no-store');
    res.json(db.users.map((user: any) => ({
      id: user.id,
      name: user.name,
      role: user.role,
      title: user.title,
      avatarIcon: user.avatarIcon,
      avatarColor: user.avatarColor
    })));
  });

  // Login is the only public data-adjacent endpoint. Configure SESSION_SECRET and
  // GHAYM_INITIAL_LEADER_PASSCODE before deploying; no built-in PIN is accepted.
  api.post('/auth/login', (req, res) => {
    let secret: string;
    try { secret = sessionSecret(); } catch { return res.status(503).json({ error: 'لم يتم إعداد أمان الجلسات على الخادم' }); }
    const userId = typeof req.body?.userId === 'string' ? req.body.userId : '';
    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode.trim() : '';
    if (!userId || !passcode || passcode.length > 128) return res.status(400).json({ error: 'اسم المستخدم والرمز السري مطلوبان' });
    const db = readDatabase();
    const user = db.users.find((u: any) => u.id === userId);
    if (!user) return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    const configuredPasscode = typeof user.passcode === 'string' ? user.passcode : '';
    const bootstrapPasscode = user.role === 'leader' ? (process.env.GHAYM_INITIAL_LEADER_PASSCODE || '') : '';
    const valid = (configuredPasscode.length > 0 && passcode === configuredPasscode) || (bootstrapPasscode.length > 0 && passcode === bootstrapPasscode);
    if (!valid) return res.status(401).json({ error: 'بيانات الدخول غير صحيحة أو لم يتم إعداد رمز لهذا الحساب' });
    setSessionCookie(res, createSession(user));
    res.setHeader('Cache-Control', 'no-store');
    const { passcode: _passcode, ...safeUser } = user;
    return res.json({ success: true, user: safeUser });
  });

  api.post('/auth/logout', (_req, res) => {
    clearSessionCookie(res);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true });
  });

  // Every other API route requires a signed, expiring server-side identity.
  api.use((req, res, next) => {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'يلزم تسجيل الدخول للوصول إلى هذه البيانات' });
    const db = readDatabase();
    const user = db.users.find((u: any) => u.id === session.userId);
    if (!user || user.role !== session.role) return res.status(401).json({ error: 'الجلسة غير صالحة؛ يرجى تسجيل الدخول مجددًا' });
    (req as any).authUser = { id: user.id, role: user.role, name: user.name };
    const route = req.path;
    const leaderOnly = route === '/users' || route.startsWith('/users/') || route === '/settings' || route.startsWith('/backup/') || route.startsWith('/grading-config/') || route === '/auth/switch-user';
    if (leaderOnly && user.role !== 'leader') return res.status(403).json({ error: 'لا تملك الصلاحية لتنفيذ هذه العملية' });
    next();
  });

  // Get sanitized state; never return PINs or the leader bootstrap credential.
  api.get('/state', (req, res) => {
    const db = readDatabase();
    const authUser = (req as any).authUser;
    const currentUser = db.users.find((u: any) => u.id === authUser.id) || null;
    const safeUser = (u: any) => { const { passcode: _passcode, ...safe } = u; return safe; };
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ...db, currentUser: currentUser ? safeUser(currentUser) : null, users: db.users.map(safeUser), settings: { ...db.settings, leaderPasscode: undefined } });
  });

  // Switch current active user
  api.post('/auth/switch-user', (req, res) => {
    const { userId } = req.body;
    const db = readDatabase();
    const user = db.users.find((u: any) => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }
    db.currentUser = user;
    addAudit(db, user.name, user.role, 'login', 'auth', `تسجيل الدخول / تبديل المستخدم إلى: ${user.name} (${user.title})`);
    writeDatabase(db);
    const { passcode: _passcode, ...safeUser } = user;
    res.json({ user: safeUser, success: true });
  });

  // Change user passcode
  api.post('/auth/change-passcode', (req, res) => {
    const { userId, newPasscode } = req.body;
    const authUser = (req as any).authUser;
    if (userId !== authUser.id && authUser.role !== 'leader') return res.status(403).json({ error: 'لا تملك الصلاحية لتغيير رمز هذا الحساب' });
    if (!newPasscode || !String(newPasscode).trim()) {
      return res.status(400).json({ error: 'الرمز السري الجديد مطلوب' });
    }
    const cleanNew = String(newPasscode).trim();
    const db = readDatabase();
    const user = db.users.find((u: any) => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }
    user.passcode = cleanNew;
    if (user.role === 'leader') {
      db.settings.leaderPasscode = cleanNew;
    }
    if (db.currentUser && db.currentUser.id === userId) {
      db.currentUser.passcode = cleanNew;
    }
    addAudit(db, user.name, user.role, 'update', 'user', `تحديث الرمز السري بنجاح للمستخدم: ${user.name}`, user.id);
    writeDatabase(db);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, message: 'تم تغيير الرمز السري بنجاح' });
  });

  // Tracks endpoints
  api.post('/tracks', (req, res) => {
    const db = readDatabase();
    const newTrack = {
      id: `t-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isArchived: false,
      ...req.body
    };
    db.tracks.push(newTrack);
    // Also create default grading config for this track if not exists
    const existingGc = db.gradingConfigs.find((g: any) => g.trackId === newTrack.id);
    if (!existingGc) {
      const templateGc = db.gradingConfigs[0];
      db.gradingConfigs.push({
        ...templateGc,
        id: `gc-${Date.now()}`,
        trackId: newTrack.id
      });
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'track', `إضافة مسار جديد: ${newTrack.name}`, newTrack.id);
    writeDatabase(db);
    res.status(201).json(newTrack);
  });

  api.put('/tracks/:id', (req, res) => {
    const db = readDatabase();
    const index = db.tracks.findIndex((t: any) => t.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'المسار غير موجود' });
    db.tracks[index] = { ...db.tracks[index], ...req.body, updatedAt: new Date().toISOString() };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'track', `تعديل المسار: ${db.tracks[index].name}`, req.params.id);
    writeDatabase(db);
    res.json(db.tracks[index]);
  });

  api.delete('/tracks/:id', (req, res) => {
    const db = readDatabase();
    const track = db.tracks.find((t: any) => t.id === req.params.id);
    if (!track) return res.status(404).json({ error: 'المسار غير موجود' });
    // Soft delete / archive
    track.isArchived = true;
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'archive', 'track', `أرشفة المسار: ${track.name}`, req.params.id);
    writeDatabase(db);
    res.json({ success: true, track });
  });

  // Circles endpoints
  api.post('/circles', (req, res) => {
    const db = readDatabase();
    const newCircle = {
      id: `c-${Date.now()}`,
      createdAt: new Date().toISOString(),
      isArchived: false,
      ...req.body
    };
    db.circles.push(newCircle);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'circle', `إضافة حلقة جديدة: ${newCircle.name}`, newCircle.id);
    writeDatabase(db);
    res.status(201).json(newCircle);
  });

  api.put('/circles/:id', (req, res) => {
    const db = readDatabase();
    const index = db.circles.findIndex((c: any) => c.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'الحلقة غير موجودة' });
    db.circles[index] = { ...db.circles[index], ...req.body };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'circle', `تعديل الحلقة: ${db.circles[index].name}`, req.params.id);
    writeDatabase(db);
    res.json(db.circles[index]);
  });

  api.delete('/circles/:id', (req, res) => {
    const db = readDatabase();
    const circle = db.circles.find((c: any) => c.id === req.params.id);
    if (!circle) return res.status(404).json({ error: 'الحلقة غير موجودة' });
    circle.isArchived = true;
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'archive', 'circle', `أرشفة الحلقة: ${circle.name}`, req.params.id);
    writeDatabase(db);
    res.json({ success: true, circle });
  });

  // Students endpoints
  api.post('/students', (req, res) => {
    const db = readDatabase();
    const newStudent = {
      id: `s-${Date.now()}`,
      code: req.body.code || `GH-${Math.floor(100 + Math.random() * 900)}`,
      createdAt: new Date().toISOString(),
      status: 'active',
      ...req.body
    };
    db.students.push(newStudent);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'student', `إضافة طالبة: ${newStudent.name} (كود: ${newStudent.code})`, newStudent.id);
    writeDatabase(db);
    res.status(201).json(newStudent);
  });

  api.put('/students/:id', (req, res) => {
    const db = readDatabase();
    const index = db.students.findIndex((s: any) => s.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'الطالبة غير موجودة' });
    db.students[index] = { ...db.students[index], ...req.body };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'student', `تعديل بيانات الطالبة: ${db.students[index].name}`, req.params.id);
    writeDatabase(db);
    res.json(db.students[index]);
  });

  api.delete('/students/:id', (req, res) => {
    const db = readDatabase();
    const student = db.students.find((s: any) => s.id === req.params.id);
    if (!student) return res.status(404).json({ error: 'الطالبة غير موجودة' });
    student.status = 'archived';
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'archive', 'student', `أرشفة الطالبة: ${student.name}`, req.params.id);
    writeDatabase(db);
    res.json({ success: true, student });
  });

  // Pair or unpair two students directly for Revision Matrix & Challenges
  api.post('/students/pair', (req, res) => {
    const { studentId1, studentId2 } = req.body;
    const db = readDatabase();
    const s1 = db.students.find((s: any) => s.id === studentId1);
    if (!s1) return res.status(404).json({ error: 'الطالبة الأولى غير موجودة' });

    if (!studentId2) {
      // Unpair s1 and whatever previous partner she had
      const oldPartnerId = s1.partnerStudentId;
      s1.partnerStudentId = undefined;
      s1.partnerStudentName = undefined;
      if (oldPartnerId) {
        const oldPartner = db.students.find((s: any) => s.id === oldPartnerId);
        if (oldPartner && oldPartner.partnerStudentId === studentId1) {
          oldPartner.partnerStudentId = undefined;
          oldPartner.partnerStudentName = undefined;
        }
      }
      addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'student', `إلغاء ثنائي الطالبة: ${s1.name}`, studentId1);
      writeDatabase(db);
      return res.json({ success: true, unpair: true, student: s1 });
    }

    const s2 = db.students.find((s: any) => s.id === studentId2);
    if (!s2) return res.status(404).json({ error: 'الطالبة المحددة كرفيقة غير موجودة' });

    // If s1 or s2 already had other partners, clear them first
    if (s1.partnerStudentId && s1.partnerStudentId !== s2.id) {
      const prev1 = db.students.find((s: any) => s.id === s1.partnerStudentId);
      if (prev1 && prev1.partnerStudentId === s1.id) {
        prev1.partnerStudentId = undefined;
        prev1.partnerStudentName = undefined;
      }
    }
    if (s2.partnerStudentId && s2.partnerStudentId !== s1.id) {
      const prev2 = db.students.find((s: any) => s.id === s2.partnerStudentId);
      if (prev2 && prev2.partnerStudentId === s2.id) {
        prev2.partnerStudentId = undefined;
        prev2.partnerStudentName = undefined;
      }
    }

    // Set reciprocal pairing
    s1.partnerStudentId = s2.id;
    s1.partnerStudentName = s2.name;
    s2.partnerStudentId = s1.id;
    s2.partnerStudentName = s1.name;

    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'student', `تحديد وتحديث الثنائي القرآني: ${s1.name} و ${s2.name}`, studentId1);
    writeDatabase(db);
    res.json({ success: true, s1, s2 });
  });

  // Monthly Plans endpoints
  api.post('/monthly-plans', (req, res) => {
    const db = readDatabase();
    const newPlan = {
      id: `mp-${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: 'active',
      ...req.body
    };
    db.monthlyPlans.push(newPlan);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'monthlyPlan', `إنشاء خطة شهرية: ${newPlan.title}`, newPlan.id);
    writeDatabase(db);
    res.status(201).json(newPlan);
  });

  api.put('/monthly-plans/:id', (req, res) => {
    const db = readDatabase();
    const index = db.monthlyPlans.findIndex((p: any) => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'الخطة غير موجودة' });
    db.monthlyPlans[index] = { ...db.monthlyPlans[index], ...req.body };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'monthlyPlan', `تعديل الخطة: ${db.monthlyPlans[index].title}`, req.params.id);
    writeDatabase(db);
    res.json(db.monthlyPlans[index]);
  });

  api.post('/monthly-plans/:id/duplicate', (req, res) => {
    const db = readDatabase();
    const sourcePlan = db.monthlyPlans.find((p: any) => p.id === req.params.id);
    if (!sourcePlan) return res.status(404).json({ error: 'الخطة الأصلية غير موجودة' });
    const newPlan = {
      ...sourcePlan,
      id: `mp-${Date.now()}`,
      title: `${sourcePlan.title} (نسخة جديدة)`,
      createdAt: new Date().toISOString(),
      status: 'active'
    };
    db.monthlyPlans.push(newPlan);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'monthlyPlan', `نسخ خطة شهرية سابقة إلى: ${newPlan.title}`, newPlan.id);
    writeDatabase(db);
    res.status(201).json(newPlan);
  });

  // Student Plans
  api.post('/student-plans', (req, res) => {
    const db = readDatabase();
    const newPlan = {
      id: `sp-${Date.now()}`,
      status: 'active',
      ...req.body
    };
    db.studentPlans.push(newPlan);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'studentPlan', `تخصيص خطة شهرية لطالبة`, newPlan.id);
    writeDatabase(db);
    res.status(201).json(newPlan);
  });

  api.put('/student-plans/:id', (req, res) => {
    const db = readDatabase();
    const index = db.studentPlans.findIndex((p: any) => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'خطة الطالبة غير موجودة' });
    db.studentPlans[index] = { ...db.studentPlans[index], ...req.body };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'studentPlan', `تحديث خطة الطالبة`, req.params.id);
    writeDatabase(db);
    res.json(db.studentPlans[index]);
  });

  // Daily records (Memorization, Revision, Conditions, Recitation grade)
  api.post('/daily-records', (req, res) => {
    const db = readDatabase();
    const newRecord = {
      id: `dr-${Date.now()}`,
      recordedBy: (db.currentUser?.name || 'ريفة المنصوري'),
      recordedAt: new Date().toISOString(),
      ...req.body
    };
    db.dailyRecords.push(newRecord);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'grade', 'dailyRecord', `تسجيل إنجاز يومي لطالبة بتاريخ ${newRecord.date}`, newRecord.id);
    writeDatabase(db);
    res.status(201).json(newRecord);
  });

  api.put('/daily-records/:id', (req, res) => {
    const db = readDatabase();
    const index = db.dailyRecords.findIndex((r: any) => r.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'السجل اليومي غير موجود' });
    db.dailyRecords[index] = {
      ...db.dailyRecords[index],
      ...req.body,
      recordedBy: (db.currentUser?.name || 'ريفة المنصوري'),
      recordedAt: new Date().toISOString()
    };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'dailyRecord', `تعديل السجل اليومي`, req.params.id);
    writeDatabase(db);
    res.json(db.dailyRecords[index]);
  });

  // Attendance & Early prep
  api.post('/attendance', (req, res) => {
    const db = readDatabase();
    // Check if record exists for this student & date
    const existingIndex = db.attendanceRecords.findIndex(
      (a: any) => a.studentId === req.body.studentId && a.date === req.body.date
    );
    let record;
    if (existingIndex >= 0) {
      db.attendanceRecords[existingIndex] = {
        ...db.attendanceRecords[existingIndex],
        ...req.body,
        recordedBy: (db.currentUser?.name || 'ريفة المنصوري'),
        recordedAt: new Date().toISOString()
      };
      record = db.attendanceRecords[existingIndex];
    } else {
      record = {
        id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        recordedBy: (db.currentUser?.name || 'ريفة المنصوري'),
        recordedAt: new Date().toISOString(),
        ...req.body
      };
      db.attendanceRecords.push(record);
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'attendance', `تسجيل حضور/تحضير لطالبة بتاريخ ${record.date}`, record.id);
    writeDatabase(db);
    res.json(record);
  });

  // Bulk attendance
  api.post('/attendance/bulk', (req, res) => {
    const { records } = req.body;
    if (!Array.isArray(records)) return res.status(400).json({ error: 'بيانات غير صالحة' });
    const db = readDatabase();
    records.forEach((rec: any) => {
      const idx = db.attendanceRecords.findIndex((a: any) => a.studentId === rec.studentId && a.date === rec.date);
      if (idx >= 0) {
        db.attendanceRecords[idx] = {
          ...db.attendanceRecords[idx],
          ...rec,
          recordedBy: (db.currentUser?.name || 'ريفة المنصوري'),
          recordedAt: new Date().toISOString()
        };
      } else {
        db.attendanceRecords.push({
          id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          recordedBy: (db.currentUser?.name || 'ريفة المنصوري'),
          recordedAt: new Date().toISOString(),
          ...rec
        });
      }
    });
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'attendance', `تسجيل حضور جماعي لـ ${records.length} طالبة`);
    writeDatabase(db);
    res.json({ success: true, count: records.length });
  });

  // Atqini assignments (strictly Tajweed)
  api.post('/atqini', (req, res) => {
    const db = readDatabase();
    const assignment = {
      id: `atq-${Date.now()}`,
      ...req.body
    };
    db.atqiniAssignments.push(assignment);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'atqini', `إضافة واجب تجويد جديد: ${assignment.title}`, assignment.id);
    writeDatabase(db);
    res.status(201).json(assignment);
  });

  api.put('/atqini/:id', (req, res) => {
    const db = readDatabase();
    const idx = db.atqiniAssignments.findIndex((a: any) => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'الواجب غير موجود' });
    db.atqiniAssignments[idx] = { ...db.atqiniAssignments[idx], ...req.body };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'atqini', `تعديل واجب التجويد: ${db.atqiniAssignments[idx].title}`, req.params.id);
    writeDatabase(db);
    res.json(db.atqiniAssignments[idx]);
  });

  api.delete('/atqini/:id', (req, res) => {
    const db = readDatabase();
    const idx = db.atqiniAssignments.findIndex((a: any) => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'الواجب غير موجود' });
    const deleted = db.atqiniAssignments.splice(idx, 1)[0];
    // Cascade remove submissions for this assignment
    db.studentAtqiniSubmissions = db.studentAtqiniSubmissions.filter((s: any) => s.assignmentId !== req.params.id);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'delete', 'atqini', `حذف واجب التجويد: ${deleted.title} وكافة تقييماته`, req.params.id);
    writeDatabase(db);
    res.json({ success: true, deletedId: req.params.id });
  });

  // Atqini submissions
  api.post('/atqini-submissions', (req, res) => {
    const db = readDatabase();
    const existing = db.studentAtqiniSubmissions.findIndex(
      (s: any) => s.assignmentId === req.body.assignmentId && s.studentId === req.body.studentId
    );
    let submission;
    if (existing >= 0) {
      db.studentAtqiniSubmissions[existing] = {
        ...db.studentAtqiniSubmissions[existing],
        ...req.body,
        evaluatedBy: (db.currentUser?.name || 'ريفة المنصوري')
      };
      submission = db.studentAtqiniSubmissions[existing];
    } else {
      submission = {
        id: `atqs-${Date.now()}`,
        evaluatedBy: (db.currentUser?.name || 'ريفة المنصوري'),
        ...req.body
      };
      db.studentAtqiniSubmissions.push(submission);
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'grade', 'atqiniSubmission', `تصحيح واجب تجويد لطالبة بدرجة ${submission.score}`, submission.id);
    writeDatabase(db);
    res.json(submission);
  });

  // Challenges (Thursday Challenge & Grand Revision)
  api.post('/challenges', (req, res) => {
    const db = readDatabase();
    const challenge = {
      id: `ch-${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: 'active',
      ...req.body
    };
    db.challenges.push(challenge);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'challenge', `إضافة تحدٍ قرآني جديد: ${challenge.title}`, challenge.id);
    writeDatabase(db);
    res.status(201).json(challenge);
  });

  api.put('/challenges/:id', (req, res) => {
    const db = readDatabase();
    const idx = db.challenges.findIndex((c: any) => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'التحدي غير موجود' });
    db.challenges[idx] = { ...db.challenges[idx], ...req.body };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'challenge', `تعديل التحدي القرآني: ${db.challenges[idx].title}`, req.params.id);
    writeDatabase(db);
    res.json(db.challenges[idx]);
  });

  api.delete('/challenges/:id', (req, res) => {
    const db = readDatabase();
    const idx = db.challenges.findIndex((c: any) => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'التحدي غير موجود' });
    const deleted = db.challenges.splice(idx, 1)[0];
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'delete', 'challenge', `حذف التحدي: ${deleted.title}`, req.params.id);
    writeDatabase(db);
    res.json({ success: true });
  });

  // Challenge Submissions (including peer review & partner collaboration)
  api.post('/challenge-submissions', (req, res) => {
    const db = readDatabase();
    const existing = db.studentChallengeSubmissions.findIndex(
      (s: any) => s.challengeId === req.body.challengeId && s.studentId === req.body.studentId
    );
    let submission;
    if (existing >= 0) {
      db.studentChallengeSubmissions[existing] = {
        ...db.studentChallengeSubmissions[existing],
        ...req.body,
        evaluatedBy: (db.currentUser?.name || 'ريفة المنصوري'),
        evaluatedAt: new Date().toISOString()
      };
      submission = db.studentChallengeSubmissions[existing];
    } else {
      submission = {
        id: `cs-${Date.now()}`,
        evaluatedBy: (db.currentUser?.name || 'ريفة المنصوري'),
        evaluatedAt: new Date().toISOString(),
        ...req.body
      };
      db.studentChallengeSubmissions.push(submission);
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'grade', 'challengeSubmission', `تقييم تحدي قرآني ومراجعة ثنائية للطالبة`, submission.id);
    writeDatabase(db);
    res.json(submission);
  });

  // Exams & Exam results
  api.post('/exams', (req, res) => {
    const db = readDatabase();
    const exam = {
      id: `ex-${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...req.body
    };
    db.monthlyExams.push(exam);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'exam', `إضافة اختبار شهري: ${exam.title}`, exam.id);
    writeDatabase(db);
    res.status(201).json(exam);
  });

  api.put('/exams/:id', (req, res) => {
    const db = readDatabase();
    const idx = db.monthlyExams.findIndex((e: any) => e.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'الاختبار غير موجود' });
    db.monthlyExams[idx] = { ...db.monthlyExams[idx], ...req.body };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'exam', `تعديل الاختبار: ${db.monthlyExams[idx].title}`, req.params.id);
    writeDatabase(db);
    res.json(db.monthlyExams[idx]);
  });

  api.delete('/exams/:id', (req, res) => {
    const db = readDatabase();
    const idx = db.monthlyExams.findIndex((e: any) => e.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'الاختبار غير موجود' });
    const deleted = db.monthlyExams.splice(idx, 1)[0];
    db.studentExamResults = db.studentExamResults.filter((r: any) => r.examId !== req.params.id);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'delete', 'exam', `حذف الاختبار الشهري: ${deleted.title}`, req.params.id);
    writeDatabase(db);
    res.json({ success: true });
  });

  api.post('/exam-results', (req, res) => {
    const db = readDatabase();
    const existing = db.studentExamResults.findIndex(
      (r: any) => r.examId === req.body.examId && r.studentId === req.body.studentId
    );
    let result;
    if (existing >= 0) {
      db.studentExamResults[existing] = {
        ...db.studentExamResults[existing],
        ...req.body,
        examinerName: (db.currentUser?.name || 'ريفة المنصوري'),
        evaluatedAt: new Date().toISOString()
      };
      result = db.studentExamResults[existing];
    } else {
      result = {
        id: `er-${Date.now()}`,
        examinerName: (db.currentUser?.name || 'ريفة المنصوري'),
        evaluatedAt: new Date().toISOString(),
        ...req.body
      };
      db.studentExamResults.push(result);
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'grade', 'examResult', `رصد درجة اختبار شهري للطالبة: ${result.score}`, result.id);
    writeDatabase(db);
    res.json(result);
  });

  // Grading config
  api.put('/grading-config/:trackId', (req, res) => {
    const db = readDatabase();
    const idx = db.gradingConfigs.findIndex((g: any) => g.trackId === req.params.trackId);
    if (idx >= 0) {
      db.gradingConfigs[idx] = { ...db.gradingConfigs[idx], ...req.body };
    } else {
      db.gradingConfigs.push({
        id: `gc-${Date.now()}`,
        trackId: req.params.trackId,
        ...req.body
      });
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'gradingConfig', `تعديل نظام الدرجات والنسب المئوية للمسار`, req.params.trackId);
    writeDatabase(db);
    res.json(db.gradingConfigs[idx >= 0 ? idx : db.gradingConfigs.length - 1]);
  });

  // Settings
  api.put('/settings', (req, res) => {
    const db = readDatabase();
    db.settings = { ...db.settings, ...req.body };
    if (req.body.leaderPasscode) {
      const cleanPass = String(req.body.leaderPasscode).trim();
      db.settings.leaderPasscode = cleanPass;
      // Keep leader user in sync
      const leaderUser = db.users.find((u: any) => u.role === 'leader');
      if (leaderUser) {
        leaderUser.passcode = cleanPass;
      }
      if (db.currentUser && (db.currentUser?.role || 'leader') === 'leader') {
        db.currentUser.passcode = cleanPass;
      }
    }
    // Sync PWA icons with uploaded logo
    if (req.body.logoUrl && typeof req.body.logoUrl === 'string' && req.body.logoUrl.startsWith('data:image/')) {
      try {
        const base64Data = req.body.logoUrl.replace(/^data:image\/\w+;base64,/, '');
        const imgBuffer = Buffer.from(base64Data, 'base64');
        import('sharp').then(({ default: sharp }) => {
          sharp(imgBuffer).resize(192, 192).png().toFile('public/pwa-192x192.png').catch(() => {});
          sharp(imgBuffer).resize(512, 512).png().toFile('public/pwa-512x512.png').catch(() => {});
          sharp(imgBuffer).resize(180, 180).png().toFile('public/apple-touch-icon.png').catch(() => {});
          sharp(imgBuffer).resize(388, 388).toBuffer().then(inner => {
            sharp({
              create: { width: 512, height: 512, channels: 4, background: { r: 250, g: 245, b: 242, alpha: 1 } }
            }).composite([{ input: inner, gravity: 'center' }]).png().toFile('public/pwa-maskable-512x512.png').catch(() => {});
          }).catch(() => {});
        }).catch(() => {});
      } catch (err) {
        console.error('PWA icon sync error', err);
      }
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'settings', `تحديث الإعدادات العامة للمقرأة والهوية والشعار`);
    writeDatabase(db);
    const { leaderPasscode: _leaderPasscode, ...safeSettings } = db.settings;
    res.setHeader('Cache-Control', 'no-store');
    res.json(safeSettings);
  });

  // Manage users / permissions
  api.post('/users', (req, res) => {
    const db = readDatabase();
    const newUser = {
      id: `u-${Date.now()}`,
      circleIds: [],
      passcode: req.body.passcode ? String(req.body.passcode).trim() : '',
      ...req.body
    };
    db.users.push(newUser);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'user', `إضافة مستخدم جديد: ${newUser.name} (${newUser.title})`, newUser.id);
    writeDatabase(db);
    const { passcode: _passcode, ...safeNewUser } = newUser;
    res.status(201).json(safeNewUser);
  });

  api.put('/users/:id', (req, res) => {
    const db = readDatabase();
    const idx = db.users.findIndex((u: any) => u.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'المستخدم غير موجود' });
    const cleanBody = { ...req.body };
    if (cleanBody.passcode) {
      cleanBody.passcode = String(cleanBody.passcode).trim();
    }
    db.users[idx] = { ...db.users[idx], ...cleanBody };
    // If leader user passcode is changed, sync with settings.leaderPasscode
    if (db.users[idx].role === 'leader' && cleanBody.passcode) {
      db.settings.leaderPasscode = cleanBody.passcode;
    }
    if (db.currentUser.id === req.params.id) {
      db.currentUser = { ...db.currentUser, ...cleanBody };
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'user', `تعديل بيانات وصلاحيات المستخدم: ${db.users[idx].name}`, req.params.id);
    writeDatabase(db);
    const { passcode: _passcode, ...safeUpdatedUser } = db.users[idx];
    res.json(safeUpdatedUser);
  });

  // Backup & Restore
  api.get('/backup/download', (_req, res) => {
    const db = readDatabase();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=GhaithAlGhaym_backup_${Date.now()}.json`);
    res.send(JSON.stringify(db, null, 2));
  });

  api.post('/backup/restore', (req, res) => {
    const { backupData } = req.body;
    if (!backupData || !backupData.tracks || !backupData.students) {
      return res.status(400).json({ error: 'صيغة النسخة الاحتياطية غير صالحة' });
    }
    writeDatabase(backupData);
    addAudit(backupData, backupData.currentUser?.name || 'المدير', 'leader', 'restore', 'backup', 'استعادة قاعدة البيانات بالكامل من نسخة احتياطية');
    res.json({ success: true, message: 'تمت استعادة البيانات بنجاح' });
  });

  api.post('/backup/reset-sample', (_req, res) => {
    const freshDb = getInitialDatabase();
    addAudit(freshDb, freshDb.currentUser.name, 'leader', 'backup', 'reset', 'إعادة ضبط قاعدة البيانات إلى البيانات النموذجية الأصلية');
    writeDatabase(freshDb);
    res.json({ success: true, database: freshDb });
  });

  app.use('/api', api);

  const httpServer = http.createServer(app);

  const distPath = path.join(__dirname, 'dist');
  const hasDist = fs.existsSync(path.join(distPath, 'index.html'));

  if (process.env.NODE_ENV === 'production' || (hasDist && process.env.NODE_ENV !== 'development')) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          hmr: false
        },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (err) {
      if (hasDist) {
        app.use(express.static(distPath));
        app.get('*', (_req, res) => {
          res.sendFile(path.join(distPath, 'index.html'));
        });
      } else {
        console.error('Vite dev middleware failed and no dist found:', err);
      }
    }
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🌸 Ghaith Al-Ghaym Platform running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
);
      if (!salt || !digestHex || !/^[a-f0-9]{128}$/i.test(digestHex)) return false;
      const expected = Buffer.from(digestHex, 'hex');
      const actual = scryptSync(passcode, salt, expected.length);
      return expected.length === actual.length && timingSafeEqual(expected, actual);
    }
    // Legacy plain-text PINs are accepted only for migration, then upgraded on login.
    const expected = Buffer.from(stored);
    const actual = Buffer.from(passcode);
    return expected.length > 0 && expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  function createSession(user: any) {
    const payload = Buffer.from(JSON.stringify({
      userId: user.id,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
    })).toString('base64url');
    const signature = createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
    return payload + '.' + signature;
  }

  function getSession(req: express.Request): { userId: string; role: string; exp: number } | null {
    try {
      const cookieHeader = req.headers.cookie || '';
      const token = cookieHeader.split(';').map(v => v.trim()).find(v => v.startsWith(SESSION_COOKIE + '='))?.slice(SESSION_COOKIE.length + 1);
      if (!token) return null;
      const parts = token.split('.');
      if (parts.length !== 2) return null;
      const expected = createHmac('sha256', sessionSecret()).update(parts[0]).digest();
      const supplied = Buffer.from(parts[1], 'base64url');
      if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
      const session = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      if (!session.userId || !session.role || !Number.isFinite(session.exp) || session.exp <= Math.floor(Date.now() / 1000)) return null;
      return session;
    } catch {
      return null;
    }
  }

  function setSessionCookie(res: express.Response, token: string) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure}`);
  }

  function clearSessionCookie(res: express.Response) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`);
  }



  // Health check
  api.get('/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Public login directory: expose only the minimum fields needed by the sign-in selector.
  // Never send student records, staff contact details, or credentials before authentication.
  api.get('/auth/users', (_req, res) => {
    const db = readDatabase();
    res.setHeader('Cache-Control', 'no-store');
    res.json(db.users.map((user: any) => ({
      id: user.id,
      name: user.name,
      role: user.role,
      title: user.title,
      avatarIcon: user.avatarIcon,
      avatarColor: user.avatarColor
    })));
  });

  // Login is the only public data-adjacent endpoint. Configure SESSION_SECRET and
  // GHAYM_INITIAL_LEADER_PASSCODE before deploying; no built-in PIN is accepted.
  api.post('/auth/login', (req, res) => {
    let secret: string;
    try { secret = sessionSecret(); } catch { return res.status(503).json({ error: 'لم يتم إعداد أمان الجلسات على الخادم' }); }
    const userId = typeof req.body?.userId === 'string' ? req.body.userId : '';
    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode.trim() : '';
    if (!userId || !passcode || passcode.length > 128) return res.status(400).json({ error: 'اسم المستخدم والرمز السري مطلوبان' });
    const db = readDatabase();
    const user = db.users.find((u: any) => u.id === userId);
    if (!user) return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    const configuredPasscode = typeof user.passcode === 'string' ? user.passcode : '';
    const bootstrapPasscode = user.role === 'leader' ? (process.env.GHAYM_INITIAL_LEADER_PASSCODE || '') : '';
    const valid = (configuredPasscode.length > 0 && passcode === configuredPasscode) || (bootstrapPasscode.length > 0 && passcode === bootstrapPasscode);
    if (!valid) return res.status(401).json({ error: 'بيانات الدخول غير صحيحة أو لم يتم إعداد رمز لهذا الحساب' });
    setSessionCookie(res, createSession(user));
    res.setHeader('Cache-Control', 'no-store');
    const { passcode: _passcode, ...safeUser } = user;
    return res.json({ success: true, user: safeUser });
  });

  api.post('/auth/logout', (_req, res) => {
    clearSessionCookie(res);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true });
  });

  // Every other API route requires a signed, expiring server-side identity.
  api.use((req, res, next) => {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'يلزم تسجيل الدخول للوصول إلى هذه البيانات' });
    const db = readDatabase();
    const user = db.users.find((u: any) => u.id === session.userId);
    if (!user || user.role !== session.role) return res.status(401).json({ error: 'الجلسة غير صالحة؛ يرجى تسجيل الدخول مجددًا' });
    (req as any).authUser = { id: user.id, role: user.role, name: user.name };
    const route = req.path;
    const leaderOnly = route === '/users' || route.startsWith('/users/') || route === '/settings' || route.startsWith('/backup/') || route.startsWith('/grading-config/') || route === '/auth/switch-user';
    if (leaderOnly && user.role !== 'leader') return res.status(403).json({ error: 'لا تملك الصلاحية لتنفيذ هذه العملية' });
    next();
  });

  // Get sanitized state; never return PINs or the leader bootstrap credential.
  api.get('/state', (req, res) => {
    const db = readDatabase();
    const authUser = (req as any).authUser;
    const currentUser = db.users.find((u: any) => u.id === authUser.id) || null;
    const safeUser = (u: any) => { const { passcode: _passcode, ...safe } = u; return safe; };
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ...db, currentUser: currentUser ? safeUser(currentUser) : null, users: db.users.map(safeUser), settings: { ...db.settings, leaderPasscode: undefined } });
  });

  // Switch current active user
  api.post('/auth/switch-user', (req, res) => {
    const { userId } = req.body;
    const db = readDatabase();
    const user = db.users.find((u: any) => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }
    db.currentUser = user;
    addAudit(db, user.name, user.role, 'login', 'auth', `تسجيل الدخول / تبديل المستخدم إلى: ${user.name} (${user.title})`);
    writeDatabase(db);
    const { passcode: _passcode, ...safeUser } = user;
    res.json({ user: safeUser, success: true });
  });

  // Change user passcode
  api.post('/auth/change-passcode', (req, res) => {
    const { userId, newPasscode } = req.body;
    const authUser = (req as any).authUser;
    if (userId !== authUser.id && authUser.role !== 'leader') return res.status(403).json({ error: 'لا تملك الصلاحية لتغيير رمز هذا الحساب' });
    if (!newPasscode || !String(newPasscode).trim()) {
      return res.status(400).json({ error: 'الرمز السري الجديد مطلوب' });
    }
    const cleanNew = String(newPasscode).trim();
    const db = readDatabase();
    const user = db.users.find((u: any) => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }
    user.passcode = cleanNew;
    if (user.role === 'leader') {
      db.settings.leaderPasscode = cleanNew;
    }
    if (db.currentUser && db.currentUser.id === userId) {
      db.currentUser.passcode = cleanNew;
    }
    addAudit(db, user.name, user.role, 'update', 'user', `تحديث الرمز السري بنجاح للمستخدم: ${user.name}`, user.id);
    writeDatabase(db);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, message: 'تم تغيير الرمز السري بنجاح' });
  });

  // Tracks endpoints
  api.post('/tracks', (req, res) => {
    const db = readDatabase();
    const newTrack = {
      id: `t-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isArchived: false,
      ...req.body
    };
    db.tracks.push(newTrack);
    // Also create default grading config for this track if not exists
    const existingGc = db.gradingConfigs.find((g: any) => g.trackId === newTrack.id);
    if (!existingGc) {
      const templateGc = db.gradingConfigs[0];
      db.gradingConfigs.push({
        ...templateGc,
        id: `gc-${Date.now()}`,
        trackId: newTrack.id
      });
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'track', `إضافة مسار جديد: ${newTrack.name}`, newTrack.id);
    writeDatabase(db);
    res.status(201).json(newTrack);
  });

  api.put('/tracks/:id', (req, res) => {
    const db = readDatabase();
    const index = db.tracks.findIndex((t: any) => t.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'المسار غير موجود' });
    db.tracks[index] = { ...db.tracks[index], ...req.body, updatedAt: new Date().toISOString() };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'track', `تعديل المسار: ${db.tracks[index].name}`, req.params.id);
    writeDatabase(db);
    res.json(db.tracks[index]);
  });

  api.delete('/tracks/:id', (req, res) => {
    const db = readDatabase();
    const track = db.tracks.find((t: any) => t.id === req.params.id);
    if (!track) return res.status(404).json({ error: 'المسار غير موجود' });
    // Soft delete / archive
    track.isArchived = true;
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'archive', 'track', `أرشفة المسار: ${track.name}`, req.params.id);
    writeDatabase(db);
    res.json({ success: true, track });
  });

  // Circles endpoints
  api.post('/circles', (req, res) => {
    const db = readDatabase();
    const newCircle = {
      id: `c-${Date.now()}`,
      createdAt: new Date().toISOString(),
      isArchived: false,
      ...req.body
    };
    db.circles.push(newCircle);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'circle', `إضافة حلقة جديدة: ${newCircle.name}`, newCircle.id);
    writeDatabase(db);
    res.status(201).json(newCircle);
  });

  api.put('/circles/:id', (req, res) => {
    const db = readDatabase();
    const index = db.circles.findIndex((c: any) => c.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'الحلقة غير موجودة' });
    db.circles[index] = { ...db.circles[index], ...req.body };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'circle', `تعديل الحلقة: ${db.circles[index].name}`, req.params.id);
    writeDatabase(db);
    res.json(db.circles[index]);
  });

  api.delete('/circles/:id', (req, res) => {
    const db = readDatabase();
    const circle = db.circles.find((c: any) => c.id === req.params.id);
    if (!circle) return res.status(404).json({ error: 'الحلقة غير موجودة' });
    circle.isArchived = true;
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'archive', 'circle', `أرشفة الحلقة: ${circle.name}`, req.params.id);
    writeDatabase(db);
    res.json({ success: true, circle });
  });

  // Students endpoints
  api.post('/students', (req, res) => {
    const db = readDatabase();
    const newStudent = {
      id: `s-${Date.now()}`,
      code: req.body.code || `GH-${Math.floor(100 + Math.random() * 900)}`,
      createdAt: new Date().toISOString(),
      status: 'active',
      ...req.body
    };
    db.students.push(newStudent);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'student', `إضافة طالبة: ${newStudent.name} (كود: ${newStudent.code})`, newStudent.id);
    writeDatabase(db);
    res.status(201).json(newStudent);
  });

  api.put('/students/:id', (req, res) => {
    const db = readDatabase();
    const index = db.students.findIndex((s: any) => s.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'الطالبة غير موجودة' });
    db.students[index] = { ...db.students[index], ...req.body };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'student', `تعديل بيانات الطالبة: ${db.students[index].name}`, req.params.id);
    writeDatabase(db);
    res.json(db.students[index]);
  });

  api.delete('/students/:id', (req, res) => {
    const db = readDatabase();
    const student = db.students.find((s: any) => s.id === req.params.id);
    if (!student) return res.status(404).json({ error: 'الطالبة غير موجودة' });
    student.status = 'archived';
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'archive', 'student', `أرشفة الطالبة: ${student.name}`, req.params.id);
    writeDatabase(db);
    res.json({ success: true, student });
  });

  // Pair or unpair two students directly for Revision Matrix & Challenges
  api.post('/students/pair', (req, res) => {
    const { studentId1, studentId2 } = req.body;
    const db = readDatabase();
    const s1 = db.students.find((s: any) => s.id === studentId1);
    if (!s1) return res.status(404).json({ error: 'الطالبة الأولى غير موجودة' });

    if (!studentId2) {
      // Unpair s1 and whatever previous partner she had
      const oldPartnerId = s1.partnerStudentId;
      s1.partnerStudentId = undefined;
      s1.partnerStudentName = undefined;
      if (oldPartnerId) {
        const oldPartner = db.students.find((s: any) => s.id === oldPartnerId);
        if (oldPartner && oldPartner.partnerStudentId === studentId1) {
          oldPartner.partnerStudentId = undefined;
          oldPartner.partnerStudentName = undefined;
        }
      }
      addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'student', `إلغاء ثنائي الطالبة: ${s1.name}`, studentId1);
      writeDatabase(db);
      return res.json({ success: true, unpair: true, student: s1 });
    }

    const s2 = db.students.find((s: any) => s.id === studentId2);
    if (!s2) return res.status(404).json({ error: 'الطالبة المحددة كرفيقة غير موجودة' });

    // If s1 or s2 already had other partners, clear them first
    if (s1.partnerStudentId && s1.partnerStudentId !== s2.id) {
      const prev1 = db.students.find((s: any) => s.id === s1.partnerStudentId);
      if (prev1 && prev1.partnerStudentId === s1.id) {
        prev1.partnerStudentId = undefined;
        prev1.partnerStudentName = undefined;
      }
    }
    if (s2.partnerStudentId && s2.partnerStudentId !== s1.id) {
      const prev2 = db.students.find((s: any) => s.id === s2.partnerStudentId);
      if (prev2 && prev2.partnerStudentId === s2.id) {
        prev2.partnerStudentId = undefined;
        prev2.partnerStudentName = undefined;
      }
    }

    // Set reciprocal pairing
    s1.partnerStudentId = s2.id;
    s1.partnerStudentName = s2.name;
    s2.partnerStudentId = s1.id;
    s2.partnerStudentName = s1.name;

    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'student', `تحديد وتحديث الثنائي القرآني: ${s1.name} و ${s2.name}`, studentId1);
    writeDatabase(db);
    res.json({ success: true, s1, s2 });
  });

  // Monthly Plans endpoints
  api.post('/monthly-plans', (req, res) => {
    const db = readDatabase();
    const newPlan = {
      id: `mp-${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: 'active',
      ...req.body
    };
    db.monthlyPlans.push(newPlan);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'monthlyPlan', `إنشاء خطة شهرية: ${newPlan.title}`, newPlan.id);
    writeDatabase(db);
    res.status(201).json(newPlan);
  });

  api.put('/monthly-plans/:id', (req, res) => {
    const db = readDatabase();
    const index = db.monthlyPlans.findIndex((p: any) => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'الخطة غير موجودة' });
    db.monthlyPlans[index] = { ...db.monthlyPlans[index], ...req.body };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'monthlyPlan', `تعديل الخطة: ${db.monthlyPlans[index].title}`, req.params.id);
    writeDatabase(db);
    res.json(db.monthlyPlans[index]);
  });

  api.post('/monthly-plans/:id/duplicate', (req, res) => {
    const db = readDatabase();
    const sourcePlan = db.monthlyPlans.find((p: any) => p.id === req.params.id);
    if (!sourcePlan) return res.status(404).json({ error: 'الخطة الأصلية غير موجودة' });
    const newPlan = {
      ...sourcePlan,
      id: `mp-${Date.now()}`,
      title: `${sourcePlan.title} (نسخة جديدة)`,
      createdAt: new Date().toISOString(),
      status: 'active'
    };
    db.monthlyPlans.push(newPlan);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'monthlyPlan', `نسخ خطة شهرية سابقة إلى: ${newPlan.title}`, newPlan.id);
    writeDatabase(db);
    res.status(201).json(newPlan);
  });

  // Student Plans
  api.post('/student-plans', (req, res) => {
    const db = readDatabase();
    const newPlan = {
      id: `sp-${Date.now()}`,
      status: 'active',
      ...req.body
    };
    db.studentPlans.push(newPlan);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'studentPlan', `تخصيص خطة شهرية لطالبة`, newPlan.id);
    writeDatabase(db);
    res.status(201).json(newPlan);
  });

  api.put('/student-plans/:id', (req, res) => {
    const db = readDatabase();
    const index = db.studentPlans.findIndex((p: any) => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'خطة الطالبة غير موجودة' });
    db.studentPlans[index] = { ...db.studentPlans[index], ...req.body };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'studentPlan', `تحديث خطة الطالبة`, req.params.id);
    writeDatabase(db);
    res.json(db.studentPlans[index]);
  });

  // Daily records (Memorization, Revision, Conditions, Recitation grade)
  api.post('/daily-records', (req, res) => {
    const db = readDatabase();
    const newRecord = {
      id: `dr-${Date.now()}`,
      recordedBy: (db.currentUser?.name || 'ريفة المنصوري'),
      recordedAt: new Date().toISOString(),
      ...req.body
    };
    db.dailyRecords.push(newRecord);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'grade', 'dailyRecord', `تسجيل إنجاز يومي لطالبة بتاريخ ${newRecord.date}`, newRecord.id);
    writeDatabase(db);
    res.status(201).json(newRecord);
  });

  api.put('/daily-records/:id', (req, res) => {
    const db = readDatabase();
    const index = db.dailyRecords.findIndex((r: any) => r.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'السجل اليومي غير موجود' });
    db.dailyRecords[index] = {
      ...db.dailyRecords[index],
      ...req.body,
      recordedBy: (db.currentUser?.name || 'ريفة المنصوري'),
      recordedAt: new Date().toISOString()
    };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'dailyRecord', `تعديل السجل اليومي`, req.params.id);
    writeDatabase(db);
    res.json(db.dailyRecords[index]);
  });

  // Attendance & Early prep
  api.post('/attendance', (req, res) => {
    const db = readDatabase();
    // Check if record exists for this student & date
    const existingIndex = db.attendanceRecords.findIndex(
      (a: any) => a.studentId === req.body.studentId && a.date === req.body.date
    );
    let record;
    if (existingIndex >= 0) {
      db.attendanceRecords[existingIndex] = {
        ...db.attendanceRecords[existingIndex],
        ...req.body,
        recordedBy: (db.currentUser?.name || 'ريفة المنصوري'),
        recordedAt: new Date().toISOString()
      };
      record = db.attendanceRecords[existingIndex];
    } else {
      record = {
        id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        recordedBy: (db.currentUser?.name || 'ريفة المنصوري'),
        recordedAt: new Date().toISOString(),
        ...req.body
      };
      db.attendanceRecords.push(record);
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'attendance', `تسجيل حضور/تحضير لطالبة بتاريخ ${record.date}`, record.id);
    writeDatabase(db);
    res.json(record);
  });

  // Bulk attendance
  api.post('/attendance/bulk', (req, res) => {
    const { records } = req.body;
    if (!Array.isArray(records)) return res.status(400).json({ error: 'بيانات غير صالحة' });
    const db = readDatabase();
    records.forEach((rec: any) => {
      const idx = db.attendanceRecords.findIndex((a: any) => a.studentId === rec.studentId && a.date === rec.date);
      if (idx >= 0) {
        db.attendanceRecords[idx] = {
          ...db.attendanceRecords[idx],
          ...rec,
          recordedBy: (db.currentUser?.name || 'ريفة المنصوري'),
          recordedAt: new Date().toISOString()
        };
      } else {
        db.attendanceRecords.push({
          id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          recordedBy: (db.currentUser?.name || 'ريفة المنصوري'),
          recordedAt: new Date().toISOString(),
          ...rec
        });
      }
    });
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'attendance', `تسجيل حضور جماعي لـ ${records.length} طالبة`);
    writeDatabase(db);
    res.json({ success: true, count: records.length });
  });

  // Atqini assignments (strictly Tajweed)
  api.post('/atqini', (req, res) => {
    const db = readDatabase();
    const assignment = {
      id: `atq-${Date.now()}`,
      ...req.body
    };
    db.atqiniAssignments.push(assignment);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'atqini', `إضافة واجب تجويد جديد: ${assignment.title}`, assignment.id);
    writeDatabase(db);
    res.status(201).json(assignment);
  });

  api.put('/atqini/:id', (req, res) => {
    const db = readDatabase();
    const idx = db.atqiniAssignments.findIndex((a: any) => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'الواجب غير موجود' });
    db.atqiniAssignments[idx] = { ...db.atqiniAssignments[idx], ...req.body };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'atqini', `تعديل واجب التجويد: ${db.atqiniAssignments[idx].title}`, req.params.id);
    writeDatabase(db);
    res.json(db.atqiniAssignments[idx]);
  });

  api.delete('/atqini/:id', (req, res) => {
    const db = readDatabase();
    const idx = db.atqiniAssignments.findIndex((a: any) => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'الواجب غير موجود' });
    const deleted = db.atqiniAssignments.splice(idx, 1)[0];
    // Cascade remove submissions for this assignment
    db.studentAtqiniSubmissions = db.studentAtqiniSubmissions.filter((s: any) => s.assignmentId !== req.params.id);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'delete', 'atqini', `حذف واجب التجويد: ${deleted.title} وكافة تقييماته`, req.params.id);
    writeDatabase(db);
    res.json({ success: true, deletedId: req.params.id });
  });

  // Atqini submissions
  api.post('/atqini-submissions', (req, res) => {
    const db = readDatabase();
    const existing = db.studentAtqiniSubmissions.findIndex(
      (s: any) => s.assignmentId === req.body.assignmentId && s.studentId === req.body.studentId
    );
    let submission;
    if (existing >= 0) {
      db.studentAtqiniSubmissions[existing] = {
        ...db.studentAtqiniSubmissions[existing],
        ...req.body,
        evaluatedBy: (db.currentUser?.name || 'ريفة المنصوري')
      };
      submission = db.studentAtqiniSubmissions[existing];
    } else {
      submission = {
        id: `atqs-${Date.now()}`,
        evaluatedBy: (db.currentUser?.name || 'ريفة المنصوري'),
        ...req.body
      };
      db.studentAtqiniSubmissions.push(submission);
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'grade', 'atqiniSubmission', `تصحيح واجب تجويد لطالبة بدرجة ${submission.score}`, submission.id);
    writeDatabase(db);
    res.json(submission);
  });

  // Challenges (Thursday Challenge & Grand Revision)
  api.post('/challenges', (req, res) => {
    const db = readDatabase();
    const challenge = {
      id: `ch-${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: 'active',
      ...req.body
    };
    db.challenges.push(challenge);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'challenge', `إضافة تحدٍ قرآني جديد: ${challenge.title}`, challenge.id);
    writeDatabase(db);
    res.status(201).json(challenge);
  });

  api.put('/challenges/:id', (req, res) => {
    const db = readDatabase();
    const idx = db.challenges.findIndex((c: any) => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'التحدي غير موجود' });
    db.challenges[idx] = { ...db.challenges[idx], ...req.body };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'challenge', `تعديل التحدي القرآني: ${db.challenges[idx].title}`, req.params.id);
    writeDatabase(db);
    res.json(db.challenges[idx]);
  });

  api.delete('/challenges/:id', (req, res) => {
    const db = readDatabase();
    const idx = db.challenges.findIndex((c: any) => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'التحدي غير موجود' });
    const deleted = db.challenges.splice(idx, 1)[0];
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'delete', 'challenge', `حذف التحدي: ${deleted.title}`, req.params.id);
    writeDatabase(db);
    res.json({ success: true });
  });

  // Challenge Submissions (including peer review & partner collaboration)
  api.post('/challenge-submissions', (req, res) => {
    const db = readDatabase();
    const existing = db.studentChallengeSubmissions.findIndex(
      (s: any) => s.challengeId === req.body.challengeId && s.studentId === req.body.studentId
    );
    let submission;
    if (existing >= 0) {
      db.studentChallengeSubmissions[existing] = {
        ...db.studentChallengeSubmissions[existing],
        ...req.body,
        evaluatedBy: (db.currentUser?.name || 'ريفة المنصوري'),
        evaluatedAt: new Date().toISOString()
      };
      submission = db.studentChallengeSubmissions[existing];
    } else {
      submission = {
        id: `cs-${Date.now()}`,
        evaluatedBy: (db.currentUser?.name || 'ريفة المنصوري'),
        evaluatedAt: new Date().toISOString(),
        ...req.body
      };
      db.studentChallengeSubmissions.push(submission);
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'grade', 'challengeSubmission', `تقييم تحدي قرآني ومراجعة ثنائية للطالبة`, submission.id);
    writeDatabase(db);
    res.json(submission);
  });

  // Exams & Exam results
  api.post('/exams', (req, res) => {
    const db = readDatabase();
    const exam = {
      id: `ex-${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...req.body
    };
    db.monthlyExams.push(exam);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'exam', `إضافة اختبار شهري: ${exam.title}`, exam.id);
    writeDatabase(db);
    res.status(201).json(exam);
  });

  api.put('/exams/:id', (req, res) => {
    const db = readDatabase();
    const idx = db.monthlyExams.findIndex((e: any) => e.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'الاختبار غير موجود' });
    db.monthlyExams[idx] = { ...db.monthlyExams[idx], ...req.body };
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'exam', `تعديل الاختبار: ${db.monthlyExams[idx].title}`, req.params.id);
    writeDatabase(db);
    res.json(db.monthlyExams[idx]);
  });

  api.delete('/exams/:id', (req, res) => {
    const db = readDatabase();
    const idx = db.monthlyExams.findIndex((e: any) => e.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'الاختبار غير موجود' });
    const deleted = db.monthlyExams.splice(idx, 1)[0];
    db.studentExamResults = db.studentExamResults.filter((r: any) => r.examId !== req.params.id);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'delete', 'exam', `حذف الاختبار الشهري: ${deleted.title}`, req.params.id);
    writeDatabase(db);
    res.json({ success: true });
  });

  api.post('/exam-results', (req, res) => {
    const db = readDatabase();
    const existing = db.studentExamResults.findIndex(
      (r: any) => r.examId === req.body.examId && r.studentId === req.body.studentId
    );
    let result;
    if (existing >= 0) {
      db.studentExamResults[existing] = {
        ...db.studentExamResults[existing],
        ...req.body,
        examinerName: (db.currentUser?.name || 'ريفة المنصوري'),
        evaluatedAt: new Date().toISOString()
      };
      result = db.studentExamResults[existing];
    } else {
      result = {
        id: `er-${Date.now()}`,
        examinerName: (db.currentUser?.name || 'ريفة المنصوري'),
        evaluatedAt: new Date().toISOString(),
        ...req.body
      };
      db.studentExamResults.push(result);
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'grade', 'examResult', `رصد درجة اختبار شهري للطالبة: ${result.score}`, result.id);
    writeDatabase(db);
    res.json(result);
  });

  // Grading config
  api.put('/grading-config/:trackId', (req, res) => {
    const db = readDatabase();
    const idx = db.gradingConfigs.findIndex((g: any) => g.trackId === req.params.trackId);
    if (idx >= 0) {
      db.gradingConfigs[idx] = { ...db.gradingConfigs[idx], ...req.body };
    } else {
      db.gradingConfigs.push({
        id: `gc-${Date.now()}`,
        trackId: req.params.trackId,
        ...req.body
      });
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'gradingConfig', `تعديل نظام الدرجات والنسب المئوية للمسار`, req.params.trackId);
    writeDatabase(db);
    res.json(db.gradingConfigs[idx >= 0 ? idx : db.gradingConfigs.length - 1]);
  });

  // Settings
  api.put('/settings', (req, res) => {
    const db = readDatabase();
    db.settings = { ...db.settings, ...req.body };
    if (req.body.leaderPasscode) {
      const cleanPass = String(req.body.leaderPasscode).trim();
      db.settings.leaderPasscode = cleanPass;
      // Keep leader user in sync
      const leaderUser = db.users.find((u: any) => u.role === 'leader');
      if (leaderUser) {
        leaderUser.passcode = cleanPass;
      }
      if (db.currentUser && (db.currentUser?.role || 'leader') === 'leader') {
        db.currentUser.passcode = cleanPass;
      }
    }
    // Sync PWA icons with uploaded logo
    if (req.body.logoUrl && typeof req.body.logoUrl === 'string' && req.body.logoUrl.startsWith('data:image/')) {
      try {
        const base64Data = req.body.logoUrl.replace(/^data:image\/\w+;base64,/, '');
        const imgBuffer = Buffer.from(base64Data, 'base64');
        import('sharp').then(({ default: sharp }) => {
          sharp(imgBuffer).resize(192, 192).png().toFile('public/pwa-192x192.png').catch(() => {});
          sharp(imgBuffer).resize(512, 512).png().toFile('public/pwa-512x512.png').catch(() => {});
          sharp(imgBuffer).resize(180, 180).png().toFile('public/apple-touch-icon.png').catch(() => {});
          sharp(imgBuffer).resize(388, 388).toBuffer().then(inner => {
            sharp({
              create: { width: 512, height: 512, channels: 4, background: { r: 250, g: 245, b: 242, alpha: 1 } }
            }).composite([{ input: inner, gravity: 'center' }]).png().toFile('public/pwa-maskable-512x512.png').catch(() => {});
          }).catch(() => {});
        }).catch(() => {});
      } catch (err) {
        console.error('PWA icon sync error', err);
      }
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'settings', `تحديث الإعدادات العامة للمقرأة والهوية والشعار`);
    writeDatabase(db);
    const { leaderPasscode: _leaderPasscode, ...safeSettings } = db.settings;
    res.setHeader('Cache-Control', 'no-store');
    res.json(safeSettings);
  });

  // Manage users / permissions
  api.post('/users', (req, res) => {
    const db = readDatabase();
    const newUser = {
      id: `u-${Date.now()}`,
      circleIds: [],
      passcode: req.body.passcode ? String(req.body.passcode).trim() : '',
      ...req.body
    };
    db.users.push(newUser);
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'create', 'user', `إضافة مستخدم جديد: ${newUser.name} (${newUser.title})`, newUser.id);
    writeDatabase(db);
    const { passcode: _passcode, ...safeNewUser } = newUser;
    res.status(201).json(safeNewUser);
  });

  api.put('/users/:id', (req, res) => {
    const db = readDatabase();
    const idx = db.users.findIndex((u: any) => u.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'المستخدم غير موجود' });
    const cleanBody = { ...req.body };
    if (cleanBody.passcode) {
      cleanBody.passcode = String(cleanBody.passcode).trim();
    }
    db.users[idx] = { ...db.users[idx], ...cleanBody };
    // If leader user passcode is changed, sync with settings.leaderPasscode
    if (db.users[idx].role === 'leader' && cleanBody.passcode) {
      db.settings.leaderPasscode = cleanBody.passcode;
    }
    if (db.currentUser.id === req.params.id) {
      db.currentUser = { ...db.currentUser, ...cleanBody };
    }
    addAudit(db, (db.currentUser?.name || 'ريفة المنصوري'), (db.currentUser?.role || 'leader'), 'update', 'user', `تعديل بيانات وصلاحيات المستخدم: ${db.users[idx].name}`, req.params.id);
    writeDatabase(db);
    const { passcode: _passcode, ...safeUpdatedUser } = db.users[idx];
    res.json(safeUpdatedUser);
  });

  // Backup & Restore
  api.get('/backup/download', (_req, res) => {
    const db = readDatabase();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=GhaithAlGhaym_backup_${Date.now()}.json`);
    res.send(JSON.stringify(db, null, 2));
  });

  api.post('/backup/restore', (req, res) => {
    const { backupData } = req.body;
    if (!backupData || !backupData.tracks || !backupData.students) {
      return res.status(400).json({ error: 'صيغة النسخة الاحتياطية غير صالحة' });
    }
    writeDatabase(backupData);
    addAudit(backupData, backupData.currentUser?.name || 'المدير', 'leader', 'restore', 'backup', 'استعادة قاعدة البيانات بالكامل من نسخة احتياطية');
    res.json({ success: true, message: 'تمت استعادة البيانات بنجاح' });
  });

  api.post('/backup/reset-sample', (_req, res) => {
    const freshDb = getInitialDatabase();
    addAudit(freshDb, freshDb.currentUser.name, 'leader', 'backup', 'reset', 'إعادة ضبط قاعدة البيانات إلى البيانات النموذجية الأصلية');
    writeDatabase(freshDb);
    res.json({ success: true, database: freshDb });
  });

  app.use('/api', api);

  const httpServer = http.createServer(app);

  const distPath = path.join(__dirname, 'dist');
  const hasDist = fs.existsSync(path.join(distPath, 'index.html'));

  if (process.env.NODE_ENV === 'production' || (hasDist && process.env.NODE_ENV !== 'development')) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          hmr: false
        },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (err) {
      if (hasDist) {
        app.use(express.static(distPath));
        app.get('*', (_req, res) => {
          res.sendFile(path.join(distPath, 'index.html'));
        });
      } else {
        console.error('Vite dev middleware failed and no dist found:', err);
      }
    }
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🌸 Ghaith Al-Ghaym Platform running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
