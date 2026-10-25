import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Layers, Plus, Edit, Archive, Users, Calendar, Clock,
  Sparkles, Trophy, BookOpen, ChevronLeft, CheckCircle2,
  Sliders, UserCheck, Shield, AlertCircle, Trash2, RotateCcw,
  Eye, EyeOff, AlertTriangle, X, ExternalLink
} from 'lucide-react';
import { Circle, Track } from '../types';
import { CircleIconPicker } from '../components/CircleIconLibrary';
import { TrackDetailView } from './TrackDetailView';

const TRACK_EMOJIS = [
  '🪴', '📖', '🌸', '🌟', '🌿', '💎', '🕊️', '📜',
  '🏆', '✨', '🪔', '🌴', '🌙', '🕌', '💫', '🌾',
  '🛡️', '👑', '🎯', '💡', '📿', '🕯️', '⭐️', '🌺'
];

interface TracksCirclesViewProps {
  onSelectStudent: (studentId: string) => void;
  onNavigateToSection: (section: string) => void;
}

export const TracksCirclesView: React.FC<TracksCirclesViewProps> = ({
  onSelectStudent,
  onNavigateToSection
}) => {
  const {
    tracks, circles, students, users, allStudentScores,
    createTrack, updateTrack, archiveTrack, restoreTrack,
    createCircle, updateCircle, archiveCircle, restoreCircle,
    currentUser, quickModalAction, clearQuickModal, settings
  } = useApp();

  const [selectedTrackId, setSelectedTrackId] = useState<string>(tracks[0]?.id || 't-1');
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // حالة فتح صفحة تفاصيل المسار المستقلة
  const [selectedTrackDetailId, setSelectedTrackDetailId] = useState<string | null>(null);

  // Modals state
  const [trackModalOpen, setTrackModalOpen] = useState(false);
  const [circleModalOpen, setCircleModalOpen] = useState(false);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [editingCircle, setEditingCircle] = useState<Circle | null>(null);

  // Deletion confirmation modal
  const [confirmDelete, setConfirmDelete] = useState<{
    open: boolean;
    type: 'circle' | 'track';
    id: string;
    name: string;
    studentsCount?: number;
  } | null>(null);

  // Form states
  const [trackForm, setTrackForm] = useState({
    name: '',
    code: '',
    description: '',
    logoUrl: '',
    icon: '🪴'
  });
  const [circleForm, setCircleForm] = useState({
    name: '', icon: '🪴', teacherId: '', supervisorId: '',
    maxStudents: 15, scheduleDays: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء'],
    startTime: '16:00', endTime: '18:00', earlyPrepCutoffTime: '15:45'
  });

  const activeTracks = tracks.filter(t => !t.isArchived);
  const archivedTracks = tracks.filter(t => t.isArchived);

  const currentTrack = tracks.find(t => t.id === selectedTrackId) || activeTracks[0] || tracks[0];

  const trackCircles = circles.filter(c => c.trackId === currentTrack?.id && !c.isArchived);
  const archivedTrackCircles = circles.filter(c => c.trackId === currentTrack?.id && c.isArchived);
  const trackStudents = students.filter(s => s.trackId === currentTrack?.id && s.status === 'active');

  const teachers = users.filter(u => u.role === 'teacher' || u.role === 'leader');
  const supervisors = users.filter(u => u.role === 'supervisor' || u.role === 'leader');

  React.useEffect(() => {
    if (quickModalAction?.type === 'circle') {
      handleOpenCircleModal();
      clearQuickModal();
    } else if (quickModalAction?.type === 'track') {
      handleOpenTrackModal();
      clearQuickModal();
    }
  }, [quickModalAction]);

  // عرض صفحة تفاصيل ونظام المسار عند اختيار مسار معين
  if (selectedTrackDetailId) {
    return (
      <TrackDetailView
        trackId={selectedTrackDetailId}
        onBack={() => setSelectedTrackDetailId(null)}
      />
    );
  }

  const handleOpenTrackModal = (track?: Track) => {
    if (track) {
      setEditingTrack(track);
      setTrackForm({
        name: track.name,
        code: track.code,
        description: track.description || '',
        logoUrl: track.logoUrl || '',
        icon: track.icon || '🪴'
      });
    } else {
      setEditingTrack(null);
      setTrackForm({
        name: '',
        code: `MG-${Date.now().toString().slice(-3)}`,
        description: '',
        logoUrl: '',
        icon: '🪴'
      });
    }
    setTrackModalOpen(true);
  };

  const handleTrackLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setTrackForm(prev => ({ ...prev, logoUrl: ev.target?.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackForm.name.trim()) return;
    if (editingTrack) {
      await updateTrack(editingTrack.id, trackForm);
    } else {
      const created = await createTrack(trackForm);
      setSelectedTrackId(created.id);
    }
    setTrackModalOpen(false);
  };

  const handleOpenCircleModal = (circle?: Circle) => {
    if (circle) {
      setEditingCircle(circle);
      setCircleForm({
        name: circle.name,
        icon: circle.icon || '🪴',
        teacherId: circle.teacherId,
        supervisorId: circle.supervisorId,
        maxStudents: circle.maxStudents || 15,
        scheduleDays: circle.scheduleDays || ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء'],
        startTime: circle.startTime || '16:00',
        endTime: circle.endTime || '18:00',
        earlyPrepCutoffTime: circle.earlyPrepCutoffTime || '15:45'
      });
    } else {
      setEditingCircle(null);
      setCircleForm({
        name: '',
        icon: '🪴',
        teacherId: teachers[0]?.id || '',
        supervisorId: supervisors[0]?.id || '',
        maxStudents: 15,
        scheduleDays: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء'],
        startTime: '16:00',
        endTime: '18:00',
        earlyPrepCutoffTime: '15:45'
      });
    }
    setCircleModalOpen(true);
  };

  const handleSaveCircle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!circleForm.name.trim()) return;
    const teacher = users.find(u => u.id === circleForm.teacherId);
    const supervisor = users.find(u => u.id === circleForm.supervisorId);

    const trackFallbackId = currentTrack?.id || activeTracks[0]?.id || tracks[0]?.id || 't-1';
    const payload = {
      ...circleForm,
      trackId: trackFallbackId,
      teacherName: teacher ? teacher.name : 'غير محدد',
      supervisorName: supervisor ? supervisor.name : 'غير محدد'
    };

    if (editingCircle) {
      await updateCircle(editingCircle.id, payload);
    } else {
      await createCircle(payload);
    }
    setCircleModalOpen(false);
  };

  const confirmDeleteCircle = (circle: Circle, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const studentsInCircle = students.filter(s => s.circleId === circle.id && s.status === 'active').length;
    setConfirmDelete({
      open: true,
      type: 'circle',
      id: circle.id,
      name: circle.name,
      studentsCount: studentsInCircle
    });
  };

  const confirmDeleteTrack = (track: Track) => {
    const studentsInTrack = students.filter(s => s.trackId === track.id && s.status === 'active').length;
    setConfirmDelete({
      open: true,
      type: 'track',
      id: track.id,
      name: track.name,
      studentsCount: studentsInTrack
    });
  };

  const executeConfirmDelete = async () => {
    if (!confirmDelete) return;
    if (confirmDelete.type === 'circle') {
      await archiveCircle(confirmDelete.id);
      if (selectedCircleId === confirmDelete.id) {
        setSelectedCircleId(null);
      }
      setCircleModalOpen(false);
    } else if (confirmDelete.type === 'track') {
      await archiveTrack(confirmDelete.id);
      const remainingTracks = activeTracks.filter(t => t.id !== confirmDelete.id);
      if (remainingTracks.length > 0) {
        setSelectedTrackId(remainingTracks[0].id);
      }
      setTrackModalOpen(false);
    }
    setConfirmDelete(null);
  };

  const activeCircle = selectedCircleId ? circles.find(c => c.id === selectedCircleId) : null;
  const activeCircleStudents = activeCircle
    ? students.filter(s => s.circleId === activeCircle.id && s.status === 'active')
    : [];

  return (
    <div className="space-y-6">

      {/* Header and Track Selector Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-[#E8DFD8] shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🪴</span>
            <h2 className="text-xl font-bold text-stone-900 font-quran">المسارات والحلقات القرآنية</h2>
          </div>
          <p className="text-xs text-stone-500">
            إدارة مسارات الحفظ المعتمدة، والحلقات الفرعية، وتوزيع الطالبات وحذف أو أرشفة واستعادة الحلقات
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(archivedTracks.length > 0 || archivedTrackCircles.length > 0) && (
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition border ${
                showArchived
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-stone-50 hover:bg-stone-100 text-stone-600 border-stone-200'
              }`}
              title="عرض الحلقات والمسارات المؤرشفة"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>{showArchived ? 'إخفاء الأرشيف' : 'عرض المحذوف والمؤرشف'}</span>
            </button>
          )}

          {currentUser?.role === 'leader' && (
            <button
              onClick={() => handleOpenTrackModal()}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#FAF6F2] hover:bg-[#F2ECE6] text-[#744251] border border-[#E2D5CC] rounded-xl text-xs font-bold transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة مسار جديد</span>
            </button>
          )}
          <button
            onClick={() => handleOpenCircleModal()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs font-bold shadow-xs transition active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة حلقة جديدة</span>
          </button>
        </div>
      </div>

      {/* Track Selection Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {activeTracks.map((track) => (
          <button
            key={track.id}
            onClick={() => { setSelectedTrackId(track.id); setSelectedCircleId(null); }}
            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 ${
              selectedTrackId === track.id
                ? 'bg-[#8E5364] text-white shadow-xs'
                : 'bg-white text-stone-700 hover:bg-[#FAF6F2] border border-[#E8DFD8]'
            }`}
          >
            <span className="text-base">{track.icon || '🪴'}</span>
            <span>{track.name}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
              selectedTrackId === track.id ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'
            }`}>
              {circles.filter(c => c.trackId === track.id && !c.isArchived).length} حلقات
            </span>
          </button>
        ))}
      </div>

      {/* Track Overview Card */}
      {currentTrack && (
        <div className="bg-white p-6 rounded-3xl border border-[#E8DFD8] shadow-2xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
            <div className="flex items-start gap-3">
              {currentTrack.logoUrl ? (
                <div className="w-12 h-12 rounded-2xl bg-white border border-stone-200 shadow-2xs p-1 flex items-center justify-center shrink-0">
                  <img src={currentTrack.logoUrl} alt={currentTrack.name} className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-[#FAF0F3] border border-[#E8D5D8] flex items-center justify-center text-xl shrink-0">
                  {currentTrack.icon || '🪴'}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-stone-900">{currentTrack.name}</h3>
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#EBF3EE] text-[#2D5A43] font-semibold">
                    {currentTrack.code}
                  </span>
                  {currentTrack.isArchived && (
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-semibold">
                      مسار مؤرشف
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-600 mt-1 max-w-2xl leading-relaxed">
                  {currentTrack.description || 'لا يوجد وصف مضاف لهذا المسار.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setSelectedTrackDetailId(currentTrack.id)}
                className="px-3 py-2 rounded-xl bg-[#FAF0F3] hover:bg-[#F2E0E6] text-[#8E5364] text-xs font-bold flex items-center gap-1.5 border border-[#E2D5CC] transition cursor-pointer"
                title="عرض صفحة ونظام والمالية للمسار"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>تفاصيل ونظام المسار</span>
              </button>

              {currentUser?.role === 'leader' && (
                <>
                  <button
                    onClick={() => handleOpenTrackModal(currentTrack)}
                    className="p-2 rounded-xl text-stone-600 hover:bg-stone-100 text-xs flex items-center gap-1 border border-stone-200 transition cursor-pointer"
                    title="تعديل المسار"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>تعديل</span>
                  </button>

                  <button
                    onClick={() => confirmDeleteTrack(currentTrack)}
                    className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 text-xs flex items-center gap-1 border border-rose-200 transition cursor-pointer"
                    title="أرشفة أو حذف هذا المسار"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف المسار</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Track Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3.5 rounded-2xl bg-[#FCFAF8] border border-[#EFE8E2]">
              <div className="text-xs text-stone-600 mb-1">إجمالي الطالبات</div>
              <div className="text-xl font-extrabold text-stone-900">{trackStudents.length}</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#FCFAF8] border border-[#EFE8E2]">
              <div className="text-xs text-stone-600 mb-1">عدد الحلقات النشطة</div>
              <div className="text-xl font-extrabold text-[#8E5364]">{trackCircles.length}</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#FCFAF8] border border-[#EFE8E2]">
              <div className="text-xs text-stone-600 mb-1">الكادر التعليمي</div>
              <div className="text-xl font-extrabold text-stone-900">
                {new Set(trackCircles.map(c => c.teacherId)).size} معلمات
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#FCFAF8] border border-[#EFE8E2]">
              <div className="text-xs text-stone-600 mb-1">متوسط إنجاز المسار</div>
              <div className="text-xl font-extrabold text-[#2D5A43]">
                {trackStudents.length > 0
                  ? Math.round(trackStudents.reduce((acc, s) => acc + (allStudentScores[s.id]?.finalPercentage || 0), 0) / trackStudents.length)
                  : 0}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Circles Grid Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
            <span>الحلقات التابعة للمسار ({trackCircles.length})</span>
          </h3>
          <span className="text-xs text-stone-400">
            انقري على الحلقة لعرض سجلها وتفاصيل طالباتها أو تعديلها وحذفها
          </span>
        </div>

        {trackCircles.length === 0 ? (
          <div className="bg-white p-8 rounded-3xl border border-stone-200 text-center space-y-3">
            <span className="text-4xl">🪴</span>
            <h4 className="font-bold text-stone-700 text-sm">لا توجد حلقات نشطة في هذا المسار</h4>
            <p className="text-xs text-stone-400 max-w-sm mx-auto">
              يمكنك إنشاء حلقة جديدة وتعيين المعلمة والمشرفة وتحديد جدول الأيام وساعة التحضير
            </p>
            <button
              onClick={() => handleOpenCircleModal()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#8E5364] text-white rounded-xl text-xs font-bold"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة حلقة الآن</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trackCircles.map((circle) => {
              const cStudents = students.filter(s => s.circleId === circle.id && s.status === 'active');
              const isSelected = selectedCircleId === circle.id;
              const avgCircleScore = cStudents.length > 0
                ? Math.round(cStudents.reduce((acc, s) => acc + (allStudentScores[s.id]?.finalPercentage || 0), 0) / cStudents.length)
                : 0;

              return (
                <div
                  key={circle.id}
                  onClick={() => setSelectedCircleId(isSelected ? null : circle.id)}
                  className={`p-5 rounded-3xl border transition-all cursor-pointer relative ${
                    isSelected
                      ? 'bg-[#FCF7F9] border-[#D4A5B3] ring-2 ring-[#8E5364]/20 shadow-sm'
                      : 'bg-white border-[#E8DFD8] hover:border-[#CDBEB5] shadow-2xs'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">{circle.icon || '🪴'}</span>
                      <div>
                        <h4 className="font-bold text-stone-900 text-base">{circle.name}</h4>
                        <p className="text-[11px] text-stone-500">
                          المعلمة: <strong className="text-stone-700">{circle.teacherName}</strong>
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#EBF3EE] text-[#2D5A43]">
                      {avgCircleScore}%
                    </span>
                  </div>

                  <div className="space-y-2 text-xs text-stone-600 mb-4">
                    <div className="flex justify-between text-[11px]">
                      <span>استيعاب الحلقة:</span>
                      <span className="font-semibold text-stone-800">{cStudents.length} / {circle.maxStudents} طالبة</span>
                    </div>
                    <div className="w-full bg-[#EFEAE5] h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-[#8E5364] h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, (cStudents.length / circle.maxStudents) * 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-stone-400 pt-1">
                      <span>المشرفة: {circle.supervisorName}</span>
                      <span>{circle.scheduleDays.join('، ')}</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-stone-400">
                      <span>الوقت: {circle.startTime} - {circle.endTime}</span>
                      <span className="text-amber-700 font-medium">التحضير: حتى {circle.earlyPrepCutoffTime}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-stone-100">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenCircleModal(circle);
                        }}
                        className="p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg text-xs flex items-center gap-1 transition"
                        title="تعديل بيانات الحلقة"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>تعديل</span>
                      </button>

                      <button
                        onClick={(e) => confirmDeleteCircle(circle, e)}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg text-xs flex items-center gap-1 transition"
                        title="أرشفة / حذف الحلقة"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف</span>
                      </button>
                    </div>

                    <span className="text-xs text-[#8E5364] font-bold flex items-center gap-1">
                      <span>{isSelected ? 'إغلاق التفاصيل' : 'فتح سجل الحلقة'}</span>
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Archived Items Section (When Toggled) */}
      {showArchived && (
        <div className="bg-[#FAF7F4] p-5 rounded-3xl border border-dashed border-[#D4C4B7] space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-stone-800 text-sm flex items-center gap-2">
              <Archive className="w-4 h-4 text-amber-700" />
              <span>سجل الحلقات والمسارات المؤرشفة (المحذوفة بأمان)</span>
            </h4>
            <span className="text-[11px] text-stone-500">
              جميع سجلات الطالبات والدرجات محفوظة ويمكن استعادتها فوراً
            </span>
          </div>

          {archivedTrackCircles.length === 0 && archivedTracks.length === 0 ? (
            <p className="text-xs text-stone-500 text-center py-4">لا توجد عناصر مؤرشفة حالياً.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {archivedTrackCircles.map(c => (
                <div key={c.id} className="p-4 bg-white rounded-2xl border border-stone-200 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span>{c.icon}</span>
                      <strong className="text-xs text-stone-800">{c.name}</strong>
                      <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">حلقة مؤرشفة</span>
                    </div>
                    <div className="text-[11px] text-stone-400 mt-1">المعلمة: {c.teacherName}</div>
                  </div>
                  <button
                    onClick={() => restoreCircle(c.id)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-[#EBF3EE] hover:bg-[#DCEDDF] text-[#2D5A43] text-xs font-bold rounded-xl transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>استعادة الحلقة</span>
                  </button>
                </div>
              ))}

              {archivedTracks.map(t => (
                <div key={t.id} className="p-4 bg-white rounded-2xl border border-stone-200 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-stone-400" />
                      <strong className="text-xs text-stone-800">{t.name}</strong>
                      <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">مسار مؤرشف</span>
                    </div>
                    <div className="text-[11px] text-stone-400 mt-1">{t.code}</div>
                  </div>
                  <button
                    onClick={() => restoreTrack(t.id)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-[#EBF3EE] hover:bg-[#DCEDDF] text-[#2D5A43] text-xs font-bold rounded-xl transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>استعادة المسار</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Selected Circle Detailed Workspace */}
      {activeCircle && (
        <div className="bg-white p-6 rounded-3xl border border-[#8E5364]/30 shadow-md space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{activeCircle.icon}</span>
                <h3 className="text-lg font-bold text-stone-900">
                  سجل حلقة {activeCircle.name}
                </h3>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                المعلمة: <strong>{activeCircle.teacherName}</strong> • المشرفة: <strong>{activeCircle.supervisorName}</strong> • الأيام: <strong>{activeCircle.scheduleDays.join('، ')}</strong>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => onNavigateToSection('attendance')}
                className="px-3 py-1.5 bg-[#EBF3EE] text-[#2D5A43] rounded-xl text-xs font-bold hover:bg-[#DCEADA] transition"
              >
                رصد الحضور
              </button>
              <button
                onClick={() => onNavigateToSection('recitation')}
                className="px-3 py-1.5 bg-[#F6EEF1] text-[#8E5364] rounded-xl text-xs font-bold hover:bg-[#EBDDE2] transition"
              >
                جلسة التسميع اليومي
              </button>
              <button
                onClick={() => handleOpenCircleModal(activeCircle)}
                className="p-1.5 text-stone-600 hover:bg-stone-100 rounded-xl text-xs border border-stone-200 flex items-center gap-1"
                title="تعديل الحلقة"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>تعديل الحلقة</span>
              </button>
              <button
                onClick={(e) => confirmDeleteCircle(activeCircle, e)}
                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-xl text-xs border border-rose-200 flex items-center gap-1"
                title="أرشفة / حذف الحلقة"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>أرشفة / حذف الحلقة</span>
              </button>
            </div>
          </div>

          {/* Students in Circle Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-stone-800 text-xs">
                طالبات الحلقة المسجلات ({activeCircleStudents.length} / {activeCircle.maxStudents})
              </h4>
              <button
                onClick={() => onNavigateToSection('students')}
                className="text-xs text-[#8E5364] font-bold hover:underline"
              >
                إدارة الطالبات وتوزيع الحلقات ←
              </button>
            </div>

            {activeCircleStudents.length > 0 ? (
              <div className="overflow-x-auto rounded-2xl border border-stone-100">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-[#FAF7F5] text-stone-600 border-b border-stone-200">
                      <th className="p-3">#</th>
                      <th className="p-3">كود الطالبة</th>
                      <th className="p-3">اسم الطالبة</th>
                      <th className="p-3">الرفيقة المعتمدة</th>
                      <th className="p-3">الحفظ المنجز</th>
                      <th className="p-3">نسبة الحضور</th>
                      <th className="p-3">المعدل التراكمي</th>
                      <th className="p-3">التقدير الحالي</th>
                      <th className="p-3 text-center">الإجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {activeCircleStudents.map((st, idx) => {
                      const score = allStudentScores[st.id];
                      return (
                        <tr key={st.id} className="hover:bg-[#FAF7F9] transition">
                          <td className="p-3 font-semibold text-stone-400">{idx + 1}</td>
                          <td className="p-3 font-mono text-[11px] text-stone-500">{st.code}</td>
                          <td className="p-3 font-bold text-stone-900">{st.name}</td>
                          <td className="p-3 text-stone-600">
                            {st.partnerStudentName ? (
                              <span className="inline-flex items-center gap-1 bg-[#F5ECE8] text-[#7A4B37] px-2 py-0.5 rounded-full text-[11px]">
                                <span>🤝</span> {st.partnerStudentName}
                              </span>
                            ) : (
                              <span className="text-stone-300 text-[11px]">غير معينة</span>
                            )}
                          </td>
                          <td className="p-3">
                            <span className="font-semibold text-stone-700">
                              {score?.newMemorizationPagesDone} / {score?.newMemorizationPagesTarget} ص
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="font-semibold text-[#2D5A43]">{score?.attendanceRate}%</span>
                          </td>
                          <td className="p-3">
                            <span className="font-extrabold text-sm text-stone-900">
                              {score?.finalPercentage}%
                            </span>
                          </td>
                          <td className="p-3">
                            <span
                              className="px-2 py-0.5 rounded-full text-[11px] font-bold text-white inline-block"
                              style={{ backgroundColor: score?.gradeColor || '#2D5A43' }}
                            >
                              {score?.gradeLabel} (#{score?.rankInCircle})
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => onSelectStudent(st.id)}
                              className="px-3 py-1 bg-[#8E5364] text-white rounded-lg text-[11px] font-semibold hover:bg-[#744251] transition"
                            >
                              ملف الإنجاز
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-stone-400 bg-stone-50 rounded-2xl">
                لا توجد طالبات مسجلات في هذه الحلقة بعد.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal for Deletion / Archiving */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-100 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-stone-900 text-base">
                تأكيد حذف / أرشفة {confirmDelete.type === 'circle' ? 'الحلقة' : 'المسار'}
              </h3>
              <p className="text-xs text-stone-600 font-bold">
                «{confirmDelete.name}»
              </p>
            </div>

            <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1.5 leading-relaxed">
              <p className="font-bold flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-amber-700" />
                <span>حماية بيانات الطالبات والأمان:</span>
              </p>
              <p>
                سيتم نقل {confirmDelete.type === 'circle' ? 'الحلقة' : 'المسار'} إلى الأرشيف بأمان. لن تُحذف سجلات التسميع أو درجات الطالبات
                {confirmDelete.studentsCount ? ` (يوجد ${confirmDelete.studentsCount} طالبة مسجلة)` : ''}.
              </p>
              <p className="text-[11px] text-amber-700">
                يمكنكِ استعادة الحلقة أو المسار في أي وقت من قسم «عرض الأرشيف».
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-stone-600 text-xs rounded-xl hover:bg-stone-100 font-semibold"
              >
                إلغاء التراجع
              </button>
              <button
                type="button"
                onClick={executeConfirmDelete}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
              >
                تأكيد الحذف والأرشفة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Track Modal */}
      {trackModalOpen && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-stone-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3 border-b border-stone-100 pb-2">
              <h3 className="font-bold text-stone-900 text-base font-quran">
                {editingTrack ? 'تعديل بيانات المسار' : 'إضافة مسار قرآني جديد'}
              </h3>
              <button
                type="button"
                onClick={() => setTrackModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTrack} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">اسم المسار</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: مسار إتقان وضبط المتشابهات"
                  value={trackForm.name}
                  onChange={e => setTrackForm({ ...trackForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-[#8E5364]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">رمز المسار الكودي</label>
                <input
                  type="text"
                  placeholder="مثال: MG-MUT"
                  value={trackForm.code}
                  onChange={e => setTrackForm({ ...trackForm, code: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-[#8E5364]"
                />
              </div>

              {/* خانة وصف ونبذة عن المسار المضافة والمحسنة */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-stone-700">وصف المسار وأهدافه</label>
                <textarea
                  rows={3}
                  placeholder="اكتبي هنا نبذة تعريفية عن المسار، أهدافه، والفئة المستهدفة..."
                  value={trackForm.description}
                  onChange={e => setTrackForm({ ...trackForm, description: e.target.value })}
                  className="w-full p-2.5 border border-stone-200 rounded-xl text-xs leading-relaxed focus:ring-2 focus:ring-[#8E5364] resize-none"
                />
              </div>

              {/* Track Icon & Emoji Picker */}
              <div className="p-3.5 bg-[#FCFAF8] rounded-2xl border border-stone-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-bold text-stone-700">
                      أيقونة وإيموجي المسار:
                    </label>
                    <span className="text-[11px] text-stone-500">
                      تظهر في رأس المسار، وبطاقات الحلقات، وقوائم التبديل
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-white border border-[#8E5364]/30 shadow-xs flex items-center justify-center text-2xl">
                    {trackForm.icon || '🪴'}
                  </div>
                </div>

                <div className="grid grid-cols-8 gap-1.5 p-2 bg-white rounded-xl border border-stone-200 max-h-36 overflow-y-auto">
                  {TRACK_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setTrackForm(prev => ({ ...prev, icon: emoji }))}
                      className={`h-8 w-8 rounded-lg flex items-center justify-center text-lg transition cursor-pointer hover:scale-115 active:scale-90 ${
                        trackForm.icon === emoji
                          ? 'bg-[#8E5364] text-white ring-2 ring-[#8E5364] shadow-xs'
                          : 'hover:bg-stone-100 text-stone-800'
                      }`}
                      title={emoji}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-1 text-xs text-stone-600">
                  <span>أو اكتبي رمزاً مخصصاً:</span>
                  <input
                    type="text"
                    maxLength={4}
                    value={trackForm.icon}
                    onChange={e => setTrackForm(prev => ({ ...prev, icon: e.target.value }))}
                    placeholder="🪴"
                    className="w-16 px-2 py-1 text-center border border-stone-200 rounded-lg text-sm bg-white font-bold"
                  />
                </div>
              </div>

              {/* Track Logo Upload */}
              <div className="p-3 bg-[#FCFAF8] rounded-2xl border border-stone-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-stone-700">شعار أو صورة المسار:</label>
                  {trackForm.logoUrl && (
                    <button
                      type="button"
                      onClick={() => setTrackForm(prev => ({ ...prev, logoUrl: '' }))}
                      className="text-[10px] text-rose-600 hover:underline"
                    >
                      إزالة الشعار
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <label className="px-3 py-1.5 bg-white border border-stone-300 hover:border-[#8E5364] rounded-xl text-xs font-bold text-stone-700 cursor-pointer flex items-center gap-1.5 shadow-2xs transition">
                    <span>رفع شعار المسار من الجهاز 🖼️</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleTrackLogoUpload}
                      className="hidden"
                    />
                  </label>

                  {trackForm.logoUrl && (
                    <img
                      src={trackForm.logoUrl}
                      alt="شعار المسار"
                      className="w-8 h-8 rounded-lg object-contain border border-stone-200"
                    />
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                {editingTrack && (
                  <button
                    type="button"
                    onClick={() => {
                      setTrackModalOpen(false);
                      confirmDeleteTrack(editingTrack);
                    }}
                    className="flex items-center gap-1 text-rose-600 hover:text-rose-800 text-xs font-bold cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف المسار</span>
                  </button>
                )}
                <div className="flex items-center gap-2 mr-auto">
                  <button
                    type="button"
                    onClick={() => setTrackModalOpen(false)}
                    className="px-4 py-2.5 text-stone-600 text-xs font-bold rounded-xl hover:bg-stone-100 transition active:scale-95 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    style={{ backgroundColor: settings.primaryColor || '#8E5364' }}
                    className="px-6 py-2.5 text-white text-xs font-bold rounded-xl shadow-xs transition hover:brightness-105 active:scale-95 cursor-pointer touch-manipulation"
                  >
                    حفظ المسار
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Circle Modal */}
      {circleModalOpen && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-xl border border-stone-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-stone-900 text-base font-quran">
                {editingCircle ? 'تعديل بيانات الحلقة' : 'إضافة حلقة جديدة للمسار'}
              </h3>
              <button onClick={() => setCircleModalOpen(false)} className="text-stone-400 hover:text-stone-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCircle} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">اسم الحلقة *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: حلقة راسخات (٤) 🪴"
                  value={circleForm.name}
                  onChange={e => setCircleForm({ ...circleForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-[#8E5364]"
                />
              </div>

              <CircleIconPicker
                selectedIcon={circleForm.icon || '🪴'}
                onSelectIcon={(icon) => setCircleForm(prev => ({ ...prev, icon }))}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">معلمة الحلقة</label>
                  <select
                    value={circleForm.teacherId}
                    onChange={e => setCircleForm({ ...circleForm, teacherId: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-[#8E5364]"
                  >
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.title})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">مشرفة الحلقة</label>
                  <select
                    value={circleForm.supervisorId}
                    onChange={e => setCircleForm({ ...circleForm, supervisorId: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-[#8E5364]"
                  >
                    {supervisors.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.title})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">الحد الأقصى للطالبات</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={circleForm.maxStudents}
                    onChange={e => setCircleForm({ ...circleForm, maxStudents: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">وقت البدء</label>
                  <input
                    type="time"
                    value={circleForm.startTime}
                    onChange={e => setCircleForm({ ...circleForm, startTime: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">وقت الانتهاء</label>
                  <input
                    type="time"
                    value={circleForm.endTime}
                    onChange={e => setCircleForm({ ...circleForm, endTime: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  آخر موعد لقبول بطاقة التحضير المبكر (ساعة التحضير المبكر ⭐)
                </label>
                <input
                  type="time"
                  value={circleForm.earlyPrepCutoffTime}
                  onChange={e => setCircleForm({ ...circleForm, earlyPrepCutoffTime: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                {editingCircle && (
                  <button
                    type="button"
                    onClick={() => {
                      setCircleModalOpen(false);
                      confirmDeleteCircle(editingCircle);
                    }}
                    className="flex items-center gap-1 text-rose-600 hover:text-rose-800 text-xs font-bold cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>أرشفة / حذف الحلقة</span>
                  </button>
                )}
                <div className="flex items-center gap-2 mr-auto">
                  <button
                    type="button"
                    onClick={() => setCircleModalOpen(false)}
                    className="px-4 py-2.5 text-stone-600 text-xs font-bold rounded-xl hover:bg-stone-100 transition active:scale-95 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    style={{ backgroundColor: settings.primaryColor || '#8E5364' }}
                    className="px-6 py-2.5 text-white text-xs font-bold rounded-xl shadow-xs transition hover:brightness-105 active:scale-95 cursor-pointer touch-manipulation"
                  >
                    حفظ بيانات الحلقة
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
