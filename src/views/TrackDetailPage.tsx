import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Layers, ArrowRight, Edit, Users, Calendar, Clock,
  CheckCircle2, Sliders, Shield, BookOpen, CreditCard,
  DollarSign, Sparkles, Award, FileText, ChevronLeft,
  AlertCircle, Check, X, Plus, Info, RefreshCw, Wallet,
  HelpCircle, ExternalLink
} from 'lucide-react';
import { Track, Circle, StudentSubscription, PaymentStatus, defaultMasteryGuideConfig } from '../types';

interface TrackDetailPageProps {
  trackId: string;
  onBack: () => void;
  onNavigateToSection: (section: string) => void;
  onSelectCircle?: (circleId: string) => void;
}

export const TrackDetailPage: React.FC<TrackDetailPageProps> = ({
  trackId,
  onBack,
  onNavigateToSection,
  onSelectCircle
}) => {
  const {
    tracks, circles, students, studentSubscriptions, currentUser,
    updateTrack, settings, setSelectedTrackForDetail, createCircle
  } = useApp();

  const isLeader = currentUser?.role === 'leader';
  const track = tracks.find(t => t.id === trackId) || tracks[0];

  // Tab navigation inside Track Detail
  const [activeTab, setActiveTab] = useState<'overview' | 'workflow' | 'mastery' | 'circles' | 'subscriptions'>('overview');

  // Edit Track Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: track?.name || '',
    code: track?.code || '',
    description: track?.description || '',
    icon: track?.icon || '🪴',
    logoUrl: track?.logoUrl || '',
    feeAmount: track?.subscriptionFee?.amount ?? 250,
    feeCurrency: track?.subscriptionFee?.currency || 'ر.س',
    feePeriod: track?.subscriptionFee?.period || 'monthly',
    feeNotes: track?.subscriptionFee?.notes || '',
    earlyPreparation: track?.systemRules?.earlyPreparation ?? true,
    atqiniHomeworkRequired: track?.systemRules?.atqiniHomeworkRequired ?? true,
    thursdayChallenges: track?.systemRules?.thursdayChallenges ?? true,
    customPlansAllowed: track?.systemRules?.customPlansAllowed ?? true,
    detailedWorkflowText: track?.systemRules?.detailedWorkflowText || '',
    listenToReciterTimes: track?.systemRules?.masteryGuide?.listenToReciterTimes ?? (settings.defaultMasteryGuide?.listenToReciterTimes || defaultMasteryGuideConfig.listenToReciterTimes),
    reciteLookingTimes: track?.systemRules?.masteryGuide?.reciteLookingTimes ?? (settings.defaultMasteryGuide?.reciteLookingTimes || defaultMasteryGuideConfig.reciteLookingTimes),
    masteryRepetitionTimes: track?.systemRules?.masteryGuide?.masteryRepetitionTimes ?? (settings.defaultMasteryGuide?.masteryRepetitionTimes || defaultMasteryGuideConfig.masteryRepetitionTimes),
    minorRevisionAmount: track?.systemRules?.masteryGuide?.minorRevisionAmount || settings.defaultMasteryGuide?.minorRevisionAmount || defaultMasteryGuideConfig.minorRevisionAmount,
    tamkeenRevisionAmount: track?.systemRules?.masteryGuide?.tamkeenRevisionAmount || settings.defaultMasteryGuide?.tamkeenRevisionAmount || defaultMasteryGuideConfig.tamkeenRevisionAmount,
    pointsPerCondition: track?.systemRules?.masteryGuide?.pointsPerCondition ?? (settings.defaultMasteryGuide?.pointsPerCondition || defaultMasteryGuideConfig.pointsPerCondition)
  });

  if (!track) {
    return (
      <div className="p-8 text-center bg-white dark:bg-[#16161A] rounded-3xl border border-stone-200 dark:border-stone-800">
        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">المسار المطلوب غير موجود</h3>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-[#8E5364] text-white text-xs font-bold rounded-xl"
        >
          العودة لقائمة المسارات
        </button>
      </div>
    );
  }

  const trackCircles = circles.filter(c => c.trackId === track.id && !c.isArchived);
  const trackStudents = students.filter(s => s.trackId === track.id && s.status === 'active');
  const trackSubs = studentSubscriptions.filter(s => s.trackId === track.id);

  // Financial KPIs for this track
  const totalRequired = trackSubs.reduce((acc, curr) => acc + (curr.requiredAmount || 0), 0);
  const totalCollected = trackSubs.reduce((acc, curr) => acc + (curr.paidAmount || 0), 0);
  const totalPending = Math.max(0, totalRequired - totalCollected);
  const collectionRate = totalRequired > 0 ? Math.round((totalCollected / totalRequired) * 100) : 0;

  // Active mastery rules for this track (either customized or inherited)
  const masteryConfig = track.systemRules?.masteryGuide || settings.defaultMasteryGuide || defaultMasteryGuideConfig;
  const systemRules = track.systemRules || {
    earlyPreparation: true,
    atqiniHomeworkRequired: true,
    thursdayChallenges: true,
    customPlansAllowed: true,
    detailedWorkflowText: 'يبدأ اليوم القرآني بإرسال بطاقة التحضير المبكر قبل بدء الحلقة بربع ساعة، يليه التسميع اليومي غيباً مع تطبيق أحكام التجويد، ثم مصفوفة المراجعة الصغرى والتمكين مع الرفيقة، وتُختم بمطابقة شروط دليل مشكاة الغيم للإتقان.',
    masteryGuide: masteryConfig
  };

  const handleOpenEditModal = () => {
    setEditForm({
      name: track.name,
      code: track.code,
      description: track.description,
      icon: track.icon || '🪴',
      logoUrl: track.logoUrl || '',
      feeAmount: track.subscriptionFee?.amount ?? 250,
      feeCurrency: track.subscriptionFee?.currency || 'ر.س',
      feePeriod: track.subscriptionFee?.period || 'monthly',
      feeNotes: track.subscriptionFee?.notes || '',
      earlyPreparation: systemRules.earlyPreparation,
      atqiniHomeworkRequired: systemRules.atqiniHomeworkRequired,
      thursdayChallenges: systemRules.thursdayChallenges,
      customPlansAllowed: systemRules.customPlansAllowed,
      detailedWorkflowText: systemRules.detailedWorkflowText || '',
      listenToReciterTimes: masteryConfig.listenToReciterTimes,
      reciteLookingTimes: masteryConfig.reciteLookingTimes,
      masteryRepetitionTimes: masteryConfig.masteryRepetitionTimes,
      minorRevisionAmount: masteryConfig.minorRevisionAmount,
      tamkeenRevisionAmount: masteryConfig.tamkeenRevisionAmount,
      pointsPerCondition: masteryConfig.pointsPerCondition
    });
    setEditModalOpen(true);
  };

  const handleSaveTrackSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateTrack(track.id, {
      name: editForm.name,
      code: editForm.code,
      description: editForm.description,
      icon: editForm.icon,
      logoUrl: editForm.logoUrl,
      subscriptionFee: {
        amount: Number(editForm.feeAmount),
        currency: editForm.feeCurrency,
        period: editForm.feePeriod as any,
        notes: editForm.feeNotes
      },
      systemRules: {
        earlyPreparation: editForm.earlyPreparation,
        atqiniHomeworkRequired: editForm.atqiniHomeworkRequired,
        thursdayChallenges: editForm.thursdayChallenges,
        customPlansAllowed: editForm.customPlansAllowed,
        detailedWorkflowText: editForm.detailedWorkflowText,
        masteryGuide: {
          listenToReciterTimes: Number(editForm.listenToReciterTimes),
          reciteLookingTimes: Number(editForm.reciteLookingTimes),
          masteryRepetitionTimes: Number(editForm.masteryRepetitionTimes),
          minorRevisionAmount: editForm.minorRevisionAmount,
          tamkeenRevisionAmount: editForm.tamkeenRevisionAmount,
          pointsPerCondition: Number(editForm.pointsPerCondition)
        }
      }
    });
    setEditModalOpen(false);
  };

  return (
    <div className="space-y-6" dir="rtl">
      
      {/* Breadcrumb & Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#16161A] p-4 sm:p-5 rounded-3xl border border-[#E8DFD8] dark:border-stone-800 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-2xl bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white transition cursor-pointer flex items-center gap-1 text-xs font-bold"
            title="الرجوع إلى المسارات والحلقات"
          >
            <ArrowRight className="w-4 h-4" />
            <span>رجوع</span>
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-stone-400">المسارات والحلقات</span>
              <span className="text-stone-300">/</span>
              <span className="text-xs font-bold text-[#8E5364] dark:text-[#E8A5B8]">{track.name}</span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold font-quran text-stone-900 dark:text-stone-100 mt-0.5 flex items-center gap-2">
              <span>{track.icon || '🪴'}</span>
              <span>صفحة تفاصيل ونظام مسار {track.name}</span>
            </h1>
          </div>
        </div>

        {/* Quick Switch Track & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Switch track dropdown */}
          {tracks.length > 1 && (
            <select
              value={track.id}
              onChange={(e) => setSelectedTrackForDetail(e.target.value)}
              className="px-3 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-bold rounded-xl text-stone-700 dark:text-stone-300"
            >
              {tracks.filter(t => !t.isArchived).map(t => (
                <option key={t.id} value={t.id}>مسار: {t.name}</option>
              ))}
            </select>
          )}

          {isLeader && (
            <button
              onClick={handleOpenEditModal}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#FAF0F3] dark:bg-[#2A1B22] hover:bg-[#F2DFE6] text-[#8E5364] dark:text-[#E8A5B8] border border-[#E8D5D8] dark:border-[#5B3946] rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
            >
              <Edit className="w-3.5 h-3.5" />
              <span>تعديل بيانات ونظام المسار</span>
            </button>
          )}

          <button
            onClick={() => onNavigateToSection('subscriptions')}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs active:scale-95"
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>النظام المالي والاشتراكات</span>
          </button>
        </div>
      </div>

      {/* Hero Track Card */}
      <div className="bg-gradient-to-br from-[#FCFAF8] via-white to-[#F8F2F4] dark:from-[#18181C] dark:via-[#16161A] dark:to-[#1C1519] p-6 sm:p-8 rounded-3xl border border-[#E8DFD8] dark:border-stone-800 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-72 h-72 bg-[#8E5364]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start sm:items-center gap-4">
            {track.logoUrl ? (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 shadow-xs p-1.5 flex items-center justify-center shrink-0">
                <img src={track.logoUrl} alt={track.name} className="w-full h-full object-contain rounded-2xl" />
              </div>
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-[#FAF0F3] dark:bg-[#2B1B22] border border-[#E8D5D8] dark:border-[#5B3946] text-[#8E5364] dark:text-[#E8A5B8] flex items-center justify-center text-3xl sm:text-4xl shadow-xs shrink-0">
                {track.icon || '🪴'}
              </div>
            )}

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <h2 className="text-xl sm:text-2xl font-bold font-quran text-stone-900 dark:text-stone-100">
                  {track.name}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-[#EBF3EE] dark:bg-emerald-950/40 text-[#2D5A43] dark:text-emerald-300 font-mono text-xs font-bold border border-emerald-200 dark:border-emerald-800">
                  {track.code}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
                  مسار قرآني نشط
                </span>
              </div>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 max-w-3xl leading-relaxed">
                {track.description || 'المسار التعليمي لحفظ كتاب الله وضبطه وإتقانه وتطبيق أحكام التجويد وفق المنهج المعتمد.'}
              </p>
            </div>
          </div>

          {/* Quick Fee Badge on Hero */}
          <div className="bg-white/90 dark:bg-stone-900/90 backdrop-blur-xs p-4 rounded-2xl border border-[#E8D5D8] dark:border-stone-700 text-right min-w-[200px] shrink-0 shadow-2xs">
            <div className="text-[11px] font-bold text-stone-500 dark:text-stone-400 mb-1 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-[#8E5364] dark:text-[#E8A5B8]" />
              <span>رسوم الاشتراك بالمسار</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-[#8E5364] dark:text-[#E8A5B8]">
                {track.subscriptionFee?.amount ?? 250}
              </span>
              <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
                {track.subscriptionFee?.currency || 'ر.س'}
              </span>
              <span className="text-[11px] text-stone-400">
                / {track.subscriptionFee?.period === 'term' ? 'فصل دراسي' : track.subscriptionFee?.period === 'annual' ? 'سنوي' : 'شهرياً'}
              </span>
            </div>
            {track.subscriptionFee?.notes && (
              <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-1 line-clamp-1" title={track.subscriptionFee.notes}>
                {track.subscriptionFee.notes}
              </p>
            )}
          </div>
        </div>

        {/* 4 KPI Numbers */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-stone-200/60 dark:border-stone-800">
          <div className="bg-white dark:bg-stone-900 p-3.5 rounded-2xl border border-stone-200 dark:border-stone-800 text-center">
            <div className="text-[11px] text-stone-500 dark:text-stone-400 font-semibold mb-1">الحلقات النشطة</div>
            <div className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center justify-center gap-1">
              <span>{trackCircles.length}</span>
              <span className="text-xs font-normal text-stone-400">حلقة</span>
            </div>
          </div>

          <div className="bg-white dark:bg-stone-900 p-3.5 rounded-2xl border border-stone-200 dark:border-stone-800 text-center">
            <div className="text-[11px] text-stone-500 dark:text-stone-400 font-semibold mb-1">إجمالي الطالبات</div>
            <div className="text-xl font-bold text-[#8E5364] dark:text-[#E8A5B8] flex items-center justify-center gap-1">
              <span>{trackStudents.length}</span>
              <span className="text-xs font-normal text-stone-400">طالبة</span>
            </div>
          </div>

          <div className="bg-white dark:bg-stone-900 p-3.5 rounded-2xl border border-stone-200 dark:border-stone-800 text-center">
            <div className="text-[11px] text-stone-500 dark:text-stone-400 font-semibold mb-1">المحصل الفعلي</div>
            <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400 flex items-center justify-center gap-1">
              <span>{totalCollected.toLocaleString()}</span>
              <span className="text-xs font-normal text-stone-400">ر.س</span>
            </div>
          </div>

          <div className="bg-white dark:bg-stone-900 p-3.5 rounded-2xl border border-stone-200 dark:border-stone-800 text-center">
            <div className="text-[11px] text-stone-500 dark:text-stone-400 font-semibold mb-1">نسبة التحصيل المالي</div>
            <div className="text-xl font-bold text-amber-700 dark:text-amber-400 flex items-center justify-center gap-1">
              <span>{collectionRate}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-stone-200 dark:border-stone-800 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition flex items-center gap-2 shrink-0 ${
            activeTab === 'overview'
              ? 'bg-[#8E5364] text-white shadow-xs'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>النبذة والرسوم المالية</span>
        </button>

        <button
          onClick={() => setActiveTab('workflow')}
          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition flex items-center gap-2 shrink-0 ${
            activeTab === 'workflow'
              ? 'bg-[#8E5364] text-white shadow-xs'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>نظام وآلية العمل</span>
        </button>

        <button
          onClick={() => setActiveTab('mastery')}
          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition flex items-center gap-2 shrink-0 ${
            activeTab === 'mastery'
              ? 'bg-[#8E5364] text-white shadow-xs'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>معايير دليل الإتقان (مشكاة الغيم)</span>
        </button>

        <button
          onClick={() => setActiveTab('circles')}
          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition flex items-center gap-2 shrink-0 ${
            activeTab === 'circles'
              ? 'bg-[#8E5364] text-white shadow-xs'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>حلقات المسار ({trackCircles.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('subscriptions')}
          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition flex items-center gap-2 shrink-0 ${
            activeTab === 'subscriptions'
              ? 'bg-[#8E5364] text-white shadow-xs'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>اشتراكات طالبات المسار ({trackSubs.length})</span>
        </button>
      </div>

      {/* Tab 1: Overview & Fees */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Description Card */}
            <div className="bg-white dark:bg-[#16161A] p-6 rounded-3xl border border-[#E8DFD8] dark:border-stone-800 shadow-2xs space-y-4">
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#8E5364] dark:text-[#E8A5B8]" />
                <span>النبذة التعريفية وأهداف المسار</span>
              </h3>
              <p className="text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed whitespace-pre-line">
                {track.description || 'لم يتم إدخال وصف تفصيلي بعد.'}
              </p>

              <div className="pt-4 border-t border-stone-100 dark:border-stone-800/80 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-[#FAF7F4] dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800">
                  <span className="text-stone-400 block mb-1">رمز المسار الرسمي:</span>
                  <span className="font-mono font-bold text-stone-900 dark:text-stone-100">{track.code}</span>
                </div>
                <div className="p-3 bg-[#FAF7F4] dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800">
                  <span className="text-stone-400 block mb-1">تاريخ الاعتماد:</span>
                  <span className="font-bold text-stone-900 dark:text-stone-100">
                    {new Date(track.createdAt).toLocaleDateString('ar-SA')}
                  </span>
                </div>
              </div>
            </div>

            {/* Workflow Preview Card */}
            <div className="bg-white dark:bg-[#16161A] p-6 rounded-3xl border border-[#E8DFD8] dark:border-stone-800 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#8E5364] dark:text-[#E8A5B8]" />
                  <span>ملخص آلية وسير العمل في هذا المسار</span>
                </h3>
                <button
                  onClick={() => setActiveTab('workflow')}
                  className="text-xs font-bold text-[#8E5364] dark:text-[#E8A5B8] hover:underline cursor-pointer"
                >
                  التفاصيل الكاملة ←
                </button>
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed line-clamp-3">
                {systemRules.detailedWorkflowText}
              </p>
            </div>
          </div>

          {/* Right Column: Subscription & Financial Details */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-[#16161A] p-6 rounded-3xl border border-[#E8DFD8] dark:border-stone-800 shadow-2xs space-y-5">
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#8E5364] dark:text-[#E8A5B8]" />
                <span>تفاصيل الرسوم والاشتراك المالي</span>
              </h3>

              <div className="p-4 bg-[#FAF2F5] dark:bg-[#25181F] rounded-2xl border border-[#E8D5D8] dark:border-[#5B3946] text-center">
                <span className="text-xs text-stone-500 dark:text-stone-400 block mb-1">المبلغ المعتمد</span>
                <div className="text-3xl font-black text-[#8E5364] dark:text-[#E8A5B8]">
                  {track.subscriptionFee?.amount ?? 250}{' '}
                  <span className="text-sm font-bold text-stone-700 dark:text-stone-300">
                    {track.subscriptionFee?.currency || 'ر.س'}
                  </span>
                </div>
                <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                  الدورية: <strong>{track.subscriptionFee?.period === 'term' ? 'فصل دراسي' : track.subscriptionFee?.period === 'annual' ? 'سنوي' : 'شهرياً'}</strong>
                </div>
              </div>

              {track.subscriptionFee?.notes && (
                <div className="text-xs text-stone-600 dark:text-stone-400 bg-stone-50 dark:bg-stone-900 p-3.5 rounded-xl border border-stone-200 dark:border-stone-800">
                  <span className="font-bold text-stone-800 dark:text-stone-200 block mb-1">شروط وملاحظات الرسوم:</span>
                  <p className="leading-relaxed">{track.subscriptionFee.notes}</p>
                </div>
              )}

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-stone-50 dark:bg-stone-900">
                  <span className="text-stone-500">إجمالي المطلوب:</span>
                  <span className="font-bold text-stone-800 dark:text-stone-200">{totalRequired.toLocaleString()} ر.س</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-stone-50 dark:bg-stone-900">
                  <span className="text-stone-500">المحصل الفعلي:</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">{totalCollected.toLocaleString()} ر.س</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-stone-50 dark:bg-stone-900">
                  <span className="text-stone-500">المتبقي المعلق:</span>
                  <span className="font-bold text-rose-700 dark:text-rose-400">{totalPending.toLocaleString()} ر.س</span>
                </div>
              </div>

              <button
                onClick={() => onNavigateToSection('subscriptions')}
                className="w-full py-2.5 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <Wallet className="w-4 h-4" />
                <span>إدارة اشتراكات طالبات المسار</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Workflow & System Rules */}
      {activeTab === 'workflow' && (
        <div className="space-y-6">
          {/* Rules Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={`p-5 rounded-3xl border ${
              systemRules.earlyPreparation
                ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-500'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">⏰</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  systemRules.earlyPreparation
                    ? 'bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200'
                    : 'bg-stone-200 text-stone-600'
                }`}>
                  {systemRules.earlyPreparation ? 'إلزامي للمسار' : 'اختياري'}
                </span>
              </div>
              <h4 className="font-bold text-sm mb-1">التحضير المبكر</h4>
              <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                اشتراط إرسال بطاقة التحضير والالتزام بوقت الإغلاق المعتمد لكل حلقة.
              </p>
            </div>

            <div className={`p-5 rounded-3xl border ${
              systemRules.atqiniHomeworkRequired
                ? 'bg-[#FAF0F3] dark:bg-[#2A1B22] border-[#E8D5D8] dark:border-[#5B3946] text-[#744251] dark:text-[#E8A5B8]'
                : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-500'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">✨</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  systemRules.atqiniHomeworkRequired
                    ? 'bg-[#E8D5D8] dark:bg-[#5B3946] text-[#744251] dark:text-white'
                    : 'bg-stone-200 text-stone-600'
                }`}>
                  {systemRules.atqiniHomeworkRequired ? 'مفعل وإلزامي' : 'اختياري'}
                </span>
              </div>
              <h4 className="font-bold text-sm mb-1">واجبات «أتقني» للتجويد</h4>
              <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                إلزامية تسليم التطبيقات التجويدية واستخراج الأمثلة من السور المقررة.
              </p>
            </div>

            <div className={`p-5 rounded-3xl border ${
              systemRules.thursdayChallenges
                ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-500'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">🏆</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  systemRules.thursdayChallenges
                    ? 'bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200'
                    : 'bg-stone-200 text-stone-600'
                }`}>
                  {systemRules.thursdayChallenges ? 'تحديات أسبوعية' : 'غير مفعل'}
                </span>
              </div>
              <h4 className="font-bold text-sm mb-1">تحديات الخميس والمراجعة الثنائية</h4>
              <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                مشاركة الرفيقة الثنائية في تثبيت المحفوظ وخوض تحديات التمكين الأسبوعية.
              </p>
            </div>

            <div className={`p-5 rounded-3xl border ${
              systemRules.customPlansAllowed
                ? 'bg-sky-50/60 dark:bg-sky-950/20 border-sky-200 dark:border-sky-800 text-sky-900 dark:text-sky-200'
                : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-500'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">📋</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  systemRules.customPlansAllowed
                    ? 'bg-sky-200 dark:bg-sky-900 text-sky-800 dark:text-sky-200'
                    : 'bg-stone-200 text-stone-600'
                }`}>
                  {systemRules.customPlansAllowed ? 'خطط فردية مرنة' : 'خطة موحدة فقط'}
                </span>
              </div>
              <h4 className="font-bold text-sm mb-1">الخطط الفردية المرنة</h4>
              <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                إتاحة تخصيص مقدار التسميع والمراجعة بحسب استيعاب الطالبة وسرعتها.
              </p>
            </div>
          </div>

          {/* Detailed Workflow Text */}
          <div className="bg-white dark:bg-[#16161A] p-6 rounded-3xl border border-[#E8DFD8] dark:border-stone-800 shadow-2xs space-y-4">
            <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#8E5364] dark:text-[#E8A5B8]" />
              <span>دليل آلية ونظام المسار المعتمد</span>
            </h3>
            <div className="p-4 bg-[#FAF7F4] dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 text-xs sm:text-sm text-stone-800 dark:text-stone-200 leading-relaxed whitespace-pre-line">
              {systemRules.detailedWorkflowText}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Mastery Guide Standards (مشكاة الغيم) */}
      {activeTab === 'mastery' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#16161A] p-6 rounded-3xl border border-[#E8DFD8] dark:border-stone-800 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#8E5364] dark:text-[#E8A5B8]" />
                  <span>معايير «دليل مشكاة الغيم للإتقان» المطبقة في مسار {track.name}</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  تحدد هذه الشروط معايير تميز الطالبة واحتساب درجات الحفظ المتقن غيباً ونظراً
                </p>
              </div>
              {isLeader && (
                <button
                  onClick={handleOpenEditModal}
                  className="px-3 py-1.5 bg-[#FAF0F3] dark:bg-[#2A1B22] text-[#8E5364] dark:text-[#E8A5B8] rounded-xl text-xs font-bold border border-[#E8D5D8] dark:border-[#5B3946] hover:bg-[#F2DFE6] cursor-pointer"
                >
                  تعديل المعايير
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-[#FCFAF8] dark:bg-stone-900 border border-[#E8DFD8] dark:border-stone-800 flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FAF0F3] dark:bg-[#2A1B22] text-[#8E5364] dark:text-[#E8A5B8] flex items-center justify-center text-lg shrink-0">
                  🎧
                </div>
                <div>
                  <div className="text-xs text-stone-500 dark:text-stone-400">الاستماع للقارئ المجوّد</div>
                  <div className="text-xl font-bold text-stone-900 dark:text-stone-100 mt-0.5">
                    {masteryConfig.listenToReciterTimes} مرات
                  </div>
                  <div className="text-[11px] text-stone-400 mt-1">سماع متصل مع مصحف مجود</div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#FCFAF8] dark:bg-stone-900 border border-[#E8DFD8] dark:border-stone-800 flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FAF0F3] dark:bg-[#2A1B22] text-[#8E5364] dark:text-[#E8A5B8] flex items-center justify-center text-lg shrink-0">
                  📖
                </div>
                <div>
                  <div className="text-xs text-stone-500 dark:text-stone-400">التلاوة نظراً من المصحف</div>
                  <div className="text-xl font-bold text-stone-900 dark:text-stone-100 mt-0.5">
                    {masteryConfig.reciteLookingTimes} مرات
                  </div>
                  <div className="text-[11px] text-stone-400 mt-1">تلاوة هادئة لترسيخ رسم الآيات</div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#FCFAF8] dark:bg-stone-900 border border-[#E8DFD8] dark:border-stone-800 flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FAF0F3] dark:bg-[#2A1B22] text-[#8E5364] dark:text-[#E8A5B8] flex items-center justify-center text-lg shrink-0">
                  🔁
                </div>
                <div>
                  <div className="text-xs text-stone-500 dark:text-stone-400">التكرار المتقن غيباً</div>
                  <div className="text-xl font-bold text-stone-900 dark:text-stone-100 mt-0.5">
                    {masteryConfig.masteryRepetitionTimes} مرة
                  </div>
                  <div className="text-[11px] text-stone-400 mt-1">تثبيت واستظهار بدون تردد</div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#FCFAF8] dark:bg-stone-900 border border-[#E8DFD8] dark:border-stone-800 flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-lg shrink-0">
                  🌿
                </div>
                <div>
                  <div className="text-xs text-stone-500 dark:text-stone-400">مقدار المراجعة الصغرى</div>
                  <div className="text-base font-bold text-stone-900 dark:text-stone-100 mt-0.5">
                    {masteryConfig.minorRevisionAmount}
                  </div>
                  <div className="text-[11px] text-stone-400 mt-1">مراجعة يومية لآخر ما حُفظ</div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#FCFAF8] dark:bg-stone-900 border border-[#E8DFD8] dark:border-stone-800 flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-lg shrink-0">
                  🛡️
                </div>
                <div>
                  <div className="text-xs text-stone-500 dark:text-stone-400">مقدار مراجعة التمكين</div>
                  <div className="text-base font-bold text-stone-900 dark:text-stone-100 mt-0.5">
                    {masteryConfig.tamkeenRevisionAmount}
                  </div>
                  <div className="text-[11px] text-stone-400 mt-1">تثبيت المحفوظ القديم دورياً</div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#FCFAF8] dark:bg-stone-900 border border-[#E8DFD8] dark:border-stone-800 flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 flex items-center justify-center text-lg shrink-0">
                  ⭐️
                </div>
                <div>
                  <div className="text-xs text-stone-500 dark:text-stone-400">وزن كل شرط في الدرجات</div>
                  <div className="text-xl font-bold text-stone-900 dark:text-stone-100 mt-0.5">
                    {masteryConfig.pointsPerCondition} درجات
                  </div>
                  <div className="text-[11px] text-stone-400 mt-1">تُحتسب في تقييم الحفظ المتقن</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Track Circles */}
      {activeTab === 'circles' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                الحلقات التابعة لمسار {track.name} ({trackCircles.length})
              </h3>
              <p className="text-xs text-stone-500">الحلقات الفرعية وتوزيع الكادر التعليمي والطالبات</p>
            </div>
            <button
              onClick={() => onNavigateToSection('tracks_circles')}
              className="px-3.5 py-2 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إدارة الحلقات في المصفوفة</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trackCircles.map(circle => {
              const cStudents = students.filter(s => s.circleId === circle.id && s.status === 'active');
              return (
                <div
                  key={circle.id}
                  className="bg-white dark:bg-[#16161A] p-5 rounded-3xl border border-[#E8DFD8] dark:border-stone-800 shadow-2xs hover:border-[#8E5364] transition space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-2xl bg-[#FAF0F3] dark:bg-[#2B1B22] text-[#8E5364] dark:text-[#E8A5B8] flex items-center justify-center text-lg">
                        {circle.icon || '🪴'}
                      </div>
                      <div>
                        <h4 className="font-bold text-stone-900 dark:text-stone-100 text-sm font-quran">{circle.name}</h4>
                        <span className="text-[11px] text-stone-400">معلمة: {circle.teacherName}</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[#8E5364] dark:text-[#E8A5B8] bg-[#FAF2F5] dark:bg-[#2A1B22] px-2.5 py-0.5 rounded-full">
                      {cStudents.length} / {circle.maxStudents || 15}
                    </span>
                  </div>

                  <div className="p-3 bg-[#FAF7F4] dark:bg-stone-900 rounded-2xl space-y-1.5 text-xs text-stone-600 dark:text-stone-400">
                    <div className="flex items-center justify-between">
                      <span>مشرفة الحلقة:</span>
                      <strong className="text-stone-800 dark:text-stone-200">{circle.supervisorName}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>أوقات الحلقة:</span>
                      <span className="font-mono">{circle.startTime} - {circle.endTime}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>إغلاق التحضير:</span>
                      <span className="font-mono text-amber-700 dark:text-amber-400">{circle.earlyPrepCutoffTime || '15:45'}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (onSelectCircle) onSelectCircle(circle.id);
                      onNavigateToSection('tracks_circles');
                    }}
                    className="w-full py-2 bg-stone-50 dark:bg-stone-800 hover:bg-[#8E5364] hover:text-white text-stone-700 dark:text-stone-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>عرض سجلات الحلقة</span>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 5: Subscriptions for this Track */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                اشتراكات طالبات مسار {track.name} ({trackSubs.length})
              </h3>
              <p className="text-xs text-stone-500">حالة سداد الرسوم الشهرية والتحصيلات التابعة لهذا المسار</p>
            </div>
            <button
              onClick={() => onNavigateToSection('subscriptions')}
              className="px-4 py-2 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs self-start"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>فتح لوحة الاشتراكات والمالية الشاملة</span>
            </button>
          </div>

          <div className="bg-white dark:bg-[#16161A] rounded-3xl border border-[#E8DFD8] dark:border-stone-800 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-[#FAF7F4] dark:bg-stone-900 text-stone-600 dark:text-stone-400 font-bold border-b border-stone-200 dark:border-stone-800">
                  <tr>
                    <th className="p-3.5">الطالبة</th>
                    <th className="p-3.5">الحلقة</th>
                    <th className="p-3.5">الدورة الشهرية</th>
                    <th className="p-3.5">المطلوب</th>
                    <th className="p-3.5">المدفوع</th>
                    <th className="p-3.5">الحالة</th>
                    <th className="p-3.5">طريقة الدفع</th>
                    <th className="p-3.5">التاريخ / الإيصال</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {trackSubs.map(sub => {
                    const student = students.find(s => s.id === sub.studentId);
                    const circle = circles.find(c => c.id === student?.circleId);
                    return (
                      <tr key={sub.id} className="hover:bg-stone-50 dark:hover:bg-stone-900/50 transition">
                        <td className="p-3.5 font-bold text-stone-900 dark:text-stone-100">
                          {student?.name || 'غير محدد'}
                          <span className="block text-[10px] text-stone-400 font-mono">{student?.code}</span>
                        </td>
                        <td className="p-3.5 text-stone-600 dark:text-stone-400">{circle?.name || '—'}</td>
                        <td className="p-3.5 text-stone-600 dark:text-stone-400 font-medium">{sub.cycleMonth}</td>
                        <td className="p-3.5 font-bold">{sub.requiredAmount} ر.س</td>
                        <td className="p-3.5 font-bold text-emerald-700 dark:text-emerald-400">{sub.paidAmount} ر.س</td>
                        <td className="p-3.5">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            sub.status === 'paid'
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200'
                              : sub.status === 'partial'
                              ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200'
                              : sub.status === 'exempt'
                              ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200'
                              : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200'
                          }`}>
                            {sub.status === 'paid' ? 'مدفوع بالكامل' : sub.status === 'partial' ? 'سداد جزئي' : sub.status === 'exempt' ? 'معفاة' : 'معلق لم يسدد'}
                          </span>
                        </td>
                        <td className="p-3.5 text-stone-600 dark:text-stone-400">
                          {sub.paymentMethod === 'bank_transfer' ? 'تحويل بنكي' : sub.paymentMethod === 'pos' ? 'شبكة / مدى' : sub.paymentMethod === 'cash' ? 'نقدي' : '—'}
                        </td>
                        <td className="p-3.5 text-stone-500 font-mono text-[11px]">
                          {sub.paymentDate || '—'}
                          {sub.receiptNumber && <span className="block text-stone-400">#{sub.receiptNumber}</span>}
                        </td>
                      </tr>
                    );
                  })}
                  {trackSubs.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-stone-400 text-xs">
                        لا توجد اشتراكات مسجلة لهذا المسار بعد. يمكنك توليد الاشتراكات من لوحة المالية.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Edit Track Modal (for Leader) */}
      {editModalOpen && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#16161A] rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-stone-200 dark:border-stone-800 max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <span>🪴</span>
                <span>تعديل بيانات ورسوم ونظام مسار {track.name}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTrackSettings} className="space-y-4 text-xs">
              
              {/* Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">اسم المسار:</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-900 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">كود المسار:</label>
                  <input
                    type="text"
                    required
                    value={editForm.code}
                    onChange={e => setEditForm({ ...editForm, code: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-900 font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">نبذة ووصف المسار:</label>
                <textarea
                  rows={2}
                  value={editForm.description}
                  onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-900"
                />
              </div>

              {/* Subscription Fees */}
              <div className="p-4 bg-[#FCFAF8] dark:bg-stone-900/60 rounded-2xl border border-stone-200 dark:border-stone-800 space-y-3">
                <h4 className="font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-[#8E5364]" />
                  <span>رسوم الاشتراك الخاصة بالمسار</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-stone-600 dark:text-stone-400 mb-1">مبلغ الاشتراك (ر.س):</label>
                    <input
                      type="number"
                      min="0"
                      value={editForm.feeAmount}
                      onChange={e => setEditForm({ ...editForm, feeAmount: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-900 font-bold text-[#8E5364]"
                    />
                  </div>
                  <div>
                    <label className="block text-stone-600 dark:text-stone-400 mb-1">دورية الدفع:</label>
                    <select
                      value={editForm.feePeriod}
                      onChange={e => setEditForm({ ...editForm, feePeriod: e.target.value as any })}
                      className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-900 font-bold"
                    >
                      <option value="monthly">شهرياً</option>
                      <option value="term">فصلياً (لكل فصل دراسي)</option>
                      <option value="annual">سنوياً</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-stone-600 dark:text-stone-400 mb-1">العملة:</label>
                    <input
                      type="text"
                      value={editForm.feeCurrency}
                      onChange={e => setEditForm({ ...editForm, feeCurrency: e.target.value })}
                      className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-900"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-stone-600 dark:text-stone-400 mb-1">ملاحظات وشروط الرسوم:</label>
                  <input
                    type="text"
                    value={editForm.feeNotes}
                    onChange={e => setEditForm({ ...editForm, feeNotes: e.target.value })}
                    placeholder="شامل الحقيبة القرآنية وشهادات الإتقان..."
                    className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-900"
                  />
                </div>
              </div>

              {/* System Rules Toggles */}
              <div className="p-4 bg-[#FCFAF8] dark:bg-stone-900/60 rounded-2xl border border-stone-200 dark:border-stone-800 space-y-3">
                <h4 className="font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-[#8E5364]" />
                  <span>قواعد ونظام سير العمل</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.earlyPreparation}
                      onChange={e => setEditForm({ ...editForm, earlyPreparation: e.target.checked })}
                      className="rounded text-[#8E5364]"
                    />
                    <span className="font-bold">اشتراط التحضير المبكر</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.atqiniHomeworkRequired}
                      onChange={e => setEditForm({ ...editForm, atqiniHomeworkRequired: e.target.checked })}
                      className="rounded text-[#8E5364]"
                    />
                    <span className="font-bold">اشتراط واجبات «أتقني» للتجويد</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.thursdayChallenges}
                      onChange={e => setEditForm({ ...editForm, thursdayChallenges: e.target.checked })}
                      className="rounded text-[#8E5364]"
                    />
                    <span className="font-bold">تفعيل تحديات الخميس والمراجعة الثنائية</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.customPlansAllowed}
                      onChange={e => setEditForm({ ...editForm, customPlansAllowed: e.target.checked })}
                      className="rounded text-[#8E5364]"
                    />
                    <span className="font-bold">السماح بالخطط الفردية المرنة</span>
                  </label>
                </div>

                <div>
                  <label className="block text-stone-600 dark:text-stone-400 mb-1">نص يشرح آلية ونظام عمل المسار:</label>
                  <textarea
                    rows={3}
                    value={editForm.detailedWorkflowText}
                    onChange={e => setEditForm({ ...editForm, detailedWorkflowText: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-900"
                  />
                </div>
              </div>

              {/* Mastery Guide Standards */}
              <div className="p-4 bg-[#FCFAF8] dark:bg-stone-900/60 rounded-2xl border border-stone-200 dark:border-stone-800 space-y-3">
                <h4 className="font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#8E5364]" />
                  <span>معايير دليل مشكاة الغيم للإتقان الخاصة بهذا المسار</span>
                </h4>
                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-stone-600 dark:text-stone-400 mb-1">الاستماع للقارئ (مرات):</label>
                    <input
                      type="number"
                      min="1"
                      value={editForm.listenToReciterTimes}
                      onChange={e => setEditForm({ ...editForm, listenToReciterTimes: Number(e.target.value) })}
                      className="w-full py-1.5 px-2 border border-stone-200 dark:border-stone-700 rounded-xl text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-stone-600 dark:text-stone-400 mb-1">التلاوة نظراً (مرات):</label>
                    <input
                      type="number"
                      min="1"
                      value={editForm.reciteLookingTimes}
                      onChange={e => setEditForm({ ...editForm, reciteLookingTimes: Number(e.target.value) })}
                      className="w-full py-1.5 px-2 border border-stone-200 dark:border-stone-700 rounded-xl text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-stone-600 dark:text-stone-400 mb-1">التكرار المتقن (مرات):</label>
                    <input
                      type="number"
                      min="1"
                      value={editForm.masteryRepetitionTimes}
                      onChange={e => setEditForm({ ...editForm, masteryRepetitionTimes: Number(e.target.value) })}
                      className="w-full py-1.5 px-2 border border-stone-200 dark:border-stone-700 rounded-xl text-center font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-stone-600 dark:text-stone-400 mb-1">مقدار المراجعة الصغرى:</label>
                    <input
                      type="text"
                      value={editForm.minorRevisionAmount}
                      onChange={e => setEditForm({ ...editForm, minorRevisionAmount: e.target.value })}
                      placeholder="آخر 3 أوجه"
                      className="w-full py-1.5 px-3 border border-stone-200 dark:border-stone-700 rounded-xl font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-stone-600 dark:text-stone-400 mb-1">مقدار مراجعة التمكين:</label>
                    <input
                      type="text"
                      value={editForm.tamkeenRevisionAmount}
                      onChange={e => setEditForm({ ...editForm, tamkeenRevisionAmount: e.target.value })}
                      placeholder="ربع حزب"
                      className="w-full py-1.5 px-3 border border-stone-200 dark:border-stone-700 rounded-xl font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-stone-600 dark:text-stone-400 mb-1">وزن الشرط بالنقاط:</label>
                    <input
                      type="number"
                      min="1"
                      value={editForm.pointsPerCondition}
                      onChange={e => setEditForm({ ...editForm, pointsPerCondition: Number(e.target.value) })}
                      className="w-full py-1.5 px-3 border border-stone-200 dark:border-stone-700 rounded-xl text-center font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-3 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl font-bold shadow-xs cursor-pointer"
                >
                  حفظ تعديلات المسار والنظام
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
