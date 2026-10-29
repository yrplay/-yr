import React, { useState, useMemo } from 'react';
import { 
  ArrowRight, Settings, Users, BookOpen, Layers, 
  CheckCircle2, Clock, AlertCircle, Edit3, Plus, 
  Sparkles, Trash2, X, Check, ShieldCheck, BookmarkCheck,
  Award, Calendar, MessageSquareQuote
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { hasFullAccess, Track, CustomMasteryCriterion } from '../types';

interface TrackDetailViewProps {
  trackId: string;
  onBack?: () => void;
  onNavigateToSection?: (section: string) => void;
}

export const TrackDetailView: React.FC<TrackDetailViewProps> = ({ 
  trackId, 
  onBack, 
  onNavigateToSection 
}) => {
  const { 
    tracks, circles, students, currentUser,
    updateTrack, updateTrackSystemRules
  } = useApp();

  const [showEditModal, setShowEditModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'mastery' | 'rules' | 'circles' | 'students'>('mastery');

  // صلاحية تعديل معايير المسار
  const canEditCriteria = hasFullAccess(currentUser) || !!currentUser?.permissions?.canEditTrackCriteria;

  // حالة إضافة معيار جديد مخصص داخل النافذة
  const [newCriterionTitle, setNewCriterionTitle] = useState('');
  const [newCriterionCount, setNewCriterionCount] = useState<number>(3);
  const [newCriterionUnit, setNewCriterionUnit] = useState('مرات');

  const track = tracks.find(t => t.id === trackId) || tracks[0];

  const handleBackNavigation = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (onBack) {
      onBack();
    }
    if (onNavigateToSection) {
      onNavigateToSection('tracks_circles');
    }
  };

  const trackCircles = useMemo(() => {
    if (!track) return [];
    return circles.filter(c => c.trackId === track.id && !c.isArchived);
  }, [circles, track]);

  const trackStudents = useMemo(() => {
    if (!track) return [];
    return students.filter(s => s.trackId === track.id && s.status === 'active');
  }, [students, track]);

  // المعايير الموحدة للمسار (كلها زي بعض)
  const unifiedCriteriaList = useMemo(() => {
    const mg = track?.systemRules?.masteryGuide;
    if (mg?.unifiedCriteria && mg.unifiedCriteria.length > 0) {
      return mg.unifiedCriteria;
    }
    const list: Array<{ id: string; title: string; count: number; unit: string; description?: string }> = [
      { id: 'crit-listen', title: 'الاستماع للمقرئ', count: mg?.listenToReciterTimes || 3, unit: 'مرات تكرار', description: 'الاستماع المتقن لمصحف الترتيل بصوت أحد مشاهير القراء المعتمدين لضبط الأداء والتجويد.' },
      { id: 'crit-recite', title: 'التلاوة نظراً من المصحف', count: mg?.reciteLookingTimes || 5, unit: 'مرات تلاوة', description: 'القراءة البصرية من المصحف مع مطابقة مخارج الحروف والوقف والابتداء ورسم المصحف.' },
      { id: 'crit-repeat', title: 'التكرار المتقن غيباً', count: mg?.masteryRepetitionTimes || 20, unit: 'مرة غيباً', description: 'التكرار الغيبي المركز للآيات حتى بلوغ درجة الانسيابية التامة ورسوخ الحفظ في الصدر.' }
    ];
    if (mg?.customCriteria && Array.isArray(mg.customCriteria)) {
      mg.customCriteria.forEach((c, idx) => {
        list.push({
          id: c.id || `crit-custom-${idx}`,
          title: c.title,
          count: c.count || 1,
          unit: c.unit || 'مرات',
          description: c.description || 'معيار معتمد لتعزيز جودة الأداء والإتقان القرآني.'
        });
      });
    }
    return list;
  }, [track]);

  // إعدادات المسار المنهجية
  const [editFormData, setEditFormData] = useState({
    name: track?.name || '',
    description: track?.description || '',
    earlyPrep: track?.systemRules?.earlyPreparation ?? true,
    atqiniReq: track?.systemRules?.atqiniHomeworkRequired ?? true,
    thursdayChallenges: track?.systemRules?.thursdayChallenges ?? true,
    customPlans: track?.systemRules?.customPlansAllowed ?? false,
    workflowText: track?.systemRules?.detailedWorkflowText || '',
    minorRevAmount: track?.systemRules?.masteryGuide?.minorRevisionAmount || 'آخر ٣ أوجه',
    tamkeenRevAmount: track?.systemRules?.masteryGuide?.tamkeenRevisionAmount || 'ربع حزب',
    criteriaList: [] as Array<{ id: string; title: string; count: number; unit: string; description?: string }>
  });

  const handleOpenEditModal = () => {
    if (track) {
      setEditFormData({
        name: track.name || '',
        description: track.description || '',
        earlyPrep: track.systemRules?.earlyPreparation ?? true,
        atqiniReq: track.systemRules?.atqiniHomeworkRequired ?? true,
        thursdayChallenges: track.systemRules?.thursdayChallenges ?? true,
        customPlans: track.systemRules?.customPlansAllowed ?? false,
        workflowText: track.systemRules?.detailedWorkflowText || '',
        minorRevAmount: track.systemRules?.masteryGuide?.minorRevisionAmount || 'آخر ٣ أوجه',
        tamkeenRevAmount: track.systemRules?.masteryGuide?.tamkeenRevisionAmount || 'ربع حزب',
        criteriaList: unifiedCriteriaList.map(c => ({ ...c }))
      });
    }
    setShowEditModal(true);
  };

  const handleAddCriterionToForm = () => {
    if (!newCriterionTitle.trim()) return;
    const newCrit = {
      id: `crit-${Date.now()}`,
      title: newCriterionTitle.trim(),
      count: Number(newCriterionCount) || 1,
      unit: newCriterionUnit || 'مرات',
      description: 'معيار معتمد لتعزيز جودة الأداء والإتقان القرآني.'
    };
    setEditFormData(prev => ({
      ...prev,
      criteriaList: [...prev.criteriaList, newCrit]
    }));
    setNewCriterionTitle('');
  };

  const handleRemoveCriterionFromForm = (id: string) => {
    setEditFormData(prev => ({
      ...prev,
      criteriaList: prev.criteriaList.filter(c => c.id !== id)
    }));
  };

  const handleDirectDeleteCriterion = async (id: string) => {
    if (!track) return;
    const updatedList = unifiedCriteriaList.filter(c => c.id !== id);
    const listenItem = updatedList.find(c => c.id === 'crit-listen' || c.title.includes('استماع'));
    const reciteItem = updatedList.find(c => c.id === 'crit-recite' || c.title.includes('نظراً'));
    const repeatItem = updatedList.find(c => c.id === 'crit-repeat' || c.title.includes('تكرار'));

    await updateTrackSystemRules(track.id, {
      masteryGuide: {
        ...(track.systemRules?.masteryGuide || {
          minorRevisionAmount: 'آخر ٣ أوجه',
          tamkeenRevisionAmount: 'ربع حزب',
          pointsPerCondition: 2
        }),
        unifiedCriteria: updatedList,
        listenToReciterTimes: listenItem?.count || 3,
        reciteLookingTimes: reciteItem?.count || 5,
        masteryRepetitionTimes: repeatItem?.count || 20,
        customCriteria: updatedList.filter(c => c.id !== 'crit-listen' && c.id !== 'crit-recite' && c.id !== 'crit-repeat')
      }
    });
  };

  const handleSaveTrackRules = async () => {
    if (!track) return;
    await updateTrack(track.id, {
      name: editFormData.name,
      description: editFormData.description
    });

    const listenItem = editFormData.criteriaList.find(c => c.id === 'crit-listen' || c.title.includes('استماع'));
    const reciteItem = editFormData.criteriaList.find(c => c.id === 'crit-recite' || c.title.includes('نظراً'));
    const repeatItem = editFormData.criteriaList.find(c => c.id === 'crit-repeat' || c.title.includes('تكرار'));

    await updateTrackSystemRules(track.id, {
      earlyPreparation: editFormData.earlyPrep,
      atqiniHomeworkRequired: editFormData.atqiniReq,
      thursdayChallenges: editFormData.thursdayChallenges,
      customPlansAllowed: editFormData.customPlans,
      detailedWorkflowText: editFormData.workflowText,
      masteryGuide: {
        unifiedCriteria: editFormData.criteriaList,
        listenToReciterTimes: listenItem?.count || 3,
        reciteLookingTimes: reciteItem?.count || 5,
        masteryRepetitionTimes: repeatItem?.count || 20,
        minorRevisionAmount: editFormData.minorRevAmount,
        tamkeenRevisionAmount: editFormData.tamkeenRevAmount,
        pointsPerCondition: 2,
        customCriteria: editFormData.criteriaList.filter(c => c.id !== 'crit-listen' && c.id !== 'crit-recite' && c.id !== 'crit-repeat')
      }
    });

    setShowEditModal(false);
  };

  if (!track) {
    return (
      <div className="bg-white dark:bg-stone-900 p-8 rounded-3xl border border-[#E2D5CC] dark:border-stone-800 text-center space-y-4" dir="rtl">
        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
        <h3 className="text-base font-bold text-stone-800 dark:text-stone-100">المسار المطلوب غير موجود</h3>
        <button
          type="button"
          onClick={handleBackNavigation}
          className="px-4 py-2 bg-[#8E5364] text-white rounded-xl text-xs font-bold"
        >
          العودة للمسارات والحلقات
        </button>
      </div>
    );
  }

  const customCriteriaList = track.systemRules?.masteryGuide?.customCriteria || [];

  return (
    <div className="space-y-6 text-right pb-12" dir="rtl">
      {/* رأس الصفحة المنهجية */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-stone-900 p-6 rounded-3xl border border-[#E2D5CC] dark:border-stone-800 shadow-xs">
        <div className="flex items-center gap-4">
          <button 
            type="button"
            onClick={handleBackNavigation}
            className="p-2.5 px-3 rounded-2xl bg-[#FAF7F5] dark:bg-stone-800 hover:bg-[#F2EAE5] dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 transition flex items-center gap-1.5 cursor-pointer font-bold text-xs border border-[#E2D5CC] dark:border-stone-700 hover:shadow-xs active:scale-95"
            title="رجوع إلى المسارات والحلقات"
          >
            <ArrowRight className="w-4 h-4 text-[#8E5364]" />
            <span>رجوع</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{track.icon || '📖'}</span>
              <h1 className="text-xl font-bold text-stone-800 dark:text-stone-100 font-quran">
                معايير دليل الإتقان — مسار {track.name}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold border border-emerald-200/60 dark:border-emerald-800/40">
                {track.code}
              </span>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-xl">
              {track.description || 'المنهجية القرآنية المعتمدة، معايير التكرار والاستماع، وضوابط التسميع والمراجعة اليومية'}
            </p>
          </div>
        </div>

        {canEditCriteria && (
          <button
            type="button"
            onClick={handleOpenEditModal}
            className="px-4 py-2.5 bg-[#8E5364] hover:bg-[#744251] text-white rounded-2xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer active:scale-95"
          >
            <Settings className="w-4 h-4" />
            <span>تعديل معايير دليل الإتقان</span>
          </button>
        )}
      </div>

      {/* المؤشرات التعليمية والتربوية للمسار */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-[#E2D5CC] dark:border-stone-800">
          <span className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1.5 font-bold">
            <BookOpen className="w-3.5 h-3.5 text-[#8E5364]" />
            إجمالي معايير المسار
          </span>
          <p className="text-xl font-bold text-[#8E5364] dark:text-[#E8BDC8] mt-1">
            {unifiedCriteriaList.length} <span className="text-xs font-normal text-stone-400">معايير إتقان معتمدة</span>
          </p>
        </div>

        <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-[#E2D5CC] dark:border-stone-800">
          <span className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1.5 font-bold">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            الدرجة المستهدفة
          </span>
          <p className="text-xl font-bold text-amber-700 dark:text-amber-400 mt-1">
            ١٠ / ١٠ <span className="text-xs font-normal text-stone-400">نقاط كاملة</span>
          </p>
        </div>

        <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-[#E2D5CC] dark:border-stone-800">
          <span className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1.5 font-bold">
            <Layers className="w-3.5 h-3.5 text-emerald-600" />
            الحلقات التابعة للمسار
          </span>
          <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">
            {trackCircles.length} <span className="text-xs font-normal text-stone-400">حلقات</span>
          </p>
        </div>

        <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-[#E2D5CC] dark:border-stone-800">
          <span className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1.5 font-bold">
            <Users className="w-3.5 h-3.5 text-[#8E5364]" />
            الطالبات المنتظمات
          </span>
          <p className="text-xl font-bold text-[#8E5364] dark:text-[#E8BDC8] mt-1">
            {trackStudents.length} <span className="text-xs font-normal text-stone-400">طالبة</span>
          </p>
        </div>
      </div>

      {/* شريط التبويبات التعليمية */}
      <div className="flex border-b border-[#E2D5CC] dark:border-stone-800 gap-6 text-sm font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('mastery')}
          className={`pb-3 transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'mastery' 
              ? 'border-b-2 border-[#8E5364] text-[#8E5364] dark:text-[#E8BDC8]' 
              : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
          }`}
        >
          <Award className="w-4 h-4" />
          معايير دليل الإتقان ({unifiedCriteriaList.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('rules')}
          className={`pb-3 transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'rules' 
              ? 'border-b-2 border-[#8E5364] text-[#8E5364] dark:text-[#E8BDC8]' 
              : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          الضوابط والآلية المنهجية
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('circles')}
          className={`pb-3 transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'circles' 
              ? 'border-b-2 border-[#8E5364] text-[#8E5364] dark:text-[#E8BDC8]' 
              : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          الحلقات القرآنية ({trackCircles.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('students')}
          className={`pb-3 transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'students' 
              ? 'border-b-2 border-[#8E5364] text-[#8E5364] dark:text-[#E8BDC8]' 
              : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
          }`}
        >
          <Users className="w-4 h-4" />
          طالبات المسار ({trackStudents.length})
        </button>
      </div>

      {/* تبويب معايير دليل الإتقان الموحدة (كلها زي بعض) */}
      {activeTab === 'mastery' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl border border-[#E2D5CC] dark:border-stone-800 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">
                  <span>📖</span>
                  <span>معايير دليل الإتقان المعتمدة لمسار {track.name}</span>
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                  المعايير المنهجية المعتمدة لتحضير وتثبيت الأوجه القرآنية (كل المعايير متساوية وموحدة وقابلة للتعديل والإضافة)
                </p>
              </div>

              {canEditCriteria && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleOpenEditModal}
                    className="px-3.5 py-2 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة أو تعديل معيار</span>
                  </button>
                </div>
              )}
            </div>

            {/* شبكة بطاقات المعايير الموحدة */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-1">
              {unifiedCriteriaList.map((crit, idx) => (
                <div 
                  key={crit.id} 
                  className="p-5 rounded-2xl bg-gradient-to-br from-[#FAF7F5] to-white dark:from-stone-800/60 dark:to-stone-900 border border-[#E2D5CC] dark:border-stone-700 flex flex-col justify-between hover:shadow-xs transition relative group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-8 h-8 rounded-xl bg-[#FAF0F3] text-[#8E5364] dark:bg-stone-800 dark:text-[#E8BDC8] flex items-center justify-center font-bold text-xs">
                        #{idx + 1}
                      </div>
                      
                      {canEditCriteria && (
                        <button
                          type="button"
                          onClick={() => handleDirectDeleteCriterion(crit.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-stone-400 hover:text-rose-600 rounded-lg transition cursor-pointer"
                          title="حذف هذا المعيار من المسار"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <h4 className="text-xs font-bold text-stone-800 dark:text-stone-200 block mb-1">
                      {crit.title}
                    </h4>

                    <div className="flex items-baseline gap-1.5 my-2">
                      <span className="text-2xl font-extrabold text-[#8E5364] dark:text-[#E8BDC8]">
                        {crit.count}
                      </span>
                      <span className="text-xs text-stone-500 font-bold">{crit.unit}</span>
                    </div>

                    <p className="text-[11px] text-stone-400 leading-relaxed">
                      {crit.description || 'معيار معتمد لتعزيز جودة الأداء والإتقان القرآني.'}
                    </p>
                  </div>

                  <div className="pt-3 mt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-[11px]">
                    <span className="text-stone-400 font-bold">معيار إتقان</span>
                    {canEditCriteria && (
                      <button
                        type="button"
                        onClick={handleOpenEditModal}
                        className="text-[#8E5364] dark:text-[#E8BDC8] font-bold hover:underline cursor-pointer"
                      >
                        تعديل
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* تبويب الضوابط والآلية المنهجية */}
      {activeTab === 'rules' && (
        <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl border border-[#E2D5CC] dark:border-stone-800 shadow-xs space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#8E5364]" />
              <span>الضوابط التعليمية والمنهجية المعتمدة للمسار</span>
            </h3>
            <button
              type="button"
              onClick={handleOpenEditModal}
              className="text-xs font-bold text-[#8E5364] dark:text-[#E8BDC8] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>تعديل الضوابط</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-[#FAF7F5] dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-stone-700 dark:text-stone-200 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#8E5364]" />
                  ساعة التحضير المبكر
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  track.systemRules?.earlyPreparation 
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' 
                    : 'bg-stone-200 text-stone-600'
                }`}>
                  {track.systemRules?.earlyPreparation ? 'مفعلة وإلزامية' : 'اختيارية'}
                </span>
              </div>
              <p className="text-[11px] text-stone-500 leading-relaxed">
                إرسال بطاقة التحضير المسبق وتوثيق التكرار والاستماع قبل انطلاق الحلقة بربع ساعة لنيل نقاط التميز.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#FAF7F5] dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-stone-700 dark:text-stone-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  واجب «أتقني» للتجويد
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  track.systemRules?.atqiniHomeworkRequired 
                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300' 
                    : 'bg-stone-200 text-stone-600'
                }`}>
                  {track.systemRules?.atqiniHomeworkRequired ? 'إلزامي يومياً' : 'غير ملزم'}
                </span>
              </div>
              <p className="text-[11px] text-stone-500 leading-relaxed">
                تسجيل مقطع صوتي تطبيقي لأحكام التجويد والوقف والابتداء وإرساله للمعلمة للتقييم والتصويب.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#FAF7F5] dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-stone-700 dark:text-stone-200 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-600" />
                  تحديات يوم الخميس والمراجعة الثنائية
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  track.systemRules?.thursdayChallenges 
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' 
                    : 'bg-stone-200 text-stone-600'
                }`}>
                  {track.systemRules?.thursdayChallenges ? 'مفعلة أسبوعياً' : 'معطلة'}
                </span>
              </div>
              <p className="text-[11px] text-stone-500 leading-relaxed">
                تخصيص يوم الخميس للمسابقات التمكينية وتحدي الرفيقات في مراجعة ما تم حفظه خلال الأسبوع.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#FAF7F5] dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-stone-700 dark:text-stone-200 flex items-center gap-1.5">
                  <BookmarkCheck className="w-3.5 h-3.5 text-blue-600" />
                  مقادير المراجعة المقررة
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs font-bold pt-1">
                <div>
                  <span className="text-[10px] text-stone-400 block font-normal">المراجعة الصغرى:</span>
                  <span className="text-[#8E5364] dark:text-[#E8BDC8]">
                    {track.systemRules?.masteryGuide?.minorRevisionAmount || 'آخر ٣ أوجه'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-stone-400 block font-normal">مراجعة التمكين:</span>
                  <span className="text-[#8E5364] dark:text-[#E8BDC8]">
                    {track.systemRules?.masteryGuide?.tamkeenRevisionAmount || 'ربع حزب'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {track.systemRules?.detailedWorkflowText && (
            <div className="p-4 rounded-2xl bg-[#FAF7F5] dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700 space-y-2">
              <span className="font-bold text-xs text-stone-700 dark:text-stone-200 flex items-center gap-1.5">
                <MessageSquareQuote className="w-3.5 h-3.5 text-[#8E5364]" />
                سير العمل القرآني المفصل للمسار:
              </span>
              <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed whitespace-pre-line">
                {track.systemRules.detailedWorkflowText}
              </p>
            </div>
          )}
        </div>
      )}

      {/* تبويب الحلقات التابعة للمسار */}
      {activeTab === 'circles' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-stone-800 dark:text-stone-100">
              الحلقات التابعة لمسار {track.name} ({trackCircles.length})
            </h3>
            <span className="text-xs text-stone-500">
              جميع هذه الحلقات تطبق نفس دليل ومعايير الإتقان
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {trackCircles.map(c => {
              const count = students.filter(s => s.circleId === c.id && s.status === 'active').length;
              return (
                <div key={c.id} className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-[#E2D5CC] dark:border-stone-800 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{c.icon || '🪴'}</span>
                      <strong className="text-sm font-bold text-stone-800 dark:text-stone-100">{c.name}</strong>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                      {count} / {c.maxStudents} طالبة
                    </span>
                  </div>

                  <div className="text-xs text-stone-500 space-y-1">
                    <div>المعلمة: <strong className="text-stone-700 dark:text-stone-300">{c.teacherName}</strong></div>
                    <div>المشرفة: <strong className="text-stone-700 dark:text-stone-300">{c.supervisorName}</strong></div>
                    <div>الأيام: {c.scheduleDays.join('، ')}</div>
                  </div>
                </div>
              );
            })}

            {trackCircles.length === 0 && (
              <div className="col-span-full p-8 text-center text-xs text-stone-400 bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800">
                لا توجد حلقات نشطة مسجلة في هذا المسار حالياً.
              </div>
            )}
          </div>
        </div>
      )}

      {/* تبويب طالبات المسار */}
      {activeTab === 'students' && (
        <div className="bg-white dark:bg-stone-900 rounded-3xl border border-[#E2D5CC] dark:border-stone-800 overflow-hidden shadow-xs">
          <div className="p-5 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
            <h3 className="font-bold text-sm text-stone-800 dark:text-stone-100 flex items-center gap-2">
              <Users className="w-4 h-4 text-[#8E5364]" />
              <span>الطالبات المسجلات في هذا المسار ({trackStudents.length} طالبة)</span>
            </h3>
            <span className="text-xs text-stone-400">
              مرتبطة بحلقات ومعايير هذا المسار
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="bg-[#FAF7F5] dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-bold">
                <tr>
                  <th className="p-3.5">#</th>
                  <th className="p-3.5">كود الطالبة</th>
                  <th className="p-3.5">اسم الطالبة</th>
                  <th className="p-3.5">الحلقة القرآنية</th>
                  <th className="p-3.5">المعلمة</th>
                  <th className="p-3.5">الرفيقة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800 text-stone-700 dark:text-stone-200">
                {trackStudents.map((st, idx) => {
                  const circle = circles.find(c => c.id === st.circleId);
                  return (
                    <tr key={st.id} className="hover:bg-stone-50/50 dark:hover:bg-stone-800/30 transition">
                      <td className="p-3.5 text-stone-400 font-mono">{idx + 1}</td>
                      <td className="p-3.5 font-mono text-stone-400">{st.code}</td>
                      <td className="p-3.5 font-bold text-stone-900 dark:text-stone-100">{st.name}</td>
                      <td className="p-3.5 text-stone-600 dark:text-stone-300">{circle?.name || 'غير محدد'}</td>
                      <td className="p-3.5 text-stone-500">{circle?.teacherName || '—'}</td>
                      <td className="p-3.5 text-stone-500">{st.partnerStudentName || '—'}</td>
                    </tr>
                  );
                })}

                {trackStudents.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-stone-400 text-xs">
                      لا توجد طالبات مسجلات في هذا المسار حالياً.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* نافذة تعديل معايير دليل الإتقان والضوابط المنهجية (خالية 100% من المالية) */}
      {showEditModal && track && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-stone-900 border border-[#E2D5CC] dark:border-stone-800 rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl text-right max-h-[90vh] overflow-y-auto animate-in fade-in" dir="rtl">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <h3 className="text-sm font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">
                <Settings className="w-4 h-4 text-[#8E5364]" />
                <span>ضبط معايير دليل الإتقان لمسار ({track.name})</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* بيانات المسار الأساسية */}
              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] text-stone-500 mb-1 font-bold">اسم المسار</label>
                  <input
                    type="text"
                    value={editFormData.name}
                    onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="w-full bg-[#FAF7F5] dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-2 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-stone-500 mb-1 font-bold">وصف المسار والمنهج</label>
                  <textarea
                    rows={2}
                    value={editFormData.description}
                    onChange={e => setEditFormData({ ...editFormData, description: e.target.value })}
                    className="w-full bg-[#FAF7F5] dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-2"
                  />
                </div>
              </div>

              {/* معايير دليل الإتقان الموحدة (كلها زي بعض) */}
              <div className="p-3.5 bg-[#FAF7F5] dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-[#8E5364]" />
                    <span>معايير دليل الإتقان للمسار:</span>
                  </h4>
                  <span className="text-[10px] text-stone-400 font-bold">
                    {editFormData.criteriaList.length} معايير معتمدة (موحدة بالكامل)
                  </span>
                </div>

                {/* قائمة المعايير الموحدة الحالية */}
                <div className="space-y-2">
                  {editFormData.criteriaList.map((crit, idx) => (
                    <div 
                      key={crit.id} 
                      className="p-2.5 bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs"
                    >
                      <div className="flex-1">
                        <input
                          type="text"
                          value={crit.title}
                          onChange={e => {
                            const val = e.target.value;
                            setEditFormData(prev => ({
                              ...prev,
                              criteriaList: prev.criteriaList.map((c, i) => i === idx ? { ...c, title: val } : c)
                            }));
                          }}
                          className="w-full text-xs font-bold text-stone-800 dark:text-stone-100 bg-transparent outline-hidden"
                          placeholder="اسم المعيار"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-stone-400">المستهدف:</span>
                        <input
                          type="number"
                          min="1"
                          value={crit.count}
                          onChange={e => {
                            const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                            setEditFormData(prev => ({
                              ...prev,
                              criteriaList: prev.criteriaList.map((c, i) => i === idx ? { ...c, count: val } : c)
                            }));
                          }}
                          className="w-12 text-center text-xs font-extrabold text-[#8E5364] dark:text-[#E8BDC8] bg-stone-50 dark:bg-stone-800 rounded-lg py-1 border border-stone-200 dark:border-stone-700 outline-hidden font-mono"
                        />
                        <input
                          type="text"
                          value={crit.unit}
                          onChange={e => {
                            const val = e.target.value;
                            setEditFormData(prev => ({
                              ...prev,
                              criteriaList: prev.criteriaList.map((c, i) => i === idx ? { ...c, unit: val } : c)
                            }));
                          }}
                          className="w-14 text-center text-[11px] font-bold text-stone-600 dark:text-stone-300 bg-stone-50 dark:bg-stone-800 rounded-lg py-1 border border-stone-200 dark:border-stone-700 outline-hidden"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveCriterionFromForm(crit.id)}
                          className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer transition"
                          title="حذف هذا المعيار"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* حقول إضافة معيار جديد إلى القائمة الموحدة */}
                <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-stone-200 dark:border-stone-700">
                  <input
                    type="text"
                    placeholder="اسم معيار جديد (مثال: حفظ المعاني، التسميع للرفيقة...)"
                    value={newCriterionTitle}
                    onChange={e => setNewCriterionTitle(e.target.value)}
                    className="flex-1 w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl px-2.5 py-1.5 text-xs outline-hidden"
                  />
                  <div className="flex items-center gap-1 w-full sm:w-auto">
                    <input
                      type="number"
                      min="1"
                      value={newCriterionCount}
                      onChange={e => setNewCriterionCount(Number(e.target.value))}
                      className="w-14 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl px-2 py-1.5 text-xs text-center font-bold"
                      title="عدد المرات المستهدفة"
                    />
                    <select
                      value={newCriterionUnit}
                      onChange={e => setNewCriterionUnit(e.target.value)}
                      className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl px-2 py-1.5 text-xs font-bold"
                    >
                      <option value="مرات">مرات</option>
                      <option value="مرة">مرة</option>
                      <option value="أوجه">أوجه</option>
                      <option value="أسطر">أسطر</option>
                      <option value="دقائق">دقائق</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleAddCriterionToForm}
                      className="px-3 py-1.5 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer whitespace-nowrap shadow-2xs active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* الضوابط المنهجية */}
              <div className="p-3.5 bg-[#FAF7F5] dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 space-y-2">
                <h4 className="font-bold text-stone-800 dark:text-stone-200 mb-1">الضوابط المقررة:</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-stone-500 mb-1">مقدار المراجعة الصغرى</label>
                    <input
                      type="text"
                      value={editFormData.minorRevAmount}
                      onChange={e => setEditFormData({ ...editFormData, minorRevAmount: e.target.value })}
                      className="w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl p-2 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-stone-500 mb-1">مقدار مراجعة التمكين</label>
                    <input
                      type="text"
                      value={editFormData.tamkeenRevAmount}
                      onChange={e => setEditFormData({ ...editFormData, tamkeenRevAmount: e.target.value })}
                      className="w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl p-2 font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editFormData.earlyPrep}
                      onChange={e => setEditFormData({ ...editFormData, earlyPrep: e.target.checked })}
                      className="accent-[#8E5364] rounded"
                    />
                    <span className="text-[11px] text-stone-700 dark:text-stone-300 font-bold">تفعيل التحضير المبكر وإلزامية إرسال البطاقة</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editFormData.atqiniReq}
                      onChange={e => setEditFormData({ ...editFormData, atqiniReq: e.target.checked })}
                      className="accent-[#8E5364] rounded"
                    />
                    <span className="text-[11px] text-stone-700 dark:text-stone-300 font-bold">إلزامية واجب «أتقني» للتجويد الصوتي</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editFormData.thursdayChallenges}
                      onChange={e => setEditFormData({ ...editFormData, thursdayChallenges: e.target.checked })}
                      className="accent-[#8E5364] rounded"
                    />
                    <span className="text-[11px] text-stone-700 dark:text-stone-300 font-bold">تفعيل تحديات يوم الخميس والمراجعة الثنائية</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-stone-100 dark:border-stone-800">
              <button
                type="button"
                onClick={handleSaveTrackRules}
                className="flex-1 py-2.5 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>حفظ التعديلات والمعايير</span>
              </button>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2.5 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
