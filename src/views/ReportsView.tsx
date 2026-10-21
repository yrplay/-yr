import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  BarChart3, Download, Printer, Filter, Calendar, Users,
  CheckCircle2, AlertTriangle, Award, FileSpreadsheet, Sparkles
} from 'lucide-react';

export const ReportsView: React.FC = () => {
  const {
    students, circles, tracks, attendanceRecords, dailyRecords,
    studentAtqiniSubmissions, studentChallengeSubmissions, studentExamResults,
    allStudentScores, settings, showToast
  } = useApp();

  const [reportType, setReportType] = useState<string>('comprehensive_scores');
  const [selectedCircleId, setSelectedCircleId] = useState<string>('all');
  const [selectedTrackId, setSelectedTrackId] = useState<string>('all');

  const filteredStudents = students.filter(s => {
    if (selectedCircleId !== 'all' && s.circleId !== selectedCircleId) return false;
    if (selectedTrackId !== 'all' && s.trackId !== selectedTrackId) return false;
    return s.status === 'active';
  });

  // Export table data to CSV
  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];

    if (reportType === 'comprehensive_scores') {
      headers = ['الكود', 'اسم الطالبة', 'الحلقة', 'المعلمة', 'الرفيقة', 'نسبة الحضور', 'حفظ منجز (ص)', 'مراجعة (ص)', 'أتقني', 'التحديات', 'الاختبار', 'المجموع', 'النسبة المئوية', 'التقدير', 'الترتيب'];
      rows = filteredStudents.map(s => {
        const score = allStudentScores[s.id];
        const circle = circles.find(c => c.id === s.circleId);
        return [
          s.code,
          s.name,
          circle?.name || '',
          circle?.teacherName || '',
          s.partnerStudentName || '—',
          `${score?.attendanceRate || 0}%`,
          score?.newMemorizationPagesDone || 0,
          score?.revisionPagesDone || 0,
          score?.atqiniScore || 0,
          score?.challengesScore || 0,
          score?.examScore || 0,
          score?.totalEarnedPoints || 0,
          `${score?.finalPercentage || 0}%`,
          score?.gradeLabel || '',
          score?.rankInCircle || 1
        ];
      });
    } else if (reportType === 'attendance') {
      headers = ['الكود', 'اسم الطالبة', 'الحلقة', 'أيام الحضور', 'غياب دون عذر', 'غياب بعذر', 'نسبة الحضور', 'بطاقات مبكرة'];
      rows = filteredStudents.map(s => {
        const score = allStudentScores[s.id];
        const circle = circles.find(c => c.id === s.circleId);
        return [
          s.code,
          s.name,
          circle?.name || '',
          score?.presentCount || 0,
          score?.absentUnexcusedCount || 0,
          score?.absentExcusedCount || 0,
          `${score?.attendanceRate || 0}%`,
          score?.earlyPrepCount || 0
        ];
      });
    } else {
      headers = ['الكود', 'اسم الطالبة', 'الحلقة', 'المقرر', 'الأخطاء', 'التنبيهات', 'درجة التسميع'];
      rows = filteredStudents.map(s => {
        const score = allStudentScores[s.id];
        const circle = circles.find(c => c.id === s.circleId);
        return [
          s.code,
          s.name,
          circle?.name || '',
          `${score?.newMemorizationPagesDone} ص`,
          score?.memorizationMistakesTotal || 0,
          score?.hintsTotal || 0,
          score?.memorizationScore || 0
        ];
      });
    }

    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map(row => row.map(v => `"${v}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Ghaith_Report_${reportType}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    try {
      showToast('جاري فتح خيارات الطباعة وتصدير التقرير... 🖨️', 'success');
      setTimeout(() => {
        try {
          window.print();
        } catch (e) {
          handleExportCSV();
        }
      }, 250);
    } catch {
      handleExportCSV();
    }
  };

  return (
    <div className="space-y-6">

      {/* Header Bar */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-[#E8DFD8] shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">📊</span>
            <h2 className="text-xl font-bold text-stone-900 font-quran">التقارير والإحصائيات والتحليلات</h2>
          </div>
          <p className="text-xs text-stone-500">
            استخراج تقارير الحضور، الإنجاز، التجويد، التحديات، والدرجات الشاملة بصيغة Excel أو الطباعة
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#FAF6F2] hover:bg-[#F2ECE6] text-[#744251] border border-[#E2D5CC] rounded-xl text-xs font-bold transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>تصدير إلى Excel (CSV)</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs font-bold shadow-xs transition"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة التقرير</span>
          </button>
        </div>
      </div>

      {/* Report Filter Controls */}
      <div className="no-print bg-white p-4 rounded-3xl border border-[#E8DFD8] shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          
          {/* Report Type Selector */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">نوع التقرير المطلوب:</label>
            <select
              value={reportType}
              onChange={e => setReportType(e.target.value)}
              className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-[#8E5364]"
            >
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

          {/* Circle Filter */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">تصفية بحسب الحلقة:</label>
            <select
              value={selectedCircleId}
              onChange={e => setSelectedCircleId(e.target.value)}
              className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-[#8E5364]"
            >
              <option value="all">جميع الحلقات ({circles.length})</option>
              {circles.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Track Filter */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">تصفية بحسب المسار:</label>
            <select
              value={selectedTrackId}
              onChange={e => setSelectedTrackId(e.target.value)}
              className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-[#8E5364]"
            >
              <option value="all">جميع المسارات</option>
              {tracks.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

        </div>
      </div>

      {/* Printable Report Document Card */}
      <div className="bg-white rounded-3xl border border-[#E8DFD8] p-6 sm:p-8 shadow-2xs space-y-6 print:border-none print:p-0">
        
        {/* Printable Official Report Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-stone-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🪴</span>
              <h3 className="text-xl font-bold text-stone-900 font-quran">
                مقرأة {settings.name} — مسار {tracks[0]?.name || 'مشكاة الغيم'}
              </h3>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              إشراف قائدة المقرأة: <strong>{settings.leaderName}</strong> • {settings.academicYear}
            </p>
          </div>

          <div className="text-left">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#FAF2F4] text-[#8E5364] border border-[#EBD5DC] inline-block">
              {reportType === 'comprehensive_scores' ? 'التقرير الشامل للدرجات والنسب' : 'تقرير إداري رسمي'}
            </span>
            <div className="text-[10px] text-stone-400 mt-1">
              تاريخ الاستخراج: {new Date().toLocaleDateString('ar-SA')}
            </div>
          </div>
        </div>

        {/* Report Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-[#FAF6F2] text-stone-700 font-bold border-b border-stone-200">
                <th className="p-3">#</th>
                <th className="p-3">كود الطالبة</th>
                <th className="p-3">اسم الطالبة</th>
                <th className="p-3">الحلقة والمعلمة</th>
                <th className="p-3">الرفيقة 🤝</th>
                <th className="p-3 text-center">نسبة الحضور</th>
                <th className="p-3 text-center">الحفظ والمراجعة</th>
                <th className="p-3 text-center">أتقني</th>
                <th className="p-3 text-center">التحديات</th>
                <th className="p-3 text-center font-bold">النسبة المئوية</th>
                <th className="p-3 text-center">التقدير والترتيب</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredStudents.map((student, idx) => {
                const score = allStudentScores[student.id];
                const circle = circles.find(c => c.id === student.circleId);

                return (
                  <tr key={student.id} className="hover:bg-[#FCF9FA] transition">
                    <td className="p-3 font-semibold text-stone-400">{idx + 1}</td>
                    <td className="p-3 font-mono text-[11px] text-stone-500">{student.code}</td>
                    <td className="p-3 font-bold text-stone-900">{student.name}</td>
                    <td className="p-3 text-stone-600">
                      <div>{circle?.name}</div>
                      <div className="text-[10px] text-stone-400">أ. {circle?.teacherName}</div>
                    </td>
                    <td className="p-3 text-[#7A4B37] font-medium">
                      {student.partnerStudentName || '—'}
                    </td>
                    <td className="p-3 text-center">
                      <span className="font-bold text-[#2D5A43]">{score?.attendanceRate}%</span>
                      <span className="block text-[10px] text-stone-400">({score?.earlyPrepCount} مبكر ⭐)</span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="font-semibold text-stone-800">{score?.newMemorizationPagesDone} ص</span>
                      <span className="block text-[10px] text-stone-400">مراجعة: {score?.revisionPagesDone} ص</span>
                    </td>
                    <td className="p-3 text-center font-bold text-[#8E5364]">
                      {score?.atqiniScore} / {score?.atqiniMax}
                    </td>
                    <td className="p-3 text-center font-bold text-amber-800">
                      {score?.challengesScore} / {score?.challengesMax}
                    </td>
                    <td className="p-3 text-center">
                      <span className="text-sm font-black text-stone-900">
                        {score?.finalPercentage}%
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className="px-2 py-0.5 rounded-full text-[11px] font-bold text-white inline-block shadow-2xs"
                        style={{ backgroundColor: score?.gradeColor || '#2D5A43' }}
                      >
                        {score?.gradeLabel} (#{score?.rankInCircle})
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Official Sign-off on Print */}
        <div className="pt-6 border-t border-stone-200 flex justify-between items-center text-xs text-stone-500">
          <div>مقرأة غيث الغيم • تقرير رسمي معتمد</div>
          <div>اعتماد قائدة المقرأة: {settings.leaderName}</div>
        </div>

      </div>

    </div>
  );
};
