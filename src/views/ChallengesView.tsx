import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Trophy, Plus, Edit, Trash2, HeartHandshake, CheckCircle2,
  Calendar, Clock, Star, Users, Award, Shield, FileText, ChevronLeft
} from 'lucide-react';
import { Challenge, ChallengeType, StudentChallengeSubmission } from '../types';

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

  const thursdayChallenges = challenges.filter(c => c.type === 'thursday_challenge');
  const grandChallenges = challenges.filter(c => c.type === 'grand_revision');

  const displayedChallenges = activeTab === 'grand' ? grandChallenges : thursdayChallenges;
  const currentChallenge = challenges.find(c => c.id === selectedChallengeId) || displayedChallenges[0] || challenges[0];

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
        title: activeTab === 'grand' ? 'تحدي المراجعة الكبرى الجديد' : 'تحدي الخميس القرآني الجديد',
        type: activeTab === 'grand' ? 'grand_revision' : 'thursday_challenge',
        description: 'تحدي تمكيني لتثبيت المحفوظ وإتقان الترتيل والمراجعة الثنائية مع الرفيقة.',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        startTime: '16:00',
        endTime: '20:00',
        requiredSurahs: 'سورة البقرة: مقرر الأسبوع',
        repetitionRequirements: 'الاستماع مرتين + التكرار ٥ مرات غيباً',
        completionConditions: 'إتمام السماع والتكرار والتسميع للرفيقة وتدوين الأخطاء',
        dueDateDescription: 'الخميس قبل الساعة ٨:٠٠ مساءً',
        maxTotalPoints: activeTab === 'grand' ? 20 : 10,
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
    } else {
      const created = await createChallenge({
        ...challengeForm,
        trackId: tracks[0]?.id || 't-1'
      });
      setSelectedChallengeId(created.id);
    }
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

      {/* Section Tabs: Thursday Challenge vs Grand Revision vs Peer Review Matrix */}
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
          <span>تحدي الخميس الأسبوعي ({thursdayChallenges.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('grand')}
          className={`px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
            activeTab === 'grand'
              ? 'bg-[#8E5364] text-white shadow-xs'
              : 'text-stone-600 hover:bg-[#FAF6F2]'
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span>تحديات المراجعة الكبرى ({grandChallenges.length})</span>
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

      {/* Challenge Overview Card */}
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
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                المقرر: <strong className="text-stone-800">{currentChallenge.requiredSurahs}</strong> • الموعد: <strong>{currentChallenge.dueDateDescription}</strong>
              </p>
            </div>

            {currentUser?.role === 'leader' && (
              <button
                onClick={() => handleOpenChallengeModal(currentChallenge)}
                className="p-2 text-stone-400 hover:text-stone-800 rounded-xl hover:bg-stone-100 text-xs flex items-center gap-1 border border-stone-200 self-start sm:self-auto"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>تعديل التحدي</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-[#FCFAF8] border border-[#EFE8E2]">
              <span className="font-bold text-stone-800 block mb-1">وصف التحدي والمهام:</span>
              <p className="text-stone-600 leading-relaxed text-[11px]">{currentChallenge.description}</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#FCFAF8] border border-[#EFE8E2]">
              <span className="font-bold text-stone-800 block mb-1">مقدار التكرار والاستماع:</span>
              <p className="text-stone-600 leading-relaxed text-[11px]">{currentChallenge.repetitionRequirements}</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#FCFAF8] border border-[#EFE8E2]">
              <span className="font-bold text-stone-800 block mb-1">شروط إتمام التحدي:</span>
              <p className="text-stone-600 leading-relaxed text-[11px]">{currentChallenge.completionConditions}</p>
            </div>
          </div>
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

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[#EAE0D8]">
                    <div className="text-xs">
                      <div className="font-bold text-stone-900">{student.name}</div>
                      <div className="text-[10px] text-stone-400">الطالبة</div>
                    </div>
                    <span className="text-stone-300">↔️</span>
                    <div className="text-xs text-left">
                      <div className="font-bold text-[#7A4B37]">{partner?.name || student.partnerStudentName}</div>
                      <div className="text-[10px] text-stone-400">الرفيقة</div>
                    </div>
                  </div>

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
              
              {/* Tasks Checklist */}
              <div className="bg-[#FAF6F2] p-4 rounded-2xl border border-[#EFE8E2] space-y-2.5">
                <div className="text-xs font-bold text-stone-800">مهام التحدي المقررة:</div>
                {(currentChallenge?.tasks || []).map((task, idx) => {
                  const taskStatus = subForm.tasksCompleted.find(t => t.taskId === task.id);
                  const isChecked = taskStatus ? taskStatus.completed : true;

                  return (
                    <label key={task.id} className="flex items-center justify-between p-2 rounded-xl bg-white border border-stone-200 cursor-pointer text-xs">
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
                              newTasks.push({ taskId: task.id, completed: e.target.checked, earnedPoints: task.maxPoints });
                            }
                            setSubForm({ ...subForm, tasksCompleted: newTasks });
                          }}
                          className="rounded text-[#8E5364]"
                        />
                        <span>{task.name}</span>
                      </div>
                      <span className="font-bold text-stone-600 text-[11px]">{task.maxPoints} نقاط</span>
                    </label>
                  );
                })}
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
                    <option value="thursday_challenge">تحدي الخميس الأسبوعي</option>
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
                <label className="block text-xs font-bold text-stone-700 mb-1">السور والمقاطع المطلوبة</label>
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

    </div>
  );
};
