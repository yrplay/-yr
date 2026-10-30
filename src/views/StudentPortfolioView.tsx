import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Download, Award, Calendar, CheckCircle2,
  Clock, BookOpen, Sparkles, Trophy, HeartHandshake, FileText,
  UserCheck, Shield, ChevronLeft, Check, FileSignature,
  Eye, Edit3, Palette, X, RefreshCw, Upload, Trash2, Printer
} from 'lucide-react';
import { OfficialSeal } from '../components/OfficialSeal';

interface StudentPortfolioViewProps {
  initialStudentId?: string;
  onSelectStudent?: (studentId: string) => void;
  onNavigateToSection?: (section: string) => void;
}

export const StudentPortfolioView: React.FC<StudentPortfolioViewProps> = ({
  initialStudentId,
  onNavigateToSection
}) => {
  const {
    students, circles, tracks, users, monthlyPlans, studentPlans,
    dailyRecords, attendanceRecords, studentAtqiniSubmissions,
    studentChallengeSubmissions, studentExamResults,
    allStudentScores, settings, showToast, updateSettings,
    saveStudentPlan, updateStudent, saveDailyRecord, saveExamResult
  } = useApp();

  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    initialStudentId || students[0]?.id || ''
  );

  const student = students.find(s => s.id === selectedStudentId) || students[0];
  const circle = circles.find(c => c.id === student?.circleId);
  const track = tracks.find(t => t.id === student?.trackId) || tracks[0];
  const score = allStudentScores[student?.id];

  // Specific student records
  const studentAtqini = studentAtqiniSubmissions.filter(a => a.studentId === student?.id);
  const studentChallenges = studentChallengeSubmissions.filter(c => c.studentId === student?.id);
  const studentExams = studentExamResults.filter(e => e.studentId === student?.id);
  const studentExam = studentExams[studentExams.length - 1];

  const teacher = users.find(u => u.id === circle?.teacherId);
  const leader = users.find(u => u.role === 'leader');
  const teacherSig = teacher?.signatureUrl;
  const leaderSig = settings.leaderSignatureUrl || leader?.signatureUrl;

  // Active student plan with reliable fallback
  const activeStudentPlan = studentPlans.find(sp => sp.studentId === student?.id && sp.status === 'active')
    || studentPlans.find(sp => sp.studentId === student?.id)
    || monthlyPlans.find(mp => mp.trackId === student?.trackId)
    || monthlyPlans[0];

  const currentPlan = monthlyPlans.find(p => p.id === (activeStudentPlan as any)?.monthlyPlanId) || monthlyPlans[0];

  // الخطة تحدد المستهدف، وملخص السجلات اليومية هو المصدر الوحيد للمنجز.
  const targetNewPages = (activeStudentPlan as any)?.newMemorization?.targetPages ?? score?.newMemorizationPagesTarget ?? 8;
  const targetRevPages = (activeStudentPlan as any)?.revision?.targetPages ?? score?.revisionPagesTarget ?? 4;
  const doneNewPages = score?.newMemorizationPagesDone ?? 0;
  const doneRevPages = score?.revisionPagesDone ?? 0;
  const doneMinorRevisionPages = score?.minorRevisionPagesDone ?? 0;
  const doneTamkeenPages = score?.tamkeenRevisionPagesDone ?? 0;
  const doneUnclassifiedRevisionPages = score?.unclassifiedRevisionPagesDone ?? 0;

  const totalAbsentDays = (score?.absentUnexcusedCount || 0) + (score?.absentExcusedCount || 0);

  // Dynamic Free Color Customization state
  const [customPrimaryColor, setCustomPrimaryColor] = useState<string>(settings.primaryColor || '#8E5364');
  const [customSecondaryColor, setCustomSecondaryColor] = useState<string>(settings.secondaryColor || '#2D5A43');

  // Synchronize when settings change
  useEffect(() => {
    if (settings.primaryColor) setCustomPrimaryColor(settings.primaryColor);
    if (settings.secondaryColor) setCustomSecondaryColor(settings.secondaryColor);
  }, [settings.primaryColor, settings.secondaryColor]);

  // Manually editable certificate Hijri date
  const [customCertDate, setCustomCertDate] = useState<string>(
    `${settings.currentHijriMonth || 'ربيع الآخر - جمادى الأولى'} ${settings.academicYear || '١٤٤٦هـ'}`
  );

  // Real-time toggles for seal and signatures
  const [showSeal, setShowSeal] = useState<boolean>(settings.showOfficialSeal !== false);
  const [showTeacherSig, setShowTeacherSig] = useState<boolean>(true);
  const [showLeaderSig, setShowLeaderSig] = useState<boolean>(true);

  // Modal states
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [showQuickEditModal, setShowQuickEditModal] = useState<boolean>(false);

  // Quick edit student achievement form state
  const [quickEditForm, setQuickEditForm] = useState({
    targetPages: targetNewPages,
    actualPages: doneNewPages,
    revisionTargetPages: targetRevPages,
    revisionActualPages: doneRevPages,
    notes: student?.notes || '',
    examScore: studentExam ? studentExam.score : 95
  });

  // Sync quick edit form when student changes
  useEffect(() => {
    setQuickEditForm({
      targetPages: targetNewPages,
      actualPages: doneNewPages,
      revisionTargetPages: targetRevPages,
      revisionActualPages: doneRevPages,
      notes: student?.notes || '',
      examScore: studentExam ? studentExam.score : 95
    });
  }, [selectedStudentId, activeStudentPlan, score, studentExam]);

  // Preset theme color swatches for quick selection
  const presetPalettes = [
    { name: 'العنابي الأصيل', primary: '#8E5364', secondary: '#2D5A43' },
    { name: 'الزمردي القرآني', primary: '#2D5A43', secondary: '#8E5364' },
    { name: 'الكحلي الملكي', primary: '#1E3A8A', secondary: '#B45309' },
    { name: 'الذهبي التراثي', primary: '#B45309', secondary: '#1E3A8A' },
    { name: 'الزيتي العتيق', primary: '#3F6212', secondary: '#78350F' },
    { name: 'البنفسجي الوقور', primary: '#6B21A8', secondary: '#047857' },
    { name: 'العنابي الداكن', primary: '#831843', secondary: '#1E293B' }
  ];

  const handleCustomSealUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast('حجم صورة الختم يجب أن يكون أقل من 2 ميجابايت', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      updateSettings({ sealImageUrl: dataUrl, showOfficialSeal: true });
      setShowSeal(true);
      showToast('تم حفظ وتركيب صورة الختم المخصص بنجاح 💮');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveCustomSeal = () => {
    updateSettings({ sealImageUrl: '' });
    showToast('تم حذف صورة الختم المخصص والعودة للختم النظامي');
  };

  const handleSaveColorsToSettings = () => {
    updateSettings({ primaryColor: customPrimaryColor, secondaryColor: customSecondaryColor });
    showToast('تم حفظ الألوان المحددة كهوية معتمدة للمقرأة بنجاح 🎨');
  };

  const handleSaveQuickEdit = async () => {
    if (!student) return;
    try {
      // 1. Update student plan directly with official accomplished targets
      await saveStudentPlan({
        id: (activeStudentPlan as any)?.id,
        studentId: student.id,
        monthlyPlanId: currentPlan?.id || 'mp-1',
        newMemorization: {
          ...((activeStudentPlan as any)?.newMemorization || {}),
          targetPages: Number(quickEditForm.targetPages),
          actualPages: Number(quickEditForm.actualPages)
        },
        revision: {
          ...((activeStudentPlan as any)?.revision || {}),
          targetPages: Number(quickEditForm.revisionTargetPages),
          actualPages: Number(quickEditForm.revisionActualPages)
        },
        status: 'active'
      });

      // 3. Update student notes
      if (quickEditForm.notes !== student.notes) {
        await updateStudent(student.id, { notes: quickEditForm.notes });
      }

      // 4. Update exam score if provided
      if (quickEditForm.examScore) {
        await saveExamResult({
          studentId: student.id,
          examId: 'exam-1',
          score: Number(quickEditForm.examScore),
          notes: 'رصد فوري معتمد من ملف الإنجاز'
        });
      }

      setShowQuickEditModal(false);
      showToast('تم حفظ وتحديث بيانات الخطة والصفحات المنجزة بنجاح ✅', 'success');
    } catch (err: any) {
      showToast('تعذر حفظ البيانات: ' + err.message, 'error');
    }
  };

  // Generate pure, self-contained HTML certificate
  const buildCertificateHtmlString = () => {
    if (!student) return '';
    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>شهادة إنجاز معتمدة - ${student.name} - مقرأة ${settings.name}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Tajawal', sans-serif;
      background: #FAF7F5;
      color: #2D2426;
      padding: 24px 15px;
      direction: rtl;
    }
    .cert-card {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      border: 3px solid ${customPrimaryColor};
      border-radius: 20px;
      padding: 26px 32px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.06);
      position: relative;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #E8DFD8;
      padding-bottom: 14px;
      margin-bottom: 14px;
    }
    .header h1 {
      font-family: 'Amiri', serif;
      font-size: 28px;
      color: #1c1917;
      margin-bottom: 2px;
    }
    .badge-top {
      background: ${customPrimaryColor}15;
      color: ${customPrimaryColor};
      padding: 5px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: bold;
      border: 1px solid ${customPrimaryColor}35;
      display: inline-block;
    }
    .student-banner {
      background: linear-gradient(135deg, ${customPrimaryColor}0d, ${customSecondaryColor}0d);
      border: 1px solid ${customPrimaryColor}30;
      border-radius: 14px;
      padding: 12px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
    }
    .student-name {
      font-size: 23px;
      font-weight: 800;
      color: ${customPrimaryColor};
      font-family: 'Amiri', serif;
    }
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
      margin-bottom: 14px;
    }
    .stat-box {
      background: #FCFAF8;
      border: 1px solid #EFE8E2;
      border-radius: 12px;
      padding: 8px 6px;
      text-align: center;
    }
    .stat-label { font-size: 10.5px; color: #78716c; margin-bottom: 2px; }
    .stat-value { font-size: 15px; font-weight: bold; color: #1c1917; }
    .section-title {
      font-size: 13px;
      font-weight: bold;
      color: #1c1917;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .table-custom {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      font-size: 11px;
    }
    .table-custom th, .table-custom td {
      border: 1px solid #EAE2DB;
      padding: 6px 8px;
      text-align: right;
    }
    .table-custom th {
      background: #F7EFE9;
      font-weight: bold;
    }
    .remarks-box {
      background: #FCFAF8;
      padding: 10px 14px;
      border-radius: 10px;
      border: 1px solid #EFE8E2;
      margin-bottom: 12px;
      font-size: 11.5px;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 14px;
      border-top: 2px solid #E8DFD8;
      padding-top: 12px;
    }
    .seal {
      width: 78px;
      height: 78px;
      border-radius: 50%;
      border: 3.5px double ${customPrimaryColor};
      color: ${customPrimaryColor};
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: bold;
      transform: rotate(-6deg);
    }
    .seal-img {
      width: 76px;
      height: 76px;
      object-fit: contain;
      transform: rotate(-5deg);
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
    }
    .dev-credit {
      margin-top: 10px;
      text-align: center;
      font-size: 9.5px;
      color: #a8a29e;
      font-family: sans-serif;
    }
    @page {
      size: A4 landscape;
      margin: 5mm;
    }
    @media print {
      html, body {
        width: 100% !important;
        height: 100% !important;
        max-height: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: white !important;
        overflow: hidden !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        page-break-inside: avoid !important;
        page-break-after: avoid !important;
        break-inside: avoid !important;
      }
      .no-print { display: none !important; }
      .cert-card {
        box-shadow: none !important;
        border-width: 2.5px !important;
        border-radius: 16px !important;
        max-width: 100% !important;
        width: 100% !important;
        height: calc(100vh - 10mm) !important;
        max-height: calc(100vh - 10mm) !important;
        padding: 12px 20px !important;
        margin: 0 auto !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: space-between !important;
      }
      .header {
        padding-bottom: 6px !important;
        margin-bottom: 6px !important;
      }
      .header h1 {
        font-size: 21px !important;
      }
      .header p {
        font-size: 10.5px !important;
      }
      .badge-top {
        font-size: 10px !important;
        padding: 3px 8px !important;
      }
      .student-banner {
        padding: 6px 12px !important;
        margin-bottom: 6px !important;
        border-radius: 10px !important;
      }
      .student-name {
        font-size: 18px !important;
      }
      .stat-grid {
        gap: 5px !important;
        margin-bottom: 6px !important;
      }
      .stat-box {
        padding: 4px 3px !important;
        border-radius: 6px !important;
      }
      .stat-label {
        font-size: 9px !important;
      }
      .stat-value {
        font-size: 12.5px !important;
      }
      .section-title {
        font-size: 11px !important;
        margin-bottom: 3px !important;
      }
      .table-custom {
        margin-bottom: 6px !important;
        font-size: 9.5px !important;
      }
      .table-custom th, .table-custom td {
        padding: 3px 5px !important;
      }
      .remarks-box {
        padding: 5px 8px !important;
        margin-bottom: 5px !important;
        font-size: 10px !important;
      }
      .footer {
        margin-top: 5px !important;
        padding-top: 5px !important;
      }
      .seal {
        width: 58px !important;
        height: 58px !important;
        font-size: 8px !important;
      }
      .seal-img {
        width: 56px !important;
        height: 56px !important;
      }
      .dev-credit {
        margin-top: 2px !important;
        font-size: 7.5px !important;
      }
    }
  </style>
</head>
<body>
  <!-- Print and Save PDF button visible on browser, hidden in print -->
  <div class="no-print" style="text-align: center; margin: 0 auto 16px auto; max-width: 900px;">
    <button onclick="window.print()" style="padding: 10px 26px; background: ${customPrimaryColor}; color: white; border: none; border-radius: 14px; font-family: 'Tajawal', sans-serif; font-size: 14px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,0.15); display: inline-flex; align-items: center; gap: 8px; transition: transform 0.1s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
      <span style="font-size: 16px;">🖨️</span>
      <span>طباعة الشهادة أو حفظ كـ PDF الآن</span>
    </button>
  </div>
  <div class="cert-card">
    <div class="header">
      <div style="display: flex; align-items: center; gap: 16px;">
        ${settings.logoUrl ? `
          <img src="${settings.logoUrl}" alt="شعار مقرأة ${settings.name}" style="height: 65px; max-width: 130px; object-fit: contain; border-radius: 12px; background: white; padding: 2px; border: 1px solid #E8DFD8;" />
        ` : `
          <div style="width: 58px; height: 58px; border-radius: 16px; background: ${customPrimaryColor}15; border: 1.5px solid ${customPrimaryColor}35; display: flex; align-items: center; justify-content: center; font-size: 28px;">
            🪴
          </div>
        `}
        <div>
          <h1>مقرأة ${settings.name}</h1>
          <p style="font-size: 13px; color: #78716c;">${settings.subtitle} • ${track.name}</p>
          <p style="font-size: 12px; color: #a8a29e;">إشراف قائدة المقرأة: <strong>${settings.leaderName}</strong></p>
        </div>
      </div>
      <div style="text-align: left;">
        <span class="badge-top">تقرير إنجاز شهري معتمد</span>
        <p style="font-size: 11px; color: #78716c; margin-top: 6px; font-weight: bold;">${customCertDate}</p>
      </div>
    </div>

    <div class="student-banner">
      <div>
        <div style="font-size: 12px; color: #78716c; margin-bottom: 2px;">اسم الطالبة المتميزة:</div>
        <div class="student-name">${student.name}</div>
        <div style="font-size: 12px; color: #78716c; margin-top: 4px;">
          الكود: <strong>${student.code}</strong> • حلقة: <strong>${circle?.name}</strong> • المعلمة: <strong>${circle?.teacherName}</strong>
        </div>
      </div>
      <div style="text-align: center; background: white; padding: 12px 24px; border-radius: 14px; border: 1px solid #E5D5D9;">
        <div style="font-size: 11px; color: #78716c;">النسبة المئوية والتقدير</div>
        <div style="font-size: 28px; font-weight: 900; color: ${customPrimaryColor};">${score?.finalPercentage || 0}%</div>
        <div style="font-size: 12px; font-weight: bold; color: ${score?.gradeColor || customSecondaryColor};">${score?.gradeLabel || 'ممتاز مرتفع'}</div>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-box">
        <div class="stat-label">نسبة الحضور</div>
        <div class="stat-value" style="color: ${customSecondaryColor};">${score?.attendanceRate || 0}%</div>
        <div style="font-size: 9px; color: #78716c; margin-top: 2px;">${score?.presentCount || 0} جلسات</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">أيام الغياب</div>
        <div class="stat-value" style="color: ${totalAbsentDays > 0 ? '#b91c1c' : customSecondaryColor};">${totalAbsentDays} أيام</div>
        <div style="font-size: 9px; color: #a8a29e; margin-top: 2px;">${score?.absentExcusedCount || 0} بعذر • ${score?.absentUnexcusedCount || 0} دون عذر</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">الحفظ الجديد المنجز</div>
        <div class="stat-value">${doneNewPages} ص</div>
        <div style="font-size: 9px; color: #78716c; margin-top: 2px;">المستهدف: ${targetNewPages} ص</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">المراجعة الصغرى</div>
        <div class="stat-value">${doneMinorRevisionPages} ص</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">مراجعة التمكين</div>
        <div class="stat-value">${doneTamkeenPages} ص</div>
        <div style="font-size: 9px; color: #78716c; margin-top: 2px;">المستهدف: ${targetRevPages} ص</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">الترتيب في الحلقة</div>
        <div class="stat-value" style="color: ${customPrimaryColor};">المركز ${score?.rankInCircle || 1}</div>
        <div style="font-size: 9px; color: #78716c; margin-top: 2px;">في حلقة ${circle?.name || ''}</div>
      </div>
    </div>

    <div class="section-title">تفاصيل الأداء التراكمي المعتمد:</div>
    <table class="table-custom">
      <thead>
        <tr>
          <th>المجال / المعيار</th>
          <th>المقرر المستهدف</th>
          <th>المنجز الفعلي</th>
          <th>التقييم / الدرجة</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>الحضور والانضباط</strong></td>
          <td>حضور جلسات التسميع المقررة</td>
          <td>نسبة ${score?.attendanceRate || 0}% • غياب: ${totalAbsentDays} أيام (${score?.absentExcusedCount || 0} بعذر • ${score?.absentUnexcusedCount || 0} دون عذر)</td>
          <td>${score?.attendanceScore || 10} / 10</td>
        </tr>
        <tr>
          <td><strong>الحفظ الجديد</strong></td>
          <td>${targetNewPages} صفحات</td>
          <td>${doneNewPages} صفحات</td>
          <td>${score?.memorizationScore || 10} / 10</td>
        </tr>
        <tr>
          <td><strong>المراجعة الصغرى</strong></td>
          <td>حسب خطة المراجعة</td>
          <td>${doneMinorRevisionPages} صفحات</td>
          <td>—</td>
        </tr>
        <tr>
          <td><strong>مراجعة التمكين</strong></td>
          <td>${targetRevPages} صفحات</td>
          <td>${doneTamkeenPages} صفحات</td>
          <td>متقن بالشروط ✅</td>
        </tr>
        ${doneUnclassifiedRevisionPages > 0 ? `<tr><td><strong>مراجعة مسجلة دون تفصيل (سجلات سابقة)</strong></td><td>—</td><td>${doneUnclassifiedRevisionPages} صفحات</td><td>غير مصنفة</td></tr>` : ''}
        <tr>
          <td><strong>واجبات «أتقني» للتجويد</strong></td>
          <td>تطبيق أحكام التجويد واستخراج الأمثلة</td>
          <td>${score?.atqiniCompletedCount || 1} واجب منجز</td>
          <td>${score?.atqiniScore || 10} / 10</td>
        </tr>
        <tr>
          <td><strong>التحديات والمراجعة الثنائية</strong></td>
          <td>مع الرفيقة: ${student.partnerStudentName || 'الرفيقة المعتمدة'}</td>
          <td>منجز بتميز وتعاون مثمر ⭐</td>
          <td>${score?.challengesScore || 10} / 10</td>
        </tr>
        <tr>
          <td><strong>الاختبار الشهري</strong></td>
          <td>اختبار تمكيني شامل</td>
          <td>${studentExam ? studentExam.score : 95} درجة</td>
          <td>${studentExam ? studentExam.score : 95} / 100</td>
        </tr>
      </tbody>
    </table>

    <div class="remarks-box" style="background: #FCFAF8; padding: 12px 16px; border-radius: 12px; border: 1px solid #EFE8E2; margin-bottom: 14px;">
      <div style="font-size: 11px; font-weight: bold; color: #78716c; margin-bottom: 4px;">توصيات وملاحظات المعلمة والمشرفة:</div>
      <div style="font-size: 12.5px; font-style: italic; color: #44403c; line-height: 1.5;">
        "${student.notes || 'طالبة متميزة أظهرت التزاماً راسخاً في الحفظ والتجويد والمراجعة الثنائية. نبارك لها هذا الرسوخ والإنجاز المبارك.'}"
      </div>
    </div>

    <div class="footer">
      <div style="text-align: center; min-width: 130px;">
        <div style="font-size: 12px; color: #78716c;">معلمة الحلقة</div>
        <div style="font-size: 14px; font-weight: bold; margin-top: 3px;">أ. ${circle?.teacherName || 'معلمة الحلقة'}</div>
        ${showTeacherSig && teacherSig ? `<img src="${teacherSig}" alt="توقيع المعلمة" style="height: 36px; max-width: 100px; object-fit: contain; margin: 3px auto; display: block;" />` : showTeacherSig ? `<div style="font-size: 10px; color: #a8a29e; margin-top: 4px;">(التوقيع معتمد بالنظام)</div>` : ''}
      </div>

      <div style="text-align: center; min-width: 90px;">
        ${showSeal ? (settings.sealImageUrl ? `
          <img class="seal-img" src="${settings.sealImageUrl}" alt="الختم الرسمي" style="width: 76px; height: 76px; object-fit: contain; transform: rotate(-5deg); filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));" />
        ` : `
          <div class="seal">
            <span>مقرأة</span>
            <span style="font-size: 12px; font-family: 'Amiri';">${settings.name || 'غيث الغيم'}</span>
            <span style="font-size: 8px;">${settings.sealText || 'ختم الاعتماد الرسمي'}</span>
          </div>
        `) : ''}
      </div>

      <div style="text-align: center; min-width: 130px;">
        <div style="font-size: 12px; color: #78716c;">قائدة مقرأة ${settings.name || 'غيث الغيم'}</div>
        <div style="font-size: 14px; font-weight: bold; margin-top: 3px;">${settings.leaderName || 'ريفة المنصوري'}</div>
        ${showLeaderSig && leaderSig ? `<img src="${leaderSig}" alt="توقيع القائدة" style="height: 36px; max-width: 100px; object-fit: contain; margin: 3px auto; display: block;" />` : showLeaderSig ? `<div style="font-size: 10px; color: #a8a29e; margin-top: 4px;">(الاعتماد النهائي)</div>` : ''}
      </div>
    </div>
    <div class="dev-credit" style="margin-top: 10px; text-align: center; font-size: 9.5px; color: #a8a29e; font-family: sans-serif;">
      تم الإصدار والتوثيق عبر منصة غيث الغيم الإدارية • تطوير: ياسر التاج · yr_alhosine
    </div>
  </div>
</body>
</html>`;
  };

  // Export 1: HTML Download
  const handleDownloadHtml = () => {
    if (!student) return;
    const certHtml = buildCertificateHtmlString();
    const blob = new Blob([certHtml], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `شهادة_إنجاز_${student.name.replace(/\s+/g, '_')}_${customCertDate.replace(/\s+/g, '_')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('تم تنزيل شهادة الإنجاز بصيغة HTML بنجاح 🌐');
  };

  // Export 2: PDF Export (Triggers formatted print-to-pdf)
  const handleDownloadPdf = () => {
    if (!student) return;
    try {
      const certHtml = buildCertificateHtmlString();
      const printWindow = window.open('', '_blank', 'width=950,height=750');
      if (printWindow) {
        printWindow.document.write(certHtml);
        printWindow.document.close();
        printWindow.focus();
        showToast('جاري فتح نافذة حفظ وتصدير الشهادة كـ PDF... اختر "حفظ بتنسيق PDF" (Save as PDF) 📄', 'success');
        setTimeout(() => {
          try {
            printWindow.print();
          } catch (e) {
            console.log('PDF window print handled', e);
          }
        }, 400);
      } else {
        // Fallback: download HTML so user has the certified document
        handleDownloadHtml();
        showToast('تم حفظ الشهادة بصيغة ويب يمكن حفظها مباشرة كـ PDF 📄');
      }
    } catch (err) {
      handleDownloadHtml();
    }
  };

  if (!student) {
    return <div className="p-8 text-center text-stone-500">لا توجد طالبة محددة</div>;
  }

  return (
    <div className="space-y-6">

      {/* Selector & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-[#E8DFD8] shadow-2xs">
        <div className="flex items-center gap-3">
          <span className="text-xl">📜</span>
          <div>
            <label className="block text-[11px] font-bold text-stone-600 mb-0.5">
              اختاري الطالبة لعرض ملف إنجازها وشهادتها الشهرية:
            </label>
            <select
              value={selectedStudentId}
              onChange={e => setSelectedStudentId(e.target.value)}
              className="px-3 py-1.5 border border-stone-200 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-[#8E5364]"
            >
              {students.map(s => {
                const c = circles.find(ci => ci.id === s.circleId);
                return (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code}) - {c?.name}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Clean top action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick PDF Export */}
          <button
            onClick={handleDownloadPdf}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 transition cursor-pointer active:scale-95"
            title="تنزيل الشهادة بصيغة PDF"
          >
            <FileText className="w-3.5 h-3.5 text-rose-600" />
            <span>تنزيل PDF</span>
          </button>

          {/* Quick HTML Export */}
          <button
            onClick={handleDownloadHtml}
            className="flex items-center gap-1.5 px-3 py-2 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-xl text-xs font-bold text-stone-700 transition cursor-pointer active:scale-95"
            title="تنزيل الشهادة بصيغة HTML مستقلة"
          >
            <Download className="w-3.5 h-3.5 text-stone-500" />
            <span>تنزيل HTML</span>
          </button>

          {/* Dedicated Preview Modal Button */}
          <button
            onClick={() => setShowPreviewModal(true)}
            style={{ backgroundColor: customPrimaryColor }}
            className="flex items-center gap-1.5 px-4 py-2 hover:brightness-105 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer active:scale-95"
          >
            <Eye className="w-4 h-4" />
            <span>معاينة الشهادة وتنسيقها 👁️</span>
          </button>
        </div>
      </div>

      {/* Official Certificate & Portfolio Document Card (On-Screen View) */}
      <div
        className="bg-white rounded-3xl border-2 p-6 sm:p-10 shadow-sm space-y-8 relative overflow-hidden"
        style={{ borderColor: customPrimaryColor }}
      >
        
        {/* Certificate Frame Pattern Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-[#E8DFD8] pb-6 text-center sm:text-right">
          <div className="flex items-center justify-center sm:justify-start gap-3">
            {settings.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt="شعار المقرأة"
                className="w-16 h-16 object-contain rounded-2xl border border-stone-200 p-1 bg-white shadow-2xs"
              />
            ) : (
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-2xs"
                style={{ backgroundColor: `${customPrimaryColor}15`, border: `1.5px solid ${customPrimaryColor}30` }}
              >
                🪴
              </div>
            )}
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 font-quran">
                مقرأة {settings.name}
              </h1>
              <p className="text-xs text-stone-500 font-medium">
                {settings.subtitle} • {track.name}
              </p>
              <p className="text-[11px] text-stone-400">
                إشراف قائدة المقرأة: <strong>{settings.leaderName}</strong>
              </p>
            </div>
          </div>

          <div className="text-center sm:text-left bg-[#FCFAF8] p-3 rounded-2xl border border-[#EFE8E2]">
            <span className="text-[11px] font-bold text-stone-400 block uppercase">ملف الإنجاز والتقرير الشهري</span>
            <div className="text-sm font-extrabold" style={{ color: customPrimaryColor }}>
              {currentPlan?.title || 'خطة شهر ربيع الآخر وجمادى الأولى ١٤٤٦هـ'}
            </div>
            <div className="text-[11px] text-stone-500 font-bold mt-1">
              تاريخ الاعتماد: {customCertDate}
            </div>
          </div>
        </div>

        {/* Student Metadata Header */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-[#FCFAF8] p-4 rounded-2xl border border-[#EFE8E2] text-xs">
          <div>
            <span className="text-stone-400 block text-[10px]">اسم الطالبة:</span>
            <strong className="text-sm font-quran" style={{ color: customPrimaryColor }}>{student.name}</strong>
          </div>
          <div>
            <span className="text-stone-400 block text-[10px]">كود الطالبة والحلقة:</span>
            <strong className="text-stone-800">{student.code} • {circle?.name}</strong>
          </div>
          <div>
            <span className="text-stone-400 block text-[10px]">المعلمة والمشرفة:</span>
            <strong className="text-stone-800">أ. {circle?.teacherName} • أ. {circle?.supervisorName}</strong>
          </div>
          <div>
            <span className="text-stone-400 block text-[10px]">الرفيقة القرآنية 🤝:</span>
            <strong className="text-[#7A4B37]">{student.partnerStudentName || 'لم تعين'}</strong>
          </div>
          <div>
            <span className="text-stone-400 block text-[10px]">الحضور والغياب:</span>
            <strong className={totalAbsentDays > 0 ? "text-rose-700 font-bold" : "text-emerald-700 font-bold"}>
              حضور {score?.attendanceRate || 0}% • غياب {totalAbsentDays} أيام
            </strong>
          </div>
        </div>

        {/* Honor Badge Banner */}
        <div
          className="rounded-3xl p-6 text-white text-center sm:text-right relative overflow-hidden shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          style={{ backgroundColor: score?.gradeColor || customSecondaryColor }}
        >
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-xs font-semibold mb-2">
              <Award className="w-3.5 h-3.5" />
              <span>التقدير والنتيجة النهائية للخطة الشهرية</span>
            </div>
            <div className="text-3xl sm:text-4xl font-black font-quran">
              {score?.gradeLabel} ({score?.gradeLetter})
            </div>
            <p className="text-white/80 text-xs mt-1">
              ترتيب الطالبة: المركز <strong>#{score?.rankInCircle}</strong> في {circle?.name} • والمركز <strong>#{score?.rankInTrack}</strong> في {track.name}
            </p>
          </div>

          <div className="bg-white/15 backdrop-blur px-6 py-4 rounded-2xl border border-white/20 text-center shrink-0">
            <span className="text-xs text-white/80 font-medium block">النسبة المئوية العامة</span>
            <span className="text-4xl sm:text-5xl font-black">{score?.finalPercentage}%</span>
            <span className="text-[11px] text-white/70 block mt-1">
              مجموع النقاط: {score?.totalEarnedPoints} / {score?.totalPossiblePoints}
            </span>
          </div>
        </div>

        {/* Detailed Sections Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          
          {/* Section 1: Memorization & Revision Plan */}
          <div
            onClick={() => onNavigateToSection?.('recitation')}
            className="group p-4 rounded-2xl border border-[#E8DFD8] bg-white space-y-2.5 hover:border-[#8E5364] hover:shadow-md transition-all duration-200 cursor-pointer relative"
            title="انقر للانتقال مباشرة إلى قسم التسميع اليومي ومتابعة درجات الحفظ"
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-2">
              <h4 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                <BookOpen className="w-4 h-4" style={{ color: customPrimaryColor }} />
                <span>إنجاز خطة الحفظ والمراجعة</span>
              </h4>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigateToSection?.('monthly_plans');
                  }}
                  className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-[#FAF6F2] hover:bg-[#8E5364] text-[#8E5364] hover:text-white border border-[#E8DFD8] transition"
                  title="فتح الخطة الشهرية المعتمدة"
                >
                  الخطة ↗
                </button>
                <span className="text-[10px] font-bold text-[#8E5364] group-hover:underline flex items-center gap-0.5 bg-[#FAF2F4] px-2 py-0.5 rounded-lg">
                  فتح التسميع ↗
                </span>
              </div>
            </div>

            <div className="space-y-1.5 text-stone-600">
              <div className="flex justify-between items-center py-0.5 hover:bg-stone-50 rounded px-1 transition">
                <span>الحفظ الجديد المنجز (بشروط):</span>
                <strong className="text-stone-900">{doneNewPages} من {targetNewPages} صفحات</strong>
              </div>
              <div className="flex justify-between items-center py-0.5 hover:bg-stone-50 rounded px-1 transition">
                <span>المراجعة الصغرى المنجزة:</span>
                <strong className="text-stone-900">{doneMinorRevisionPages} صفحات</strong>
              </div>
              <div className="flex justify-between items-center py-0.5 hover:bg-stone-50 rounded px-1 transition">
                <span>مراجعة التمكين:</span>
                <strong className="text-stone-900">{doneTamkeenPages} من {targetRevPages} صفحات</strong>
              </div>
              {doneUnclassifiedRevisionPages > 0 && (
                <div className="flex justify-between items-center py-0.5 px-1 text-amber-700" title="سجلات قديمة لم تكن تميّز بين أنواع المراجعة">
                  <span>مراجعة مسجلة دون تفصيل:</span>
                  <strong>{doneUnclassifiedRevisionPages} صفحات</strong>
                </div>
              )}
              <div className="flex justify-between items-center py-0.5 hover:bg-stone-50 rounded px-1 transition">
                <span>أخطاء الحفظ المرصودة:</span>
                <strong className="text-rose-700">{score?.memorizationMistakesTotal || 0} أخطاء</strong>
              </div>
              <div className="flex justify-between items-center py-0.5 hover:bg-stone-50 rounded px-1 transition">
                <span>التنبيهات والأخطاء التجويدية:</span>
                <strong className="text-stone-900">{score?.hintsTotal || 0} تنبيه • {score?.tajweedErrorsTotal || 0} تجويد</strong>
              </div>
              <div className="flex justify-between pt-1 border-t border-stone-100 font-bold text-stone-900 items-center">
                <span>درجة الحفظ والمراجعة:</span>
                <span style={{ color: customPrimaryColor }}>{score?.memorizationScore} / {score?.memorizationMax} نقطة</span>
              </div>
            </div>
          </div>

          {/* Section 2: Attendance & Early Prep */}
          <div
            onClick={() => onNavigateToSection?.('attendance')}
            className="group p-4 rounded-2xl border border-[#E8DFD8] bg-white space-y-2.5 hover:border-[#2D5A43] hover:shadow-md transition-all duration-200 cursor-pointer relative"
            title="انقر للانتقال مباشرة إلى كشف وسجل الحضور والتحضير المبكر"
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-2">
              <h4 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4" style={{ color: customSecondaryColor }} />
                <span>الحضور والانضباط والتحضير المبكر</span>
              </h4>
              <span className="text-[10px] font-bold text-[#2D5A43] group-hover:underline flex items-center gap-0.5 bg-[#EDF3EF] px-2 py-0.5 rounded-lg">
                فتح سجل الحضور ↗
              </span>
            </div>

            <div className="space-y-1.5 text-stone-600">
              <div className="flex justify-between items-center py-0.5 hover:bg-stone-50 rounded px-1 transition">
                <span>نسبة الحضور التراكمية:</span>
                <strong style={{ color: customSecondaryColor }}>{score?.attendanceRate}%</strong>
              </div>
              <div className="flex justify-between items-center py-0.5 hover:bg-stone-50 rounded px-1 transition">
                <span>عدد أيام الحضور الفعلي:</span>
                <strong className="text-stone-900">{score?.presentCount} جلسات</strong>
              </div>
              <div className="flex justify-between items-center py-0.5 hover:bg-stone-50 rounded px-1 transition">
                <span>إجمالي أيام الغياب:</span>
                <strong className={totalAbsentDays > 0 ? "text-rose-700 font-bold" : "text-emerald-700 font-bold"}>
                  {totalAbsentDays} أيام ({score?.absentExcusedCount || 0} بعذر • {score?.absentUnexcusedCount || 0} دون عذر)
                </strong>
              </div>
              <div className="flex justify-between items-center py-0.5 hover:bg-stone-50 rounded px-1 transition">
                <span>بطاقات التحضير المبكر ⭐:</span>
                <strong className="text-amber-800">{score?.earlyPrepCount} بطاقات في الموعد</strong>
              </div>
              <div className="flex justify-between pt-1 border-t border-stone-100 font-bold text-stone-900 items-center">
                <span>درجة الحضور والانضباط:</span>
                <span style={{ color: customSecondaryColor }}>{score?.attendanceScore} / {score?.attendanceMax} نقطة</span>
              </div>
            </div>
          </div>

          {/* Section 3: Atqini (Tajweed) */}
          <div
            onClick={() => onNavigateToSection?.('atqini')}
            className="group p-4 rounded-2xl border border-[#E8DFD8] bg-white space-y-2.5 hover:border-[#8E5364] hover:shadow-md transition-all duration-200 cursor-pointer relative"
            title="انقر للانتقال مباشرة إلى منصة واجبات أتقني للتجويد"
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-2">
              <h4 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4" style={{ color: customPrimaryColor }} />
                <span>واجبات «أتقني» للتجويد</span>
              </h4>
              <span className="text-[10px] font-bold text-[#8E5364] group-hover:underline flex items-center gap-0.5 bg-[#FAF2F4] px-2 py-0.5 rounded-lg">
                فتح واجبات أتقني ↗
              </span>
            </div>

            <div className="space-y-1.5 text-stone-600">
              <div className="flex justify-between items-center py-0.5 hover:bg-stone-50 rounded px-1 transition">
                <span>الواجبات المنجزة:</span>
                <strong className="text-stone-900">{score?.atqiniCompletedCount} واجبات مكتملة</strong>
              </div>
              <div className="flex justify-between items-center py-0.5 hover:bg-stone-50 rounded px-1 transition">
                <span>استخراج الأمثلة من المحفوظ:</span>
                <strong className="text-emerald-700">متقن ✅</strong>
              </div>
              <div className="flex justify-between items-center py-0.5 hover:bg-stone-50 rounded px-1 transition">
                <span>تطبيق الأحكام أثناء التسميع:</span>
                <strong className="text-emerald-700">ممتاز ✅</strong>
              </div>
              <div className="flex justify-between pt-1 border-t border-stone-100 font-bold text-stone-900 items-center">
                <span>درجة التجويد «أتقني»:</span>
                <span style={{ color: customPrimaryColor }}>{score?.atqiniScore} / {score?.atqiniMax} نقطة</span>
              </div>
            </div>
          </div>

          {/* Section 4: Challenges & Peer Review */}
          <div
            onClick={() => onNavigateToSection?.('challenges')}
            className="group p-4 rounded-2xl border border-[#E8DFD8] bg-white space-y-2.5 hover:border-amber-600 hover:shadow-md transition-all duration-200 cursor-pointer relative"
            title="انقر للانتقال مباشرة إلى تحدي الخميس والمراجعة الثنائية"
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-2">
              <h4 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-600" />
                <span>تحدي الخميس والمراجعة الثنائية 🤝</span>
              </h4>
              <span className="text-[10px] font-bold text-amber-800 group-hover:underline flex items-center gap-0.5 bg-amber-50 px-2 py-0.5 rounded-lg">
                فتح قسم التحديات ↗
              </span>
            </div>

            <div className="space-y-1.5 text-stone-600">
              <div className="flex justify-between items-center py-0.5 hover:bg-stone-50 rounded px-1 transition">
                <span>المراجعة المشتركة مع الرفيقة:</span>
                <strong className="text-stone-900">{student.partnerStudentName ? `مع ${student.partnerStudentName}` : 'إنجاز تام وتعاون مثمر'}</strong>
              </div>
              <div className="flex justify-between items-center py-0.5 hover:bg-stone-50 rounded px-1 transition">
                <span>الالتزام التام بالمطلوب:</span>
                <strong className="text-stone-900">متقن وفق الضوابط</strong>
              </div>
              <div className="flex justify-between items-center py-0.5 hover:bg-stone-50 rounded px-1 transition">
                <span>نقاط المراجعة:</span>
                <strong className="text-[#7A4B37]">+{score?.peerReviewScore || 0} نقاط</strong>
              </div>
              <div className="flex justify-between pt-1 border-t border-stone-100 font-bold text-stone-900 items-center">
                <span>مجموع درجات التحديات:</span>
                <span className="text-amber-800">{score?.challengesScore} / {score?.challengesMax} نقطة</span>
              </div>
            </div>
          </div>

        </div>

        {/* Section 5: Monthly Exam & Teacher Remark */}
        <div
          onClick={() => onNavigateToSection?.('exams')}
          className="group p-4 rounded-2xl bg-[#FCFAF8] border border-[#EFE8E2] hover:border-[#2D5A43] hover:shadow-md transition-all duration-200 cursor-pointer space-y-3 text-xs relative"
          title="انقر للانتقال مباشرة إلى كشف وجدول الاختبارات الشهرية"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200 pb-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#2D5A43]" />
              <div>
                <span className="font-bold text-stone-900">نتيجة الاختبار الشهري التمكيني:</span>
                {studentExam?.customPortion && (
                  <span className="text-[11px] text-stone-500 mr-2 block sm:inline">
                    (المقرر المرصود: {studentExam.customPortion})
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm font-extrabold text-[#2D5A43]">
                {studentExam ? `${studentExam.score} من ١٠٠ درجة` : 'بانتظار الرصد في الموعد المحدد'}
              </div>
              <span className="text-[10px] font-bold text-[#2D5A43] group-hover:underline flex items-center gap-0.5 bg-[#EDF3EF] px-2 py-0.5 rounded-lg">
                فتح كشف الاختبارات ↗
              </span>
            </div>
          </div>

          <div>
            <span className="font-bold text-stone-700 block mb-1">توصيات وملاحظات المعلمة والمشرفة:</span>
            <p className="text-stone-600 italic bg-white p-3 rounded-xl border border-stone-200 leading-relaxed">
              "{student.notes || 'طالبة مجتهدة ومثابرة، أظهرت إتقاناً متميزاً في الحفظ والتجويد والمراجعة مع رفيقتها. نوصي بالاستمرار على هذا النهج الراسخ.'}"
            </p>
          </div>
        </div>

        {/* Certificate Seal & Signatures Footer */}
        <div className="pt-6 border-t-2 border-[#E8DFD8] flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-right">
          <div className="flex flex-col items-center sm:items-start min-w-[130px]">
            <div className="text-xs text-stone-500">معلمة الحلقة</div>
            <div className="text-sm font-bold text-stone-900 font-quran mt-1">
              أ. {circle?.teacherName || 'معلمة الحلقة'}
            </div>
            {showTeacherSig && (
              teacherSig ? (
                <div className="mt-1 flex flex-col items-center sm:items-start">
                  <img
                    src={teacherSig}
                    alt="توقيع المعلمة"
                    className="h-9 max-w-[110px] object-contain drop-shadow-2xs"
                  />
                  <span className="text-[9px] text-emerald-700 font-semibold">توقيع معتمد ✅</span>
                </div>
              ) : (
                <div className="text-[10px] text-stone-400 mt-1">التوقيع المعتمد</div>
              )
            )}
          </div>

          {/* Official Seal */}
          {showSeal && settings.showOfficialSeal !== false && (
            <OfficialSeal
              institutionName={settings.name}
              sealText={settings.sealText}
              sealSubtitle={settings.sealSubtitle}
              sealImageUrl={settings.sealImageUrl}
              leaderName={settings.leaderName}
              color={customPrimaryColor}
              size="md"
            />
          )}

          <div className="flex flex-col items-center sm:items-end min-w-[130px] text-center sm:text-left">
            <div className="text-xs text-stone-500">قائدة مقرأة {settings.name || 'غيث الغيم'}</div>
            <div className="text-sm font-bold text-stone-900 font-quran mt-1">
              {settings.leaderName || 'ريفة المنصوري'}
            </div>
            {showLeaderSig && (
              leaderSig ? (
                <div className="mt-1 flex flex-col items-center sm:items-end">
                  <img
                    src={leaderSig}
                    alt="توقيع القائدة"
                    className="h-9 max-w-[110px] object-contain drop-shadow-2xs"
                  />
                  <span className="text-[9px] text-emerald-700 font-semibold">الاعتماد النهائي ✅</span>
                </div>
              ) : (
                <div className="text-[10px] text-stone-400 mt-1">الاعتماد النهائي</div>
              )
            )}
          </div>
        </div>

        {/* Certificate Issuance & Development Note */}
        <div className="mt-4 pt-3 border-t border-[#E8DFD8]/60 flex flex-col sm:flex-row items-center justify-between text-[11px] text-stone-400 gap-2">
          <div className="flex items-center gap-1.5">
            <span>🛡️</span>
            <span>شهادة إنجاز رسمية موثقة ومعتمدة من إدارة مقرأة {settings.name || 'غيث الغيم'}</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-stone-500 font-mono">
            <span>تطوير النظام:</span>
            <span className="font-bold text-[#8E5364]">بواسطة ياسر التاج · yr_alhosine</span>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 1. DEDICATED CERTIFICATE PREVIEW MODAL (نافذة معاينة الشهادة قبل التصدير) */}
      {/* ========================================================================= */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex flex-col items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[95vh] flex flex-col shadow-2xl border border-stone-200 overflow-hidden">
            
            {/* Modal Top Header */}
            <div className="px-6 py-4 bg-[#FAF7F5] border-b border-[#E8DFD8] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xl">📜</span>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-stone-900 font-quran">
                    معاينة واعتماد شهادة إنجاز: {student.name}
                  </h3>
                  <p className="text-xs text-stone-500">
                    يمكنك تعديل الألوان بحرية، تغيير التاريخ يدوياً، وتحديد الأختام والتواقيع قبل الحفظ
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="w-8 h-8 rounded-full bg-stone-200 hover:bg-stone-300 flex items-center justify-center text-stone-700 transition cursor-pointer"
                title="إغلاق المعاينة"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Controls Toolbar (Free Color Picker + Editable Date + Seal/Signature Options + Export Buttons) */}
            <div className="p-4 sm:p-5 bg-white border-b border-[#E8DFD8] space-y-4 shrink-0 overflow-y-auto max-h-[40vh]">
              
              {/* Row 1: Free Color Picker & Editable Date */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                
                {/* Editable Date Input */}
                <div className="lg:col-span-5 bg-[#FAF6F2] p-3 rounded-2xl border border-[#E8DFD8]">
                  <label className="block text-xs font-bold text-stone-700 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#8E5364]" />
                    <span>تاريخ الشهادة والاعتماد (قابل للتعديل يدوي):</span>
                  </label>
                  <input
                    type="text"
                    value={customCertDate}
                    onChange={e => setCustomCertDate(e.target.value)}
                    placeholder="مثال: ربيع الآخر - جمادى الأولى ١٤٤٦هـ"
                    className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-[#8E5364]"
                  />
                  <span className="text-[10px] text-stone-400 mt-1 block">
                    يمكنك كتابة أي تاريخ هجري أو عبارة تريدين ظهورها على الشهادة
                  </span>
                </div>

                {/* Free Color Picker Tool */}
                <div className="lg:col-span-7 bg-[#FAF6F2] p-3 rounded-2xl border border-[#E8DFD8] space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-[#8E5364]" />
                      <span>اختيار اللون الحر للشهادة:</span>
                    </label>
                    <button
                      onClick={handleSaveColorsToSettings}
                      className="text-[10px] text-[#8E5364] hover:underline font-bold"
                      title="حفظ اللون الحالي للمقرأة بالكامل"
                    >
                      حفظ كهوية افتراضية 💾
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {/* Primary Color Picker */}
                    <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-stone-200">
                      <span className="text-[11px] font-bold text-stone-600">الأساسي:</span>
                      <input
                        type="color"
                        value={customPrimaryColor}
                        onChange={e => setCustomPrimaryColor(e.target.value)}
                        className="w-7 h-7 rounded-lg cursor-pointer border-0 bg-transparent p-0"
                        title="اختيار اللون الأساسي بحرية"
                      />
                      <span className="text-[10px] font-mono text-stone-500 uppercase">{customPrimaryColor}</span>
                    </div>

                    {/* Secondary Color Picker */}
                    <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-stone-200">
                      <span className="text-[11px] font-bold text-stone-600">الفرعي:</span>
                      <input
                        type="color"
                        value={customSecondaryColor}
                        onChange={e => setCustomSecondaryColor(e.target.value)}
                        className="w-7 h-7 rounded-lg cursor-pointer border-0 bg-transparent p-0"
                        title="اختيار اللون الفرعي بحرية"
                      />
                      <span className="text-[10px] font-mono text-stone-500 uppercase">{customSecondaryColor}</span>
                    </div>

                    {/* Quick Preset Palette Swatches */}
                    <div className="flex items-center gap-1 flex-wrap">
                      {presetPalettes.map(palette => (
                        <button
                          key={palette.name}
                          onClick={() => {
                            setCustomPrimaryColor(palette.primary);
                            setCustomSecondaryColor(palette.secondary);
                          }}
                          className={`w-6 h-6 rounded-full border-2 transition transform active:scale-90 ${
                            customPrimaryColor === palette.primary ? 'ring-2 ring-stone-800 scale-110' : 'border-white'
                          }`}
                          style={{ backgroundColor: palette.primary }}
                          title={palette.name}
                        />
                      ))}
                    </div>
                  </div>
                </div>

              </div>

              {/* Row 2: Seal and Signature Toggles + Upload + EXPORT BUTTONS ONLY (PDF & HTML) */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-stone-100">
                {/* Toggles */}
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer font-bold text-stone-700 bg-white px-2.5 py-1.5 rounded-xl border border-stone-200 hover:bg-stone-50">
                    <input
                      type="checkbox"
                      checked={showSeal}
                      onChange={e => setShowSeal(e.target.checked)}
                      className="rounded text-[#8E5364] focus:ring-[#8E5364] w-4 h-4 cursor-pointer"
                    />
                    <span>الختم الرسمي</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer font-bold text-stone-700 bg-white px-2.5 py-1.5 rounded-xl border border-stone-200 hover:bg-stone-50">
                    <input
                      type="checkbox"
                      checked={showTeacherSig}
                      onChange={e => setShowTeacherSig(e.target.checked)}
                      className="rounded text-[#8E5364] focus:ring-[#8E5364] w-4 h-4 cursor-pointer"
                    />
                    <span>توقيع المعلمة</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer font-bold text-stone-700 bg-white px-2.5 py-1.5 rounded-xl border border-stone-200 hover:bg-stone-50">
                    <input
                      type="checkbox"
                      checked={showLeaderSig}
                      onChange={e => setShowLeaderSig(e.target.checked)}
                      className="rounded text-[#8E5364] focus:ring-[#8E5364] w-4 h-4 cursor-pointer"
                    />
                    <span>توقيع القائدة</span>
                  </label>

                  <label
                    style={{ backgroundColor: customPrimaryColor }}
                    className="px-2.5 py-1.5 hover:brightness-105 text-white rounded-xl cursor-pointer text-[11px] font-bold transition shadow-xs flex items-center gap-1"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>رفع صورة ختم</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleCustomSealUpload}
                    />
                  </label>

                  {settings.sealImageUrl && (
                    <button
                      onClick={handleRemoveCustomSeal}
                      className="px-2.5 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-xl cursor-pointer text-[11px] font-bold transition flex items-center gap-1"
                      title="حذف صورة الختم والرجوع للختم الافتراضي"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>حذف الختم</span>
                    </button>
                  )}
                </div>

                {/* The Two Export Buttons (PDF & HTML only, No print button) */}
                <div className="flex items-center gap-2 self-stretch sm:self-auto">
                  <button
                    onClick={handleDownloadPdf}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer active:scale-95"
                    title="حفظ الشهادة بتنسيق PDF رسمي قابل للمشاركة والطباعة"
                  >
                    <FileText className="w-4 h-4" />
                    <span>تنزيل بصيغة PDF 📄</span>
                  </button>

                  <button
                    onClick={handleDownloadHtml}
                    style={{ color: customPrimaryColor }}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer active:scale-95"
                    title="تنزيل الشهادة كملف HTML مستقل كامل التنسيقات"
                  >
                    <Download className="w-4 h-4" />
                    <span>تنزيل كـ HTML 🌐</span>
                  </button>
                </div>
              </div>

            </div>

            {/* Modal Body: High Resolution Live Preview */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#FAF7F5] flex justify-center">
              <div
                className="bg-white rounded-3xl border-2 p-6 sm:p-8 shadow-sm space-y-6 max-w-3xl w-full transition-colors duration-200"
                style={{ borderColor: customPrimaryColor }}
              >
                
                {/* Header with Logo and editable Date */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-[#E8DFD8] pb-5 text-center sm:text-right">
                  <div className="flex items-center justify-center sm:justify-start gap-3">
                    {settings.logoUrl ? (
                      <img
                        src={settings.logoUrl}
                        alt="شعار المقرأة"
                        className="w-14 h-14 object-contain rounded-2xl border border-stone-200 p-1 bg-white shadow-2xs"
                      />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-2xs"
                        style={{ backgroundColor: `${customPrimaryColor}15`, border: `1.5px solid ${customPrimaryColor}30` }}
                      >
                        🪴
                      </div>
                    )}
                    <div>
                      <h2 className="text-xl sm:text-2xl font-extrabold text-stone-900 font-quran">
                        مقرأة {settings.name}
                      </h2>
                      <p className="text-xs text-stone-500 font-medium">
                        {settings.subtitle} • {track.name}
                      </p>
                      <p className="text-[11px] text-stone-400">
                        إشراف قائدة المقرأة: <strong>{settings.leaderName}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="text-center sm:text-left bg-[#FCFAF8] p-2.5 rounded-xl border border-[#EFE8E2]">
                    <span className="text-[10px] font-bold text-stone-400 block uppercase">تقرير إنجاز شهري معتمد</span>
                    <div className="text-xs font-bold text-stone-700 mt-0.5">
                      {customCertDate}
                    </div>
                  </div>
                </div>

                {/* Student Banner */}
                <div
                  className="rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border"
                  style={{
                    backgroundColor: `${customPrimaryColor}08`,
                    borderColor: `${customPrimaryColor}25`
                  }}
                >
                  <div>
                    <span className="text-[11px] text-stone-500 block">اسم الطالبة المتميزة:</span>
                    <h3 className="text-2xl font-bold font-quran" style={{ color: customPrimaryColor }}>
                      {student.name}
                    </h3>
                    <p className="text-xs text-stone-500 mt-0.5">
                      الكود: <strong>{student.code}</strong> • حلقة: <strong>{circle?.name}</strong> • المعلمة: <strong>{circle?.teacherName}</strong>
                    </p>
                  </div>
                  <div className="bg-white px-5 py-2.5 rounded-xl border border-stone-200 text-center shrink-0">
                    <span className="text-[10px] text-stone-500 block">النسبة التراكمية</span>
                    <span className="text-2xl font-black" style={{ color: customPrimaryColor }}>{score?.finalPercentage || 0}%</span>
                    <span className="text-[11px] font-bold block" style={{ color: score?.gradeColor || customSecondaryColor }}>
                      {score?.gradeLabel || 'ممتاز'}
                    </span>
                  </div>
                </div>

                {/* Key Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                  <div className="bg-[#FCFAF8] p-2.5 rounded-xl border border-[#EFE8E2]">
                    <span className="text-[10px] text-stone-500 block">نسبة الحضور</span>
                    <strong className="text-sm font-bold" style={{ color: customSecondaryColor }}>{score?.attendanceRate || 0}%</strong>
                    <span className="text-[9px] text-stone-400 block mt-0.5">{score?.presentCount || 0} جلسات</span>
                  </div>
                  <div className="bg-[#FCFAF8] p-2.5 rounded-xl border border-[#EFE8E2]">
                    <span className="text-[10px] text-stone-500 block">أيام الغياب</span>
                    <strong className="text-sm font-bold" style={{ color: totalAbsentDays > 0 ? '#b91c1c' : customSecondaryColor }}>
                      {totalAbsentDays} أيام
                    </strong>
                    <span className="text-[9px] text-stone-400 block mt-0.5">{score?.absentExcusedCount || 0} بعذر</span>
                  </div>
                  <div className="bg-[#FCFAF8] p-2.5 rounded-xl border border-[#EFE8E2]">
                    <span className="text-[10px] text-stone-500 block">الحفظ الجديد</span>
                    <strong className="text-sm font-bold text-stone-900">{doneNewPages} ص</strong>
                    <span className="text-[9px] text-stone-400 block mt-0.5">المستهدف: {targetNewPages} ص</span>
                  </div>
                  <div className="bg-[#FCFAF8] p-2.5 rounded-xl border border-[#EFE8E2]">
                    <span className="text-[10px] text-stone-500 block">المراجعة الصغرى</span>
                    <strong className="text-sm font-bold text-stone-900">{doneMinorRevisionPages} ص</strong>
                  </div>
                  <div className="bg-[#FCFAF8] p-2.5 rounded-xl border border-[#EFE8E2]">
                    <span className="text-[10px] text-stone-500 block">مراجعة التمكين</span>
                    <strong className="text-sm font-bold text-stone-900">{doneTamkeenPages} ص</strong>
                    <span className="text-[9px] text-stone-400 block mt-0.5">المستهدف: {targetRevPages} ص</span>
                  </div>
                  <div className="bg-[#FCFAF8] p-2.5 rounded-xl border border-[#EFE8E2]">
                    <span className="text-[10px] text-stone-500 block">الترتيب في الحلقة</span>
                    <strong className="text-sm font-bold" style={{ color: customPrimaryColor }}>المركز #{score?.rankInCircle || 1}</strong>
                    <span className="text-[9px] text-stone-400 block mt-0.5">حلقة {circle?.name}</span>
                  </div>
                </div>

                {/* Table Overview */}
                <div className="border border-stone-200 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-[#FAF7F5] border-b border-stone-200 font-bold text-stone-700">
                        <th className="p-2.5">المعيار</th>
                        <th className="p-2.5">المقرر المستهدف</th>
                        <th className="p-2.5">المنجز الفعلي</th>
                        <th className="p-2.5">الدرجة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 text-stone-600">
                      <tr>
                        <td className="p-2.5 font-bold text-stone-900">الحضور والانضباط</td>
                        <td className="p-2.5">حضور الجلسات المقررة</td>
                        <td className="p-2.5">حضور {score?.attendanceRate || 0}% • غياب {totalAbsentDays} أيام</td>
                        <td className="p-2.5 font-bold" style={{ color: customSecondaryColor }}>{score?.attendanceScore || 10} / 10</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-stone-900">الحفظ الجديد</td>
                        <td className="p-2.5">{targetNewPages} صفحات</td>
                        <td className="p-2.5">{doneNewPages} صفحات</td>
                        <td className="p-2.5 font-bold" style={{ color: customPrimaryColor }}>{score?.memorizationScore || 10} / 10</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-stone-900">المراجعة الصغرى</td>
                        <td className="p-2.5">حسب برنامج اليوم</td>
                        <td className="p-2.5">{doneMinorRevisionPages} صفحات</td>
                        <td className="p-2.5">—</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-stone-900">مراجعة التمكين</td>
                        <td className="p-2.5">{targetRevPages} صفحات</td>
                        <td className="p-2.5">{doneTamkeenPages} صفحات</td>
                        <td className="p-2.5 text-emerald-700 font-bold">متقن بالشروط ✅</td>
                      </tr>
                      {doneUnclassifiedRevisionPages > 0 && (
                        <tr>
                          <td className="p-2.5 font-bold text-amber-700">مراجعة مسجلة دون تفصيل</td>
                          <td className="p-2.5">—</td>
                          <td className="p-2.5">{doneUnclassifiedRevisionPages} صفحات</td>
                          <td className="p-2.5">سجلات سابقة</td>
                        </tr>
                      )}
                      <tr>
                        <td className="p-2.5 font-bold text-stone-900">واجبات التجويد «أتقني»</td>
                        <td className="p-2.5">استخراج وتطبيق الأحكام</td>
                        <td className="p-2.5">{score?.atqiniCompletedCount || 1} واجب منجز</td>
                        <td className="p-2.5 font-bold" style={{ color: customPrimaryColor }}>{score?.atqiniScore || 10} / 10</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-stone-900">التحديات والمراجعة الثنائية</td>
                        <td className="p-2.5">مع الرفيقة القرآنية</td>
                        <td className="p-2.5">منجز بتميز ⭐</td>
                        <td className="p-2.5 font-bold text-amber-800">{score?.challengesScore || 10} / 10</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-stone-900">الاختبار الشهري</td>
                        <td className="p-2.5">اختبار تمكيني شامل</td>
                        <td className="p-2.5">{studentExam ? studentExam.score : 95} درجة</td>
                        <td className="p-2.5 font-bold text-emerald-800">{studentExam ? studentExam.score : 95} / 100</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Footer with Signatures and Seal */}
                <div className="pt-4 border-t-2 border-[#E8DFD8] flex items-center justify-between text-center">
                  <div className="min-w-[100px]">
                    <div className="text-[11px] text-stone-500">معلمة الحلقة</div>
                    <div className="text-xs font-bold text-stone-900 font-quran mt-0.5">
                      أ. {circle?.teacherName || 'معلمة الحلقة'}
                    </div>
                    {showTeacherSig && (
                      teacherSig ? (
                        <img
                          src={teacherSig}
                          alt="توقيع المعلمة"
                          className="h-8 max-w-[90px] object-contain mx-auto mt-1"
                        />
                      ) : (
                        <span className="text-[9px] text-stone-400 block mt-1">(التوقيع معتمد)</span>
                      )
                    )}
                  </div>

                  {showSeal && settings.showOfficialSeal !== false && (
                    <OfficialSeal
                      institutionName={settings.name}
                      sealText={settings.sealText}
                      sealSubtitle={settings.sealSubtitle}
                      sealImageUrl={settings.sealImageUrl}
                      leaderName={settings.leaderName}
                      color={customPrimaryColor}
                      size="sm"
                    />
                  )}

                  <div className="min-w-[100px]">
                    <div className="text-[11px] text-stone-500">قائدة المقرأة</div>
                    <div className="text-xs font-bold text-stone-900 font-quran mt-0.5">
                      {settings.leaderName || 'ريفة المنصوري'}
                    </div>
                    {showLeaderSig && (
                      leaderSig ? (
                        <img
                          src={leaderSig}
                          alt="توقيع القائدة"
                          className="h-8 max-w-[90px] object-contain mx-auto mt-1"
                        />
                      ) : (
                        <span className="text-[9px] text-stone-400 block mt-1">(الاعتماد النهائي)</span>
                      )
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* Modal Bottom Close Bar */}
            <div className="px-6 py-3 bg-stone-100 border-t border-stone-200 flex items-center justify-between shrink-0">
              <span className="text-xs text-stone-500 font-medium">
                تطوير النظام: ياسر التاج · yr_alhosine • مقرأة {settings.name}
              </span>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                إغلاق المعاينة
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. QUICK EDIT STUDENT PLAN & ACHIEVEMENT MODAL (تعديل الخطة والصفحات) */}
      {/* ========================================================================= */}
      {showQuickEditModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-xl border border-stone-200 space-y-4">
            
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-[#8E5364]" />
                <h3 className="text-base font-bold text-stone-900 font-quran">
                  تعديل خطة وإنجاز الطالبة: {student.name}
                </h3>
              </div>
              <button
                onClick={() => setShowQuickEditModal(false)}
                className="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              
              {/* Target & Done Pages for New Memorization */}
              <div className="grid grid-cols-2 gap-3 bg-[#FCFAF8] p-3 rounded-2xl border border-stone-200">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">صفحات الحفظ المستهدفة:</label>
                  <input
                    type="number"
                    min="0"
                    value={quickEditForm.targetPages}
                    onChange={e => setQuickEditForm({ ...quickEditForm, targetPages: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-stone-300 rounded-xl bg-white font-bold text-stone-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">صفحات الحفظ المنجزة بشروط:</label>
                  <input
                    type="number"
                    min="0"
                    value={quickEditForm.actualPages}
                    onChange={e => setQuickEditForm({ ...quickEditForm, actualPages: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-stone-300 rounded-xl bg-white font-bold text-[#8E5364]"
                  />
                </div>
              </div>

              {/* Target & Done Pages for Revision */}
              <div className="grid grid-cols-2 gap-3 bg-[#FCFAF8] p-3 rounded-2xl border border-stone-200">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">صفحات المراجعة المستهدفة:</label>
                  <input
                    type="number"
                    min="0"
                    value={quickEditForm.revisionTargetPages}
                    onChange={e => setQuickEditForm({ ...quickEditForm, revisionTargetPages: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-stone-300 rounded-xl bg-white font-bold text-stone-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">إجمالي صفحات المراجعة المنجزة:</label>
                  <input
                    type="number"
                    min="0"
                    value={quickEditForm.revisionActualPages}
                    onChange={e => setQuickEditForm({ ...quickEditForm, revisionActualPages: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-stone-300 rounded-xl bg-white font-bold text-[#2D5A43]"
                  />
                  <p className="text-[9px] text-stone-500 mt-1">للفصل بين الصغرى والتمكين، استخدمي سجل التسميع اليومي.</p>
                </div>
              </div>

              {/* Monthly Exam Score */}
              <div>
                <label className="block font-bold text-stone-700 mb-1">درجة الاختبار الشهري التمكيني (من ١٠٠):</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={quickEditForm.examScore}
                  onChange={e => setQuickEditForm({ ...quickEditForm, examScore: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 border border-stone-300 rounded-xl bg-white font-bold text-stone-900"
                />
              </div>

              {/* Teacher Remarks & Recommendations */}
              <div>
                <label className="block font-bold text-stone-700 mb-1">توصيات وملاحظات المعلمة والمشرفة:</label>
                <textarea
                  rows={3}
                  value={quickEditForm.notes}
                  onChange={e => setQuickEditForm({ ...quickEditForm, notes: e.target.value })}
                  placeholder="اكتبي توصياتك للطالبة..."
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white text-xs leading-relaxed"
                />
              </div>

            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setShowQuickEditModal(false)}
                className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveQuickEdit}
                className="px-4 py-2 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs font-bold shadow-xs transition"
              >
                حفظ التعديلات والتحديث الفوري ✅
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
