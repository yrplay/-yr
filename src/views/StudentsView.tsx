import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Users, Search, Filter, Plus, Edit, Archive, HeartHandshake,
  UserCheck, Shield, Phone, Mail, Award, ArrowUpDown, ChevronLeft,
  Calendar, CheckCircle2, AlertCircle, Trash2, RotateCcw
} from 'lucide-react';
import { hasFullAccess, StudentStatus } from '../types';
import { formatHijriShort, HijriJoinDateSelector } from '../utils/hijriDate';

interface StudentsViewProps {
  onSelectStudent: (studentId: string) => void;
  onOpenQuickModal: (type: string) => void;
}

export const StudentsView: React.FC<StudentsViewProps> = ({
  onSelectStudent,
  onOpenQuickModal
}) => {
  const {
    students, circles, tracks, allStudentScores,
    createStudent, updateStudent, archiveStudent, restoreStudent, deleteStudent, assignPartner,
    currentUser, quickModalAction, clearQuickModal, settings,
    selectedTrackId
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCircleId, setSelectedCircleId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('active');
  const [sortBy, setSortBy] = useState<'name' | 'score' | 'code'>('score');

  // Modals state
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [studentToDelete, setStudentToDelete] = useState<any>(null);
  const [partnerModalOpen, setPartnerModalOpen] = useState(false);
  const [selectedStudentForPartner, setSelectedStudentForPartner] = useState<any>(null);
  const [targetPartnerId, setTargetPartnerId] = useState<string>('');

  // Form state
  const [studentForm, setStudentForm] = useState({
    name: '',
    code: '',
    phone: '',
    email: '',
    trackId: '',
    circleId: '',
    status: 'active' as StudentStatus,
    notes: '',
    joinDate: '1448-01-01'
  });

  // Automatically open modal when quickModalAction is triggered
  React.useEffect(() => {
    if (quickModalAction?.type === 'student') {
      handleOpenStudentModal();
      clearQuickModal();
    }
  }, [quickModalAction]);

  const scopedStudents = students.filter(st => {
    if (selectedTrackId && selectedTrackId !== 'all' && st.trackId !== selectedTrackId) return false;
    if (selectedCircleId !== 'all' && st.circleId !== selectedCircleId) return false;
    return true;
  });
  const activeScopedCount = scopedStudents.filter(st => st.status === 'active' && !st.archived).length;
  const archivedScopedCount = scopedStudents.filter(st => st.status === 'archived' || st.archived).length;

  // Filtered & sorted students
  const filteredStudents = scopedStudents.filter(st => {
    const isArchivedSt = st.status === 'archived' || Boolean(st.archived);
    if (selectedStatus === 'active' && (st.status !== 'active' || isArchivedSt)) return false;
    if (selectedStatus === 'archived' && !isArchivedSt) return false;
    if (selectedStatus !== 'all' && selectedStatus !== 'active' && selectedStatus !== 'archived' && st.status !== selectedStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = st.name.toLowerCase().includes(q);
      const matchCode = st.code.toLowerCase().includes(q);
      const matchPhone = st.phone?.includes(q);
      if (!matchName && !matchCode && !matchPhone) return false;
    }
    return true;
  }).sort((a, b) => {
    if (sortBy === 'score') {
      const scoreA = allStudentScores[a.id]?.finalPercentage || 0;
      const scoreB = allStudentScores[b.id]?.finalPercentage || 0;
      return scoreB - scoreA;
    }
    if (sortBy === 'name') return a.name.localeCompare(b.name, 'ar');
    return a.code.localeCompare(b.code);
  });

  const handleOpenStudentModal = (student?: any) => {
    if (student) {
      const circle = circles.find(c => c.id === student.circleId);
      const currentTrackId = student.trackId || circle?.trackId || (selectedTrackId && selectedTrackId !== 'all' ? selectedTrackId : (tracks[0]?.id || 't-1'));
      setEditingStudent(student);
      setStudentForm({
        name: student.name,
        code: student.code,
        phone: student.phone || '',
        email: student.email || '',
        trackId: currentTrackId,
        circleId: student.circleId,
        status: student.status,
        notes: student.notes || '',
        joinDate: student.joinDate || '1448-01-01'
      });
    } else {
      const defaultTrackId = (selectedTrackId && selectedTrackId !== 'all') ? selectedTrackId : (tracks[0]?.id || 't-1');
      const availableCirclesInTrack = circles.filter(c => !c.trackId || c.trackId === defaultTrackId);
      setEditingStudent(null);
      setStudentForm({
        name: '',
        code: `GH-${Math.floor(100 + Math.random() * 900)}`,
        phone: '05',
        email: '',
        trackId: defaultTrackId,
        circleId: availableCirclesInTrack[0]?.id || circles[0]?.id || '',
        status: 'active',
        notes: '',
        joinDate: '1448-01-01'
      });
    }
    setStudentModalOpen(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentForm.name.trim()) return;
    const circle = circles.find(c => c.id === studentForm.circleId);
    const trackId = studentForm.trackId || circle?.trackId || tracks[0]?.id;

    const payload = {
      ...studentForm,
      trackId
    };

    if (editingStudent) {
      await updateStudent(editingStudent.id, payload);
    } else {
      await createStudent(payload);
    }
    setStudentModalOpen(false);
  };

  const handleOpenPartnerModal = (student: any) => {
    setSelectedStudentForPartner(student);
    setTargetPartnerId(student.partnerStudentId || '');
    setPartnerModalOpen(true);
  };

  const handleSavePartner = async () => {
    if (!selectedStudentForPartner || !targetPartnerId) return;
    await assignPartner(selectedStudentForPartner.id, targetPartnerId);
    setPartnerModalOpen(false);
  };

  return (
    <div className="space-y-6">

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-[#E8DFD8] shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">👥</span>
            <h2 className="text-xl font-bold text-stone-900 font-quran">شؤون وسجلات الطالبات</h2>
          </div>
          <p className="text-xs text-stone-500">
            ملفات الطالبات، ربط الرفيقات للمراجعة الثنائية، متابعة الحفظ والنسب المئوية التراكمية
          </p>
        </div>

        <button
          onClick={() => handleOpenStudentModal()}
          style={{ backgroundColor: settings.primaryColor || '#8E5364' }}
          className="flex items-center gap-1.5 px-4 py-2.5 hover:brightness-105 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition self-start sm:self-auto cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>تسجيل طالبة جديدة</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-3xl border border-[#E8DFD8] shadow-2xs space-y-3">
        {/* Prominent Roster vs Archive Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-100">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedStatus('active')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5 ${
                selectedStatus === 'active'
                  ? 'bg-[#8E5364] text-white shadow-2xs'
                  : 'bg-[#FAF6F2] text-stone-700 hover:bg-stone-200/70 border border-stone-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>الطالبات النشطات ({activeScopedCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus('archived')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5 ${
                selectedStatus === 'archived'
                  ? 'bg-[#7B3F30] text-white shadow-2xs'
                  : 'bg-[#F6EFEA] text-[#7B3F30] hover:bg-[#EDE0D6] border border-[#DFCEBF]'
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              <span>قسم الطالبات المؤرشفات ({archivedScopedCount})</span>
            </button>
          </div>
          {selectedStatus === 'archived' && (
            <span className="text-[11px] font-bold text-[#7B3F30] bg-[#F6EFEA] px-3 py-1 rounded-full border border-[#DFCEBF]">
              📁 جميع سجلات التسميع والدرجات وملف الإنجاز محفوظة 100% ويمكن استعادة الطالبة بضغطة واحدة
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="ابحثي بالاسم أو الكود أو الجوال..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-9 py-2 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-[#8E5364]"
            />
            <Search className="w-4 h-4 text-stone-400 absolute right-3 top-2.5 pointer-events-none" />
          </div>

          {/* Circle filter */}
          <div>
            <select
              value={selectedCircleId}
              onChange={e => setSelectedCircleId(e.target.value)}
              className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-[#8E5364]"
            >
              <option value="all">
                {selectedTrackId && selectedTrackId !== 'all'
                  ? `حلقات المسار (${circles.filter(c => !c.isArchived && c.trackId === selectedTrackId).length})`
                  : `جميع الحلقات (${circles.filter(c => !c.isArchived).length})`
                }
              </option>
              {circles
                .filter(c => !c.isArchived && (!selectedTrackId || selectedTrackId === 'all' || c.trackId === selectedTrackId))
                .map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
            </select>
          </div>

          {/* Status filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-[#8E5364]"
            >
              <option value="all">جميع الحالات</option>
              <option value="active">نشطة (منتظمة)</option>
              <option value="suspended">موقوفة مؤقتاً</option>
              <option value="withdrawn">منسحبة</option>
              <option value="archived">مؤرشفة</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-[#8E5364]"
            >
              <option value="score">ترتيب بحسب النسبة والدرجات (الأعلى أولاً)</option>
              <option value="name">ترتيب أبجدي بالاسم</option>
              <option value="code">ترتيب بحسب كود الطالبة</option>
            </select>
          </div>

        </div>

        {/* Counter Summary */}
        <div className="flex items-center justify-between text-xs text-stone-500 pt-1 border-t border-stone-100">
          <span>يتم عرض {filteredStudents.length} من أصل {students.length} طالبة</span>
          <span className="font-semibold text-[#8E5364]">
            {filteredStudents.filter(s => s.partnerStudentId).length} طالبة لديها رفيقة معينة 🤝
          </span>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-3xl border border-[#E8DFD8] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-[#FAF6F2] text-stone-600 font-bold border-b border-stone-200">
                <th className="p-3.5">الكود</th>
                <th className="p-3.5">اسم الطالبة</th>
                <th className="p-3.5">الحلقة والمعلمة</th>
                <th className="p-3.5">الرفيقة (المراجعة الثنائية)</th>
                <th className="p-3.5">إنجاز الحفظ</th>
                <th className="p-3.5">الحضور</th>
                <th className="p-3.5">النسبة المئوية</th>
                <th className="p-3.5">التقدير والترتيب</th>
                <th className="p-3.5">الحالة</th>
                <th className="p-3.5 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredStudents.map((student) => {
                const score = allStudentScores[student.id];
                const circle = circles.find(c => c.id === student.circleId);

                return (
                  <tr key={student.id} className="hover:bg-[#FCF9FA] transition group">
                    <td className="p-3.5 font-mono text-[11px] font-bold text-stone-500">
                      <span className="privacy-phone">{student.code}</span>
                    </td>

                    <td className="p-3.5">
                      <div className="font-bold text-stone-900 text-sm group-hover:text-[#8E5364] transition flex flex-wrap items-center gap-1.5">
                        <span className="privacy-student-name">{student.name}</span>
                        {((score?.absentUnexcusedCount ?? 0) >= 3 || student.status === 'archived' || student.archived) && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-bold">
                            ⚠️ تجاوزت حد الغياب (منقطعة)
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-stone-400">
                        <span className="privacy-phone">{student.phone}</span> {student.joinDate ? `• انضمت: ${formatHijriShort(student.joinDate)}` : ''}
                      </div>
                      {(student.status === 'archived' || student.archived) && student.archivedReason && (
                        <div className="text-[10px] text-rose-700 font-semibold mt-0.5">
                          سبب الأرشفة: {student.archivedReason}
                        </div>
                      )}
                    </td>

                    <td className="p-3.5">
                      <div className="font-semibold text-stone-800">{circle?.name || 'غير محدد'}</div>
                      <div className="text-[11px] text-stone-400">أ. {circle?.teacherName}</div>
                    </td>

                    <td className="p-3.5">
                      {student.partnerStudentName ? (
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 bg-[#F5ECE8] text-[#7A4B37] px-2.5 py-1 rounded-full text-[11px] font-medium">
                            <span>🤝</span>
                            <span className="privacy-student-name">{student.partnerStudentName}</span>
                          </span>
                          <button
                            onClick={() => handleOpenPartnerModal(student)}
                            className="text-stone-400 hover:text-stone-700 p-1 cursor-pointer"
                            title="تغيير الرفيقة"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleOpenPartnerModal(student)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-stone-100 hover:bg-[#F5ECE8] text-stone-600 hover:text-[#7A4B37] text-[11px] font-medium transition cursor-pointer"
                        >
                          <HeartHandshake className="w-3.5 h-3.5" />
                          <span>تعيين رفيقة</span>
                        </button>
                      )}
                    </td>

                    <td className="p-3.5">
                      <div className="font-semibold text-stone-800">
                        <span className="privacy-score-digit">{score?.newMemorizationPagesDone}</span> / {score?.newMemorizationPagesTarget} ص
                      </div>
                      <div className="text-[10px] text-stone-400">
                        مراجعة: <span className="privacy-score-digit">{score?.revisionPagesDone}</span> ص
                      </div>
                    </td>

                    <td className="p-3.5">
                      <div className="font-bold text-[#2D5A43]">
                        <span className="privacy-score-digit">{score?.attendanceRate}%</span>
                      </div>
                      <div className="text-[10px] text-stone-400">
                        <span className="privacy-score-digit">{score?.earlyPrepCount}</span> مبكر ⭐
                      </div>
                    </td>

                    <td className="p-3.5">
                      <div className="font-extrabold text-stone-900 text-sm">
                        <span className="privacy-score-digit">{score?.finalPercentage}%</span>
                      </div>
                      <div className="text-[10px] text-stone-400">
                        <span className="privacy-score-digit">{score?.totalEarnedPoints}</span> / {score?.totalPossiblePoints} نقطة
                      </div>
                    </td>

                    <td className="p-3.5">
                      <span
                        className="px-2.5 py-1 rounded-full text-[11px] font-bold text-white inline-block shadow-2xs transition-colors"
                        style={{ backgroundColor: settings.primaryColor || score?.gradeColor || '#8E5364' }}
                      >
                        {score?.gradeLabel}
                      </span>
                      <div className="text-[10px] text-stone-400 mt-0.5">
                        الترتيب: #{score?.rankInCircle} في الحلقة
                      </div>
                    </td>

                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                        student.status === 'active' && !student.archived
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : student.status === 'suspended'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-[#F6EFEA] text-[#7B3F30] border border-[#DFCEBF]'
                      }`}>
                        {student.status === 'active' && !student.archived
                          ? 'نشطة'
                          : student.status === 'suspended'
                          ? 'موقوفة'
                          : 'مؤرشفة (منقطعة)'}
                      </span>
                    </td>

                    <td className="p-3.5 text-center">
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        {(student.status === 'archived' || student.archived) ? (
                          <button
                            type="button"
                            onClick={() => restoreStudent(student.id)}
                            className="px-3 py-1.5 bg-[#EBF3EE] hover:bg-[#DCEADA] text-[#2D5A43] border border-[#B8D8C5] rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition cursor-pointer shadow-2xs"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>🔄 إلغاء الأرشفة واستعادة للحلقة</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => archiveStudent(student.id, 'نقل إلى قسم المؤرشفات (تجاوز حد الغياب)')}
                            className="px-2.5 py-1 bg-[#F6EFEA] hover:bg-[#7B3F30] text-[#7B3F30] hover:text-white border border-[#DFCEBF] rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition cursor-pointer"
                            title="نقل إلى قسم المؤرشفات"
                          >
                            <Archive className="w-3 h-3" />
                            <span>نقل إلى قسم المؤرشفات</span>
                          </button>
                        )}
                        <button
                          onClick={() => onSelectStudent(student.id)}
                          style={{ backgroundColor: settings.primaryColor || '#8E5364' }}
                          className="px-2.5 py-1 hover:brightness-105 text-white rounded-lg text-[11px] font-bold transition shadow-2xs cursor-pointer active:scale-95"
                          title="عرض ملف الإنجاز والشهادة"
                        >
                          ملف الإنجاز
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenStudentModal(student)}
                          className="p-1.5 text-stone-500 hover:text-[#8E5364] rounded-lg hover:bg-[#FAF0F3] transition cursor-pointer"
                          title="تعديل بيانات الطالبة"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setStudentToDelete(student)}
                          className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                          title="حذف الطالبة"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Student Modal */}
      {studentModalOpen && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-xl border border-stone-200 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-stone-900 text-base font-quran mb-3">
              {editingStudent ? 'تعديل بيانات الطالبة' : 'تسجيل طالبة جديدة في المقرأة'}
            </h3>
            <form onSubmit={handleSaveStudent} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">اسم الطالبة الرباعي *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: منيرة بنت عبد الله الشمري"
                  value={studentForm.name}
                  onChange={e => setStudentForm({ ...studentForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-[#8E5364]"
                />
              </div>

              {/* Track and Halaqah Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">المسار القرآني *</label>
                  <select
                    value={studentForm.trackId}
                    onChange={e => {
                      const newTrackId = e.target.value;
                      const circlesInTrack = circles.filter(c => c.trackId === newTrackId && !c.isArchived);
                      setStudentForm({
                        ...studentForm,
                        trackId: newTrackId,
                        circleId: circlesInTrack[0]?.id || studentForm.circleId
                      });
                    }}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-[#8E5364]"
                  >
                    {tracks.filter(t => !t.isArchived).map(t => (
                      <option key={t.id} value={t.id}>{(t.name || '').replace(/[🪴🤎]/g, '').trim()}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">الحلقة المخصصة *</label>
                  <select
                    value={studentForm.circleId}
                    onChange={e => {
                      const selectedC = circles.find(c => c.id === e.target.value);
                      setStudentForm({
                        ...studentForm,
                        circleId: e.target.value,
                        trackId: selectedC?.trackId || studentForm.trackId
                      });
                    }}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-[#8E5364]"
                  >
                    {circles
                      .filter(c => !c.isArchived && (!studentForm.trackId || c.trackId === studentForm.trackId))
                      .map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.teacherName})</option>
                      ))}
                    {/* Fallback to all circles if current track has none */}
                    {circles.filter(c => !c.isArchived && (!studentForm.trackId || c.trackId === studentForm.trackId)).length === 0 && (
                      circles.filter(c => !c.isArchived).map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.teacherName})</option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">كود الطالبة</label>
                  <input
                    type="text"
                    required
                    value={studentForm.code}
                    onChange={e => setStudentForm({ ...studentForm, code: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">رقم الجوال للتواصل</label>
                  <input
                    type="tel"
                    placeholder="05xxxxxxxx"
                    value={studentForm.phone}
                    onChange={e => setStudentForm({ ...studentForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">حالة القيد</label>
                  <select
                    value={studentForm.status}
                    onChange={e => setStudentForm({ ...studentForm, status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white"
                  >
                    <option value="active">نشطة (منتظمة)</option>
                    <option value="suspended">موقوفة مؤقتاً</option>
                    <option value="withdrawn">منسحبة</option>
                    <option value="archived">مؤرشفة</option>
                  </select>
                </div>
                <div>
                  <HijriJoinDateSelector
                    label="تاريخ الانضمام (تقويم أم القرى)"
                    value={studentForm.joinDate}
                    onChange={date => setStudentForm({ ...studentForm, joinDate: date })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">ملاحظات المعلمة والمشرفة</label>
                <textarea
                  rows={2}
                  placeholder="مستوى المحفوظ، الالتزام، التوجيهات الخاصة..."
                  value={studentForm.notes}
                  onChange={e => setStudentForm({ ...studentForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-100 mt-2">
                <button
                  type="button"
                  onClick={() => setStudentModalOpen(false)}
                  className="px-4 py-2.5 text-stone-600 text-xs font-bold rounded-xl hover:bg-stone-100 transition active:scale-95 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  style={{ backgroundColor: settings.primaryColor || '#8E5364' }}
                  className="px-6 py-2.5 text-white text-xs font-bold rounded-xl shadow-xs transition hover:brightness-105 active:scale-95 cursor-pointer touch-manipulation"
                >
                  حفظ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Alert Modal */}
      {studentToDelete && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200 text-right space-y-4" dir="rtl">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-stone-900 text-base font-quran">
                تأكيد حذف الطالبة
              </h3>
              <p className="text-sm font-bold text-rose-700">
                هل أنت متأكد من حذف هذا السجل؟
              </p>
              <p className="text-xs text-stone-600 font-semibold mt-1">
                «{studentToDelete.name}» ({studentToDelete.code})
              </p>
            </div>

            <p className="text-xs text-stone-500 leading-relaxed bg-[#FCFAF8] p-3 rounded-2xl border border-stone-200 text-center">
              سيتم حذف الطالبة وكافة بياناتها نهائياً ومزامنة ذلك عبر السحابة فوراً.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setStudentToDelete(null)}
                className="px-4 py-2 text-stone-600 text-xs font-bold rounded-xl hover:bg-stone-100 transition cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={async () => {
                  const sid = studentToDelete.id;
                  setStudentToDelete(null);
                  await deleteStudent(sid);
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Partner Assignment Modal */}
      {partnerModalOpen && selectedStudentForPartner && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-stone-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">🤝</span>
              <div>
                <h3 className="font-bold text-stone-900 text-base font-quran">
                  تعيين الرفيقة القرآنية
                </h3>
                <p className="text-xs text-stone-500">
                  للطالبة: <strong>{selectedStudentForPartner.name}</strong>
                </p>
              </div>
            </div>

            <p className="text-xs text-stone-600 mb-4 leading-relaxed bg-[#FAF6F2] p-3 rounded-2xl border border-[#EFE8E2]">
              يتم ربط الطالبة برفيقتها للتعاون في <strong>تحدي الخميس</strong>، والمراجعة الثنائية المتبادلة، واكتشاف الأخطاء، وحفظ السجلات المشتركة.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  اختاري الرفيقة (من أي حلقة في غيث الغيم):
                </label>
                <select
                  value={targetPartnerId}
                  onChange={e => setTargetPartnerId(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-[#8E5364]"
                >
                  <option value="">-- اختاري طالبة من أي حلقة --</option>
                  {circles.map(c => {
                    const cStudents = students.filter(
                      s => s.circleId === c.id && s.id !== selectedStudentForPartner.id && s.status === 'active'
                    );
                    if (cStudents.length === 0) return null;
                    return (
                      <optgroup key={c.id} label={`حلقة: ${c.name} (${c.teacherName})`}>
                        {cStudents.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.code}) {s.partnerStudentId ? `[مقترنة مع: ${s.partnerStudentName}]` : '[متاحة]'}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setPartnerModalOpen(false)}
                  className="px-4 py-2.5 text-stone-600 text-xs font-bold rounded-xl hover:bg-stone-100 transition active:scale-95 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSavePartner}
                  disabled={!targetPartnerId}
                  style={{ backgroundColor: settings.primaryColor || '#8E5364' }}
                  className="px-6 py-2.5 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition hover:brightness-105 active:scale-95 cursor-pointer touch-manipulation"
                >
                  تأكيد تعيين الرفيقة
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
