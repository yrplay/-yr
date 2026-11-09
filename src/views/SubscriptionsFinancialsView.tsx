import React, { useState, useMemo } from 'react';
import { 
  DollarSign, Users, CreditCard, FileText, CheckCircle2, 
  AlertCircle, Search, ArrowRight, ShieldAlert, Check, Edit3, Settings, Calendar, Filter, RotateCcw, Layers
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { hasFullAccess, StudentSubscription } from '../types';
import { calculateSubscriptionStats, deduplicateSubscriptionsByCycle } from '../services/subscriptionMath';
import { RenderEntityIcon } from '../components/CircleIconLibrary';

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
    students, circles, tracks, currentUser,
    studentSubscriptions, saveStudentSubscription, settings, updateSettings,
    selectedTrackId, setSelectedTrackId
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

  const isLeader = hasFullAccess(currentUser);

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

  const getStudentSubscriptions = (studentId: string, cycleFilter = selectedCycleFilter) =>
    deduplicateSubscriptionsByCycle(
      (studentSubscriptions || []).filter(subscription => subscription.studentId === studentId),
      currentCycle,
      cycleFilter
    );

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
        <p className="text-xs text-stone-500">سجّلي الخروج ثم ادخلي باستخدام حساب إداري مخوّل للوصول إلى هذا القسم.</p>
      </div>
    );
  }

  // تحديد المسار النشط إن وجد عزل
  const activeTrack = useMemo(() => {
    if (!selectedTrackId || selectedTrackId === 'all') return null;
    return tracks.find(t => t.id === selectedTrackId) || null;
  }, [tracks, selectedTrackId]);

  // رسم الاشتراك المعتمد للمسار النشط أو العام
  const effectiveFee = activeTrack?.subscriptionFee?.amount ?? defaultFee;

  // الطالبات الخاضعات للعرض المالي (معزولة بالمسار عند تحديده، أو كافة الطالبات)
  const allStudents = useMemo(() => {
    if (activeTrack) {
      return (students || []).filter(s => s.trackId === activeTrack.id);
    }
    return students || [];
  }, [students, activeTrack]);

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return allStudents;
    return allStudents.filter(s => 
      s.name.includes(searchQuery) || (s.code && s.code.includes(searchQuery))
    );
  }, [allStudents, searchQuery]);

  // الإحصاءات المالية المباشرة وفق المسار النشط والفلتر المحدد
  const stats = useMemo(
    () => calculateSubscriptionStats(allStudents, studentSubscriptions || [], currentCycle, selectedCycleFilter, effectiveFee),
    [allStudents, studentSubscriptions, effectiveFee, selectedCycleFilter, currentCycle]
  );

  // سجلات الحسابات المالية المستقلة لكل مسار للعرض الإداري المجمّع
  const trackLedgers = useMemo(() => {
    return tracks.filter(t => !t.isArchived).map(t => {
      const trackStudents = (students || []).filter(s => s.trackId === t.id);
      const fee = t.subscriptionFee?.amount ?? defaultFee;
      const trackStats = calculateSubscriptionStats(
        trackStudents,
        studentSubscriptions || [],
        currentCycle,
        selectedCycleFilter,
        fee
      );
      return {
        track: t,
        studentsCount: trackStudents.length,
        fee,
        stats: trackStats
      };
    });
  }, [tracks, students, studentSubscriptions, currentCycle, selectedCycleFilter, defaultFee]);

  const handleOpenPayment = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    const assignedTrackId = student?.trackId || (activeTrack?.id || tracks[0]?.id || 't-1');
    const targetTrack = tracks.find(t => t.id === assignedTrackId);
    const studentFee = targetTrack?.subscriptionFee?.amount ?? effectiveFee;

    // جلب سجل الاشتراك المعروض حالياً للطالبة لضمان التطابق الكامل مع الجدول
    const existing = getStudentSubscriptions(studentId, selectedCycleFilter)[0];
    const writeCycle = existing?.cycleMonth || (selectedCycleFilter === 'all' ? currentCycle : selectedCycleFilter);

    if (existing) {
      const req = existing.requiredAmount ?? studentFee;
      const paid = existing.paidAmount ?? 0;
      const resolvedStatus =
        existing.status === 'exempt' || existing.paymentMethod === 'exempt'
          ? 'exempt'
          : existing.status === 'overdue'
          ? 'overdue'
          : existing.status === 'paid' || (paid >= req && req > 0)
          ? 'paid'
          : existing.status === 'partial' || (paid > 0 && paid < req)
          ? 'partial'
          : 'pending';

      setSelectedSub({
        ...existing,
        studentId,
        trackId: existing.trackId || assignedTrackId,
        cycleMonth: writeCycle,
        requiredAmount: req,
        paidAmount: resolvedStatus === 'exempt' ? 0 : paid,
        status: resolvedStatus,
        paymentMethod: resolvedStatus === 'exempt' ? 'exempt' : (existing.paymentMethod || 'bank_transfer'),
        receiptNumber: existing.receiptNumber || '',
        notes: existing.notes || ''
      });
    } else {
      setSelectedSub({
        studentId,
        trackId: assignedTrackId,
        cycleMonth: writeCycle,
        requiredAmount: studentFee,
        paidAmount: 0,
        status: 'pending',
        paymentMethod: 'bank_transfer',
        receiptNumber: '',
        notes: ''
      });
    }
    setShowPaymentModal(true);
  };

  const handleSavePayment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
          const existing = getStudentSubscriptions(st.id, editingCycle)[0];
          const newFee = Number(editingDefaultFee) || 150;
          if (existing) {
            if (existing.status !== 'exempt') {
              const paid = existing.paidAmount || 0;
              const newStatus = paid >= newFee ? 'paid' : paid > 0 ? 'partial' : 'pending';
              await saveStudentSubscription({
                ...existing,
                requiredAmount: newFee,
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
      {/* رأس الصفحة مع شارة المسار أو الملخص المجمّع */}
      <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl border border-[#E2D5CC] dark:border-stone-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <RenderEntityIcon icon={activeTrack?.icon} className="text-2xl" sproutClassName="w-6 h-6 text-[#96503E]" fallback="credit" />
            <h1 className="text-xl font-bold text-stone-800 dark:text-stone-100 font-quran">
              {activeTrack ? `سجل اشتراكات ${activeTrack.name}` : 'الاشتراكات والمالية العامة (كافة المسارات)'}
            </h1>
            <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold ${
              activeTrack
                ? 'bg-[#8E5364]/10 text-[#722F37] border border-[#8E5364]/20'
                : 'bg-[#FAF7F5] dark:bg-stone-800 text-[#8E5364] dark:text-[#E8BDC8]'
            }`}>
              {activeTrack ? 'سجل مالي معزول' : 'ملخص إداري مجمّع'}
            </span>
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            {activeTrack 
              ? `إدارة وتحصيل اشتراكات الطالبات المسجلات حصراً في ${activeTrack.name} (الرسم المقرر: ${effectiveFee} ${currency})`
              : 'سجل تحصيل ومتابعة رسوم واشتراكات طالبات المقرأة مباشرة مع إصدار وتوثيق سندات السداد لكافة المسارات'
            }
          </p>
        </div>

        {/* القسم الأيمن في الترويسة: فلتر دورة التحصيل بحسب الأشهر وزر التعديل أو العودة */}
        <div className="flex flex-wrap items-center gap-2">
          {activeTrack && (
            <button
              type="button"
              onClick={() => setSelectedTrackId(null)}
              className="px-3.5 py-2 bg-white dark:bg-stone-800 hover:bg-stone-100 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
              title="عرض الملخص الإداري لكافة المسارات"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#8E5364]" />
              <span>كافة المسارات</span>
            </button>
          )}

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
              setEditingDefaultFee(effectiveFee);
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

      {/* بطاقات المؤشرات المالية العلوية (تتحدث لحظياً عند حفظ أي تعديل) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* بطاقة 1: إجمالي الطالبات */}
        <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-[#E2D5CC] dark:border-stone-800 shadow-2xs">
          <span className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1.5 font-bold">
            <Users className="w-3.5 h-3.5 text-[#8E5364]" />
            {activeTrack ? `طالبات ${activeTrack.name}` : 'إجمالي الطالبات'}
          </span>
          <p className="text-xl font-bold text-stone-800 dark:text-stone-100 mt-1">
            {allStudents.length} <span className="text-xs font-normal text-stone-500">طالبة</span>
          </p>
        </div>

        {/* بطاقة 2: المبلغ المتوقع */}
        <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-[#E2D5CC] dark:border-stone-800 shadow-2xs">
          <span className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1.5 font-bold">
            <DollarSign className="w-3.5 h-3.5 text-amber-600" />
            {activeTrack ? 'المبلغ المتوقع للمسار' : 'إجمالي المبلغ المتوقع'}
          </span>
          <p className="text-xl font-bold text-stone-800 dark:text-stone-100 mt-1">
            {stats.totalExpected} <span className="text-xs font-normal text-stone-500">{currency}</span>
          </p>
        </div>

        {/* بطاقة 3: إجمالي المحصل */}
        <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-[#E2D5CC] dark:border-stone-800 shadow-2xs">
          <span className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1.5 font-bold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>إجمالي المحصل</span>
          </span>
          <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">
            {stats.totalCollected} <span className="text-xs font-normal text-stone-500">{currency}</span>
          </p>
        </div>

        {/* بطاقة 4: المبالغ المتبقية */}
        <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-[#E2D5CC] dark:border-stone-800 shadow-2xs">
          <span className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1.5 font-bold">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>المبالغ المتبقية</span>
          </span>
          <p className="text-xl font-bold text-rose-700 dark:text-rose-400 mt-1">
            {stats.totalRemaining} <span className="text-xs font-normal text-stone-500">{currency}</span>
          </p>
        </div>

        {/* بطاقة 5: عدد المعفيات / المنح الدراسية */}
        <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-[#E2D5CC] dark:border-stone-800 shadow-2xs col-span-2 sm:col-span-1">
          <span className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1.5 font-bold">
            <Check className="w-3.5 h-3.5 text-purple-600" />
            <span>عدد المعفيات</span>
          </span>
          <p className="text-xl font-bold text-purple-700 dark:text-purple-400 mt-1">
            {stats.exemptCount} <span className="text-xs font-normal text-stone-500">طالبة</span>
          </p>
        </div>
      </div>

      {/* التقرير الإداري التنفيذي: تفصيل السجلات المالية لكل مسار مستقل عند اختيار كافة المسارات */}
      {!activeTrack && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-stone-800 dark:text-stone-100 flex items-center gap-2">
              <span className="text-base">📊</span>
              <span>الملخص التنفيذي للمسارات (سجلات مالية مستقلة)</span>
            </h3>
            <span className="text-xs text-stone-500">
              إجمالي {trackLedgers.length} مسارات معتمدة
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {trackLedgers.map(({ track: t, studentsCount, fee, stats: tStats }) => {
              const collectionRate = tStats.totalExpected > 0
                ? Math.min(100, Math.round((tStats.totalCollected / tStats.totalExpected) * 100))
                : 0;

              return (
                <div
                  key={t.id}
                  className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-[#E2D5CC] dark:border-stone-800 shadow-2xs hover:shadow-sm transition flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-[#8E5364]/10 text-xl flex items-center justify-center border border-[#8E5364]/20 shrink-0">
                        <RenderEntityIcon icon={t.icon} className="text-xl" sproutClassName="w-5 h-5 text-[#96503E]" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs sm:text-sm text-stone-900 dark:text-stone-100">
                          {t.name}
                        </h4>
                        <span className="text-[11px] text-stone-500 block">
                          الرسم: <strong className="text-stone-800 dark:text-stone-200">{fee} {currency}</strong> ({t.subscriptionFee?.period === 'term' ? 'فصلياً' : 'شهرياً'})
                        </span>
                      </div>
                    </div>

                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                      {studentsCount} طالبة
                    </span>
                  </div>

                  {/* شريط الإنجاز ونسبة التحصيل */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-stone-500 font-bold">نسبة التحصيل:</span>
                      <span className="font-mono font-bold text-emerald-600">{collectionRate}%</span>
                    </div>
                    <div className="w-full bg-stone-100 dark:bg-stone-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${collectionRate}%` }}
                      />
                    </div>
                  </div>

                  {/* إحصائيات الأرقام */}
                  <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-stone-100 dark:border-stone-800 text-center text-[10px]">
                    <div className="p-1.5 bg-stone-50 dark:bg-stone-800/60 rounded-xl">
                      <span className="text-stone-400 block text-[9px]">المحصل</span>
                      <span className="font-bold font-mono text-emerald-600">{tStats.totalCollected}</span>
                    </div>
                    <div className="p-1.5 bg-stone-50 dark:bg-stone-800/60 rounded-xl">
                      <span className="text-stone-400 block text-[9px]">المتوقع</span>
                      <span className="font-bold font-mono text-stone-700 dark:text-stone-300">{tStats.totalExpected}</span>
                    </div>
                    <div className="p-1.5 bg-stone-50 dark:bg-stone-800/60 rounded-xl">
                      <span className="text-stone-400 block text-[9px]">المتبقي</span>
                      <span className="font-bold font-mono text-rose-600">{tStats.totalRemaining}</span>
                    </div>
                  </div>

                  {/* زر التبديل إلى سجل هذا المسار المنعزل */}
                  <button
                    type="button"
                    onClick={() => setSelectedTrackId(t.id)}
                    className="w-full py-2 bg-[#8E5364]/10 hover:bg-[#8E5364] text-[#722F37] hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer mt-1 active:scale-95"
                  >
                    <span>عزل وعرض سجل {t.name}</span>
                    <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* جدول كشف حسابات الطالبات */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl border border-[#E2D5CC] dark:border-stone-800 overflow-hidden shadow-xs space-y-3">
        <div className="p-5 border-b border-stone-100 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm text-stone-800 dark:text-stone-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#8E5364]" />
              <span>كشف سداد الطالبات {activeTrack ? `(خاص بـ ${activeTrack.name})` : '(كافة المسارات)'} ({allStudents.length} طالبة)</span>
            </h3>
            <span className="text-xs text-stone-500 mt-0.5 block">
              مدفوع بالكامل: {stats.paidCount} • مدفوع جزئياً: {stats.partialCount ?? 0} • غير مدفوع / متأخر: {(stats.pendingCount || 0) - (stats.partialCount || 0)} • المعفيات: {stats.exemptCount}
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
                {!activeTrack && <th className="p-3.5">المسار القرآني</th>}
                <th className="p-3.5">الحلقة</th>
                <th className="p-3.5">المطلوب</th>
                <th className="p-3.5">المسدد</th>
                <th className="p-3.5">المتبقي</th>
                <th className="p-3.5">الحالة</th>
                <th className="p-3.5 text-center">إجراءات الاشتراك</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800 text-stone-700 dark:text-stone-200">
              {filteredStudents.map((st, idx) => {
                const circle = circles.find(c => c.id === st.circleId);
                const studentTrack = tracks.find(t => t.id === st.trackId) || tracks[0];
                const studentTrackFee = studentTrack?.subscriptionFee?.amount ?? effectiveFee;
                const sub = getStudentSubscriptions(st.id)[0];

                const isExempt = Boolean(sub && (sub.status === 'exempt' || sub.paymentMethod === 'exempt'));
                const reqAmount = sub ? (sub.requiredAmount ?? studentTrackFee) : studentTrackFee;
                const paidAmount = isExempt ? 0 : (sub ? (sub.paidAmount ?? 0) : 0);
                const isPaid = !isExempt && (sub?.status === 'paid' || (paidAmount >= reqAmount && reqAmount > 0));
                const isOverdue = !isExempt && !isPaid && sub?.status === 'overdue';
                const isPartial = !isExempt && !isPaid && !isOverdue && (sub?.status === 'partial' || (paidAmount > 0 && paidAmount < reqAmount));
                const remainingAmount = isExempt || isPaid ? 0 : Math.max(0, reqAmount - paidAmount);

                const statusBadgeConfig = isPaid
                  ? {
                      label: 'مدفوع بالكامل',
                      className: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                    }
                  : isExempt
                  ? {
                      label: 'معفاة / منحة دراسية',
                      className: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800'
                    }
                  : isPartial
                  ? {
                      label: 'مدفوع جزئياً',
                      className: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                    }
                  : isOverdue
                  ? {
                      label: 'متأخر عن السداد',
                      className: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                    }
                  : {
                      label: 'غير مدفوع / معلق',
                      className: 'bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700'
                    };

                return (
                  <tr key={st.id} className="hover:bg-stone-50/50 dark:hover:bg-stone-800/30 transition">
                    <td className="p-3.5 text-stone-400 font-mono">{idx + 1}</td>
                    <td className="p-3.5">
                      <strong className="block text-stone-900 dark:text-stone-100 font-bold">
                        <span className="privacy-student-name">{st.name}</span>
                      </strong>
                      <span className="text-[10px] text-stone-400 font-mono privacy-phone">{st.code}</span>
                    </td>
                    {!activeTrack && (
                      <td className="p-3.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#8E5364]/10 text-[#722F37] border border-[#8E5364]/20">
                          <span>{studentTrack?.name}</span>
                        </span>
                      </td>
                    )}
                    <td className="p-3.5 text-stone-500">{circle?.name || 'غير محدد'}</td>
                    <td className="p-3.5 font-mono">{isExempt ? `0 ${currency} (إعفاء)` : `${reqAmount} ${currency}`}</td>
                    <td className="p-3.5 font-mono font-bold text-emerald-600">{paidAmount} {currency}</td>
                    <td className={`p-3.5 font-mono font-bold ${remainingAmount > 0 ? 'text-rose-600' : 'text-stone-400'}`}>
                      {remainingAmount} {currency}
                    </td>
                    <td className="p-3.5">
                      <button
                        type="button"
                        onClick={() => handleOpenPayment(st.id)}
                        title="انقري لتعديل حالة الاشتراك أو بيانات السداد"
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition cursor-pointer hover:opacity-85 active:scale-95 ${statusBadgeConfig.className}`}
                      >
                        {statusBadgeConfig.label}
                      </button>
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => handleOpenPayment(st.id)}
                          className="px-3.5 py-1.5 bg-[#FAF7F5] dark:bg-stone-800 hover:bg-[#8E5364] hover:text-white dark:hover:bg-[#8E5364] text-[#8E5364] dark:text-[#E8BDC8] rounded-xl text-[11px] font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95 border border-[#E2D5CC] dark:border-stone-700"
                          title="تعديل بيانات الاشتراك وسند السداد"
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
                  <td colSpan={activeTrack ? 8 : 9} className="p-8 text-center text-stone-400 text-xs">
                    {activeTrack ? `لا توجد طالبات مسجلات في ${activeTrack.name} حالياً.` : 'لا توجد طالبات مسجلات في المنظومة حتى الآن.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* نافذة تعديل بيانات الاشتراك وسند السداد التفاعلية */}
      {showPaymentModal && selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <form
            onSubmit={handleSavePayment}
            className="bg-white dark:bg-stone-900 border border-[#E2D5CC] dark:border-stone-800 rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl text-right animate-in fade-in max-h-[92vh] overflow-y-auto"
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <h3 className="text-sm font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#8E5364]" />
                <span>تعديل بيانات الاشتراك: <span className="privacy-student-name">{students.find(s => s.id === selectedSub.studentId)?.name}</span></span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowPaymentModal(false);
                  setSelectedSub(null);
                }}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* 1. خيارات حالة الاشتراك القابلة للنقر والاختيار المباشر */}
              <div className="p-3.5 bg-[#FAF7F5] dark:bg-stone-800/90 rounded-2xl border border-stone-200 dark:border-stone-700 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-700 dark:text-stone-200 text-xs">
                    حالة الاشتراك (انقري لاختيار الحالة):
                  </span>
                  <span className="text-[11px] font-bold text-stone-500">
                    المتبقي:{' '}
                    <strong className={selectedSub.status === 'exempt' || selectedSub.status === 'paid' ? 'text-emerald-600 font-mono' : 'text-rose-600 font-mono'}>
                      {selectedSub.status === 'exempt'
                        ? `0 ${currency} (إعفاء)`
                        : selectedSub.status === 'paid'
                        ? `0 ${currency}`
                        : `${Math.max(0, Number(selectedSub.requiredAmount ?? defaultFee) - Number(selectedSub.paidAmount ?? 0))} ${currency}`}
                    </strong>
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {/* خيار 1: مدفوع بالكامل */}
                  <button
                    type="button"
                    onClick={() => {
                      const req = Number(selectedSub.requiredAmount ?? defaultFee) || defaultFee;
                      setSelectedSub({
                        ...selectedSub,
                        status: 'paid',
                        requiredAmount: req,
                        paidAmount: req,
                        paymentMethod: selectedSub.paymentMethod === 'exempt' ? 'bank_transfer' : (selectedSub.paymentMethod || 'bank_transfer')
                      });
                    }}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                      selectedSub.status === 'paid'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-500/30'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-current" />
                    <span>مدفوع بالكامل</span>
                  </button>

                  {/* خيار 2: مدفوع جزئياً */}
                  <button
                    type="button"
                    onClick={() => {
                      const req = Number(selectedSub.requiredAmount ?? defaultFee) || defaultFee;
                      const currentPaid = Number(selectedSub.paidAmount ?? 0);
                      const nextPaid = (currentPaid <= 0 || currentPaid >= req) ? Math.round(req / 2) : currentPaid;
                      setSelectedSub({
                        ...selectedSub,
                        status: 'partial',
                        requiredAmount: req,
                        paidAmount: nextPaid,
                        paymentMethod: selectedSub.paymentMethod === 'exempt' ? 'bank_transfer' : (selectedSub.paymentMethod || 'bank_transfer')
                      });
                    }}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                      selectedSub.status === 'partial'
                        ? 'bg-amber-500 text-white border-amber-500 shadow-xs ring-2 ring-amber-400/30'
                        : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-current" />
                    <span>مدفوع جزئياً</span>
                  </button>

                  {/* خيار 3: معفاة / منحة دراسية */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSub({
                        ...selectedSub,
                        status: 'exempt',
                        paidAmount: 0,
                        paymentMethod: 'exempt'
                      });
                    }}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                      selectedSub.status === 'exempt'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs ring-2 ring-purple-500/30'
                        : 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-800'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-current" />
                    <span>معفاة / منحة دراسية</span>
                  </button>

                  {/* خيار 4: غير مدفوع / معلق */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSub({
                        ...selectedSub,
                        status: 'pending',
                        paidAmount: 0,
                        paymentMethod: selectedSub.paymentMethod === 'exempt' ? 'bank_transfer' : (selectedSub.paymentMethod || 'bank_transfer')
                      });
                    }}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                      selectedSub.status === 'pending'
                        ? 'bg-stone-700 text-white border-stone-700 shadow-xs ring-2 ring-stone-500/30'
                        : 'bg-stone-100 text-stone-700 border-stone-200 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-current" />
                    <span>غير مدفوع / معلق</span>
                  </button>

                  {/* خيار 5: متأخر عن السداد */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSub({
                        ...selectedSub,
                        status: 'overdue',
                        paymentMethod: selectedSub.paymentMethod === 'exempt' ? 'bank_transfer' : (selectedSub.paymentMethod || 'bank_transfer')
                      });
                    }}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                      selectedSub.status === 'overdue'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs ring-2 ring-rose-500/30'
                        : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-current" />
                    <span>متأخر عن السداد</span>
                  </button>
                </div>

                {selectedSub.status === 'exempt' && (
                  <p className="text-[11px] text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/30 px-2.5 py-1.5 rounded-xl border border-purple-200 dark:border-purple-800/60 font-medium">
                    تم تفعيل الإعفاء / المنحة الدراسية للطالبة وتصفير الرصيد المتبقي تلقائياً.
                  </p>
                )}
              </div>

              {/* 2. الحقول التفاعلية للمبالغ وطريقة الدفع ورقم الإيصال والملاحظات */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-600 dark:text-stone-400 mb-1 font-bold">المبلغ المطلوب ({currency})</label>
                  <input
                    type="number"
                    min="0"
                    value={selectedSub.requiredAmount ?? defaultFee}
                    onChange={e => {
                      const req = Math.max(0, Number(e.target.value) || 0);
                      const paid = Number(selectedSub.paidAmount ?? 0);
                      const isEx = selectedSub.status === 'exempt';
                      const isOv = selectedSub.status === 'overdue';
                      const nextStatus = isEx
                        ? 'exempt'
                        : paid >= req && req > 0
                        ? 'paid'
                        : paid > 0
                        ? 'partial'
                        : isOv
                        ? 'overdue'
                        : 'pending';
                      setSelectedSub({
                        ...selectedSub,
                        requiredAmount: req,
                        status: nextStatus
                      });
                    }}
                    className="w-full bg-[#FAF7F5] dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-2.5 font-mono font-bold focus:ring-2 focus:ring-[#8E5364]/30 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-stone-600 dark:text-stone-400 mb-1 font-bold">المبلغ المدفوع ({currency})</label>
                  <input
                    type="number"
                    min="0"
                    value={selectedSub.paidAmount ?? 0}
                    onChange={e => {
                      const paid = Math.max(0, Number(e.target.value) || 0);
                      const req = Number(selectedSub.requiredAmount ?? defaultFee);
                      const isEx = selectedSub.status === 'exempt' && paid === 0;
                      const isOv = selectedSub.status === 'overdue' && paid === 0;
                      const nextStatus = isEx
                        ? 'exempt'
                        : paid >= req && req > 0
                        ? 'paid'
                        : paid > 0
                        ? 'partial'
                        : isOv
                        ? 'overdue'
                        : 'pending';
                      setSelectedSub({
                        ...selectedSub,
                        paidAmount: paid,
                        status: nextStatus,
                        paymentMethod: paid > 0 && selectedSub.paymentMethod === 'exempt' ? 'bank_transfer' : selectedSub.paymentMethod
                      });
                    }}
                    className="w-full bg-[#FAF7F5] dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-2.5 font-mono font-bold text-emerald-600 focus:ring-2 focus:ring-[#8E5364]/30 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-600 dark:text-stone-400 mb-1 font-bold">طريقة الدفع</label>
                  <select
                    value={selectedSub.paymentMethod || 'bank_transfer'}
                    onChange={e => {
                      const method = e.target.value as StudentSubscription['paymentMethod'];
                      if (method === 'exempt') {
                        setSelectedSub({
                          ...selectedSub,
                          paymentMethod: 'exempt',
                          status: 'exempt',
                          paidAmount: 0
                        });
                      } else {
                        const req = Number(selectedSub.requiredAmount ?? defaultFee);
                        const paid = Number(selectedSub.paidAmount ?? 0);
                        const nextStatus =
                          selectedSub.status === 'exempt'
                            ? (paid >= req && req > 0 ? 'paid' : paid > 0 ? 'partial' : 'pending')
                            : selectedSub.status;
                        setSelectedSub({
                          ...selectedSub,
                          paymentMethod: method,
                          status: nextStatus
                        });
                      }
                    }}
                    className="w-full bg-[#FAF7F5] dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-2.5 font-bold cursor-pointer focus:ring-2 focus:ring-[#8E5364]/30 outline-none"
                  >
                    <option value="bank_transfer">تحويل بنكي</option>
                    <option value="pos">شبكة / مدى</option>
                    <option value="cash">نقدي</option>
                    <option value="exempt">إعفاء</option>
                  </select>
                </div>
                <div>
                  <label className="block text-stone-600 dark:text-stone-400 mb-1 font-bold">رقم الإيصال / المرجع</label>
                  <input
                    type="text"
                    placeholder="مثال: TXN-998822"
                    value={selectedSub.receiptNumber || ''}
                    onChange={e => setSelectedSub({ ...selectedSub, receiptNumber: e.target.value })}
                    className="w-full bg-[#FAF7F5] dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-2.5 focus:ring-2 focus:ring-[#8E5364]/30 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-stone-600 dark:text-stone-400 mb-1 font-bold">ملاحظات إضافية</label>
                <input
                  type="text"
                  placeholder="مثال: تم السداد عبر حساب ولي الأمر الراجحي..."
                  value={selectedSub.notes || ''}
                  onChange={e => setSelectedSub({ ...selectedSub, notes: e.target.value })}
                  className="w-full bg-[#FAF7F5] dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-2.5 focus:ring-2 focus:ring-[#8E5364]/30 outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-stone-100 dark:border-stone-800">
              <button
                type="submit"
                className="flex-1 py-2.5 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs active:scale-95"
              >
                حفظ التعديلات واعتماد السند
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPaymentModal(false);
                  setSelectedSub(null);
                }}
                className="px-4 py-2.5 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-xl text-xs font-bold cursor-pointer hover:bg-stone-200 transition"
              >
                إلغاء
              </button>
            </div>
          </form>
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
