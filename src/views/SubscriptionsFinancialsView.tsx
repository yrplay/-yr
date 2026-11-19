import React, { useState, useMemo } from 'react';
import { 
  DollarSign, Users, CreditCard, FileText, FileCheck, CheckCircle2, 
  AlertCircle, Search, ArrowRight, ShieldAlert, Check, Edit3, Settings, Calendar, Filter, RotateCcw, Layers, Archive, X
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { hasFullAccess, StudentSubscription, isStudentEffectivelyArchived, deduplicateStudentsByName } from '../types';
import {
  CANONICAL_HIJRI_MONTHS,
  calculateSubscriptionStats,
  deduplicateSubscriptionsByCycle,
  normalizeHijriCycleLabel,
  parseHijriCycle
} from '../services/subscriptionMath';
import { getHijriParts } from '../utils/hijriDate';
import { RenderEntityIcon } from '../components/CircleIconLibrary';

const LEGACY_SEED_SUBSCRIPTION_IDS = new Set(['sub-1', 'sub-2', 'sub-3', 'sub-4', 'sub-5', 'sub-6']);

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

  const currentHijriParts = useMemo(() => getHijriParts(), []);
  const activeHijriYear = currentHijriParts.year >= 1448 ? currentHijriParts.year : 1448;
  const activeHijriMonthIndex =
    currentHijriParts.month >= 1 && currentHijriParts.month <= 12 ? currentHijriParts.month : 6;
  const defaultActiveCycle = `${CANONICAL_HIJRI_MONTHS[activeHijriMonthIndex - 1]} ${activeHijriYear}هـ`;

  const currentCycle = useMemo(() => {
    const parsed = parseHijriCycle(settings?.currentHijriMonth, activeHijriYear);
    if (parsed && parsed.hijriYear === activeHijriYear) {
      return parsed.canonicalLabel;
    }
    return defaultActiveCycle;
  }, [settings?.currentHijriMonth, activeHijriYear, defaultActiveCycle]);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [subscriptionTab, setSubscriptionTab] = useState<'active' | 'archived'>('active');
  const [selectedSub, setSelectedSub] = useState<Partial<StudentSubscription> | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // حالة نافذة تعديل الرسوم العامة ودورة التحصيل
  const [showFeeSettingsModal, setShowFeeSettingsModal] = useState(false);
  const [editingDefaultFee, setEditingDefaultFee] = useState<number>(settings?.defaultSubscriptionFee ?? 150);
  const [editingCycle, setEditingCycle] = useState<string>(currentCycle);
  const [editingCurrency, setEditingCurrency] = useState<string>(settings?.currency || 'ر.س');
  const [applyToExisting, setApplyToExisting] = useState(false);
  const [isSavingFeeSettings, setIsSavingFeeSettings] = useState(false);

  const isLeader = hasFullAccess(currentUser);

  const defaultFee = settings?.defaultSubscriptionFee ?? 150;
  const currency = settings?.currency || 'ر.س';

  // فلتر دورة التحصيل بحسب الأشهر (يبدأ افتراضياً بالشهر الهجري الحالي النشط)
  const [selectedCycleFilter, setSelectedCycleFilter] = useState<string>(() => currentCycle);

  // قائمة دورات الأشهر المتاحة للاختيار مرتبة ترتيباً هجرياً صارماً من محرم (1) إلى ذو الحجة (12)
  const availableCycles = useMemo(() => {
    const cycleMap = new Map<string, { hijriYear: number; monthIndex: number; label: string }>();

    // 1. إضافة جميع أشهر السنة الهجرية النشطة (1448هـ) من محرم (1) إلى ذو الحجة (12)
    CANONICAL_HIJRI_MONTHS.forEach((monthName, idx) => {
      const monthIndex = idx + 1;
      const key = `${activeHijriYear}-${String(monthIndex).padStart(2, '0')}`;
      cycleMap.set(key, {
        hijriYear: activeHijriYear,
        monthIndex,
        label: `${monthName} ${activeHijriYear}هـ`
      });
    });

    // 2. إضافة أي شهر من سنوات سابقة فقط إذا كان يملك سجلات سداد حقيقية محفوظة لطالبات فعليات في المنظومة
    const validStudentIds = new Set((students || []).map(st => st.id));
    (studentSubscriptions || []).forEach(sub => {
      if (!sub || !sub.cycleMonth) return;
      if (sub.id && LEGACY_SEED_SUBSCRIPTION_IDS.has(sub.id)) return;
      if (validStudentIds.size > 0 && !validStudentIds.has(sub.studentId)) return;

      const hasRealSavedPayment =
        (sub.paidAmount ?? 0) > 0 ||
        sub.status === 'paid' ||
        sub.status === 'partial' ||
        sub.status === 'exempt' ||
        sub.status === 'overdue' ||
        Boolean(sub.receiptNumber?.trim());
      if (!hasRealSavedPayment) return;

      const parsed = parseHijriCycle(sub.cycleMonth, activeHijriYear);
      if (!parsed || !parsed.hasExplicitYear) return;

      const key = `${parsed.hijriYear}-${String(parsed.monthIndex).padStart(2, '0')}`;
      if (!cycleMap.has(key)) {
        cycleMap.set(key, {
          hijriYear: parsed.hijriYear,
          monthIndex: parsed.monthIndex,
          label: parsed.canonicalLabel
        });
      }
    });

    // 3. التأكد من وجود الدورة الحالية المعتمدة
    const parsedCurrent = parseHijriCycle(currentCycle, activeHijriYear);
    if (parsedCurrent) {
      const key = `${parsedCurrent.hijriYear}-${String(parsedCurrent.monthIndex).padStart(2, '0')}`;
      if (!cycleMap.has(key)) {
        cycleMap.set(key, {
          hijriYear: parsedCurrent.hijriYear,
          monthIndex: parsedCurrent.monthIndex,
          label: parsedCurrent.canonicalLabel
        });
      }
    }

    return Array.from(cycleMap.values())
      .sort((a, b) => a.hijriYear - b.hijriYear || a.monthIndex - b.monthIndex)
      .map(entry => entry.label);
  }, [activeHijriYear, currentCycle, studentSubscriptions, students]);

  const getStudentSubscriptions = (studentId: string, cycleFilter = selectedCycleFilter) =>
    deduplicateSubscriptionsByCycle(
      (studentSubscriptions || []).filter(subscription => subscription.studentId === studentId),
      currentCycle,
      cycleFilter,
      activeHijriYear
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
  const scopedStudents = useMemo(() => {
    const list = students || [];
    if (activeTrack) {
      return list.filter(s => {
        const circle = circles.find(c => c.id === s.circleId);
        const stTrackId = s.trackId || circle?.trackId;
        return stTrackId === activeTrack.id;
      });
    }
    return list;
  }, [students, circles, activeTrack]);

  // الطالبات النشطات فقط (استبعاد المؤرشفات أو المنتميات لحلقات مؤرشفة + منع تكرار الطالبة المنسوخة لحلقة جديدة)
  const activeScopedStudents = useMemo(() => {
    const activeOnly = scopedStudents.filter(s => !isStudentEffectivelyArchived(s, circles, tracks));
    return deduplicateStudentsByName(activeOnly);
  }, [scopedStudents, circles, tracks]);

  // الطالبات المؤرشفات أو المنتميات لحلقات مؤرشفة (مع الاحتفاظ بسجلاتهن المالية التاريخية كاملة)
  const archivedScopedStudents = useMemo(() => {
    return scopedStudents.filter(s => isStudentEffectivelyArchived(s, circles, tracks));
  }, [scopedStudents, circles, tracks]);

  // القائمة المعروضة في الجدول بحسب التبويب المحدد
  const allStudents = useMemo(() => {
    return subscriptionTab === 'archived' ? archivedScopedStudents : activeScopedStudents;
  }, [subscriptionTab, activeScopedStudents, archivedScopedStudents]);

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return allStudents;
    return allStudents.filter(s => 
      s.name.includes(searchQuery) || (s.code && s.code.includes(searchQuery))
    );
  }, [allStudents, searchQuery]);

  // الإحصاءات المالية المباشرة للطالبات النشطات دائماً في العدادات الأساسية (أو للتبويب المعروض)
  const activeStats = useMemo(
    () => calculateSubscriptionStats(activeScopedStudents, studentSubscriptions || [], currentCycle, selectedCycleFilter, effectiveFee),
    [activeScopedStudents, studentSubscriptions, effectiveFee, selectedCycleFilter, currentCycle]
  );

  const displayedTabStats = useMemo(
    () => calculateSubscriptionStats(allStudents, studentSubscriptions || [], currentCycle, selectedCycleFilter, effectiveFee),
    [allStudents, studentSubscriptions, effectiveFee, selectedCycleFilter, currentCycle]
  );

  // العدادات العلوية تعرض إحصاءات الاشتراكات النشطة افتراضياً (وعند فتح تبويب المؤرشفة تعرض إحصاءات المؤرشفة)
  const stats = subscriptionTab === 'archived' ? displayedTabStats : activeStats;

  // سجلات الحسابات المالية المستقلة لكل مسار نشط (تقتصر على الطالبات النشطات فقط دون المؤرشفات)
  const trackLedgers = useMemo(() => {
    return tracks.filter(t => !t.isArchived).map(t => {
      const rawTrackStudents = (students || []).filter(s => {
        if (isStudentEffectivelyArchived(s, circles, tracks)) return false;
        const circle = circles.find(c => c.id === s.circleId);
        const stTrackId = s.trackId || circle?.trackId;
        return stTrackId === t.id;
      });
      const trackStudents = deduplicateStudentsByName(rawTrackStudents);
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
  }, [tracks, students, circles, studentSubscriptions, currentCycle, selectedCycleFilter, defaultFee]);

  const handleOpenPayment = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    const assignedTrackId = student?.trackId || (activeTrack?.id || tracks[0]?.id || 't-1');
    const targetTrack = tracks.find(t => t.id === assignedTrackId);
    const studentFee = targetTrack?.subscriptionFee?.amount ?? effectiveFee;

    // جلب سجل الاشتراك المعروض حالياً للطالبة لضمان التطابق الكامل مع الجدول
    const existing = getStudentSubscriptions(studentId, selectedCycleFilter)[0];
    const writeCycle =
      selectedCycleFilter === 'all'
        ? (existing?.cycleMonth ? normalizeHijriCycleLabel(existing.cycleMonth, activeHijriYear) : currentCycle)
        : normalizeHijriCycleLabel(selectedCycleFilter, activeHijriYear);

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
        cycleMonth: normalizeHijriCycleLabel(existing.cycleMonth || writeCycle, activeHijriYear),
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
    const normalizedSubCycle = normalizeHijriCycleLabel(
      selectedSub.cycleMonth || (selectedCycleFilter === 'all' ? currentCycle : selectedCycleFilter),
      activeHijriYear
    );
    await saveStudentSubscription({
      ...selectedSub,
      cycleMonth: normalizedSubCycle
    });
    setShowPaymentModal(false);
    setSelectedSub(null);
  };

  // حفظ وتحديث الرسوم العامة ودورة التحصيل
  const handleSaveFeeSettings = async () => {
    setIsSavingFeeSettings(true);
    try {
      const normalizedCycle = normalizeHijriCycleLabel(editingCycle, activeHijriYear) || defaultActiveCycle;
      await updateSettings({
        defaultSubscriptionFee: Number(editingDefaultFee) || 150,
        currentHijriMonth: normalizedCycle,
        currency: editingCurrency
      });
      setSelectedCycleFilter(normalizedCycle);

      // إذا طلبت الإدارة تطبيق الرسم الجديد على الطالبات النشطات فقط (حفاظاً على السجلات التاريخية للمؤرشفات)
      if (applyToExisting && activeScopedStudents.length > 0) {
        for (const st of activeScopedStudents) {
          const existing = getStudentSubscriptions(st.id, normalizedCycle)[0];
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
              cycleMonth: normalizedCycle,
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
            {activeTrack ? (
              <RenderEntityIcon icon={activeTrack.icon} className="text-2xl" sproutClassName="w-6 h-6 text-theme-primary" />
            ) : (
              <CreditCard className="w-6 h-6 text-theme-primary shrink-0" />
            )}
            <h1 className="text-xl font-bold text-stone-800 dark:text-stone-100 font-quran">
              {activeTrack ? `سجل اشتراكات ${activeTrack.name}` : 'الاشتراكات والمالية العامة (كافة المسارات)'}
            </h1>
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            {activeTrack 
              ? `إدارة وتحصيل اشتراكات الطالبات المسجلات حصراً في ${activeTrack.name} (الرسم المقرر: ${effectiveFee} ${currency})`
              : 'سجل تحصيل ومتابعة رسوم واشتراكات طالبات المقرأة مباشرة مع إصدار وتوثيق سندات السداد لكافة المسارات'
            }
          </p>
        </div>

        {/* القسم الأيمن في الترويسة: أزرار الإجراءات الأيقونية جنباً إلى جنب وفلتر دورة التحصيل */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 flex-nowrap shrink-0">
            {activeTrack && (
              <button
                type="button"
                onClick={() => setSelectedTrackId(null)}
                className="w-9 h-9 p-2.5 bg-white hover:bg-stone-50 text-theme-primary border border-stone-200 rounded-xl transition flex items-center justify-center cursor-pointer shadow-2xs active:scale-95 shrink-0"
                title="كافة المسارات"
                aria-label="كافة المسارات"
              >
                <RotateCcw className="w-4 h-4 shrink-0" />
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setEditingDefaultFee(effectiveFee);
                setEditingCycle(currentCycle);
                setEditingCurrency(currency);
                setShowFeeSettingsModal(true);
              }}
              className="w-9 h-9 p-2.5 bg-white hover:bg-stone-50 text-theme-primary border border-stone-200 rounded-xl transition flex items-center justify-center cursor-pointer shadow-2xs active:scale-95 shrink-0"
              title="تعديل الرسوم والدورة"
              aria-label="تعديل الرسوم والدورة"
            >
              <Edit3 className="w-4 h-4 shrink-0" />
            </button>
          </div>

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
        <div className="p-5 border-b border-stone-100 dark:border-stone-800 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm text-stone-800 dark:text-stone-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#8E5364]" />
                <span>
                  {subscriptionTab === 'archived' ? 'سجل الاشتراكات المؤرشفة' : 'كشف سداد الطالبات النشطات'}{' '}
                  {activeTrack ? `(خاص بـ ${activeTrack.name})` : '(كافة المسارات)'} ({allStudents.length} طالبة)
                </span>
              </h3>
              <span className="text-xs text-stone-500 mt-0.5 block">
                مدفوع بالكامل: {displayedTabStats.paidCount} • مدفوع جزئياً: {displayedTabStats.partialCount ?? 0} • غير مدفوع / متأخر: {(displayedTabStats.pendingCount || 0) - (displayedTabStats.partialCount || 0)} • المعفيات: {displayedTabStats.exemptCount}
              </span>
            </div>

            {/* شريط الأدوات الموحد: أيقونة البحث + تبويبات الاشتراكات النشطة والمؤرشفة في صف أفقي واحد */}
            <div className="flex items-center gap-2 flex-nowrap self-start sm:self-auto">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsSearchExpanded(prev => !prev)}
                  title="بحث باسم الطالبة أو الكود"
                  aria-label="بحث باسم الطالبة أو الكود"
                  className={`w-10 h-10 rounded-xl border transition flex items-center justify-center cursor-pointer shadow-2xs active:scale-95 shrink-0 ${
                    isSearchExpanded || searchQuery
                      ? 'bg-theme-primary hover:bg-theme-primary-hover text-white border-theme-primary'
                      : 'bg-white hover:bg-stone-50 text-theme-primary border-stone-200'
                  }`}
                >
                  <Search className="w-4 h-4 shrink-0" />
                </button>

                {(isSearchExpanded || searchQuery) && (
                  <div className="relative w-48 sm:w-56 animate-in fade-in duration-150">
                    <input
                      type="text"
                      autoFocus
                      placeholder="بحث باسم الطالبة أو الكود..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full h-10 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl pr-3 pl-8 text-xs text-stone-800 dark:text-stone-100 outline-hidden focus:ring-2 focus:ring-theme-primary focus:border-theme-primary"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setIsSearchExpanded(false);
                        }}
                        title="مسح البحث"
                        aria-label="مسح البحث"
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-theme-primary cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-white border border-stone-200 shrink-0 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setSubscriptionTab('active')}
                  title="الاشتراكات النشطة"
                  aria-label="الاشتراكات النشطة"
                  className={`h-9 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0 ${
                    subscriptionTab === 'active'
                      ? 'bg-theme-primary text-white shadow-2xs'
                      : 'bg-white text-stone-600 hover:bg-stone-50 hover:text-theme-primary'
                  }`}
                >
                  <CheckCircle2 className={`w-4 h-4 shrink-0 ${subscriptionTab === 'active' ? 'text-white' : 'text-theme-primary'}`} />
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] leading-none font-bold ${
                    subscriptionTab === 'active'
                      ? 'bg-white/20 text-white'
                      : 'bg-stone-100 text-stone-600'
                  }`}>
                    {activeScopedStudents.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setSubscriptionTab('archived')}
                  title="الاشتراكات المؤرشفة"
                  aria-label="الاشتراكات المؤرشفة"
                  className={`h-9 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0 ${
                    subscriptionTab === 'archived'
                      ? 'bg-theme-primary text-white shadow-2xs'
                      : 'bg-white text-stone-600 hover:bg-stone-50 hover:text-theme-primary'
                  }`}
                >
                  <Archive className={`w-4 h-4 shrink-0 ${subscriptionTab === 'archived' ? 'text-white' : 'text-theme-primary'}`} />
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] leading-none font-bold ${
                    subscriptionTab === 'archived'
                      ? 'bg-white/20 text-white'
                      : 'bg-stone-100 text-stone-600'
                  }`}>
                    {archivedScopedStudents.length}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {subscriptionTab === 'archived' && (
            <div className="pt-1">
              <span className="text-[11px] text-theme-primary bg-stone-50 border border-stone-200 px-3 py-1 rounded-xl font-medium inline-block">
                سجل مالي تاريخي محفوظ للطالبات المؤرشفات أو المنتميات لحلقات مؤرشفة (محفوظ بالكامل مع سندات السداد)
              </span>
            </div>
          )}
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
                    <td className="p-3.5 text-stone-500">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{circle?.name || 'غير محدد'}</span>
                        {isStudentEffectivelyArchived(st, circles, tracks) && (
                          <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            مؤرشفة
                          </span>
                        )}
                      </div>
                    </td>
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
                          className="w-9 h-9 bg-white hover:bg-stone-50 text-theme-primary border border-stone-200 rounded-xl transition flex items-center justify-center shadow-2xs cursor-pointer active:scale-95 shrink-0"
                          title="سند السداد"
                          aria-label="سند السداد"
                        >
                          <FileCheck className="w-4 h-4 shrink-0" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={activeTrack ? 8 : 9} className="p-8 text-center text-stone-400 text-xs">
                    {subscriptionTab === 'archived'
                      ? 'لا توجد اشتراكات مؤرشفة مطابقة للعرض حالياً.'
                      : activeTrack
                      ? `لا توجد طالبات نشطات مسجلات في ${activeTrack.name} حالياً.`
                      : 'لا توجد طالبات نشطات مسجلات في المنظومة حتى الآن.'}
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
                  المبلغ المتوقع الإجمالي للطالبات النشطات = عدد الطالبات النشطات ({activeScopedStudents.length}) × {editingDefaultFee} = {(activeScopedStudents.length * editingDefaultFee).toLocaleString()} {editingCurrency}
                </p>
              </div>

              <div>
                <label className="block text-stone-700 dark:text-stone-300 mb-1.5 font-bold">
                  اسم دورة التحصيل الحالية
                </label>
                <select
                  value={normalizeHijriCycleLabel(editingCycle, activeHijriYear) || defaultActiveCycle}
                  onChange={e => setEditingCycle(e.target.value)}
                  className="w-full bg-[#FAF7F5] dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-3 py-2.5 text-xs font-bold text-stone-800 dark:text-stone-100 outline-hidden focus:border-[#8E5364] cursor-pointer"
                >
                  {CANONICAL_HIJRI_MONTHS.map(monthName => {
                    const cycleOption = `${monthName} ${activeHijriYear}هـ`;
                    return (
                      <option key={cycleOption} value={cycleOption} className="bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100">
                        {cycleOption}
                      </option>
                    );
                  })}
                </select>
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
                      تطبيق الرسم الجديد فوراً على سجلات الطالبات النشطات ({activeScopedStudents.length} طالبة)
                    </span>
                    <span className="text-[10px] text-stone-500 block mt-0.5 leading-relaxed">
                      عند التفعيل، سيتم تحديث المبلغ المطلوب في كشف الطالبات النشطات غير المعفيات تلقائياً بالقيمة الجديدة ({editingDefaultFee} {editingCurrency}) دون المساس بالسجلات المؤرشفة.
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
