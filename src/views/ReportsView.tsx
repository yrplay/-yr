import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { FileSpreadsheet, Printer } from 'lucide-react';

const REPORT_TITLES: Record<string, string> = {
  comprehensive_scores: 'التقرير الشامل للدرجات والنسب والترتيب',
  attendance: 'تقرير الحضور والغياب والتحضير المبكر',
  memorization: 'تقرير إنجاز الحفظ والمراجعة والأخطاء',
  atqini: 'تقرير واجبات التجويد «أتقني»',
  challenges: 'تقرير نقاط التحديات والمراجعة الثنائية',
  exams: 'تقرير نتائج الاختبارات الشهرية',
  outstanding: 'تقرير نجمات المقرأة المتميزات',
  at_risk: 'تقرير الطالبات بحاجة لمتابعة ورعاية'
};

export const ReportsView: React.FC = () => {
  const {
    students, circles, tracks, attendanceRecords, dailyRecords,
    studentAtqiniSubmissions, studentChallengeSubmissions,
    monthlyExams, studentExamResults, allStudentScores, settings, showToast
  } = useApp();

  const [reportType, setReportType] = useState<string>('comprehensive_scores');
  const [selectedCircleId, setSelectedCircleId] = useState<string>('all');
  const [selectedTrackId, setSelectedTrackId] = useState<string>('all');

  const filteredStudents = students.filter(student => {
    if (selectedCircleId !== 'all' && student.circleId !== selectedCircleId) return false;
    if (selectedTrackId !== 'all' && student.trackId !== selectedTrackId) return false;
    return student.status === 'active';
  });
  const reportTitle = REPORT_TITLES[reportType] || REPORT_TITLES.comprehensive_scores;
  const reportHeaders: string[] = [];
  const reportRows: (string | number)[][] = [];
  const circleById = new Map(circles.map(circle => [circle.id, circle]));
  const studentById = new Map(students.map(student => [student.id, student]));
  const appendStudentHeader = () => reportHeaders.push('الكود', 'اسم الطالبة', 'الحلقة');
  const appendStudent = (student: (typeof students)[number]) => {
    const circle = circleById.get(student.circleId);
    return [student.code || '', student.name, circle?.name || ''];
  };

  if (reportType === 'attendance') {
    appendStudentHeader();
    reportHeaders.push('أيام الحضور', 'غياب دون عذر', 'غياب بعذر', 'نسبة الحضور', 'بطاقات التحضير المبكر');
    filteredStudents.forEach(student => {
      const score = allStudentScores[student.id];
      reportRows.push([
        ...appendStudent(student), score?.presentCount ?? 0, score?.absentUnexcusedCount ?? 0,
        score?.absentExcusedCount ?? 0, `${score?.attendanceRate ?? 0}%`, score?.earlyPrepCount ?? 0
      ]);
    });
  } else if (reportType === 'memorization') {
    appendStudentHeader();
    reportHeaders.push('أيام التسميع المسجلة', 'الحفظ الجديد المنجز (ص)', 'المراجعة المنجزة (ص)', 'درجة التسميع', 'الأخطاء', 'التنبيهات', 'أخطاء التجويد');
    filteredStudents.forEach(student => {
      const score = allStudentScores[student.id];
      const records = dailyRecords.filter(record => record.studentId === student.id);
      reportRows.push([
        ...appendStudent(student), records.length, score?.newMemorizationPagesDone ?? 0,
        score?.revisionPagesDone ?? 0, `${score?.memorizationScore ?? 0} / ${score?.memorizationMax ?? 0}`,
        score?.memorizationMistakesTotal ?? 0, score?.hintsTotal ?? 0, score?.tajweedErrorsTotal ?? 0
      ]);
    });
  } else if (reportType === 'atqini') {
    appendStudentHeader();
    reportHeaders.push('عدد الواجبات', 'المكتملة', 'قيد الإنجاز', 'لم تبدأ', 'درجة أتقني', 'التقييمات المرصودة');
    filteredStudents.forEach(student => {
      const score = allStudentScores[student.id];
      const submissions = studentAtqiniSubmissions.filter(submission => submission.studentId === student.id);
      const ratings = [...new Set(submissions.map(submission => submission.rating).filter(Boolean))].join('، ');
      reportRows.push([
        ...appendStudent(student), submissions.length,
        submissions.filter(submission => submission.status === 'completed' || submission.isCompletedCorrectly).length,
        submissions.filter(submission => submission.status === 'in_progress').length,
        submissions.filter(submission => submission.status === 'not_started').length,
        `${score?.atqiniScore ?? 0} / ${score?.atqiniMax ?? 0}`, ratings
      ]);
    });
  } else if (reportType === 'challenges') {
    appendStudentHeader();
    reportHeaders.push('عدد المشاركات', 'المهام المنجزة', 'مجموع نقاط المشاركات', 'درجة التحديات', 'نقاط المراجعة الثنائية');
    filteredStudents.forEach(student => {
      const score = allStudentScores[student.id];
      const submissions = studentChallengeSubmissions.filter(submission => submission.studentId === student.id);
      const completedTasks = submissions.reduce((sum, submission) =>
        sum + (Array.isArray(submission.tasksCompleted)
          ? submission.tasksCompleted.filter((task: unknown) => !!task && typeof task === 'object' && 'completed' in task && Boolean((task as { completed?: boolean }).completed)).length
          : 0), 0);
      const totalPoints = submissions.reduce((sum, submission) => sum + (submission.totalPointsEarned || 0), 0);
      reportRows.push([
        ...appendStudent(student), submissions.length, completedTasks, totalPoints,
        `${score?.challengesScore ?? 0} / ${score?.challengesMax ?? 0}`, score?.peerReviewScore ?? 0
      ]);
    });
  } else if (reportType === 'exams') {
    reportHeaders.push('الكود', 'اسم الطالبة', 'الحلقة', 'الاختبار', 'المقرر', 'الدرجة', 'الدرجة العظمى', 'نسبة الاختبار', 'أخطاء الحفظ', 'أخطاء التجويد', 'التنبيهات');
    const selectedStudentIds = new Set(filteredStudents.map(student => student.id));
    studentExamResults.filter(result => selectedStudentIds.has(result.studentId)).forEach(result => {
      const student = studentById.get(result.studentId);
      if (!student) return;
      const exam = monthlyExams.find(item => item.id === result.examId);
      const maximum = exam?.maxScore ?? 0;
      reportRows.push([
        ...appendStudent(student), exam?.title || '', result.customPortion || exam?.requiredPortion || '',
        result.score, maximum, maximum > 0 ? `${Math.round((result.score / maximum) * 1000) / 10}%` : '',
        result.memorizationMistakes ?? 0, result.tajweedErrors ?? 0, result.warningsCount ?? 0
      ]);
    });
  } else if (reportType === 'outstanding') {
    appendStudentHeader();
    reportHeaders.push('النسبة النهائية', 'التقدير', 'الترتيب في الحلقة', 'النقاط المحصلة من الإجمالي');
    filteredStudents.filter(student => (allStudentScores[student.id]?.finalPercentage ?? 0) >= 90).forEach(student => {
      const score = allStudentScores[student.id];
      reportRows.push([
        ...appendStudent(student), `${score?.finalPercentage ?? 0}%`, score?.gradeLabel || '',
        score?.rankInCircle ?? '', `${score?.totalEarnedPoints ?? 0} / ${score?.totalPossiblePoints ?? 0}`
      ]);
    });
  } else if (reportType === 'at_risk') {
    appendStudentHeader();
    reportHeaders.push('النسبة النهائية', 'التقدير', 'غياب متكرر', 'لا توجد سجلات حفظ مرصودة', 'السبب المستند إلى السجل');
    filteredStudents.filter(student => {
      const score = allStudentScores[student.id];
      return !!score?.hasFrequentAbsence || !!score?.hasUnrecordedLogs || (score?.finalPercentage ?? 0) < 60;
    }).forEach(student => {
      const score = allStudentScores[student.id];
      const reasons = [
        score?.hasFrequentAbsence ? 'غياب دون عذر متكرر' : '',
        score?.hasUnrecordedLogs ? 'لا توجد سجلات تسميع' : '',
        (score?.finalPercentage ?? 0) < 60 ? 'النسبة أقل من 60%' : ''
      ].filter(Boolean).join('، ');
      reportRows.push([
        ...appendStudent(student), `${score?.finalPercentage ?? 0}%`, score?.gradeLabel || '',
        score?.hasFrequentAbsence ? 'نعم' : 'لا', score?.hasUnrecordedLogs ? 'نعم' : 'لا', reasons
      ]);
    });
  } else {
    appendStudentHeader();
    reportHeaders.push('المعلمة', 'الرفيقة', 'نسبة الحضور', 'حفظ جديد (ص)', 'مراجعة (ص)', 'أتقني', 'التحديات', 'الاختبار', 'النقاط المحصلة', 'النسبة النهائية', 'التقدير', 'الترتيب');
    filteredStudents.forEach(student => {
      const score = allStudentScores[student.id];
      const circle = circleById.get(student.circleId);
      reportRows.push([
        ...appendStudent(student), circle?.teacherName || '', student.partnerStudentName || '—',
        `${score?.attendanceRate ?? 0}%`, score?.newMemorizationPagesDone ?? 0, score?.revisionPagesDone ?? 0,
        `${score?.atqiniScore ?? 0} / ${score?.atqiniMax ?? 0}`,
        `${score?.challengesScore ?? 0} / ${score?.challengesMax ?? 0}`,
        `${score?.examScore ?? 0} / ${score?.examMax ?? 0}`,
        `${score?.totalEarnedPoints ?? 0} / ${score?.totalPossiblePoints ?? 0}`,
        `${score?.finalPercentage ?? 0}%`, score?.gradeLabel || '', score?.rankInCircle ?? ''
      ]);
    });
  }

  const handleExportCSV = () => {
    const csvContent = '\uFEFF' + [
      reportHeaders.map(value => `"${value.replace(/"/g, '""')}"`).join(','),
      ...reportRows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Ghaith_Report_${reportType}_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    showToast(`جاري تجهيز ${reportTitle} للطباعة...`, 'success');
    setTimeout(() => window.print(), 250);
  };

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-[#E8DFD8] shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">📊</span>
            <h2 className="text-xl font-bold text-stone-900 font-quran">التقارير والإحصائيات والتحليلات</h2>
          </div>
          <p className="text-xs text-stone-500">استخراج التقارير وفق البيانات المسجلة. الدرجات والحضور في الملخص الحالي تراكميان ولا يقتصران على شهر محدد.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportCSV} className="flex items-center gap-1.5 px-3.5 py-2 bg-[#FAF6F2] hover:bg-[#F2ECE6] text-[#744251] border border-[#E2D5CC] rounded-xl text-xs font-bold transition">
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>تصدير إلى Excel (CSV)</span>
          </button>
          <button onClick={handlePrint} className="flex items-center gap-1.5 px-3.5 py-2 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs font-bold shadow-xs transition">
            <Printer className="w-4 h-4" />
            <span>طباعة التقرير</span>
          </button>
        </div>
      </div>

      <div className="no-print bg-white p-4 rounded-3xl border border-[#E8DFD8] shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">نوع التقرير المطلوب:</label>
            <select value={reportType} onChange={event => setReportType(event.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-[#8E5364]">
              <option value="comprehensive_scores">التقرير الشامل للدرجات والنسب المئوية والترتيب</option>
              <option value="attendance">تقرير الحضور والغياب والتحضير المبكر</option>
              <option value="memorization">تقرير إنجاز الحفظ والمراجعة والأخطاء</option>
              <option value="atqini">تقرير واجبات التجويد «أتقني»</option>
              <option value="challenges">تقرير نقاط تحدي الخميس والمراجعة الثنائية</option>
              <option value="exams">تقرير نتائج الاختبارات الشهرية</option>
              <option value="outstanding">تقرير نجمات المقرأة المتميزات 🌟</option>
              <option value="at_risk">تقرير الطالبات بحاجة لمتابعة ورعاية</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">تصفية بحسب الحلقة:</label>
            <select value={selectedCircleId} onChange={event => setSelectedCircleId(event.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-[#8E5364]">
              <option value="all">جميع الحلقات ({circles.length})</option>
              {circles.map(circle => <option key={circle.id} value={circle.id}>{circle.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">تصفية بحسب المسار:</label>
            <select value={selectedTrackId} onChange={event => setSelectedTrackId(event.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-[#8E5364]">
              <option value="all">جميع المسارات</option>
              {tracks.map(track => <option key={track.id} value={track.id}>{track.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-[#E8DFD8] p-6 sm:p-8 shadow-2xs space-y-6 print:border-none print:p-0 print:shadow-none">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-stone-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🪴</span>
              <h3 className="text-xl font-bold text-stone-900 font-quran">مقرأة {settings.name} — مسار {tracks.find(track => track.id === selectedTrackId)?.name || (selectedTrackId === 'all' ? 'جميع المسارات' : '')}</h3>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">إشراف قائدة المقرأة: <strong>{settings.leaderName}</strong> • {settings.academicYear}</p>
          </div>
          <div className="text-left">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#FAF2F4] text-[#8E5364] border border-[#EBD5DC] inline-block">{reportTitle}</span>
            <div className="text-[10px] text-stone-400 mt-1">عدد السجلات: {reportRows.length} • تاريخ الاستخراج: {new Date().toLocaleDateString('ar-SA')}</div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-[#FAF6F2] text-stone-700 font-bold border-b border-stone-200">
                <th className="p-3">#</th>
                {reportHeaders.map((header, index) => <th key={`${header}-${index}`} className="p-3 whitespace-nowrap">{header}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {reportRows.map((row, rowIndex) => (
                <tr key={`${reportType}-${rowIndex}`} className="hover:bg-[#FCF9FA] transition">
                  <td className="p-3 font-semibold text-stone-400">{rowIndex + 1}</td>
                  {row.map((value, columnIndex) => <td key={`${rowIndex}-${columnIndex}`} className="p-3 text-stone-700">{value}</td>)}
                </tr>
              ))}
              {reportRows.length === 0 && <tr><td colSpan={reportHeaders.length + 1} className="p-8 text-center text-stone-400">لا توجد بيانات مسجلة لهذا التقرير ضمن المرشحات المحددة.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="pt-6 border-t border-stone-200 flex justify-between items-center text-xs text-stone-500">
          <div>مقرأة غيث الغيم • {reportTitle}</div>
          <div>اعتماد قائدة المقرأة: {settings.leaderName}</div>
        </div>
      </div>
    </div>
  );
};
