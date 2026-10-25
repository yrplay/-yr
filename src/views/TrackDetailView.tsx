import React, { useState, useMemo } from 'react';
import { 
  ArrowRight, Settings, DollarSign, Users, BookOpen, Layers, 
  CheckCircle2, Clock, AlertCircle, Edit3, Plus, 
  CreditCard, FileText, Check, PenTool, Search, ShieldAlert
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
    updateTrack, updateTrackSystemRules, settings
  } = useApp();

  const [activeTab, setActiveTab] = useState<'finances' | 'overview'>('finances');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedSub, setSelectedSub] = useState<Partial<StudentSubscription> | null>(null);
  const [showSigPad, setShowSigPad] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const track = tracks.find(t => t.id === trackId);
  const isLeader = currentUser?.role === 'leader';

  // قفل أمني: حصر قسم المالية والاشتراكات بالإدارة العليا فقط
  if (!isLeader) {
    return (
      <div className="bg-white dark:bg-stone-900 p-8 rounded-3xl border border-[#E2D5CC] dark:border-stone-800 text-center space-y-4 text-right" dir="rtl">
        <div className="w-16 h-16 rounded-3xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center mx-auto text-2xl">
          <ShieldAlert className="w-8 h-8 text-rose-600" />
        </div>
        <h3 className="text-base font-bold text-stone-800 dark:text-stone-100">
          منطقة مخصصة للإدارة العليا فقط
        </h3>
        <p className="text-xs text-stone-500 dark:text-stone-400 max-w-md mx-auto leading-relaxed">
          عذراً، هذا القسم يختص بالاشتراكات والتقارير المالية للمقرأة وسندات التحصيل، وتقتصر صلاحية الاطلاع عليه وإدارته على حساب الإدارة العليا فقط.
        </p>
        <button
          onClick={onBack}
          className="px-5 py-2.5 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-2"
        >
          <ArrowRight className="w-4 h-4" />
          العودة للمسارات والحلقات
        </button>
      </div>
    );
  }

  // الربط المباشر: جميع الطالبات النشطات في المنظومة بلا استثناء
  const allActiveStudents = useMemo(() => {
    return students.filter(s => s.status === 'active');
  }, [students]);

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return allActiveStudents;
    return allActiveStudents.filter(s => 
      s.name.includes(searchQuery) || (s.code && s.code.includes(searchQuery))
    );
  }, [allActiveStudents, searchQuery]);

  const feeAmount = track?.subscriptionFee?.amount ?? 150;
  const currency = track?.subscriptionFee?.currency || 'ر.س';
  const currentCycle = settings.currentHijriMonth || 'الشهر الحالي';

  // الحسابات المالية المباشرة لجميع الطالبات
  const financialStats = useMemo(() => {
    const totalExpected = allActiveStudents.length * feeAmount;
    let totalCollected = 0;
    let paidCount = 0;
    let pendingCount = 0;
    let exemptCount = 0;

    allActiveStudents.forEach(st => {
      const sub = (studentSubscriptions || []).find(s => s.studentId === st.id);
      const paid = sub?.paidAmount ?? 0;
      totalCollected += paid;

      if (sub?.status === 'paid' || paid >= feeAmount) {
        paidCount++;
      } else if (sub?.status === 'exempt') {
        exemptCount++;
      } else {
        pendingCount++;
      }
    });

    const totalRemaining = Math.max(0, totalExpected - totalCollected);
    const collectionRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;

    return {
      totalExpected,
      totalCollected,
      totalRemaining,
      collectionRate,
      paidCount,
      pendingCount,
      exemptCount
    };
  }, [allActiveStudents, studentSubscriptions, feeAmount]);

  // إعدادات المسار
  const [editFormData, setEditFormData] = useState({
    name: track?.name || '',
    description: track?.description || '',
    feeAmount: track?.subscriptionFee?.amount ?? 150,
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

  const handleSaveTrackRules = async () => {
    if (!track) return;
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
    const existing = (studentSubscriptions || []).find(s => s.studentId === studentId);
    setSelectedSub(existing || {
      studentId,
      trackId: track?.id || 'general',
      cycleMonth: currentCycle,
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
      {/* رأس اللوحة */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-stone-900 p-6 rounded-3xl border border-[#E2D5CC] dark:border-stone-800 shadow-xs">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2.5 rounded-2xl bg-[#FAF7F5] dark:bg-stone-800 hover:bg-[#F2EAE5] dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 transition"
            title="رجوع"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">💳</span>
              <h1 className="text-xl font-bold text-stone-800 dark:text-stone-100">سجل الاشتراكات والمالية العامة</h1>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
              إدارة رسوم واشتراكات طالبات المقرأة مباشرة مع إصدار سندات السداد والتوقيع
            </p>
          </div>
        </div>

        {track && (
          <button
            onClick={() => setShowEditModal(true)}
            className="px-4 py-2.5 bg-[#8E5364] hover:bg-[#744251] text-white rounded-2xl text-xs font-bold transition flex items-center gap-2 shadow-xs"
          >
            <Settings className="w-4 h-4" />
            ضبط الرسوم ومعايير الدليل
          </button>
        )}
      </div>

      {/* المؤشرات المالية الإجمالية للطالبات */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-[#E2D5CC] dark:border-stone-800">
          <span className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1.5 font-bold">
            <Users className="w-3.5 h-3.5 text-[#8E5364]" />
            إجمالي الطالبات
          </span>
          <p className="text-xl font-bold text-stone-800 dark:text-stone-100 mt-1">{allActiveStudents.length}</p>
        </div>

        <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-[#E2D5CC] dark:border-stone-800">
          <span className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1.5 font-bold">
            <DollarSign className="w-3.5 h-3.5 text-amber-600" />
            المبلغ المتوقع ({currentCycle})
          </span>
          <p className="text-xl font-bold text-stone-800 dark:text-stone-100 mt-1">
            {financialStats.totalExpected} <span className="text-xs font-normal text-stone-500">{currency}</span>
          </p>
        </div>

        <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-[#E2D5CC] dark:border-stone-800">
          <span className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1.5 font-bold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            المحصل فعلياً
          </span>
          <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">
            {financialStats.totalCollected} <span className="text-xs font-normal text-stone-500">{currency}</span>
          </p>
        </div>

        <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-[#E2D5CC] dark:border-stone-800">
          <span className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1.5 font-bold">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
            المتبقي للتحصيل
          </span>
          <p className="text-xl font-bold text-rose-700 dark:text-rose-400 mt-1">
            {financialStats.totalRemaining} <span className="text-xs font-normal text-stone-500">{currency}</span>
          </p>
        </div>
      </div>

      {/* التبويبات */}
      <div className="flex border-b border-[#E2D5CC] dark:border-stone-800 gap-6 text-sm font-bold">
        <button
          onClick={() => setActiveTab('finances')}
          className={`pb-3 transition flex items-center gap-2 ${
            activeTab === 'finances' 
              ? 'border-b-2 border-[#8E5364] text-[#8E5364] dark:text-[#E8BDC8]' 
              : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          كشف الاشتراكات والسداد لجميع الطالبات ({allActiveStudents.length})
        </button>

        {track && (
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 transition flex items-center gap-2 ${
              activeTab === 'overview' 
                ? 'border-b-2 border-[#8E5364] text-[#8E5364] dark:text-[#E8BDC8]' 
                : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            معايير دليل الإتقان ({track.name})
          </button>
        )}
      </div>

      {/* جدول اشتراكات الطالبات المباشر */}
      {activeTab === 'finances' && (
        <div className="bg-white dark:bg-stone-900 rounded-3xl border border-[#E2D5CC] dark:border-stone-800 overflow-hidden shadow-xs space-y-3">
          <div className="p-5 border-b border-stone-100 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm text-stone-800 dark:text-stone-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#8E5364]" />
                سجل سداد الطالبات لشهر ({currentCycle})
              </h3>
              <span className="text-xs text-stone-500 mt-0.5 block">
                المسددات: {financialStats.paidCount} من إجمالي {allActiveStudents.length} طالبة
              </span>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-stone-400 absolute right-3 top-2.5" />
              <input
                type="text"
                placeholder="بحث باسم الطالبة أو الكود..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-[#FAF7F5] dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl pr-9 pl-3 py-2 text-xs outline-hidden"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="bg-[#FAF7F5] dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-bold">
                <tr>
                  <th className="p-3.5">#</th>
                  <th className="p-3.5">الطالبة</th>
                  <th className="p-3.5">الحلقة</th>
                  <th className="p-3.5">المطلوب</th>
                  <th className="p-3.5">المسدد</th>
                  <th className="p-3.5">الحالة</th>
                  <th className="p-3.5">التوقيع</th>
                  <th className="p-3.5 text-center">إجراء السداد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800 text-stone-700 dark:text-stone-200">
                {filteredStudents.map((st, idx) => {
                  const circle = circles.find(c => c.id === st.circleId);
                  const sub = (studentSubscriptions || []).find(s => s.studentId === st.id);
                  const isPaid = sub?.status === 'paid' || (sub?.paidAmount ?? 0) >= feeAmount;
                  const isExempt = sub?.status === 'exempt';
                  const isPartial = (sub?.paidAmount ?? 0) > 0 && !isPaid;

                  return (
                    <tr key={st.id} className="hover:bg-stone-50/50 dark:hover:bg-stone-800/30 transition">
                      <td className="p-3.5 text-stone-400 font-mono">{idx + 1}</td>
                      <td className="p-3.5">
                        <strong className="block text-stone-900 dark:text-stone-100 font-bold">{st.name}</strong>
                        <span className="text-[10px] text-stone-400 font-mono">{st.code}</span>
                      </td>
                      <td className="p-3.5 text-stone-500">{circle?.name || 'غير محدد'}</td>
                      <td className="p-3.5 font-mono">{sub?.requiredAmount ?? feeAmount} {currency}</td>
                      <td className="p-3.5 font-mono font-bold text-emerald-600">{sub?.paidAmount ?? 0} {currency}</td>
                      <td className="p-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isPaid ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' :
                          isExempt ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300' :
                          isPartial ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300' :
                          'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                        }`}>
                          {isPaid ? 'مدفوع بالكامل' : isExempt ? 'معفاة / منحة' : isPartial ? 'سداد جزئي' : 'معلق / لم يدفع'}
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
                          className="px-3.5 py-1.5 bg-[#FAF7F5] dark:bg-stone-800 hover:bg-[#8E5364] hover:text-white dark:hover:bg-[#8E5364] text-[#8E5364] dark:text-[#E8BDC8] rounded-xl text-[11px] font-bold transition flex items-center gap-1 mx-auto shadow-2xs"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          سند السداد
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-stone-400 text-xs">
                      لا توجد طالبات مسجلات في المنظومة حالياً.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* تبويب دليل الإتقان */}
      {activeTab === 'overview' && track && (
        <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl border border-[#E2D5CC] dark:border-stone-800 space-y-4">
          <h2 className="text-sm font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">
            <span>📖</span>
            معايير «دليل مشكاة الغيم» المعتمدة
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-[#FAF7F5] dark:bg-stone-800/50">
              <span className="text-stone-500 block mb-1">الاستماع للمقرئ</span>
              <strong className="text-[#8E5364] dark:text-[#E8BDC8]">{track.systemRules?.masteryGuide?.listenToReciterTimes || 3} مرات</strong>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#FAF7F5] dark:bg-stone-800/50">
              <span className="text-stone-500 block mb-1">التلاوة نظراً</span>
              <strong className="text-[#8E5364] dark:text-[#E8BDC8]">{track.systemRules?.masteryGuide?.reciteLookingTimes || 5} مرات</strong>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#FAF7F5] dark:bg-stone-800/50">
              <span className="text-stone-500 block mb-1">التكرار المتقن</span>
              <strong className="text-[#8E5364] dark:text-[#E8BDC8]">{track.systemRules?.masteryGuide?.masteryRepetitionTimes || 20} مرة</strong>
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
