import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  UserCog, Plus, Edit, Shield, CheckCircle2, UserCheck,
  Mail, Phone, Layers, Award, X, Eye, EyeOff, Upload, Trash2, Sparkles, FileSignature
} from 'lucide-react';
import { User, UserRole } from '../types';
import { getIslamicIcon, IslamicIconPicker } from '../components/IslamicIconLibrary';

export const StaffView: React.FC = () => {
  const { users, circles, currentUser, createUser, updateUser, showToast } = useApp();

  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<User | null>(null);

  // Masked PIN state for cards
  const [revealedPins, setRevealedPins] = useState<Record<string, boolean>>({});

  const [staffForm, setStaffForm] = useState({
    name: '',
    role: 'teacher' as UserRole,
    title: 'معلمة حلقة',
    email: '',
    phone: '05',
    passcode: '1234',
    avatarIcon: 'mushaf',
    avatarColor: '#8E5364',
    signatureUrl: '',
    circleIds: [] as string[]
  });

  const togglePinReveal = (userId: string) => {
    setRevealedPins(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  const handleOpenStaffModal = (user?: User) => {
    if (user) {
      setEditingStaff(user);
      setStaffForm({
        name: user.name,
        role: user.role,
        title: user.title,
        email: user.email,
        phone: user.phone || '05',
        passcode: user.passcode || '1234',
        avatarIcon: user.avatarIcon || 'mushaf',
        avatarColor: user.avatarColor || '#8E5364',
        signatureUrl: user.signatureUrl || '',
        circleIds: user.circleIds || []
      });
    } else {
      setEditingStaff(null);
      setStaffForm({
        name: '',
        role: 'teacher',
        title: 'معلمة حلقة قرآنية',
        email: '',
        phone: '05',
        passcode: String(Math.floor(1000 + Math.random() * 9000)),
        avatarIcon: 'mushaf',
        avatarColor: '#8E5364',
        signatureUrl: '',
        circleIds: []
      });
    }
    setStaffModalOpen(true);
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast('حجم ملف التوقيع يجب أن يكون أقل من 2 ميجابايت', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      setStaffForm(prev => ({ ...prev, signatureUrl: dataUrl }));
      showToast('تم رفع صورة التوقيع بنجاح ✍️');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveSignature = () => {
    setStaffForm(prev => ({ ...prev, signatureUrl: '' }));
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffForm.name.trim()) return;

    if (editingStaff) {
      await updateUser(editingStaff.id, staffForm);
    } else {
      await createUser(staffForm);
    }
    setStaffModalOpen(false);
  };

  const handleToggleCircle = (circleId: string) => {
    const exists = staffForm.circleIds.includes(circleId);
    if (exists) {
      setStaffForm({
        ...staffForm,
        circleIds: staffForm.circleIds.filter(id => id !== circleId)
      });
    } else {
      setStaffForm({
        ...staffForm,
        circleIds: [...staffForm.circleIds, circleId]
      });
    }
  };

  const roleLabels = {
    leader: { label: 'قائدة المقرأة', bg: 'bg-rose-100 text-rose-800 border-rose-300' },
    supervisor: { label: 'مشرفة مسار / حلقات', bg: 'bg-amber-100 text-amber-800 border-amber-300' },
    teacher: { label: 'معلمة حلقة', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300' }
  };

  return (
    <div className="space-y-6">

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-[#E8DFD8] shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">👩‍🏫</span>
            <h2 className="text-xl font-bold text-stone-900 font-quran">المعلمات والمشرفات والأيقونات والتواقيع</h2>
          </div>
          <p className="text-xs text-stone-500">
            إدارة الكادر التعليمي، تخصيص الأيقونات الرمزية الإسلامية، رفع التواقيع المعتمدة، وإدارة رموز الدخول بأمان
          </p>
        </div>

        {currentUser?.role === 'leader' && (
          <button
            onClick={() => handleOpenStaffModal()}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-[#8E5364] hover:bg-[#744251] text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition self-start sm:self-auto active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة معلمة / مشرفة</span>
          </button>
        )}
      </div>

      {/* Staff Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map(user => {
          const roleConfig = roleLabels[user.role] || roleLabels.teacher;
          const userIslamicIcon = getIslamicIcon(user.avatarIcon);
          const iconColor = user.avatarColor || '#8E5364';
          const isRevealed = !!revealedPins[user.id];

          const supervisedCircles = circles.filter(c => c.supervisorId === user.id);
          const taughtCircles = circles.filter(c => c.teacherId === user.id);

          return (
            <div
              key={user.id}
              className="bg-white p-5 rounded-3xl border border-[#E8DFD8] shadow-2xs space-y-4 hover:border-[#D4C4BC] transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {/* Islamic Avatar Badge */}
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg border transition shadow-2xs"
                    style={{
                      backgroundColor: `${iconColor}15`,
                      borderColor: `${iconColor}40`,
                      color: iconColor
                    }}
                    title={userIslamicIcon.name}
                  >
                    {userIslamicIcon.svg({ className: 'w-6 h-6', color: iconColor })}
                  </div>
                  <div>
                    <h3 className="font-bold text-stone-900 text-sm">{user.name}</h3>
                    <p className="text-[11px] text-stone-500">{user.title}</p>
                    <span className="text-[10px] text-stone-400 flex items-center gap-1 mt-0.5">
                      <span>✨</span>
                      <span>{userIslamicIcon.name}</span>
                    </span>
                  </div>
                </div>

                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${roleConfig.bg}`}>
                  {roleConfig.label}
                </span>
              </div>

              {/* Contact info */}
              <div className="space-y-1.5 text-xs text-stone-600 bg-[#FCFAF8] p-3 rounded-2xl border border-[#EFE8E2]">
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-stone-400" />
                  <span className="text-[11px] truncate">{user.email}</span>
                </div>
                {user.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-stone-400" />
                    <span className="text-[11px] font-mono">{user.phone}</span>
                  </div>
                )}
              </div>

              {/* Circles info */}
              <div className="pt-2 border-t border-stone-100 text-xs">
                <span className="text-stone-400 block text-[10px] mb-1">الحلقات المسندة:</span>
                {user.role === 'leader' ? (
                  <span className="text-[#8E5364] font-bold text-[11px]">صلاحية شاملة على كافة الحلقات والمسارات</span>
                ) : user.role === 'supervisor' ? (
                  <div className="flex flex-wrap gap-1">
                    {supervisedCircles.length > 0 ? (
                      supervisedCircles.map(c => (
                        <span key={c.id} className="px-2 py-0.5 rounded-md bg-[#FAF0F3] text-[#8E5364] font-medium text-[11px]">
                          {c.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-stone-400 text-[11px]">لم يتم تحديد حلقات بعد</span>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {taughtCircles.length > 0 ? (
                      taughtCircles.map(c => (
                        <span key={c.id} className="px-2 py-0.5 rounded-md bg-[#EBF3EE] text-[#2D5A43] font-medium text-[11px]">
                          {c.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-stone-400 text-[11px]">لم يتم تحديد حلقات بعد</span>
                    )}
                  </div>
                )}
              </div>

              {/* Signature status preview */}
              <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs">
                <span className="text-stone-500 flex items-center gap-1 text-[11px]">
                  <FileSignature className="w-3.5 h-3.5 text-[#8E5364]" />
                  <span>التوقيع المعتمد:</span>
                </span>
                {user.signatureUrl ? (
                  <div className="flex items-center gap-1.5">
                    <img
                      src={user.signatureUrl}
                      alt="توقيع"
                      className="h-6 max-w-[80px] object-contain drop-shadow-2xs"
                    />
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">
                      مرفوع ✅
                    </span>
                  </div>
                ) : (
                  <span className="text-[10px] text-stone-400">لم يُرفع بعد</span>
                )}
              </div>

              {/* Passcode Security Information - Masked by default */}
              <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs">
                <span className="text-stone-500 flex items-center gap-1 text-[11px]">
                  <Shield className="w-3.5 h-3.5 text-amber-700" />
                  <span>رمز الدخول السري (PIN):</span>
                </span>
                <div className="flex items-center gap-1">
                  <span className="font-mono bg-stone-100 border border-stone-200 px-2 py-0.5 rounded-md text-stone-800 font-bold text-xs tracking-wider">
                    {isRevealed ? (user.passcode || '1234') : '••••'}
                  </span>
                  <button
                    type="button"
                    onClick={() => togglePinReveal(user.id)}
                    className="p-1 text-stone-400 hover:text-stone-700 transition cursor-pointer"
                    title={isRevealed ? 'إخفاء الرمز' : 'إظهار الرمز'}
                  >
                    {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {currentUser?.role === 'leader' && (
                <div className="pt-1 flex justify-end">
                  <button
                    onClick={() => handleOpenStaffModal(user)}
                    className="p-1.5 text-stone-600 hover:text-stone-900 text-xs flex items-center gap-1 hover:bg-stone-50 rounded-lg transition cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>تعديل الصلاحيات والأيقونة والتوقيع</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Permissions Matrix Explanation */}
      <div className="bg-white p-6 rounded-3xl border border-[#E8DFD8] shadow-2xs space-y-4">
        <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#8E5364]" />
          <span>مصفوفة الصلاحيات المطبقة على الخادم:</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-[#FCFAF8] border border-[#EFE8E2] space-y-2">
            <span className="font-bold text-rose-900 block text-sm">١. قائدة المقرأة:</span>
            <ul className="space-y-1 text-stone-600 text-[11px] list-disc list-inside leading-relaxed">
              <li>صلاحية كاملة لإنشاء وتعديل وحذف وأرشفة المسارات والحلقات.</li>
              <li>إدارة الكادر التعليمي، تعيين رموز الدخول واعتماد تواقيع المعلمات.</li>
              <li>تخصيص الهوية البصرية، الشعار، وختم الاعتماد الرسمي.</li>
              <li>النسخ الاحتياطي واستعادة البيانات بالكامل.</li>
            </ul>
          </div>

          <div className="p-4 rounded-2xl bg-[#FCFAF8] border border-[#EFE8E2] space-y-2">
            <span className="font-bold text-amber-900 block text-sm">٢. مشرفة المسار / الحلقات:</span>
            <ul className="space-y-1 text-stone-600 text-[11px] list-disc list-inside leading-relaxed">
              <li>متابعة كافة حلقات المسار المسند إليها وسجلات الحفظ والغياب.</li>
              <li>اعتماد الخطط الشهرية والتحديات ومتابعة نتائج الاختبارات.</li>
              <li>استخراج تقارير التحصيل التراكمية وسجلات الإنجاز.</li>
            </ul>
          </div>

          <div className="p-4 rounded-2xl bg-[#FCFAF8] border border-[#EFE8E2] space-y-2">
            <span className="font-bold text-emerald-900 block text-sm">٣. معلمة الحلقة:</span>
            <ul className="space-y-1 text-stone-600 text-[11px] list-disc list-inside leading-relaxed">
              <li>رصد الحضور اليومي والتحضير المبكر لطالبات حلقتها.</li>
              <li>تقييم التسميع اليومي وفق معايير مشكاة الغيم والخصومات المعتمدة.</li>
              <li>تعيين الرفيقة والثنائيات مباشرة من مصفوفة المراجعة.</li>
              <li>تصحيح واجبات «أتقني» ورصد نتائج التحديات الأسبوعية.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Staff Modal (Add / Edit) */}
      {staffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-stone-200 space-y-4 max-h-[92vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">👩‍🏫</span>
                <h3 className="font-bold text-stone-900 text-sm">
                  {editingStaff ? `تعديل بيانات: ${editingStaff.name}` : 'إضافة معلمة أو مشرفة جديدة'}
                </h3>
              </div>
              <button
                onClick={() => setStaffModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStaff} className="space-y-4">
              
              {/* Basic Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">الاسم الكامل *</label>
                  <input
                    type="text"
                    required
                    value={staffForm.name}
                    onChange={e => setStaffForm({ ...staffForm, name: e.target.value })}
                    placeholder="مثال: أ. منيرة السبيعي"
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">الصفة / الدور *</label>
                  <select
                    value={staffForm.role}
                    onChange={e => setStaffForm({ ...staffForm, role: e.target.value as UserRole })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs bg-white font-bold"
                  >
                    <option value="teacher">معلمة حلقة قرآنية</option>
                    <option value="supervisor">مشرفة مسار / حلقات</option>
                    <option value="leader">قائدة المقرأة</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">المسمى الوظيفي</label>
                  <input
                    type="text"
                    value={staffForm.title}
                    onChange={e => setStaffForm({ ...staffForm, title: e.target.value })}
                    placeholder="مثال: معلمة حلقة راسخات"
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">البريد الإلكتروني</label>
                  <input
                    type="email"
                    required
                    value={staffForm.email}
                    onChange={e => setStaffForm({ ...staffForm, email: e.target.value })}
                    placeholder="name@ghaym.org"
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">رقم الجوال</label>
                  <input
                    type="tel"
                    value={staffForm.phone}
                    onChange={e => setStaffForm({ ...staffForm, phone: e.target.value })}
                    placeholder="05XXXXXXXX"
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              {/* Passcode (PIN) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-stone-700">
                    رمز الدخول السري (PIN Code) *
                  </label>
                  <button
                    type="button"
                    onClick={() => setStaffForm({ ...staffForm, passcode: String(Math.floor(1000 + Math.random() * 9000)) })}
                    className="text-[11px] text-[#8E5364] hover:underline font-semibold cursor-pointer"
                  >
                    توليد رمز عشوائي 🎲
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={staffForm.passcode}
                  onChange={e => setStaffForm({ ...staffForm, passcode: e.target.value })}
                  placeholder="مثال: 5432"
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs font-mono font-bold tracking-wider"
                />
                <span className="text-[10px] text-stone-400 mt-1 block">
                  الرمز السري المخصص لهذه المعلمة للدخول لحسابها وإنجاز التسميع وإدارة طالباتها.
                </span>
              </div>

              {/* Islamic Symbolic Icon Selector */}
              <div>
                <IslamicIconPicker
                  selectedIconId={staffForm.avatarIcon}
                  selectedColor={staffForm.avatarColor}
                  onSelect={(iconId, color) => {
                    setStaffForm(prev => ({ ...prev, avatarIcon: iconId, avatarColor: color }));
                  }}
                />
              </div>

              {/* Signature Upload from Device */}
              <div className="p-4 bg-[#FCFAF8] rounded-2xl border border-stone-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-stone-700 flex items-center gap-1.5">
                    <FileSignature className="w-4 h-4 text-[#8E5364]" />
                    <span>توقيع المعلمة / المشرفة المعتمد (يظهر على الشهادات والتقارير):</span>
                  </label>
                  {staffForm.signatureUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveSignature}
                      className="text-xs text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف التوقيع</span>
                    </button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <label className="px-4 py-2.5 bg-white border border-stone-300 hover:border-[#8E5364] rounded-xl text-xs font-bold text-stone-700 cursor-pointer flex items-center gap-2 shadow-2xs transition">
                    <Upload className="w-4 h-4 text-[#8E5364]" />
                    <span>رفع التوقيع من الجهاز (PNG / JPG)</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleSignatureUpload}
                      className="hidden"
                    />
                  </label>

                  {staffForm.signatureUrl ? (
                    <div className="p-2 bg-white rounded-xl border border-stone-200 flex items-center gap-3">
                      <img
                        src={staffForm.signatureUrl}
                        alt="معاينة التوقيع"
                        className="h-10 max-w-[140px] object-contain drop-shadow-xs"
                      />
                      <span className="text-[11px] text-emerald-700 font-bold">تم الرفع بنجاح ✅</span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-stone-400">
                      يُفضل رفع صورة مفرغة الخلفية بتنسيق PNG لإظهارها فوق خط التوقيع
                    </span>
                  )}
                </div>
              </div>

              {/* Circle assignments */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  الحلقات المسندة إليها:
                </label>
                <div className="p-3 bg-[#FCFAF8] rounded-2xl border border-stone-200 space-y-2 max-h-36 overflow-y-auto">
                  {circles.map(circle => {
                    const checked = staffForm.circleIds.includes(circle.id);
                    return (
                      <label key={circle.id} className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer hover:text-stone-900">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleCircle(circle.id)}
                          className="rounded text-[#8E5364] focus:ring-[#8E5364]"
                        />
                        <span>{circle.icon || '🪴'} {circle.name}</span>
                        <span className="text-[10px] text-stone-400 mr-auto">({circle.scheduleDays.join('، ')})</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setStaffModalOpen(false)}
                  className="px-4 py-2 text-stone-600 text-xs rounded-xl hover:bg-stone-100 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#8E5364] text-white text-xs font-bold rounded-xl hover:bg-[#744251] shadow-xs active:scale-95 transition cursor-pointer"
                >
                  {editingStaff ? 'حفظ التعديلات والتوقيع' : 'إضافة إلى الكادر'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
