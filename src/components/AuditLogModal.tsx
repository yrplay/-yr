import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  History, X, Search, Filter, Download, UserCheck, Shield,
  Calendar, Clock, CheckCircle2, AlertCircle, FileText
} from 'lucide-react';
import { AuditLog } from '../types';

interface AuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuditLogModal: React.FC<AuditLogModalProps> = ({ isOpen, onClose }) => {
  const { auditLogs, settings } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [selectedTarget, setSelectedTarget] = useState<string>('all');

  const filteredLogs = useMemo(() => {
    return (auditLogs || []).filter(log => {
      const matchSearch =
        !searchQuery.trim() ||
        log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.targetId && log.targetId.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchAction = selectedAction === 'all' || log.action === selectedAction;
      const matchTarget = selectedTarget === 'all' || log.targetType === selectedTarget;

      return matchSearch && matchAction && matchTarget;
    });
  }, [auditLogs, searchQuery, selectedAction, selectedTarget]);

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
        return { label: 'أرشفة', bg: 'bg-stone-100 text-stone-700 border-stone-200' };
      case 'delete':
        return { label: 'حذف', bg: 'bg-rose-50 text-rose-800 border-rose-200' };
      case 'login':
        return { label: 'تسجيل دخول', bg: 'bg-purple-50 text-purple-800 border-purple-200' };
      default:
        return { label: action, bg: 'bg-stone-50 text-stone-700 border-stone-200' };
    }
  };

  const getTargetLabel = (target: string) => {
    const map: Record<string, string> = {
      student: 'طالبة',
      circle: 'حلقة',
      track: 'مسار',
      monthlyPlan: 'خطة شهرية',
      studentPlan: 'مقرر طالبة',
      dailyRecord: 'تسميع يومي',
      attendance: 'حضور',
      atqini: 'واجب تجويد',
      atqiniSubmission: 'تقييم تجويد',
      challenge: 'تحدي قرآني',
      exam: 'اختبار شهري',
      gradingConfig: 'نظام الدرجات',
      settings: 'إعدادات المنصة',
      auth: 'المستخدمين'
    };
    return map[target] || target;
  };

  const handleDownloadLogJson = () => {
    const jsonStr = JSON.stringify(auditLogs, null, 2);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-4xl w-full h-[90vh] flex flex-col shadow-2xl border border-stone-200 overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-[#E8DFD8] bg-[#FCFAF8] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl text-white flex items-center justify-center shadow-xs"
              style={{ backgroundColor: settings.primaryColor || '#8E5364' }}
            >
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-base sm:text-lg font-quran flex items-center gap-2">
                <span>سجل التعديلات والعمليات الإدارية</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#FAF2F4] text-[#8E5364] border border-[#E8D5D8] font-sans font-bold">
                  {filteredLogs.length} عملية موثقة
                </span>
              </h3>
              <p className="text-xs text-stone-500">
                توثيق كامل لكافة التعديلات، إدخالات التسميع، والدرجات مع أسماء المنفذين والتوقيت الدقيق
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadLogJson}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
              title="تصدير السجل كملف JSON"
            >
              <Download className="w-3.5 h-3.5 text-[#8E5364]" />
              <span>تصدير السجل</span>
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

        {/* Filters & Search Toolbar */}
        <div className="p-4 border-b border-stone-100 bg-white flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-stone-400 absolute right-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="البحث باسم المعلمة، تفاصيل التعديل، أو المعرف..."
              className="w-full pr-9 pl-3 py-2 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-[#8E5364] bg-stone-50/50"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter by Action */}
            <div className="flex items-center gap-1.5">
              <span className="text-stone-500 font-medium">العملية:</span>
              <select
                value={selectedAction}
                onChange={e => setSelectedAction(e.target.value)}
                className="px-2.5 py-1.5 border border-stone-200 rounded-xl bg-white text-xs font-medium cursor-pointer"
              >
                <option value="all">كافة العمليات</option>
                <option value="create">إضافة جديدة</option>
                <option value="update">تعديل</option>
                <option value="grade">رصد درجات</option>
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
                <option value="monthlyPlan">الخطط الشهرية</option>
                <option value="circle">الحلقات</option>
                <option value="track">المسارات</option>
                <option value="gradingConfig">نظام الدرجات</option>
                <option value="settings">الإعدادات</option>
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
                    <th className="p-3">التوقيت والتاريخ</th>
                    <th className="p-3">المستخدم والمنصب</th>
                    <th className="p-3 text-center">نوع العملية</th>
                    <th className="p-3">القسم</th>
                    <th className="p-3">تفاصيل التعديل أو الرصد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredLogs.map(log => {
                    const badge = getActionBadge(log.action);
                    const formattedDate = new Date(log.timestamp).toLocaleDateString('ar-SA', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    });
                    const formattedTime = new Date(log.timestamp).toLocaleTimeString('ar-SA', {
                      hour: '2-digit',
                      minute: '2-digit'
                    });

                    return (
                      <tr key={log.id} className="hover:bg-[#FCF9FA] transition">
                        <td className="p-3 font-mono text-[11px] text-stone-500 whitespace-nowrap">
                          <div className="font-semibold text-stone-800">{formattedDate}</div>
                          <div className="text-stone-400 text-[10px]">{formattedTime}</div>
                        </td>

                        <td className="p-3 whitespace-nowrap">
                          <div className="font-bold text-stone-900">{log.userName}</div>
                          <span className={`inline-block text-[10px] px-1.5 py-0.2 rounded font-medium ${
                            log.userRole === 'leader'
                              ? 'bg-rose-100 text-rose-800'
                              : log.userRole === 'supervisor'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {log.userRole === 'leader' ? 'قائدة' : log.userRole === 'supervisor' ? 'مشرفة' : 'معلمة'}
                          </span>
                        </td>

                        <td className="p-3 text-center whitespace-nowrap">
                          <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold ${badge.bg}`}>
                            {badge.label}
                          </span>
                        </td>

                        <td className="p-3 whitespace-nowrap text-stone-600 font-medium">
                          {getTargetLabel(log.targetType)}
                        </td>

                        <td className="p-3 text-stone-800 font-medium leading-relaxed">
                          {log.details}
                        </td>
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
              <p className="text-xs text-stone-400">جربي تغيير الكلمات المفتاحية أو تصفية نوع العملية</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#E8DFD8] bg-[#FCFAF8] flex items-center justify-between text-xs">
          <span className="text-stone-500">
            يتم تسجيل كافة العمليات الإدارية تلقائياً لضمان الشفافية والرقابة المعتمدة لمقرأة {settings.name || 'غيث الغيم'}.
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
