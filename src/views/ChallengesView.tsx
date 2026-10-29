import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Trophy, Plus, Edit, Trash2, HeartHandshake, CheckCircle2,
  Calendar, Clock, Star, Users, Award, Shield, FileText, ChevronLeft,
  Printer, X
} from 'lucide-react';
import { Challenge, ChallengeType, hasFullAccess, StudentChallengeSubmission } from '../types';

export const ChallengesView: React.FC = () => {
  const {
    challenges, studentChallengeSubmissions, students, circles, tracks,
    createChallenge, updateChallenge, deleteChallenge,
    saveChallengeSubmission, currentUser, quickModalAction, clearQuickModal, settings
  } = useApp();

  const [activeTab, setActiveTab] = useState<'thursday' | 'grand' | 'peer_review'>('thursday');
  const [selectedChallengeId, setSelectedChallengeId] = useState<string>(
    challenges[0]?.id || ''
  );

  // Modals state
  const [challengeModalOpen, setChallengeModalOpen] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null);

  const [evalModalOpen, setEvalModalOpen] = useState(false);
  const [evalStudent, setEvalStudent] = useState<any>(null);

  // كشف سجل الثنائيات المعتمد
  const [selectedPairRecord, setSelectedPairRecord] = useState<{
    student: any;
    partner: any;
    sub: StudentChallengeSubmission | null;
  } | null>(null);

  // حالة تعديل وإضافة وحذف مهام ونقاط التحدي
  const [isEditingEvalTasks, setIsEditingEvalTasks] = useState(false);
  const [editableTasks, setEditableTasks] = useState<{ id: string; name: string; maxPoints: number }[]>([]);

  // Automatically open modal when quickModalAction is triggered
  React.useEffect(() => {
    if (quickModalAction?.type === 'challenge') {
      handleOpenChallengeModal();
      clearQuickModal();
    }
  }, [quickModalAction]);

  // Challenge Form State
  const [challengeForm, setChallengeForm] = useState({
    title: '',
    type: 'thursday_challenge' as ChallengeType,
    description: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    startTime: '16:00',
    endTime: '20:00',
    requiredSurahs: '',
    repetitionRequirements: '',
    completionConditions: '',
    dueDateDescription: 'الخميس قبل الساعة ٨:٠٠ مساءً',
    maxTotalPoints: 10,
    earlyPrepPoints: 2,
    includesPeerReview: true,
    tasks: [
      { id: 't-1', name: 'الاستماع المجود للمقرر مرتين', maxPoints: 2 },
      { id: 't-2', name: 'التكرار الفردي المتقن غيباً ٥ مرات', maxPoints: 2 },
      { id: 't-3', name: 'المراجعة الثنائية والتسميع المتبادل مع الرفيقة', maxPoints: 4 },
      { id: 't-4', name: 'التحضير المبكر وإرسال بطاقة الإنجاز', maxPoints: 2 }
    ]
  });

  // Submission Evaluation Form State (including Peer Review rubric)
  const [subForm, setSubForm] = useState({
    earlyPrepPointsEarned: 2,
    tasksCompleted: [] as { taskId: string, completed: boolean, earnedPoints: number }[],
    peerReviewEvaluation: {
      jointRevisionCompleted: true,
      commitmentScore: 2,
      detectedErrorsScore: 2,
      correctionScore: 1,
      collaborationScore: 1,
      onTimeScore: 2,
      totalEarned: 8,
      notes: ''
    },
    totalPointsEarned: 10,
    teacherNotes: ''
  });

  const currentChallenge = challenges.find(c => c.id === selectedChallengeId) || challenges[0];

  const handleDeleteChallenge = async (challengeId: string, challengeTitle: string) => {
    if (challenges.length <= 1) {
      alert('لا يمكن حذف التحدي الوحيد المتبقي في المقرأة. يمكنكِ تعديل بياناته بدلاً من حذفه.');
      return;
    }
    if (window.confirm(`هل أنتِ متأكدة من حذف تحدي "${challengeTitle}" نهائياً من النظام؟`)) {
      await deleteChallenge(challengeId);
      const remaining = challenges.filter(c => c.id !== challengeId);
      if (remaining.length > 0) {
        setSelectedChallengeId(remaining[0].id);
      }
    }
  };

  const handleOpenChallengeModal = (challenge?: Challenge) => {
    if (challenge) {
      setEditingChallenge(challenge);
      setChallengeForm({
        title: challenge.title,
        type: challenge.type,
        description: challenge.description,
        startDate: challenge.startDate,
        endDate: challenge.endDate,
        startTime: challenge.startTime || '16:00',
        endTime: challenge.endTime || '20:00',
        requiredSurahs: challenge.requiredSurahs,
        repetitionRequirements: challenge.repetitionRequirements,
        completionConditions: challenge.completionConditions,
        dueDateDescription: challenge.dueDateDescription,
        maxTotalPoints: challenge.maxTotalPoints,
        earlyPrepPoints: challenge.earlyPrepPoints,
        includesPeerReview: challenge.includesPeerReview ?? true,
        tasks: (challenge.tasks || []).map((t: any) => ({
          id: t.id,
          name: t.name || t.title || '',
          maxPoints: t.maxPoints ?? t.points ?? 2
        }))
      });
    } else {
      setEditingChallenge(null);
      setChallengeForm({
        title: 'تحدي الخميس القرآني الجديد',
        type: 'thursday_challenge',
        description: 'تحدي تمكيني لتثبيت المحفوظ وإتقان الترتيل والمراجعة الثنائية مع الرفيقة.',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        startTime: '16:00',
        endTime: '20:00',
        requiredSurahs: 'سورة البقرة: مقرر الأسبوع',
        repetitionRequirements: 'الاستماع مرتين + التكرار ٥ مرات غيباً',
        completionConditions: 'إتمام السماع والتكرار والتسميع للرفيقة وتدوين الأخطاء',
        dueDateDescription: 'الخميس قبل الساعة ٨:٠٠ مساءً',
        maxTotalPoints: 10,
        earlyPrepPoints: 2,
        includesPeerReview: true,
        tasks: [
          { id: 't-1', name: 'الاستماع المجود للمقرر مرتين', maxPoints: 2 },
          { id: 't-2', name: 'التكرار الفردي المتقن غيباً ٥ مرات', maxPoints: 2 },
          { id: 't-3', name: 'المراجعة الثنائية والتسميع المتبادل مع الرفيقة', maxPoints: 4 },
          { id: 't-4', name: 'التحضير المبكر وإرسال بطاقة الإنجاز', maxPoints: 2 }
        ]
      });
    }
    setChallengeModalOpen(true);
  };

  const handleSaveChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeForm.title.trim()) return;
    if (editingChallenge) {
      await updateChallenge(editingChallenge.id, challengeForm);
      setSelectedChallengeId(editingChallenge.id);
    } else {
      const created = await createChallenge({
        ...challengeForm,
        trackId: tracks[0]?.id || 't-1'
      });
      if (created?.id) {
        setSelectedChallengeId(created.id);
      }
    }
    setActiveTab('thursday');
    setChallengeModalOpen(false);
  };

  const handleOpenEvalModal = (student: any) => {
    setEvalStudent(student);
    const existing = studentChallengeSubmissions.find(
      s => s.challengeId === currentChallenge?.id && s.studentId === student.id
    );

    if (existing) {
      setSubForm({
        earlyPrepPointsEarned: existing.earlyPrepPointsEarned || 0,
        tasksCompleted: existing.tasksCompleted || [],
        peerReviewEvaluation: existing.peerReviewEvaluation || {
          jointRevisionCompleted: true,
          commitmentScore: 2,
          detectedErrorsScore: 2,
          correctionScore: 1,
          collaborationScore: 1,
          onTimeScore: 2,
          totalEarned: 8,
          notes: ''
        },
        totalPointsEarned: existing.totalPointsEarned,
        teacherNotes: existing.teacherNotes || ''
      });
    } else {
      const initialTasks = (currentChallenge?.tasks || []).map(t => ({
        taskId: t.id,
        completed: true,
        earnedPoints: t.maxPoints
      }));
      setSubForm({
        earlyPrepPointsEarned: currentChallenge?.earlyPrepPoints || 2,
        tasksCompleted: initialTasks,
        peerReviewEvaluation: {
          jointRevisionCompleted: true,
          commitmentScore: 2,
          detectedErrorsScore: 2,
          correctionScore: 1,
          collaborationScore: 1,
          onTimeScore: 2,
          totalEarned: 8,
          notes: ''
        },
        totalPointsEarned: currentChallenge?.maxTotalPoints || 10,
        teacherNotes: ''
      });
    }
    setEvalModalOpen(true);
  };

  const handleSaveSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evalStudent || !currentChallenge) return;

    // Recalculate peer total and overall total
    const peerSum = subForm.peerReviewEvaluation
      ? (subForm.peerReviewEvaluation.commitmentScore +
         subForm.peerReviewEvaluation.detectedErrorsScore +
         subForm.peerReviewEvaluation.correctionScore +
         subForm.peerReviewEvaluation.collaborationScore +
         subForm.peerReviewEvaluation.onTimeScore)
      : 0;

    let tasksSum = 0;
    subForm.tasksCompleted.forEach(t => { if (t.completed) tasksSum += t.earnedPoints; });
    const finalTotal = Math.min(currentChallenge.maxTotalPoints, tasksSum + (subForm.earlyPrepPointsEarned || 0));

    await saveChallengeSubmission({
      challengeId: currentChallenge.id,
      studentId: evalStudent.id,
      partnerStudentId: evalStudent.partnerStudentId,
      partnerStudentName: evalStudent.partnerStudentName,
      tasksCompleted: subForm.tasksCompleted,
      earlyPrepPointsEarned: Number(subForm.earlyPrepPointsEarned),
      peerReviewEvaluation: {
        ...subForm.peerReviewEvaluation,
        totalEarned: Number(peerSum.toFixed(1))
      },
      totalPointsEarned: Number(finalTotal.toFixed(1)),
      teacherNotes: subForm.teacherNotes
    });

    setEvalModalOpen(false);
  };

  return (
    <div className="space-y-6">

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-[#E8DFD8] shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🏆</span>
            <h2 className="text-xl font-bold text-stone-900 font-quran">التحديات القرآنية والمراجعة الثنائية</h2>
          </div>
          <p className="text-xs text-stone-500">
            تحدي الخميس الأسبوعي، تحديات المراجعة الكبرى، وتقييم تعاون الرفيقة في اكتشاف وتصحيح الأخطاء
          </p>
        </div>

        <button
          onClick={() => handleOpenChallengeModal()}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>إنشاء تحدٍ قرآني جديد</span>
        </button>
      </div>

      {/* Section Tabs: Challenges vs Peer Review Matrix */}
      <div className="flex items-center gap-2 border-b border-stone-200 pb-2">
        <button
          onClick={() => setActiveTab('thursday')}
          className={`px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
            activeTab === 'thursday'
              ? 'bg-[#8E5364] text-white shadow-xs'
              : 'text-stone-600 hover:bg-[#FAF6F2]'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>سجل التحديات القرآنية ({challenges.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('peer_review')}
          className={`px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
            activeTab === 'peer_review'
              ? 'bg-[#8E5364] text-white shadow-xs'
              : 'text-stone-600 hover:bg-[#FAF6F2]'
          }`}
        >
          <HeartHandshake className="w-4 h-4" />
          <span>مصفوفة المراجعة الثنائية وتعاون الرفيقة 🤝</span>
        </button>
      </div>

      {/* Challenges List Selector (عرض جميع التحديات مع إمكانية التحديد والحذف والتعديل) */}
      {activeTab !== 'peer_review' && (
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-[#E8DFD8] shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-2.5">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[#8E5364]" />
              <h3 className="font-bold text-stone-900 text-sm">
                جميع التحديات القرآنية المتاحة في المقرأة ({challenges.length}):
              </h3>
              <span className="text-[11px] text-stone-400">
                (انقري على أي تحدٍ لاختياره وعرض تفاصيله ورصد طالباته بالأسفل)
              </span>
            </div>

            {hasFullAccess(currentUser) && (
              <button
                type="button"
                onClick={() => handleOpenChallengeModal()}
                className="px-3 py-1.5 bg-[#FAF0F3] hover:bg-[#8E5364] text-[#8E5364] hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 self-start cursor-pointer border border-[#8E5364]/20 shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة تحدٍ قرآني جديد</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {challenges.map(ch => {
              const isSelected = currentChallenge?.id === ch.id;
              return (
                <div
                  key={ch.id}
                  onClick={() => setSelectedChallengeId(ch.id)}
                  className={`p-3.5 rounded-2xl border transition text-right cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-[#FAF2F4] border-[#8E5364] ring-2 ring-[#8E5364]/20 shadow-xs'
                      : 'bg-[#FCFAF8] border-stone-200 hover:border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <span className="text-base">{isSelected ? '🌟' : '🎯'}</span>
                        <span className={`font-bold text-xs truncate ${isSelected ? 'text-[#8E5364]' : 'text-stone-900'}`}>
                          {ch.title}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 shrink-0">
                        {ch.maxTotalPoints} نقاط
                      </span>
                    </div>

                    <div className="text-[11px] text-stone-500 space-y-1 mb-2">
                      <div className="truncate">
                        آلية ومقرر: <strong className="text-stone-700">{ch.requiredSurahs || 'غير محدد'}</strong>
                      </div>
                      <div className="text-[10px] text-stone-400 flex items-center gap-1">
                        <span>📅</span>
                        <span>{ch.dueDateDescription || ch.startDate}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-stone-200/60 mt-auto">
                    <span className={`text-[10px] font-bold ${isSelected ? 'text-[#8E5364]' : 'text-stone-400'}`}>
                      {isSelected ? 'المحدد والمعروض حالياً ✅' : 'انقري لاختياره 👈'}
                    </span>

                    {hasFullAccess(currentUser) && (
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleOpenChallengeModal(ch)}
                          className="p-1.5 text-stone-500 hover:text-[#8E5364] hover:bg-white rounded-lg transition"
                          title="تعديل هذا التحدي"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteChallenge(ch.id, ch.title)}
                          className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="حذف هذا التحدي"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Challenge Overview Card (معلومات وتفاصيل التحدي المختار) */}
      {currentChallenge && activeTab !== 'peer_review' && (
        <div className="bg-white p-6 rounded-3xl border border-[#E8DFD8] shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">🌟</span>
                <h3 className="text-base sm:text-lg font-bold text-stone-900">{currentChallenge.title}</h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                  {currentChallenge.maxTotalPoints} نقاط
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                  التحدي المختار المعروض حالياً 📌
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-1">
                آلية التحدي والمقرر: <strong className="text-stone-800">{currentChallenge.requiredSurahs}</strong> • الموعد: <strong>{currentChallenge.dueDateDescription}</strong>
              </p>
            </div>

            {hasFullAccess(currentUser) && (
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => handleOpenChallengeModal(currentChallenge)}
                  className="px-3 py-1.5 text-stone-700 hover:text-[#8E5364] bg-stone-50 hover:bg-[#FAF0F3] rounded-xl text-xs font-bold flex items-center gap-1.5 border border-stone-200 transition cursor-pointer"
                  title="تعديل هذا التحدي"
                >
                  <Edit className="w-3.5 h-3.5 text-[#8E5364]" />
                  <span>تعديل هذا التحدي</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteChallenge(currentChallenge.id, currentChallenge.title)}
                  className="px-3 py-1.5 text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-rose-200 transition cursor-pointer"
                  title="حذف هذا التحدي"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>حذف التحدي</span>
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-[#FCFAF8] border border-[#EFE8E2]">
              <span className="font-bold text-stone-800 block mb-1">آلية التحدي والمقرر المطلوب:</span>
              <p className="text-stone-600 leading-relaxed text-[11px]">{currentChallenge.requiredSurahs || currentChallenge.description || 'حفظ وتثبيت المقرر الأسبوعي'}</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#FCFAF8] border border-[#EFE8E2]">
              <span className="font-bold text-stone-800 block mb-1">مقدار التكرار والاستماع:</span>
              <p className="text-stone-600 leading-relaxed text-[11px]">{currentChallenge.repetitionRequirements || 'الاستماع مرتين + التكرار ٥ مرات غيباً'}</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#FCFAF8] border border-[#EFE8E2]">
              <span className="font-bold text-stone-800 block mb-1">شروط إتمام التحدي وموعد التسليم:</span>
              <p className="text-stone-600 leading-relaxed text-[11px]">{currentChallenge.completionConditions || currentChallenge.dueDateDescription || 'الخميس قبل الساعة ٨:٠٠ مساءً'}</p>
            </div>
          </div>

          {/* Tasks & Points Summary */}
          {currentChallenge.tasks && currentChallenge.tasks.length > 0 && (
            <div className="pt-2 border-t border-stone-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-stone-700">مهام ونقاط هذا التحدي ({currentChallenge.tasks.length}):</span>
                {hasFullAccess(currentUser) && (
                  <button
                    type="button"
                    onClick={() => handleOpenChallengeModal(currentChallenge)}
                    className="text-[11px] font-bold text-[#8E5364] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Edit className="w-3 h-3" />
                    <span>تعديل المهام والنقاط</span>
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {currentChallenge.tasks.map((task: any, idx: number) => (
                  <span
                    key={task.id || idx}
                    className="px-2.5 py-1 rounded-xl bg-stone-50 border border-stone-200 text-[11px] font-medium text-stone-700 flex items-center gap-1.5"
                  >
                    <span>{task.name || task.title}</span>
                    <strong className="text-[#8E5364] font-bold bg-white px-1.5 py-0.5 rounded-md border border-stone-200">
                      {task.maxPoints ?? task.points ?? 2} نقاط
                    </strong>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Roster & Evaluation Table for Challenge */}
      {activeTab !== 'peer_review' ? (
        <div className="bg-white rounded-3xl border border-[#E8DFD8] shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-stone-100 flex items-center justify-between">
            <h4 className="font-bold text-stone-800 text-sm">
              سجل نتائج الطالبات في التحدي والمراجعة الثنائية
            </h4>
            <span className="text-xs text-[#8E5364] font-semibold">
              المراجعة الثنائية جزء مدمج داخل التحدي
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-[#FAF6F2] text-stone-600 font-bold border-b border-stone-200">
                  <th className="p-3.5">#</th>
                  <th className="p-3.5">اسم الطالبة</th>
                  <th className="p-3.5">الرفيقة القرآنية</th>
                  <th className="p-3.5 text-center">التحضير المبكر للتحدي</th>
                  <th className="p-3.5 text-center">المراجعة المشتركة</th>
                  <th className="p-3.5">نقاط تعاون الرفيقة</th>
                  <th className="p-3.5">مجموع نقاط التحدي</th>
                  <th className="p-3.5">ملاحظات التقييم</th>
                  <th className="p-3.5 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {students.filter(s => s.status === 'active').map((student, idx) => {
                  const sub = studentChallengeSubmissions.find(
                    c => c.challengeId === currentChallenge?.id && c.studentId === student.id
                  );

                  return (
                    <tr key={student.id} className="hover:bg-[#FCF9FA] transition">
                      <td className="p-3.5 font-semibold text-stone-400">{idx + 1}</td>
                      <td className="p-3.5 font-bold text-stone-900">{student.name}</td>

                      <td className="p-3.5">
                        {student.partnerStudentName ? (
                          <span className="inline-flex items-center gap-1 bg-[#F5ECE8] text-[#7A4B37] px-2 py-0.5 rounded-full text-[11px] font-semibold">
                            <span>🤝</span> {student.partnerStudentName}
                          </span>
                        ) : (
                          <span className="text-stone-300">غير معينة</span>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        {sub?.earlyPrepPointsEarned ? (
                          <span className="text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded-full">
                            +{sub.earlyPrepPointsEarned} نقاط ⭐
                          </span>
                        ) : (
                          <span className="text-stone-300">—</span>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        {sub?.peerReviewEvaluation?.jointRevisionCompleted ? (
                          <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
                            تمت بنجاح ✅
                          </span>
                        ) : (
                          <span className="text-stone-300">بانتظار الرصد</span>
                        )}
                      </td>

                      <td className="p-3.5">
                        {sub?.peerReviewEvaluation ? (
                          <div>
                            <span className="font-bold text-[#8E5364]">
                              {sub.peerReviewEvaluation.totalEarned} نقاط
                            </span>
                            <div className="text-[10px] text-stone-400">
                              تصحيح أخطاء وتعاون
                            </div>
                          </div>
                        ) : (
                          <span className="text-stone-300">—</span>
                        )}
                      </td>

                      <td className="p-3.5">
                        {sub ? (
                          <span className="font-extrabold text-sm text-stone-900">
                            {sub.totalPointsEarned} <span className="text-[10px] text-stone-400">/ {currentChallenge?.maxTotalPoints || 10}</span>
                          </span>
                        ) : (
                          <span className="text-stone-300">—</span>
                        )}
                      </td>

                      <td className="p-3.5 text-stone-600 max-w-xs truncate">
                        {sub?.teacherNotes || '—'}
                      </td>

                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => handleOpenEvalModal(student)}
                          className="px-3 py-1 bg-[#8E5364] hover:bg-[#744251] text-white rounded-lg text-[11px] font-bold transition shadow-2xs"
                        >
                          {sub ? 'تعديل النتيجة' : 'رصد التحدي'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Peer Review Matrix Tab */
        <div className="bg-white rounded-3xl border border-[#E8DFD8] p-6 shadow-2xs space-y-6">
          <div className="border-b border-stone-100 pb-4">
            <h3 className="font-bold text-stone-900 text-base font-quran mb-1">
              مصفوفة المراجعة الثنائية وتعاون الرفيقات 🤝
            </h3>
            <p className="text-xs text-stone-500">
              المراجعة الثنائية جزء أصيل من تحديات الخميس؛ حيث تقيَّم كل طالبة وفق معايير مساعدة رفيقتها، اكتشاف الأخطاء، تصحيحها، والالتزام بآداب المدارسة.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {students.filter(s => s.partnerStudentId).map(student => {
              const partner = students.find(s => s.id === student.partnerStudentId);
              const sub = studentChallengeSubmissions.find(
                c => c.challengeId === currentChallenge?.id && c.studentId === student.id
              );
              const circle = circles.find(c => c.id === student.circleId);

              return (
                <div key={student.id} className="p-4 rounded-2xl bg-[#FCFAF8] border border-[#EFE8E2] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-500 font-mono">{student.code}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FAF0F3] text-[#8E5364] font-semibold">
                      {circle?.name}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedPairRecord({ student, partner: partner || null, sub: sub || null })}
                    className="w-full text-right flex items-center justify-between p-2.5 rounded-xl bg-white hover:bg-[#FAF2F4] border border-[#EAE0D8] hover:border-[#8E5364] transition group cursor-pointer shadow-2xs hover:shadow-xs"
                    title="انقري لفتح كشف سجل الثنائية والمراجعة المشتركة 📜"
                  >
                    <div className="text-xs">
                      <div className="font-bold text-stone-900 group-hover:text-[#8E5364] transition">{student.name}</div>
                      <div className="text-[10px] text-stone-400">الطالبة</div>
                    </div>
                    <span className="text-stone-400 group-hover:text-[#8E5364] group-hover:scale-110 transition text-sm">↔️</span>
                    <div className="text-xs text-left">
                      <div className="font-bold text-[#7A4B37] group-hover:text-[#8E5364] transition">{partner?.name || student.partnerStudentName}</div>
                      <div className="text-[10px] text-stone-400">الرفيقة</div>
                    </div>
                  </button>

                  <div className="space-y-1.5 text-[11px] text-stone-600 pt-1">
                    <div className="flex justify-between">
                      <span>إتمام المراجعة المشتركة:</span>
                      <span className="font-bold text-emerald-700">
                        {sub?.peerReviewEvaluation?.jointRevisionCompleted ? 'نعم ✅' : 'قيد الإجراء'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>درجة اكتشاف وتصحيح الأخطاء:</span>
                      <span className="font-bold text-stone-800">
                        {(sub?.peerReviewEvaluation?.detectedErrorsScore || 0) + (sub?.peerReviewEvaluation?.correctionScore || 0)} نقاط
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>التعاون والالتزام بالوقت:</span>
                      <span className="font-bold text-stone-800">
                        {(sub?.peerReviewEvaluation?.collaborationScore || 0) + (sub?.peerReviewEvaluation?.onTimeScore || 0)} نقاط
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenEvalModal(student)}
                    className="w-full py-1.5 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs font-bold transition shadow-2xs"
                  >
                    تقييم أداء الرفيقة في التحدي
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Challenge Evaluation Modal */}
      {evalModalOpen && evalStudent && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-xl border border-stone-200 max-h-[92vh] overflow-y-auto">
            <h3 className="font-bold text-stone-900 text-base font-quran mb-1">
              رصد نقاط التحدي والمراجعة الثنائية
            </h3>
            <p className="text-xs text-stone-500 mb-4">
              للطالبة: <strong>{evalStudent.name}</strong> • الرفيقة: <strong>{evalStudent.partnerStudentName || 'لم تعين'}</strong>
            </p>

            <form onSubmit={handleSaveSubmission} className="space-y-4">
              
              {/* Tasks Checklist with Edit / Add / Delete Capability */}
              <div className="bg-[#FAF6F2] p-4 rounded-2xl border border-[#EFE8E2] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <span>📋</span>
                    <span>مهام التحدي المقررة والنقاط:</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isEditingEvalTasks) {
                        setEditableTasks(
                          (currentChallenge?.tasks || []).map((t: any) => ({
                            id: t.id,
                            name: t.name || t.title || '',
                            maxPoints: Number(t.maxPoints ?? t.points ?? 2)
                          }))
                        );
                        setIsEditingEvalTasks(true);
                      } else {
                        setIsEditingEvalTasks(false);
                      }
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-stone-50 border border-stone-200 text-[#8E5364] hover:text-[#744251] rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                  >
                    <Edit className="w-3 h-3" />
                    <span>{isEditingEvalTasks ? 'إنهاء التعديل والعودة' : 'تعديل أو إضافة أو حذف المهام ⚙️'}</span>
                  </button>
                </div>

                {!isEditingEvalTasks ? (
                  // وضع الرصد العادي
                  <div className="space-y-2">
                    {(currentChallenge?.tasks || []).map((task: any) => {
                      const taskStatus = subForm.tasksCompleted.find(t => t.taskId === task.id);
                      const isChecked = taskStatus ? taskStatus.completed : true;

                      return (
                        <label key={task.id} className="flex items-center justify-between p-2 rounded-xl bg-white border border-stone-200 cursor-pointer text-xs hover:border-[#8E5364]/40 transition">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={e => {
                                const newTasks = [...subForm.tasksCompleted];
                                const tIdx = newTasks.findIndex(t => t.taskId === task.id);
                                if (tIdx >= 0) {
                                  newTasks[tIdx].completed = e.target.checked;
                                } else {
                                  newTasks.push({ taskId: task.id, completed: e.target.checked, earnedPoints: task.maxPoints ?? task.points ?? 2 });
                                }
                                setSubForm({ ...subForm, tasksCompleted: newTasks });
                              }}
                              className="rounded text-[#8E5364]"
                            />
                            <span>{task.name || task.title}</span>
                          </div>
                          <span className="font-bold text-stone-600 text-[11px] bg-stone-100 px-2 py-0.5 rounded-md">
                            {task.maxPoints ?? task.points ?? 2} نقاط
                          </span>
                        </label>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => {
                        setEditableTasks(
                          (currentChallenge?.tasks || []).map((t: any) => ({
                            id: t.id,
                            name: t.name || t.title || '',
                            maxPoints: Number(t.maxPoints ?? t.points ?? 2)
                          }))
                        );
                        setIsEditingEvalTasks(true);
                      }}
                      className="w-full py-1 text-center text-[11px] font-bold text-[#8E5364] hover:underline cursor-pointer pt-1"
                    >
                      + تعديل مهام هذا التحدي، إضافة مهمة جديدة، أو تعديل وحذف النقاط
                    </button>
                  </div>
                ) : (
                  // وضع تعديل وإضافة وحذف المهام والنقاط
                  <div className="space-y-2.5 pt-1">
                    <p className="text-[11px] text-stone-500">
                      يمكنكِ هنا تعديل مسمى أي مهمة، تغيير نقاطها، حذفها، أو إضافة مهام جديدة للتحدي:
                    </p>

                    <div className="space-y-2 max-h-60 overflow-y-auto p-1">
                      {editableTasks.map((t, idx) => (
                        <div key={t.id || idx} className="p-2.5 rounded-xl bg-white border border-stone-200 flex items-center gap-2">
                          <div className="flex-1">
                            <input
                              type="text"
                              value={t.name}
                              onChange={e => {
                                const updated = [...editableTasks];
                                updated[idx].name = e.target.value;
                                setEditableTasks(updated);
                              }}
                              placeholder="اسم المهمة المطلوبة"
                              className="w-full px-2.5 py-1.5 border border-stone-200 rounded-lg text-xs"
                            />
                          </div>
                          <div className="w-24 flex items-center gap-1">
                            <input
                              type="number"
                              min="1"
                              max="50"
                              value={t.maxPoints}
                              onChange={e => {
                                const updated = [...editableTasks];
                                updated[idx].maxPoints = Math.max(1, Number(e.target.value));
                                setEditableTasks(updated);
                              }}
                              className="w-14 px-2 py-1.5 border border-stone-200 rounded-lg text-xs text-center font-bold"
                            />
                            <span className="text-[11px] text-stone-500">نقاط</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = editableTasks.filter((_, i) => i !== idx);
                              setEditableTasks(updated);
                            }}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="حذف هذه المهمة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Add new task button */}
                    <button
                      type="button"
                      onClick={() => {
                        const newId = `t-${Date.now()}`;
                        setEditableTasks([
                          ...editableTasks,
                          { id: newId, name: 'مهمة قرآنية جديدة', maxPoints: 2 }
                        ]);
                      }}
                      className="w-full py-2 bg-white hover:bg-[#FAF0F3] border border-dashed border-[#8E5364]/40 hover:border-[#8E5364] text-[#8E5364] rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة مهمة جديدة للتحدي</span>
                    </button>

                    {/* Save or Cancel */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={async () => {
                          if (!currentChallenge) return;
                          await updateChallenge(currentChallenge.id, {
                            tasks: editableTasks
                          });
                          setIsEditingEvalTasks(false);
                        }}
                        className="flex-1 py-2 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>حفظ التعديلات في التحدي</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingEvalTasks(false)}
                        className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Peer Review Rubric (معايير تعاون الرفيقة) */}
              <div className="border border-[#E8DFD8] p-4 rounded-2xl space-y-3">
                <div className="text-xs font-bold text-stone-800 flex items-center justify-between">
                  <span>بنود تقييم المراجعة الثنائية وتعاون الرفيقة:</span>
                  <span className="text-[10px] text-stone-400 font-normal">تُحسب ضمن التحدي</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-stone-700 mb-1">الالتزام بالمقرر (من ٢):</label>
                      <input
                        type="number"
                        min="0"
                        max="2"
                        step="0.5"
                        value={subForm.peerReviewEvaluation.commitmentScore}
                        onChange={e => setSubForm({
                          ...subForm,
                          peerReviewEvaluation: { ...subForm.peerReviewEvaluation, commitmentScore: Number(e.target.value) }
                        })}
                        className="w-full px-2.5 py-1.5 border border-stone-200 rounded-xl text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-stone-700 mb-1">مساعدة الرفيقة على اكتشاف الأخطاء (من ٢):</label>
                      <input
                        type="number"
                        min="0"
                        max="2"
                        step="0.5"
                        value={subForm.peerReviewEvaluation.detectedErrorsScore}
                        onChange={e => setSubForm({
                          ...subForm,
                          peerReviewEvaluation: { ...subForm.peerReviewEvaluation, detectedErrorsScore: Number(e.target.value) }
                        })}
                        className="w-full px-2.5 py-1.5 border border-stone-200 rounded-xl text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-stone-700 mb-1">تصحيح الأخطاء (من ١):</label>
                      <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.5"
                        value={subForm.peerReviewEvaluation.correctionScore}
                        onChange={e => setSubForm({
                          ...subForm,
                          peerReviewEvaluation: { ...subForm.peerReviewEvaluation, correctionScore: Number(e.target.value) }
                        })}
                        className="w-full px-2 py-1.5 border border-stone-200 rounded-xl text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-stone-700 mb-1">التعاون والآداب (من ١):</label>
                      <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.5"
                        value={subForm.peerReviewEvaluation.collaborationScore}
                        onChange={e => setSubForm({
                          ...subForm,
                          peerReviewEvaluation: { ...subForm.peerReviewEvaluation, collaborationScore: Number(e.target.value) }
                        })}
                        className="w-full px-2 py-1.5 border border-stone-200 rounded-xl text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-stone-700 mb-1">التسليم بالموعد (من ٢):</label>
                      <input
                        type="number"
                        min="0"
                        max="2"
                        step="0.5"
                        value={subForm.peerReviewEvaluation.onTimeScore}
                        onChange={e => setSubForm({
                          ...subForm,
                          peerReviewEvaluation: { ...subForm.peerReviewEvaluation, onTimeScore: Number(e.target.value) }
                        })}
                        className="w-full px-2 py-1.5 border border-stone-200 rounded-xl text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">ملاحظات المعلمة والمشرفة على التحدي:</label>
                <textarea
                  rows={2}
                  value={subForm.teacherNotes}
                  onChange={e => setSubForm({ ...subForm, teacherNotes: e.target.value })}
                  placeholder="تشجيع، توجيه للمراجعة الثنائية..."
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setEvalModalOpen(false)}
                  className="px-4 py-2.5 text-stone-600 text-xs font-bold rounded-xl hover:bg-stone-100 transition active:scale-95 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  style={{ backgroundColor: settings.primaryColor || '#8E5364' }}
                  className="px-6 py-2.5 text-white text-xs font-bold rounded-xl shadow-xs transition hover:brightness-105 active:scale-95 cursor-pointer touch-manipulation"
                >
                  اعتماد ورصد نتيجة التحدي
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Challenge Modal */}
      {challengeModalOpen && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-xl border border-stone-200 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-stone-900 text-base font-quran mb-3">
              {editingChallenge ? 'تعديل بيانات التحدي القرآني' : 'إنشاء تحدٍ قرآني جديد'}
            </h3>
            <form onSubmit={handleSaveChallenge} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">عنوان التحدي</label>
                <input
                  type="text"
                  required
                  value={challengeForm.title}
                  onChange={e => setChallengeForm({ ...challengeForm, title: e.target.value })}
                  placeholder="مثال: تحدي تمكين الربع الثاني من سورة البقرة"
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">نوع التحدي</label>
                  <select
                    value={challengeForm.type}
                    onChange={e => setChallengeForm({ ...challengeForm, type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white"
                  >
                    <option value="thursday_challenge">التحديات </option>
                    <option value="grand_revision">تحدي المراجعة الكبرى</option>
                    <option value="custom">تحدٍ مخصص</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">الدرجة القصوى</label>
                  <input
                    type="number"
                    min="1"
                    value={challengeForm.maxTotalPoints}
                    onChange={e => setChallengeForm({ ...challengeForm, maxTotalPoints: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">آلية التحدي،</label>
                <input
                  type="text"
                  required
                  value={challengeForm.requiredSurahs}
                  onChange={e => setChallengeForm({ ...challengeForm, requiredSurahs: e.target.value })}
                  placeholder="مثال: سورة البقرة من آية ٢٥ إلى ٥٠"
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">مقدار التكرار والاستماع</label>
                <input
                  type="text"
                  value={challengeForm.repetitionRequirements}
                  onChange={e => setChallengeForm({ ...challengeForm, repetitionRequirements: e.target.value })}
                  placeholder="مثال: الاستماع مرتين + التكرار ٥ مرات غيباً"
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">شروط إتمام التحدي وموعد التسليم</label>
                <input
                  type="text"
                  value={challengeForm.completionConditions}
                  onChange={e => setChallengeForm({ ...challengeForm, completionConditions: e.target.value })}
                  placeholder="مثال: إتمام التسميع للرفيقة وتدوين الأخطاء قبل الساعة ٨ مساءً"
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                />
              </div>

              {/* Challenge Tasks Management (تعديل، إضافة، وحذف المهام والنقاط) */}
              <div className="bg-[#FAF6F2] p-4 rounded-2xl border border-[#EFE8E2] space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <span>📋</span>
                    <span>مهام التحدي المقررة وتوزيع النقاط:</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const newId = `t-${Date.now()}`;
                      setChallengeForm({
                        ...challengeForm,
                        tasks: [
                          ...challengeForm.tasks,
                          { id: newId, name: 'مهمة قرآنية جديدة', maxPoints: 2 }
                        ]
                      });
                    }}
                    className="text-[11px] font-bold text-[#8E5364] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة مهمة جديدة</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto p-0.5">
                  {(challengeForm.tasks || []).map((task, idx) => (
                    <div key={task.id || idx} className="p-2 rounded-xl bg-white border border-stone-200 flex items-center gap-2">
                      <input
                        type="text"
                        value={task.name}
                        onChange={e => {
                          const updated = [...challengeForm.tasks];
                          updated[idx].name = e.target.value;
                          setChallengeForm({ ...challengeForm, tasks: updated });
                        }}
                        placeholder="اسم المهمة المطلوبة"
                        className="flex-1 px-2.5 py-1.5 border border-stone-200 rounded-lg text-xs"
                      />
                      <div className="w-24 flex items-center gap-1">
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={task.maxPoints}
                          onChange={e => {
                            const updated = [...challengeForm.tasks];
                            updated[idx].maxPoints = Math.max(1, Number(e.target.value));
                            setChallengeForm({ ...challengeForm, tasks: updated });
                          }}
                          className="w-14 px-2 py-1.5 border border-stone-200 rounded-lg text-xs text-center font-bold"
                        />
                        <span className="text-[11px] text-stone-500">نقاط</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = challengeForm.tasks.filter((_, i) => i !== idx);
                          setChallengeForm({ ...challengeForm, tasks: updated });
                        }}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title="حذف هذه المهمة"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setChallengeModalOpen(false)}
                  className="px-4 py-2 text-stone-600 text-xs rounded-xl hover:bg-stone-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#8E5364] text-white text-xs font-bold rounded-xl hover:bg-[#744251]"
                >
                  حفظ وإطلاق التحدي
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pair Record Sheet Modal (كشف سجل الثنائيات والمراجعة المشتركة) */}
      {selectedPairRecord && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-stone-200 max-h-[92vh] overflow-y-auto space-y-5 animate-in fade-in zoom-in-95 duration-150">
            
            {/* Header */}
            <div className="flex items-start justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#FAF0F3] border border-[#8E5364]/20 text-[#8E5364] flex items-center justify-center text-xl shadow-2xs">
                  📜
                </div>
                <div>
                  <h3 className="font-bold text-stone-900 text-base font-quran flex items-center gap-2">
                    <span>كشف سجل الثنائيات والمراجعة المشتركة</span>
                    <span className="text-[10px] font-sans px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                      معتمد 🤝
                    </span>
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    توثيق مسار الرفيقة القرآنية والمراجعة التبادلية بين الطالبتين وفق معايير الإتقان
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPairRecord(null)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Students Duo Banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-[#FAF0F3] via-white to-[#FAF0F3] border border-[#8E5364]/20">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center text-center">
                {/* Student 1 */}
                <div className="p-3 rounded-xl bg-white border border-stone-200 shadow-2xs space-y-1">
                  <div className="text-[10px] text-stone-400 font-semibold">الطالبة الأولى</div>
                  <div className="text-sm font-bold text-stone-900">{selectedPairRecord.student.name}</div>
                  <div className="text-[11px] font-mono text-[#8E5364] font-semibold">{selectedPairRecord.student.code}</div>
                  <div className="text-[10px] text-stone-500">
                    {circles.find(c => c.id === selectedPairRecord.student.circleId)?.name || 'الحلقة'}
                  </div>
                </div>

                {/* Connection Bridge */}
                <div className="flex flex-col items-center justify-center py-2 space-y-1">
                  <span className="text-2xl animate-pulse">🤝</span>
                  <span className="text-xs font-bold text-[#8E5364]">عقد مدارسة ثنائية</span>
                  <span className="text-[10px] text-stone-400">تسميع متبادل واكتشاف أخطاء</span>
                </div>

                {/* Student 2 (Partner) */}
                <div className="p-3 rounded-xl bg-white border border-stone-200 shadow-2xs space-y-1">
                  <div className="text-[10px] text-stone-400 font-semibold">الرفيقة المعينة</div>
                  <div className="text-sm font-bold text-[#7A4B37]">
                    {selectedPairRecord.partner?.name || selectedPairRecord.student.partnerStudentName || 'الرفيقة'}
                  </div>
                  <div className="text-[11px] font-mono text-stone-600 font-semibold">
                    {selectedPairRecord.partner?.code || '—'}
                  </div>
                  <div className="text-[10px] text-stone-500">
                    {circles.find(c => c.id === selectedPairRecord.partner?.circleId)?.name || circles.find(c => c.id === selectedPairRecord.student.circleId)?.name || 'الحلقة'}
                  </div>
                </div>
              </div>
            </div>

            {/* Current Challenge & Joint Status */}
            <div className="p-4 rounded-2xl bg-[#FCFAF8] border border-stone-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/60 pb-2.5">
                <div>
                  <span className="text-xs text-stone-400 block">التحدي الحالي المرصود:</span>
                  <span className="text-sm font-bold text-stone-900">{currentChallenge?.title || 'تحدي الخميس القرآني'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-stone-500">حالة المراجعة:</span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                    selectedPairRecord.sub?.peerReviewEvaluation?.jointRevisionCompleted
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {selectedPairRecord.sub?.peerReviewEvaluation?.jointRevisionCompleted
                      ? 'تمت المراجعة والتسميع المشترك بنجاح ✅'
                      : 'قيد التسميع والمدارسة ⏳'}
                  </span>
                </div>
              </div>

              {/* Rubric Breakdown */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-stone-700 block">تفصيل معايير تقييم المراجعة الثنائية:</span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-white border border-stone-200 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-stone-800">⏰ الالتزام بالموعد والمقرر</div>
                      <div className="text-[10px] text-stone-400">الحضور في وقت التحدي والالتزام بالورد</div>
                    </div>
                    <span className="text-xs font-bold text-[#8E5364] bg-[#FAF0F3] px-2 py-0.5 rounded-lg">
                      {selectedPairRecord.sub?.peerReviewEvaluation?.commitmentScore ?? 2} / 2 نقاط
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white border border-stone-200 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-stone-800">🎯 اكتشاف وتصحيح الأخطاء</div>
                      <div className="text-[10px] text-stone-400">التنبيه الدقيق على التجويد والضبط</div>
                    </div>
                    <span className="text-xs font-bold text-[#8E5364] bg-[#FAF0F3] px-2 py-0.5 rounded-lg">
                      {(selectedPairRecord.sub?.peerReviewEvaluation?.detectedErrorsScore ?? 2) + (selectedPairRecord.sub?.peerReviewEvaluation?.correctionScore ?? 1)} / 3 نقاط
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white border border-stone-200 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-stone-800">🤝 التعاون والتشجيع الأخوي</div>
                      <div className="text-[10px] text-stone-400">روح الفريق والمدارسة برفق</div>
                    </div>
                    <span className="text-xs font-bold text-[#8E5364] bg-[#FAF0F3] px-2 py-0.5 rounded-lg">
                      {(selectedPairRecord.sub?.peerReviewEvaluation?.collaborationScore ?? 1) + (selectedPairRecord.sub?.peerReviewEvaluation?.onTimeScore ?? 2)} / 3 نقاط
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white border border-stone-200 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-stone-800">🏆 مجموع نقاط التحدي</div>
                      <div className="text-[10px] text-stone-400">مجموع درجات الثنائية المكتسبة</div>
                    </div>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                      {selectedPairRecord.sub?.totalPointsEarned ?? 10} / {currentChallenge?.maxTotalPoints ?? 10} نقاط
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Guidance & Teacher Notes */}
            <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/80 text-xs space-y-1">
              <div className="font-bold text-amber-900 flex items-center gap-1.5">
                <span>💡</span>
                <span>توجيهات المعلمة لمسار هذه الثنائية:</span>
              </div>
              <p className="text-amber-800 text-[11px] leading-relaxed">
                {selectedPairRecord.sub?.teacherNotes || selectedPairRecord.sub?.peerReviewEvaluation?.notes ||
                  'ثنائية متألقة في ضبط الآيات، ويُنصح بالاستمرار في الاستماع المشترك للشيخ الحصري رحمه الله مع التركيز على تبيين مراتب الغنن والمدود قبل موعد التحدي.'}
              </p>
            </div>

            {/* Historical peer reviews summary */}
            <div className="border border-stone-200 rounded-2xl p-3.5 bg-white space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-stone-800">سجل التحديات والمراجعات المشتركة السابقة:</span>
                <span className="text-[10px] text-stone-400">إجمالي التحديات: {challenges.length}</span>
              </div>
              <div className="space-y-1.5">
                {challenges.slice(0, 3).map(ch => {
                  const chSub = studentChallengeSubmissions.find(s => s.challengeId === ch.id && s.studentId === selectedPairRecord.student.id);
                  return (
                    <div key={ch.id} className="flex items-center justify-between p-2 rounded-lg bg-stone-50 text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="text-stone-400">📅</span>
                        <span className="font-medium text-stone-800">{ch.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-stone-400 font-mono text-[10px]">{ch.startDate}</span>
                        <span className="font-bold text-emerald-700">
                          {chSub ? `${chSub.totalPointsEarned} نقاط ✅` : 'مكتمل بنجاح ✅'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions Footer */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const st = selectedPairRecord.student;
                    setSelectedPairRecord(null);
                    handleOpenEvalModal(st);
                  }}
                  className="px-4 py-2 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>تعديل ورصد درجات التحدي</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة الكشف</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPairRecord(null)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                إغلاق الكشف
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
