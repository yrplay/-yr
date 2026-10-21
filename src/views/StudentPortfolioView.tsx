import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Printer, Download, Share2, Award, Calendar, CheckCircle2,
  Clock, BookOpen, Sparkles, Trophy, HeartHandshake, FileText,
  UserCheck, Shield, ChevronLeft, Check, FileSignature
} from 'lucide-react';
import { OfficialSeal } from '../components/OfficialSeal';

interface StudentPortfolioViewProps {
  initialStudentId?: string;
  onSelectStudent?: (studentId: string) => void;
}

export const StudentPortfolioView: React.FC<StudentPortfolioViewProps> = ({
  initialStudentId
}) => {
  const {
    students, circles, tracks, users, monthlyPlans, studentPlans,
    dailyRecords, attendanceRecords, studentAtqiniSubmissions,
    studentChallengeSubmissions, studentExamResults,
    allStudentScores, settings, showToast
  } = useApp();

  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    initialStudentId || students[0]?.id || ''
  );

  const student = students.find(s => s.id === selectedStudentId) || students[0];
  const circle = circles.find(c => c.id === student?.circleId);
  const track = tracks.find(t => t.id === student?.trackId) || tracks[0];
  const score = allStudentScores[student?.id];
  const plan = studentPlans.find(sp => sp.studentId === student?.id);
  const currentPlan = monthlyPlans[0];

  // Specific student records
  const studentAtqini = studentAtqiniSubmissions.filter(a => a.studentId === student?.id);
  const studentChallenges = studentChallengeSubmissions.filter(c => c.studentId === student?.id);
  const studentExam = studentExamResults.find(e => e.studentId === student?.id);

  const teacher = users.find(u => u.id === circle?.teacherId);
  const leader = users.find(u => u.role === 'leader');
  const teacherSig = teacher?.signatureUrl;
  const leaderSig = settings.leaderSignatureUrl || leader?.signatureUrl;

  const [printPreviewMode, setPrintPreviewMode] = useState(false);

  const handlePrint = () => {
    if (!student) return;
    try {
      // 1. First trigger standalone download so file is 100% saved on user device
      handleDownloadHtmlCertificate();
      showToast('جاري تجهيز الشهادة المعتمدة وطباعتها... تم حفظ المستند بنجاح 📜', 'success');
      
      // 2. Also attempt window.print() if supported
      setTimeout(() => {
        try {
          window.print();
        } catch (e) {
          console.log('Window print handled via direct HTML certificate export');
        }
      }, 300);
    } catch (err) {
      console.warn('Print handled via direct export', err);
      handleDownloadHtmlCertificate();
    }
  };

  const handleDownloadHtmlCertificate = () => {
    if (!student) return;
    const certHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>شهادة إنجاز - ${student.name} - مقرأة ${settings.name}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Tajawal', sans-serif;
      background: #FAF7F5;
      color: #2D2426;
      padding: 30px;
      direction: rtl;
    }
    .cert-card {
      max-width: 850px;
      margin: 0 auto;
      background: white;
      border: 3px solid #8E5364;
      border-radius: 24px;
      padding: 40px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.06);
      position: relative;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #E8DFD8;
      padding-bottom: 20px;
      margin-bottom: 25px;
    }
    .header h1 {
      font-family: 'Amiri', serif;
      font-size: 32px;
      color: #1c1917;
      margin-bottom: 5px;
    }
    .badge-top {
      background: #F6EEF1;
      color: #8E5364;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: bold;
      border: 1px solid #E2CCD3;
    }
    .student-banner {
      background: linear-gradient(135deg, #FAF2F4, #F0F6F2);
      border: 1px solid #E0D3D7;
      border-radius: 18px;
      padding: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 25px;
    }
    .student-name {
      font-size: 24px;
      font-weight: 800;
      color: #8E5364;
    }
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 25px;
    }
    .stat-box {
      background: #FCFAF8;
      border: 1px solid #EFE8E2;
      border-radius: 14px;
      padding: 12px;
      text-align: center;
    }
    .stat-label { font-size: 11px; color: #78716c; margin-bottom: 4px; }
    .stat-value { font-size: 18px; font-weight: bold; color: #1c1917; }
    .section-title {
      font-size: 15px;
      font-weight: bold;
      color: #1c1917;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .table-custom {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 25px;
      font-size: 12px;
    }
    .table-custom th, .table-custom td {
      border: 1px solid #EAE2DB;
      padding: 10px;
      text-align: right;
    }
    .table-custom th {
      background: #F7EFE9;
      font-weight: bold;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 35px;
      border-top: 2px solid #E8DFD8;
      padding-top: 25px;
    }
    .seal {
      width: 90px;
      height: 90px;
      border-radius: 50%;
      border: 4px double #8E5364;
      color: #8E5364;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: bold;
      transform: rotate(-6deg);
    }
    @media print {
      body { background: white; padding: 0; }
      .cert-card { box-shadow: none; border-width: 2px; }
      .no-print-btn { display: none !important; }
    }
  </style>
</head>
<body>
  <div style="text-align: center; margin-bottom: 20px;" class="no-print-btn">
    <button onclick="window.print()" style="padding: 10px 24px; background: #8E5364; color: white; border: none; border-radius: 12px; font-size: 14px; font-weight: bold; cursor: pointer;">
      🖨️ طباعة الشهادة أو حفظ كـ PDF الآن
    </button>
  </div>
  <div class="cert-card">
    <div class="header">
      <div>
        <h1>مقرأة ${settings.name}</h1>
        <p style="font-size: 13px; color: #78716c;">${settings.subtitle} • ${track.name}</p>
        <p style="font-size: 12px; color: #a8a29e;">إشراف قائدة المقرأة: <strong>${settings.leaderName}</strong></p>
      </div>
      <div style="text-align: left;">
        <span class="badge-top">تقرير إنجاز شهري معتمد</span>
        <p style="font-size: 11px; color: #a8a29e; margin-top: 5px;">${settings.currentHijriMonth} - ${settings.academicYear}</p>
      </div>
    </div>

    <div class="student-banner">
      <div>
        <div style="font-size: 12px; color: #78716c; margin-bottom: 2px;">اسم الطالبة:</div>
        <div class="student-name">${student.name}</div>
        <div style="font-size: 12px; color: #78716c; margin-top: 4px;">
          الكود: <strong>${student.code}</strong> • حلقة: <strong>${circle?.name}</strong> • المعلمة: <strong>${circle?.teacherName}</strong>
        </div>
      </div>
      <div style="text-align: center; background: white; padding: 12px 20px; border-radius: 14px; border: 1px solid #E5D5D9;">
        <div style="font-size: 11px; color: #78716c;">النسبة المئوية والتقدير</div>
        <div style="font-size: 26px; font-weight: 900; color: #8E5364;">${score?.finalPercentage || 0}%</div>
        <div style="font-size: 12px; font-weight: bold; color: ${score?.gradeColor || '#2D5A43'};">${score?.gradeLabel || 'ممتاز'}</div>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-box">
        <div class="stat-label">نسبة الحضور</div>
        <div class="stat-value" style="color: #2D5A43;">${score?.attendanceRate || 0}%</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">الحفظ الجديد المنجز</div>
        <div class="stat-value">${score?.newMemorizationPagesDone || 0} ص</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">المراجعة والتمكين</div>
        <div class="stat-value">${score?.revisionPagesDone || 0} ص</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">الترتيب في الحلقة</div>
        <div class="stat-value" style="color: #8E5364;">المركز ${score?.rankInCircle || 1}</div>
      </div>
    </div>

    <div class="section-title">تفاصيل الأداء التراكمي:</div>
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
          <td><strong>الحفظ الجديد</strong></td>
          <td>${plan?.newMemorization.targetPages || 8} صفحات</td>
          <td>${score?.newMemorizationPagesDone || 8} صفحات</td>
          <td>${score?.memorizationScore || 10} / 10</td>
        </tr>
        <tr>
          <td><strong>المراجعة اليومية والتمكين</strong></td>
          <td>${plan?.revision.targetPages || 4} صفحات</td>
          <td>${score?.revisionPagesDone || 4} صفحات</td>
          <td>متقن بالشروط ✅</td>
        </tr>
        <tr>
          <td><strong>واجبات «أتقني» للتجويد</strong></td>
          <td>تطبيق أحكام التجويد</td>
          <td>${score?.atqiniCompletedCount || 1} واجب</td>
          <td>${score?.atqiniScore || 10} / 10</td>
        </tr>
        <tr>
          <td><strong>التحديات والمراجعة الثنائية</strong></td>
          <td>مع الرفيقة: ${student.partnerStudentName || 'الرفيقة المعتمدة'}</td>
          <td>منجز بتميز ⭐</td>
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

    <div style="background: #FCFAF8; padding: 14px; border-radius: 12px; border: 1px solid #EFE8E2; margin-bottom: 20px;">
      <div style="font-size: 11px; font-weight: bold; color: #78716c; margin-bottom: 4px;">توصيات وملاحظات المعلمة:</div>
      <div style="font-size: 13px; font-style: italic; color: #44403c;">
        "${student.notes || 'طالبة متميزة أظهرت التزاماً راسخاً في الحفظ والتجويد والمراجعة الثنائية. نبارك لها هذا الرسوخ والإنجاز.'}"
      </div>
    </div>

    <div class="footer">
      <div style="text-align: center; min-width: 130px;">
        <div style="font-size: 12px; color: #78716c;">معلمة الحلقة</div>
        <div style="font-size: 15px; font-weight: bold; margin-top: 4px;">أ. ${circle?.teacherName || 'معلمة الحلقة'}</div>
        ${teacherSig ? `<img src="${teacherSig}" alt="توقيع المعلمة" style="height: 38px; max-width: 110px; object-fit: contain; margin: 4px auto; display: block;" />` : `<div style="font-size: 10px; color: #a8a29e; margin-top: 6px;">(التوقيع معتمد بالنظام)</div>`}
      </div>

      <div style="text-align: center;">
        ${settings.sealImageUrl ? `
          <img src="${settings.sealImageUrl}" alt="الختم الرسمي" style="width: 82px; height: 82px; object-fit: contain; transform: rotate(-5deg); filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));" />
        ` : `
          <div class="seal">
            <span>مقرأة</span>
            <span style="font-size: 13px; font-family: 'Amiri';">${settings.name || 'غيث الغيم'}</span>
            <span style="font-size: 8px;">${settings.sealText || 'ختم الاعتماد الرسمي'}</span>
          </div>
        `}
      </div>

      <div style="text-align: center; min-width: 130px;">
        <div style="font-size: 12px; color: #78716c;">قائدة مقرأة ${settings.name || 'غيث الغيم'}</div>
        <div style="font-size: 15px; font-weight: bold; margin-top: 4px;">${settings.leaderName || 'ريفة المنصوري'}</div>
        ${leaderSig ? `<img src="${leaderSig}" alt="توقيع القائدة" style="height: 38px; max-width: 110px; object-fit: contain; margin: 4px auto; display: block;" />` : `<div style="font-size: 10px; color: #a8a29e; margin-top: 6px;">(الاعتماد النهائي)</div>`}
      </div>
    </div>
    <div style="margin-top: 14px; text-align: center; font-size: 10px; color: #a8a29e; font-family: sans-serif;">
      تم الإصدار والتوثيق عبر منصة غيث الغيم الإدارية • تطوير: ياسر التاج · yr_alhosine
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([certHtml], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `شهادة_إنجاز_${student.name.replace(/\s+/g, '_')}_غيث_الغيم.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!student) {
    return <div className="p-8 text-center text-stone-500">لا توجد طالبة محددة</div>;
  }

  return (
    <div className="space-y-6">

      {/* Selector & Actions Bar (Hidden when printing) */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-[#E8DFD8] shadow-2xs">
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

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDownloadHtmlCertificate}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-[#FAF0F3] hover:bg-[#F2DFE5] text-[#8E5364] border border-[#E2CBD2] rounded-xl text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
            title="تنزيل ملف شهادة الإنجاز بصيغة مستقلة يمكن فتحها وطباعتها أو حفظها كـ PDF مباشرة على أي جهاز"
          >
            <Download className="w-4 h-4" />
            <span>حفظ وتنزيل الشهادة (HTML / PDF)</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة الشهادة مباشرة</span>
          </button>
        </div>
      </div>

      {/* Official Certificate & Portfolio Document Card (Printable Area) */}
      <div className="bg-white rounded-3xl border-2 border-[#E8DFD8] p-6 sm:p-10 shadow-sm space-y-8 relative overflow-hidden print:border-none print:shadow-none print:p-0">
        
        {/* Certificate Frame Pattern Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-[#E8DFD8] pb-6 text-center sm:text-right">
          <div className="flex items-center justify-center sm:justify-start gap-3">
            <div className="w-14 h-14 rounded-2xl bg-[#F6EEF1] border border-[#E0D0D4] flex items-center justify-center text-3xl">
              🪴
            </div>
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
            <div className="text-sm font-extrabold text-[#8E5364]">
              {currentPlan?.title || 'خطة شهر ربيع الآخر وجمادى الأولى ١٤٤٦هـ'}
            </div>
            <div className="text-[10px] text-stone-400 mt-0.5">
              تاريخ الاعتماد: {currentPlan?.examDateHijri || '٢٥ جمادى الأولى'}
            </div>
          </div>
        </div>

        {/* Student Metadata Header */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#FCFAF8] p-4 rounded-2xl border border-[#EFE8E2] text-xs">
          <div>
            <span className="text-stone-400 block text-[10px]">اسم الطالبة:</span>
            <strong className="text-stone-900 text-sm font-quran">{student.name}</strong>
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
        </div>

        {/* Big Achievement Honor Badge Banner */}
        <div className="rounded-3xl p-6 text-white text-center sm:text-right relative overflow-hidden shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
             style={{ backgroundColor: score?.gradeColor || '#2D5A43' }}>
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
          <div className="p-4 rounded-2xl border border-[#E8DFD8] bg-white space-y-2.5">
            <h4 className="font-bold text-stone-900 text-sm flex items-center gap-2 border-b border-stone-100 pb-2">
              <BookOpen className="w-4 h-4 text-[#8E5364]" />
              <span>إنجاز خطة الحفظ والمراجعة</span>
            </h4>
            <div className="space-y-1.5 text-stone-600">
              <div className="flex justify-between">
                <span>الحفظ الجديد المنجز:</span>
                <strong className="text-stone-900">{score?.newMemorizationPagesDone} من {score?.newMemorizationPagesTarget} صفحات</strong>
              </div>
              <div className="flex justify-between">
                <span>المراجعة اليومية والتمكين:</span>
                <strong className="text-stone-900">{score?.revisionPagesDone} صفحات ({plan?.revision?.revisionType || 'تمكين'})</strong>
              </div>
              <div className="flex justify-between">
                <span>أخطاء الحفظ المرصودة:</span>
                <strong className="text-rose-700">{score?.memorizationMistakesTotal} أخطاء</strong>
              </div>
              <div className="flex justify-between">
                <span>التنبيهات والأخطاء التجويدية:</span>
                <strong className="text-stone-900">{score?.hintsTotal} تنبيه • {score?.tajweedErrorsTotal} تجويد</strong>
              </div>
              <div className="flex justify-between pt-1 border-t border-stone-100 font-bold text-stone-900">
                <span>درجة الحفظ والتمكين:</span>
                <span className="text-[#8E5364]">{score?.memorizationScore} / {score?.memorizationMax} نقطة</span>
              </div>
            </div>
          </div>

          {/* Section 2: Attendance & Early Prep */}
          <div className="p-4 rounded-2xl border border-[#E8DFD8] bg-white space-y-2.5">
            <h4 className="font-bold text-stone-900 text-sm flex items-center gap-2 border-b border-stone-100 pb-2">
              <Clock className="w-4 h-4 text-[#2D5A43]" />
              <span>الحضور والانضباط والتحضير المبكر</span>
            </h4>
            <div className="space-y-1.5 text-stone-600">
              <div className="flex justify-between">
                <span>نسبة الحضور التراكمية:</span>
                <strong className="text-[#2D5A43]">{score?.attendanceRate}%</strong>
              </div>
              <div className="flex justify-between">
                <span>عدد أيام الحضور الفعلي:</span>
                <strong className="text-stone-900">{score?.presentCount} جلسات</strong>
              </div>
              <div className="flex justify-between">
                <span>الغياب (دون عذر / بعذر):</span>
                <strong className="text-stone-900">{score?.absentUnexcusedCount} دون عذر • {score?.absentExcusedCount} بعذر</strong>
              </div>
              <div className="flex justify-between">
                <span>بطاقات التحضير المبكر ⭐:</span>
                <strong className="text-amber-800">{score?.earlyPrepCount} بطاقات في الموعد</strong>
              </div>
              <div className="flex justify-between pt-1 border-t border-stone-100 font-bold text-stone-900">
                <span>درجة الحضور والانضباط:</span>
                <span className="text-[#2D5A43]">{score?.attendanceScore} / {score?.attendanceMax} نقطة</span>
              </div>
            </div>
          </div>

          {/* Section 3: Atqini (Tajweed) */}
          <div className="p-4 rounded-2xl border border-[#E8DFD8] bg-white space-y-2.5">
            <h4 className="font-bold text-stone-900 text-sm flex items-center gap-2 border-b border-stone-100 pb-2">
              <Sparkles className="w-4 h-4 text-[#8E5364]" />
              <span>واجبات «أتقني» للتجويد</span>
            </h4>
            <div className="space-y-1.5 text-stone-600">
              <div className="flex justify-between">
                <span>الواجبات المنجزة:</span>
                <strong className="text-stone-900">{score?.atqiniCompletedCount} واجبات مكتملة</strong>
              </div>
              <div className="flex justify-between">
                <span>استخراج الأمثلة من المحفوظ:</span>
                <strong className="text-emerald-700">متقن ✅</strong>
              </div>
              <div className="flex justify-between">
                <span>تطبيق الأحكام أثناء التسميع:</span>
                <strong className="text-emerald-700">ممتاز ✅</strong>
              </div>
              <div className="flex justify-between pt-1 border-t border-stone-100 font-bold text-stone-900">
                <span>درجة التجويد «أتقني»:</span>
                <span className="text-[#8E5364]">{score?.atqiniScore} / {score?.atqiniMax} نقطة</span>
              </div>
            </div>
          </div>

          {/* Section 4: Challenges & Peer Review */}
          <div className="p-4 rounded-2xl border border-[#E8DFD8] bg-white space-y-2.5">
            <h4 className="font-bold text-stone-900 text-sm flex items-center gap-2 border-b border-stone-100 pb-2">
              <Trophy className="w-4 h-4 text-amber-600" />
              <span>تحدي الخميس والمراجعة الثنائية 🤝</span>
            </h4>
            <div className="space-y-1.5 text-stone-600">
              <div className="flex justify-between">
                <span>المراجعة المشتركة مع الرفيقة:</span>
                <strong className="text-stone-900">إنجاز تام وتعاون مثمر</strong>
              </div>
              <div className="flex justify-between">
                <span>اكتشاف وتصحيح الأخطاء:</span>
                <strong className="text-stone-900">متقن وفق الضوابط</strong>
              </div>
              <div className="flex justify-between">
                <span>نقاط المراجعة الثنائية:</span>
                <strong className="text-[#7A4B37]">+{score?.peerReviewScore} نقاط</strong>
              </div>
              <div className="flex justify-between pt-1 border-t border-stone-100 font-bold text-stone-900">
                <span>مجموع درجات التحديات:</span>
                <span className="text-amber-800">{score?.challengesScore} / {score?.challengesMax} نقطة</span>
              </div>
            </div>
          </div>

        </div>

        {/* Section 5: Monthly Exam & Teacher Remark */}
        <div className="p-4 rounded-2xl bg-[#FCFAF8] border border-[#EFE8E2] space-y-3 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200 pb-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#2D5A43]" />
              <span className="font-bold text-stone-900">نتيجة الاختبار الشهري التمكيني:</span>
            </div>
            <div className="text-sm font-extrabold text-[#2D5A43]">
              {studentExam ? `${studentExam.score} من ١٠٠ درجة` : 'بانتظار الرصد في الموعد المحدد'}
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
            {teacherSig ? (
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
            )}
          </div>

          {/* Official Seal - Dynamic or Custom Uploaded from Device */}
          <OfficialSeal
            institutionName={settings.name}
            sealText={settings.sealText}
            sealSubtitle={settings.sealSubtitle}
            sealImageUrl={settings.sealImageUrl}
            leaderName={settings.leaderName}
            color={settings.primaryColor || '#8E5364'}
            size="md"
          />

          <div className="flex flex-col items-center sm:items-end min-w-[130px] text-center sm:text-left">
            <div className="text-xs text-stone-500">قائدة مقرأة {settings.name || 'غيث الغيم'}</div>
            <div className="text-sm font-bold text-stone-900 font-quran mt-1">
              {settings.leaderName || 'ريفة المنصوري'}
            </div>
            {leaderSig ? (
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

    </div>
  );
};
