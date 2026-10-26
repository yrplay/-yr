import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Sparkles, Plus, Edit, Trash2, ExternalLink, CheckCircle2,
  AlertCircle, BookOpen, Clock, Award, Star, Video, Image, FileText,
  AlertTriangle, X, Check
} from 'lucide-react';
import { AtqiniAssignment, AtqiniRating, StudentAtqiniSubmission } from '../types';

export const AtqiniView: React.FC = () => {
  const {
    atqiniAssignments, studentAtqiniSubmissions, students, circles, tracks,
    createAtqiniAssignment, updateAtqiniAssignment, deleteAtqiniAssignment,
    saveAtqiniSubmission, currentUser, quickModalAction, clearQuickModal, showToast
  } = useApp();

  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>(
    atqiniAssignments[0]?.id || ''
  );

  // Modals state
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<AtqiniAssignment | null>(null);

  // Deletion confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [assignmentToDelete, setAssignmentToDelete] = useState<AtqiniAssignment | null>(null);

  const [evalModalOpen, setEvalModalOpen] = useState(false);
  const [evalStudent, setEvalStudent] = useState<any>(null);

  // Automatically open modal when quickModalAction is triggered
  React.useEffect(() => {
    if (quickModalAction?.type === 'atqini') {
      handleOpenAssignmentModal();
      clearQuickModal();
    }
  }, [quickModalAction]);

  // Keep selectedAssignmentId pointing to a valid assignment
  React.useEffect(() => {
    if (atqiniAssignments.length > 0 && !atqiniAssignments.find(a => a.id === selectedAssignmentId)) {
      setSelectedAssignmentId(atqiniAssignments[0].id);
    }
  }, [atqiniAssignments, selectedAssignmentId]);

  // Tajweed Templates for instant 1-click creation
  const TAJWEED_TEMPLATES = [
    {
      name: 'الإدغام بغنة وبغير غنة',
      title: 'واجب إتقان أحكام الإدغام',
      rule: 'الإدغام بغنة (ينمو) وبغير غنة (ل، ر)',
      desc: 'إدخال النون الساكنة أو التنوين في حرف الإدغام ليصيرا حرفاً واحداً مشدداً كالثاني.',
      instructions: 'استخراج ٤ أمثلة من السور المحفوظة والتدرب على الغنة بمقدار حركتين.',
      examples: 'مثالان لإدغام بغنة ومثالان لإدغام بغير غنة من المحفوظ.',
      application: 'مراعاة الغنة دون إفراط أو تمطيط أثناء جلسة التسميع.'
    },
    {
      name: 'الإخفاء الحقيقي (١٥ حرفاً)',
      title: 'واجب إتقان حكم الإخفاء الحقيقي',
      rule: 'الإخفاء الحقيقي عند حروف (ص، ذ، ث، ك، ج، ش، ق، س، د، ط، ز، ف، ت، ض، ظ)',
      desc: 'النطق بالنون الساكنة والتنوين بحالة بين الإظهار والإدغام عارياً عن التشديد مع بقاء الغنة.',
      instructions: 'استخراج ٥ أمثلة وتطبيق وضع اللسان قريباً من مخرج حرف الإخفاء.',
      examples: '٥ أمثلة لحروف الإخفاء المختلفة من السور المقررة.',
      application: 'أداء الغنة مرققة أو مفخمة بحسب الحرف الذي يليها أثناء التسميع.'
    },
    {
      name: 'القلقلة ومراتبها',
      title: 'واجب إتقان مراتب القلقلة',
      rule: 'القلقلة في حروف (قطب جد)',
      desc: 'اضطراب المخرج عند النطق بالحرف الساكن حتى يسمع له نبرة قوية.',
      instructions: 'بيان مراتب القلقلة (صغرى في وسط الكلمة، كبرى عند الوقف، أكبر عند المشدد الموقوف عليه).',
      examples: 'استخراج مثال للقلقلة الصغرى ومثالين للقلقلة عند الوقف.',
      application: 'تطبيق نبرة القلقلة دون خلطها بصوت حركة أثناء التسميع.'
    },
    {
      name: 'أحكام الميم الساكنة',
      title: 'واجب أحكام الميم الساكنة الثلاثة',
      rule: 'الإخفاء الشفوي، إدغام المتماثلين، والإظهار الشفوي',
      desc: 'أحكام الميم الساكنة الواقعة قبل أحكام الهجاء.',
      instructions: 'استخراج مثال للإخفاء الشفوي عند الباء، ومثال للإدغام عند الميم، ومثال للإظهار الشفوي.',
      examples: '٣ أمثلة تمثل الأحكام الثلاثة من سورة المقرر.',
      application: 'مراعاة عدم إخفاء الميم عند الواو والفاء لقرب واتحاد المخرج.'
    },
    {
      name: 'التفخيم والترقيق في الراء',
      title: 'واجب حالات تفخيم وترقيق الراء',
      rule: 'التفخيم والترقيق لحرف الراء',
      desc: 'بيان متى تفخم الراء (مفتوحة، مضمومة، أو ساكنة بعد فتح/ضم) ومتى ترقق.',
      instructions: 'استخراج أمثلة لراء مفخمة وراء مرققة مع تعليل السبب.',
      examples: 'مثالان لراء مفخمة ومثالان لراء مرققة.',
      application: 'الامتثال لصوت التفخيم برفع أقصى اللسان أثناء التلاوة.'
    },
    {
      name: 'المدود المتصلة والمنفصلة',
      title: 'واجب إتقان مقادير المدود',
      rule: 'المد الواجب المتصل والمد الجائز المنفصل',
      desc: 'حكم مد الصوت بحرف المد إذا جاء بعده همز في نفس الكلمة أو كلمتين.',
      instructions: 'تحديد مقدار المد ٤ أو ٥ حركات في المنفصل والمتصل.',
      examples: '٣ أمثلة للمتصل و٣ أمثلة للمنفصل.',
      application: 'موازنة أزمنة المدود وعدم التفاوت بينها أثناء التسميع.'
    }
  ];

  // Assignment Form State
  const [assignmentForm, setAssignmentForm] = useState({
    title: '',
    tajweedRule: '',
    description: '',
    sheikhVideoUrl: '',
    lessonImageUrl: '',
    publishedDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    requiredInstructions: '',
    examplesRequirement: '',
    recitationRuleApplication: '',
    maxScore: 10
  });

  // Student Evaluation Form
  const [subForm, setSubForm] = useState<{
    status: 'completed' | 'in_progress' | 'not_started' | 'late' | 'pending';
    isCompletedCorrectly: boolean;
    extractedExamplesDone: boolean;
    appliedDuringRecitation: boolean;
    rating: AtqiniRating;
    score: number;
    teacherNotes: string;
  }>({
    status: 'completed',
    isCompletedCorrectly: true,
    extractedExamplesDone: true,
    appliedDuringRecitation: true,
    rating: 'ممتاز',
    score: 10,
    teacherNotes: ''
  });

  const currentAssignment = atqiniAssignments.find(a => a.id === selectedAssignmentId) || atqiniAssignments[0];

  const handleApplyTemplate = (tpl: typeof TAJWEED_TEMPLATES[0]) => {
    setAssignmentForm(prev => ({
      ...prev,
      title: tpl.title,
      tajweedRule: tpl.rule,
      description: tpl.desc,
      requiredInstructions: tpl.instructions,
      examplesRequirement: tpl.examples,
      recitationRuleApplication: tpl.application
    }));
    showToast(`تم تطبيق قالب "${tpl.name}" بنجاح ✨`);
  };

  const handleOpenAssignmentModal = (assignment?: AtqiniAssignment) => {
    if (assignment) {
      setEditingAssignment(assignment);
      setAssignmentForm({
        title: assignment.title,
        tajweedRule: assignment.tajweedRule,
        description: assignment.description,
        sheikhVideoUrl: assignment.sheikhVideoUrl || '',
        lessonImageUrl: assignment.lessonImageUrl || '',
        publishedDate: assignment.publishedDate,
        dueDate: assignment.dueDate,
        requiredInstructions: assignment.requiredInstructions,
        examplesRequirement: assignment.examplesRequirement,
        recitationRuleApplication: assignment.recitationRuleApplication,
        maxScore: assignment.maxScore || 10
      });
    } else {
      setEditingAssignment(null);
      setAssignmentForm({
        title: 'واجب الإدغام بغنة وبغير غنة',
        tajweedRule: 'حكم الإدغام في النون الساكنة والتنوين',
        description: 'بيان حروف الإدغام الستة (يرملون) وتقسيمها إلى إدغام بغنة (ينمو) وبغير غنة (اللام والراء).',
        sheikhVideoUrl: 'https://www.youtube.com/watch?v=sampleTajweedIdgham',
        lessonImageUrl: '',
        publishedDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        requiredInstructions: 'استخراج ٤ أمثلة وتطبيق الإدغام أثناء جلسة التسميع مع مراعاة مقدار حركتين.',
        examplesRequirement: 'استخراج مثالين لإدغام بغنة ومثالين لإدغام بغير غنة من السور المقررة.',
        recitationRuleApplication: 'مراعاة كمال الغنة وصفاء المخرج دون تكلف أو تشديد زائد.',
        maxScore: 10
      });
    }
    setAssignmentModalOpen(true);
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignmentForm.title.trim() || !assignmentForm.tajweedRule.trim()) return;

    if (editingAssignment) {
      await updateAtqiniAssignment(editingAssignment.id, assignmentForm);
    } else {
      const created = await createAtqiniAssignment({
        ...assignmentForm,
        trackId: tracks[0]?.id || 't-1'
      });
      setSelectedAssignmentId(created.id);
    }
    setAssignmentModalOpen(false);
  };

  const confirmDeleteAssignment = (assignment: AtqiniAssignment) => {
    setAssignmentToDelete(assignment);
    setDeleteConfirmOpen(true);
  };

  const executeDeleteAssignment = async () => {
    if (!assignmentToDelete) return;
    await deleteAtqiniAssignment(assignmentToDelete.id);
    setDeleteConfirmOpen(false);
    setAssignmentModalOpen(false);
    setAssignmentToDelete(null);
  };

  const handleOpenEvalModal = (student: any) => {
    setEvalStudent(student);
    const existing = studentAtqiniSubmissions.find(
      s => s.assignmentId === currentAssignment?.id && s.studentId === student.id
    );
    if (existing) {
      setSubForm({
        status: existing.status,
        isCompletedCorrectly: existing.isCompletedCorrectly,
        extractedExamplesDone: existing.extractedExamplesDone,
        appliedDuringRecitation: existing.appliedDuringRecitation,
        rating: existing.rating,
        score: existing.score,
        teacherNotes: existing.teacherNotes || ''
      });
    } else {
      setSubForm({
        status: 'completed',
        isCompletedCorrectly: true,
        extractedExamplesDone: true,
        appliedDuringRecitation: true,
        rating: 'ممتاز',
        score: currentAssignment?.maxScore || 10,
        teacherNotes: ''
      });
    }
    setEvalModalOpen(true);
  };

  const handleSaveSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evalStudent || !currentAssignment) return;
    await saveAtqiniSubmission({
      assignmentId: currentAssignment.id,
      studentId: evalStudent.id,
      status: subForm.status,
      isCompletedCorrectly: subForm.isCompletedCorrectly,
      extractedExamplesDone: subForm.extractedExamplesDone,
      appliedDuringRecitation: subForm.appliedDuringRecitation,
      rating: subForm.rating,
      score: Number(subForm.score),
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
            <span className="text-xl">✨</span>
            <h2 className="text-xl font-bold text-stone-900 font-quran">قسم «أتقني» — واجبات التجويد حصرياً</h2>
          </div>
          <p className="text-xs text-stone-500">
            مخصص حصرياً لواجبات أحكام التلاوة والتجويد، استخراج الأمثلة من المحفوظ، وتطبيقها أثناء التسميع
          </p>
        </div>

        <button
          onClick={() => handleOpenAssignmentModal()}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition self-start sm:self-auto cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>نشر واجب تجويد جديد</span>
        </button>
      </div>

      {/* Assignments Selection Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {atqiniAssignments.map(as => (
          <button
            key={as.id}
            onClick={() => setSelectedAssignmentId(as.id)}
            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              selectedAssignmentId === as.id
                ? 'bg-[#8E5364] text-white shadow-xs'
                : 'bg-white text-stone-700 hover:bg-[#FAF6F2] border border-[#E8DFD8]'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>{as.tajweedRule}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
              selectedAssignmentId === as.id ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'
            }`}>
              {as.maxScore} درجات
            </span>
          </button>
        ))}

        {atqiniAssignments.length === 0 && (
          <div className="text-xs text-stone-400 p-3 bg-white rounded-2xl border border-stone-200">
            لا توجد واجبات تجويد منشورة بعد. انقري على «نشر واجب تجويد جديد» للبدء.
          </div>
        )}
      </div>

      {/* Active Assignment Card Details */}
      {currentAssignment && (
        <div className="bg-white p-6 rounded-3xl border border-[#E8DFD8] shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg">📖</span>
                <h3 className="text-base sm:text-lg font-bold text-stone-900">{currentAssignment.title}</h3>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                الحكم: <strong className="text-[#8E5364]">{currentAssignment.tajweedRule}</strong> • النشر: <strong>{currentAssignment.publishedDate}</strong> • التسليم: <strong className="text-rose-700">{currentAssignment.dueDate}</strong>
              </p>
            </div>

            <div className="flex items-center gap-2">
              {currentAssignment.sheikhVideoUrl && (
                <a
                  href={currentAssignment.sheikhVideoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 text-xs font-semibold flex items-center gap-1.5 hover:bg-rose-100 transition"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>شرح الشيخ المرئي</span>
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
              )}

              {/* Edit Assignment Button */}
              <button
                onClick={() => handleOpenAssignmentModal(currentAssignment)}
                className="p-2 text-stone-600 hover:text-stone-900 rounded-xl hover:bg-stone-100 text-xs flex items-center gap-1 border border-stone-200 transition cursor-pointer"
                title="تعديل بيانات الواجب"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>تعديل</span>
              </button>

              {/* Delete Assignment Button */}
              <button
                onClick={() => confirmDeleteAssignment(currentAssignment)}
                className="p-2 text-rose-600 hover:text-rose-800 rounded-xl hover:bg-rose-50 text-xs flex items-center gap-1 border border-rose-200 transition cursor-pointer"
                title="حذف هذا الواجب من المقرأة"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف الواجب</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-[#FCFAF8] border border-[#EFE8E2] text-xs">
              <span className="font-bold text-stone-800 block mb-1">شرح الحكم التجويدي:</span>
              <p className="text-stone-600 leading-relaxed text-[11px]">{currentAssignment.description}</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#FCFAF8] border border-[#EFE8E2] text-xs">
              <span className="font-bold text-stone-800 block mb-1">الأمثلة المطلوب استخراجها:</span>
              <p className="text-stone-600 leading-relaxed text-[11px]">{currentAssignment.examplesRequirement}</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#FCFAF8] border border-[#EFE8E2] text-xs">
              <span className="font-bold text-stone-800 block mb-1">طريقة التطبيق أثناء التسميع:</span>
              <p className="text-stone-600 leading-relaxed text-[11px]">{currentAssignment.recitationRuleApplication}</p>
            </div>
          </div>
        </div>
      )}

      {/* Students Submissions & Evaluation Roster */}
      {currentAssignment && (
        <div className="bg-white rounded-3xl border border-[#E8DFD8] shadow-2xs overflow-hidden">
          <div className="p-4 bg-[#FAF6F2] border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-stone-900 text-sm font-quran">
                كشف إنجاز وتصحيح الطالبات لواجب: {currentAssignment.tajweedRule}
              </h3>
              <span className="text-[11px] text-stone-500">
                رصد إتمام استخراج الأمثلة وتطبيق الحكم أثناء التسميع
              </span>
            </div>

            <div className="text-xs text-stone-600">
              تم تصحيح: <strong>{studentAtqiniSubmissions.filter(s => s.assignmentId === currentAssignment.id && s.status === 'completed').length}</strong> من {students.length} طالبة
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-stone-50 text-stone-500 font-bold border-b border-stone-200">
                  <th className="p-3.5">#</th>
                  <th className="p-3.5">اسم الطالبة</th>
                  <th className="p-3.5">الحلقة</th>
                  <th className="p-3.5 text-center">أتمت الواجب</th>
                  <th className="p-3.5 text-center">استخرجت الأمثلة</th>
                  <th className="p-3.5 text-center">طبقت أثناء التسميع</th>
                  <th className="p-3.5">التقدير</th>
                  <th className="p-3.5">الدرجة</th>
                  <th className="p-3.5">ملاحظات المعلمة</th>
                  <th className="p-3.5 text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {students.map((student, idx) => {
                  const circle = circles.find(c => c.id === student.circleId);
                  const sub = studentAtqiniSubmissions.find(
                    s => s.assignmentId === currentAssignment.id && s.studentId === student.id
                  );

                  return (
                    <tr key={student.id} className="hover:bg-[#FCF9FA] transition">
                      <td className="p-3.5 text-stone-400 font-semibold">{idx + 1}</td>

                      <td className="p-3.5 font-bold text-stone-900">
                        <div>{student.name}</div>
                        <div className="text-[10px] text-stone-400 font-mono">{student.code}</div>
                      </td>

                      <td className="p-3.5 text-stone-600">
                        {circle?.name || 'غير محدد'}
                      </td>

                      <td className="p-3.5 text-center">
                        {sub?.isCompletedCorrectly ? (
                          <span className="text-[#2D5A43] font-semibold">نعم ✅</span>
                        ) : (
                          <span className="text-stone-300">لم ينجز</span>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        {sub?.extractedExamplesDone ? (
                          <span className="text-[#2D5A43] font-semibold">استخرجت ✅</span>
                        ) : (
                          <span className="text-stone-300">لم تستخرج</span>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        {sub?.appliedDuringRecitation ? (
                          <span className="text-[#2D5A43] font-semibold">طبقت ✅</span>
                        ) : (
                          <span className="text-stone-300">بانتظار التسميع</span>
                        )}
                      </td>

                      <td className="p-3.5">
                        {sub?.rating ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#FAF2F4] text-[#8E5364] border border-[#EBD5DC]">
                            {sub.rating}
                          </span>
                        ) : (
                          <span className="text-stone-300">لم تقيم</span>
                        )}
                      </td>

                      <td className="p-3.5">
                        {sub ? (
                          <span className="font-extrabold text-sm text-stone-900">
                            {sub.score} <span className="text-[10px] text-stone-400">/ {currentAssignment?.maxScore || 10}</span>
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
                          className="px-3 py-1 bg-[#8E5364] hover:bg-[#744251] text-white rounded-lg text-[11px] font-bold transition shadow-2xs cursor-pointer active:scale-95"
                        >
                          {sub ? 'تعديل التصحيح' : 'تصحيح الواجب'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && assignmentToDelete && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-100 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-stone-900 text-base">
                تأكيد حذف واجب «أتقني» للتجويد
              </h3>
              <p className="text-xs text-stone-600 font-bold">
                «{assignmentToDelete.title}»
              </p>
            </div>

            <p className="text-xs text-stone-500 leading-relaxed bg-[#FCFAF8] p-3 rounded-2xl border border-stone-200">
              سيتم حذف الواجب وسجلات تصحيح الطالبات المرتبطة به نهائياً. هل أنتِ متأكدة من الاستمرار؟
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="px-4 py-2 text-stone-600 text-xs rounded-xl hover:bg-stone-100 font-semibold cursor-pointer"
              >
                إلغاء التراجع
              </button>
              <button
                type="button"
                onClick={executeDeleteAssignment}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
              >
                تأكيد الحذف الآن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Assignment Modal */}
      {assignmentModalOpen && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-xl border border-stone-200 max-h-[92vh] overflow-y-auto space-y-4">
            
            <div className="flex items-center justify-between border-b border-stone-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">✨</span>
                <h3 className="font-bold text-stone-900 text-base font-quran">
                  {editingAssignment ? 'تعديل واجب «أتقني»' : 'نشر واجب تجويد جديد'}
                </h3>
              </div>
              <button onClick={() => setAssignmentModalOpen(false)} className="text-stone-400 hover:text-stone-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Templates Selector */}
            {!editingAssignment && (
              <div className="p-3 bg-[#FAF7F4] rounded-2xl border border-[#EFE8E2] space-y-1.5">
                <span className="text-[11px] font-bold text-stone-700 block">
                  قوالب تجويدية جاهزة بضغطة زر (اختياري للسرعة):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {TAJWEED_TEMPLATES.map(tpl => (
                    <button
                      key={tpl.name}
                      type="button"
                      onClick={() => handleApplyTemplate(tpl)}
                      className="px-2.5 py-1 rounded-xl bg-white hover:bg-stone-50 border border-stone-200 text-[10px] font-bold text-stone-700 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      <span>✨</span>
                      <span>{tpl.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSaveAssignment} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">عنوان الواجب التجويدي *</label>
                <input
                  type="text"
                  required
                  value={assignmentForm.title}
                  onChange={e => setAssignmentForm({ ...assignmentForm, title: e.target.value })}
                  placeholder="مثال: واجب الإدغام بغنة وبغير غنة وأمثلته"
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-[#8E5364]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">الحكم التجويدي *</label>
                <input
                  type="text"
                  required
                  value={assignmentForm.tajweedRule}
                  onChange={e => setAssignmentForm({ ...assignmentForm, tajweedRule: e.target.value })}
                  placeholder="مثال: الإدغام بغنة وبغير غنة"
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-[#8E5364]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">شرح الحكم</label>
                <textarea
                  rows={2}
                  value={assignmentForm.description}
                  onChange={e => setAssignmentForm({ ...assignmentForm, description: e.target.value })}
                  placeholder="شرح مبسط وميسر لأحكام القاعدة..."
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-[#8E5364]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">رابط شرح الشيخ (يوتيوب/صوت)</label>
                  <input
                    type="url"
                    value={assignmentForm.sheikhVideoUrl}
                    onChange={e => setAssignmentForm({ ...assignmentForm, sheikhVideoUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">الدرجة القصوى للواجب</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={assignmentForm.maxScore}
                    onChange={e => setAssignmentForm({ ...assignmentForm, maxScore: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">تاريخ النشر</label>
                  <input
                    type="date"
                    value={assignmentForm.publishedDate}
                    onChange={e => setAssignmentForm({ ...assignmentForm, publishedDate: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">موعد التسليم النهائي</label>
                  <input
                    type="date"
                    value={assignmentForm.dueDate}
                    onChange={e => setAssignmentForm({ ...assignmentForm, dueDate: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">الأمثلة المطلوب استخراجها من المحفوظ</label>
                <input
                  type="text"
                  value={assignmentForm.examplesRequirement}
                  onChange={e => setAssignmentForm({ ...assignmentForm, examplesRequirement: e.target.value })}
                  placeholder="مثال: استخراج ٤ أمثلة للنون الساكنة والتنوين"
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">طريقة التطبيق أثناء التسميع</label>
                <input
                  type="text"
                  value={assignmentForm.recitationRuleApplication}
                  onChange={e => setAssignmentForm({ ...assignmentForm, recitationRuleApplication: e.target.value })}
                  placeholder="مثال: النطق السليم الصافي مع مراعاة زمن الغنة"
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-stone-100">
                {editingAssignment ? (
                  <button
                    type="button"
                    onClick={() => confirmDeleteAssignment(editingAssignment)}
                    className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف هذا الواجب</span>
                  </button>
                ) : <span />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAssignmentModalOpen(false)}
                    className="px-4 py-2 text-stone-600 text-xs rounded-xl hover:bg-stone-100 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#8E5364] text-white text-xs font-bold rounded-xl hover:bg-[#744251] shadow-xs active:scale-95 transition cursor-pointer"
                  >
                    {editingAssignment ? 'حفظ التعديلات' : 'نشر الواجب فوراً'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Correction & Rating Modal */}
      {evalModalOpen && evalStudent && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-stone-200">
            <h3 className="font-bold text-stone-900 text-base font-quran mb-1">
              تصحيح ورصد واجب «أتقني» للتجويد
            </h3>
            <p className="text-xs text-stone-500 mb-4">
              للطالبة: <strong>{evalStudent.name}</strong> • الواجب: <strong>{currentAssignment?.tajweedRule}</strong>
            </p>

            <form onSubmit={handleSaveSubmission} className="space-y-4">
              
              {/* Checkboxes for completion requirements */}
              <div className="space-y-2 bg-[#FAF6F2] p-3 rounded-2xl border border-[#EFE8E2]">
                <label className="flex items-center gap-2 text-xs font-medium text-stone-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={subForm.isCompletedCorrectly}
                    onChange={e => setSubForm({ ...subForm, isCompletedCorrectly: e.target.checked })}
                    className="rounded text-[#8E5364]"
                  />
                  <span>أتمت الواجب بالشكل المطلوب كاملاً ✅</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-medium text-stone-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={subForm.extractedExamplesDone}
                    onChange={e => setSubForm({ ...subForm, extractedExamplesDone: e.target.checked })}
                    className="rounded text-[#8E5364]"
                  />
                  <span>استخرجت الأمثلة من محفوظها بدقة</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-medium text-stone-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={subForm.appliedDuringRecitation}
                    onChange={e => setSubForm({ ...subForm, appliedDuringRecitation: e.target.checked })}
                    className="rounded text-[#8E5364]"
                  />
                  <span>طبقت الحكم التجويدي أثناء جلسة التسميع</span>
                </label>
              </div>

              {/* Rating and Score */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">التقدير اللفظي</label>
                  <select
                    value={subForm.rating}
                    onChange={e => setSubForm({ ...subForm, rating: e.target.value as AtqiniRating })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white font-bold"
                  >
                    <option value="ممتاز">ممتاز ⭐⭐⭐</option>
                    <option value="ممتاز جدًا">ممتاز جدًا ⭐⭐</option>
                    <option value="جيد جدًا">جيد جدًا ⭐</option>
                    <option value="جيد">جيد</option>
                    <option value="يحتاج إلى تحسين">يحتاج إلى تحسين</option>
                    <option value="لم يُنجز">لم يُنجز</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    الدرجة المستحقة (من {currentAssignment?.maxScore || 10})
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max={currentAssignment?.maxScore || 10}
                    value={subForm.score}
                    onChange={e => setSubForm({ ...subForm, score: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs font-bold text-stone-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">ملاحظات المعلمة وتوجيهات الإتقان</label>
                <textarea
                  rows={2}
                  value={subForm.teacherNotes}
                  onChange={e => setSubForm({ ...subForm, teacherNotes: e.target.value })}
                  placeholder="تشجيع الطالبة أو التنبيه على ملاحظات المخارج والصفات..."
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEvalModalOpen(false)}
                  className="px-4 py-2 text-stone-600 text-xs rounded-xl hover:bg-stone-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#8E5364] text-white text-xs font-bold rounded-xl hover:bg-[#744251] shadow-xs active:scale-95 transition"
                >
                  اعتماد التقييم والرصد
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
