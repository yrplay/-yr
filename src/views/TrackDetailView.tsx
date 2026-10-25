import React, { useState, useMemo } from 'react';
import { 
  ArrowRight, Settings, DollarSign, Users, BookOpen, Layers, 
  CheckCircle2, Clock, AlertCircle, Edit3, Plus, 
  CreditCard, FileText, Check, PenTool
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Track, TrackSystemRules, StudentSubscription } from '../types';
import { SignaturePad } from '../components/SignaturePad';

interface TrackDetailViewProps {
  trackId: string;
  onBack: () => void;
}

export const TrackDetailView: React.FC<TrackDetailViewProps> = ({ trackId, onBack }) => {
  const { 
    tracks, circles, students, users, currentUser,
    studentSubscriptions, saveStudentSubscription,
    updateTrack, updateTrackSystemRules
  } = useApp();

  const [activeTab, setActiveTab] = useState<'overview' | 'circles' | 'finances'>('overview');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedSub, setSelectedSub] = useState<Partial<StudentSubscription> | null>(null);
  const [showSigPad, setShowSigPad] = useState(false);

  const track = tracks.find(t => t.id === trackId);
  const isLeader = currentUser?.role === 'leader';

  // الحلقات والطالبات التابعة لهذا المسار
  const trackCircles = useMemo(() => circles.filter(c => c.trackId === trackId && !c.isArchived), [circles, trackId]);
  const trackStudents = useMemo(() => students.filter(s => s.trackId === trackId && s.status === 'active'), [students, trackId]);

  // اشتراكات المسار
  const trackSubs = useMemo(() => {
    return studentSubscriptions.filter(s => s.trackId === trackId);
  }, [studentSubscriptions, trackId]);

  // الحسابات المالية التلقائية للمسار
  const feeAmount = track?.subscriptionFee?.amount || 0;
  const currency = track?.subscriptionFee?.currency || 'ر.س';

  const financialStats = useMemo(() => {
    const totalExpected = trackStudents.length * feeAmount;
    let totalCollected = 0;
    let paidCount = 0;
    let pendingCount = 0;
    let exemptCount = 0;

    trackStudents.forEach(st => {
      const sub = trackSubs.find(s => s.studentId === st.id);
      if (sub) {
        totalCollected += (sub.paidAmount || 0);
        if (sub.status === 'paid') paidCount++;
        else if (sub.status === 'exempt') exemptCount++;
        else pendingCount++;
      } else {
        pendingCount++;
      }
    });

    const totalRemaining = Math.max(0, totalExpected - totalCollected);
    const collectionRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 100;

    return {
      totalExpected,
      totalCollected,
      totalRemaining,
      collectionRate,
      paidCount,
      pendingCount,
      exemptCount
    };
  }, [trackStudents, trackSubs, feeAmount]);

  // نموذج التعديل الإداري
  const [editFormData, setEditFormData] = useState({
    name: track?.name || '',
    description: track?.description || '',
    feeAmount: track?.subscriptionFee?.amount || 150,
    feePeriod: track?.subscriptionFee?.period || 'monthly',
    feeNotes: track?.subscriptionFee?.notes || '',
    earlyPrep: track?.systemRules?.earlyPreparation ?? true,
    atqiniReq: track?.systemRules?.atqiniHomeworkRequired ?? true,
    thursdayChallenges: track?.systemRules?.thursdayChallenges ?? true,
    customPlans: track?.systemRules?.customPlansAllowed ?? false,
    workflowText: track?.systemRules?.detailedWorkflowText || '',
    listenTimes: track?.systemRules?.masteryGuide?.listenToReciterTimes ?? 3,
    reciteTimes: track?.systemRules?.masteryGuide?.reciteLookingTimes ?? 5,
    repeatTimes: track?.systemRules?.masteryGuide?.masteryRepetitionTimes ?? 20,
    minorRevAmount: track?.systemRules?.masteryGuide?.minorRevisionAmount || 'آخر ٣ أوجه',
    tamkeenRevAmount: track?.systemRules?.masteryGuide?.tamkeenRevisionAmount || 'ربع حزب'
  });

  if (!track) {
    return (
      <div className="p-8 text-center text-stone-500">
        <p>المسار غير موجود أو تمت أرشفته.</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 bg-[#8E5364] text-white rounded-xl text-xs font-bold">
          العودة للمسارات
        </button>
      </div>
    );
  }

  const handleSaveTrackRules = async () => {
    await updateTrack(track.id, {
      name: editFormData.name,
      description: editFormData.description,
      subscriptionFee: {
        amount: Number(editFormData.feeAmount),
        currency: 'ر.س',
        period: editFormData.feePeriod as any,
        notes: editFormData.feeNotes
      }
    });

    await updateTrackSystemRules(track.id, {
      earlyPreparation: editFormData.earlyPrep,
      atqiniHomeworkRequired: editFormData.atqiniReq,
      thursdayChallenges: editFormData.thursdayChallenges,
      customPlansAllowed: editFormData.customPlans,
      detailedWorkflowText: editFormData.workflowText,
      masteryGuide: {
        listenToReciterTimes: Number(editFormData.listenTimes),
        reciteLookingTimes: Number(editFormData.reciteTimes),
        masteryRepetitionTimes: Number(editFormData.repeatTimes),
        minorRevisionAmount: editFormData.minorRevAmount,
        tamkeenRevisionAmount: editFormData.tamkeenRevAmount,
        pointsPerCondition: 2
      }
    });

    setShowEditModal(false);
  };

  const handleOpenPayment = (studentId: string) => {
    const existing = trackSubs.find(s => s.studentId === studentId);
    setSelectedSub(existing || {
      studentId,
      trackId: track.id,
      cycleMonth: 'الشهر الحالي',
      requiredAmount: feeAmount,
      paidAmount: feeAmount,
      status: 'paid',
      paymentMethod: 'bank_transfer'
    });
    setShowPaymentModal(true);
  };

  const handleSavePayment = async () => {
    if (!selectedSub || !selectedSub.studentId) return;
    await saveStudentSubscription(selectedSub);
    setShowPaymentModal(false);
    setSelectedSub(null);
  };

  return (
    <div className="space-y-6 text-right pb-12" dir="rtl">
      {/* رأس الصفحة وزر العودة */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-stone-900 p-6 rounded-3xl border border-[#E2D5CC] dark:border-stone-800 shadow-xs">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2.5 rounded-2xl bg-[#FAF7F5] dark:bg-stone-800 hover:bg-[#F2EAE5] dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 transition"
            title="العودة للمسارات"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{track.icon || '🪴'}</span>
              <h1 className="text-xl font-bold text-stone-800 dark:text-stone-100">{track.name}</h1>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#FAF7F5] dark:bg-stone-800 text-[#8E5364] dark:text-[#E8BDC8] font-bold">
                {track.code}
              </span>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
              {track.description || 'لا يوجد وصف مضاف لهذا المسار بعد.'}
            </p>
          </div>
        </div>

        {isLeader && (
          <button
            onClick={() => setShowEditModal(true)}
            className="px-4 py-2.5 bg-[#8E5364] hover:bg-[#744251] text-white rounded-2xl text-xs font-bold transition flex items-center gap-2 shadow-xs"
          >
            <Settings className="w-4 h-4" />
            ضبط معايير ونظام المسار
          </button>
        )}
      </div>

      {/* المؤشرات السريعة للمسار */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-[#E2D5CC] dark:border-stone-800">
          <span className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1.5 font-bold">
            <Users className="w-3.5 h-3.5 text-[#8E5364]" />
            طالبات المسار
          </span>
          <p className="text-xl font-bold text-stone-800 dark:text-stone-100 mt-1">{trackStudents.length}</p>
        </div>

        <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-[#E2D5CC] dark:border-stone-800">
          <span className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1.5 font-bold">
            <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
            الحلقات النشطة
          </span>
          <p className="text-xl font-bold text-stone-800 dark:text-stone-100 mt-1">{trackCircles.length}</p>
        </div>

        <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-[#E2D5CC] dark:border-stone-800">
          <span className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1.5 font-bold">
            <DollarSign className="w-3.5 h-3.5 text-amber-600" />
            رسوم الاشتراك
          </span>
          <p className="text-xl font-bold text-stone-800 dark:text-stone-100 mt-1">
            {feeAmount} <span className="text-xs font-normal text-stone-500">{currency}</span>
          </p>
        </div>

        <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-[#E2D5CC] dark:border-stone-800">
          <span className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1.5 font-bold">
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
            نسبة التحصيل
          </span>
          <p className="text-xl font-bold text-stone-800 dark:text-stone-100 mt-1">{financialStats.collectionRate}%</p>
        </div>
      </div>

      {/* شريط التبويبات */}
      <div className="flex border-b border-[#E2D5CC] dark:border-stone-800 gap-6 text-sm font-bold">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 transition flex items-center gap-2 ${
            activeTab === 'overview' 
              ? 'border-b-2 border-[#8E5364] text-[#8E5364] dark:text-[#E8BDC8]' 
              : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          النظام ودليل الإتقان
        </button>

        <button
          onClick={() => setActiveTab('circles')}
          className={`pb-3 transition flex items-center gap-2 ${
            activeTab === 'circles' 
              ? 'border-b-2 border-[#8E5364] text-[#8E5364] dark:text-[#E8BDC8]' 
              : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          الحلقات التابعة ({trackCircles.length})
        </button>

        <button
          onClick={() => setActiveTab('finances')}
          className={`pb-3 transition flex items-center gap-2 ${
            activeTab === 'finances' 
              ? 'border-b-2 border-[#8E5364] text-[#8E5364] dark:text-[#E8BDC8]' 
              : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          المالية والاشتراكات
        </button>
      </div>

      {/* تبويب 1: النظام ودليل مشكاة الغيم */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* بطاقة معايير دليل الإتقان */}
          <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl border border-[#E2D5CC] dark:border-stone-800 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <h2 className="text-sm font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">
                <span>📖</span>
                معايير «دليل مشكاة الغيم» لهذا المسار
              </h2>
              <span className="text-[11px] text-[#8E5364] bg-[#FAF7F5] dark:bg-stone-800 px-2.5 py-1 rounded-full font-bold">
                مطبقة في التسميع
              </span>
            </div>

            <div className="space-y-3 text-xs leading-relaxed">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-[#FAF7F5] dark:bg-stone-800/50">
                <span className="text-stone-600 dark:text-stone-300">الاستماع للمقرئ المتقن</span>
                <span className="font-bold text-[#8E5364] dark:text-[#E8BDC8]">
                  {track.systemRules?.masteryGuide?.listenToReciterTimes || 3} مرات
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-[#FAF7F5] dark:bg-stone-800/50">
                <span className="text-stone-600 dark:text-stone-300">التلاوة نظراً من المصحف</span>
                <span className="font-bold text-[#8E5364] dark:text-[#E8BDC8]">
                  {track.systemRules?.masteryGuide?.reciteLookingTimes || 5} مرات
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-[#FAF7F5] dark:bg-stone-800/50">
                <span className="text-stone-600 dark:text-stone-300">التكرار المتقن لرسوخ الوجه</span>
                <span className="font-bold text-[#8E5364] dark:text-[#E8BDC8]">
                  {track.systemRules?.masteryGuide?.masteryRepetitionTimes || 20} مرة
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-[#FAF7F5] dark:bg-stone-800/50">
                <span className="text-stone-600 dark:text-stone-300">مقدار المراجعة الصغرى (الربط)</span>
                <span className="font-bold text-stone-800 dark:text-stone-200">
                  {track.systemRules?.masteryGuide?.minorRevisionAmount || 'آخر ٣ أوجه'}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-[#FAF7F5] dark:bg-stone-800/50">
                <span className="text-stone-600 dark:text-stone-300">مقدار مراجعة التمكين</span>
                <span className="font-bold text-stone-800 dark:text-stone-200">
                  {track.systemRules?.masteryGuide?.tamkeenRevisionAmount || 'ربع حزب'}
                </span>
              </div>
            </div>
          </div>

          {/* بطاقة ضوابط وآلية العمل */}
          <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl border border-[#E2D5CC] dark:border-stone-800 space-y-4">
            <div className="border-b border-stone-100 dark:border-stone-800 pb-3">
              <h2 className="text-sm font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">
                <span>⚙️</span>
                ضوابط المسار والتحضير
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-2xl bg-[#FAF7F5] dark:bg-stone-800/50 flex items-center gap-2">
                <CheckCircle2 className={`w-4 h-4 ${track.systemRules?.earlyPreparation ? 'text-emerald-600' : 'text-stone-400'}`} />
                <span>التحضير المبكر إلزامي</span>
              </div>

              <div className="p-3 rounded-2xl bg-[#FAF7F5] dark:bg-stone-800/50 flex items-center gap-2">
                <CheckCircle2 className={`w-4 h-4 ${track.systemRules?.atqiniHomeworkRequired ? 'text-emerald-600' : 'text-stone-400'}`} />
                <span>واجبات التجويد (أتقني)</span>
              </div>

              <div className="p-3 rounded-2xl bg-[#FAF7F5] dark:bg-stone-800/50 flex items-center gap-2">
                <CheckCircle2 className={`w-4 h-4 ${track.systemRules?.thursdayChallenges ? 'text-emerald-600' : 'text-stone-400'}`} />
                <span>تحديات الخميس الثنائية</span>
              </div>

              <div className="p-3 rounded-2xl bg-[#FAF7F5] dark:bg-stone-800/50 flex items-center gap-2">
                <CheckCircle2 className={`w-4 h-4 ${track.systemRules?.customPlansAllowed ? 'text-emerald-600' : 'text-stone-400'}`} />
                <span>خطط فردية مرنة</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800">
              <span className="text-[11px] font-bold text-stone-500 block mb-1.5">شرح آلية العمل:</span>
              <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed bg-[#FAF7F5] dark:bg-stone-800/40 p-3.5 rounded-2xl">
                {track.systemRules?.detailedWorkflowText || 'يتبع هذا المسار خطة الحفظ المتدرج مع التمكين التراكمي الأسبوعي، ومتابعة معايير الدليل قبل كل جلسة تسميع.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* تبويب 2: الحلقات التابعة للمسار */}
      {activeTab === 'circles' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {trackCircles.map(c => {
            const count = students.filter(s => s.circleId === c.id && s.status === 'active').length;
            return (
              <div key={c.id} className="bg-white dark:bg-stone-900 p-5 rounded-3xl border border-[#E2D5CC] dark:border-stone-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{c.icon || '🪴'}</span>
                    <h3 className="font-bold text-sm text-stone-800 dark:text-stone-100">{c.name}</h3>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#FAF7F5] dark:bg-stone-800 text-[#8E5364] font-bold">
                    {count}/{c.maxStudents} طالبة
                  </span>
                </div>

                <div className="text-xs text-stone-600 dark:text-stone-400 space-y-1.5 pt-2 border-t border-stone-100 dark:border-stone-800">
                  <p>المعلمة: <span className="font-bold text-stone-800 dark:text-stone-200">{c.teacherName || 'غير محدد'}</span></p>
                  <p>المشرفة: <span className="font-bold text-stone-800 dark:text-stone-200">{c.supervisorName || 'غير محدد'}</span></p>
                  <p className="text-[11px] text-stone-500 flex items-center gap-1 pt-1">
                    <Clock className="w-3 h-3" />
                    {c.startTime} - {c.endTime} ({c.scheduleDays.join('، ')})
                  </p>
                </div>
              </div>
            );
          })}
          {trackCircles.length === 0 && (
            <div className="col-span-full py-12 text-center text-stone-400 text-xs">
              لا توجد حلقات تابعة لهذا المسار حالياً.
            </div>
          )}
        </div>
      )}

      {/* تبويب 3: المالية والاشتراكات */}
      {activeTab === 'finances' && (
        <div className="space-y-6">
          {/* كروت الملخص المالي */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-stone-900 p-5 rounded-3xl border border-[#E2D5CC] dark:border-stone-800">
              <span className="text-xs text-stone-500 font-bold block mb-1">إجمالي المستهدف (المفترض)</span>
              <p className="text-2xl font-bold text-stone-800 dark:text-stone-100">
                {financialStats.totalExpected} <span className="text-xs font-normal text-stone-500">{currency}</span>
              </p>
            </div>

            <div className="bg-white dark:bg-stone-900 p-5 rounded-3xl border border-[#E2D5CC] dark:border-stone-800">
              <span className="text-xs text-emerald-600 font-bold block mb-1">المبالغ المحصلة فعلياً</span>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                {financialStats.totalCollected} <span className="text-xs font-normal text-stone-500">{currency}</span>
              </p>
            </div>

            <div className="bg-white dark:bg-stone-900 p-5 rounded-3xl border border-[#E2D5CC] dark:border-stone-800">
              <span className="text-xs text-rose-600 font-bold block mb-1">المبالغ المتبقية / المعلقة</span>
              <p className="text-2xl font-bold text-rose-700 dark:text-rose-400">
                {financialStats.totalRemaining} <span className="text-xs font-normal text-stone-500">{currency}</span>
              </p>
            </div>
          </div>

          {/* جدول اشتراكات الطالبات */}
          <div className="bg-white dark:bg-stone-900 rounded-3xl border border-[#E2D5CC] dark:border-stone-800 overflow-hidden shadow-xs">
            <div className="p-5 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-stone-800 dark:text-stone-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#8E5364]" />
                سجل اشتراكات وسداد طالبات المسار
              </h3>
              <span className="text-xs text-stone-500">
                المسددات: {financialStats.paidCount} من {trackStudents.length}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-[#FAF7F5] dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-bold">
                  <tr>
                    <th className="p-3.5">الطالبة</th>
                    <th className="p-3.5">الحلقة</th>
                    <th className="p-3.5">المبلغ المطلوب</th>
                    <th className="p-3.5">المدفوع</th>
                    <th className="p-3.5">الحالة</th>
                    <th className="p-3.5">التوقيع</th>
                    <th className="p-3.5 text-center">إجراء السداد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800 text-stone-700 dark:text-stone-200">
                  {trackStudents.map(st => {
                    const circle = circles.find(c => c.id === st.circleId);
                    const sub = trackSubs.find(s => s.studentId === st.id);
                    const isPaid = sub?.status === 'paid';
                    const isExempt = sub?.status === 'exempt';

                    return (
                      <tr key={st.id} className="hover:bg-stone-50/50 dark:hover:bg-stone-800/30 transition">
                        <td className="p-3.5 font-bold">{st.name}</td>
                        <td className="p-3.5 text-stone-500">{circle?.name || 'غير محدد'}</td>
                        <td className="p-3.5 font-mono">{sub?.requiredAmount ?? feeAmount} {currency}</td>
                        <td className="p-3.5 font-mono font-bold text-emerald-600">{sub?.paidAmount ?? 0} {currency}</td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isPaid ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' :
                            isExempt ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300' :
                            'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                          }`}>
                            {isPaid ? 'مدفوع بالكامل' : isExempt ? 'معفاة / منحة' : 'معلق / جزئي'}
                          </span>
                        </td>
                        <td className="p-3.5">
                          {sub?.signatureUrl ? (
                            <img src={sub.signatureUrl} alt="توقيع" className="h-6 w-auto border border-stone-200 rounded-sm bg-white" />
                          ) : (
                            <span className="text-stone-400 text-[10px]">بدون توقيع</span>
                          )}
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            onClick={() => handleOpenPayment(st.id)}
                            className="px-3 py-1 bg-[#FAF7F5] dark:bg-stone-800 hover:bg-[#8E5364] hover:text-white dark:hover:bg-[#8E5364] text-[#8E5364] dark:text-[#E8BDC8] rounded-xl text-[11px] font-bold transition flex items-center gap-1 mx-auto"
                          >
                            <CreditCard className="w-3 h-3" />
                            سند السداد
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {trackStudents.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-stone-400 text-xs">
                        لا توجد طالبات مقيدات في هذا المسار حالياً.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* نافذة ضبط وتعديل معايير ونظام المسار */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-stone-900 border border-[#E2D5CC] dark:border-stone-800 rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl text-right" dir="rtl">
            <h3 className="text-base font-bold text-stone-800 dark:text-stone-100 border-b border-stone-100 dark:border-stone-800 pb-3">
              إعدادات وضوابط المسار: {track.name}
            </h3>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-stone-700 dark:text-stone-300 font-bold mb-1">اسم المسار</label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full bg-[#FAF7F5] dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-2.5 text-xs text-stone-800 dark:text-stone-100"
                />
              </div>

              <div>
                <label className="block text-stone-700 dark:text-stone-300 font-bold mb-1">نبذة ووصف المسار</label>
                <textarea
                  rows={2}
                  value={editFormData.description}
                  onChange={e => setEditFormData({ ...editFormData, description: e.target.value })}
                  className="w-full bg-[#FAF7F5] dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-2.5 text-xs text-stone-800 dark:text-stone-100"
                />
              </div>

              {/* قسم الرسوم */}
              <div className="p-4 rounded-2xl bg-[#FAF7F5] dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700/60 space-y-3">
                <span className="font-bold text-stone-800 dark:text-stone-200 block">إعدادات رسوم الاشتراك:</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-stone-600 dark:text-stone-400 mb-1">مبلغ الاشتراك (ر.س)</label>
                    <input
                      type="number"
                      value={editFormData.feeAmount}
                      onChange={e => setEditFormData({ ...editFormData, feeAmount: Number(e.target.value) })}
                      className="w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl p-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-stone-600 dark:text-stone-400 mb-1">دورية الدفع</label>
                    <select
                      value={editFormData.feePeriod}
                      onChange={e => setEditFormData({ ...editFormData, feePeriod: e.target.value as any })}
                      className="w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl p-2 text-xs"
                    >
                      <option value="monthly">شهري</option>
                      <option value="term">فصلي</option>
                      <option value="annual">سنوي</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* معايير دليل الإتقان */}
              <div className="p-4 rounded-2xl bg-[#FAF7F5] dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700/60 space-y-3">
                <span className="font-bold text-stone-800 dark:text-stone-200 block">معايير «دليل مشكاة الغيم» لهذا المسار:</span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] text-stone-600 dark:text-stone-400 mb-1">مرات الاستماع</label>
                    <input
                      type="number"
                      value={editFormData.listenTimes}
                      onChange={e => setEditFormData({ ...editFormData, listenTimes: Number(e.target.value) })}
                      className="w-full bg-white dark:bg-stone-900 border border-stone-200 rounded-xl p-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-stone-600 dark:text-stone-400 mb-1">التلاوة نظراً</label>
                    <input
                      type="number"
                      value={editFormData.reciteTimes}
                      onChange={e => setEditFormData({ ...editFormData, reciteTimes: Number(e.target.value) })}
                      className="w-full bg-white dark:bg-stone-900 border border-stone-200 rounded-xl p-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-stone-600 dark:text-stone-400 mb-1">التكرار المتقن</label>
                    <input
                      type="number"
                      value={editFormData.repeatTimes}
                      onChange={e => setEditFormData({ ...editFormData, repeatTimes: Number(e.target.value) })}
                      className="w-full bg-white dark:bg-stone-900 border border-stone-200 rounded-xl p-2 text-xs"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div>
                    <label className="block text-[11px] text-stone-600 dark:text-stone-400 mb-1">مقدار المراجعة الصغرى</label>
                    <input
                      type="text"
                      value={editFormData.minorRevAmount}
                      onChange={e => setEditFormData({ ...editFormData, minorRevAmount: e.target.value })}
                      className="w-full bg-white dark:bg-stone-900 border border-stone-200 rounded-xl p-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-stone-600 dark:text-stone-400 mb-1">مقدار مراجعة التمكين</label>
                    <input
                      type="text"
                      value={editFormData.tamkeenRevAmount}
                      onChange={e => setEditFormData({ ...editFormData, tamkeenRevAmount: e.target.value })}
                      className="w-full bg-white dark:bg-stone-900 border border-stone-200 rounded-xl p-2 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* خيارات النظام الإضافية */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <label className="flex items-center gap-2 p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editFormData.earlyPrep}
                    onChange={e => setEditFormData({ ...editFormData, earlyPrep: e.target.checked })}
                    className="accent-[#8E5364]"
                  />
                  <span>التحضير المبكر إلزامي</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editFormData.atqiniReq}
                    onChange={e => setEditFormData({ ...editFormData, atqiniReq: e.target.checked })}
                    className="accent-[#8E5364]"
                  />
                  <span>واجبات التجويد (أتقني)</span>
                </label>
              </div>

              <div>
                <label className="block text-stone-700 dark:text-stone-300 font-bold mb-1">شرح آلية ونظام العمل</label>
                <textarea
                  rows={2}
                  value={editFormData.workflowText}
                  onChange={e => setEditFormData({ ...editFormData, workflowText: e.target.value })}
                  className="w-full bg-[#FAF7F5] dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-2.5 text-xs"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-stone-100 dark:border-stone-800">
              <button
                onClick={handleSaveTrackRules}
                className="flex-1 py-2.5 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs font-bold transition"
              >
                حفظ التعديلات
              </button>
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2.5 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-xl text-xs font-bold"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تسجيل دفعة وسند اشتراك للطالبة مع التوقيع */}
      {showPaymentModal && selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-stone-900 border border-[#E2D5CC] dark:border-stone-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl text-right" dir="rtl">
            <h3 className="text-sm font-bold text-stone-800 dark:text-stone-100 border-b border-stone-100 dark:border-stone-800 pb-3">
              سند سداد اشتراك: {students.find(s => s.id === selectedSub.studentId)?.name}
            </h3>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-stone-600 dark:text-stone-400 mb-1">المبلغ المطلوب</label>
                  <input
                    type="number"
                    value={selectedSub.requiredAmount ?? feeAmount}
                    onChange={e => setSelectedSub({ ...selectedSub, requiredAmount: Number(e.target.value) })}
                    className="w-full bg-[#FAF7F5] dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-2"
                  />
                </div>
                <div>
                  <label className="block text-stone-600 dark:text-stone-400 mb-1">المبلغ المدفوع</label>
                  <input
                    type="number"
                    value={selectedSub.paidAmount ?? feeAmount}
                    onChange={e => setSelectedSub({ ...selectedSub, paidAmount: Number(e.target.value) })}
                    className="w-full bg-[#FAF7F5] dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-2 font-bold text-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-stone-600 dark:text-stone-400 mb-1">حالة السداد</label>
                  <select
                    value={selectedSub.status || 'paid'}
                    onChange={e => setSelectedSub({ ...selectedSub, status: e.target.value as any })}
                    className="w-full bg-[#FAF7F5] dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-2"
                  >
                    <option value="paid">مدفوع بالكامل</option>
                    <option value="partial">سداد جزئي</option>
                    <option value="pending">معلق / لم يدفع</option>
                    <option value="exempt">معفاة / منحة</option>
                  </select>
                </div>
                <div>
                  <label className="block text-stone-600 dark:text-stone-400 mb-1">طريقة الدفع</label>
                  <select
                    value={selectedSub.paymentMethod || 'bank_transfer'}
                    onChange={e => setSelectedSub({ ...selectedSub, paymentMethod: e.target.value as any })}
                    className="w-full bg-[#FAF7F5] dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-2"
                  >
                    <option value="bank_transfer">تحويل بنكي</option>
                    <option value="cash">نقداً</option>
                    <option value="pos">شبكة / مدى</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-stone-600 dark:text-stone-400 mb-1">رقم الإيصال / المرجع</label>
                <input
                  type="text"
                  placeholder="مثال: TXN-998822"
                  value={selectedSub.receiptNumber || ''}
                  onChange={e => setSelectedSub({ ...selectedSub, receiptNumber: e.target.value })}
                  className="w-full bg-[#FAF7F5] dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-2"
                />
              </div>

              {/* قسم التوقيع اليدوي */}
              <div className="pt-2 border-t border-stone-100 dark:border-stone-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-stone-700 dark:text-stone-300">توقيع الاعتماد اليدوي</span>
                  <button
                    type="button"
                    onClick={() => setShowSigPad(!showSigPad)}
                    className="text-[11px] text-[#8E5364] flex items-center gap-1 font-bold"
                  >
                    <PenTool className="w-3 h-3" />
                    {showSigPad ? 'إخفاء لوحة التوقيع' : 'فتح التوقيع'}
                  </button>
                </div>

                {showSigPad && (
                  <div className="flex justify-center my-2">
                    <SignaturePad
                      onSave={(dataUrl) => {
                        setSelectedSub({ ...selectedSub, signatureUrl: dataUrl });
                        setShowSigPad(false);
                      }}
                      title="توقيع المشرفة / المستلم"
                    />
                  </div>
                )}

                {selectedSub.signatureUrl && !showSigPad && (
                  <div className="flex items-center gap-3 p-2 bg-[#FAF7F5] dark:bg-stone-800 rounded-xl">
                    <img src={selectedSub.signatureUrl} alt="التوقيع" className="h-8 bg-white border border-stone-200 rounded-md" />
                    <span className="text-[10px] text-emerald-600 font-bold">تم اعتماد التوقيع بنجاح ✅</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-stone-100 dark:border-stone-800">
              <button
                onClick={handleSavePayment}
                className="flex-1 py-2.5 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs font-bold transition"
              >
                اعتماد وحفظ السند
              </button>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2.5 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-xl text-xs font-bold"
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