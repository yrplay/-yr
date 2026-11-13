import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Users, Search, Filter, Plus, Edit, Archive, HeartHandshake,
  UserCheck, Shield, Phone, Mail, Award, ArrowUpDown, ChevronLeft,
  Calendar, CheckCircle2, AlertCircle, AlertTriangle, Trash2, RotateCcw, Send, Star,
  Copy, ClipboardPaste, Layers, X
} from 'lucide-react';
import { hasFullAccess, StudentStatus } from '../types';
import { formatHijriShort, HijriJoinDateSelector } from '../utils/hijriDate';
import { cleanTelegramUsername, triggerStudentTelegramAlert } from '../utils/telegramAlert';

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
    selectedTrackId, showToast
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

  // Copy & Paste Student Across Tracks State
  const COPIED_STUDENT_STORAGE_KEY = 'ghaith_copied_student_clipboard_v1';
  const [copiedStudentClipboard, setCopiedStudentClipboard] = useState<{
    name: string;
    phone: string;
    notes: string;
    telegramUsername?: string;
    email?: string;
    joinDate?: string;
    sourceCode?: string;
  } | null>(() => {
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('ghaith_copied_student_clipboard_v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed.name === 'string' && parsed.name.trim()) {
            return parsed;
          }
        }
      }
    } catch {}
    return null;
  });
  const [studentToCopy, setStudentToCopy] = useState<any>(null);
  const [copyTargetTrackId, setCopyTargetTrackId] = useState<string>('');
  const [copyTargetCircleId, setCopyTargetCircleId] = useState<string>('');
  const [isCopyingToTrack, setIsCopyingToTrack] = useState<boolean>(false);

  // Form state
  const [studentForm, setStudentForm] = useState({
    name: '',
    code: '',
    phone: '',
    telegramUsername: '',
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
        telegramUsername: cleanTelegramUsername(student.telegramUsername || ''),
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
        telegramUsername: '',
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
      telegramUsername: cleanTelegramUsername(studentForm.telegramUsername),
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

  const handleOpenCopyStudentModal = (student: any) => {
    const copiedPayload = {
      name: student.name || '',
      phone: student.phone || '',
      notes: student.notes || '',
      telegramUsername: cleanTelegramUsername(student.telegramUsername || ''),
      email: student.email || '',
      joinDate: student.joinDate || '1448-01-01',
      sourceCode: student.code || ''
    };
    setCopiedStudentClipboard(copiedPayload);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(COPIED_STUDENT_STORAGE_KEY, JSON.stringify(copiedPayload));
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(`${copiedPayload.name} - ${copiedPayload.phone}`).catch(() => {});
      }
    } catch {}

    const activeTracks = tracks.filter(t => !t.isArchived);
    const currentCircle = circles.find(c => c.id === student.circleId);
    const sourceTrackId = student.trackId || currentCircle?.trackId || '';
    const otherTrack = activeTracks.find(t => t.id !== sourceTrackId) || activeTracks[0];
    const defaultTargetTrackId = otherTrack?.id || tracks[0]?.id || 't-1';
    const targetCircles = circles.filter(c => !c.isArchived && c.trackId === defaultTargetTrackId);
    const fallbackCircles = circles.filter(c => !c.isArchived);

    setStudentToCopy(student);
    setCopyTargetTrackId(defaultTargetTrackId);
    setCopyTargetCircleId(targetCircles[0]?.id || fallbackCircles[0]?.id || '');
  };

  const handleConfirmDirectCopyToTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentToCopy || isCopyingToTrack) return;
    const selectedCircle = circles.find(c => c.id === copyTargetCircleId);
    const resolvedTrackId = copyTargetTrackId || selectedCircle?.trackId || tracks[0]?.id || 't-1';
    const targetTrackObj = tracks.find(t => t.id === resolvedTrackId);
    const cleanTrackName = (targetTrackObj?.name || 'المسار المستهدف').replace(/[🪴🤎]/g, '').trim();

    setIsCopyingToTrack(true);
    try {
      const freshCode = `GH-${Math.floor(100 + Math.random() * 900)}`;
      await createStudent({
        name: studentToCopy.name,
        code: freshCode,
        phone: studentToCopy.phone || '',
        telegramUsername: cleanTelegramUsername(studentToCopy.telegramUsername || ''),
        email: studentToCopy.email || '',
        notes: studentToCopy.notes || '',
        joinDate: studentToCopy.joinDate || '1448-01-01',
        status: 'active',
        trackId: resolvedTrackId,
        circleId: copyTargetCircleId || selectedCircle?.id || ''
      });
      setStudentToCopy(null);
      showToast(`تم نسخ الطالبة "${studentToCopy.name}" وإضافتها إلى (${cleanTrackName}) بسجل مستقل بنجاح`, 'success');
    } finally {
      setIsCopyingToTrack(false);
    }
  };

  const handlePasteCopiedStudentIntoForm = () => {
    if (!copiedStudentClipboard) return;
    setStudentForm(prev => ({
      ...prev,
      name: copiedStudentClipboard.name || prev.name,
      phone: copiedStudentClipboard.phone || prev.phone,
      notes: copiedStudentClipboard.notes ?? prev.notes,
      telegramUsername: copiedStudentClipboard.telegramUsername || prev.telegramUsername,
      email: copiedStudentClipboard.email || prev.email,
      joinDate: copiedStudentClipboard.joinDate || prev.joinDate
    }));
    showToast(`تم لصق بيانات الطالبة "${copiedStudentClipboard.name}" بنجاح`, 'info');
  };

  return (
    <div className="space-y-6">

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-[#E8DFD8] shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-5 h-5 text-[#9A5643]" />
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
            <span className="text-[11px] font-bold text-[#7B3F30] bg-[#F6EFEA] px-3 py-1 rounded-full border border-[#DFCEBF] inline-flex items-center gap-1.5">
              <Archive className="w-3.5 h-3.5 text-[#9A5643]" />
              <span>جميع سجلات التسميع والدرجات وملف الإنجاز محفوظة 100% ويمكن استعادة الطالبة بضغطة واحدة</span>
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
          <span className="font-semibold text-[#8E5364] inline-flex items-center gap-1">
            <HeartHandshake className="w-3.5 h-3.5 text-[#9A5643]" />
            <span>{filteredStudents.filter(s => s.partnerStudentId).length} طالبة لديها رفيقة معينة</span>
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
                          <span className="px-2.5 py-0.5 rounded-full bg-[#FDF6F2] text-[#9A5643] border border-[#E5C3B3] text-[10px] font-bold inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-[#9A5643]" />
                            <span>تجاوزت حد الغياب (منقطعة)</span>
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-stone-400 flex flex-wrap items-center gap-1.5">
                        <span className="privacy-phone">{student.phone}</span>
                        {student.telegramUsername && (
                          <span className="font-mono text-[10px] text-[#7B3F30] bg-[#F6EFEA] px-1.5 py-0.2 rounded-md border border-[#E5C3B3]">
                            @{cleanTelegramUsername(student.telegramUsername)}
                          </span>
                        )}
                        {student.joinDate ? <span>• انضمت: {formatHijriShort(student.joinDate)}</span> : null}
                      </div>
                      {(student.status === 'archived' || student.archived) && student.archivedReason && (
                        <div className="text-[10px] text-[#A14A2A] font-semibold mt-0.5">
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
                            <HeartHandshake className="w-3 h-3 text-[#9A5643]" />
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
                          <HeartHandshake className="w-3.5 h-3.5 text-[#9A5643]" />
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
                      <div className="text-[10px] text-stone-400 inline-flex items-center gap-1">
                        <span className="privacy-score-digit">{score?.earlyPrepCount}</span>
                        <span>مبكر</span>
                        <Star className="w-3 h-3 text-[#9A5643]" />
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
                        {((score?.absentUnexcusedCount ?? 0) >= 3 || student.status === 'archived' || student.archived) && (
                          <button
                            type="button"
                            onClick={() =>
                              triggerStudentTelegramAlert({
                                studentName: student.name,
                                circleName: circle?.name || 'الحلقة القرآنية',
                                absenceCount: Math.max(4, score?.absentUnexcusedCount ?? 4),
                                telegramUsername: student.telegramUsername,
                                showToast
                              })
                            }
                            className="px-2.5 py-1.5 bg-[#FDF6F2] hover:bg-[#9A5643] text-[#9A5643] hover:text-white border border-[#E5C3B3] rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition cursor-pointer shadow-2xs"
                            title="نسخ رسالة التنبيه وفتح محادثة تيليجرام الطالبة مباشرة"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>تنبيه تيليجرام</span>
                          </button>
                        )}
                        {(student.status === 'archived' || student.archived) ? (
                          <button
                            type="button"
                            onClick={() => restoreStudent(student.id)}
                            className="px-3 py-1.5 bg-[#EBF3EE] hover:bg-[#DCEADA] text-[#2D5A43] border border-[#B8D8C5] rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition cursor-pointer shadow-2xs"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>إلغاء الأرشفة واستعادة للحلقة</span>
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
                          onClick={() => handleOpenCopyStudentModal(student)}
                          className="px-2 py-1 text-[#7B3F30] bg-[#FAF8F6] hover:bg-[#F6EFEA] border border-[#E5C3B3] rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition cursor-pointer active:scale-95"
                          title="نسخ الطالبة إلى مسار آخر أو نسخ بياناتها"
                        >
                          <Copy className="w-3.5 h-3.5 text-[#9A5643]" />
                          <span>نسخ الطالبة</span>
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
              {!editingStudent && copiedStudentClipboard?.name && (
                <div className="p-3 rounded-2xl bg-[#FAF8F6] border border-[#E5C3B3] flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handlePasteCopiedStudentIntoForm}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#7B3F30] hover:text-[#9A5643] transition cursor-pointer text-right"
                  >
                    <ClipboardPaste className="w-4 h-4 text-[#9A5643] shrink-0" />
                    <span>لصق بيانات الطالبة المنسوخة: {copiedStudentClipboard.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePasteCopiedStudentIntoForm}
                    className="px-3 py-1 rounded-xl bg-[#9A5643] hover:bg-[#7B3F30] text-white text-[11px] font-bold transition cursor-pointer shrink-0"
                  >
                    تعبئة تلقائية
                  </button>
                </div>
              )}
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">معرّف تيليجرام الطالبة (@username)</label>
                  <input
                    type="text"
                    dir="ltr"
                    placeholder="@username أو رابط t.me"
                    value={studentForm.telegramUsername}
                    onChange={e => setStudentForm({ ...studentForm, telegramUsername: cleanTelegramUsername(e.target.value) })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs font-mono text-left"
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

      {/* Direct Copy Student to Another Track Modal */}
      {studentToCopy && (
        <div
          className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in"
          dir="rtl"
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-[#E8DFD8] space-y-4 text-right">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-[#FAF8F6] border border-[#E5C3B3] text-[#9A5643] flex items-center justify-center shrink-0">
                  <Copy className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-stone-900 text-sm sm:text-base font-quran">
                    نسخ بيانات الطالبة إلى مسار آخر
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    تم حفظ بيانات الطالبة للنسخ السريع أو الإضافة الفورية لمسار آخر
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStudentToCopy(null)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Copied Student Summary Box */}
            <div className="p-3.5 rounded-2xl bg-[#FAF8F6] border border-[#E5C3B3] space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-stone-900">{studentToCopy.name}</span>
                <span className="font-mono text-[11px] font-bold text-[#7B3F30] bg-white px-2 py-0.5 rounded-lg border border-[#E5C3B3]">
                  {studentToCopy.code}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-stone-600">
                <span className="inline-flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-[#9A5643]" />
                  <span className="font-mono">{studentToCopy.phone || 'غير مسجل'}</span>
                </span>
                {studentToCopy.notes && (
                  <span className="text-stone-500 truncate max-w-[220px]">
                    • ملاحظات: {studentToCopy.notes}
                  </span>
                )}
              </div>
            </div>

            <form onSubmit={handleConfirmDirectCopyToTrack} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  المسار المستهدف *
                </label>
                <select
                  value={copyTargetTrackId}
                  onChange={e => {
                    const nextTrackId = e.target.value;
                    const trackCircles = circles.filter(c => !c.isArchived && c.trackId === nextTrackId);
                    const allActiveCircles = circles.filter(c => !c.isArchived);
                    setCopyTargetTrackId(nextTrackId);
                    setCopyTargetCircleId(trackCircles[0]?.id || allActiveCircles[0]?.id || '');
                  }}
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-[#9A5643]"
                >
                  {tracks
                    .filter(t => !t.isArchived)
                    .map(t => (
                      <option key={t.id} value={t.id}>
                        {(t.name || '').replace(/[🪴🤎]/g, '').trim()}
                        {t.id === studentToCopy.trackId ? ' (المسار الحالي)' : ''}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  الحلقة المستهدفة *
                </label>
                <select
                  value={copyTargetCircleId}
                  onChange={e => {
                    const chosenCircle = circles.find(c => c.id === e.target.value);
                    setCopyTargetCircleId(e.target.value);
                    if (chosenCircle?.trackId) {
                      setCopyTargetTrackId(chosenCircle.trackId);
                    }
                  }}
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-[#9A5643]"
                >
                  {circles
                    .filter(c => !c.isArchived && (!copyTargetTrackId || c.trackId === copyTargetTrackId))
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.teacherName})
                      </option>
                    ))}
                  {circles.filter(c => !c.isArchived && (!copyTargetTrackId || c.trackId === copyTargetTrackId))
                    .length === 0 &&
                    circles
                      .filter(c => !c.isArchived)
                      .map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.teacherName})
                        </option>
                      ))}
                </select>
              </div>

              <div className="p-3 rounded-2xl bg-[#FAF8F6] border border-stone-200 text-[11px] text-stone-600 leading-relaxed flex items-start gap-2">
                <Layers className="w-4 h-4 text-[#9A5643] shrink-0 mt-0.5" />
                <span>
                  سيتم نسخ البيانات الشخصية للطالبة (الاسم، الجوال، الملاحظات) إلى المسار المختار مع تهيئة سجل الحفظ والحضور والدرجات عند <strong>0</strong> ليبقى كل مسار مستقلاً تماماً.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setStudentToCopy(null)}
                  className="px-4 py-2 text-stone-600 text-xs font-bold rounded-xl hover:bg-stone-100 transition cursor-pointer"
                >
                  إغلاق (مع الاحتفاظ بالنسخ)
                </button>
                <button
                  type="submit"
                  disabled={isCopyingToTrack}
                  className="px-5 py-2.5 bg-[#9A5643] hover:bg-[#7B3F30] disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer inline-flex items-center gap-1.5 active:scale-95"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>نسخ وإضافة للمسار</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
