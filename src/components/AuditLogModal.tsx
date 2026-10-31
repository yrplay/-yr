import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  History, X, Search, Download, FileText, Trash2, RotateCcw
} from 'lucide-react';
import { isTechnicalDeveloper } from '../types';

interface AuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuditLogModal: React.FC<AuditLogModalProps> = ({ isOpen, onClose }) => {
  const { auditLogs, settings, currentUser, deleteAuditLog, clearAuditLogs } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [selectedTarget, setSelectedTarget] = useState<string>('all');
  const [confirmClear, setConfirmClear] = useState(false);

  const canManageAuditLogs =
    currentUser?.role === 'developer' ||
    isTechnicalDeveloper(currentUser) ||
    currentUser?.role === 'owner';

  const getTargetLabel = (target: string) => {
    const map: Record<string, string> = {
      student: 'شؤون الطالبات',
      circle: 'الحلقات القرآنية',
      track: 'المسارات المعتمدة',
      monthlyPlan: 'الخطط الشهرية',
      studentPlan: 'مقررات الطالبات',
      dailyRecord: 'سجل التسميع والحفظ',
      attendance: 'الحضور والتحضير',
      atqini: 'واجبات التجويد (أتقني)',
      atqiniSubmission: 'تقييم واجبات أتقني',
      challenge: 'التحديات والمراجعة الثنائية',
      exam: 'الاختبارات الشهرية',
      subscription: 'الاشتراكات والمالية',
      gradingConfig: 'نظام الدرجات والمعايير',
      settings: 'إعدادات وهوية المنصة',
      auth: 'الكادر والصلاحيات والدخول',
      system: 'النظام العام'
    };
    return map[target] || target || 'عام';
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'developer':
        return { label: 'المطور التقني', cls: 'bg-violet-100 text-violet-800 border border-violet-200' };
      case 'owner':
        return { label: 'مالك المنصة', cls: 'bg-amber-100 text-amber-900 border border-amber-200' };
      case 'leader':
        return { label: 'قائدة المقرأة', cls: 'bg-rose-100 text-rose-800 border border-rose-200' };
      case 'supervisor':
        return { label: 'مشرفة', cls: 'bg-sky-100 text-sky-800 border border-sky-200' };
      default:
        return { label: 'معلمة', cls: 'bg-emerald-100 text-emerald-800 border border-emerald-200' };
    }
  };

  const filteredLogs = useMemo(() => {
    return (auditLogs || []).filter(log => {
      const targetId = log.entityId || (log as any).targetId || '';
      const action = log.actionType || log.action || '';
      const target = log.entity || (log as any).targetType || '';
      const targetLabel = getTargetLabel(target);

      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        (log.details || '').toLowerCase().includes(q) ||
        (log.userName || '').toLowerCase().includes(q) ||
        targetLabel.toLowerCase().includes(q) ||
        (targetId && targetId.toLowerCase().includes(q));

      const matchAction = selectedAction === 'all' || action === selectedAction;
      const matchTarget =
        selectedTarget === 'all' ||
        target === selectedTarget ||
        (selectedTarget === 'monthlyPlan' && (target === 'monthlyPlan' || target === 'studentPlan')) ||
        (selectedTarget === 'atqini' && (target === 'atqini' || target === 'atqiniSubmission'));

      return matchSearch && matchAction && matchTarget;
    });
  }, [auditLogs, searchQuery, selectedAction, selectedTarget]);

  const stats = useMemo(() => {
    const list = auditLogs || [];
    return {
      total: list.length,
      creates: list.filter(l => (l.actionType || l.action) === 'create').length,
      updates: list.filter(l => (l.actionType || l.action) === 'update').length,
      grades: list.filter(l => (l.actionType || l.action) === 'grade').length,
      deletes: list.filter(l => ['delete', 'archive'].includes(l.actionType || l.action || '')).length,
      logins: list.filter(l => (l.actionType || l.action) === 'login').length
    };
  }, [auditLogs]);

  if (!isOpen) return null;

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'create':
        return { label: 'إضافة جديدة', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
      case 'update':
        return { label: 'تعديل بيانات', bg: 'bg-blue-50 text-blue-800 border-blue-200' };
      case 'grade':
        return { label: 'رصد تقييم', bg: 'bg-[#FAF2F4] text-[#8E5364] border-[#E8D5D8]' };
      case 'archive':
        return { label: 'أرشفة', bg: 'bg-amber-50 text-amber-800 border-amber-200' };
      case 'delete':
        return { label: 'حذف', bg: 'bg-rose-50 text-rose-800 border-rose-200' };
      case 'login':
        return { label: 'تسجيل دخول', bg: 'bg-purple-50 text-purple-800 border-purple-200' };
      default:
        return { label: action || 'عملية', bg: 'bg-stone-50 text-stone-700 border-stone-200' };
    }
  };

  const handleDownloadLogJson = () => {
    const jsonStr = JSON.stringify(filteredLogs, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Ghaym_Audit_Log_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs" dir="rtl">
      <div className="bg-white rounded-3xl max-w-5xl w-full h-[90vh] flex flex-col shadow-2xl border border-stone-200 overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-[#E8DFD8] bg-[#FCFAF8] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl text-white flex items-center justify-center shadow-xs shrink-0"
              style={{ backgroundColor: settings.primaryColor || '#8E5364' }}
            >
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-base sm:text-lg font-quran flex items-center gap-2 flex-wrap">
                <span>سجل التعديلات والعمليات الإدارية</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#FAF2F4] text-[#8E5364] border border-[#E8D5D8] font-sans font-bold">
                  {filteredLogs.length} عملية موثقة
                </span>
              </h3>
              <p className="text-xs text-stone-500">
                توثيق فوري لكافة الإضافات، التعديلات، رصد التسميع والدرجات، الحضور، وإدارة الكادر بالتوقيت الدقيق
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canManageAuditLogs && auditLogs.length > 1 && (
              confirmClear ? (
                <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-xl">
                  <span className="text-[11px] font-bold text-rose-800">تأكيد تصفير السجل؟</span>
                  <button
                    type="button"
                    onClick={async () => {
                      await clearAuditLogs();
                      setConfirmClear(false);
                    }}
                    className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold cursor-pointer"
                  >
                    نعم، تصفير
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="px-2 py-1 bg-white text-stone-600 rounded-lg text-[11px] font-bold border border-stone-200 cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition cursor-pointer"
                  title="تنظيف وتصفير السجل السابق"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>تصفير السجل</span>
                </button>
              )
            )}

            <button
              type="button"
              onClick={handleDownloadLogJson}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
              title="تصدير السجل كملف JSON"
            >
              <Download className="w-3.5 h-3.5 text-[#8E5364]" />
              <span className="hidden sm:inline">تصدير السجل</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Summary KPI Strip */}
        <div className="px-4 py-2.5 bg-[#FAF7F5] border-b border-stone-100 flex flex-wrap items-center gap-2 text-[11px]">
          <button
            type="button"
            onClick={() => setSelectedAction('all')}
            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer border ${
              selectedAction === 'all' ? 'bg-[#8E5364] text-white border-[#8E5364]' : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
            }`}
          >
            الكل ({stats.total})
          </button>
          <button
            type="button"
            onClick={() => setSelectedAction('create')}
            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer border ${
              selectedAction === 'create' ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            إضافات ({stats.creates})
          </button>
          <button
            type="button"
            onClick={() => setSelectedAction('update')}
            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer border ${
              selectedAction === 'update' ? 'bg-blue-700 text-white border-blue-700' : 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
            }`}
          >
            تعديلات وحضور ({stats.updates})
          </button>
          <button
            type="button"
            onClick={() => setSelectedAction('grade')}
            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer border ${
              selectedAction === 'grade' ? 'bg-[#8E5364] text-white border-[#8E5364]' : 'bg-[#FAF2F4] text-[#8E5364] border-[#E8D5D8] hover:bg-[#F3E4E8]'
            }`}
          >
            رصد تسميع وتقييم ({stats.grades})
          </button>
          <button
            type="button"
            onClick={() => setSelectedAction('login')}
            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer border ${
              selectedAction === 'login' ? 'bg-purple-700 text-white border-purple-700' : 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100'
            }`}
          >
            عمليات دخول ({stats.logins})
          </button>
          {stats.deletes > 0 && (
            <button
              type="button"
              onClick={() => setSelectedAction('delete')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer border ${
                selectedAction === 'delete' ? 'bg-rose-700 text-white border-rose-700' : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
              }`}
            >
              حذف / أرشفة ({stats.deletes})
            </button>
          )}
        </div>

        {/* Filters & Search Toolbar */}
        <div className="p-4 border-b border-stone-100 bg-white flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-stone-400 absolute right-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="البحث باسم المنفذ، تفاصيل العملية، اسم الطالبة، أو القسم..."
              className="w-full pr-9 pl-3 py-2 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-[#8E5364] bg-stone-50/50"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter by Action */}
            <div className="flex items-center gap-1.5">
              <span className="text-stone-500 font-medium">نوع العملية:</span>
              <select
                value={selectedAction}
                onChange={e => setSelectedAction(e.target.value)}
                className="px-2.5 py-1.5 border border-stone-200 rounded-xl bg-white text-xs font-medium cursor-pointer"
              >
                <option value="all">كافة العمليات</option>
                <option value="create">إضافة جديدة</option>
                <option value="update">تعديل بيانات / حضور</option>
                <option value="grade">رصد درجات وتقييم</option>
                <option value="archive">أرشفة</option>
                <option value="delete">حذف</option>
                <option value="login">تسجيل دخول</option>
              </select>
            </div>

            {/* Filter by Target */}
            <div className="flex items-center gap-1.5">
              <span className="text-stone-500 font-medium">القسم:</span>
              <select
                value={selectedTarget}
                onChange={e => setSelectedTarget(e.target.value)}
                className="px-2.5 py-1.5 border border-stone-200 rounded-xl bg-white text-xs font-medium cursor-pointer"
              >
                <option value="all">كافة الأقسام</option>
                <option value="student">شؤون الطالبات</option>
                <option value="dailyRecord">سجل التسميع والحفظ</option>
                <option value="attendance">الحضور والتحضير</option>
                <option value="monthlyPlan">الخطط والمقررات الشهرية</option>
                <option value="circle">الحلقات القرآنية</option>
                <option value="track">المسارات المعتمدة</option>
                <option value="atqini">واجبات وتقييم «أتقني»</option>
                <option value="challenge">التحديات والمراجعة الثنائية</option>
                <option value="exam">الاختبارات الشهرية</option>
                <option value="subscription">الاشتراكات والمالية</option>
                <option value="gradingConfig">نظام الدرجات والمعايير</option>
                <option value="auth">الكادر والصلاحيات والدخول</option>
                <option value="settings">الإعدادات والهوية</option>
              </select>
            </div>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredLogs.length > 0 ? (
            <div className="rounded-2xl border border-stone-200 overflow-hidden shadow-2xs">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-[#FAF6F2] text-stone-600 font-bold border-b border-stone-200">
                    <th className="p-3">التاريخ والتوقيت</th>
                    <th className="p-3">المنفّذ والمنصب</th>
                    <th className="p-3 text-center">نوع العملية</th>
                    <th className="p-3">القسم</th>
                    <th className="p-3">تفاصيل العملية أو التعديل</th>
                    {canManageAuditLogs && <th className="p-3 text-center w-14">إجراء</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredLogs.map(log => {
                    const action = log.actionType || log.action || '';
                    const entity = log.entity || (log as any).targetType || '';
                    const badge = getActionBadge(action);
                    const roleBadge = getRoleBadge(log.userRole);
                    const dateObj = new Date(log.timestamp);
                    const isValidDate = !isNaN(dateObj.getTime());
                    const formattedDate = isValidDate
                      ? dateObj.toLocaleDateString('ar-SA', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })
                      : '—';
                    const formattedTime = isValidDate
                      ? dateObj.toLocaleTimeString('ar-SA', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })
                      : '';

                    return (
                      <tr key={log.id} className="hover:bg-[#FCF9FA] transition">
                        <td className="p-3 font-mono text-[11px] text-stone-500 whitespace-nowrap">
                          <div className="font-semibold text-stone-800">{formattedDate}</div>
                          <div className="text-stone-400 text-[10px]">{formattedTime}</div>
                        </td>

                        <td className="p-3 whitespace-nowrap">
                          <div className="font-bold text-stone-900 mb-0.5">{log.userName}</div>
                          <span className={`inline-block text-[10px] px-2 py-0.5 rounded-md font-bold ${roleBadge.cls}`}>
                            {roleBadge.label}
                          </span>
                        </td>

                        <td className="p-3 text-center whitespace-nowrap">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${badge.bg}`}>
                            {badge.label}
                          </span>
                        </td>

                        <td className="p-3 whitespace-nowrap text-stone-700 font-bold">
                          {getTargetLabel(entity)}
                        </td>

                        <td className="p-3 text-stone-800 font-medium leading-relaxed">
                          {log.details}
                        </td>

                        {canManageAuditLogs && (
                          <td className="p-3 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => void deleteAuditLog(log.id)}
                              title="حذف هذا السجل"
                              className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-stone-500">
              <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center mb-3">
                <FileText className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-stone-700 text-sm mb-1">لا توجد عمليات مطابقة لخيارات البحث</h4>
              <p className="text-xs text-stone-400">جربي تغيير الكلمات المفتاحية أو تصفية نوع العملية أو القسم</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#E8DFD8] bg-[#FCFAF8] flex items-center justify-between text-xs">
          <span className="text-stone-500">
            يتم توثيق ومزامنة كافة العمليات الإدارية والتعليمية تلقائياً لضمان الشفافية والرقابة المعتمدة لمقرأة {settings.name || 'غيث الغيم'}.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold rounded-xl transition cursor-pointer"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};
