import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  CreditCard, Wallet, DollarSign, CheckCircle2, AlertCircle,
  Clock, Plus, Search, Filter, Download, Printer, Edit, Trash2,
  FileCheck, Shield, Sparkles, ChevronDown, Check, X, ArrowUpRight,
  Receipt, ArrowDownLeft, Calendar, UserCheck
} from 'lucide-react';
import { StudentSubscription, PaymentStatus, PaymentMethod } from '../types';
import { OfficialSeal } from '../components/OfficialSeal';

export const SubscriptionsFinancialsView: React.FC = () => {
  const {
    students, tracks, circles, studentSubscriptions, currentUser,
    createOrUpdateSubscription, recordSubscriptionPayment,
    batchGenerateSubscriptions, deleteSubscription, settings, showToast
  } = useApp();

  const isLeader = currentUser?.role === 'leader';

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTrackFilter, setSelectedTrackFilter] = useState<string>('all');
  const [selectedCircleFilter, setSelectedCircleFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedCycleMonth, setSelectedCycleMonth] = useState<string>(settings.currentHijriMonth || 'ربيع الآخر - جمادى الأولى 1446');

  // Modals
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<StudentSubscription | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [selectedSubForReceipt, setSelectedSubForReceipt] = useState<StudentSubscription | null>(null);

  // Form State
  const [form, setForm] = useState<{
    id?: string;
    studentId: string;
    trackId: string;
    cycleMonth: string;
    requiredAmount: number;
    paidAmount: number;
    status: PaymentStatus;
    paymentMethod: PaymentMethod;
    paymentDate: string;
    receiptNumber: string;
    notes: string;
  }>({
    studentId: '',
    trackId: tracks[0]?.id || 't-1',
    cycleMonth: settings.currentHijriMonth || '1446',
    requiredAmount: 250,
    paidAmount: 250,
    status: 'paid',
    paymentMethod: 'bank_transfer',
    paymentDate: new Date().toISOString().split('T')[0],
    receiptNumber: `TRX-${Math.floor(10000 + Math.random() * 90000)}`,
    notes: ''
  });

  // Filtered subscriptions
  const filteredSubscriptions = useMemo(() => {
    return studentSubscriptions.filter(sub => {
      const student = students.find(s => s.id === sub.studentId);
      if (!student) return false;

      // Track Filter
      if (selectedTrackFilter !== 'all' && sub.trackId !== selectedTrackFilter) return false;

      // Circle Filter
      if (selectedCircleFilter !== 'all' && student.circleId !== selectedCircleFilter) return false;

      // Status Filter
      if (selectedStatusFilter !== 'all' && sub.status !== selectedStatusFilter) return false;

      // Search Query
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchesName = student.name.toLowerCase().includes(q);
        const matchesCode = student.code.toLowerCase().includes(q);
        const matchesReceipt = sub.receiptNumber?.toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesReceipt) return false;
      }

      return true;
    });
  }, [studentSubscriptions, students, selectedTrackFilter, selectedCircleFilter, selectedStatusFilter, searchTerm]);

  // Overall KPIs calculation
  const kpis = useMemo(() => {
    let req = 0;
    let paid = 0;
    let exemptCount = 0;
    let exemptAmount = 0;
    let fullyPaidCount = 0;
    let partialCount = 0;
    let pendingCount = 0;

    filteredSubscriptions.forEach(s => {
      req += (s.requiredAmount || 0);
      paid += (s.paidAmount || 0);
      if (s.status === 'exempt') {
        exemptCount++;
        exemptAmount += (s.requiredAmount || 0);
      } else if (s.status === 'paid') {
        fullyPaidCount++;
      } else if (s.status === 'partial') {
        partialCount++;
      } else {
        pendingCount++;
      }
    });

    const pendingAmount = Math.max(0, req - paid - exemptAmount);
    const rate = req > 0 ? Math.round((paid / (req - exemptAmount > 0 ? req - exemptAmount : req)) * 100) : 0;

    return {
      totalRequired: req,
      totalPaid: paid,
      pendingAmount,
      exemptCount,
      exemptAmount,
      fullyPaidCount,
      partialCount,
      pendingCount,
      collectionRate: Math.min(100, Math.max(0, rate))
    };
  }, [filteredSubscriptions]);

  // Open modal for new subscription / payment
  const handleOpenNewPayment = (studentId?: string) => {
    const defaultStudent = studentId ? students.find(s => s.id === studentId) : students[0];
    const defaultTrack = tracks.find(t => t.id === defaultStudent?.trackId) || tracks[0];
    const fee = defaultTrack?.subscriptionFee?.amount ?? 250;

    setEditingSub(null);
    setForm({
      studentId: defaultStudent?.id || '',
      trackId: defaultTrack?.id || 't-1',
      cycleMonth: selectedCycleMonth,
      requiredAmount: fee,
      paidAmount: fee,
      status: 'paid',
      paymentMethod: 'bank_transfer',
      paymentDate: new Date().toISOString().split('T')[0],
      receiptNumber: `TRX-${Math.floor(10000 + Math.random() * 90000)}`,
      notes: 'تم استلام الدفعة وإصدار الإيصال'
    });
    setPaymentModalOpen(true);
  };

  // Open modal to edit existing subscription
  const handleOpenEditPayment = (sub: StudentSubscription) => {
    setEditingSub(sub);
    setForm({
      id: sub.id,
      studentId: sub.studentId,
      trackId: sub.trackId,
      cycleMonth: sub.cycleMonth,
      requiredAmount: sub.requiredAmount,
      paidAmount: sub.paidAmount,
      status: sub.status,
      paymentMethod: sub.paymentMethod || 'bank_transfer',
      paymentDate: sub.paymentDate || new Date().toISOString().split('T')[0],
      receiptNumber: sub.receiptNumber || '',
      notes: sub.notes || ''
    });
    setPaymentModalOpen(true);
  };

  // Submit payment / subscription
  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.studentId) {
      showToast('يرجى اختيار الطالبة', 'error');
      return;
    }

    const student = students.find(s => s.id === form.studentId);
    const trackId = student?.trackId || form.trackId;

    await createOrUpdateSubscription({
      id: editingSub?.id,
      studentId: form.studentId,
      trackId,
      cycleMonth: form.cycleMonth,
      requiredAmount: Number(form.requiredAmount),
      paidAmount: Number(form.paidAmount),
      status: form.status,
      paymentMethod: form.paymentMethod,
      paymentDate: form.paymentDate,
      receiptNumber: form.receiptNumber,
      notes: form.notes
    });

    setPaymentModalOpen(false);
  };

  // Batch generate subscriptions for active students
  const handleBatchGenerate = async () => {
    const count = await batchGenerateSubscriptions(
      selectedTrackFilter === 'all' ? '' : selectedTrackFilter,
      selectedCycleMonth
    );
  };

  // Open Receipt
  const handleViewReceipt = (sub: StudentSubscription) => {
    setSelectedSubForReceipt(sub);
    setReceiptModalOpen(true);
  };

  return (
    <div className="space-y-6" dir="rtl">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#16161A] p-5 rounded-3xl border border-[#E8DFD8] dark:border-stone-800 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">💳</span>
            <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 font-quran">
              إدارة الاشتراكات والتحصيل المالي للطالبات
            </h2>
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            رصد رسوم المسارات، توثيق الإيصالات والتحويلات، ومتابعة الإيرادات والنسب المالية اللحظية
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isLeader && (
            <button
              onClick={handleBatchGenerate}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-[#FAF0F3] dark:bg-[#2A1B22] hover:bg-[#F2DFE6] text-[#8E5364] dark:text-[#E8A5B8] border border-[#E8D5D8] dark:border-[#5B3946] rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
              title="توليد اشتراكات الدورة الشهرية الحالية لجميع الطالبات آلياً بحسب رسوم مساراتهن"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>توليد اشتراكات الدورة آلياً</span>
            </button>
          )}

          <button
            onClick={() => handleOpenNewPayment()}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>تسجيل دفعة / اشتراك جديد</span>
          </button>
        </div>
      </div>

      {/* Financial KPIs Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Total Required */}
        <div className="bg-white dark:bg-[#16161A] p-4 sm:p-5 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 dark:text-stone-400 text-xs font-semibold mb-2">
            <span>إجمالي الرسوم المطلوبة</span>
            <span className="p-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
              <CreditCard className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100">
            {kpis.totalRequired.toLocaleString()}{' '}
            <span className="text-xs font-bold text-stone-500">ر.س</span>
          </div>
          <div className="text-[11px] text-stone-400 mt-1">
            لعدد {filteredSubscriptions.length} اشتراك مسجل
          </div>
        </div>

        {/* Total Collected */}
        <div className="bg-white dark:bg-[#16161A] p-4 sm:p-5 rounded-3xl border border-emerald-200/80 dark:border-emerald-900/50 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 text-xs font-semibold mb-2">
            <span>الإيرادات المحصلة فعلياً</span>
            <span className="p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
              <ArrowDownLeft className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-400">
            {kpis.totalPaid.toLocaleString()}{' '}
            <span className="text-xs font-bold text-emerald-600/80">ر.س</span>
          </div>
          <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400/70 mt-1 font-semibold">
            {kpis.fullyPaidCount} مسدد بالكامل • {kpis.partialCount} جزئي
          </div>
        </div>

        {/* Outstanding / Pending */}
        <div className="bg-white dark:bg-[#16161A] p-4 sm:p-5 rounded-3xl border border-rose-200/80 dark:border-rose-900/50 shadow-2xs">
          <div className="flex items-center justify-between text-rose-700 dark:text-rose-400 text-xs font-semibold mb-2">
            <span>المبالغ المتبقية والمعلقة</span>
            <span className="p-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300">
              <Clock className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-rose-700 dark:text-rose-400">
            {kpis.pendingAmount.toLocaleString()}{' '}
            <span className="text-xs font-bold text-rose-600/80">ر.س</span>
          </div>
          <div className="text-[11px] text-rose-600/80 dark:text-rose-400/70 mt-1 font-semibold">
            {kpis.pendingCount} طالبة لم تسدد بعد
          </div>
        </div>

        {/* Exemptions */}
        <div className="bg-white dark:bg-[#16161A] p-4 sm:p-5 rounded-3xl border border-purple-200/80 dark:border-purple-900/50 shadow-2xs">
          <div className="flex items-center justify-between text-purple-700 dark:text-purple-400 text-xs font-semibold mb-2">
            <span>المعفيات والمنح</span>
            <span className="p-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300">
              <Award className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-purple-700 dark:text-purple-400">
            {kpis.exemptAmount.toLocaleString()}{' '}
            <span className="text-xs font-bold text-purple-600/80">ر.س</span>
          </div>
          <div className="text-[11px] text-purple-600/80 dark:text-purple-400/70 mt-1 font-semibold">
            {kpis.exemptCount} طالبة معفاة رسمياً
          </div>
        </div>

        {/* Collection Rate */}
        <div className="bg-white dark:bg-[#16161A] p-4 sm:p-5 rounded-3xl border border-amber-200/80 dark:border-amber-900/50 shadow-2xs col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 text-xs font-semibold mb-2">
            <span>نسبة التحصيل العامة</span>
            <span className="p-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
              <PercentBadge />
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-700 dark:text-amber-400">
            {kpis.collectionRate}%
          </div>
          <div className="w-full bg-stone-100 dark:bg-stone-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-amber-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${kpis.collectionRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-[#16161A] p-4 sm:p-5 rounded-3xl border border-[#E8DFD8] dark:border-stone-800 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          
          {/* Search Input */}
          <div className="relative">
            <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-400 mb-1">
              بحث عن طالبة / رقم إيصال:
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="اسم الطالبة أو الكود أو الإيصال..."
                className="w-full pl-8 pr-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl text-xs bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 placeholder:text-stone-400"
              />
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Track Filter */}
          <div>
            <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-400 mb-1">المسار:</label>
            <select
              value={selectedTrackFilter}
              onChange={e => setSelectedTrackFilter(e.target.value)}
              className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-bold bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200"
            >
              <option value="all">جميع المسارات</option>
              {tracks.filter(t => !t.isArchived).map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Circle Filter */}
          <div>
            <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-400 mb-1">الحلقة:</label>
            <select
              value={selectedCircleFilter}
              onChange={e => setSelectedCircleFilter(e.target.value)}
              className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-bold bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200"
            >
              <option value="all">جميع الحلقات</option>
              {circles.filter(c => !c.isArchived).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Payment Status Filter */}
          <div>
            <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-400 mb-1">حالة السداد:</label>
            <select
              value={selectedStatusFilter}
              onChange={e => setSelectedStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-bold bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200"
            >
              <option value="all">جميع الحالات</option>
              <option value="paid">✅ مدفوع بالكامل</option>
              <option value="partial">🟡 سداد جزئي</option>
              <option value="pending">🔴 معلق لم يسدد</option>
              <option value="exempt">🟣 معفاة بقرار الإدارة</option>
            </select>
          </div>

          {/* Cycle Month Filter */}
          <div>
            <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-400 mb-1">الدورة المالية:</label>
            <input
              type="text"
              value={selectedCycleMonth}
              onChange={e => setSelectedCycleMonth(e.target.value)}
              placeholder="ربيع الآخر - جمادى الأولى"
              className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-bold bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200"
            />
          </div>

        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="bg-white dark:bg-[#16161A] rounded-3xl border border-[#E8DFD8] dark:border-stone-800 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-[#FAF7F4] dark:bg-stone-900 text-stone-600 dark:text-stone-400 font-bold border-b border-stone-200 dark:border-stone-800">
              <tr>
                <th className="p-4">الطالبة</th>
                <th className="p-4">المسار والحلقة</th>
                <th className="p-4">الدورة الشهرية</th>
                <th className="p-4">المطلوب</th>
                <th className="p-4">المدفوع</th>
                <th className="p-4">المتبقي</th>
                <th className="p-4">حالة السداد</th>
                <th className="p-4">طريقة الدفع</th>
                <th className="p-4">رقم الإيصال / التاريخ</th>
                <th className="p-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {filteredSubscriptions.map(sub => {
                const student = students.find(s => s.id === sub.studentId);
                const track = tracks.find(t => t.id === sub.trackId);
                const circle = circles.find(c => c.id === student?.circleId);
                const pendingForSub = Math.max(0, (sub.requiredAmount || 0) - (sub.paidAmount || 0));

                return (
                  <tr key={sub.id} className="hover:bg-stone-50/70 dark:hover:bg-stone-900/40 transition">
                    <td className="p-4">
                      <div className="font-bold text-stone-900 dark:text-stone-100 text-sm">
                        {student?.name || 'طالبة غير محددة'}
                      </div>
                      <div className="text-[11px] text-stone-400 font-mono">
                        {student?.code} • {student?.phone || 'بدون هاتف'}
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1">
                        <span>{track?.icon || '🪴'}</span>
                        <span>{track?.name}</span>
                      </div>
                      <div className="text-[11px] text-stone-400">{circle?.name || '—'}</div>
                    </td>

                    <td className="p-4 font-medium text-stone-700 dark:text-stone-300">
                      {sub.cycleMonth}
                    </td>

                    <td className="p-4 font-bold text-stone-900 dark:text-stone-100">
                      {sub.requiredAmount} ر.س
                    </td>

                    <td className="p-4 font-bold text-emerald-700 dark:text-emerald-400">
                      {sub.paidAmount} ر.س
                    </td>

                    <td className="p-4 font-bold">
                      {sub.status === 'exempt' ? (
                        <span className="text-purple-600 dark:text-purple-400 text-[11px]">معفاة (0 ر.س)</span>
                      ) : pendingForSub === 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400 text-[11px]">لا يوجد</span>
                      ) : (
                        <span className="text-rose-600 dark:text-rose-400">{pendingForSub} ر.س</span>
                      )}
                    </td>

                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                        sub.status === 'paid'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : sub.status === 'partial'
                          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                          : sub.status === 'exempt'
                          ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                          : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                      }`}>
                        {sub.status === 'paid' && '✅ مدفوع'}
                        {sub.status === 'partial' && '🟡 سداد جزئي'}
                        {sub.status === 'pending' && '🔴 معلق'}
                        {sub.status === 'exempt' && '🟣 معفاة'}
                      </span>
                    </td>

                    <td className="p-4 text-stone-600 dark:text-stone-300">
                      {sub.paymentMethod === 'bank_transfer' ? 'تحويل بنكي' : sub.paymentMethod === 'pos' ? 'شبكة / مدى' : sub.paymentMethod === 'cash' ? 'نقدي' : '—'}
                    </td>

                    <td className="p-4">
                      {sub.receiptNumber ? (
                        <span className="font-mono text-[11px] font-bold text-stone-700 dark:text-stone-300 block">
                          #{sub.receiptNumber}
                        </span>
                      ) : (
                        <span className="text-stone-400 text-[11px] block">—</span>
                      )}
                      <span className="text-[10px] text-stone-400 font-mono">{sub.paymentDate || 'لم يسجل'}</span>
                    </td>

                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Record / Edit Payment */}
                        <button
                          onClick={() => handleOpenEditPayment(sub)}
                          className="p-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-[#FAF0F3] hover:text-[#8E5364] transition cursor-pointer"
                          title="تعديل الدفعة والبيانات"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>

                        {/* View / Print Receipt */}
                        {sub.paidAmount > 0 && (
                          <button
                            onClick={() => handleViewReceipt(sub)}
                            className="p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition cursor-pointer"
                            title="عرض سند القبض المعتمد"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Delete */}
                        {isLeader && (
                          <button
                            onClick={() => {
                              if (window.confirm('هل أنتِ متأكدة من حذف هذا السجل المالي؟')) {
                                deleteSubscription(sub.id);
                              }
                            }}
                            className="p-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition cursor-pointer"
                            title="حذف السجل"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredSubscriptions.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-stone-400">
                    <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="font-bold">لا توجد سجلات اشتراك مطابقة للبحث أو الفلتر المختار</p>
                    <button
                      onClick={() => handleOpenNewPayment()}
                      className="mt-3 px-4 py-2 bg-[#8E5364] text-white rounded-xl text-xs font-bold cursor-pointer"
                    >
                      تسجيل دفعة جديدة الآن
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment / Subscription Modal */}
      {paymentModalOpen && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#16161A] rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 dark:border-stone-800 max-h-[92vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <h3 className="font-bold text-stone-900 dark:text-stone-100 text-base flex items-center gap-2">
                <span>💳</span>
                <span>{editingSub ? 'تعديل سجل الاشتراك المالي' : 'تسجيل اشتراك / دفعة مالية جديدة'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="space-y-4 text-xs">
              
              {/* Select Student */}
              <div>
                <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                  اختيار الطالبة:
                </label>
                <select
                  required
                  value={form.studentId}
                  onChange={e => {
                    const st = students.find(s => s.id === e.target.value);
                    const tr = tracks.find(t => t.id === st?.trackId);
                    setForm({
                      ...form,
                      studentId: e.target.value,
                      trackId: st?.trackId || form.trackId,
                      requiredAmount: tr?.subscriptionFee?.amount ?? form.requiredAmount
                    });
                  }}
                  className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-900 font-bold"
                >
                  <option value="" disabled>اختاري الطالبة المسجلة...</option>
                  {students.map(st => {
                    const tr = tracks.find(t => t.id === st.trackId);
                    const cr = circles.find(c => c.id === st.circleId);
                    return (
                      <option key={st.id} value={st.id}>
                        {st.name} ({st.code}) — {tr?.name} • {cr?.name}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Cycle Month */}
              <div>
                <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                  الدورة الشهرية / الفصل:
                </label>
                <input
                  type="text"
                  required
                  value={form.cycleMonth}
                  onChange={e => setForm({ ...form, cycleMonth: e.target.value })}
                  placeholder="مثال: ربيع الآخر - جمادى الأولى 1446"
                  className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-900 font-bold"
                />
              </div>

              {/* Required & Paid Amount */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    المبلغ المطلوب (ر.س):
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={form.requiredAmount}
                    onChange={e => setForm({ ...form, requiredAmount: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-900 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    المبلغ المدفوع (ر.س):
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={form.paidAmount}
                    onChange={e => {
                      const p = Number(e.target.value);
                      let newStatus: PaymentStatus = 'pending';
                      if (form.status === 'exempt') {
                        newStatus = 'exempt';
                      } else if (p >= form.requiredAmount && form.requiredAmount > 0) {
                        newStatus = 'paid';
                      } else if (p > 0) {
                        newStatus = 'partial';
                      }
                      setForm({ ...form, paidAmount: p, status: newStatus });
                    }}
                    className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-900 font-bold text-emerald-700 dark:text-emerald-400"
                  />
                </div>
              </div>

              {/* Status & Method */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    حالة السداد:
                  </label>
                  <select
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value as PaymentStatus })}
                    className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-900 font-bold"
                  >
                    <option value="paid">✅ مدفوع بالكامل</option>
                    <option value="partial">🟡 سداد جزئي</option>
                    <option value="pending">🔴 معلق لم يسدد</option>
                    <option value="exempt">🟣 معفاة بقرار الإدارة</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    طريقة الدفع:
                  </label>
                  <select
                    value={form.paymentMethod}
                    onChange={e => setForm({ ...form, paymentMethod: e.target.value as PaymentMethod })}
                    className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-900 font-bold"
                  >
                    <option value="bank_transfer">تحويل بنكي</option>
                    <option value="pos">شبكة / مدى</option>
                    <option value="cash">نقدي</option>
                    <option value="other">أخرى</option>
                  </select>
                </div>
              </div>

              {/* Receipt Number & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    رقم الإيصال / الحوالة:
                  </label>
                  <input
                    type="text"
                    value={form.receiptNumber}
                    onChange={e => setForm({ ...form, receiptNumber: e.target.value })}
                    placeholder="TRX-12345"
                    className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-900 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    تاريخ السداد:
                  </label>
                  <input
                    type="date"
                    value={form.paymentDate}
                    onChange={e => setForm({ ...form, paymentDate: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-900 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                  ملاحظات السداد أو الإعفاء:
                </label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="ملاحظات الحوالة البنكية أو سبب الإعفاء..."
                  className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-900"
                />
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-stone-100 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="px-4 py-2 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl font-bold shadow-xs cursor-pointer"
                >
                  حفظ الدفعة والاعتماد
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Official Receipt Modal */}
      {receiptModalOpen && selectedSubForReceipt && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-stone-200 space-y-5 text-stone-900">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-stone-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#FAF0F3] border border-[#E8D5D8] flex items-center justify-center text-2xl text-[#8E5364]">
                  📖
                </div>
                <div>
                  <h3 className="font-bold font-quran text-base text-stone-900">
                    {settings.name || 'مقرأة غيث الغيم'}
                  </h3>
                  <span className="text-[11px] text-stone-500 font-medium">سند قبض مالي إلكتروني رسمي</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReceiptModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Receipt Body */}
            {(() => {
              const student = students.find(s => s.id === selectedSubForReceipt.studentId);
              const track = tracks.find(t => t.id === selectedSubForReceipt.trackId);
              const circle = circles.find(c => c.id === student?.circleId);

              return (
                <div className="space-y-4 text-xs">
                  <div className="p-3 bg-[#FAF7F4] rounded-2xl border border-stone-200 text-center">
                    <span className="text-stone-400 block text-[10px]">المبلغ المقبوض</span>
                    <div className="text-2xl font-black text-[#8E5364] mt-0.5">
                      {selectedSubForReceipt.paidAmount} ر.س
                    </div>
                    <span className="text-[10px] text-stone-500 font-mono">
                      رقم الإيصال: #{selectedSubForReceipt.receiptNumber || 'غير محدد'}
                    </span>
                  </div>

                  <div className="space-y-2 divide-y divide-stone-100">
                    <div className="flex justify-between py-1.5">
                      <span className="text-stone-500">اسم الطالبة:</span>
                      <strong className="text-stone-900">{student?.name}</strong>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-stone-500">كود الطالبة:</span>
                      <strong className="font-mono">{student?.code}</strong>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-stone-500">المسار القرآني:</span>
                      <strong>{track?.name}</strong>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-stone-500">الحلقة:</span>
                      <strong>{circle?.name}</strong>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-stone-500">الدورة الشهرية:</span>
                      <strong>{selectedSubForReceipt.cycleMonth}</strong>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-stone-500">طريقة السداد:</span>
                      <strong>
                        {selectedSubForReceipt.paymentMethod === 'bank_transfer'
                          ? 'تحويل بنكي'
                          : selectedSubForReceipt.paymentMethod === 'pos'
                          ? 'شبكة / مدى'
                          : 'نقدي'}
                      </strong>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-stone-500">تاريخ السداد:</span>
                      <strong className="font-mono">{selectedSubForReceipt.paymentDate}</strong>
                    </div>
                  </div>

                  {/* Seal Stamp */}
                  <div className="pt-2 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-stone-400">اعتماد إدارة المقرأة:</div>
                      <div className="font-bold text-xs text-stone-800">{settings.leaderName || 'ريفة المنصوري'}</div>
                    </div>
                    <OfficialSeal size="sm" />
                  </div>
                </div>
              );
            })()}

            {/* Print action */}
            <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-stone-100 text-stone-700 hover:bg-stone-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>طباعة السند</span>
              </button>
              <button
                type="button"
                onClick={() => setReceiptModalOpen(false)}
                className="px-5 py-2 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

// Small Percent Icon helper
const PercentBadge: React.FC = () => (
  <span className="font-mono font-bold text-xs">%</span>
);
