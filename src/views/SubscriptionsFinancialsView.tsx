import React, { useState, useMemo } from 'react';
import { 
  DollarSign, Users, CreditCard, FileText, CheckCircle2, 
  AlertCircle, Search, ArrowRight, ShieldAlert, Check, Edit3, Settings, Calendar, Filter
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StudentSubscription } from '../types';

const HIJRI_MONTHS = [
  'محرم ١٤٤٧هـ',
  'صفر ١٤٤٧هـ',
  'ربيع الأول ١٤٤٧هـ',
  'ربيع الثاني ١٤٤٧هـ',
  'جمادى الأولى ١٤٤٧هـ',
  'جمادى الآخرة ١٤٤٧هـ',
  'رجب ١٤٤٧هـ',
  'شعبان ١٤٤٧هـ',
  'رمضان ١٤٤٧هـ',
  'شوال ١٤٤٧هـ',
  'ذو القعدة ١٤٤٧هـ',
  'ذو الحجة ١٤٤٧هـ'
];

interface SubscriptionsFinancialsViewProps {
  onNavigateToStudent?: (studentId: string) => void;
}

export const SubscriptionsFinancialsView: React.FC<SubscriptionsFinancialsViewProps> = ({
  onNavigateToStudent
}) => {
  const { 
    students, circles, tracks, currentUser, users, switchUser,
    studentSubscriptions, saveStudentSubscription, settings, updateSettings 
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSub, setSelectedSub] = useState<Partial<StudentSubscription> | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // حالة نافذة تعديل الرسوم العامة ودورة التحصيل
  const [showFeeSettingsModal, setShowFeeSettingsModal] = useState(false);
  const [editingDefaultFee, setEditingDefaultFee] = useState<number>(settings?.defaultSubscriptionFee ?? 150);
  const [editingCycle, setEditingCycle] = useState<string>(settings?.currentHijriMonth || 'الشهر الحالي');
  const [editingCurrency, setEditingCurrency] = useState<string>(settings?.currency || 'ر.س');
  const [applyToExisting, setApplyToExisting] = useState(false);
  const [isSavingFeeSettings, setIsSavingFeeSettings] = useState(false);

  const isLeader = currentUser?.role === 'leader';

  const defaultFee = settings?.defaultSubscriptionFee ?? 150;
  const currency = settings?.currency || 'ر.س';
  const currentCycle = settings?.currentHijriMonth || 'الشهر الحالي';

  // فلتر دورة التحصيل بحسب الأشهر
  const [selectedCycleFilter, setSelectedCycleFilter] = useState<string>('all');

  // قائمة دورات الأشهر المتاحة للاختيار
  const availableCycles = useMemo(() => {
    const list: string[] = [];
    if (currentCycle && !list.includes(currentCycle)) {
      list.push(currentCycle);
    }
    HIJRI_MONTHS.forEach(m => {
      if (!list.includes(m)) list.push(m);
    });
    (studentSubscriptions || []).forEach(s => {
      if (s.cycleMonth && !list.includes(s.cycleMonth)) {
        list.push(s.cycleMonth);
      }
    });
    return list;
  }, [currentCycle, studentSubscriptions]);

  // قفل أمني: حصر قسم الاشتراكات والمالية على الإدارة العليا أو من يملك صلاحية إدارة المالية
  const canAccessFinances = isLeader || !!currentUser?.permissions?.canManageFinances;
  if (!canAccessFinances) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center" dir="rtl">
        <div className="w-16 h-16 rounded-3xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center text-3xl shadow-xs mb-4">
          <ShieldAlert className="w-8 h-8 text-rose-600" />
        </div>
        <h2 className="text-xl font-bold font-quran text-stone-900 mb-2">
          قسم الاشتراكات والمالية خاص بالإدارة العليا
        </h2>
        <p className="text-xs sm:text-sm text-stone-500 max-w-md mb-6 leading-relaxed">
          عذراً، هذا القسم يشتمل على الرسوم والاشتراكات وسندات التحصيل والمبالغ المالية، وتقتصر صلاحية الاطلاع عليه وإدارته على الإدارة العليا أو المفوّضين بصلاحية المالية فقط.
        </p>
        <button
          type="button"
          onClick={async () => {
            const leaderUser = users.find(u => u.role === 'leader') || users[0];
            if (leaderUser) await switchUser(leaderUser.id);
          }}
          className="px-4 py-2.5 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
        >
          <span>👑 الانتقال لحساب الإدارة العليا (أ. ريفة المنصوري)</span>
        </button>
      </div>
    );
  }

  // جميع الطالبات المسجلات في المنظومة
  const allStudents = useMemo(() => {
    return students || [];
  }, [students]);

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return allStudents;
    return allStudents.filter(s => 
      s.name.includes(searchQuery) || (s.code && s.code.includes(searchQuery))
    );
  }, [allStudents, searchQuery]);

  // الإحصاءات المالية المباشرة وفق الفلتر المحدد
  const stats = useMemo(() => {
    const totalExpected = allStudents.length * defaultFee;
    let totalCollected = 0;
    let paidCount = 0;
    let pendingCount = 0;
    let exemptCount = 0;

    allStudents.forEach(st => {
      const sub = (studentSubscriptions || []).find(s => {
        if (s.studentId !== st.id) return false;
        if (selectedCycleFilter === 'all') return true;
        return s.cycleMonth === selectedCycleFilter || (!s.cycleMonth && selectedCycleFilter === currentCycle);
      });
      const paid = sub?.paidAmount ?? 0;
      totalCollected += paid;

      if (sub?.status === 'paid' || paid >= (sub?.requiredAmount ?? defaultFee)) {
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
  }, [allStudents, studentSubscriptions, defaultFee, selectedCycleFilter, currentCycle]);

  const handleOpenPayment = (studentId: string) => {
    const existing = (studentSubscriptions || []).find(s => {
      if (s.studentId !== studentId) return false;
      if (selectedCycleFilter === 'all') return true;
      return s.cycleMonth === selectedCycleFilter || (!s.cycleMonth && selectedCycleFilter === currentCycle);
    });
    setSelectedSub(existing || {
      studentId,
      trackId: 'general',
      cycleMonth: selectedCycleFilter === 'all' ? currentCycle : selectedCycleFilter,
      requiredAmount: defaultFee,
      paidAmount: defaultFee,
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

  // حفظ وتحديث الرسوم العامة ودورة التحصيل
  const handleSaveFeeSettings = async () => {
    setIsSavingFeeSettings(true);
    try {
      await updateSettings({
        defaultSubscriptionFee: Number(editingDefaultFee) || 150,
        currentHijriMonth: editingCycle,
        currency: editingCurrency
      });

      // إذا طلبت الإدارة تطبيق الرسم الجديد على الطالبات
      if (applyToExisting && allStudents.length > 0) {
        for (const st of allStudents) {
          const existing = (studentSubscriptions || []).find(s => s.studentId === st.id);
          const newFee = Number(editingDefaultFee) || 150;
          if (existing) {
            if (existing.status !== 'exempt') {
              const paid = existing.paidAmount || 0;
              const newStatus = paid >= newFee ? 'paid' : paid > 0 ? 'partial' : 'pending';
              await saveStudentSubscription({
                ...existing,
                requiredAmount: newFee,
                cycleMonth: editingCycle,
                status: newStatus
              });
            }
          } else {
            await saveStudentSubscription({
              studentId: st.id,
              trackId: st.trackId || 'general',
              cycleMonth: editingCycle,
              requiredAmount: newFee,
              paidAmount: 0,
              status: 'pending'
            });
          }
        }
      }

      setShowFeeSettingsModal(false);
    } catch (err) {
      console.error('Error saving fee settings:', err);
    } finally {
      setIsSavingFeeSettings(false);
    }
  };

  return (
    <div className="space-y-6 text-right pb-12" dir="rtl">
      {/* رأس الصفحة */}
      <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl border border-[#E2D5CC] dark:border-stone-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">💳</span>
            <h1 className="text-xl font-bold text-stone-800 dark:text-stone-100 font-quran">
              الاشتراكات والمالية العامة
            </h1>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#FAF7F5] dark:bg-stone-800 text-[#8E5364] dark:text-[#E8BDC8] font-bold">
              خاص بالإدارة العليا
            </span>
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            سجل تحصيل ومتابعة رسوم واشتراكات طالبات المقرأة مباشرة مع إصدار وتوثيق سندات السداد
          </p>
        </div>

        {/* القسم الأيمن في الترويسة: فلتر دورة التحصيل بحسب الأشهر وزر التعديل */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-[#FAF7F5] dark:bg-stone-800 px-3.5 py-2 rounded-2xl border border-[#E2D5CC] dark:border-stone-700 flex items-center gap-2 shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-[#8E5364] shrink-0" />
            <span className="text-xs text-stone-500 dark:text-stone-400 font-bold whitespace-nowrap">
              دورة التحصيل:
            </span>
            <select
              value={selectedCycleFilter}
              onChange={e => setSelectedCycleFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-[#8E5364] dark:text-[#E8BDC8] outline-hidden cursor-pointer pr-1"
              title="فلترة كشف التحصيل بحسب دورة الشهر"
            >
              <option value="all" className="bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100">
                جميع الأشهر والدورات
              </option>
              {availableCycles.map(c => (
                <option key={c} value={c} className="bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100">
                  {c}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingDefaultFee(defaultFee);
              setEditingCycle(currentCycle);
              setEditingCurrency(currency);
              setShowFeeSettingsModal(true);
            }}
            className="px-3.5 py-2 bg-[#8E5364] hover:bg-[#744251] text-white rounded-2xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
            title="تعديل قيمة رسم الاشتراك ودورة التحصيل"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>تعديل الرسوم والدورة</span>
          </button>
        </div>
      </div>

      {/* بطاقات المؤشرات المالية */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* بطاقة 1: إجمالي الطالبات */}
        <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-[#E2D5CC] dark:border-stone-800">
          <span className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1.5 font-bold">
            <Users className="w-3.5 h-3.5 text-[#8E5364]" />
            إجمالي الطالبات
          </span>
          <p className="text-xl font-bold text-stone-800 dark:text-stone-100 mt-1">{allStudents.length}</p>
        </div>

        {/* بطاقة 2: المبلغ المتوقع */}
        <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-[#E2D5CC] dark:border-stone-800 shadow-2xs">
          <span className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1.5 font-bold">
            <DollarSign className="w-3.5 h-3.5 text-amber-600" />
            المبلغ المتوقع
          </span>
          <p className="text-xl font-bold text-stone-800 dark:text-stone-100 mt-1">
            {stats.totalExpected} <span className="text-xs font-normal text-stone-500">{currency}</span>
          </p>
        </div>

        {/* بطاقة 3: المحصل فعلياً */}
        <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-[#E2D5CC] dark:border-stone-800">
          <span className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1.5 font-bold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            المحصل فعلياً
          </span>
          <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">
            {stats.totalCollected} <span className="text-xs font-normal text-stone-500">{currency}</span>
          </p>
        </div>

        {/* بطاقة 4: المتبقي للتحصيل */}
        <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-[#E2D5CC] dark:border-stone-800">
          <span className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1.5 font-bold">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
            المتبقي للتحصيل
          </span>
          <p className="text-xl font-bold text-rose-700 dark:text-rose-400 mt-1">
            {stats.totalRemaining} <span className="text-xs font-normal text-stone-500">{currency}</span>
          </p>
        </div>
      </div>

      {/* جدول كشف حسابات الطالبات */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl border border-[#E2D5CC] dark:border-stone-800 overflow-hidden shadow-xs space-y-3">
        <div className="p-5 border-b border-stone-100 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm text-stone-800 dark:text-stone-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#8E5364]" />
              كشف سداد الطالبات ({allStudents.length} طالبة)
            </h3>
            <span className="text-xs text-stone-500 mt-0.5 block">
              المسددات: {stats.paidCount} • المتبقيات: {stats.pendingCount} • المعفيات: {stats.exemptCount}
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
                <th className="p-3.5 text-center">إجراءات الاشتراك</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800 text-stone-700 dark:text-stone-200">
              {filteredStudents.map((st, idx) => {
                const circle = circles.find(c => c.id === st.circleId);
                const sub = (studentSubscriptions || []).find(s => {
                  if (s.studentId !== st.id) return false;
                  if (selectedCycleFilter === 'all') return true;
                  return s.cycleMonth === selectedCycleFilter || (!s.cycleMonth && selectedCycleFilter === currentCycle);
                });
                const reqAmount = sub?.requiredAmount ?? defaultFee;
                const paidAmount = sub?.paidAmount ?? 0;
                const isExempt = sub?.status === 'exempt';
                const isPaid = !isExempt && (sub?.status === 'paid' || paidAmount >= reqAmount);
                const isPartial = !isExempt && paidAmount > 0 && !isPaid;

                return (
                  <tr key={st.id} className="hover:bg-stone-50/50 dark:hover:bg-stone-800/30 transition">
                    <td className="p-3.5 text-stone-400 font-mono">{idx + 1}</td>
                    <td className="p-3.5">
                      <strong className="block text-stone-900 dark:text-stone-100 font-bold">{st.name}</strong>
                      <span className="text-[10px] text-stone-400 font-mono">{st.code}</span>
                    </td>
                    <td className="p-3.5 text-stone-500">{circle?.name || 'غير محدد'}</td>
                    <td className="p-3.5 font-mono">{reqAmount} {currency}</td>
                    <td className="p-3.5 font-mono font-bold text-emerald-600">{paidAmount} {currency}</td>
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
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center">
                        {/* زر سند السداد فقط (تم حذف زر التعديل من الكشف بناءً على طلب الإدارة) */}
                        <button
                          type="button"
                          onClick={() => handleOpenPayment(st.id)}
                          className="px-3.5 py-1.5 bg-[#FAF7F5] dark:bg-stone-800 hover:bg-[#8E5364] hover:text-white dark:hover:bg-[#8E5364] text-[#8E5364] dark:text-[#E8BDC8] rounded-xl text-[11px] font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95 border border-[#E2D5CC] dark:border-stone-700"
                          title="عرض أو تسجيل سند السداد"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>سند السداد</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-stone-400 text-xs">
                    لا توجد طالبات مسجلات في المنظومة حتى الآن.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* نافذة تعديل بيانات الاشتراك وسند السداد */}
      {showPaymentModal && selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-stone-900 border border-[#E2D5CC] dark:border-stone-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl text-right animate-in fade-in" dir="rtl">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <h3 className="text-sm font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#8E5364]" />
                <span>تعديل بيانات الاشتراك: {students.find(s => s.id === selectedSub.studentId)?.name}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-stone-600 dark:text-stone-400 mb-1 font-bold">المبلغ المطلوب ({currency})</label>
                  <input
                    type="number"
                    min="0"
                    value={selectedSub.requiredAmount ?? defaultFee}
                    onChange={e => {
                      const req = Number(e.target.value) || 0;
                      const paid = selectedSub.paidAmount ?? 0;
                      const isEx = selectedSub.status === 'exempt';
                      const st = isEx ? 'exempt' : (paid >= req && req > 0 ? 'paid' : (paid > 0 ? 'partial' : 'pending'));
                      setSelectedSub({ ...selectedSub, requiredAmount: req, status: st });
                    }}
                    className="w-full bg-[#FAF7F5] dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-2 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-stone-600 dark:text-stone-400 mb-1 font-bold">المبلغ المدفوع ({currency})</label>
                  <input
                    type="number"
                    min="0"
                    value={selectedSub.paidAmount ?? defaultFee}
                    onChange={e => {
                      const paid = Number(e.target.value) || 0;
                      const req = selectedSub.requiredAmount ?? defaultFee;
                      const isEx = selectedSub.status === 'exempt';
                      const st = isEx ? 'exempt' : (paid >= req && req > 0 ? 'paid' : (paid > 0 ? 'partial' : 'pending'));
                      setSelectedSub({ ...selectedSub, paidAmount: paid, status: st });
                    }}
                    className="w-full bg-[#FAF7F5] dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-2 font-mono font-bold text-emerald-600"
                  />
                </div>
              </div>

              {/* حساب الحالة تلقائياً مع خيار الإعفاء */}
              <div className="p-3 bg-[#FAF7F5] dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-700 dark:text-stone-300 text-[11px]">
                    الحالة المحتسبة تلقائياً:
                  </span>
                  {(() => {
                    const req = selectedSub.requiredAmount ?? defaultFee;
                    const paid = selectedSub.paidAmount ?? 0;
                    const isEx = selectedSub.status === 'exempt';
                    const isPaid = !isEx && paid >= req && req > 0;
                    const isPartial = !isEx && paid > 0 && !isPaid;
                    return (
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        isPaid ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' :
                        isEx ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300' :
                        isPartial ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300' :
                        'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                      }`}>
                        {isPaid ? 'مدفوع بالكامل ✅' : isEx ? 'معفاة / منحة 🎓' : isPartial ? 'سداد جزئي ⏳' : 'معلق / لم يدفع ⚠️'}
                      </span>
                    );
                  })()}
                </div>

                <label className="flex items-center gap-2 pt-1 border-t border-stone-200 dark:border-stone-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedSub.status === 'exempt'}
                    onChange={e => {
                      const isEx = e.target.checked;
                      const req = selectedSub.requiredAmount ?? defaultFee;
                      const paid = selectedSub.paidAmount ?? 0;
                      setSelectedSub({
                        ...selectedSub,
                        status: isEx ? 'exempt' : (paid >= req && req > 0 ? 'paid' : (paid > 0 ? 'partial' : 'pending'))
                      });
                    }}
                    className="accent-[#8E5364] rounded"
                  />
                  <span className="text-[11px] text-stone-600 dark:text-stone-300 font-bold">
                    إعفاء الطالبة من الرسوم (منحة دراسية / معفاة)
                  </span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-stone-600 dark:text-stone-400 mb-1 font-bold">طريقة الدفع</label>
                  <select
                    value={selectedSub.paymentMethod || 'bank_transfer'}
                    onChange={e => setSelectedSub({ ...selectedSub, paymentMethod: e.target.value as any })}
                    className="w-full bg-[#FAF7F5] dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-2 font-bold"
                  >
                    <option value="bank_transfer">تحويل بنكي</option>
                    <option value="cash">نقداً</option>
                    <option value="pos">شبكة / مدى</option>
                    <option value="other">أخرى</option>
                  </select>
                </div>
                <div>
                  <label className="block text-stone-600 dark:text-stone-400 mb-1 font-bold">رقم الإيصال / المرجع</label>
                  <input
                    type="text"
                    placeholder="مثال: TXN-998822"
                    value={selectedSub.receiptNumber || ''}
                    onChange={e => setSelectedSub({ ...selectedSub, receiptNumber: e.target.value })}
                    className="w-full bg-[#FAF7F5] dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-stone-600 dark:text-stone-400 mb-1 font-bold">ملاحظات إضافية على السداد</label>
                <input
                  type="text"
                  placeholder="مثال: تم السداد عبر حساب ولي الأمر الراجحي..."
                  value={selectedSub.notes || ''}
                  onChange={e => setSelectedSub({ ...selectedSub, notes: e.target.value })}
                  className="w-full bg-[#FAF7F5] dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-2"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-stone-100 dark:border-stone-800">
              <button
                type="button"
                onClick={handleSavePayment}
                className="flex-1 py-2.5 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs active:scale-95"
              >
                حفظ التعديلات واعتماد السند
              </button>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2.5 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تعديل الرسوم العامة ودورة التحصيل */}
      {showFeeSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-stone-900 border border-[#E2D5CC] dark:border-stone-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl text-right animate-in fade-in" dir="rtl">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#FAF7F5] dark:bg-stone-800 text-[#8E5364] flex items-center justify-center">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-800 dark:text-stone-100 font-quran">
                    تعديل الرسوم والاشتراك المالي
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    ضبط الرسم الشهري المعتمد ودورة التحصيل في المقرأة
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFeeSettingsModal(false)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-stone-700 dark:text-stone-300 mb-1.5 font-bold">
                  رسم الاشتراك المعتمد للطالبة ({editingCurrency})
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={editingDefaultFee}
                    onChange={e => setEditingDefaultFee(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full bg-[#FAF7F5] dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-3 py-2.5 font-mono text-sm font-bold text-stone-800 dark:text-stone-100 outline-hidden focus:border-[#8E5364]"
                  />
                  <span className="absolute left-3 top-2.5 text-stone-400 font-bold">{editingCurrency}</span>
                </div>
                <p className="text-[11px] text-stone-400 mt-1">
                  المبلغ المتوقع الإجمالي = عدد الطالبات ({allStudents.length}) × {editingDefaultFee} = {(allStudents.length * editingDefaultFee).toLocaleString()} {editingCurrency}
                </p>
              </div>

              <div>
                <label className="block text-stone-700 dark:text-stone-300 mb-1.5 font-bold">
                  اسم دورة التحصيل الحالية
                </label>
                <input
                  type="text"
                  placeholder="مثال: رمضان ١٤٤٧هـ أو شعبان..."
                  value={editingCycle}
                  onChange={e => setEditingCycle(e.target.value)}
                  className="w-full bg-[#FAF7F5] dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-3 py-2.5 text-xs text-stone-800 dark:text-stone-100 outline-hidden focus:border-[#8E5364]"
                />
              </div>

              <div>
                <label className="block text-stone-700 dark:text-stone-300 mb-1.5 font-bold">
                  العملة المعتمدة
                </label>
                <input
                  type="text"
                  value={editingCurrency}
                  onChange={e => setEditingCurrency(e.target.value)}
                  className="w-full bg-[#FAF7F5] dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-3 py-2 text-xs font-bold"
                />
              </div>

              <div className="p-3 bg-[#FAF7F5] dark:bg-stone-800/60 rounded-2xl border border-[#E2D5CC] dark:border-stone-700/60">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyToExisting}
                    onChange={e => setApplyToExisting(e.target.checked)}
                    className="accent-[#8E5364] rounded mt-0.5"
                  />
                  <div>
                    <span className="text-[11px] text-stone-800 dark:text-stone-200 font-bold block">
                      تطبيق الرسم الجديد فوراً على سجلات الطالبات المسجلات ({allStudents.length} طالبة)
                    </span>
                    <span className="text-[10px] text-stone-500 block mt-0.5 leading-relaxed">
                      عند التفعيل، سيتم تحديث المبلغ المطلوب في كشف الطالبات غير المعفيات تلقائياً بالقيمة الجديدة ({editingDefaultFee} {editingCurrency}).
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-stone-100 dark:border-stone-800">
              <button
                type="button"
                disabled={isSavingFeeSettings}
                onClick={handleSaveFeeSettings}
                className="flex-1 py-2.5 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSavingFeeSettings ? 'جاري الحفظ والتطبيق...' : 'حفظ واعتماد التعديلات'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowFeeSettingsModal(false)}
                className="px-4 py-2.5 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-xl text-xs font-bold cursor-pointer hover:bg-stone-200 transition"
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
