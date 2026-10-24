import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Users, Search, Filter, Plus, Edit, Archive, HeartHandshake,
  UserCheck, Shield, Phone, Mail, Award, ArrowUpDown, ChevronLeft,
  Calendar, CheckCircle2, AlertCircle
} from 'lucide-react';
import { StudentStatus } from '../types';

interface StudentsViewProps {
  onSelectStudent: (studentId: string) => void;
  onOpenQuickModal: (type: string) => void;
}

export const StudentsView: React.FC<StudentsViewProps> = ({
  onSelectStudent,
  onOpenQuickModal
}) => {
  const {
    students, circles, tracks, allStudentScores,
    createStudent, updateStudent, archiveStudent, assignPartner,
    currentUser, quickModalAction, clearQuickModal, settings
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCircleId, setSelectedCircleId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'score' | 'code'>('score');

  // Modals state
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [partnerModalOpen, setPartnerModalOpen] = useState(false);
  const [selectedStudentForPartner, setSelectedStudentForPartner] = useState<any>(null);
  const [targetPartnerId, setTargetPartnerId] = useState<string>('');

  // Form state
  const [studentForm, setStudentForm] = useState({
    name: '',
    code: '',
    phone: '',
    email: '',
    circleId: '',
    status: 'active' as StudentStatus,
    notes: '',
    joinDate: new Date().toISOString().split('T')[0]
  });

  // Automatically open modal when quickModalAction is triggered
  React.useEffect(() => {
    if (quickModalAction?.type === 'student') {
      handleOpenStudentModal();
      clearQuickModal();
    }
  }, [quickModalAction]);

  // Filtered & sorted students
  const filteredStudents = students.filter(st => {
    if (selectedCircleId !== 'all' && st.circleId !== selectedCircleId) return false;
    if (selectedStatus !== 'all' && st.status !== selectedStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = st.name.toLowerCase().includes(q);
      const matchCode = st.code.toLowerCase().includes(q);
      const matchPhone = st.phone?.includes(q);
      if (!matchName && !matchCode && !matchPhone) return false;
    }
    return true;
  }).sort((a, b) => {
    if (sortBy === 'score') {
      const scoreA = allStudentScores[a.id]?.finalPercentage || 0;
      const scoreB = allStudentScores[b.id]?.finalPercentage || 0;
      return scoreB - scoreA;
    }
    if (sortBy === 'name') return a.name.localeCompare(b.name, 'ar');
    return a.code.localeCompare(b.code);
  });

  const handleOpenStudentModal = (student?: any) => {
    if (student) {
      setEditingStudent(student);
      setStudentForm({
        name: student.name,
        code: student.code,
        phone: student.phone || '',
        email: student.email || '',
        circleId: student.circleId,
        status: student.status,
        notes: student.notes || '',
        joinDate: student.joinDate || new Date().toISOString().split('T')[0]
      });
    } else {
      setEditingStudent(null);
      setStudentForm({
        name: '',
        code: `GH-${Math.floor(100 + Math.random() * 900)}`,
        phone: '05',
        email: '',
        circleId: circles[0]?.id || '',
        status: 'active',
        notes: '',
        joinDate: new Date().toISOString().split('T')[0]
      });
    }
    setStudentModalOpen(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentForm.name.trim()) return;
    const circle = circles.find(c => c.id === studentForm.circleId);
    const trackId = circle?.trackId || tracks[0]?.id;

    const payload = {
      ...studentForm,
      trackId
    };

    if (editingStudent) {
      await updateStudent(editingStudent.id, payload);
    } else {
      await createStudent(payload);
    }
    setStudentModalOpen(false);
  };

  const handleOpenPartnerModal = (student: any) => {
    setSelectedStudentForPartner(student);
    setTargetPartnerId(student.partnerStudentId || '');
    setPartnerModalOpen(true);
  };

  const handleSavePartner = async () => {
    if (!selectedStudentForPartner || !targetPartnerId) return;
    await assignPartner(selectedStudentForPartner.id, targetPartnerId);
    setPartnerModalOpen(false);
  };

  return (
    <div className="space-y-6">

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-[#E8DFD8] shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">👥</span>
            <h2 className="text-xl font-bold text-stone-900 font-quran">شؤون وسجلات الطالبات</h2>
          </div>
          <p className="text-xs text-stone-500">
            ملفات الطالبات، ربط الرفيقات للمراجعة الثنائية، متابعة الحفظ والنسب المئوية التراكمية
          </p>
        </div>

        <button
          onClick={() => handleOpenStudentModal()}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>تسجيل طالبة جديدة</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-3xl border border-[#E8DFD8] shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="ابحثي بالاسم أو الكود أو الجوال..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-9 py-2 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-[#8E5364]"
            />
            <Search className="w-4 h-4 text-stone-400 absolute right-3 top-2.5 pointer-events-none" />
          </div>

          {/* Circle filter */}
          <div>
            <select
              value={selectedCircleId}
              onChange={e => setSelectedCircleId(e.target.value)}
              className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-[#8E5364]"
            >
              <option value="all">جميع الحلقات ({circles.length})</option>
              {circles.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-[#8E5364]"
            >
              <option value="all">جميع الحالات</option>
              <option value="active">نشطة (منتظمة)</option>
              <option value="suspended">موقوفة مؤقتاً</option>
              <option value="withdrawn">منسحبة</option>
              <option value="archived">مؤرشفة</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-[#8E5364]"
            >
              <option value="score">ترتيب بحسب النسبة والدرجات (الأعلى أولاً)</option>
              <option value="name">ترتيب أبجدي بالاسم</option>
              <option value="code">ترتيب بحسب كود الطالبة</option>
            </select>
          </div>

        </div>

        {/* Counter Summary */}
        <div className="flex items-center justify-between text-xs text-stone-500 pt-1 border-t border-stone-100">
          <span>يتم عرض {filteredStudents.length} من أصل {students.length} طالبة</span>
          <span className="font-semibold text-[#8E5364]">
            {filteredStudents.filter(s => s.partnerStudentId).length} طالبة لديها رفيقة معينة 🤝
          </span>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-3xl border border-[#E8DFD8] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-[#FAF6F2] text-stone-600 font-bold border-b border-stone-200">
                <th className="p-3.5">الكود</th>
                <th className="p-3.5">اسم الطالبة</th>
                <th className="p-3.5">الحلقة والمعلمة</th>
                <th className="p-3.5">الرفيقة (المراجعة الثنائية)</th>
                <th className="p-3.5">إنجاز الحفظ</th>
                <th className="p-3.5">الحضور</th>
                <th className="p-3.5">النسبة المئوية</th>
                <th className="p-3.5">التقدير والترتيب</th>
                <th className="p-3.5">الحالة</th>
                <th className="p-3.5 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredStudents.map((student) => {
                const score = allStudentScores[student.id];
                const circle = circles.find(c => c.id === student.circleId);

                return (
                  <tr key={student.id} className="hover:bg-[#FCF9FA] transition group">
                    <td className="p-3.5 font-mono text-[11px] font-bold text-stone-500">
                      {student.code}
                    </td>

                    <td className="p-3.5">
                      <div className="font-bold text-stone-900 text-sm group-hover:text-[#8E5364] transition">
                        {student.name}
                      </div>
                      <div className="text-[11px] text-stone-400">
                        {student.phone}
                      </div>
                    </td>

                    <td className="p-3.5">
                      <div className="font-semibold text-stone-800">{circle?.name || 'غير محدد'}</div>
                      <div className="text-[11px] text-stone-400">أ. {circle?.teacherName}</div>
                    </td>

                    <td className="p-3.5">
                      {student.partnerStudentName ? (
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 bg-[#F5ECE8] text-[#7A4B37] px-2.5 py-1 rounded-full text-[11px] font-medium">
                            <span>🤝</span>
                            <span>{student.partnerStudentName}</span>
                          </span>
                          <button
                            onClick={() => handleOpenPartnerModal(student)}
                            className="text-stone-400 hover:text-stone-700 p-1"
                            title="تغيير الرفيقة"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleOpenPartnerModal(student)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-stone-100 hover:bg-[#F5ECE8] text-stone-600 hover:text-[#7A4B37] text-[11px] font-medium transition"
                        >
                          <HeartHandshake className="w-3.5 h-3.5" />
                          <span>تعيين رفيقة</span>
                        </button>
                      )}
                    </td>

                    <td className="p-3.5">
                      <div className="font-semibold text-stone-800">
                        {score?.newMemorizationPagesDone} / {score?.newMemorizationPagesTarget} ص
                      </div>
                      <div className="text-[10px] text-stone-400">
                        مراجعة: {score?.revisionPagesDone} ص
                      </div>
                    </td>

                    <td className="p-3.5">
                      <div className="font-bold text-[#2D5A43]">{score?.attendanceRate}%</div>
                      <div className="text-[10px] text-stone-400">
                        {score?.earlyPrepCount} مبكر ⭐
                      </div>
                    </td>

                    <td className="p-3.5">
                      <div className="font-extrabold text-stone-900 text-sm">
                        {score?.finalPercentage}%
                      </div>
                      <div className="text-[10px] text-stone-400">
                        {score?.totalEarnedPoints} / {score?.totalPossiblePoints} نقطة
                      </div>
                    </td>

                    <td className="p-3.5">
                      <span
                        className="px-2.5 py-1 rounded-full text-[11px] font-bold text-white inline-block shadow-2xs"
                        style={{ backgroundColor: score?.gradeColor || '#2D5A43' }}
                      >
                        {score?.gradeLabel}
                      </span>
                      <div className="text-[10px] text-stone-400 mt-0.5">
                        الترتيب: #{score?.rankInCircle} في الحلقة
                      </div>
                    </td>

                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                        student.status === 'active'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : student.status === 'suspended'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}>
                        {student.status === 'active' ? 'نشطة' : student.status === 'suspended' ? 'موقوفة' : 'منسحبة'}
                      </span>
                    </td>

                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onSelectStudent(student.id)}
                          className="px-2.5 py-1 bg-[#8E5364] hover:bg-[#744251] text-white rounded-lg text-[11px] font-bold transition shadow-2xs"
                          title="عرض ملف الإنجاز والشهادة"
                        >
                          ملف الإنجاز
                        </button>
                        <button
                          onClick={() => handleOpenStudentModal(student)}
                          className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100"
                          title="تعديل بيانات الطالبة"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        {currentUser?.role === 'leader' && (
                          <button
                            onClick={() => archiveStudent(student.id)}
                            className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-stone-100"
                            title="أرشفة سجل الطالبة"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Student Modal */}
      {studentModalOpen && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-xl border border-stone-200 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-stone-900 text-base font-quran mb-3">
              {editingStudent ? 'تعديل بيانات الطالبة' : 'تسجيل طالبة جديدة في المقرأة'}
            </h3>
            <form onSubmit={handleSaveStudent} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">اسم الطالبة الرباعي</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: منيرة بنت عبد الله الشمري"
                  value={studentForm.name}
                  onChange={e => setStudentForm({ ...studentForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-[#8E5364]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">كود الطالبة</label>
                  <input
                    type="text"
                    required
                    value={studentForm.code}
                    onChange={e => setStudentForm({ ...studentForm, code: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">الحلقة المخصصة</label>
                  <select
                    value={studentForm.circleId}
                    onChange={e => setStudentForm({ ...studentForm, circleId: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-[#8E5364]"
                  >
                    {circles.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.teacherName})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">رقم الجوال للتواصل</label>
                  <input
                    type="tel"
                    placeholder="05xxxxxxxx"
                    value={studentForm.phone}
                    onChange={e => setStudentForm({ ...studentForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">حالة القيد</label>
                  <select
                    value={studentForm.status}
                    onChange={e => setStudentForm({ ...studentForm, status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white"
                  >
                    <option value="active">نشطة (منتظمة)</option>
                    <option value="suspended">موقوفة مؤقتاً</option>
                    <option value="withdrawn">منسحبة</option>
                    <option value="archived">مؤرشفة</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">ملاحظات المعلمة والمشرفة</label>
                <textarea
                  rows={2}
                  placeholder="مستوى المحفوظ، الالتزام، التوجيهات الخاصة..."
                  value={studentForm.notes}
                  onChange={e => setStudentForm({ ...studentForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-100 mt-2">
                <button
                  type="button"
                  onClick={() => setStudentModalOpen(false)}
                  className="px-4 py-2.5 text-stone-600 text-xs font-bold rounded-xl hover:bg-stone-100 transition active:scale-95 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  style={{ backgroundColor: settings.primaryColor || '#8E5364' }}
                  className="px-6 py-2.5 text-white text-xs font-bold rounded-xl shadow-xs transition hover:brightness-105 active:scale-95 cursor-pointer touch-manipulation"
                >
                  حفظ السجل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Partner Assignment Modal */}
      {partnerModalOpen && selectedStudentForPartner && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-stone-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">🤝</span>
              <div>
                <h3 className="font-bold text-stone-900 text-base font-quran">
                  تعيين الرفيقة القرآنية
                </h3>
                <p className="text-xs text-stone-500">
                  للطالبة: <strong>{selectedStudentForPartner.name}</strong>
                </p>
              </div>
            </div>

            <p className="text-xs text-stone-600 mb-4 leading-relaxed bg-[#FAF6F2] p-3 rounded-2xl border border-[#EFE8E2]">
              يتم ربط الطالبة برفيقتها للتعاون في <strong>تحدي الخميس</strong>، والمراجعة الثنائية المتبادلة، واكتشاف الأخطاء، وحفظ السجلات المشتركة.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">اختاري الرفيقة من الحلقة:</label>
                <select
                  value={targetPartnerId}
                  onChange={e => setTargetPartnerId(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-[#8E5364]"
                >
                  <option value="">-- اختاري طالبة --</option>
                  {students
                    .filter(s => s.id !== selectedStudentForPartner.id && s.circleId === selectedStudentForPartner.circleId)
                    .map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code}) {s.partnerStudentId ? `[رفيقتها حالياً: ${s.partnerStudentName}]` : '[متاحة]'}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setPartnerModalOpen(false)}
                  className="px-4 py-2.5 text-stone-600 text-xs font-bold rounded-xl hover:bg-stone-100 transition active:scale-95 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSavePartner}
                  disabled={!targetPartnerId}
                  style={{ backgroundColor: settings.primaryColor || '#8E5364' }}
                  className="px-6 py-2.5 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition hover:brightness-105 active:scale-95 cursor-pointer touch-manipulation"
                >
                  تأكيد تعيين الرفيقة
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
